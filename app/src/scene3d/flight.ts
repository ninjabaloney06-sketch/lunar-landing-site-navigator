// Flight scene: Earth, Moon and a whole mission. Every phase is one thin line (dim ahead of the craft, bright
// behind it). An engine burn is drawn three times over, so that it is seen at every zoom level: a wide warm line
// along the powered stretch, a ring marker of constant size on screen where the burn starts (most burns last
// seconds and would be shorter than a pixel), and a warm flare around the craft while its engine fires.
// The capsule is a glowing point; the lander is a diamond outline in its own colour, drawn around the capsule's
// point while the two are docked and beside it, with its own core, while it flies or stands on its own.
// Dots mark the launchpad and the landing point, a thin ring where the Moon will be when the capsule arrives: at
// liftoff the Moon is still about 70° back along its orbit.
//
// What is drawn is chosen by FlightLayers. In trail mode nothing is drawn ahead of a craft and the path behind it
// fades out over a chosen flight time. Dim, bright and faded are decided in the line shaders from each vertex's
// time and the simulated instant, so playing, scrubbing backwards and changing the trail length only change
// uniforms: no geometry is rebuilt or re-uploaded per frame.
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
  Color,
  DirectionalLight,
  FrontSide,
  Group,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NormalBlending,
  Object3D,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type Blending,
  type Material,
} from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { R_EARTH_EQ } from '../flight/astro'
import { craftAt } from '../flight/craft'
import type { TubePoint } from '../flight/dispersion'
import { getFlightAnalysis, subscribeFlightAnalysis } from '../views/flightAnalysis'
import type { MissionEvent, MissionPlan, Quat, Vec3 } from '../flight/types'
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

export type FlightAnchor = 'earth' | 'moon' | 'capsule' | 'lander' | 'pad' | 'site' | 'arrival'

/** What the flight scene draws. The two name layers are labels, placed by the view over the scene. */
export interface FlightLayers {
  paths: boolean // the flight path lines
  burns: boolean // wide burn stretches, a marker at each burn, the flare of a firing craft
  burnNames: boolean // a label at each burn: its name
  stageNames: boolean // a label at each burn: the stage or engine that fires
  trail: boolean // draw the path only behind each craft, fading out
  trailHours: number | null // flight time over which the trail fades; null = everything flown stays
  tube: boolean // the 1σ / 3σ landing-dispersion tube around the descent, once one has been computed
}

export const DEFAULT_LAYERS: FlightLayers = { paths: true, burns: true, burnNames: true, stageNames: false, trail: false, trailHours: 24, tube: true }

/** The events that get a burn marker and a burn label, in the plan's (time) order. */
export function flightBurns(plan: MissionPlan): MissionEvent[] {
  return plan.events.filter((e) => e.kind === 'burn')
}

/** Is the lander with the capsule, on its own, or not in the picture?
 *  The plan follows the lander from undocking to docking only. Before that it rides with the capsule, except in
 *  a design where it waits at the Moon: there it is not on the launch, and it joins at the first docking. After
 *  the last docking it stays with the capsule until the capsule's burn for home, which it does not fly: the
 *  Apollo ascent stage was cast off in lunar orbit, an Artemis lander stays in its orbit at the Moon. */
export type LanderPresence = 'absent' | 'docked' | 'apart'

export function landerPresence(plan: MissionPlan, utcMs: number): LanderPresence {
  const lander = craftAt(plan, 'lander', utcMs)
  if (lander && !lander.docked) return 'apart'
  const firstDocking = plan.events.find((e) => e.id === 'nrho-docking')
  if (firstDocking && utcMs < firstDocking.utcMs) return 'absent'
  const departure = plan.events.find((e) => e.id === 'tei')
  if (departure && utcMs >= departure.utcMs && utcMs >= plan.dockingMs) return 'absent'
  return 'docked'
}

/** How strongly something that happened ageS seconds ago is drawn in trail mode: 1 at the craft, falling smoothly
 *  to 0 at trailS behind it; 0 for anything still ahead. trailS null = everything flown stays at 1.
 *  The line shaders compute the same curve per pixel (TRAIL_GLSL). */
export function trailFade(ageS: number, trailS: number | null): number {
  if (ageS < 0) return 0
  if (trailS === null) return 1
  const f = Math.min(1, Math.max(0, 1 - ageS / trailS))
  return f * f * (3 - 2 * f)
}

/** A click on a body: which one and where, in its own latitude and east longitude. */
export interface BodyPick {
  body: 'earth' | 'moon'
  latDeg: number
  lonDeg: number
}

const HOUR_MS = 3_600_000
const EARTH_R = R_EARTH_EQ // the radius the flight's altitudes refer to
const DOT_PX = 2.5 // dot radius on screen (diameter about 5 px)
// Sizes on screen, px. The lander's diamond is larger while docked, so that the capsule's point sits inside it.
const HALO_PX = 40
const CORE_PX = 9
const FLARE_PX = 92 // around a craft whose engine fires
const LANDER_DOCKED_PX = 30
const LANDER_APART_PX = 22
const LANDER_CORE_PX = 5
const BURN_MARK_PX = 18
const BURN_LINE_PX = 5
const PARKED_MOON: Vec3 = [384400, 0, 0] // Moon position when no plan is shown
const RING_TEX_PX = 256
const RING_TEX_RADIUS = 120 // circle radius inside the ring texture, px
const PATCH_DEG = 5 // angular radius of the fine surface patches
const PATCH_LIFT_KM = 0.003 // keeps a patch clear of the globe's vertices, which lie on the same sphere
// Markers are drawn over everything and hidden by hand when a body is in the way: a camera-facing sprite on the
// surface would otherwise be cut in half by the ground. The blocking sphere is slightly smaller than the body, so
// a marker standing on the surface is not hidden by the ground it stands on.
const BLOCK_RADIUS = 0.995
const COLORS = {
  path: 0xd9d6cf, // ahead of the craft
  flown: 0xf2efe8,
  burn: 0xff9a5c, // engine burn: the warm orange of the HTML token --burn
  burnAhead: 0xd97a45, // a burn stretch not yet flown: darker, not more transparent (see the burn material)
  burnFlown: 0xffb98c,
  lander: 0x7fe0b8, // the HTML token --lander
  backdrop: 'rgba(11,13,17,0.85)', // dark edge under a marker, so it reads against the sunlit Moon
}

// ---- the landing-dispersion tube (dispersion.ts; NOT YET VALIDATED BY THE SCIENCE LEAD)

const TUBE_SEGMENTS = 32 // straight pieces per ring
const TUBE_RIBS = 4 // lines along the tube, at 0°, 90°, 180°, 270°

/** The kσ tube of a dispersion analysis as line-segment pairs, Moon-centred km (the frame of the plan's Moon-frame
 *  legs): a ring  center + mean + k (sigmaMajorKm cos θ · axisMajor + sigmaMinorKm sin θ · axisMinor)  at every
 *  tube instant, and TUBE_RIBS lines along the tube joining the rings. */
export function tubeSegments(tube: TubePoint[], k: number, map: (p: Vec3) => Vec3 = (p) => p): Float32Array {
  const ringAt = (t: TubePoint, theta: number): Vec3 => {
    const c = Math.cos(theta) * k * t.sigmaMajorKm
    const s = Math.sin(theta) * k * t.sigmaMinorKm
    return map([
      t.center[0] + t.mean[0] + c * t.axisMajor[0] + s * t.axisMinor[0],
      t.center[1] + t.mean[1] + c * t.axisMajor[1] + s * t.axisMinor[1],
      t.center[2] + t.mean[2] + c * t.axisMajor[2] + s * t.axisMinor[2],
    ])
  }
  const out: number[] = []
  for (const t of tube) {
    for (let j = 0; j < TUBE_SEGMENTS; j++) {
      out.push(...ringAt(t, (2 * Math.PI * j) / TUBE_SEGMENTS), ...ringAt(t, (2 * Math.PI * (j + 1)) / TUBE_SEGMENTS))
    }
  }
  for (let r = 0; r < TUBE_RIBS; r++) {
    const theta = (2 * Math.PI * r) / TUBE_RIBS
    for (let i = 0; i + 1 < tube.length; i++) out.push(...ringAt(tube[i], theta), ...ringAt(tube[i + 1], theta))
  }
  return new Float32Array(out)
}

// Times go to the shaders as two floats, whole multiples of TIME_HI seconds and the rest: a 32-bit float alone
// resolves a quarter of a second a month into a mission, which is hundreds of metres of path at orbital speed and
// would let the bright line end visibly beside the craft when the camera is close.
const TIME_HI = 4096
function splitTime(s: number): [number, number] {
  const hi = Math.floor(s / TIME_HI) * TIME_HI
  return [hi, s - hi]
}

// Shared by the thin path lines and the wide burn lines. age = seconds since the craft passed this point.
const TRAIL_GLSL = /* glsl */ `
  uniform float uTrailOn;
  uniform float uTrail; // s; 0 = everything flown stays
  varying float vAge;
  float trailFade() {
    if ( uTrailOn < 0.5 ) return 1.0;
    if ( vAge < 0.0 ) return 0.0;
    if ( uTrail <= 0.0 ) return 1.0;
    float f = clamp( 1.0 - vAge / uTrail, 0.0, 1.0 );
    return f * f * ( 3.0 - 2.0 * f );
  }
`

const PATH_VERT = /* glsl */ `
  attribute vec2 aTime;
  uniform vec2 uNow;
  varying float vAge;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vAge = ( uNow.x - aTime.x ) + ( uNow.y - aTime.y );
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    #include <logdepthbuf_vertex>
  }
`

const PATH_FRAG = /* glsl */ `
  uniform vec3 uAhead;
  uniform vec3 uFlown;
  uniform float uAheadAlpha;
  uniform float uFlownAlpha;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  ${TRAIL_GLSL}
  void main() {
    #include <logdepthbuf_fragment>
    float fade = trailFade();
    if ( fade <= 0.0 ) discard;
    bool flown = vAge >= 0.0;
    gl_FragColor = vec4( flown ? uFlown : uAhead, ( flown ? uFlownAlpha : uAheadAlpha ) * fade );
    #include <colorspace_fragment>
  }
`

/** Replaces `find` in a three.js shader, and fails loudly if a three.js update has changed the shader text. */
function patchShader(src: string, find: string, replacement: string): string {
  if (!src.includes(find)) throw new Error(`flight scene: the line shader has changed (missing "${find}")`)
  return src.replace(find, replacement)
}

const radiusOf = (r: number, m: Magnify | null) => (m ? magnifyRadius(r, m) : r)

function setV(o: Object3D, v: Vec3) {
  o.position.set(v[0], v[1], v[2])
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return [c, c.getContext('2d')!]
}

function textureOf(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

function radialTexture(stops: [number, string][]): CanvasTexture {
  const s = 256
  const [c, g] = canvas(s)
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  for (const [o, col] of stops) grad.addColorStop(o, col)
  g.fillStyle = grad
  g.fillRect(0, 0, s, s)
  return textureOf(c)
}

/** A thin circle outline, drawn as a camera-facing sprite. */
function ringTexture(): CanvasTexture {
  const [c, g] = canvas(RING_TEX_PX)
  g.strokeStyle = 'rgba(217,214,207,1)'
  g.lineWidth = 2.5
  g.setLineDash([10, 9])
  g.beginPath()
  g.arc(RING_TEX_PX / 2, RING_TEX_PX / 2, RING_TEX_RADIUS, 0, 2 * Math.PI)
  g.stroke()
  return textureOf(c)
}

const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`

/** The lander: a diamond outline with a dark edge. */
function diamondTexture(): CanvasTexture {
  const s = 128
  const [c, g] = canvas(s)
  const r = 50
  const path = () => {
    g.beginPath()
    g.moveTo(s / 2, s / 2 - r)
    g.lineTo(s / 2 + r, s / 2)
    g.lineTo(s / 2, s / 2 + r)
    g.lineTo(s / 2 - r, s / 2)
    g.closePath()
  }
  g.lineJoin = 'miter'
  path()
  g.strokeStyle = COLORS.backdrop
  g.lineWidth = 20
  g.stroke()
  path()
  g.strokeStyle = css(COLORS.lander)
  g.lineWidth = 10
  g.stroke()
  return textureOf(c)
}

/** A filled disc with a dark edge: the lander's own core while it is apart from the capsule. */
function discTexture(color: number): CanvasTexture {
  const s = 64
  const [c, g] = canvas(s)
  g.beginPath()
  g.arc(s / 2, s / 2, 24, 0, 2 * Math.PI)
  g.fillStyle = css(color)
  g.fill()
  g.strokeStyle = COLORS.backdrop
  g.lineWidth = 8
  g.stroke()
  return textureOf(c)
}

/** An engine burn: a ring with a dot in the middle. */
function burnTexture(): CanvasTexture {
  const s = 128
  const [c, g] = canvas(s)
  const ring = (width: number, color: string) => {
    g.beginPath()
    g.arc(s / 2, s / 2, 44, 0, 2 * Math.PI)
    g.strokeStyle = color
    g.lineWidth = width
    g.stroke()
  }
  ring(22, COLORS.backdrop)
  ring(11, css(COLORS.burn))
  g.beginPath()
  g.arc(s / 2, s / 2, 17, 0, 2 * Math.PI)
  g.fillStyle = css(COLORS.burn)
  g.fill()
  return textureOf(c)
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

/** A burn's marker: where the burn starts, in its leg's frame (display coordinates), and when. */
interface BurnMark {
  sprite: Sprite
  mat: SpriteMaterial
  frame: 'earth' | 'moon'
  local: Vec3
  utcMs: number
  shown: boolean // false in trail mode while the burn is still ahead or has faded out
}

export class FlightWorld {
  readonly scene = new Scene()
  private plan: MissionPlan | null = null
  private layers: FlightLayers = DEFAULT_LAYERS
  private timeMs = 0
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
  private readonly dots = new Map<'pad' | 'site', Mesh>()

  // One clock and one trail setting for every line: the uniform objects are shared by the two materials.
  private readonly uNow = { value: new Vector2() }
  private readonly uTrailOn = { value: 0 }
  private readonly uTrail = { value: 0 }
  private readonly pathMat: ShaderMaterial
  private readonly burnMat: LineMaterial
  private readonly orbitMat = new LineBasicMaterial({ color: COLORS.path, transparent: true, opacity: 0.14, depthWrite: false, toneMapped: false })
  // The dispersion tube: 1σ brighter than 3σ, in the lander's colour; travels with the Moon like the descent leg.
  private readonly tubeMats = [
    new LineBasicMaterial({ color: COLORS.lander, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }),
    new LineBasicMaterial({ color: COLORS.lander, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false }),
  ]
  private tubeLines: LineSegments[] = []
  private tubeOf: TubePoint[] | null = null
  private readonly offAnalysis: () => void
  private planObjects: Object3D[] = []
  private planGeos: BufferGeometry[] = []
  private pathLines: Object3D[] = []
  private burnLines: Object3D[] = []
  private burnMarks: BurnMark[] = []

  private readonly textures: CanvasTexture[] = []
  private readonly spriteMats: SpriteMaterial[] = []
  private readonly burnTex: CanvasTexture
  private readonly halo: Sprite
  private readonly core: Sprite
  private readonly flare: Sprite // around the capsule (and the docked pair) while an engine fires
  private readonly landerFlare: Sprite
  private readonly landerMark: Sprite
  private readonly landerCore: Sprite
  private readonly ring: Sprite // the Moon's place at lunar orbit insertion
  private lander: LanderPresence = 'absent'
  private capsuleOn = false
  private capsuleFiring = false
  private landerFiring = false

  constructor(tex: TextureSet) {
    // The tube follows the analysis store (views/flightAnalysis.ts), which the Flight panel's action fills.
    this.offAnalysis = subscribeFlightAnalysis(() => this.syncTube())
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

    this.pathMat = new ShaderMaterial({
      vertexShader: PATH_VERT,
      fragmentShader: PATH_FRAG,
      uniforms: {
        uNow: this.uNow,
        uTrailOn: this.uTrailOn,
        uTrail: this.uTrail,
        uAhead: { value: new Color(COLORS.path) },
        uFlown: { value: new Color(COLORS.flown) },
        uAheadAlpha: { value: 0.3 },
        uFlownAlpha: { value: 0.95 },
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })

    // The wide line of three.js, taught the same clock: each segment carries the times of its two ends, the part
    // still ahead of the craft is darker, and in trail mode it fades like the thin lines do. Outside trail mode
    // the line is opaque: its segments overlap at every joint, and a see-through line would show a bead there.
    this.burnMat = new LineMaterial({ color: COLORS.burnFlown, linewidth: BURN_LINE_PX, transparent: true, depthWrite: false, toneMapped: false })
    this.burnMat.uniforms.uNow = this.uNow
    this.burnMat.uniforms.uTrailOn = this.uTrailOn
    this.burnMat.uniforms.uTrail = this.uTrail
    this.burnMat.uniforms.uAhead = { value: new Color(COLORS.burnAhead) }
    this.burnMat.vertexShader = patchShader(
      patchShader(
        this.burnMat.vertexShader,
        'attribute vec3 instanceEnd;',
        'attribute vec3 instanceEnd;\nattribute vec2 instanceT0;\nattribute vec2 instanceT1;\nuniform vec2 uNow;\nvarying float vAge;',
      ),
      'float aspect = resolution.x / resolution.y;',
      'vec2 segT = ( position.y < 0.5 ) ? instanceT0 : instanceT1;\nvAge = ( uNow.x - segT.x ) + ( uNow.y - segT.y );\nfloat aspect = resolution.x / resolution.y;',
    )
    this.burnMat.fragmentShader = patchShader(
      patchShader(this.burnMat.fragmentShader, '#include <common>', `#include <common>\nuniform vec3 uAhead;\n${TRAIL_GLSL}`),
      'gl_FragColor = vec4( diffuseColor.rgb, alpha );',
      'float fade = trailFade();\nif ( fade <= 0.0 ) discard;\ngl_FragColor = vAge >= 0.0 ? vec4( diffuseColor.rgb, alpha * fade ) : vec4( uAhead, alpha );',
    )

    for (const name of ['pad', 'site'] as const) {
      const m = new Mesh(this.dotGeo, this.dotMat)
      m.visible = false
      this.scene.add(m)
      this.dots.set(name, m)
    }

    // Craft markers ignore the depth buffer (see BLOCK_RADIUS) and are drawn after the lines, in this order.
    const sprite = (t: CanvasTexture, order: number, blending: Blending) => {
      const m = new SpriteMaterial({ map: t, blending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false })
      this.textures.push(t)
      this.spriteMats.push(m)
      const s = new Sprite(m)
      s.renderOrder = order
      s.visible = false
      return s
    }
    const hot: [number, string][] = [
      [0, 'rgba(255,236,214,1)'],
      [0.12, 'rgba(255,186,130,0.9)'],
      [0.3, 'rgba(255,140,80,0.5)'],
      [0.6, 'rgba(255,120,60,0.14)'],
      [1, 'rgba(255,120,60,0)'],
    ]
    const glow: [number, string][] = [
      [0, 'rgba(255,255,255,1)'],
      [0.12, 'rgba(250,246,238,0.9)'],
      [0.3, 'rgba(242,239,232,0.4)'],
      [0.55, 'rgba(242,239,232,0.1)'],
      [1, 'rgba(242,239,232,0)'],
    ]
    const white: [number, string][] = [
      [0, 'rgba(255,255,255,1)'],
      [0.5, 'rgba(255,250,242,0.9)'],
      [1, 'rgba(255,250,242,0)'],
    ]
    const hotTex = radialTexture(hot)
    this.flare = sprite(hotTex, 5, AdditiveBlending)
    this.landerFlare = sprite(hotTex, 5, AdditiveBlending)
    this.halo = sprite(radialTexture(glow), 6, AdditiveBlending)
    this.core = sprite(radialTexture(white), 7, AdditiveBlending)
    this.landerMark = sprite(diamondTexture(), 8, NormalBlending)
    this.landerCore = sprite(discTexture(COLORS.lander), 9, NormalBlending)
    this.burnTex = burnTexture()
    this.textures.push(this.burnTex)

    const ringTex = ringTexture()
    const ringMat = new SpriteMaterial({ map: ringTex, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false })
    this.textures.push(ringTex)
    this.spriteMats.push(ringMat)
    this.ring = new Sprite(ringMat)
    this.ring.visible = false

    this.sunLight.target.position.set(0, 0, 0)
    this.scene.add(
      this.earthGroup, this.moonGroup, this.sunLight, this.sunLight.target, this.ambient,
      this.flare, this.landerFlare, this.halo, this.core, this.landerMark, this.landerCore, this.ring,
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
    for (const s of this.craftSprites()) s.visible = false
    this.ring.visible = false
    this.capsuleOn = false
    this.lander = 'absent'
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

    // One thin line per leg; a powered leg also gets the wide burn line over it. Each vertex carries its time.
    for (const leg of plan.legs) {
      const n = leg.track.p.length
      if (n < 2) continue
      const base = new Float32Array(n * 3)
      const times = new Float32Array(n * 2)
      leg.track.p.forEach((q, i) => {
        base.set(leg.frame === 'moon' ? magnify(q, mm) : this.mapGeo(q, leg.track.t[i]), i * 3)
        times.set(splitTime((leg.track.t[i] - plan.launchMs) / 1000), i * 2)
      })
      const parent = leg.frame === 'moon' ? this.moonGroup : this.scene
      const geo = new BufferGeometry()
      geo.setAttribute('position', new BufferAttribute(base, 3))
      geo.setAttribute('aTime', new BufferAttribute(times, 2))
      const thin = new Line(geo, this.pathMat)
      this.planGeos.push(geo)
      this.pathLines.push(thin)
      this.addPlanObject(thin, parent)
      if (!leg.powered) continue

      const wideGeo = new LineGeometry()
      wideGeo.setPositions(base)
      const ends = new Float32Array((n - 1) * 4) // per segment: the time of its start and of its end
      for (let i = 0; i < n - 1; i++) ends.set(times.subarray(2 * i, 2 * i + 4), 4 * i)
      const endBuf = new InstancedInterleavedBuffer(ends, 4, 1)
      wideGeo.setAttribute('instanceT0', new InterleavedBufferAttribute(endBuf, 2, 0))
      wideGeo.setAttribute('instanceT1', new InterleavedBufferAttribute(endBuf, 2, 2))
      const wide = new Line2(wideGeo, this.burnMat)
      wide.renderOrder = 2
      this.planGeos.push(wideGeo)
      this.burnLines.push(wide)
      this.addPlanObject(wide, parent)
    }

    // A marker where each burn starts. Each has its own material: in trail mode they fade one by one.
    for (const e of flightBurns(plan)) {
      const st = craftAt(plan, e.craft, e.utcMs)
      if (!st) continue
      const mat = new SpriteMaterial({ map: this.burnTex, depthWrite: false, depthTest: false, transparent: true, toneMapped: false })
      const s = new Sprite(mat)
      s.renderOrder = 4
      s.visible = false
      this.addPlanObject(s, this.scene)
      this.burnMarks.push({
        sprite: s, mat, frame: st.frame, utcMs: e.utcMs, shown: true,
        local: st.frame === 'moon' ? magnify(st.pos, mm) : this.mapGeo(st.pos, e.utcMs),
      })
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

    this.tubeOf = null
    this.syncTube()
    this.applyLayers()
    this.setTime(plan.launchMs)
  }

  /** Draws the dispersion tube of the analysis in the store, or removes it; the old one is disposed. */
  private syncTube() {
    const a = getFlightAnalysis()
    const tube = a.dispersion.state === 'ready' && this.plan ? a.dispersion.result.tube : null
    if (tube === this.tubeOf && (tube === null || this.tubeLines.length > 0)) return
    this.clearTube()
    this.tubeOf = tube
    if (!tube || tube.length < 2) return
    const mm = this.moonMag
    ;[1, 3].forEach((k, i) => {
      const geo = new BufferGeometry().setAttribute('position', new BufferAttribute(tubeSegments(tube, k, (p) => magnify(p, mm)), 3))
      const lines = new LineSegments(geo, this.tubeMats[i])
      lines.renderOrder = 3
      lines.visible = this.layers.tube
      this.moonGroup.add(lines)
      this.tubeLines.push(lines)
    })
  }

  private clearTube() {
    for (const l of this.tubeLines) {
      l.removeFromParent()
      l.geometry.dispose()
    }
    this.tubeLines = []
    this.tubeOf = null
  }

  /** Chooses what is drawn. Takes effect at once, also while paused. */
  setLayers(layers: FlightLayers): void {
    this.layers = layers
    this.applyLayers()
    if (this.plan) this.setTime(this.timeMs)
  }

  /** Moves everything to the simulated instant (clamped to the mission). No-op without a plan. */
  setTime(utcMs: number): void {
    const p = this.plan
    if (!p) return
    const ep = p.ephem
    const em = this.earthMag
    const mm = this.moonMag
    const t = Math.min(Math.max(utcMs, p.launchMs), p.endMs)
    this.timeMs = t

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

    // The lines: where "now" is along each of them.
    const [nowHi, nowLo] = splitTime((t - p.launchMs) / 1000)
    this.uNow.value.set(nowHi, nowLo)

    // Burn markers: Moon-frame ones travel with the Moon; in trail mode each appears at its ignition and fades.
    const trailS = this.layers.trailHours === null ? null : this.layers.trailHours * 3600
    for (const b of this.burnMarks) {
      setV(b.sprite, b.frame === 'moon' ? add(moon, b.local) : b.local)
      const fade = this.layers.trail ? trailFade((t - b.utcMs) / 1000, trailS) : 1
      b.mat.opacity = fade
      b.shown = fade > 0.05
    }

    // The two craft.
    const world = (st: { frame: 'earth' | 'moon'; pos: Vec3 }) => (st.frame === 'moon' ? add(moon, magnify(st.pos, mm)) : this.mapGeo(st.pos, t))
    const capsule = craftAt(p, 'capsule', t)
    const lander = craftAt(p, 'lander', t)
    this.lander = landerPresence(p, t)
    this.capsuleOn = !!capsule
    this.capsuleFiring = !!capsule && capsule.powered
    this.landerFiring = this.lander === 'apart' && !!lander && lander.powered
    if (capsule) {
      setV(this.halo, world(capsule))
      this.core.position.copy(this.halo.position)
      this.flare.position.copy(this.halo.position)
    }
    // While it is not on its own the lander's marker is where the capsule is.
    if (lander) setV(this.landerMark, world(lander))
    this.landerCore.position.copy(this.landerMark.position)
    this.landerFlare.position.copy(this.landerMark.position)
  }

  /** Keeps markers at a constant size on screen and hides those behind a body. Call before each render. */
  updateSizes(cam: PerspectiveCamera, heightPx: number): void {
    if (!this.plan) return
    // World units per pixel at each object's distance (same formula as globe.ts updatePins).
    const perPx = (o: Object3D) => (2 * cam.position.distanceTo(o.position)) / (cam.projectionMatrix.elements[5] * heightPx)
    const show = (o: Object3D, on: boolean, px: number) => {
      o.visible = on && !this.blocked(cam.position, o.position)
      if (o.visible) o.scale.setScalar(px * perPx(o))
    }
    for (const d of this.dots.values()) d.scale.setScalar(DOT_PX * perPx(d))
    const burns = this.layers.burns
    for (const b of this.burnMarks) show(b.sprite, burns && b.shown, BURN_MARK_PX)
    show(this.halo, this.capsuleOn, HALO_PX)
    show(this.core, this.capsuleOn, CORE_PX)
    show(this.flare, this.capsuleOn && burns && this.capsuleFiring, FLARE_PX)
    show(this.landerMark, this.lander !== 'absent', this.lander === 'docked' ? LANDER_DOCKED_PX : LANDER_APART_PX)
    show(this.landerCore, this.lander === 'apart', LANDER_CORE_PX)
    show(this.landerFlare, burns && this.landerFiring, FLARE_PX)
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
        return this.landerMark.position.clone() // where the capsule is while it is not on its own
      case 'arrival':
        return this.ring.visible ? this.ring.position.clone() : null
      default: {
        const d = this.dots.get(name)
        return d && d.visible ? d.position.clone() : null
      }
    }
  }

  /** World position of the i-th burn marker (the order of flightBurns), or null when trail mode hides it. */
  burnAnchor(i: number): Vector3 | null {
    const b = this.burnMarks[i]
    return b && b.shown ? b.sprite.position.clone() : null
  }

  /** Whether the lander is with the capsule, on its own or not in the picture at the current time. */
  landerState(): LanderPresence {
    return this.lander
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
    this.offAnalysis()
    this.clearPlan()
    const mats: Material[] = [this.earthMat, this.atmoMat, this.moonMat, this.dotMat, this.pathMat, this.burnMat, this.orbitMat, ...this.tubeMats, ...this.spriteMats]
    for (const m of mats) m.dispose()
    for (const g of [this.earthMesh.geometry, this.atmo.geometry, this.moonMesh.geometry, this.dotGeo]) g.dispose()
    for (const t of this.textures) t.dispose()
    // The Earth and Moon textures belong to the caller's TextureSet and are not disposed here.
  }

  private craftSprites(): Sprite[] {
    return [this.halo, this.core, this.flare, this.landerMark, this.landerCore, this.landerFlare]
  }

  /** True when Earth or the Moon lies between the camera and the point. */
  private blocked(from: Vector3, to: Vector3): boolean {
    const hit = (cx: number, cy: number, cz: number, r: number): boolean => {
      // closest approach of the segment from → to to the centre
      const dx = to.x - from.x
      const dy = to.y - from.y
      const dz = to.z - from.z
      const len2 = dx * dx + dy * dy + dz * dz
      if (len2 === 0) return false
      const s = Math.min(1, Math.max(0, ((cx - from.x) * dx + (cy - from.y) * dy + (cz - from.z) * dz) / len2))
      const px = from.x + s * dx - cx
      const py = from.y + s * dy - cy
      const pz = from.z + s * dz - cz
      return px * px + py * py + pz * pz < r * r
    }
    const m = this.moonGroup.position
    return hit(0, 0, 0, this.bodyRadius('earth') * BLOCK_RADIUS) || hit(m.x, m.y, m.z, this.bodyRadius('moon') * BLOCK_RADIUS)
  }

  private applyLayers() {
    for (const o of this.pathLines) o.visible = this.layers.paths
    for (const o of this.burnLines) o.visible = this.layers.burns
    for (const o of this.tubeLines) o.visible = this.layers.tube
    this.uTrailOn.value = this.layers.trail ? 1 : 0
    this.uTrail.value = this.layers.trailHours === null ? 0 : this.layers.trailHours * 3600
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

  private clearPlan() {
    this.clearTube()
    for (const o of this.planObjects) o.removeFromParent()
    this.planObjects = []
    for (const g of this.planGeos) g.dispose()
    this.planGeos = []
    for (const b of this.burnMarks) b.mat.dispose()
    this.burnMarks = []
    this.pathLines = []
    this.burnLines = []
    this.earthPatch = null
    this.moonPatch = null
  }
}
