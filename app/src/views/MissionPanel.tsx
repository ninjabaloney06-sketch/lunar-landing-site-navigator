// Mission panel (Step 2-UI; paper pages 2340–2342): Name, Start, End, Landing site, Science goal, Your points, Ground
// stations (U17: the landing site moved above the goal so it is in the first view at 1280×720), then the mission
// actions, with Play mission and the Full data switch in the header and Add mission at the bottom (U2). Folded until
// asked for: the site list (opens on typing, or as the full ranking), the ground-station checklist. The landing sites are ranked for this mission's own dates,
// stations and goal by geometry/rankSites; every row shows the values it was ranked by. Grown from the C2 site
// menu: its search, which also accepts typed coordinates. Typed coordinates can be added as a user point (Brief
// C4 part 3): a name, a place and a role, never numbers. A user point has no horizon file, and nothing is
// computed for it with a flat horizon or a neighbour's. Inside the pin region, typed coordinates and a user point
// can instead become the landing site ("Set as landing site": a custom site, data/customSite.ts), whose numbers
// are then computed like any site's.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Period, Site, Station } from '../data/types'
import { MAX_MISSIONS, missionKey } from '../missions'
import type { MissionState } from '../missions'
import { FINDER_DEFAULTS, rankSites } from '../geometry'
import type { RankedSite, ScienceGoal, Summary } from '../geometry'
import { DAY_MS, DEFAULT_MISSION_NAME, DEFAULT_SITE_ID, inCoverage, MAX_DAYS, MAX_POINTS, NAME_MAX, pointName, COVERAGE_END_MS, COVERAGE_START_MS } from '../state'
import type { UserPoint } from '../state'
import type { ViewPeriod } from './Drawer'
import { EXAMPLE, eg } from './examples'
import { fmtCoords, fmtDate, fmtDeg, fmtHours, fmtPct, parseCoords, parseDate } from './format'
import { flightSummary } from './flightSummary'
import { resolvePeriod } from './period'
import { SLOPE_BASELINE, slopeOf } from './slope'
import { StationChecklist } from './Stations'
import { useSummaries } from './useSummaries'
import { inPinRegion } from '../scene3d/region'
import { customSiteName, parseCustomSiteId } from '../data/customSite'
import { SITE_REGION_TEXT } from './custom'
import type { SummaryEntry } from './useSummaries'
import { FullDataSwitch } from './FullDataSwitch'
import { useFullData } from './advanced'
import { Abbr } from './flightGlossary'

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

const PLAY_NOTE = 'Eye level at the landing site, from the first to the last mission day. Space pauses.'

// U17: the dates of the data's coverage in the panel's own date format (16 Aug 2027), not state.ts's long months.
const RANGE_TEXT = `Dates from ${fmtDate(COVERAGE_START_MS)} to ${fmtDate(COVERAGE_END_MS - DAY_MS)} (UTC) are supported.`

/** A duration as "8.4 h" below a day, else "3 days 4 h" (U17). */
export function fmtDuration(hours: number): string {
  if (hours < 24) return `${hours.toFixed(1)} h`
  let d = Math.floor(hours / 24)
  let h = Math.round(hours - d * 24)
  if (h === 24) [d, h] = [d + 1, 0]
  return `${d} ${d === 1 ? 'day' : 'days'}${h ? ` ${h} h` : ''}`
}

// Status thresholds for the per-site values: the "Find better dates" defaults (FINDER_DEFAULTS in geometry/index.ts,
// docs/event/spec.md "Finder"; proposed defaults, the science lead reviews them) and the 5° landing-slope criterion
// (geometry/rankSites.ts SLOPE_LIMIT_DEG). Values without a stated threshold get no colour.
const TH = FINDER_DEFAULTS
const SLOPE_LIMIT = '5°'

// Networks of the stations in stations.json, expanded on hover.
const NETWORK_NAME: Record<string, string> = {
  DSN: 'NASA Deep Space Network',
  JAXA: 'Japan Aerospace Exploration Agency',
  ESTRACK: 'ESA tracking station network',
}

const ab = (term: string, title: string) => (
  <abbr key={term} title={title}>
    {term}
  </abbr>
)

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
  onCompareMissions(): void // opens the table of saved missions in the Details drawer (U13)
  onCalculateCurrentFlight(): void // the mission on screen, saved or not: the flight view has no tab (U12)
  onLoadMission(m: MissionState): void
  onRemoveMission(key: string): void
  onAddPoint(lat: number, lon: number): void
  onSetSite(lat: number, lon: number): void // makes the place a custom landing site (inside the pin region only)
  onPointName(i: number, name: string): void
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
  // null = not editing: the field shows the current site's name and no list (U1). Typing shows the matching sites.
  const [query, setQuery] = useState<string | null>(null)
  const [rankingOpen, setRankingOpen] = useState(false) // the full ranked list, opened on purpose
  const [stationsOpen, setStationsOpen] = useState(p.focusStations) // folded to "n of m stations" (U2)
  const [pointDraft, setPointDraft] = useState<{ i: number; text: string } | null>(null) // the name being typed
  const [activeId, setActiveId] = useState<string | null>(site.id) // keyboard row; null = first row (after typing)

  useEffect(() => {
    if (p.focusStations && stationsRef.current) {
      stationsRef.current.scrollIntoView({ block: 'start' })
      stationsRef.current.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
    } else closeBtn.current?.focus({ preventScroll: true })
    // on open only
  }, [])

  // The panel ends above the answer sentence: its height is measured from where it opens, not a fixed guess.
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const place = () => el.style.setProperty('--mp-top', `${Math.max(0, el.getBoundingClientRect().top)}px`)
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
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

  // A new landing site (typed coordinates set as the site) shows its name in the field again.
  useEffect(() => setQuery(null), [site.id])

  const typed = query ?? ''
  const coords = parseCoords(typed)
  const q = typed.trim().toLowerCase()
  const searching = q !== '' && coords.kind === 'none'
  const showList = rankingOpen || searching
  const match = (s: Site) => !searching || `${s.name} ${s.label ?? ''}`.toLowerCase().includes(q)
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
    .filter((g) => showList && g.rows.length > 0)
  const flat = groups.flatMap((g) => g.rows)
  // Tracked by site id: rows move while the ranking fills in.
  const activeIdx = Math.max(0, flat.findIndex((row) => row.site.id === activeId))
  const moveActive = (d: number) => {
    if (flat.length) setActiveId(flat[(activeIdx + d + flat.length) % flat.length].site.id)
  }

  const full = p.points.length >= MAX_POINTS
  // Stable row keys without an id in the data: the place, plus a counter for the same place added twice.
  const seenPlaces = new Map<string, number>()
  const pointKeys = p.points.map((pt) => {
    const at = `${pt.lat},${pt.lon}`
    const n = seenPlaces.get(at) ?? 0
    seenPlaces.set(at, n + 1)
    return `${at}#${n}`
  })
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
    if (!inCoverage(a)) return setDateError(RANGE_TEXT)
    setDateError(null)
    setStartDraft(null)
    const n = Math.max(1, Math.min(days, Math.floor((COVERAGE_END_MS - a) / DAY_MS)))
    if (a !== period.startMs || n !== days) p.onDates(a, n)
  }
  const commitEnd = () => {
    if (endDraft === null) return
    const b = parseDate(endDraft)
    if (b === null) return setDateError('End: enter a date such as 29 Aug 2027.')
    if (!inCoverage(b)) return setDateError(RANGE_TEXT)
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

  const [fullData] = useFullData()
  // The networks the app's stations belong to (stations.json: DSN and JAXA today), in the order they appear.
  const networks = [...new Set(p.stations.map((s) => s.network))]
  const missionName = p.name ?? DEFAULT_MISSION_NAME

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
        <button type="button" className="btn mp-play" aria-describedby="mp-play-note" title={PLAY_NOTE} onClick={p.onPlay}>
          Play mission
        </button>
        <span id="mp-play-note" className="sr-only">
          {PLAY_NOTE}
        </span>
        <FullDataSwitch className="mp-full" />
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
        <p id="mp-dates-note" className="mp-note quiet" data-testid="mp-dates-note">
          {days} {days === 1 ? 'day' : 'days'}, {ab('UTC', 'Coordinated Universal Time')}, last day included. Changing Start keeps the length.
        </p>
        {dateError && (
          <p className="menu-msg is-error mp-error" role="alert">
            {dateError}
          </p>
        )}
      </div>

      {/* U17: the landing site is the first decision, so it comes before the goal that orders its ranking. */}
      <section className="mp-sec" aria-labelledby="mp-sites" data-testid="mp-site-section">
        <h3 id="mp-sites" className="mp-h">
          Landing site
        </h3>
        <div className="menu-search">
          <input
            className="field"
            type="text"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls="site-list"
            aria-activedescendant={flat[activeIdx] ? `site-opt-${flat[activeIdx].site.id}` : undefined}
            aria-label="Search a site or type coordinates"
            placeholder={`Site name, or ${eg(EXAMPLE.coords)}`}
            value={query ?? site.name}
            onKeyDown={onSearchKey}
            onFocus={(e) => {
              if (query === null) e.currentTarget.select() // typing replaces the site's name
            }}
            onBlur={() => {
              if (query !== null && query.trim() === '') setQuery(null) // an emptied field shows the site again
            }}
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
        <button
          type="button"
          className="link mp-disclose"
          aria-expanded={rankingOpen}
          aria-controls="site-list"
          data-testid="site-ranking"
          onClick={() => setRankingOpen((v) => !v)}
        >
          <span className="mp-chev" aria-hidden="true">
            {rankingOpen ? '▾' : '▸'}
          </span>
          All {sites.length} sites, ranked for this mission
        </button>
        {showList && (
          <ul className="quiet mp-rule mp-bullets" data-testid="mp-rule">
            <li>Best first, by {goalRow.rule}.</li>
            <li>Green meets its threshold; red misses it and names it.</li>
            <li>Passing the {SLOPE_LIMIT} slope limit alone does not establish landing safety; the landing site assessment in Details applies a stricter per-pixel rule.</li>
            {fullData && (
              <li>
                Among the {sites.length} evaluated sites. Slope over {SLOPE_BASELINE} on the {ab('LOLA', 'Lunar Orbiter Laser Altimeter')} 20 m terrain.
                {goalRow.short && ' Evidence, best first: direct measurement, remote observation, modeled condition, hypothesis, unknown.'} Thresholds: the
                Find better dates defaults, sunlit at least {TH.minLitPct} %, comms at least {TH.minCoveragePct} %, longest darkness at most{' '}
                {fmtDuration(TH.maxDarkH)}, longest comms gap at most {fmtDuration(TH.maxGapH)}.
              </li>
            )}
          </ul>
        )}
        <p className="menu-msg is-quiet mp-progress" aria-live="polite">
          {showList && computing > 0 ? `Computing ${sites.length - computing} of ${sites.length} sites for these dates…` : ''}
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
                    days={days}
                    full={fullData}
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
          {searching && flat.length === 0 && <p className="menu-msg">No site matches “{typed.trim()}”.</p>}
        </div>
      </section>

      <fieldset className="mp-sec mp-goals">
        <legend className="mp-h">Science goal</legend>
        <p className="quiet mp-hint">Orders the landing-site ranking above.</p>
        <div className="mp-goal-grid">
          {GOALS.map((g) => (
            <label key={g.id} className="check mp-radio" title={`Ranks by ${g.rule}.`}>
              <input type="radio" name="mission-goal" value={g.id} checked={goal === g.id} onChange={() => p.onGoal(g.id)} />
              <span>{g.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="mp-sec" aria-labelledby="mp-points" data-testid="points">
        <h3 id="mp-points" className="mp-h">
          Your points
        </h3>
        {p.points.length === 0 && <p className="menu-msg is-quiet">None yet.</p>}
        <ul className="plain">
          {p.points.map((pt, i) => {
            const name = pointName(pt, i)
            const selected = p.selectedPoint === i
            return (
              <li key={pointKeys[i]} className={`pt-row${selected ? ' is-selected' : ''}`} data-testid="point">
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
        <button className="menu-add" type="button" disabled>
          Add a point: type coordinates in Landing site, or right-click the Moon
        </button>
      </section>

      <section ref={stationsRef} className="mp-sec" aria-labelledby="mp-stations">
        <h3 id="mp-stations" className="mp-h">
          <button
            type="button"
            className="link mp-disclose mp-sum"
            aria-expanded={stationsOpen}
            aria-controls="mp-station-list"
            aria-describedby="mp-stations-hint"
            data-testid="stations-toggle"
            onClick={() => setStationsOpen((v) => !v)}
          >
            <span className="mp-chev" aria-hidden="true">
              {stationsOpen ? '▾' : '▸'}
            </span>
            Ground stations
            <span className="mp-sum-val">
              {p.ids.length} of {p.stations.length} stations
            </span>
          </button>
        </h3>
        <p id="mp-stations-hint" className="quiet mp-hint" data-testid="stations-hint">
          {networks.map((n, i) => (
            <span key={n}>
              {i > 0 && (i === networks.length - 1 ? ' and ' : ', ')}
              {NETWORK_NAME[n] ? ab(n, NETWORK_NAME[n]) : n}
            </span>
          ))}{' '}
          antennas for line-of-sight contact
        </p>
        {stationsOpen && (
          <div id="mp-station-list">
            <p className="quiet mp-rule">Comms means geometric line of sight to at least one selected station, not a guaranteed radio link.</p>
            <StationChecklist stations={p.stations} ids={p.ids} onToggle={p.onToggleStation} />
          </div>
        )}
      </section>

      {/* U17: one set of mission actions. Every mission, saved or on screen, has "Calculate flight" in the same
          place at the right of its row; Compare sits in the saved list's heading. */}
      {p.missions.length > 0 && (
        <section className="mp-sec mp-missions" aria-labelledby="mp-missions" data-testid="saved-missions">
          <div className="mp-act-head">
            <h3 id="mp-missions" className="mp-h">
              Saved missions <span className="mp-sum-val">{p.missions.length}</span>
            </h3>
            <button type="button" className="link mp-act" data-testid="compare-missions" onClick={p.onCompareMissions}>
              Compare
            </button>
          </div>
          <ul className="plain">
            {p.missions.map((m) => {
              const key = missionKey(m)
              const name = m.name ?? DEFAULT_MISSION_NAME
              // null = the default site, as in a link (App and the mission table resolve it the same way). A custom
              // site carries its mission's name, as in the header (U10).
              const where =
                sites.find((s) => s.id === (m.site ?? DEFAULT_SITE_ID))?.name ?? (m.site && parseCustomSiteId(m.site) ? customSiteName(m.name) : 'unknown site')
              return (
                <li key={key} className="ms-row" data-mission={key}>
                  <button type="button" className="link ms-load" title="Open this mission" onClick={() => p.onLoadMission(m)}>
                    {name}
                  </button>
                  <button type="button" className="link mp-act ms-flight" data-testid="panel-calculate-flight" onClick={() => p.onCalculateFlight(m)}>
                    Calculate flight
                  </button>
                  <button type="button" className="mp-close ms-del" aria-label={`Remove ${name}`} onClick={() => p.onRemoveMission(key)}>
                    ×
                  </button>
                  <span className="quiet ms-what">
                    {where} · {resolvePeriod(m, p.periods).label}
                  </span>
                  <span className="quiet ms-what">
                    <Abbr>{flightSummary(m)}</Abbr> · {transferText(m.tmax)}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="mp-sec mp-bottom" aria-labelledby="mp-this" data-testid="mission-actions">
        <div className="ms-row mp-this">
          <h3 id="mp-this" className="mp-h ms-load">
            This mission <span className="mp-sum-val">{missionName}</span>
          </h3>
          <button type="button" className="link mp-act" data-testid="current-calculate-flight" onClick={p.onCalculateCurrentFlight}>
            Calculate flight
          </button>
          <button type="button" className="btn" data-testid="add-mission" disabled={p.missionSaved || p.missions.length >= MAX_MISSIONS} onClick={p.onAddMission}>
            Add mission
          </button>
        </div>
        <p className="quiet mp-save-note" aria-live="polite" data-testid="mission-save-note">
          {p.missionSaved
            ? 'Saved in this browser.'
            : p.missions.length >= MAX_MISSIONS
              ? `At most ${MAX_MISSIONS} saved missions.`
              : 'Keeps name, site, dates, stations, goal, launchpad, rocket, surface stay and transfer cap in this browser.'}
        </p>
      </section>
    </div>
  )
}

/** The transfer cap a saved mission stores (hash key tmax): null = minimum energy, as the flight menu says. */
function transferText(tmax: number | null | undefined): string {
  return tmax == null ? 'minimum-energy transfer' : `transfer at most ${fmtDuration(tmax * 24)}`
}

interface RowProps {
  row: Row
  goal: (typeof GOALS)[number]
  days: number // mission length, for "≈ 3.6 of 14 days" in full data mode
  full: boolean // full data mode: every value of the summary, not only the decision values
  current: boolean
  active: boolean
  orderedByCoverage: boolean
  tiedNames: string[]
  onHover(): void
  onSelect(): void
}

type Status = 'pass' | 'fail'

/** One value of a site row: label, value with unit, status against a stated threshold (colour plus, when it misses,
 *  the threshold in words), and the hint on hover. */
function Fact({ fact, label, value, status, miss, hint, extra }: { fact: string; label: string; value: string; status?: Status; miss?: string; hint: string; extra?: string }) {
  return (
    <span data-fact={fact} data-status={status} className={status ? `is-${status}` : undefined} title={hint}>
      {label} {value}
      {extra && <span className="fact-extra"> {extra}</span>}
      {status === 'fail' && miss && <span className="fact-miss">, {miss}</span>}
    </span>
  )
}

function SiteRow({ row, goal, days, full, current, active, orderedByCoverage, tiedNames, onHover, onSelect }: RowProps) {
  const { site, r, entry } = row
  const own = r ? null : slopeOf(site)
  const slope = r ?? { slope: own!.state, slopeDeg: own!.deg }
  const id = site.id
  const ofDays = (pct: number) => (full ? `(≈ ${Number(((pct / 100) * days).toFixed(1))} of ${days} ${days === 1 ? 'day' : 'days'})` : undefined)
  const s = entry?.status === 'done' ? entry.summary : null
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
          {s ? (
            <>
              <Fact
                fact="lit"
                label="sunlit"
                value={fmtPct(s.litPct)}
                status={s.litPct >= TH.minLitPct ? 'pass' : 'fail'}
                miss={`below ${TH.minLitPct} %`}
                extra={ofDays(s.litPct)}
                hint={`Share of the mission time with the Sun above the local horizon. Threshold: at least ${TH.minLitPct} % (Find better dates default).`}
              />
              <Fact
                fact="comms"
                label="comms"
                value={fmtPct(s.coveragePct)}
                status={s.coveragePct >= TH.minCoveragePct ? 'pass' : 'fail'}
                miss={`below ${TH.minCoveragePct} %`}
                extra={ofDays(s.coveragePct)}
                hint={`Share of the mission time in line of sight of at least one selected ground station; not a guaranteed radio link. Threshold: at least ${TH.minCoveragePct} % (Find better dates default).`}
              />
              {(goal.id === 'light' || full) && (
                <Fact
                  fact="dark"
                  label="longest darkness"
                  value={fmtDuration(s.longestDarkH)}
                  status={s.longestDarkH <= TH.maxDarkH ? 'pass' : 'fail'}
                  miss={`over ${fmtDuration(TH.maxDarkH)}`}
                  hint={`Longest stretch without the Sun in the mission. Threshold: at most ${fmtDuration(TH.maxDarkH)} (Find better dates default).`}
                />
              )}
              {full && (
                <>
                  <Fact
                    fact="gap"
                    label="longest comms gap"
                    value={fmtDuration(s.longestGapH)}
                    status={s.longestGapH <= TH.maxGapH ? 'pass' : 'fail'}
                    miss={`over ${fmtDuration(TH.maxGapH)}`}
                    hint={`Longest stretch without line of sight to a selected station. Threshold: at most ${fmtDuration(TH.maxGapH)} (Find better dates default).`}
                  />
                  <Fact fact="earth" label="Earth in view" value={fmtPct(s.earthVisiblePct)} hint="Share of the mission time with Earth above the local horizon. No threshold set." />
                  {s.unknownPct > 0 && <Fact fact="unknown" label="comms unknown" value={fmtPct(s.unknownPct)} hint="Share of the mission time whose station visibility could not be decided. No threshold set." />}
                </>
              )}
            </>
          ) : entry?.status === 'none' ? (
            <span data-fact="none">{entry.reason === 'could not load' ? 'Data for these dates could not be loaded.' : 'No sunlight data for these dates.'}</span>
          ) : (
            <span data-fact="computing">computing…</span>
          )}
          <span
            data-fact="slope"
            data-status={slope.slope === 'unknown' || slope.slopeDeg === null ? undefined : slope.slope}
            className={slope.slope === 'fail' ? 'is-fail' : slope.slope === 'pass' && slope.slopeDeg !== null ? 'is-pass' : undefined}
            title={`Terrain slope over ${SLOPE_BASELINE} (LOLA). Limit: at most ${SLOPE_LIMIT}; passing it alone does not establish landing safety.`}
          >
            {slope.slope === 'unknown' || slope.slopeDeg === null
              ? 'slope unknown'
              : slope.slope === 'fail'
                ? `slope ${fmtDeg(slope.slopeDeg)} — too steep`
                : `slope ${fmtDeg(slope.slopeDeg)}`}
          </span>
          {goal.short && r && (
            <span data-fact="evidence" title="Best evidence for this goal in the site's sourced research entries. No threshold set.">
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
