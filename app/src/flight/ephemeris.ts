// FlightEphemeris from the app's ephemeris months (JPL DE440 via scripts/ephemeris.py): Moon-centred MOON_ME
// vectors and the MOON_ME → J2000 and IAU_EARTH → MOON_ME orientations, every 30 minutes.
//
// The files hold APPARENT vectors as seen from the Moon's centre (SPICE "LT+S": light time and stellar aberration),
// which is what the sky views need. A trajectory needs GEOMETRIC positions: where the bodies are at the same
// instant. For Earth seen from the Moon the two differ by up to about 38 km, almost all of it in range:
//   - light time: Earth is shown where it was d/c = 1.3 s earlier, and in that time it moved 38 km around the Sun;
//   - stellar aberration: the direction is shifted toward the Moon's own velocity (30 km/s around the Sun) by
//     v⊥/c, which moves the image by 38 km sideways and cancels the sideways part of the light-time shift up to
//     the Earth–Moon relative motion (1.3 km), but leaves the part along the line of sight.
// To first order in v/c, with p the apparent Earth vector, u its direction, d its length, vo the Moon's velocity
// relative to the Sun and dp/dt the apparent vector's own rate:
//     geometric = p + (d/c) · [ (vo·u) u + dp/dt ]
// Without this the Moon's tabulated motion is not the motion gravity gives it (the range error swings ±38 km over
// a month), and a path integrated Earth-centred disagrees with the same path integrated Moon-centred by tens of
// kilometres after a few days. The Sun's direction is left apparent: 20″ of a tide that small does not matter.
import { interpolate } from '../geometry'
import type { EphemMonth } from '../data/types'
import type { FlightEphemeris, Vec3 } from './types'
import { add, dot, norm, qmul, qrot, scale, sub, unit } from './vec'

const DIFF_MS = 10 * 60_000 // central-difference half-width for velocities
const C_KMS = 299_792.458

export function makeFlightEphemeris(months: EphemMonth[]): FlightEphemeris {
  if (!months.length) throw new RangeError('makeFlightEphemeris: no ephemeris months')
  const spans = months.map((m) => {
    const t0 = Date.parse(m.start_utc)
    return { t0, t1: t0 + (m.n - 1) * m.step_min * 60_000 }
  })
  // two difference widths of margin: the Moon's velocity is a difference of positions that are themselves corrected
  const startMs = Math.min(...spans.map((s) => s.t0)) + 2 * DIFF_MS
  const endMs = Math.max(...spans.map((s) => s.t1)) - 2 * DIFF_MS
  const at = (utcMs: number) => interpolate(months, utcMs)
  /** Apparent Earth and Sun as seen from the Moon's centre, J2000 axes. */
  const apparent = (utcMs: number) => {
    const s = at(utcMs)
    return { earth: qrot(s.q_me_to_j2000, s.earth_km), sun: qrot(s.q_me_to_j2000, s.sun_km) }
  }
  /** Geometric Earth relative to the Moon's centre (see the header). */
  const earthFromMoon = (utcMs: number): Vec3 => {
    const now = apparent(utcMs)
    const before = apparent(utcMs - DIFF_MS)
    const after = apparent(utcMs + DIFF_MS)
    const span = (2 * DIFF_MS) / 1000
    const dp = scale(sub(after.earth, before.earth), 1 / span)
    const vo = scale(sub(after.sun, before.sun), -1 / span) // the Moon's velocity relative to the Sun
    const d = norm(now.earth)
    const u = unit(now.earth)
    return add(now.earth, scale(add(scale(u, dot(vo, u)), dp), d / C_KMS))
  }
  const moonPos = (utcMs: number): Vec3 => scale(earthFromMoon(utcMs), -1)
  const sunFromEarth = (utcMs: number): Vec3 => {
    const a = apparent(utcMs)
    return sub(a.sun, earthFromMoon(utcMs))
  }
  return {
    startMs,
    endMs,
    moonPos,
    moonVel: (utcMs) => scale(sub(moonPos(utcMs + DIFF_MS), moonPos(utcMs - DIFF_MS)), 1 / ((2 * DIFF_MS) / 1000)),
    sunDir: (utcMs) => unit(sunFromEarth(utcMs)),
    sunPos: sunFromEarth,
    earthFixedToInertial: (utcMs) => {
      const s = at(utcMs)
      return qmul(s.q_me_to_j2000, s.q_earth_to_me)
    },
    moonFixedToInertial: (utcMs) => at(utcMs).q_me_to_j2000,
  }
}
