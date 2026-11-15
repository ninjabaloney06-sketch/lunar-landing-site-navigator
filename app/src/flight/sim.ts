// Powered flight: one integrator for every phase of a mission. State = position, velocity and mass of one
// vehicle relative to the centre of a gravity field; forces = that field, an optional engine (thrust vector and
// propellant flow from a steering law) and an optional extra acceleration (air drag). Adaptive Dormand–Prince
// 5(4), the same scheme as nbody.ts, with an event function that stops the run exactly where it crosses zero.
//
// Units: km, km/s, kg, seconds from the run's start, UTC ms for the epoch. Thrust in newtons.
import { MU_EARTH, MU_MOON, R_EARTH_EQ, G0 } from './astro'
import { MU_SUN, makeBodyTable, tableState } from './nbody'
import type { BodyTable } from './nbody'
import type { FlightEphemeris, Vec3 } from './types'
import { qrot, unit } from './vec'

/** Earth's second zonal harmonic (EGM96 value): the pull of the equatorial bulge. */
export const J2_EARTH = 1.08262668e-3

/** Gravitational acceleration (km/s²) at position r relative to the field's centre, at instant utcMs. */
export interface Field {
  centre: 'earth' | 'moon'
  accel(r: Vec3, utcMs: number, out: Vec3): void
}

export interface SimState {
  r: Vec3
  v: Vec3
  m: number // kg
}

/** An engine setting: writes the thrust vector (N, any direction and size) into out and returns the propellant
 *  flow (kg/s, ≥ 0). Called at every stage of every step, so it must be a smooth function while it is in use;
 *  ignitions, cut-offs and stagings are run boundaries, not something this function switches inside a run. */
export type Engine = (tS: number, s: SimState, outForceN: Vec3) => number

/** Engine at a fixed thrust and specific impulse, pointed by a steering law that returns a unit vector. */
export function constantThrust(thrustN: number, ispS: number, dir: (tS: number, s: SimState) => Vec3): Engine {
  const flow = thrustN / (G0 * ispS)
  return (tS, s, out) => {
    const d = dir(tS, s)
    out[0] = thrustN * d[0]
    out[1] = thrustN * d[1]
    out[2] = thrustN * d[2]
    return flow
  }
}

export interface SimOptions {
  maxSeconds: number
  maxStepS?: number // cap on the step (default 900 s); also sets how densely the path is stored
  engine?: Engine | null
  /** Extra acceleration (km/s²) added to gravity and thrust, for example air drag. */
  extra?: ((tS: number, s: SimState, utcMs: number, out: Vec3) => void) | null
  /** Event: the run stops at the first instant this function goes from negative to zero or positive. */
  stop?: ((tS: number, s: SimState, utcMs: number) => number) | null
  /** Relative tolerance of the step control (default 1e-10; 1e-8 is plenty for an atmosphere flight). */
  tol?: number
}

export interface SimRun {
  t: number[] // seconds from the start, one entry per accepted step, starting with 0
  r: Vec3[]
  v: Vec3[]
  m: number[]
  stopped: boolean // true when the stop event ended the run (the last sample is the event itself)
  end: SimState
  endS: number
}

// Dormand–Prince 5(4) tableau
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
const E = [71 / 57600, 0, -71 / 16695, 71 / 1920, -17253 / 339200, 22 / 525, -1 / 40]

/** Integrates one continuous phase (one engine setting) from s0 at t0Ms. */
export function integrate(field: Field, s0: SimState, t0Ms: number, opt: SimOptions): SimRun {
  const hMax = opt.maxStepS ?? 900
  const tol = opt.tol ?? 1e-10
  const k = Array.from({ length: 7 }, () => new Float64Array(7))
  const tmp = new Float64Array(7)
  const st: SimState = { r: [0, 0, 0], v: [0, 0, 0], m: 0 }
  const a: Vec3 = [0, 0, 0]
  const f: Vec3 = [0, 0, 0]
  const x: Vec3 = [0, 0, 0]
  const load = (y: Float64Array) => {
    st.r[0] = y[0]
    st.r[1] = y[1]
    st.r[2] = y[2]
    st.v[0] = y[3]
    st.v[1] = y[4]
    st.v[2] = y[5]
    st.m = y[6]
    return st
  }
  // dy/dt at (tS, y) into ks
  const deriv = (tS: number, y: Float64Array, ks: Float64Array) => {
    const s = load(y)
    const utcMs = t0Ms + tS * 1000
    field.accel(s.r, utcMs, a)
    let flow = 0
    if (opt.engine) {
      flow = opt.engine(tS, s, f)
      // N / kg = m/s²; ÷ 1000 → km/s²
      a[0] += f[0] / s.m / 1000
      a[1] += f[1] / s.m / 1000
      a[2] += f[2] / s.m / 1000
    }
    if (opt.extra) {
      opt.extra(tS, s, utcMs, x)
      a[0] += x[0]
      a[1] += x[1]
      a[2] += x[2]
    }
    ks[0] = y[3]
    ks[1] = y[4]
    ks[2] = y[5]
    ks[3] = a[0]
    ks[4] = a[1]
    ks[5] = a[2]
    ks[6] = -flow
  }
  // k[0] holds dy/dt at the start of the step when k0Valid. The first stage is evaluated at exactly (tS, y),
  // whatever h is, so a rejected step, every trial of the event bisection and the step after an accepted one
  // (whose last stage was evaluated at exactly the new (tS, y): C[6] = 1, the same sum tS + h, and out = tmp)
  // can take it from there instead of evaluating it again. The derivative is a function of (tS, y) only, so the
  // numbers are the same to the last bit.
  let k0Valid = false
  /** One step of h from (tS, y) into out; returns the scaled error (≤ 1 passes). */
  const step = (tS: number, y: Float64Array, h: number, out: Float64Array): number => {
    for (let s = k0Valid ? 1 : 0; s < 7; s++) {
      for (let i = 0; i < 7; i++) {
        let acc = y[i]
        for (let j = 0; j < s; j++) acc += h * A[s][j] * k[j][i]
        tmp[i] = acc
      }
      if (s === 6) out.set(tmp)
      deriv(tS + C[s] * h, tmp, k[s])
    }
    k0Valid = true
    const scR = 1e-6 + tol * Math.hypot(out[0], out[1], out[2])
    const scV = 1e-9 + tol * Math.hypot(out[3], out[4], out[5])
    const scM = 1e-6 + tol * out[6]
    let err = 0
    for (let i = 0; i < 7; i++) {
      let e = 0
      for (let s = 0; s < 7; s++) e += E[s] * k[s][i]
      err = Math.max(err, Math.abs(h * e) / (i < 3 ? scR : i < 6 ? scV : scM))
    }
    return err
  }
  const snap = (y: Float64Array): SimState => ({ r: [y[0], y[1], y[2]], v: [y[3], y[4], y[5]], m: y[6] })
  const stopAt = (tS: number, y: Float64Array) => opt.stop!(tS, load(y), t0Ms + tS * 1000)

  let y = Float64Array.of(s0.r[0], s0.r[1], s0.r[2], s0.v[0], s0.v[1], s0.v[2], s0.m)
  let yNew = new Float64Array(7)
  const run: SimRun = { t: [0], r: [[y[0], y[1], y[2]]], v: [[y[3], y[4], y[5]]], m: [y[6]], stopped: false, end: snap(y), endS: 0 }
  const push = (tS: number, yy: Float64Array) => {
    run.t.push(tS)
    run.r.push([yy[0], yy[1], yy[2]])
    run.v.push([yy[3], yy[4], yy[5]])
    run.m.push(yy[6])
  }
  let tS = 0
  let h = Math.min(1, hMax, opt.maxSeconds)
  let g0 = opt.stop ? stopAt(0, y) : -1
  for (let guard = 0; guard < 2_000_000 && tS < opt.maxSeconds - 1e-9; guard++) {
    h = Math.min(h, hMax, opt.maxSeconds - tS)
    const err = step(tS, y, h, yNew)
    if (!(err <= 1)) {
      h *= Math.max(0.2, 0.9 * Math.pow(Number.isFinite(err) ? err : 1e6, -0.2))
      if (h < 1e-9) throw new RangeError('integrate: step size underflow')
      continue
    }
    if (opt.stop) {
      const g1 = stopAt(tS + h, yNew)
      if (g0 < 0 && g1 >= 0) {
        // The event lies inside this step: bisect the step length.
        let lo = 0
        let hi = h
        const yMid = new Float64Array(7)
        for (let it = 0; it < 60 && hi - lo > 1e-7; it++) {
          const mid = 0.5 * (lo + hi)
          step(tS, y, mid, yMid)
          if (stopAt(tS + mid, yMid) < 0) lo = mid
          else hi = mid
        }
        step(tS, y, hi, yMid)
        push(tS + hi, yMid)
        run.stopped = true
        run.end = snap(yMid)
        run.endS = tS + hi
        return run
      }
      g0 = g1
    }
    tS += h
    const swap = y
    y = yNew
    yNew = swap
    // first stage of the next step = last stage of this one (first same as last)
    const k0 = k[0]
    k[0] = k[6]
    k[6] = k0
    push(tS, y)
    h *= Math.min(5, Math.max(0.2, 0.9 * Math.pow(Math.max(err, 1e-10), -0.2)))
  }
  run.end = snap(y)
  run.endS = tS
  return run
}

function thirdBody(tab: BodyTable, mu: number, sign: 1 | -1, r: Vec3, utcMs: number, rb: Vec3, out: Vec3) {
  tableState(tab, utcMs, rb)
  const bx = sign * rb[0]
  const by = sign * rb[1]
  const bz = sign * rb[2]
  const dx = r[0] - bx
  const dy = r[1] - by
  const dz = r[2] - bz
  const d3 = Math.pow(dx * dx + dy * dy + dz * dz, 1.5)
  const b3 = Math.pow(bx * bx + by * by + bz * bz, 1.5)
  out[0] -= mu * (dx / d3 + bx / b3)
  out[1] -= mu * (dy / d3 + by / b3)
  out[2] -= mu * (dz / d3 + bz / b3)
}

export interface EarthField extends Field {
  /** Moon position and velocity relative to Earth at utcMs (J2000 km, km/s). */
  moonState(utcMs: number): { r: Vec3; v: Vec3 }
}

/** Earth-centred J2000 field for [fromMs, toMs]: Earth with J2, the Moon and the Sun as third bodies.
 *  pole = Earth's spin axis (unit, J2000) for the J2 term; null leaves J2 out. */
export function earthField(ephem: FlightEphemeris, fromMs: number, toMs: number, pole: Vec3 | null = null): EarthField {
  const moon = makeBodyTable(ephem.moonPos, fromMs, toMs)
  const sun = makeBodyTable(ephem.sunPos, fromMs, toMs)
  const rb: Vec3 = [0, 0, 0]
  return {
    centre: 'earth',
    accel(r, utcMs, out) {
      const r2 = r[0] * r[0] + r[1] * r[1] + r[2] * r[2]
      const r1 = Math.sqrt(r2)
      const k = -MU_EARTH / (r2 * r1)
      out[0] = k * r[0]
      out[1] = k * r[1]
      out[2] = k * r[2]
      if (pole) {
        // a = −(3/2) J2 μ R² / r⁵ · [ r (1 − 5 s²) + 2 s r p ],  s = (r·p)/r, p = pole
        const s = (r[0] * pole[0] + r[1] * pole[1] + r[2] * pole[2]) / r1
        const c = (-1.5 * J2_EARTH * MU_EARTH * R_EARTH_EQ * R_EARTH_EQ) / (r2 * r2 * r1)
        const q = 1 - 5 * s * s
        out[0] += c * (r[0] * q + 2 * s * r1 * pole[0])
        out[1] += c * (r[1] * q + 2 * s * r1 * pole[1])
        out[2] += c * (r[2] * q + 2 * s * r1 * pole[2])
      }
      thirdBody(moon, MU_MOON, 1, r, utcMs, rb, out)
      thirdBody(sun, MU_SUN, 1, r, utcMs, rb, out)
    },
    moonState(utcMs) {
      const r: Vec3 = [0, 0, 0]
      const v: Vec3 = [0, 0, 0]
      tableState(moon, utcMs, r, v)
      return { r, v }
    },
  }
}

/** The Moon's second zonal harmonic J2 (unnormalised) and the reference radius it belongs to.
 *  J2 = 203.3 × 10⁻⁶ from the GRAIL gravity fields (Konopliv et al. 2014, Lemoine et al. 2013, Williams et al.
 *  2014), as tabulated in https://en.wikipedia.org/wiki/Gravitation_of_the_Moon ("Selected coefficients").
 *  Reference radius 1738.0 km: label of the GRAIL field GL0660B,
 *  https://pds-geosciences.wustl.edu/grail/grail-l-lgrs-5-rdr-v1/grail_1001/shadr/jggrx_0660b_sha.xml
 *  NOT YET VALIDATED BY THE SCIENCE LEAD: the term is off in every plan the app shows (MoonFieldOptions.j2) and
 *  is switched on only in the dispersion runs (dispersion.ts) and in tests that measure its effect. */
export const J2_MOON = 203.3e-6
export const J2_MOON_REF_RADIUS_KM = 1738.0
export const J2_MOON_SOURCE = 'https://en.wikipedia.org/wiki/Gravitation_of_the_Moon'

export interface MoonFieldOptions {
  /** Add the Moon's J2 (oblateness). Default false: the validated plans fly the Moon as a point mass. The spin
   *  axis is the Moon-fixed (MOON_ME) z axis at the middle of the span, held fixed: it moves by a few hundredths
   *  of a degree in a month, and the GRAIL fields' principal-axis frame differs from MOON_ME by well under 0.1°. */
  j2?: boolean
}

/** Moon-centred field (J2000 axes) for [fromMs, toMs]: the Moon as a point mass, Earth and the Sun as third
 *  bodies. Positions are relative to the Moon's centre; the Moon's own gravity field beyond the point mass is
 *  not modelled unless opts.j2 asks for its oblateness (J2_MOON). */
export function moonField(ephem: FlightEphemeris, fromMs: number, toMs: number, opts: MoonFieldOptions = {}): Field {
  const moon = makeBodyTable(ephem.moonPos, fromMs, toMs) // Earth → Moon; Earth seen from the Moon is its negative
  const sunFromMoon = makeBodyTable((t) => {
    const s = ephem.sunPos(t)
    const m = ephem.moonPos(t)
    return [s[0] - m[0], s[1] - m[1], s[2] - m[2]]
  }, fromMs, toMs)
  const rb: Vec3 = [0, 0, 0]
  const pole: Vec3 | null = opts.j2 ? moonPole(ephem, 0.5 * (fromMs + toMs)) : null
  return {
    centre: 'moon',
    accel(r, utcMs, out) {
      const r2 = r[0] * r[0] + r[1] * r[1] + r[2] * r[2]
      const k = -MU_MOON / (r2 * Math.sqrt(r2))
      out[0] = k * r[0]
      out[1] = k * r[1]
      out[2] = k * r[2]
      if (pole) addJ2(J2_MOON, MU_MOON, J2_MOON_REF_RADIUS_KM, pole, r, out)
      thirdBody(moon, MU_EARTH, -1, r, utcMs, rb, out)
      thirdBody(sunFromMoon, MU_SUN, 1, r, utcMs, rb, out)
    },
  }
}

/** The Moon's spin axis (unit, J2000): the Moon-fixed z axis at utcMs. */
export function moonPole(ephem: FlightEphemeris, utcMs: number): Vec3 {
  return unit(qrot(ephem.moonFixedToInertial(utcMs), [0, 0, 1]))
}

/** Adds the J2 acceleration of a body (μ, reference radius R, spin axis p) at r to out:
 *  a = −(3/2) J2 μ R² / r⁵ · [ r (1 − 5 s²) + 2 s r p ],  s = (r·p)/r. The same formula as earthField's. */
export function addJ2(j2: number, mu: number, refR: number, p: Vec3, r: Vec3, out: Vec3): void {
  const r2 = r[0] * r[0] + r[1] * r[1] + r[2] * r[2]
  const r1 = Math.sqrt(r2)
  const s = (r[0] * p[0] + r[1] * p[1] + r[2] * p[2]) / r1
  const c = (-1.5 * j2 * mu * refR * refR) / (r2 * r2 * r1)
  const q = 1 - 5 * s * s
  out[0] += c * (r[0] * q + 2 * s * r1 * p[0])
  out[1] += c * (r[1] * q + 2 * s * r1 * p[1])
  out[2] += c * (r[2] * q + 2 * s * r1 * p[2])
}

/** A plain point-mass field, for tests and for short phases where third bodies do not matter. */
export function pointMass(mu: number, centre: 'earth' | 'moon'): Field {
  return {
    centre,
    accel(r, _utcMs, out) {
      const r2 = r[0] * r[0] + r[1] * r[1] + r[2] * r[2]
      const k = -mu / (r2 * Math.sqrt(r2))
      out[0] = k * r[0]
      out[1] = k * r[1]
      out[2] = k * r[2]
    },
  }
}
