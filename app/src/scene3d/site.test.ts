// U5 / U19 regression: the ground the camera stands on (SiteWorld.groundZ) is the drawn terrain, not the bilinear
// height of the data. Synthetic levels with strongly twisted quads (a checkerboard of heights), so the drawn
// triangles lie far above the bilinear surface at the cell centres, as measured on the real tiles (u19 report).
import { describe, expect, it } from 'vitest'
import type { TerrainMeta, TerrainTile } from '../data/types'
import { OBSERVER_HEIGHT_M } from '../geometry'
import { heightAt, nestedLevels, place } from './levels'
import { SiteWorld } from './site'
import { Vector3 } from 'three'

const NODATA = -32768
function tile(level: TerrainMeta['level'], size: number, spacing: number, f: (i: number, j: number) => number, scale = 1): TerrainTile {
  const heights = new Int16Array(size * size)
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) heights[i * size + j] = Math.round(f(i, j) / scale)
  const meta = { site_id: 'syn', size, spacing_m: spacing, order: '', height_ref: '', nodata: NODATA, illum_png: null, illum_map: null, illum_res_m: null, dem: '', level, height_scale_m: scale } as TerrainMeta
  return { meta, heights }
}

// Checkerboard relief: every quad twisted by 4 × amp (NE and SW corners high, NW and SE low, or the reverse).
const checker = (amp: number) => (i: number, j: number) => ((i + j) % 2 === 0 ? -amp : amp)

function world(): SiteWorld {
  const base = tile(undefined, 50, 80, checker(6)) // even size, like the south-cap 80 m grid: the origin is a cell centre
  const t: TerrainTile = {
    ...base,
    levels: [tile('fine', 41, 20, checker(1), 0.1), tile('mid', 31, 400, checker(20), 0.25), tile('far', 31, 2000, checker(60), 0.5)],
  }
  const w = new SiteWorld()
  w.build(null, t, 1000)
  return w
}

// Deterministic points from the site out to 28 km, with every level and the strips between them.
function points(n: number): [number, number][] {
  const out: [number, number][] = []
  let s = 7
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let k = 0; k < n; k++) {
    const r = 28_000 * rnd() ** 2 // the far level reaches ±30 km
    const a = 2 * Math.PI * rnd()
    out.push([r * Math.cos(a), r * Math.sin(a)])
  }
  return out
}

describe('eye-level ground (U5, U19)', () => {
  it('groundZ is the drawn terrain under the point, at every level and in the strips between them', () => {
    const w = world()
    for (const [x, y] of points(160)) {
      const drawn = w.drawnZ(x, y)
      expect(drawn, `${x.toFixed(0)}, ${y.toFixed(0)} has terrain`).not.toBeNull()
      expect(Math.abs(w.groundZ(x, y) - drawn!), `${x.toFixed(0)}, ${y.toFixed(0)}`).toBeLessThan(1e-3)
    }
  })

  it('the bilinear data height, which the camera used before, lies inside the drawn ground by more than eye height', () => {
    const w = world()
    const levels = nestedLevels({ ...tile(undefined, 50, 80, checker(6)), levels: [tile('fine', 41, 20, checker(1), 0.1), tile('mid', 31, 400, checker(20), 0.25), tile('far', 31, 2000, checker(60), 0.5)] })!
    const rSite = 1737400 + 1000
    let worst = 0
    for (const [x, y] of points(160)) {
      const f = heightAt(levels, x, y)!
      const bilinear = place(levels[f.li], x, y, f.h, rSite, new Vector3()).z
      worst = Math.max(worst, w.drawnZ(x, y)! - bilinear)
    }
    expect(worst).toBeGreaterThan(OBSERVER_HEIGHT_M)
  })

  it('the 80 m tile alone (no far level): groundZ is its drawn triangles too', () => {
    const w = new SiteWorld()
    w.build(null, tile(undefined, 50, 80, checker(6)), 0)
    for (const [x, y] of points(60).map(([x, y]) => [x / 16, y / 16])) {
      expect(Math.abs(w.groundZ(x, y) - w.drawnZ(x, y)!), `${x.toFixed(0)}, ${y.toFixed(0)}`).toBeLessThan(1e-3)
    }
  })
})
