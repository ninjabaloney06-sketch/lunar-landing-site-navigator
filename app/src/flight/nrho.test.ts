// Checks of nrho.ts on the app's real DE440 ephemeris (August to October 2027).
//
// Three kinds of check:
//   - against published numbers (each with its source below);
//   - against the physics the result must obey (it ends where it should, masses follow the rocket equation);
//   - against a fixed-step RK4 integrator written here, which shares no code with sim.ts and reads the Moon and
//     the Sun straight from the ephemeris (linear interpolation of the files, where sim.ts uses a cubic table).
//
// Published values and where they come from:
//   [DAVIS]   Davis, Khoury, Howell, Sweeney, "Phase Control and Eclipse Avoidance in Near Rectilinear Halo Orbits",
//             https://ntrs.nasa.gov/citations/20200000733 , Table 1 (the 15-year Gateway reference orbit): orbital
//             period 6.26 / 6.56 / 6.76 days (min / mean / max), perilune radius 3,195 / 3,366 / 3,557 km, apolune
//             radius 70,005 / 71,100 / 71,849 km.
//   [LEE]     Lee, "White Paper: Gateway Destination Orbit Model: A Continuous 15 Year NRHO Reference Trajectory",
//             https://ntrs.nasa.gov/citations/20190030294 : average period 6.562 days; continuous in position, with
//             velocity adjustments near apolune of 1.86 mm/s per revolution on average.
//   [WHITLEY] Whitley, Martinez, "Options for Staging Orbits in Cislunar Space" (presentation, 2016),
//             https://ntrs.nasa.gov/citations/20160003079 : transfer from the near-rectilinear orbit to a polar low
//             lunar orbit 730 m/s in 0.5 day (1,461 m/s there and back); Orion, 21-day mission: outbound flyby
//             178 m/s and insertion 250.5 m/s, 5.1 days from the trans-lunar injection to the orbit; departure from
//             the orbit 221.5 m/s and return flyby 190 m/s, 5.0 days from the orbit to entry interface; 840 m/s for
//             Orion in all (slide "Orion Transfers from Earth to NRO").
//   [HLS]     Mahajan, Condon, "HLS NRHO to Lunar Surface and Back Mission Design" (NASA JSC, 2022),
//             https://ntrs.nasa.gov/citations/20230002566 : NRHO departure plus insertion into a 100 km circular
//             low lunar orbit, nominal 704.5 m/s and 704.9 m/s (site Connecting Ridge), transfer 0.5 to 1.5 days.
//   [REA]     Rea, McNamara, Kane, "Orion Artemis I Entry Performance" (NASA JSC), https://ntrs.nasa.gov/citations/20240000024 :
//             the source named for Artemis I's flight-path angle at entry interface, âˆ’5.66Â° (the value was handed to
//             this planner with that reference; the abstract page itself does not state it).
import { describe, expect, it } from 'vitest'
import aug2027 from '../../public/data/ephem/2027-08.json?raw'
import sep2027 from '../../public/data/ephem/2027-09.json?raw'
import oct2027 from '../../public/data/ephem/2027-10.json?raw'
import type { EphemMonth } from '../data/types'
import { G0, MU_EARTH, MU_MOON, R_EARTH_EQ, R_MOON } from './astro'
import { MU_SUN } from './nbody'
import { makeFlightEphemeris } from './ephemeris'
import {
  NRHO_PERIOD_S,
  NrhoError,
  constrainedApsisCost,
  earthToNrho,
  lloToNrho,
  nrhoAround,
  nrhoToEarth,
  nrhoToLlo,
  pathInFrame,
  siteDirection,
  stateInFrame,
} from './nrho'
import type { Transfer } from './nrho'
import { LAUNCHPADS } from './pads'
import { planFlight } from './plan'
import { integrate } from './sim'
import { DEFAULT_OPTIONS } from './types'
import type { FlightEphemeris, LandingTarget, Vec3 } from './types'
import { VEHICLES } from './vehicles'
import { add, cross, dot, norm, qrot, scale, sub, unit } from './vec'

const DAY_MS = 86400000
const HOUR_MS = 3600000
const ephem: FlightEphemeris = makeFlightEphemeris([aug2027, sep2027, oct2027].map((m) => JSON.parse(m) as EphemMonth))
const EPOCH = Date.UTC(2027, 8, 15)

// ---------- independent integrator: fixed-step RK4, ephemeris read directly ----------
//
// Near the Moon it works in Moon-centred coordinates, on the way from Earth in Earth-centred ones. The reason is
// the ephemeris reading: linear interpolation between 30-minute samples puts the Moon up to a kilometre off its
// path. As a third body that hardly matters, but as the origin of the coordinates it would shift Earth by that
// much, and near Earth a kilometre changes Earth's pull enough to spoil the comparison.

type State = { r: Vec3; v: Vec3 }
type Accel = (r: Vec3, t: number) => Vec3

function third(r: Vec3, body: Vec3, mu: number): Vec3 {
  const d = sub(r, body)
  return add(scale(d, -mu / norm(d) ** 3), scale(body, -mu / norm(body) ** 3))
}

/** Acceleration at r (Moon-centred) at UTC ms t: the Moon, plus Earth and the Sun as third bodies. */
const accelMoon: Accel = (r, t) => {
  const moon = ephem.moonPos(t) // Earth → Moon
  const earth = scale(moon, -1)
  const sun = sub(ephem.sunPos(t), moon)
  return add(scale(r, -MU_MOON / norm(r) ** 3), add(third(r, earth, MU_EARTH), third(r, sun, MU_SUN)))
}

/** Acceleration at r (Earth-centred): Earth, plus the Moon and the Sun as third bodies. */
const accelEarth: Accel = (r, t) => add(scale(r, -MU_EARTH / norm(r) ** 3), add(third(r, ephem.moonPos(t), MU_MOON), third(r, ephem.sunPos(t), MU_SUN)))

function rk4Coast(s0: State, t0Ms: number, t1Ms: number, stepOf: (s: State, tMs: number) => number, accel: Accel = accelMoon): State {
  let s = s0
  let t = t0Ms
  while (t < t1Ms - 1e-6) {
    const h = Math.min(stepOf(s, t), (t1Ms - t) / 1000)
    const hm = h * 1000
    const k1v = accel(s.r, t)
    const k1r = s.v
    const k2v = accel(add(s.r, scale(k1r, h / 2)), t + hm / 2)
    const k2r = add(s.v, scale(k1v, h / 2))
    const k3v = accel(add(s.r, scale(k2r, h / 2)), t + hm / 2)
    const k3r = add(s.v, scale(k2v, h / 2))
    const k4v = accel(add(s.r, scale(k3r, h)), t + hm)
    const k4r = add(s.v, scale(k3v, h))
    s = {
      r: add(s.r, scale(add(add(k1r, scale(k2r, 2)), add(scale(k3r, 2), k4r)), h / 6)),
      v: add(s.v, scale(add(add(k1v, scale(k2v, 2)), add(scale(k3v, 2), k4v)), h / 6)),
    }
    t += hm
  }
  return s
}

/** 5 s steps inside 10,000 km of the Moon's centre, 20 s inside 40,000 km, 60 s beyond. */
const stepNearMoon = (s: State) => (norm(s.r) < 10000 ? 5 : norm(s.r) < 40000 ? 20 : 60)

/** Index of the path sample at instant tMs (within a millisecond). */
function sampleAt(tr: Transfer, tMs: number): number {
  const i = tr.path.t.findIndex((t) => Math.abs(t - tMs) < 1)
  if (i < 0) throw new Error('no path sample at that instant')
  return i
}

/** Checks every burn of a transfer against the rocket equation and the engine's propellant flow. */
function expectConsistentBurns(tr: Transfer, massKg: number, thrustN: number, ispS: number) {
  let m = massKg
  for (const e of tr.events) {
    expect(e.massAfterKg).toBeCloseTo(m - e.propellantKg, 6)
    expect(e.dvKms).toBeCloseTo((G0 * ispS * Math.log(m / e.massAfterKg)) / 1000, 9)
    expect(e.propellantKg).toBeCloseTo((thrustN / (G0 * ispS)) * e.durationS, 3)
    m = e.massAfterKg
  }
  expect(tr.end.massKg).toBeCloseTo(m, 6)
  expect(tr.dvKms).toBeCloseTo(tr.events.reduce((acc, e) => acc + e.dvKms, 0), 12)
  // the path: strictly increasing instants, as many samples of every kind, engine on exactly during the burns
  const { t, r, v, thrusting } = tr.path
  expect(r.length).toBe(t.length)
  expect(v.length).toBe(t.length)
  expect(thrusting.length).toBe(t.length)
  let burning = 0
  for (let i = 1; i < t.length; i++) {
    expect(t[i]).toBeGreaterThan(t[i - 1])
    const dtS = (t[i] - t[i - 1]) / 1000
    // no jump: the step is the mean of the two velocities times the time, to within the curvature of a step
    expect(norm(sub(sub(r[i], r[i - 1]), scale(add(v[i], v[i - 1]), dtS / 2)))).toBeLessThan(0.002 * dtS * dtS + 1e-6)
    if (thrusting[i - 1]) burning += dtS
  }
  expect(burning).toBeCloseTo(tr.events.reduce((acc, e) => acc + e.durationS, 0), 3)
  expect(tr.path.t[0]).toBe(tr.start.utcMs)
  expect(tr.path.t[t.length - 1]).toBeCloseTo(tr.end.utcMs, 3)
}

// =====================================================================================================
// Stage 1: the reference orbit
// =====================================================================================================

describe('reference NRHO in the ephemeris field (stage 1)', () => {
  const t0 = performance.now()
  const orbit = nrhoAround(ephem, EPOCH, 6)
  const buildMs = performance.now() - t0
  const revs = orbit.revolutions

  it('holds for at least six revolutions around the epoch, each inside the published ranges [DAVIS]', () => {
    expect(revs.length).toBeGreaterThanOrEqual(6)
    expect(revs[0].periluneMs).toBeLessThan(EPOCH)
    expect(revs[revs.length - 1].periluneMs + revs[revs.length - 1].periodS * 1000).toBeGreaterThan(EPOCH)
    for (const rev of revs) {
      expect(rev.periodS / 86400).toBeGreaterThanOrEqual(6.26)
      expect(rev.periodS / 86400).toBeLessThanOrEqual(6.76)
      expect(rev.periluneRadiusKm).toBeGreaterThanOrEqual(3195)
      expect(rev.periluneRadiusKm).toBeLessThanOrEqual(3557)
      expect(rev.apoluneRadiusKm).toBeGreaterThanOrEqual(70005)
      expect(rev.apoluneRadiusKm).toBeLessThanOrEqual(71849)
      // southern family: perilune over the northern hemisphere, apolune over the southern
      expect(rev.periluneLatDeg).toBeGreaterThan(0)
      expect(rev.apoluneLatDeg).toBeLessThan(0)
    }
    const mean = (f: (r: (typeof revs)[number]) => number) => revs.reduce((acc, r) => acc + f(r), 0) / revs.length
    const range = (f: (r: (typeof revs)[number]) => number) => `${Math.min(...revs.map(f)).toFixed(f(revs[0]) > 100 ? 0 : 3)}–${Math.max(...revs.map(f)).toFixed(f(revs[0]) > 100 ? 0 : 3)}`
    console.log(
      `[nrho stage 1] ${revs.length} revolutions in ${buildMs.toFixed(0)} ms, ${orbit.iterations} Newton iterations. ` +
        `Period ${range((r) => r.periodS / 86400)} d, mean ${mean((r) => r.periodS / 86400).toFixed(3)} (published 6.26–6.76, mean 6.56). ` +
        `Perilune radius ${range((r) => r.periluneRadiusKm)} km, mean ${mean((r) => r.periluneRadiusKm).toFixed(0)} (published 3,195–3,557, mean 3,366). ` +
        `Apolune radius ${range((r) => r.apoluneRadiusKm)} km, mean ${mean((r) => r.apoluneRadiusKm).toFixed(0)} (published 70,005–71,849, mean 71,100). ` +
        `Perilune latitude ${range((r) => r.periluneLatDeg)}°, apolune latitude ${range((r) => r.apoluneLatDeg)}°. ` +
        `Corrections: ${orbit.corrections.length} patch points, total ${(orbit.correctionDvKms * 1e6).toExponential(2)} mm/s, largest position gap ${(orbit.maxPositionGapKm * 1e6).toFixed(3)} mm.`,
    )
  })

  it('has the 9:2 resonant period [LEE]', () => {
    // nine revolutions in two synodic months; LEE gives the 15-year average as 6.562 days
    expect(NRHO_PERIOD_S / 86400).toBeCloseTo(6.562, 3)
    // the solved span keeps that rhythm: its perilunes stay within a day of the uniform grid
    for (let i = 1; i < revs.length; i++) {
      const drift = (revs[i].periluneMs - revs[0].periluneMs) / 1000 - i * NRHO_PERIOD_S
      expect(Math.abs(drift)).toBeLessThan(86400)
    }
  })

  it('is one continuous ballistic path: no position jumps, and corrections far below the published ones [LEE]', () => {
    expect(orbit.maxPositionGapKm).toBeLessThan(1e-5) // 1 cm
    // LEE: 1.86 mm/s per revolution on average for NASA's reference. Here the arcs join without a burn, to the
    // solver's tolerance; the total over the whole span must stay below one published revolution's worth.
    expect(orbit.correctionDvKms).toBeLessThan(1.86e-6)
    expect(orbit.corrections.length).toBeGreaterThan(20)
    for (let i = 1; i < orbit.t.length; i++) {
      const dtS = (orbit.t[i] - orbit.t[i - 1]) / 1000
      expect(dtS).toBeGreaterThan(0)
      expect(dtS).toBeLessThanOrEqual(1800.001)
      expect(norm(sub(sub(orbit.r[i], orbit.r[i - 1]), scale(add(orbit.v[i], orbit.v[i - 1]), dtS / 2)))).toBeLessThan(0.002 * dtS * dtS + 1e-6)
    }
  })

  it('stateAt interpolates the stored samples to better than a metre', () => {
    // integrate from a stored sample with sim.ts to instants between samples, around a perilune
    const peri = revs[2].periluneMs
    const i0 = orbit.t.findIndex((t) => t > peri - 2 * HOUR_MS)
    let worstR = 0
    let worstV = 0
    for (const minutes of [7, 31, 64, 118, 151, 239]) {
      const run = integrate(orbit.field, { r: orbit.r[i0], v: orbit.v[i0], m: 1 }, orbit.t[i0], { maxSeconds: minutes * 60, tol: 1e-12 })
      const s = orbit.stateAt(orbit.t[i0] + minutes * 60000)
      worstR = Math.max(worstR, norm(sub(run.end.r, s.r)))
      worstV = Math.max(worstV, norm(sub(run.end.v, s.v)))
    }
    expect(worstR).toBeLessThan(1e-3)
    expect(worstV).toBeLessThan(1e-6)
  })

  it('an independent RK4 integration follows the orbit through a perilune', () => {
    // from 14 hours before a perilune to 14 hours after: the stretch where the orbit is fastest and most sensitive
    const peri = revs[3].periluneMs
    const from = peri - 14 * HOUR_MS
    const to = peri + 14 * HOUR_MS
    const end = rk4Coast(orbit.stateAt(from), from, to, stepNearMoon)
    const ref = orbit.stateAt(to)
    const dr = norm(sub(end.r, ref.r))
    const dv = norm(sub(end.v, ref.v))
    console.log(`[nrho stage 1] independent RK4 across a perilune (28 h): ${(dr * 1000).toFixed(2)} m and ${(dv * 1e6).toFixed(3)} mm/s from the orbit`)
    // The two integrators read the Moon's position differently (linear against cubic interpolation, up to about
    // a kilometre apart between the 30-minute samples). This close to the Moon that changes Earth's tide on the
    // craft by about 2e-12 km/s², ten metres in a day, and a perilune passage magnifies what came before it.
    expect(dr).toBeLessThan(0.1)
    expect(dv).toBeLessThan(1e-5)
  })

  it('refuses a span the ephemeris does not cover', () => {
    expect(() => nrhoAround(ephem, Date.UTC(2027, 7, 5), 6)).toThrow(NrhoError)
    expect(() => nrhoAround(ephem, Date.UTC(2026, 0, 1), 6)).toThrow(/does not cover/)
  })
})

// =====================================================================================================
// Stage 2: the lander between the NRHO and a low lunar orbit over the landing site
// =====================================================================================================

describe('lander transfers between the NRHO and a 100 km lunar orbit (stage 2)', () => {
  const orbit = nrhoAround(ephem, EPOCH, 6)
  const site: LandingTarget = { id: 'connecting-ridge', name: 'Connecting Ridge', latDeg: -89.46, lonDeg: -136.68 }
  // An illustrative lander, not a real vehicle: 40 t leaving the NRHO, 15 t leaving the surface, 60 kN at 340 s.
  // The delta-v hardly depends on these (the burns are short against the orbit).
  const thrustN = 60000
  const ispS = 340
  const rLlo = R_MOON + 100
  const vCirc = Math.sqrt(MU_MOON / rLlo)
  const perilune = orbit.revolutions[1].periluneMs
  const departMs = perilune - 0.5 * DAY_MS // half a day before the NRHO's perilune, as in WHITLEY and HLS
  const siteDir = siteDirection(ephem, site.latDeg, site.lonDeg, perilune)
  const t0 = performance.now()
  const down = nrhoToLlo({ nrho: orbit, departMs, siteDir, thrustN, ispS, massKg: 40000 })
  const downMs = performance.now() - t0
  const arriveMs = orbit.revolutions[2].periluneMs + 0.5 * DAY_MS // one revolution later, half a day after the perilune
  const siteDirUp = siteDirection(ephem, site.latDeg, site.lonDeg, orbit.revolutions[2].periluneMs)
  const t1 = performance.now()
  const up = lloToNrho({ nrho: orbit, arriveMs, siteDir: siteDirUp, thrustN, ispS, massKg: 15000 })
  const upMs = performance.now() - t1

  it('NRHO → low orbit ends in a 100 km circular orbit whose plane passes over the site', () => {
    const { r, v } = down.end
    expect(Math.abs(norm(r) - rLlo)).toBeLessThan(1e-3)
    expect(Math.abs(norm(v) - vCirc)).toBeLessThan(1e-6)
    expect(Math.abs(dot(r, v)) / (norm(r) * norm(v))).toBeLessThan(1e-6)
    expect(Math.abs(dot(unit(cross(r, v)), siteDir))).toBeLessThan(1e-6)
    expect(down.end.frame).toBe('moon')
    expect(down.start.utcMs).toBe(departMs)
    expect(norm(sub(down.start.r, orbit.stateAt(departMs).r))).toBeLessThan(1e-9)
    expect(down.events.map((e) => e.id)).toEqual(['lander-nrd', 'loi'])
    expect(down.events[1].label).toBe('Lunar Orbit Insertion (LOI)')
    expectConsistentBurns(down, 40000, thrustN, ispS)
    // the orbit stays circular: half a revolution later (sim.ts, full field) the radius is still within 2 km
    const half = integrate(orbit.field, { r, v, m: 1 }, down.end.utcMs, { maxSeconds: (Math.PI * rLlo) / vCirc })
    expect(Math.abs(norm(half.end.r) - rLlo)).toBeLessThan(2)
  })

  it('NRHO → low orbit costs what NASA publishes [HLS] [WHITLEY]', () => {
    const ms = down.dvKms * 1000
    console.log(
      `[nrho stage 2] NRHO → 100 km orbit over Connecting Ridge, 0.5 day: ${ms.toFixed(1)} m/s ` +
        `(${down.events.map((e) => `${e.id} ${(e.dvKms * 1000).toFixed(1)} m/s in ${e.durationS.toFixed(0)} s`).join(', ')}; instantaneous burns ${(down.impulsiveDvKms * 1000).toFixed(1)} m/s; solved in ${downMs.toFixed(0)} ms). ` +
        `Published: 704.5 and 704.9 m/s [HLS] (${(((ms - 704.7) / 704.7) * 100).toFixed(2)} % from their mean), 730 m/s [WHITLEY] (${(((ms - 730) / 730) * 100).toFixed(2)} %).`,
    )
    // 5 %: mission-design numbers for other dates and (WHITLEY) an earlier candidate orbit
    expect(Math.abs(ms - 704.7) / 704.7).toBeLessThan(0.05)
    expect(Math.abs(ms - 730) / 730).toBeLessThan(0.05)
    // finite burns cost a little more than instantaneous ones (the insertion takes minutes), never less
    expect(down.dvKms).toBeGreaterThan(down.impulsiveDvKms)
    expect(down.dvKms - down.impulsiveDvKms).toBeLessThan(0.01)
  })

  it('the departure burn is the cheapest that meets the two conditions', () => {
    // Hold one component of the instantaneous departure burn 2 m/s off the optimum, re-solve the other two for
    // the perilune radius and the plane, and compare the totals: no neighbour may be cheaper.
    const dv = down.impulsiveBurnsKms[0]
    const best = down.impulsiveDvKms
    let checked = 0
    for (const axis of [0, 1, 2] as const) {
      for (const off of [-0.002, 0.002]) {
        const cost = constrainedApsisCost(orbit, departMs, siteDir, 100, dv, axis, dv[axis] + off)
        if (cost === null) continue
        checked++
        expect(cost).toBeGreaterThan(best - 2e-6)
      }
      // and the optimum itself is reproduced when the component is held where it is
      const same = constrainedApsisCost(orbit, departMs, siteDir, 100, dv, axis, dv[axis])
      expect(same).not.toBeNull()
      expect(Math.abs(same! - best)).toBeLessThan(2e-6)
    }
    expect(checked).toBeGreaterThanOrEqual(4)
  })

  it('an independent RK4 integration of the coast arrives at the insertion burn', () => {
    const nrd = down.events[0]
    const i0 = sampleAt(down, nrd.utcMs + nrd.durationS * 1000)
    const i1 = sampleAt(down, down.events[1].utcMs)
    const end = rk4Coast({ r: down.path.r[i0], v: down.path.v[i0] }, down.path.t[i0], down.path.t[i1], stepNearMoon)
    const dr = norm(sub(end.r, down.path.r[i1]))
    const dv = norm(sub(end.v, down.path.v[i1]))
    const hours = (down.path.t[i1] - down.path.t[i0]) / HOUR_MS
    console.log(`[nrho stage 2] independent RK4 over the ${hours.toFixed(1)} h coast: ${(dr * 1000).toFixed(2)} m and ${(dv * 1e6).toFixed(3)} mm/s from the path`)
    // same reasoning as for the orbit itself; here the comparison ends a minute before the perilune, at 1.7 km/s
    expect(dr).toBeLessThan(0.1)
    expect(dv).toBeLessThan(1e-4)
  })

  it('low orbit → NRHO starts over the site and ends on the NRHO', () => {
    const { r, v } = up.start
    expect(Math.abs(norm(r) - rLlo)).toBeLessThan(1e-6)
    expect(Math.abs(norm(v) - vCirc)).toBeLessThan(1e-9)
    expect(Math.abs(dot(r, v))).toBeLessThan(1e-6)
    expect(Math.abs(dot(unit(cross(r, v)), siteDirUp))).toBeLessThan(1e-9)
    const target = orbit.stateAt(up.end.utcMs)
    expect(norm(sub(up.end.r, target.r))).toBeLessThan(1e-3) // 1 m
    expect(norm(sub(up.end.v, target.v))).toBeLessThan(1e-6) // 1 mm/s
    expect(Math.abs(up.end.utcMs - arriveMs)).toBeLessThan(10 * 60000)
    expect(up.events.map((e) => e.id)).toEqual(['llo-departure', 'lander-nri'])
    expectConsistentBurns(up, 15000, thrustN, ispS)
    const ms = up.dvKms * 1000
    const both = (down.dvKms + up.dvKms) * 1000
    console.log(
      `[nrho stage 2] 100 km orbit → NRHO, 0.5 day: ${ms.toFixed(1)} m/s (${up.events.map((e) => `${e.id} ${(e.dvKms * 1000).toFixed(1)} m/s in ${e.durationS.toFixed(0)} s`).join(', ')}; solved in ${upMs.toFixed(0)} ms). ` +
        `There and back ${both.toFixed(1)} m/s; published 1,461 m/s [WHITLEY] (${(((both - 1461) / 1461) * 100).toFixed(2)} %).`,
    )
    expect(Math.abs(ms - 730) / 730).toBeLessThan(0.05)
    expect(Math.abs(both - 1461) / 1461).toBeLessThan(0.05)
  })

  it('a site far from the plane of the NRHO costs more, and an engine too weak for the insertion is refused', () => {
    // Sub-Earth point: the NRHO's plane faces Earth, so this site is as far from it as a site can be.
    const equator = nrhoToLlo({ nrho: orbit, departMs, siteDir: siteDirection(ephem, 0, 0, perilune), thrustN, ispS, massKg: 40000 })
    expect(equator.dvKms).toBeGreaterThan(down.dvKms + 0.05)
    expect(Math.abs(dot(unit(cross(equator.end.r, equator.end.v)), siteDirection(ephem, 0, 0, perilune)))).toBeLessThan(1e-6)
    console.log(`[nrho stage 2] same transfer to a plane over the sub-Earth point (0° N, 0° E): ${(equator.dvKms * 1000).toFixed(1)} m/s`)
    // 300 N on 40 t: the insertion would burn for most of a day
    expect(() => nrhoToLlo({ nrho: orbit, departMs, siteDir, thrustN: 300, ispS, massKg: 40000 })).toThrow(NrhoError)
    expect(() => nrhoToLlo({ nrho: orbit, departMs, siteDir, thrustN: 300, ispS, massKg: 40000 })).toThrow(/needs more thrust/)
  })
})

// =====================================================================================================
// Stage 3: the crew spacecraft's arrival from Earth
// =====================================================================================================

describe('arrival from Earth: correction, outbound powered flyby, NRHO insertion (stage 3)', () => {
  // A translunar coast from the app's own planner: SLS Block 1 from LC-39B, injected on 2 September 2027 on a
  // path aimed at a 100 km perilune five days later (plan.ts).
  const pad = LAUNCHPADS.find((p) => p.id === 'ksc-39b')!
  const vehicle = VEHICLES.find((v) => v.id === 'sls-block-1')!
  const target: LandingTarget = { id: 'connecting-ridge', name: 'Connecting Ridge', latDeg: -89.46, lonDeg: -136.68 }
  const plan = planFlight({ pad, vehicle, target, options: { ...DEFAULT_OPTIONS, landingMs: Date.UTC(2027, 8, 8) }, ephem })
  const start = { utcMs: plan.tliMs, r: plan.injection.r, v: plan.injection.v, massKg: vehicle.injectedMassKg, frame: 'earth' as const }
  const thrustN = vehicle.spacecraftEngine.thrustN!
  const ispS = vehicle.spacecraftEngine.ispS
  // What the arrival costs depends on where the NRHO's spacecraft is when the flyby happens. NASA's numbers are
  // for missions timed for it, so the comparison uses an NRHO phased for this flyby: perilune passages 4.5 hours
  // later than the module's default grid, which puts the flyby 3.5 hours after a perilune (found by trying
  // phases 1.5 hours apart). The default phase is tried as well.
  const phased = nrhoAround(ephem, EPOCH, 6, Date.UTC(2027, 0, 1) + 4.5 * HOUR_MS)
  const t0 = performance.now()
  const arrival = earthToNrho({ ephem, nrho: phased, start, thrustN, ispS })
  const solveMs = performance.now() - t0
  const by = (id: string) => arrival.events.find((e) => e.id === id)!

  it('the plan is an integrated flight (the starting state is a real translunar coast)', () => {
    expect(plan.model).toBe('n-body')
  })

  it('ends on the NRHO after a flyby at 100 km', () => {
    const end = phased.stateAt(arrival.end.utcMs)
    expect(norm(sub(arrival.end.r, end.r))).toBeLessThan(0.02) // 20 m
    expect(norm(sub(arrival.end.v, end.v))).toBeLessThan(2e-5) // 2 cm/s
    expect(Math.abs(arrival.flyby.altitudeKm - 100)).toBeLessThan(0.1)
    expect(arrival.flyby.utcMs).toBeGreaterThan(by('opf').utcMs)
    expect(arrival.flyby.utcMs).toBeLessThan(by('opf').utcMs + by('opf').durationS * 1000)
    expect(arrival.path.frame).toBe('moon')
    expect(arrival.events.map((e) => e.id)).toEqual(['otc', 'opf', 'nri'])
    expect(by('opf').label).toBe('Outbound Powered Flyby (OPF)')
    expect(by('nri').label).toBe('NRHO Insertion (NRI)')
    expectConsistentBurns(arrival, vehicle.injectedMassKg, thrustN, ispS)
    // it stays on the NRHO: coasting on for a day (sim.ts) it is still within a kilometre of the orbit
    const later = integrate(phased.field, { r: arrival.end.r, v: arrival.end.v, m: 1 }, arrival.end.utcMs, { maxSeconds: 86400 })
    expect(norm(sub(later.end.r, phased.stateAt(arrival.end.utcMs + DAY_MS).r))).toBeLessThan(1)
  })

  it('starts from the given state, in either frame', () => {
    const moonStart = stateInFrame(ephem, start, 'moon')
    expect(norm(sub(arrival.start.r, moonStart.r))).toBeLessThan(1e-9)
    const back = stateInFrame(ephem, moonStart, 'earth')
    expect(norm(sub(back.r, start.r))).toBeLessThan(1e-6)
    expect(norm(sub(back.v, start.v))).toBeLessThan(1e-9)
    const geo = pathInFrame(ephem, arrival.path, 'earth')
    expect(geo.frame).toBe('earth')
    expect(norm(sub(geo.r[0], start.r))).toBeLessThan(1e-6)
    expect(norm(sub(geo.v[0], start.v))).toBeLessThan(1e-9)
    // the far end of the Earth-centred path is at the Moon's distance
    expect(norm(geo.r[geo.r.length - 1])).toBeGreaterThan(300000)
  })

  it('costs about what NASA publishes for Orion [WHITLEY]', () => {
    const otc = by('otc').dvKms * 1000
    const opf = by('opf').dvKms * 1000
    const nri = by('nri').dvKms * 1000
    const total = arrival.dvKms * 1000
    const days = (arrival.end.utcMs - plan.tliMs) / DAY_MS
    console.log(
      `[nrho stage 3] OTC ${otc.toFixed(1)} m/s, OPF ${opf.toFixed(1)} m/s in ${by('opf').durationS.toFixed(0)} s, NRI ${nri.toFixed(1)} m/s in ${by('nri').durationS.toFixed(0)} s, ` +
        `total ${total.toFixed(1)} m/s (instantaneous burns ${(arrival.impulsiveDvKms * 1000).toFixed(1)}), ${days.toFixed(2)} days from injection to the NRHO, ` +
        `flyby at ${arrival.flyby.altitudeKm.toFixed(2)} km, insertion ${((arrival.end.utcMs - arrival.flyby.utcMs) / HOUR_MS).toFixed(1)} h later at ${norm(arrival.end.r).toFixed(0)} km from the Moon; solved in ${solveMs.toFixed(0)} ms. ` +
        `Published [WHITLEY]: flyby 178 m/s (${(((opf - 178) / 178) * 100).toFixed(1)} %), insertion 250.5 m/s (${(((nri - 250.5) / 250.5) * 100).toFixed(1)} %), ` +
        `together 428.5 m/s (${(((total - 428.5) / 428.5) * 100).toFixed(1)} %), 5.1 days (${(days - 5.1).toFixed(2)} d).`,
    )
    // The total is the comparable number: 10 % for a different orbit (WHITLEY predates the choice of the 9:2
    // NRHO), a different date, and an Earth departure that was not designed for this arrival. How the total is
    // split between the two burns is not asserted; the difference is printed above and reported.
    expect(Math.abs(total - 428.5) / 428.5).toBeLessThan(0.1)
    expect(otc).toBeLessThan(5) // the planner's injection already aims at the Moon; the correction is small
    expect(Math.abs(arrival.dvKms - arrival.impulsiveDvKms)).toBeLessThan(0.005)
  })

  it('an independent RK4 integration of the coast to the Moon follows the path', () => {
    const otc = by('otc')
    const i0 = sampleAt(arrival, otc.utcMs + otc.durationS * 1000)
    const geo = pathInFrame(ephem, arrival.path, 'earth')
    const { t, r, v } = geo
    // Earth-centred, from the end of the correction burn. Compared 12 hours before the flyby burn, about
    // 50,000 km from the Moon; then flown on without the burn to the closest approach, which is compared as
    // numeric.test.ts compares a perilune: by its altitude and its instant.
    const i1 = t.findIndex((x) => x > by('opf').utcMs - 12 * HOUR_MS)
    const nearBody = (s: State, tMs: number) => (norm(s.r) < 60000 || norm(sub(s.r, ephem.moonPos(tMs))) < 60000 ? 5 : 30)
    const mid = rk4Coast({ r: r[i0], v: v[i0] }, t[i0], t[i1], nearBody, accelEarth)
    const dr = norm(sub(mid.r, r[i1]))
    const dv = norm(sub(mid.v, v[i1]))
    let s = mid
    let tMs = t[i1]
    let closest = Infinity
    let tClosest = tMs
    while (tMs < by('opf').utcMs + 10 * 60000) {
      const step = tMs < by('opf').utcMs - 20 * 60000 ? 60000 : 2000
      s = rk4Coast(s, tMs, tMs + step, () => 2, accelEarth)
      tMs += step
      const d = norm(sub(s.r, ephem.moonPos(tMs)))
      if (d < closest) {
        closest = d
        tClosest = tMs
      }
    }
    console.log(
      `[nrho stage 3] independent RK4 over the ${((t[i1] - t[i0]) / DAY_MS).toFixed(2)} d coast: ${dr.toFixed(2)} km and ${(dv * 1000).toFixed(4)} m/s from the path 12 h before the flyby; ` +
        `flown on without the burn it passes ${(closest - R_MOON).toFixed(1)} km above the Moon, ${((tClosest - arrival.flyby.utcMs) / 1000).toFixed(0)} s from the closest approach of the path`,
    )
    // the same agreement numeric.test.ts asks of two integrators that read the ephemeris differently
    expect(dr).toBeLessThan(15)
    expect(dv).toBeLessThan(1e-3)
    expect(Math.abs(closest - R_MOON - 100)).toBeLessThan(15)
    expect(Math.abs(tClosest - arrival.flyby.utcMs) / 1000).toBeLessThan(60)
  })

  it('the default phase of the NRHO costs more, and a flyby at the wrong point of the revolution is refused with the reason', () => {
    const orbit = nrhoAround(ephem, EPOCH, 6)
    const other = earthToNrho({ ephem, nrho: orbit, start, thrustN, ispS })
    console.log(`[nrho stage 3] same flight into the default-phase NRHO (flyby ${((other.flyby.utcMs - orbit.revolutions.filter((r) => r.periluneMs < other.flyby.utcMs).pop()!.periluneMs) / HOUR_MS).toFixed(1)} h after its perilune): ${(other.dvKms * 1000).toFixed(1)} m/s`)
    expect(other.dvKms).toBeGreaterThan(arrival.dvKms)
    expect(norm(sub(other.end.r, orbit.stateAt(other.end.utcMs).r))).toBeLessThan(0.02)
    // three days later the NRHO's spacecraft is near its apolune when Orion passes the Moon
    const late = planFlight({ pad, vehicle, target, options: { ...DEFAULT_OPTIONS, landingMs: Date.UTC(2027, 8, 11) }, ephem })
    const lateStart = { utcMs: late.tliMs, r: late.injection.r, v: late.injection.v, massKg: vehicle.injectedMassKg, frame: 'earth' as const }
    expect(() => earthToNrho({ ephem, nrho: orbit, start: lateStart, thrustN, ispS })).toThrow(NrhoError)
    expect(() => earthToNrho({ ephem, nrho: orbit, start: lateStart, thrustN, ispS })).toThrow(/wrong point of its revolution/)
  }, 30000) // an orbit, two flight plans and three arrivals are solved here: 3 to 6 seconds, over the default limit on a busy machine
})

// =====================================================================================================
// Stage 4: the crew spacecraft's return to Earth
// =====================================================================================================

describe('return to Earth: NRHO departure, return powered flyby, Entry Interface (stage 4)', () => {
  const orbit = nrhoAround(ephem, EPOCH, 6)
  // Orion on the NRHO after its arrival burns: about 24 t; the service module's main engine, 26.7 kN at 315.1 s
  // (spacecraft.ts). The delta-v hardly depends on these.
  const massKg = 24000
  const thrustN = 26700
  const ispS = 315.1
  const FPA_DEG = -5.66 // Artemis I [REA]
  const ENTRY_ALT_KM = 121.92
  // The capsule may leave from half a day after a perilune (when a lander would be back) for one revolution.
  const perilune = orbit.revolutions[2].periluneMs
  const earliestMs = perilune + 0.5 * DAY_MS
  const t0 = performance.now()
  const home = nrhoToEarth({ ephem, nrho: orbit, earliestMs, massKg, thrustN, ispS, entryFpaDeg: FPA_DEG })
  const solveMs = performance.now() - t0
  const by = (id: string) => home.events.find((e) => e.id === id)!
  const rEi = R_EARTH_EQ + ENTRY_ALT_KM

  it('starts on the NRHO inside the window, passes the Moon at 100 km and meets Entry Interface at the asked angle', () => {
    const on = orbit.stateAt(home.start.utcMs)
    expect(norm(sub(home.start.r, on.r))).toBeLessThan(1e-9)
    expect(norm(sub(home.start.v, on.v))).toBeLessThan(1e-12)
    expect(home.events.map((e) => e.id)).toEqual(['nrd', 'rpf'])
    expect(by('nrd').label).toBe('NRHO Departure (NRD)')
    expect(by('rpf').label).toBe('Return Powered Flyby (RPF)')
    expect(by('nrd').utcMs).toBeGreaterThanOrEqual(earliestMs)
    expect(by('nrd').utcMs).toBeLessThanOrEqual(earliestMs + NRHO_PERIOD_S * 1000)
    expectConsistentBurns(home, massKg, thrustN, ispS)
    expect(Math.abs(home.flyby.altitudeKm - 100)).toBeLessThan(0.1)
    expect(home.flyby.utcMs).toBeGreaterThan(by('rpf').utcMs)
    expect(home.flyby.utcMs).toBeLessThan(by('rpf').utcMs + by('rpf').durationS * 1000)
    // the end: Earth-centred, at 121.92 km, descending at the asked angle
    expect(home.end.frame).toBe('earth')
    expect(Math.abs(norm(home.end.r) - rEi)).toBeLessThan(1e-3)
    const fpa = (Math.asin(dot(home.end.r, home.end.v) / (norm(home.end.r) * norm(home.end.v))) * 180) / Math.PI
    expect(Math.abs(fpa - FPA_DEG)).toBeLessThan(0.002)
    expect(home.entry.fpaDeg).toBeCloseTo(fpa, 9)
    expect(home.entry.utcMs).toBe(home.end.utcMs)
    expect(home.entry.speedKms).toBeCloseTo(norm(home.end.v), 12)
    // a fall from the Moon's distance arrives a little below the escape speed at that height (11.07 km/s)
    const escape = Math.sqrt((2 * MU_EARTH) / rEi)
    expect(home.entry.speedKms).toBeLessThan(escape)
    expect(home.entry.speedKms).toBeGreaterThan(0.99 * escape)
    // the Moon-centred path, seen from Earth, ends at the same point
    const geo = pathInFrame(ephem, home.path, 'earth')
    expect(norm(sub(geo.r[geo.r.length - 1], home.end.r))).toBeLessThan(1e-6)
    expect(norm(sub(geo.v[geo.v.length - 1], home.end.v))).toBeLessThan(1e-9)
  })

  it('costs about what NASA publishes for Orion [WHITLEY]', () => {
    const nrd = by('nrd').dvKms * 1000
    const rpf = by('rpf').dvKms * 1000
    const total = home.dvKms * 1000
    const before = orbit.revolutions.map((r) => r.periluneMs).find((p) => p > home.flyby.utcMs)!
    console.log(
      `[nrho stage 4] NRD ${nrd.toFixed(1)} m/s in ${by('nrd').durationS.toFixed(0)} s, RPF ${rpf.toFixed(1)} m/s in ${by('rpf').durationS.toFixed(0)} s, ` +
        `total ${total.toFixed(1)} m/s (instantaneous burns ${(home.impulsiveDvKms * 1000).toFixed(1)}); departure ${((by('nrd').utcMs - perilune) / DAY_MS).toFixed(2)} d after the perilune, ` +
        `flyby ${((home.flyby.utcMs - by('nrd').utcMs) / HOUR_MS).toFixed(1)} h later at ${home.flyby.altitudeKm.toFixed(2)} km, ${((before - home.flyby.utcMs) / HOUR_MS).toFixed(1)} h before the NRHO's own perilune; ` +
        `leaves the Moon at ${home.vInfKms.toFixed(3)} km/s; ${home.returnDays.toFixed(2)} d from the departure burn to Entry Interface at ${home.entry.speedKms.toFixed(3)} km/s, ` +
        `${home.entry.fpaDeg.toFixed(4)}° (${home.entry.latDeg.toFixed(1)}° N, ${home.entry.lonDeg.toFixed(1)}° E); solved in ${solveMs.toFixed(0)} ms. ` +
        `Published [WHITLEY]: departure 221.5 m/s (${(((nrd - 221.5) / 221.5) * 100).toFixed(1)} %), flyby 190 m/s (${(((rpf - 190) / 190) * 100).toFixed(1)} %), ` +
        `together 411.5 m/s (${(((total - 411.5) / 411.5) * 100).toFixed(1)} %), 5.0 days (${(home.returnDays - 5.0).toFixed(2)} d).`,
    )
    // As for the arrival, the total is the comparable number: 10 % for a different orbit (WHITLEY predates the
    // choice of the 9:2 NRHO) and a different date. The split between the two burns and the flight time are
    // not asserted; the differences are printed above and reported.
    expect(Math.abs(total - 411.5) / 411.5).toBeLessThan(0.1)
    expect(Math.abs(home.dvKms - home.impulsiveDvKms)).toBeLessThan(0.005)
    // a minimum-energy fall from the Moon takes five days, the way from the departure to the flyby up to one more
    expect(home.returnDays).toBeGreaterThan(4)
    expect(home.returnDays).toBeLessThan(6.5)
  })

  it('an independent RK4 integration of the trans-Earth coast arrives at Entry Interface', () => {
    // Earth-centred with Earth's oblateness (the J2 term, written out here), from 12 hours after the flyby,
    // when the craft is 50,000 km from the Moon. Compared 2 hours before the entry, then flown on to 121.92 km.
    const J2 = 1.08262668e-3
    const pole = qrot(ephem.earthFixedToInertial(home.entry.utcMs), [0, 0, 1])
    const accelJ2: Accel = (r, t) => {
      const rn = norm(r)
      const s = dot(r, pole) / rn
      const c = (-1.5 * J2 * MU_EARTH * R_EARTH_EQ * R_EARTH_EQ) / rn ** 5
      return add(accelEarth(r, t), add(scale(r, c * (1 - 5 * s * s)), scale(pole, c * 2 * s * rn)))
    }
    const geo = pathInFrame(ephem, home.path, 'earth')
    const { t, r, v } = geo
    const rpfEnd = by('rpf').utcMs + by('rpf').durationS * 1000
    const i0 = t.findIndex((x) => x > rpfEnd + 12 * HOUR_MS)
    let i1 = t.length - 1
    while (t[i1] > home.entry.utcMs - 2 * HOUR_MS) i1--
    const nearBody = (s: State, tMs: number) => (norm(s.r) < 60000 || norm(sub(s.r, ephem.moonPos(tMs))) < 60000 ? 5 : 30)
    let s = rk4Coast({ r: r[i0], v: v[i0] }, t[i0], t[i1], nearBody, accelJ2)
    const dr = norm(sub(s.r, r[i1]))
    const dv = norm(sub(s.v, v[i1]))
    let tMs = t[i1]
    while (norm(s.r) > rEi && tMs < home.entry.utcMs + HOUR_MS) {
      // one-second steps; the last one is cut where the radius reaches the entry radius (linear in time)
      const next = rk4Coast(s, tMs, tMs + 1000, () => 1, accelJ2)
      if (norm(next.r) <= rEi) {
        const f = (norm(s.r) - rEi) / (norm(s.r) - norm(next.r))
        s = rk4Coast(s, tMs, tMs + 1000 * f, () => f, accelJ2)
        tMs += 1000 * f
        break
      }
      s = next
      tMs += 1000
    }
    const fpa = (Math.asin(dot(s.r, s.v) / (norm(s.r) * norm(s.v))) * 180) / Math.PI
    console.log(
      `[nrho stage 4] independent RK4 over the ${((t[i1] - t[i0]) / DAY_MS).toFixed(2)} d fall: ${dr.toFixed(2)} km and ${(dv * 1000).toFixed(4)} m/s from the path 2 h before the entry; ` +
        `flown on it reaches ${(norm(s.r) - R_EARTH_EQ).toFixed(2)} km at ${fpa.toFixed(3)}°, ${((tMs - home.entry.utcMs) / 1000).toFixed(1)} s from the entry of the path`,
    )
    // the agreement asked of the coast to the Moon in stage 3 (two integrators that read the ephemeris differently)
    expect(dr).toBeLessThan(15)
    expect(dv).toBeLessThan(1e-3)
    expect(Math.abs(norm(s.r) - rEi)).toBeLessThan(0.01)
    // 15 km across the path 2 hours out is 15 km of perigee height, and 22 km of perigee height is 1° at the entry
    expect(Math.abs(fpa - home.entry.fpaDeg)).toBeLessThan(15 / 22)
    expect(Math.abs(tMs - home.entry.utcMs) / 1000).toBeLessThan(60)
  })

  it('a window away from the cheap point of the revolution costs more, and a window outside the orbit is refused', () => {
    // two days starting 2.5 days after the perilune: the cheap departure (about 5.8 days after it) is outside
    const from = perilune + 2.5 * DAY_MS
    const early = nrhoToEarth({ ephem, nrho: orbit, earliestMs: from, windowDays: 2, massKg, thrustN, ispS, entryFpaDeg: -6.5 })
    console.log(
      `[nrho stage 4] departure held to 2.5–4.5 d after the perilune, entry at −6.5°: ${(early.dvKms * 1000).toFixed(1)} m/s ` +
        `(${early.events.map((e) => `${e.id} ${(e.dvKms * 1000).toFixed(1)} m/s`).join(', ')}), departure ${((early.events[0].utcMs - perilune) / DAY_MS).toFixed(2)} d after the perilune, entry at ${early.entry.fpaDeg.toFixed(4)}°`,
    )
    expect(early.events[0].utcMs).toBeGreaterThanOrEqual(from)
    expect(early.events[0].utcMs).toBeLessThanOrEqual(from + 2 * DAY_MS)
    expect(early.dvKms).toBeGreaterThan(home.dvKms + 0.05)
    expect(Math.abs(early.entry.fpaDeg + 6.5)).toBeLessThan(0.002) // the angle the caller asks for
    expect(Math.abs(norm(early.end.r) - rEi)).toBeLessThan(1e-3)
    expect(() => nrhoToEarth({ ephem, nrho: orbit, earliestMs: orbit.endMs + DAY_MS, massKg, thrustN, ispS, entryFpaDeg: FPA_DEG })).toThrow(NrhoError)
    expect(() => nrhoToEarth({ ephem, nrho: orbit, earliestMs: orbit.endMs + DAY_MS, massKg, thrustN, ispS, entryFpaDeg: FPA_DEG })).toThrow(/outside the span/)
    expect(() => nrhoToEarth({ ephem, nrho: orbit, earliestMs, massKg, thrustN, ispS, entryFpaDeg: 5 })).toThrow(/must be negative/)
  }, 60000) // a second return is solved here: several seconds
})
