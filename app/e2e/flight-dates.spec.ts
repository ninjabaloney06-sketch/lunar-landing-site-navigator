// Reported bug (15 Nov): "I chose 16 Aug–5 Sep as mission dates; Calculate flight still computes 10–21 Aug." The flight
// plan starts from the mission: landing not before its first day and a surface stay as long as its dates (at most 30
// days, said in one line), and one line ties the flight's dates to the mission's.
// Run: PW_GPU=1 PW_PORT=5211 npx playwright test e2e/flight-dates.spec.ts
import { expect, test } from '@playwright/test'
import { headerAction } from './header'

const SITE = 'site=connecting-ridge'

test('16 Aug – 5 Sep: Flight plan lands on 16 Aug and stays the 21 mission days; the panel says so', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto(`/#${SITE}&period=custom&from=2027-08-16T00:00Z&days=21`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await expect(page.getByTestId('date')).toHaveText('16 Aug – 5 Sep 2027')
  await (await headerAction(page, 'flight-open')).click()
  const panel = page.getByTestId('flight-panel')
  await expect(panel.getByLabel('Surface stay')).toHaveValue('21')
  await expect(panel.getByTestId('flight-stay-use-mission')).toHaveCount(0) // nothing to offer: it already is the mission's
  await expect(panel.getByTestId('flight-stay-capped')).toHaveCount(0)
  const line = panel.getByTestId('flight-dates-line')
  await expect(line).toBeVisible({ timeout: 120_000 })
  await expect(line).toContainText('Lands 16 Aug, the first day of your mission; lifts off')
  await expect(line).toContainText('after a stay as long as your mission dates')
  await expect(line).toContainText('because the trip to the Moon takes days')
  // The link carries no stay of its own: the stay follows the mission dates.
  expect(new URLSearchParams(await page.evaluate(() => location.hash.slice(1))).get('stay')).toBeNull()
  // A stay typed by the user wins, and the mission's length is offered back.
  await panel.getByLabel('Surface stay').fill('5')
  await panel.getByLabel('Surface stay').press('Enter')
  await expect(panel.getByTestId('flight-stay-mission')).toContainText('Your mission dates are 21 days; this flight stays 5 days, as you set it.')
  await panel.getByTestId('flight-stay-use-mission').click()
  await expect(panel.getByLabel('Surface stay')).toHaveValue('21')
})

test('a 45-day mission: the stay is capped at 30 days, in one line', async ({ page }) => {
  await page.goto(`/#${SITE}&period=custom&from=2027-08-16T00:00Z&days=45&view=flight`)
  const panel = page.getByTestId('flight-panel')
  await expect(panel).toBeVisible({ timeout: 60_000 })
  await expect(panel.getByLabel('Surface stay')).toHaveValue('30')
  await expect(panel.getByTestId('flight-stay-capped')).toHaveText('Your mission dates are 45 days; the stay is capped at 30 days, the limit of this flight plan.')
})
