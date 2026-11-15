// Mission panel (Step 2-UI; paper pages 2340–2342): the paper's field order — Name, Start, End, Science goal,
// Landing site, Ground stations, Play mission. The landing sites are ranked for this mission's own dates,
// stations and goal by geometry/rankSites; every row shows the values it was ranked by. Grown from the C2 site
// menu: its search, which also accepts typed coordinates. Typed coordinates can be added as a user point (Brief
// C4 part 3): a name, a place and a role, never numbers. A user point has no horizon file, and nothing is
// computed for it with a flat horizon or a neighbour's. Inside the pin region, typed coordinates and a user point
// can instead become the landing site ("Set as landing site": a custom site, data/customSite.ts), whose numbers
// are then computed like any site's.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Period, Site, Station } from '../data/types'
import { MAX_MISSIONS, missionKey } from '../missions'
import type { MissionState } from '../missions'
import { rankSites } from '../geometry'
import type { RankedSite, ScienceGoal, Summary } from '../geometry'
import { DAY_MS, DEFAULT_MISSION_NAME, DEFAULT_SITE_ID, inCoverage, MAX_DAYS, MAX_POINTS, NAME_MAX, pointName, RANGE_ERROR, COVERAGE_END_MS } from '../state'
import type { PointRole, UserPoint } from '../state'
import type { ViewPeriod } from './Drawer'
import { EXAMPLE, eg } from './examples'
import { fmtCoords, fmtDate, fmtDeg, fmtHours, fmtPct, parseCoords, parseDate } from './format'
import { flightSummary } from './flightSummary'
import { resolvePeriod } from './period'
import { SLOPE_BASELINE, slopeOf } from './slope'
import { StationChecklist } from './Stations'
import { useSummaries } from './useSummaries'
import { inPinRegion } from '../scene3d/region'
import { CUSTOM_SITE_NAME, parseCustomSiteId } from '../data/customSite'
import { SITE_REGION_TEXT } from './custom'
import type { SummaryEntry } from './useSummaries'

export const GOALS: { id: ScienceGoal; label: string; rule: string; short?: string }[] = [
  { id: 'any', label: 'Any', rule: 'station coverage, then sunlight' },
  {
    id: 'water-ice',
    label: 'Water ice and volatiles',
    rule: 'evidence for water ice, then station coverage, then sunlight',
    short: 'water ice',
  },
  {
    id: 'cold-trap',
    label: 'Cold traps (permanent shadow)',
    rule: 'evidence for cold traps, then station coverage, then sunlight',
    short: 'cold trap',
  },
  { id: 'light', label: 'Consistent light', rule: 'share of the mission in sunlight, then the shortest longest darkness, then station coverage' },
  {
    id: 'science',
    label: 'Science targets (geology and others)',
    rule: 'evidence for science targets, then station coverage, then sunlight',
    short: 'science',
  },
]

// Shown under an unlabelled site's name; a site's own label (e.g. "Blue Moon MK1 target") takes its place.
const GROUP_TEXT: Record<Site['group'], string> = {
  'artemis-2024': 'Artemis region, NASA 2024',
  'artemis-2022': 'Artemis region, NASA 2022',
  reference: 'Reference point',
  clps: 'Lander',
  commercial: 'Lander',
  international: 'Lander',
  apollo: 'Lander',
  poi: 'Point of interest',
  custom: 'Custom site',
}

interface Props {
  sites: Site[]
  stations: Station[]
  ids: string[]
  site: Site // the mission's landing site
  period: ViewPeriod
  name: string | null // null = the site's name
  goal: ScienceGoal
  points: UserPoint[]
  selectedPoint: number | null // highlighted here and on the scene
  focusStations: boolean // opened from the drawer's "Choose ground stations"
  onName(name: string): void
  onDates(startMs: number, days: number): void
  onGoal(goal: ScienceGoal): void
  onSelect(id: string): void
  onToggleStation(id: string): void
  onPlay(): void
  onClose(): void
  periods: Period[]
  missions: MissionState[] // saved in this browser
  missionSaved: boolean // the mission on screen is one of them
  onAddMission(): void
  onCalculateFlight(m: MissionState): void
  onLoadMission(m: MissionState): void
  onRemoveMission(key: string): void
  onAddPoint(lat: number, lon: number): void
  onSetSite(lat: number, lon: number): void // makes the place a custom landing site (inside the pin region only)
  onPointName(i: number, name: string): void
  onPointRole(i: number, role: PointRole | null): void
  onPointSelect(i: number | null): void
  onPointDelete(i: number): void
}

interface Row {
  site: Site
  r: RankedSite | null // null while a site that passes the slope limit is still computing
  entry: SummaryEntry
}

export function MissionPanel(p: Props) {
  const { sites, site, period, goal } = p
  const root = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const stationsRef = useRef<HTMLElement>(null)
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [startDraft, setStartDraft] = useState<string | null>(null)
  const [endDraft, setEndDraft] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [pointDraft, setPointDraft] = useState<{ i: number; text: string } | null>(null) // the name being typed
  const [activeId, setActiveId] = useState<string | null>(site.id) // keyboard row; null = first row (after typing)

  useEffect(() => {
    if (p.focusStations && stationsRef.current) {
      stationsRef.current.scrollIntoView({ block: 'start' })
      stationsRef.current.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
    } else closeBtn.current?.focus({ preventScroll: true })
    // on open only
  }, [])

  const { onClose } = p
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element
      if (root.current && !root.current.contains(t) && !t.closest?.('[data-menu-trigger]')) onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [onClose])

  // ---------- ranking: current site first, then the sites that pass the slope limit, then the rest ----------
  const slopes = useMemo(() => new Map(sites.map((s) => [s.id, slopeOf(s).state])), [sites])
  const order = useMemo(
    () => [site, ...sites.filter((s) => s.id !== site.id && slopes.get(s.id) === 'pass'), ...sites.filter((s) => s.id !== site.id && slopes.get(s.id) !== 'pass')],
    [sites, site, slopes],
  )
  const entries = useSummaries(order, p.stations, p.ids, period.startMs, period.endMs)
  const summaryOf = (e: SummaryEntry | undefined): Summary | null => (e?.status === 'done' ? e.summary : null)
  const isWaiting = (s: Site) => entries[s.id]?.status === 'computing' && slopes.get(s.id) === 'pass'
  const ranking = useMemo(
    () =>
      rankSites(
        sites.filter((s) => !isWaiting(s)).map((s) => ({ site: s, summary: summaryOf(entries[s.id]) })),
        goal,
      ),
    // isWaiting and summaryOf read only entries and slopes
    [sites, entries, goal, slopes],
  )
  const waiting = sites.filter(isWaiting)
  const computing = sites.filter((s) => entries[s.id]?.status === 'computing').length
  const byId = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites])
  const goalRow = GOALS.find((g) => g.id === goal) ?? GOALS[0]

  // The goal's own rule value; rows that share it with another ranked row are ordered by coverage next.
  const ruleValue = (r: RankedSite): string | null =>
    goal === 'any' ? null : goal === 'light' ? `${r.litPct}|${r.longestDarkH}` : (r.goalEvidence ?? 'none')
  const shared = new Map<string, number>()
  for (const r of ranking.ranked) {
    const v = ruleValue(r)
    if (v !== null) shared.set(v, (shared.get(v) ?? 0) + 1)
  }

  const coords = parseCoords(query)
  const q = query.trim().toLowerCase()
  const match = (s: Site) => coords.kind !== 'none' || !q || `${s.name} ${s.label ?? ''}`.toLowerCase().includes(q)
  const toRow = (r: RankedSite): Row => ({ site: byId.get(r.siteId)!, r, entry: entries[r.siteId] })
  const groups = [
    {
      key: 'ranked',
      title: 'Passes the 5° slope limit',
      rows: [...ranking.ranked.map(toRow), ...waiting.map((s): Row => ({ site: s, r: null, entry: entries[s.id] }))],
    },
    { key: 'failed', title: 'Too steep to land (slope above 5°)', rows: ranking.failed.map(toRow) },
    { key: 'unknown', title: 'Not enough data', rows: ranking.unknown.map(toRow) },
  ]
    .map((g) => ({ ...g, rows: g.rows.filter((row) => match(row.site)) }))
    .filter((g) => g.rows.length > 0)
  const flat = groups.flatMap((g) => g.rows)
  // Tracked by site id: rows move while the ranking fills in.
  const activeIdx = Math.max(0, flat.findIndex((row) => row.site.id === activeId))
  const moveActive = (d: number) => {
    if (flat.length) setActiveId(flat[(activeIdx + d + flat.length) % flat.length].site.id)
  }

  const full = p.points.length >= MAX_POINTS
  const addTyped = () => {
    if (coords.kind !== 'ok' || full) return
    p.onAddPoint(coords.lat, coords.lon)
    setQuery('')
  }

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveActive(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveActive(-1)
    } else if (e.key === 'Enter' && coords.kind === 'none' && flat[activeIdx]) {
      e.preventDefault()
      p.onSelect(flat[activeIdx].site.id)
    } else if (e.key === 'Enter' && coords.kind === 'ok') {
      e.preventDefault()
      addTyped()
    }
  }

  // ---------- dates: Start keeps the mission length, End sets it ----------
  const lastDayMs = period.endMs - DAY_MS
  const days = Math.round((period.endMs - period.startMs) / DAY_MS)
  const commitStart = () => {
    if (startDraft === null) return
    const a = parseDate(startDraft)
    if (a === null) return setDateError('Start: enter a date such as 16 Aug 2027.')
    if (!inCoverage(a)) return setDateError(RANGE_ERROR)
    setDateError(null)
    setStartDraft(null)
    const n = Math.max(1, Math.min(days, Math.floor((COVERAGE_END_MS - a) / DAY_MS)))
    if (a !== period.startMs || n !== days) p.onDates(a, n)
  }
  const commitEnd = () => {
    if (endDraft === null) return
    const b = parseDate(endDraft)
    if (b === null) return setDateError('End: enter a date such as 29 Aug 2027.')
    if (!inCoverage(b)) return setDateError(RANGE_ERROR)
    if (b < period.startMs) return setDateError('End is before Start.')
    const n = Math.round((b - period.startMs) / DAY_MS) + 1
    if (n > MAX_DAYS) return setDateError(`A mission can last at most ${MAX_DAYS} days.`)
    setDateError(null)
    setEndDraft(null)
    if (n !== days) p.onDates(period.startMs, n)
  }
  const onEnter = (commit: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    }
  }

  return (
    <div
      ref={root}
      className="popover menu mission-panel"
      role="dialog"
      aria-labelledby="mission-title"
      data-testid="mission-panel"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="mp-head">
        <button ref={closeBtn} type="button" className="mp-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h2 id="mission-title" className="mp-title">
          Mission
        </h2>
      </div>

      <div className="mp-fields">
        <label className="mp-field">
          <span className="mp-label">Name</span>
          <input
            className="field"
            type="text"
            maxLength={NAME_MAX}
            placeholder={eg(EXAMPLE.name)}
            value={nameDraft ?? p.name ?? DEFAULT_MISSION_NAME}
            onChange={(e) => {
              setNameDraft(e.target.value)
              p.onName(e.target.value)
            }}
          />
        </label>
        <div className="mp-field mp-dates">
          <label className="mp-label" htmlFor="mp-start">
            Start
          </label>
          <input
            id="mp-start"
            className="field mono"
            type="text"
            aria-describedby="mp-dates-note"
            placeholder={eg(EXAMPLE.start)}
            value={startDraft ?? fmtDate(period.startMs)}
            onChange={(e) => setStartDraft(e.target.value)}
            onBlur={commitStart}
            onKeyDown={onEnter(commitStart)}
          />
          <label className="mp-label" htmlFor="mp-end">
            End
          </label>
          <input
            id="mp-end"
            className="field mono"
            type="text"
            aria-describedby="mp-dates-note"
            placeholder={eg(EXAMPLE.end)}
            value={endDraft ?? fmtDate(lastDayMs)}
            onChange={(e) => setEndDraft(e.target.value)}
            onBlur={commitEnd}
            onKeyDown={onEnter(commitEnd)}
          />
        </div>
        <p id="mp-dates-note" className="mp-note quiet">
          {days} {days === 1 ? 'day' : 'days'}, UTC, last day included. Changing Start keeps the length.
        </p>
        {dateError && (
          <p className="menu-msg is-error mp-error" role="alert">
            {dateError}
          </p>
        )}
        <div className="mp-save">
          <button type="button" className="btn" data-testid="add-mission" disabled={p.missionSaved || p.missions.length >= MAX_MISSIONS} onClick={p.onAddMission}>
            Add mission
          </button>
          <span className="quiet" aria-live="polite">
            {p.missionSaved
              ? 'Saved in this browser.'
              : p.missions.length >= MAX_MISSIONS
                ? `At most ${MAX_MISSIONS} saved missions.`
                : 'Keeps name, site, dates, stations, goal, launchpad, rocket and stay in this browser.'}
          </span>
        </div>
      </div>

      {p.missions.length > 0 && (
        <section className="mp-sec" aria-labelledby="mp-missions" data-testid="saved-missions">
          <h3 id="mp-missions" className="mp-h">
            Saved missions
          </h3>
          <ul className="plain">
            {p.missions.map((m) => {
              const key = missionKey(m)
              const name = m.name ?? DEFAULT_MISSION_NAME
              // null = the default site, as in a link (App and the mission table resolve it the same way)
              const where =
                sites.find((s) => s.id === (m.site ?? DEFAULT_SITE_ID))?.name ?? (m.site && parseCustomSiteId(m.site) ? CUSTOM_SITE_NAME : 'unknown site')
              return (
                <li key={key} className="ms-row" data-mission={key}>
                  <button type="button" className="link ms-load" onClick={() => p.onLoadMission(m)}>
                    {name}
                  </button>
                  <button type="button" className="mp-close ms-del" aria-label={`Remove ${name}`} onClick={() => p.onRemoveMission(key)}>
                    ×
                  </button>
                  <span className="quiet ms-what">
                    {where} · {resolvePeriod(m, p.periods).label}
                  </span>
                  <span className="quiet ms-what">{flightSummary(m)}</span>
                  <button type="button" className="link ms-flight" data-testid="panel-calculate-flight" onClick={() => p.onCalculateFlight(m)}>
                    Calculate flight
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <fieldset className="mp-sec mp-goals">
        <legend className="mp-h">Science goal</legend>
        {GOALS.map((g) => (
          <label key={g.id} className="check mp-radio">
            <input type="radio" name="mission-goal" value={g.id} checked={goal === g.id} onChange={() => p.onGoal(g.id)} />
            <span>{g.label}</span>
          </label>
        ))}
      </fieldset>

      <section className="mp-sec" aria-labelledby="mp-sites">
        <h3 id="mp-sites" className="mp-h">
          Landing site
        </h3>
        <p className="quiet mp-rule">
          Best among the {sites.length} evaluated sites for this mission first, by {goalRow.rule}.
          {goalRow.short && ' Evidence, best first: direct measurement, remote observation, modeled condition, hypothesis, unknown.'} Slope over{' '}
          {SLOPE_BASELINE} on the LOLA 20 m terrain; passing the 5° slope limit alone does not establish landing safety.
        </p>
        <div className="menu-search">
          <input
            className="field"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="site-list"
            aria-activedescendant={flat[activeIdx] ? `site-opt-${flat[activeIdx].site.id}` : undefined}
            aria-label="Search a site or type coordinates"
            placeholder={`Site name, or ${eg(EXAMPLE.coords)}`}
            value={query}
            onKeyDown={onSearchKey}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveId(null)
            }}
          />
        </div>
        {coords.kind === 'error' && (
          <p className="menu-msg is-error" role="alert">
            {coords.message}
          </p>
        )}
        {coords.kind === 'ok' && (
          <p className="menu-msg" role="status">
            <span className="mono">{fmtCoords(coords.lat, coords.lon)}</span>{' '}
            {full ? (
              `At most ${MAX_POINTS} points.`
            ) : (
              <button type="button" className="link" data-testid="add-point" onClick={addTyped}>
                Add point
              </button>
            )}
            <span className="quiet" aria-hidden="true">
              {' · '}
            </span>
            {inPinRegion(coords.lat) ? (
              <button
                type="button"
                className="link"
                data-testid="set-site"
                onClick={() => {
                  setQuery('')
                  p.onSetSite(coords.lat, coords.lon)
                }}
              >
                Set as landing site
              </button>
            ) : (
              <span className="quiet" data-testid="set-site-none">
                {SITE_REGION_TEXT}
              </span>
            )}
          </p>
        )}
        <p className="menu-msg is-quiet mp-progress" aria-live="polite">
          {computing > 0 ? `Computing ${sites.length - computing} of ${sites.length} sites for these dates…` : ''}
        </p>
        <div id="site-list" className="menu-list" role="listbox" aria-label="Landing sites">
          {groups.map((g) => (
            <div key={g.key} role="group" aria-label={g.title} data-group={g.key}>
              <div className="menu-group">{g.title}</div>
              {g.rows.map((row) => {
                const i = flat.indexOf(row)
                return (
                  <SiteRow
                    key={row.site.id}
                    row={row}
                    goal={goalRow}
                    current={row.site.id === site.id}
                    active={i === activeIdx}
                    orderedByCoverage={row.r !== null && row.r.rank !== null && (shared.get(ruleValue(row.r) ?? '') ?? 0) > 1}
                    tiedNames={row.r?.tiedWith.map((id) => byId.get(id)?.name ?? id) ?? []}
                    onHover={() => setActiveId(row.site.id)}
                    onSelect={() => p.onSelect(row.site.id)}
                  />
                )
              })}
            </div>
          ))}
          {coords.kind === 'none' && q && flat.length === 0 && <p className="menu-msg">No site matches “{query.trim()}”.</p>}
        </div>
        <div role="group" aria-labelledby="mp-points" data-testid="points">
          <div id="mp-points" className="menu-group">
            Your points
          </div>
          {p.points.length === 0 && <p className="menu-msg is-quiet">None yet.</p>}
          <ul className="plain">
            {p.points.map((pt, i) => {
              const name = pointName(pt, i)
              const selected = p.selectedPoint === i
              return (
                <li key={i} className={`pt-row${selected ? ' is-selected' : ''}`} data-testid="point" data-role={pt.role ?? ''}>
                  <input
                    className="field pt-name"
                    type="text"
                    aria-label={`Name of ${name}`}
                    maxLength={NAME_MAX}
                    placeholder={eg(EXAMPLE.point)}
                    value={pointDraft?.i === i ? pointDraft.text : name}
                    onChange={(e) => {
                      setPointDraft({ i, text: e.target.value })
                      p.onPointName(i, e.target.value)
                    }}
                    onBlur={() => setPointDraft(null)}
                  />
                  <select
                    className="field pt-role"
                    aria-label={`Role of ${name}`}
                    value={pt.role ?? ''}
                    onChange={(e) => p.onPointRole(i, e.target.value === '' ? null : (e.target.value as PointRole))}
                  >
                    <option value="">No role</option>
                    <option value="start">Start</option>
                    <option value="end">End</option>
                  </select>
                  <button
                    type="button"
                    className="mp-close pt-del"
                    aria-label={`Delete ${name}`}
                    onClick={() => {
                      setPointDraft(null)
                      p.onPointDelete(i)
                    }}
                  >
                    ×
                  </button>
                  <button
                    type="button"
                    className="pt-select mono"
                    aria-pressed={selected}
                    aria-label={`Select ${name}, ${fmtCoords(pt.lat, pt.lon)}`}
                    onClick={() => p.onPointSelect(selected ? null : i)}
                  >
                    {fmtCoords(pt.lat, pt.lon)}
                  </button>
                  <span className="pt-none" data-fact="none">
                    No terrain data for this point
                  </span>
                  {inPinRegion(pt.lat) ? (
                    <button
                      type="button"
                      className="link pt-land"
                      data-testid="point-set-site"
                      aria-label={`Set as landing site: ${name}`}
                      onClick={() => p.onSetSite(pt.lat, pt.lon)}
                    >
                      Set as landing site
                    </button>
                  ) : (
                    <span className="pt-land quiet">{SITE_REGION_TEXT}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
        <button className="menu-add" type="button" disabled>
          Add a point: type coordinates above, or right-click the Moon
        </button>
      </section>

      <section ref={stationsRef} className="mp-sec" aria-labelledby="mp-stations">
        <h3 id="mp-stations" className="mp-h">
          Ground stations
        </h3>
        <p className="quiet mp-rule">Comms means geometric line of sight to at least one selected station, not a guaranteed radio link.</p>
        <StationChecklist stations={p.stations} ids={p.ids} onToggle={p.onToggleStation} />
      </section>

      <section className="mp-sec mp-play" aria-labelledby="mp-play">
        <h3 id="mp-play" className="sr-only">
          Play mission
        </h3>
        <button type="button" className="btn" onClick={p.onPlay}>
          Play mission
        </button>
        <p className="quiet">Eye level at the landing site, from the first to the last mission day. Space pauses.</p>
      </section>
    </div>
  )
}

interface RowProps {
  row: Row
  goal: (typeof GOALS)[number]
  current: boolean
  active: boolean
  orderedByCoverage: boolean
  tiedNames: string[]
  onHover(): void
  onSelect(): void
}

function SiteRow({ row, goal, current, active, orderedByCoverage, tiedNames, onHover, onSelect }: RowProps) {
  const { site, r, entry } = row
  const own = r ? null : slopeOf(site)
  const slope = r ?? { slope: own!.state, slopeDeg: own!.deg }
  const id = site.id
  return (
    <div
      id={`site-opt-${id}`}
      role="option"
      aria-selected={current}
      aria-labelledby={`site-nm-${id}`}
      aria-describedby={`site-fx-${id}`}
      data-rank={r?.rank ?? ''}
      className={`opt rank-row${active ? ' is-active' : ''}`}
      onPointerEnter={onHover}
      onClick={onSelect}
    >
      <span className="rank-n mono">{r?.rank ?? ''}</span>
      <span className="rank-main">
        <span id={`site-nm-${id}`} className="opt-name">
          {site.name}
          {site.label && <span className="opt-label"> {site.label}</span>}
        </span>
        {!site.label && <span className="opt-label">{GROUP_TEXT[site.group]}</span>}
        <span id={`site-fx-${id}`} className="rank-facts">
          {entry?.status === 'done' ? (
            <>
              <span data-fact="lit">lit {fmtPct(entry.summary.litPct)}</span>
              <span data-fact="comms">comms {fmtPct(entry.summary.coveragePct)}</span>
              {goal.id === 'light' && <span data-fact="dark">longest dark {fmtHours(entry.summary.longestDarkH)}</span>}
            </>
          ) : entry?.status === 'none' ? (
            <span data-fact="none">{entry.reason}</span>
          ) : (
            <span data-fact="computing">computing…</span>
          )}
          <span data-fact="slope" className={slope.slope === 'fail' ? 'is-fail' : undefined}>
            {slope.slope === 'unknown' || slope.slopeDeg === null
              ? 'slope unknown'
              : slope.slope === 'fail'
                ? `slope ${fmtDeg(slope.slopeDeg)} — too steep`
                : `slope ${fmtDeg(slope.slopeDeg)}`}
          </span>
          {goal.short && r && (
            <span data-fact="evidence">
              {goal.short}: {r.goalEvidence ?? 'no sourced entry'}
              {r.goalSourceUrl && (
                <>
                  {' '}
                  <a href={r.goalSourceUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                    source
                  </a>
                </>
              )}
            </span>
          )}
          {orderedByCoverage && <span data-fact="then">then by station coverage</span>}
          {tiedNames.length > 0 && <span data-fact="tie">tied with {tiedNames.join(', ')}</span>}
        </span>
      </span>
    </div>
  )
}
