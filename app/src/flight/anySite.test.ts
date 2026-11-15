// Any landing point, any surface stay, both mission designs, on the real DE440 ephemeris. Every case has to
// return a plan (no exception) that lands on the asked point, brings the lander back to the capsule, and brings
// the capsule home through Entry Interface at the asked angle on one continuous path.
//
// A plan is not the same as a mission the hardware can fly: where a stage would need more propellant than its
// tanks hold, the plan says so in `propellant` and in a note, and the test checks that it does.
//
// Low lunar orbit (Apollo hardware): the whole grid, latitudes −89.5 … 85 by longitudes 0 (near side), ±90
// (limbs), 180 (far side); each point with Apollo 11's stay and one of Apollo 17's stay, 14 days, 30 days.
// Halo orbit (Starship and Blue Moon): a plan takes about ten seconds, so the grid is sampled: both poles, mid
// latitudes, the equator, near side, far side and a limb, with stays that end with and without a wait in orbit.
import { describe, expect, it } from 'vitest'
import aug2027 from '../../public/data/ephem/2027-08.json?raw'
import sep2027 from '../../public/data/ephem/2027-09.json?raw'
import oct2027 from '../../public/data/ephem/2027-10.json?raw'
import nov2027 from '../../public/data/ephem/2027-11.json?raw'
import type { EphemMonth } from '../data/types'
import { R_EARTH_EQ, R_MOON } from './astro'
import { craftAt } from './craft'
import { makeFlightEphemeris } from './ephemeris'
import { LAUNCH_VEHICLES } from './launchVehicles'
import { planMission } from './mission'
import { planMissionNrho } from './missionNrho'
import { LAUNCHPADS } from './pads'
import { ARCHITECTURES, SPACECRAFT } from './spacecraft'
import type { MissionLeg, MissionPlan, Vec3 } from './types'
import { add, norm, sub } from './vec'

const ephem = makeFlightEphemeris([aug2027, sep2027, oct2027, nov2027].map((m) => JSON.parse(m) as EphemMonth))
const hardwareOf = (id: string) => {
  const arch = ARCHITECTURES.find((a) => a.id === id)!
  return {
    architecture: arch,
    launchVehicle: LAUNCH_VEHICLES.find((v) => v.id === arch.launchVehicleId)!,
    capsule: SPACECRAFT.find((v) => v.id === arch.capsuleId)!,
    lander: SPACECRAFT.find((v) => v.id === arch.landerId)!,
  }
}
const pad = LAUNCHPADS.find((p) => p.id === 'ksc-39b')!
const DAY_MS = 86400_000
const HOUR_MS = 3600_000

/** The checks of the sweep. entryFpaDeg: the angle asked for at Entry Interface. */
function check(plan: MissionPlan, askedStayDays: number, entryFpaDeg: number, what: string) {
  const at = (id: string) => plan.events.find((e) => e.id === id)!.utcMs
  // lands on the asked point
  expect(plan.facts.landingMissM, `${what}: touchdown miss`).toBeLessThan(10)
  const landed = craftAt(plan, 'lander', plan.touchdownMs)!
  expect(Math.abs(norm(landed.pos) - R_MOON), `${what}: on the surface`).toBeLessThan(0.05)
  // the lander is back at the capsule at docking, and rides with it afterwards
  const capsule = craftAt(plan, 'capsule', plan.dockingMs)!
  const lander = craftAt(plan, 'lander', plan.dockingMs)!
  expect(lander.docked, `${what}: own path up to docking`).toBe(false)
  expect(norm(sub(capsule.pos, lander.pos)), `${what}: docking distance, km`).toBeLessThan(0.5)
  expect(craftAt(plan, 'lander', plan.dockingMs + HOUR_MS)!.docked).toBe(true)
  // Entry Interface at the asked angle, at 121.92 km
  expect(Math.abs(plan.facts.entry.fpaDeg - entryFpaDeg), `${what}: entry angle`).toBeLessThan(0.02)
  // the capsule's path is continuous from liftoff to Entry Interface, also across a change of frame
  const legs = plan.legs.filter((l) => l.craft === 'capsule')
  expect(legs[0].track.t[0]).toBe(plan.launchMs)
  const last = legs[legs.length - 1]
  expect(last.track.t[last.track.t.length - 1]).toBe(plan.endMs)
  expect(Math.abs(norm(last.track.p[last.track.p.length - 1]) - (R_EARTH_EQ + 121.92))).toBeLessThan(0.05)
  for (let i = 1; i < legs.length; i++) {
    const a = legs[i - 1]
    const b = legs[i]
    const tJoin = b.track.t[0]
    const world = (leg: MissionLeg, p: Vec3) => (leg.frame === 'moon' ? add(p, ephem.moonPos(tJoin)) : p)
    expect(Math.abs(tJoin - a.track.t[a.track.t.length - 1]), `${what}: ${a.id} → ${b.id}, ms`).toBeLessThanOrEqual(1)
    expect(norm(sub(world(a, a.track.p[a.track.p.length - 1]), world(b, b.track.p[0]))), `${what}: ${a.id} → ${b.id}, km`).toBeLessThan(2)
  }
  for (const leg of plan.legs) for (let i = 1; i < leg.track.t.length; i++) expect(leg.track.t[i]).toBeGreaterThan(leg.track.t[i - 1])
  // the events come in order and every burn takes time
  for (const [a, b] of [['touchdown', 'lunar-liftoff'], ['lunar-liftoff', 'docking'], ['docking', 'tei'], ['tei', 'ei']]) expect(at(b), `${what}: ${a} before ${b}`).toBeGreaterThan(at(a))
  for (const e of plan.events.filter((x) => x.kind === 'burn')) expect(e.durationS, `${what}: ${e.id}`).toBeGreaterThan(0)
  // the stay flown is reported, with the one asked for
  expect(plan.facts.surfaceStayAskedDays).toBe(askedStayDays)
  expect(plan.facts.surfaceStayDays).toBeCloseTo((plan.lunarLiftoffMs - plan.touchdownMs) / DAY_MS, 6)
  // every shortfall of propellant is in the notes, and nothing else is called one
  const short = plan.propellant.filter((u) => u.usedKg > u.capacityKg)
  expect(plan.notes.filter((n) => n.includes('more propellant than it carries')).length, `${what}: shortfall notes`).toBe(short.length)
  // the energy comparison is there and is a lower bound
  const ideal = plan.facts.ideal!
  expect(ideal.outboundMjPerKg).toBeGreaterThan(58.5)
  expect(ideal.outboundMjPerKg).toBeLessThan(59.7)
  expect(ideal.ratio).toBeGreaterThan(1)
}

const LATS = [-89.5, -60, -30, 0, 30, 60, 85]
const LONS = [0, 90, 180, -90]

describe('low lunar orbit design, Apollo hardware: every landing point', () => {
  const hw = hardwareOf('apollo')
  const stay = hw.architecture.surfaceStay!
  const earliest = Date.UTC(2027, 7, 16)
  const longer = [stay.maxDays!, 14, 30]
  const tally = { plans: 0, lopc: 0, landerTurn: 0, short: 0, shortAtApolloStays: 0 }
  const lines: string[] = []

  LATS.forEach((latDeg, i) => {
    it(`latitude ${latDeg}°: near side, limbs and far side`, () => {
      LONS.forEach((lonDeg, j) => {
        for (const days of [stay.defaultDays, longer[(i + j) % longer.length]]) {
          const what = `LLO ${latDeg}° / ${lonDeg}°, ${days.toFixed(2)} d`
          const plan = planMission({ ...hw, pad, target: { id: 'x', name: 'Chosen landing point', latDeg, lonDeg }, ephem, earliestTouchdownMs: earliest, surfaceStayDays: days, returnWindowDays: 0, maxTransferDays: null })
          check(plan, days, -6.5, what)
          // the low-orbit design flies the stay asked for: within an hour for the rendezvous phasing, and within
          // the liftoff window (a twentieth of the stay, three hours at most)
          expect(Math.abs(plan.facts.surfaceStayDays - days) * 24, `${what}: stay`).toBeLessThan(1.05 + Math.min(3, 0.05 * days * 24))
          expect(plan.notes.some((n) => n.includes('needs no plane change') || n.includes('no stay needs a plane change')), `${what}: stays without plane change`).toBe(true)
          const lopc = plan.events.find((e) => e.id === 'lopc')
          if (lopc) {
            // a plane change by the capsule is a burn with its own leg, before the lander lifts off
            expect(lopc.label).toBe('Lunar Orbit Plane Change (LOPC)')
            expect(lopc.utcMs).toBeLessThan(plan.lunarLiftoffMs)
            expect(lopc.utcMs).toBeGreaterThan(plan.touchdownMs)
            expect(plan.legs.some((l) => l.id === 'lopc' && l.powered && l.craft === 'capsule')).toBe(true)
            expect(plan.events.some((e) => e.id === 'plane-change')).toBe(false) // nothing is left for the lander to turn
          }
          if (days > stay.maxDays! + 1e-9) expect(plan.notes.some((n) => n.includes('longer than this hardware supported')), `${what}: note on the hardware's limit`).toBe(true)
          const short = plan.propellant.filter((u) => u.usedKg > u.capacityKg)
          tally.plans++
          if (lopc) tally.lopc++
          else if (plan.events.some((e) => e.id === 'plane-change')) tally.landerTurn++
          if (short.length) tally.short++
          if (short.length && days <= stay.maxDays! + 1e-9) tally.shortAtApolloStays++
          lines.push(
            `  ${String(latDeg).padStart(5)}° ${String(lonDeg).padStart(4)}° ${days.toFixed(2).padStart(5)} d → ${plan.facts.surfaceStayDays.toFixed(2)} d; ` +
              (lopc ? `LOPC ${(lopc.dvKms! * 1000).toFixed(0)} m/s` : `lander turns ${((plan.events.find((e) => e.id === 'plane-change')?.dvKms ?? 0) * 1000).toFixed(0)} m/s`) +
              (short.length ? `; SHORT: ${short.map((u) => `${u.element} ${((u.usedKg - u.capacityKg) / 1000).toFixed(2)} t`).join(', ')}` : ''),
          )
        }
      })
    }, 120000)
  })

  it('summary', () => {
    console.log(`[any site, LLO] ${tally.plans} plans; capsule plane change in ${tally.lopc}, lander plane change burn in ${tally.landerTurn}; propellant short in ${tally.short} (${tally.shortAtApolloStays} at stays Apollo flew)\n${lines.join('\n')}`)
    expect(tally.plans).toBe(LATS.length * LONS.length * 2)
  })
})

describe('halo orbit design: landing points over the whole Moon, stays with and without a wait in low orbit', () => {
  const earliest = Date.UTC(2027, 8, 12)
  const lines: string[] = []
  // [architecture, latitude, longitude, stay asked (days)]
  const cases: [string, number, number, number][] = [
    ['artemis-starship', -89.5, 0, 6.5], // south pole, one revolution
    ['artemis-starship', 85, 180, 0.5], // near the north pole, far side, half a day
    ['artemis-starship', -30, 90, 3], // southern mid latitude on the limb
    ['artemis-starship', 0, 180, 10], // far-side equator
    ['artemis-starship', 60, -90, 14], // northern mid latitude on the other limb, about two revolutions
    ['artemis-starship', 0, 0, 30], // near-side equator, the longest stay
    ['artemis-blue-moon', -89.5, 180, 6.5],
    ['artemis-blue-moon', 0, 0, 3], // near-side equator
    ['artemis-blue-moon', 30, 180, 6.5], // far side, northern mid latitude
    ['artemis-blue-moon', -60, 0, 13], // southern mid latitude, two revolutions
  ]
  it.each(cases)('%s at %d° / %d°, %d days asked', (archId, latDeg, lonDeg, days) => {
    const hw = hardwareOf(archId)
    const what = `NRHO ${archId} ${latDeg}° / ${lonDeg}°, ${days} d`
    const plan = planMissionNrho({ ...hw, pad, target: { id: 'x', name: 'Chosen landing point', latDeg, lonDeg }, ephem, earliestTouchdownMs: earliest, surfaceStayDays: days, returnWindowDays: 0, maxTransferDays: null })
    check(plan, days, -5.66, what)
    // The stay: as asked (up to one revolution of the low orbit later, for the phasing), or cut short by at most
    // six hours to the last liftoff for a passage of the NRHO; the note says which, with the numbers.
    const off = plan.facts.surfaceStayDays - days
    expect(off * 24, `${what}: stay`).toBeGreaterThan(-6.01)
    expect(off * 24, `${what}: stay`).toBeLessThan(2.1)
    const note = plan.notes.find((n) => n.includes(`Asked for ${days} days on the surface`))
    expect(note, `${what}: note on the stay`).toBeDefined()
    const wait = (plan.events.find((e) => e.id === 'llo-departure')!.utcMs - plan.events.find((e) => e.id === 'llo-arrival')!.utcMs) / DAY_MS
    if (wait > 0.25) expect(note).toMatch(/waits \d+\.\d\d days in low lunar orbit/)
    expect(wait).toBeLessThan(6.6) // never longer than one revolution of the NRHO
    // the lander's own path is continuous from undocking to docking
    const lander = plan.legs.filter((l) => l.craft === 'lander')
    for (let i = 1; i < lander.length; i++) {
      expect(Math.abs(lander[i].track.t[0] - lander[i - 1].track.t[lander[i - 1].track.t.length - 1])).toBeLessThanOrEqual(1)
      expect(norm(sub(lander[i].track.p[0], lander[i - 1].track.p[lander[i - 1].track.p.length - 1])), `${what}: lander ${lander[i - 1].id} → ${lander[i].id}, km`).toBeLessThan(2)
    }
    const short = plan.propellant.filter((u) => u.usedKg > u.capacityKg)
    lines.push(
      `  ${archId} ${latDeg}° ${lonDeg}° ${days} d → ${plan.facts.surfaceStayDays.toFixed(2)} d, wait in low orbit ${wait.toFixed(2)} d` +
        (short.length ? `; SHORT: ${short.map((u) => `${u.element} ${((u.usedKg - u.capacityKg) / 1000).toFixed(2)} t`).join(', ')}` : ''),
    )
  }, 120000)

  it('summary', () => {
    console.log(`[any site, NRHO] ${lines.length} plans\n${lines.join('\n')}`)
    expect(lines.length).toBe(cases.length)
  })
})
