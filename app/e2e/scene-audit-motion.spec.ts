// Scene audit (15 Nov): prefers-reduced-motion. With the animations on (setAnimated(true), as in the app), the fly
// between the Moon and the site and the 500 ms fade of the light run; with prefers-reduced-motion: reduce neither
// does, every change lands at once. The query is followed live.
// Run: PW_GPU=1 PW_PORT=5217 npx playwright test e2e/scene-audit-motion.spec.ts
import { expect, test, type Page } from '@playwright/test'

type Scene = {
  ready: Promise<void>
  level(): string
  siteId(): string | null
  setAnimated(on: boolean): void
  advance(ms: number): void
  flying(): boolean
  handle(): { setLevel(l: string): void }
  lights(): { sun: number }
  load(id: string, utc: string): Promise<void>
}
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>

async function open(page: Page) {
  await page.goto('/?test=1#site=haworth&period=shackleton-2027-08&view=site')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
  await page.waitForFunction(() => (window as unknown as { __scene: Scene }).__scene.siteId() === 'haworth', null, { timeout: 60_000 })
}

test('without reduced motion the way up to the Moon is a fly; with it, a cut', async ({ page }) => {
  test.setTimeout(120_000)
  await open(page)
  await scene(page, (s) => { s.setAnimated(true); s.handle().setLevel('globe') })
  expect(await scene(page, (s) => s.flying())).toBe(true)
  for (let i = 0; i < 400 && (await scene(page, (s) => s.flying())); i++) await scene(page, (s) => s.advance(100))
  expect(await scene(page, (s) => s.level())).toBe('globe')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await scene(page, (s) => s.handle().setLevel('site'))
  expect(await scene(page, (s) => s.flying())).toBe(false)
  expect(await scene(page, (s) => s.level())).toBe('site')
  await scene(page, (s) => s.handle().setLevel('globe'))
  expect(await scene(page, (s) => s.flying())).toBe(false)
  expect(await scene(page, (s) => s.level())).toBe('globe')
})

test('with reduced motion a jump of the time changes the light at once, not over 500 ms', async ({ page }) => {
  test.setTimeout(120_000)
  await open(page)
  const jump = async () => {
    // Two instants of different Sun share at the site; the second is read before any clock step.
    await scene(page, (s) => { s.setAnimated(true) })
    await scene(page, async (s) => { await s.load('haworth', '2027-08-16T00:00Z') })
    await scene(page, (s) => s.advance(1000))
    const a = await scene(page, (s) => s.lights().sun)
    let b = a
    for (const t of ['2027-08-18T00:00Z', '2027-08-20T00:00Z', '2027-08-22T00:00Z', '2027-08-24T00:00Z', '2027-08-27T00:00Z']) {
      await page.evaluate((t) => (window as unknown as { __scene: Scene }).__scene.load('haworth', t), t)
      b = await scene(page, (s) => s.lights().sun)
      await scene(page, (s) => s.advance(1000))
      const settled = await scene(page, (s) => s.lights().sun)
      if (Math.abs(settled - a) > 0.2) return { a, b, settled }
    }
    return null
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const eased = await jump()
  expect(eased, 'a time with another Sun share than 16 Aug').not.toBeNull()
  expect(Math.abs(eased!.b - eased!.settled), 'eases without the preference').toBeGreaterThan(0.01)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const cut = await jump()
  expect(Math.abs(cut!.b - cut!.settled), 'no easing with the preference').toBeLessThan(1e-6)
})
