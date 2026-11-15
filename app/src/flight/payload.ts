// Payload maximisation (P2): how much cargo the lander can set down on the surface for a mission that has
// already been planned (mission.ts or missionNrho.ts), when every element is loaded with exactly the propellant
// the flight needs plus a stated reserve.
//
// This is a layer over a finished plan, not a second planner. The plan gives, for every burn, the delta-v the
// flight needed (integrated thrust acceleration, losses included) and the element that fired it; the hardware
// gives each element's engine (specific impulse) and tank capacity. With the delta-v of every burn held fixed,
// the rocket equation (Tsiolkovsky, burn by burn, mass falling over each burn) makes every element's propellant
// an affine function of the cargo mass X and of the propellant loaded into the elements it carries:
//
//   extra propellant of a burn = (exp(Δv / (g0 · Isp)) − 1) · extra mass left after the burn
//
// Extra mass left after a burn = X while the cargo is aboard (from liftoff, or from undocking for a lander that
// waits in the halo orbit, to touchdown) + for every element in the stack, the change of what is still in its
// tank. Elements are loaded with need × (1 + reserve), so propellant the plan carried but did not burn is not
// carried (that is what frees mass for cargo); the upper stage of the launch vehicle stays fully loaded, as
// launch vehicles fly. The launch itself: the lower stages burn their whole load whatever the payload, and the
// upper stage makes up the rest; how much more it burns per kilogram of payload is measured by flying the
// ascent twice (ascentSensitivity, 0.6 to 0.7 s per ascent: a worker job).
//
// The largest X for which every element's need plus reserve fits its tank, and the lander's engines can still
// hold its weight at touchdown, is the maximum payload. What is held fixed (each burn's delta-v) is the main
// approximation: a heavier craft burns longer, and its gravity losses grow; this is one of the uncertainty terms.
//
// Every output here is new physics: not yet validated by the science lead (Trap 2), and says so in `validation`.
import { G0, MU_MOON, R_MOON } from './astro'
import { simulateAscent } from './ascent'
import type { LaunchVehicleSpec, SpacecraftSpec, StageSpec } from './hardware'
import type { Launchpad, MissionEvent, MissionPlan, SourceRef, Vec3 } from './types'
import { DEG, cross } from './vec'

// ---- Validation marker (Trap 2)

/** Machine-readable marker carried by every result of this file. The UI shows `text`. */
export interface ValidationMarker {
  validated: false
  text: 'not yet validated by the science lead'
}
export const NOT_VALIDATED: ValidationMarker = { validated: false, text: 'not yet validated by the science lead' }

// ---- Choices and assumptions of this calculation (each named, with its source or marked ASSUMPTION)

/** ASSUMPTION: every element keeps 3 % of the propellant it needs unburned, as a reserve. No mission-wide figure
 *  is sourced; for comparison, Apollo 11's descent stage consumed 17,414 lbm of the 18,184 lbm loaded (4.2 % left)
 *  — NASA SP-2000-4029, Apollo by the Numbers, Apollo 11 summary (RESERVE_COMPARISON_SOURCE). */
export const PROPELLANT_RESERVE_FRACTION = 0.03
export const RESERVE_COMPARISON_SOURCE: SourceRef = {
  label: 'NASA SP-2000-4029, Apollo by the Numbers: Apollo 11 summary (descent propellant consumed 17,414 lbm of 18,184 loaded)',
  url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm',
}
/** Physics, not a choice: at full thrust the lander must at least hold its own weight at touchdown, or it
 *  cannot stop a vertical descent. Thrust-to-weight on the Moon at touchdown ≥ 1. */
export const MIN_TOUCHDOWN_THRUST_TO_WEIGHT = 1
/** Surface gravity of the app's reference sphere, m/s² (GM from DE440, R_MOON from geometry/index.ts). */
export const G_MOON = (MU_MOON / (R_MOON * R_MOON)) * 1000

/** How well a hardware number is known, from the rule in spacecraft.ts (comment above every number): 'agency' =
 *  stated by NASA or the builder, 'fallback' = Wikipedia only, 'assumption' = the file's own choice. */
export type Grade = 'agency' | 'fallback' | 'assumption'
/** ASSUMPTION: 1σ relative uncertainty given to a dry mass of each grade. */
export const DRY_MASS_SIGMA: Record<Grade, number> = { agency: 0.01, fallback: 0.1, assumption: 0.3 }
/** ASSUMPTION: 1σ relative uncertainty given to a vacuum specific impulse of each grade. */
export const ISP_SIGMA: Record<Grade, number> = { agency: 0.005, fallback: 0.01, assumption: 0.03 }
/** Calibrated (payload.test.ts, the two "re-planned" tests): the fixed-delta-v chain misses how much more a
 *  heavier lander burns (its burns take longer and lose more to gravity). Re-flown by the planner on the Apollo
 *  LM, the cargo's extra descent propellant came out 5.4 % above the chain's with 1 t of cargo and 6.5 % above
 *  with 3.2 t; in cargo the second miss is 175 kg, 5.5 % of it. The term is taken as this fraction of the cargo
 *  figure, 1σ. It is one-sided (the real figure is lower), and it is calibrated on Apollo only. */
export const LOSS_MODEL_FRACTION = 0.06
/** The chain is checked against re-planned flights for cargo up to this fraction of the lander's mass at
 *  undocking (payload.test.ts); beyond it the result says so. */
export const MAX_CHECKED_CARGO_FRACTION = 0.3

/** Grades of the spacecraft modules, read from the comments in spacecraft.ts (per module id). A module not
 *  listed is treated as 'fallback'. `capacityLowerBound`: the propellant capacity given is a lower limit
 *  (spacecraft.ts, Blue Moon: "The launch mass is given as a lower limit, so this is one too"). */
export const MODULE_GRADES: Record<string, { dry: Grade; isp: Grade; capacityLowerBound?: boolean }> = {
  'apollo-cm': { dry: 'agency', isp: 'agency' },
  'apollo-sm': { dry: 'agency', isp: 'agency' },
  'apollo-lm-ascent': { dry: 'agency', isp: 'agency' },
  'apollo-lm-descent': { dry: 'agency', isp: 'agency' },
  'orion-cm': { dry: 'agency', isp: 'agency' },
  'orion-esm': { dry: 'agency', isp: 'agency' },
  'starship-hls': { dry: 'assumption', isp: 'fallback' },
  'blue-moon-mk2': { dry: 'fallback', isp: 'fallback', capacityLowerBound: true },
}
const gradeOf = (m: StageSpec) => MODULE_GRADES[m.id] ?? { dry: 'fallback' as Grade, isp: 'fallback' as Grade }

// ---- Contract

export interface PayloadHardware {
  launchVehicle: LaunchVehicleSpec
  capsule: SpacecraftSpec
  lander: SpacecraftSpec
}

export interface PayloadInput extends PayloadHardware {
  /** A finished plan of planMission or planMissionNrho (the worker's reply without the ephemeris is enough). */
  plan: Omit<MissionPlan, 'ephem'>
  rendezvous: 'llo' | 'nrho'
  /** Extra upper-stage propellant burned in the launch per extra kg of payload, kg/kg (ascentSensitivity). */
  ascentKgPerKg: number
  /** Default PROPELLANT_RESERVE_FRACTION. */
  reserveFraction?: number
}

/** One burn of the plan with what it takes at the maximum payload. */
export interface PayloadBurn {
  id: string // event id of the plan ('ascent', 'tli', 'loi', 'pdi', …)
  label: string // the plan's event label
  element: string // tank it draws from (official module or stage name)
  dvKms: number // delta-v of the plan, km/s (held fixed)
  planPropellantKg: number // as planned, kg (for 'ascent': the upper stage's share is not split out, see note)
  propellantKg: number // at the maximum payload with propellant loaded to need, kg
  carriesPayload: boolean
}

/** One tank: what the plan used, and what it is loaded with at the maximum payload. */
export interface PayloadElement {
  element: string
  capacityKg: number
  capacityIsLowerBound: boolean
  planLoadKg: number // what the plan loaded
  planUsedKg: number // what the plan burned
  usedKg: number // burned at the maximum payload
  reserveKg: number // held back: reserveFraction × usedKg
  loadKg: number // usedKg + reserveKg (for the launch vehicle's upper stage: its full capacity)
}

export interface UncertaintyTerm {
  id: string // 'dry:<module id>', 'isp:<module or stage id>', 'losses'
  label: string // "Dry mass of Descent Stage ±1 % (agency figure)"
  kg: number // 1σ effect on the maximum payload, kg (absolute)
}

export interface PayloadResult {
  validation: ValidationMarker
  /** 'payload': a number. 'extrapolated': a number far beyond the cargo the method is checked for (more than
   *  MAX_CHECKED_CARGO_FRACTION of the lander's mass): show it as an order of magnitude at most. 'short': no
   *  cargo; even empty, an element the cargo rides with lacks propellant (shortfall). 'undetermined': short, but
   *  only against a capacity that is a lower limit, so the data cannot decide. */
  verdict: 'payload' | 'extrapolated' | 'short' | 'undetermined'
  maxPayloadKg: number // ≥ 0, kg; 0 when verdict is 'short' or 'undetermined'
  /** The same figure before clamping: negative = how much mass the lander would have to shed (kg of cargo
   *  equivalent). null when an element short of propellant does not carry the cargo (no cargo figure applies). */
  rawPayloadKg: number | null
  epsilonKg: number // 1σ, root sum of squares of `terms`; 0 when rawPayloadKg is null
  dominantTerm: UncertaintyTerm | null
  terms: UncertaintyTerm[] // largest first
  /** 'lower': the limiting capacity is a lower limit, so the true maximum is at least maxPayloadKg. */
  bound: 'value' | 'lower'
  limitedBy: { element: string; kind: 'propellant' | 'thrust' } | null
  /** Elements short of propellant (reserve included) even with no cargo, kg. carriesCargo false: the shortfall
   *  limits the mission (the capsule's launch), not the cargo. */
  shortfall: { element: string; kg: number; capacityIsLowerBound: boolean; carriesCargo: boolean }[]
  /** false: the cargo is beyond MAX_CHECKED_CARGO_FRACTION of the lander's mass; the figure is an extrapolation. */
  withinCheckedRange: boolean
  reserveFraction: number
  /** Where the cargo rides: 'launch' (on the same launch as the capsule, LLO) or 'nrho' (loaded on the lander
   *  where it waits; how it got there is not part of the plan). */
  cargoFrom: 'launch' | 'nrho'
  burns: PayloadBurn[] // in flight order
  elements: PayloadElement[]
  /** Payload-carrying phases: propellant per phase at the maximum payload, kg (for the breakdown). */
  phases: { phase: PayloadPhase; label: string; propellantKg: number; planPropellantKg: number }[]
  assumptions: string[]
  caveats: string[]
  sources: SourceRef[]
}

export type PayloadPhase = 'launch' | 'tli' | 'arrival' | 'lander-to-orbit' | 'descent' | 'lunar-ascent' | 'lander-return' | 'plane-change' | 'return' | 'correction'

/** Which phase an event of either planner belongs to. */
export function phaseOfEvent(e: Pick<MissionEvent, 'id' | 'craft'>, touchdownMs?: number, utcMs?: number): PayloadPhase {
  switch (e.id) {
    case 'ascent':
      return 'launch'
    case 'tli':
      return 'tli'
    case 'loi':
    case 'opf':
      return e.craft === 'capsule' ? 'arrival' : 'lander-to-orbit'
    case 'otc':
      return 'correction'
    case 'lander-nrd':
    case 'lander-loi':
      return 'lander-to-orbit'
    case 'doi':
    case 'pdi':
      return 'descent'
    case 'llo-departure':
    case 'lander-nri':
      return 'lander-return'
    case 'lopc':
      return 'plane-change'
    case 'tei':
    case 'rpf':
      return 'return'
  }
  if (e.craft === 'lander') return touchdownMs !== undefined && utcMs !== undefined && utcMs < touchdownMs ? 'descent' : 'lunar-ascent'
  return 'correction'
}

export const PHASE_LABELS: Record<PayloadPhase, string> = {
  launch: 'Launch to Earth parking orbit',
  tli: 'Trans-Lunar Injection (TLI)',
  arrival: 'Arrival in lunar orbit (LOI; NRHO: flyby and insertion)',
  'lander-to-orbit': 'Lander: halo orbit to low lunar orbit',
  descent: 'Descent: DOI and powered descent',
  'lunar-ascent': 'Lunar ascent and rendezvous',
  'lander-return': 'Lander: low lunar orbit back to the halo orbit',
  'plane-change': 'Lunar Orbit Plane Change (LOPC)',
  return: 'Trans-Earth Injection and return flyby',
  correction: 'Trajectory corrections',
}

// ---- The launch: extra upper-stage propellant per kilogram of payload

const massOf = (m: StageSpec) => m.dryKg + m.propellantKg
const totalMass = (s: SpacecraftSpec) => s.modules.reduce((sum, m) => sum + massOf(m), 0)
const sensitivityCache = new Map<string, number>()

/** Extra propellant the launch vehicle's upper stage burns during the ascent per extra kilogram of payload,
 *  kg/kg: two ascents flown due east from the pad's latitude into the parking orbit (ascent.ts), with the
 *  plan's payload and with one tonne more. Costs two ascent simulations (about 1.3 s): run it in the worker.
 *  Cached per vehicle, payload, latitude and parking altitude. */
export function ascentSensitivity(inp: PayloadHardware & { pad: Launchpad; rendezvous: 'llo' | 'nrho'; parkingAltKm?: number }): number {
  const payloadKg = totalMass(inp.capsule) + (inp.rendezvous === 'llo' ? totalMass(inp.lander) : 0)
  const alt = inp.parkingAltKm ?? 185
  const key = `${inp.launchVehicle.id}|${payloadKg.toFixed(0)}|${inp.pad.latDeg.toFixed(2)}|${alt}`
  const hit = sensitivityCache.get(key)
  if (hit !== undefined) return hit
  const lat = inp.pad.latDeg * DEG
  const padEci: Vec3 = [Math.cos(lat), 0, Math.sin(lat)]
  const fly = (kg: number) =>
    simulateAscent({ vehicle: inp.launchVehicle, payloadKg: kg, padEci, pole: [0, 0, 1], target: { planeNormal: cross(padEci, [0, 1, 0]), perigeeKm: alt, apogeeKm: alt } })
  const STEP_KG = 1000
  const s = (fly(payloadKg).upperStagePropellantKg - fly(payloadKg + STEP_KG).upperStagePropellantKg) / STEP_KG
  sensitivityCache.set(key, s)
  return s
}

// ---- The mass chain

type TankId = string // module or stage id

interface Tank {
  id: TankId
  element: string // official name, as in plan.propellant
  module: StageSpec
  ispS: number
  capacityKg: number
  planLoadKg: number
  planUsedKg: number
  fixedLoad: boolean // the launch vehicle's upper stage: always full
  lowerBound: boolean
}

interface ChainBurn {
  id: string
  label: string
  phase: PayloadPhase
  tank: TankId
  dvKms: number
  ascent: boolean // the launch: extra propellant = ascentKgPerKg × extra payload
  carried: TankId[] // tanks in the stack during this burn, the firing one included except for the launch
  payload: boolean
  planPropellantKg: number
}

interface Chain {
  tanks: Tank[]
  burns: ChainBurn[]
  /** Module ids that ride with each tank (dry masses carried along with it): the capsule's crew module rides
   *  with the service module. */
  ridesWith: Record<TankId, string[]>
  lander: { thrustN: number; touchdownKg: number; lastBurnBeforeTouchdown: number; massKg: number }
}

/** Engine-carrying module of a spacecraft. */
const engineModule = (s: SpacecraftSpec): StageSpec => {
  const m = s.modules.find((x) => x.engine)
  if (!m?.engine) throw new Error(`${s.name} has no main engine.`)
  return m
}

function buildChain(inp: PayloadInput): Chain {
  const { plan, launchVehicle: lv, capsule, lander } = inp
  const llo = inp.rendezvous === 'llo'
  const upper = lv.stages[lv.stages.length - 1]
  const sm = engineModule(capsule)
  const twoStage = lander.modules.length > 1
  const A = lander.modules[0]
  const D = lander.modules[lander.modules.length - 1]
  const used = (m: StageSpec) => plan.propellant.find((u) => u.element === m.name)?.usedKg ?? 0
  const undock = plan.events.find((e) => e.id === 'undocking')
  const tanks: Tank[] = [
    { id: upper.id, element: upper.name, module: upper, ispS: upper.engine?.ispVacS ?? 0, capacityKg: upper.propellantKg, planLoadKg: upper.propellantKg, planUsedKg: used(upper), fixedLoad: true, lowerBound: false },
    { id: sm.id, element: sm.name, module: sm, ispS: sm.engine!.ispVacS, capacityKg: sm.propellantKg, planLoadKg: sm.propellantKg, planUsedKg: used(sm), fixedLoad: false, lowerBound: !!gradeOf(sm).capacityLowerBound },
  ]
  const landerIsp = (m: StageSpec) => (m.engine ?? lander.modules.find((x) => x.engine)?.engine)?.ispVacS ?? 0
  if (twoStage) {
    for (const m of [D, A]) tanks.push({ id: m.id, element: m.name, module: m, ispS: landerIsp(m), capacityKg: m.propellantKg, planLoadKg: m.propellantKg, planUsedKg: used(m), fixedLoad: false, lowerBound: !!gradeOf(m).capacityLowerBound })
  } else {
    // mission.ts loads a single-module lander full; missionNrho.ts with what the sortie needs and 0.5 % more
    const load = !llo && undock?.massAfterKg ? undock.massAfterKg - D.dryKg : D.propellantKg
    tanks.push({ id: D.id, element: D.name, module: D, ispS: landerIsp(D), capacityKg: D.propellantKg, planLoadKg: load, planUsedKg: used(D), fixedLoad: false, lowerBound: !!gradeOf(D).capacityLowerBound })
  }
  const landerTanksDown = twoStage ? [D.id, A.id] : [D.id]
  const landerTanksUp = twoStage ? [A.id] : [D.id]
  const undockMs = undock?.utcMs ?? plan.touchdownMs
  const burns: ChainBurn[] = []
  for (const e of plan.events) {
    if (e.kind !== 'burn') continue
    const phase = phaseOfEvent(e, plan.touchdownMs, e.utcMs)
    const base = { id: e.id, label: e.label, phase, dvKms: e.dvKms ?? 0, planPropellantKg: e.propellantKg ?? 0, ascent: false }
    if (e.id === 'ascent') {
      burns.push({ ...base, tank: upper.id, ascent: true, carried: [sm.id, ...(llo ? landerTanksDown : [])], payload: llo })
    } else if (e.id === 'tli') {
      burns.push({ ...base, tank: upper.id, carried: [upper.id, sm.id, ...(llo ? landerTanksDown : [])], payload: llo })
    } else if (e.craft === 'capsule') {
      const docked = llo && e.utcMs < undockMs
      burns.push({ ...base, tank: sm.id, carried: [sm.id, ...(docked ? landerTanksDown : [])], payload: docked })
    } else {
      const down = e.utcMs < plan.touchdownMs
      burns.push({ ...base, tank: down ? D.id : landerTanksUp[0], carried: down ? landerTanksDown : landerTanksUp, payload: down })
    }
  }
  const crew = capsule.modules.filter((m) => m !== sm).map((m) => m.id)
  const ridesWith: Record<TankId, string[]> = { [sm.id]: crew }
  const downBurns = burns.map((b, i) => ({ b, i })).filter(({ b }) => b.payload && b.tank === D.id)
  const last = downBurns[downBurns.length - 1]
  const lastEvent = last ? plan.events.find((e) => e.id === last.b.id && e.craft === 'lander') : undefined
  const thrustN = (D.engine?.thrustVacN ?? 0) * (D.engine?.count ?? 0)
  return {
    tanks,
    burns,
    ridesWith,
    lander: { thrustN, touchdownKg: lastEvent?.massAfterKg ?? 0, lastBurnBeforeTouchdown: last ? last.i : -1, massKg: undock?.massAfterKg ?? totalMass(lander) },
  }
}

interface Perturbation {
  payloadKg: number
  extraDryKg?: Record<string, number> // module id → extra dry mass, kg
  ispScale?: Record<TankId, number> // tank id → factor on the specific impulse
  /** 'need': elements loaded with need × (1 + reserve) (the calculation). 'asPlanned': loads as in the plan
   *  (for checking the chain against a re-planned mission). */
  loads?: 'need' | 'asPlanned'
}

interface ChainState {
  dp: number[] // extra propellant per burn, kg
  dUsed: Record<TankId, number>
  massAfter: number[] // extra mass left after each burn, kg
}

/** Extra propellant of every burn for a perturbation of the plan (affine in the perturbation). */
function propagate(chain: Chain, f: number, ascentKgPerKg: number, p: Perturbation): ChainState {
  const n = chain.burns.length
  const dp = new Array<number>(n).fill(0)
  const massAfter = new Array<number>(n).fill(0)
  const tankById = new Map(chain.tanks.map((t) => [t.id, t]))
  const ratio = chain.burns.map((b) => {
    const t = tankById.get(b.tank)!
    const isp = t.ispS * (p.ispScale?.[t.id] ?? 1)
    return isp > 0 ? Math.exp((b.dvKms * 1000) / (G0 * isp)) : 1
  })
  const dryOf = (tank: TankId) => {
    const t = tankById.get(tank)!
    return (p.extraDryKg?.[t.module.id] ?? 0) + (chain.ridesWith[tank] ?? []).reduce((s, id) => s + (p.extraDryKg?.[id] ?? 0), 0)
  }
  const need = p.loads !== 'asPlanned'
  for (let iter = 0; iter < 200; iter++) {
    const total: Record<TankId, number> = {}
    for (let i = 0; i < n; i++) total[chain.burns[i].tank] = (total[chain.burns[i].tank] ?? 0) + dp[i]
    let change = 0
    // backward: what is still in a tank after burn i depends on the burns after it
    const after: Record<TankId, number> = {}
    for (let i = n - 1; i >= 0; i--) {
      const b = chain.burns[i]
      let q = b.payload ? p.payloadKg : 0
      let ownFixed = false // the firing tank is loaded as planned: what this burn takes extra is solved for below
      for (const id of b.carried) {
        const t = tankById.get(id)!
        q += dryOf(id)
        if (t.fixedLoad || !need) {
          // loaded as planned: the tank holds less by what has been burned extra so far (this burn included)
          let before = 0
          for (let k = 0; k < i; k++) if (chain.burns[k].tank === id) before += dp[k]
          q -= before
          if (id === b.tank) ownFixed = true
        } else {
          // loaded with need × (1 + f): after this burn it holds the reserve plus what the later burns need
          const used = t.planUsedKg + (total[id] ?? 0)
          q += f * used + t.planUsedKg - t.planLoadKg + (after[id] ?? 0)
        }
      }
      // Δp = (r − 1)(q − Δp) when this burn's own extra comes out of a fixed load, else Δp = (r − 1) q
      const next = b.ascent ? ascentKgPerKg * q : ownFixed ? ((ratio[i] - 1) * q) / ratio[i] : (ratio[i] - 1) * q
      change = Math.max(change, Math.abs(next - dp[i]))
      dp[i] = next
      massAfter[i] = ownFixed ? q - next : q
      after[b.tank] = (after[b.tank] ?? 0) + next
    }
    if (change < 1e-7) break
  }
  const dUsed: Record<TankId, number> = {}
  for (const t of chain.tanks) dUsed[t.id] = 0
  for (let i = 0; i < n; i++) dUsed[chain.burns[i].tank] += dp[i]
  return { dp, dUsed, massAfter }
}

interface Solution {
  /** null: nothing limits the cargo (no element carries it). */
  rawKg: number | null
  limitedBy: { tank: TankId | null; kind: 'propellant' | 'thrust' } | null
  shortAtZero: { tank: TankId; kg: number; carriesCargo: boolean }[]
}

/** Largest cargo that every constraint allows, with the constraints affine in it. */
function solve(chain: Chain, f: number, s: number, p: Omit<Perturbation, 'payloadKg'>): Solution {
  const at0 = propagate(chain, f, s, { ...p, payloadKg: 0 })
  const at1 = propagate(chain, f, s, { ...p, payloadKg: 1 })
  let best = Infinity
  let limitedBy: Solution['limitedBy'] = null
  const shortAtZero: Solution['shortAtZero'] = []
  for (const t of chain.tanks) {
    // (1 + f) · used ≤ capacity
    const a = (1 + f) * (t.planUsedKg + at0.dUsed[t.id]) - t.capacityKg
    const b = (1 + f) * (at1.dUsed[t.id] - at0.dUsed[t.id])
    const carriesCargo = b > 1e-12
    if (a > 0) shortAtZero.push({ tank: t.id, kg: a, carriesCargo })
    if (carriesCargo) {
      const x = -a / b
      if (x < best) {
        best = x
        limitedBy = { tank: t.id, kind: 'propellant' }
      }
    }
  }
  // thrust at touchdown: thrust ≥ MIN_TW · (mass at touchdown + extra) · g_moon
  const L = chain.lander
  if (L.lastBurnBeforeTouchdown >= 0 && L.thrustN > 0) {
    const m0 = L.touchdownKg + at0.massAfter[L.lastBurnBeforeTouchdown]
    const k = at1.massAfter[L.lastBurnBeforeTouchdown] - at0.massAfter[L.lastBurnBeforeTouchdown]
    if (k > 1e-12) {
      const x = (L.thrustN / (MIN_TOUCHDOWN_THRUST_TO_WEIGHT * G_MOON) - m0) / k
      if (x < best) {
        best = x
        limitedBy = { tank: null, kind: 'thrust' }
      }
    }
  }
  return { rawKg: Number.isFinite(best) ? best : null, limitedBy, shortAtZero }
}

/** Maximum cargo the lander sets down at the plan's landing point, its uncertainty and the propellant per burn. */
export function maxPayload(inp: PayloadInput): PayloadResult {
  const f = inp.reserveFraction ?? PROPELLANT_RESERVE_FRACTION
  const s = inp.ascentKgPerKg
  const chain = buildChain(inp)
  const tankById = new Map(chain.tanks.map((t) => [t.id, t]))
  const nominal = solve(chain, f, s, {})
  const shortTanks = nominal.shortAtZero.map((x) => ({ ...x, t: tankById.get(x.tank)! }))
  const raw = nominal.rawKg
  const limitTank = nominal.limitedBy?.tank ? tankById.get(nominal.limitedBy.tank)! : null
  const lowerBoundLimit = !!limitTank?.lowerBound
  // Short elements the cargo rides with decide the verdict; one it does not ride with (the capsule's launch in
  // the halo-orbit design) makes the mission short but not the lander's cargo: a caveat.
  const cargoShort = shortTanks.filter((x) => x.carriesCargo)
  let verdict: PayloadResult['verdict'] = 'payload'
  if (cargoShort.length > 0) verdict = cargoShort.every((x) => x.t.lowerBound) ? 'undetermined' : 'short'
  else if (raw === null || raw < 0) verdict = 'short' // the engines cannot hold the empty lander at touchdown
  const withinCheckedRange = Math.abs(raw ?? 0) <= MAX_CHECKED_CARGO_FRACTION * chain.lander.massKg
  if (verdict === 'payload' && !withinCheckedRange) verdict = 'extrapolated'
  const X = (verdict === 'payload' || verdict === 'extrapolated') && raw !== null ? raw : 0

  // Uncertainty: one-at-a-time partial derivatives, 1σ each, combined as a root sum of squares. Taken about
  // the unclamped figure (also when it is negative: how far from carrying any cargo).
  const terms: UncertaintyTerm[] = []
  const finiteRaw = raw ?? 0
  const rawOf = (p: Omit<Perturbation, 'payloadKg'>) => solve(chain, f, s, p).rawKg ?? finiteRaw
  const modules: { m: StageSpec; owner: string }[] = [
    ...inp.capsule.modules.map((m) => ({ m, owner: inp.capsule.name })),
    ...inp.lander.modules.map((m) => ({ m, owner: inp.lander.name })),
  ]
  if (raw !== null) for (const { m } of modules) {
    const g = gradeOf(m).dry
    const sigma = DRY_MASS_SIGMA[g] * m.dryKg
    if (!(sigma > 0)) continue
    const kg = Math.abs(rawOf({ extraDryKg: { [m.id]: sigma } }) - finiteRaw)
    terms.push({ id: `dry:${m.id}`, label: `Dry mass of ${m.name} ±${(DRY_MASS_SIGMA[g] * 100).toFixed(0)} % (${gradeText(g)})`, kg })
  }
  if (raw !== null) {
    for (const t of chain.tanks) {
      const g: Grade = t.fixedLoad ? 'agency' : gradeOf(t.module).isp
      const kg = Math.abs(rawOf({ ispScale: { [t.id]: 1 - ISP_SIGMA[g] } }) - finiteRaw)
      terms.push({ id: `isp:${t.id}`, label: `Specific impulse of the ${t.element} engine ±${(ISP_SIGMA[g] * 100).toFixed(1)} % (${gradeText(g)})`, kg })
    }
    const lossKg = LOSS_MODEL_FRACTION * Math.abs(finiteRaw)
    terms.push({
      id: 'losses',
      label: `Extra gravity losses of the heavier lander, burns not re-flown (${(LOSS_MODEL_FRACTION * 100).toFixed(0)} % of the cargo, calibrated against re-planned Apollo flights; the real figure is lower)`,
      kg: lossKg,
    })
  }
  terms.sort((a, b) => b.kg - a.kg)
  const epsilonKg = Math.sqrt(terms.reduce((sum, t) => sum + t.kg * t.kg, 0))

  // The flight at the maximum payload (or empty, when there is none).
  const flown = propagate(chain, f, s, { payloadKg: X })
  const burns: PayloadBurn[] = chain.burns.map((b, i) => ({
    id: b.id, label: b.label, element: tankById.get(b.tank)!.element, dvKms: b.dvKms,
    planPropellantKg: b.planPropellantKg, propellantKg: b.planPropellantKg + flown.dp[i], carriesPayload: b.payload,
  }))
  const elements: PayloadElement[] = chain.tanks.map((t) => {
    const usedKg = t.planUsedKg + flown.dUsed[t.id]
    return {
      element: t.element, capacityKg: t.capacityKg, capacityIsLowerBound: t.lowerBound, planLoadKg: t.planLoadKg, planUsedKg: t.planUsedKg,
      usedKg, reserveKg: f * usedKg, loadKg: t.fixedLoad ? t.capacityKg : (1 + f) * usedKg,
    }
  })
  const phases: PayloadResult['phases'] = []
  for (const b of burns) {
    const ph = chain.burns[burns.indexOf(b)].phase
    const row = phases.find((x) => x.phase === ph)
    if (row) {
      row.propellantKg += b.propellantKg
      row.planPropellantKg += b.planPropellantKg
    } else phases.push({ phase: ph, label: PHASE_LABELS[ph], propellantKg: b.propellantKg, planPropellantKg: b.planPropellantKg })
  }

  const llo = inp.rendezvous === 'llo'
  const assumptions = [
    `Reserve: every element keeps ${(f * 100).toFixed(0)} % of the propellant it needs unburned (assumption; Apollo 11's descent stage landed with 4.2 % of its load left).`,
    'Each element is loaded with what the flight needs plus the reserve; propellant the plan carried but did not burn becomes room for cargo. The launch vehicle\'s upper stage stays fully loaded.',
    'The delta-v of every burn is the planned one; the heavier craft is not re-flown (its extra gravity losses are an uncertainty term).',
    llo
      ? 'The cargo rides from liftoff to touchdown on the lander and stays on the surface; it does not come back.'
      : 'The cargo is loaded on the lander where it waits in the halo orbit and stays on the surface; how it gets there (the lander\'s own launch and refilling) is not part of the plan.',
    `The extra launch propellant is measured by flying the ascent twice (${(s * 1000).toFixed(0)} kg of upper-stage propellant per tonne of payload).`,
    `The lander must hold its weight at touchdown at full thrust (thrust-to-weight on the Moon ≥ ${MIN_TOUCHDOWN_THRUST_TO_WEIGHT}).`,
  ]
  const caveats: string[] = []
  if (inp.lander.modules.some((m) => gradeOf(m).dry === 'assumption')) {
    caveats.push(`${inp.lander.name}: its dry mass is an assumption of this app (no published figure), so the payload is an illustration, not a prediction.`)
  }
  if (inp.lander.id === 'starship-hls') {
    caveats.push('SpaceX states that Starship can deliver "up to 100 tons directly to the lunar surface" with on-orbit refilling; a larger figure here is a limit of the tank and engines only, not of the structure, which is not modelled.')
  }
  if (lowerBoundLimit || shortTanks.some((x) => x.t.lowerBound)) {
    caveats.push(`${(limitTank ?? shortTanks.find((x) => x.t.lowerBound)!.t).element}: the propellant capacity is a lower limit (launch mass ">45,000 kg" minus dry mass), so the true result is at least this good.`)
  }
  for (const x of shortTanks) {
    caveats.push(
      `${x.t.element} is short by ${(x.kg / 1000).toFixed(1)} t (reserve included) even with no cargo and every element loaded only with what it needs` +
        (x.carriesCargo ? '.' : '; the cargo does not ride with it, so this limits the mission, not the cargo.'),
    )
  }
  if (!withinCheckedRange) {
    caveats.push(
      `The cargo is ${((Math.abs(raw ?? 0) / chain.lander.massKg) * 100).toFixed(0)} % of the lander's mass, beyond the ${(MAX_CHECKED_CARGO_FRACTION * 100).toFixed(0)} % ` +
        'up to which the method is checked against a re-planned flight: the heavier lander would burn longer and lose more to gravity than this estimate holds. Re-plan with the cargo for a number.',
    )
  }
  const sources = [RESERVE_COMPARISON_SOURCE, ...inp.lander.sources.filter((x) => /spacex\.com\/humanspaceflight|Blue_Moon/.test(x.url))]
  return {
    validation: NOT_VALIDATED,
    verdict,
    maxPayloadKg: X,
    rawPayloadKg: raw,
    epsilonKg,
    dominantTerm: terms[0] ?? null,
    terms,
    bound: lowerBoundLimit || (verdict === 'undetermined') ? 'lower' : 'value',
    limitedBy: nominal.limitedBy ? { element: limitTank?.element ?? `${inp.lander.name} engines`, kind: nominal.limitedBy.kind } : null,
    shortfall: shortTanks.map((x) => ({ element: x.t.element, kg: x.kg, capacityIsLowerBound: x.t.lowerBound, carriesCargo: x.carriesCargo })),
    withinCheckedRange,
    reserveFraction: f,
    cargoFrom: llo ? 'launch' : 'nrho',
    burns,
    elements,
    phases,
    assumptions,
    caveats,
    sources,
  }
}

const gradeText = (g: Grade) => (g === 'agency' ? 'NASA or builder figure' : g === 'fallback' ? 'Wikipedia figure' : 'assumption of this app')

/** For tests: the chain's prediction of each element's extra propellant for cargo X with loads as planned. */
export function predictedExtraUse(inp: PayloadInput, payloadKg: number): Record<string, number> {
  const chain = buildChain(inp)
  const r = propagate(chain, inp.reserveFraction ?? PROPELLANT_RESERVE_FRACTION, inp.ascentKgPerKg, { payloadKg, loads: 'asPlanned' })
  const out: Record<string, number> = {}
  for (const t of chain.tanks) out[t.element] = r.dUsed[t.id]
  return out
}
