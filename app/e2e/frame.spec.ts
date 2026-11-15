// Wave 3, agent read-header (15 Nov): the main screen's frame (header, site line, footer, View / Simulate) and the
// phone layout as a whole. U17 checks for this screen: the scene keeps at least half the height on a phone, every
// control at least 44 px tall there, no internals in the rendered text, abbreviations expanded, no sideways scroll.
// Run: PW_GPU=1 PW_PORT=5187 npx playwright test e2e/frame.spec.ts
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const RIDGE = 'connecting-ridge'
const AUG = 'shackleton-2027-08'
const DEMO = `/#site=${RIDGE}&period=${AUG}`
// Screenshots for the run's report (outside the repo; the folder is created by Playwright).
const SHOTS = process.env.FRAME_SHOTS ?? 'test-results/frame'

async function open(page: Page, url = DEMO) {
  await page.goto(url)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await page.evaluate(() => document.fonts.ready)
}

/** Heights on screen: the header (to its lowest visible part), the free scene between header and the bottom block,
 *  the timeline block (answer, tools, tracks), the footer. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const vis = (e: Element) => {
      const r = e.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'
    }
    const boxes = (sel: string) => [...document.querySelectorAll(sel)].filter(vis).map((e) => e.getBoundingClientRect())
    const head = boxes('header.top *')
    const headerBottom = Math.max(0, ...head.map((r) => r.bottom))
    const bottomTop = Math.min(innerHeight, ...boxes('.bottom:not([hidden]) > *').map((r) => r.top))
    const tl = boxes('.bottom:not([hidden]) .timeline')[0]
    const foot = boxes('.bottom:not([hidden]) > .foot')[0]
    return {
      viewport: innerHeight,
      header: Math.round(headerBottom),
      scene: Math.round(bottomTop - headerBottom),
      timeline: Math.round(tl?.height ?? 0),
      footer: Math.round(foot?.height ?? 0),
    }
  })
}

for (const vp of [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
]) {
  test(`phone ${vp.width} × ${vp.height}: the scene gets at least half the height; controls 44 px; nothing scrolls sideways`, async ({ page }, info) => {
    await page.setViewportSize(vp)
    await open(page)
    const m = await measure(page)
    info.annotations.push({ type: 'heights', description: JSON.stringify(m) })
    console.log(`frame ${vp.width}x${vp.height}`, JSON.stringify(m))
    await page.screenshot({ path: `${SHOTS}/${vp.width}-site.png` })
    expect(m.scene, JSON.stringify(m)).toBeGreaterThanOrEqual(vp.height / 2)
    // Every control on the main screen is a 44 px target on a phone.
    for (const c of await page.getByRole('button').or(page.getByRole('link')).all()) {
      if (!(await c.isVisible())) continue
      const b = (await c.boundingBox())!
      expect(b.height, `${await c.innerText()} height`).toBeGreaterThanOrEqual(44 - 0.01)
      expect(b.x + b.width, `${await c.innerText()} right edge`).toBeLessThanOrEqual(vp.width + 0.5)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    // The map pins the POI specs tap on a phone lie at about (190, 560): that point must be the scene, not a control.
    const at = await page.evaluate(() => document.elementFromPoint(190, 560)?.tagName)
    expect(at).toBe('CANVAS')
    // Header in three rows: mission; site · date; the three controls on one row.
    const row = async (id: string) => Math.round((await page.getByTestId(id).boundingBox())!.y)
    expect(await row('date')).toBeGreaterThan(await row('mission'))
    expect(new Set([await row('poi-toggle'), await row('search-open'), await row('details')]).size).toBe(1)
    // The coordinates and the site's caveat stay visible on one small line.
    await expect(page.getByTestId('coords')).toBeVisible()
    await expect(page.locator('.site-label')).toBeVisible()
  })
}

for (const vp of [
  { width: 1280, height: 720 },
  { width: 375, height: 812 },
]) {
  test(`U17 frame at ${vp.width} px: no internals in the text, one way to the documentation, hints on the controls`, async ({ page }) => {
    await page.setViewportSize(vp)
    await open(page)
    const text = await page.locator('.app').innerText()
    for (const bad of ['Access not assessed', 'ESTABLISHED', 'not retrieved', '.json', 'NaN', 'undefined']) expect(text, bad).not.toContain(bad)
    // Abbreviations in the frame: UTC, LOLA, JPL, DE440 are names of a time scale, an instrument, a lab and an
    // ephemeris, spelled as NASA spells them; the frame's controls each carry a one-line hint.
    for (const id of ['date', 'search-open', 'details', 'view', 'simulate', 'docs-open']) await expect(page.getByTestId(id)).toHaveAttribute('title', /\w{3,}/)
    // One entry to the documentation on the main screen (read-header: "Docs" + "Full documentation" were two).
    await expect(page.getByTestId('docs-open')).toHaveText('Documentation')
    await expect(page.getByTestId('docs-page-link')).toHaveCount(0)
    // Header controls are buttons with a plain 1 px box and the app's 4 px corners, not pills (team request in chat,
    // 15 Nov 11:00: "make the buttons more visually clear that they are buttons"; until then they were text links
    // and this line asserted a 0 px border).
    const box = await page.getByTestId('search-open').evaluate((e) => [getComputedStyle(e).borderTopWidth, getComputedStyle(e).borderTopLeftRadius])
    expect(box).toEqual(['1px', '4px'])
    // The View menu: each entry has a one-line hint; the names stay the labels.
    await page.getByTestId('view').click()
    const menu = page.getByTestId('view-menu')
    await expect(menu.getByRole('menuitem')).toHaveText(['Landing site', 'Eye level', 'Moon'])
    for (const name of ['Landing site', 'Eye level', 'Moon']) await expect(menu.getByRole('menuitem', { name, exact: true })).toHaveAttribute('data-hint', /\w+ \w+/)
    await page.screenshot({ path: `${SHOTS}/${vp.width}-view-menu.png` })
    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    await page.screenshot({ path: `${SHOTS}/${vp.width}-site-frame.png` })
  })
}
