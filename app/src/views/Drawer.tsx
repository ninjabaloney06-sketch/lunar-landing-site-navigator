// Details drawer: horizon strip, station states (chosen in the Mission panel), finder, comparison, site
// potential, export, how this is computed and the terms of use. Opened from the answer sentence, "Find better dates" or the
// footer link.
import { useEffect, useRef, useState } from 'react'
import type { Sample, ScienceGoal, StationLos } from '../geometry'
import type { MissionState } from '../missions'
import type { ResultsState } from '../data/results'
import type { Period, Site, SitePotential, Station } from '../data/types'
import { NOT_VALIDATED, VALIDATED } from '../data/validation'
import { TOP_VIEW } from '../scene3d'
import { SPEEDS_H_PER_S } from '../state'
import type { DrawerSection } from '../state'
import { Compare } from './Compare'
import { Finder } from './Finder'
import { HorizonStrip } from './HorizonStrip'
import { SiteTable } from './SiteTable'
import { Terms } from './Terms'
import { capital, fmtDateTime, fmtDeg } from './format'

export interface ViewPeriod {
  id: string // period id or 'custom'
  label: string
  startMs: number
  endMs: number
}

interface Props {
  section: DrawerSection
  site: Site
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
  speed: number // Simulate: hours of mission time per second
  onSpeed(hoursPerSecond: number): void
  onReset(): void // cursor back to the first mission step
  onClose(): void
}

// Whole-year mode of the table. Measured before shipping (14 Nov 2026, this build in Chromium on ninja's Mac):
// one site for 365 days (17 520 samples) took 198 ms, all 18 sites 3.2 s; the limit set for shipping was 20 s.
const WHOLE_YEAR = true

const speedLabel = (h: number) => (h % 24 === 0 ? `${h / 24} ${h === 24 ? 'day' : 'days'} per second` : `${h} hours per second`)

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

function csv(site: Site, period: ViewPeriod, r: ResultsState): string {
  if (r.status !== 'ready') return ''
  const { sun, comms, summary } = r.results
  const src = VALIDATED ? 'computed' : `computed, ${NOT_VALIDATED}`
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
    const blob = new Blob([csv(site, period, results)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${site.id}_${new Date(period.startMs).toISOString().slice(0, 10)}.csv`
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
        <button ref={closeBtn} className="btn" type="button" onClick={p.onClose}>
          Close
        </button>
      </header>

      {!VALIDATED && <p className="msg sample-note">{capital(NOT_VALIDATED)}.</p>}
      {results.status === 'empty' && <p className="msg">{results.message}</p>}
      {results.status === 'error' && <p className="msg is-error">{results.error}</p>}

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
        <p className="quiet">
          Comms means geometric line of sight between the site and at least one selected station, not a guaranteed radio
          link. Schedules, equipment and weather are unknown.
        </p>
        <table className="tbl stations">
          <thead>
            <tr>
              <th scope="col">Station</th>
              <th scope="col">State</th>
              <th scope="col">Elev. from site</th>
              <th scope="col">Moon elev. at station</th>
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
                    <td className="mono">{ready && l ? fmtDeg(l.el) : '…'}</td>
                    <td className="mono">{ready && l ? fmtDeg(l.moonElAtStation) : '…'}</td>
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
              <p className="quiet">
                Evidence: {x.evidence}. Access not assessed.{' '}
                {x.source_url && (
                  <a href={x.source_url} target="_blank" rel="noreferrer">
                    Source
                  </a>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="drawer-sec" aria-labelledby="sec-simulation">
        <h3 id="sec-simulation">Simulation</h3>
        <p className="quiet">Simulate, beside the timeline, plays the mission from the cursor to its last day. Space pauses.</p>
        <div className="row">
          <label className="row sim-speed">
            <span className="quiet">Speed</span>
            <select className="field" data-testid="speed" value={p.speed} onChange={(e) => p.onSpeed(Number(e.target.value))}>
              {SPEEDS_H_PER_S.map((h) => (
                <option key={h} value={h}>
                  {speedLabel(h)}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" type="button" onClick={p.onReset}>
            Reset to start
          </button>
        </div>
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

      <section ref={sourcesRef} className="drawer-sec" aria-labelledby="sec-sources">
        <h3 id="sec-sources">How this is computed</h3>
        <ul className="plain sources">
          <li>
            Site: {site.source_url ? <a href={site.source_url} target="_blank" rel="noreferrer">{site.source_label}</a> : site.source_label}.
            Frame: {site.frame_note}.
          </li>
          <li>
            Terrain: LOLA south-pole elevation model, 20 m per pixel within 20 km of the site and 160 m averages
            beyond; the 3D scene uses an 80 m mesh (
            <a href="https://doi.org/10.3847/PSJ/acf3e1" target="_blank" rel="noreferrer">
              Barker et al. 2023
            </a>
            ,{' '}
            <a href="https://doi.org/10.60903/gsfcpgda-lola-spole" target="_blank" rel="noreferrer">
              data
            </a>
            ). The horizon is searched up to 300 km in each direction for an eye 1.75 m above the ground. Where
            that reaches past the edge of the 20 m model (about 80° S), a 120 m model from the same data set
            continues it.
            {ready && results.results.series.horizon && results.results.series.horizon.truncated.length > 0 && (
              <>
                {' '}
                <strong data-testid="truncated-note">
                  At this site the model ends before 300 km in {results.results.series.horizon.truncated.length} of{' '}
                  {results.results.series.horizon.mask.length} directions, so distant terrain there is missing and
                  sunlight and Earth visibility in those directions may be overstated.
                </strong>
              </>
            )}
          </li>
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
            Sun and Earth labels and the answer always describe the landing site. Solar system — top view looks down the
            +z axis of the Moon body-fixed frame (MOON_ME), from above the Moon's north pole, with 0° longitude to the
            right. It is not to scale: the Earth is drawn {TOP_VIEW.dist.earth} and the Sun {TOP_VIEW.dist.sun} Moon
            radii from the Moon, and the sizes of the three are not in proportion. The directions from the Moon to the
            Earth and to the Sun are the computed ones.
          </li>
        </ul>
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
