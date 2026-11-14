// 3D scene entry (build-plan §5.4, Brief C1). C1 owns this folder.
// CONTRACT (integrator, 14 Nov): C2 mounts the scene only through these exports. Signatures unchanged.
//
// Two scenes, two unit systems (build-plan §5.4 trap 3):
//   globe: origin = Moon centre, MOON_ME axes, km (globe.ts)
//   site/eye: origin = the site's ground point, ENU axes, metres (site.ts)
// Sun, Earth and stars are a sky layer drawn first at true directions and true angular sizes (sky.ts).
// No angle-triple rotations, no trig and no hand-typed matrices here: directions come from geometry/ via frames.ts.

import {
  ACESFilmicToneMapping,
  MathUtils,
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
import { loadTextures } from './assets'
import { easeShare, installFreeCam, type Rig } from './controls'
import { installDebug, type DebugView } from './debug'
import { Dissolve } from './dissolve'
import { EARTH_RADIUS_KM, SUN_RADIUS_KM, azElOfEnu, enuDir, enuToMeQuat, latLonOf, v3 } from './frames'
import { GlobeWorld } from './globe'
import { POI_NEAR_KM, type PinItem } from './pins'
import { SiteWorld } from './site'
import { Sky } from './sky'
import { TopView } from './topview'

export { TOP_VIEW } from './topview'
export { POI_NEAR_KM } from './pins'

export type SceneLevel = 'globe' | 'site' | 'eye'

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
  project(name: 'sun' | 'earth' | 'site'): ScreenPoint | null // 'site' = mast top, for the "Landing site" label
  onCameraChange(cb: () => void): () => void
  onPick(cb: (lat: number, lon: number) => void): () => void
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
const MAX_FRAME_MS = 100 // a longer gap between two frames (hidden tab, a stall) counts as this much time
const EARTHSHINE = 0.06 * Math.PI // faint fill at full Earth; scaled by Earth's phase, zero when Earth is hidden
const BACKGROUND = 0x0b0d11
const SITE_PIN_COLOR = 0xf2efe8 // the head of the globe's site pins (globe.ts)

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

/** Throws when WebGL is unavailable; C2 then shows the horizon strip and the sentence. */
export function mountScene(container: HTMLElement, deps: SceneDeps): SceneHandle {
  if (!webglAvailable()) throw new Error('WebGL is not available')
  const params = new URLSearchParams(window.location.search)
  const testMode = params.has('test')
  const debug = params.has('debug')
  // Easing (input smoothing, flights). Off in test mode, where every change lands in the frame that asks for it;
  // a test turns it on through the debug API and then steps the clock itself.
  let animated = !testMode
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
  const globeControls = new OrbitControls(globeCam, canvas)
  for (const c of [siteControls, globeControls]) {
    c.enablePan = false
    c.enableDamping = animated
    c.dampingFactor = 0.1 // replaced every frame by the share for that frame's length (tick)
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
  let topView: TopView | null = null
  let top = false // the not-to-scale top view is shown (level stays 'globe')
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
    for (const c of [siteCam, globeCam]) {
      c.aspect = w / h
      c.updateProjectionMatrix()
    }
    markDirty()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()

  const inSpace = () => level === 'globe' || (fly !== null && fly.cam === globeCam)
  const activeCam = () => (inSpace() ? globeCam : siteCam)
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
    globeControls.enabled = level === 'globe' && !fly && !top
    siteControls.enabled = level !== 'globe' && !fly
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
    if (fly || !frame || top) return null
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

  const NO_TURN = new Quaternion()
  function syncSky(which: 'space' | 'site' = inSpace() ? 'space' : 'site') {
    if (!sky || !frame) return
    sky.showBodies(!top)
    if (top && topView) {
      // The top view draws its own three bodies; the sky layer only supplies the stars behind them.
      topView.update(frame.state, globeCam, size.x, size.y)
      sky.update(frame.state, new Vector3(), NO_TURN)
      sky.syncCamera(topView.camera)
      return
    }
    if (which === 'space') sky.update(frame.state, globeCam.position, NO_TURN)
    else sky.update(frame.state, siteKm, meToEnu)
    sky.syncCamera(which === 'space' ? globeCam : siteCam)
  }

  // Terrain light levels as drawn: they ease toward the computed ones, so a jump of the time cursor across a
  // sunset fades over LIGHT_EASE_MS instead of switching in one frame (ease-out: a change every frame, as while
  // the time plays, is followed without stalling). The directions and every computed number are never eased.
  const light = { sun: 1, earth: 0, from: { sun: 1, earth: 0 }, to: { sun: 1, earth: 0 }, t0: 0, easing: false }
  function setLightLevels(sun: number, earth: number, snap: boolean) {
    if (snap || !animated) {
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
    site.setLights(sky.worldDir('sun'), sky.worldDir('earth'))
    // How much of each disc is above the terrain mask from the eye: geometry's own disc fraction, the number the
    // answer and the percentages are computed from (sunlit = fraction > 0), read here and never written. The
    // terrain light follows it, so a sunset dims for as long as the disc takes to cross the mask.
    let sunFrac = 1
    let earthFrac = 0
    if (frame.site) {
      const { lat, lon, elev_m } = frame.site
      const eyeKm = siteVector(lat, lon, ((elev_m ?? 0) + OBSERVER_HEIGHT_M) / 1000)
      const enu = enuBasis(lat, lon)
      const horizon = frame.horizon
      const above = (bodyKm: BodyState['sun_km'], radiusKm: number) => {
        const a = azEl(bodyKm, eyeKm, enu)
        return discFraction(a.el, maskAt(horizon, a.az), angRadiusDeg(radiusKm, a.dist_km))
      }
      sunFrac = above(frame.state.sun_km, SUN_RADIUS_KM)
      earthFrac = above(frame.state.earth_km, EARTH_RADIUS_KM)
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
      placeMarkers()
      placePois()
    }
    globe?.setSites(deps.sites, f.site?.id ?? null)
    applyLights(siteChanged)
    if (!f.site && level !== 'globe') {
      level = 'globe'
      fly = null
      setGlobeView()
    } else if (siteChanged && level === 'eye') setEyeView()
    else if (siteChanged && level !== 'globe') setSiteView()
    if (wanted && f.site && !fly) setLevel(wanted, false)
    if (retarget) {
      fly = null
      descendToSite()
    }
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
        // Ground distance as the chord on the 1737.4 km sphere (shorter than the arc by 0.005 % at 60 km).
        if (v3(siteVector(lat, lon, 0)).distanceTo(at) > POI_NEAR_KM) return
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
    const k = MathUtils.clamp((rHigh - MOON_RADIUS_KM) / ground.distKm, 1, 1e6)
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
  function walkTo(x: number, y: number, animate = animated, faceSite = false): boolean {
    if (!frame?.site || fly || level === 'globe') return false
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

  /** From where the space camera is down to the default view of the current site. */
  function descendToSite() {
    const from = { p: globeCam.position.clone(), q: globeCam.quaternion.clone() }
    level = 'site'
    setSiteView()
    const ground = groundEnd()
    const keep = { p: siteCam.position.clone(), q: siteCam.quaternion.clone() }
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
      if (wanted && wanted !== level) setLevel(wanted)
    }
  }

  /** Ends the running fly at its destination. */
  function finishFly() {
    if (!fly) return
    const done = fly.done
    fly = null
    done()
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
      if (ground && target.lengthSq() === 0) startDescent(to, ground, false, arrive)
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

  function goTo(v: Viewpoint, animate = animated): boolean {
    if (!frame || !sky || !globe || fly) return false
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

  function setLevel(next: SceneLevel, animate = animated) {
    // C2 may ask for 'site' before the first frame or while a fly runs: remember it and apply it then.
    if ((!frame?.site && next !== 'globe') || fly) {
      wanted = next
      return
    }
    wanted = null
    const prev = level
    if (next === 'globe') {
      if (prev !== 'globe' && animate) {
        const ground = groundEnd()
        level = 'globe'
        setGlobeView()
        const to = { p: globeCam.position.clone(), q: globeCam.quaternion.clone() }
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

  /** The space scene (or the top view) from the space camera. */
  function drawSpace() {
    if (!sky || !globe) return
    globe.updatePins(globeCam, size.y)
    // Far enough to keep the Moon in the picture from the Earth and Sun viewpoints; unchanged near the Moon.
    const far = Math.max(2e5, 2 * globeCam.position.length() + 1e4)
    if (globeCam.far !== far) {
      globeCam.far = far
      globeCam.updateProjectionMatrix()
    }
    syncSky('space')
    renderer.clear()
    if (frame) sky.render(renderer)
    renderer.clearDepth()
    if (top && topView) renderer.render(topView.scene, topView.camera)
    else renderer.render(globe.scene, globeCam)
  }

  /** The site scene from the site camera. */
  function drawSite() {
    if (!sky) return
    site.updateMarker(siteCam, size.y, showMast(), showCross())
    site.updateMarks(siteCam, size.y)
    syncSky('site')
    renderer.clear()
    if (frame) sky.render(renderer)
    renderer.clearDepth()
    renderer.render(site.scene, siteCam)
  }

  function render() {
    if (!sky || !globe) return
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
    if (top || fly || !globe) return null
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
    if (top || fly || !globe || !frame) return null
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
    if (fly) stepFly(nowMs())
    if (light.easing) stepLight()
    if (freeCam.step(dtMs)) markDirty()
    // A fly owns its camera: OrbitControls.update() would put the camera back on its orbit (inside the distance
    // limits, looking at the orbit target) after every step of the flight.
    if (fly) return
    const ctl = inSpace() ? globeControls : siteControls
    // The orbit drag eases with the same time constant as the wheel and the look-around, whatever the frame rate.
    ctl.dampingFactor = easeShare(dtMs)
    if (ctl.update()) markDirty()
    if (keepAboveGround()) markDirty()
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
    if (!down || fly || !globe || top) return
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
    down = null
    if (moved > 5 || fingers > 0 || (clickGuard && !clickGuard())) return
    const ndc = toNdc(e.clientX, e.clientY)
    if (e.pointerType === 'touch') {
      // No hover on a touch screen: the first tap on a pin or a user point shows its name, a tap on the same
      // pin again selects it, and a tap elsewhere takes the name away before anything else happens.
      const tapped = nameAt(ndc)
      if (!sameName(tapped, hover)) {
        hover = tapped
        markDirty()
        if (tapped) return
      } else if (tapped && (tapped.kind !== 'site' || level !== 'globe')) return // only a site pin on the globe is selected by a second tap
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
    if (!menuCbs.size) return
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
    globe.setMarkers(markers)
    globe.setPois(pois)
    setGlobeView()
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
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      canvas.removeEventListener('pointermove', onHoverMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('contextmenu', onContext)
      freeCam.dispose()
      siteControls.dispose()
      globeControls.dispose()
      dissolve.dispose()
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
      region: () => globe?.regionInfo() ?? null,
      showRegion(on) {
        globe?.showRegion(on)
        markDirty()
      },
      pins: () => ({ globe: globe?.poiCount ?? 0, near: site.nearInfo() }),
      projectPoi(id) {
        if (!globe || top) return null
        if (inSpace()) {
          globe.updatePins(globeCam, size.y)
          const head = globe.poiTop(id)
          return head ? toScreen(head, globeCam) : null
        }
        site.updateMarks(siteCam, size.y)
        const head = site.nearTop('poi', id)
        return head ? toScreen(head, siteCam) : null
      },
      projectMe(p) {
        if (!inSpace() || top) return null
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
      renderInfo: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
      surfaceDist: () => (top && topView ? topView.clearance() : (inSpace() ? globeRig : siteRig).surface(activeCam().position)),
      goTo: (v) => goTo(v, false),
      handle: () => handle,
      setAnimated(on) {
        animated = on
        siteControls.enableDamping = globeControls.enableDamping = on
        freeCam.setSmooth(on)
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
