// Pure geometry (build-plan §5.2, Brief A). No DOM, no fetch. Mirrors the Python reference scripts/windows.py;
// must match src/test/fixtures.json (T9). Track A owns this folder.
//
// CONTRACT (integrator, 14 Nov): the exported names, signatures and fields below are what C1 (scene3d)
// and C2 (views, data) build against. Track A may rewrite any internals; renaming or reshaping an export
// needs the integrator. Track A additions (backward compatible): optional Series.months (lets windows()
// bisect edges), and the extra exports SUN_RADIUS_KM, EARTH_RADIUS_KM, FLAT_DIP_DEG, angRadiusDeg.
//
// Conventions: MOON_ME planetocentric, east-positive longitude, 1737.4 km sphere; degrees, km, UTC ms.
// Azimuth 0 = north, clockwise. Communications = geometric line of sight to selected Earth stations at both
// ends; never a guaranteed working link.

import type { EphemMonth, Horizon, Quat, Station, Vec3 } from '../data/types'
import type { AnswerState } from './answerSentence'

export { answerSentence } from './answerSentence'
export type { AnswerLines, AnswerState } from './answerSentence'

export const MOON_RADIUS_KM = 1737.4
export const OBSERVER_HEIGHT_M = 1.75

// Disc radii. Sun: IAU 2015 Resolution B3 nominal solar radius. Earth: mean radius 6371.0 km (build-plan §4.4).
export const SUN_RADIUS_KM = 695700
export const EARTH_RADIUS_KM = 6371.0

// Station ellipsoid: WGS 84 (NGA TR8350.2). GRS 80 / ITRF differ by < 0.1 mm at the surface.
const WGS84_A_KM = 6378.137
const WGS84_F = 1 / 298.257223563

const DEG = Math.PI / 180
const HOUR_MS = 3_600_000

/** Horizon dip of a 1.75 m eye on a smooth 1737.4 km sphere: -acos(R / (R + h)) = -0.0813 deg. */
export const FLAT_DIP_DEG = -Math.acos(MOON_RADIUS_KM / (MOON_RADIUS_KM + OBSERVER_HEIGHT_M / 1000)) / DEG

// ---------- vectors and quaternions ----------

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const norm = (a: Vec3) => Math.sqrt(dot(a, a))
const unit = (a: Vec3): Vec3 => {
  const n = norm(a)
  return [a[0] / n, a[1] / n, a[2] / n]
}
/** Elevation (deg) of unit vector d above the plane normal to unit vector up; atan2 stays accurate at the zenith. */
const elevDeg = (d: Vec3, up: Vec3) => Math.atan2(dot(d, up), norm(cross(d, up))) / DEG

type Mat3 = [Vec3, Vec3, Vec3] // rows

/** (x, y, z, w) Hamilton unit quaternion -> M with M v = q v q*. Normalises first. */
function quatToMatrix(q: Quat): Mat3 {
  const n = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3])
  const x = q[0] / n
  const y = q[1] / n
  const z = q[2] / n
  const w = q[3] / n
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ]
}
const mulMV = (m: Mat3, v: Vec3): Vec3 => [dot(m[0], v), dot(m[1], v), dot(m[2], v)]
const mulMtV = (m: Mat3, v: Vec3): Vec3 => [
  m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2],
  m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2],
  m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2],
]

/** Hamilton product a * b; R(a * b) = R(a) R(b). */
function qmul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}
const qconj = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]]

// ---------- ephemeris interpolation ----------

/** Moon centre → body vectors in MOON_ME (km, LT+S) and the two orientations, at one instant. */
export interface BodyState {
  utcMs: number
  sun_km: Vec3
  earth_km: Vec3
  q_me_to_j2000: Quat // (x, y, z, w)
  q_earth_to_me: Quat
}

function lerp3(a: Vec3, b: Vec3, f: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

function slerp(a: Quat, b: Quat, f: number): Quat {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
  let bb: Quat = b
  if (d < 0) {
    d = -d
    bb = [-b[0], -b[1], -b[2], -b[3]]
  }
  let wa: number
  let wb: number
  if (d > 0.9995) {
    wa = 1 - f
    wb = f
  } else {
    const th = Math.acos(d)
    const s = Math.sin(th)
    wa = Math.sin((1 - f) * th) / s
    wb = Math.sin(f * th) / s
  }
  const q: Quat = [
    wa * a[0] + wb * bb[0],
    wa * a[1] + wb * bb[1],
    wa * a[2] + wb * bb[2],
    wa * a[3] + wb * bb[3],
  ]
  const n = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3])
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n]
}

function stateBetween(m0: EphemMonth, i0: number, m1: EphemMonth, i1: number, f: number, utcMs: number): BodyState {
  const qj0 = m0.q_me_to_j2000[i0]
  const qj1 = m1.q_me_to_j2000[i1]
  const q_me_to_j2000 = slerp(qj0, qj1, f)
  // IAU_EARTH → MOON_ME combines Earth's spin and the Moon's rotation about different axes; a plain slerp of it
  // errs by ~0.002 deg mid-step. Slerp IAU_EARTH → J2000 (a near-uniform spin about one axis) instead, then
  // recompose with the interpolated MOON_ME → J2000. Exact at the samples.
  const qe0 = qmul(qj0, m0.q_earth_to_me[i0])
  const qe1 = qmul(qj1, m1.q_earth_to_me[i1])
  const q = qmul(qconj(q_me_to_j2000), slerp(qe0, qe1, f))
  const n = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3])
  return {
    utcMs,
    sun_km: lerp3(m0.sun_km[i0], m1.sun_km[i1], f),
    earth_km: lerp3(m0.earth_km[i0], m1.earth_km[i1], f),
    q_me_to_j2000,
    q_earth_to_me: [q[0] / n, q[1] / n, q[2] / n, q[3] / n],
  }
}

type Interp = (utcMs: number) => BodyState

function makeInterpolator(months: EphemMonth[]): Interp {
  const sorted = [...months]
    .map((m) => ({ m, t0: Date.parse(m.start_utc) }))
    .sort((a, b) => a.t0 - b.t0)
  return (utcMs: number) => {
    for (let j = 0; j < sorted.length; j++) {
      const { m, t0 } = sorted[j]
      const step = m.step_min * 60_000
      const x = (utcMs - t0) / step
      if (x < 0) break
      const i = Math.floor(x)
      if (i < m.n - 1) return stateBetween(m, i, m, i + 1, x - i, utcMs)
      if (i === m.n - 1) {
        if (x === i) return stateBetween(m, i, m, i, 0, utcMs)
        const next = sorted[j + 1]
        if (next && next.t0 === t0 + m.n * step) return stateBetween(m, i, next.m, 0, x - i, utcMs)
      }
    }
    throw new RangeError(`interpolate: ${new Date(utcMs).toISOString()} is outside the loaded ephemeris months`)
  }
}

/** Vectors linear, quaternions slerp (q_earth_to_me via IAU_EARTH → J2000, see stateBetween). Spans month
 *  boundaries when the next month is passed too. Throws RangeError when utcMs is not covered. */
export function interpolate(months: EphemMonth[], utcMs: number): BodyState {
  return makeInterpolator(months)(utcMs)
}

// ---------- site frame ----------

export interface Enu {
  east: Vec3
  north: Vec3
  up: Vec3
}

/** Site position in MOON_ME, km: (1737.4 + h_km) · unit(lat, lon). */
export function siteVector(latDeg: number, lonDeg: number, h_km: number): Vec3 {
  const r = MOON_RADIUS_KM + h_km
  const la = latDeg * DEG
  const lo = lonDeg * DEG
  return [r * Math.cos(la) * Math.cos(lo), r * Math.cos(la) * Math.sin(lo), r * Math.sin(la)]
}

/** up = unit(lat, lon), east = unit(z × up), north = up × east. Undefined exactly at a pole. */
export function enuBasis(latDeg: number, lonDeg: number): Enu {
  if (Math.abs(latDeg) >= 90) throw new RangeError('enuBasis: undefined at the exact pole')
  const up = unit(siteVector(latDeg, lonDeg, 0))
  const east = unit(cross([0, 0, 1], up))
  const north = cross(up, east)
  return { east, north, up }
}

export interface AzEl {
  az: number // deg, 0 = north, clockwise, [0, 360)
  el: number // deg above the local horizontal plane
  dist_km: number // site → body
  dirEnu: Vec3 // unit vector site → body in local ENU (x east, y north, z up)
}

/** Topocentric direction: body − site (Earth parallax up to 0.26°), rotated into ENU. */
export function azEl(body_km: Vec3, site_km: Vec3, enu: Enu): AzEl {
  const d = sub(body_km, site_km)
  const dist_km = norm(d)
  const u: Vec3 = [d[0] / dist_km, d[1] / dist_km, d[2] / dist_km]
  const e = dot(u, enu.east)
  const n = dot(u, enu.north)
  const z = dot(u, enu.up)
  let az = Math.atan2(e, n) / DEG
  if (az < 0) az += 360
  const el = Math.atan2(z, Math.hypot(e, n)) / DEG
  return { az, el, dist_km, dirEnu: [e, n, z] }
}

/** Angular radius (deg) of a sphere of radius_km seen from dist_km. */
export function angRadiusDeg(radius_km: number, dist_km: number): number {
  return Math.asin(radius_km / dist_km) / DEG
}

// ---------- horizon, discs ----------

export interface SiteGeo {
  lat: number
  lon: number
  elev_m: number | null // null → 0 on the sphere; the UI labels it
}

/** Eye height above the 1737.4 km sphere: terrain height (null → 0) + 1.75 m. */
const siteHeightKm = (elev_m: number | null) => ((elev_m ?? 0) + OBSERVER_HEIGHT_M) / 1000

/** Terrain mask at an azimuth (linear between 0.5° samples); null horizon → flat-sphere dip for 1.75 m. */
export function maskAt(horizon: Horizon | null, azDeg: number): number {
  if (!horizon) return FLAT_DIP_DEG
  const mask = horizon.mask
  const n = mask.length
  const x = (((azDeg % 360) + 360) % 360) / horizon.az_step
  let i0 = Math.floor(x)
  const f = x - i0
  i0 = ((i0 % n) + n) % n
  const i1 = (i0 + 1) % n
  return mask[i0] + (mask[i1] - mask[i0]) * f
}

/** Visible share (0..1) of a disc of angular radius angRadiusDeg centred at elDeg above a horizon at maskDeg.
 *  Circular segment above a straight horizon line; mask slope across the disc is ignored (build-plan §4.4). */
export function discFraction(elDeg: number, maskDeg: number, angRadiusDeg: number): number {
  const c = (maskDeg - elDeg) / angRadiusDeg
  if (c <= -1) return 1
  if (c >= 1) return 0
  return (Math.acos(c) - c * Math.sqrt(1 - c * c)) / Math.PI
}

// ---------- Earth stations ----------

export type LosState = 'los' | 'blocked'

export interface StationLos {
  az: number // station direction seen from the site
  el: number
  moonElAtStation: number // site's elevation above the station's geodetic horizon
  state: LosState
  reason: 'terrain' | 'station-mask' | null
}

interface StationPre {
  st: Station
  ef: Vec3 // Earth-fixed position, km (WGS 84)
  up: Vec3 // geodetic normal
}

function prepStation(st: Station): StationPre {
  const la = st.lat_deg * DEG
  const lo = st.lon_deg * DEG
  const e2 = WGS84_F * (2 - WGS84_F)
  const sl = Math.sin(la)
  const nn = WGS84_A_KM / Math.sqrt(1 - e2 * sl * sl)
  const h = st.h_m / 1000
  return {
    st,
    ef: [(nn + h) * Math.cos(la) * Math.cos(lo), (nn + h) * Math.cos(la) * Math.sin(lo), (nn * (1 - e2) + h) * sl],
    up: [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)],
  }
}

interface SiteCtx {
  siteKm: Vec3
  enu: Enu
  horizon: Horizon | null
}

function siteCtx(site: SiteGeo, horizon: Horizon | null): SiteCtx {
  return { siteKm: siteVector(site.lat, site.lon, siteHeightKm(site.elev_m)), enu: enuBasis(site.lat, site.lon), horizon }
}

// Station in MOON_ME = earth_km + R(q_earth_to_me) · s_earthfixed (IAU_EARTH approximates the terrestrial frame).
// Station end: site relative to Earth's centre, rotated back into the Earth-fixed frame, minus the station.
function losAt(p: StationPre, c: SiteCtx, s: BodyState, R: Mat3): StationLos {
  const sMe: Vec3 = (() => {
    const r = mulMV(R, p.ef)
    return [s.earth_km[0] + r[0], s.earth_km[1] + r[1], s.earth_km[2] + r[2]]
  })()
  const a = azEl(sMe, c.siteKm, c.enu)
  const vEf = mulMtV(R, sub(c.siteKm, s.earth_km))
  const moonElAtStation = elevDeg(unit(sub(vEf, p.ef)), p.up)
  const terrainOk = a.el > maskAt(c.horizon, a.az)
  const stationOk = moonElAtStation >= p.st.min_elev_deg
  const reason = terrainOk && stationOk ? null : !terrainOk ? 'terrain' : 'station-mask'
  return { az: a.az, el: a.el, moonElAtStation, state: reason === null ? 'los' : 'blocked', reason }
}

/** Both ends (Brief A trap 7): the station above the terrain mask seen from the site (site vector subtracted) AND
 *  the site at or above the station's min_elev_deg. Terrain is reported first when both fail. */
export function stationLos(station: Station, site: SiteGeo, s: BodyState, horizon: Horizon | null): StationLos {
  return losAt(prepStation(station), siteCtx(site, horizon), s, quatToMatrix(s.q_earth_to_me))
}

// ---------- series ----------

export type CoverageState = 'covered' | 'none' | 'unknown'

export interface Sample {
  utcMs: number
  sun: AzEl & { mask: number; frac: number; lit: boolean }
  earth: AzEl & { mask: number; frac: number; visible: boolean }
  stations: Record<string, StationLos> // by station id
}

export interface Series {
  site: SiteGeo
  horizon: Horizon | null
  stations: Station[]
  startMs: number // [startMs, endMs)
  endMs: number
  stepMin: number
  samples: Sample[]
  months?: EphemMonth[] // set by computeSeries; lets windows() bisect edges to ±1 min
}

function sampleAt(c: SiteCtx, pre: StationPre[], s: BodyState): Sample {
  const sun = azEl(s.sun_km, c.siteKm, c.enu)
  const sunMask = maskAt(c.horizon, sun.az)
  const sunFrac = discFraction(sun.el, sunMask, angRadiusDeg(SUN_RADIUS_KM, sun.dist_km))
  const earth = azEl(s.earth_km, c.siteKm, c.enu)
  const earthMask = maskAt(c.horizon, earth.az)
  const earthFrac = discFraction(earth.el, earthMask, angRadiusDeg(EARTH_RADIUS_KM, earth.dist_km))
  const R = quatToMatrix(s.q_earth_to_me)
  const stations: Record<string, StationLos> = {}
  for (const p of pre) stations[p.st.id] = losAt(p, c, s, R)
  return {
    utcMs: s.utcMs,
    sun: { ...sun, mask: sunMask, frac: sunFrac, lit: sunFrac > 0 },
    earth: { ...earth, mask: earthMask, frac: earthFrac, visible: earthFrac > 0 },
    stations,
  }
}

export function computeSeries(
  months: EphemMonth[],
  site: SiteGeo,
  horizon: Horizon | null,
  stations: Station[],
  startMs: number,
  endMs: number,
  stepMin = 30,
): Series {
  const at = makeInterpolator(months)
  const c = siteCtx(site, horizon)
  const pre = stations.map(prepStation)
  const step = stepMin * 60_000
  const samples: Sample[] = []
  for (let k = 0; startMs + k * step < endMs; k++) samples.push(sampleAt(c, pre, at(startMs + k * step)))
  return { site, horizon, stations, startMs, endMs, stepMin, samples, months }
}

function coverageOf(sample: Sample, stationIds: string[]): CoverageState {
  let missing = false
  for (const id of stationIds) {
    const r = sample.stations[id]
    if (!r) missing = true
    else if (r.state === 'los') return 'covered'
  }
  return missing ? 'unknown' : 'none'
}

/** Per sample: union over the selected stations, never double-counted; 'unknown' only where an input is missing
 *  (a selected station without a result). An empty selection gives 'none'. */
export function coverage(series: Series, stationIds: string[]): CoverageState[] {
  return series.samples.map((s) => coverageOf(s, stationIds))
}

// ---------- windows ----------

export interface Window {
  kind: 'sun' | 'earth' | 'coverage'
  startMs: number
  endMs: number
  state: 'lit' | 'dark' | 'visible' | 'hidden' | 'covered' | 'none' | 'unknown'
}

function stateOf(kind: Window['kind'], s: Sample, ids: string[]): Window['state'] {
  if (kind === 'sun') return s.sun.lit ? 'lit' : 'dark'
  if (kind === 'earth') return s.earth.visible ? 'visible' : 'hidden'
  return coverageOf(s, ids)
}

/** Contiguous runs, edges refined by bisection to ±1 min on the interpolated ephemeris (needs series.months;
 *  without it the edge falls midway between samples), clipped to [startMs, endMs). A state change that
 *  starts and ends between two samples is not seen. Coverage defaults to all series stations. */
export function windows(series: Series, kind: Window['kind'], stationIds?: string[]): Window[] {
  const ids = stationIds ?? series.stations.map((s) => s.id)
  const { samples } = series
  if (samples.length === 0) return []
  let refine: ((lo: number, hi: number, a: Window['state']) => number) | null = null
  if (series.months) {
    const at = makeInterpolator(series.months)
    const c = siteCtx(series.site, series.horizon)
    const pre = series.stations.filter((s) => kind !== 'coverage' || ids.includes(s.id)).map(prepStation)
    refine = (lo, hi, a) => {
      while (hi - lo > 60_000) {
        const mid = lo + (hi - lo) / 2
        if (stateOf(kind, sampleAt(c, pre, at(mid)), ids) === a) lo = mid
        else hi = mid
      }
      return Math.round(lo + (hi - lo) / 2)
    }
  }
  const out: Window[] = []
  let cur = stateOf(kind, samples[0], ids)
  let start = series.startMs
  for (let k = 1; k < samples.length; k++) {
    const st = stateOf(kind, samples[k], ids)
    if (st === cur) continue
    const lo = samples[k - 1].utcMs
    const hi = samples[k].utcMs
    const edge = refine ? refine(lo, hi, cur) : Math.round((lo + hi) / 2)
    out.push({ kind, startMs: start, endMs: edge, state: cur })
    start = edge
    cur = st
  }
  out.push({ kind, startMs: start, endMs: series.endMs, state: cur })
  return out
}

// ---------- summaries ----------

export interface Summary {
  litPct: number
  earthVisiblePct: number
  coveragePct: number
  unknownPct: number
  longestDarkH: number
  longestGapH: number
}

const pctOf = (ws: Window[], state: Window['state'], total: number) =>
  (100 * ws.filter((w) => w.state === state).reduce((a, w) => a + (w.endMs - w.startMs), 0)) / total
const longestH = (ws: Window[], state: Window['state']) =>
  ws.filter((w) => w.state === state).reduce((a, w) => Math.max(a, (w.endMs - w.startMs) / HOUR_MS), 0)

/** Time-weighted over [startMs, endMs) using the refined windows. Longest dark / gap are clipped to the period;
 *  a gap is 'none' time only (unknown time is reported separately). */
export function summarize(series: Series, stationIds: string[]): Summary {
  const total = series.endMs - series.startMs
  const sun = windows(series, 'sun')
  const earth = windows(series, 'earth')
  const cov = windows(series, 'coverage', stationIds)
  return {
    litPct: pctOf(sun, 'lit', total),
    earthVisiblePct: pctOf(earth, 'visible', total),
    coveragePct: pctOf(cov, 'covered', total),
    unknownPct: pctOf(cov, 'unknown', total),
    longestDarkH: longestH(sun, 'dark'),
    longestGapH: longestH(cov, 'none'),
  }
}

// Range of the sub-Earth point in MOON_ME over 2026-11 .. 2030-12, derived from the shipped ephem files
// (lat -6.86..6.85 deg, lon -8.05..8.05 deg, distance >= 356 652 km), widened by 0.5 deg.
const LIB_LAT = 7.4
const LIB_LON = 8.6
const LIB_MIN_DIST_KM = 356_600

/** Conservative: false only when no Earth direction inside the libration box shows any part of the disc. */
function earthCanEverRise(site: SiteGeo, horizon: Horizon | null): boolean {
  const c = siteCtx(site, horizon)
  const r = angRadiusDeg(EARTH_RADIUS_KM, LIB_MIN_DIST_KM)
  for (let la = -LIB_LAT; la <= LIB_LAT + 1e-9; la += 0.25) {
    for (let lo = -LIB_LON; lo <= LIB_LON + 1e-9; lo += 0.25) {
      const a = azEl(siteVector(la, lo, LIB_MIN_DIST_KM - MOON_RADIUS_KM), c.siteKm, c.enu)
      if (discFraction(a.el, maskAt(horizon, a.az), r) > 0) return true
    }
  }
  return false
}

/** Inputs for answerSentence at the cursor time. Throws RangeError outside [startMs, endMs).
 *  earthEverRises: true if Earth is visible at any sample of the series, or could be visible for some libration
 *  state (so "Earth never rises here" is only said when it holds for every libration state). */
export function answerState(series: Series, stationIds: string[], utcMs: number): AnswerState {
  if (!(utcMs >= series.startMs && utcMs < series.endMs)) {
    throw new RangeError(`answerState: ${new Date(utcMs).toISOString()} is outside the series`)
  }
  const find = (ws: Window[]) => ws.find((w) => w.startMs <= utcMs && utcMs < w.endMs) ?? ws[ws.length - 1]
  const sw = windows(series, 'sun')
  const cw = windows(series, 'coverage', stationIds)
  const s = find(sw)
  const c = find(cw)
  return {
    sunLit: s.state === 'lit',
    sunHoursToChange: (s.endMs - utcMs) / HOUR_MS,
    sunChangeInPeriod: s.endMs < series.endMs,
    comms: c.state as CoverageState,
    commsHoursToChange: (c.endMs - utcMs) / HOUR_MS,
    commsChangeInPeriod: c.endMs < series.endMs,
    anyCoverageInPeriod: cw.some((w) => w.state === 'covered'),
    earthEverRises: series.samples.some((x) => x.earth.visible) || earthCanEverRise(series.site, series.horizon),
  }
}

// ---------- landing window finder (build-plan §4.4, ranked by combined coverage per spec.md) ----------

export interface FinderThresholds {
  missionDays: number
  minLitPct: number
  minCoveragePct: number
  maxGapH: number
  maxDarkH: number
}

// Proposed defaults (spec.md, ninja 14 Nov); Leo reviews the values. Every value is editable in the UI.
export const FINDER_DEFAULTS: FinderThresholds = {
  missionDays: 14,
  minLitPct: 70,
  minCoveragePct: 50,
  maxGapH: 48,
  maxDarkH: 72,
}

export interface FinderWindow {
  startMs: number // landing-time window: first qualifying landing time
  endMs: number // last qualifying landing time (inclusive; candidates are 6 h apart)
  best: { landingMs: number; litPct: number; coveragePct: number; longestGapH: number; longestDarkH: number }
}

export interface FinderResult {
  windows: FinderWindow[] // ranked by combined selected-station coverage (spec), ties shown
  nearestMiss: { landingMs: number; failed: (keyof FinderThresholds)[] } | null
}

const CANDIDATE_STEP_MS = 6 * HOUR_MS
const FINDER_STEP_MIN = 30

/** Candidate landing times every 6 h in [earliestMs, latestMs]; each mission [landing, landing + missionDays)
 *  is scored on the 30-min samples (prefix sums; sample-based, not edge-refined). Qualifying neighbours merge
 *  into windows, ranked by best coverage, then lit %, then date. No qualifying candidate → nearest miss (fewest
 *  failed thresholds, then highest coverage). `months` must cover [earliestMs, latestMs + missionDays). */
export function finder(
  months: EphemMonth[],
  site: SiteGeo,
  horizon: Horizon | null,
  stations: Station[],
  stationIds: string[],
  earliestMs: number,
  latestMs: number,
  t: FinderThresholds,
): FinderResult {
  const stepMs = FINDER_STEP_MIN * 60_000
  const perMission = Math.round((t.missionDays * 24 * HOUR_MS) / stepMs)
  const series = computeSeries(months, site, horizon, stations, earliestMs, latestMs + perMission * stepMs, FINDER_STEP_MIN)
  const n = series.samples.length
  const dark = series.samples.map((s) => !s.sun.lit)
  const cov = coverage(series, stationIds)
  const gap = cov.map((c) => c === 'none')
  const litP = new Int32Array(n + 1)
  const covP = new Int32Array(n + 1)
  for (let k = 0; k < n; k++) {
    litP[k + 1] = litP[k] + (dark[k] ? 0 : 1)
    covP[k + 1] = covP[k] + (cov[k] === 'covered' ? 1 : 0)
  }
  const longestRunH = (flags: boolean[], a: number, b: number) => {
    let best = 0
    let run = 0
    for (let k = a; k < b; k++) {
      run = flags[k] ? run + 1 : 0
      if (run > best) best = run
    }
    return (best * stepMs) / HOUR_MS
  }

  type Cand = FinderWindow['best'] & { failed: (keyof FinderThresholds)[] }
  const cands: Cand[] = []
  for (let c = earliestMs; c <= latestMs; c += CANDIDATE_STEP_MS) {
    const k0 = Math.round((c - earliestMs) / stepMs)
    const k1 = k0 + perMission
    if (k1 > n || perMission <= 0) break
    const litPct = (100 * (litP[k1] - litP[k0])) / perMission
    const coveragePct = (100 * (covP[k1] - covP[k0])) / perMission
    const longestGapH = longestRunH(gap, k0, k1)
    const longestDarkH = longestRunH(dark, k0, k1)
    const failed: (keyof FinderThresholds)[] = []
    if (litPct < t.minLitPct) failed.push('minLitPct')
    if (coveragePct < t.minCoveragePct) failed.push('minCoveragePct')
    if (longestGapH > t.maxGapH) failed.push('maxGapH')
    if (longestDarkH > t.maxDarkH) failed.push('maxDarkH')
    cands.push({ landingMs: c, litPct, coveragePct, longestGapH, longestDarkH, failed })
  }

  const better = (a: Cand, b: Cand) =>
    a.coveragePct !== b.coveragePct ? a.coveragePct > b.coveragePct : a.litPct !== b.litPct ? a.litPct > b.litPct : a.landingMs < b.landingMs
  const strip = ({ landingMs, litPct, coveragePct, longestGapH, longestDarkH }: Cand) => ({
    landingMs,
    litPct,
    coveragePct,
    longestGapH,
    longestDarkH,
  })

  const wins: FinderWindow[] = []
  let open: { startMs: number; endMs: number; best: Cand } | null = null
  for (const c of cands) {
    if (c.failed.length === 0) {
      if (open) {
        open.endMs = c.landingMs
        if (better(c, open.best)) open.best = c
      } else open = { startMs: c.landingMs, endMs: c.landingMs, best: c }
    } else if (open) {
      wins.push({ startMs: open.startMs, endMs: open.endMs, best: strip(open.best) })
      open = null
    }
  }
  if (open) wins.push({ startMs: open.startMs, endMs: open.endMs, best: strip(open.best) })
  wins.sort((a, b) =>
    b.best.coveragePct !== a.best.coveragePct
      ? b.best.coveragePct - a.best.coveragePct
      : b.best.litPct !== a.best.litPct
        ? b.best.litPct - a.best.litPct
        : a.startMs - b.startMs,
  )

  let nearestMiss: FinderResult['nearestMiss'] = null
  if (wins.length === 0 && cands.length > 0) {
    let m = cands[0]
    for (const c of cands) {
      if (c.failed.length < m.failed.length || (c.failed.length === m.failed.length && c.coveragePct > m.coveragePct)) m = c
    }
    nearestMiss = { landingMs: m.landingMs, failed: m.failed }
  }
  return { windows: wins, nearestMiss }
}
