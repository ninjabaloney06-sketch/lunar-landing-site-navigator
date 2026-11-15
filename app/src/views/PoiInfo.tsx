// The info card of a point of interest (U3, U8). Two modes, chosen by the global "Full data" switch in its top-right
// corner (views/advanced.ts):
// - summary (default): name, plain feature type, the record's plain bullets (docs/POIs/plain.json, every fact from
//   the record) and the distance from the current landing site, computed here;
// - full data: the whole record, cleaned (poiLayer.cleanText): coordinates as "84.90° S, 35.50° W", rows with no
//   value hidden, evidence grades explained, no internal file names, source links at the bottom.
// Placement and open/close behaviour: SceneView.
import type { PointerEventHandler, Ref } from 'react'
import type { Poi } from '../data/pois'
import { useFullData } from './advanced'
import { FullDataSwitch } from './FullDataSwitch'
import { cleanText, distanceText, evidenceText, fmtLatLon, fullFacts, groupInfo, sourceHost } from './poiLayer'

interface Props {
  poi: Poi
  pinned: boolean
  boxRef: Ref<HTMLElement>
  from?: { name: string; lat: number; lon: number } | null // the current landing site, for the distance bullet
  onClose(): void
  onPointerEnter: PointerEventHandler
  onPointerLeave: PointerEventHandler
}

export function PoiInfo({ poi, pinned, boxRef, from, onClose, onPointerEnter, onPointerLeave }: Props) {
  const [full] = useFullData()
  const g = groupInfo(poi.group)
  const type = poi.plain?.type ?? g.label
  return (
    <aside
      ref={boxRef}
      className="poi-info"
      aria-label={poi.name}
      data-testid="poi-info"
      data-poi-id={poi.id}
      data-pinned={pinned ? 'true' : 'false'}
      data-mode={full ? 'full' : 'summary'}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="poi-info-head">
        <p className="poi-info-group" data-testid="poi-type">
          <span className="poi-swatch" style={{ background: g.color }} aria-hidden="true" />
          {type}
        </p>
        <div className="poi-info-tools">
          <FullDataSwitch />
          {pinned && (
            <button type="button" className="link poi-info-close" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
      <h3 className="poi-info-name">{poi.name}</h3>
      {full ? <FullBody poi={poi} /> : <SummaryBody poi={poi} from={from ?? null} />}
    </aside>
  )
}

function SummaryBody({ poi, from }: { poi: Poi; from: { name: string; lat: number; lon: number } | null }) {
  // Without a plain text (plain.json missing) the record's own summary, cleaned, stands in.
  const bullets = poi.plain ? poi.plain.bullets : [cleanText(poi.summary)].filter(Boolean)
  if (!bullets.length && !from) return null
  return (
    <ul className="poi-bullets" data-testid="poi-bullets">
      {bullets.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
      {from && (
        <li className="poi-distance" data-testid="poi-distance">
          {distanceText(poi, from)}
        </li>
      )}
    </ul>
  )
}

function FullBody({ poi }: { poi: Poi }) {
  const g = groupInfo(poi.group)
  const summary = cleanText(poi.summary)
  const facts = fullFacts(poi)
  const evidence = evidenceText(poi.evidence)
  const limitations = poi.limitations ? cleanText(poi.limitations) : ''
  return (
    <div className="poi-full" data-testid="poi-full">
      <p className="poi-info-where">
        {g.label} · <span className="mono">{fmtLatLon(poi.lat, poi.lon)}</span>
      </p>
      {summary && <p className="poi-info-summary">{summary}</p>}
      {facts.length > 0 && (
        <dl className="poi-facts">
          {facts.map((f, i) => (
            <div key={i} className="poi-fact">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {evidence && (
        <p className="poi-info-line" data-testid="poi-evidence">
          <span className="poi-info-key">Evidence</span> {evidence.text}
          {evidence.meaning.map((m) => (
            <span key={m} className="poi-info-meaning">
              {m}
            </span>
          ))}
        </p>
      )}
      {limitations && (
        <p className="poi-info-line">
          <span className="poi-info-key">Limitations</span> {limitations}
        </p>
      )}
      <p className="poi-info-line poi-info-sources">
        <span className="poi-info-key">{poi.sources.length === 1 ? 'Source' : 'Sources'}</span>{' '}
        {poi.sources.map((u, i) => (
          <span key={u}>
            {i > 0 && ', '}
            <a href={u} target="_blank" rel="noreferrer">
              {sourceHost(u)}
            </a>
          </span>
        ))}
      </p>
    </div>
  )
}
