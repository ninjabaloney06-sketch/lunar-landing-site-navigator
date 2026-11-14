import { describe, expect, it } from 'vitest'
import { DEFAULT_SPEED, SPEEDS, fmtDayTime, fmtDuration, fmtElapsed, fmtKms, fmtTonnes, fmtUtc } from './flightFormat'

describe('fmtKms', () => {
  it('uses two decimals, three below 0.1 km/s', () => {
    expect(fmtKms(3.128)).toBe('3.13 km/s')
    expect(fmtKms(0.0191)).toBe('0.019 km/s')
  })
  it('marks estimates with ≈', () => {
    expect(fmtKms(9.42, true)).toBe('≈ 9.42 km/s')
  })
})

describe('fmtTonnes', () => {
  it('uses one decimal from one tonne, two below', () => {
    expect(fmtTonnes(27000)).toBe('27.0 t')
    expect(fmtTonnes(210)).toBe('0.21 t')
  })
})

describe('fmtDuration', () => {
  it('omits zero units', () => {
    expect(fmtDuration(510)).toBe('8 min 30 s')
    expect(fmtDuration(480)).toBe('8 min')
    expect(fmtDuration(45)).toBe('45 s')
    expect(fmtDuration(4 * 3600 + 12 * 60)).toBe('4 h 12 min')
    expect(fmtDuration(4 * 3600)).toBe('4 h')
  })
  it('switches to days from one day', () => {
    expect(fmtDuration(4 * 86400 + 23 * 3600 + 30 * 60)).toBe('4 d 23 h')
    expect(fmtDuration(2 * 86400)).toBe('2 d')
  })
})

describe('fmtElapsed', () => {
  it('shows days then zero-padded hh:mm:ss', () => {
    expect(fmtElapsed(510_000)).toBe('T+ 0 d 00:08:30')
    expect(fmtElapsed(0)).toBe('T+ 0 d 00:00:00')
    expect(fmtElapsed((3 * 86400 + 5 * 3600 + 7 * 60 + 9) * 1000)).toBe('T+ 3 d 05:07:09')
  })
  it('clamps negative input to zero', () => {
    expect(fmtElapsed(-5000)).toBe('T+ 0 d 00:00:00')
  })
})

describe('fmtUtc', () => {
  it('formats date and time in UTC with an abbreviated month', () => {
    expect(fmtUtc(Date.UTC(2027, 7, 16, 7, 42))).toBe('16 Aug 2027, 07:42 UTC')
  })
})

describe('fmtDayTime', () => {
  it('formats the short burn time', () => {
    expect(fmtDayTime(Date.UTC(2027, 7, 16, 7, 42))).toBe('16 Aug, 07:42')
  })
})

describe('SPEEDS', () => {
  it('lists the seven steps and defaults to 4 h/s', () => {
    expect(SPEEDS.map((s) => s.label)).toEqual(['1 min/s', '5 min/s', '15 min/s', '1 h/s', '4 h/s', '12 h/s', '1 day/s'])
    expect(SPEEDS.map((s) => s.value)).toEqual([60, 300, 900, 3600, 14400, 43200, 86400])
    expect(DEFAULT_SPEED).toBe(14400)
  })
})
