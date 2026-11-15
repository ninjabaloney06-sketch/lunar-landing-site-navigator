// U17 checks (wave 3, read-site) for the three site sections of the Details drawer, in the order a planner reads
// them: Landing site assessment ("can I land here"), Power and battery estimate ("can I survive here"), Open in NASA
// tools ("check it elsewhere"). Summary mode shows no internals; every abbreviation shown has its long form; the
// fixed validation texts are on screen; at 375 px nothing scrolls sideways, in both modes.
// Screenshots for the report: SITE_SHOTS=<folder>.
// Run: PW_GPU=1 PW_PORT=5186 npx playwright test e2e/site-sections.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import { openDrawerFolds } from './header'

const SHOTS = process.env.SITE_SHOTS
const HASH = 'site=malapert-massif&period=shackleton-2027-08'
const INTERNALS = /Access not assessed|ESTABLISHED|not retrieved|\.json|\.TIF|\.tif|\.lbl|\.LBL|NaN|undefined|\bLeo\b|ninja/
const TERMS = ['RMS', 'DEM', 'PSR', 'LROC', 'JPL', 'UTC', 'AU', 'IM-2', 'DE440']

const FIXED = [
  'Validated by the science lead (statement of 15 Nov 2026; see record)',
  'project criteria (set by the team), not NASA or vehicle limits',
  'First estimate, not a power budget. Validated by the science lead (statement of 15 Nov 2026; see record).',
  'Not modelled: temperature, panel degradation, dust, tilt, partial-panel shading.',
  'Example values, change them',
  'All computed results validated by the science lead; statement of 15 Nov 2026: see record',
]

async function open(page: Page, hash = HASH) {
  await page.goto(`/?test=1#${hash}&drawer=details`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  const drawer = page.getByTestId('drawer')
  await openDrawerFolds(page) // the sections are folded to one line each
  const assess = drawer.getByTestId('site-assessment')
  await assess.getByText('Landing site assessment', { exact: true }).click()
  await expect(assess.getByTestId('assess-status')).toBeVisible({ timeout: 30_000 })
  const power = drawer.getByTestId('power-section')
  await expect(power.getByTestId('power-answer')).toBeVisible({ timeout: 60_000 })
  const tools = drawer.getByTestId('nasa-tools')
  await expect(tools.getByTestId('nt-our-sun')).toBeVisible({ timeout: 60_000 })
  // the "Open in NASA tools" section around the nasa-tools block (its heading is Drawer.tsx's)
  const toolsSec = drawer.locator('[aria-labelledby="sec-nasa"]')
  return { drawer, assess, power, tools: toolsSec }
}

/** Every term that appears in the visible text of the block is marked <abbr title> at least once there. */
async function expectTermsExpanded(block: Locator) {
  const text = await block.innerText()
  for (const t of TERMS) {
    if (!new RegExp(`(?<![A-Za-z0-9-])${t}(?![A-Za-z0-9])`).test(text)) continue
    const abbr = block.locator('abbr', { hasText: new RegExp(`^${t}$`) })
    expect(await abbr.count(), `${t} has an <abbr>`).toBeGreaterThan(0)
  }
  for (const title of await block.locator('abbr').evaluateAll((els) => els.map((e) => e.getAttribute('title') ?? ''))) {
    expect(title.length).toBeGreaterThan(3)
  }
}

async function noSideScroll(page: Page) {
  const d = await page.getByTestId('drawer').evaluate((el) => el.scrollWidth - el.clientWidth)
  expect(d, 'drawer scrolls sideways').toBeLessThanOrEqual(0)
  const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(w, 'page scrolls sideways').toBeLessThanOrEqual(0)
}

test('order, headings, fixed texts, no internals in summary mode, abbreviations expanded', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const s = await open(page)
  // order in the drawer: land → survive → check elsewhere
  const heads = await s.drawer.locator('h3').allInnerTexts()
  const at = (h: string) => heads.indexOf(h)
  expect(at('Landing site assessment')).toBeGreaterThan(-1)
  // 15 Nov, team request "settings to the top, graphs to the bottom": the power inputs come before the assessment.
  expect(at('Power and battery estimate')).toBeGreaterThan(-1)
  expect(at('Power and battery estimate')).toBeLessThan(at('Landing site assessment'))
  expect(at('Landing site assessment')).toBeLessThan(at('Open in NASA tools'))

  // the three lines of the assessment: verdict with the rule, the deciding value, project criteria
  await expect(s.assess.getByTestId('assess-verdict')).toHaveText('Fails the landing rule: every valid pixel slope in the 100 m radius landing disk ≤ 5.0°.')
  await expect(s.assess.getByTestId('assess-decider')).toHaveText('Maximum slope in the landing disk: 8.73°.')

  const all = (await s.assess.innerText()) + (await s.power.innerText()) + (await s.tools.innerText())
  for (const f of FIXED) expect(all, f).toContain(f)
  for (const b of [s.assess, s.power, s.tools]) {
    expect(await b.innerText()).not.toMatch(INTERNALS)
    await expectTermsExpanded(b)
  }
  // the power numbers use the app's comma grouping, never the narrow-space form
  expect(await s.power.innerText()).not.toMatch(/\d \d{3}/)
  // power: each input has its unit and a one-line hint tied to it
  for (const name of ['Panel area', 'Cell efficiency', 'Constant load', 'Battery capacity']) {
    const input = s.power.getByLabel(name)
    const hint = await input.getAttribute('aria-describedby')
    await expect(page.locator(`[id="${hint}"]`)).not.toBeEmpty()
  }
  await expect(s.power.getByTestId('power-answer')).toBeVisible()
  await expect(s.power.locator('th', { hasText: 'over the mission dates' })).toHaveCount(3)
  // external links: plain text links, new tab
  for (const a of await s.tools.locator('a[href^="http"]').all()) {
    await expect(a).toHaveAttribute('target', '_blank')
    await expect(a).toHaveAttribute('rel', /noopener/)
  }
  if (SHOTS) {
    await s.assess.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOTS}/site-assessment-summary-1280.png` })
    await s.power.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOTS}/power-summary-1280.png` })
    await s.tools.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOTS}/nasa-tools-summary-1280.png` })
  }

  // Full data adds the internals that belong there (file names, pixel counts), and the model disclosure names symbols
  await s.drawer.getByTestId('full-data-switch').first().click()
  await expect(s.assess.getByTestId('assess-slope')).toContainText('Pixels in the disk')
  await expect(s.assess.getByTestId('assess-slope')).toContainText('.TIF')
  await s.power.getByTestId('power-model').locator('summary').click()
  await expect(s.power.getByTestId('power-model')).toContainText('panel area, m²')
  await expectTermsExpanded(s.power)
  if (SHOTS) {
    await s.assess.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOTS}/site-assessment-full-1280.png` })
    await s.power.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOTS}/power-full-1280.png` })
  }
  expect(errors).toEqual([])
})

test('a custom site: "Not computed for this place" in the assessment, links still at its coordinates', async ({ page }) => {
  await page.goto('/?test=1#site=cap:-89.47000,-136.78000&period=shackleton-2027-08&drawer=details')
  const assess = page.getByTestId('site-assessment')
  await assess.getByText('Landing site assessment', { exact: true }).click()
  await expect(assess.getByTestId('assess-message')).toHaveText(Array(4).fill('Not computed for this place'))
  expect(await assess.innerText()).not.toMatch(INTERNALS)
  await expect(page.getByTestId('nt-moontrek')).toHaveAttribute('href', /^https:\/\/trek\.nasa\.gov\/moon\/#/)
})

test.describe('375 px', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })
  test('no sideways scroll in summary and full data mode; touch targets', async ({ page }) => {
    const s = await open(page)
    await noSideScroll(page)
    const summaryBox = await s.assess.locator('summary').first().boundingBox()
    expect(summaryBox!.height).toBeGreaterThanOrEqual(44)
    const inputBox = await s.power.getByLabel('Panel area').boundingBox()
    expect(inputBox!.height).toBeGreaterThanOrEqual(44)
    const linkBox = await page.getByTestId('nt-moontrek').boundingBox()
    expect(linkBox!.height).toBeGreaterThanOrEqual(40)
    if (SHOTS) {
      await s.assess.scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${SHOTS}/site-assessment-summary-375.png` })
      await s.power.scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${SHOTS}/power-summary-375.png` })
      await s.tools.scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${SHOTS}/nasa-tools-summary-375.png` })
    }
    await s.drawer.getByTestId('full-data-switch').first().click()
    await expect(s.assess.getByTestId('assess-slope')).toContainText('Pixels in the disk')
    await s.power.getByTestId('power-model').locator('summary').click()
    await noSideScroll(page)
    if (SHOTS) {
      await s.assess.getByTestId('assess-slope').scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${SHOTS}/site-assessment-full-375.png` })
      await s.power.getByTestId('power-model').scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${SHOTS}/power-full-375.png` })
    }
  })
})
