// The theoretical-minimum energy bookkeeping (ideal.ts) against a hand calculation with round numbers.
//
// Hand calculation (1 km²/s² = 1 MJ/kg; μ_Earth = 398,600 km³/s², μ_Moon = 4,903 km³/s²):
//   Launchpad at 28.6° N on the turning Earth: v = 7.2921e-5 rad/s × 6378 km × cos 28.6° = 0.408 km/s.
//     E = ½ · 0.408² − 398,600 / 6378 − 4,903 / 384,400 = 0.083 − 62.496 − 0.013 = −62.43
//   Landing point on the Moon, the Moon 384,400 km from Earth and moving at 1.02 km/s, the point (near the
//   middle of the near side) 382,700 km from Earth's centre:
//     E = ½ · 1.02² − 398,600 / 382,700 − 4,903 / 1737.4 = 0.520 − 1.042 − 2.822 = −3.34
//   outbound = −3.34 − (−62.43) = 59.1 MJ/kg
//   Saddle (L1) 58,000 km from the Moon, 326,400 km from Earth, going round with the Moon at
//   1.02 × 326,400 / 384,400 = 0.87 km/s:
//     E = ½ · 0.87² − 398,600 / 326,400 − 4,903 / 58,000 = 0.378 − 1.221 − 0.085 = −0.93
//   return climb = −0.93 − (−3.34) = 2.4 MJ/kg;  pad to saddle = 61.5 MJ/kg
//   released = −0.93 + 398,600 / (6378 + 122) + 4,903 / 384,400 = −0.93 + 61.32 + 0.01 = 60.4 MJ/kg,
//   a speed of √(2 · 60.4) = 11.0 km/s at Entry Interface (Apollo 11: 36,194.4 ft/s = 11.03 km/s).
// The real geometry moves these by a few tenths: the Moon's distance is 356,000 to 407,000 km.
import { describe, expect, it } from 'vitest'
import aug2027 from '../../public/data/ephem/2027-08.json?raw'
import sep2027 from '../../public/data/ephem/2027-09.json?raw'
import type { EphemMonth } from '../data/types'
import { G0, MU_EARTH, MU_MOON, R_MOON } from './astro'
import { makeFlightEphemeris } from './ephemeris'
import { idealEnergy, jetEnergyMj, mechanicalEnergy, padState, saddleState, siteState } from './ideal'
import { LAUNCHPADS } from './pads'
import type { LandingTarget } from './types'
import { cross, dot, norm, scale, sub } from './vec'

const ephem = makeFlightEphemeris([aug2027, sep2027].map((m) => JSON.parse(m) as EphemMonth))
const pad = LAUNCHPADS.find((p) => p.id === 'ksc-39b')!
const tranquillity: LandingTarget = { id: 'x', name: 'Near-side equatorial point', latDeg: 0.67, lonDeg: 23.47 }
const launchMs = Date.UTC(2027, 7, 20, 12)
const touchdownMs = launchMs + 4.5 * 86400_000
const lunarLiftoffMs = touchdownMs + 3 * 86400_000

describe('theoretical minimum energy', () => {
  const ideal = idealEnergy({
    ephem, pad, target: tranquillity, launchMs, touchdownMs, lunarLiftoffMs, entryAltKm: 121.92,
    burns: [{ propellantKg: 1000, ispS: 300 }, { propellantKg: 500, ispS: 450 }], referenceMassKg: 100,
  })

  it('outbound: the hand calculation, about 59 MJ/kg', () => {
    console.log(`[ideal] outbound ${ideal.outboundMjPerKg.toFixed(2)}, return climb ${ideal.returnClimbMjPerKg.toFixed(2)}, released ${ideal.returnReleasedMjPerKg.toFixed(2)} MJ/kg`)
    expect(ideal.outboundMjPerKg).toBeGreaterThan(58.6)
    expect(ideal.outboundMjPerKg).toBeLessThan(59.6)
    // the parts, from the same states: the pad at the speed of Earth's rotation, the site at the Moon's speed
    const p = padState(ephem, pad, launchMs)
    expect(norm(p.v)).toBeCloseTo(0.408, 2)
    expect(mechanicalEnergy(p.r, p.v, ephem.moonPos(launchMs))).toBeCloseTo(-62.43, 1)
    const s = siteState(ephem, tranquillity, touchdownMs)
    expect(norm(sub(s.r, ephem.moonPos(touchdownMs)))).toBeCloseTo(R_MOON, 6)
    expect(norm(sub(s.v, ephem.moonVel(touchdownMs)))).toBeLessThan(0.005) // the Moon's rotation: 4.6 m/s at the equator
  })

  it('return: a climb of about 2.4 MJ/kg to the saddle, then about 60 MJ/kg released', () => {
    expect(ideal.returnClimbMjPerKg).toBeGreaterThan(2.2)
    expect(ideal.returnClimbMjPerKg).toBeLessThan(2.6)
    expect(ideal.returnReleasedMjPerKg).toBeGreaterThan(60.0)
    expect(ideal.returnReleasedMjPerKg).toBeLessThan(60.8)
    expect(Math.sqrt(2 * ideal.returnReleasedMjPerKg)).toBeCloseTo(11.0, 1) // km/s at Entry Interface
    // pad to saddle, once: about 61.5
    expect(ideal.outboundMjPerKg + ideal.returnClimbMjPerKg).toBeGreaterThan(61.0)
    expect(ideal.outboundMjPerKg + ideal.returnClimbMjPerKg).toBeLessThan(62.0)
  })

  it('the saddle is where the pulls and the centrifugal effect cancel, about 58,000 km from the Moon', () => {
    const sd = saddleState(ephem, lunarLiftoffMs)
    const R = ephem.moonPos(lunarLiftoffMs)
    const D = norm(R)
    expect(sd.xKm / D).toBeGreaterThan(0.14)
    expect(sd.xKm / D).toBeLessThan(0.16)
    // net acceleration in the turning frame along the line, with the turning about the centre of mass
    const omega = scale(cross(R, ephem.moonVel(lunarLiftoffMs)), 1 / (D * D))
    const d = D - sd.xKm
    const net = MU_EARTH / (d * d) - MU_MOON / (sd.xKm * sd.xKm) - dot(omega, omega) * (d - (D * MU_MOON) / (MU_EARTH + MU_MOON))
    expect(Math.abs(net)).toBeLessThan(1e-12)
    // In the frame that turns with the Moon the same climb is about 2.7 MJ/kg (2.32 km/s relative to the ground):
    // effective potential −μE/r − μM/d − ½ ω² ρ², ρ the distance from the centre of mass.
    const w2 = dot(omega, omega)
    const bary = scale(R, MU_MOON / (MU_EARTH + MU_MOON))
    const phi = (r: [number, number, number]) => -MU_EARTH / norm(r) - MU_MOON / norm(sub(r, R)) - 0.5 * w2 * dot(sub(r, bary), sub(r, bary))
    const site = siteState(ephem, tranquillity, lunarLiftoffMs)
    const climbTurning = phi(sd.r) - phi(site.r)
    expect(climbTurning).toBeGreaterThan(2.6)
    expect(climbTurning).toBeLessThan(2.8)
    expect(Math.sqrt(2 * climbTurning)).toBeCloseTo(2.32, 1)
  })

  it('the mission side: exhaust energy ½ m (g0 Isp)², per kilogram that comes home', () => {
    const jet = (0.5 * 1000 * (G0 * 300) ** 2 + 0.5 * 500 * (G0 * 450) ** 2) / 1e6
    expect(jetEnergyMj([{ propellantKg: 1000, ispS: 300 }, { propellantKg: 500, ispS: 450 }])).toBeCloseTo(jet, 9)
    expect(ideal.missionJetEnergyMj).toBeCloseTo(jet, 9)
    expect(ideal.missionMjPerKg).toBeCloseTo(jet / 100, 9)
    expect(ideal.ratio).toBeCloseTo(jet / 100 / (ideal.outboundMjPerKg + ideal.returnClimbMjPerKg), 9)
  })
})
