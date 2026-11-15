// U19 / U5 / U16 (15 Nov): the eye-level camera never stands inside the drawn terrain. "Eye level" from the View
// menu at every prepared site and at 20 custom points, before and after the near terrain level has loaded, and
// walks to points on every terrain level: the camera stays OBSERVER_HEIGHT_M (1.75 m) above the drawn ground
// under it at every frame. The drawn ground is measured independently of the camera code: a ray straight down
// through the visible terrain meshes (__scene.eyeClearance, site.ts drawnZ).
// Run: PW_GPU=1 PW_PORT=5181 npx playwright test e2e/eye-level.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { PIN_REGION_NORTH_LAT } from '../src/scene3d/region'

const EYE_M = 1.75
// The eye-level camera orbits its target 1 cm away (index.ts setControls), so its height moves by up to 1 cm as the
// view turns; 2 cm of slack for that.
const TOL_M = 0.02
const SITES = [
  'haworth', 'malapert-massif', 'nobile-rim-1', 'nobile-rim-2', 'de-gerlache-rim-2', 'amundsen-rim', 'connecting-ridge-extension', 'faustini-rim-a',
  'leibnitz-beta-plateau', 'peak-near-shackleton', 'de-gerlache-rim-1', 'de-gerlache-kocher-massif', 'malapert-site23', 'shackleton-rim-site04',
  'connecting-ridge', 'im-1', 'im-2-intended', 'viper-mons-mouton',
]
const AUG = 'shackleton-2027-08'

// 20 custom points in the pin region, fixed so every run tests the same ones (Park–Miller generator, seed 19).
const CUSTOM: string[] = (() => {
  let s = 19
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  return Array.from({ length: 20 }, () => {
    const lat = -89.5 + (89.5 + PIN_REGION_NORTH_LAT - 0.2) * rnd() // -89.5 to -80.2
    const lon = -180 + 360 * rnd()
    return `cap:${lat.toFixed(5)},${lon.toFixed(5)}`
  })
})()

type Clear = { level: string; position: number[]; drawn: number | null; ground: number; clearance: number | null }
type Scene = {
  ready: Promise<void>
  siteId(): string | null
  eyeClearance(): Clear
  nearLevel(on: boolean): Promise<void>
  walkTo(x: number, y: number): boolean
  levelSpecs(): { name: string; ext: number }[]
}
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>

async function openSite(page: Page, id: string) {
  await page.goto(`/?test=1#site=${encodeURIComponent(id)}&period=${AUG}&view=site`)
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
  await page.waitForFunction((id) => (window as unknown as { __scene: Scene }).__scene.siteId() === id, id, { timeout: 60_000 })
}

/** The lowest clearance over every animation frame for `ms`. */
async function lowestClearance(page: Page, ms: number): Promise<Clear & { frames: number }> {
  return page.evaluate((ms) => {
    const s = (window as unknown as { __scene: Scene }).__scene
    return new Promise<Clear & { frames: number }>((done) => {
      let worst: Clear | null = null
      let frames = 0
      const t0 = performance.now()
      const step = () => {
        const c = s.eyeClearance()
        frames++
        if (!worst || (c.clearance ?? -Infinity) < (worst.clearance ?? -Infinity)) worst = c
        if (performance.now() - t0 < ms) requestAnimationFrame(step)
        else done({ ...worst!, frames })
      }
      requestAnimationFrame(step)
    })
  }, ms)
}

async function eyeLevel(page: Page) {
  await page.getByTestId('view').click()
  await page.getByTestId('view-menu').getByRole('menuitem', { name: 'Eye level', exact: true }).click()
  await expect.poll(() => scene(page, (s) => s.eyeClearance().level)).toBe('eye')
}

function expectAbove(c: Clear & { frames: number }, what: string) {
  // Each sample casts a ray through every terrain triangle (about 1.5 million): a few frames per second only, with
  // several workers sharing the GPU. Every frame the page draws in the sampling time is still checked.
  expect(c.frames, `${what}: frames sampled`).toBeGreaterThan(2)
  expect(c.clearance, `${what}: drawn terrain under the camera`).not.toBeNull()
  expect(c.clearance!, `${what}: camera ${c.position.map((v) => v.toFixed(2)).join(', ')} over drawn ground ${c.drawn}`).toBeGreaterThanOrEqual(EYE_M - TOL_M)
}

test.describe('U19: "Eye level" never puts the camera inside the terrain', () => {
  test.describe.configure({ mode: 'parallel' })
  for (const id of [...SITES, ...CUSTOM]) {
    test(`${id}: before and after the near level has loaded`, async ({ page }) => {
      await openSite(page, id)
      await eyeLevel(page)
      expectAbove(await lowestClearance(page, 2500), `${id}, first terrain`)
      // The near level (160 m, ±40 km) arrives after the first picture; in test mode only on request.
      await scene(page, (s) => s.nearLevel(true))
      expectAbove(await lowestClearance(page, 2500), `${id}, with the near level`)
    })
  }
})

test.describe('U5: a walk or a point viewpoint stands the camera 1.75 m above the drawn terrain on every level', () => {
  test.describe.configure({ mode: 'parallel' })
  for (const id of ['malapert-massif', 'amundsen-rim', 'de-gerlache-kocher-massif', CUSTOM[3]]) {
    test(`${id}: 40 walks out to 55 km`, async ({ page }) => {
      await openSite(page, id)
      await eyeLevel(page)
      let worst = Infinity
      let at = ''
      for (let k = 0; k < 40; k++) {
        // Distances spread over the fine level, the 80 m tile, the strips and mid (u19 report: up to 35 m gap there).
        const r = 300 + 54_000 * (k / 39) ** 2
        const a = k * 2.399963 // golden angle
        const x = r * Math.cos(a)
        const y = r * Math.sin(a)
        expect(await page.evaluate(([x, y]) => (window as unknown as { __scene: Scene }).__scene.walkTo(x, y), [x, y])).toBe(true)
        const c = await scene(page, (s) => s.eyeClearance())
        if (c.clearance !== null && c.clearance < worst) {
          worst = c.clearance
          at = `${x.toFixed(0)}, ${y.toFixed(0)} m`
        }
      }
      expect(worst, `${id}: lowest clearance at ${at}`).toBeGreaterThanOrEqual(EYE_M - TOL_M)
    })
  }
})
