// Brief C4 (free-look camera, viewpoints, user points, Simulate) and the notebook notes built with it.
// Camera tests run on the scene harness, the rest on the app. Run: PW_PORT=5184 npx playwright test e2e/c4.spec.ts
import { expect, test, type Page } from '@playwright/test'

interface Cam {
  level: string
  position: number[]
  forward: number[]
  fov: number
  width: number
  height: number
}
type Scene = {
  ready: Promise<void>
  setView(o: Record<string, unknown>): Promise<Cam>
  camera(): Cam
  surfaceDist(): number
  skySize(b: string): number | null
}
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) =>
  page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
const camera = (page: Page) => scene(page, (s) => s.camera())
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const angleDeg = (a: number[], b: number[]) =>
  (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) / Math.PI

async function openHarness(page: Page) {
  await page.goto('/src/scene3d/harness.html?test=1')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
}

async function middleDrag(page: Page, dx: number, dy: number) {
  await page.mouse.move(640, 360)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(640 + dx / 2, 360 + dy / 2)
  await page.mouse.move(640 + dx, 360 + dy)
  await page.mouse.up({ button: 'middle' })
  await frames(page)
}

async function wheel(page: Page, deltaY: number, times = 1) {
  await page.mouse.move(640, 360)
  for (let i = 0; i < times; i++) await page.mouse.wheel(0, deltaY)
  await frames(page)
}

test.describe('C4 part 1: camera controls (harness, 1280 × 720)', () => {
  test('middle-drag changes the view direction and leaves the camera position within 1e-6, at all three levels', async ({ page }) => {
    await openHarness(page)
    for (const level of ['globe', 'site', 'eye']) {
      const a = await page.evaluate((l) => (window as unknown as { __scene: Scene }).__scene.setView({ site: 'connecting-ridge', utc: '2027-08-16T12:00:00Z', level: l }), level)
      expect(a.level).toBe(level)
      await middleDrag(page, 160, 60)
      const b = await camera(page)
      expect(b.level).toBe(level)
      expect(dist(a.position, b.position), `${level}: camera position`).toBeLessThan(1e-6)
      // 160 px right and 60 px down at 54° over 720 px: about 12° sideways and 4.5° of pitch.
      const turned = angleDeg(a.forward, b.forward)
      expect(turned, `${level}: view direction turned`).toBeGreaterThan(8)
      expect(turned, `${level}: view direction turned`).toBeLessThan(16)
      // A second drag starts from where the first ended, and the camera still has not moved.
      await middleDrag(page, -300, 0)
      const c = await camera(page)
      expect(dist(a.position, c.position), `${level}: camera position after a second drag`).toBeLessThan(1e-6)
      expect(angleDeg(b.forward, c.forward), `${level}: second drag turned`).toBeGreaterThan(15)
    }
  })

  test('wheel moves the camera along the view direction and stops at the floor (1.75 m above terrain; the Moon is never entered)', async ({ page }) => {
    test.setTimeout(180_000)
    await openHarness(page)
    // Site level: look down at the ground beside the site.
    const a = await page.evaluate(() => (window as unknown as { __scene: Scene }).__scene.setView({ site: 'connecting-ridge', utc: '2027-08-16T12:00:00Z', level: 'site', az: 40, el: 35, dist: 6 }))
    const h0 = await scene(page, (s) => s.surfaceDist())
    await wheel(page, -100)
    const b = await camera(page)
    const moved = [0, 1, 2].map((i) => b.position[i] - a.position[i])
    const len = Math.hypot(...moved)
    expect(len, 'one notch moves the camera').toBeGreaterThan(0.05 * h0)
    expect(len, 'one notch covers at most 12 % of the distance to the surface').toBeLessThan(0.13 * h0)
    expect(angleDeg(moved.map((v) => v / len), a.forward), 'movement along the view direction').toBeLessThan(1e-3)
    expect(angleDeg(a.forward, b.forward), 'the view direction is unchanged').toBeLessThan(1e-6)
    // One notch back out: close to the start (the step follows the terrain height under the camera, so not exactly).
    await wheel(page, 100)
    expect(dist((await camera(page)).position, a.position)).toBeLessThan(0.02 * h0)
    let last = Infinity
    for (let i = 0; i < 40; i++) {
      await wheel(page, -400, 10)
      const h = await scene(page, (s) => s.surfaceDist())
      expect(h, 'never below the floor').toBeGreaterThanOrEqual(1.75 - 1e-6)
      if (Math.abs(h - last) < 1e-9) break
      last = h
    }
    const floor = await scene(page, (s) => s.surfaceDist())
    expect(floor, 'the camera stops 1.75 m above the terrain').toBeLessThan(1.75 + 0.02)
    const atFloor = await camera(page)
    await wheel(page, -400, 5)
    expect(dist((await camera(page)).position, atFloor.position), 'no movement at the floor').toBeLessThan(0.02)

    // Space scene: the wheel comes to rest above the Moon's surface and never passes through it.
    const g = await page.evaluate(() => (window as unknown as { __scene: Scene }).__scene.setView({ level: 'globe', el: -60, az: 20, dist: 6500 }))
    await wheel(page, -100)
    const g1 = await camera(page)
    const gm = [0, 1, 2].map((i) => g1.position[i] - g.position[i])
    expect(angleDeg(gm.map((v) => v / Math.hypot(...gm)), g.forward)).toBeLessThan(1e-3)
    for (let i = 0; i < 30; i++) await wheel(page, -400, 10)
    const low = await camera(page)
    const r = Math.hypot(...low.position)
    expect(r, 'outside the Moon').toBeGreaterThanOrEqual(1737.4 + 1 - 1e-6)
    expect(r, 'at rest just above the surface').toBeLessThan(1737.4 + 1.5)
    // Outward: the existing maximum distance stays the outer limit.
    for (let i = 0; i < 12; i++) await wheel(page, 400, 10)
    expect(Math.hypot(...(await camera(page)).position)).toBeLessThanOrEqual(20000 + 1e-6)
    for (let i = 0; i < 12; i++) await wheel(page, 400, 10)
    expect(Math.hypot(...(await camera(page)).position)).toBeGreaterThan(19000)
  })

  test('eye level: wheel changes the field of view, not the position; the Sun and Earth keep their computed size', async ({ page }) => {
    test.setTimeout(180_000)
    await openHarness(page)
    const a = await page.evaluate(() => (window as unknown as { __scene: Scene }).__scene.setView({ site: 'connecting-ridge', utc: '2027-08-16T12:00:00Z', level: 'eye', az: 120, el: 3, fov: 54 }))
    const size = await scene(page, (s) => [s.skySize('sun'), s.skySize('earth')])
    expect(a.fov).toBe(54)
    let fov = 54
    for (let i = 0; i < 6; i++) {
      await wheel(page, -100, 3)
      const c = await camera(page)
      expect(c.fov, 'wheel up narrows the field of view').toBeLessThan(fov)
      fov = c.fov
      expect(dist(c.position, a.position), 'the camera does not move').toBeLessThan(1e-9)
      expect(angleDeg(c.forward, a.forward)).toBeLessThan(1e-6)
      expect(await scene(page, (s) => [s.skySize('sun'), s.skySize('earth')]), 'body size is not scaled').toEqual(size)
    }
    await wheel(page, -400, 8)
    expect((await camera(page)).fov, 'narrowest lens').toBe(4)
    await wheel(page, 400, 8)
    expect((await camera(page)).fov, 'widest lens is the default').toBe(54)
    // Leaving eye level puts the default lens back.
    await wheel(page, -100, 5)
    const site = await page.evaluate(() => (window as unknown as { __scene: Scene }).__scene.setView({ level: 'site' }))
    expect(site.fov).toBe(54)
  })
})
