// The mission's period from the link state: a named period, a custom span, or the default period. One place,
// so the header, the timeline and a saved mission's table row read a link the same way.
import type { Period } from '../data/types'
import { COVERAGE_END_MS, COVERAGE_START_MS, DAY_MS, DEFAULT_DAYS, DEFAULT_PERIOD_ID } from '../state'
import type { HashState } from '../state'
import type { ViewPeriod } from './Drawer'
import { fmtRange, fmtShort } from './format'

/** A span's label: whole calendar days when it starts at 00:00 UTC; otherwise with the times, so the label does
 *  not suggest whole days (e.g. a period opened from the finder at the landing time). */
export function spanLabel(startMs: number, endMs: number): string {
  return startMs % DAY_MS === 0 ? fmtRange(startMs, endMs) : `${fmtShort(startMs)} – ${fmtShort(endMs)} UTC`
}

export function resolvePeriod(s: Pick<HashState, 'period' | 'from' | 'days'>, periods: Period[]): ViewPeriod {
  if (s.period === 'custom' && s.from !== null) {
    const end = Math.min(s.from + s.days * DAY_MS, COVERAGE_END_MS)
    return { id: 'custom', label: spanLabel(s.from, end), startMs: s.from, endMs: end }
  }
  const p = periods.find((x) => x.id === s.period) ?? periods.find((x) => x.id === DEFAULT_PERIOD_ID) ?? periods[0]
  if (!p) {
    const start = COVERAGE_START_MS
    return { id: 'custom', label: fmtRange(start, start + DEFAULT_DAYS * DAY_MS), startMs: start, endMs: start + DEFAULT_DAYS * DAY_MS }
  }
  const startMs = Date.parse(p.start_utc)
  const endMs = Date.parse(p.end_utc)
  return { id: p.id, label: fmtRange(startMs, endMs), startMs, endMs }
}
