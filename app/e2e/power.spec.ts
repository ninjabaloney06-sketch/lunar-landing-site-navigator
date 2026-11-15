// P1 power estimate section of the details drawer: an input change changes the output, the inputs survive a reload
// through the link, nonsense inputs never show NaN, the CSV export carries the power rows, and a custom site shows
// the estimate marked approximate or "Not computed for this place". Run: PW_GPU=1 PW_PORT=5192 npx playwright test e2e/power.spec.ts
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const DEMO = 'site=connecting-ridge&period=shackleton-2027-08'
const CUSTOM = 'site=cap:-89.47000,-136.78000&period=shackleton-2027-08' // 1 km from Connecting Ridge (custom-site.spec)

async function openDrawer(page: Page, hash: string) {
  await page.goto(`/?test=1#${hash}&drawer=details`)
  const sec = page.getByTestId('power-section')
  await sec.scrollIntoViewIfNeeded()
  return sec
}

const watts = async (page: Page) => Number((await page.getByTestId('power-mean').innerText()).replace(/[^\d.]/g, ''))
const hashOf = async (page: Page) => new URLSearchParams(await page.evaluate(() => location.hash.slice(1)))

test('an input change changes the output; the inputs survive a reload through the link', async ({ page }) => {
  const sec = await openDrawer(page, DEMO)
  await expect(sec.getByTestId('power-answer')).toHaveText(/^The battery (survives|does not survive)/, { timeout: 60_000 })
  await expect(sec.getByTestId('power-example')).toHaveText('Example values, change them: panel area, cell efficiency, constant load, battery capacity.')
  await expect(sec).toContainText('First estimate, not a power budget. Not validated by the science lead.')
  await expect(sec).toContainText('Not modelled: temperature, panel degradation, dust, tilt, partial-panel shading.')
  const w1 = await watts(page)
  expect(w1).toBeGreaterThan(0)

  // Doubling the panel area doubles the mean power (P is linear in A).
  await sec.getByLabel('Panel area').fill('2')
  await expect.poll(() => watts(page)).not.toBe(w1)
  expect((await watts(page)) / w1).toBeCloseTo(2, 2)

  // A huge battery survives; a tiny one does not.
  await sec.getByLabel('Battery').fill('1000000')
  await expect(sec.getByTestId('power-answer')).toHaveText(/^The battery survives/)
  await sec.getByLabel('Battery').fill('1')
  const answer = await sec.getByTestId('power-answer').innerText()
  expect(answer).toMatch(/^The battery (does not survive|survives: there is no dark window)/)

  await expect.poll(async () => (await hashOf(page)).get('batt')).toBe('1')
  expect((await hashOf(page)).get('panel')).toBe('2')
  await page.reload()
  const again = page.getByTestId('power-section')
  await again.scrollIntoViewIfNeeded()
  await expect(again.getByLabel('Panel area')).toHaveValue('2')
  await expect(again.getByLabel('Battery')).toHaveValue('1')
  await expect(again.getByTestId('power-answer')).toHaveText(answer, { timeout: 60_000 })
  await expect(again.getByTestId('power-example')).toHaveText('Example values, change them: cell efficiency, constant load.')
})

test('nonsense inputs (empty, zero, negative, text) never show NaN and keep the last valid value in the link', async ({ page }) => {
  const sec = await openDrawer(page, `${DEMO}&load=40`)
  await expect(sec.getByTestId('power-answer')).toBeVisible({ timeout: 60_000 })
  const load = sec.getByLabel('Constant load')
  await expect(load).toHaveValue('40')
  for (const v of ['', '0', '-5', 'abc']) {
    await load.fill(v)
    await expect(load).toHaveAttribute('aria-invalid', 'true')
    await expect(sec.getByTestId('power-answer')).toHaveCount(0)
    await expect(sec).not.toContainText('NaN')
  }
  expect((await hashOf(page)).get('load')).toBe('40')
  await load.fill('60')
  await expect(load).not.toHaveAttribute('aria-invalid')
  await expect(sec.getByTestId('power-answer')).toBeVisible()
  await expect.poll(async () => (await hashOf(page)).get('load')).toBe('60')
})

test('a junk link falls back to the example values', async ({ page }) => {
  const sec = await openDrawer(page, `${DEMO}&panel=-1&eff=500&load=NaN&batt=`)
  await expect(sec.getByTestId('power-answer')).toBeVisible({ timeout: 60_000 })
  await expect(sec.getByTestId('power-example')).toHaveText('Example values, change them: panel area, cell efficiency, constant load, battery capacity.')
  await expect(sec).not.toContainText('NaN')
})

test('the CSV export carries the power rows', async ({ page }) => {
  const sec = await openDrawer(page, `${DEMO}&panel=2`)
  await expect(sec.getByTestId('power-answer')).toBeVisible({ timeout: 60_000 })
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()])
  const text = await readFile((await dl.path())!, 'utf8')
  expect(text).toContain('power_status,first estimate; not a power budget; not validated by the science lead')
  expect(text).toContain('power_panel_area_m2,2\n')
  expect(text).toContain('power_cell_efficiency_pct,30\n')
  expect(text).toMatch(/power_mean_w,\d+\.\d{2}\n/)
  expect(text).toMatch(/power_energy_kwh,\d+\.\d{3}\n/)
  expect(text).toMatch(/power_balance_kwh,-?\d+\.\d{3}\n/)
  expect(text).toMatch(/power_longest_dark_need_wh,\d+\.\d\n/)
  expect(text).toMatch(/power_battery_margin_wh,-?\d+\.\d\n/)
  expect(text).toMatch(/power_survives_longest_dark,(yes|no)\n/)
  // The CSV's mean power is the one on screen.
  const csvW = Number(/power_mean_w,([\d.]+)/.exec(text)![1])
  expect(Math.abs(csvW - (await watts(page)))).toBeLessThan(0.051)
})

test('a custom site: the estimate is marked approximate; without data, "Not computed for this place"', async ({ page }) => {
  const sec = await openDrawer(page, CUSTOM)
  await expect(sec.getByTestId('power-answer')).toBeVisible({ timeout: 90_000 })
  await expect(sec.getByTestId('power-approx')).toHaveText(/^Approximate: from .* terrain, not validated\.$/)

  // No ephemeris for the dates: no series, so nothing is estimated.
  await page.route('**/data/ephem/**', (route) => route.fulfill({ status: 404, body: '' }))
  const none = await openDrawer(page, 'site=cap:-89.40000,-136.70000&period=custom&from=2029-03-01T00:00Z&days=3')
  await expect(none.getByTestId('power-none')).toHaveText('Not computed for this place.', { timeout: 60_000 })
  await expect(none.getByTestId('power-answer')).toHaveCount(0)
  await expect(none).not.toContainText('NaN')
})
