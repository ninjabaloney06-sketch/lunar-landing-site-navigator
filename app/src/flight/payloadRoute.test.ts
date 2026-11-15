// Minimum-propellant route (payload.ts, P3): the cheapest of the planner's own options and why it wins. Not
// yet validated by the science lead.
import { describe, expect, it } from 'vitest'
import aug2027 from '../../public/data/ephem/2027-08.json?raw'
import sep2027 from '../../public/data/ephem/2027-09.json?raw'
import oct2027 from '../../public/data/ephem/2027-10.json?raw'
import type { EphemMonth } from '../data/types'
import { makeFlightEphemeris } from './ephemeris'
import { LAUNCH_VEHICLES } from './launchVehicles'
import { planMission } from './mission'
import type { MissionInput } from './mission'
import { LAUNCHPADS } from './pads'
import { NOT_VALIDATED, ROUTE_TRANSFER_CHOICES, cheapestRoute, planCheapestRoute, routeOptions } from './payload'
import type { RouteCandidate } from './payload'
import { ARCHITECTURES, SPACECRAFT } from './spacecraft'
import type { MissionEvent, MissionPlan } from './types'

describe('route options', () => {
  it('every day of the window × every transfer, with stable keys and readable labels', () => {
    const t0 = Date.UTC(2027, 7, 16)
    const opts = routeOptions({ earliestTouchdownMs: t0, architectureId: 'apollo' }, { windowDays: 2, transfers: [null, 3] })
    expect(opts.map((o) => o.key)).toEqual(['apollo|0|min', 'apollo|0|3', 'apollo|1|min', 'apollo|1|3', 'apollo|2|min', 'apollo|2|3'])
    expect(opts[2].earliestTouchdownMs).toBe(t0 + 86_400_000)
    expect(opts[0].label).toBe('touchdown from 16 Aug 2027, minimum-energy transfer')
    expect(opts[1].label).toBe('touchdown from 16 Aug 2027, transfer of at most 3 days')
    // the Flight panel's menu: minimum energy and 4.5 to 2.5 days
    expect(ROUTE_TRANSFER_CHOICES[0]).toBeNull()
  })
})

describe('cheapestRoute on made-up plans', () => {
  const burn = (id: string, craft: 'capsule' | 'lander', utcMs: number, dvKms: number, propellantKg: number): MissionEvent => ({
    id, short: id.toUpperCase(), label: id, utcMs, craft, kind: 'burn', by: null, dvKms, propellantKg, durationS: 1, massAfterKg: 1,
  })
  const fake = (tliKg: number, loiKg: number, loiDv: number, short = 0): Omit<MissionPlan, 'ephem'> =>
    ({
      launchMs: 0, touchdownMs: 100,
      events: [burn('ascent', 'capsule', 0, 9, 1000), burn('tli', 'capsule', 10, 3.1, tliKg), burn('loi', 'capsule', 50, loiDv, loiKg), burn('pdi', 'lander', 90, 1.8, 500)],
      propellant: [{ element: 'x', usedKg: 100 + short, capacityKg: 100 }],
    }) as unknown as Omit<MissionPlan, 'ephem'>
  const opts = routeOptions({ earliestTouchdownMs: 0, architectureId: 'apollo' }, { windowDays: 2 })
  const cands: RouteCandidate[] = [
    { option: opts[0], plan: fake(700, 300, 0.85) }, // 2500
    { option: opts[1], plan: fake(690, 250, 0.8) }, // 2440: the winner, by its LOI
    { option: opts[2], plan: fake(100, 100, 0.1, 5) }, // cheapest but short of propellant: ranked last
  ]
  const c = cheapestRoute([...cands, { option: { ...opts[0], key: 'bad' }, plan: null, error: 'The ephemeris does not cover the stay at the Moon.' }])

  it('ranks plans without a shortfall first, cheapest first, and names winner and runner-up', () => {
    expect(c.validation).toEqual(NOT_VALIDATED)
    expect(c.ranked.map((r) => r.option.key)).toEqual([opts[1].key, opts[0].key, opts[2].key])
    expect(c.winner!.totalPropellantKg).toBe(2440)
    expect(c.runnerUp!.totalPropellantKg).toBe(2500)
    expect(c.failed).toHaveLength(1)
  })

  it('explains the win per phase: the differences add up to the total', () => {
    expect(c.why[0].phase).toBe('arrival')
    expect(c.why[0].propellantDeltaKg).toBe(-50)
    expect(c.why[0].dvDeltaKms).toBeCloseTo(-0.05, 12)
    expect(c.why.reduce((s, w) => s + w.propellantDeltaKg, 0)).toBe(-60)
    expect(c.tie).toBe(false)
    expect(c.sentence).toContain('60 kg less than the next best')
    expect(c.sentence).toContain('Arrival in lunar orbit')
    expect(c.sentence).toContain('50 m/s less delta-v')
  })

  it('calls a difference below half a percent of the propellant in space a tie and names the first clear one', () => {
    const t = cheapestRoute([
      { option: opts[0], plan: fake(700, 300, 0.85) }, // 2500, in space 1500
      { option: opts[1], plan: fake(700, 305, 0.851) }, // 2505: within 0.5 % of 1500 kg (7.5 kg)
      { option: opts[2], plan: fake(800, 300, 0.85) }, // 2600
    ])
    expect(t.tie).toBe(true)
    expect(t.tieKg).toBeCloseTo(7.5, 9)
    expect(t.clearlyWorse!.option.key).toBe(opts[2].key)
    expect(t.whyVsClearlyWorse[0].phase).toBe('tli')
    expect(t.sentence).toContain('practically a tie')
    expect(t.sentence).toContain('100 kg more')
  })
})

describe('cheapest route for Apollo to the south pole over three days and two transfers (real plans)', () => {
  const ephem = makeFlightEphemeris([aug2027, sep2027, oct2027].map((m) => JSON.parse(m) as EphemMonth))
  const arch = ARCHITECTURES.find((a) => a.id === 'apollo')!
  const base: MissionInput = {
    architecture: arch,
    launchVehicle: LAUNCH_VEHICLES.find((v) => v.id === arch.launchVehicleId)!,
    capsule: SPACECRAFT.find((v) => v.id === arch.capsuleId)!,
    lander: SPACECRAFT.find((v) => v.id === arch.landerId)!,
    pad: LAUNCHPADS.find((p) => p.id === 'ksc-39b')!,
    target: { id: 'connecting-ridge', name: 'Connecting Ridge', latDeg: -89.46, lonDeg: -136.68 },
    ephem, earliestTouchdownMs: Date.UTC(2027, 7, 16), surfaceStayDays: 3, returnWindowDays: 0, maxTransferDays: null,
  }
  it('picks the plan with the least propellant and says why', () => {
    const t0 = performance.now()
    let calls = 0
    const c = planCheapestRoute(base, { windowDays: 2, transfers: [null, 3] }, (input) => {
      calls++
      return planMission(input)
    })
    const ms = performance.now() - t0
    console.log(`[route] ${calls} plans in ${ms.toFixed(0)} ms (${(ms / calls).toFixed(0)} ms each): ${c.sentence}`)
    for (const r of c.ranked) console.log(`  ${r.option.label}: ${(r.totalPropellantKg / 1000).toFixed(2)} t, ${r.dvInSpaceKms.toFixed(3)} km/s in space${r.short ? ' (short)' : ''}`)
    console.log(`  tie ${c.tie} (${c.tieKg.toFixed(0)} kg); first clearly costlier: ${c.clearlyWorse?.option.label}`)
    for (const w of c.whyVsClearlyWorse) console.log(`  vs clearly costlier, ${w.label}: ${(w.dvDeltaKms * 1000).toFixed(1)} m/s, ${w.propellantDeltaKg.toFixed(0)} kg`)
    if (c.tie) expect(c.clearlyWorse === null || c.clearlyWorse.totalPropellantKg - c.winner!.totalPropellantKg >= c.tieKg).toBe(true)
    for (const w of c.why) console.log(`  ${w.label}: ${(w.dvDeltaKms * 1000).toFixed(1)} m/s, ${w.propellantDeltaKg.toFixed(0)} kg`)
    expect(calls).toBe(6)
    expect(c.ranked.length + c.failed.length).toBe(6)
    expect(c.winner).not.toBeNull()
    expect(c.runnerUp).not.toBeNull()
    const ok = c.ranked.filter((r) => !r.short)
    if (ok.length) expect(c.winner!.totalPropellantKg).toBe(Math.min(...ok.map((r) => r.totalPropellantKg)))
    expect(c.winner!.totalPropellantKg).toBeLessThanOrEqual(c.runnerUp!.totalPropellantKg)
    // the per-phase differences add up to the difference in total
    const sum = c.why.reduce((s, w) => s + w.propellantDeltaKg, 0)
    expect(sum).toBeCloseTo(c.winner!.totalPropellantKg - c.runnerUp!.totalPropellantKg, 3)
    // both carry delta-v per phase for the explanation
    for (const r of [c.winner!, c.runnerUp!]) for (const ph of ['tli', 'arrival', 'descent']) expect(r.phases.some((p) => p.phase === ph), ph).toBe(true)
    expect(c.validation.text).toBe('not yet validated by the science lead')
  }, 180_000)
})
