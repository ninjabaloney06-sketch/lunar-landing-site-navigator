// Timeline over the selected period: Sun track (yellow = lit, dark = dark) and Comms track (blue = at least
// one selected station in line of sight, dark = none, hatch = unknown), dates in mono, a 1 px cursor.
// Drag = scrub. Keys (space, arrows) are handled by the screen so they work without focusing the track.
import { useEffect, useRef, useState } from 'react'
import type { Window } from '../geometry'
import { DAY_MS } from '../state'
import { fmtDateTime, fmtDay } from './format'

interface Props {
  startMs: number
  endMs: number
  cursorMs: number
  sun: Window[] | null // null while loading: tracks stay empty, never the previous selection's windows
  comms: Window[] | null
  valueText: string
  onScrub(ms: number): void
}

function Segments({ ws, startMs, endMs, show }: { ws: Window[]; startMs: number; endMs: number; show: string[] }) {
  const span = endMs - startMs
  return (
    <>
      {ws
        .filter((w) => show.includes(w.state))
        .map((w) => (
          <span
            key={`${w.state}-${w.startMs}`}
            className={`seg seg-${w.state}`}
            data-state={w.state}
            style={{ left: `${(100 * (w.startMs - startMs)) / span}%`, width: `${(100 * (w.endMs - w.startMs)) / span}%` }}
          />
        ))}
    </>
  )
}

export function Timeline({ startMs, endMs, cursorMs, sun, comms, valueText, onScrub }: Props) {
  const body = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const dragging = useRef(false)

  useEffect(() => {
    const el = body.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const span = endMs - startMs
  const frac = (ms: number) => Math.min(1, Math.max(0, (ms - startMs) / span))

  const scrubAt = (clientX: number) => {
    const r = body.current!.getBoundingClientRect()
    onScrub(startMs + ((clientX - r.left) / r.width) * span)
  }

  // Midnight ticks, at least 112 px apart.
  const days = Math.round(span / DAY_MS)
  const every = Math.max(1, Math.ceil(days / Math.max(1, Math.floor(width / 112))))
  const ticks: number[] = []
  const first = Math.ceil(startMs / DAY_MS) * DAY_MS
  for (let t = first, i = 0; t <= endMs; t += DAY_MS, i++) if (i % every === 0) ticks.push(t)

  const firstUnknown = comms?.find((w) => w.state === 'unknown')

  return (
    <div className="timeline">
      <div className="tl-names" aria-hidden="true">
        <span>Sun</span>
        <span>Comms</span>
      </div>
      <div
        ref={body}
        className="tl-body"
        role="slider"
        tabIndex={0}
        aria-label="Time in the selected period"
        aria-valuemin={startMs}
        aria-valuemax={endMs}
        aria-valuenow={cursorMs}
        aria-valuetext={valueText}
        title={fmtDateTime(cursorMs)}
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          scrubAt(e.clientX)
        }}
        onPointerMove={(e) => dragging.current && scrubAt(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <div className="tl-track" data-testid="track-sun" data-ready={sun ? 'true' : 'false'}>
          {sun && <Segments ws={sun} startMs={startMs} endMs={endMs} show={['lit']} />}
        </div>
        <div className="tl-track" data-testid="track-comms" data-ready={comms ? 'true' : 'false'}>
          {comms && <Segments ws={comms} startMs={startMs} endMs={endMs} show={['covered', 'unknown']} />}
          {firstUnknown && (
            <span className="tl-unknown" style={{ left: `${100 * frac(firstUnknown.startMs)}%` }}>
              unknown
            </span>
          )}
        </div>
        <span className="tl-cursor" style={{ left: `${100 * frac(cursorMs)}%` }} />
        <div className="tl-axis" aria-hidden="true">
          {ticks.map((t) => {
            const f = frac(t)
            return (
              <span key={t} className={`tl-tick${f > 0.97 ? ' is-end' : ''}`} style={{ left: `${100 * f}%` }}>
                {fmtDay(t)}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
