// South-cap terrain in the browser: heights, a site terrain and a horizon mask for ANY point south of 80° S,
// from the rasters scripts/south_cap.py writes to public/data/terrain/cap/ (cap.json describes them):
//   base   400 m, the 20 m DEM's whole 608 km square (loaded once, 4.6 MB). The 80° S circle is 5.6 m wider than
//          the square at the four axis longitudes; samples there come from the outer raster.
//   outer  1920 m, ±737 km around the pole, from the 120 m DEM (loaded once, 1.2 MB): keeps 300 km rays and the
//          corners of a ±300 km far level on data for every point of the cap
//   80, 40 tile levels at 80 m and 40 m (256 × 256 samples per tile, fetched on demand); which tiles exist is
//          read from cap.json's index (each level's latitude limit is set in south_cap.py LEVELS, nowhere else)
// All are box means of the LOLA polar DEMs in the DEM's own south polar stereographic projection on the 1737.4 km
// sphere (+x toward 90° E, +y toward longitude 0), heights in metres above that sphere. The projection of a unit
// vector u is rational, no angles: x = 2R·u_y / (1 − u_z), y = 2R·u_x / (1 − u_z).
//
// capTerrain(lat, lon) builds what loadTerrain(siteId) returns for a prepared site (scripts/terrain_tiles.py:
// local ENU plane, row 0 = north, col 0 = west, heights relative to the point's ground height), so scene3d/site.ts
// renders it unchanged, plus a 'near' level (160 m, ±40 km, from 2 × 2 means of the 80 m tiles) between the 80 m
// grid and mid. SouthCap.nearLevel() builds that level alone for a prepared site, relative to its own ground_m. capHorizon(lat, lon) follows scripts/horizon.py (720 azimuths, its ray distances to
// 300 km, eye 1.75 m, elevation over the curved surface, slope over a 100 m baseline) on coarser terrain than the
// pipeline's 20 m DEM: an APPROXIMATE mask, labelled as such in the returned object. Measured differences against
// the 18 pipeline horizons: southcap.test.ts. Nothing here is validated by the science lead.

import { MOON_RADIUS_KM, OBSERVER_HEIGHT_M, enuBasis, siteVector } from '../geometry'
import { inPinRegion } from '../scene3d/region'
import { MissingDataError } from './load'
import type { Horizon, TerrainMeta, TerrainTile, Vec3 } from './types'

const R_M = MOON_RADIUS_KM * 1000
const DEG = Math.PI / 180
const NODATA = -32768
const ORDER = 'row-major; row 0 = north edge; col 0 = west edge'
const HEIGHT_REF = "metres relative to the site's ground height"
const HEIGHT_SCALES = [0.1, 0.25, 0.5, 1] // m per Int16 unit, as terrain_tiles.py
const TILE_SCALES = [0.25, 0.5, 1] // the 80 m grid: the 80 m tiles' own 0.25 m steps where its relief fits Int16
const MAX_TILES = 200 // tiles kept in memory per level (131 kB each); the least recently requested go first

// Site grids, as scripts/terrain_tiles.py (SIZE/SPACING_M and LEVELS); fine is 40 m here, not 20 m.
const TILE_GRID = { size: 500, spacing: 80 }
const FINE_GRID = { size: 251, spacing: 40 }
const MID_GRID = { size: 301, spacing: 400 }
// Between the 80 m grid (±20 km) and mid (wave 3, 14 Nov): 160 m to ±40 km, 2 × 2 means of the 80 m cap tiles.
const NEAR_GRID = { size: 501, spacing: 160 }
const NEAR_BLOCK = NEAR_GRID.spacing / TILE_GRID.spacing
const FAR_GRID = { size: 301, spacing: 2000 }

// Horizon, as scripts/horizon.py.
const N_AZ = 720
const AZ_STEP = 0.5
const RAY_MAX_KM = 300
const SLOPE_HALF_BASE_M = 50
/** Rings of the browser horizon: the 40 m level inside fineKm, the 80 m level inside nearKm, the base beyond. */
export interface CapHorizonRings {
  fineKm: number
  nearKm: number
}
export const CAP_HORIZON_RINGS: CapHorizonRings = { fineKm: 5, nearKm: 20 }

// ---------- cap.json ----------

export interface CapRasterInfo {
  file: string
  spacing_m: number
  width: number
  height: number
  x0_m: number // -x edge of column 0
  y0_m: number // +y edge of row 0
  height_scale_m: number
  resampling: string
}

export interface CapLevelInfo extends Omit<CapRasterInfo, 'file'> {
  name: string // spacing in metres: "40", "80"
  tile_size: number
  north_lat: number
  complete: boolean
  tile_count: number
  bytes: number
  tiles: Record<string, [number, number][]> // tile row -> runs of [first col, last col]
}

export interface CapMeta {
  validation: string
  projection: { proj4: string; lat_0: number; lon_0: number; R_m: number }
  height_ref: string
  nodata: number
  north_lat: number
  source: { file: string; sha256: string; url: string; citation: string }
  base: CapRasterInfo
  outer: CapRasterInfo & { source: { file: string } }
  levels: CapLevelInfo[] // finest first
}

/** How the files are read: the app fetches them, tests read them from disk. null = the file does not exist. */
export interface CapIo {
  json(path: string): Promise<unknown>
  bytes(path: string): Promise<ArrayBuffer | null>
}

// ---------- projection (no angles) ----------

/** Projected metres of a unit MOON_ME vector. */
export function capXYOfUnit(ux: number, uy: number, uz: number): [number, number] {
  const k = (2 * R_M) / (1 - uz)
  return [k * uy, k * ux]
}

/** Unit MOON_ME vector of projected metres. */
export function capUnitOfXY(x: number, y: number): Vec3 {
  const s2 = (x * x + y * y) / (4 * R_M * R_M)
  const uz = (s2 - 1) / (s2 + 1)
  const k = (1 - uz) / (2 * R_M)
  return [k * y, k * x, uz]
}

/** Projected metres of planetocentric lat/lon (degrees, east-positive). */
export function capXY(lat: number, lon: number): [number, number] {
  const u = siteVector(lat, lon, 0) // MOON_RADIUS_KM · unit(lat, lon)
  return capXYOfUnit(u[0] / MOON_RADIUS_KM, u[1] / MOON_RADIUS_KM, u[2] / MOON_RADIUS_KM)
}

// ---------- rasters ----------

function int16(buf: ArrayBuffer): Int16Array {
  const n = buf.byteLength >> 1
  if (new Uint8Array(new Uint16Array([1]).buffer)[0] === 1) return new Int16Array(buf, 0, n) // little-endian host
  const view = new DataView(buf)
  const out = new Int16Array(n)
  for (let i = 0; i < n; i++) out[i] = view.getInt16(i * 2, true)
  return out
}

/** One raster held whole in memory; bilinear in metres, NaN outside or next to nodata. */
class Grid {
  constructor(
    readonly spacing: number,
    readonly width: number,
    readonly height: number,
    readonly x0: number,
    readonly y0: number,
    private readonly data: Int16Array | Float32Array,
    private readonly scale: number,
  ) {}

  private v(r: number, c: number): number {
    const q = this.data[r * this.width + c]
    return q === NODATA ? NaN : q * this.scale
  }

  sample(x: number, y: number): number {
    const fc = (x - this.x0) / this.spacing - 0.5
    const fr = (this.y0 - y) / this.spacing - 0.5
    const c0 = Math.floor(fc)
    const r0 = Math.floor(fr)
    if (!(c0 >= 0 && r0 >= 0 && c0 + 1 < this.width && r0 + 1 < this.height)) return NaN
    const dc = fc - c0
    const dr = fr - r0
    return (this.v(r0, c0) * (1 - dc) + this.v(r0, c0 + 1) * dc) * (1 - dr) + (this.v(r0 + 1, c0) * (1 - dc) + this.v(r0 + 1, c0 + 1) * dc) * dr
  }

  /** k × k block means as a new grid (far level: 2 km means of the 400 m base). */
  blockMeans(k: number): Grid {
    const w = Math.floor(this.width / k)
    const h = Math.floor(this.height / k)
    const out = new Float32Array(w * h)
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        let s = 0
        let n = 0
        for (let i = 0; i < k; i++) {
          for (let j = 0; j < k; j++) {
            const q = this.v(r * k + i, c * k + j)
            if (!Number.isNaN(q)) (s += q), n++
          }
        }
        out[r * w + c] = n ? s / n : NaN
      }
    }
    return new FloatGrid(this.spacing * k, w, h, this.x0, this.y0, out)
  }
}

class FloatGrid extends Grid {
  constructor(spacing: number, width: number, height: number, x0: number, y0: number, data: Float32Array) {
    super(spacing, width, height, x0, y0, data, 1) // NaN marks nodata; NaN !== NODATA, so v() returns it as is
  }
}

/** A tile level: tiles are fetched on demand; a sample on a tile that is not in memory is NaN. */
class TileLevel {
  private readonly tiles = new Map<number, Int16Array>()
  private readonly pending = new Map<number, Promise<void>>()
  private readonly nTiles: number
  private lastKey = -1
  private last: Int16Array | null = null
  fetched = 0 // tiles fetched so far (reported by the tests)

  constructor(
    readonly info: CapLevelInfo,
    private readonly io: CapIo,
  ) {
    this.nTiles = Math.ceil(info.width / info.tile_size)
  }

  exists(tr: number, tc: number): boolean {
    return (this.info.tiles[String(tr)] ?? []).some(([a, b]) => tc >= a && tc <= b)
  }

  /** Is the tile holding projected point (x, y) part of this level? */
  covers(x: number, y: number): boolean {
    const t = this.info.tile_size * this.info.spacing_m
    return this.exists(Math.floor((this.info.y0_m - y) / t), Math.floor((x - this.info.x0_m) / t))
  }

  /**
   * Fetch the existing tiles that bilinear samples at the projected points xy (x0, y0, x1, y1, ...) touch; with
   * k > 1, bilinear samples of the k × k block means (sampleMeans).
   */
  async ensurePoints(xy: Float64Array, k = 1): Promise<void> {
    const { spacing_m, tile_size: n, x0_m, y0_m } = this.info
    const s = spacing_m * k
    const keys = new Set<number>()
    for (let i = 0; i < xy.length; i += 2) {
      const c0 = Math.floor((xy[i] - x0_m) / s - 0.5)
      const r0 = Math.floor((y0_m - xy[i + 1]) / s - 0.5)
      // Blocks r0 and r0 + 1 cover the level's rows r0·k … (r0 + 2)·k − 1.
      const ta = Math.floor((r0 * k) / n)
      const tb = Math.floor(((r0 + 2) * k - 1) / n)
      const tc = Math.floor((c0 * k) / n)
      const td = Math.floor(((c0 + 2) * k - 1) / n)
      keys.add(ta * 4096 + tc)
      if (tb !== ta || td !== tc) keys.add(ta * 4096 + td).add(tb * 4096 + tc).add(tb * 4096 + td)
    }
    await this.ensureKeys(keys)
  }

  /** Fetch the existing tiles within projected distance r of (cx, cy). */
  async ensureDisc(cx: number, cy: number, r: number): Promise<void> {
    const t = this.info.tile_size * this.info.spacing_m
    const { x0_m, y0_m } = this.info
    const keys = new Set<number>()
    for (let tr = Math.floor((y0_m - cy - r) / t); tr <= Math.floor((y0_m - cy + r) / t); tr++) {
      for (let tc = Math.floor((cx - r - x0_m) / t); tc <= Math.floor((cx + r - x0_m) / t); tc++) {
        const dx = Math.max(x0_m + tc * t - cx, 0, cx - (x0_m + (tc + 1) * t))
        const dy = Math.max(y0_m - (tr + 1) * t - cy, 0, cy - (y0_m - tr * t))
        if (Math.hypot(dx, dy) <= r) keys.add(tr * 4096 + tc)
      }
    }
    await this.ensureKeys(keys)
  }

  private async ensureKeys(keys: Set<number>): Promise<void> {
    const jobs: Promise<void>[] = []
    const wanted: number[] = [] // keys of this.tiles
    for (const k of keys) {
      const tr = Math.floor(k / 4096)
      const tc = k % 4096
      if (tr >= 0 && tc >= 0 && tr < this.nTiles && tc < this.nTiles && this.exists(tr, tc)) {
        jobs.push(this.load(tr, tc))
        wanted.push(tr * this.nTiles + tc)
      }
    }
    await Promise.all(jobs)
    // Requested tiles become the most recent; only then are the oldest dropped, so a request never loses its own.
    for (const k of wanted) {
      const t = this.tiles.get(k)
      if (t) {
        this.tiles.delete(k)
        this.tiles.set(k, t)
      }
    }
    while (this.tiles.size > Math.max(MAX_TILES, wanted.length)) this.tiles.delete(this.tiles.keys().next().value as number)
    this.lastKey = -1 // the one-tile lookup may hold a tile that was absent or has gone
  }

  private load(tr: number, tc: number): Promise<void> {
    const key = tr * this.nTiles + tc
    if (this.tiles.has(key)) return Promise.resolve()
    let p = this.pending.get(key)
    if (!p) {
      p = this.io
        .bytes(`terrain/cap/${this.info.name}/${tr}/${tc}.bin`)
        .then((buf) => {
          const n = this.info.tile_size
          if (!buf || buf.byteLength !== n * n * 2) return // missing or broken: samples fall back on a coarser raster
          this.tiles.set(key, int16(buf))
          this.lastKey = -1
          this.fetched++
        })
        .catch(() => undefined)
        .finally(() => this.pending.delete(key))
      this.pending.set(key, p)
    }
    return p
  }

  private v(r: number, c: number): number {
    const n = this.info.tile_size
    const key = Math.floor(r / n) * this.nTiles + Math.floor(c / n)
    if (key !== this.lastKey) {
      this.lastKey = key
      this.last = this.tiles.get(key) ?? null
    }
    if (!this.last) return NaN
    const q = this.last[(r % n) * n + (c % n)]
    return q === NODATA ? NaN : q * this.info.height_scale_m
  }

  sample(x: number, y: number): number {
    const i = this.info
    const fc = (x - i.x0_m) / i.spacing_m - 0.5
    const fr = (i.y0_m - y) / i.spacing_m - 0.5
    const c0 = Math.floor(fc)
    const r0 = Math.floor(fr)
    if (!(c0 >= 0 && r0 >= 0 && c0 + 1 < i.width && r0 + 1 < i.height)) return NaN
    const dc = fc - c0
    const dr = fr - r0
    return (this.v(r0, c0) * (1 - dc) + this.v(r0, c0 + 1) * dc) * (1 - dr) + (this.v(r0 + 1, c0) * (1 - dc) + this.v(r0 + 1, c0 + 1) * dc) * dr
  }

  /** Mean of the valid samples of the k × k block (r, c) of this level; NaN when none (nodata, tile not in memory). */
  private mean(k: number, r: number, c: number): number {
    let s = 0
    let n = 0
    for (let a = 0; a < k; a++) {
      for (let b = 0; b < k; b++) {
        const q = this.v(r * k + a, c * k + b)
        if (!Number.isNaN(q)) (s += q), n++
      }
    }
    return n ? s / n : NaN
  }

  /**
   * Bilinear sample of this level's k × k block means at projected metres (the near level: 160 m from the 80 m
   * tiles, blocks aligned on the level's grid, so a block never spans two tiles). NaN outside or next to a block
   * without data.
   */
  sampleMeans(k: number, x: number, y: number): number {
    const i = this.info
    const s = i.spacing_m * k
    const fc = (x - i.x0_m) / s - 0.5
    const fr = (i.y0_m - y) / s - 0.5
    const c0 = Math.floor(fc)
    const r0 = Math.floor(fr)
    if (!(c0 >= 0 && r0 >= 0 && c0 + 1 < Math.floor(i.width / k) && r0 + 1 < Math.floor(i.height / k))) return NaN
    const dc = fc - c0
    const dr = fr - r0
    return (
      (this.mean(k, r0, c0) * (1 - dc) + this.mean(k, r0, c0 + 1) * dc) * (1 - dr) +
      (this.mean(k, r0 + 1, c0) * (1 - dc) + this.mean(k, r0 + 1, c0 + 1) * dc) * dr
    )
  }
}

// ---------- results ----------

/** Where a cap terrain grid's samples came from. */
export interface CapSource {
  from: 'south-cap raster'
  /** Spacing (m) of the cap raster that supplied most of the grid's samples: 40, 80, 400, 1920 or 2000. */
  source_res_m: number
  /** Share (0..1) of the grid's valid samples per source spacing. */
  share: Record<string, number>
  validated: false
}

export interface CapTerrainMeta extends TerrainMeta {
  cap: CapSource
}

export interface CapTerrainTile extends TerrainTile {
  meta: CapTerrainMeta
  levels: (TerrainTile & { meta: CapTerrainMeta })[]
}

export interface CapHorizon extends Horizon {
  slope_deg: number
  /** Marks a mask computed in the browser from the cap rasters, with the terrain spacing it used per ring. */
  computed: {
    from: 'south-cap raster'
    /** Spacing (m) of the terrain at the point itself (ground height and slope). */
    site_res_m: number
    /** Coarsest spacing (m) any ray sample used out to rings.nearKm, and the spacing used beyond it. */
    near_res_m: number
    far_res_m: number
    /** Spacing (m) of the outer raster where rays left the 20 m DEM's square; null when none did. */
    outer_res_m: number | null
    rings: CapHorizonRings
    approximate: true
    validated: false
    ms: number // time the computation took on this device, tile downloads excluded
  }
}

type Sampler = (x: number, y: number) => number

/** Ray sample distances (km) of scripts/horizon.py: 20 m steps to 4 km, then each step 0.5 % longer, last at 300. */
export function rayDistancesKm(rayMaxKm = RAY_MAX_KM): number[] {
  const d: number[] = []
  for (let k = 1; k <= 200; k++) d.push(k * 0.02)
  let step = 0.02
  for (;;) {
    step *= 1.005
    const next = d[d.length - 1] + step
    if (next >= rayMaxKm) break
    d.push(next)
  }
  d.push(rayMaxKm)
  return d
}

export const capSiteId = (lat: number, lon: number) => `cap:${lat.toFixed(5)},${lon.toFixed(5)}`

// ---------- the cap ----------

export class SouthCap {
  private readonly base: Grid
  private readonly outer: Grid
  private base2k: Grid | null = null
  private readonly levels: TileLevel[] // finest first

  constructor(
    readonly meta: CapMeta,
    base: ArrayBuffer,
    outer: ArrayBuffer,
    io: CapIo,
  ) {
    if (meta.projection.R_m !== R_M || meta.projection.lon_0 !== 0 || meta.projection.lat_0 !== -90) {
      throw new Error('cap.json: projection is not the south polar stereographic of the 1737.4 km sphere')
    }
    const grid = (i: CapRasterInfo, buf: ArrayBuffer) => {
      if (buf.byteLength !== i.width * i.height * 2) throw new Error(`terrain/cap/${i.file}: ${buf.byteLength} bytes`)
      return new Grid(i.spacing_m, i.width, i.height, i.x0_m, i.y0_m, int16(buf), i.height_scale_m)
    }
    this.base = grid(meta.base, base)
    this.outer = grid(meta.outer, outer)
    this.levels = meta.levels.map((l) => new TileLevel(l, io))
  }

  private level(name: string): TileLevel | undefined {
    return this.levels.find((l) => l.info.name === name)
  }

  /** Tiles fetched so far, per level name. */
  fetchedTiles(): Record<string, number> {
    return Object.fromEntries(this.levels.map((l) => [l.info.name, l.fetched]))
  }

  /** Does the cap terrain cover this point (south of the pin region's edge and inside the base raster)? */
  covers(lat: number, lon: number): boolean {
    return this.height(lat, lon) !== null
  }

  /**
   * Bilinear height of the 400 m base (m above the 1737.4 km sphere); null outside the cap. Within 0.007° of
   * 80° S near longitudes 0, ±90 and 180 the base's square ends: there the 1920 m outer raster answers.
   */
  height(lat: number, lon: number): number | null {
    if (!inPinRegion(lat) || lat > this.meta.north_lat) return null
    const [x, y] = capXY(lat, lon)
    let h = this.base.sample(x, y)
    if (Number.isNaN(h)) h = this.outer.sample(x, y)
    return Number.isNaN(h) ? null : h
  }

  /** Height of the 400 m base at projected metres (bilinear); NaN outside the base raster. For the globe's cap mesh. */
  heightXY(x: number, y: number): number {
    return this.base.sample(x, y)
  }

  /** Half-width (m) of the base raster's square: the extent a cap texture in the same layout covers. */
  get halfWidthM(): number {
    return (this.base.width * this.base.spacing) / 2
  }

  /** Northern edge of the cap (degrees). */
  get northLat(): number {
    return this.meta.north_lat
  }

  private far2k(): Grid {
    this.base2k ??= this.base.blockMeans(Math.round(FAR_GRID.spacing / this.base.spacing))
    return this.base2k
  }

  /** Projected x/y (x0, y0, x1, y1, ...) of every sample of a site grid (terrain_tiles.py convention), row-major. */
  private gridXY(lat: number, lon: number, g: { size: number; spacing: number }): Float64Array {
    const { east, north, up } = enuBasis(lat, lon)
    const half = (g.size - 1) / 2
    const xy = new Float64Array(g.size * g.size * 2)
    let o = 0
    for (let i = 0; i < g.size; i++) {
      const yn = (half - i) * g.spacing
      for (let j = 0; j < g.size; j++) {
        const xe = (j - half) * g.spacing
        // terrain_tiles.enu_to_latlon: the offset in the tangent plane, put on the sphere along the radius
        const px = R_M * up[0] + xe * east[0] + yn * north[0]
        const py = R_M * up[1] + xe * east[1] + yn * north[1]
        const pz = R_M * up[2] + xe * east[2] + yn * north[2]
        const n = Math.hypot(px, py, pz)
        const k = (2 * R_M) / (1 - pz / n)
        xy[o++] = (k * py) / n
        xy[o++] = (k * px) / n
      }
    }
    return xy
  }

  /**
   * Heights at projected points from a chain of rasters, finest first: each sample takes the first raster that
   * has a value there. Returns absolute heights and each source's share of the valid samples.
   */
  private sampleXY(xy: Float64Array, chain: [number, Sampler][]) {
    const h = new Float32Array(xy.length / 2)
    const counts = chain.map(() => 0)
    for (let i = 0; i < h.length; i++) {
      let v = NaN
      for (let s = 0; s < chain.length; s++) {
        v = chain[s][1](xy[2 * i], xy[2 * i + 1])
        if (!Number.isNaN(v)) {
          counts[s]++
          break
        }
      }
      h[i] = v
    }
    const valid = counts.reduce((a, b) => a + b, 0)
    const share: Record<string, number> = {}
    let best = 0
    chain.forEach(([res], s) => {
      if (counts[s]) share[String(res)] = (share[String(res)] ?? 0) + counts[s] / valid
      if (counts[s] > counts[best]) best = s
    })
    return { h, share, source_res_m: chain[best][0], valid }
  }

  private chainFrom(from: 'fine' | 'near' | 'base' | 'far'): [number, Sampler][] {
    const chain: [number, Sampler][] = []
    for (const l of this.levels) {
      if (from === 'fine' || (from === 'near' && l.info.spacing_m >= TILE_GRID.spacing)) {
        chain.push([l.info.spacing_m, (x, y) => l.sample(x, y)])
      }
    }
    if (from === 'far') chain.push([FAR_GRID.spacing, (x, y) => this.far2k().sample(x, y)])
    else chain.push([this.base.spacing, (x, y) => this.base.sample(x, y)])
    chain.push([this.outer.spacing, (x, y) => this.outer.sample(x, y)])
    return chain
  }

  private describe(res: number): string {
    if (res === this.base.spacing) return `the south-cap ${res} m base (${this.meta.base.resampling})`
    if (res === this.outer.spacing) return `the south-cap ${res} m outer raster (${this.meta.outer.resampling})`
    if (res === FAR_GRID.spacing) return `2 km means of the south-cap 400 m base`
    const tiles = (m: number) => this.meta.levels.find((l) => l.spacing_m === m)?.resampling ?? ''
    if (res === NEAR_GRID.spacing) return `${NEAR_BLOCK} × ${NEAR_BLOCK} means (${res} m) of the south-cap ${TILE_GRID.spacing} m tiles (${tiles(TILE_GRID.spacing)})`
    return `the south-cap ${res} m tiles (${tiles(res)})`
  }

  /**
   * One site grid: bilinear samples of the chain at the grid's projected points, heights relative to `ground` in
   * Int16 steps of the finest scale in `scales` that holds the grid's relief. level = undefined for the 80 m grid.
   */
  private grid(siteId: string, ground: number, g: { size: number; spacing: number }, xy: Float64Array, chain: [number, Sampler][], scales: number[], level?: 'fine' | 'near' | 'mid' | 'far') {
    const { h, share, source_res_m, valid } = this.sampleXY(xy, chain)
    if (!valid) return null
    let peak = 0
    for (let i = 0; i < h.length; i++) if (!Number.isNaN(h[i])) peak = Math.max(peak, Math.abs(h[i] - ground))
    const scale = scales.find((s) => peak / s <= 32767) ?? 1
    const heights = new Int16Array(h.length)
    for (let i = 0; i < h.length; i++) heights[i] = Number.isNaN(h[i]) ? NODATA : Math.round((h[i] - ground) / scale)
    const others = Object.keys(share).filter((k) => Number(k) !== source_res_m)
    const meta: CapTerrainMeta = {
      site_id: siteId,
      size: g.size,
      spacing_m: g.spacing,
      order: ORDER,
      height_ref: HEIGHT_REF,
      nodata: NODATA,
      illum_png: null,
      illum_map: null,
      illum_res_m: null,
      dem: `south-cap raster, ${source_res_m} m (from ${source_res_m === this.outer.spacing ? this.meta.outer.source.file : this.meta.source.file})`,
      ground_m: Math.round(ground * 100) / 100,
      height_scale_m: scale,
      resampling:
        `bilinear samples of ${this.describe(source_res_m)}` +
        (others.length ? `; ${others.map((k) => `${(share[k] * 100).toFixed(1)} % from ${this.describe(Number(k))}`).join(', ')}` : ''),
      cap: { from: 'south-cap raster', source_res_m, share, validated: false },
    }
    if (level) meta.level = level
    return { meta, heights }
  }

  /**
   * The near level of a site (wave 3): 501 × 501 at 160 m (±40 km) in the site's ENU grid, bilinear samples of
   * 2 × 2 means of the 80 m cap tiles, heights relative to `groundM` (a prepared site: its own ground_m, so the
   * level nests with the pipeline's files). Where no 80 m tile has data the samples are nodata (the scene fills
   * them from the coarser levels). null outside the cap, or when no 80 m tile covers any of it.
   */
  async nearLevel(lat: number, lon: number, groundM: number, siteId = capSiteId(lat, lon)): Promise<(TerrainTile & { meta: CapTerrainMeta }) | null> {
    if (this.height(lat, lon) === null || Math.abs(lat) > 89.9999) return null
    const l80 = this.levels.filter((l) => l.info.spacing_m === TILE_GRID.spacing)
    if (!l80.length) return null
    const xy = this.gridXY(lat, lon, NEAR_GRID)
    await Promise.all(l80.map((l) => l.ensurePoints(xy, NEAR_BLOCK)))
    const chain = l80.map((l): [number, Sampler] => [NEAR_GRID.spacing, (x, y) => l.sampleMeans(NEAR_BLOCK, x, y)])
    return this.grid(siteId, groundM, NEAR_GRID, xy, chain, HEIGHT_SCALES, 'near')
  }

  /**
   * Terrain of any point in the cap, in the shape loadTerrain(siteId) returns: the 80 m grid (500 × 500, ±20 km)
   * from the 80 m tiles, in their 0.25 m steps (height_scale_m), near (160 m, ±40 km) from 2 × 2 means of the
   * 80 m tiles, mid (400 m, ±60 km) from the base, far (2 km, ±300 km) from 2 km means of the base and the outer
   * raster beyond it, and where 40 m tiles exist a fine level (251 × 251 at 40 m, ±5 km). Heights are relative to
   * the point's ground height (finest raster at the point). Each meta names the cap raster its samples came from
   * (`cap.source_res_m`, `resampling`): if the 80 m tiles could not be loaded the 80 m grid is filled from the
   * 400 m base and says so, and there is no near level. null outside the cap.
   */
  async terrain(lat: number, lon: number, siteId = capSiteId(lat, lon)): Promise<CapTerrainTile | null> {
    if (this.height(lat, lon) === null || Math.abs(lat) > 89.9999) return null
    const [cx, cy] = capXY(lat, lon)
    const l80 = this.levels.filter((l) => l.info.spacing_m >= TILE_GRID.spacing)
    const l40 = this.levels.filter((l) => l.info.spacing_m < TILE_GRID.spacing)
    const wantFine = l40.some((l) => l.covers(cx, cy))
    const tileXY = this.gridXY(lat, lon, TILE_GRID)
    const fineXY = wantFine ? this.gridXY(lat, lon, FINE_GRID) : null
    await Promise.all([...l80.map((l) => l.ensurePoints(tileXY)), ...(fineXY ? l40.map((l) => l.ensurePoints(fineXY)) : [])])
    let ground = NaN
    for (const [, s] of this.chainFrom('fine')) {
      ground = s(cx, cy)
      if (!Number.isNaN(ground)) break
    }
    if (Number.isNaN(ground)) return null

    const tile = this.grid(siteId, ground, TILE_GRID, tileXY, this.chainFrom('near'), TILE_SCALES)
    const mid = this.grid(siteId, ground, MID_GRID, this.gridXY(lat, lon, MID_GRID), this.chainFrom('base'), HEIGHT_SCALES, 'mid')
    const far = this.grid(siteId, ground, FAR_GRID, this.gridXY(lat, lon, FAR_GRID), this.chainFrom('far'), HEIGHT_SCALES, 'far')
    if (!tile || !mid || !far) return null
    const fine = fineXY ? this.grid(siteId, ground, FINE_GRID, fineXY, this.chainFrom('fine'), HEIGHT_SCALES, 'fine') : null
    const near = await this.nearLevel(lat, lon, ground, siteId)
    // A fine level that is mostly 80 m data would only repeat the 80 m grid: leave it out. Same for a near level
    // whose 80 m grid did not come from the 80 m tiles (they could not be loaded).
    const levels = [
      ...(fine && fine.meta.cap.source_res_m < TILE_GRID.spacing ? [fine] : []),
      ...(near && tile.meta.cap.source_res_m === TILE_GRID.spacing ? [near] : []),
      mid,
      far,
    ]
    tile.meta.levels = levels.map((l) => l.meta.level as string)
    return { ...tile, levels }
  }

  /**
   * Horizon mask, ground height and slope of any point in the cap, by the method of scripts/horizon.py on the
   * cap rasters: the 40 m tiles inside rings.fineKm, the 80 m tiles inside rings.nearKm, the 400 m base beyond
   * (the 1920 m outer raster past the DEM's square). Approximate: coarser terrain than the pipeline's 20 m /
   * 160 m, see southcap.test.ts for the measured differences. Rejects outside the cap.
   */
  async horizon(lat: number, lon: number, siteId = capSiteId(lat, lon), rings: CapHorizonRings = CAP_HORIZON_RINGS): Promise<CapHorizon> {
    if (Math.abs(lat) > 89.9999) throw new RangeError('site too close to the pole for a defined north direction')
    if (this.height(lat, lon) === null) throw new RangeError(`(${lat}, ${lon}) is outside the south-cap terrain`)
    const { east, north, up } = enuBasis(lat, lon)
    const [cx, cy] = capXY(lat, lon)
    const scaleAt = (2 / (1 - up[2])) * 1.02 // projected metres per ground metre at the point, with a margin
    await Promise.all(
      this.levels.map((l) => l.ensureDisc(cx, cy, (l.info.spacing_m < TILE_GRID.spacing ? rings.fineKm : rings.nearKm) * 1000 * scaleAt)),
    )
    const t0 = performance.now()
    const fine = this.chainFrom('fine')
    const near = this.chainFrom('near')
    const far = this.chainFrom('base')
    const take = (chain: [number, Sampler][], x: number, y: number): [number, number] => {
      for (const [res, s] of chain) {
        const v = s(x, y)
        if (!Number.isNaN(v)) return [v, res]
      }
      return [NaN, 0]
    }
    const [ground, siteRes] = take(fine, cx, cy)
    if (Number.isNaN(ground)) throw new RangeError(`no terrain height at (${lat}, ${lon})`)

    // Great-circle destination at arc th along the horizontal unit direction (dx, dy, dz), projected.
    const dest = (dir: Vec3, th: number): [number, number, number, number] => {
      const c = Math.cos(th)
      const s = Math.sin(th)
      const px = c * up[0] + s * dir[0]
      const py = c * up[1] + s * dir[1]
      const pz = c * up[2] + s * dir[2]
      const k = (2 * R_M) / (1 - pz)
      return [k * py, k * px, c, s]
    }

    // Slope over a 100 m baseline: heights 50 m east / west / north / south (horizon.py).
    const at50 = (dir: Vec3, sign: number) => {
      const [x, y] = dest([sign * dir[0], sign * dir[1], sign * dir[2]], SLOPE_HALF_BASE_M / R_M)
      return take(fine, x, y)[0]
    }
    const baseM = 2 * SLOPE_HALF_BASE_M
    const slope = Math.atan(Math.hypot((at50(east, 1) - at50(east, -1)) / baseM, (at50(north, 1) - at50(north, -1)) / baseM)) / DEG

    const d = rayDistancesKm()
    const nD = d.length
    const cosT = d.map((km) => Math.cos((km * 1000) / R_M))
    const sinT = d.map((km) => Math.sin((km * 1000) / R_M))
    const ro = R_M + ground + OBSERVER_HEIGHT_M
    const mask: number[] = new Array(N_AZ)
    const maskDist: number[] = new Array(N_AZ)
    const truncated: number[] = []
    let nearRes = 0
    let farRes = 0
    let outerUsed = false
    for (let a = 0; a < N_AZ; a++) {
      const az = a * AZ_STEP * DEG
      const ca = Math.cos(az)
      const sa = Math.sin(az)
      const dx = ca * north[0] + sa * east[0]
      const dy = ca * north[1] + sa * east[1]
      const dz = ca * north[2] + sa * east[2]
      let best = -Infinity // tan of the elevation angle: (rp cos th − ro) / (rp sin th), monotonic in the angle
      let bestK = -1
      let k = 0
      for (; k < nD; k++) {
        const c = cosT[k]
        const s = sinT[k]
        const pz = c * up[2] + s * dz
        const f = (2 * R_M) / (1 - pz)
        const x = f * (c * up[1] + s * dy)
        const y = f * (c * up[0] + s * dx)
        const chain = d[k] <= rings.fineKm ? fine : d[k] <= rings.nearKm ? near : far
        let h = NaN
        let res = 0
        for (let q = 0; q < chain.length; q++) {
          h = chain[q][1](x, y)
          if (!Number.isNaN(h)) {
            res = chain[q][0]
            break
          }
        }
        if (Number.isNaN(h)) break // first sample without data: the ray stops (horizon.py)
        if (d[k] <= rings.nearKm) nearRes = Math.max(nearRes, res)
        else if (res > this.base.spacing) outerUsed = true
        else farRes = Math.max(farRes, res)
        const rp = R_M + h
        const t = (rp * c - ro) / (rp * s)
        if (t > best) {
          best = t
          bestK = k
        }
      }
      if (bestK < 0) throw new RangeError(`ray with no valid sample at azimuth ${a * AZ_STEP}`)
      if (k < nD) truncated.push(a * AZ_STEP)
      mask[a] = Math.round((Math.atan(best) / DEG) * 1e4) / 1e4
      maskDist[a] = Math.round(d[bestK] * 1e3) / 1e3
    }
    const ms = performance.now() - t0
    return {
      site_id: siteId,
      lat,
      lon,
      elev_m: Math.round(ground * 10) / 10,
      observer_height_m: OBSERVER_HEIGHT_M,
      az_step: AZ_STEP,
      mask,
      mask_dist_km: maskDist,
      ray_max_km: RAY_MAX_KM,
      truncated,
      dem:
        `approximate: computed in the browser from the south-cap rasters (box means of ${this.meta.source.file}): ` +
        `${siteRes} m at the point, up to ${nearRes} m within ${rings.nearKm} km, ${farRes || this.outer.spacing} m beyond` +
        `${outerUsed || nearRes === this.outer.spacing ? `; ${this.outer.spacing} m means of ${this.meta.outer.source.file} outside that DEM's square` : ''}`,
      slope_deg: Math.round(slope * 10) / 10,
      computed: {
        from: 'south-cap raster',
        site_res_m: siteRes,
        near_res_m: nearRes,
        far_res_m: farRes || this.outer.spacing,
        outer_res_m: outerUsed ? this.outer.spacing : null,
        rings,
        approximate: true,
        validated: false,
        ms,
      },
    }
  }
}

// ---------- loading ----------

export async function openCap(io: CapIo): Promise<SouthCap> {
  const meta = (await io.json('terrain/cap/cap.json')) as CapMeta
  const [base, outer] = await Promise.all([io.bytes(`terrain/cap/${meta.base.file}`), io.bytes(`terrain/cap/${meta.outer.file}`)])
  if (!base || !outer) throw new MissingDataError('terrain/cap: base or outer raster not in this build')
  return new SouthCap(meta, base, outer, io)
}

async function fetchData(path: string): Promise<Response | null> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${path}`)
  // A file the build does not contain: 404, or the dev server / Worker answering with the SPA page (load.ts).
  if (res.status === 404 || (res.headers.get('content-type') ?? '').includes('text/html')) return null
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return res
}

const fetchIo: CapIo = {
  async json(path) {
    const res = await fetchData(path)
    if (!res) throw new MissingDataError(`${path}: not in this build`)
    return res.json()
  },
  async bytes(path) {
    const res = await fetchData(path)
    return res ? res.arrayBuffer() : null
  },
}

let shared: Promise<SouthCap> | null = null

/** The cap of this build: cap.json, the base and the outer raster, fetched once (5.4 MB). */
export function loadCap(): Promise<SouthCap> {
  if (!shared) {
    shared = openCap(fetchIo)
    shared.catch(() => (shared = null)) // a failed request is forgotten so a retry can succeed
  }
  return shared
}

/** Terrain for any point of the cap, shaped like loadTerrain(siteId); null outside the cap or without cap data. */
export async function capTerrain(lat: number, lon: number): Promise<CapTerrainTile | null> {
  try {
    return await (await loadCap()).terrain(lat, lon)
  } catch (e) {
    if (e instanceof MissingDataError) return null
    throw e
  }
}

/** Approximate horizon mask, ground height and slope for any point of the cap; rejects outside it. */
export async function capHorizon(lat: number, lon: number): Promise<CapHorizon> {
  return (await loadCap()).horizon(lat, lon)
}
