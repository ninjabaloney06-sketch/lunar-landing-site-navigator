// Descent to the lunar surface and ascent to docking, flown by lunar.ts: against Apollo 11's documented
// numbers, for a polar orbit under the full Moon-centred field, and for landers that exist only here.
//
// Apollo 11 figures and where they are stated:
//   ABTN  NASA SP-2000-4029, Apollo by the Numbers, Apollo 11 lunar orbit phase and selected mission weights
//         https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11g_Lunar_Orbit_Phase.htm
//         https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_18-37_Selected_Mission_Weights.htm
//   MR    NASA MSC-00171, Apollo 11 Mission Report
//         https://www.nasa.gov/wp-content/uploads/static/apollo50th/pdf/A11_MissionReport.pdf
//   TMX   NASA TM X-58040, Apollo Lunar Descent and Ascent Trajectories (Bennett 1970)
//         https://ntrs.nasa.gov/api/citations/19700024568/downloads/19700024568.pdf
import { describe, expect, it } from 'vitest'
import { MU_MOON, R_MOON } from './astro'
import type { SpacecraftSpec } from './hardware'
import { LunarOpsError, planAscent, planDescent } from './lunar'
import type { AscentResult, DescentResult, LunarEvent, OrbitState, Path } from './lunar'
import { moonField, pointMass } from './sim'
import { SPACECRAFT } from './spacecraft'
import { circularEphemeris } from './testEphem'
import type { Vec3 } from './types'
import { cross, dot, latLonUnit, norm, qrot, scale, sub, unit } from './vec'

const LB = 0.45359237 // kg per pound
const FPS = 0.0003048 // km/s per ft/s
const NMI = 1.852 // km per nautical mile
const HOUR_MS = 3600_000
const DAY_MS = 24 * HOUR_MS

const APOLLO_11 = {
  // ABTN weights: "LM at Separation for Lunar Landing | 33,683.5" lb; "LM Ascent Stage at Lunar Liftoff | 10,776.6" lb
  separationKg: 33683.5 * LB,
  liftoffKg: 10776.6 * LB,
  // ABTN: "LM descent orbit insertion cutoff | 101:36:44.0 | 57.8 | 5,284.9 | 30.0 | 76.4" (burn s, ft/s)
  doi: { seconds: 30.0, dvKms: 76.4 * FPS },
  // ABTN: "LM powered descent cutoff | 102:45:41.40 | | | 756.39" (s);
  // MR 9.8.1: "The duration of the powered descent firing was 756.3 seconds, corresponding to a velocity change of approximately 6775 ft/sec."
  poweredDescent: { seconds: 756.39, dvKms: 6775 * FPS },
  // TMX p. 10: the braking phase starts "approximately 260 nautical miles" from the landing site
  pdiRangeKm: 260 * NMI,
  // ABTN: "LM orbit insertion cutoff | 124:29:15.67 | 10.0 | 5,537.9 | 434.88 | 6,070.1 | 48.0 | 9.4" (burn s, ft/s, n mi)
  ascent: { seconds: 434.88, dvKms: 6070.1 * FPS },
  // TMX p. 16: "insertion into a 9- by 45-nautical-mile orbit ... is desired"
  insertionAltKm: { perilune: 9 * NMI, apolune: 45 * NMI },
  // ABTN, all with the reaction control system: CSI 51.5, CDH 19.9, TPI 25.3, two midcourse corrections 1.0 and 1.5, TPF 31.4 ft/s
  rendezvousDvKms: (51.5 + 19.9 + 25.3 + 1.0 + 1.5 + 31.4) * FPS,
  // ABTN: liftoff 124:22:00.79, "CSM/LM docked | 128:03:00.0"
  liftoffToDockingH: 128 + 3 / 60 - (124 + 22 / 60 + 0.79 / 3600),
}

const lm = SPACECRAFT.find((s) => s.id === 'apollo-lm')!
const point = pointMass(MU_MOON, 'moon')

/** The Moon turning about z once per sidereal month (the period testEphem.ts uses): a site at lat / lon. */
const MOON_RATE = (2 * Math.PI) / (27.321661 * 86400)
const spinningSite = (latDeg: number, lonDeg: number) => (utcMs: number): Vec3 => {
  const u = latLonUnit(latDeg, lonDeg + (MOON_RATE * utcMs * 180) / (1000 * Math.PI))
  return scale(u, R_MOON)
}
/** Circular orbit in the equator plane (of the spinning Moon above), flying east. */
const equatorialOrbit = (altKm: number): OrbitState => {
  const r = R_MOON + altKm
  return { utcMs: 0, r: [r, 0, 0], v: [0, Math.sqrt(MU_MOON / r), 0] }
}

/** A lander of one module that exists only in this file. */
const singleStage = (name: string, thrustN: number, ispS: number, throttleMin: number, dryKg: number, propellantKg: number): SpacecraftSpec => ({
  id: name,
  name,
  role: 'lander',
  note: 'test lander',
  sources: [],
  modules: [
    {
      id: `${name}-stage`,
      name: `${name} stage`,
      dryKg,
      propellantKg,
      engine: { name: `${name} engine`, count: 1, thrustVacN: thrustN, thrustSlN: null, ispVacS: ispS, ispSlS: null, throttleMin },
      diameterM: 4,
      lengthM: 6,
      sources: [],
    },
  ],
})

/** Requirement 6 for any flight: time strictly increasing, never below the surface, mass never increasing. */
function expectSound(path: Path, events: LunarEvent[], startMassKg: number) {
  expect(path.t.length).toBeGreaterThan(20)
  expect(path.r.length).toBe(path.t.length)
  expect(path.thrusting.length).toBe(path.t.length)
  let lowest = Infinity
  for (let i = 0; i < path.t.length; i++) {
    if (i > 0) expect(path.t[i]).toBeGreaterThan(path.t[i - 1])
    lowest = Math.min(lowest, norm(path.r[i]) - R_MOON)
  }
  expect(lowest).toBeGreaterThan(-1e-6) // 1 mm: the touchdown instant is found by bisection
  let mass = startMassKg
  let t = -Infinity
  for (const e of events) {
    expect(e.utcMs).toBeGreaterThanOrEqual(t)
    t = e.utcMs
    if (e.massAfterKg === undefined) continue
    expect(e.massAfterKg).toBeLessThanOrEqual(mass + 1e-9)
    mass = e.massAfterKg
    if (e.dvKms !== undefined) {
      expect(e.dvKms).toBeGreaterThan(0)
      expect(e.propellantKg).toBeGreaterThan(0)
      expect(e.durationS).toBeGreaterThan(0)
    }
  }
}

function expectLanded(d: DescentResult, site: (utcMs: number) => Vec3, massKg: number) {
  expect(d.missM).toBeLessThan(10)
  expect(d.touchdownSpeedMs).toBeLessThan(1)
  expect(d.massAtTouchdownKg).toBeLessThan(massKg)
  expect(d.propellantLeftKg).toBeGreaterThanOrEqual(0)
  expect(d.events.map((e) => e.label)).toEqual(['Undocking', 'Descent Orbit Insertion (DOI)', 'Powered Descent Initiation (PDI)', 'Terminal descent', 'Touchdown'])
  expect(d.path.t[d.path.t.length - 1]).toBeCloseTo(d.touchdownMs, 3)
  expectSound(d.path, d.events, massKg)
  // final approach near vertical: below 50 m the lander is within 1 m of the vertical through the site
  let low = 0
  for (let i = 0; i < d.path.t.length; i++) {
    if (d.path.t[i] < d.touchdownMs - 60_000 || norm(d.path.r[i]) - R_MOON > 0.05) continue
    const S = site(d.path.t[i])
    const rel = sub(d.path.r[i], S)
    const up = unit(S)
    expect(norm(sub(rel, scale(up, dot(rel, up)))) * 1000).toBeLessThan(1)
    low++
  }
  expect(low).toBeGreaterThan(5)
}

function expectDocked(a: AscentResult, massKg: number) {
  expect(a.relPosM).toBeLessThan(10)
  expect(a.relSpeedMs).toBeLessThan(0.1)
  expect(a.massAtDockingKg).toBeLessThan(massKg)
  expect(a.propellantLeftKg).toBeGreaterThanOrEqual(0)
  expect(a.events[0].label).toBe('Liftoff')
  expect(a.events.map((e) => e.label)).toContain('Terminal Phase Initiation (TPI)')
  expect(a.events[a.events.length - 1].label).toBe('Docking')
  expect(a.path.t[0]).toBeCloseTo(a.liftoffMs, 3)
  expect(a.path.t[a.path.t.length - 1]).toBeCloseTo(a.dockingMs, 3)
  expectSound(a.path, a.events, massKg)
}

const pct = (sim: number, doc: number) => `${sim > doc ? '+' : ''}${((100 * (sim - doc)) / doc).toFixed(1)} %`

describe('Apollo Lunar Module against Apollo 11', () => {
  // a near-equatorial site 0.7° off the orbit plane
  const site = spinningSite(0.7, 23.5)
  const orbit = equatorialOrbit(110)
  const descent = planDescent({ field: point, orbit, earliestMs: 0, site, lander: lm, massKg: APOLLO_11.separationKg, pdiAltKm: 15 })

  it('lands on the point, softly, with a descent close to the documented one', () => {
    expectLanded(descent, site, APOLLO_11.separationKg)
    const doi = descent.events.find((e) => e.id === 'doi')!
    const pdi = descent.events.find((e) => e.id === 'pdi')!
    const pdiIndex = descent.path.t.findIndex((t) => t >= pdi.utcMs)
    const pdiRangeKm = Math.acos(dot(unit(descent.path.r[pdiIndex]), unit(site(pdi.utcMs)))) * R_MOON
    console.log(
      [
        'Apollo LM descent, simulated against Apollo 11 (ABTN, MR):',
        `  DOI             ${(doi.dvKms! * 1000).toFixed(1)} m/s in ${doi.durationS!.toFixed(1)} s   Apollo 11: ${(APOLLO_11.doi.dvKms * 1000).toFixed(1)} m/s in ${APOLLO_11.doi.seconds} s (${pct(doi.dvKms!, APOLLO_11.doi.dvKms)})`,
        `  powered descent ${(pdi.dvKms! * 1000).toFixed(0)} m/s in ${pdi.durationS!.toFixed(1)} s   Apollo 11: ${(APOLLO_11.poweredDescent.dvKms * 1000).toFixed(0)} m/s in ${APOLLO_11.poweredDescent.seconds} s (${pct(pdi.dvKms!, APOLLO_11.poweredDescent.dvKms)}, ${pct(pdi.durationS!, APOLLO_11.poweredDescent.seconds)})`,
        `  PDI range       ${pdiRangeKm.toFixed(0)} km from the site   Apollo 11: about ${APOLLO_11.pdiRangeKm.toFixed(0)} km`,
        `  miss ${descent.missM.toExponential(1)} m, touchdown ${descent.touchdownSpeedMs.toFixed(2)} m/s, propellant left ${descent.propellantLeftKg.toFixed(0)} kg`,
        `  total ${((descent.dvKms.doi + descent.dvKms.powered) * 1000).toFixed(0)} m/s, impulsive lower bound ${(descent.idealDvKms * 1000).toFixed(0)} m/s (${pct(descent.dvKms.doi + descent.dvKms.powered, descent.idealDvKms)})`,
      ].join('\n'),
    )
    // DOI: the same job from nearly the same orbit (Apollo 11: 58.5 by 7.8 n mi after the burn)
    expect(Math.abs(doi.dvKms! / APOLLO_11.doi.dvKms - 1)).toBeLessThan(0.15)
    // Powered descent: this planner brakes at full thrust down to a gate 100 m above the site. Apollo 11 throttled
    // down 386 s after ignition (MR 5.3) and then flew a slow, piloted approach with a view of the site, which
    // took 756 s and about 2065 m/s. The fuel-efficient descent must cost less, but not implausibly less.
    expect(pdi.dvKms!).toBeLessThan(APOLLO_11.poweredDescent.dvKms)
    expect(pdi.dvKms!).toBeGreaterThan(0.85 * APOLLO_11.poweredDescent.dvKms)
    expect(pdi.durationS!).toBeLessThan(APOLLO_11.poweredDescent.seconds)
    expect(pdi.durationS!).toBeGreaterThan(0.55 * APOLLO_11.poweredDescent.seconds)
    expect(pdiRangeKm).toBeGreaterThan(0.75 * APOLLO_11.pdiRangeKm)
    expect(pdiRangeKm).toBeLessThan(APOLLO_11.pdiRangeKm)
    expect(descent.crossRangeDeg).toBeCloseTo(0.7, 1)
    expect(descent.brakingThrottle).toBe(1)
    // how far from the impulsive lower bound (Hohmann transfer to the surface and a stop there)
    expect((descent.dvKms.doi + descent.dvKms.powered) / descent.idealDvKms).toBeLessThan(1.08)
  })

  it('lifts off, reaches the documented insertion orbit with the documented burn, and docks with the CSM', () => {
    const earliestMs = descent.touchdownMs + 21.6 * HOUR_MS // Apollo 11: landing 102:45:39.9, liftoff 124:22:00.79 (ABTN), 21.6 h
    const ascent = planAscent({ field: point, site, earliestMs, target: orbit, lander: lm, massKg: APOLLO_11.liftoffKg, insertionAltKm: APOLLO_11.insertionAltKm })
    expectDocked(ascent, APOLLO_11.liftoffKg)
    expect(ascent.liftoffMs).toBeGreaterThanOrEqual(earliestMs)
    expect(ascent.liftoffMs).toBeLessThan(earliestMs + 2.1 * HOUR_MS) // within one revolution of the CSM
    const liftoff = ascent.events[0]
    const hours = (ascent.dockingMs - ascent.liftoffMs) / HOUR_MS
    console.log(
      [
        'Apollo LM ascent, simulated against Apollo 11 (ABTN):',
        `  ascent burn ${(liftoff.dvKms! * 1000).toFixed(0)} m/s in ${liftoff.durationS!.toFixed(1)} s   Apollo 11: ${(APOLLO_11.ascent.dvKms * 1000).toFixed(0)} m/s in ${APOLLO_11.ascent.seconds} s (${pct(liftoff.dvKms!, APOLLO_11.ascent.dvKms)}, ${pct(liftoff.durationS!, APOLLO_11.ascent.seconds)})`,
        `  rendezvous  ${(ascent.dvKms.rendezvous * 1000).toFixed(1)} m/s, docking ${hours.toFixed(2)} h after liftoff   Apollo 11: ${(APOLLO_11.rendezvousDvKms * 1000).toFixed(1)} m/s (coelliptic sequence, RCS), ${APOLLO_11.liftoffToDockingH.toFixed(2)} h`,
        `  at docking ${ascent.relPosM.toExponential(1)} m and ${ascent.relSpeedMs.toExponential(1)} m/s from the CSM, propellant left ${ascent.propellantLeftKg.toFixed(0)} kg`,
        `  plane change ${ascent.planeChangeDeg.toFixed(2)}° for ${(ascent.planeChangeDvKms * 1000).toFixed(1)} m/s`,
        `  total ${((ascent.dvKms.ascent + ascent.dvKms.rendezvous) * 1000).toFixed(0)} m/s, impulsive lower bound ${(ascent.idealDvKms * 1000).toFixed(0)} m/s (${pct(ascent.dvKms.ascent + ascent.dvKms.rendezvous, ascent.idealDvKms)})`,
      ].join('\n'),
    )
    // the ascent burn is the same manoeuvre Apollo flew (full thrust into a 9 by 45 n mi orbit): within 3 %
    expect(Math.abs(liftoff.dvKms! / APOLLO_11.ascent.dvKms - 1)).toBeLessThan(0.03)
    expect(Math.abs(liftoff.durationS! / APOLLO_11.ascent.seconds - 1)).toBeLessThan(0.03)
    // the rendezvous is a direct one (two burns after insertion), cheaper and quicker than Apollo 11's four-burn sequence
    expect(ascent.dvKms.rendezvous).toBeLessThan(APOLLO_11.rendezvousDvKms)
    expect(ascent.dvKms.rendezvous).toBeGreaterThan(0.02)
    expect(hours).toBeLessThan(APOLLO_11.liftoffToDockingH)
    expect(ascent.planeChangeDeg).toBeCloseTo(0.7, 1)
    expect(ascent.planeChangeDvKms).toBeLessThan(0.02)
    expect((ascent.dvKms.ascent + ascent.dvKms.rendezvous) / ascent.idealDvKms).toBeLessThan(1.1)
  })
})

describe('polar orbit, site at −89.5°, Earth and Sun in the field', () => {
  it('lands, stays 6.5 days while the Moon turns under the orbit, and returns', () => {
    const ephem = circularEphemeris()
    const t0 = Date.UTC(2026, 10, 20)
    const field = moonField(ephem, t0 - HOUR_MS, t0 + 9 * DAY_MS)
    const siteUnit = latLonUnit(-89.5, 45)
    const site = (utcMs: number): Vec3 => scale(qrot(ephem.moonFixedToInertial(utcMs), siteUnit), R_MOON)
    // a 100 km orbit over the Moon's poles; its plane contains the direction of the site at t0
    const pole = qrot(ephem.moonFixedToInertial(t0), [0, 0, 1])
    const inEquator = unit(cross(pole, cross(site(t0), pole)))
    const r = R_MOON + 100
    const orbit: OrbitState = { utcMs: t0, r: scale(inEquator, r), v: scale(pole, -Math.sqrt(MU_MOON / r)) }

    const descent = planDescent({ field, orbit, earliestMs: t0 + 0.5 * HOUR_MS, site, lander: lm, massKg: APOLLO_11.separationKg, pdiAltKm: 15 })
    expectLanded(descent, site, APOLLO_11.separationKg)
    expect(descent.events.find((e) => e.id === 'doi')!.utcMs).toBeGreaterThanOrEqual(t0 + 0.5 * HOUR_MS)
    expect(descent.touchdownMs).toBeLessThan(t0 + 0.5 * HOUR_MS + 3.2 * HOUR_MS) // the first pass over the site
    expect(descent.crossRangeDeg).toBeLessThan(0.5)

    const earliestMs = descent.touchdownMs + 6.5 * DAY_MS
    const ascent = planAscent({ field, site, earliestMs, target: orbit, lander: lm, massKg: APOLLO_11.liftoffKg, insertionAltKm: { perilune: 15, apolune: 80 } })
    expectDocked(ascent, APOLLO_11.liftoffKg)
    expect(ascent.liftoffMs).toBeGreaterThanOrEqual(earliestMs)
    expect(ascent.liftoffMs).toBeLessThan(earliestMs + 2.1 * HOUR_MS)
    // the site is half a degree from the pole, so never further than that from a polar orbit's plane
    expect(ascent.planeChangeDeg).toBeLessThan(0.6)
    expect(ascent.planeChangeDeg).toBeGreaterThan(0.05) // the Moon has turned about 86° under the orbit
    console.log(
      `Polar orbit, site −89.5°: miss ${descent.missM.toExponential(1)} m at ${descent.touchdownSpeedMs.toFixed(2)} m/s; ` +
        `after ${((ascent.liftoffMs - descent.touchdownMs) / DAY_MS).toFixed(3)} days liftoff with the site ${ascent.planeChangeDeg.toFixed(2)}° off the orbit plane ` +
        `(${(ascent.planeChangeDvKms * 1000).toFixed(1)} m/s); docking at ${ascent.relPosM.toExponential(1)} m, ${ascent.relSpeedMs.toExponential(1)} m/s.`,
    )
  })
})

describe('landers defined by data only', () => {
  const site = spinningSite(-0.3, 140)
  const orbit = equatorialOrbit(100)
  const roundTrip = (lander: SpacecraftSpec) => {
    const massKg = lander.modules[0].dryKg + lander.modules[0].propellantKg
    const descent = planDescent({ field: point, orbit, earliestMs: 0, site, lander, massKg, pdiAltKm: 15 })
    expectLanded(descent, site, massKg)
    const ascent = planAscent({
      field: point, site, earliestMs: descent.touchdownMs + 3 * DAY_MS, target: orbit, lander, massKg: descent.massAtTouchdownKg, insertionAltKm: { perilune: 15, apolune: 80 },
    })
    expectDocked(ascent, descent.massAtTouchdownKg)
    // one module: what the descent left is what the ascent has
    expect(ascent.propellantLeftKg).toBeLessThan(descent.propellantLeftKg)
    expect(ascent.massAtDockingKg).toBeGreaterThan(lander.modules[0].dryKg)
    return { descent, ascent }
  }

  it('single stage, throttleable engine: lands and returns', () => {
    const { descent, ascent } = roundTrip(singleStage('Throttle', 45_000, 320, 0.2, 3000, 9000))
    expect(descent.touchdownSpeedMs).toBeCloseTo(0.5, 2) // the closed loop holds the sink-rate profile to the ground
    expect(descent.brakingThrottle).toBe(1)
    expect(ascent.ascentThrottle).toBe(1)
  })

  it('single stage, fixed-thrust engine: one burn timed to end just above the ground, then a drop of 0.1 m', () => {
    const { descent } = roundTrip(singleStage('Fixed', 45_000, 320, 1, 3000, 9000))
    expect(descent.brakingThrottle).toBe(1)
    expect(descent.touchdownSpeedMs).toBeGreaterThan(0.3)
    expect(descent.touchdownSpeedMs).toBeLessThan(0.9)
    // the engine is cut off before the touchdown: the last stretch of the path is flown without thrust
    const n = descent.path.t.length
    expect(descent.path.thrusting[n - 2]).toBe(false)
    expect((descent.path.t[n - 1] - descent.path.t[n - 2]) / 1000).toBeLessThan(1)
  })

  it('an engine four times stronger: throttled to where it needs the least propellant, or far from it when it cannot throttle', () => {
    const strong = roundTrip(singleStage('Strong', 240_000, 320, 0.2, 3000, 9000))
    expect(strong.descent.brakingThrottle).toBeLessThan(0.6)
    expect(strong.ascent.ascentThrottle).toBeLessThan(0.6)
    const total = (d: DescentResult) => d.dvKms.doi + d.dvKms.powered
    expect(total(strong.descent) / strong.descent.idealDvKms).toBeLessThan(1.06)
    const rigid = roundTrip(singleStage('Rigid', 240_000, 320, 1, 3000, 9000))
    expect(total(rigid.descent)).toBeGreaterThan(total(strong.descent) + 0.1)
  })

  it('too little thrust to land is reported, not flown', () => {
    // 4 kN on 12 t: a third of the lander's weight on the Moon
    const weak = singleStage('Weak', 4_000, 320, 0.2, 3000, 9000)
    expect(() => planDescent({ field: point, orbit, earliestMs: 0, site, lander: weak, massKg: 12000, pdiAltKm: 15 })).toThrow(LunarOpsError)
    expect(() => planAscent({ field: point, site, earliestMs: 0, target: orbit, lander: weak, massKg: 12000, insertionAltKm: { perilune: 15, apolune: 80 } })).toThrow(/cannot lift off/)
  })
})

describe('sites off the orbit plane', () => {
  const orbit = equatorialOrbit(110)
  const land = (latDeg: number) => {
    const site = spinningSite(latDeg, 60)
    return { site, descent: planDescent({ field: point, orbit, earliestMs: 0, site, lander: lm, massKg: APOLLO_11.separationKg, pdiAltKm: 15 }) }
  }

  it('0.5° and 2° of cross-range are steered out during the braking burn', () => {
    const inPlane = land(0)
    const half = land(0.5)
    const two = land(2)
    for (const { site, descent } of [inPlane, half, two]) expectLanded(descent, site, APOLLO_11.separationKg)
    expect(half.descent.crossRangeDeg).toBeCloseTo(0.5, 2)
    expect(two.descent.crossRangeDeg).toBeCloseTo(2, 2)
    // steering costs roughly with the square of the cross-range
    expect(inPlane.descent.crossRangeDvKms).toBeLessThan(0.0005)
    expect(half.descent.crossRangeDvKms).toBeGreaterThan(0.001)
    expect(half.descent.crossRangeDvKms).toBeLessThan(0.01)
    expect(two.descent.crossRangeDvKms).toBeGreaterThan(8 * half.descent.crossRangeDvKms)
    expect(two.descent.crossRangeDvKms).toBeLessThan(0.08)
    expect(two.descent.dvKms.powered - inPlane.descent.dvKms.powered).toBeCloseTo(two.descent.crossRangeDvKms, 3)
  })

  it('a site 20° off the plane is refused with a clear message', () => {
    expect(() => land(20)).toThrow(LunarOpsError)
    expect(() => land(20)).toThrow(/20\.0° off the orbit plane/)
  })

  it('ascent from a site 3° off the target plane: part steered out, the rest in a plane change burn at the node', () => {
    const site = spinningSite(3, 60)
    const ascent = planAscent({ field: point, site, earliestMs: 0, target: orbit, lander: lm, massKg: APOLLO_11.liftoffKg, insertionAltKm: APOLLO_11.insertionAltKm })
    expectDocked(ascent, APOLLO_11.liftoffKg)
    expect(ascent.planeChangeDeg).toBeCloseTo(3, 2)
    const burn = ascent.events.find((e) => e.id === 'plane-change')!
    expect(burn.label).toBe('Plane change')
    // about a quarter revolution (30 min) after liftoff, where the two planes cross
    expect((burn.utcMs - ascent.liftoffMs) / 60_000).toBeGreaterThan(22)
    expect((burn.utcMs - ascent.liftoffMs) / 60_000).toBeLessThan(38)
    // cheaper than turning the orbital velocity (1.65 km/s) by the whole 3°, dearer than by half of it
    expect(ascent.planeChangeDvKms).toBeLessThan(1.65 * 3 * (Math.PI / 180))
    expect(ascent.planeChangeDvKms).toBeGreaterThan(1.65 * 1.5 * (Math.PI / 180))
  })
})

describe('not enough propellant', () => {
  const site = spinningSite(0.2, 10)
  const orbit = equatorialOrbit(110)

  it('descent: a half-empty descent stage is refused', () => {
    const run = () => planDescent({ field: point, orbit, earliestMs: 0, site, lander: lm, massKg: APOLLO_11.separationKg, pdiAltKm: 15, propellantKg: 4000 })
    expect(run).toThrow(LunarOpsError)
    expect(run).toThrow(/Not enough propellant for the descent/)
  })

  it('ascent: an ascent stage 30 % heavier than Apollo 11’s cannot reach the CSM', () => {
    const run = () =>
      planAscent({ field: point, site, earliestMs: 0, target: orbit, lander: lm, massKg: 1.3 * APOLLO_11.liftoffKg, insertionAltKm: APOLLO_11.insertionAltKm })
    expect(run).toThrow(LunarOpsError)
    expect(run).toThrow(/Not enough propellant for the ascent/)
  })
})
