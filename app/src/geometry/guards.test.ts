// Degenerate inputs of geometry/index.ts: a zero quaternion or vector is an error, an empty period is "unknown".
import { describe, expect, it } from 'vitest'
import type { EphemMonth, Quat, Vec3 } from '../data/types'
import { type Sample, type Series, azEl, enuBasis, interpolate, summarize } from './index'

const MIN = 60_000
const T0 = Date.parse('2027-01-01T00:00:00Z')

function month(q: Quat): EphemMonth {
  const n = 10
  return {
    start_utc: '2027-01-01T00:00:00Z',
    step_min: 30,
    n,
    frame: 'MOON_ME',
    correction: 'LT+S',
    sun_km: Array.from({ length: n }, () => [1.496e8, 0, 0] as Vec3),
    earth_km: Array.from({ length: n }, () => [384400, 0, 0] as Vec3),
    q_me_to_j2000: Array.from({ length: n }, () => q),
    q_earth_to_me: Array.from({ length: n }, () => [0, 0, 0, 1] as Quat),
    kernels: [],
  }
}

describe('normalisation guards', () => {
  it('interpolate: identity quaternions still work, a zero or NaN quaternion throws RangeError', () => {
    const s = interpolate([month([0, 0, 0, 1])], T0 + 45 * MIN)
    expect(s.q_me_to_j2000).toEqual([0, 0, 0, 1])
    expect(() => interpolate([month([0, 0, 0, 0])], T0 + 45 * MIN)).toThrow(RangeError)
    expect(() => interpolate([month([NaN, 0, 0, 1])], T0 + 45 * MIN)).toThrow(RangeError)
  })
  it('azEl: a body at the site itself throws RangeError instead of returning NaN', () => {
    const enu = enuBasis(10, 20)
    expect(() => azEl([1, 2, 3], [1, 2, 3], enu)).toThrow(RangeError)
    expect(azEl([1, 2, 3 + 1000], [1, 2, 3], enu).dist_km).toBe(1000)
  })
})

describe('summarize on an empty period', () => {
  const body = { az: 0, el: 0, dist_km: 1, dirEnu: [0, 1, 0] as Vec3, mask: 0, frac: 0 }
  const sample = (k: number): Sample => ({
    utcMs: T0 + k * 30 * MIN,
    sun: { ...body, frac: 1, lit: true },
    earth: { ...body, frac: 1, visible: true },
    stations: {},
  })
  const series = (endMs: number): Series => ({
    site: { lat: -89.5, lon: 0, elev_m: 0 },
    horizon: null,
    stations: [],
    startMs: T0,
    endMs,
    stepMin: 30,
    samples: [0, 1, 2, 3].map(sample),
  })
  it('a positive span gives finite percentages', () => {
    const s = summarize(series(T0 + 4 * 30 * MIN), [])
    expect(s.litPct).toBeCloseTo(100, 9)
  })
  it('a zero or negative span gives NaN percentages (what rankSites reads as unknown), never Infinity or a negative share', () => {
    for (const endMs of [T0, T0 - HOUR]) {
      const s = summarize(series(endMs), [])
      for (const v of [s.litPct, s.earthVisiblePct, s.coveragePct, s.unknownPct]) expect(Number.isNaN(v)).toBe(true)
    }
  })
})
const HOUR = 60 * MIN
