// The finder's landing span near the end of the data coverage (wave-0 open item for Finder.tsx).
import { describe, expect, it } from 'vitest'
import { COVERAGE_END_MS, DAY_MS } from '../state'
import { SEARCH_DAYS, landingSpan } from './finderSpan'

describe('landingSpan', () => {
  it('a mission well inside the coverage: from its first day, SEARCH_DAYS long', () => {
    const from = Date.UTC(2027, 7, 16)
    expect(landingSpan(from, 14)).toEqual({ startMs: from, latestMs: from + SEARCH_DAYS * DAY_MS })
  })

  it('near the end: the span stops at the last landing whose mission still fits', () => {
    const from = COVERAGE_END_MS - 30 * DAY_MS
    expect(landingSpan(from, 14)).toEqual({ startMs: from, latestMs: COVERAGE_END_MS - 14 * DAY_MS })
  })

  it('starting less than one mission length before the end: never Y before X, never empty; moved back to fit', () => {
    const from = COVERAGE_END_MS - 5 * DAY_MS
    const s = landingSpan(from, 14)
    expect(s.latestMs).toBeGreaterThanOrEqual(s.startMs)
    expect(s.startMs).toBe(COVERAGE_END_MS - 14 * DAY_MS)
    expect(s.latestMs + 14 * DAY_MS).toBeLessThanOrEqual(COVERAGE_END_MS)
  })

  it('holds for every start in the last 70 days and every mission length', () => {
    for (let d = 0; d <= 70; d++)
      for (const days of [1, 14, 30, 60]) {
        const s = landingSpan(COVERAGE_END_MS - d * DAY_MS, days)
        expect(s.latestMs).toBeGreaterThanOrEqual(s.startMs)
        expect(s.latestMs + days * DAY_MS).toBeLessThanOrEqual(COVERAGE_END_MS)
      }
  })
})
