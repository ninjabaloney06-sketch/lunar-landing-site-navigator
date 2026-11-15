// First guess for a mission: when to lift off, in which plane, where on the parking orbit to inject.
// Patched conics (Bate, Mueller, White, Fundamentals of Astrodynamics, ch. 7) with the plane geometry in 3D,
// good to a few hours and a few thousand kilometres at the Moon. mission.ts integrates the real flight and
// corrects this guess; nothing computed here is shown as a result.
//
// For one liftoff instant: the parking orbit lies in the plane through the launchpad at liftoff and the Moon at
// arrival; the injection point is opposite the arrival point; at the Moon's sphere of influence the velocity
// relative to the Moon gives the hyperbolic excess speed and the plane of the lunar orbit, which has to pass
// over the landing site when the lander comes down. The liftoff is searched for the smallest delta-v among the
// instants whose touchdown falls within a day after the earliest one asked for: the launch geometry repeats
// daily, so that is one full set of opportunities, and the stay in lunar orbit is never longer than it must be.
import { MU_EARTH, MU_MOON, OMEGA_EARTH, R_EARTH_EQ, R_MOON, SOI_MOON, DAY_S, bisect, circularSpeed, eccentricToTrue, ellipse, goldenMin, hyperbola, hyperbolicTimeFromPeriapsis, perifocal, timeFromPeriapsis, trueAnomalyAtRadius, trueToEccentric, visViva } from './astro'
import type { Ellipse } from './astro'
import type { FlightEphemeris, Vec3 } from './types'
import { FlightPlanError } from './types'
import { DEG, TWO_PI, angleAbout, cross, dot, latLonUnit, norm, qrot, rotateAbout, scale, sub, unit } from './vec'

const HOUR_MS = 3_600_000
const MIN_MS = 60_000

export interface GuessInput {
  ephem: FlightEphemeris
  padLatDeg: number
  padLonDeg: number
  siteLatDeg: number
  siteLonDeg: number
  parkingAltKm: number
  lunarOrbitAltKm: number
  ascentTimeS: number // liftoff → parking orbit insertion
  ascentArcRad: number // downrange angle flown by insertion
  maxTransferDays: number | null
  earliestTouchdownMs: number
  /** Seconds from the lunar orbit insertion to touchdown: the shortest stay in orbit plus the descent. */
  orbitToTouchdownS: number
}

export interface Guess {
  liftoffMs: number
  padHat: Vec3 // launchpad direction at liftoff, J2000
  pole: Vec3 // Earth's spin axis at liftoff, J2000
  planeNormal: Vec3 // parking orbit and transfer plane, prograde
  azimuthRad: number // inertial launch azimuth
  inclinationRad: number
  coastAngleRad: number // parking orbit arc from insertion to the injection point
  tliMs: number // instant of the (impulsive) injection
  tliPoint: Vec3 // unit vector Earth → injection point
  dvTliKms: number
  transfer: Ellipse
  loiMs: number
  dvLoiKms: number
  vInfKms: number
  lunarPlaneNormal: Vec3 // plane of the lunar orbit, J2000, with the sense of rotation of the approach
  touchdownMs: number
  moonDistKm: number
  cost: number // km/s, what the search minimises
}

/** Shortest coast in the parking orbit before the injection: one revolution, so that the crew and the ground can
 *  check the spacecraft before it leaves Earth. The injection point comes round once per revolution, so the
 *  coast is between one and two revolutions. Flown: Apollo 11 "after 1.5 Earth orbits lasting 2 hours 38 minutes
 *  23.73 seconds", Apollo 17 two revolutions (NASA SP-2000-4029, Apollo by the Numbers,
 *  https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm ); Artemis I
 *  "approximately one revolution in Earth orbit" before the injection (NASA, SLS update, ASCEND 2023,
 *  https://ntrs.nasa.gov/api/citations/20230013280/downloads/Final%20-%20ASCEND%202023%20-%20SLS%20Update.pdf ). */
const MIN_PARKING_COAST_RAD = TWO_PI

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const mod2pi = (x: number) => ((x % TWO_PI) + TWO_PI) % TWO_PI

/** Transfer ellipse from the parking orbit to the Moon's distance d; maxDays caps the flight time. */
function transferFor(rPark: number, d: number, maxDays: number | null) {
  let el = ellipse(rPark, d)
  if (maxDays !== null) {
    const tMax = maxDays * DAY_S
    const timeTo = (ra: number) => {
      const e2 = ellipse(rPark, ra)
      return timeFromPeriapsis(MU_EARTH, e2, trueAnomalyAtRadius(e2, d))
    }
    if (tMax < timeTo(d)) {
      if (timeTo(80 * d) > tMax) throw new FlightPlanError('The shortest transfer this planner supports is about 2.5 days.')
      el = ellipse(rPark, bisect((ra) => timeTo(ra) - tMax, d, 80 * d))
    }
  }
  const nuA = trueAnomalyAtRadius(el, d)
  return { el, nuA, T: timeFromPeriapsis(MU_EARTH, el, nuA) }
}

function evaluate(g: GuessInput, tL: number): Guess | null {
  const { ephem } = g
  const rPark = R_EARTH_EQ + g.parkingAltKm
  const rLlo = R_MOON + g.lunarOrbitAltKm
  const vc = circularSpeed(MU_EARTH, rPark)
  const nPark = vc / rPark
  const qEarth = ephem.earthFixedToInertial(tL)
  const padHat = qrot(qEarth, latLonUnit(g.padLatDeg, g.padLonDeg))
  const pole = qrot(qEarth, [0, 0, 1])
  const ascentMs = g.ascentTimeS * 1000

  // Aim the transfer at the Moon where it will be on arrival (fixed-point iteration on the arrival instant).
  let tA = tL + ascentMs + (2700 + 4.98 * DAY_S) * 1000
  let tr = transferFor(rPark, norm(ephem.moonPos(tA)), g.maxTransferDays)
  let d = 0
  let h: Vec3 = [0, 0, 1]
  let P: Vec3 = [1, 0, 0]
  let coastAngle = 0
  let tTli = tL
  for (let pass = 0; pass < 5; pass++) {
    const mPos = ephem.moonPos(tA)
    d = norm(mPos)
    const mHat = unit(mPos)
    tr = transferFor(rPark, d, g.maxTransferDays)
    const cr = cross(padHat, mHat)
    if (norm(cr) < 1e-3) return null
    h = unit(cr)
    if (dot(h, pole) < 0) h = scale(h, -1) // prograde launch
    P = rotateAbout(mHat, h, -tr.nuA)
    coastAngle = angleAbout(padHat, P, h) - g.ascentArcRad
    while (coastAngle < MIN_PARKING_COAST_RAD) coastAngle += TWO_PI
    tTli = Math.round(tL + ascentMs + (coastAngle / nPark) * 1000)
    tA = tTli + tr.T * 1000
  }
  const el = tr.el
  const Q = cross(h, P)

  // Launch azimuth and what the ascent has to supply beyond the pad's own eastward speed.
  const east = unit(cross(pole, padHat))
  const north = cross(padHat, east)
  const vHat = cross(h, padHat)
  const az = mod2pi(Math.atan2(dot(vHat, east), dot(vHat, north)))
  const ve = OMEGA_EARTH * R_EARTH_EQ * Math.cos(g.padLatDeg * DEG)
  const ascentCost = Math.sqrt(vc * vc + ve * ve - 2 * vc * ve * Math.sin(az))
  const dvTli = visViva(MU_EARTH, rPark, el.a) - vc

  // Sphere-of-influence entry and the approach hyperbola.
  const tAt = (E: number) => tTli + Math.sqrt(el.a ** 3 / MU_EARTH) * (E - el.e * Math.sin(E)) * 1000
  const posAt = (E: number) => perifocal(el, MU_EARTH, eccentricToTrue(el.e, E), P, Q)
  const gap = (E: number) => norm(sub(posAt(E).r, ephem.moonPos(tAt(E)))) - SOI_MOON
  const EA = trueToEccentric(el.e, tr.nuA)
  const ELo = Math.acos(clamp((1 - (0.5 * d) / el.a) / el.e, -1, 1))
  if (gap(ELo) <= 0 || gap(EA) >= 0) return null
  const ES = bisect(gap, ELo, EA)
  const tS = tAt(ES)
  const sp = posAt(ES)
  const vRel = sub(sp.v, ephem.moonVel(tS))
  const v2 = dot(vRel, vRel) - (2 * MU_MOON) / SOI_MOON
  if (v2 <= 0) return null
  const vInf = Math.sqrt(v2)
  const S = unit(vRel)
  const hy = hyperbola(MU_MOON, vInf, rLlo)
  const nuS = -Math.acos(clamp((hy.p / SOI_MOON - 1) / hy.e, -1, 1))
  const tLoi = Math.round(tS + hyperbolicTimeFromPeriapsis(MU_MOON, hy, nuS) * 1000)
  const dvLoi = Math.sqrt(vInf * vInf + (2 * MU_MOON) / rLlo) - circularSpeed(MU_MOON, rLlo)

  // The lunar orbit's plane contains the approach direction and the landing site at touchdown.
  const touchdownMs = Math.round(tLoi + g.orbitToTouchdownS * 1000)
  const moonFix = ephem.moonFixedToInertial(touchdownMs)
  const siteHat = qrot(moonFix, latLonUnit(g.siteLatDeg, g.siteLonDeg))
  let hm = cross(S, siteHat)
  if (norm(hm) < 0.05) hm = cross(S, qrot(moonFix, [0, 0, 1]))
  if (norm(hm) < 0.05) hm = cross(S, [1, 0, 0])

  return {
    liftoffMs: tL,
    padHat,
    pole,
    planeNormal: h,
    azimuthRad: az,
    inclinationRad: Math.acos(clamp(dot(h, pole), -1, 1)),
    coastAngleRad: coastAngle,
    tliMs: tTli,
    tliPoint: P,
    dvTliKms: dvTli,
    transfer: el,
    loiMs: tLoi,
    dvLoiKms: dvLoi,
    vInfKms: vInf,
    lunarPlaneNormal: unit(hm),
    touchdownMs,
    moonDistKm: d,
    cost: ascentCost + dvTli + dvLoi,
  }
}

/** The liftoff with the smallest delta-v whose touchdown falls in [earliest, earliest + 25 h).
 *  shiftMin moves the result off the optimum by that many minutes (mission.ts uses it when the optimum has
 *  no leverage for aiming: the launchpad on the line to the arrival point). */
export function firstGuess(g: GuessInput, shiftMin = 0): Guess {
  if (g.earliestTouchdownMs > g.ephem.endMs) throw new FlightPlanError('The ephemeris does not cover this flight.')
  const candidate = (tL: number): Guess | null => {
    let s: Guess | null
    try {
      s = evaluate(g, tL)
    } catch (err) {
      if (err instanceof RangeError) return null
      throw err
    }
    return s && s.touchdownMs >= g.earliestTouchdownMs && s.touchdownMs < g.earliestTouchdownMs + 25 * HOUR_MS ? s : null
  }
  const tNominal = transferFor(R_EARTH_EQ + g.parkingAltKm, 384400, g.maxTransferDays).T
  const tGuess = g.earliestTouchdownMs + 12 * HOUR_MS - g.orbitToTouchdownS * 1000 - (tNominal - 0.1 * DAY_S) * 1000 - 1.5 * HOUR_MS
  let best: Guess | null = null
  for (let k = -200; k <= 200; k++) {
    const s = candidate(Math.round(tGuess + k * 10 * MIN_MS))
    if (s && (!best || s.cost < best.cost)) best = s
  }
  if (!best) {
    if (tGuess - 34 * HOUR_MS < g.ephem.startMs) throw new FlightPlanError('The ephemeris does not cover this flight (launch is about a week before touchdown).')
    throw new FlightPlanError('No launch opportunity found for this landing time.')
  }
  const f = (x: number) => candidate(Math.round(x))?.cost ?? Infinity
  const fine = candidate(Math.round(goldenMin(f, best.liftoffMs - 10 * MIN_MS, best.liftoffMs + 10 * MIN_MS, 1000)))
  const opt = fine && fine.cost <= best.cost ? fine : best
  if (shiftMin === 0) return opt
  const shifted = candidate(opt.liftoffMs + shiftMin * MIN_MS) ?? evaluate(g, opt.liftoffMs + shiftMin * MIN_MS)
  if (!shifted) throw new FlightPlanError('No launch opportunity found for this landing time.')
  return shifted
}
