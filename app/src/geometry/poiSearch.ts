// Landing-site search by nearby points of interest (U1). Pure: no DOM, no fetch; never mutates its input.
//
// ORDER of the array searchSites returns (exact rule):
// (1) rows with passes && share !== null, ranked lexicographically by share > 0 first (a place never lit, or never in
//     contact, is no answer to "most sunlight and station contact", however many points are near it), then groupsCovered desc, share desc, slopeDeg asc
//     (unknown last), nearTotal desc; equal keys share a rank (competition ranking 1, 1, 3) and are listed by siteId.
//     share comes before nearTotal: nearTotal counts research records, and one feature is often listed by several
//     catalogues, so it rewards being written about, not being a good place. The flatter slope breaks ties of
//     equal shares (many places are lit or in contact 100 % of a short mission);
// (2) then passes && share === null ("no data"), by groupsCovered desc, nearTotal desc, siteId;
// (3) then rows that fail the slope filter or a minimum (minLitPct, minCoveragePct: sunlit % and station contact %
//     of the mission dates the user asks for at least; a row without that value does not meet a minimum above 0),
//     by groupsCovered desc, nearTotal desc, share desc (null last), siteId.
// 'both' = min(litPct, coveragePct): a place is as good as its weaker value, so a place never lit cannot win on
// coverage alone (the earlier sum ranked 0 % sunlit + 37 % coverage above 30 % + 5 %). No other weighted score.
// best: among the first BEST_COUNT ranks, and only with share > 0 and at least one chosen point within radiusKm.
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
  /** Least sunlit % of the mission dates a place must have; 0 or absent = no minimum. */
  minLitPct?: number
  /** Least station contact % of the mission dates a place must have; 0 or absent = no minimum. */
  minCoveragePct?: number
}

export interface SearchRow {
  siteId: string
  counts: Partial<Record<PoiGroup, number>> // one entry per selected group (opts.groups order), 0 when none near
  groupsCovered: number // selected groups with >= 1 POI within radiusKm
  nearTotal: number // POIs of the selected groups within radiusKm
  slope: SlopeState
  slopeDeg: number | null
  passes: boolean // meets the slope filter (always, when slopeRequired is false) and both minimums
  meetsMin: boolean // litPct >= minLitPct and coveragePct >= minCoveragePct (a minimum of 0 is always met)
  litPct: number | null
  coveragePct: number | null
  share: number | null // 'light' → litPct, 'comms' → coveragePct, 'both' → min(litPct, coveragePct); null when a needed value is missing
  rank: number | null // competition rank (1, 1, 3) among rows with passes && share !== null; null otherwise
  best: boolean // rank !== null && rank <= BEST_COUNT && share > 0 && groupsCovered > 0
}

export const BEST_COUNT = 3

function shareOf(by: ShareBy, lit: number | null, cov: number | null): number | null {
  if (by === 'light') return lit
  if (by === 'comms') return cov
  return lit === null || cov === null ? null : Math.min(lit, cov)
}

/** A minimum of 0 (or none) is met by every row, also one without the value; a minimum above 0 needs the value. */
const atLeast = (v: number | null, min: number | undefined) => !min || min <= 0 || (v !== null && v >= min)

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
    const meetsMin = atLeast(r.litPct, opts.minLitPct) && atLeast(r.coveragePct, opts.minCoveragePct)
    return {
      siteId: site.id,
      counts,
      groupsCovered: groups.filter((g) => (counts[g] ?? 0) > 0).length,
      nearTotal: near.length,
      slope: r.slope,
      slopeDeg: r.slopeDeg,
      passes: (!opts.slopeRequired || r.slope === 'pass') && meetsMin,
      meetsMin,
      litPct: r.litPct,
      coveragePct: r.coveragePct,
      share: shareOf(opts.by, r.litPct, r.coveragePct),
      rank: null,
      best: false,
    }
  })

  const rankKeys = (r: SearchRow) => [(r.share as number) > 0 ? 0 : 1, -r.groupsCovered, -(r.share as number), r.slopeDeg ?? Infinity, -r.nearTotal]
  const ranked = all
    .filter((r) => r.passes && r.share !== null)
    .sort((a, b) => compareKeys(rankKeys(a), rankKeys(b)) || bySiteId(a, b))
  for (let start = 0, i = 1; i <= ranked.length; i++) {
    if (i < ranked.length && compareKeys(rankKeys(ranked[i]), rankKeys(ranked[start])) === 0) continue
    for (let k = start; k < i; k++) {
      ranked[k].rank = start + 1
      ranked[k].best = start + 1 <= BEST_COUNT && (ranked[k].share as number) > 0 && ranked[k].groupsCovered > 0
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

/** The name of the place a record describes: lower case, without "(…)" notes and without a trailing "crater"
 *  ("Shoemaker (Tye et al. 2015)", "Shoemaker crater" and "Shoemaker" are all "shoemaker"). */
export function placeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+crater\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Same place (UI rule, not a sourced value): two POI points with the same placeName whose positions are at most this
// far apart. Several research catalogues list one feature, each with its own centre a few km from the others
// (Shoemaker: PSR atlas, host crater, Lemelin 2021, crater age, science feature, LEND maximum, all within 3.5 km).
// Area records (craters, shadowed regions) merge within 5 km; illumination points are precise spots and merge within
// 1 km only ("Shackleton rim S" max illumination and max visibility points, 3 km apart, stay two places).
export const SAME_PLACE_KM = 5
export const SAME_POINT_KM = 1
// Which record of a place stands for it (its name, horizon and values are the row's): the feature record first.
const REPRESENTATIVE = ['science_feature', 'host_crater', 'named_feature']

export interface Candidate {
  site: Site
  selfPoiId: string | null
  /** Other records of the same place, folded into this row (empty for an app site and for a single record). */
  records: { id: string; name: string }[]
}

/** The search's candidates: every app site, then every POI point with a horizon of its own (search-sites.json) whose
 *  POI is among `pois` (the shown ones, inside the pin region). A POI that is one of the app's sites appears once, as
 *  the site; a duplicate id is listed once; several records of one place (SAME_PLACE_KM) are one candidate, at the
 *  position of its first record. selfPoiId: the POI a candidate was made from (it never counts itself). */
export function searchCandidates(sites: Site[], extra: SearchSite[], pois: Poi[]): Candidate[] {
  const siteIds = new Set(sites.map((s) => s.id))
  const byId = new Map(pois.map((p) => [p.id, p]))
  const seen = new Set(siteIds)
  const points: { site: SearchSite; poi: Poi; key: string }[] = []
  for (const s of extra) {
    const p = byId.get(s.poi_id)
    if (!p || (p.siteId !== null && siteIds.has(p.siteId)) || seen.has(s.id)) continue
    seen.add(s.id)
    points.push({ site: s, poi: p, key: placeName(s.name) })
  }
  // Single-linkage clusters: union-find over pairs with the same place name within reach.
  const parent = points.map((_, i) => i)
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])))
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i]
      const b = points[j]
      if (a.key === '' || a.key !== b.key) continue
      const reach = a.poi.category === 'illumination_point' || b.poi.category === 'illumination_point' ? SAME_POINT_KM : SAME_PLACE_KM
      if (distanceKm(a.site.lat, a.site.lon, b.site.lat, b.site.lon) <= reach) parent[root(j)] = root(i)
    }
  }
  const clusters = new Map<number, number[]>()
  points.forEach((_, i) => {
    const r = root(i)
    clusters.set(r, [...(clusters.get(r) ?? []), i])
  })
  const pref = (i: number) => {
    const k = REPRESENTATIVE.indexOf(points[i].poi.category)
    return k < 0 ? REPRESENTATIVE.length : k
  }
  const out: Candidate[] = sites.map((site) => ({ site, selfPoiId: null, records: [] }))
  // Map iteration follows insertion order = the position of each cluster's first record.
  for (const members of clusters.values()) {
    const sorted = [...members].sort(
      (a, b) =>
        pref(a) - pref(b) ||
        points[a].site.name.length - points[b].site.name.length ||
        (points[a].site.id < points[b].site.id ? -1 : points[a].site.id > points[b].site.id ? 1 : 0),
    )
    const [rep, ...rest] = sorted
    out.push({
      site: points[rep].site,
      selfPoiId: points[rep].site.poi_id,
      records: rest.map((i) => ({ id: points[i].site.id, name: points[i].site.name })),
    })
  }
  return out
}
