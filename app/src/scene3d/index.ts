// 3D scene entry (build-plan §5.4, Brief C1). C1 owns this folder.
// CONTRACT (integrator, 14 Nov): C2 mounts the scene only through these exports. C1 replaces the stub
// below; changing a signature needs the integrator.

import type { Horizon, Site, TerrainTile } from '../data/types'
import type { BodyState } from '../geometry'

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

// ?test=1: mountScene also sets window.__scene = { ready, setView({site, utc, level, az, el, dist, fov}),
// project, camera } (Brief C1 debug API).
/** Throws when WebGL is unavailable; C2 then shows the horizon strip and the sentence. */
export function mountScene(container: HTMLElement, deps: SceneDeps): SceneHandle {
  void container
  void deps
  // STUB until C1 merges: renders nothing, projects nothing.
  return {
    ready: Promise.resolve(),
    update: () => {},
    setLevel: () => {},
    project: () => null,
    onCameraChange: () => () => {},
    onPick: () => () => {},
    dispose: () => {},
  }
}
