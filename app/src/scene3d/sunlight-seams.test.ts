// Terrain shadows at all 18 sites with the sites' real terrain, horizon and ephemeris files (16 Nov; before: the
// seam check of the crest strip and the 400 m site patch, both gone). Three things per site, over the default
// period 16–29 Aug 2027:
//   1. At the marker the drawn share is the site's computed disc fraction, at every half hour.
//   2. How often the terrain's own shadow at the marker (before the site's correction) and the computed mask
//      disagree about lit / not lit: the drawn terrain is coarser than the mask's DEM and clamped under the mask's
//      sight lines, so it can only be late into a shadow or early out of one. Measured and bounded; the numbers
//      are printed at the end (npx vitest run src/scene3d/sunlight-seams.test.ts).
//   3. No seam at a level border: on the edge of every level's square the level itself and the next coarser one
//      give nearly the same share (the shader fades one into the other over the band inside the edge, site.ts), so
//      there is nothing for a border to show.
import { afterAll, describe, expect, it } from 'vitest'
import type { EphemMonth, Horizon, Site, TerrainMeta, TerrainTile } from '../data/types'
import { OBSERVER_HEIGHT_M, SUN_RADIUS_KM, angRadiusDeg, azEl, discFraction, enuBasis, interpolate, maskAt, siteVector } from '../geometry'
import { enuDir } from './frames'
import { shareOfC } from './shadows'
import { SiteWorld } from './site'

// The data files from disk, as src/data/southcap.test.ts reads them (height grids: little-endian Int16).
const DATA = new URL('../../public/data/', import.meta.url)
const fsName = 'node:fs/promises'
const disk = (await import(/* @vite-ignore */ fsName)) as { readFile(u: URL): Promise<{ buffer: ArrayBuffer; byteOffset: number; byteLength: number; toString(e: string): string }> }
const json = async <T>(p: string): Promise<T> => JSON.parse((await disk.readFile(new URL(p, DATA))).toString('utf8')) as T
async function grid(name: string): Promise<TerrainTile> {
  const meta = await json<TerrainMeta>(`terrain/${name}.json`)
  const b = await disk.readFile(new URL(`terrain/${name}.bin`, DATA))
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const heights = new Int16Array(meta.size * meta.size)
  expect(b.byteLength).toBe(heights.length * 2)
  for (let k = 0; k < heights.length; k++) heights[k] = view.getInt16(k * 2, true)
  return { meta, heights }
}
async function terrain(id: string): Promise<TerrainTile> {
  const base = await grid(id)
  return { ...base, levels: await Promise.all((base.meta.levels ?? []).map((l) => grid(`${id}-${l}`))) }
}

const sites = await json<Site[]>('sites.json')
const months = await Promise.all(['2027-08', '2027-09'].map((k) => json<EphemMonth>(`ephem/${k}.json`)))
const T0 = Date.parse('2027-08-16T00:00:00Z')
const T1 = Date.parse('2027-08-30T00:00:00Z')
const HALF_HOUR = 30 * 60_000
/**
 * Share of the half hours at which the terrain's own shadow at the marker may disagree with the mask. Measured
 * 16 Nov (672 half hours per site): 0 at five sites, 0.1–3.9 % at twelve, 12.9 % at malapert-site23 (longest run
 * 28 h); every one of them the drawn terrain lit while the mask says shadow, none the other way round.
 */
const DISAGREE_MAX = 0.15
const report: Record<string, unknown> = {}

describe('terrain shadows at all 18 sites: the marker shows the computed answer, level borders do not show', () => {
  afterAll(() => {
    console.log('terrain shadow against mask at the marker, and level borders:')
    for (const [id, r] of Object.entries(report)) console.log(id, JSON.stringify(r))
  })
  it('there are 18 sites', () => expect(sites.length).toBe(18))

  for (const s of sites) {
    it(s.id, async () => {
      const horizon = s.horizon ? await json<Horizon>(`horizons/${s.horizon}`) : null
      const w = new SiteWorld()
      w.build(horizon, await terrain(s.id), s.elev_m)
      const eye = siteVector(s.lat, s.lon, ((s.elev_m ?? 0) + OBSERVER_HEIGHT_M) / 1000)
      const enu = enuBasis(s.lat, s.lon)
      const at = (t: number) => {
        const a = azEl(interpolate(months, t).sun_km, eye, enu)
        const r = angRadiusDeg(SUN_RADIUS_KM, a.dist_km)
        w.setLights(enuDir(a.az, a.el), enuDir(a.az, a.el), r)
        return discFraction(a.el, maskAt(horizon, a.az), r)
      }

      // 1 and 2
      let n = 0
      let disagree = 0
      let terrainLitMaskDark = 0
      let sumDiff = 0
      let run = 0
      let longest = 0
      for (let t = T0; t < T1; t += HALF_HOUR) {
        const frac = at(t)
        w.setLevels(frac, 0)
        expect(w.sunShareAt(0, 0), new Date(t).toISOString()).toBeCloseTo(frac, 9)
        const own = shareOfC(w.terrainC(0, 0))
        n++
        sumDiff += Math.abs(own - frac)
        if (own > 0 !== frac > 0) {
          disagree++
          if (own > 0) terrainLitMaskDark++
          run++
          longest = Math.max(longest, run)
        } else run = 0
      }

      // 3
      const specs = w.shadowInfo().levels
      const steps: number[] = []
      for (let t = T0; t < T1; t += 84 * HALF_HOUR) {
        at(t)
        for (let li = 0; li + 1 < specs.length; li++) {
          const e = specs[li].ext
          for (let k = 0; k < 16; k++) {
            const u = ((k + 0.5) / 16) * 2 - 1
            const [x, y] = k % 4 === 0 ? [u * e, e] : k % 4 === 1 ? [e, u * e] : k % 4 === 2 ? [u * e, -e] : [-e, u * e]
            steps.push(Math.abs(shareOfC(w.terrainC(x, y, li)) - shareOfC(w.terrainC(x, y, li + 1))))
          }
        }
      }
      steps.sort((a, b) => a - b)
      const mean = steps.reduce((a, b) => a + b, 0) / steps.length
      const p90 = steps[Math.floor(steps.length * 0.9)]
      report[s.id] = {
        halfHours: n,
        disagree: +(disagree / n).toFixed(4),
        terrainLitMaskDark: +(terrainLitMaskDark / n).toFixed(4),
        longestRunHours: longest / 2,
        meanShareDifference: +(sumDiff / n).toFixed(4),
        borderPoints: steps.length,
        borderMean: +mean.toFixed(4),
        borderP90: +p90.toFixed(4),
        borderMax: +steps[steps.length - 1].toFixed(4),
      }
      expect(disagree / n, 'share of the period where terrain and mask disagree at the marker').toBeLessThanOrEqual(DISAGREE_MAX)
      expect(mean, 'mean share difference between a level and the next coarser one on its edge').toBeLessThan(0.03)
      expect(p90, '90 % of the border points').toBeLessThan(0.1)
    })
  }
})
