// Pins drawn in numbers (S4): the points of interest on the globe and in the site scene, and the other landing
// sites near the current one in the site scene. Instanced meshes for any number of pins (stems, round heads,
// triangular heads, and their outlines), a constant size on screen, and nothing allocated per frame.
//
// A point of interest's pin has a dark outline (its colour comes from the page and may be close to the sunlit
// regolith's): a slightly larger dark copy of the stem and of the head, drawn first without writing depth, with
// the coloured pin drawn over it. Three more instanced meshes, three more draw calls.
//
// Shapes: 'site' is the landing-site pin, a stem with a round head. 'poi' is a short stem with a triangle that
// always faces the camera, tip down: it reads as a triangle from every side, so it is not mistaken for the round
// head of a site pin or the square head of a user point.

import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type PerspectiveCamera,
  type Vector2,
} from 'three'

export interface PinItem {
  /** What named() reports: a point of interest (its ScenePoi id) or a landing site (its id in sites.json). */
  kind: 'poi' | 'site'
  id: string
  name: string
  shape: 'site' | 'poi'
  /** Where the pin stands and the unit vector its stem points along, in the scene's frame and unit. */
  base: Vector3
  up: Vector3
  color: string | number
  /** Site scene only: the pin's terrain-grid offset from the site (ENU x, y in m). */
  grid?: { x: number; y: number }
}

/**
 * At site and eye level a point of interest, or another landing site, is drawn only within this ground distance
 * of the current site, km. 60 km is the half-width of the mid terrain level (levels.ts: 400 m samples to ±60 km),
 * the farthest the site camera orbits (index.ts SITE_DIST_KM.max) and the farthest a click walks: inside it a
 * pin stands on relief the scene shows in detail and the camera can go to it. Beyond it there is only the far
 * level (2 km samples, where a pin's foot could be a cell away from the feature it marks), and from the default
 * camera most of it is past the horizon.
 */
export const POI_NEAR_KM = 60

/**
 * At site and eye level a pin closer than this to the current site, km, is not drawn (visual sweep 20): it marks the
 * landing site itself (its own landing record, a sunlit point on the same spot), which the mast already marks, and
 * from the default view such pins stood on the mast's foot and hid it. On the globe every pin is drawn.
 */
export const POI_AT_SITE_KM = 0.5

const STEM_W_PX = 1.6
const SITE_LEN_PX = 26 // the globe's site pin (globe.ts)
const SITE_HEAD_PX = 3.2
const POI_LEN_PX = 12
const POI_HEAD_PX = 5.5 // circumradius of the triangle
const OUTLINE_PX = 1.5 // width of the dark outline around a point of interest's pin
const OUTLINE_COLOR = 0x0b0d11 // the page background (index.ts BACKGROUND)
const Z = new Vector3(0, 0, 1)
const H = Math.sqrt(3) / 2

/** Unit triangle in the xy plane, one corner straight down, facing +z. */
function triangle(): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute([0, -1, 0, H, 0.5, 0, -H, 0.5, 0], 3))
  g.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3))
  return g
}

export class PinField {
  readonly group = new Group()
  private items: PinItem[] = []
  private turn: Quaternion[] = [] // stem direction of each pin
  private slot = new Int32Array(0) // index of each pin's head in its head mesh
  private rimStem = new Int32Array(0) // index of each pin's stem outline, −1 = no outline
  private rimHead = new Int32Array(0) // index of its head outline in the outline mesh of its shape
  private stemRims: InstancedMesh | null = null
  private roundRims: InstancedMesh | null = null
  private triRims: InstancedMesh | null = null
  private readonly rimMat = new MeshBasicMaterial({ color: OUTLINE_COLOR, toneMapped: false, depthWrite: false })
  private readonly discGeo = new CircleGeometry(1, 20)
  private heads = new Float32Array(0) // head centre of each pin after update(), xyz
  private stems: InstancedMesh | null = null
  private round: InstancedMesh | null = null
  private tri: InstancedMesh | null = null
  private readonly mat = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
  private readonly stemGeo = new BoxGeometry(1, 1, 1).translate(0, 0, 0.5)
  private readonly roundGeo = new SphereGeometry(1, 12, 8)
  private readonly triGeo = triangle()
  // Scratch values for update() and nearest(): nothing is allocated per frame.
  private readonly m = new Matrix4()
  private readonly p = new Vector3()
  private readonly s = new Vector3()
  private readonly camUp = new Vector3()
  private readonly still = new Quaternion()

  get count() {
    return this.items.length
  }

  set(items: PinItem[]) {
    for (const mesh of [this.stems, this.round, this.tri, this.stemRims, this.roundRims, this.triRims]) {
      if (!mesh) continue
      this.group.remove(mesh)
      mesh.dispose()
    }
    this.stems = this.round = this.tri = this.stemRims = this.roundRims = this.triRims = null
    this.items = items
    this.turn = items.map((it) => new Quaternion().setFromUnitVectors(Z, it.up))
    this.slot = new Int32Array(items.length)
    this.heads = new Float32Array(items.length * 3)
    if (!items.length) return
    const nRound = items.filter((it) => it.shape === 'site').length
    const mesh = (geo: BufferGeometry, n: number, rim = false) => {
      const im = new InstancedMesh(geo, rim ? this.rimMat : this.mat, n)
      im.frustumCulled = false // the instances move every frame; the pins are few
      // After the terrain and the Moon (order 0), the outlines before the pins they belong to.
      im.renderOrder = rim ? 1 : 2
      this.group.add(im)
      return im
    }
    this.stems = mesh(this.stemGeo, items.length)
    if (nRound) this.round = mesh(this.roundGeo, nRound)
    if (nRound < items.length) this.tri = mesh(this.triGeo, items.length - nRound)
    // Outlines: for the points of interest only (a landing site's pin near the site keeps the look of the globe's).
    const outlined = items.filter((it) => it.kind === 'poi')
    const nRoundRim = outlined.filter((it) => it.shape === 'site').length
    if (outlined.length) this.stemRims = mesh(this.stemGeo, outlined.length, true)
    if (nRoundRim) this.roundRims = mesh(this.discGeo, nRoundRim, true)
    if (nRoundRim < outlined.length) this.triRims = mesh(this.triGeo, outlined.length - nRoundRim, true)
    this.rimStem = new Int32Array(items.length).fill(-1)
    this.rimHead = new Int32Array(items.length).fill(-1)
    let o = 0
    let oRound = 0
    let oTri = 0
    items.forEach((it, i) => {
      if (it.kind !== 'poi') return
      this.rimStem[i] = o++
      this.rimHead[i] = it.shape === 'site' ? oRound++ : oTri++
    })
    const c = new Color()
    let r = 0
    let t = 0
    items.forEach((it, i) => {
      c.set(it.color)
      this.stems!.setColorAt(i, c)
      if (it.shape === 'site') {
        this.slot[i] = r
        this.round!.setColorAt(r++, c)
      } else {
        this.slot[i] = t
        this.tri!.setColorAt(t++, c)
      }
    })
  }

  /** Constant size on screen: call before drawing and before head() or nearest(). */
  update(cam: PerspectiveCamera, heightPx: number) {
    if (!this.stems) return
    const { items, m, p, s, heads } = this
    const scale = 2 / (cam.projectionMatrix.elements[5] * heightPx)
    this.camUp.setFromMatrixColumn(cam.matrixWorld, 1)
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const perPx = Math.max(cam.position.distanceTo(it.base), 1e-6) * scale
      const site = it.shape === 'site'
      const len = (site ? SITE_LEN_PX : POI_LEN_PX) * perPx
      const w = STEM_W_PX * perPx
      const edge = OUTLINE_PX * perPx
      const rimStem = this.rimStem[i]
      const rimHead = this.rimHead[i]
      const rim = rimStem
      this.stems.setMatrixAt(i, m.compose(it.base, this.turn[i], s.set(w, w, len)))
      if (rim >= 0) this.stemRims!.setMatrixAt(rimStem, m.compose(it.base, this.turn[i], s.set(w + 2 * edge, w + 2 * edge, len)))
      p.copy(it.base).addScaledVector(it.up, len)
      if (site) {
        const r = SITE_HEAD_PX * perPx
        this.round!.setMatrixAt(this.slot[i], m.compose(p, this.still, s.setScalar(r)))
        // A disc facing the camera through the head's centre: it shows as a ring around the sphere.
        if (rim >= 0) this.roundRims!.setMatrixAt(rimHead, m.compose(p, cam.quaternion, s.setScalar(r + edge)))
      } else {
        // The triangle faces the camera, its lower corner on the top of the stem.
        const r = POI_HEAD_PX * perPx
        p.addScaledVector(this.camUp, r)
        this.tri!.setMatrixAt(this.slot[i], m.compose(p, cam.quaternion, s.setScalar(r)))
        // The same triangle with its sides moved out by the outline's width (the inradius is half the circumradius).
        if (rim >= 0) this.triRims!.setMatrixAt(rimHead, m.compose(p, cam.quaternion, s.setScalar(r + 2 * edge)))
      }
      heads[i * 3] = p.x
      heads[i * 3 + 1] = p.y
      heads[i * 3 + 2] = p.z
    }
    this.stems.instanceMatrix.needsUpdate = true
    if (this.round) this.round.instanceMatrix.needsUpdate = true
    if (this.tri) this.tri.instanceMatrix.needsUpdate = true
    if (this.stemRims) this.stemRims.instanceMatrix.needsUpdate = true
    if (this.roundRims) this.roundRims.instanceMatrix.needsUpdate = true
    if (this.triRims) this.triRims.instanceMatrix.needsUpdate = true
  }

  item(i: number): PinItem | null {
    return this.items[i] ?? null
  }

  indexOf(kind: PinItem['kind'], id: string): number {
    return this.items.findIndex((it) => it.kind === kind && it.id === id)
  }

  /** Head centre of pin i as of the last update(), in the scene's frame. */
  head(i: number, out: Vector3): Vector3 {
    return out.fromArray(this.heads, i * 3)
  }

  /**
   * The pin of the given kind whose head is nearest to the pointer within radiusPx, −1 if none. `hidden` is
   * asked only for heads inside the radius (it may be a ray test against terrain).
   */
  nearest(kind: PinItem['kind'], ndc: Vector2, cam: PerspectiveCamera, widthPx: number, heightPx: number, radiusPx: number, hidden: (head: Vector3) => boolean): number {
    let best = -1
    let bestD = radiusPx
    const { items, p, s } = this
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind !== kind) continue
      s.fromArray(this.heads, i * 3)
      p.copy(s).project(cam)
      if (p.z > 1 || p.z < -1) continue
      const d = Math.hypot(((p.x - ndc.x) / 2) * widthPx, ((p.y - ndc.y) / 2) * heightPx)
      if (d < bestD && !hidden(s)) {
        bestD = d
        best = i
      }
    }
    return best
  }
}
