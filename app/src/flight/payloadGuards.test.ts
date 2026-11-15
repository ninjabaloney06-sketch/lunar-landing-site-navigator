// payload.ts: a perturbation without a solution is not a 0 kg term; a bug is not an expected plan failure.
import { describe, expect, it } from 'vitest'
import { termKg, planCheapestRoute } from './payload'
import { AscentError } from './ascent'
import { LunarOpsError } from './lunar'
import { NrhoError } from './nrho'
import { FlightPlanError } from './types'

describe('termKg', () => {
  it('is the size of the change where a solution exists, exactly as |perturbed - raw|', () => {
    expect(termKg(1000, 1234.5)).toBe(Math.abs(1234.5 - 1000))
    expect(termKg(1000, 900)).toBe(100)
    expect(termKg(0, 0)).toBe(0)
  })
  it('is null, not 0, where the perturbed problem has no solution', () => {
    expect(termKg(1000, null)).toBeNull()
  })
})

describe('planCheapestRoute error handling', () => {
  const base = { earliestTouchdownMs: Date.UTC(2027, 7, 16), maxTransferDays: null, architecture: { id: 'apollo' } }
  const opts = { windowDays: 0, transfers: [null] } as Parameters<typeof planCheapestRoute>[1]
  it('records the planners own errors and RangeError as failed options', () => {
    for (const err of [new FlightPlanError('no plan'), new AscentError('no ascent'), new LunarOpsError('no descent'), new NrhoError('no orbit'), new RangeError('integrator')]) {
      const c = planCheapestRoute(base, opts, () => {
        throw err
      })
      expect(c.failed.length).toBeGreaterThan(0)
      expect(c.failed[0].message).toBe(err.message)
    }
  })
  it('rethrows anything else (a TypeError is a bug, not a plan that fails)', () => {
    expect(() =>
      planCheapestRoute(base, opts, () => {
        throw new TypeError('x is undefined')
      }),
    ).toThrow(TypeError)
  })
})
