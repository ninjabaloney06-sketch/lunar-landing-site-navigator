// 3D scene entry (build-plan §5.4, Brief C1). C1 owns this folder.
// CONTRACT (integrator, 14 Nov): C2 mounts the scene only through these exports. Signatures unchanged.
//
// Two scenes, two unit systems (build-plan §5.4 trap 3):
//   globe: origin = Moon centre, MOON_ME axes, km (globe.ts)
//   site/eye: origin = the site's ground point, ENU axes, metres (site.ts)
//   flight: origin = Earth centre, J2000 axes, km (flight.ts); the flight plan's own level, never flown into
// Sun, Earth and stars are a sky layer drawn first at true directions and true angular sizes (sky.ts).
// No angle-triple rotations, no trig and no hand-typed matrices here: directions come from geometry/ via frames.ts.

import {
  ACESFilmicToneMapping,
  MOUSE,
  PerspectiveCamera,
  Quaternion,
  Ray,
  SRGBColorSpace,
  Sphere,
  TOUCH,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Horizon, Site, TerrainTile } from '../data/types'
import type { MissionPlan } from '../flight/types'
import { qconj, qrot, scale } from '../flight/vec'
import { MOON_RADIUS_KM, enuBasis, siteVector, type BodyState } from '../geometry'
import { loadTextures } from './assets'
import { installFreeCam, type Rig } from './controls'
import { installDebug, type DebugView } from './debug'
import { DEFAULT_LAYERS, FlightWorld, type BodyPick, type FlightAnchor, type FlightLayers } from './flight'
import { EARTH_RADIUS_KM, SUN_RADIUS_KM, azElOfEnu, enuDir, enuToMeQuat, latLonOf, quat, v3 } from './frames'
import { GlobeWorld } from './globe'
import { SiteWorld } from './site'
import { Sky } from './sky'
import { TopView } from './topview'

export { TOP_VIEW } from './topview'

export type SceneLevel = 'globe' | 'site' | 'eye' | 'flight'
/** What the flight camera turns about: the whole transfer, or a body or a craft, which it then follows. */
export type FlightFocus = 'overview' | 'earth' | 'moon' | 'capsule' | 'lander'
export type { BodyPick, FlightAnchor, FlightLayers, LanderPresence } from './flight'
export { DEFAULT_LAYERS, flightBurns, landerPresence } from './flight'

export interface SceneFrame {
  site: Site | null
  horizon: Horizon | null
  terrain: TerrainTile | null
  state: BodyState
}

export interface SceneDeps {
  sites: Site[]
  // C2's data layer implements this in the app; C1's harness implements it for tests.
  loadFrame(siteId: string, utcMs: number): Promise<SceneFrame>
}

export interface ScreenPoint {
  x: number // CSS px relative to the container
  y: number
  visible: boolean // false when behind the camera, off screen or behind terrain
}

/** Named camera positions (Brief C4 part 2). 'start' and 'end' are the user points holding that role. */
export type Viewpoint = 'moon' | 'start' | 'end' | 'earth' | 'sun' | 'top'

/** A user point as the scene draws it: a place on the Moon, planetocentric MOON_ME degrees. */
export interface ScenePoint {
  name: string
  lat: number
  lon: number
  role: 'start' | 'end' | null
  selected: boolean
}

/** A right-click on the scene: where (CSS px in the container) and the Moon point under it, if any. */
export interface SceneMenu {
  x: number
  y: number
  hit: { lat: number; lon: number } | null
}

export interface SceneName extends ScreenPoint {
  name: string
}

export interface SceneHandle {
  ready: Promise<void>
  update(frame: SceneFrame): void
  setLevel(level: SceneLevel): void
  project(name: 'sun' | 'earth' | 'site'): ScreenPoint | null // 'site' = mast top, for the "Landing site" label
  onCameraChange(cb: () => void): () => void
  onPick(cb: (lat: number, lon: number) => void): () => void
  // Flight level (additive, 14 Nov): the plan to draw, the simulated instant, and label points on its objects.
  setFlight(plan: MissionPlan | null, trueScale: boolean): void
  setFlightTime(utcMs: number): void
  projectFlight(name: FlightAnchor): ScreenPoint | null
  /** Back to the default flight view (the whole transfer). */
  resetFlightView(): void
  setFlightFocus(focus: FlightFocus): void
  /** What the flight scene draws: path lines, burns, the trail mode (additive, 14 Nov). */
  setFlightLayers(layers: FlightLayers): void
  /** Label point of the i-th burn marker, in the order of flightBurns(plan); null when it is not drawn. */
  projectFlightBurn(i: number): ScreenPoint | null
  /** A click (not a drag) on Earth or the Moon in the flight view: the body and the point on it. */
  onFlightPick(cb: (pick: BodyPick) => void): () => void
  dispose(): void
  // Brief C4 additions (every member above is unchanged).
  /** The scene changed level by itself: a walk ends at eye level, a viewpoint in space ends at 'globe'. */
  onLevel(cb: (level: SceneLevel) => void): () => void
  /** Asked before a click on the scene acts (select a pin, walk); false = ignore this click. */
  setClickGuard(guard: (() => boolean) | null): void
  /** Flies to a viewpoint; false when it is not available (no point holds the role, or nothing is loaded). */
  goTo(v: Viewpoint): boolean
  /** True while the not-to-scale top view is shown. */
  onTopView(cb: (on: boolean) => void): () => void
  setMarkers(points: ScenePoint[]): void
  /** The site pin or user point under the pointer (hover, or the last tap), with its screen position. */
  named(): SceneName | null
  /** project(), except that a Sun or Earth disc wider than 40 px is labelled at its top edge, not its centre. */
  labelPoint(name: 'sun' | 'earth' | 'site'): ScreenPoint | null
  /** A right-click (or long press) on the scene. The browser's own menu is always suppressed. */
  onMenu(cb: (m: SceneMenu) => void): () => void
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

// Default site view (ninja, 13 Nov): 17 km out, 16° above the site's horizon, 54° vertical FOV, Sun ~18° left.
export const SITE_DEFAULT = { distKm: 17, el: 16, fov: 54, sunLeftDeg: 18 }
const SITE_DIST_KM = { min: 2, max: 60 }
const GLOBE_DIST_KM = { min: 3000, max: 20000, default: 6500 }
const EYE_DEFAULT_EL = 3
const EYE_FOV_MIN = 4 // narrowest lens at eye level, vertical degrees; the widest is the default field of view
const EYE_ROTATE_SPEED = -0.3 // drag the view, not the camera
const MOON_FLOOR_KM = 1 // the space camera stays this far above the 1737.4 km sphere (its near plane is 0.5 km)
const BODY_FLOOR = 1.05 // and outside 1.05 radii of Earth and the Sun
const FREE_MIN_DIST = 1e-4 // orbit distance limit once the wheel or a look-around has moved the camera
const BODY_FRAME = 5.5 // Earth and Sun viewpoints: camera this many body radii from the centre (disc about 10° in radius)
const POINT_ABOVE_KM = GLOBE_DIST_KM.min // a point outside the terrain tile is looked at from this far from the Moon's centre
const MOON_RADIUS_M = MOON_RADIUS_KM * 1000
const FLY_MS = 1500
const EARTHSHINE = 0.06 * Math.PI // faint fill at full Earth; scaled by Earth's phase, zero when Earth is hidden
const BACKGROUND = 0x0b0d11
// Flight view: seen from 50 deg above the transfer plane (viewUp, viewSide = sin, cos of 50 deg), Earth left and
// the Moon right, the Earth-Moon span filling 1/fit of the width that the flight panel (panelPx) leaves free.
const FLIGHT = {
  fov: 35,
  viewUp: 0.766,
  viewSide: 0.643,
  fit: 1.3,
  panelPx: 470,
  minDistKm: 0.5, // close enough to watch a liftoff or a touchdown
  maxDistKm: 3e6,
  reframeCos: 0.9986, // re-frame when the transfer plane has turned by more than 3 deg
  // Camera distance when a focus is chosen: Earth with its parking orbit, the Moon with its 100 km orbit, the
  // capsule and the lander with enough of their path to see where they are going.
  focusKm: { earth: 42000, moon: 13000, capsule: 30000, lander: 400 },
}
const AU_KM = 149_597_870.7
const ORIGIN = new Vector3()

interface Fly {
  cam: PerspectiveCamera // globeCam: a flight through space (MOON_ME km); siteCam: a walk in the site scene (ENU m)
  t0: number
  p0: Vector3
  p1: Vector3
  q0: Quaternion
  q1: Quaternion
  k: number // > 1: the remaining distance shrinks geometrically (long flights between bodies); 1: plain ease
  done: () => void
}

/** Throws when WebGL is unavailable; C2 then shows the horizon strip and the sentence. */
export function mountScene(container: HTMLElement, deps: SceneDeps): SceneHandle {
  if (!webglAvailable()) throw new Error('WebGL is not available')
  const params = new URLSearchParams(window.location.search)
  const testMode = params.has('test')
  const debug = params.has('debug')

  const renderer = new WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.outputColorSpace = SRGBColorSpace
  renderer.autoClear = false
  renderer.setClearColor(BACKGROUND, 1)
  const canvas = renderer.domElement
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.touchAction = 'none'
  container.appendChild(canvas)

  // Site/eye camera (ENU, m) and globe camera (MOON_ME, km). Both keep "up" = local up / MOON_ME north.
  const siteCam = new PerspectiveCamera(SITE_DEFAULT.fov, 1, 0.05, 3e6)
  siteCam.up.set(0, 0, 1)
  const globeCam = new PerspectiveCamera(SITE_DEFAULT.fov, 1, 0.5, 2e5)
  globeCam.up.set(0, 0, 1)

  const siteControls = new OrbitControls(siteCam, canvas)
  // Flight camera (J2000, km). Its controls are built per plan: OrbitControls reads camera.up once, and "up" here
  // is the transfer plane's normal.
  const flightCam = new PerspectiveCamera(FLIGHT.fov, 1, 0.01, 1e7) // logarithmic depth: 10 m to ten million km
  flightCam.up.set(0, 0, 1)
  let flightControls: OrbitControls | null = null
  const globeControls = new OrbitControls(globeCam, canvas)
  for (const c of [siteControls, globeControls]) {
    c.enablePan = false
    c.enableDamping = !testMode
    c.dampingFactor = 0.1
    // OrbitControls keeps the left drag and the one-finger drag only. Middle, right, wheel and pinch belong
    // to controls.ts and the viewpoint menu (three 0.170: a null action leaves the control idle).
    c.enableZoom = false
    c.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: null, RIGHT: null }
    c.touches = { ONE: TOUCH.ROTATE, TWO: null }
  }
  globeControls.rotateSpeed = 0.5
  // Set once the wheel ('dist') or a look-around ('look') has taken a camera off its orbit around the site or
  // the Moon's centre; cleared whenever a camera is placed (level change, site change, viewpoint).
  const free = { site: { dist: false, look: false }, globe: { dist: false, look: false } }
  let baseFov = SITE_DEFAULT.fov

  let level: SceneLevel = 'globe'
  let frame: SceneFrame | null = null
  let builtFor: { site: Site | null; horizon: Horizon | null; terrain: TerrainTile | null } | null = null
  let sky: Sky | null = null
  let globe: GlobeWorld | null = null
  let flight: FlightWorld | null = null
  let flightPlan: MissionPlan | null = null
  const flightPickCbs = new Set<(pick: BodyPick) => void>()
  let flightTrueScale = false
  let flightMs = 0
  let flightFramed: Vector3 | null = null // transfer-plane normal the flight camera was last framed for
  let flightFocus: FlightFocus = 'overview'
  let flightLayers: FlightLayers = DEFAULT_LAYERS
  const focusUp = new Vector3() // the followed craft's direction from the body it is close to, at that moment
  let focusUpValid = false
  let topView: TopView | null = null
  let top = false // the not-to-scale top view is shown (level stays 'globe')
  let markers: ScenePoint[] = []
  // The pin or user point whose name is shown: under the mouse, or last tapped.
  let hover: { kind: 'site'; id: string } | { kind: 'point'; index: number } | null = null
  const site = new SiteWorld()
  let siteKm = new Vector3()
  let enuToMe = new Quaternion()
  let meToEnu = new Quaternion()
  let fly: Fly | null = null
  // Where the eye-level camera stands after a walk (ENU m, eye point); null = on the landing site.
  let stand: Vector3 | null = null
  let dirty = true
  let viewVersion = 0 // bumped whenever the picture may change; project() caches per version
  let wanted: SceneLevel | null = null // setLevel request that arrived before a site frame or during a fly
  const markDirty = () => {
    dirty = true
    viewVersion++
  }
  let disposed = false
  let raf = 0
  const cameraCbs = new Set<() => void>()
  const pickCbs = new Set<(lat: number, lon: number) => void>()
  const levelCbs = new Set<(level: SceneLevel) => void>()
  let clickGuard: (() => boolean) | null = null
  const emitLevel = (l: SceneLevel) => {
    for (const cb of levelCbs) cb(l)
  }
  const topCbs = new Set<(on: boolean) => void>()
  const menuCbs = new Set<(m: SceneMenu) => void>()
  function setTop(on: boolean) {
    if (top === on) return
    top = on
    for (const cb of topCbs) cb(on)
    markDirty()
  }

  const size = new Vector2(1, 1)
  function resize() {
    const w = Math.max(container.clientWidth, 1)
    const h = Math.max(container.clientHeight, 1)
    size.set(w, h)
    renderer.setSize(w, h, false)
    for (const c of [siteCam, globeCam, flightCam]) {
      c.aspect = w / h
      c.updateProjectionMatrix()
    }
    markDirty()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()

  const inSpace = () => level === 'globe' || (fly !== null && fly.cam === globeCam)
  const activeCam = () => (level === 'flight' ? flightCam : inSpace() ? globeCam : siteCam)
  // Eye-level terrain (mask ring or crest strip) is built for the landing site's eye point only: after a walk
  // the site-level terrain is drawn and the mast is shown again, as from any other place.
  const eyeTerrain = () => level === 'eye' && !stand
  const showMast = () => level === 'site' || (level === 'eye' && stand !== null)

  function setControls() {
    globeControls.enabled = level === 'globe' && !fly && !top
    siteControls.enabled = (level === 'site' || level === 'eye') && !fly
    if (flightControls) flightControls.enabled = level === 'flight'
    globeControls.minDistance = free.globe.dist ? FREE_MIN_DIST : GLOBE_DIST_KM.min
    globeControls.maxDistance = free.globe.dist ? Infinity : GLOBE_DIST_KM.max
    if (level === 'eye') {
      siteControls.minDistance = siteControls.maxDistance = 0.01
      // Zoomed in, the same drag turns the view by the same share of the picture.
      siteControls.rotateSpeed = (EYE_ROTATE_SPEED * siteCam.fov) / baseFov
      siteControls.minPolarAngle = 0.02
      siteControls.maxPolarAngle = Math.PI - 0.02
    } else {
      siteControls.minDistance = free.site.dist ? FREE_MIN_DIST : SITE_DIST_KM.min * 1000
      siteControls.maxDistance = free.site.dist ? Infinity : SITE_DIST_KM.max * 1000
      siteControls.rotateSpeed = 0.5
      siteControls.minPolarAngle = 0.02
      // On its orbit the camera stays above the site's horizontal plane; after a look-around the floor in
      // keepAboveGround() does that job.
      siteControls.maxPolarAngle = free.site.look ? Math.PI - 0.02 : Math.PI / 2 - 0.005
    }
  }

  // ---------- free camera: look-around, dolly, eye-level zoom (controls.ts) ----------

  const moonSphere = new Sphere(new Vector3(), MOON_RADIUS_KM)
  const bodiesKm = () => (frame ? [v3(frame.state.earth_km), v3(frame.state.sun_km)] : [])
  const groundBelow = (p: Vector3) => site.groundZ(p.x, p.y)

  const siteRig: Rig = {
    cam: siteCam,
    ctl: siteControls,
    mode: 'dolly',
    surface: (p) => p.z - groundBelow(p),
    allowed: (p) => p.z - groundBelow(p) >= site.eyeHeight - 1e-9,
    far: SITE_DIST_KM.max * 1000,
    free(what) {
      if (level === 'eye') return
      free.site.dist = true
      if (what === 'look') free.site.look = true
      setControls()
    },
    pivot: () => (level === 'eye' ? null : site.hit(siteCam.position, siteCam.getWorldDirection(new Vector3()))),
    fovMax: baseFov,
    fovMin: EYE_FOV_MIN,
    fovChanged: () => setControls(),
  }
  const globeRig: Rig = {
    cam: globeCam,
    ctl: globeControls,
    mode: 'dolly',
    surface(p) {
      const [e, s] = bodiesKm()
      const moon = p.length() - MOON_RADIUS_KM
      return e ? Math.min(moon, p.distanceTo(e) - EARTH_RADIUS_KM, p.distanceTo(s) - SUN_RADIUS_KM) : moon
    },
    allowed(p) {
      const [e, s] = bodiesKm()
      if (p.length() < MOON_RADIUS_KM + MOON_FLOOR_KM) return false
      return !e || (p.distanceTo(e) >= EARTH_RADIUS_KM * BODY_FLOOR && p.distanceTo(s) >= SUN_RADIUS_KM * BODY_FLOOR)
    },
    far: GLOBE_DIST_KM.max,
    free(what) {
      free.globe.dist = true
      if (what === 'look') free.globe.look = true
      setControls()
    },
    pivot: () => new Ray(globeCam.position, globeCam.getWorldDirection(new Vector3())).intersectSphere(moonSphere, new Vector3()),
    fovMax: baseFov,
    fovMin: EYE_FOV_MIN,
    fovChanged: () => {},
  }

  /** The camera the wheel and the middle drag act on; null while a fly runs and in the fixed top view. */
  function rig(): Rig | null {
    if (fly || !frame || top || level === 'flight') return null
    if (level === 'globe') return globeRig
    siteRig.mode = level === 'eye' ? 'zoom' : 'dolly'
    siteRig.fovMax = baseFov
    return siteRig
  }

  /** A left drag after a look-around may swing the camera into the ground or the Moon: put it back on the floor. */
  function keepAboveGround() {
    if (level === 'site' && free.site.dist && !siteRig.allowed(siteCam.position)) {
      siteCam.position.z = groundBelow(siteCam.position) + site.eyeHeight
      return true
    }
    if (level === 'globe' && free.globe.dist && globeCam.position.length() < MOON_RADIUS_KM + MOON_FLOOR_KM) {
      globeCam.position.setLength(MOON_RADIUS_KM + MOON_FLOOR_KM)
      return true
    }
    return false
  }

  /** Back to the default lens (the eye-level zoom does not follow the camera to another level). */
  function resetZoom() {
    if (siteCam.fov === baseFov) return
    siteCam.fov = baseFov
    siteCam.updateProjectionMatrix()
  }

  // ---------- frame / sky ----------

  /** Sky for the flight level: stars fixed in J2000 and the Sun where the plan's ephemeris puts it. */
  function flightSkyState(): BodyState | null {
    if (!flightPlan) return frame?.state ?? null
    const q = flightPlan.ephem.moonFixedToInertial(flightMs)
    const sunMe = scale(qrot(qconj(q), flightPlan.ephem.sunDir(flightMs)), AU_KM)
    return { utcMs: flightMs, sun_km: sunMe, earth_km: [384400, 0, 0], q_me_to_j2000: q, q_earth_to_me: [0, 0, 0, 1] }
  }

  function syncSky() {
    if (sky && level === 'flight') {
      const st = flightSkyState()
      if (st) sky.update(st, ORIGIN, quat(st.q_me_to_j2000))
      sky.syncCamera(flightCam)
      return
    }
    if (!sky || !frame) return
    sky.showBodies(!top)
    if (top && topView) {
      // The top view draws its own three bodies; the sky layer only supplies the stars behind them.
      topView.update(frame.state, globeCam, size.x, size.y)
      sky.update(frame.state, new Vector3(), new Quaternion())
      sky.syncCamera(topView.camera)
      return
    }
    if (inSpace()) sky.update(frame.state, globeCam.position, new Quaternion())
    else sky.update(frame.state, siteKm, meToEnu)
    sky.syncCamera(activeCam())
  }

  function applyLights() {
    if (!sky || !frame || !globe) return
    // Site lights from the site's point of view (topocentric), globe lights from the Moon centre.
    sky.update(frame.state, siteKm, meToEnu)
    const sunE = sky.worldDir('sun')
    const earthE = sky.worldDir('earth')
    const eye = new Vector3(0, 0, site.eyeHeight)
    const earthUp = frame.site ? !site.occluded(eye, earthE, Infinity, true) : false
    // Same eye-level test for the Sun, so the ground is not drawn sunlit while the answer says "Dark".
    const sunUp = frame.site ? !site.occluded(eye, sunE, Infinity, true) : true
    site.setLights(sunE, earthE, earthUp ? EARTHSHINE * sky.earthPhase : 0, sunUp)
    const sunM = v3(frame.state.sun_km).normalize()
    const earthM = v3(frame.state.earth_km).normalize()
    globe.setLights(sunM, earthM, EARTHSHINE * 0.5 * sky.earthPhase)
    syncSky()
  }

  function applyFrame(f: SceneFrame) {
    const siteChanged = !builtFor || builtFor.site?.id !== f.site?.id
    frame = f
    if (f.site) {
      siteKm = v3(siteVector(f.site.lat, f.site.lon, (f.site.elev_m ?? 0) / 1000))
      enuToMe = enuToMeQuat(enuBasis(f.site.lat, f.site.lon))
      meToEnu = enuToMe.clone().invert()
    }
    // Rebuild only when the site's data changes (compared by id: C2 may hand new objects for every time step).
    const same = (a: { id?: string; site_id?: string } | null | undefined, b: typeof a) =>
      (a?.id ?? a?.site_id ?? null) === (b?.id ?? b?.site_id ?? null)
    if (
      !builtFor ||
      !same(builtFor.site, f.site) ||
      !same(builtFor.horizon, f.horizon) ||
      (builtFor.terrain?.meta.site_id ?? null) !== (f.terrain?.meta.site_id ?? null)
    ) {
      if (f.site) site.build(f.horizon, f.terrain, f.site.elev_m)
      builtFor = { site: f.site, horizon: f.horizon, terrain: f.terrain }
      placeMarkers()
    }
    globe?.setSites(deps.sites, f.site?.id ?? null)
    applyLights()
    if (!f.site && level !== 'globe' && level !== 'flight') {
      level = 'globe'
      fly = null
      setGlobeView()
    } else if (siteChanged && level === 'eye') setEyeView()
    else if (siteChanged && level === 'site') setSiteView()
    if (wanted && f.site && !fly) setLevel(wanted, false)
    setControls()
    markDirty()
  }

  // ---------- user points ----------

  /**
   * Terrain-grid offset (ENU x, y in m) of a Moon point seen from the current site: where the radial line
   * through the point meets the site's tangent plane (the levels' own convention, levels.ts). null for a
   * point around the curve of the Moon.
   */
  function gridOf(lat: number, lon: number): { x: number; y: number } | null {
    const d = v3(siteVector(lat, lon, 0)).normalize().applyQuaternion(meToEnu)
    return d.z > 0.5 ? { x: (MOON_RADIUS_M * d.x) / d.z, y: (MOON_RADIUS_M * d.y) / d.z } : null
  }

  /** A user point is drawn in the site scene only where the 80 m tile has terrain under it. */
  function onTile(m: ScenePoint): Vector3 | null {
    const g = frame?.site ? gridOf(m.lat, m.lon) : null
    return g && site.covers(g.x, g.y) ? new Vector3(g.x, g.y, site.groundZ(g.x, g.y)) : null
  }

  function placeMarkers() {
    globe?.setMarkers(markers)
    site.setMarkers(
      markers.flatMap((m, index) => {
        const ground = onTile(m)
        return ground ? [{ index, name: m.name, ground, selected: m.selected }] : []
      }),
    )
    if (hover?.kind === 'point' && !markers[hover.index]) hover = null
    markDirty()
  }

  // ---------- camera poses ----------

  function sunAz(): number {
    syncSkyForSite()
    return sky ? azElOfEnu(sky.worldDir('sun')).az : 0
  }

  function syncSkyForSite() {
    if (sky && frame) sky.update(frame.state, siteKm, meToEnu)
  }

  function placeSiteCam(az: number, el: number, distKm: number) {
    viewVersion++
    free.site = { dist: false, look: false }
    stand = null
    setTop(false)
    resetZoom()
    setControls()
    siteCam.position.copy(enuDir(az + 180, el)).multiplyScalar(distKm * 1000)
    siteControls.target.set(0, 0, 0)
    siteCam.lookAt(siteControls.target)
    siteControls.update()
  }

  function placeEyeCam(az: number, el: number, at: Vector3 | null = null) {
    viewVersion++
    free.site = { dist: false, look: false }
    setTop(false)
    stand = at
    const eye = at ?? new Vector3(0, 0, site.eyeHeight)
    siteCam.position.copy(eye)
    siteControls.target.copy(eye).addScaledVector(enuDir(az, el), 0.01)
    siteCam.lookAt(siteControls.target)
    siteControls.update()
  }

  /** Default site view: Sun ~18° left of centre; if Earth is up, clockwise of the Sun and both fit, centre the pair. */
  function setSiteView() {
    setControls()
    const sAz = sunAz()
    placeSiteCam(sAz + SITE_DEFAULT.sunLeftDeg, SITE_DEFAULT.el, SITE_DEFAULT.distKm)
    if (sky) {
      const e = azElOfEnu(sky.worldDir('earth'))
      const d = (((e.az - sAz) % 360) + 360) % 360
      if (e.el > -1 && d > 2 * SITE_DEFAULT.sunLeftDeg && d < 180) {
        placeSiteCam(sAz + d / 2, SITE_DEFAULT.el, SITE_DEFAULT.distKm)
        const p = projectSky('earth')
        const s = projectSky('sun')
        const fits = (q: ScreenPoint | null) => q && q.x > 0.08 * size.x && q.x < 0.92 * size.x
        if (!fits(p) || !fits(s)) placeSiteCam(sAz + SITE_DEFAULT.sunLeftDeg, SITE_DEFAULT.el, SITE_DEFAULT.distKm)
      }
    }
    markDirty()
  }

  function currentHeading(): number {
    const f = new Vector3()
    siteCam.getWorldDirection(f)
    f.z = 0
    return f.lengthSq() > 1e-12 ? azElOfEnu(f.normalize()).az : sunAz()
  }

  function setEyeView(az?: number, el?: number) {
    resetZoom()
    setControls()
    placeEyeCam(az ?? currentHeading(), el ?? EYE_DEFAULT_EL)
    markDirty()
  }

  function setGlobeView(lat?: number, lon?: number, distKm?: number) {
    free.globe = { dist: false, look: false }
    setTop(false)
    setControls()
    const sunLon = frame ? latLonOf(v3(frame.state.sun_km)).lon : 0
    const la = lat ?? -60
    const lo = lon ?? sunLon + 50
    const d = distKm ?? GLOBE_DIST_KM.default
    globeCam.position.copy(v3(siteVector(la, lo, d - MOON_RADIUS_KM)))
    globeControls.target.set(0, 0, 0)
    globeCam.lookAt(globeControls.target)
    globeControls.update()
    markDirty()
  }

  // ---------- flight level ----------

  /** Default flight view: the whole transfer, Earth left, Moon right, from above the transfer plane. */
  function setFlightView() {
    const vf = flight?.viewFrame()
    if (!vf) return
    flightControls?.dispose()
    flightCam.up.copy(vf.normal)
    const c = new OrbitControls(flightCam, canvas)
    c.enableDamping = !testMode
    c.dampingFactor = 0.1
    c.rotateSpeed = 0.5
    c.zoomSpeed = 2.5 // from the whole transfer down to a launchpad is a factor of a million
    c.minDistance = FLIGHT.minDistKm
    c.maxDistance = FLIGHT.maxDistKm
    c.addEventListener('change', markDirty)
    flightControls = c
    const side = vf.toMoon.clone().cross(vf.normal) // toward the viewer: puts the Moon on the right
    const dir = vf.normal.clone().multiplyScalar(FLIGHT.viewUp).addScaledVector(side, FLIGHT.viewSide).normalize()
    const tanHalfH = flightCam.aspect / flightCam.projectionMatrix.elements[5]
    const panel = size.x >= 900 ? Math.min(FLIGHT.panelPx / size.x, 0.45) : 0
    const dist = (vf.span * FLIGHT.fit) / (2 * tanHalfH * (1 - panel))
    // Shift the target toward Earth so the transfer sits in the middle of the area the panel leaves free.
    const target = vf.center.clone().addScaledVector(vf.toMoon, -panel * dist * tanHalfH)
    flightCam.position.copy(target).addScaledVector(dir, dist)
    c.target.copy(target)
    flightCam.lookAt(target)
    c.update()
    flightFramed = vf.normal.clone()
    setFocusControls()
    setControls()
    markDirty()
  }

  /** Whole flight: free navigation, the zoom goes to the point under the cursor and the view can be shifted.
   *  With a focus the object is the pivot and stays it: the zoom runs along the line to its centre, and shifting
   *  the view is off, because both would move the pivot away from the object. */
  function setFocusControls() {
    if (!flightControls) return
    const free = flightFocus === 'overview'
    flightControls.zoomToCursor = free
    flightControls.enablePan = free
  }

  function setFlight(plan: MissionPlan | null, trueScale: boolean) {
    flightPlan = plan
    flightTrueScale = trueScale
    if (!flight) return // applied once the textures are in
    flight.setPlan(plan, trueScale)
    if (plan) {
      flightMs = Math.min(plan.endMs, Math.max(plan.launchMs, flightMs))
      flight.setTime(flightMs)
    }
    const vf = flight.viewFrame()
    if (level === 'flight' && vf && (!flightFramed || flightFramed.dot(vf.normal) < FLIGHT.reframeCos)) setFlightView()
    if (flightFocus !== 'overview') setFlightFocus(flightFocus) // the followed object is somewhere else now
    markDirty()
  }

  function setFlightTime(utcMs: number) {
    if (utcMs === flightMs) return
    flightMs = utcMs
    flight?.setTime(utcMs)
    followFocus()
    if (level === 'flight') markDirty()
  }

  /** The body a point is close to (within three radii of its centre), if any. */
  function bodyNear(p: Vector3): { centre: Vector3; radius: number } | null {
    if (!flight) return null
    const moon = flight.anchor('moon')
    const moonR = flight.bodyRadius('moon')
    const earthR = flight.bodyRadius('earth')
    if (moon && p.distanceTo(moon) < 3 * moonR) return { centre: moon, radius: moonR }
    if (p.length() < 3 * earthR) return { centre: ORIGIN.clone(), radius: earthR }
    return null
  }

  /** Turns the camera about a body or a craft. A body is seen from the direction the camera looks from now. A
   *  craft close to a body is seen from outside that body, so the body is never between the camera and the craft. */
  function setFlightFocus(focus: FlightFocus) {
    flightFocus = focus
    focusUpValid = false
    if (focus === 'overview') {
      setFlightView()
      return
    }
    if (!flightControls) setFlightView()
    setFocusControls()
    const p = flight?.anchor(focus)
    if (!p || !flightControls) return
    const dir = flightCam.position.clone().sub(flightControls.target).normalize()
    // A craft keeps the viewing distance the user already chose once it is close; a body gets its own.
    const now = flightCam.position.distanceTo(flightControls.target)
    const craft = focus === 'capsule' || focus === 'lander'
    const dist = craft && now < FLIGHT.focusKm.capsule ? now : FLIGHT.focusKm[focus]
    const body = craft ? bodyNear(p) : null
    if (body) {
      const up = p.clone().sub(body.centre).normalize()
      const side = dir.clone().addScaledVector(up, -dir.dot(up)) // the part of the old direction along the ground
      if (side.lengthSq() < 1e-6) side.copy(flightCam.up).addScaledVector(up, -flightCam.up.dot(up))
      dir.copy(side.normalize()).multiplyScalar(0.8).addScaledVector(up, 0.6).normalize() // 37° above the local horizon
      focusUp.copy(up)
      focusUpValid = true
    }
    flightControls.target.copy(p)
    flightCam.position.copy(p).addScaledVector(dir, dist)
    flightCam.lookAt(p)
    flightControls.update()
    markDirty()
  }

  /** Puts the pivot exactly on the followed object and carries the camera along, so the user's own turning and
   *  zooming stay. Around a body the view also turns with the craft's position over it: the camera stays on the
   *  craft's side. */
  function followFocus() {
    if (flightFocus === 'overview' || !flight || !flightControls) return
    const p = flight.anchor(flightFocus)
    if (!p || p.equals(flightControls.target)) return
    const offset = flightCam.position.clone().sub(flightControls.target)
    const body = flightFocus === 'capsule' || flightFocus === 'lander' ? bodyNear(p) : null
    if (body) {
      const up = p.clone().sub(body.centre).normalize()
      if (focusUpValid) offset.applyQuaternion(new Quaternion().setFromUnitVectors(focusUp, up))
      focusUp.copy(up)
      focusUpValid = true
    } else focusUpValid = false
    flightControls.target.copy(p)
    flightCam.position.copy(p).add(offset)
  }

  /** The camera never goes below the surface of Earth or the Moon: a globe seen from inside is invisible. */
  function keepOutside() {
    if (!flight || !flightPlan) return
    const moon = flight.anchor('moon')
    const bodies: [Vector3, number][] = [[ORIGIN, flight.bodyRadius('earth')]]
    if (moon) bodies.push([moon, flight.bodyRadius('moon')])
    for (const [centre, radius] of bodies) {
      const d = flightCam.position.clone().sub(centre)
      const min = radius + 0.05 // 50 m above the surface
      if (d.lengthSq() < min * min) {
        flightCam.position.copy(centre).addScaledVector(d.lengthSq() > 0 ? d.normalize() : new Vector3(0, 0, 1), min)
        markDirty()
      }
    }
  }

  /** True when the sphere blocks the segment from `from` to `to`. */
  function blocked(from: Vector3, to: Vector3, centre: Vector3, radius: number): boolean {
    const dir = to.clone().sub(from)
    const len = dir.length()
    const hit = new Ray(from, dir.normalize()).intersectSphere(new Sphere(centre, radius), new Vector3())
    return hit !== null && hit.distanceTo(from) < len - 1e-6
  }

  /** Screen point of a point in the flight scene; not visible when Earth or the Moon is in the way. */
  function flightPoint(p: Vector3): ScreenPoint | null {
    const moon = flight?.anchor('moon')
    if (!flight || !moon) return null
    const sp = toScreen(p, flightCam)
    if (!sp.visible) return sp
    const earthR = flight.bodyRadius('earth')
    const moonR = flight.bodyRadius('moon')
    const hidden = blocked(flightCam.position, p, ORIGIN, earthR * 0.98) || blocked(flightCam.position, p, moon, moonR * 0.98)
    return { ...sp, visible: !hidden }
  }

  function projectFlight(name: FlightAnchor): ScreenPoint | null {
    if (level !== 'flight' || !flight || !flightPlan) return null
    const p = flight.anchor(name)
    if (!p) return null
    if (name === 'lander' && flight.landerState() !== 'apart') return null // its label is the capsule's then
    if (name === 'earth' || name === 'moon' || name === 'arrival') {
      // The label sits above the body (or the ring): its top edge as the camera sees it.
      const up = new Vector3(0, 1, 0).applyQuaternion(flightCam.quaternion)
      return toScreen(p.addScaledVector(up, flight.bodyRadius(name === 'earth' ? 'earth' : 'moon')), flightCam)
    }
    return flightPoint(p)
  }

  function projectFlightBurn(i: number): ScreenPoint | null {
    if (level !== 'flight' || !flight || !flightPlan) return null
    const p = flight.burnAnchor(i)
    return p && flightPoint(p)
  }

  function setFlightLayers(layers: FlightLayers) {
    flightLayers = layers
    flight?.setLayers(layers)
    markDirty()
  }

  /**
   * Earth or Sun viewpoint: outside the body, the body centred and framed, the camera `from` (unit vector)
   * of its centre. The sky layer draws both bodies at their true direction and angular size from wherever
   * the camera is, so nothing is added to the scene.
   */
  function setBodyView(centerKm: Vector3, radiusKm: number, from: Vector3) {
    free.globe = { dist: true, look: true } // not on the orbit around the Moon: the distance limits do not apply
    setTop(false)
    setControls()
    // Farther back on a narrow screen, so the disc keeps a margin at the sides.
    const d = (radiusKm * BODY_FRAME) / Math.min(1, 1.5 * globeCam.aspect)
    globeCam.position.copy(centerKm).addScaledVector(from, d)
    globeControls.target.copy(centerKm)
    globeCam.lookAt(centerKm)
    globeControls.update()
    markDirty()
  }

  /** Site-camera pose expressed in MOON_ME km (for the fly between the two scenes). */
  function sitePoseInMe(): { p: Vector3; q: Quaternion } {
    const p = siteCam.position.clone().multiplyScalar(0.001).applyQuaternion(enuToMe).add(siteKm)
    const q = enuToMe.clone().multiply(siteCam.quaternion)
    return { p, q }
  }

  function startFly(p0: Vector3, q0: Quaternion, p1: Vector3, q1: Quaternion, done: () => void, cam: PerspectiveCamera = globeCam, k = 1) {
    fly = { cam, t0: performance.now(), p0, q0, p1, q1, k, done }
    setControls()
    markDirty()
  }

  /**
   * Walk (notebook note 6; ninja, 14 Nov): the camera goes to stand on the terrain at ENU (x, y), eye height
   * above it, facing the way it came. A camera move only: the site, the sky directions and every number stay
   * those of the landing site.
   */
  function walkTo(x: number, y: number, animate = !testMode, faceSite = false): boolean {
    if (!frame?.site || fly || level === 'globe' || level === 'flight') return false
    if (Math.hypot(x, y) > SITE_DIST_KM.max * 1000) return false
    const from = { p: siteCam.position.clone(), q: siteCam.quaternion.clone() }
    const to = new Vector3(x, y, site.groundZ(x, y) + site.eyeHeight)
    // A click faces the way the camera came; a point viewpoint faces the landing site, so its mast is in view.
    const way = faceSite ? new Vector3(-x, -y, 0) : to.clone().sub(from.p).setZ(0)
    const az = way.lengthSq() > 1 ? azElOfEnu(way.normalize()).az : currentHeading()
    const was = level
    level = 'eye'
    wanted = null
    resetZoom()
    setControls()
    placeEyeCam(az, EYE_DEFAULT_EL, to)
    if (animate) {
      const q1 = siteCam.quaternion.clone()
      siteCam.position.copy(from.p)
      siteCam.quaternion.copy(from.q)
      startFly(from.p, from.q, to.clone(), q1, () => placeEyeCam(az, EYE_DEFAULT_EL, to), siteCam)
    }
    markDirty()
    if (was !== 'eye') emitLevel('eye')
    notifyCamera()
    return true
  }

  function stepFly(now: number) {
    if (!fly) return
    const t = Math.min((now - fly.t0) / FLY_MS, 1)
    const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2 // ease in-out cubic
    // Between bodies the remaining distance shrinks geometrically, so the destination grows through the whole
    // flight instead of in its last frames.
    const along = fly.k > 1.001 ? 1 - (fly.k ** (1 - e) - 1) / (fly.k - 1) : e
    fly.cam.position.lerpVectors(fly.p0, fly.p1, along)
    fly.cam.quaternion.slerpQuaternions(fly.q0, fly.q1, e)
    // A walk never cuts through a hill on its way.
    if (fly.cam === siteCam) siteCam.position.z = Math.max(siteCam.position.z, groundBelow(siteCam.position) + site.eyeHeight)
    fly.cam.updateMatrixWorld(true)
    markDirty()
    if (t >= 1) {
      const done = fly.done
      fly = null
      done()
      setControls()
      if (wanted && wanted !== level) setLevel(wanted)
    }
  }

  /** To a pose in the space scene, from wherever the camera is. `place` puts globeCam and its controls there. */
  function flyInSpace(place: () => void, animate: boolean) {
    const from = level === 'globe' ? { p: globeCam.position.clone(), q: globeCam.quaternion.clone() } : sitePoseInMe()
    const was = level
    level = 'globe'
    wanted = null
    place()
    if (animate) {
      const to = { p: globeCam.position.clone(), q: globeCam.quaternion.clone() }
      const target = globeControls.target.clone()
      globeCam.position.copy(from.p)
      globeCam.quaternion.copy(from.q)
      const k = from.p.distanceTo(to.p) / Math.max(to.p.distanceTo(target), 1)
      startFly(
        from.p,
        from.q,
        to.p,
        to.q,
        () => {
          globeCam.position.copy(to.p)
          globeControls.target.copy(target)
          globeCam.lookAt(target)
          globeControls.update()
        },
        globeCam,
        k,
      )
    }
    setControls()
    markDirty()
    if (was !== 'globe') emitLevel('globe')
    notifyCamera()
  }

  function goTo(v: Viewpoint, animate = !testMode): boolean {
    if (!frame || !sky || !globe || fly || level === 'flight') return false
    const state = frame.state
    if (v === 'start' || v === 'end') {
      const m = markers.find((p) => p.role === v)
      if (!m) return false
      const g = frame.site ? gridOf(m.lat, m.lon) : null
      if (g && site.covers(g.x, g.y)) {
        // On the terrain tile: stand on the point, as a walk does.
        if (level === 'globe') setLevel('site', false)
        return walkTo(g.x, g.y, animate, true)
      }
      flyInSpace(() => setGlobeView(m.lat, m.lon, POINT_ABOVE_KM), animate)
      return true
    }
    if (v === 'top') {
      const was = level
      level = 'globe'
      wanted = null
      stand = null
      setTop(true)
      setControls()
      if (was !== 'globe') emitLevel('globe')
      notifyCamera()
      return true
    }
    if (v === 'moon') flyInSpace(() => setGlobeView(), animate)
    else if (v === 'earth') {
      // From the sunlit side, leaning toward the Moon: the day side of Earth is in view whatever the Moon's phase.
      const earth = v3(state.earth_km)
      const toSun = v3(state.sun_km).sub(earth).normalize()
      const toMoon = earth.clone().negate().normalize()
      flyInSpace(() => setBodyView(earth, EARTH_RADIUS_KM, toSun.addScaledVector(toMoon, 0.6).normalize()), animate)
    } else {
      const sun = v3(state.sun_km)
      flyInSpace(() => setBodyView(sun, SUN_RADIUS_KM, sun.clone().negate().normalize()), animate) // from the Moon's side
    }
    return true
  }

  function setLevel(next: SceneLevel, animate = !testMode) {
    // C2 may ask for 'site' before the first frame or while a fly runs: remember it and apply it then.
    if ((!frame?.site && next !== 'globe' && next !== 'flight') || fly) {
      wanted = next
      return
    }
    wanted = null
    const prev = level
    if (prev === 'flight') animate = false // no fly between the Earth-centred flight frame and the Moon frames
    if (next === 'flight') {
      level = 'flight'
      if (!flightFramed) setFlightView()
      setControls()
      markDirty()
      notifyCamera()
      return
    }
    if (next === 'globe') {
      if (prev !== 'globe' && animate) {
        const from = sitePoseInMe()
        level = 'globe'
        setGlobeView()
        const to = { p: globeCam.position.clone(), q: globeCam.quaternion.clone() }
        globeCam.position.copy(from.p)
        globeCam.quaternion.copy(from.q)
        startFly(from.p, from.q, to.p, to.q, () => {
          globeCam.position.copy(to.p)
          globeCam.lookAt(0, 0, 0)
          globeControls.update()
        })
      } else {
        level = 'globe'
        setGlobeView()
      }
    } else if (next === 'site') {
      if (prev === 'globe' && animate) {
        const p0 = globeCam.position.clone()
        const q0 = globeCam.quaternion.clone()
        level = 'site'
        setSiteView()
        const to = sitePoseInMe()
        level = 'globe' // render the space scene during the fly
        startFly(p0, q0, to.p, to.q, () => {
          level = 'site'
        })
      } else {
        level = 'site'
        setSiteView()
      }
    } else {
      level = 'eye'
      setEyeView()
    }
    setControls()
    notifyCamera()
  }

  // ---------- projection ----------

  function toScreen(p: Vector3, cam: PerspectiveCamera): ScreenPoint {
    cam.updateMatrixWorld(true)
    const inFront = p.clone().applyMatrix4(cam.matrixWorldInverse).z < 0
    const n = p.clone().project(cam)
    const x = ((n.x + 1) / 2) * size.x
    const y = ((1 - n.y) / 2) * size.y
    const onScreen = inFront && x >= 0 && x <= size.x && y >= 0 && y <= size.y
    return { x, y, visible: onScreen }
  }

  function projectSky(b: 'sun' | 'earth'): ScreenPoint | null {
    if (!sky || !frame) return null
    site.setEyeMode(eyeTerrain())
    syncSky()
    if (top && topView) return toScreen(topView.worldPos(b), topView.camera)
    const sp = toScreen(sky.worldPos(b), sky.camera)
    if (!sp.visible) return sp
    const cam = activeCam()
    const blocked = inSpace() ? globe!.occludedDir(globeCam.position, sky.worldDir(b)) : site.occluded(cam.position, sky.worldDir(b))
    return { ...sp, visible: !blocked }
  }

  // C2 calls project() for three labels on every animation frame; the raycasts run once per view version.
  const projCache = new Map<string, { v: number; p: ScreenPoint | null }>()
  function project(name: 'sun' | 'earth' | 'site'): ScreenPoint | null {
    if (level === 'flight') return null // the flight level has its own labels (projectFlight)
    const c = projCache.get(name)
    if (c && c.v === viewVersion) return c.p && { ...c.p }
    const p = projectNow(name)
    projCache.set(name, { v: viewVersion, p })
    return p && { ...p }
  }

  function projectNow(name: 'sun' | 'earth' | 'site'): ScreenPoint | null {
    if (!sky || !frame || !globe) return null
    if (name !== 'site') return projectSky(name)
    if (!frame.site || top) return null
    if (inSpace()) {
      globe.updatePins(globeCam, size.y)
      const head = globe.pinTop(frame.site.id)
      if (!head) return null
      const sp = toScreen(head, globeCam)
      return { ...sp, visible: sp.visible && globe.pinsVisible && !globe.occluded(globeCam.position, head) }
    }
    site.updateMarker(siteCam, size.y, showMast(), level === 'site')
    const mast = site.mastTop()
    const sp = toScreen(mast, siteCam)
    if (!showMast()) return { ...sp, visible: false } // the mast is hidden while standing on the site
    const dir = mast.clone().sub(siteCam.position)
    const len = dir.length()
    return { ...sp, visible: sp.visible && !site.occluded(siteCam.position, dir.normalize(), len - 1) }
  }

  /**
   * Where the Sun or Earth label goes: the body's centre, as project() gives it, or the top of its disc once
   * the disc is wider than a label's tick (the top view, the Earth and Sun viewpoints, a zoomed-in lens).
   */
  function labelPoint(name: 'sun' | 'earth' | 'site'): ScreenPoint | null {
    const p = project(name)
    if (!p || !p.visible || name === 'site' || !sky) return p
    const cam = activeCam()
    const r = top && topView ? topView.radiusPx(name) : sky.sizeRatio(name) * (size.y / 2) * cam.projectionMatrix.elements[5]
    return r > 20 ? { ...p, y: Math.max(p.y - r, 48) } : p
  }

  // ---------- render loop ----------

  function render() {
    if (!sky || !globe) return
    if (level === 'flight') {
      if (!flight) return
      sky.showBodies(true) // the top view may have hidden them; outside the flight level syncSky() sets them again
      sky.setEarthVisible(false) // the flight scene draws its own Earth, at its real distance
      flight.updateSizes(flightCam, size.y)
      syncSky()
      renderer.clear()
      if (flightPlan || frame) sky.render(renderer)
      renderer.clearDepth()
      renderer.render(flight.scene, flightCam)
      return
    }
    site.setEyeMode(eyeTerrain())
    const cam = activeCam()
    if (inSpace()) {
      globe.updatePins(globeCam, size.y)
      // Far enough to keep the Moon in the picture from the Earth and Sun viewpoints; unchanged near the Moon.
      const far = Math.max(2e5, 2 * globeCam.position.length() + 1e4)
      if (globeCam.far !== far) {
        globeCam.far = far
        globeCam.updateProjectionMatrix()
      }
    } else {
      site.updateMarker(siteCam, size.y, showMast(), level === 'site')
      site.updateMarks(siteCam, size.y)
    }
    syncSky()
    renderer.clear()
    if (frame) sky.render(renderer)
    renderer.clearDepth()
    if (top && topView) renderer.render(topView.scene, topView.camera)
    else renderer.render(inSpace() ? globe.scene : site.scene, cam)
  }

  // ---------- names of pins and user points, the Moon point under the pointer ----------

  function nameAt(ndc: Vector2): typeof hover {
    if (top || fly || !globe || level === 'flight') return null
    if (inSpace()) {
      globe.updatePins(globeCam, size.y)
      return globe.nameAt(ndc, globeCam, size)
    }
    site.updateMarks(siteCam, size.y)
    const index = site.markAt(ndc, siteCam, size.x, size.y)
    return index === null ? null : { kind: 'point', index }
  }

  const sameName = (a: typeof hover, b: typeof hover) =>
    a === b || (a !== null && b !== null && a.kind === b.kind && (a.kind === 'site' ? a.id === (b as typeof a).id : a.index === (b as typeof a).index))

  function named(): SceneName | null {
    if (level === 'flight') return null // the flight level has its own labels (projectFlight)
    // The top view names the one body that has no label of its own, under its disc.
    if (top && topView && frame) {
      const c = toScreen(topView.worldPos('moon'), topView.camera)
      return { ...c, y: c.y + topView.radiusPx('moon'), name: 'Moon' }
    }
    if (!globe || top || fly) return null
    // The hovered or tapped one; otherwise the user point selected in the Mission panel.
    const sel = markers.findIndex((m) => m.selected)
    const h = hover ?? (sel >= 0 ? ({ kind: 'point', index: sel } as const) : null)
    if (!h) return null
    const name = h.kind === 'site' ? deps.sites.find((x) => x.id === h.id)?.name : markers[h.index]?.name
    if (!name) return null
    if (inSpace()) {
      globe.updatePins(globeCam, size.y)
      const head = h.kind === 'site' ? globe.pinTop(h.id) : globe.markTop(h.index)
      if (!head || !globe.pinsVisible) return null
      const sp = toScreen(head, globeCam)
      return { ...sp, name, visible: sp.visible && !globe.occluded(globeCam.position, head) }
    }
    if (h.kind === 'site') return null
    site.updateMarks(siteCam, size.y)
    const head = site.markTop(h.index)
    if (!head) return null
    const dir = head.clone().sub(siteCam.position)
    const len = dir.length()
    const sp = toScreen(head, siteCam)
    return { ...sp, name, visible: sp.visible && !site.occluded(siteCam.position, dir.normalize(), len - 1) }
  }

  /** Planetocentric lat/lon (MOON_ME) of the Moon point under a pointer position, or null off the Moon. */
  function surfaceAt(ndc: Vector2): { lat: number; lon: number } | null {
    if (top || fly || !globe || !frame || level === 'flight') return null
    if (inSpace()) return globe.surface(ndc, globeCam)
    const p = site.pick(ndc, siteCam)
    return p ? latLonOf(p.multiplyScalar(0.001).applyQuaternion(enuToMe).add(siteKm)) : null
  }

  function notifyCamera() {
    for (const cb of cameraCbs) cb()
  }

  let fpsFrames = 0
  let fpsT0 = performance.now()
  let fpsEl: HTMLDivElement | null = null
  if (debug) {
    fpsEl = document.createElement('div')
    fpsEl.style.cssText =
      'position:absolute;top:8px;right:8px;font:12px/1.2 ui-monospace,monospace;color:#9aa0a6;pointer-events:none;z-index:10'
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative'
    container.appendChild(fpsEl)
  }

  function loop(now: number) {
    if (disposed) return
    raf = requestAnimationFrame(loop)
    if (fly) stepFly(now)
    if (freeCam.step()) markDirty()
    const controls = level === 'flight' ? flightControls : inSpace() ? globeControls : siteControls
    if (controls?.update()) markDirty()
    if (level === 'flight') keepOutside()
    if (!fly && keepAboveGround()) markDirty()
    if (dirty || debug) {
      render()
      if (dirty) notifyCamera()
      dirty = false
      fpsFrames++
    }
    if (fpsEl && now - fpsT0 > 500) {
      fpsEl.textContent = `${Math.round((fpsFrames * 1000) / (now - fpsT0))} fps · ${level}`
      fpsFrames = 0
      fpsT0 = now
    }
  }

  siteControls.addEventListener('change', markDirty)
  globeControls.addEventListener('change', markDirty)
  const freeCam = installFreeCam({ canvas, testMode, rig, heightPx: () => size.y, changed: markDirty })

  // ---------- input: globe picking ----------

  // Keys (E = eye level, Esc = back) belong to the page: App.tsx maps them to setLevel through its view state,
  // the harness binds them itself. The scene binds none, so a key never acts twice.

  // A click is a press of the main button (or one finger) that moved less than 5 px. On the globe it selects
  // the pin under it; at site and eye level it walks to the terrain point under it.
  let down: { x: number; y: number } | null = null
  let fingers = 0
  const toNdc = (clientX: number, clientY: number) => {
    const r = canvas.getBoundingClientRect()
    return new Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
  }
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') fingers++
    down = e.button === 0 && fingers <= 1 ? { x: e.clientX, y: e.clientY } : null
  }
  const onUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') fingers = Math.max(0, fingers - 1)
    if (!down || fly || !globe || (top && level !== 'flight')) return
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
    down = null
    if (moved > 5 || fingers > 0 || (clickGuard && !clickGuard())) return
    const ndc = toNdc(e.clientX, e.clientY)
    if (level === 'flight') {
      // ray through the clicked pixel
      flightCam.updateMatrixWorld(true)
      const dir = new Vector3(ndc.x, ndc.y, 0.5).unproject(flightCam).sub(flightCam.position).normalize()
      const hit = flight?.pick(flightCam.position, dir)
      if (hit) for (const cb of flightPickCbs) cb(hit)
      return
    }
    if (e.pointerType === 'touch') {
      // No hover on a touch screen: the first tap on a pin or a user point shows its name, a tap on the same
      // pin again selects it, and a tap elsewhere takes the name away before anything else happens.
      const tapped = nameAt(ndc)
      if (!sameName(tapped, hover)) {
        hover = tapped
        markDirty()
        if (tapped) return
      } else if (tapped?.kind === 'point') return
    }
    if (level === 'globe') {
      const hit = globe.pick(ndc, globeCam, size)
      if (hit) for (const cb of pickCbs) cb(hit.lat, hit.lon)
      return
    }
    const spot = site.pick(ndc, siteCam)
    if (spot) walkTo(spot.x, spot.y)
  }
  const onCancel = (e: PointerEvent) => {
    if (e.pointerType === 'touch') fingers = Math.max(0, fingers - 1)
    down = null
  }
  const onHoverMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.buttons !== 0) return
    const next = nameAt(toNdc(e.clientX, e.clientY))
    if (sameName(next, hover)) return
    hover = next
    canvas.style.cursor = next ? 'pointer' : ''
    markDirty()
  }
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !hover) return
    hover = null
    canvas.style.cursor = ''
    markDirty()
  }
  const onContext = (e: MouseEvent) => {
    e.preventDefault()
    if (!menuCbs.size || level === 'flight') return
    const r = canvas.getBoundingClientRect()
    const m: SceneMenu = { x: e.clientX - r.left, y: e.clientY - r.top, hit: surfaceAt(toNdc(e.clientX, e.clientY)) }
    for (const cb of menuCbs) cb(m)
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onCancel)
  canvas.addEventListener('pointermove', onHoverMove)
  canvas.addEventListener('pointerleave', onLeave)
  canvas.addEventListener('contextmenu', onContext)

  // ---------- startup ----------

  let pending: SceneFrame | null = null
  const ready = loadTextures().then((tex) => {
    if (disposed) return
    sky = new Sky(tex)
    globe = new GlobeWorld(tex)
    topView = new TopView(tex)
    globe.setSites(deps.sites, null)
    flight = new FlightWorld(tex)
    flight.setLayers(flightLayers)
    if (flightPlan) setFlight(flightPlan, flightTrueScale)
    globe.setMarkers(markers)
    setGlobeView()
    if (level === 'flight') setFlightView()
    setControls()
    if (pending) applyFrame(pending)
    pending = null
    raf = requestAnimationFrame(loop)
  })

  function update(f: SceneFrame) {
    if (!sky) pending = f
    else applyFrame(f)
  }

  const handle: SceneHandle = {
    ready,
    update,
    setLevel: (l) => setLevel(l),
    project,
    onCameraChange(cb) {
      cameraCbs.add(cb)
      return () => cameraCbs.delete(cb)
    },
    onPick(cb) {
      pickCbs.add(cb)
      return () => pickCbs.delete(cb)
    },
    setFlight,
    setFlightTime,
    projectFlight,
    resetFlightView: () => setFlightFocus('overview'),
    setFlightFocus,
    setFlightLayers,
    projectFlightBurn,
    onFlightPick(cb) {
      flightPickCbs.add(cb)
      return () => flightPickCbs.delete(cb)
    },
    onLevel(cb) {
      levelCbs.add(cb)
      return () => levelCbs.delete(cb)
    },
    setClickGuard(guard) {
      clickGuard = guard
    },
    goTo: (v) => goTo(v),
    onTopView(cb) {
      topCbs.add(cb)
      return () => topCbs.delete(cb)
    },
    setMarkers(points) {
      markers = points
      placeMarkers()
    },
    named,
    labelPoint,
    onMenu(cb) {
      menuCbs.add(cb)
      return () => menuCbs.delete(cb)
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      canvas.removeEventListener('pointermove', onHoverMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('contextmenu', onContext)
      freeCam.dispose()
      siteControls.dispose()
      globeControls.dispose()
      flightControls?.dispose()
      flight?.dispose()
      renderer.dispose()
      canvas.remove()
      fpsEl?.remove()
      if (testMode) delete (window as { __scene?: unknown }).__scene
    },
  }

  if (testMode) {
    const view: DebugView = {
      ready,
      deps,
      get level() {
        return level
      },
      get frame() {
        return frame
      },
      async load(siteId, utcMs) {
        const f = await deps.loadFrame(siteId, utcMs)
        await ready
        applyFrame(f)
      },
      setLevelNow(l) {
        setLevel(l, false)
      },
      placeSite: (az, el, distKm) => {
        level = 'site'
        setControls()
        placeSiteCam(az, el, distKm)
      },
      placeEye: (az, el) => {
        level = 'eye'
        setControls()
        placeEyeCam(az, el)
      },
      placeGlobe: (lat, lon, distKm) => {
        level = 'globe'
        setGlobeView(lat, lon, distKm)
      },
      defaultSite: () => {
        level = 'site'
        setSiteView()
      },
      defaultEye: (az) => {
        level = 'eye'
        setEyeView(az)
      },
      setFov(fov) {
        viewVersion++
        baseFov = fov
        for (const c of [siteCam, globeCam]) {
          c.fov = fov
          c.updateProjectionMatrix()
        }
      },
      sunAzEl: () => (sky ? (syncSkyForSite(), azElOfEnu(sky.worldDir('sun'))) : null),
      earthAzEl: () => (sky ? (syncSkyForSite(), azElOfEnu(sky.worldDir('earth'))) : null),
      renderNow() {
        render()
        notifyCamera()
      },
      project,
      projectPin(siteId) {
        if (!globe) return null
        globe.updatePins(globeCam, size.y)
        const top = globe.pinSurface(siteId)
        return top ? toScreen(top, globeCam) : null
      },
      pinSurface: (id) => globe?.pinSurface(id) ?? null,
      setGlobeTexture: (m) => globe?.setTexture(m),
      setSites(sites) {
        deps.sites = sites
        globe?.setSites(sites, frame?.site?.id ?? null)
      },
      terrainInfo: () => site.info(),
      setFlat(on) {
        site.setFlat(on)
        markDirty()
      },
      renderInfo: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
      surfaceDist: () => (top && topView ? topView.clearance() : (inSpace() ? globeRig : siteRig).surface(activeCam().position)),
      goTo: (v) => goTo(v, false),
      topView: () => top,
      named,
      surfaceAt(x, y) {
        const r = canvas.getBoundingClientRect()
        return surfaceAt(toNdc(r.left + x, r.top + y))
      },
      bodies() {
        if (!frame) return []
        if (top && topView) return (['moon', 'earth', 'sun'] as const).map((b) => ({ name: b, center: topView!.worldPos(b).toArray(), camera: topView!.camera.position.toArray() }))
        return [
          { name: 'moon', center: [0, 0, 0], camera: inSpace() ? globeCam.position.toArray() : sitePoseInMe().p.toArray() },
          { name: 'earth', center: frame.state.earth_km, camera: inSpace() ? globeCam.position.toArray() : sitePoseInMe().p.toArray() },
          { name: 'sun', center: frame.state.sun_km, camera: inSpace() ? globeCam.position.toArray() : sitePoseInMe().p.toArray() },
        ]
      },
      projectMark(index) {
        if (!globe) return null
        if (inSpace()) {
          globe.updatePins(globeCam, size.y)
          const head = globe.markTop(index)
          return head ? toScreen(head, globeCam) : null
        }
        site.updateMarks(siteCam, size.y)
        const head = site.markTop(index)
        return head ? toScreen(head, siteCam) : null
      },
      terrainAt(x, y) {
        const r = canvas.getBoundingClientRect()
        const p = site.pick(toNdc(r.left + x, r.top + y), siteCam)
        return p ? { x: p.x, y: p.y, z: site.groundZ(p.x, p.y) } : null
      },
      skySize: (b) => sky?.sizeRatio(b) ?? null,
      camera() {
        const cam = activeCam()
        cam.updateMatrixWorld(true)
        const f = new Vector3()
        cam.getWorldDirection(f)
        const view = inSpace() ? latLonOf(cam.position) : azElOfEnu(f)
        return {
          level,
          units: inSpace() ? 'MOON_ME km' : 'ENU m',
          position: cam.position.toArray(),
          quaternion: cam.quaternion.toArray(),
          forward: f.toArray(),
          fov: cam.fov,
          aspect: cam.aspect,
          width: size.x,
          height: size.y,
          view,
          distKm: inSpace() ? cam.position.length() : cam.position.length() / 1000,
        }
      },
    }
    installDebug(view)
  }

  return handle
}
