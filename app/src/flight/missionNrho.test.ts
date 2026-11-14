// A whole Artemis-style mission (rendezvous on the NRHO) on the real DE440 ephemeris: every phase integrated,
// the phases chained, the paths joined. The checks are those of mission.test.ts, plus the delta-v of every
// transfer against NASA's published mission-design numbers.
//
// Published values and where they come from:
//   [WHITLEY] Whitley, Martinez, "Options for Staging Orbits in Cislunar Space" (NASA, 2016),
//             https://ntrs.nasa.gov/citations/20160003079 , slide "Orion Transfers from Earth to NRO", 21-day
//             mission: outbound flyby 178 m/s and insertion 250.5 m/s (428.5 m/s), 5.1 days from the trans-lunar
//             injection to the orbit; departure 221.5 m/s and return flyby 190 m/s (411.5 m/s), 5.0 days from
//             the orbit to entry interface; 840 m/s for Orion in all. Lander, near-rectilinear orbit to a polar
//             low lunar orbit: 730 m/s in 0.5 day each way.
//   [HLS]     Mahajan, Condon, "HLS NRHO to Lunar Surface and Back Mission Design" (NASA JSC, 2022),
//             https://ntrs.nasa.gov/citations/20230002566 : NRHO departure plus insertion into a 100 km circular
//             low lunar orbit over Connecting Ridge, nominal 704.5 and 704.9 m/s.
//   [REA]     Rea, McNamara, Kane, "Orion Artemis I Entry Performance" (NASA JSC),
//             https://ntrs.nasa.gov/citations/20240000024 : the source named for Artemis I's flight-path angle at
//             entry interface, −5.66° (the value was handed to this planner with that reference).
// The published numbers are for other dates and (WHITLEY) for an earlier candidate orbit: the tolerances are the
// ones nrho.test.ts uses for the same comparisons, 10 % on Orion's totals and 5 % on the lander's transfers.
import { describe, expect, it } from 'vitest'
import aug2027 from '../../public/data/ephem/2027-08.json?raw'
import sep2027 from '../../public/data/ephem/2027-09.json?raw'
import oct2027 from '../../public/data/ephem/2027-10.json?raw'
import nov2027 from '../../public/data/ephem/2027-11.json?raw'
import type { EphemMonth } from '../data/types'
import { MU_EARTH, R_EARTH_EQ, R_MOON } from './astro'
import { craftAt } from './craft'
import { makeFlightEphemeris } from './ephemeris'
import { LAUNCH_VEHICLES } from './launchVehicles'
import { planMissionNrho } from './missionNrho'
import { NRHO_PERIOD_S } from './nrho'
import { LAUNCHPADS } from './pads'
import { ARCHITECTURES, SPACECRAFT } from './spacecraft'
import type { LandingTarget, MissionLeg, MissionPlan, Vec3 } from './types'
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
const pole: LandingTarget = { id: 'connecting-ridge', name: 'Connecting Ridge', latDeg: -89.46, lonDeg: -136.68 }
const HOUR_MS = 3600_000
const DAY_MS = 86400_000
const ENTRY_KM = 121.92

const dv = (plan: MissionPlan, id: string) => (plan.events.find((e) => e.id === id)?.dvKms ?? 0) * 1000
/** The delta-v sums that have published counterparts, m/s. */
const sums = (plan: MissionPlan) => {
  const arrival = dv(plan, 'otc') + dv(plan, 'opf') + dv(plan, 'loi')
  const home = dv(plan, 'tei') + dv(plan, 'rpf')
  return { arrival, home, orion: arrival + home, landerDown: dv(plan, 'lander-nrd') + dv(plan, 'lander-loi'), landerUp: dv(plan, 'llo-departure') + dv(plan, 'lander-nri') }
}
const pct = (x: number, ref: number) => `${(((x - ref) / ref) * 100).toFixed(1)} %`

const summary = (plan: MissionPlan, ms: number) => {
  const s = sums(plan)
  return (
    `[mission NRHO] computed in ${ms.toFixed(0)} ms: ${plan.architecture.name}; liftoff ${new Date(plan.launchMs).toISOString()}, ` +
    `touchdown ${new Date(plan.touchdownMs).toISOString()} (miss ${plan.facts.landingMissM?.toFixed(1)} m), ` +
    `${plan.facts.surfaceStayDays.toFixed(2)} d on the surface, docking ${new Date(plan.dockingMs).toISOString()}, EI ${new Date(plan.endMs).toISOString()} ` +
    `(${plan.facts.entry.fpaDeg.toFixed(3)}°, ${plan.facts.entry.speedKms.toFixed(3)} km/s); ${plan.facts.missionDays.toFixed(1)} d\n` +
    plan.events
      .filter((e) => e.kind === 'burn')
      .map((e) => `  ${e.craft} ${e.label}: ${e.dvKms?.toFixed(4)} km/s, ${((e.propellantKg ?? 0) / 1000).toFixed(2)} t, ${e.durationS?.toFixed(1)} s`)
      .join('\n') +
    '\n' +
    `  against published: Orion arrival (OTC + OPF + NRI) ${s.arrival.toFixed(1)} m/s vs 428.5 [WHITLEY] (${pct(s.arrival, 428.5)}); ` +
    `return (NRD + RPF) ${s.home.toFixed(1)} vs 411.5 [WHITLEY] (${pct(s.home, 411.5)}); Orion in all ${s.orion.toFixed(1)} vs 840 [WHITLEY] (${pct(s.orion, 840)}); ` +
    `lander NRHO → low orbit ${s.landerDown.toFixed(1)} vs 704.7 [HLS] (${pct(s.landerDown, 704.7)}) and 730 [WHITLEY] (${pct(s.landerDown, 730)}); ` +
    `low orbit → NRHO ${s.landerUp.toFixed(1)} vs 730 [WHITLEY] (${pct(s.landerUp, 730)}); ` +
    `injection to NRHO ${plan.facts.transferDays.toFixed(2)} d vs 5.1 [WHITLEY]; departure to entry ${plan.facts.returnDays.toFixed(2)} d vs 5.0 [WHITLEY]\n` +
    plan.propellant.map((u) => `  ${u.element}: needs ${(u.usedKg / 1000).toFixed(1)} t of ${(u.capacityKg / 1000).toFixed(1)} t`).join('\n') +
    '\n  notes: ' +
    plan.notes.join(' | ')
  )
}

/** Where two consecutive legs of one craft meet: the gap in time (ms) and in place (km), also across a change
 *  of frame (the Moon's position bridges it). */
function joins(legs: MissionLeg[]): { at: string; gapMs: number; gapKm: number }[] {
  const out: { at: string; gapMs: number; gapKm: number }[] = []
  for (let i = 1; i < legs.length; i++) {
    const a = legs[i - 1]
    const b = legs[i]
    const tJoin = b.track.t[0]
    const world = (leg: MissionLeg, p: Vec3) => (leg.frame === 'moon' ? add(p, ephem.moonPos(tJoin)) : p)
    out.push({
      at: `${a.id} → ${b.id}`,
      gapMs: Math.abs(tJoin - a.track.t[a.track.t.length - 1]),
      gapKm: norm(sub(world(a, a.track.p[a.track.p.length - 1]), world(b, b.track.p[0]))),
    })
  }
  return out
}

/** The checks every plan must pass, whatever the hardware and the site. */
function checkPlan(plan: MissionPlan, earliest: number, entryFpaDeg: number) {
  const at = (id: string) => plan.events.find((e) => e.id === id)!.utcMs

  // the events come in mission order, with the official names
  const order = ['ascent', 'tli', 'opf', 'loi', 'nrho-docking', 'undocking', 'lander-nrd', 'lander-loi', 'doi', 'pdi', 'touchdown', 'lunar-liftoff', 'llo-departure', 'lander-nri', 'docking', 'tei', 'rpf', 'ei']
  for (const id of order) expect(plan.events.some((e) => e.id === id), id).toBe(true)
  for (let i = 1; i < order.length; i++) expect(at(order[i]), order[i]).toBeGreaterThanOrEqual(at(order[i - 1]))
  for (let i = 1; i < plan.events.length; i++) expect(plan.events[i].utcMs).toBeGreaterThanOrEqual(plan.events[i - 1].utcMs)
  const label = (id: string) => plan.events.find((e) => e.id === id)!.label
  expect(label('tli')).toBe('Trans-Lunar Injection (TLI)')
  expect(label('opf')).toBe('Outbound Powered Flyby (OPF)')
  expect(label('loi')).toBe('NRHO Insertion (NRI)')
  expect(label('tei')).toBe('NRHO Departure (NRD)')
  expect(label('rpf')).toBe('Return Powered Flyby (RPF)')
  expect(label('ei')).toBe('Entry Interface (EI)')
  expect(at('docking')).toBe(plan.dockingMs)
  expect(at('touchdown')).toBe(Math.round(plan.touchdownMs))
  expect(at('ei')).toBe(plan.endMs)

  // lands on the asked point, not before the earliest touchdown and within a day of launch opportunities after it
  expect(plan.facts.landingMissM).toBeLessThan(10)
  expect(plan.touchdownMs).toBeGreaterThanOrEqual(earliest)
  expect(plan.touchdownMs).toBeLessThan(earliest + 26 * HOUR_MS)
  const landed = craftAt(plan, 'lander', plan.touchdownMs)!
  expect(landed.frame).toBe('moon')
  expect(Math.abs(norm(landed.pos) - R_MOON)).toBeLessThan(0.05)

  // every burn is a burn: it takes time, uses propellant and delivers what the rocket equation says. (No lower
  // limit on the time as in mission.test.ts: the three Raptor engines of the Starship lander, throttled down
  // as far as they go, give a 5 m/s rendezvous burn in a tenth of a second.)
  for (const e of plan.events.filter((x) => x.kind === 'burn')) {
    expect(e.durationS, e.id).toBeGreaterThan(0)
    expect(e.propellantKg, e.id).toBeGreaterThan(0)
    expect(e.dvKms, e.id).toBeGreaterThan(0)
  }

  // the capsule path is continuous from liftoff to Entry Interface
  const capsule = plan.legs.filter((l) => l.craft === 'capsule')
  expect(capsule[0].track.t[0]).toBe(plan.launchMs)
  const last = capsule[capsule.length - 1]
  expect(last.track.t[last.track.t.length - 1]).toBe(plan.endMs)
  expect(Math.abs(norm(last.track.p[last.track.p.length - 1]) - (R_EARTH_EQ + ENTRY_KM))).toBeLessThan(0.05)
  for (const j of joins(capsule)) {
    expect(j.gapMs, j.at).toBeLessThanOrEqual(1)
    expect(j.gapKm, j.at).toBeLessThan(2)
  }
  // and so is the lander's, from undocking to docking
  const lander = plan.legs.filter((l) => l.craft === 'lander')
  expect(lander[0].track.t[0]).toBe(at('undocking'))
  const back = lander[lander.length - 1]
  expect(back.track.t[back.track.t.length - 1]).toBe(plan.dockingMs)
  for (const j of joins(lander)) {
    expect(j.gapMs, j.at).toBeLessThanOrEqual(1)
    expect(j.gapKm, j.at).toBeLessThan(2)
  }
  for (const leg of plan.legs) for (let i = 1; i < leg.track.t.length; i++) expect(leg.track.t[i]).toBeGreaterThan(leg.track.t[i - 1])
  // the legs the views look for, in the frame they expect, and burns flagged as burns
  expect(plan.legs.find((l) => l.id === 'translunar')!.frame).toBe('earth')
  expect(plan.legs.find((l) => l.id === 'transearth')!.frame).toBe('earth')
  for (const id of ['tli', 'opf', 'loi', 'tei', 'rpf']) expect(plan.legs.filter((l) => l.id === id).every((l) => l.powered), id).toBe(true)

  // the lander leaves the capsule, stays on the surface and comes back to it
  expect(craftAt(plan, 'lander', plan.launchMs + HOUR_MS)!.docked).toBe(true)
  expect(craftAt(plan, 'lander', at('undocking') - HOUR_MS)!.docked).toBe(true)
  const onSurface = craftAt(plan, 'lander', (plan.touchdownMs + plan.lunarLiftoffMs) / 2)!
  expect(onSurface.docked).toBe(false)
  expect(Math.abs(norm(onSurface.pos) - R_MOON)).toBeLessThan(0.05)
  for (const t of [at('undocking'), plan.dockingMs]) {
    const c = craftAt(plan, 'capsule', t)!
    const l = craftAt(plan, 'lander', t)!
    expect(l.docked).toBe(false)
    expect(norm(sub(c.pos, l.pos))).toBeLessThan(0.5) // km
  }
  expect(craftAt(plan, 'lander', plan.dockingMs + HOUR_MS)!.docked).toBe(true)
  // while the lander is away the capsule is on the NRHO, tens of thousands of kilometres from the Moon
  const waiting = craftAt(plan, 'capsule', (plan.touchdownMs + plan.lunarLiftoffMs) / 2)!
  expect(waiting.legId).toBe('nrho')
  expect(norm(waiting.pos)).toBeGreaterThan(30000)

  // comes home: Entry Interface at the asked angle, at a lunar-return speed (just under the escape speed there)
  expect(Math.abs(plan.facts.entry.fpaDeg - entryFpaDeg)).toBeLessThan(0.01)
  const escape = Math.sqrt((2 * MU_EARTH) / (R_EARTH_EQ + ENTRY_KM))
  expect(plan.facts.entry.speedKms).toBeGreaterThan(0.99 * escape)
  expect(plan.facts.entry.speedKms).toBeLessThan(escape)
  expect(plan.facts.returnDays).toBeLessThan(6.5)

  // every fact is a number, and the NRHO figures are the NRHO's (published ranges: nrho.test.ts, [DAVIS])
  const flat = (o: object): number[] => Object.values(o).flatMap((v) => (v !== null && typeof v === 'object' ? flat(v) : [v as number]))
  for (const x of flat(plan.facts)) expect(Number.isFinite(x)).toBe(true)
  expect(plan.facts.lunarPeriluneKm + R_MOON).toBeGreaterThan(3195)
  expect(plan.facts.lunarPeriluneKm + R_MOON).toBeLessThan(3557)
  expect(plan.facts.lunarApoluneKm + R_MOON).toBeGreaterThan(70005)
  expect(plan.facts.lunarApoluneKm + R_MOON).toBeLessThan(71849)
  expect(plan.facts.missionDays).toBeCloseTo((plan.endMs - plan.launchMs) / DAY_MS, 9)
  // every shortfall of propellant is in the notes, and nothing else is called one
  const short = plan.propellant.filter((u) => u.usedKg > u.capacityKg)
  expect(plan.notes.filter((n) => n.includes('more propellant than it carries')).length).toBe(short.length)
  for (const u of short) expect(plan.notes.some((n) => n.startsWith(`${u.element}:`))).toBe(true)
  expect(plan.notes.some((n) => n.includes('is not on this launch'))).toBe(true)
}

/** Delta-v against the published mission-design numbers (polar site, cheapest phase). */
function checkPublished(plan: MissionPlan) {
  const s = sums(plan)
  expect(Math.abs(s.arrival - 428.5) / 428.5).toBeLessThan(0.1)
  expect(Math.abs(s.home - 411.5) / 411.5).toBeLessThan(0.1)
  expect(Math.abs(s.orion - 840) / 840).toBeLessThan(0.1)
  expect(Math.abs(s.landerDown - 704.7) / 704.7).toBeLessThan(0.05)
  expect(Math.abs(s.landerDown - 730) / 730).toBeLessThan(0.05)
  expect(Math.abs(s.landerUp - 730) / 730).toBeLessThan(0.05)
  expect(dv(plan, 'otc')).toBeLessThan(5) // the injection is aimed at the flyby; the correction is small
  // Trans-lunar injection from a 185 km circular orbit to the Moon's distance: 3.13 km/s as one instantaneous
  // push (vis-viva, below); a burn of many minutes costs up to 0.2 km/s more. Not a published Artemis number:
  // Artemis injects from an eccentric orbit, which this planner does not fly.
  const rPark = R_EARTH_EQ + 185
  const impulsive = Math.sqrt(MU_EARTH * (2 / rPark - 2 / (rPark + plan.facts.moonDistKm))) - Math.sqrt(MU_EARTH / rPark)
  expect(dv(plan, 'tli') / 1000).toBeGreaterThan(impulsive)
  expect(dv(plan, 'tli') / 1000).toBeLessThan(impulsive + 0.2)
}

describe.each(['artemis-starship', 'artemis-blue-moon'])('whole mission by NRHO rendezvous at the south pole, 6.5 days asked on the surface: %s', (archId) => {
  const earliest = Date.UTC(2027, 8, 12)
  const t0 = performance.now()
  const plan = planMissionNrho({ ...hardwareOf(archId), pad, target: pole, ephem, earliestTouchdownMs: earliest, surfaceStayDays: 6.5, returnWindowDays: 0, maxTransferDays: null })
  const ms = performance.now() - t0

  it('is one chained, continuous mission from liftoff to Entry Interface at −5.66° [REA]', () => {
    console.log(summary(plan, ms))
    checkPlan(plan, earliest, -5.66)
  })

  it('costs what NASA publishes for Orion and for the lander [WHITLEY] [HLS]', () => {
    checkPublished(plan)
  })

  it('stays one revolution of the NRHO less the hours in low lunar orbit, and the capsule leaves within one more', () => {
    // The Artemis III plan: about 6.5 days. The lander can only come and go when the NRHO passes the Moon.
    expect(plan.facts.surfaceStayDays).toBeGreaterThan(6.0)
    expect(plan.facts.surfaceStayDays).toBeLessThan(6.76) // the longest revolution of the reference orbit [DAVIS]
    const nrd = plan.events.find((e) => e.id === 'tei')!.utcMs
    expect(nrd).toBeGreaterThan(plan.dockingMs)
    expect(nrd).toBeLessThan(plan.dockingMs + HOUR_MS + NRHO_PERIOD_S * 1000)
  })

  it('reports what each element needs against what it carries', () => {
    const use = (name: string) => plan.propellant.find((u) => u.element.includes(name))!
    expect(plan.propellant.length).toBe(3)
    // Orion's service module flies both ways on its own propellant
    expect(use('Service Module').usedKg).toBeLessThan(use('Service Module').capacityKg)
    expect(use('Service Module').usedKg).toBeGreaterThan(5000)
    const landerUse = plan.propellant[2]
    if (archId === 'artemis-blue-moon') {
      // 16 t dry with 29 t of propellant at 460 s is 4.7 km/s; the sortie from the NRHO takes 5.2 km/s
      expect(landerUse.usedKg).toBeGreaterThan(landerUse.capacityKg)
    } else {
      expect(landerUse.usedKg).toBeLessThan(landerUse.capacityKg)
    }
  })
})

describe('whole mission by NRHO rendezvous: other choices', () => {
  it('a near-side equatorial point, 3 days asked, a return window of 4 days, entry at −6.5°', () => {
    const earliest = Date.UTC(2027, 8, 20)
    const t0 = performance.now()
    const plan = planMissionNrho({
      ...hardwareOf('artemis-starship'), pad, target: { id: 'x', name: 'Chosen landing point', latDeg: 0.67, lonDeg: 23.47 }, ephem,
      earliestTouchdownMs: earliest, surfaceStayDays: 3, returnWindowDays: 4, maxTransferDays: null, entryFpaDeg: -6.5,
    })
    console.log(summary(plan, performance.now() - t0))
    checkPlan(plan, earliest, -6.5)
    const s = sums(plan)
    // Orion's arrival does not depend on the site
    expect(Math.abs(s.arrival - 428.5) / 428.5).toBeLessThan(0.1)
    // the site is far from the plane of the NRHO: the lander's transfers cost more than to the pole
    expect(s.landerDown).toBeGreaterThan(704.7 + 50)
    // the lander cannot come back after 3 days: it stays one revolution, and the notes say so
    expect(plan.facts.surfaceStayDays).toBeGreaterThan(6.0)
    expect(plan.notes.some((n) => n.includes('Asked for 3 days'))).toBe(true)
    // the capsule leaves inside the window given; the cheap departure (5.3 days after the docking) is outside it
    const nrd = plan.events.find((e) => e.id === 'tei')!.utcMs
    expect(nrd).toBeGreaterThanOrEqual(plan.dockingMs + HOUR_MS)
    expect(nrd).toBeLessThanOrEqual(plan.dockingMs + HOUR_MS + 4 * DAY_MS)
    expect(s.home).toBeGreaterThan(411.5)
  }, 120000)
})
