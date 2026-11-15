// Feature review (15 Nov, evening): one test per defect found by using the app at 1280×720 and 375×812, and per
// polish item of the deferred list (F07b, F12, F16, F18, F19, F23). The table is app/test-results/feature-review/findings.md.
// Run: PW_GPU=1 PW_PORT=5216 npx playwright test e2e/feature-review.spec.ts
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { headerAction, openDrawerFolds } from './header'

const DEMO = '/#site=connecting-ridge&period=shackleton-2027-08'

async function open(page: Page, url = DEMO) {
  await page.goto(url)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
}

const hashOf = async (page: Page) => new URLSearchParams(await page.evaluate(() => location.hash.slice(1)))

test('F16: the page is not blank before the script runs: index.html carries the app background and a loading line', async ({ request }) => {
  const html = await (await request.get('/')).text()
  expect(html).toMatch(/<div id="root"><p class="boot" role="status" data-testid="boot-loading">Loading…<\/p><\/div>/)
  expect(html).toMatch(/html \{ color-scheme: dark; background: oklch\(11% 0\.006 260\); \}/)
})

test('F16: the loading line is replaced by the app', async ({ page }) => {
  await open(page)
  await expect(page.getByTestId('boot-loading')).toHaveCount(0)
})

test('a one-day mission reads as one date, and a Start that forces a shorter mission says so', async ({ page }) => {
  await open(page)
  await page.getByTestId('mission').click()
  const mp = page.getByTestId('mission-panel')
  await mp.locator('#mp-start').fill('31 Dec 2030')
  await mp.locator('#mp-start').press('Enter')
  await expect(page.getByTestId('date')).toHaveText('31 Dec 2030')
  await expect(mp.getByRole('alert')).toHaveText('Shortened to 1 day: supported dates end on 31 Dec 2030.')
  // A Start with room for the whole length clears the message.
  await mp.locator('#mp-start').fill('16 Aug 2027')
  await mp.locator('#mp-start').press('Enter')
  await expect(page.getByTestId('date')).toHaveText('16 Aug 2027')
  await expect(mp.getByRole('alert')).toHaveCount(0)
})

test('F19: the drawer header uses one date format for the period and the cursor', async ({ page }) => {
  await open(page, `${DEMO}&t=2027-08-20T06:00Z`)
  await (await headerAction(page, 'details')).click()
  await expect(page.getByTestId('drawer-when')).toHaveText('16–29 Aug 2027 · 20 Aug 2027, 06:00 UTC')
})

test('power estimate: a marked field says what it accepts (no commas, above 0, its upper limit)', async ({ page }) => {
  await open(page, `${DEMO}&drawer=details`)
  await openDrawerFolds(page)
  const panel = page.getByTestId('power-in-panelM2')
  const hint = page.getByTestId('power-hint-panelM2')
  await expect(hint).toHaveText('Sun-facing solar array; power grows in proportion.')
  await panel.fill('2,5')
  await expect(panel).toHaveAttribute('aria-invalid', 'true')
  await expect(hint).toHaveText('No commas: a point for decimals, for example 2.5.')
  await expect(hint).toHaveClass(/is-error/)
  for (const v of ['', '0', '-3', '5000']) {
    await panel.fill(v)
    await expect(hint).toHaveText('Enter a number above 0 and at most 1,000 m².')
  }
  await page.getByTestId('power-in-loadW').fill('2000000')
  await expect(page.getByTestId('power-hint-loadW')).toHaveText('Enter a number above 0 and at most 1,000,000 W.')
  await page.getByTestId('power-in-loadW').fill('100')
  await panel.fill('2.5')
  await expect(hint).toHaveText('Sun-facing solar array; power grows in proportion.')
  await expect(page.getByTestId('power-answer')).toBeVisible()
  await expect.poll(async () => (await hashOf(page)).get('panel')).toBe('2.5')
})

test('F23: the in-app documentation names no repository file in its SI (AI) use paragraph', async ({ page }) => {
  await open(page)
  await page.getByTestId('docs-open').click()
  const mark = page.getByTestId('docs-si-marking')
  await expect(mark).toContainText('SI (AI) use: this panel is a simplified version of the project')
  await expect(mark).not.toContainText('.md')
  await expect(mark).not.toContainText('docs/')
  await expect(mark.getByRole('link', { name: '/docs' })).toHaveAttribute('href', '/docs')
})

test('View menu: Moon works while the camera still flies down to the site', async ({ page }) => {
  type S = { flying(): boolean; setAnimated(on: boolean): void; advance(ms: number): void; level(): string; setView(o: object): Promise<unknown> }
  const sc = <T,>(fn: (s: S) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>
  await open(page, `/?test=1${DEMO.slice(1)}`)
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  // The camera on the whole Moon, then animated with a clock only the test moves (scene-motion.spec.ts does the
  // same): Landing site starts the fly down, which stays under way until the test advances it.
  await sc((s) => s.setView({ level: 'globe' }).then(() => s.setAnimated(true)))
  await page.getByTestId('view').click()
  await page.getByTestId('view-menu').getByRole('menuitem', { name: /Landing site/ }).click()
  await expect.poll(() => sc((s) => s.flying())).toBe(true)
  await page.getByTestId('view').click()
  await page.getByTestId('view-menu').getByRole('menuitem', { name: /Moon/ }).click()
  // The request waits for the fly down to end, then flies back out to the whole Moon.
  await expect
    .poll(() => sc((s) => (s.advance(100), s.level() === 'globe' && !s.flying())), { timeout: 30_000, intervals: [50] })
    .toBe(true)
  await expect(page.getByTestId('view')).toHaveText('View: Moon')
})

test('Add mission when the browser refuses storage says so', async ({ page }) => {
  await open(page)
  await page.evaluate(() => {
    const orig = Storage.prototype.setItem
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === 'llsn.missions.v1') throw new DOMException('full', 'QuotaExceededError')
      return orig.call(this, k, v)
    }
  })
  await page.getByTestId('mission').click()
  await page.getByTestId('add-mission').click()
  await expect(page.getByTestId('mission-save-note')).toHaveText(
    'Not saved: this browser does not allow storing it (storage blocked or full). Copy the link instead.',
  )
  await expect(page.getByTestId('saved-missions')).toHaveCount(0)
})

test('Copy link copies the state on screen at once, not the address bar written 400 ms later', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await open(page, `${DEMO}&drawer=details`)
  await openDrawerFolds(page)
  await page.getByTestId('power-in-panelM2').fill('7')
  await page.getByRole('button', { name: 'Copy link' }).click()
  await expect(page.getByText('Link copied.')).toBeVisible()
  const copied = new URL(await page.evaluate(() => navigator.clipboard.readText()))
  expect(new URLSearchParams(copied.hash.slice(1)).get('panel')).toBe('7')
})

test('F12: the dates menu keeps each limit and each share with its unit on one line, in the number font', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await open(page)
  await page.getByTestId('date').click()
  const defaults = page.getByTestId('best-defaults')
  await expect(defaults.locator('.mono.nowrap')).toHaveText(['≥ 70 %', '≥ 50 %', '≤ 48 h', '≤ 72 h'])
  for (const el of await defaults.locator('.mono.nowrap').all()) {
    const box = await el.boundingBox()
    expect(box!.height).toBeLessThan(24) // one line
  }
})

for (const vp of [
  { width: 1280, height: 720 },
  { width: 375, height: 812 },
]) {
  test.describe(`${vp.width} px`, () => {
    test.use({ viewport: vp })

    test('flight plan: "Other coordinates" shows the launch point fields right under the Launchpad menu', async ({ page }) => {
      await open(page)
      await (await headerAction(page, 'flight-open')).click()
      await expect(page.getByTestId('flight-panel')).toBeVisible({ timeout: 30_000 })
      await expect(page.getByTestId('flight-pad-lat')).toHaveCount(0)
      await page.getByTestId('flight-pad').selectOption('custom')
      await page.getByTestId('flight-pad-lat').scrollIntoViewIfNeeded()
      await expect(page.getByTestId('flight-pad-lat')).toBeVisible()
      await expect(page.getByTestId('flight-pick-pad')).toBeVisible()
      // The folded section no longer promises the launch point.
      await expect(page.getByText('More inputs: landing point, return, transfer')).toBeVisible()
      await expect(page.getByTestId('flight-panel').getByRole('heading', { level: 2 })).toHaveText('Flight plan')
    })

    test('F18: the drawer and search titles stay on one line', async ({ page }) => {
      await open(page)
      await (await headerAction(page, 'search-open')).click()
      const title = page.locator('#search-title')
      await expect(title).toHaveText('Find the best site')
      expect((await title.boundingBox())!.height).toBeLessThan(36)
      await page.keyboard.press('Escape')
      await (await headerAction(page, 'details')).click()
      expect((await page.locator('#drawer-title').boundingBox())!.height).toBeLessThan(36)
      await expect(page.getByTestId('drawer').getByTestId('full-data-switch')).toBeVisible()
    })
  })
}

test.describe('375 px flight bar', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('F07b: the flight playback bar is compact on a phone; camera, layers and speed open from a labelled More', async ({ page }) => {
    await open(page)
    await (await headerAction(page, 'flight-open')).click()
    const bar = page.getByTestId('flight-transport')
    await expect(bar).toBeVisible({ timeout: 90_000 })
    const more = page.getByTestId('flight-more')
    await expect(more).toBeVisible()
    await expect(more).toHaveAccessibleName('More: camera, layers and speed')
    await expect(more).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('flight-controls')).toBeHidden()
    expect((await bar.boundingBox())!.height).toBeLessThan(170) // 290 px before
    await expect(page.getByTestId('flight-play')).toBeVisible()
    await expect(page.getByTestId('flight-scrub')).toBeVisible()
    await more.click()
    await expect(more).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('flight-focus')).toBeVisible()
    await expect(page.getByTestId('flight-speed')).toBeVisible()
    await expect(page.getByTestId('layer-paths')).toBeVisible()
    await more.click()
    await expect(page.getByTestId('flight-controls')).toBeHidden()
  })
})

test('F07b: on a wide screen the camera, layer and speed row is always shown and there is no More button', async ({ page }) => {
  await open(page)
  await page.getByTestId('flight-open').click()
  await expect(page.getByTestId('flight-transport')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByTestId('flight-more')).toBeHidden()
  await expect(page.getByTestId('flight-focus')).toBeVisible()
  await expect(page.getByTestId('flight-speed')).toBeVisible()
})

test('the link follows the cursor while Play runs (at most every 400 ms), and holds the resting cursor once paused', async ({ page }) => {
  await open(page, `${DEMO}&t=2027-08-17T00:00Z`)
  const linkT = () => page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('t'))
  await page.getByTestId('simulate').click()
  await expect(page.getByTestId('simulate')).toHaveText('Pause')
  // Still playing: the link has moved on from the start (a debounce wrote nothing until Play stopped).
  await expect.poll(linkT, { timeout: 5000 }).not.toBe('2027-08-17T00:00Z')
  await expect(page.getByTestId('simulate')).toHaveText('Pause')
  const seen = new Set<string>()
  for (let i = 0; i < 6; i++) {
    seen.add((await linkT())!)
    await page.waitForTimeout(450)
  }
  expect(seen.size).toBeGreaterThan(2)
  await page.getByTestId('simulate').click()
  await expect(page.getByTestId('simulate')).toHaveText('Play')
  // Paused: the link is the cursor on screen at once.
  const shown = await page.getByTestId('cursor-time').textContent()
  const t = (await linkT())!
  const [d, hm] = [Number(t.slice(8, 10)), t.slice(11, 16)]
  expect(shown).toBe(`${d} August 2027, ${hm} UTC`)
})

test('F08: "days asked for" sits beside the surface stay field, on the same line', async ({ page }) => {
  await open(page)
  await page.getByTestId('flight-open').click()
  const stay = page.getByTestId('flight-stay')
  await stay.scrollIntoViewIfNeeded()
  const unit = page.locator('.flight-stay span', { hasText: 'days asked for' })
  const [a, b] = [(await stay.boundingBox())!, (await unit.boundingBox())!]
  expect(b.x).toBeGreaterThan(a.x + a.width - 1)
  expect(Math.abs(b.y + b.height / 2 - (a.y + a.height / 2))).toBeLessThan(8)
})

test('prefers-reduced-motion: no control animates its transition, the View and Play tools included', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page)
  for (const id of ['view', 'simulate', 'details']) {
    const d = await page.getByTestId(id).evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(d.split(',').every((x) => parseFloat(x) < 0.001)).toBe(true)
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  expect(parseFloat(await page.getByTestId('view').evaluate((el) => getComputedStyle(el).transitionDuration))).toBeGreaterThan(0.05)
})
