// The Dates tab's year timeline as a stack of places (team lead, 15 Nov): the current mission's site, every saved
// mission's site, every point of "Your points" that can be a landing site, and the remaining prepared sites behind
// "All prepared sites". Run: PW_PORT=5182 npx playwright test e2e/year-rows.spec.ts
import { expect, test, type Page } from '@playwright/test'

const RIDGE = 'connecting-ridge'
const MASSIF = 'malapert-massif'
const AUG = 'shackleton-2027-08'
const POINT_ID = 'cap:-85.50000,12.25000'

async function open(page: Page, hash: string) {
  await page.goto(`/?test=1#${hash}`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
}

test('a fresh link: one row, then the folded "All prepared sites", computed only when opened', async ({ page }) => {
  test.setTimeout(240_000)
  await open(page, 'drawer=finder')
  const drawer = page.getByTestId('drawer')
  const rows = drawer.getByTestId('year-timeline').getByTestId('year-row')
  await expect(rows).toHaveCount(1)
  await expect(rows.nth(0)).toHaveAttribute('data-site-id', RIDGE)
  await expect(rows.nth(0)).toHaveAttribute('data-state', 'done', { timeout: 60_000 })
  await expect(rows.nth(0).locator('.yt-val')).toHaveText(/^\d+\.\d %$/)
  await expect(rows.nth(0).getByTestId('year-row-sub')).toHaveCount(0) // as before: the name alone
  await expect(rows.nth(0).locator('button')).toHaveCount(0)

  const fold = drawer.getByTestId('year-all')
  await expect(fold.locator('summary h3')).toHaveText('All prepared sites')
  await expect(fold).not.toHaveAttribute('open', '')
  await expect(drawer.getByTestId('year-row')).toHaveCount(1) // nothing behind the fold yet

  const siteCount = await page.evaluate(async () => ((await (await fetch('/data/sites.json')).json()) as { sites?: unknown[] } | unknown[]))
  const n = Array.isArray(siteCount) ? siteCount.length : (siteCount.sites ?? []).length
  await fold.locator('summary').click()
  const rest = fold.getByTestId('year-row')
  await expect(rest).toHaveCount(n - 1)
  expect(await rest.evaluateAll((rs) => rs.map((r) => r.getAttribute('data-site-id')))).not.toContain(RIDGE)
  await expect(rest.nth(0)).not.toHaveAttribute('data-state', 'computing', { timeout: 60_000 })
  await expect(rest.nth(n - 2)).not.toHaveAttribute('data-state', 'computing', { timeout: 180_000 })
  await expect(rest.nth(0).locator('.yt-val')).toHaveText(/^(\d+\.\d %|no data)$/)
})

for (const vp of [
  { width: 1280, height: 720 },
  { width: 375, height: 812 },
]) {
  test(`two saved missions and two points at ${vp.width} px: a row each with its values, no horizontal scroll`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize(vp)
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('llsn.missions.v1', JSON.stringify(['site=connecting-ridge&period=shackleton-2027-08&name=Ridge%20ops', 'site=malapert-massif&period=shackleton-2027-09&name=Massif%20survey']))
        sessionStorage.setItem('seeded', '1')
      }
    })
    await open(page, `site=${RIDGE}&period=${AUG}&drawer=finder&pts=-85.5,12.25,,Ridge%20camp;45,10,,North`)
    const drawer = page.getByTestId('drawer')
    const rows = drawer.getByTestId('year-timeline').getByTestId('year-row')
    await expect(rows).toHaveCount(4)
    expect(await rows.evaluateAll((rs) => rs.map((r) => r.getAttribute('data-site-id')))).toEqual([RIDGE, MASSIF, POINT_ID, null])
    await expect(rows.locator('.yt-name')).toHaveText(['Connecting Ridge', 'Malapert Massif', 'Ridge camp', 'North'])
    await expect(rows.getByTestId('year-row-sub')).toHaveText(['Current mission, Ridge ops', 'Massif survey', 'Your point, approximate', 'Your point'])
    for (const i of [0, 1, 2]) {
      await expect(rows.nth(i)).toHaveAttribute('data-state', 'done', { timeout: 90_000 })
      await expect(rows.nth(i).locator('.yt-val')).toHaveText(/^\d+\.\d %$/)
      expect(await rows.nth(i).getByTestId('year-seg').count()).toBeGreaterThan(0)
    }
    await expect(rows.nth(1).locator('.yt-mission')).toHaveAttribute('title', 'Massif survey')
    await expect(rows.nth(2).getByTestId('year-row-sub')).toHaveAttribute('title', /Approximate: from \d+ m/)
    // The point north of the pin region: plain words, no bar, no number.
    await expect(rows.nth(3)).toHaveText(/Landing sites can be set only south of \d+° S\./)
    await expect(rows.nth(3).locator('.yt-bar, .yt-val')).toHaveCount(0)

    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    expect(await drawer.evaluate((d) => d.scrollWidth - d.clientWidth)).toBeLessThanOrEqual(0)
    await drawer.getByTestId('year-timeline').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `test-results/year-rows-${vp.width}.png` })

    // A row's name selects that site; the Dates tab stays open and the row becomes the current one.
    await rows.nth(1).locator('button.yt-name').click()
    await expect(rows.nth(0)).toHaveAttribute('data-site-id', MASSIF)
    await expect(rows.nth(0).getByTestId('year-row-sub')).toHaveText('Current mission, Massif survey')
  })
}
