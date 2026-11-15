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
