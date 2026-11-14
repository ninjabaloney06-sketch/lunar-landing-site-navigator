// Pure geometry (build-plan §5.2, Brief A). No DOM, no fetch. Mirrors the Python reference; must match
// src/test/fixtures.json (T9). Track A owns this folder.
//
// CONTRACT (integrator, 14 Nov): the exported names, signatures and fields below are what C1 (scene3d)
// and C2 (views, data) build against. Track A may rewrite any internals; renaming or reshaping an export
// needs the integrator. The four primitives (interpolate, siteVector, enuBasis, azEl) are an integrator
// draft written from the preamble's definitions so C1/C2 can place objects before Track A merges; Track A
// verifies them with T4/T9. Everything marked TRACK A throws until Track A implements it.

import type { EphemMonth, Horizon, Quat, Station, Vec3 } from '../data/types'
import type { AnswerState } from './answerSentence'

export { answerSentence } from './answerSentence'
export type { AnswerLines, AnswerState } from './answerSentence'

export const MOON_RADIUS_KM = 1737.4
export const OBSERVER_HEIGHT_M = 1.75

const DEG = Math.PI / 180

function todo(name: string): never {
  throw new Error(`geometry.${name}: not implemented yet (Track A)`)
}

// ---------- vectors ----------

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const norm = (a: Vec3) => Math.sqrt(dot(a, a))
const unit = (a: Vec3): Vec3 => {
  const n = norm(a)
  return [a[0] / n, a[1] / n, a[2] / n]
}

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
  const n = Math.hypot(q[0], q[1], q[2], q[3])
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n]
}

function stateBetween(m0: EphemMonth, i0: number, m1: EphemMonth, i1: number, f: number, utcMs: number): BodyState {
  return {
    utcMs,
    sun_km: lerp3(m0.sun_km[i0], m1.sun_km[i1], f),
    earth_km: lerp3(m0.earth_km[i0], m1.earth_km[i1], f),
    q_me_to_j2000: slerp(m0.q_me_to_j2000[i0], m1.q_me_to_j2000[i1], f),
    q_earth_to_me: slerp(m0.q_earth_to_me[i0], m1.q_earth_to_me[i1], f),
  }
}

/** Vectors linear, quaternions slerp. Spans month boundaries when the next month is passed too.
 *  Throws RangeError when utcMs is not covered by the months given. */
export function interpolate(months: EphemMonth[], utcMs: number): BodyState {
  const sorted = [...months].sort((a, b) => Date.parse(a.start_utc) - Date.parse(b.start_utc))
  for (let j = 0; j < sorted.length; j++) {
    const m = sorted[j]
    const t0 = Date.parse(m.start_utc)
    const step = m.step_min * 60_000
    const x = (utcMs - t0) / step
    if (x < 0) break
    const i = Math.floor(x)
    if (i < m.n - 1) return stateBetween(m, i, m, i + 1, x - i, utcMs)
    if (i === m.n - 1) {
      if (x === i) return stateBetween(m, i, m, i, 0, utcMs)
      const next = sorted[j + 1]
      if (next && Date.parse(next.start_utc) === t0 + m.n * step) return stateBetween(m, i, next, 0, x - i, utcMs)
    }
  }
  throw new RangeError(`interpolate: ${new Date(utcMs).toISOString()} is outside the loaded ephemeris months`)
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
  const d: Vec3 = [body_km[0] - site_km[0], body_km[1] - site_km[1], body_km[2] - site_km[2]]
  const dist_km = norm(d)
  const u: Vec3 = [d[0] / dist_km, d[1] / dist_km, d[2] / dist_km]
  const e = dot(u, enu.east)
  const n = dot(u, enu.north)
  const z = dot(u, enu.up)
  let az = Math.atan2(e, n) / DEG
  if (az < 0) az += 360
  const el = Math.asin(Math.max(-1, Math.min(1, z))) / DEG
  return { az, el, dist_km, dirEnu: [e, n, z] }
}

// ---------- TRACK A: horizon, discs, stations, series, windows, finder ----------

export interface SiteGeo {
  lat: number
  lon: number
  elev_m: number | null // null → 0 on the sphere; the UI labels it
}

/** Terrain mask at an azimuth (linear between 0.5° samples); null horizon → flat-sphere dip for 1.75 m. */
export function maskAt(horizon: Horizon | null, azDeg: number): number {
  void horizon
  void azDeg
  return todo('maskAt')
}

/** Visible share (0..1) of a disc of angular radius angRadiusDeg centred at elDeg above a horizon at maskDeg. */
export function discFraction(elDeg: number, maskDeg: number, angRadiusDeg: number): number {
  void elDeg
  void maskDeg
  void angRadiusDeg
  return todo('discFraction')
}

export type LosState = 'los' | 'blocked'

export interface StationLos {
  az: number // station direction seen from the site
  el: number
  moonElAtStation: number // site's elevation above the station's geodetic horizon
  state: LosState
  reason: 'terrain' | 'station-mask' | null
}

export function stationLos(station: Station, site: SiteGeo, s: BodyState, horizon: Horizon | null): StationLos {
  void station
  void site
  void s
  void horizon
  return todo('stationLos')
}

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
  void [months, site, horizon, stations, startMs, endMs, stepMin]
  return todo('computeSeries')
}

/** Per sample: union over the selected stations, never double-counted; 'unknown' only where an input is missing. */
export function coverage(series: Series, stationIds: string[]): CoverageState[] {
  void [series, stationIds]
  return todo('coverage')
}

export interface Window {
  kind: 'sun' | 'earth' | 'coverage'
  startMs: number
  endMs: number
  state: 'lit' | 'dark' | 'visible' | 'hidden' | 'covered' | 'none' | 'unknown'
}

/** Contiguous runs, edges refined by bisection to ±1 min, clipped to [startMs, endMs). */
export function windows(series: Series, kind: Window['kind'], stationIds?: string[]): Window[] {
  void [series, kind, stationIds]
  return todo('windows')
}

export interface Summary {
  litPct: number
  earthVisiblePct: number
  coveragePct: number
  unknownPct: number
  longestDarkH: number
  longestGapH: number
}

export function summarize(series: Series, stationIds: string[]): Summary {
  void [series, stationIds]
  return todo('summarize')
}

/** Inputs for answerSentence at the cursor time. */
export function answerState(series: Series, stationIds: string[], utcMs: number): AnswerState {
  void [series, stationIds, utcMs]
  return todo('answerState')
}

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
  startMs: number // landing-time window
  endMs: number
  best: { landingMs: number; litPct: number; coveragePct: number; longestGapH: number; longestDarkH: number }
}

export interface FinderResult {
  windows: FinderWindow[] // ranked by combined selected-station coverage (spec), ties shown
  nearestMiss: { landingMs: number; failed: (keyof FinderThresholds)[] } | null
}

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
  void [months, site, horizon, stations, stationIds, earliestMs, latestMs, t]
  return todo('finder')
}
