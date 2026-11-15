// U16 and U6 in the app (15 Nov). Both needed a change in App.tsx from cam's report; both are applied, so the
// tests run unconditionally.
// Run: PW_GPU=1 PW_PORT=5181 npx playwright test e2e/cam-app.spec.ts
import { expect, test, type Page } from '@playwright/test'

const RIDGE = 'connecting-ridge'
const AUG = 'shackleton-2027-08'

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

// Team decision of 15 Nov (science lead): "Show" picks the point as the landing site and opens the landing-site view,
// as "Select" does. This replaces U16's eye-level landing; eye level is one step away in the View menu.
test('search → "Show" makes the point the landing site and opens the landing-site view, camera above the drawn terrain (replaces U16 eye level, team decision 15 Nov)', async ({ page }) => {
  test.setTimeout(180_000)
  await openApp(page, `site=${RIDGE}&period=${AUG}`)
  await page.getByTestId('search-open').click()
  const panel = page.getByTestId('search')
  await expect(panel.getByTestId('search-results')).toHaveAttribute('data-ordered', 'true', { timeout: 120_000 })
  const row = panel.getByTestId('search-results').locator('li[data-site-id="poi-science-feat-shackleton"]')
  await expect(row.getByTestId('search-show')).toHaveText('Show as landing site')
  await row.getByTestId('search-show').click()
  await expect.poll(async () => (await page.evaluate(() => location.hash)).includes('site=cap:'), { timeout: 15_000 }).toBe(true)
  expect((await viewOf(page)) ?? 'site').toBe('site') // the landing-site view is the default: the link leaves `view` out
  const site = (await page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('site')))!
  expect(site).toMatch(/^cap:/)
  await page.waitForFunction((id) => (window as unknown as { __scene: Scene }).__scene.siteId() === id, site, { timeout: 60_000 })
  await expect.poll(() => scene(page, (s) => s.eyeClearance().level), { timeout: 15_000 }).toBe('site')
  expect((await scene(page, (s) => s.eyeClearance())).clearance!).toBeGreaterThan(0)
})

test('U6: Esc while the simulation plays returns to the landing site, not to the Moon; Esc otherwise still goes to the Moon', async ({ page }) => {
  await openApp(page, `site=${RIDGE}&period=${AUG}&view=eye`)
  await page.getByTestId('simulate').click()
  await expect(page.getByTestId('simulate')).toHaveText('Pause')
  await page.locator('body').press('Escape')
  await expect.poll(async () => await viewOf(page)).not.toBe('globe')
  await expect.poll(() => scene(page, (s) => s.level())).toBe('site')
  // Esc also ended the simulation (U18). Not playing: Esc keeps today's behaviour (the Moon view).
  await expect(page.getByTestId('simulate')).toHaveText('Play')
  await page.locator('body').press('Escape')
  await expect.poll(async () => await viewOf(page)).toBe('globe')
})
