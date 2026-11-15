// Wave 2, agent shell (15 Nov): the header (U4, U12), the way into and out of the flight view, click outside closes
// (U9), the header at 375 px, a saved mission's transfer cap.
// Run: PW_GPU=1 PW_PORT=5187 npx playwright test e2e/shell.spec.ts
import { expect, test } from '@playwright/test'

const RIDGE = 'connecting-ridge'
const AUG = 'shackleton-2027-08'
const DEMO = `/#site=${RIDGE}&period=${AUG}`

async function open(page: import('@playwright/test').Page, url = DEMO) {
  await page.goto(url)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
}

const hashOf = async (page: import('@playwright/test').Page) => new URLSearchParams(await page.evaluate(() => location.hash.slice(1)))
const viewOf = (page: import('@playwright/test').Page) => page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('view'))

test('U4: one Details control with an info icon and a visible label; it opens the drawer at the date search', async ({ page }) => {
  await open(page)
  const header = page.locator('header.top')
  await expect(header.getByRole('button', { name: 'Find better dates' })).toHaveCount(0)
  const details = page.getByTestId('details')
  await expect(details).toHaveText('Details')
  await expect(details).toHaveAccessibleName('Details')
  await expect(details.locator('.icon')).toHaveCount(1)
  // where the two buttons were: last in the row, top right, on the row of Search
  const d = (await details.boundingBox())!
  const s = (await page.getByTestId('search-open').boundingBox())!
  expect(Math.abs(d.y - s.y)).toBeLessThan(2)
  expect(Math.abs(d.height - s.height)).toBeLessThan(2)
  expect(d.x).toBeGreaterThan(s.x)
  await details.click()
  const drawer = page.getByTestId('drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('heading', { level: 3 }).first()).toHaveText('Find better dates')
})

test('U12: no Flight plan tab; the current mission reaches the flight view in two clicks; back to the landing site; old flight links still open', async ({ page }) => {
  await open(page, `${DEMO}&name=Ridge+one&tmax=3`)
  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Flight plan' })).toHaveCount(0)
  // two clicks: the Mission control, then "Calculate flight" for the mission on screen (not saved)
  await page.getByTestId('mission').click()
  await page.getByTestId('current-calculate-flight').click()
  await expect.poll(() => viewOf(page)).toBe('flight')
  const h = await hashOf(page)
  expect([h.get('site'), h.get('name'), h.get('tmax')]).toEqual([RIDGE, 'Ridge one', '3'])
  await expect(page.getByTestId('flight-panel')).toBeVisible()
  // a visible way back
  await page.getByTestId('back-to-site').click()
  await expect.poll(() => viewOf(page)).toBeNull() // the landing-site view is the default, so not in the link
  await expect(page.getByTestId('back-to-site')).toHaveCount(0)
  // a link with the flight view in it still opens it; Esc leaves it
  await page.goto(`/#site=${RIDGE}&period=${AUG}&view=flight`)
  await expect(page.getByTestId('flight-panel')).toBeVisible({ timeout: 30_000 })
  await page.locator('body').press('Escape')
  await expect.poll(() => viewOf(page)).toBeNull() // the landing-site view is the default, so not in the link
})
