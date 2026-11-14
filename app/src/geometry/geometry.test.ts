import { describe, expect, it } from 'vitest'
import { MOON_RADIUS_KM, azEl, enuBasis, siteVector } from './index'

describe('geometry skeleton', () => {
  it('uses the 1737.4 km reference sphere', () => {
    expect(MOON_RADIUS_KM).toBe(1737.4)
  })

  // Integrator draft check of the primitives (T4 shape); Track A owns the full T4/T9 suite.
  it('ENU at 0N 0E: east = +y, north = +z, up = +x', () => {
    const { east, north, up } = enuBasis(0, 0)
    expect(east[1]).toBeCloseTo(1, 12)
    expect(north[2]).toBeCloseTo(1, 12)
    expect(up[0]).toBeCloseTo(1, 12)
  })

  it('a target due north has az 0, due east az 90 (polar site)', () => {
    const lat = -89.7668
    const lon = -171.87
    const site = siteVector(lat, lon, 0)
    const enu = enuBasis(lat, lon)
    const far = (v: number[]) => site.map((s, i) => s + 1e6 * v[i]) as [number, number, number]
    expect(azEl(far(enu.north), site, enu).az).toBeCloseTo(0, 9)
    expect(azEl(far(enu.east), site, enu).az).toBeCloseTo(90, 9)
    expect(azEl(far(enu.up), site, enu).el).toBeCloseTo(90, 6)
  })
})
