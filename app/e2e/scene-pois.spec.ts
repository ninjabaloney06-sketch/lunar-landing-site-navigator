// Scene track, 14 Nov: points of interest in the scene (S4) and the pin region on the globe (S5), on the scene
// harness through the handle the app gets (__scene.handle()). The POIs here are made up for the test (a ring of
// places around the pole and a few at stated distances from the site); the app passes the real ones.
// Run: PW_PORT=5181 npx playwright test e2e/scene-pois.spec.ts --workers=1
import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import type { Site } from '../src/data/types'
import { siteVector } from '../src/geometry'
import { POI_NEAR_KM } from '../src/scene3d/pins'
import { PIN_REGION_NORTH_LAT, inPinRegion } from '../src/scene3d/region'

const APP = fileURLToPath(new URL('..', import.meta.url))
const sites = JSON.parse(fs.readFileSync(`${APP}public/data/sites.json`, 'utf8')) as Site[]
const RIDGE = sites.find((s) => s.id === 'connecting-ridge')!
const UTC = '2027-08-16T12:00:00Z'
const D2R = Math.PI / 180

interface Poi {
  id: string
  name: string
  lat: number
  lon: number
  color: string
  landing: boolean
}
type Pt = { x: number; y: number; visible: boolean }
interface Named extends Pt {
  name: string
  poiId?: string
}
interface Scene {
  ready: Promise<void>
  setView(o: Record<string, unknown>): Promise<Record<string, unknown>>
  handle(): { setPois(p: Poi[]): void; named(): Named | null; project(n: string): Pt | null }
  named(): Named | null
  projectPoi(id: string): Pt | null
  projectPin(id: string): Pt | null
  projectMe(p: number[]): Pt | null
  pins(): { globe: number; near: { kind: string; id: string; shape: string; base: number[]; ground: number; sphere: number }[] }
  renderInfo(): { calls: number; triangles: number }
  region(): { boundary: number[][]; cap: number[][]; color: number[] } | null
  showRegion(on: boolean): void
  advance(ms: number): void
}
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>
const setView = (page: Page, o: Record<string, unknown>) => page.evaluate((o) => (window as unknown as { __scene: Scene }).__scene.setView(o), o)
const setPois = (page: Page, pois: Poi[]) =>
  page.evaluate(async (pois) => {
    const s = (window as unknown as { __scene: Scene }).__scene
    s.handle().setPois(pois)
    s.advance(0) // draw, without placing the camera
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  }, pois)
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
async function open(page: Page) {
  await page.goto('/src/scene3d/harness.html?test=1')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
}
const kmBetween = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const p = siteVector(a.lat, a.lon, 0)
  const q = siteVector(b.lat, b.lon, 0)
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}
/** A place `km` from the ridge site toward the pole side given by `bearing` (flat approximation near the pole). */
function near(km: number, bearing: number): { lat: number; lon: number } {
  const [x, y] = siteVector(RIDGE.lat, RIDGE.lon, 0)
  const px = x + km * Math.cos(bearing * D2R)
  const py = y + km * Math.sin(bearing * D2R)
  const r = Math.hypot(px, py)
  return { lat: -Math.acos(Math.min(1, r / 1737.4)) / D2R, lon: Math.atan2(py, px) / D2R }
}
const COLORS = ['#e5484d', '#4aa8ff', '#8e7cf0', '#f2c94c', '#3ecf8e']
const MAGENTA = '#ff00ff' // no other thing in the picture has this colour
// 170 points of interest: 164 in rings around the pole, and six at stated distances from the ridge site.
const ring: Poi[] = Array.from({ length: 164 }, (_, i) => ({
  id: `ring:${i}`,
  name: `Ring ${i}`,
  lat: -80.5 - (i % 4) * 0.9,
  lon: -180 + (i * 360) / 164,
  color: COLORS[i % COLORS.length],
  landing: i % 20 === 0,
}))
const local: Poi[] = [
  { id: 'near:3', name: 'Three km out', ...near(3, 40), color: MAGENTA, landing: false },
  { id: 'near:12', name: 'Twelve km out', ...near(12, 200), color: '#4aa8ff', landing: false },
  { id: 'near:35', name: 'Thirty-five km out', ...near(35, 300), color: '#3ecf8e', landing: true },
  { id: 'near:55', name: 'Fifty-five km out', ...near(55, 110), color: '#f2c94c', landing: false },
  { id: 'far:70', name: 'Seventy km out', ...near(70, 20), color: '#e5484d', landing: false },
  { id: 'far:150', name: 'A hundred and fifty km out', ...near(150, 250), color: '#8e7cf0', landing: false },
]
const POIS = [...ring, ...local]

/** A ring POI on the near side whose head has no site pin within 45 px and no other POI head within 14 px. */
const freePoi = (page: Page) =>
  page.evaluate(
    ([ids, siteIds]) => {
      const s = (window as unknown as { __scene: Scene }).__scene
      const heads = ids.map((id) => ({ id, p: s.projectPoi(id) }))
      const pins = siteIds.map((id) => s.projectPin(id)).filter((p): p is Pt => p !== null)
      for (const h of heads) {
        if (!h.p || !h.p.visible || h.p.x < 60 || h.p.y < 60 || h.p.x > 1220 || h.p.y > 660) continue
        if (pins.some((q) => Math.hypot(q.x - h.p!.x, q.y - h.p!.y) < 45)) continue
        if (heads.some((o) => o !== h && o.p && Math.hypot(o.p.x - h.p!.x, o.p.y - h.p!.y) < 14)) continue
        return { id: h.id, x: h.p.x, y: h.p.y }
      }
      return null
    },
    [ring.map((r) => r.id), sites.map((x) => x.id)] as const,
  )

test.describe('S4: points of interest', () => {
  test('globe: every given POI is a pin, in three draw calls; hovering one names it with its poiId; a site pin wins', async ({ page }) => {
    await open(page)
    await setView(page, { site: RIDGE.id, utc: UTC, level: 'globe', el: -72, az: RIDGE.lon, dist: 3200 })
    const before = await scene(page, (s) => s.renderInfo())
    expect((await scene(page, (s) => s.pins())).globe).toBe(0)
    await setPois(page, POIS)
    expect(POIS.length).toBe(170)
    expect((await scene(page, (s) => s.pins())).globe, 'every given POI is drawn on the globe').toBe(170)
    const after = await scene(page, (s) => s.renderInfo())
    expect(after.calls - before.calls, '170 pins cost at most three draw calls (stems, round heads, triangles)').toBeLessThanOrEqual(3)
    await page.screenshot({ path: 'test-results/s4-globe-170-pois.png' })

    // The magenta one is where its coordinates project, in its colour.
    const p = (await scene(page, (s) => s.projectPoi('near:3')))!
    expect(p.visible).toBe(true)
    const png = PNG.sync.read(await page.screenshot())
    let magenta = 0
    for (let y = Math.round(p.y) - 7; y <= Math.round(p.y) + 7; y++) {
      for (let x = Math.round(p.x) - 7; x <= Math.round(p.x) + 7; x++) {
        const i = (y * png.width + x) * 4
        if (png.data[i] > 200 && png.data[i + 1] < 60 && png.data[i + 2] > 200) magenta++
      }
    }
    expect(magenta, 'magenta pixels at the POI head').toBeGreaterThan(8)

    // Hover: the name and the poiId; away: nothing.
    const free = (await freePoi(page))!
    expect(free, 'a POI with nothing else near it on screen').not.toBeNull()
    await page.mouse.move(free.x, free.y)
    await frames(page)
    const n = await scene(page, (s) => s.handle().named())
    expect(n?.poiId).toBe(free.id)
    expect(n?.name).toBe(ring.find((r) => r.id === free.id)!.name)
    expect(n?.visible).toBe(true)
    expect(Math.hypot(n!.x - free.x, n!.y - free.y)).toBeLessThan(1)
    // Between a POI's head and a site pin's head, within reach of both: the site pin is the one named.
    // (3 km from the ridge site is a fraction of a pixel on the globe: the two pins share a foot.)
    const siteHead = (await scene(page, (s) => s.handle().project('site')))!
    expect(Math.hypot(siteHead.x - p.x, siteHead.y - p.y), 'the two heads are less than 20 px apart').toBeLessThan(20)
    await page.mouse.move((siteHead.x + p.x) / 2, (siteHead.y + p.y) / 2)
    await frames(page)
    const both = await scene(page, (s) => s.handle().named())
    expect(sites.map((x) => x.name), 'a site pin wins over a POI').toContain(both?.name)
    expect(both?.poiId).toBeUndefined()
    await page.mouse.move(40, 40)
    await frames(page)
    expect(await scene(page, (s) => s.handle().named())).toBeNull()

    // A POI behind the Moon is not named: look from the north.
    await setView(page, { level: 'globe', el: 60, az: 0, dist: 6500 })
    const hidden = (await page.evaluate((id) => (window as unknown as { __scene: Scene }).__scene.projectPoi(id), free.id))!
    await page.mouse.move(hidden.x, hidden.y)
    await frames(page)
    expect(await scene(page, (s) => s.handle().named()), 'behind the Moon').toBeNull()

    // setPois([]) removes all of them.
    await setPois(page, [])
    expect((await scene(page, (s) => s.pins())).globe).toBe(0)
    expect((await scene(page, (s) => s.renderInfo())).calls).toBe(before.calls)
    await page.mouse.move(free.x, free.y)
    await frames(page)
    expect(await scene(page, (s) => s.handle().named())).toBeNull()
  })

  test('site and eye level: only POIs and other landing sites within POI_NEAR_KM are drawn, standing on the terrain; hover names them', async ({ page }) => {
    await open(page)
    await setView(page, { site: RIDGE.id, utc: UTC, level: 'site' })
    await setPois(page, POIS)
    const drawn = await scene(page, (s) => s.pins())
    // Expected sets, computed here from the coordinates.
    const nearPois = POIS.filter((p) => kmBetween(p, RIDGE) <= POI_NEAR_KM).map((p) => p.id).sort()
    const nearSites = sites.filter((s) => s.id !== RIDGE.id && kmBetween(s, RIDGE) <= POI_NEAR_KM).map((s) => s.id).sort()
    console.log(`S4: within ${POI_NEAR_KM} km of ${RIDGE.id}: ${nearPois.length} of ${POIS.length} POIs, ${nearSites.length} of ${sites.length - 1} other sites (${nearSites.join(', ')})`)
    expect(drawn.near.filter((n) => n.kind === 'poi').map((n) => n.id).sort()).toEqual(nearPois)
    expect(drawn.near.filter((n) => n.kind === 'site').map((n) => n.id).sort()).toEqual(nearSites)
    for (const id of ['near:3', 'near:12', 'near:35', 'near:55']) expect(nearPois, id).toContain(id)
    for (const id of ['far:70', 'far:150']) expect(nearPois, id).not.toContain(id)
    expect(nearSites.length, 'the ridge has landing sites within reach').toBeGreaterThan(0)
    expect(nearPois.length).toBeLessThan(POIS.length / 2)
    expect(drawn.globe, 'the globe still has all of them').toBe(170)
    // Each pin stands on the terrain under it, not on the smooth sphere.
    for (const n of drawn.near) expect(n.base[2], `${n.id} stands on the terrain`).toBeCloseTo(n.ground, 6)
    expect(drawn.near.filter((n) => Math.abs(n.ground - n.sphere) > 20).length, 'pins on real relief, away from the sphere').toBeGreaterThan(drawn.near.length / 2)
    expect(drawn.near.find((n) => n.id === 'near:35')!.shape).toBe('site')
    expect(drawn.near.find((n) => n.id === 'near:3')!.shape).toBe('poi')
    await page.screenshot({ path: 'test-results/s4-site-near-pois.png' })

    // Hover at site level, from a camera that looks down on the pin.
    await setView(page, { level: 'site', az: 40, el: 50, dist: 12 })
    const p = (await scene(page, (s) => s.projectPoi('near:3')))!
    expect(p.visible).toBe(true)
    await page.mouse.move(p.x, p.y)
    await frames(page)
    const n = await scene(page, (s) => s.handle().named())
    expect(n?.poiId).toBe('near:3')
    expect(n?.name).toBe('Three km out')
    expect(await scene(page, (s) => s.projectPoi('far:70')), 'a POI beyond the radius has no pin here').toBeNull()

    // Eye level: the same pins, and the nearest is in the picture when the camera faces it.
    await setView(page, { level: 'eye', az: 50, el: 2 })
    const eye = await scene(page, (s) => s.pins())
    expect(eye.near.map((n) => n.id).sort()).toEqual(drawn.near.map((n) => n.id).sort())
    await page.screenshot({ path: 'test-results/s4-eye-near-pois.png' })

    // Another site: the set follows it.
    await setView(page, { site: 'im-1', utc: UTC, level: 'site' })
    const im1 = sites.find((s) => s.id === 'im-1')!
    const atIm1 = await scene(page, (s) => s.pins())
    expect(atIm1.near.filter((n) => n.kind === 'poi').map((n) => n.id).sort()).toEqual(POIS.filter((p) => kmBetween(p, im1) <= POI_NEAR_KM).map((p) => p.id).sort())
    expect(atIm1.near.some((n) => n.id === 'near:3')).toBe(false)

    await setPois(page, [])
    expect((await scene(page, (s) => s.pins())).near.filter((n) => n.kind === 'poi')).toEqual([])
  })

  test('touch: a tap on a POI names it', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true })
    const page = await ctx.newPage()
    await open(page)
    await setView(page, { site: RIDGE.id, utc: UTC, level: 'globe', el: -72, az: RIDGE.lon, dist: 3200 })
    await setPois(page, POIS)
    const free = (await freePoi(page))!
    await page.touchscreen.tap(free.x, free.y)
    await frames(page)
    expect((await scene(page, (s) => s.handle().named()))?.poiId).toBe(free.id)
    // A tap elsewhere takes the name away.
    await page.touchscreen.tap(40, 40)
    await frames(page)
    expect(await scene(page, (s) => s.handle().named())).toBeNull()
    await ctx.close()
  })
})

test.describe('S5: the pin region on the globe', () => {
  test('the boundary is drawn at PIN_REGION_NORTH_LAT, the tint lies south of it, and nothing changes north of it', async ({ page }) => {
    await open(page)
    await setView(page, { site: RIDGE.id, utc: UTC, level: 'globe', el: -55, az: 20, dist: 5200 })
    const region = (await scene(page, (s) => s.region()))!
    expect(region).not.toBeNull()
    // Every vertex of the drawn line is at the constant's latitude.
    expect(region.boundary.length).toBeGreaterThan(180)
    for (const v of region.boundary) {
      const lat = Math.asin(v[2] / Math.hypot(...v)) / D2R
      expect(lat).toBeCloseTo(PIN_REGION_NORTH_LAT, 6)
      expect(Math.hypot(...v), 'just above the surface').toBeLessThan(1737.4 + 2)
    }
    // Every vertex of the tint is in the region.
    for (const v of region.cap) expect(inPinRegion(Math.asin(v[2] / Math.hypot(...v)) / D2R - 1e-9)).toBe(true)

    await page.screenshot({ path: 'test-results/s5-pin-region-globe.png' })
    const on = PNG.sync.read(await page.screenshot())
    await scene(page, (s) => {
      s.showRegion(false)
      s.advance(0)
    })
    await frames(page)
    const off = PNG.sync.read(await page.screenshot())
    await scene(page, (s) => s.showRegion(true))
    const delta = (x: number, y: number) => {
      const i = (Math.round(y) * on.width + Math.round(x)) * 4
      return Math.abs(on.data[i] - off.data[i]) + Math.abs(on.data[i + 1] - off.data[i + 1]) + Math.abs(on.data[i + 2] - off.data[i + 2])
    }
    // On the line: boundary points on the near side change the picture, on the lit and on the dark side.
    const pts = Array.from({ length: 72 }, (_, k) => {
      const lon = k * 5
      return { lon, me: siteVector(PIN_REGION_NORTH_LAT, lon, 0.5) }
    })
    let onLine = 0
    let seen = 0
    for (const p of pts) {
      const sp = await page.evaluate((me) => (window as unknown as { __scene: Scene }).__scene.projectMe(me), p.me)
      if (!sp || !sp.visible) continue
      seen++
      let best = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) best = Math.max(best, delta(sp.x + dx, sp.y + dy))
      if (best > 30) onLine++
    }
    expect(seen, 'boundary points on the near side').toBeGreaterThan(20)
    // IM-1 lies 0.13° south of the boundary: its pin stands on the line and covers it at one of the points.
    expect(onLine, 'the line is drawn at every one of them (a site pin may cover one)').toBeGreaterThanOrEqual(seen - 1)
    // South of it: a restrained tint. North of it: no change at all.
    const inside = await page.evaluate((me) => (window as unknown as { __scene: Scene }).__scene.projectMe(me), siteVector(PIN_REGION_NORTH_LAT - 4, 30, 0))
    const outside = await page.evaluate((me) => (window as unknown as { __scene: Scene }).__scene.projectMe(me), siteVector(PIN_REGION_NORTH_LAT + 6, 30, 0))
    expect(inside?.visible && outside?.visible).toBe(true)
    let tint = 0
    let untouched = 0
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        tint += delta(inside!.x + dx, inside!.y + dy)
        untouched += delta(outside!.x + dx, outside!.y + dy)
      }
    }
    console.log(`S5: mean change of a pixel inside the region ${(tint / 81 / 3).toFixed(1)} of 255, outside ${(untouched / 81 / 3).toFixed(1)}; ${onLine}/${seen} boundary points on the line`)
    expect(tint / 81 / 3, 'a tint, visible').toBeGreaterThan(2)
    expect(tint / 81 / 3, 'and restrained: the texture stays readable').toBeLessThan(40)
    expect(untouched, 'nothing north of the boundary').toBe(0)
    await setView(page, { level: 'globe', el: -68, az: 20, dist: 3100 })
    await page.screenshot({ path: 'test-results/s5-pin-region-close.png' })
  })
})
