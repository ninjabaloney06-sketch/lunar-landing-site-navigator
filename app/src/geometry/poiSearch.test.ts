// POI search (U1): great-circle distance, POIs near a point, and the site search order.
// All fixtures are synthetic test inputs built here, not app data; source URLs use the reserved .test domain.
import { describe, expect, it } from 'vitest'
import type { Poi, PoiGroup } from '../data/pois'
import type { Site } from '../data/types'
import type { Summary } from './index'
import { MOON_RADIUS_KM } from './index'
import { BEST_COUNT, type SearchOptions, distanceKm, poisNear, searchSites } from './poiSearch'

function site(id: string, lon: number, slope_deg: number | null = 2, lat = -80): Site {
  return {
    id,
    name: id,
    group: 'reference',
    label: null,
    lat,
    lon,
    frame_note: 'synthetic',
    elev_m: 0,
    slope_deg,
    far_side: false,
    source_url: `https://example.test/${id}`,
    source_label: 'synthetic',
    horizon: null,
    potential: [],
  }
}

function poi(id: string, group: PoiGroup, lat: number, lon: number, siteId: string | null = null): Poi {
  return {
    id,
    name: id,
    group,
    category: 'synthetic',
    lat,
    lon,
    summary: '',
    facts: [],
    evidence: null,
    limitations: null,
    sources: [`https://example.test/${id}`],
    siteId,
  }
}

/** n POIs of one group about 0.3·k km north of the site (well inside a 10 km radius). */
function near(s: Site, group: PoiGroup, n: number, tag = ''): Poi[] {
  return Array.from({ length: n }, (_, k) => poi(`${s.id}-${group}${tag}-${k}`, group, s.lat + 0.01 * (k + 1), s.lon))
}

function sum(litPct: number, coveragePct: number): Summary {
  return { litPct, earthVisiblePct: 50, coveragePct, unknownPct: 0, longestDarkH: 0, longestGapH: 0 }
}

const OPTS: SearchOptions = { groups: ['hazard', 'water', 'light'], radiusKm: 10, slopeRequired: true, by: 'both' }
const ids = (xs: { siteId: string }[]) => xs.map((x) => x.siteId)
const DEG = Math.PI / 180

describe('distanceKm', () => {
  it('is 0 for the same point', () => {
    expect(distanceKm(-89.5, 45, -89.5, 45)).toBe(0)
    expect(distanceKm(-90, 0, -90, 0)).toBe(0)
  })

  it('10 deg of latitude from the pole is R·10·π/180', () => {
    expect(Math.abs(distanceKm(-90, 0, -80, 0) - MOON_RADIUS_KM * 10 * DEG)).toBeLessThan(1e-6)
  })

  it('is symmetric', () => {
    expect(distanceKm(-88.02, -59.1, -84.675, -48.725)).toBe(distanceKm(-84.675, -48.725, -88.02, -59.1))
  })

  it('ignores longitude at the pole', () => {
    const d = distanceKm(-90, 0, -80, 30)
    for (const lon of [-180, -90, 17, 123, 180]) expect(Math.abs(distanceKm(-90, lon, -80, 30) - d)).toBeLessThan(1e-6)
    expect(Math.abs(d - MOON_RADIUS_KM * 10 * DEG)).toBeLessThan(1e-6)
  })

  it('antipodes are π·R apart', () => {
    expect(Math.abs(distanceKm(0, 0, 0, 180) - Math.PI * MOON_RADIUS_KM)).toBeLessThan(1e-6)
    expect(Math.abs(distanceKm(-89, 10, 89, -170) - Math.PI * MOON_RADIUS_KM)).toBeLessThan(1e-6)
    expect(Math.abs(distanceKm(-90, 0, 90, 0) - Math.PI * MOON_RADIUS_KM)).toBeLessThan(1e-6)
  })

  it('stays accurate for a metre-scale separation', () => {
    // 1e-5 deg of latitude = R·1e-5·π/180 km ≈ 0.30 m
    expect(Math.abs(distanceKm(-85, 20, -85.00001, 20) - MOON_RADIUS_KM * 1e-5 * DEG)).toBeLessThan(1e-9)
  })
})

describe('poisNear', () => {
  const c = { lat: -89, lon: 0 }
  const pa = poi('a', 'hazard', -89.1, 0)
  const pb = poi('b', 'hazard', -89.1, 0) // same place as a: tie broken by id
  const pc = poi('c', 'water', -89.05, 0)
  const pd = poi('d', 'light', -89.3, 0)
  const all = [pd, pb, pc, pa]

  it('includes the boundary distance and sorts by distance, then id', () => {
    const edge = distanceKm(c.lat, c.lon, pd.lat, pd.lon)
    expect(poisNear(all, c.lat, c.lon, edge).map((p) => p.id)).toEqual(['c', 'a', 'b', 'd'])
    expect(poisNear(all, c.lat, c.lon, edge * (1 - 1e-12)).map((p) => p.id)).toEqual(['c', 'a', 'b'])
    expect(poisNear(all, c.lat, c.lon, 0)).toEqual([])
  })

  it('does not reorder its input', () => {
    poisNear(all, c.lat, c.lon, 100)
    expect(all.map((p) => p.id)).toEqual(['d', 'b', 'c', 'a'])
  })
})

describe('searchSites: counts', () => {
  it("excludes the site's own record, counts per selected group in opts.groups order", () => {
    const a = site('a', 0)
    const pois = [
      poi('own', 'landing', a.lat, a.lon, 'a'), // the site itself: never counted
      poi('other-landing', 'landing', a.lat, a.lon),
      ...near(a, 'hazard', 2),
      poi('far-water', 'water', a.lat + 1, a.lon), // ~30 km away
      ...near(a, 'science', 1), // not selected
    ]
    const [r] = searchSites([{ site: a, summary: sum(60, 40) }], pois, {
      ...OPTS,
      groups: ['water', 'landing', 'hazard'],
    })
    expect(r.counts).toEqual({ water: 0, landing: 1, hazard: 2 })
    expect(Object.keys(r.counts)).toEqual(['water', 'landing', 'hazard'])
    expect(r.groupsCovered).toBe(2)
    expect(r.nearTotal).toBe(3)
  })

  it('a record of another site is counted', () => {
    const a = site('a', 0)
    const [r] = searchSites([{ site: a, summary: sum(60, 40) }], [poi('b-own', 'landing', a.lat, a.lon, 'b')], {
      ...OPTS,
      groups: ['landing'],
    })
    expect(r.counts).toEqual({ landing: 1 })
  })

  it('radius is inclusive', () => {
    const a = site('a', 0)
    const p = poi('p', 'hazard', a.lat + 0.2, a.lon)
    const d = distanceKm(a.lat, a.lon, p.lat, p.lon)
    const at = (radiusKm: number) => searchSites([{ site: a, summary: null }], [p], { ...OPTS, radiusKm })[0].nearTotal
    expect(at(d)).toBe(1)
    expect(at(d * (1 - 1e-12))).toBe(0)
  })
})

describe('searchSites: share', () => {
  const a = site('a', 0)
  const shareBy = (by: SearchOptions['by'], summary: Summary | null) =>
    searchSites([{ site: a, summary }], [], { ...OPTS, by })[0]

  it("'light' = litPct, 'comms' = coveragePct, 'both' = their sum", () => {
    expect(shareBy('light', sum(61.5, 22.25)).share).toBe(61.5)
    expect(shareBy('comms', sum(61.5, 22.25)).share).toBe(22.25)
    expect(shareBy('both', sum(61.5, 22.25)).share).toBe(83.75)
    expect(shareBy('both', sum(61.5, 22.25))).toMatchObject({ litPct: 61.5, coveragePct: 22.25 })
  })

  it('is null when a needed value is missing', () => {
    expect(shareBy('both', null).share).toBeNull()
    const noLit = { ...sum(0, 40), litPct: Number.NaN }
    expect(shareBy('light', noLit).share).toBeNull()
    expect(shareBy('both', noLit).share).toBeNull()
    expect(shareBy('comms', noLit).share).toBe(40)
  })
})

describe('searchSites: order and rank', () => {
  it('groupsCovered before nearTotal before share', () => {
    const A = site('A', 0)
    const B = site('B', 30)
    const C = site('C', 60)
    const D = site('D', 90)
    const pois = [
      ...near(A, 'hazard', 1),
      ...near(A, 'water', 1), // 2 groups, 2 POIs, lowest share
      ...near(B, 'hazard', 5), // 1 group, 5 POIs
      ...near(C, 'hazard', 5), // 1 group, 5 POIs, higher share than B
      ...near(D, 'light', 3), // 1 group, 3 POIs, highest share
    ]
    const out = searchSites(
      [
        { site: D, summary: sum(99, 99) },
        { site: B, summary: sum(50, 40) },
        { site: A, summary: sum(10, 0) },
        { site: C, summary: sum(50, 45) },
      ],
      pois,
      OPTS,
    )
    expect(ids(out)).toEqual(['A', 'C', 'B', 'D'])
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3, 4])
    expect(out.map((r) => r.best)).toEqual([true, true, true, false])
    expect(out.map((r) => [r.groupsCovered, r.nearTotal, r.share])).toEqual([
      [2, 2, 10],
      [1, 5, 95],
      [1, 5, 90],
      [1, 3, 198],
    ])
  })

  it('equal keys share a rank, are listed by siteId, and are both best', () => {
    const out = searchSites(
      [
        { site: site('b', 0), summary: sum(50, 30) },
        { site: site('a', 30), summary: sum(30, 50) }, // same sum for 'both'
        { site: site('c', 60), summary: sum(10, 10) },
      ],
      [],
      OPTS,
    )
    expect(ids(out)).toEqual(['a', 'b', 'c'])
    expect(out.map((r) => r.rank)).toEqual([1, 1, 3])
    expect(out.map((r) => r.best)).toEqual([true, true, true])
  })

  it(`only ranks 1..${BEST_COUNT} are best; a tie at the cut-off keeps every tied row`, () => {
    const rows = (sums: number[]) => sums.map((s, i) => ({ site: site(`s${i}`, i * 30), summary: sum(s, 0) }))
    const distinct = searchSites(rows([90, 80, 70, 60, 50]), [], OPTS)
    expect(distinct.map((r) => r.best)).toEqual([true, true, true, false, false])
    const tied = searchSites(rows([90, 80, 70, 70, 50]), [], OPTS)
    expect(tied.map((r) => r.rank)).toEqual([1, 2, 3, 3, 5])
    expect(tied.map((r) => r.best)).toEqual([true, true, true, true, false])
  })

  it('no-data rows come after ranked rows, are never ranked or best, and sort by coverage, then siteId', () => {
    const X = site('x', 0)
    const Y = site('y', 30)
    const Z = site('z', 60)
    const W = site('w', 90)
    const pois = [...near(X, 'hazard', 1), ...near(X, 'water', 1), ...near(X, 'light', 1), ...near(Z, 'hazard', 1)]
    const out = searchSites(
      [
        { site: Y, summary: null },
        { site: X, summary: null }, // covers every group, still after the ranked row
        { site: W, summary: sum(1, 1) },
        { site: Z, summary: null },
      ],
      pois,
      OPTS,
    )
    expect(ids(out)).toEqual(['w', 'x', 'z', 'y'])
    expect(out.map((r) => r.rank)).toEqual([1, null, null, null])
    expect(out.map((r) => r.best)).toEqual([true, false, false, false])
    expect(out.every((r) => r.passes)).toBe(true)
  })
})

describe('searchSites: slope filter', () => {
  const ok = site('ok', 0, 4.9)
  const edge = site('edge', 30, 5.0)
  const steep = site('steep', 60, 8)
  const unknown = site('unknown', 90, null)
  const nodata = site('nodata', 120, 1)
  const rows = [
    { site: steep, summary: sum(99, 99) },
    { site: unknown, summary: sum(98, 98) },
    { site: edge, summary: sum(10, 10) },
    { site: ok, summary: sum(20, 20) },
    { site: nodata, summary: null },
  ]
  const pois = [...near(steep, 'hazard', 2), ...near(unknown, 'hazard', 1)]

  it('when required: a failing or unknown slope does not pass and goes last, after no-data rows', () => {
    const out = searchSites(rows, pois, OPTS)
    expect(ids(out)).toEqual(['ok', 'edge', 'nodata', 'steep', 'unknown'])
    const by = Object.fromEntries(out.map((r) => [r.siteId, r]))
    expect(by.steep).toMatchObject({ slope: 'fail', slopeDeg: 8, passes: false, rank: null, best: false, share: 198 })
    expect(by.unknown).toMatchObject({ slope: 'unknown', slopeDeg: null, passes: false, rank: null, best: false })
    expect(by.edge).toMatchObject({ slope: 'pass', slopeDeg: 5, passes: true, rank: 2 })
  })

  it('failing rows sort by groupsCovered, nearTotal, share (null last), then siteId', () => {
    const f = (id: string, lon: number, summary: Summary | null) => ({ site: site(id, lon, 9), summary })
    const s1 = site('f1', 0, 9)
    const out = searchSites(
      [f('f4', 90, null), f('f3', 60, sum(50, 0)), f('f2', 30, sum(70, 0)), { site: s1, summary: null }, f('f0', 120, null)],
      near(s1, 'hazard', 1),
      OPTS,
    )
    expect(ids(out)).toEqual(['f1', 'f2', 'f3', 'f0', 'f4'])
    expect(out.every((r) => !r.passes && r.rank === null)).toBe(true)
  })

  it('when not required: every row passes and is ranked by its values', () => {
    const out = searchSites(rows, pois, { ...OPTS, slopeRequired: false })
    expect(ids(out)).toEqual(['steep', 'unknown', 'ok', 'edge', 'nodata'])
    expect(out.every((r) => r.passes)).toBe(true)
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3, 4, null])
    expect(out.find((r) => r.siteId === 'steep')?.slope).toBe('fail')
  })
})

describe('searchSites: purity', () => {
  it('does not mutate its input', () => {
    const a = site('a', 0)
    const b = site('b', 30, 9)
    const pois = [...near(a, 'hazard', 2), poi('own', 'landing', a.lat, a.lon, 'a')]
    const rows = [
      { site: a, summary: sum(40, 30) },
      { site: b, summary: null },
    ]
    const opts: SearchOptions = { ...OPTS, groups: ['landing', 'hazard'] }
    const before = JSON.stringify({ rows, pois, opts })
    const deepFreeze = (o: object) => {
      for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v)
      Object.freeze(o)
    }
    deepFreeze(rows)
    deepFreeze(pois)
    deepFreeze(opts)
    const out = searchSites(rows, pois, opts)
    expect(JSON.stringify({ rows, pois, opts })).toBe(before)
    expect(ids(out)).toEqual(['a', 'b'])
  })
})
