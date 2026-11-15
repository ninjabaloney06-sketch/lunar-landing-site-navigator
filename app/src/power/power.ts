// P1 power estimate (add-on task 2, 15 Nov 2026): one sun-tracking panel at the landing site and a battery for the
// longest dark window. First estimate, not a power budget. Not validated by the science lead.
//
// Model: P(t) = S × A × η × f(t) × (AU / r(t))²
//   S    solar constant at 1 AU, W/m² (SOLAR_CONSTANT_W_M2)
//   A    panel area, m²                      (input)
//   η    cell efficiency, 0..1 (input in %)   (input)
//   f(t) visible share of the solar disc, 0..1: the series' sun.frac, i.e. geometry.discFraction over the terrain
//        horizon, from the same samples the summary uses (data/results computeSeries, 30 min)
//   r(t) site → Sun distance, km: the series' sun.dist_km (JPL DE440 via the shipped ephemeris)
// This module is pure arithmetic on that series: no geometry, no sampling of its own.
//
// Not modelled: temperature, panel degradation, dust, tilt (the panel always faces the Sun), partial-panel shading.

/** Total solar irradiance at 1 AU, W/m². Kopp & Lean 2011, GRL 38, L01706, doi:10.1029/2010GL045777 (value as
 *  cited in the task text; the DOI resolves; the paper text was not checked by the agent that wrote this). */
export const SOLAR_CONSTANT_W_M2 = 1361
export const SOLAR_CONSTANT_SOURCE = 'https://doi.org/10.1029/2010GL045777'

/** Astronomical unit, km: 149 597 870 700 m, JPL Solar System Dynamics, Astrodynamic Parameters,
 *  https://ssd.jpl.nasa.gov/astro_par.html */
export const AU_KM = 149_597_870.7
export const AU_SOURCE = 'https://ssd.jpl.nasa.gov/astro_par.html'

const HOUR_MS = 3_600_000

export interface PowerInputs {
  panelM2: number // panel area, m²
  effPct: number // cell efficiency, %
  loadW: number // constant load, W
  battWh: number // battery capacity, Wh
}

export type PowerKey = keyof PowerInputs

/** Example values, change them. Not the values of any spacecraft. */
export const POWER_DEFAULTS: PowerInputs = { panelM2: 1, effPct: 30, loadW: 100, battWh: 1000 }

/** Accepted range per input: above 0 and at most max. Anything else (zero, negative, empty, not a number, too large)
 *  is not an input the estimate uses. */
export const POWER_MAX: PowerInputs = { panelM2: 1000, effPct: 100, loadW: 1_000_000, battWh: 10_000_000 }

export function validPower(key: PowerKey, v: number): boolean {
  return Number.isFinite(v) && v > 0 && v <= POWER_MAX[key]
}

/** A typed value: the number when it is valid for key, else null. Empty text is null, never 0. */
export function parsePowerText(key: PowerKey, text: string): number | null {
  const t = text.trim()
  if (t === '' || !/^[+]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return null
  const v = Number(t)
  return validPower(key, v) ? v : null
}

/** One interval of the series: [t_k, t_k + hours), with the Sun's visible disc share and distance at t_k. */
export interface LightStep {
  frac: number
  sunDistKm: number
  hours: number
}

/** The series samples as intervals: sample k covers [t_k, min(t_k + step, endMs)) (left rectangle rule, the
 *  sampling computeSeries used). Samples with a non-finite share or distance are dropped. */
export function lightSteps(
  samples: readonly { utcMs: number; sun: { frac: number; dist_km: number } }[],
  endMs: number,
  stepMin: number,
): LightStep[] {
  const step = stepMin * 60_000
  const out: LightStep[] = []
  for (const s of samples) {
    const hours = (Math.min(s.utcMs + step, endMs) - s.utcMs) / HOUR_MS
    if (!(hours > 0) || !Number.isFinite(s.sun.frac) || !(s.sun.dist_km > 0)) continue
    out.push({ frac: Math.min(1, Math.max(0, s.sun.frac)), sunDistKm: s.sun.dist_km, hours })
  }
  return out
}

/** Panel output, W, at one instant. */
export function panelPowerW(frac: number, sunDistKm: number, inp: PowerInputs): number {
  const k = AU_KM / sunDistKm
  return SOLAR_CONSTANT_W_M2 * inp.panelM2 * (inp.effPct / 100) * frac * k * k
}

export interface PowerEstimate {
  hours: number // length of the period the steps cover, h
  meanW: number // mean panel output over the period, W
  energyKWh: number // panel energy over the period, kWh
  loadKWh: number // load × period, kWh
  balanceKWh: number // energyKWh − loadKWh
  darkH: number // longest dark window, h (from the app's sun windows, clipped to the period)
  darkNeedWh: number // load × darkH, Wh
  marginWh: number // battWh − darkNeedWh
  survives: boolean // battWh ≥ darkNeedWh: a battery exactly at the need counts as surviving
}

/** null when there is nothing to estimate: no steps, an invalid input or an invalid dark-window length. The battery
 *  is taken as full when the longest dark window starts and the panel gives nothing during it (f = 0 there). */
export function estimatePower(steps: readonly LightStep[], longestDarkH: number, inp: PowerInputs): PowerEstimate | null {
  if (steps.length === 0 || !Number.isFinite(longestDarkH) || longestDarkH < 0) return null
  if (!(Object.keys(POWER_DEFAULTS) as PowerKey[]).every((k) => validPower(k, inp[k]))) return null
  let hours = 0
  let wh = 0
  for (const s of steps) {
    hours += s.hours
    wh += panelPowerW(s.frac, s.sunDistKm, inp) * s.hours
  }
  if (!(hours > 0)) return null
  const loadWh = inp.loadW * hours
  const darkNeedWh = inp.loadW * longestDarkH
  const marginWh = inp.battWh - darkNeedWh
  return {
    hours,
    meanW: wh / hours,
    energyKWh: wh / 1000,
    loadKWh: loadWh / 1000,
    balanceKWh: (wh - loadWh) / 1000,
    darkH: longestDarkH,
    darkNeedWh,
    marginWh,
    survives: inp.battWh >= darkNeedWh,
  }
}

/** Rows for the drawer's CSV export (metric,value), inputs first. Without an estimate the outputs are empty. */
export function powerCsvRows(inp: PowerInputs, est: PowerEstimate | null): string[] {
  const v = (x: number | undefined, d: number) => (x === undefined ? '' : x.toFixed(d))
  return [
    `power_panel_area_m2,${inp.panelM2}`,
    `power_cell_efficiency_pct,${inp.effPct}`,
    `power_load_w,${inp.loadW}`,
    `power_battery_wh,${inp.battWh}`,
    `power_mean_w,${v(est?.meanW, 2)}`,
    `power_energy_kwh,${v(est?.energyKWh, 3)}`,
    `power_balance_kwh,${v(est?.balanceKWh, 3)}`,
    `power_longest_dark_need_wh,${v(est?.darkNeedWh, 1)}`,
    `power_battery_margin_wh,${v(est?.marginWh, 1)}`,
    `power_survives_longest_dark,${est ? (est.survives ? 'yes' : 'no') : ''}`,
  ]
}

// ---------- text ----------

const MINUS = '−'

/** Fixed decimals with thin-space thousands groups and a true minus sign; never "NaN". */
export function fmtNum(v: number, digits: number): string {
  if (!Number.isFinite(v)) return '–'
  const s = Math.abs(v).toFixed(digits)
  const [int, dec] = s.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const neg = v < 0 && Number(s) !== 0
  return `${neg ? MINUS : ''}${grouped}${dec ? `.${dec}` : ''}`
}

/** Watt-hours for a margin: whole Wh, but a non-zero margin that rounds to 0 says "under 1 Wh". */
export function fmtWh(v: number): string {
  if (v !== 0 && Math.abs(v) < 0.5) return 'under 1 Wh'
  return `${fmtNum(Math.abs(v), 0)} Wh`
}

/** The section's one answer: does the battery carry the longest dark window, and by how much. */
export function powerSentence(e: PowerEstimate): string {
  if (e.darkH === 0) return 'The battery survives: there is no dark window in this period.'
  const h = `${fmtNum(e.darkH, 1)} h`
  if (e.marginWh === 0) return `The battery survives the longest dark window, ${h}, with 0 Wh to spare: it holds exactly what the load needs.`
  return e.survives
    ? `The battery survives the longest dark window, ${h}, with ${fmtWh(e.marginWh)} to spare.`
    : `The battery does not survive the longest dark window, ${h}: it is ${fmtWh(e.marginWh)} short.`
}
