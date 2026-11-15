// Proof P1 (b) and (c) on the transfer as flown by transit.ts (flyOutbound, DE440 ephemeris, August 2027):
//  (b) the vehicle's mass falls with the propellant burned during the finite Trans-Lunar Injection burn, and the
//      speed it gains follows the rocket equation of that falling mass;
//  (c) the translunar coast is integrated with the Sun as a third body in the Earth-centred field, and the lunar
//      orbit insertion with the Earth as a third body in the Moon-centred field.
// sim.test.ts checks the integrator in isolation (thrust in free space, a radial fall). This file goes one level
// up: it re-flies the flown TLI and coast from flyOutbound's own result with the fields sim.ts provides
// (earthField, moonField), shows the re-flight lands on the flown path, then switches one ingredient off and
// states how far the result moves. The Sun or Earth term is switched off without touching sim.ts: the field is
// built from an ephemeris in which that body is moved a million times further away, so its pull and tide vanish.
import { describe, expect, it } from 'vitest'
import aug2027 from '../../public/data/ephem/2027-08.json?raw'
import sep2027 from '../../public/data/ephem/2027-09.json?raw'
import type { EphemMonth } from '../data/types'
import { G0, MU_EARTH, MU_MOON, R_EARTH_EQ, R_MOON, circularSpeed } from './astro'
import { makeFlightEphemeris } from './ephemeris'
import { firstGuess } from './guess'
import type { GuessInput } from './guess'
import { constantThrust, earthField, integrate, moonField } from './sim'
import type { Engine, Field, SimState } from './sim'
import { flyOutbound } from './transit'
import type { Orbit } from './transit'
import type { FlightEphemeris, Vec3 } from './types'
import { DEG, cross, norm, rotateAbout, scale, sub, unit } from './vec'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
const FAR = 1e6

// The same outbound case as transit.test.ts: south polar site, Kennedy pad, round Apollo-class stage numbers.
const ephem = makeFlightEphemeris([aug2027, sep2027].map((m) => JSON.parse(m) as EphemMonth))
const site = { lat: -89.46, lon: -136.68 }
const ORBIT_TO_TOUCHDOWN_S = 4 * 3600
const guessInput: GuessInput = {
  ephem, padLatDeg: 28.627, padLonDeg: -80.621, siteLatDeg: site.lat, siteLonDeg: site.lon, parkingAltKm: 185,
  lunarOrbitAltKm: 100, ascentTimeS: 700, ascentArcRad: 25 * DEG, maxTransferDays: null,
  earliestTouchdownMs: Date.UTC(2027, 7, 16), orbitToTouchdownS: ORBIT_TO_TOUCHDOWN_S,
}
const guess = firstGuess(guessInput)
const rPark = R_EARTH_EQ + 185
const dir = rotateAbout(guess.padHat, guess.planeNormal, guessInput.ascentArcRad)
const insertion: Orbit = {
  utcMs: guess.liftoffMs + guessInput.ascentTimeS * 1000,
  r: scale(dir, rPark),
  v: scale(cross(guess.planeNormal, dir), circularSpeed(MU_EARTH, rPark)),
}
const stage = { name: 'injection stage', thrustN: 1_000_000, ispS: 421, dryKg: 15_000, propellantKg: 72_000 }
const capsuleEngine = { name: 'capsule engine', thrustN: 91_000, ispS: 314 }
const payloadKg = 45_000

const out = flyOutbound({
  ephem, guess, insertion, stage, payloadKg, capsuleEngine, lunarOrbitAltKm: 100,
  siteLatDeg: site.lat, siteLonDeg: site.lon, orbitToTouchdownS: ORBIT_TO_TOUCHDOWN_S,
})
const [, tliSeg, coastSeg] = out.segs
const tli = out.events[0]
const loi = out.events[1]
const last = <T,>(a: T[]) => a[a.length - 1]

// the field span flyOutbound uses (the body tables are sampled on the same grid)
const fromMs = insertion.utcMs - HOUR_MS
const toMs = guess.loiMs + 2.5 * DAY_MS
const fullEarth = earthField(ephem, fromMs, toMs, guess.pole)
const fullMoon = moonField(ephem, fromMs, toMs)

/** The ephemeris with the Sun a million times further from Earth: no pull, no tide. */
const noSun: FlightEphemeris = { ...ephem, sunPos: (t) => scale(ephem.sunPos(t), FAR) }
/** The ephemeris with Earth a million times further from the Moon, the Sun kept where it is seen from the Moon. */
const noEarth: FlightEphemeris = {
  ...ephem,
  moonPos: (t) => scale(ephem.moonPos(t), FAR),
  sunPos: (t) => sub(ephem.sunPos(t), sub(ephem.moonPos(t), scale(ephem.moonPos(t), FAR))),
}

// ---- Re-fly the parking coast and the TLI burn exactly as flyOutbound did (same start, plane turn, steering).
const prograde = (_t: number, s: SimState) => unit(s.v)
const r0 = rotateAbout(insertion.r, guess.padHat, out.planeTurnRad)
const v0 = rotateAbout(insertion.v, guess.padHat, out.planeTurnRad)
const m0 = payloadKg + stage.dryKg + stage.propellantKg
const coastS = (tliSeg.t[0] - insertion.utcMs) / 1000
const parking = integrate(fullEarth, { r: r0, v: v0, m: m0 }, insertion.utcMs, { maxSeconds: coastS, maxStepS: 30 })
const tIgnMs = insertion.utcMs + coastS * 1000
const burn = integrate(fullEarth, parking.end, tIgnMs, { maxSeconds: tli.durationS, maxStepS: 10, engine: constantThrust(stage.thrustN, stage.ispS, prograde) })
const tCutMs = tIgnMs + tli.durationS * 1000
const afterCut: SimState = { r: burn.end.r, v: burn.end.v, m: payloadKg }
const coastToLoiS = (coastSeg.t[coastSeg.t.length - 1] - tCutMs) / 1000

describe('P1 (b) mass falls with the burned propellant during the flown TLI burn', () => {
  const flowKgS = stage.thrustN / (G0 * stage.ispS)
  const veKms = (G0 * stage.ispS) / 1000

  it('the re-flown burn ends where the flown one did', () => {
    expect(norm(sub(parking.end.r, tliSeg.p[0]))).toBeLessThan(0.05) // km
    expect(norm(sub(burn.end.r, last(tliSeg.p)))).toBeLessThan(0.05)
  })

  it('mass falls linearly with burn time at thrust / (g0·Isp), and the flown event reports that mass', () => {
    expect(burn.m.length).toBeGreaterThan(20)
    for (let i = 0; i < burn.t.length; i++) expect(Math.abs(burn.m[i] - (m0 - flowKgS * burn.t[i]))).toBeLessThan(1e-3)
    expect(tli.propellantKg).toBeCloseTo(flowKgS * tli.durationS, 3)
    expect(tli.propellantKg / m0).toBeGreaterThan(0.4) // a large share: the effect cannot hide in rounding
  })

  it('the speed the engine adds, summed over the falling mass, is the rocket equation vₑ·ln(m₀/m₁)', () => {
    // ∫ F/m(t) dt by the trapezoid rule over the integrator's own samples of m(t)
    let dv = 0
    for (let i = 1; i < burn.t.length; i++) {
      dv += 0.5 * (stage.thrustN / burn.m[i - 1] + stage.thrustN / burn.m[i]) * (burn.t[i] - burn.t[i - 1]) / 1000
    }
    const rocket = veKms * Math.log(m0 / burn.end.m)
    const constantMass = (stage.thrustN * tli.durationS) / m0 / 1000
    expect(Math.abs(dv - rocket)).toBeLessThan(1e-3) // 1 m/s: the trapezoid rule on 10 s steps is 0.4 m/s off
    expect(tli.dvKms).toBeCloseTo(rocket, 9)
    expect(rocket - constantMass).toBeGreaterThan(0.5) // km/s: a constant-mass model would be far off
    console.log(
      `[proof b] TLI ${tli.durationS.toFixed(1)} s, ${(m0 / 1000).toFixed(1)} → ${(burn.end.m / 1000).toFixed(1)} t; ` +
        `∫F/m dt ${(dv * 1000).toFixed(1)} m/s, rocket equation ${(rocket * 1000).toFixed(1)} m/s, ` +
        `constant mass would give ${(constantMass * 1000).toFixed(1)} m/s`,
    )
  })

  it('the same burn with the mass held at its ignition value misses the flown cut-off by thousands of km', () => {
    // same thrust and steering, no propellant flow: the counterfactual a model without mass loss would fly
    const noFlow: Engine = (tS, s, f) => {
      constantThrust(stage.thrustN, stage.ispS, prograde)(tS, s, f)
      return 0
    }
    const heavy = integrate(fullEarth, parking.end, tIgnMs, { maxSeconds: tli.durationS, maxStepS: 10, engine: noFlow })
    expect(heavy.end.m).toBe(m0)
    const coastHeavy = integrate(fullEarth, { r: heavy.end.r, v: heavy.end.v, m: payloadKg }, tCutMs, { maxSeconds: coastToLoiS })
    const coastFlown = integrate(fullEarth, afterCut, tCutMs, { maxSeconds: coastToLoiS })
    const missKm = norm(sub(coastHeavy.end.r, coastFlown.end.r))
    const cutSpeedMs = (norm(burn.end.v) - norm(heavy.end.v)) * 1000
    console.log(`[proof b] mass held constant: ${cutSpeedMs.toFixed(0)} m/s less at cut-off, ${missKm.toFixed(0)} km from the flown point at LOI ignition`)
    expect(cutSpeedMs).toBeGreaterThan(500)
    expect(missKm).toBeGreaterThan(10_000)
  })
})

describe('P1 (c) the transfer includes the Sun and the Earth as third bodies', () => {
  it('the re-flown translunar coast under the full Earth-centred field reaches the flown LOI ignition point', () => {
    const coast = integrate(fullEarth, afterCut, tCutMs, { maxSeconds: coastToLoiS })
    const offKm = norm(sub(coast.end.r, last(coastSeg.p)))
    console.log(`[proof c] re-flown coast ends ${(offKm * 1000).toFixed(1)} m from the flown LOI ignition point after ${(coastToLoiS / 86400).toFixed(2)} days`)
    expect(offKm).toBeLessThan(1)
  })

  it('without the Sun, the same coast arrives kilometres off and passes the Moon at a different altitude', () => {
    const sunless = earthField(noSun, fromMs, toMs, guess.pole)
    const full = integrate(fullEarth, afterCut, tCutMs, { maxSeconds: coastToLoiS })
    const off = integrate(sunless, afterCut, tCutMs, { maxSeconds: coastToLoiS })
    const missKm = norm(sub(off.end.r, full.end.r))
    // the altitude above the Moon at the LOI ignition instant, both ways
    const moonAt = fullEarth.moonState(tCutMs + coastToLoiS * 1000).r
    const altFull = norm(sub(full.end.r, moonAt)) - R_MOON
    const altOff = norm(sub(off.end.r, moonAt)) - R_MOON
    console.log(
      `[proof c] Sun term off: ${missKm.toFixed(1)} km from the flown point at LOI ignition; altitude above the Moon ${altFull.toFixed(1)} → ${altOff.toFixed(1)} km`,
    )
    expect(missKm).toBeGreaterThan(SUN_MISS_MIN_KM)
  })

  it('without the Earth, the lunar orbit insertion burn ends in a measurably different orbit', () => {
    // state at LOI ignition, re-flown, then the flown LOI burn in the Moon-centred field
    const coast = integrate(fullEarth, afterCut, tCutMs, { maxSeconds: coastToLoiS })
    const tLoiMs = tCutMs + coastToLoiS * 1000
    const moon = fullEarth.moonState(tLoiMs)
    const start: SimState = { r: sub(coast.end.r, moon.r), v: sub(coast.end.v, moon.v), m: payloadKg }
    // flyOutbound's steering for the insertion: toward the circular velocity at the present radius
    const toGain = (s: SimState): Vec3 => {
      const rHat = unit(s.r)
      const tHat = unit(cross(cross(s.r, s.v), rHat))
      return sub(scale(tHat, circularSpeed(MU_MOON, norm(s.r))), s.v)
    }
    const fly = (field: Field) =>
      integrate(field, start, tLoiMs, {
        maxSeconds: 3 * loi.durationS, maxStepS: 5,
        engine: constantThrust(capsuleEngine.thrustN, capsuleEngine.ispS, (_t, s) => unit(toGain(s))),
        stop: (_t, s) => 2e-6 - norm(toGain(s)),
      })
    const full = fly(fullMoon)
    expect(full.stopped).toBe(true)
    expect(norm(sub(full.end.r, out.lunarOrbit.r))).toBeLessThan(1) // km: the re-flight matches the flown LOI (it starts 0.3 km off)
    // then 4 h in lunar orbit up to the descent, as the mission flies it in the same field
    const holdS = ORBIT_TO_TOUCHDOWN_S
    const fullHold = integrate(fullMoon, full.end, tLoiMs + full.endS * 1000, { maxSeconds: holdS, maxStepS: 60 })
    const earthless = moonField(noEarth, fromMs, toMs)
    const off = fly(earthless)
    const offHold = integrate(earthless, off.end, tLoiMs + off.endS * 1000, { maxSeconds: holdS, maxStepS: 60 })
    const atCutM = norm(sub(off.end.r, full.end.r)) * 1000
    const afterHoldKm = norm(sub(offHold.end.r, fullHold.end.r))
    console.log(
      `[proof c] Earth term off in the Moon-centred field: ${atCutM.toFixed(1)} m apart at LOI cut-off, ${afterHoldKm.toFixed(2)} km apart 4 h later`,
    )
    expect(afterHoldKm).toBeGreaterThan(EARTH_MISS_MIN_KM)
  })
})

// Thresholds at about half of what was measured when this file was written: without the Sun the coast ends
// 811 km from the flown point (passing the Moon 433 km up instead of 123 km at LOI ignition); without the Earth
// the lunar orbit is 0.4 m off at LOI cut-off and 0.35 km off 4 h later.
const SUN_MISS_MIN_KM = 400
const EARTH_MISS_MIN_KM = 0.15
