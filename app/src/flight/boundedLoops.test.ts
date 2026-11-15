// Tolerance loops end: goldenMin throws instead of spinning when the tolerance cannot be reached.
import { describe, expect, it } from 'vitest'
import { goldenMin } from './astro'

describe('goldenMin', () => {
  it('still converges to the argmin for a reachable tolerance', () => {
    expect(goldenMin((x) => (x - 1.3) ** 2, 0, 3, 1e-9)).toBeCloseTo(1.3, 6)
    expect(goldenMin((x) => Math.abs(x - 1.7e12), 1.7e12 - 6e5, 1.7e12 + 6e5, 1000)).toBeCloseTo(1.7e12, -3)
  })
  it('throws a RangeError when the tolerance is below the rounding of the interval ends', () => {
    expect(() => goldenMin((x) => (x - 1.7e12) ** 2, 1.7e12 - 6e5, 1.7e12 + 6e5, 0)).toThrow(RangeError)
    expect(() => goldenMin((x) => (x - 1.3) ** 2, 0, 3, -1)).toThrow(RangeError)
  })
  it('returns at once for a NaN interval, as before (the comparison is false)', () => {
    expect(Number.isNaN(goldenMin((x) => x, NaN, 1, 1e-3))).toBe(true)
  })
})
