// The mission plan for the current choices and its playback clock (flight view).
// The plan is computed from the same DE440 ephemeris files as everything else; nothing here invents a number:
// missing ephemeris months give a plain message. Computing a mission takes seconds (every phase is integrated
// and aimed by iteration), so it runs in a Web Worker. The clock advances on animation frames
// into a plain object the 3D scene reads directly, and into React state only about 15 times a second.
//
// The analyses that come with a plan (maximum payload after every plan; cheapest route and landing dispersion on
// the user's request; all stated as validated by the science lead on 15 Nov 2026, no per-check sign-off) go to the store in flightAnalysis.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadMonthsFor } from '../data/load'
import { makeFlightEphemeris } from '../flight/ephemeris'
import type { ArchitectureSpec, LaunchVehicleSpec, SpacecraftSpec } from '../flight/hardware'
import { cheapestRoute, routeOptions } from '../flight/payload'
import type { DispersionCancel, DispersionReply, DispersionRequest, PayloadReply, PlanReply, PlanRequest, WorkerReply } from '../flight/planWorker'
import type { LandingTarget, Launchpad, MissionPlan } from '../flight/types'
import { DAY_MS, STAY_RANGE } from '../state'
import type { MissionStatus } from './FlightPanel'
import { getFlightAnalysis, patchFlightAnalysis, resetFlightAnalysis, setFlightActions } from './flightAnalysis'
import { DEFAULT_SPEED } from './flightFormat'

// Ephemeris loaded around the mission: from `lead` days before the earliest touchdown to `tail` days after the
// stay and the return window. Low lunar orbit: the liftoff is about 5 days before touchdown and the plan ends
// about 4.5 days after the stay (measured, Apollo at the edges of this build's months), so 12 / 16 leave ample
// margin. Halo orbit: missionNrho.ts builds its reference NRHO over whole revolutions (6.56 days each) centred on
// the span from half a revolution before the flyby to the latest departure, so it reaches about 13.2 days before
// touchdown and 20 days after the stay (measured with no return window, where the planner searches one
// revolution for the departure), up to half a revolution more from the rounding to whole revolutions: 17 / 24.
const SPAN_DAYS: Record<'llo' | 'nrho', { lead: number; tail: number }> = { llo: { lead: 12, tail: 16 }, nrho: { lead: 17, tail: 24 } }
const UI_INTERVAL_MS = 66

const monthStart = (ms: number, add = 0) => {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + add, 1)
}
const monthKeyOf = (ms: number) => new Date(ms).toISOString().slice(0, 7)

/** The touchdowns this build can plan for a stay and return window: the run of ephemeris months present around
 *  the asked touchdown (found with `present`, never assumed), less the lead before touchdown and the stay, return
 *  window and tail after it that useFlight loads. null when the month of the asked touchdown is itself missing
 *  or the run is too short for any touchdown. */
export async function supportedTouchdownRange(
  present: (monthKey: string) => Promise<boolean>,
  touchdownMs: number,
  surfaceStayDays: number,
  returnWindowDays: number,
  span: { lead: number; tail: number },
): Promise<{ firstMs: number; lastMs: number } | null> {
  const anchor = monthStart(touchdownMs)
  if (!(await present(monthKeyOf(anchor)))) return null
  const walk = async (step: 1 | -1) => {
    let k = anchor
    for (let i = 0; i < 600 && (await present(monthKeyOf(monthStart(k, step)))); i++) k = monthStart(k, step)
    return k
  }
  const [first, last] = await Promise.all([walk(-1), walk(1)])
  const firstMs = first + span.lead * DAY_MS
  const lastMs = monthStart(last, 1) - (surfaceStayDays + returnWindowDays + span.tail) * DAY_MS
  return lastMs >= firstMs ? { firstMs, lastMs } : null
}

/** Whether the build serves the ephemeris file of a month (a HEAD request; a 404 or the SPA page means no). */
const monthPresence = new Map<string, Promise<boolean>>()
function ephemMonthPresent(key: string): Promise<boolean> {
  let p = monthPresence.get(key)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/ephem/${key}.json`, { method: 'HEAD' })
      .then((r) => r.ok && !(r.headers.get('content-type') ?? '').includes('text/html'))
      .catch(() => false)
    monthPresence.set(key, p)
  }
  return p
}

const utcMinute = (ms: number) => `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`

/** The sentence of the missing-ephemeris error that states the touchdowns this build supports. */
export function supportedRangeSentence(r: { firstMs: number; lastMs: number }, surfaceStayDays: number, returnWindowDays: number): string {
  const rw = returnWindowDays > 0 ? ` and a ${returnWindowDays}-day return window` : ''
  return `With a ${surfaceStayDays}-day stay${rw} the flight calculator supports touchdowns from ${utcMinute(r.firstMs)} to ${utcMinute(r.lastMs)}.`
}

/** The surface stay a design starts with: its documented one, else three days for a design that meets in low
 *  lunar orbit (Apollo's longest stays) and one revolution of the halo orbit for a design that meets there. */
/** The surface stay a flight starts with (reported bug, 15 Nov: "I chose 16 Aug–5 Sep; Calculate flight still computes
 *  10–21 Aug"): the mission's own length, so the flight lands at the mission start and stays for the mission's days,
 *  within the 0.5–30 days the flight plan accepts. `capped`: the mission is longer (or shorter) than that range. */
export function missionStay(missionDays: number): { days: number; capped: boolean } {
  const days = Math.min(STAY_RANGE.max, Math.max(STAY_RANGE.min, missionDays))
  return { days, capped: days !== missionDays }
}

/** The stay the chosen design documents (shown in its explanation; no longer the flight's starting stay). */
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
    // No worker: the planner is loaded here, on demand, so the landing-site view does not carry it in its bundle.
    return { id, reply: new Promise((resolve) => window.setTimeout(() => void import('../flight/planWorker').then(({ runPlan }) => resolve(runPlan({ ...req, id }))), 30)) }
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
  const span = SPAN_DAYS[base.rendezvous]
  void loadMonthsFor(i.earliestTouchdownMs - span.lead * DAY_MS, lastDayMs + (i.surfaceStayDays + i.returnWindowDays + span.tail) * DAY_MS)
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

/** For the tests (useFlight.test.ts): the worker plumbing without React. */
export const workerPlumbing = { compute, disperse, cancelDispersion: cancelDispersionJob }

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
    const span = SPAN_DAYS[latest.current.architecture.rendezvous]
    const endMs = earliestTouchdownMs + (surfaceStayDays + returnWindowDays + span.tail) * DAY_MS
    loadMonthsFor(earliestTouchdownMs - span.lead * DAY_MS, endMs)
      .then(async (months): Promise<MissionStatus> => {
        if (!months) {
          const range = await supportedTouchdownRange(ephemMonthPresent, earliestTouchdownMs, surfaceStayDays, returnWindowDays, span).catch(() => null)
          return {
            state: 'error',
            message:
              `No ephemeris for these dates in this build. A mission needs the months from ${span.lead} days before touchdown to ${span.tail} days after the stay and return window.` +
              (range ? ` ${supportedRangeSentence(range, surfaceStayDays, returnWindowDays)}` : ''),
          }
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
