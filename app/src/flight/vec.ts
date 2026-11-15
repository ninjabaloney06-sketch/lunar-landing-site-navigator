// Vector and quaternion helpers for the flight planner. Pure functions, no DOM, no three.js.
// Quaternions are (x, y, z, w) Hamilton unit quaternions, as in the ephemeris files (data/types.ts).
import type { Quat, Vec3 } from '../data/types'

export const DEG = Math.PI / 180
export const TWO_PI = 2 * Math.PI

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const norm = (a: Vec3) => Math.sqrt(dot(a, a))
/** a / |a|. A zero or non-finite length has no direction: RangeError (the planners catch it as "cannot be flown")
 *  rather than a NaN vector that runs on silently. Any other vector gives the same bits as before. */
export const unit = (a: Vec3): Vec3 => {
  const n = norm(a)
  if (!(n > 0) || !Number.isFinite(n)) throw new RangeError('unit: zero or non-finite vector')
  return scale(a, 1 / n)
}
export const lerp = (a: Vec3, b: Vec3, f: number): Vec3 => [
  a[0] + (b[0] - a[0]) * f,
  a[1] + (b[1] - a[1]) * f,
  a[2] + (b[2] - a[2]) * f,
]

/** a·x̂ + b·ŷ for two vectors x, y. */
export const combine = (x: Vec3, a: number, y: Vec3, b: number): Vec3 => [
  x[0] * a + y[0] * b,
  x[1] * a + y[1] * b,
  x[2] * a + y[2] * b,
]

/** Rodrigues rotation of v about the unit vector axis by angle (rad), right-handed. */
export function rotateAbout(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const k = dot(axis, v) * (1 - c)
  const x = cross(axis, v)
  return [v[0] * c + x[0] * s + axis[0] * k, v[1] * c + x[1] * s + axis[1] * k, v[2] * c + x[2] * s + axis[2] * k]
}

/** Angle (rad, [0, 2π)) from unit vector a to unit vector b, counter-clockwise about the unit normal n. */
export function angleAbout(a: Vec3, b: Vec3, n: Vec3): number {
  const x = Math.atan2(dot(cross(a, b), n), dot(a, b))
  return x < 0 ? x + TWO_PI : x
}

/** Hamilton product a * b: rotating by b first, then by a. */
export function qmul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

export const qconj = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]]

/** q v q*: the vector v rotated by the unit quaternion q. */
export function qrot(q: Quat, v: Vec3): Vec3 {
  const u: Vec3 = [q[0], q[1], q[2]]
  const t = scale(cross(u, v), 2)
  return add(add(v, scale(t, q[3])), cross(u, t))
}

/** Unit vector of planetocentric latitude / east longitude (degrees) in the body-fixed frame. */
export function latLonUnit(latDeg: number, lonDeg: number): Vec3 {
  const la = latDeg * DEG
  const lo = lonDeg * DEG
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
}

/** x plus whole periods until it is no longer below min: the repeated addition the planners always used, so every
 *  finite result is bit-identical to it. NaN, ±Infinity and angles so far away that adding a period no longer moves
 *  them (or would take more than 100 000 turns) throw RangeError instead of looping for ever. */
export function angleWrapUp(x: number, min: number, period: number = TWO_PI): number {
  if (!Number.isFinite(x) || !(period > 0)) throw new RangeError('angleWrapUp: non-finite angle or period')
  for (let turns = 0; x < min; turns++) {
    if (turns >= 100_000) throw new RangeError('angleWrapUp: angle too far from the target range')
    x += period
  }
  return x
}
