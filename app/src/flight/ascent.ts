// Launch to orbit: a staged rocket flown from the pad to orbit insertion by numerical integration (sim.ts).
// Nothing here knows a particular rocket: stages, boosters, jettisons and engine events are data (hardware.ts,
// launchVehicles.ts), and the steering is found per call.
//
// Physics, all in three dimensions in the Earth-centred inertial frame (km, km/s, kg, s from liftoff):
//  - gravity: Earth as a point mass plus J2 about the spin axis;
//  - the pad moves with the rotating Earth (v = ω × r at liftoff) and so does the air: drag acts along the
//    air-relative velocity v − ω × r;
//  - air density and pressure: U.S. Standard Atmosphere 1976 as a function of the altitude above the WGS 84
//    equatorial radius (the flattening is ignored: at 28.6° N the true sea-level radius is 4.9 km smaller);
//  - thrust and specific impulse between the sea-level and the vacuum values, linear in ambient pressure;
//  - drag = ½ ρ v² · Cd(Mach) · frontal area of the stages and boosters still attached;
//  - stagings, jettisons, engine cut-offs, throttle steps and steering changes are boundaries between
//    integrator runs, located exactly by time or by an event function.
//
// Steering, in flight order:
//  1. vertical rise until the vehicle has climbed the tower clearance;
//  2. pitch-over: the thrust axis tilts at PITCH_RATE toward the launch heading up to the kick angle and is
//     held there until the air-relative velocity has turned onto it;
//  3. gravity turn: thrust along the air-relative velocity (zero angle of attack) through the rise of the
//     dynamic pressure, until it is past its maximum and the boosters are gone;
//  4. closed-loop guidance: thrust along the primer vector p, the optimal steering of which linear tangent
//     steering (tan pitch linear in time) is the uniform-gravity case; p is solved so that the predicted path
//     through all remaining burn phases ends in the target plane at the target radius, speed and flight-path
//     angle, and is re-solved from the flown state every guidance cycle. Pitch and yaw come from the same
//     vector. While there is air, the command is held within the angle of attack that QALPHA_MAX allows, so
//     the gravity turn passes into the vacuum steering gradually. The burning stage is cut off when the
//     orbital energy reaches that of the target orbit.
// The free parameters (kick angle, start of the pitch-over, and for an elliptical target the true anomaly of
// the insertion point) are optimised per call for the largest mass at insertion: a coarse grid, then a downhill
// simplex. A last fixed-point iteration on the guidance's aim point brings perigee and apogee onto the target.
//
// Not modelled: winds, lift, the thrust build-up and decay of an engine start and cut-off (each stage is at
// full thrust from its ignition to its cut-off), heating along the path, and any limit on the dynamic pressure
// itself.
import { G0, MU_EARTH, OMEGA_EARTH, R_EARTH_EQ } from './astro'
import type { LaunchVehicleSpec } from './hardware'
import { J2_EARTH, integrate } from './sim'
import type { Engine, Field, SimState } from './sim'
import type { SourceRef, Vec3 } from './types'
import { DEG, angleAbout, cross, dot, norm, rotateAbout, scale, unit } from './vec'

// ---------------------------------------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------------------------------------

export interface AscentTarget {
  planeNormal: Vec3 // unit normal of the target orbit plane, Earth-centred inertial (ECI), prograde
  perigeeKm: number // altitudes above R_EARTH_EQ of the orbit to insert into
  apogeeKm: number // equal to perigeeKm for a circular parking orbit
}

/** Something that happens to the engines of one stage at a fixed time after its ignition. */
export interface EngineEvent {
  stage: number // index in LaunchVehicleSpec.stages
  afterIgnitionS: number
  id: string
  label: string // official wording: "S-IC centre engine cut-off (CECO)"
  enginesRunning?: number // engines still firing from this instant
  throttle?: number // commanded thrust as a fraction of full thrust from this instant
  thrustVacN?: number // per engine: a new operating point (a mixture-ratio shift)
  ispVacS?: number
}

/** What the ascent needs beyond the hardware contract. Every field is optional: a vehicle described by a bare
 *  LaunchVehicleSpec flies with full thrust throughout, no acceleration limit and no coast between stages. */
export interface AscentProfile {
  /** Height the vehicle climbs straight up before it may pitch over. Default: 1.5 × the summed stage lengths. */
  towerClearanceM?: number
  /** Thrust acceleration (g) that throttleable engines (throttleMin < 1) are throttled back to hold. */
  maxAxialG?: number
  /** [i]: seconds between the cut-off of stage i and full thrust of stage i + 1. Default 0. */
  separationCoastS?: number[]
  engineEvents?: EngineEvent[]
  /** Booster vacuum-thrust shape: [seconds after liftoff, relative thrust] knots, linear in between. The
   *  simulator scales it so that the boosters use exactly their propellant; the last knot is the burn-out.
   *  Default: constant thrust for burnTimeS. */
  boosterThrustProfile?: [number, number][]
  /** Seconds after liftoff at which the boosters are dropped. Default: at burn-out. */
  boosterSeparationS?: number
  /** Official name of each stage's cut-off ("Main Engine Cutoff (MECO)"); default "<stage name> cut-off". */
  cutoffLabels?: (string | null)[]
  sources: SourceRef[]
}

/** A launch vehicle, optionally with its ascent profile. Any LaunchVehicleSpec is one. */
export type AscentVehicle = LaunchVehicleSpec & { ascent?: AscentProfile }

export interface AscentInput {
  vehicle: AscentVehicle
  payloadKg: number // everything carried above the last launch-vehicle stage (spacecraft, lander, adapters that stay with them)
  padEci: Vec3 // unit vector Earth centre → launchpad at liftoff, ECI
  pole: Vec3 // Earth's spin axis, unit, ECI
  target: AscentTarget
}

export interface AscentEvent {
  tS: number
  id: string
  label: string
}

export interface AscentResult {
  t: number[] // samples from liftoff to insertion, seconds
  r: Vec3[] // ECI km
  v: Vec3[] // ECI km/s
  m: number[] // kg
  thrusting: boolean[] // engines on in the interval that starts at this sample
  events: AscentEvent[]
  /** State at the cut-off that puts the vehicle on the target orbit. massKg is everything still attached at
   *  that instant, including the stage that made the insertion. Perigee and apogee are those of the osculating
   *  two-body orbit, altitudes above R_EARTH_EQ. */
  insertion: { tS: number; r: Vec3; v: Vec3; massKg: number; perigeeKm: number; apogeeKm: number; planeErrorDeg: number }
  /** Usable propellant still in the last stage at insertion (it goes on to do the trans-lunar injection). */
  upperStagePropellantKg: number
  /** Mass of the last stage without that propellant, plus upperStageExtrasKg (what the payload drags through TLI). */
  upperStageDryKg: number
  /** Velocity budget, integrated along the flown path in the Earth-fixed (air-relative) frame:
   *  speed at insertion (inertial) = idealDv − gravityLoss − dragLoss − steeringLoss + earthRotationGain.
   *  idealDv = ∫ thrust/mass dt; gravity loss = ∫ of the pull (with the centrifugal term) against the direction
   *  of flight; steering loss = ∫ of the thrust not pointing along the flight direction; the rotation gain is
   *  inertial minus air-relative speed at insertion. */
  budget: { idealDvKms: number; gravityLossKms: number; dragLossKms: number; steeringLossKms: number; earthRotationGainKms: number }
  downrangeAngleRad: number // angle from the pad direction at liftoff to the insertion point, about the plane normal
  /** Index (LaunchVehicleSpec.stages) of the stage that was burning at insertion. */
  insertionStage: number
  maxQ: { tS: number; pa: number; altKm: number }
  /** Largest thrust acceleration reached, in g. */
  maxAxialG: number
  /** The optimised steering: kick angle, pitch-over start, true anomaly of the insertion point. */
  steering: { kickDeg: number; pitchOverStartS: number; insertionTrueAnomalyDeg: number }
}

/** Thrown when the vehicle cannot reach the target with this payload. */
export class AscentError extends Error {}

// ---------------------------------------------------------------------------------------------------------
// Model constants that are not properties of a vehicle. Each is an assumption of this simulator.
// ---------------------------------------------------------------------------------------------------------

/** Rate at which the thrust axis tilts during the pitch-over. Assumption: 1°/s, the order of the attitude
 *  rates large launch vehicles fly in the first minute; the optimiser sets how far and when, not how fast. */
const PITCH_RATE = 1 * DEG
/** Guidance cycle: the steering is checked against the flown state this often, in the air (where drag and the
 *  q·α limit push the vehicle off the predicted path) and above it. */
const GUIDANCE_CYCLE_AIR_S = 5
const GUIDANCE_CYCLE_S = 20
/** Time-to-go below which the steering is no longer re-solved: the position at cut-off stops responding to the
 *  steering as the time-to-go goes to zero and the equations degenerate (flight software likewise stops
 *  steering for position in the last tens of seconds). What the last solution misses of the aim point is
 *  removed by the aim iteration at the end of simulateAscent. */
const TGO_FREEZE_S = 15
/** Free-molecular heating rate ½ ρ v³ allowed at an insertion point on an elliptical orbit whose perigee lies
 *  in the atmosphere. Assumption: 1135 W/m², the limit at which launch vehicles expose their payload (SpaceX,
 *  Falcon User's Guide: "The payload fairing will nominally be deployed when free molecular aero-thermal heating
 *  is less than 1,135 W/m²", https://spacex.relayto.com/e/spacex-falcon-user-s-guide-oc92qkoxzo1jf/ICRgCqyH38).
 *  Without it the best insertion point would lie absurdly low, because the model has drag but no heating. It is
 *  applied at the insertion point only, not along the path. */
const FMH_LIMIT_W_M2 = 1135
/** Convergence demanded of the insertion, and the tighter value the aim iteration works to. */
const TOL_ALT_KM = 1
const TOL_PLANE_DEG = 0.01
const AIM_ALT_KM = 0.1
/** Orbits rounder than this are treated as circular: the insertion point is then the perigee. */
const ECC_CIRCULAR = 0.002
const T_MAX_S = 3600
/** Range of the kick angle searched. */
const KICK_MIN = 0.005 * DEG
const KICK_MAX = 30 * DEG
/** Largest product of dynamic pressure and angle of attack, Pa·rad. Flying at an angle to the airflow bends
 *  the vehicle with a load that grows with q·α; this one limit governs both places where the thrust axis leaves
 *  the air-relative velocity: the pitch-over (kick angle × dynamic pressure at its end) and the closed-loop
 *  guidance after maximum dynamic pressure (its command is held within α = QALPHA_MAX / q of the airflow, so it
 *  takes over gradually as the air thins: under 1° at 30 kPa, 29° at 1 kPa, free above the atmosphere).
 *  Assumption: 500 Pa·rad (29 kPa·deg, 600 lb/ft²·deg), half of what Apollo 11 met from winds at maximum dynamic
 *  pressure (1.6° at 35 kPa, flight evaluation report). Without a limit the best steering is a hard, late
 *  pitch-over that no structure survives. */
const QALPHA_MAX = 500

// ---------------------------------------------------------------------------------------------------------
// U.S. Standard Atmosphere 1976
// ---------------------------------------------------------------------------------------------------------
// Below 86 km: seven layers of constant temperature gradient in geopotential altitude H = r0·z / (r0 + z);
// hydrostatic pressure, ideal gas. Layer bases and gradients as tabulated for the 1976 standard
// (https://en.wikipedia.org/wiki/U.S._Standard_Atmosphere, table "1976": heights 0, 11 000, 20 000, 32 000,
// 47 000, 51 000, 71 000, 84 852 m; base 288.15 K, 101 325 Pa; lapse rates −0.0065, 0, 0.001, 0.0028, 0,
// −0.0028, −0.002 K/m); constants of the standard: R* = 8.31432 J/(mol·K), M = 28.9644 g/mol, g0 = 9.80665 m/s²,
// r0 = 6356.766 km (NOAA/NASA/USAF, U.S. Standard Atmosphere, 1976, https://ntrs.nasa.gov/citations/19770009539).
const ATM_R0 = 6356.766
const ATM_GMR = ((9.80665 * 0.0289644) / 8.31432) * 1000 // K per km of geopotential altitude
const ATM_RS = 8.31432 / 0.0289644 // J/(kg·K)
const P0 = 101325
const LAYER_H = [0, 11, 20, 32, 47, 51, 71, 84.852]
const LAYER_L = [-6.5, 0, 1, 2.8, 0, -2.8, -2]
const LAYER_T = [288.15]
const LAYER_P = [P0]
for (let i = 0; i < 7; i++) {
  const dh = LAYER_H[i + 1] - LAYER_H[i]
  const t1 = LAYER_T[i] + LAYER_L[i] * dh
  LAYER_T.push(t1)
  LAYER_P.push(LAYER_L[i] === 0 ? LAYER_P[i] * Math.exp((-ATM_GMR * dh) / LAYER_T[i]) : LAYER_P[i] * Math.pow(LAYER_T[i] / t1, ATM_GMR / LAYER_L[i]))
}
// Above 86 km the standard is no longer a closed formula. The tail used here is exponential between the
// standard's tabulated values (log-linear interpolation of pressure and density; beyond 500 km the last scale
// height continues). [geometric altitude km, pressure Pa, density kg/m³] from the 1976 standard's Table 1 as
// reproduced at https://www.pdas.com/bigtables.html ("Temperature, Pressure, & Density (SI units) 0 to 1000 Km").
// The first knot (86 km) is the layer model's own value, so the two parts join without a step.
const TAIL: [number, number, number][] = [
  [90, 1.8435e-1, 3.44e-6],
  [100, 3.2012e-2, 5.6044e-7],
  [110, 7.1493e-3, 9.6734e-8],
  [120, 2.5366e-3, 2.2199e-8],
  [130, 1.2503e-3, 8.1494e-9],
  [140, 7.2029e-4, 3.8313e-9],
  [150, 4.5422e-4, 2.0752e-9],
  [160, 3.0394e-4, 1.2336e-9],
  [180, 1.5272e-4, 5.194e-10],
  [200, 8.4736e-5, 2.5407e-10],
  [250, 2.4762e-5, 6.0706e-11],
  [300, 8.7704e-6, 1.9159e-11],
  [400, 1.4518e-6, 2.8028e-12],
  [500, 3.0235e-7, 5.2148e-13],
]

export interface Air {
  rho: number // kg/m³
  p: number // Pa
  a: number // speed of sound, m/s
}

function layerAir(zKm: number, out: Air) {
  const h = (ATM_R0 * zKm) / (ATM_R0 + zKm)
  let i = 6
  while (i > 0 && h < LAYER_H[i]) i--
  const dh = h - LAYER_H[i]
  const temp = LAYER_T[i] + LAYER_L[i] * dh
  out.p = LAYER_L[i] === 0 ? LAYER_P[i] * Math.exp((-ATM_GMR * dh) / LAYER_T[i]) : LAYER_P[i] * Math.pow(LAYER_T[i] / temp, ATM_GMR / LAYER_L[i])
  out.rho = out.p / (ATM_RS * temp)
  out.a = Math.sqrt(1.4 * ATM_RS * temp)
}

const AIR86: Air = { rho: 0, p: 0, a: 0 }
layerAir(86, AIR86)
const TAIL_Z = [86, ...TAIL.map((k) => k[0])]
const TAIL_LNP = [Math.log(AIR86.p), ...TAIL.map((k) => Math.log(k[1]))]
const TAIL_LNRHO = [Math.log(AIR86.rho), ...TAIL.map((k) => Math.log(k[2]))]

/** U.S. Standard Atmosphere 1976 at a geometric altitude (km) into out. Above 86 km the speed of sound is held
 *  at its 86 km value: it only feeds the Mach number of a drag that is by then a millionth of the thrust. */
export function standardAtmosphere(altKm: number, out: Air): Air {
  if (altKm < 86) {
    layerAir(Math.max(altKm, -5), out)
    return out
  }
  const last = TAIL_Z.length - 1
  let i = 0
  while (i < last - 1 && altKm >= TAIL_Z[i + 1]) i++
  const f = (altKm - TAIL_Z[i]) / (TAIL_Z[i + 1] - TAIL_Z[i]) // > 1 beyond the table: the last scale height continues
  out.p = Math.exp(TAIL_LNP[i] + (TAIL_LNP[i + 1] - TAIL_LNP[i]) * f)
  out.rho = Math.exp(TAIL_LNRHO[i] + (TAIL_LNRHO[i + 1] - TAIL_LNRHO[i]) * f)
  out.a = AIR86.a
  return out
}

// ---------------------------------------------------------------------------------------------------------
// Drag coefficient
// ---------------------------------------------------------------------------------------------------------
// ASSUMPTION (no vehicle's own curve is used): drag coefficient against Mach number of a slender launch vehicle
// at zero angle of attack, referred to its frontal area. The shape is the one every published curve shares
// (flat subsonic value, steep transonic rise to a peak just above Mach 1, slow supersonic decay; for example
// the V-2 curve in Sutton & Biblarz, Rocket Propulsion Elements, section 4.2) at the level usually quoted for
// large multi-body launchers, 0.3 subsonic and 0.5–0.55 at the peak. Neither NASA's Saturn V flight evaluation
// report nor the SLS aerodynamic papers publish their coefficients. Drag costs these vehicles 30–50 m/s of
// about 9300, so an error of a quarter in this curve moves the result by about 0.1%.
const CD_MACH = [0, 0.5, 0.8, 0.95, 1.05, 1.2, 1.5, 2, 3, 4, 5, 8]
const CD_VAL = [0.3, 0.28, 0.31, 0.42, 0.52, 0.55, 0.5, 0.42, 0.33, 0.29, 0.27, 0.25]
// Monotone cubic interpolation (Fritsch–Carlson slopes): smooth for the integrator, no overshoot between knots.
const CD_SLOPE = (() => {
  const n = CD_MACH.length
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) d.push((CD_VAL[i + 1] - CD_VAL[i]) / (CD_MACH[i + 1] - CD_MACH[i]))
  const s = new Array<number>(n).fill(0)
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] > 0) {
      const w1 = 2 * (CD_MACH[i + 1] - CD_MACH[i]) + (CD_MACH[i] - CD_MACH[i - 1])
      const w2 = CD_MACH[i + 1] - CD_MACH[i] + 2 * (CD_MACH[i] - CD_MACH[i - 1])
      s[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])
    }
  }
  return s
})()

export function dragCoefficient(mach: number): number {
  const n = CD_MACH.length
  if (mach <= 0) return CD_VAL[0]
  if (mach >= CD_MACH[n - 1]) return CD_VAL[n - 1]
  let i = 0
  while (mach >= CD_MACH[i + 1]) i++
  const h = CD_MACH[i + 1] - CD_MACH[i]
  const u = (mach - CD_MACH[i]) / h
  const u2 = u * u
  const u3 = u2 * u
  return (
    (2 * u3 - 3 * u2 + 1) * CD_VAL[i] + (u3 - 2 * u2 + u) * h * CD_SLOPE[i] + (-2 * u3 + 3 * u2) * CD_VAL[i + 1] + (u3 - u2) * h * CD_SLOPE[i + 1]
  )
}

// ---------------------------------------------------------------------------------------------------------
// Gravity
// ---------------------------------------------------------------------------------------------------------

/** Earth as a point mass plus J2 about the unit vector pole. The Moon and the Sun change the ten minutes of an
 *  ascent by a few metres and are left out. */
export function earthJ2Field(pole: Vec3): Field {
  return {
    centre: 'earth',
    accel(r, _utcMs, out) {
      const r2 = r[0] * r[0] + r[1] * r[1] + r[2] * r[2]
      const r1 = Math.sqrt(r2)
      const k = -MU_EARTH / (r2 * r1)
      // a_J2 = −(3/2) J2 μ R² / r⁵ · [ r (1 − 5 s²) + 2 s r p ],  s = (r·p)/r
      const s = (r[0] * pole[0] + r[1] * pole[1] + r[2] * pole[2]) / r1
      const c = (-1.5 * J2_EARTH * MU_EARTH * R_EARTH_EQ * R_EARTH_EQ) / (r2 * r2 * r1)
      const q = 1 - 5 * s * s
      out[0] = k * r[0] + c * (r[0] * q + 2 * s * r1 * pole[0])
      out[1] = k * r[1] + c * (r[1] * q + 2 * s * r1 * pole[1])
      out[2] = k * r[2] + c * (r[2] * q + 2 * s * r1 * pole[2])
    },
  }
}

// ---------------------------------------------------------------------------------------------------------
// The vehicle as a sequence of discrete states
// ---------------------------------------------------------------------------------------------------------

interface Timed {
  tS: number
  kind: 'ignite' | 'engine' | 'jettison' | 'knot' | 'booster-sep'
  i: number // index of the engine event or jettison
}

/** Which stage burns with how many engines at which setting, what is still attached, and what happens next at
 *  a known time. The integrator advances position, velocity and mass; this advances everything else. */
interface Seq {
  stage: number // the stage that is burning, or the next one to ignite
  burning: boolean
  done: boolean // the last stage has run dry
  prop: number // usable propellant left in `stage`, kg
  engines: number
  thrustVacN: number // per engine
  lossSlN: number // per engine: vacuum minus sea-level thrust (the ambient pressure on the nozzle exit)
  ispVacS: number
  ispSlS: number
  throttleCmd: number
  throttleMin: number
  boosters: boolean // still attached
  timed: Timed[] // sorted by time
}

interface Ctx {
  veh: AscentVehicle
  prof: AscentProfile | undefined
  payloadKg: number
  pad: Vec3
  pole: Vec3
  omega: Vec3
  n: Vec3 // target plane normal
  field: Field
  liftoffKg: number
  aLim: number // thrust acceleration limit, m/s² (0 = none)
  towerKm: number
  coreAreaM2: number[] // frontal area of stages k… (the widest of them)
  boosterAreaM2: number
  // boosters: propellant flow (kg/s, all boosters together) at the profile knots
  bT: number[]
  bF: number[]
  bCum: number[]
  bIspVac: number
  bIspSl: number
  // target orbit
  rp: number
  ra: number
  sma: number
  ecc: number
  energy: number
  vHead: number // orbital speed used to turn the inertial heading into an Earth-fixed one
  /** The first guidance solution of the last flight (components up, forward, plane normal): a head start for the next. */
  guess: { p: Vec3; pd: Vec3; tf: number } | null
}

const lastStage = (c: Ctx) => c.veh.stages.length - 1

function insertTimed(seq: Seq, ev: Timed) {
  let i = seq.timed.length
  while (i > 0 && seq.timed[i - 1].tS > ev.tS) i--
  seq.timed.splice(i, 0, ev)
}

function seqInit(c: Ctx): Seq {
  const seq: Seq = {
    stage: 0,
    burning: false,
    done: false,
    prop: 0,
    engines: 0,
    thrustVacN: 0,
    lossSlN: 0,
    ispVacS: 1,
    ispSlS: 1,
    throttleCmd: 1,
    throttleMin: 1,
    boosters: c.veh.boosters !== null,
    timed: [{ tS: 0, kind: 'ignite', i: 0 }],
  }
  if (c.veh.boosters) {
    for (let i = 1; i < c.bT.length; i++) insertTimed(seq, { tS: c.bT[i], kind: 'knot', i })
    const burnOut = c.bT[c.bT.length - 1]
    insertTimed(seq, { tS: Math.max(burnOut, c.prof?.boosterSeparationS ?? burnOut), kind: 'booster-sep', i: 0 })
  }
  return seq
}

const cloneSeq = (s: Seq): Seq => ({ ...s, timed: s.timed.slice() })

/** Propellant (kg) the boosters have burnt by time t: the integral of the piecewise-linear flow. */
function boosterBurnt(c: Ctx, t: number): number {
  const last = c.bT.length - 1
  if (last < 1 || t <= 0) return 0
  if (t >= c.bT[last]) return c.bCum[last]
  let i = 0
  while (t >= c.bT[i + 1]) i++
  const dt = t - c.bT[i]
  const slope = (c.bF[i + 1] - c.bF[i]) / (c.bT[i + 1] - c.bT[i])
  return c.bCum[i] + c.bF[i] * dt + 0.5 * slope * dt * dt
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Applies one timed event; returns the mass (kg) that leaves the vehicle. */
function seqApply(c: Ctx, seq: Seq, ev: Timed, log: AscentEvent[] | null): number {
  const veh = c.veh
  switch (ev.kind) {
    case 'ignite': {
      const st = veh.stages[seq.stage]
      const e = st.engine!
      seq.burning = true
      seq.prop = st.propellantKg
      seq.engines = e.count
      seq.thrustVacN = e.thrustVacN
      seq.lossSlN = e.thrustSlN === null ? 0 : e.thrustVacN - e.thrustSlN
      seq.ispVacS = e.ispVacS
      seq.ispSlS = e.ispSlS ?? e.ispVacS
      seq.throttleCmd = 1
      seq.throttleMin = e.throttleMin
      const evs = c.prof?.engineEvents ?? []
      for (let i = 0; i < evs.length; i++) if (evs[i].stage === seq.stage) insertTimed(seq, { tS: ev.tS + evs[i].afterIgnitionS, kind: 'engine', i })
      for (let i = 0; i < veh.jettisons.length; i++) {
        if (veh.jettisons[i].afterStage === seq.stage) insertTimed(seq, { tS: ev.tS + veh.jettisons[i].delayS, kind: 'jettison', i })
      }
      if (seq.stage > 0) log?.push({ tS: ev.tS, id: `ignition-${st.id}`, label: `${st.name} ignition` })
      return 0
    }
    case 'engine': {
      const e = c.prof!.engineEvents![ev.i]
      if (!seq.burning || e.stage !== seq.stage) return 0
      if (e.enginesRunning !== undefined) seq.engines = e.enginesRunning
      if (e.throttle !== undefined) seq.throttleCmd = e.throttle
      if (e.thrustVacN !== undefined) seq.thrustVacN = e.thrustVacN
      if (e.ispVacS !== undefined) {
        seq.ispSlS *= e.ispVacS / seq.ispVacS
        seq.ispVacS = e.ispVacS
      }
      log?.push({ tS: ev.tS, id: e.id, label: e.label })
      return 0
    }
    case 'jettison': {
      const j = veh.jettisons[ev.i]
      log?.push({ tS: ev.tS, id: `jettison-${slug(j.name)}`, label: `${j.name} jettison` })
      return j.massKg
    }
    case 'booster-sep': {
      const b = veh.boosters!
      seq.boosters = false
      log?.push({ tS: ev.tS, id: 'booster-separation', label: `${b.name} separation` })
      return b.count * (b.dryKg + b.propellantKg) - boosterBurnt(c, ev.tS)
    }
    case 'knot':
      return 0
  }
}

/** The burning stage has run dry at tS: it is dropped and the next one is set to ignite after the coast gap.
 *  Returns the mass that leaves. */
function seqDepleted(c: Ctx, seq: Seq, tS: number, log: AscentEvent[] | null): number {
  const st = c.veh.stages[seq.stage]
  const drop = st.dryKg + Math.max(seq.prop, 0)
  seq.prop = 0
  seq.burning = false
  seq.timed = seq.timed.filter((e) => e.kind !== 'engine')
  log?.push({ tS, id: `cutoff-${st.id}`, label: cutoffLabel(c, seq.stage) })
  if (seq.stage === lastStage(c)) {
    seq.done = true
    return 0 // nothing left to fly on: the stage stays, the ascent has failed
  }
  const next = c.veh.stages[seq.stage + 1]
  log?.push({ tS, id: `separation-${st.id}`, label: `${st.name} / ${next.name} separation` })
  const gap = c.prof?.separationCoastS?.[seq.stage] ?? 0
  seq.stage++
  insertTimed(seq, { tS: tS + gap, kind: 'ignite', i: 0 })
  return drop
}

const cutoffLabel = (c: Ctx, stage: number) => c.prof?.cutoffLabels?.[stage] ?? `${c.veh.stages[stage].name} cut-off`

// ---------------------------------------------------------------------------------------------------------
// Guidance above the dense air: optimal steering by the primer vector
// ---------------------------------------------------------------------------------------------------------
// The thrust direction that reaches a given orbit with the least propellant is u = p / |p|, where the primer
// vector p obeys p̈ = G(r) p with G the gradient of gravity (Lawden). Where gravity is uniform, G = 0 and p is
// linear in time: that special case is the linear tangent steering law, tan(pitch) = a + b·t, on which the
// Saturn V's iterative guidance mode and the Space Shuttle's powered explicit guidance are built, both with
// closed-form thrust integrals. Those closed forms assume a short burn arc; with an upper stage that pushes at
// a quarter of a g for a quarter of an orbit (SLS Block 1B) they no longer converge, so the same law is solved
// here without that assumption: the gradient term is kept, and the path to cut-off is predicted by integrating
// r, v, p and ṗ through all remaining burn phases (classical Runge–Kutta, two-body gravity, vacuum thrust).
//
// Unknowns: the direction of p now (2), ṗ now (3), the time to go (1). Conditions (6): at cut-off the radius,
// speed and flight-path angle of the insertion point and position and velocity in the target plane (the yaw
// steering comes from the same vector p); and transversality for the one thing left free, where along the
// orbit the insertion happens: n·(r × ṗ + p × v) = 0, a constant of the motion, so it is imposed at the start.
// Newton's method with a difference-quotient Jacobian and step halving solves them. The solution is re-solved
// from the flown state every guidance cycle (closed loop: J2, drag and the q·α limit are not in the
// prediction) and flown in between by interpolating p along the predicted path.

const THRUST = 0
const ACCEL = 1
const COAST = 2

interface Phase {
  kind: 0 | 1 | 2
  dt: number // longest this phase can last, s
  a0: number // thrust: acceleration at its start; accel: the held acceleration; km/s²
  ve: number // exhaust velocity, km/s
}

/** The remaining burn phases from (tS, massKg), in vacuum, by the same rules the flight uses: scheduled engine
 *  events and jettisons, depletion and staging with coast gaps, throttling on the acceleration limit. */
function planPhases(c: Ctx, seq0: Seq, tS: number, massKg: number): Phase[] {
  const q = cloneSeq(seq0)
  const out: Phase[] = []
  let t = tS
  let m = massKg
  for (let guard = 0; guard < 100; guard++) {
    while (q.timed.length && q.timed[0].tS <= t + 1e-9) m -= seqApply(c, q, q.timed.shift()!, null)
    if (q.done) break
    const tNext = q.timed.length ? q.timed[0].tS : Infinity
    if (!q.burning) {
      if (!Number.isFinite(tNext)) break
      out.push({ kind: COAST, dt: tNext - t, a0: 0, ve: 0 })
      t = tNext
      continue
    }
    if (q.prop <= 1e-6) {
      m -= seqDepleted(c, q, t, null)
      continue
    }
    const ve = G0 * q.ispVacS // m/s
    const fullVac = q.engines * q.thrustVacN
    let thrust = q.throttleCmd * fullVac
    let mode: 0 | 1 = THRUST
    let limited = false // already at or beyond the limit
    if (c.aLim > 0 && q.throttleMin < 1 && thrust / m >= c.aLim * (1 - 1e-12)) {
      limited = true
      if ((c.aLim * m) / fullVac > q.throttleMin * (1 + 1e-9)) mode = ACCEL
      else thrust = q.throttleMin * fullVac
    }
    let dt = tNext - t
    let dry = false
    if (mode === ACCEL) {
      // ṁ = −m a / ve: the mass decays exponentially while the acceleration is held
      const k = c.aLim / ve
      const dtDry = Math.log(m / (m - q.prop)) / k
      const dtMin = Math.log((m * c.aLim) / (q.throttleMin * fullVac)) / k // throttle reaches its floor
      if (dtDry <= dt) {
        dt = dtDry
        dry = true
      }
      if (dtMin < dt) {
        dt = dtMin
        dry = false
      }
      if (dt > 1e-9) out.push({ kind: ACCEL, dt, a0: c.aLim / 1000, ve: ve / 1000 })
      const m1 = m * Math.exp(-k * dt)
      q.prop -= m - m1
      m = m1
    } else {
      const flow = thrust / ve
      const dtDry = q.prop / flow
      if (dtDry <= dt) {
        dt = dtDry
        dry = true
      }
      if (!limited && c.aLim > 0 && q.throttleMin < 1) {
        const dtLim = (m - thrust / c.aLim) / flow // the acceleration reaches the limit
        if (dtLim < dt) {
          dt = dtLim
          dry = false
        }
      }
      if (dt > 1e-9) out.push({ kind: THRUST, dt, a0: thrust / m / 1000, ve: ve / 1000 })
      q.prop -= flow * dt
      m -= flow * dt
    }
    t += dt
    if (dry) m -= seqDepleted(c, q, t, null)
  }
  return out
}

interface Aim {
  rd: number // radius of the insertion point, km
  vd: number // speed there, km/s
  gamma: number // flight-path angle there, rad
}

/** A guidance solution: the primer vector along the predicted path, sampled at the predictor's steps. */
interface Solution {
  tn: number[] // node times, s from liftoff
  pn: number[] // p at the nodes, three numbers each
  dn: number[] // ṗ at the nodes
  tf: number // predicted cut-off, s from liftoff
  ptr: number // segment used last: the next look-up starts there
}

interface Guess {
  p: Vec3 // unit
  pd: Vec3 // 1/s
  tf: number // time to go, s
}

const PREDICT_STEP_S = 15
// scratch for the predictor (one flight at a time: plain synchronous code)
const PY = new Float64Array(12)
const PT = new Float64Array(12)
const PK1 = new Float64Array(12)
const PK2 = new Float64Array(12)
const PK3 = new Float64Array(12)
const PK4 = new Float64Array(12)

/** d/dt of y = (r, v, p, ṗ) under two-body gravity and a thrust acceleration a (km/s²) along p. */
function primerDeriv(y: Float64Array, a: number, d: Float64Array) {
  const r2 = y[0] * y[0] + y[1] * y[1] + y[2] * y[2]
  const k = -MU_EARTH / (r2 * Math.sqrt(r2))
  const ap = a / Math.sqrt(y[6] * y[6] + y[7] * y[7] + y[8] * y[8])
  const rp = (3 * (y[0] * y[6] + y[1] * y[7] + y[2] * y[8])) / r2
  d[0] = y[3]
  d[1] = y[4]
  d[2] = y[5]
  d[3] = k * y[0] + ap * y[6]
  d[4] = k * y[1] + ap * y[7]
  d[5] = k * y[2] + ap * y[8]
  d[6] = y[9]
  d[7] = y[10]
  d[8] = y[11]
  // p̈ = G p = −μ/r³ · (p − 3 r̂ (r̂·p))
  d[9] = k * (y[6] - rp * y[0])
  d[10] = k * (y[7] - rp * y[1])
  d[11] = k * (y[8] - rp * y[2])
}

/** Thrust acceleration u seconds into a phase. A burn asked to run past its propellant keeps going on paper
 *  (to 98% of the mass), so that the solver stays smooth; the flight itself then runs dry. */
function phaseAccel(ph: Phase, u: number): number {
  if (ph.kind === COAST) return 0
  if (ph.kind === ACCEL) return ph.a0
  const tau = ph.ve / ph.a0
  return ph.ve / (tau - Math.min(u, 0.98 * tau))
}

/** Integrates y = (r, v, p, ṗ) in place through the phases for tf seconds; with sol, stores the primer at
 *  every step (node times offset by t0). Returns the lowest radius passed. */
function predict(y: Float64Array, tf: number, phases: Phase[], t0: number, sol: Solution | null): number {
  let t = 0
  let low2 = y[0] * y[0] + y[1] * y[1] + y[2] * y[2]
  const last = phases.length - 1
  const node = (tn: number) => {
    sol!.tn.push(tn)
    sol!.pn.push(y[6], y[7], y[8])
    sol!.dn.push(y[9], y[10], y[11])
  }
  for (let i = 0; i <= last && t < tf - 1e-9; i++) {
    const ph = phases[i]
    const span = i === last ? tf - t : Math.min(ph.dt, tf - t)
    if (!(span > 1e-9)) continue
    const n = Math.ceil(span / PREDICT_STEP_S)
    const h = span / n
    for (let k = 0; k < n; k++) {
      if (sol) node(t0 + t + k * h)
      const u = k * h
      const a2 = phaseAccel(ph, u + 0.5 * h)
      primerDeriv(y, phaseAccel(ph, u), PK1)
      for (let j = 0; j < 12; j++) PT[j] = y[j] + 0.5 * h * PK1[j]
      primerDeriv(PT, a2, PK2)
      for (let j = 0; j < 12; j++) PT[j] = y[j] + 0.5 * h * PK2[j]
      primerDeriv(PT, a2, PK3)
      for (let j = 0; j < 12; j++) PT[j] = y[j] + h * PK3[j]
      primerDeriv(PT, phaseAccel(ph, u + h), PK4)
      for (let j = 0; j < 12; j++) y[j] += (h / 6) * (PK1[j] + 2 * PK2[j] + 2 * PK3[j] + PK4[j])
      const r2 = y[0] * y[0] + y[1] * y[1] + y[2] * y[2]
      if (r2 < low2) low2 = r2
    }
    t += span
  }
  if (sol) node(t0 + t)
  return Math.sqrt(low2)
}

/** The six conditions (all scaled to order one) for a guess flown from (r0, v0) into out. */
function miss(r0: Vec3, v0: Vec3, g: Guess, phases: Phase[], aim: Aim, n: Vec3, out: number[]) {
  PY[0] = r0[0]
  PY[1] = r0[1]
  PY[2] = r0[2]
  PY[3] = v0[0]
  PY[4] = v0[1]
  PY[5] = v0[2]
  PY[6] = g.p[0]
  PY[7] = g.p[1]
  PY[8] = g.p[2]
  PY[9] = g.pd[0]
  PY[10] = g.pd[1]
  PY[11] = g.pd[2]
  predict(PY, g.tf, phases, 0, null)
  const rm = Math.sqrt(PY[0] * PY[0] + PY[1] * PY[1] + PY[2] * PY[2])
  out[0] = rm / aim.rd - 1
  out[1] = (PY[0] * n[0] + PY[1] * n[1] + PY[2] * n[2]) / aim.rd
  out[2] = (PY[3] * n[0] + PY[4] * n[1] + PY[5] * n[2]) / aim.vd
  // velocity along the local vertical and along the prograde horizontal n × r̂ (so that the orbit runs the right way round)
  const vUp = (PY[0] * PY[3] + PY[1] * PY[4] + PY[2] * PY[5]) / rm
  const vFwd =
    ((n[1] * PY[2] - n[2] * PY[1]) * PY[3] + (n[2] * PY[0] - n[0] * PY[2]) * PY[4] + (n[0] * PY[1] - n[1] * PY[0]) * PY[5]) / rm
  out[3] = vFwd / aim.vd - Math.cos(aim.gamma)
  out[4] = vUp / aim.vd - Math.sin(aim.gamma)
  const a = cross(r0, g.pd)
  const b = cross(g.p, v0)
  out[5] = ((a[0] + b[0]) * n[0] + (a[1] + b[1]) * n[1] + (a[2] + b[2]) * n[2]) / aim.vd
}

/** Solves a x = b for a 6 × 6 system by elimination with partial pivoting (a and b are overwritten). */
function solve6(a: number[][], b: number[]): number[] | null {
  const n = 6
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row][col]) > Math.abs(a[piv][col])) piv = row
    if (!(Math.abs(a[piv][col]) > 1e-13)) return null
    const ar = a[piv]
    a[piv] = a[col]
    a[col] = ar
    const br = b[piv]
    b[piv] = b[col]
    b[col] = br
    for (let row = col + 1; row < n; row++) {
      const f = a[row][col] / a[col][col]
      for (let k = col; k < n; k++) a[row][k] -= f * a[col][k]
      b[row] -= f * b[col]
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row]
    for (let k = row + 1; k < n; k++) sum -= a[row][k] * x[k]
    x[row] = sum / a[row][row]
  }
  return x
}

/** Newton iteration on a guess (changed in place). 0: no solution; 1: solved; 2: the guess itself already met
 *  the six conditions to within `holds` and was left alone. */
function shoot(r0: Vec3, v0: Vec3, g: Guess, phases: Phase[], aim: Aim, n: Vec3, maxIter: number, holds: number): 0 | 1 | 2 {
  const T = Math.max(100, g.tf) // time scale that makes ṗ and the time-to-go of order one
  const EPS = 1e-6
  let F = new Array<number>(6).fill(0)
  const Fk = new Array<number>(6).fill(0)
  const worst = (f: number[]) => Math.max(Math.abs(f[0]), Math.abs(f[1]), Math.abs(f[2]), Math.abs(f[3]), Math.abs(f[4]), Math.abs(f[5]))
  const sq = (f: number[]) => f[0] * f[0] + f[1] * f[1] + f[2] * f[2] + f[3] * f[3] + f[4] * f[4] + f[5] * f[5]
  // a guess moved by z = (two tilts of p in its tangent plane, ṗ·T, time-to-go / T), scaled by k
  const moved = (e1: Vec3, e2: Vec3, z: number[], k: number): Guess => ({
    p: unit([
      g.p[0] + k * (z[0] * e1[0] + z[1] * e2[0]),
      g.p[1] + k * (z[0] * e1[1] + z[1] * e2[1]),
      g.p[2] + k * (z[0] * e1[2] + z[1] * e2[2]),
    ]),
    pd: [g.pd[0] + (k * z[2]) / T, g.pd[1] + (k * z[3]) / T, g.pd[2] + (k * z[4]) / T],
    tf: Math.max(1, g.tf + k * z[5] * T),
  })
  miss(r0, v0, g, phases, aim, n, F)
  let f2 = sq(F)
  if (worst(F) < holds) return 2
  for (let it = 0; it < maxIter; it++) {
    if (!Number.isFinite(f2)) return 0
    if (worst(F) < 1e-9) return 1
    const e1 = unit(cross(Math.abs(dot(n, g.p)) < 0.9 ? n : r0, g.p))
    const e2 = cross(g.p, e1)
    const jac: number[][] = []
    for (let i = 0; i < 6; i++) jac.push(new Array<number>(6).fill(0))
    const z = [0, 0, 0, 0, 0, 0]
    for (let k = 0; k < 6; k++) {
      z[k] = EPS
      miss(r0, v0, moved(e1, e2, z, 1), phases, aim, n, Fk)
      z[k] = 0
      for (let i = 0; i < 6; i++) jac[i][k] = (Fk[i] - F[i]) / EPS
    }
    const dz = solve6(jac, F.map((f) => -f))
    if (!dz) return 0
    // no more than a moderate change per step, then halve until the miss shrinks
    let k = Math.min(1, 0.3 / Math.abs(dz[0]), 0.3 / Math.abs(dz[1]), 0.6 / Math.abs(dz[2]), 0.6 / Math.abs(dz[3]), 0.6 / Math.abs(dz[4]), 0.25 / Math.abs(dz[5]))
    let better = false
    for (let half = 0; half < 8; half++, k *= 0.5) {
      const cand = moved(e1, e2, dz, k)
      miss(r0, v0, cand, phases, aim, n, Fk)
      const c2 = sq(Fk)
      if (c2 < f2) {
        g.p = cand.p
        g.pd = cand.pd
        g.tf = cand.tf
        F = Fk.slice()
        f2 = c2
        better = true
        break
      }
    }
    if (!better) break
  }
  return worst(F) < 1e-7 ? 1 : 0
}

/** Hermite interpolation of the primer (and optionally its rate) of a solution at time t. */
function primerAt(sol: Solution, t: number, p: Vec3, pd: Vec3 | null) {
  const tn = sol.tn
  const lastSeg = tn.length - 2
  let i = Math.min(sol.ptr, lastSeg)
  while (i < lastSeg && t > tn[i + 1]) i++
  while (i > 0 && t < tn[i]) i--
  sol.ptr = i
  const h = tn[i + 1] - tn[i]
  const u = (t - tn[i]) / h
  const u2 = u * u
  const u3 = u2 * u
  const h00 = 2 * u3 - 3 * u2 + 1
  const h10 = (u3 - 2 * u2 + u) * h
  const h01 = -2 * u3 + 3 * u2
  const h11 = (u3 - u2) * h
  const a = 3 * i
  const b = a + 3
  for (let k = 0; k < 3; k++) p[k] = h00 * sol.pn[a + k] + h10 * sol.dn[a + k] + h01 * sol.pn[b + k] + h11 * sol.dn[b + k]
  if (pd) {
    const g00 = (6 * u2 - 6 * u) / h
    const g10 = 3 * u2 - 4 * u + 1
    const g01 = -g00
    const g11 = 3 * u2 - 2 * u
    for (let k = 0; k < 3; k++) pd[k] = g00 * sol.pn[a + k] + g10 * sol.dn[a + k] + g01 * sol.pn[b + k] + g11 * sol.dn[b + k]
  }
}

/** Seconds the phases need to deliver a velocity change dv (km/s); past their end at the last acceleration. */
function timeToGain(phases: Phase[], dv: number): number {
  let t = 0
  let left = dv
  let aEnd = 1e-3
  for (const ph of phases) {
    if (ph.kind === COAST) {
      t += ph.dt
      continue
    }
    if (ph.kind === THRUST) {
      const tau = ph.ve / ph.a0
      const full = ph.ve * Math.log(tau / (tau - ph.dt))
      if (full >= left) return t + tau * (1 - Math.exp(-left / ph.ve))
      left -= full
      aEnd = ph.ve / (tau - ph.dt)
    } else {
      if (ph.a0 * ph.dt >= left) return t + left / ph.a0
      left -= ph.a0 * ph.dt
      aEnd = ph.a0
    }
    t += ph.dt
  }
  return t + left / aEnd
}

/** First guesses when no solution exists yet. The thrust direction starts near the present flight direction
 *  (or pitched above it) and ends level at the insertion point; the time to go is what the phases need for
 *  the velocity difference plus the pull of gravity over the arc. */
function firstGuesses(c: Ctx, r0: Vec3, v0: Vec3, phases: Phase[], aim: Aim, flightDir: Vec3): Guess[] {
  const n = c.n
  const rm = norm(r0)
  const up = scale(r0, 1 / rm)
  const inPlane = unit([up[0] - dot(up, n) * n[0], up[1] - dot(up, n) * n[1], up[2] - dot(up, n) * n[2]])
  const fwd = cross(n, inPlane)
  const vh = Math.max(0, dot(v0, fwd))
  let tf = 300
  let vgo: Vec3 = [0, 0, 0]
  let level: Vec3 = fwd
  for (let i = 0; i < 20; i++) {
    const theta = 0.5 * (vh / rm + aim.vd / aim.rd) * tf // arc flown: mean of the angular rates now and in orbit
    const rEnd = rotateAbout(inPlane, n, theta)
    level = cross(n, rEnd)
    const rMid = rotateAbout(inPlane, n, theta / 2)
    // ∫ g dt over the arc, as a vector: g · tf · sin(θ/2)/(θ/2) toward the centre at mid-arc
    const pull = (MU_EARTH / (0.5 * (rm + aim.rd)) ** 2) * tf * (theta > 1e-6 ? Math.sin(theta / 2) / (theta / 2) : 1)
    const sg = aim.vd * Math.sin(aim.gamma)
    const cg = aim.vd * Math.cos(aim.gamma)
    vgo = [
      sg * rEnd[0] + cg * level[0] - v0[0] + pull * rMid[0],
      sg * rEnd[1] + cg * level[1] - v0[1] + pull * rMid[1],
      sg * rEnd[2] + cg * level[2] - v0[2] + pull * rMid[2],
    ]
    tf += 0.6 * (timeToGain(phases, 1.03 * norm(vgo)) - tf)
  }
  const out: Guess[] = []
  if (c.guess) {
    // what worked on the previous flight of this search, turned into the present local frame
    const q = c.guess
    out.push({
      p: unit([q.p[0] * up[0] + q.p[1] * fwd[0] + q.p[2] * n[0], q.p[0] * up[1] + q.p[1] * fwd[1] + q.p[2] * n[1], q.p[0] * up[2] + q.p[1] * fwd[2] + q.p[2] * n[2]]),
      pd: [q.pd[0] * up[0] + q.pd[1] * fwd[0] + q.pd[2] * n[0], q.pd[0] * up[1] + q.pd[1] * fwd[1] + q.pd[2] * n[1], q.pd[0] * up[2] + q.pd[1] * fwd[2] + q.pd[2] * n[2]],
      tf: q.tf,
    })
  }
  const add = (p0: Vec3, k: number) => {
    const p = unit(p0)
    const t = k * tf
    out.push({ p, pd: [(level[0] - p[0]) / t, (level[1] - p[1]) / t, (level[2] - p[2]) / t], tf: t })
  }
  const vg = unit(vgo)
  add(flightDir, 1)
  add(vg, 1)
  // pitched up, with more time: what a weak upper stage needs
  add([vg[0] + 0.8 * up[0], vg[1] + 0.8 * up[1], vg[2] + 0.8 * up[2]], 1.3)
  add([flightDir[0] + 1.5 * up[0], flightDir[1] + 1.5 * up[1], flightDir[2] + 1.5 * up[2]], 1.6)
  return out
}

/** Solves the guidance problem from (r0, v0) at time t. With a previous solution that is the starting point
 *  and null means "keep flying the previous one"; without, the first guesses are tried in turn. */
function guide(c: Ctx, r0: Vec3, v0: Vec3, t: number, phases: Phase[], aim: Aim, prev: Solution | null, flightDir: Vec3): Solution | null {
  let tries: Guess[]
  if (prev) {
    const p: Vec3 = [0, 0, 0]
    const pd: Vec3 = [0, 0, 0]
    primerAt(prev, t, p, pd)
    const pm = norm(p)
    tries = [{ p: scale(p, 1 / pm), pd: scale(pd, 1 / pm), tf: Math.max(1, prev.tf - t) }]
  } else {
    tries = firstGuesses(c, r0, v0, phases, aim, flightDir)
  }
  const rm = norm(r0)
  for (const g of tries) {
    // In flight the prediction is re-solved only once the flown state has drifted from it by more than about
    // 2 m and 2 mm/s at cut-off (3·10⁻⁷ of radius and speed); the aim iteration removes what is left.
    const done = shoot(r0, v0, g, phases, aim, c.n, prev ? 8 : 20, prev ? 3e-7 : 0)
    if (done === 0) continue
    if (done === 2) return prev
    const sol: Solution = { tn: [], pn: [], dn: [], tf: t + g.tf, ptr: 0 }
    PY.set([r0[0], r0[1], r0[2], v0[0], v0[1], v0[2], g.p[0], g.p[1], g.p[2], g.pd[0], g.pd[1], g.pd[2]])
    const low = predict(PY, g.tf, phases, t, sol)
    // a path that dips back toward the ground satisfies the equations but is not an ascent
    if (low < Math.min(rm - 2, R_EARTH_EQ + 80)) continue
    if (!prev) {
      const up = scale(r0, 1 / rm)
      const inPlane = unit([up[0] - dot(up, c.n) * c.n[0], up[1] - dot(up, c.n) * c.n[1], up[2] - dot(up, c.n) * c.n[2]])
      const fwd = cross(c.n, inPlane)
      c.guess = { p: [dot(g.p, up), dot(g.p, fwd), dot(g.p, c.n)], pd: [dot(g.pd, up), dot(g.pd, fwd), dot(g.pd, c.n)], tf: g.tf }
    }
    return sol
  }
  return null
}

// ---------------------------------------------------------------------------------------------------------
// One flight for given steering parameters
// ---------------------------------------------------------------------------------------------------------

interface Steering {
  kick: number // rad: angle from the vertical the thrust axis tilts to
  delayS: number // pitch-over start, seconds after tower clear
  nu: number // true anomaly of the insertion point on the target orbit, rad
  dr: number // corrections to the guidance aim point (the fixed-point iteration at the end), km
  dgamma: number // rad
}

interface FlightLog {
  t: number[]
  r: Vec3[]
  v: Vec3[]
  m: number[]
  thrusting: boolean[]
  events: AscentEvent[]
  ideal: number
  gravity: number
  drag: number
  steering: number
  maxQ: { tS: number; pa: number; altKm: number }
  mach1S: number
  maxG: number
}

interface Flight {
  ok: boolean
  why: string
  deficitKms: number // how much speed was missing when the flight failed
  tS: number
  s: SimState
  seq: Seq
  perigeeKm: number
  apogeeKm: number
  planeErrorDeg: number
  radiusErrKm: number // at cut-off, against the aim point
  gammaErr: number
  pitchStartS: number
  qAlpha: number // dynamic pressure × kick angle when the pitch-over ended, Pa·rad
  guess0: Ctx['guess'] // the first guidance solution of this flight
}

/** Radius, speed and flight-path angle on the target orbit at true anomaly nu. */
function aimPoint(c: Ctx, nu: number): Aim {
  const p = c.sma * (1 - c.ecc * c.ecc)
  const rd = p / (1 + c.ecc * Math.cos(nu))
  return { rd, vd: Math.sqrt(2 * (c.energy + MU_EARTH / rd)), gamma: Math.atan2(c.ecc * Math.sin(nu), 1 + c.ecc * Math.cos(nu)) }
}

function orbitOf(r: Vec3, v: Vec3) {
  const rm = norm(r)
  const energy = 0.5 * dot(v, v) - MU_EARTH / rm
  const h = cross(r, v)
  const sma = -MU_EARTH / (2 * energy)
  const ecc = Math.sqrt(Math.max(0, 1 - dot(h, h) / (MU_EARTH * sma)))
  return { energy, h, sma, ecc, rp: sma * (1 - ecc), ra: sma * (1 + ecc) }
}

function fly(c: Ctx, p: Steering, rec: FlightLog | null): Flight {
  const seq = seqInit(c)
  const log = rec ? rec.events : null
  const r0 = scale(c.pad, R_EARTH_EQ)
  let s: SimState = { r: r0, v: cross(c.omega, r0), m: c.liftoffKg }
  let t = 0
  type Mode = 'rise' | 'wait' | 'ramp' | 'hold' | 'turn' | 'guided'
  let mode = 'rise' as Mode
  let tModeEnd = Infinity
  let tRamp0 = 0
  let pitchStartS = 0
  let qBefore = 0
  let tNextCheck = 0
  // guidance
  const aim0 = aimPoint(c, p.nu)
  const rdAim = aim0.rd + p.dr
  const aim: Aim = { rd: rdAim, vd: Math.sqrt(2 * (c.energy + MU_EARTH / rdAim)), gamma: aim0.gamma + p.dgamma }
  let sol: Solution | null = null
  let tNextGuid = 0
  let misses = 0
  let limitLogged = false

  // --- forces, as functions of (absolute time, state), for the engine setting of the current run ---
  const air: Air = { rho: 0, p: 0, a: 0 }
  const [ox, oy, oz] = c.omega
  const [nx, ny, nz] = c.n
  let thrMode = 0 // 0 off, 1 commanded throttle, 2 throttling on the acceleration limit, 3 at the throttle floor
  let bSeg = -1 // segment of the booster profile this run lies in; −1 = boosters out
  let areaM2 = 0
  let tRun0 = 0
  let mRun0 = 0
  let thrustN = 0
  let flowKgS = 0
  let aCmd = 0 // thrust acceleration at the commanded throttle, m/s²
  let fNeed = 0 // throttle that would hold the acceleration limit
  const kickSin = Math.sin(p.kick)
  let qAlpha = 0 // dynamic pressure × angle of attack at the end of the pitch-over, Pa·rad
  let guess0: Ctx['guess'] = null
  const dir: Vec3 = [0, 0, 0]

  const thrust = (tAbs: number, st: SimState) => {
    const rm = Math.sqrt(st.r[0] * st.r[0] + st.r[1] * st.r[1] + st.r[2] * st.r[2])
    standardAtmosphere(rm - R_EARTH_EQ, air)
    const x = air.p / P0
    let tb = 0
    let fb = 0
    if (bSeg >= 0) {
      fb = c.bF[bSeg] + ((c.bF[bSeg + 1] - c.bF[bSeg]) * (tAbs - c.bT[bSeg])) / (c.bT[bSeg + 1] - c.bT[bSeg])
      tb = fb * G0 * (c.bIspVac - (c.bIspVac - c.bIspSl) * x)
    }
    let tc = 0
    let fc = 0
    if (thrMode) {
      // full throttle: thrust and specific impulse linear in ambient pressure; throttling scales the vacuum
      // thrust and the flow, the ambient pressure on the nozzle exit stays
      const fullVac = seq.engines * seq.thrustVacN
      const loss = seq.engines * seq.lossSlN * x
      const flowFull = (fullVac - loss) / (G0 * (seq.ispVacS - (seq.ispVacS - seq.ispSlS) * x))
      aCmd = (seq.throttleCmd * fullVac - loss + tb) / st.m
      fNeed = (c.aLim * st.m - tb + loss) / fullVac
      const f = thrMode === 1 ? seq.throttleCmd : thrMode === 2 ? fNeed : seq.throttleMin
      tc = Math.max(0, f * fullVac - loss)
      fc = f * flowFull
    }
    thrustN = tb + tc
    flowKgS = fb + fc
  }

  // Guidance command gdir = p / |p| from the current solution, its angle `alpha` to the air-relative velocity and the angle
  // `alphaMax` that the q·α limit allows at this state. `clip` (fixed for a run) says which of the two rules.
  const gdir: Vec3 = [0, 0, 0]
  let clip = false
  let clipWatch = false
  let alpha = 0
  let alphaMax = Infinity
  const attack = (tAbs: number, st: SimState) => {
    primerAt(sol!, tAbs, gdir, null)
    const dm = Math.sqrt(gdir[0] * gdir[0] + gdir[1] * gdir[1] + gdir[2] * gdir[2])
    gdir[0] /= dm
    gdir[1] /= dm
    gdir[2] /= dm
    if (!clipWatch) return
    airflow(st)
    alphaMax = QALPHA_MAX / qPa
    alpha = Math.acos(Math.min(1, Math.max(-1, (gdir[0] * rel[0] + gdir[1] * rel[1] + gdir[2] * rel[2]) / vRel)))
  }

  // Local vertical `up` and launch heading `head` (horizontal unit vector) at a state. The heading is the
  // direction in which the target plane runs here (n × r̂) at orbital speed, seen from the rotating Earth:
  // w = v_orbit − ω × r, projected onto the horizontal. This is the classical launch-azimuth correction for
  // Earth's rotation, re-evaluated along the path.
  const up: Vec3 = [0, 0, 0]
  const head: Vec3 = [0, 0, 0]
  const heading = (st: SimState) => {
    const [rx, ry, rz] = st.r
    const rm = Math.sqrt(rx * rx + ry * ry + rz * rz)
    const ux = rx / rm
    const uy = ry / rm
    const uz = rz / rm
    let wx = c.vHead * (ny * uz - nz * uy) - (oy * rz - oz * ry)
    let wy = c.vHead * (nz * ux - nx * uz) - (oz * rx - ox * rz)
    let wz = c.vHead * (nx * uy - ny * ux) - (ox * ry - oy * rx)
    const wr = wx * ux + wy * uy + wz * uz
    wx -= wr * ux
    wy -= wr * uy
    wz -= wr * uz
    const wm = Math.sqrt(wx * wx + wy * wy + wz * wz)
    up[0] = ux
    up[1] = uy
    up[2] = uz
    head[0] = wx / wm
    head[1] = wy / wm
    head[2] = wz / wm
  }

  /** Unit thrust direction into dir. */
  const steer = (tAbs: number, st: SimState) => {
    if (mode === 'guided') {
      attack(tAbs, st)
      if (!clip) {
        dir[0] = gdir[0]
        dir[1] = gdir[1]
        dir[2] = gdir[2]
        return
      }
      // the guidance asks for more angle of attack than q·α allows: turn from the air-relative velocity
      // toward the commanded direction by the allowed angle only
      const dv = gdir[0] * rel[0] + gdir[1] * rel[1] + gdir[2] * rel[2]
      const wx = gdir[0] - (dv * rel[0]) / (vRel * vRel)
      const wy = gdir[1] - (dv * rel[1]) / (vRel * vRel)
      const wz = gdir[2] - (dv * rel[2]) / (vRel * vRel)
      const wm = Math.sqrt(wx * wx + wy * wy + wz * wz)
      const ca = Math.cos(alphaMax) / vRel
      const sa = Math.sin(alphaMax) / wm
      dir[0] = ca * rel[0] + sa * wx
      dir[1] = ca * rel[1] + sa * wy
      dir[2] = ca * rel[2] + sa * wz
      return
    }
    heading(st)
    if (mode === 'turn') {
      // Gravity turn: along the air-relative velocity v − ω × r, taken in the vertical plane of the launch
      // heading. The part of the velocity across that plane (the sideways drift the Earth's rotation gives a
      // rising vehicle, a few cm/s) is left out, so the pitch angle of attack is exactly zero and the yaw
      // angle of attack stays below a hundredth of a degree; steering along the full vector instead would let
      // the turn amplify that drift into a heading error.
      const [rx, ry, rz] = st.r
      const vx = st.v[0] - (oy * rz - oz * ry)
      const vy = st.v[1] - (oz * rx - ox * rz)
      const vz = st.v[2] - (ox * ry - oy * rx)
      const vu = vx * up[0] + vy * up[1] + vz * up[2]
      const vh = vx * head[0] + vy * head[1] + vz * head[2]
      const vm = Math.sqrt(vu * vu + vh * vh)
      dir[0] = (vu * up[0] + vh * head[0]) / vm
      dir[1] = (vu * up[1] + vh * head[1]) / vm
      dir[2] = (vu * up[2] + vh * head[2]) / vm
    } else if (mode === 'rise' || mode === 'wait') {
      dir[0] = up[0]
      dir[1] = up[1]
      dir[2] = up[2]
    } else {
      // pitch-over: tilted by θ from the vertical toward the launch heading
      const theta = mode === 'ramp' ? PITCH_RATE * (tAbs - tRamp0) : p.kick
      const ct = Math.cos(theta)
      const sn = Math.sin(theta)
      dir[0] = ct * up[0] + sn * head[0]
      dir[1] = ct * up[1] + sn * head[1]
      dir[2] = ct * up[2] + sn * head[2]
    }
  }

  const engine: Engine = (tS, st, out) => {
    const tAbs = tRun0 + tS
    thrust(tAbs, st)
    steer(tAbs, st)
    out[0] = thrustN * dir[0]
    out[1] = thrustN * dir[1]
    out[2] = thrustN * dir[2]
    return flowKgS
  }

  // air-relative speed (km/s), dynamic pressure (Pa) and Mach number at a state
  let vRel = 0
  let qPa = 0
  let mach = 0
  const rel: Vec3 = [0, 0, 0]
  const airflow = (st: SimState) => {
    const [rx, ry, rz] = st.r
    rel[0] = st.v[0] - (oy * rz - oz * ry)
    rel[1] = st.v[1] - (oz * rx - ox * rz)
    rel[2] = st.v[2] - (ox * ry - oy * rx)
    vRel = Math.sqrt(rel[0] * rel[0] + rel[1] * rel[1] + rel[2] * rel[2])
    standardAtmosphere(Math.sqrt(rx * rx + ry * ry + rz * rz) - R_EARTH_EQ, air)
    const vMs = vRel * 1000
    qPa = 0.5 * air.rho * vMs * vMs
    mach = vMs / air.a
  }
  const drag = (_tS: number, st: SimState, _utcMs: number, out: Vec3) => {
    airflow(st)
    if (vRel < 1e-9) {
      out[0] = out[1] = out[2] = 0
      return
    }
    const k = (-qPa * dragCoefficient(mach) * areaM2) / st.m / 1000 / vRel // km/s² per km/s of air-relative velocity
    out[0] = k * rel[0]
    out[1] = k * rel[1]
    out[2] = k * rel[2]
  }

  // --- event functions: each is negative until its event; the run stops at the first to reach zero ---
  const E_CRASH = 0
  const E_DRY = 1
  const E_ALIMIT = 2
  const E_FMIN = 3
  const E_TOWER = 4
  const E_ALIGNED = 5
  const E_CLIP = 6
  const E_ORBIT = 7
  const active = new Array<boolean>(8).fill(false)
  const gv = new Array<number>(8).fill(-1)
  let propRun0 = 0
  let burntRun0 = 0
  const events = (tAbs: number, st: SimState) => {
    const [rx, ry, rz] = st.r
    const rm = Math.sqrt(rx * rx + ry * ry + rz * rz)
    gv[E_CRASH] = -0.5 - (rm - R_EARTH_EQ)
    if (active[E_DRY]) gv[E_DRY] = mRun0 - st.m - (boosterBurnt(c, tAbs) - burntRun0) - propRun0
    if (active[E_ALIMIT] || active[E_FMIN]) {
      thrust(tAbs, st)
      gv[E_ALIMIT] = aCmd - c.aLim
      gv[E_FMIN] = seq.throttleMin - fNeed
    }
    if (active[E_TOWER]) gv[E_TOWER] = rm - R_EARTH_EQ - c.towerKm
    if (active[E_ALIGNED]) {
      airflow(st)
      heading(st)
      // the velocity has turned onto the thrust axis: its tilt toward the heading equals the kick
      gv[E_ALIGNED] = vRel > 1e-9 ? kickSin - (rel[0] * head[0] + rel[1] * head[1] + rel[2] * head[2]) / vRel : -1
    }
    if (active[E_CLIP]) {
      // the commanded angle of attack crosses what q·α allows (in either direction)
      attack(tAbs, st)
      gv[E_CLIP] = clip ? alphaMax - alpha : alpha - alphaMax - 1e-9
    }
    if (active[E_ORBIT]) gv[E_ORBIT] = 0.5 * (st.v[0] * st.v[0] + st.v[1] * st.v[1] + st.v[2] * st.v[2]) - MU_EARTH / rm - c.energy
  }
  const stop = (tS: number, st: SimState) => {
    events(tRun0 + tS, st)
    let g = -Infinity
    for (let i = 0; i < 8; i++) if (active[i] && gv[i] > g) g = gv[i]
    return g
  }

  const result = (ok: boolean, why: string): Flight => {
    const o = orbitOf(s.r, s.v)
    const rm = norm(s.r)
    const vm = norm(s.v)
    return {
      ok,
      why,
      // speed missing at this radius to carry the target orbit's energy
      deficitKms: ok ? 0 : Math.max(0, Math.sqrt(Math.max(0, 2 * (c.energy + MU_EARTH / rm))) - vm) + (rm < R_EARTH_EQ + 80 ? 1 : 0),
      tS: t,
      s,
      seq,
      perigeeKm: o.rp - R_EARTH_EQ,
      apogeeKm: o.ra - R_EARTH_EQ,
      planeErrorDeg: Math.acos(Math.min(1, dot(unit(o.h), c.n))) / DEG,
      radiusErrKm: rm - aim0.rd,
      gammaErr: Math.asin(dot(s.r, s.v) / (rm * vm)) - aim0.gamma,
      pitchStartS,
      qAlpha,
      guess0,
    }
  }

  // budget integrands at a state of the current run: thrust acceleration, and the parts of gravity, drag and
  // thrust that do not act along the air-relative flight direction e
  const grav: Vec3 = [0, 0, 0]
  const dragA: Vec3 = [0, 0, 0]
  const fN: Vec3 = [0, 0, 0]
  const rates = [0, 0, 0, 0]
  const budgetRates = (tS: number, st: SimState) => {
    const rm = norm(st.r)
    let aT = 0
    let cosSteer = 1
    drag(tS, st, 0, dragA)
    const e: Vec3 = vRel > 1e-6 ? [rel[0] / vRel, rel[1] / vRel, rel[2] / vRel] : [st.r[0] / rm, st.r[1] / rm, st.r[2] / rm]
    if (thrMode || bSeg >= 0) {
      engine(tS, st, fN)
      aT = thrustN / st.m / 1000
      cosSteer = dir[0] * e[0] + dir[1] * e[1] + dir[2] * e[2]
    }
    c.field.accel(st.r, 0, grav)
    // centrifugal term of the rotating frame, −ω × (ω × r); the Coriolis term is normal to e and does no work
    const wxr = cross(c.omega, st.r)
    const cf = cross(c.omega, wxr)
    rates[0] = aT
    rates[1] = -((grav[0] - cf[0]) * e[0] + (grav[1] - cf[1]) * e[1] + (grav[2] - cf[2]) * e[2])
    rates[2] = -(dragA[0] * e[0] + dragA[1] * e[1] + dragA[2] * e[2])
    rates[3] = aT * (1 - cosSteer)
    return aT
  }

  /** Acts on the events that are due at (t, s); returns the finished flight when one of them ends it. */
  const fired = (): Flight | null => {
    events(t, s)
    if (gv[E_CRASH] >= 0) return result(false, 'the vehicle fell back to the ground')
    if (active[E_ORBIT] && gv[E_ORBIT] >= 0) {
      if (rec) {
        rec.t.push(t)
        rec.r.push(s.r)
        rec.v.push(s.v)
        rec.m.push(s.m)
        rec.thrusting.push(false)
        rec.events.push({ tS: t, id: `cutoff-${c.veh.stages[seq.stage].id}`, label: cutoffLabel(c, seq.stage) })
        rec.events.push({ tS: t, id: 'insertion', label: 'Orbit insertion' })
      }
      return result(true, '')
    }
    if (active[E_DRY] && gv[E_DRY] >= 0) seq.prop = 0
    if (active[E_TOWER] && gv[E_TOWER] >= 0) {
      mode = 'wait'
      tModeEnd = t + Math.max(0, p.delayS)
      log?.push({ tS: t, id: 'tower-clear', label: 'Tower clear' })
    }
    if (active[E_ALIGNED] && gv[E_ALIGNED] >= 0) {
      mode = 'turn'
      qAlpha = qPa * p.kick
      log?.push({ tS: t, id: 'gravity-turn', label: 'Gravity turn start' })
    }
    if (active[E_ALIMIT] && gv[E_ALIMIT] >= 0 && !limitLogged) {
      limitLogged = true
      log?.push({ tS: t, id: 'acceleration-limit', label: `Throttle-down to hold ${(c.aLim / G0).toFixed(2)} g` })
    }
    return null
  }

  for (let guard = 0; guard < 20000; guard++) {
    while (seq.timed.length && seq.timed[0].tS <= t + 1e-9) s = { r: s.r, v: s.v, m: s.m - seqApply(c, seq, seq.timed.shift()!, log) }
    if (seq.done) return result(false, 'the last stage ran out of propellant')
    if (t > T_MAX_S) return result(false, 'no orbit within the time limit')
    if (seq.burning && seq.prop <= 1e-6) {
      s = { r: s.r, v: s.v, m: s.m - seqDepleted(c, seq, t, log) }
      continue
    }
    // steering mode boundaries
    if (t >= tModeEnd - 1e-9) {
      if (mode === 'wait') {
        mode = 'ramp'
        tRamp0 = t
        pitchStartS = t
        tModeEnd = t + p.kick / PITCH_RATE
        log?.push({ tS: t, id: 'pitch-over', label: 'Pitch-over start' })
        continue
      }
      if (mode === 'ramp') {
        mode = 'hold'
        tModeEnd = Infinity
      }
    }
    airflow(s)
    if (mode === 'turn' && t >= tNextCheck - 1e-9) {
      // the gravity turn ends once the dynamic pressure is past its maximum and the boosters are gone
      if (!seq.boosters && qPa < qBefore) {
        mode = 'guided'
        tNextGuid = t
        log?.push({ tS: t, id: 'guidance', label: 'Closed-loop guidance start' })
      }
      qBefore = qPa
      tNextCheck = t + GUIDANCE_CYCLE_AIR_S
    }
    // guidance cycle
    if (mode === 'guided' && t >= tNextGuid - 1e-9) {
      tNextGuid = t + (qPa * Math.PI > QALPHA_MAX ? GUIDANCE_CYCLE_AIR_S : GUIDANCE_CYCLE_S)
      if (!sol || sol.tf - t > TGO_FREEZE_S) {
        const phases = planPhases(c, seq, t, s.m)
        const flightDir: Vec3 = vRel > 1e-6 ? [rel[0] / vRel, rel[1] / vRel, rel[2] / vRel] : unit(s.r)
        const next: Solution | null = phases.length ? guide(c, s.r, s.v, t, phases, aim, sol, flightDir) : null
        if (next) {
          if (!sol) guess0 = c.guess
          sol = next
          misses = 0
        } else if (!sol || ++misses > 12) {
          return result(false, 'the guidance found no way to the target orbit')
        }
      }
    }
    // engine setting of this run
    bSeg = -1
    if (seq.boosters && c.bT.length > 1 && t < c.bT[c.bT.length - 1] - 1e-9) {
      bSeg = 0
      while (t >= c.bT[bSeg + 1] - 1e-9) bSeg++
    }
    thrMode = 0
    if (seq.burning) {
      thrMode = 1
      if (c.aLim > 0 && seq.throttleMin < 1) {
        thrust(t, s)
        if (aCmd >= c.aLim * (1 - 1e-12)) thrMode = fNeed > seq.throttleMin * (1 + 1e-9) ? 2 : 3
      }
    }
    areaM2 = c.coreAreaM2[seq.stage] + (seq.boosters ? c.boosterAreaM2 : 0)
    tRun0 = t
    mRun0 = s.m
    propRun0 = seq.prop
    burntRun0 = boosterBurnt(c, t)
    active.fill(false)
    active[E_CRASH] = true
    active[E_DRY] = seq.burning
    active[E_ALIMIT] = thrMode === 1 && c.aLim > 0 && seq.throttleMin < 1
    active[E_FMIN] = thrMode === 2
    active[E_TOWER] = mode === 'rise'
    active[E_ALIGNED] = mode === 'hold'
    active[E_ORBIT] = mode === 'guided' && seq.burning
    clipWatch = false
    clip = false
    if (mode === 'guided' && (thrMode || bSeg >= 0) && qPa * Math.PI > QALPHA_MAX) {
      // the air is still dense enough for the q·α limit to matter
      clipWatch = true
      attack(t, s)
      clip = alpha > alphaMax
      active[E_CLIP] = true
    }
    let tEnd = Math.min(
      seq.timed.length ? seq.timed[0].tS : Infinity,
      tModeEnd,
      mode === 'guided' ? tNextGuid : mode === 'turn' ? tNextCheck : Infinity,
      t + 200,
    )
    if (!(tEnd > t + 1e-9)) tEnd = t + 1e-6
    if (stop(0, s) >= 0) {
      // an event is already due at the start of the run (a kick so small that the velocity is past it, say)
      const end = fired()
      if (end) return end
      continue
    }

    const run = integrate(c.field, s, 0, {
      maxSeconds: tEnd - t,
      maxStepS: 1,
      engine: thrMode || bSeg >= 0 ? engine : null,
      extra: drag,
      stop,
      tol: 1e-8,
    })

    if (rec) {
      const thrusting = thrMode !== 0 || bSeg >= 0
      let prev = [0, 0, 0, 0]
      for (let j = 0; j < run.t.length; j++) {
        const st: SimState = { r: run.r[j], v: run.v[j], m: run.m[j] }
        const aT = budgetRates(run.t[j], st)
        const tj = t + run.t[j]
        if (j > 0) {
          const h = run.t[j] - run.t[j - 1]
          rec.ideal += 0.5 * h * (prev[0] + rates[0])
          rec.gravity += 0.5 * h * (prev[1] + rates[1])
          rec.drag += 0.5 * h * (prev[2] + rates[2])
          rec.steering += 0.5 * h * (prev[3] + rates[3])
        }
        prev = rates.slice()
        if (qPa > rec.maxQ.pa) rec.maxQ = { tS: tj, pa: qPa, altKm: norm(st.r) - R_EARTH_EQ }
        if (rec.mach1S < 0 && mach >= 1) rec.mach1S = tj
        rec.maxG = Math.max(rec.maxG, (aT * 1000) / G0)
        if (j < run.t.length - 1) {
          rec.t.push(tj)
          rec.r.push(run.r[j])
          rec.v.push(run.v[j])
          rec.m.push(run.m[j])
          rec.thrusting.push(thrusting)
        }
      }
    }

    // bookkeeping at the end of the run
    const tNew = t + run.endS
    if (seq.burning) seq.prop = propRun0 - (s.m - run.end.m - (boosterBurnt(c, tNew) - burntRun0))
    s = run.end
    t = tNew
    if (!Number.isFinite(s.m) || !Number.isFinite(s.r[0])) return result(false, 'the integration diverged')
    if (run.stopped) {
      const end = fired()
      if (end) return end
    }
  }
  return result(false, 'too many integration runs')
}

// ---------------------------------------------------------------------------------------------------------
// Set-up, optimisation, result
// ---------------------------------------------------------------------------------------------------------

function makeContext(input: AscentInput): Ctx {
  const veh = input.vehicle
  const prof = veh.ascent
  if (veh.stages.length === 0) throw new AscentError(`${veh.name}: no stages`)
  for (const st of veh.stages) {
    if (!st.engine) throw new AscentError(`${veh.name}: stage ${st.name} has no engine`)
  }
  const pad = unit(input.padEci)
  const pole = unit(input.pole)
  const n = unit(input.target.planeNormal)
  let liftoffKg = input.payloadKg + veh.upperStageExtrasKg
  for (const st of veh.stages) liftoffKg += st.dryKg + st.propellantKg
  for (const j of veh.jettisons) liftoffKg += j.massKg
  const b = veh.boosters
  let bT: number[] = []
  let bF: number[] = []
  let bCum: number[] = []
  if (b) {
    if (!b.engine) throw new AscentError(`${veh.name}: boosters without an engine`)
    liftoffKg += b.count * (b.dryKg + b.propellantKg)
    const knots: [number, number][] = prof?.boosterThrustProfile ?? [
      [0, 1],
      [b.burnTimeS, 1],
    ]
    bT = knots.map((k) => k[0])
    let area = 0
    for (let i = 1; i < knots.length; i++) area += 0.5 * (knots[i][1] + knots[i - 1][1]) * (knots[i][0] - knots[i - 1][0])
    const k = (b.count * b.propellantKg) / area
    bF = knots.map((kn) => kn[1] * k)
    bCum = [0]
    for (let i = 1; i < knots.length; i++) bCum.push(bCum[i - 1] + 0.5 * (bF[i] + bF[i - 1]) * (bT[i] - bT[i - 1]))
  }
  const circle = (d: number) => (Math.PI / 4) * d * d
  const coreAreaM2 = veh.stages.map((_, k) => circle(Math.max(...veh.stages.slice(k).map((st) => st.diameterM))))
  const rp = R_EARTH_EQ + Math.min(input.target.perigeeKm, input.target.apogeeKm)
  const ra = R_EARTH_EQ + Math.max(input.target.perigeeKm, input.target.apogeeKm)
  const sma = 0.5 * (rp + ra)
  const c: Ctx = {
    veh,
    prof,
    payloadKg: input.payloadKg,
    pad,
    pole,
    omega: scale(pole, OMEGA_EARTH),
    n,
    field: earthJ2Field(pole),
    liftoffKg,
    aLim: (prof?.maxAxialG ?? 0) * G0,
    towerKm: (prof?.towerClearanceM ?? 1.5 * veh.stages.reduce((sum, st) => sum + st.lengthM, 0)) / 1000,
    coreAreaM2,
    boosterAreaM2: b ? b.count * circle(b.diameterM) : 0,
    bT,
    bF,
    bCum,
    bIspVac: b?.engine?.ispVacS ?? 1,
    bIspSl: b?.engine?.ispSlS ?? b?.engine?.ispVacS ?? 1,
    rp,
    ra,
    sma,
    ecc: (ra - rp) / (ra + rp),
    energy: -MU_EARTH / (2 * sma),
    vHead: Math.sqrt(MU_EARTH * (2 / rp - 1 / sma)),
    guess: null,
  }
  // thrust against weight on the pad
  const e0 = veh.stages[0].engine!
  let thrust0 = e0.count * (e0.thrustSlN ?? e0.thrustVacN)
  if (b) thrust0 += bF[0] * G0 * c.bIspSl
  const weight = (liftoffKg * MU_EARTH * 1000) / (R_EARTH_EQ * R_EARTH_EQ)
  if (!(thrust0 > weight)) {
    throw new AscentError(
      `${veh.name} cannot lift off with ${Math.round(input.payloadKg)} kg: thrust ${(thrust0 / 1e6).toFixed(2)} MN, weight ${(weight / 1e6).toFixed(2)} MN`,
    )
  }
  return c
}

/** Smallest true anomaly on the target orbit at which the free-molecular heating ½ ρ v³ is within the limit. */
function lowestInsertionAnomaly(c: Ctx): number {
  const air: Air = { rho: 0, p: 0, a: 0 }
  const heat = (nu: number) => {
    const a = aimPoint(c, nu)
    return 0.5 * standardAtmosphere(a.rd - R_EARTH_EQ, air).rho * (a.vd * 1000) ** 3 - FMH_LIMIT_W_M2
  }
  if (heat(0) <= 0) return 0
  if (heat(Math.PI) > 0) return 0 // the whole orbit is too low for the rule to mean anything
  let lo = 0
  let hi = Math.PI
  for (let i = 0; i < 50; i++) {
    const mid = 0.5 * (lo + hi)
    if (heat(mid) > 0) lo = mid
    else hi = mid
  }
  return hi
}

// An ascent is a pure function of its input (makeContext starts every search afresh; the predictor's scratch
// arrays are overwritten before they are read), and it is the dearest single piece of a plan (0.5 to 2.5 s).
// The same ascent is asked for again across plans: the trial flight due east that times the first guess
// depends only on the rocket, the payload, the pad's latitude and the parking orbit, so every plan for another
// site or date with the same hardware repeats it (and ascentSensitivity flies it too). The last few results
// are kept, keyed on the whole input (every field, numbers bit for bit), and handed out as copies.
const ASCENT_CACHE_MAX = 8
const ascentCache = new Map<string, AscentResult>()
const exactJson = (x: unknown): string =>
  JSON.stringify(x, (_k, v) => (typeof v === 'number' && (Object.is(v, -0) || !Number.isFinite(v)) ? `#${Object.is(v, -0) ? '-0' : String(v)}` : v))

export function simulateAscent(input: AscentInput): AscentResult {
  const key = exactJson(input)
  const hit = ascentCache.get(key)
  if (hit) {
    ascentCache.delete(key) // most recently used last
    ascentCache.set(key, hit)
    return structuredClone(hit)
  }
  const result = flyAscent(input)
  if (ascentCache.size >= ASCENT_CACHE_MAX) ascentCache.delete(ascentCache.keys().next().value!)
  ascentCache.set(key, structuredClone(result))
  return result
}

function flyAscent(input: AscentInput): AscentResult {
  const c = makeContext(input)
  const elliptical = c.ecc > ECC_CIRCULAR
  const nuMin = elliptical ? lowestInsertionAnomaly(c) : 0
  const nuMax = Math.max(nuMin + 1 * DEG, 150 * DEG)

  // Score of a flight: the mass at insertion; for a flight that fails, a large negative number that still says
  // how far from orbit it ended, so that the search can walk toward the feasible region; for a flight whose
  // pitch-over exceeds the q·α limit, the mass less a steep penalty, so that the search slides back along the
  // limit. Only flights within the limit can become the answer.
  const found: { best: { score: number; x: Steering; f: Flight } | null; reason: string; miss: number } = { best: null, reason: '', miss: Infinity }
  const score = (x: Steering): number => {
    const f = fly(c, x, null)
    const loose = f.ok && Math.abs(f.perigeeKm + R_EARTH_EQ - c.rp) < 50 && Math.abs(f.apogeeKm + R_EARTH_EQ - c.ra) < 50 && f.planeErrorDeg < 0.1
    if (!loose) {
      const miss = f.ok ? 1 : f.deficitKms
      if (miss < found.miss) {
        found.miss = miss
        found.reason = f.ok ? 'the guidance missed the target orbit' : f.why
      }
      return -1e9 - 1e6 * miss
    }
    const over = f.qAlpha / QALPHA_MAX - 1
    if (over <= 0 && (!found.best || f.s.m > found.best.score)) found.best = { score: f.s.m, x: { ...x }, f }
    return f.s.m - (over > 0 ? 0.2 * c.liftoffKg * over : 0)
  }

  // 1. Coarse grid over the pitch-over: when it starts (seconds after tower clear) and how far it tilts.
  //    A gravity turn amplifies its initial tilt (dθ/dt = g sin θ / v), the more the earlier it starts, so a
  //    small early kick and a larger late one give similar paths: the mass at insertion is a long ridge in
  //    this plane with failures on both sides (too steep: out of propellant; too flat: back into the air).
  //    For an elliptical target the insertion point starts at the lowest allowed one, or higher if that fails.
  const delays = [0, 4, 9, 16, 28, 45]
  const kicks: number[] = []
  for (let i = 0; i < 14; i++) kicks.push(KICK_MIN * Math.pow(KICK_MAX / KICK_MIN, i / 13))
  const nus = elliptical ? [nuMin, nuMin + 20 * DEG, nuMin + 45 * DEG] : [0]
  for (const nu of nus) {
    for (const delayS of delays) {
      // kicks from gentle to hard: too gentle runs out of propellant, too hard comes down again, so the
      // first failure after flights that reached orbit ends the row
      let reached = false
      for (const kick of kicks) {
        const sc = score({ kick, delayS, nu, dr: 0, dgamma: 0 })
        if (sc > 0) reached = true
        else if (reached) break
      }
    }
    if (found.best) break
  }
  if (!found.best) {
    const miss = found.miss
    throw new AscentError(
      `${c.veh.name} cannot reach ${input.target.perigeeKm} × ${input.target.apogeeKm} km with ${Math.round(input.payloadKg)} kg: ` +
        `${found.reason || 'no flight reached orbit'}${Number.isFinite(miss) && miss > 0 ? ` (best attempt ${(miss * 1000).toFixed(0)} m/s short)` : ''}`,
    )
  }
  // 2. Downhill simplex (Nelder–Mead, derivative-free) from the best grid point over ln(kick), the start of the
  //    pitch-over and, for an elliptical target, the true anomaly of the insertion point.
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  const decode = (u: number[]): Steering => ({
    kick: clamp(Math.exp(u[0]), KICK_MIN, KICK_MAX),
    delayS: clamp(u[1] * 10, 0, 90),
    nu: elliptical ? clamp(nuMin + Math.abs(u[2]) * 10 * DEG, nuMin, nuMax) : 0,
    dr: 0,
    dgamma: 0,
  })
  const g0 = found.best.x
  const u0 = [Math.log(g0.kick), g0.delayS / 10]
  const du = [0.2, 0.3]
  if (elliptical) {
    u0.push((g0.nu - nuMin) / (10 * DEG))
    du.push(0.5)
  }
  nelderMead((u) => -score(decode(u)), u0, du, 70, 3)
  const top = found.best

  // 3. The guidance aims at a radius and a flight-path angle and arrives a little off (its gravity model is a
  //    two-body average, the real field has J2, the steering is frozen for the last seconds). Shift the aim
  //    by the miss until perigee and apogee are right.
  const xf: Steering = { ...top.x }
  let rec = newRecord()
  c.guess = top.f.guess0 // the same starting point for the guidance as in the flight that was found best
  let f = fly(c, xf, rec)
  for (let i = 0; i < 8; i++) {
    const within = Math.abs(f.perigeeKm + R_EARTH_EQ - c.rp) < AIM_ALT_KM && Math.abs(f.apogeeKm + R_EARTH_EQ - c.ra) < AIM_ALT_KM
    if (!f.ok || within) break
    xf.dr -= f.radiusErrKm
    xf.dgamma -= f.gammaErr
    rec = newRecord()
    c.guess = top.f.guess0
    f = fly(c, xf, rec)
  }
  const altErr = Math.max(Math.abs(f.perigeeKm + R_EARTH_EQ - c.rp), Math.abs(f.apogeeKm + R_EARTH_EQ - c.ra))
  if (!f.ok || !(altErr < TOL_ALT_KM) || !(f.planeErrorDeg < TOL_PLANE_DEG)) {
    throw new AscentError(
      `${c.veh.name}: the insertion did not converge (${f.ok ? `${altErr.toFixed(2)} km, ${f.planeErrorDeg.toFixed(4)}° off` : f.why})`,
    )
  }

  const last = lastStage(c)
  const lastSt = c.veh.stages[last]
  const vEnd = norm(f.s.v)
  const vRelEnd = norm([
    f.s.v[0] - (c.omega[1] * f.s.r[2] - c.omega[2] * f.s.r[1]),
    f.s.v[1] - (c.omega[2] * f.s.r[0] - c.omega[0] * f.s.r[2]),
    f.s.v[2] - (c.omega[0] * f.s.r[1] - c.omega[1] * f.s.r[0]),
  ])
  const events: AscentEvent[] = [{ tS: 0, id: 'liftoff', label: 'Liftoff' }, ...rec.events]
  if (rec.mach1S >= 0) events.push({ tS: rec.mach1S, id: 'mach-1', label: 'Mach 1' })
  events.push({ tS: rec.maxQ.tS, id: 'max-q', label: 'Max Q' })
  events.sort((a, b) => a.tS - b.tS)
  return {
    t: rec.t,
    r: rec.r,
    v: rec.v,
    m: rec.m,
    thrusting: rec.thrusting,
    events,
    insertion: { tS: f.tS, r: f.s.r, v: f.s.v, massKg: f.s.m, perigeeKm: f.perigeeKm, apogeeKm: f.apogeeKm, planeErrorDeg: f.planeErrorDeg },
    upperStagePropellantKg: f.seq.stage === last ? f.seq.prop : lastSt.propellantKg,
    upperStageDryKg: lastSt.dryKg + c.veh.upperStageExtrasKg,
    budget: {
      idealDvKms: rec.ideal,
      gravityLossKms: rec.gravity,
      dragLossKms: rec.drag,
      steeringLossKms: rec.steering,
      earthRotationGainKms: vEnd - vRelEnd,
    },
    downrangeAngleRad: angleAbout(c.pad, unit(f.s.r), c.n),
    insertionStage: f.seq.stage,
    maxQ: rec.maxQ,
    maxAxialG: rec.maxG,
    steering: { kickDeg: xf.kick / DEG, pitchOverStartS: f.pitchStartS, insertionTrueAnomalyDeg: xf.nu / DEG },
  }
}

/** Downhill simplex (Nelder–Mead) minimisation from x0 with initial steps `step`; stops after maxEval function
 *  values or when the simplex's values agree within tol. Returns the best point seen. */
function nelderMead(f: (x: number[]) => number, x0: number[], step: number[], maxEval: number, tol: number): number[] {
  const n = x0.length
  const pts: { x: number[]; y: number }[] = []
  let evals = 0
  const ev = (x: number[]) => {
    evals++
    return { x, y: f(x) }
  }
  pts.push(ev(x0.slice()))
  for (let i = 0; i < n; i++) {
    const x = x0.slice()
    x[i] += step[i]
    pts.push(ev(x))
  }
  const along = (a: number[], b: number[], k: number) => a.map((ai, i) => ai + k * (b[i] - ai))
  while (evals < maxEval) {
    pts.sort((a, b) => a.y - b.y)
    if (Math.abs(pts[n].y - pts[0].y) < tol) break
    const centre = new Array<number>(n).fill(0)
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) centre[j] += pts[i].x[j] / n
    const worst = pts[n]
    const refl = ev(along(worst.x, centre, 2))
    if (refl.y < pts[0].y) {
      const exp = ev(along(worst.x, centre, 3))
      pts[n] = exp.y < refl.y ? exp : refl
    } else if (refl.y < pts[n - 1].y) {
      pts[n] = refl
    } else {
      const con = refl.y < worst.y ? ev(along(worst.x, centre, 1.5)) : ev(along(worst.x, centre, 0.5))
      if (con.y < Math.min(worst.y, refl.y)) {
        pts[n] = con
      } else {
        for (let i = 1; i <= n; i++) pts[i] = ev(along(pts[0].x, pts[i].x, 0.5))
      }
    }
  }
  pts.sort((a, b) => a.y - b.y)
  return pts[0].x
}

function newRecord(): FlightLog {
  return {
    t: [],
    r: [],
    v: [],
    m: [],
    thrusting: [],
    events: [],
    ideal: 0,
    gravity: 0,
    drag: 0,
    steering: 0,
    maxQ: { tS: 0, pa: 0, altKm: 0 },
    mach1S: -1,
    maxG: 0,
  }
}
