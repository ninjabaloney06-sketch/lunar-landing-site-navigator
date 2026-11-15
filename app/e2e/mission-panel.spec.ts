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

test.describe('U2: the Mission menu folds what is not needed to decide', () => {
  test('first view: stations as one summary row, Play in the header, ranking and checklist folded, Add mission last', async ({ page }) => {
    const n = ((await (await page.request.get('/data/stations.json')).json()) as unknown[]).length
    const panel = await openPanel(page)
    // Nothing per site and no station checklist until asked for.
    await expect(panel.locator('[data-fact]')).toHaveCount(0)
    await expect(panel.getByRole('checkbox')).toHaveCount(0)
    const stations = panel.getByTestId('stations-toggle')
    await expect(stations).toHaveAttribute('aria-expanded', 'false')
    await expect(stations).toContainText(`${n} of ${n} stations`)
    await stations.click()
    await expect(panel.getByRole('checkbox', { checked: true })).toHaveCount(n)
    await expect(panel).toContainText('not a guaranteed radio link')
    await stations.click()
    await expect(panel.getByRole('checkbox')).toHaveCount(0)
    // Play mission is one button in the header, its explanation on hover and for screen readers.
    const play = panel.locator('.mp-head').getByRole('button', { name: 'Play mission' })
    await expect(play).toHaveAttribute('title', /^The landing site from the first to the last mission day/) // 15 Nov: the eye-level view was removed from the app
    await expect(play).toHaveAccessibleDescription(/^The landing site from the first to the last mission day/)
    // Add mission is the last control of the menu.
    const last = await panel.evaluate((el) => {
      const all = [...el.querySelectorAll('button, input, select')].filter((e) => (e as HTMLElement).offsetParent !== null)
      return all.at(-1)?.getAttribute('data-testid')
    })
    expect(last).toBe('add-mission')
  })

  test('"Choose ground stations" in the drawer opens the panel with the checklist unfolded', async ({ page }) => {
    await page.goto(`${DEMO}&drawer=details`)
    await page.getByTestId('drawer').getByRole('button', { name: 'Choose ground stations' }).click()
    const panel = page.getByTestId('mission-panel')
    await expect(panel.getByTestId('stations-toggle')).toHaveAttribute('aria-expanded', 'true')
    await expect(panel.getByRole('checkbox').first()).toBeFocused()
  })

  for (const vp of [
    { width: 1280, height: 720 },
    { width: 375, height: 812 },
  ]) {
    test(`at ${vp.width} px: header stays in view while scrolling, controls are 44 px, no row runs past the edge`, async ({ page }) => {
      await page.setViewportSize(vp)
      const panel = await openPanel(page)
      for (const b of [panel.getByRole('button', { name: 'Close' }), panel.getByRole('button', { name: 'Play mission' }), panel.getByTestId('stations-toggle'), panel.getByTestId('site-ranking')]) {
        const box = (await b.boundingBox())!
        expect(Math.round(box.height * 100) / 100, await b.innerText()).toBeGreaterThanOrEqual(44) // 43.999998 is 44 px after sub-pixel layout
      }
      await panel.getByTestId('site-ranking').click()
      await expect(panel.locator('[data-fact=computing]')).toHaveCount(0, { timeout: 60_000 })
      // Every per-site line fits inside the panel.
      const over = await panel.evaluate((el) => {
        const right = el.getBoundingClientRect().right
        return [...el.querySelectorAll('.rank-facts > *')].filter((e) => e.getBoundingClientRect().right > right + 0.5).map((e) => e.textContent)
      })
      expect(over).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
      // Scrolled to the end, the title and the close button are still visible at the panel's top.
      await panel.evaluate((el) => (el.scrollTop = el.scrollHeight))
      await expect(panel.getByRole('heading', { name: 'Mission', exact: true })).toBeInViewport()
      const head = (await panel.locator('.mp-head').boundingBox())!
      const top = (await panel.boundingBox())!
      expect(Math.abs(head.y - top.y)).toBeLessThanOrEqual(2)
      await page.screenshot({ path: `test-results/mission-panel-ranking-${vp.width}.png`, animations: 'disabled' })
    })
  }
})

// Screenshots for the review (test-results/mission-panel-*.png): first view, typed search, stations, saved mission.
for (const vp of [
  { width: 1280, height: 720 },
  { width: 375, height: 812 },
]) {
  test(`screenshots at ${vp.width} px`, async ({ page }) => {
    await page.setViewportSize(vp)
    const shot = (name: string) => page.screenshot({ path: `test-results/mission-panel-${name}-${vp.width}.png`, animations: 'disabled' })
    const panel = await openPanel(page)
    await shot('first-view')
    await panel.getByRole('combobox', { name: 'Search a site or type coordinates' }).fill('ma')
    await expect(panel.locator('[data-fact=computing]')).toHaveCount(0, { timeout: 60_000 })
    await shot('typed')
    await panel.getByRole('combobox', { name: 'Search a site or type coordinates' }).fill('')
    await panel.getByTestId('stations-toggle').click()
    await panel.getByTestId('add-mission').click()
    await panel.getByTestId('add-mission').scrollIntoViewIfNeeded()
    await shot('stations-saved')
  })
}
