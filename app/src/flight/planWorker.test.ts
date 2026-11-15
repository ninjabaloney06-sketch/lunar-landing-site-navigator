// The worker's request handler answers every request, also one it cannot plan, with the request's id and a
// readable message (never a thrown exception, never the text "undefined").
import { describe, expect, it } from 'vitest'
import { runPlan } from './planWorker'
import type { PlanRequest } from './planWorker'

describe('runPlan', () => {
  it('a request that cannot be planned comes back as a failed reply with a message', () => {
    const broken = { id: 7, months: [], rendezvous: 'llo', input: { architecture: { id: 'nope', name: 'nope' } } } as unknown as PlanRequest
    const reply = runPlan(broken)
    expect(reply.id).toBe(7)
    expect(reply.ok).toBe(false)
    if (!reply.ok) {
      expect(typeof reply.message).toBe('string')
      expect(reply.message.length).toBeGreaterThan(0)
      expect(reply.message).not.toBe('undefined')
    }
  })
})

// ---- Dispersion analysis in the worker (dispersion.ts; NOT YET VALIDATED BY THE SCIENCE LEAD)
import aug2027 from '../../public/data/ephem/2027-08.json?raw'
import sep2027 from '../../public/data/ephem/2027-09.json?raw'
import type { EphemMonth } from '../data/types'
import { NOT_VALIDATED } from './dispersion'
import { LAUNCH_VEHICLES } from './launchVehicles'
import { LAUNCHPADS } from './pads'
import { runDispersionRequest } from './planWorker'
import type { DispersionProgress, DispersionReply } from './planWorker'
import { ARCHITECTURES, SPACECRAFT } from './spacecraft'

describe('runDispersionRequest', () => {
  const arch = ARCHITECTURES.find((a) => a.id === 'apollo')!
  const planReq: PlanRequest = {
    id: 21,
    months: [aug2027, sep2027].map((m) => JSON.parse(m) as EphemMonth),
    rendezvous: 'llo',
    input: {
      pad: LAUNCHPADS.find((p) => p.id === 'ksc-39b')!,
      target: { id: 'x', name: 'Chosen landing point', latDeg: -89.5, lonDeg: 0 },
      architecture: { id: arch.id, name: arch.name },
      launchVehicle: LAUNCH_VEHICLES.find((v) => v.id === arch.launchVehicleId)!,
      capsule: SPACECRAFT.find((v) => v.id === arch.capsuleId)!,
      lander: SPACECRAFT.find((v) => v.id === arch.landerId)!,
      earliestTouchdownMs: Date.UTC(2027, 7, 16),
      surfaceStayDays: 1,
      returnWindowDays: 0,
      maxTransferDays: null,
    },
  }

  it('disperses the descent of the plan just computed: progress after every run, then one reply with the marker', { timeout: 120_000 }, async () => {
    const plan = runPlan(planReq)
    expect(plan.ok).toBe(true)
    const posted: (DispersionProgress | DispersionReply)[] = []
    const start = performance.now()
    const reply = await runDispersionRequest({ kind: 'dispersion', id: 5, plan: planReq, options: { n: 200 } }, (m) => posted.push(m))
    const ms = performance.now() - start
    expect(reply.ok).toBe(true)
    if (!reply.ok || !plan.ok) return
    const progress = posted.filter((m) => m.kind === 'dispersion-progress')
    expect(progress.length).toBe(200)
    expect(progress[progress.length - 1]).toEqual({ kind: 'dispersion-progress', id: 5, done: 200, total: 200 })
    expect(posted[posted.length - 1]).toBe(reply)
    expect(reply.result.validated).toBe(false)
    expect(reply.result.marker).toBe(NOT_VALIDATED)
    // the analysis flew the plan's own descent: its nominal propellant is the plan's descent propellant
    const pdi = plan.plan.events.find((e) => e.id === 'pdi')!
    const doi = plan.plan.events.find((e) => e.id === 'doi')!
    expect(reply.result.propellant.nominalKg).toBeCloseTo(pdi.propellantKg! + doi.propellantKg!, 6)
    expect(reply.result.tube[reply.result.tube.length - 1].utcMs).toBe(plan.plan.touchdownMs)
    const r = reply.result
    console.log(
      `Worker dispersion, Apollo, -89.5° / 0°, 2027-08 (DE440): N = 200 in ${(ms / 1000).toFixed(2)} s; ${r.flown}/${r.n} flown; ` +
        `1σ ${r.landing.sigmaMajorKm.toFixed(3)} × ${r.landing.sigmaMinorKm.toFixed(3)} km, mean offset ${Math.hypot(r.landing.meanEastKm, r.landing.meanNorthKm).toFixed(2)} km; ` +
        `propellant ${r.propellant.nominalKg.toFixed(0)} nominal, ${r.propellant.meanKg.toFixed(0)} ± ${r.propellant.sigmaKg.toFixed(0)} kg; ` +
        `J2 alone ${r.j2Only ? `${Math.hypot(r.j2Only.eastKm, r.j2Only.northKm).toFixed(2)} km, ${(r.j2Only.usedKg - r.propellant.nominalKg).toFixed(1)} kg` : 'n/a'}; ` +
        `hard ${r.touchdown.hard}, cut short ${r.brakingCutShort}`,
    )
  })

  it('stops when asked between runs and says it was cancelled', { timeout: 120_000 }, async () => {
    let seen = 0
    const reply = await runDispersionRequest(
      { kind: 'dispersion', id: 6, plan: planReq, options: { n: 200 } },
      (m) => {
        if (m.kind === 'dispersion-progress') seen++
      },
      () => seen >= 5,
      () => Promise.resolve(),
    )
    expect(seen).toBe(5)
    expect(reply).toEqual({ kind: 'dispersion', id: 6, ok: false, message: 'the dispersion analysis was cancelled', cancelled: true })
  })

  it('a request without a readable plan comes back as a failed reply with a message', async () => {
    const reply = await runDispersionRequest({ kind: 'dispersion', id: 8 } as never, () => {})
    expect(reply.ok).toBe(false)
    if (!reply.ok) {
      expect(reply.cancelled).toBe(false)
      expect(reply.message.length).toBeGreaterThan(0)
    }
  })
})
