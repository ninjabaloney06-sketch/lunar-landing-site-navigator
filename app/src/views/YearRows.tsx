// The Dates tab's year timeline: light or station contact over a calendar year (2026–2030, data from Nov 2026), a
// month axis and one bar row per place, bars = sunlit or in-contact spans, the share of the covered days at the
// row's end. Rows (yearStack.ts): the current mission's site, every saved mission's site, every point of "Your
// points" that can be a landing site; the remaining prepared sites sit behind a fold and are computed only once it
// is opened. Only the spans of a year are kept (yearBars.ts), one site computed per task.
import { useMemo, useState } from 'react'
import type { Period, Site, Station } from '../data/types'
import type { MissionState } from '../missions'
import type { UserPoint } from '../state'
import { Fold } from './Fold'
import { fmtDate } from './format'
import { useFullData } from './advanced'
import { useYearBars, yearOf, yearSpan, YEARS } from './yearBars'
import type { YearEntry } from './yearBars'
import { buildYearRows } from './yearStack'
import type { StackRow } from './yearStack'

type Kind = 'light' | 'comms'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** What a year's bars are drawn against: the calendar year, and the part of it with data. */
function scale(year: number, kind: Kind) {
  const { yearStartMs, yearEndMs, startMs, endMs } = yearSpan(year)
  const span = yearEndMs - yearStartMs
  return {
    yearStartMs,
    yearEndMs,
    startMs,
    endMs,
    pct: (ms: number) => `${(100 * (Math.min(yearEndMs, Math.max(yearStartMs, ms)) - yearStartMs)) / span}%`,
    width: (a: number, b: number) => `${(100 * (Math.min(yearEndMs, b) - Math.max(yearStartMs, a))) / span}%`,
    what: kind === 'light' ? 'sunlit' : 'in line of sight of a selected station',
    // What the number at a row's end is a share of: the year, or its part with data (2026: from 1 Nov).
    of: startMs > yearStartMs ? `${fmtDate(startMs)} – 31 Dec ${year}` : String(year),
  }
}

function Axis({ year, kind }: { year: number; kind: Kind }) {
  const { pct } = scale(year, kind)
  return (
    <>
      <span />
      <div className="yt-axis" aria-hidden="true">
        {MONTHS.map((m, i) => (
          <span key={m} className="yt-month" style={{ left: pct(Date.UTC(year, i, 1)) }}>
            {m}
          </span>
        ))}
      </div>
      <span />
    </>
  )
}

interface RowProps {
  row: StackRow
  entry: YearEntry | undefined
  year: number
  kind: Kind
  tags: boolean // the line under the name that says what the place is
  onSelect?: (siteId: string) => void // a press on the name; absent on the current site's row
}

/** One place: its name, its bar over the year and the share at the end. */
function YearBarRow({ row, entry, year, kind, tags, onSelect }: RowProps) {
  const { yearStartMs, yearEndMs, startMs, endMs, pct, width, what, of } = scale(year, kind)
  const site = row.site
  const sub = [...(tags ? row.tags : []), ...(site?.group === 'custom' ? ['approximate'] : [])].join(', ')
  const name = (
    <div className="yt-id">
      {site && onSelect ? (
        <button type="button" className="yt-name" title={row.name} onClick={() => onSelect(site.id)}>
          {row.name}
        </button>
      ) : (
        <span className="yt-name" title={row.name}>
          {row.name}
        </span>
      )}
      {sub && (
        <span className="yt-sub" data-testid="year-row-sub" title={entry?.status === 'done' && entry.approx ? `${sub}. ${entry.approx}` : sub}>
          {sub}
        </span>
      )}
    </div>
  )
  if (!site)
    return (
      <div className="yt-row" data-testid="year-row" data-state="none">
        {name}
        <span className="yt-note">{row.reason}</span>
      </div>
    )
  const e = entry ?? { status: 'computing' }
  const spans = e.status === 'done' ? (kind === 'light' ? e.lit : e.covered) : []
  const share = e.status === 'done' && endMs > startMs ? (100 * spans.reduce((t, [a, b]) => t + (b - a), 0)) / (endMs - startMs) : null
  const label =
    e.status === 'done' ? `${row.name}: ${what} ${share!.toFixed(1)} % of ${of}` : e.status === 'none' ? `${row.name}: ${e.reason}` : `${row.name}: computing`
  return (
    <div className="yt-row" data-testid="year-row" data-site-id={site.id} data-state={e.status}>
      {name}
      <div className={`yt-bar is-${kind}`} role="img" aria-label={label}>
        {startMs > yearStartMs && <span className="yt-nodata" style={{ left: 0, width: width(yearStartMs, startMs) }} />}
        {spans.map(([a, b]) => (
          <span key={a} className="yt-seg" data-testid="year-seg" style={{ left: pct(a), width: width(a, b) }} />
        ))}
        {row.missions
          .filter((m) => m.endMs > yearStartMs && m.startMs < yearEndMs)
          .map((m) => (
            <span key={`${m.name}|${m.startMs}`} className="yt-mission" title={m.name} style={{ left: pct(m.startMs), width: width(m.startMs, m.endMs) }} />
          ))}
      </div>
      <span className="yt-val mono" title={share !== null ? `${what} ${share.toFixed(1)} % of ${of}` : undefined}>
        {share !== null ? `${share.toFixed(1)} %` : e.status === 'none' ? 'no data' : '…'}
      </span>
    </div>
  )
}

interface Props {
  site: Site
  period: { startMs: number; endMs: number }
  missions: MissionState[]
  sites: Site[]
  periods: Period[]
  points: UserPoint[]
  stations: Station[]
  ids: string[]
  onSelect(siteId: string): void // a row's name: that site, still at the Dates tab
}

const sitesOf = (rows: StackRow[]): Site[] => rows.flatMap((r) => (r.site ? [r.site] : []))

export function YearRows({ site, period, missions, sites, periods, points, stations, ids, onSelect }: Props) {
  const [kind, setKind] = useState<Kind>('light')
  const [year, setYear] = useState(() => yearOf(period.startMs))
  const [full] = useFullData()
  const [opened, setOpened] = useState(false)
  const open = opened || full // Full data opens every fold
  const { rows, rest } = useMemo(
    () => buildYearRows({ site, period: { startMs: period.startMs, endMs: period.endMs }, missions, sites, periods, points }),
    [site, period.startMs, period.endMs, missions, sites, periods, points],
  )
  const restRows: StackRow[] = useMemo(() => rest.map((s) => ({ key: s.id, site: s, name: s.name, tags: [], missions: [] })), [rest])
  const entries = useYearBars(sitesOf(rows), stations, ids, year)
  // The remaining sites: nothing is computed for them until the fold is opened.
  const restEntries = useYearBars(open ? rest : [], stations, ids, year)
  const { yearStartMs, yearEndMs, what, of } = scale(year, kind)
  const outlined = rows.some((r) => r.missions.some((m) => m.endMs > yearStartMs && m.startMs < yearEndMs))
  const tags = rows.length > 1

  return (
    <>
      <section className="drawer-sec" aria-labelledby="sec-year">
        <h3 id="sec-year">Year timeline</h3>
        <div className="yt" data-testid="year-timeline">
          <div className="yt-controls">
            <select className="field" aria-label="Show" data-testid="year-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              <option value="light">Sunlight</option>
              <option value="comms">Station contact</option>
            </select>
            <select className="field mono" aria-label="Year" data-testid="year-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <p className="yt-legend" data-testid="year-legend">
            <span className="yt-key">
              <i className={`yt-swatch is-${kind}`} aria-hidden="true" />
              bar: {what}
            </span>
            <span className="yt-key">number: share of {of} {kind === 'light' ? 'sunlit' : 'in contact'}</span>
            {outlined && (
              <span className="yt-key">
                <i className="yt-swatch is-mission" aria-hidden="true" />
                outline: mission dates
              </span>
            )}
          </p>
          <div className="yt-grid">
            <Axis year={year} kind={kind} />
            {rows.map((r) => (
              <YearBarRow key={r.key} row={r} entry={r.site ? entries[r.site.id] : undefined} year={year} kind={kind} tags={tags} onSelect={r.site?.id === site.id ? undefined : onSelect} />
            ))}
          </div>
        </div>
      </section>
      {rest.length > 0 && (
        <Fold id="sec-year-all" title="All prepared sites" testId="year-all" onToggle={setOpened}>
          {open && (
            <div className="yt-grid" data-testid="year-all-rows">
              <Axis year={year} kind={kind} />
              {restRows.map((r) => (
                <YearBarRow key={r.key} row={r} entry={restEntries[r.key]} year={year} kind={kind} tags={false} onSelect={onSelect} />
              ))}
            </div>
          )}
        </Fold>
      )}
    </>
  )
}
