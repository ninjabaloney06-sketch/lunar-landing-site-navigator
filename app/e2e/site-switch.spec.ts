// Bug of 15 Nov night (science lead): "Clicking to switch from one landing site to another fails when both are
// already in landing site view." Cause: at site and eye level another landing site's pin was named on hover, but a
// click on it fell through to the walk code and nothing happened (index.ts onUp). Now it selects the site as its pin
// on the globe does. Every switch here, by pin, by the header picker, rapid and while Play runs, must end with the
// header, the answer, the URL hash, the scene's frame (site, horizon, terrain) and the built terrain all B's, the
// camera at B's default landing-site view above the drawn terrain, and no console error.
// Run: PW_GPU=1 PW_PORT=5215 npx playwright test e2e/site-switch.spec.ts
import { expect, test, type Page } from '@playwright/test'

const AUG = 'shackleton-2027-08'
type P = { x: number; y: number; visible: boolean } | null

const scene = <T>(page: Page, fn: string) => page.evaluate(`(${fn})(window.__scene)`) as Promise<T>
const hashSite = (page: Page) => page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('site'))

function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(String(e)))
  return errors
}

async function openApp(page: Page, site: string) {
  await page.goto(`/?test=1#site=${site}&period=${AUG}`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, '(s) => s.ready')
  await expect.poll(() => scene(page, '(s) => s.siteId()'), { timeout: 30_000 }).toBe(site)
}

/** Everything that must be B's after a switch to B. */
async function expectAt(page: Page, id: string, exactPose = true) {
  await expect.poll(() => hashSite(page), { timeout: 30_000 }).toBe(id)
  await expect(page.getByTestId('site-name')).toHaveAttribute('data-site-id', id)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-site-id', id, { timeout: 60_000 })
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await expect.poll(() => scene(page, '(s) => s.siteId()'), { timeout: 30_000 }).toBe(id)
  await expect.poll(() => scene(page, '(s) => !s.flying()'), { timeout: 30_000 }).toBe(true)
  const ids = await scene<{ frame: Record<string, string>; built: Record<string, string> }>(page, '(s) => s.dataIds()')
  expect(ids.frame, 'frame: site, horizon and terrain of the new site').toEqual({ site: id, horizon: id, terrain: id })
  expect(ids.built, 'terrain built from the new site').toEqual({ site: id, horizon: id, terrain: id })
  expect(await scene(page, '(s) => s.level()')).toBe('site')
  // The camera at B's default landing-site view: setView without a site or time places that view again (no reload).
  // While Play ran the view was placed for the Sun of the instant of the switch: then its distance and elevation.
  const cam = await scene<{ position: number[]; quaternion: number[]; distKm: number; view: { el: number } }>(page, '(s) => s.camera()')
  if (!exactPose) {
    expect(cam.distKm).toBeCloseTo(17, 3)
    expect(cam.view.el).toBeCloseTo(-16, 3)
  }
  const ref = await scene<{ position: number[]; quaternion: number[] }>(page, '(s) => s.setView({ level: "site" })')
  if (exactPose) for (let i = 0; i < 3; i++) expect(Math.abs(cam.position[i] - ref.position[i]), `camera position ${i} (m)`).toBeLessThan(1)
  if (exactPose) for (let i = 0; i < 4; i++) expect(Math.abs(cam.quaternion[i] - ref.quaternion[i]), `camera orientation ${i}`).toBeLessThan(1e-6)
  const c = await scene<{ clearance: number | null }>(page, '(s) => s.eyeClearance()')
  expect(c.clearance, 'camera above the drawn terrain').not.toBeNull()
  expect(c.clearance!).toBeGreaterThan(0)
}

/** The pin's head on screen, where nothing of the page lies over the canvas. */
async function pinOnCanvas(page: Page, id: string): Promise<P> {
  const p = await scene<P>(page, `(s) => s.projectNearSite(${JSON.stringify(id)})`)
  if (!p?.visible || p.x < 20 || p.x > 1260 || p.y < 20 || p.y > 700) return null
  const box = (await page.locator('canvas').first().boundingBox())!
  const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName ?? null, [box.x + p.x, box.y + p.y])
  return top === 'CANVAS' ? p : null
}

/** Clicks another site's pin, turning the site camera toward it first when it is not in the default view. */
async function clickPin(page: Page, id: string) {
  let p = await pinOnCanvas(page, id)
  if (!p) {
    const near = await scene<{ id: string; base: number[] }[]>(page, '(s) => s.pins().near')
    const pin = near.find((n) => n.id === id)
    expect(pin, `${id} has a pin at this site`).toBeTruthy()
    const az = (Math.atan2(pin!.base[0], pin!.base[1]) * 180) / Math.PI
    for (const [el, dist] of [[25, 25], [18, 25], [12, 30], [30, 40], [8, 20]]) {
      await scene(page, `(s) => s.setView({ level: 'site', az: ${az}, el: ${el}, dist: ${dist} })`)
      p = await pinOnCanvas(page, id)
      if (p) break
    }
  }
  expect(p, `${id}'s pin on screen, not under the page's text`).not.toBeNull()
  const box = (await page.locator('canvas').first().boundingBox())!
  await page.mouse.move(box.x + p!.x, box.y + p!.y)
  await expect.poll(() => scene<{ name: string } | null>(page, '(s) => s.named()').then((n) => n?.name ?? null)).not.toBeNull()
  await page.mouse.down()
  await page.mouse.up()
}

async function pick(page: Page, name: RegExp) {
  await page.getByTestId('site-open').click()
  await page.getByTestId('site-picker').getByRole('option', { name }).click()
}

test.describe('switching landing sites in the landing-site view', () => {
  test.setTimeout(240_000)

  test('a click on a neighbouring site pin switches to it: a ring of near neighbours, both ways', async ({ page }) => {
    const errors = watchErrors(page)
    await openApp(page, 'connecting-ridge')
    // Pictures for the bug report: the click on Shackleton Rim Site04's pin from Connecting Ridge's default view.
    await page.screenshot({ path: 'test-results/scene-fix/switch-1-at-connecting-ridge.png' })
    await clickPin(page, 'shackleton-rim-site04')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `test-results/scene-fix/switch-2-after-pin-click-${process.env.SHOT ?? 'after'}.png` })
    await expectAt(page, 'shackleton-rim-site04')
    await clickPin(page, 'connecting-ridge')
    await expectAt(page, 'connecting-ridge')
    const ring = ['peak-near-shackleton', 'shackleton-rim-site04', 'de-gerlache-rim-1', 'de-gerlache-rim-2', 'connecting-ridge', 'shackleton-rim-site04', 'connecting-ridge']
    for (const id of ring) {
      await clickPin(page, id)
      await expectAt(page, id)
    }
    expect(errors).toEqual([])
  })

  test('the header picker switches between far sites and back to a near one', async ({ page }) => {
    const errors = watchErrors(page)
    await openApp(page, 'connecting-ridge')
    for (const [name, id] of [
      [/^Haworth/, 'haworth'],
      [/^Malapert Massif/, 'malapert-massif'],
      [/^Nobile Rim 1/, 'nobile-rim-1'],
      [/^Peak Near Shackleton/, 'peak-near-shackleton'],
    ] as const) {
      await pick(page, name)
      await expectAt(page, id)
    }
    expect(errors).toEqual([])
  })

  test('rapid double switch A → B → C before B has loaded ends at C', async ({ page }) => {
    const errors = watchErrors(page)
    await openApp(page, 'connecting-ridge')
    await pick(page, /^Haworth/)
    await pick(page, /^de Gerlache Rim 1/)
    await expectAt(page, 'de-gerlache-rim-1')
    // A pin, then at once the picker.
    await clickPin(page, 'connecting-ridge')
    await pick(page, /^Malapert Massif/)
    await expectAt(page, 'malapert-massif')
    expect(errors).toEqual([])
  })

  test('switching by pin while Play runs, with the flights and easing of the app on', async ({ page }) => {
    const errors = watchErrors(page)
    await openApp(page, 'peak-near-shackleton')
    // The app's own animations: easing, flights and light fades on a clock that runs with the page.
    await page.evaluate(() => {
      const s = (window as unknown as { __scene: { setAnimated(on: boolean): void; advance(ms: number): void } }).__scene
      s.setAnimated(true)
      setInterval(() => s.advance(16), 16)
    })
    await page.getByTestId('simulate').click()
    await expect(page.getByTestId('simulate')).toHaveText('Pause')
    await clickPin(page, 'connecting-ridge')
    await expect(page.getByTestId('site-name')).toHaveAttribute('data-site-id', 'connecting-ridge')
    // The link (state.ts) is written 400 ms after the state last changed, so while Play runs it waits; checked
    // after the pause, in expectAt.
    await expect.poll(() => scene(page, '(s) => s.siteId()'), { timeout: 30_000 }).toBe('connecting-ridge')
    await page.getByTestId('simulate').click() // pause, so the pose check below compares one instant
    await expect(page.getByTestId('simulate')).toHaveText('Play')
    await expectAt(page, 'connecting-ridge', false)
    expect(errors).toEqual([])
  })
})
