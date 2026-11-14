// South-cap module against the shipped files: projection, heights, the site-terrain shape the scene consumes,
// and the accuracy of the browser horizon against the 18 pipeline horizons (printed as a table; the thresholds
// below are the measured values of 14 Nov 2026 with a small margin, so a regression shows).
// Reads public/data from disk (node fs, loaded without typings: the app's tsconfig has no node types).
import { beforeAll, describe, expect, it } from 'vitest'
import { nestedLevels } from '../scene3d/levels'
import { loadHorizonFile } from '../geometry/testData'
import { CAP_HORIZON_RINGS, type CapIo, type SouthCap, capUnitOfXY, capXY, openCap, rayDistancesKm } from './southcap'
import type { Horizon, Site, TerrainMeta } from './types'

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
      expect(t.meta.height_scale_m).toBeUndefined() // site.ts reads the 80 m grid's Int16 as metres
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
      // Fine exists exactly where the 40 m level does (south of 85.1 S) and states its real spacing.
      expect(Boolean(fine)).toBe(s.lat < -85.2)
      if (fine) {
        expect(fine.meta.spacing_m).toBe(40)
        expect(fine.meta.cap.source_res_m).toBe(40)
        expect(fine.meta.resampling).toContain('40 m')
      }
      const nested = nestedLevels(t)
      expect(nested?.map((l) => l.name)).toEqual(fine ? ['fine', 'tile', 'mid', 'far'] : ['tile', 'mid', 'far'])
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
  })

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
      expect(stats.tiles).toBeLessThanOrEqual(18)
    }
    console.log(rows.join('\n'))
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
    expect(h.computed).toMatchObject({ from: 'south-cap raster', site_res_m: 40, near_res_m: 80, far_res_m: 400, approximate: true, validated: false })
    expect(h.dem).toContain('approximate')
    await expect(cap.horizon(-79, 0)).rejects.toThrow(RangeError)
    await expect(cap.horizon(-90, 0)).rejects.toThrow(RangeError)
  })

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
    // Measured 14 Nov 2026: median over sites 0.014, worst site median 0.256, worst single azimuth 1.679 deg.
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
  })
})
