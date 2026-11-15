// The Moon's J2 term (sim.ts, MoonFieldOptions.j2): off by default, so every validated plan is unchanged; on,
// it gives the textbook acceleration and the textbook nodal precession of a low lunar orbit, and this file
// measures what it does to one descent. NOT YET VALIDATED BY THE SCIENCE LEAD.
import { describe, expect, it } from 'vitest'
import { MU_MOON, R_MOON } from './astro'
import { planDescent } from './lunar'
import type { OrbitState } from './lunar'
import { J2_MOON, J2_MOON_REF_RADIUS_KM, addJ2, integrate, moonField, moonPole } from './sim'
import type { Field } from './sim'
import { SPACECRAFT } from './spacecraft'
import { circularEphemeris } from './testEphem'
import type { Vec3 } from './types'
import { cross, dot, latLonUnit, norm, qrot, scale, sub, unit } from './vec'

const HOUR_MS = 3600_000
const DAY_MS = 24 * HOUR_MS

describe('Moon J2 in the Moon-centred field', () => {
  const ephem = circularEphemeris()
  const t0 = Date.UTC(2026, 10, 20)
  const plain = moonField(ephem, t0 - HOUR_MS, t0 + 2 * DAY_MS)
  const withJ2 = moonField(ephem, t0 - HOUR_MS, t0 + 2 * DAY_MS, { j2: true })
  const pole = moonPole(ephem, t0 + 0.5 * (2 * DAY_MS - HOUR_MS))
  const at = (f: Field, r: Vec3, utcMs: number): Vec3 => {
    const out: Vec3 = [0, 0, 0]
    f.accel(r, utcMs, out)
    return out
  }

  it('is off unless asked for: the default field is the one with j2 false, value for value', () => {
    const off = moonField(ephem, t0 - HOUR_MS, t0 + 2 * DAY_MS, { j2: false })
    for (const r of [[1837.4, 0, 0], [0, 1800, 300], [-900, 400, -1600]] as Vec3[]) {
      const a = at(plain, r, t0 + 3 * HOUR_MS)
      const b = at(off, r, t0 + 3 * HOUR_MS)
      expect(a[0]).toBe(b[0])
      expect(a[1]).toBe(b[1])
      expect(a[2]).toBe(b[2])
    }
  })

  it('adds 3/2 J2 μ R²/r⁴ of pull over the equator and takes 3 J2 μ R²/r⁴ away over the pole', () => {
    const r = R_MOON + 100
    const k = (J2_MOON * MU_MOON * J2_MOON_REF_RADIUS_KM ** 2) / r ** 4
    const eq = scale(unit(cross(pole, [1, 0, 0])), r)
    const dEq = sub(at(withJ2, eq, t0), at(plain, eq, t0))
    expect(dot(dEq, unit(eq)) / (-1.5 * k)).toBeCloseTo(1, 9)
    expect(norm(sub(dEq, scale(unit(eq), dot(dEq, unit(eq))))) / k).toBeLessThan(1e-9)
    const np = scale(pole, r)
    const dP = sub(at(withJ2, np, t0), at(plain, np, t0))
    expect(dot(dP, pole) / (3 * k)).toBeCloseTo(1, 9)
    // about 1/2600 of the central pull at 100 km: small, but it turns an orbit's plane by a degree a day
    console.log(`Moon J2 at 100 km over the equator: ${(1.5 * k * 1e6).toFixed(3)} mm/s² against ${((MU_MOON / r ** 2) * 1e6).toFixed(0)} mm/s² central`)
  })

  it('turns the node of a 100 km, 45° orbit at the rate −3/2 n J2 (R/a)² cos i', () => {
    const field: Field = {
      centre: 'moon',
      accel(r, _t, out) {
        const r2 = dot(r, r)
        const kk = -MU_MOON / (r2 * Math.sqrt(r2))
        out[0] = kk * r[0]
        out[1] = kk * r[1]
        out[2] = kk * r[2]
        addJ2(J2_MOON, MU_MOON, J2_MOON_REF_RADIUS_KM, [0, 0, 1], r, out)
      },
    }
    const a = R_MOON + 100
    const inc = Math.PI / 4
    const v = Math.sqrt(MU_MOON / a)
    const run = integrate(field, { r: [a, 0, 0], v: [0, v * Math.cos(inc), v * Math.sin(inc)], m: 1 }, 0, { maxSeconds: 2 * 86400, maxStepS: 60 })
    const node = (r: Vec3, vv: Vec3) => {
      const h = cross(r, vv)
      return Math.atan2(h[0], -h[1])
    }
    const n = Math.sqrt(MU_MOON / a ** 3)
    const expected = -1.5 * n * J2_MOON * (J2_MOON_REF_RADIUS_KM / a) ** 2 * Math.cos(inc) * 2 * 86400
    const got = node(run.end.r, run.end.v) - node([a, 0, 0], [0, v * Math.cos(inc), v * Math.sin(inc)])
    console.log(`Moon J2 nodal precession, 100 km at 45°: ${((got * 180) / Math.PI / 2).toFixed(3)}°/day, first-order theory ${((expected * 180) / Math.PI / 2).toFixed(3)}°/day`)
    // first-order theory with osculating start elements: agreement to a few per cent
    expect(got / expected).toBeGreaterThan(0.95)
    expect(got / expected).toBeLessThan(1.05)
  })
})

describe('what J2 alone does to one descent (polar orbit, site at −89.5°, Apollo LM)', () => {
  it('re-planned with J2 the descent still lands; its propellant changes by the amount logged', { timeout: 120_000 }, () => {
    const ephem = circularEphemeris()
    const t0 = Date.UTC(2026, 10, 20)
    const lm = SPACECRAFT.find((s) => s.id === 'apollo-lm')!
    const massKg = lm.modules.reduce((s, m) => s + m.dryKg + m.propellantKg, 0)
    const siteUnit = latLonUnit(-89.5, 45)
    const site = (utcMs: number): Vec3 => scale(qrot(ephem.moonFixedToInertial(utcMs), siteUnit), R_MOON)
    const pole = qrot(ephem.moonFixedToInertial(t0), [0, 0, 1])
    const inEquator = unit(cross(pole, cross(site(t0), pole)))
    const r = R_MOON + 100
    const orbit: OrbitState = { utcMs: t0, r: scale(inEquator, r), v: scale(pole, -Math.sqrt(MU_MOON / r)) }
    const input = { orbit, earliestMs: t0 + 0.5 * HOUR_MS, site, lander: lm, massKg, pdiAltKm: 15 }
    const nominal = planDescent({ ...input, field: moonField(ephem, t0 - HOUR_MS, t0 + DAY_MS) })
    const j2 = planDescent({ ...input, field: moonField(ephem, t0 - HOUR_MS, t0 + DAY_MS, { j2: true }) })
    expect(j2.missM).toBeLessThan(10)
    const usedNominal = massKg - nominal.massAtTouchdownKg
    const usedJ2 = massKg - j2.massAtTouchdownKg
    console.log(
      `J2 alone, re-planned descent (closed loop): propellant ${usedNominal.toFixed(1)} → ${usedJ2.toFixed(1)} kg (${(usedJ2 - usedNominal).toFixed(1)} kg), ` +
        `touchdown ${((j2.touchdownMs - nominal.touchdownMs) / 1000).toFixed(1)} s later`,
    )
    // J2 is a 1/2600 effect on gravity near the surface: the descent's propellant moves by less than 1 %
    expect(Math.abs(usedJ2 - usedNominal) / usedNominal).toBeLessThan(0.01)
  })
})
