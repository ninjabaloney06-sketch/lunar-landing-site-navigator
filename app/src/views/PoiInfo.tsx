// The info card of a point of interest (U3, U8, U17). Two modes, chosen by the global "Full data" switch in its
// top-right corner (views/advanced.ts):
// - summary (default): name, plain feature type, the record's plain bullets (docs/POIs/plain.json, every fact from
//   the record), the distance and direction from the current landing site, then "At this point, for your mission
//   dates": sunlit and station contact % (only for points with a terrain horizon of their own, computed like the
//   search's values) and the slope from the shipped file;
// - full data: the whole record, cleaned (poiLayer.cleanText): coordinates as "84.90° S, 35.50° W", rows with no
//   value hidden, evidence grades explained, no internal file names, the same computed block with how it was
//   computed and its validation status, source links at the bottom.
// Every abbreviation in the texts carries its long form (<abbr title>, poiLayer.POI_ABBR).
// Placement and open/close behaviour: SceneView.
import { useLayoutEffect, useRef } from 'react'
import type { PointerEventHandler, ReactNode, Ref } from 'react'
import type { Poi } from '../data/pois'
import { useFullData } from './advanced'
import { FullDataSwitch } from './FullDataSwitch'
import {
  abbrParts,
  cleanText,
  conditionLines,
  distanceText,
  evidenceText,
  fmtLatLon,
  fullFacts,
  groupInfo,
  sourceHost,
  usePoiConditions,
} from './poiLayer'
import type { PoiMission } from './poiLayer'
import { spanLabel } from './period'
import { OTHER_CHECKS, RECORD_HREF, RECORD_LABEL, V1_CLAIM } from './validationClaim'

interface Props {
  poi: Poi
  pinned: boolean
  boxRef: Ref<HTMLElement>
  from?: { name: string; lat: number; lon: number } | null // the current landing site, for the distance bullet
  /** The app's mission dates and stations. Without it the card reads them from the link (the same values, written
   *  to the URL by App.tsx's hash state). */
  mission?: PoiMission | null
  /** Called when the card is used (a press inside it) while it is open by hover only, so the place can keep it. */
  onKeep?(): void
  onClose(): void
  onPointerEnter: PointerEventHandler
  onPointerLeave: PointerEventHandler
}

const LOLA_DOI = 'https://doi.org/10.3847/PSJ/acf3e1' // the horizons' terrain model (horizons/*.json "dem")

/** Text with each abbreviation marked. */
function T({ text }: { text: string }) {
  return (
    <>
      {abbrParts(text).map((p, i) =>
        p.title ? (
          <abbr key={i} title={p.title}>
            {p.text}
          </abbr>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}

export function PoiInfo({ poi, pinned, boxRef, from, mission, onKeep, onClose, onPointerEnter, onPointerLeave }: Props) {
  const [full] = useFullData()
  const g = groupInfo(poi.group)
  const type = poi.plain?.type ?? g.label
  const own = useRef<HTMLElement | null>(null)
  const setRef = (el: HTMLElement | null) => {
    own.current = el
    if (typeof boxRef === 'function') boxRef(el)
    else if (boxRef) (boxRef as { current: HTMLElement | null }).current = el
  }
  // A card open by hover only must not shrink away from the pointer when its own switch changes the mode (the
  // place keeps the card's side, so a shorter card left the pointer outside it, and the next pointer step closed
  // it). Until it is kept or closed, it keeps the height it had.
  const last = useRef({ full, id: poi.id, h: 0 })
  useLayoutEffect(() => {
    const el = own.current
    if (!el) return
    if (pinned || last.current.id !== poi.id) el.style.minHeight = ''
    else if (last.current.full !== full) el.style.minHeight = `${last.current.h}px`
    last.current = { full, id: poi.id, h: el.offsetHeight }
  })
  return (
    <aside
      ref={setRef}
      className="poi-info"
      aria-label={poi.name}
      data-testid="poi-info"
      data-poi-id={poi.id}
      data-pinned={pinned ? 'true' : 'false'}
      data-mode={full ? 'full' : 'summary'}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={() => {
        if (!pinned) onKeep?.()
      }}
    >
      <div className="poi-info-head">
        <p className="poi-info-group" data-testid="poi-type">
          <span className="poi-swatch" style={{ background: g.color }} aria-hidden="true" />
          <T text={type} />
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
      <h3 className="poi-info-name">
        <T text={poi.name} />
      </h3>
      {full ? (
        <FullBody poi={poi} here={<Here poiId={poi.id} mission={mission ?? null} full />} />
      ) : (
        <>
          <SummaryBody poi={poi} from={from ?? null} />
          <Here poiId={poi.id} mission={mission ?? null} full={false} />
        </>
      )}
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
        <li key={i}>
          <T text={b} />
        </li>
      ))}
      {from && (
        <li className="poi-distance" data-testid="poi-distance">
          {distanceText(poi, from)}
        </li>
      )}
    </ul>
  )
}

/** "At this point, for your mission dates": at most three computed lines. Nothing for a point without a horizon. */
function Here({ poiId, mission, full }: { poiId: string; mission: PoiMission | null; full: boolean }) {
  const c = usePoiConditions(poiId, mission)
  if (c.status === 'none') return null
  const entry = c.status === 'ready' ? c.entry : null
  const computing = c.status === 'loading' || entry?.status === 'computing'
  // Before the point's row is known: three rows holding the place, so the card does not grow under the pointer.
  const lines =
    c.status === 'ready'
      ? conditionLines(c.site, c.mission, entry?.status === 'done' ? entry.summary : null, computing)
      : (['Sunlit', 'Station contact', 'Slope'] as const).map((label, i) => ({ key: (['lit', 'comms', 'slope'] as const)[i], label, value: '…', note: '', status: undefined }))
  return (
    <section className="poi-here" data-testid="poi-here" data-state={computing ? 'computing' : entry?.status === 'none' ? 'none' : 'ready'} aria-busy={computing}>
      <h4 className="poi-here-title">At this point, for your mission dates</h4>
      {lines.length > 0 && (
        <dl className="poi-here-list">
          {lines.map((l) => (
            <div key={l.key} className="poi-here-row" data-key={l.key} data-status={l.status}>
              <dt>{l.label}</dt>
              <dd>
                <span className="mono poi-here-value">{l.value}</span> <span className="poi-here-note">{l.note}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {computing && <p className="sr-only" role="status">Computing sunlight and station contact…</p>}
      {entry?.status === 'none' && (
        <p className="poi-here-msg">{entry.reason === 'could not load' ? 'Sunlight and station contact could not be computed.' : 'No sunlight data for these dates in this build.'}</p>
      )}
      {full && (
        <p className="poi-here-method" data-testid="poi-here-method">
          Computed in this app from the point’s terrain horizon (
          <a href={LOLA_DOI} target="_blank" rel="noreferrer">
            <abbr title="Lunar Orbiter Laser Altimeter (LRO)">LOLA</abbr> 20 m/px
          </a>
          , 720 directions) and the Sun, Earth and station positions over
          {c.status === 'ready' ? ` ${spanLabel(c.mission.startMs, c.mission.endMs)}` : ' these dates'}, as in the search. Validation as
          for every app result: {V1_CLAIM}; {OTHER_CHECKS} (
          <a href={RECORD_HREF} target="_blank" rel="noopener noreferrer">
            {RECORD_LABEL}
          </a>
          ).
        </p>
      )}
    </section>
  )
}

function FullBody({ poi, here }: { poi: Poi; here: ReactNode }) {
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
      {summary && (
        <p className="poi-info-summary">
          <T text={summary} />
        </p>
      )}
      {facts.length > 0 && (
        <dl className="poi-facts">
          {facts.map((f, i) => (
            <div key={i} className="poi-fact">
              <dt>
                <T text={f.label} />
              </dt>
              <dd>
                <T text={f.value} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {evidence && (
        <p className="poi-info-line" data-testid="poi-evidence">
          <span className="poi-info-key">Evidence</span> <T text={evidence.text} />
          {evidence.meaning.map((m) => (
            <span key={m} className="poi-info-meaning">
              {m}
            </span>
          ))}
        </p>
      )}
      {limitations && (
        <p className="poi-info-line">
          <span className="poi-info-key">Limitations</span> <T text={limitations} />
        </p>
      )}
      {here}
      <Sources poi={poi} />
    </div>
  )
}

function Sources({ poi }: { poi: Poi }) {
  return (
    <p className="poi-info-line poi-info-sources" data-testid="poi-sources">
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
  )
}
