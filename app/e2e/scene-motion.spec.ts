// Scene track, 14 Nov: camera input easing (S1), the fly between the globe and the site (S3), the zoom at the
// body viewpoints (S6) and the camera following a body over time (S7). All on the scene harness in test mode,
// where the animation clock stands still: setAnimated(true) turns the easing on and advance(ms) is one frame.
// Run: PW_PORT=5181 npx playwright test e2e/scene-motion.spec.ts --workers=1
import { expect, test, type Page } from '@playwright/test'

export interface Cam {
  level: string
  units: string
  position: number[]
  quaternion: number[]
  forward: number[]
  fov: number
  width: number
  height: number
}
type Pt = { x: number; y: number; visible: boolean } | null
interface Scene {
  ready: Promise<void>
  setView(o: Record<string, unknown>): Promise<Cam>
  camera(): Cam
  surfaceDist(): number
  setAnimated(on: boolean): void
  advance(ms: number): void
  flying(): boolean
  level(): string
  goTo(v: string): Promise<boolean>
  project(n: string): Pt
  bodies(): { name: string; center: number[]; camera: number[] }[]
  handle(): { setLevel(l: string): void; goTo(v: string): boolean; project(n: string): Pt; labelPoint(n: string): Pt }
}
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
const camera = (page: Page) => scene(page, (s) => s.camera())
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const angleDeg = (a: number[], b: number[]) => (Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI
const FRAME = 1000 / 60
const RIDGE = { site: 'connecting-ridge', utc: '2027-08-16T12:00:00Z' }

async function open(page: Page) {
  await page.goto('/src/scene3d/harness.html?test=1')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
}
const setView = (page: Page, o: Record<string, unknown>) =>
  page.evaluate((o) => (window as unknown as { __scene: Scene }).__scene.setView(o), o)
/** n frames of `ms` each on the test clock; returns the camera after each one. */
const advance = (page: Page, n: number, ms = FRAME) =>
  page.evaluate(
    ([n, ms]) => {
      const s = (window as unknown as { __scene: Scene }).__scene
      const out: Cam[] = []
      for (let i = 0; i < n; i++) {
        s.advance(ms)
        out.push(s.camera())
      }
      return out
    },
    [n, ms] as const,
  )

test.describe('S1: eased camera input (site level, 1280 × 720)', () => {
  const SITE_VIEW = { ...RIDGE, level: 'site', az: 40, el: 35, dist: 6 }

  test('the wheel: the eased step takes many frames, never overshoots and lands where the whole step lands', async ({ page }) => {
    await open(page)
    const a = await setView(page, SITE_VIEW)
    await page.mouse.move(640, 360)
    await page.mouse.wheel(0, -100)
    await frames(page)
    const whole = await camera(page) // test mode without easing: the notch lands at once
    const step = dist(whole.position, a.position)
    expect(step).toBeGreaterThan(100)

    await setView(page, SITE_VIEW)
    await scene(page, (s) => s.setAnimated(true))
    await page.mouse.wheel(0, -100)
    await frames(page)
    expect(dist((await camera(page)).position, a.position), 'nothing moves until the clock does').toBeLessThan(1e-9)
    const path = await advance(page, 150)
    const d = path.map((c) => dist(c.position, a.position))
    expect(d[0], 'first frame: about a tenth of the step').toBeGreaterThan(0.05 * step)
    expect(d[0]).toBeLessThan(0.2 * step)
    for (let i = 1; i < d.length; i++) expect(d[i], `frame ${i} moves on, never back`).toBeGreaterThanOrEqual(d[i - 1] - 1e-9)
    // Each frame covers less than the one before: an ease-out with no stutter.
    for (let i = 2; i < 60; i++) expect(d[i] - d[i - 1], `frame ${i} step`).toBeLessThanOrEqual(d[i - 1] - d[i - 2] + 1e-6)
    expect(d[9] / step, 'about 63 % after one time constant (160 ms)').toBeGreaterThan(0.5)
    expect(d[9] / step).toBeLessThan(0.75)
    expect(Math.abs(d[d.length - 1] - step) / step, 'ends where the whole step ends').toBeLessThan(0.02)
    expect(angleDeg(path[path.length - 1].forward, a.forward)).toBeLessThan(1e-6)

    // The same notch at 30 frames per second ends at the same place.
    await setView(page, SITE_VIEW)
    await page.mouse.wheel(0, -100)
    await frames(page)
    const slow = await advance(page, 75, 2 * FRAME)
    expect(dist(slow[slow.length - 1].position, path[path.length - 1].position) / step, '30 fps and 60 fps agree').toBeLessThan(0.01)
    expect(dist(slow[4].position, path[9].position) / step, 'and at the same time on the way').toBeLessThan(0.02)
  })

  test('the middle-drag and the orbit drag keep turning after the release and end where the unsmoothed drag ends', async ({ page }) => {
    await open(page)
    const drag = async (button: 'middle' | 'left') => {
      await page.mouse.move(640, 360)
      await page.mouse.down({ button })
      await page.mouse.move(700, 380)
      await page.mouse.move(800, 420)
      await page.mouse.up({ button })
      await frames(page)
    }
    for (const button of ['middle', 'left'] as const) {
      await scene(page, (s) => s.setAnimated(false))
      const a = await setView(page, SITE_VIEW)
      await drag(button)
      const whole = await camera(page)
      const total = angleDeg(a.forward, whole.forward)
      expect(total, `${button}: the drag turns the view`).toBeGreaterThan(5)

      await setView(page, SITE_VIEW)
      await scene(page, (s) => s.setAnimated(true))
      await drag(button)
      expect(angleDeg((await camera(page)).forward, a.forward), `${button}: nothing moves until the clock does`).toBeLessThan(1e-6)
      const path = await advance(page, 150)
      const turned = path.map((c) => angleDeg(a.forward, c.forward))
      expect(turned[0], `${button}: first frame after the release is part of the turn`).toBeGreaterThan(0.03 * total)
      expect(turned[0]).toBeLessThan(0.25 * total)
      expect(turned[20], `${button}: still turning 20 frames after the release`).toBeGreaterThan(turned[10])
      for (let i = 1; i < turned.length; i++) expect(turned[i], `${button}: frame ${i}`).toBeGreaterThanOrEqual(turned[i - 1] - 1e-9)
      const end = path[path.length - 1]
      // The look-around composes yaw and pitch per step, so many small steps and two large ones differ slightly.
      expect(angleDeg(end.forward, whole.forward), `${button}: ends where the unsmoothed drag ends`).toBeLessThan(button === 'middle' ? 0.03 * total : 0.05)
      if (button === 'middle') expect(dist(end.position, a.position), 'a look-around does not move the camera').toBeLessThan(1e-6)
      else expect(dist(end.position, whole.position) / dist(whole.position, a.position)).toBeLessThan(0.01)
    }
    await page.screenshot({ path: 'test-results/s1-controls-after-eased-drag.png' })
  })
})
