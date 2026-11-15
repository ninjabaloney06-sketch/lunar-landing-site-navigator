// U16 and U6 in the app (15 Nov). Both need a change in App.tsx, which the wave-2 `shell` agent applies from cam's
// report: until then each test is marked fixme. Delete the `test.fixme(...)` line of a test when its App.tsx diff
// is applied.
// Run: PW_GPU=1 PW_PORT=5181 npx playwright test e2e/cam-app.spec.ts
import { expect, test, type Page } from '@playwright/test'

const RIDGE = 'connecting-ridge'
const AUG = 'shackleton-2027-08'
const APP_DIFF_U16 = false // set false (or delete the fixme line) once the U16 diff to App.tsx onShowPoi is applied
const APP_DIFF_U6 = false // the same for the U6 Esc diff

type Scene = {
  ready: Promise<void>
  siteId(): string | null
  level(): string
  eyeClearance(): { level: string; clearance: number | null }
}
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>
const viewOf = (page: Page) => page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('view'))

async function openApp(page: Page, h: string) {
  await page.goto(`/?test=1#${h}`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
}

test('U16: search → "Show" lands at that point at eye level, 1.75 m above the drawn terrain, as a landing site opens', async ({ page }) => {
  test.fixme(APP_DIFF_U16, 'needs the U16 App.tsx diff from the cam report')
  test.setTimeout(180_000)
  await openApp(page, `site=${RIDGE}&period=${AUG}`)
  await page.getByTestId('search-open').click()
  const panel = page.getByTestId('search')
  await expect(panel.getByTestId('search-results')).toHaveAttribute('data-ordered', 'true', { timeout: 120_000 })
  const row = panel.getByTestId('search-results').locator('li[data-site-id="poi-science-feat-shackleton"]')
  await row.getByRole('button', { name: 'Show' }).click()
  await expect.poll(async () => (await page.evaluate(() => location.hash)).includes('view=eye'), { timeout: 15_000 }).toBe(true)
  const site = (await page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('site')))!
  expect(site).toMatch(/^cap:/)
  await page.waitForFunction((id) => (window as unknown as { __scene: Scene }).__scene.siteId() === id, site, { timeout: 60_000 })
  await expect.poll(() => scene(page, (s) => s.eyeClearance().level), { timeout: 15_000 }).toBe('eye')
  expect((await scene(page, (s) => s.eyeClearance())).clearance!).toBeGreaterThanOrEqual(1.75 - 0.02)
})

test('U6: Esc while the simulation plays returns to the landing site, not to the Moon; Esc otherwise still goes to the Moon', async ({ page }) => {
  test.fixme(APP_DIFF_U6, 'needs the U6 App.tsx diff from the cam report')
  await openApp(page, `site=${RIDGE}&period=${AUG}&view=eye`)
  await page.getByTestId('simulate').click()
  await expect(page.getByTestId('simulate')).toHaveText('Pause')
  await page.locator('body').press('Escape')
  await expect.poll(async () => await viewOf(page)).not.toBe('globe')
  await expect.poll(() => scene(page, (s) => s.level())).toBe('site')
  // Esc also ended the simulation (U18). Not playing: Esc keeps today's behaviour (the Moon view).
  await expect(page.getByTestId('simulate')).toHaveText('Simulate')
  await page.locator('body').press('Escape')
  await expect.poll(async () => await viewOf(page)).toBe('globe')
})
