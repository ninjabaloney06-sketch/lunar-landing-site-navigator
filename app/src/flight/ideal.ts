// The theoretical minimum: how much energy the trip to the landing point and back would take at 100 %
// efficiency, with every practical limit ignored, next to what the planned mission's engines really put out.
// A lower bound for comparison only. No machine flies it.
//
// What is counted. For one kilogram, in the frame centred on Earth that does not turn (J2000 axes),
//     E = ½ v² − μ_Earth / r − μ_Moon / d        (r from Earth's centre, d from the Moon's centre)
// kinetic energy plus the potential energy in the gravity of Earth and of the Moon. 1 km²/s² = 1 MJ/kg.
//   outbound       E(landing point, at rest on the Moon, at touchdown) − E(launchpad, at rest on the turning
//                  Earth, at liftoff). The pad already has the speed of Earth's rotation (0.41 km/s at Kennedy);
//                  the landing point has the Moon's speed around Earth (about 1 km/s) and its slow rotation.
//                  Positions and speeds are the plan's own: the real pad, the real site, the Moon where the
//                  ephemeris has it at those two instants.
//   return climb   E(saddle) − E(landing point at lunar liftoff). The saddle is the pass between the two
//                  gravity wells: the point on the line from the Moon to Earth where, for a body that goes
//                  round with the Moon, the pulls of Earth and Moon and the centrifugal effect cancel (the L1
//                  point, about 58,000 km from the Moon), taken at rest in the frame that turns with the Moon.
//                  It is the lowest pass through which a body can leave the Moon for Earth; from there the
//                  way home is downhill all the way.
//   released       the kinetic energy at Entry Interface of a body that falls from the saddle with no engine:
//                  E(saddle) − potential at Entry Interface. About 60 MJ/kg (11 km/s), which the heat shield
//                  has to turn into heat. Compare ½ · (the plan's entry speed)².
//
// Why "there and back" is not twice the outbound value. Going out, the hill to climb is from the pad to the
// saddle (about 61.5 MJ/kg); beyond it the lander falls into the Moon's well and gets about 2.4 MJ/kg back,
// which a real lander has to burn propellant to brake away and a perfect machine would recover: the outbound
// value is the net, about 59 MJ/kg. Coming home only the climb back to the saddle costs (about 2.4 MJ/kg);
// the fall to Earth releases about 60. outbound + return climb is therefore the energy from the pad to the
// saddle, once: everything else is downhill.
//
// Limits of the number.
//   - It is bookkeeping between states, not a trajectory: nothing says a path exists that needs exactly this.
//   - The Moon moves, so its potential at a fixed place changes with time and E of a coasting body is not
//     constant in this frame: dE/dt = ∂(−μ_Moon/d)/∂t. A body that passes the Moon exchanges energy with the
//     Moon's motion around Earth (what a gravity assist uses). The values are differences of E between two
//     states; the engine work on a particular path differs from them by what that path takes from or gives to
//     the Moon's motion. In the frame that turns with the Moon (where the Moon stands still and a constant of
//     the motion exists, the Jacobi integral) the climb from the surface to the saddle is 2.7 MJ/kg, a launch
//     speed of 2.32 km/s relative to the ground; in the Earth-centred frame used here it is 2.4 MJ/kg, because
//     leaving against the Moon's own motion lowers the speed around Earth. The difference between the two
//     figures is the size of this effect.
//   - Earth's centre is taken as unaccelerated and the Sun is left out. Both ends of every stretch are at the
//     same distance from the Sun to within the Moon's orbit; the Sun's tide across it is about 0.003 MJ/kg.
//   - A rocket cannot give its payload energy at 100 %: it has to carry and accelerate its own propellant, and
//     most of the energy leaves with the exhaust. The mission value is the kinetic energy of that exhaust as
//     the engine sees it, ½ · propellant mass · (g0 · Isp)² with the vacuum specific impulse, summed over all
//     burns of the plan; the ratio to the ideal says how far a staged chemical rocket is from the bound.
import { G0, MU_EARTH, MU_MOON, OMEGA_EARTH, R_EARTH_EQ, R_MOON, bisect } from './astro'
import type { AscentResult } from './ascent'
import type { LaunchVehicleSpec } from './hardware'
import type { FlightEphemeris, IdealEnergy, LandingTarget, Launchpad, Vec3 } from './types'
import { add, cross, dot, latLonUnit, norm, qrot, scale, sub } from './vec'

/** E = ½ v² − μ_Earth / r − μ_Moon / d for a state in the Earth-centred frame, km²/s² = MJ/kg. */
export function mechanicalEnergy(r: Vec3, v: Vec3, moon: Vec3): number {
  return 0.5 * dot(v, v) - MU_EARTH / norm(r) - MU_MOON / norm(sub(r, moon))
}

/** The launchpad at rest on the turning Earth: on the equatorial-radius sphere the simulators launch from. */
export function padState(ephem: FlightEphemeris, pad: Launchpad, utcMs: number): { r: Vec3; v: Vec3 } {
  const q = ephem.earthFixedToInertial(utcMs)
  const r = scale(qrot(q, latLonUnit(pad.latDeg, pad.lonDeg)), R_EARTH_EQ)
  return { r, v: cross(scale(qrot(q, [0, 0, 1]), OMEGA_EARTH), r) }
}

/** The landing point at rest on the Moon, Earth-centred: the Moon's motion plus the site's own (rotation). */
export function siteState(ephem: FlightEphemeris, target: LandingTarget, utcMs: number): { r: Vec3; v: Vec3 } {
  const u = latLonUnit(target.latDeg, target.lonDeg)
  const rel = (t: number) => scale(qrot(ephem.moonFixedToInertial(t), u), R_MOON)
  const vRel = scale(sub(rel(utcMs + 1000), rel(utcMs - 1000)), 0.5) // central difference over 2 s
  return { r: add(ephem.moonPos(utcMs), rel(utcMs)), v: add(ephem.moonVel(utcMs), vRel) }
}

/** The saddle between Moon and Earth at utcMs: the L1 point for the Moon's distance and angular rate at that
 *  instant, at rest in the frame that turns with the Moon. xKm is its distance from the Moon's centre. */
export function saddleState(ephem: FlightEphemeris, utcMs: number): { r: Vec3; v: Vec3; xKm: number } {
  const R = ephem.moonPos(utcMs)
  const V = ephem.moonVel(utcMs)
  const D = norm(R)
  const omega = scale(cross(R, V), 1 / (D * D)) // angular velocity of the Earth–Moon line
  const w2 = dot(omega, omega)
  const bary = (D * MU_MOON) / (MU_EARTH + MU_MOON) // Earth's centre to the centre of mass of Earth and Moon
  // On the line, x from the Moon toward Earth: Earth's pull minus the Moon's pull is the centripetal
  // acceleration of the circle about the centre of mass at the Moon's angular rate.
  const net = (x: number) => MU_EARTH / (D - x) ** 2 - MU_MOON / (x * x) - w2 * (D - x - bary)
  const x = bisect(net, R_MOON, 0.5 * D)
  const r = scale(R, 1 - x / D)
  return { r, v: cross(omega, r), xKm: x }
}

/** One burn of the plan for the energy sum: the propellant it used and the engine's vacuum specific impulse. */
export interface JetBurn {
  propellantKg: number
  ispS: number
}

/** Kinetic energy of the exhaust relative to the engine, MJ: ½ m (g0 Isp)². */
export const jetEnergyMj = (burns: JetBurn[]) => burns.reduce((sum, b) => sum + 0.5 * Math.max(0, b.propellantKg) * (G0 * b.ispS) ** 2, 0) / 1e6

/** The propellant a launch vehicle burnt up to the parking orbit, stage by stage, each at its vacuum specific
 *  impulse: the boosters and the stages below the one that made the insertion burn out; the inserting stage
 *  used what the mass balance of the ascent leaves (its remainder goes on to the trans-lunar injection). */
export function ascentBurns(lv: LaunchVehicleSpec, ascent: AscentResult): JetBurn[] {
  const burns: JetBurn[] = []
  if (lv.boosters?.engine) burns.push({ propellantKg: lv.boosters.propellantKg * lv.boosters.count, ispS: lv.boosters.engine.ispVacS })
  const last = lv.stages.length - 1
  const k = ascent.insertionStage
  lv.stages.forEach((st, i) => {
    if (!st.engine) return
    if (i < k) burns.push({ propellantKg: st.propellantKg, ispS: st.engine.ispVacS })
    else if (i === k && k === last) burns.push({ propellantKg: st.propellantKg - ascent.upperStagePropellantKg, ispS: st.engine.ispVacS })
    else if (i === k) {
      // a lower stage made the insertion and is still attached with what it has left: liftoff mass minus the
      // mass at insertion is propellant burnt plus what was dropped on the way
      const boosters = lv.boosters ? (lv.boosters.dryKg + lv.boosters.propellantKg) * lv.boosters.count : 0
      const droppedDry = lv.stages.slice(0, k).reduce((s, x) => s + x.dryKg, 0) + lv.jettisons.reduce((s, x) => s + x.massKg, 0)
      const below = lv.stages.slice(0, k).reduce((s, x) => s + x.propellantKg, 0)
      burns.push({ propellantKg: Math.min(st.propellantKg, ascent.m[0] - ascent.insertion.massKg - boosters - droppedDry - below), ispS: st.engine.ispVacS })
    }
  })
  return burns
}

export interface IdealInput {
  ephem: FlightEphemeris
  pad: Launchpad
  target: LandingTarget
  launchMs: number
  touchdownMs: number
  lunarLiftoffMs: number
  entryAltKm: number
  /** Every burn of the plan, the ascent from Earth included (ascentBurns). */
  burns: JetBurn[]
  /** The capsule's mass at Entry Interface. */
  referenceMassKg: number
}

export function idealEnergy(inp: IdealInput): IdealEnergy {
  const { ephem } = inp
  const pad = padState(ephem, inp.pad, inp.launchMs)
  const down = siteState(ephem, inp.target, inp.touchdownMs)
  const up = siteState(ephem, inp.target, inp.lunarLiftoffMs)
  const saddle = saddleState(ephem, inp.lunarLiftoffMs)
  const moonUp = ephem.moonPos(inp.lunarLiftoffMs)
  const outbound = mechanicalEnergy(down.r, down.v, ephem.moonPos(inp.touchdownMs)) - mechanicalEnergy(pad.r, pad.v, ephem.moonPos(inp.launchMs))
  const eSaddle = mechanicalEnergy(saddle.r, saddle.v, moonUp)
  const climb = eSaddle - mechanicalEnergy(up.r, up.v, moonUp)
  // potential at Entry Interface: Earth's, and the Moon's at the Moon's distance (0.013 MJ/kg, the same to
  // within 2 % wherever on the entry sphere the capsule arrives)
  const released = eSaddle - (-MU_EARTH / (R_EARTH_EQ + inp.entryAltKm) - MU_MOON / norm(moonUp))
  const jet = jetEnergyMj(inp.burns)
  const perKg = jet / inp.referenceMassKg
  return {
    outboundMjPerKg: outbound,
    returnClimbMjPerKg: climb,
    returnReleasedMjPerKg: released,
    missionJetEnergyMj: jet,
    referenceMassKg: inp.referenceMassKg,
    missionMjPerKg: perKg,
    ratio: perKg / (outbound + climb),
  }
}
