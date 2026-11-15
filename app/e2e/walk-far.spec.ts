// Two camera reports of 15 Nov.
// 1. "When I double click the place I marked I am shoved under the ground" (custom site 87.86° S 90.00° E, a crater
//    rim tens of km from the mast). Measured on that site (animated double-click 49 km out): the eye ended 1.75 m
//    above the drawn ground and 1.6 m above the data height, so not under the ground; but out there the terrain is
//    drawn from 400 m and 2 km means, and from 1.75 m above such a mesh the picture is one smooth ramp. A click now
//    walks only within 20 km of the site, the reach of the fine terrain (index.ts WALK_MAX_KM).
// 2. "We selected a point on the Moon to go to; it took 3 s to load, then zoomed in to the wrong point" / "a new
//    point set as landing site zooms to the wrong landing site and glitches back". The fly went down to the site
//    that was still loaded while the new site's data was on its way (index.ts expectSite).
// Run: PW_GPU=1 PW_PORT=5191 npx playwright test e2e/walk-far.spec.ts
import { expect, test, type Page } from '@playwright/test'

type Clear = { level: string; position: number[]; drawn: number | null; ground: number; clearance: number | null; overData: number | null }
type Scene = {
  ready: Promise<void>
  siteId(): string | null
  level(): string
  eyeClearance(): Clear
  nearLevel(on: boolean): Promise<void>
  nearReady(): Promise<void>
  walkTo(x: number, y: number): boolean
  setLevel(l: string): void
  setAnimated(on: boolean): void
  advance(ms: number): void
  flying(): boolean
  flyPose(): { flying: boolean; mix: number; position: number[]; site: number[] }
  terrainAt(x: number, y: number): { x: number; y: number; z: number } | null
}
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>

const CUSTOM = 'cap:-87.86000,90.00000' // the reported site
const EYE_M = 1.75
// The eye stands on the drawn triangles; the data height is bilinear in the same cells (80 m or finer within 20 km).
const DATA_TOL_M = 15

async function openScene(page: Page, hash: string, id: string) {
  await page.goto(`/?test=1#${hash}`)
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
  await page.waitForFunction((id) => (window as unknown as { __scene: Scene }).__scene.siteId() === id, id, { timeout: 60_000 })
}
async function openSite(page: Page, id: string) {
  await openScene(page, `site=${encodeURIComponent(id)}&period=shackleton-2027-08&view=site`, id)
  await scene(page, (s) => s.nearLevel(true))
  await scene(page, (s) => s.nearReady())
}

const walk = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as unknown as { __scene: Scene }).__scene.walkTo(x, y), [x, y])

function expectStanding(c: Clear, what: string) {
  expect(c.level, what).toBe('eye')
  expect(c.clearance, `${what}: eye above the drawn ground`).not.toBeNull()
  expect(c.clearance!, `${what}: eye above the drawn ground`).toBeGreaterThan(EYE_M - 0.25)
  expect(c.clearance!, `${what}: eye above the drawn ground`).toBeLessThan(EYE_M + 0.25)
  expect(c.overData, `${what}: eye against the terrain data`).not.toBeNull()
  expect(Math.abs(c.overData! - EYE_M), `${what}: eye against the terrain data (m)`).toBeLessThan(DATA_TOL_M)
}

test.use({ viewport: { width: 1600, height: 890 } })

test('a double-click far from the mast does not move the camera; one within 20 km stands on the ground', async ({ page }) => {
  test.setTimeout(180_000)
  await openSite(page, CUSTOM)
  const far = await scene(page, (s) => s.terrainAt(1600 * 0.38, 890 * 0.32))
  expect(far, 'terrain under the far click').not.toBeNull()
  expect(Math.hypot(far!.x, far!.y)).toBeGreaterThan(20_000)
  await page.mouse.dblclick(1600 * 0.38, 890 * 0.32)
  await page.waitForTimeout(500)
  expect(await scene(page, (s) => s.level())).toBe('site')

  const near = await scene(page, (s) => s.terrainAt(1600 * 0.5, 890 * 0.6))
  expect(near, 'terrain under the near click').not.toBeNull()
  expect(Math.hypot(near!.x, near!.y)).toBeLessThan(20_000)
  await page.mouse.dblclick(1600 * 0.5, 890 * 0.6)
  await expect.poll(() => scene(page, (s) => s.level())).toBe('eye')
  expectStanding(await scene(page, (s) => s.eyeClearance()), 'after the near click')
  await page.waitForTimeout(2500) // finer terrain may arrive
  expectStanding(await scene(page, (s) => s.eyeClearance()), 'a moment later')
  await page.screenshot({ path: 'test-results/walk-near.png' })
})

for (const id of [CUSTOM, 'connecting-ridge', 'malapert-massif', 'haworth']) {
  test(`walk targets around ${id}: within 20 km the eye is 1.75 m above the ground`, async ({ page }) => {
    test.setTimeout(240_000)
    await openSite(page, id)
    for (const [x, y] of [
      [5_000, 0],
      [0, -15_000],
      [-13_000, 13_000],
      [19_000, 0],
    ]) {
      expect(await walk(page, x, y), `walk to ${x}, ${y}`).toBe(true)
      expectStanding(await scene(page, (s) => s.eyeClearance()), `${id} at ${x}, ${y}`)
    }
    // Back at the site's own eye level: on the site.
    await scene(page, (s) => s.setLevel('site'))
    await scene(page, (s) => s.setLevel('eye'))
    const home = await scene(page, (s) => s.eyeClearance())
    expect(Math.hypot(home.position[0], home.position[1])).toBeLessThan(1)
    expect(home.clearance!).toBeGreaterThan(EYE_M - 0.25)
  })
}

test('another landing site chosen from the Moon view: no fly goes down to the old site while the new one loads', async ({ page }) => {
  test.setTimeout(180_000)
  const OLD = 'connecting-ridge'
  await openScene(page, `site=${OLD}&period=shackleton-2027-08&view=globe`, OLD)
  await scene(page, (s) => s.setAnimated(true))
  // The new site's data arrives late: later than the 2 s the scene used to wait before going to the old site.
  let release: () => void = () => undefined
  const held = new Promise<void>((r) => (release = r))
  await page.route('**/data/**', async (route) => {
    await held
    await route.continue()
  })
  // What "Set as landing site" on a new point does: the site and the landing-site view in one step.
  await page.evaluate((id) => {
    const p = new URLSearchParams(location.hash.slice(1))
    p.set('site', id)
    p.set('view', 'site')
    location.hash = p.toString()
  }, CUSTOM)
  for (let i = 0; i < 50; i++) {
    await scene(page, (s) => s.advance(100)) // 5 s of scene time
    const pose = await scene(page, (s) => s.flyPose())
    expect(pose.mix, `site scene in the picture after ${i * 100} ms, old site still loaded`).toBe(0)
    expect(await scene(page, (s) => s.level()), `level after ${i * 100} ms`).toBe('globe')
  }
  expect(await scene(page, (s) => s.siteId())).toBe(OLD)
  release()
  await page.waitForFunction((id) => (window as unknown as { __scene: Scene }).__scene.siteId() === id, CUSTOM, { timeout: 90_000 })
  for (let i = 0; i < 120 && (await scene(page, (s) => s.flying())); i++) await scene(page, (s) => s.advance(100))
  await expect.poll(() => scene(page, (s) => s.level())).toBe('site')
  expect(await scene(page, (s) => s.siteId())).toBe(CUSTOM)
})
