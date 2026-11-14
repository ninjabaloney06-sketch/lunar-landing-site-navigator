// T9: the browser geometry reproduces the Python reference (scripts/windows.py via export_fixtures.py) to 1e-6 deg.
import { beforeAll, describe, expect, it } from 'vitest'
import type { EphemMonth, Horizon } from '../data/types'
import { computeSeries, interpolate, maskAt, stationLos } from './index'
import { type Fixtures, loadFixtures, loadHorizonFile, loadMonths } from './testData'

let fx: Fixtures
let months: EphemMonth[]
const horizons: Record<string, Horizon> = {}

beforeAll(async () => {
  fx = await loadFixtures()
  months = await loadMonths(fx.ephem_months)
  for (const h of fx.horizon_files) horizons[h] = await loadHorizonFile(h)
})

const azDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)

describe('T9 fixtures (Python reference = TypeScript, 1e-6 deg)', () => {
  it('has 200 cases over several sites, both horizons and every station', () => {
    expect(fx.cases.length).toBe(200)
    expect(new Set(fx.cases.map((c) => c.site)).size).toBeGreaterThanOrEqual(4)
    expect(fx.cases.some((c) => c.horizon === null)).toBe(true)
    expect(fx.cases.some((c) => c.horizon !== null)).toBe(true)
    expect(fx.stations.length).toBeGreaterThan(0)
  })

  it('interpolated body state matches', () => {
    let worstRel = 0
    let worstQ = 0
    for (const c of fx.cases) {
      const s = interpolate(months, c.utcMs)
      for (const key of ['sun_km', 'earth_km'] as const) {
        const ref = c.state[key]
        const n = Math.hypot(ref[0], ref[1], ref[2])
        for (let i = 0; i < 3; i++) worstRel = Math.max(worstRel, Math.abs(s[key][i] - ref[i]) / n)
      }
      for (const key of ['q_me_to_j2000', 'q_earth_to_me'] as const) {
        for (let i = 0; i < 4; i++) worstQ = Math.max(worstQ, Math.abs(s[key][i] - c.state[key][i]))
      }
    }
    expect(worstRel).toBeLessThan(1e-12)
    expect(worstQ).toBeLessThan(1e-12)
  })

  it('Sun, Earth and station angles match within 1e-6 deg; visibility matches', () => {
    const tol = fx.tolerance_deg
    let worst = 0
    let checkedFlags = 0
    for (const c of fx.cases) {
      const site = fx.sites[c.site]
      const horizon = c.horizon ? horizons[c.horizon] : null
      const ser = computeSeries(months, site, horizon, fx.stations, c.utcMs, c.utcMs + 1)
      expect(ser.samples.length).toBe(1)
      const smp = ser.samples[0]
      for (const key of ['sun', 'earth'] as const) {
        const ref = c[key]
        const got = smp[key]
        const d = Math.max(azDiff(got.az, ref.az), Math.abs(got.el - ref.el), Math.abs(got.mask - ref.mask))
        worst = Math.max(worst, d)
        expect(d, `${c.site} ${c.utc} ${key}`).toBeLessThan(tol)
        expect(Math.abs(got.dist_km - ref.dist_km) / ref.dist_km).toBeLessThan(1e-12)
        expect(Math.abs(got.frac - ref.frac)).toBeLessThan(1e-5)
      }
      // Booleans only where the reference is not at the threshold.
      if (c.sun.frac > 1e-6 || c.sun.frac === 0) {
        expect(smp.sun.lit, `${c.site} ${c.utc} lit`).toBe(c.sun.lit)
        checkedFlags++
      }
      if (c.earth.frac > 1e-6 || c.earth.frac === 0) {
        expect(smp.earth.visible, `${c.site} ${c.utc} visible`).toBe(c.earth.visible)
        checkedFlags++
      }
      for (const st of fx.stations) {
        const ref = c.stations[st.id]
        const got = smp.stations[st.id]
        const direct = stationLos(st, site, interpolate(months, c.utcMs), horizon)
        for (const g of [got, direct]) {
          const d = Math.max(azDiff(g.az, ref.az), Math.abs(g.el - ref.el), Math.abs(g.moonElAtStation - ref.moonElAtStation))
          worst = Math.max(worst, d)
          expect(d, `${c.site} ${c.utc} ${st.id}`).toBeLessThan(tol)
        }
        const terrainMargin = Math.abs(ref.el - maskAt(horizon, ref.az))
        if (terrainMargin > tol && Math.abs(ref.moonElAtStation - st.min_elev_deg) > tol) {
          expect(got.state, `${c.site} ${c.utc} ${st.id} state`).toBe(ref.state)
          expect(got.reason).toBe(ref.reason)
          checkedFlags++
        }
      }
    }
    // nearly every flag is checked (only exact-threshold cases are skipped)
    expect(checkedFlags).toBeGreaterThan(0.95 * fx.cases.length * (2 + fx.stations.length))
    console.log(`T9 worst angular difference: ${worst.toExponential(2)} deg over ${fx.cases.length} cases`)
  })
})
