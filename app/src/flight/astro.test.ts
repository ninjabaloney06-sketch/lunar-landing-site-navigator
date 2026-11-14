import { describe, it, expect } from 'vitest'
import {
  MU_EARTH,
  MU_MOON,
  R_EARTH_EQ,
  R_MOON,
  G0,
  DAY_S,
  circularSpeed,
  visViva,
  ellipse,
  trueAnomalyAtRadius,
  timeFromPeriapsis,
  perifocal,
  hyperbola,
  hyperbolicTimeFromPeriapsis,
  rocketPropellant,
  bisect,
  goldenMin,
} from './astro'

describe('astro', () => {
  it('Hohmann from 185 km parking orbit to lunar distance: TLI delta-v and half period', () => {
    const rp = R_EARTH_EQ + 185
    const ra = 384400
    const el = ellipse(rp, ra)
    const vc = circularSpeed(MU_EARTH, rp)
    const dv = visViva(MU_EARTH, rp, el.a) - vc
    expect(Math.abs(dv - 3.135)).toBeLessThan(0.005)
    const halfDays = timeFromPeriapsis(MU_EARTH, el, Math.PI) / DAY_S
    expect(Math.abs(halfDays - 4.978)).toBeLessThan(0.01)
  })

  it('circular speed at 100 km above the Moon', () => {
    expect(Math.abs(circularSpeed(MU_MOON, R_MOON + 100) - 1.6335)).toBeLessThan(0.001)
  })

  it('time from periapsis at apoapsis is half the period; hyperbolic time is 0 at periapsis and grows with |nu|', () => {
    const el = ellipse(6563, 384400)
    const half = Math.PI * Math.sqrt(el.a ** 3 / MU_EARTH)
    expect(timeFromPeriapsis(MU_EARTH, el, Math.PI)).toBeCloseTo(half, 3)
    const hy = hyperbola(MU_MOON, 1, 1837.4)
    expect(hyperbolicTimeFromPeriapsis(MU_MOON, hy, 0)).toBeCloseTo(0, 9)
    const t1 = hyperbolicTimeFromPeriapsis(MU_MOON, hy, 0.5)
    const t2 = hyperbolicTimeFromPeriapsis(MU_MOON, hy, 1.0)
    expect(t1).toBeGreaterThan(0)
    expect(t2).toBeGreaterThan(t1)
    expect(hyperbolicTimeFromPeriapsis(MU_MOON, hy, -1.0)).toBeCloseTo(t2, 6)
  })

  it('rocket equation: doubling mass ratio gives propellant equal to the payload', () => {
    const dv = (G0 * 300 * Math.log(2)) / 1000
    expect(rocketPropellant(1000, dv, 300)).toBeCloseTo(1000, 6)
  })

  it('perifocal state at periapsis matches radius and vis-viva speed; r·v is zero at nu = 0 and π', () => {
    const el = ellipse(6563, 384400)
    const P: [number, number, number] = [1, 0, 0]
    const Q: [number, number, number] = [0, 1, 0]
    const s0 = perifocal(el, MU_EARTH, 0, P, Q)
    const rMag = Math.hypot(...s0.r)
    const vMag = Math.hypot(...s0.v)
    expect(rMag).toBeCloseTo(6563, 6)
    expect(vMag).toBeCloseTo(visViva(MU_EARTH, 6563, el.a), 9)
    expect(s0.r[0] * s0.v[0] + s0.r[1] * s0.v[1] + s0.r[2] * s0.v[2]).toBeCloseTo(0, 9)
    const s1 = perifocal(el, MU_EARTH, Math.PI, P, Q)
    expect(s1.r[0] * s1.v[0] + s1.r[1] * s1.v[1] + s1.r[2] * s1.v[2]).toBeCloseTo(0, 6)
  })

  it('trueAnomalyAtRadius recovers the anomaly used to compute the radius', () => {
    const el = ellipse(6563, 384400)
    const nu = 2.5
    const r = el.p / (1 + el.e * Math.cos(nu))
    expect(trueAnomalyAtRadius(el, r)).toBeCloseTo(nu, 9)
  })

  it('bisect and goldenMin find a root and an argmin', () => {
    expect(bisect((x) => x * x - 2, 0, 2)).toBeCloseTo(Math.SQRT2, 9)
    expect(goldenMin((x) => (x - 1.3) ** 2, 0, 3, 1e-9)).toBeCloseTo(1.3, 6)
  })
})
