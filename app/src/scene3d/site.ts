// Site scene: origin = the landing site's ground point, axes = local ENU (x east, y north, z up), unit = metres.
// Terrain = the Track B tile (if any) inside 20 km, and beyond it a ring whose crest is built from the horizon
// mask: crest vertex k sits at eye + mask_dist · dir(az_k, mask_k), so the silhouette seen from the eye is the
// mask (linear between samples, great-circle arcs). Ground surfaces run straight from the inner edge to the
// crest, which keeps them at or below every crest sight line. Shadows are not used for lit/dark anywhere.

import {
  BoxGeometry,
  BufferGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector3,
  type Object3D,
} from 'three'
import type { Horizon, TerrainTile } from '../data/types'
import { MOON_RADIUS_KM, OBSERVER_HEIGHT_M } from '../geometry'
import { enuDir } from './frames'

const TILE_RADIUS_M = 20_000 // tile used inside this radius, ring from the mask beyond (Brief C1)
const NO_HORIZON_RADIUS_M = 200_000 // smooth-sphere ground when a site has no horizon file
const MAST_PER_DIST = 1.6 / 17 // 1.6 km tall at the default 17 km distance
const CROSS_PER_DIST = 0.035
const MAST_WIDTH_PX = 1.6

const regolith = () => new MeshStandardMaterial({ color: 0x8b8781, roughness: 1, metalness: 0 })

/** Sphere drop below the site's tangent plane at horizontal distance rho (m), exact: √(R² − ρ²) − R. */
function sphereZ(rho: number, rSite: number, h = 0): number {
  const r = rSite + h
  return Math.sqrt(Math.max(r * r - rho * rho, 0)) - rSite
}

function gridMesh(cols: number, rows: number, pos: Float32Array, wrap: boolean): BufferGeometry {
  // pos: column-major (cols × rows × 3). Columns wrap around in azimuth when wrap is true.
  const idx: number[] = []
  const nc = wrap ? cols : cols - 1
  for (let c = 0; c < nc; c++) {
    const c1 = (c + 1) % cols
    for (let r = 0; r < rows - 1; r++) {
      const a = c * rows + r
      const b = c1 * rows + r
      // Azimuth grows clockwise seen from above, so (a, b, a+1) is counter-clockwise: faces up/inward.
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

/** Bilinear tile height (m, relative to the site's ground) at ENU (x, y); null outside or on nodata. */
function tileHeight(t: TerrainTile, x: number, y: number): number | null {
  const { size, spacing_m, nodata } = t.meta
  const half = (size - 1) / 2
  const fj = x / spacing_m + half
  const fi = half - y / spacing_m
  if (fj < 0 || fi < 0 || fj > size - 1 || fi > size - 1) return null
  const j0 = Math.min(Math.floor(fj), size - 2)
  const i0 = Math.min(Math.floor(fi), size - 2)
  const dj = fj - j0
  const di = fi - i0
  const h = t.heights
  const q = [h[i0 * size + j0], h[i0 * size + j0 + 1], h[(i0 + 1) * size + j0], h[(i0 + 1) * size + j0 + 1]]
  if (q.some((v) => v === nodata)) return null
  return (q[0] * (1 - dj) + q[1] * dj) * (1 - di) + (q[2] * (1 - dj) + q[3] * dj) * di
}

export class SiteWorld {
  readonly scene = new Scene()
  private readonly terrain = new Group() // visible terrain
  private readonly rayTargets: Object3D[] = [] // meshes used for occlusion tests (coarse proxy for the tile)
  private readonly marker = new Group()
  private readonly mast: Mesh
  private readonly cross: Mesh[]
  private readonly sunLight = new DirectionalLight(0xfff4e6, 3 * Math.PI)
  private readonly earthLight = new DirectionalLight(0x9fb6d8, 0)
  private readonly raycaster = new Raycaster()
  private readonly rayMat = new MeshBasicMaterial({ side: DoubleSide })
  private mastHeight = 1600
  eyeHeight = OBSERVER_HEIGHT_M

  constructor() {
    this.scene.add(this.terrain, this.marker, this.sunLight, this.sunLight.target, this.earthLight, this.earthLight.target)
    const mk = new MeshBasicMaterial({ color: 0xece9e2, toneMapped: false })
    this.mast = new Mesh(new BoxGeometry(1, 1, 1).translate(0, 0, 0.5), mk)
    const crossMat = new MeshBasicMaterial({ color: 0xece9e2, toneMapped: false, depthTest: false, transparent: true, opacity: 0.85 })
    this.cross = [new Mesh(new BoxGeometry(1, 1, 1), crossMat), new Mesh(new BoxGeometry(1, 1, 1), crossMat)]
    for (const c of this.cross) c.renderOrder = 5
    this.marker.add(this.mast, ...this.cross)
  }

  /** Rebuild terrain for a site. elevM = site height above the 1737.4 km sphere (null → 0). */
  build(horizon: Horizon | null, tile: TerrainTile | null, elevM: number | null) {
    for (const c of [...this.terrain.children]) {
      this.terrain.remove(c)
      ;(c as Mesh).geometry?.dispose()
    }
    this.rayTargets.length = 0
    const rSite = MOON_RADIUS_KM * 1000 + (elevM ?? 0)
    if (tile) this.addTile(tile, rSite)
    if (horizon) this.addRing(horizon, tile, rSite)
    else if (!tile) this.addSphereGround(rSite)
    else this.addSphereGround(rSite, TILE_RADIUS_M) // tile without horizon: smooth sphere beyond it
  }

  private addMesh(g: BufferGeometry, rayProxy?: BufferGeometry) {
    this.terrain.add(new Mesh(g, regolith()))
    // Occlusion tests use an invisible double-sided twin (coarse for the tile, so project() stays cheap).
    const p = new Mesh(rayProxy ?? g, this.rayMat)
    p.visible = false
    this.terrain.add(p)
    this.rayTargets.push(p)
  }

  private addSphereGround(rSite: number, innerM = 0) {
    const nAz = 360
    const nR = 48
    const pos = new Float32Array(nAz * (nR + 1) * 3)
    for (let k = 0; k < nAz; k++) {
      const a = enuDir(k, 0)
      for (let j = 0; j <= nR; j++) {
        const t = j / nR
        const rho = innerM + (NO_HORIZON_RADIUS_M - innerM) * t * t
        const o = (k * (nR + 1) + j) * 3
        pos[o] = a.x * rho
        pos[o + 1] = a.y * rho
        pos[o + 2] = sphereZ(rho, rSite)
      }
    }
    this.addMesh(gridMesh(nAz, nR + 1, pos, true))
  }

  /**
   * Per azimuth k, one column of vertices: flat ground from the inner point (site, or tile edge) to the ridge
   * foot F, the ridge's inner face up to the crest T (on the mask sight line), a back slope B and a far apron.
   * F, B and the apron stay below the crest's sight line from the eye (for negative masks too), and every
   * face between two such points stays below it as well, so the silhouette from the eye is exactly the mask.
   * F and T are doubled (zero-area quads) so the ridge keeps sharp edges in the vertex normals.
   */
  private addRing(h: Horizon, tile: TerrainTile | null, rSite: number) {
    const n = h.mask.length
    const eye = new Vector3(0, 0, h.observer_height_m)
    const he = eye.z
    const inner = tile ? TILE_RADIUS_M * 0.98 : 0
    const nGround = 8
    const apron = [1.6, 2.3, 3.2]
    const rows = nGround + 1 + 1 + 1 + 1 + 1 + apron.length
    const pos = new Float32Array(n * rows * 3)
    for (let k = 0; k < n; k++) {
      const a = enuDir(k * h.az_step, 0)
      const d = Number.isFinite(h.mask_dist_km[k]) && h.mask_dist_km[k] > 0 ? h.mask_dist_km[k] * 1000 : 5000
      const t = eye.clone().addScaledVector(enuDir(k * h.az_step, h.mask[k]), d)
      let rho = Math.hypot(t.x, t.y)
      // Blocking terrain inside the tile: push the crest out along the same sight line (same silhouette).
      if (tile && rho < inner * 1.05) {
        t.sub(eye).multiplyScalar((inner * 1.05) / rho).add(eye)
        rho = inner * 1.05
      }
      const slope = (t.z - he) / rho // tangent of the crest sight line, relative to the eye
      const below = (r: number) => he + slope * r // height of that sight line at horizontal distance r
      let o = k * rows * 3
      const put = (r: number, z: number) => {
        pos[o++] = a.x * r
        pos[o++] = a.y * r
        pos[o++] = z
      }
      // Inner point: the site (no tile) or the tile edge at this azimuth (tile height, curvature applied).
      const r0 = inner
      const z0 = tile ? sphereZ(inner, rSite, tileHeight(tile, a.x * inner, a.y * inner) ?? 0) : 0
      const rF = Math.max(0.85 * rho, (r0 + rho) / 2)
      const zF = Math.min(z0, he + 0.98 * slope * rF - 0.002 * rF)
      for (let j = 0; j <= nGround; j++) {
        const f = j / nGround
        put(r0 + (rF - r0) * f, z0 + (zF - z0) * f)
      }
      put(rF, zF)
      put(rho, t.z)
      put(rho, t.z)
      const rB = 1.15 * rho
      const zB = Math.min(t.z - 0.8 * (t.z - zF), below(rB) - 0.01 * rho)
      put(rB, zB)
      for (const m of apron) {
        const r = Math.max(m * rho, rB + 1000)
        put(r, Math.min(zB - (r * r - rB * rB) / (2 * rSite), below(r) - 0.02 * r))
      }
    }
    this.addMesh(gridMesh(n, rows, pos, true))
  }

  private addTile(t: TerrainTile, rSite: number) {
    const { size, spacing_m, nodata } = t.meta
    const half = (size - 1) / 2
    const make = (stride: number) => {
      const m = Math.floor((size - 1) / stride) + 1
      const pos = new Float32Array(m * m * 3)
      const ok = new Uint8Array(m * m)
      for (let ii = 0; ii < m; ii++) {
        for (let jj = 0; jj < m; jj++) {
          const i = ii * stride
          const j = jj * stride
          const x = (j - half) * spacing_m
          const y = (half - i) * spacing_m
          const hv = t.heights[i * size + j]
          const rho = Math.hypot(x, y)
          const v = ii * m + jj
          ok[v] = hv !== nodata && rho <= TILE_RADIUS_M ? 1 : 0
          pos[v * 3] = x
          pos[v * 3 + 1] = y
          pos[v * 3 + 2] = sphereZ(rho, rSite, hv === nodata ? 0 : hv)
        }
      }
      const idx: number[] = []
      for (let ii = 0; ii < m - 1; ii++) {
        for (let jj = 0; jj < m - 1; jj++) {
          const a = ii * m + jj // north-west
          const b = a + 1 // north-east
          const c = a + m // south-west
          const d = c + 1
          if (ok[a] && ok[b] && ok[c] && ok[d]) idx.push(a, c, b, b, c, d) // counter-clockwise seen from above
        }
      }
      const g = new BufferGeometry()
      g.setAttribute('position', new Float32BufferAttribute(pos, 3))
      g.setIndex(idx)
      g.computeVertexNormals()
      g.computeBoundingSphere()
      return g
    }
    this.addMesh(make(1), make(4))
  }

  setLights(sunDir: Vector3, earthDir: Vector3, earthFill: number) {
    this.sunLight.position.copy(sunDir).multiplyScalar(1e5)
    this.earthLight.position.copy(earthDir).multiplyScalar(1e5)
    this.earthLight.intensity = earthFill
  }

  /** Keeps the mast and cross a constant on-screen thickness; hides them at eye level. */
  updateMarker(cam: PerspectiveCamera, heightPx: number, show: boolean) {
    this.marker.visible = show
    const dist = cam.position.length()
    const perPx = (2 * dist) / (cam.projectionMatrix.elements[5] * heightPx)
    this.mastHeight = MAST_PER_DIST * dist
    const w = MAST_WIDTH_PX * perPx
    this.mast.scale.set(w, w, this.mastHeight)
    const arm = 2 * CROSS_PER_DIST * dist
    this.cross[0].scale.set(arm, w, w)
    this.cross[1].scale.set(w, arm, w)
  }

  mastTop(): Vector3 {
    return new Vector3(0, 0, this.mastHeight)
  }

  /** True when terrain blocks the segment from `from` along unit `dir` before `maxDist` (m). */
  occluded(from: Vector3, dir: Vector3, maxDist = Infinity): boolean {
    this.raycaster.set(from, dir)
    this.raycaster.far = maxDist
    const hit = this.raycaster.intersectObjects(this.rayTargets, false)
    return hit.length > 0
  }
}
