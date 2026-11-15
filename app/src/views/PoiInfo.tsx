// The info box of a point of interest (U3): every line is a field of its pois.json record (scripts/pois.py copies
// them from docs/POIs), plus the caveat those files carry. Placement and open/close behaviour: SceneView.
import type { PointerEventHandler, Ref } from 'react'
import type { Poi } from '../data/pois'
import { fmtCoords } from './format'
import { groupInfo } from './poiLayer'

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return u
  }
}

interface Props {
  poi: Poi
  pinned: boolean
  boxRef: Ref<HTMLElement>
  onClose(): void
  onPointerEnter: PointerEventHandler
  onPointerLeave: PointerEventHandler
}

export function PoiInfo({ poi, pinned, boxRef, onClose, onPointerEnter, onPointerLeave }: Props) {
  const g = groupInfo(poi.group)
  return (
    <aside
      ref={boxRef}
      className="poi-info"
      aria-label={poi.name}
      data-testid="poi-info"
      data-poi-id={poi.id}
      data-pinned={pinned ? 'true' : 'false'}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="poi-info-head">
        <p className="poi-info-group">
          <span className="poi-swatch" style={{ background: g.color }} aria-hidden="true" />
          {g.label} · <span className="mono">{fmtCoords(poi.lat, poi.lon)}</span>
        </p>
        {pinned && (
          <button type="button" className="link poi-info-close" onClick={onClose}>
            Close
          </button>
        )}
      </div>
      <h3 className="poi-info-name">{poi.name}</h3>
      {poi.summary && <p className="poi-info-summary">{poi.summary}</p>}
      {poi.facts.length > 0 && (
        <dl className="poi-facts">
          {poi.facts.map((f, i) => (
            <div key={i} className="poi-fact">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {poi.evidence && (
        <p className="poi-info-line">
          <span className="poi-info-key">Evidence</span> {poi.evidence}
        </p>
      )}
      {poi.limitations && (
        <p className="poi-info-line">
          <span className="poi-info-key">Limitations</span> {poi.limitations}
        </p>
      )}
      <p className="poi-info-line poi-info-caveat">
        From research notes, not validated by the science lead.{poi.group === 'landing' && ' The coordinates still need a check.'}
      </p>
      <p className="poi-info-line poi-info-sources">
        <span className="poi-info-key">{poi.sources.length === 1 ? 'Source' : 'Sources'}</span>{' '}
        {poi.sources.map((u, i) => (
          <span key={u}>
            {i > 0 && ', '}
            <a href={u} target="_blank" rel="noreferrer">
              {host(u)}
            </a>
          </span>
        ))}
      </p>
      {!pinned && <p className="poi-info-hint">Click the pin to keep this open.</p>}
    </aside>
  )
}
