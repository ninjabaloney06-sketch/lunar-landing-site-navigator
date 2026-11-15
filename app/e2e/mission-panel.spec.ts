// Mission panel, wave 1 (U1 landing-site field, U2 compact menu).
// Run: PW_GPU=1 PW_PORT=5184 npx playwright test e2e/mission-panel.spec.ts
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const RIDGE = 'connecting-ridge'
const AUG = 'shackleton-2027-08'
const DEMO = `/#site=${RIDGE}&period=${AUG}`

async function openPanel(page: Page, hash = DEMO) {
  await page.goto(hash)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await page.getByTestId('mission').click()
  const panel = page.getByTestId('mission-panel')
  await expect(panel).toBeVisible()
  return panel
}

test.describe('U1: the landing-site field lists nothing until the user types', () => {
  test('the field shows the current site; focus or an emptied field shows no list; typing shows the matches', async ({ page }) => {
    const panel = await openPanel(page)
    const search = panel.getByRole('combobox', { name: 'Search a site or type coordinates' })
    await expect(search).toHaveValue('Connecting Ridge')
    await expect(search).toHaveAttribute('aria-expanded', 'false')
    await expect(panel.getByRole('option')).toHaveCount(0)

    await search.focus()
    await expect(panel.getByRole('option')).toHaveCount(0)
    await search.fill('')
    // Empty field + focus: the placeholder is the one-line hint, there is no list.
    await expect(search).toHaveAttribute('placeholder', /^Site name, or /)
    await expect(panel.getByRole('option')).toHaveCount(0)
    await expect(panel.getByRole('listbox')).not.toContainText(/./)

    await search.fill('malapert')
    await expect(search).toHaveAttribute('aria-expanded', 'true')
    const opts = panel.getByRole('option')
    expect(await opts.count()).toBeGreaterThan(0)
    for (const name of await opts.locator('.opt-name').allInnerTexts()) expect(name.toLowerCase()).toContain('malapert')

    // Emptying the field again hides the list; leaving it empty shows the site's name again.
    await search.fill('')
    await expect(panel.getByRole('option')).toHaveCount(0)
    await panel.getByLabel('Name', { exact: true }).focus()
    await expect(search).toHaveValue('Connecting Ridge')
  })

  test('typed coordinates show the point actions, not the site list', async ({ page }) => {
    const panel = await openPanel(page)
    const search = panel.getByRole('combobox', { name: 'Search a site or type coordinates' })
    await search.fill('89.3 S, 130 W')
    await expect(panel.getByRole('status')).toContainText('89.30° S · 130.00° W')
    await expect(panel.getByRole('option')).toHaveCount(0)
  })

  test('the full ranking of every site stays one click away', async ({ page }) => {
    const sites = (await (await page.request.get('/data/sites.json')).json()) as { id: string }[]
    const panel = await openPanel(page)
    const toggle = panel.getByTestId('site-ranking')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(panel.getByRole('option')).toHaveCount(sites.length)
    await toggle.click()
    await expect(panel.getByRole('option')).toHaveCount(0)
  })
})
