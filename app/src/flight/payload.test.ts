// Payload maximisation (payload.ts) over finished plans on the real DE440 ephemeris. Not yet validated by the
// science lead: these tests check the method (rocket equation over the plan's burns), not the hardware data.
import { describe, expect, it } from 'vitest'
import aug2027 from '../../public/data/ephem/2027-08.json?raw'
import sep2027 from '../../public/data/ephem/2027-09.json?raw'
import oct2027 from '../../public/data/ephem/2027-10.json?raw'
import type { EphemMonth } from '../data/types'
import { G0 } from './astro'
import { makeFlightEphemeris } from './ephemeris'
import type { SpacecraftSpec } from './hardware'
import { LAUNCH_VEHICLES } from './launchVehicles'
import { planMission } from './mission'
import type { MissionInput } from './mission'
import { planMissionNrho } from './missionNrho'
import { LAUNCHPADS } from './pads'
import { LOSS_MODEL_FRACTION, NOT_VALIDATED, PROPELLANT_RESERVE_FRACTION, ascentSensitivity, maxPayload, predictedExtraUse } from './payload'
import type { PayloadInput, PayloadResult } from './payload'
import { ARCHITECTURES, SPACECRAFT } from './spacecraft'

const ephem = makeFlightEphemeris([aug2027, sep2027, oct2027].map((m) => JSON.parse(m) as EphemMonth))
const pad = LAUNCHPADS.find((p) => p.id === 'ksc-39b')!
const pole = { id: 'connecting-ridge', name: 'Connecting Ridge', latDeg: -89.46, lonDeg: -136.68 }
const hardware = (id: string) => {
  const arch = ARCHITECTURES.find((a) => a.id === id)!
  return {
    architecture: arch,
    rendezvous: arch.rendezvous,
    launchVehicle: LAUNCH_VEHICLES.find((v) => v.id === arch.launchVehicleId)!,
    capsule: SPACECRAFT.find((v) => v.id === arch.capsuleId)!,
    lander: SPACECRAFT.find((v) => v.id === arch.landerId)!,
  }
}
const missionInput = (id: string, lander?: SpacecraftSpec): MissionInput => {
  const h = hardware(id)
  return {
    architecture: h.architecture, launchVehicle: h.launchVehicle, capsule: h.capsule, lander: lander ?? h.lander,
    pad, target: pole, ephem, earliestTouchdownMs: Date.UTC(2027, 7, 16), surfaceStayDays: h.rendezvous === 'nrho' ? 6.5 : 3, returnWindowDays: 0, maxTransferDays: null,
  }
}
const describeResult = (name: string, r: PayloadResult, ms: number) =>
  `[payload] ${name}: ${r.verdict}, max ${r.maxPayloadKg.toFixed(0)} kg ± ${r.epsilonKg.toFixed(0)} kg (raw ${r.rawPayloadKg?.toFixed(0)}), ` +
  `bound ${r.bound}, limited by ${r.limitedBy?.element} (${r.limitedBy?.kind}), dominant ${r.dominantTerm?.label}, ${ms.toFixed(1)} ms\n` +
  r.elements.map((e) => `  ${e.element}: plan used ${e.planUsedKg.toFixed(0)} of load ${e.planLoadKg.toFixed(0)}; at max ${e.usedKg.toFixed(0)} + reserve ${e.reserveKg.toFixed(0)} of ${e.capacityKg.toFixed(0)}`).join('\n') +
  '\n' + r.phases.map((p) => `  ${p.label}: ${p.planPropellantKg.toFixed(0)} → ${p.propellantKg.toFixed(0)} kg`).join('\n') +
  '\n' + r.terms.map((t) => `  ε ${t.label}: ${t.kg.toFixed(0)} kg`).join('\n') +
  (r.caveats.length ? '\n  caveats: ' + r.caveats.join(' | ') : '')

describe('payload: Apollo (lunar orbit rendezvous) at the south pole', () => {
  const inp = missionInput('apollo')
  const plan = planMission(inp)
  const h = hardware('apollo')
  const t0 = performance.now()
  const s = ascentSensitivity({ ...h, pad, rendezvous: 'llo' })
  const sensMs = performance.now() - t0
  const pin: PayloadInput = { plan, ...h, rendezvous: 'llo', ascentKgPerKg: s }
  const t1 = performance.now()
  const r = maxPayload(pin)
  const ms = performance.now() - t1

  it('gives a positive payload with its uncertainty, the dominant term and the not-validated marker', () => {
    console.log(`[payload] ascent sensitivity ${s.toFixed(3)} kg/kg in ${sensMs.toFixed(0)} ms`)
    console.log(describeResult('Apollo', r, ms))
    expect(r.validation).toEqual(NOT_VALIDATED)
    expect(r.validation.text).toBe('not yet validated by the science lead')
    expect(r.verdict).toBe('payload')
    expect(r.maxPayloadKg).toBeGreaterThan(0)
    expect(r.epsilonKg).toBeGreaterThan(0)
    expect(r.epsilonKg).toBeLessThan(r.maxPayloadKg)
    expect(r.dominantTerm).not.toBeNull()
    expect(r.terms[0]).toBe(r.dominantTerm)
    expect(r.bound).toBe('value')
    expect(r.reserveFraction).toBe(PROPELLANT_RESERVE_FRACTION)
    expect(ms).toBeLessThan(50) // main-thread budget
  })

  it('the launch costs the upper stage less than a kilogram per kilogram of payload', () => {
    expect(s).toBeGreaterThan(0.3)
    expect(s).toBeLessThan(1)
  })

  it('at the maximum payload the limiting element holds exactly its reserve and none is over capacity', () => {
    const lim = r.elements.find((e) => e.element === r.limitedBy!.element)!
    expect(lim.loadKg).toBeCloseTo(lim.capacityKg, 3)
    for (const e of r.elements) {
      expect(e.loadKg, e.element).toBeLessThanOrEqual(e.capacityKg + 1e-6)
      expect(e.reserveKg).toBeCloseTo(PROPELLANT_RESERVE_FRACTION * e.usedKg, 6)
    }
  })

  it('every burn follows the rocket equation with its planned delta-v', () => {
    // the extra propellant of the powered descent at the maximum payload: Δm = (e^(Δv/(g0 Isp)) − 1) · extra mass after it
    const pdi = r.burns.find((b) => b.id === 'pdi')!
    const isp = h.lander.modules[1].engine!.ispVacS
    const ratio = Math.exp((pdi.dvKms * 1000) / (G0 * isp))
    const planEvent = plan.events.find((e) => e.id === 'pdi')!
    // as planned, the rocket equation reproduces the plan's own burn (integrated with mass loss) to 0.1 %
    expect(planEvent.propellantKg!).toBeCloseTo((ratio - 1) * planEvent.massAfterKg!, -1)
    expect(pdi.carriesPayload).toBe(true)
    expect(pdi.propellantKg).toBeGreaterThan(pdi.planPropellantKg)
    // burns after touchdown do not carry the cargo and do not change when the ascent stage keeps its load
    expect(r.burns.find((b) => b.id === 'lunar-liftoff')!.carriesPayload).toBe(false)
    expect(r.burns.find((b) => b.id === 'tei')!.carriesPayload).toBe(false)
  })

  it('is no worse with the reserve set to zero, and more cargo needs more propellant everywhere it rides', () => {
    const r0 = maxPayload({ ...pin, reserveFraction: 0 })
    expect(r0.maxPayloadKg).toBeGreaterThan(r.maxPayloadKg)
    const a = predictedExtraUse(pin, 0)
    const b = predictedExtraUse(pin, 1000)
    for (const k of Object.keys(a)) expect(b[k], k).toBeGreaterThanOrEqual(a[k])
  })

  it('re-planned with the cargo: the chain predicts what the planner burns (calibrates the losses term)', () => {
    // Cargo left on the surface = extra dry mass of the Descent Stage (it stays there at liftoff).
    const X = 1000
    const lm = h.lander
    const heavier: SpacecraftSpec = { ...lm, modules: [lm.modules[0], { ...lm.modules[1], dryKg: lm.modules[1].dryKg + X }] }
    const replan = planMission(missionInput('apollo', heavier))
    const predicted = predictedExtraUse(pin, X)
    const lines: string[] = []
    for (const u of replan.propellant) {
      const before = plan.propellant.find((x) => x.element === u.element)!.usedKg
      lines.push(`${u.element}: planner +${(u.usedKg - before).toFixed(1)} kg, chain +${predicted[u.element].toFixed(1)} kg`)
    }
    console.log('[payload] re-planned with 1 t of cargo:\n  ' + lines.join('\n  '))
    const dDescent = replan.propellant.find((x) => x.element === 'Descent Stage')!.usedKg - plan.propellant.find((x) => x.element === 'Descent Stage')!.usedKg
    // the rocket equation chain is exact for the stages that fly the same delta-v (S-IVB to 1 %); the lander's
    // burns grow longer with the cargo, so the planner burns more there (5.4 % here; LOSS_MODEL_FRACTION is 6 %)
    expect(Math.abs(predicted['S-IVB'] - (replan.propellant[0].usedKg - plan.propellant[0].usedKg))).toBeLessThan(0.01 * predicted['S-IVB'])
    expect(predicted['Descent Stage']).toBeLessThan(dDescent)
    expect(dDescent - predicted['Descent Stage']).toBeLessThan(1.5 * LOSS_MODEL_FRACTION * dDescent)
  }, 60_000)

  it('re-planned at the maximum payload with the loads it gives: the limiting element is within ε of full', () => {
    const lm = h.lander
    const load = (name: string) => r.elements.find((e) => e.element === name)!.loadKg
    const lander: SpacecraftSpec = {
      ...lm,
      modules: [
        { ...lm.modules[0], propellantKg: load(lm.modules[0].name) },
        { ...lm.modules[1], dryKg: lm.modules[1].dryKg + r.maxPayloadKg, propellantKg: load(lm.modules[1].name) },
      ],
    }
    const cm = h.capsule
    const capsule: SpacecraftSpec = { ...cm, modules: cm.modules.map((m) => (m.engine ? { ...m, propellantKg: load(m.name) } : m)) }
    const replan = planMission({ ...missionInput('apollo', lander), capsule })
    const lines: string[] = []
    for (const e of r.elements) {
      const u = replan.propellant.find((x) => x.element === e.element)!
      lines.push(`${e.element}: planner ${u.usedKg.toFixed(0)} kg, chain ${e.usedKg.toFixed(0)} kg, capacity ${e.capacityKg.toFixed(0)} kg`)
    }
    console.log(`[payload] re-planned at ${r.maxPayloadKg.toFixed(0)} kg of cargo:\n  ` + lines.join('\n  '))
    // the descent stage's need beyond the chain's, in kilograms of cargo it would cost, is within 2ε
    const d = r.elements.find((e) => e.element === 'Descent Stage')!
    const dUsed = replan.propellant.find((x) => x.element === 'Descent Stage')!.usedKg - d.usedKg
    const perKg = predictedExtraUse(pin, 1000)['Descent Stage'] / 1000
    expect(Math.abs(dUsed / perKg)).toBeLessThan(2 * r.epsilonKg)
    // and the losses term covers the miss: it is the dominant term here
    expect(Math.abs(dUsed / perKg)).toBeLessThan(1.5 * LOSS_MODEL_FRACTION * r.maxPayloadKg)
  }, 60_000)
})

describe('payload: Artemis landers waiting in the halo orbit', () => {
  for (const id of ['artemis-starship', 'artemis-blue-moon']) {
    it(id, () => {
      const h = hardware(id)
      const plan = planMissionNrho(missionInput(id))
      const s = ascentSensitivity({ ...h, pad, rendezvous: 'nrho' })
      const t0 = performance.now()
      const r = maxPayload({ plan, ...h, rendezvous: 'nrho', ascentKgPerKg: s })
      console.log(describeResult(id, r, performance.now() - t0))
      expect(r.validation.validated).toBe(false)
      expect(r.cargoFrom).toBe('nrho')
      // the capsule's burns never carry the cargo in this design
      for (const b of r.burns.filter((x) => x.element !== h.lander.modules[0].name)) expect(b.carriesPayload, b.id).toBe(false)
      if (id === 'artemis-blue-moon') {
        // Blue Moon's tank capacity is a lower limit (spacecraft.ts): the result must say so, not give a confident number
        const lander = r.elements.find((e) => e.element === h.lander.modules[0].name)!
        expect(lander.capacityIsLowerBound).toBe(true)
        expect(r.bound).toBe('lower')
        expect(r.caveats.some((c) => c.includes('lower limit'))).toBe(true)
      } else {
        // the tank of a refilled Starship allows more than a thousand tonnes: far beyond the checked range, and said so
        expect(r.verdict).toBe('extrapolated')
        expect(r.withinCheckedRange).toBe(false)
        expect(r.caveats.some((c) => c.includes('100 tons'))).toBe(true)
        // the capsule's launch is short in this plan (ICPS), which limits the mission and not the lander's cargo
        expect(r.shortfall.every((x) => !x.carriesCargo)).toBe(true)
      }
    }, 120_000)
  }
})
