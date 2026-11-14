// Basic comparison (spec: may not be cut). The current view next to one other site or named period, same
// stations, same scales; "Switch" makes the compared choice the main view, so context and results change
// together.
import { useState } from 'react'
import type { Summary } from '../geometry'
import { useResults } from '../data/results'
import type { ResultsState } from '../data/results'
import type { Period, Site, Station } from '../data/types'
import { fmtHours, fmtPct, fmtRange } from './format'

interface Props {
  site: Site
  periodId: string
  periodLabel: string
  sites: Site[]
  periods: Period[]
  stations: Station[]
  ids: string[]
  current: ResultsState
  sample: boolean
  onSwitch(siteId: string, periodId: string): void
}

const ROWS: { label: string; get: (s: Summary) => string }[] = [
  { label: 'Sunlit', get: (s) => fmtPct(s.litPct) },
  { label: 'Station coverage', get: (s) => fmtPct(s.coveragePct) },
  { label: 'Unknown', get: (s) => fmtPct(s.unknownPct) },
  { label: 'Longest darkness', get: (s) => fmtHours(s.longestDarkH) },
  { label: 'Longest coverage gap', get: (s) => fmtHours(s.longestGapH) },
]

function cell(st: ResultsState, get: (s: Summary) => string) {
  if (st.status === 'loading') return <span className="quiet">…</span>
  if (st.status === 'error') return <span className="is-error">error</span>
  return get(st.results.summary)
}

export function Compare({ site, periodId, periodLabel, sites, periods, stations, ids, current, sample, onSwitch }: Props) {
  const [otherSite, setOtherSite] = useState(site.id)
  const [otherPeriod, setOtherPeriod] = useState(() => periods.find((p) => p.id !== periodId)?.id ?? periodId)
  const os = sites.find((s) => s.id === otherSite) ?? site
  const op = periods.find((p) => p.id === otherPeriod) ?? periods[0]
  const other = useResults(op ? { site: os, stations, ids, startMs: Date.parse(op.start_utc), endMs: Date.parse(op.end_utc) } : null)

  return (
    <div className="compare">
      <div className="compare-pick">
        <label>
          <span className="sr-only">Compare with site</span>
          <select className="field" value={otherSite} onChange={(e) => setOtherSite(e.target.value)}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Compare with period</span>
          <select className="field" value={otherPeriod} onChange={(e) => setOtherPeriod(e.target.value)}>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <table className="tbl" data-testid="compare-table">
        <thead>
          <tr>
            <th scope="col">{sample ? 'Sample values' : ''}</th>
            <th scope="col">
              {site.name}
              <span className="th-sub">{periodLabel}</span>
            </th>
            <th scope="col">
              {os.name}
              <span className="th-sub">{op ? fmtRange(Date.parse(op.start_utc), Date.parse(op.end_utc)) : ''}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td className="mono">{cell(current, r.get)}</td>
              <td className="mono">{cell(other, r.get)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn" type="button" disabled={!op || (os.id === site.id && op.id === periodId)} onClick={() => op && onSwitch(os.id, op.id)}>
        Switch to {os.name}, {op ? fmtRange(Date.parse(op.start_utc), Date.parse(op.end_utc)) : ''}
      </button>
    </div>
  )
}
