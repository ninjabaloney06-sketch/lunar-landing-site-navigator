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
import type { SearchRow, ShareBy } from '../geometry/poiSearch'
import type { Summary } from '../geometry'
import type { ViewPeriod } from './Drawer'
import { fmtDeg, fmtPct, fmtRange } from './format'
import type { PoiData } from './poiLayer'
import { groupInfo, REGION_TEXT } from './poiLayer'
import { useSiteRows } from './useSiteRows'

// UI defaults (not sourced values): the groups of scientific interest (hazards are something to avoid, sunlight is
// measured by the app itself, landing records are other sites), and 20 km, the reach of the 20 m terrain model
// around each site that the horizons use.
const DEFAULT_GROUPS: PoiGroup[] = ['water', 'cold-trap', 'science']
const DEFAULT_RADIUS_KM = 20
const RADIUS = { min: 1, max: 200 } // km, input limits

const BY: { id: ShareBy; label: string; rule: string }[] = [
  { id: 'both', label: 'Both', rule: 'the most sunlight plus station coverage (the two percentages added)' },
  { id: 'light', label: 'Light', rule: 'the most sunlight' },
  { id: 'comms', label: 'Comms', rule: 'the most station coverage' },
]

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
    () => (pois.status === 'ready' && extra !== null ? searchCandidates(sites, extra, pois.pois) : sites.map((s) => ({ site: s, selfPoiId: null }))),
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
    return searchSites(input, pois.pois, { groups, radiusKm, slopeRequired, by })
  }, [pois, ordered, candidates, rows, groups, radiusKm, slopeRequired, by])

  const byId = new Map(candidates.map((c) => [c.site.id, c]))
  const list: SearchRow[] | null = results
  const radiusError = radiusText.trim() === '' || !(Number(radiusText) >= RADIUS.min && Number(radiusText) <= RADIUS.max)
  const chosenGroups = POI_GROUPS.filter((g) => groups.includes(g.id))
  const rule = `${slopeRequired ? 'Places that pass the 5° slope limit first; then ' : 'Order: '}most of the chosen groups within ${radiusKm} km, then the most points nearby, then ${(BY.find((b) => b.id === by) ?? BY[0]).rule} for the mission dates. The best ${BEST_COUNT} are marked (more when tied); places without data follow.`

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
          <p className="quiet">
            Mission dates: {fmtRange(period.startMs, period.endMs)}, UTC. {ids.length} of {stations.length} stations selected.
          </p>
        </div>
        <button ref={closeBtn} className="btn" type="button" onClick={p.onClose}>
          Close
        </button>
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
        <fieldset className="st-pick">
          <legend className="quiet">Rank by</legend>
          {BY.map((b) => (
            <label key={b.id} className="check">
              <input type="radio" name="search-by" value={b.id} checked={by === b.id} onChange={() => setBy(b.id)} />
              <span>{b.label}</span>
            </label>
          ))}
        </fieldset>
      </form>

      <p className="quiet search-progress" aria-live="polite" data-testid="search-rule">
        {pois.status === 'error'
          ? `Could not load the points of interest. ${pois.error}`
          : !ready
            ? 'Loading the points of interest…'
            : computing > 0
              ? `Computing ${computeOrder.length - computing} of ${computeOrder.length} places for these dates…`
              : rule}
      </p>
      {extraError && <p className="msg">The extra points could not be loaded ({extraError}); the {sites.length} sites are listed.</p>}

      {list && (
        <ol className="plain search-list" data-testid="search-results" data-ordered={ordered ? 'true' : 'false'}>
          {list.map((r) => {
            const c = byId.get(r.siteId)!
            const poi = c.selfPoiId && pois.status === 'ready' ? (pois.byId.get(c.selfPoiId) ?? null) : null
            const entry = rows[r.siteId]
            const value = (v: number | null) => (entry?.status === 'done' && v !== null ? fmtPct(v) : entry?.status === 'none' ? 'no data' : '…')
            return (
              <li
                key={r.siteId}
                className={`search-item${ordered && r.best ? ' is-best' : ''}`}
                data-site-id={r.siteId}
                data-best={ordered && r.best ? 'true' : 'false'}
                data-rank={ordered && r.rank !== null ? r.rank : ''}
              >
                <div className="search-item-head">
                  <p className="search-item-name">
                    {ordered && r.rank !== null && <span className="mono search-rank">{r.rank}</span>}
                    <span>{c.site.name}</span>
                    {ordered && r.best && <span className="search-best">Best</span>}
                  </p>
                  {poi ? (
                    <button type="button" className="link" onClick={() => p.onShowPoi(poi, groups)}>
                      Show
                    </button>
                  ) : (
                    <button type="button" className="link" onClick={() => p.onSelectSite(r.siteId, groups)}>
                      Select
                    </button>
                  )}
                </div>
                {poi && <p className="search-item-sub">{groupInfo(poi.group).label} point</p>}
                <p className="search-item-facts">
                  {chosenGroups.map((g) => (
                    <span key={g.id} className="search-count" data-group={g.id} title={`${g.label} within ${radiusKm} km`}>
                      <span className="poi-swatch" style={{ background: g.color }} aria-hidden="true" />
                      <span className="sr-only">{g.label}: </span>
                      <span className="mono">{r.counts[g.id] ?? 0}</span>
                    </span>
                  ))}
                  <span className="search-num" data-col="lit">
                    Sunlit <span className="mono">{value(r.litPct)}</span>
                  </span>
                  <span className="search-num" data-col="comms">
                    Coverage <span className="mono">{value(r.coveragePct)}</span>
                  </span>
                  <span className="search-num" data-col="slope">
                    Slope{' '}
                    <span className="mono">{r.slopeDeg === null ? 'unknown' : fmtDeg(r.slopeDeg)}</span>
                    {r.slope === 'fail' && ' — too steep'}
                  </span>
                </p>
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
