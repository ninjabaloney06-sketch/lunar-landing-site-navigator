// A whole Moon mission by rendezvous in a near-rectilinear halo orbit (NRHO), the Artemis design, for any launch
// vehicle, capsule and lander given as data (hardware.ts) and any launchpad and landing point:
//
//   capsule:  liftoff → ascent to a parking orbit → Trans-Lunar Injection → translunar coast → Outbound Powered
//             Flyby → NRHO Insertion → docking with the lander that waits there → (the capsule stays on the NRHO)
//             → NRHO Departure → Return Powered Flyby → trans-Earth coast → Entry Interface
//   lander:   undocking → NRHO departure → Lunar Orbit Insertion over the landing point → descent orbit → powered
//             descent to the chosen point → surface stay → ascent to low lunar orbit → departure → NRHO insertion →
//             docking with the capsule
//
// Every phase is integrated with thrust and propellant flow by its own module: ascent.ts (through the
// atmosphere), nrho.ts (the NRHO itself and every transfer to and from it), lunar.ts (landing and ascent). This
// file aims the Trans-Lunar Injection (the method of transit.ts: Newton iteration on the B-plane), chooses when
// to fly, chains the phases and adds up what every element has to carry. It returns the same MissionPlan as
// mission.ts (the low-lunar-orbit design), so the same views show it.
//
// What the NRHO fixes, and what this planner does about it:
//   - Arriving costs 0.43 km/s when the flyby comes about 3.5 hours after the NRHO's own perilune passage and
//     more than twice that a day off. The lander is taken to be waiting on the NRHO, and nothing in this model
//     fixes the phase of that orbit, so the planner picks the launch (guess.ts: Earth's rotation, the launchpad
//     and the Moon's place decide it, once a day) and then puts the NRHO's perilune 3.5 hours before the flyby.
//     A real mission flies to an orbit whose phase is given and waits for a launch day that fits.
//   - The lander can go down only when the NRHO passes the Moon, and come back only one or more revolutions
//     (6.56 days) later. The touchdown follows the first perilune after the capsule's arrival; the surface stay
//     is the asked one rounded to whole revolutions, less the few hours the transfers and the low orbit take.
//   - The way home is cheap once per revolution too: the capsule leaves at the cheapest instant of the allowed
//     window (one revolution when the caller allows none).
import { DAY_S, G0, MU_EARTH, MU_MOON, R_EARTH_EQ, R_MOON } from './astro'
import { simulateAscent } from './ascent'
import type { AscentResult } from './ascent'
import { firstGuess } from './guess'
import type { Guess, GuessInput } from './guess'
import type { LaunchVehicleSpec, SpacecraftSpec, StageSpec } from './hardware'
import { LunarOpsError, planAscent, planDescent } from './lunar'
import type { LunarEvent, OrbitState } from './lunar'
import type { MissionInput } from './mission'
import { NRHO_PERIOD_S, NrhoError, earthToNrho, lloToNrho, nrhoAround, nrhoDepartureMs, nrhoToEarth, nrhoToLlo, pathInFrame, siteDirection } from './nrho'
import type { NrhoOrbit, Transfer, TransferEvent } from './nrho'
import { constantThrust, earthField, integrate } from './sim'
import type { EarthField, Field, SimRun, SimState } from './sim'
import { apsides } from './transit'
import type { MissionEvent, MissionLeg, MissionPlan, PropellantUse, SourceRef, Vec3 } from './types'
import { FlightPlanError } from './types'
import { DEG, TWO_PI, angleAbout, cross, dot, latLonUnit, norm, qrot, rotateAbout, scale, sub, unit } from './vec'

const HOUR_MS = 3_600_000
const MIN_MS = 60_000
const PERIOD_MS = NRHO_PERIOD_S * 1000

// ---- Choices of this planner (not facts about a vehicle or a mission)
/** The NRHO is phased so that the capsule's flyby comes this long after the orbit's perilune passage: the
 *  cheapest arrival found in nrho.test.ts (434 m/s; 471 m/s at 8 hours). */
const FLYBY_AFTER_PERILUNE_MS = 3.5 * HOUR_MS
/** From the lander's arrival in low lunar orbit to touchdown, for timing the launch: one revolution to check
 *  the orbit and come round to the descent point, half a revolution of descent orbit, the powered descent. */
const LOW_ORBIT_TO_TOUCHDOWN_MS = 2.7 * HOUR_MS
/** The lander leaves the NRHO half a day before the perilune and is back half a day after it, as in NASA's
 *  mission design (see the sources in nrho.test.ts). */
const LANDER_TRANSFER_DAYS = 0.5
/** Docking and crew transfer: the lander does not undock sooner than this after the capsule's NRHO insertion,
 *  the capsule does not leave sooner than this after the lander is back. */
const DOCKED_BEFORE_UNDOCKING_MS = 6 * HOUR_MS
const DOCKED_BEFORE_DEPARTURE_MS = HOUR_MS
/** The first docking is put this long after the NRHO insertion cut-off (an event only: the lander is taken to
 *  be where the capsule arrives). */
const FIRST_DOCKING_AFTER_NRI_MS = 2 * HOUR_MS
/** Flight-path angle at Entry Interface when the caller gives none: Artemis I, −5.66° (Rea, McNamara, Kane,
 *  "Orion Artemis I Entry Performance", https://ntrs.nasa.gov/citations/20240000024). */
const ARTEMIS_ENTRY_FPA_DEG = -5.66

const NRHO_SOURCES: SourceRef[] = [
  { label: 'Whitley, Martinez: Options for Staging Orbits in Cislunar Space (NASA, 2016)', url: 'https://ntrs.nasa.gov/citations/20160003079' },
  { label: 'Mahajan, Condon: HLS NRHO to Lunar Surface and Back Mission Design (NASA JSC, 2022)', url: 'https://ntrs.nasa.gov/citations/20230002566' },
  { label: 'Lee: Gateway Destination Orbit Model, a Continuous 15 Year NRHO Reference Trajectory (NASA, 2019)', url: 'https://ntrs.nasa.gov/citations/20190030294' },
  { label: 'Rea, McNamara, Kane: Orion Artemis I Entry Performance (NASA JSC)', url: 'https://ntrs.nasa.gov/citations/20240000024' },
  { label: 'JPL Three-Body Periodic Orbits catalogue (first guess of the NRHO)', url: 'https://ssd.jpl.nasa.gov/tools/periodic_orbits.html' },
]

const massOf = (m: StageSpec) => m.dryKg + m.propellantKg
const totalMass = (s: SpacecraftSpec) => s.modules.reduce((sum, m) => sum + massOf(m), 0)

interface EngineUse {
  name: string
  thrustN: number
  ispS: number
}

/** A module's main engine (all its engines together) at full thrust. */
function engineOf(s: SpacecraftSpec, module: StageSpec | undefined): { module: StageSpec; use: EngineUse } {
  if (!module?.engine) throw new FlightPlanError(`${s.name} has no main engine.`)
  const e = module.engine
  return { module, use: { name: `${module.name}, ${e.name}`, thrustN: e.thrustVacN * e.count, ispS: e.ispVacS } }
}

/** A sampled flight: thrusting[i] tells whether the engine fires on the stretch that begins at sample i. */
interface Flown {
  t: number[]
  r: Vec3[]
  thrusting: boolean[]
}

interface LegName {
  id: string
  label: string
}

/** Splits a path into legs wherever the engine starts or stops; burnAt and coastAt name a leg from its first instant. */
function legsOf(path: Flown, craft: 'capsule' | 'lander', frame: 'earth' | 'moon', burnAt: (tMs: number) => LegName, coastAt: (tMs: number) => LegName): MissionLeg[] {
  const legs: MissionLeg[] = []
  let start = 0
  for (let i = 1; i <= path.t.length; i++) {
    // sample i belongs to the stretch that begins at i − 1; a change of state closes the current leg at i − 1
    if (i === path.t.length || path.thrusting[i] !== path.thrusting[start]) {
      const end = i === path.t.length ? i - 1 : i
      if (end > start) {
        const powered = path.thrusting[start]
        const name = powered ? burnAt(path.t[start]) : coastAt(path.t[start])
        legs.push({ ...name, craft, frame, powered, track: { t: path.t.slice(start, end + 1), p: path.r.slice(start, end + 1) } })
      }
      start = i
    }
  }
  return legs
}

/** Removes repeated instants so a track's times are whole milliseconds, strictly increasing. */
function strict(leg: MissionLeg): MissionLeg {
  const t: number[] = []
  const p: Vec3[] = []
  leg.track.t.forEach((x, i) => {
    const ms = Math.round(x)
    if (t.length === 0 || ms > t[t.length - 1]) {
      t.push(ms)
      p.push(leg.track.p[i])
    }
  })
  return { ...leg, track: { t, p } }
}

const runPath = (run: SimRun, t0Ms: number, powered: boolean): Flown => ({
  t: run.t.map((s) => t0Ms + s * 1000),
  r: run.r,
  thrusting: run.t.map((_s, i) => powered && i < run.t.length - 1),
})

/** Mass a launch vehicle drops on the way up that is not propellant: spent stages, boosters, jettisoned parts. */
function droppedDuringAscent(lv: LaunchVehicleSpec): number {
  const stages = lv.stages.slice(0, -1).reduce((s, x) => s + x.dryKg, 0)
  const boosters = lv.boosters ? lv.boosters.dryKg * lv.boosters.count : 0
  return stages + boosters + lv.jettisons.reduce((s, x) => s + x.massKg, 0)
}

/** "Powered Descent Initiation (PDI)" → "PDI"; a label without an abbreviation gives its first word. */
function shortOf(label: string): string {
  const m = /\(([A-Z0-9-]{2,6})\)/.exec(label)
  return m ? m[1] : label.split(' ')[0]
}

// ---------------------------------------------------------------------------------------------------------
// Trans-Lunar Injection aimed at a flyby (the aiming of transit.ts, with the flyby's B vector as the target)
// ---------------------------------------------------------------------------------------------------------

/** The aiming has no solution near this liftoff (the launch azimuth cannot move the aim point when the
 *  launchpad lies on the line to the arrival point); the planner answers with a liftoff a little earlier or later. */
class NoLeverage extends FlightPlanError {
  constructor() {
    super('The translunar flight could not be aimed from this liftoff.')
  }
}

interface TliShot {
  tIgnMs: number
  coast: SimRun
  burn: SimRun
  tCutMs: number
  /** Closest approach of the unpowered flight to the Moon. */
  tPerMs: number
  rp: number
  vInf2: number
  S: Vec3 // incoming asymptote
  B: Vec3
  miss: [number, number]
  moonDistKm: number
}

interface TliInput {
  earth: EarthField
  guess: Guess
  insertion: OrbitState // at parking orbit insertion, Earth-centred
  stage: EngineUse & { dryKg: number; propellantKg: number }
  payloadKg: number
  /** The B vector the flyby should have, given its asymptote, squared excess speed and instant. */
  wantB(S: Vec3, vInf2: number, tPerMs: number): Vec3
  /** Radius the flyby is aimed at, for the check of the result. */
  flybyRadiusKm: number
}

/** Burn length and turn of the parking orbit plane about the launchpad direction for which the unpowered flight
 *  passes the Moon with the wanted B vector (the point where the incoming asymptote pierces the plane through
 *  the Moon's centre at right angles to it). */
function aimTli(inp: TliInput): { shot: TliShot; tauS: number; planeTurnRad: number } {
  const { earth, guess, stage, payloadKg } = inp
  const m0 = payloadKg + stage.dryKg + stage.propellantKg
  const flow = stage.thrustN / (G0 * stage.ispS)
  const cKms = (G0 * stage.ispS) / 1000
  const prograde = (_t: number, s: SimState) => unit(s.v)
  // range × range rate relative to the Moon once inside 120,000 km: zero at the closest approach
  const perilune = (_t: number, s: SimState, utcMs: number) => {
    const m = earth.moonState(utcMs)
    const d = sub(s.r, m.r)
    return norm(d) < 120000 ? dot(d, sub(s.v, m.v)) : -1
  }
  const aPark = 1 / (2 / norm(inp.insertion.r) - dot(inp.insertion.v, inp.insertion.v) / MU_EARTH)
  const nPark = Math.sqrt(MU_EARTH / aPark ** 3)

  const shoot = (tauS: number, dAz: number): TliShot | null => {
    if (!(tauS > 1) || tauS * flow >= m0) return null
    const r0 = rotateAbout(inp.insertion.r, guess.padHat, dAz)
    const v0 = rotateAbout(inp.insertion.v, guess.padHat, dAz)
    const h = unit(cross(r0, v0))
    const point = rotateAbout(guess.tliPoint, guess.padHat, dAz)
    // The burn straddles the injection point: half of it before, half after.
    let coastS = angleAbout(unit(r0), point, h) / nPark - tauS / 2
    while (coastS < 0) coastS += TWO_PI / nPark
    try {
      const coast = integrate(earth, { r: r0, v: v0, m: m0 }, inp.insertion.utcMs, { maxSeconds: coastS, maxStepS: 30 })
      const tIgnMs = inp.insertion.utcMs + coastS * 1000
      const burn = integrate(earth, coast.end, tIgnMs, { maxSeconds: tauS, maxStepS: 10, engine: constantThrust(stage.thrustN, stage.ispS, prograde) })
      const tCutMs = tIgnMs + tauS * 1000
      // The injection stage is left behind; the capsule coasts on.
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
      const S = add2(Pm, 1 / e, cross(hm, Pm), Math.sqrt(1 - 1 / (e * e)))
      const B = scale(cross(S, hm), (MU_MOON / vInf2) * Math.sqrt(e * e - 1))
      const off = sub(B, inp.wantB(S, vInf2, tPerMs))
      let T = cross(S, [0, 0, 1])
      if (norm(T) < 0.05) T = cross(S, [1, 0, 0])
      T = unit(T)
      return { tIgnMs, coast, burn, tCutMs, tPerMs, rp, vInf2, S, B, miss: [dot(off, T), dot(off, cross(S, T))], moonDistKm: norm(moon.r) }
    } catch (err) {
      if (err instanceof RangeError) return null
      throw err
    }
  }

  // Newton iteration on the B-plane miss with a step limit and backtracking.
  const size = (s: TliShot) => Math.hypot(s.miss[0], s.miss[1])
  const accEnd = stage.thrustN / (m0 * Math.exp(-guess.dvTliKms / cKms)) / 1000 // km/s² near cut-off
  const STEP_TAU = 1e-6 / accEnd // one millimetre per second of delta-v
  const STEP_AZ = 2e-6
  const MAX_TAU = 0.004 / accEnd
  const MAX_AZ = 0.03
  let x: [number, number] = [(m0 * (1 - Math.exp((-guess.dvTliKms * 1.005) / cKms))) / flow, 0]
  let cur = shoot(x[0], x[1])
  // A first guess that falls short of the Moon has no closest approach inside 120,000 km: lengthen the burn.
  for (let k = 0; !cur && k < 60; k++) {
    x = [x[0] * 1.003, 0]
    cur = shoot(x[0], 0)
  }
  if (!cur) throw new FlightPlanError('The translunar flight could not be aimed: the first guess does not reach the Moon.')
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
    let next: TliShot | null = null
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
  if (size(cur) > 0.5 || Math.abs(cur.rp - inp.flybyRadiusKm) > 0.5) throw new NoLeverage()
  return { shot: cur, tauS: x[0], planeTurnRad: x[1] }
}

/** a·x + b·y */
const add2 = (x: Vec3, a: number, y: Vec3, b: number): Vec3 => [x[0] * a + y[0] * b, x[1] * a + y[1] * b, x[2] * a + y[2] * b]

// ---------------------------------------------------------------------------------------------------------
// The mission
// ---------------------------------------------------------------------------------------------------------

/** Perilune passages of a reference orbit, the end of its last revolution included. */
function perilunes(orbit: NrhoOrbit): number[] {
  const revs = orbit.revolutions
  const last = revs[revs.length - 1]
  return [...revs.map((r) => r.periluneMs), last.periluneMs + last.periodS * 1000]
}

/** Runs a piece of the plan and turns the failures of the modules into the planner's own error, saying where. */
function phase<T>(what: string, run: () => T): T {
  try {
    return run()
  } catch (err) {
    if (err instanceof FlightPlanError) throw err
    if (err instanceof NrhoError || err instanceof LunarOpsError || err instanceof RangeError) throw new FlightPlanError(`${what}: ${err.message}`)
    throw err
  }
}

export function planMissionNrho(inp: MissionInput): MissionPlan {
  const { ephem, pad, target, launchVehicle: lv, capsule, lander } = inp
  const parkingAltKm = inp.parkingAltKm ?? 185
  const lloAltKm = inp.lunarOrbitAltKm ?? 100
  const pdiAltKm = inp.pdiAltKm ?? 15
  const flybyAltKm = 100
  const rFly = R_MOON + flybyAltKm
  const entryFpaDeg = inp.entryFpaDeg ?? ARTEMIS_ENTRY_FPA_DEG
  const capsuleEngine = engineOf(capsule, capsule.modules.find((m) => m.engine))
  const capsuleMass = totalMass(capsule)
  const payloadKg = capsuleMass // the lander is not on this launch
  const tliStage = lv.stages[lv.stages.length - 1]
  if (!tliStage.engine) throw new FlightPlanError(`${tliStage.name} has no engine.`)
  const tliEngine = tliStage.engine
  if (lander.modules.length === 0) throw new FlightPlanError(`${lander.name} has no modules.`)
  const twoStage = lander.modules.length > 1
  const ascentElement = lander.modules[0]
  const descentElement = lander.modules[lander.modules.length - 1]
  const descentEngine = engineOf(lander, descentElement).use
  const ascentEngine = engineOf(lander, lander.modules.find((m) => m.engine)).use
  const notes: string[] = []
  // whole revolutions of the NRHO between the lander's two passages of the Moon
  const surfaceRevs = Math.max(1, Math.round((inp.surfaceStayDays * DAY_S) / NRHO_PERIOD_S))
  const windowDays = inp.returnWindowDays > 0 ? inp.returnWindowDays : NRHO_PERIOD_S / DAY_S

  // ---- 1. How long and how far the ascent goes: one flight due east from this latitude.
  const lat = pad.latDeg * DEG
  const pad0: Vec3 = [Math.cos(lat), 0, Math.sin(lat)]
  const fly = (padEci: Vec3, pole: Vec3, planeNormal: Vec3): AscentResult =>
    simulateAscent({ vehicle: lv, payloadKg, padEci, pole, target: { planeNormal, perigeeKm: parkingAltKm, apogeeKm: parkingAltKm } })
  const trial = fly(pad0, [0, 0, 1], cross(pad0, [0, 1, 0]))

  // ---- 2. Liftoff, ascent and injection, aimed at a flyby 100 km above the Moon's northern hemisphere, where
  // the NRHO has its perilune. guess.ts picks the liftoff as for a lunar orbit insertion at the flyby; what it
  // calls the time from the insertion to touchdown is here the lander's wait for the NRHO's next perilune.
  const guessInput: GuessInput = {
    ephem,
    padLatDeg: pad.latDeg,
    padLonDeg: pad.lonDeg,
    siteLatDeg: -90,
    siteLonDeg: 0,
    parkingAltKm,
    lunarOrbitAltKm: flybyAltKm,
    ascentTimeS: trial.insertion.tS,
    ascentArcRad: trial.downrangeAngleRad,
    maxTransferDays: inp.maxTransferDays,
    earliestTouchdownMs: inp.earliestTouchdownMs,
    orbitToTouchdownS: (PERIOD_MS - FLYBY_AFTER_PERILUNE_MS + LOW_ORBIT_TO_TOUCHDOWN_MS) / 1000,
  }
  const northAt = (utcMs: number) => qrot(ephem.moonFixedToInertial(utcMs), [0, 0, 1])
  const overTheNorth = (S: Vec3, vInf2: number, tPerMs: number): Vec3 => {
    const north = northAt(tPerMs)
    return scale(unit(sub(north, scale(S, dot(north, S)))), Math.sqrt(rFly * rFly + (2 * MU_MOON * rFly) / vInf2))
  }
  interface Outbound {
    guess: Guess
    ascent: AscentResult
    earth: EarthField
    tli: { shot: TliShot; tauS: number; planeTurnRad: number }
    stage: EngineUse & { dryKg: number; propellantKg: number }
  }
  const outboundFor = (guess: Guess, wantB: TliInput['wantB']): Outbound => {
    let earth: EarthField
    try {
      earth = earthField(ephem, guess.liftoffMs - HOUR_MS, guess.loiMs + 2.5 * DAY_S * 1000, guess.pole)
    } catch (err) {
      if (err instanceof RangeError) throw new FlightPlanError('The ephemeris does not cover this flight.')
      throw err
    }
    let turn = 0 // turn of the orbit plane about the pad direction asked for by the aiming, summed over passes
    for (let pass = 0; pass < 5; pass++) {
      const planeNormal = unit(rotateAbout(guess.planeNormal, guess.padHat, turn))
      const g: Guess = { ...guess, planeNormal, tliPoint: rotateAbout(guess.tliPoint, guess.padHat, turn) }
      const ascent = fly(guess.padHat, guess.pole, planeNormal)
      const stage = {
        name: `${tliStage.name}, ${tliEngine.name}`,
        thrustN: tliEngine.thrustVacN * tliEngine.count,
        ispS: tliEngine.ispVacS,
        dryKg: ascent.upperStageDryKg,
        propellantKg: ascent.upperStagePropellantKg,
      }
      const tli = aimTli({
        earth,
        guess: g,
        insertion: { utcMs: guess.liftoffMs + ascent.insertion.tS * 1000, r: ascent.insertion.r, v: ascent.insertion.v },
        stage,
        payloadKg,
        wantB,
        flybyRadiusKm: rFly,
      })
      turn += tli.planeTurnRad
      // 0.002°: the ascent was flown into the plane the translunar flight needs
      if (Math.abs(tli.planeTurnRad) < 3.5e-5) return { guess: g, ascent, earth, tli, stage }
    }
    throw new FlightPlanError('Ascent and translunar flight did not settle on a common orbit plane.')
  }
  const launch = (): Outbound => {
    for (const shiftMin of [0, 20, -20, 40, -40, 60, -60, 90, -90]) {
      try {
        return outboundFor(firstGuess(guessInput, shiftMin), overTheNorth)
      } catch (err) {
        if (!(err instanceof NoLeverage)) throw err
      }
    }
    throw new FlightPlanError('The translunar flight could not be aimed for this launchpad.')
  }

  // ---- 3. The NRHO, phased for this arrival: a perilune 3.5 hours before the flyby. Its span runs from before
  // the arrival to the latest departure for home.
  const nrhoFor = (flybyMs: number): NrhoOrbit => {
    const want = flybyMs - FLYBY_AFTER_PERILUNE_MS
    const endMs = flybyMs + (surfaceRevs + 2.3) * PERIOD_MS + windowDays * DAY_S * 1000
    const fromMs = flybyMs - 0.5 * PERIOD_MS
    const build = (refMs: number) => nrhoAround(ephem, 0.5 * (fromMs + endMs), Math.ceil((endMs - fromMs) / PERIOD_MS), refMs)
    let refMs = want
    let orbit = build(refMs)
    // nrhoAround puts the perilunes near its grid, to within an hour: shift the grid by what is missing
    for (let pass = 0; pass < 2; pass++) {
      const off = perilunes(orbit).reduce((best, p) => (Math.abs(p - want) < Math.abs(best) ? p - want : best), Infinity)
      if (Math.abs(off) < 5 * MIN_MS) break
      refMs -= off
      orbit = build(refMs)
    }
    return orbit
  }
  let out = launch()
  let nrho = phase('The reference NRHO', () => nrhoFor(out.tli.shot.tPerMs))
  const firstPeriluneAfter = (orbit: NrhoOrbit, utcMs: number) => {
    const p = perilunes(orbit).find((x) => x > utcMs)
    if (p === undefined) throw new FlightPlanError('The reference NRHO ends before the lander can leave it.')
    return p
  }
  // The touchdown follows the NRHO's first perilune after the arrival. guess.ts timed the liftoff with a round
  // figure for that wait; when the real one puts the touchdown before the earliest asked for, or more than a
  // day of launch opportunities after it, the liftoff is chosen again with the wait just found.
  for (let pass = 0; pass < 2; pass++) {
    const soonest = firstPeriluneAfter(nrho, out.tli.shot.tPerMs + 0.5 * DAY_S * 1000) + LOW_ORBIT_TO_TOUCHDOWN_MS
    if (soonest >= inp.earliestTouchdownMs && soonest < inp.earliestTouchdownMs + 25 * HOUR_MS) break
    guessInput.orbitToTouchdownS = (soonest - out.guess.loiMs) / 1000
    out = launch()
    nrho = phase('The reference NRHO', () => nrhoFor(out.tli.shot.tPerMs))
  }
  const { guess, ascent, tli } = out
  const shot = tli.shot
  const liftoffMs = guess.liftoffMs
  const field: Field = nrho.field

  // ---- 4. The capsule's arrival: trajectory correction, Outbound Powered Flyby, NRHO Insertion.
  const arrival = phase('Arrival on the NRHO', () =>
    earthToNrho({
      ephem,
      nrho,
      start: { utcMs: shot.tCutMs, r: shot.burn.end.r, v: shot.burn.end.v, massKg: payloadKg, frame: 'earth' },
      thrustN: capsuleEngine.use.thrustN,
      ispS: capsuleEngine.use.ispS,
      flybyAltKm,
      earthPole: guess.pole,
    }),
  )
  const nriEndMs = arrival.end.utcMs
  const capsuleOnNrhoKg = arrival.end.massKg

  // ---- 5. The lander: down at the NRHO's next perilune, back one or more revolutions later.
  const siteUnit = latLonUnit(target.latDeg, target.lonDeg)
  const site = (utcMs: number): Vec3 => scale(qrot(ephem.moonFixedToInertial(utcMs), siteUnit), R_MOON)
  const downPeriluneMs = firstPeriluneAfter(nrho, nriEndMs + DOCKED_BEFORE_UNDOCKING_MS + LANDER_TRANSFER_DAYS * DAY_S * 1000)
  const undockMs = phase('The lander', () => nrhoDepartureMs(nrho, nriEndMs + DOCKED_BEFORE_UNDOCKING_MS, LANDER_TRANSFER_DAYS))
  const upPeriluneMs = perilunes(nrho).filter((p) => p > downPeriluneMs + 0.5 * PERIOD_MS)[surfaceRevs - 1]
  if (upPeriluneMs === undefined) throw new FlightPlanError('The reference NRHO ends before the lander comes back.')
  const backOnNrhoMs = upPeriluneMs + LANDER_TRANSFER_DAYS * DAY_S * 1000
  const plannedTouchdownMs = Math.max(inp.earliestTouchdownMs, downPeriluneMs + LOW_ORBIT_TO_TOUCHDOWN_MS)
  const lloPeriodS = TWO_PI * Math.sqrt((R_MOON + lloAltKm) ** 3 / MU_MOON)
  // the low orbit's plane contains the site when the lander comes down, and again when it lifts off
  const siteDown = siteDirection(ephem, target.latDeg, target.lonDeg, plannedTouchdownMs)
  const siteUp = siteDirection(ephem, target.latDeg, target.lonDeg, upPeriluneMs - 2.5 * HOUR_MS)

  /** The state `hours` before a state on a ballistic path (the field run backwards). */
  const earlier = (s: OrbitState, hours: number): OrbitState => {
    const back: Field = { centre: field.centre, accel: (r, utcMs, o) => field.accel(r, 2 * s.utcMs - utcMs, o) }
    const end = integrate(back, { r: s.r, v: scale(s.v, -1), m: 1 }, s.utcMs, { maxSeconds: hours * 3600, maxStepS: 60 }).end
    return { utcMs: s.utcMs - hours * HOUR_MS, r: end.r, v: scale(end.v, -1) }
  }
  /** The lander's whole sortie from a given mass on the NRHO. propellantKg: what a single-module lander has on
   *  board at the start (a two-stage lander starts with full elements). */
  const sortie = (startKg: number, propellantKg: number | null, passes: number) => {
    const down = nrhoToLlo({ nrho, departMs: undockMs, siteDir: siteDown, thrustN: descentEngine.thrustN, ispS: descentEngine.ispS, massKg: startKg, lloAltKm })
    const lowOrbit: OrbitState = { utcMs: down.end.utcMs, r: down.end.r, v: down.end.v }
    const left = propellantKg === null ? undefined : propellantKg - (startKg - down.end.massKg)
    const descend = (earliestMs: number) =>
      planDescent({ field, orbit: lowOrbit, earliestMs, site, lander, massKg: down.end.massKg, pdiAltKm, propellantKg: left })
    // Descent orbit insertion not before the lander has settled in its orbit, and late enough for the touchdown
    // (half a revolution and the powered descent later) to come after the earliest one asked for.
    let descent = descend(Math.max(down.end.utcMs + 20 * MIN_MS, inp.earliestTouchdownMs - 1.3 * HOUR_MS))
    for (let pass = 0; pass < 3 && descent.touchdownMs < inp.earliestTouchdownMs; pass++) {
      const began = descent.events.find((e) => e.id === 'doi')?.utcMs ?? descent.path.t[0]
      descent = descend(began + (inp.earliestTouchdownMs - descent.touchdownMs) + 1000)
    }
    // Ascent into the low orbit from which the way back to the NRHO starts. lloToNrho says which orbit that is
    // and where on it the lander must be (the start of its path); the ascent flies a rendezvous with that
    // point. The departure burn's length depends on the mass the ascent leaves, so the two are solved in turn.
    const liftoffKg = twoStage ? massOf(ascentElement) : descent.massAtTouchdownKg
    const onBoard = twoStage ? undefined : descent.propellantLeftKg
    const back = (massKg: number) =>
      lloToNrho({ nrho, arriveMs: backOnNrhoMs, siteDir: siteUp, thrustN: ascentEngine.thrustN, ispS: ascentEngine.ispS, massKg, lloAltKm })
    let up = back(liftoffKg * Math.exp(-1900 / (G0 * ascentEngine.ispS)))
    let climb = null as ReturnType<typeof planAscent> | null
    let meet: OrbitState = up.start
    for (let pass = 0; pass < passes; pass++) {
      const from = up.start
      meet = earlier({ utcMs: from.utcMs, r: from.r, v: from.v }, 7)
      // liftoff opportunities come once per revolution of the low orbit; ascent and rendezvous take about two hours
      let earliestMs = from.utcMs - 4.3 * HOUR_MS
      for (let again = 0; again < 3; again++) {
        climb = planAscent({
          field, site, earliestMs, target: meet, lander, massKg: liftoffKg, propellantKg: onBoard,
          insertionAltKm: { perilune: pdiAltKm, apolune: Math.max(pdiAltKm + 20, 0.8 * lloAltKm) },
        })
        if (climb.dockingMs <= from.utcMs) break
        earliestMs -= lloPeriodS * 1000
      }
      if (!climb || climb.dockingMs > from.utcMs) throw new FlightPlanError('The lander does not reach its departure orbit in time for the way back to the NRHO.')
      up = back(climb.massAtDockingKg)
    }
    if (!climb) throw new FlightPlanError('The lander ascent was not planned.')
    return { down, lowOrbit, descent, climb, meet, up, usedKg: startKg - up.end.massKg - (twoStage ? massOf(descentElement) : 0) }
  }
  let landerStartKg = totalMass(lander)
  let flownSortie: ReturnType<typeof sortie>
  if (twoStage) {
    flownSortie = phase('The lander', () => sortie(landerStartKg, null, 2))
  } else {
    // A single-module lander is loaded with what this sortie takes (both transfers, descent and ascent on one
    // load) and half a percent more. The mass ratio of the sortie hardly depends on the load, so one sizing
    // flight gives the load and a second one is the flight of the plan.
    const dry = descentElement.dryKg
    let load = dry * (Math.exp(5500 / (G0 * descentEngine.ispS)) - 1)
    let found: ReturnType<typeof sortie> | null = null
    for (let pass = 0; pass < 5 && !found; pass++) {
      let s: ReturnType<typeof sortie>
      try {
        s = sortie(dry + load, load, 1)
      } catch (err) {
        if (err instanceof LunarOpsError && /Not enough propellant/.test(err.message)) {
          load *= 1.08
          continue
        }
        if (err instanceof NrhoError || err instanceof LunarOpsError) throw new FlightPlanError(`The lander: ${err.message}`)
        throw err
      }
      const leftKg = load - s.usedKg
      if (leftKg >= 0 && leftKg <= 0.012 * load) {
        landerStartKg = dry + load
        found = phase('The lander', () => sortie(dry + load, load, 2))
      } else {
        load = dry * ((dry + load) / (dry + leftKg) - 1) * 1.005
      }
    }
    if (!found) throw new FlightPlanError(`${lander.name}: the propellant load for the sortie from the NRHO did not settle.`)
    flownSortie = found
  }
  const { down, lowOrbit, descent, climb, meet, up } = flownSortie
  const touchdownMs = descent.touchdownMs
  const dockingMs = up.end.utcMs

  // ---- 6. Home: NRHO Departure at the cheapest instant of the window, Return Powered Flyby, Entry Interface.
  const home = phase('Return to Earth', () =>
    nrhoToEarth({
      ephem,
      nrho,
      earliestMs: dockingMs + DOCKED_BEFORE_DEPARTURE_MS,
      windowDays,
      massKg: capsuleOnNrhoKg,
      thrustN: capsuleEngine.use.thrustN,
      ispS: capsuleEngine.use.ispS,
      entryFpaDeg,
      entryAltKm: inp.entryAltKm ?? 121.92,
      flybyAltKm,
    }),
  )
  const endMs = Math.round(home.entry.utcMs)

  // ---- 7. Legs. Paths of nrho.ts are Moon-centred; the two long coasts are handed out Earth-centred.
  const toEarth = (leg: MissionLeg): MissionLeg => {
    const p = pathInFrame(ephem, { t: leg.track.t, r: leg.track.p, v: leg.track.p, thrusting: [], frame: 'moon' }, 'earth').r
    return { ...leg, frame: 'earth', track: { t: leg.track.t, p } }
  }
  const burnNames = (events: TransferEvent[], names: Record<string, LegName>) => (tMs: number): LegName => {
    const e = events.find((x) => tMs >= x.utcMs - 1 && tMs < x.utcMs + x.durationS * 1000)
    return (e && names[e.id]) || { id: 'burn', label: 'Engine burn' }
  }
  const opf = arrival.events.find((e) => e.id === 'opf')!
  const nri = arrival.events.find((e) => e.id === 'nri')!
  const otc = arrival.events.find((e) => e.id === 'otc')
  const nrd = home.events.find((e) => e.id === 'nrd')!
  const rpf = home.events.find((e) => e.id === 'rpf')!
  const arrivalLegs = legsOf(
    arrival.path, 'capsule', 'moon',
    burnNames(arrival.events, {
      otc: { id: 'otc', label: 'Outbound Trajectory Correction, engine burn' },
      opf: { id: 'opf', label: 'Outbound Powered Flyby, engine burn' },
      nri: { id: 'loi', label: 'NRHO Insertion, engine burn' },
    }),
    (tMs) => (tMs < opf.utcMs ? { id: 'translunar', label: 'Translunar coast' } : { id: 'nrho-approach', label: 'Coast to the NRHO' }),
  ).map((leg) => (leg.track.t[0] < opf.utcMs ? toEarth(leg) : leg))
  const homeLegs = legsOf(
    home.path, 'capsule', 'moon',
    burnNames(home.events, {
      nrd: { id: 'tei', label: 'NRHO Departure, engine burn' },
      rpf: { id: 'rpf', label: 'Return Powered Flyby, engine burn' },
    }),
    (tMs) => {
      if (tMs < nrd.utcMs) return { id: 'nrho', label: 'Near-rectilinear halo orbit' }
      return tMs < rpf.utcMs ? { id: 'nrho-departure', label: 'Coast to the return flyby' } : { id: 'transearth', label: 'Trans-Earth coast' }
    },
  ).map((leg) => (leg.id === 'transearth' ? toEarth(leg) : leg))
  // The capsule on the NRHO, from the insertion cut-off to the start of the return path: the reference orbit,
  // sampled every 10 minutes (every 2 minutes near the Moon) and at the instants the lander leaves and returns.
  const waitT: number[] = [nriEndMs]
  const waitEndMs = home.path.t[0]
  const marks = [undockMs, dockingMs, waitEndMs].sort((a, b) => a - b)
  for (let t = nriEndMs; t < waitEndMs; ) {
    const near = norm(nrho.stateAt(t).r) < 20000
    let next = t + (near ? 2 : 10) * MIN_MS
    const mark = marks.find((m) => m > t && m <= next)
    if (mark !== undefined) next = mark
    waitT.push(Math.min(next, waitEndMs))
    t = next
  }
  const waitLeg: MissionLeg = {
    id: 'nrho', label: 'Near-rectilinear halo orbit', craft: 'capsule', frame: 'moon', powered: false,
    track: { t: waitT, p: waitT.map((t, i) => (i === 0 ? arrival.end.r : nrho.stateAt(t).r)) },
  }
  // The lander between its burns in low lunar orbit: before the descent, and from the end of the ascent's
  // rendezvous with its departure point to the departure.
  const coastLeg = (from: OrbitState, toMs: number, id: string, label: string): MissionLeg => {
    const run = integrate(field, { r: from.r, v: from.v, m: 1 }, from.utcMs, { maxSeconds: Math.max(0, (toMs - from.utcMs) / 1000), maxStepS: 60 })
    return { id, label, craft: 'lander', frame: 'moon', powered: false, track: { t: run.t.map((s) => from.utcMs + s * 1000), p: run.r } }
  }
  const atMeeting = integrate(field, { r: meet.r, v: meet.v, m: 1 }, meet.utcMs, { maxSeconds: (climb.dockingMs - meet.utcMs) / 1000, maxStepS: 60 }).end
  const surfaceT: number[] = []
  for (let t = touchdownMs; t < climb.liftoffMs; t += 0.5 * HOUR_MS) surfaceT.push(t)
  surfaceT.push(climb.liftoffMs)
  const named = (id: string, label: string) => () => ({ id, label })
  const ascentPath: Flown = { t: ascent.t.map((s) => liftoffMs + s * 1000), r: ascent.r, thrusting: ascent.thrusting }
  const insertionMs = liftoffMs + ascent.insertion.tS * 1000
  const allLegs: MissionLeg[] = [
    ...legsOf(ascentPath, 'capsule', 'earth', named('ascent', 'Ascent, engine burn'), named('ascent', 'Ascent')),
    ...legsOf(runPath(shot.coast, insertionMs, false), 'capsule', 'earth', named('parking', 'Parking orbit'), named('parking', 'Parking orbit')),
    ...legsOf(runPath(shot.burn, shot.tIgnMs, true), 'capsule', 'earth', named('tli', 'Trans-Lunar Injection'), named('tli', 'Trans-Lunar Injection')),
    ...arrivalLegs,
    waitLeg,
    ...homeLegs,
    ...legsOf(down.path, 'lander', 'moon', named('nrho-to-llo', 'NRHO to low lunar orbit, engine burn'), named('nrho-to-llo', 'NRHO to low lunar orbit')),
    coastLeg(lowOrbit, descent.path.t[0], 'lunar-orbit', 'Low lunar orbit'),
    ...legsOf(descent.path, 'lander', 'moon', named('descent', 'Descent, engine burn'), named('descent', 'Descent')),
    { id: 'surface', label: 'On the surface', craft: 'lander', frame: 'moon', powered: false, track: { t: surfaceT, p: surfaceT.map(site) } },
    ...legsOf(climb.path, 'lander', 'moon', named('lunar-ascent', 'Ascent to low lunar orbit, engine burn'), named('lunar-ascent', 'Ascent to low lunar orbit')),
    coastLeg({ utcMs: climb.dockingMs, r: atMeeting.r, v: atMeeting.v }, up.path.t[0], 'lunar-orbit', 'Low lunar orbit'),
    ...legsOf(up.path, 'lander', 'moon', named('llo-to-nrho', 'Low lunar orbit to NRHO, engine burn'), named('llo-to-nrho', 'Low lunar orbit to NRHO')),
  ]
  const legs = allLegs.map(strict).filter((l) => l.track.t.length > 1)

  // ---- 8. Events.
  const ev = (e: Partial<MissionEvent> & { id: string; label: string; utcMs: number }): MissionEvent => ({
    short: shortOf(e.label), craft: 'capsule', kind: 'event', by: null, dvKms: null, propellantKg: null, durationS: null, massAfterKg: null, ...e,
  })
  /** What a burn of nrho.ts delivered and used, in the fields of a mission event. */
  const burnt = (e: TransferEvent) => ({ kind: 'burn' as const, dvKms: e.dvKms, propellantKg: e.propellantKg, durationS: e.durationS, massAfterKg: e.massAfterKg })
  const capsuleBurn = (e: TransferEvent | undefined, id: string): MissionEvent[] =>
    e ? [ev({ id, label: e.label, utcMs: e.utcMs, by: capsuleEngine.use.name, ...burnt(e) })] : []
  const landerBurns = (tr: Transfer, ids: Record<string, string>): MissionEvent[] =>
    tr.events.map((e) => ev({ id: ids[e.id] ?? e.id, label: e.label, utcMs: e.utcMs, craft: 'lander', by: lander.name, ...burnt(e) }))
  const landerOps = (events: LunarEvent[], rename: Record<string, { id: string; label: string } | null>): MissionEvent[] =>
    events
      .filter((e) => rename[e.id] !== null)
      .map((e) =>
        ev({
          id: rename[e.id]?.id ?? e.id, label: rename[e.id]?.label ?? e.label, utcMs: e.utcMs, craft: 'lander',
          kind: e.dvKms ? 'burn' : 'event', by: e.dvKms ? lander.name : null,
          dvKms: e.dvKms ?? null, propellantKg: e.propellantKg ?? null, durationS: e.durationS ?? null, massAfterKg: e.massAfterKg ?? null,
        }),
      )
  const m0Tli = payloadKg + out.stage.dryKg + out.stage.propellantKg
  const tliEvent = ev({
    id: 'tli', label: 'Trans-Lunar Injection (TLI)', utcMs: shot.tIgnMs, kind: 'burn', by: out.stage.name,
    dvKms: (G0 * out.stage.ispS * Math.log(m0Tli / shot.burn.end.m)) / 1000, propellantKg: m0Tli - shot.burn.end.m, durationS: tli.tauS, massAfterKg: payloadKg,
  })
  const events: MissionEvent[] = [
    ev({
      id: 'ascent', short: 'Launch', label: 'Launch and ascent to Earth parking orbit', utcMs: liftoffMs, kind: 'burn', by: lv.name,
      dvKms: ascent.budget.idealDvKms, propellantKg: ascent.m[0] - ascent.insertion.massKg - droppedDuringAscent(lv), durationS: ascent.insertion.tS,
      massAfterKg: ascent.insertion.massKg,
    }),
    ...ascent.events.filter((e) => e.id !== 'liftoff').map((e) => ev({ id: `ascent-${e.id}`, short: '', label: e.label, utcMs: liftoffMs + e.tS * 1000 })),
    tliEvent,
    ...capsuleBurn(otc, 'otc'),
    ...capsuleBurn(opf, 'opf'),
    ...capsuleBurn(nri, 'loi'),
    ev({ id: 'nrho-docking', short: 'Docking', label: 'Docking with the lander on the NRHO', utcMs: nriEndMs + FIRST_DOCKING_AFTER_NRI_MS, massAfterKg: capsuleOnNrhoKg }),
    ev({ id: 'undocking', label: 'Undocking', utcMs: undockMs, craft: 'lander', massAfterKg: landerStartKg }),
    ...landerBurns(down, { loi: 'lander-loi' }),
    ...landerOps(descent.events, { undocking: null }),
    ...landerOps(climb.events, { liftoff: { id: 'lunar-liftoff', label: 'Liftoff' }, docking: { id: 'llo-arrival', label: 'In low lunar orbit for the departure' } }),
    ...landerBurns(up, {}),
    ev({ id: 'docking', label: 'Docking', utcMs: dockingMs, craft: 'lander', massAfterKg: up.end.massKg }),
    ...capsuleBurn(nrd, 'tei'),
    ...capsuleBurn(rpf, 'rpf'),
    ev({ id: 'ei', short: 'EI', label: 'Entry Interface (EI)', utcMs: home.entry.utcMs, massAfterKg: home.end.massKg }),
  ]
    .map((e) => ({ ...e, utcMs: Math.round(e.utcMs) }))
    .sort((a, b) => a.utcMs - b.utcMs)

  // ---- 9. What every element has to carry.
  const capsuleUsedKg = payloadKg - capsuleOnNrhoKg + (capsuleOnNrhoKg - home.end.massKg)
  const propellant: PropellantUse[] = [
    { element: tliStage.name, usedKg: tliStage.propellantKg - ascent.upperStagePropellantKg + (tliEvent.propellantKg ?? 0), capacityKg: tliStage.propellantKg },
    { element: capsuleEngine.module.name, usedKg: capsuleUsedKg, capacityKg: capsuleEngine.module.propellantKg },
  ]
  if (twoStage) {
    propellant.push({ element: descentElement.name, usedKg: descentElement.propellantKg - descent.propellantLeftKg, capacityKg: descentElement.propellantKg })
    propellant.push({
      element: ascentElement.name,
      usedKg: ascentElement.propellantKg - climb.propellantLeftKg + (climb.massAtDockingKg - up.end.massKg),
      capacityKg: ascentElement.propellantKg,
    })
  } else {
    propellant.push({ element: descentElement.name, usedKg: flownSortie.usedKg, capacityKg: descentElement.propellantKg })
  }
  for (const u of propellant) {
    if (u.usedKg > u.capacityKg) notes.push(`${u.element}: this mission needs ${((u.usedKg - u.capacityKg) / 1000).toFixed(1)} t more propellant than it carries.`)
  }

  // ---- 10. Facts and notes.
  const stayDays = (climb.liftoffMs - touchdownMs) / (DAY_S * 1000)
  const revsFlown = nrho.revolutions.filter((r) => r.periluneMs + r.periodS * 1000 > nriEndMs && r.periluneMs < home.path.t[0])
  const mean = (f: (r: (typeof revsFlown)[number]) => number) => revsFlown.reduce((s, r) => s + f(r), 0) / Math.max(1, revsFlown.length)
  const atDeparture = nrho.stateAt(home.path.t[0])
  const departureNormal = unit(cross(atDeparture.r, atDeparture.v))
  const moonVel = unit(ephem.moonVel(home.path.t[0]))
  const periluneBeforeFlyby = perilunes(nrho).filter((p) => p <= arrival.flyby.utcMs).pop() ?? NaN
  const t1 = (kg: number) => (kg / 1000).toFixed(1)
  const periodDays = (NRHO_PERIOD_S / DAY_S).toFixed(2)
  const phaseH = ((arrival.flyby.utcMs - periluneBeforeFlyby) / HOUR_MS).toFixed(1)
  notes.push(
    `${lander.name} is not on this launch: it is taken to be waiting on the NRHO, and the capsule alone (${t1(payloadKg)} t) is the ` +
      `payload of ${lv.name}. How the lander gets there (its own launches, refilling, its transfer) is not part of this plan.`,
    `The phase of the NRHO is chosen for this arrival: its perilune passage falls ${phaseH} hours before the capsule's flyby, where the ` +
      'arrival is cheapest. A real mission flies to an orbit whose phase is given and picks the launch day that fits; a day off, the ' +
      'arrival costs more than twice as much.',
    'On the NRHO the capsule is taken to follow the reference orbit, which its arrival meets to within 20 m and 2 cm/s; the small burns ' +
      'that hold a real spacecraft on this unstable orbit (station keeping) are not flown.',
    `The first docking, ${(FIRST_DOCKING_AFTER_NRI_MS / HOUR_MS).toFixed(0)} hours after the NRHO insertion, is an event only: no rendezvous ` +
      'is flown, the lander is taken to be where the capsule arrives. Until it undocks the lander is shown with the capsule, also before ' +
      'that docking.',
    `The lander can leave for the surface and come back only when the NRHO passes the Moon, every ${periodDays} days. ` +
      `Asked for ${inp.surfaceStayDays} days on the surface, it stays ${stayDays.toFixed(2)} days: ${surfaceRevs} revolution${surfaceRevs > 1 ? 's' : ''} ` +
      'of the NRHO less the time in low lunar orbit before the descent and after the ascent.',
  )
  if (!twoStage) {
    notes.push(
      `${lander.name} starts from the NRHO with the propellant this sortie takes and 0.5 % more (${t1(flownSortie.usedKg)} t used of ` +
        `${t1(landerStartKg - descentElement.dryKg)} t loaded; its tanks hold ${(descentElement.propellantKg / 1000).toFixed(0)} t): ` +
        'both transfers, the descent and the ascent on one load.',
    )
  }
  if (touchdownMs > inp.earliestTouchdownMs + 26 * HOUR_MS) {
    notes.push(
      "The touchdown comes more than a day after the earliest one asked for: the launch day and the NRHO's passage of the Moon did not fit closer.",
    )
  }
  if (inp.returnWindowDays <= 0) {
    notes.push(
      `No return window was given; the capsule leaves at the cheapest instant within one revolution of the NRHO (${periodDays} days) ` +
        'after the lander is back. Leaving at once can cost more than twice as much.',
    )
  }
  notes.push(
    'Orbit figures: "lunar orbit" perilune, apolune and inclination are those of the NRHO the capsule stays on (the lander uses a ' +
      `${lloAltKm} km circular orbit); the hours in orbit before landing run from the NRHO insertion cut-off and include the wait on the ` +
      "NRHO and the lander's transfer; the return plane offset is the angle between the NRHO's plane and the direction home at the " +
      'departure, which here costs nothing by itself because the flyby turns the path.',
    `Entry Interface at ${entryFpaDeg}° (Artemis I: −5.66°); where on Earth the entry happens is not constrained (a real mission aims ` +
      'at a recovery zone).',
  )
  if (descent.crossRangeDeg > 0.2) {
    notes.push(`The landing point was ${descent.crossRangeDeg.toFixed(1)}° off the orbit plane at descent; the lander steered sideways to reach it.`)
  }
  if (climb.planeChangeDeg > 0.5) {
    notes.push(
      `At liftoff the landing point was ${climb.planeChangeDeg.toFixed(1)}° off the departure orbit's plane; the ascent paid for that plane change.`,
    )
  }

  const park = apsides(MU_EARTH, ascent.insertion.r, ascent.insertion.v)
  const east = unit(cross(guess.pole, guess.padHat))
  const vHat = cross(guess.planeNormal, guess.padHat)
  const az = Math.atan2(dot(vHat, east), dot(vHat, cross(guess.padHat, east))) / DEG
  const sources: SourceRef[] = []
  for (const s of [...lv.sources, ...lv.stages.flatMap((x) => x.sources), ...capsule.sources, ...lander.sources, pad.source, ...NRHO_SOURCES]) {
    if (s.url && !sources.some((x) => x.url === s.url)) sources.push(s)
  }
  return {
    pad,
    target,
    ephem,
    architecture: { id: inp.architecture.id, name: inp.architecture.name, launchVehicle: lv.name, capsule: capsule.name, lander: lander.name },
    launchMs: liftoffMs,
    touchdownMs,
    lunarLiftoffMs: climb.liftoffMs,
    dockingMs: Math.round(dockingMs),
    endMs,
    legs,
    events,
    propellant,
    facts: {
      launchAzimuthDeg: az < 0 ? az + 360 : az,
      parkingInclDeg: Math.acos(Math.max(-1, Math.min(1, dot(unit(cross(ascent.insertion.r, ascent.insertion.v)), guess.pole)))) / DEG,
      parkingPerigeeKm: park.rp - R_EARTH_EQ,
      parkingApogeeKm: park.ra - R_EARTH_EQ,
      ascentLossKms: { gravity: ascent.budget.gravityLossKms, drag: ascent.budget.dragLossKms, steering: ascent.budget.steeringLossKms },
      transferDays: (nriEndMs - shot.tIgnMs) / (DAY_S * 1000),
      moonDistKm: shot.moonDistKm,
      vInfKms: Math.sqrt(shot.vInf2),
      lunarPeriluneKm: mean((r) => r.periluneRadiusKm) - R_MOON,
      lunarApoluneKm: mean((r) => r.apoluneRadiusKm) - R_MOON,
      lunarInclDeg: Math.acos(Math.max(-1, Math.min(1, dot(unit(cross(arrival.end.r, arrival.end.v)), northAt(nriEndMs))))) / DEG,
      orbitBeforeLandingH: (touchdownMs - nriEndMs) / HOUR_MS,
      landingMissM: descent.missM,
      surfaceStayDays: stayDays,
      returnPlaneOffDeg: Math.asin(Math.min(1, Math.abs(dot(departureNormal, moonVel)))) / DEG,
      returnDays: home.returnDays,
      entry: { speedKms: home.entry.speedKms, fpaDeg: home.entry.fpaDeg, latDeg: home.entry.latDeg, lonDeg: home.entry.lonDeg },
      missionDays: (endMs - liftoffMs) / (DAY_S * 1000),
    },
    notes,
    sources,
  }
}
