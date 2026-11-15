// Web Worker: computes a mission off the main thread. A plan takes one to two seconds for a lunar-orbit
// rendezvous and about ten for a halo-orbit mission (every phase is integrated and aimed by iteration), far too
// long to block the page. The ephemeris is rebuilt here from the month files; the plan goes back without it
// (functions cannot cross the thread boundary) and the page attaches its own.
import type { EphemMonth } from '../data/types'
import { AscentError } from './ascent'
import { makeFlightEphemeris } from './ephemeris'
import { LunarOpsError } from './lunar'
import { planMission } from './mission'
import type { MissionInput } from './mission'
import { planMissionNrho } from './missionNrho'
import { NrhoError } from './nrho'
import { ARCHITECTURES } from './spacecraft'
import { FlightPlanError } from './types'
import type { MissionPlan } from './types'

export interface PlanRequest {
  id: number
  months: EphemMonth[]
  rendezvous: 'llo' | 'nrho'
  input: Omit<MissionInput, 'ephem'>
}

export type PlanReply =
  | { id: number; ok: true; plan: Omit<MissionPlan, 'ephem'> }
  | { id: number; ok: false; message: string; expected: boolean } // expected: an error written for the reader

/** Runs one request. Also used directly by the page when a worker cannot be started. */
export function runPlan(req: PlanRequest): PlanReply {
  try {
    // The page sends the architecture by id and name; what its hardware supported on the surface (for the plan's
    // note on a longer stay) is looked up here when the request does not carry it.
    const known = ARCHITECTURES.find((a) => a.id === req.input.architecture.id)
    const architecture = { ...req.input.architecture, surfaceStay: req.input.architecture.surfaceStay ?? known?.surfaceStay }
    const input: MissionInput = { ...req.input, architecture, ephem: makeFlightEphemeris(req.months) }
    const { ephem: _ephem, ...plan } = req.rendezvous === 'nrho' ? planMissionNrho(input) : planMission(input)
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
  }
}

const inWorker = typeof window === 'undefined' && typeof self !== 'undefined'
if (inWorker) {
  const ctx = self as unknown as {
    onmessage: ((e: MessageEvent<PlanRequest>) => void) | null
    onmessageerror: ((e: MessageEvent) => void) | null
    postMessage(m: PlanReply): void
  }
  ctx.onmessage = (e) => ctx.postMessage(runPlan(e.data))
  // A request that cannot be read carries no id to answer with. Throwing reaches the page as the worker's
  // `error` event, which settles the waiting request there instead of leaving it pending for ever.
  ctx.onmessageerror = () => {
    throw new Error('the planning worker could not read the request')
  }
}
