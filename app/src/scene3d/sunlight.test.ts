import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import type { Horizon } from '../data/types'
import { discFraction, maskAt } from '../geometry'
import { enuDir } from './frames'
import { SITE_DISC_M, crestShare, drawnShare, sunCrest } from './sunlight'
import ridgeRaw from '../../public/data/horizons/connecting-ridge.json?raw'

const R = 0.267 // Sun's angular radius, deg
const flat = (maskDeg: number, distKm: number): Horizon => ({
  site_id: 't',
  lat: -89,
  lon: 0,
  elev_m: 0,
  observer_height_m: 1.75,
  az_step: 1,
  mask: Array(360).fill(maskDeg),
  mask_dist_km: Array(360).fill(distKm),
  ray_max_km: 300,
  truncated: [],
  dem: 'test',
})

describe('sunlight: the site terrain follows the computed disc fraction (bug of 15 Nov night)', () => {
  it("at the site the crest's share is geometry.discFraction of the Sun above the mask", () => {
    const h = flat(1, 2)
    for (const el of [0.5, 0.8, 1, 1.2, 1.5, -0.2]) {
      const c = sunCrest(h, enuDir(130, el), R)
      expect(crestShare(c, new Vector3()).share).toBeCloseTo(discFraction(el, 1, R), 6)
      expect(crestShare(c, new Vector3()).weight).toBe(1)
    }
  })

  it('with a real horizon file (Connecting Ridge) at every 15° of azimuth', () => {
    const h = JSON.parse(ridgeRaw) as Horizon
    for (let az = 0; az < 360; az += 15) {
      const m = maskAt(h, az)
      for (const el of [m - 0.2, m, m + 0.2]) {
        const c = sunCrest(h, enuDir(az, el), R)
        expect(crestShare(c, new Vector3()).share, `az ${az} el ${el}`).toBeCloseTo(discFraction(el, m, R), 5)
      }
    }
  })

  it('beyond the crest toward the Sun, and off the strip it shades, the ground gets the Sun (no cast shadow known)', () => {
    const c = sunCrest(flat(2, 3), enuDir(90, 0.5), R) // Sun due east, 1.5° below the mask: site hidden
    expect(crestShare(c, new Vector3()).share).toBe(0)
    expect(crestShare(c, new Vector3(4000, 0, 0)).share).toBe(1) // east of the crest
    expect(crestShare(c, new Vector3(0, 30_000, 0)).weight).toBe(0) // 30 km north of the Sun line
    // drawnShare: the site's own level at the site, 1 on terrain the crest does not shade, whatever the site's level.
    expect(drawnShare(c, new Vector3(), 0, 0)).toBe(0)
    expect(drawnShare(c, new Vector3(0, 30_000, -200), 0, 0)).toBe(1)
    expect(drawnShare(c, new Vector3(4000, 0, 30), 0, 0)).toBe(1)
  })

  it('ground behind the site, lower than the crest line, is in the crest shadow; ground high enough is lit', () => {
    const c = sunCrest(flat(2, 3), enuDir(90, 1), R)
    expect(crestShare(c, new Vector3(-1500, 0, 0)).share).toBe(0) // 1.5 km west, same height
    expect(crestShare(c, new Vector3(-1500, 0, 100)).share).toBe(1) // 100 m higher sees over the crest
  })

  it('near the site the drawn share is the eased site level, also during a fade', () => {
    const c = sunCrest(flat(1, 2), enuDir(10, 1.5), R) // site lit
    expect(drawnShare(c, new Vector3(), 1, 0)).toBe(1)
    expect(drawnShare(c, new Vector3(), 0.3, -0.7)).toBeCloseTo(0.3, 12)
    expect(drawnShare(c, new Vector3(SITE_DISC_M * 0.5, 0, 0), 0.3, -0.7)).toBeCloseTo(0.3, 12)
  })

  it('a horizon without distances or no horizon at all still gives the site its share', () => {
    const h = flat(0.5, 0)
    const c = sunCrest(h, enuDir(200, 0.4), R)
    expect(crestShare(c, new Vector3()).share).toBeCloseTo(discFraction(0.4, 0.5, R), 6)
    const n = sunCrest(null, enuDir(200, 0.1), R)
    expect(crestShare(n, new Vector3()).share).toBeCloseTo(discFraction(0.1, maskAt(null, 200), R), 6)
  })
})
