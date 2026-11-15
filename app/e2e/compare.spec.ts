// Comparing saved missions (U13 + the team's add-on "Calculate flight on the missions table", item 1): the All sites
// table is the compare view. Each saved mission is a row with what a planner compares at a glance (name, site,
// dates, launchpad, rocket, stay) and a "Calculate flight" button that opens the Rocket flight menu with exactly
// that mission's values. Also the table's row actions and touch sizes (U4 table part, defect 28).
// Run: PW_GPU=1 PW_PORT=5189 npx playwright test e2e/compare.spec.ts
import { expect, test, type Page } from '@playwright/test'

const A = { site: 'haworth', siteName: 'Haworth', period: 'shackleton-2027-08', dates: '16–29 Aug 2027', pad: 'kourou-ela4', padName: 'ELA-4', rocket: 'apollo', design: 'apollo', lander: null, rocketName: 'Apollo', stay: '2', name: 'Haworth A' }
const B = { site: 'malapert-massif', siteName: 'Malapert Massif', period: 'shackleton-2027-09', dates: '12–26 Sep 2027', pad: 'ksc-39b', padName: 'LC-39B', rocket: 'artemis-blue-moon', design: 'sls', lander: 'artemis-blue-moon', rocketName: 'SLS + Blue Moon Mark 2', stay: '5', name: 'Massif B' }
type M = typeof A | typeof B

/** Saves a mission the way a user does: its values in the flight menu, then "Save mission". */
async function save(page: Page, m: M) {
  const q = new URLSearchParams({ view: 'flight', site: m.site, period: m.period, pad: m.pad, rocket: m.rocket, stay: m.stay, name: m.name })
  await page.goto(`/#${q}`)
  const panel = page.getByTestId('flight-panel')
  await expect(panel.getByTestId('flight-mission')).toContainText(m.siteName)
  await panel.getByTestId('flight-save-mission').click()
  await expect(panel.getByTestId('flight-save-mission')).toBeDisabled()
}

async function openTable(page: Page) {
  await page.goto('about:blank')
  await page.goto('/#site=connecting-ridge&period=shackleton-2027-08&drawer=compare') // the Compare tab of the Details drawer
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  const table = page.getByTestId('site-table')
  await table.scrollIntoViewIfNeeded()
  return table
}

test.describe('saved missions in the All sites table at 1280 × 720', () => {
  test('two saved missions: each row shows name, site, dates, launchpad, rocket and stay; "Calculate flight" opens the flight menu with exactly those', async ({ page }) => {
    test.setTimeout(240_000)
    await save(page, A)
    await save(page, B)
    const table = await openTable(page)
    const rows = table.getByTestId('mission-rows').locator('tr[data-mission]')
    await expect(rows).toHaveCount(2)

    for (const [i, m] of [A, B].entries()) {
      const row = rows.nth(i)
      // What "Calculate flight" will open with, readable on the row.
      await expect(row).toContainText(m.name)
      await expect(row).toContainText(`${m.siteName} · ${m.dates}`)
      await expect(row.getByTestId('mission-flight')).toHaveText(`Stay ${m.stay} days · Launchpad ${m.padName} · Rocket ${m.rocketName}`)
      await expect(row.getByRole('button', { name: 'Calculate flight' })).toBeVisible()
    }

    for (const [i, m] of [A, B].entries()) {
      const row = (await openTable(page)).getByTestId('mission-rows').locator('tr[data-mission]').nth(i)
      await row.getByRole('button', { name: 'Calculate flight' }).click()
      await expect(page).toHaveURL(/view=flight/)
      const hash = new URLSearchParams(new URL(page.url()).hash.slice(1))
      expect(Object.fromEntries(['site', 'period', 'pad', 'rocket', 'stay', 'name'].map((k) => [k, hash.get(k)]))).toEqual({
        site: m.site, period: m.period, pad: m.pad, rocket: m.rocket, stay: m.stay, name: m.name,
      })
      // The transfer cap is being added to the saved mission by agent shell (add-on item 1); not asserted here.
      const panel = page.getByTestId('flight-panel')
      await expect(panel.getByTestId('flight-mission')).toContainText(m.name)
      await expect(panel.getByTestId('flight-mission')).toContainText(m.siteName)
      await expect(panel.getByTestId(`flight-design-${m.design}`)).toBeChecked()
      if (m.lander) await expect(panel.getByTestId(`flight-lander-${m.lander}`)).toHaveAttribute('aria-checked', 'true')
      await expect(panel.getByTestId('flight-pad')).toHaveValue(m.pad)
      await expect(panel.getByTestId('flight-stay')).toHaveValue(m.stay)
    }
  })

  test('"Find better dates" is on every row except the current site\'s; "Find better location" has a line of its own', async ({ page }) => {
    const table = await openTable(page)
    const current = table.locator('tr[data-site-id="connecting-ridge"]')
    await expect(current).toHaveClass(/is-current/)
    await expect(current.getByRole('button', { name: 'Find better dates' })).toHaveCount(0)
    const others = table.getByTestId('site-rows').locator('tr:not(.is-current)')
    const n = await others.count()
    expect(n).toBeGreaterThan(10)
    await expect(table.getByTestId('site-rows').getByRole('button', { name: 'Find better dates' })).toHaveCount(n)
    // Defect 28: the button sits below the radio rows, left-aligned with them, not between them.
    const btn = (await table.getByRole('button', { name: 'Find better location' }).boundingBox())!
    const picks = await table.locator('.st-pick').evaluateAll((fs) => fs.map((f) => f.getBoundingClientRect().toJSON() as DOMRect))
    for (const f of picks) expect(btn.y).toBeGreaterThanOrEqual(f.bottom - 1)
    expect(Math.abs(btn.x - picks[0].left)).toBeLessThan(2)
  })
})

test.describe('Full data in the All sites table at 1280 × 720', () => {
  test('summary shows the chosen columns only; Full data (top-right switch) adds the other values, slope, source and the method', async ({ page }) => {
    await save(page, A)
    const table = await openTable(page)
    await expect(table.getByText('…', { exact: true })).toHaveCount(0, { timeout: 60_000 })
    // The table sits in the Details drawer; the drawer's one Full data switch (top right) governs it. The table has
    // no second switch of its own.
    const sw = page.getByTestId('drawer').getByTestId('full-data-switch')
    await expect(sw).toHaveCount(1)
    await expect(sw).toHaveText('Full data')
    await expect(table.getByTestId('full-data-switch')).toHaveCount(0)
    await expect(table.getByTestId('st-full')).toHaveCount(0)
    await expect(table.getByTestId('st-method')).toHaveCount(0)

    await sw.click()
    const ridge = table.locator('tr[data-site-id="connecting-ridge"]')
    await expect(ridge.getByTestId('st-full')).toContainText(/Longest darkness (\d+\.\d h|\d+ days?( \d+ h)?)/)
    await expect(ridge.getByTestId('st-full')).toContainText(/Earth in view \d+\.\d %/)
    await expect(ridge.getByTestId('st-full')).toContainText(/Slope \d+\.\d°/)
    await expect(ridge.getByTestId('st-full').getByRole('link')).toHaveCount(1)
    await expect(ridge.getByTestId('st-full')).not.toContainText('Sunlit') // already a column
    await expect(table.getByTestId('mission-rows').getByTestId('st-full')).toContainText(/Longest contact gap (\d+\.\d h|\d+ days?( \d+ h)?)/, { timeout: 30_000 })
    await expect(table.getByTestId('st-method')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('NaN')
    await sw.click()
    await expect(table.getByTestId('st-full')).toHaveCount(0)
  })
})

test.describe('touch sizes at 375 × 812', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('"Calculate flight" is at least 44 px tall and the Graph checkboxes at least 24 px', async ({ page }) => {
    await save(page, A)
    const table = await openTable(page)
    const flight = table.getByTestId('mission-rows').getByRole('button', { name: 'Calculate flight' })
    await flight.scrollIntoViewIfNeeded()
    await expect(flight).toBeVisible()
    expect((await flight.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    const box = (await table.getByRole('checkbox', { name: /Sunlight graph for/ }).first().boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(24)
    expect(box.height).toBeGreaterThanOrEqual(24)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

// U13 "reachable in one click": a "Compare" link beside "Saved missions" in the Mission panel opens the details
// drawer at the table. Needs the diffs for state.ts, Drawer.tsx, MissionPanel.tsx and App.tsx in the tables report
// ("Compare saved missions in one click"); until they are applied this test cannot pass.
test('"Compare" in the Mission panel opens the table of saved missions in one click', async ({ page }) => {
  await save(page, A)
  await page.goto('about:blank')
  await page.goto('/#site=connecting-ridge&period=shackleton-2027-08')
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await page.getByTestId('mission').click()
  await page.getByTestId('mission-panel').getByTestId('compare-missions').click()
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('drawer=missions')
  await expect(page.getByTestId('site-table').getByTestId('mission-rows')).toBeInViewport()
})
