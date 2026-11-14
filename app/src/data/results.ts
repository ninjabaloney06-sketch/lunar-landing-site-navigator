// Results for one (site, period, station selection): the real geometry contract when it runs, otherwise the
// clearly fake sample series (sampleSeries.ts). Every consumer reads `source` and shows "sample" for it.
import { useEffect, useState } from 'react'
import {
  answerSentence,
  answerState,
  computeSeries,
  coverage,
  interpolate,
  summarize,
  windows,
} from '../geometry'
import type { AnswerLines, CoverageState, Series, SiteGeo, Summary, Window } from '../geometry'
import type { SceneFrame } from '../scene3d'
import { loadHorizon, loadMonthsFor, loadEphem, loadTerrain, monthKey, MissingDataError } from './load'
import {
  SAMPLE_ANSWER,
  sampleAnswerState,
  sampleBodyState,
  sampleCoverage,
  sampleSeries,
  sampleSummary,
  sampleWindows,
} from './sampleSeries'
import type { Horizon, Site, Station } from './types'

// Leo's V7 sign-off flips this. Until then every number on screen is labelled "sample" (preamble hard rule).
export const NUMBERS_VALIDATED = false

export function isNotImplemented(e: unknown): boolean {
  return e instanceof Error && /not implemented yet/.test(e.message)
}

export interface Results {
  key: string
  source: 'real' | 'sample' // 'sample' = fake fallback series
  series: Series
  coverage: CoverageState[]
  sun: Window[]
  comms: Window[]
  summary: Summary
  answerAt(utcMs: number): { lines: AnswerLines; sample: boolean }
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

const seriesCache = new Map<string, Promise<{ series: Series; real: boolean }>>()

async function getSeries(site: Site, horizon: Horizon | null, stations: Station[], startMs: number, endMs: number) {
  const key = `${site.id}|${startMs}|${endMs}`
  let p = seriesCache.get(key)
  if (!p) {
    p = (async () => {
      const months = await loadMonthsFor(startMs, endMs)
      if (months) {
        const geo: SiteGeo = { lat: site.lat, lon: site.lon, elev_m: site.elev_m }
        try {
          return { series: computeSeries(months, geo, horizon, stations, startMs, endMs), real: true }
        } catch (e) {
          if (!isNotImplemented(e)) throw e
        }
      }
      return { series: sampleSeries(site, horizon, stations, startMs, endMs), real: false }
    })()
    seriesCache.set(key, p)
    p.catch(() => seriesCache.delete(key))
    if (seriesCache.size > 12) seriesCache.delete(seriesCache.keys().next().value as string)
  }
  return p
}

function sampleAnswer(series: Series, ids: string[], utcMs: number): AnswerLines {
  try {
    return answerSentence(sampleAnswerState(series, ids, utcMs))
  } catch (e) {
    if (!isNotImplemented(e)) throw e
    return SAMPLE_ANSWER
  }
}

export async function computeResults(input: ResultsInput): Promise<Results> {
  const { site, stations, ids, startMs, endMs } = input
  const horizon = site.horizon ? await loadHorizon(site.horizon) : null
  const { series, real } = await getSeries(site, horizon, stations, startMs, endMs)
  const key = resultsKey(input)
  if (real) {
    try {
      const r: Results = {
        key,
        source: 'real',
        series,
        coverage: coverage(series, ids),
        sun: windows(series, 'sun'),
        comms: windows(series, 'coverage', ids),
        summary: summarize(series, ids),
        answerAt(utcMs) {
          try {
            return { lines: answerSentence(answerState(series, ids, utcMs)), sample: false }
          } catch (e) {
            if (!isNotImplemented(e)) throw e
            return { lines: SAMPLE_ANSWER, sample: true }
          }
        },
      }
      return r
    } catch (e) {
      if (!isNotImplemented(e)) throw e
    }
  }
  const fake = real ? sampleSeries(site, horizon, stations, startMs, endMs) : series
  return {
    key,
    source: 'sample',
    series: fake,
    coverage: sampleCoverage(fake, ids),
    sun: sampleWindows(fake, 'sun'),
    comms: sampleWindows(fake, 'coverage', ids),
    summary: sampleSummary(fake, ids),
    answerAt: (utcMs) => ({ lines: sampleAnswer(fake, ids, utcMs), sample: true }),
  }
}

export type ResultsState =
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; results: Results }
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
      (e: Error) => alive && setState({ status: 'error', key, error: e.message }),
    )
    return () => {
      alive = false
    }
    // input is fully described by key
  }, [key])
  return state.key === key ? state : { status: 'loading', key }
}

/** SceneDeps.loadFrame for the app (scene contract): site, horizon, terrain tile and the body state at utcMs.
 *  Without an ephemeris month the frame carries the sample sky, matching the sample series. */
export function makeLoadFrame(sites: Site[]) {
  return async (siteId: string, utcMs: number): Promise<SceneFrame> => {
    const site = sites.find((s) => s.id === siteId)
    if (!site) throw new Error(`unknown site ${siteId}`)
    const [horizon, terrain] = await Promise.all([site.horizon ? loadHorizon(site.horizon) : null, loadTerrain(site.id)])
    const d = new Date(utcMs)
    const keys = [monthKey(utcMs), monthKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))]
    const months = (
      await Promise.all(
        keys.map((k) =>
          loadEphem(k).catch((e) => {
            if (e instanceof MissingDataError) return null
            throw e
          }),
        ),
      )
    ).filter((m) => m !== null)
    let state
    try {
      state = interpolate(months, utcMs)
    } catch {
      state = sampleBodyState(site, utcMs)
    }
    return { site, horizon, terrain, state }
  }
}
