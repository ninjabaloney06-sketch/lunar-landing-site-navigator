// "If the mission slips" (TASKS.md, slip rows on the finder result): the mission's own period moved 1, 7 and 30
// days later with the same length, and the nearest other prepared site on the original dates. Pure: the periods,
// the site and the signed change only. The numbers come from computeRow (data/results.ts), never from here.
import { distanceKm } from '../geometry/poiSearch'
import { COVERAGE_END_MS, COVERAGE_START_MS, DAY_MS } from '../state'

/** The later starts a planner asks about when a schedule slips, in days. */
export const SLIP_DAYS = [1, 7, 30] as const

export interface SlipPeriod {
  days: number // days later than the mission
  startMs: number
  endMs: number // exclusive, same length as the mission
  inRange: boolean // false: some part lies outside the supported dates, so no numbers are computed
}

/** The mission [startMs, endMs) moved by each of `offsets` days. A period is in range only when it lies wholly in
 *  [COVERAGE_START_MS, COVERAGE_END_MS); a non-finite or empty input is never in range (no NaN reaches a row). */
export function slipPeriods(startMs: number, endMs: number, offsets: readonly number[] = SLIP_DAYS): SlipPeriod[] {
  return offsets.map((days) => {
    const s = startMs + days * DAY_MS
    const e = endMs + days * DAY_MS
    const inRange = Number.isFinite(s) && Number.isFinite(e) && e > s && s >= COVERAGE_START_MS && e <= COVERAGE_END_MS
    return { days, startMs: s, endMs: e, inRange }
  })
}

/** Whole days of [startMs, endMs), for the custom period "Show" opens (the link accepts whole days only). */
export function wholeDays(startMs: number, endMs: number): number {
  return Math.max(1, Math.round((endMs - startMs) / DAY_MS))
}

interface Located {
  id: string
  lat: number
  lon: number
  group: string
}

/** The prepared site with the smallest great-circle distance to `site`: never `site` itself, never a custom site, never a
 *  reference site (group 'reference': sites.json marks those as not a landing site).
 *  Equal distances go to the smaller id, so the answer does not depend on the list order. null when none is left. */
export function nearestSite<T extends Located>(site: Pick<Located, 'id' | 'lat' | 'lon'>, sites: readonly T[]): { site: T; km: number } | null {
  let best: { site: T; km: number } | null = null
  for (const s of sites) {
    if (s.id === site.id || s.group === 'custom' || s.group === 'reference') continue
    const km = distanceKm(site.lat, site.lon, s.lat, s.lon)
    if (!Number.isFinite(km)) continue
    if (!best || km < best.km || (km === best.km && s.id < best.site.id)) best = { site: s, km }
  }
  return best
}

const MINUS = '−' // the true minus sign, as format.ts uses

/** The change of a share against the mission, in percentage points with one decimal: "+3.1", "−12.4", "0.0".
 *  A value that rounds to zero has no sign. Not finite → "unknown". */
export function fmtPointsDelta(value: number, base: number): string {
  const d = value - base
  if (!Number.isFinite(d)) return 'unknown'
  const s = Math.abs(d).toFixed(1)
  if (Number(s) === 0) return '0.0'
  return `${d < 0 ? MINUS : '+'}${s}`
}
