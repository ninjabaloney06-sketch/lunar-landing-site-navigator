// Sunlight on the site terrain, per point. History: until 15 Nov one light level for the whole scene (the site's
// own disc share); 15 Nov night per fragment, but with the shadow of ONE obstacle only (the mask's crest at the
// Sun's azimuth, taken to shade a straight strip of ground) and the site's share on a 400 m patch. Under Play the
// strip turned with the Sun and read as a rectangular shadow sweeping over the terrain (science lead, 16 Nov:
// "weird rectangular shadows"). Since 16 Nov the terrain casts its own shadows; the strip and the patch are gone.
//
// COMPUTED ELSEWHERE, READ ONLY, never changed here: the Sun's direction (ephemeris, the sky layer), the horizon
// mask (horizon.py) and from them geometry.discFraction, the share of the Sun's disc above the mask at the site's
// eye: the number the answer, the timeline and the Sun label come from.
//
// COMPUTED HERE, FOR THE PICTURE (shadows.ts, shadowmap.ts):
//   - Cast shadows of the drawn terrain on itself: for every ground point, the terrain's horizon toward the Sun's
//     azimuth out to the edge of the far level (±300 km), from the heights the scene draws (20 m, 80 m, 160 m,
//     400 m, 2 km levels), with the Moon's curvature. Recomputed on the GPU when the Sun moves.
//   - The share of the Sun's disc above that horizon, by geometry.discFraction's formula (a disc cut by a straight
//     horizon), seen from an eye OBSERVER_HEIGHT_M above the ground like the mask. The Sun's disc is 0.53° wide,
//     so a shadow edge is a penumbra whose width grows with the distance to the crest that casts it.
//   - The drawn terrain is coarser than the 20 m DEM the mask was computed from (and clamped under the mask's
//     sight lines, site.ts), so at the marker the picture can disagree with the mask for a while around a sunrise
//     or sunset. The answer is the mask's. So that the marker's ground shows it, the terrain's horizon is shifted
//     by the difference at the site, c_site(mask) − c_site(terrain), weighted exp(−(r / SITE_BLEND_M)²) with the
//     distance r from the site: a smooth round falloff with no edge, zero wherever terrain and mask agree, and it
//     moves the terrain's own shadow edge instead of painting a patch.
//     (scripts in e2e/shadow-agreement.spec.ts measure how often and how far they disagree.)
//
// RENDERING CHOICES (site.ts, shader):
//   - Surface brightness: the Lommel–Seeliger law, μ₀ / (μ₀ + μ) with μ₀ and μ the cosines of the angles of
//     incidence and of view against the terrain normal, scaled to equal Lambert's μ₀ for a surface lit and seen
//     along its normal, and weighted LUNAR_WEIGHT against Lambert's μ₀. It is the single-scattering law of a dark
//     particulate surface and the reason the full Moon has no limb darkening; Lambert alone, right for a matt
//     painted surface, draws level regolith under a Sun 1° up at 2 % of a Sun-facing slope's brightness whatever
//     the viewing direction, and the sunlit landing site was drawn black (bug of 15 Nov night). No phase function
//     (no opposition surge, no darkening toward the Sun) is applied. This replaces the earlier wrapped cosine
//     (LAMBERT_WRAP 0.25), which lit ground turned up to 14° away from the Sun; now ground turned away from the
//     Sun gets none of it.
//   - Ground the Sun does not reach is not lit by it at all (the earlier 12 % "hidden Sun" level is gone). What
//     remains there: earthshine (a directional light from Earth's direction, scaled by Earth's phase and by its
//     disc above the site's mask, index.ts; it casts no shadows here), and an even fill, NIGHT_FILL (site.ts),
//     that stands for sunlight scattered into the shadows by the sunlit terrain around. On the Moon there is no
//     sky light, so shadows are far darker than on Earth, but permanently shadowed ground is not black either: it
//     is lit by the sunlit crater walls above it. The fill's level is a display choice (about 1.7 % of the direct
//     sunlight on a Sun-facing surface), not a computed radiance.
//   - A jump of the time fades the site's own level over 500 ms (index.ts LIGHT_EASE_MS); during it the site
//     neighbourhood above follows the eased level. The cast shadows themselves are never eased.

import type { Vector3 } from 'three'
import { cOfShare, shareOfC, sunC, type ShadowLevel } from './shadows'

/** Scale of the round neighbourhood of the site where the terrain's horizon is shifted to the mask's answer, m. */
export const SITE_BLEND_M = 250
/** Weight of the Lommel–Seeliger term against Lambert's cosine in the terrain's brightness (0: Lambert only). */
export const LUNAR_WEIGHT = 1

/** Weight of the site's correction at horizontal distance r (m) from the site: 1 at the site, 0.02 at 500 m. */
export function siteWeight(r: number): number {
  return Math.exp(-(r * r) / (SITE_BLEND_M * SITE_BLEND_M))
}

/**
 * The c drawn at a ground point (shadows.ts sunC's scale: −1 whole disc … +1 none): the terrain's own, shifted
 * toward the site's answer near the site. cTerrain0: the terrain's c at the site itself; cSite: the mask's.
 */
export function drawnC(cTerrain: number, cTerrain0: number, cSite: number, r: number): number {
  return Math.min(Math.max(cTerrain + siteWeight(r) * (cSite - cTerrain0), -1), 1)
}

/**
 * Share of the Sun's disc the terrain shader draws at the grid offset (x, y) m: the terrain's own shadowing with
 * the site's correction. siteShare: the site's (eased) disc share from the mask. The GLSL in site.ts does the same
 * with the GPU's shadow textures.
 */
export function drawnShare(levels: ShadowLevel[], x: number, y: number, sun: Vector3, angRadDeg: number, siteShare: number): number {
  const c0 = sunC(levels, 0, 0, sun, angRadDeg)
  return shareOfC(drawnC(sunC(levels, x, y, sun, angRadDeg), c0, cOfShare(siteShare), Math.hypot(x, y)))
}
