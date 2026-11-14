// Site scene: origin = the landing site's ground point, axes = local ENU (x east, y north, z up), unit = metres.
// Terrain = the Track B tile (if any) inside 20 km, and beyond it a ring whose crest is built from the horizon
// mask: crest vertex k sits at eye + mask_dist · dir(az_k, mask_k), so the silhouette seen from the eye is the
// mask (linear between samples, great-circle arcs). Ground surfaces run straight from the inner edge to the
// crest, which keeps them at or below every crest sight line. Shadows are not used for lit/dark anywhere.
// Tile without a horizon file: a neutral skirt continues each azimuth's tile-edge height on the sphere (it never
// rises above the edge's own sight line). Tile nodata (−32768) is a hole: no tile quad, no skirt column there.

import {
  BoxGeometry,
  BufferGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
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
const SKIRT_START_M = TILE_RADIUS_M - 150 // just inside the tile's jagged circular edge
const SKIRT_SINK_M = 3 // skirt sits this far under the tile where they overlap (no z-fighting)
const SKIRT_BLEND_M = 15_000
const SKIRT_SMOOTH_DEG = 20
const MAST_PER_DIST = 1.6 / 17 // 1.6 km tall at the default 17 km distance
const CROSS_PER_DIST = 0.035
const MAST_WIDTH_PX = 1.6

// MeshStandardMaterial family (roughness 1, metalness 0) with the specular lobe off: at grazing view and light
// angles (low polar Sun, camera looking toward it) three's GGX specular reaches ~10× the diffuse term and turns
// flat far ground into a bright glare. Regolith does not forward-scatter like that, so the surface is diffuse only.
const regolith = () => new MeshPhysicalMaterial({ color: 0x8b8781, roughness: 1, metalness: 0, specularIntensity: 0 })

/** Sphere drop below the site's tangent plane at horizontal distance rho (m), exact: √(R² − ρ²) − R. */
function sphereZ(rho: number, rSite: number, h = 0): number {
  const r = rSite + h
  return Math.sqrt(Math.max(r * r - rho * rho, 0)) - rSite
}

function gridMesh(cols: number, rows: number, pos: Float32Array, wrap: boolean, ok?: Uint8Array): BufferGeometry {
  // pos: column-major (cols × rows × 3). Columns wrap around in azimuth when wrap is true.
  // ok (optional, one flag per vertex): quads touching a vertex with ok = 0 are left out (nodata holes).
  const idx: number[] = []
  const nc = wrap ? cols : cols - 1
  for (let c = 0; c < nc; c++) {
    const c1 = (c + 1) % cols
    for (let r = 0; r < rows - 1; r++) {
      const a = c * rows + r
      const b = c1 * rows + r
      if (ok && !(ok[a] && ok[b] && ok[a + 1] && ok[b + 1])) continue
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

/** Tile height at the tile edge along unit ENU direction a: first valid sample walking inward up to 2 km. */
function edgeHeight(t: TerrainTile, a: Vector3, r0: number): { r: number; h: number } | null {
  for (let r = r0; r >= r0 - 2000; r -= t.meta.spacing_m / 2) {
    const h = tileHeight(t, a.x * r, a.y * r)
    if (h !== null) return { r, h }
  }
  return null
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
  readonly eyeHeight = OBSERVER_HEIGHT_M // spec: 1.75 m above the ground

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
    else this.addSkirt(tile, rSite)
  }

  private addMesh(g: BufferGeometry, rayProxy?: BufferGeometry) {
    this.terrain.add(new Mesh(g, regolith()))
    // Occlusion tests use an invisible double-sided twin (coarse for the tile, so project() stays cheap).
    const p = new Mesh(rayProxy ?? g, this.rayMat)
    p.visible = false
    this.terrain.add(p)
    this.rayTargets.push(p)
  }

  /** No tile, no horizon: the smooth sphere through the site (flat-disc fallback). */
  private addSphereGround(rSite: number) {
    const nAz = 360
    const nR = 48
    const pos = new Float32Array(nAz * (nR + 1) * 3)
    for (let k = 0; k < nAz; k++) {
      const a = enuDir(k, 0)
      for (let j = 0; j <= nR; j++) {
        const t = j / nR
        const rho = NO_HORIZON_RADIUS_M * t * t
        const o = (k * (nR + 1) + j) * 3
        pos[o] = a.x * rho
        pos[o + 1] = a.y * rho
        pos[o + 2] = sphereZ(rho, rSite)
      }
    }
    this.addMesh(gridMesh(nAz, nR + 1, pos, true))
  }

  /**
   * Tile but no horizon file: a neutral skirt with no invented relief. Per azimuth it starts at the tile-edge
   * height and blends over SKIRT_BLEND_M to that height averaged over ±SKIRT_SMOOTH_DEG of azimuth (so adjacent
   * columns do not form radial grooves), then follows the sphere. Every column stays at or below its edge height
   * minus the curvature drop, so it never rises above the tile edge's own sight line. Nodata edge → no column.
   */
  private addSkirt(t: TerrainTile, rSite: number) {
    const nAz = 360
    const nR = 32
    const rows = nR + 1
    const pos = new Float32Array(nAz * rows * 3)
    const ok = new Uint8Array(nAz * rows)
    const dirs = Array.from({ length: nAz }, (_, k) => enuDir(k, 0))
    const edge = dirs.map((a) => edgeHeight(t, a, SKIRT_START_M))
    const smooth = edge.map((_, k) => {
      let s = 0
      let n = 0
      for (let d = -SKIRT_SMOOTH_DEG; d <= SKIRT_SMOOTH_DEG; d++) {
        const e = edge[(k + d + nAz) % nAz]
        if (e) {
          s += e.h
          n++
        }
      }
      return n ? s / n : 0
    })
    for (let k = 0; k < nAz; k++) {
      const a = dirs[k]
      const e = edge[k]
      const r0 = e?.r ?? SKIRT_START_M
      for (let j = 0; j < rows; j++) {
        const f = j / nR
        const rho = r0 + (NO_HORIZON_RADIUS_M - r0) * f * f
        const b = Math.min((rho - r0) / SKIRT_BLEND_M, 1)
        const w = b * b * (3 - 2 * b) // smoothstep
        const h = e ? Math.min(e.h, e.h + (smooth[k] - e.h) * w) : 0
        const v = k * rows + j
        ok[v] = e ? 1 : 0
        pos[v * 3] = a.x * rho
        pos[v * 3 + 1] = a.y * rho
        pos[v * 3 + 2] = e ? sphereZ(rho, rSite, h) - SKIRT_SINK_M : 0
      }
    }
    this.addMesh(gridMesh(nAz, rows, pos, true, ok))
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
    // Eye at the spec's 1.75 m (the camera's eye level); a horizon computed for another height differs by
    // (Δh / mask_dist) rad, < 0.001° for the 0.25 m of the old sample file.
    const eye = new Vector3(0, 0, OBSERVER_HEIGHT_M)
    const he = eye.z
    const inner = tile ? SKIRT_START_M : 0
    const nGround = 8
    const apron = [1.6, 2.3, 3.2]
    const rows = nGround + 1 + 1 + 1 + 1 + 1 + apron.length
    const pos = new Float32Array(n * rows * 3)
    const ok = new Uint8Array(n * rows).fill(1)
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
      // Nodata edge: no ground rows for this azimuth (hole), the ridge from the mask stays.
      const e = tile ? edgeHeight(tile, a, inner) : { r: 0, h: 0 }
      const r0 = e?.r ?? inner
      const rF = Math.max(0.85 * rho, (r0 + rho) / 2)
      const zLine = he + 0.98 * slope * rF - 0.002 * rF
      const z0 = e ? sphereZ(r0, rSite, e.h) - (tile ? SKIRT_SINK_M : 0) : zLine
      const zF = Math.min(z0, zLine)
      if (!e) ok.fill(0, k * rows, k * rows + nGround + 1)
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
    this.addMesh(gridMesh(n, rows, pos, true, ok))
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
