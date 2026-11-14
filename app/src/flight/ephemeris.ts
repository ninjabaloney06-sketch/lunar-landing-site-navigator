// FlightEphemeris from the app's ephemeris months (JPL DE440 via scripts/ephemeris.py): Moon-centred MOON_ME
// vectors and the MOON_ME → J2000 and IAU_EARTH → MOON_ME orientations, every 30 minutes.
//
// The files hold apparent vectors (light time and stellar aberration corrected, "LT+S"). The planner uses them
// as geometric: the Earth–Moon light time is 1.3 s, in which the Moon moves about 1.3 km. That is far below
// what a patched-conic plan resolves.
import { interpolate } from '../geometry'
import type { EphemMonth } from '../data/types'
import type { FlightEphemeris, Vec3 } from './types'
import { qmul, qrot, scale, sub, unit } from './vec'

const VEL_STEP_MS = 10 * 60_000 // central difference half-width for the Moon's velocity

export function makeFlightEphemeris(months: EphemMonth[]): FlightEphemeris {
  if (!months.length) throw new RangeError('makeFlightEphemeris: no ephemeris months')
  const spans = months.map((m) => {
    const t0 = Date.parse(m.start_utc)
    return { t0, t1: t0 + (m.n - 1) * m.step_min * 60_000 }
  })
  const startMs = Math.min(...spans.map((s) => s.t0)) + VEL_STEP_MS
  const endMs = Math.max(...spans.map((s) => s.t1)) - VEL_STEP_MS
  const at = (utcMs: number) => interpolate(months, utcMs)
  const moonPos = (utcMs: number): Vec3 => {
    const s = at(utcMs)
    return scale(qrot(s.q_me_to_j2000, s.earth_km), -1)
  }
  return {
    startMs,
    endMs,
    moonPos,
    moonVel: (utcMs) => scale(sub(moonPos(utcMs + VEL_STEP_MS), moonPos(utcMs - VEL_STEP_MS)), 1 / ((2 * VEL_STEP_MS) / 1000)),
    sunDir: (utcMs) => {
      const s = at(utcMs)
      return unit(qrot(s.q_me_to_j2000, sub(s.sun_km, s.earth_km)))
    },
    sunPos: (utcMs) => {
      const s = at(utcMs)
      return qrot(s.q_me_to_j2000, sub(s.sun_km, s.earth_km))
    },
    earthFixedToInertial: (utcMs) => {
      const s = at(utcMs)
      return qmul(s.q_me_to_j2000, s.q_earth_to_me)
    },
    moonFixedToInertial: (utcMs) => at(utcMs).q_me_to_j2000,
  }
}
