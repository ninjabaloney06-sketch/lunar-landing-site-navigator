// Flight solver: Earth launchpad → lunar landing site, patched conics with impulsive burns.
// planFlight searches the liftoff instant; each candidate is evaluated by evaluate(), and the best one is
// turned into a FlightPlan with sampled tracks for drawing.
//
// The chain for one liftoff instant (Bate, Mueller, White, Fundamentals of Astrodynamics, ch. 7, "lunar
// trajectories", with the plane geometry in 3D):
//   1. Parking orbit in the plane through the launchpad at liftoff and the Moon at arrival: the launch azimuth
//      and the inclination follow from that plane; the ascent estimate credits Earth's rotation along it.
//   2. Coast to the point opposite the arrival point and inject (TLI) onto an ellipse whose periapsis is the
//      parking orbit and which reaches the Moon's distance when the Moon is there.
//   3. At the Moon's sphere of influence the velocity relative to the Moon gives the hyperbolic excess speed;
//      the approach hyperbola has its periapsis at the lunar orbit altitude, in the plane through the incoming
//      velocity and the landing site at touchdown (aim point moved by a negligible mid-course correction).
//   4. Insert into the circular lunar orbit (LOI), stay until the phase is right, lower the periapsis (DOI),
//      brake from the periapsis to the surface (powered descent).
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
import { DEG, TWO_PI, add, sub, scale, dot, cross, norm, unit, lerp, combine, rotateAbout, angleAbout, qrot, latLonUnit } from './vec'

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

/** Everything one candidate liftoff instant produces. */
interface Sample {
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
  descEl: Ellipse
  tPdi: number
  tDoi: number
  dvDoi: number
  dvPdi: number
  thetaPdi: number // rad, in-plane angle of the PDI point
  thetaDoi: number // rad, in-plane angle of the DOI point
  loiterS: number // seconds in low lunar orbit, LOI to DOI
  N: number // whole revolutions in low lunar orbit
  nLoiter: number // rad/s in low lunar orbit
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

/** Solves the whole chain of burns for one liftoff instant tL (UTC ms). Null when infeasible. */
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
    while (coastAngle < 5 * DEG) coastAngle += TWO_PI
    coastS = coastAngle / c.nPark
    tTli = Math.round(tL + ascentMs + coastS * 1000)
    tA = tTli + tr.T * 1000
  }
  const el = tr.el

  // Launch geometry and the ascent delta-v estimate (rocket supplies the gap to the pad's eastward speed)
  const east = unit(cross(pole, padHat))
  const north = cross(padHat, east)
  const vHat = cross(h, padHat)
  const az = mod2pi(Math.atan2(dot(vHat, east), dot(vHat, north)))
  const incl = Math.acos(clamp(dot(h, pole), -1, 1))
  const ve = OMEGA_EARTH * R_EARTH_EQ * Math.cos(c.latRad)
  const dvAscent = Math.sqrt(c.vc * c.vc + ve * ve - 2 * c.vc * ve * Math.sin(az)) + vehicle.ascentLossKms

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
  // (−sin ν, e + cos ν) in the perifocal frame. The speed there already matches (same energy), so the velocity is
  // continuous across the patch; only the aim point differs (delta in buildPlan).
  const hy = hyperbola(MU_MOON, vInf, c.rLlo)
  const nuS = -Math.acos(clamp((hy.p / SOI_MOON - 1) / hy.e, -1, 1))
  const Pm = rotateAbout(S, hm, -Math.atan2(hy.e + Math.cos(nuS), -Math.sin(nuS)))
  const Qm = cross(hm, Pm)
  const tLoi = Math.round(tS + hyperbolicTimeFromPeriapsis(MU_MOON, hy, nuS) * 1000)
  const rRelHyp = scale(combine(Pm, Math.cos(nuS), Qm, Math.sin(nuS)), SOI_MOON)
  const dvLoi = Math.sqrt(vInf * vInf + (2 * MU_MOON) / c.rLlo) - circularSpeed(MU_MOON, c.rLlo)

  // Descent orbit, built backwards from touchdown
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

  // Loiter: whole revolutions at circular rate, phasing absorbed by a small change of period
  const dtS = (tDoi - tLoi) / 1000
  if (dtS < options.minLoiterH * 3600) return null
  const nC = circularSpeed(MU_MOON, c.rLlo) / c.rLlo
  const N = Math.max(0, Math.round((nC * dtS - thetaDoi) / TWO_PI))
  const nLoiter = (thetaDoi + TWO_PI * N) / dtS

  const total = dvAscent + dvTli + dvLoi + dvDoi + dvPdi
  return {
    tL, total, padHat, pole, h, P, Q, el, nuA: tr.nuA, mHat, d, tTli, coastS, coastAngle, az, incl, dvAscent, dvTli,
    ES, tS, rRel, rRelHyp, vInf, hm, lunarIncl, hy, Pm, Qm, nuS, tLoi, dvLoi, descEl, tPdi, tDoi, dvDoi, dvPdi,
    thetaPdi, thetaDoi, loiterS: dtS, N, nLoiter,
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

function buildPlan(c: Ctx, s: Sample): FlightPlan {
  const { pad, vehicle, target, options } = c
  const { padHat, h, P, Q, el } = s
  const ascentMs = vehicle.ascentTimeS * 1000

  // Earth-centred track: ascent, parking coast, transfer to the SOI
  const geo = new TrackBuilder()
  const nAsc = 30
  for (let i = 0; i < nAsc; i++) {
    const f = i / (nAsc - 1)
    const radius = R_EARTH_EQ + vehicle.parkingAltKm * (1 - (1 - f) ** 2)
    geo.push(s.tL + f * ascentMs, scale(rotateAbout(padHat, h, c.ascentArc * f * f), radius))
  }
  const nCoast = Math.max(1, Math.ceil(s.coastAngle / (3 * DEG)))
  for (let k = 1; k <= nCoast; k++) {
    const f = k / nCoast
    geo.push(s.tTli - (1 - f) * s.coastS * 1000, scale(rotateAbout(padHat, h, c.ascentArc + s.coastAngle * f), c.rPark))
  }
  const delta = sub(s.rRelHyp, s.rRel) // aim-point correction, from the Moon's centre to the hyperbola
  const nTr = 240
  for (let i = 0; i < nTr; i++) {
    const E = (s.ES * i) / (nTr - 1)
    const sp = perifocal(el, MU_EARTH, eccentricToTrue(el.e, E), P, Q)
    const t = s.tTli + Math.sqrt(el.a ** 3 / MU_EARTH) * (E - el.e * Math.sin(E)) * 1000
    const u = (t - s.tTli) / (s.tS - s.tTli)
    geo.push(t, add(sp.r, scale(delta, u * u * (3 - 2 * u))))
  }

  // Moon-centred track: approach hyperbola, low lunar orbit, descent orbit, powered descent
  const seleno = new TrackBuilder()
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
    seleno.push(t, scale(combine(Pm, Math.cos(nu), Qm, Math.sin(nu)), r))
  }
  const lunarTotal = s.thetaDoi + TWO_PI * s.N
  for (let ang = 5 * DEG; ang < lunarTotal - 1e-9; ang += 5 * DEG) {
    seleno.push(tLoi + (ang / s.nLoiter) * 1000, scale(combine(Pm, Math.cos(ang), Qm, Math.sin(ang)), c.rLlo))
  }
  seleno.push(s.tDoi, scale(combine(Pm, Math.cos(lunarTotal), Qm, Math.sin(lunarTotal)), c.rLlo))
  const de = s.descEl
  const kD = Math.sqrt(de.a ** 3 / MU_MOON)
  const nDesc = 60
  for (let i = 0; i < nDesc; i++) {
    // from apolune (E = π) to perilune (E = 0), in-plane angle thetaDoi → thetaPdi
    const E = Math.PI * (1 - i / (nDesc - 1))
    const nu = eccentricToTrue(de.e, E)
    const r = radiusAtE(de, E)
    const th = s.thetaPdi - nu
    seleno.push(s.tPdi - kD * (E - de.e * Math.sin(E)) * 1000, scale(combine(Pm, Math.cos(th), Qm, Math.sin(th)), r))
  }
  const nPd = 40
  const descentArc = options.descentArcDeg * DEG
  for (let i = 0; i < nPd; i++) {
    const f = i / (nPd - 1)
    const ang = s.thetaPdi + descentArc * (2 * f - f * f)
    const r = R_MOON + options.pdiAltKm * (1 - f) ** 2
    seleno.push(s.tPdi + f * options.descentTimeS * 1000, scale(combine(Pm, Math.cos(ang), Qm, Math.sin(ang)), r))
  }
  // exact touchdown point on the surface
  seleno.p[seleno.p.length - 1] = scale(c.siteHat, R_MOON)

  // Burns and masses
  const tliEng = vehicle.tliEngine
  const tliProp = rocketPropellant(vehicle.injectedMassKg + vehicle.tliStageDryKg, s.dvTli, tliEng.ispS)
  const tliDur = tliEng.thrustN ? (tliProp * G0 * tliEng.ispS) / tliEng.thrustN : null
  const sc = vehicle.spacecraftEngine
  const burnSc = (mIn: number, dv: number) => {
    const mOut = mIn * Math.exp(-(dv * 1000) / (G0 * sc.ispS))
    const prop = mIn - mOut
    return { mOut, prop, dur: sc.thrustN ? (prop * G0 * sc.ispS) / sc.thrustN : null }
  }
  const loi = burnSc(vehicle.injectedMassKg, s.dvLoi)
  const doi = burnSc(loi.mOut, s.dvDoi)
  const pdi = burnSc(doi.mOut, s.dvPdi)

  const burns: Burn[] = [
    { id: 'ascent', label: 'Ascent to parking orbit', short: 'Ascent', utcMs: s.tL, dvKms: s.dvAscent, estimate: true,
      propellantKg: null, durationS: null, massAfterKg: null },
    { id: 'tli', label: 'Trans-lunar injection', short: 'TLI', utcMs: s.tTli, dvKms: s.dvTli, estimate: false,
      propellantKg: tliProp, durationS: tliDur, massAfterKg: vehicle.injectedMassKg },
    { id: 'loi', label: 'Lunar orbit insertion', short: 'LOI', utcMs: s.tLoi, dvKms: s.dvLoi, estimate: false,
      propellantKg: loi.prop, durationS: loi.dur, massAfterKg: loi.mOut },
    { id: 'doi', label: 'Descent orbit insertion', short: 'DOI', utcMs: s.tDoi, dvKms: s.dvDoi, estimate: false,
      propellantKg: doi.prop, durationS: doi.dur, massAfterKg: doi.mOut },
    { id: 'pdi', label: 'Powered descent', short: 'PDI', utcMs: s.tPdi, dvKms: s.dvPdi, estimate: true,
      propellantKg: pdi.prop, durationS: pdi.dur, massAfterKg: pdi.mOut },
  ]
  const dvInSpaceKms = s.dvTli + s.dvLoi + s.dvDoi + s.dvPdi

  const launchMs = s.tL
  const ascentEnd = launchMs + ascentMs
  const phases: Phase[] = [
    { id: 'ascent', label: 'Ascent', startMs: launchMs, endMs: ascentEnd },
    { id: 'parking', label: 'Parking orbit', startMs: ascentEnd, endMs: s.tTli },
    { id: 'transfer', label: 'Coast to the Moon', startMs: s.tTli, endMs: s.tS },
    { id: 'approach', label: 'Lunar approach', startMs: s.tS, endMs: s.tLoi },
    { id: 'orbit', label: 'Lunar orbit', startMs: s.tLoi, endMs: s.tDoi },
    { id: 'descent', label: 'Descent', startMs: s.tDoi, endMs: options.landingMs },
  ]

  return {
    pad,
    vehicle,
    target,
    options,
    ephem: c.ephem,
    launchMs,
    tliMs: s.tTli,
    soiMs: s.tS,
    loiMs: s.tLoi,
    doiMs: s.tDoi,
    pdiMs: s.tPdi,
    landingMs: options.landingMs,
    launchAzimuthDeg: s.az / DEG,
    parkingInclDeg: s.incl / DEG,
    parkingCoastS: s.coastS,
    transferDays: (s.tLoi - s.tTli) / (DAY_S * 1000),
    moonDistKm: s.d,
    moonDeclDeg: Math.asin(clamp(dot(s.mHat, s.pole), -1, 1)) / DEG,
    vInfKms: s.vInf,
    lunarInclDeg: s.lunarIncl / DEG,
    loiterH: (s.tDoi - s.tLoi) / HOUR_MS,
    lunarRevs: s.N,
    burns,
    dvInSpaceKms,
    dvTotalKms: dvInSpaceKms + s.dvAscent,
    landedMassKg: pdi.mOut,
    phases,
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
  return buildPlan(c, refined && refined.total <= best.total ? refined : best)
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
  const earth = t <= plan.soiMs
  const track = earth ? plan.geo : plan.seleno
  const pos = sampleTrack(track, t) ?? track.p[earth ? 0 : track.p.length - 1]
  let phase = plan.phases[0].id
  for (const ph of plan.phases) if (t >= ph.startMs) phase = ph.id
  return { frame: earth ? 'earth' : 'moon', pos, phase }
}
