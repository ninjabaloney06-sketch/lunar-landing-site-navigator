// Terrain shadows from the terrain itself, on the CPU: the reference the GPU shadow pass (shadowmap.ts) is checked
// against, the debug API's sunShareAt, and the unit tests. No WebGL here.
//
// The height field is the DRAWN terrain: the nested levels' placed and clamped vertices (levels.ts levelGrid), in
// the site's local frame (ENU, metres, origin at the site's ground point). z is the height above the site's
// tangent plane, so the Moon's curvature is in the data: ground at horizontal distance d lies d²/2R lower
// (levels.ts sphereZ, exact form), and a ray toward the Sun is a straight line. A ridge 100 km away must stand
// 2.9 km above the site's level before it shows over the horizon at all.
//
// Horizontal position: a level's grid offset (x, y). Within 20 km that is the vertex's own ENU position; beyond it
// the levels blend to a radial placement (levels.ts place) that moves a vertex by up to 0.06 % of its distance at
// 60 km and 1.5 % at 300 km. The shadow geometry ignores that shift (rays are straight in grid offsets); the shader
// maps a fragment back to its grid offset (site.ts), so a shadow lies on the terrain that casts it.
//
// horizonTan is the horizon the terrain makes at one ground point toward one azimuth, and sunC puts the Sun's disc
// against it: the same quantity as geometry.discFraction at the site, here for any point of the drawn terrain.

import { Vector3 } from 'three'
import { OBSERVER_HEIGHT_M, discFraction } from '../geometry'
import { azElOfEnu, enuDir } from './frames'
import type { LevelGrid } from './levels'

export interface ShadowLevel {
  /** Samples a side. */
  n: number
  /** Sample spacing, m. */
  spacing: number
  /** Half-width of the sample square, m: sample (i, j) is at x = j · spacing − ext, y = ext − i · spacing. */
  ext: number
  /** Drawn height (ENU z, m) of every sample, row-major, row 0 = north. */
  z: Float32Array
}

/** Shadow levels (finest first) of the drawn level grids. A vertex without data takes `fill(x, y)`. */
export function shadowLevels(grids: LevelGrid[], fill: (x: number, y: number) => number): ShadowLevel[] {
  return grids.map((g) => {
    const l = g.level
    const n = l.size
    const z = new Float32Array(n * n)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = i * n + j
        z[v] = g.ok[v] ? g.pos[v * 3 + 2] : fill((j - l.half) * l.spacing, (l.half - i) * l.spacing)
      }
    }
    return { n, spacing: l.spacing, ext: l.ext, z }
  })
}

/** Bilinear height of one level at (x, y); null outside its square. */
export function levelZ(l: ShadowLevel, x: number, y: number): number | null {
  const fj = (x + l.ext) / l.spacing
  const fi = (l.ext - y) / l.spacing
  if (fj < 0 || fi < 0 || fj > l.n - 1 || fi > l.n - 1) return null
  const j0 = Math.min(Math.floor(fj), l.n - 2)
  const i0 = Math.min(Math.floor(fi), l.n - 2)
  const dj = fj - j0
  const di = fi - i0
  const o = i0 * l.n + j0
  const z = l.z
  return (z[o] * (1 - dj) + z[o + 1] * dj) * (1 - di) + (z[o + l.n] * (1 - dj) + z[o + l.n + 1] * dj) * di
}

/** Height of the finest level that covers (x, y), with its index; null outside every level. */
export function shadowZ(levels: ShadowLevel[], x: number, y: number): { z: number; li: number } | null {
  for (let li = 0; li < levels.length; li++) {
    const z = levelZ(levels[li], x, y)
    if (z !== null) return { z, li }
  }
  return null
}

/**
 * Tangent of the terrain's horizon elevation seen from (x, y, z0) toward the unit horizontal direction (dx, dy):
 * the largest (height − z0) / distance over the terrain along that line, sampled every quarter spacing of the finest
 * level there, out to the edge of the coarsest level. −Infinity without terrain ahead.
 */
export function horizonTan(levels: ShadowLevel[], x: number, y: number, z0: number, dx: number, dy: number): number {
  let best = -Infinity
  let t = 0
  let li = shadowZ(levels, x, y)?.li ?? levels.length - 1
  for (let guard = 0; guard < 100_000 && levels.length; guard++) {
    t += 0.25 * levels[li].spacing
    const hit = shadowZ(levels, x + t * dx, y + t * dy)
    if (!hit) break
    li = hit.li
    const s = (hit.z - z0) / t
    if (s > best) best = s
  }
  return best
}

/**
 * Where the Sun's disc stands against the terrain's horizon seen from an eye OBSERVER_HEIGHT_M above the ground
 * point (x, y): c = (horizon elevation − Sun elevation) / the disc's angular radius, limited to −1 (the whole disc
 * above the terrain) … +1 (all of it below). `sun` is the unit direction to the Sun in the site's ENU frame.
 * Outside every level: −1 (no terrain known, no shadow).
 */
export function sunC(levels: ShadowLevel[], x: number, y: number, sun: Vector3, angRadDeg: number): number {
  const ground = shadowZ(levels, x, y)
  if (!ground) return -1
  const hl = Math.hypot(sun.x, sun.y)
  if (hl < 1e-9) return -1
  const tan = horizonTan(levels, x, y, ground.z + OBSERVER_HEIGHT_M, sun.x / hl, sun.y / hl)
  if (tan === -Infinity) return -1
  const horizon = azElOfEnu(new Vector3(sun.x / hl, sun.y / hl, tan)).el
  const c = (horizon - azElOfEnu(sun).el) / angRadDeg
  return Math.min(Math.max(c, -1), 1)
}

/** Share of the disc above a straight horizon for c as in sunC: geometry.discFraction, the app's own formula. */
export function shareOfC(c: number): number {
  return discFraction(-c, 0, 1)
}

/** The c that gives a share (the inverse of shareOfC, by bisection; share 1 → −1, share 0 → +1). */
export function cOfShare(share: number): number {
  if (share >= 1) return -1
  if (share <= 0) return 1
  let lo = -1
  let hi = 1
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2
    if (shareOfC(mid) > share) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Tangents of the elevation of the Sun's lower limb, centre and upper limb (the three rays the GPU pass follows). */
export function limbTans(sun: Vector3, angRadDeg: number): [number, number, number] {
  const { az, el } = azElOfEnu(sun)
  const t = (e: number) => {
    const d = enuDir(az, e)
    return d.z / Math.hypot(d.x, d.y)
  }
  return [t(el - angRadDeg), t(el), t(el + angRadDeg)]
}

/**
 * The GPU pass's c from its three shadow clearances (shadowmap.ts): d[k] = height of the shadow boundary above the
 * eye for the ray toward the lower limb, the centre and the upper limb (positive: that ray is blocked). The whole
 * disc is visible when even the lower limb's ray is free, hidden when the upper limb's is blocked; in between the
 * horizon is where the clearance crosses zero, linear between the three rays. The GLSL in site.ts is this function.
 */
export function cOfClearances(lower: number, centre: number, upper: number): number {
  if (upper >= 0) return 1
  if (lower <= 0) return -1
  return centre > 0 ? centre / (centre - upper) : -1 + lower / (lower - centre)
}

/** Steps a GPU pass looks ahead, counting the sample itself: each pass multiplies the reach by this. */
export const SHADOW_RADIX = 4

/**
 * The step length (in sample spacings) of every pass for a level of n samples a side. The first pass looks 1 …
 * RADIX − 1 spacings ahead; each later pass steps by the reach so far, which multiplies it by RADIX, until the
 * reach covers the level's diagonal.
 */
export function shadowPasses(n: number): number[] {
  const jumps = [1]
  let reach = SHADOW_RADIX - 1
  while (reach < Math.SQRT2 * (n - 1)) {
    jumps.push(reach)
    reach *= SHADOW_RADIX
  }
  return jumps
}

/**
 * The GPU pass on the CPU (shadowmap.ts runs the same recursion per texel in a fragment shader), for one level:
 * D[k] = S′ − z per sample, where S′ is the height of the shadow boundary there for ray k (tangent tans[k]): the
 * highest of height(occluder) − distance · tan over every occluder ahead toward the Sun. The first pass looks up
 * to RADIX − 1 spacings ahead; each later pass multiplies the reach m by RADIX:
 * S′(x) = max over k = 0 … RADIX − 1 of S′ₘ(x + k·m·s·dir) − k·m·s·tan. A step that leaves the level's square
 * takes the next coarser level's finished result at the point where the ray leaves (`coarse`, with its level),
 * which already holds everything beyond; without one there is nothing beyond.
 */
export function propagate(
  l: ShadowLevel,
  dx: number,
  dy: number,
  tans: readonly number[],
  coarse: { level: ShadowLevel; d: Float32Array } | null,
): Float32Array {
  const n = l.n
  const ch = tans.length
  const NONE = -30000
  let prev = new Float32Array(n * n * ch).fill(NONE)
  let next = new Float32Array(n * n * ch)
  const bil = (lv: ShadowLevel, a: Float32Array, stride: number, k: number, x: number, y: number): number => {
    const fj = Math.min(Math.max((x + lv.ext) / lv.spacing, 0), lv.n - 1)
    const fi = Math.min(Math.max((lv.ext - y) / lv.spacing, 0), lv.n - 1)
    const j0 = Math.min(Math.floor(fj), lv.n - 2)
    const i0 = Math.min(Math.floor(fi), lv.n - 2)
    const dj = fj - j0
    const di = fi - i0
    const o = (i0 * lv.n + j0) * stride + k
    return (a[o] * (1 - dj) + a[o + stride] * dj) * (1 - di) + (a[o + lv.n * stride] * (1 - dj) + a[o + (lv.n + 1) * stride] * dj) * di
  }
  const best = new Float64Array(ch)
  shadowPasses(n).forEach((jumpCells, p) => {
    const first = p === 0
    const jump = l.spacing * jumpCells
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = j * l.spacing - l.ext
        const y = l.ext - i * l.spacing
        const v = i * n + j
        best.fill(-1e9)
        for (let step = 1; step < SHADOW_RADIX; step++) {
          const t = step * jump
          const qx = x + t * dx
          const qy = y + t * dy
          if (Math.max(Math.abs(qx), Math.abs(qy)) <= l.ext) {
            const hq = bil(l, l.z, 1, 0, qx, qy)
            for (let k = 0; k < ch; k++) best[k] = Math.max(best[k], hq + (first ? 0 : bil(l, prev, ch, k, qx, qy)) - t * tans[k])
            continue
          }
          if (coarse) {
            const tx = dx !== 0 ? (Math.sign(dx) * l.ext - x) / dx : Infinity
            const ty = dy !== 0 ? (Math.sign(dy) * l.ext - y) / dy : Infinity
            const tExit = Math.max(Math.min(tx, ty), 0)
            const ex = x + tExit * dx
            const ey = y + tExit * dy
            const hq = bil(coarse.level, coarse.level.z, 1, 0, ex, ey)
            for (let k = 0; k < ch; k++) best[k] = Math.max(best[k], hq + Math.max(bil(coarse.level, coarse.d, ch, k, ex, ey), 0) - tExit * tans[k])
          }
          break // every farther step leaves the square too
        }
        for (let k = 0; k < ch; k++) {
          const d = best[k] - l.z[v]
          next[v * ch + k] = Math.min(Math.max(first ? d : Math.max(prev[v * ch + k], d), NONE), 30000)
        }
      }
    }
    ;[prev, next] = [next, prev]
  })
  return prev
}
