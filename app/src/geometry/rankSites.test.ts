// Science-goal ranking (Brief C3 part 1): slope filter, goal rules, tie-breakers, ties, groups.
// All fixtures are synthetic test inputs built here, not app data; source URLs use the reserved .test domain.
import { describe, expect, it } from 'vitest'
import type { Site, SitePotential } from '../data/types'
import { type Summary, rankSites } from './index'

function site(id: string, slope_deg: number | null, potential: SitePotential[] = []): Site {
  return {
    id,
    name: id,
    group: 'reference',
    label: null,
    lat: -89,
    lon: 0,
    frame_note: 'synthetic',
    elev_m: 0,
    slope_deg,
    far_side: false,
    source_url: `https://example.test/${id}`,
    source_label: 'synthetic',
    horizon: null,
    potential,
  }
}

function entry(category: SitePotential['category'], evidence: SitePotential['evidence'], tag: string): SitePotential {
  return { category, text: 'synthetic', evidence, source_url: `https://example.test/${tag}` }
}

function sum(litPct: number, coveragePct: number, longestDarkH = 0, longestGapH = 0): Summary {
  return { litPct, earthVisiblePct: 50, coveragePct, unknownPct: 0, longestDarkH, longestGapH }
}

const ids = (xs: { siteId: string }[]) => xs.map((x) => x.siteId)

describe('rankSites: slope filter', () => {
  it('ranks a passing site and copies the values it was ranked by', () => {
    const { ranked, failed, unknown } = rankSites([{ site: site('a', 3.7), summary: sum(71, 54, 20, 6) }], 'any')
    expect(failed).toEqual([])
    expect(unknown).toEqual([])
    expect(ranked).toEqual([
      {
        siteId: 'a',
        rank: 1,
        slope: 'pass',
        slopeDeg: 3.7,
        litPct: 71,
        coveragePct: 54,
        longestDarkH: 20,
        longestGapH: 6,
        goalEvidence: null,
        goalSourceUrl: null,
        tiedWith: [],
      },
    ])
  })

  it('slope exactly 5.0 passes', () => {
    const { ranked } = rankSites([{ site: site('a', 5.0), summary: sum(50, 50) }], 'any')
    expect(ranked).toHaveLength(1)
    expect(ranked[0].slope).toBe('pass')
    expect(ranked[0].rank).toBe(1)
  })

  it('slope 5.1 fails: in `failed`, rank null, values still shown', () => {
    const { ranked, failed, unknown } = rankSites([{ site: site('a', 5.1), summary: sum(90, 90) }], 'any')
    expect(ranked).toEqual([])
    expect(unknown).toEqual([])
    expect(failed).toHaveLength(1)
    expect(failed[0]).toMatchObject({ siteId: 'a', rank: null, slope: 'fail', slopeDeg: 5.1, litPct: 90 })
  })

  it('null, missing or non-finite slope is unknown, never a pass', () => {
    const noField = { ...site('b', null) } as Partial<Site>
    delete noField.slope_deg
    const { ranked, failed, unknown } = rankSites(
      [
        { site: site('a', null), summary: sum(90, 90) },
        { site: noField as Site, summary: sum(90, 90) },
        { site: site('c', Number.NaN), summary: sum(90, 90) },
      ],
      'any',
    )
    expect(ranked).toEqual([])
    expect(failed).toEqual([])
    expect(ids(unknown)).toEqual(['a', 'b', 'c'])
    for (const u of unknown) expect(u).toMatchObject({ slope: 'unknown', slopeDeg: null, rank: null })
  })

  it('summary null: unknown when the slope passes, failed when the slope fails', () => {
    const { ranked, failed, unknown } = rankSites(
      [
        { site: site('pass-no-data', 2), summary: null },
        { site: site('steep-no-data', 30), summary: null },
      ],
      'light',
    )
    expect(ranked).toEqual([])
    expect(ids(unknown)).toEqual(['pass-no-data'])
    expect(unknown[0]).toMatchObject({ slope: 'pass', litPct: null, coveragePct: null, rank: null })
    expect(ids(failed)).toEqual(['steep-no-data'])
  })

  it('every site failing gives ranked = []', () => {
    const { ranked, failed } = rankSites(
      [
        { site: site('a', 31.8), summary: sum(10, 10) },
        { site: site('b', 5.6), summary: sum(80, 80) },
      ],
      'any',
    )
    expect(ranked).toEqual([])
    expect(ids(failed)).toEqual(['a', 'b'])
  })
})

describe('rankSites: goal rules', () => {
  it("'any' orders by coverage, then % sunlit", () => {
    const { ranked } = rankSites(
      [
        { site: site('low-cov', 1), summary: sum(99, 40) },
        { site: site('high-cov-dim', 1), summary: sum(30, 80) },
        { site: site('high-cov-lit', 1), summary: sum(60, 80) },
      ],
      'any',
    )
    expect(ids(ranked)).toEqual(['high-cov-lit', 'high-cov-dim', 'low-cov'])
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3])
  })

  it("'light' orders by litPct desc, then longestDarkH asc, before coverage", () => {
    const { ranked } = rankSites(
      [
        { site: site('lit60', 1), summary: sum(60, 99, 10) },
        { site: site('lit80-dark50', 1), summary: sum(80, 10, 50) },
        { site: site('lit80-dark20', 1), summary: sum(80, 10, 20) },
        { site: site('lit90', 1), summary: sum(90, 5, 70) },
      ],
      'light',
    )
    expect(ids(ranked)).toEqual(['lit90', 'lit80-dark20', 'lit80-dark50', 'lit60'])
    expect(ranked.every((r) => r.goalEvidence === null && r.goalSourceUrl === null)).toBe(true)
  })

  it("evidence tiers order correctly for 'water-ice' and the best entry's source is kept", () => {
    // Coverage rises as the tier gets worse, so only the tier can produce the expected order.
    const { ranked } = rankSites(
      [
        { site: site('unk', 1, [entry('water-ice', 'unknown', 'unk')]), summary: sum(50, 90) },
        { site: site('hyp', 1, [entry('water-ice', 'hypothesis', 'hyp')]), summary: sum(50, 80) },
        { site: site('mod', 1, [entry('water-ice', 'modeled condition', 'mod')]), summary: sum(50, 70) },
        {
          site: site('rem', 1, [
            entry('water-ice', 'hypothesis', 'rem-weak'),
            entry('cold-trap', 'direct measurement', 'rem-other-goal'),
            entry('water-ice', 'remote observation', 'rem-best'),
          ]),
          summary: sum(50, 60),
        },
        { site: site('dir', 1, [entry('water-ice', 'direct measurement', 'dir')]), summary: sum(50, 50) },
      ],
      'water-ice',
    )
    expect(ids(ranked)).toEqual(['dir', 'rem', 'mod', 'hyp', 'unk'])
    expect(ranked.map((r) => r.goalEvidence)).toEqual([
      'direct measurement',
      'remote observation',
      'modeled condition',
      'hypothesis',
      'unknown',
    ])
    expect(ranked[1].goalSourceUrl).toBe('https://example.test/rem-best')
  })

  it('a site with no entry for the goal ranks last, with goalEvidence null', () => {
    const { ranked } = rankSites(
      [
        { site: site('none', 1, [entry('cold-trap', 'remote observation', 'x')]), summary: sum(99, 99) },
        { site: site('unknown-entry', 1, [entry('water-ice', 'unknown', 'u')]), summary: sum(10, 10) },
      ],
      'water-ice',
    )
    expect(ids(ranked)).toEqual(['unknown-entry', 'none'])
    expect(ranked[1]).toMatchObject({ rank: 2, goalEvidence: null, goalSourceUrl: null })
  })

  it("'science' reads categories 'science' and 'other'", () => {
    const { ranked } = rankSites(
      [
        { site: site('sci-hyp', 1, [entry('science', 'hypothesis', 'sci')]), summary: sum(90, 90) },
        { site: site('other-rem', 1, [entry('other', 'remote observation', 'oth')]), summary: sum(10, 10) },
        { site: site('ice-only', 1, [entry('water-ice', 'direct measurement', 'ice')]), summary: sum(99, 99) },
      ],
      'science',
    )
    expect(ids(ranked)).toEqual(['other-rem', 'sci-hyp', 'ice-only'])
    expect(ranked[0]).toMatchObject({ goalEvidence: 'remote observation', goalSourceUrl: 'https://example.test/oth' })
    expect(ranked[2].goalEvidence).toBeNull()
  })

  it("'cold-trap': equal tiers are broken by coverage, then % sunlit", () => {
    const ct = () => [entry('cold-trap', 'modeled condition', 'ct')]
    const { ranked } = rankSites(
      [
        { site: site('cov50-lit40', 1, ct()), summary: sum(40, 50) },
        { site: site('cov50-lit70', 1, ct()), summary: sum(70, 50) },
        { site: site('cov60', 1, ct()), summary: sum(10, 60) },
      ],
      'cold-trap',
    )
    expect(ids(ranked)).toEqual(['cov60', 'cov50-lit70', 'cov50-lit40'])
  })
})

describe('rankSites: ties and purity', () => {
  it('sites equal on every key share a rank (1, 1, 3), list each other, and sort by siteId', () => {
    const { ranked } = rankSites(
      [
        { site: site('c', 1), summary: sum(40, 40) },
        { site: site('b', 2), summary: sum(70, 60) },
        { site: site('a', 3), summary: sum(70, 60) },
      ],
      'any',
    )
    expect(ids(ranked)).toEqual(['a', 'b', 'c'])
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3])
    expect(ranked[0].tiedWith).toEqual(['b'])
    expect(ranked[1].tiedWith).toEqual(['a'])
    expect(ranked[2].tiedWith).toEqual([])
  })

  it('does not mutate the input and never produces NaN', () => {
    const rows = [
      { site: site('z', 2, [entry('water-ice', 'hypothesis', 'z')]), summary: sum(30, 30) },
      { site: site('y', 2, [entry('water-ice', 'remote observation', 'y')]), summary: sum(20, 20) },
      // zero-length period: summarize() gives 0/0 percentages
      { site: site('x', 2), summary: { ...sum(0, 0), litPct: Number.NaN, coveragePct: Number.NaN } },
      { site: site('w', 9), summary: sum(Number.NaN, Number.NaN) },
    ]
    const before = structuredClone(rows)
    const out = rankSites(rows, 'water-ice')
    expect(rows).toEqual(before)
    expect(ids(out.ranked)).toEqual(['y', 'z'])
    expect(ids(out.unknown)).toEqual(['x'])
    expect(ids(out.failed)).toEqual(['w'])
    const values = [...out.ranked, ...out.failed, ...out.unknown].flatMap((r) => Object.values(r))
    expect(values.some((v) => typeof v === 'number' && Number.isNaN(v))).toBe(false)
  })
})
