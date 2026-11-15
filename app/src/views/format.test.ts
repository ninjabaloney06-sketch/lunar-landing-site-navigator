import { describe, expect, it } from 'vitest'
import { fmtSpanH } from './format'

describe('fmtSpanH: durations as a planner reads them (U17)', () => {
  it('under a day in hours with one decimal', () => {
    expect(fmtSpanH(0)).toBe('0.0 h')
    expect(fmtSpanH(5.24)).toBe('5.2 h')
    expect(fmtSpanH(23.9)).toBe('23.9 h')
  })
  it('from a day on in days and whole hours', () => {
    expect(fmtSpanH(23.96)).toBe('1 day')
    expect(fmtSpanH(24)).toBe('1 day')
    expect(fmtSpanH(76)).toBe('3 days 4 h')
    expect(fmtSpanH(319.4)).toBe('13 days 7 h')
    expect(fmtSpanH(48.4)).toBe('2 days')
  })
  it('not a number reads "no data"', () => {
    expect(fmtSpanH(Number.NaN)).toBe('no data')
  })
})
