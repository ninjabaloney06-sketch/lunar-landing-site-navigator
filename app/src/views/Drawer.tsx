// Details drawer: horizon strip, stations, finder, comparison, site potential, export, and how this is
// computed. Opened from the answer sentence, "Find better dates" or the footer link.
import { useEffect, useRef, useState } from 'react'
import type { Sample, StationLos } from '../geometry'
import type { ResultsState } from '../data/results'
import type { Period, Site, SitePotential, Station } from '../data/types'
import type { DrawerSection } from '../state'
import { Compare } from './Compare'
import { Finder } from './Finder'
import { HorizonStrip } from './HorizonStrip'
import { fmtDateTime, fmtDeg } from './format'

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
  sample: Sample | null
  isSample: boolean
  onToggleStation(id: string): void
  onShowWindow(startMs: number, days: number, landingMs: number): void
  onSwitch(siteId: string, periodId: string): void
  onClose(): void
}

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

function csv(site: Site, period: ViewPeriod, r: ResultsState, isSample: boolean): string {
  if (r.status !== 'ready') return ''
  const { sun, comms, summary } = r.results
  const src = r.results.source === 'sample' ? 'sample (fake)' : isSample ? 'computed, not yet validated' : 'computed'
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
  const { section, site, period, results, sample, isSample } = p
  const panel = useRef<HTMLElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const finderRef = useRef<HTMLElement>(null)
  const sourcesRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    closeBtn.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    const target = section === 'finder' ? finderRef.current : section === 'sources' ? sourcesRef.current : null
    if (target) target.scrollIntoView({ block: 'start' })
    else panel.current?.scrollTo({ top: 0 })
  }, [section])

  const download = () => {
    const blob = new Blob([csv(site, period, results, isSample)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${site.id}_${new Date(period.startMs).toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
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
            {period.label} · cursor {fmtDateTime(p.cursorMs)}
          </p>
        </div>
        <button ref={closeBtn} className="btn" type="button" onClick={p.onClose}>
          Close
        </button>
      </header>

      {isSample && <p className="msg sample-note">Sample values: the numbers in this view are not validated yet.</p>}

      <section className="drawer-sec" aria-labelledby="sec-horizon">
        <h3 id="sec-horizon">Horizon</h3>
        <HorizonStrip horizon={ready ? results.results.series.horizon : null} sample={ready ? sample : null} height={168} />
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
              <th scope="col">Now</th>
              <th scope="col">Elev. from site</th>
              <th scope="col">Moon elev. at station</th>
            </tr>
          </thead>
          <tbody>
            {p.stations.map((s) => {
              const on = p.ids.includes(s.id)
              const l = sample?.stations[s.id]
              return (
                <tr key={s.id}>
                  <td>
                    <label className="check">
                      <input type="checkbox" checked={on} disabled={on && p.ids.length === 1} onChange={() => p.onToggleStation(s.id)} />
                      <span>
                        {s.name}
                        <span className="th-sub">{s.network}</span>
                      </span>
                    </label>
                  </td>
                  <td>{ready ? losText(l) : '…'}</td>
                  <td className="mono">{ready && l ? fmtDeg(l.el) : '…'}</td>
                  <td className="mono">{ready && l ? fmtDeg(l.moonElAtStation) : '…'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {p.ids.length === 1 && <p className="quiet">At least one station stays selected.</p>}
      </section>

      <section ref={finderRef} className="drawer-sec" aria-labelledby="sec-finder">
        <h3 id="sec-finder">Find better dates</h3>
        <Finder site={site} stations={p.stations} ids={p.ids} fromMs={period.startMs} sample={isSample} onShow={p.onShowWindow} />
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
          sample={isSample}
          onSwitch={p.onSwitch}
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
            Terrain: LOLA south-pole elevation model, 20 m per pixel (
            <a href="https://doi.org/10.3847/PSJ/acf3e1" target="_blank" rel="noreferrer">
              Barker et al. 2023
            </a>
            ,{' '}
            <a href="https://doi.org/10.60903/gsfcpgda-lola-spole" target="_blank" rel="noreferrer">
              data
            </a>
            ). The horizon is searched up to 300 km in every direction for an eye 1.75 m above the ground.
          </li>
          <li>
            Sun and Earth: JPL DE440 ephemeris (
            <a href="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/" target="_blank" rel="noreferrer">
              NAIF
            </a>
            ), Moon body-fixed frame MOON_ME, every 30 minutes, UTC.
          </li>
          <li>
            Comms: line of sight at both ends. The station must be above the terrain seen from the site, and the Moon above the
            station's elevation mask. A gap means no selected station has line of sight. Unknown means an input is missing.
          </li>
          {ready && results.results.source === 'sample' && <li>This build shows invented sample values in place of computed ones.</li>}
        </ul>
      </section>
    </aside>
  )
}
