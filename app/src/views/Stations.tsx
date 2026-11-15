// Ground-station checklist: the one place stations are chosen (Mission panel). Every station is selected by
// default; at least one stays selected. The details drawer shows their state and links here.
// Each row: complex, antenna, network and the minimum elevation the coverage uses (stations.json min_elev_deg,
// with its source on hover). Coverage is geometric line of sight, not a link budget (the caveat sits above the
// list in the Mission panel).
import type { Station } from '../data/types'
import { fmtDeg } from './format'

/** What the network codes in stations.json stand for. */
export const NETWORK_NAME: Record<Station['network'], string> = {
  DSN: 'NASA Deep Space Network',
  ESTRACK: 'ESA tracking station network',
  JAXA: 'Japan Aerospace Exploration Agency',
}

/** The abbreviations inside the antenna names ("DSS-24 (34 m BWG)"), expanded for the hover. BWG = "Beam
 *  Waveguide" as written in DSN 810-005 module 301 (the source stations.json cites). That document uses DSS numbers
 *  as station identifiers without spelling DSS out, so the hover says only what it is used for. */
export function antennaTitle(name: string): string | undefined {
  const parts: string[] = []
  if (/\bDSS\b/.test(name)) parts.push("DSS number: the antenna's station number in the DSN documents")
  if (/\bBWG\b/.test(name)) parts.push('BWG: beam waveguide antenna')
  return parts.length ? parts.join('; ') : undefined
}

interface Props {
  stations: Station[]
  ids: string[]
  onToggle(id: string): void
}

export function StationChecklist({ stations, ids, onToggle }: Props) {
  return (
    <>
      <ul className="plain checklist" data-testid="station-checklist">
        {stations.map((s) => {
          const on = ids.includes(s.id)
          const last = on && ids.length === 1
          const title = antennaTitle(s.name)
          return (
            <li key={s.id} data-station={s.id}>
              <label className="check" title={last ? 'At least one station stays selected.' : undefined}>
                <input type="checkbox" checked={on} disabled={last} onChange={() => onToggle(s.id)} />
                <span>
                  {s.complex}
                  <span className="th-sub">
                    {title ? <abbr title={title}>{s.name}</abbr> : s.name} · <abbr title={NETWORK_NAME[s.network]}>{s.network}</abbr> ·{' '}
                    <span title={`Minimum elevation of the Moon above this station's horizon. Source: ${s.source_url}`}>
                      min. elevation <span className="mono">{fmtDeg(s.min_elev_deg)}</span>
                    </span>
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {/* The line-of-sight caveat ("not a guaranteed radio link") sits above the list in the Mission panel. */}
      <p className="quiet st-hint" data-testid="station-hint">
        Min. elevation: lowest Moon elevation above the station's horizon that counts.
      </p>
      {ids.length === 1 && <p className="quiet">At least one station stays selected.</p>}
    </>
  )
}
