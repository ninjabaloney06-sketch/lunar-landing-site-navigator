// The flight plan for the current choices and its playback clock (Flight plan tab).
// The plan is computed from the same DE440 ephemeris files as everything else; nothing here invents a number:
// missing ephemeris months give a plain message. The clock advances on animation frames into a plain object
// the 3D scene reads directly, and into React state only about 15 times a second (the readout and scrubber).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadMonthsFor } from '../data/load'
import { makeFlightEphemeris } from '../flight/ephemeris'
import { planFlight } from '../flight/plan'
import { DEFAULT_OPTIONS, FlightPlanError } from '../flight/types'
import type { FlightPlan, LandingTarget, Launchpad, Vehicle } from '../flight/types'
import { DAY_MS } from '../state'
import type { FlightStatus } from './FlightPanel'
import { DEFAULT_SPEED } from './flightFormat'

// Ephemeris loaded around touchdown: the flight starts about a week earlier (longer with a slow parking coast).
const LEAD_DAYS = 9
const UI_INTERVAL_MS = 66

export interface FlightInput {
  active: boolean // the tab is open: nothing is loaded or computed before
  pad: Launchpad
  vehicle: Vehicle
  target: LandingTarget
  landingMs: number
  maxTransferDays: number | null
}

export interface Flight {
  status: FlightStatus
  plan: FlightPlan | null
  clock: { timeMs: number }
  timeMs: number
  playing: boolean
  speed: number
  setPlaying(v: boolean): void
  setSpeed(v: number): void
  seek(utcMs: number): void
}

export function useFlight(input: FlightInput): Flight {
  const { active, pad, vehicle, target, landingMs, maxTransferDays } = input
  const key = `${pad.id}|${vehicle.id}|${target.id}|${landingMs}|${maxTransferDays}`
  const [state, setState] = useState<{ key: string; status: FlightStatus }>({ key: '', status: { state: 'loading' } })

  useEffect(() => {
    if (!active) return
    let alive = true
    loadMonthsFor(landingMs - LEAD_DAYS * DAY_MS, landingMs + DAY_MS)
      .then((months): FlightStatus => {
        if (!months) return { state: 'error', message: 'No ephemeris for these dates in this build. The flight starts about a week before touchdown.' }
        const plan = planFlight({
          pad,
          vehicle,
          target,
          options: { ...DEFAULT_OPTIONS, landingMs, maxTransferDays },
          ephem: makeFlightEphemeris(months),
        })
        return { state: 'ready', plan }
      })
      .catch((e: Error): FlightStatus => ({
        state: 'error',
        message: e instanceof FlightPlanError ? e.message : `Could not compute the flight plan. ${e.message}`,
      }))
      .then((status) => alive && setState({ key, status }))
    return () => {
      alive = false
    }
    // the inputs are fully described by key
  }, [active, key])

  const status: FlightStatus = state.key === key ? state.status : { state: 'loading' }
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
      const t = Math.min(plan.landingMs, clock.timeMs + dt * speed) // real ms × (simulated s per real s) = simulated ms
      clock.timeMs = t
      if (t >= plan.landingMs) {
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
      const t = Math.min(plan.landingMs, Math.max(plan.launchMs, utcMs))
      clock.timeMs = t
      setTimeMs(t)
    },
    [plan, clock],
  )

  return useMemo(
    () => ({ status, plan, clock, timeMs: plan ? Math.min(plan.landingMs, Math.max(plan.launchMs, timeMs)) : timeMs, playing, speed, setPlaying, setSpeed, seek }),
    // status is fully described by state and key
    [state, key, plan, clock, timeMs, playing, speed, seek],
  )
}
