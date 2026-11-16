// The drawn sunlight (16 Nov: the terrain casts its own shadows; the tests of the crest strip and the 400 m site
// patch that stood here went with them). Kept from before: at the site the drawn share is the computed disc
// fraction, whatever the drawn terrain says; a sunlit site reads lit and a shadowed one shadowed; terrain away from
// the site is not dimmed by the site being in shadow. New: the site's correction is a smooth round falloff with no
// edge, and it is nothing at all where terrain and mask agree.
import { describe, expect, it } from 'vitest'
import type { Horizon, TerrainMeta, TerrainTile } from '../data/types'
import { enuDir } from './frames'
import { cOfShare, shareOfC } from './shadows'
import { SiteWorld } from './site'
import { SITE_BLEND_M, drawnC, siteWeight } from './sunlight'

const R = 0.267 // Sun's angular radius, deg
const NODATA = -32768
function tile(level: TerrainMeta['level'], size: number, spacing: number, f: (x: number, y: number) => number, scale = 1): TerrainTile {
  const heights = new Int16Array(size * size)
  const half = (size - 1) / 2
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) heights[i * size + j] = Math.round(f((j - half) * spacing, (half - i) * spacing) / scale)
  const meta = { site_id: 'syn', size, spacing_m: spacing, order: '', height_ref: '', nodata: NODATA, illum_png: null, illum_map: null, illum_res_m: null, dem: '', level, height_scale_m: scale } as TerrainMeta
  return { meta, heights }
}
/** A plain with a 600 m ridge running north–south 6 km east of the site, drawn by four nested levels. */
function world(horizon: Horizon | null = null): SiteWorld {
  const f = (x: number) => 600 * Math.max(1 - Math.abs(x - 6000) / 2000, 0)
  const base = tile(undefined, 501, 80, f)
  const t: TerrainTile = { ...base, levels: [tile('fine', 251, 20, f, 0.1), tile('mid', 301, 400, f, 0.25), tile('far', 301, 2000, f, 0.5)] }
  const w = new SiteWorld()
  w.build(horizon, t, 0)
  return w
}

describe('sunlight: the terrain casts its own shadows, the marker shows the computed answer', () => {
  it('behind a ridge toward the Sun the ground is in its shadow, beyond the ridge and far to the side of nothing it is lit', () => {
    const w = world()
    w.setLights(enuDir(90, 3), enuDir(0, 1), R) // Sun due east, 3° up: the ridge's shadow is 600 / tan 3° = 11.4 km long
    w.setLevels(0, 0)
    expect(shareOfC(w.terrainC(0, 0))).toBe(0) // 6 km behind the crest
    expect(shareOfC(w.terrainC(-3000, 4000))).toBe(0) // the ridge runs north–south: the shadow does too
    expect(shareOfC(w.terrainC(-9000, 0))).toBe(1) // 15 km behind the crest: past the shadow's end
    expect(shareOfC(w.terrainC(9000, 0))).toBe(1) // beyond the ridge, toward the Sun
    expect(shareOfC(w.terrainC(6500, -3000))).toBe(1) // the ridge's Sun-facing slope
  })

  it('a Sun high enough over the ridge lights everything', () => {
    const w = world()
    w.setLights(enuDir(90, 9), enuDir(0, 1), R) // the crest stands 5.7° above the site; its shadow ends 3.8 km behind it
    for (const [x, y] of [[0, 0], [1000, 1000], [-9000, 0], [9000, 0]]) expect(shareOfC(w.terrainC(x, y))).toBe(1)
  })

  it('at the site the drawn share is the computed one, whatever the drawn terrain gives there', () => {
    const w = world()
    w.setLights(enuDir(90, 3), enuDir(0, 1), R) // the drawn terrain shades the site
    for (const frac of [0, 0.3, 0.77, 1]) {
      w.setLevels(frac, 0)
      expect(w.sunShareAt(0, 0)).toBeCloseTo(frac, 9)
    }
    w.setLights(enuDir(90, 9), enuDir(0, 1), R) // the drawn terrain lights the site
    for (const frac of [0, 0.3, 0.77, 1]) {
      w.setLevels(frac, 0)
      expect(w.sunShareAt(0, 0)).toBeCloseTo(frac, 9)
    }
  })

  it('away from the site the terrain decides alone: a shadowed site does not dim sunlit ground, a sunlit site does not light a shadow', () => {
    const w = world()
    w.setLights(enuDir(90, 9), enuDir(0, 1), R) // everything lit by the terrain
    w.setLevels(0, 0) // the mask says the site is in shadow
    expect(w.sunShareAt(0, 0)).toBe(0)
    expect(w.sunShareAt(0, 2000)).toBe(1)
    expect(w.sunShareAt(-25_000, 3000)).toBe(1)
    w.setLights(enuDir(90, 3), enuDir(0, 1), R) // the site and its surroundings in the ridge's shadow
    w.setLevels(1, 0) // the mask says the site is lit
    expect(w.sunShareAt(0, 0)).toBe(1)
    expect(w.sunShareAt(0, 2000)).toBe(0)
    expect(w.sunShareAt(3000, -1000)).toBe(0)
  })

  it('where terrain and mask agree the correction is nothing', () => {
    const w = world()
    w.setLights(enuDir(90, 3), enuDir(0, 1), R)
    w.setLevels(0, 0)
    for (const [x, y] of [[100, 0], [0, -250], [400, 300], [-700, 100]]) expect(w.sunShareAt(x, y)).toBe(shareOfC(w.terrainC(x, y)))
  })
})

describe('sunlight: the site correction has no edge', () => {
  it('its weight is 1 at the site and falls smoothly to nothing: no step between points 10 m apart, in any case', () => {
    expect(siteWeight(0)).toBe(1)
    expect(siteWeight(SITE_BLEND_M)).toBeCloseTo(Math.exp(-1), 12)
    expect(siteWeight(4 * SITE_BLEND_M)).toBeLessThan(1e-6)
    // The largest disagreement there can be: the terrain says all of the disc, the mask none, or the reverse.
    for (const [terrain, site] of [[-1, 1], [1, -1], [-1, 0], [0.4, -0.7]]) {
      let prev: number | null = null
      let worst = 0
      for (let r = 0; r <= 2000; r += 10) {
        const v = shareOfC(drawnC(terrain, terrain, site, r))
        if (prev !== null) worst = Math.max(worst, Math.abs(v - prev))
        prev = v
      }
      expect(worst, `terrain ${terrain}, mask ${site}`).toBeLessThan(0.05)
      expect(prev).toBeCloseTo(shareOfC(terrain), 9) // 2 km out: the terrain's own share
    }
  })

  it('it shifts the terrain shadow edge instead of painting over it: the order of two points across an edge is kept', () => {
    // Two points 50 m apart near the site, one deeper in the terrain's penumbra than the other.
    for (const cSite of [-1, -0.2, 0.5, 1]) {
      const a = drawnC(0.3, 0.1, cSite, 100)
      const b = drawnC(0.5, 0.1, cSite, 150)
      expect(b).toBeGreaterThanOrEqual(a)
    }
    expect(cOfShare(0.5)).toBeCloseTo(0, 9)
  })
})
