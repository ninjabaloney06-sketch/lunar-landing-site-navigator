// Nested terrain levels (levels.ts): synthetic tiles with known heights, so the expectations are exact.
import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { TerrainMeta, TerrainTile } from '../data/types'
import { heightAt, levelGrid, levelMesh, nestedLevels, normalsOf, place, sphereZ, stitch } from './levels'

const NODATA = -32768
function tile(level: TerrainMeta['level'], size: number, spacing: number, f: (x: number, y: number) => number, scale = 1): TerrainTile {
  const half = (size - 1) / 2
  const heights = new Int16Array(size * size)
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const v = f((j - half) * spacing, (half - i) * spacing)
      heights[i * size + j] = Number.isNaN(v) ? NODATA : Math.round(v / scale)
    }
  }
  const meta = { site_id: 'syn', size, spacing_m: spacing, order: '', height_ref: '', nodata: NODATA, illum_png: null, illum_map: null, illum_res_m: null, dem: '', level, height_scale_m: scale } as TerrainMeta
  return { meta, heights }
}

// A tilted plane (exactly representable at every level) plus a nodata quadrant in the 80 m tile.
const plane = (x: number, y: number) => 0.01 * x - 0.02 * y
const R = 1737400 + 1000

function set(withHole = false): TerrainTile {
  const base = tile(undefined, 50, 80, (x, y) => (withHole && x > 1000 && y > 1000 ? NaN : plane(x, y)))
  return {
    ...base,
    levels: [
      tile('fine', 41, 20, plane, 0.1),
      tile('mid', 31, 400, plane, 0.25),
      tile('far', 31, 2000, plane, 0.5),
    ],
  }
}

describe('nested levels', () => {
  it('orders the levels finest first and needs a far level', () => {
    expect(nestedLevels(set())!.map((l) => l.name)).toEqual(['fine', 'tile', 'mid', 'far'])
    const noFar = { ...set(), levels: set().levels!.filter((t) => t.meta.level !== 'far') }
    expect(nestedLevels(noFar)).toBeNull()
    expect(nestedLevels(tile(undefined, 50, 80, plane))).toBeNull()
  })

  it('applies the height scale, fills nodata from the next coarser level and morphs into it at the rim', () => {
    const levels = nestedLevels(set(true))!
    for (const [x, y] of [
      [0, 0],
      [300, -250],
      [1500, 1500], // inside the 80 m tile's nodata quadrant: filled from mid
      [1960, -1960], // 80 m tile rim
    ]) {
      const got = heightAt(levels, x, y)!
      expect(Math.abs(got.h - plane(x, y))).toBeLessThan(0.6) // the 80 m tile's 1 m rounding
    }
    expect(heightAt(levels, 1500, 1500)!.li).toBe(1) // the 80 m tile, now filled
  })

  it('stitches each pair of levels watertight: every rim edge is used by exactly one strip triangle', () => {
    const levels = nestedLevels(set())!
    const grids = levels.map((l) => levelGrid(l, R, () => Infinity))
    const meshes = levels.map((l, li) => levelMesh(grids[li], 1, li > 0 ? levels[li - 1].ext : null, 'touching'))
    for (let li = 1; li < levels.length; li++) {
      const strip = stitch(grids[li - 1], normalsOf(meshes[li - 1]), grids[li], normalsOf(meshes[li]))
      const idx = strip.index!.array
      const pos = strip.attributes.position.array
      const edges = new Map<string, number>()
      for (let t = 0; t < idx.length; t += 3) {
        for (let e = 0; e < 3; e++) {
          const a = idx[t + e]
          const b = idx[t + ((e + 1) % 3)]
          const k = a < b ? `${a}|${b}` : `${b}|${a}`
          edges.set(k, (edges.get(k) ?? 0) + 1)
        }
        // Faces up (counter-clockwise seen from above), so FrontSide draws them.
        const p = [0, 1, 2].map((e) => new Vector3().fromArray(pos as Float32Array, idx[t + e] * 3))
        const n = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]))
        expect(n.z).toBeGreaterThanOrEqual(0)
      }
      // Boundary edges of the strip (used once) are exactly the inner rim plus the outer hole rim.
      const once = [...edges.values()].filter((c) => c === 1).length
      const inner = 4 * (levels[li - 1].size - 1)
      const o = levels[li]
      const holeCells = 2 * Math.ceil(levels[li - 1].ext / o.spacing + o.half - 1e-6) - (o.size - 1)
      expect(once).toBe(inner + 4 * holeCells)
      // The outer mesh's hole is exactly that ring: its boundary edges include 4 × holeCells inner ones.
      expect(holeCells * o.spacing).toBeGreaterThanOrEqual(2 * levels[li - 1].ext)
      expect((holeCells - 2) * o.spacing).toBeLessThan(2 * levels[li - 1].ext)
      expect([...edges.values()].every((c) => c <= 2)).toBe(true)
    }
  })

  it('places fine and 80 m levels like the old tile and blends mid/far to the exact sphere point', () => {
    const levels = nestedLevels(set())!
    const v = new Vector3()
    place(levels[1], 3000, 4000, 50, R, v)
    expect(v.toArray()).toEqual([3000, 4000, sphereZ(5000, R, 50)])
    place(levels[3], 150_000, 0, 0, R, v)
    const s = R / Math.hypot(150_000, 1737400)
    expect(v.x).toBeCloseTo(s * 150_000, 3)
    expect(v.z).toBeCloseTo(s * 1737400 - R, 3)
    expect(Math.hypot(v.x, v.y, v.z + R)).toBeCloseTo(R, 3) // on the sphere through the site
    place(levels[2], 10_000, 0, 0, R, v)
    expect(v.toArray()).toEqual([10_000, 0, sphereZ(10_000, R, 0)]) // inside 20 km: unchanged placement
  })

  it('nests a near level (160 m) between the 80 m tile and mid, and stitches all five watertight (wave 3)', () => {
    const base = set()
    const five = { ...base, levels: [...base.levels!, tile('near', 41, 160, plane, 0.25)] }
    const levels = nestedLevels(five)!
    expect(levels.map((l) => l.name)).toEqual(['fine', 'tile', 'near', 'mid', 'far'])
    for (const [x, y] of [[2500, 0], [-3000, 1000], [0, -3150], [1900, 1900]]) {
      const got = heightAt(levels, x, y)!
      expect(Math.abs(got.h - plane(x, y)), `${x}, ${y}`).toBeLessThan(0.6)
    }
    expect(heightAt(levels, 2500, 0)!.li).toBe(2) // the near level answers between ±1960 and ±3200 m
    const grids = levels.map((l) => levelGrid(l, R, () => Infinity))
    const meshes = levels.map((l, li) => levelMesh(grids[li], 1, li > 0 ? levels[li - 1].ext : null, 'touching'))
    for (let li = 1; li < levels.length; li++) {
      const strip = stitch(grids[li - 1], normalsOf(meshes[li - 1]), grids[li], normalsOf(meshes[li]))
      const idx = strip.index!.array
      const edges = new Map<string, number>()
      for (let t = 0; t < idx.length; t += 3) {
        for (let e = 0; e < 3; e++) {
          const a = idx[t + e]
          const b = idx[t + ((e + 1) % 3)]
          const k = a < b ? `${a}|${b}` : `${b}|${a}`
          edges.set(k, (edges.get(k) ?? 0) + 1)
        }
      }
      const once = [...edges.values()].filter((c) => c === 1).length
      const o = levels[li]
      const holeCells = 2 * Math.ceil(levels[li - 1].ext / o.spacing + o.half - 1e-6) - (o.size - 1)
      expect(once, `${levels[li - 1].name} → ${o.name}`).toBe(4 * (levels[li - 1].size - 1) + 4 * holeCells)
    }
  })
})
