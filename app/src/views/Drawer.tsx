// Details drawer: finder, year timeline, horizon strip, station states (chosen in the Mission panel), comparison,
// site potential, export, how this is computed and the terms of use. Opened from the header's Details control or the
// footer link. The Full data switch (top right, U8) adds method, raw values and sources to the summary.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Sample, ScienceGoal, StationLos } from '../geometry'
import type { MissionState } from '../missions'
import type { ResultsState } from '../data/results'
import type { Period, Site, SitePotential, Station } from '../data/types'
import { NOT_VALIDATED, VALIDATED } from '../data/validation'
import type { DrawerSection } from '../state'
import { Compare } from './Compare'
import { Finder } from './Finder'
import { HorizonStrip } from './HorizonStrip'
import { SiteTable } from './SiteTable'
import { Terms } from './Terms'
import { YearTimeline } from './Timeline'
import type { YearRow } from './Timeline'
import { resolvePeriod } from './period'
import { yearOf } from './yearBars'
import { capital, fmtDateTime, fmtDeg } from './format'
import { customTerrain } from '../data/customSite'
import type { CapHorizon } from '../data/southcap'
import { approxText } from './custom'
import { useFullData } from './advanced'
import { FullDataSwitch } from './FullDataSwitch'

export interface ViewPeriod {
  id: string // period id or 'custom'
  label: string
  startMs: number
  endMs: number
}

interface Props {
  section: DrawerSection
  site: Site
  customHorizon: CapHorizon | null // a custom site's capHorizon result, once computed (null for a prepared site)
  period: ViewPeriod
  cursorMs: number
  sites: Site[]
  periods: Period[]
  stations: Station[]
  ids: string[]
  results: ResultsState
  atCursor: Sample | null // series sample at the cursor
  onChooseStations(): void // opens the Mission panel at its station checklist (one checklist, not two)
  onShowWindow(startMs: number, days: number, landingMs: number): void
  onSwitch(siteId: string, periodId: string): void
  goal: ScienceGoal // the mission's science goal: the order "Find better location" uses
  missions: MissionState[] // saved missions, shown as rows of the table
  onFindDates(siteId: string): void // "Find better dates" on a table row: that site, at the finder
  onCalculateFlight(m: MissionState): void // "Calculate flight" on a saved mission row
  onClose(): void
}

// Whole-year mode of the table. Measured before shipping (14 Nov 2026, this build in Chromium on ninja's Mac):
// one site for 365 days (17 520 samples) took 198 ms, all 18 sites 3.2 s; the limit set for shipping was 20 s.
const WHOLE_YEAR = true

const CATEGORY: Record<SitePotential['category'], string> = {
  'water-ice': 'Water ice',
  'cold-trap': 'Cold trap',
  illumination: 'Illumination',
  science: 'Science',
  other: 'Other',
}

function losText(l: StationLos | undefined): string {
  if (!l) return 'unknown'
  if (l.state === 'los') return 'line of sight'
  if (l.reason === 'terrain') return 'blocked by terrain'
  if (l.reason === 'station-mask') return 'Moon below station mask'
  return 'blocked'
}

function csv(site: Site, period: ViewPeriod, r: ResultsState, approx: string | null): string {
  if (r.status !== 'ready') return ''
  const { sun, comms, summary } = r.results
  const src = (VALIDATED ? 'computed' : `computed, ${NOT_VALIDATED}`) + (approx ? `; ${approx}` : '')
  const iso = (ms: number) => new Date(ms).toISOString()
  const lines = [
    `# ${site.name}; ${iso(period.startMs)} to ${iso(period.endMs)}; values: ${src}`,
    'track,state,start_utc,end_utc,duration_h',
    ...[...sun, ...comms].map((w) => `${w.kind},${w.state},${iso(w.startMs)},${iso(w.endMs)},${((w.endMs - w.startMs) / 3_600_000).toFixed(2)}`),
    '',
    'metric,value',
    `sunlit_pct,${summary.litPct.toFixed(2)}`,
    `station_coverage_pct,${summary.coveragePct.toFixed(2)}`,
    `unknown_pct,${summary.unknownPct.toFixed(2)}`,
    `earth_visible_pct,${summary.earthVisiblePct.toFixed(2)}`,
    `longest_darkness_h,${summary.longestDarkH.toFixed(2)}`,
    `longest_coverage_gap_h,${summary.longestGapH.toFixed(2)}`,
  ]
  return lines.join('\n') + '\n'
}

export function Drawer(p: Props) {
  const { section, site, period, results, atCursor } = p
  const panel = useRef<HTMLElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const finderRef = useRef<HTMLElement>(null)
  const sourcesRef = useRef<HTMLElement>(null)
  const termsRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [terms, setTerms] = useState(false)
  // Summary (default) shows the decision values; Full data (U8, one global setting) adds method, raw values and
  // sources. "How this is computed" also shows when the footer link asked for it.
  const [full] = useFullData()
  const method = full || section === 'sources'
  const custom = site.group === 'custom'
  const approx = p.customHorizon ? approxText(p.customHorizon.computed) : null
  // A custom site's 3D terrain: which cap raster its grid was sampled from (capTerrain, shared with the scene).
  const [mesh, setMesh] = useState<{ id: string; res: number } | null>(null)
  useEffect(() => {
    if (!custom) return
    let alive = true
    customTerrain(site.id).then(
      (t) => alive && t && setMesh({ id: site.id, res: t.meta.cap.source_res_m }),
      () => undefined,
    )
    return () => {
      alive = false
    }
  }, [custom, site.id])
  const meshRes = mesh && mesh.id === site.id ? mesh.res : null

  // The year timeline: the current site first, then each saved mission's site once, with the missions' dates.
  const yearRows: YearRow[] = useMemo(() => {
    const rows: YearRow[] = [{ site, missions: [{ name: 'Current mission', startMs: period.startMs, endMs: period.endMs }] }]
    for (const m of p.missions) {
      const s = m.site === site.id ? site : p.sites.find((x) => x.id === m.site)
      if (!s) continue // a saved custom site that is not the current one: its terrain is computed only when chosen
      let row = rows.find((r) => r.site.id === s.id)
      if (!row) rows.push((row = { site: s, missions: [] }))
      const span = resolvePeriod(m, p.periods)
      row.missions.push({ name: m.name ?? 'Saved mission', startMs: span.startMs, endMs: span.endMs })
    }
    return rows
  }, [site, period.startMs, period.endMs, p.missions, p.sites, p.periods])

  useEffect(() => {
    closeBtn.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    const target = section === 'finder' ? finderRef.current : section === 'sources' ? sourcesRef.current : null
    if (target) target.scrollIntoView({ block: 'start' })
    else panel.current?.scrollTo({ top: 0 })
  }, [section])
  useEffect(() => {
    if (terms) termsRef.current?.scrollIntoView({ block: 'start' })
  }, [terms])

  const download = () => {
    const blob = new Blob([csv(site, period, results, approx)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    // a custom site id ("cap:-85.50000,12.25000") has characters a file name cannot hold
    a.download = `${site.id.replace(/[^a-z0-9.-]+/gi, '_')}_${new Date(period.startMs).toISOString().slice(0, 10)}.csv`
    // Firefox and Safari need the link in the document, and revoking the URL right after click() can cancel
    // the download there: revoke it a moment later.
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied('Link copied.')
    } catch {
      setCopied('Copy the address bar to share this view.')
    }
  }

  const ready = results.status === 'ready'
  const horizonFile = ready ? results.results.series.horizon : null
  const truncated = ready && results.results.series.horizon && results.results.series.horizon.truncated.length > 0 && (
    <>
      {' '}
      <strong data-testid="truncated-note">
        At this site the model ends before {results.results.series.horizon.ray_max_km} km in {results.results.series.horizon.truncated.length} of{' '}
        {results.results.series.horizon.mask.length} directions, so distant terrain there is missing and
        sunlight and Earth visibility in those directions may be overstated.
      </strong>
    </>
  )

  return (
    <aside
      ref={panel}
      className="drawer"
      role="dialog"
      aria-labelledby="drawer-title"
      data-testid="drawer"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          p.onClose()
        }
      }}
    >
      <header className="drawer-head">
        <div>
          <h2 id="drawer-title" className="drawer-title">
            {site.name}
          </h2>
          <p className="quiet">
            {period.label} · {fmtDateTime(p.cursorMs)}
          </p>
        </div>
        <div className="drawer-tools">
          <FullDataSwitch />
          <button ref={closeBtn} className="btn" type="button" onClick={p.onClose}>
            Close
          </button>
        </div>
      </header>

      {!VALIDATED && <p className="msg sample-note">{capital(NOT_VALIDATED)}.</p>}
      {approx && (
        <p className="msg" data-testid="drawer-approx-note">
          {approx}.
        </p>
      )}
      {results.status === 'empty' && <p className="msg">{results.message}</p>}
      {results.status === 'error' && <p className="msg is-error">{results.error}</p>}

      <section ref={finderRef} className="drawer-sec" aria-labelledby="sec-finder">
        <h3 id="sec-finder">Find better dates</h3>
        {/* keyed: a site, station or period change starts a fresh finder, so old results never show under a new site */}
        <Finder
          key={`${site.id}|${p.ids.join(',')}|${period.startMs}`}
          site={site}
          stations={p.stations}
          ids={p.ids}
          fromMs={period.startMs}
          onShow={p.onShowWindow}
        />
      </section>

      <section className="drawer-sec" aria-labelledby="sec-year">
        <h3 id="sec-year">Year timeline</h3>
        <YearTimeline rows={yearRows} stations={p.stations} ids={p.ids} initialYear={yearOf(period.startMs)} />
      </section>

      <section className="drawer-sec" aria-labelledby="sec-horizon">
        <h3 id="sec-horizon">Horizon</h3>
        <HorizonStrip
          horizon={ready ? results.results.series.horizon : null}
          sample={ready ? atCursor : null}
          track={ready ? results.results.series.samples : null}
          height={168}
        />
      </section>

      <section className="drawer-sec" aria-labelledby="sec-stations">
        <h3 id="sec-stations">Stations</h3>
        {full && (
          <p className="quiet">
            Comms means geometric line of sight between the site and at least one selected station, not a guaranteed radio
            link. Schedules, equipment and weather are unknown.
          </p>
        )}
        <table className="tbl stations">
          <thead>
            <tr>
              <th scope="col">Station</th>
              <th scope="col">State</th>
              {full && <th scope="col">Elev. from site</th>}
              {full && <th scope="col">Moon elev. at station</th>}
            </tr>
          </thead>
          <tbody>
            {p.stations
              .filter((s) => p.ids.includes(s.id))
              .map((s) => {
                const l = atCursor?.stations[s.id]
                return (
                  <tr key={s.id}>
                    <td>
                      {s.complex}
                      <span className="th-sub">
                        {s.name} · {s.network}
                      </span>
                    </td>
                    <td>{ready ? losText(l) : '…'}</td>
                    {full && <td className="mono">{ready && l ? fmtDeg(l.el) : '…'}</td>}
                    {full && <td className="mono">{ready && l ? fmtDeg(l.moonElAtStation) : '…'}</td>}
                  </tr>
                )
              })}
          </tbody>
        </table>
        <p className="quiet drawer-note">
          {p.ids.length} of {p.stations.length} stations selected.{' '}
          <button type="button" className="link" onClick={p.onChooseStations}>
            Choose ground stations
          </button>
        </p>
      </section>

      <section className="drawer-sec" aria-labelledby="sec-compare">
        <h3 id="sec-compare">Compare</h3>
        <Compare
          key={`${site.id}|${period.id}`}
          site={site}
          periodId={period.id}
          periodLabel={period.label}
          sites={p.sites}
          periods={p.periods}
          stations={p.stations}
          ids={p.ids}
          current={results}
          onSwitch={p.onSwitch}
        />
      </section>

      <section className="drawer-sec" aria-labelledby="sec-table">
        <h3 id="sec-table">All sites</h3>
        <SiteTable
          key={`${site.id}|${period.startMs}|${period.endMs}`}
          sites={p.sites}
          periods={p.periods}
          stations={p.stations}
          ids={p.ids}
          site={site}
          period={period}
          goal={p.goal}
          missions={p.missions}
          wholeYear={WHOLE_YEAR}
          onCalculateFlight={p.onCalculateFlight}
          onFindDates={(id) => {
            p.onFindDates(id)
            finderRef.current?.scrollIntoView({ block: 'start' })
          }}
        />
      </section>

      <section className="drawer-sec" aria-labelledby="sec-potential">
        <h3 id="sec-potential">Site potential</h3>
        {site.potential.length === 0 && <p className="quiet">No sourced site potential for this site yet.</p>}
        <ul className="plain potential">
          {site.potential.map((x, i) => (
            <li key={i}>
              <span className="th-sub">{CATEGORY[x.category]}</span>
              <p>{x.text}</p>
              {full && (
                <p className="quiet">
                  Evidence: {x.evidence}. Access not assessed.{' '}
                  {x.source_url && (
                    <a href={x.source_url} target="_blank" rel="noreferrer">
                      Source
                    </a>
                  )}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="drawer-sec" aria-labelledby="sec-export">
        <h3 id="sec-export">Export</h3>
        <div className="row">
          <button className="btn" type="button" disabled={!ready} onClick={download}>
            Download CSV
          </button>
          <button className="btn" type="button" onClick={copyLink}>
            Copy link
          </button>
          {copied && (
            <span className="quiet" role="status">
              {copied}
            </span>
          )}
        </div>
      </section>

      <section ref={sourcesRef} className="drawer-sec" aria-labelledby={method ? 'sec-sources' : undefined}>
        {method && (
          <>
            <h3 id="sec-sources">How this is computed</h3>
            <ul className="plain sources">
              <li>
                Site: {site.source_url ? <a href={site.source_url} target="_blank" rel="noreferrer">{site.source_label}</a> : site.source_label}.
                Frame: {site.frame_note}.
              </li>
              {custom ? (
                // A custom site: every spacing and distance from the capHorizon record and the terrain's meta.cap.
                <li data-testid="custom-terrain">
                  Terrain: box means of the LOLA south-pole elevation model (
                  <a href="https://doi.org/10.3847/PSJ/acf3e1" target="_blank" rel="noreferrer">
                    Barker et al. 2023
                  </a>
                  ,{' '}
                  <a href="https://doi.org/10.60903/gsfcpgda-lola-spole" target="_blank" rel="noreferrer">
                    data
                  </a>
                  ), computed in this browser for the chosen place
                  {p.customHorizon ? (
                    <>
                      : {p.customHorizon.computed.site_res_m} m at the site, up to {p.customHorizon.computed.near_res_m} m within{' '}
                      {p.customHorizon.computed.rings.nearKm} km and {p.customHorizon.computed.far_res_m} m beyond
                      {p.customHorizon.computed.outer_res_m !== null &&
                        `; where the horizon reaches past the edge of the 20 m model, ${p.customHorizon.computed.outer_res_m} m means of the 120 m model continue it`}
                      {meshRes !== null && `; the 3D scene's terrain is sampled from the ${meshRes} m data`}. The horizon is searched up
                      to {p.customHorizon.ray_max_km} km in each direction for an eye {p.customHorizon.observer_height_m} m above the
                      ground. {approx}.
                    </>
                  ) : (
                    '.'
                  )}
                  {truncated}
                </li>
              ) : (
                <li>
                  {/* Figures checked against scripts/horizon.py (NEAR_KM, FAR_RES_M, N_AZ, fill DEM) and
                      scripts/terrain_tiles.py (LEVELS); ray length and eye height come from the site's horizon file. */}
                  Terrain: LOLA south-pole elevation model, 20 m per pixel within 20 km of the site and 160 m averages
                  beyond (
                  <a href="https://doi.org/10.3847/PSJ/acf3e1" target="_blank" rel="noreferrer">
                    Barker et al. 2023
                  </a>
                  ,{' '}
                  <a href="https://doi.org/10.60903/gsfcpgda-lola-spole" target="_blank" rel="noreferrer">
                    data
                  </a>
                  ). The horizon is searched in 720 directions up to {horizonFile?.ray_max_km ?? 300} km for an eye{' '}
                  {horizonFile?.observer_height_m ?? 1.75} m above the ground. Where that reaches past the edge of the 20 m
                  model (about 80° S), a 120 m model from the same data set continues it. The 3D scene draws the terrain at
                  20 m within 2.5 km of the site, 80 m within 20 km, then 400 m and 2 km means out to 300 km.
                  {truncated}
                </li>
              )}
              <li>
                Sun and Earth: JPL DE440 ephemeris (
                <a href="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/" target="_blank" rel="noreferrer">
                  NAIF
                </a>
                ), Moon body-fixed frame MOON_ME, every 30 minutes, UTC. Sunlit and contact windows start and end where
                interpolation finds the change, to within about 10 seconds.
              </li>
              <li>
                Comms: line of sight at both ends. The station must be above the terrain seen from the site, and the Moon above the
                station's elevation mask. A gap means no selected station has line of sight. Unknown means an input is missing.
              </li>
              <li data-testid="views-note">
                Views: walking, zooming and the viewpoints in the View menu move the camera only. The site, the dates, the
                Sun and Earth labels and the answer always describe the landing site.
              </li>
            </ul>
          </>
        )}
        <p className="quiet drawer-note">
          <button type="button" className="link" aria-expanded={terms} aria-controls="terms" onClick={() => setTerms((t) => !t)}>
            Terms of use
          </button>
        </p>
      </section>

      {terms && <Terms ref={termsRef} />}
    </aside>
  )
}
