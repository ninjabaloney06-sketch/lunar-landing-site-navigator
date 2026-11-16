// P1 power estimate: hand-computed cases. Every expected number below is worked out by hand in the comment next to
// it, not by the code under test. S = 1361 W/m², AU = 149 597 870.7 km. Also in docs/event/validation.md "P1 power
// estimate", for the science lead to check.
import { describe, expect, it } from 'vitest'
import {
  AU_KM,
  POWER_DEFAULTS,
  estimatePower,
  fmtNum,
  lightSteps,
  panelPowerW,
  parsePowerText,
  powerCsvRows,
  powerSentence,
  validPower,
} from './power'
import type { LightStep, PowerInputs } from './power'

const at1AU = (frac: number, hours: number, n: number): LightStep[] => Array.from({ length: n }, () => ({ frac, sunDistKm: AU_KM, hours }))
const BASE: PowerInputs = { panelM2: 1, effPct: 30, loadW: 100, battWh: 1000 }

describe('panel output P = S × A × η × f × (AU/r)²', () => {
  it('f = 1 at 1 AU: 1361 × 1 m² × 0.30 × 1 × 1 = 408.3 W', () => {
    expect(panelPowerW(1, AU_KM, BASE)).toBeCloseTo(408.3, 9)
  })
  it('f = 0: 1361 × 1 × 0.30 × 0 = 0 W', () => {
    expect(panelPowerW(0, AU_KM, BASE)).toBe(0)
  })
  it('f = 0.5 at 1 AU: 1361 × 1 × 0.30 × 0.5 = 204.15 W', () => {
    expect(panelPowerW(0.5, AU_KM, BASE)).toBeCloseTo(204.15, 9)
  })
  it('r = 2 AU, f = 1: 408.3 W × (1/2)² = 102.075 W', () => {
    expect(panelPowerW(1, 2 * AU_KM, BASE)).toBeCloseTo(102.075, 9)
  })
})

describe('estimate over the period', () => {
  it('f = 1 for 10 × 1 h: E = 408.3 W × 10 h = 4083 Wh = 4.083 kWh; load 100 W × 10 h = 1.000 kWh; balance 3.083 kWh', () => {
    const e = estimatePower(at1AU(1, 1, 10), 0, BASE)!
    expect(e.hours).toBe(10)
    expect(e.meanW).toBeCloseTo(408.3, 9)
    expect(e.energyKWh).toBeCloseTo(4.083, 9)
    expect(e.loadKWh).toBeCloseTo(1, 9)
    expect(e.balanceKWh).toBeCloseTo(3.083, 9)
  })
  it('f = 0 for 10 × 1 h: E = 0 kWh, mean 0 W; balance 0 − 1.000 = −1.000 kWh', () => {
    const e = estimatePower(at1AU(0, 1, 10), 10, BASE)!
    expect(e.energyKWh).toBe(0)
    expect(e.meanW).toBe(0)
    expect(e.balanceKWh).toBeCloseTo(-1, 9)
  })
  it('f = 0.5 for 10 × 1 h: E = 204.15 W × 10 h = 2041.5 Wh = 2.0415 kWh', () => {
    const e = estimatePower(at1AU(0.5, 1, 10), 0, BASE)!
    expect(e.meanW).toBeCloseTo(204.15, 9)
    expect(e.energyKWh).toBeCloseTo(2.0415, 9)
  })
  it('constant f = 0.25 over 48 × 0.5 h = 24 h, A = 2 m², η = 20 %, load 50 W', () => {
    // P = 1361 × 2 × 0.20 × 0.25 = 1361 × 0.1 = 136.1 W
    // E = 136.1 W × 24 h = 3266.4 Wh = 3.2664 kWh; load 50 W × 24 h = 1200 Wh; balance 3266.4 − 1200 = 2066.4 Wh
    const e = estimatePower(at1AU(0.25, 0.5, 48), 0, { panelM2: 2, effPct: 20, loadW: 50, battWh: 1000 })!
    expect(e.hours).toBe(24)
    expect(e.meanW).toBeCloseTo(136.1, 9)
    expect(e.energyKWh).toBeCloseTo(3.2664, 9)
    expect(e.balanceKWh).toBeCloseTo(2.0664, 9)
  })
})

describe('battery against the longest dark window (survives when battery ≥ load × dark hours)', () => {
  const steps = at1AU(1, 1, 30)
  it('exactly at the threshold: need = 100 W × 10 h = 1000 Wh, battery 1000 Wh → survives, margin 0 Wh', () => {
    const e = estimatePower(steps, 10, BASE)!
    expect(e.darkNeedWh).toBe(1000)
    expect(e.marginWh).toBe(0)
    expect(e.survives).toBe(true)
    expect(powerSentence(e)).toBe('The battery survives the longest dark window, 10.0 h, with 0 Wh to spare: it holds exactly what the load needs.')
  })
  it('1 Wh below: battery 999 Wh → does not survive, margin 999 − 1000 = −1 Wh', () => {
    const e = estimatePower(steps, 10, { ...BASE, battWh: 999 })!
    expect(e.marginWh).toBe(-1)
    expect(e.survives).toBe(false)
    expect(powerSentence(e)).toBe('The battery does not survive the longest dark window, 10.0 h: it is 1 Wh short.')
  })
  it('1 Wh above: battery 1001 Wh → survives, margin +1 Wh', () => {
    const e = estimatePower(steps, 10, { ...BASE, battWh: 1001 })!
    expect(e.marginWh).toBe(1)
    expect(e.survives).toBe(true)
    expect(powerSentence(e)).toBe('The battery survives the longest dark window, 10.0 h, with 1 Wh to spare.')
  })
  it('52.5 h at 100 W = 5250 Wh against 1000 Wh: 4250 Wh short', () => {
    const e = estimatePower(steps, 52.5, BASE)!
    expect(e.marginWh).toBe(-4250)
    expect(powerSentence(e)).toBe('The battery does not survive the longest dark window, 52.5 h: it is 4 250 Wh short.')
  })
  it('no dark window: need 0 Wh, survives', () => {
    const e = estimatePower(steps, 0, BASE)!
    expect(e.darkNeedWh).toBe(0)
    expect(e.survives).toBe(true)
    expect(powerSentence(e)).toBe('The battery survives: there is no dark window in this period.')
  })
})

describe('the series as intervals', () => {
  it('30-min samples at 0, 30, 60 min with the period ending at 75 min: 0.5 h, 0.5 h, 0.25 h', () => {
    const s = (min: number, frac: number) => ({ utcMs: min * 60_000, sun: { frac, dist_km: AU_KM } })
    const steps = lightSteps([s(0, 1), s(30, 0.5), s(60, 0)], 75 * 60_000, 30)
    expect(steps.map((x) => x.hours)).toEqual([0.5, 0.5, 0.25])
    // E = 408.3 × 0.5 + 204.15 × 0.5 + 0 × 0.25 = 204.15 + 102.075 = 306.225 Wh over 1.25 h → mean 244.98 W
    const e = estimatePower(steps, 0, BASE)!
    expect(e.energyKWh).toBeCloseTo(0.306225, 9)
    expect(e.meanW).toBeCloseTo(244.98, 9)
  })
  it('drops samples with a non-finite share or distance', () => {
    const bad = [{ utcMs: 0, sun: { frac: NaN, dist_km: AU_KM } }, { utcMs: 1, sun: { frac: 1, dist_km: 0 } }]
    expect(lightSteps(bad, 3_600_000, 30)).toEqual([])
  })
})

describe('nonsense inputs never give NaN', () => {
  it('rejects zero, negative, empty, non-numbers and out-of-range values', () => {
    for (const t of ['', ' ', '0', '-1', 'abc', 'NaN', 'Infinity', '1e999', '1,5', '--2']) expect(parsePowerText('panelM2', t)).toBeNull()
    expect(parsePowerText('effPct', '100.5')).toBeNull()
    expect(parsePowerText('effPct', '100')).toBe(100)
    expect(parsePowerText('panelM2', ' 2.5 ')).toBe(2.5)
    expect(validPower('loadW', 0)).toBe(false)
  })
  it('no estimate (null) for no steps, an invalid input or an invalid dark length', () => {
    expect(estimatePower([], 0, BASE)).toBeNull()
    expect(estimatePower(at1AU(1, 1, 1), NaN, BASE)).toBeNull()
    expect(estimatePower(at1AU(1, 1, 1), -1, BASE)).toBeNull()
    expect(estimatePower(at1AU(1, 1, 1), 0, { ...BASE, panelM2: 0 })).toBeNull()
    expect(estimatePower(at1AU(1, 1, 1), 0, { ...BASE, effPct: NaN })).toBeNull()
  })
  it('fmtNum never prints NaN', () => {
    expect(fmtNum(NaN, 1)).toBe('–')
    expect(fmtNum(-0.04, 1)).toBe('0.0')
    expect(fmtNum(-1234.5, 1)).toBe('−1 234.5')
  })
})

describe('CSV rows', () => {
  it('inputs and outputs, empty outputs without an estimate', () => {
    const e = estimatePower(at1AU(1, 1, 10), 10, BASE)!
    expect(powerCsvRows(BASE, e)).toEqual([
      'power_status,first estimate; not a power budget; stated as validated by the science lead on 15 Nov 2026 (no per-check sign-off; see record)',
      'power_panel_area_m2,1',
      'power_cell_efficiency_pct,30',
      'power_load_w,100',
      'power_battery_wh,1000',
      'power_mean_w,408.30',
      'power_energy_kwh,4.083',
      'power_balance_kwh,3.083',
      'power_longest_dark_need_wh,1000.0',
      'power_battery_margin_wh,0.0',
      'power_survives_longest_dark,yes',
    ])
    expect(powerCsvRows(POWER_DEFAULTS, null).slice(5)).toEqual([
      'power_mean_w,',
      'power_energy_kwh,',
      'power_balance_kwh,',
      'power_longest_dark_need_wh,',
      'power_battery_margin_wh,',
      'power_survives_longest_dark,',
    ])
  })
})
