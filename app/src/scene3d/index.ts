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
  PerspectiveCamera,
  Quaternion,
  Ray,
  SRGBColorSpace,
  Sphere,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Horizon, Site, TerrainTile } from '../data/types'
import type { FlightPlan } from '../flight/types'
import { qconj, qrot, scale } from '../flight/vec'
import { MOON_RADIUS_KM, enuBasis, siteVector, type BodyState } from '../geometry'
import { loadTextures } from './assets'
import { installDebug, type DebugView } from './debug'
import { FlightWorld, type FlightAnchor } from './flight'
import { azElOfEnu, enuDir, enuToMeQuat, latLonOf, quat, v3 } from './frames'
import { GlobeWorld } from './globe'
import { SiteWorld } from './site'
import { Sky } from './sky'

export type SceneLevel = 'globe' | 'site' | 'eye' | 'flight'
/** What the flight camera turns about: the whole transfer, or a body or the rocket, which it then follows. */
export type FlightFocus = 'overview' | 'earth' | 'moon' | 'rocket'
export type { FlightAnchor } from './flight'

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

export interface SceneHandle {
  ready: Promise<void>
  update(frame: SceneFrame): void
  setLevel(level: SceneLevel): void
  project(name: 'sun' | 'earth' | 'site'): ScreenPoint | null // 'site' = mast top, for the "Landing site" label
  onCameraChange(cb: () => void): () => void
  onPick(cb: (lat: number, lon: number) => void): () => void
  // Flight level (additive, 14 Nov): the plan to draw, the simulated instant, and label points on its objects.
  setFlight(plan: FlightPlan | null, trueScale: boolean): void
  setFlightTime(utcMs: number): void
  projectFlight(name: FlightAnchor): ScreenPoint | null
  /** Back to the default flight view (the whole transfer). */
  resetFlightView(): void
  setFlightFocus(focus: FlightFocus): void
  dispose(): void
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
  minDistKm: 2500,
  maxDistKm: 3e6,
  reframeCos: 0.9986, // re-frame when the transfer plane has turned by more than 3 deg
  // Camera distance when a focus is chosen: Earth with its parking orbit, the Moon with its 100 km orbit, the
  // rocket with enough of its path to see where it is going.
  focusKm: { earth: 42000, moon: 13000, rocket: 30000 },
}
const AU_KM = 149_597_870.7
const ORIGIN = new Vector3()

interface Fly {
  t0: number
  p0: Vector3
  p1: Vector3
  q0: Quaternion
  q1: Quaternion
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
  siteControls.enablePan = false
  siteControls.enableDamping = !testMode
  siteControls.dampingFactor = 0.1
  // Flight camera (J2000, km). Its controls are built per plan: OrbitControls reads camera.up once, and "up" here
  // is the transfer plane's normal.
  const flightCam = new PerspectiveCamera(FLIGHT.fov, 1, 20, 1e7)
  flightCam.up.set(0, 0, 1)
  let flightControls: OrbitControls | null = null
  const globeControls = new OrbitControls(globeCam, canvas)
  globeControls.enablePan = false
  globeControls.enableDamping = !testMode
  globeControls.dampingFactor = 0.1
  globeControls.minDistance = GLOBE_DIST_KM.min
  globeControls.maxDistance = GLOBE_DIST_KM.max
  globeControls.rotateSpeed = 0.5

  let level: SceneLevel = 'globe'
  let frame: SceneFrame | null = null
  let builtFor: { site: Site | null; horizon: Horizon | null; terrain: TerrainTile | null } | null = null
  let sky: Sky | null = null
  let globe: GlobeWorld | null = null
  let flight: FlightWorld | null = null
  let flightPlan: FlightPlan | null = null
  let flightTrueScale = false
  let flightMs = 0
  let flightFramed: Vector3 | null = null // transfer-plane normal the flight camera was last framed for
  let flightFocus: FlightFocus = 'overview'
  const focusAt = new Vector3() // where the followed object was when the camera last moved with it
  const site = new SiteWorld()
  let siteKm = new Vector3()
  let enuToMe = new Quaternion()
  let meToEnu = new Quaternion()
  let fly: Fly | null = null
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

  const inSpace = () => level === 'globe' || fly !== null
  const activeCam = () => (level === 'flight' ? flightCam : inSpace() ? globeCam : siteCam)

  function setControls() {
    globeControls.enabled = level === 'globe' && !fly
    siteControls.enabled = (level === 'site' || level === 'eye') && !fly
    if (flightControls) flightControls.enabled = level === 'flight'
    if (level === 'eye') {
      siteControls.minDistance = siteControls.maxDistance = 0.01
      siteControls.enableZoom = false
      siteControls.rotateSpeed = -0.3 // drag the view, not the camera
      siteControls.minPolarAngle = 0.02
      siteControls.maxPolarAngle = Math.PI - 0.02
    } else {
      siteControls.minDistance = SITE_DIST_KM.min * 1000
      siteControls.maxDistance = SITE_DIST_KM.max * 1000
      siteControls.enableZoom = true
      siteControls.rotateSpeed = 0.5
      siteControls.minPolarAngle = 0.02
      siteControls.maxPolarAngle = Math.PI / 2 - 0.005 // stay above the site's horizontal plane
    }
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
    }
    globe?.setSites(deps.sites, f.site?.id ?? null)
    applyLights()
    if (!f.site && level !== 'globe' && level !== 'flight') {
      level = 'globe'
      fly = null
      setGlobeView()
    } else if (siteChanged && (level === 'site' || level === 'eye')) setSiteView()
    if (wanted && f.site && !fly) setLevel(wanted, false)
    setControls()
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
    siteCam.position.copy(enuDir(az + 180, el)).multiplyScalar(distKm * 1000)
    siteControls.target.set(0, 0, 0)
    siteCam.lookAt(siteControls.target)
    siteControls.update()
  }

  function placeEyeCam(az: number, el: number) {
    viewVersion++
    const eye = new Vector3(0, 0, site.eyeHeight)
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
    setControls()
    placeEyeCam(az ?? currentHeading(), el ?? EYE_DEFAULT_EL)
    markDirty()
  }

  function setGlobeView(lat?: number, lon?: number, distKm?: number) {
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
    c.zoomSpeed = 2 // from the whole transfer down to a lunar orbit is a factor of 100
    c.zoomToCursor = true
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
    setControls()
    markDirty()
  }

  function setFlight(plan: FlightPlan | null, trueScale: boolean) {
    flightPlan = plan
    flightTrueScale = trueScale
    if (!flight) return // applied once the textures are in
    flight.setPlan(plan, trueScale)
    if (plan) {
      flightMs = Math.min(plan.landingMs, Math.max(plan.launchMs, flightMs))
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

  /** Turns the camera about a body or the rocket, from the direction it is looking from now. */
  function setFlightFocus(focus: FlightFocus) {
    flightFocus = focus
    if (focus === 'overview') {
      setFlightView()
      return
    }
    if (!flightControls) setFlightView()
    const p = flight?.anchor(focus)
    if (!p || !flightControls) return
    const dir = flightCam.position.clone().sub(flightControls.target).normalize()
    flightControls.target.copy(p)
    flightCam.position.copy(p).addScaledVector(dir, FLIGHT.focusKm[focus])
    flightCam.lookAt(p)
    flightControls.update()
    focusAt.copy(p)
    markDirty()
  }

  /** Moves camera and target along with the followed object, so the user's own turning and zooming stay. */
  function followFocus() {
    if (flightFocus === 'overview' || !flight || !flightControls) return
    const p = flight.anchor(flightFocus)
    if (!p) return
    const d = p.clone().sub(focusAt)
    if (d.lengthSq() === 0) return
    flightCam.position.add(d)
    flightControls.target.add(d)
    focusAt.copy(p)
  }

  /** True when the sphere blocks the segment from `from` to `to`. */
  function blocked(from: Vector3, to: Vector3, centre: Vector3, radius: number): boolean {
    const dir = to.clone().sub(from)
    const len = dir.length()
    const hit = new Ray(from, dir.normalize()).intersectSphere(new Sphere(centre, radius), new Vector3())
    return hit !== null && hit.distanceTo(from) < len - 1e-6
  }

  function projectFlight(name: FlightAnchor): ScreenPoint | null {
    if (level !== 'flight' || !flight || !flightPlan) return null
    const p = flight.anchor(name)
    const moon = flight.anchor('moon')
    if (!p || !moon) return null
    const earthR = flight.bodyRadius('earth')
    const moonR = flight.bodyRadius('moon')
    if (name === 'earth' || name === 'moon' || name === 'arrival') {
      // The label sits above the body (or the ring): its top edge as the camera sees it.
      const up = new Vector3(0, 1, 0).applyQuaternion(flightCam.quaternion)
      return toScreen(p.addScaledVector(up, name === 'earth' ? earthR : moonR), flightCam)
    }
    const sp = toScreen(p, flightCam)
    if (!sp.visible) return sp
    const hidden = blocked(flightCam.position, p, ORIGIN, earthR * 0.98) || blocked(flightCam.position, p, moon, moonR * 0.98)
    return { ...sp, visible: !hidden }
  }

  /** Site-camera pose expressed in MOON_ME km (for the fly between the two scenes). */
  function sitePoseInMe(): { p: Vector3; q: Quaternion } {
    const p = siteCam.position.clone().multiplyScalar(0.001).applyQuaternion(enuToMe).add(siteKm)
    const q = enuToMe.clone().multiply(siteCam.quaternion)
    return { p, q }
  }

  function startFly(p0: Vector3, q0: Quaternion, p1: Vector3, q1: Quaternion, done: () => void) {
    fly = { t0: performance.now(), p0, q0, p1, q1, done }
    setControls()
    markDirty()
  }

  function stepFly(now: number) {
    if (!fly) return
    const t = Math.min((now - fly.t0) / FLY_MS, 1)
    const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2 // ease in-out cubic
    globeCam.position.lerpVectors(fly.p0, fly.p1, e)
    globeCam.quaternion.slerpQuaternions(fly.q0, fly.q1, e)
    globeCam.updateMatrixWorld(true)
    markDirty()
    if (t >= 1) {
      const done = fly.done
      fly = null
      done()
      setControls()
      if (wanted && wanted !== level) setLevel(wanted)
    }
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
    site.setEyeMode(level === 'eye')
    syncSky()
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
    if (!frame.site) return null
    if (inSpace()) {
      const top = globe.pinTop(frame.site.id)
      if (!top) return null
      const sp = toScreen(top, globeCam)
      return { ...sp, visible: sp.visible && !globe.occluded(globeCam.position, top) }
    }
    site.updateMarker(siteCam, size.y, level === 'site')
    const top = site.mastTop()
    const sp = toScreen(top, siteCam)
    if (level === 'eye') return { ...sp, visible: false } // the mast is hidden while standing on the site
    const dir = top.clone().sub(siteCam.position)
    const len = dir.length()
    return { ...sp, visible: sp.visible && !site.occluded(siteCam.position, dir.normalize(), len - 1) }
  }

  // ---------- render loop ----------

  function render() {
    if (!sky || !globe) return
    sky.setEarthVisible(level !== 'flight') // the flight scene draws its own Earth, at its real distance
    if (level === 'flight') {
      if (!flight) return
      flight.updateSizes(flightCam, size.y)
      syncSky()
      renderer.clear()
      if (flightPlan || frame) sky.render(renderer)
      renderer.clearDepth()
      renderer.render(flight.scene, flightCam)
      return
    }
    site.setEyeMode(level === 'eye')
    const cam = activeCam()
    if (inSpace()) globe.updatePins(globeCam, size.y)
    else site.updateMarker(siteCam, size.y, level === 'site')
    syncSky()
    renderer.clear()
    if (frame) sky.render(renderer)
    renderer.clearDepth()
    renderer.render(inSpace() ? globe.scene : site.scene, cam)
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
    const controls = level === 'flight' ? flightControls : inSpace() ? globeControls : siteControls
    if (controls?.update()) markDirty()
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

  // ---------- input: globe picking ----------

  // Keys (E = eye level, Esc = back) belong to the page: App.tsx maps them to setLevel through its view state,
  // the harness binds them itself. The scene binds none, so a key never acts twice.

  let down: { x: number; y: number } | null = null
  const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY })
  const onUp = (e: PointerEvent) => {
    if (!down || level !== 'globe' || fly || !globe) return
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
    down = null
    if (moved > 5) return
    const r = canvas.getBoundingClientRect()
    const ndc = new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    const hit = globe.pick(ndc, globeCam, size)
    if (hit) for (const cb of pickCbs) cb(hit.lat, hit.lon)
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointerup', onUp)

  // ---------- startup ----------

  let pending: SceneFrame | null = null
  const ready = loadTextures().then((tex) => {
    if (disposed) return
    sky = new Sky(tex)
    globe = new GlobeWorld(tex)
    globe.setSites(deps.sites, null)
    flight = new FlightWorld(tex)
    if (flightPlan) setFlight(flightPlan, flightTrueScale)
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
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
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
