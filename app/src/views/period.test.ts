import { describe, expect, it } from 'vitest'
import { fmtDuration } from './period'

describe('fmtDuration (U17: durations as "3 days 4 h" where both parts matter)', () => {
  it('under two days: hours with one decimal', () => {
    expect(fmtDuration(0)).toBe('0.0 h')
    expect(fmtDuration(18.5)).toBe('18.5 h')
    expect(fmtDuration(47.9)).toBe('47.9 h')
  })
  it('from two days on: days and whole hours, the hours left out when they round to 0', () => {
    expect(fmtDuration(48)).toBe('2 days')
    expect(fmtDuration(76)).toBe('3 days 4 h')
    expect(fmtDuration(71.9)).toBe('3 days')
    expect(fmtDuration(95.6)).toBe('4 days')
  })
  it('never NaN', () => {
    expect(fmtDuration(Number.NaN)).toBe('unknown')
    expect(fmtDuration(Number.POSITIVE_INFINITY)).toBe('unknown')
  })
})
