// The mission's period from the link state: a named period, a custom span, or the default period. One place,
// so the header, the timeline and a saved mission's table row read a link the same way.
import type { Period } from '../data/types'
import { COVERAGE_END_MS, COVERAGE_START_MS, DAY_MS, DEFAULT_DAYS, DEFAULT_PERIOD_ID } from '../state'
import type { HashState } from '../state'
import type { ViewPeriod } from './Drawer'
import { fmtRange, fmtShort } from './format'

export function resolvePeriod(s: Pick<HashState, 'period' | 'from' | 'days'>, periods: Period[]): ViewPeriod {
  if (s.period === 'custom' && s.from !== null) {
    const end = Math.min(s.from + s.days * DAY_MS, COVERAGE_END_MS)
    // A period that does not start at 00:00 UTC (e.g. opened from the finder at the landing time) says so,
    // so the label does not suggest whole calendar days.
    const label = s.from % DAY_MS === 0 ? fmtRange(s.from, end) : `${fmtShort(s.from)} – ${fmtShort(end)} UTC`
    return { id: 'custom', label, startMs: s.from, endMs: end }
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
