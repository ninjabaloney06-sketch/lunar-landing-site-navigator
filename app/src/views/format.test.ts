import { describe, expect, it } from 'vitest'
import { fmtRange, fmtSpanH } from './format'

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

describe('fmtRange: mission dates in the header (feature review)', () => {
  const D = 86_400_000
  it('a span within one month, across months and across years', () => {
    expect(fmtRange(Date.UTC(2027, 7, 16), Date.UTC(2027, 7, 30))).toBe('16–29 Aug 2027')
    expect(fmtRange(Date.UTC(2027, 7, 25), Date.UTC(2027, 8, 3))).toBe('25 Aug – 2 Sep 2027')
    expect(fmtRange(Date.UTC(2029, 11, 30), Date.UTC(2030, 0, 2))).toBe('30 Dec 2029 – 1 Jan 2030')
  })
  it('a one-day mission is one date, not "31–31 Dec 2030"', () => {
    expect(fmtRange(Date.UTC(2030, 11, 31), Date.UTC(2030, 11, 31) + D)).toBe('31 Dec 2030')
    expect(fmtRange(Date.UTC(2027, 7, 16), Date.UTC(2027, 7, 17))).toBe('16 Aug 2027')
  })
})
