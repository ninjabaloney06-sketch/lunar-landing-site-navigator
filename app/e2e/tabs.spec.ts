// Team requests of 15 Nov (whiteboard and chat): the Details drawer in three tabs with the settings above the graph,
// the date menu's way to the date search, controls drawn as buttons, the search's "at least" minimums for sunlight
// and comms, and the mission's name on the landing-site label in the scene.
// Run: PW_GPU=1 PW_PORT=5193 npx playwright test e2e/tabs.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { openFold } from './header'

const RIDGE = 'connecting-ridge'
const AUG = 'shackleton-2027-08'
const DEMO = `/#site=${RIDGE}&period=${AUG}`

async function open(page: Page, url = DEMO) {
  await page.goto(url)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
}
const drawerOf = (page: Page) => page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('drawer'))
const headings = (page: Page) => page.getByTestId('drawer').getByRole('heading', { level: 3 }).allTextContents()

test('Details opens at Site details; Dates and Compare are tabs of their own, each with only its own sections', async ({ page }) => {
  await open(page)
  await page.getByTestId('details').click()
  const drawer = page.getByTestId('drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('tab')).toHaveText(['Site details', 'Dates', 'Compare'])
  await expect(page.getByTestId('drawer-tab-site')).toHaveAttribute('aria-selected', 'true')
  // Settings first, the graph last (before the method): stations and power inputs above the horizon graph.
  const site = await headings(page)
  expect(site.slice(0, 2)).toEqual(['Stations', 'Power and battery estimate'])
  expect(site).toContain('Site potential')
  expect(site).toContain('Open in NASA tools')
  expect(site).toContain('Export')
  expect(site.indexOf('Horizon')).toBeGreaterThan(site.indexOf('Export'))
  expect(site).not.toContain('Find better dates')
  expect(site).not.toContain('All sites')

  await page.getByTestId('drawer-tab-dates').click()
  await expect(page.getByTestId('drawer-tab-dates')).toHaveAttribute('aria-selected', 'true')
  expect(await headings(page)).toEqual(['Find better dates', 'Year timeline'])
  await expect.poll(() => drawerOf(page)).toBe('finder')

  await page.getByTestId('drawer-tab-compare').click()
  await expect(page.getByTestId('drawer-tab-compare')).toHaveAttribute('aria-selected', 'true')
  expect(await headings(page)).toEqual(['Compare', 'All sites'])
  await expect.poll(() => drawerOf(page)).toBe('compare')

  await page.getByTestId('drawer-tab-site').click()
  await expect.poll(() => drawerOf(page)).toBe('details')
  await expect(drawer.getByRole('heading', { level: 3 }).first()).toHaveText('Stations')
})

test('links open the right tab: drawer=finder, drawer=compare, drawer=missions, drawer=sources', async ({ page }) => {
  for (const [section, tab] of [
    ['finder', 'dates'],
    ['compare', 'compare'],
    ['missions', 'compare'],
    ['sources', 'site'],
  ]) {
    await open(page, `${DEMO}&drawer=${section}`)
    await expect(page.getByTestId(`drawer-tab-${tab}`)).toHaveAttribute('aria-selected', 'true')
    await page.goto('about:blank')
  }
})

test('the date menu leads to the Dates tab', async ({ page }) => {
  await open(page)
  await page.getByTestId('date').click()
  await page.getByTestId('best-finder').click()
  await expect(page.getByTestId('drawer-tab-dates')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('drawer').getByRole('heading', { level: 3 }).first()).toHaveText('Find better dates')
})

test('header and timeline controls are drawn as buttons: a 1 px box, no underline', async ({ page }) => {
  await open(page)
  for (const id of ['details', 'search-open', 'date', 'view', 'simulate']) {
    const css = await page.getByTestId(id).evaluate((el) => {
      const c = getComputedStyle(el)
      return { w: c.borderTopWidth, s: c.borderTopStyle, line: c.textDecorationLine }
    })
    expect(css, id).toEqual({ w: '1px', s: 'solid', line: 'none' })
  }
})

test('search: "at least" minimums say how much sunlight and station contact a place must have', async ({ page }) => {
  await open(page)
  await page.getByTestId('search-open').click()
  const panel = page.getByTestId('search')
  const list = panel.getByTestId('search-results')
  await expect(list).toHaveAttribute('data-ordered', 'true', { timeout: 120_000 })
  const all = await list.locator('li').count()
  expect(all).toBeGreaterThan(5)
  await expect(panel.getByTestId('search-below')).toHaveCount(0)

  const pct = async (col: string) =>
    (await list.locator(`li .search-num[data-col="${col}"] .mono`).allTextContents()).map((t) => parseFloat(t))
  // Every place has a value from 0 to 100 %; ask for more sunlight than the least sunlit place has.
  const lit = await pct('lit')
  const known = lit.filter((v) => Number.isFinite(v))
  const min = Math.min(...known)
  const max = Math.max(...known)
  expect(max).toBeGreaterThan(min)
  const ask = Math.min(100, Math.floor(min) + 1)
  await openFold(panel, 'search-filters') // the minimums are in the folded Filters
  await panel.getByTestId('search-min-lit').fill(String(ask))
  await expect(panel.getByTestId('search-below')).toBeVisible()
  const litNow = await pct('lit')
  expect(litNow.length).toBeLessThan(all)
  expect(litNow.every((v) => v >= ask)).toBe(true)
  const hidden = Number((await panel.getByTestId('search-below').textContent())!.match(/^(\d+)/)![1])
  expect(litNow.length + hidden).toBe(all)

  // Both minimums together; ranks start at 1 again among the places that are listed.
  await panel.getByTestId('search-min-comms').fill('50')
  const comms = await pct('comms')
  expect(comms.every((v) => v >= 50)).toBe(true)
  if (comms.length) await expect(list.locator('li').first()).toHaveAttribute('data-rank', '1')

  // Nothing can have more than 100 %: an invalid field is said to count as 0.
  await panel.getByTestId('search-min-lit').fill('150')
  await expect(panel.getByRole('alert').filter({ hasText: 'At least' })).toBeVisible()

  // Back to 0: everything is listed again.
  await panel.getByTestId('search-min-lit').fill('0')
  await panel.getByTestId('search-min-comms').fill('0')
  await expect(list.locator('li')).toHaveCount(all)
  await expect(panel.getByTestId('search-below')).toHaveCount(0)
})

test('the landing-site label in the scene carries the mission name once the mission is named', async ({ page }) => {
  await open(page, `${DEMO}&view=site`)
  await expect(page.getByTestId('label-site')).toHaveText('Landing site')
  await open(page, `${DEMO}&view=site&name=Aurora`)
  await expect(page.getByTestId('mission-name')).toContainText('Aurora')
  await expect(page.getByTestId('label-site')).toHaveText('Aurora landing site')
})
