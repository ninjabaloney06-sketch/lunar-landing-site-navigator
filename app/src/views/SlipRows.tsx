// "If the mission slips" (TASKS.md, slip rows on the finder result): the mission's summary again for a start 1, 7
// and 30 days later (same length) and at the nearest other prepared site on the same dates. Every number is
// computeRow (data/results.ts) on the same site, stations and span rules as the answer; nothing is computed until
// the section is opened (a row costs up to about 198 ms, Drawer.tsx WHOLE_YEAR).
import { useEffect, useMemo, useState } from 'react'
import type { Summary } from '../geometry'
import { computeRow, NoDataError } from '../data/results'
import type { Site, Station } from '../data/types'
import { NOT_VALIDATED, VALIDATED } from '../data/validation'
import { COVERAGE_END_MS, COVERAGE_START_MS } from '../state'
import type { ViewPeriod } from './Drawer'
import { Fold } from './Fold'
import { useFullData } from './advanced'
import { capital, fmtDate, fmtPct, fmtSpanH } from './format'
import { spanLabel } from './period'
import { fmtPointsDelta, nearestSite, slipPeriods, wholeDays } from './slip'

interface Props {
  site: Site
  sites: Site[]
  stations: Station[]
  ids: string[]
  period: ViewPeriod
  onShow(startMs: number, days: number, landingMs: number): void // the Finder's "Show": opens that period
  onSite(siteId: string): void // the site table's site choice: that site, same dates
}

interface Row {
  key: string
  label: string
  sub?: string
  site: Site
  startMs: number
  endMs: number
  inRange: boolean
  action?: { label: string; aria: string } // Show (a slip row) or Switch site (the nearest site)
}

type Cell = { status: 'ready'; summary: Summary } | { status: 'message'; text: string }

const OUTSIDE = `Outside the supported dates (${fmtDate(COVERAGE_START_MS)} to ${fmtDate(COVERAGE_END_MS - 1)})`

export function SlipRows({ site, sites, stations, ids, period, onShow, onSite }: Props) {
  const [full] = useFullData()
  const [opened, setOpened] = useState(false) // stays true once opened: closing the fold keeps the rows
  const active = opened || full
  const inputKey = `${site.id}|${ids.join(',')}|${period.startMs}|${period.endMs}`

  const rows = useMemo<Row[]>(() => {
    const { startMs, endMs } = period
    const out: Row[] = [{ key: 'now', label: 'Current mission', site, startMs, endMs, inRange: true }]
    for (const s of slipPeriods(startMs, endMs)) {
      const label = `${s.days} ${s.days === 1 ? 'day' : 'days'} later`
      out.push({
        key: `slip-${s.days}`,
        label,
        site,
        startMs: s.startMs,
        endMs: s.endMs,
        inRange: s.inRange,
        action: s.inRange ? { label: 'Show', aria: `Show the mission ${label}` } : undefined,
      })
    }
    const near = nearestSite(site, sites)
    if (near)
      out.push({
        key: 'nearest',
        label: near.site.name,
        sub: `Nearest other site, ${near.km.toFixed(0)} km away`,
        site: near.site,
        startMs,
        endMs,
        inRange: true,
        action: { label: 'Switch site', aria: `Switch to ${near.site.name}, same dates` },
      })
    return out
    // the rows are fully described by inputKey and the site list
  }, [inputKey, sites])

  // Results per input; a stale input's cells are never read (their key differs).
  const [cells, setCells] = useState<Record<string, Cell>>({})
  useEffect(() => {
    if (!active) return
    let alive = true
    for (const r of rows) {
      const k = `${inputKey}|${r.key}`
      if (!r.inRange || cells[k]) continue
      // the mission's own span keeps its series (shared with the answer); the others let theirs go
      computeRow({ site: r.site, stations, ids, startMs: r.startMs, endMs: r.endMs }, r.key === 'now').then(
        (res) => alive && setCells((c) => ({ ...c, [k]: { status: 'ready', summary: res.summary } })),
        (e: Error) =>
          alive &&
          setCells((c) => ({ ...c, [k]: { status: 'message', text: e instanceof NoDataError ? e.message : `Could not compute: ${e.message}` } })),
      )
    }
    return () => {
      alive = false
    }
  }, [active, rows])

  const cellOf = (r: Row) => cells[`${inputKey}|${r.key}`]
  const base = cellOf(rows[0])
  const baseSummary = base?.status === 'ready' ? base.summary : null
  const n = ids.length
  // at click time, so the handlers are always the current ones; a slip row opens exactly the span it scored
  const run = (r: Row) =>
    r.key === 'nearest' ? onSite(r.site.id) : onShow(r.startMs, wholeDays(r.startMs, r.endMs), r.startMs)

  return (
    <Fold
      id="sec-slip"
      title="If the mission slips"
      testId="fold-slip"
      summary="The same mission 1, 7 and 30 days later, and at the nearest site"
      onToggle={(open) => open && setOpened(true)}
    >
      {active && (
        <>
          <p className="quiet sec-lead">
            Each row keeps the mission length and the {n} selected {n === 1 ? 'station' : 'stations'}. Under each share: the change against
            the current mission, in percentage points.
          </p>
          <div className="assess-scroll">
            <table className="tbl compare-tbl" data-testid="slip-table">
              <thead>
                <tr>
                  <th scope="col">Mission</th>
                  <th scope="col">
                    Period (<abbr title="Coordinated Universal Time">UTC</abbr>)
                  </th>
                  <th scope="col">Sunlit</th>
                  <th scope="col">Station contact</th>
                  <th scope="col">Longest darkness</th>
                  <th scope="col">Longest contact gap</th>
                  <th scope="col">
                    <span className="sr-only">Show</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const c = cellOf(r)
                  const delta = (v: number, b: number) => r.key !== 'now' && <span className="th-sub">{fmtPointsDelta(v, b)}</span>
                  return (
                    <tr key={r.key} data-testid={`slip-row-${r.key}`}>
                      <th scope="row">
                        {r.label}
                        {r.sub && <span className="th-sub">{r.sub}</span>}
                      </th>
                      <td>{spanLabel(r.startMs, r.endMs)}</td>
                      {!r.inRange ? (
                        <td colSpan={4} data-testid="slip-outside">
                          {OUTSIDE}
                        </td>
                      ) : !c ? (
                        <td colSpan={4} className="quiet" role="status">
                          Computing…
                        </td>
                      ) : c.status === 'message' ? (
                        <td colSpan={4}>{c.text}</td>
                      ) : (
                        <>
                          <td className="mono" data-testid="slip-lit">
                            {fmtPct(c.summary.litPct)}
                            {baseSummary && delta(c.summary.litPct, baseSummary.litPct)}
                          </td>
                          <td className="mono" data-testid="slip-contact">
                            {fmtPct(c.summary.coveragePct)}
                            {baseSummary && delta(c.summary.coveragePct, baseSummary.coveragePct)}
                          </td>
                          <td className="mono">{fmtSpanH(c.summary.longestDarkH)}</td>
                          <td className="mono">{fmtSpanH(c.summary.longestGapH)}</td>
                        </>
                      )}
                      <td>
                        {r.action && (
                          <button className="link" type="button" aria-label={r.action.aria} onClick={() => run(r)}>
                            {r.action.label}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!VALIDATED && <p className="quiet">{capital(NOT_VALIDATED)}.</p>}
        </>
      )}
    </Fold>
  )
}
