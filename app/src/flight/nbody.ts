// Numerical flight under gravity: the spacecraft's equations of motion in the Earth-centred J2000 frame with
// Earth, the Moon and the Sun as point masses, integrated with an adaptive Dormand–Prince 5(4) scheme.
//
//   r'' = −μE r/|r|³ − Σ μb [ (r − rb)/|r − rb|³ + rb/|rb|³ ]      b = Moon, Sun
//
// The second term in the bracket is the pull of the body on Earth itself: the frame is centred on Earth, which
// falls toward the Moon and the Sun too. Not modelled: Earth's oblateness (J2), solar radiation pressure, the
// Moon's uneven gravity. Positions of the Moon and the Sun come from the ephemeris through a table with cubic
// interpolation, so the force is smooth and a step costs no ephemeris lookups.
import { MU_EARTH, MU_MOON } from './astro'
import type { FlightEphemeris, Vec3 } from './types'

// GM of the Sun: JPL DE440, https://ssd.jpl.nasa.gov/astro_par.html
export const MU_SUN = 132712440041.279419 // km^3/s^2

const TABLE_STEP_MS = 30 * 60_000 // the ephemeris files' own step; the grid is aligned to it

/** Positions of one body on a uniform time grid, read back with Catmull–Rom cubics (and their derivative). */
export interface BodyTable {
  t0: number // UTC ms of sample 0
  stepMs: number
  n: number
  p: Float64Array // 3 n
}

export function makeBodyTable(pos: (utcMs: number) => Vec3, fromMs: number, toMs: number, stepMs = TABLE_STEP_MS): BodyTable {
  // one sample before and two after the span, so every instant inside it has four neighbours
  const t0 = Math.floor(fromMs / stepMs) * stepMs - stepMs
  const n = Math.ceil((toMs - t0) / stepMs) + 3
  const p = new Float64Array(3 * n)
  for (let i = 0; i < n; i++) p.set(pos(t0 + i * stepMs), 3 * i)
  return { t0, stepMs, n, p }
}

/** Position (out) and, when asked, velocity (km/s) of the body at utcMs. */
export function tableState(tab: BodyTable, utcMs: number, pos: Vec3, vel?: Vec3): void {
  const x = (utcMs - tab.t0) / tab.stepMs
  const i = Math.floor(x)
  if (i < 1 || i > tab.n - 3) throw new RangeError('body table: instant outside the tabulated span')
  const u = x - i
  const p = tab.p
  const b = 3 * i
  const hS = tab.stepMs / 1000
  for (let k = 0; k < 3; k++) {
    const p0 = p[b - 3 + k]
    const p1 = p[b + k]
    const p2 = p[b + 3 + k]
    const p3 = p[b + 6 + k]
    const c1 = 0.5 * (p2 - p0)
    const c2 = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3
    const c3 = 0.5 * (p3 - p0) + 1.5 * (p1 - p2)
    pos[k] = p1 + u * (c1 + u * (c2 + u * c3))
    if (vel) vel[k] = (c1 + u * (2 * c2 + 3 * u * c3)) / hS
  }
}

export interface Gravity {
  moon: BodyTable
  sun: BodyTable | null
  /** Acceleration (km/s²) at Earth-centred position r and instant utcMs, written into out. */
  accel(r: Vec3, utcMs: number, out: Vec3): void
  moonState(utcMs: number): { r: Vec3; v: Vec3 }
}

/** Gravity field for [fromMs, toMs]. sun = false leaves the Sun out (tests of its effect). */
export function makeGravity(ephem: FlightEphemeris, fromMs: number, toMs: number, sun = true): Gravity {
  const moon = makeBodyTable(ephem.moonPos, fromMs, toMs)
  const sunTab = sun ? makeBodyTable(ephem.sunPos, fromMs, toMs) : null
  const rb: Vec3 = [0, 0, 0]
  const third = (tab: BodyTable, mu: number, r: Vec3, utcMs: number, out: Vec3) => {
    tableState(tab, utcMs, rb)
    const dx = r[0] - rb[0]
    const dy = r[1] - rb[1]
    const dz = r[2] - rb[2]
    const d3 = Math.pow(dx * dx + dy * dy + dz * dz, 1.5)
    const b3 = Math.pow(rb[0] * rb[0] + rb[1] * rb[1] + rb[2] * rb[2], 1.5)
    out[0] -= mu * (dx / d3 + rb[0] / b3)
    out[1] -= mu * (dy / d3 + rb[1] / b3)
    out[2] -= mu * (dz / d3 + rb[2] / b3)
  }
  return {
    moon,
    sun: sunTab,
    accel(r, utcMs, out) {
      const r3 = Math.pow(r[0] * r[0] + r[1] * r[1] + r[2] * r[2], 1.5)
      out[0] = (-MU_EARTH * r[0]) / r3
      out[1] = (-MU_EARTH * r[1]) / r3
      out[2] = (-MU_EARTH * r[2]) / r3
      third(moon, MU_MOON, r, utcMs, out)
      if (sunTab) third(sunTab, MU_SUN, r, utcMs, out)
    },
    moonState(utcMs) {
      const r: Vec3 = [0, 0, 0]
      const v: Vec3 = [0, 0, 0]
      tableState(moon, utcMs, r, v)
      return { r, v }
    },
  }
}

// ---------- Dormand–Prince 5(4) ----------

const A = [
  [],
  [1 / 5],
  [3 / 40, 9 / 40],
  [44 / 45, -56 / 15, 32 / 9],
  [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
  [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
]
const C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1]
// fifth-order weights minus fourth-order weights: the error estimate
const E = [71 / 57600, 0, -71 / 16695, 71 / 1920, -17253 / 339200, 22 / 525, -1 / 40]

export interface State {
  r: Vec3
  v: Vec3
}

/** One Dormand–Prince step of h seconds from (t0Ms, y). Returns the new state and the scaled error (≤ 1 passes). */
function dpStep(g: Gravity, t0Ms: number, y: Float64Array, h: number, k: Float64Array[], out: Float64Array): number {
  const r: Vec3 = [0, 0, 0]
  const a: Vec3 = [0, 0, 0]
  const tmp = new Float64Array(6)
  for (let s = 0; s < 7; s++) {
    for (let i = 0; i < 6; i++) {
      let acc = y[i]
      for (let j = 0; j < s; j++) acc += h * A[s][j] * k[j][i]
      tmp[i] = acc
    }
    r[0] = tmp[0]
    r[1] = tmp[1]
    r[2] = tmp[2]
    g.accel(r, t0Ms + C[s] * h * 1000, a)
    const ks = k[s]
    ks[0] = tmp[3]
    ks[1] = tmp[4]
    ks[2] = tmp[5]
    ks[3] = a[0]
    ks[4] = a[1]
    ks[5] = a[2]
    if (s === 6) out.set(tmp) // stage 7 is evaluated at the fifth-order result
  }
  // scaled error: 1 mm + 1e-10 of the radius in position, 1e-9 km/s + 1e-10 of the speed in velocity
  const rn = Math.hypot(out[0], out[1], out[2])
  const vn = Math.hypot(out[3], out[4], out[5])
  const scR = 1e-6 + 1e-10 * rn
  const scV = 1e-9 + 1e-10 * vn
  let err = 0
  for (let i = 0; i < 6; i++) {
    let e = 0
    for (let s = 0; s < 7; s++) e += E[s] * k[s][i]
    err = Math.max(err, Math.abs(h * e) / (i < 3 ? scR : scV))
  }
  return err
}

export interface Propagation {
  t: number[] // UTC ms of every accepted step, starting with the initial instant
  r: Vec3[]
  v: Vec3[]
  /** Closest approach to the Moon, when the run was asked to stop there and found it. */
  perilune: { utcMs: number; r: Vec3; v: Vec3; rRel: Vec3; vRel: Vec3 } | null
}

export interface PropagateOptions {
  maxSeconds: number
  maxStepS?: number // cap on the step: keeps the stored path dense enough to draw (default 900 s)
  stopAtPerilune?: boolean // stop at the first minimum of the distance to the Moon inside nearKm
  nearKm?: number
}

const MAX_STEPS = 200000

/** Integrates from s0 at t0Ms. With stopAtPerilune the last stored point is the perilune itself. */
export function propagate(g: Gravity, s0: State, t0Ms: number, opt: PropagateOptions): Propagation {
  const hMax = opt.maxStepS ?? 900
  const near = opt.nearKm ?? 120000
  const k = Array.from({ length: 7 }, () => new Float64Array(6))
  let y = Float64Array.of(s0.r[0], s0.r[1], s0.r[2], s0.v[0], s0.v[1], s0.v[2])
  let yNew = new Float64Array(6)
  const out: Propagation = { t: [t0Ms], r: [[y[0], y[1], y[2]]], v: [[y[3], y[4], y[5]]], perilune: null }
  const mr: Vec3 = [0, 0, 0]
  const mv: Vec3 = [0, 0, 0]
  // range × range rate relative to the Moon: negative while approaching, zero at the perilune
  const rangeRate = (yy: Float64Array, utcMs: number) => {
    tableState(g.moon, utcMs, mr, mv)
    const dx = yy[0] - mr[0]
    const dy = yy[1] - mr[1]
    const dz = yy[2] - mr[2]
    return { rr: dx * (yy[3] - mv[0]) + dy * (yy[4] - mv[1]) + dz * (yy[5] - mv[2]), dist: Math.hypot(dx, dy, dz) }
  }
  if (!Number.isFinite(opt.maxSeconds)) throw new RangeError('propagate: maxSeconds must be finite')
  let tS = 0
  let h = 10
  let prev = rangeRate(y, t0Ms)
  let guard = 0
  for (; guard < MAX_STEPS && tS < opt.maxSeconds; guard++) {
    h = Math.min(h, hMax, opt.maxSeconds - tS)
    const err = dpStep(g, t0Ms + tS * 1000, y, h, k, yNew)
    // !(err <= 1) also rejects a step whose error is NaN (sim.ts does the same); for any number the
    // control is the one it always was
    if (!(err <= 1)) {
      h *= Math.max(0.2, 0.9 * Math.pow(Number.isFinite(err) ? err : 1e6, -0.2))
      if (h < 1e-9) throw new RangeError('propagate: step size underflow')
      continue
    }
    const tNew = tS + h
    const now = rangeRate(yNew, t0Ms + tNew * 1000)
    if (opt.stopAtPerilune && prev.rr < 0 && now.rr >= 0 && now.dist < near) {
      // The perilune lies inside this step: bisect the step length until the range rate vanishes.
      let lo = 0
      let hi = h
      const yMid = new Float64Array(6)
      for (let it = 0; it < 50 && hi - lo > 1e-6; it++) {
        const mid = 0.5 * (lo + hi)
        dpStep(g, t0Ms + tS * 1000, y, mid, k, yMid)
        if (rangeRate(yMid, t0Ms + (tS + mid) * 1000).rr < 0) lo = mid
        else hi = mid
      }
      const hp = 0.5 * (lo + hi)
      dpStep(g, t0Ms + tS * 1000, y, hp, k, yMid)
      const utcMs = t0Ms + (tS + hp) * 1000
      tableState(g.moon, utcMs, mr, mv)
      const r: Vec3 = [yMid[0], yMid[1], yMid[2]]
      const v: Vec3 = [yMid[3], yMid[4], yMid[5]]
      out.t.push(utcMs)
      out.r.push(r)
      out.v.push(v)
      out.perilune = {
        utcMs,
        r,
        v,
        rRel: [r[0] - mr[0], r[1] - mr[1], r[2] - mr[2]],
        vRel: [v[0] - mv[0], v[1] - mv[1], v[2] - mv[2]],
      }
      return out
    }
    tS = tNew
    const swap = y
    y = yNew
    yNew = swap
    prev = now
    out.t.push(t0Ms + tS * 1000)
    out.r.push([y[0], y[1], y[2]])
    out.v.push([y[3], y[4], y[5]])
    h *= Math.min(5, Math.max(0.2, 0.9 * Math.pow(Math.max(err, 1e-10), -0.2)))
  }
  if (guard >= MAX_STEPS && tS < opt.maxSeconds) throw new RangeError('propagate: step limit reached before maxSeconds')
  return out
}
