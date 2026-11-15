// POI search (U1): great-circle distance, POIs near a point, and the site search order.
// All fixtures are synthetic test inputs built here, not app data; source URLs use the reserved .test domain.
import { describe, expect, it } from 'vitest'
import type { Poi, PoiGroup } from '../data/pois'
import type { Site } from '../data/types'
import type { Summary } from './index'
import { MOON_RADIUS_KM } from './index'
import type { SearchSite } from '../data/pois'
import { BEST_COUNT, SAME_PLACE_KM, type SearchOptions, distanceKm, placeName, poisNear, searchCandidates, searchSites } from './poiSearch'

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

  it('a candidate made from a POI (selfPoiId) does not count that POI, but counts the others', () => {
    const c = site('poi-water-x', 0)
    const pois = [poi('water:x', 'water', c.lat, c.lon), poi('water:y', 'water', c.lat + 0.01, c.lon)]
    const [r] = searchSites([{ site: c, summary: sum(60, 40), selfPoiId: 'water:x' }], pois, { ...OPTS, groups: ['water'] })
    expect(r.counts).toEqual({ water: 1 })
    const [plain] = searchSites([{ site: c, summary: sum(60, 40) }], pois, { ...OPTS, groups: ['water'] })
    expect(plain.counts).toEqual({ water: 2 })
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

  it("'light' = litPct, 'comms' = coveragePct, 'both' = the smaller of the two", () => {
    expect(shareBy('light', sum(61.5, 22.25)).share).toBe(61.5)
    expect(shareBy('comms', sum(61.5, 22.25)).share).toBe(22.25)
    expect(shareBy('both', sum(61.5, 22.25)).share).toBe(22.25)
    expect(shareBy('both', sum(10, 80)).share).toBe(10)
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
  it('groupsCovered before share before nearTotal', () => {
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
        { site: A, summary: sum(10, 20) },
        { site: C, summary: sum(50, 45) },
      ],
      pois,
      OPTS,
    )
    expect(ids(out)).toEqual(['A', 'D', 'C', 'B'])
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3, 4])
    expect(out.map((r) => r.best)).toEqual([true, true, true, false])
    expect(out.map((r) => [r.groupsCovered, r.nearTotal, r.share])).toEqual([
      [2, 2, 10],
      [1, 3, 99],
      [1, 5, 45],
      [1, 5, 40],
    ])
  })

  it('equal keys share a rank, are listed by siteId, and are both best', () => {
    const [a, b, c] = [site('a', 30), site('b', 0), site('c', 60)]
    const out = searchSites(
      [
        { site: b, summary: sum(50, 30) },
        { site: a, summary: sum(30, 50) }, // same smaller value for 'both'
        { site: c, summary: sum(10, 10) },
      ],
      [a, b, c].flatMap((s) => near(s, 'hazard', 1)),
      OPTS,
    )
    expect(ids(out)).toEqual(['a', 'b', 'c'])
    expect(out.map((r) => r.rank)).toEqual([1, 1, 3])
    expect(out.map((r) => r.best)).toEqual([true, true, true])
  })

  it(`only ranks 1..${BEST_COUNT} are best; a tie at the cut-off keeps every tied row`, () => {
    const all = Array.from({ length: 5 }, (_, i) => site(`s${i}`, i * 30))
    const rows = (sums: number[]) => sums.map((s, i) => ({ site: all[i], summary: sum(s, s) }))
    const pois = all.flatMap((s) => near(s, 'hazard', 1))
    const distinct = searchSites(rows([90, 80, 70, 60, 50]), pois, OPTS)
    expect(distinct.map((r) => r.best)).toEqual([true, true, true, false, false])
    const tied = searchSites(rows([90, 80, 70, 70, 50]), pois, OPTS)
    expect(tied.map((r) => r.rank)).toEqual([1, 2, 3, 3, 5])
    expect(tied.map((r) => r.best)).toEqual([true, true, true, true, false])
  })

  it('no-data rows come after ranked rows, are never ranked or best, and sort by coverage, then siteId', () => {
    const X = site('x', 0)
    const Y = site('y', 30)
    const Z = site('z', 60)
    const W = site('w', 90)
    const pois = [...near(X, 'hazard', 1), ...near(X, 'water', 1), ...near(X, 'light', 1), ...near(Z, 'hazard', 1), ...near(W, 'light', 1)]
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
    expect(by.steep).toMatchObject({ slope: 'fail', slopeDeg: 8, passes: false, rank: null, best: false, share: 99 })
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

describe("searchSites: what 'Best' means (defect 5: top picks had Sunlit 0.0 % under 'Both')", () => {
  it("under 'both' a place never lit ranks below a lit one with the same groups nearby, and is never best", () => {
    const dark = site('dark', 0, 1) // a permanently shadowed floor: 0 % sunlit, good coverage
    const lit = site('lit', 30, 3)
    const out = searchSites(
      [
        { site: dark, summary: sum(0, 37) },
        { site: lit, summary: sum(30, 5) },
      ],
      [...near(dark, 'water', 2), ...near(lit, 'water', 1)],
      OPTS,
    )
    expect(ids(out)).toEqual(['lit', 'dark'])
    expect(out.find((r) => r.siteId === 'dark')).toMatchObject({ share: 0, rank: 2, best: false })
    expect(out.find((r) => r.siteId === 'lit')).toMatchObject({ share: 5, rank: 1, best: true })
  })

  it('a place with a share of 0 ranks after every place above 0, even with more chosen groups nearby', () => {
    const dark = site('dark', 0, 1)
    const lit = site('lit', 30, 3)
    const out = searchSites(
      [
        { site: dark, summary: sum(0, 90) },
        { site: lit, summary: sum(20, 20) },
      ],
      [...near(dark, 'water', 1), ...near(dark, 'hazard', 1), ...near(dark, 'light', 1), ...near(lit, 'water', 1)],
      OPTS,
    )
    expect(ids(out)).toEqual(['lit', 'dark'])
    expect(out.map((r) => [r.groupsCovered, r.rank, r.best])).toEqual([
      [1, 1, true],
      [3, 2, false],
    ])
  })

  it("a share of 0 is never best under 'light' or 'comms' either", () => {
    const a = site('a', 0)
    for (const by of ['light', 'comms'] as const) {
      const [r] = searchSites([{ site: a, summary: sum(0, 0) }], near(a, 'water', 1), { ...OPTS, by })
      expect(r).toMatchObject({ rank: 1, best: false })
    }
  })

  it('a place with none of the chosen points nearby is ranked but never best', () => {
    const a = site('a', 0)
    const [r] = searchSites([{ site: a, summary: sum(90, 90) }], [], OPTS)
    expect(r).toMatchObject({ groupsCovered: 0, rank: 1, best: false })
  })

  it('equal shares are ordered by the flatter slope, then by more points nearby (defect 6: everything ranked 1)', () => {
    const steeper = site('a', 0, 4)
    const flatter = site('b', 30, 1.5)
    const flatMore = site('c', 60, 1.5)
    const out = searchSites(
      [steeper, flatter, flatMore].map((s) => ({ site: s, summary: sum(100, 100) })),
      [...near(steeper, 'water', 3), ...near(flatter, 'water', 1), ...near(flatMore, 'water', 2)],
      OPTS,
    )
    expect(ids(out)).toEqual(['c', 'b', 'a'])
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3])
  })
})

describe('placeName and one row per place (defect 5: "Shoemaker" listed 4-5 times)', () => {
  it('drops "(…)" notes, a trailing "crater", case and extra spaces', () => {
    expect(placeName('Shoemaker (Tye et al. 2015)')).toBe('shoemaker')
    expect(placeName('Shoemaker crater')).toBe('shoemaker')
    expect(placeName('  Shoemaker ')).toBe('shoemaker')
    expect(placeName('Shoemaker / Nobile')).toBe('shoemaker / nobile')
    expect(placeName('Shoemaker scarp')).toBe('shoemaker scarp')
  })

  // Synthetic records shaped like several catalogues of one crater: positions a few km apart, different categories.
  const ex = (id: string, name: string, lat: number, lon: number): SearchSite => ({ ...site(id, lon, 2, lat), name, poi_id: id })
  const P = (id: string, category: string, lat: number, lon: number): Poi => ({ ...poi(id, 'cold-trap', lat, lon), category })
  const recs = [
    { e: ex('atlas', 'Crater X', -88.026, 45.279), p: P('atlas', 'psr_atlas', -88.026, 45.279) },
    { e: ex('host', 'Crater X', -88.14, 45.91), p: P('host', 'host_crater', -88.14, 45.91) },
    { e: ex('age', 'Crater X (age study)', -88.1, 44.9), p: P('age', 'crater_age', -88.1, 44.9) },
    { e: ex('feat', 'Crater X crater', -88.1, 44.9), p: P('feat', 'science_feature', -88.1, 44.9) },
    { e: ex('rim', 'Crater X rim A', -88.08, 11.9), p: P('rim', 'study_site', -88.08, 11.9) }, // another name
    { e: ex('far', 'Crater X', -87.0, 45.3), p: P('far', 'psr_atlas', -87.0, 45.3) }, // same name, ~31 km away
  ]
  const c = searchCandidates([], recs.map((r) => r.e), recs.map((r) => r.p))

  it('several records of one place within SAME_PLACE_KM are one candidate; the feature record stands for it', () => {
    expect(distanceKm(-88.026, 45.279, -88.14, 45.91)).toBeLessThan(SAME_PLACE_KM)
    expect(c.map((x) => x.site.id)).toEqual(['feat', 'rim', 'far'])
    expect(c[0].selfPoiId).toBe('feat')
    expect(c[0].records.map((r) => r.id).sort()).toEqual(['age', 'atlas', 'host'])
    expect(c[1].records).toEqual([])
    expect(c[2].records).toEqual([])
  })

  it('illumination points merge only within 1 km', () => {
    const I = (id: string, name: string, lat: number) => ({ e: ex(id, name, lat, 0), p: P(id, 'illumination_point', lat, 0) })
    const pts = [I('s1', 'Rim S (max illumination point)', -89.0), I('s2', 'Rim S (max visibility point)', -89.1), I('s3', 'Rim S (= Site 4)', -89.101)]
    const out = searchCandidates([], pts.map((x) => x.e), pts.map((x) => x.p))
    expect(distanceKm(-89.0, 0, -89.1, 0)).toBeGreaterThan(1)
    expect(out.map((x) => [x.site.id, x.records.map((r) => r.id)])).toEqual([
      ['s1', []],
      ['s3', ['s2']], // the shorter name stands for the place
    ])
  })

  it('an app site is never merged with a point', () => {
    const s = { ...site('crater-x', 45.279, 2, -88.026), name: 'Crater X' }
    const out = searchCandidates([s], [recs[0].e], [recs[0].p])
    expect(out.map((x) => x.site.id)).toEqual(['crater-x', 'atlas'])
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

describe('searchCandidates (search-sites.json fixture)', () => {
  // Same shape as the terrain track's file: a Site plus poi_id; id "poi-<group>-<record id>".
  const extra = (id: string, poiId: string, lat: number): SearchSite => ({ ...site(id, 10, 3, lat), poi_id: poiId })
  const sites = [site('ridge', 0, 3, -89), site('massif', 20, 4, -86)]
  const pois = [
    poi('water:a', 'water', -88, 10),
    poi('landing:ridge_record', 'landing', -89, 0, 'ridge'), // the POI is an app site
    poi('cold-trap:b', 'cold-trap', -87, 10),
  ]
  it('lists every site, then each POI point whose POI is shown and is not an app site, once', () => {
    const fixture = [
      extra('poi-water-a', 'water:a', -88),
      extra('poi-landing-ridge-record', 'landing:ridge_record', -89), // listed once, as the site
      extra('poi-science-north', 'science:north', -70), // its POI is not shown (outside the pin region)
      extra('poi-cold-trap-b', 'cold-trap:b', -87),
      extra('poi-water-a', 'water:a', -88), // duplicate entry
    ]
    const c = searchCandidates(sites, fixture, pois)
    expect(c.map((x) => x.site.id)).toEqual(['ridge', 'massif', 'poi-water-a', 'poi-cold-trap-b'])
    expect(c.map((x) => x.selfPoiId)).toEqual([null, null, 'water:a', 'cold-trap:b'])
  })
  it('without the file the candidates are the sites only', () => {
    expect(searchCandidates(sites, [], pois).map((x) => x.site.id)).toEqual(['ridge', 'massif'])
  })
  it('a candidate does not count its own POI', () => {
    const c = searchCandidates(sites, [extra('poi-water-a', 'water:a', -88)], pois)
    const rows = searchSites(c.map((x) => ({ ...x, summary: sum(50, 50) })), pois, { ...OPTS, groups: ['water'], radiusKm: 5 })
    expect(rows.find((r) => r.siteId === 'poi-water-a')!.counts).toEqual({ water: 0 })
  })
})
