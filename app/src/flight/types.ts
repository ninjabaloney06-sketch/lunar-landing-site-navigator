// Flight planner contract: Earth launchpad → lunar landing site with impulsive burns. The flight from the
// trans-lunar injection to the lunar orbit insertion is integrated numerically under the gravity of Earth, the
// Moon and the Sun (nbody.ts); a patched-conic solution (plan.ts) is the first guess that the integration refines.
// The solver (plan.ts) knows nothing about a particular rocket or about the app's data files: a Vehicle
// supplies the performance numbers, a FlightEphemeris supplies where the Moon is. Swap either and the same
// solver plans the flight.
//
// Frames and units: Earth-centred J2000 (ICRF equator, x to the vernal equinox, z north), km, km/s, kg,
// seconds for durations, UTC milliseconds for instants, degrees for angles handed to the UI.
import type { Quat, Vec3 } from '../data/types'

export type { Quat, Vec3 }

/** Where the bodies are. The app builds one from its DE440 ephemeris files (ephemeris.ts); tests use a
 *  circular-orbit stand-in. */
export interface FlightEphemeris {
  startMs: number // first and last instant this ephemeris can answer for
  endMs: number
  /** Moon centre relative to Earth centre, J2000 km. */
  moonPos(utcMs: number): Vec3
  /** Moon velocity relative to Earth, J2000 km/s. */
  moonVel(utcMs: number): Vec3
  /** Unit vector Earth → Sun, J2000. */
  sunDir(utcMs: number): Vec3
  /** Sun centre relative to Earth centre, J2000 km. */
  sunPos(utcMs: number): Vec3
  /** Rotation that takes Earth-fixed (IAU_EARTH) vectors into J2000. */
  earthFixedToInertial(utcMs: number): Quat
  /** Rotation that takes Moon-fixed (MOON_ME) vectors into J2000. */
  moonFixedToInertial(utcMs: number): Quat
}

export interface SourceRef {
  label: string
  url: string
}

export interface Launchpad {
  id: string
  name: string // "LC-39B"
  site: string // "Kennedy Space Center, USA"
  latDeg: number // geodetic latitude, used as geocentric (difference < 0.2°)
  lonDeg: number // east-positive
  source: SourceRef
}

export interface Engine {
  name: string
  ispS: number // vacuum specific impulse, s
  thrustN: number | null // vacuum thrust; null = burn time not estimated
}

/** Everything the planner needs to know about a rocket. All other numbers follow from the trajectory. */
export interface Vehicle {
  id: string
  name: string
  note: string // one line shown under the name
  parkingAltKm: number // circular parking orbit altitude
  ascentLossKms: number // gravity, drag and steering losses assumed for the ascent estimate
  ascentTimeS: number // liftoff → parking orbit insertion
  ascentArcDeg: number // downrange angle flown by insertion (drawing and timing only)
  injectedMassKg: number // mass sent through trans-lunar injection (the "payload to TLI")
  tliStageDryKg: number // dry mass of the stage that performs TLI (burn-time estimate only)
  tliEngine: Engine
  spacecraftEngine: Engine // performs LOI, DOI and the powered descent
  sources: SourceRef[]
}

export interface LandingTarget {
  id: string
  name: string
  latDeg: number // MOON_ME planetocentric
  lonDeg: number // east-positive
}

export interface PlanOptions {
  landingMs: number // touchdown, UTC ms: the plan is built backwards from this instant
  maxTransferDays: number | null // null = minimum-energy transfer; a number caps TLI → Moon arrival
  lloAltKm: number // circular low lunar orbit altitude
  pdiAltKm: number // periapsis altitude of the descent orbit, where powered descent starts
  minLoiterH: number // shortest stay in lunar orbit before the descent orbit insertion
  descentLossKms: number // gravity and steering losses added to the orbital speed at powered-descent start
  descentTimeS: number // powered descent duration (drawing and timing only)
  descentArcDeg: number // downrange angle of the powered descent (drawing and timing only)
}

export const DEFAULT_OPTIONS: Omit<PlanOptions, 'landingMs'> = {
  maxTransferDays: null,
  lloAltKm: 100,
  pdiAltKm: 15,
  minLoiterH: 4,
  descentLossKms: 0.3,
  descentTimeS: 720,
  descentArcDeg: 16,
}

export type BurnId = 'ascent' | 'tli' | 'loi' | 'doi' | 'pdi'

export interface Burn {
  id: BurnId
  label: string // "Trans-lunar injection"
  short: string // "TLI"
  utcMs: number // ignition (ascent: liftoff)
  dvKms: number
  estimate: boolean // true when dvKms includes an assumed loss term (ascent, powered descent)
  propellantKg: number | null // rocket equation with the vehicle's engine; null for the ascent
  durationS: number | null // propellant flow at full thrust; null when the thrust is unknown
  massAfterKg: number | null
}

export type PhaseId = 'ascent' | 'parking' | 'transfer' | 'approach' | 'orbit' | 'descent'

export interface Phase {
  id: PhaseId
  label: string // "Coast to the Moon"
  startMs: number
  endMs: number
}

/** A sampled path: p[i] is the position at t[i]; t is strictly increasing. */
export interface Track {
  t: number[] // UTC ms
  p: Vec3[] // km, J2000 axes
}

export interface FlightPlan {
  pad: Launchpad
  vehicle: Vehicle
  target: LandingTarget
  options: PlanOptions
  ephem: FlightEphemeris

  /** 'n-body': the transfer is the integrated flight under Earth, Moon and Sun gravity, aimed by numerical
   *  shooting. 'patched-conic': the shooting did not converge and the two-conic first guess is shown instead. */
  model: 'n-body' | 'patched-conic'
  /** Position and velocity (Earth-centred J2000) right after the trans-lunar injection burn. */
  injection: { r: Vec3; v: Vec3 }

  launchMs: number
  tliMs: number
  soiMs: number // entry into the Moon's sphere of influence
  loiMs: number
  doiMs: number
  pdiMs: number
  landingMs: number

  launchAzimuthDeg: number // inertial azimuth at liftoff, 0 = north, 90 = east
  parkingInclDeg: number // parking orbit inclination to Earth's equator
  parkingCoastS: number
  transferDays: number // TLI → lunar orbit insertion
  moonDistKm: number // Earth–Moon distance at arrival
  moonDeclDeg: number // Moon's declination at arrival
  vInfKms: number // hyperbolic excess speed at the Moon
  lunarInclDeg: number // lunar orbit inclination to the Moon's equator
  loiterH: number // time in low lunar orbit
  lunarRevs: number // whole revolutions flown in low lunar orbit

  burns: Burn[] // ascent, tli, loi, doi, pdi, in this order
  dvInSpaceKms: number // TLI + LOI + DOI + PDI
  dvTotalKms: number // including the ascent estimate
  landedMassKg: number // mass on the surface: spacecraft dry mass plus payload

  phases: Phase[]
  /** Instant at which the path passes from the Earth-centred track to the Moon-centred one: the lunar orbit
   *  insertion for an integrated flight, the sphere-of-influence entry for the patched-conic fallback. */
  handoverMs: number
  /** Earth-centred path up to handoverMs: ascent, parking orbit, transfer (and, integrated, the lunar approach). */
  geo: Track
  /** Moon-centred path from handoverMs (J2000 axes, origin at the moving Moon): lunar orbit and descent. */
  seleno: Track
}

export interface FlightState {
  frame: 'earth' | 'moon' // which body pos is relative to
  pos: Vec3
  phase: PhaseId
}

export class FlightPlanError extends Error {}

// ---------------------------------------------------------------------------------------------------------
// Whole mission (mission.ts): launch, flight to the Moon, landing, surface stay, ascent, docking, flight home.
// Two craft are followed: the capsule (the crewed spacecraft; it carries the lander until undocking and again
// after docking) and the lander. Every phase is a leg with its own integrated path; every burn is an event with
// what it delivered and what it used.

export type CraftId = 'capsule' | 'lander'

export interface MissionLeg {
  id: string // 'ascent', 'parking', 'tli', 'translunar', 'loi', 'lunar-orbit', 'descent', 'surface', 'lunar-ascent', 'tei', 'transearth', ...
  label: string // phase name shown to the user
  craft: CraftId
  frame: 'earth' | 'moon' // track positions are relative to this body's centre, J2000 axes, km
  powered: boolean // an engine is firing along this leg
  track: Track
}

export interface MissionEvent {
  id: string
  short: string // 'TLI', 'LOI', 'PDI', 'TEI', 'EI', …
  label: string // official term: 'Trans-Lunar Injection (TLI)'
  utcMs: number
  craft: CraftId
  kind: 'burn' | 'event'
  by: string | null // the stage or engine that fires, official name
  dvKms: number | null // integrated thrust acceleration, losses included
  propellantKg: number | null
  durationS: number | null
  massAfterKg: number | null
}

/** Propellant a stage or module needs for this mission against what it can carry. */
export interface PropellantUse {
  element: string // official name
  usedKg: number
  capacityKg: number
}

export interface MissionFacts {
  launchAzimuthDeg: number
  parkingInclDeg: number
  parkingPerigeeKm: number
  parkingApogeeKm: number
  ascentLossKms: { gravity: number; drag: number; steering: number } | null
  transferDays: number // TLI ignition → LOI cut-off
  moonDistKm: number
  vInfKms: number
  lunarPeriluneKm: number
  lunarApoluneKm: number
  lunarInclDeg: number
  orbitBeforeLandingH: number // LOI cut-off → touchdown
  landingMissM: number | null // distance from the asked point at touchdown
  surfaceStayDays: number
  returnPlaneOffDeg: number // how far the lunar orbit's plane is from the way home at departure
  returnDays: number // TEI ignition → Entry Interface
  entry: { speedKms: number; fpaDeg: number; latDeg: number; lonDeg: number }
  missionDays: number // liftoff → Entry Interface
  /** Energy bookkeeping for comparison only (ideal.ts): a lower bound that no real mission can reach. */
  ideal?: IdealEnergy
  /** The surface stay the user asked for, days (surfaceStayDays above is the one flown). */
  surfaceStayAskedDays?: number
}

/** What the trip would take at 100 % efficiency against what the planned mission's engines put out (ideal.ts).
 *  Energies per kilogram are differences of E = ½v² − μ_Earth/r − μ_Moon/d in the Earth-centred, non-rotating
 *  frame (1 MJ/kg = 1 km²/s²). Bookkeeping between states, not a trajectory. */
export interface IdealEnergy {
  /** Launchpad at rest on the turning Earth (liftoff) → landing point at rest on the Moon (touchdown): gain of E. */
  outboundMjPerKg: number
  /** Landing point at rest on the Moon (lunar liftoff) → the saddle between Moon and Earth (the L1 point, at
   *  rest in the frame that turns with the Moon): gain of E. The only stretch of the way home that costs energy. */
  returnClimbMjPerKg: number
  /** Kinetic energy at Entry Interface of a body that falls from that saddle without an engine: E at the
   *  saddle minus the potential at Entry Interface. Released on the way down; it has to be shed. */
  returnReleasedMjPerKg: number
  /** What the planned mission's engines put into their exhaust: Σ ½ · propellant · (g0 · Isp)² over every burn. */
  missionJetEnergyMj: number
  /** The mass that makes the whole round trip: the capsule at Entry Interface, kg. */
  referenceMassKg: number
  missionMjPerKg: number // missionJetEnergyMj / referenceMassKg
  ratio: number // missionMjPerKg / (outboundMjPerKg + returnClimbMjPerKg)
}

export interface MissionPlan {
  pad: Launchpad
  target: LandingTarget
  ephem: FlightEphemeris
  architecture: { id: string; name: string; launchVehicle: string; capsule: string; lander: string }
  launchMs: number
  touchdownMs: number
  lunarLiftoffMs: number
  dockingMs: number
  endMs: number // Entry Interface
  legs: MissionLeg[] // capsule legs are contiguous from launchMs to endMs; lander legs run from undocking to docking
  events: MissionEvent[] // sorted by time
  propellant: PropellantUse[]
  facts: MissionFacts
  /** Things the reader has to know: propellant shortfalls, an expensive return geometry, assumptions that bite. */
  notes: string[]
  sources: SourceRef[]
}

/** Where a craft is at an instant. While the lander is docked it is where the capsule is. */
export interface CraftState {
  frame: 'earth' | 'moon'
  pos: Vec3
  legId: string
  label: string
  powered: boolean
  docked: boolean // lander only: riding with the capsule
}
