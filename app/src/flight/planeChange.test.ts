// Lunar Orbit Plane Change as a finite burn, against the two textbook values for turning a circular orbit's
// plane by δ at the node: Δv = 2 v sin(δ/2) for one instantaneous push (the lower bound), and Δv = v δ for a
// thrust that stays at right angles to the velocity, which is what planeChange.ts flies (the orbit keeps its
// shape).
import { describe, expect, it } from 'vitest'
import { MU_MOON, R_MOON } from './astro'
import { planPlaneChange } from './planeChange'
import { pointMass } from './sim'
import type { Vec3 } from './types'
import { cross, dot, norm, unit } from './vec'

const DEG = Math.PI / 180
const field = pointMass(MU_MOON, 'moon')
const r = R_MOON + 100
const v = Math.sqrt(MU_MOON / r)
// Apollo 11 CSM after undocking, about: 16.6 t, Service Propulsion System 91.2 kN at 314 s (spacecraft.ts)
const csm = { massKg: 16600, thrustN: 91189, ispS: 314 }
/** A site direction δ off the plane z = 0, at an angle `along` around the orbit from the x axis. */
const siteOff = (deltaDeg: number, alongDeg: number): Vec3 => {
  const d = deltaDeg * DEG
  const a = alongDeg * DEG
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]
}

describe('Lunar Orbit Plane Change', () => {
  it.each([
    [3.5, 40], // an Apollo 15 size turn: "a 3-degree plane change maneuver", 330.6 ft/s = 100.8 m/s
    [-12, 200],
    [40, 300], // a turn that takes minutes: the burn sweeps an arc of the orbit
  ])('turns the plane by %d° over the site and leaves the orbit circular', (deltaDeg, alongDeg) => {
    const site = siteOff(deltaDeg, alongDeg)
    const pc = planPlaneChange({ field, state: { r: [r, 0, 0], v: [0, v, 0], m: csm.massKg }, notBeforeMs: 0, siteDir: site, thrustN: csm.thrustN, ispS: csm.ispS })!
    const n = unit(cross(pc.end.r, pc.end.v))
    // the site is in the new plane
    expect(Math.abs(Math.asin(dot(n, site))) / DEG).toBeLessThan(1e-3)
    expect(pc.turnDeg).toBeCloseTo(Math.abs(deltaDeg), 1)
    // the burn is at the node: a quarter revolution from the place nearest to the site
    const mid = pc.burn.r[Math.floor(pc.burn.r.length / 2)]
    expect(Math.abs(dot(unit(mid), site))).toBeLessThan(0.05)
    // size and shape of the orbit are untouched: thrust along the orbit normal does no work
    expect(norm(pc.end.r)).toBeCloseTo(r, 3)
    expect(norm(pc.end.v)).toBeCloseTo(v, 6)
    expect(Math.abs(dot(pc.end.r, pc.end.v))).toBeLessThan(1e-3)
    // the cost: v δ, and a little more for the arc of the orbit a long burn sweeps; never below the chord
    const chord = 2 * v * Math.sin((Math.abs(deltaDeg) * DEG) / 2)
    const arc = v * Math.abs(deltaDeg) * DEG
    expect(pc.dvKms).toBeGreaterThan(chord)
    expect(pc.dvKms).toBeGreaterThan(arc * 0.9999)
    expect(pc.dvKms).toBeLessThan(arc * 1.003)
    expect(pc.burn.endS).toBeGreaterThan(1)
    expect(pc.propellantKg).toBeCloseTo(csm.massKg - pc.end.m, 9)
    expect(pc.ignitionMs).toBeLessThan(0.75 * 2 * Math.PI * Math.sqrt(r ** 3 / MU_MOON) * 1000) // at the first node
  })

  it('an Apollo 15 size turn costs what Apollo 15 paid: about 100 m/s for 3.5°', () => {
    const pc = planPlaneChange({ field, state: { r: [r, 0, 0], v: [0, v, 0], m: csm.massKg }, notBeforeMs: 0, siteDir: siteOff(3.5, 40), thrustN: csm.thrustN, ispS: csm.ispS })!
    expect(pc.dvKms * 1000).toBeGreaterThan(95)
    expect(pc.dvKms * 1000).toBeLessThan(105)
    expect(pc.burn.endS).toBeGreaterThan(15) // Apollo 15: 18.31 s
    expect(pc.burn.endS).toBeLessThan(22)
  })

  it('does nothing when the site is under the orbit already', () => {
    expect(planPlaneChange({ field, state: { r: [r, 0, 0], v: [0, v, 0], m: csm.massKg }, notBeforeMs: 0, siteDir: siteOff(0, 123), thrustN: csm.thrustN, ispS: csm.ispS })).toBeNull()
  })
})
