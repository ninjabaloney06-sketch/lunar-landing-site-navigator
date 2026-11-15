// Site search (U4): which places have the chosen points of interest nearby, can be landed on, and see the most
// sunlight and station coverage for the mission dates. Candidates: every site of sites.json, plus the POI points
// that have a horizon of their own (search-sites.json, terrain track; without it the sites only).
//
// Light and comms values are the comparison table's (useSiteRows → data/results.computeRow → summarize), never a
// second implementation; nearby counts and the order are geometry/poiSearch (the exact rule is written there).
// A place without a horizon file shows "no data", as the table does.
import { useEffect, useMemo, useRef, useState } from 'react'
import { loadSearchSites } from '../data/load'
import { POI_GROUPS } from '../data/pois'
import type { Poi, PoiGroup, SearchSite } from '../data/pois'
import type { Site, Station } from '../data/types'
import { BEST_COUNT, searchCandidates, searchSites } from '../geometry/poiSearch'
import type { Candidate, SearchRow, ShareBy } from '../geometry/poiSearch'
import type { Summary } from '../geometry'
import { useFullData } from './advanced'
import type { ViewPeriod } from './Drawer'
import { fmtCoords, fmtPct, fmtRange, fmtSpanH } from './format'
import { FullDataSwitch } from './FullDataSwitch'
import type { PoiData } from './poiLayer'
import { groupInfo, REGION_TEXT } from './poiLayer'
import { useSiteRows } from './useSiteRows'
import { customSiteId } from '../data/customSite'
import { COMMS_HINT, SlopeValue } from './SiteTable'

// UI defaults (not sourced values): the groups of scientific interest (hazards are something to avoid, sunlight is
// measured by the app itself, landing records are other sites), and 20 km, the reach of the 20 m terrain model
// around each site that the horizons use.
const DEFAULT_GROUPS: PoiGroup[] = ['water', 'cold-trap', 'science']
const DEFAULT_RADIUS_KM = 20
const RADIUS = { min: 1, max: 200 } // km, input limits
// "At least" inputs: how much sunlight and station coverage a place must have (% of the mission dates); 0 = any.
const pctOf = (text: string): number | null => {
  const v = Number(text)
  return text.trim() !== '' && v >= 0 && v <= 100 ? v : null
}

// Short names for the nearby counts on each row ("2 shadow"): the group labels are too long for a row of numbers.
const COUNT_NAME: Record<PoiGroup, string> = {
  hazard: 'hazards',
  water: 'water',
  'cold-trap': 'shadow',
  light: 'sunlit',
  landing: 'landing',
  science: 'science',
}

// "Both" = min(sunlit, coverage) (geometry/poiSearch): a place is as good as its weaker value.
const BY: { id: ShareBy; label: string; rule: string }[] = [
  { id: 'both', label: 'Both', rule: 'the most sunlight and station coverage together (the lower of the two percentages)' },
  { id: 'light', label: 'Sunlit', rule: 'the most sunlight' },
  { id: 'comms', label: 'Comms', rule: 'the most comms time' },
]
const BY_HINT = 'Both: the weaker of sunlit % and comms %.'

interface Props {
  sites: Site[]
  stations: Station[]
  ids: string[]
  site: Site // the mission's site: computed first
  period: ViewPeriod
  pois: PoiData
  onSelectSite(siteId: string, groups: PoiGroup[]): void
  onShowPoi(poi: Poi, groups: PoiGroup[]): void
  onClose(): void
}

export function SearchPanel(p: Props) {
  const { sites, stations, ids, site, period, pois } = p
  const closeBtn = useRef<HTMLButtonElement>(null)
  const [groups, setGroups] = useState<PoiGroup[]>(DEFAULT_GROUPS)
  const [radiusText, setRadiusText] = useState(String(DEFAULT_RADIUS_KM))
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM)
  const [slopeRequired, setSlopeRequired] = useState(true)
  const [by, setBy] = useState<ShareBy>('both')
  const [minLitText, setMinLitText] = useState('0')
  const [minCovText, setMinCovText] = useState('0')
  const minLitPct = pctOf(minLitText) ?? 0
  const minCoveragePct = pctOf(minCovText) ?? 0
  const minError = pctOf(minLitText) === null || pctOf(minCovText) === null
  const [extra, setExtra] = useState<SearchSite[] | null>(null)
  const [extraError, setExtraError] = useState<string | null>(null)

  useEffect(() => {
    closeBtn.current?.focus({ preventScroll: true })
    let alive = true
    loadSearchSites().then(
      (x) => alive && setExtra(x),
      (e: Error) => {
        if (!alive) return
        setExtra([])
        setExtraError(e.message)
      },
    )
    return () => {
      alive = false
    }
  }, [])

  const ready = pois.status === 'ready' && extra !== null
  const candidates = useMemo(
    (): Candidate[] =>
      pois.status === 'ready' && extra !== null ? searchCandidates(sites, extra, pois.pois) : sites.map((s) => ({ site: s, selfPoiId: null, records: [] })),
    [pois, extra, sites],
  )
  // The mission's site first (when it is a candidate: a custom site is not), then the rest in list order: the row a
  // user is looking at fills in first.
  const computeOrder = useMemo(() => {
    const all = candidates.map((c) => c.site)
    return all.some((s) => s.id === site.id) ? [site, ...all.filter((s) => s.id !== site.id)] : all
  }, [candidates, site])
  const rows = useSiteRows(computeOrder, stations, ids, period.startMs, period.endMs, false)

  const computing = computeOrder.filter((s) => rows[s.id]?.status === 'computing').length
  // Ranked once every value is in: rows never jump, and the list renders once instead of once per computed row.
  const ordered = computing === 0 && ready
  const results = useMemo(() => {
    if (pois.status !== 'ready' || !ordered) return null
    const input = candidates.map((c) => {
      const r = rows[c.site.id]
      return { ...c, summary: r?.status === 'done' ? (r as { summary: Summary }).summary : null }
    })
    return searchSites(input, pois.pois, { groups, radiusKm, slopeRequired, by, minLitPct, minCoveragePct })
  }, [pois, ordered, candidates, rows, groups, radiusKm, slopeRequired, by, minLitPct, minCoveragePct])

  const [full] = useFullData()
  const byId = new Map(candidates.map((c) => [c.site.id, c]))
  const radiusError = radiusText.trim() === '' || !(Number(radiusText) >= RADIUS.min && Number(radiusText) <= RADIUS.max)
  const chosenGroups = POI_GROUPS.filter((g) => groups.includes(g.id))
  // Empty states: no group chosen, or no place has any chosen point within the distance. A list of every place,
  // all with 0 nearby, answers nothing.
  const empty: string | null =
    groups.length === 0
      ? 'Choose at least one kind of point of interest above.'
      : results && !results.some((r) => r.groupsCovered > 0)
        ? `No place has a chosen point of interest within ${radiusKm} km; choose more kinds or a larger distance.`
        : results && !results.some((r) => r.meetsMin)
          ? `No place has at least ${minLitPct} % sunlight and ${minCoveragePct} % comms for these dates; lower a minimum.`
          : null
  // Places below a minimum the user set are not listed; the line under the form says how many.
  const below = results ? results.filter((r) => !r.meetsMin).length : 0
  const list: SearchRow[] | null = empty ? null : results && results.filter((r) => r.meetsMin)
  // Summary: what "Best" means in one line. Full data: the whole order rule.
  const bestHint = `Best: top ${BEST_COUNT} with a chosen point within ${radiusKm} km and a value above 0 %.`
  const rule = `${slopeRequired ? 'Places that pass the 5° slope limit first; then ' : 'Order: '}places with a value above 0 (lit and in contact for part of the dates, for "Both"); then most of the chosen groups within ${radiusKm} km, then ${(BY.find((b) => b.id === by) ?? BY[0]).rule} for the mission dates, then the flatter slope, then the most points nearby. The best ${BEST_COUNT} with a point nearby and a value above 0 are marked (more when tied); places without data follow.`

  return (
    <aside
      className="drawer search-panel"
      role="dialog"
      aria-labelledby="search-title"
      data-testid="search"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          p.onClose()
        }
      }}
    >
      <header className="drawer-head">
        <div>
          <h2 id="search-title" className="drawer-title">
            Search sites
          </h2>
          <p className="quiet" data-testid="search-dates">
            Sunlit and comms are % of the mission dates, {fmtRange(period.startMs, period.endMs)} (UTC), with {ids.length} of{' '}
            {stations.length} stations.
          </p>
        </div>
        <div className="search-tools">
          <FullDataSwitch />
          <button ref={closeBtn} className="btn" type="button" onClick={p.onClose}>
            Close
          </button>
        </div>
      </header>

      <form className="search-form" onSubmit={(e) => e.preventDefault()}>
        <fieldset className="search-groups">
          <legend className="quiet">Points of interest nearby</legend>
          {POI_GROUPS.map((g) => (
            <label key={g.id} className="check poi-key-item">
              <input
                type="checkbox"
                checked={groups.includes(g.id)}
                onChange={() => setGroups((x) => POI_GROUPS.map((y) => y.id).filter((id) => (id === g.id ? !x.includes(id) : x.includes(id))))}
              />
              <span className="poi-swatch" style={{ background: g.color }} aria-hidden="true" />
              <span>{g.label}</span>
            </label>
          ))}
        </fieldset>
        <div className="search-row">
          <label className="search-radius">
            <span className="quiet">Within, km</span>
            <input
              className="field mono"
              type="number"
              inputMode="decimal"
              min={RADIUS.min}
              max={RADIUS.max}
              value={radiusText}
              aria-invalid={radiusError}
              onChange={(e) => {
                setRadiusText(e.target.value)
                const v = Number(e.target.value)
                if (e.target.value.trim() !== '' && v >= RADIUS.min && v <= RADIUS.max) setRadiusKm(v)
              }}
            />
          </label>
          <label className="check search-slope">
            <input type="checkbox" checked={slopeRequired} onChange={(e) => setSlopeRequired(e.target.checked)} />
            <span>Must pass the 5° slope limit</span>
          </label>
        </div>
        {radiusError && (
          <p className="msg is-error" role="alert">
            Within: a number from {RADIUS.min} to {RADIUS.max} km. The list uses {radiusKm} km.
          </p>
        )}
        <div className="search-row search-min" data-testid="search-min">
          <label className="search-radius">
            <span className="quiet">Sunlit at least, %</span>
            <input
              className="field mono"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={5}
              value={minLitText}
              data-testid="search-min-lit"
              aria-invalid={pctOf(minLitText) === null}
              onChange={(e) => setMinLitText(e.target.value)}
            />
          </label>
          <label className="search-radius">
            <span className="quiet">
              <span title={COMMS_HINT}>Comms</span> at least, %
            </span>
            <input
              className="field mono"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={5}
              value={minCovText}
              data-testid="search-min-comms"
              aria-invalid={pctOf(minCovText) === null}
              onChange={(e) => setMinCovText(e.target.value)}
            />
          </label>
          <p className="quiet search-min-hint">Share of the mission dates. 0 = any amount.</p>
        </div>
        {minError && (
          <p className="msg is-error" role="alert">
            At least: a number from 0 to 100 %. An empty or invalid field counts as 0.
          </p>
        )}
        <fieldset className="st-pick">
          <legend className="quiet">Rank by</legend>
          {BY.map((b) => (
            <label key={b.id} className="check">
              <input type="radio" name="search-by" value={b.id} checked={by === b.id} onChange={() => setBy(b.id)} />
              <span>{b.label}</span>
            </label>
          ))}
          <p className="quiet st-hint search-by-hint" data-testid="search-by-hint">
            {BY_HINT}
          </p>
        </fieldset>
      </form>

      <p className="quiet search-progress" aria-live="polite" data-testid="search-rule">
        {pois.status === 'error'
          ? 'The points of interest could not be loaded; reload the page to try again.'
          : !ready
            ? 'Loading the points of interest…'
            : groups.length === 0
              ? ''
              : computing > 0
                ? `Computing ${computeOrder.length - computing} of ${computeOrder.length} places for these dates…`
                : full
                  ? rule
                  : bestHint}
      </p>
      {list && below > 0 && (
        <p className="quiet search-progress" data-testid="search-below">
          {below} {below === 1 ? 'place is' : 'places are'} below your minimums and not listed.
        </p>
      )}
      {extraError && <p className="msg">The extra points did not load; only the {sites.length} listed sites are searched.</p>}
      {empty && (
        <p className="search-empty" data-testid="search-empty">
          {empty}
        </p>
      )}

      {list && (
        <ol className="plain search-list" data-testid="search-results" data-ordered={ordered ? 'true' : 'false'}>
          {list.map((r) => {
            const c = byId.get(r.siteId)!
            const poi = c.selfPoiId && pois.status === 'ready' ? (pois.byId.get(c.selfPoiId) ?? null) : null
            const entry = rows[r.siteId]
            const value = (v: number | null) => (entry?.status === 'done' && v !== null ? fmtPct(v) : entry?.status === 'none' ? 'no data' : '…')
            const sum = entry?.status === 'done' ? entry.summary : null
            const finite = (v: number | undefined) => typeof v === 'number' && Number.isFinite(v)
            return (
              <li
                key={r.siteId}
                className={`search-item${ordered && r.best ? ' is-best' : ''}`}
                data-site-id={r.siteId}
                data-records={c.records.map((x) => x.id).join(' ')}
                data-best={ordered && r.best ? 'true' : 'false'}
                data-rank={ordered && r.rank !== null ? r.rank : ''}
              >
                <div className="search-item-head">
                  <p className="search-item-name">
                    <span className="mono search-rank">{ordered && r.rank !== null ? r.rank : ''}</span>
                    <span className="search-item-title">
                      {c.site.name}
                      {ordered && r.best && (
                        <span className="search-best" title={bestHint}>
                          Best
                        </span>
                      )}
                    </span>
                  </p>
                </div>
                <p className="search-item-sub">{poi ? `${groupInfo(poi.group).label} point` : 'Listed landing site'}</p>
                <p className="search-item-facts search-item-near">
                  <span>Within {radiusKm} km:</span>{' '}
                  {chosenGroups.map((g, i) => (
                    <span key={g.id} className="search-count" data-group={g.id} title={`${g.label} within ${radiusKm} km`}>
                      <span className="mono">{r.counts[g.id] ?? 0}</span> {COUNT_NAME[g.id]}
                      {i < chosenGroups.length - 1 ? ' ' : ''}
                    </span>
                  ))}
                </p>
                <p className="search-item-facts">
                  <span className="search-num" data-col="lit">
                    Sunlit <span className="mono">{value(r.litPct)}</span>
                  </span>
                  <span className="search-num" data-col="comms">
                    <span title={COMMS_HINT}>Comms</span> <span className="mono">{value(r.coveragePct)}</span>
                  </span>
                  <span className="search-num" data-col="slope">
                    Slope <SlopeValue site={c.site} />
                  </span>
                </p>
                <p className="search-item-act">
                  {poi ? (
                    // A point outside the custom-site region cannot be a landing site: App shows it on the Moon instead.
                    customSiteId(poi.lat, poi.lon) ? (
                      <button
                        type="button"
                        className="btn search-go"
                        data-testid="search-show"
                        title="Makes this point the mission's landing site and opens the landing-site view"
                        onClick={() => p.onShowPoi(poi, groups)}
                      >
                        Show as landing site
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn search-go"
                        data-testid="search-show"
                        title={`Only places ${REGION_TEXT} can be a landing site; this one opens in the Moon view`}
                        onClick={() => p.onShowPoi(poi, groups)}
                      >
                        Show on the Moon
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      className="btn search-go"
                      data-testid="search-select"
                      title="Makes this site the mission's landing site and opens the landing-site view"
                      onClick={() => p.onSelectSite(r.siteId, groups)}
                    >
                      Show as landing site
                    </button>
                  )}
                </p>
                {full && (
                  <div className="search-item-full" data-testid="search-item-full">
                    <p className="search-item-facts">
                      <span className="search-num">
                        Position <span className="mono">{fmtCoords(c.site.lat, c.site.lon)}</span>
                      </span>
                      {sum && finite(sum.earthVisiblePct) && (
                        <span className="search-num" data-col="earth">
                          Earth in view <span className="mono">{fmtPct(sum.earthVisiblePct)}</span>
                        </span>
                      )}
                      {sum && finite(sum.longestDarkH) && (
                        <span className="search-num" data-col="dark">
                          Longest darkness <span className="mono">{fmtSpanH(sum.longestDarkH)}</span>
                        </span>
                      )}
                      {sum && finite(sum.longestGapH) && (
                        <span className="search-num" data-col="gap">
                          Longest comms gap <span className="mono">{fmtSpanH(sum.longestGapH)}</span>
                        </span>
                      )}
                      <span className="search-num">
                        Points nearby <span className="mono">{r.nearTotal}</span>
                      </span>
                    </p>
                    {c.records.length > 0 && (
                      <p className="search-item-sub" data-testid="search-records">
                        Same place in {c.records.length} more {c.records.length === 1 ? 'record' : 'records'}: {c.records.map((x) => x.name).join('; ')}
                      </p>
                    )}
                    {c.site.source_url && (
                      <p className="search-item-sub">
                        Source:{' '}
                        <a href={c.site.source_url} target="_blank" rel="noreferrer">
                          {c.site.source_label || c.site.source_url}
                        </a>
                      </p>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
      <p className="quiet drawer-note">
        Points of interest: only {REGION_TEXT}. Distances are measured along the surface of a 1737.4 km sphere, not
        along a drivable route.
      </p>
    </aside>
  )
}
