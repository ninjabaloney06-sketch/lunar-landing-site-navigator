// Constants and two-body helpers for the flight planner. Patched conics: each segment is a Kepler orbit
// around one body. Units: km, s, km^3/s^2 (mu), radians.
import type { Vec3 } from '../data/types'

// GM of Earth and Moon: JPL DE440, https://ssd.jpl.nasa.gov/astro_par.html (the ephemeris the app's data uses).
export const MU_EARTH = 398600.435507 // km^3/s^2
export const MU_MOON = 4902.800118 // km^3/s^2
// Earth equatorial radius: https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html (same as WGS 84).
export const R_EARTH_EQ = 6378.137 // km
export const R_MOON = 1737.4 // km, the app's reference sphere (geometry/index.ts)
// Earth's rotation rate: 2π over the sidereal day of 23.9345 h given by the same NSSDC fact sheet.
export const OMEGA_EARTH = 7.292115e-5 // rad/s
// Laplace sphere of influence of the Moon, a (m_Moon / m_Earth)^(2/5) with a = 384400 km: where the planner
// switches from an Earth-centred to a Moon-centred orbit (Bate, Mueller, White, Fundamentals of Astrodynamics, ch. 7).
export const SOI_MOON = 66183 // km
export const G0 = 9.80665 // m/s^2
export const DAY_S = 86400

export interface Ellipse {
  a: number // semi-major axis, km
  e: number // eccentricity
  p: number // semi-latus rectum, km
}

export interface Hyperbola extends Ellipse {
  nuInf: number // true anomaly of the asymptote, rad
}

/** Circular orbital speed at radius r, km/s. */
export const circularSpeed = (mu: number, r: number) => Math.sqrt(mu / r)

/** Vis-viva speed at radius r on an orbit with semi-major axis a, km/s. */
export const visViva = (mu: number, r: number, a: number) => Math.sqrt(mu * (2 / r - 1 / a))

/** Ellipse from periapsis and apoapsis radii. */
export function ellipse(rp: number, ra: number): Ellipse {
  const a = (rp + ra) / 2
  const e = (ra - rp) / (ra + rp)
  return { a, e, p: a * (1 - e * e) }
}

/** True anomaly in [0, π] at which the ellipse passes radius r on the way out from periapsis. */
export function trueAnomalyAtRadius(el: Ellipse, r: number): number {
  const c = Math.min(1, Math.max(-1, (el.p / r - 1) / el.e))
  return Math.acos(c)
}

/** Seconds from periapsis to true anomaly nu in [0, π] on an ellipse. */
export function timeFromPeriapsis(mu: number, el: Ellipse, nu: number): number {
  const E = trueToEccentric(el.e, nu)
  return Math.sqrt(el.a ** 3 / mu) * (E - el.e * Math.sin(E))
}

/** Eccentric anomaly from true anomaly on an ellipse. */
export const trueToEccentric = (e: number, nu: number) =>
  2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2))

/** True anomaly from eccentric anomaly on an ellipse. */
export const eccentricToTrue = (e: number, E: number) =>
  2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2))

/** Radius on an ellipse at eccentric anomaly E. */
export const radiusAtE = (el: Ellipse, E: number) => el.a * (1 - el.e * Math.cos(E))

/** Position and velocity on an orbit at true anomaly nu, in J2000 axes given the perifocal unit vectors P, Q. */
export function perifocal(el: Ellipse, mu: number, nu: number, P: Vec3, Q: Vec3): { r: Vec3; v: Vec3 } {
  const rMag = el.p / (1 + el.e * Math.cos(nu))
  const vK = Math.sqrt(mu / el.p)
  const cn = Math.cos(nu)
  const sn = Math.sin(nu)
  const r: Vec3 = [
    rMag * (cn * P[0] + sn * Q[0]),
    rMag * (cn * P[1] + sn * Q[1]),
    rMag * (cn * P[2] + sn * Q[2]),
  ]
  const v: Vec3 = [
    vK * (-sn * P[0] + (el.e + cn) * Q[0]),
    vK * (-sn * P[1] + (el.e + cn) * Q[1]),
    vK * (-sn * P[2] + (el.e + cn) * Q[2]),
  ]
  return { r, v }
}

/** Hyperbolic approach: semi-major axis (positive), eccentricity, and asymptote true anomaly for excess speed vInf at periapsis rp. */
export function hyperbola(mu: number, vInf: number, rp: number): Hyperbola {
  const a = mu / (vInf * vInf)
  const e = 1 + (rp * vInf * vInf) / mu
  return { a, e, p: a * (e * e - 1), nuInf: Math.acos(-1 / e) }
}

/** Seconds from periapsis to true anomaly nu (|nu| < nuInf) on a hyperbola; always ≥ 0. */
export function hyperbolicTimeFromPeriapsis(mu: number, hy: Hyperbola, nu: number): number {
  const c = (hy.e + Math.cos(nu)) / (1 + hy.e * Math.cos(nu))
  const F = Math.acosh(Math.max(1, c))
  return Math.sqrt(hy.a ** 3 / mu) * (hy.e * Math.sinh(F) - F)
}

/** Propellant (kg) to change the mass from massAfterKg-plus-propellant down to massAfterKg, by the rocket equation. */
export const rocketPropellant = (massAfterKg: number, dvKms: number, ispS: number) =>
  massAfterKg * (Math.exp((dvKms * 1000) / (G0 * ispS)) - 1)

/** Root of f on [lo, hi] by bisection; f(lo) and f(hi) must differ in sign. */
export function bisect(f: (x: number) => number, lo: number, hi: number, iterations = 60): number {
  let a = lo
  let b = hi
  let fa = f(a)
  for (let i = 0; i < iterations; i++) {
    const m = 0.5 * (a + b)
    const fm = f(m)
    if (fm === 0) return m
    if (fa * fm < 0) b = m
    else {
      a = m
      fa = fm
    }
  }
  return 0.5 * (a + b)
}

/** Argmin of a unimodal f on [lo, hi] by golden-section search, to an interval width of tol. */
export function goldenMin(f: (x: number) => number, lo: number, hi: number, tol: number): number {
  const g = (Math.sqrt(5) - 1) / 2
  let a = lo
  let b = hi
  let c = b - g * (b - a)
  let d = a + g * (b - a)
  let fc = f(c)
  let fd = f(d)
  while (b - a > tol) {
    if (fc < fd) {
      b = d
      d = c
      fd = fc
      c = b - g * (b - a)
      fc = f(c)
    } else {
      a = c
      c = d
      fc = fd
      d = a + g * (b - a)
      fd = f(d)
    }
  }
  return 0.5 * (a + b)
}
