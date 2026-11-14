// Brief C2 done-checks: UX-01/02 (demo question from a fresh URL), basic comparison, UX-03 (invalid input,
// failed loads, missing data, no WebGL), UX-04 (every site reachable), D4 control count, URL state, keys, drawer,
// screenshots. Run: PW_PORT=5182 npx playwright test e2e/ui.spec.ts
//
// Site, period and station facts are read from app/public/data at run time; period labels and the station
// count are never hard-coded. test.fixme = can only pass after integration; the reason is on the same line.
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { NOT_VALIDATED, VALIDATED } from '../src/data/validation'

const RIDGE = 'connecting-ridge' // demo site (ninja, 14 Nov)
const MASSIF = 'malapert-massif'
const SITE23 = 'malapert-site23'
const SHACK = 'shackleton-rim-site04'
const AUG = 'shackleton-2027-08' // period ids unchanged; labels now read "Connecting Ridge, …"
const SEP = 'shackleton-2027-09'
const DEMO = `/#site=${RIDGE}&period=${AUG}`

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
]

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function data<T>(page: Page, file: string): Promise<T> {
  return (await (await page.request.get(`/data/${file}`)).json()) as T
}

/** Station ids in stations.json order: never hard-coded (3 DSN stations today). */
async function stationIds(page: Page): Promise<string[]> {
  return (await data<{ id: string }[]>(page, 'stations.json')).map((s) => s.id)
}

async function chooseSite(page: Page, id: string) {
  await page.getByTestId('site-name').click()
  await page.locator(`#site-opt-${id}`).click()
}

async function choosePeriod(page: Page, id: string) {
  const label = (await data<{ id: string; label: string }[]>(page, 'periods.json')).find((p) => p.id === id)!.label
  await page.getByTestId('date').click()
  // The row also carries the period's reason ("team candidate period, …"), so match the label as a prefix.
  await page.getByRole('button', { name: new RegExp(`^${esc(label)}`) }).click()
}

async function expectAnswer(page: Page, siteId: string, periodId: string, timeout = 10_000) {
  const a = page.getByTestId('answer')
  await expect(a).toHaveAttribute('data-state', 'ready', { timeout })
  await expect(a).toHaveAttribute('data-site-id', siteId, { timeout })
  await expect(a).toHaveAttribute('data-period-id', periodId, { timeout })
  await expect(a.locator('.answer-sun')).not.toBeEmpty()
  await expect(a.locator('.answer-comms')).not.toBeEmpty()
}

async function expectTracks(page: Page) {
  for (const id of ['track-sun', 'track-comms']) {
    await expect(page.getByTestId(id)).toHaveAttribute('data-ready', 'true')
    await expect(page.getByTestId(id)).toBeVisible()
    expect(await page.getByTestId(id).locator('.seg').count()).toBeGreaterThan(0)
  }
}

async function expectMarker(page: Page) {
  if (VALIDATED) await expect(page.getByTestId('sample-flag')).toHaveCount(0)
  else await expect(page.getByTestId('sample-flag')).toHaveText(NOT_VALIDATED)
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

/** A number from the drawer's comparison table: row label, column 0 = current view, 1 = compared view. */
async function compareValue(drawer: Locator, row: string, col: 0 | 1): Promise<number> {
  const cell = drawer.getByTestId('compare-table').getByRole('row', { name: new RegExp(`^${row}`) }).getByRole('cell').nth(col)
  await expect(cell).toHaveText(/^\d+\.\d (%|h)$/, { timeout: 20_000 })
  return parseFloat(await cell.innerText())
}

// ---------- UX-01 / UX-02 ----------

for (const vp of VIEWPORTS) {
  test(`UX-01/02: a fresh URL answers the demo question at ${vp.width} px`, async ({ page }) => {
    await page.setViewportSize(vp)
    const t0 = Date.now()
    await page.goto('/')
    await expectAnswer(page, RIDGE, AUG, 60_000)
    await expectTracks(page)
    expect(Date.now() - t0).toBeLessThan(60_000)

    await expect(page.getByTestId('site-name')).toHaveText('Connecting Ridge')
    await expect(page.getByText('Blue Moon MK1 target')).toBeVisible()
    await expect(page.getByTestId('coords')).toHaveText('89.46° S · 136.68° W')
    await expect(page.getByTestId('date')).toHaveText('16 August 2027, 00:00 UTC')
    await expectMarker(page)
    await expect(page.locator('body')).not.toContainText('NaN')
    await noHorizontalScroll(page)
    // All stations selected by default.
    await page.getByTestId('answer').click()
    await expect(page.getByTestId('drawer').getByRole('checkbox', { checked: true })).toHaveCount((await stationIds(page)).length)
  })

  test.fixme(`UX-01/02: Sun and Earth labels on their objects at ${vp.width} px`, async ({ page }) => {
    // Waits for C1: the scene3d stub's project() returns null, so every label stays hidden until C1 merges.
    await page.setViewportSize(vp)
    await page.goto(`${DEMO}&test=1`)
    await expectAnswer(page, RIDGE, AUG, 60_000)
    await expect(page.getByTestId('label-site')).toBeVisible()
    await expect(page.getByTestId('label-site')).toHaveText('Landing site')
    for (const name of ['sun', 'earth'] as const) {
      const p = await page.evaluate((n) => (window as unknown as { __scene?: { project(n: string): { visible: boolean } | null } }).__scene?.project(n), name)
      const label = page.getByTestId(`label-${name}`)
      if (p?.visible) await expect(label).toContainText(name === 'sun' ? /^Sun −?\d+\.\d°$/ : /^Earth −?\d+\.\d°$/)
      else await expect(label).toBeHidden()
    }
  })
}

test('labels sit on the points project() returns and hide on null (scene stub patched in this test)', async ({ page }) => {
  // Serves the scene3d stub with a fixed projector instead of `() => null`; no repo file is changed.
  const stub = await (await page.request.get('/src/scene3d/index.ts')).text()
  test.skip(!stub.includes('project: () => null'), "C1's scene is merged: the fixme label tests above cover the real projector")
  const points = { sun: { x: 454, y: 163, visible: true }, earth: { x: 980, y: 117, visible: true }, site: { x: 720, y: 336, visible: true } }
  await page.route('**/src/scene3d/index.ts*', async (route) => {
    const res = await route.fetch()
    const body = (await res.text()).replace('project: () => null', `project: (n) => (window.__hide === n ? null : ${JSON.stringify(points)}[n])`)
    await route.fulfill({ response: res, body })
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(DEMO)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  await expect(page.getByTestId('label-sun')).toBeVisible()
  await expect(page.getByTestId('label-sun')).toHaveText(/^Sun −?\d+\.\d°$/)
  await expect(page.getByTestId('label-earth')).toHaveText(/^Earth −?\d+\.\d°$/)
  await expect(page.getByTestId('label-site')).toHaveText('Landing site')
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: 'test-results/labels-1440.png', animations: 'disabled' })
  await page.evaluate(() => ((window as unknown as { __hide: string }).__hide = 'earth'))
  await expect(page.getByTestId('label-earth')).toBeHidden()
  await expect(page.getByTestId('label-sun')).toBeVisible()
  // While a new site loads, number labels hide instead of keeping the old site's numbers.
  await page.route('**/data/horizons/**', async (route) => {
    await new Promise((r) => setTimeout(r, 1500))
    await route.continue()
  })
  await chooseSite(page, MASSIF)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'loading')
  await expect(page.getByTestId('label-sun')).toBeHidden()
  await expectAnswer(page, MASSIF, AUG)
  await expect(page.getByTestId('label-sun')).toBeVisible()
})

test('UX-01: screen numbers agree with the integrator preview run (wiring check, not validation)', async ({ page }) => {
  // Preview: integrator's Python run, 10-min steps, not validated. Tolerance covers the step difference only.
  await page.goto(DEMO)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  await page.getByTestId('answer').click()
  const drawer = page.getByTestId('drawer')
  expect(Math.abs((await compareValue(drawer, 'Sunlit', 0)) - 91)).toBeLessThan(4)
  expect(Math.abs((await compareValue(drawer, 'Station coverage', 0)) - 98)).toBeLessThan(3)
  await drawer.getByLabel('Compare with period').selectOption(SEP)
  expect(await compareValue(drawer, 'Sunlit', 1)).toBeGreaterThan(96)
  expect(Math.abs((await compareValue(drawer, 'Station coverage', 1)) - 96)).toBeLessThan(3)
  await drawer.getByLabel('Compare with site').selectOption(MASSIF)
  await drawer.getByLabel('Compare with period').selectOption(AUG)
  expect(Math.abs((await compareValue(drawer, 'Sunlit', 1)) - 46)).toBeLessThan(4)
  expect(await compareValue(drawer, 'Station coverage', 1)).toBeGreaterThan(97)
  await drawer.getByLabel('Compare with site').selectOption(SHACK)
  expect(await compareValue(drawer, 'Sunlit', 1)).toBe(0)
  expect(await compareValue(drawer, 'Station coverage', 1)).toBe(0)
  // The sentence for a site that stays dark says so.
  await page.keyboard.press('Escape')
  await chooseSite(page, SHACK)
  await expectAnswer(page, SHACK, AUG)
  await expect(page.getByTestId('answer').locator('.answer-sun')).toHaveText('Dark throughout this period.')
})

// ---------- basic comparison ----------

test('basic comparison: Connecting Ridge ↔ Malapert Massif, same period; Aug ↔ Sep 2027', async ({ page }) => {
  await page.goto(DEMO)
  await expectAnswer(page, RIDGE, AUG, 60_000)

  // Record every moment the answer claims to be ready for a selection the header does not show.
  await page.evaluate(() => {
    const w = window as unknown as { __stale: string[] }
    w.__stale = []
    const check = () => {
      const a = document.querySelector<HTMLElement>('[data-testid=answer]')
      const s = document.querySelector<HTMLElement>('[data-testid=site-name]')
      const d = document.querySelector<HTMLElement>('[data-testid=date]')
      if (a?.dataset.state === 'ready' && (a.dataset.siteId !== s?.dataset.siteId || a.dataset.periodId !== d?.dataset.periodId)) {
        w.__stale.push(`${s?.dataset.siteId}/${d?.dataset.periodId} showed ${a.dataset.siteId}/${a.dataset.periodId}`)
      }
    }
    new MutationObserver(check).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
  })

  const step = async (fn: () => Promise<void>, site: string, period: string) => {
    const t = Date.now()
    await fn()
    await expectAnswer(page, site, period, 10_000)
    await expectTracks(page)
    expect(Date.now() - t).toBeLessThan(10_000)
  }
  await step(() => chooseSite(page, MASSIF), MASSIF, AUG)
  await expect(page.getByTestId('coords')).toHaveText('85.98° S · 0.26° W')
  await step(() => chooseSite(page, RIDGE), RIDGE, AUG)
  await step(() => choosePeriod(page, SEP), RIDGE, SEP)
  await expect(page.getByTestId('date')).toHaveText('12 September 2027, 00:00 UTC')
  await step(() => choosePeriod(page, AUG), RIDGE, AUG)

  // The drawer's Switch button changes context and results together too.
  await page.getByTestId('answer').click()
  const drawer = page.getByTestId('drawer')
  await drawer.getByLabel('Compare with site').selectOption(MASSIF)
  await drawer.getByLabel('Compare with period').selectOption(AUG)
  await step(() => drawer.getByRole('button', { name: /^Switch to Malapert Massif,/ }).click(), MASSIF, AUG)

  expect(await page.evaluate(() => (window as unknown as { __stale: string[] }).__stale)).toEqual([])
  await expect(page.locator('body')).not.toContainText('NaN')
})

// ---------- UX-03 ----------

test('UX-03: invalid coordinates are rejected with a message, never NaN', async ({ page }) => {
  await page.goto(DEMO)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  await page.getByTestId('site-name').click()
  const search = page.getByRole('combobox', { name: 'Search a site or type coordinates' })
  const cases: [string, RegExp][] = [
    ['95 S, 10 E', /Latitude must be between 90° S and 90° N/],
    ['-89.5, 400', /Longitude must be between 180° W and 180° E/],
    ['12', /Type a latitude and a longitude/],
    ['1 2 3', /Type a latitude and a longitude/],
  ]
  for (const [text, msg] of cases) {
    await search.fill(text)
    await expect(page.getByRole('alert')).toHaveText(msg)
    await expect(page.locator('body')).not.toContainText('NaN')
  }
  await search.fill('89.3 S, 130 W')
  await expect(page.getByRole('status')).toContainText('89.30° S · 130.00° W')
  await expect(page.getByRole('button', { name: /Add a point/ })).toBeDisabled()
  await search.fill('Site23')
  await expect(page.getByRole('option')).toHaveCount(1)
  await page.keyboard.press('Enter')
  await expectAnswer(page, SITE23, AUG)
})

test('UX-04: the site menu lists every site in sites.json, each with its label', async ({ page }) => {
  const sites = await data<{ id: string; name: string; label: string | null }[]>(page, 'sites.json')
  await page.goto(`/#site=${MASSIF}&period=${AUG}`)
  await expectAnswer(page, MASSIF, AUG, 60_000)
  await page.getByTestId('site-name').click()
  await expect(page.getByRole('option')).toHaveCount(sites.length)
  for (const s of sites.filter((x) => x.label)) {
    await expect(page.locator(`#site-opt-${s.id}`)).toHaveAccessibleName(`${s.name} ${s.label}`)
  }
  await page.getByRole('combobox').fill('Blue Moon')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('site-name')).toHaveText('Connecting Ridge')
  await expect(page.getByText('Blue Moon MK1 target')).toBeVisible()
  await expect(page.getByTestId('coords')).toHaveText('89.46° S · 136.68° W')
})

test('UX-03: a date outside the supported range is rejected', async ({ page }) => {
  await page.goto(DEMO)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  await page.getByTestId('date').click()
  await page.getByLabel('Date (UTC)').fill('2035-01-01')
  await page.getByRole('button', { name: 'Show', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('1 November 2026 to 31 December 2030')
  await page.getByLabel('Date (UTC)').fill('2027-08-20')
  await page.getByLabel('Time (UTC)').fill('06:30')
  await page.getByRole('button', { name: 'Show', exact: true }).click()
  await expect(page.getByTestId('date')).toHaveText('20 August 2027, 06:30 UTC')
  await expectAnswer(page, RIDGE, AUG)
})

test('UX-03: a failed data load shows an error', async ({ page }) => {
  await page.route('**/data/sites.json', (r) => r.fulfill({ status: 500, body: 'boom' }))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Could not load the data.')
  await expect(page.getByRole('alert')).toContainText('sites.json: HTTP 500')
})

test('UX-03: a failed ephemeris load shows an error in place of the answer', async ({ page }) => {
  await page.route('**/data/ephem/**', (r) => r.fulfill({ status: 500, body: 'boom' }))
  await page.goto(DEMO)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'error', { timeout: 30_000 })
  await expect(page.getByTestId('answer')).toContainText('Could not load the data for Connecting Ridge')
  await expect(page.getByTestId('track-sun')).toHaveAttribute('data-ready', 'false')
})

test('UX-03: a missing ephemeris month or horizon shows "no data", never invented numbers', async ({ page }) => {
  await page.route('**/data/ephem/**', (r) => r.fulfill({ status: 404, body: '' }))
  await page.goto(DEMO)
  const a = page.getByTestId('answer')
  await expect(a).toHaveAttribute('data-state', 'empty', { timeout: 30_000 })
  await expect(a).toHaveText('No data for these dates in this build.')
  await expect(page.getByTestId('track-sun')).toHaveAttribute('data-ready', 'false')
  await expect(page.getByTestId('label-sun')).toBeHidden()
  await page.unroute('**/data/ephem/**')
  await page.route(`**/data/horizons/${MASSIF}.json`, (r) => r.fulfill({ status: 404, body: '' }))
  await chooseSite(page, MASSIF)
  await expect(a).toHaveAttribute('data-state', 'empty', { timeout: 30_000 })
  await expect(a).toHaveText('No terrain data for Malapert Massif in this build.')
  await expect(page.locator('body')).not.toContainText('NaN')
})

test('UX-03: without WebGL the horizon strip and the sentence still work', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (/webgl/i.test(type)) return null
      return (orig as (...a: unknown[]) => unknown).call(this, type, ...rest)
    } as typeof orig
  })
  await page.goto(DEMO)
  await expect(page.getByTestId('fallback')).toBeVisible()
  await expectAnswer(page, RIDGE, AUG, 60_000)
  await expectTracks(page)
  const strip = page.getByTestId('fallback').getByTestId('horizon-strip')
  await expect(strip.getByTestId('strip-sun')).toContainText(/Sun −?\d+\.\d°/)
  await expect(strip.getByTestId('strip-earth')).toContainText(/Earth −?\d+\.\d°/)
  await chooseSite(page, MASSIF)
  await expectAnswer(page, MASSIF, AUG)
})

test('UX-03: a broken link falls back to defaults, never NaN', async ({ page }) => {
  await page.goto('/#site=Nope!&period=zzz&t=garbage&st=,,&view=sideways&pts=999,1')
  await expectAnswer(page, RIDGE, AUG, 60_000)
  await expect(page.locator('body')).not.toContainText('NaN')
})

// ---------- D4: three header controls ----------

for (const vp of VIEWPORTS) {
  test(`D4: header has 3 controls, main screen 5, one slider, no horizontal scroll at ${vp.width} px`, async ({ page }) => {
    await page.setViewportSize(vp)
    await page.goto(DEMO)
    await expectAnswer(page, RIDGE, AUG, 60_000)
    const header = page.locator('header.top')
    await expect(header.getByRole('button').or(header.getByRole('link'))).toHaveCount(3)
    await expect(page.getByRole('button').or(page.getByRole('link'))).toHaveCount(5)
    await expect(page.getByRole('slider')).toHaveCount(1)
    await noHorizontalScroll(page)
  })
}

// ---------- URL state, keys, drawer ----------

test('a copied link reproduces site, period, cursor, stations and drawer', async ({ page }) => {
  await page.goto(`/#site=${MASSIF}&period=malapert-2026-12&t=2026-12-22T06:30Z&st=madrid,canberra&drawer=details`)
  await expectAnswer(page, MASSIF, 'malapert-2026-12', 60_000)
  await expect(page.getByTestId('date')).toHaveText('22 December 2026, 06:30 UTC')
  const drawer = page.getByTestId('drawer')
  await expect(drawer).toBeVisible()
  const all = await stationIds(page)
  await expect(drawer.getByRole('checkbox')).toHaveCount(all.length)
  await expect(drawer.getByRole('checkbox', { checked: true })).toHaveCount(2)
  await drawer.getByRole('checkbox', { name: /Goldstone/ }).check()
  const sel = all.filter((id) => ['goldstone', 'madrid', 'canberra'].includes(id))
  // All stations selected is the default and leaves `st` out of the link.
  if (sel.length === all.length) await expect.poll(() => page.evaluate(() => location.hash)).not.toContain('st=')
  else await expect.poll(() => page.evaluate(() => location.hash)).toContain(`st=${sel.join(',')}`)
})

test('keys and drag move the cursor; space plays', async ({ page }) => {
  await page.goto(DEMO)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  const date = page.getByTestId('date')
  await page.keyboard.press('ArrowRight')
  await expect(date).toHaveText('16 August 2027, 00:30 UTC')
  await page.keyboard.press('Shift+ArrowRight')
  await expect(date).toHaveText('17 August 2027, 00:30 UTC')
  await page.keyboard.press('ArrowLeft')
  await expect(date).toHaveText('17 August 2027, 00:00 UTC')
  const box = (await page.getByRole('slider').boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + 10)
  await expect(date).toHaveText(/^2[23] August 2027, \d\d:[03]0 UTC$/)
  const scrubbed = await date.innerText()
  await page.keyboard.press('Space')
  await expect(date).not.toHaveText(scrubbed)
  await page.keyboard.press('Space')
})

test('drawer: stations, comms meaning, finder, potential and sources', async ({ page }) => {
  await page.goto(DEMO)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  await page.getByTestId('answer').click()
  const drawer = page.getByTestId('drawer')
  await expect(drawer.getByRole('heading', { name: 'Stations' })).toBeVisible()
  await expect(drawer.getByRole('checkbox', { checked: true })).toHaveCount((await stationIds(page)).length)
  await expect(drawer).toContainText('not a guaranteed radio link')
  await expect(drawer.getByTestId('horizon-strip')).toBeVisible()
  await expect(drawer.getByRole('heading', { name: 'Site potential' })).toBeAttached()
  await expect(drawer).toContainText('Evidence: modeled condition. Access not assessed.')
  for (const row of await drawer.locator('table.stations tbody tr td:nth-child(2)').allInnerTexts()) {
    expect(['line of sight', 'blocked by terrain', 'Moon below station mask']).toContain(row)
  }
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()

  await page.getByRole('button', { name: 'Find better dates' }).click()
  await expect(drawer.getByRole('heading', { name: 'Find better dates' })).toBeInViewport()
  await expect(drawer.getByRole('spinbutton')).toHaveCount(5)
  await drawer.getByLabel('Sunlit at least, %').fill('150')
  await drawer.getByRole('button', { name: 'Find dates' }).click()
  await expect(drawer.getByRole('alert')).toContainText('Sunlit at least, %: a number from 0 to 100.')
  await drawer.getByLabel('Sunlit at least, %').fill('70')
  await drawer.getByRole('button', { name: 'Find dates' }).click()
  await expect(drawer.locator('.finder-results')).toBeVisible({ timeout: 30_000 })
  await expect(drawer.locator('.finder')).not.toContainText('failed')
  await drawer.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: 'how this is computed' }).click()
  await expect(drawer.getByRole('heading', { name: 'How this is computed' })).toBeInViewport()
})

// ---------- screenshots (app/test-results/*.png, outside Playwright's wiped outputDir) ----------

for (const vp of [
  { width: 1440, height: 900, tag: '1440' },
  { width: 375, height: 812, tag: '375' },
]) {
  test(`screenshots at ${vp.tag} px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.goto(DEMO)
    await expectAnswer(page, RIDGE, AUG, 60_000)
    await page.evaluate(() => document.fonts.ready)
    const shot = (name: string) => page.screenshot({ path: `test-results/${name}-${vp.tag}.png`, animations: 'disabled' })
    await shot('main')
    await page.getByTestId('site-name').click()
    await expect(page.getByRole('option').first()).toBeVisible()
    await shot('menu')
    await page.keyboard.press('Escape')
    await page.getByTestId('answer').click()
    await expect(page.getByTestId('drawer')).toBeVisible()
    await shot('drawer')
    await page.getByTestId('drawer').getByRole('heading', { name: 'Compare' }).scrollIntoViewIfNeeded()
    await shot('drawer-compare')
    await page.getByTestId('drawer').getByRole('heading', { name: 'How this is computed' }).scrollIntoViewIfNeeded()
    await shot('drawer-sources')
  })
}
