// Comparison table for all sites (notebook notes 2, 7, 13, 15): every site in sites.json once, with the light
// values, the comms values or both, for the mission's dates or for a whole year from its first day. "Find better
// location" puts the rows in geometry/rankSites order for the mission's science goal; "Find better dates" on a
// row opens the finder for that site. Saved missions follow as rows with their own site, dates and stations.
// Checked rows show their sunlit windows on one time axis.
//
// Every value is summarize() or windows() on a computeSeries() series (data/results.computeRow). A site
// without a horizon file, or dates without ephemeris, shows "no data"; nothing is estimated.
import { useEffect, useMemo, useState } from 'react'
import { computeRow, NoDataError } from '../data/results'
import type { RowResult } from '../data/results'
import type { Period, Site, Station } from '../data/types'
import { NOT_VALIDATED, VALIDATED } from '../data/validation'
import { rankSites } from '../geometry'
import type { RankedSite, ScienceGoal, Summary, Window } from '../geometry'
import { missionKey } from '../missions'
import type { MissionState } from '../missions'
import { COVERAGE_END_MS, DAY_MS, DEFAULT_MISSION_NAME, DEFAULT_SITE_ID } from '../state'
import type { ViewPeriod } from './Drawer'
import { GOALS } from './MissionPanel'
import { capital, fmtDate, fmtDeg, fmtHours, fmtPct, fmtRange } from './format'
import { flightSummary } from './flightSummary'
import { resolvePeriod } from './period'
import { useSiteRows } from './useSiteRows'
import { customHorizon, customSiteBase } from '../data/customSite'
import type { CapHorizon } from '../data/southcap'
import { approxText } from './custom'
import type { RowEntry } from './useSiteRows'

const YEAR_DAYS = 365

type Columns = 'both' | 'light' | 'comms'
type Span = 'mission' | 'year'

const COLUMNS: { id: Columns; label: string }[] = [
  { id: 'both', label: 'Both' },
  { id: 'light', label: 'Light' },
  { id: 'comms', label: 'Comms' },
]

const VALUES: Record<Columns, { key: string; head: string; get: (s: Summary) => string }[]> = {
  both: [
    { key: 'lit', head: 'Sunlit', get: (s) => fmtPct(s.litPct) },
    { key: 'comms', head: 'Station coverage', get: (s) => fmtPct(s.coveragePct) },
  ],
  light: [
    { key: 'lit', head: 'Sunlit', get: (s) => fmtPct(s.litPct) },
    { key: 'dark', head: 'Longest darkness', get: (s) => fmtHours(s.longestDarkH) },
  ],
  comms: [
    { key: 'comms', head: 'Station coverage', get: (s) => fmtPct(s.coveragePct) },
    { key: 'gap', head: 'Longest coverage gap', get: (s) => fmtHours(s.longestGapH) },
  ],
}

interface Props {
  sites: Site[]
  periods: Period[]
  stations: Station[]
  ids: string[]
  site: Site // the mission's landing site: computed first, its graph shown from the start
  period: ViewPeriod
  goal: ScienceGoal
  missions: MissionState[]
  wholeYear: boolean // offered only when it was measured to be fast enough (see WHOLE_YEAR in Drawer.tsx)
  onFindDates(siteId: string): void
  onCalculateFlight(m: MissionState): void // "Calculate flight" on a saved mission: the Flight plan with its values
}

/** A whole year from the mission's first day; moved back when it would pass the last supported date. */
function yearSpan(startMs: number): { startMs: number; endMs: number } {
  const a = Math.min(startMs, COVERAGE_END_MS - YEAR_DAYS * DAY_MS)
  return { startMs: a, endMs: a + YEAR_DAYS * DAY_MS }
}

function Cell({ entry, get }: { entry: RowEntry | undefined; get: (s: Summary) => string }) {
  if (!entry || entry.status === 'computing') return <span className="quiet">…</span>
  if (entry.status === 'none') return <span className="quiet">no data</span>
  return <>{get(entry.summary)}</>
}

export function SiteTable(p: Props) {
  const { sites, stations, ids, site, period, goal } = p
  const [columns, setColumns] = useState<Columns>('both')
  const [span, setSpan] = useState<Span>('mission')
  const [ranked, setRanked] = useState(false)
  const [graphed, setGraphed] = useState<string[]>([site.id])

  const year = p.wholeYear && span === 'year'
  const dates = year ? yearSpan(period.startMs) : { startMs: period.startMs, endMs: period.endMs }
  // Current site first, then sites.json order: the row a user is looking at fills in first.
  const computeOrder = useMemo(() => [site, ...sites.filter((s) => s.id !== site.id)], [sites, site])
  // A year's series is 17 520 samples per site: read its results and let it go, never keep 18 of them.
  const rows = useSiteRows(computeOrder, stations, ids, dates.startMs, dates.endMs, !year)
  const computing = sites.filter((s) => rows[s.id]?.status === 'computing').length

  const ranking = useMemo(
    () => rankSites(sites.map((s) => ({ site: s, summary: rows[s.id]?.status === 'done' ? (rows[s.id] as { summary: Summary }).summary : null })), goal),
    [sites, rows, goal],
  )
  const rankOf = new Map<string, RankedSite>([...ranking.ranked, ...ranking.failed, ...ranking.unknown].map((r) => [r.siteId, r]))
  const byId = new Map(sites.map((s) => [s.id, s]))
  const useRank = ranked && computing === 0
  const order = useRank ? [...ranking.ranked, ...ranking.failed, ...ranking.unknown].map((r) => byId.get(r.siteId)!) : sites
  const goalRule = (GOALS.find((g) => g.id === goal) ?? GOALS[0]).rule
  const values = VALUES[columns]

  return (
    <div className="site-table" data-testid="site-table" data-span={year ? 'year' : 'mission'} data-ranked={useRank ? 'true' : 'false'}>
      <p className="quiet">
        {year ? `${YEAR_DAYS} days from the mission's first day` : 'Mission dates'}: {fmtRange(dates.startMs, dates.endMs)}, UTC.{' '}
        {ids.length} of {stations.length} stations selected.{!VALIDATED && ` ${capital(NOT_VALIDATED)}.`}
      </p>
      <div className="st-controls">
        <fieldset className="st-pick">
          <legend className="quiet">Columns</legend>
          {COLUMNS.map((c) => (
            <label key={c.id} className="check">
              <input type="radio" name="st-columns" value={c.id} checked={columns === c.id} onChange={() => setColumns(c.id)} />
              <span>{c.label}</span>
            </label>
          ))}
        </fieldset>
        {p.wholeYear && (
          <fieldset className="st-pick">
            <legend className="quiet">Dates</legend>
            <label className="check">
              <input type="radio" name="st-span" value="mission" checked={span === 'mission'} onChange={() => setSpan('mission')} />
              <span>Mission dates</span>
            </label>
            <label className="check">
              <input type="radio" name="st-span" value="year" checked={span === 'year'} onChange={() => setSpan('year')} />
              <span>Whole year</span>
            </label>
          </fieldset>
        )}
        <button className="btn" type="button" aria-pressed={ranked} disabled={computing > 0} onClick={() => setRanked((r) => !r)}>
          Find better location
        </button>
      </div>
      <p className="quiet st-progress" aria-live="polite">
        {computing > 0
          ? `Computing ${sites.length - computing} of ${sites.length} sites for these dates…`
          : useRank
            ? `Best among the ${sites.length} evaluated sites for these dates first, by ${goalRule}. Sites above the 5° slope limit and sites without data follow, unranked.`
            : ''}
      </p>
      <table className="tbl st-tbl">
        <thead>
          <tr>
            <th scope="col">Site</th>
            {values.map((v) => (
              <th key={v.key} scope="col" className="st-num">
                {v.head}
              </th>
            ))}
            <th scope="col" className="st-graph">
              Graph
            </th>
          </tr>
        </thead>
        <tbody data-testid="site-rows">
          {order.map((s) => {
            const r = rankOf.get(s.id)
            return (
              <tr key={s.id} data-site-id={s.id} data-rank={useRank ? (r?.rank ?? '') : ''} className={s.id === site.id ? 'is-current' : undefined}>
                <th scope="row">
                  {useRank && r?.rank != null && <span className="st-rank mono">{r.rank} </span>}
                  <span className="st-name">{s.name}</span>
                  {useRank && r?.slope === 'fail' && r.slopeDeg !== null && <span className="th-sub">slope {fmtDeg(r.slopeDeg)} — too steep</span>}
                  {useRank && r?.slope === 'unknown' && <span className="th-sub">slope unknown</span>}
                  <button type="button" className="link st-find" onClick={() => p.onFindDates(s.id)}>
                    Find better dates
                  </button>
                </th>
                {values.map((v) => (
                  <td key={v.key} className="mono st-num" data-col={v.key}>
                    <Cell entry={rows[s.id]} get={v.get} />
                  </td>
                ))}
                <td className="st-graph">
                  <input
                    type="checkbox"
                    aria-label={`Sunlight graph for ${s.name}`}
                    checked={graphed.includes(s.id)}
                    onChange={(e) => setGraphed((g) => (e.target.checked ? [...g, s.id] : g.filter((x) => x !== s.id)))}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
        {p.missions.length > 0 && (
          <tbody data-testid="mission-rows">
            <tr>
              <th scope="colgroup" colSpan={values.length + 2} className="st-group">
                Saved missions, each for its own site, dates and stations
              </th>
            </tr>
            {p.missions.map((m) => (
              <MissionRow
                key={missionKey(m)}
                mission={m}
                sites={sites}
                periods={p.periods}
                stations={stations}
                values={values}
                onCalculateFlight={() => p.onCalculateFlight(m)}
              />
            ))}
          </tbody>
        )}
      </table>
      <SunGraphs
        rows={sites.filter((s) => graphed.includes(s.id)).map((s) => ({ id: s.id, name: s.name, entry: rows[s.id] }))}
        startMs={dates.startMs}
        endMs={dates.endMs}
      />
    </div>
  )
}

/** A saved mission as a row: summarize() for its own landing site, dates and stations. A custom landing site
 *  (data/customSite.ts) is rebuilt from its id and says that its values are approximate. */
function MissionRow(p: {
  mission: MissionState
  sites: Site[]
  periods: Period[]
  stations: Station[]
  values: (typeof VALUES)[Columns]
  onCalculateFlight(): void
}) {
  const { mission: m, sites, stations } = p
  // null = the default site, as in a link (App resolves it the same way)
  const site = sites.find((s) => s.id === (m.site ?? DEFAULT_SITE_ID)) ?? (m.site ? customSiteBase(m.site) : null)
  const period = resolvePeriod(m, p.periods)
  const known = stations.map((s) => s.id)
  const chosen = m.st ? known.filter((id) => m.st!.includes(id)) : known
  const ids = chosen.length ? chosen : known
  const key = `${site?.id}|${period.startMs}|${period.endMs}|${ids.join(',')}`
  const [state, setState] = useState<{ key: string; entry: RowEntry; approx?: string }>({ key, entry: { status: 'computing' } })
  useEffect(() => {
    let alive = true
    if (!site) {
      setState({ key, entry: { status: 'none', reason: 'no data in this build' } })
      return
    }
    setState({ key, entry: { status: 'computing' } })
    Promise.all([computeRow({ site, stations, ids, startMs: period.startMs, endMs: period.endMs }), site.group === 'custom' ? customHorizon(site.id) : null]).then(
      ([r, h]: [RowResult, CapHorizon | null]) => alive && setState({ key, entry: { status: 'done', ...r }, approx: h ? approxText(h.computed) : undefined }),
      (e: Error) => alive && setState({ key, entry: { status: 'none', reason: e instanceof NoDataError ? 'no data in this build' : 'could not load' } }),
    )
    return () => {
      alive = false
    }
    // key describes every input
  }, [key])
  const entry: RowEntry = state.key === key ? state.entry : { status: 'computing' }
  return (
    <tr data-mission={missionKey(m)}>
      <th scope="row">
        <span className="st-name">{m.name ?? DEFAULT_MISSION_NAME}</span>
        <span className="th-sub">
          {site ? site.name : 'unknown site'} · {period.label}
        </span>
        {state.key === key && state.approx && <span className="th-sub">{state.approx}</span>}
        <span className="th-sub" data-testid="mission-flight">
          {flightSummary(m)}
        </span>
        <button type="button" className="btn st-flight" data-testid="calculate-flight" disabled={!site} onClick={p.onCalculateFlight}>
          Calculate flight
        </button>
      </th>
      {p.values.map((v) => (
        <td key={v.key} className="mono st-num" data-col={v.key}>
          <Cell entry={entry} get={v.get} />
        </td>
      ))}
      <td />
    </tr>
  )
}

/** Sunlit windows of the checked rows, one track each on the same time axis (yellow = sunlit, as on the timeline). */
function SunGraphs({ rows, startMs, endMs }: { rows: { id: string; name: string; entry: RowEntry | undefined }[]; startMs: number; endMs: number }) {
  if (rows.length === 0) return null
  const span = endMs - startMs
  const seg = (w: Window) => ({ left: `${(100 * (w.startMs - startMs)) / span}%`, width: `${(100 * (w.endMs - w.startMs)) / span}%` })
  return (
    <figure className="st-graphs" data-testid="sun-graphs">
      <figcaption className="quiet">Sunlight, {fmtRange(startMs, endMs)}. Yellow = sunlit.</figcaption>
      {rows.map((r) => (
        <div key={r.id} className="st-graph-row" data-site-id={r.id}>
          <span className="st-graph-name">{r.name}</span>
          <div className="tl-track" data-ready={r.entry?.status === 'done' ? 'true' : 'false'}>
            {r.entry?.status === 'done' &&
              r.entry.sun.filter((w) => w.state === 'lit').map((w) => <span key={w.startMs} className="seg seg-lit" style={seg(w)} />)}
          </div>
          {r.entry?.status === 'none' && <span className="quiet">no data</span>}
        </div>
      ))}
      <div className="st-axis mono quiet" aria-hidden="true">
        <span>{fmtDate(startMs)}</span>
        <span>{fmtDate(endMs - DAY_MS)}</span>
      </div>
    </figure>
  )
}
