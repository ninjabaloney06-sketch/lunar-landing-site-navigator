// Track C1 numeric screen tests (build-plan §5.4 layer 3) and the screenshot set, against the scene harness
// /src/scene3d/harness.html?test=1. Run: PW_PORT=5181 npx playwright test e2e/scene.spec.ts
//
// Expectations are computed here, independently of scene3d/: body directions from geometry/ (interpolate on the
// real ephemeris months, azEl.dirEnu), the horizon from geometry.maskAt on the real horizon files, and the
// pinhole projection with plain trig in this file. Test times are found by searching the real data, so the
// cases stay valid if a data file is regenerated.

import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import type { EphemMonth, Horizon, Site } from '../src/data/types'
import { SUN_RADIUS_KM, angRadiusDeg, azEl, enuBasis, interpolate, maskAt, siteVector, type AzEl } from '../src/geometry'

const APP = fileURLToPath(new URL('..', import.meta.url))
const DATA = `${APP}public/data`
const SHOTS = `${APP}test-results`
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(`${DATA}/${p}`, 'utf8')) as T
const sites = read<Site[]>('sites.json')
const siteById = (id: string) => sites.find((s) => s.id === id)!
const horizonOf = (s: Site) => read<Horizon>(`horizons/${s.horizon}`)

const DEMO = 'connecting-ridge' // demo site (ninja, 14 Nov)
const DEMO_UTC = '2027-08-16T12:00:00Z' // required screenshot time
const MOCKUP_UTC = '2026-11-14T12:00:00Z' // the reference mockup's site and time
const D2R = Math.PI / 180

const monthCache = new Map<string, EphemMonth | null>()
function month(key: string): EphemMonth | null {
  if (!monthCache.has(key)) {
    const p = `ephem/${key}.json`
    monthCache.set(key, fs.existsSync(`${DATA}/${p}`) ? read<EphemMonth>(p) : null)
  }
  return monthCache.get(key)!
}
const key = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
function monthsFor(ms: number): EphemMonth[] {
  const d = new Date(ms)
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  return [month(key(d)), month(key(next))].filter((m): m is EphemMonth => m !== null)
}

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

/** Topocentric Sun or Earth seen from a site (site height from sites.json), real ephemeris. */
function body(s: Site, utc: string | number, which: 'sun' | 'earth'): AzEl {
  const ms = typeof utc === 'number' ? utc : Date.parse(utc)
  const st = interpolate(monthsFor(ms), ms)
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

/** First time in [from, to) (30 min steps) at which pred holds; null if none. */
function findTime(from: string, to: string, pred: (ms: number) => boolean): number | null {
  for (let t = Date.parse(from); t < Date.parse(to); t += 30 * 60_000) if (pred(t)) return t
  return null
}

const azDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)

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
    const W = 1280
    const H = 720
    // A site and time with Sun and Earth both ≥ 1.5° above the real mask and within 25° of azimuth of each other.
    const site = siteById('im-1')
    const hz = horizonOf(site)
    const t = findTime('2027-08-01T00:00:00Z', '2027-09-01T00:00:00Z', (ms) => {
      const s = body(site, ms, 'sun')
      const e = body(site, ms, 'earth')
      return s.el - maskAt(hz, s.az) > 1.5 && e.el - maskAt(hz, e.az) > 1.5 && azDiff(s.az, e.az) < 25 && s.el < 12 && e.el < 12
    })
    expect(t, 'a time with Sun and Earth well above the im-1 mask in Aug 2027').not.toBeNull()
    const utc = new Date(t!).toISOString()
    const sun = body(site, utc, 'sun')
    const earth = body(site, utc, 'earth')
    for (const [dAz, el0] of [
      [0, 0],
      [0, 3],
      [-15, 2],
      [15, 2],
      [25, 8],
    ]) {
      const az0 = sun.az + dAz
      const cam = await setView(page, { site: site.id, utc, level: 'eye', az: az0, el: el0, fov: 54 })
      expect(cam.level).toBe('eye')
      for (const [name, b] of [
        ['sun', sun],
        ['earth', earth],
      ] as const) {
        const want = pinhole(az0, el0, 54, W, H, b.dirEnu)
        const got = (await project(page, name))!
        // Above the mask by ≥ 1.5°, so visible exactly when inside the frame.
        const inFrame = want.x >= 0 && want.x <= W && want.y >= 0 && want.y <= H
        expect(got.visible, `${name} visible = in frame, camera az ${az0.toFixed(2)}, ${utc}`).toBe(inFrame)
        if (name === 'sun') expect(inFrame, 'Sun in frame for every pose').toBe(true)
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

    // Demo site at the demo time, bodies within a degree of the horizon (trap 7): projected positions; whether
    // terrain hides them is T17's subject.
    const demo = siteById(DEMO)
    const dSun = body(demo, DEMO_UTC, 'sun')
    const dEarth = body(demo, DEMO_UTC, 'earth')
    for (const dAz of [0, 10]) {
      const az0 = dSun.az + dAz
      await setView(page, { site: DEMO, utc: DEMO_UTC, level: 'eye', az: az0, el: 0, fov: 54 })
      for (const [name, b] of [
        ['sun', dSun],
        ['earth', dEarth],
      ] as const) {
        const want = pinhole(az0, 0, 54, W, H, b.dirEnu)
        const got = (await project(page, name))!
        expect(Math.abs(got.x - want.x), `${DEMO} ${name} x (el ${b.el.toFixed(2)}°)`).toBeLessThan(1)
        expect(Math.abs(got.y - want.y), `${DEMO} ${name} y (el ${b.el.toFixed(2)}°)`).toBeLessThan(1)
      }
    }
  })

  test('T16 orientation: checker texture, pin at 0°N 0°E faces +x MOON_ME, pin at 0°N 90°E sits at +y', async ({ page }) => {
    await open(page)
    const extra = [
      { ...sites[0], id: 't16-0n0e', name: 'T16 0N 0E', lat: 0, lon: 0 },
      { ...sites[0], id: 't16-0n90e', name: 'T16 0N 90E', lat: 0, lon: 90 },
    ]
    await setView(page, { site: DEMO, utc: DEMO_UTC, level: 'globe' })
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
      // East is to the right seen from outside: east of the pin is a grey checker square, not a band colour.
      const [r2, g2, b2] = rgb(png, pin.x + 60, pin.y + 40)
      expect(Math.abs(r2 - g2) < 20 && Math.abs(g2 - b2) < 20, `grey checker east of the pin, got ${r2},${g2},${b2}`).toBe(true)
    }
  })

  test('T17 occlusion: Sun pixel dark where the mask hides it, bright where the mask shows it', async ({ page }) => {
    await open(page)
    // Real horizons + real ephemeris; the expectation comes from geometry.maskAt (Track A) alone. Cases: the Sun's
    // whole disc ≥ 0.3° below the mask but within 3° of it (terrain occlusion near the skyline), and the whole disc
    // ≥ 0.3° above the mask. Searched in Aug 2027 at the demo site first, then other sites if needed.
    const sunState = (s: Site, hz: Horizon, ms: number) => {
      const b = body(s, ms, 'sun')
      return { b, m: maskAt(hz, b.az), r: angRadiusDeg(SUN_RADIUS_KM, b.dist_km) }
    }
    const pick = (want: 'dark' | 'lit') => {
      for (const id of [DEMO, 'shackleton-rim-site04', 'malapert-site23', 'im-1']) {
        const s = siteById(id)
        const hz = horizonOf(s)
        const t = findTime('2027-08-01T00:00:00Z', '2027-09-01T00:00:00Z', (ms) => {
          const { b, m, r } = sunState(s, hz, ms)
          return want === 'dark' ? b.el + r < m - 0.3 && b.el > m - 3 : b.el - r > m + 0.3 && b.el < m + 8
        })
        if (t !== null) return { s, hz, t }
      }
      return null
    }
    for (const want of ['dark', 'lit'] as const) {
      const c = pick(want)
      expect(c, `a ${want} case in Aug 2027`).not.toBeNull()
      const { s, hz, t } = c!
      const utc = new Date(t).toISOString()
      const { b: sun, m } = sunState(s, hz, t)
      await setView(page, { site: s.id, utc, level: 'eye', az: sun.az, el: sun.el, fov: 54 })
      const px = pinhole(sun.az, sun.el, 54, 1280, 720, sun.dirEnu)
      const png = await pixels(page)
      const l = lum(png, px.x, px.y)
      const p = (await project(page, 'sun'))!
      const msg = `${s.id} ${utc}: mask ${m.toFixed(3)}°, Sun ${sun.el.toFixed(3)}°`
      console.log(`T17 ${want}: ${msg}, pixel luminance ${l.toFixed(0)}, project().visible ${p.visible}`)
      if (want === 'lit') {
        expect(l, `Sun pixel lit, ${msg}`).toBeGreaterThan(200)
        expect(p.visible, msg).toBe(true)
      } else {
        expect(l, `Sun pixel dark, ${msg}`).toBeLessThan(30)
        expect(p.visible, msg).toBe(false)
      }
    }
  })
})

test.describe('terrain levels (track-terrain)', () => {
  test('T18 nested levels: loaded where present, ≤ 1.5 MB of terrain per site, no cracks at the level borders', async ({ page }) => {
    const bodies: Promise<number>[] = []
    const files: string[] = []
    page.on('response', (r) => {
      if (!r.url().includes(`/data/terrain/${DEMO}`)) return
      files.push(r.url().split('/').pop()!)
      bodies.push(r.body().then((b) => b.length))
    })
    await open(page)
    type Info = { levels: string[]; triangles: number }
    await setView(page, { site: DEMO, utc: DEMO_UTC, level: 'site' })
    const info = await call<Info>(page, 'terrainInfo')
    expect(info.levels).toEqual(['fine', 'tile', 'mid', 'far'])
    const terrainBytes = (await Promise.all(bodies)).reduce((a, b) => a + b, 0)
    console.log(`T18 ${DEMO}: ${terrainBytes} bytes of terrain in ${files.length} files (${files.join(', ')}), ` +
      `${info.triangles} terrain triangles at site level`)
    expect(files.length).toBe(8)
    expect(terrainBytes).toBeLessThan(1.5e6)
    // Flat unlit grey terrain: a dark pixel inside the terrain is a gap between levels (or inside one). Views look
    // straight down on the fine/80 m border (±2.5 km) and the 80 m/mid border (±20 km), and obliquely across both.
    await call(page, 'setFlat', true)
    for (const v of [
      { az: 30, el: 85, dist: 7 },
      { az: 30, el: 85, dist: 45 },
      { az: 120, el: 35, dist: 12 },
    ]) {
      await setView(page, { level: 'site', ...v })
      const png = await pixels(page)
      let gaps = 0
      let terrain = 0
      // Lower half of the frame only: with el ≥ 35° it lies inside the 60 km mid square, below any skyline.
      for (let y = Math.round(png.height * 0.55); y < png.height; y += 2) {
        for (let x = 0; x < png.width; x += 2) {
          if (lum(png, x, y) < 40) gaps++
          else terrain++
        }
      }
      console.log(`T18 flat view ${JSON.stringify(v)}: ${gaps} dark of ${gaps + terrain} sampled pixels`)
      expect(gaps, `dark pixels inside the terrain, view ${JSON.stringify(v)}`).toBe(0)
    }
    await call(page, 'setFlat', false)
  })

  test('T18 fallback: a tile whose meta lists no levels renders alone, and no level file is fetched', async ({ page }) => {
    const levelRequests: string[] = []
    page.on('request', (r) => {
      if (/terrain\/[^/]+-(fine|mid|far)\./.test(r.url())) levelRequests.push(r.url())
    })
    await page.route(`**/data/terrain/${DEMO}.json`, async (route) => {
      const res = await route.fetch()
      const meta = (await res.json()) as Record<string, unknown>
      delete meta.levels
      await route.fulfill({ response: res, json: meta })
    })
    await open(page)
    await setView(page, { site: DEMO, utc: DEMO_UTC, level: 'site' })
    const info = await call<{ levels: string[]; triangles: number }>(page, 'terrainInfo')
    expect(info.levels).toEqual(['tile'])
    expect(levelRequests).toEqual([])
  })

  test('T17 at every site with levels: the Sun is hidden exactly where the mask hides it (eye level)', async ({ page }) => {
    await open(page)
    // T17's cases (whole disc ≥ 0.3° below the mask but within 3°, or ≥ 0.3° above it and < 8°), first match in
    // Aug 2027, for every site with a horizon: checks the clamp and the crest strip on all terrain, not one site.
    const failures: string[] = []
    let checked = 0
    for (const s of sites.filter((x) => x.horizon)) {
      const hz = horizonOf(s)
      for (const want of ['dark', 'lit'] as const) {
        const t = findTime('2027-08-01T00:00:00Z', '2027-09-01T00:00:00Z', (ms) => {
          const b = body(s, ms, 'sun')
          const m = maskAt(hz, b.az)
          const r = angRadiusDeg(SUN_RADIUS_KM, b.dist_km)
          return want === 'dark' ? b.el + r < m - 0.3 && b.el > m - 3 : b.el - r > m + 0.3 && b.el < m + 8
        })
        if (t === null) continue
        const utc = new Date(t).toISOString()
        const sun = body(s, utc, 'sun')
        await setView(page, { site: s.id, utc, level: 'eye', az: sun.az, el: sun.el, fov: 54 })
        const p = (await project(page, 'sun'))!
        const px = pinhole(sun.az, sun.el, 54, 1280, 720, sun.dirEnu)
        const l = lum(await pixels(page), px.x, px.y)
        checked++
        const ok = want === 'lit' ? p.visible && l > 200 : !p.visible && l < 30
        if (!ok) failures.push(`${s.id} ${want} ${utc}: visible ${p.visible}, luminance ${l.toFixed(0)}`)
      }
    }
    console.log(`T17 all sites: ${checked} cases, ${failures.length} failures`)
    expect(checked).toBeGreaterThan(20)
    expect(failures).toEqual([])
  })
})

test.describe('screenshots (1440 × 900)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('globe, site default (mockup site/time), demo default, eye level, im-1 nodata', async ({ page }) => {
    fs.mkdirSync(SHOTS, { recursive: true })
    await open(page)
    await setView(page, { site: DEMO, utc: DEMO_UTC, level: 'globe' })
    await page.screenshot({ path: `${SHOTS}/c1-globe.png` })
    // The reference mockup shows Connecting Ridge on 14 Nov 2026 12:00 UTC: same site and time, default view.
    await setView(page, { site: DEMO, utc: MOCKUP_UTC, level: 'site' })
    await page.screenshot({ path: `${SHOTS}/c1-site-default.png` })
    // Required: demo site at 2027-08-16 12:00 UTC, default view, then E (eye level at the current heading).
    await setView(page, { site: DEMO, utc: DEMO_UTC, level: 'site' })
    await page.screenshot({ path: `${SHOTS}/c1-demo-connecting-ridge-2027-08-16T1200Z.png` })
    await setView(page, { level: 'eye' })
    await page.screenshot({ path: `${SHOTS}/c1-eye-level.png` })
    // Extra: im-1's 80 m tile is ~40 % nodata (outside the polar DEM). With the terrain levels only the far level
    // (ldem_16 fill) covers that part, and the finer levels show it at that resolution; a point no level covers
    // is a hole, never flat ground.
    await setView(page, { site: 'im-1', utc: DEMO_UTC, level: 'site' })
    await page.screenshot({ path: `${SHOTS}/c1-im1-nodata.png` })
  })

  // Terrain levels before/after set (track-terrain): the same cameras every run; TERRAIN_TAG names the set.
  test('terrain levels: fixed cameras for the before/after comparison', async ({ page }) => {
    fs.mkdirSync(SHOTS, { recursive: true })
    const tag = process.env.TERRAIN_TAG ?? 'after'
    await open(page)
    const shots: [string, Opts][] = [
      ['connecting-ridge-site', { site: DEMO, utc: DEMO_UTC, level: 'site' }],
      ['connecting-ridge-eye', { level: 'eye' }],
      ['connecting-ridge-close', { site: DEMO, utc: DEMO_UTC, level: 'site', az: 0, el: 25, dist: 5 }],
      ['shackleton-rim-site04-site', { site: 'shackleton-rim-site04', utc: DEMO_UTC, level: 'site' }],
      ['im-1-site', { site: 'im-1', utc: DEMO_UTC, level: 'site' }],
    ]
    for (const [name, o] of shots) {
      const cam = await setView(page, o)
      const pos = (cam.position as number[]).map((v) => v.toFixed(1)).join(', ')
      console.log(`terrain-${name}-${tag}: camera ${cam.level} at [${pos}] m, view ${JSON.stringify(cam.view)}`)
      await page.screenshot({ path: `${SHOTS}/terrain-${name}-${tag}.png` })
    }
  })
})
