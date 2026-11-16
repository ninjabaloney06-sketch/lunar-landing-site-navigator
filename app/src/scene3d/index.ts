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
  MathUtils,
  MOUSE,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Ray,
  SRGBColorSpace,
  Sphere,
  TOUCH,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Horizon, Site, TerrainTile } from '../data/types'
import type { MissionPlan } from '../flight/types'
import { qconj, qrot, scale } from '../flight/vec'
import {
  MOON_RADIUS_KM,
  OBSERVER_HEIGHT_M,
  angRadiusDeg,
  azEl,
  discFraction,
  enuBasis,
  maskAt,
  siteVector,
  type BodyState,
} from '../geometry'
import { loadCap } from '../data/southcap'
import { loadTextures } from './assets'
import { siteLevelClick } from './click'
import { easeShare, installFreeCam, type Rig } from './controls'
import { installDebug, type DebugView } from './debug'
import { Dissolve } from './dissolve'
import { DEFAULT_LAYERS, FlightWorld, type BodyPick, type FlightAnchor, type FlightLayers } from './flight'
import { EARTH_RADIUS_KM, SUN_RADIUS_KM, azElOfEnu, enuDir, enuToMeQuat, latLonOf, quat, v3 } from './frames'
import { GlobeWorld } from './globe'
import { POI_AT_SITE_KM, POI_NEAR_KM, type PinItem } from './pins'
import { createZoomSwitch } from './zoomSwitch'
import { SiteWorld } from './site'
import { inPinRegion } from './region'
import { Sky } from './sky'
import { eyeVisibility } from './visibility'

export { POI_AT_SITE_KM, POI_NEAR_KM } from './pins'

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
  /** Sun and Earth only: the site's computed horizon mask hides the body from the site (drawn hollow); false or absent otherwise. */
  belowHorizon?: boolean
}

/** What project() and labelPoint() place a label for. */
export type SceneLabel = 'sun' | 'earth' | 'site'

/** Named camera positions (Brief C4 part 2). Since U14 (ninja, 15 Nov) only the Moon: the point start / end, Earth,
 *  Sun and solar-system top views were removed. */
export type Viewpoint = 'moon'

/** A user point as the scene draws it: a place on the Moon, planetocentric MOON_ME degrees. */
export interface ScenePoint {
  name: string
  lat: number
  lon: number
  role?: 'start' | 'end' | null // no longer read by the scene (U14 removed the point viewpoints; U10 removes roles)
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
  /** Set when the thing under the pointer is a point of interest (ScenePoi.id); absent for site pins and user points. */
  poiId?: string
}

/** A point of interest as the scene draws it: a coloured pin. Planetocentric MOON_ME degrees, east-positive. */
export interface ScenePoi {
  id: string
  name: string
  lat: number
  lon: number
  color: string // CSS hex
  /** Landing-site records are drawn with the site-pin shape, the others with the POI shape. */
  landing: boolean
}

export interface SceneHandle {
  ready: Promise<void>
  update(frame: SceneFrame): void
  setLevel(level: SceneLevel): void
  /**
   * 'site' = mast top, for the "Landing site" label. (The 'moon' label, for the Moon seen from the Earth and Sun
   * viewpoints, went with them in U14: the camera no longer gets farther from the Moon than the globe view.)
   */
  project(name: SceneLabel): ScreenPoint | null
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
  /** The scene changed level by itself: a walk ends at eye level, the Moon viewpoint ends at 'globe'. */
  onLevel(cb: (level: SceneLevel) => void): () => void
  /** Asked before a click on the scene acts (select a pin, walk); false = ignore this click. */
  setClickGuard(guard: (() => boolean) | null): void
  /** Whether a double-click on terrain walks the camera there (to eye level). The app switches it off: the eye-level
   *  view was removed from the app on 15 Nov; the harness keeps it. */
  setWalkEnabled(on: boolean): void
  /** Whether zooming past a limit changes the view (zoomSwitch.ts): in at the Moon's floor opens the landing-site
   *  view, out at the site's outer limit goes back to the Moon; onLevel reports it. Off until the page asks. */
  setZoomSwitch(on: boolean): void
  /** Flies to a viewpoint; false when it is not available (nothing loaded yet, a fly running, the flight level). */
  goTo(v: Viewpoint): boolean
  /** Flies the space camera to above a point of the Moon (planetocentric degrees), from any level; ends at 'globe'. */
  goToPoint(lat: number, lon: number): boolean
  /**
   * The app chose another landing site and will deliver its frame when the data is loaded (a custom site's terrain
   * takes seconds). Until that frame is there, no fly goes down to the site that is still loaded (15 Nov: the camera
   * waited, then zoomed in on the old site); from space the camera turns to above (lat, lon) meanwhile. null: the
   * site's data did not load, go on with the site that is loaded.
   */
  expectSite(id: string | null, lat?: number, lon?: number): void
  setMarkers(points: ScenePoint[]): void
  /** The site pin or user point under the pointer (hover, or the last tap), with its screen position. */
  named(): SceneName | null
  /** project(), except that a Sun, Earth or Moon disc wider than 40 px is labelled at its top edge, not its centre. */
  labelPoint(name: SceneLabel): ScreenPoint | null
  /** A right-click (or long press) on the scene. The browser's own menu is always suppressed. */
  onMenu(cb: (m: SceneMenu) => void): () => void
  /**
   * Points of interest to draw; [] draws none. On the globe every given point is drawn. At site and eye level
   * only those near the current site are drawn (and the other landing-site pins near it). named() reports a
   * hovered or tapped one with its poiId.
   */
  setPois(pois: ScenePoi[]): void
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
// A click walks only where the terrain is drawn from the fine model: within 20 km of the site (80 m cells or
// finer; beyond, 160 m to 2 km means). Farther out the camera stood 1.75 m above a mesh of cells hundreds of metres
// wide: one smooth ramp filling the picture, reported on 15 Nov as being "shoved under the ground" (measured
// there: eye 1.75 m above the drawn ground and within 2 m of the data height; the picture, not the height, was
// wrong).
const WALK_MAX_KM = 20
// A walk needs a double-click (two clicks within this time and distance): a single click on the ground used to
// send the camera off to eye level, which first-time users did by accident (feedback of 15 Nov).
const DOUBLE_CLICK_MS = 450
const DOUBLE_CLICK_PX = 12
const GLOBE_DIST_KM = { min: 3000, max: 20000, default: 6500 }
const EYE_DEFAULT_EL = 3
const EYE_FOV_MIN = 4 // narrowest lens at eye level, vertical degrees; the widest is the default field of view
const EYE_ROTATE_SPEED = -0.3 // drag the view, not the camera
const MOON_FLOOR_KM = 1 // the space camera stays this far above the 1737.4 km sphere (its near plane is 0.5 km)
const BODY_FLOOR = 1.05 // and outside 1.05 radii of Earth and the Sun
const ZOOM_SWITCH_MOON_KM = 500 // a continued zoom-in below this height above the Moon's sphere opens the site view (the floor is not needed: it is about 55 notches from the default view)
const FREE_MIN_DIST = 1e-4 // orbit distance limit once the wheel or a look-around has moved the camera
const BODY_OUTER = GLOBE_DIST_KM.max / MOON_RADIUS_KM // outer zoom limit around a body, in its radii: the Moon's 20 000 km
const MOON_RADIUS_M = MOON_RADIUS_KM * 1000
const FLY_MS = 1500
// The fly between the globe and the site (S3). Longer than the other flights: it covers a factor of about 280 in
// distance, and at 2.4 s the picture never grows by more than about 12 % from one 60 Hz frame to the next.
const DESCENT_MS = 2400
const DESCENT_RANGE = 300 // the ratio of start to end distance the 2.4 s are for; a larger one takes longer in proportion to its logarithm
// Share of the way toward the site over which the site scene fades in over the space scene. With the default
// views the camera is about 270 km above the surface at 0.5 and about 17 km at 0.92, where the ±300 km of terrain
// around the site fill the picture to the horizon; the fade takes about half a second.
const DISSOLVE_FROM = 0.5
const DISSOLVE_TO = 0.92
const LIGHT_EASE_MS = 500 // a change of the terrain light level (a jump of the time cursor) is spread over this long
const AWAIT_SITE_MS = 2000 // longest the fly to a just-picked site waits for that site's data
const NEAR_CACHE = 6 // near terrain levels kept for sites visited before (0.5 MB each)
const MAX_FRAME_MS = 100 // a longer gap between two frames (hidden tab, a stall) counts as this much time
const EARTHSHINE = 0.06 * Math.PI // faint fill at full Earth; scaled by Earth's phase, zero when Earth is hidden
const BACKGROUND = 0x0b0d11
const SITE_PIN_COLOR = 0xf2efe8 // the head of the globe's site pins (globe.ts)
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
  ms: number
  /** Puts the camera where it is at eased progress e (0 = start, 1 = end). */
  place: (e: number) => void
  /**
   * Set for the fly between the two scenes: what the site scene shows meanwhile (the terrain of the level at
   * its site end, the mast, the ground cross) and its share of the picture, 0 = space scene only, 1 = site scene only.
   */
  site: { eye: boolean; mast: boolean; cross: boolean; mix: number; toSite: boolean } | null
  done: () => void
}

/** A camera pose in the space scene: position in MOON_ME km and orientation. */
interface Pose {
  p: Vector3
  q: Quaternion
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2) // cubic, every flight

/** The parts of three 0.170's OrbitControls that say whether update() has anything to apply (state −1 = idle). */
interface OrbitInternals {
  state: number
  _sphericalDelta: { theta: number; phi: number; set(r: number, phi: number, theta: number): void }
  _panOffset: Vector3
  _scale: number
}
// An orbit glide ends once less than this is left of its turn, rad: 0.06 mm at the 60 km outer orbit.
const ORBIT_REST = 1e-9
// The space camera's floor (MOON_FLOOR_KM) is restored only when it is this far below it, km: setLength() itself
// may land a unit in the last place under the floor, which must not count as a new violation every frame.
const FLOOR_TOLERANCE_KM = 1e-9

/** Frees the GPU resources of everything under root: geometries, materials and the textures they use. */
function disposeTree(root: Object3D) {
  root.traverse((o) => {
    const { geometry, material } = o as Object3D & { geometry?: { dispose(): void }; material?: Material | Material[] }
    geometry?.dispose()
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      for (const v of Object.values(m)) if (v instanceof Texture) v.dispose()
      m.dispose()
    }
  })
}

/** Throws when WebGL is unavailable; C2 then shows the horizon strip and the sentence. */
export function mountScene(container: HTMLElement, deps: SceneDeps): SceneHandle {
  if (!webglAvailable()) throw new Error('WebGL is not available')
  const params = new URLSearchParams(window.location.search)
  const testMode = params.has('test')
  const debug = params.has('debug')
  // Easing (input smoothing, flights). Off in test mode, where every change lands in the frame that asks for it;
  // a test turns it on through the debug API and then steps the clock itself.
  let animated = !testMode
  // prefers-reduced-motion: no easing, no fly between the scenes, no fade of the light: every change lands at once
  // (the same as test mode without setAnimated). Followed live: the query's change event re-applies the damping.
  const reducedQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  const motion = () => animated && !reducedQuery?.matches
  // The animation clock: the wall clock, except in test mode, where it stands still until debug.advance(ms).
  let clockMs = 0
  const nowMs = () => (testMode ? clockMs : performance.now())

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
    c.enableDamping = motion()
    c.dampingFactor = 0.1 // replaced every frame by the share for that frame's length (tick)
    // OrbitControls keeps the left drag and the one-finger drag only. Middle, right, wheel and pinch belong
    // to controls.ts and the viewpoint menu (three 0.170: a null action leaves the control idle).
    c.enableZoom = false
    c.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: null, RIGHT: null }
    c.touches = { ONE: TOUCH.ROTATE, TWO: null }
  }
  globeControls.rotateSpeed = 0.5
  // The Moon view is turned by turnGlobe below, not by OrbitControls: OrbitControls orbits around the camera's up
  // axis (MOON_ME north) and stops when the camera is over a pole, which is where this app's sites are (tester
  // feedback, 15 Nov: "at a certain point you cannot go on and have to turn another way").
  globeControls.mouseButtons = { LEFT: null, MIDDLE: null, RIGHT: null }
  globeControls.touches = { ONE: null, TWO: null }
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
  let markers: ScenePoint[] = []
  let pois: ScenePoi[] = []
  // The site pin, user point or point of interest whose name is shown: under the mouse, or last tapped.
  type Named = { kind: 'site'; id: string } | { kind: 'point'; index: number } | { kind: 'poi'; id: string }
  let hover: Named | null = null
  const site = new SiteWorld()
  let siteKm = new Vector3()
  let enuToMe = new Quaternion()
  let meToEnu = new Quaternion()
  let fly: Fly | null = null
  // Where the eye-level camera stands after a walk (ENU m, eye point); null = on the landing site.
  let stand: Vector3 | null = null
  // The eye point of the eye-level camera as last placed (eyeAt), on the site or where it stands; settleEye keeps it there.
  const eyeBase = new Vector3(0, 0, OBSERVER_HEIGHT_M)
  let dirty = true
  let viewVersion = 0 // bumped whenever the picture may change; project() caches per version
  let wanted: SceneLevel | null = null // setLevel request that arrived before a site frame or during a fly
  // A click on another site's pin on the globe: the app asks for the site view at once and delivers that site's
  // frame a moment later. The fly waits for the frame (at most AWAIT_SITE_MS), so it goes to the right site.
  let awaiting: { id: string; until: number } | null = null
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
  const menuCbs = new Set<(m: SceneMenu) => void>()

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

  // A lost WebGL context takes the picture with it; three restores its own state and re-uploads on the next draw,
  // but the loop draws only a dirty frame, so after a restore the canvas stayed black until the user moved.
  const onContextRestored = () => markDirty()
  canvas.addEventListener('webglcontextrestored', onContextRestored)

  // Another screen (a window dragged between monitors, a browser zoom step) changes devicePixelRatio without
  // changing the container's CSS size, so the ResizeObserver stays silent: the canvas kept the old buffer size.
  let dprQuery: MediaQueryList | null = null
  const onPixelRatio = () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    resize()
    watchPixelRatio()
  }
  function watchPixelRatio() {
    dprQuery?.removeEventListener('change', onPixelRatio)
    dprQuery = typeof window.matchMedia === 'function' ? window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`) : null
    dprQuery?.addEventListener('change', onPixelRatio)
  }
  watchPixelRatio()

  const inSpace = () => level === 'globe' || (fly !== null && fly.cam === globeCam)
  const activeCam = () => (level === 'flight' ? flightCam : inSpace() ? globeCam : siteCam)
  // Eye-level terrain (mask ring or crest strip) is built for the landing site's eye point only: after a walk
  // the site-level terrain is drawn and the mast is shown again, as from any other place. During the fly
  // between the scenes the site scene keeps what its end of the fly shows.
  const eyeTerrain = () => (fly?.site ? fly.site.eye : level === 'eye' && !stand)
  const showMast = () => (fly?.site ? fly.site.mast : level === 'site' || (level === 'eye' && stand !== null))
  const showCross = () => (fly?.site ? fly.site.cross : level === 'site')
  const dissolve = new Dissolve()
  const setFov = (cam: PerspectiveCamera, fov: number) => {
    if (cam.fov === fov) return
    cam.fov = fov
    cam.updateProjectionMatrix()
  }

  function setControls() {
    globeControls.enabled = level === 'globe' && !fly
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
  // The Moon's surface under a space-camera position, km from its centre: the cap's relief south of its edge
  // (wave 3), the 1737.4 km sphere elsewhere.
  const moonGround = (p: Vector3) => globe?.groundRadius(p) ?? MOON_RADIUS_KM
  const bodiesKm = () => (frame ? [v3(frame.state.earth_km), v3(frame.state.sun_km)] : [])
  const groundBelow = (p: Vector3) => site.groundZ(p.x, p.y)

  const siteRig: Rig = {
    cam: siteCam,
    ctl: siteControls,
    mode: 'dolly',
    surface: (p) => p.z - groundBelow(p),
    allowed: (p) => p.z - groundBelow(p) >= site.eyeHeight - 1e-9,
    reach: (p) => p.length() / (SITE_DIST_KM.max * 1000),
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
      const moon = p.length() - moonGround(p)
      return e ? Math.min(moon, p.distanceTo(e) - EARTH_RADIUS_KM, p.distanceTo(s) - SUN_RADIUS_KM) : moon
    },
    allowed(p) {
      const [e, s] = bodiesKm()
      if (p.length() < moonGround(p) + MOON_FLOOR_KM) return false
      return !e || (p.distanceTo(e) >= EARTH_RADIUS_KM * BODY_FLOOR && p.distanceTo(s) >= SUN_RADIUS_KM * BODY_FLOOR)
    },
    // The Moon's limit is its orbit maximum, 20 000 km from its centre; Earth and the Sun get the same number of
    // their own radii (11.5).
    reach(p) {
      const [e, s] = bodiesKm()
      const moon = p.length() / GLOBE_DIST_KM.max
      return e ? Math.min(moon, p.distanceTo(e) / (EARTH_RADIUS_KM * BODY_OUTER), p.distanceTo(s) / (SUN_RADIUS_KM * BODY_OUTER)) : moon
    },
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

  /** The camera the wheel and the middle drag act on; null while a fly runs. */
  function rig(): Rig | null {
    if (fly || !frame || level === 'flight') return null
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
    if (level === 'globe' && free.globe.dist) {
      const floor = moonGround(globeCam.position) + MOON_FLOOR_KM
      if (globeCam.position.length() < floor - FLOOR_TOLERANCE_KM) {
        globeCam.position.setLength(floor)
        return true
      }
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

  const NO_TURN = new Quaternion()
  /** Sky for the flight level: stars fixed in J2000 and the Sun where the plan's ephemeris puts it. */
  function flightSkyState(): BodyState | null {
    if (!flightPlan) return frame?.state ?? null
    const q = flightPlan.ephem.moonFixedToInertial(flightMs)
    const sunMe = scale(qrot(qconj(q), flightPlan.ephem.sunDir(flightMs)), AU_KM)
    return { utcMs: flightMs, sun_km: sunMe, earth_km: [384400, 0, 0], q_me_to_j2000: q, q_earth_to_me: [0, 0, 0, 1] }
  }

  function syncSky(which: 'space' | 'site' = inSpace() ? 'space' : 'site') {
    if (sky && level === 'flight') {
      const st = flightSkyState()
      if (st) sky.update(st, ORIGIN, quat(st.q_me_to_j2000))
      sky.setBelowHorizon({ sun: false, earth: false })
      sky.syncCamera(flightCam)
      return
    }
    if (!sky || !frame) return
    sky.showBodies(true)
    if (which === 'space') sky.update(frame.state, globeCam.position, NO_TURN)
    else sky.update(frame.state, siteKm, meToEnu)
    // At site and eye level a body the computed mask hides from the site is drawn hollow, wherever the camera
    // stands (the orbit camera looks over ridges the eye cannot). In space the Sun and Earth are just where they are.
    if (which === 'site' && frame.site) {
      const v = eyeVisibility(frame.state, frame.site, frame.horizon)
      sky.setBelowHorizon({ sun: v.sun.fraction <= 0, earth: v.earth.fraction <= 0 })
    } else sky.setBelowHorizon({ sun: false, earth: false })
    sky.syncCamera(which === 'space' ? globeCam : siteCam)
  }

  // Terrain light levels as drawn: they ease toward the computed ones, so a jump of the time cursor across a
  // sunset fades over LIGHT_EASE_MS instead of switching in one frame (ease-out: a change every frame, as while
  // the time plays, is followed without stalling). The directions and every computed number are never eased.
  const light = { sun: 1, earth: 0, from: { sun: 1, earth: 0 }, to: { sun: 1, earth: 0 }, t0: 0, easing: false }
  function setLightLevels(sun: number, earth: number, snap: boolean) {
    if (snap || !motion()) {
      light.easing = false
      light.sun = sun
      light.earth = earth
    } else if (sun !== light.to.sun || earth !== light.to.earth || !light.easing) {
      light.from = { sun: light.sun, earth: light.earth }
      light.t0 = nowMs()
      light.easing = sun !== light.sun || earth !== light.earth
    }
    light.to = { sun, earth }
    site.setLevels(light.sun, light.earth)
  }
  function stepLight() {
    const x = Math.min((nowMs() - light.t0) / LIGHT_EASE_MS, 1)
    const e = 1 - (1 - x) * (1 - x)
    light.sun = light.from.sun + (light.to.sun - light.from.sun) * e
    light.earth = light.from.earth + (light.to.earth - light.from.earth) * e
    if (x >= 1) light.easing = false
    site.setLevels(light.sun, light.earth)
    markDirty()
  }

  /** snap: the levels land at once (a new site, the first frame), whatever the easing. */
  function applyLights(snap = false) {
    if (!sky || !frame || !globe) return
    // Site lights from the site's point of view (topocentric), globe lights from the Moon centre.
    sky.update(frame.state, siteKm, meToEnu)
    site.setLights(sky.worldDir('sun'), sky.worldDir('earth'), angRadiusDeg(SUN_RADIUS_KM, v3(frame.state.sun_km).distanceTo(siteKm)))
    // How much of each disc is above the terrain mask from the eye: geometry's own disc fraction, the number the
    // answer and the percentages are computed from (sunlit = fraction > 0), read here and never written. The
    // terrain light follows it, so a sunset dims for as long as the disc takes to cross the mask.
    let sunFrac = 1
    let earthFrac = 0
    if (frame.site) {
      const v = eyeVisibility(frame.state, frame.site, frame.horizon)
      sunFrac = v.sun.fraction
      earthFrac = v.earth.fraction
    }
    setLightLevels(sunFrac, EARTHSHINE * sky.earthPhase * earthFrac, snap)
    const sunM = v3(frame.state.sun_km).normalize()
    const earthM = v3(frame.state.earth_km).normalize()
    globe.setLights(sunM, earthM, EARTHSHINE * 0.5 * sky.earthPhase)
    syncSky()
  }

  function applyFrame(f: SceneFrame) {
    const siteChanged = !builtFor || builtFor.site?.id !== f.site?.id
    // The fly between the scenes ends at the site that is being replaced. On the way down, before the site
    // scene is in the picture, it turns to the new site from where the camera is (the app asks for the site
    // view first and delivers the site's frame a moment later); otherwise it ends at once.
    const retarget = siteChanged && f.site !== null && fly?.site?.toSite === true && fly.site.mix === 0
    if (siteChanged && fly?.site && !retarget) finishFly()
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
      settleEye()
      placeMarkers()
      placePois()
      requestNear()
    }
    globe?.setSites(deps.sites, f.site?.id ?? null)
    applyLights(siteChanged)
    if (!f.site && level !== 'globe' && level !== 'flight') {
      level = 'globe'
      fly = null
      setGlobeView()
    } else if (siteChanged && level === 'eye') setEyeView()
    else if (siteChanged && level === 'site') setSiteView()
    if (awaiting && f.site?.id === awaiting.id) {
      // The picked site is here: now the fly (or, in test mode, the change of level) that was asked for.
      awaiting = null
      if (wanted && !fly) setLevel(wanted)
    } else if (wanted && f.site && !fly && !awaiting) setLevel(wanted, false)
    if (retarget) {
      fly = null
      descendToSite()
    }
    setControls()
    markDirty()
  }

  // ---------- the near terrain level (wave 3) ----------

  // A prepared site's files have no near level (160 m to ±40 km, between the 80 m tile and mid): it is built from
  // the south-cap 80 m tiles (data/southcap.ts nearLevel) after the site is shown, and the terrain is built once
  // more with it, never during a fly (then when the fly ends). The first picture never waits for it; without the
  // cap data nothing changes. A custom point's cap terrain has the level already. In test mode it is fetched only
  // after __scene.nearLevel(true), so every other test sees the same terrain on every run.
  let nearOn = !testMode
  let nearJob: Promise<void> = Promise.resolve()
  let nearWaiting: TerrainTile | null = null
  const nearCache = new Map<string, TerrainTile>()

  function requestNear() {
    const s = frame?.site
    const t = frame?.terrain
    if (!nearOn || !s || !t?.levels?.length || t.levels.some((l) => l.meta.level === 'near') || typeof t.meta.ground_m !== 'number' || !inPinRegion(s.lat)) return
    const id = t.meta.site_id
    const ground = t.meta.ground_m
    const known = nearCache.get(id)
    nearJob = (known ? Promise.resolve(known) : loadCap().then((c) => c.nearLevel(s.lat, s.lon, ground, id)))
      .then((near) => {
        if (!near || disposed) return
        if (!known) {
          nearCache.set(id, near)
          if (nearCache.size > NEAR_CACHE) nearCache.delete(nearCache.keys().next().value as string)
        }
        // The site may have changed while the tiles came in.
        if (builtFor?.site?.id !== s.id || builtFor.terrain?.meta.site_id !== id) return
        const withNear: TerrainTile = { ...t, levels: [...(t.levels ?? []), near] }
        if (fly) nearWaiting = withNear
        else applyNear(withNear)
      })
      .catch(() => undefined)
  }

  /** The site's terrain once more, with the near level; what stands on it is placed again. */
  function applyNear(t: TerrainTile) {
    nearWaiting = null
    if (!frame?.site || !builtFor || builtFor.terrain?.meta.site_id !== t.meta.site_id) return
    site.build(frame.horizon, t, frame.site.elev_m)
    builtFor = { ...builtFor, terrain: t }
    placeMarkers()
    placePois()
    // The eye-level camera stands on the new ground (a finer level may be higher under it).
    settleEye()
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

  // ---------- points of interest ----------

  /**
   * The globe gets every point of interest it was given. The site scene gets those within POI_NEAR_KM of the
   * current site, and the other landing sites within the same distance, each standing on the terrain.
   */
  function placePois() {
    globe?.setPois(pois)
    const items: PinItem[] = []
    const here = frame?.site
    if (here) {
      const at = v3(siteVector(here.lat, here.lon, 0))
      const add = (kind: PinItem['kind'], id: string, name: string, lat: number, lon: number, color: string | number, shape: PinItem['shape']) => {
        // Ground distance as the chord on the 1737.4 km sphere (shorter than the arc by 0.005 % at 60 km). A pin on the
        // site itself is left to the mast (POI_AT_SITE_KM).
        const km = v3(siteVector(lat, lon, 0)).distanceTo(at)
        if (km > POI_NEAR_KM || km < POI_AT_SITE_KM) return
        const grid = gridOf(lat, lon)
        if (!grid) return
        const { pos, up } = site.groundAt(grid.x, grid.y)
        items.push({ kind, id, name, shape, base: pos, up, color, grid })
      }
      for (const s of deps.sites) if (s.id !== here.id) add('site', s.id, s.name, s.lat, s.lon, SITE_PIN_COLOR, 'site')
      for (const p of pois) add('poi', p.id, p.name, p.lat, p.lon, p.color, p.landing ? 'site' : 'poi')
    }
    site.setNear(items)
    const h = hover
    if (h?.kind === 'poi' && !pois.some((p) => p.id === h.id)) hover = null
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
    freeCam.cancel()
    free.site = { dist: false, look: false }
    stand = null
    resetZoom()
    setControls()
    siteCam.position.copy(enuDir(az + 180, el)).multiplyScalar(distKm * 1000)
    // A pose set from outside (setView, a saved or linked camera) may lie under the terrain: raise the elevation on
    // the same orbit until the camera clears the ground by the floor the mouse input keeps (siteRig.allowed).
    if (!siteRig.allowed(siteCam.position)) {
      let lo = el
      let hi = 90
      const at = (e: number) => enuDir(az + 180, e).multiplyScalar(distKm * 1000)
      if (siteRig.allowed(at(hi - 0.01))) {
        for (let i = 0; i < 30; i++) {
          const mid = (lo + hi) / 2
          if (siteRig.allowed(at(mid))) hi = mid
          else lo = mid
        }
        siteCam.position.copy(at(hi))
      } else siteCam.position.z = groundBelow(siteCam.position) + site.eyeHeight
    }
    siteControls.target.set(0, 0, 0)
    siteCam.lookAt(siteControls.target)
    siteControls.update()
  }

  /** The site camera at rest under ground that was just rebuilt (finer level arrived): back onto the floor. */
  function settleSite(): boolean {
    if (level !== 'site' || fly || siteRig.allowed(siteCam.position)) return false
    siteCam.position.z = groundBelow(siteCam.position) + site.eyeHeight
    siteCam.updateMatrixWorld(true)
    viewVersion++
    return true
  }

  /**
   * THE eye-level placement (U5, U16, U19): the eye point OBSERVER_HEIGHT_M above the drawn terrain at ENU (x, y)
   * (site.groundZ: the triangles of the finest level loaded there, not the bilinear data height). On the landing
   * site never lower than the eye the horizon mask and the eye-level crests were computed for (1.75 m above the
   * site's ground height): where the site is a quad centre (the south-cap 80 m grid of a custom point) the drawn
   * ground there may lie below or above that height.
   */
  function eyeAt(x: number, y: number): Vector3 {
    const z = site.groundZ(x, y) + site.eyeHeight
    return new Vector3(x, y, x === 0 && y === 0 ? Math.max(z, site.eyeHeight) : z)
  }

  /**
   * Keeps the eye-level camera at eye height over the ground under it when that ground changes under a camera at
   * rest: a terrain rebuild for the same site, the near level arriving later (applyNear). Moves the camera and its
   * target by the same step, so the view direction is kept. Not during a fly, which owns the camera.
   */
  function settleEye(): boolean {
    if (level !== 'eye' || fly) return false
    const dz = eyeAt(eyeBase.x, eyeBase.y).z - eyeBase.z
    if (Math.abs(dz) < 1e-6) return false
    eyeBase.z += dz
    if (stand) stand.z += dz
    siteCam.position.z += dz
    siteControls.target.z += dz
    siteCam.updateMatrixWorld(true)
    viewVersion++
    return true
  }

  /** Eye level at the site (at = null) or standing at ENU (at.x, at.y), looking toward az at elevation el; the height is eyeAt's. */
  function placeEyeCam(az: number, el: number, at: Vector3 | null = null) {
    viewVersion++
    freeCam.cancel()
    free.site = { dist: false, look: false }
    const eye = at ? eyeAt(at.x, at.y) : eyeAt(0, 0)
    stand = at ? eye.clone() : null
    eyeBase.copy(eye)
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
    freeCam.cancel()
    free.globe = { dist: false, look: false }
    setControls()
    const sunLon = frame ? latLonOf(v3(frame.state.sun_km)).lon : 0
    const la = lat ?? -60
    const lo = lon ?? sunLon + 50
    const d = distKm ?? GLOBE_DIST_KM.default
    globeCam.position.copy(v3(siteVector(la, lo, d - MOON_RADIUS_KM)))
    globeControls.target.set(0, 0, 0)
    globeCam.up.set(0, 0, 1) // a placed view is upright (north up) again, whatever a drag over a pole left
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
    c.enableDamping = !testMode && !reducedQuery?.matches
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

  /** Site-camera pose expressed in MOON_ME km (for the fly between the two scenes). */
  function sitePoseInMe(): { p: Vector3; q: Quaternion } {
    const p = siteCam.position.clone().multiplyScalar(0.001).applyQuaternion(enuToMe).add(siteKm)
    const q = enuToMe.clone().multiply(siteCam.quaternion)
    return { p, q }
  }

  /**
   * An orbit drag still gliding when a fly starts would wait in the controls (nothing reads them during the fly)
   * and play out after the landing: it ends here. three 0.170 keeps it in OrbitControls' _sphericalDelta.
   */
  function stopGlide() {
    for (const c of [siteControls, globeControls]) (c as unknown as OrbitInternals)._sphericalDelta.set(0, 0, 0)
  }

  /**
   * True while OrbitControls has something to apply: a drag in progress, a glide left after one, a zoom or pan
   * step. A glide whose remaining turn is below ORBIT_REST rad ends here (three 0.170 keeps it in _sphericalDelta
   * and only ever shrinks it, so it would otherwise last for minutes of invisible steps).
   */
  function orbitBusy(c: OrbitControls): boolean {
    const o = c as unknown as OrbitInternals
    const d = o._sphericalDelta
    if (o.state === -1 && (d.theta !== 0 || d.phi !== 0) && Math.abs(d.theta) < ORBIT_REST && Math.abs(d.phi) < ORBIT_REST) d.set(0, 0, 0)
    return o.state !== -1 || d.theta !== 0 || d.phi !== 0 || o._scale !== 1 || o._panOffset.lengthSq() > 0 || c.autoRotate
  }

  /** k > 1: the remaining distance shrinks geometrically (long flights between bodies); 1: plain ease. */
  function startFly(p0: Vector3, q0: Quaternion, p1: Vector3, q1: Quaternion, done: () => void, cam: PerspectiveCamera = globeCam, k = 1) {
    const place = (e: number) => {
      // Between bodies the remaining distance shrinks geometrically, so the destination grows through the whole
      // flight instead of in its last frames.
      const along = k > 1.001 ? 1 - (k ** (1 - e) - 1) / (k - 1) : e
      cam.position.lerpVectors(p0, p1, along)
      cam.quaternion.slerpQuaternions(q0, q1, e)
      // A walk never cuts through a hill on its way.
      if (cam === siteCam) siteCam.position.z = Math.max(siteCam.position.z, groundBelow(siteCam.position) + site.eyeHeight)
    }
    stopGlide()
    fly = { cam, t0: nowMs(), ms: FLY_MS, place, site: null, done }
    setControls()
    markDirty()
  }

  /** The site camera as it stands, for the ground end of the fly between the scenes. */
  function groundEnd() {
    return {
      ...sitePoseInMe(),
      // Distance to what the camera looks at, km: the scale the fly ends on (17 km in the default site view).
      distKm: Math.max(siteCam.position.distanceTo(siteControls.target) / 1000, 1),
      fov: siteCam.fov,
      shown: { eye: eyeTerrain(), mast: showMast(), cross: showCross() },
    }
  }

  /** The space camera's pose in the site scene's frame and unit, so both scenes are drawn from the same place. */
  function syncSiteCam() {
    siteCam.position.copy(globeCam.position).sub(siteKm).applyQuaternion(meToEnu).multiplyScalar(1000)
    siteCam.quaternion.multiplyQuaternions(meToEnu, globeCam.quaternion)
    setFov(siteCam, globeCam.fov)
    siteCam.updateMatrixWorld(true)
  }

  /**
   * The fly between the globe and the site (S3), one continuous move, the same path in both directions.
   * `space` is its end above the Moon, `ground` its end at the site (both MOON_ME km); u runs from 0 at the
   * space end to 1 at the ground end.
   *   position: around the Moon on the great circle between the two directions from its centre, with the
   *     height falling in step, both by a(u) = (k − k^(1−u)) / (k − 1): what is left of the way shrinks
   *     geometrically, so the ground grows at an even rate instead of rushing up in the last frames, and the
   *     path never enters the Moon, wherever on the globe it starts.
   *   orientation: the space view carried around the Moon with the camera (the Moon stays in the picture as it
   *     turns underneath), then turned into the site view by s(u) = (k^u − 1) / (k − 1), which is the share
   *     that keeps the site near the middle of the picture: s ≈ 1 / (1 + remaining way / final distance).
   *   field of view: from the default lens to the site end's lens by s (only an eye-level zoom differs).
   *   picture: the site scene fades in over the space scene between DISSOLVE_FROM and DISSOLVE_TO of u.
   * k = height of the space end above the Moon over the distance the site camera looks from.
   */
  function startDescent(space: Pose, ground: ReturnType<typeof groundEnd>, toSite: boolean, done: () => void) {
    const rHigh = space.p.length()
    const rLow = ground.p.length()
    const dirHigh = space.p.clone().normalize()
    const dirLow = ground.p.clone().normalize()
    const arc = new Quaternion().setFromUnitVectors(dirHigh, dirLow)
    const k = MathUtils.clamp((rHigh - MOON_RADIUS_KM) / ground.distKm, 1, 1e12)
    // Longer where there is more to cover, so no frame moves or turns more than in the default fly: more than a
    // quarter of the way around the Moon (to 1.4 times from the far side; half the chord between the two
    // directions is the sine of half the angle between them), and a larger range of distance (from eye level).
    const ms =
      DESCENT_MS * Math.max(1, dirHigh.distanceTo(dirLow) / 2 / Math.SQRT1_2) * Math.max(1, Math.log(k) / Math.log(DESCENT_RANGE))
    const part = new Quaternion()
    // The turn from the carried space view (once it has arrived above the site) into the site view: fixed for the
    // whole fly, so no frame chooses between two ways round.
    const turn = arc.clone().multiply(space.q).invert().multiply(ground.q)
    const partTurn = new Quaternion()
    const shown = { ...ground.shown, mix: toSite ? 0 : 1, toSite }
    stopGlide()
    const place = (e: number) => {
      const u = toSite ? e : 1 - e
      const a = k > 1.001 ? (k - k ** (1 - u)) / (k - 1) : u
      const s = k > 1.001 ? (k ** u - 1) / (k - 1) : u
      part.slerpQuaternions(NO_TURN, arc, a)
      globeCam.position.copy(dirHigh).applyQuaternion(part).multiplyScalar(rHigh + (rLow - rHigh) * a)
      globeCam.quaternion.multiplyQuaternions(part, space.q).multiply(partTurn.slerpQuaternions(NO_TURN, turn, s))
      setFov(globeCam, baseFov + (ground.fov - baseFov) * s)
      shown.mix = MathUtils.smoothstep(u, DISSOLVE_FROM, DISSOLVE_TO)
      syncSiteCam()
    }
    fly = {
      cam: globeCam,
      t0: nowMs(),
      ms,
      place,
      site: shown,
      done() {
        setFov(globeCam, baseFov)
        done()
      },
    }
    place(0)
    globeCam.updateMatrixWorld(true)
    setControls()
    markDirty()
  }

  /**
   * Walk (notebook note 6; ninja, 14 Nov): the camera goes to stand on the terrain at ENU (x, y), eye height
   * above it, facing the way it came. A camera move only: the site, the sky directions and every number stay
   * those of the landing site.
   */
  function walkTo(x: number, y: number, animate = motion(), faceSite = false): boolean {
    if (!frame?.site || fly || level === 'globe' || level === 'flight') return false
    if (Math.hypot(x, y) > SITE_DIST_KM.max * 1000) return false
    const from = { p: siteCam.position.clone(), q: siteCam.quaternion.clone() }
    const to = eyeAt(x, y)
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

  /** From where the space camera is down to the default view of the current site. */
  function descendToSite() {
    const from = { p: globeCam.position.clone(), q: globeCam.quaternion.clone() }
    level = 'site'
    setSiteView()
    const ground = groundEnd()
    const keep = { p: siteCam.position.clone(), q: siteCam.quaternion.clone() }
    // Drawn once now, from where the fly will end: the terrain is uploaded and its programs are compiled before
    // the clock of the fly starts, not in the middle of it. The frame that follows draws over it.
    site.setEyeMode(false)
    drawSite()
    level = 'globe' // the space camera leads the fly; the site scene fades in over it
    startDescent(from, ground, true, () => {
      level = 'site'
      siteCam.position.copy(keep.p)
      siteCam.quaternion.copy(keep.q)
      setFov(siteCam, ground.fov)
      siteControls.update()
    })
  }

  function stepFly(now: number) {
    if (!fly) return
    const t = Math.min((now - fly.t0) / fly.ms, 1)
    fly.place(easeInOut(t))
    fly.cam.updateMatrixWorld(true)
    markDirty()
    if (t >= 1) {
      finishFly()
      const next = wanted
      wanted = null // also when it is the level the fly ended at: a later frame must not apply it again
      if (next && next !== level) setLevel(next)
    }
  }

  /** Ends the running fly at its destination. */
  function finishFly() {
    if (!fly) return
    const done = fly.done
    fly = null
    done()
    if (nearWaiting) applyNear(nearWaiting)
    setControls()
    markDirty()
  }

  /** To a pose in the space scene, from wherever the camera is. `place` puts globeCam and its controls there. */
  function flyInSpace(place: () => void, animate: boolean) {
    const from = level === 'globe' ? { p: globeCam.position.clone(), q: globeCam.quaternion.clone() } : sitePoseInMe()
    const ground = level === 'globe' ? null : groundEnd()
    const was = level
    level = 'globe'
    wanted = null
    place()
    if (animate) {
      const to = { p: globeCam.position.clone(), q: globeCam.quaternion.clone() }
      const target = globeControls.target.clone()
      const arrive = () => {
        globeCam.position.copy(to.p)
        globeControls.target.copy(target)
        globeCam.lookAt(target)
        globeControls.update()
      }
      globeCam.position.copy(from.p)
      globeCam.quaternion.copy(from.q)
      const k = from.p.distanceTo(to.p) / Math.max(to.p.distanceTo(target), 1)
      // From the site to a view of the Moon: the fly between the scenes, backwards.
      if (ground && target.lengthSq() === 0) {
        drawSpace() // as in descendToSite: the globe is ready before the fly starts
        startDescent(to, ground, false, arrive)
      }
      else startFly(
        from.p,
        from.q,
        to.p,
        to.q,
        arrive,
        globeCam,
        k,
      )
    }
    setControls()
    markDirty()
    if (was !== 'globe') emitLevel('globe')
    notifyCamera()
  }

  /** The Moon viewpoint (U14: the only one left): the default globe view, flown to from wherever the camera is. */
  function goTo(v: Viewpoint, animate = motion()): boolean {
    if (!frame || !sky || !globe || fly || level === 'flight' || v !== 'moon') return false
    flyInSpace(() => setGlobeView(), animate)
    return true
  }

  /** The space camera to above (lat, lon): at the distance it has in space, the default one from the surface. */
  function goToPoint(lat: number, lon: number, animate = motion()): boolean {
    if (!frame || !sky || !globe || fly || level === 'flight') return false
    const dist = level === 'globe' ? globeCam.position.length() : GLOBE_DIST_KM.default
    flyInSpace(() => setGlobeView(lat, lon, dist), animate)
    return true
  }

  function expectSite(id: string | null, lat?: number, lon?: number) {
    // The first frame is not waited for here (setLevel keeps the request until it comes, and applies it without a fly).
    if (!frame?.site) return
    if (id === null || frame.site.id === id) {
      // Nothing (more) to wait for: a level asked for meanwhile is applied now, or by the fly that is running.
      if (!awaiting) return
      awaiting = null
      if (wanted && !fly) setLevel(wanted)
      return
    }
    awaiting = { id, until: Infinity }
    // From space the wait is spent turning to above the new site, so the descent starts over the right place.
    if (level === 'globe' && !fly && motion() && globe && sky && lat !== undefined && lon !== undefined) {
      const keep = wanted
      const dist = globeCam.position.length()
      flyInSpace(() => setGlobeView(lat, lon, dist), true)
      wanted = keep
    }
  }

  function setLevel(next: SceneLevel, animate = motion()) {
    // C2 may ask for 'site' before the first frame or while a fly runs: remember it and apply it then.
    if ((!frame?.site && next !== 'globe' && next !== 'flight') || fly) {
      wanted = next
      return
    }
    if (awaiting && next !== 'globe' && level === 'globe' && frame?.site?.id !== awaiting.id && performance.now() < awaiting.until) {
      wanted = next
      return
    }
    awaiting = null
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
        const ground = groundEnd()
        level = 'globe'
        setGlobeView()
        const to = { p: globeCam.position.clone(), q: globeCam.quaternion.clone() }
        drawSpace() // as in descendToSite: the globe is ready before the fly starts
        startDescent(to, ground, false, () => {
          globeCam.position.copy(to.p)
          globeCam.lookAt(0, 0, 0)
          globeControls.update()
        })
      } else {
        level = 'globe'
        setGlobeView()
      }
    } else if (next === 'site') {
      if (prev === 'globe' && animate) descendToSite()
      else {
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
    const sp = toScreen(sky.worldPos(b), sky.camera)
    if (!sp.visible) return sp
    // Hidden behind another body (from space the Moon is one of them) or, at site and eye level, behind terrain.
    const blocked = inSpace()
      ? covered(b, globeCam.position, true)
      : site.occluded(siteCam.position, sky.worldDir(b)) || covered(b, sitePoseInMe().p, false)
    const below = !inSpace() && !!frame.site && eyeVisibility(frame.state, frame.site, frame.horizon)[b].fraction <= 0
    return { ...sp, visible: !blocked, belowHorizon: below }
  }

  // C2 calls project() for three labels on every animation frame; the raycasts run once per view version.
  const projCache = new Map<string, { v: number; p: ScreenPoint | null }>()
  function project(name: SceneLabel): ScreenPoint | null {
    if (level === 'flight') return null // the flight level has its own labels (projectFlight)
    const c = projCache.get(name)
    if (c && c.v === viewVersion) return c.p && { ...c.p }
    const p = projectNow(name)
    projCache.set(name, { v: viewVersion, p })
    return p && { ...p }
  }

  /**
   * True when another body lies on the line of sight from `from` (MOON_ME km) to the centre of `name`. The Moon
   * counts as one only from space (withMoon): at site and eye level the terrain is what hides a body.
   */
  function covered(name: 'sun' | 'earth' | 'moon', from: Vector3, withMoon: boolean): boolean {
    if (!frame) return false
    const bodies: [string, Vector3, number][] = [
      ['earth', v3(frame.state.earth_km), EARTH_RADIUS_KM],
      ['sun', v3(frame.state.sun_km), SUN_RADIUS_KM],
    ]
    if (withMoon || name === 'moon') bodies.push(['moon', new Vector3(), MOON_RADIUS_KM * 0.9995])
    const to = bodies.find((b) => b[0] === name)![1].clone().sub(from)
    const len = to.length()
    const ray = new Ray(from, to.normalize())
    const hit = new Vector3()
    return bodies.some(([n, c, r]) => n !== name && ray.intersectSphere(new Sphere(c, r), hit) !== null && hit.distanceTo(from) < len)
  }

  function projectNow(name: SceneLabel): ScreenPoint | null {
    if (!sky || !frame || !globe) return null
    if (name !== 'site') return projectSky(name)
    if (!frame.site) return null
    if (inSpace()) {
      globe.updatePins(globeCam, size.y)
      const head = globe.pinTop(frame.site.id)
      if (!head) return null
      const sp = toScreen(head, globeCam)
      const pin = { ...sp, visible: sp.visible && globe.pinsVisible && !globe.occluded(globeCam.position, head) }
      // During the fly between the scenes the label goes from the pin's head to the mast's top with the fade.
      const mix = fly?.site?.mast ? fly.site.mix : 0
      if (mix <= 0) return pin
      site.updateMarker(siteCam, size.y, true, showCross())
      const mast = toScreen(site.mastTop(), siteCam)
      return { x: pin.x + (mast.x - pin.x) * mix, y: pin.y + (mast.y - pin.y) * mix, visible: mix < 0.5 ? pin.visible : mast.visible }
    }
    site.updateMarker(siteCam, size.y, showMast(), showCross())
    const mast = site.mastTop()
    const sp = toScreen(mast, siteCam)
    if (!showMast()) return { ...sp, visible: false } // the mast is hidden while standing on the site
    const dir = mast.clone().sub(siteCam.position)
    const len = dir.length()
    return { ...sp, visible: sp.visible && !site.occluded(siteCam.position, dir.normalize(), len - 1) }
  }

  /**
   * Where the Sun or Earth label goes: the body's centre, as project() gives it, or the top of its disc once
   * the disc is wider than a label's tick (a zoomed-in lens).
   */
  function labelPoint(name: SceneLabel): ScreenPoint | null {
    const p = project(name)
    if (!p || !p.visible || name === 'site' || !sky) return p
    const cam = activeCam()
    const ratio = sky.sizeRatio(name) // radius over distance, as the sky layer draws the body
    const r = ratio * (size.y / 2) * cam.projectionMatrix.elements[5]
    return r > 20 ? { ...p, y: Math.max(p.y - r, 48) } : p
  }

  // ---------- render loop ----------

  /** The space scene from the space camera. */
  function drawSpace() {
    if (!sky || !globe) return
    globe.updatePins(globeCam, size.y)
    // Far enough to keep the Moon in the picture after a free zoom out; unchanged near the Moon.
    const far = Math.max(2e5, 2 * globeCam.position.length() + 1e4)
    if (globeCam.far !== far) {
      globeCam.far = far
      globeCam.updateProjectionMatrix()
    }
    syncSky('space')
    renderer.clear()
    if (frame) sky.render(renderer)
    renderer.clearDepth()
    renderer.render(globe.scene, globeCam)
    // Earth or the Sun nearer than the Moon (a free camera close to them): drawn over the Moon, which is behind them.
    if (frame && sky.hasFront) {
      renderer.clearDepth()
      sky.render(renderer, 'front')
    }
  }

  /** The site scene from the site camera. */
  function drawSite() {
    if (!sky) return
    site.updateMarker(siteCam, size.y, showMast(), showCross())
    site.updateMarks(siteCam, size.y)
    site.prepare(renderer) // the terrain's shadows for this frame's Sun (shadowmap.ts)
    syncSky('site')
    renderer.clear()
    if (frame) sky.render(renderer)
    renderer.clearDepth()
    renderer.render(site.scene, siteCam)
  }

  function render() {
    if (!sky || !globe) return
    if (level === 'flight') {
      if (!flight) return
      sky.showBodies(true)
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
    // The fly between the scenes: one scene alone at its ends, both in between, the site scene laid over the
    // space scene with its share of the picture.
    const mix = fly?.site ? fly.site.mix : inSpace() ? 0 : 1
    if (mix <= 0) drawSpace()
    else if (mix >= 1) drawSite()
    else {
      drawSite()
      dissolve.capture(renderer)
      drawSpace()
      dissolve.draw(renderer, mix)
    }
  }

  // ---------- names of pins and user points, the Moon point under the pointer ----------

  /** Under the pointer: a site pin first, then a user point, then a point of interest. */
  function nameAt(ndc: Vector2): Named | null {
    if (fly || !globe || level === 'flight') return null
    if (inSpace()) {
      globe.updatePins(globeCam, size.y)
      const pin = globe.nameAt(ndc, globeCam, size)
      if (pin) return pin
      const id = globe.poiAt(ndc, globeCam, size)
      return id === null ? null : { kind: 'poi', id }
    }
    site.updateMarks(siteCam, size.y)
    const other = site.nearAt('site', ndc, siteCam, size.x, size.y)
    if (other) return { kind: 'site', id: other.id }
    const index = site.markAt(ndc, siteCam, size.x, size.y)
    if (index !== null) return { kind: 'point', index }
    const poi = site.nearAt('poi', ndc, siteCam, size.x, size.y)
    return poi ? { kind: 'poi', id: poi.id } : null
  }

  const sameName = (a: Named | null, b: Named | null) =>
    a === b || (a !== null && b !== null && a.kind === b.kind && (a.kind === 'point' ? a.index === (b as typeof a).index : a.id === (b as typeof a).id))

  function named(): SceneName | null {
    if (level === 'flight') return null // the flight level has its own labels (projectFlight)
    if (!globe || fly) return null
    // The hovered or tapped one; otherwise the user point selected in the Mission panel.
    const sel = markers.findIndex((m) => m.selected)
    const h = hover ?? (sel >= 0 ? ({ kind: 'point', index: sel } as const) : null)
    if (!h) return null
    const name =
      h.kind === 'site' ? deps.sites.find((x) => x.id === h.id)?.name : h.kind === 'point' ? markers[h.index]?.name : pois.find((p) => p.id === h.id)?.name
    if (!name) return null
    const poi = h.kind === 'poi' ? { poiId: h.id } : {}
    if (inSpace()) {
      globe.updatePins(globeCam, size.y)
      const head = h.kind === 'site' ? globe.pinTop(h.id) : h.kind === 'point' ? globe.markTop(h.index) : globe.poiTop(h.id)
      if (!head || !globe.pinsVisible) return null
      const sp = toScreen(head, globeCam)
      return { ...sp, name, ...poi, visible: sp.visible && !globe.occluded(globeCam.position, head) }
    }
    site.updateMarks(siteCam, size.y)
    // At site and eye level a site pin is one of the other landing sites near this one.
    const head = h.kind === 'point' ? site.markTop(h.index) : site.nearTop(h.kind, h.id)
    if (!head) return null
    const dir = head.clone().sub(siteCam.position)
    const len = dir.length()
    const sp = toScreen(head, siteCam)
    return { ...sp, name, ...poi, visible: sp.visible && !site.occluded(siteCam.position, dir.normalize(), len - 1) }
  }

  /** Planetocentric lat/lon (MOON_ME) of the Moon point under a pointer position, or null off the Moon. */
  function surfaceAt(ndc: Vector2): { lat: number; lon: number } | null {
    if (fly || !globe || !frame || level === 'flight') return null
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

  /** One frame of every animation, dtMs after the previous one. */
  function tick(dtMs: number) {
    if (awaiting && performance.now() >= awaiting.until) {
      // The picked site's data did not come in time: go to the site that is loaded.
      awaiting = null
      if (wanted && !fly && frame?.site) setLevel(wanted)
    }
    if (fly) stepFly(nowMs())
    if (light.easing) stepLight()
    if (freeCam.step(dtMs)) markDirty()
    // A fly owns its camera: OrbitControls.update() would put the camera back on its orbit (inside the distance
    // limits, looking at the orbit target) after every step of the flight.
    if (fly) return
    if (level === 'flight') {
      // The flight camera keeps its own controls (setFlightView): updated every frame for their damping, and kept
      // outside Earth and the Moon.
      if (flightControls?.update()) markDirty()
      keepOutside()
      return
    }
    const ctl = inSpace() ? globeControls : siteControls
    // The orbit drag eases with the same time constant as the wheel and the look-around, whatever the frame rate.
    ctl.dampingFactor = easeShare(dtMs)
    // update() rebuilds the camera from its offset in spherical coordinates on every call, and that round trip
    // moves a camera at rest by a unit in the last place now and then (F3): it runs only while there is input
    // to apply. Every placement of a camera calls update() itself.
    if (orbitBusy(ctl) && ctl.update()) markDirty()
    if (keepAboveGround()) markDirty()
    if (settleEye() || settleSite()) markDirty()
  }

  let lastMs = performance.now()
  function loop(now: number) {
    if (disposed) return
    raf = requestAnimationFrame(loop)
    tick(testMode ? 0 : Math.min(Math.max(now - lastMs, 0), MAX_FRAME_MS))
    lastMs = now
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
  // Zooming past a limit changes the view (zoomSwitch.ts). The level changes through setLevel, as for the page's
  // View control, and the page hears of it through onLevel, as for a walk.
  const zoomSwitch = createZoomSwitch()
  let zoomSwitchOn = false
  function zoomPushed(lnFactor: number, atLimit: boolean) {
    const dir = lnFactor > 0 ? 'in' : 'out'
    // On the Moon view only the Moon's own floor counts (not Earth's or the Sun's); at eye level nothing does.
    const here =
      level === 'globe' ? dir === 'in' && globeCam.position.length() < MOON_RADIUS_KM + ZOOM_SWITCH_MOON_KM : level === 'site' && dir === 'out'
    const at = zoomSwitchOn && (atLimit || (level === 'globe' && dir === 'in')) && here && !fly && !!frame?.site
    if (!zoomSwitch.feed(dir, Math.abs(lnFactor), at, performance.now())) return false
    const next = level === 'globe' ? 'site' : 'globe'
    setLevel(next)
    emitLevel(next)
    return true
  }
  const freeCam = installFreeCam({ canvas, testMode, rig, heightPx: () => size.y, changed: markDirty, pushed: zoomPushed })
  function onMotionChange() {
    const on = motion()
    siteControls.enableDamping = globeControls.enableDamping = on
    if (flightControls) flightControls.enableDamping = on && !testMode
    freeCam.setSmooth(on)
  }
  reducedQuery?.addEventListener('change', onMotionChange)
  onMotionChange()

  // ---------- input: globe picking ----------

  // Keys (E = eye level, Esc = back) belong to the page: App.tsx maps them to setLevel through its view state,
  // the harness binds them itself. The scene binds none, so a key never acts twice.

  // A click is a press of the main button (or one finger) that moved less than 5 px. On the globe it selects
  // the pin under it; at site and eye level it walks to the terrain point under it.
  let down: { x: number; y: number } | null = null
  let lastClick: { t: number; x: number; y: number } | null = null
  let walkEnabled = true
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
    if (!down || fly || !globe) return
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
      } else if (tapped && tapped.kind !== 'site') return // only a site pin is selected by a second tap
    }
    if (level === 'globe') {
      const hit = globe.pick(ndc, globeCam, size)
      if (!hit) return
      // A pin reports its site's own coordinates: remember which site was picked, if it is another one.
      const picked = deps.sites.find((s) => s.lat === hit.lat && s.lon === hit.lon)
      awaiting = picked && picked.id !== frame?.site?.id ? { id: picked.id, until: performance.now() + AWAIT_SITE_MS } : null
      for (const cb of pickCbs) cb(hit.lat, hit.lon)
      return
    }
    // Another landing site's pin at site and eye level selects that site, as its pin on the globe does: onPick with
    // the site's own coordinates (the contract the page matches pins by). Before (bug of 15 Nov night, "switching
    // from one landing site to another fails in the landing-site view") the pin was named on hover but the click
    // fell through to the walk and nothing happened. The page then delivers the site's frame; applyFrame places the
    // camera at the new site's default view once it is there (expectSite keeps any fly from going to the old one).
    // A click on a point of interest's pin belongs to the page (its info box): it is not a walk either.
    const action = siteLevelClick(nameAt(ndc), frame?.site?.id ?? null, deps.sites)
    if (action.act !== 'walk') {
      lastClick = null
      if (action.act === 'pick') for (const cb of pickCbs) cb(action.lat, action.lon)
      return
    }
    // Walk: a double-click (or double tap) on terrain within WALK_MAX_KM of the site, where walking is on.
    if (!walkEnabled) return
    const now = performance.now()
    const second = lastClick !== null && now - lastClick.t < DOUBLE_CLICK_MS && Math.hypot(e.clientX - lastClick.x, e.clientY - lastClick.y) < DOUBLE_CLICK_PX
    lastClick = second ? null : { t: now, x: e.clientX, y: e.clientY }
    if (!second) return
    const spot = site.pick(ndc, siteCam)
    if (spot && Math.hypot(spot.x, spot.y) <= WALK_MAX_KM * 1000) walkTo(spot.x, spot.y)
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
  // ---------- input: turning the Moon view, with no stop at the poles ----------
  // A left drag (or one finger) turns the camera around the Moon's centre: sideways about the polar axis, up and
  // down about the camera's right axis without a limit, so the camera passes over a pole like over any other place.
  // The camera's up vector follows the turn; setGlobeView puts north up again.
  let turning: { id: number; x: number; y: number } | null = null
  const turnAxis = new Vector3()
  const turnUp = new Vector3()
  const turnPole = new Vector3()
  const turnQ = new Quaternion()
  const turnQ2 = new Quaternion()
  function turnGlobe(yaw: number, pitch: number) {
    const t = globeControls.target
    turnUp.set(0, 1, 0).applyQuaternion(globeCam.quaternion)
    turnAxis.set(1, 0, 0).applyQuaternion(globeCam.quaternion)
    // Sideways: about the Moon's polar axis, as before, so north stays up and no roll builds up; seen upside down
    // (after a pass over a pole) the sense is reversed, so the surface still follows the pointer. Up and down: about
    // the camera's right axis, with no limit.
    turnPole.set(0, 0, turnUp.z >= 0 ? 1 : -1)
    turnQ.setFromAxisAngle(turnPole, yaw).multiply(turnQ2.setFromAxisAngle(turnAxis, pitch))
    globeCam.position.sub(t).applyQuaternion(turnQ).add(t)
    globeCam.up.copy(turnUp.applyQuaternion(turnQ)).normalize()
    globeCam.lookAt(t)
    globeCam.updateMatrixWorld(true)
    viewVersion++
    markDirty()
    notifyCamera()
  }
  const onTurnDown = (e: PointerEvent) => {
    turning = level === 'globe' && !fly && globeControls.enabled && e.button === 0 && fingers <= 1 ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null
  }
  const onTurnMove = (e: PointerEvent) => {
    if (!turning || e.pointerId !== turning.id) return
    if (level !== 'globe' || fly || fingers > 1 || (e.pointerType === 'mouse' && (e.buttons & 1) === 0)) {
      turning = null
      return
    }
    const dx = e.clientX - turning.x
    const dy = e.clientY - turning.y
    if (dx === 0 && dy === 0) return
    turning.x = e.clientX
    turning.y = e.clientY
    // The angle per pixel OrbitControls used: a drag over the canvas height is one turn, times rotateSpeed.
    const k = ((2 * Math.PI) / Math.max(canvas.clientHeight, 1)) * globeControls.rotateSpeed
    turnGlobe(-dx * k, -dy * k)
  }
  const onTurnEnd = () => {
    turning = null
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointerdown', onTurnDown)
  canvas.addEventListener('pointermove', onTurnMove)
  canvas.addEventListener('pointerup', onTurnEnd)
  canvas.addEventListener('pointercancel', onTurnEnd)
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
    // The cap mesh replaces the sphere's pole once its data are in (wave 3): draw again then.
    globe.capReady.then(markDirty)
    globe.setSites(deps.sites, null)
    flight = new FlightWorld(tex)
    flight.setLayers(flightLayers)
    if (flightPlan) setFlight(flightPlan, flightTrueScale)
    globe.setMarkers(markers)
    globe.setPois(pois)
    setGlobeView()
    if (level === 'flight') setFlightView()
    setControls()
    if (pending) applyFrame(pending)
    pending = null
    raf = requestAnimationFrame(loop)
    // Test mode: the globe a test sees is the same every run, with the cap if its data exist.
    return testMode ? globe.capReady : undefined
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
    setWalkEnabled(on) {
      walkEnabled = on
    },
    setZoomSwitch(on) {
      zoomSwitchOn = on
      zoomSwitch.reset()
    },
    setClickGuard(guard) {
      clickGuard = guard
    },
    goTo: (v) => goTo(v),
    goToPoint: (lat, lon) => goToPoint(lat, lon),
    expectSite,
    setMarkers(points) {
      markers = points
      placeMarkers()
    },
    named,
    setPois(next) {
      pois = next
      placePois()
    },
    labelPoint,
    onMenu(cb) {
      menuCbs.add(cb)
      return () => menuCbs.delete(cb)
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      dprQuery?.removeEventListener('change', onPixelRatio)
      reducedQuery?.removeEventListener('change', onMotionChange)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerdown', onTurnDown)
      canvas.removeEventListener('pointermove', onTurnMove)
      canvas.removeEventListener('pointerup', onTurnEnd)
      canvas.removeEventListener('pointercancel', onTurnEnd)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      canvas.removeEventListener('pointermove', onHoverMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('contextmenu', onContext)
      freeCam.dispose()
      siteControls.dispose()
      globeControls.dispose()
      dissolve.dispose()
      site.dispose()
      flightControls?.dispose()
      flight?.dispose()
      // The other scenes: their meshes, materials and the shared texture set (the flight scene's are freed above).
      for (const s of [site.scene, sky?.scene, globe?.scene]) if (s) disposeTree(s)
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
        placePois()
      },
      setMoonVisible(on) {
        globe?.showMoon(on)
        markDirty()
      },
      region: () => globe?.regionInfo() ?? null,
      showRegion(on) {
        globe?.showRegion(on)
        markDirty()
      },
      pins: () => ({ globe: globe?.poiCount ?? 0, near: site.nearInfo() }),
      projectPoi(id) {
        if (!globe) return null
        if (inSpace()) {
          globe.updatePins(globeCam, size.y)
          const head = globe.poiTop(id)
          return head ? toScreen(head, globeCam) : null
        }
        site.updateMarks(siteCam, size.y)
        const head = site.nearTop('poi', id)
        return head ? toScreen(head, siteCam) : null
      },
      sunShareAt: (x, y) => site.sunShareAt(x, y),
      shadowInfo: () => site.shadowInfo(),
      setMarkerVisible(on) {
        site.markerOff = !on
        markDirty()
      },
      shadowProbe: (li, x, y) => site.shadowProbe(renderer, li, x, y),
      dataIds: () => ({
        frame: { site: frame?.site?.id ?? null, horizon: frame?.horizon?.site_id ?? null, terrain: frame?.terrain?.meta.site_id ?? null },
        built: { site: builtFor?.site?.id ?? null, horizon: builtFor?.horizon?.site_id ?? null, terrain: builtFor?.terrain?.meta.site_id ?? null },
      }),
      projectNearSite(id) {
        if (inSpace()) return null
        site.updateMarks(siteCam, size.y)
        const head = site.nearTop('site', id)
        if (!head) return null
        const sp = toScreen(head, siteCam)
        const dir = head.clone().sub(siteCam.position)
        const len = dir.length()
        return { ...sp, visible: sp.visible && !site.occluded(siteCam.position, dir.normalize(), len - 1) }
      },
      projectMe(p) {
        if (!inSpace()) return null
        const q = new Vector3(p[0], p[1], p[2])
        const sp = toScreen(q, globeCam)
        return { ...sp, visible: sp.visible && !globe!.occluded(globeCam.position, q) }
      },
      terrainInfo: () => site.info(),
      lights: () => site.lights(),
      setFlat(on) {
        site.setFlat(on)
        markDirty()
      },
      frameInfo: () => (frame ? { state: frame.state, site: frame.site ? { lat: frame.site.lat, lon: frame.site.lon, elev_m: frame.site.elev_m } : null } : null),
      renderInfo: () => ({
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length ?? 0,
      }),
      surfaceDist: () => (inSpace() ? globeRig : siteRig).surface(activeCam().position),
      goTo: (v) => goTo(v, false),
      handle: () => handle,
      setAnimated(on) {
        animated = on
        onMotionChange()
      },
      advance(ms) {
        clockMs += ms
        tick(ms)
        render()
        notifyCamera()
        dirty = false
      },
      flying: () => fly !== null,
      flyPose() {
        const space = inSpace()
        const pose = space ? { p: globeCam.position, q: globeCam.quaternion } : sitePoseInMe()
        return {
          flying: fly !== null,
          mix: fly?.site ? fly.site.mix : space ? 0 : 1,
          position: pose.p.toArray(),
          quaternion: pose.q.toArray(),
          fov: activeCam().fov,
          site: siteKm.toArray(),
        }
      },
      named,
      surfaceAt(x, y) {
        const r = canvas.getBoundingClientRect()
        return surfaceAt(toNdc(r.left + x, r.top + y))
      },
      bodies() {
        if (!frame) return []
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
      walkTo: (x, y) => walkTo(x, y),
      eyeClearance() {
        site.setEyeMode(eyeTerrain()) // the terrain drawn at this level (render() does the same)
        const p = siteCam.position
        const drawn = site.drawnZ(p.x, p.y)
        const data = site.dataZ(p.x, p.y)
        return { level, position: p.toArray(), drawn, ground: site.groundZ(p.x, p.y), clearance: drawn === null ? null : p.z - drawn, overData: data === null ? null : p.z - data }
      },
      drawnAt(x, y) {
        site.setEyeMode(eyeTerrain())
        return { drawn: site.drawnZ(x, y), ground: site.groundZ(x, y), data: site.dataZ(x, y) }
      },
      capInfo: () => globe?.capInfo() ?? null,
      globeHit(x, y) {
        const r = canvas.getBoundingClientRect()
        return globe && inSpace() ? globe.hitAt(toNdc(r.left + x, r.top + y), globeCam) : null
      },
      moonGround: (p) => moonGround(new Vector3(p[0], p[1], p[2])),
      setCap(on) {
        globe?.useCap(on)
        markDirty()
      },
      subSolar: () => (frame ? latLonOf(v3(frame.state.sun_km)) : null),
      nearLevel(on) {
        nearOn = on
        if (on) requestNear()
        return nearJob
      },
      nearReady: () => nearJob,
      levelSpecs: () => site.levelSpecs(),
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
