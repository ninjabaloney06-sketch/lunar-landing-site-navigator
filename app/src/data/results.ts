// Results for one (site, period, station selection), computed by Track A's geometry contract. There is no other
// path: a missing ephemeris month or terrain horizon gives a plain "no data" state, never invented numbers.
import { useEffect, useState } from 'react'
import { answerSentence, answerState, computeSeries, coverage, interpolate, summarize, windows } from '../geometry'
import type { AnswerLines, CoverageState, Series, SiteGeo, Summary, Window } from '../geometry'
import type { SceneFrame } from '../scene3d'
import { customHorizon, customTerrain, loadCustomSite, parseCustomSiteId } from './customSite'
import { loadEphem, loadHorizon, loadMonthsFor, loadTerrain, MissingDataError, monthKey } from './load'
import type { Horizon, Site, Station } from './types'

/** Data this build does not contain for the chosen site or dates. Shown as a plain message, not an error. */
export class NoDataError extends Error {}

export interface Results {
  key: string
  series: Series
  coverage: CoverageState[]
  sun: Window[]
  comms: Window[]
  summary: Summary
  answerAt(utcMs: number): AnswerLines
}

export interface ResultsInput {
  site: Site
  stations: Station[]
  ids: string[]
  startMs: number
  endMs: number
}

export function resultsKey(i: ResultsInput): string {
  return `${i.site.id}|${i.startMs}|${i.endMs}|${i.ids.join(',')}`
}

async function horizonOf(site: Site): Promise<Horizon> {
  const missing = () => new NoDataError(`No terrain data for ${site.name} in this build.`)
  // A custom site: the browser's approximate mask from the south-cap rasters (no cap data, or a point they do not
  // cover, is the same "no data" state as a missing horizon file).
  if (site.group === 'custom') {
    try {
      return await customHorizon(site.id)
    } catch (e) {
      throw e instanceof MissingDataError || e instanceof RangeError ? missing() : e
    }
  }
  if (!site.horizon) throw missing()
  try {
    return await loadHorizon(site.horizon)
  } catch (e) {
    throw e instanceof MissingDataError ? missing() : e
  }
}

/** The observer's ground point. A custom site's height is its horizon's (the site shown while that is computed has
 *  none yet); a prepared site's is the one in sites.json. */
function geoOf(site: Site, horizon: Horizon): SiteGeo {
  return site.group === 'custom' ? { lat: horizon.lat, lon: horizon.lon, elev_m: horizon.elev_m } : { lat: site.lat, lon: site.lon, elev_m: site.elev_m }
}

/** Horizon and ground point for the finder: as for the answer, except that a prepared site without a horizon file
 *  gets null (the finder's own handling). */
export async function finderInputs(site: Site): Promise<{ geo: SiteGeo; horizon: Horizon | null }> {
  if (site.group === 'custom') {
    const horizon = await horizonOf(site)
    return { geo: geoOf(site, horizon), horizon }
  }
  return { geo: { lat: site.lat, lon: site.lon, elev_m: site.elev_m }, horizon: site.horizon ? await loadHorizon(site.horizon) : null }
}

// The series holds every station; a different selection reuses it and only recomputes coverage.
const seriesCache = new Map<string, Promise<Series>>()

async function buildSeries(site: Site, stations: Station[], startMs: number, endMs: number): Promise<Series> {
  const [horizon, months] = await Promise.all([horizonOf(site), loadMonthsFor(startMs, endMs)])
  if (!months) throw new NoDataError('No data for these dates in this build.')
  return computeSeries(months, geoOf(site, horizon), horizon, stations, startMs, endMs)
}

function getSeries(site: Site, stations: Station[], startMs: number, endMs: number): Promise<Series> {
  const key = `${site.id}|${startMs}|${endMs}`
  let p = seriesCache.get(key)
  if (!p) {
    p = buildSeries(site, stations, startMs, endMs)
    seriesCache.set(key, p)
    p.catch(() => seriesCache.delete(key))
    if (seriesCache.size > 12) seriesCache.delete(seriesCache.keys().next().value as string)
  }
  return p
}

export async function computeResults(input: ResultsInput): Promise<Results> {
  const { site, stations, ids, startMs, endMs } = input
  const series = await getSeries(site, stations, startMs, endMs)
  return {
    key: resultsKey(input),
    series,
    coverage: coverage(series, ids),
    sun: windows(series, 'sun'),
    comms: windows(series, 'coverage', ids),
    summary: summarize(series, ids),
    answerAt: (utcMs) => answerSentence(answerState(series, ids, utcMs)),
  }
}

/** One row of the comparison table: the summary and the sunlit windows of a site over a span. */
export interface RowResult {
  summary: Summary
  sun: Window[]
}

/** summarize() and windows(…, 'sun') on the computeSeries() series for the input. keepSeries = false builds the
 *  series, reads the two results and lets it go: a whole year is 17 520 samples per site, and the table has a
 *  row per site. The mission's own span keeps its series, shared with the answer and the Mission panel. */
export async function computeRow(input: ResultsInput, keepSeries = true): Promise<RowResult> {
  const { site, stations, ids, startMs, endMs } = input
  const series = await (keepSeries ? getSeries : buildSeries)(site, stations, startMs, endMs)
  return { summary: summarize(series, ids), sun: windows(series, 'sun') }
}

export type ResultsState =
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; results: Results }
  | { status: 'empty'; key: string; message: string }
  | { status: 'error'; key: string; error: string }

/** Results for the current input. The state carries its key, and a state whose key differs from the
 *  current input is reported as loading: the previous site's values can never show under a new name. */
export function useResults(input: ResultsInput | null): ResultsState {
  const key = input ? resultsKey(input) : ''
  const [state, setState] = useState<ResultsState>({ status: 'loading', key })
  useEffect(() => {
    if (!input) return
    let alive = true
    computeResults(input).then(
      (results) => alive && setState({ status: 'ready', key, results }),
      (e: Error) =>
        alive &&
        setState(e instanceof NoDataError ? { status: 'empty', key, message: e.message } : { status: 'error', key, error: e.message }),
    )
    return () => {
      alive = false
    }
    // input is fully described by key
  }, [key])
  return state.key === key ? state : { status: 'loading', key }
}

/** SceneDeps.loadFrame for the app (scene contract): site, horizon, terrain tile and the body state at utcMs.
 *  Rejects when the ephemeris does not cover utcMs; the scene then keeps no invented sky. A custom site id
 *  (data/customSite.ts) gives the custom site, its capHorizon mask and, as no terrain file exists for it, capTerrain. */
export function makeLoadFrame(sites: Site[]) {
  return async (siteId: string, utcMs: number): Promise<SceneFrame> => {
    const custom = parseCustomSiteId(siteId) !== null
    const site = sites.find((s) => s.id === siteId) ?? (custom ? await loadCustomSite(siteId) : null)
    if (!site) throw new Error(`unknown site ${siteId}`)
    const d = new Date(utcMs)
    const keys = [monthKey(utcMs), monthKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))]
    const optional = <T>(p: Promise<T>): Promise<T | null> =>
      p.catch((e) => {
        if (e instanceof MissingDataError) return null
        throw e
      })
    const [horizon, terrain, months] = await Promise.all([
      site.group === 'custom' ? customHorizon(site.id) : site.horizon ? optional(loadHorizon(site.horizon)) : Promise.resolve(null),
      loadTerrain(site.id).then((t) => t ?? (site.group === 'custom' ? customTerrain(site.id) : null)),
      Promise.all(keys.map((k) => optional(loadEphem(k)))),
    ])
    const state = interpolate(
      months.filter((m) => m !== null),
      utcMs,
    )
    return { site, horizon, terrain, state }
  }
}
