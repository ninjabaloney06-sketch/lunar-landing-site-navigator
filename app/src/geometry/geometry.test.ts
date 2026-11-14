import { describe, expect, it } from 'vitest'
import type { EphemMonth, Horizon, Vec3 } from '../data/types'
import {
  FLAT_DIP_DEG,
  MOON_RADIUS_KM,
  azEl,
  discFraction,
  enuBasis,
  interpolate,
  maskAt,
  siteVector,
} from './index'
import { loadMonths } from './testData'

describe('geometry primitives', () => {
  it('uses the 1737.4 km reference sphere', () => {
    expect(MOON_RADIUS_KM).toBe(1737.4)
  })

  it('ENU at 0N 0E: east = +y, north = +z, up = +x', () => {
    const { east, north, up } = enuBasis(0, 0)
    expect(east[1]).toBeCloseTo(1, 12)
    expect(north[2]).toBeCloseTo(1, 12)
    expect(up[0]).toBeCloseTo(1, 12)
  })

  it('ENU is right-handed and orthonormal near the south pole', () => {
    const { east, north, up } = enuBasis(-89.7668, -171.87)
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
    expect(dot(east, north)).toBeCloseTo(0, 12)
    expect(dot(east, up)).toBeCloseTo(0, 12)
    expect(dot(north, up)).toBeCloseTo(0, 12)
    // east x north = up
    const c: Vec3 = [
      east[1] * north[2] - east[2] * north[1],
      east[2] * north[0] - east[0] * north[2],
      east[0] * north[1] - east[1] * north[0],
    ]
    for (let i = 0; i < 3; i++) expect(c[i]).toBeCloseTo(up[i], 12)
    // North is horizontal and points along the meridian toward the north pole: z component = cos(lat) > 0.
    expect(north[2]).toBeCloseTo(Math.cos((-89.7668 * Math.PI) / 180), 12)
  })
})

describe('T4: due north has az 0, due east az 90', () => {
  for (const [lat, lon] of [
    [-89.7668, -171.87],
    [-85.9948, -0.23578],
    [-89.46, -136.68],
    [0, 0],
    [45, 120],
  ]) {
    it(`site ${lat}, ${lon}`, () => {
      const site = siteVector(lat, lon, 0.00175)
      const enu = enuBasis(lat, lon)
      const far = (v: Vec3, k = 1) => site.map((s, i) => s + 1e6 * k * v[i]) as Vec3
      expect(azEl(far(enu.north), site, enu).az).toBeCloseTo(0, 9)
      expect(azEl(far(enu.east), site, enu).az).toBeCloseTo(90, 9)
      expect(azEl(far(enu.north, -1), site, enu).az).toBeCloseTo(180, 9)
      expect(azEl(far(enu.east, -1), site, enu).az).toBeCloseTo(270, 9)
      expect(azEl(far(enu.up), site, enu).el).toBeCloseTo(90, 6)
      expect(azEl(far(enu.north), site, enu).el).toBeCloseTo(0, 9)
    })
  }

  it('Earth parallax: a surface observer is not the Moon centre (up to 0.26 deg)', () => {
    const lat = -89.7668
    const lon = -171.87
    const enu = enuBasis(lat, lon)
    const earth: Vec3 = [384400, 0, 0]
    const topo = azEl(earth, siteVector(lat, lon, 0), enu).el
    const centre = azEl(earth, [0, 0, 0], enu).el
    expect(Math.abs(topo - centre)).toBeGreaterThan(0.2)
    expect(Math.abs(topo - centre)).toBeLessThan(0.27)
  })
})

describe('maskAt and discFraction', () => {
  it('flat horizon = curvature dip for a 1.75 m eye', () => {
    expect(maskAt(null, 123)).toBe(FLAT_DIP_DEG)
    expect(FLAT_DIP_DEG).toBeCloseTo(-0.0813, 4)
  })

  it('interpolates between 0.5 deg samples and wraps at 360', () => {
    const mask = Array.from({ length: 720 }, (_, i) => i / 100)
    const h = { az_step: 0.5, mask } as unknown as Horizon
    expect(maskAt(h, 0)).toBe(0)
    expect(maskAt(h, 0.25)).toBeCloseTo(0.005, 12)
    expect(maskAt(h, 10)).toBeCloseTo(0.2, 12)
    expect(maskAt(h, 359.75)).toBeCloseTo((7.19 + 0) / 2, 12)
    expect(maskAt(h, 360)).toBe(0)
    expect(maskAt(h, -0.5)).toBeCloseTo(7.19, 12)
  })

  it('disc fraction: full, none, half, symmetric, monotonic', () => {
    const r = 0.27
    expect(discFraction(1 + r, 1, r)).toBe(1)
    expect(discFraction(1 - r, 1, r)).toBe(0)
    expect(discFraction(1, 1, r)).toBeCloseTo(0.5, 12)
    for (const h of [0.1, 0.4, 0.8]) {
      expect(discFraction(1 + h * r, 1, r) + discFraction(1 - h * r, 1, r)).toBeCloseTo(1, 12)
    }
    let prev = -1
    for (let e = -0.5; e <= 0.5; e += 0.01) {
      const f = discFraction(e, 0, r)
      expect(f).toBeGreaterThanOrEqual(prev)
      prev = f
    }
  })
})

describe('interpolate', () => {
  it('is exact at samples, spans month boundaries, and rejects times outside the months', async () => {
    const months: EphemMonth[] = await loadMonths(['2027-07', '2027-08'])
    const [jul, aug] = months
    const boundary = Date.parse('2027-08-01T00:00:00Z')
    const a = interpolate([jul], boundary)
    const b = interpolate([aug], boundary)
    expect(a.sun_km).toEqual(jul.sun_km[jul.n - 1])
    for (let i = 0; i < 3; i++) expect(a.earth_km[i]).toBeCloseTo(b.earth_km[i], 9)
    const mid = interpolate(months, boundary + 15 * 60_000)
    expect(mid.utcMs).toBe(boundary + 15 * 60_000)
    expect(() => interpolate(months, Date.parse('2027-06-30T23:00:00Z'))).toThrow(RangeError)
    expect(() => interpolate(months, Date.parse('2027-09-01T00:30:00Z'))).toThrow(RangeError)
  })

  it('covers the last half hour of the supported range (2030-12-31T23:59Z)', async () => {
    const [dec] = await loadMonths(['2030-12'])
    expect(() => interpolate([dec], Date.parse('2030-12-31T23:59:00Z'))).not.toThrow()
    expect(() => interpolate([dec], Date.parse('2031-01-01T00:00:00Z'))).not.toThrow()
    expect(() => interpolate([dec], Date.parse('2031-01-01T00:30:00Z'))).toThrow(RangeError)
  })
})
