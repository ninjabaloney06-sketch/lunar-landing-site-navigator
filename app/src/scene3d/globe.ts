// Space scene for the globe level: origin = Moon centre, axes = MOON_ME, unit = km. Textured Moon lit by the
// true Sun direction, one pin per site, click on the surface → planetocentric lat/lon.

import {
  BoxGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  Quaternion,
  Ray,
  Raycaster,
  Scene,
  Sphere,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three'
import type { Site } from '../data/types'
import { MOON_RADIUS_KM, siteVector } from '../geometry'
import { checkerTexture, type TextureSet } from './assets'
import { SPHERE_TO_BODY, latLonOf, v3 } from './frames'

const PIN_LEN_PX = 26
const PIN_W_PX = 1.6
const HEAD_PX = 3.2
const MARK_LEN_PX = 18 // user points: shorter stem, square head
const MARK_HEAD_PX = 3
const PIN_MAX_DIST_KM = 60_000 // farther out the pins would be longer than the Moon is wide: hidden
const NAME_RADIUS_PX = 10
const Z = new Vector3(0, 0, 1)

/** A user point on the globe (Brief C4 part 3): a place, never a computed site. */
export interface GlobeMarker {
  name: string
  lat: number
  lon: number
  selected: boolean
}

interface Mark {
  m: GlobeMarker
  surface: Vector3
  group: Group
  stem: Mesh
  head: Mesh
}

interface Pin {
  site: Site
  surface: Vector3
  group: Group
  stem: Mesh
  head: Mesh
}

export class GlobeWorld {
  readonly scene = new Scene()
  private readonly moon: Mesh
  private readonly moonMat: MeshPhysicalMaterial
  private checkerMat: MeshBasicMaterial | null = null
  private readonly pins: Pin[] = []
  private readonly pinGroup = new Group()
  private readonly marks: Mark[] = []
  private readonly markGroup = new Group()
  private readonly sunLight = new DirectionalLight(0xfff4e6, 3 * Math.PI)
  private readonly earthLight = new DirectionalLight(0x9fb6d8, 0)
  private readonly raycaster = new Raycaster()
  private selected: string | null = null
  private pinLenKm = 100

  constructor(tex: TextureSet) {
    // Diffuse only, as the site terrain (site.ts: no GGX glare at the limb and terminator).
    this.moonMat = new MeshPhysicalMaterial({
      specularIntensity: 0,
      map: tex.moon ?? null,
      normalMap: tex.moonNormal ?? null,
      color: tex.moon ? 0xffffff : 0x8b8781,
      roughness: 1,
      metalness: 0,
    })
    this.moon = new Mesh(new SphereGeometry(MOON_RADIUS_KM, 256, 128), this.moonMat)
    this.moon.quaternion.copy(SPHERE_TO_BODY) // texture longitude 0 → +x MOON_ME, north → +z (T16)
    this.scene.add(this.moon, this.pinGroup, this.markGroup, this.sunLight, this.sunLight.target, this.earthLight, this.earthLight.target)
  }

  /** 'checker' = T16 debug texture with labelled meridians, unlit so the terminator cannot hide it. */
  setTexture(mode: 'real' | 'checker') {
    if (mode === 'checker') {
      this.checkerMat ??= new MeshBasicMaterial({ map: checkerTexture(), toneMapped: false })
      this.moon.material = this.checkerMat
    } else this.moon.material = this.moonMat
  }

  setSites(sites: Site[], selectedId: string | null) {
    this.selected = selectedId
    for (const p of this.pins) this.pinGroup.remove(p.group)
    this.pins.length = 0
    const stemMat = new MeshBasicMaterial({ color: 0xd9d6cf, toneMapped: false })
    const headMat = new MeshBasicMaterial({ color: 0xf2efe8, toneMapped: false })
    for (const site of sites) {
      const surface = v3(siteVector(site.lat, site.lon, 0))
      const group = new Group()
      group.position.copy(surface)
      group.quaternion.copy(new Quaternion().setFromUnitVectors(Z, surface.clone().normalize()))
      const stem = new Mesh(new BoxGeometry(1, 1, 1).translate(0, 0, 0.5), stemMat)
      const head = new Mesh(new SphereGeometry(1, 12, 8), headMat)
      group.add(stem, head)
      this.pinGroup.add(group)
      this.pins.push({ site, surface, group, stem, head })
    }
  }

  /** User points: a thin stem with a square head, so they are not mistaken for a site pin (round head). */
  setMarkers(markers: GlobeMarker[]) {
    for (const k of this.marks) this.markGroup.remove(k.group)
    this.marks.length = 0
    const mat = new MeshBasicMaterial({ color: 0xf2efe8, toneMapped: false })
    for (const m of markers) {
      const surface = v3(siteVector(m.lat, m.lon, 0))
      const group = new Group()
      group.position.copy(surface)
      group.quaternion.copy(new Quaternion().setFromUnitVectors(Z, surface.clone().normalize()))
      const stem = new Mesh(new BoxGeometry(1, 1, 1).translate(0, 0, 0.5), mat)
      const head = new Mesh(new BoxGeometry(2, 2, 2), mat)
      group.add(stem, head)
      this.markGroup.add(group)
      this.marks.push({ m, surface, group, stem, head })
    }
  }

  setLights(sunDirMe: Vector3, earthDirMe: Vector3, earthFill: number) {
    this.sunLight.position.copy(sunDirMe).multiplyScalar(1e5)
    this.earthLight.position.copy(earthDirMe).multiplyScalar(1e5)
    this.earthLight.intensity = earthFill
  }

  /** Constant on-screen pin size. */
  updatePins(cam: PerspectiveCamera, heightPx: number) {
    this.pinGroup.visible = this.markGroup.visible = cam.position.length() < PIN_MAX_DIST_KM
    for (const k of this.marks) {
      const dist = cam.position.distanceTo(k.surface)
      const perPx = (2 * dist) / (cam.projectionMatrix.elements[5] * heightPx)
      const len = MARK_LEN_PX * perPx
      k.stem.scale.set(PIN_W_PX * perPx, PIN_W_PX * perPx, len)
      k.head.position.set(0, 0, len)
      k.head.scale.setScalar(MARK_HEAD_PX * perPx * (k.m.selected ? 1.4 : 1))
    }
    for (const p of this.pins) {
      const dist = cam.position.distanceTo(p.surface)
      const perPx = (2 * dist) / (cam.projectionMatrix.elements[5] * heightPx)
      const sel = p.site.id === this.selected
      const len = PIN_LEN_PX * perPx * (sel ? 1.25 : 1)
      p.stem.scale.set(PIN_W_PX * perPx, PIN_W_PX * perPx, len)
      p.head.position.set(0, 0, len)
      p.head.scale.setScalar(HEAD_PX * perPx * (sel ? 1.3 : 1))
      if (sel) this.pinLenKm = len
    }
  }

  /** Pin head position (MOON_ME km) of a site, for labels and tests. */
  pinTop(siteId: string): Vector3 | null {
    const p = this.pins.find((q) => q.site.id === siteId)
    return p ? p.head.getWorldPosition(new Vector3()) : null
  }

  pinSurface(siteId: string): Vector3 | null {
    return this.pins.find((q) => q.site.id === siteId)?.surface.clone() ?? null
  }

  get selectedPinLength() {
    return this.pinLenKm
  }

  get pinsVisible() {
    return this.pinGroup.visible
  }

  /** Head position (MOON_ME km) of user point i. */
  markTop(i: number): Vector3 | null {
    return this.marks[i]?.head.getWorldPosition(new Vector3()) ?? null
  }

  /** The site pin or user point whose head is within 10 px of the pointer and not behind the Moon. */
  nameAt(ndc: Vector2, cam: PerspectiveCamera, sizePx: Vector2): { kind: 'site'; id: string } | { kind: 'point'; index: number } | null {
    if (!this.pinGroup.visible) return null
    let best: { kind: 'site'; id: string } | { kind: 'point'; index: number } | null = null
    let bestD = NAME_RADIUS_PX
    const near = (head: Mesh) => {
      const s = head.getWorldPosition(new Vector3())
      if (this.occluded(cam.position, s)) return Infinity
      const q = s.project(cam)
      return q.z > 1 ? Infinity : Math.hypot(((q.x - ndc.x) / 2) * sizePx.x, ((q.y - ndc.y) / 2) * sizePx.y)
    }
    this.pins.forEach((p) => {
      const d = near(p.head)
      if (d < bestD) {
        bestD = d
        best = { kind: 'site', id: p.site.id }
      }
    })
    this.marks.forEach((k, index) => {
      const d = near(k.head)
      if (d < bestD) {
        bestD = d
        best = { kind: 'point', index }
      }
    })
    return best
  }

  /** Surface point of the Moon under the pointer (planetocentric lat/lon, MOON_ME), pins ignored. */
  surface(ndc: Vector2, cam: PerspectiveCamera): { lat: number; lon: number } | null {
    this.raycaster.setFromCamera(ndc, cam)
    const hit = this.raycaster.intersectObject(this.moon, false)[0]
    return hit ? latLonOf(hit.point) : null
  }

  /** Click → a pin within 10 px (its source coordinates) or the surface point under the cursor. */
  pick(ndc: Vector2, cam: PerspectiveCamera, sizePx: Vector2): { lat: number; lon: number } | null {
    let best: Pin | null = null
    let bestD = 10
    for (const p of this.pins) {
      const s = p.head.getWorldPosition(new Vector3())
      if (this.occluded(cam.position, s)) continue
      const q = s.project(cam)
      const d = Math.hypot(((q.x - ndc.x) / 2) * sizePx.x, ((q.y - ndc.y) / 2) * sizePx.y)
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    if (best) return { lat: best.site.lat, lon: best.site.lon }
    this.raycaster.setFromCamera(ndc, cam)
    const hit = this.raycaster.intersectObject(this.moon, false)[0]
    return hit ? latLonOf(hit.point) : null
  }

  /** True when the Moon blocks the segment from `from` to `to` (km). */
  occluded(from: Vector3, to: Vector3): boolean {
    const dir = to.clone().sub(from)
    const len = dir.length()
    const hit = new Ray(from, dir.normalize()).intersectSphere(new Sphere(new Vector3(), MOON_RADIUS_KM * 0.9995), new Vector3())
    return hit !== null && hit.distanceTo(from) < len - 1e-6
  }

  /** True when the Moon blocks the ray from `from` along unit `dir`. */
  occludedDir(from: Vector3, dir: Vector3): boolean {
    return new Ray(from, dir).intersectSphere(new Sphere(new Vector3(), MOON_RADIUS_KM * 0.9995), new Vector3()) !== null
  }
}
