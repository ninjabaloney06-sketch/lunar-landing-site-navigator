// Flight planner contract: Earth launchpad → lunar landing site, patched conics with impulsive burns.
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
  /** Earth-centred path: ascent, parking orbit, transfer up to the Moon's sphere of influence. */
  geo: Track
  /** Moon-centred path (J2000 axes, origin at the moving Moon): approach, lunar orbit, descent. */
  seleno: Track
}

export interface FlightState {
  frame: 'earth' | 'moon' // which body pos is relative to
  pos: Vec3
  phase: PhaseId
}

export class FlightPlanError extends Error {}
