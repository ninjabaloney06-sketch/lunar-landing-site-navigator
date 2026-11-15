// Sunlight on the site terrain, per point (bug of 15 Nov night: "it remains dark even though the Sun is above the
// terrain"). What is computed and what is a rendering choice:
//
// COMPUTED (read only, never changed here): the Sun's direction (ephemeris, the sky layer), the horizon mask and its
// crest distances (horizon.py), and from them geometry.discFraction, the share of the Sun's disc above the mask at
// the site's eye: the number the answer, the timeline and the Sun label come from.
//
// GEOMETRY ON TOP OF IT: the obstacle that defines the mask at the Sun's azimuth (its crest point, at mask_dist along
// the mask direction from the eye, exactly where site.ts puts the eye-level crest) also shades the ground around the
// site: a point is in the Sun when the ray from an eye standing there toward the Sun passes over that crest point
// (the same disc fraction formula, with the crest's elevation as seen from that point). At the site itself this is
// the site's own number. It is exact for that one obstacle and says nothing about any other one, so:
//
// RENDERING CHOICES (site.ts, shader):
//   - The crest is assumed to extend sideways over CREST_HALF_WIDTH (a share of its distance, 600 m to 4 km), and
//     fades out over as much again. Beyond that strip, and beyond the crest toward the Sun, the terrain gets the
//     Sun with no cast shadow (unknown there; the same as the whole scene when the site is sunlit). There are no
//     shadow maps: before this, the whole scene took the site's own share, so sunlit peaks were drawn dark whenever
//     the site was in shadow.
//   - Within SITE_DISC_M of the site the ground takes the site's own computed share (fading into the crest's
//     over as much again), so the marker stands on ground that shows the answer even where the obstacle is a
//     small bump a few hundred metres away and its true shadow would be a few pixels wide from 17 km.
//   - Hidden from the Sun, a point keeps HIDDEN_SUN_FRACTION of it; ground the Sun does not light directly
//     (hidden, or turned away) gets an even night fill, so it is dim, not black.
//   - LAMBERT_WRAP: a grazing-light floor. The polar Sun stands within a few degrees of the horizon, so Lambert
//     shading (N·L) of near-level ground is a few per cent even in full sunlight, and the sunlit landing site was
//     drawn black (measured: darker than a site in shadow). The cosine term is wrapped by LAMBERT_WRAP
//     ((N·L + w) / (1 + w)): level ground in the Sun reads as lit, slopes facing the Sun brightest, slopes turned
//     away by more than asin(w) ≈ 14° stay dark (the long shadow sides). It stands for the sub-cell relief that faces
//     the Sun inside every 20–2000 m cell; it adds no light where the share above is 0.

import { Vector3 } from 'three'
import type { Horizon } from '../data/types'
import { OBSERVER_HEIGHT_M, discFraction, maskAt } from '../geometry'
import { azElOfEnu, enuDir } from './frames'

export const LAMBERT_WRAP = 0.25
const CREST_HALF_WIDTH = { share: 0.3, minM: 600, maxM: 4000 }
export const SITE_DISC_M = 400
const DEFAULT_CREST_M = 5000 // a mask sample without a distance (site.ts does the same)

export interface SunCrest {
  /** Unit direction to the Sun, ENU. */
  sun: Vector3
  /** Unit horizontal direction to the Sun (x, y; z = 0). */
  horiz: Vector3
  /** The mask's crest point at the Sun's azimuth, ENU m (the site's eye is at z = OBSERVER_HEIGHT_M). */
  crest: Vector3
  /** Half width of the strip the crest is assumed to shade, m. */
  halfWidth: number
  /** Angular radius of the Sun's disc, deg. */
  angRadDeg: number
}

export function sunCrest(h: Horizon | null, sun: Vector3, angRadDeg: number): SunCrest {
  const { az } = azElOfEnu(sun)
  const horiz = new Vector3(sun.x, sun.y, 0)
  if (horiz.lengthSq() < 1e-24) horiz.set(0, 1, 0)
  horiz.normalize()
  let dist = DEFAULT_CREST_M
  if (h && h.mask_dist_km.length) {
    const n = h.mask_dist_km.length
    const k = ((Math.round(az / h.az_step) % n) + n) % n
    const d = h.mask_dist_km[k]
    if (Number.isFinite(d) && d > 0) dist = d * 1000
  }
  const crest = new Vector3(0, 0, OBSERVER_HEIGHT_M).addScaledVector(enuDir(az, maskAt(h, az)), dist)
  const rho = Math.hypot(crest.x, crest.y)
  const halfWidth = Math.min(Math.max(CREST_HALF_WIDTH.share * rho, CREST_HALF_WIDTH.minM), CREST_HALF_WIDTH.maxM)
  return { sun: sun.clone().normalize(), horiz, crest, halfWidth, angRadDeg }
}

/**
 * At the ground point p (ENU m): the share of the Sun's disc above the crest seen from an eye standing there
 * (`share`), and how far the crest is taken to apply there (`weight`, 1 on the strip through the site, 0 off it).
 * The shader in site.ts computes the same per fragment; at the site (p = 0) share is the site's disc fraction.
 */
export function crestShare(c: SunCrest, p: Vector3): { share: number; weight: number } {
  const eye = new Vector3(p.x, p.y, p.z + OBSERVER_HEIGHT_M)
  const along = eye.x * c.horiz.x + eye.y * c.horiz.y
  const lateral = Math.hypot(eye.x - along * c.horiz.x, eye.y - along * c.horiz.y)
  const weight = 1 - smoothstep(c.halfWidth, 2 * c.halfWidth, lateral)
  const ahead = c.crest.x * c.horiz.x + c.crest.y * c.horiz.y - along // crest's distance ahead toward the Sun
  if (ahead <= 1) return { share: 1, weight }
  const toCrest = new Vector3(c.horiz.x * ahead, c.horiz.y * ahead, c.crest.z - eye.z)
  return { share: discFraction(azElOfEnu(c.sun).el, azElOfEnu(toCrest).el, c.angRadDeg), weight }
}

/**
 * The share of the Sun the terrain shader draws at ground point p: the site's eased level `site` within
 * SITE_DISC_M of it; the crest's share (shifted by `delta`, the eased minus the computed site level, during a
 * fade) on the crest's strip; 1 elsewhere. The GLSL in site.ts is this function, line by line.
 */
export function drawnShare(c: SunCrest, p: Vector3, site: number, delta: number): number {
  const { share, weight } = crestShare(c, p)
  const crest = 1 - weight + weight * Math.min(Math.max(share + delta, 0), 1)
  const near = 1 - smoothstep(SITE_DISC_M, 2 * SITE_DISC_M, Math.hypot(p.x, p.y))
  return crest + (site - crest) * near
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}
