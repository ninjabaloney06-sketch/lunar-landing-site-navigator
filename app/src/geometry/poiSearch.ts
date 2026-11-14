// Landing-site search by nearby points of interest (U1). Pure: no DOM, no fetch; never mutates its input.
//
// ORDER of the array searchSites returns (exact rule):
// (1) rows with passes && share !== null, ranked lexicographically by groupsCovered desc, nearTotal desc, share desc;
//     equal keys share a rank (competition ranking 1, 1, 3) and are listed by siteId;
// (2) then passes && share === null ("no data"), by groupsCovered desc, nearTotal desc, siteId;
// (3) then rows that fail the slope filter, by groupsCovered desc, nearTotal desc, share desc (null last), siteId.
// No weighted score other than the declared litPct + coveragePct sum for 'both'.
//
// Counts per site: POIs of the selected groups within radiusKm (inclusive) of (site.lat, site.lon) on the
// 1737.4 km sphere, except the candidate's own record: a POI whose siteId is the site's id, or whose id is the row's
// selfPoiId (a candidate made from that POI). The caller passes only the POIs that may be shown. The slope rule (and its 5 deg limit) is rankSites', not repeated here.

import type { Poi, PoiGroup, SearchSite } from '../data/pois'
import type { Site, Vec3 } from '../data/types'
import { MOON_RADIUS_KM, rankSites, siteVector } from './index'
import type { SlopeState, Summary } from './index'

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

/** Great-circle distance (km) on the MOON_RADIUS_KM sphere. atan2(|a×b|, a·b) stays accurate for tiny and
 *  near-antipodal separations, where acos and haversine lose digits. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = siteVector(lat1, lon1, 0)
  const b = siteVector(lat2, lon2, 0)
  const c = cross(a, b)
  return MOON_RADIUS_KM * Math.atan2(Math.hypot(c[0], c[1], c[2]), dot(a, b))
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** POIs with distance <= km (inclusive), nearest first, then by id. */
export function poisNear(pois: Poi[], lat: number, lon: number, km: number): Poi[] {
  return pois
    .map((p) => ({ p, id: p.id, d: distanceKm(lat, lon, p.lat, p.lon) }))
    .filter((x) => x.d <= km)
    .sort((a, b) => a.d - b.d || byId(a, b))
    .map((x) => x.p)
}

export type ShareBy = 'light' | 'comms' | 'both'

export interface SearchOptions {
  groups: PoiGroup[]
  radiusKm: number
  slopeRequired: boolean
  by: ShareBy
}

export interface SearchRow {
  siteId: string
  counts: Partial<Record<PoiGroup, number>> // one entry per selected group (opts.groups order), 0 when none near
  groupsCovered: number // selected groups with >= 1 POI within radiusKm
  nearTotal: number // POIs of the selected groups within radiusKm
  slope: SlopeState
  slopeDeg: number | null
  passes: boolean // meets the slope filter; always true when slopeRequired is false
  litPct: number | null
  coveragePct: number | null
  share: number | null // 'light' → litPct, 'comms' → coveragePct, 'both' → litPct + coveragePct; null when a needed value is missing
  rank: number | null // competition rank (1, 1, 3) among rows with passes && share !== null; null otherwise
  best: boolean // rank !== null && rank <= BEST_COUNT
}

export const BEST_COUNT = 3

function shareOf(by: ShareBy, lit: number | null, cov: number | null): number | null {
  if (by === 'light') return lit
  if (by === 'comms') return cov
  return lit === null || cov === null ? null : lit + cov
}

/** Lexicographic; every key is "lower is better". 0 = equal on every key (a tie). */
function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}
const bySiteId = (a: SearchRow, b: SearchRow) => (a.siteId < b.siteId ? -1 : a.siteId > b.siteId ? 1 : 0)
const coverKeys = (r: SearchRow) => [-r.groupsCovered, -r.nearTotal]
const shareDescNullLast = (a: SearchRow, b: SearchRow) =>
  a.share === b.share ? 0 : a.share === null ? 1 : b.share === null ? -1 : b.share - a.share

export function searchSites(
  rows: { site: Site; summary: Summary | null; selfPoiId?: string | null }[],
  pois: Poi[],
  opts: SearchOptions,
): SearchRow[] {
  const groups = [...new Set(opts.groups)]
  const selected = pois.filter((p) => groups.includes(p.group))

  const all: SearchRow[] = rows.map(({ site, summary, selfPoiId }) => {
    // rankSites owns the slope rule and the finite-number guard for the summary values.
    const { ranked, failed, unknown } = rankSites([{ site, summary }], 'any')
    const r = [...ranked, ...failed, ...unknown][0]
    const counts: Partial<Record<PoiGroup, number>> = {}
    for (const g of groups) counts[g] = 0
    const near = poisNear(selected, site.lat, site.lon, opts.radiusKm).filter((p) => p.siteId !== site.id && p.id !== selfPoiId)
    for (const p of near) counts[p.group] = (counts[p.group] ?? 0) + 1
    return {
      siteId: site.id,
      counts,
      groupsCovered: groups.filter((g) => (counts[g] ?? 0) > 0).length,
      nearTotal: near.length,
      slope: r.slope,
      slopeDeg: r.slopeDeg,
      passes: !opts.slopeRequired || r.slope === 'pass',
      litPct: r.litPct,
      coveragePct: r.coveragePct,
      share: shareOf(opts.by, r.litPct, r.coveragePct),
      rank: null,
      best: false,
    }
  })

  const rankKeys = (r: SearchRow) => [...coverKeys(r), -(r.share as number)]
  const ranked = all
    .filter((r) => r.passes && r.share !== null)
    .sort((a, b) => compareKeys(rankKeys(a), rankKeys(b)) || bySiteId(a, b))
  for (let start = 0, i = 1; i <= ranked.length; i++) {
    if (i < ranked.length && compareKeys(rankKeys(ranked[i]), rankKeys(ranked[start])) === 0) continue
    for (let k = start; k < i; k++) {
      ranked[k].rank = start + 1
      ranked[k].best = start + 1 <= BEST_COUNT
    }
    start = i
  }
  const noData = all
    .filter((r) => r.passes && r.share === null)
    .sort((a, b) => compareKeys(coverKeys(a), coverKeys(b)) || bySiteId(a, b))
  const failing = all
    .filter((r) => !r.passes)
    .sort((a, b) => compareKeys(coverKeys(a), coverKeys(b)) || shareDescNullLast(a, b) || bySiteId(a, b))
  return [...ranked, ...noData, ...failing]
}

/** The search's candidates: every app site, then every POI point with a horizon of its own (search-sites.json) whose
 *  POI is among `pois` (the shown ones, inside the pin region). A POI that is one of the app's sites appears once, as
 *  the site; a duplicate id is listed once. selfPoiId: the POI a candidate was made from (it never counts itself). */
export function searchCandidates(sites: Site[], extra: SearchSite[], pois: Poi[]): { site: Site; selfPoiId: string | null }[] {
  const siteIds = new Set(sites.map((s) => s.id))
  const byId = new Map(pois.map((p) => [p.id, p]))
  const seen = new Set(siteIds)
  const out: { site: Site; selfPoiId: string | null }[] = sites.map((site) => ({ site, selfPoiId: null }))
  for (const s of extra) {
    const p = byId.get(s.poi_id)
    if (!p || (p.siteId !== null && siteIds.has(p.siteId)) || seen.has(s.id)) continue
    seen.add(s.id)
    out.push({ site: s, selfPoiId: s.poi_id })
  }
  return out
}
