// Terrain shadows on synthetic terrain (16 Nov): a flat plain casts none, the Moon's curvature alone hides a Sun
// below the local horizontal and ends that shadow where the ground has turned far enough toward the Sun, a ridge
// casts a shadow of the length the Sun's elevation and the curvature give, and the GPU pass's recursion
// (propagate, the same arithmetic as shadowmap.ts) agrees with the direct march along the ray.
import { describe, expect, it } from 'vitest'
import { MOON_RADIUS_KM, OBSERVER_HEIGHT_M } from '../geometry'
import { enuDir } from './frames'
import { sphereZ } from './levels'
import { cOfClearances, cOfShare, horizonTan, limbTans, propagate, shadowZ, shareOfC, sunC, type ShadowLevel } from './shadows'

const R = MOON_RADIUS_KM * 1000
const SUN_R = 0.267 // the Sun's angular radius, deg

/** A level whose height is f(x, y) at every sample. */
function level(n: number, spacing: number, f: (x: number, y: number) => number): ShadowLevel {
  const ext = ((n - 1) / 2) * spacing
  const z = new Float32Array(n * n)
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) z[i * n + j] = f(j * spacing - ext, ext - i * spacing)
  return { n, spacing, ext, z }
}
const sphere = (x: number, y: number) => sphereZ(Math.hypot(x, y), R)
/** A straight ridge along north–south at x = x0: `height` at the crest, down to nothing halfWidth either side. */
const ridge = (x0: number, height: number, halfWidth: number) => (x: number, y: number) =>
  sphere(x, y) + height * Math.max(1 - Math.abs(x - x0) / halfWidth, 0)

describe('terrain shadows: the direct march', () => {
  it('a flat plain (no curvature) casts no shadow for a Sun above it, at any azimuth', () => {
    const flat = [level(201, 100, () => 0)]
    for (const az of [0, 37, 90, 200, 315]) {
      for (const el of [0.4, 1, 5]) {
        for (const [x, y] of [[0, 0], [3000, -2000], [-9000, 9000]]) expect(sunC(flat, x, y, enuDir(az, el), SUN_R)).toBe(-1)
      }
    }
  })

  it('the smooth Moon: lit under a Sun above the horizontal; under a Sun 1 deg below it the ground is dark until it has turned 1 deg toward the Sun', () => {
    const moon = [level(301, 400, sphere)]
    expect(sunC(moon, 0, 0, enuDir(90, 1), SUN_R)).toBe(-1)
    const sun = enuDir(90, -1)
    expect(sunC(moon, 0, 0, sun, SUN_R)).toBe(1)
    // The Sun's centre is on the local horizontal where the ground has turned by 1 deg: d = R sin(1 deg) toward the
    // Sun (the eye's 1.75 m lowers its horizon by 0.08 deg, so the half-lit point is a little nearer).
    const d = R * Math.sin(Math.PI / 180)
    expect(sunC(moon, d - 12_000, 0, sun, SUN_R)).toBe(1)
    expect(sunC(moon, d + 12_000, 0, sun, SUN_R)).toBe(-1)
    const c = sunC(moon, d, 0, sun, SUN_R)
    expect(c).toBeGreaterThan(-0.6)
    expect(c).toBeLessThan(0.1)
  })

  it('a 1 km ridge 40 km toward a Sun at 1 deg: on a plane its shadow is 57 km long, on the Moon it ends 32 km behind the ridge', () => {
    const x0 = 40_000
    const tan1 = Math.tan(Math.PI / 180)
    // Plane: the shadow of the crest reaches x0 - 1000 / tan(1 deg) = -17.3 km (the eye's 1.75 m shortens it by 100 m).
    const plane = [level(301, 400, (x, y) => ridge(x0, 1000, 800)(x, y) - sphere(x, y))]
    const sun = enuDir(90, 1)
    expect(sunC(plane, 0, 0, sun, SUN_R)).toBe(1) // the umbra: the crest stands more than 1.27 deg high within 45 km
    expect(Math.abs(sunC(plane, -17_290 + 100, 0, sun, SUN_R))).toBeLessThan(0.15) // 0.15 of the disc radius: 0.04 deg
    expect(sunC(plane, -45_000, 0, sun, SUN_R)).toBe(-1) // and less than 0.73 deg beyond 78 km
    // Moon: the ray over the crest, z = z_crest - (x0 - x) tan(1 deg), meets the eye 1.75 m above the curved ground
    // at x_end, solved here by bisection on the exact sphere.
    const moon = [level(301, 400, ridge(x0, 1000, 800))]
    const zCrest = sphere(x0, 0) + 1000
    let lo = -30_000
    let hi = x0 - 1000
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2
      if (zCrest - (x0 - mid) * tan1 > sphere(mid, 0) + OBSERVER_HEIGHT_M) hi = mid
      else lo = mid
    }
    expect(lo).toBeGreaterThan(7000) // about 8 km: the plane's answer is 25 km farther
    expect(lo).toBeLessThan(9000)
    expect(Math.abs(sunC(moon, lo, 0, sun, SUN_R))).toBeLessThan(0.15)
    expect(sunC(moon, 30_000, 0, sun, SUN_R)).toBe(1) // close behind the ridge
    expect(sunC(moon, -17_000, 0, sun, SUN_R)).toBe(-1) // where the plane's shadow would still be
    // The edge is a penumbra, not a step: the share rises steadily across it.
    let prev = 0
    for (let x = lo + 6000; x >= lo - 6000; x -= 500) {
      const s = shareOfC(sunC(moon, x, 0, sun, SUN_R))
      expect(s).toBeGreaterThanOrEqual(prev - 1e-9)
      expect(s - prev).toBeLessThan(0.2)
      prev = s
    }
    expect(prev).toBeGreaterThan(0.9)
  })

  it('nested levels: the finest level that covers a point is the one marched, and the result joins across the border', () => {
    const f = ridge(12_000, 600, 3200)
    const levels = [level(101, 100, f), level(301, 400, f)] // +-5 km inside +-60 km
    expect(shadowZ(levels, 1000, 0)!.li).toBe(0)
    expect(shadowZ(levels, 7000, 0)!.li).toBe(1)
    const sun = enuDir(90, 2)
    const one = [level(301, 400, f)]
    for (const x of [-4000, 0, 3000, 4900, 5100, 8000]) {
      expect(Math.abs(sunC(levels, x, 0, sun, SUN_R) - sunC(one, x, 0, sun, SUN_R)), `x ${x}`).toBeLessThan(0.15)
    }
  })

  it('share and c are inverse to each other', () => {
    for (const s of [0, 0.01, 0.3, 0.5, 0.77, 1]) expect(shareOfC(cOfShare(s))).toBeCloseTo(s, 9)
    expect(shareOfC(0)).toBeCloseTo(0.5, 12)
  })

  it('one occluder: the horizon is its top seen from the eye', () => {
    // A wall 100 m high 1 km ahead on a plane: horizon tangent (100 - 1.75) / 1000.
    const wall = [level(201, 50, (x) => (Math.abs(x - 1000) < 25 ? 100 : 0))]
    expect(horizonTan(wall, 0, 0, OBSERVER_HEIGHT_M, 1, 0)).toBeCloseTo(98.25 / 1000, 6)
  })
})

describe('terrain shadows: the GPU pass recursion against the direct march', () => {
  // Rolling relief with two peaks, two nested levels, the Sun off the grid axes.
  const relief = (x: number, y: number) =>
    sphere(x, y) +
    300 * Math.sin(x / 2100) * Math.cos(y / 1700) +
    500 * Math.exp(-((x - 9000) ** 2 + (y - 4000) ** 2) / 1500 ** 2) +
    800 * Math.exp(-((x + 15000) ** 2 + (y + 22000) ** 2) / 4000 ** 2)
  const fine = level(121, 100, relief) // +-6 km
  const coarse = level(151, 400, relief) // +-30 km
  const levels = [fine, coarse]

  for (const [az, el] of [[63, 1.2], [200, 0.3], [301, 3]]) {
    it(`Sun at azimuth ${az}, elevation ${el}`, () => {
      const sun = enuDir(az, el)
      const hl = Math.hypot(sun.x, sun.y)
      const tans = limbTans(sun, SUN_R)
      const dC = propagate(coarse, sun.x / hl, sun.y / hl, tans, null)
      const dF = propagate(fine, sun.x / hl, sun.y / hl, tans, { level: coarse, d: dC })
      let worst = 0
      let sum = 0
      let count = 0
      let flips = 0
      const check = (l: ShadowLevel, d: Float32Array, from: number, to: number) => {
        for (let i = from; i < to; i += 7) {
          for (let j = from; j < to; j += 7) {
            const x = j * l.spacing - l.ext
            const y = l.ext - i * l.spacing
            const o = (i * l.n + j) * 3
            const gpu = cOfClearances(d[o] - OBSERVER_HEIGHT_M, d[o + 1] - OBSERVER_HEIGHT_M, d[o + 2] - OBSERVER_HEIGHT_M)
            // The reference at the level's own resolution (the pass sees each level's own heights).
            const ref = l === fine ? sunC(levels, x, y, sun, SUN_R) : sunC([coarse], x, y, sun, SUN_R)
            const e = Math.abs(shareOfC(gpu) - shareOfC(ref))
            worst = Math.max(worst, e)
            sum += e
            count++
            if (e > 0.5) flips++
          }
        }
      }
      check(fine, dF, 3, fine.n - 3)
      check(coarse, dC, 3, coarse.n - 3)
      console.log(`az ${az} el ${el}: ${count} points, mean |share difference| ${(sum / count).toFixed(4)}, worst ${worst.toFixed(3)}, flips ${flips}`)
      expect(count).toBeGreaterThan(500)
      expect(sum / count, 'mean difference of the Sun share').toBeLessThan(0.02)
      expect(flips / count, 'points lit in one and dark in the other').toBeLessThan(0.01)
    })
  }
})
