// U17 for the Rocket flight menu and its bottom bar: no research-note internals in either mode, every
// abbreviation shown has a hover expansion, the explanations are at most four bullets of twelve words or fewer in
// summary mode, every input has a hint, and 375 px has no horizontal scroll. Apollo, because its plan takes
// about two seconds. Screenshots go to SHOTS_DIR when it is set.
// Run: PW_GPU=1 PW_PORT=5183 npx playwright test e2e/flight-read.spec.ts
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const URL = '/#view=flight&site=haworth&rocket=apollo&name=Haworth+flight'
const SHOTS = process.env.SHOTS_DIR
const INTERNALS = ['Access not assessed', 'ESTABLISHED', 'not retrieved', '.json', 'NaN', 'undefined', 'energy multiplier', 'Energy multiplier']

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

async function ready(page: Page) {
  const panel = page.getByTestId('flight-panel')
  await expect(panel.getByTestId('flight-payload')).toHaveAttribute('data-state', 'ready', { timeout: 90_000 })
  return panel
}

/** Visible text of the menu and the bar. */
async function menuText(page: Page): Promise<string> {
  return page.evaluate(() =>
    ['.flight-panel', '.flight-transport'].map((s) => (document.querySelector(s) as HTMLElement | null)?.innerText ?? '').join('\n'),
  )
}

/** Abbreviations in the visible text of the menu and the bar that never appear inside an <abbr title>. */
async function unexplained(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const roots = ['.flight-panel', '.flight-transport'].map((s) => document.querySelector(s)).filter((x): x is Element => !!x)
    const TOKEN = /Δv|v∞|1σ|3σ|Isp|T\+|(?<![A-Za-z0-9-])[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*(?![A-Za-z0-9])/g
    const isAbbr = (t: string) => t.length > 1 && !/^[IVX]+$/.test(t) && (/[^A-Za-z]/.test(t) || t === t.toUpperCase()) // Artemis IV is a name
    const explained = new Set<string>()
    const seen = new Set<string>()
    for (const root of roots) {
      for (const a of root.querySelectorAll('abbr[title]')) if (a.getAttribute('title')) explained.add((a.textContent ?? '').trim())
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const el = n.parentElement
        if (!el || el.closest('abbr, select, option, a, .flight-sources')) continue
        if (el.getClientRects().length === 0) continue
        for (const m of (n.textContent ?? '').matchAll(TOKEN)) if (isAbbr(m[0])) seen.add(m[0])
      }
    }
    // a term is explained once it is marked anywhere in the menu or the bar ("expands on hover once")
    return [...seen].filter((t) => ![...explained].some((e) => e === t || e.split(/\s+/).includes(t)))
  })
}

test('summary mode: the answer first, no internals, every abbreviation explained, inputs with hints', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(URL)
  const panel = await ready(page)

  // the answer: payload with its marker, propellant status, the three times, the Δv in m/s
  await expect(panel.getByTestId('flight-payload')).toContainText('Validated by the science lead (statement of 15 Nov 2026; see record).')
  await expect(panel.getByTestId('flight-glance-propellant')).toContainText(/^Propellant: /)
  await expect(panel.getByTestId('flight-glance-times')).toContainText('Launch')
  await expect(panel.getByTestId('flight-glance-times')).toContainText('Landing')
  await expect(panel.getByTestId('flight-glance-times')).toContainText('Return (EI)')
  await expect(panel.getByTestId('flight-glance-dv')).toContainText(/Δv after launch [\d,]+ m\/s/)

  // every input has a one-line hint under it
  for (const id of ['flight-pad', 'flight-stay']) {
    const hint = panel.locator('.mp-field', { has: page.getByTestId(id) }).locator('.flight-hint')
    await expect(hint.first()).toBeVisible()
  }
  await expect(panel.getByTestId('flight-save-hint')).toContainText(/Keeps|Saved|full/)

  // the dispersion: shorter in summary mode, but both warnings stay beside the numbers
  await panel.getByTestId('flight-dispersion-start').click()
  await expect(panel.getByTestId('flight-dispersion')).toHaveAttribute('data-state', 'ready', { timeout: 120_000 })
  await expect(panel.getByTestId('flight-dispersion-sentence')).toContainText('unguided runs')
  await expect(panel.getByTestId('flight-dispersion-sentence')).toContainText('Validated by the science lead (statement of 15 Nov 2026; see record).')
  await expect(panel.getByTestId('flight-dispersion-meaning')).toHaveText('Unguided descent: a guided lander lands much closer. Every error size is an assumption.')

  // the explanations: at most four bullets of at most twelve words each
  for (const id of ['halo', 'landing', 'stay']) {
    await panel.locator(`[data-section="${id}"]`).evaluate((el) => ((el as HTMLDetailsElement).open = true))
    const items = panel.locator(`[data-section="${id}"] [data-testid="flight-brief"] .flight-bullets > li`)
    const texts = await items.allInnerTexts()
    expect(texts.length, id).toBeGreaterThan(0)
    expect(texts.length, id).toBeLessThanOrEqual(4)
    for (const t of texts) expect(t.trim().split(/\s+/).length, t).toBeLessThanOrEqual(12)
  }
  await panel.locator('[data-section="how"] > summary').click()
  await expect(panel.locator('[data-section="how"]')).toContainText('validated by the science lead (statement of 15 Nov 2026; see record)')

  const text = await menuText(page)
  for (const bad of INTERNALS) expect(text, bad).not.toContain(bad)
  expect(text).not.toMatch(/km\/s/) // Δv is in m/s; no speed in km/s is shown in summary mode
  expect(await unexplained(page)).toEqual([])
  await page.locator('[data-section="halo"] > summary').scrollIntoViewIfNeeded()
  await panel.evaluate((el) => (el.scrollTop = 0))
  await shot(page, 'flight-read-1280-summary')
})

test('full data mode: breakdown, limit, uncertainty and full texts; still no internals, abbreviations explained', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(URL)
  const panel = await ready(page)
  await panel.getByTestId('full-data-switch').click()
  await expect(panel.locator('[data-section="payload"]')).toHaveAttribute('open', '')
  await expect(panel.getByTestId('flight-payload-details')).toContainText('Limited by the')
  await expect(panel.getByTestId('flight-payload-details')).toContainText('Largest uncertainty')
  await expect(panel.locator('[data-section="events"]')).toHaveAttribute('open', '')
  await expect(panel.getByTestId('flight-dv-total')).toContainText(/[\d,]+ m\/s/)
  await panel.locator('[data-section="halo"] > summary').click()
  await expect(panel.locator('[data-section="halo"]')).toContainText('What it buys')
  await panel.locator('[data-section="how"] > summary').click()
  await expect(panel.locator('[data-section="how"]')).toContainText('Landing dispersion: 200 descents')
  const text = await menuText(page)
  for (const bad of INTERNALS) expect(text, bad).not.toContain(bad)
  expect(await unexplained(page)).toEqual([])
  await panel.evaluate((el) => (el.scrollTop = 0))
  await shot(page, 'flight-read-1280-full')
  await panel.getByTestId('full-data-switch').click()
})

test('375 px: no horizontal scroll in either mode, the menu leaves the trajectory visible', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(URL)
  const panel = await ready(page)
  for (const mode of ['summary', 'full']) {
    if (mode === 'full') await panel.getByTestId('full-data-switch').click()
    const box = await panel.boundingBox()
    expect(box!.height).toBeLessThan(812 * 0.55)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    // nothing sticks out past the right edge once the layout has settled (the tables open with the switch)
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            [...document.querySelectorAll('.flight-panel *, .flight-transport *')]
              .filter((el) => {
                const r = el.getBoundingClientRect()
                return r.width > 0 && r.right > 376
              })
              .map((el) => `${el.tagName}.${(el as HTMLElement).className} ${Math.round(el.getBoundingClientRect().right)}`),
          ),
        { timeout: 5_000, message: mode },
      )
      .toEqual([])
    await shot(page, `flight-read-375-${mode}`)
  }
  await panel.getByTestId('full-data-switch').click()
})
