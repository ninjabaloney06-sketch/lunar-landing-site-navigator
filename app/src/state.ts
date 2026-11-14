// URL-hash state (build-plan §5.2): site, cursor time, period, selected stations, view, drawer and user
// points. A copied link reproduces the view. Parsing never throws and never yields NaN: anything invalid
// falls back to the default for that key.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SceneLevel } from './scene3d'

export type DrawerSection = 'details' | 'finder' | 'sources'

export interface UserPoint {
  lat: number
  lon: number
}

export interface HashState {
  site: string | null // site id; null = default site
  period: string | null // period id, 'custom', or null = default period
  from: number | null // custom period start, UTC ms
  days: number // custom period length
  t: number | null // cursor, UTC ms
  st: string[] | null // selected station ids; null = all stations (default)
  view: SceneLevel
  drawer: DrawerSection | null
  pts: UserPoint[]
}

// Supported coverage (spec.md "Dates"): [2026-11-01, 2031-01-01) UTC.
export const COVERAGE_START_MS = Date.UTC(2026, 10, 1)
export const COVERAGE_END_MS = Date.UTC(2031, 0, 1)
export const STEP_MIN = 30
export const STEP_MS = STEP_MIN * 60_000
export const DAY_MS = 86_400_000
export const DEFAULT_DAYS = 14

// Demo question: a fresh URL opens on it. Demo site is Connecting Ridge (ninja, 14 Nov); the period id is unchanged.
export const DEFAULT_SITE_ID = 'connecting-ridge'
export const DEFAULT_PERIOD_ID = 'shackleton-2027-08'

const VIEWS: SceneLevel[] = ['globe', 'site', 'eye']
const DRAWERS: DrawerSection[] = ['details', 'finder', 'sources']
const ID_RE = /^[a-z0-9][a-z0-9-]{0,80}$/

export const EMPTY_STATE: HashState = {
  site: null,
  period: null,
  from: null,
  days: DEFAULT_DAYS,
  t: null,
  st: null,
  view: 'site',
  drawer: null,
  pts: [],
}

/** "2027-08-16T12:00Z" (minute precision, UTC). */
export function isoMinute(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16) + 'Z'
}

function parseTime(v: string | null): number | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(v)) return null
  const ms = Date.parse(v)
  if (!Number.isFinite(ms) || ms < COVERAGE_START_MS || ms >= COVERAGE_END_MS) return null
  return ms
}

function parsePoints(v: string | null): UserPoint[] {
  if (!v) return []
  const out: UserPoint[] = []
  for (const part of v.split(';').slice(0, 26)) {
    const [a, b] = part.split(',').map(Number)
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && b >= -180 && b <= 360) {
      out.push({ lat: a, lon: b > 180 ? b - 360 : b })
    }
  }
  return out
}

export function parseHash(hash: string): HashState {
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  const s: HashState = { ...EMPTY_STATE, pts: [] }
  const site = p.get('site')
  if (site && ID_RE.test(site)) s.site = site
  const period = p.get('period')
  if (period && ID_RE.test(period)) s.period = period
  s.from = parseTime(p.get('from'))
  const days = Number(p.get('days'))
  if (Number.isInteger(days) && days >= 1 && days <= 60) s.days = days
  s.t = parseTime(p.get('t'))
  const st = p.get('st')
  if (st !== null) {
    const ids = st.split(',').filter((x) => ID_RE.test(x))
    s.st = ids.length ? ids : null
  }
  const view = p.get('view') as SceneLevel | null
  if (view && VIEWS.includes(view)) s.view = view
  const drawer = p.get('drawer') as DrawerSection | null
  if (drawer && DRAWERS.includes(drawer)) s.drawer = drawer
  s.pts = parsePoints(p.get('pts'))
  if (s.period === 'custom' && s.from === null) s.period = null
  return s
}

export function serializeHash(s: HashState): string {
  const p = new URLSearchParams()
  if (s.site) p.set('site', s.site)
  if (s.period) p.set('period', s.period)
  if (s.period === 'custom' && s.from !== null) {
    p.set('from', isoMinute(s.from))
    if (s.days !== DEFAULT_DAYS) p.set('days', String(s.days))
  }
  if (s.t !== null) p.set('t', isoMinute(s.t))
  if (s.st) p.set('st', s.st.join(','))
  if (s.view !== 'site') p.set('view', s.view)
  if (s.drawer) p.set('drawer', s.drawer)
  if (s.pts.length) p.set('pts', s.pts.map((q) => `${q.lat.toFixed(4)},${q.lon.toFixed(4)}`).join(';'))
  // URLSearchParams escapes ',' ':' and ';'; keep the link readable.
  return p.toString().replace(/%2C/g, ',').replace(/%3A/g, ':').replace(/%3B/g, ';')
}

/** Hash state with a throttled writer: scrubbing updates React at once and the URL at most twice a second
 *  (Safari throws after ~100 history calls in 30 s). */
export function useHashState(): [HashState, (patch: Partial<HashState>) => void] {
  const [state, setState] = useState<HashState>(() => parseHash(window.location.hash))
  const timer = useRef<number | null>(null)

  useEffect(() => {
    const onHash = () => setState(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      const h = serializeHash(state)
      if (h !== window.location.hash.replace(/^#/, '')) {
        window.history.replaceState(null, '', h ? `#${h}` : window.location.pathname + window.location.search)
      }
    }, 400)
  }, [state])

  const patch = useCallback((p: Partial<HashState>) => setState((prev) => ({ ...prev, ...p })), [])
  return [state, patch]
}
