// Science-goal site ranking (Step 2-UI, Brief C3 part 1). Pure: no DOM, no fetch; never mutates its input.
// Order: hard slope filter, then the goal's own rule, then combined coverage (desc), then % sunlit (desc).
// No weighted score: keys are compared one after another, so every row's place can be checked by hand from its values.

import type { Site, SitePotential } from '../data/types'
import type { Summary } from './index'

export type ScienceGoal = 'any' | 'water-ice' | 'cold-trap' | 'light' | 'science'
export type SlopeState = 'pass' | 'fail' | 'unknown'

export interface RankedSite {
  siteId: string
  rank: number | null // competition ranking (1, 1, 3) inside `ranked`; null in `failed` and `unknown`
  slope: SlopeState
  slopeDeg: number | null
  litPct: number | null
  coveragePct: number | null
  longestDarkH: number | null
  longestGapH: number | null
  goalEvidence: SitePotential['evidence'] | null // best tier for an evidence goal; null = no entry, or goal 'any' / 'light'
  goalSourceUrl: string | null // source_url of that best entry (first one in input order if several share the tier)
  tiedWith: string[] // the other siteIds sharing this rank
}

// spec.md "Terrain slope": slope <= 5 deg passes the landing-slope criterion (exactly 5 passes); ninja's project
// criterion, not a sourced safety limit. Passing it alone does not make a site safe to land.
const SLOPE_LIMIT_DEG = 5.0

// Evidence tiers, best first (Step 2-UI plan). Index = sort key; a site with no entry for the goal sorts after all.
const TIERS: SitePotential['evidence'][] = [
  'direct measurement',
  'remote observation',
  'modeled condition',
  'hypothesis',
  'unknown',
]
const NO_ENTRY = TIERS.length

const GOAL_CATEGORIES: Partial<Record<ScienceGoal, SitePotential['category'][]>> = {
  'water-ice': ['water-ice'],
  'cold-trap': ['cold-trap'],
  science: ['science', 'other'],
}

const finite = (x: number | null | undefined): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)

function bestEntry(site: Site, goal: ScienceGoal): { tier: number; entry: SitePotential | null } {
  const cats = GOAL_CATEGORIES[goal]
  let tier = NO_ENTRY
  let entry: SitePotential | null = null
  if (!cats) return { tier, entry }
  for (const p of site.potential) {
    const t = TIERS.indexOf(p.evidence)
    if (cats.includes(p.category) && t >= 0 && t < tier) {
      tier = t
      entry = p
    }
  }
  return { tier, entry }
}

/** Lexicographic; every key is "lower is better". 0 = equal on every key (a tie). */
function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}
const byId = (a: RankedSite, b: RankedSite) => (a.siteId < b.siteId ? -1 : a.siteId > b.siteId ? 1 : 0)

export function rankSites(
  rows: { site: Site; summary: Summary | null }[],
  goal: ScienceGoal,
): { ranked: RankedSite[]; failed: RankedSite[]; unknown: RankedSite[] } {
  const failed: RankedSite[] = []
  const unknown: RankedSite[] = []
  const cands: { r: RankedSite; keys: number[] }[] = []

  for (const { site, summary } of rows) {
    const slopeDeg = finite(site.slope_deg)
    const slope: SlopeState = slopeDeg === null ? 'unknown' : slopeDeg <= SLOPE_LIMIT_DEG ? 'pass' : 'fail'
    const { tier, entry } = bestEntry(site, goal)
    const lit = finite(summary?.litPct)
    const cov = finite(summary?.coveragePct)
    const dark = finite(summary?.longestDarkH)
    const r: RankedSite = {
      siteId: site.id,
      rank: null,
      slope,
      slopeDeg,
      litPct: lit,
      coveragePct: cov,
      longestDarkH: dark,
      longestGapH: finite(summary?.longestGapH),
      goalEvidence: entry ? entry.evidence : null,
      goalSourceUrl: entry ? entry.source_url : null,
      tiedWith: [],
    }
    // A failing slope always goes to `failed`, with or without a summary: the hard filter decides first.
    // Otherwise a missing summary (no ephemeris or horizon) or a value summarize() could not compute (a zero-length
    // period gives 0/0) puts the site in `unknown`, like an unknown slope. Neither is ever counted as a pass.
    if (slope === 'fail') failed.push(r)
    else if (slope === 'unknown' || lit === null || cov === null || dark === null) unknown.push(r)
    else {
      const tail = [-cov, -lit] // tie-breakers for every goal: coverage desc, then % sunlit desc
      const keys =
        goal === 'light' ? [-lit, dark, ...tail] : goal === 'any' ? tail : [tier, ...tail] // 'any' = coverage desc
      cands.push({ r, keys })
    }
  }

  cands.sort((a, b) => compareKeys(a.keys, b.keys) || byId(a.r, b.r))
  for (let start = 0, i = 1; i <= cands.length; i++) {
    if (i < cands.length && compareKeys(cands[i].keys, cands[start].keys) === 0) continue
    const group = cands.slice(start, i)
    for (const c of group) {
      c.r.rank = start + 1
      c.r.tiedWith = group.filter((g) => g !== c).map((g) => g.r.siteId)
    }
    start = i
  }

  return { ranked: cands.map((c) => c.r), failed: failed.sort(byId), unknown: unknown.sort(byId) }
}
