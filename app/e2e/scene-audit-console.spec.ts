// Scene audit (15 Nov): no warning or error from three.js or the scene in the console, over the main flow at the
// two viewport sizes: the Moon, the landing site, eye level, the Moon again, a custom point, a different site,
// the flight view and back. Each step is waited for; the frame time at the site is measured on the way (reported,
// bounded loosely: a frame under 100 ms on average, SwiftShader or a GPU alike).
// Run: PW_GPU=1 PW_PORT=5217 npx playwright test e2e/scene-audit-console.spec.ts
import { expect, test, type Page } from '@playwright/test'

type Scene = { ready: Promise<void>; siteId(): string | null; level(): string; setView(o: Record<string, unknown>): Promise<unknown> }
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>
const setParam = (page: Page, k: string, v: string) =>
  page.evaluate(([k, v]) => {
    const p = new URLSearchParams(location.hash.slice(1))
    p.set(k, v)
    location.hash = p.toString()
  }, [k, v])

for (const [w, h] of [[1280, 720], [375, 812]]) {
  test(`no console warnings from three.js or the scene at ${w}x${h}`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: w, height: h })
    const bad: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'warning' || m.type() === 'error') bad.push(`${m.type()}: ${m.text()}`)
    })
    page.on('pageerror', (e) => bad.push(`pageerror: ${e.message}`))
    await page.goto('/?test=1#site=haworth&period=shackleton-2027-08&view=globe')
    await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
    await scene(page, (s) => s.ready)
    const to = async (k: string, v: string, check: (s: Scene) => boolean, arg: string) => {
      await setParam(page, k, v)
      await page.waitForFunction(`(${check.toString()})(window.__scene, ${JSON.stringify(arg)})`, null, { timeout: 90_000 })
      await page.waitForTimeout(500)
    }
    await to('view', 'site', (s) => s.level() === 'site', '')
    await page.evaluate(async () => {
      const s = (window as unknown as { __scene: Scene }).__scene
      for (let i = 0; i < 4; i++) await s.setView({ level: 'site', az: i * 90, el: 10 + i * 10, dist: 5 + i * 10 })
    })
    await to('view', 'globe', (s) => s.level() === 'globe', '')
    await to('site', 'cap:-86.50000,40.25000', (s) => s.siteId() === 'cap:-86.50000,40.25000', '')
    await to('site', 'amundsen-rim', (s) => s.siteId() === 'amundsen-rim', '')
    await to('view', 'site', (s) => s.level() === 'site', '')
    // frame time: 60 frames with the camera turning at the site (every frame dirty)
    const ms = await page.evaluate(async () => {
      const s = (window as unknown as { __scene: Scene }).__scene
      const t0 = performance.now()
      for (let i = 0; i < 60; i++) await s.setView({ level: 'site', az: i * 6, el: 12, dist: 17 })
      return (performance.now() - t0) / 60
    })
    console.log(`${w}x${h}: ${ms.toFixed(1)} ms per placed and drawn frame`)
    expect(ms).toBeLessThan(100)
    await to('view', 'flight', (s) => s.level() === 'flight', '')
    await to('view', 'site', (s) => s.level() === 'site', '')
    expect(bad.filter((m) => !/favicon|Download the React DevTools/.test(m))).toEqual([])
  })
}
