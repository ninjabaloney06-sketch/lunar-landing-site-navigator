// Pure tests for flight.ts: the display magnification, where the lander is drawn, which events get a burn marker
// and the fade of the trail. No WebGL: only the exported functions are exercised.
import { describe, expect, it } from 'vitest'
import type { CraftId, MissionEvent, MissionLeg, MissionPlan } from '../flight/types'
import { EARTH_MAG, MOON_MAG, flightBurns, landerPresence, magnify, magnifyRadius, trailFade, type Magnify } from './flight'

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

// A plan reduced to what the helpers read: the capsule flies the whole time, the lander has its own leg from 40 to
// 60, the first docking (a design whose lander waits at the Moon) is at 20, the burn for home at 80.
const leg = (id: string, craft: CraftId, t0: number, t1: number, powered = false): MissionLeg => ({
  id, label: id, craft, frame: 'moon', powered, track: { t: [t0, t1], p: [[0, 0, 0], [1, 0, 0]] },
})
const event = (id: string, utcMs: number, kind: 'burn' | 'event' = 'event'): MissionEvent => ({
  id, short: id, label: id, utcMs, craft: 'capsule', kind, by: null, dvKms: null, propellantKg: null, durationS: null, massAfterKg: null,
})
const planOf = (events: MissionEvent[]) =>
  ({ launchMs: 0, endMs: 100, dockingMs: 60, legs: [leg('coast', 'capsule', 0, 100), leg('sortie', 'lander', 40, 60)], events }) as unknown as MissionPlan

describe('landerPresence', () => {
  it('is apart exactly while the lander has its own leg', () => {
    const plan = planOf([])
    expect(landerPresence(plan, 39)).toBe('docked')
    expect(landerPresence(plan, 40)).toBe('apart')
    expect(landerPresence(plan, 60)).toBe('apart')
    expect(landerPresence(plan, 61)).toBe('docked')
  })

  it('is absent before the first docking of a lander that waits at the Moon', () => {
    const plan = planOf([event('nrho-docking', 20)])
    expect(landerPresence(plan, 10)).toBe('absent')
    expect(landerPresence(plan, 20)).toBe('docked')
  })

  it('is absent once the capsule has left for home', () => {
    const plan = planOf([event('tei', 80, 'burn')])
    expect(landerPresence(plan, 79)).toBe('docked')
    expect(landerPresence(plan, 80)).toBe('absent')
    expect(landerPresence(plan, 100)).toBe('absent')
  })
})

describe('flightBurns', () => {
  it('keeps the burns, in the plan order', () => {
    const plan = planOf([event('tli', 5, 'burn'), event('nrho-docking', 20), event('tei', 80, 'burn')])
    expect(flightBurns(plan).map((e) => e.id)).toEqual(['tli', 'tei'])
  })
})

describe('trailFade', () => {
  it('draws nothing ahead of the craft', () => {
    expect(trailFade(-1, 3600)).toBe(0)
    expect(trailFade(-1, null)).toBe(0)
  })
  it('falls smoothly from 1 at the craft to 0 at the end of the trail', () => {
    expect(trailFade(0, 3600)).toBe(1)
    expect(trailFade(1800, 3600)).toBeCloseTo(0.5, 12)
    expect(trailFade(3600, 3600)).toBe(0)
    expect(trailFade(7200, 3600)).toBe(0)
    let prev = 1
    for (let s = 60; s <= 3600; s += 60) {
      const f = trailFade(s, 3600)
      expect(f).toBeLessThan(prev)
      prev = f
    }
  })
  it('keeps everything flown when no length is set', () => {
    expect(trailFade(1e9, null)).toBe(1)
  })
})

// ---- The landing-dispersion tube (dispersion.ts ring formula; NOT YET VALIDATED BY THE SCIENCE LEAD)
import { tubeSegments } from './flight'

describe('tubeSegments', () => {
  const pt = (z: number) => ({
    utcMs: z, center: [0, 0, z] as [number, number, number], mean: [0.5, 0, 0] as [number, number, number],
    axisMajor: [1, 0, 0] as [number, number, number], axisMinor: [0, 1, 0] as [number, number, number],
    sigmaMajorKm: 2, sigmaMinorKm: 1, sigmaAlongKm: 0,
  })
  it('puts the kσ ring at center + mean + k·σ along the two axes, and joins the rings with four ribs', () => {
    const tube = [pt(0), pt(10)]
    const segs = tubeSegments(tube, 3)
    // two rings of 32 segments and 4 ribs of 1 segment, 2 points × 3 numbers each
    expect(segs.length).toBe((2 * 32 + 4) * 6)
    // first point of the first ring: θ = 0 → center + mean + 3·2·major
    expect([segs[0], segs[1], segs[2]]).toEqual([6.5, 0, 0])
    // a quarter round: θ = 90° → 3·1·minor
    const q = 8 * 6 // segment 8 starts at θ = 90°
    expect(segs[q]).toBeCloseTo(0.5, 9)
    expect(segs[q + 1]).toBeCloseTo(3, 9)
    // every ring point lies on the ellipse ((x − 0.5) / 6)² + (y / 3)² = 1
    for (let i = 0; i < 2 * 32 * 2; i++) {
      const x = segs[3 * i] - 0.5
      const y = segs[3 * i + 1]
      expect((x / 6) ** 2 + (y / 3) ** 2).toBeCloseTo(1, 5)
    }
  })
})
