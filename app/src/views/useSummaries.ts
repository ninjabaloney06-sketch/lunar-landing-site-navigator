// Per-site summaries for the Mission panel's ranking: summarize() for the mission's own dates and stations, through
// the same computeResults path as the answer and the drawer. Sites are computed one after another (current site
// first, then the order given), each in its own task, so the screen stays usable; finished values are kept for the
// session, so reopening the panel or going back to a selection is instant.
import { useEffect, useState } from 'react'
import { computeResults, NoDataError } from '../data/results'
import type { Site, Station } from '../data/types'
import type { Summary } from '../geometry'

export type SummaryEntry =
  | { status: 'computing' }
  | { status: 'done'; summary: Summary }
  | { status: 'none'; reason: string } // no ephemeris or horizon in this build, or the load failed

const done = new Map<string, SummaryEntry>()
const COMPUTING: SummaryEntry = { status: 'computing' }

const keyOf = (siteId: string, mission: string) => `${siteId}|${mission}`

export function useSummaries(
  sites: Site[], // in compute order
  stations: Station[],
  ids: string[],
  startMs: number,
  endMs: number,
): Record<string, SummaryEntry> {
  const mission = `${startMs}|${endMs}|${ids.join(',')}`
  const initial = (): Record<string, SummaryEntry> => Object.fromEntries(sites.map((s) => [s.id, done.get(keyOf(s.id, mission)) ?? COMPUTING]))
  const [state, setState] = useState<{ mission: string; entries: Record<string, SummaryEntry> }>(() => ({ mission, entries: initial() }))

  useEffect(() => {
    let alive = true
    setState({ mission, entries: initial() })
    ;(async () => {
      for (const site of sites) {
        const k = keyOf(site.id, mission)
        if (done.has(k)) continue
        await new Promise((r) => setTimeout(r, 0)) // one site per task: input and paint stay responsive
        if (!alive) return
        let entry: SummaryEntry
        try {
          const r = await computeResults({ site, stations, ids, startMs, endMs })
          entry = { status: 'done', summary: r.summary }
          done.set(k, entry)
        } catch (e) {
          const missing = e instanceof NoDataError
          entry = { status: 'none', reason: missing ? 'no data in this build' : 'could not load' }
          if (missing) done.set(k, entry) // a failed load is retried next time
        }
        if (!alive) return
        setState((s) => (s.mission === mission ? { mission, entries: { ...s.entries, [site.id]: entry } } : s))
      }
    })()
    return () => {
      alive = false
    }
    // the mission key and the site order describe every input
  }, [mission, sites.map((s) => s.id).join(',')])

  // Never another mission's values under this mission's dates (UX-03).
  return state.mission === mission ? state.entries : initial()
}
