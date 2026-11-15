// "If the mission slips": shifted periods, range clipping, the nearest prepared site and the signed change.
import { describe, expect, it } from 'vitest'
import { distanceKm } from '../geometry/poiSearch'
import { COVERAGE_END_MS, COVERAGE_START_MS, DAY_MS } from '../state'
import { fmtPointsDelta, nearestSite, SLIP_DAYS, slipPeriods, wholeDays } from './slip'

const AUG16 = Date.UTC(2027, 7, 16)
const AUG30 = Date.UTC(2027, 7, 30)

describe('slipPeriods', () => {
  it('moves the mission 1, 7 and 30 days later with the same length', () => {
    const ps = slipPeriods(AUG16, AUG30)
    expect(ps.map((p) => p.days)).toEqual([...SLIP_DAYS])
    expect(ps.map((p) => p.startMs)).toEqual([Date.UTC(2027, 7, 17), Date.UTC(2027, 7, 23), Date.UTC(2027, 8, 15)])
    for (const p of ps) {
      expect(p.endMs - p.startMs).toBe(AUG30 - AUG16)
      expect(p.inRange).toBe(true)
    }
  })

  it('keeps a start time that is not midnight', () => {
    const start = AUG16 + 18 * 3_600_000
    const [p] = slipPeriods(start, start + 5 * DAY_MS, [1])
    expect(p.startMs).toBe(start + DAY_MS)
    expect(p.endMs).toBe(start + 6 * DAY_MS)
  })

  it('is out of range once any part passes 31 Dec 2030', () => {
    const start = Date.UTC(2030, 11, 20)
    const end = Date.UTC(2030, 11, 31) // 20–30 Dec 2030
    const ps = slipPeriods(start, end)
    expect(ps.map((p) => p.inRange)).toEqual([true, false, false])
    expect(ps[0].endMs).toBe(COVERAGE_END_MS) // ends exactly at the end of 31 Dec 2030: still in range
  })

  it('is out of range before 1 Nov 2026 and for a non-finite or empty input, never NaN in range', () => {
    expect(slipPeriods(COVERAGE_START_MS - 10 * DAY_MS, COVERAGE_START_MS - 2 * DAY_MS, [1])[0].inRange).toBe(false)
    expect(slipPeriods(NaN, AUG30)[0].inRange).toBe(false)
    expect(slipPeriods(AUG16, Infinity)[0].inRange).toBe(false)
    expect(slipPeriods(AUG16, AUG16)[0].inRange).toBe(false)
  })
})

describe('wholeDays', () => {
  it('is the mission length in whole days, at least 1', () => {
    expect(wholeDays(AUG16, AUG30)).toBe(14)
    expect(wholeDays(AUG16, AUG16 + 3_600_000)).toBe(1)
  })
})

describe('nearestSite', () => {
  const here = { id: 'a', lat: -89.46, lon: -136.68, group: 'commercial' }
  const near = { id: 'b', lat: -88.99, lon: -104.47, group: 'artemis-2022' }
  const far = { id: 'c', lat: -85.98, lon: -0.26, group: 'artemis-2024' }
  const custom = { id: 'custom-1', lat: -89.45, lon: -136.6, group: 'custom' }

  it('is the smallest great-circle distance, never the site itself or a custom site', () => {
    const r = nearestSite(here, [far, here, custom, near])
    expect(r?.site.id).toBe('b')
    expect(r?.km).toBeCloseTo(distanceKm(here.lat, here.lon, near.lat, near.lon), 9)
  })

  it('breaks a tie by id, whatever the list order', () => {
    const twin = { ...near, id: 'aa' }
    expect(nearestSite(here, [near, twin])?.site.id).toBe('aa')
    expect(nearestSite(here, [twin, near])?.site.id).toBe('aa')
  })

  it('is null when no other prepared site is listed', () => {
    expect(nearestSite(here, [here, custom])).toBeNull()
    expect(nearestSite(here, [])).toBeNull()
  })

  it('skips reference sites (not a landing site)', () => {
    expect(nearestSite(here, [{ ...near, group: 'reference' }])).toBeNull()
  })
})

describe('fmtPointsDelta', () => {
  it('signs the change in percentage points with one decimal and a true minus', () => {
    expect(fmtPointsDelta(65.14, 62.04)).toBe('+3.1')
    expect(fmtPointsDelta(40, 52.4)).toBe('−12.4')
    expect(fmtPointsDelta(50.02, 50)).toBe('0.0')
    expect(fmtPointsDelta(49.98, 50)).toBe('0.0')
  })

  it('never shows NaN', () => {
    expect(fmtPointsDelta(NaN, 50)).toBe('unknown')
    expect(fmtPointsDelta(50, Infinity)).toBe('unknown')
  })
})
