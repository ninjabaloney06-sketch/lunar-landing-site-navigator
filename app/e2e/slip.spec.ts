// "If the mission slips" (views/SlipRows.tsx): the Dates tab's folded rows for the mission 1, 7 and 30 days later
// and at the nearest other prepared site. Run: PW_PORT=5180 npx playwright test e2e/slip.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { NOT_VALIDATED, VALIDATED } from '../src/data/validation'

async function open(page: Page, hash: string) {
  await page.goto(`/?test=1#${hash}`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
}

/** Opens the Dates tab of the Details drawer and the slip fold; nothing is computed before the fold opens. */
async function openSlip(page: Page) {
  await page.getByTestId('details').click()
  await page.getByTestId('drawer-tab-dates').click()
  const fold = page.getByTestId('fold-slip')
  await expect(fold).toBeVisible()
  await expect(fold.getByTestId('slip-table')).toHaveCount(0) // lazy: no rows until opened
  await fold.locator('summary').click()
  return fold
}

const PCT = /^\d+\.\d %/

test.describe('If the mission slips', () => {
  test('default view: baseline, 1, 7, 30 days later and the nearest site, with numbers; Show opens +7 days', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page, '')
    await expect(page.getByTestId('date')).toHaveText('16–29 Aug 2027')
    const fold = await openSlip(page)
    const rows = fold.locator('tbody tr')
    await expect(rows).toHaveCount(5)
    for (const k of ['now', 'slip-1', 'slip-7', 'slip-30', 'nearest']) {
      const row = fold.getByTestId(`slip-row-${k}`)
      await expect(row.getByTestId('slip-lit')).toHaveText(PCT, { timeout: 60_000 })
      await expect(row.getByTestId('slip-contact')).toHaveText(PCT)
      await expect(row).not.toContainText('NaN')
    }
    // the change in percentage points under each share, not on the baseline
    await expect(fold.getByTestId('slip-row-slip-7').getByTestId('slip-lit').locator('.th-sub')).toHaveText(/^([+−]\d+\.\d|0\.0)$/)
    await expect(fold.getByTestId('slip-row-now').locator('.th-sub')).toHaveCount(0)
    await expect(fold.getByTestId('slip-row-slip-7')).toContainText('23 Aug – 5 Sep 2027')
    await expect(fold.getByTestId('slip-row-nearest')).toContainText(/Nearest other site, \d+ km away/)
    await expect(fold.getByTestId('slip-row-nearest')).not.toContainText('Connecting Ridge')
    if (!VALIDATED) await expect(fold).toContainText(NOT_VALIDATED.slice(1)) // the Finder's marker, same switch

    await fold.getByRole('button', { name: 'Show the mission 7 days later' }).click()
    await expect(page.getByTestId('date')).toHaveAttribute('data-period-id', 'custom')
    await expect(page.getByTestId('date')).toHaveText('23 Aug – 5 Sep 2027')
  })

  test('a mission ending near 31 Dec 2030: later rows read "outside the supported dates"', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page, 'site=connecting-ridge&period=custom&from=2030-12-18T00:00Z&to=2030-12-30T00:00Z')
    const fold = await openSlip(page)
    await expect(fold.getByTestId('slip-row-slip-1').getByTestId('slip-lit')).toHaveText(PCT, { timeout: 60_000 })
    for (const k of ['slip-7', 'slip-30']) {
      const row = fold.getByTestId(`slip-row-${k}`)
      await expect(row.getByTestId('slip-outside')).toHaveText('Outside the supported dates (1 Nov 2026 to 31 Dec 2030)')
      await expect(row.getByRole('button')).toHaveCount(0)
    }
    await expect(fold).not.toContainText('NaN')
  })

  test('Switch site on the nearest-site row: that site, the same dates, rows for it', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page, '')
    const fold = await openSlip(page)
    const nearest = fold.getByTestId('slip-row-nearest')
    await expect(nearest.getByTestId('slip-lit')).toHaveText(PCT, { timeout: 60_000 })
    const name = (await nearest.locator('th').first().innerText()).split('\n')[0].trim()
    await nearest.getByRole('button', { name: `Switch to ${name}, same dates` }).click()
    await expect(page.getByTestId('site-name')).toHaveText(name)
    await expect(page.getByTestId('site-name')).not.toHaveAttribute('data-site-id', 'connecting-ridge')
    await expect(page.getByTestId('date')).toHaveText('16–29 Aug 2027')
    // the fold stays open and recomputes for the new site; its nearest site is another one
    await expect(fold.getByTestId('slip-row-now').getByTestId('slip-lit')).toHaveText(PCT, { timeout: 60_000 })
    await expect(fold.getByTestId('slip-row-nearest').locator('th')).not.toContainText(name)
  })

  test('375 px: the table scrolls inside its own box, the page does not scroll sideways', async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 375, height: 812 })
    await open(page, 'drawer=finder')
    const fold = page.getByTestId('fold-slip')
    await fold.locator('summary').click()
    await expect(fold.getByTestId('slip-row-now').getByTestId('slip-lit')).toHaveText(PCT, { timeout: 60_000 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
