// The ephemeris adapter gives geometric positions: the Moon's tabulated motion is then the motion gravity gives
// it, which shows as agreement between one free flight integrated Earth-centred and Moon-centred.
import { describe, expect, it } from 'vitest'
import aug2027 from '../../public/data/ephem/2027-08.json?raw'
import sep2027 from '../../public/data/ephem/2027-09.json?raw'
import type { EphemMonth } from '../data/types'
import { interpolate } from '../geometry'
import { makeFlightEphemeris } from './ephemeris'
import { earthField, integrate, moonField } from './sim'
import type { Vec3 } from './types'
import { add, norm, qrot, scale, sub } from './vec'

const months = [aug2027, sep2027].map((m) => JSON.parse(m) as EphemMonth)
const ephem = makeFlightEphemeris(months)

describe('geometric positions from the apparent ephemeris', () => {
  it('the correction is a few tens of kilometres, almost all of it in range', () => {
    let maxShift = 0
    let maxSide = 0
    for (let d = 2; d < 30; d += 1.7) {
      const t = Date.UTC(2027, 7, 1) + d * 86400_000
      const s = interpolate(months, t)
      const apparentMoon = scale(qrot(s.q_me_to_j2000, s.earth_km), -1)
      const diff = sub(ephem.moonPos(t), apparentMoon)
      const u = scale(apparentMoon, 1 / norm(apparentMoon))
      const along = diff[0] * u[0] + diff[1] * u[1] + diff[2] * u[2]
      maxShift = Math.max(maxShift, norm(diff))
      maxSide = Math.max(maxSide, norm(sub(diff, scale(u, along))))
    }
    expect(maxShift).toBeGreaterThan(20)
    expect(maxShift).toBeLessThan(45)
    expect(maxSide).toBeLessThan(2.5)
  })

  it('a four-day free flight ends in the same place whether it is integrated Earth-centred or Moon-centred', () => {
    const t0 = Date.UTC(2027, 7, 10)
    const days = 4.45
    const earth = earthField(ephem, t0 - 3600_000, t0 + (days + 1) * 86400_000)
    const moon = moonField(ephem, t0 - 3600_000, t0 + (days + 1) * 86400_000)
    // somewhere between the two bodies, moving slowly: 150,000 km from Earth toward the Moon
    const m0 = earth.moonState(t0)
    const r0: Vec3 = scale(m0.r, 150000 / norm(m0.r))
    const v0: Vec3 = scale(m0.v, 0.4)
    const a = integrate(earth, { r: r0, v: v0, m: 1 }, t0, { maxSeconds: days * 86400 })
    const b = integrate(moon, { r: sub(r0, m0.r), v: sub(v0, m0.v), m: 1 }, t0, { maxSeconds: days * 86400 })
    const m1 = earth.moonState(t0 + days * 86400_000)
    const gap = norm(sub(a.end.r, add(b.end.r, m1.r)))
    console.log(`[ephemeris] Earth-centred vs Moon-centred after ${days} days: ${gap.toFixed(2)} km apart`)
    // Measured: 5.4 km with the correction, 73 km with the apparent positions. What remains is second order in
    // v/c and the Sun's direction left apparent.
    expect(gap).toBeLessThan(10)
  })
})
