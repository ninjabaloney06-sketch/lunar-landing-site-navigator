// The 3D sky agrees with the computed horizon: at a time the mask hides the Sun from the landing site, the orbit
// camera (which looks from above and aside and can see over the ridge) must not draw a bright Sun disc; the eye
// at the site sees nothing above the skyline. Before the fix the same picture showed a bright dot above the terrain.
// Run: PW_PORT=5212 PW_GPU=1 npx playwright test e2e/sky-agrees-with-horizon.spec.ts --workers=1
import { expect, test, type Page } from '@playwright/test'

interface Pt {
  x: number
  y: number
  visible: boolean
  belowHorizon?: boolean
}
interface Scene {
  ready: Promise<void>
  setView(o: Record<string, unknown>): Promise<unknown>
  project(n: string): Pt | null
  sunAzEl(): { az: number; el: number } | null
}
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>

async function open(page: Page) {
  await page.goto('/src/scene3d/harness.html?test=1')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
}

/** Brightest pixel (max of r, g, b, 0..255) within `r` px of (x, y) in the page's current picture. */
async function brightestNear(page: Page, x: number, y: number, r = 9): Promise<number> {
  const shot = await page.screenshot()
  return page.evaluate(
    async ([b64, x, y, r]) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
      const c = new OffscreenCanvas(bmp.width, bmp.height)
      const g = c.getContext('2d')!
      g.drawImage(bmp, 0, 0)
      const d = g.getImageData(Math.max(0, Math.round(x as number) - (r as number)), Math.max(0, Math.round(y as number) - (r as number)), 2 * (r as number) + 1, 2 * (r as number) + 1).data
      let best = 0
      for (let i = 0; i < d.length; i += 4) best = Math.max(best, d[i], d[i + 1], d[i + 2])
      return best
    },
    [shot.toString('base64'), x, y, r] as const,
  )
}

// Times used below (inline: page.evaluate cannot see module constants). Connecting Ridge, 1 Sep 2027 00:00 UTC: Sun +1.1 deg,
// horizon mask +2.5 deg at its azimuth (answer: dark). 26 Aug 2027 00:00 UTC: Sun +1.0 deg, mask -0.5 deg (answer: sunlight).

test('site level, dark time: the Sun is drawn hollow, not as a bright disc above the terrain', async ({ page }) => {
  await open(page)
  await scene(page, (s) => s.setView({ site: 'connecting-ridge', utc: '2027-09-01T00:00:00Z', level: 'site' }))
  const sun = await scene(page, (s) => s.project('sun'))
  expect(sun?.visible, 'the marker is on screen from the orbit camera').toBe(true)
  expect(sun?.belowHorizon, 'the computed mask hides the Sun from the site').toBe(true)
  const dark = await brightestNear(page, sun!.x, sun!.y)
  await page.screenshot({ path: 'test-results/sky-fix/e2e-dark-site.png' })
  // A drawn Sun is (1, .95, .86) x 8 clipped to white; the outline is a dim grey ring at 80 % opacity.
  expect(dark, 'no bright Sun pixels').toBeLessThan(200)

  await scene(page, (s) => s.setView({ utc: '2027-08-26T00:00:00Z' }))
  const lit = await scene(page, (s) => s.project('sun'))
  expect(lit?.belowHorizon).toBe(false)
  expect(await brightestNear(page, lit!.x, lit!.y), 'a Sun the mask shows is still a bright disc').toBeGreaterThan(230)
})

test('eye level, dark time: nothing bright at the Sun direction, the label point is behind terrain', async ({ page }) => {
  await open(page)
  await scene(page, (s) => s.setView({ site: 'connecting-ridge', utc: '2027-09-01T00:00:00Z', level: 'eye' }))
  await scene(page, (s) => s.setView({ level: 'eye', az: s.sunAzEl()!.az, el: s.sunAzEl()!.el + 1 }))
  const sun = await scene(page, (s) => s.project('sun'))
  expect(sun?.belowHorizon).toBe(true)
  expect(sun?.visible).toBe(false)
  expect(await brightestNear(page, 640, 400, 40)).toBeLessThan(200)
})
