// Near-rectilinear halo orbit (NRHO) and the transfers into it, in the ephemeris gravity field of sim.ts (Moon,
// Earth and Sun as point masses, positions from JPL DE440) with thrust-integrated burns.
//
//   Part 1  nrhoAround    the Gateway orbit (9:2 resonant L2 southern NRHO) as one ballistic path in that field
//   Part 2                tools shared by the transfers: a flight recorder, Newton and simplex solvers
//   Part 3  nrhoToLlo, lloToNrho   the lander between the NRHO and a low lunar orbit over a landing site
//   Part 4  earthToNrho   the crew spacecraft from its coast to the Moon into the NRHO (powered flyby, insertion)
//   Part 5  nrhoToEarth   the crew spacecraft from the NRHO back to Earth (NRHO departure, return powered flyby,
//                         trans-Earth coast to Entry Interface)
//
// Every transfer returns { path, events, start, end }: the flown path (positions, velocities, where the engine
// burns), one event per burn with its delta-v, propellant and duration, and the states at both ends, so that a
// mission is built by handing the end of one piece to the next. Burns are integrated at the given thrust and
// specific impulse; instantaneous burns are used only for the first guess of each solution.
//
// Frames and units: Moon-centred J2000 axes unless a value says otherwise; km, km/s, kg, seconds for durations,
// UTC milliseconds for instants, newtons for thrust. Not modelled: the uneven gravity of the Moon and of Earth
// (both point masses), solar radiation pressure, navigation and burn errors.
//
// Part 1: the reference orbit. The Gateway orbit is the member of the Earth–Moon L2 southern halo family whose
// period is 2/9 of the synodic month ("9:2 lunar synodic resonance"): perilune about 3,200–3,600 km from the
// centre of the Moon over the north polar region, apolune about 70,000 km over the south, 6.56 days per
// revolution. A halo orbit is periodic only in the circular restricted three-body problem (CR3BP: Earth and Moon
// on circles, no Sun). nrhoAround takes the CR3BP orbit as a first guess and corrects it by multiple shooting
// until one ballistic path in the real field stays on the orbit for the requested number of revolutions.
import { G0, MU_EARTH, MU_MOON, R_EARTH_EQ, R_MOON, SOI_MOON, ellipse, perifocal, timeFromPeriapsis, trueAnomalyAtRadius } from './astro'
import { makeBodyTable, tableState } from './nbody'
import { constantThrust, earthField, integrate, moonField } from './sim'
import type { EarthField, Field, SimRun, SimState } from './sim'
import type { FlightEphemeris, Vec3 } from './types'
import { add, cross, dot, norm, qconj, qrot, rotateAbout, scale, sub, unit } from './vec'

const DAY_MS = 86400000
const HOUR_MS = 3600000
// How far from the ends of the ephemeris a gravity field may be asked for. A field reads the bodies from a table
// that reaches two 30-minute samples past its span (nbody.ts), and the ephemeris takes the Moon's position from
// samples 10 minutes either side of an instant (ephemeris.ts): 1 h 40 min at the worst, 2 h here.
const EDGE_MS = 2 * HOUR_MS

/** Thrown when an orbit or a transfer cannot be found; the message says which step failed and why. */
export class NrhoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NrhoError'
  }
}

// ---------- CR3BP first guess ----------

// Two neighbouring members of the Earth–Moon L2 southern halo family from the JPL Three-Body Periodic Orbits
// catalogue, https://ssd-api.jpl.nasa.gov/periodic_orbits.api?sys=earth-moon&family=halo&libr=2&branch=S&periodmin=6.5&periodmax=6.62&periodunits=d
// (documentation: https://ssd.jpl.nasa.gov/tools/periodic_orbits.html). State at the apolune, where the orbit
// crosses the plane y = 0 at right angles: position (x, 0, z) and velocity (0, vy, 0) in the rotating frame with
// the origin at the Earth–Moon barycentre, in the catalogue's units (LUNIT km, TUNIT s). Their periods bracket
// the 9:2 resonant period; the first guess is the linear interpolation between them at that period.
const JPL_MASS_RATIO = 1.215058560962404e-2
const JPL_LUNIT_KM = 389703.264829278
const JPL_TUNIT_S = 382981.289129055
const JPL_HALO_A = { x: 1.01983025819651, z: -0.18054200495908329, vy: -0.098433062793150825, period: 1.4821964514185084 }
const JPL_HALO_B = { x: 1.0196625817475922, z: -0.18041918731575562, vy: -0.098059824670690757, period: 1.4799795545729917 }

// Mean synodic month, 29.530588853 days: https://eclipse.gsfc.nasa.gov/SEhelp/moonorbit.html
const SYNODIC_MONTH_S = 29.530588853 * 86400
/** Period of the 9:2 resonant orbit: nine revolutions in two synodic months, 6.5624 days. */
export const NRHO_PERIOD_S = (2 / 9) * SYNODIC_MONTH_S

// Perilune passages of the reference orbit fall near a fixed grid, PERILUNE_REF_MS + k periods, so that two
// calls describe orbits in the same phase (to within an hour; the same orbit only when the spans are the same).
// The phase of the grid is a free choice made here. It is not the phase of the Gateway reference trajectory of
// NASA, which is chosen to avoid eclipses by Earth; nrhoAround takes another reference instant as an argument.
const PERILUNE_REF_MS = Date.UTC(2027, 0, 1)
const SEGMENTS_PER_REV = 4
const PAD_REVS = 2
const FIELD_MARGIN_MS = 12 * DAY_MS

interface Node {
  tMs: number
  x: Float64Array // r (km), v (km/s), Moon-centred J2000
}

/** The CR3BP orbit at the phases (j + ½) / n of a revolution counted from the perilune, j = 0 … n − 1: position
 *  relative to the Moon and velocity in the rotating frame, both in CR3BP units (Earth–Moon distance, and that
 *  distance times the Moon's angular rate). */
function cr3bpGuess(n: number): { rho: Vec3; rhoDot: Vec3 }[] {
  const f = (NRHO_PERIOD_S / JPL_TUNIT_S - JPL_HALO_B.period) / (JPL_HALO_A.period - JPL_HALO_B.period)
  const mix = (a: number, b: number) => b + f * (a - b)
  const L = JPL_LUNIT_KM
  const w = 1 / JPL_TUNIT_S // angular rate of the rotating frame, rad/s
  const mu = JPL_MASS_RATIO
  const gm = L * L * L * w * w // GM of Earth plus Moon in the catalogue's units
  const xE = -mu * L
  const xM = (1 - mu) * L
  // Rotating frame: gravity of the two fixed bodies plus the centrifugal term as the "field", Coriolis as the
  // velocity-dependent extra acceleration.
  const field: Field = {
    centre: 'moon',
    accel(r, _t, out) {
      const dE = Math.pow((r[0] - xE) ** 2 + r[1] * r[1] + r[2] * r[2], 1.5)
      const dM = Math.pow((r[0] - xM) ** 2 + r[1] * r[1] + r[2] * r[2], 1.5)
      const kE = (gm * (1 - mu)) / dE
      const kM = (gm * mu) / dM
      out[0] = -kE * (r[0] - xE) - kM * (r[0] - xM) + w * w * r[0]
      out[1] = -(kE + kM) * r[1] + w * w * r[1]
      out[2] = -(kE + kM) * r[2]
    },
  }
  const coriolis = (_tS: number, s: SimState, _utc: number, out: Vec3) => {
    out[0] = 2 * w * s.v[1]
    out[1] = -2 * w * s.v[0]
    out[2] = 0
  }
  let s: SimState = {
    r: [mix(JPL_HALO_A.x, JPL_HALO_B.x) * L, 0, mix(JPL_HALO_A.z, JPL_HALO_B.z) * L],
    v: [0, mix(JPL_HALO_A.vy, JPL_HALO_B.vy) * L * w, 0],
    m: 1,
  }
  // From the apolune (phase ½) forward in steps of 1/(2n) of a revolution; the orbit is periodic, so the phases
  // past 1 are the ones just after the perilune.
  const out: { rho: Vec3; rhoDot: Vec3 }[] = new Array(n)
  const stepS = NRHO_PERIOD_S / (2 * n)
  for (let k = 1; k < 2 * n; k++) {
    s = integrate(field, s, 0, { maxSeconds: stepS, maxStepS: 3600, extra: coriolis, tol: 1e-12 }).end
    if (k % 2 === (n % 2 === 0 ? 1 : 0)) {
      const phase2n = (n + k) % (2 * n) // phase in units of 1/(2n)
      out[(phase2n - 1) / 2] = { rho: [(s.r[0] - xM) / L, s.r[1] / L, s.r[2] / L], rhoDot: scale(s.v, 1 / (L * w)) }
    }
  }
  return out
}

/** A CR3BP state taken into the Moon-centred J2000 frame at utcMs. The axes follow the real Moon (x from Earth
 *  to the Moon, z along the Moon's orbital angular momentum, turning at the Moon's real angular rate), but
 *  lengths and speeds keep the catalogue's fixed units: the orbit is bound to the Moon and does not breathe with
 *  the Earth–Moon distance. (Scaling the guess with the instantaneous distance was tried and gives an orbit
 *  whose perilune radius swings between 2,400 and 4,400 km.) */
function rotatingToInertial(ephem: FlightEphemeris, utcMs: number, rho: Vec3, rhoDot: Vec3): Float64Array {
  const R = ephem.moonPos(utcMs)
  const V = ephem.moonVel(utcMs)
  const hVec = cross(R, V)
  const xh = unit(R)
  const zh = unit(hVec)
  const yh = cross(zh, xh)
  const w = norm(hVec) / dot(R, R)
  const along = (c: Vec3): Vec3 => [
    c[0] * xh[0] + c[1] * yh[0] + c[2] * zh[0],
    c[0] * xh[1] + c[1] * yh[1] + c[2] * zh[1],
    c[0] * xh[2] + c[1] * yh[2] + c[2] * zh[2],
  ]
  const r = scale(along(rho), JPL_LUNIT_KM)
  // velocity = velocity in the rotating frame + ω ẑ × r
  const v = add(scale(along(rhoDot), JPL_LUNIT_KM / JPL_TUNIT_S), scale(cross(zh, r), w))
  return Float64Array.of(r[0], r[1], r[2], v[0], v[1], v[2])
}

// ---------- linear algebra ----------

/** Solves A x = b (dense, n × n, row-major) by Gaussian elimination with partial pivoting; A and b are overwritten. */
function solveDense(A: Float64Array, b: Float64Array, n: number): Float64Array {
  for (let c = 0; c < n; c++) {
    let p = c
    for (let i = c + 1; i < n; i++) if (Math.abs(A[i * n + c]) > Math.abs(A[p * n + c])) p = i
    if (!(Math.abs(A[p * n + c]) > 0)) throw new NrhoError('singular linear system in the trajectory correction')
    if (p !== c) {
      for (let j = c; j < n; j++) {
        const tmp = A[c * n + j]
        A[c * n + j] = A[p * n + j]
        A[p * n + j] = tmp
      }
      const tb = b[c]
      b[c] = b[p]
      b[p] = tb
    }
    for (let i = c + 1; i < n; i++) {
      const f = A[i * n + c] / A[c * n + c]
      if (f === 0) continue
      for (let j = c; j < n; j++) A[i * n + j] -= f * A[c * n + j]
      b[i] -= f * b[c]
    }
  }
  const x = new Float64Array(n)
  for (let i = n - 1; i >= 0; i--) {
    let acc = b[i]
    for (let j = i + 1; j < n; j++) acc -= A[i * n + j] * x[j]
    x[i] = acc / A[i * n + i]
  }
  return x
}

// ---------- propagation ----------

const COAST_TOL = 1e-11
const ORBIT_STEP_S = 1800 // cap on the step along the orbit; also the spacing of the stored samples

/** Ballistic flight of the six-vector x (r, v) from t0Ms to t1Ms. */
function coast(field: Field, x: Float64Array, t0Ms: number, t1Ms: number): Float64Array {
  const s0: SimState = { r: [x[0], x[1], x[2]], v: [x[3], x[4], x[5]], m: 1 }
  const run = integrate(field, s0, t0Ms, { maxSeconds: (t1Ms - t0Ms) / 1000, maxStepS: ORBIT_STEP_S, tol: COAST_TOL })
  const e = run.end
  return Float64Array.of(e.r[0], e.r[1], e.r[2], e.v[0], e.v[1], e.v[2])
}

// Scales that make a kilometre of position and a millimetre per second of velocity comparable in the solver.
const SCALE = [1, 1, 1, 1e-3, 1e-3, 1e-3]
// Finite-difference steps for the state transition matrix: large against the integrator's noise (about 1e-6 km
// after a segment), small against the curvature of the flow away from the perilune.
const FD_STEP = [0.5, 0.5, 0.5, 5e-6, 5e-6, 5e-6]

// ---------- the reference orbit ----------

export interface NrhoRevolution {
  /** Perilune that starts the revolution. */
  periluneMs: number
  periluneRadiusKm: number
  apoluneMs: number
  apoluneRadiusKm: number
  /** Perilune to the next perilune. */
  periodS: number
  /** Latitude of the perilune and the apolune above the Moon's equator (degrees, north positive). */
  periluneLatDeg: number
  apoluneLatDeg: number
}

export interface NrhoOrbit {
  epochMs: number
  startMs: number
  endMs: number
  /** State history, Moon-centred J2000: one sample per integration step, at most 30 minutes apart. */
  t: number[] // UTC ms
  r: Vec3[]
  v: Vec3[]
  /** Complete revolutions (perilune to perilune) inside the span, in order. */
  revolutions: NrhoRevolution[]
  /** Velocity changes that join the ballistic arcs at the patch points. The solver drives them to zero; what is
   *  left is its convergence residual, and it is the whole deterministic orbit-maintenance cost of this model. */
  corrections: { utcMs: number; dvKms: number }[]
  correctionDvKms: number
  /** Largest position gap between two arcs at a patch point, km. */
  maxPositionGapKm: number
  /** Iterations the multiple shooting took. */
  iterations: number
  /** The Moon-centred gravity field the orbit was computed in; valid a few days beyond the span on both sides. */
  field: Field
  /** Position and velocity on the orbit at utcMs (inside the span), by interpolation between the samples. */
  stateAt(utcMs: number): { r: Vec3; v: Vec3 }
}

/** The 9:2 resonant L2 southern NRHO in the ephemeris field for `revolutions` revolutions centred on epochMs.
 *  periluneRefMs sets the phase: the perilune passages fall near periluneRefMs plus whole periods of 6.5624 days.
 *  Throws NrhoError when the ephemeris does not cover the span or the correction does not converge. */
export function nrhoAround(ephem: FlightEphemeris, epochMs: number, revolutions = 6, periluneRefMs = PERILUNE_REF_MS): NrhoOrbit {
  if (!(revolutions >= 1)) throw new NrhoError('nrhoAround: at least one revolution is needed')
  const P = NRHO_PERIOD_S * 1000
  const nSeg = SEGMENTS_PER_REV
  const segMs = P / nSeg
  // Nodes sit at the phases (j + ½)/nSeg, away from the perilune where the flow is most sensitive. One
  // revolution more than asked, so that `revolutions` complete perilune-to-perilune laps fit whatever the phase.
  const core = (Math.ceil(revolutions) + 1) * nSeg
  const first0 = Math.floor((epochMs - (core * segMs) / 2 - periluneRefMs) / segMs - 0.5)
  const time0 = (i: number) => periluneRefMs + (first0 + i + 0.5) * segMs
  const covered = (tMs: number) => tMs >= ephem.startMs + EDGE_MS && tMs <= ephem.endMs - EDGE_MS
  if (!covered(time0(0)) || !covered(time0(core))) {
    throw new NrhoError(`nrhoAround: the ephemeris does not cover ${new Date(time0(0)).toISOString()} to ${new Date(time0(core)).toISOString()}`)
  }
  // The ends of the solved span are free, and the orbit is least regular there. Where the ephemeris allows, up
  // to PAD_REVS extra revolutions are solved on each side and left out of the result.
  let padBefore = PAD_REVS * nSeg
  while (padBefore > 0 && !covered(time0(-padBefore))) padBefore -= nSeg
  let padAfter = PAD_REVS * nSeg
  while (padAfter > 0 && !covered(time0(core + padAfter))) padAfter -= nSeg
  const first = first0 - padBefore
  const nSegments = padBefore + core + padAfter
  const nodeTime = (i: number) => periluneRefMs + (first + i + 0.5) * segMs
  const startMs = time0(0)
  const endMs = time0(core)
  const fieldFrom = Math.max(nodeTime(0) - FIELD_MARGIN_MS, ephem.startMs + EDGE_MS)
  const fieldTo = Math.min(nodeTime(nSegments) + FIELD_MARGIN_MS, ephem.endMs - EDGE_MS)
  const field = moonField(ephem, fieldFrom, fieldTo)

  const guess = cr3bpGuess(nSeg)
  const nodes: Node[] = []
  for (let i = 0; i <= nSegments; i++) {
    const g = guess[(((first + i) % nSeg) + nSeg) % nSeg]
    nodes.push({ tMs: nodeTime(i), x: rotatingToInertial(ephem, nodeTime(i), g.rho, g.rhoDot) })
  }

  // Multiple shooting. Unknowns: the states at all nodes. Conditions: the arc flown from node i arrives at node
  // i + 1 in position and velocity. There are six more unknowns than conditions; each Newton step takes the
  // smallest change of the nodes that removes the linearised gaps, which keeps the answer next to the first
  // guess: the bounded, nearly periodic motion, not one of the paths that leave the orbit.
  const m = 6 * nSegments
  const gaps = new Float64Array(m)
  const phi = Array.from({ length: nSegments }, () => new Float64Array(36)) // scaled state transition matrices
  const evalGaps = () => {
    let worst = 0
    for (let i = 0; i < nSegments; i++) {
      const end = coast(field, nodes[i].x, nodes[i].tMs, nodes[i + 1].tMs)
      for (let k = 0; k < 6; k++) {
        gaps[6 * i + k] = (end[k] - nodes[i + 1].x[k]) / SCALE[k]
        worst = Math.max(worst, Math.abs(gaps[6 * i + k]))
      }
    }
    return worst
  }
  let worst = evalGaps()
  let iterations = 0
  const TOL = 2e-6 // 2 mm in position, 2e-9 km/s in velocity
  for (; iterations < 30 && worst > TOL; iterations++) {
    for (let i = 0; i < nSegments; i++) {
      const x = nodes[i].x
      for (let c = 0; c < 6; c++) {
        const xp = Float64Array.from(x)
        const xm = Float64Array.from(x)
        xp[c] += FD_STEP[c]
        xm[c] -= FD_STEP[c]
        const ep = coast(field, xp, nodes[i].tMs, nodes[i + 1].tMs)
        const em = coast(field, xm, nodes[i].tMs, nodes[i + 1].tMs)
        for (let k = 0; k < 6; k++) phi[i][6 * k + c] = ((ep[k] - em[k]) / (2 * FD_STEP[c])) * (SCALE[c] / SCALE[k])
      }
    }
    // J = [Φ_i, −I] per block row. Solve (J Jᵀ) λ = −gaps, then Δ = Jᵀ λ. J Jᵀ is block tridiagonal:
    // diagonal Φ_i Φ_iᵀ + I, off-diagonal (i, i + 1): −Φ_{i+1}ᵀ.
    const A = new Float64Array(m * m)
    for (let i = 0; i < nSegments; i++) {
      const F = phi[i]
      for (let a = 0; a < 6; a++) {
        for (let b = 0; b < 6; b++) {
          let acc = a === b ? 1 : 0
          for (let k = 0; k < 6; k++) acc += F[6 * a + k] * F[6 * b + k]
          A[(6 * i + a) * m + 6 * i + b] = acc
        }
      }
      if (i + 1 < nSegments) {
        const G = phi[i + 1]
        for (let a = 0; a < 6; a++) {
          for (let b = 0; b < 6; b++) {
            A[(6 * i + a) * m + 6 * (i + 1) + b] = -G[6 * b + a]
            A[(6 * (i + 1) + b) * m + 6 * i + a] = -G[6 * b + a]
          }
        }
      }
    }
    const rhs = new Float64Array(m)
    for (let k = 0; k < m; k++) rhs[k] = -gaps[k]
    const lam = solveDense(A, rhs, m)
    for (let i = 0; i <= nSegments; i++) {
      for (let c = 0; c < 6; c++) {
        let d = 0
        if (i < nSegments) for (let k = 0; k < 6; k++) d += phi[i][6 * k + c] * lam[6 * i + k]
        if (i > 0) d -= lam[6 * (i - 1) + c]
        nodes[i].x[c] += d * SCALE[c]
      }
    }
    worst = evalGaps()
  }
  if (!(worst <= TOL)) {
    throw new NrhoError(`nrhoAround: the orbit correction did not converge (largest gap ${worst.toExponential(2)} after ${iterations} iterations)`)
  }

  // The orbit: every arc integrated from its node, joined at the nodes.
  const t: number[] = []
  const r: Vec3[] = []
  const v: Vec3[] = []
  const corrections: { utcMs: number; dvKms: number }[] = []
  let maxPositionGapKm = 0
  for (let i = padBefore; i < padBefore + core; i++) {
    const x = nodes[i].x
    const s0: SimState = { r: [x[0], x[1], x[2]], v: [x[3], x[4], x[5]], m: 1 }
    const run = integrate(field, s0, nodes[i].tMs, { maxSeconds: segMs / 1000, maxStepS: ORBIT_STEP_S, tol: COAST_TOL })
    const last = run.t.length - 1
    for (let k = i === padBefore ? 0 : 1; k < last; k++) {
      t.push(nodes[i].tMs + run.t[k] * 1000)
      r.push(run.r[k])
      v.push(run.v[k])
    }
    // The sample at the node is the next arc's start; the gap to this arc's end is the correction there.
    const nx = nodes[i + 1].x
    const rn: Vec3 = [nx[0], nx[1], nx[2]]
    const vn: Vec3 = [nx[3], nx[4], nx[5]]
    t.push(nodes[i + 1].tMs)
    r.push(rn)
    v.push(vn)
    maxPositionGapKm = Math.max(maxPositionGapKm, norm(sub(run.end.r, rn)))
    if (i + 1 < padBefore + core) corrections.push({ utcMs: nodes[i + 1].tMs, dvKms: norm(sub(vn, run.end.v)) })
  }
  const stateAt = hermite(field, t, r, v)
  return {
    epochMs,
    startMs,
    endMs,
    t,
    r,
    v,
    revolutions: revolutionsOf(ephem, t, r, v, stateAt),
    corrections,
    correctionDvKms: corrections.reduce((acc, c) => acc + c.dvKms, 0),
    maxPositionGapKm,
    iterations,
    field,
    stateAt,
  }
}

/** Interpolation of a sampled ballistic path: quintic Hermite on position, velocity and (from the field)
 *  acceleration at both ends of each step. */
function hermite(field: Field, t: number[], r: Vec3[], v: Vec3[]): (utcMs: number) => { r: Vec3; v: Vec3 } {
  const acc: (Vec3 | null)[] = new Array(t.length).fill(null)
  const accAt = (i: number): Vec3 => {
    let a = acc[i]
    if (!a) {
      a = [0, 0, 0]
      field.accel(r[i], t[i], a)
      acc[i] = a
    }
    return a
  }
  return (utcMs) => {
    const n = t.length
    if (!(utcMs >= t[0] && utcMs <= t[n - 1])) throw new NrhoError(`the orbit has no state at ${new Date(utcMs).toISOString()}: outside its span`)
    let lo = 0
    let hi = n - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (t[mid] <= utcMs) lo = mid
      else hi = mid
    }
    const h = (t[hi] - t[lo]) / 1000
    const s = (utcMs - t[lo]) / (t[hi] - t[lo])
    const s2 = s * s
    const s3 = s2 * s
    const s4 = s3 * s
    const s5 = s4 * s
    const h0 = 1 - 10 * s3 + 15 * s4 - 6 * s5
    const h1 = s - 6 * s3 + 8 * s4 - 3 * s5
    const h2 = 0.5 * s2 - 1.5 * s3 + 1.5 * s4 - 0.5 * s5
    const h3 = 0.5 * s3 - s4 + 0.5 * s5
    const h4 = -4 * s3 + 7 * s4 - 3 * s5
    const h5 = 10 * s3 - 15 * s4 + 6 * s5
    const d0 = -30 * s2 + 60 * s3 - 30 * s4
    const d1 = 1 - 18 * s2 + 32 * s3 - 15 * s4
    const d2 = s - 4.5 * s2 + 6 * s3 - 2.5 * s4
    const d3 = 1.5 * s2 - 4 * s3 + 2.5 * s4
    const d4 = -12 * s2 + 28 * s3 - 15 * s4
    const d5 = -d0
    const a0 = accAt(lo)
    const a1 = accAt(hi)
    const ro: Vec3 = [0, 0, 0]
    const vo: Vec3 = [0, 0, 0]
    for (let k = 0; k < 3; k++) {
      ro[k] = h0 * r[lo][k] + h1 * h * v[lo][k] + h2 * h * h * a0[k] + h3 * h * h * a1[k] + h4 * h * v[hi][k] + h5 * r[hi][k]
      vo[k] = (d0 * r[lo][k] + d5 * r[hi][k]) / h + d1 * v[lo][k] + d4 * v[hi][k] + (d2 * a0[k] + d3 * a1[k]) * h
    }
    return { r: ro, v: vo }
  }
}

/** Perilunes and apolunes of a sampled path (zeros of r·v, refined on the interpolant) and the laps between them. */
function revolutionsOf(
  ephem: FlightEphemeris,
  t: number[],
  r: Vec3[],
  v: Vec3[],
  stateAt: (utcMs: number) => { r: Vec3; v: Vec3 },
): NrhoRevolution[] {
  const apses: { tMs: number; radius: number; latDeg: number; peri: boolean }[] = []
  for (let i = 1; i < t.length; i++) {
    const a = dot(r[i - 1], v[i - 1])
    const b = dot(r[i], v[i])
    if (a === 0 || a * b > 0) continue
    let lo = t[i - 1]
    let hi = t[i]
    for (let it = 0; it < 50 && hi - lo > 1; it++) {
      const mid = 0.5 * (lo + hi)
      const s = stateAt(mid)
      if (dot(s.r, s.v) * a > 0) lo = mid
      else hi = mid
    }
    const tMs = 0.5 * (lo + hi)
    const s = stateAt(tMs)
    // Latitude against the Moon's spin axis at that instant.
    const pole = moonPole(ephem, tMs)
    apses.push({ tMs, radius: norm(s.r), latDeg: (Math.asin(dot(s.r, pole) / norm(s.r)) * 180) / Math.PI, peri: a < 0 })
  }
  const revs: NrhoRevolution[] = []
  for (let i = 0; i + 2 < apses.length; i++) {
    if (!apses[i].peri || apses[i + 1].peri || !apses[i + 2].peri) continue
    revs.push({
      periluneMs: apses[i].tMs,
      periluneRadiusKm: apses[i].radius,
      apoluneMs: apses[i + 1].tMs,
      apoluneRadiusKm: apses[i + 1].radius,
      periodS: (apses[i + 2].tMs - apses[i].tMs) / 1000,
      periluneLatDeg: apses[i].latDeg,
      apoluneLatDeg: apses[i + 1].latDeg,
    })
  }
  return revs
}

/** The Moon's spin axis (north), J2000 unit vector. */
function moonPole(ephem: FlightEphemeris, utcMs: number): Vec3 {
  const q = ephem.moonFixedToInertial(utcMs)
  // third column of the rotation matrix of the quaternion (x, y, z, w)
  return [2 * (q[0] * q[2] + q[1] * q[3]), 2 * (q[1] * q[2] - q[0] * q[3]), 1 - 2 * (q[0] * q[0] + q[1] * q[1])]
}

// =====================================================================================================
// Part 2: tools shared by the transfers
// =====================================================================================================

export interface TransferState {
  utcMs: number
  r: Vec3
  v: Vec3
  massKg: number
  frame: 'earth' | 'moon'
}

export interface TransferPath {
  t: number[] // UTC ms, strictly increasing
  r: Vec3[] // km, J2000 axes, origin at the centre of `frame`
  v: Vec3[] // km/s relative to the centre of `frame`
  /** thrusting[i]: the engine burns on the stretch from sample i to sample i + 1. */
  thrusting: boolean[]
  frame: 'earth' | 'moon'
}

export interface TransferEvent {
  utcMs: number // ignition (for a burn) or the instant of the event
  id: string
  label: string
  /** What the engine delivered: g0 Isp ln(mass before / mass after). Zero for an event that is not a burn. */
  dvKms: number
  propellantKg: number
  durationS: number
  massAfterKg: number
}

export interface Transfer {
  path: TransferPath
  events: TransferEvent[]
  start: TransferState
  end: TransferState
  /** Sum of the burns' delta-v. */
  dvKms: number
  /** The same transfer with instantaneous burns, the first guess of the finite-burn solution: total (km/s) and
   *  the burns as vectors, in the order of the events. */
  impulsiveDvKms: number
  impulsiveBurnsKms: Vec3[]
}

export interface EngineSpec {
  thrustN: number
  ispS: number
}

/** Burn time (s) that delivers dvKms from mass massKg: the rocket equation at constant thrust. */
function burnSeconds(engine: EngineSpec, massKg: number, dvKms: number): number {
  const ve = G0 * engine.ispS // exhaust velocity, m/s
  return ((massKg * ve) / engine.thrustN) * (1 - Math.exp((-dvKms * 1000) / ve))
}

const COAST_STEP_S = 1800
const BURN_STEP_S = 20
const SHOT_TOL = 1e-11 // step control of every flight the solvers shoot: tighter than the default, for clean differences
// A trial path of a solver may dive at the Moon's centre, where a point-mass field has no bottom and the
// integrator would crawl. Any path that comes this close to the centre is cut off and counted as failed.
const CRASH_KM = 300
const crashStop = (_tS: number, s: SimState) => CRASH_KM * CRASH_KM - dot(s.r, s.r)

/** One vehicle flown phase by phase through a field: coasts and burns, with the path and the burns recorded. */
class Flight {
  t: number[] = []
  r: Vec3[] = []
  v: Vec3[] = []
  thrusting: boolean[] = []
  events: TransferEvent[] = []
  /** Current state, in the coordinates of the field being flown (Moon-centred unless inEarthFrame). */
  s: SimState
  tMs: number
  readonly field: Field
  readonly keep: boolean
  readonly start: TransferState
  /** Set while the flight is integrated in Earth-centred coordinates (see flyToMoon). */
  private earth: EarthField | null = null
  constructor(field: Field, tMs: number, r: Vec3, v: Vec3, massKg: number, keep: boolean) {
    this.field = field
    this.keep = keep
    this.tMs = tMs
    this.s = { r: [r[0], r[1], r[2]], v: [v[0], v[1], v[2]], m: massKg }
    this.start = { utcMs: tMs, r: [r[0], r[1], r[2]], v: [v[0], v[1], v[2]], massKg, frame: 'moon' }
  }

  /** Changes the coordinates the flight is integrated in: Earth-centred with the given field, or back to
   *  Moon-centred with null. The stored path stays Moon-centred throughout. */
  frame(earth: EarthField | null) {
    if ((earth === null) === (this.earth === null)) return
    const moon = (earth ?? this.earth)!.moonState(this.tMs)
    const k = earth ? 1 : -1
    this.s = { r: add(this.s.r, scale(moon.r, k)), v: add(this.s.v, scale(moon.v, k)), m: this.s.m }
    this.earth = earth
  }

  private store(run: SimRun, t0Ms: number, powered: boolean) {
    if (!this.keep) return
    // The first sample of a phase replaces the last of the one before (same instant, same place).
    if (this.t.length) {
      this.t.pop()
      this.r.pop()
      this.v.pop()
      this.thrusting.pop()
    }
    for (let i = 0; i < run.t.length; i++) {
      const tMs = t0Ms + run.t[i] * 1000
      this.t.push(tMs)
      if (this.earth) {
        const moon = this.earth.moonState(tMs)
        this.r.push(sub(run.r[i], moon.r))
        this.v.push(sub(run.v[i], moon.v))
      } else {
        this.r.push(run.r[i])
        this.v.push(run.v[i])
      }
      this.thrusting.push(powered && i < run.t.length - 1)
    }
  }

  /** Coast for `seconds`, or until `stop` goes from negative to positive if that comes first. Returns whether it stopped. */
  coast(seconds: number, stop?: (s: SimState, utcMs: number) => number): boolean {
    if (!(seconds > 0)) return false
    const t0 = this.tMs
    const run = integrate(this.earth ?? this.field, this.s, t0, {
      maxSeconds: seconds,
      maxStepS: COAST_STEP_S,
      tol: SHOT_TOL,
      stop: stop ? (_tS, s, utcMs) => stop(s, utcMs) : this.earth ? null : crashStop,
    })
    if (!stop && run.stopped) throw new RangeError('the path runs into the Moon')
    this.store(run, t0, false)
    this.s = run.end
    this.tMs = t0 + run.endS * 1000
    return run.stopped
  }

  coastTo(utcMs: number) {
    this.coast((utcMs - this.tMs) / 1000)
  }

  /** Burn for `seconds` at full thrust along dir (a unit vector that may follow the state), or until `stop`
   *  goes from negative to positive if that comes first; returns whether it stopped. A burn that continues the
   *  previous one (same id, no coast between) is recorded as one event. */
  burn(id: string, label: string, engine: EngineSpec, dir: (s: SimState) => Vec3, seconds: number, stop?: (s: SimState) => number): boolean {
    if (!(seconds > 0)) return false
    const t0 = this.tMs
    const m0 = this.s.m
    const run = integrate(this.earth ?? this.field, this.s, t0, {
      maxSeconds: seconds,
      maxStepS: BURN_STEP_S,
      tol: SHOT_TOL,
      engine: constantThrust(engine.thrustN, engine.ispS, (_tS, s) => dir(s)),
      stop: stop ? (_tS, s) => stop(s) : null,
    })
    this.store(run, t0, true)
    this.s = run.end
    this.tMs = t0 + run.endS * 1000
    const last = this.events[this.events.length - 1]
    if (last && last.id === id && Math.abs(last.utcMs + last.durationS * 1000 - t0) < 1) {
      const before = last.massAfterKg + last.propellantKg
      last.dvKms = (G0 * engine.ispS * Math.log(before / this.s.m)) / 1000
      last.propellantKg = before - this.s.m
      last.durationS += run.endS
      last.massAfterKg = this.s.m
    } else {
      this.events.push({
        utcMs: t0,
        id,
        label,
        dvKms: (G0 * engine.ispS * Math.log(m0 / this.s.m)) / 1000,
        propellantKg: m0 - this.s.m,
        durationS: run.endS,
        massAfterKg: this.s.m,
      })
    }
    return run.stopped
  }

  state(frame: 'earth' | 'moon'): TransferState {
    if (this.earth) throw new Error('Flight.state: still in Earth-centred coordinates')
    return { utcMs: this.tMs, r: [this.s.r[0], this.s.r[1], this.s.r[2]], v: [this.s.v[0], this.s.v[1], this.s.v[2]], massKg: this.s.m, frame }
  }
}

/** The field run backwards from pivotMs: a path x(t) of `field` becomes y(τ) = x(pivot − τ), with the velocity
 *  reversed. Gravity depends on position only, so y obeys the same equation in the mirrored field. Used to shoot
 *  from an arrival point back to where the flight came from. */
function reversedField(field: Field, pivotMs: number): Field {
  return { centre: field.centre, accel: (r, utcMs, out) => field.accel(r, 2 * pivotMs - utcMs, out) }
}

// ---------- solvers ----------

type Residual = (x: number[]) => number[] | null

/** Exact key of a list of numbers: String() of a double reads back to the same double, and −0 is kept apart. */
const exactKey = (x: ArrayLike<number>): string => {
  let k = ''
  for (let i = 0; i < x.length; i++) k += (Object.is(x[i], -0) ? '-0' : String(x[i])) + ','
  return k
}

/** fn with its results kept for the arguments it has seen, compared bit for bit; for a pure fn (one shot of a
 *  solver: the same arguments fly the same path) a repeated call returns the result of the first. Solvers ask
 *  for the same point again: the converged point once more after Newton's method, the best point after the
 *  simplex search, the same starting point and difference steps for every target. At most `max` results are
 *  kept (then the store starts again). A call that throws keeps nothing and throws again the next time. */
function remembered<A extends ArrayLike<number>, R>(fn: (x: A) => R, max = 512): (x: A) => R {
  const seen = new Map<string, R>()
  return (x) => {
    const key = exactKey(x)
    if (seen.has(key)) return seen.get(key) as R
    const r = fn(x)
    if (seen.size >= max) seen.clear()
    seen.set(key, r)
    return r
  }
}

/** Jacobian of fn at x by forward differences with the steps h; rows = residuals. Null when a shot fails. */
function jacobian(fn: Residual, x: number[], f0: number[], h: number[]): number[][] | null {
  const J = f0.map(() => new Array<number>(x.length).fill(0))
  for (let j = 0; j < x.length; j++) {
    const xp = x.slice()
    xp[j] += h[j]
    const fp = fn(xp)
    if (!fp) return null
    for (let i = 0; i < f0.length; i++) J[i][j] = (fp[i] - f0[i]) / h[j]
  }
  return J
}

const FD_REL = 1e-3 // finite-difference step of the solvers, as a fraction of a variable's scale

/** Newton iteration for fn(x) = 0 with at least as many unknowns as conditions. Each step is the smallest
 *  change of x (measured in units of `scale`) that removes the linearised residual, halved until the residual
 *  shrinks. Converged when every |residual| ≤ tol. Returns null when it does not get there. */
function newton(fn: Residual, x0: number[], scale: number[], tol: number, maxIter = 40): { x: number[]; iterations: number } | null {
  const n = x0.length
  const size = (f: number[]) => f.reduce((acc, c) => Math.max(acc, Math.abs(c)), 0)
  let x = x0.slice()
  let f = fn(x)
  if (!f) return null
  const m = f.length
  for (let iter = 0; iter < maxIter; iter++) {
    if (size(f) <= tol) return { x, iterations: iter }
    const J = jacobian(fn, x, f, scale.map((s) => s * FD_REL))
    if (!J) return null
    // scaled Jacobian Js = J S; step = −S Jsᵀ (Js Jsᵀ)⁻¹ f
    const A = new Float64Array(m * m)
    for (let a = 0; a < m; a++) {
      for (let b = 0; b < m; b++) {
        let acc = 0
        for (let j = 0; j < n; j++) acc += J[a][j] * J[b][j] * scale[j] * scale[j]
        A[a * m + b] = acc
      }
    }
    let lam: Float64Array
    try {
      lam = solveDense(A, Float64Array.from(f, (c) => -c), m)
    } catch {
      return null
    }
    const dx = new Array<number>(n).fill(0)
    for (let j = 0; j < n; j++) {
      for (let a = 0; a < m; a++) dx[j] += scale[j] * scale[j] * J[a][j] * lam[a]
    }
    let accepted = false
    for (let half = 0; half < 10; half++) {
      const k = Math.pow(0.5, half)
      const xt = x.map((xi, j) => xi + k * dx[j])
      const ft = fn(xt)
      if (ft && size(ft) < size(f)) {
        x = xt
        f = ft
        accepted = true
        break
      }
    }
    if (!accepted) return null
  }
  return size(f) <= tol ? { x, iterations: maxIter } : null
}

/** Minimises f over x by the Nelder–Mead simplex method (no derivatives: f comes out of nested Newton
 *  iterations and integrations, whose small noise would spoil finite-difference gradients). `step` is the size
 *  of the first simplex along each axis; the search stops when the simplex has shrunk to `xtol` of that size or
 *  after maxEval evaluations. f may return Infinity for a point where the problem has no solution. */
function nelderMead(
  f: (x: number[]) => number,
  x0: number[],
  step: number[],
  xtol: number,
  maxEval: number,
): { x: number[]; f: number; evaluations: number } {
  const n = x0.length
  let evaluations = 0
  const at = (x: number[]) => {
    evaluations++
    return { x, f: f(x) }
  }
  let simplex = [at(x0.slice())]
  for (let i = 0; i < n; i++) {
    const x = x0.slice()
    x[i] += step[i]
    simplex.push(at(x))
  }
  const towards = (a: number[], b: number[], k: number) => a.map((q, i) => q + k * (b[i] - q))
  while (evaluations < maxEval) {
    simplex.sort((a, b) => a.f - b.f)
    const best = simplex[0]
    const worst = simplex[n]
    let spread = 0
    for (let i = 0; i < n; i++) for (const v of simplex) spread = Math.max(spread, Math.abs(v.x[i] - best.x[i]) / step[i])
    if (spread < xtol) break
    const centroid = new Array<number>(n).fill(0)
    for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) centroid[i] += simplex[k].x[i] / n
    const reflected = at(towards(worst.x, centroid, 2))
    if (reflected.f < best.f) {
      const expanded = at(towards(worst.x, centroid, 3))
      simplex[n] = expanded.f < reflected.f ? expanded : reflected
    } else if (reflected.f < simplex[n - 1].f || (n === 1 && reflected.f < worst.f)) {
      simplex[n] = reflected
    } else {
      const contracted = at(towards(worst.x, centroid, reflected.f < worst.f ? 1.5 : 0.5))
      if (contracted.f < Math.min(worst.f, reflected.f)) simplex[n] = contracted
      else simplex = simplex.map((v, k) => (k === 0 ? v : at(towards(best.x, v.x, 0.5))))
    }
  }
  simplex.sort((a, b) => a.f - b.f)
  return { x: simplex[0].x, f: simplex[0].f, evaluations }
}

// =====================================================================================================
// Part 3: the lander's transfers between the NRHO and a low lunar orbit over a landing site
// =====================================================================================================
//
// The NRHO passes the Moon every 6.56 days at about 1,600 km altitude and 1.7 km/s. A lander leaves it some
// hours before that passage with a small burn that lowers the coming perilune to the low orbit's altitude and
// turns the plane of the approach so that it passes over the landing site; at the perilune it brakes into the
// circular orbit (lunar orbit insertion). The way back is the mirror image: a burn in low orbit raises the far
// end of the orbit to meet the NRHO, a second burn there matches its velocity.
//
// Both are found in two steps. First with instantaneous burns: the three components of the burn on the NRHO
// are chosen to meet the two conditions at the perilune (its radius, the site in the orbit plane) with the
// smallest total delta-v. Then with the real engine: every burn is integrated at its thrust, and the burn
// parameters are corrected by Newton iteration until the flight ends exactly where it should.

/** Unit vector from the Moon's centre to a surface site (planetocentric latitude, east longitude; degrees) in
 *  J2000 axes at utcMs. */
export function siteDirection(ephem: FlightEphemeris, latDeg: number, lonDeg: number, utcMs: number): Vec3 {
  const la = (latDeg * Math.PI) / 180
  const lo = (lonDeg * Math.PI) / 180
  const b: Vec3 = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
  const q = ephem.moonFixedToInertial(utcMs)
  const u: Vec3 = [q[0], q[1], q[2]]
  const t = scale(cross(u, b), 2)
  return add(add(b, scale(t, q[3])), cross(u, t))
}

/** The instant to leave the NRHO for a low-orbit arrival `transferDays` later: that long before the first
 *  perilune of the NRHO that comes at least `transferDays` after notBeforeMs. */
export function nrhoDepartureMs(nrho: NrhoOrbit, notBeforeMs: number, transferDays = 0.5): number {
  const lead = transferDays * DAY_MS
  for (const rev of nrho.revolutions) if (rev.periluneMs - lead >= notBeforeMs) return rev.periluneMs - lead
  const last = nrho.revolutions[nrho.revolutions.length - 1]
  if (last && last.periluneMs + last.periodS * 1000 - lead >= notBeforeMs) return last.periluneMs + last.periodS * 1000 - lead
  throw new NrhoError(`the orbit has no perilune ${transferDays} days or more after ${new Date(notBeforeMs).toISOString()}`)
}

// A shot from the NRHO to its next perilune: at most a revolution and a bit.
const TO_PERILUNE = { maxSeconds: 8 * 86400, maxStepS: COAST_STEP_S, tol: SHOT_TOL }

interface ApsisShot {
  dv: Vec3 // burn on the NRHO, km/s
  flightS: number // from that burn to the perilune
  rp: Vec3
  vp: Vec3 // at the perilune, before the circularisation
  dvCircKms: number
  totalKms: number
}

/** Instantaneous-burn transfer from the state (r0, v0) at t0Ms to a perilune of radius rTarget in a plane that
 *  contains the direction site, with the smallest sum of the burn at the start and the circularisation at the
 *  perilune. Run in a reversed field it designs the way back. */
function apsisTransfer(field: Field, t0Ms: number, r0: Vec3, v0: Vec3, rTarget: number, site: Vec3, what: string): ApsisShot {
  const vCirc = Math.sqrt(MU_MOON / rTarget)
  const shoot = remembered((dvMs: number[]): ApsisShot | null => {
    const dv: Vec3 = [dvMs[0] / 1000, dvMs[1] / 1000, dvMs[2] / 1000]
    let run: SimRun
    try {
      run = integrate(field, { r: r0, v: add(v0, dv), m: 1 }, t0Ms, { ...TO_PERILUNE, stop: (_tS, s) => dot(s.r, s.v) })
    } catch (err) {
      if (err instanceof RangeError) return null
      throw err
    }
    if (!run.stopped || norm(run.end.r) < R_MOON) return null
    const dvCircKms = norm(run.end.v) - vCirc
    return { dv, flightS: run.endS, rp: run.end.r, vp: run.end.v, dvCircKms, totalKms: norm(dv) + Math.abs(dvCircKms) }
  })
  // conditions: perilune radius (km) and the site's distance from the orbit plane (milliradians)
  const conditions = (dvMs: number[]): number[] | null => {
    const s = shoot(dvMs)
    return s ? [norm(s.rp) - rTarget, 1000 * dot(unit(cross(s.rp, s.vp)), site)] : null
  }
  // Three starting points: no burn, and a push to either side of the orbit plane (a site far from the plane can
  // be reached by turning it either way, and from no burn at all Newton's method may not choose). From each,
  // Newton on the two conditions gives a burn that meets them. Three components and two conditions leave one
  // free direction: the burn is then moved along it (the other two components re-solved each time) to the
  // smallest total.
  const side = scale(unit(cross(r0, v0)), 40)
  let best: ApsisShot | null = null
  for (const start of [[0, 0, 0], side, scale(side, -1)]) {
    const first = newton(conditions, start, [1, 1, 1], 1e-4)
    const c0 = first && conditions(first.x)
    const J = first && c0 && jacobian(conditions, first.x, c0, [1e-3, 1e-3, 1e-3])
    if (!first || !J) continue
    const free = unit(cross(J[0] as Vec3, J[1] as Vec3)) // the direction that changes neither condition, to first order
    const e1 = unit(J[0] as Vec3)
    const e2 = unit(cross(free, e1))
    const along = remembered((kk: number[]): ApsisShot | null => {
      const base = add(first.x as Vec3, scale(free, kk[0]))
      const sol = newton((y) => conditions(add(base, add(scale(e1, y[0]), scale(e2, y[1])))), [0, 0], [1, 1], 1e-4)
      return sol ? shoot(add(base, add(scale(e1, sol.x[0]), scale(e2, sol.x[1])))) : null
    })
    const opt = nelderMead((k) => along(k)?.totalKms ?? Infinity, [0], [5], 0.01, 40)
    const s = along(opt.x)
    if (s && (!best || s.totalKms < best.totalKms)) best = s
  }
  if (!best) throw new NrhoError(`${what}: no path from the NRHO reaches a ${(rTarget - R_MOON).toFixed(0)} km perilune in a plane over the site`)
  return best
}

/** For tests: the cost (km/s) of the instantaneous-burn NRHO → low-orbit transfer when the component of the
 *  departure burn along `axis` is held at alongKms and the other two are solved to meet the two conditions;
 *  null when they cannot be met. The optimum found by nrhoToLlo must not be beaten by any such neighbour. */
export function constrainedApsisCost(
  nrho: NrhoOrbit,
  departMs: number,
  siteDir: Vec3,
  lloAltKm: number,
  guessDv: Vec3,
  axis: 0 | 1 | 2,
  alongKms: number,
): number | null {
  const rTarget = R_MOON + lloAltKm
  const s0 = nrho.stateAt(departMs)
  const site = unit(siteDir)
  const free = [0, 1, 2].filter((k) => k !== axis)
  const shoot = (x: number[]) => {
    const dv: Vec3 = [0, 0, 0]
    dv[axis] = alongKms
    dv[free[0]] = x[0] / 1000
    dv[free[1]] = x[1] / 1000
    const run = integrate(nrho.field, { r: s0.r, v: add(s0.v, dv), m: 1 }, departMs, { ...TO_PERILUNE, stop: (_tS, s) => dot(s.r, s.v) })
    return run.stopped ? { dv, end: run.end } : null
  }
  const sol = newton(
    (x) => {
      const s = shoot(x)
      return s ? [norm(s.end.r) - rTarget, 1000 * dot(unit(cross(s.end.r, s.end.v)), site)] : null
    },
    [guessDv[free[0]] * 1000, guessDv[free[1]] * 1000],
    [1, 1],
    1e-4,
  )
  const s = sol && shoot(sol.x)
  return s ? norm(s.dv) + Math.abs(norm(s.end.v) - Math.sqrt(MU_MOON / rTarget)) : null
}

export interface LanderTransferInput {
  nrho: NrhoOrbit
  /** Landing site as a Moon-centred J2000 unit vector at the time it matters (see siteDirection). The low
   *  orbit's plane contains it. */
  siteDir: Vec3
  thrustN: number
  ispS: number
  /** Mass at the start of the transfer, kg. */
  massKg: number
  /** Altitude of the circular low lunar orbit, km (default 100). */
  lloAltKm?: number
}

/** NRHO → low lunar orbit. The lander is on the NRHO at departMs (nrhoDepartureMs picks a sensible instant);
 *  it ends in a circular orbit of lloAltKm whose plane contains siteDir. */
export function nrhoToLlo(input: LanderTransferInput & { departMs: number }): Transfer {
  const { nrho, departMs, siteDir, massKg } = input
  const engine: EngineSpec = { thrustN: input.thrustN, ispS: input.ispS }
  const field = nrho.field
  const rLlo = R_MOON + (input.lloAltKm ?? 100)
  const vCirc = Math.sqrt(MU_MOON / rLlo)
  const site = unit(siteDir)
  const s0 = nrho.stateAt(departMs)
  const imp = apsisTransfer(field, departMs, s0.r, s0.v, rLlo, site, 'nrhoToLlo')

  // Finite burns. Unknowns: the departure burn as a delta-v vector (direction fixed in space, length → burn
  // time), the ignition instant and the duration of the insertion burn, which thrusts against the velocity.
  // Conditions at its cut-off: radius, no radial speed, circular speed, site in the plane.
  const tPeri = departMs + imp.flightS * 1000
  const fly = (x: number[], keep: boolean): Flight => {
    const dv: Vec3 = [x[0] / 1000, x[1] / 1000, x[2] / 1000]
    const fl = new Flight(field, departMs, s0.r, s0.v, massKg, keep)
    fixedBurn(fl, engine, 'lander-nrd', 'Lander NRHO departure burn', dv)
    fl.coastTo(tPeri + x[3] * 1000)
    fl.burn('loi', 'Lunar Orbit Insertion (LOI)', engine, (s) => scale(s.v, -1 / norm(s.v)), x[4])
    return fl
  }
  const residual = (x: number[]): number[] | null => {
    if (!(x[4] > 0)) return null
    let fl: Flight
    try {
      fl = fly(x, false)
    } catch (err) {
      if (err instanceof RangeError) return null
      throw err
    }
    const { r, v } = fl.s
    const rn = norm(r)
    return [rn - rLlo, (1000 * dot(r, v)) / rn, 1000 * (norm(v) - vCirc), 1000 * dot(unit(cross(r, v)), site)]
  }
  const mAfterFirst = massKg * Math.exp((-norm(imp.dv) * 1000) / (G0 * engine.ispS))
  const tau2 = burnSeconds(engine, mAfterFirst, imp.dvCircKms)
  refuseLongBurn('nrhoToLlo', 'lunar orbit insertion', tau2, engine)
  const x0 = [imp.dv[0] * 1000, imp.dv[1] * 1000, imp.dv[2] * 1000, -tau2 / 2, tau2]
  const sol = newton(residual, x0, [1, 1, 1, 1, 1], 1e-4)
  if (!sol) throw new NrhoError('nrhoToLlo: the finite-burn insertion did not converge (is the thrust too low for a single insertion burn?)')
  const fl = fly(sol.x, true)
  return finish(fl, imp.totalKms, [imp.dv, scale(unit(imp.vp), -imp.dvCircKms)])
}

function finish(fl: Flight, impulsiveDvKms: number, impulsiveBurnsKms: Vec3[]): Transfer {
  return {
    path: { t: fl.t, r: fl.r, v: fl.v, thrusting: fl.thrusting, frame: 'moon' },
    events: fl.events,
    start: fl.start,
    end: fl.state('moon'),
    dvKms: fl.events.reduce((acc, e) => acc + e.dvKms, 0),
    impulsiveDvKms,
    impulsiveBurnsKms,
  }
}

/** Low lunar orbit → NRHO. The lander arrives on the NRHO at about arriveMs (the insertion burn ends within
 *  minutes of it). Its starting orbit is circular at lloAltKm in a plane that contains siteDir; which of those
 *  planes, and where on the orbit the lander must be, is part of the answer: result.start is the state the
 *  ascent has to deliver, `leadS` seconds before the departure burn. */
export function lloToNrho(input: LanderTransferInput & { arriveMs: number; leadS?: number }): Transfer {
  const { nrho, arriveMs, siteDir, massKg } = input
  const engine: EngineSpec = { thrustN: input.thrustN, ispS: input.ispS }
  const field = nrho.field
  const rLlo = R_MOON + (input.lloAltKm ?? 100)
  const vCirc = Math.sqrt(MU_MOON / rLlo)
  const site = unit(siteDir)
  const leadS = input.leadS ?? 600

  // Instantaneous burns, designed backwards from the arrival: in the reversed field the way back is a descent
  // from the NRHO to a perilune at the low orbit.
  const sa = nrho.stateAt(arriveMs)
  const imp = apsisTransfer(reversedField(field, arriveMs), arriveMs, sa.r, scale(sa.v, -1), rLlo, site, 'lloToNrho')
  const tDep = arriveMs - imp.flightS * 1000 // the perilune of the reversed shot: where and when the lander leaves
  const vDep = scale(imp.vp, -1) // velocity right after the departure burn
  const normal = unit(cross(imp.rp, vDep))
  const a = unit(imp.rp)
  const dv1 = imp.dvCircKms // prograde, low orbit → transfer
  const dv2 = imp.dv // on arrival: NRHO velocity minus arrival velocity

  // Finite burns, flown forwards. Unknowns: the low orbit's plane (turned about the site direction by ψ), the
  // lander's place on it at the ignition (angle θ from the first-guess departure point), the ignition instant
  // and duration of the departure burn (thrust along the velocity), the ignition instant of the insertion burn
  // and its delta-v vector (direction fixed in space). Conditions: position and velocity at its cut-off are
  // the NRHO's at that instant. Two more unknowns than conditions: the Newton steps stay as close to the
  // first guess as the conditions allow.
  const tau1 = burnSeconds(engine, massKg, dv1)
  refuseLongBurn('lloToNrho', 'departure burn from the low orbit', tau1, engine)
  const m1 = massKg * Math.exp((-dv1 * 1000) / (G0 * engine.ispS))
  const tau2 = burnSeconds(engine, m1, norm(dv2))
  const fly = (x: number[], keep: boolean): Flight => {
    // plane: rotate the first-guess normal about the site direction by ψ (it stays perpendicular to the site)
    const n = rotateAbout(normal, site, x[0] * 1e-3)
    const a1 = unit(sub(a, scale(n, dot(a, n))))
    const b1 = cross(n, a1)
    const th = x[1] * 1e-3
    const tIg = tDep + x[2] * 1000
    const r1 = add(scale(a1, rLlo * Math.cos(th)), scale(b1, rLlo * Math.sin(th)))
    const v1 = add(scale(a1, -vCirc * Math.sin(th)), scale(b1, vCirc * Math.cos(th)))
    // The path starts leadS before the ignition, on the same circle (the Moon's field alone; an arc this short
    // is not measurably changed by Earth and Sun, and the Newton iteration absorbs what there is).
    const back = (-leadS * vCirc) / rLlo
    const rs = add(scale(r1, Math.cos(back)), scale(v1, (rLlo / vCirc) * Math.sin(back)))
    const vs = add(scale(v1, Math.cos(back)), scale(r1, (-vCirc / rLlo) * Math.sin(back)))
    const fl = new Flight(field, tIg - leadS * 1000, rs, vs, massKg, keep)
    fl.coast(leadS)
    fl.burn('llo-departure', 'Low lunar orbit departure burn', engine, (s) => scale(s.v, 1 / norm(s.v)), x[3])
    fl.coastTo(arriveMs + x[4] * 1000)
    fixedBurn(fl, engine, 'lander-nri', 'Lander NRHO insertion burn', [x[5] / 1000, x[6] / 1000, x[7] / 1000])
    return fl
  }
  const residual = (x: number[]): number[] | null => {
    if (!(x[3] > 0)) return null
    let fl: Flight
    let target: { r: Vec3; v: Vec3 }
    try {
      fl = fly(x, false)
      target = nrho.stateAt(fl.tMs)
    } catch (err) {
      if (err instanceof RangeError || err instanceof NrhoError) return null
      throw err
    }
    const dr = sub(fl.s.r, target.r)
    const dvv = sub(fl.s.v, target.v)
    return [dr[0], dr[1], dr[2], dvv[0] * 1000, dvv[1] * 1000, dvv[2] * 1000]
  }
  const x0 = [0, 0, -tau1 / 2, tau1, -tau2 / 2, dv2[0] * 1000, dv2[1] * 1000, dv2[2] * 1000]
  const sol = newton(residual, x0, [1, 1, 1, 1, 10, 1, 1, 1], 1e-4)
  if (!sol) throw new NrhoError('lloToNrho: the finite-burn transfer did not converge')
  return finish(fly(sol.x, true), imp.totalKms, [scale(unit(vDep), dv1), dv2])
}

// =====================================================================================================
// Part 4: the crew spacecraft's arrival from Earth
// =====================================================================================================
//
// The spacecraft coasts from Earth on a path that would swing past the Moon and leave again. Close to the Moon,
// where a change of speed changes the orbital energy most, it brakes (outbound powered flyby): the path bends
// around the Moon and climbs toward the far, slow part of the NRHO. There a second burn (NRHO insertion)
// matches the orbit's velocity. A small correction right at the start (outbound trajectory correction) aims
// the flyby: how far from the Moon's centre it passes and on which side.
//
// Found in three steps.
//   1. Aiming. The approach is described by its B vector: the point where the incoming asymptote pierces the
//      plane through the Moon's centre at right angles to it. Its length sets the flyby altitude, its direction
//      (angle θ in that plane) the plane of the flyby. For a set of θ the correction that produces a flyby at
//      the wanted altitude is found by Newton iteration, as plan.ts does for a lunar orbit insertion.
//   2. Search with two-body orbits about the Moon. For every θ and every arrival instant on the NRHO, Lambert's
//      problem gives the orbit from the flyby's perilune to the NRHO's position at that instant, and with it both
//      burns. The cheapest combinations are the starting points of step 3.
//   3. The real field. With instantaneous burns first: for a given θ and arrival instant the correction and the
//      flyby burn follow from Newton iterations (aim the flyby; meet the NRHO), and the total of the three burns
//      is minimised over θ and the arrival instant by a simplex search. Then the burns are integrated at the
//      thrust of the engine and corrected by Newton iteration until the flight ends on the NRHO.
//
// What is and is not minimised: the flyby altitude is held at its lowest allowed value, the correction is the
// smallest one that aims the flyby, and the hour of the flyby is whatever the starting state gives. The cost
// depends strongly on that hour against the NRHO's own perilune passage (about 0.43 km/s when the flyby comes
// 3 to 4 hours after it, twice that a day earlier or later), so the departure from Earth has to be timed.

/** The Moon relative to Earth at utcMs, read the way the gravity fields read it (cubic table). */
function moonStateAt(ephem: FlightEphemeris, utcMs: number): { r: Vec3; v: Vec3 } {
  const tab = makeBodyTable(ephem.moonPos, utcMs - HOUR_MS, utcMs + HOUR_MS)
  const r: Vec3 = [0, 0, 0]
  const v: Vec3 = [0, 0, 0]
  tableState(tab, utcMs, r, v)
  return { r, v }
}

/** The same state seen from the other body. */
export function stateInFrame(ephem: FlightEphemeris, s: TransferState, frame: 'earth' | 'moon'): TransferState {
  if (s.frame === frame) return s
  const moon = moonStateAt(ephem, s.utcMs)
  const k = frame === 'earth' ? 1 : -1
  return { ...s, r: add(s.r, scale(moon.r, k)), v: add(s.v, scale(moon.v, k)), frame }
}

/** The same path with positions relative to the other body (for drawing an Earth-centred or Moon-centred view). */
export function pathInFrame(ephem: FlightEphemeris, path: TransferPath, frame: 'earth' | 'moon'): TransferPath {
  if (path.frame === frame || path.t.length === 0) return path
  const tab = makeBodyTable(ephem.moonPos, path.t[0], path.t[path.t.length - 1])
  const k = frame === 'earth' ? 1 : -1
  const m: Vec3 = [0, 0, 0]
  const mv: Vec3 = [0, 0, 0]
  const r: Vec3[] = []
  const v: Vec3[] = []
  for (let i = 0; i < path.t.length; i++) {
    tableState(tab, path.t[i], m, mv)
    r.push([path.r[i][0] + k * m[0], path.r[i][1] + k * m[1], path.r[i][2] + k * m[2]])
    v.push([path.v[i][0] + k * mv[0], path.v[i][1] + k * mv[1], path.v[i][2] + k * mv[2]])
  }
  return { t: path.t, r, v, thrusting: path.thrusting, frame }
}

// Stumpff functions of the universal-variable form of Kepler's problem.
const stumpffC = (z: number) => (z > 1e-6 ? (1 - Math.cos(Math.sqrt(z))) / z : z < -1e-6 ? (Math.cosh(Math.sqrt(-z)) - 1) / -z : 0.5 - z / 24)
const stumpffS = (z: number) => {
  if (z > 1e-6) {
    const q = Math.sqrt(z)
    return (q - Math.sin(q)) / (q * q * q)
  }
  if (z < -1e-6) {
    const q = Math.sqrt(-z)
    return (Math.sinh(q) - q) / (q * q * q)
  }
  return 1 / 6 - z / 120
}

/** Lambert's problem: the two-body orbit (less than one revolution) from r1 to r2 in dtS seconds. longWay picks
 *  the arc of more than 180°. Returns the velocities at both ends, or null when there is none.
 *  Universal-variable solution (Bate, Mueller, White, Fundamentals of Astrodynamics, section 5.3), by bisection. */
function lambert(r1: Vec3, r2: Vec3, dtS: number, mu: number, longWay: boolean): { v1: Vec3; v2: Vec3 } | null {
  const a1 = norm(r1)
  const a2 = norm(r2)
  const cosT = Math.min(1, Math.max(-1, dot(r1, r2) / (a1 * a2)))
  if (1 - cosT < 1e-9) return null
  const A = (longWay ? -1 : 1) * Math.sqrt(a1 * a2 * (1 + cosT))
  if (Math.abs(A) < 1e-9) return null
  const yOf = (z: number) => a1 + a2 + (A * (z * stumpffS(z) - 1)) / Math.sqrt(stumpffC(z))
  const F = (z: number) => {
    const y = yOf(z)
    if (!(y > 0)) return -Infinity
    return Math.pow(y / stumpffC(z), 1.5) * stumpffS(z) + A * Math.sqrt(y) - Math.sqrt(mu) * dtS
  }
  let lo = -400
  let hi = 4 * Math.PI * Math.PI - 1e-6
  if (!(F(hi) > 0) || F(lo) > 0) return null
  for (let i = 0; i < 70; i++) {
    const mid = 0.5 * (lo + hi)
    if (F(mid) > 0) hi = mid
    else lo = mid
  }
  const y = yOf(hi)
  if (!(y > 0)) return null
  const f = 1 - y / a1
  const g = A * Math.sqrt(y / mu)
  const gDot = 1 - y / a2
  return { v1: scale(sub(r2, scale(r1, f)), 1 / g), v2: scale(sub(scale(r2, gDot), r1), 1 / g) }
}

/** Incoming asymptote direction S, B vector and squared excess speed of the hyperbola whose periapsis state is
 *  (rp, vp); null when the orbit is not a hyperbola. */
function bPlane(rp: Vec3, vp: Vec3): { S: Vec3; B: Vec3; vInf2: number } | null {
  const q = norm(rp)
  const vInf2 = dot(vp, vp) - (2 * MU_MOON) / q
  if (!(vInf2 > 0)) return null
  const h = unit(cross(rp, vp))
  const P = unit(rp)
  const e = 1 + (q * vInf2) / MU_MOON
  const S = add(scale(P, 1 / e), scale(cross(h, P), Math.sqrt(1 - 1 / (e * e))))
  return { S, B: scale(cross(S, h), (MU_MOON / vInf2) * Math.sqrt(e * e - 1)), vInf2 }
}

/** Radius of the periapsis of the two-body orbit about the Moon through the state (r, v). */
function osculatingPerilune(r: Vec3, v: Vec3): number {
  const energy = dot(v, v) / 2 - MU_MOON / norm(r)
  const h2 = dot(cross(r, v), cross(r, v))
  return h2 / (MU_MOON * (1 + Math.sqrt(Math.max(0, 1 + (2 * energy * h2) / (MU_MOON * MU_MOON)))))
}

const ARRIVAL_TOL = 1e-2 // km and m/s: how closely a flight through a flyby is made to end on its target
// A burn at a perilune is treated as one push there. That holds while it is short against the time the craft
// takes to round the Moon; a burn longer than this (a quarter of a revolution in a 100 km orbit) is refused.
const MAX_PERILUNE_BURN_S = 1750
function refuseLongBurn(what: string, burn: string, seconds: number, engine: EngineSpec) {
  if (seconds > MAX_PERILUNE_BURN_S) {
    throw new NrhoError(
      `${what}: at ${engine.thrustN} N the ${burn} would last ${seconds.toFixed(0)} s, too long to be flown as a single burn at the perilune; ` +
        'it needs more thrust',
    )
  }
}
const NEAR_MOON_KM = 120000 // a closest approach counts as the flyby only inside this distance

/** Coasts a flight that is outside the Moon's sphere of influence up to its edge in Earth-centred coordinates,
 *  and leaves it in Moon-centred ones. Throws RangeError when it does not get there within ten days.
 *
 *  Why not Moon-centred all the way: the Moon-centred equations take the acceleration of the Moon itself from
 *  the gravity of Earth and Sun, and the Moon of the ephemeris does not accelerate exactly so. Seen from the
 *  Moon, a craft near Earth is pushed by the difference: about 5 km in the 4.5 days of a coast to the Moon
 *  against the same coast integrated Earth-centred (ephemeris.test.ts; it was 73 km while ephemeris.ts still
 *  handed out apparent positions instead of geometric ones). Earth-centred equations use the Moon only as a
 *  distant mass. */
function moonwardCoast(fl: Flight, geo: EarthField) {
  fl.frame(null) // the distance test needs the Moon-centred position
  if (norm(fl.s.r) <= SOI_MOON) return
  fl.frame(geo)
  const arrived = fl.coast(10 * 86400, (s, utcMs) => SOI_MOON - norm(sub(s.r, geo.moonState(utcMs).r)))
  fl.frame(null)
  if (!arrived) throw new RangeError('the coast does not reach the sphere of influence of the Moon')
}

/** Components of the vector a along the velocity, the orbit normal r × v, and the in-plane direction across the
 *  velocity (v̂ × n̂: outward at a periapsis) for the state (r, v). */
function toVnb(r: Vec3, v: Vec3, a: Vec3): Vec3 {
  const vh = unit(v)
  const nh = unit(cross(r, v))
  return [dot(a, vh), dot(a, nh), dot(a, cross(vh, nh))]
}

/** A burn of delta-v dv (km/s) with the thrust direction fixed in space. Skipped when dv is zero. */
function fixedBurn(fl: Flight, engine: EngineSpec, id: string, label: string, dv: Vec3) {
  if (norm(dv) < 1e-9) return
  const dir = unit(dv)
  fl.burn(id, label, engine, () => dir, burnSeconds(engine, fl.s.m, norm(dv)))
}

/** A burn around a closest approach to the Moon: delta-v dvLocal (km/s) given as components along the velocity,
 *  the orbit normal and across the velocity, a direction that turns with the craft. Returns the radius of the
 *  closest approach: where the range rate changes sign during the burn, or, if it does not, the perilune of the
 *  orbit the burn starts from or leaves the craft on. */
function flybyBurn(fl: Flight, engine: EngineSpec, id: string, label: string, dvLocal: Vec3): number {
  const size = norm(dvLocal)
  if (size < 1e-9) return osculatingPerilune(fl.s.r, fl.s.v)
  const [a, b, c] = scale(dvLocal, 1 / size)
  const dir = (s: SimState): Vec3 => {
    const vh = unit(s.v)
    const nh = unit(cross(s.r, s.v))
    const ch = cross(vh, nh)
    return [a * vh[0] + b * nh[0] + c * ch[0], a * vh[1] + b * nh[1] + c * ch[1], a * vh[2] + b * nh[2] + c * ch[2]]
  }
  const seconds = burnSeconds(engine, fl.s.m, size)
  if (dot(fl.s.r, fl.s.v) >= 0) {
    const rMin = osculatingPerilune(fl.s.r, fl.s.v)
    fl.burn(id, label, engine, dir, seconds)
    return rMin
  }
  const tStart = fl.tMs
  if (!fl.burn(id, label, engine, dir, seconds, (s) => dot(s.r, s.v))) return osculatingPerilune(fl.s.r, fl.s.v)
  const rMin = norm(fl.s.r)
  fl.burn(id, label, engine, dir, seconds - (fl.tMs - tStart) / 1000)
  return rMin
}

export interface ArrivalInput {
  ephem: FlightEphemeris
  nrho: NrhoOrbit
  /** The spacecraft on its coast to the Moon (after the trans-lunar injection), Earth- or Moon-centred. */
  start: TransferState
  thrustN: number
  ispS: number
  /** Altitude of the powered flyby's closest approach, km (default 100). */
  flybyAltKm?: number
  /** Longest stretch from the flyby to the arrival on the NRHO, days (default 7: a little more than one revolution
   *  of the NRHO, so that every point of it can be reached). */
  maxDaysAfterFlyby?: number
  /** Earth's spin axis (unit vector, J2000). When given, the coast from Earth feels Earth's oblateness (J2),
   *  as the flight that produced the starting state did in transit.ts or missionNrho.ts. */
  earthPole?: Vec3
  /** Give up (NrhoError) when the three burns together would cost more than this, km/s (default 0.9). What the
   *  arrival costs depends on where the NRHO's spacecraft is when the flyby happens: cheap arrivals come round
   *  once per NRHO revolution, and in between the cost rises to more than 1 km/s. */
  maxDvKms?: number
}

export interface FlybyTransfer extends Transfer {
  /** Closest approach to the Moon on the flown path. */
  flyby: { utcMs: number; altitudeKm: number }
}

/** Translunar coast → NRHO: trajectory correction at the start, outbound powered flyby, NRHO insertion. */
export function earthToNrho(input: ArrivalInput): FlybyTransfer {
  const { ephem, nrho } = input
  const engine: EngineSpec = { thrustN: input.thrustN, ispS: input.ispS }
  const field = nrho.field
  const rFly = R_MOON + (input.flybyAltKm ?? 100)
  const maxAfterS = (input.maxDaysAfterFlyby ?? 7) * 86400
  const start = stateInFrame(ephem, input.start, 'moon')
  const t0 = start.utcMs
  // The coast from Earth is integrated in Earth-centred coordinates until the craft enters the sphere of
  // influence of the Moon, and Moon-centred from there (as plan.ts hands over from one body to the other);
  // moonwardCoast says why.
  let geo: EarthField
  try {
    geo = earthField(ephem, t0 - HOUR_MS, Math.min(t0 + 12 * DAY_MS, ephem.endMs - EDGE_MS), input.earthPole ?? null)
  } catch (err) {
    if (err instanceof RangeError) throw new NrhoError('earthToNrho: the ephemeris does not cover the start of the flight')
    throw err
  }

  // Coast from the start (after an instantaneous correction dv, km/s) to the closest approach to the Moon.
  // Remembered: every aiming of step 3a starts Newton's method from the same correction with the same
  // difference steps, whatever the target direction θ, and asks for the converged point once more at the end.
  const approach = remembered((dv: Vec3): { tMs: number; r: Vec3; v: Vec3 } | null => {
    try {
      const fl = new Flight(field, t0, start.r, add(start.v, dv), 1, false)
      moonwardCoast(fl, geo)
      const found = fl.coast(10 * 86400, (s) => {
        const r2 = dot(s.r, s.r)
        return r2 < CRASH_KM * CRASH_KM ? 1 : r2 < NEAR_MOON_KM * NEAR_MOON_KM ? dot(s.r, s.v) : -1
      })
      return found && norm(fl.s.r) > 1.01 * CRASH_KM ? { tMs: fl.tMs, r: fl.s.r, v: fl.s.v } : null
    } catch (err) {
      if (err instanceof RangeError) return null
      throw err
    }
  }, 4096)
  const natural = approach([0, 0, 0])
  const nat = natural && bPlane(natural.r, natural.v)
  if (!natural || !nat) throw new NrhoError('earthToNrho: the starting state does not lead to a flyby of the Moon (or the ephemeris ends first)')
  if (natural.tMs + 12 * HOUR_MS > nrho.endMs || natural.tMs < nrho.startMs) {
    throw new NrhoError('earthToNrho: the flyby falls outside the span of the NRHO; ask nrhoAround for a span that covers the arrival')
  }

  // 1. Aiming: the correction for a flyby at the wanted altitude, for each direction θ of the B vector.
  let T = cross(nat.S, [0, 0, 1])
  if (norm(T) < 0.05) T = cross(nat.S, [1, 0, 0])
  T = unit(T)
  const R = cross(nat.S, T)
  const N_THETA = 16
  interface Aim {
    theta: number
    otc: Vec3
    per: { tMs: number; r: Vec3; v: Vec3 }
  }
  /** The smallest correction (starting the search from `guess`, km/s) whose flyby has the wanted altitude and
   *  the B-vector direction theta. */
  const aimAt = (theta: number, guess: Vec3): Aim | null => {
    const miss = (x: number[]): number[] | null => {
      const per = approach([x[0] / 1000, x[1] / 1000, x[2] / 1000])
      const b = per && bPlane(per.r, per.v)
      if (!b) return null
      const bMag = Math.sqrt(rFly * rFly + (2 * MU_MOON * rFly) / b.vInf2)
      return [dot(b.B, T) - bMag * Math.cos(theta), dot(b.B, R) - bMag * Math.sin(theta)]
    }
    const sol = newton(miss, [guess[0] * 1000, guess[1] * 1000, guess[2] * 1000], [1, 1, 1], 1e-4)
    if (!sol) return null
    const otc: Vec3 = [sol.x[0] / 1000, sol.x[1] / 1000, sol.x[2] / 1000]
    const per = approach(otc)
    return per ? { theta, otc, per } : null
  }
  const aims: Aim[] = []
  for (let k = 0; k < N_THETA; k++) {
    const aim = aimAt((2 * Math.PI * k) / N_THETA, [0, 0, 0])
    if (aim) aims.push(aim)
  }
  if (!aims.length) throw new NrhoError('earthToNrho: could not aim the flyby from the starting state')

  // 2. Two-body search over θ and the arrival instant.
  interface Candidate {
    aim: Aim
    tArr: number
    opf: Vec3
    cost: number
  }
  const candidates: Candidate[] = []
  for (const aim of aims) {
    let best: Candidate | null = null
    for (let after = 6 * 3600; after <= maxAfterS; after += 5400) {
      const tArr = aim.per.tMs + after * 1000
      if (tArr > nrho.endMs) break
      const target = nrho.stateAt(tArr)
      for (const longWay of [false, true]) {
        const lam = lambert(aim.per.r, target.r, after, MU_MOON, longWay)
        if (!lam) continue
        const opf = sub(lam.v1, aim.per.v)
        const cost = norm(aim.otc) + norm(opf) + norm(sub(target.v, lam.v2))
        if (!best || cost < best.cost) best = { aim, tArr, opf, cost }
      }
    }
    if (best) candidates.push(best)
  }
  candidates.sort((a, b) => a.cost - b.cost)
  const maxDv = input.maxDvKms ?? 0.9
  const tooDear = (kms: number) =>
    new NrhoError(
      `earthToNrho: arriving with a flyby on ${new Date(natural.tMs).toISOString()} would cost about ${kms.toFixed(2)} km/s, ` +
        `more than the limit of ${maxDv} km/s. ` +
        'The NRHO is at the wrong point of its revolution; cheap arrivals repeat once per revolution (6.56 days).',
    )
  if (!candidates.length) throw new NrhoError('earthToNrho: no flyby from this starting state reaches the NRHO within the allowed time')
  if (candidates[0].cost > 1.2 * maxDv) throw tooDear(candidates[0].cost)

  // 3a. The real field, instantaneous burns. For a B-vector direction θ and an arrival instant, the correction
  // is the smallest that aims the flyby (Newton, as in step 1) and the flyby burn is the one whose coast meets
  // the NRHO's position at that instant (Newton on its three components). The total of the three burns is
  // then minimised over θ and the arrival instant with the simplex method.
  interface Shot {
    otc: Vec3
    opf: Vec3
    nri: Vec3
    per: { tMs: number; r: Vec3; v: Vec3 }
    tArr: number
    total: number
  }
  const solveFrom = (cand: Candidate): Shot | null => {
    const shotAt = (theta: number, tArr: number): Shot | null => {
      const aim = aimAt(theta, cand.aim.otc)
      if (!aim || !(tArr > aim.per.tMs + 600e3) || tArr > nrho.endMs) return null
      const target = nrho.stateAt(tArr)
      const coastFrom = remembered((opfMs: number[]): SimState | null => {
        try {
          const run = integrate(field, { r: aim.per.r, v: add(aim.per.v, scale(opfMs as Vec3, 1e-3)), m: 1 }, aim.per.tMs, {
            maxSeconds: (tArr - aim.per.tMs) / 1000,
            maxStepS: COAST_STEP_S,
            tol: SHOT_TOL,
            stop: crashStop,
          })
          return run.stopped ? null : run.end
        } catch (err) {
          if (err instanceof RangeError) return null
          throw err
        }
      })
      const sol = newton((x) => {
        const end = coastFrom(x)
        return end ? sub(end.r, target.r) : null
      }, scale(cand.opf, 1000), [1, 1, 1], 1e-3)
      const end = sol && coastFrom(sol.x)
      if (!sol || !end) return null
      const opf = scale(sol.x as Vec3, 1e-3)
      const nri = sub(target.v, end.v)
      return { otc: aim.otc, opf, nri, per: aim.per, tArr, total: norm(aim.otc) + norm(opf) + norm(nri) }
    }
    // simplex variables: θ in degrees, arrival instant in hours from the candidate's
    const at = remembered((x: number[]) => shotAt(cand.aim.theta + (x[0] * Math.PI) / 180, cand.tArr + x[1] * HOUR_MS))
    const opt = nelderMead((x) => at(x)?.total ?? Infinity, [0, 0], [4, 1.5], 0.02, 70)
    return at(opt.x)
  }
  let imp: Shot | null = null
  for (const cand of candidates.slice(0, 2)) {
    if (cand.cost > 1.2 * maxDv) continue
    const s = solveFrom(cand)
    if (s && (!imp || s.total < imp.total)) imp = s
  }
  if (!imp) throw new NrhoError('earthToNrho: no flyby from this starting state reaches the NRHO within the allowed time')
  if (imp.total > maxDv) throw tooDear(imp.total)

  // 3b. Finite burns. Unknowns: the correction (3, burn starts at the start, direction fixed in space), the
  // ignition instant of the flyby burn and its delta-v as components along the velocity, the orbit normal and
  // the in-plane direction across the velocity (4; the thrust turns with the velocity as the craft rounds the
  // Moon), the ignition instant and delta-v vector of the insertion burn (4, direction fixed in space).
  // Conditions: the closest approach has the wanted radius, and position and velocity at the insertion cut-off
  // are those of the NRHO (6). Four more unknowns than conditions: each Newton step is the smallest one.
  const sol0 = imp
  const mass = start.massKg
  const ve = G0 * engine.ispS
  const tauOpf = burnSeconds(engine, mass * Math.exp((-norm(sol0.otc) * 1000) / ve), norm(sol0.opf))
  const tauNri = burnSeconds(engine, mass * Math.exp((-(norm(sol0.otc) + norm(sol0.opf)) * 1000) / ve), norm(sol0.nri))
  refuseLongBurn('earthToNrho', 'outbound powered flyby', tauOpf, engine)
  const fly = (x: number[], keep: boolean): { fl: Flight; rMin: number } => {
    const fl = new Flight(field, t0, start.r, start.v, mass, keep)
    fl.frame(norm(start.r) > SOI_MOON ? geo : null)
    fixedBurn(fl, engine, 'otc', 'Outbound Trajectory Correction (OTC)', [x[0] / 1000, x[1] / 1000, x[2] / 1000])
    moonwardCoast(fl, geo)
    fl.coastTo(sol0.per.tMs + x[3] * 1000)
    const rMin = flybyBurn(fl, engine, 'opf', 'Outbound Powered Flyby (OPF)', [x[4] / 1000, x[5] / 1000, x[6] / 1000])
    fl.coastTo(sol0.tArr + x[7] * 1000)
    fixedBurn(fl, engine, 'nri', 'NRHO Insertion (NRI)', [x[8] / 1000, x[9] / 1000, x[10] / 1000])
    return { fl, rMin }
  }
  const residual = (x: number[]): number[] | null => {
    try {
      const { fl, rMin } = fly(x, false)
      const target = nrho.stateAt(fl.tMs)
      const dr = sub(fl.s.r, target.r)
      const dv = sub(fl.s.v, target.v)
      return [rMin - rFly, dr[0], dr[1], dr[2], dv[0] * 1000, dv[1] * 1000, dv[2] * 1000]
    } catch (err) {
      if (err instanceof RangeError || err instanceof NrhoError) return null
      throw err
    }
  }
  const opfLocal = toVnb(sol0.per.r, sol0.per.v, sol0.opf)
  const x0 = [
    sol0.otc[0] * 1000, sol0.otc[1] * 1000, sol0.otc[2] * 1000,
    -tauOpf / 2, opfLocal[0] * 1000, opfLocal[1] * 1000, opfLocal[2] * 1000,
    -tauNri / 2, sol0.nri[0] * 1000, sol0.nri[1] * 1000, sol0.nri[2] * 1000,
  ]
  // Tolerance: 10 m and 1 cm/s. Five days of flight through a close flyby cannot be integrated more
  // repeatably than about a metre, and Newton iteration stalls at that floor.
  const sol = newton(residual, x0, [0.01, 0.01, 0.01, 1, 0.3, 0.3, 0.3, 10, 0.3, 0.3, 0.3], ARRIVAL_TOL, 60)
  if (!sol) throw new NrhoError('earthToNrho: the finite-burn arrival did not converge (is the thrust too low for the flyby burn?)')
  const { fl } = fly(sol.x, true)
  return { ...finish(fl, sol0.total, [sol0.otc, sol0.opf, sol0.nri]), flyby: closestApproach(fl) }
}

/** The sample of a flown path nearest the Moon. */
function closestApproach(fl: Flight): { utcMs: number; altitudeKm: number } {
  let best = 0
  for (let i = 1; i < fl.r.length; i++) if (dot(fl.r[i], fl.r[i]) < dot(fl.r[best], fl.r[best])) best = i
  return { utcMs: fl.t[best], altitudeKm: norm(fl.r[best]) - R_MOON }
}

// =====================================================================================================
// Part 5: the crew spacecraft's return to Earth
// =====================================================================================================
//
// The way home mirrors the arrival. A burn on the NRHO (NRHO departure) sends the spacecraft down toward the
// Moon on a path that passes it closely; at the closest approach, where a change of speed changes the orbital
// energy most, it accelerates (return powered flyby) onto a hyperbola that leaves the Moon against the Moon's
// own motion around Earth. Seen from Earth the spacecraft has then lost almost all of the Moon's orbital speed,
// and it falls home in about five days to meet the atmosphere at Entry Interface at the asked flight-path angle.
//
// What is free and is searched for the smallest sum of the two burns:
//   - the instant of the departure burn, inside the allowed window, and with it the instant of the flyby
//     (cheap departures come round once per revolution of the NRHO, like cheap arrivals);
//   - the flyby geometry: the plane in which the spacecraft rounds the Moon (the direction θ of the B vector);
//   - the way home itself: how far beyond the Moon's distance the apogee of the return orbit lies (a higher
//     apogee is a faster and dearer fall) and how the plane of the return orbit is tilted against the Moon's
//     orbit plane (angle φ about the Earth–Moon line).
// Held fixed: the flyby altitude at its lowest allowed value, the altitude and flight-path angle at Entry
// Interface. Not constrained: where on Earth the entry happens (a real mission aims at a recovery zone).
//
// Found in three steps, as the arrival.
//   1. Search with two-body orbits. For a flyby instant, a return orbit about Earth from the Moon's place to
//      the entry gives the velocity the spacecraft must have when it leaves the Moon, and so the hyperbola of
//      the flyby for every θ. Lambert's problem about the Moon gives the orbit from the NRHO's position at a
//      departure instant to the perilune of that hyperbola, and with it both burns.
//   2. The real field, instantaneous burns, designed backwards from the entry: the state at Entry Interface is
//      flown back in time to the Moon; its speed and heading are corrected by Newton iteration until the flyby
//      has the wanted altitude and θ (the B-plane aiming of a trans-lunar injection, run in reverse); the flyby
//      burn is the one whose backward coast meets the NRHO's position at the departure instant (Newton on its
//      three components); what is left there is the departure burn. The total is minimised over the five free
//      quantities with the simplex method.
//   3. Finite burns, flown forwards from the NRHO at the thrust of the engine, corrected by Newton iteration
//      until the flyby has the wanted altitude and the flight meets Entry Interface at the asked angle.

/** A field of Earth run backwards from pivotMs (see reversedField); the Moon moves backwards with it. */
function reversedEarthField(geo: EarthField, pivotMs: number): EarthField {
  return {
    centre: 'earth',
    accel: (r, utcMs, out) => geo.accel(r, 2 * pivotMs - utcMs, out),
    moonState: (utcMs) => {
      const m = geo.moonState(2 * pivotMs - utcMs)
      return { r: m.r, v: scale(m.v, -1) }
    },
  }
}

export interface ReturnInput {
  ephem: FlightEphemeris
  nrho: NrhoOrbit
  /** The NRHO departure burn does not start before this instant … */
  earliestMs: number
  /** … and not later than this many days after it. Default: one revolution of the NRHO (6.56 days), so that the
   *  cheapest point of the revolution is always inside the window. */
  windowDays?: number
  /** Mass on the NRHO before the departure burn, kg. */
  massKg: number
  thrustN: number
  ispS: number
  /** Flight-path angle at Entry Interface, degrees, negative (below the local horizontal). */
  entryFpaDeg: number
  /** Altitude of Entry Interface above Earth's equatorial radius, km (default 121.92 = 400,000 ft). */
  entryAltKm?: number
  /** Altitude of the powered flyby's closest approach, km (default 100). */
  flybyAltKm?: number
}

export interface ReturnTransfer extends FlybyTransfer {
  /** The state at Entry Interface, Earth-centred (the path itself is Moon-centred, like every path here). */
  entry: { utcMs: number; speedKms: number; fpaDeg: number; latDeg: number; lonDeg: number }
  /** Ignition of the departure burn → Entry Interface. */
  returnDays: number
  /** Hyperbolic excess speed with which the flown path leaves the Moon after the flyby burn, km/s. */
  vInfKms: number
}

const NEAR_EARTH_KM = 250000 // a perigee counts as the return's only inside this distance from Earth

/** NRHO → Earth: NRHO departure burn, return powered flyby, trans-Earth coast to Entry Interface. The path
 *  starts on the NRHO a few minutes before the departure burn (result.start) and ends at Entry Interface. */
export function nrhoToEarth(input: ReturnInput): ReturnTransfer {
  const { ephem, nrho } = input
  const engine: EngineSpec = { thrustN: input.thrustN, ispS: input.ispS }
  const field = nrho.field
  const rFly = R_MOON + (input.flybyAltKm ?? 100)
  const rEi = R_EARTH_EQ + (input.entryAltKm ?? 121.92)
  const gamma = (input.entryFpaDeg * Math.PI) / 180
  if (!(gamma < 0 && gamma > -Math.PI / 4)) throw new NrhoError('nrhoToEarth: the flight-path angle at Entry Interface must be negative and shallower than −45°')
  const sinG = Math.sin(gamma)
  const cosG = Math.cos(gamma)
  const LEAD_MS = 10 * 60000 // the path starts this long before the middle of the departure burn
  const firstMs = Math.max(input.earliestMs, nrho.startMs + LEAD_MS)
  const lastMs = Math.min(input.earliestMs + (input.windowDays ?? NRHO_PERIOD_S / 86400) * DAY_MS, nrho.endMs)
  if (!(lastMs >= firstMs)) throw new NrhoError('nrhoToEarth: the departure window lies outside the span of the NRHO; ask nrhoAround for a span that covers it')
  let geo: EarthField
  try {
    const mid = 0.5 * (firstMs + lastMs)
    // J2 matters on the last hours of the fall; Earth's axis hardly moves in two weeks
    geo = earthField(ephem, firstMs - HOUR_MS, Math.min(lastMs + 12 * DAY_MS, ephem.endMs - EDGE_MS), qrot(ephem.earthFixedToInertial(mid), [0, 0, 1]))
  } catch (err) {
    if (err instanceof RangeError) throw new NrhoError('nrhoToEarth: the ephemeris does not cover the departure window')
    throw err
  }
  const outside = new NrhoError('nrhoToEarth: no return found (the ephemeris may end before the entry: a return takes about six days from the NRHO departure)')

  // ---- The way home as a two-body orbit about Earth: from the Moon's place at tpMs (flyby) to Entry Interface.
  // q = apogee radius / Moon's distance (≥ 1), phi = tilt of the orbit plane about the Earth–Moon line.
  interface EarthLeg {
    tEiMs: number
    rEi: Vec3
    vEi: Vec3 // Earth-centred state at Entry Interface
    vInf: Vec3 // velocity relative to the Moon when leaving it
  }
  const earthLeg = (tpMs: number, q: number, phi: number): EarthLeg | null => {
    let moon: { r: Vec3; v: Vec3 }
    try {
      moon = geo.moonState(tpMs)
    } catch (err) {
      if (err instanceof RangeError) return null
      throw err
    }
    const r1 = norm(moon.r)
    const ra = q * r1
    // perigee for which the path crosses the entry radius at the asked angle: h = rEi vEi cos γ
    let rp = rEi * cosG * cosG
    for (let i = 0; i < 6; i++) {
      const a = 0.5 * (rp + ra)
      const h2 = rEi * rEi * MU_EARTH * (2 / rEi - 1 / a) * cosG * cosG
      rp = a * (1 - Math.sqrt(Math.max(0, 1 - h2 / (MU_EARTH * a))))
    }
    const el = ellipse(rp, ra)
    const nu1 = trueAnomalyAtRadius(el, r1)
    const nuE = trueAnomalyAtRadius(el, rEi)
    const fallS = timeFromPeriapsis(MU_EARTH, el, nu1) - timeFromPeriapsis(MU_EARTH, el, nuE)
    const rHat = unit(moon.r)
    const nHat = unit(cross(moon.r, moon.v))
    const tHat = cross(nHat, rHat)
    const along = add(scale(tHat, Math.cos(phi)), scale(nHat, Math.sin(phi))) // direction of the sideways speed
    const h = unit(cross(rHat, along))
    const P = rotateAbout(rHat, h, nu1) // perigee direction: the Moon's place is nu1 before it
    const Q = cross(h, P)
    const atMoon = perifocal(el, MU_EARTH, -nu1, P, Q)
    const atEntry = perifocal(el, MU_EARTH, -nuE, P, Q)
    return { tEiMs: tpMs + fallS * 1000, rEi: atEntry.r, vEi: atEntry.v, vInf: sub(atMoon.v, moon.v) }
  }

  // ---- The flyby seen backwards in time: a hyperbola that comes in along −vInf and has its perilune at rFly.
  // theta is the direction of its B vector in the plane across the asymptote.
  const bBasis = (S: Vec3): { T: Vec3; R: Vec3 } => {
    let T = cross(S, [0, 0, 1])
    if (norm(T) < 0.05) T = cross(S, [1, 0, 0])
    T = unit(T)
    return { T, R: cross(S, T) }
  }
  const perilune = (vInf: Vec3, theta: number): { r: Vec3; v: Vec3 } => {
    const S = scale(unit(vInf), -1)
    const { T, R } = bBasis(S)
    const b = add(scale(T, Math.cos(theta)), scale(R, Math.sin(theta)))
    const h = cross(b, S)
    const W = cross(h, S)
    const e = 1 + (rFly * dot(vInf, vInf)) / MU_MOON
    const cb = 1 / e
    const sb = Math.sqrt(1 - cb * cb)
    const P = add(scale(S, cb), scale(W, -sb))
    const Q = add(scale(W, cb), scale(S, sb))
    return { r: scale(P, rFly), v: scale(Q, Math.sqrt(dot(vInf, vInf) + (2 * MU_MOON) / rFly)) }
  }

  // ---- 1. Two-body search over the flyby instant and the departure instant (q = 1, φ = 0). A change of plane
  // at the flyby, at 2.4 km/s, is the dearest thing there is, so θ is not searched but taken such that the
  // hyperbola lies in the plane through the NRHO's position at the departure (either way round the Moon).
  interface Candidate {
    tpMs: number
    theta: number
    tDepMs: number
    rpf: Vec3 // flyby burn (forward in time: velocity after − before), km/s
    cost: number
  }
  const candidates: Candidate[] = []
  for (let tpMs = firstMs + 4 * HOUR_MS; tpMs <= lastMs + 3 * DAY_MS; tpMs += HOUR_MS) {
    const leg = earthLeg(tpMs, 1, 0)
    if (!leg) break
    const S = scale(unit(leg.vInf), -1)
    const { T, R } = bBasis(S)
    let best: Candidate | null = null
    for (let before = 4 * 3600; before <= 3 * 86400; before += 3600) {
      const tDepMs = tpMs - before * 1000
      if (tDepMs < firstMs) break
      if (tDepMs > lastMs) continue
      const from = nrho.stateAt(tDepMs)
      const across = cross(S, from.r)
      if (norm(across) < 1e-3 * norm(from.r)) continue
      for (const sense of [1, -1]) {
        const h = scale(unit(across), sense)
        const b = cross(S, h)
        const theta = Math.atan2(dot(b, R), dot(b, T))
        const per = perilune(leg.vInf, theta)
        // backwards in time: from the perilune to the NRHO's position, round the Moon in the sense of h
        const lam = lambert(per.r, from.r, before, MU_MOON, dot(cross(per.r, from.r), h) < 0)
        if (!lam) continue
        const rpf = sub(lam.v1, per.v)
        const cost = norm(rpf) + norm(add(lam.v2, from.v))
        if (!best || cost < best.cost) best = { tpMs, theta, tDepMs, rpf, cost }
      }
    }
    if (best) candidates.push(best)
  }
  if (!candidates.length) throw outside
  candidates.sort((a, b) => a.cost - b.cost)

  // ---- 2. The real field, instantaneous burns, designed backwards from Entry Interface.
  interface Per {
    tMs: number // on the backward clock of its pivot
    r: Vec3
    v: Vec3 // backward velocity
  }
  /** The entry state of `leg`, with its speed changed by x[0] m/s and its heading turned by x[1] mrad about
   *  the local vertical, flown back in time to its closest approach to the Moon. */
  const backFromEntry = (leg: EarthLeg, x: number[]): Per | null => {
    const pivot = leg.tEiMs
    const up = unit(leg.rEi)
    const speed = norm(leg.vEi) + x[0] / 1000
    const level = rotateAbout(unit(sub(leg.vEi, scale(up, dot(leg.vEi, up)))), up, x[1] * 1e-3)
    const v = add(scale(up, speed * sinG), scale(level, speed * cosG))
    try {
      const geoBack = reversedEarthField(geo, pivot)
      const moon = geoBack.moonState(pivot)
      const fl = new Flight(reversedField(field, pivot), pivot, sub(leg.rEi, moon.r), sub(scale(v, -1), moon.v), 1, false)
      fl.frame(geoBack)
      // Earth-centred up to the Moon's sphere of influence; a path that misses it ends at its closest approach
      const met = fl.coast(9 * 86400, (s, utcMs) => {
        const m = geoBack.moonState(utcMs)
        const d = sub(s.r, m.r)
        const dist = norm(d)
        return dist <= SOI_MOON ? 1 : dist < 300000 ? dot(d, sub(s.v, m.v)) : -1
      })
      if (!met) return null
      fl.frame(null)
      if (norm(fl.s.r) <= SOI_MOON + 1) {
        const found = fl.coast(10 * 86400, (s) => {
          const r2 = dot(s.r, s.r)
          return r2 < CRASH_KM * CRASH_KM ? 1 : dot(s.r, s.v)
        })
        if (!found || norm(fl.s.r) < 1.01 * CRASH_KM) return null
      }
      return { tMs: fl.tMs, r: fl.s.r, v: fl.s.v }
    } catch (err) {
      if (err instanceof RangeError) return null
      throw err
    }
  }
  /** Entry speed and heading (as backFromEntry takes them) for a flyby at the wanted altitude with the
   *  B-vector direction theta, by Newton iteration from `guess`. */
  const aimAt = (leg: EarthLeg, theta: number, guess: number[]): { x: number[]; per: Per } | null => {
    const back = remembered((x: number[]) => backFromEntry(leg, x))
    const miss = (x: number[]): number[] | null => {
      const per = back(x)
      const b = per && bPlane(per.r, per.v)
      if (!b) return null
      const { T, R } = bBasis(b.S)
      const bMag = Math.sqrt(rFly * rFly + (2 * MU_MOON * rFly) / b.vInf2)
      return [dot(b.B, T) - bMag * Math.cos(theta), dot(b.B, R) - bMag * Math.sin(theta)]
    }
    // 1 m/s of entry speed moves the far end of the orbit by thousands of kilometres: small units
    const sol = newton(miss, guess, [0.05, 0.05], 1e-3, 60)
    const per = sol && back(sol.x)
    return sol && per ? { x: sol.x, per } : null
  }
  interface Shot {
    tDepMs: number
    tpMs: number // the flyby (true clock)
    rp: Vec3
    vAfter: Vec3 // at the flyby, after the burn (forward velocity)
    rpf: Vec3
    nrd: Vec3
    total: number
  }
  /** The real-field cost of a candidate as a function of z: flyby instant (h), θ (degrees), departure instant
   *  (h), φ (degrees), apogee ratio q − 1; null when the candidate cannot be flown at all. */
  const inRealField = (cand: Candidate): ((z: number[]) => Shot | null) | null => {
    // The two-body guess of the entry state may miss the Moon by thousands of kilometres: aim it once, and
    // start every later aiming from that correction.
    const leg0 = earthLeg(cand.tpMs, 1, 0)
    const aim0 = leg0 && aimAt(leg0, cand.theta, [0, 0])
    if (!aim0) return null
    return remembered((z: number[]) => {
      const q = 1 + z[4]
      const tDepMs = cand.tDepMs + z[2] * HOUR_MS
      if (q < 1 || q > 3 || tDepMs < firstMs || tDepMs > lastMs) return null
      const leg = earthLeg(cand.tpMs + z[0] * HOUR_MS, q, (z[3] * Math.PI) / 180)
      const aim = leg && aimAt(leg, cand.theta + (z[1] * Math.PI) / 180, aim0.x)
      if (!leg || !aim) return null
      const tpMs = 2 * leg.tEiMs - aim.per.tMs
      if (!(tpMs > tDepMs + 600e3)) return null
      const from = nrho.stateAt(tDepMs)
      const back = reversedField(field, leg.tEiMs)
      const coastFrom = remembered((rpfMs: number[]): SimState | null => {
        try {
          const run = integrate(back, { r: aim.per.r, v: add(aim.per.v, scale(rpfMs as Vec3, 1e-3)), m: 1 }, aim.per.tMs, {
            maxSeconds: (tpMs - tDepMs) / 1000,
            maxStepS: COAST_STEP_S,
            tol: SHOT_TOL,
            stop: crashStop,
          })
          return run.stopped ? null : run.end
        } catch (err) {
          if (err instanceof RangeError) return null
          throw err
        }
      })
      const sol = newton((x) => {
        const end = coastFrom(x)
        return end ? sub(end.r, from.r) : null
      }, scale(cand.rpf, 1000), [1, 1, 1], 1e-3)
      const end = sol && coastFrom(sol.x)
      if (!sol || !end) return null
      const rpf = scale(sol.x as Vec3, 1e-3)
      const nrd = scale(add(end.v, from.v), -1)
      return { tDepMs, tpMs, rp: aim.per.r, vAfter: scale(aim.per.v, -1), rpf, nrd, total: norm(rpf) + norm(nrd) }
    })
  }
  // The two-body costs are rough (Earth pulls hard on the far part of the NRHO): the best candidates are
  // costed in the real field as they stand, and the simplex search starts from the cheapest, and from the
  // cheapest that is another flyby altogether (half a day away or the other way round the Moon).
  const Z0 = [0, 0, 0, 0, 0.02]
  const costed: { cand: Candidate; at: (z: number[]) => Shot | null; total: number }[] = []
  for (const cand of candidates) {
    if (costed.length >= 6) break
    if (costed.some((c) => Math.abs(c.cand.tpMs - cand.tpMs) < 3 * HOUR_MS && Math.cos(c.cand.theta - cand.theta) > 0)) continue
    const at = inRealField(cand)
    const first = at && at(Z0)
    if (at && first) costed.push({ cand, at, total: first.total })
  }
  costed.sort((a, b) => a.total - b.total)
  let imp: Shot | null = null
  const other = costed.find((c) => Math.abs(c.cand.tpMs - costed[0].cand.tpMs) > 12 * HOUR_MS || Math.cos(c.cand.theta - costed[0].cand.theta) < 0)
  for (const c of other ? [costed[0], other] : costed.slice(0, 1)) {
    const opt = nelderMead((z) => c.at(z)?.total ?? Infinity, Z0, [1.5, 4, 1.5, 15, 0.04], 0.02, 220)
    const s = c.at(opt.x)
    if (s && (!imp || s.total < imp.total)) imp = s
  }
  if (!imp) throw outside

  // ---- 3. Finite burns, flown forwards. Both burns are centred on their instantaneous counterparts; the
  // unknowns are their delta-v vectors (the departure burn fixed in space, the flyby burn along the velocity,
  // the orbit normal and across the velocity, turning with the craft). Conditions: the radius of the closest
  // approach and the flight-path angle at Entry Interface. Four more unknowns than conditions: each Newton step
  // is the smallest one, so the burns stay next to the cheapest instantaneous ones.
  const sol0 = imp
  const mass = input.massKg
  const ve = G0 * engine.ispS
  const tauNrd = burnSeconds(engine, mass, norm(sol0.nrd))
  const tauRpf = burnSeconds(engine, mass * Math.exp((-norm(sol0.nrd) * 1000) / ve), norm(sol0.rpf))
  refuseLongBurn('nrhoToEarth', 'return powered flyby', tauRpf, engine)
  const startMs = Math.max(nrho.startMs, sol0.tDepMs - LEAD_MS)
  const s0 = nrho.stateAt(startMs)
  const rpfLocal = toVnb(sol0.rp, sub(sol0.vAfter, sol0.rpf), sol0.rpf)
  // Earth-centred: +1 at or below the entry radius, else the range rate once near Earth (zero at a perigee
  // that stays above the atmosphere)
  const entryOrPerigee = (s: SimState) => {
    const r2 = dot(s.r, s.r)
    return r2 <= rEi * rEi ? 1 : r2 < NEAR_EARTH_KM * NEAR_EARTH_KM ? dot(s.r, s.v) : -1
  }
  const fly = (x: number[], keep: boolean): { fl: Flight; rMin: number; vInfKms: number; home: boolean } => {
    const fl = new Flight(field, startMs, s0.r, s0.v, mass, keep)
    fl.coastTo(Math.max(startMs, sol0.tDepMs - (tauNrd / 2) * 1000))
    fixedBurn(fl, engine, 'nrd', 'NRHO Departure (NRD)', [sol0.nrd[0] + x[0] / 1000, sol0.nrd[1] + x[1] / 1000, sol0.nrd[2] + x[2] / 1000])
    fl.coastTo(sol0.tpMs - (tauRpf / 2) * 1000)
    const rMin = flybyBurn(fl, engine, 'rpf', 'Return Powered Flyby (RPF)', [rpfLocal[0] + x[3] / 1000, rpfLocal[1] + x[4] / 1000, rpfLocal[2] + x[5] / 1000])
    const vInf2 = dot(fl.s.v, fl.s.v) - (2 * MU_MOON) / norm(fl.s.r)
    // away from the Moon in Moon-centred coordinates, then Earth-centred (see moonwardCoast)
    if (!fl.coast(4 * 86400, (s) => norm(s.r) - SOI_MOON)) throw new RangeError('the flyby does not leave the Moon')
    fl.frame(geo)
    const home = fl.coast(10 * 86400, entryOrPerigee)
    return { fl, rMin, vInfKms: Math.sqrt(Math.max(0, vInf2)), home }
  }
  // cos γ where the path meets the entry radius; continued smoothly (> 1) for a perigee above it
  const entryCos = (s: SimState): number => {
    const rn = norm(s.r)
    if (rn > rEi * (1 + 1e-9)) return 1 + (rn - rEi) / rEi
    const sinNow = dot(s.r, s.v) / (rn * norm(s.v))
    return Math.sqrt(Math.max(0, 1 - sinNow * sinNow))
  }
  const residual = (x: number[]): number[] | null => {
    try {
      const { fl, rMin, home } = fly(x, false)
      if (!home) return null
      // second condition in units of 0.05° of flight-path angle, so that one tolerance serves both
      return [rMin - rFly, ((entryCos(fl.s) - cosG) / -sinG) * (180 / Math.PI) * 20]
    } catch (err) {
      if (err instanceof RangeError || err instanceof NrhoError) return null
      throw err
    }
  }
  // Tolerance: 10 m at the flyby and 0.0005° at the entry (22 m of perigee height).
  const sol = newton(residual, [0, 0, 0, 0, 0, 0], [3, 3, 3, 3, 3, 3], ARRIVAL_TOL, 60)
  if (!sol) {
    throw new NrhoError(
      `nrhoToEarth: the finite-burn return did not converge. With instantaneous burns it costs ${sol0.total.toFixed(2)} km/s; at ${engine.thrustN} N the departure burn ` +
        `lasts ${tauNrd.toFixed(0)} s and the flyby burn ${tauRpf.toFixed(0)} s, which may be too long to be flown as one push each (a wider departure window gives a cheaper return)`,
    )
  }
  const { fl, vInfKms } = fly(sol.x, true)
  const tEiMs = fl.tMs
  const atEi = fl.s // Earth-centred
  const up = unit(atEi.r)
  const fixed = qrot(qconj(ephem.earthFixedToInertial(tEiMs)), up)
  const entry = {
    utcMs: tEiMs,
    speedKms: norm(atEi.v),
    fpaDeg: (Math.asin(dot(up, unit(atEi.v))) * 180) / Math.PI,
    latDeg: (Math.asin(fixed[2]) * 180) / Math.PI,
    lonDeg: (Math.atan2(fixed[1], fixed[0]) * 180) / Math.PI,
  }
  const end: TransferState = { utcMs: tEiMs, r: [atEi.r[0], atEi.r[1], atEi.r[2]], v: [atEi.v[0], atEi.v[1], atEi.v[2]], massKg: atEi.m, frame: 'earth' }
  fl.frame(null)
  return {
    ...finish(fl, sol0.total, [sol0.nrd, sol0.rpf]),
    end,
    flyby: closestApproach(fl),
    entry,
    returnDays: (tEiMs - fl.events[0].utcMs) / DAY_MS,
    vInfKms,
  }
}
