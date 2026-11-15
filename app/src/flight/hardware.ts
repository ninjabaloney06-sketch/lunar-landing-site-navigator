// Hardware contract: what the simulators need to know about a launch vehicle, a spacecraft and a mission
// architecture. Names are the official ones (NASA / the builder), every number carries its source.
// Data lives in launchVehicles.ts (Saturn V, SLS) and spacecraft.ts (Apollo CSM and LM, Orion, the Artemis
// landers); the simulators (ascent.ts, lunar.ts, mission.ts) read nothing else about a vehicle.
import type { SourceRef } from './types'

export interface EngineSpec {
  name: string // "F-1", "RS-25", "J-2", "RL10B-2", "AJ10-137 (Service Propulsion System)"
  count: number
  thrustVacN: number // per engine, vacuum
  thrustSlN: number | null // per engine at sea level; null for engines that only fire in vacuum
  ispVacS: number
  ispSlS: number | null
  throttleMin: number // lowest throttle setting as a fraction of full thrust; 1 = not throttleable
}

/** One propulsive element: a rocket stage, a booster, or a spacecraft module with its engine. */
export interface StageSpec {
  id: string
  name: string // official name: "S-IC", "Core Stage", "Interim Cryogenic Propulsion Stage (ICPS)"
  dryKg: number // mass without usable propellant (includes residuals and the interstage it drops with)
  propellantKg: number // usable main-engine propellant
  /** Set when propellantKg is not a stated capacity. 'lower-bound': the real usable load is at least this
   *  (derived from a "more than" figure, no capacity published), so a propellant shortfall computed with it is
   *  an upper limit on the real one. `note` is one plain sentence the UI shows next to any propellant verdict
   *  for this element; `validated` stays false until the science lead signs the vehicle's numbers. */
  propellantStatus?: { kind: 'lower-bound'; note: string; validated: false; sources: SourceRef[] }
  engine: EngineSpec | null // null = no main engine (a crew module)
  diameterM: number
  lengthM: number
  sources: SourceRef[]
}

/** Mass dropped during the ascent that is not a stage: the Launch Escape / Launch Abort System, fairing panels. */
export interface JettisonSpec {
  name: string
  massKg: number
  /** Seconds after the ignition of the stage with this index (in LaunchVehicleSpec.stages) at which it goes. */
  afterStage: number
  delayS: number
  sources: SourceRef[]
}

export interface LaunchVehicleSpec {
  id: string // 'saturn-v' | 'sls-block-1' | 'sls-block-1b'
  name: string
  /** Strap-on boosters that burn in parallel with stages[0] (SLS Solid Rocket Boosters); null for Saturn V. */
  boosters: (StageSpec & { count: number; burnTimeS: number }) | null
  /** Core stages in firing order. The last one is the stage that also performs the trans-lunar injection. */
  stages: StageSpec[]
  jettisons: JettisonSpec[]
  /** Adapters and instrument units that stay with the last stage (Saturn V Instrument Unit, SLS LVSA / OSA). */
  upperStageExtrasKg: number
  note: string
  sources: SourceRef[]
}

export interface SpacecraftSpec {
  id: string // 'apollo-csm' | 'apollo-lm' | 'orion' | 'starship-hls' | 'blue-moon-mk2'
  name: string
  role: 'capsule' | 'lander'
  /** Modules from the top down. Capsule: crew module, service module. Lander: ascent element first, then the
   *  descent element; a single-stage lander has one module that does both. */
  modules: StageSpec[]
  note: string
  sources: SourceRef[]
}

export interface ArchitectureSpec {
  id: string // 'apollo' | 'artemis-starship' | 'artemis-blue-moon'
  name: string // "Apollo: Saturn V, lunar orbit rendezvous"
  launchVehicleId: string
  capsuleId: string
  landerId: string
  /** Where capsule and lander meet at the Moon. 'llo': low lunar orbit, both arrive on one launch (Apollo).
   *  'nrho': near-rectilinear halo orbit, the lander is already waiting there (Artemis). */
  rendezvous: 'llo' | 'nrho'
  note: string
  /** How long this design stays on the surface: the stay a fresh plan starts with, the longest the hardware
   *  supported or is planned for (null when no limit is documented), and where those numbers come from. */
  surfaceStay?: { defaultDays: number; maxDays: number | null; basis: string; sources: SourceRef[] }
}
