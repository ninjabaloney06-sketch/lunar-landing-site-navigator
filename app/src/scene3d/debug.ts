// Debug API (?test=1, Brief C1): window.__scene = { ready, setView, project, camera } plus test helpers.
// setView conventions:
//   site:  az = azimuth the camera looks toward (0 = N, clockwise), el = camera elevation above the site's
//          horizon seen from the site, dist = km from the site. All omitted → the default view.
//   eye:   camera 1.75 m above the site, looking toward az at elevation el.
//   globe: camera above selenographic lat = el, lon = az, dist = km from the Moon's centre, looking at it.
//   utc:   ISO string or Unix ms. fov: vertical, degrees. texture: 'checker' (T16) | 'real'.

import type { Site } from '../data/types'
import type { SceneDeps, SceneFrame, SceneHandle, SceneLevel, SceneName, ScreenPoint, Viewpoint } from './index'
import type { Vector3 } from 'three'

export interface DebugView {
  ready: Promise<void>
  deps: SceneDeps
  readonly level: SceneLevel
  readonly frame: SceneFrame | null
  load(siteId: string, utcMs: number): Promise<void>
  setLevelNow(l: SceneLevel): void
  placeSite(az: number, el: number, distKm: number): void
  placeEye(az: number, el: number): void
  placeGlobe(lat?: number, lon?: number, distKm?: number): void
  defaultSite(): void
  defaultEye(az?: number): void
  setFov(fov: number): void
  sunAzEl(): { az: number; el: number } | null
  earthAzEl(): { az: number; el: number } | null
  renderNow(): void
  project(name: 'sun' | 'earth' | 'site'): ScreenPoint | null
  projectPin(siteId: string): ScreenPoint | null
  pinSurface(siteId: string): Vector3 | null
  setGlobeTexture(m: 'real' | 'checker'): void
  setSites(sites: Site[]): void
  camera(): Record<string, unknown>
  terrainInfo(): { levels: string[]; triangles: number }
  lights(): { sun: number; hidden: number; fill: number; earth: number }
  setFlat(on: boolean): void
  renderInfo(): { calls: number; triangles: number }
  surfaceDist(): number
  terrainAt(x: number, y: number): { x: number; y: number; z: number } | null
  goTo(v: Viewpoint): boolean
  handle(): SceneHandle
  setAnimated(on: boolean): void
  advance(ms: number): void
  flying(): boolean
  pins(): { globe: number; near: { kind: string; id: string; shape: string; base: number[]; ground: number; sphere: number }[] }
  projectPoi(id: string): ScreenPoint | null
  projectMe(p: number[]): ScreenPoint | null
  flyPose(): { flying: boolean; mix: number; position: number[]; quaternion: number[]; fov: number; site: number[] }
  topView(): boolean
  named(): SceneName | null
  surfaceAt(x: number, y: number): { lat: number; lon: number } | null
  bodies(): { name: string; center: number[]; camera: number[] }[]
  projectMark(index: number): ScreenPoint | null
  skySize(b: 'sun' | 'earth'): number | null
}

export interface SetViewOptions {
  site?: string
  utc?: string | number
  level?: SceneLevel
  az?: number
  el?: number
  dist?: number
  fov?: number
  texture?: 'real' | 'checker'
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

export function installDebug(v: DebugView) {
  const api = {
    ready: v.ready,
    async setView(o: SetViewOptions = {}) {
      await v.ready
      const cur = v.frame
      const siteId = o.site ?? cur?.site?.id
      const utcMs = o.utc === undefined ? cur?.state.utcMs : typeof o.utc === 'number' ? o.utc : Date.parse(o.utc)
      if (siteId && utcMs !== undefined && (o.site !== undefined || o.utc !== undefined || !cur)) await v.load(siteId, utcMs)
      if (o.fov) v.setFov(o.fov)
      if (o.texture) v.setGlobeTexture(o.texture)
      const lvl = o.level ?? v.level
      const anyPose = o.az !== undefined || o.el !== undefined || o.dist !== undefined
      if (lvl === 'site') {
        if (!anyPose) v.defaultSite()
        else v.placeSite(o.az ?? (v.sunAzEl()?.az ?? 0) + 18, o.el ?? 16, o.dist ?? 17)
      } else if (lvl === 'eye') {
        if (o.az === undefined) v.defaultEye()
        else v.placeEye(o.az, o.el ?? 3)
      } else v.placeGlobe(o.el, o.az, o.dist)
      v.renderNow()
      await nextFrame()
      await nextFrame()
      return v.camera()
    },
    project: (name: 'sun' | 'earth' | 'site') => v.project(name),
    camera: () => v.camera(),
    // test helpers (not part of the C2 contract)
    level: () => v.level,
    sunAzEl: () => v.sunAzEl(),
    earthAzEl: () => v.earthAzEl(),
    projectPin: (id: string) => v.projectPin(id),
    pinSurface: (id: string) => v.pinSurface(id)?.toArray() ?? null,
    setSites: (s: Site[]) => v.setSites(s),
    setLevel: (l: SceneLevel) => v.setLevelNow(l),
    terrainInfo: () => v.terrainInfo(),
    // Terrain light levels as drawn at site and eye level: the sunlight as a share of full sunlight (never below
    // `hidden`), the even night fill and the earthshine.
    lights: () => v.lights(),
    setFlat: async (on: boolean) => {
      v.setFlat(on)
      v.renderNow()
      await nextFrame()
      await nextFrame()
    },
    renderInfo: () => v.renderInfo(),
    // Brief C4: distance from the camera to the nearest surface (m at site and eye level, km in space), and a
    // sky body's drawn radius over its drawn distance (must not change with the eye-level zoom).
    surfaceDist: () => v.surfaceDist(),
    // Terrain point (ENU m, z = ground height) under a screen position at site or eye level: where a click walks to.
    terrainAt: (x: number, y: number) => v.terrainAt(x, y),
    // Viewpoints without the fly, the top-view flag, the name label's data, the Moon point under a screen
    // position, each body's centre with the camera in the same frame and unit (MOON_ME km, or the top view's
    // display units), and a user point's marker on screen.
    goTo: async (vp: Viewpoint) => {
      const ok = v.goTo(vp)
      v.renderNow()
      await nextFrame()
      await nextFrame()
      return ok
    },
    // The handle the app gets, for tests of its members (setPois, project, labelPoint, ...).
    handle: () => v.handle(),
    // Animations in test mode: setAnimated(true) turns the easing on (input smoothing, flights, light), with a
    // clock that only advance(ms) moves, one frame per call. setLevel through the handle then flies.
    setAnimated: (on: boolean) => v.setAnimated(on),
    advance: (ms: number) => v.advance(ms),
    flying: () => v.flying(),
    // Points of interest: how many pins the globe has, the pins of the site scene (POIs and other landing sites
    // near the site) with the terrain height and the smooth-sphere height under each, a POI's head on screen at
    // the current level (null where it has no pin), and a MOON_ME point (km) on screen in the space scene.
    pins: () => v.pins(),
    projectPoi: (id: string) => v.projectPoi(id),
    projectMe: (p: number[]) => v.projectMe(p),
    // A new frame as the app delivers it (update(frame)): the site and time change, the camera is not placed.
    load: async (siteId: string, utc: string | number) => {
      await v.load(siteId, typeof utc === 'number' ? utc : Date.parse(utc))
      v.renderNow()
    },
    // The camera in one frame at every level (MOON_ME km and the orientation in MOON_ME), with the site scene's
    // share of the picture (0 = space scene, 1 = site scene) and the site's position, for the fly between the scenes.
    flyPose: () => v.flyPose(),
    topView: () => v.topView(),
    named: () => v.named(),
    surfaceAt: (x: number, y: number) => v.surfaceAt(x, y),
    bodies: () => v.bodies(),
    projectMark: (i: number) => v.projectMark(i),
    skySize: (b: 'sun' | 'earth') => v.skySize(b),
  }
  ;(window as unknown as { __scene: typeof api }).__scene = api
  return api
}
