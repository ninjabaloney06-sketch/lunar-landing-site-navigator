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
  terrainAt(x: number, y: number): { x: number; y: number; z: number } | null
  level(): string
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

// ---------- walk (notebook note 6; ninja, 14 Nov) ----------

const RIDGE = 'connecting-ridge'
const AUG = 'shackleton-2027-08'

async function openApp(page: Page, hash: string) {
  await page.goto(`/?test=1#${hash}`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
}

/** The four scientific selections in the link: site, period (with custom start and length), cursor, stations. */
async function selection(page: Page) {
  // The link is written 400 ms after the last change.
  await page.waitForTimeout(700)
  return page.evaluate(() => {
    const p = new URLSearchParams(location.hash.slice(1))
    return ['site', 'period', 'from', 'days', 't', 'st'].map((k) => `${k}=${p.get(k)}`).join('&')
  })
}

test.describe('walk: a left-click on terrain moves the camera only', () => {
  test('harness: a click at site level stands the camera 1.75 m above the clicked terrain point; a click at eye level walks on', async ({ page }) => {
    await openHarness(page)
    await page.evaluate(() => (window as unknown as { __scene: Scene }).__scene.setView({ site: 'connecting-ridge', utc: '2027-08-16T12:00:00Z', level: 'site' }))
    const spot = (await scene(page, (s) => s.terrainAt(700, 420)))!
    expect(spot, 'terrain under the click').not.toBeNull()
    await page.mouse.click(700, 420)
    await frames(page)
    const a = await camera(page)
    expect(a.level).toBe('eye')
    expect(Math.hypot(a.position[0] - spot.x, a.position[1] - spot.y), 'on the clicked spot').toBeLessThan(1e-6)
    expect(a.position[2] - spot.z, '1.75 m above the terrain').toBeCloseTo(1.75, 6)
    expect(await scene(page, (s) => s.surfaceDist())).toBeCloseTo(1.75, 6)
    // At eye level: click the ground ahead and the camera walks there.
    const ahead = (await scene(page, (s) => s.terrainAt(640, 600)))!
    expect(ahead).not.toBeNull()
    await page.mouse.click(640, 600)
    await frames(page)
    const b = await camera(page)
    expect(b.level).toBe('eye')
    expect(Math.hypot(b.position[0] - ahead.x, b.position[1] - ahead.y)).toBeLessThan(1e-6)
    expect(await scene(page, (s) => s.surfaceDist())).toBeCloseTo(1.75, 6)
    expect(dist(a.position, b.position), 'the camera moved').toBeGreaterThan(0.5)
    // A click on the sky moves nothing; a drag of more than 5 px is not a click.
    await page.mouse.click(640, 40)
    await frames(page)
    expect(dist((await camera(page)).position, b.position)).toBe(0)
    await page.mouse.move(640, 600)
    await page.mouse.down()
    await page.mouse.move(700, 600, { steps: 3 })
    await page.mouse.up()
    await frames(page)
    expect(dist((await camera(page)).position, b.position), 'a drag turns the view, the camera stays within its 1 cm orbit').toBeLessThan(0.03)
    // Eye level again (the E key in the harness, "Eye level" in the app) is back on the landing site.
    const home = await page.evaluate(() => (window as unknown as { __scene: Scene }).__scene.setView({ level: 'eye' }))
    expect(Math.hypot(home.position[0], home.position[1])).toBeLessThan(1e-9)
  })

  test('app: a left-click on terrain moves the camera and leaves site, period, cursor and stations in the hash unchanged', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openApp(page, `site=${RIDGE}&period=${AUG}&t=2027-08-20T06:00Z&st=goldstone,madrid`)
    const before = await selection(page)
    const answer = await page.getByTestId('answer').innerText()
    const a = await camera(page)
    expect(a.level).toBe('site')
    const spot = (await scene(page, (s) => s.terrainAt(900, 430)))!
    expect(spot).not.toBeNull()
    await page.mouse.click(900, 430)
    await expect.poll(() => scene(page, (s) => s.level())).toBe('eye')
    const b = await camera(page)
    expect(Math.hypot(b.position[0] - spot.x, b.position[1] - spot.y)).toBeLessThan(1e-6)
    expect(await scene(page, (s) => s.surfaceDist())).toBeCloseTo(1.75, 6)
    expect(await selection(page)).toBe(before)
    // The answer still names the selected site and has not changed.
    await expect(page.getByTestId('answer')).toHaveAttribute('data-site-id', RIDGE)
    expect(await page.getByTestId('answer').innerText()).toBe(answer)
    await expect(page.getByTestId('site-name')).toHaveText('Connecting Ridge')
    // The link's view becomes eye level; that change does not move the camera back to the landing site.
    expect(dist((await camera(page)).position, b.position)).toBe(0)
    // A click that only closes the Mission panel is not a walk.
    await page.getByTestId('mission').click()
    await expect(page.getByTestId('mission-panel')).toBeVisible()
    await page.mouse.click(1000, 430)
    await expect(page.getByTestId('mission-panel')).toBeHidden()
    await page.waitForTimeout(300)
    expect(dist((await camera(page)).position, b.position)).toBe(0)
    expect(await selection(page)).toBe(before)
  })
})
