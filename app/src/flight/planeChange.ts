// Lunar Orbit Plane Change (LOPC): a spacecraft in a circular lunar orbit turns its orbit plane so that it
// passes over a point of the surface at a given instant. The Apollo J missions' Command and Service Module
// made this burn about six hours before the Lunar Module lifted off, "so that the orbital plane of both
// vehicles would be coincident" (Apollo 15 Mission Report, section 3, https://apollojournals.org/alsj/a15/a15mr-3.htm).
//
// Physics. A low orbit keeps its plane in space while the Moon turns under it (13.2° per day), so a site that
// was under the orbit at landing is beside it later. The plane is turned most cheaply where the old and the new
// plane cross: at the node, a quarter revolution from the place where the orbit passes nearest to the site.
// The burn is flown with the thrust along the orbit normal at every instant (at right angles to position and
// velocity): such a thrust does no work and has no radial part, so the orbit keeps its size and shape and only
// its plane turns, about the present radius vector. Because the thrust stays at right angles to the velocity
// while the velocity turns, a turn by the angle δ costs Δv = v δ (the arc), not the 2 v sin(δ/2) (the chord) of
// one instantaneous push: the same to 0.02 % for Apollo's 3°, 2 % more at 40°, 5 % more at 60°. That is the
// price of leaving the orbit exactly as round and as high as it was; a thrust held along the chord would dip
// the speed during a burn of minutes and leave an ellipse. The burn is centred on the node and its length is
// corrected by secant iteration on the integrated flight until the plane after cut-off contains the site
// direction (a long burn sweeps an arc of the orbit and loses a little more, which this makes up).
import { G0, MU_MOON } from './astro'
import { constantThrust, integrate } from './sim'
import type { Field, SimRun, SimState } from './sim'
import type { Vec3 } from './types'
import { cross, dot, norm, scale, sub, unit } from './vec'

export interface PlaneChangeInput {
  field: Field // Moon-centred
  /** The spacecraft's state at notBeforeMs (Moon-centred J2000). */
  state: SimState
  notBeforeMs: number
  /** Unit vector from the Moon's centre to the site at the instant that matters (the lander's liftoff). */
  siteDir: Vec3
  thrustN: number
  ispS: number
}

export interface PlaneChange {
  coast: SimRun // from notBeforeMs to the ignition
  burn: SimRun
  ignitionMs: number
  endMs: number
  end: SimState
  turnDeg: number // angle between the orbit planes before and after
  offBeforeDeg: number // the site's angle from the orbit plane before the burn
  offAfterDeg: number // and after it (the solver's residual)
  dvKms: number
  propellantKg: number
}

const asin = (x: number) => Math.asin(Math.min(1, Math.max(-1, x)))
const DEG = Math.PI / 180

/** The plane change at the first node after notBeforeMs; null when the site is already in the plane (to 0.002°). */
export function planPlaneChange(inp: PlaneChangeInput): PlaneChange | null {
  const { field, state, siteDir } = inp
  const s = unit(siteDir)
  const n0 = unit(cross(state.r, state.v))
  const off0 = asin(dot(n0, s))
  if (Math.abs(off0) < 3.5e-5) return null
  const flow = inp.thrustN / (G0 * inp.ispS)
  const ve = (G0 * inp.ispS) / 1000
  const period = 2 * Math.PI * Math.sqrt(norm(state.r) ** 3 / MU_MOON)

  // The node: where the position is at right angles to the site's direction projected into the plane.
  const p = unit(sub(s, scale(n0, dot(s, n0))))
  const side = dot(state.r, p) < 0 ? 1 : -1
  const toNode = integrate(field, state, inp.notBeforeMs, { maxSeconds: 0.75 * period, maxStepS: 30, stop: (_t, x) => side * dot(x.r, p) })
  const nodeS = toNode.endS
  const atNode = toNode.end
  // Thrust along +normal turns the normal toward −v̂ (d(r × v)/dt = r × a and r̂ × n̂ = −v̂): the sign that
  // brings the normal at right angles to the site.
  const sign = Math.sign(dot(n0, s)) * Math.sign(dot(atNode.v, s)) || 1
  const steer = (_t: number, x: SimState): Vec3 => scale(unit(cross(x.r, x.v)), sign)

  const fly = (tauS: number) => {
    let startS = nodeS - tauS / 2
    if (startS < 0) startS += 0.5 * period // the node is too close: the next one, half a revolution on, turns the other way
    const flip = startS !== nodeS - tauS / 2
    const coast = integrate(field, state, inp.notBeforeMs, { maxSeconds: startS, maxStepS: 30 })
    const ignitionMs = inp.notBeforeMs + coast.endS * 1000
    const dir = flip ? (t: number, x: SimState) => scale(steer(t, x), -1) : steer
    const burn = integrate(field, coast.end, ignitionMs, { maxSeconds: tauS, maxStepS: 5, engine: constantThrust(inp.thrustN, inp.ispS, dir) })
    return { coast, burn, ignitionMs, off: asin(dot(unit(cross(burn.end.r, burn.end.v)), s)) }
  }
  const dvGuess = norm(state.v) * Math.abs(off0)
  const maxTau = (0.9 * state.m) / flow
  let t0 = Math.min(maxTau, (state.m * (1 - Math.exp(-dvGuess / ve))) / flow)
  let f0 = fly(t0).off
  let t1 = Math.min(maxTau, t0 * (1 + 0.02 * Math.sign(f0 * off0 || 1)))
  for (let i = 0; i < 12 && Math.abs(f0) > 1e-6; i++) {
    const f1 = fly(t1).off
    if (f1 === f0) break
    const t2 = Math.min(maxTau, Math.max(0.2 * t1, t1 - (f1 * (t1 - t0)) / (f1 - f0)))
    t0 = t1
    f0 = f1
    t1 = t2
  }
  const best = fly(t0)
  const end = best.burn.end
  const nEnd = unit(cross(end.r, end.v))
  return {
    coast: best.coast,
    burn: best.burn,
    ignitionMs: best.ignitionMs,
    endMs: best.ignitionMs + best.burn.endS * 1000,
    end,
    turnDeg: Math.acos(Math.min(1, dot(n0, nEnd))) / DEG,
    offBeforeDeg: off0 / DEG,
    offAfterDeg: best.off / DEG,
    dvKms: ve * Math.log(state.m / end.m),
    propellantKg: state.m - end.m,
  }
}
