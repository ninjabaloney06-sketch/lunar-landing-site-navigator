// The landing-slope criterion on screen. The rule itself lives in geometry/rankSites (≤ 5° passes, > 5° fails,
// missing = unknown; ninja's project criterion, not a sourced safety limit); this file only asks it about one site
// and names the baseline the number was computed on.
import type { Site } from '../data/types'
import { rankSites } from '../geometry'
import type { SlopeState } from '../geometry'

// scripts/horizon.py: `SLOPE_HALF_BASE_KM = 0.05  # ±50 m → 100 m baseline` (heights 50 m east, west, north and
// south of the site on the LOLA 20 m DEM). The horizon files do not carry the baseline, so it is stated here.
export const SLOPE_BASELINE = '100 m'

export function slopeOf(site: Site): { state: SlopeState; deg: number | null } {
  const { ranked, failed, unknown } = rankSites([{ site, summary: null }], 'any')
  const r = [...ranked, ...failed, ...unknown][0]
  return { state: r.slope, deg: r.slopeDeg }
}
