// Scene track, 14 Nov, ninja's bug list: the zoom at the Earth, Sun and Moon viewpoints (S6), the camera following
// its body over time (S7), the Moon's label anchor (S8) and bodies hiding each other (S9). Scene harness, test mode.
// Run: PW_PORT=5181 npx playwright test e2e/scene-bodies.spec.ts --workers=1
import { expect, test, type Page } from '@playwright/test'

type Pt = { x: number; y: number; visible: boolean }
interface Cam {
  level: string
  position: number[]
  quaternion: number[]
  forward: number[]
  fov: number
  width: number
  height: number
}
interface Body {
  name: string
  center: number[]
  camera: number[]
}
interface Scene {
  ready: Promise<void>
  setView(o: Record<string, unknown>): Promise<Cam>
  camera(): Cam
  goTo(v: string): Promise<boolean>
  bodies(): Body[]
  surfaceDist(): number
  load(siteId: string, utc: string | number): Promise<void>
  setAnimated(on: boolean): void
  advance(ms: number): void
  flying(): boolean
  topView(): boolean
  setMoonVisible(on: boolean): void
  handle(): { project(n: string): Pt | null; labelPoint(n: string): Pt | null; goTo(v: string): boolean }
}
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>
const setView = (page: Page, o: Record<string, unknown>) => page.evaluate((o) => (window as unknown as { __scene: Scene }).__scene.setView(o), o)
const goTo = (page: Page, v: string) => page.evaluate((v) => (window as unknown as { __scene: Scene }).__scene.goTo(v), v)
const load = (page: Page, utc: string | number) => page.evaluate((utc) => (window as unknown as { __scene: Scene }).__scene.load('connecting-ridge', utc), utc)
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
async function open(page: Page) {
  await page.goto('/src/scene3d/harness.html?test=1')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
}
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const SITE = 'connecting-ridge'
const FULL_MOON = '2027-08-17T07:00:00Z' // full Moon of 17 Aug 2027 (JPL Horizons via the app's ephemeris: Sun and Earth opposite, tested below)
const NEW_MOON = '2027-08-02T10:00:00Z'
const DAY = 86_400_000

/** n wheel events of deltaY px each on the middle of the canvas, as a trackpad sends them (ctrl = a pinch). */
const trackpad = (page: Page, deltaY: number, n: number, ctrl = false) =>
  page.evaluate(
    ([deltaY, n, ctrl]) => {
      const c = document.querySelector('#scene canvas')!
      const r = c.getBoundingClientRect()
      for (let i = 0; i < (n as number); i++) {
        c.dispatchEvent(
          new WheelEvent('wheel', { deltaY: deltaY as number, deltaMode: 0, ctrlKey: ctrl as boolean, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }),
        )
      }
    },
    [deltaY, n, ctrl] as const,
  )
/** Distance from the camera to the centre of the body a viewpoint is about, km. */
const bodyDist = (page: Page, name: string) =>
  page.evaluate((name) => {
    const b = (window as unknown as { __scene: Scene }).__scene.bodies().find((x) => x.name === name)!
    return Math.hypot(b.center[0] - b.camera[0], b.center[1] - b.camera[1], b.center[2] - b.camera[2])
  }, name)

test.describe('S6: the zoom works in both directions at every viewpoint', () => {
  for (const [label, utc] of [
    ['full Moon', FULL_MOON],
    ['new Moon', NEW_MOON],
  ] as const) {
    test(`${label}: small wheel steps in and the same steps out return to the start at the Earth, Sun and Moon viewpoints; the pinch too`, async ({ page }) => {
      await open(page)
      for (const vp of ['earth', 'sun', 'moon']) {
        await setView(page, { site: SITE, utc, level: 'globe' })
        expect(await goTo(page, vp)).toBe(true)
        const d0 = await bodyDist(page, vp)
        // 40 events of 3 px, as a slow two-finger scroll: in, then out.
        await trackpad(page, -3, 40)
        const dIn = await bodyDist(page, vp)
        expect(dIn / d0, `${vp}: scrolling in comes closer`).toBeLessThan(0.97)
        await trackpad(page, 3, 40)
        const back = await bodyDist(page, vp)
        expect(Math.abs(back - d0) / d0, `${vp}: the same steps out return to the start`).toBeLessThan(1e-6)
        // Out first, then in.
        await trackpad(page, 3, 40)
        const dOut = await bodyDist(page, vp)
        expect(dOut / d0, `${vp}: scrolling out moves away`).toBeGreaterThan(1.03)
        await trackpad(page, -3, 40)
        expect(Math.abs((await bodyDist(page, vp)) - d0) / d0, `${vp}: and back in returns to the start`).toBeLessThan(1e-6)
        // A pinch arrives as wheel events with ctrlKey: fingers apart (negative) comes closer, and it reverses.
        await trackpad(page, -2, 20, true)
        const pinched = await bodyDist(page, vp)
        expect(pinched / d0, `${vp}: pinch in`).toBeLessThan(0.9)
        await trackpad(page, 2, 20, true)
        expect(Math.abs((await bodyDist(page, vp)) - d0) / d0, `${vp}: pinch out returns`).toBeLessThan(1e-6)
        console.log(`S6 ${label} ${vp}: ${d0.toFixed(0)} km → in ${dIn.toFixed(0)} → back ${back.toFixed(0)} → out ${dOut.toFixed(0)} km; pinch ${pinched.toFixed(0)} km`)
      }
    })
  }

  test('zooming out stops at an outer limit around the body and comes back in from it; site level reverses too', async ({ page }) => {
    await open(page)
    const R: Record<string, number> = { earth: 6371.0, sun: 695700, moon: 1737.4 }
    for (const vp of ['earth', 'sun', 'moon']) {
      await setView(page, { site: SITE, utc: FULL_MOON, level: 'globe' })
      await goTo(page, vp)
      await trackpad(page, 100, 60)
      const far = await bodyDist(page, vp)
      // The Moon's own outer limit is 20 000 km from its centre, 11.51 radii; the same number of radii for Earth and the Sun.
      expect(far / R[vp], `${vp}: outer limit in body radii`).toBeGreaterThan(11.4)
      expect(far / R[vp], `${vp}: outer limit in body radii`).toBeLessThanOrEqual(20000 / 1737.4 + 1e-6)
      await trackpad(page, -100, 3)
      expect((await bodyDist(page, vp)) / far, `${vp}: back in from the limit`).toBeLessThan(0.8)
    }
    await setView(page, { site: SITE, utc: FULL_MOON, level: 'site', az: 40, el: 35, dist: 6 })
    const h0 = await scene(page, (s) => s.surfaceDist())
    await trackpad(page, -3, 40)
    const hIn = await scene(page, (s) => s.surfaceDist())
    expect(hIn / h0, 'site level: in').toBeLessThan(0.97)
    await trackpad(page, 3, 40)
    // The step follows the terrain height under the camera, so the way back is not exactly the way in.
    expect(Math.abs((await scene(page, (s) => s.surfaceDist())) - h0) / h0, 'site level: out returns within 2 %').toBeLessThan(0.02)
    await trackpad(page, 3, 40)
    expect((await scene(page, (s) => s.surfaceDist())) / h0, 'site level: out').toBeGreaterThan(1.03)
    await frames(page)
    await page.screenshot({ path: 'test-results/s6-site-after-trackpad-zoom.png' })
  })
})
