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
import { DAY_S, MU_EARTH, MU_MOON, R_EARTH_EQ, R_MOON } from './astro'
import { simulateAscent } from './ascent'
import type { AscentResult } from './ascent'
import { firstGuess } from './guess'
import type { Guess, GuessInput } from './guess'
import type { LaunchVehicleSpec, SpacecraftSpec, StageSpec } from './hardware'
import { planAscent, planDescent } from './lunar'
import type { Path } from './lunar'
import { integrate, moonField } from './sim'
import type { Field, SimRun } from './sim'
import { NoLeverage, apsides, flyHomebound, flyOutbound } from './transit'
import type { EngineUse, Orbit, OutboundResult, PathSeg } from './transit'
import type { FlightEphemeris, LandingTarget, Launchpad, MissionEvent, MissionLeg, MissionPlan, PropellantUse, SourceRef, Vec3 } from './types'
import { FlightPlanError } from './types'
import { DEG, cross, dot, latLonUnit, qrot, rotateAbout, scale, unit } from './vec'

const HOUR_MS = 3_600_000

export interface MissionInput {
  pad: Launchpad
  target: LandingTarget
  ephem: FlightEphemeris
  architecture: { id: string; name: string }
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

  // ---- 3. At the Moon. Gravity field around it from arrival to departure.
  const stayS = inp.surfaceStayDays * DAY_S
  const loiEndMs = out.lunarOrbit.utcMs
  let moonF: Field
  try {
    moonF = moonField(ephem, loiEndMs - HOUR_MS, loiEndMs + (stayS + (inp.returnWindowDays + 3) * DAY_S) * 1000)
  } catch (err) {
    if (err instanceof RangeError) throw new FlightPlanError('The ephemeris does not cover the stay at the Moon.')
    throw err
  }
  const siteUnit = latLonUnit(target.latDeg, target.lonDeg)
  const site = (utcMs: number): Vec3 => scale(qrot(ephem.moonFixedToInertial(utcMs), siteUnit), R_MOON)

  // Descent at the first opportunity after one revolution in orbit, and not before the earliest touchdown asked for.
  let descent = planDescent({ field: moonF, orbit: out.lunarOrbit, earliestMs: loiEndMs + periodLlo * 1000, site, lander, massKg: landerMass, pdiAltKm })
  for (let pass = 0; pass < 3 && descent.touchdownMs < inp.earliestTouchdownMs; pass++) {
    // Start the descent later by what the touchdown came early, counted from when this descent actually began.
    const began = descent.events.find((e) => e.label.includes('(DOI)'))?.utcMs ?? descent.path.t[0]
    const later = began + (inp.earliestTouchdownMs - descent.touchdownMs) + 1000
    descent = planDescent({ field: moonF, orbit: out.lunarOrbit, earliestMs: later, site, lander, massKg: landerMass, pdiAltKm })
  }
  const touchdownMs = descent.touchdownMs

  // The capsule stays in orbit: its path from insertion until well after the latest departure.
  const capsuleAloneKg = out.massAfterLoiKg - landerMass
  const orbitRun = integrate(moonF, { r: out.lunarOrbit.r, v: out.lunarOrbit.v, m: capsuleAloneKg }, loiEndMs, {
    maxSeconds: (touchdownMs - loiEndMs) / 1000 + stayS + (inp.returnWindowDays + 1.5) * DAY_S,
    maxStepS: 60,
  })
  const capsuleAt = (utcMs: number) => stateOn(moonF, orbitRun, loiEndMs, utcMs)

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

  // Ascent and rendezvous. A two-stage lander leaves its descent element on the surface.
  const twoStage = lander.modules.length > 1
  const ascentElement = lander.modules[0]
  const liftoffMassKg = twoStage ? massOf(ascentElement) : descent.massAtTouchdownKg
  const lunarAscent = planAscent({
    field: moonF,
    site,
    earliestMs: stayEndMs,
    target: capsuleAt(stayEndMs),
    lander,
    massKg: liftoffMassKg,
    insertionAltKm: { perilune: pdiAltKm, apolune: Math.max(pdiAltKm + 20, 0.8 * lunarOrbitAltKm) },
  })

  // ---- 4. Home: crew back in the capsule, the lander stays behind in lunar orbit.
  const home = flyHomebound({
    ephem,
    orbit: capsuleAt(lunarAscent.dockingMs),
    earliestMs: lunarAscent.dockingMs + HOUR_MS,
    massKg: capsuleAloneKg,
    engine: capsuleEngine.use,
    entryAltKm: inp.entryAltKm ?? 121.92,
    entryFpaDeg: inp.entryFpaDeg ?? -6.5,
  })

  // ---- 5. Legs.
  const ascentPath: Path = { t: ascent.t.map((s) => liftoffMs + s * 1000), r: ascent.r, thrusting: ascent.thrusting }
  const orbitIdx = orbitRun.t.findIndex((s) => loiEndMs + s * 1000 >= home.segs[0].t[0])
  const stop = orbitIdx < 0 ? orbitRun.t.length : orbitIdx
  const lunarOrbitLeg: MissionLeg = {
    id: 'lunar-orbit',
    label: 'Lunar orbit',
    craft: 'capsule',
    frame: 'moon',
    powered: false,
    track: {
      t: [...orbitRun.t.slice(0, stop).map((s) => loiEndMs + s * 1000), ...home.segs[0].t],
      p: [...orbitRun.r.slice(0, stop), ...home.segs[0].p],
    },
  }
  const surfaceT: number[] = []
  for (let t = touchdownMs; t < lunarAscent.liftoffMs; t += 0.5 * HOUR_MS) surfaceT.push(t)
  surfaceT.push(lunarAscent.liftoffMs)
  const allLegs: MissionLeg[] = [
    ...legsOf(ascentPath, 'capsule', 'earth', 'ascent', 'Ascent'),
    ...out.segs.map((s) => legOfSeg(s, 'capsule')),
    lunarOrbitLeg,
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
    ...lunarAscent.events.map((e) => ev({ ...e, short: shortOf(e.label), craft: 'lander', kind: e.dvKms ? 'burn' : 'event', by: e.dvKms ? lander.name : null })),
    ...home.events.map((e) => ev({ ...e, kind: 'burn' })),
    ev({ id: 'ei', short: 'EI', label: 'Entry Interface (EI)', utcMs: home.entry.utcMs, massAfterKg: home.massAfterKg }),
  ]
    .map((e) => ({ ...e, id: normalId(e), utcMs: Math.round(e.utcMs) }))
    .sort((a, b) => a.utcMs - b.utcMs)

  // ---- 7. What every element has to carry.
  const tli = out.events[0]
  const loi = out.events[1]
  const tei = home.events[0]
  const propellant: PropellantUse[] = [
    { element: tliStage.name, usedKg: tliStage.propellantKg - ascent.upperStagePropellantKg + tli.propellantKg, capacityKg: tliStage.propellantKg },
    { element: capsuleEngine.module.name, usedKg: loi.propellantKg + tei.propellantKg, capacityKg: capsuleEngine.module.propellantKg },
  ]
  if (twoStage) {
    const descentElement = lander.modules[lander.modules.length - 1]
    propellant.push({ element: descentElement.name, usedKg: descentElement.propellantKg - descent.propellantLeftKg, capacityKg: descentElement.propellantKg })
    propellant.push({ element: ascentElement.name, usedKg: ascentElement.propellantKg - lunarAscent.propellantLeftKg, capacityKg: ascentElement.propellantKg })
  } else {
    propellant.push({ element: ascentElement.name, usedKg: ascentElement.propellantKg - lunarAscent.propellantLeftKg, capacityKg: ascentElement.propellantKg })
  }
  for (const u of propellant) {
    if (u.usedKg > u.capacityKg) notes.push(`${u.element}: this mission needs ${((u.usedKg - u.capacityKg) / 1000).toFixed(1)} t more propellant than it carries.`)
  }
  if (home.planeOffDeg > 20) {
    notes.push(
      `Leaving on this day is expensive: the lunar orbit's plane is ${home.planeOffDeg.toFixed(0)}° away from the way home, so the burn for home has to turn out of it. ` +
        'A lunar orbit keeps its orientation in space; it lines up with the way home about every 14 days.',
    )
  }
  if (descent.crossRangeDeg > 0.2) notes.push(`The landing point was ${descent.crossRangeDeg.toFixed(1)}° off the orbit plane at descent; the lander steered sideways to reach it.`)
  if (lunarAscent.planeChangeDeg > 0.5) {
    notes.push(`At liftoff the landing point was ${lunarAscent.planeChangeDeg.toFixed(1)}° off the capsule's orbit plane (the Moon has turned under the orbit); the ascent paid for that plane change.`)
  }

  const park = apsides(MU_EARTH, ascent.insertion.r, ascent.insertion.v)
  const moonNorth = qrot(ephem.moonFixedToInertial(loiEndMs), [0, 0, 1])
  const sources: SourceRef[] = []
  for (const s of [...lv.sources, ...lv.stages.flatMap((x) => x.sources), ...capsule.sources, ...lander.sources, pad.source]) {
    if (s.url && !sources.some((x) => x.url === s.url)) sources.push(s)
  }
  return {
    pad,
    target,
    ephem,
    architecture: { id: inp.architecture.id, name: inp.architecture.name, launchVehicle: lv.name, capsule: capsule.name, lander: lander.name },
    launchMs: liftoffMs,
    touchdownMs,
    lunarLiftoffMs: lunarAscent.liftoffMs,
    dockingMs: lunarAscent.dockingMs,
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
      surfaceStayDays: (lunarAscent.liftoffMs - touchdownMs) / (DAY_S * 1000),
      returnPlaneOffDeg: home.planeOffDeg,
      returnDays: home.returnDays,
      entry: { speedKms: home.entry.speedKms, fpaDeg: home.entry.fpaDeg, latDeg: home.entry.latDeg, lonDeg: home.entry.lonDeg },
      missionDays: (home.entry.utcMs - liftoffMs) / (DAY_S * 1000),
    },
    notes,
    sources,
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
