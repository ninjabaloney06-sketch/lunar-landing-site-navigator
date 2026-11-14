// Rows of the comparison table: summarize() and the sunlit windows for every site over one span of dates,
// through data/results.computeRow. Sites are computed one after another, each in its own task, so the screen
// stays usable and the progress line can count; finished rows are kept for the session.
import { useEffect, useState } from 'react'
import { computeRow, NoDataError } from '../data/results'
import type { Site, Station } from '../data/types'
import type { Summary, Window } from '../geometry'

export type RowEntry =
  | { status: 'computing' }
  | { status: 'done'; summary: Summary; sun: Window[] }
  | { status: 'none'; reason: string } // no ephemeris or horizon in this build, or the load failed

const done = new Map<string, RowEntry>()
const COMPUTING: RowEntry = { status: 'computing' }

export function useSiteRows(
  sites: Site[], // in compute order
  stations: Station[],
  ids: string[],
  startMs: number,
  endMs: number,
  keepSeries: boolean, // false for a whole year: the series is read and released
): Record<string, RowEntry> {
  const span = `${startMs}|${endMs}|${ids.join(',')}`
  const initial = (): Record<string, RowEntry> => Object.fromEntries(sites.map((s) => [s.id, done.get(`${s.id}|${span}`) ?? COMPUTING]))
  const [state, setState] = useState<{ span: string; rows: Record<string, RowEntry> }>(() => ({ span, rows: initial() }))

  useEffect(() => {
    let alive = true
    setState({ span, rows: initial() })
    ;(async () => {
      for (const site of sites) {
        const k = `${site.id}|${span}`
        if (done.has(k)) continue
        await new Promise((r) => setTimeout(r, 0)) // one site per task: input and paint stay responsive
        if (!alive) return
        let entry: RowEntry
        try {
          entry = { status: 'done', ...(await computeRow({ site, stations, ids, startMs, endMs }, keepSeries)) }
          done.set(k, entry)
        } catch (e) {
          const missing = e instanceof NoDataError
          entry = { status: 'none', reason: missing ? 'no data in this build' : 'could not load' }
          if (missing) done.set(k, entry) // a failed load is retried next time
        }
        if (!alive) return
        setState((s) => (s.span === span ? { span, rows: { ...s.rows, [site.id]: entry } } : s))
      }
    })()
    return () => {
      alive = false
    }
    // the span key and the site order describe every input
  }, [span, sites.map((s) => s.id).join(','), keepSeries])

  // Never another span's values under these dates (UX-03).
  return state.span === span ? state.rows : initial()
}
