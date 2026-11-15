// UI simplification (science lead, 15 Nov: "make the UI more intuitive, it is super complicated right now"): the
// header as labelled controls (Landing site, Dates, Edit mission), one action bar (Find the best site, Site details,
// Points of interest, Flight plan, Help), the mission menu's and the search's folded sections, the How to use card,
// Play / Pause and the View label, and the same controls at 375 px behind one Menu button.
// Run: PW_GPU=1 PW_PORT=5211 npx playwright test e2e/simplify.spec.ts
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { headerAction } from './header'

const RIDGE = 'connecting-ridge'
const AUG = 'shackleton-2027-08'
const DEMO = `/#site=${RIDGE}&period=${AUG}`

async function open(page: Page, url = DEMO) {
  await page.goto(url)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
}

const hashOf = async (page: Page) => new URLSearchParams(await page.evaluate(() => location.hash.slice(1)))

for (const vp of [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
]) {
  test.describe(`${vp.width} px`, () => {
    test.use({ viewport: vp })

    test('the header reads Landing site, Dates and Edit mission; the Landing site control opens the ranked site picker directly', async ({ page }) => {
      await open(page)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mission 1')
      const siteBtn = page.getByTestId('site-open')
      await expect(siteBtn).toHaveAccessibleName('Landing site Connecting Ridge')
      await expect(siteBtn).toHaveAttribute('aria-haspopup', 'dialog')
      await expect(page.getByTestId('date')).toHaveAccessibleName('Dates 16–29 Aug 2027')
      await expect(page.getByTestId('mission')).toHaveText('Edit mission')
      // One press: the picker, with the ranking already open and the search field focused.
      await siteBtn.click()
      const picker = page.getByTestId('site-picker')
      await expect(picker).toBeVisible()
      await expect(picker.getByRole('heading', { level: 2 })).toHaveText('Landing site')
      await expect(picker.getByTestId('site-ranking')).toHaveAttribute('aria-expanded', 'true')
      await expect(picker.getByRole('combobox')).toBeFocused()
      await expect(picker.getByRole('option')).toHaveCount(await page.request.get('/data/sites.json').then(async (r) => ((await r.json()) as unknown[]).length))
      // The mission's other settings are not in the picker.
      await expect(picker.getByLabel('Name', { exact: true })).toHaveCount(0)
      await expect(page.getByTestId('mission-panel')).toHaveCount(0)
      // Choosing a row makes it the landing site and closes the picker.
      await picker.getByRole('option', { name: /Malapert Massif/ }).click()
      await expect(picker).toHaveCount(0)
      await expect(page.getByTestId('site-name')).toHaveText('Malapert Massif')
      await expect(page.getByTestId('answer')).toHaveAttribute('data-site-id', 'malapert-massif', { timeout: 30_000 })
      // Typed coordinates in the picker: Set as landing site.
      await siteBtn.click()
      await page.getByTestId('site-picker').getByRole('combobox').fill('lat -89.40 lon -136.50')
      await page.getByTestId('site-picker').getByTestId('set-site').click()
      await expect(page.getByTestId('site-picker')).toHaveCount(0)
      await expect.poll(async () => (await hashOf(page)).get('site')).toMatch(/^cap:/)
      // Esc closes the picker and gives the focus back to its control.
      await siteBtn.click()
      await expect(page.getByTestId('site-picker')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('site-picker')).toHaveCount(0)
    })

    test('Flight plan is reachable from the top level and opens the mission on screen', async ({ page }) => {
      await open(page, `${DEMO}&name=Top+level`)
      await (await headerAction(page, 'flight-open')).click()
      await expect.poll(async () => (await hashOf(page)).get('view')).toBe('flight')
      expect((await hashOf(page)).get('name')).toBe('Top level')
      await expect(page.getByTestId('flight-panel')).toBeVisible({ timeout: 30_000 })
      // A propellant shortfall (the default design at this site and date: "ICPS short by …") always comes with one
      // plain line on what it means for the mission; a flight with enough propellant has none.
      const glance = page.getByTestId('flight-glance-propellant')
      await expect(glance).toBeVisible({ timeout: 90_000 })
      if ((await glance.getAttribute('data-tone')) === 'short') {
        await expect(page.getByTestId('flight-short-meaning')).toHaveText(/^What this means: as planned, this design does not carry enough propellant for this mission\./)
      } else await expect(page.getByTestId('flight-short-meaning')).toHaveCount(0)
      await page.getByTestId('back-to-site').click()
      await expect.poll(async () => (await hashOf(page)).get('view')).toBeNull()
    })

    test('the mission menu shows name, dates, site and saving; goal, points and stations are folded with their value', async ({ page }) => {
      await open(page, `${DEMO}&goal=cold-trap`)
      await page.getByTestId('mission').click()
      const panel = page.getByTestId('mission-panel')
      await expect(panel.getByLabel('Name', { exact: true })).toBeVisible()
      await expect(panel.getByLabel('Start', { exact: true })).toBeVisible()
      await expect(panel.getByTestId('mp-site-section')).toBeVisible()
      await expect(panel.getByTestId('add-mission')).toBeAttached()
      const n = ((await (await page.request.get('/data/stations.json')).json()) as unknown[]).length
      const sections: [string, string, () => Promise<void>][] = [
        ['goal-toggle', 'Science goal: Cold traps (permanent shadow)', async () => {
          await expect(panel.getByRole('radio', { name: 'Cold traps (permanent shadow)' })).toBeChecked()
        }],
        ['points-toggle', 'Your points: none', async () => {
          await expect(panel.getByTestId('points').getByText('None yet.')).toBeVisible()
        }],
        ['stations-toggle', `Ground stations: ${n} of ${n}`, async () => {
          await expect(panel.getByRole('checkbox')).toHaveCount(n)
        }],
      ]
      // Folded: the summary line only, none of the inputs.
      await expect(panel.getByRole('radio')).toHaveCount(0)
      await expect(panel.getByRole('checkbox')).toHaveCount(0)
      for (const [id, text, inside] of sections) {
        const t = panel.getByTestId(id)
        await expect(t).toHaveAttribute('aria-expanded', 'false')
        await expect(t).toHaveText(text)
        await t.click()
        await expect(t).toHaveAttribute('aria-expanded', 'true')
        await inside()
        await t.click()
        await expect(t).toHaveAttribute('aria-expanded', 'false')
      }
      // A changed goal shows in its summary line.
      await panel.getByTestId('goal-toggle').click()
      await panel.getByRole('radio', { name: 'Any' }).check()
      await expect(panel.getByTestId('goal-toggle')).toHaveText('Science goal: Any')
    })

    test('Find the best site: the results come first; the filters are folded behind one line that names them', async ({ page }) => {
      test.setTimeout(240_000)
      await open(page)
      await (await headerAction(page, 'search-open')).click()
      const panel = page.getByTestId('search')
      await expect(panel.getByRole('heading', { level: 2 })).toHaveText('Find the best site')
      await expect(panel.getByTestId('search-results')).toHaveAttribute('data-ordered', 'true', { timeout: 150_000 })
      const toggle = panel.getByTestId('search-filters')
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      // The defaults, unchanged: three kinds of point within 20 km, the slope limit on, ranked by both values.
      await expect(toggle).toHaveText('Filters: 3 of 6 kinds of point within 20 km · passes the 5° slope limit · ranked by both')
      await expect(panel.getByRole('checkbox')).toHaveCount(0)
      await expect(panel.getByRole('spinbutton')).toHaveCount(0)
      await toggle.click()
      await expect(panel.getByRole('checkbox')).toHaveCount(7) // six kinds + the slope limit
      await expect(panel.getByRole('radio', { name: 'Both' })).toBeChecked()
      await panel.getByLabel('Within, km').fill('30')
      await panel.getByTestId('search-min-lit').fill('50')
      await expect(toggle).toHaveText('Filters: 3 of 6 kinds of point within 30 km · passes the 5° slope limit · sunlit at least 50 % · ranked by both')
    })

    test('How to use: shown on a first visit, Got it closes it for good, Help opens it again', async ({ browser }) => {
      // A first visit: nothing stored (the config stores the dismissal for every other test).
      const context = await browser.newContext({ viewport: vp, storageState: { cookies: [], origins: [] } })
      const page = await context.newPage()
      await open(page)
      const card = page.getByTestId('help-card')
      await expect(card).toBeVisible()
      await expect(card.getByRole('heading')).toHaveText('How to use')
      await expect(card.getByRole('listitem')).toHaveCount(3)
      await expect(card.getByRole('listitem').nth(0)).toContainText('Pick a landing site')
      await expect(card.getByRole('listitem').nth(1)).toContainText('Pick the mission dates')
      await expect(card.getByRole('listitem').nth(2)).toContainText('Press Play')
      // The card stays off the timeline.
      const c = (await card.boundingBox())!
      const tl = (await page.getByTestId('cursor-time').boundingBox())!
      expect(c.y + c.height).toBeLessThan(tl.y)
      await card.getByRole('button', { name: 'Got it' }).click()
      await expect(card).toHaveCount(0)
      await page.reload()
      await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
      await expect(page.getByTestId('help-card')).toHaveCount(0)
      const help = await headerAction(page, 'help-open')
      await help.click()
      await expect(page.getByTestId('help-card')).toBeVisible()
      await page.getByTestId('help-dismiss').click()
      await expect(page.getByTestId('help-card')).toHaveCount(0)
      await context.close()
    })

    test('Play reads Play and Pause; View names the camera; the cursor time sits above the timeline; no sideways scroll', async ({ page }) => {
      await open(page)
      const play = page.getByTestId('simulate')
      await expect(play).toHaveText('Play')
      await expect(play).toHaveAccessibleName('Play')
      await play.click()
      await expect(play).toHaveText('Pause')
      await play.click()
      await expect(play).toHaveText('Play')
      await expect(page.getByTestId('view')).toHaveText('View: Landing site')
      await page.getByTestId('view').click()
      await page.getByTestId('view-menu').getByRole('menuitem', { name: 'Moon', exact: true }).click()
      await expect(page.getByTestId('view')).toHaveText(/^View: /)
      await expect(page.getByTestId('cursor-time')).toHaveText(/^\d{1,2} \w+ 2027, \d\d:\d\d UTC$/)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    })
  })
}

test.describe('375 px: the action bar folds into one Menu button', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('Menu opens the action bar as a list over the scene, never over the timeline; a choice closes it', async ({ page }) => {
    await open(page)
    const menu = page.getByTestId('menu-open')
    await expect(menu).toBeVisible()
    await expect(menu).toHaveText('Menu')
    await expect(page.getByTestId('search-open')).toBeHidden()
    await menu.click()
    await expect(menu).toHaveAttribute('aria-expanded', 'true')
    const names = ['Find the best site', 'Site details', 'Points of interest', 'Flight plan', 'Help']
    for (const name of names) await expect(page.locator('#header-actions').getByRole('button', { name, exact: true })).toBeVisible()
    const list = (await page.locator('#header-actions').boundingBox())!
    const tl = (await page.getByTestId('cursor-time').boundingBox())!
    expect(list.y + list.height).toBeLessThan(tl.y)
    await page.getByTestId('details').click()
    await expect(page.getByTestId('drawer')).toBeVisible()
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
  })
})
