// The analyses that come with a computed mission (all NOT YET VALIDATED BY THE SCIENCE LEAD): the maximum payload
// (payload.ts, worked out by the worker right after every plan), the cheapest route (payload.ts cheapestRoute, 16
// to 20 s of planning, started only by the user) and the landing dispersion (dispersion.ts, about 4 s, started
// only by the user). One store for the page, outside React state, so the Flight panel and the 3D scene read the
// same value without new props: useFlight writes it, useFlightAnalysis() reads it, subscribeFlightAnalysis() lets
// the scene redraw the dispersion tube.
//
// Every analysis belongs to one set of mission inputs (`key`, the same key useFlight plans with). When the inputs
// change, useFlight resets the store and cancels whatever is still running: its answer would be for choices the
// user has already left.
import { useSyncExternalStore } from 'react'
import type { DispersionResult } from '../flight/dispersion'
import type { PayloadResult, RouteComparison } from '../flight/payload'

export type Job<T> =
  | { state: 'idle' }
  | { state: 'running'; done: number; total: number }
  | { state: 'ready'; result: T }
  | { state: 'error'; message: string }

export type PayloadState =
  | { state: 'idle' } // no plan yet
  | { state: 'loading' } // the plan is in, the payload is being worked out
  | { state: 'ready'; result: PayloadResult }
  | { state: 'error'; message: string }

export interface FlightAnalysis {
  key: string // the mission inputs these results belong to
  payload: PayloadState
  route: Job<RouteComparison>
  dispersion: Job<DispersionResult>
  /** false where no Web Worker can be started: the slow analyses are then not offered (never on the page). */
  canAnalyse: boolean
}

export interface FlightActions {
  findRoute(): void
  cancelRoute(): void
  runDispersion(): void
  cancelDispersion(): void
}

const IDLE: FlightAnalysis = { key: '', payload: { state: 'idle' }, route: { state: 'idle' }, dispersion: { state: 'idle' }, canAnalyse: true }

let current: FlightAnalysis = IDLE
const listeners = new Set<() => void>()
const noop = () => {}
let actions: FlightActions = { findRoute: noop, cancelRoute: noop, runDispersion: noop, cancelDispersion: noop }

export function getFlightAnalysis(): FlightAnalysis {
  return current
}

/** Changes the analysis of `key`; a change for another key (a late answer for old inputs) is dropped. */
export function patchFlightAnalysis(key: string, patch: Partial<Omit<FlightAnalysis, 'key'>>): void {
  if (key !== current.key) return
  current = { ...current, ...patch }
  for (const f of listeners) f()
}

/** Starts a fresh analysis for new mission inputs. */
export function resetFlightAnalysis(key: string, canAnalyse = true): void {
  current = { ...IDLE, key, canAnalyse }
  for (const f of listeners) f()
}

export function subscribeFlightAnalysis(f: () => void): () => void {
  listeners.add(f)
  return () => {
    listeners.delete(f)
  }
}

export function setFlightActions(a: FlightActions): void {
  actions = a
}

/** What the buttons call; set by useFlight. */
export const flightActions: FlightActions = {
  findRoute: () => actions.findRoute(),
  cancelRoute: () => actions.cancelRoute(),
  runDispersion: () => actions.runDispersion(),
  cancelDispersion: () => actions.cancelDispersion(),
}

export function useFlightAnalysis(): FlightAnalysis {
  return useSyncExternalStore(subscribeFlightAnalysis, getFlightAnalysis, getFlightAnalysis)
}
