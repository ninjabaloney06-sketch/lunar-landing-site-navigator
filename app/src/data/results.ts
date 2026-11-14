// Results for one (site, period, station selection), computed by Track A's geometry contract. There is no other
// path: a missing ephemeris month or terrain horizon gives a plain "no data" state, never invented numbers.
import { useEffect, useState } from 'react'
import { answerSentence, answerState, computeSeries, coverage, interpolate, summarize, windows } from '../geometry'
import type { AnswerLines, CoverageState, Series, SiteGeo, Summary, Window } from '../geometry'
import type { SceneFrame } from '../scene3d'
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
  if (!site.horizon) throw missing()
  try {
    return await loadHorizon(site.horizon)
  } catch (e) {
    throw e instanceof MissingDataError ? missing() : e
  }
}

// The series holds every station; a different selection reuses it and only recomputes coverage.
const seriesCache = new Map<string, Promise<Series>>()

function getSeries(site: Site, stations: Station[], startMs: number, endMs: number): Promise<Series> {
  const key = `${site.id}|${startMs}|${endMs}`
  let p = seriesCache.get(key)
  if (!p) {
    p = (async () => {
      const [horizon, months] = await Promise.all([horizonOf(site), loadMonthsFor(startMs, endMs)])
      if (!months) throw new NoDataError('No data for these dates in this build.')
      const geo: SiteGeo = { lat: site.lat, lon: site.lon, elev_m: site.elev_m }
      return computeSeries(months, geo, horizon, stations, startMs, endMs)
    })()
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
 *  Rejects when the ephemeris does not cover utcMs; the scene then keeps no invented sky. */
export function makeLoadFrame(sites: Site[]) {
  return async (siteId: string, utcMs: number): Promise<SceneFrame> => {
    const site = sites.find((s) => s.id === siteId)
    if (!site) throw new Error(`unknown site ${siteId}`)
    const d = new Date(utcMs)
    const keys = [monthKey(utcMs), monthKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))]
    const optional = <T>(p: Promise<T>): Promise<T | null> =>
      p.catch((e) => {
        if (e instanceof MissingDataError) return null
        throw e
      })
    const [horizon, terrain, months] = await Promise.all([
      site.horizon ? optional(loadHorizon(site.horizon)) : Promise.resolve(null),
      loadTerrain(site.id),
      Promise.all(keys.map((k) => optional(loadEphem(k)))),
    ])
    const state = interpolate(
      months.filter((m) => m !== null),
      utcMs,
    )
    return { site, horizon, terrain, state }
  }
}
