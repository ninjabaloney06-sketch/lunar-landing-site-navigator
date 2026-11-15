// Brief C4 (free-look camera, viewpoints, user points, Simulate) and the notebook notes built with it.
// Camera tests run on the scene harness, the rest on the app. Run: PW_PORT=5184 npx playwright test e2e/c4.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { PIN_REGION_NORTH_LAT } from '../src/scene3d/region'

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
    test.setTimeout(480_000) // about 30 s alone
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
    test.setTimeout(480_000) // about 30 s alone; each wheel event waits for a software-GL frame, minutes when two suites share the machine
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

// ---------- part 2: viewpoints ----------

// U14 (ninja, 15 Nov): "Moon" is the only viewpoint left; Point start, Point end, Earth, Sun and the solar-system top
// view were removed together with their tests.
const VIEW_LABELS = ['Moon']
const RADIUS_KM = { moon: 1737.4, earth: 6371, sun: 695700 }

type Body = { name: 'moon' | 'earth' | 'sun'; center: number[]; camera: number[] }
type SceneP2 = Scene & { bodies(): Body[]; goTo(v: string): Promise<boolean> }
const scene2 = <T>(page: Page, fn: (s: SceneP2) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>

/** Distance from the camera to each body's surface, km; all must be > 0. */
async function expectOutsideBodies(page: Page, what: string) {
  const bodies = await scene2(page, (s) => s.bodies())
  expect(bodies).toHaveLength(3)
  for (const b of bodies) expect(dist(b.camera, b.center) - RADIUS_KM[b.name], `${what}: camera outside the ${b.name}`).toBeGreaterThan(0)
  return { bodies }
}

async function chooseView(page: Page, label: string) {
  await page.getByTestId('view').click()
  await page.getByTestId('view-menu').getByRole('menuitem', { name: label, exact: true }).click()
  await frames(page)
}

test.describe('C4 part 2: viewpoints', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('the View button lists Landing site, Eye level and Moon, reachable by keyboard; Moon leaves the camera outside every body', async ({ page }) => {
    await openApp(page, `site=${RIDGE}&period=${AUG}&t=2027-08-20T06:00Z&st=goldstone,madrid`)
    const before = await selection(page)
    const view = page.getByTestId('view')
    await expect(view).toHaveText('View')
    // Keyboard only: focus the button, open with Enter, walk the list with the arrow keys.
    await view.focus()
    await page.keyboard.press('Enter')
    const menu = page.getByTestId('view-menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem')).toHaveText(['Landing site', 'Eye level', ...VIEW_LABELS])
    await expect(menu.getByRole('menuitem', { name: 'Landing site' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(view).toBeFocused()

    await view.focus()
    await page.keyboard.press('Enter')
    for (let i = 0; i < 4 && !(await menu.getByRole('menuitem', { name: 'Moon', exact: true }).evaluate((e) => e === document.activeElement)); i++) {
      await page.keyboard.press('ArrowDown')
    }
    await expect(menu.getByRole('menuitem', { name: 'Moon', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(menu).toBeHidden()
    await frames(page)
    const v = await expectOutsideBodies(page, 'Moon')
    expect(Math.hypot(...v.bodies[0].camera)).toBeCloseTo(6500, 3)
    await expect(page.getByTestId('not-to-scale')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('view=globe')

    // Back down without a keyboard shortcut: Landing site, then Eye level.
    await chooseView(page, 'Landing site')
    await expect.poll(() => scene(page, (s) => s.level())).toBe('site')
    await chooseView(page, 'Eye level')
    await expect.poll(() => scene(page, (s) => s.level())).toBe('eye')
    // None of this touched the scientific selection, and the answer still names the site.
    expect(await selection(page)).toBe(before)
    await expect(page.getByTestId('answer')).toHaveAttribute('data-site-id', RIDGE)
  })

  test('right-click opens the menu with its entries in order and the browser menu does not appear, at every level', async ({ page }) => {
    await openApp(page, `site=${RIDGE}&period=${AUG}`)
    await page.evaluate(() => {
      const w = window as unknown as { __ctx: boolean[] }
      w.__ctx = []
      window.addEventListener('contextmenu', (e) => w.__ctx.push(e.defaultPrevented))
    })
    for (const level of ['site', 'eye', 'globe']) {
      await page.evaluate((l) => (window as unknown as { __scene: Scene }).__scene.setView({ level: l }), level)
      await page.mouse.click(720, 400, { button: 'right' })
      const menu = page.getByTestId('scene-menu')
      await expect(menu, `menu at ${level} level`).toBeVisible()
      await expect(menu.getByRole('menuitem')).toHaveText(['Add point here', ...VIEW_LABELS])
      const box = (await menu.boundingBox())!
      expect(Math.abs(box.x - 720)).toBeLessThan(2)
      expect(Math.abs(box.y - 400)).toBeLessThan(2)
      await page.keyboard.press('Escape')
      await expect(menu).toBeHidden()
    }
    expect(await page.evaluate(() => (window as unknown as { __ctx: boolean[] }).__ctx)).toEqual([true, true, true])
    // A right-click is not a click: the camera did not walk and no site was selected.
    await expect(page.getByTestId('site-name')).toHaveText('Connecting Ridge')
    // The page outside the canvas keeps the browser's menu.
    await page.getByTestId('site-name').dispatchEvent('contextmenu')
    expect((await page.evaluate(() => (window as unknown as { __ctx: boolean[] }).__ctx)).at(-1)).toBe(false)
    // Choosing from the right-click menu flies there; near the edge the menu stays inside the stage.
    await page.evaluate(() => (window as unknown as { __scene: Scene }).__scene.setView({ level: 'site' }))
    await page.mouse.click(1430, 300, { button: 'right' })
    const menu = page.getByTestId('scene-menu')
    const box = (await menu.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(1440)
    await menu.getByRole('menuitem', { name: 'Moon' }).click()
    await frames(page)
    await expect.poll(() => scene(page, (s) => s.level())).toBe('globe')
    await expectOutsideBodies(page, 'Moon from the right-click menu')
  })

  test('viewpoint screenshots (read by the agent)', async ({ page }) => {
    await openApp(page, `site=${RIDGE}&period=${AUG}&t=2027-08-20T06:00Z`)
    await page.evaluate(() => document.fonts.ready)
    await chooseView(page, 'Moon')
    await page.waitForTimeout(300)
    await page.screenshot({ path: `test-results/c4-view-moon-1440.png`, animations: 'disabled' })
  })
})

// ---------- notebook notes 5 and 12: back to the globe without a keyboard, names on pins ----------

type SceneP = Scene & { projectPin(id: string): { x: number; y: number; visible: boolean } | null }
const pinOf = (page: Page, id: string) => page.evaluate((i) => (window as unknown as { __scene: SceneP }).__scene.projectPin(i), id)

test.describe('notes 5 and 12 on a phone (375 × 812, touch only)', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true })

  test('View leads from eye level to the site and to the globe; a tap on a pin shows its name, a second tap selects it', async ({ page }) => {
    await openApp(page, `site=${RIDGE}&period=${AUG}&view=eye`)
    await expect.poll(() => scene(page, (s) => s.level())).toBe('eye')
    const tapView = async (label: string) => {
      await page.getByTestId('view').tap()
      await page.getByTestId('view-menu').getByRole('menuitem', { name: label, exact: true }).tap()
    }
    await tapView('Landing site')
    await expect.poll(() => scene(page, (s) => s.level())).toBe('site')
    await tapView('Moon')
    await expect.poll(() => scene(page, (s) => s.level())).toBe('globe')
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('view=globe')
    await expect(page.getByTestId('site-name')).toHaveText('Connecting Ridge')
    // The whole menu fits the phone screen.
    await page.getByTestId('view').tap()
    const box = (await page.getByTestId('view-menu').boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(375)
    expect(box.y).toBeGreaterThanOrEqual(0)
    await page.getByTestId('view').tap()
    await expect(page.getByTestId('view-menu')).toBeHidden()

    // Camera above Haworth (far from every other pin), in the clear middle of the screen.
    const sites = (await (await page.request.get('/data/sites.json')).json()) as { id: string; name: string; lat: number; lon: number }[]
    const haworth = sites.find((s) => s.id === 'haworth')!
    await page.evaluate(([lat, lon]) => (window as unknown as { __scene: Scene }).__scene.setView({ level: 'globe', el: lat, az: lon }), [haworth.lat, haworth.lon])
    const pin = (await pinOf(page, 'haworth'))!
    expect(pin.visible).toBe(true)
    await expect(page.getByTestId('pin-name')).toBeHidden()
    await page.touchscreen.tap(pin.x, pin.y)
    await expect(page.getByTestId('pin-name')).toBeVisible()
    await expect(page.getByTestId('pin-name')).toHaveText(haworth.name)
    await expect(page.getByTestId('site-name')).toHaveText('Connecting Ridge') // the first tap only names the pin
    await page.touchscreen.tap(pin.x, pin.y)
    await expect(page.getByTestId('site-name')).toHaveText(haworth.name)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test('note 12: hovering a site pin on the globe shows its name; moving away hides it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openApp(page, `site=${RIDGE}&period=${AUG}&view=globe`)
  const sites = (await (await page.request.get('/data/sites.json')).json()) as { id: string; name: string; lat: number; lon: number }[]
  const haworth = sites.find((s) => s.id === 'haworth')!
  await page.evaluate(([lat, lon]) => (window as unknown as { __scene: Scene }).__scene.setView({ level: 'globe', el: lat, az: lon }), [haworth.lat, haworth.lon])
  const pin = (await pinOf(page, 'haworth'))!
  await page.mouse.move(pin.x + 200, pin.y - 150)
  await expect(page.getByTestId('pin-name')).toBeHidden()
  await page.mouse.move(pin.x + 2, pin.y + 2)
  await expect(page.getByTestId('pin-name')).toHaveText(haworth.name)
  const label = (await page.getByTestId('pin-name').boundingBox())!
  expect(Math.abs(label.x + label.width / 2 - pin.x)).toBeLessThan(40)
  await page.mouse.move(pin.x + 200, pin.y - 150)
  await expect(page.getByTestId('pin-name')).toBeHidden()
  await expect(page.getByTestId('site-name')).toHaveText('Connecting Ridge') // hovering selects nothing
})

// ---------- part 3: user points ----------

type SceneP3 = SceneP2 & {
  surfaceAt(x: number, y: number): { lat: number; lon: number } | null
  projectMark(i: number): { x: number; y: number; visible: boolean } | null
}
const scene3 = <T>(page: Page, fn: (s: SceneP3) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>
const surfaceAt = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as unknown as { __scene: SceneP3 }).__scene.surfaceAt(x, y), [x, y])
const hashPts = (page: Page) => page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('pts'))
const coordText = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'} · ${Math.abs(lon).toFixed(2)}° ${lon < 0 ? 'W' : 'E'}`

async function addHere(page: Page, x: number, y: number) {
  await page.mouse.click(x, y, { button: 'right' })
  await page.getByTestId('scene-menu').getByRole('menuitem', { name: 'Add point here' }).click()
}

async function openPanel(page: Page) {
  await page.getByTestId('mission').click()
  const panel = page.getByTestId('mission-panel')
  await expect(panel).toBeVisible()
  await panel.getByTestId('points').scrollIntoViewIfNeeded()
  return panel
}

test.describe('C4 part 3: user points', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('right-click → Add point here adds a point at the clicked place, on the globe and in the site view; it is disabled off the Moon; a left-click adds none', async ({ page }) => {
    await openApp(page, `site=${RIDGE}&period=${AUG}&t=2027-08-20T06:00Z&st=goldstone,madrid`)
    const before = await selection(page)
    // Site view: the terrain point under the pointer.
    const onTerrain = (await surfaceAt(page, 800, 430))!
    expect(onTerrain, 'terrain under the pointer').not.toBeNull()
    expect(onTerrain.lat).toBeLessThan(-88) // near Connecting Ridge (89.46° S)
    await addHere(page, 800, 430)
    await expect.poll(() => hashPts(page)).toBe(`${onTerrain.lat.toFixed(4)},${onTerrain.lon.toFixed(4)},,Point A`)
    await expect.poll(() => scene(page, (s) => s.level()), 'adding a point is not a walk').toBe('site')
    // The marker stands where the click was.
    const mark = (await scene3(page, (s) => s.projectMark(0)))!
    expect(mark).not.toBeNull()
    expect(Math.abs(mark.x - 800)).toBeLessThan(6)
    expect(mark.y).toBeLessThan(430 + 3) // the head sits on a short stem above the ground point

    // Globe: the surface point under the pointer; over the sky the entry is disabled.
    // South of the pin region's edge (region.ts PIN_REGION_NORTH_LAT: points can only be added in the south cap),
    // on the side of the pole that has no landing-site pin within 150 km of the pointer.
    await page.evaluate(() => (window as unknown as { __scene: Scene }).__scene.setView({ level: 'globe', el: -84, az: 160, dist: 3500 }))
    const onGlobe = (await surfaceAt(page, 700, 420))!
    expect(onGlobe).not.toBeNull()
    expect(onGlobe.lat, 'inside the pin region').toBeLessThan(PIN_REGION_NORTH_LAT - 1)
    await addHere(page, 700, 420)
    await expect.poll(() => hashPts(page)).toBe(
      `${onTerrain.lat.toFixed(4)},${onTerrain.lon.toFixed(4)},,Point A;${onGlobe.lat.toFixed(4)},${onGlobe.lon.toFixed(4)},,Point B`,
    )
    expect(await surfaceAt(page, 60, 300), 'sky beside the Moon').toBeNull()
    await page.mouse.click(60, 300, { button: 'right' })
    const menu = page.getByTestId('scene-menu')
    await expect(menu.getByRole('menuitem', { name: 'Add point here' })).toBeDisabled()
    await expect(menu.getByRole('menuitem', { name: 'Moon' })).toBeEnabled()
    await page.keyboard.press('Escape')
    // A left-click on the globe's surface adds no point (ninja, 14 Nov) and selects no site.
    await page.mouse.click(700, 440)
    await page.waitForTimeout(600)
    expect((await hashPts(page))!.split(';')).toHaveLength(2)
    await expect(page.getByTestId('site-name')).toHaveText('Connecting Ridge')
    // Hovering the new point's marker shows its name.
    const m = (await scene3(page, (s) => s.projectMark(1)))!
    await page.mouse.move(m.x, m.y)
    await expect(page.getByTestId('pin-name')).toHaveText('Point B')
    // The scientific selection is untouched, and the answer still describes the landing site.
    expect(await selection(page)).toBe(before)
    await expect(page.getByTestId('answer')).toHaveAttribute('data-site-id', RIDGE)
  })

  test('typed coordinates add a point; rename and delete work, no role control (U10); a point shows "No terrain data for this point" and no number', async ({ page }) => {
    await openApp(page, `site=${RIDGE}&period=${AUG}`)
    const panel = await openPanel(page)
    await expect(panel.getByTestId('point')).toHaveCount(0)
    const search = panel.getByRole('combobox', { name: 'Search a site or type coordinates' })
    await search.fill('89.3 S, 130 W')
    await expect(panel.getByRole('status')).toContainText('89.30° S · 130.00° W')
    await panel.getByTestId('add-point').click()
    await expect(panel.getByTestId('point')).toHaveCount(1)
    await expect(search).toHaveValue('')
    await search.fill('-85.5, 12.25')
    await search.press('Enter') // Enter adds typed coordinates too
    const rows = panel.getByTestId('point')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0).getByRole('textbox')).toHaveValue('Point A')
    await expect(rows.nth(1).getByRole('textbox')).toHaveValue('Point B')
    await expect(rows.nth(0)).toContainText('89.30° S · 130.00° W')
    await expect(rows.nth(1)).toContainText('85.50° S · 12.25° E')
    // Sunlight and station visibility: the text, never a value.
    for (const i of [0, 1]) {
      const none = rows.nth(i).locator('[data-fact=none]')
      await expect(none).toHaveText('No terrain data for this point')
      expect(await none.innerText()).not.toMatch(/\d/)
      await expect(rows.nth(i)).not.toContainText('%')
      await expect(rows.nth(i)).not.toContainText(/lit|comms/)
    }
    await expect.poll(() => hashPts(page)).toBe('-89.3000,-130.0000,,Point A;-85.5000,12.2500,,Point B')

    // Rename (cleanName rules: white space collapsed, 40 characters at most).
    await rows.nth(0).getByRole('textbox').fill('  Ridge   camp ')
    await rows.nth(0).getByRole('textbox').blur()
    await expect(rows.nth(0).getByRole('textbox')).toHaveValue('Ridge camp')
    await rows.nth(1).getByRole('textbox').fill('x'.repeat(45))
    await expect(rows.nth(1).getByRole('textbox')).toHaveValue('x'.repeat(40))
    await rows.nth(1).getByRole('textbox').fill('Far, east; 50%')
    // No role (U10): a point row has no role control.
    await expect(rows.getByRole('combobox')).toHaveCount(0)
    await expect(panel.getByRole('combobox', { name: /^Role of/ })).toHaveCount(0)
    await expect.poll(() => hashPts(page)).toBe('-89.3000,-130.0000,,Ridge camp;-85.5000,12.2500,,Far%2C east%3B 50%25')
    // Select: the coordinates are the control. The point added last is selected; choosing another moves it.
    await expect(rows.nth(1).getByRole('button', { name: /^Select Far, east; 50%/ })).toHaveAttribute('aria-pressed', 'true')
    await rows.nth(0).getByRole('button', { name: /^Select Ridge camp/ }).click()
    await expect(rows.nth(0).getByRole('button', { name: /^Select / })).toHaveAttribute('aria-pressed', 'true')
    await expect(rows.nth(1).getByRole('button', { name: /^Select / })).toHaveAttribute('aria-pressed', 'false')
    // The "Add a point" hint stays a disabled line; the page never shows NaN.
    await expect(panel.getByRole('button', { name: /Add a point/ })).toBeDisabled()
    await expect(page.locator('body')).not.toContainText('NaN')

    // A copied link restores both points with their names.
    const link = await page.evaluate(() => location.href)
    await page.goto('about:blank')
    await page.goto(link)
    await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
    const panel2 = await openPanel(page)
    const rows2 = panel2.getByTestId('point')
    await expect(rows2).toHaveCount(2)
    await expect(rows2.nth(0).getByRole('textbox')).toHaveValue('Ridge camp')
    await expect(rows2.nth(1).getByRole('textbox')).toHaveValue('Far, east; 50%')
    // Delete the first: the second keeps its name.
    await rows2.nth(0).getByRole('button', { name: 'Delete Ridge camp' }).click()
    await expect(rows2).toHaveCount(1)
    await expect(rows2.nth(0).getByRole('textbox')).toHaveValue('Far, east; 50%')
    await expect.poll(() => hashPts(page)).toBe('-85.5000,12.2500,,Far%2C east%3B 50%25')
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: 'test-results/c4-panel-one-point-1440.png', animations: 'disabled' })
  })

  test('an old-format pts= link still loads: both points listed with letter names, the link is not rewritten', async ({ page }) => {
    await openApp(page, `site=${RIDGE}&period=${AUG}&pts=-89.3000,-130.0000;-85.5000,12.2500`)
    const panel = await openPanel(page)
    const rows = panel.getByTestId('point')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0).getByRole('textbox')).toHaveValue('Point A')
    await expect(rows.nth(1).getByRole('textbox')).toHaveValue('Point B')
    await expect(rows.nth(1)).toContainText(coordText(-85.5, 12.25))
    await page.waitForTimeout(700)
    expect(await hashPts(page)).toBe('-89.3000,-130.0000;-85.5000,12.2500')
    // Deleting the first does not rename the second.
    await rows.nth(0).getByRole('button', { name: 'Delete Point A' }).click()
    await expect(rows).toHaveCount(1)
    await expect(rows.nth(0).getByRole('textbox')).toHaveValue('Point B')
  })
  // U14: the Point start / Point end viewpoints were removed, and their test with them.
})

// ---------- part 4: Simulate ----------

type SceneP4 = Scene & { sunAzEl(): { az: number; el: number } | null; earthAzEl(): { az: number; el: number } | null }
const sky = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __scene: SceneP4 }).__scene
    return { sun: s.sunAzEl(), earth: s.earthAzEl() }
  })

/** What the screen shows for the cursor time: date, answer, timeline value text, the labels' numbers. */
async function shown(page: Page) {
  const label = async (id: string) => ((await page.getByTestId(id).isVisible()) ? page.getByTestId(id).innerText() : null)
  return {
    date: await page.getByTestId('date').innerText(),
    answer: await page.getByTestId('answer').innerText(),
    // the timeline, by name: a paused simulation also shows the speed slider (U18)
    value: await page.getByRole('slider', { name: 'Time in the selected period' }).getAttribute('aria-valuetext'),
    sunLabel: await label('label-sun'),
    earthLabel: await label('label-earth'),
  }
}

test.describe('C4 part 4: Simulate', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Simulate reaches a time T; a fresh page opened at T shows the same answer, labels and Sun/Earth az/el', async ({ page }) => {
    await openApp(page, `site=${RIDGE}&period=${AUG}&t=2027-08-17T00:00Z&view=eye`)
    const sim = page.getByTestId('simulate')
    await expect(sim).toHaveText('Simulate')
    await expect(sim).toHaveAttribute('aria-pressed', 'false')
    await sim.click()
    await expect(sim).toHaveText('Pause')
    await expect(page.getByTestId('date')).not.toHaveText('17 August 2027, 00:00 UTC')
    await page.waitForTimeout(1500)
    await sim.click()
    await expect(sim).toHaveText('Simulate')
    // Paused: the link is written once the cursor rests.
    const linkT = () => page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('t'))
    await expect.poll(linkT, { timeout: 5000 }).not.toBe('2027-08-17T00:00Z')
    const t = (await linkT())!
    expect(t).toMatch(/^2027-08-1[78]T\d\d:[03]0Z$/)
    await frames(page)
    await page.waitForTimeout(500) // the scene loads its frame for the resting cursor
    const played = { screen: await shown(page), sky: await sky(page), level: await scene(page, (s) => s.level()) }
    expect(played.screen.answer.length).toBeGreaterThan(10)

    // A fresh page at the same T: scrubbing or a link, the screen is a function of the cursor time alone.
    const fresh = await page.context().newPage()
    await fresh.setViewportSize({ width: 1440, height: 900 })
    await openApp(fresh, `site=${RIDGE}&period=${AUG}&t=${t}&view=eye`)
    await frames(fresh)
    await fresh.waitForTimeout(500)
    expect(await shown(fresh)).toEqual(played.screen)
    const direct = await sky(fresh)
    for (const b of ['sun', 'earth'] as const) {
      expect(direct[b]!.az).toBeCloseTo(played.sky[b]!.az, 9)
      expect(direct[b]!.el).toBeCloseTo(played.sky[b]!.el, 9)
    }
    expect(await scene(fresh, (s) => s.level())).toBe(played.level)
    // And scrubbed there with the arrow keys from 30 minutes earlier.
    await fresh.keyboard.press('ArrowLeft')
    await fresh.keyboard.press('ArrowRight')
    await frames(fresh)
    await fresh.waitForTimeout(300)
    expect(await shown(fresh)).toEqual(played.screen)
    await fresh.close()
  })

  test('Simulate follows the clock at the chosen speed, stops at the last step; Space, the speed slider and Reset to start work', async ({ page }) => {
    await openApp(page, `site=${RIDGE}&period=${AUG}`)
    const sim = page.getByTestId('simulate')
    const cursorMs = async () => Number(await page.getByRole('slider', { name: 'Time in the selected period' }).getAttribute('aria-valuenow'))
    const start = Date.UTC(2027, 7, 16)
    const lastStep = Date.UTC(2027, 7, 30) - 30 * 60_000
    expect(await cursorMs()).toBe(start)
    // U18: the speed slider and "Reset to start" sit beside Simulate, only in a simulation; the drawer has neither.
    const speed = page.getByTestId('sim-speed')
    const reset = page.getByRole('button', { name: 'Reset to start' })
    await expect(speed).toHaveCount(0)
    await expect(reset).toHaveCount(0)
    await page.getByTestId('details').click()
    const drawer = page.getByTestId('drawer')
    await expect(drawer.getByTestId('speed')).toHaveCount(0)
    await expect(drawer.getByRole('heading', { name: 'Simulation' })).toHaveCount(0)
    await drawer.getByRole('button', { name: 'Close' }).click()
    // Simulate, then pause: the slider stays while paused in the simulation, at 10 hours per second.
    await sim.click()
    await expect(speed).toBeVisible()
    await sim.click()
    await expect(sim).toHaveText('Simulate')
    await expect(speed).toBeVisible()
    await expect(speed).toHaveAttribute('aria-valuetext', '10 hours per second')
    await speed.focus()
    await page.keyboard.press('ArrowRight')
    await expect(speed).toHaveAttribute('aria-valuetext', '1 day per second')
    await expect(page.getByTestId('sim-controls')).toContainText('1 day/s')
    await reset.click()
    expect(await cursorMs()).toBe(start)
    // One day per second: the cursor advances by the real time between the two clicks (measured in the page,
    // so a slow test runner does not count), on the 30-minute grid. The last timer tick may be up to 1 s old.
    await sim.evaluate((el) => {
      const w = window as unknown as { __clicks: number[] }
      w.__clicks = []
      el.addEventListener('click', () => w.__clicks.push(performance.now()), true)
    })
    await sim.click()
    await page.waitForTimeout(2000)
    await sim.click()
    const clicks = await page.evaluate(() => (window as unknown as { __clicks: number[] }).__clicks)
    const real = (clicks[1] - clicks[0]) / 1000
    const advancedH = ((await cursorMs()) - start) / 3_600_000
    expect((await cursorMs()) % (30 * 60_000)).toBe(0)
    expect(real).toBeGreaterThan(1.9)
    expect(advancedH, `advanced ${advancedH} h in ${real.toFixed(2)} s`).toBeGreaterThan(24 * (real - 1))
    expect(advancedH, `advanced ${advancedH} h in ${real.toFixed(2)} s`).toBeLessThanOrEqual(24 * real + 0.5)
    // Space pauses and resumes, as before.
    const paused = await cursorMs()
    await page.keyboard.press('Space')
    await expect(sim).toHaveText('Pause')
    await expect.poll(cursorMs).toBeGreaterThan(paused)
    await page.keyboard.press('Space')
    await expect(sim).toHaveText('Simulate')
    // Three days per second from near the end: stops on the last step, the control reads Simulate again and the
    // simulation is over, so the slider goes.
    await page.goto(`/?test=1#site=${RIDGE}&period=${AUG}&t=2027-08-29T00:00Z`)
    await page.reload()
    await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
    await expect(speed).toHaveCount(0)
    await page.getByTestId('simulate').click()
    await speed.focus()
    await page.keyboard.press('End')
    await expect(speed).toHaveAttribute('aria-valuetext', '3 days per second')
    await expect(page.getByTestId('simulate')).toHaveText('Simulate', { timeout: 15_000 })
    expect(await cursorMs()).toBe(lastStep)
    await expect(speed).toHaveCount(0)
    // At the end, Simulate starts over from the first step; "Reset to start" goes back and stops.
    await page.getByTestId('simulate').click()
    await expect.poll(cursorMs).toBeLessThan(lastStep)
    await reset.click()
    await expect(page.getByTestId('simulate')).toHaveText('Simulate')
    expect(await cursorMs()).toBe(start)
    // Esc leaves the simulation: the slider goes.
    await page.getByTestId('simulate').focus()
    await page.keyboard.press('Escape')
    await expect(speed).toHaveCount(0)
    await expect(reset).toHaveCount(0)
    await page.getByTestId('details').click()
    await expect(page.getByTestId('drawer').getByTestId('views-note')).toContainText('looks down the +z axis of the Moon body-fixed frame (MOON_ME)')
    await expect(page.getByTestId('drawer').getByTestId('views-note')).toContainText('It is not to scale')
  })
})

// ---------- every size: no horizontal scroll; the screenshots the brief asks for ----------

for (const vp of [
  { width: 1600, height: 1000 },
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
]) {
  test(`no horizontal scroll and screenshots at ${vp.width} × ${vp.height}: main view, Mission panel with two points, simulating`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize(vp)
    const sites = (await (await page.request.get('/data/sites.json')).json()) as { id: string; lat: number; lon: number }[]
    const ridge = sites.find((s) => s.id === RIDGE)!
    const pts = `${(ridge.lat + 0.1).toFixed(4)},${ridge.lon.toFixed(4)},s,Ridge camp;-85.9900,0.5000,e,Malapert view`
    await openApp(page, `site=${RIDGE}&period=${AUG}&t=2027-08-20T06:00Z&pts=${pts}`)
    await page.evaluate(() => document.fonts.ready)
    const tag = `${vp.width}x${vp.height}`
    const noScroll = async (what: string) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, `${what} at ${tag}`).toBeLessThanOrEqual(0)
    }
    const shot = (name: string) => page.screenshot({ path: `test-results/c4-${name}-${tag}.png`, animations: 'disabled' })
    await noScroll('main view')
    await shot('main')
    await page.getByTestId('view').click()
    await expect(page.getByTestId('view-menu')).toBeVisible()
    await noScroll('View menu')
    await shot('view-menu')
    await page.keyboard.press('Escape')
    const panel = await openPanel(page)
    await expect(panel.getByTestId('point')).toHaveCount(2)
    await expect(panel.locator('[data-fact=computing]')).toHaveCount(0, { timeout: 60_000 })
    await panel.getByTestId('points').evaluate((e) => e.scrollIntoView({ block: 'start' }))
    await noScroll('Mission panel with two points')
    await shot('panel-points')
    await panel.getByRole('button', { name: 'Close' }).click()
    // U14 removed the top view and Point start, which were photographed here.
    await page.getByTestId('simulate').click()
    await expect(page.getByTestId('simulate')).toHaveText('Pause')
    await noScroll('simulating')
    await page.getByTestId('simulate').click()
    // Paused in the simulation: the speed slider and "Reset to start" beside Simulate (U18).
    await expect(page.getByTestId('sim-speed')).toBeVisible()
    await noScroll('simulation paused')
    await shot('simulation-paused')
    await page.getByTestId('details').click()
    await noScroll('drawer')
    await shot('drawer')
  })
}

// ---------- the camera never changes the selection; the flights of the real app (no test mode) ----------

test('app: middle-drag, wheel, eye-level zoom and every viewpoint leave site, period, cursor and stations in the hash unchanged', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openApp(page, `site=${RIDGE}&period=${AUG}&t=2027-08-20T06:00Z&st=goldstone,madrid&pts=-89.3600,-136.6800,s,Near;-85.9900,0.5000,e,Far`)
  const before = await selection(page)
  const answer = await page.getByTestId('answer').innerText()
  const act = async (what: string, fn: () => Promise<void>) => {
    await fn()
    await frames(page)
    expect(await selection(page), `after ${what}`).toBe(before)
    expect(await page.getByTestId('answer').innerText(), `answer after ${what}`).toBe(answer)
    await expect(page.getByTestId('site-name')).toHaveText('Connecting Ridge')
  }
  const drag = async () => {
    await page.mouse.move(720, 380)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(820, 420, { steps: 3 })
    await page.mouse.up({ button: 'middle' })
  }
  const a = await camera(page)
  await act('a middle-drag at site level', drag)
  expect(angleDeg((await camera(page)).forward, a.forward)).toBeGreaterThan(3)
  await act('the wheel at site level', async () => {
    await page.mouse.move(720, 380)
    await page.mouse.wheel(0, -300)
  })
  expect(dist((await camera(page)).position, a.position)).toBeGreaterThan(100)
  await act('a left-drag', async () => {
    await page.mouse.move(720, 380)
    await page.mouse.down()
    await page.mouse.move(760, 360, { steps: 3 })
    await page.mouse.up()
  })
  await act('Eye level', () => chooseView(page, 'Eye level'))
  await act('the wheel at eye level', async () => {
    await page.mouse.move(720, 380)
    await page.mouse.wheel(0, -300)
  })
  expect((await camera(page)).fov).toBeLessThan(54)
  await act('a middle-drag at eye level', drag)
  for (const label of VIEW_LABELS) await act(label, () => chooseView(page, label))
  await act('Moon', () => chooseView(page, 'Moon'))
  await act('the wheel on the globe', async () => {
    await page.mouse.move(720, 380)
    await page.mouse.wheel(0, -300)
  })
  await act('a middle-drag on the globe', drag)
  await act('Landing site', () => chooseView(page, 'Landing site'))
})

test('without test mode: the walk and the viewpoint flights finish, with no page error', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/#site=${RIDGE}&period=${AUG}&t=2027-08-20T06:00Z&pts=-89.3600,-136.6800,s,Near;-85.9900,0.5000,e,Far`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await expect(page.getByTestId('label-site')).toBeVisible({ timeout: 30_000 })
  const view = (label: string) => chooseView(page, label)
  const hashView = () => page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('view') ?? 'site')
  // Walk: the 1.5 s flight ends at eye level.
  await page.mouse.click(900, 430)
  await expect.poll(hashView, { timeout: 10_000 }).toBe('eye')
  await page.waitForTimeout(1800)
  await page.screenshot({ path: 'test-results/c4-live-walk-1440x900.png', animations: 'disabled' })
  // U14: the Earth, Sun, top view and point viewpoints are gone; Moon is the one flight left.
  await view('Moon')
  await expect.poll(hashView, { timeout: 10_000 }).toBe('globe')
  await page.waitForTimeout(1800)
  await page.screenshot({ path: 'test-results/c4-live-moon-1440x900.png', animations: 'disabled' })
  await view('Landing site')
  await expect.poll(hashView, { timeout: 10_000 }).toBe('site')
  await page.waitForTimeout(1800)
  await expect(page.getByTestId('label-site')).toBeVisible()
  await expect(page.getByTestId('site-name')).toHaveText('Connecting Ridge')
  expect(errors).toEqual([])
})
