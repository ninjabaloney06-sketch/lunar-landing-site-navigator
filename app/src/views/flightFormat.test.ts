import { describe, expect, it } from 'vitest'
import { DEFAULT_SPEED, SPEEDS, burnName, fmtDayTime, fmtDays, fmtDuration, fmtElapsed, fmtKm, fmtKms, fmtMetres, fmtTonnes, fmtUtc, shortStage } from './flightFormat'

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

describe('fmtKm', () => {
  it('rounds to whole kilometres and groups thousands', () => {
    expect(fmtKm(100)).toBe('100 km')
    expect(fmtKm(405760.4)).toBe('405,760 km')
    expect(fmtKm(1837.6)).toBe('1,838 km')
  })
})

describe('fmtMetres', () => {
  it('uses one decimal below 10 m', () => {
    expect(fmtMetres(3.21)).toBe('3.2 m')
    expect(fmtMetres(0)).toBe('0.0 m')
  })
  it('uses whole metres from 10 m', () => {
    expect(fmtMetres(42.4)).toBe('42 m')
    expect(fmtMetres(9.97)).toBe('10 m')
    expect(fmtMetres(999.4)).toBe('999 m')
  })
  it('switches to kilometres from 1000 m', () => {
    expect(fmtMetres(1000)).toBe('1.0 km')
    expect(fmtMetres(999.6)).toBe('1.0 km')
    expect(fmtMetres(1420)).toBe('1.4 km')
  })
})

describe('SPEEDS', () => {
  it('lists the nine steps from real time to 1 day/s and defaults to 4 h/s', () => {
    expect(SPEEDS.map((s) => s.label)).toEqual([
      'real time',
      '10 s/s',
      '1 min/s',
      '5 min/s',
      '15 min/s',
      '1 h/s',
      '4 h/s',
      '12 h/s',
      '1 day/s',
    ])
    expect(SPEEDS.map((s) => s.value)).toEqual([1, 10, 60, 300, 900, 3600, 14400, 43200, 86400])
    expect(SPEEDS.some((s) => s.value === DEFAULT_SPEED)).toBe(true)
    expect(DEFAULT_SPEED).toBe(14400)
  })
})

describe('fmtDays', () => {
  it('uses the singular for exactly one day', () => {
    expect(fmtDays(1)).toBe('1 day')
    expect(fmtDays(0.5)).toBe('0.5 days')
    expect(fmtDays(6.5)).toBe('6.5 days')
    expect(fmtDays(12.97, 1)).toBe('13.0 days')
  })
})

describe('shortStage', () => {
  it('replaces a name by the abbreviation that follows it', () => {
    expect(shortStage('European Service Module (ESM), Orbital Maneuvering System Engine (OMS-E)')).toBe('ESM, OMS-E')
    expect(shortStage('Interim Cryogenic Propulsion Stage (ICPS), RL10B-2')).toBe('ICPS, RL10B-2')
    expect(shortStage('Service Propulsion System (SPS) engine')).toBe('SPS engine')
  })
  it('keeps the words the abbreviation does not stand for', () => {
    expect(shortStage('Starship Human Landing System (HLS)')).toBe('Starship HLS')
    expect(shortStage('Apollo Lunar Module (LM)')).toBe('Apollo LM')
  })
  it('drops a parenthesis that is not the initials and leaves plain names alone', () => {
    expect(shortStage('Blue Moon Mark 2 (MK2)')).toBe('Blue Moon Mark 2')
    expect(shortStage('S-IVB')).toBe('S-IVB')
    expect(shortStage('SLS Block 1')).toBe('SLS Block 1')
  })
})

describe('burnName', () => {
  it('prefers the abbreviation of the official term', () => {
    expect(burnName({ short: 'TLI', label: 'Trans-Lunar Injection (TLI)' })).toBe('TLI')
  })
  it('uses a short term as it is and the short form of a long one', () => {
    expect(burnName({ short: 'Lander', label: 'Lander NRHO departure burn' })).toBe('Lander NRHO departure burn')
    expect(burnName({ short: 'Launch', label: 'Launch and ascent to Earth parking orbit' })).toBe('Launch')
    expect(burnName({ short: 'Liftoff', label: 'Liftoff' })).toBe('Liftoff')
  })
})
