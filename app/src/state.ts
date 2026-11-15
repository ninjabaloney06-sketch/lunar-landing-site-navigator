// URL-hash state (build-plan §5.2): site, cursor time, period, selected stations, view, drawer, user
// points, mission name, science goal, the points-of-interest layer and the flight plan's choices (launchpad, rocket,
// transfer time, surface stay). A copied link reproduces the view. Parsing never throws and never
// yields NaN: anything invalid falls back to the default for that key.
import { useCallback, useEffect, useState } from 'react'
import { parseCustomSiteId } from './data/customSite'
import { POI_GROUPS } from './data/pois'
import type { PoiGroup } from './data/pois'
import type { ScienceGoal } from './geometry'
import type { SceneLevel } from './scene3d'

// 'search' (site search by nearby POIs) and 'docs' (documentation) are panels of their own, opened from the top bar
// and the footer; the other three are sections of the details drawer.
export type DrawerSection = 'details' | 'finder' | 'sources' | 'search' | 'docs'

/** A place the user marked: planetocentric lat/lon in the Moon body-fixed frame (MOON_ME), degrees, east-positive.
 *  It has no horizon file, so nothing is computed for it. */
export interface UserPoint {
  lat: number
  lon: number
  name: string | null // null = "Point A", "Point B", … by position (links written before names existed)
}

export const MAX_POINTS = 26

export interface HashState {
  site: string | null // site id or custom site id (see "landing site" below); null = default site
  period: string | null // period id, 'custom', or null = default period
  from: number | null // custom period start, UTC ms
  days: number // custom period length
  t: number | null // cursor, UTC ms
  st: string[] | null // selected station ids; null = all stations (default)
  view: SceneLevel
  drawer: DrawerSection | null
  pts: UserPoint[]
  name: string | null // mission name, plain text; null = DEFAULT_MISSION_NAME
  goal: ScienceGoal
  poi: PoiGroup[] | null // points-of-interest layer: null = off (the default; absent from the link), else the groups shown
  pad: string | null // flight plan: launchpad id; null = the default pad
  rocket: string | null // flight plan: vehicle id; null = the default vehicle
  tmax: number | null // flight plan: longest transfer in days; null = minimum energy
  stay: number | null // flight plan: surface stay in days; null = the chosen design's default
}

// Supported coverage (spec.md "Dates"): [2026-11-01, 2031-01-01) UTC.
export const COVERAGE_START_MS = Date.UTC(2026, 10, 1)
export const COVERAGE_END_MS = Date.UTC(2031, 0, 1)
const STEP_MIN = 30
export const STEP_MS = STEP_MIN * 60_000
export const DAY_MS = 86_400_000
export const DEFAULT_DAYS = 14

// Simulate (Brief C4 part 4): hours of mission time per second of real time. 10 is the pace "Play mission" has
// always had (one 30-minute step every 50 ms).
export const SPEEDS_H_PER_S = [3, 10, 24, 72]
export const DEFAULT_SPEED_H_PER_S = 10

// Demo question: a fresh URL opens on it. Demo site is Connecting Ridge (ninja, 14 Nov); the period id is unchanged.
export const DEFAULT_SITE_ID = 'connecting-ridge'
export const DEFAULT_PERIOD_ID = 'shackleton-2027-08'

const VIEWS: SceneLevel[] = ['globe', 'site', 'eye', 'flight']
const DRAWERS: DrawerSection[] = ['details', 'finder', 'sources', 'search', 'docs']
const POI_IDS: PoiGroup[] = POI_GROUPS.map((g) => g.id)
export const GOALS: ScienceGoal[] = ['any', 'water-ice', 'cold-trap', 'light', 'science']
const ID_RE = /^[a-z0-9][a-z0-9-]{0,80}$/
export const NAME_MAX = 40
export const MAX_DAYS = 60
// Defaults decided by ninja, 14 Nov: a neutral mission name, and the goal whose ranking uses our own numbers.
export const DEFAULT_MISSION_NAME = 'Mission 1'
const DEFAULT_GOAL: ScienceGoal = 'light'
// Transfer-time caps the flight plan offers (days); anything else in a link falls back to minimum energy.
const TRANSFER_CAPS = [4.5, 4, 3.5, 3, 2.5]
// Surface stays the flight plan accepts (days): 0.5 to 30; anything else falls back to the design's default.
const STAY_RANGE = { min: 0.5, max: 30 }
const validStay = (v: number) => Number.isFinite(v) && v >= STAY_RANGE.min && v <= STAY_RANGE.max

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
  name: null,
  goal: DEFAULT_GOAL,
  poi: null,
  pad: null,
  rocket: null,
  tmax: null,
  stay: null,
}

/** Mission name as plain text: control characters dropped, runs of white space collapsed, at most 40
 *  characters. Empty → null (DEFAULT_MISSION_NAME is shown). React renders it as text, never as markup. */
export function cleanName(v: string | null): string | null {
  if (v === null) return null
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim()
  const cut = Array.from(s).slice(0, NAME_MAX).join('').trim()
  return cut || null
}

/** Supported date range (spec.md "Dates"), shared by the date menu and the Mission panel. */
export const RANGE_ERROR = 'Dates from 1 November 2026 to 31 December 2030 (UTC) are supported.'
export const inCoverage = (ms: number) => ms >= COVERAGE_START_MS && ms < COVERAGE_END_MS

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

// ---------- landing site ----------
// Link format: site=<id> for a site of sites.json (ID_RE, as every link before custom sites), or
// site=cap:<lat>,<lon> for a custom landing site, latitude and longitude with exactly five decimals as
// data/customSite.customSiteId writes them (e.g. site=cap:-85.50000,12.25000). The two forms cannot be confused
// (ID_RE has no ':'), so every older link reads as before. A cap: value in another form, or outside the pin region,
// is ignored (default site).

function parseSite(v: string | null): string | null {
  if (!v) return null
  return ID_RE.test(v) || parseCustomSiteId(v) ? v : null
}

// ---------- points-of-interest layer ----------
// Link format: absent = layer off; poi=all = every group; poi=none = on with no group; else poi=hazard,water,…
// (POI_GROUPS order). Unknown words are dropped; a value with no known group and not "none" is ignored (off).

function parsePoi(v: string | null): PoiGroup[] | null {
  if (v === null) return null
  if (v === 'all') return [...POI_IDS]
  if (v === 'none') return []
  const words = v.split(',')
  const groups = POI_IDS.filter((g) => words.includes(g))
  return groups.length ? groups : null
}

function serializePoi(groups: PoiGroup[]): string {
  const known = POI_IDS.filter((g) => groups.includes(g))
  if (known.length === POI_IDS.length) return 'all'
  return known.length ? known.join(',') : 'none'
}

// ---------- user points ----------
// Link format: pts=lat,lon[,,name];… The third field held a point role ("s" Start, "e" End) until U10 removed
// roles; it is written empty and ignored when read, whatever it holds, so every older link still parses with its
// names. The first form, "lat,lon;lat,lon", is what the oldest links hold. In a name "%", "," and ";" are written
// %25, %2C and %3B, so the separators stay unambiguous.

const escapeName = (s: string) => s.replace(/[%,;]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
const unescapeName = (s: string) => s.replace(/%(25|2C|3B)/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))

function parsePoints(v: string | null): UserPoint[] {
  if (!v) return []
  const out: UserPoint[] = []
  for (const part of v.split(';').slice(0, MAX_POINTS)) {
    const [la, lo, , ...rest] = part.split(',') // third field: a legacy role, ignored
    const a = Number(la)
    const b = Number(lo)
    if (la === '' || lo === undefined || lo === '' || !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || b < -180 || b > 360) continue
    out.push({ lat: a, lon: b > 180 ? b - 360 : b, name: cleanName(rest.length ? unescapeName(rest.join(',')) : null) })
  }
  return out
}

function serializePoints(pts: UserPoint[]): string {
  return pts
    .map((q) => {
      const base = `${q.lat.toFixed(4)},${q.lon.toFixed(4)}`
      return q.name ? `${base},,${escapeName(q.name)}` : base
    })
    .join(';')
}

const letterName = (i: number) => `Point ${String.fromCharCode(65 + i)}`

/** The name shown for point i: its own, or "Point A", "Point B", … by position. */
export function pointName(p: UserPoint, i: number): string {
  return p.name ?? letterName(i)
}

/** Every point with its name written out, so that adding or deleting one never renames another. */
function named(pts: UserPoint[]): UserPoint[] {
  return pts.map((p, i) => (p.name ? p : { ...p, name: pointName(p, i) }))
}

function freeName(pts: UserPoint[]): string {
  const used = new Set(pts.map(pointName))
  for (let i = 0; i < MAX_POINTS; i++) if (!used.has(letterName(i))) return letterName(i)
  return letterName(0)
}

/** A new point at the end of the list, or null when the list is full or the coordinates are not on the Moon. */
export function addPoint(pts: UserPoint[], lat: number, lon: number): UserPoint[] | null {
  if (pts.length >= MAX_POINTS || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90) return null
  const lo = ((((lon + 180) % 360) + 360) % 360) - 180
  const all = named(pts)
  return [...all, { lat, lon: lo, name: freeName(all) }]
}

/** Renames point i (cleanName rules); an empty name gives it a free "Point X" name back. */
export function renamePoint(pts: UserPoint[], i: number, name: string): UserPoint[] {
  const all = named(pts)
  const rest = all.filter((_, j) => j !== i)
  return all.map((p, j) => (j === i ? { ...p, name: cleanName(name) ?? freeName(rest) } : p))
}

export function removePoint(pts: UserPoint[], i: number): UserPoint[] {
  return named(pts).filter((_, j) => j !== i)
}

export function parseHash(hash: string): HashState {
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  const s: HashState = { ...EMPTY_STATE, pts: [] }
  s.site = parseSite(p.get('site'))
  const period = p.get('period')
  if (period && ID_RE.test(period)) s.period = period
  s.from = parseTime(p.get('from'))
  const days = Number(p.get('days'))
  if (Number.isInteger(days) && days >= 1 && days <= MAX_DAYS) s.days = days
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
  s.name = cleanName(p.get('name'))
  const goal = p.get('goal') as ScienceGoal | null
  if (goal && GOALS.includes(goal)) s.goal = goal
  s.poi = parsePoi(p.get('poi'))
  const pad = p.get('pad')
  if (pad && ID_RE.test(pad)) s.pad = pad
  const rocket = p.get('rocket')
  if (rocket && ID_RE.test(rocket)) s.rocket = rocket
  const tmax = Number(p.get('tmax'))
  if (TRANSFER_CAPS.includes(tmax)) s.tmax = tmax
  const stayRaw = p.get('stay')
  if (stayRaw !== null && stayRaw !== '' && validStay(Number(stayRaw))) s.stay = Math.round(Number(stayRaw) * 100) / 100
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
  if (s.pts.length) p.set('pts', serializePoints(s.pts))
  if (s.name) p.set('name', s.name)
  if (s.goal !== DEFAULT_GOAL) p.set('goal', s.goal)
  if (s.poi) p.set('poi', serializePoi(s.poi))
  if (s.pad) p.set('pad', s.pad)
  if (s.rocket) p.set('rocket', s.rocket)
  if (s.tmax !== null) p.set('tmax', String(s.tmax))
  if (s.stay !== null) p.set('stay', String(s.stay))
  // URLSearchParams escapes ',' ':' and ';'; keep the link readable.
  return p.toString().replace(/%2C/g, ',').replace(/%3A/g, ':').replace(/%3B/g, ';')
}

/** Hash state with a debounced writer: scrubbing updates React at once and the URL 400 ms after the last
 *  change (Safari throws after ~100 history calls in 30 s). */
export function useHashState(): [HashState, (patch: Partial<HashState>) => void] {
  const [state, setState] = useState<HashState>(() => parseHash(window.location.hash))

  useEffect(() => {
    const onHash = () => setState(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const h = serializeHash(state)
      if (h !== window.location.hash.replace(/^#/, '')) {
        window.history.replaceState(null, '', h ? `#${h}` : window.location.pathname + window.location.search)
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [state])

  const patch = useCallback((p: Partial<HashState>) => setState((prev) => ({ ...prev, ...p })), [])
  return [state, patch]
}
