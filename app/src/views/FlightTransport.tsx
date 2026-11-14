// Flight playback bar: play/pause, the mission elapsed time and phase, a scrubber with burn ticks, and the
// simulated speed. Shown at the bottom of the screen in place of the site timeline. Presentational only: the
// playback clock lives outside and is passed in as timeMs.
import '../styles/flight.css'
import type { FlightPlan } from '../flight/types'
import { DEFAULT_SPEED, SPEEDS, fmtElapsed, fmtKms, fmtUtc } from './flightFormat'

export interface FlightTransportProps {
  plan: FlightPlan
  timeMs: number // current simulated instant, within [plan.launchMs, plan.landingMs]
  playing: boolean
  speed: number // simulated seconds per real second; one of SPEEDS
  onPlaying(v: boolean): void
  onSeek(utcMs: number): void
  onSpeed(v: number): void
}

// Ticks that carry a text label; the others are plain ticks (ascent, DOI, touchdown sit too close to label).
const LABELLED = new Set(['tli', 'loi', 'pdi'])

export function FlightTransport(p: FlightTransportProps) {
  const { plan, timeMs, playing, speed, onPlaying, onSeek, onSpeed } = p
  const { launchMs, landingMs } = plan
  const span = Math.max(1, landingMs - launchMs)
  const atEnd = timeMs >= landingMs

  const phase = atEnd ? 'Landed' : (plan.phases.find((ph) => timeMs >= ph.startMs && timeMs < ph.endMs)?.label ?? '')
  const elapsed = fmtElapsed(timeMs - launchMs)
  const speedIndex = SPEEDS.reduce(
    (best, s, i) => (Math.abs(s.value - speed) < Math.abs(SPEEDS[best].value - speed) ? i : best),
    SPEEDS.findIndex((s) => s.value === DEFAULT_SPEED),
  )

  const onPlay = () => {
    if (playing) return onPlaying(false)
    if (atEnd) onSeek(launchMs)
    onPlaying(true)
  }

  return (
    <div className="flight-transport" data-testid="flight-transport">
      <button type="button" className="btn flight-play" data-testid="flight-play" aria-pressed={playing} onClick={onPlay}>
        {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
      </button>

      <div className="flight-readout" aria-live="off">
        <p className="flight-elapsed mono" data-testid="flight-elapsed">
          {elapsed}
        </p>
        <p className="quiet mono">{fmtUtc(timeMs)}</p>
        <p className="flight-phase" data-testid="flight-phase">
          {phase}
        </p>
      </div>

      <div className="flight-track">
        <div className="flight-ticks">
          {plan.burns.map((b) => {
            const pct = ((b.utcMs - launchMs) / span) * 100
            return (
              <button
                key={b.id}
                type="button"
                className="flight-tick"
                style={{ left: `${Math.min(100, Math.max(0, pct))}%` }}
                title={`${b.label}, ${fmtKms(b.dvKms, b.estimate)}`}
                aria-label={`Go to ${b.label}`}
                onClick={() => onSeek(b.utcMs)}
              >
                {LABELLED.has(b.id) && <span className="flight-tick-text">{b.short}</span>}
              </button>
            )
          })}
        </div>
        <input
          type="range"
          className="flight-scrub"
          min={launchMs}
          max={landingMs}
          step={1000}
          value={timeMs}
          aria-label="Flight time"
          aria-valuetext={`${elapsed}, ${phase}`}
          data-testid="flight-scrub"
          onChange={(e) => onSeek(Number(e.target.value))}
        />
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
  )
}
