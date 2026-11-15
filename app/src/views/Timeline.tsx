// Timeline over the mission plus a few context days on each side: Light track (yellow = lit, dark = dark) and
// Comms track (blue = at least one selected station in line of sight, dark = none, hatch = unknown), dates in
// mono, a 1 px cursor. The mission span is bracketed with its name and length and shown at full strength; the
// context days are dimmed. Drag = scrub (the cursor stays inside the mission); a date inside the mission moves
// the cursor to that day 12:00 UTC. Keys (space, arrows) are handled by the screen so they work without
// focusing the track. The answer sentences sit in one small line directly above the two tracks (ninja + Bene,
// 14 Nov: no large text on the scene).
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Window } from '../geometry'
import type { Site, Station } from '../data/types'
import { DAY_MS, SPEEDS_H_PER_S } from '../state'
import { fmtDate, fmtDateTime, fmtDay } from './format'
import { useYearBars, yearSpan, YEARS } from './yearBars'

interface Props {
  startMs: number // shown range: mission start minus the context days, clipped to the supported dates
  endMs: number
  missionStartMs: number
  missionEndMs: number
  missionLabel: string // "<mission name>, <n> days"
  cursorMs: number
  sun: Window[] | null // null while loading: tracks stay empty, never the previous selection's windows
  comms: Window[] | null
  valueText: string
  answer: ReactNode // the answer line or its loading / empty / error state
  tools?: ReactNode // quiet text controls at the right end above the answer (View, Simulate)
  sim?: SimControls | null // while a simulation runs or is paused: its speed slider and "Reset to start"
  onScrub(ms: number): void
}

export interface SimControls {
  speed: number // hours of mission time per second, one of SPEEDS_H_PER_S
  onSpeed(hoursPerSecond: number): void
  onReset(): void // cursor back to the first mission step, simulation paused
}

export const speedLabel = (h: number) => (h % 24 === 0 ? `${h / 24} ${h === 24 ? 'day' : 'days'} per second` : `${h} hours per second`)
const speedShort = (h: number) => (h % 24 === 0 ? `${h / 24} ${h === 24 ? 'day' : 'days'}/s` : `${h} h/s`)

/** Simulation speed: a slider over the steps of SPEEDS_H_PER_S (like the Flight plan's), beside Simulate. */
export function SimSpeed({ speed, onSpeed, onReset }: SimControls) {
  const found = SPEEDS_H_PER_S.indexOf(speed)
  const i = found < 0 ? 0 : found
  return (
    <span className="sim-controls" data-testid="sim-controls">
      <button type="button" className="tool" onClick={onReset}>
        Reset to start
      </button>
      <label className="sim-speed-field" title="Mission time per second of real time">
        <span>Speed</span>
        <input
          type="range"
          className="sim-speed"
          min={0}
          max={SPEEDS_H_PER_S.length - 1}
          step={1}
          value={i}
          aria-valuetext={speedLabel(SPEEDS_H_PER_S[i])}
          data-testid="sim-speed"
          onChange={(e) => onSpeed(SPEEDS_H_PER_S[Number(e.target.value)])}
        />
        <span className="mono">{speedShort(SPEEDS_H_PER_S[i])}</span>
      </label>
    </span>
  )
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

export function Timeline({ startMs, endMs, missionStartMs, missionEndMs, missionLabel, cursorMs, sun, comms, valueText, answer, tools, sim, onScrub }: Props) {
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
  const pct = (f: number) => `${100 * f}%`
  const a = frac(missionStartMs)
  const b = frac(missionEndMs)

  const scrubAt = (clientX: number) => {
    const r = body.current!.getBoundingClientRect()
    if (r.width <= 0 || span <= 0) return // not laid out: the position would be NaN
    onScrub(startMs + ((clientX - r.left) / r.width) * span)
  }

  // Midnight ticks, at least 112 px apart, counted from the mission start so its first day is always labelled.
  const days = Math.round(span / DAY_MS)
  const every = Math.max(1, Math.ceil(days / Math.max(1, Math.floor(width / 112))))
  const ticks: number[] = []
  const first = Math.ceil(startMs / DAY_MS) * DAY_MS
  const anchor = Math.ceil(missionStartMs / DAY_MS) * DAY_MS
  for (let t = first; t <= endMs; t += DAY_MS) if (Math.round((t - anchor) / DAY_MS) % every === 0) ticks.push(t)

  const firstUnknown = comms?.find((w) => w.state === 'unknown')
  const veils = (
    <>
      {a > 0 && <span className="tl-veil" style={{ left: 0, width: pct(a) }} />}
      {b < 1 && <span className="tl-veil" style={{ left: pct(b), right: 0 }} />}
    </>
  )

  return (
    <div className="timeline">
      {(tools || sim) && (
        <div className="tl-tools">
          {sim && <SimSpeed {...sim} />}
          {tools}
        </div>
      )}
      <div className="tl-answer">{answer}</div>
      <div className="tl-names" aria-hidden="true">
        <span title="Sunlight: yellow while any part of the Sun is above the terrain">Light</span>
        <span title="Station contact: blue while a selected station has line of sight; hatched = unknown">Contact</span>
        <span className="tl-names-utc" title="The dates on the axis are UTC">UTC</span>
      </div>
      <div
        ref={body}
        className="tl-body"
        role="slider"
        tabIndex={0}
        aria-label="Time in the selected period"
        aria-valuemin={missionStartMs}
        aria-valuemax={missionEndMs}
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
          {veils}
        </div>
        <div className="tl-track" data-testid="track-comms" data-ready={comms ? 'true' : 'false'}>
          {comms && <Segments ws={comms} startMs={startMs} endMs={endMs} show={['covered', 'unknown']} />}
          {veils}
          {firstUnknown && (
            <span className="tl-unknown" style={{ left: pct(frac(firstUnknown.startMs)) }}>
              unknown
            </span>
          )}
        </div>
        <div className="tl-bracket" data-testid="mission-bracket" style={{ marginLeft: pct(a), width: pct(b - a) }}>
          <span className="tl-bracket-label">{missionLabel}</span>
        </div>
        <span className="tl-cursor" style={{ left: pct(frac(cursorMs)) }} />
        <div className="tl-axis" aria-hidden="true">
          {ticks.map((t) => {
            const f = frac(t)
            const inMission = t >= missionStartMs && t < missionEndMs
            return (
              <span
                key={t}
                className={`tl-tick${f > 0.97 ? ' is-end' : ''}${inMission ? ' is-day' : ' is-context'}`}
                style={{ left: pct(f) }}
                onPointerDown={
                  inMission
                    ? (e) => {
                        // A mission day: the cursor goes to that day's noon instead of the pointer position.
                        e.stopPropagation()
                        onScrub(t + DAY_MS / 2)
                      }
                    : undefined
                }
              >
                {fmtDay(t)}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------- the drawer's stacked timeline: one bar per location over a calendar year ----------

export interface YearRow {
  site: Site
  missions: { name: string; startMs: number; endMs: number }[] // mission spans drawn as an outline on the row
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Light or communication over a year (2026–2030, data from Nov 2026): a month axis and one bar row per
 *  location, bars = sunlit or in-contact spans, the share of the covered days at the row's end. */
export function YearTimeline({ rows, stations, ids, initialYear }: { rows: YearRow[]; stations: Station[]; ids: string[]; initialYear: number }) {
  const [kind, setKind] = useState<'light' | 'comms'>('light')
  const [year, setYear] = useState(initialYear)
  const entries = useYearBars(
    rows.map((r) => r.site),
    stations,
    ids,
    year,
  )
  const { yearStartMs, yearEndMs, startMs, endMs } = yearSpan(year)
  const span = yearEndMs - yearStartMs
  const pct = (ms: number) => `${(100 * (Math.min(yearEndMs, Math.max(yearStartMs, ms)) - yearStartMs)) / span}%`
  const width = (a: number, b: number) => `${(100 * (Math.min(yearEndMs, b) - Math.max(yearStartMs, a))) / span}%`
  const what = kind === 'light' ? 'sunlit' : 'in line of sight of a selected station'
  // What the number at a row's end is a share of: the year, or its part with data (2026: from 1 Nov).
  const of = startMs > yearStartMs ? `${fmtDate(startMs)} – 31 Dec ${year}` : String(year)
  const outlined = rows.some((r) => r.missions.some((m) => m.endMs > yearStartMs && m.startMs < yearEndMs))

  return (
    <div className="yt" data-testid="year-timeline">
      <div className="yt-controls">
        <select className="field" aria-label="Show" data-testid="year-kind" value={kind} onChange={(e) => setKind(e.target.value as 'light' | 'comms')}>
          <option value="light">Sunlight</option>
          <option value="comms">Station contact</option>
        </select>
        <select className="field mono" aria-label="Year" data-testid="year-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <p className="yt-legend" data-testid="year-legend">
        <span className="yt-key">
          <i className={`yt-swatch is-${kind}`} aria-hidden="true" />
          bar: {what}
        </span>
        <span className="yt-key">number: share of {of} {kind === 'light' ? 'sunlit' : 'in contact'}</span>
        {outlined && (
          <span className="yt-key">
            <i className="yt-swatch is-mission" aria-hidden="true" />
            outline: mission dates
          </span>
        )}
      </p>
      <div className="yt-grid">
        <span />
        <div className="yt-axis" aria-hidden="true">
          {MONTHS.map((m, i) => (
            <span key={m} className="yt-month" style={{ left: pct(Date.UTC(year, i, 1)) }}>
              {m}
            </span>
          ))}
        </div>
        <span />
        {rows.map((r) => {
          const e = entries[r.site.id] ?? { status: 'computing' }
          const spans = e.status === 'done' ? (kind === 'light' ? e.lit : e.covered) : []
          const share = e.status === 'done' && endMs > startMs ? (100 * spans.reduce((t, [a, b]) => t + (b - a), 0)) / (endMs - startMs) : null
          const label =
            e.status === 'done'
              ? `${r.site.name}: ${what} ${share!.toFixed(1)} % of ${of}`
              : e.status === 'none'
                ? `${r.site.name}: ${e.reason}`
                : `${r.site.name}: computing`
          return (
            <div key={r.site.id} className="yt-row" data-testid="year-row" data-site-id={r.site.id} data-state={e.status}>
              <span className="yt-name" title={r.site.name}>
                {r.site.name}
              </span>
              <div className={`yt-bar is-${kind}`} role="img" aria-label={label}>
                {startMs > yearStartMs && <span className="yt-nodata" style={{ left: 0, width: width(yearStartMs, startMs) }} />}
                {spans.map(([a, b]) => (
                  <span key={a} className="yt-seg" data-testid="year-seg" style={{ left: pct(a), width: width(a, b) }} />
                ))}
                {r.missions
                  .filter((m) => m.endMs > yearStartMs && m.startMs < yearEndMs)
                  .map((m) => (
                    <span key={`${m.name}|${m.startMs}`} className="yt-mission" title={m.name} style={{ left: pct(m.startMs), width: width(m.startMs, m.endMs) }} />
                  ))}
              </div>
              <span className="yt-val mono" title={share !== null ? `${what} ${share.toFixed(1)} % of ${of}` : undefined}>
                {share !== null ? `${share.toFixed(1)} %` : e.status === 'none' ? 'no data' : '…'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
