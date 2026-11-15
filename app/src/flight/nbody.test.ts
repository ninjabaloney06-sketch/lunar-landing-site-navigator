// nbody.ts step control: a step whose error estimate is NaN is rejected, not accepted into the path.
import { describe, expect, it } from 'vitest'
import { MU_EARTH } from './astro'
import { makeBodyTable, propagate } from './nbody'
import type { Gravity } from './nbody'
import type { Vec3 } from './types'

describe('propagate', () => {
  it('rejects steps with a NaN error and stops with a RangeError instead of returning a NaN path', () => {
    const moon = makeBodyTable(() => [384400, 0, 0] as Vec3, 0, 86400_000)
    // gravity that turns into NaN 100 s after the start
    const g: Gravity = {
      moon,
      sun: null,
      accel(r, utcMs, out) {
        const r3 = Math.pow(r[0] * r[0] + r[1] * r[1] + r[2] * r[2], 1.5)
        const k = utcMs > 100_000 ? NaN : -MU_EARTH / r3
        out[0] = k * r[0]
        out[1] = k * r[1]
        out[2] = k * r[2]
      },
      moonState: () => ({ r: [384400, 0, 0], v: [0, 0, 0] }),
    }
    expect(() => propagate(g, { r: [7000, 0, 0], v: [0, 7.5, 0] }, 0, { maxSeconds: 3600 })).toThrow(RangeError)
  })

  const still = (): Gravity => ({
    moon: makeBodyTable(() => [384400, 0, 0] as Vec3, 0, 86400_000),
    sun: null,
    accel: (_r, _t, out) => out.fill(0),
    moonState: () => ({ r: [384400, 0, 0], v: [0, 0, 0] }),
  })

  it('throws a RangeError for a non-finite maxSeconds instead of returning an empty or endless run', () => {
    for (const maxSeconds of [NaN, Infinity, -Infinity]) {
      expect(() => propagate(still(), { r: [7000, 0, 0], v: [0, 7.5, 0] }, 0, { maxSeconds })).toThrow(RangeError)
    }
  })

  it('throws a RangeError when the step guard runs out before maxSeconds', () => {
    expect(() => propagate(still(), { r: [7000, 0, 0], v: [0, 7.5, 0] }, 0, { maxSeconds: 20000, maxStepS: 0.01 })).toThrow(/step limit/)
  })
})
