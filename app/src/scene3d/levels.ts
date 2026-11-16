// Nested terrain levels around a site (track-terrain): fine 20 m (±2.5 km) ⊂ the 80 m tile (±20 km) ⊂ near 160 m
// (±40 km, wave 3: 2 × 2 means of the south-cap 80 m tiles, data/southcap.ts) ⊂ mid 400 m (±60 km) ⊂ far 2 km
// (±300 km). All grids share the site's ENU axes and centre (row 0 = north, col 0 = west),
// the Int16 format and ONE reference height (the 80 m tile's ground_m), so their squares nest on grid lines.
//
// Meeting without cracks or z-fighting: each outer level drops every cell that intersects the next inner level's
// square (a square hole on its own grid lines, at most one outer cell wider than the inner square), and a zipper
// strip joins the inner level's boundary ring to the outer hole's boundary ring. Strip vertices are the two
// levels' own vertices (same positions, same normals), so the surface is watertight and nothing overlaps.
//
// Curvature: fine and 80 m tile keep the 80 m tile's existing placement, (x, y) in the tangent plane and
// z = √((R_site + h)² − ρ²) − R_site. Near, mid and far blend from that placement (ρ ≤ 20 km) to the exact one by
// ρ = 60 km: the grid point's radial line through the 1737.4 km sphere at (x, y, R)/|·|, radius R_site + h. At
// 300 km the two differ by 4.4 km horizontally; within the blend band by < 0.1 km.
//
// Rim band: within MORPH_CELLS outer cells of its square's edge, an inner level's heights blend (smoothstep) into
// the outer level's bilinear surface, so finer detail fades out instead of ending at a visible line. Both are
// resamplings of the same DEM; nothing is invented. The shading follows (wave 3): every level's normals come from
// its grid by central differences (not from its faces, which end one-sided at a hole or a rim), and in the rim
// band they blend with the same weight into the outer level's normals, so at a border the light falls on both
// sides alike and no line shows under a low Sun.
//
// Nodata: a vertex a level has no data for takes the height of the next coarser level that has (the far level
// is filled from ldem_16 outside the polar DEM), Catmull-Rom interpolated so the coarse cells do not show as
// facets; a vertex no level covers stays a hole. Within the same band as at the rim, the vertices with data next
// to such a fill blend into it (wave 3): where the polar DEM ends (im-1, 4 km north of the site) its heights and
// the fill's differ, and the step showed as a straight crease under a low Sun.

import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'
import type { TerrainTile } from '../data/types'
import { MOON_RADIUS_KM } from '../geometry'

export type LevelName = 'fine' | 'tile' | 'near' | 'mid' | 'far'

export interface Level {
  name: LevelName
  size: number
  spacing: number
  half: number // (size − 1) / 2
  ext: number // half-width of the sample square (m)
  /** Heights relative to the site's ground (m) after the coarser-level fill; NaN = no level has data. */
  h: Float32Array
}

const R_M = MOON_RADIUS_KM * 1000
export const BLEND_FROM_M = 20_000
export const BLEND_TO_M = 60_000
export const MORPH_CELLS = 6 // rim band of an inner level, in cells of the next outer level
const STITCH_ORDER: LevelName[] = ['fine', 'tile', 'near', 'mid', 'far']

/** Sphere drop below the site's tangent plane at horizontal distance rho (m), exact: √(R² − ρ²) − R. */
export function sphereZ(rho: number, rSite: number, h = 0): number {
  const r = rSite + h
  return Math.sqrt(Math.max(r * r - rho * rho, 0)) - rSite
}

/**
 * Levels of a tile, finest first, or null when the tile has no far level (the scene then draws the 80 m tile
 * alone, exactly as before). A level that does not strictly contain the next finer one is left out.
 */
export function nestedLevels(tile: TerrainTile): Level[] | null {
  const extra = new Map((tile.levels ?? []).map((t) => [t.meta.level, t]))
  if (!extra.has('far')) return null
  const raw: [LevelName, TerrainTile][] = []
  for (const name of STITCH_ORDER) {
    const t = name === 'tile' ? tile : extra.get(name)
    if (!t || t.heights.length !== t.meta.size * t.meta.size) continue
    const prev = raw[raw.length - 1]?.[1]
    const ext = ((t.meta.size - 1) / 2) * t.meta.spacing_m
    if (prev && !(ext > ((prev.meta.size - 1) / 2) * prev.meta.spacing_m && t.meta.spacing_m > prev.meta.spacing_m)) continue
    raw.push([name, t])
  }
  if (raw[raw.length - 1]?.[0] !== 'far') return null
  const levels: Level[] = raw.map(([name, t]) => {
    const half = (t.meta.size - 1) / 2
    return { name, size: t.meta.size, spacing: t.meta.spacing_m, half, ext: half * t.meta.spacing_m, h: new Float32Array(t.heights.length) }
  })
  // Coarsest first, so every level can fall back on the already-filled (and morphed) coarser ones.
  for (let li = levels.length - 1; li >= 0; li--) {
    const l = levels[li]
    const t = raw[li][1]
    const outer = levels[li + 1]
    const band = outer ? MORPH_CELLS * outer.spacing : 0
    const scale = t.meta.height_scale_m ?? 1
    const toFill = band > 0 ? fillDistance(t, l.spacing) : null
    for (let i = 0; i < l.size; i++) {
      for (let j = 0; j < l.size; j++) {
        const x = (j - l.half) * l.spacing
        const y = (l.half - i) * l.spacing
        const v = t.heights[i * l.size + j]
        // Nodata: the next coarser level with data, interpolated smoothly (bilinear would show its cells as facets).
        let h = v !== t.meta.nodata ? v * scale : smoothHeightAt(levels, x, y, li + 1) ?? NaN
        // Data next to a fill: blend into the fill's surface, which the filled vertices are on.
        const d = toFill ? toFill[i * l.size + j] : Infinity
        if (d > 0 && d < band && !Number.isNaN(h)) {
          const f = smoothHeightAt(levels, x, y, li + 1)
          if (f !== null) {
            const b = d / band
            h = f + (h - f) * b * b * (3 - 2 * b)
          }
        }
        // Rim band: blend into the outer level's surface, which the inner rim then meets exactly.
        const edge = l.ext - Math.max(Math.abs(x), Math.abs(y))
        if (outer && edge < band && !Number.isNaN(h)) {
          const o = levelHeight(outer, x, y)
          if (o !== null) {
            const b = edge / band
            h = o + (h - o) * b * b * (3 - 2 * b)
          }
        }
        l.h[i * l.size + j] = h
      }
    }
  }
  return levels
}

/**
 * Distance (m) from every sample of a level file to its nearest nodata sample (two-pass chamfer on the grid:
 * steps of one spacing along a row or column, √2 spacings diagonally), Infinity when it has none; null when the
 * file has no nodata at all.
 */
function fillDistance(t: TerrainTile, spacing: number): Float32Array | null {
  const n = t.meta.size
  const nodata = t.meta.nodata
  if (!t.heights.includes(nodata)) return null
  const d = new Float32Array(n * n)
  for (let k = 0; k < n * n; k++) d[k] = t.heights[k] === nodata ? 0 : Infinity
  const s = spacing
  const s2 = spacing * Math.SQRT2
  const at = (i: number, j: number) => (i >= 0 && i < n && j >= 0 && j < n ? d[i * n + j] : Infinity)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const k = i * n + j
      d[k] = Math.min(d[k], at(i, j - 1) + s, at(i - 1, j) + s, at(i - 1, j - 1) + s2, at(i - 1, j + 1) + s2)
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      const k = i * n + j
      d[k] = Math.min(d[k], at(i, j + 1) + s, at(i + 1, j) + s, at(i + 1, j + 1) + s2, at(i + 1, j - 1) + s2)
    }
  }
  return d
}

/** Catmull-Rom (bicubic) height of level l at ENU (x, y); bilinear where the 4 × 4 stencil leaves the data. */
function smoothHeight(l: Level, x: number, y: number): number | null {
  const fj = x / l.spacing + l.half
  const fi = l.half - y / l.spacing
  const j0 = Math.floor(fj)
  const i0 = Math.floor(fi)
  if (j0 < 1 || i0 < 1 || j0 + 2 > l.size - 1 || i0 + 2 > l.size - 1) return levelHeight(l, x, y)
  const cr = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)))
  const row = (i: number) => {
    const o = i * l.size + j0
    return cr(l.h[o - 1], l.h[o], l.h[o + 1], l.h[o + 2], fj - j0)
  }
  const v = cr(row(i0 - 1), row(i0), row(i0 + 1), row(i0 + 2), fi - i0)
  return Number.isNaN(v) ? levelHeight(l, x, y) : v
}

function smoothHeightAt(levels: Level[], x: number, y: number, from: number): number | null {
  for (let li = from; li < levels.length; li++) {
    const h = smoothHeight(levels[li], x, y)
    if (h !== null) return h
  }
  return null
}

/** Bilinear height of level l at ENU (x, y); null outside its square or next to a hole. */
export function levelHeight(l: Level, x: number, y: number): number | null {
  const fj = x / l.spacing + l.half
  const fi = l.half - y / l.spacing
  if (fj < 0 || fi < 0 || fj > l.size - 1 || fi > l.size - 1) return null
  const j0 = Math.min(Math.floor(fj), l.size - 2)
  const i0 = Math.min(Math.floor(fi), l.size - 2)
  const dj = fj - j0
  const di = fi - i0
  const n = l.size
  const q00 = l.h[i0 * n + j0]
  const q01 = l.h[i0 * n + j0 + 1]
  const q10 = l.h[(i0 + 1) * n + j0]
  const q11 = l.h[(i0 + 1) * n + j0 + 1]
  const v = (q00 * (1 - dj) + q01 * dj) * (1 - di) + (q10 * (1 - dj) + q11 * dj) * di
  return Number.isNaN(v) ? null : v
}

/** Height from the finest level (index ≥ from) that covers (x, y), with that level's index. */
export function heightAt(levels: Level[], x: number, y: number, from = 0): { h: number; li: number } | null {
  for (let li = from; li < levels.length; li++) {
    const h = levelHeight(levels[li], x, y)
    if (h !== null) return { h, li }
  }
  return null
}

/** ENU position of a level sample at grid offset (x, y) with height h (curvature as in the header). */
export function place(l: Level, x: number, y: number, h: number, rSite: number, out: Vector3): Vector3 {
  const rho = Math.hypot(x, y)
  out.set(x, y, sphereZ(rho, rSite, h))
  if (l.name === 'fine' || l.name === 'tile' || rho <= BLEND_FROM_M) return out
  const b = Math.min((rho - BLEND_FROM_M) / (BLEND_TO_M - BLEND_FROM_M), 1)
  const w = b * b * (3 - 2 * b)
  const s = (rSite + h) / Math.sqrt(rho * rho + R_M * R_M)
  return out.set(out.x + (s * x - out.x) * w, out.y + (s * y - out.y) * w, out.z + (s * R_M - rSite - out.z) * w)
}

export interface LevelGrid {
  level: Level
  pos: Float32Array // size² × 3, row-major like the heights
  ok: Uint8Array // 1 = vertex has a height
}

/** Placed (and clamped) vertices of a level. clamp(p, rho) returns the highest z allowed at p, or Infinity. */
export function levelGrid(l: Level, rSite: number, clamp: (p: Vector3, rho: number) => number): LevelGrid {
  const n = l.size
  const pos = new Float32Array(n * n * 3)
  const ok = new Uint8Array(n * n)
  const p = new Vector3()
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = i * n + j
      const h = l.h[v]
      ok[v] = Number.isNaN(h) ? 0 : 1
      place(l, (j - l.half) * l.spacing, (l.half - i) * l.spacing, ok[v] ? h : 0, rSite, p)
      const rho = Math.hypot(p.x, p.y)
      if (ok[v] && rho > 0) p.z = Math.min(p.z, clamp(p, rho))
      pos[v * 3] = p.x
      pos[v * 3 + 1] = p.y
      pos[v * 3 + 2] = p.z
    }
  }
  return { level: l, pos, ok }
}

/**
 * Height (ENU z) of the drawn surface of a full-resolution level mesh (levelMesh, stride 1) at the ENU point
 * (x, y): the triangle of the quad under it, split along the NE–SW diagonal exactly as levelMesh's index buffer
 * (a, c, b) + (b, c, d), interpolated linearly between the placed and clamped vertices. Not the bilinear height:
 * where a quad is not flat the drawn triangles lie above it by up to a quarter of the quad's twist (U19). null
 * where this mesh draws nothing: outside the grid, a quad with a vertex without data, or a quad inside the hole the
 * next finer level's square (half-width `inner`) cuts.
 *
 * Beyond 20 km the vertices are not at their grid offsets (place: the blend to the radial placement moves them
 * by up to 4.4 km at 300 km), so the grid position under (x, y) is found by inverting the placement locally (a
 * few steps of the bilinear map of the cell's placed corners).
 */
export function surfaceZ(g: LevelGrid, x: number, y: number, inner: number | null): number | null {
  const { level: l, pos, ok } = g
  const n = l.size
  let gx = x
  let gy = y
  let i0 = 0
  let j0 = 0
  for (let step = 0; step < 4; step++) {
    const fj = gx / l.spacing + l.half
    const fi = l.half - gy / l.spacing
    if (fj < 0 || fi < 0 || fj > n - 1 || fi > n - 1) return null
    j0 = Math.min(Math.floor(fj), n - 2)
    i0 = Math.min(Math.floor(fi), n - 2)
    if (l.name === 'fine' || l.name === 'tile' || Math.hypot(gx, gy) <= BLEND_FROM_M * 0.99) break
    // Placed position of grid point (gx, gy) by the bilinear map of the cell's corners; move by the miss.
    const dj = fj - j0
    const di = fi - i0
    const k = [i0 * n + j0, i0 * n + j0 + 1, (i0 + 1) * n + j0, (i0 + 1) * n + j0 + 1]
    const w = [(1 - dj) * (1 - di), dj * (1 - di), (1 - dj) * di, dj * di]
    let px = 0
    let py = 0
    for (let c = 0; c < 4; c++) {
      px += pos[k[c] * 3] * w[c]
      py += pos[k[c] * 3 + 1] * w[c]
    }
    const ex = x - px
    const ey = y - py
    if (Math.abs(ex) < 1e-3 && Math.abs(ey) < 1e-3) break
    gx += ex
    gy += ey
  }
  const a = i0 * n + j0 // north-west
  const b = a + 1 // north-east
  const c = a + n // south-west
  const d = c + 1 // south-east
  if (!(ok[a] && ok[b] && ok[c] && ok[d])) return null
  if (inner !== null) {
    const x0 = (j0 - l.half) * l.spacing
    const x1 = x0 + l.spacing
    const y1 = (l.half - i0) * l.spacing
    const y0 = y1 - l.spacing
    if (x1 > -inner && x0 < inner && y1 > -inner && y0 < inner) return null // levelMesh 'touching'
  }
  // Which of the two triangles: by the grid position (dj + di ≤ 1 → a, c, b), then exact barycentric weights from
  // the triangle's placed corners, so the height is that of the drawn plane through them.
  const dj = gx / l.spacing + l.half - j0
  const di = l.half - gy / l.spacing - i0
  const [p, q, r] = dj + di <= 1 ? [a, c, b] : [b, c, d]
  const ax = pos[p * 3]
  const ay = pos[p * 3 + 1]
  const bx = pos[q * 3] - ax
  const by = pos[q * 3 + 1] - ay
  const cx = pos[r * 3] - ax
  const cy = pos[r * 3 + 1] - ay
  const det = bx * cy - by * cx
  if (det === 0) return null
  const u = ((x - ax) * cy - (y - ay) * cx) / det
  const v = (bx * (y - ay) - by * (x - ax)) / det
  const za = pos[p * 3 + 2]
  return za + u * (pos[q * 3 + 2] - za) + v * (pos[r * 3 + 2] - za)
}

/** Grid coordinate index range [k0, k1] of the hole an inner square of half-width ext cuts into level l. */
function holeRange(l: Level, ext: number): [number, number] {
  const k1 = Math.ceil(ext / l.spacing + l.half - 1e-6)
  return [l.size - 1 - k1, k1]
}

/**
 * Vertex normals of a placed (and clamped) level grid by central differences, one-sided at the grid's edge and
 * next to a vertex without data: (P east − P west) × (P north − P south), normalised.
 */
export function gridNormals(g: LevelGrid): Float32Array {
  const { level: l, pos, ok } = g
  const n = l.size
  const out = new Float32Array(n * n * 3)
  const e = new Vector3()
  const w = new Vector3()
  const no = new Vector3()
  const so = new Vector3()
  const at = (i: number, j: number, fallback: number, v: Vector3) => {
    const k = i >= 0 && i < n && j >= 0 && j < n && ok[i * n + j] ? i * n + j : fallback
    return v.fromArray(pos, k * 3)
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const c = i * n + j
      at(i, j + 1, c, e).sub(at(i, j - 1, c, w))
      at(i - 1, j, c, no).sub(at(i + 1, j, c, so))
      e.cross(no)
      if (!(e.lengthSq() > 0)) e.set(0, 0, 1)
      e.normalize().toArray(out, c * 3)
    }
  }
  return out
}

/**
 * Normals of every level (finest first, like `levels` and `grids`): grid normals, and within an inner level's rim
 * band (where nestedLevels morphs its heights into the next outer level) blended with the same smoothstep weight
 * into the outer level's normals, interpolated bilinearly. At the inner rim they are the outer level's own.
 */
export function levelNormals(levels: Level[], grids: LevelGrid[]): Float32Array[] {
  const out = grids.map(gridNormals)
  const a = new Vector3()
  const b = new Vector3()
  for (let li = levels.length - 2; li >= 0; li--) {
    const l = levels[li]
    const o = levels[li + 1]
    const band = MORPH_CELLS * o.spacing
    const on = out[li + 1]
    const nn = out[li]
    for (let i = 0; i < l.size; i++) {
      for (let j = 0; j < l.size; j++) {
        const x = (j - l.half) * l.spacing
        const y = (l.half - i) * l.spacing
        const edge = l.ext - Math.max(Math.abs(x), Math.abs(y))
        if (edge >= band) continue
        // Outer normal at (x, y): bilinear in the outer grid.
        const fj = x / o.spacing + o.half
        const fi = o.half - y / o.spacing
        const j0 = Math.min(Math.max(Math.floor(fj), 0), o.size - 2)
        const i0 = Math.min(Math.max(Math.floor(fi), 0), o.size - 2)
        const dj = fj - j0
        const di = fi - i0
        a.set(0, 0, 0)
        for (const [ii, jj, wgt] of [[i0, j0, (1 - di) * (1 - dj)], [i0, j0 + 1, (1 - di) * dj], [i0 + 1, j0, di * (1 - dj)], [i0 + 1, j0 + 1, di * dj]]) {
          a.addScaledVector(b.fromArray(on, (ii * o.size + jj) * 3), wgt)
        }
        const t = Math.max(edge, 0) / band
        const wIn = t * t * (3 - 2 * t)
        const k = (i * l.size + j) * 3
        a.normalize()
        b.fromArray(nn, k).sub(a).multiplyScalar(wIn).add(a).normalize().toArray(nn, k)
      }
    }
  }
  return out
}

/**
 * Indexed mesh of a level with every `stride`-th vertex. inner = half-width of the next finer level's square:
 * with drop 'touching', cells that intersect it are left out (the render mesh: a hole on grid lines); with
 * 'inside', only cells entirely within it (ray proxies: an overlap instead of a gap).
 */
export function levelMesh(g: LevelGrid, stride: number, inner: number | null, drop: 'touching' | 'inside', normals?: Float32Array): BufferGeometry {
  const { level: l, pos, ok } = g
  const n = l.size
  const m = Math.floor((n - 1) / stride) + 1
  const sub = new Float32Array(m * m * 3)
  const subOk = new Uint8Array(m * m)
  for (let ii = 0; ii < m; ii++) {
    for (let jj = 0; jj < m; jj++) {
      const v = ii * stride * n + jj * stride
      const s = ii * m + jj
      subOk[s] = ok[v]
      sub[s * 3] = pos[v * 3]
      sub[s * 3 + 1] = pos[v * 3 + 1]
      sub[s * 3 + 2] = pos[v * 3 + 2]
    }
  }
  const coord = (k: number) => (k * stride - l.half) * l.spacing // grid x of column k (= −y of row k)
  const idx: number[] = []
  for (let ii = 0; ii < m - 1; ii++) {
    for (let jj = 0; jj < m - 1; jj++) {
      const a = ii * m + jj // north-west
      const b = a + 1 // north-east
      const c = a + m // south-west
      const d = c + 1
      if (!(subOk[a] && subOk[b] && subOk[c] && subOk[d])) continue
      if (inner !== null) {
        const x0 = coord(jj)
        const x1 = coord(jj + 1)
        const y0 = -coord(ii + 1)
        const y1 = -coord(ii)
        const cut =
          drop === 'touching'
            ? x1 > -inner && x0 < inner && y1 > -inner && y0 < inner
            : x0 >= -inner && x1 <= inner && y0 >= -inner && y1 <= inner
        if (cut) continue
      }
      idx.push(a, c, b, b, c, d) // counter-clockwise seen from above
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(sub, 3))
  geo.setIndex(idx)
  // Given normals (levelNormals, stride 1 only) replace the face-based ones.
  if (normals && stride === 1) geo.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  else geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

/** Boundary ring of grid indices k0..k1 (both axes), clockwise from the north-west corner, with perimeter fraction. */
function ring(n: number, k0: number, k1: number): { v: number[]; t: number[] } {
  const v: number[] = []
  const t: number[] = []
  const w = k1 - k0
  for (let j = k0; j < k1; j++) v.push(k0 * n + j), t.push((j - k0) / w / 4) // north edge, west → east
  for (let i = k0; i < k1; i++) v.push(i * n + k1), t.push(0.25 + (i - k0) / w / 4) // east edge, north → south
  for (let j = k1; j > k0; j--) v.push(k1 * n + j), t.push(0.5 + (k1 - j) / w / 4) // south edge, east → west
  for (let i = k1; i > k0; i--) v.push(i * n + k0), t.push(0.75 + (k1 - i) / w / 4) // west edge, south → north
  return { v, t }
}

/**
 * Zipper strip between the inner level's boundary ring and the outer level's hole ring. Both rings are concentric
 * axis-aligned squares walked clockwise from their north-west corners, so equal perimeter fractions face each
 * other and the strip never folds. Positions and normals are copied from the two level meshes.
 */
export function stitch(inner: LevelGrid, innerNormals: Float32Array, outer: LevelGrid, outerNormals: Float32Array): BufferGeometry {
  const ni = inner.level.size
  const ri = ring(ni, 0, ni - 1)
  const [k0, k1] = holeRange(outer.level, inner.level.ext)
  const ro = ring(outer.level.size, k0, k1)
  const nI = ri.v.length
  const nO = ro.v.length
  const pos = new Float32Array((nI + nO) * 3)
  const nor = new Float32Array((nI + nO) * 3)
  const ok = new Uint8Array(nI + nO)
  const copy = (dst: number, g: LevelGrid, normals: Float32Array, v: number) => {
    const bad = !(Math.abs(normals[v * 3 + 2]) > 0) // vertex in no triangle of its level: zero or NaN normal
    for (let c = 0; c < 3; c++) {
      pos[dst * 3 + c] = g.pos[v * 3 + c]
      nor[dst * 3 + c] = bad ? (c === 2 ? 1 : 0) : normals[v * 3 + c]
    }
    ok[dst] = g.ok[v]
  }
  ri.v.forEach((v, k) => copy(k, inner, innerNormals, v))
  ro.v.forEach((v, k) => copy(nI + k, outer, outerNormals, v))
  const idx: number[] = []
  const tri = (a: number, b: number, c: number) => {
    if (ok[a] && ok[b] && ok[c]) idx.push(a, b, c)
  }
  let a = 0
  let b = 0
  while (a < nI || b < nO) {
    const ta = a < nI ? (a + 1 < nI ? ri.t[a + 1] : 1) : Infinity
    const tb = b < nO ? (b + 1 < nO ? ro.t[b + 1] : 1) : Infinity
    if (ta <= tb) {
      tri(a % nI, (a + 1) % nI, nI + (b % nO)) // inner edge + outer vertex (counter-clockwise seen from above)
      a++
    } else {
      tri(a % nI, nI + ((b + 1) % nO), nI + (b % nO))
      b++
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  geo.setIndex(idx)
  geo.computeBoundingSphere()
  return geo
}

/** Vertex normals of a full-resolution level mesh (stride 1), for the strips. */
export const normalsOf = (g: BufferGeometry) => g.attributes.normal.array as Float32Array
