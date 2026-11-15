// The page side of the planning worker: replies are told apart by `kind`, a reply for an older request is
// dropped, and a worker that fails (error event, or a reply that cannot be read) is terminated and settles
// everything that waits on it instead of leaving it pending. A fake Worker stands in for the real one.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlanReply, PlanRequest, WorkerReply } from '../flight/planWorker'

class FakeWorker {
  static all: FakeWorker[] = []
  sent: unknown[] = []
  terminated = false
  onmessage: ((e: { data: WorkerReply }) => void) | null = null
  onerror: ((e: { message: string; preventDefault(): void }) => void) | null = null
  onmessageerror: (() => void) | null = null
  constructor() {
    FakeWorker.all.push(this)
  }
  postMessage(m: unknown) {
    this.sent.push(m)
  }
  terminate() {
    this.terminated = true
  }
  reply(m: WorkerReply) {
    this.onmessage?.({ data: m })
  }
}

const REQ = { months: [], rendezvous: 'llo', input: {} } as unknown as Omit<PlanRequest, 'id'>

async function load() {
  vi.resetModules()
  return (await import('./useFlight')).workerPlumbing
}

beforeEach(() => {
  FakeWorker.all = []
  vi.stubGlobal('Worker', FakeWorker)
})
afterEach(() => vi.unstubAllGlobals())

describe('worker plumbing', () => {
  it('a plan reply (no kind) and its payload reply (kind payload) go to their own waiters', async () => {
    const w = await load()
    const payloads: unknown[] = []
    const job = w.compute(REQ, (r) => payloads.push(r))
    const fake = FakeWorker.all[0]
    expect(fake.sent[0]).toMatchObject({ id: job.id, withPayload: true })
    const plan = { id: job.id, ok: true, plan: {} } as unknown as PlanReply
    fake.reply({ kind: 'payload', id: job.id - 1, payload: null }) // an older request's: dropped
    fake.reply(plan)
    await expect(job.reply).resolves.toBe(plan)
    expect(payloads).toEqual([])
    fake.reply({ kind: 'payload', id: job.id, payload: null, message: 'x' })
    expect(payloads).toEqual([{ kind: 'payload', id: job.id, payload: null, message: 'x' }])
  })

  it('an error event terminates the worker and settles the plan, the payload and the dispersion', async () => {
    const w = await load()
    const payloads: unknown[] = []
    const job = w.compute(REQ, (r) => payloads.push(r))
    const fake = FakeWorker.all[0]
    const disp = w.disperse({ ...REQ, id: job.id }, () => {})
    fake.onerror!({ message: 'boom', preventDefault() {} })
    expect(fake.terminated).toBe(true)
    await expect(job.reply).resolves.toMatchObject({ ok: false, message: 'boom' })
    await expect(disp).resolves.toMatchObject({ kind: 'dispersion', ok: false, cancelled: false, message: 'boom' })
    expect(payloads).toHaveLength(1)
    // the next request starts a fresh worker
    w.compute(REQ, () => {})
    expect(FakeWorker.all).toHaveLength(2)
  })

  it('a reply that cannot be read (messageerror) settles what waits instead of leaving it pending', async () => {
    const w = await load()
    const job = w.compute(REQ, () => {})
    const fake = FakeWorker.all[0]
    fake.onmessageerror!()
    expect(fake.terminated).toBe(true)
    await expect(job.reply).resolves.toMatchObject({ ok: false })
  })

  it('dispersion progress and reply are told apart by kind; cancel sends a cancel message', async () => {
    const w = await load()
    const job = w.compute(REQ, () => {})
    const fake = FakeWorker.all[0]
    fake.reply({ id: job.id, ok: true, plan: {} } as unknown as PlanReply)
    fake.reply({ kind: 'payload', id: job.id, payload: null })
    const seen: number[] = []
    const disp = w.disperse({ ...REQ, id: job.id }, (done) => seen.push(done))
    const sent = fake.sent[fake.sent.length - 1] as { kind: string; id: number }
    expect(sent.kind).toBe('dispersion')
    fake.reply({ kind: 'dispersion-progress', id: sent.id, done: 1, total: 200 })
    fake.reply({ kind: 'dispersion-progress', id: sent.id, done: 2, total: 200 })
    expect(seen).toEqual([1, 2])
    w.cancelDispersion()
    expect(fake.sent[fake.sent.length - 1]).toEqual({ kind: 'cancel', id: sent.id })
    await expect(disp).resolves.toMatchObject({ ok: false, cancelled: true })
  })

  it('a new plan while one is still computed restarts the worker (the old answer is for old inputs)', async () => {
    const w = await load()
    const first = w.compute(REQ, () => {})
    w.compute(REQ, () => {})
    expect(FakeWorker.all[0].terminated).toBe(true)
    await expect(first.reply).resolves.toMatchObject({ ok: false, message: 'superseded' })
  })
})
