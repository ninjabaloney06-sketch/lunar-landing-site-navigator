// A custom landing site on screen (data/customSite.ts): the site once capHorizon has given its height and slope,
// and the texts that say how approximate its numbers are. Every resolution in these texts is read from the
// horizon's `computed` record or the terrain's `meta.cap`, the spacings capHorizon and capTerrain actually used.
import { useEffect, useMemo, useState } from 'react'
import { customHorizon, customSiteBase, loadCustomSite, parseCustomSiteId } from '../data/customSite'
import type { CapHorizon } from '../data/southcap'
import type { Site } from '../data/types'
import { REGION_TEXT } from './poiLayer'

export type CustomSiteState =
  | { status: 'loading'; site: Site } // site: the base (no height, no slope yet)
  | { status: 'ready'; site: Site; horizon: CapHorizon }
  | { status: 'error'; site: Site }

/** Why "Set as landing site" is not offered for a place. */
export const SITE_REGION_TEXT = `Landing sites can be set only ${REGION_TEXT}.`

/** null when id is not a custom site id; otherwise the site, first without and then with its computed values. A
 *  failure leaves the base: the answer line reports it (data/results.ts gives the same "no data" state). */
export function useCustomSite(id: string | null): CustomSiteState | null {
  const base = useMemo(() => (id && parseCustomSiteId(id) ? customSiteBase(id) : null), [id])
  const loading = useMemo<CustomSiteState | null>(() => base && { status: 'loading', site: base }, [base])
  const [state, setState] = useState<{ id: string; s: CustomSiteState } | null>(null)
  useEffect(() => {
    if (!base) return
    let alive = true
    Promise.all([loadCustomSite(base.id), customHorizon(base.id)]).then(
      ([site, horizon]) => alive && setState({ id: base.id, s: { status: 'ready', site, horizon } }),
      () => alive && setState({ id: base.id, s: { status: 'error', site: base } }),
    )
    return () => {
      alive = false
    }
  }, [base])
  if (!base) return null
  return state && state.id === base.id ? state.s : loading
}

type Computed = CapHorizon['computed']

/** "40 m / 80 m": the terrain spacing at the point and the coarsest one any ray used within rings.nearKm. */
export function nearRes(c: Computed): string {
  return [...new Set([c.site_res_m, c.near_res_m])].map((v) => `${v} m`).join(' / ')
}

/** The one line beside a custom site's numbers. */
export const approxText = (c: Computed) => `Approximate: from ${nearRes(c)} terrain, not validated`

/** The footer's terrain part for a custom site (a prepared site keeps its fixed "LOLA 20 m" text). */
export const footTerrain = (c: Computed) => `Terrain LOLA ${nearRes(c)} (${c.far_res_m} m beyond ${c.rings.nearKm} km)`
