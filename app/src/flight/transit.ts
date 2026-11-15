// The two crossings between Earth and the Moon, flown with finite burns in the full gravity field (sim.ts:
// Earth with J2, Moon, Sun). Works for any stage and engine described by thrust, specific impulse and mass.
//
//   outbound:  parking orbit → Trans-Lunar Injection (TLI) → translunar coast → Lunar Orbit Insertion (LOI)
//   homebound: lunar orbit → Trans-Earth Injection (TEI) → trans-Earth coast → Entry Interface (EI)
//
// Each burn is integrated with its thrust and propellant flow; none is an instantaneous velocity change. The
// burns are aimed by iteration on the integrated flight:
//   - TLI: the burn length (how far the far end of the transfer reaches) and a small turn of the parking orbit
//     plane about the launchpad direction (the launch azimuth) are corrected until the unpowered approach would
//     pass the Moon at the lunar orbit altitude in a plane over the landing site (Newton iteration on the
//     B-plane miss: the point where the incoming asymptote pierces the plane through the Moon's centre
//     perpendicular to it).
//   - LOI: thrust along the velocity still to be gained toward the circular velocity at the present radius,
//     started before the closest approach so that the burn straddles it, and ended when nothing is left to
//     gain; the start is chosen so that the orbit closes at the target altitude. The result is circular for a
//     strong engine and for a weak one.
//   - TEI: thrust along the Moon-relative velocity; for each ignition point around the orbit the burn length is
//     solved so that the return reaches Earth's atmosphere at the entry flight-path angle, and the ignition
//     point with the shortest burn is taken. A lunar orbit keeps its plane in space while the Moon carries it
//     around Earth, so the plane contains the way home (against the Moon's own motion) only about every half
//     month; in between, the thrust has to be turned out of the plane, which is searched too and costs far more.
import { G0, MU_EARTH, MU_MOON, R_EARTH_EQ, R_MOON, SOI_MOON, DAY_S, circularSpeed, goldenMin } from './astro'
import type { Guess } from './guess'
import { constantThrust, earthField, integrate, moonField } from './sim'
import type { EarthField, Field, SimRun, SimState } from './sim'
import type { FlightEphemeris, Vec3 } from './types'
import { FlightPlanError } from './types'
import { DEG, TWO_PI, add, angleAbout, combine, cross, dot, latLonUnit, norm, qconj, qrot, rotateAbout, scale, sub, unit } from './vec'

const HOUR_MS = 3_600_000

export interface EngineUse {
  name: string // official name of the stage or engine that fires
  thrustN: number
  ispS: number
}

export interface PathSeg {
  id: string
  label: string
  frame: 'earth' | 'moon' // positions are relative to this body's centre, J2000 axes, km
  powered: boolean
  t: number[] // UTC ms, strictly increasing
  p: Vec3[]
}

export interface BurnEvent {
  id: string
  short: string
  label: string
  utcMs: number // ignition
  by: string
  dvKms: number // integrated thrust acceleration: what the burn delivered, losses included
  propellantKg: number
  durationS: number
  massAfterKg: number
}

export interface Orbit {
  utcMs: number
  r: Vec3
  v: Vec3
}

const segOf = (id: string, label: string, frame: 'earth' | 'moon', powered: boolean, run: SimRun, t0Ms: number): PathSeg => ({
  id,
  label,
  frame,
  powered,
  t: run.t.map((s) => Math.round(t0Ms + s * 1000)),
  p: run.r,
})

/** Delta-v a burn delivered between two masses at a given specific impulse (the rocket equation, km/s). */
const dvOf = (m0: number, m1: number, ispS: number) => (G0 * ispS * Math.log(m0 / m1)) / 1000

/** Periapsis and apoapsis radius of the osculating two-body orbit (apoapsis Infinity when unbound). */
export function apsides(mu: number, r: Vec3, v: Vec3) {
  const rn = norm(r)
  const energy = dot(v, v) / 2 - mu / rn
  const h = norm(cross(r, v))
  const e = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (mu * mu)))
  const p = (h * h) / mu
  return { rp: p / (1 + e), ra: energy < 0 ? p / (1 - e) : Infinity, e, energy }
}

// ---------------------------------------------------------------- outbound

export interface OutboundInput {
  ephem: FlightEphemeris
  guess: Guess
  /** State at parking orbit insertion, Earth-centred J2000, in the guess's plane. */
  insertion: Orbit
  /** The stage that injects: everything it still weighs besides the payload, and the propellant it has left. */
  stage: EngineUse & { dryKg: number; propellantKg: number }
  payloadKg: number // capsule and lander: what continues to the Moon
  capsuleEngine: EngineUse // performs the lunar orbit insertion
  lunarOrbitAltKm: number
  siteLatDeg: number
  siteLonDeg: number
  orbitToTouchdownS: number // from lunar orbit insertion to touchdown: fixes where the site is when the plane is chosen
}

export interface OutboundResult {
  /** Turn of the parking orbit plane about the launchpad direction that the aiming asked for (rad). The ascent
   *  has to be flown into this plane; mission.ts re-runs it and calls outbound again until this is ~0. */
  planeTurnRad: number
  segs: PathSeg[] // parking coast, TLI burn, translunar coast (Earth frame); LOI burn (Moon frame)
  events: BurnEvent[] // TLI, LOI
  lunarOrbit: Orbit // Moon-centred state at LOI cut-off
  massAfterLoiKg: number
  stagePropellantUsedKg: number
  periluneKm: number // altitudes of the orbit entered
  apoluneKm: number
  vInfKms: number
  soiMs: number // entry into the Moon's sphere of influence
  perilunePassMs: number // closest approach of the unpowered approach (the LOI burn straddles it)
  lunarPlaneNormal: Vec3
  moonDistKm: number
}

interface Shot {
  tIgnMs: number
  coast: SimRun
  burn: SimRun
  tCutMs: number
  approach: SimRun
  tPerMs: number
  rRel: Vec3
  vRel: Vec3
  rp: number
  vInf2: number
  hm: Vec3
  miss: [number, number]
  offPlane: number
}

export function flyOutbound(inp: OutboundInput): OutboundResult {
  const { ephem, guess, stage, payloadKg } = inp
  const rLlo = R_MOON + inp.lunarOrbitAltKm
  const fromMs = inp.insertion.utcMs - HOUR_MS
  const toMs = guess.loiMs + 2.5 * DAY_S * 1000
  let earth: EarthField
  let moonF: Field
  try {
    earth = earthField(ephem, fromMs, toMs, guess.pole)
    moonF = moonField(ephem, fromMs, toMs)
  } catch (err) {
    if (err instanceof RangeError) throw new FlightPlanError('The ephemeris does not cover this flight.')
    throw err
  }
  const m0 = payloadKg + stage.dryKg + stage.propellantKg
  const flow = stage.thrustN / (G0 * stage.ispS)
  const cKms = (G0 * stage.ispS) / 1000
  const prograde = (_t: number, s: SimState) => unit(s.v)
  const siteUnit = latLonUnit(inp.siteLatDeg, inp.siteLonDeg)
  const siteAt = (utcMs: number) => qrot(ephem.moonFixedToInertial(utcMs), siteUnit)
  const northAt = (utcMs: number) => qrot(ephem.moonFixedToInertial(utcMs), [0, 0, 1])
  // range × range rate relative to the Moon once inside 120,000 km: zero at the closest approach
  const perilune = (_t: number, s: SimState, utcMs: number) => {
    const m = earth.moonState(utcMs)
    const d = sub(s.r, m.r)
    return norm(d) < 120000 ? dot(d, sub(s.v, m.v)) : -1
  }
  // mean motion on the parking orbit, for the coast to the injection point
  const aPark = 1 / (2 / norm(inp.insertion.r) - dot(inp.insertion.v, inp.insertion.v) / MU_EARTH)
  const nPark = Math.sqrt(MU_EARTH / aPark ** 3)

  // Radius at which the unpowered approach is aimed to pass the Moon. It starts as the lunar orbit radius and is
  // then lowered by as much as the insertion burn lifts the orbit while it burns (a weak engine lifts it more).
  let aimR = rLlo

  const shoot = (tauS: number, dAz: number): Shot | null => {
    if (!(tauS > 1) || tauS * flow >= stage.propellantKg + stage.dryKg + payloadKg) return null
    const r0 = rotateAbout(inp.insertion.r, guess.padHat, dAz)
    const v0 = rotateAbout(inp.insertion.v, guess.padHat, dAz)
    const h = unit(cross(r0, v0))
    const point = rotateAbout(guess.tliPoint, guess.padHat, dAz)
    // The burn straddles the injection point: half of it before, half after.
    let coastS = angleAbout(unit(r0), point, h) / nPark - tauS / 2
    while (coastS < 0) coastS += TWO_PI / nPark
    // whole revolutions more, as the first guess planned the coast (one to two revolutions in the parking orbit)
    coastS += Math.max(0, Math.round((guess.coastAngleRad / nPark - tauS / 2 - coastS) / (TWO_PI / nPark))) * (TWO_PI / nPark)
    try {
      const coast = integrate(earth, { r: r0, v: v0, m: m0 }, inp.insertion.utcMs, { maxSeconds: coastS, maxStepS: 30 })
      const tIgnMs = inp.insertion.utcMs + coastS * 1000
      const burn = integrate(earth, coast.end, tIgnMs, { maxSeconds: tauS, maxStepS: 10, engine: constantThrust(stage.thrustN, stage.ispS, prograde) })
      const tCutMs = tIgnMs + tauS * 1000
      // The injection stage is left behind; capsule and lander coast on.
      const approach = integrate(earth, { r: burn.end.r, v: burn.end.v, m: payloadKg }, tCutMs, {
        maxSeconds: (guess.loiMs - guess.tliMs) / 1000 + 1.5 * DAY_S,
        stop: perilune,
      })
      if (!approach.stopped) return null
      const tPerMs = tCutMs + approach.endS * 1000
      const moon = earth.moonState(tPerMs)
      const rRel = sub(approach.end.r, moon.r)
      const vRel = sub(approach.end.v, moon.v)
      // Osculating hyperbola at the closest approach (r ⟂ v there, so this is its periapsis).
      const rp = norm(rRel)
      const vInf2 = dot(vRel, vRel) - (2 * MU_MOON) / rp
      if (vInf2 <= 0) return null
      const hm = unit(cross(rRel, vRel))
      const Pm = unit(rRel)
      const e = 1 + (rp * vInf2) / MU_MOON
      const S = combine(Pm, 1 / e, cross(hm, Pm), Math.sqrt(1 - 1 / (e * e))) // incoming asymptote
      const B = scale(cross(S, hm), (MU_MOON / vInf2) * Math.sqrt(e * e - 1))
      const tTd = tPerMs + inp.orbitToTouchdownS * 1000
      const site = siteAt(tTd)
      const north = northAt(tTd)
      const sitePerp = sub(site, scale(S, dot(site, S)))
      const degenerate = norm(sitePerp) < 0.05 // the site on the approach line: every plane passes over it
      let bHat = unit(degenerate ? sub(north, scale(S, dot(north, S))) : sitePerp)
      if (dot(cross(bHat, S), guess.lunarPlaneNormal) < 0) bHat = scale(bHat, -1) // same sense of rotation as the guess
      const bTarget = Math.sqrt(aimR * aimR + (2 * MU_MOON * aimR) / vInf2)
      const miss = sub(B, scale(bHat, bTarget))
      let T = cross(S, north)
      if (norm(T) < 0.05) T = cross(S, [1, 0, 0])
      T = unit(T)
      return {
        tIgnMs, coast, burn, tCutMs, approach, tPerMs, rRel, vRel, rp, vInf2, hm,
        miss: [dot(miss, T), dot(miss, cross(S, T))],
        offPlane: degenerate ? 0 : Math.abs(dot(hm, site)),
      }
    } catch (err) {
      if (err instanceof RangeError) return null
      throw err
    }
  }

  // Newton iteration on the B-plane miss with a step limit and backtracking.
  const size = (s: Shot) => Math.hypot(s.miss[0], s.miss[1])
  const accEnd = stage.thrustN / (m0 * Math.exp(-guess.dvTliKms / cKms)) / 1000 // km/s² near cut-off
  const STEP_TAU = 1e-6 / accEnd // one millimetre per second of delta-v
  const STEP_AZ = 2e-6
  const MAX_TAU = 0.004 / accEnd
  const MAX_AZ = 0.03
  let x: [number, number] = [(m0 * (1 - Math.exp((-guess.dvTliKms * 1.005) / cKms))) / flow, 0]
  let cur = shoot(x[0], x[1])
  // A first guess that falls short of the Moon has no closest approach inside 120,000 km: lengthen the burn.
  // (A long burn on a weak stage loses tens of metres per second to gravity, which the ideal impulse lacks.)
  for (let k = 0; !cur && k < 60; k++) {
    x = [x[0] * 1.003, 0]
    cur = shoot(x[0], 0)
  }
  if (!cur) throw new FlightPlanError('The translunar flight could not be aimed: the first guess does not reach the Moon.')
  const converge = (from: Shot): Shot => {
  let cur = from
  for (let iter = 0; iter < 30 && size(cur) > 0.01; iter++) {
    const f0 = cur.miss
    const a = shoot(x[0] + STEP_TAU, x[1])
    const b = shoot(x[0], x[1] + STEP_AZ)
    if (!a || !b) throw new FlightPlanError('The translunar flight could not be aimed.')
    const j11 = (a.miss[0] - f0[0]) / STEP_TAU
    const j21 = (a.miss[1] - f0[1]) / STEP_TAU
    const j12 = (b.miss[0] - f0[0]) / STEP_AZ
    const j22 = (b.miss[1] - f0[1]) / STEP_AZ
    const det = j11 * j22 - j12 * j21
    if (Math.abs(det) < 1e-4 * Math.hypot(j11, j21) * Math.hypot(j12, j22)) throw new NoLeverage()
    let dx0 = -(j22 * f0[0] - j12 * f0[1]) / det
    let dx1 = -(-j21 * f0[0] + j11 * f0[1]) / det
    const over = Math.max(Math.abs(dx0) / MAX_TAU, Math.abs(dx1) / MAX_AZ, 1)
    dx0 /= over
    dx1 /= over
    let next: Shot | null = null
    for (let half = 0; half < 12; half++) {
      const t = shoot(x[0] + dx0, x[1] + dx1)
      if (t && size(t) < size(cur)) {
        next = t
        break
      }
      dx0 /= 2
      dx1 /= 2
    }
    if (!next) throw new NoLeverage()
    x = [x[0] + dx0, x[1] + dx1]
    cur = next
  }
  if (Math.abs(cur.rp - aimR) > 0.5 || cur.offPlane > 1e-3) throw new NoLeverage()
  return cur
  }

  // ---- Lunar orbit insertion: a burn that straddles the closest approach.
  const eng = inp.capsuleEngine
  const flowC = eng.thrustN / (G0 * eng.ispS)
  const capture = (shot: Shot) => {
  const dvImp = Math.sqrt(dot(shot.vRel, shot.vRel)) - circularSpeed(MU_MOON, shot.rp)
  const tauLoi = (payloadKg * (1 - Math.exp((-dvImp * 1000) / (G0 * eng.ispS)))) / flowC
  // Steering: thrust along the velocity still to be gained, the difference between the circular velocity at the
  // present radius (horizontal, in the plane of motion) and the present velocity. The burn ends when nothing is
  // left to gain, which leaves a circular orbit whatever the thrust level.
  const toGain = (s: SimState): Vec3 => {
    const rHat = unit(s.r)
    const tHat = unit(cross(cross(s.r, s.v), rHat))
    return sub(scale(tHat, circularSpeed(MU_MOON, norm(s.r))), s.v)
  }
  const circularise = (_t: number, s: SimState) => unit(toGain(s))
  // Coast once to shortly before the burn can start, then try ignition instants from there.
  const preS = (shot.tPerMs - shot.tCutMs) / 1000 - tauLoi
  const pre = integrate(earth, { r: shot.burn.end.r, v: shot.burn.end.v, m: payloadKg }, shot.tCutMs, { maxSeconds: preS })
  const tPreMs = shot.tCutMs + preS * 1000
  const insert = (lead: number) => {
    // lead = fraction of the burn that lies before the closest approach
    const waitS = tauLoi * (1 - lead)
    const wait = integrate(earth, pre.end, tPreMs, { maxSeconds: waitS, maxStepS: 60 })
    const tIgnMs = tPreMs + waitS * 1000
    const moon = earth.moonState(tIgnMs)
    const start: SimState = { r: sub(wait.end.r, moon.r), v: sub(wait.end.v, moon.v), m: payloadKg }
    const burn = integrate(moonF, start, tIgnMs, {
      maxSeconds: 3 * tauLoi,
      maxStepS: 5,
      engine: constantThrust(eng.thrustN, eng.ispS, circularise),
      stop: (_t, s) => 2e-6 - norm(toGain(s)), // 2 mm/s left
    })
    return { wait, tIgnMs, burn, orbit: apsides(MU_MOON, burn.end.r, burn.end.v) }
  }
  // The ignition instant decides at which altitude the orbit closes: choose it for the target altitude.
  const lead = goldenMin((f) => {
    const k = insert(f)
    return k.burn.stopped ? Math.abs(norm(k.burn.end.r) - rLlo) : 1e6
  }, 0.2, 0.8, 0.002)
  const loi = insert(lead)
  if (!loi.burn.stopped) throw new FlightPlanError('The lunar orbit insertion burn does not capture: the engine is too weak for this approach.')
  return { ...loi, pre, tPreMs }
  }

  let shot = converge(cur)
  let loi = capture(shot)
  for (let pass = 0; pass < 5 && Math.abs(norm(loi.burn.end.r) - rLlo) > 0.2; pass++) {
    aimR -= norm(loi.burn.end.r) - rLlo
    if (aimR < R_MOON + 10) throw new FlightPlanError('The engine is too weak to enter this lunar orbit: the insertion burn would have to start below 10 km altitude.')
    const again = shoot(x[0], x[1])
    if (!again) throw new FlightPlanError('The translunar flight could not be aimed.')
    shot = converge(again)
    loi = capture(shot)
  }
  const { pre, tPreMs } = loi

  // ---- Assemble paths and events.
  const coastSeg = segOf('parking', 'Parking orbit', 'earth', false, shot.coast, inp.insertion.utcMs)
  const tliSeg = segOf('tli', 'Trans-Lunar Injection', 'earth', true, shot.burn, shot.tIgnMs)
  // translunar coast up to the LOI ignition: the part before `pre` ends, then the wait
  const preSeg = segOf('translunar', 'Translunar coast', 'earth', false, pre, shot.tCutMs)
  const waitSeg = segOf('translunar', 'Translunar coast', 'earth', false, loi.wait, tPreMs)
  const coastT = [...preSeg.t, ...waitSeg.t.slice(1)]
  const coastP = [...preSeg.p, ...waitSeg.p.slice(1)]
  const loiSeg = segOf('loi', 'Lunar Orbit Insertion', 'moon', true, loi.burn, loi.tIgnMs)
  let soiMs = loi.tIgnMs
  for (let i = 1; i < coastT.length; i++) {
    const gap = (k: number) => norm(sub(coastP[k], earth.moonState(coastT[k]).r)) - SOI_MOON
    if (gap(i - 1) > 0 && gap(i) <= 0) {
      soiMs = Math.round(coastT[i - 1] + (gap(i - 1) / (gap(i - 1) - gap(i))) * (coastT[i] - coastT[i - 1]))
      break
    }
  }
  const mTli = shot.burn.end.m
  const events: BurnEvent[] = [
    {
      id: 'tli', short: 'TLI', label: 'Trans-Lunar Injection (TLI)', utcMs: Math.round(shot.tIgnMs), by: stage.name,
      dvKms: dvOf(m0, mTli, stage.ispS), propellantKg: m0 - mTli, durationS: x[0], massAfterKg: payloadKg,
    },
    {
      id: 'loi', short: 'LOI', label: 'Lunar Orbit Insertion (LOI)', utcMs: Math.round(loi.tIgnMs), by: eng.name,
      dvKms: dvOf(payloadKg, loi.burn.end.m, eng.ispS), propellantKg: payloadKg - loi.burn.end.m, durationS: loi.burn.endS,
      massAfterKg: loi.burn.end.m,
    },
  ]
  return {
    planeTurnRad: x[1],
    segs: [coastSeg, tliSeg, { ...preSeg, t: coastT, p: coastP }, loiSeg],
    events,
    lunarOrbit: { utcMs: Math.round(loi.tIgnMs + loi.burn.endS * 1000), r: loi.burn.end.r, v: loi.burn.end.v },
    massAfterLoiKg: loi.burn.end.m,
    stagePropellantUsedKg: m0 - mTli,
    periluneKm: loi.orbit.rp - R_MOON,
    apoluneKm: loi.orbit.ra - R_MOON,
    vInfKms: Math.sqrt(shot.vInf2),
    soiMs,
    perilunePassMs: Math.round(shot.tPerMs),
    lunarPlaneNormal: unit(cross(loi.burn.end.r, loi.burn.end.v)),
    moonDistKm: norm(earth.moonState(shot.tPerMs).r),
  }
}

/** The aiming has no solution near this liftoff: the launch azimuth cannot move the aim point when the launchpad
 *  lies on the line to the arrival point. mission.ts answers with a liftoff a few minutes earlier or later. */
export class NoLeverage extends FlightPlanError {
  constructor() {
    super('The translunar flight could not be aimed from this liftoff.')
  }
}

// ---------------------------------------------------------------- homebound

export interface HomeboundInput {
  ephem: FlightEphemeris
  orbit: Orbit // the returning spacecraft in lunar orbit, Moon-centred J2000
  earliestMs: number // Trans-Earth Injection not before this
  massKg: number
  engine: EngineUse
  entryAltKm: number // Entry Interface altitude (121.92 km = 400,000 ft)
  entryFpaDeg: number // flight-path angle at Entry Interface, negative (below the local horizontal)
}

export interface HomeboundResult {
  segs: PathSeg[] // lunar orbit up to ignition (Moon frame), TEI burn (Moon frame), trans-Earth coast (Earth frame)
  events: BurnEvent[] // TEI
  entry: { utcMs: number; speedKms: number; fpaDeg: number; latDeg: number; lonDeg: number }
  massAfterKg: number
  returnDays: number
  /** Angle by which the thrust was steered out of the orbit plane (deg). Zero when the plane already contains
   *  the way home; large (and costly) when the orbit is edge-on to it. */
  yawDeg: number
  /** Angle between the lunar orbit's plane and the direction a return has to leave in (opposite to the Moon's
   *  own motion around Earth), deg: 0 = the plane contains it, 90 = edge-on. */
  planeOffDeg: number
}

export function flyHomebound(inp: HomeboundInput): HomeboundResult {
  const { ephem, engine } = inp
  const fromMs = Math.min(inp.orbit.utcMs, inp.earliestMs) - HOUR_MS
  const toMs = inp.earliestMs + 9 * DAY_S * 1000
  let earth: EarthField
  let moonF: Field
  try {
    earth = earthField(ephem, fromMs, toMs, qrot(ephem.earthFixedToInertial(inp.earliestMs), [0, 0, 1]))
    moonF = moonField(ephem, fromMs, toMs)
  } catch (err) {
    if (err instanceof RangeError) throw new FlightPlanError('The ephemeris does not cover the return flight (it ends about a week after leaving the Moon).')
    throw err
  }
  const rEi = R_EARTH_EQ + inp.entryAltKm
  const cosTarget = Math.cos(inp.entryFpaDeg * DEG)
  const flow = engine.thrustN / (G0 * engine.ispS)
  // Thrust along the flight direction, turned by a fixed yaw angle toward the orbit normal.
  const steer = (yaw: number) => (_t: number, s: SimState) => {
    const vHat = unit(s.v)
    return yaw === 0 ? vHat : unit(combine(vHat, Math.cos(yaw), unit(cross(s.r, s.v)), Math.sin(yaw)))
  }
  // The orbit at the earliest instant, and its period.
  const start = integrate(moonF, { r: inp.orbit.r, v: inp.orbit.v, m: inp.massKg }, inp.orbit.utcMs, {
    maxSeconds: Math.max(0, (inp.earliestMs - inp.orbit.utcMs) / 1000),
    maxStepS: 60,
  }).end
  const el = apsides(MU_MOON, start.r, start.v)
  const aOrb = -MU_MOON / (2 * el.energy)
  const period = TWO_PI * Math.sqrt(aOrb ** 3 / MU_MOON)
  const dvImp = Math.sqrt(0.83 ** 2 + (2 * MU_MOON) / norm(start.r)) - circularSpeed(MU_MOON, norm(start.r)) // v∞ ≈ 0.83 km/s
  const tauOf = (dv: number) => (inp.massKg * (1 - Math.exp((-dv * 1000) / (G0 * engine.ispS)))) / flow
  const planeOffDeg = Math.asin(Math.min(1, Math.abs(dot(unit(cross(start.r, start.v)), unit(earth.moonState(inp.earliestMs).v))))) / DEG

  const fly = (waitS: number, tauS: number, yaw: number) => {
    const wait = integrate(moonF, start, inp.earliestMs, { maxSeconds: waitS, maxStepS: 60 })
    const tIgnMs = inp.earliestMs + waitS * 1000
    const burn = integrate(moonF, wait.end, tIgnMs, { maxSeconds: tauS, maxStepS: 10, engine: constantThrust(engine.thrustN, engine.ispS, steer(yaw)) })
    const tCutMs = tIgnMs + tauS * 1000
    const moon = earth.moonState(tCutMs)
    const out: SimState = { r: add(burn.end.r, moon.r), v: add(burn.end.v, moon.v), m: burn.end.m }
    return { wait, tIgnMs, burn, tCutMs, out }
  }
  // cos γ at Entry Interface minus its target for the return this burn gives (positive: too shallow or no entry,
  // negative: too steep). NaN: the burn does not bring the spacecraft back to Earth.
  const residual = (waitS: number, tauS: number, yaw: number): number => {
    let coast
    try {
      const f = fly(waitS, tauS, yaw)
      // coast to the perigee of the return orbit (range rate through zero inside 150,000 km)
      coast = integrate(earth, f.out, f.tCutMs, {
        maxSeconds: 6.5 * DAY_S,
        maxStepS: 7200,
        tol: 1e-9,
        stop: (_t, s) => (norm(s.r) < 150000 ? dot(s.r, s.v) : -1),
      })
    } catch {
      return NaN // a trial that falls into the Moon or leaves the tabulated span is not a return
    }
    if (!coast.stopped) return NaN
    const rp = norm(coast.end.r)
    const vp = norm(coast.end.v)
    if (rp >= rEi) return 1 + (rp - rEi) / rEi - cosTarget // perigee above the atmosphere: no entry
    const vEi = Math.sqrt(vp * vp - (2 * MU_EARTH) / rp + (2 * MU_EARTH) / rEi)
    return (rp * vp) / (rEi * vEi) - cosTarget
  }
  // For one ignition instant and yaw: the shortest burn that enters at the target angle (first sign change,
  // bisected). Infinity when there is none below maxDv.
  const solve = (waitS: number, yaw: number, maxDv: number): number => {
    let prevDv = 0
    let prev = NaN
    for (let dv = dvImp * 0.9; dv <= maxDv; dv *= yaw === 0 ? 1.05 : 1.08) {
      const cur = residual(waitS, tauOf(dv), yaw)
      if (Number.isFinite(prev) && Number.isFinite(cur) && prev * cur <= 0) {
        let lo = prevDv
        let hi = dv
        let flo = prev
        for (let it = 0; it < 30 && hi - lo > 5e-8; it++) {
          const mid = 0.5 * (lo + hi)
          const fm = residual(waitS, tauOf(mid), yaw)
          if (!Number.isFinite(fm)) break
          if (flo * fm <= 0) hi = mid
          else {
            lo = mid
            flo = fm
          }
        }
        return 0.5 * (lo + hi)
      }
      prevDv = dv
      prev = cur
    }
    return Infinity
  }
  // Ignition points around one revolution. First with the thrust in the orbit plane; when the plane does not
  // contain a way home, with the thrust turned out of it, which costs much more.
  let N = 16
  let best = { wait: 0, yaw: 0, dv: Infinity }
  const scan = (yaw: number, maxDv: number) => {
    for (let k = 0; k < N; k++) {
      const dv = solve((k * period) / N, yaw, Math.min(maxDv, best.dv))
      if (dv < best.dv) best = { wait: (k * period) / N, yaw, dv }
    }
  }
  scan(0, dvImp * 2)
  if (!Number.isFinite(best.dv) || best.dv > dvImp * 1.25) {
    N = 8
    for (const deg of [25, -25, 50, -50, 75, -75]) scan(deg * DEG, dvImp * 4.5)
  }
  if (!Number.isFinite(best.dv)) throw new FlightPlanError('No return to Earth found from this lunar orbit.')
  // Refine the ignition instant, then the yaw.
  const w = goldenMin((x) => solve(x, best.yaw, best.dv * 1.2), Math.max(0, best.wait - period / N), best.wait + period / N, period / 300)
  const dvW = solve(w, best.yaw, best.dv * 1.2)
  if (dvW < best.dv) best = { wait: w, yaw: best.yaw, dv: dvW }
  const y = goldenMin((x) => solve(best.wait, x, best.dv * 1.2), best.yaw - 12 * DEG, best.yaw + 12 * DEG, 0.5 * DEG)
  const dvY = solve(best.wait, y, best.dv * 1.2)
  if (dvY < best.dv) best = { wait: best.wait, yaw: y, dv: dvY }
  const tauS = tauOf(best.dv)

  // Fly it: down to Entry Interface.
  const f = fly(best.wait, tauS, best.yaw)
  const coast = integrate(earth, f.out, f.tCutMs, { maxSeconds: 9 * DAY_S, stop: (_t, s) => rEi - norm(s.r) })
  if (!coast.stopped) throw new FlightPlanError('The return flight does not reach Entry Interface.')
  const tEiMs = f.tCutMs + coast.endS * 1000
  const rHat = unit(coast.end.r)
  const fixed = qrot(qconj(ephem.earthFixedToInertial(tEiMs)), rHat)
  return {
    segs: [
      segOf('lunar-orbit-home', 'Lunar orbit', 'moon', false, f.wait, inp.earliestMs),
      segOf('tei', 'Trans-Earth Injection', 'moon', true, f.burn, f.tIgnMs),
      segOf('transearth', 'Trans-Earth coast', 'earth', false, coast, f.tCutMs),
    ],
    events: [
      {
        id: 'tei', short: 'TEI', label: 'Trans-Earth Injection (TEI)', utcMs: Math.round(f.tIgnMs), by: engine.name,
        dvKms: dvOf(inp.massKg, f.burn.end.m, engine.ispS), propellantKg: inp.massKg - f.burn.end.m, durationS: tauS,
        massAfterKg: f.burn.end.m,
      },
    ],
    entry: {
      utcMs: Math.round(tEiMs),
      speedKms: norm(coast.end.v),
      fpaDeg: Math.asin(dot(rHat, unit(coast.end.v))) / DEG,
      latDeg: Math.asin(fixed[2]) / DEG,
      lonDeg: Math.atan2(fixed[1], fixed[0]) / DEG,
    },
    massAfterKg: f.burn.end.m,
    returnDays: (tEiMs - f.tIgnMs) / (DAY_S * 1000),
    yawDeg: best.yaw / DEG,
    planeOffDeg,
  }
}
