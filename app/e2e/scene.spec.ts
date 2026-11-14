// Track C1 numeric screen tests (build-plan §5.4 layer 3) and the screenshot set, against the scene harness
// /src/scene3d/harness.html?test=1. Run: PW_PORT=5181 npx playwright test e2e/scene.spec.ts
//
// Expectations are computed here, independently of scene3d/: body directions from geometry/ (azEl.dirEnu),
// pinhole projection and the horizon mask (linear between 0.5° samples) with plain trig in this file.

import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import type { EphemMonth, Horizon, Site } from '../src/data/types'
import { azEl, enuBasis, interpolate, siteVector, type AzEl } from '../src/geometry'

const APP = fileURLToPath(new URL('..', import.meta.url))
const DATA = `${APP}public/data`
const SHOTS = `${APP}test-results`
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(`${DATA}/${p}`, 'utf8')) as T
const sites = read<Site[]>('sites.json')
const ephem = read<EphemMonth>('ephem/sample.json')

// Sample data covers 2026-11-14 00:00–01:30 UTC only (synthetic). Real months replace it when Track A merges.
const T0 = '2026-11-14T00:00:00Z'
const SUN_RADIUS_KM = 695_700
const D2R = Math.PI / 180

type Vec = [number, number, number]
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a: Vec): Vec => {
  const n = Math.hypot(...a)
  return [a[0] / n, a[1] / n, a[2] / n]
}
const dirAzEl = (az: number, el: number): Vec => [
  Math.sin(az * D2R) * Math.cos(el * D2R),
  Math.cos(az * D2R) * Math.cos(el * D2R),
  Math.sin(el * D2R),
]

function body(siteOrId: string | Site, utc: string, which: 'sun' | 'earth'): AzEl {
  const s = typeof siteOrId === 'string' ? sites.find((x) => x.id === siteOrId)! : siteOrId
  const st = interpolate([ephem], Date.parse(utc))
  const site = siteVector(s.lat, s.lon, (s.elev_m ?? 0) / 1000)
  return azEl(which === 'sun' ? st.sun_km : st.earth_km, site, enuBasis(s.lat, s.lon))
}

/** Ideal pinhole camera at the eye looking toward (az0, el0), no roll, vertical FOV fov. */
function pinhole(az0: number, el0: number, fov: number, w: number, h: number, d: Vec) {
  const f = dirAzEl(az0, el0)
  const r = unit(cross(f, [0, 0, 1]))
  const u = cross(r, f)
  const t = Math.tan((fov / 2) * D2R)
  const x = dot(d, r) / dot(d, f) / (t * (w / h))
  const y = dot(d, u) / dot(d, f) / t
  return { x: ((x + 1) / 2) * w, y: ((1 - y) / 2) * h }
}

/** Horizon mask (deg) at az, linear between samples (note 7: computed from the JSON, not geometry.maskAt). */
function maskAt(h: Horizon, az: number) {
  const n = h.mask.length
  const x = (((az % 360) + 360) % 360) / h.az_step
  const i = Math.floor(x) % n
  const f = x - Math.floor(x)
  return h.mask[i] * (1 - f) + h.mask[(i + 1) % n] * f
}

async function open(page: Page) {
  await page.goto('/src/scene3d/harness.html?test=1')
  await page.waitForFunction(() => (window as unknown as { __scene?: { ready: Promise<void> } }).__scene !== undefined)
  await page.evaluate(() => (window as unknown as { __scene: { ready: Promise<void> } }).__scene.ready)
}

type Opts = Record<string, unknown>
const setView = (page: Page, o: Opts) =>
  page.evaluate((o) => (window as unknown as { __scene: { setView(o: Opts): Promise<Record<string, unknown>> } }).__scene.setView(o), o)
const project = (page: Page, name: string) =>
  page.evaluate(
    (n) => (window as unknown as { __scene: { project(n: string): { x: number; y: number; visible: boolean } | null } }).__scene.project(n),
    name,
  )
const call = <T>(page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(
    ([fn, args]) => (window as unknown as { __scene: Record<string, (...a: unknown[]) => unknown> }).__scene[fn as string](...(args as unknown[])),
    [fn, args] as const,
  ) as Promise<T>

async function pixels(page: Page) {
  return PNG.sync.read(await page.screenshot())
}
const lum = (png: PNG, x: number, y: number) => {
  const i = (Math.round(y) * png.width + Math.round(x)) * 4
  return 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]
}
const rgb = (png: PNG, x: number, y: number) => {
  const i = (Math.round(y) * png.width + Math.round(x)) * 4
  return [png.data[i], png.data[i + 1], png.data[i + 2]]
}
/** Luminance-weighted centroid of pixels above `thr` within a box around (cx, cy). */
function brightCentroid(png: PNG, cx: number, cy: number, half: number, thr: number) {
  let sx = 0
  let sy = 0
  let sw = 0
  for (let y = Math.max(0, Math.round(cy - half)); y <= Math.min(png.height - 1, Math.round(cy + half)); y++) {
    for (let x = Math.max(0, Math.round(cx - half)); x <= Math.min(png.width - 1, Math.round(cx + half)); x++) {
      const l = lum(png, x, y) - thr
      if (l > 0) {
        sx += (x + 0.5) * l
        sy += (y + 0.5) * l
        sw += l
      }
    }
  }
  return sw > 0 ? { x: sx / sw, y: sy / sw, w: sw } : null
}

test.describe('scene3d numeric tests (1280 × 720)', () => {
  test('T14 projection: eye-level Sun and Earth match the pinhole projection of geometry az/el within 1 px', async ({ page }) => {
    await open(page)
    // im-1 (80.1° S): Sun ~11° and Earth ~10° up at the sample time, clear of the real terrain tile.
    const site = 'im-1'
    const sun = body(site, T0, 'sun')
    const earth = body(site, T0, 'earth')
    const W = 1280
    const H = 720
    for (const [dAz, el0] of [
      [0, 0],
      [0, 3],
      [-15, 2],
      [15, 2],
      [25, 8],
    ]) {
      const az0 = sun.az + dAz
      const cam = await setView(page, { site, utc: T0, level: 'eye', az: az0, el: el0, fov: 54 })
      expect(cam.level).toBe('eye')
      for (const [name, b] of [
        ['sun', sun],
        ['earth', earth],
      ] as const) {
        const want = pinhole(az0, el0, 54, W, H, b.dirEnu)
        const got = (await project(page, name))!
        expect(got.visible, `${name} visible`).toBe(true)
        expect(Math.abs(got.x - want.x), `${name} x at camera az ${az0.toFixed(2)}`).toBeLessThan(1)
        expect(Math.abs(got.y - want.y), `${name} y at camera az ${az0.toFixed(2)}`).toBeLessThan(1)
      }
      // The rendered Sun disc, not only the API: bright-pixel centroid at the pinhole point.
      const png = await pixels(page)
      const want = pinhole(az0, el0, 54, W, H, sun.dirEnu)
      const c = brightCentroid(png, want.x, want.y, 6, 200)
      expect(c, 'Sun disc rendered').not.toBeNull()
      expect(Math.abs(c!.x - want.x), 'rendered Sun x').toBeLessThan(1)
      expect(Math.abs(c!.y - want.y), 'rendered Sun y').toBeLessThan(1)
    }

    // Demo site, bodies within a degree of the horizon (trap 7): projected positions only; whether terrain hides
    // them is T17's subject.
    const demo = 'shackleton-rim-site04'
    const dSun = body(demo, T0, 'sun')
    const dEarth = body(demo, T0, 'earth')
    for (const dAz of [0, 10]) {
      const az0 = dSun.az + dAz
      await setView(page, { site: demo, utc: T0, level: 'eye', az: az0, el: 0, fov: 54 })
      for (const [name, b] of [
        ['sun', dSun],
        ['earth', dEarth],
      ] as const) {
        const want = pinhole(az0, 0, 54, W, H, b.dirEnu)
        const got = (await project(page, name))!
        expect(Math.abs(got.x - want.x), `${demo} ${name} x (el ${b.el.toFixed(2)}°)`).toBeLessThan(1)
        expect(Math.abs(got.y - want.y), `${demo} ${name} y (el ${b.el.toFixed(2)}°)`).toBeLessThan(1)
      }
    }
  })

  test('T16 orientation: checker texture, pin at 0°N 0°E faces +x MOON_ME, pin at 0°N 90°E sits at +y', async ({ page }) => {
    await open(page)
    const extra = [
      { ...sites[0], id: 't16-0n0e', name: 'T16 0N 0E', lat: 0, lon: 0 },
      { ...sites[0], id: 't16-0n90e', name: 'T16 0N 90E', lat: 0, lon: 90 },
    ]
    await setView(page, { site: 'shackleton-rim-site04', utc: T0, level: 'globe' })
    await call(page, 'setSites', [...sites, ...extra])
    const p0 = (await call<number[]>(page, 'pinSurface', 't16-0n0e'))!
    const p90 = (await call<number[]>(page, 'pinSurface', 't16-0n90e'))!
    expect(p0[0]).toBeCloseTo(1737.4, 6)
    expect(Math.hypot(p0[1], p0[2])).toBeLessThan(1e-9)
    expect(p90[1]).toBeCloseTo(1737.4, 6)
    expect(Math.hypot(p90[0], p90[2])).toBeLessThan(1e-9)

    // Camera over 0°N 0°E (on +x), north up: the 0° meridian (red band) is under the 0/0 pin at screen centre.
    for (const [lon, id, colour] of [
      [0, 't16-0n0e', 'red'],
      [90, 't16-0n90e', 'green'],
    ] as const) {
      const cam = await setView(page, { level: 'globe', el: 0, az: lon, dist: 6000, texture: 'checker' })
      const pos = cam.position as number[]
      expect(lon === 0 ? pos[0] : pos[1]).toBeCloseTo(6000, 3)
      const pin = (await call<{ x: number; y: number; visible: boolean }>(page, 'projectPin', id))!
      expect(Math.abs(pin.x - 640)).toBeLessThan(1)
      expect(Math.abs(pin.y - 360)).toBeLessThan(1)
      const png = await pixels(page)
      // Sample just below the pin head and the equator line.
      const [r, g, b] = rgb(png, pin.x, pin.y + 12)
      if (colour === 'red') expect(r > 150 && g < 90 && b < 90, `red at 0°E, got ${r},${g},${b}`).toBe(true)
      else expect(g > 140 && r < 90 && b < 110, `green at 90°E, got ${r},${g},${b}`).toBe(true)
      // East is to the right seen from outside: 8° east of the pin is the next checker square, not a band colour.
      const [r2, g2, b2] = rgb(png, pin.x + 60, pin.y + 40)
      expect(Math.abs(r2 - g2) < 20 && Math.abs(g2 - b2) < 20, `grey checker east of the pin, got ${r2},${g2},${b2}`).toBe(true)
    }
  })

  test('T17 occlusion: Sun pixel dark where the mask hides it, bright where the mask shows it', async ({ page }) => {
    await open(page)
    // No real horizon file exists yet (Track B): two synthetic test sites use the synthetic horizons/sample-site.json
    // mask and have no terrain tile, so the scene draws exactly the flat disc + the far ring built from that mask.
    const horizon = read<Horizon>('horizons/sample-site.json')
    const shack = sites.find((x) => x.id === 'shackleton-rim-site04')!
    const masked: Site = { ...shack, id: 't17-masked', horizon: 'sample-site.json' } // Shackleton coordinates
    const open_: Site = { ...shack, id: 't17-open', lat: horizon.lat, lon: horizon.lon, horizon: 'sample-site.json' }
    await call(page, 'setSites', [...sites, masked, open_])
    const cases = [
      { site: masked, expectLit: false },
      { site: open_, expectLit: true },
    ]
    for (const c of cases) {
      const sun = body(c.site, T0, 'sun')
      const rDeg = Math.asin(SUN_RADIUS_KM / sun.dist_km) / D2R
      const m = maskAt(horizon, sun.az)
      // Premise of the case, from the mask alone: whole disc below / above the terrain.
      if (c.expectLit) expect(sun.el - rDeg, 'premise: disc fully above the mask').toBeGreaterThan(m)
      else expect(sun.el + rDeg, 'premise: disc fully below the mask').toBeLessThan(m)
      await setView(page, { site: c.site.id, utc: T0, level: 'eye', az: sun.az, el: sun.el, fov: 54 })
      const want = pinhole(sun.az, sun.el, 54, 1280, 720, sun.dirEnu)
      const png = await pixels(page)
      const l = lum(png, want.x, want.y)
      const p = (await project(page, 'sun'))!
      if (c.expectLit) {
        expect(l, `${c.site.id}: Sun pixel lit (mask ${m.toFixed(3)}°, Sun ${sun.el.toFixed(3)}°)`).toBeGreaterThan(200)
        expect(p.visible).toBe(true)
      } else {
        expect(l, `${c.site.id}: Sun pixel dark (mask ${m.toFixed(3)}°, Sun ${sun.el.toFixed(3)}°)`).toBeLessThan(30)
        expect(p.visible).toBe(false)
      }
    }
  })
})

test.describe('screenshots (1440 × 900)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('globe, site default, eye level, Shackleton default, im-1 nodata', async ({ page }) => {
    fs.mkdirSync(SHOTS, { recursive: true })
    await open(page)
    await setView(page, { site: 'shackleton-rim-site04', utc: T0, level: 'globe' })
    await page.screenshot({ path: `${SHOTS}/c1-globe.png` })
    // The mockup's site, default view.
    await setView(page, { site: 'connecting-ridge', utc: T0, level: 'site' })
    await page.screenshot({ path: `${SHOTS}/c1-site-default.png` })
    // Eye level at the demo site, facing the Sun.
    const sun = body('shackleton-rim-site04', T0, 'sun')
    await setView(page, { site: 'shackleton-rim-site04', utc: T0, level: 'eye', az: sun.az + 10, el: 2 })
    await page.screenshot({ path: `${SHOTS}/c1-eye-level.png` })
    // 2027-08-16 12:00 UTC needs Track A's real ephemeris; until then the sample time (synthetic) is used.
    await setView(page, { site: 'shackleton-rim-site04', utc: T0, level: 'site' })
    await page.screenshot({ path: `${SHOTS}/c1-shackleton-default-SAMPLE-TIME.png` })
    // Extra: im-1's tile is ~40 % nodata (north of 80° S); it must render as a hole, not as flat ground.
    await setView(page, { site: 'im-1', utc: T0, level: 'site' })
    await page.screenshot({ path: `${SHOTS}/c1-im1-nodata.png` })
  })
})
