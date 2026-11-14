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
  PerspectiveCamera,
  Quaternion,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Horizon, Site, TerrainTile } from '../data/types'
import { MOON_RADIUS_KM, enuBasis, siteVector, type BodyState } from '../geometry'
import { loadTextures } from './assets'
import { installDebug, type DebugView } from './debug'
import { azElOfEnu, enuDir, enuToMeQuat, latLonOf, v3 } from './frames'
import { GlobeWorld } from './globe'
import { SiteWorld } from './site'
import { Sky } from './sky'

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

export interface SceneHandle {
  ready: Promise<void>
  update(frame: SceneFrame): void
  setLevel(level: SceneLevel): void
  project(name: 'sun' | 'earth' | 'site'): ScreenPoint | null // 'site' = mast top, for the "Landing site" label
  onCameraChange(cb: () => void): () => void
  onPick(cb: (lat: number, lon: number) => void): () => void
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
  const site = new SiteWorld()
  let siteKm = new Vector3()
  let enuToMe = new Quaternion()
  let meToEnu = new Quaternion()
  let fly: Fly | null = null
  let dirty = true
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
    for (const c of [siteCam, globeCam]) {
      c.aspect = w / h
      c.updateProjectionMatrix()
    }
    dirty = true
  }
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()

  const inSpace = () => level === 'globe' || fly !== null
  const activeCam = () => (inSpace() ? globeCam : siteCam)

  function setControls() {
    globeControls.enabled = level === 'globe' && !fly
    siteControls.enabled = level !== 'globe' && !fly
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

  function syncSky() {
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
    const earthUp = frame.site ? !site.occluded(eye, earthE) : false
    site.setLights(sunE, earthE, earthUp ? EARTHSHINE * sky.earthPhase : 0)
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
    if (!builtFor || builtFor.site !== f.site || builtFor.horizon !== f.horizon || builtFor.terrain !== f.terrain) {
      if (f.site) site.build(f.horizon, f.terrain, f.site.elev_m)
      builtFor = { site: f.site, horizon: f.horizon, terrain: f.terrain }
    }
    globe?.setSites(deps.sites, f.site?.id ?? null)
    applyLights()
    if (!f.site && level !== 'globe') {
      level = 'globe'
      fly = null
      setGlobeView()
    } else if (siteChanged && level !== 'globe') setSiteView()
    setControls()
    dirty = true
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
    siteCam.position.copy(enuDir(az + 180, el)).multiplyScalar(distKm * 1000)
    siteControls.target.set(0, 0, 0)
    siteCam.lookAt(siteControls.target)
    siteControls.update()
  }

  function placeEyeCam(az: number, el: number) {
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
    dirty = true
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
    dirty = true
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
    dirty = true
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
    dirty = true
  }

  function stepFly(now: number) {
    if (!fly) return
    const t = Math.min((now - fly.t0) / FLY_MS, 1)
    const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2 // ease in-out cubic
    globeCam.position.lerpVectors(fly.p0, fly.p1, e)
    globeCam.quaternion.slerpQuaternions(fly.q0, fly.q1, e)
    globeCam.updateMatrixWorld(true)
    dirty = true
    if (t >= 1) {
      const done = fly.done
      fly = null
      done()
      setControls()
    }
  }

  function setLevel(next: SceneLevel, animate = !testMode) {
    if (!frame?.site && next !== 'globe') return
    if (fly) return
    const prev = level
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
    syncSky()
    const sp = toScreen(sky.worldPos(b), sky.camera)
    if (!sp.visible) return sp
    const cam = activeCam()
    const blocked = inSpace() ? globe!.occludedDir(globeCam.position, sky.worldDir(b)) : site.occluded(cam.position, sky.worldDir(b))
    return { ...sp, visible: !blocked }
  }

  function project(name: 'sun' | 'earth' | 'site'): ScreenPoint | null {
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
    const moved = (inSpace() ? globeControls : siteControls).update()
    if (moved) dirty = true
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

  siteControls.addEventListener('change', () => (dirty = true))
  globeControls.addEventListener('change', () => (dirty = true))

  // ---------- input: keys and globe picking ----------

  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null
    if (e.altKey || e.ctrlKey || e.metaKey) return
    if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
    if ((e.key === 'e' || e.key === 'E') && level === 'site') setLevel('eye')
    else if (e.key === 'Escape') {
      if (level === 'eye') setLevel('site')
      else if (level === 'site') setLevel('globe')
    }
  }
  window.addEventListener('keydown', onKey)

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
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', onKey)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      siteControls.dispose()
      globeControls.dispose()
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
