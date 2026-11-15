// South-cap module against the shipped files: projection, heights, the site-terrain shape the scene consumes,
// and the accuracy of the browser horizon against the 18 pipeline horizons (printed as a table; the thresholds
// below are the measured values of 14 Nov 2026 with a small margin, so a regression shows).
// Reads public/data from disk (node fs, loaded without typings: the app's tsconfig has no node types).
import { beforeAll, describe, expect, it } from 'vitest'
import { nestedLevels } from '../scene3d/levels'
import { enuBasis } from '../geometry'
import { loadHorizonFile } from '../geometry/testData'
import { CAP_HORIZON_RINGS, type CapIo, type SouthCap, capUnitOfXY, capXY, capXYOfUnit, openCap, rayDistancesKm } from './southcap'
import type { Horizon, Site, TerrainMeta, TerrainTile } from './types'

const DATA = new URL('../../public/data/', import.meta.url)
const fsName = 'node:fs/promises'
const fs = (await import(/* @vite-ignore */ fsName)) as { readFile(u: URL): Promise<{ buffer: ArrayBuffer; byteOffset: number; byteLength: number; toString(e: string): string }> }

const read = async (path: string) => {
  const b = await fs.readFile(new URL(path, DATA))
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
}
const readJson = async <T>(path: string) => JSON.parse((await fs.readFile(new URL(path, DATA))).toString('utf8')) as T

/** Disk reader; `hide` makes tiles of the named levels "not in this build". Counts tile reads and bytes. */
function diskIo(hide: string[] = []) {
  const stats = { tiles: 0, bytes: 0 }
  const io: CapIo = {
    json: (p) => readJson(p),
    bytes: async (p) => {
      const level = /terrain\/cap\/(\d+)\//.exec(p)?.[1]
      if (level && hide.includes(level)) return null
      try {
        const b = await read(p)
        if (level) (stats.tiles += 1), (stats.bytes += b.byteLength)
        return b
      } catch {
        return null
      }
    },
  }
  return { io, stats }
}

async function siteGrid(name: string) {
  const meta = await readJson<TerrainMeta>(`terrain/${name}.json`)
  const raw = new Int16Array(await read(`terrain/${name}.bin`))
  return { meta, raw }
}

let sites: Site[]
let cap: SouthCap
beforeAll(async () => {
  sites = await readJson<Site[]>('sites.json')
  cap = await openCap(diskIo().io)
})
const site = (id: string) => sites.find((s) => s.id === id) as Site
/** Does cap.json's tile index of a level list the tile that holds this point? */
function hasTile(level: string, lat: number, lon: number): boolean {
  const l = cap.meta.levels.find((v) => v.name === level)
  if (!l) return false
  const [x, y] = capXY(lat, lon)
  const side = l.tile_size * l.spacing_m
  const tc = Math.floor((x - l.x0_m) / side)
  return (l.tiles[String(Math.floor((l.y0_m - y) / side))] ?? []).some(([a, b]) => tc >= a && tc <= b)
}

describe('projection', () => {
  // Reference: pyproj, +proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 (computed 14 Nov 2026).
  const ref: [number, number, number, number][] = [
    [-85.0, 37.0, 91303.18933918582, 121163.42460999438],
    [-80.13, 1.44, 7539.877818752383, 299939.0376980428],
    [-89.46, -136.68, -11234.249821183075, -11913.161959881501],
    [-88.22, -63.43, -48279.00986430751, 24144.71767627017],
  ]
  it('capXY equals pyproj to a millimetre and capUnitOfXY inverts it', () => {
    for (const [lat, lon, x, y] of ref) {
      const [px, py] = capXY(lat, lon)
      expect(Math.abs(px - x)).toBeLessThan(1e-3)
      expect(Math.abs(py - y)).toBeLessThan(1e-3)
      const u = capUnitOfXY(x, y)
      expect(Math.asin(u[2]) * (180 / Math.PI)).toBeCloseTo(lat, 9)
      expect(Math.atan2(u[1], u[0]) * (180 / Math.PI)).toBeCloseTo(lon, 9)
    }
  })
  it('ray distances are those of scripts/horizon.py (1065 samples, 4.0201 km after the 200 fixed steps)', () => {
    const d = rayDistancesKm()
    expect(d.length).toBe(1065)
    expect(d[0]).toBeCloseTo(0.02, 12)
    expect(d[200]).toBeCloseTo(4.0201, 10)
    expect(d[d.length - 2]).toBeCloseTo(299.00218506159945, 9)
    expect(d[d.length - 1]).toBe(300)
  })
})

describe('capHeight (400 m base)', () => {
  it('is null north of 80 S and near the site heights inside', () => {
    expect(cap.height(-79.9, 10)).toBeNull()
    expect(cap.height(-60, 0)).toBeNull()
    for (const s of sites) {
      const h = cap.height(s.lat, s.lon)
      expect(h).not.toBeNull()
      // a 400 m box mean against a point height of the 20 m DEM: within 150 m even on Shackleton's wall
      expect(Math.abs((h as number) - (s.elev_m as number))).toBeLessThan(150)
    }
  })
  it('covers() follows it', () => {
    expect(cap.covers(-85, 120)).toBe(true)
    expect(cap.covers(-79.99, 120)).toBe(false)
  })
})

describe('capTerrain has the shape and content of a prepared site', () => {
  const rmsVs = async (id: string, level: string | null, got: { meta: TerrainMeta; heights: Int16Array }) => {
    const want = await siteGrid(level ? `${id}-${level}` : id)
    expect(got.meta.size).toBe(want.meta.size)
    expect(got.meta.spacing_m).toBe(want.meta.spacing_m)
    let s = 0
    let n = 0
    const size = want.meta.size
    const half = (size - 1) / 2
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const a = got.heights[i * size + j]
        const b = want.raw[i * size + j]
        // the prepared far level is ldem_16 fill outside the polar DEM's square: compare inside 250 km only
        if (level === 'far' && Math.hypot(j - half, i - half) * want.meta.spacing_m > 250_000) continue
        if (a === got.meta.nodata || b === want.meta.nodata) continue
        const d = a * (got.meta.height_scale_m ?? 1) - b * (want.meta.height_scale_m ?? 1)
        s += d * d
        n++
      }
    }
    return { rms: Math.sqrt(s / n), n }
  }

  for (const id of ['connecting-ridge', 'malapert-massif', 'amundsen-rim', 'im-1']) {
    it(`${id}: 80 m grid, mid and far agree with the pipeline's files; the scene nests the levels`, async () => {
      const s = site(id)
      const t = await cap.terrain(s.lat, s.lon)
      expect(t).not.toBeNull()
      if (!t) return
      const pipeline = await siteGrid(id)
      expect(t.meta.order).toBe(pipeline.meta.order)
      expect(t.meta.height_ref).toBe(pipeline.meta.height_ref)
      expect(t.meta.nodata).toBe(pipeline.meta.nodata)
      // Wave 3: the 80 m grid comes in the 80 m tiles' own 0.25 m steps (site.ts applies height_scale_m; it read
      // whole metres before, and the pipeline's 80 m files still have no scale).
      expect(t.meta.height_scale_m).toBe(0.25)
      expect(t.meta.cap.source_res_m).toBe(80)
      expect(t.meta.cap.validated).toBe(false)
      expect(Math.abs((t.meta.ground_m as number) - (pipeline.meta.ground_m as number))).toBeLessThan(12)
      const mid = t.levels.find((l) => l.meta.level === 'mid')
      const far = t.levels.find((l) => l.meta.level === 'far')
      const fine = t.levels.find((l) => l.meta.level === 'fine')
      expect(mid && far).toBeTruthy()
      if (!mid || !far) return
      // All levels share one reference height (the ground differs from the pipeline's by the amount above).
      for (const l of t.levels) expect(l.meta.ground_m).toBe(t.meta.ground_m)
      const dg = (t.meta.ground_m as number) - (pipeline.meta.ground_m as number)
      const tile = await rmsVs(id, null, t)
      const m = await rmsVs(id, 'mid', mid)
      const f = await rmsVs(id, 'far', far)
      console.log(
        `${id}: ground ${dg.toFixed(2)} m off; RMS vs pipeline: 80 m grid ${tile.rms.toFixed(2)} m, mid ${m.rms.toFixed(2)} m, far ${f.rms.toFixed(2)} m` +
          `; levels ${t.meta.levels?.join(', ')}; far sources ${JSON.stringify(far.meta.cap.share)}`,
      )
      // RMS includes the constant ground offset dg (two resamplings of one DEM).
      expect(tile.rms).toBeLessThan(Math.abs(dg) + 3)
      expect(m.rms).toBeLessThan(Math.abs(dg) + 25)
      expect(f.rms).toBeLessThan(Math.abs(dg) + 60)
      expect(mid.meta.cap.source_res_m).toBe(400)
      expect(far.meta.cap.source_res_m).toBe(2000)
      // Fine exists exactly where cap.json's 40 m tile index covers the point, and states its real spacing.
      expect(Boolean(fine)).toBe(hasTile('40', s.lat, s.lon))
      if (fine) {
        expect(fine.meta.spacing_m).toBe(40)
        expect(fine.meta.cap.source_res_m).toBe(40)
        expect(fine.meta.resampling).toContain('40 m')
      }
      const nested = nestedLevels(t)
      expect(nested?.map((l) => l.name)).toEqual(fine ? ['fine', 'tile', 'near', 'mid', 'far'] : ['tile', 'near', 'mid', 'far'])
      expect(nested?.every((l) => l.h.some((v) => !Number.isNaN(v)))).toBe(true)
    })
  }

  it('without tiles the 80 m grid is filled from the 400 m base and its meta says so', async () => {
    const bare = await openCap(diskIo(['40', '80']).io)
    const s = site('connecting-ridge')
    const t = await bare.terrain(s.lat, s.lon)
    expect(t).not.toBeNull()
    if (!t) return
    expect(t.meta.spacing_m).toBe(80)
    expect(t.meta.cap.source_res_m).toBe(400)
    expect(t.meta.dem).toContain('400 m')
    expect(t.meta.resampling).toContain('400 m base')
    expect(t.levels.map((l) => l.meta.level)).toEqual(['mid', 'far'])
  })

  it('works on the 80 S edge: no holes in the far level, and the points where the circle leaves the DEM square', async () => {
    // Review 14 Nov: far-level corners project up to 729 km from the pole; the 80 S circle is 5.6 m wider than the
    // 20 m DEM's square at longitudes 0, ±90, 180.
    for (const [lat, lon] of [[-80.0005, 151.5], [-80.0001, 45], [-80, 0], [-80.003, 90], [-80, 180], [-80.59, -81.5]] as const) {
      expect(cap.height(lat, lon)).not.toBeNull()
      const t = await cap.terrain(lat, lon)
      expect(t).not.toBeNull()
      const far = t?.levels.find((l) => l.meta.level === 'far')
      expect(far?.heights.some((v) => v === far.meta.nodata)).toBe(false)
      const h = await cap.horizon(lat, lon)
      expect(h.truncated).toEqual([])
      expect(h.mask.every((v) => Number.isFinite(v))).toBe(true)
    }
    // A grid that is mostly outer-raster data names the 120 m DEM, not the 20 m one.
    const far = (await cap.terrain(-80.3, 45))?.levels.find((l) => l.meta.level === 'far')
    if (far && far.meta.cap.source_res_m === 1920) expect(far.meta.dem).toContain('LDEM_60S_120MPP_ADJ.TIF')
  })

  it('a tile that failed once is used after a later request loads it (no stale lookup)', async () => {
    const s = site('malapert-massif')
    let fail = true
    const inner = diskIo().io
    const flaky: CapIo = { json: inner.json, bytes: (p) => (fail && /cap\/(40|80)\//.test(p) ? Promise.resolve(null) : inner.bytes(p)) }
    const c = await openCap(flaky)
    const first = await c.terrain(s.lat, s.lon)
    expect(first?.meta.cap.source_res_m).toBe(400)
    fail = false
    const second = await c.terrain(s.lat, s.lon)
    const good = await cap.terrain(s.lat, s.lon)
    expect(second?.meta.cap.source_res_m).toBe(80)
    expect(second?.meta.ground_m).toBe(good?.meta.ground_m)
    expect(second?.levels.map((l) => l.meta.level)).toEqual(good?.levels.map((l) => l.meta.level))
  })

  it('the tile cache never drops tiles of the request that is running', async () => {
    const c = await openCap(diskIo().io)
    // Fill the 80 m cache well past its limit, then ask for a point whose tiles are partly the oldest ones.
    const first = await c.terrain(-87, 0)
    for (let k = 0; k < 40; k++) await c.terrain(-86.5 + (k % 8) * 0.9 - 3, -170 + k * 9)
    const again = await c.terrain(-87, 0)
    expect(again?.meta.cap.share).toEqual(first?.meta.cap.share)
    expect(again?.meta.cap.share['80']).toBeCloseTo(1, 6)
  }, 60_000) // 42 terrain() calls; since wave 3 each also builds the near level (251,001 samples, more 80 m tiles)

  it('returns null outside the cap', async () => {
    expect(await cap.terrain(-79.5, 0)).toBeNull()
  })

  it('one site visit (terrain + horizon) fetches a handful of tiles', async () => {
    const rows: string[] = []
    for (const id of ['connecting-ridge', 'malapert-massif', 'amundsen-rim', 'im-1', 'haworth']) {
      const { io, stats } = diskIo()
      const c = await openCap(io)
      const s = site(id)
      await c.terrain(s.lat, s.lon)
      const afterTerrain = { ...stats }
      await c.horizon(s.lat, s.lon)
      rows.push(
        `${id}: terrain ${afterTerrain.tiles} tiles ${(afterTerrain.bytes / 1e6).toFixed(2)} MB; with horizon ${stats.tiles} tiles ` +
          `${(stats.bytes / 1e6).toFixed(2)} MB ${JSON.stringify(c.fetchedTiles())}`,
      )
      // Upper bound from the grids and cap.json: a rotated square of side L spans at most ceil(L·√2·k / tile) + 1
      // tiles per axis (k ≤ 1.01: the projection's scale at 80° S).
      const t = await c.terrain(s.lat, s.lon)
      // The 80 m tiles serve the 80 m grid and (wave 3) the near level's 2 × 2 means, the larger of the two squares.
      const near = t?.levels.find((l) => l.meta.level === 'near')
      const sides: Record<string, number> = { '80': t ? Math.max((t.meta.size - 1) * t.meta.spacing_m, near ? (near.meta.size - 1) * near.meta.spacing_m : 0) : 0 }
      const fine = t?.levels.find((l) => l.meta.level === 'fine')
      if (fine) sides['40'] = (fine.meta.size - 1) * fine.meta.spacing_m
      let bound = 0
      for (const l of c.meta.levels) {
        const n = Math.ceil(((sides[l.name] ?? 0) * Math.SQRT2 * 1.01) / (l.tile_size * l.spacing_m)) + 1
        if (sides[l.name]) bound += n * n
      }
      expect(stats.tiles).toBeLessThanOrEqual(bound)
    }
    console.log(rows.join('\n'))
  })
})

describe('near level (wave 3): 160 m to ±40 km from 2 × 2 means of the 80 m tiles', () => {
  const R = 1737400
  /** 80 m cap sample (row, col) read here straight from its tile file; NaN for nodata or no tile. */
  const files = new Map<string, Int16Array | null>()
  async function at80(r: number, c: number): Promise<number> {
    const l = cap.meta.levels.find((v) => v.name === '80')!
    const n = l.tile_size
    const key = `${Math.floor(r / n)}/${Math.floor(c / n)}`
    if (!files.has(key)) files.set(key, await read(`terrain/cap/80/${key}.bin`).then((b) => new Int16Array(b), () => null))
    const t = files.get(key)
    const q = t ? t[(r % n) * n + (c % n)] : -32768
    return q === -32768 ? NaN : q * l.height_scale_m
  }
  /** Projected metres of the site grid point at ENU offset (xe, yn) m, as terrain_tiles.py places it. */
  function gridPoint(s: Site, xe: number, yn: number): [number, number] {
    const { east, north, up } = enuBasis(s.lat, s.lon)
    const p = [0, 1, 2].map((k) => R * up[k] + xe * east[k] + yn * north[k])
    const n = Math.hypot(p[0], p[1], p[2])
    return capXYOfUnit(p[0] / n, p[1] / n, p[2] / n)
  }
  /** Expected near height there, computed here: bilinear over the 160 m block means of the 80 m samples. */
  async function expected(x: number, y: number): Promise<number> {
    const l = cap.meta.levels.find((v) => v.name === '80')!
    const fc = (x - l.x0_m) / 160 - 0.5
    const fr = (l.y0_m - y) / 160 - 0.5
    const c0 = Math.floor(fc)
    const r0 = Math.floor(fr)
    const mean = async (r: number, c: number) => {
      const v = (await Promise.all([at80(2 * r, 2 * c), at80(2 * r, 2 * c + 1), at80(2 * r + 1, 2 * c), at80(2 * r + 1, 2 * c + 1)])).filter((q) => !Number.isNaN(q))
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN
    }
    const [a, b, c, d] = await Promise.all([mean(r0, c0), mean(r0, c0 + 1), mean(r0 + 1, c0), mean(r0 + 1, c0 + 1)])
    const dc = fc - c0
    const dr = fr - r0
    return (a * (1 - dc) + b * dc) * (1 - dr) + (c * (1 - dc) + d * dc) * dr
  }
  const bilinear = (t: { meta: TerrainMeta; heights: Int16Array }, x: number, y: number) => {
    const { size, spacing_m: sp, nodata } = t.meta
    const half = (size - 1) / 2
    const fj = x / sp + half
    const fi = half - y / sp
    const j0 = Math.floor(fj)
    const i0 = Math.floor(fi)
    if (j0 < 0 || i0 < 0 || j0 + 1 > size - 1 || i0 + 1 > size - 1) return NaN
    const q = [t.heights[i0 * size + j0], t.heights[i0 * size + j0 + 1], t.heights[(i0 + 1) * size + j0], t.heights[(i0 + 1) * size + j0 + 1]]
    if (q.some((v) => v === nodata)) return NaN
    const k = t.meta.height_scale_m ?? 1
    const dj = fj - j0
    const di = fi - i0
    return ((q[0] * (1 - dj) + q[1] * dj) * (1 - di) + (q[2] * (1 - dj) + q[3] * dj) * di) * k
  }

  for (const id of ['connecting-ridge', 'shackleton-rim-site04', 'malapert-massif', 'im-1']) {
    it(`${id}: 501 × 501 at 160 m on the pipeline's ground_m, the 2 × 2 means, between the 80 m tile and mid`, async () => {
      const s = site(id)
      const pipe = await siteGrid(id)
      const ground = pipe.meta.ground_m as number
      const near = await cap.nearLevel(s.lat, s.lon, ground, s.id)
      expect(near).not.toBeNull()
      if (!near) return
      expect(near.meta).toMatchObject({ site_id: id, size: 501, spacing_m: 160, level: 'near', ground_m: ground, nodata: -32768, order: pipe.meta.order, height_ref: pipe.meta.height_ref })
      expect(near.meta.cap).toMatchObject({ source_res_m: 160, validated: false })
      expect(near.meta.resampling).toContain('2 × 2 means (160 m) of the south-cap 80 m tiles')
      const k = near.meta.height_scale_m as number
      // Grid points checked against the means computed here from the tile files: centre, corners, between.
      for (const [i, j] of [[250, 250], [0, 0], [0, 500], [500, 0], [500, 500], [97, 313], [401, 12]]) {
        const [x, y] = gridPoint(s, (j - 250) * 160, (250 - i) * 160)
        const want = (await expected(x, y)) - ground
        const v = near.heights[i * 501 + j]
        if (Number.isNaN(want)) expect(v, `${id} (${i}, ${j}) nodata`).toBe(-32768)
        else expect(Math.abs(v * k - want), `${id} (${i}, ${j})`).toBeLessThanOrEqual(k / 2 + 1e-6)
      }
      // Against the pipeline's own 80 m tile and mid level, which are box means of the same 20 m DEM.
      const mid = await siteGrid(`${id}-mid`)
      const tile = { meta: pipe.meta, heights: pipe.raw }
      const near2 = { meta: near.meta, heights: near.heights }
      let st = 0
      let nt = 0
      let sm = 0
      let nm = 0
      for (let i = 0; i < 501; i += 3) {
        for (let j = 0; j < 501; j += 3) {
          const x = (j - 250) * 160
          const y = (250 - i) * 160
          const h = bilinear(near2, x, y)
          if (Number.isNaN(h)) continue
          const ht = bilinear(tile, x, y)
          if (!Number.isNaN(ht)) (st += (h - ht) ** 2), nt++
          const hm = bilinear({ meta: mid.meta, heights: mid.raw }, x, y)
          if (!Number.isNaN(hm)) (sm += (h - hm) ** 2), nm++
        }
      }
      const rt = Math.sqrt(st / nt)
      const rm = Math.sqrt(sm / nm)
      console.log(`near ${id}: RMS against the 80 m tile ${rt.toFixed(2)} m (${nt} points), against mid ${rm.toFixed(2)} m (${nm} points), height step ${k} m`)
      expect(nt).toBeGreaterThan(1000)
      expect(rt).toBeLessThan(4) // measured 14 Nov: 1.2 to 1.5 m
      expect(rm).toBeLessThan(20) // measured 14 Nov: 11.6 to 12.9 m
      // The scene nests it between the 80 m tile and mid.
      const levels = await Promise.all((pipe.meta.levels ?? []).map(async (l) => {
        const g = await siteGrid(`${id}-${l}`)
        return { meta: g.meta, heights: g.raw } as TerrainTile
      }))
      const nested = nestedLevels({ meta: pipe.meta, heights: pipe.raw, levels: [...levels, near] })
      expect(nested?.map((l) => l.name)).toEqual(['fine', 'tile', 'near', 'mid', 'far'])
      const n = nested!.find((l) => l.name === 'near')!
      expect(n.spacing).toBe(160)
      expect(n.ext).toBe(40_000)
    })
  }

  it('15 to 28 tiles of the 80 m level per prepared site, 2.0 to 3.7 MB (measured 14 Nov)', async () => {
    const rows: string[] = []
    let most = 0
    for (const s of sites) {
      const { io, stats } = diskIo()
      const c = await openCap(io)
      const pipe = await siteGrid(s.id)
      const near = await c.nearLevel(s.lat, s.lon, pipe.meta.ground_m as number, s.id)
      expect(near, s.id).not.toBeNull()
      rows.push(`${s.id}: ${stats.tiles} tiles, ${(stats.bytes / 1e6).toFixed(2)} MB`)
      most = Math.max(most, stats.tiles)
    }
    console.log(`near level, 80 m tiles per site:\n${rows.join('\n')}`)
    // An 80 km square turned by up to 45° in the projection spans at most ceil(80 · √2 · 1.01 / 20.48) + 1 = 7 tiles a side.
    expect(most).toBeLessThanOrEqual(49)
  })

  it('a custom point gets it among its levels; without 80 m tiles there is none', async () => {
    const t = await cap.terrain(-85.3, 120.5)
    expect(t?.meta.levels).toContain('near')
    const names = t!.levels.map((l) => l.meta.level)
    expect(names.indexOf('near')).toBe(names.indexOf('mid') - 1)
    expect(nestedLevels(t!)?.map((l) => l.name).slice(-4)).toEqual(['tile', 'near', 'mid', 'far'])
    const bare = await openCap(diskIo(['80']).io)
    expect(await bare.nearLevel(-85.3, 120.5, 0)).toBeNull()
  })
})

describe('capHorizon against the 18 pipeline horizons', () => {
  interface Row {
    id: string
    median: number
    p95: number
    max: number
    dSlope: number
    dElev: number
    ms: number
    truncated: number
  }
  const compare = async (c: SouthCap, rings = CAP_HORIZON_RINGS): Promise<Row[]> => {
    const rows: Row[] = []
    for (const s of sites) {
      const ref: Horizon = await loadHorizonFile(s.horizon as string)
      const h = await c.horizon(s.lat, s.lon, s.id, rings)
      const d = h.mask.map((v, i) => Math.abs(v - ref.mask[i])).sort((a, b) => a - b)
      rows.push({
        id: s.id,
        median: d[360],
        p95: d[683],
        max: d[719],
        dSlope: h.slope_deg - (ref.slope_deg as number),
        dElev: h.elev_m - ref.elev_m,
        ms: h.computed.ms,
        truncated: h.truncated.length,
      })
    }
    return rows
  }
  const table = (title: string, rows: Row[]) => {
    const f = (v: number, n = 3) => v.toFixed(n).padStart(8)
    const med = (k: keyof Row) => [...rows].map((r) => Math.abs(r[k] as number)).sort((a, b) => a - b)[Math.floor(rows.length / 2)]
    const max = (k: keyof Row) => Math.max(...rows.map((r) => Math.abs(r[k] as number)))
    console.log(
      [
        `${title}`,
        `site                         median   p95      max    dSlope    dElev      ms`,
        ...rows.map((r) => `${r.id.padEnd(27)}${f(r.median)}${f(r.p95)}${f(r.max)}${f(r.dSlope, 1)}${f(r.dElev, 1)}${f(r.ms, 0)}`),
        `${'median over sites'.padEnd(27)}${f(med('median'))}${f(med('p95'))}${f(med('max'))}${f(med('dSlope'), 1)}${f(med('dElev'), 1)}${f(med('ms'), 0)}`,
        `${'worst site'.padEnd(27)}${f(max('median'))}${f(max('p95'))}${f(max('max'))}${f(max('dSlope'), 1)}${f(max('dElev'), 1)}${f(max('ms'), 0)}`,
        `(elevation-angle differences in degrees over the 720 azimuths; dSlope in degrees, dElev in metres, browser minus pipeline)`,
      ].join('\n'),
    )
    return { med, max }
  }

  it('returns the Horizon shape, marked as computed from the cap raster', async () => {
    const s = site('haworth')
    const h = await cap.horizon(s.lat, s.lon)
    expect(h.mask.length).toBe(720)
    expect(h.mask_dist_km.length).toBe(720)
    expect(h.az_step).toBe(0.5)
    expect(h.observer_height_m).toBe(1.75)
    expect(h.ray_max_km).toBe(300)
    expect(h.truncated).toEqual([])
    expect(h.computed).toMatchObject({ from: 'south-cap raster', site_res_m: hasTile('40', s.lat, s.lon) ? 40 : 80, near_res_m: 80, far_res_m: 400, approximate: true, validated: false })
    expect(h.dem).toContain('approximate')
    await expect(cap.horizon(-79, 0)).rejects.toThrow(RangeError)
    await expect(cap.horizon(-90, 0)).rejects.toThrow(RangeError)
  })

  it('the "at the point" resolution in the label is the finest level whose tile index covers the point', async () => {
    // A lattice over the cap. The finest level listed for the point must be what the horizon reports and prints;
    // the only exceptions allowed are points within one sample of the 20 m DEM's square edge (no data beyond it).
    const finest = (lat: number, lon: number) => cap.meta.levels.find((l) => hasTile(l.name, lat, lon))?.spacing_m ?? null
    let checked = 0
    const counts: Record<string, number> = {}
    for (const lat of [-80.02, -80.6, -82.4, -84.9, -86.4, -89.7]) {
      for (let lon = -175; lon < 180; lon += 47) {
        const h = await cap.horizon(lat, lon)
        const want = finest(lat, lon)
        counts[String(h.computed.site_res_m)] = (counts[String(h.computed.site_res_m)] ?? 0) + 1
        const [x, y] = capXY(lat, lon)
        if (Math.max(Math.abs(x), Math.abs(y)) > cap.halfWidthM - 100) continue
        expect(h.computed.site_res_m).toBe(want)
        expect(h.dem).toContain(`${want} m at the point`)
        if (lon === -175) {
          const t = await cap.terrain(lat, lon)
          expect(t?.levels.some((l) => l.meta.level === 'fine')).toBe(want !== null && want < 80)
        }
        checked++
      }
    }
    console.log(`site resolution over the lattice: ${JSON.stringify(counts)} (${checked} points checked)`)
    expect(checked).toBeGreaterThan(40)
    // On the 80 S edge at longitude 0 the circle leaves the DEM's square: the label must not claim a tile level.
    const edge = await cap.horizon(-80, 0)
    expect(edge.computed.site_res_m).toBeGreaterThan(80)
    expect(edge.dem).toContain(`${edge.computed.site_res_m} m at the point`)
  }, 30_000) // 48 horizons and their tiles from disk: about 4 s alone, more next to the other tracks' jobs

  it('accuracy table: 400 m base only (no tiles in the build)', async () => {
    const bare = await openCap(diskIo(['40', '80']).io)
    const { max } = table('A. 400 m base only', await compare(bare))
    expect(max('ms')).toBeLessThan(1000)
    // Measured 14 Nov 2026: worst site median 1.125, worst single azimuth 4.151 deg, slope off by up to 3.1 deg.
    expect(max('median')).toBeLessThan(1.3)
    expect(max('max')).toBeLessThan(4.5)
  })

  it('accuracy table: 80 m tiles within 20 km, base beyond', async () => {
    const c = await openCap(diskIo(['40']).io)
    table('B. 80 m within 20 km, 400 m beyond', await compare(c))
  })

  it('accuracy table: default (40 m within 5 km where it exists, 80 m within 20 km, base beyond)', async () => {
    const { med, max } = table('C. default: 40 m within 5 km, 80 m within 20 km, 400 m beyond', await compare(cap))
    expect(max('ms')).toBeLessThan(1000)
    // Measured 14 Nov 2026 with 40 m tiles for the whole cap: median over sites 0.013, worst site median 0.256,
    // worst single azimuth 1.679 deg (with 40 m only south of 85.1 S the first value was 0.014).
    expect(med('median')).toBeLessThan(0.02)
    expect(max('median')).toBeLessThan(0.3)
    expect(max('max')).toBeLessThan(2)
    expect(max('dSlope')).toBeLessThan(1)
  })

  it('accuracy table: 40 m within 20 km and 80 m within 60 km (more tiles)', async () => {
    const { io, stats } = diskIo()
    const c = await openCap(io)
    table('D. 40 m within 20 km, 80 m within 60 km, 400 m beyond', await compare(c, { fineKm: 20, nearKm: 60 }))
    console.log(`D fetched ${stats.tiles} tiles, ${(stats.bytes / 1e6).toFixed(1)} MB for the 18 sites`)
  }, 60_000) // 18 horizons with 40 m tiles to 20 km: about 5 s alone, past the 5 s default next to other jobs
})
