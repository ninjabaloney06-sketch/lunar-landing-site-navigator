// The landing dates the finder searches (Finder.tsx): from the mission's first day up to SEARCH_DAYS later, and never
// so late that a mission of `days` would run past the end of the data coverage. When the mission starts less than one
// mission length before that end, the span moves back so that it ends at the last landing that still fits; it is
// never empty and never ends before it starts (wave-0 item: "Landing between X and Y" with Y before X).
import { COVERAGE_END_MS, COVERAGE_START_MS, DAY_MS } from '../state'

export const SEARCH_DAYS = 60

export function landingSpan(fromMs: number, days: number): { startMs: number; latestMs: number } {
  const lastFit = COVERAGE_END_MS - days * DAY_MS // the last landing whose mission ends inside the coverage
  const startMs = Math.max(COVERAGE_START_MS, Math.min(fromMs, lastFit))
  const latestMs = Math.max(startMs, Math.min(startMs + SEARCH_DAYS * DAY_MS, lastFit))
  return { startMs, latestMs }
}
