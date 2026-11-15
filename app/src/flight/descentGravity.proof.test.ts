// Proof P1 (a): the descent as flown by lunar.ts feels the Moon's gravity as μ/r², evaluated at the altitude
// where the lander is, not one fixed g. sim.test.ts checks the integrator against a radial fall in a point-mass
// field; this file goes one level up: it records every evaluation of the Moon-centred field (moonField: the
// Moon plus Earth and Sun as third bodies) that planDescent makes for a full Apollo LM descent from a 100 km
// polar orbit, and checks the recorded pull against μ/r² over the whole altitude range. A second descent in a
// field of one constant g shows that the result depends on that variation.
import { describe, expect, it } from 'vitest'
import { MU_MOON, R_MOON } from './astro'
import { planDescent } from './lunar'
import type { OrbitState } from './lunar'
import { moonField } from './sim'
import type { Field } from './sim'
import { SPACECRAFT } from './spacecraft'
import { circularEphemeris } from './testEphem'
import type { Vec3 } from './types'
import { cross, latLonUnit, norm, qrot, scale, unit } from './vec'

const HOUR_MS = 3600_000
const DAY_MS = 24 * HOUR_MS
// ABTN (NASA SP-2000-4029): "LM at Separation for Lunar Landing | 33,683.5" lb
// https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_18-37_Selected_Mission_Weights.htm
const SEPARATION_KG = 33683.5 * 0.45359237
const lm = SPACECRAFT.find((s) => s.id === 'apollo-lm')!

const ephem = circularEphemeris()
const t0 = Date.UTC(2026, 10, 20)
const siteUnit = latLonUnit(-89.5, 45)
const site = (utcMs: number): Vec3 => scale(qrot(ephem.moonFixedToInertial(utcMs), siteUnit), R_MOON)
const pole = qrot(ephem.moonFixedToInertial(t0), [0, 0, 1])
const inEquator = unit(cross(pole, cross(site(t0), pole)))
const rOrbit = R_MOON + 100
const orbit: OrbitState = { utcMs: t0, r: scale(inEquator, rOrbit), v: scale(pole, -Math.sqrt(MU_MOON / rOrbit)) }

/** The field the mission passes to planDescent, wrapped so that every evaluation is recorded. */
function recording(inner: Field) {
  const samples: { rKm: number; aKms2: number; radialKms2: number }[] = []
  const field: Field = {
    centre: inner.centre,
    accel(r, utcMs, out) {
      inner.accel(r, utcMs, out)
      const rn = norm(r)
      samples.push({ rKm: rn, aKms2: norm(out), radialKms2: -(out[0] * r[0] + out[1] * r[1] + out[2] * r[2]) / rn })
    },
  }
  return { field, samples }
}

describe('P1 (a) descent gravity follows μ/r² with altitude', () => {
  const full = moonField(ephem, t0 - HOUR_MS, t0 + 2 * DAY_MS)
  const rec = recording(full)
  const descent = planDescent({ field: rec.field, orbit, earliestMs: t0 + 0.5 * HOUR_MS, site, lander: lm, massKg: SEPARATION_KG, pdiAltKm: 15 })

  it('every field evaluation of the flown descent equals μ/r² at that radius, from orbit down to the surface', () => {
    expect(descent.missM).toBeLessThan(10)
    expect(rec.samples.length).toBeGreaterThan(1000)
    // altitude range of the descent as flown (DOI ignition to touchdown)
    const flown = descent.path.r.map(norm)
    const top = Math.max(...flown)
    const bottom = Math.min(...flown)
    expect(top - R_MOON).toBeGreaterThan(99)
    expect(bottom - R_MOON).toBeLessThan(0.001)
    // Earth and Sun as third bodies add a tidal pull of about 1e-5 of the Moon's: the rest must be μ/r²
    let worst = 0
    let nearTop = 0
    let nearBottom = 0
    for (const s of rec.samples) {
      const expected = MU_MOON / (s.rKm * s.rKm)
      worst = Math.max(worst, Math.abs(s.aKms2 - expected) / expected)
      if (s.rKm > top - 1) nearTop++
      if (s.rKm < bottom + 0.1) nearBottom++
    }
    expect(worst).toBeLessThan(1e-4)
    // the field was evaluated at both ends of the altitude range, not at one point
    expect(nearTop).toBeGreaterThan(50)
    expect(nearBottom).toBeGreaterThan(50)
    const gTop = MU_MOON / (top * top)
    const gBottom = MU_MOON / (bottom * bottom)
    // (1737.4 / 1837.4)² = 0.894: the pull at 100 km is about 11 % weaker than at the surface
    expect(1 - gTop / gBottom).toBeGreaterThan(0.1)
    console.log(
      `[proof a] ${rec.samples.length} field evaluations; flown from ${(top - R_MOON).toFixed(1)} km to the surface; ` +
        `g ${(gTop * 1000).toFixed(4)} m/s² at the top, ${(gBottom * 1000).toFixed(4)} m/s² at touchdown (${(100 * (1 - gTop / gBottom)).toFixed(1)} % less at the top); ` +
        `largest deviation from μ/r² ${worst.toExponential(2)} (Earth and Sun tides)`,
    )
  })

  it('the same descent in one constant g (the value at orbit altitude) needs a measurably different burn', () => {
    const gOrbit = MU_MOON / (rOrbit * rOrbit) // the orbit's own g, so the starting orbit stays circular
    const constant: Field = {
      centre: 'moon',
      accel(r, utcMs, out) {
        full.accel(r, utcMs, out) // keeps the third bodies, replaces only the Moon's own term by a constant g
        const rn = norm(r)
        const f = -gOrbit / rn + MU_MOON / (rn * rn * rn)
        out[0] += f * r[0]
        out[1] += f * r[1]
        out[2] += f * r[2]
      },
    }
    const flat = planDescent({ field: constant, orbit, earliestMs: t0 + 0.5 * HOUR_MS, site, lander: lm, massKg: SEPARATION_KG, pdiAltKm: 15 })
    const dPoweredMs = (flat.dvKms.powered - descent.dvKms.powered) * 1000
    const dPropKg = descent.propellantLeftKg - flat.propellantLeftKg
    console.log(
      `[proof a] constant g instead of μ/r²: powered descent ${(descent.dvKms.powered * 1000).toFixed(1)} → ${(flat.dvKms.powered * 1000).toFixed(1)} m/s ` +
        `(${dPoweredMs.toFixed(1)} m/s), ${dPropKg.toFixed(0)} kg more propellant`,
    )
    // 1806.2 vs 1871.1 m/s when this was written: the descent as flown depends on gravity varying with altitude
    expect(Math.abs(dPoweredMs)).toBeGreaterThan(30)
  })
})
