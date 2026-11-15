// Outbound and homebound legs with finite burns on the real DE440 ephemeris. The vehicle numbers here are
// round Apollo-class values written into the test: the legs must work for any stage given as thrust, specific
// impulse and mass.
import { describe, expect, it } from 'vitest'
import aug2027 from '../../public/data/ephem/2027-08.json?raw'
import sep2027 from '../../public/data/ephem/2027-09.json?raw'
import type { EphemMonth } from '../data/types'
import { MU_EARTH, MU_MOON, R_EARTH_EQ, R_MOON, circularSpeed } from './astro'
import { makeFlightEphemeris } from './ephemeris'
import { firstGuess } from './guess'
import type { GuessInput } from './guess'
import { apsides, flyHomebound, flyOutbound } from './transit'
import type { Orbit } from './transit'
import { DEG, cross, dot, latLonUnit, norm, qrot, rotateAbout, scale, unit } from './vec'

const ephem = makeFlightEphemeris([aug2027, sep2027].map((m) => JSON.parse(m) as EphemMonth))
const site = { lat: -89.46, lon: -136.68 }
const ORBIT_TO_TOUCHDOWN_S = 4 * 3600
const guessInput: GuessInput = {
  ephem,
  padLatDeg: 28.627,
  padLonDeg: -80.621,
  siteLatDeg: site.lat,
  siteLonDeg: site.lon,
  parkingAltKm: 185,
  lunarOrbitAltKm: 100,
  ascentTimeS: 700,
  ascentArcRad: 25 * DEG,
  maxTransferDays: null,
  earliestTouchdownMs: Date.UTC(2027, 7, 16),
  orbitToTouchdownS: ORBIT_TO_TOUCHDOWN_S,
}
const guess = firstGuess(guessInput)
// stand-in for the ascent: on the circular parking orbit, in the guess's plane, at the end of the ascent arc
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

describe('first guess', () => {
  it('keeps the stay in lunar orbit short: touchdown within a day after the earliest one', () => {
    expect(guess.touchdownMs).toBeGreaterThanOrEqual(guessInput.earliestTouchdownMs)
    expect(guess.touchdownMs).toBeLessThan(guessInput.earliestTouchdownMs + 25 * 3600_000)
    expect(guess.touchdownMs - guess.loiMs).toBe(ORBIT_TO_TOUCHDOWN_S * 1000)
  })
})

describe('outbound with finite burns', () => {
  const out = flyOutbound({
    ephem, guess, insertion, stage, payloadKg, capsuleEngine, lunarOrbitAltKm: 100,
    siteLatDeg: site.lat, siteLonDeg: site.lon, orbitToTouchdownS: ORBIT_TO_TOUCHDOWN_S,
  })
  const tli = out.events[0]
  const loi = out.events[1]

  it('the injection is a burn of minutes, not an instant, and costs a little more than the ideal impulse', () => {
    expect(tli.durationS).toBeGreaterThan(200)
    expect(tli.durationS).toBeLessThan(500)
    expect(tli.dvKms).toBeGreaterThan(guess.dvTliKms) // finite-burn (gravity) loss
    expect(tli.dvKms).toBeLessThan(guess.dvTliKms + 0.08)
    expect(tli.propellantKg).toBeLessThan(stage.propellantKg)
  })

  it('enters a near-circular 100 km lunar orbit whose plane passes over the landing site', () => {
    expect(out.periluneKm).toBeGreaterThan(98)
    expect(out.apoluneKm).toBeLessThan(102)
    const el = apsides(MU_MOON, out.lunarOrbit.r, out.lunarOrbit.v)
    expect(el.e).toBeLessThan(0.0005)
    const siteHat = qrot(ephem.moonFixedToInertial(out.perilunePassMs + ORBIT_TO_TOUCHDOWN_S * 1000), latLonUnit(site.lat, site.lon))
    expect(Math.abs(Math.asin(dot(out.lunarPlaneNormal, siteHat))) / DEG).toBeLessThan(0.3)
    expect(loi.dvKms).toBeGreaterThan(0.75)
    expect(loi.dvKms).toBeLessThan(0.95)
    expect(loi.durationS).toBeGreaterThan(200)
  })

  it('paths join without gaps and the plane turn asked of the ascent is small', () => {
    expect(Math.abs(out.planeTurnRad) / DEG).toBeLessThan(4)
    for (let i = 1; i < 3; i++) {
      const a = out.segs[i - 1]
      const b = out.segs[i]
      expect(b.t[0]).toBe(a.t[a.t.length - 1])
      expect(norm([b.p[0][0] - a.p[a.p.length - 1][0], b.p[0][1] - a.p[a.p.length - 1][1], b.p[0][2] - a.p[a.p.length - 1][2]])).toBeLessThan(1e-6)
    }
    for (const s of out.segs) for (let i = 1; i < s.t.length; i++) expect(s.t[i]).toBeGreaterThanOrEqual(s.t[i - 1])
    console.log(
      `[transit] TLI ${tli.dvKms.toFixed(4)} km/s in ${tli.durationS.toFixed(0)} s (ideal ${guess.dvTliKms.toFixed(4)}), ${(tli.propellantKg / 1000).toFixed(1)} t; ` +
        `LOI ${loi.dvKms.toFixed(4)} km/s in ${loi.durationS.toFixed(0)} s; orbit ${out.periluneKm.toFixed(1)} × ${out.apoluneKm.toFixed(1)} km; ` +
        `plane turn ${(out.planeTurnRad / DEG).toFixed(3)}°; vInf ${out.vInfKms.toFixed(3)}; transfer ${((loi.utcMs - tli.utcMs) / 86400000).toFixed(3)} d`,
    )
  })

  describe('homebound with a finite burn', () => {
    // leave two weeks after arriving (the orbit plane contains the way home again), with the capsule alone
    const home = flyHomebound({
      ephem, orbit: out.lunarOrbit, earliestMs: out.lunarOrbit.utcMs + 14 * 86400_000, massKg: 20_000, engine: capsuleEngine,
      entryAltKm: 121.92, entryFpaDeg: -6.5,
    })
    const tei = home.events[0]
    it('reaches Entry Interface at the asked flight-path angle and lunar-return speed', () => {
      expect(home.entry.fpaDeg).toBeCloseTo(-6.5, 1)
      expect(home.entry.speedKms).toBeGreaterThan(10.8)
      expect(home.entry.speedKms).toBeLessThan(11.2)
      expect(home.returnDays).toBeGreaterThan(2)
      expect(home.returnDays).toBeLessThan(6.5)
    })
    it('the burn for home is finite and of the expected size', () => {
      expect(tei.durationS).toBeGreaterThan(60)
      expect(tei.dvKms).toBeGreaterThan(0.7)
      expect(tei.dvKms).toBeLessThan(1.3)
      const last = home.segs[2]
      expect(Math.abs(norm(last.p[last.p.length - 1]) - (R_EARTH_EQ + 121.92))).toBeLessThan(0.01)
      console.log(
        `[transit] home after 14 d: TEI ${tei.dvKms.toFixed(4)} km/s in ${tei.durationS.toFixed(0)} s, yaw ${home.yawDeg.toFixed(1)}°, plane off ${home.planeOffDeg.toFixed(1)}°; ` +
          `return ${home.returnDays.toFixed(2)} d; EI ${home.entry.speedKms.toFixed(3)} km/s at ${home.entry.fpaDeg.toFixed(2)}°, lat ${home.entry.latDeg.toFixed(1)} lon ${home.entry.lonDeg.toFixed(1)}`,
      )
    })
    it('a week after arriving the orbit is edge-on to the way home: the return exists but costs far more', () => {
      const week = flyHomebound({
        ephem, orbit: out.lunarOrbit, earliestMs: out.lunarOrbit.utcMs + 7 * 86400_000, massKg: 20_000, engine: capsuleEngine,
        entryAltKm: 121.92, entryFpaDeg: -6.5,
      })
      console.log(`[transit] home after 7 d: TEI ${week.events[0].dvKms.toFixed(3)} km/s, yaw ${week.yawDeg.toFixed(1)}°, plane off ${week.planeOffDeg.toFixed(1)}°`)
      expect(week.planeOffDeg).toBeGreaterThan(45)
      expect(week.events[0].dvKms).toBeGreaterThan(tei.dvKms + 0.3)
      expect(week.entry.fpaDeg).toBeCloseTo(-6.5, 1)
    }, 60_000)
  })
})

describe('outbound for other hardware and places', () => {
  it('a weak, efficient upper stage (long burn) and a small spacecraft', () => {
    const out = flyOutbound({
      ephem, guess, insertion, stage: { name: 'hydrogen upper stage', thrustN: 110_000, ispS: 465, dryKg: 4_000, propellantKg: 29_000 },
      payloadKg: 26_000, capsuleEngine: { name: 'service module engine', thrustN: 26_700, ispS: 316 }, lunarOrbitAltKm: 100,
      siteLatDeg: site.lat, siteLonDeg: site.lon, orbitToTouchdownS: ORBIT_TO_TOUCHDOWN_S,
    })
    expect(out.events[0].durationS).toBeGreaterThan(900) // about twenty minutes
    expect(out.events[0].dvKms).toBeGreaterThan(guess.dvTliKms + 0.02) // a long burn loses more
    expect(out.periluneKm).toBeGreaterThan(98) // circular even with a thirteen-minute insertion burn
    expect(out.apoluneKm).toBeLessThan(102)
  })
})
