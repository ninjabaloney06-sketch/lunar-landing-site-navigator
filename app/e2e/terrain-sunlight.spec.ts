// Bug of 15 Nov night (science lead): "It remains dark even though the Sun is above the terrain." Measured before the
// fix (default landing-site view, mean luminance 0..255 of the ground around the marker, page background ≈ 13):
// Connecting Ridge sunlit (disc 100 %) 16–28 Aug 2027: 11–27, darker than Shackleton Rim Site04 in shadow (13–14).
// Two causes: the polar Sun grazes level ground (Lambert N·L of a few per cent, below zero where the Sun is under the
// site's horizontal plane but above its mask), and one light level for the whole scene took the site's own share,
// so terrain the Sun reaches was dimmed whenever the site was in shadow. sunlight.ts and the site.ts shader now
// shade per fragment; the site's computed disc fraction stays the number at the site.
// 16 Nov: the terrain casts its own shadows (shadowmap.ts) instead of one crest shading a strip. Changed here with
// it: the ground is measured in a small box at the marker's foot (groundLum: a sunlit ridge site has real shadow
// 100 m from it, so the old 160 × 80 px box now holds mostly shadow), the shadowed ground's level (the scattered
// light of site.ts instead of 12 % of the Sun: below 45 instead of below 30, and still under half of sunlit ground), and "terrain off the strip keeps the Sun" (the share exactly 1 at
// one point 25 km to the side, which was the strip model's own rule) became "sunlit terrain remains in the scene
// while the site is in shadow" (the same intent: the site's shadow is not the scene's).
// Run: PW_GPU=1 PW_PORT=5215 npx playwright test e2e/terrain-sunlight.spec.ts
import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import type { EphemMonth, Horizon, Site } from '../src/data/types'
import { interpolate } from '../src/geometry'
import { eyeVisibility } from '../src/scene3d/visibility'

const DATA = `${fileURLToPath(new URL('..', import.meta.url))}public/data`
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(`${DATA}/${p}`, 'utf8')) as T
const sites = read<Site[]>('sites.json')
const months = ['2027-08', '2027-09'].map((k) => read<EphemMonth>(`ephem/${k}.json`))

/** The app's own number: share of the Sun's disc above the mask at the site's eye. */
function sunFrac(siteId: string, utc: string) {
  const s = sites.find((x) => x.id === siteId)!
  const h = s.horizon ? read<Horizon>(`horizons/${s.horizon}`) : null
  return eyeVisibility(interpolate(months, Date.parse(utc)), s, h).sun.fraction
}

const scene = <T>(page: Page, fn: string) => page.evaluate(`(${fn})(window.__scene)`) as Promise<T>

async function open(page: Page) {
  await page.goto('/?test=1#site=connecting-ridge&period=shackleton-2027-08')
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, '(s) => s.ready')
}

/**
 * Mean luminance of the ground at the marker's foot (the site is the centre of the default view): an 8 × 4 px box,
 * about 150 m × 250 m of ground seen from 17 km, with the mast and its cross switched off. Not a wide box as
 * before: a sunlit ridge or peak site is a lit crest a few pixels deep with real shadow beside it.
 */
async function groundLum(page: Page) {
  await scene(page, '(s) => { s.setMarkerVisible(false); return s.setView({}) }')
  const png = PNG.sync.read(await page.screenshot())
  await scene(page, '(s) => { s.setMarkerVisible(true); return s.setView({}) }')
  let sum = 0
  let n = 0
  for (let y = png.height / 2 - 2; y < png.height / 2 + 2; y++) {
    for (let x = png.width / 2 - 4; x < png.width / 2 + 4; x++) {
      const i = (y * png.width + x) * 4
      sum += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]
      n++
    }
  }
  return sum / n
}

async function show(page: Page, site: string, utc: string) {
  await scene(page, `(s) => s.setView({ site: '${site}', utc: '${utc}', level: 'site' })`)
  const frac = sunFrac(site, utc)
  const drawn = await scene<number>(page, '(s) => s.sunShareAt(0, 0)')
  const sun = await scene<{ belowHorizon?: boolean } | null>(page, `(s) => s.project('sun')`)
  return { frac, drawn, below: sun?.belowHorizon ?? false, lum: await groundLum(page) }
}

const SUNLIT: [string, string][] = [
  ['connecting-ridge', '2027-08-16T12:00Z'],
  ['connecting-ridge', '2027-08-20T12:00Z'],
  ['connecting-ridge', '2027-08-22T12:00Z'],
  ['connecting-ridge', '2027-08-26T12:00Z'],
  ['peak-near-shackleton', '2027-08-18T00:00Z'],
  ['malapert-massif', '2027-08-18T00:00Z'],
  ['viper-mons-mouton', '2027-08-22T12:00Z'],
  ['haworth', '2027-08-27T00:00Z'],
]
const SHADOWED: [string, string][] = [
  ['shackleton-rim-site04', '2027-08-22T12:00Z'],
  ['peak-near-shackleton', '2027-08-22T12:00Z'],
  ['haworth', '2027-08-18T00:00Z'],
  ['malapert-massif', '2027-08-22T12:00Z'],
]

test.describe('terrain sunlight at the landing site agrees with the computed disc fraction', () => {
  test.setTimeout(240_000)

  test('sunlit sites read as sunlit ground; the drawn share at the site is the computed one; the Sun label agrees', async ({ page }) => {
    await open(page)
    for (const [site, utc] of SUNLIT) {
      const r = await show(page, site, utc)
      console.log(`sunlit ${site} ${utc}: disc ${r.frac.toFixed(3)} drawn ${r.drawn.toFixed(3)} ground ${r.lum.toFixed(1)}`)
      expect(r.frac, `${site} ${utc} is sunlit in the data`).toBe(1)
      expect(r.drawn, 'drawn share at the site').toBeCloseTo(r.frac, 6)
      expect(r.below, 'the Sun is not drawn hollow').toBe(false)
      // Before: 11–36. The page background is about 13.
      expect(r.lum, `${site} ${utc}: sunlit ground around the marker`).toBeGreaterThan(50)
    }
    await page.screenshot({ path: 'test-results/scene-fix/light-test-sunlit-last.png' })
  })

  test('shadowed sites read as shadowed at the site, while sunlit terrain remains in the scene', async ({ page }) => {
    await open(page)
    for (const [site, utc] of SHADOWED) {
      const r = await show(page, site, utc)
      // The largest share on six rings of 24 points around the site (3 to 40 km).
      const far = await scene<number>(page, '(s) => { let m = 0; for (const r of [3000, 6000, 10000, 15000, 25000, 40000]) for (let k = 0; k < 24; k++) m = Math.max(m, s.sunShareAt(r * Math.sin(k * Math.PI / 12), r * Math.cos(k * Math.PI / 12))); return m }')
      console.log(`shadow ${site} ${utc}: disc ${r.frac.toFixed(3)} drawn ${r.drawn.toFixed(3)} far ${far.toFixed(3)} ground ${r.lum.toFixed(1)}`)
      expect(r.frac, `${site} ${utc} is (almost) hidden in the data`).toBeLessThan(0.1)
      expect(r.drawn, 'drawn share at the site').toBeCloseTo(r.frac, 6)
      expect(r.below, 'the Sun is drawn hollow exactly when the disc is gone').toBe(r.frac <= 0)
      expect(far, 'terrain around the site that the Sun reaches is not dimmed by the site being in shadow').toBe(1)
    }
    // At one site, shadow against sunlight: Peak Near Shackleton on 22 Aug (6 % of the disc) and 18 Aug (all of it).
    const dark = await show(page, 'peak-near-shackleton', '2027-08-22T12:00Z')
    await page.screenshot({ path: 'test-results/scene-fix/light-test-pns-shadow.png' })
    const lit = await show(page, 'peak-near-shackleton', '2027-08-18T00:00Z')
    await page.screenshot({ path: 'test-results/scene-fix/light-test-pns-sunlit.png' })
    expect(lit.lum / dark.lum, 'sunlit against shadowed ground around the marker').toBeGreaterThan(1.8)
    // Shackleton Rim Site04 (crater wall, no Sun in August 2027): the ground at the marker is dark.
    const sr = await show(page, 'shackleton-rim-site04', '2027-08-22T12:00Z')
    expect(sr.lum).toBeLessThan(45)
  })
})
