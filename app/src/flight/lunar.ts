// Operations at the Moon: powered descent from lunar orbit to a chosen point, and ascent from the surface back
// to rendezvous and docking with a spacecraft in lunar orbit. Every phase is integrated with sim.ts (gravity
// field, thrust, propellant flow); a burn is a run of the integrator with the engine on, never a jump in
// velocity. The solver reads the lander from data (hardware.ts) and nothing else about it.
//
// Frame and units: Moon-centred J2000 axes (not rotating), km, km/s, kg, UTC ms. The landing site turns with
// the Moon; the caller supplies its position as a function of time. The surface is the sphere through the
// site (radius |site|, = R_MOON when the caller puts the site on the reference sphere). Altitudes of orbits
// (pdiAltKm, insertionAltKm) are above R_MOON.
//
// DESCENT
//   Descent Orbit Insertion (DOI): a retrograde burn half a revolution before the landing that lowers the
//     perilune to pdiAltKm. Its length is solved so that the integrated orbit has exactly that perilune. Its
//     time is the earliest one for which the braking burn, begun at the perilune, ends over the site.
//   Braking: one burn at a constant throttle setting from Powered Descent Initiation (PDI, at the perilune)
//     to a gate GATE_ALT_KM above the site. Steering is the linear tangent law in the local frame,
//         thrust direction ∝ −ĥ + (a + b t) r̂ + (c + d t) n̂
//     (ĥ horizontal along the flight, r̂ up, n̂ the orbit normal). This is the form the optimal thrust
//     direction takes for a transfer of free range in a uniform gravity field (the bilinear tangent law
//     with its range multiplier zero); the range is made free here by the ignition time. The six unknowns
//     (a, b, c, d, burn length, ignition time) are solved by Newton shooting on the integrated flight so that
//     the burn ends exactly at the gate: over the site, no horizontal speed relative to the turning surface,
//     sinking at the speed the terminal phase starts with. The terms c, d steer out the cross-range when the
//     site is off the orbit plane (up to MAX_CROSS_FRACTION of the burn's arc; beyond that LunarOpsError).
//     Throttle setting: full thrust, unless the engine is so strong for this lander that the short burn would
//     have to force the fall from the perilune height; then the setting that leaves the most mass at the
//     gate, found by a golden-section search within the engine's range.
//   Terminal descent: straight down from the gate. A throttleable engine follows a constant-deceleration
//     profile of sink rate against height in closed loop (throttle for the vertical channel, a small tilt for
//     the horizontal one) and touches down at TOUCHDOWN_SPEED_KMS. An engine of fixed thrust cannot do that:
//     its gate speed is chosen so that the same uninterrupted burn, now pointing up, has the sink rate down
//     to CUTOFF_SINK_KMS at CUTOFF_HEIGHT_KM above the ground; there it is cut off and the lander drops.
//   How close to optimal (numbers from lunar.test.ts and from experiments with this file, Apollo LM from a
//     110 km orbit, PDI at 15 km): DOI + powered descent 1833 m/s against the impulsive lower bound of
//     1726 m/s (DescentResult.idealDvKms: Hohmann transfer to the surface and a stop there), +6.2 %. Of the
//     107 m/s, about 23 are the vertical terminal descent from the gate and the rest is gravity loss of a
//     burn at 3 m/s² that no steering avoids: a pitch law with two more free coefficients (cubic in time),
//     optimised for the shortest burn, gained 0.2 m/s (0.01 %) on the linear law; at 60 % of the thrust it
//     gained 0.6 m/s. Landers with 4 to 6 m/s² come to about +4 %. Apollo 11 itself used 2065 m/s: it
//     throttled down after 386 s and flew a slow piloted approach (Apollo 11 Mission Report, 5.3 and 9.8.1).
//
// ASCENT AND RENDEZVOUS
//   Liftoff time: the earliest instant for which the target is where the rendezvous needs it (phasing).
//   Vertical rise until the radial rate is RISE_SPEED_KMS, then one burn at a constant throttle setting
//     (chosen as for the descent) with the same linear tangent law, prograde this time, solved by Newton
//     shooting for five conditions at cut-off: perilune altitude, no radial speed, the speed of the insertion
//     orbit there, and position and velocity in the insertion plane.
//   Plane change. The site is in general not in the target's orbit plane (the Moon turns under the orbit).
//     Yaw steering during the ascent costs with the square of the offset, a plane change in orbit in
//     proportion to it. The ascent steers out the offset up to the angle where the two cost the same per
//     degree (0.75° for the Apollo LM); for a larger offset it flies into a plane that crosses the target's
//     a quarter revolution downrange and turns the rest there in a plane change burn.
//   Terminal Phase Initiation (TPI) half a revolution after the insertion, at the apolune; a coast of
//     TRANSFER_ANGLE around the Moon; Terminal Phase Finalization (TPF), the braking burn that ends at the
//     target with no relative speed. Both burns are solved together (six unknowns, six conditions) on the
//     integrated flight. Insertion at the perilune, TPI at the apolune and TPF at the target's altitude are
//     the three burns of a Hohmann-like climb. Apollo LM to a 110 km orbit: 1837 m/s ascent (Apollo 11:
//     1850 m/s) and 28 m/s rendezvous, +8 % on the impulsive lower bound (AscentResult.idealDvKms).
//
// Limits. A fixed-thrust engine far stronger than the flight needs (more than about 10 m/s²) loses much: the
// whole height between the surface and the perilune has to be forced into a burn of a minute. Give such a
// lander a lower pdiAltKm and insertion perilune. Not modelled: attitude dynamics (the thrust direction follows
// the law at once, also at the pitchover and at the gate), a reaction control system (the data contract has
// one main engine per module, so the small rendezvous burns use it, throttled down when it can; with the
// Apollo ascent engine they last about a second, the real LM used its thrusters), terrain, a change of
// specific impulse with the throttle setting, the last metres of a real docking approach ("Docking" is the
// instant the two craft are together with no relative speed). The Moon's gravity is whatever `field` holds.
import { G0, MU_MOON, R_MOON } from './astro'
import type { SpacecraftSpec, StageSpec } from './hardware'
import { constantThrust, integrate } from './sim'
import type { Engine, Field, SimRun, SimState } from './sim'
import type { Vec3 } from './types'
import { add, cross, dot, norm, rotateAbout, scale, sub, unit } from './vec'

// ---------------------------------------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------------------------------------

export interface OrbitState {
  utcMs: number
  r: Vec3 // Moon-centred inertial, km
  v: Vec3 // km/s
}

export interface LunarEvent {
  utcMs: number
  id: string
  label: string
  dvKms?: number // integrated thrust acceleration of the burn that starts here
  propellantKg?: number
  durationS?: number
  massAfterKg?: number
}

/** A sampled flight: r[i] at t[i] (UTC ms, strictly increasing); thrusting[i] tells whether the engine fires
 *  on the stretch that begins at sample i. */
export interface Path {
  t: number[]
  r: Vec3[]
  thrusting: boolean[]
}

export interface DescentInput {
  field: Field
  /** The lander's state in low lunar orbit, at or before the earliest undocking. */
  orbit: OrbitState
  /** The descent orbit insertion does not start before this. */
  earliestMs: number
  /** Landing site, Moon-centred inertial km (turning with the Moon). */
  site(utcMs: number): Vec3
  /** Modules: ascent element first, then the descent element (or a single module that does both). */
  lander: SpacecraftSpec
  /** Lander mass at undocking, crew and cargo included. */
  massKg: number
  /** Perilune altitude of the descent orbit, km above R_MOON (15 for Apollo). */
  pdiAltKm: number
  /** Usable propellant in the descent element at undocking. Default: its full load, or what massKg leaves
   *  room for when that is less. */
  propellantKg?: number
}

export interface DescentResult {
  path: Path // from the descent orbit insertion ignition to touchdown
  events: LunarEvent[]
  touchdownMs: number
  massAtTouchdownKg: number
  propellantLeftKg: number // in the element that flew the descent
  missM: number // distance from the site at touchdown, metres
  touchdownSpeedMs: number // speed relative to the surface at touchdown, m/s
  crossRangeDeg: number // how far the site was from the orbit plane when the descent began
  /** Throttle setting of the braking burn, 0–1: full thrust unless a lower setting takes less propellant. */
  brakingThrottle: number
  dvKms: { doi: number; powered: number }
  /** Part of dvKms.powered spent on the cross-range: the difference to a landing in the orbit plane. */
  crossRangeDvKms: number
  /** Impulsive lower bound for the same orbit: Hohmann transfer down to the surface and a stop there. */
  idealDvKms: number
}

export interface AscentInput {
  field: Field
  site(utcMs: number): Vec3
  /** Liftoff not before this. */
  earliestMs: number
  /** The waiting spacecraft's orbit. */
  target: OrbitState
  lander: SpacecraftSpec
  /** Mass at liftoff of the element that ascends (two-stage lander: the ascent stage). */
  massKg: number
  /** Orbit at the end of the ascent burn, km above R_MOON (17 × 83 for Apollo). */
  insertionAltKm: { perilune: number; apolune: number }
  /** Usable propellant on board at liftoff. Default: the ascent element's full load, or what massKg leaves
   *  room for above its dry mass when that is less (a single-stage lander after its descent). */
  propellantKg?: number
}

export interface AscentResult {
  path: Path // liftoff to docking
  events: LunarEvent[]
  liftoffMs: number
  dockingMs: number
  massAtDockingKg: number
  propellantLeftKg: number
  relPosM: number // separation from the target at docking, metres
  relSpeedMs: number // relative speed at docking, m/s
  planeChangeDeg: number // angle between the site and the target's orbit plane at liftoff
  /** Throttle setting of the ascent burn, 0–1: full thrust unless a lower setting takes less propellant. */
  ascentThrottle: number
  dvKms: { ascent: number; rendezvous: number }
  /** What the plane change costs: the part of dvKms.ascent spent on steering toward the target's plane (the
   *  difference to an ascent that stays in the plane through the site) plus the plane change burn in orbit. */
  planeChangeDvKms: number
  /** Impulsive lower bound: Hohmann transfer from the surface to the target's orbit. */
  idealDvKms: number
}

/** A flight that cannot be flown: not enough propellant, a site out of reach of this orbit, too little thrust. */
export class LunarOpsError extends Error {}

// ---------------------------------------------------------------------------------------------------------
// Design constants (choices of this planner, not facts about a vehicle)
// ---------------------------------------------------------------------------------------------------------

/** Height above the site at which the braking burn ends and the vertical terminal descent begins. */
const GATE_ALT_KM = 0.1
/** Sink rate at touchdown with a throttleable engine: 0.5 m/s. */
const TOUCHDOWN_SPEED_KMS = 0.0005
/** Fixed-thrust engine: it is cut off when the sink rate is down to 0.2 m/s, planned 0.1 m above the ground;
 *  the drop from there ends at about 0.6 m/s. */
const CUTOFF_SINK_KMS = 0.0002
const CUTOFF_HEIGHT_KM = 0.0001
/** Terminal descent loop: sink-rate gain (1/s) and horizontal position / velocity gains (1/s², 1/s). */
const KV = 1.5
const KP = 1
const KD = 2
/** Radial rate at which the ascent pitches over: Apollo's guidance switched from the vertical rise to the
 *  orbit insertion phase "when the radial rate becomes 40 fps" (NASA TM X-58040, p. 16). 40 ft/s = 12.192 m/s. */
const RISE_SPEED_KMS = 0.012192
/** Angle around the Moon from TPI to the target. 180° would be the cheapest transfer in the plane, but then
 *  the arrival point does not depend on the out-of-plane part of the burn and the targeting is singular. */
const TRANSFER_ANGLE = (165 * Math.PI) / 180
/** Thrust acceleration (4 m/s²) at which the first solution of a braking or ascent burn is looked for; an
 *  engine that gives more is followed from there up to its own range. */
const EASY_ACCEL_KMS2 = 0.004
/** κ in the cost of steering out a sideways distance y during a burn of length T and size Δv, κ y²/(T² Δv):
 *  fitted to this planner's own ascents (Apollo LM: 19 m/s for 1°). */
const STEER_COST = 7.3
/** A short orbital burn is throttled down, when the engine can, so that it lasts about this long. */
const TRIM_BURN_S = 20
/** Largest cross-range the braking burn steers out, as a fraction of its arc around the Moon. */
const MAX_CROSS_FRACTION = 0.3
/** Longest step of the stored path: coasting and under thrust, s. */
const COAST_STEP_S = 30
const BURN_STEP_S = 5
/** Shooting tolerances: position 1 cm, velocity 0.02 mm/s at the gate and at orbit insertion; 10 cm and
 *  0.1 mm/s at the end of the rendezvous (after an hour of coasting). */
const POS_TOL_KM = 1e-5
const VEL_TOL_KMS = 2e-8
const RDV_POS_TOL_KM = 1e-4
const RDV_VEL_TOL_KMS = 1e-7

// ---------------------------------------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------------------------------------

/** All engines of one element together. */
interface Motor {
  thrustN: number
  ispS: number
  flowKgS: number // at full thrust
  veKms: number // exhaust velocity
  throttleMin: number
}

function motorOf(stage: StageSpec, lander: SpacecraftSpec): Motor {
  const e = stage.engine
  if (!e || !(e.thrustVacN > 0) || !(e.ispVacS > 0) || !(e.count > 0)) throw new LunarOpsError(`${lander.name}: ${stage.name} has no usable engine.`)
  const thrustN = e.thrustVacN * e.count
  return {
    thrustN,
    ispS: e.ispVacS,
    flowKgS: thrustN / (G0 * e.ispVacS),
    veKms: (G0 * e.ispVacS) / 1000,
    throttleMin: Math.min(1, Math.max(0.01, e.throttleMin)),
  }
}

const fixedThrust = (m: Motor) => m.throttleMin >= 0.999

interface Elements {
  a: number
  e: number
  rp: number
  ra: number
  periodS: number
  normal: Vec3
}

/** Osculating two-body elements around the Moon. */
function elements(r: Vec3, v: Vec3): Elements {
  const rm = norm(r)
  const energy = dot(v, v) / 2 - MU_MOON / rm
  const h = cross(r, v)
  const a = -MU_MOON / (2 * energy)
  const e = Math.sqrt(Math.max(0, 1 + (2 * energy * dot(h, h)) / (MU_MOON * MU_MOON)))
  return { a, e, rp: a * (1 - e), ra: a * (1 + e), periodS: 2 * Math.PI * Math.sqrt(a ** 3 / MU_MOON), normal: unit(h) }
}

/** Velocity of the site (km/s) from its position function: central difference over 2 s. */
const velocityOf = (site: (utcMs: number) => Vec3) => (utcMs: number): Vec3 => scale(sub(site(utcMs + 1000), site(utcMs - 1000)), 0.5)

/** Seconds a burn of dvKms lasts at the given throttle setting (rocket equation). */
const burnSeconds = (m: Motor, massKg: number, dvKms: number, throttle: number) =>
  (massKg * (1 - Math.exp(-dvKms / m.veKms))) / (m.flowKgS * throttle)

/** Delta-v of a burn from the masses before and after: ∫ thrust/m dt = vₑ ln(m₀/m₁) at constant vₑ. */
const dvOf = (m: Motor, m0: number, m1: number) => m.veKms * Math.log(m0 / m1)

/** Throttle setting for a short orbital burn: as low as needed for TRIM_BURN_S, within the engine's range. */
const trimThrottle = (m: Motor, massKg: number, dvKms: number) =>
  Math.min(1, Math.max(m.throttleMin, burnSeconds(m, massKg, dvKms, 1) / TRIM_BURN_S))

/** Engine at a fixed throttle setting pointed by a steering law. */
const burning = (m: Motor, throttle: number, dir: (tS: number, s: SimState) => Vec3): Engine => constantThrust(m.thrustN * throttle, m.ispS, dir)

/** Linear tangent steering in the local frame: thrust along  sign·ĥ + (a + b t) r̂ + (c + d t) n̂,  with r̂ up,
 *  n̂ the given plane normal and ĥ = n̂ × r̂ the horizontal direction of flight. sign −1 brakes, +1 accelerates. */
function tangentSteering(n: Vec3, sign: 1 | -1, a: number, b: number, c: number, d: number): (tS: number, s: SimState) => Vec3 {
  return (tS, s) => {
    const up = unit(s.r)
    const h = unit(cross(n, up))
    const p = a + b * tS
    const q = c + d * tS
    return unit([sign * h[0] + p * up[0] + q * n[0], sign * h[1] + p * up[1] + q * n[1], sign * h[2] + p * up[2] + q * n[2]])
  }
}

/** Solves A x = b by Gaussian elimination with partial pivoting; null when A is singular. */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[piv][c])) piv = i
    if (!(Math.abs(M[piv][c]) > 1e-300)) return null
    const swap = M[c]
    M[c] = M[piv]
    M[piv] = swap
    for (let i = c + 1; i < n; i++) {
      const f = M[i][c] / M[c][c]
      for (let k = c; k <= n; k++) M[i][k] -= f * M[c][k]
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let acc = M[i][n]
    for (let k = i + 1; k < n; k++) acc -= M[i][k] * x[k]
    x[i] = acc / M[i][i]
  }
  return x.every(Number.isFinite) ? x : null
}

/** Newton's method for a square system with a finite-difference Jacobian and step halving. f returns the
 *  residuals scaled so that 1 is the tolerance, or null where x cannot be flown. h: difference steps;
 *  cap: the largest change of each unknown in one iteration. Returns the solution, or null. */
function newton(f: (x: number[]) => number[] | null, x0: number[], h: number[], cap: number[], maxIter = 40): number[] | null {
  const size = (r: number[]) => r.reduce((s, v) => Math.max(s, Math.abs(v)), 0)
  const merit = (r: number[]) => r.reduce((s, v) => s + v * v, 0)
  const n = x0.length
  let x = x0.slice()
  let res = f(x)
  if (!res) return null
  for (let it = 0; it < maxIter; it++) {
    if (size(res) < 1) return x
    const J = Array.from({ length: n }, () => new Array<number>(n).fill(0))
    for (let j = 0; j < n; j++) {
      let step = h[j]
      const xj = x.slice()
      xj[j] = x[j] + step
      let rj = f(xj)
      if (!rj) {
        step = -h[j]
        xj[j] = x[j] + step
        rj = f(xj)
      }
      if (!rj) return null
      for (let i = 0; i < n; i++) J[i][j] = (rj[i] - res[i]) / step
    }
    const dx = solveLinear(J, res.map((v) => -v))
    if (!dx) return null
    let k = 1
    for (let j = 0; j < n; j++) if (Math.abs(dx[j]) * k > cap[j]) k = cap[j] / Math.abs(dx[j])
    let moved = false
    for (let half = 0; half < 14; half++, k /= 2) {
      const xt = x.map((v, j) => v + k * dx[j])
      const rt = f(xt)
      if (rt && merit(rt) < merit(res)) {
        x = xt
        res = rt
        moved = true
        break
      }
    }
    if (!moved) break
  }
  return size(res) < 1 ? x : null
}

/** Follows a solution along a parameter from p0 (where x0 solves the problem) to p1: each step starts the
 *  solver from the last solution; a step the solver rejects is halved. */
function follow(solveAt: (p: number, guess: number[]) => number[] | null, p0: number, x0: number[], p1: number): number[] | null {
  let p = p0
  let x = x0
  let step = p1 - p0
  while (p !== p1) {
    const next = Math.abs(p1 - p) <= Math.abs(step) ? p1 : p + step
    const sol = solveAt(next, x)
    if (sol) {
      x = sol
      p = next
    } else {
      step /= 2
      if (Math.abs(step) < Math.abs(p1 - p0) / 200) return null
    }
  }
  return x
}

/** A family of solutions of one burn over the throttle setting. The unknowns are scaled so that a solution at
 *  one setting is a fair guess at the next (burn length as seconds at full flow, steering rates per burn
 *  length); a new setting is reached from the nearest one already solved, in steps of ln k. */
class ThrottleFamily {
  private solved: { k: number; x: number[] }[] = []
  private solveAt: (k: number, guess: number[]) => number[] | null
  constructor(solveAt: (k: number, guess: number[]) => number[] | null) {
    this.solveAt = solveAt
  }
  add(k: number, x: number[]): void {
    this.solved.push({ k, x })
  }
  at(k: number): number[] | null {
    if (this.solved.length === 0) return null
    let from = this.solved[0]
    for (const s of this.solved) if (Math.abs(Math.log(s.k / k)) < Math.abs(Math.log(from.k / k))) from = s
    if (from.k === k) return from.x
    const x = follow((u, guess) => this.solveAt(Math.exp(u), guess), Math.log(from.k), from.x, Math.log(k))
    if (x) this.add(k, x)
    return x
  }
}

/** The throttle setting in [kLo, 1] that leaves the most mass at the end of a burn (massAt: −∞ where the
 *  burn has no solution). Full thrust unless a slightly lower setting is better; then a golden-section search
 *  on ln k (the mass has one maximum: gravity loss grows toward low thrust, the cost of forcing the height
 *  change into a short burn toward high thrust). */
function bestThrottle(massAt: (k: number) => number, kLo: number): number {
  if (kLo >= 0.999) return 1
  if (massAt(1) >= massAt(Math.max(kLo, 0.92))) return 1
  const g = (Math.sqrt(5) - 1) / 2
  let a = Math.log(kLo)
  let b = 0
  let c = b - g * (b - a)
  let d = a + g * (b - a)
  let fc = massAt(Math.exp(c))
  let fd = massAt(Math.exp(d))
  while (b - a > 0.05) {
    if (fc > fd) {
      b = d
      d = c
      fd = fc
      c = b - g * (b - a)
      fc = massAt(Math.exp(c))
    } else {
      a = c
      c = d
      fc = fd
      d = a + g * (b - a)
      fd = massAt(Math.exp(d))
    }
  }
  return Math.exp(0.5 * (a + b))
}

/** Collects the runs of a flight into one Path. */
class PathBuilder {
  readonly path: Path = { t: [], r: [], thrusting: [] }
  add(run: SimRun, t0Ms: number, thrusting: boolean): void {
    const p = this.path
    for (let i = 0; i < run.t.length; i++) {
      const t = t0Ms + run.t[i] * 1000
      const last = p.t.length - 1
      if (last >= 0 && t <= p.t[last]) {
        // the sample a run shares with the one before it: from here on this run's engine state holds
        if (i === 0) p.thrusting[last] = thrusting
        continue
      }
      p.t.push(t)
      p.r.push(run.r[i])
      p.thrusting.push(thrusting)
    }
  }
  finish(): Path {
    if (this.path.thrusting.length > 0) this.path.thrusting[this.path.thrusting.length - 1] = false
    return this.path
  }
}

const coast = (field: Field, s: SimState, t0Ms: number, seconds: number): SimRun =>
  integrate(field, s, t0Ms, { maxSeconds: Math.max(0, seconds), maxStepS: COAST_STEP_S })

/** A burn that holds its direction and delivers the velocity change dv (rocket equation for its length). */
function burnAlong(field: Field, m: Motor, s: SimState, tMs: number, dv: Vec3, throttle: number): SimRun {
  const size = norm(dv)
  if (size < 1e-12) return integrate(field, s, tMs, { maxSeconds: 0 })
  const dir = scale(dv, 1 / size)
  return integrate(field, s, tMs, { maxSeconds: burnSeconds(m, s.m, size, throttle), maxStepS: BURN_STEP_S, engine: burning(m, throttle, () => dir) })
}

/** Flies f and turns the integrator's own failures (a state that left the physical range while the solver
 *  was trying unknowns) into "cannot be flown". */
function attempt<T>(f: () => T | null): T | null {
  try {
    return f()
  } catch (err) {
    if (err instanceof RangeError) return null
    throw err
  }
}

const deg = (rad: number) => (rad * 180) / Math.PI
const asinSafe = (x: number) => Math.asin(Math.min(1, Math.max(-1, x)))

/** Signed angle (−π, π] from a to b about the axis n. */
const signedAngle = (a: Vec3, b: Vec3, n: Vec3) => Math.atan2(dot(cross(a, b), n), dot(a, b))

// ---------------------------------------------------------------------------------------------------------
// Descent
// ---------------------------------------------------------------------------------------------------------

/** What the vertical terminal descent starts with at the gate, for the mass the lander has there. */
interface Terminal {
  fixedThrust: boolean
  gateSpeedKms: number // sink rate at the gate
  decelKms2: number // net deceleration of the profile
  seconds: number // nominal length
}

/** Designs the terminal descent for a lander of mass mGate at the gate; g is the local gravity (km/s²).
 *  null when the engine cannot slow this mass down against gravity. */
function designTerminal(m: Motor, mGate: number, g: number): Terminal | null {
  const aMax = m.thrustN / mGate / 1000 // km/s²
  if (fixedThrust(m)) {
    // Fixed thrust, pointing up from the gate until the cut-off. With m(t) = m₀ − ṁ t and L(t) = vₑ ln(m₀/m(t)):
    //   sink rate   w(t) = w_gate − L(t) + g t
    //   height      h(t) = h_gate − w_gate t + vₑ t − (m₀/ṁ − t) L(t) − g t²/2
    // Asking for w(T) = w_cutoff at h(T) = h_cutoff leaves one equation for the burn length T,
    //   F(T) = h_gate − h_cutoff − w_cutoff T + g T²/2 + vₑ T − (m₀/ṁ) L(T) = 0,
    // and then w_gate = w_cutoff + L(T) − g T.
    if (aMax <= 1.02 * g) return null
    const L = (t: number) => m.veKms * Math.log(mGate / (mGate - m.flowKgS * t))
    const F = (t: number) => GATE_ALT_KM - CUTOFF_HEIGHT_KM - CUTOFF_SINK_KMS * t + 0.5 * g * t * t + m.veKms * t - (mGate / m.flowKgS) * L(t)
    let hi = Math.sqrt((2 * GATE_ALT_KM) / (aMax - g))
    const tEmpty = mGate / m.flowKgS
    while (F(hi) > 0 && hi < 0.5 * tEmpty) hi *= 1.5
    if (F(hi) > 0) return null
    let lo = 0
    for (let i = 0; i < 60; i++) {
      const mid = 0.5 * (lo + hi)
      if (F(mid) > 0) lo = mid
      else hi = mid
    }
    const T = 0.5 * (lo + hi)
    return { fixedThrust: true, gateSpeedKms: CUTOFF_SINK_KMS + L(T) - g * T, decelKms2: aMax - g, seconds: T }
  }
  // Throttleable: a constant-deceleration profile flown in the middle of the usable throttle range, so that the
  // loop has authority in both directions. The lowest useful setting is the engine's minimum or 15 % above
  // hover, whichever is higher.
  const lowest = Math.max(m.throttleMin, (1.15 * g) / aMax)
  if (lowest >= 1) return null
  const decel = 0.5 * (lowest + 1) * aMax - g
  const gateSpeed = Math.sqrt(TOUCHDOWN_SPEED_KMS ** 2 + 2 * decel * GATE_ALT_KM)
  return { fixedThrust: false, gateSpeedKms: gateSpeed, decelKms2: decel, seconds: (gateSpeed - TOUCHDOWN_SPEED_KMS) / decel }
}

/** Steering and throttle of the terminal descent, in closed loop on the state relative to the site.
 *  Commanded acceleration = (profile deceleration + sink-rate error × KV) up − KP × horizontal offset
 *  − KD × horizontal velocity − gravity. A throttleable engine delivers its size and direction; a fixed-thrust
 *  engine only its direction (the vertical channel was settled by the gate speed). */
function terminalEngine(field: Field, site: (utcMs: number) => Vec3, m: Motor, t0Ms: number, plan: Terminal): Engine {
  const siteVel = velocityOf(site)
  const g: Vec3 = [0, 0, 0]
  return (tS, s, out) => {
    const utcMs = t0Ms + tS * 1000
    const S = site(utcMs)
    const up = unit(S)
    const rho = sub(s.r, S)
    const w = sub(s.v, siteVel(utcMs))
    const h = dot(rho, up)
    const wUp = dot(w, up)
    const aSide = add(scale(sub(rho, scale(up, h)), -KP), scale(sub(w, scale(up, wUp)), -KD))
    if (plan.fixedThrust) {
      const d = unit(add(scale(up, m.thrustN / s.m / 1000), aSide))
      out[0] = m.thrustN * d[0]
      out[1] = m.thrustN * d[1]
      out[2] = m.thrustN * d[2]
      return m.flowKgS
    }
    // sink rate the profile asks for at this height: w² = w_touchdown² + 2 a h
    const wRef = -Math.sqrt(TOUCHDOWN_SPEED_KMS ** 2 + 2 * plan.decelKms2 * Math.max(h, 0))
    // on the profile dw/dt = a · (w / w_ref): the feed-forward; KV pulls the sink rate onto the profile
    const aUp = plan.decelKms2 * (wUp / wRef) + KV * (wRef - wUp)
    field.accel(s.r, utcMs, g)
    const aCmd: Vec3 = [aUp * up[0] + aSide[0] - g[0], aUp * up[1] + aSide[1] - g[1], aUp * up[2] + aSide[2] - g[2]]
    const aSize = norm(aCmd)
    const thrustN = Math.min(m.thrustN, Math.max(m.throttleMin * m.thrustN, s.m * aSize * 1000))
    out[0] = (thrustN * aCmd[0]) / aSize
    out[1] = (thrustN * aCmd[1]) / aSize
    out[2] = (thrustN * aCmd[2]) / aSize
    return (m.flowKgS * thrustN) / m.thrustN
  }
}

interface DoiBurn {
  run: SimRun | null // null: the orbit already has this perilune, no burn
  end: SimState
  endMs: number
}

/** Descent orbit insertion at tMs: retrograde, as long as it takes to bring the perilune down to rPeri. */
function flyDoi(field: Field, s: SimState, tMs: number, m: Motor, rPeri: number): DoiBurn {
  // impulsive estimate: the cut in speed along the velocity that gives this perilune
  const periAfter = (dv: number) => elements(s.r, scale(s.v, 1 - dv / norm(s.v))).rp
  if (periAfter(0) - rPeri < 1e-4) return { run: null, end: s, endMs: tMs }
  let lo = 0
  let hi = 0.5 * norm(s.v)
  for (let i = 0; i < 50; i++) {
    const mid = 0.5 * (lo + hi)
    if (periAfter(mid) > rPeri) lo = mid
    else hi = mid
  }
  const dv = 0.5 * (lo + hi)
  const throttle = trimThrottle(m, s.m, dv)
  const engine = burning(m, throttle, (_t, st) => scale(st.v, -1 / norm(st.v)))
  const fly = (seconds: number) => integrate(field, s, tMs, { maxSeconds: seconds, maxStepS: BURN_STEP_S, engine })
  const miss = (seconds: number) => {
    const end = fly(seconds).end
    return elements(end.r, end.v).rp - rPeri
  }
  // secant iteration on the burn length
  let t0 = burnSeconds(m, s.m, dv, throttle)
  let f0 = miss(t0)
  let t1 = t0 * 1.02
  for (let i = 0; i < 12 && Math.abs(f0) > 1e-6; i++) {
    const f1 = miss(t1)
    if (f1 === f0) break
    const t2 = t1 - (f1 * (t1 - t0)) / (f1 - f0)
    t0 = t1
    f0 = f1
    t1 = t2
  }
  const run = fly(t0)
  return { run, end: run.end, endMs: tMs + run.endS * 1000 }
}

/** The braking burn as the solver flies it: coast from the reference state to the ignition, then the burn. */
interface Braking {
  coast: SimRun
  burn: SimRun
  pdiMs: number
  endMs: number
}

export function planDescent(input: DescentInput): DescentResult {
  const { field, site, lander } = input
  if (lander.modules.length === 0) throw new LunarOpsError(`${lander.name} has no modules.`)
  const stage = lander.modules[lander.modules.length - 1]
  const motor = motorOf(stage, lander)
  const aboveKg = lander.modules.slice(0, -1).reduce((sum, mod) => sum + mod.dryKg + mod.propellantKg, 0)
  const propellantKg = input.propellantKg ?? Math.min(stage.propellantKg, input.massKg - stage.dryKg - aboveKg)
  if (!(input.massKg > 0) || !(propellantKg > 0)) throw new LunarOpsError(`${lander.name}: no propellant for the descent at a mass of ${input.massKg.toFixed(0)} kg.`)

  const siteVel = velocityOf(site)
  const tMin = Math.max(input.earliestMs, input.orbit.utcMs)
  const surfaceR = norm(site(tMin))
  const rPeri = R_MOON + input.pdiAltKm
  if (!(rPeri > surfaceR + 2 * GATE_ALT_KM)) throw new LunarOpsError(`A descent orbit with its perilune at ${input.pdiAltKm} km does not clear the surface at the site.`)

  // The orbit at the earliest instant.
  let start: SimState = { r: input.orbit.r, v: input.orbit.v, m: input.massKg }
  if (tMin > input.orbit.utcMs) start = integrate(field, start, input.orbit.utcMs, { maxSeconds: (tMin - input.orbit.utcMs) / 1000 }).end
  const orbit = elements(start.r, start.v)
  if (!(orbit.e < 1) || orbit.rp < rPeri - 1e-3) {
    throw new LunarOpsError(
      `The orbit's perilune (${(orbit.rp - R_MOON).toFixed(1)} km) is below the descent orbit's (${input.pdiAltKm} km): the descent cannot choose where to come down from it.`,
    )
  }
  // Impulsive lower bound: from the apolune radius a Hohmann ellipse down to the surface, then a stop there
  // (less the speed of the turning surface, which a landing along the rotation does not have to remove).
  const aDown = 0.5 * (orbit.ra + surfaceR)
  const idealDvKms =
    Math.sqrt(MU_MOON * (2 / orbit.ra - 1 / orbit.a)) - Math.sqrt(MU_MOON * (2 / orbit.ra - 1 / aDown)) + Math.sqrt(MU_MOON * (2 / surfaceR - 1 / aDown)) - norm(siteVel(tMin))

  // Local gravity at the site, for the terminal descent's design.
  const gVec: Vec3 = [0, 0, 0]
  const s0 = site(tMin)
  field.accel(scale(s0, 1 + GATE_ALT_KM / (2 * surfaceR)), tMin, gVec)
  const g = -dot(gVec, unit(s0))

  // ---- One descent for a given DOI time: the DOI burn, the coast to the perilune, and a braking burn solver.
  const descentFrom = (tDoiMs: number) => {
    const atDoi = tDoiMs > tMin ? integrate(field, start, tMin, { maxSeconds: (tDoiMs - tMin) / 1000 }).end : start
    const doi = flyDoi(field, atDoi, tDoiMs, motor, rPeri)
    const after = elements(doi.end.r, doi.end.v)
    // Time of the perilune: coast a little first so that the stop function starts on the way down. An orbit
    // that needed no DOI burn (it is already this low) has no perilune to wait for: half a revolution on.
    const lead = integrate(field, doi.end, doi.endMs, { maxSeconds: 0.15 * after.periodS })
    const down = integrate(field, lead.end, doi.endMs + lead.endS * 1000, {
      maxSeconds: doi.run ? after.periodS : 0.35 * after.periodS,
      stop: doi.run ? (_t, s) => dot(s.r, s.v) : null,
    })
    const periS = lead.endS + down.endS
    // reference state a while before the perilune; the ignition time is counted from here
    const leadS = Math.min(600, 0.5 * periS)
    const toRef = coast(field, doi.end, doi.endMs, periS - leadS)
    const refMs = doi.endMs + toRef.endS * 1000
    const ref = toRef.end
    const n = unit(cross(ref.r, ref.v))
    const fullS = burnSeconds(motor, ref.m, 1.1 * norm(down.end.v), 1) // rough burn length at full thrust

    /** x = [a, B, c, D, burn length as seconds at full flow, ignition seconds after the reference], at throttle
     *  setting k. The burn lasts x[4]/k; pitch tangent = a + B t/T and yaw tangent = c + D t/T with T = fullS/k. */
    const fly = (x: number[], k: number): Braking | null => {
      const [a, B, c, D, flowS, waitS] = x
      if (!(waitS >= 0) || !(flowS > 1) || flowS * motor.flowKgS > 0.97 * ref.m) return null
      const rate = k / fullS
      return attempt(() => {
        const wait = coast(field, ref, refMs, waitS)
        const pdiMs = refMs + wait.endS * 1000
        const burn = integrate(field, wait.end, pdiMs, {
          maxSeconds: flowS / k,
          maxStepS: BURN_STEP_S,
          engine: burning(motor, k, tangentSteering(n, -1, a, B * rate, c, D * rate)),
        })
        if (!(norm(burn.end.r) > 0.5 * surfaceR)) return null
        return { coast: wait, burn, pdiMs, endMs: pdiMs + burn.endS * 1000 }
      })
    }
    /** The site moved toward the orbit plane: lambda 0 = its projection into the plane, 1 = the site itself. */
    const siteToward = (lambda: number) => (utcMs: number): Vec3 => {
      const S = site(utcMs)
      if (lambda === 1) return S
      const off = dot(S, n)
      return scale(unit(sub(S, scale(n, off * (1 - lambda)))), norm(S))
    }
    /** Gate conditions for the full problem: position and velocity relative to the gate above the site. */
    const gateMiss = (lambda: number, k: number) => (x: number[]): number[] | null => {
      const b = fly(x, k)
      if (!b) return null
      const plan = designTerminal(motor, b.burn.end.m, g)
      if (!plan) return null
      const at = siteToward(lambda)
      const S = at(b.endMs)
      const up = unit(S)
      const along = unit(cross(n, up))
      const side = cross(up, along)
      const dr = sub(b.burn.end.r, scale(S, 1 + GATE_ALT_KM / norm(S)))
      const dv = add(sub(b.burn.end.v, velocityOf(at)(b.endMs)), scale(up, plan.gateSpeedKms))
      return [dot(dr, along) / POS_TOL_KM, dot(dr, up) / POS_TOL_KM, dot(dr, side) / POS_TOL_KM, dot(dv, along) / VEL_TOL_KMS, dot(dv, up) / VEL_TOL_KMS, dot(dv, side) / VEL_TOL_KMS]
    }
    /** The same in the orbit plane with the range left free and the ignition at the perilune: height, sink
     *  rate and horizontal speed only. y = [a, B, burn length as seconds at full flow]. */
    const gateMissFreeRange = (k: number) => (y: number[]): number[] | null => {
      const b = fly([y[0], y[1], 0, 0, y[2], leadS], k)
      if (!b) return null
      const plan = designTerminal(motor, b.burn.end.m, g)
      if (!plan) return null
      const up = unit(b.burn.end.r)
      const along = unit(cross(n, up))
      const w = sub(b.burn.end.v, siteVel(b.endMs))
      return [(norm(b.burn.end.r) - surfaceR - GATE_ALT_KM) / POS_TOL_KM, dot(w, along) / VEL_TOL_KMS, (dot(w, up) + plan.gateSpeedKms) / VEL_TOL_KMS]
    }
    const solveFree = (k: number, guess: number[]) => newton(gateMissFreeRange(k), guess, H3, [0.3, 0.5, 0.15 * fullS])
    return { doi, ref, refMs, n, leadS, fullS, fly, gateMiss, solveFree }
  }

  // ---- Which throttle setting, and a first solution. The burn is solved with the range free; an engine far
  // stronger than the descent needs is first solved at a setting that gives a moderate deceleration (a
  // stepping stone, whether or not the engine can run there) and followed up to the settings it has.
  const H3 = [1e-4, 1e-4, 1e-2]
  let tDoiMs = tMin
  let d = descentFrom(tDoiMs)
  const family = new ThrottleFamily((k, guess) => d.solveFree(k, guess))
  const kEasy = Math.min(1, (EASY_ACCEL_KMS2 * 1000 * d.ref.m) / motor.thrustN)
  for (const [a, B] of [[0, 0.8], [-0.2, 1.2], [0.2, 0.5], [-0.5, 2], [0.5, 0.3], [0, 2.5], [-1, 3]]) {
    const sol = d.solveFree(kEasy, [a, B, 1.02 * d.fullS])
    if (sol) {
      family.add(kEasy, sol)
      break
    }
  }
  const noDescent = () =>
    new LunarOpsError(
      `${lander.name}: no powered descent from a perilune of ${Number(input.pdiAltKm.toFixed(1))} km was found with this engine: thrust ${(motor.thrustN / 1000).toFixed(0)} kN ` +
        `at ${input.massKg.toFixed(0)} kg, ${(motor.thrustN / (input.massKg * g * 1000)).toFixed(2)} times the weight on the Moon.`,
    )
  const throttle = bestThrottle((k) => {
    const x = family.at(k)
    return x ? d.ref.m - x[2] * motor.flowKgS : -Infinity
  }, motor.throttleMin)
  let free = family.at(throttle)
  if (!free) throw noDescent()

  // ---- When to start. The DOI time is moved until a braking burn that begins at the perilune ends over the
  // site (in the orbit plane; the cross-range comes later).
  let arc = 0
  for (let pass = 0; ; pass++) {
    const b = d.fly([free[0], free[1], 0, 0, free[2], d.leadS], throttle)!
    const endHat = unit(b.burn.end.r)
    arc = Math.abs(signedAngle(unit(b.burn.r[0]), endHat, d.n))
    const S = site(b.endMs)
    const inPlane = unit(sub(S, scale(d.n, dot(S, d.n))))
    let ahead = signedAngle(endHat, inPlane, d.n) // > 0: the site is further along the orbit than the burn's end
    if (pass === 0 && ahead < 0) ahead += 2 * Math.PI
    if (Math.abs(ahead) < 3e-4) break
    if (pass >= 12) throw new LunarOpsError('The descent timing did not settle on a pass over the site.')
    tDoiMs += ((ahead * orbit.periodS) / (2 * Math.PI)) * 1000
    if (tDoiMs < tMin) tDoiMs += orbit.periodS * 1000
    d = descentFrom(tDoiMs)
    free = d.solveFree(throttle, free)
    if (!free) throw noDescent()
  }

  // ---- Cross-range. How far the site is from the orbit plane when the lander arrives, against what the
  // braking burn can steer out.
  const endMs0 = d.refMs + (d.leadS + free[2] / throttle) * 1000
  const crossAtLanding = asinSafe(dot(unit(site(endMs0)), d.n))
  const crossRangeDeg = deg(Math.abs(asinSafe(dot(unit(site(tDoiMs)), unit(cross(d.doi.end.r, d.doi.end.v))))))
  if (Math.abs(crossAtLanding) > MAX_CROSS_FRACTION * arc) {
    throw new LunarOpsError(
      `The site is ${deg(Math.abs(crossAtLanding)).toFixed(1)}° off the orbit plane at this pass; the braking burn (${deg(arc).toFixed(1)}° long) can steer out about ` +
        `${deg(MAX_CROSS_FRACTION * arc).toFixed(1)}°. The site is not reachable from this orbit now.`,
    )
  }

  // ---- The full problem: six unknowns, six gate conditions. The site is first taken in the orbit plane,
  // then moved out to where it is, in as few steps as the solver accepts.
  const H6 = [1e-4, 1e-4, 1e-4, 1e-4, 1e-2, 1e-2]
  const CAP6 = [0.3, 0.5, 0.3, 0.5, 0.15 * d.fullS, 30]
  const flat = newton(d.gateMiss(0, throttle), [free[0], free[1], 0, 0, free[2], d.leadS], H6, CAP6)
  if (!flat) throw new LunarOpsError(`${lander.name}: the braking burn could not be aimed at the site.`)
  const x = follow((lambda, guess) => newton(d.gateMiss(lambda, throttle), guess, H6, CAP6), 0, flat, 1)
  if (!x) throw new LunarOpsError(`${lander.name}: the braking burn could not steer out the cross-range of ${deg(Math.abs(crossAtLanding)).toFixed(1)}°.`)
  const braking = d.fly(x, throttle)!
  const inPlaneBurn = d.fly(flat, throttle)!
  const atGate = braking.burn.end
  const plan = designTerminal(motor, atGate.m, g)!

  // ---- Terminal descent to the surface. A throttleable engine burns down to the ground. A fixed-thrust one
  // is cut off when the sink rate has come down to CUTOFF_SINK_KMS, a hand's breadth above the ground, and the
  // lander drops the rest: timing a fixed thrust to reach zero speed exactly at
  // zero height would leave millimetres of margin.
  const up = (utcMs: number) => unit(site(utcMs))
  const terminal = integrate(field, atGate, braking.endMs, {
    maxSeconds: 20 * plan.seconds + 60,
    maxStepS: Math.min(0.5, plan.seconds / 20),
    engine: terminalEngine(field, site, motor, braking.endMs, plan),
    stop: plan.fixedThrust
      ? (_t, s, utcMs) => Math.max(surfaceR - norm(s.r), dot(sub(s.v, siteVel(utcMs)), up(utcMs)) + CUTOFF_SINK_KMS)
      : (_t, s) => surfaceR - norm(s.r),
  })
  if (!terminal.stopped) throw new LunarOpsError(`${lander.name}: the terminal descent did not reach the surface.`)
  const cutoffMs = braking.endMs + terminal.endS * 1000
  const drop = norm(terminal.end.r) - surfaceR > 1e-9 ? integrate(field, terminal.end, cutoffMs, { maxSeconds: 600, maxStepS: 0.5, stop: (_t, s) => surfaceR - norm(s.r) }) : null
  if (drop && !drop.stopped) throw new LunarOpsError(`${lander.name}: the terminal descent did not reach the surface.`)
  const touchdownMs = drop ? cutoffMs + drop.endS * 1000 : cutoffMs
  const down = drop ? drop.end : terminal.end

  // ---- Checks: above the surface all the way, and within the propellant on board.
  for (const run of [braking.burn, terminal]) {
    for (let i = 0; i < run.r.length - 1; i++) {
      if (norm(run.r[i]) < surfaceR - 1e-6) throw new LunarOpsError(`${lander.name}: the powered descent from ${input.pdiAltKm} km would pass below the surface before the site.`)
    }
  }
  const usedKg = input.massKg - down.m
  if (usedKg > propellantKg) {
    throw new LunarOpsError(
      `Not enough propellant for the descent: it takes ${usedKg.toFixed(0)} kg, the ${stage.name} has ${propellantKg.toFixed(0)} kg usable (short by ${(usedKg - propellantKg).toFixed(0)} kg).`,
    )
  }

  // ---- Path and events.
  const pb = new PathBuilder()
  if (d.doi.run) pb.add(d.doi.run, tDoiMs, true)
  pb.add(coast(field, d.doi.end, d.doi.endMs, (d.refMs - d.doi.endMs) / 1000), d.doi.endMs, false)
  pb.add(braking.coast, d.refMs, false)
  pb.add(braking.burn, braking.pdiMs, true)
  pb.add(terminal, braking.endMs, true)
  if (drop) pb.add(drop, cutoffMs, false)

  const S = site(touchdownMs)
  const dvDoi = dvOf(motor, input.massKg, d.doi.end.m)
  const dvPowered = dvOf(motor, d.doi.end.m, down.m)
  // Undocking: half a revolution before the DOI (time to move clear of the other spacecraft), or at the given
  // orbit state when that is later.
  const undockMs = Math.min(tDoiMs, Math.max(input.orbit.utcMs, tDoiMs - 0.5 * orbit.periodS * 1000))
  const events: LunarEvent[] = [{ utcMs: undockMs, id: 'undocking', label: 'Undocking', massAfterKg: input.massKg }]
  if (d.doi.run) {
    events.push({
      utcMs: tDoiMs, id: 'doi', label: 'Descent Orbit Insertion (DOI)', dvKms: dvDoi, propellantKg: input.massKg - d.doi.end.m, durationS: d.doi.run.endS, massAfterKg: d.doi.end.m,
    })
  }
  events.push(
    {
      utcMs: braking.pdiMs, id: 'pdi', label: 'Powered Descent Initiation (PDI)', dvKms: dvPowered, propellantKg: d.doi.end.m - down.m,
      durationS: (cutoffMs - braking.pdiMs) / 1000, massAfterKg: down.m,
    },
    { utcMs: braking.endMs, id: 'terminal-descent', label: 'Terminal descent', durationS: (touchdownMs - braking.endMs) / 1000 },
    { utcMs: touchdownMs, id: 'touchdown', label: 'Touchdown', massAfterKg: down.m },
  )
  return {
    path: pb.finish(),
    events,
    touchdownMs,
    massAtTouchdownKg: down.m,
    propellantLeftKg: propellantKg - usedKg,
    missM: norm(sub(down.r, S)) * 1000,
    touchdownSpeedMs: norm(sub(down.v, siteVel(touchdownMs))) * 1000,
    crossRangeDeg,
    brakingThrottle: throttle,
    dvKms: { doi: dvDoi, powered: dvPowered },
    crossRangeDvKms: Math.max(0, dvOf(motor, inPlaneBurn.burn.end.m, atGate.m)),
    idealDvKms,
  }
}

// ---------------------------------------------------------------------------------------------------------
// Ascent and rendezvous
// ---------------------------------------------------------------------------------------------------------

/** The target's state at any instant after its epoch: integrated on from the nearest stored state before it. */
function trackOf(field: Field, target: OrbitState): (utcMs: number) => SimState {
  const marks: { tMs: number; s: SimState }[] = [{ tMs: target.utcMs, s: { r: target.r, v: target.v, m: 1 } }]
  return (utcMs) => {
    let from = marks[0]
    for (const mark of marks) if (mark.tMs <= utcMs && mark.tMs > from.tMs) from = mark
    if (utcMs < from.tMs) throw new LunarOpsError('The target orbit is given for a later instant than the one asked for.')
    const s = integrate(field, from.s, from.tMs, { maxSeconds: (utcMs - from.tMs) / 1000 }).end
    if (utcMs - from.tMs > 120_000) marks.push({ tMs: utcMs, s })
    return s
  }
}

/** Seconds from the apsis at radius r1 to the point an angle `sweep` further on, on the conic that leaves r1
 *  horizontally and has radius r2 there; and the horizontal speed at r1 that this conic needs. */
function transferFromApsis(r1: number, r2: number, sweep: number): { seconds: number; speedKms: number } {
  // r = p / (1 + e cos ν) with r(0) = r1 and r(sweep) = r2;  e < 0 means r1 is the apoapsis
  const eSigned = (r2 - r1) / (r1 - r2 * Math.cos(sweep))
  const e = Math.abs(eSigned)
  const a = r1 / (1 - eSigned)
  const nu = eSigned >= 0 ? sweep : Math.PI + sweep
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2))
  const M = E - e * Math.sin(E) - (eSigned >= 0 ? 0 : Math.PI)
  return { seconds: M * Math.sqrt(a ** 3 / MU_MOON), speedKms: Math.sqrt(MU_MOON * (2 / r1 - 1 / a)) }
}

interface AscentBurn {
  rise: SimRun
  burn: SimRun
  pitchoverMs: number
  endMs: number
}

/** From the insertion to TPI: a coast of half a revolution, with the plane change burn at the node when the
 *  insertion plane is not the target's. */
interface ToTpi {
  legs: { run: SimRun; t0Ms: number; thrusting: boolean }[]
  planeChange: { tMs: number; run: SimRun; before: SimState } | null
  end: SimState
  endMs: number
}

export function planAscent(input: AscentInput): AscentResult {
  const { field, site, lander } = input
  const stage = lander.modules.find((mod) => mod.engine)
  if (!stage) throw new LunarOpsError(`${lander.name} has no engine for the ascent.`)
  const motor = motorOf(stage, lander)
  const propellantKg = input.propellantKg ?? Math.min(stage.propellantKg, input.massKg - stage.dryKg)
  if (!(input.massKg > 0) || !(propellantKg > 0)) throw new LunarOpsError(`${lander.name}: no propellant for the ascent at a mass of ${input.massKg.toFixed(0)} kg.`)

  const siteVel = velocityOf(site)
  const tMin = Math.max(input.earliestMs, input.target.utcMs)
  const surfaceR = norm(site(tMin))
  const rIns = R_MOON + input.insertionAltKm.perilune
  const rApo = R_MOON + Math.max(input.insertionAltKm.apolune, input.insertionAltKm.perilune)
  if (!(rIns > surfaceR + 1)) throw new LunarOpsError(`An insertion orbit with its perilune at ${input.insertionAltKm.perilune} km does not clear the surface.`)
  const vIns = Math.sqrt(MU_MOON * (2 / rIns - 2 / (rIns + rApo))) // speed at the perilune of the insertion orbit

  const gVec: Vec3 = [0, 0, 0]
  field.accel(site(tMin), tMin, gVec)
  const g = norm(gVec)
  const kLift = Math.max(motor.throttleMin, Math.min(1, (1.3 * g * 1000 * input.massKg) / motor.thrustN)) // lowest setting that still lifts off briskly
  if (motor.thrustN / input.massKg / 1000 < 1.05 * g) {
    throw new LunarOpsError(`${lander.name} cannot lift off: thrust ${(motor.thrustN / 1000).toFixed(0)} kN against a weight of ${(input.massKg * g).toFixed(0)} kN on the Moon.`)
  }

  const targetAt = trackOf(field, input.target)
  const atMin = targetAt(tMin)
  const targetOrbit = elements(atMin.r, atMin.v)
  if (!(targetOrbit.e < 1) || targetOrbit.rp < rIns) throw new LunarOpsError('The target orbit does not stay above the insertion orbit.')
  // Impulsive lower bound: from the surface (moving with the Moon's rotation) onto a Hohmann ellipse up to the
  // target's mean radius, and the burn that makes the orbit circular there.
  const aUp = 0.5 * (surfaceR + targetOrbit.a)
  const idealDvKms =
    Math.sqrt(MU_MOON * (2 / surfaceR - 1 / aUp)) - norm(siteVel(tMin)) + Math.sqrt(MU_MOON / targetOrbit.a) - Math.sqrt(MU_MOON * (2 / targetOrbit.a - 1 / aUp))

  // ---- The ascent for a given liftoff time, orbit plane (normal n) and throttle setting k.
  const fullS = burnSeconds(motor, input.massKg, 1.08 * vIns, 1) // rough burn length at full thrust
  const ascentFrom = (liftoffMs: number, n: Vec3, k: number) => {
    const s0: SimState = { r: site(liftoffMs), v: siteVel(liftoffMs), m: input.massKg }
    // vertical rise: thrust along the local vertical until the radial rate is RISE_SPEED_KMS
    const rise = integrate(field, s0, liftoffMs, {
      maxSeconds: 900,
      maxStepS: 1,
      engine: burning(motor, k, (_t, s) => unit(s.r)),
      stop: (_t, s) => dot(s.v, s.r) / norm(s.r) - RISE_SPEED_KMS,
    })
    const pitchoverMs = liftoffMs + rise.endS * 1000
    const rate = k / fullS
    /** x = [a, B, c, D, burn length as seconds at full flow]: pitch tangent = a + B t/T above the horizon, yaw
     *  tangent = c + D t/T out of the plane, T = fullS/k. */
    const fly = (x: number[]): AscentBurn | null => {
      const [a, B, c, D, flowS] = x
      if (!rise.stopped || !(flowS > 1) || (rise.endS * k + flowS) * motor.flowKgS > 0.97 * input.massKg) return null
      return attempt(() => {
        const burn = integrate(field, rise.end, pitchoverMs, {
          maxSeconds: flowS / k,
          maxStepS: BURN_STEP_S,
          engine: burning(motor, k, tangentSteering(n, 1, a, B * rate, c, D * rate)),
        })
        if (!(norm(burn.end.r) > 0.5 * surfaceR)) return null
        return { rise, burn, pitchoverMs, endMs: pitchoverMs + burn.endS * 1000 }
      })
    }
    /** Insertion conditions: perilune radius, no radial speed, the insertion speed along the orbit, and position
     *  and velocity in the plane. */
    const miss = (x: number[]): number[] | null => {
      const b = fly(x)
      if (!b) return null
      const e = b.burn.end
      const up = unit(e.r)
      const along = unit(cross(n, up))
      return [(norm(e.r) - rIns) / POS_TOL_KM, dot(e.v, up) / VEL_TOL_KMS, (dot(e.v, along) - vIns) / VEL_TOL_KMS, dot(e.r, n) / POS_TOL_KM, dot(e.v, n) / VEL_TOL_KMS]
    }
    return { fly, miss }
  }
  const H5 = [1e-4, 1e-4, 1e-4, 1e-4, 1e-2]
  const CAP5 = [0.3, 0.5, 0.3, 0.5, 0.15 * fullS]
  const solveAscent = (liftoffMs: number, n: Vec3, k: number, guess: number[]) => newton(ascentFrom(liftoffMs, n, k).miss, guess, H5, CAP5)
  /** The plane through the site nearest to the plane of normal n: an ascent into it has nothing to steer out. */
  const planeThroughSite = (liftoffMs: number, n: Vec3): Vec3 => {
    const sHat = unit(site(liftoffMs))
    return unit(sub(n, scale(sHat, dot(n, sHat))))
  }
  /** From a solution in the plane through the site to the plane of normal n, in as few steps as the solver accepts. */
  const turnInto = (liftoffMs: number, n: Vec3, k: number, flat: number[]): number[] | null => {
    const nSite = planeThroughSite(liftoffMs, n)
    return follow((lambda, guess) => solveAscent(liftoffMs, unit(add(scale(nSite, 1 - lambda), scale(n, lambda))), k, guess), 0, flat, 1)
  }

  // ---- Which throttle setting, and a first solution: in the plane through the site at the earliest liftoff
  // time. As for the descent, an engine far stronger than needed is first solved at a moderate setting.
  const nSite0 = planeThroughSite(tMin, targetOrbit.normal)
  const family = new ThrottleFamily((k, guess) => solveAscent(tMin, nSite0, k, guess))
  const kEasy = Math.min(1, (EASY_ACCEL_KMS2 * 1000 * input.massKg) / motor.thrustN)
  for (const [a, B] of [[0.8, -0.7], [1.2, -1], [0.5, -0.4], [2, -1.8], [0.3, -0.2], [3, -2.5]]) {
    const sol = solveAscent(tMin, nSite0, kEasy, [a, B, 0, 0, 1.02 * fullS])
    if (sol) {
      family.add(kEasy, sol)
      break
    }
  }
  const throttle = bestThrottle((k) => {
    const x = family.at(k)
    const b = x ? ascentFrom(tMin, nSite0, k).fly(x) : null
    return b ? b.burn.end.m : -Infinity
  }, kLift)
  const flat0 = family.at(throttle)
  if (!flat0) {
    throw new LunarOpsError(
      `${lander.name}: no ascent to a perilune of ${Number(input.insertionAltKm.perilune.toFixed(1))} km was found with this engine: thrust ${(motor.thrustN / 1000).toFixed(0)} kN ` +
        `at ${input.massKg.toFixed(0)} kg, ${(motor.thrustN / (input.massKg * g * 1000)).toFixed(2)} times the weight on the Moon.`,
    )
  }

  // ---- How much of a plane offset to steer out during the ascent. Steering costs about κ y²/(T² Δv) for a
  // sideways distance y (T the burn length, Δv its size; κ ≈ 7.3 fitted to this law's own results), a
  // plane change in orbit costs the orbital speed times the angle. The first grows with the square, the
  // second in proportion: steer out up to the angle where they cost the same per degree, and leave the rest
  // to a plane change burn a quarter revolution after liftoff, where the two planes cross.
  const burnS = flat0[4] / throttle
  const dvFlat = dvOf(motor, input.massKg, input.massKg - flat0[4] * motor.flowKgS)
  const steerLimit = Math.min(
    (vIns * burnS * burnS * dvFlat) / (2 * STEER_COST * surfaceR * surfaceR),
    (0.25 * vIns * burnS) / (2 * surfaceR), // and never more than a quarter of the ascent's own arc
  )

  /** The plane the ascent flies into at this liftoff time, and the wedge left between it and the target's. */
  const insertionPlane = (liftoffMs: number, nTarget: Vec3): { n: Vec3; wedge: number } => {
    const sHat = unit(site(liftoffMs))
    const off = asinSafe(dot(sHat, nTarget))
    // an offset up to half again the limit is steered out whole: the burn for the rest would be a blip
    const steer = Math.abs(off) <= 1.5 * steerLimit ? off : Math.sign(off) * steerLimit
    const wedge = off - steer
    if (wedge === 0) return { n: nTarget, wedge }
    // turn the target's plane about the node, the point of it a quarter revolution downrange of the site
    const node = unit(cross(nTarget, sHat))
    const plus = rotateAbout(nTarget, node, wedge)
    const minus = rotateAbout(nTarget, node, -wedge)
    const n = Math.abs(asinSafe(dot(sHat, plus)) - steer) < Math.abs(asinSafe(dot(sHat, minus)) - steer) ? plus : minus
    return { n, wedge }
  }
  /** Coast from the insertion to TPI half a revolution later. With a wedge between the planes: the burn that
   *  turns the velocity into the target's plane, centred on the node. */
  const flyToTpi = (inserted: SimState, insMs: number, nTarget: Vec3, wedge: number): ToTpi => {
    const halfRev = 0.5 * elements(inserted.r, inserted.v).periodS
    const tpiMs = insMs + halfRev * 1000
    const plain = (): ToTpi => {
      const run = coast(field, inserted, insMs, halfRev)
      return { legs: [{ run, t0Ms: insMs, thrusting: false }], planeChange: null, end: run.end, endMs: tpiMs }
    }
    if (wedge === 0) return plain()
    const side = Math.sign(dot(inserted.r, nTarget))
    const toNode = integrate(field, inserted, insMs, { maxSeconds: halfRev, stop: (_t, s) => -side * dot(s.r, nTarget) })
    if (!toNode.stopped) return plain()
    const vNode = toNode.end.v
    const inPlane = sub(vNode, scale(nTarget, dot(vNode, nTarget)))
    const dv = sub(scale(inPlane, norm(vNode) / norm(inPlane)), vNode) // same speed, direction in the target's plane
    const k = trimThrottle(motor, inserted.m, norm(dv))
    const half = 0.5 * burnSeconds(motor, inserted.m, norm(dv), k)
    if (toNode.endS <= half) return plain()
    const before = coast(field, inserted, insMs, toNode.endS - half)
    const pcMs = insMs + before.endS * 1000
    const burn = burnAlong(field, motor, before.end, pcMs, dv, k)
    const burnEndMs = pcMs + burn.endS * 1000
    const afterBurn = coast(field, burn.end, burnEndMs, (tpiMs - burnEndMs) / 1000)
    return {
      legs: [{ run: before, t0Ms: insMs, thrusting: false }, { run: burn, t0Ms: pcMs, thrusting: true }, { run: afterBurn, t0Ms: burnEndMs, thrusting: false }],
      planeChange: { tMs: pcMs, run: burn, before: before.end },
      end: afterBurn.end,
      endMs: tpiMs,
    }
  }

  // ---- When to lift off. The liftoff time is moved until the target is where the rendezvous needs it: TPI
  // half a revolution after the insertion (at the apolune), then TRANSFER_ANGLE around the Moon to the target.
  const noAscent = (tMs: number, nTarget: Vec3) =>
    new LunarOpsError(
      `${lander.name}: no ascent toward the target's orbit plane was found; the site is ${deg(Math.abs(asinSafe(dot(unit(site(tMs)), nTarget)))).toFixed(1)}° off that plane at liftoff.`,
    )
  let liftoffMs = tMin
  let flat = flat0 // solution in the plane through the site, for the liftoff time at hand
  let xAscent = flat0
  let nTarget = targetOrbit.normal
  let plane = { n: nTarget, wedge: 0 }
  let toTpi!: ToTpi
  let arrivalMs = 0
  let dvGuess: Vec3 = [0, 0, 0]
  for (let pass = 0; ; pass++) {
    const tgt = targetAt(liftoffMs)
    nTarget = unit(cross(tgt.r, tgt.v))
    plane = insertionPlane(liftoffMs, nTarget)
    const flatNow = solveAscent(liftoffMs, planeThroughSite(liftoffMs, plane.n), throttle, flat)
    if (!flatNow) throw noAscent(liftoffMs, nTarget)
    flat = flatNow
    const turned = turnInto(liftoffMs, plane.n, throttle, flat)
    if (!turned) throw noAscent(liftoffMs, nTarget)
    xAscent = turned
    const asc = ascentFrom(liftoffMs, plane.n, throttle).fly(xAscent)!
    toTpi = flyToTpi(asc.burn.end, asc.endMs, nTarget, plane.wedge)
    // the transfer's length: a conic that leaves the apolune horizontally and meets the target's radius
    const r1 = norm(toTpi.end.r)
    let transfer = transferFromApsis(r1, targetOrbit.a, TRANSFER_ANGLE)
    for (let i = 0; i < 3; i++) transfer = transferFromApsis(r1, norm(targetAt(toTpi.endMs + transfer.seconds * 1000).r), TRANSFER_ANGLE)
    arrivalMs = toTpi.endMs + transfer.seconds * 1000
    dvGuess = scale(toTpi.end.v, transfer.speedKms / norm(toTpi.end.v) - 1)
    const nLander = unit(cross(toTpi.end.r, toTpi.end.v))
    const meet = rotateAbout(unit(toTpi.end.r), nLander, TRANSFER_ANGLE)
    let ahead = signedAngle(meet, unit(targetAt(arrivalMs).r), nLander) // > 0: the target is past the meeting point
    // a target that is ahead asks for an earlier liftoff; on the first pass only later ones are allowed
    if (pass === 0 && ahead > 0) ahead -= 2 * Math.PI
    if (Math.abs(ahead) < 2e-4) break
    if (pass >= 12) throw new LunarOpsError('The liftoff time did not settle on a rendezvous.')
    liftoffMs -= ((ahead * targetOrbit.periodS) / (2 * Math.PI)) * 1000
    if (liftoffMs < tMin) liftoffMs += targetOrbit.periodS * 1000
  }
  const ascent = ascentFrom(liftoffMs, plane.n, throttle).fly(xAscent)!
  const inserted = ascent.burn.end
  const tpiMs = toTpi.endMs
  const atTpi = toTpi.end
  const flatEnd = ascentFrom(liftoffMs, planeThroughSite(liftoffMs, plane.n), throttle).fly(flat)!.burn.end.m

  // ---- Rendezvous: TPI at the apolune, coast, TPF at the target. Unknowns: the two velocity changes as
  // vectors; each burn holds its direction and lasts as long as the rocket equation says for its size.
  const kTpi = trimThrottle(motor, atTpi.m, norm(dvGuess))
  // the target a minute before the arrival: every later state is integrated on from here
  const targetNear = trackOf(field, { utcMs: arrivalMs - 60_000, ...targetAt(arrivalMs - 60_000) })
  const targetAtArrival = targetNear(arrivalMs)

  // first TPI alone: the coasting flight passes through the target's position at the arrival time
  const intercept = (dv1: number[]) =>
    attempt(() => {
      const b1 = burnAlong(field, motor, atTpi, tpiMs, [dv1[0], dv1[1], dv1[2]], kTpi)
      const end1Ms = tpiMs + b1.endS * 1000
      if (end1Ms >= arrivalMs) return null
      return coast(field, b1.end, end1Ms, (arrivalMs - end1Ms) / 1000).end
    })
  const HV = [1e-6, 1e-6, 1e-6]
  const CAPV = [0.05, 0.05, 0.05]
  const first = newton(
    (dv1) => {
      const end = intercept(dv1)
      return end ? sub(end.r, targetAtArrival.r).map((c) => c / RDV_POS_TOL_KM) : null
    },
    dvGuess,
    HV,
    CAPV,
  )
  if (!first) throw new LunarOpsError(`${lander.name}: the transfer to the target could not be aimed.`)
  const arrived = intercept(first)!
  const closing = sub(targetAtArrival.v, arrived.v) // velocity still to be matched at the target
  const kTpf = trimThrottle(motor, arrived.m, norm(closing))

  // then both burns: TPF is centred on the arrival time and ends at the target with no relative speed
  const rendezvous = (y: number[]) =>
    attempt(() => {
      const dv2: Vec3 = [y[3], y[4], y[5]]
      const b1 = burnAlong(field, motor, atTpi, tpiMs, [y[0], y[1], y[2]], kTpi)
      const end1Ms = tpiMs + b1.endS * 1000
      const tpfMs = arrivalMs - 0.5 * burnSeconds(motor, arrived.m, norm(dv2), kTpf) * 1000
      if (end1Ms >= tpfMs) return null
      const glide = coast(field, b1.end, end1Ms, (tpfMs - end1Ms) / 1000)
      const b2 = burnAlong(field, motor, glide.end, tpfMs, dv2, kTpf)
      const endMs = tpfMs + b2.endS * 1000
      return { b1, end1Ms, glide, tpfMs, b2, endMs, target: targetNear(endMs) }
    })
  const both = newton(
    (y) => {
      const f = rendezvous(y)
      if (!f) return null
      const dr = sub(f.b2.end.r, f.target.r)
      const dv = sub(f.b2.end.v, f.target.v)
      return [dr[0] / RDV_POS_TOL_KM, dr[1] / RDV_POS_TOL_KM, dr[2] / RDV_POS_TOL_KM, dv[0] / RDV_VEL_TOL_KMS, dv[1] / RDV_VEL_TOL_KMS, dv[2] / RDV_VEL_TOL_KMS]
    },
    [...first, ...closing],
    [...HV, ...HV],
    [...CAPV, ...CAPV],
  )
  if (!both) throw new LunarOpsError(`${lander.name}: the rendezvous burns could not be solved.`)
  const rdv = rendezvous(both)!
  const docked = rdv.b2.end

  const usedKg = input.massKg - docked.m
  if (usedKg > propellantKg) {
    throw new LunarOpsError(
      `Not enough propellant for the ascent and rendezvous: they take ${usedKg.toFixed(0)} kg, the ${stage.name} has ${propellantKg.toFixed(0)} kg usable ` +
        `(short by ${(usedKg - propellantKg).toFixed(0)} kg).`,
    )
  }

  // ---- Path and events.
  const pb = new PathBuilder()
  pb.add(ascent.rise, liftoffMs, true)
  pb.add(ascent.burn, ascent.pitchoverMs, true)
  for (const leg of toTpi.legs) pb.add(leg.run, leg.t0Ms, leg.thrusting)
  pb.add(rdv.b1, tpiMs, true)
  pb.add(rdv.glide, rdv.end1Ms, false)
  pb.add(rdv.b2, rdv.tpfMs, true)

  const pc = toTpi.planeChange
  const dvAscent = dvOf(motor, input.massKg, inserted.m)
  const dvPlane = pc ? dvOf(motor, pc.before.m, pc.run.end.m) : 0
  const dvTpi = dvOf(motor, atTpi.m, rdv.b1.end.m)
  const dvTpf = dvOf(motor, rdv.glide.end.m, docked.m)
  const events: LunarEvent[] = [
    {
      utcMs: liftoffMs, id: 'liftoff', label: 'Liftoff', dvKms: dvAscent, propellantKg: input.massKg - inserted.m, durationS: (ascent.endMs - liftoffMs) / 1000,
      massAfterKg: inserted.m,
    },
    { utcMs: ascent.endMs, id: 'insertion', label: 'Orbit insertion', massAfterKg: inserted.m },
  ]
  if (pc) {
    events.push({ utcMs: pc.tMs, id: 'plane-change', label: 'Plane change', dvKms: dvPlane, propellantKg: pc.before.m - pc.run.end.m, durationS: pc.run.endS, massAfterKg: pc.run.end.m })
  }
  events.push(
    { utcMs: tpiMs, id: 'tpi', label: 'Terminal Phase Initiation (TPI)', dvKms: dvTpi, propellantKg: atTpi.m - rdv.b1.end.m, durationS: rdv.b1.endS, massAfterKg: rdv.b1.end.m },
    {
      utcMs: rdv.tpfMs, id: 'tpf', label: 'Terminal Phase Finalization (TPF)', dvKms: dvTpf, propellantKg: rdv.glide.end.m - docked.m, durationS: rdv.b2.endS,
      massAfterKg: docked.m,
    },
    { utcMs: rdv.endMs, id: 'docking', label: 'Docking', massAfterKg: docked.m },
  )
  return {
    path: pb.finish(),
    events,
    liftoffMs,
    dockingMs: rdv.endMs,
    massAtDockingKg: docked.m,
    propellantLeftKg: propellantKg - usedKg,
    relPosM: norm(sub(docked.r, rdv.target.r)) * 1000,
    relSpeedMs: norm(sub(docked.v, rdv.target.v)) * 1000,
    planeChangeDeg: deg(Math.abs(asinSafe(dot(unit(site(liftoffMs)), nTarget)))),
    ascentThrottle: throttle,
    dvKms: { ascent: dvAscent, rendezvous: dvPlane + dvTpi + dvTpf },
    planeChangeDvKms: Math.max(0, dvOf(motor, flatEnd, inserted.m)) + dvPlane,
    idealDvKms,
  }
}
