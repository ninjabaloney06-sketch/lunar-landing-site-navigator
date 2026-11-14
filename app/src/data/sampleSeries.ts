// SAMPLE FALLBACK — clearly fake values so the screen can be built and tested before Track A merges.
// Used only when the geometry contract throws "not implemented yet" or an ephemeris month is missing.
// Every screen that shows these values also shows "sample values". Delete this file once Track A's
// geometry and the real ephemeris months are on main (integrator, orchestrator note 6).
//
// Nothing here is physics: the curves are invented so that lit/dark, covered/none and one unknown stretch
// all appear on the timeline.

import type { AnswerLines, AnswerState, BodyState, CoverageState, Sample, Series, SiteGeo, StationLos, Summary, Window } from '../geometry'
import { enuBasis, siteVector } from '../geometry'
import type { Horizon, Site, Station, Vec3 } from './types'

const DEG = Math.PI / 180
const DAY = 86_400_000
const FLAT_DIP_DEG = -0.0813 // flat-sphere horizon dip for a 1.75 m observer (geometry contract)

/** Shown in place of the answer sentence until Track A's answerSentence exists. Not computed. */
export const SAMPLE_ANSWER: AnswerLines = {
  sun: 'Sunlight for 3 more days.',
  comms: 'A selected station stays in view for 18 more hours.',
}

function seed(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10_000) / 10_000
}

function mod360(x: number): number {
  return ((x % 360) + 360) % 360
}

/** Terrain mask by linear interpolation of the horizon file (display helper; not geometry.maskAt). */
export function maskFromHorizon(h: Horizon | null, az: number): number {
  if (!h || !h.mask.length) return FLAT_DIP_DEG
  const n = h.mask.length
  const x = mod360(az) / h.az_step
  const i0 = Math.floor(x) % n
  const i1 = (i0 + 1) % n
  const f = x - Math.floor(x)
  return h.mask[i0] * (1 - f) + h.mask[i1] * f
}

interface FakeSky {
  sunAz: number
  sunEl: number
  earthAz: number
  earthEl: number
}

function fakeSky(site: Site, t: number): FakeSky {
  const s = seed(site.id)
  const days = t / DAY
  return {
    sunAz: mod360((360 * days) / 29.53 + 360 * s),
    sunEl: 0.9 + 1.1 * Math.sin((2 * Math.PI * days) / 9.3 + 6 * s),
    earthAz: mod360(360 * s + 6 * Math.sin((2 * Math.PI * days) / 27.55)),
    earthEl: 1.5 + 5 * Math.sin((2 * Math.PI * days) / 27.21 + 9 * s),
  }
}

function dirToMe(site: Site, az: number, el: number): Vec3 {
  const enu = enuBasis(site.lat, site.lon)
  const e = Math.cos(el * DEG) * Math.sin(az * DEG)
  const n = Math.cos(el * DEG) * Math.cos(az * DEG)
  const u = Math.sin(el * DEG)
  return [0, 1, 2].map((k) => e * enu.east[k] + n * enu.north[k] + u * enu.up[k]) as Vec3
}

function azElOf(az: number, el: number, dist_km: number) {
  const e = Math.cos(el * DEG) * Math.sin(az * DEG)
  const n = Math.cos(el * DEG) * Math.cos(az * DEG)
  return { az, el, dist_km, dirEnu: [e, n, Math.sin(el * DEG)] as Vec3 }
}

function fakeStation(st: Station, site: Site, t: number, sky: FakeSky, earthVisible: boolean): StationLos {
  const turn = (2 * Math.PI * t) / 86_164_000 + st.lon_deg * DEG + 6 * seed(site.id)
  const moonElAtStation = 60 * Math.cos(turn) - 15
  const reason = !earthVisible ? 'terrain' : moonElAtStation < st.min_elev_deg ? 'station-mask' : null
  return { az: sky.earthAz, el: sky.earthEl, moonElAtStation, state: reason ? 'blocked' : 'los', reason }
}

export function sampleSeries(site: Site, horizon: Horizon | null, stations: Station[], startMs: number, endMs: number, stepMin = 30): Series {
  const step = stepMin * 60_000
  const samples: Sample[] = []
  const H = 3_600_000
  for (let t = startMs; t < endMs; t += step) {
    const sky = fakeSky(site, t)
    const sunMask = maskFromHorizon(horizon, sky.sunAz)
    const earthMask = maskFromHorizon(horizon, sky.earthAz)
    // The period opens the way SAMPLE_ANSWER reads (3 days of sunlight, 18 hours of station view), so the
    // default view does not contradict its own sample sentence.
    const rel = t - startMs
    if (rel < 72 * H) sky.sunEl = Math.max(sky.sunEl, sunMask + 0.4)
    else if (rel < 102 * H) sky.sunEl = Math.min(sky.sunEl, sunMask - 0.3)
    if (rel < 18 * H) sky.earthEl = Math.max(sky.earthEl, earthMask + 0.5)
    const lit = sky.sunEl > sunMask
    const visible = sky.earthEl > earthMask
    const st: Record<string, StationLos> = {}
    for (const s of stations) {
      const l = fakeStation(s, site, t, sky, visible)
      if (rel < 18 * H) Object.assign(l, { moonElAtStation: Math.max(l.moonElAtStation, s.min_elev_deg + 5), state: 'los', reason: null })
      else if (rel < 26 * H && l.state === 'los') Object.assign(l, { moonElAtStation: Math.min(l.moonElAtStation, s.min_elev_deg - 5), state: 'blocked', reason: 'station-mask' })
      st[s.id] = l
    }
    samples.push({
      utcMs: t,
      sun: { ...azElOf(sky.sunAz, sky.sunEl, 1.496e8), mask: sunMask, frac: lit ? 1 : 0, lit },
      earth: { ...azElOf(sky.earthAz, sky.earthEl, 384_400), mask: earthMask, frac: visible ? 1 : 0, visible },
      stations: st,
    })
  }
  const geo: SiteGeo = { lat: site.lat, lon: site.lon, elev_m: site.elev_m }
  return { site: geo, horizon, stations, startMs, endMs, stepMin, samples }
}

/** One invented 6-hour stretch with missing inputs, so the hatched "unknown" state is visible. */
function inUnknownStretch(series: Series, t: number): boolean {
  const a = series.startMs + 0.62 * (series.endMs - series.startMs)
  return t >= a && t < a + 6 * 3_600_000
}

export function sampleCoverage(series: Series, ids: string[]): CoverageState[] {
  return series.samples.map((s) => {
    if (inUnknownStretch(series, s.utcMs)) return 'unknown'
    return ids.some((id) => s.stations[id]?.state === 'los') ? 'covered' : 'none'
  })
}

function runs<T extends string>(series: Series, states: T[], kind: Window['kind']): Window[] {
  const out: Window[] = []
  const step = series.stepMin * 60_000
  states.forEach((st, i) => {
    const t = series.samples[i].utcMs
    const last = out[out.length - 1]
    if (last && last.state === st) last.endMs = Math.min(t + step, series.endMs)
    else out.push({ kind, startMs: t, endMs: Math.min(t + step, series.endMs), state: st as Window['state'] })
  })
  return out
}

export function sampleWindows(series: Series, kind: Window['kind'], ids: string[] = []): Window[] {
  if (kind === 'sun') return runs(series, series.samples.map((s) => (s.sun.lit ? 'lit' : 'dark')), kind)
  if (kind === 'earth') return runs(series, series.samples.map((s) => (s.earth.visible ? 'visible' : 'hidden')), kind)
  return runs(series, sampleCoverage(series, ids), kind)
}

export function sampleSummary(series: Series, ids: string[]): Summary {
  const n = series.samples.length || 1
  const cov = sampleCoverage(series, ids)
  const longest = (ws: Window[], state: Window['state']) =>
    ws.filter((w) => w.state === state).reduce((m, w) => Math.max(m, (w.endMs - w.startMs) / 3_600_000), 0)
  return {
    litPct: (100 * series.samples.filter((s) => s.sun.lit).length) / n,
    earthVisiblePct: (100 * series.samples.filter((s) => s.earth.visible).length) / n,
    coveragePct: (100 * cov.filter((c) => c === 'covered').length) / n,
    unknownPct: (100 * cov.filter((c) => c === 'unknown').length) / n,
    longestDarkH: longest(sampleWindows(series, 'sun'), 'dark'),
    longestGapH: longest(sampleWindows(series, 'coverage', ids), 'none'),
  }
}

export function sampleAnswerState(series: Series, ids: string[], utcMs: number): AnswerState {
  const sun = sampleWindows(series, 'sun')
  const com = sampleWindows(series, 'coverage', ids)
  const at = (ws: Window[]) => ws.find((w) => utcMs >= w.startMs && utcMs < w.endMs) ?? ws[ws.length - 1]
  const s = at(sun)
  const c = at(com)
  return {
    sunLit: s.state === 'lit',
    sunHoursToChange: (s.endMs - utcMs) / 3_600_000,
    sunChangeInPeriod: s.endMs < series.endMs,
    comms: c.state as CoverageState,
    commsHoursToChange: (c.endMs - utcMs) / 3_600_000,
    commsChangeInPeriod: c.endMs < series.endMs,
    anyCoverageInPeriod: com.some((w) => w.state === 'covered'),
    earthEverRises: !earthNeverUp(series),
  }
}

function earthNeverUp(series: Series): boolean {
  return series.samples.every((s) => s.earth.el < -10)
}

/** Fake Sun/Earth vectors matching the fake sky, so the 3D scene can draw the sample frame. */
export function sampleBodyState(site: Site, utcMs: number): BodyState {
  const sky = fakeSky(site, utcMs)
  const p = siteVector(site.lat, site.lon, (site.elev_m ?? 0) / 1000)
  const sunDir = dirToMe(site, sky.sunAz, sky.sunEl)
  const earthDir = dirToMe(site, sky.earthAz, sky.earthEl)
  return {
    utcMs,
    sun_km: [0, 1, 2].map((k) => p[k] + 1.496e8 * sunDir[k]) as Vec3,
    earth_km: [0, 1, 2].map((k) => p[k] + 384_400 * earthDir[k]) as Vec3,
    q_me_to_j2000: [0, 0, 0, 1],
    q_earth_to_me: [0, 0, 0, 1],
  }
}
