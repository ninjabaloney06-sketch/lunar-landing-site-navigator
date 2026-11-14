// Site scene: origin = the landing site's ground point, axes = local ENU (x east, y north, z up), unit = metres.
// Terrain = the Track B tile (if any) inside 20 km, and beyond it a ring whose crest is built from the horizon
// mask: crest vertex k sits at eye + mask_dist · dir(az_k, mask_k), so the silhouette seen from the eye is the
// mask (linear between samples, great-circle arcs). Ground surfaces run straight from the inner edge to the
// crest, which keeps them at or below every crest sight line. Shadows are not used for lit/dark anywhere.
// Tile without a horizon file: a neutral skirt continues each azimuth's tile-edge height on the sphere (it never
// rises above the edge's own sight line). Tile nodata (−32768) is a hole: no tile quad, no skirt column there.
//
// With a tile AND a horizon, the terrain differs by level:
//   site (orbit camera): tile + skirt. No crests beyond 20 km: ramps from the tile edge to far mask crests read as
//     invented walls from above, and the far terrain is unknown apart from the crest points.
//   eye: tile + mask ring. Every ring crest sits on the mask sight line at its true distance (a horizon point
//     inside the tile becomes a short face rising from the tile surface), so the silhouette seen from the eye is
//     the mask itself.
// In both, tile and skirt vertices are clamped to the mask sight line from the eye: the 80 m tile mesh may
// overshoot the 20 m DEM the mask was computed from, and must never hide a body the mask shows.
//
// With extra levels (tile.levels includes 'far', levels.ts): fine 20 m ⊂ 80 m tile ⊂ mid 400 m ⊂ far 2 km, nested
// with square holes and zipper strips, real relief to ±300 km and no skirt. Site level draws the levels; eye level
// draws the levels plus a crest strip on the mask (one short face per mask azimuth at its true distance, from the
// terrain up to the mask sight line), so the silhouette from the eye is still the mask. Levels are clamped like
// the tile, the new ones to the lowest sight line across their cell's azimuth span (a triangle between clamped
// vertices must not fill a notch of the mask).

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
import { MOON_RADIUS_KM, OBSERVER_HEIGHT_M, maskAt } from '../geometry'
import { azElOfEnu, enuDir } from './frames'
import { heightAt, levelGrid, levelMesh, nestedLevels, normalsOf, place, sphereZ, stitch, type Level, type LevelGrid } from './levels'

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
const RAD_TO_DEG = 180 / Math.PI
const PROXY_STRIDE = 4 // ray proxies use every 4th vertex of a level

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

/**
 * Skirt and ring carry no relief of their own (straight ramps, columns whose crest distance jumps), so they get
 * the smooth sphere's normal instead of their face normals: they shade like flat ground, dark under a grazing Sun.
 */
function sphereNormals(g: BufferGeometry, rSite: number): BufferGeometry {
  const p = g.attributes.position
  const n = g.attributes.normal
  const v = new Vector3()
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i) + rSite).normalize()
    n.setXYZ(i, v.x, v.y, v.z)
  }
  n.needsUpdate = true
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

interface SightLine {
  /** Highest terrain height (m, ENU z) allowed at horizontal distance rho for whole-degree azimuth column k. */
  below(k: number, rho: number): number
  /** Same for an ENU point p (z ignored) at horizontal distance rho; azimuth from geometry.azEl. */
  belowAt(p: Vector3, rho: number): number
  /** Lowest limit over the azimuths a grid cell of width `cell` (m) next to p spans (± cell/rho rad, ≤ 30°). */
  belowCell(p: Vector3, rho: number, cell: number): number
}

/**
 * The eye's mask as a height limit: at azimuth az the sight line rises by tanMask(az) per metre, where
 * tanMask = up / horizontal component of enuDir(az, maskAt(az)) (geometry does the angle maths). A small margin
 * (0.03° plus 5 cm) keeps flat triangles between clamped vertices under the line.
 */
function sightLine(h: Horizon): SightLine {
  const he = OBSERVER_HEIGHT_M
  const tanOf = (az: number) => {
    const d = enuDir(az, maskAt(h, az))
    return d.z / Math.hypot(d.x, d.y)
  }
  const cols = Array.from({ length: 360 }, (_, k) => tanOf(k))
  const n = h.mask.length
  const samples = Array.from({ length: n }, (_, k) => tanOf(k * h.az_step))
  const lim = (tan: number, rho: number) => he + tan * rho - 0.0005 * rho - 0.05
  return {
    below: (k, rho) => lim(cols[((k % 360) + 360) % 360], rho),
    belowAt: (p, rho) => lim(tanOf(azElOfEnu(p).az), rho),
    belowCell: (p, rho, cell) => {
      const az = azElOfEnu(p).az
      const half = Math.min((cell / rho) * RAD_TO_DEG, 30)
      let t = tanOf(az)
      for (let k = Math.floor((az - half) / h.az_step); k <= Math.ceil((az + half) / h.az_step); k++) {
        t = Math.min(t, samples[((k % n) + n) % n])
      }
      return lim(t, rho)
    },
  }
}

export class SiteWorld {
  readonly scene = new Scene()
  private readonly terrain = new Group() // terrain for both levels
  private readonly orbitOnly = new Group() // site level only (skirt)
  private readonly eyeOnly = new Group() // eye level only (mask ring)
  // Meshes used for occlusion tests (coarse proxy for the tile), per group.
  private readonly rays = { both: [] as Object3D[], orbit: [] as Object3D[], eye: [] as Object3D[] }
  private eyeMode = false
  private levelNames: string[] = []
  private readonly marker = new Group()
  private readonly mast: Mesh
  private readonly cross: Mesh[]
  private readonly sunLight = new DirectionalLight(0xfff4e6, 3 * Math.PI)
  private readonly earthLight = new DirectionalLight(0x9fb6d8, 0)
  private readonly raycaster = new Raycaster()
  private readonly rayMat = new MeshBasicMaterial({ side: DoubleSide })
  private readonly flatMat = new MeshBasicMaterial({ color: 0x808080, toneMapped: false })
  private mastHeight = 1600
  readonly eyeHeight = OBSERVER_HEIGHT_M // spec: 1.75 m above the ground

  constructor() {
    this.scene.add(this.terrain, this.orbitOnly, this.eyeOnly, this.marker)
    this.scene.add(this.sunLight, this.sunLight.target, this.earthLight, this.earthLight.target)
    this.setEyeMode(false)
    const mk = new MeshBasicMaterial({ color: 0xece9e2, toneMapped: false })
    this.mast = new Mesh(new BoxGeometry(1, 1, 1).translate(0, 0, 0.5), mk)
    const crossMat = new MeshBasicMaterial({ color: 0xece9e2, toneMapped: false, depthTest: false, transparent: true, opacity: 0.85 })
    this.cross = [new Mesh(new BoxGeometry(1, 1, 1), crossMat), new Mesh(new BoxGeometry(1, 1, 1), crossMat)]
    for (const c of this.cross) c.renderOrder = 5
    this.marker.add(this.mast, ...this.cross)
  }

  /** Rebuild terrain for a site. elevM = site height above the 1737.4 km sphere (null → 0). */
  build(horizon: Horizon | null, tile: TerrainTile | null, elevM: number | null) {
    for (const grp of [this.terrain, this.orbitOnly, this.eyeOnly]) {
      for (const c of [...grp.children]) {
        grp.remove(c)
        ;(c as Mesh).geometry?.dispose()
      }
    }
    this.rays.both.length = this.rays.orbit.length = this.rays.eye.length = 0
    this.levelNames = []
    const rSite = MOON_RADIUS_KM * 1000 + (elevM ?? 0)
    const line = horizon ? sightLine(horizon) : null
    const levels = tile ? nestedLevels(tile) : null
    if (levels) {
      // Nested levels reach ±300 km: no skirt, no ring ground; at eye level only the crest strip on the mask.
      this.addLevels(levels, rSite, line)
      if (horizon) this.addCrests(horizon, levels, rSite)
      return
    }
    if (tile) this.levelNames = ['tile']
    if (tile) this.addTile(tile, rSite, line)
    if (tile) this.addSkirt(tile, rSite, line, horizon ? 'orbit' : 'both')
    if (horizon) this.addRing(horizon, tile, rSite, tile ? 'eye' : 'both')
    if (!tile && !horizon) this.addSphereGround(rSite)
  }

  /** Site level (false) or eye level (true): which terrain is drawn and used for occlusion. */
  setEyeMode(eye: boolean) {
    this.eyeMode = eye
    this.orbitOnly.visible = !eye
    this.eyeOnly.visible = eye
  }

  private addMesh(g: BufferGeometry, rayProxy?: BufferGeometry, where: 'both' | 'orbit' | 'eye' = 'both') {
    const grp = where === 'both' ? this.terrain : where === 'orbit' ? this.orbitOnly : this.eyeOnly
    grp.add(new Mesh(g, regolith()))
    // Occlusion tests use an invisible double-sided twin (coarse for the tile, so project() stays cheap).
    const p = new Mesh(rayProxy ?? g, this.rayMat)
    p.visible = false
    grp.add(p)
    this.rays[where].push(p)
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
   * columns do not form radial grooves), then follows the sphere. With a horizon file every vertex is clamped to
   * the mask sight line; without one, a column never rises above its edge height (so never above the tile edge's
   * own sight line). Nodata edge → no column.
   */
  private addSkirt(t: TerrainTile, rSite: number, line: SightLine | null, where: 'both' | 'orbit') {
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
        // With a horizon the mask clamp below is the limit; without one, never above the edge height.
        const blend = e ? e.h + (smooth[k] - e.h) * w : 0
        const h = e && !line ? Math.min(e.h, blend) : blend
        const v = k * rows + j
        ok[v] = e ? 1 : 0
        pos[v * 3] = a.x * rho
        pos[v * 3 + 1] = a.y * rho
        const z = e ? sphereZ(rho, rSite, h) - SKIRT_SINK_M : 0
        pos[v * 3 + 2] = line ? Math.min(z, line.below(k, rho)) : z
      }
    }
    this.addMesh(sphereNormals(gridMesh(nAz, rows, pos, true, ok), rSite), undefined, where)
  }

  /**
   * Per azimuth k, one column of vertices: flat ground from the inner point (site, or tile edge) to the ridge
   * foot F, the ridge's inner face up to the crest T (on the mask sight line), a back slope B and a far apron.
   * F, B and the apron stay below the crest's sight line from the eye (for negative masks too), and every
   * face between two such points stays below it as well, so the silhouette from the eye is exactly the mask.
   * F and T are doubled (zero-area quads) so the ridge keeps sharp edges in the vertex normals.
   */
  private addRing(h: Horizon, tile: TerrainTile | null, rSite: number, where: 'both' | 'eye') {
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
      const slope = (t.z - he) / rho // tangent of the crest sight line, relative to the eye
      const below = (r: number) => he + slope * r // height of that sight line at horizontal distance r
      let o = k * rows * 3
      const put = (r: number, z: number) => {
        pos[o++] = a.x * r
        pos[o++] = a.y * r
        pos[o++] = z
      }
      // Horizon point inside the tile: a short face at its true distance, from the tile surface (which is clamped
      // below the mask line and may undershoot it at 80 m spacing) up to the crest. Rows before the face collapse
      // onto its foot and rows behind onto a point just behind the crest, so the column has no ground of its own.
      if (tile && rho < inner) {
        const rF = Math.max(rho - 2 * tile.meta.spacing_m, 0.6 * rho)
        const th = tileHeight(tile, a.x * rF, a.y * rF)
        const zF = Math.min(th === null ? below(rF) - 30 : sphereZ(rF, rSite, th) - SKIRT_SINK_M, below(rF) - 0.002 * rF - 0.5)
        const rB = rho + tile.meta.spacing_m
        const zB = below(rB) - 0.01 * rB - 1
        for (let j = 0; j <= nGround + 1; j++) put(rF, zF)
        put(rho, t.z)
        put(rho, t.z)
        for (let j = 0; j <= apron.length; j++) put(rB, zB)
        continue
      }
      // Horizon point just past the tile edge: push the crest out along the same sight line (same silhouette).
      if (tile && rho < inner * 1.05) {
        t.sub(eye).multiplyScalar((inner * 1.05) / rho).add(eye)
        rho = inner * 1.05
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
    this.addMesh(sphereNormals(gridMesh(n, rows, pos, true, ok), rSite), undefined, where)
  }

  /**
   * Nested levels (levels.ts), each clamped to the mask sight line: the 80 m tile with its existing per-vertex
   * clamp, the new levels with the cell-span clamp. Every outer level gets a square hole and a zipper strip to the
   * next finer one. Ray proxies: every PROXY_STRIDE-th vertex, overlapping instead of leaving a gap at the holes.
   */
  private addLevels(levels: Level[], rSite: number, line: SightLine | null) {
    this.levelNames = levels.map((l) => l.name)
    const grids: LevelGrid[] = []
    const full: BufferGeometry[] = []
    levels.forEach((l, li) => {
      const clamp = (p: Vector3, rho: number) =>
        !line ? Infinity : l.name === 'tile' ? line.belowAt(p, rho) : line.belowCell(p, rho, l.spacing)
      const g = levelGrid(l, rSite, clamp)
      const inner = li > 0 ? levels[li - 1].ext : null
      const geo = levelMesh(g, 1, inner, 'touching')
      this.addMesh(geo, levelMesh(g, PROXY_STRIDE, inner, 'inside'))
      grids.push(g)
      full.push(geo)
    })
    for (let li = 1; li < levels.length; li++) {
      this.addMesh(stitch(grids[li - 1], normalsOf(full[li - 1]), grids[li], normalsOf(full[li])))
    }
  }

  /**
   * Eye level with levels: per mask azimuth k one column foot F → crest T → back B. T sits on the mask sight line
   * at the mask distance; F (just in front, on the terrain or lower) and B (just behind) stay below the line, so
   * the silhouette from the eye is the mask, linear between samples, while the levels show the real ground.
   */
  private addCrests(h: Horizon, levels: Level[], rSite: number) {
    const n = h.mask.length
    const eye = new Vector3(0, 0, OBSERVER_HEIGHT_M)
    const he = eye.z
    const rows = 4 // F, T, T (doubled: the crest keeps a sharp edge in the vertex normals), B
    const pos = new Float32Array(n * rows * 3)
    const q = new Vector3()
    const coarsest = levels[levels.length - 1].spacing
    const nor = new Float32Array(n * rows * 3)
    let o = 0
    let on = 0
    for (let k = 0; k < n; k++) {
      const a = enuDir(k * h.az_step, 0)
      const d = Number.isFinite(h.mask_dist_km[k]) && h.mask_dist_km[k] > 0 ? h.mask_dist_km[k] * 1000 : 5000
      const t = eye.clone().addScaledVector(enuDir(k * h.az_step, h.mask[k]), d)
      const rho = Math.hypot(t.x, t.y)
      const slope = (t.z - he) / rho
      const below = (r: number) => he + slope * r
      const atT = heightAt(levels, a.x * rho, a.y * rho)
      const sp = atT ? levels[atT.li].spacing : coarsest
      const rF = Math.max(rho - 2 * sp, 0.6 * rho)
      const f = heightAt(levels, a.x * rF, a.y * rF)
      const zGround = f ? place(levels[f.li], a.x * rF, a.y * rF, f.h, rSite, q).z - SKIRT_SINK_M : below(rF) - 30
      const zF = Math.min(zGround, below(rF) - 0.002 * rF - 0.5)
      const rB = rho + sp
      const zB = below(rB) - 0.01 * rB - 1
      // Normals of the column's own radial profile: front slope (F → T, facing the eye) and back slope (T → B).
      // Not the sphere's (a Sun behind the crest must not light its near slope) and not the mesh's (the faces
      // joining two columns whose mask distances differ are connectors and would face sideways).
      const front = new Vector3(-a.x * (t.z - zF), -a.y * (t.z - zF), rho - rF).normalize()
      const back = new Vector3(a.x * (t.z - zB), a.y * (t.z - zB), rB - rho).normalize()
      for (const [r, z, nv] of [
        [rF, zF, front],
        [rho, t.z, front],
        [rho, t.z, back],
        [rB, zB, back],
      ] as const) {
        pos[o++] = a.x * r
        pos[o++] = a.y * r
        pos[o++] = z
        nor[on++] = nv.x
        nor[on++] = nv.y
        nor[on++] = nv.z
      }
    }
    const g = gridMesh(n, rows, pos, true)
    g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
    this.addMesh(g, undefined, 'eye')
  }

  /** Test helper: level names and triangle count of the terrain drawn at the current level. */
  info(): { levels: string[]; triangles: number } {
    let triangles = 0
    for (const grp of [this.terrain, this.eyeMode ? this.eyeOnly : this.orbitOnly]) {
      for (const c of grp.children) if (c.visible) triangles += ((c as Mesh).geometry.index?.count ?? 0) / 3
    }
    return { levels: [...this.levelNames], triangles }
  }

  /** Test helper (crack check): flat unlit grey terrain, so any background pixel inside the terrain is a gap. */
  setFlat(on: boolean) {
    for (const grp of [this.terrain, this.orbitOnly, this.eyeOnly]) {
      for (const c of grp.children) {
        const m = c as Mesh
        if (!m.visible) continue
        m.userData.lit ??= m.material
        m.material = on ? this.flatMat : m.userData.lit
      }
    }
  }

  private addTile(t: TerrainTile, rSite: number, line: SightLine | null) {
    const { size, spacing_m, nodata } = t.meta
    const half = (size - 1) / 2
    // Heights once (curvature applied, clamped to the mask sight line), then the full and the coarse mesh.
    const zGrid = new Float32Array(size * size)
    const okGrid = new Uint8Array(size * size)
    const p = new Vector3()
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const x = (j - half) * spacing_m
        const y = (half - i) * spacing_m
        const hv = t.heights[i * size + j]
        const rho = Math.hypot(x, y)
        okGrid[i * size + j] = hv !== nodata && rho <= TILE_RADIUS_M ? 1 : 0
        let z = sphereZ(rho, rSite, hv === nodata ? 0 : hv)
        if (line && rho > 0) z = Math.min(z, line.belowAt(p.set(x, y, 0), rho))
        zGrid[i * size + j] = z
      }
    }
    const make = (stride: number) => {
      const m = Math.floor((size - 1) / stride) + 1
      const pos = new Float32Array(m * m * 3)
      const ok = new Uint8Array(m * m)
      for (let ii = 0; ii < m; ii++) {
        for (let jj = 0; jj < m; jj++) {
          const i = ii * stride
          const j = jj * stride
          const v = ii * m + jj
          ok[v] = okGrid[i * size + j]
          pos[v * 3] = (j - half) * spacing_m
          pos[v * 3 + 1] = (half - i) * spacing_m
          pos[v * 3 + 2] = zGrid[i * size + j]
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
  occluded(from: Vector3, dir: Vector3, maxDist = Infinity, eye = this.eyeMode): boolean {
    this.raycaster.set(from, dir)
    this.raycaster.far = maxDist
    const targets = [...this.rays.both, ...(eye ? this.rays.eye : this.rays.orbit)]
    return this.raycaster.intersectObjects(targets, false).length > 0
  }
}
