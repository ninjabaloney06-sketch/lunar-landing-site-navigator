// A whole mission on the real DE440 ephemeris: every phase integrated, the phases chained, the paths joined.
import { describe, expect, it } from 'vitest'
import aug2027 from '../../public/data/ephem/2027-08.json?raw'
import sep2027 from '../../public/data/ephem/2027-09.json?raw'
import oct2027 from '../../public/data/ephem/2027-10.json?raw'
import type { EphemMonth } from '../data/types'
import { R_EARTH_EQ, R_MOON } from './astro'
import { craftAt } from './craft'
import { makeFlightEphemeris } from './ephemeris'
import { LAUNCH_VEHICLES } from './launchVehicles'
import { planMission } from './mission'
import { LAUNCHPADS } from './pads'
import { ARCHITECTURES, SPACECRAFT } from './spacecraft'
import type { LandingTarget, MissionPlan } from './types'
import { add, norm, sub } from './vec'

const ephem = makeFlightEphemeris([aug2027, sep2027, oct2027].map((m) => JSON.parse(m) as EphemMonth))
const arch = ARCHITECTURES.find((a) => a.id === 'apollo')!
const hardware = {
  architecture: arch,
  launchVehicle: LAUNCH_VEHICLES.find((v) => v.id === arch.launchVehicleId)!,
  capsule: SPACECRAFT.find((v) => v.id === arch.capsuleId)!,
  lander: SPACECRAFT.find((v) => v.id === arch.landerId)!,
}
const pad = LAUNCHPADS.find((p) => p.id === 'ksc-39b')!
const pole: LandingTarget = { id: 'connecting-ridge', name: 'Connecting Ridge', latDeg: -89.46, lonDeg: -136.68 }
const earliest = Date.UTC(2027, 7, 16)

const summary = (plan: MissionPlan, ms: number) =>
  `[mission] computed in ${ms.toFixed(0)} ms: ${plan.architecture.name}; liftoff ${new Date(plan.launchMs).toISOString()}, ` +
  `touchdown ${new Date(plan.touchdownMs).toISOString()} (miss ${plan.facts.landingMissM?.toFixed(1)} m), ` +
  `docking ${new Date(plan.dockingMs).toISOString()}, EI ${new Date(plan.endMs).toISOString()}; ` +
  `${plan.facts.missionDays.toFixed(1)} d\n` +
  plan.events
    .filter((e) => e.kind === 'burn')
    .map((e) => `  ${e.label}: ${e.dvKms?.toFixed(3)} km/s, ${((e.propellantKg ?? 0) / 1000).toFixed(1)} t, ${e.durationS?.toFixed(0)} s`)
    .join('\n') +
  '\n' +
  plan.propellant.map((u) => `  ${u.element}: needs ${(u.usedKg / 1000).toFixed(1)} t of ${(u.capacityKg / 1000).toFixed(1)} t`).join('\n') +
  (plan.notes.length ? '\n  notes: ' + plan.notes.join(' | ') : '')

describe('whole mission: lunar orbit rendezvous at the south pole, 14 days on the surface', () => {
  const t0 = performance.now()
  const plan = planMission({ ...hardware, pad, target: pole, ephem, earliestTouchdownMs: earliest, surfaceStayDays: 14, returnWindowDays: 0, maxTransferDays: null })
  const ms = performance.now() - t0

  it('the events come in mission order', () => {
    console.log(summary(plan, ms))
    const at = (id: string) => plan.events.find((e) => e.id === id)!.utcMs
    const order = ['ascent', 'tli', 'loi', 'doi', 'pdi', 'touchdown', 'lunar-liftoff', 'docking', 'tei', 'ei']
    for (const id of order) expect(plan.events.some((e) => e.id === id), id).toBe(true)
    for (let i = 1; i < order.length; i++) expect(at(order[i]), order[i]).toBeGreaterThan(at(order[i - 1]))
    for (let i = 1; i < plan.events.length; i++) expect(plan.events[i].utcMs).toBeGreaterThanOrEqual(plan.events[i - 1].utcMs)
  })

  it('lands on the asked point, soon after arriving, not before the earliest touchdown', () => {
    expect(plan.facts.landingMissM).toBeLessThan(10)
    expect(plan.touchdownMs).toBeGreaterThanOrEqual(earliest)
    expect(plan.touchdownMs).toBeLessThan(earliest + 26 * 3600_000)
    expect(plan.facts.orbitBeforeLandingH).toBeLessThan(8) // a few revolutions, not a day and a half
    const lander = craftAt(plan, 'lander', plan.touchdownMs)!
    expect(lander.frame).toBe('moon')
    expect(Math.abs(norm(lander.pos) - R_MOON)).toBeLessThan(0.05)
  })

  it('every burn takes time and the burns are the expected size', () => {
    const dv = (id: string) => plan.events.find((e) => e.id === id)!
    expect(dv('tli').dvKms).toBeGreaterThan(3.1)
    expect(dv('tli').dvKms).toBeLessThan(3.25)
    expect(dv('loi').dvKms).toBeGreaterThan(0.75)
    expect(dv('loi').dvKms).toBeLessThan(0.95)
    expect(dv('tei').dvKms).toBeGreaterThan(0.7)
    // the shortest is the last rendezvous burn of a light ascent stage with a fixed-thrust engine: under a second
    for (const e of plan.events.filter((x) => x.kind === 'burn')) expect(e.durationS, e.id).toBeGreaterThan(0.3)
  })

  it('the capsule path is continuous from liftoff to Entry Interface', () => {
    const legs = plan.legs.filter((l) => l.craft === 'capsule')
    expect(legs[0].track.t[0]).toBe(plan.launchMs)
    const last = legs[legs.length - 1]
    expect(last.track.t[last.track.t.length - 1]).toBe(plan.endMs)
    expect(Math.abs(norm(last.track.p[last.track.p.length - 1]) - (R_EARTH_EQ + 121.92))).toBeLessThan(0.05)
    for (let i = 1; i < legs.length; i++) {
      const a = legs[i - 1]
      const b = legs[i]
      const tJoin = b.track.t[0]
      expect(Math.abs(tJoin - a.track.t[a.track.t.length - 1])).toBeLessThanOrEqual(1) // ms
      // same place where two legs meet, also across a change of frame (the Moon's position bridges it)
      const world = (leg: typeof a, p: [number, number, number]) => (leg.frame === 'moon' ? add(p, ephem.moonPos(tJoin)) : p)
      const gap = norm(sub(world(a, a.track.p[a.track.p.length - 1]), world(b, b.track.p[0])))
      expect(gap, `${a.id} → ${b.id}`).toBeLessThan(2)
    }
    for (const leg of plan.legs) for (let i = 1; i < leg.track.t.length; i++) expect(leg.track.t[i]).toBeGreaterThan(leg.track.t[i - 1])
  })

  it('the lander leaves the capsule, stays on the surface and comes back to it', () => {
    expect(craftAt(plan, 'lander', plan.launchMs + 3600_000)!.docked).toBe(true)
    const mid = (plan.touchdownMs + plan.lunarLiftoffMs) / 2
    const onSurface = craftAt(plan, 'lander', mid)!
    expect(onSurface.docked).toBe(false)
    expect(Math.abs(norm(onSurface.pos) - R_MOON)).toBeLessThan(0.05)
    const capsule = craftAt(plan, 'capsule', plan.dockingMs)!
    const lander = craftAt(plan, 'lander', plan.dockingMs)!
    expect(norm(sub(capsule.pos, lander.pos))).toBeLessThan(0.5) // km, at the stored sample spacing
    expect(craftAt(plan, 'lander', plan.dockingMs + 3600_000)!.docked).toBe(true)
    expect(plan.facts.surfaceStayDays).toBeGreaterThan(13.9)
  })

  it('comes home: Entry Interface at the asked angle', () => {
    expect(plan.facts.entry.fpaDeg).toBeCloseTo(-6.5, 1)
    expect(plan.facts.entry.speedKms).toBeGreaterThan(10.8)
    expect(plan.facts.returnDays).toBeLessThan(6.5)
  })
})

describe('whole mission: other choices', () => {
  it('a near-side equatorial point, three days on the surface, from another launchpad', () => {
    const t0 = performance.now()
    const plan = planMission({
      ...hardware, pad: LAUNCHPADS.find((p) => p.id === 'kourou-ela4')!, target: { id: 'x', name: 'Chosen landing point', latDeg: 0.67, lonDeg: 23.47 }, ephem,
      earliestTouchdownMs: Date.UTC(2027, 7, 25), surfaceStayDays: 3, returnWindowDays: 0, maxTransferDays: null,
    })
    console.log(summary(plan, performance.now() - t0))
    expect(plan.facts.landingMissM).toBeLessThan(10)
    expect(plan.facts.entry.fpaDeg).toBeCloseTo(-6.5, 1)
  }, 60_000) // about 1.3 s alone; past the 5 s default when the whole suite runs in parallel (timed out three times on 15 Nov)
})
