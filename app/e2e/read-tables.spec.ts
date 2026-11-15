// U17 readability checks for the sites table with your missions, the compare view, the search panel and the
// station checklist (wave 3, read-tables). Summary mode shows no internals, every abbreviation shown has an
// expansion, values carry units, 375 px has no horizontal scroll.
// Run: PW_GPU=1 PW_PORT=5184 npx playwright test e2e/read-tables.spec.ts
// SHOT_DIR=<folder> also writes the 1280 / 375 px screenshots of each screen in both modes.
import { expect, test, type Locator, type Page } from '@playwright/test'

const DEMO = '/#site=connecting-ridge&period=shackleton-2027-08'
const INTERNALS = ['Access not assessed', 'ESTABLISHED', 'not retrieved', '.json', 'NaN', 'undefined']
const MISSION = new URLSearchParams({ site: 'malapert-massif', period: 'shackleton-2027-09', pad: 'ksc-39b', rocket: 'artemis-blue-moon', stay: '5', name: 'Massif B' }).toString()
const SHOT_DIR = process.env.SHOT_DIR

async function seedMission(page: Page) {
  await page.addInitScript((m) => window.localStorage.setItem('llsn.missions.v1', JSON.stringify([m])), MISSION)
}

async function noInternals(el: Locator) {
  const text = await el.innerText()
  for (const t of INTERNALS) expect(text, `"${t}" in the summary text`).not.toContain(t)
}

/** Every <abbr> in el has a title, and the station networks shown are among them. */
async function abbrsExpanded(el: Locator) {
  const missing = await el.locator('abbr').evaluateAll((xs) => xs.filter((x) => !x.getAttribute('title')).map((x) => x.textContent))
  expect(missing).toEqual([])
}

async function noHScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
}

async function shot(page: Page, el: Locator, name: string) {
  if (!SHOT_DIR) return
  // The views sit in scrolling panels: scroll the element's top into view and take the viewport.
  await el.evaluate((e) => e.scrollIntoView({ block: 'start' }))
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png` })
}

async function openDrawer(page: Page) {
  await page.goto(`${DEMO}&drawer=compare`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  const table = page.getByTestId('site-table')
  await table.scrollIntoViewIfNeeded()
  await expect(table.getByText('…', { exact: true })).toHaveCount(0, { timeout: 90_000 })
  return table
}

for (const vp of [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
]) {
  test.describe(`tables at ${vp.width} px`, () => {
    test.use({ viewport: vp })

    test('sites table and your missions: units in the heads, slope status in words, row actions name what they do', async ({ page }) => {
      test.setTimeout(180_000)
      await seedMission(page)
      const table = await openDrawer(page)
      await expect(table.getByRole('columnheader').nth(1)).toHaveText('Sunlit, % of time')
      await expect(table).toContainText('Percentages are shares of these dates.')
      await expect(table.getByTestId('st-rank-hint')).toContainText('Ranks every site for these dates by')
      await expect(table.locator('tr[data-site-id="malapert-massif"]').getByRole('button', { name: 'Find better dates for Malapert Massif' })).toHaveCount(1)
      const mission = table.getByTestId('mission-rows')
      await expect(mission).toContainText('Your missions')
      await expect(mission.locator('tr[data-mission]')).toContainText('Massif B')
      await expect(mission.locator('tr[data-mission]')).toContainText('Malapert Massif · 12–26 Sep 2027')
      await expect(mission.getByTestId('mission-flight')).toHaveText('Stay 5 days · Launchpad LC-39B · Rocket SLS + Blue Moon Mark 2')
      await expect(mission.locator('[data-col=lit]')).toHaveText(/%$/, { timeout: 30_000 })
      await noInternals(table)
      await abbrsExpanded(table)
      await noHScroll(page)
      await shot(page, table, `site-table-${vp.width}-summary`)
      await shot(page, mission, `your-missions-${vp.width}-summary`)

      await page.getByTestId('drawer').getByTestId('full-data-switch').click()
      const ridge = table.locator('tr[data-site-id="connecting-ridge"]')
      // The one status colour of the table: slope against the 5° criterion, with the words beside it.
      await expect(ridge.getByTestId('st-full').locator('[data-slope]')).toHaveText(/^\d+\.\d° (\(≤ 5°\)|— too steep \(> 5°\))$/)
      await expect(ridge.getByTestId('st-full')).toContainText(/Longest darkness (\d+\.\d h|\d+ days?( \d+ h)?)/)
      await noHScroll(page)
      await shot(page, table, `site-table-${vp.width}-full`)
    })

    test('compare: says what is compared and which side is better per row, in words', async ({ page }) => {
      test.setTimeout(120_000)
      await openDrawer(page)
      const compare = page.getByTestId('compare-table')
      await compare.scrollIntoViewIfNeeded()
      // Default: the same site, the next period.
      await expect(page.getByTestId('compare-what')).toContainText('Two periods at Connecting Ridge')
      await expect(compare.getByRole('columnheader').last()).toHaveText('Better')
      const better = compare.getByTestId('compare-better')
      await expect(better).toHaveCount(5)
      await expect(better.first()).not.toHaveText('', { timeout: 30_000 })
      const words = await better.allInnerTexts()
      for (const w of words) expect(['', 'equal', '16–29 Aug 2027', '12–26 Sep 2027']).toContain(w.trim())
      expect(words.filter((w) => w.trim() !== '').length).toBeGreaterThan(0)
      await page.getByLabel('Compare with site').selectOption('malapert-massif')
      await page.getByLabel('Compare with period').selectOption('shackleton-2027-08')
      await expect(page.getByTestId('compare-what')).toContainText('Two sites over the same dates')
      await expect(better.first()).toHaveText(/^(Connecting Ridge|Malapert Massif|equal)$/, { timeout: 30_000 })
      const box = page.locator('.compare')
      await noInternals(box)
      await noHScroll(page)
      await shot(page, box, `compare-${vp.width}`)
    })

    test('search: values say what they are of, Best and Rank by explained, both actions read "Show as landing site"', async ({ page }) => {
      test.setTimeout(180_000)
      await page.goto(DEMO)
      await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
      await page.getByTestId('search-open').click()
      const panel = page.getByTestId('search')
      await expect(panel.getByTestId('search-results')).toHaveAttribute('data-ordered', 'true', { timeout: 150_000 })
      await expect(panel.getByTestId('search-dates')).toContainText('Sunlit and comms are % of the mission dates, 16–29 Aug 2027')
      await expect(panel.getByTestId('search-rule')).toHaveText('Best: top 3 with a chosen point within 20 km and a value above 0 %.')
      await expect(panel.getByTestId('search-by-hint')).toHaveText('Both: the weaker of sunlit % and comms %.')
      await expect(panel.getByRole('radio')).toHaveCount(3)
      const site = panel.locator('li[data-site-id="malapert-massif"]')
      await expect(site.getByTestId('search-select')).toHaveText('Show as landing site')
      await expect(site.locator('.search-item-sub').first()).toHaveText('Listed landing site')
      await expect(site.locator('.search-item-near')).toContainText(/Within 20 km: \d+ water\s+\d+ shadow\s+\d+ science/)
      const point = panel.locator('li[data-site-id^="poi-"]').first()
      if (await point.count()) await expect(point.getByTestId('search-show')).toHaveText('Show as landing site')
      if (vp.width === 375) expect((await site.getByRole('button').boundingBox())!.height).toBeGreaterThanOrEqual(44)
      await noInternals(panel)
      await abbrsExpanded(panel)
      await noHScroll(page)
      await shot(page, panel, `search-${vp.width}-summary`)
      await panel.getByTestId('full-data-switch').click()
      await expect(panel.getByTestId('search-rule')).toContainText('Places that pass the 5° slope limit first')
      await noHScroll(page)
      await shot(page, panel, `search-${vp.width}-full`)
    })

    test('station checklist: network expanded, minimum elevation with unit, coverage is line of sight, not a link budget', async ({ page }) => {
      await page.goto(DEMO)
      await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
      await page.getByTestId('mission').click()
      const panel = page.getByTestId('mission-panel')
      await panel.getByTestId('stations-toggle').click()
      const list = panel.getByTestId('station-checklist')
      await expect(list.locator('li[data-station="goldstone"]')).toContainText('DSS-24 (34 m BWG) · DSN · min. elevation 6.0°')
      await expect(list.locator('li[data-station="usuda"]')).toContainText('JAXA · min. elevation 12.5°')
      await expect(list.locator('abbr', { hasText: 'DSN' }).first()).toHaveAttribute('title', 'NASA Deep Space Network')
      await expect(list.locator('abbr', { hasText: 'DSS-24 (34 m BWG)' })).toHaveAttribute('title', /BWG: beam waveguide antenna/)
      await expect(panel.getByTestId('station-hint')).toContainText('Min. elevation: lowest Moon elevation')
      await expect(panel).toContainText('geometric line of sight to at least one selected station, not a guaranteed radio link')
      await abbrsExpanded(list)
      await noInternals(list)
      await noHScroll(page)
      await shot(page, panel.getByTestId('stations-toggle'), `stations-${vp.width}`)
    })
  })
}
