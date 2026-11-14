// Flight scene: Earth, Moon and a whole mission. Every phase is one line (the full path dim, the part already
// flown bright, engine burns in a warm colour), the capsule is a glowing point, the lander a second, smaller one
// while it flies on its own. Dots mark the launchpad and the landing point, a thin ring where the Moon will be
// when the capsule arrives: at liftoff the Moon is still about 70° back along its orbit.
//
// Frame and units: Earth-centred J2000 axes, km. Legs in the Earth frame are drawn where they are; legs in the
// Moon frame are relative to the Moon's centre and travel with it. By default everything is at true scale, where
// the solver put it. The optional display magnification (EARTH_MAG, MOON_MAG) pushes the neighbourhood of each
// body outwards so the parking orbit and the low lunar orbit can be seen from afar, at the price of bending the
// path near the bodies. The body meshes are then scaled by the preset's k: a radius below a is inside the linear
// part of the map, so the surface lands exactly at k·R.
//
// Close up: a globe mesh is made of flat facets, hundreds of kilometres wide, whose middles lie kilometres below
// the true sphere. Under the launchpad and the landing point a finely divided patch of the true sphere is laid
// over the globe, so that a craft a few kilometres up is drawn at its true height above the ground.
// The caller owns the camera and the render loop.

import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DirectionalLight,
  DynamicDrawUsage,
  FrontSide,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  type Material,
} from 'three'
import { R_EARTH_EQ } from '../flight/astro'
import { craftAt } from '../flight/craft'
import type { MissionLeg, MissionPlan, Quat, Vec3 } from '../flight/types'
import { add, combine, cross, latLonUnit, norm, qconj, qrot, scale, sub, unit } from '../flight/vec'
import { MOON_RADIUS_KM } from '../geometry'
import type { TextureSet } from './assets'
import { SPHERE_TO_BODY, quat, v3 } from './frames'
import { ATMO_FRAG, ATMO_VERT } from './sky'

export interface Magnify {
  k: number // scale inside radius a
  a: number // km
  b: number // km; true scale beyond b
}

// The enlarged zone is kept small so that the transfer itself is drawn true: beyond 60,000 km from Earth and
// 30,000 km from the Moon (less than a sixth of the way at either end) every point is where the solver put it.
export const EARTH_MAG: Magnify = { k: 3, a: 8000, b: 60000 }
export const MOON_MAG: Magnify = { k: 4, a: 2500, b: 30000 }

/** Radial map about the body's centre: d → k·d for d ≤ a, d for d ≥ b. In between the scale factor falls from k
 *  to 1 along a smoothstep in ln d, so the map and its slope are continuous (a drawn orbit gets no kink at a or
 *  b). Strictly increasing as long as 1.5·ln k < ln(b / a), which both presets satisfy. */
export function magnifyRadius(d: number, m: Magnify): number {
  if (d <= m.a) return m.k * d
  if (d >= m.b) return d
  const u = Math.log(d / m.a) / Math.log(m.b / m.a)
  return d * Math.pow(m.k, 1 - u * u * (3 - 2 * u))
}

/** Scales p to its mapped radius, keeping its direction. null = identity (true scale). */
export function magnify(p: Vec3, m: Magnify | null): Vec3 {
  if (!m) return [p[0], p[1], p[2]]
  const d = norm(p)
  if (d === 0) return [0, 0, 0]
  const s = magnifyRadius(d, m) / d
  return [p[0] * s, p[1] * s, p[2] * s]
}

export type FlightAnchor = 'earth' | 'moon' | 'capsule' | 'lander' | 'pad' | 'site' | 'arrival' | 'tli' | 'loi' | 'tei'

/** A click on a body: which one and where, in its own latitude and east longitude. */
export interface BodyPick {
  body: 'earth' | 'moon'
  latDeg: number
  lonDeg: number
}

const HOUR_MS = 3_600_000
const EARTH_R = R_EARTH_EQ // the radius the flight's altitudes refer to
const DOT_PX = 2.5 // dot radius on screen (diameter about 5 px)
const HALO_PX = 44 // capsule halo width on screen
const CORE_PX = 9
const LANDER_HALO_PX = 26
const LANDER_CORE_PX = 6
const PARKED_MOON: Vec3 = [384400, 0, 0] // Moon position when no plan is shown
const RING_TEX_PX = 256
const RING_TEX_RADIUS = 120 // circle radius inside the ring texture, px
const PATCH_DEG = 5 // angular radius of the fine surface patches
const PATCH_LIFT_KM = 0.003 // keeps a patch clear of the globe's vertices, which lie on the same sphere
const EVENT_DOTS: FlightAnchor[] = ['tli', 'loi', 'tei']

/** Flown part of one leg: the bright line's own geometry. `over` is the vertex overwritten by the marker. */
interface Flown {
  leg: MissionLeg
  geo: BufferGeometry
  base: Float32Array
  over: number
}

const radiusOf = (r: number, m: Magnify | null) => (m ? magnifyRadius(r, m) : r)

function setV(o: Object3D, v: Vec3) {
  o.position.set(v[0], v[1], v[2])
}

/** Largest i with t[i] ≤ x, for t[0] ≤ x < t[n−1]. */
function lastAtOrBefore(t: number[], x: number): number {
  let lo = 0
  let hi = t.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (t[mid] <= x) lo = mid
    else hi = mid - 1
  }
  return lo
}

function radialTexture(stops: [number, string][]): CanvasTexture {
  const s = 256
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  for (const [o, col] of stops) grad.addColorStop(o, col)
  g.fillStyle = grad
  g.fillRect(0, 0, s, s)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** A thin circle outline, drawn as a camera-facing sprite. */
function ringTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = RING_TEX_PX
  c.height = RING_TEX_PX
  const g = c.getContext('2d')!
  g.strokeStyle = 'rgba(217,214,207,1)'
  g.lineWidth = 2.5
  g.setLineDash([10, 9])
  g.beginPath()
  g.arc(RING_TEX_PX / 2, RING_TEX_PX / 2, RING_TEX_RADIUS, 0, 2 * Math.PI)
  g.stroke()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** A finely divided cap of a sphere of radius rKm around the body-fixed unit direction c, in body-fixed axes,
 *  with the texture coordinates of an equirectangular map whose centre is longitude 0. */
function patchGeometry(c: Vec3, rKm: number): BufferGeometry {
  const rings = 96
  const segs = 144
  const e1 = unit(Math.abs(c[2]) < 0.9 ? cross([0, 0, 1], c) : cross([1, 0, 0], c))
  const e2 = cross(c, e1)
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const lon0 = Math.atan2(c[1], c[0])
  for (let i = 0; i <= rings; i++) {
    const a = (PATCH_DEG * Math.PI) / 180 * (i / rings)
    for (let j = 0; j <= segs; j++) {
      const b = (2 * Math.PI * j) / segs
      const d = add(scale(c, Math.cos(a)), scale(combine(e1, Math.cos(b), e2, Math.sin(b)), Math.sin(a)))
      pos.push(d[0] * rKm, d[1] * rKm, d[2] * rKm)
      nor.push(d[0], d[1], d[2])
      // keep the longitude continuous across ±180° within the patch, so no triangle spans the whole map
      let lon = Math.atan2(d[1], d[0])
      if (lon - lon0 > Math.PI) lon -= 2 * Math.PI
      if (lon - lon0 < -Math.PI) lon += 2 * Math.PI
      uv.push(0.5 + lon / (2 * Math.PI), 0.5 + Math.asin(Math.max(-1, Math.min(1, d[2]))) / Math.PI)
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const p0 = i * (segs + 1) + j
      const p1 = p0 + segs + 1
      idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3))
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
  g.setIndex(idx)
  return g
}

export class FlightWorld {
  readonly scene = new Scene()
  private plan: MissionPlan | null = null
  private earthMag: Magnify | null = null
  private moonMag: Magnify | null = null
  private earthQ: Quat = [0, 0, 0, 1]
  private moonQ: Quat = [0, 0, 0, 1]

  private readonly earthMat: MeshStandardMaterial
  private readonly earthGroup = new Group()
  private readonly earthMesh: Mesh
  private readonly atmoMat: ShaderMaterial
  private readonly atmo: Mesh
  private earthPatch: Mesh | null = null

  private readonly moonMat: MeshPhysicalMaterial
  private readonly moonGroup = new Group() // at the Moon's centre, not scaled: carries the Moon-frame lines
  private readonly moonBody = new Group() // the Moon itself, scaled when enlarged
  private readonly moonMesh: Mesh
  private moonPatch: Mesh | null = null

  private readonly sunLight = new DirectionalLight(0xfff4e6, 3 * Math.PI)
  private readonly ambient = new AmbientLight(0xffffff, 0.04)

  private readonly dotGeo = new SphereGeometry(1, 12, 8)
  private readonly dotMat = new MeshBasicMaterial({ color: 0xf2efe8, toneMapped: false })
  private readonly dots = new Map<FlightAnchor, Mesh>()
  private readonly eventLocal = new Map<FlightAnchor, { frame: 'earth' | 'moon'; pos: Vec3 }>()

  private readonly line = (color: number, opacity: number) =>
    new LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false })
  private readonly dimMat = this.line(0xd9d6cf, 0.3)
  private readonly flownMat = this.line(0xf2efe8, 0.95)
  private readonly burnDimMat = this.line(0xff9a6a, 0.55)
  private readonly burnFlownMat = this.line(0xffb48a, 1)
  private readonly orbitMat = this.line(0xd9d6cf, 0.14)
  private planObjects: Object3D[] = []
  private planGeos: BufferGeometry[] = []
  private flown: Flown[] = []

  private readonly textures: CanvasTexture[] = []
  private readonly spriteMats: SpriteMaterial[] = []
  private readonly halo: Sprite
  private readonly core: Sprite
  private readonly landerHalo: Sprite
  private readonly landerCore: Sprite
  private readonly ring: Sprite // the Moon's place at lunar orbit insertion

  constructor(tex: TextureSet) {
    this.earthMat = new MeshStandardMaterial({
      map: tex.earth ?? null,
      color: tex.earth ? 0xffffff : 0x4d6d93,
      roughness: 0.9,
      metalness: 0,
    })
    this.earthMesh = new Mesh(new SphereGeometry(EARTH_R, 192, 96), this.earthMat)
    this.atmoMat = new ShaderMaterial({
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      uniforms: { uSun: { value: new Vector3(1, 0, 0) } },
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: FrontSide,
    })
    this.atmo = new Mesh(new SphereGeometry(EARTH_R * 1.035, 64, 32), this.atmoMat)
    this.atmo.renderOrder = 1
    this.earthGroup.add(this.earthMesh, this.atmo)

    // Same material as globe.ts (diffuse only, no specular glare at the limb).
    this.moonMat = new MeshPhysicalMaterial({
      specularIntensity: 0,
      map: tex.moon ?? null,
      normalMap: tex.moonNormal ?? null,
      color: tex.moon ? 0xffffff : 0x8b8781,
      roughness: 1,
      metalness: 0,
    })
    this.moonMesh = new Mesh(new SphereGeometry(MOON_RADIUS_KM, 192, 96), this.moonMat)
    this.moonBody.add(this.moonMesh)
    this.moonGroup.add(this.moonBody)

    for (const name of ['pad', 'site', ...EVENT_DOTS] as FlightAnchor[]) {
      const m = new Mesh(this.dotGeo, this.dotMat)
      m.visible = false
      this.scene.add(m)
      this.dots.set(name, m)
    }

    const sprite = (stops: [number, string][], order: number) => {
      const t = radialTexture(stops)
      const m = new SpriteMaterial({ map: t, blending: AdditiveBlending, depthWrite: false, depthTest: true, transparent: true, toneMapped: false })
      this.textures.push(t)
      this.spriteMats.push(m)
      const s = new Sprite(m)
      s.renderOrder = order
      s.visible = false
      return s
    }
    const hot: [number, string][] = [
      [0, 'rgba(255,255,255,1)'],
      [0.1, 'rgba(255,240,225,0.95)'],
      [0.25, 'rgba(255,150,100,0.6)'],
      [0.5, 'rgba(255,120,70,0.18)'],
      [1, 'rgba(255,120,70,0)'],
    ]
    const cool: [number, string][] = [
      [0, 'rgba(255,255,255,1)'],
      [0.12, 'rgba(232,240,255,0.9)'],
      [0.3, 'rgba(170,200,255,0.45)'],
      [0.55, 'rgba(150,185,255,0.12)'],
      [1, 'rgba(150,185,255,0)'],
    ]
    const white: [number, string][] = [
      [0, 'rgba(255,255,255,1)'],
      [0.5, 'rgba(255,250,242,0.9)'],
      [1, 'rgba(255,250,242,0)'],
    ]
    this.halo = sprite(hot, 3)
    this.core = sprite(white, 4)
    this.landerHalo = sprite(cool, 3)
    this.landerCore = sprite(white, 4)
    const ringTex = ringTexture()
    const ringMat = new SpriteMaterial({ map: ringTex, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false })
    this.textures.push(ringTex)
    this.spriteMats.push(ringMat)
    this.ring = new Sprite(ringMat)
    this.ring.visible = false

    this.sunLight.target.position.set(0, 0, 0)
    this.scene.add(
      this.earthGroup, this.moonGroup, this.sunLight, this.sunLight.target, this.ambient,
      this.halo, this.core, this.landerHalo, this.landerCore, this.ring,
    )
    this.park()
  }

  /** Builds lines and markers for a mission (null clears). trueScale = no magnification. */
  setPlan(plan: MissionPlan | null, trueScale: boolean): void {
    this.clearPlan()
    this.earthMag = trueScale ? null : EARTH_MAG
    this.moonMag = trueScale ? null : MOON_MAG
    this.plan = plan
    this.park()
    for (const d of this.dots.values()) d.visible = false
    for (const s of [this.halo, this.core, this.landerHalo, this.landerCore, this.ring]) s.visible = false
    if (!plan) return

    const ep = plan.ephem
    const em = this.earthMag
    const mm = this.moonMag

    // The Moon's orbit, sampled hourly over the mission (± 12 h), clamped to the ephemeris span.
    const lo = Math.max(ep.startMs, plan.launchMs - 12 * HOUR_MS)
    const hi = Math.min(ep.endMs, plan.endMs + 12 * HOUR_MS)
    const orbit: number[] = []
    for (let t = lo; t < hi; t += HOUR_MS) orbit.push(...magnify(ep.moonPos(t), em))
    orbit.push(...magnify(ep.moonPos(hi), em))
    const orbitGeo = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(orbit), 3))
    this.planGeos.push(orbitGeo)
    this.addPlanObject(new Line(orbitGeo, this.orbitMat), this.scene)

    // One dim line and one bright "flown" line per leg.
    for (const leg of plan.legs) {
      const n = leg.track.p.length
      if (n < 2) continue
      const base = new Float32Array(n * 3)
      leg.track.p.forEach((q, i) => base.set(leg.frame === 'moon' ? magnify(q, mm) : this.mapGeo(q, leg.track.t[i]), i * 3))
      const parent = leg.frame === 'moon' ? this.moonGroup : this.scene
      const dimGeo = new BufferGeometry().setAttribute('position', new BufferAttribute(base, 3))
      const attr = new BufferAttribute(new Float32Array(base), 3)
      attr.setUsage(DynamicDrawUsage)
      const flownGeo = new BufferGeometry().setAttribute('position', attr)
      flownGeo.setDrawRange(0, 0)
      this.planGeos.push(dimGeo, flownGeo)
      this.addPlanObject(new Line(dimGeo, leg.powered ? this.burnDimMat : this.dimMat), parent)
      this.addPlanObject(new Line(flownGeo, leg.powered ? this.burnFlownMat : this.flownMat), parent)
      this.flown.push({ leg, geo: flownGeo, base, over: -1 })
    }

    // Burns that shape the flight get a dot where they start.
    for (const name of EVENT_DOTS) {
      const e = plan.events.find((x) => x.id === name)
      const st = e && craftAt(plan, e.craft, e.utcMs)
      if (e && st) this.eventLocal.set(name, { frame: st.frame, pos: st.frame === 'moon' ? magnify(st.pos, mm) : this.mapGeo(st.pos, e.utcMs) })
    }

    // Where the Moon will be at lunar orbit insertion, as large as the Moon is drawn.
    const loi = plan.events.find((x) => x.id === 'loi')
    if (loi) {
      setV(this.ring, magnify(ep.moonPos(loi.utcMs), em))
      this.ring.scale.setScalar((2 * radiusOf(MOON_RADIUS_KM, mm) * RING_TEX_PX) / (2 * RING_TEX_RADIUS))
    }

    // Fine surface patches under the launchpad and the landing point.
    this.earthPatch = new Mesh(patchGeometry(latLonUnit(plan.pad.latDeg, plan.pad.lonDeg), EARTH_R + PATCH_LIFT_KM), this.earthMat)
    this.earthGroup.add(this.earthPatch)
    this.moonPatch = new Mesh(patchGeometry(latLonUnit(plan.target.latDeg, plan.target.lonDeg), MOON_RADIUS_KM + PATCH_LIFT_KM), this.moonMat)
    this.moonBody.add(this.moonPatch)
    this.planGeos.push(this.earthPatch.geometry, this.moonPatch.geometry)
    this.planObjects.push(this.earthPatch, this.moonPatch)

    this.setTime(plan.launchMs)
  }

  /** Moves everything to the simulated instant (clamped to the mission). No-op without a plan. */
  setTime(utcMs: number): void {
    const p = this.plan
    if (!p) return
    const ep = p.ephem
    const em = this.earthMag
    const mm = this.moonMag
    const t = Math.min(Math.max(utcMs, p.launchMs), p.endMs)

    this.earthQ = ep.earthFixedToInertial(t)
    this.moonQ = ep.moonFixedToInertial(t)
    this.earthMesh.quaternion.copy(quat(this.earthQ)).multiply(SPHERE_TO_BODY)
    this.earthPatch?.quaternion.copy(quat(this.earthQ))
    this.moonMesh.quaternion.copy(quat(this.moonQ)).multiply(SPHERE_TO_BODY)
    this.moonPatch?.quaternion.copy(quat(this.moonQ))

    const moon = magnify(ep.moonPos(t), em)
    setV(this.moonGroup, moon)
    const loi = p.events.find((x) => x.id === 'loi')
    this.ring.visible = !!loi && t < loi.utcMs && this.ring.position.distanceTo(this.moonGroup.position) > 2.5 * radiusOf(MOON_RADIUS_KM, mm)

    const sun = ep.sunDir(t)
    this.sunLight.position.set(sun[0] * 1e6, sun[1] * 1e6, sun[2] * 1e6)
    this.atmoMat.uniforms.uSun.value.set(sun[0], sun[1], sun[2])

    // Launchpad and landing point: body-fixed directions turned into J2000, at the display radius.
    const pad = this.dots.get('pad')!
    setV(pad, scale(qrot(this.earthQ, latLonUnit(p.pad.latDeg, p.pad.lonDeg)), radiusOf(EARTH_R, em)))
    pad.visible = true
    const site = this.dots.get('site')!
    setV(site, add(moon, scale(qrot(this.moonQ, latLonUnit(p.target.latDeg, p.target.lonDeg)), radiusOf(MOON_RADIUS_KM, mm))))
    site.visible = true
    for (const name of EVENT_DOTS) {
      const d = this.dots.get(name)!
      const loc = this.eventLocal.get(name)
      d.visible = !!loc
      if (loc) setV(d, loc.frame === 'moon' ? add(moon, loc.pos) : loc.pos)
    }

    // The two craft.
    const world = (st: { frame: 'earth' | 'moon'; pos: Vec3 }) => (st.frame === 'moon' ? add(moon, magnify(st.pos, mm)) : this.mapGeo(st.pos, t))
    const capsule = craftAt(p, 'capsule', t)
    const lander = craftAt(p, 'lander', t)
    this.halo.visible = this.core.visible = !!capsule
    if (capsule) {
      setV(this.halo, world(capsule))
      this.core.position.copy(this.halo.position)
    }
    const apart = !!lander && !lander.docked
    this.landerHalo.visible = this.landerCore.visible = apart
    if (lander) {
      setV(this.landerHalo, world(lander))
      this.landerCore.position.copy(this.landerHalo.position)
    }

    // Flown part of every leg; the leg a craft is on ends exactly at its marker.
    for (const f of this.flown) {
      const st = f.leg.craft === 'capsule' ? capsule : lander
      const here = st && !st.docked && st.legId === f.leg.id
      this.updateFlown(f, t, here ? (f.leg.frame === 'moon' ? magnify(st.pos, mm) : this.mapGeo(st.pos, t)) : null)
    }
  }

  /** Keeps markers at a constant size on screen. Call before each render. */
  updateSizes(cam: PerspectiveCamera, heightPx: number): void {
    if (!this.plan) return
    // World units per pixel at each object's distance (same formula as globe.ts updatePins).
    const perPx = (o: Object3D) => (2 * cam.position.distanceTo(o.position)) / (cam.projectionMatrix.elements[5] * heightPx)
    for (const d of this.dots.values()) d.scale.setScalar(DOT_PX * perPx(d))
    this.halo.scale.setScalar(HALO_PX * perPx(this.halo))
    this.core.scale.setScalar(CORE_PX * perPx(this.core))
    this.landerHalo.scale.setScalar(LANDER_HALO_PX * perPx(this.landerHalo))
    this.landerCore.scale.setScalar(LANDER_CORE_PX * perPx(this.landerCore))
  }

  /** World position of a labelled point at the current time, or null without a plan (or when it is not shown). */
  anchor(name: FlightAnchor): Vector3 | null {
    if (!this.plan) return null
    switch (name) {
      case 'earth':
        return new Vector3()
      case 'moon':
        return this.moonGroup.position.clone()
      case 'capsule':
        return this.halo.position.clone()
      case 'lander':
        return this.landerHalo.position.clone() // where the capsule is while docked
      case 'arrival':
        return this.ring.visible ? this.ring.position.clone() : null
      default: {
        const d = this.dots.get(name)
        return d && d.visible ? d.position.clone() : null
      }
    }
  }

  /** True while the lander flies or stands on its own. */
  landerApart(): boolean {
    return this.landerHalo.visible
  }

  /** Display radius (km, after magnification) of a body. */
  bodyRadius(body: 'earth' | 'moon'): number {
    return body === 'earth' ? radiusOf(EARTH_R, this.earthMag) : radiusOf(MOON_RADIUS_KM, this.moonMag)
  }

  /** The point of Earth or the Moon that a ray from `origin` along the unit vector `dir` hits first, as latitude
   *  and east longitude on that body at the current instant. */
  pick(origin: Vector3, dir: Vector3): BodyPick | null {
    const hit = (centre: Vector3, r: number): number | null => {
      const oc = origin.clone().sub(centre)
      const b = oc.dot(dir)
      const disc = b * b - (oc.lengthSq() - r * r)
      if (disc < 0) return null
      const s = -b - Math.sqrt(disc)
      return s > 0 ? s : null
    }
    const moonC = this.moonGroup.position
    const sE = hit(new Vector3(), this.bodyRadius('earth'))
    const sM = hit(moonC, this.bodyRadius('moon'))
    if (sE === null && sM === null) return null
    const earth = sM === null || (sE !== null && sE < sM)
    const p = origin.clone().addScaledVector(dir, (earth ? sE : sM)!).sub(earth ? new Vector3() : moonC)
    const fixed = unit(qrot(qconj(earth ? this.earthQ : this.moonQ), [p.x, p.y, p.z]))
    return { body: earth ? 'earth' : 'moon', latDeg: (Math.asin(fixed[2]) * 180) / Math.PI, lonDeg: (Math.atan2(fixed[1], fixed[0]) * 180) / Math.PI }
  }

  /** Geometry for the default camera: centre between Earth and the Moon at arrival, the transfer plane's normal
   *  (northern side), the unit vector Earth → Moon at arrival, and the Earth–Moon distance (km). */
  viewFrame(): { center: Vector3; normal: Vector3; toMoon: Vector3; span: number } | null {
    const p = this.plan
    if (!p) return null
    const coast = p.legs.find((l) => l.id === 'translunar')
    const loi = p.events.find((x) => x.id === 'loi')
    if (!coast || coast.track.p.length < 8 || !loi) return null
    const moonAtArrival = p.ephem.moonPos(loi.utcMs)
    // Two points of the transfer a quarter of the coast apart span its plane.
    const a = coast.track.p[0]
    const b = coast.track.p[Math.floor(coast.track.p.length / 4)]
    let n = unit(cross(a, b))
    if (n[2] < 0) n = scale(n, -1)
    return { center: v3(scale(moonAtArrival, 0.5)), normal: v3(n), toMoon: v3(unit(moonAtArrival)), span: norm(moonAtArrival) }
  }

  dispose(): void {
    this.clearPlan()
    const mats: Material[] = [
      this.earthMat, this.atmoMat, this.moonMat, this.dotMat, this.dimMat, this.flownMat, this.burnDimMat, this.burnFlownMat,
      this.orbitMat, ...this.spriteMats,
    ]
    for (const m of mats) m.dispose()
    for (const g of [this.earthMesh.geometry, this.atmo.geometry, this.moonMesh.geometry, this.dotGeo]) g.dispose()
    for (const t of this.textures) t.dispose()
    // The Earth and Moon textures belong to the caller's TextureSet and are not disposed here.
  }

  /** Display position of a point of an Earth-frame leg at instant tMs. At true scale that is the point itself.
   *  With enlarged bodies, a point close to the Moon is enlarged about where the Moon is at that instant. */
  private mapGeo(q: Vec3, tMs: number): Vec3 {
    const mm = this.moonMag
    const em = this.earthMag
    if (!mm || !this.plan || norm(q) < 250000) return magnify(q, em)
    const moon = this.plan.ephem.moonPos(tMs)
    const rel = sub(q, moon)
    return norm(rel) < mm.b ? add(magnify(moon, em), magnify(rel, mm)) : magnify(q, em)
  }

  /** Earth and Moon at the parked state; magnification follows the current mode. */
  private park() {
    this.earthGroup.scale.setScalar(this.earthMag?.k ?? 1)
    this.moonBody.scale.setScalar(this.moonMag?.k ?? 1)
    setV(this.moonGroup, PARKED_MOON)
    this.sunLight.position.set(1e6, 0, 0)
    this.atmoMat.uniforms.uSun.value.set(1, 0, 0)
    this.earthMesh.quaternion.identity()
    this.moonMesh.quaternion.identity()
  }

  private addPlanObject(o: Object3D, parent: Object3D) {
    parent.add(o)
    this.planObjects.push(o)
  }

  /** Shows a leg up to t. When the craft is on this leg, the vertex after the current segment start is set to
   *  the marker so the bright line ends exactly there. */
  private updateFlown(f: Flown, t: number, marker: Vec3 | null) {
    const attr = f.geo.getAttribute('position') as BufferAttribute
    const arr = attr.array as Float32Array
    if (f.over >= 0) {
      arr.set(f.base.subarray(3 * f.over, 3 * f.over + 3), 3 * f.over) // restore the vertex the marker covered
      f.over = -1
      attr.needsUpdate = true
    }
    const tt = f.leg.track.t
    const n = tt.length
    if (t < tt[0]) return f.geo.setDrawRange(0, 0)
    if (t >= tt[n - 1]) return f.geo.setDrawRange(0, n)
    const i = lastAtOrBefore(tt, t)
    if (marker) {
      arr.set(marker, 3 * (i + 1))
      f.over = i + 1
      attr.needsUpdate = true
      f.geo.setDrawRange(0, i + 2)
    } else f.geo.setDrawRange(0, i + 1)
  }

  private clearPlan() {
    for (const o of this.planObjects) o.removeFromParent()
    this.planObjects = []
    for (const g of this.planGeos) g.dispose()
    this.planGeos = []
    this.flown = []
    this.eventLocal.clear()
    this.earthPatch = null
    this.moonPatch = null
  }
}
