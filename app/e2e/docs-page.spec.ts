// The /docs page (D1): a full page rendered from docs/*.md at build time. A direct load shows the documentation
// title and the contents; a contents link scrolls to its heading; nothing scrolls sideways at 375 px; links to
// repository files that are not on the page are plain text; the app at / and at an unknown path is unaffected.
// Run: PW_GPU=1 PW_PORT=5186 npx playwright test e2e/docs-page.spec.ts
import { expect, test, type Page } from '@playwright/test'

const TITLE = 'Lunar Landing Site Navigator — documentation'

async function openDocs(page: Page, url = '/docs') {
  await page.goto(url)
  await expect(page.getByTestId('docpage')).toBeVisible({ timeout: 30_000 })
}

// Smooth scrolling: wait until the page stops moving before measuring or taking a picture.
async function settleScroll(page: Page) {
  let last = -1
  await expect
    .poll(async () => {
      const y = await page.evaluate(() => window.scrollY)
      const still = y === last
      last = y
      return still
    }, { intervals: [150] })
    .toBe(true)
}

const overflowX = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

for (const vp of [
  { width: 1280, height: 800, tag: '1280', phone: false },
  { width: 375, height: 812, tag: '375', phone: true },
]) {
  test(`/docs loads directly with its title and contents; a contents link scrolls to its heading, at ${vp.tag} px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await openDocs(page)
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible()
    await expect(page).toHaveTitle(/Documentation/)
    // The app is not mounted on this page.
    await expect(page.getByTestId('answer')).toHaveCount(0)

    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `test-results/docs-page-${vp.tag}-top.png`, animations: 'disabled' })

    const toc = page.getByTestId('docpage-toc')
    const toggle = page.getByRole('button', { name: 'Contents' })
    if (vp.phone) {
      // Collapsed on phones until asked for.
      await expect(toc).toBeHidden()
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    } else {
      await expect(toggle).toBeHidden()
    }
    await expect(toc).toBeVisible()
    await expect(toc.getByRole('link', { name: 'Part 1 — technical' })).toBeVisible()
    await expect(toc.getByRole('link', { name: 'Part 2 — product' })).toBeVisible()
    if (vp.phone) await page.screenshot({ path: `test-results/docs-page-${vp.tag}-contents.png`, animations: 'disabled' })

    await toc.getByRole('link', { name: 'Limits', exact: true }).click()
    const limits = page.getByRole('heading', { level: 3, name: 'Limits', exact: true })
    await expect(limits).toBeInViewport()
    await settleScroll(page)
    expect(await page.evaluate(() => location.hash)).toBe('#limits')
    // The heading is not hidden under the sticky top bar.
    const top = await limits.evaluate((el) => el.getBoundingClientRect().top)
    expect(top).toBeGreaterThanOrEqual(56)
    if (vp.phone) await expect(toc).toBeHidden() // a chosen link closes the list

    expect(await overflowX(page)).toBeLessThanOrEqual(0)
    if (vp.phone) {
      // Wide tables scroll inside themselves instead.
      const wide = await page.locator('.md-table').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth).length)
      expect(wide).toBeGreaterThan(0)
    }
    await page.screenshot({ path: `test-results/docs-page-${vp.tag}.png`, animations: 'disabled' })
  })
}

test('/docs: in-page links work, repository files not on the page are plain text, sources open outside', async ({ page }) => {
  await openDocs(page)
  const main = page.locator('.docpage-main')
  // "[Validation results](#validation-results)" stays an in-page link.
  await expect(main.locator('a[href="#validation-results"]').first()).toBeAttached()
  // Links to repository files (README, validation.md, spec.md, BUILD_LOG.md) are text, not dead links.
  for (const f of ['README.md', 'validation.md', 'spec.md', 'BUILD_LOG.md', 'data-sources.md']) await expect(main.locator(`a[href*="${f}"]`)).toHaveCount(0)
  await expect(main).toContainText('docs/reference/data-sources.md')
  const ext = main.locator('a[href^="http"]')
  expect(await ext.count()).toBeGreaterThan(3)
  await expect(ext.first()).toHaveAttribute('target', '_blank')
  await expect(ext.first()).toHaveAttribute('rel', 'noreferrer')
  // A direct load with a fragment lands on that heading.
  await page.setViewportSize({ width: 375, height: 812 })
  await openDocs(page, '/docs#frames-and-units')
  await expect(page.getByRole('heading', { level: 3, name: 'Frames and units' })).toBeInViewport()
  await settleScroll(page)
  expect(await overflowX(page)).toBeLessThanOrEqual(0)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: 'test-results/docs-page-375-table.png', animations: 'disabled' })
})

test('the app at / is unaffected by the /docs route, and an unknown path still loads the app', async ({ page }) => {
  for (const url of ['/#site=connecting-ridge&period=shackleton-2027-08', '/no-such-page#site=connecting-ridge&period=shackleton-2027-08']) {
    await page.goto(url)
    await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
    await expect(page.getByTestId('site-name')).toHaveText('Connecting Ridge')
    await expect(page.getByTestId('docpage')).toHaveCount(0)
  }
})
