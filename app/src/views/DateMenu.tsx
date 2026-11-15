// Time periods (the date control): the current mission at its landing site with the best computed periods for
// that site (the finder with its default thresholds and the mission's own length, over the mission's calendar
// year); picking one edits the mission's dates. Below: the named periods from periods.json and a custom UTC date
// and time. A time inside the current period moves the cursor; any other time opens a 14-day period starting
// that day.
import { useEffect, useRef, useState } from 'react'
import { FINDER_DEFAULTS, finder } from '../geometry'
import type { FinderResult } from '../geometry'
import { loadMonthsFor } from '../data/load'
import { finderInputs } from '../data/results'
import type { Period, Site, Station } from '../data/types'
import { COVERAGE_END_MS, COVERAGE_START_MS, DAY_MS, inCoverage, isoMinute, RANGE_ERROR } from '../state'
import { spanLabel } from './period'
import { Marked } from './Drawer'

const BEST_SHOWN = 5

interface Props {
  periods: Period[]
  currentPeriodId: string
  cursorMs: number
  onPeriod(id: string): void
  onCustom(ms: number): void
  onClose(): void
  // The mission whose dates the best periods edit (optional until App passes them: without them the menu is
  // the named periods and the custom date only).
  missionName?: string
  site?: Site
  stations?: Station[]
  ids?: string[]
  missionStartMs?: number
  missionEndMs?: number
  onBest?(startMs: number, days: number, landingMs: number): void
  onFinder?(): void // opens the Details drawer at its Dates tab (the finder with the user's own limits)
}

type Best =
  | { status: 'computing' }
  | { status: 'done'; result: FinderResult; days: number; fromMs: number; toMs: number }
  | { status: 'none'; text: string }

const bestCache = new Map<string, Best>()

/** The search: landing times over the mission's calendar year (inside the data), missions of the mission's length. */
export function bestSearch(missionStartMs: number, missionEndMs: number): { days: number; fromMs: number; toMs: number } {
  const days = Math.min(60, Math.max(1, Math.round((missionEndMs - missionStartMs) / DAY_MS)))
  const y = new Date(missionStartMs).getUTCFullYear()
  const fromMs = Math.max(COVERAGE_START_MS, Date.UTC(y, 0, 1))
  const toMs = Math.min(Date.UTC(y + 1, 0, 1), COVERAGE_END_MS - days * DAY_MS)
  return { days, fromMs, toMs }
}

function useBest(site: Site | undefined, stations: Station[] | undefined, ids: string[] | undefined, startMs: number, endMs: number): Best | null {
  const { days, fromMs, toMs } = bestSearch(startMs, endMs)
  const key = site && ids ? `${site.id}|${ids.join(',')}|${days}|${fromMs}` : ''
  const [state, setState] = useState<{ key: string; best: Best }>(() => ({ key, best: bestCache.get(key) ?? { status: 'computing' } }))
  useEffect(() => {
    if (!site || !stations || !ids) return
    const hit = bestCache.get(key)
    if (hit) {
      setState({ key, best: hit })
      return
    }
    let alive = true
    setState({ key, best: { status: 'computing' } })
    ;(async () => {
      await new Promise((r) => setTimeout(r, 0)) // the menu paints first
      let best: Best
      try {
        const months = toMs >= fromMs ? await loadMonthsFor(fromMs, toMs + days * DAY_MS) : null
        const { geo, horizon } = await finderInputs(site)
        if (!months) best = { status: 'none', text: 'No ephemeris for this year in this build.' }
        else if (!horizon) best = { status: 'none', text: `No terrain data for ${site.name} in this build.` }
        else {
          const result = finder(months, geo, horizon, stations, ids, fromMs, toMs, { ...FINDER_DEFAULTS, missionDays: days })
          best = { status: 'done', result, days, fromMs, toMs }
        }
        bestCache.set(key, best)
      } catch (e) {
        best = { status: 'none', text: `Could not compute: ${(e as Error).message}` }
      }
      if (alive) setState({ key, best })
    })()
    return () => {
      alive = false
    }
    // the key describes every input
  }, [key])
  if (!site || !stations || !ids) return null
  return state.key === key ? state.best : { status: 'computing' }
}

export function DateMenu(p: Props) {
  const { periods, currentPeriodId, cursorMs, onPeriod, onCustom, onClose } = p
  const iso = isoMinute(cursorMs)
  const [date, setDate] = useState(iso.slice(0, 10))
  const [time, setTime] = useState(iso.slice(11, 16))
  const [error, setError] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const first = useRef<HTMLButtonElement>(null)
  const startMs = p.missionStartMs ?? cursorMs
  const endMs = p.missionEndMs ?? cursorMs + DAY_MS
  const best = useBest(p.site, p.stations, p.ids, startMs, endMs)

  useEffect(() => first.current?.focus(), [])
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element
      if (root.current && !root.current.contains(t) && !t.closest?.('[data-menu-trigger]')) onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [onClose])

  const apply = (e: React.FormEvent) => {
    e.preventDefault()
    const ms = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) ? Date.parse(`${date}T${time}:00Z`) : NaN
    if (!Number.isFinite(ms)) {
      setError('Enter a date and a time, for example 2027-08-16 and 12:00.')
      return
    }
    if (!inCoverage(ms)) {
      setError(RANGE_ERROR)
      return
    }
    setError(null)
    onCustom(ms)
  }

  const year = new Date(startMs).getUTCFullYear()
  const windows = best?.status === 'done' ? best.result.windows.slice(0, BEST_SHOWN) : []
  // Named periods take the first focus only when there is no best-period list.
  let firstUsed = false
  const firstRef = () => {
    if (firstUsed) return undefined
    firstUsed = true
    return first
  }

  return (
    <div
      ref={root}
      className="popover menu date-menu"
      role="dialog"
      aria-label="Time periods"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      {best && p.site && (
        <section className="best" data-testid="best-periods" aria-labelledby="best-title">
          <div className="menu-group" id="best-title">
            Best periods in {year} · <span className="best-mission">{p.missionName ?? 'Mission'}</span> at {p.site.name}
          </div>
          <p className="menu-msg is-quiet" data-testid="best-defaults">
            {best.status === 'done' ? `${best.days}-day stays` : 'Stays of the mission length'}, proposed finder defaults: sunlit ≥ {FINDER_DEFAULTS.minLitPct} %,
            station contact ≥ {FINDER_DEFAULTS.minCoveragePct} %, gap ≤ {FINDER_DEFAULTS.maxGapH} h, darkness ≤ {FINDER_DEFAULTS.maxDarkH} h.
          </p>
          {best.status === 'computing' && (
            <p className="menu-msg is-quiet" role="status">
              Computing…
            </p>
          )}
          {best.status === 'none' && <p className="menu-msg">{best.text}</p>}
          {best.status === 'done' && windows.length === 0 && (
            <p className="menu-msg" data-testid="best-none">
              No {best.days}-day period in {year} meets every finder default. Set your own limits below.
            </p>
          )}
          {windows.length > 0 && best.status === 'done' && (
            <ul className="plain">
              {windows.map((w, i) => {
                const s = w.best.landingMs
                const e = s + best.days * DAY_MS
                const current = s === p.missionStartMs && e === p.missionEndMs
                return (
                  <li key={w.startMs}>
                    <button
                      ref={i === 0 ? firstRef() : undefined}
                      type="button"
                      data-testid="best-period"
                      data-start={s}
                      aria-current={current ? 'true' : undefined}
                      className={`opt${current ? ' is-selected' : ''}`}
                      onClick={() => p.onBest?.(s, best.days, s)}
                    >
                      <span className="opt-name">
                        <Marked text={spanLabel(s, e)} />
                      </span>
                      <span className="opt-label mono">
                        sunlit {w.best.litPct.toFixed(1)} % · station contact {w.best.coveragePct.toFixed(1)} %
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {p.onFinder && (
            <p className="menu-msg">
              <button
                type="button"
                className="btn"
                data-testid="best-finder"
                title="Opens Details at the Dates tab: the finder with limits you set, and the year timeline"
                onClick={p.onFinder}
              >
                Find dates with your own limits
              </button>
            </p>
          )}
        </section>
      )}
      <div className="menu-group">Periods</div>
      <ul className="plain">
        {periods.map((x, i) => (
          <li key={x.id}>
            <button
              ref={i === 0 ? firstRef() : undefined}
              type="button"
              aria-current={x.id === currentPeriodId ? 'true' : undefined}
              className={`opt${x.id === currentPeriodId ? ' is-selected' : ''}`}
              onClick={() => onPeriod(x.id)}
            >
              <span className="opt-name">
                {x.label}
                {x.reason && <span className="opt-label"> {x.reason}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <form className="date-form" onSubmit={apply} noValidate>
        <div className="menu-group">
          Date and time, <abbr title="Coordinated Universal Time">UTC</abbr>
        </div>
        <div className="date-row">
          <input className="field mono" type="date" aria-label="Date (UTC)" value={date} min="2026-11-01" max="2030-12-31" onChange={(e) => setDate(e.target.value)} />
          <input className="field mono" type="time" aria-label="Time (UTC)" value={time} step={1800} onChange={(e) => setTime(e.target.value)} />
          <button className="btn" type="submit">
            Show
          </button>
        </div>
        {error && (
          <p className="menu-msg is-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
