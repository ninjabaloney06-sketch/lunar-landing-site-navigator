// Monte Carlo dispersion of the descent (dispersion.ts) and the open-loop replay it flies (lunar.ts,
// replayDescent). NOT YET VALIDATED BY THE SCIENCE LEAD: these tests check the machinery (exact reproduction,
// seeded statistics, convergence), not that the σ values are right; those are assumptions.
import { describe, expect, it } from 'vitest'
import { MU_MOON, R_MOON } from './astro'
import { DEFAULT_SIGMAS, NOT_VALIDATED, ZERO_SIGMAS, gaussian, landingSentence, runDispersion } from './dispersion'
import type { DispersionInput } from './dispersion'
import { NO_PERTURBATION, planDescent, replayDescent } from './lunar'
import type { DescentInput, OrbitState } from './lunar'
import { moonField } from './sim'
import { SPACECRAFT } from './spacecraft'
import { circularEphemeris } from './testEphem'
import type { Vec3 } from './types'
import { cross, latLonUnit, qrot, scale, unit } from './vec'

const HOUR_MS = 3600_000
const DAY_MS = 24 * HOUR_MS

// The scenario of lunar.test.ts "polar orbit, site at −89.5°": Apollo LM, 100 km polar orbit, Earth and Sun in
// the field, the Moon turning under the orbit (test ephemeris).
const ephem = circularEphemeris()
const t0 = Date.UTC(2026, 10, 20)
const lm = SPACECRAFT.find((s) => s.id === 'apollo-lm')!
const massKg = lm.modules.reduce((s, m) => s + m.dryKg + m.propellantKg, 0)
const siteUnit = latLonUnit(-89.5, 45)
const site = (utcMs: number): Vec3 => scale(qrot(ephem.moonFixedToInertial(utcMs), siteUnit), R_MOON)
const pole = qrot(ephem.moonFixedToInertial(t0), [0, 0, 1])
const inEquator = unit(cross(pole, cross(site(t0), pole)))
const rOrbit = R_MOON + 100
const orbit: OrbitState = { utcMs: t0, r: scale(inEquator, rOrbit), v: scale(pole, -Math.sqrt(MU_MOON / rOrbit)) }
const descentInput: DescentInput = { field: moonField(ephem, t0 - HOUR_MS, t0 + DAY_MS), orbit, earliestMs: t0 + 0.5 * HOUR_MS, site, lander: lm, massKg, pdiAltKm: 15 }
const descent = planDescent(descentInput)
const inp: DispersionInput = { descentInput, descent, ephem }

describe('replayDescent', () => {
  it('without errors repeats the planned descent to the last bit', () => {
    const r = replayDescent(descentInput, descent.controls, NO_PERTURBATION)
    expect(r.touchdownMs).toBe(descent.touchdownMs)
    expect(r.massAtTouchdownKg).toBe(descent.massAtTouchdownKg)
    const last = descent.path.r[descent.path.r.length - 1]
    expect(r.touchdown.r[0]).toBe(last[0])
    expect(r.touchdown.r[1]).toBe(last[1])
    expect(r.touchdown.r[2]).toBe(last[2])
    expect(r.brakingCutShort).toBe(false)
    expect(r.path.t[0]).toBe(descent.path.t[0])
  })

  it('a 1 % stronger engine, flown open loop, still comes down, somewhere else, with another propellant use', () => {
    const r = replayDescent(descentInput, descent.controls, { ...NO_PERTURBATION, thrustScale: 1.01 })
    expect(r.brakingCutShort).toBe(true) // a stronger engine brakes sooner: down at the gate height before the commanded end
    expect(r.touchdownSpeedMs).toBeLessThan(10)
    expect(Math.abs(r.usedKg - (massKg - descent.massAtTouchdownKg))).toBeGreaterThan(1)
  })
})

describe('gaussian', () => {
  it('is seeded (the same seed gives the same numbers) and standard normal', () => {
    const a = gaussian(42)
    const b = gaussian(42)
    const xs = Array.from({ length: 20000 }, () => a())
    expect(Array.from({ length: 5 }, () => b())).toEqual(xs.slice(0, 5))
    const m = xs.reduce((s, x) => s + x, 0) / xs.length
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
    expect(Math.abs(m)).toBeLessThan(0.03)
    expect(Math.abs(sd - 1)).toBeLessThan(0.02)
    expect(xs.filter((x) => Math.abs(x) > 3).length / xs.length).toBeLessThan(0.005)
  })
})

describe('runDispersion', () => {
  it('zero σ without J2 reproduces the planned descent exactly in every run', () => {
    const r = runDispersion(inp, { n: 5, sigmas: ZERO_SIGMAS, j2: false })
    const nominalKg = massKg - descent.massAtTouchdownKg
    expect(r.flown).toBe(5)
    expect(r.propellant.nominalKg).toBe(nominalKg)
    for (const run of r.runs) {
      expect(run.usedKg).toBe(nominalKg)
      expect(run.eastKm).toBe(r.runs[0].eastKm)
      expect(run.northKm).toBe(r.runs[0].northKm)
    }
    // the planned descent lands within 10 m of the site (lunar.test.ts): so do these
    expect(Math.hypot(r.runs[0].eastKm, r.runs[0].northKm)).toBeLessThan(0.01)
    expect(r.propellant.sigmaKg).toBe(0)
    // zero to round-off: the runs are identical, their mean is no longer exact since thirdBody uses x*sqrt(x) (1.4e-26 km)
    expect(r.landing.sigmaMajorKm).toBeLessThan(1e-12)
    expect(r.tube.every((p) => p.sigmaMajorKm === 0 && p.sigmaMinorKm === 0)).toBe(true)
    expect(r.j2Only).toBeNull()
  })

  it('N = 200 with the default σ and J2: seeded statistics, every output marked not validated', { timeout: 120_000 }, () => {
    const start = performance.now()
    const r = runDispersion(inp, { n: 200, seed: 1 })
    const ms = performance.now() - start
    const again = runDispersion(inp, { n: 200, seed: 1 })
    console.log(
      [
        `Dispersion N = 200 (Apollo LM, polar orbit, site −89.5°): ${(ms / 1000).toFixed(2)} s on this machine`,
        `  ${landingSentence(r)}`,
        `  1σ ellipse ${r.landing.sigmaMajorKm.toFixed(3)} × ${r.landing.sigmaMinorKm.toFixed(3)} km at ${r.landing.majorAzimuthDeg.toFixed(1)}°, mean offset ${r.landing.meanEastKm.toFixed(3)} E ${r.landing.meanNorthKm.toFixed(3)} N km, 99.7 % within ${r.landing.radius997Km.toFixed(2)} km, max ${r.landing.maxKm.toFixed(2)} km`,
        `  propellant nominal ${r.propellant.nominalKg.toFixed(1)} kg, mean ${r.propellant.meanKg.toFixed(1)}, σ ${r.propellant.sigmaKg.toFixed(1)}, range ${r.propellant.minKg.toFixed(1)}–${r.propellant.maxKg.toFixed(1)} kg`,
        `  touchdown speed mean ${r.touchdown.meanSpeedMs.toFixed(2)} m/s, max ${r.touchdown.maxSpeedMs.toFixed(2)}, hard ${r.touchdown.hard}; braking cut short ${r.brakingCutShort}; flown ${r.flown}/${r.n}`,
        `  J2 alone (open loop): ${r.j2Only!.eastKm.toFixed(4)} km E, ${r.j2Only!.northKm.toFixed(4)} km N, propellant ${(r.j2Only!.usedKg - r.propellant.nominalKg).toFixed(2)} kg`,
        `  tube max 1σ across the path ${Math.max(...r.tube.map((p) => p.sigmaMajorKm)).toFixed(3)} km; at touchdown ${r.tube[r.tube.length - 1].sigmaMajorKm.toFixed(3)} km`,
        `  JSON ${JSON.stringify({ maj: r.landing.sigmaMajorKm, min: r.landing.sigmaMinorKm, az: r.landing.majorAzimuthDeg, m: r.propellant.meanKg, s: r.propellant.sigmaKg })}`,
      ].join('\n'),
    )
    expect(r.validated).toBe(false)
    expect(r.marker).toBe(NOT_VALIDATED)
    expect(r.method).toContain(NOT_VALIDATED)
    expect(landingSentence(r)).toContain('Not yet validated by the science lead')
    expect(r.sigmas).toEqual(DEFAULT_SIGMAS)
    expect(r.flown).toBe(200)
    expect(r.tube.length).toBe(64)
    // seed 1 fixes the statistics (Node 24 on the build laptop). Re-recorded on 15 Nov 2026 after thirdBody changed to
    // x*sqrt(x) (team decision): sigmaMinor moved by 0.65 µm, the azimuth by 6.5e-8°, mean propellant by 0.018 g, its σ
    // by 0.047 g; before: 0.7295818738462894, 0.2962744953239841, 177.65761915101533, 6949.2331744809235, 42.20281998660058
    expect(r.landing.sigmaMajorKm).toBeCloseTo(0.7295818738141273, 9)
    expect(r.landing.sigmaMinorKm).toBeCloseTo(0.29627449466998346, 9)
    expect(r.landing.majorAzimuthDeg).toBeCloseTo(177.6576192163001, 7)
    expect(r.propellant.meanKg).toBeCloseTo(6949.233192646087, 6)
    expect(r.propellant.sigmaKg).toBeCloseTo(42.20286725523752, 7)
    // J2 alone, flown open loop, moves this descent's touchdown by about 4.7 km and costs about 157 kg more
    expect(Math.hypot(r.j2Only!.eastKm, r.j2Only!.northKm)).toBeGreaterThan(4)
    expect(Math.hypot(r.j2Only!.eastKm, r.j2Only!.northKm)).toBeLessThan(5.5)
    // the same seed gives the same statistics, number for number
    expect(again.landing).toEqual(r.landing)
    expect(again.propellant).toEqual(r.propellant)
    expect(again.tube).toEqual(r.tube)
    // the tube starts at DOI ignition with no spread and ends at the touchdown; it never narrows to nothing between
    expect(r.tube[0].sigmaMajorKm).toBe(0)
    expect(r.tube[r.tube.length - 1].utcMs).toBe(descent.touchdownMs)
    expect(Math.max(...r.tube.map((p) => p.sigmaMajorKm))).toBeGreaterThan(0)
    expect(r.landing.sigmaMajorKm).toBeGreaterThanOrEqual(r.landing.sigmaMinorKm)
    expect(r.propellant.sigmaKg).toBeGreaterThan(0)
    expect(r.propellant.minKg).toBeLessThanOrEqual(r.propellant.meanKg)
    expect(r.propellant.maxKg).toBeGreaterThanOrEqual(r.propellant.meanKg)
  })

  it('the sample statistics converge: N = 50 and N = 200 agree within their sampling error', { timeout: 120_000 }, () => {
    const a = runDispersion(inp, { n: 50, seed: 7 })
    const b = runDispersion(inp, { n: 200, seed: 7 })
    // standard error of a σ estimate is about σ / √(2N): with N = 50, 10 %; allow three of those
    expect(Math.abs(a.landing.sigmaMajorKm / b.landing.sigmaMajorKm - 1)).toBeLessThan(0.3)
    expect(Math.abs(a.propellant.sigmaKg / b.propellant.sigmaKg - 1)).toBeLessThan(0.3)
    // the mean propellant agrees within three standard errors of the N = 50 mean
    expect(Math.abs(a.propellant.meanKg - b.propellant.meanKg)).toBeLessThan((3 * b.propellant.sigmaKg) / Math.sqrt(50))
  })
})
