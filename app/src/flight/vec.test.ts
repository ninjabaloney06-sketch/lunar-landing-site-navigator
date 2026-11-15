// vec.ts guards: a vector without a direction is an error, not a NaN that runs on.
import { describe, expect, it } from 'vitest'
import type { Vec3 } from './types'
import { angleWrapUp, norm, unit } from './vec'

describe('unit', () => {
  it('gives the same bits as dividing by the norm for any usable vector', () => {
    const vs: Vec3[] = [[1, 2, 3], [-7000.123, 4.5e-3, 12], [1e-150, 0, 0], [3e150, -4e150, 0], [0, 0, -2]]
    for (const v of vs) {
      const n = norm(v)
      expect(unit(v)).toEqual([v[0] * (1 / n), v[1] * (1 / n), v[2] * (1 / n)])
    }
  })
  it('throws a RangeError for a zero or non-finite vector', () => {
    for (const v of [[0, 0, 0], [NaN, 1, 0], [Infinity, 0, 0], [0, -Infinity, 1]] as Vec3[]) {
      expect(() => unit(v)).toThrow(RangeError)
    }
  })
})

describe('angleWrapUp', () => {
  const TWO_PI = 2 * Math.PI
  it('adds whole turns exactly as the repeated addition it replaces', () => {
    for (const x of [-20, -7.123456789, -0.3, 0, 0.2, 1.5]) {
      let ref = x
      while (ref < 0.1) ref += TWO_PI
      expect(angleWrapUp(x, 0.1, TWO_PI)).toBe(ref)
    }
  })
  it('throws a RangeError for NaN, Infinity or an angle too far away to reach in a sane number of turns', () => {
    for (const x of [NaN, -Infinity, Infinity, -1e300, -1e12]) expect(() => angleWrapUp(x, 0, TWO_PI)).toThrow(RangeError)
  })
})
