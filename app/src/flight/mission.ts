// A whole Moon mission by lunar orbit rendezvous, for any launch vehicle, capsule and lander given as data
// (hardware.ts) and any launchpad and landing point:
//
//   liftoff → ascent to a parking orbit → Trans-Lunar Injection → translunar coast → Lunar Orbit Insertion →
//   undocking → descent orbit → powered descent to the chosen point → surface stay → ascent → rendezvous and
//   docking → Trans-Earth Injection → trans-Earth coast → Entry Interface.
//
// Every phase is integrated with thrust and propellant flow by its own module: ascent.ts (through the
// atmosphere), transit.ts (the two crossings), lunar.ts (landing, ascent, rendezvous). This file chooses when
// to fly (guess.ts), chains the phases, hands each one the state the previous one ended in, and adds up what
// every stage has to carry.
//
// What is searched for the least propellant: the liftoff instant within the day of opportunities, the launch
// azimuth, the length and start of each burn in space, the ignition point of the burn for home and, when a
// return window is allowed, the day of departure. The stay in lunar orbit before landing is as short as the
// geometry allows.
//
// The lunar orbit and the surface stay. The approach from Earth fixes a direction (the incoming asymptote), and
// an orbit entered without a plane change contains it. With the landing point at touchdown that fixes the orbit
// plane; it can be flown in either sense, which is the same plane and differs only by the Moon's own rotation
// (4.6 m/s at the equator, for and against, on descent and ascent). The sense is the one guess.ts gives (orbit
// normal = approach direction × site direction); near-side points get the retrograde orbit Apollo flew.
// The orbit keeps this plane while the Moon turns under it, 13.2° per day, so at liftoff the landing point is
// in general beside the orbit. What the planner does about it, for the least propellant:
//   - the liftoff moves within a short window to where the point is nearest to the plane;
//   - the plane change is made by the lander on its way up, or by the capsule beforehand in a Lunar Orbit Plane
//     Change (planeChange.ts), whichever takes less propellant and fits in the tanks;
//   - when neither craft carries enough, the plan is still flown and returned, with the shortfall in
//     `propellant` and in a note, and with the stays after which the point is back under the orbit.
// Not done: laying the orbit a little beside the landing point at touchdown so that it is nearer at liftoff
// (Apollo biased its orbits this way), and entering lunar orbit with a plane change to choose the orbit freely.
import { DAY_S, G0, MU_EARTH, MU_MOON, R_EARTH_EQ, R_MOON, goldenMin } from './astro'
import { simulateAscent } from './ascent'
import type { AscentResult } from './ascent'
import { firstGuess } from './guess'
import type { Guess, GuessInput } from './guess'
import type { ArchitectureSpec, LaunchVehicleSpec, SpacecraftSpec, StageSpec } from './hardware'
import { ascentBurns, idealEnergy } from './ideal'
import type { JetBurn } from './ideal'
import { LunarOpsError, planAscent, planDescent } from './lunar'
import type { AscentResult as LunarAscent, Path } from './lunar'
import { planPlaneChange } from './planeChange'
import type { PlaneChange } from './planeChange'
import { integrate, moonField } from './sim'
import type { Field, SimRun } from './sim'
import { NoLeverage, apsides, flyHomebound, flyOutbound } from './transit'
import type { EngineUse, Orbit, OutboundResult, PathSeg } from './transit'
import type { FlightEphemeris, LandingTarget, Launchpad, MissionEvent, MissionLeg, MissionPlan, PropellantUse, SourceRef, Vec3 } from './types'
import { FlightPlanError } from './types'
import { DEG, cross, dot, latLonUnit, qrot, rotateAbout, scale, unit } from './vec'

const HOUR_MS = 3_600_000

// ---- Choices of this planner (not facts about a vehicle)
/** The liftoff from the Moon may move this far from the asked end of the stay (and never more than a twentieth
 *  of the stay) to the instant at which the site is nearest to the capsule's orbit plane. */
const LIFTOFF_WINDOW_H = 3
/** The capsule's plane change comes this long before the lander's liftoff. Apollo by the Numbers (NASA
 *  SP-2000-4029), lunar orbit phase tables: Apollo 15 "CSM plane change" at 165:11:32.74 and liftoff at
 *  171:37:23.2 (6 h 26 min); Apollo 16 169:05:52.14 and 175:31:47.9 (6 h 26 min); Apollo 17 179:53:53.83 and
 *  185:21:37 (5 h 28 min). https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_15g_Lunar_Orbit_Phase.htm */
const LOPC_BEFORE_LIFTOFF_H = 6
/** From docking to the earliest Trans-Earth Injection: crew and samples move over, the lander is cast off.
 *  Apollo 11: docking at 128:03:00, Trans-Earth Injection at 135:23:42 (NASA SP-2000-4029, Apollo by the Numbers,
 *  https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11i_Timeline.htm ): 7 h 21 min. */
const DOCKED_BEFORE_TEI_H = 7 + 21 / 60
/** A site this close to the orbit plane at liftoff is the lander's own business: its ascent steers out the
 *  first 0.75° for about 19 m/s per degree squared (lunar.ts) and nothing else is tried. */
const LANDER_ALONE_BELOW_DEG = 1
/** The Moon turns once in 27.32 days against the stars: "Sidereal rotation period (hrs) 655.720",
 *  https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html . 360° / 27.32 d = 13.2° per day. */
const MOON_TURN_DAYS = 27.32
/** Where the Apollo 11 figures in the plan's notes are stated (NASA SP-2000-4029, Apollo by the Numbers):
 *  translunar phase "LOI ... 357.53 s, 2,917.5 ft/s, 169.7 x 60.0 n mi" and "LOI-2 ... 158.8 ft/s"; timeline: TLI
 *  cutoff to LOI ignition 72:59:47, LOI ignition to landing 26:55:50, TEI cutoff to entry 59:36:52; summary:
 *  "The 756.39-second powered descent engine burn was initiated at 102:33:05.01."; descent propellant consumed
 *  17,414 lbm of 18,184 loaded. */
const APOLLO_11_SOURCES: SourceRef[] = [
  { label: 'NASA SP-2000-4029, Apollo by the Numbers: Apollo 11 timeline', url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11i_Timeline.htm' },
  { label: 'NASA SP-2000-4029, Apollo by the Numbers: Apollo 11 lunar orbit phase', url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11g_Lunar_Orbit_Phase.htm' },
  { label: 'NASA SP-2000-4029, Apollo by the Numbers: Apollo 11 summary', url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm' },
]
const LOPC_SOURCE: SourceRef = {
  label: 'NASA SP-2000-4029, Apollo by the Numbers: Apollo 15 lunar orbit phase (CSM plane change before LM ascent)',
  url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_15g_Lunar_Orbit_Phase.htm',
}

export interface MissionInput {
  pad: Launchpad
  target: LandingTarget
  ephem: FlightEphemeris
  /** surfaceStay (hardware.ts), when given, is what the plan's note on a stay beyond the hardware's limit quotes. */
  architecture: { id: string; name: string; surfaceStay?: ArchitectureSpec['surfaceStay'] }
  launchVehicle: LaunchVehicleSpec
  capsule: SpacecraftSpec
  lander: SpacecraftSpec
  earliestTouchdownMs: number
  surfaceStayDays: number
  /** 0: leave when the stay ends. Otherwise the cheapest departure within this many days after it. */
  returnWindowDays: number
  maxTransferDays: number | null
  parkingAltKm?: number // circular parking orbit, default 185
  lunarOrbitAltKm?: number // default 100
  pdiAltKm?: number // periapsis of the descent orbit, default 15
  entryAltKm?: number // Entry Interface, default 121.92 (400,000 ft)
  entryFpaDeg?: number // default −6.5
}

const massOf = (m: StageSpec) => m.dryKg + m.propellantKg
const totalMass = (s: SpacecraftSpec) => s.modules.reduce((sum, m) => sum + massOf(m), 0)

/** The module of a spacecraft that carries its main engine, as an engine setting at full thrust. */
function mainEngine(s: SpacecraftSpec): { module: StageSpec; use: EngineUse } {
  const module = s.modules.find((m) => m.engine)
  if (!module?.engine) throw new FlightPlanError(`${s.name} has no main engine.`)
  const e = module.engine
  return { module, use: { name: `${module.name}, ${e.name}`, thrustN: e.thrustVacN * e.count, ispS: e.ispVacS } }
}

/** Splits a path into legs wherever the engine starts or stops, so burns can be drawn as burns. */
function legsOf(path: Path, craft: 'capsule' | 'lander', frame: 'earth' | 'moon', id: string, label: string): MissionLeg[] {
  const legs: MissionLeg[] = []
  let start = 0
  for (let i = 1; i <= path.t.length; i++) {
    // sample i belongs to the stretch that begins at i − 1; a change of state closes the current leg at i − 1
    if (i === path.t.length || path.thrusting[i] !== path.thrusting[start]) {
      const end = i === path.t.length ? i - 1 : i
      if (end > start) {
        const powered = path.thrusting[start]
        legs.push({ id, label: powered ? `${label}, engine burn` : label, craft, frame, powered, track: { t: path.t.slice(start, end + 1), p: path.r.slice(start, end + 1) } })
      }
      start = i
    }
  }
  return legs
}

const legOfSeg = (s: PathSeg, craft: 'capsule' | 'lander'): MissionLeg => ({ id: s.id, label: s.label, craft, frame: s.frame, powered: s.powered, track: { t: s.t, p: s.p } })

/** State on a stored run at an instant: integrates on from the last stored sample before it. */
function stateOn(field: Field, run: SimRun, t0Ms: number, utcMs: number): Orbit {
  const tS = Math.min(run.endS, Math.max(0, (utcMs - t0Ms) / 1000))
  let lo = 0
  let hi = run.t.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (run.t[mid] <= tS) lo = mid
    else hi = mid
  }
  const s0 = { r: run.r[lo], v: run.v[lo], m: run.m[lo] }
  const end = tS > run.t[lo] ? integrate(field, s0, t0Ms + run.t[lo] * 1000, { maxSeconds: tS - run.t[lo], maxStepS: 60 }).end : s0
  return { utcMs, r: end.r, v: end.v }
}

/** Removes repeated instants so a track's times are strictly increasing. */
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

export function planMission(inp: MissionInput): MissionPlan {
  const { ephem, pad, target, launchVehicle: lv, capsule, lander } = inp
  const parkingAltKm = inp.parkingAltKm ?? 185
  const lunarOrbitAltKm = inp.lunarOrbitAltKm ?? 100
  const pdiAltKm = inp.pdiAltKm ?? 15
  const capsuleEngine = mainEngine(capsule)
  const capsuleMass = totalMass(capsule)
  const landerMass = totalMass(lander)
  const payloadKg = capsuleMass + landerMass
  const tliStage = lv.stages[lv.stages.length - 1]
  if (!tliStage.engine) throw new FlightPlanError(`${tliStage.name} has no engine.`)
  const notes: string[] = []

  // ---- 1. How long and how far the ascent goes: one flight due east from this latitude.
  const lat = pad.latDeg * DEG
  const pad0: Vec3 = [Math.cos(lat), 0, Math.sin(lat)]
  const fly = (padEci: Vec3, pole: Vec3, planeNormal: Vec3): AscentResult =>
    simulateAscent({ vehicle: lv, payloadKg, padEci, pole, target: { planeNormal, perigeeKm: parkingAltKm, apogeeKm: parkingAltKm } })
  const trial = fly(pad0, [0, 0, 1], cross(pad0, [0, 1, 0]))

  // ---- 2. When to lift off (first guess), then ascent and outbound flight until the two agree on the plane.
  // From lunar orbit insertion to touchdown: one revolution to check the orbit, up to one more to come round to
  // the descent point, half a revolution of descent orbit and the powered descent.
  const rLlo = R_MOON + lunarOrbitAltKm
  const periodLlo = 2 * Math.PI * Math.sqrt(rLlo ** 3 / MU_MOON)
  const orbitToTouchdownS = 2.2 * periodLlo
  const guessInput: GuessInput = {
    ephem,
    padLatDeg: pad.latDeg,
    padLonDeg: pad.lonDeg,
    siteLatDeg: target.latDeg,
    siteLonDeg: target.lonDeg,
    parkingAltKm,
    lunarOrbitAltKm,
    ascentTimeS: trial.insertion.tS,
    ascentArcRad: trial.downrangeAngleRad,
    maxTransferDays: inp.maxTransferDays,
    earliestTouchdownMs: inp.earliestTouchdownMs,
    orbitToTouchdownS,
  }
  const outboundFor = (guess: Guess): { guess: Guess; ascent: AscentResult; out: OutboundResult; turn: number } => {
    let turn = 0 // turn of the orbit plane about the pad direction asked for by the aiming, summed over passes
    for (let pass = 0; pass < 5; pass++) {
      const planeNormal = unit(rotateAbout(guess.planeNormal, guess.padHat, turn))
      const g: Guess = { ...guess, planeNormal, tliPoint: rotateAbout(guess.tliPoint, guess.padHat, turn) }
      const ascent = fly(guess.padHat, guess.pole, planeNormal)
      const out = flyOutbound({
        ephem,
        guess: g,
        insertion: { utcMs: guess.liftoffMs + ascent.insertion.tS * 1000, r: ascent.insertion.r, v: ascent.insertion.v },
        stage: {
          name: `${tliStage.name}, ${tliStage.engine!.name}`,
          thrustN: tliStage.engine!.thrustVacN * tliStage.engine!.count,
          ispS: tliStage.engine!.ispVacS,
          dryKg: ascent.upperStageDryKg,
          propellantKg: ascent.upperStagePropellantKg,
        },
        payloadKg,
        capsuleEngine: capsuleEngine.use,
        lunarOrbitAltKm,
        siteLatDeg: target.latDeg,
        siteLonDeg: target.lonDeg,
        orbitToTouchdownS,
      })
      turn += out.planeTurnRad
      // 0.002°: the ascent was flown into the plane the translunar flight needs
      if (Math.abs(out.planeTurnRad) < 3.5e-5) return { guess: g, ascent, out, turn }
    }
    throw new FlightPlanError('Ascent and translunar flight did not settle on a common orbit plane.')
  }
  let flown: ReturnType<typeof outboundFor> | null = null
  for (const shiftMin of [0, 20, -20, 40, -40, 60, -60, 90, -90]) {
    try {
      flown = outboundFor(firstGuess(guessInput, shiftMin))
      break
    } catch (err) {
      if (!(err instanceof NoLeverage)) throw err
    }
  }
  if (!flown) throw new FlightPlanError('The translunar flight could not be aimed for this launchpad and landing point.')
  const { guess, ascent, out } = flown
  const liftoffMs = guess.liftoffMs


  // ---- 3. At the Moon. Gravity field around it from arrival to departure, and on to a full turn of the Moon
  // after the landing when the ephemeris reaches that far (for the stays that need no plane change).
  const stayS = inp.surfaceStayDays * DAY_S
  const loiEndMs = out.lunarOrbit.utcMs
  const neededDays = inp.surfaceStayDays + inp.returnWindowDays + 3
  let moonF: Field | null = null
  let fieldDays = neededDays
  for (const days of [Math.max(neededDays, MOON_TURN_DAYS + 1.5), neededDays]) {
    try {
      moonF = moonField(ephem, loiEndMs - HOUR_MS, loiEndMs + days * DAY_S * 1000)
      fieldDays = days
      break
    } catch (err) {
      if (!(err instanceof RangeError)) throw err
    }
  }
  if (!moonF) throw new FlightPlanError('The ephemeris does not cover the stay at the Moon.')
  const field: Field = moonF
  const siteUnit = latLonUnit(target.latDeg, target.lonDeg)
  const site = (utcMs: number): Vec3 => scale(qrot(ephem.moonFixedToInertial(utcMs), siteUnit), R_MOON)

  // Descent at the first opportunity after one revolution in orbit, and not before the earliest touchdown asked
  // for. The simulators are told the lander has propellant without limit: what a flight really takes is set
  // against what the tanks hold further down, and a shortfall is reported, not thrown.
  const descend = (earliestMs: number) =>
    planDescent({ field, orbit: out.lunarOrbit, earliestMs, site, lander, massKg: landerMass, pdiAltKm, propellantKg: landerMass })
  let descent = descend(loiEndMs + periodLlo * 1000)
  for (let pass = 0; pass < 3 && descent.touchdownMs < inp.earliestTouchdownMs; pass++) {
    // Start the descent later by what the touchdown came early, counted from when this descent actually began.
    const began = descent.events.find((e) => e.label.includes('(DOI)'))?.utcMs ?? descent.path.t[0]
    descent = descend(began + (inp.earliestTouchdownMs - descent.touchdownMs) + 1000)
  }
  const touchdownMs = descent.touchdownMs
  const descentUsedKg = landerMass - descent.massAtTouchdownKg

  // The capsule stays in orbit: its path from insertion until well after the latest departure.
  const capsuleAloneKg = out.massAfterLoiKg - landerMass
  const orbitRun = integrate(field, { r: out.lunarOrbit.r, v: out.lunarOrbit.v, m: capsuleAloneKg }, loiEndMs, {
    maxSeconds: (touchdownMs - loiEndMs) / 1000 + stayS + (inp.returnWindowDays + 1.5) * DAY_S,
    maxStepS: 60,
  })
  // The same orbit on to the end of the field, coarsely: only its plane is read from this (noPlaneChangeStays).
  const orbitEndMs = loiEndMs + orbitRun.endS * 1000
  const farRun = integrate(field, orbitRun.end, orbitEndMs, { maxSeconds: Math.max(0, (loiEndMs + (fieldDays - 0.25) * DAY_S * 1000 - orbitEndMs) / 1000), tol: 1e-7 })
  const onFirstOrbit = (utcMs: number) => stateOn(field, orbitRun, loiEndMs, utcMs)
  /** How far the site is from the capsule's orbit plane (rad, signed) at an instant, the orbit left as it is. */
  const offPlane = (utcMs: number) => {
    const s = onFirstOrbit(utcMs)
    return Math.asin(Math.max(-1, Math.min(1, dot(unit(cross(s.r, s.v)), unit(site(utcMs))))))
  }

  // When to leave: at the end of the stay, or, inside the allowed window, when the orbit plane contains the way
  // home best (the direction against the Moon's own motion around Earth).
  let stayEndMs = touchdownMs + stayS * 1000
  if (inp.returnWindowDays > 0) {
    const n = unit(cross(out.lunarOrbit.r, out.lunarOrbit.v))
    let best = Infinity
    for (let t = stayEndMs; t <= touchdownMs + (stayS + inp.returnWindowDays * DAY_S) * 1000; t += 2 * HOUR_MS) {
      const off = Math.abs(dot(n, unit(ephem.moonVel(t))))
      if (off < best) {
        best = off
        stayEndMs = t
      }
    }
  }
  // The exact liftoff: within a short window around that instant (a twentieth of the stay, three hours at most) the
  // one at which the site is nearest to the orbit plane. The Moon carries the site across the plane at up to
  // 0.55° per hour, so an hour either way can save a degree of plane change. A site that is within 0.3° anyway
  // lifts off when asked.
  const askedLiftoffMs = stayEndMs
  const windowMs = Math.min(LIFTOFF_WINDOW_H * HOUR_MS, 0.05 * stayS * 1000)
  if (Math.abs(offPlane(stayEndMs)) > 0.3 * DEG) {
    let best = Math.abs(offPlane(stayEndMs))
    let moved = stayEndMs
    for (let t = askedLiftoffMs - windowMs; t <= askedLiftoffMs + windowMs; t += 10 * 60_000) {
      const off = Math.abs(offPlane(t))
      if (off < best - 1e-5) {
        best = off
        moved = t
      }
    }
    // a quarter of a degree is about 7 m/s of plane change: less is not worth leaving at another time than asked
    if (best < Math.abs(offPlane(askedLiftoffMs)) - 0.25 * DEG) stayEndMs = moved
  }
  const offAtLiftoffRad = offPlane(stayEndMs)

  // ---- 4. Ascent, rendezvous and the way home. The Moon has turned under the capsule's orbit during the stay;
  // when the site is off the orbit plane at liftoff, somebody has to change planes. Two ways are flown and the
  // one that takes less propellant is kept:
  //   'lander'   the lander steers into the capsule's plane on the way up and turns the rest in orbit (lunar.ts);
  //   'capsule'  the capsule turns its orbit over the site beforehand with a Lunar Orbit Plane Change, and the
  //              lander climbs straight into that plane (Apollo 15, 16, 17).
  // The same turn costs the lighter craft less, so the lighter one goes first; when its tanks do not hold it,
  // the other is flown too. When neither can, the plan with the smaller shortfall is returned and says so.
  const twoStage = lander.modules.length > 1
  const ascentElement = lander.modules[0]
  const ascentEngine = ascentElement.engine ?? lander.modules.find((m) => m.engine)?.engine
  const liftoffMassKg = twoStage ? massOf(ascentElement) : descent.massAtTouchdownKg
  const ascentAvailableKg = twoStage ? ascentElement.propellantKg : ascentElement.propellantKg - descentUsedKg
  const loi = out.events[1]
  const capsuleAvailableKg = capsuleEngine.module.propellantKg - loi.propellantKg // for the plane change and the way home
  // The capsule is in the right place for a rendezvous once per revolution, so the liftoff falls up to one
  // revolution after the instant given to the ascent: half a revolution before the end of the stay, which puts
  // the liftoff within an hour of it either way.
  const climbTo = (targetOrbit: Orbit, aboutMs: number) =>
    planAscent({
      field, site, earliestMs: Math.max(touchdownMs + HOUR_MS, aboutMs - 0.5 * periodLlo * 1000), target: targetOrbit, lander, massKg: liftoffMassKg, propellantKg: liftoffMassKg,
      insertionAltKm: { perilune: pdiAltKm, apolune: Math.max(pdiAltKm + 20, 0.8 * lunarOrbitAltKm) },
    })
  const coastOn = (from: Orbit, toMs: number): Orbit => {
    const end = integrate(field, { r: from.r, v: from.v, m: 1 }, from.utcMs, { maxSeconds: Math.max(0, (toMs - from.utcMs) / 1000), maxStepS: 60 }).end
    return { utcMs: toMs, r: end.r, v: end.v }
  }
  /** One way of getting the lander back to the capsule: the ascent as flown, and the capsule's plane change if any. */
  interface Climb {
    who: 'lander' | 'capsule'
    lopc: PlaneChange | null
    lopcFromMs: number
    lunarAscent: LunarAscent
    capsuleOrbit: Orbit // the orbit the lander meets the capsule in
    ascentUsedKg: number
    ascentShortKg: number
  }
  /** The same with the flight home, which depends on it (the capsule's mass and its orbit plane). */
  interface Way extends Climb {
    home: ReturnType<typeof flyHomebound>
    capsuleUsedKg: number // plane change and Trans-Earth Injection
    shortKg: number // propellant missing in the ascent element and in the capsule, together
  }
  const climbOf = (who: Climb['who'], lopc: PlaneChange | null, lopcFromMs: number, lunarAscent: LunarAscent, capsuleOrbit: Orbit): Climb => {
    const ascentUsedKg = liftoffMassKg - lunarAscent.massAtDockingKg
    return { who, lopc, lopcFromMs, lunarAscent, capsuleOrbit, ascentUsedKg, ascentShortKg: Math.max(0, ascentUsedKg - ascentAvailableKg) }
  }
  const withHome = (c: Climb): Way => {
    const home = flyHomebound({
      ephem, orbit: coastOn(c.capsuleOrbit, c.lunarAscent.dockingMs), earliestMs: c.lunarAscent.dockingMs + DOCKED_BEFORE_TEI_H * HOUR_MS,
      massKg: capsuleAloneKg - (c.lopc?.propellantKg ?? 0), engine: capsuleEngine.use,
      entryAltKm: inp.entryAltKm ?? 121.92, entryFpaDeg: inp.entryFpaDeg ?? -6.5,
    })
    const capsuleUsedKg = (c.lopc?.propellantKg ?? 0) + home.events[0].propellantKg
    return { ...c, home, capsuleUsedKg, shortKg: c.ascentShortKg + Math.max(0, capsuleUsedKg - capsuleAvailableKg) }
  }
  const byLander = (): Climb => {
    const from = onFirstOrbit(Math.max(touchdownMs, stayEndMs - periodLlo * 1000))
    return climbOf('lander', null, 0, climbTo(from, stayEndMs), from)
  }
  const byCapsule = (): Climb | null => {
    // The burn comes a few revolutions before the liftoff (Apollo 15 and 16: 6 h 26 min before, Apollo 17:
    // 5 h 28 min), at the first crossing of the old and the new plane after that; on a short stay, later.
    const fromMs = Math.max(touchdownMs + 0.25 * (stayEndMs - touchdownMs), stayEndMs - LOPC_BEFORE_LIFTOFF_H * HOUR_MS)
    const before = onFirstOrbit(fromMs)
    const turn = (liftoffAtMs: number) =>
      planPlaneChange({
        field, state: { r: before.r, v: before.v, m: capsuleAloneKg }, notBeforeMs: fromMs, siteDir: unit(site(liftoffAtMs)),
        thrustN: capsuleEngine.use.thrustN, ispS: capsuleEngine.use.ispS,
      })
    // The plane is turned over the site at the liftoff; the liftoff waits up to one revolution for the capsule
    // to be in the right place, so the burn is aimed again at the instant the first pass gives.
    let lopc = turn(stayEndMs)
    if (!lopc || lopc.endMs > stayEndMs - 0.5 * HOUR_MS) return null
    let orbit: Orbit = { utcMs: lopc.endMs, r: lopc.end.r, v: lopc.end.v }
    let climb = climbTo(orbit, stayEndMs)
    const again = turn(climb.liftoffMs)
    if (again) {
      lopc = again
      orbit = { utcMs: lopc.endMs, r: lopc.end.r, v: lopc.end.v }
      climb = climbTo(orbit, stayEndMs)
    }
    return climbOf('capsule', lopc, fromMs, climb, orbit)
  }
  let way: Way
  if (Math.abs(offAtLiftoffRad) < LANDER_ALONE_BELOW_DEG * DEG) {
    way = withHome(byLander())
  } else {
    // First guess of the cost of the turn 2 v sin(δ/2) for each craft (rocket equation), to decide who goes first.
    const dvTurn = 2 * Math.sqrt(MU_MOON / rLlo) * Math.sin(Math.abs(offAtLiftoffRad) / 2)
    const fraction = (ispS: number) => 1 - Math.exp((-dvTurn * 1000) / (G0 * ispS))
    const landerInOrbitKg = liftoffMassKg * Math.exp(-1850 / (G0 * (ascentEngine?.ispVacS ?? 300)))
    const landerFirst = landerInOrbitKg * fraction(ascentEngine?.ispVacS ?? 300) <= capsuleAloneKg * fraction(capsuleEngine.use.ispS)
    const attempt = <T>(f: () => T | null): T | null => {
      try {
        return f()
      } catch (err) {
        if (err instanceof LunarOpsError || err instanceof FlightPlanError) return null // this way cannot be flown; the other may
        throw err
      }
    }
    // The flight home is flown for a way only when it can be the answer: not for a first way whose ascent
    // already runs short, unless the second way falls short too.
    const first = attempt<Climb>(landerFirst ? byLander : byCapsule)
    let firstWay = first && first.ascentShortKg === 0 ? attempt(() => withHome(first)) : null
    if (firstWay && firstWay.shortKg === 0) way = firstWay
    else {
      const second = attempt<Climb>(landerFirst ? byCapsule : byLander)
      const secondWay = second && attempt(() => withHome(second))
      if (secondWay && secondWay.shortKg === 0) way = secondWay
      else {
        if (!firstWay && first) firstWay = attempt(() => withHome(first))
        const chosen = !firstWay ? secondWay : !secondWay ? firstWay : secondWay.shortKg < firstWay.shortKg ? secondWay : firstWay
        way = chosen ?? withHome(byLander()) // neither: let the error of the plain ascent say why
      }
    }
  }
  const { lopc, lunarAscent, home } = way

  // ---- 5. Legs. The capsule in lunar orbit: from the insertion to the plane change (when there is one), the
  // burn, and on to the start of the burn for home.
  const ascentPath: Path = { t: ascent.t.map((s) => liftoffMs + s * 1000), r: ascent.r, thrusting: ascent.thrusting }
  const homeStartMs = home.segs[0].t[0]
  const orbitLeg = (t: number[], p: Vec3[]): MissionLeg => ({ id: 'lunar-orbit', label: 'Lunar orbit', craft: 'capsule', frame: 'moon', powered: false, track: { t, p } })
  const upTo = (run: SimRun, t0Ms: number, endMs: number) => {
    const idx = run.t.findIndex((s) => t0Ms + s * 1000 >= endMs)
    const stop = idx < 0 ? run.t.length : idx
    return { t: run.t.slice(0, stop).map((s) => t0Ms + s * 1000), p: run.r.slice(0, stop) }
  }
  const capsuleLunarLegs: MissionLeg[] = []
  if (lopc) {
    const first = upTo(orbitRun, loiEndMs, way.lopcFromMs)
    capsuleLunarLegs.push(orbitLeg([...first.t, ...lopc.coast.t.map((s) => way.lopcFromMs + s * 1000)], [...first.p, ...lopc.coast.r]))
    capsuleLunarLegs.push({
      id: 'lopc', label: 'Lunar Orbit Plane Change, engine burn', craft: 'capsule', frame: 'moon', powered: true,
      track: { t: lopc.burn.t.map((s) => lopc.ignitionMs + s * 1000), p: lopc.burn.r },
    })
    const after = integrate(field, lopc.end, lopc.endMs, { maxSeconds: (homeStartMs - lopc.endMs) / 1000, maxStepS: 60 })
    const rest = upTo(after, lopc.endMs, homeStartMs)
    capsuleLunarLegs.push(orbitLeg([...rest.t, ...home.segs[0].t], [...rest.p, ...home.segs[0].p]))
  } else {
    const first = upTo(orbitRun, loiEndMs, homeStartMs)
    capsuleLunarLegs.push(orbitLeg([...first.t, ...home.segs[0].t], [...first.p, ...home.segs[0].p]))
  }
  // The capsule exactly where the lander meets it: a sample of its own at the docking instant (between two
  // samples a minute apart the straight line of the drawn path is up to 0.6 km inside the orbit).
  const dockingMs = Math.round(lunarAscent.dockingMs)
  const meeting = lunarAscent.path.r[lunarAscent.path.r.length - 1]
  for (const leg of capsuleLunarLegs) {
    const { t, p } = leg.track
    const i = t.findIndex((x) => x >= dockingMs)
    if (i > 0 && t[i] - dockingMs >= 1 && dockingMs - t[i - 1] >= 1) {
      t.splice(i, 0, dockingMs)
      p.splice(i, 0, meeting)
    }
  }
  const surfaceT: number[] = []
  for (let t = touchdownMs; t < lunarAscent.liftoffMs; t += 0.5 * HOUR_MS) surfaceT.push(t)
  surfaceT.push(lunarAscent.liftoffMs)
  const allLegs: MissionLeg[] = [
    ...legsOf(ascentPath, 'capsule', 'earth', 'ascent', 'Ascent'),
    ...out.segs.map((s) => legOfSeg(s, 'capsule')),
    ...capsuleLunarLegs,
    legOfSeg(home.segs[1], 'capsule'),
    legOfSeg(home.segs[2], 'capsule'),
    ...legsOf(descent.path, 'lander', 'moon', 'descent', 'Descent'),
    { id: 'surface', label: 'On the surface', craft: 'lander', frame: 'moon', powered: false, track: { t: surfaceT, p: surfaceT.map(site) } },
    ...legsOf(lunarAscent.path, 'lander', 'moon', 'lunar-ascent', 'Ascent and rendezvous'),
  ]
  const legs = allLegs.map(strict).filter((l) => l.track.t.length > 1)

  // ---- 6. Events.
  const ev = (e: Partial<MissionEvent> & { id: string; label: string; utcMs: number }): MissionEvent => ({
    short: e.id.toUpperCase(), craft: 'capsule', kind: 'event', by: null, dvKms: null, propellantKg: null, durationS: null, massAfterKg: null, ...e,
  })
  const liftoffMassStack = ascent.m[0]
  const events: MissionEvent[] = [
    ev({
      id: 'ascent', short: 'Launch', label: 'Launch and ascent to Earth parking orbit', utcMs: liftoffMs, kind: 'burn', by: lv.name,
      dvKms: ascent.budget.idealDvKms, propellantKg: liftoffMassStack - ascent.insertion.massKg - droppedDuringAscent(lv), durationS: ascent.insertion.tS,
      massAfterKg: ascent.insertion.massKg,
    }),
    ...ascent.events.filter((e) => e.id !== 'liftoff').map((e) => ev({ id: `ascent-${e.id}`, short: '', label: e.label, utcMs: liftoffMs + e.tS * 1000 })),
    ...out.events.map((e) => ev({ ...e, kind: 'burn' })),
    ...descent.events.map((e) => ev({ ...e, short: shortOf(e.label), craft: 'lander', kind: e.dvKms ? 'burn' : 'event', by: e.dvKms ? lander.name : null })),
    ...(lopc
      ? [
          ev({
            id: 'lopc', short: 'LOPC', label: 'Lunar Orbit Plane Change (LOPC)', utcMs: lopc.ignitionMs, kind: 'burn', by: capsuleEngine.use.name,
            dvKms: lopc.dvKms, propellantKg: lopc.propellantKg, durationS: lopc.burn.endS, massAfterKg: lopc.end.m,
          }),
        ]
      : []),
    ...lunarAscent.events.map((e) => ev({ ...e, short: shortOf(e.label), craft: 'lander', kind: e.dvKms ? 'burn' : 'event', by: e.dvKms ? lander.name : null })),
    ...home.events.map((e) => ev({ ...e, kind: 'burn' })),
    ev({ id: 'ei', short: 'EI', label: 'Entry Interface (EI)', utcMs: home.entry.utcMs, massAfterKg: home.massAfterKg }),
  ]
    .map((e) => ({ ...e, id: normalId(e), utcMs: Math.round(e.utcMs) }))
    .sort((a, b) => a.utcMs - b.utcMs)

  // ---- 7. What every element has to carry.
  const tli = out.events[0]
  const propellant: PropellantUse[] = [
    { element: tliStage.name, usedKg: tliStage.propellantKg - ascent.upperStagePropellantKg + tli.propellantKg, capacityKg: tliStage.propellantKg },
    { element: capsuleEngine.module.name, usedKg: loi.propellantKg + way.capsuleUsedKg, capacityKg: capsuleEngine.module.propellantKg },
  ]
  if (twoStage) {
    const descentElement = lander.modules[lander.modules.length - 1]
    propellant.push({ element: descentElement.name, usedKg: descentUsedKg, capacityKg: descentElement.propellantKg })
    propellant.push({ element: ascentElement.name, usedKg: way.ascentUsedKg, capacityKg: ascentElement.propellantKg })
  } else {
    propellant.push({ element: ascentElement.name, usedKg: descentUsedKg + way.ascentUsedKg, capacityKg: ascentElement.propellantKg })
  }
  for (const u of propellant) {
    if (u.usedKg > u.capacityKg) {
      notes.push(
        `${u.element}: this mission needs ${((u.usedKg - u.capacityKg) / 1000).toFixed(1)} t more propellant than it carries. ` +
          'The flight is shown as if it had it; carrying more would make the craft heavier and cost more still, so the real shortfall is larger.',
      )
    }
  }
  if (home.planeOffDeg > 20) {
    notes.push(
      `Leaving on this day is expensive: the lunar orbit's plane is ${home.planeOffDeg.toFixed(0)}° away from the way home, so the burn for home has to turn out of it. ` +
        'A lunar orbit keeps its orientation in space; it lines up with the way home about every 14 days.',
    )
  }
  if (descent.crossRangeDeg > 0.2) notes.push(`The landing point was ${descent.crossRangeDeg.toFixed(1)}° off the orbit plane at descent; the lander steered sideways to reach it.`)

  // The plane change, who made it and why, and the stays that would need none.
  const stayDays = (lunarAscent.liftoffMs - touchdownMs) / (DAY_S * 1000)
  const offDeg = Math.abs(offAtLiftoffRad) / DEG
  const askedDays = Number(inp.surfaceStayDays.toFixed(2))
  const kg = (x: number) => `${Math.round(x).toLocaleString('en-US')} kg`
  if (lopc) {
    const hoursBefore = (lunarAscent.liftoffMs - lopc.ignitionMs) / HOUR_MS
    notes.push(
      `After ${stayDays.toFixed(2)} days the landing point is ${offDeg.toFixed(1)}° off the capsule's orbit plane: a low orbit keeps its plane while the Moon turns under it, 13.2° per day. ` +
        `The capsule turned its orbit over the landing point ${hoursBefore.toFixed(1)} hours before liftoff: Lunar Orbit Plane Change (LOPC), ${(lopc.dvKms * 1000).toFixed(0)} m/s, ` +
        `${kg(lopc.propellantKg)} of propellant. The Apollo 15, 16 and 17 Command and Service Modules did the same about six hours before liftoff (38 to 112 m/s). ` +
        (way.shortKg > 0
          ? 'Neither craft carries enough propellant for a turn this large; this is the way with the smaller shortfall.'
          : `The lander could have made this turn only with more propellant than its ascent element holds (${kg(ascentAvailableKg)}), or with more than the capsule needs for it.`),
    )
  } else if (lunarAscent.planeChangeDeg > 0.5) {
    notes.push(
      `At liftoff the landing point was ${lunarAscent.planeChangeDeg.toFixed(1)}° off the capsule's orbit plane (the Moon turns under the orbit, 13.2° per day); the lander's ascent paid for that plane change ` +
        `(${(lunarAscent.planeChangeDvKms * 1000).toFixed(0)} m/s). ` +
        (way.shortKg > 0
          ? 'Neither craft carries enough propellant for a turn this large; this is the way with the smaller shortfall.'
          : 'The lander is the lighter craft, so the same turn takes less propellant from it than from the capsule.'),
    )
  }
  if (Math.abs(stayEndMs - askedLiftoffMs) > 60_000 && inp.returnWindowDays <= 0) {
    notes.push(
      `Liftoff was moved ${Math.abs((stayEndMs - askedLiftoffMs) / HOUR_MS).toFixed(1)} hours ${stayEndMs < askedLiftoffMs ? 'ahead of' : 'past'} the asked ${askedDays} days: ` +
        `there the landing point is nearest to the capsule's orbit plane (${offDeg.toFixed(1)}° instead of ${(Math.abs(offPlane(askedLiftoffMs)) / DEG).toFixed(1)}°).`,
    )
  }
  notes.push(noPlaneChangeStays())
  const limit = inp.architecture.surfaceStay
  if (limit && limit.maxDays !== null && inp.surfaceStayDays > limit.maxDays + 1e-9) {
    notes.push(`A stay of ${askedDays} days is longer than this hardware supported (${Number(limit.maxDays.toFixed(2))} days). ${limit.basis} The plan is flown as asked; consumables and power on the surface are not modelled.`)
  }
  // How this plan differs from the lunar orbit rendezvous missions that were flown (Apollo 11 figures from
  // Apollo by the Numbers, NASA SP-2000-4029, summary, timeline and lunar orbit tables).
  const outH = (loi.utcMs - (tli.utcMs + tli.durationS * 1000)) / HOUR_MS
  const pdi = descent.events.find((e) => e.id === 'pdi')
  notes.push(
    `Timing: this plan flies the crossings that take the least propellant (${outH.toFixed(0)} hours from the end of the Trans-Lunar Injection to the Lunar Orbit Insertion, ` +
      `${(home.returnDays * 24).toFixed(0)} hours home) and lands ${((touchdownMs - loiEndMs) / HOUR_MS).toFixed(1)} hours after arriving, as soon as the geometry allows. ` +
      'Apollo 11 took 73 hours out and 60 hours home on faster paths that cost more, and landed 27 hours after arriving: time for checks, rest and tracking. ' +
      'A shorter crossing can be asked for; the wait in lunar orbit and the way home cannot.',
    `Burns: one Lunar Orbit Insertion straight into the ${lunarOrbitAltKm} km circular orbit (Apollo 11: 889 m/s into 314 × 111 km, then 48 m/s two revolutions later to make it nearly circular), ` +
      `and a powered descent close to the least propellant${pdi?.durationS ? ` (${pdi.durationS.toFixed(0)} s)` : ''} with no hover and no piloted approach ` +
      '(Apollo 11: 756 s and 7.9 t of propellant). Where on Earth the capsule comes down is not aimed.',
  )

  const park = apsides(MU_EARTH, ascent.insertion.r, ascent.insertion.v)
  const moonNorth = qrot(ephem.moonFixedToInertial(loiEndMs), [0, 0, 1])
  const sources: SourceRef[] = []
  for (const s of [...lv.sources, ...lv.stages.flatMap((x) => x.sources), ...capsule.sources, ...lander.sources, pad.source, ...(lopc ? [LOPC_SOURCE] : []), ...(limit?.sources ?? []), ...APOLLO_11_SOURCES]) {
    if (s.url && !sources.some((x) => x.url === s.url)) sources.push(s)
  }
  // Every burn of the plan with its engine, for the energy comparison (ideal.ts).
  const descentEngine = lander.modules[lander.modules.length - 1].engine
  const burns: JetBurn[] = [
    ...ascentBurns(lv, ascent),
    { propellantKg: tli.propellantKg, ispS: tliStage.engine.ispVacS },
    { propellantKg: loi.propellantKg + way.capsuleUsedKg, ispS: capsuleEngine.use.ispS },
    { propellantKg: descentUsedKg, ispS: descentEngine?.ispVacS ?? 0 },
    { propellantKg: way.ascentUsedKg, ispS: ascentEngine?.ispVacS ?? 0 },
  ]
  return {
    pad,
    target,
    ephem,
    architecture: { id: inp.architecture.id, name: inp.architecture.name, launchVehicle: lv.name, capsule: capsule.name, lander: lander.name },
    launchMs: liftoffMs,
    touchdownMs,
    lunarLiftoffMs: lunarAscent.liftoffMs,
    dockingMs,
    endMs: home.entry.utcMs,
    legs,
    events,
    propellant,
    facts: {
      launchAzimuthDeg: azimuthDeg(guess, guess.planeNormal),
      parkingInclDeg: Math.acos(Math.max(-1, Math.min(1, dot(unit(cross(ascent.insertion.r, ascent.insertion.v)), guess.pole)))) / DEG,
      parkingPerigeeKm: park.rp - R_EARTH_EQ,
      parkingApogeeKm: park.ra - R_EARTH_EQ,
      ascentLossKms: { gravity: ascent.budget.gravityLossKms, drag: ascent.budget.dragLossKms, steering: ascent.budget.steeringLossKms },
      transferDays: (loiEndMs - tli.utcMs) / (DAY_S * 1000),
      moonDistKm: out.moonDistKm,
      vInfKms: out.vInfKms,
      lunarPeriluneKm: out.periluneKm,
      lunarApoluneKm: out.apoluneKm,
      lunarInclDeg: Math.acos(Math.max(-1, Math.min(1, dot(out.lunarPlaneNormal, moonNorth)))) / DEG,
      orbitBeforeLandingH: (touchdownMs - loiEndMs) / HOUR_MS,
      landingMissM: descent.missM,
      surfaceStayDays: stayDays,
      returnPlaneOffDeg: home.planeOffDeg,
      returnDays: home.returnDays,
      entry: { speedKms: home.entry.speedKms, fpaDeg: home.entry.fpaDeg, latDeg: home.entry.latDeg, lonDeg: home.entry.lonDeg },
      missionDays: (home.entry.utcMs - liftoffMs) / (DAY_S * 1000),
      ideal: idealEnergy({
        ephem, pad, target, launchMs: liftoffMs, touchdownMs, lunarLiftoffMs: lunarAscent.liftoffMs, entryAltKm: inp.entryAltKm ?? 121.92, burns,
        referenceMassKg: home.massAfterKg,
      }),
      surfaceStayAskedDays: inp.surfaceStayDays,
    },
    notes,
    sources,
  }

  /** The stays after which the site is back under the capsule's orbit, so that nobody has to change planes:
   *  the instants within one turn of the Moon at which the site crosses the plane of the integrated orbit
   *  (beyond the end of the gravity field, when the ephemeris ends early, the orbit's last plane). */
  function noPlaneChangeStays(): string {
    const farNormal = (utcMs: number): Vec3 => {
      const tS = (utcMs - orbitEndMs) / 1000
      let lo = 0
      let hi = farRun.t.length - 1
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (farRun.t[mid] <= tS) lo = mid
        else hi = mid
      }
      return unit(cross(farRun.r[lo], farRun.v[lo]))
    }
    const sinOff = (utcMs: number) => (utcMs <= orbitEndMs ? Math.sin(offPlane(utcMs)) : dot(farNormal(utcMs), unit(site(utcMs))))
    const stepMs = 2 * HOUR_MS
    const endMs = Math.min(touchdownMs + MOON_TURN_DAYS * DAY_S * 1000 + 12 * HOUR_MS, ephem.endMs - 2 * HOUR_MS)
    const crossings: number[] = []
    const days = (utcMs: number) => (utcMs - touchdownMs) / (DAY_S * 1000)
    const near = Math.sin(LANDER_ALONE_BELOW_DEG * DEG) // as good as under the orbit: the ascent steers this out
    let worst = 0
    let beforeT = touchdownMs + 6 * HOUR_MS - stepMs
    let before = sinOff(beforeT)
    let prevT = beforeT + stepMs
    let prev = sinOff(prevT)
    for (let t = prevT + stepMs; t <= endMs; t += stepMs) {
      const cur = sinOff(t)
      worst = Math.max(worst, Math.abs(cur))
      if (prev * cur <= 0 && prev !== cur) {
        let lo = prevT
        let hi = t
        let flo = prev
        for (let i = 0; i < 30; i++) {
          const mid = 0.5 * (lo + hi)
          const fm = sinOff(mid)
          if (flo * fm <= 0) hi = mid
          else {
            lo = mid
            flo = fm
          }
        }
        crossings.push(days(0.5 * (lo + hi)))
      } else if (Math.abs(prev) < near && Math.abs(prev) <= Math.abs(before) && Math.abs(prev) < Math.abs(cur) && before * prev > 0) {
        // the site comes up to the plane and turns back without crossing it (a point at the orbit's highest latitude)
        crossings.push(days(goldenMin((x) => Math.abs(sinOff(x)), beforeT, t, 60_000)))
      }
      beforeT = prevT
      before = prev
      prevT = t
      prev = cur
    }
    const worstDeg = Math.asin(Math.min(1, worst)) / DEG
    if (worstDeg < LANDER_ALONE_BELOW_DEG) {
      return `This landing point stays within ${worstDeg.toFixed(1)}° of the capsule's orbit plane however long the stay: no stay needs a plane change.`
    }
    if (crossings.length === 0) {
      return `Within the time the ephemeris covers the landing point does not come back under the capsule's orbit; it gets up to ${worstDeg.toFixed(0)}° away from the orbit plane.`
    }
    const list = crossings.map((d) => d.toFixed(1))
    const text = list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
    return (
      `A stay needs no plane change when the landing point is back under the capsule's orbit at liftoff: for this point and orbit after ${text} days ` +
      `(in between it is up to ${worstDeg.toFixed(0)}° away; the Moon turns once in ${MOON_TURN_DAYS} days).`
    )
  }

  function azimuthDeg(g: Guess, planeNormal: Vec3): number {
    const east = unit(cross(g.pole, g.padHat))
    const north = cross(g.padHat, east)
    const vHat = cross(planeNormal, g.padHat)
    const az = Math.atan2(dot(vHat, east), dot(vHat, north)) / DEG
    return az < 0 ? az + 360 : az
  }
}

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

/** Stable ids for the events the views look for, whatever the simulators call them. */
function normalId(e: MissionEvent): string {
  const l = e.label.toLowerCase()
  if (l.startsWith('touchdown')) return 'touchdown'
  if (l.startsWith('docking')) return 'docking'
  if (l.startsWith('undocking')) return 'undocking'
  if (e.craft === 'lander' && l.startsWith('liftoff')) return 'lunar-liftoff'
  if (l.includes('(pdi)')) return 'pdi'
  if (l.includes('(doi)')) return 'doi'
  return e.id
}
