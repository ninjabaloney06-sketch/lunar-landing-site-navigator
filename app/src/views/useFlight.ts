// The mission plan for the current choices and its playback clock (Flight plan tab).
// The plan is computed from the same DE440 ephemeris files as everything else; nothing here invents a number:
// missing ephemeris months give a plain message. Computing a mission takes seconds (every phase is integrated
// and aimed by iteration), so it runs in a Web Worker. The clock advances on animation frames
// into a plain object the 3D scene reads directly, and into React state only about 15 times a second.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadMonthsFor } from '../data/load'
import { makeFlightEphemeris } from '../flight/ephemeris'
import type { ArchitectureSpec, LaunchVehicleSpec, SpacecraftSpec } from '../flight/hardware'
import { runPlan } from '../flight/planWorker'
import type { PlanReply, PlanRequest } from '../flight/planWorker'
import type { LandingTarget, Launchpad, MissionPlan } from '../flight/types'
import { DAY_MS } from '../state'
import type { MissionStatus } from './FlightPanel'
import { DEFAULT_SPEED } from './flightFormat'

// Ephemeris loaded around the mission: it starts about a week before touchdown and ends about a week after
// leaving the Moon.
const LEAD_DAYS = 12
const TAIL_DAYS = 16
const UI_INTERVAL_MS = 66

// One worker computes missions off the main thread. A new request replaces the one still running: its answer
// would be for choices the user has already changed.
let worker: Worker | null = null
let pending: { id: number; resolve(r: PlanReply): void } | null = null
let seq = 0

function compute(req: Omit<PlanRequest, 'id'>): Promise<PlanReply> {
  const id = ++seq
  if (pending) {
    worker?.terminate()
    worker = null
    pending.resolve({ id: pending.id, ok: false, message: 'superseded', expected: false })
    pending = null
  }
  try {
    if (!worker) {
      worker = new Worker(new URL('../flight/planWorker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (e: MessageEvent<PlanReply>) => {
        if (pending && pending.id === e.data.id) {
          pending.resolve(e.data)
          pending = null
        }
      }
      worker.onerror = (e) => {
        pending?.resolve({ id: pending.id, ok: false, message: e.message || 'the planning worker stopped', expected: false })
        pending = null
        worker = null
      }
    }
  } catch {
    // no workers here (an old browser, a test page): compute on the page after it has painted "Computingâ€¦"
    return new Promise((resolve) => window.setTimeout(() => resolve(runPlan({ ...req, id })), 30))
  }
  return new Promise((resolve) => {
    pending = { id, resolve }
    worker!.postMessage({ ...req, id })
  })
}

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
        const reply = await compute({
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
        })
        if (!reply.ok) return { state: 'error', message: reply.expected ? reply.message : `Could not compute the mission. ${reply.message}` }
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
      const t = Math.min(plan.endMs, clock.timeMs + dt * speed) // real ms Ã— (simulated s per real s) = simulated ms
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
