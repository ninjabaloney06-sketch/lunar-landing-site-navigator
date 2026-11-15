// U17 for the Details drawer's own sections and the Time periods menu: no research-note internals in summary mode,
// every abbreviation shown has its long form on hover, the finder names its units and defaults, no horizontal
// scroll at 375 px. Screenshots go to ROOT/reports/read-dates/ (READ_DATES_SHOTS) or test-results/.
// Run: PW_GPU=1 PW_PORT=5182 npx playwright test e2e/dates-read.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test'

const RIDGE = 'connecting-ridge'
const MASSIF = 'malapert-massif'
const AUG = 'shackleton-2027-08'
const SHOTS = process.env.READ_DATES_SHOTS ?? 'test-results'
const INTERNALS = ['Access not assessed', 'ESTABLISHED', 'not retrieved', '.json', 'NaN', 'undefined', 'Evidence:', 'about 80° S']
// The drawer sections this screen owns (the others are checked by their own agents' specs).
const OWN = ['sec-finder', 'sec-year', 'sec-horizon', 'sec-stations', 'sec-potential', 'sec-export', 'sec-sources']
const ABBR_RE = /\b(DSN|JAXA|DSS|BWG|UTC|LOLA|JPL|DE440|NAIF|MOON_ME|CSV|ESTRACK|PSR|LOS)\b/

async function open(page: Page, hash: string) {
  await page.goto(`/?test=1#${hash}`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
}

async function fullData(page: Page, on: boolean) {
  await page.addInitScript((v) => {
    try {
      window.localStorage.setItem('llsn.fullData', v)
    } catch {
      /* about:blank */
    }
  }, on ? '1' : '0')
}

/** Text of the drawer's own sections. */
async function ownText(drawer: Locator): Promise<string> {
  return drawer.evaluate(
    (d, ids) =>
      ids
        .map((id) => (d.querySelector(`section[aria-labelledby="${id}"]`) as HTMLElement | null)?.innerText ?? '')
        .join('\n'),
    OWN,
  )
}

/** Abbreviations in the own sections' text that are not inside an <abbr title>. */
async function unmarked(root: Locator, own: boolean): Promise<string[]> {
  return root.evaluate(
    (d, { ids, src, own }) => {
      const re = new RegExp(src, 'g')
      const roots = own ? ids.map((id) => d.querySelector(`section[aria-labelledby="${id}"]`)).filter((x): x is Element => !!x) : [d]
      const out: string[] = []
      for (const r of roots) {
        const walk = document.createTreeWalker(r, NodeFilter.SHOW_TEXT)
        for (let n = walk.nextNode(); n; n = walk.nextNode()) {
          const el = n.parentElement
          if (!el || el.closest('abbr[title]') || el.closest('svg') || el.closest('option')) continue
          if (getComputedStyle(el).display === 'none') continue
          for (const m of (n.textContent ?? '').matchAll(re)) out.push(`${m[1]} in "${(n.textContent ?? '').trim().slice(0, 60)}"`)
        }
      }
      return out
    },
    { ids: OWN, src: ABBR_RE.source, own },
  )
}

test.describe('U17: Details drawer, own sections', () => {
  for (const vp of [
    { width: 1280, height: 800 },
    { width: 375, height: 812 },
  ]) {
    test(`summary mode: decision lines, no internals, abbreviations expanded, no horizontal scroll at ${vp.width} px`, async ({ page }) => {
      test.setTimeout(120_000)
      await page.setViewportSize(vp)
      await fullData(page, false)
      await page.addInitScript(() => {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem('llsn.missions.v1', JSON.stringify([`site=malapert-massif&period=shackleton-2027-09&name=Massif%20survey`]))
          sessionStorage.setItem('seeded', '1')
        }
      })
      await open(page, `site=${RIDGE}&period=${AUG}&drawer=details`)
      const drawer = page.getByTestId('drawer')
      await expect(drawer.getByTestId('year-row').nth(1)).toHaveAttribute('data-state', 'done', { timeout: 60_000 })
      // one decision line per section
      await expect(drawer.getByTestId('finder-lead')).toContainText('every 30 minutes')
      await expect(drawer.getByTestId('finder-lead')).not.toContainText('6 hours')
      await expect(drawer.getByTestId('horizon-lead')).toHaveText(/^At .+: Sun (above|below) the terrain, Earth (above|below) it\.$/)
      await expect(drawer.getByTestId('stations-lead')).toHaveText(/^(Line of sight to \d+ of \d+ selected stations? now|No line of sight to any of the \d+ selected stations now)\.$/)
      await expect(drawer.getByTestId('year-legend')).toContainText('number: share of 2027 sunlit')
      await expect(drawer.getByTestId('year-legend')).toContainText('outline: mission dates')
      await expect(drawer.getByTestId('strip-key')).toContainText('terrain horizon seen from 1.75 m above the ground')
      // site potential: category and a plain evidence phrase; the source's text behind a disclosure
      const items = drawer.getByTestId('potential-item')
      await expect(items.first().getByTestId('potential-evidence')).toHaveText(/^· (measured directly|seen in remote-sensing data|from a model, not measured here|an interpretation, not confirmed|no site-specific data yet)$/)
      await expect(items.first().locator('details summary')).toHaveText('What the source says')

      const text = await ownText(drawer)
      for (const bad of INTERNALS) expect(text, bad).not.toContain(bad)
      expect(await unmarked(drawer, true)).toEqual([])

      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
      expect(await drawer.evaluate((d) => d.scrollWidth - d.clientWidth)).toBeLessThanOrEqual(0)
      if (vp.width < 640) {
        const summary = (await items.first().locator('details summary').boundingBox())!
        expect(summary.height).toBeGreaterThanOrEqual(44)
      }
      await page.screenshot({ path: `${SHOTS}/${vp.width}-summary-top.png` })
      for (const id of ['sec-year', 'sec-horizon', 'sec-stations', 'sec-potential', 'sec-export']) {
        await drawer.locator(`section[aria-labelledby="${id}"]`).evaluate((e) => e.scrollIntoView({ block: 'start' }))
        await page.screenshot({ path: `${SHOTS}/${vp.width}-summary-${id.slice(4)}.png` })
      }
    })

    test(`full data: finder units, hints and defaults; method text and source links at ${vp.width} px`, async ({ page }) => {
      test.setTimeout(120_000)
      await page.setViewportSize(vp)
      await fullData(page, true)
      await open(page, `site=${RIDGE}&period=${AUG}&drawer=details`)
      const drawer = page.getByTestId('drawer')
      const defaults = (await page.evaluate(`import('/src/geometry/index.ts').then((g) => g.FINDER_DEFAULTS)`)) as Record<string, number>
      const units: Record<string, string> = { missionDays: 'days', minLitPct: '%', minCoveragePct: '%', maxGapH: 'h', maxDarkH: 'h' }
      for (const [key, unit] of Object.entries(units)) {
        const input = drawer.getByTestId(`finder-${key}`)
        await expect(input).toHaveValue(String(defaults[key]))
        const hint = drawer.locator(`#finder-${key}-hint`)
        await expect(hint).toContainText(`Default ${defaults[key]} ${unit}.`)
        await expect(input).toHaveAttribute('aria-describedby', `finder-${key}-hint`)
        expect(await drawer.locator(`label[for="finder-${key}"]`).innerText()).toContain(`(${unit})`)
      }
      // potential: the full text with its source link
      await expect(drawer.getByTestId('potential-item').first().getByRole('link', { name: 'Source' })).toHaveAttribute('href', /^https:\/\//)
      await expect(drawer.getByRole('heading', { name: 'How this is computed' })).toBeAttached()
      const text = await ownText(drawer)
      for (const bad of ['Access not assessed', 'ESTABLISHED', 'not retrieved', '.json', 'NaN', 'undefined', 'Evidence:', 'about 80° S']) expect(text, bad).not.toContain(bad)
      expect(await unmarked(drawer, true)).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
      await page.screenshot({ path: `${SHOTS}/${vp.width}-full-finder.png` })
      for (const id of ['sec-stations', 'sec-potential', 'sec-sources']) {
        await drawer.locator(`section[aria-labelledby="${id}"]`).evaluate((e) => e.scrollIntoView({ block: 'start' }))
        await page.screenshot({ path: `${SHOTS}/${vp.width}-full-${id.slice(4)}.png` })
      }
    })
  }

  test('"How this is computed" from the footer link in summary mode: short bullets of at most 12 words', async ({ page }) => {
    await fullData(page, false)
    await open(page, `site=${RIDGE}&period=${AUG}&drawer=sources`)
    const short = page.getByTestId('drawer').getByTestId('method-short')
    await expect(short).toBeVisible()
    const bullets = await short.locator('li').allInnerTexts()
    expect(bullets.length).toBeGreaterThanOrEqual(3)
    for (const b of bullets) expect(b.trim().split(/\s+/).length, b).toBeLessThanOrEqual(12)
  })

  test('finder: a result table with units, and the nearest miss names its thresholds in words', async ({ page }) => {
    test.setTimeout(120_000)
    await fullData(page, false)
    await open(page, `site=${MASSIF}&period=${AUG}&drawer=finder`)
    const drawer = page.getByTestId('drawer')
    await drawer.getByRole('button', { name: 'Find dates' }).click()
    await expect(drawer.locator('.finder-results')).toBeVisible({ timeout: 60_000 })
    const table = drawer.getByTestId('finder-table')
    if (await table.count()) {
      await expect(table.locator('thead th')).toHaveText(['Land between', 'Sunlit', 'Station coverage', 'Longest gap', 'Show'])
      await expect(table.locator('tbody td').nth(0)).toContainText('UTC')
    }
    // impossible thresholds: no window, and the closest candidate says what it misses in plain words
    await drawer.getByLabel('Sunlit at least (%)').fill('100')
    await drawer.getByLabel('Station coverage at least (%)').fill('100')
    await drawer.getByRole('button', { name: 'Find dates' }).click()
    const none = drawer.getByTestId('finder-none')
    await expect(none).toBeVisible({ timeout: 60_000 })
    await expect(none).toContainText(/which misses the [a-z ,]+ thresholds?\.$/)
    await expect(none).not.toContainText('at least')
  })

  for (const vp of [
    { width: 1280, height: 720 },
    { width: 375, height: 812 },
  ]) {
    test(`Time periods menu names the finder defaults, UTC expanded, no horizontal scroll at ${vp.width} px`, async ({ page }) => {
      test.setTimeout(120_000)
      await page.setViewportSize(vp)
      await open(page, `site=${RIDGE}&period=${AUG}`)
      await page.getByTestId('date').click()
      await expect(page.getByTestId('best-period').first()).toBeVisible({ timeout: 60_000 })
      const defaults = (await page.evaluate(`import('/src/geometry/index.ts').then((g) => g.FINDER_DEFAULTS)`)) as Record<string, number>
      await expect(page.getByTestId('best-defaults')).toHaveText(
        `14-day stays, proposed finder defaults: sunlit ≥ ${defaults.minLitPct} %, coverage ≥ ${defaults.minCoveragePct} %, gap ≤ ${defaults.maxGapH} h, darkness ≤ ${defaults.maxDarkH} h.`,
      )
      const menu = page.locator('.date-menu')
      expect(await unmarked(menu, false)).toEqual([])
      const text = await menu.innerText()
      for (const bad of INTERNALS) expect(text, bad).not.toContain(bad)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
      await page.screenshot({ path: `${SHOTS}/${vp.width}-time-periods.png` })
    })
  }
})
