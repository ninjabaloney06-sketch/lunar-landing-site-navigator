// Basic comparison (spec: may not be cut). The current view next to one other site or named period, same
// stations, same scales; "Switch" makes the compared choice the main view, so context and results change
// together. A third column names the better side per row in words (higher sunlit and coverage, lower unknown share
// and shorter dark spells and gaps are better); it is a direction, not a threshold, so no colour.
import { useState } from 'react'
import type { Summary } from '../geometry'
import { useResults } from '../data/results'
import type { ResultsState } from '../data/results'
import type { Period, Site, Station } from '../data/types'
import { NOT_VALIDATED, VALIDATED } from '../data/validation'
import { capital, fmtPct, fmtRange, fmtSpanH } from './format'

interface Props {
  site: Site
  periodId: string
  periodLabel: string
  sites: Site[]
  periods: Period[]
  stations: Station[]
  ids: string[]
  current: ResultsState
  onSwitch(siteId: string, periodId: string): void
}

// Row labels start with the value's name (the tests find rows by it); the unit follows.
const ROWS: { label: string; get: (s: Summary) => string; v: (s: Summary) => number; higher: boolean; hint: string }[] = [
  { label: 'Sunlit, % of time', get: (s) => fmtPct(s.litPct), v: (s) => s.litPct, higher: true, hint: 'Share of the dates with the Sun above the terrain horizon.' },
  { label: 'Station coverage, % of time', get: (s) => fmtPct(s.coveragePct), v: (s) => s.coveragePct, higher: true, hint: 'Share of the dates with line of sight to at least one selected station.' },
  { label: 'Unknown, % of time', get: (s) => fmtPct(s.unknownPct), v: (s) => s.unknownPct, higher: false, hint: 'Share of the dates where an input is missing.' },
  { label: 'Longest darkness', get: (s) => fmtSpanH(s.longestDarkH), v: (s) => s.longestDarkH, higher: false, hint: 'Longest stretch without sunlight in these dates.' },
  { label: 'Longest coverage gap', get: (s) => fmtSpanH(s.longestGapH), v: (s) => s.longestGapH, higher: false, hint: 'Longest stretch without any selected station in view.' },
]

function cell(st: ResultsState, get: (s: Summary) => string) {
  if (st.status === 'loading') return <span className="quiet">…</span>
  if (st.status === 'error') return <span className="is-error">could not compute</span>
  if (st.status === 'empty') return <span className="quiet">no data</span>
  return get(st.results.summary)
}

/** The better side of one row in words, or '' while either side is not ready. Equal at the shown rounding = equal. */
function better(a: ResultsState, b: ResultsState, r: (typeof ROWS)[number], names: [string, string]): string {
  if (a.status !== 'ready' || b.status !== 'ready') return ''
  const x = r.v(a.results.summary)
  const y = r.v(b.results.summary)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return ''
  if (r.get(a.results.summary) === r.get(b.results.summary)) return 'equal'
  return (r.higher ? x > y : x < y) ? names[0] : names[1]
}

export function Compare({ site, periodId, periodLabel, sites, periods, stations, ids, current, onSwitch }: Props) {
  const [otherSite, setOtherSite] = useState(site.id)
  // Default: the next named period (Shackleton Aug 2027 → Sep 2027, the required same-site comparison).
  const [otherPeriod, setOtherPeriod] = useState(() => {
    const i = periods.findIndex((p) => p.id === periodId)
    return periods.length ? periods[(i + 1) % periods.length].id : periodId
  })
  const os = sites.find((s) => s.id === otherSite) ?? site
  const op = periods.find((p) => p.id === otherPeriod) ?? periods[0]
  const other = useResults(op ? { site: os, stations, ids, startMs: Date.parse(op.start_utc), endMs: Date.parse(op.end_utc) } : null)
  const otherRange = op ? fmtRange(Date.parse(op.start_utc), Date.parse(op.end_utc)) : ''

  const sameSite = os.id === site.id
  const samePeriod = !op || op.id === periodId
  // What is compared, and the name each side goes by in the "Better" column.
  const what = sameSite && samePeriod ? 'same' : sameSite ? 'periods' : samePeriod ? 'sites' : 'both'
  const names: [string, string] =
    what === 'periods' ? [periodLabel, otherRange] : what === 'sites' ? [site.name, os.name] : ['Current', 'Compared']

  return (
    <div className="compare" data-compare={what}>
      <div className="compare-pick">
        <label>
          <span className="quiet">Compare with site</span>
          <select className="field" value={otherSite} onChange={(e) => setOtherSite(e.target.value)}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="quiet">and dates</span>
          <select className="field" value={otherPeriod} onChange={(e) => setOtherPeriod(e.target.value)}>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="quiet compare-what" data-testid="compare-what">
        {what === 'same'
          ? 'Both columns show the same site and dates; choose another site or dates.'
          : what === 'periods'
            ? `Two periods at ${site.name}, same stations.`
            : what === 'sites'
              ? `Two sites over the same dates, same stations.`
              : 'Two sites over two periods, same stations.'}
        {!VALIDATED && ` ${capital(NOT_VALIDATED)}.`}
      </p>
      <table className="tbl compare-tbl" data-testid="compare-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Value</span>
            </th>
            <th scope="col">
              {what === 'both' && <span className="th-sub">Current</span>}
              {site.name}
              <span className="th-sub">{periodLabel}</span>
            </th>
            <th scope="col">
              {what === 'both' && <span className="th-sub">Compared</span>}
              {os.name}
              <span className="th-sub">{otherRange}</span>
            </th>
            <th scope="col">Better</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.label}>
              <th scope="row" title={r.hint}>
                {r.label}
              </th>
              <td className="mono">{cell(current, r.get)}</td>
              <td className="mono">{cell(other, r.get)}</td>
              <td className="compare-better" data-testid="compare-better">
                {better(current, other, r, names)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="quiet compare-note">Better: higher sunlit and coverage; lower unknown share, shorter darkness and gaps.</p>
      <button className="btn" type="button" disabled={!op || what === 'same'} onClick={() => op && onSwitch(os.id, op.id)}>
        Switch to {os.name}, {otherRange}
      </button>
    </div>
  )
}
