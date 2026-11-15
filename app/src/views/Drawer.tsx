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
import { NasaToolsSection } from './NasaToolsSection'
import { HorizonStrip } from './HorizonStrip'
import { SiteAssessment } from './SiteAssessment'
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
import { PowerSection, powerCsvLines, type PowerInputs } from './PowerSection'

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
  power?: PowerInputs // power estimate inputs (link keys panel, eff, load, batt)
  onPower?(next: PowerInputs): void
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

// What each evidence kind of a site-potential record means, in a short plain phrase (U17). Never more than the
// record says: 'unknown' is the explicit entry for a site without site-specific evidence (data/types.ts).
export const EVIDENCE: Record<SitePotential['evidence'], string> = {
  'direct measurement': 'measured directly',
  'remote observation': 'seen in remote-sensing data',
  'modeled condition': 'from a model, not measured here',
  hypothesis: 'an interpretation, not confirmed',
  unknown: 'no site-specific data yet',
}

// Abbreviations in the drawer's own text and in the station names, with their long form for the hover (U17).
const ABBR: Record<string, string> = {
  DSN: 'Deep Space Network (NASA)',
  JAXA: 'Japan Aerospace Exploration Agency',
  DSS: 'Deep Space Station (antenna number)',
  BWG: 'beam waveguide antenna',
  UTC: 'Coordinated Universal Time',
  LOLA: 'Lunar Orbiter Laser Altimeter (LRO)',
  JPL: 'Jet Propulsion Laboratory',
  DE440: 'Development Ephemeris 440 (JPL)',
  NAIF: "Navigation and Ancillary Information Facility (JPL's SPICE data)",
  MOON_ME: 'Moon mean-Earth / polar-axis body-fixed frame',
  CSV: 'comma-separated values, opens in any spreadsheet',
}
const ABBR_RE = new RegExp(String.raw`\b(${Object.keys(ABBR).join('|')})\b`, 'g')

/** Text with each known abbreviation marked <abbr title="long form">. */
export function Marked({ text }: { text: string }) {
  const out: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(ABBR_RE)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(
      <abbr key={m.index} title={ABBR[m[1]]}>
        {m[1]}
      </abbr>,
    )
    last = m.index + m[0].length
  }
  out.push(text.slice(last))
  return <>{out}</>
}

/** The stations section's one line: how many selected stations have line of sight at the cursor. */
function stationLead(ls: (StationLos | undefined)[]): string {
  const n = ls.length
  if (n === 0) return 'No station selected.'
  const known = ls.filter((l): l is StationLos => !!l)
  if (known.length < n) return 'Station contact unknown: an input is missing.'
  const k = known.filter((l) => l.state === 'los').length
  return k === 0 ? `No line of sight to any of the ${n} selected stations now.` : `Line of sight to ${k} of ${n} selected ${n === 1 ? 'station' : 'stations'} now.`
}

function losText(l: StationLos | undefined): string {
  if (!l) return 'unknown'
  if (l.state === 'los') return 'line of sight'
  if (l.reason === 'terrain') return 'blocked by terrain'
  if (l.reason === 'station-mask') return 'Moon below station mask'
  return 'blocked'
}

function csv(site: Site, period: ViewPeriod, r: ResultsState, approx: string | null, power?: PowerInputs): string {
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
    ...powerCsvLines(r.results, power),
  ]
  return lines.join('\n') + '\n'
}

export function Drawer(p: Props) {
  const { section, site, period, results, atCursor } = p
  const panel = useRef<HTMLElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const finderRef = useRef<HTMLElement>(null)
  const sourcesRef = useRef<HTMLElement>(null)
  const tableRef = useRef<HTMLElement>(null)
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
    if (section === 'missions') {
      // "Compare" in the Mission panel: bring the saved missions into view. They are the table's second body, below
      // the listed sites, and the sections above grow while their results arrive, so place them again for a moment.
      const place = () => (tableRef.current?.querySelector('[data-testid="mission-rows"]') ?? tableRef.current)?.scrollIntoView({ block: 'center' })
      place()
      const timers = [150, 500, 1200, 2500].map((ms) => window.setTimeout(place, ms))
      return () => timers.forEach((t) => window.clearTimeout(t))
    }
    const target = section === 'finder' ? finderRef.current : section === 'sources' ? sourcesRef.current : null
    if (target) target.scrollIntoView({ block: 'start' })
    else panel.current?.scrollTo({ top: 0 })
  }, [section])
  useEffect(() => {
    if (terms) termsRef.current?.scrollIntoView({ block: 'start' })
  }, [terms])

  const download = () => {
    const blob = new Blob([csv(site, period, results, approx, p.power)], { type: 'text/csv' })
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
        {ready && atCursor && (
          <p className="quiet sec-lead" data-testid="horizon-lead">
            At {fmtDateTime(p.cursorMs)}: Sun {atCursor.sun.lit ? 'above' : 'below'} the terrain, Earth{' '}
            {atCursor.earth.visible ? 'above' : 'below'} it.
          </p>
        )}
        <HorizonStrip
          horizon={ready ? results.results.series.horizon : null}
          sample={ready ? atCursor : null}
          track={ready ? results.results.series.samples : null}
          height={168}
        />
      </section>

      <section className="drawer-sec" aria-labelledby="sec-stations">
        <h3 id="sec-stations">Stations</h3>
        {ready && atCursor && (
          <p className="quiet sec-lead" data-testid="stations-lead">
            {stationLead(p.ids.map((id) => atCursor.stations[id]))}
          </p>
        )}
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
              {full && (
                <th scope="col" title="The station's elevation above the site's horizon plane">
                  Station elevation at site
                </th>
              )}
              {full && (
                <th scope="col" title="The site's elevation above the station's horizon; the station mask must be cleared">
                  Moon elevation at station
                </th>
              )}
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
                        <Marked text={`${s.name} · ${s.network}`} />
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

      <section ref={tableRef} className="drawer-sec" aria-labelledby="sec-table">
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
            <li key={i} data-testid="potential-item">
              <p className="potential-head">
                <span className="potential-cat">{CATEGORY[x.category]}</span>{' '}
                <span className="quiet" data-testid="potential-evidence">
                  · {EVIDENCE[x.evidence]}
                </span>
              </p>
              {full ? (
                <p>
                  {x.text}{' '}
                  {x.source_url && (
                    <a href={x.source_url} target="_blank" rel="noreferrer">
                      Source
                    </a>
                  )}
                </p>
              ) : (
                <details className="more">
                  <summary>What the source says</summary>
                  <p>{x.text}</p>
                </details>
              )}
            </li>
          ))}
        </ul>
      </section>

      <SiteAssessment key={site.id} site={site} />
      <PowerSection results={results} custom={custom} approx={approx} inputs={p.power} onChange={p.onPower} />
      <section className="drawer-sec" aria-labelledby="sec-nasa"><h3 id="sec-nasa">Open in NASA tools</h3><NasaToolsSection site={site} customHorizon={p.customHorizon} period={period} results={results} /></section>

      <section className="drawer-sec" aria-labelledby="sec-export">
        <h3 id="sec-export">Export</h3>
        <p className="quiet sec-lead">
          <Marked text="CSV: every sunlit and contact window of this period, plus its summary values." />
        </p>
        <div className="row">
          <button className="btn" type="button" disabled={!ready} title={ready ? undefined : 'Available once the results are computed'} onClick={download}>
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
        {method && !full && (
          // Summary mode, opened from the footer link: the method in short bullets; Full data shows the full text.
          <>
            <h3 id="sec-sources">How this is computed</h3>
            <ul className="sources" data-testid="method-short">
              <li>
                Terrain: <abbr title={ABBR.LOLA}>LOLA</abbr> south-pole elevation model (
                <a href="https://doi.org/10.3847/PSJ/acf3e1" target="_blank" rel="noreferrer">
                  Barker et al. 2023
                </a>
                ).
              </li>
              <li>
                Horizon: 720 directions, up to {p.customHorizon?.ray_max_km ?? horizonFile?.ray_max_km ?? 300} km, eye{' '}
                {p.customHorizon?.observer_height_m ?? horizonFile?.observer_height_m ?? 1.75} m above ground.
              </li>
              <li>
                Sun and Earth: <abbr title={ABBR.JPL}>JPL</abbr> <abbr title={ABBR.DE440}>DE440</abbr> ephemeris, every 30
                minutes, <abbr title={ABBR.UTC}>UTC</abbr>.
              </li>
              <li>Comms: geometric line of sight at both ends, not a guaranteed radio link.</li>
              <li data-testid="views-note">Views move the camera only; every value describes the landing site.</li>
            </ul>
            {approx && <p className="quiet">{approx}.</p>}
            {truncated && <p className="quiet">{truncated}</p>}
            <p className="quiet">Turn on Full data for resolutions, frames and sources.</p>
          </>
        )}
        {full && (
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
                  {/* Figures checked against scripts/horizon.py (NEAR_KM, FAR_RES_M, N_AZ, fill DEM; its docstring: the
                      20 m DEM "is a 608 km square around the pole", the fill DEM covers 60-90 S) and
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
                  model (a square about 608 km across, centred on the pole), the 120 m model of the same data set, which
                  reaches 60° S, continues it. The 3D scene draws the terrain at
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
