// "Open in NASA tools" (add-on Task 3): the selected site in Moon Trek and LROC QuickMap, and JPL Horizons' Sun and
// Earth tables for the site over the mission dates. URLs from nasaTools.ts; the claim line from validationClaim.ts.
// A custom site works the same way: the links are only its coordinates.
import type { ResultsState } from '../data/results'
import type { CapHorizon } from '../data/southcap'
import type { Site } from '../data/types'
import { fmtCoords, fmtDateTime, fmtDeg, fmtRange } from './format'
import { nasaLinks, type Span, type ToolLink } from './nasaTools'
import { OTHER_CHECKS, RECORD_HREF, RECORD_LABEL, V1_CLAIM } from './validationClaim'
import '../styles/nasa-tools.css'

interface Props {
  site: Site
  customHorizon: CapHorizon | null // a custom site's terrain height comes from here once computed
  period: Span | null // the mission dates; null → no Horizons link
  results: ResultsState
}

function Out({ link, children, testId }: { link: ToolLink; children: string; testId: string }) {
  if (!link.href) return <span className="nt-off">{children}</span>
  return (
    <a href={link.href} target="_blank" rel="noopener noreferrer" data-testid={testId}>
      {children}
    </a>
  )
}

export function NasaToolsSection({ site, customHorizon, period, results }: Props) {
  const custom = site.group === 'custom'
  const elev_m = custom ? (customHorizon?.elev_m ?? null) : site.elev_m
  const links = nasaLinks({ lat: site.lat, lon: site.lon, elev_m }, period)
  const where = fmtCoords(site.lat, site.lon)
  // Our first value, to read against the first row of the Horizons table: the series' first sample sits at the
  // period start, which is also the table's first row (the start is a whole minute).
  const first = results.status === 'ready' && period ? results.results.series.samples[0] : undefined
  const firstOk = first && Math.abs(first.utcMs - period!.startMs) < 1000 ? first : undefined

  return (
    <div className="nasa-tools" data-testid="nasa-tools">
      <ul className="plain nt-list">
        <li>
          <Out link={links.moonTrek} testId="nt-moontrek">
            NASA Moon Trek
          </Out>
          <span className="quiet"> — {links.moonTrek.note ?? `${links.moonTrek.view}, centred on ${where}`}</span>
        </li>
        <li>
          <Out link={links.quickMap} testId="nt-quickmap">
            LROC QuickMap
          </Out>
          <span className="quiet"> — {links.quickMap.note ?? `${links.quickMap.view}, centred on ${where}`}</span>
        </li>
        <li>
          JPL Horizons:{' '}
          <Out link={links.horizonsSun} testId="nt-horizons-sun">
            Sun table
          </Out>
          {' · '}
          <Out link={links.horizonsEarth} testId="nt-horizons-earth">
            Earth table
          </Out>
          {links.horizonsSun.href && period ? (
            <p className="quiet nt-detail">
              Apparent azimuth and elevation seen from this point, every 6 hours, {fmtRange(period.startMs, period.endMs)},
              UTC; no refraction, no terrain.
              {custom && !customHorizon && ' The terrain height is not computed yet, so the point sits on the reference sphere.'}
              {firstOk && (
                <>
                  {' '}
                  First row, this app: Sun azimuth{' '}
                  <span className="mono" data-testid="nt-our-sun" data-az={firstOk.sun.az} data-el={firstOk.sun.el} data-utc={firstOk.utcMs}>
                    {fmtDeg(firstOk.sun.az, 2)}
                  </span>
                  , elevation <span className="mono">{fmtDeg(firstOk.sun.el, 2)}</span> at {fmtDateTime(firstOk.utcMs)}.
                </>
              )}
            </p>
          ) : (
            <p className="quiet nt-detail" data-testid="nt-horizons-off">
              {links.horizonsSun.note}
            </p>
          )}
        </li>
      </ul>
      <p className="quiet nt-claim" data-testid="nt-claim">
        {V1_CLAIM}; {OTHER_CHECKS}:{' '}
        <a href={RECORD_HREF} target="_blank" rel="noopener noreferrer">
          {RECORD_LABEL}
        </a>
        .
      </p>
    </div>
  )
}
