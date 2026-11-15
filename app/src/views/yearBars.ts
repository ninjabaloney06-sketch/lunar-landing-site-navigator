// Sunlit and in-contact spans of whole calendar years, per site, for the drawer's stacked timeline. The same
// computeSeries / windows path as the answer and the finder (30-minute samples, edges refined by windows()).
// Sites are computed one per task, current site first; only the spans are kept (a year series is 17 520
// samples), for the session.
import { useEffect, useState } from 'react'
import { computeSeries, windows } from '../geometry'
import { loadMonthsFor } from '../data/load'
import { finderInputs, NoDataError } from '../data/results'
import type { CapHorizon } from '../data/southcap'
import type { Site, Station } from '../data/types'
import { COVERAGE_END_MS, COVERAGE_START_MS } from '../state'
import { approxText } from './custom'

export const YEARS = [2026, 2027, 2028, 2029, 2030]

export type Span = [number, number] // [startMs, endMs)

export type YearEntry =
  | { status: 'computing' }
  | { status: 'done'; lit: Span[]; covered: Span[]; approx?: string } // approx: a custom site's "Approximate: …" line
  | { status: 'none'; reason: string }

/** The calendar year, and the part of it this build has ephemeris for (Nov 2026 – Dec 2030). */
export function yearSpan(year: number): { yearStartMs: number; yearEndMs: number; startMs: number; endMs: number } {
  const yearStartMs = Date.UTC(year, 0, 1)
  const yearEndMs = Date.UTC(year + 1, 0, 1)
  return { yearStartMs, yearEndMs, startMs: Math.max(yearStartMs, COVERAGE_START_MS), endMs: Math.min(yearEndMs, COVERAGE_END_MS) }
}

/** The year shown first: the mission's own, inside the supported years. */
export function yearOf(ms: number): number {
  const y = new Date(ms).getUTCFullYear()
  return Math.min(YEARS[YEARS.length - 1], Math.max(YEARS[0], y))
}

const done = new Map<string, YearEntry>()
const COMPUTING: YearEntry = { status: 'computing' }

async function compute(site: Site, stations: Station[], ids: string[], year: number): Promise<YearEntry> {
  const { startMs, endMs } = yearSpan(year)
  if (endMs <= startMs) return { status: 'none', reason: 'no data for this year' }
  const { geo, horizon } = await finderInputs(site)
  if (!horizon) return { status: 'none', reason: 'no terrain data' }
  const months = await loadMonthsFor(startMs, endMs)
  if (!months) return { status: 'none', reason: 'no ephemeris for this year' }
  const series = computeSeries(months, geo, horizon, stations, startMs, endMs)
  const pick = (ws: ReturnType<typeof windows>, state: string): Span[] => ws.filter((w) => w.state === state).map((w) => [w.startMs, w.endMs])
  const approx = 'computed' in horizon ? approxText((horizon as CapHorizon).computed) : undefined
  return { status: 'done', lit: pick(windows(series, 'sun'), 'lit'), covered: pick(windows(series, 'coverage', ids), 'covered'), approx }
}

export function useYearBars(sites: Site[], stations: Station[], ids: string[], year: number): Record<string, YearEntry> {
  const job = `${year}|${ids.join(',')}`
  const keyOf = (siteId: string) => `${siteId}|${job}`
  const initial = (): Record<string, YearEntry> => Object.fromEntries(sites.map((s) => [s.id, done.get(keyOf(s.id)) ?? COMPUTING]))
  const [state, setState] = useState<{ job: string; entries: Record<string, YearEntry> }>(() => ({ job, entries: initial() }))
  const order = sites.map((s) => s.id).join(',')

  useEffect(() => {
    let alive = true
    setState({ job, entries: initial() })
    ;(async () => {
      for (const site of sites) {
        const k = keyOf(site.id)
        if (done.has(k)) continue
        await new Promise((r) => setTimeout(r, 0)) // one site per task: the drawer stays responsive
        if (!alive) return
        let entry: YearEntry
        try {
          entry = await compute(site, stations, ids, year)
          done.set(k, entry)
        } catch (e) {
          // a custom site the cap rasters do not cover; anything else is retried next time
          entry = { status: 'none', reason: e instanceof NoDataError ? 'no terrain data' : 'could not load' }
        }
        if (!alive) return
        setState((s) => (s.job === job ? { job, entries: { ...s.entries, [site.id]: entry } } : s))
      }
    })()
    return () => {
      alive = false
    }
    // the job key and the site order describe every input
  }, [job, order])

  return state.job === job ? { ...initial(), ...state.entries } : initial()
}
