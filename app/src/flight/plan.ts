// Flight solver: Earth launchpad → lunar landing site, impulsive burns.
//
// Two stages.
//
// 1. First guess, patched conics (Bate, Mueller, White, Fundamentals of Astrodynamics, ch. 7, with the plane
//    geometry in 3D). For one liftoff instant:
//      - parking orbit in the plane through the launchpad at liftoff and the Moon at arrival: launch azimuth and
//        inclination follow from that plane; the ascent estimate credits Earth's rotation along it;
//      - coast to the point opposite the arrival point and inject (TLI) onto an ellipse whose periapsis is the
//        parking orbit and which reaches the Moon's distance when the Moon is there;
//      - at the Moon's sphere of influence the velocity relative to the Moon gives the hyperbolic excess speed
//        and the lunar orbit insertion (LOI) burn; then a stay in lunar orbit, a descent orbit (DOI) and the
//        powered descent, built backwards from the touchdown instant.
//    planFlight searches the liftoff instant over one day of opportunities for the smallest total delta-v.
//
// 2. The real flight (nbody.ts). From the injection state the path is integrated under the gravity of Earth, the
//    Moon and the Sun. The first guess does not arrive where it should under that gravity (two conics ignore the
//    Moon's pull for most of the way), so the size of the injection burn and the launch azimuth are corrected
//    by Newton iteration until the integrated path has its closest approach to the Moon at the lunar orbit
//    altitude, in a plane that passes over the landing site. The LOI burn is then the difference between
//    the integrated speed at that point and the circular speed. That integrated path is what the plan returns
//    and what is drawn.
//
// If stage 2 does not converge, the plan falls back to stage 1 and says so (plan.model).
import type {
  Burn,
  FlightEphemeris,
  FlightPlan,
  FlightState,
  Launchpad,
  LandingTarget,
  Phase,
  PlanOptions,
  Track,
  Vec3,
  Vehicle,
} from './types'
import { FlightPlanError } from './types'
import {
  MU_EARTH,
  MU_MOON,
  R_EARTH_EQ,
  R_MOON,
  OMEGA_EARTH,
  SOI_MOON,
  G0,
  DAY_S,
  circularSpeed,
  visViva,
  ellipse,
  trueAnomalyAtRadius,
  timeFromPeriapsis,
  trueToEccentric,
  eccentricToTrue,
  radiusAtE,
  perifocal,
  hyperbola,
  hyperbolicTimeFromPeriapsis,
  rocketPropellant,
  bisect,
  goldenMin,
} from './astro'
import type { Ellipse, Hyperbola } from './astro'
import { makeGravity, propagate } from './nbody'
import type { Gravity, Propagation } from './nbody'
import { DEG, TWO_PI, angleWrapUp, add, sub, scale, dot, cross, norm, unit, lerp, combine, rotateAbout, angleAbout, qrot, latLonUnit } from './vec'

const HOUR_MS = 3600000
const MIN_MS = 60000
const NOT_COVERED = 'The ephemeris does not cover this flight (launch is about a week before touchdown).'

const mod2pi = (x: number) => ((x % TWO_PI) + TWO_PI) % TWO_PI
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

interface PlanInput {
  pad: Launchpad
  vehicle: Vehicle
  target: LandingTarget
  options: PlanOptions
  ephem: FlightEphemeris
}

/** Inputs that do not change with the liftoff instant. */
interface Ctx extends PlanInput {
  rPark: number // parking orbit radius, km
  vc: number // parking orbit circular speed, km/s
  nPark: number // parking orbit rate, rad/s
  rLlo: number // low lunar orbit radius, km
  rPdi: number // descent orbit periapsis radius, km
  ascentArc: number // rad
  latRad: number
  siteHat: Vec3 // landing site, Moon-centred J2000 unit vector at touchdown
  moonNorth: Vec3 // Moon spin axis, J2000, at touchdown
}

interface Transfer {
  el: Ellipse // geocentric transfer ellipse
  nuA: number // true anomaly where the transfer reaches the Moon's distance
  T: number // seconds from TLI to that point
}

/** Stay in lunar orbit and descent, fixed by the lunar orbit insertion and the touchdown instant. */
interface Descent {
  descEl: Ellipse
  tPdi: number
  tDoi: number
  dvDoi: number
  dvPdi: number
  thetaPdi: number // rad, in-plane angle of the powered-descent start, from the LOI point
  thetaDoi: number // rad, in-plane angle of the descent orbit insertion
  loiterS: number // seconds in low lunar orbit, LOI to DOI
  N: number // whole revolutions in low lunar orbit
  nLoiter: number // rad/s in low lunar orbit
}

/** Everything one candidate liftoff instant produces in the patched-conic first guess. */
interface Sample extends Descent {
  tL: number
  total: number
  padHat: Vec3
  pole: Vec3 // Earth's spin axis at liftoff, J2000 (about 0.15° from the J2000 pole in the 2020s: precession)
  h: Vec3 // orbit normal, prograde
  P: Vec3 // periapsis direction (TLI point)
  Q: Vec3
  el: Ellipse
  nuA: number
  mHat: Vec3 // Moon direction at arrival
  d: number // Earth–Moon distance at arrival, km
  tTli: number
  coastS: number
  coastAngle: number // rad
  az: number // launch azimuth, rad
  incl: number // parking orbit inclination, rad
  dvAscent: number
  dvTli: number
  ES: number // eccentric anomaly at SOI entry
  tS: number
  rRel: Vec3 // spacecraft relative to Moon at SOI, geocentric transfer
  rRelHyp: Vec3 // same point on the lunar approach hyperbola
  vInf: number
  hm: Vec3 // lunar orbit plane normal
  lunarIncl: number // rad
  hy: Hyperbola
  Pm: Vec3
  Qm: Vec3
  nuS: number
  tLoi: number
  dvLoi: number
}

/** The flight from the parking orbit to the lunar orbit, as buildPlan needs it: from stage 1 or from stage 2. */
interface Arrival extends Descent {
  model: 'n-body' | 'patched-conic'
  h: Vec3 // parking orbit normal
  coastAngle: number
  coastS: number
  tTli: number
  az: number
  incl: number
  dvAscent: number
  dvTli: number
  injection: { r: Vec3; v: Vec3 }
  transfer: Track // Earth-centred, TLI → handover
  handoverMs: number
  approach: Track | null // Moon-centred, handover → LOI (patched conics only)
  tS: number
  tLoi: number
  dvLoi: number
  vInf: number
  hm: Vec3
  Pm: Vec3
  Qm: Vec3
  lunarIncl: number
  d: number
  moonDecl: number // rad, against Earth's equator of date
}

/** Transfer from parking orbit to the Moon's distance d; maxDays caps the flight time. */
function transferFor(rPark: number, d: number, maxDays: number | null): Transfer {
  let el = ellipse(rPark, d)
  if (maxDays !== null) {
    const tMax = maxDays * DAY_S
    // time from periapsis to radius d on an ellipse with apoapsis ra; falls as ra grows
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

/** Stay in lunar orbit and descent for a lunar orbit entered at tLoi at the point Pm, in the plane with normal hm.
 *  Built backwards from touchdown. Null when the stay would be shorter than allowed. */
function descentFor(c: Ctx, Pm: Vec3, hm: Vec3, tLoi: number): Descent | null {
  const { options } = c
  const descEl = ellipse(c.rPdi, c.rLlo)
  const halfPeriod = Math.PI * Math.sqrt(descEl.a ** 3 / MU_MOON)
  const tPdi = options.landingMs - options.descentTimeS * 1000
  const tDoi = Math.round(tPdi - halfPeriod * 1000)
  const dvDoi = circularSpeed(MU_MOON, c.rLlo) - visViva(MU_MOON, c.rLlo, descEl.a)
  const dvPdi = visViva(MU_MOON, c.rPdi, descEl.a) + options.descentLossKms
  const siteInPlane = unit(sub(c.siteHat, scale(hm, dot(c.siteHat, hm))))
  const thetaSite = angleAbout(Pm, siteInPlane, hm)
  const thetaPdi = mod2pi(thetaSite - options.descentArcDeg * DEG)
  const thetaDoi = mod2pi(thetaPdi - Math.PI)

  // Whole revolutions at about the circular rate; the phase is met by a small change of the period (not costed).
  const loiterS = (tDoi - tLoi) / 1000
  if (loiterS < options.minLoiterH * 3600) return null
  const nC = circularSpeed(MU_MOON, c.rLlo) / c.rLlo
  const N = Math.max(0, Math.round((nC * loiterS - thetaDoi) / TWO_PI))
  const nLoiter = (thetaDoi + TWO_PI * N) / loiterS
  return { descEl, tPdi, tDoi, dvDoi, dvPdi, thetaPdi, thetaDoi, loiterS, N, nLoiter }
}

/** Launch azimuth, inclination and the ascent delta-v estimate for a parking orbit with normal h through the pad.
 *  The rocket supplies the gap between the orbital velocity and the pad's eastward speed, plus the assumed losses. */
function launchGeometry(c: Ctx, padHat: Vec3, pole: Vec3, h: Vec3) {
  const east = unit(cross(pole, padHat))
  const north = cross(padHat, east)
  const vHat = cross(h, padHat)
  const az = mod2pi(Math.atan2(dot(vHat, east), dot(vHat, north)))
  const incl = Math.acos(clamp(dot(h, pole), -1, 1))
  const ve = OMEGA_EARTH * R_EARTH_EQ * Math.cos(c.latRad)
  const dvAscent = Math.sqrt(c.vc * c.vc + ve * ve - 2 * c.vc * ve * Math.sin(az)) + c.vehicle.ascentLossKms
  return { az, incl, dvAscent }
}

/** Stage 1: the whole chain of burns for one liftoff instant tL (UTC ms), patched conics. Null when infeasible. */
function evaluate(c: Ctx, tL: number): Sample | null {
  const { ephem, options, vehicle } = c
  const qEarth = ephem.earthFixedToInertial(tL)
  const padHat = qrot(qEarth, latLonUnit(c.pad.latDeg, c.pad.lonDeg))
  const pole = qrot(qEarth, [0, 0, 1]) // inclination, azimuth and declination refer to the equator of date
  const ascentMs = vehicle.ascentTimeS * 1000

  // Fixed-point iteration: aim the transfer at the Moon where it will be on arrival.
  let tA = tL + ascentMs + (2700 + 4.98 * DAY_S) * 1000
  let tr = transferFor(c.rPark, norm(ephem.moonPos(tA)), options.maxTransferDays)
  let mHat: Vec3 = [1, 0, 0]
  let d = 0
  let h: Vec3 = [0, 0, 1]
  let P: Vec3 = [1, 0, 0]
  let Q: Vec3 = [0, 1, 0]
  let coastAngle = 0
  let coastS = 0
  let tTli = tL
  for (let pass = 0; pass < 5; pass++) {
    const mPos = ephem.moonPos(tA)
    d = norm(mPos)
    mHat = unit(mPos)
    tr = transferFor(c.rPark, d, options.maxTransferDays)
    const cr = cross(padHat, mHat)
    if (norm(cr) < 1e-3) return null
    h = unit(cr)
    if (dot(h, pole) < 0) h = scale(h, -1) // prograde launch
    P = rotateAbout(mHat, h, -tr.nuA) // TLI happens at periapsis
    Q = cross(h, P)
    coastAngle = angleAbout(padHat, P, h) - c.ascentArc
    coastAngle = angleWrapUp(coastAngle, 5 * DEG, TWO_PI)
    coastS = coastAngle / c.nPark
    tTli = Math.round(tL + ascentMs + coastS * 1000)
    tA = tTli + tr.T * 1000
  }
  const el = tr.el
  const { az, incl, dvAscent } = launchGeometry(c, padHat, pole, h)
  const dvTli = visViva(MU_EARTH, c.rPark, el.a) - c.vc

  // Sphere-of-influence entry: where the geocentric transfer crosses the Moon's SOI
  const tAt = (E: number) => tTli + Math.sqrt(el.a ** 3 / MU_EARTH) * (E - el.e * Math.sin(E)) * 1000
  const posAt = (E: number) => perifocal(el, MU_EARTH, eccentricToTrue(el.e, E), P, Q)
  const gap = (E: number) => norm(sub(posAt(E).r, ephem.moonPos(tAt(E)))) - SOI_MOON
  const EA = trueToEccentric(el.e, tr.nuA)
  const ELo = Math.acos(clamp((1 - (0.5 * d) / el.a) / el.e, -1, 1))
  if (gap(ELo) <= 0 || gap(EA) >= 0) return null
  const ES = bisect(gap, ELo, EA)
  const tS = Math.round(tAt(ES))
  const sp = posAt(ES)
  const rRel = sub(sp.r, ephem.moonPos(tS))
  const vRel = sub(sp.v, ephem.moonVel(tS))
  const v2 = dot(vRel, vRel) - (2 * MU_MOON) / SOI_MOON // energy relative to the Moon at SOI
  if (v2 <= 0) return null
  const vInf = Math.sqrt(v2)
  const S = unit(vRel) // direction of flight relative to the Moon at SOI entry

  // Lunar orbit plane contains the incoming direction and the landing site
  let hm = cross(S, c.siteHat)
  if (norm(hm) < 0.05) hm = cross(S, c.moonNorth)
  if (norm(hm) < 0.05) hm = cross(S, [1, 0, 0])
  hm = unit(hm)
  const lunarIncl = Math.acos(clamp(dot(hm, c.moonNorth), -1, 1))

  // Approach hyperbola, Moon-centred, periapsis at the lunar orbit radius. It is turned in its plane so that its
  // velocity at SOI entry has the direction S: on a conic the velocity at true anomaly ν points along
  // (−sin ν, e + cos ν) in the perifocal frame. The speed there already matches (same energy).
  const hy = hyperbola(MU_MOON, vInf, c.rLlo)
  const nuS = -Math.acos(clamp((hy.p / SOI_MOON - 1) / hy.e, -1, 1))
  const Pm = rotateAbout(S, hm, -Math.atan2(hy.e + Math.cos(nuS), -Math.sin(nuS)))
  const Qm = cross(hm, Pm)
  const tLoi = Math.round(tS + hyperbolicTimeFromPeriapsis(MU_MOON, hy, nuS) * 1000)
  const rRelHyp = scale(combine(Pm, Math.cos(nuS), Qm, Math.sin(nuS)), SOI_MOON)
  const dvLoi = Math.sqrt(vInf * vInf + (2 * MU_MOON) / c.rLlo) - circularSpeed(MU_MOON, c.rLlo)

  const descent = descentFor(c, Pm, hm, tLoi)
  if (!descent) return null
  const total = dvAscent + dvTli + dvLoi + descent.dvDoi + descent.dvPdi
  return {
    ...descent,
    tL, total, padHat, pole, h, P, Q, el, nuA: tr.nuA, mHat, d, tTli, coastS, coastAngle, az, incl, dvAscent, dvTli,
    ES, tS, rRel, rRelHyp, vInf, hm, lunarIncl, hy, Pm, Qm, nuS, tLoi, dvLoi,
  }
}

/** Accumulates samples and drops any whose instant does not advance (shared end points between segments). */
class TrackBuilder {
  t: number[] = []
  p: Vec3[] = []
  push(tMs: number, pos: Vec3) {
    const ti = Math.round(tMs)
    if (this.t.length > 0 && ti <= this.t[this.t.length - 1]) return
    this.t.push(ti)
    this.p.push(pos)
  }
  track(): Track {
    return { t: this.t, p: this.p }
  }
}

/** Stage 1 as an Arrival: the transfer ellipse up to the sphere of influence, then the approach hyperbola. */
function patchedArrival(s: Sample): Arrival {
  const { el, P, Q } = s
  const transfer = new TrackBuilder()
  const delta = sub(s.rRelHyp, s.rRel) // aim-point correction, from the Moon's centre to the hyperbola
  const nTr = 240
  for (let i = 0; i < nTr; i++) {
    const E = (s.ES * i) / (nTr - 1)
    const sp = perifocal(el, MU_EARTH, eccentricToTrue(el.e, E), P, Q)
    const t = i === nTr - 1 ? s.tS : s.tTli + Math.sqrt(el.a ** 3 / MU_EARTH) * (E - el.e * Math.sin(E)) * 1000
    const u = (t - s.tTli) / (s.tS - s.tTli)
    transfer.push(t, add(sp.r, scale(delta, u * u * (3 - 2 * u))))
  }
  const approach = new TrackBuilder()
  const { hy, Pm, Qm, nuS, tLoi, tS } = s
  const FS = Math.acosh(Math.max(1, (hy.e + Math.cos(nuS)) / (1 + hy.e * Math.cos(nuS))))
  const kH = Math.sqrt(hy.a ** 3 / MU_MOON)
  const kT = Math.sqrt((hy.e + 1) / (hy.e - 1))
  const nHyp = 80
  for (let i = 0; i < nHyp; i++) {
    const F = FS * (1 - i / (nHyp - 1))
    const nu = -2 * Math.atan(kT * Math.tanh(F / 2))
    const r = hy.a * (hy.e * Math.cosh(F) - 1)
    const t = i === 0 ? tS : tLoi - kH * (hy.e * Math.sinh(F) - F) * 1000
    approach.push(t, scale(combine(Pm, Math.cos(nu), Qm, Math.sin(nu)), r))
  }
  const start = perifocal(el, MU_EARTH, 0, P, Q)
  return {
    ...s,
    model: 'patched-conic',
    injection: { r: start.r, v: start.v },
    transfer: transfer.track(),
    handoverMs: tS,
    approach: approach.track(),
    moonDecl: Math.asin(clamp(dot(s.mHat, s.pole), -1, 1)),
  }
}

/** One integrated flight from an injection that differs from the first guess by dDv (size of the injection
 *  burn, km/s) and dAz (parking orbit plane turned about the launchpad direction, rad). */
interface Shot {
  h: Vec3
  dvTli: number
  r0: Vec3
  v0: Vec3
  run: Propagation
  rp: number // perilune radius, km
  vInf2: number
  hm: Vec3 // plane of the flyby
  Pm: Vec3 // perilune direction
  miss: [number, number] // B-plane miss, km: where the approach aims minus where it should aim
  offPlane: number // sine of the angle between the landing site and the flyby plane
}

/** Stage 2: corrects the first guess s by shooting in the full gravity field. Null when it does not converge.
 *
 *  What is aimed is the B vector: the point where the incoming asymptote of the flyby pierces the plane through
 *  the Moon's centre perpendicular to it. Its length fixes the perilune radius, its direction the flyby plane.
 *  Two controls move it. The size of the injection burn raises or lowers the far end of the transfer, which
 *  moves the aim point within the transfer plane (about 3,500 km per m/s). Turning the parking orbit plane
 *  about the launchpad direction, which is a small change of launch azimuth, moves it out of that plane.
 *  (The injection point along the parking orbit is left as the first guess has it: it shifts the arrival
 *  along the Moon's own path, which changes when the flight arrives, not where it aims.) */
function integratedArrival(c: Ctx, s: Sample): Arrival | null {
  let g: Gravity
  try {
    g = makeGravity(c.ephem, s.tTli - 2 * HOUR_MS, c.options.landingMs + HOUR_MS)
  } catch (err) {
    if (err instanceof RangeError) return null
    throw err
  }
  const maxSeconds = (s.tLoi - s.tTli) / 1000 + 1.5 * DAY_S
  const theta = c.ascentArc + s.coastAngle // angle from the pad to the injection point
  const siteDegenerate = (S: Vec3) => norm(sub(c.siteHat, scale(S, dot(c.siteHat, S)))) < 0.05

  const shoot = (dDv: number, dAz: number): Shot | null => {
    const h = unit(rotateAbout(s.h, s.padHat, dAz)) // still contains the pad: only the launch azimuth changes
    const dir = rotateAbout(s.padHat, h, theta)
    const dvTli = s.dvTli + dDv
    const r0 = scale(dir, c.rPark)
    const v0 = scale(cross(h, dir), c.vc + dvTli)
    let run: Propagation
    try {
      run = propagate(g, { r: r0, v: v0 }, s.tTli, { maxSeconds, stopAtPerilune: true })
    } catch (err) {
      if (err instanceof RangeError) return null
      throw err
    }
    const per = run.perilune
    if (!per) return null
    // Osculating hyperbola at the perilune (there r ⟂ v, so the perilune is its periapsis).
    const rp = norm(per.rRel)
    const vInf2 = dot(per.vRel, per.vRel) - (2 * MU_MOON) / rp
    if (vInf2 <= 0) return null
    const hm = unit(cross(per.rRel, per.vRel))
    const Pm = unit(per.rRel)
    const e = 1 + (rp * vInf2) / MU_MOON
    const S = combine(Pm, 1 / e, cross(hm, Pm), Math.sqrt(1 - 1 / (e * e))) // incoming asymptote direction
    const B = scale(cross(S, hm), (MU_MOON / vInf2) * Math.sqrt(e * e - 1))
    // Where it should aim: at the distance that puts the periapsis on the lunar orbit radius, on the side that
    // makes the flyby plane (spanned by S and B) pass over the landing site.
    const side = siteDegenerate(S) ? sub(c.moonNorth, scale(S, dot(c.moonNorth, S))) : sub(c.siteHat, scale(S, dot(c.siteHat, S)))
    let bHat = unit(side)
    if (dot(cross(bHat, S), s.hm) < 0) bHat = scale(bHat, -1) // the same sense of rotation as the first guess
    const bTarget = Math.sqrt(c.rLlo * c.rLlo + (2 * MU_MOON * c.rLlo) / vInf2)
    const miss = sub(B, scale(bHat, bTarget)) // lies in the plane ⟂ S
    // Two components in that plane, in a basis that turns smoothly with S.
    let T = cross(S, c.moonNorth)
    if (norm(T) < 0.05) T = cross(S, [1, 0, 0])
    T = unit(T)
    return {
      h, dvTli, r0, v0, run, rp, vInf2, hm, Pm,
      miss: [dot(miss, T), dot(miss, cross(S, T))],
      offPlane: siteDegenerate(S) ? 0 : Math.abs(dot(hm, c.siteHat)),
    }
  }

  // Newton iteration on the two components of the miss, with a step limit and backtracking.
  const size = (sh: Shot) => Math.hypot(sh.miss[0], sh.miss[1])
  const STEP_DV = 1e-6 // km/s: one millimetre per second, a few kilometres at the Moon
  const STEP_AZ = 2e-6 // rad
  const MAX_DV = 0.004 // km/s per iteration
  const MAX_AZ = 0.03 // rad per iteration
  const TOL_KM = 0.01
  let x: [number, number] = [0, 0]
  let cur = shoot(0, 0)
  if (!cur) return null
  for (let iter = 0; iter < 25 && size(cur) > TOL_KM; iter++) {
    const f0 = cur.miss
    const a = shoot(x[0] + STEP_DV, x[1])
    const b = shoot(x[0], x[1] + STEP_AZ)
    if (!a || !b) return null
    const j11 = (a.miss[0] - f0[0]) / STEP_DV
    const j21 = (a.miss[1] - f0[1]) / STEP_DV
    const j12 = (b.miss[0] - f0[0]) / STEP_AZ
    const j22 = (b.miss[1] - f0[1]) / STEP_AZ
    const det = j11 * j22 - j12 * j21
    // The azimuth has no leverage when the pad lies on the line to the arrival point.
    if (Math.abs(det) < 1e-4 * Math.hypot(j11, j21) * Math.hypot(j12, j22)) return null
    let dx0 = -(j22 * f0[0] - j12 * f0[1]) / det
    let dx1 = -(-j21 * f0[0] + j11 * f0[1]) / det
    const over = Math.max(Math.abs(dx0) / MAX_DV, Math.abs(dx1) / MAX_AZ, 1)
    dx0 /= over
    dx1 /= over
    let next: Shot | null = null
    for (let half = 0; half < 12; half++) {
      const tryShot = shoot(x[0] + dx0, x[1] + dx1)
      if (tryShot && size(tryShot) < size(cur)) {
        next = tryShot
        break
      }
      dx0 /= 2
      dx1 /= 2
    }
    if (!next) return null
    x = [x[0] + dx0, x[1] + dx1]
    cur = next
  }
  // Accept only a flight that really arrives: at the lunar orbit radius, in a plane over the landing site.
  if (Math.abs(cur.rp - c.rLlo) > 0.5 || cur.offPlane > 1e-3) return null

  const per = cur.run.perilune!
  const tLoi = Math.round(per.utcMs)
  const descent = descentFor(c, cur.Pm, cur.hm, tLoi)
  if (!descent) return null

  // The integrated path, and the instant it enters the Moon's sphere of influence (for the phase label).
  const transfer = new TrackBuilder()
  let tS = tLoi
  let prevGap = Infinity
  for (let i = 0; i < cur.run.t.length; i++) {
    const t = i === cur.run.t.length - 1 ? tLoi : cur.run.t[i]
    transfer.push(t, cur.run.r[i])
    const gap = norm(sub(cur.run.r[i], g.moonState(cur.run.t[i]).r)) - SOI_MOON
    if (tS === tLoi && prevGap > 0 && gap <= 0 && i > 0) {
      const f = prevGap / (prevGap - gap)
      tS = Math.round(cur.run.t[i - 1] + f * (cur.run.t[i] - cur.run.t[i - 1]))
    }
    prevGap = gap
  }
  const moonAtLoi = g.moonState(per.utcMs).r
  return {
    ...descent,
    ...launchGeometry(c, s.padHat, s.pole, cur.h),
    model: 'n-body',
    h: cur.h,
    coastAngle: s.coastAngle,
    coastS: s.coastS,
    tTli: s.tTli,
    dvTli: cur.dvTli,
    injection: { r: cur.r0, v: cur.v0 },
    transfer: transfer.track(),
    handoverMs: tLoi,
    approach: null,
    tS,
    tLoi,
    dvLoi: norm(per.vRel) - circularSpeed(MU_MOON, cur.rp),
    vInf: Math.sqrt(cur.vInf2),
    hm: cur.hm,
    Pm: cur.Pm,
    Qm: cross(cur.hm, cur.Pm),
    lunarIncl: Math.acos(clamp(dot(cur.hm, c.moonNorth), -1, 1)),
    d: norm(moonAtLoi),
    moonDecl: Math.asin(clamp(dot(unit(moonAtLoi), s.pole), -1, 1)),
  }
}

function buildPlan(c: Ctx, s: Sample, a: Arrival): FlightPlan {
  const { pad, vehicle, target, options } = c
  const { padHat } = s
  const ascentMs = vehicle.ascentTimeS * 1000

  // Earth-centred track: ascent and parking coast (drawn, not integrated), then the transfer
  const geo = new TrackBuilder()
  const nAsc = 30
  for (let i = 0; i < nAsc; i++) {
    const f = i / (nAsc - 1)
    const radius = R_EARTH_EQ + vehicle.parkingAltKm * (1 - (1 - f) ** 2)
    geo.push(s.tL + f * ascentMs, scale(rotateAbout(padHat, a.h, c.ascentArc * f * f), radius))
  }
  const nCoast = Math.max(1, Math.ceil(a.coastAngle / (3 * DEG)))
  for (let k = 1; k <= nCoast; k++) {
    const f = k / nCoast
    geo.push(a.tTli - (1 - f) * a.coastS * 1000, scale(rotateAbout(padHat, a.h, c.ascentArc + a.coastAngle * f), c.rPark))
  }
  for (let i = 0; i < a.transfer.t.length; i++) geo.push(a.transfer.t[i], a.transfer.p[i])

  // Moon-centred track: (patched conics: approach hyperbola,) low lunar orbit, descent orbit, powered descent
  const seleno = new TrackBuilder()
  const { Pm, Qm, tLoi } = a
  if (a.approach) for (let i = 0; i < a.approach.t.length; i++) seleno.push(a.approach.t[i], a.approach.p[i])
  else seleno.push(tLoi, scale(Pm, c.rLlo))
  const lunarTotal = a.thetaDoi + TWO_PI * a.N
  for (let ang = 5 * DEG; ang < lunarTotal - 1e-9; ang += 5 * DEG) {
    seleno.push(tLoi + (ang / a.nLoiter) * 1000, scale(combine(Pm, Math.cos(ang), Qm, Math.sin(ang)), c.rLlo))
  }
  seleno.push(a.tDoi, scale(combine(Pm, Math.cos(lunarTotal), Qm, Math.sin(lunarTotal)), c.rLlo))
  const de = a.descEl
  const kD = Math.sqrt(de.a ** 3 / MU_MOON)
  const nDesc = 60
  for (let i = 0; i < nDesc; i++) {
    // from apolune (E = π) to perilune (E = 0), in-plane angle thetaDoi → thetaPdi
    const E = Math.PI * (1 - i / (nDesc - 1))
    const nu = eccentricToTrue(de.e, E)
    const r = radiusAtE(de, E)
    const th = a.thetaPdi - nu
    seleno.push(a.tPdi - kD * (E - de.e * Math.sin(E)) * 1000, scale(combine(Pm, Math.cos(th), Qm, Math.sin(th)), r))
  }
  const nPd = 40
  const descentArc = options.descentArcDeg * DEG
  for (let i = 0; i < nPd; i++) {
    const f = i / (nPd - 1)
    const ang = a.thetaPdi + descentArc * (2 * f - f * f)
    const r = R_MOON + options.pdiAltKm * (1 - f) ** 2
    seleno.push(a.tPdi + f * options.descentTimeS * 1000, scale(combine(Pm, Math.cos(ang), Qm, Math.sin(ang)), r))
  }
  // exact touchdown point on the surface
  seleno.p[seleno.p.length - 1] = scale(c.siteHat, R_MOON)

  // Burns and masses
  const tliEng = vehicle.tliEngine
  const tliProp = rocketPropellant(vehicle.injectedMassKg + vehicle.tliStageDryKg, a.dvTli, tliEng.ispS)
  const tliDur = tliEng.thrustN ? (tliProp * G0 * tliEng.ispS) / tliEng.thrustN : null
  const sc = vehicle.spacecraftEngine
  const burnSc = (mIn: number, dv: number) => {
    const mOut = mIn * Math.exp(-(dv * 1000) / (G0 * sc.ispS))
    const prop = mIn - mOut
    return { mOut, prop, dur: sc.thrustN ? (prop * G0 * sc.ispS) / sc.thrustN : null }
  }
  const loi = burnSc(vehicle.injectedMassKg, a.dvLoi)
  const doi = burnSc(loi.mOut, a.dvDoi)
  const pdi = burnSc(doi.mOut, a.dvPdi)

  const burns: Burn[] = [
    { id: 'ascent', label: 'Ascent to parking orbit', short: 'Ascent', utcMs: s.tL, dvKms: a.dvAscent, estimate: true,
      propellantKg: null, durationS: null, massAfterKg: null },
    { id: 'tli', label: 'Trans-lunar injection', short: 'TLI', utcMs: a.tTli, dvKms: a.dvTli, estimate: false,
      propellantKg: tliProp, durationS: tliDur, massAfterKg: vehicle.injectedMassKg },
    { id: 'loi', label: 'Lunar orbit insertion', short: 'LOI', utcMs: a.tLoi, dvKms: a.dvLoi, estimate: false,
      propellantKg: loi.prop, durationS: loi.dur, massAfterKg: loi.mOut },
    { id: 'doi', label: 'Descent orbit insertion', short: 'DOI', utcMs: a.tDoi, dvKms: a.dvDoi, estimate: false,
      propellantKg: doi.prop, durationS: doi.dur, massAfterKg: doi.mOut },
    { id: 'pdi', label: 'Powered descent', short: 'PDI', utcMs: a.tPdi, dvKms: a.dvPdi, estimate: true,
      propellantKg: pdi.prop, durationS: pdi.dur, massAfterKg: pdi.mOut },
  ]
  const dvInSpaceKms = a.dvTli + a.dvLoi + a.dvDoi + a.dvPdi

  const launchMs = s.tL
  const ascentEnd = launchMs + ascentMs
  const phases: Phase[] = [
    { id: 'ascent', label: 'Ascent', startMs: launchMs, endMs: ascentEnd },
    { id: 'parking', label: 'Parking orbit', startMs: ascentEnd, endMs: a.tTli },
    { id: 'transfer', label: 'Coast to the Moon', startMs: a.tTli, endMs: a.tS },
    { id: 'approach', label: 'Lunar approach', startMs: a.tS, endMs: a.tLoi },
    { id: 'orbit', label: 'Lunar orbit', startMs: a.tLoi, endMs: a.tDoi },
    { id: 'descent', label: 'Descent', startMs: a.tDoi, endMs: options.landingMs },
  ]

  return {
    pad,
    vehicle,
    target,
    options,
    ephem: c.ephem,
    model: a.model,
    injection: a.injection,
    launchMs,
    tliMs: a.tTli,
    soiMs: a.tS,
    loiMs: a.tLoi,
    doiMs: a.tDoi,
    pdiMs: a.tPdi,
    landingMs: options.landingMs,
    launchAzimuthDeg: a.az / DEG,
    parkingInclDeg: a.incl / DEG,
    parkingCoastS: a.coastS,
    transferDays: (a.tLoi - a.tTli) / (DAY_S * 1000),
    moonDistKm: a.d,
    moonDeclDeg: a.moonDecl / DEG,
    vInfKms: a.vInf,
    lunarInclDeg: a.lunarIncl / DEG,
    loiterH: (a.tDoi - a.tLoi) / HOUR_MS,
    lunarRevs: a.N,
    burns,
    dvInSpaceKms,
    dvTotalKms: dvInSpaceKms + a.dvAscent,
    landedMassKg: pdi.mOut,
    phases,
    handoverMs: a.handoverMs,
    geo: geo.track(),
    seleno: seleno.track(),
  }
}

function solve(input: PlanInput): FlightPlan {
  const { pad, vehicle, target, options, ephem } = input
  const rPark = R_EARTH_EQ + vehicle.parkingAltKm
  const vc = circularSpeed(MU_EARTH, rPark)
  const moonFix = ephem.moonFixedToInertial(options.landingMs)
  const c: Ctx = {
    ...input,
    rPark,
    vc,
    nPark: vc / rPark,
    rLlo: R_MOON + options.lloAltKm,
    rPdi: R_MOON + options.pdiAltKm,
    ascentArc: vehicle.ascentArcDeg * DEG,
    latRad: pad.latDeg * DEG,
    siteHat: qrot(moonFix, latLonUnit(target.latDeg, target.lonDeg)),
    moonNorth: qrot(moonFix, [0, 0, 1]),
  }

  if (options.landingMs > ephem.endMs) throw new FlightPlanError(NOT_COVERED)

  // The launch geometry repeats every day, and a later liftoff only shortens the stay in lunar orbit. So the
  // search covers exactly one day of opportunities: the liftoffs whose stay in lunar orbit is between the
  // shortest allowed one and a day more. A liftoff the ephemeris does not reach is not an opportunity.
  const maxLoiterS = (options.minLoiterH + 24) * 3600
  const candidate = (tL: number): Sample | null => {
    let s: Sample | null
    try {
      s = evaluate(c, tL)
    } catch (err) {
      if (err instanceof RangeError) return null
      throw err
    }
    return s && s.loiterS <= maxLoiterS ? s : null
  }

  // Centre of the scan: the nominal transfer (Moon at its mean distance) and a stay in the middle of that day.
  // The real transfer is up to half a day shorter or longer with the Moon's distance, hence ±30 h.
  const tNominal = transferFor(rPark, 384400, options.maxTransferDays).T
  const tGuess = options.landingMs - options.descentTimeS * 1000 - 57 * MIN_MS - (options.minLoiterH + 12) * HOUR_MS -
    (tNominal - 0.1 * DAY_S) * 1000 - 1.5 * HOUR_MS

  // Coarse scan in 10 min steps, then golden section to 1 s around the best step.
  let best: Sample | null = null
  for (let k = -180; k <= 180; k++) {
    const s = candidate(Math.round(tGuess + k * 10 * MIN_MS))
    if (s && (!best || s.total < best.total)) best = s
  }
  if (!best) {
    if (tGuess - 30 * HOUR_MS < ephem.startMs) throw new FlightPlanError(NOT_COVERED)
    throw new FlightPlanError('No launch opportunity found for this landing time.')
  }
  const f = (x: number) => candidate(Math.round(x))?.total ?? Infinity
  const refined = candidate(Math.round(goldenMin(f, best.tL - 10 * MIN_MS, best.tL + 10 * MIN_MS, 1000)))
  const sample = refined && refined.total <= best.total ? refined : best

  // Stage 2 on the best liftoff. When the launchpad lies on the line to the arrival point (the Moon's declination
  // at arrival close to the pad's latitude), the launch azimuth cannot move the aim point and the shooting
  // fails. A liftoff some minutes earlier or later turns the pad off that line and costs a few m/s of ascent.
  let arrival = integratedArrival(c, sample)
  if (arrival) return buildPlan(c, sample, arrival)
  for (const minutes of [20, -20, 40, -40, 60, -60, 90, -90, 120, -120]) {
    const other = candidate(sample.tL + minutes * MIN_MS)
    arrival = other && integratedArrival(c, other)
    if (other && arrival) return buildPlan(c, other, arrival)
  }
  return buildPlan(c, sample, patchedArrival(sample))
}

/** Plans the flight. Throws FlightPlanError when no launch opportunity exists or the ephemeris does not cover it. */
export function planFlight(input: PlanInput): FlightPlan {
  try {
    return solve(input)
  } catch (err) {
    if (err instanceof RangeError) throw new FlightPlanError(NOT_COVERED)
    throw err
  }
}

/** Linear interpolation along a track at UTC ms; null outside [t[0], t[last]]. */
export function sampleTrack(track: Track, utcMs: number): Vec3 | null {
  const { t, p } = track
  const n = t.length
  if (n === 0 || utcMs < t[0] || utcMs > t[n - 1]) return null
  if (utcMs === t[n - 1]) return p[n - 1]
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (t[mid] <= utcMs) lo = mid
    else hi = mid
  }
  return lerp(p[lo], p[hi], (utcMs - t[lo]) / (t[hi] - t[lo]))
}

/** Position and frame at a UTC instant; the instant is clamped to the flight. */
export function flightStateAt(plan: FlightPlan, utcMs: number): FlightState {
  const t = Math.min(plan.landingMs, Math.max(plan.launchMs, utcMs))
  const earth = t <= plan.handoverMs
  const track = earth ? plan.geo : plan.seleno
  const pos = sampleTrack(track, t) ?? track.p[earth ? 0 : track.p.length - 1]
  let phase = plan.phases[0].id
  for (const ph of plan.phases) if (t >= ph.startMs) phase = ph.id
  return { frame: earth ? 'earth' : 'moon', pos, phase }
}
