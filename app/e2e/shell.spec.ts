// Wave 2, agent shell (15 Nov): the header (U4, U12), the way into and out of the flight view, click outside closes
// (U9), the header at 375 px, a saved mission's transfer cap.
// Run: PW_GPU=1 PW_PORT=5187 npx playwright test e2e/shell.spec.ts
import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'

const RIDGE = 'connecting-ridge'
const AUG = 'shackleton-2027-08'
const DEMO = `/#site=${RIDGE}&period=${AUG}`
const SHOTS = 'test-results/shell' // copied to the run's reports folder by hand

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

test.use({ viewport: { width: 1280, height: 720 } })

test('U12: no Flight plan tab; the current mission reaches the flight view in two clicks; back to the landing site; old flight links still open', async ({ page }) => {
  await open(page, `${DEMO}&name=Ridge+one&tmax=3`)
  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Flight plan' })).toHaveCount(0)
  // two clicks: the Mission control, then "Calculate flight" for the mission on screen (not saved)
  await page.getByTestId('mission').click()
  await page.getByTestId('current-calculate-flight').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${SHOTS}/1280-mission-calculate-flight.png` })
  await page.getByTestId('current-calculate-flight').click()
  await expect.poll(() => viewOf(page)).toBe('flight')
  const h = await hashOf(page)
  expect([h.get('site'), h.get('name'), h.get('tmax')]).toEqual([RIDGE, 'Ridge one', '3'])
  await expect(page.getByTestId('flight-panel')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/1280-flight-back-link.png` })
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

test.describe('U9: a press outside closes every open menu and panel; the 3D canvas counts as outside', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('drawer, search, mission panel, date menu and View menu each close on a press on the canvas; a press inside keeps them', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page)
    const canvas = page.locator('.stage canvas').first()
    await expect(canvas).toBeVisible()
    // a point of the scene that no panel covers: left of the drawer, below the header, above the timeline
    const onCanvas = async () => {
      const b = (await canvas.boundingBox())!
      await page.mouse.click(b.x + b.width * 0.55, b.y + b.height * 0.45)
    }
    const cases: [string, () => Promise<void>, string | Locator][] = [
      ['drawer', () => page.getByTestId('details').click(), 'drawer'],
      ['search', () => page.getByTestId('search-open').click(), 'search'],
      ['mission panel', () => page.getByTestId('mission').click(), 'mission-panel'],
      ['date menu', () => page.getByTestId('date').click(), page.getByRole('dialog', { name: 'Time periods' })],
      ['View menu', () => page.getByTestId('view').click(), 'view-menu'],
    ]
    for (const [what, openIt, id] of cases) {
      await openIt()
      const panel = typeof id === 'string' ? page.getByTestId(id) : id
      await expect(panel, `${what} open`).toBeVisible()
      // a press inside does not close it
      const pb = (await panel.boundingBox())!
      await page.mouse.click(pb.x + 4, pb.y + 4)
      await expect(panel, `${what} after a press inside`).toBeVisible()
      await onCanvas()
      await expect(panel, `${what} after a press on the canvas`).toHaveCount(0)
    }
    // the press that closed a panel did not also change the selection (no walk, no site change)
    await expect(page.getByTestId('site-name')).toHaveText('Connecting Ridge')
  })

  test('the drawer also closes on a press on the header or the timeline', async ({ page }) => {
    await open(page)
    await page.getByTestId('details').click()
    await expect(page.getByTestId('drawer')).toBeVisible()
    await page.getByTestId('coords').click()
    await expect(page.getByTestId('drawer')).toHaveCount(0)
    await page.getByTestId('details').click()
    await expect(page.getByTestId('drawer')).toBeVisible()
    await page.getByTestId('answer').click()
    await expect(page.getByTestId('drawer')).toHaveCount(0)
  })
})


test.describe('header at 375 px (visual sweep 8, 26, 29) and the drawer beside the header (11), the site subtitle (21)', () => {
  test('375 px: header controls on at most two rows, each at least 44 px tall; coordinates on one line; View and Simulate 44 px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    // Haworth's longitude has three digits before the point: the longest coordinate text
    for (const url of [DEMO, `/#site=haworth&period=${AUG}`, `${DEMO}&view=globe`]) {
      await open(page, url)
      await page.evaluate(() => document.fonts.ready)
      const tops = new Set<number>()
      for (const id of ['poi-toggle', 'search-open', 'details']) {
        const b = (await page.getByTestId(id).boundingBox())!
        expect(b.height, id).toBeGreaterThanOrEqual(44 - 0.01)
        expect(b.x + b.width, id).toBeLessThanOrEqual(375)
        tops.add(Math.round(b.y))
      }
      expect(tops.size).toBeLessThanOrEqual(2)
      for (const id of ['view', 'simulate', 'date']) expect((await page.getByTestId(id).boundingBox())!.height, id).toBeGreaterThanOrEqual(44 - 0.01)
      const coords = page.getByTestId('coords')
      const lineH = await coords.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight) || 20)
      expect((await coords.boundingBox())!.height).toBeLessThan(lineH * 1.5)
    }
    await page.screenshot({ path: `${SHOTS}/375-globe.png` })
    await open(page, DEMO)
    await page.screenshot({ path: `${SHOTS}/375-site.png` })
    await page.getByTestId('details').click()
    await page.screenshot({ path: `${SHOTS}/375-drawer.png` })
  })

  test('1280 px: an open drawer or search never lies over a header control', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await open(page)
    await page.screenshot({ path: `${SHOTS}/1280-site.png` })
    for (const [btn, id] of [['details', 'drawer'], ['search-open', 'search']]) {
      await page.getByTestId(btn).click()
      const left = (await page.getByTestId(id).boundingBox())!.x
      for (const c of await page.locator('header.top').getByRole('button').all()) {
        if (!(await c.isVisible())) continue
        const b = (await c.boundingBox())!
        expect(b.x + b.width, `${await c.innerText()} with the ${id} open`).toBeLessThanOrEqual(left)
      }
      await page.screenshot({ path: `${SHOTS}/1280-${id}.png` })
      await page.keyboard.press('Escape')
      await expect(page.getByTestId(id)).toHaveCount(0)
    }
  })

  test('a site whose label only says it was dropped from a candidate list shows no subtitle; a real caveat stays', async ({ page }) => {
    await open(page, `/#site=connecting-ridge-extension&period=${AUG}`)
    await expect(page.locator('.site-label')).toHaveCount(0)
    await expect(page.locator('header.top')).not.toContainText('dropped in')
    await open(page, DEMO)
    await expect(page.locator('.site-label')).toHaveText('Blue Moon MK1 target')
  })
})

test.describe('U8: the Full data switch in the site-details drawer', () => {
  for (const vp of [{ width: 1280, height: 720 }, { width: 375, height: 812 }]) {
    test(`summary by default; the switch, top right with its label, adds method, raw values and sources; the choice is global and kept (${vp.width} px)`, async ({ page }) => {
      await page.setViewportSize(vp)
      await open(page, `${DEMO}&drawer=details`)
      const drawer = page.getByTestId('drawer')
      const sw = drawer.getByTestId('full-data-switch')
      await expect(sw).toHaveAttribute('role', 'switch')
      await expect(sw).toHaveAttribute('aria-checked', 'false')
      await expect(sw).toContainText('Full data')
      await expect(sw).toBeInViewport()
      // top right: beside Close, in the drawer's head
      const s = (await sw.boundingBox())!
      const close = (await drawer.getByRole('button', { name: 'Close' }).boundingBox())!
      const d = (await drawer.boundingBox())!
      expect(s.x + s.width).toBeLessThanOrEqual(close.x)
      expect(s.y).toBeLessThan(d.y + 80)
      // summary: the decision values (station state), no method, raw elevations or sources
      await expect(drawer.locator('table.stations thead th')).toHaveText(['Station', 'State'])
      await expect(drawer).not.toContainText('not a guaranteed radio link')
      await expect(drawer).not.toContainText('Access not assessed')
      await expect(drawer.getByRole('heading', { name: 'How this is computed' })).toHaveCount(0)
      await expect(drawer.getByRole('heading', { name: 'Find better dates' })).toBeVisible()
      await page.screenshot({ path: `${SHOTS}/${vp.width}-drawer-summary.png` })
      // full data
      await sw.click()
      await expect(sw).toHaveAttribute('aria-checked', 'true')
      await expect(drawer.locator('table.stations thead th')).toHaveCount(4)
      await expect(drawer).toContainText('not a guaranteed radio link')
      await expect(drawer.getByRole('heading', { name: 'How this is computed' })).toBeAttached()
      await expect(drawer.getByTestId('views-note')).toBeAttached()
      // one global setting, kept across a reload
      await page.reload()
      await expect(page.getByTestId('drawer').getByTestId('full-data-switch')).toHaveAttribute('aria-checked', 'true')
      await page.getByTestId('drawer').getByTestId('full-data-switch').click()
      await expect(page.getByTestId('drawer').locator('table.stations thead th')).toHaveCount(2)
    })
  }

  test('the footer link "how this is computed" shows that section in summary mode too', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'how this is computed' }).click()
    const drawer = page.getByTestId('drawer')
    await expect(drawer.getByRole('heading', { name: 'How this is computed' })).toBeInViewport()
    await expect(drawer.getByTestId('full-data-switch')).toHaveAttribute('aria-checked', 'false')
  })
})

test('375 px: Calculate flight in the Mission menu and Back to landing site are in reach, no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await open(page)
  await page.getByTestId('mission').click()
  const calc = page.getByTestId('current-calculate-flight')
  await calc.scrollIntoViewIfNeeded()
  await expect(calc).toBeInViewport()
  await page.screenshot({ path: `${SHOTS}/375-mission-calculate-flight.png` })
  await calc.click()
  const back = page.getByTestId('back-to-site')
  await expect(back).toBeInViewport()
  expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44 - 0.01)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  await page.screenshot({ path: `${SHOTS}/375-flight-back-link.png` })
})
