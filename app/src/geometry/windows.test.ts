// Coverage union, window edges (±1 min, V5-style), summaries, answerState and the finder (T12).
import { beforeAll, describe, expect, it } from 'vitest'
import type { EphemMonth, Station, Vec3 } from '../data/types'
import {
  FINDER_DEFAULTS,
  type Sample,
  type Series,
  type SiteGeo,
  answerSentence,
  answerState,
  computeSeries,
  coverage,
  finder,
  siteVector,
  summarize,
  windows,
} from './index'
import stationsJson from '../../public/data/stations.json'
import { type Fixtures, loadFixtures, loadHorizonFile, loadMonths } from './testData'

const MIN = 60_000
const HOUR = 60 * MIN
const T0 = Date.parse('2027-01-01T00:00:00Z')

// ---------- synthetic helpers ----------

function fakeSample(utcMs: number, lit: boolean, visible: boolean, los: Record<string, boolean>): Sample {
  const body = { az: 0, el: 0, dist_km: 1, dirEnu: [0, 1, 0] as Vec3, mask: 0, frac: 0 }
  const stations: Sample['stations'] = {}
  for (const [id, ok] of Object.entries(los)) {
    stations[id] = { az: 0, el: 0, moonElAtStation: 0, state: ok ? 'los' : 'blocked', reason: ok ? null : 'station-mask' }
  }
  return { utcMs, sun: { ...body, frac: lit ? 1 : 0, lit }, earth: { ...body, frac: visible ? 1 : 0, visible }, stations }
}

function fakeSeries(site: SiteGeo, rows: { lit: boolean; visible: boolean; los: Record<string, boolean> }[]): Series {
  const step = 30 * MIN
  return {
    site,
    horizon: null,
    stations: [],
    startMs: T0,
    endMs: T0 + rows.length * step,
    stepMin: 30,
    samples: rows.map((r, k) => fakeSample(T0 + k * step, r.lit, r.visible, r.los)),
  }
}

/** Constant synthetic month: Sun/Earth fixed along unit vectors (MOON_ME), identity Earth orientation. */
function constantMonth(sunDir: Vec3, earthDir: Vec3, days = 40): EphemMonth {
  const n = days * 48 + 1
  const s: Vec3 = [sunDir[0] * 1.496e8, sunDir[1] * 1.496e8, sunDir[2] * 1.496e8]
  const e: Vec3 = [earthDir[0] * 384400, earthDir[1] * 384400, earthDir[2] * 384400]
  return {
    start_utc: '2027-01-01T00:00:00Z',
    step_min: 30,
    n,
    frame: 'MOON_ME',
    correction: 'LT+S',
    sun_km: Array.from({ length: n }, () => s),
    earth_km: Array.from({ length: n }, () => e),
    q_me_to_j2000: Array.from({ length: n }, () => [0, 0, 0, 1]),
    q_earth_to_me: Array.from({ length: n }, () => [0, 0, 0, 1]),
    kernels: [],
  }
}

const POLAR: SiteGeo = { lat: -89.5, lon: 0, elev_m: 0 }
const UP = siteVector(POLAR.lat, POLAR.lon, 0).map((x) => x / 1737.4) as Vec3
const DOWN = UP.map((x) => -x) as Vec3
// Synthetic test station on Earth's surface facing the site when Earth sits overhead (identity orientation):
// geodetic lat 89.5, lon 180 points along -UP. Test input only, not a real station.
const FACING: Station = {
  id: 'facing',
  name: 'synthetic',
  network: 'DSN',
  complex: 'synthetic',
  lat_deg: 89.5,
  lon_deg: 180,
  h_m: 0,
  datum: 'WGS 84',
  min_elev_deg: 6,
  source_url: 'https://example.invalid/test-only',
  source_label: 'synthetic test station',
  link_state_inputs: 'unknown',
}

// ---------- coverage ----------

describe('coverage union', () => {
  // a: samples 0-5 in LOS; b: samples 3-7; nothing after.
  const rows = Array.from({ length: 10 }, (_, k) => ({ lit: true, visible: true, los: { a: k <= 5, b: k >= 3 && k <= 7 } }))
  const ser = fakeSeries(POLAR, rows)

  it('is covered where at least one selected station is in line of sight', () => {
    expect(coverage(ser, ['a', 'b'])).toEqual([...Array(8).fill('covered'), 'none', 'none'])
    expect(coverage(ser, ['a'])).toEqual([...Array(6).fill('covered'), ...Array(4).fill('none')])
    expect(coverage(ser, [])).toEqual(Array(10).fill('none'))
  })

  it('never double-counts overlapping station windows', () => {
    const both = summarize(ser, ['a', 'b']).coveragePct
    const a = summarize(ser, ['a']).coveragePct
    const b = summarize(ser, ['b']).coveragePct
    expect(both).toBeCloseTo(75, 9) // union ends midway between samples 7 and 8: 225 of 300 min
    expect(both).toBeLessThan(a + b)
    expect(both).toBeLessThanOrEqual(100)
  })

  it("is 'unknown' only where a selected station has no result", () => {
    const st = coverage(ser, ['a', 'missing'])
    expect(st.slice(0, 6)).toEqual(Array(6).fill('covered'))
    expect(st.slice(6)).toEqual(Array(4).fill('unknown'))
    expect(summarize(ser, ['a', 'missing']).unknownPct).toBeGreaterThan(0)
  })
})

// ---------- windows on the real ephemeris ----------

describe('windows (real ephemeris, Shackleton Site04, 16-29 Aug 2027)', () => {
  let months: EphemMonth[]
  let fx: Fixtures
  const site: SiteGeo = { lat: -89.7668, lon: -171.87, elev_m: null }
  const start = Date.parse('2027-08-16T00:00:00Z')
  const end = Date.parse('2027-08-30T00:00:00Z')

  beforeAll(async () => {
    months = await loadMonths(['2027-08'])
    fx = await loadFixtures()
  })

  it('refined edges are within ±1 min of the true change, and no edge is missed at 1-min sampling', async () => {
    const sampleHorizon = await loadHorizonFile('sample-site.json')
    const malapert: SiteGeo = { lat: -85.9948, lon: -0.23578, elev_m: null }
    const ids = fx.stations.map((s) => s.id)
    const edges = { sun: 0, earth: 0, coverage: 0 }
    for (const [where, horizon] of [
      [site, null],
      [site, sampleHorizon],
      [malapert, null],
      [malapert, sampleHorizon],
    ] as const) {
      const ser = computeSeries(months, where, horizon, fx.stations, start, end)
      const fine = computeSeries(months, where, horizon, fx.stations, start, end, 1)
      for (const kind of ['sun', 'earth', 'coverage'] as const) {
        const ws = windows(ser, kind, ids)
        const fws = windows({ ...fine, months: undefined }, kind, ids)
        expect(ws.length, kind).toBe(fws.length)
        expect(ws[0].startMs).toBe(start)
        expect(ws[ws.length - 1].endMs).toBe(end)
        for (let i = 1; i < ws.length; i++) {
          const edge = ws[i].startMs
          expect(ws[i - 1].endMs).toBe(edge)
          const probe = computeSeries(months, where, horizon, fx.stations, edge - MIN, edge + MIN + 1, 2)
          const pw = windows({ ...probe, months: undefined }, kind, ids)
          // state 1 min before the edge = previous window, 1 min after = next window
          expect(pw[0].state, `${kind} ${new Date(edge).toISOString()}`).toBe(ws[i - 1].state)
          expect(pw[pw.length - 1].state).toBe(ws[i].state)
          expect(Math.abs(edge - fws[i].startMs)).toBeLessThanOrEqual(1.5 * MIN)
          edges[kind]++
        }
      }
    }
    expect(edges.sun).toBeGreaterThan(0)
    expect(edges.earth).toBeGreaterThan(0)
    expect(edges.coverage).toBeGreaterThan(0)
  })

  it('summary is consistent with the windows', () => {
    const ser = computeSeries(months, site, null, fx.stations, start, end)
    const ids = fx.stations.map((s) => s.id)
    const sum = summarize(ser, ids)
    for (const v of [sum.litPct, sum.earthVisiblePct, sum.coveragePct]) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
    expect(sum.unknownPct).toBe(0)
    const per = ids.map((id) => summarize(ser, [id]).coveragePct)
    expect(sum.coveragePct).toBeGreaterThanOrEqual(Math.max(...per) - 1e-9)
    expect(sum.coveragePct).toBeLessThanOrEqual(per.reduce((a, b) => a + b, 0) + 1e-9)
  })
})

// ---------- answerState ----------

describe('answerState', () => {
  it('reports time to the next change and whether it falls in the period', () => {
    // lit for 10 samples (5 h), dark for 10; covered for the first 4, then none
    const rows = Array.from({ length: 20 }, (_, k) => ({ lit: k < 10, visible: true, los: { a: k < 4 } }))
    const ser = fakeSeries(POLAR, rows)
    const s = answerState(ser, ['a'], T0 + HOUR)
    expect(s.sunLit).toBe(true)
    expect(s.sunHoursToChange).toBeCloseTo(3.75, 9) // edge midway between samples 9 and 10 (4.75 h)
    expect(s.sunChangeInPeriod).toBe(true)
    expect(s.comms).toBe('covered')
    expect(s.commsHoursToChange).toBeCloseTo(0.75, 9)
    expect(s.anyCoverageInPeriod).toBe(true)
    expect(s.earthEverRises).toBe(true)
    const late = answerState(ser, ['a'], T0 + 6 * HOUR)
    expect(late.sunLit).toBe(false)
    expect(late.sunChangeInPeriod).toBe(false)
    expect(late.sunHoursToChange).toBeCloseTo(4, 9)
    expect(late.comms).toBe('none')
    expect(late.commsChangeInPeriod).toBe(false)
    // the last window did not start at the period start: the sentence must not say "throughout"
    expect(s.sunSinceStart).toBe(true)
    expect(late.sunSinceStart).toBe(false)
    expect(late.commsSinceStart).toBe(false)
    expect(answerSentence(late)).toEqual({
      sun: 'Dark until the end of this period.',
      comms: 'No station contact until the end of this period.',
    })
    expect(() => answerState(ser, ['a'], ser.endMs)).toThrow(RangeError)
  })

  it('says Earth never rises only when no libration state shows it', () => {
    const rows = Array.from({ length: 4 }, () => ({ lit: true, visible: false, los: {} }))
    const farSide = answerState(fakeSeries({ lat: 0, lon: 180, elev_m: 0 }, rows), [], T0)
    expect(farSide.earthEverRises).toBe(false)
    expect(farSide.anyCoverageInPeriod).toBe(false)
    const nearSideHidden = answerState(fakeSeries({ lat: -89.5, lon: 0, elev_m: 0 }, rows), [], T0)
    expect(nearSideHidden.earthEverRises).toBe(true)
    const limb = answerState(fakeSeries({ lat: 0, lon: 96, elev_m: 0 }, rows), [], T0)
    expect(limb.earthEverRises).toBe(true) // reachable by libration in longitude
  })
})

// ---------- finder (T12) ----------

describe('finder (T12)', () => {
  const earliest = T0
  const latest = T0 + 9 * 24 * HOUR
  const run = (m: EphemMonth) => finder([m], POLAR, null, [FACING], ['facing'], earliest, latest, FINDER_DEFAULTS)

  it('always lit and covered: every candidate passes, one window', () => {
    const r = run(constantMonth(UP, UP))
    expect(r.nearestMiss).toBeNull()
    expect(r.windows.length).toBe(1)
    expect(r.windows[0].startMs).toBe(earliest)
    expect(r.windows[0].endMs).toBe(latest)
    expect(r.windows[0].best.litPct).toBe(100)
    expect(r.windows[0].best.coveragePct).toBe(100)
    expect(r.windows[0].best.longestGapH).toBe(0)
  })

  it('always dark: no window, lit and darkness thresholds named', () => {
    const r = run(constantMonth(DOWN, UP))
    expect(r.windows).toEqual([])
    expect(r.nearestMiss?.failed).toEqual(['minLitPct', 'maxDarkH'])
  })

  it('Earth below the horizon (far side): coverage thresholds named', () => {
    const r = run(constantMonth(UP, DOWN))
    expect(r.windows).toEqual([])
    expect(r.nearestMiss?.failed).toEqual(['minCoveragePct', 'maxGapH'])
  })

  // V8 recheck 15 Nov: with candidates 6 h apart the finder missed this window (18:00 has 74 h dark, 17 Aug 00:00 a
  // 51 h gap); every 30-min landing time from 20:00 to 21:00 qualifies (windows.py brute force agrees).
  it('V8: finds the short Haworth window of 16 Aug 2027 20:00-21:00 (all five stations, defaults)', async () => {
    const months = await loadMonths(['2027-08', '2027-09', '2027-10', '2027-11'])
    const horizon = await loadHorizonFile('haworth.json')
    const stations = stationsJson as Station[]
    const earliest = Date.parse('2027-08-16T00:00:00Z')
    const r = finder(
      months,
      { lat: -86.75, lon: -23.67, elev_m: 1550.9 },
      horizon,
      stations,
      stations.map((s) => s.id),
      earliest,
      earliest + 60 * 24 * HOUR,
      FINDER_DEFAULTS,
    )
    const w = r.windows.find((x) => x.startMs === Date.parse('2027-08-16T20:00:00Z'))
    expect(w).toBeDefined()
    expect(w?.endMs).toBe(Date.parse('2027-08-16T21:00:00Z'))
    expect(w?.best.longestDarkH).toBeLessThanOrEqual(FINDER_DEFAULTS.maxDarkH)
    expect(w?.best.longestGapH).toBeLessThanOrEqual(FINDER_DEFAULTS.maxGapH)
  })

  it('runs on a real month in well under a second', async () => {
    const fx = await loadFixtures()
    const months = await loadMonths(['2027-08', '2027-09'])
    const t = performance.now()
    const r = finder(
      months,
      { lat: -89.7668, lon: -171.87, elev_m: null },
      null,
      fx.stations,
      fx.stations.map((s) => s.id),
      Date.parse('2027-08-01T00:00:00Z'),
      Date.parse('2027-09-01T00:00:00Z'),
      FINDER_DEFAULTS,
    )
    const ms = performance.now() - t
    expect(ms).toBeLessThan(1000)
    expect(r.windows.length > 0 || r.nearestMiss !== null).toBe(true)
    for (let i = 1; i < r.windows.length; i++) {
      expect(r.windows[i - 1].best.coveragePct).toBeGreaterThanOrEqual(r.windows[i].best.coveragePct)
    }
  })
})
