// Which of the Sun and Earth the landing site's computed horizon mask shows, as geometry's own disc fraction (the
// number the answer sentence and the timeline come from: sunlit = fraction > 0). The sky layer draws every body at
// its true direction from the camera, and the site-level orbit camera stands above and aside of the site, so it can
// look over a ridge the eye cannot: the drawing follows this number, not what the camera happens to see.

import type { Horizon } from '../data/types'
import { OBSERVER_HEIGHT_M, angRadiusDeg, azEl, discFraction, enuBasis, maskAt, siteVector, type BodyState } from '../geometry'
import { EARTH_RADIUS_KM, SUN_RADIUS_KM } from './frames'

export interface SiteSky {
  lat: number
  lon: number
  elev_m: number | null
}

export interface BodyVisibility {
  /** Visible share (0..1) of the disc above the mask, seen from the eye 1.75 m above the site. */
  fraction: number
  /** Elevation of the disc centre above the local horizontal plane, deg. */
  el: number
  az: number
  /** Mask elevation at that azimuth, deg. */
  mask: number
}

export function eyeVisibility(state: Pick<BodyState, 'sun_km' | 'earth_km'>, site: SiteSky, horizon: Horizon | null): { sun: BodyVisibility; earth: BodyVisibility } {
  const eyeKm = siteVector(site.lat, site.lon, ((site.elev_m ?? 0) + OBSERVER_HEIGHT_M) / 1000)
  const enu = enuBasis(site.lat, site.lon)
  const of = (bodyKm: BodyState['sun_km'], radiusKm: number): BodyVisibility => {
    const a = azEl(bodyKm, eyeKm, enu)
    const mask = maskAt(horizon, a.az)
    return { fraction: discFraction(a.el, mask, angRadiusDeg(radiusKm, a.dist_km)), el: a.el, az: a.az, mask }
  }
  return { sun: of(state.sun_km, SUN_RADIUS_KM), earth: of(state.earth_km, EARTH_RADIUS_KM) }
}
