// lunar.ts follow(): the continuation always ends, or says it cannot.
import { describe, expect, it } from 'vitest'
import { follow } from './lunar'

describe('follow', () => {
  it('reaches the end of the parameter when every step solves', () => {
    const seen: number[] = []
    const x = follow((p, g) => (seen.push(p), [g[0] + 1]), 0, [0], 1)
    expect(seen[seen.length - 1]).toBe(1)
    expect(x).toEqual([seen.length])
  })
  it('halves a rejected step and gives up (null) when the solver keeps refusing', () => {
    expect(follow(() => null, 0, [0], 1)).toBeNull()
    // refuses anything beyond 0.4: the steps shrink to 1/200 of the span, then null
    expect(follow((p) => (p > 0.4 ? null : [p]), 0, [0], 1)).toBeNull()
  })
  it('throws a RangeError for a NaN or infinite parameter instead of looping for ever', () => {
    expect(() => follow((p) => [p], 0, [0], NaN)).toThrow(RangeError)
    expect(() => follow((p) => [p], NaN, [0], 1)).toThrow(RangeError)
    expect(() => follow((p) => [p], 0, [0], Infinity)).toThrow(RangeError)
  })
  it('throws a RangeError when the steps never reach the end', () => {
    // the target is refused, so the step is halved below the rounding of p (ulp 16 at 1e17): p + step == p for ever
    const end = 1e17 + 160
    expect(() => follow((p, g) => (p === end ? null : g), 1e17, [0], end)).toThrow(RangeError)
  })
})
