// "Open in NASA tools" in the Details drawer (add-on Task 3): for a listed site and a custom site the three tools'
// links are there, open in a new tab with rel="noopener", carry the site's coordinates and the mission dates, and the
// claim line links to the validation record. The links themselves were opened in the tools and recorded in
// docs/event/validation.md ("NASA-tools link check"); the URL formats are unit-tested in src/views/nasaTools.test.ts.
// Run: PW_GPU=1 PW_PORT=5193 npx playwright test e2e/nasa-tools.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { openDrawerFolds } from './header'

async function openDrawer(page: Page, hash: string) {
  await page.goto(`/?test=1#${hash}&drawer=details`)
  await openDrawerFolds(page) // the sections are folded to one line each
  const sec = page.getByTestId('nasa-tools')
  await expect(sec).toBeVisible({ timeout: 90_000 })
  await sec.scrollIntoViewIfNeeded()
  return sec
}

async function expectNewTab(page: Page, testId: string) {
  const a = page.getByTestId(testId)
  await expect(a).toHaveAttribute('target', '_blank')
  await expect(a).toHaveAttribute('rel', /\bnoopener\b/)
  return (await a.getAttribute('href'))!
}

test('listed site: Connecting Ridge opens in the three tools at its coordinates and dates', async ({ page }) => {
  const sec = await openDrawer(page, 'site=connecting-ridge&period=now')
  await expect(page.getByRole('heading', { name: 'Open in NASA tools' })).toBeVisible()
  expect(await expectNewTab(page, 'nt-moontrek')).toBe(
    'https://trek.nasa.gov/moon/#v=0.1&x=-11234.2&y=-11913.2&z=8&p=urn%3Aogc%3Adef%3Acrs%3AIAU2000%3A%3A30120&d=&locale=&b=moon&e=&sfz=&w=',
  )
  expect(await expectNewTab(page, 'nt-quickmap')).toBe('https://quickmap.lroc.im-ldi.com/?prjExtent=-31234.2%2C-31913.2%2C8765.8%2C8086.8&proj=27')
  const sun = await expectNewTab(page, 'nt-horizons-sun')
  expect(sun).toContain('COMMAND=%2710%27')
  expect(sun).toContain('SITE_COORD=%27223.32%2C-89.46%2C1.94635%27&START_TIME=%272026-11-14%2000%3A00%27&STOP_TIME=%272026-11-29%2000%3A00%27')
  expect(await expectNewTab(page, 'nt-horizons-earth')).toContain('COMMAND=%27399%27')
  await expect(sec).toContainText('south polar view, centred on 89.46° S · 136.68° W')
  // our first value, to read against the table's first row (V1-a: 263.2832°, 1.4935° at 14 Nov 2026 00:00 UTC)
  const ours = page.getByTestId('nt-our-sun')
  await expect(ours).toHaveText('263.28°', { timeout: 60_000 })
  expect(Math.abs(Number(await ours.getAttribute('data-el')) - 1.4935)).toBeLessThan(0.0001)
  // the claim line says only what validation.md records and links to the record
  const claim = page.getByTestId('nt-claim')
  await expect(claim).toContainText('Computed results stated as validated by the science lead; 15 Nov 2026, no per-check sign-off')
  await expect(claim).not.toContainText(/\b(verified|certified)\b/i)
  const record = claim.getByRole('link', { name: 'see record' })
  await expect(record).toHaveAttribute('href', '/docs#validation-results')
  await expect(record).toHaveAttribute('rel', /\bnoopener\b/)
  await page.screenshot({ path: 'test-results/nasa-tools-listed.png' })
})

test('custom site: the links are its coordinates; the Horizons height follows the computed terrain', async ({ page }) => {
  await openDrawer(page, 'site=cap:-87.50000,60.00000&period=now')
  expect(await expectNewTab(page, 'nt-quickmap')).toBe('https://quickmap.lroc.im-ldi.com/?prjExtent=45662.4%2C17910.2%2C85662.4%2C57910.2&proj=27')
  expect(await expectNewTab(page, 'nt-moontrek')).toContain('&x=65662.4&y=37910.2&z=8&')
  // once capHorizon has run, the table's point sits at the terrain height + 1.75 m (-423.7 m + 1.75 m on 15 Nov 2026)
  await expect(page.getByTestId('nt-horizons-sun')).toHaveAttribute('href', /SITE_COORD=%2760%2C-87\.5%2C-0\.42195%27/, { timeout: 90_000 })
  await expect(page.getByTestId('nt-our-sun')).toHaveAttribute('data-az', /^66\.69/)
  await page.screenshot({ path: 'test-results/nasa-tools-custom.png' })
})
