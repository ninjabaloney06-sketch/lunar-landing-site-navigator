// Zooming past a limit changes the view (15 Nov; scene3d/zoomSwitch.ts): in at the Moon view's closest zoom opens the
// landing-site view, out at the site view's farthest zoom goes back to the Moon. Eye level keeps its lens zoom.
// Run: PW_PORT=5181 npx playwright test e2e/zoom-switch.spec.ts
import { expect, test, type Page } from '@playwright/test'

const RIDGE = 'connecting-ridge'
const AUG = 'shackleton-2027-08'

type Cam = { position: number[]; fov: number }
type Scene = {
  ready: Promise<void>
  level(): string
  camera(): Cam
  setView(o: { level?: string; az?: number; el?: number; dist?: number }): Promise<Cam>
}
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>
const viewOf = (page: Page) => page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('view') ?? 'site') // 'site' is left out of the link

async function openApp(page: Page, h: string) {
  await page.goto(`/?test=1#${h}`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
}

/** n wheel events of deltaY each on the middle of the canvas, one right after the other (one gesture). */
const wheel = (page: Page, deltaY: number, n = 1) =>
  page.evaluate(
    ([deltaY, n]) => {
      const c = document.querySelector('[data-testid="scene"] canvas')!
      const r = c.getBoundingClientRect()
      for (let i = 0; i < n; i++)
        c.dispatchEvent(new WheelEvent('wheel', { deltaY, deltaMode: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }))
    },
    [deltaY, n] as const,
  )

test.describe('zoom past the limit changes the view', () => {
  test.beforeEach(() => test.setTimeout(180_000))

  test('Moon view: one notch at the closest zoom switches nothing; a continued zoom-in opens the landing-site view', async ({ page }) => {
    await openApp(page, `site=${RIDGE}&period=${AUG}&view=globe`)
    await expect.poll(() => scene(page, (s) => s.level())).toBe('globe')
    // Far from the limit a long zoom-in is a zoom, nothing else.
    await wheel(page, -100, 6)
    expect(await scene(page, (s) => s.level())).toBe('globe')
    // Down to the floor, 1 km above the sphere at the equator, in single wheel events with a pause after each: at the
    // limit each is one step of a new gesture, and none of them switches.
    await scene(page, (s) => s.setView({ level: 'globe', el: 0, az: 0, dist: 3000 }))
    for (let i = 0; i < 20; i++) {
      await wheel(page, -400)
      await page.waitForTimeout(550)
    }
    expect(await scene(page, (s) => s.level()), 'single steps at the limit').toBe('globe')
    expect(await viewOf(page)).toBe('globe')
    const r = Math.hypot(...(await scene(page, (s) => s.camera())).position)
    expect(r, 'the camera rests on the floor').toBeGreaterThanOrEqual(1737.4 + 1 - 1e-6)
    expect(r).toBeLessThan(1737.4 + 1.01)
    await page.waitForTimeout(700) // a new gesture
    await wheel(page, -100, 4)
    await expect.poll(() => scene(page, (s) => s.level())).toBe('site')
    await expect.poll(() => viewOf(page), 'the link follows').toBe('site')
    // The rest of the same scroll does not zoom on into anything else or back.
    await wheel(page, -100, 10)
    await wheel(page, 400, 40)
    expect(await scene(page, (s) => s.level()), 'the same gesture after the switch').toBe('site')
    expect(await viewOf(page)).toBe('site')
  })

  test('landing-site view: one notch at the farthest zoom switches nothing; a continued zoom-out goes back to the Moon view', async ({ page }) => {
    await openApp(page, `site=${RIDGE}&period=${AUG}`)
    await expect.poll(() => scene(page, (s) => s.level())).toBe('site')
    await wheel(page, 100, 3) // from the default 17 km: a zoom
    expect(await scene(page, (s) => s.level())).toBe('site')
    await scene(page, (s) => s.setView({ level: 'site', dist: 59.9 })) // the outer limit is 60 km from the site
    await wheel(page, 100)
    expect(await scene(page, (s) => s.level()), 'one notch at the limit').toBe('site')
    expect(await viewOf(page)).toBe('site')
    expect(Math.hypot(...(await scene(page, (s) => s.camera())).position)).toBeLessThanOrEqual(60_000 + 1e-3)
    await page.waitForTimeout(700)
    await wheel(page, 100, 4)
    await expect.poll(() => scene(page, (s) => s.level())).toBe('globe')
    await expect.poll(() => viewOf(page), 'the link follows').toBe('globe')
    // Zooming in at the site's floor is not a switch: only out is.
    await page.locator('body').press('Escape')
    expect(await scene(page, (s) => s.level())).toBe('globe')
  })

  test('eye level: the wheel changes the field of view and never the view', async ({ page }) => {
    await openApp(page, `site=${RIDGE}&period=${AUG}&view=eye`)
    await expect.poll(() => scene(page, (s) => s.level())).toBe('eye')
    const a = await scene(page, (s) => s.camera())
    await wheel(page, -100, 5)
    const b = await scene(page, (s) => s.camera())
    expect(b.fov, 'wheel up narrows the lens').toBeLessThan(a.fov)
    expect(b.position).toEqual(a.position)
    await wheel(page, -400, 30) // to the narrowest lens and on
    expect(await scene(page, (s) => s.level())).toBe('eye')
    await wheel(page, 400, 40) // to the widest lens and on
    expect((await scene(page, (s) => s.camera())).fov).toBe(a.fov)
    expect(await scene(page, (s) => s.level())).toBe('eye')
    expect(await viewOf(page)).toBe('eye')
  })
})
