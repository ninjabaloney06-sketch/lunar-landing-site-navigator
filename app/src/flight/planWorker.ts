// Web Worker: computes a mission off the main thread. A plan takes one to two seconds for a lunar-orbit
// rendezvous and about ten for a halo-orbit mission (every phase is integrated and aimed by iteration), far too
// long to block the page. The ephemeris is rebuilt here from the month files; the plan goes back without it
// (functions cannot cross the thread boundary) and the page attaches its own.
//
// Second job: the dispersion analysis of the descent (dispersion.ts, NOT YET VALIDATED BY THE SCIENCE LEAD).
// The worker keeps the descent of the last plan it computed; a DispersionRequest names that plan (and carries
// it, so the worker can plan it again when it holds another one), runs N flights in steps, posts progress after
// each, and can be cancelled. Messages: PlanRequest -> PlanReply (unchanged, no `kind` field);
// DispersionRequest -> DispersionProgress ... then one DispersionReply; DispersionCancel stops a running analysis
// (its reply comes back with cancelled: true). A new PlanRequest or DispersionRequest cancels a running analysis
// too: its inputs are no longer the page's.
import type { EphemMonth } from '../data/types'
import { AscentError } from './ascent'
import { dispersionSteps } from './dispersion'
import type { DispersionInput, DispersionOptions, DispersionResult } from './dispersion'
import { makeFlightEphemeris } from './ephemeris'
import { LunarOpsError, recordDescents } from './lunar'
import type { DescentInput, DescentResult } from './lunar'
import { planMission } from './mission'
import type { MissionInput } from './mission'
import { planMissionNrho } from './missionNrho'
import { ascentSensitivity, maxPayload } from './payload'
import type { PayloadResult } from './payload'
import { NrhoError } from './nrho'
import { ARCHITECTURES } from './spacecraft'
import { FlightPlanError } from './types'
import type { MissionPlan } from './types'

export interface PlanRequest {
  id: number
  months: EphemMonth[]
  rendezvous: 'llo' | 'nrho'
  input: Omit<MissionInput, 'ephem'>
  /** Also work out the maximum payload (payload.ts, NOT YET VALIDATED BY THE SCIENCE LEAD) and post it as a
   *  PayloadReply right after the PlanReply. Off for the plans of the cheapest-route search. */
  withPayload?: boolean
}

export type PlanReply =
  | { id: number; ok: true; plan: Omit<MissionPlan, 'ephem'> }
  | { id: number; ok: false; message: string; expected: boolean } // expected: an error written for the reader

export interface DispersionRequest {
  kind: 'dispersion'
  id: number
  /** The plan whose descent is dispersed: the same request the page sent for it (same id). */
  plan: PlanRequest
  /** n (default 200), seed (default 1), sigmas (default dispersion.ts DEFAULT_SIGMAS), j2 (default true). */
  options?: DispersionOptions
}

export interface DispersionCancel {
  kind: 'cancel'
  id: number // the DispersionRequest's id
}

export type WorkerRequest = PlanRequest | DispersionRequest | DispersionCancel

export interface DispersionProgress {
  kind: 'dispersion-progress'
  id: number
  done: number // runs flown so far
  total: number
}

export type DispersionReply =
  | { kind: 'dispersion'; id: number; ok: true; result: DispersionResult }
  | { kind: 'dispersion'; id: number; ok: false; message: string; cancelled: boolean }

/** The maximum payload of a plan, sent after its PlanReply (same id). payload null: it could not be worked out
 *  (message says why). It comes separately because the first ascent sensitivity of a vehicle and pad takes
 *  1.4 to 3.1 s, and the plan should not wait for it. */
export interface PayloadReply {
  kind: 'payload'
  id: number
  payload: PayloadResult | null
  message?: string
}

export type WorkerReply = PlanReply | PayloadReply | DispersionProgress | DispersionReply

/** The descent of the last plan this thread computed, kept for the dispersion analysis. */
let lastDescent: { planId: number; key: string; inp: DispersionInput } | null = null
const keyOf = (req: PlanRequest) => JSON.stringify({ r: req.rendezvous, i: req.input, n: req.months.length })

/** Runs one request. Also used directly by the page when a worker cannot be started. */
export function runPlan(req: PlanRequest): PlanReply {
  const seen: { input: DescentInput; result: DescentResult }[] = []
  recordDescents((input, result) => seen.push({ input, result }))
  try {
    // The page sends the architecture by id and name; what its hardware supported on the surface (for the plan's
    // note on a longer stay) is looked up here when the request does not carry it.
    const known = ARCHITECTURES.find((a) => a.id === req.input.architecture.id)
    const architecture = { ...req.input.architecture, surfaceStay: req.input.architecture.surfaceStay ?? known?.surfaceStay }
    const input: MissionInput = { ...req.input, architecture, ephem: makeFlightEphemeris(req.months) }
    const { ephem: _ephem, ...plan } = req.rendezvous === 'nrho' ? planMissionNrho(input) : planMission(input)
    // the descent the plan was built with: the one that touches down when the plan does
    const flown = seen.filter((d) => d.result.touchdownMs === plan.touchdownMs).pop()
    lastDescent = flown ? { planId: req.id, key: keyOf(req), inp: { descentInput: flown.input, descent: flown.result, ephem: input.ephem } } : null
    // Why an upper stage can come out short here when the real rocket flies the mission.
    const stages = req.input.launchVehicle.stages
    const upper = plan.propellant.find((u) => u.element === stages[stages.length - 1].name)
    if (upper && upper.usedKg > upper.capacityKg) {
      plan.notes.push(
        `${upper.element}: every plan here parks in a circular ${req.input.parkingAltKm ?? 185} km orbit and injects from there. ` +
          'A real flight can let the lower stages carry the upper stage to a higher orbit first (Artemis I: about 30 × 1,806 km), which leaves the upper stage less to do. That profile is not searched.',
      )
    }
    return { id: req.id, ok: true, plan }
  } catch (e) {
    // FlightPlanError and the simulators' own error classes carry a message meant for the reader
    const expected = e instanceof FlightPlanError || e instanceof AscentError || e instanceof LunarOpsError || e instanceof NrhoError
    // something thrown that is not an Error (a string, undefined) still gives a message, never "undefined"
    const message = e instanceof Error ? e.message : String(e)
    return { id: req.id, ok: false, message: message || 'the plan could not be computed', expected }
  } finally {
    recordDescents(null)
  }
}

/** The maximum payload for a plan this thread computed (payload.ts). Never throws. */
export function runPayload(req: PlanRequest, plan: Omit<MissionPlan, 'ephem'>): PayloadReply {
  try {
    const hw = { launchVehicle: req.input.launchVehicle, capsule: req.input.capsule, lander: req.input.lander }
    const ascentKgPerKg = ascentSensitivity({ ...hw, pad: req.input.pad, rendezvous: req.rendezvous, parkingAltKm: req.input.parkingAltKm })
    return { kind: 'payload', id: req.id, payload: maxPayload({ plan, rendezvous: req.rendezvous, ...hw, ascentKgPerKg }) }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { kind: 'payload', id: req.id, payload: null, message: message || 'the payload could not be worked out' }
  }
}

/** The descent to disperse for a request: the kept one when it belongs to the same plan, else planned again. */
function descentFor(req: DispersionRequest): DispersionInput | string {
  const plan = req.plan
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.months) || !plan.input) return 'the dispersion request carries no readable plan'
  if (!lastDescent || lastDescent.planId !== plan.id || lastDescent.key !== keyOf(plan)) {
    const reply = runPlan(plan)
    if (!reply.ok) return reply.message
  }
  return lastDescent ? lastDescent.inp : 'the plan has no descent to disperse'
}

/** Runs a dispersion request. post receives the progress messages and the final reply; shouldStop is asked
 *  between runs; pause (when given) is awaited between runs so that the thread can read new messages. */
export async function runDispersionRequest(
  req: DispersionRequest,
  post: (m: DispersionProgress | DispersionReply) => void,
  shouldStop: () => boolean = () => false,
  pause: (() => Promise<void>) | null = null,
): Promise<DispersionReply> {
  const fail = (message: string, cancelled: boolean): DispersionReply => {
    const reply: DispersionReply = { kind: 'dispersion', id: req.id, ok: false, message, cancelled }
    post(reply)
    return reply
  }
  try {
    const inp = descentFor(req)
    if (typeof inp === 'string') return fail(inp, false)
    const steps = dispersionSteps(inp, req.options ?? {})
    for (;;) {
      if (shouldStop()) return fail('the dispersion analysis was cancelled', true)
      const s = steps.next()
      if (s.done) {
        const reply: DispersionReply = { kind: 'dispersion', id: req.id, ok: true, result: s.value }
        post(reply)
        return reply
      }
      post({ kind: 'dispersion-progress', id: req.id, done: s.value.done, total: s.value.total })
      if (pause) await pause()
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return fail(message || 'the dispersion analysis could not be computed', false)
  }
}

const inWorker = typeof window === 'undefined' && typeof self !== 'undefined'
if (inWorker) {
  const ctx = self as unknown as {
    onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null
    onmessageerror: ((e: MessageEvent) => void) | null
    postMessage(m: WorkerReply): void
  }
  // the dispersion analysis that is running, if any; `stop` ends it before its next run
  let running: { id: number; stop: boolean } | null = null
  const yieldToMessages = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
  ctx.onmessage = (e) => {
    const m = e.data as Partial<DispersionRequest | DispersionCancel> | null
    const kind = m && typeof m === 'object' ? m.kind : undefined
    if (kind === 'cancel') {
      if (running && running.id === m!.id) running.stop = true
      return
    }
    if (running) running.stop = true // the page's inputs changed: the running analysis is stale
    if (kind === 'dispersion') {
      const job = { id: (m as DispersionRequest).id, stop: false }
      running = job
      void runDispersionRequest(m as DispersionRequest, (r) => ctx.postMessage(r), () => job.stop, yieldToMessages).finally(() => {
        if (running === job) running = null
      })
      return
    }
    const req = e.data as PlanRequest
    const reply = runPlan(req)
    ctx.postMessage(reply)
    if (reply.ok && req.withPayload) ctx.postMessage(runPayload(req, reply.plan))
  }
  // A request that cannot be read carries no id to answer with. Throwing reaches the page as the worker's
  // `error` event, which settles the waiting request there instead of leaving it pending for ever.
  ctx.onmessageerror = () => {
    throw new Error('the planning worker could not read the request')
  }
}
