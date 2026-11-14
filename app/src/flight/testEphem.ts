// Analytic stand-in ephemeris for tests: the Moon on a circle, Earth spinning at its sidereal rate.
// Not for the app: the app builds its FlightEphemeris from the DE440 files.
import type { FlightEphemeris, Quat, Vec3 } from './types'
import { OMEGA_EARTH } from './astro'
import { qmul } from './vec'

const DAY_MS = 86400000
const MOON_DIST = 384400 // km
const MOON_PERIOD_S = 27.321661 * 86400 // sidereal month, s
const DEFAULT_EPOCH = Date.UTC(2026, 10, 14) // ms

/** Quaternion (x, y, z, w) for a right-handed rotation by angle (rad) about a coordinate axis. */
const axisQuat = (axis: 0 | 1 | 2, angle: number): Quat => {
  const q: Quat = [0, 0, 0, Math.cos(angle / 2)]
  q[axis] = Math.sin(angle / 2)
  return q
}

export function circularEphemeris(opts: { inclDeg?: number; phaseDeg?: number; epochMs?: number } = {}): FlightEphemeris {
  const incl = (opts.inclDeg ?? 23) * Math.PI / 180
  const phase = (opts.phaseDeg ?? 0) * Math.PI / 180
  const epoch = opts.epochMs ?? DEFAULT_EPOCH
  const ci = Math.cos(incl)
  const si = Math.sin(incl)
  const theta = (utcMs: number) => phase + (2 * Math.PI * (utcMs - epoch)) / 1000 / MOON_PERIOD_S
  const tilt = axisQuat(0, incl)

  return {
    startMs: epoch - 400 * DAY_MS,
    endMs: epoch + 400 * DAY_MS,
    moonPos(utcMs: number): Vec3 {
      const th = theta(utcMs)
      // circle in the xy plane, tilted about x by incl
      return [MOON_DIST * Math.cos(th), MOON_DIST * Math.sin(th) * ci, MOON_DIST * Math.sin(th) * si]
    },
    moonVel(utcMs: number): Vec3 {
      const th = theta(utcMs)
      const w = (MOON_DIST * 2 * Math.PI) / MOON_PERIOD_S
      return [-w * Math.sin(th), w * Math.cos(th) * ci, w * Math.cos(th) * si]
    },
    sunDir: () => [1, 0, 0],
    earthFixedToInertial(utcMs: number): Quat {
      return axisQuat(2, (OMEGA_EARTH * (utcMs - epoch)) / 1000)
    },
    moonFixedToInertial(utcMs: number): Quat {
      // Moon-fixed +x points at Earth: rotate by θ + π about z, then tilt the orbit about x
      return qmul(tilt, axisQuat(2, theta(utcMs) + Math.PI))
    },
  }
}
