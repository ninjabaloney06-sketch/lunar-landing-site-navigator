// Debug API (?test=1, Brief C1): window.__scene = { ready, setView, project, camera } plus test helpers.
// setView conventions:
//   site:  az = azimuth the camera looks toward (0 = N, clockwise), el = camera elevation above the site's
//          horizon seen from the site, dist = km from the site. All omitted → the default view.
//   eye:   camera 1.75 m above the site, looking toward az at elevation el.
//   globe: camera above selenographic lat = el, lon = az, dist = km from the Moon's centre, looking at it.
//   utc:   ISO string or Unix ms. fov: vertical, degrees. texture: 'checker' (T16) | 'real'.

import type { Site } from '../data/types'
import type { SceneDeps, SceneFrame, SceneLevel, ScreenPoint } from './index'
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
  }
  ;(window as unknown as { __scene: typeof api }).__scene = api
  return api
}
