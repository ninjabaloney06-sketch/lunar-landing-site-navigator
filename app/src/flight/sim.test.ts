// The powered-flight integrator against closed-form results.
import { describe, expect, it } from 'vitest'
import { G0, MU_EARTH, MU_MOON, R_EARTH_EQ, circularSpeed } from './astro'
import { J2_EARTH, constantThrust, integrate, pointMass } from './sim'
import type { Field } from './sim'
import type { Vec3 } from './types'
import { cross, dot, norm, unit } from './vec'

describe('integrate', () => {
  it('keeps a circular orbit circular and closes it after one period', () => {
    const r = R_EARTH_EQ + 185
    const v = circularSpeed(MU_EARTH, r)
    const period = (2 * Math.PI * r) / v
    const run = integrate(pointMass(MU_EARTH, 'earth'), { r: [r, 0, 0], v: [0, v, 0], m: 1000 }, 0, { maxSeconds: period, maxStepS: 60 })
    expect(norm(run.end.r) - r).toBeCloseTo(0, 5)
    expect(Math.hypot(run.end.r[0] - r, run.end.r[1], run.end.r[2])).toBeLessThan(1e-3)
    expect(run.end.m).toBe(1000)
  })

  it('thrust in free space gives the rocket-equation delta-v and burns the right propellant', () => {
    const none: Field = { centre: 'earth', accel: (_r, _t, out) => out.fill(0) }
    const isp = 316
    const thrust = 26700
    const burn = 600
    const run = integrate(none, { r: [0, 0, 0], v: [0, 0, 0], m: 26000 }, 0, {
      maxSeconds: burn,
      engine: constantThrust(thrust, isp, () => [1, 0, 0]),
    })
    const m1 = 26000 - (thrust / (G0 * isp)) * burn
    expect(run.end.m).toBeCloseTo(m1, 4)
    expect(run.end.v[0]).toBeCloseTo((G0 * isp * Math.log(26000 / m1)) / 1000, 8)
  })

  it('stops exactly at an event', () => {
    // radial fall toward the Moon from rest: stop at 100 km altitude
    const stopR = 1837.4
    const run = integrate(pointMass(MU_MOON, 'moon'), { r: [5000, 0, 0], v: [0, 0, 0], m: 1 }, 0, {
      maxSeconds: 1e5,
      stop: (_t, s) => stopR - norm(s.r),
    })
    expect(run.stopped).toBe(true)
    expect(norm(run.end.r)).toBeCloseTo(stopR, 5)
    // energy: v² = 2 μ (1/r − 1/r0)
    expect(norm(run.end.v)).toBeCloseTo(Math.sqrt(2 * MU_MOON * (1 / stopR - 1 / 5000)), 7)
  })

  it('J2 turns the orbit plane at the textbook rate', () => {
    // nodal regression of a circular orbit: dΩ/dt = −(3/2) J2 n (R/r)² cos i
    const pole: Vec3 = [0, 0, 1]
    const j2: Field = {
      centre: 'earth',
      accel(r, _t, out) {
        const r1 = norm(r)
        const k = -MU_EARTH / r1 ** 3
        const s = dot(r, pole) / r1
        const c = (-1.5 * J2_EARTH * MU_EARTH * R_EARTH_EQ ** 2) / r1 ** 5
        for (let i = 0; i < 3; i++) out[i] = k * r[i] + c * (r[i] * (1 - 5 * s * s) + 2 * s * r1 * pole[i])
      },
    }
    const r = R_EARTH_EQ + 400
    const v = circularSpeed(MU_EARTH, r)
    const incl = (51.6 * Math.PI) / 180
    const n = v / r
    const day = 86400
    const run = integrate(j2, { r: [r, 0, 0], v: [0, v * Math.cos(incl), v * Math.sin(incl)], m: 1 }, 0, { maxSeconds: day, maxStepS: 60 })
    const h = unit(cross(run.end.r, run.end.v))
    const node = Math.atan2(h[0], -h[1]) // longitude of the ascending node
    const expected = -1.5 * J2_EARTH * n * (R_EARTH_EQ / r) ** 2 * Math.cos(incl) * day
    expect(node).toBeCloseTo(expected, 3) // about −5° per day for the ISS orbit
  })
})
