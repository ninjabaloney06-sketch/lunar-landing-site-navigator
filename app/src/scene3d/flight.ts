// Flight scene: Earth, Moon, the transfer drawn as two trajectory lines each (full path dim, flown part bright),
// a glowing rocket marker and dots for the launchpad, the landing site, TLI and LOI. A thin ring marks where the
// Moon will be when the rocket arrives: at liftoff the Moon is still about 70° back along its orbit.
//
// Frame and units: Earth-centred J2000 axes, km, the same world as plan.geo. The Moon's centre is moonPos(t);
// plan.seleno is relative to that centre with the same axes. By default everything is drawn at true scale, where
// the solver put it. The optional display magnification (EARTH_MAG, MOON_MAG) pushes the neighbourhood of each
// body outwards so the parking orbit and the low lunar orbit can be seen from afar, at the price of bending the
// path near the bodies. The body meshes are then scaled by the preset's k: a radius below a is inside the linear
// part of the map, so the surface lands exactly at k·R. The caller owns the camera and the render loop.

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
} from 'three'
import { flightStateAt, sampleTrack } from '../flight/plan'
import type { FlightPlan, Track, Vec3 } from '../flight/types'
import { add, cross, latLonUnit, norm, qrot, scale, sub, unit } from '../flight/vec'
import { EARTH_RADIUS_KM, MOON_RADIUS_KM } from '../geometry'
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

export type FlightAnchor = 'earth' | 'moon' | 'rocket' | 'pad' | 'site' | 'tli' | 'loi' | 'arrival'

const HOUR_MS = 3_600_000
const DOT_PX = 2.5 // dot radius on screen (diameter about 5 px)
const HALO_PX = 44 // halo sprite width on screen
const CORE_PX = 9 // core sprite width on screen
const PARKED_MOON: Vec3 = [384400, 0, 0] // Moon position when no plan is shown
const RING_TEX_PX = 256
const RING_TEX_RADIUS = 120 // circle radius inside the ring texture, px

/** Flown part of a trajectory: the bright line's own geometry. `over` is the vertex overwritten by the marker. */
interface Flown {
  geo: BufferGeometry
  base: Float32Array
  over: number
}

function flatten(points: Vec3[], m: Magnify | null): Float32Array {
  const out = new Float32Array(points.length * 3)
  points.forEach((p, i) => out.set(magnify(p, m), i * 3))
  return out
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

export class FlightWorld {
  readonly scene = new Scene()
  private plan: FlightPlan | null = null
  private earthMag: Magnify | null = EARTH_MAG
  private moonMag: Magnify | null = MOON_MAG

  private readonly earthMat: MeshStandardMaterial
  private readonly earthGroup = new Group()
  private readonly earthMesh: Mesh
  private readonly atmoMat: ShaderMaterial
  private readonly atmo: Mesh

  private readonly moonMat: MeshPhysicalMaterial
  private readonly moonGroup = new Group()
  private readonly moonMesh: Mesh

  private readonly sunLight = new DirectionalLight(0xfff4e6, 3 * Math.PI)
  private readonly ambient = new AmbientLight(0xffffff, 0.04)

  private readonly dotGeo = new SphereGeometry(1, 12, 8)
  private readonly dotMat = new MeshBasicMaterial({ color: 0xf2efe8, toneMapped: false })
  private readonly padDot: Mesh
  private readonly siteDot: Mesh
  private readonly tliDot: Mesh
  private readonly loiDot: Mesh
  private loiLocal: Vec3 | null = null // LOI point relative to the Moon's centre, magnified

  private readonly dimMat = new LineBasicMaterial({
    color: 0xd9d6cf,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    toneMapped: false,
  })
  private readonly flownMat = new LineBasicMaterial({
    color: 0xf2efe8,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    toneMapped: false,
  })
  private readonly orbitMat = new LineBasicMaterial({
    color: 0xd9d6cf,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    toneMapped: false,
  })
  private planObjects: Object3D[] = []
  private planGeos: BufferGeometry[] = []
  private geoFlown: Flown | null = null
  private moonFlown: Flown | null = null

  private readonly haloTex: CanvasTexture
  private readonly coreTex: CanvasTexture
  private readonly haloMat: SpriteMaterial
  private readonly coreMat: SpriteMaterial
  private readonly halo: Sprite
  private readonly core: Sprite
  private readonly ringTex: CanvasTexture
  private readonly ringMat: SpriteMaterial
  private readonly ring: Sprite // the Moon's place at lunar orbit insertion

  constructor(tex: TextureSet) {
    this.earthMat = new MeshStandardMaterial({
      map: tex.earth ?? null,
      color: tex.earth ? 0xffffff : 0x4d6d93,
      roughness: 0.9,
      metalness: 0,
    })
    this.earthMesh = new Mesh(new SphereGeometry(EARTH_RADIUS_KM, 96, 48), this.earthMat)
    this.atmoMat = new ShaderMaterial({
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      uniforms: { uSun: { value: new Vector3(1, 0, 0) } },
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: FrontSide,
    })
    this.atmo = new Mesh(new SphereGeometry(EARTH_RADIUS_KM * 1.035, 64, 32), this.atmoMat)
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
    this.moonMesh = new Mesh(new SphereGeometry(MOON_RADIUS_KM, 128, 64), this.moonMat)
    this.moonGroup.add(this.moonMesh)

    const dot = () => {
      const m = new Mesh(this.dotGeo, this.dotMat)
      m.visible = false
      this.scene.add(m)
      return m
    }
    this.padDot = dot()
    this.siteDot = dot()
    this.tliDot = dot()
    this.loiDot = dot()

    this.haloTex = radialTexture([
      [0, 'rgba(255,255,255,1)'],
      [0.1, 'rgba(255,240,225,0.95)'],
      [0.25, 'rgba(255,150,100,0.6)'],
      [0.5, 'rgba(255,120,70,0.18)'],
      [1, 'rgba(255,120,70,0)'],
    ])
    this.coreTex = radialTexture([
      [0, 'rgba(255,255,255,1)'],
      [0.5, 'rgba(255,250,242,0.9)'],
      [1, 'rgba(255,250,242,0)'],
    ])
    this.haloMat = new SpriteMaterial({
      map: this.haloTex,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      transparent: true,
      toneMapped: false,
    })
    this.coreMat = new SpriteMaterial({
      map: this.coreTex,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      transparent: true,
      toneMapped: false,
    })
    this.halo = new Sprite(this.haloMat)
    this.core = new Sprite(this.coreMat)
    this.halo.renderOrder = 3
    this.core.renderOrder = 4
    this.halo.visible = false
    this.core.visible = false
    this.ringTex = ringTexture()
    this.ringMat = new SpriteMaterial({ map: this.ringTex, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false })
    this.ring = new Sprite(this.ringMat)
    this.ring.visible = false

    this.sunLight.target.position.set(0, 0, 0)
    this.scene.add(
      this.earthGroup,
      this.moonGroup,
      this.sunLight,
      this.sunLight.target,
      this.ambient,
      this.halo,
      this.core,
      this.ring,
    )
    this.park()
  }

  /** Builds lines and markers for a plan (null clears). trueScale = no magnification. */
  setPlan(plan: FlightPlan | null, trueScale: boolean): void {
    this.clearPlan()
    this.earthMag = trueScale ? null : EARTH_MAG
    this.moonMag = trueScale ? null : MOON_MAG
    this.plan = plan
    this.park()
    const on = plan !== null
    this.padDot.visible = on
    this.siteDot.visible = on
    this.tliDot.visible = false
    this.loiDot.visible = false
    this.halo.visible = on
    this.core.visible = on
    this.ring.visible = false
    if (!plan) return

    const ep = plan.ephem
    const em = this.earthMag
    const mm = this.moonMag

    // The Moon's orbit, sampled hourly over the flight (+/- 12 h), clamped to the ephemeris span.
    const lo = Math.max(ep.startMs, plan.launchMs - 12 * HOUR_MS)
    const hi = Math.min(ep.endMs, plan.landingMs + 12 * HOUR_MS)
    const orbit: Vec3[] = []
    for (let t = lo; t < hi; t += HOUR_MS) orbit.push(ep.moonPos(t))
    orbit.push(ep.moonPos(hi))
    const orbitGeo = new BufferGeometry().setAttribute('position', new BufferAttribute(flatten(orbit, em), 3))
    this.planGeos.push(orbitGeo)
    this.addPlanObject(new Line(orbitGeo, this.orbitMat), this.scene)

    // The Earth-centred path runs up to the Moon (an integrated flight ends at its lunar orbit insertion), so
    // each point goes through mapGeo, which also enlarges the stretch close to the Moon when bodies are enlarged.
    const geoBase = new Float32Array(plan.geo.p.length * 3)
    plan.geo.p.forEach((q, i) => geoBase.set(this.mapGeo(q, plan.geo.t[i]), i * 3))
    this.geoFlown = this.addTrack(geoBase, this.scene)
    this.moonFlown = this.addTrack(flatten(plan.seleno.p, mm), this.moonGroup)

    // Where the Moon will be at lunar orbit insertion, as large as the Moon is drawn.
    setV(this.ring, magnify(ep.moonPos(plan.loiMs), em))
    this.ring.scale.setScalar((2 * radiusOf(MOON_RADIUS_KM, mm) * RING_TEX_PX) / (2 * RING_TEX_RADIUS))

    const tli = sampleTrack(plan.geo, plan.tliMs)
    if (tli) {
      setV(this.tliDot, magnify(tli, em))
      this.tliDot.visible = true
    }
    const loi = sampleTrack(plan.seleno, plan.loiMs)
    if (loi) {
      this.loiLocal = magnify(loi, mm)
      this.loiDot.visible = true
    }
    this.setTime(plan.launchMs)
  }

  /** Moves everything to the simulated instant (clamped to the plan's span). No-op without a plan. */
  setTime(utcMs: number): void {
    const p = this.plan
    if (!p) return
    const ep = p.ephem
    const em = this.earthMag
    const mm = this.moonMag
    const t = Math.min(Math.max(utcMs, p.launchMs), p.landingMs)

    const eq = ep.earthFixedToInertial(t)
    this.earthMesh.quaternion.copy(quat(eq)).multiply(SPHERE_TO_BODY)
    const mq = ep.moonFixedToInertial(t)
    this.moonMesh.quaternion.copy(quat(mq)).multiply(SPHERE_TO_BODY)

    const moon = magnify(ep.moonPos(t), em)
    setV(this.moonGroup, moon)
    // The ring is the target until the Moon has reached it.
    this.ring.visible = t < p.loiMs && this.ring.position.distanceTo(this.moonGroup.position) > 2.5 * radiusOf(MOON_RADIUS_KM, mm)

    const sun = ep.sunDir(t)
    this.sunLight.position.set(sun[0] * 1e6, sun[1] * 1e6, sun[2] * 1e6)
    this.atmoMat.uniforms.uSun.value.set(sun[0], sun[1], sun[2])

    // Launchpad: Earth-fixed unit vector rotated into J2000, at the display radius.
    setV(this.padDot, scale(qrot(eq, latLonUnit(p.pad.latDeg, p.pad.lonDeg)), radiusOf(EARTH_RADIUS_KM, em)))
    // Landing site: relative to the Moon's centre, then moved with the Moon (not parented to the mesh).
    const siteOff = scale(qrot(mq, latLonUnit(p.target.latDeg, p.target.lonDeg)), radiusOf(MOON_RADIUS_KM, mm))
    setV(this.siteDot, add(moon, siteOff))
    if (this.loiLocal) setV(this.loiDot, add(moon, this.loiLocal))

    // Rocket: frame 'earth' is Earth-centred, 'moon' is relative to the Moon's centre.
    const st = flightStateAt(p, t)
    const onMoon = st.frame === 'moon'
    const local = magnify(st.pos, mm) // used on the Moon-centred track only
    const world = onMoon ? add(moon, local) : this.mapGeo(st.pos, t)
    setV(this.halo, world)
    this.core.position.copy(this.halo.position)

    if (this.geoFlown) this.updateFlown(this.geoFlown, p.geo, t, onMoon ? null : world)
    if (this.moonFlown) this.updateFlown(this.moonFlown, p.seleno, t, onMoon ? local : null)
  }

  /** Keeps markers at a constant size on screen. Call before each render. */
  updateSizes(cam: PerspectiveCamera, heightPx: number): void {
    if (!this.plan) return
    // World units per pixel at each object's distance (same formula as globe.ts updatePins).
    const perPx = (o: Object3D) => (2 * cam.position.distanceTo(o.position)) / (cam.projectionMatrix.elements[5] * heightPx)
    for (const d of [this.padDot, this.siteDot, this.tliDot, this.loiDot]) d.scale.setScalar(DOT_PX * perPx(d))
    const pp = perPx(this.halo)
    this.halo.scale.setScalar(HALO_PX * pp)
    this.core.scale.setScalar(CORE_PX * pp)
  }

  /** World position of a labelled point at the current time, or null without a plan. */
  anchor(name: FlightAnchor): Vector3 | null {
    if (!this.plan) return null
    const dot = (o: Object3D) => (o.visible ? o.position.clone() : null)
    switch (name) {
      case 'earth':
        return new Vector3()
      case 'moon':
        return this.moonGroup.position.clone()
      case 'rocket':
        return this.halo.position.clone()
      case 'pad':
        return dot(this.padDot)
      case 'site':
        return dot(this.siteDot)
      case 'tli':
        return dot(this.tliDot)
      case 'loi':
        return dot(this.loiDot)
      case 'arrival':
        return dot(this.ring)
    }
  }

  /** Display radius (km, after magnification) of a body, for occlusion tests of labels. */
  bodyRadius(body: 'earth' | 'moon'): number {
    return body === 'earth' ? radiusOf(EARTH_RADIUS_KM, this.earthMag) : radiusOf(MOON_RADIUS_KM, this.moonMag)
  }

  /** Default camera geometry: centre between Earth and the Moon at arrival, transfer-plane normal (north side),
   *  unit vector Earth → Moon at arrival, Earth–Moon distance (km). */
  viewFrame(): { center: Vector3; normal: Vector3; toMoon: Vector3; span: number } | null {
    const p = this.plan
    if (!p) return null
    const moonAtArrival = p.ephem.moonPos(p.loiMs)
    // Two points of the transfer ellipse a quarter of the coast apart span its plane. (The TLI point and the Moon
    // at arrival do not: on a tangent transfer they are almost opposite each other.)
    const a = sampleTrack(p.geo, p.tliMs)
    const b = sampleTrack(p.geo, p.tliMs + 0.25 * (p.soiMs - p.tliMs))
    if (!a || !b) return null
    let n = unit(cross(a, b))
    if (n[2] < 0) n = scale(n, -1)
    return {
      center: v3(scale(moonAtArrival, 0.5)),
      normal: v3(n),
      toMoon: v3(unit(moonAtArrival)),
      span: norm(moonAtArrival),
    }
  }

  dispose(): void {
    this.clearPlan()
    this.earthMesh.geometry.dispose()
    this.atmo.geometry.dispose()
    this.moonMesh.geometry.dispose()
    this.dotGeo.dispose()
    this.earthMat.dispose()
    this.atmoMat.dispose()
    this.moonMat.dispose()
    this.dotMat.dispose()
    this.dimMat.dispose()
    this.flownMat.dispose()
    this.orbitMat.dispose()
    this.haloMat.dispose()
    this.coreMat.dispose()
    this.haloTex.dispose()
    this.coreTex.dispose()
    this.ringMat.dispose()
    this.ringTex.dispose()
    // The Earth and Moon textures belong to the caller's TextureSet and are not disposed here.
  }

  /** Display position of a point of the Earth-centred path at instant tMs. At true scale that is the point
   *  itself. With enlarged bodies, a point close to the Moon is enlarged about where the Moon is at that instant. */
  private mapGeo(q: Vec3, tMs: number): Vec3 {
    const mm = this.moonMag
    const em = this.earthMag
    if (!mm || !this.plan || norm(q) < 250000) return magnify(q, em)
    const moon = this.plan.ephem.moonPos(tMs)
    const rel = sub(q, moon)
    return norm(rel) < mm.b ? add(magnify(moon, em), magnify(rel, mm)) : magnify(q, em)
  }

  /** Earth and Moon at the parked or current state; magnification follows the current mode. */
  private park() {
    this.earthGroup.scale.setScalar(this.earthMag?.k ?? 1)
    this.moonMesh.scale.setScalar(this.moonMag?.k ?? 1)
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

  /** Dim full line and bright flown line for one track, both drawn from the same magnified positions. */
  private addTrack(base: Float32Array, parent: Object3D): Flown {
    const dimGeo = new BufferGeometry().setAttribute('position', new BufferAttribute(base, 3))
    const flownArr = new Float32Array(base)
    const attr = new BufferAttribute(flownArr, 3)
    attr.setUsage(DynamicDrawUsage)
    const flownGeo = new BufferGeometry().setAttribute('position', attr)
    flownGeo.setDrawRange(0, 0)
    this.planGeos.push(dimGeo, flownGeo)
    this.addPlanObject(new Line(dimGeo, this.dimMat), parent)
    this.addPlanObject(new Line(flownGeo, this.flownMat), parent)
    return { geo: flownGeo, base, over: -1 }
  }

  /** Shows the track up to t. The vertex after the current segment start is set to the marker so the bright line
   *  ends exactly at the rocket. */
  private updateFlown(f: Flown, track: Track, t: number, marker: Vec3 | null) {
    const attr = f.geo.getAttribute('position') as BufferAttribute
    const arr = attr.array as Float32Array
    if (f.over >= 0) {
      arr.set(f.base.subarray(3 * f.over, 3 * f.over + 3), 3 * f.over) // restore the vertex the marker covered
      f.over = -1
      attr.needsUpdate = true
    }
    const n = track.t.length
    if (n === 0 || t < track.t[0]) return f.geo.setDrawRange(0, 0)
    if (t >= track.t[n - 1]) return f.geo.setDrawRange(0, n)
    const i = lastAtOrBefore(track.t, t)
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
    this.geoFlown = null
    this.moonFlown = null
    this.loiLocal = null
  }
}
