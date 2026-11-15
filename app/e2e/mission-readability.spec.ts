// U17 for the Mission menu (wave 3, read-mission): the landing site in the first view, decision values with unit,
// status and hint, full data adds the rest, one set of mission actions, no internals, every abbreviation expanded,
// no horizontal scroll at 375 px. Run: PW_GPU=1 PW_PORT=5181 npx playwright test e2e/mission-readability.spec.ts
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { FULL_DATA_KEY } from '../src/views/advanced'

const RIDGE = 'connecting-ridge'
const AUG = 'shackleton-2027-08'
const DEMO = `/#site=${RIDGE}&period=${AUG}`
const CUSTOM = 'cap:-89.47000,-136.78000' // 1 km from Connecting Ridge, inside the pin region (custom-site.spec.ts)
const SHOTS = '../../reports/read-mission'

// Research-note and app internals that must never be rendered (read.md item 8, U17 check).
const INTERNALS = ['Access not assessed', 'ESTABLISHED', 'not retrieved', '.json', 'NaN', 'undefined']
// Abbreviations this menu can show; each one shown must sit in an <abbr title> somewhere in the menu.
const ABBREVIATIONS = ['UTC', 'DSN', 'JAXA', 'ESTRACK', 'LOLA', 'SLS', 'HLS', 'LC-39B']

async function openPanel(page: Page, hash = DEMO, full = false) {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [FULL_DATA_KEY, full ? '1' : '0'])
  await page.goto(hash)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await page.getByTestId('mission').click()
  const panel = page.getByTestId('mission-panel')
  await expect(panel).toBeVisible()
  return panel
}

async function openRanking(panel: Locator) {
  await panel.getByTestId('site-ranking').click()
  await expect(panel.locator('[data-fact=computing]')).toHaveCount(0, { timeout: 60_000 })
}

async function expectClean(panel: Locator) {
  const text = await panel.innerText()
  for (const bad of INTERNALS) expect(text, bad).not.toContain(bad)
  for (const term of ABBREVIATIONS) {
    if (!new RegExp(`(?<![A-Za-z0-9-])${term.replace('-', '\\-')}(?![A-Za-z0-9])`).test(text)) continue
    expect(await panel.locator(`abbr[title]`, { hasText: new RegExp(`^${term}$`) }).count(), term).toBeGreaterThan(0)
  }
}

test('at 1280×720 the landing-site field is in the menu\'s first view, above the science goal', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const panel = await openPanel(page)
  const search = panel.getByRole('combobox', { name: 'Search a site or type coordinates' })
  const box = (await search.boundingBox())!
  const pb = (await panel.boundingBox())!
  expect(await panel.evaluate((el) => el.scrollTop)).toBe(0)
  expect(box.y + box.height).toBeLessThanOrEqual(pb.y + pb.height)
  const goal = (await panel.getByRole('radio', { name: 'Any' }).boundingBox())!
  expect(goal.y).toBeGreaterThan(box.y)
})

test('summary mode: decision values with unit, status and hint; full data adds gap, Earth in view and days', async ({ page }) => {
  const panel = await openPanel(page)
  await openRanking(panel)
  const first = panel.locator('[data-group=ranked] [role=option]').first()
  for (const f of ['lit', 'comms']) {
    const fact = first.locator(`[data-fact=${f}]`)
    await expect(fact).toHaveText(/\d+\.\d %/)
    await expect(fact).toHaveAttribute('data-status', /^(pass|fail)$/)
    await expect(fact).toHaveAttribute('title', /Threshold: at least \d+ %/)
  }
  // A value that misses its threshold says by what in words, not by colour alone.
  for (const miss of await panel.locator('[data-fact=lit][data-status=fail]').all()) await expect(miss).toContainText(/below \d+ %/)
  await expect(first.locator('[data-fact=slope]')).toHaveAttribute('title', /Limit: at most 5°/)
  // Summary: no breakdown values.
  await expect(panel.locator('[data-fact=gap], [data-fact=earth]')).toHaveCount(0)
  await expect(panel.getByTestId('mp-rule').locator('li')).toHaveCount(3)
  await expectClean(panel)

  await panel.getByTestId('full-data-switch').click()
  await expect(first.locator('[data-fact=gap]')).toHaveText(/^longest contact gap (\d+\.\d h|\d+ days?( \d+ h)?)/)
  await expect(first.locator('[data-fact=earth]')).toHaveText(/^Earth in view \d+\.\d %$/)
  await expect(first.locator('[data-fact=dark]')).toHaveCount(1)
  await expect(first.locator('[data-fact=lit]')).toContainText(/\(≈ [\d.]+ of 14 days\)/)
  await expect(panel.getByTestId('mp-rule')).toContainText('LOLA')
  await expectClean(panel)
})

test('typed search results carry the same values; dates errors use 16 Aug 2027 style', async ({ page }) => {
  const panel = await openPanel(page)
  await panel.getByRole('combobox', { name: 'Search a site or type coordinates' }).fill('ma')
  await expect(panel.locator('[data-fact=computing]')).toHaveCount(0, { timeout: 60_000 })
  const opt = panel.getByRole('option').first()
  await expect(opt.locator('[data-fact=lit]')).toHaveAttribute('data-status', /^(pass|fail)$/)
  const start = panel.getByLabel('Start', { exact: true })
  await start.fill('2035-01-01')
  await start.press('Enter')
  await expect(panel.getByRole('alert')).toHaveText('Dates from 1 Nov 2026 to 31 Dec 2030 (UTC) are supported.')
})

test('ground stations name the networks in stations.json; saved missions: custom site by mission name, transfer cap, one action set', async ({ page }) => {
  const stations = (await (await page.request.get('/data/stations.json')).json()) as { network: string }[]
  const panel = await openPanel(page, `/#site=${encodeURIComponent(CUSTOM)}&period=${AUG}&name=Rim%20camp&tmax=3.5`)
  const hint = panel.getByTestId('stations-hint')
  for (const n of new Set(stations.map((s) => s.network))) await expect(hint.locator('abbr', { hasText: n })).toHaveAttribute('title', /.+/)
  await expect(hint).toContainText('antennas for line-of-sight contact')
  await expect(panel.getByTestId('mission-save-note')).toContainText('transfer cap')
  await expect(panel.getByTestId('mission-actions')).toContainText('This mission Rim camp')

  await panel.getByTestId('add-mission').click()
  const saved = panel.getByTestId('saved-missions')
  const row = saved.locator('li').first()
  await expect(row).toContainText('Rim camp · ')
  await expect(row).not.toContainText('Custom site')
  await expect(row).toContainText('transfer at most 3 days 12 h')
  // One set: Compare in the list heading, "Calculate flight" at the right of each mission row, Add mission last.
  const right = async (l: Locator) => {
    const b = (await l.boundingBox())!
    return b.x + b.width
  }
  const rowCalc = await right(row.getByTestId('panel-calculate-flight'))
  expect(rowCalc).toBeGreaterThan((await panel.boundingBox())!.x + (await panel.boundingBox())!.width / 2)
  expect(await right(panel.getByTestId('current-calculate-flight'))).toBeGreaterThan((await panel.boundingBox())!.x + (await panel.boundingBox())!.width / 2)
  await expect(saved.locator('.mp-act-head').getByTestId('compare-missions')).toBeVisible()
  await expectClean(panel)
})

for (const vp of [
  { width: 1280, height: 720 },
  { width: 375, height: 812 },
]) {
  for (const full of [false, true]) {
    const mode = full ? 'full' : 'summary'
    test(`${vp.width} px, ${mode}: no horizontal scroll, 44 px controls, no internals; screenshots`, async ({ page }) => {
      await page.setViewportSize(vp)
      const panel = await openPanel(page, DEMO, full)
      await page.screenshot({ path: `${SHOTS}/mission-first-view-${mode}-${vp.width}.png`, animations: 'disabled' })
      for (const b of [panel.getByTestId('full-data-switch'), panel.getByTestId('current-calculate-flight'), panel.getByTestId('add-mission')]) {
        const box = (await b.boundingBox())!
        expect(Math.round(box.height * 100) / 100).toBeGreaterThanOrEqual(44)
      }
      await openRanking(panel)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
      const over = await panel.evaluate((el) => {
        const r = el.getBoundingClientRect().right
        return [...el.querySelectorAll('.rank-facts > *, .ms-row > *, .mp-head > *')].filter((e) => e.getBoundingClientRect().right > r + 0.5).map((e) => e.textContent)
      })
      expect(over).toEqual([])
      await expectClean(panel)
      await page.screenshot({ path: `${SHOTS}/mission-ranking-${mode}-${vp.width}.png`, animations: 'disabled' })
      await panel.getByTestId('site-ranking').click()
      await panel.getByTestId('add-mission').click()
      await panel.getByTestId('mission-actions').scrollIntoViewIfNeeded()
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
      await page.screenshot({ path: `${SHOTS}/mission-actions-${mode}-${vp.width}.png`, animations: 'disabled' })
    })
  }
}
