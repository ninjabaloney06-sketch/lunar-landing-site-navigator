// Documentation view (U5): the footer's "Docs" opens it, it has a contents list whose links scroll without touching
// the URL hash (the app keeps its state there), it carries the SI marking and the source links, and it closes with
// Close or Esc. Run: PW_PORT=5182 npx playwright test e2e/docs.spec.ts --workers=1
import { expect, test, type Page } from '@playwright/test'

const DEMO = '/#site=connecting-ridge&period=shackleton-2027-08'
const SECTIONS = ['What the tool answers', 'How to read each view', 'Where the data comes from', 'How the numbers are computed', 'Limits', 'How AI was used']

async function openApp(page: Page, url = DEMO) {
  await page.goto(url)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
}

const hash = (page: Page) => page.evaluate(() => location.hash)

for (const vp of [
  { width: 1440, height: 900, tag: '1440' },
  { width: 375, height: 812, tag: '375' },
]) {
  test(`Docs opens from the footer, has contents and source links, scrolls in place and closes, at ${vp.tag} px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await openApp(page)
    await page.getByTestId('docs-open').click()
    const docs = page.getByTestId('docs')
    await expect(docs).toBeVisible()
    await expect(docs.getByRole('heading', { level: 2, name: 'Documentation' })).toBeVisible()
    await expect(docs.getByRole('button', { name: 'Close' })).toBeFocused()
    await expect.poll(() => hash(page)).toContain('drawer=docs')

    // Contents: one link per section, in order.
    const toc = docs.getByTestId('docs-toc')
    await expect(toc.getByRole('link')).toHaveText(SECTIONS)
    for (const name of SECTIONS) await expect(docs.getByRole('heading', { level: 3, name })).toHaveCount(1)
    // The SI marking of the original, and the line that this is a simplified version.
    await expect(docs.getByTestId('docs-si-marking')).toContainText('SI')
    await expect(docs).toContainText('simplified')
    // Source links open outside the app.
    const ext = docs.locator('a[href^="http"]')
    expect(await ext.count()).toBeGreaterThan(10)
    await expect(ext.first()).toHaveAttribute('target', '_blank')
    await expect(ext.first()).toHaveAttribute('rel', 'noreferrer')
    await expect(docs.locator('a[href*="naif.jpl.nasa.gov"]').first()).toBeAttached()

    // A contents link scrolls to its section and leaves the app state in the hash alone.
    const before = await hash(page)
    await toc.getByRole('link', { name: 'Limits' }).click()
    await expect(docs.getByRole('heading', { level: 3, name: 'Limits' })).toBeInViewport()
    expect(await hash(page)).toBe(before)
    await expect(page.getByTestId('site-name')).toHaveText('Connecting Ridge')

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await toc.getByRole('link', { name: 'Where the data comes from' }).click()
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `test-results/docs-${vp.tag}.png`, animations: 'disabled' })

    await docs.getByRole('button', { name: 'Close' }).click()
    await expect(docs).toHaveCount(0)
    await expect.poll(() => hash(page)).not.toContain('drawer=docs')
  })
}

test('a link with drawer=docs opens the documentation; Esc closes it and the scene stays at site level', async ({ page }) => {
  await openApp(page, `${DEMO}&drawer=docs`)
  const docs = page.getByTestId('docs')
  await expect(docs).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(docs).toHaveCount(0)
  await page.waitForTimeout(700)
  expect(await hash(page)).not.toContain('view=globe')
})
