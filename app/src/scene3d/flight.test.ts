// Pure tests for the display magnification of flight.ts. No WebGL: only the magnify functions are exercised.
import { describe, expect, it } from 'vitest'
import { EARTH_MAG, MOON_MAG, magnify, magnifyRadius, type Magnify } from './flight'

const PRESETS: [string, Magnify][] = [
  ['earth', EARTH_MAG],
  ['moon', MOON_MAG],
]

describe('magnifyRadius', () => {
  for (const [name, m] of PRESETS) {
    it(`is continuous at a and b (${name})`, () => {
      // Left and right limits meet at a (value k·a) and at b (value b).
      expect(Math.abs(magnifyRadius(m.a * (1 + 1e-9), m) - magnifyRadius(m.a * (1 - 1e-9), m)) / m.a).toBeLessThan(1e-6)
      expect(Math.abs(magnifyRadius(m.b * (1 - 1e-9), m) - m.b) / m.b).toBeLessThan(1e-6)
      expect(Math.abs(magnifyRadius(m.b * (1 + 1e-9), m) - m.b) / m.b).toBeLessThan(1e-6)
    })

    it(`is strictly increasing over 1000 samples to 250000 km (${name})`, () => {
      let prev = -Infinity
      for (let i = 0; i < 1000; i++) {
        const v = magnifyRadius((250000 * i) / 999, m)
        expect(v).toBeGreaterThan(prev)
        prev = v
      }
    })
  }
})

describe('magnify', () => {
  it('keeps the direction and maps the radius', () => {
    const p: [number, number, number] = [3000, -4000, 1200]
    for (const [, m] of PRESETS) {
      const q = magnify(p, m)
      const d = Math.hypot(...p)
      expect(Math.hypot(...q)).toBeCloseTo(magnifyRadius(d, m), 6)
      for (let i = 0; i < 3; i++) expect(q[i] / Math.hypot(...q)).toBeCloseTo(p[i] / d, 12)
    }
  })

  it('null is the identity', () => {
    const p: [number, number, number] = [384400, 12, -7]
    expect(magnify(p, null)).toEqual(p)
  })

  it('keeps the zero vector at zero', () => {
    for (const [, m] of PRESETS) expect(magnify([0, 0, 0], m)).toEqual([0, 0, 0])
  })
})
