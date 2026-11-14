// Scene track, 14 Nov, S2: the terrain light at site and eye level follows the share of the Sun's disc above the
// terrain mask instead of switching in one step. ninja's case: IM-1, eye level, 23 Aug 2027, lit at 21:00 UTC and
// black one 30-minute step later. Expectations are computed here from geometry/ on the real ephemeris and horizon.
// Run: PW_PORT=5181 npx playwright test e2e/scene-light.spec.ts --workers=1
import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import type { EphemMonth, Horizon, Site } from '../src/data/types'
import { OBSERVER_HEIGHT_M, SUN_RADIUS_KM, angRadiusDeg, azEl, discFraction, enuBasis, interpolate, maskAt, siteVector } from '../src/geometry'

const APP = fileURLToPath(new URL('..', import.meta.url))
const DATA = `${APP}public/data`
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(`${DATA}/${p}`, 'utf8')) as T
const site = read<Site[]>('sites.json').find((s) => s.id === 'im-1')!
const horizon = read<Horizon>(`horizons/${site.horizon}`)
const months = ['2027-08', '2027-09'].map((k) => read<EphemMonth>(`ephem/${k}.json`))

/** Share of the Sun's disc above the mask at the site's eye, as the app computes it. */
function sunFraction(ms: number) {
  const st = interpolate(months, ms)
  const a = azEl(st.sun_km, siteVector(site.lat, site.lon, ((site.elev_m ?? 0) + OBSERVER_HEIGHT_M) / 1000), enuBasis(site.lat, site.lon))
  return { frac: discFraction(a.el, maskAt(horizon, a.az), angRadiusDeg(SUN_RADIUS_KM, a.dist_km)), el: a.el, az: a.az }
}

interface Lights {
  sun: number
  hidden: number
  fill: number
  earth: number
}
interface Scene {
  ready: Promise<void>
  setView(o: Record<string, unknown>): Promise<unknown>
  lights?(): Lights
  setAnimated(on: boolean): void
  advance(ms: number): void
}
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>
const setView = (page: Page, o: Record<string, unknown>) => page.evaluate((o) => (window as unknown as { __scene: Scene }).__scene.setView(o), o)
async function open(page: Page) {
  await page.goto('/src/scene3d/harness.html?test=1')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
}
/** Mean luminance (0..255) of the lower 40 % of the picture: terrain at eye level. */
async function groundLum(page: Page) {
  const png = PNG.sync.read(await page.screenshot())
  let sum = 0
  let n = 0
  for (let y = Math.round(png.height * 0.6); y < png.height; y += 4) {
    for (let x = 0; x < png.width; x += 4) {
      const i = (y * png.width + x) * 4
      sum += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]
      n++
    }
  }
  return sum / n
}
const BACKGROUND_LUM = 0.2126 * 0x0b + 0.7152 * 0x0d + 0.0722 * 0x11 // the page background, #0b0d11

const T_LIT = Date.parse('2027-08-23T21:00:00Z') // ninja's screenshots: lit here ...
const T_DARK = Date.parse('2027-08-23T21:30:00Z') // ... and black here
const MIN = 60_000
// The sunset those two times belong to, from the data: the last half hour with the whole disc above the mask and
// the first with none of it.
let T_FULL = T_LIT
while (sunFraction(T_FULL).frac < 1) T_FULL -= 30 * MIN
let T_GONE = T_DARK
while (sunFraction(T_GONE).frac > 0) T_GONE += 30 * MIN

test('S2: IM-1 on 23 Aug 2027, the light dims with the Sun\'s disc over the sunset instead of switching between two values', async ({ page }) => {
  test.setTimeout(240_000)
  await open(page)
  // Look north-east, away from the Sun, at the ground it lights.
  const sun = sunFraction(T_LIT)
  await setView(page, { site: 'im-1', utc: T_LIT, level: 'eye', az: sun.az + 150, el: -8 })
  const rows: { t: number; frac: number; sun: number; lum?: number }[] = []
  console.log(`S2: whole disc until ${new Date(T_FULL).toISOString()}, none from ${new Date(T_GONE).toISOString()}`)
  for (let t = T_FULL; t <= T_GONE; t += 10 * MIN) {
    await setView(page, { utc: t, level: 'eye', az: sun.az + 150, el: -8 })
    const l = await scene(page, (s) => s.lights?.() ?? null)
    const row: (typeof rows)[number] = { t, frac: sunFraction(t).frac, sun: l ? l.sun : NaN }
    if ((t - T_FULL) % (60 * MIN) === 0 || t === T_LIT || t === T_DARK || t === T_GONE) row.lum = await groundLum(page)
    rows.push(row)
    if (t === T_LIT) await page.screenshot({ path: 'test-results/s2-im1-2027-08-23-2100.png' })
    if (t === T_DARK) await page.screenshot({ path: 'test-results/s2-im1-2027-08-23-2130.png' })
    if (t === T_GONE) await page.screenshot({ path: 'test-results/s2-im1-sun-hidden.png' })
  }
  for (const r of rows) {
    console.log(`S2 ${new Date(r.t).toISOString().slice(11, 16)} disc ${(r.frac * 100).toFixed(1).padStart(5)} %  light ${r.sun.toFixed(3)}${r.lum === undefined ? '' : `  ground ${r.lum.toFixed(1)}`}`)
  }
  const l = (await scene(page, (s) => s.lights!()))!
  // The drawn sunlight is the disc share, from full down to the hidden level, at every step.
  for (const r of rows) expect(r.sun, new Date(r.t).toISOString()).toBeCloseTo(l.hidden + (1 - l.hidden) * r.frac, 9)
  const between = rows.filter((r) => r.sun > l.hidden + 1e-6 && r.sun < 1 - 1e-6)
  const distinct = new Set(between.map((r) => r.sun.toFixed(6)))
  console.log(`S2: ${distinct.size} distinct intermediate light levels in 10-minute steps, over ${(between.length / 6).toFixed(1)} h`)
  expect(distinct.size, 'intermediate light levels across the sunset').toBe(between.length)
  expect(between.length * 10, 'the dimming takes at least an hour').toBeGreaterThanOrEqual(60)
  for (let i = 1; i < rows.length; i++) {
    expect(rows[i].sun, `never brighter again, at ${new Date(rows[i].t).toISOString()}`).toBeLessThanOrEqual(rows[i - 1].sun)
    expect(rows[i - 1].sun - rows[i].sun, `largest change in one 10-minute step, at ${new Date(rows[i].t).toISOString()}`).toBeLessThan(0.1)
  }
  // ninja's two times: the half hour is a part of the fade, not a switch from lit to black.
  const at = (t: number) => rows.find((r) => r.t === t)!
  expect(at(T_LIT).sun - at(T_DARK).sun, 'the 21:00 → 21:30 step').toBeLessThan(0.15)
  expect(at(T_DARK).lum! / at(T_LIT).lum!, 'ground brightness at 21:30 against 21:00').toBeGreaterThan(0.8)
  // Fully hidden: dim, and still above the page background.
  const dark = rows.filter((r) => r.frac === 0 && r.lum !== undefined)
  expect(dark.length).toBeGreaterThan(0)
  for (const r of dark) expect(r.lum!, 'hidden Sun: the ground is dim, not black').toBeGreaterThan(BACKGROUND_LUM + 6)
  const lit = rows.filter((r) => r.frac === 1 && r.lum !== undefined)
  expect(lit.length).toBeGreaterThan(0)
  expect(Math.min(...lit.map((r) => r.lum!)), 'and clearly darker than the sunlit ground').toBeGreaterThan(1.5 * Math.max(...dark.map((r) => r.lum!)))
})

test('S2: a jump of the time across the sunset fades over 500 ms on the animation clock, then rests on the computed level', async ({ page }) => {
  await open(page)
  const T0 = T_FULL
  const tEnd = T_GONE
  await setView(page, { site: 'im-1', utc: T0, level: 'eye' })
  expect((await scene(page, (s) => s.lights!())).sun).toBe(1)

  // Without easing (test mode as before): the level lands with the frame.
  await setView(page, { utc: tEnd })
  const hidden = await scene(page, (s) => s.lights!())
  expect(hidden.sun).toBeCloseTo(hidden.hidden, 12)
  expect(hidden.fill).toBeGreaterThan(0)

  await setView(page, { utc: T0 })
  await scene(page, (s) => s.setAnimated(true))
  await setView(page, { utc: tEnd })
  expect((await scene(page, (s) => s.lights!())).sun, 'nothing changes until the clock moves').toBe(1)
  const levels = await page.evaluate(() => {
    const s = (window as unknown as { __scene: Scene }).__scene
    const out: number[] = []
    for (let i = 0; i < 12; i++) {
      s.advance(50)
      out.push(s.lights!().sun)
    }
    return out
  })
  console.log(`S2 jump: ${levels.map((v) => v.toFixed(3)).join(' ')}`)
  for (let i = 0; i < 9; i++) {
    expect(levels[i], `frame at ${(i + 1) * 50} ms is between the two levels`).toBeLessThan(i === 0 ? 1 : levels[i - 1])
    expect(levels[i]).toBeGreaterThan(hidden.hidden)
    expect((i === 0 ? 1 : levels[i - 1]) - levels[i], 'no step larger than a fifth of the change').toBeLessThan(0.2)
  }
  expect(levels[9], 'at 500 ms: the computed level').toBeCloseTo(hidden.hidden, 12)
  expect(levels[11]).toBeCloseTo(hidden.hidden, 12)
})
