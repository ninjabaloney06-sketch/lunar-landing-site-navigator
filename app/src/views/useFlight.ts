// The mission plan for the current choices and its playback clock (Flight plan tab).
// The plan is computed from the same DE440 ephemeris files as everything else; nothing here invents a number:
// missing ephemeris months give a plain message. Computing a mission takes seconds (every phase is integrated
// and aimed by iteration), so it runs in a Web Worker. The clock advances on animation frames
// into a plain object the 3D scene reads directly, and into React state only about 15 times a second.
//
// The analyses that come with a plan (maximum payload after every plan; cheapest route and landing dispersion on
// the user's request; all NOT YET VALIDATED BY THE SCIENCE LEAD) go to the store in flightAnalysis.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadMonthsFor } from '../data/load'
import { makeFlightEphemeris } from '../flight/ephemeris'
import type { ArchitectureSpec, LaunchVehicleSpec, SpacecraftSpec } from '../flight/hardware'
import { cheapestRoute, routeOptions } from '../flight/payload'
import { runPlan } from '../flight/planWorker'
import type { DispersionCancel, DispersionReply, DispersionRequest, PayloadReply, PlanReply, PlanRequest, WorkerReply } from '../flight/planWorker'
import type { LandingTarget, Launchpad, MissionPlan } from '../flight/types'
import { DAY_MS } from '../state'
import type { MissionStatus } from './FlightPanel'
import { getFlightAnalysis, patchFlightAnalysis, resetFlightAnalysis, setFlightActions } from './flightAnalysis'
import { DEFAULT_SPEED } from './flightFormat'

// Ephemeris loaded around the mission: it starts about a week before touchdown and ends about a week after
// leaving the Moon.
const LEAD_DAYS = 12
const TAIL_DAYS = 16
const UI_INTERVAL_MS = 66

/** The surface stay a design starts with: its documented one, else three days for a design that meets in low
 *  lunar orbit (Apollo's longest stays) and one revolution of the halo orbit for a design that meets there. */
export function defaultSurfaceStayDays(a: ArchitectureSpec): number {
  return a.surfaceStay?.defaultDays ?? (a.rendezvous === 'nrho' ? 6.5 : 3)
}

// One worker computes missions off the main thread, and after each plan its maximum payload; it also runs the
// landing dispersion of the plan it holds. A new plan request replaces the plan or payload still being worked
// out (the worker is restarted: its answer would be for choices the user has already changed); a running
// dispersion is cancelled by the worker itself when the next request arrives. Replies are told apart by `kind`:
// none = PlanReply, 'payload', 'dispersion-progress', 'dispersion'. A second worker plans the options of the
// cheapest-route search one after the other, so the search never holds up the mission on screen.
let worker: Worker | null = null
let pending: { id: number; resolve(r: PlanReply): void } | null = null
let payloadWait: { id: number; resolve(r: PayloadReply | null): void } | null = null
let dispersionJob: { id: number; onProgress(done: number, total: number): void; resolve(r: DispersionReply): void } | null = null
let seq = 0

const newWorker = () => new Worker(new URL('../flight/planWorker.ts', import.meta.url), { type: 'module' })

/** Stops the worker and settles everything that waits on it. cancelled: the page asked for it (new inputs). */
function dropWorker(message: string, cancelled: boolean) {
  worker?.terminate()
  worker = null
  const p = pending
  const w = payloadWait
  const d = dispersionJob
  pending = null
  payloadWait = null
  dispersionJob = null
  p?.resolve({ id: p.id, ok: false, message, expected: false })
  w?.resolve({ kind: 'payload', id: w.id, payload: null, message })
  d?.resolve({ kind: 'dispersion', id: d.id, ok: false, message, cancelled })
}

/** Routes one reply of the main worker to whoever waits for it; a reply for an older id is dropped. */
export function onWorkerReply(m: WorkerReply): void {
  if (!m || typeof m !== 'object') return
  if (!('kind' in m)) {
    if (pending && pending.id === m.id) {
      const p = pending
      pending = null
      if (!m.ok && payloadWait && payloadWait.id === m.id) {
        const w = payloadWait
        payloadWait = null
        w.resolve({ kind: 'payload', id: w.id, payload: null, message: 'no plan' })
      }
      p.resolve(m)
    }
    return
  }
  switch (m.kind) {
    case 'payload':
      if (payloadWait && payloadWait.id === m.id) {
        const w = payloadWait
        payloadWait = null
        w.resolve(m)
      }
      return
    case 'dispersion-progress':
      if (dispersionJob && dispersionJob.id === m.id) dispersionJob.onProgress(m.done, m.total)
      return
    case 'dispersion':
      if (dispersionJob && dispersionJob.id === m.id) {
        const d = dispersionJob
        dispersionJob = null
        d.resolve(m)
      }
      return
  }
}

function ensureWorker(): Worker {
  if (!worker) {
    const w = newWorker()
    w.onmessage = (e: MessageEvent<WorkerReply>) => onWorkerReply(e.data)
    w.onerror = (e) => {
      e.preventDefault()
      dropWorker(e.message || 'the planning worker stopped', false)
    }
    // A reply that cannot be read carries no id: settle everything that waits instead of leaving it pending.
    w.onmessageerror = () => dropWorker('a reply of the planning worker could not be read', false)
    worker = w
  }
  return worker
}

/** Plans one mission; onPayload receives its maximum payload afterwards (null where no worker runs). */
function compute(req: Omit<PlanRequest, 'id'>, onPayload: (r: PayloadReply | null) => void): { id: number; reply: Promise<PlanReply> } {
  const id = ++seq
  if (pending || payloadWait) dropWorker('superseded', true)
  try {
    ensureWorker()
  } catch {
    // no workers here (an old browser, a test page): compute on the page after it has painted "Computing…".
    // The payload's ascent sensitivity takes seconds, too slow for the page: it is not offered then.
    onPayload(null)
    return { id, reply: new Promise((resolve) => window.setTimeout(() => resolve(runPlan({ ...req, id })), 30)) }
  }
  payloadWait = { id, resolve: onPayload }
  return {
    id,
    reply: new Promise((resolve) => {
      pending = { id, resolve }
      worker!.postMessage({ ...req, id, withPayload: true })
    }),
  }
}

/** Runs the dispersion of the plan `plan` names (the request it was planned with); replaces a running one. */
function disperse(plan: PlanRequest, onProgress: (done: number, total: number) => void): Promise<DispersionReply> {
  const id = ++seq
  const old = dispersionJob
  dispersionJob = null
  old?.resolve({ kind: 'dispersion', id: old.id, ok: false, message: 'superseded', cancelled: true })
  try {
    ensureWorker()
  } catch {
    return Promise.resolve({ kind: 'dispersion', id, ok: false, message: 'this browser cannot start the worker the analysis runs in', cancelled: false })
  }
  return new Promise((resolve) => {
    dispersionJob = { id, onProgress, resolve }
    worker!.postMessage({ kind: 'dispersion', id, plan } satisfies DispersionRequest)
  })
}

function cancelDispersionJob() {
  const d = dispersionJob
  if (!d) return
  dispersionJob = null
  worker?.postMessage({ kind: 'cancel', id: d.id } satisfies DispersionCancel)
  d.resolve({ kind: 'dispersion', id: d.id, ok: false, message: 'cancelled', cancelled: true })
}

// ---- the cheapest-route search: its own worker, one plan after the other, cancelled by terminating it
let routeWorker: Worker | null = null
let routeRun = 0
let routeWait: ((r: PlanReply) => void) | null = null

function cancelRouteSearch() {
  routeRun++
  routeWorker?.terminate()
  routeWorker = null
  const w = routeWait
  routeWait = null
  w?.({ id: -1, ok: false, message: 'cancelled', expected: false })
}

function planOnRouteWorker(req: PlanRequest): Promise<PlanReply> {
  if (!routeWorker) {
    const w = newWorker()
    const fail = (message: string) => {
      w.terminate()
      if (routeWorker === w) routeWorker = null
      const r = routeWait
      routeWait = null
      r?.({ id: req.id, ok: false, message, expected: false })
    }
    w.onmessage = (e: MessageEvent<WorkerReply>) => {
      if ('kind' in e.data) return
      const r = routeWait
      routeWait = null
      r?.(e.data)
    }
    w.onerror = (e) => {
      e.preventDefault()
      fail(e.message || 'the planning worker stopped')
    }
    w.onmessageerror = () => fail('a reply of the planning worker could not be read')
    routeWorker = w
  }
  return new Promise((resolve) => {
    routeWait = resolve
    routeWorker!.postMessage(req)
  })
}

/** The options the search compares (payload.ts routeOptions): three touchdown days; for a low-lunar-orbit design
 *  also a transfer of at most three days (6 plans, 16 to 20 s); a halo-orbit design only minimum energy (3 plans
 *  of 10 to 13 s each: whether its planner honours a transfer cap is not checked). */
export function routeChoices(rendezvous: 'llo' | 'nrho'): { windowDays: number; transfers: (number | null)[] } {
  return rendezvous === 'llo' ? { windowDays: 2, transfers: [null, 3] } : { windowDays: 2, transfers: [null] }
}

/** The last plan request of the page (with the id the worker planned it under), for the analyses on it. */
let lastRequest: { key: string; req: PlanRequest } | null = null

function startRouteSearch() {
  const last = lastRequest
  if (!last || last.key !== getFlightAnalysis().key) return
  const key = last.key
  cancelRouteSearch()
  const run = routeRun
  const base = last.req
  const i = base.input
  const opts = routeOptions({ earliestTouchdownMs: i.earliestTouchdownMs, architectureId: i.architecture.id }, routeChoices(base.rendezvous))
  const lastDayMs = Math.max(...opts.map((o) => o.earliestTouchdownMs))
  patchFlightAnalysis(key, { route: { state: 'running', done: 0, total: opts.length } })
  void loadMonthsFor(i.earliestTouchdownMs - LEAD_DAYS * DAY_MS, lastDayMs + (i.surfaceStayDays + i.returnWindowDays + TAIL_DAYS) * DAY_MS)
    .then(async (months) => {
      if (!months) throw new Error('no ephemeris for the days the search covers')
      const replies: PlanReply[] = []
      for (const o of opts) {
        const reply = await planOnRouteWorker({
          id: ++seq,
          months,
          rendezvous: base.rendezvous,
          input: { ...i, earliestTouchdownMs: o.earliestTouchdownMs, maxTransferDays: o.maxTransferDays },
        })
        if (run !== routeRun) return
        replies.push(reply)
        patchFlightAnalysis(key, { route: { state: 'running', done: replies.length, total: opts.length } })
      }
      routeWorker?.terminate()
      routeWorker = null
      const result = cheapestRoute(replies.map((r, k) => ({ option: opts[k], plan: r.ok ? r.plan : null, error: r.ok ? undefined : r.message })))
      patchFlightAnalysis(key, { route: { state: 'ready', result } })
    })
    .catch((e: unknown) => {
      if (run === routeRun) patchFlightAnalysis(key, { route: { state: 'error', message: `The search stopped: ${e instanceof Error ? e.message : String(e)}` } })
    })
}

function startDispersion() {
  const last = lastRequest
  if (!last || last.key !== getFlightAnalysis().key) return
  const key = last.key
  patchFlightAnalysis(key, { dispersion: { state: 'running', done: 0, total: 200 } })
  void disperse(last.req, (done, total) => patchFlightAnalysis(key, { dispersion: { state: 'running', done, total } })).then((r) => {
    if (r.ok) patchFlightAnalysis(key, { dispersion: { state: 'ready', result: r.result } })
    else if (!r.cancelled) patchFlightAnalysis(key, { dispersion: { state: 'error', message: `The dispersion analysis stopped: ${r.message}` } })
  })
}

setFlightActions({
  findRoute: startRouteSearch,
  cancelRoute() {
    cancelRouteSearch()
    patchFlightAnalysis(getFlightAnalysis().key, { route: { state: 'idle' } })
  },
  runDispersion: startDispersion,
  cancelDispersion() {
    cancelDispersionJob()
    patchFlightAnalysis(getFlightAnalysis().key, { dispersion: { state: 'idle' } })
  },
})

export interface FlightInput {
  active: boolean // the tab is open: nothing is loaded or computed before
  pad: Launchpad
  target: LandingTarget
  architecture: ArchitectureSpec
  launchVehicle: LaunchVehicleSpec
  capsule: SpacecraftSpec
  lander: SpacecraftSpec
  earliestTouchdownMs: number
  surfaceStayDays: number
  returnWindowDays: number
  maxTransferDays: number | null
}

export interface Flight {
  status: MissionStatus
  plan: MissionPlan | null
  clock: { timeMs: number }
  timeMs: number
  playing: boolean
  speed: number
  setPlaying(v: boolean): void
  setSpeed(v: number): void
  seek(utcMs: number): void
}

export function useFlight(input: FlightInput): Flight {
  const { active, pad, target, architecture, earliestTouchdownMs, surfaceStayDays, returnWindowDays, maxTransferDays } = input
  const key = [
    pad.id, pad.latDeg.toFixed(4), pad.lonDeg.toFixed(4), target.latDeg.toFixed(4), target.lonDeg.toFixed(4), architecture.id,
    earliestTouchdownMs, surfaceStayDays, returnWindowDays, maxTransferDays,
  ].join('|')
  const [state, setState] = useState<{ key: string; status: MissionStatus }>({ key: '', status: { state: 'loading' } })
  const latest = useRef(input)
  latest.current = input
  // Typed coordinates change with every keystroke; a mission is only computed once they have settled.
  const [settledKey, setSettledKey] = useState(key)
  useEffect(() => {
    const id = window.setTimeout(() => setSettledKey(key), 450)
    return () => window.clearTimeout(id)
  }, [key])

  // Inputs changed: what the analyses are doing is for the old inputs. Stop it at once (not only once the new
  // inputs have settled), so no stale number stays on screen.
  useEffect(() => {
    if (getFlightAnalysis().key === key) return
    cancelRouteSearch()
    cancelDispersionJob()
    resetFlightAnalysis(key, typeof Worker !== 'undefined')
  }, [key])

  useEffect(() => {
    if (!active) return
    let alive = true
    const key = settledKey
    const endMs = earliestTouchdownMs + (surfaceStayDays + returnWindowDays + TAIL_DAYS) * DAY_MS
    loadMonthsFor(earliestTouchdownMs - LEAD_DAYS * DAY_MS, endMs)
      .then(async (months): Promise<MissionStatus> => {
        if (!months) {
          return { state: 'error', message: 'No ephemeris for these dates in this build. A mission needs the months from a week before touchdown to a week after leaving the Moon.' }
        }
        const i = latest.current
        const req: Omit<PlanRequest, 'id'> = {
          months,
          rendezvous: i.architecture.rendezvous,
          input: {
            pad: i.pad,
            target: i.target,
            architecture: { id: i.architecture.id, name: i.architecture.name },
            launchVehicle: i.launchVehicle,
            capsule: i.capsule,
            lander: i.lander,
            earliestTouchdownMs,
            surfaceStayDays,
            returnWindowDays,
            maxTransferDays,
          },
        }
        const job = compute(req, (r) => {
          if (!alive) return
          if (r === null) patchFlightAnalysis(key, { payload: { state: 'error', message: 'The payload needs a background worker, which this browser did not start.' } })
          else if (r.payload) patchFlightAnalysis(key, { payload: { state: 'ready', result: r.payload } })
          else if (r.message !== 'superseded' && r.message !== 'no plan') {
            patchFlightAnalysis(key, { payload: { state: 'error', message: `Could not work out the payload. ${r.message ?? ''}`.trim() } })
          }
        })
        const reply = await job.reply
        if (!reply.ok) return { state: 'error', message: reply.expected ? reply.message : `Could not compute the mission. ${reply.message}` }
        if (alive) {
          lastRequest = { key, req: { ...req, id: job.id } }
          if (getFlightAnalysis().payload.state === 'idle') patchFlightAnalysis(key, { payload: { state: 'loading' } })
        }
        return { state: 'ready', plan: { ...reply.plan, ephem: makeFlightEphemeris(months) } }
      })
      .catch((e: Error): MissionStatus => ({ state: 'error', message: `Could not load the ephemeris. ${e.message}` }))
      .then((status) => alive && setState({ key, status }))
    return () => {
      alive = false
    }
    // the inputs are fully described by the settled key
  }, [active, settledKey])

  const status: MissionStatus = state.key === key ? state.status : { state: 'loading' }
  const plan = status.state === 'ready' ? status.plan : null

  const clock = useRef({ timeMs: 0 }).current
  const [timeMs, setTimeMs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(DEFAULT_SPEED)

  // A new plan starts paused at liftoff.
  useEffect(() => {
    if (!plan) return
    clock.timeMs = plan.launchMs
    setTimeMs(plan.launchMs)
    setPlaying(false)
  }, [plan, clock])

  useEffect(() => {
    if (!playing || !plan || !active) return
    let raf = 0
    let last = performance.now()
    let lastUi = 0
    const step = (now: number) => {
      const dt = Math.min(now - last, 100) // a background tab must not jump the flight ahead
      last = now
      const t = Math.min(plan.endMs, clock.timeMs + dt * speed) // real ms × (simulated s per real s) = simulated ms
      clock.timeMs = t
      if (t >= plan.endMs) {
        setTimeMs(t)
        setPlaying(false)
        return
      }
      if (now - lastUi >= UI_INTERVAL_MS) {
        lastUi = now
        setTimeMs(t)
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, plan, speed, active, clock])

  const seek = useCallback(
    (utcMs: number) => {
      if (!plan) return
      const t = Math.min(plan.endMs, Math.max(plan.launchMs, utcMs))
      clock.timeMs = t
      setTimeMs(t)
    },
    [plan, clock],
  )

  return useMemo(
    () => ({ status, plan, clock, timeMs: plan ? Math.min(plan.endMs, Math.max(plan.launchMs, timeMs)) : timeMs, playing, speed, setPlaying, setSpeed, seek }),
    // status is fully described by state and key
    [state, key, plan, clock, timeMs, playing, speed, seek],
  )
}
