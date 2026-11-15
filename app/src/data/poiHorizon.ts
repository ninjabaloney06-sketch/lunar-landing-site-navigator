// The POI card's link to the search data (U17, read-cards): which point of interest has a terrain horizon of its own.
// Those points are the rows of search-sites.json (built by scripts/poi_horizons.py, one horizons/poi-*.json each),
// shaped like a site, so the card computes their sunlight and station contact with the same code as the search
// (views/useSiteRows → data/results.computeRow). A point without a row has no horizon: the card shows no value.
import { loadPeriods, loadSearchSites, loadStations } from './load'
import type { SearchSite } from './pois'
import type { Period, Station } from './types'

let index: Promise<Map<string, SearchSite>> | null = null

/** The search row made from this POI (Poi.id), or null when the point has no horizon of its own in this build. */
export function loadPoiSite(poiId: string): Promise<SearchSite | null> {
  if (!index) {
    index = loadSearchSites().then((rows) => new Map(rows.filter((r) => r.horizon).map((r) => [r.poi_id, r])))
    index.catch(() => (index = null)) // a failed load is retried on the next card
  }
  return index.then((m) => m.get(poiId) ?? null)
}

/** Periods and stations, as the app loaded them at start (the same cached requests). */
export const loadMissionInputs = (): Promise<[Period[], Station[]]> => Promise.all([loadPeriods(), loadStations()])
