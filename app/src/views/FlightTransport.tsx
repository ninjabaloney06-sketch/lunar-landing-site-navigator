// Flight playback bar: play/pause, the mission elapsed time and phase, a scrubber with event ticks, what the
// camera looks at, and the simulated speed. Shown at the bottom of the screen in place of the site timeline.
// Presentational only: the playback clock and the camera live outside and are passed in.
import { useEffect, useId, useRef, useState } from 'react'
import '../styles/flight.css'
import type { MissionPlan } from '../flight/types'
import { DEFAULT_SPEED, SPEEDS, fmtElapsed, fmtKms, fmtUtc } from './flightFormat'

export type FlightFocus = 'overview' | 'earth' | 'moon' | 'capsule' | 'lander'

export interface FlightTransportProps {
  plan: MissionPlan
  timeMs: number // current simulated instant, within [plan.launchMs, plan.endMs]
  playing: boolean
  speed: number // simulated seconds per real second; one of SPEEDS
  focus: FlightFocus
  onPlaying(v: boolean): void
  onSeek(utcMs: number): void
  onSpeed(v: number): void
  onFocus(f: FlightFocus): void // also called for the choice already made: the parent resets the view
}

const FOCUS: { id: FlightFocus; label: string }[] = [
  { id: 'overview', label: 'Whole flight' },
  { id: 'earth', label: 'Earth' },
  { id: 'moon', label: 'Moon' },
  { id: 'capsule', label: 'Capsule' },
  { id: 'lander', label: 'Lander' },
]

// Events that get a tick although no engine fires, and the ticks that carry a text. The other burns are plain
// ticks: their name is in the tooltip and in the panel's table.
const MARKED = new Set(['touchdown', 'docking', 'ei'])
const LABELLED = new Set(['tli', 'loi', 'touchdown', 'docking', 'tei', 'ei'])

const END_PHASE = 'Entry Interface'

// Width of a tick text: IBM Plex Mono at --t-small advances 7.2 px per character; 4 px of air on each side.
const CHAR_PX = 7.2
const TEXT_GAP_PX = 4
const FALLBACK_TRACK_PX = 600 // before the track has been measured

/** The label of the capsule leg that contains timeMs. */
function phaseAt(plan: MissionPlan, timeMs: number): string {
  if (timeMs >= plan.endMs) return END_PHASE
  let latest: { startMs: number; label: string } | null = null
  for (const leg of plan.legs) {
    const t = leg.track.t
    if (leg.craft !== 'capsule' || t.length === 0 || t[0] > timeMs) continue
    if (timeMs < t[t.length - 1]) return leg.label
    if (!latest || t[0] >= latest.startMs) latest = { startMs: t[0], label: leg.label }
  }
  return latest?.label ?? ''
}

/** Where each tick's text goes: 0 = directly above the tick, 1 = one line higher (the neighbour's text is in
 *  the way), null = no text (not a labelled tick, or no room on either line). Ticks are in time order. */
function textRows(ticks: { pct: number; text: string | null }[], trackPx: number): (0 | 1 | null)[] {
  const taken = [-Infinity, -Infinity] // right edge of the last text on each line, px
  return ticks.map((tick) => {
    if (tick.text === null) return null
    const half = (tick.text.length * CHAR_PX) / 2 + TEXT_GAP_PX
    const x = (tick.pct / 100) * trackPx
    const row = x - half >= taken[0] ? 0 : x - half >= taken[1] ? 1 : null
    if (row !== null) taken[row] = x + half
    return row
  })
}

export function FlightTransport(p: FlightTransportProps) {
  const { plan, timeMs, playing, speed, focus, onPlaying, onSeek, onSpeed, onFocus } = p
  const { launchMs, endMs } = plan
  const lookId = useId()
  const ticksRef = useRef<HTMLDivElement>(null)
  const [trackPx, setTrackPx] = useState(FALLBACK_TRACK_PX)

  useEffect(() => {
    const el = ticksRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (el.clientWidth > 0) setTrackPx(el.clientWidth)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const span = Math.max(1, endMs - launchMs)
  const atEnd = timeMs >= endMs
  const phase = phaseAt(plan, timeMs)
  const elapsed = fmtElapsed(timeMs - launchMs)
  const speedIndex = SPEEDS.reduce(
    (best, s, i) => (Math.abs(s.value - speed) < Math.abs(SPEEDS[best].value - speed) ? i : best),
    SPEEDS.findIndex((s) => s.value === DEFAULT_SPEED),
  )

  const ticks = plan.events
    .filter((e) => e.kind === 'burn' || MARKED.has(e.id))
    .map((e) => ({
      event: e,
      pct: Math.min(100, Math.max(0, ((e.utcMs - launchMs) / span) * 100)),
      text: LABELLED.has(e.id) ? e.short : null,
    }))
  const rows = textRows(ticks, trackPx)

  const onPlay = () => {
    if (playing) return onPlaying(false)
    if (atEnd) onSeek(launchMs)
    onPlaying(true)
  }

  // Radio group keys: the arrows move to the neighbouring choice and make it.
  const onLookKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (step === 0) return
    e.preventDefault()
    const at = Math.max(0, FOCUS.findIndex((f) => f.id === focus))
    const next = FOCUS[(at + step + FOCUS.length) % FOCUS.length]
    onFocus(next.id)
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-focus="${next.id}"]`)?.focus()
  }

  return (
    <div className="flight-transport" data-testid="flight-transport">
      <div className="flight-row">
        <button type="button" className="btn flight-play" data-testid="flight-play" aria-pressed={playing} onClick={onPlay}>
          {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
        </button>

        <div className="flight-readout" aria-live="off">
          <p className="flight-elapsed mono" data-testid="flight-elapsed">
            {elapsed}
          </p>
          <p className="flight-utc quiet mono">{fmtUtc(timeMs)}</p>
          <p className="flight-phase" data-testid="flight-phase">
            {phase}
          </p>
        </div>

        <div className="flight-track">
          <div ref={ticksRef} className="flight-ticks">
            {ticks.map(({ event: e, pct, text }, i) => (
              <button
                key={`${i}-${e.id}`}
                type="button"
                className="flight-tick"
                style={{ left: `${pct}%` }}
                title={e.dvKms === null ? e.label : `${e.label}, ${fmtKms(e.dvKms)}`}
                aria-label={`Go to ${e.label}`}
                data-tick={e.id}
                onClick={() => onSeek(e.utcMs)}
              >
                {text !== null && rows[i] !== null && (
                  <span className={rows[i] === 1 ? 'flight-tick-text is-raised' : 'flight-tick-text'}>{text}</span>
                )}
              </button>
            ))}
          </div>
          <input
            type="range"
            className="flight-scrub"
            min={launchMs}
            max={endMs}
            step={1000}
            value={timeMs}
            aria-label="Flight time"
            aria-valuetext={`${elapsed}, ${phase}`}
            data-testid="flight-scrub"
            onChange={(e) => onSeek(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="flight-row">
        <div className="flight-look-field">
          <span id={lookId} className="quiet">
            Look at
          </span>
          <div className="tabs flight-look" role="radiogroup" aria-labelledby={lookId} onKeyDown={onLookKey}>
            {FOCUS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                className="tab"
                aria-checked={focus === f.id}
                tabIndex={focus === f.id ? 0 : -1}
                data-focus={f.id}
                data-testid={`focus-${f.id}`}
                onClick={() => onFocus(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flight-speed-field">
          <span className="quiet">Speed</span>
          <input
            type="range"
            className="flight-speed"
            min={0}
            max={SPEEDS.length - 1}
            step={1}
            value={speedIndex}
            aria-valuetext={SPEEDS[speedIndex].label}
            data-testid="flight-speed"
            onChange={(e) => onSpeed(SPEEDS[Number(e.target.value)].value)}
          />
          <span className="mono quiet">{SPEEDS[speedIndex].label}</span>
        </label>
      </div>
    </div>
  )
}
