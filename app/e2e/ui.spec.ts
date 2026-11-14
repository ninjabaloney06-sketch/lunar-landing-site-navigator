// Brief C2 done-checks: UX-01/02 (demo question from a fresh URL), basic comparison, UX-03 (invalid input,
// failed loads, missing data, no WebGL), UX-04 (every site reachable), D4 control count, URL state, keys, drawer,
// screenshots. Run: PW_PORT=5182 npx playwright test e2e/ui.spec.ts
//
// Site, period and station facts are read from app/public/data at run time; period labels and the station
// count are never hard-coded. test.fixme = can only pass after integration; the reason is on the same line.
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { NOT_VALIDATED, VALIDATED } from '../src/data/validation'
import { EXAMPLE } from '../src/views/examples'

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

/** Header control 1 is the mission (rocket + name); it opens the site list. */
async function chooseSite(page: Page, id: string) {
  await page.getByTestId('mission').click()
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
    // All stations selected by default (the checklist lives in the Mission panel since Brief C3).
    await page.getByTestId('mission').click()
    await expect(page.getByTestId('mission-panel').getByRole('checkbox', { checked: true })).toHaveCount((await stationIds(page)).length)
  })

  test(`UX-01/02: Sun and Earth labels on their objects at ${vp.width} px`, async ({ page }) => {
    // Runs against C1's real scene (merged 14 Nov): labels follow scene.project().
    await page.setViewportSize(vp)
    await page.goto(`/?test=1${DEMO.slice(1)}`) // test=1 is a query parameter (scene debug API), the view state lives in the hash
    await expectAnswer(page, RIDGE, AUG, 60_000)
    await expect(page.getByTestId('label-site')).toBeVisible()
    await expect(page.getByTestId('label-site')).toHaveText('Landing site')
    // The scene loads its first frame after the answer appears and the camera may still be moving:
    // wait until it is ready, then require label visibility to agree with project() at the same moment.
    type DebugScene = { ready: Promise<void>; project(n: string): { visible: boolean } | null }
    await page.waitForFunction(() => (window as unknown as { __scene?: DebugScene }).__scene !== undefined)
    await page.evaluate(() => (window as unknown as { __scene: DebugScene }).__scene.ready)
    for (const name of ['sun', 'earth'] as const) {
      const label = page.getByTestId(`label-${name}`)
      const projected = () => page.evaluate((n) => (window as unknown as { __scene: DebugScene }).__scene.project(n)?.visible === true, name)
      await expect.poll(async () => (await projected()) === (await label.isVisible())).toBe(true)
      if (await projected()) await expect(label).toContainText(name === 'sun' ? /^Sun −?\d+\.\d°$/ : /^Earth −?\d+\.\d°$/)
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
  await page.getByTestId('details').click()
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
  await page.getByTestId('details').click()
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
  await page.getByTestId('mission').click()
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
  await page.getByTestId('mission').click()
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

// ---------- U6: greyed examples in the free-text fields; each is accepted exactly as shown ----------

test('U6: the examples in the search, name, date and point-name fields are accepted as typed', async ({ page }) => {
  await page.goto(`/#site=${RIDGE}&period=${SEP}`)
  await expectAnswer(page, RIDGE, SEP, 60_000)
  await page.getByTestId('mission').click()
  const panel = page.getByTestId('mission-panel')
  // Coordinates: Connecting Ridge, as sites.json and the header give them.
  const search = panel.getByRole('combobox', { name: 'Search a site or type coordinates' })
  await expect(search).toHaveAttribute('placeholder', `Site name, or e.g. ${EXAMPLE.coords}`)
  await search.fill(EXAMPLE.coords)
  await expect(panel.getByRole('status')).toContainText('89.46° S · 136.68° W')
  await expect(page.getByTestId('coords')).toHaveText('89.46° S · 136.68° W')
  await search.press('Enter') // typed coordinates add a point
  await expect(panel.getByTestId('point')).toHaveCount(1)
  // Point name.
  const pointName = panel.getByTestId('point').getByRole('textbox')
  await pointName.fill('')
  await expect(pointName).toHaveAttribute('placeholder', `e.g. ${EXAMPLE.point}`)
  await pointName.fill(EXAMPLE.point)
  await expect(panel.getByRole('button', { name: new RegExp(`^Select ${EXAMPLE.point},`) })).toBeVisible()
  // Mission name.
  const name = panel.getByLabel('Name', { exact: true })
  await name.fill('')
  await expect(name).toHaveAttribute('placeholder', `e.g. ${EXAMPLE.name}`)
  await name.fill(EXAMPLE.name)
  await expect(page.getByTestId('mission')).toHaveText(EXAMPLE.name)
  // Dates: from the September period, the Start example moves the mission to start on 16 Aug (its length kept), and
  // the End example makes it 16–29 Aug, the named August period.
  const start = panel.getByLabel('Start', { exact: true })
  const end = panel.getByLabel('End', { exact: true })
  await start.fill('')
  await expect(start).toHaveAttribute('placeholder', `e.g. ${EXAMPLE.start}`)
  await start.fill(EXAMPLE.start)
  await start.press('Enter')
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('from=2027-08-16T00:00Z')
  await end.fill('')
  await expect(end).toHaveAttribute('placeholder', `e.g. ${EXAMPLE.end}`)
  await end.fill(EXAMPLE.end)
  await end.press('Enter')
  await expect(end).toHaveValue(EXAMPLE.end)
  await expect(panel.getByRole('alert')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => location.hash)).toContain(`period=${AUG}`)
})

// ---------- U7: Sun and Earth paths over the mission on the horizon chart ----------

test('U7: the horizon chart draws each body\'s path over the mission, unbroken except at the north wrap, through its dot', async ({ page }) => {
  await page.goto(`${DEMO}&t=2027-08-20T06:00Z&drawer=details`)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  const strip = page.getByTestId('drawer').getByTestId('horizon-strip')
  const width = await strip.locator('svg').evaluate((e) => (e as SVGSVGElement).width.baseVal.value)
  for (const key of ['sun', 'earth']) {
    const track = strip.getByTestId(`strip-track-${key}`)
    const d = (await track.locator('path').evaluateAll((ps) => ps.map((p) => p.getAttribute('d') ?? ''))).join('')
    // Vertices and the segments between them ("L" continues, "M" lifts the pen).
    const cmds = [...d.matchAll(/([ML])(-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({ c: m[1], x: Number(m[2]), y: Number(m[3]) }))
    expect(cmds.length, `${key}: path vertices`).toBeGreaterThan(50)
    for (let i = 1; i < cmds.length; i++) if (cmds[i].c === 'L') expect(Math.abs(cmds[i].x - cmds[i - 1].x), `${key}: no line across the chart`).toBeLessThan(width / 2)
    // The dot at the cursor lies on its path (both from the same sample), unless it is pinned below the axis.
    const dot = strip.getByTestId(`strip-${key}`)
    if (!(await dot.getAttribute('class'))!.includes('is-below')) {
      const c = await dot.locator('circle').evaluate((e) => ({ x: Number(e.getAttribute('cx')), y: Number(e.getAttribute('cy')) }))
      expect(Math.min(...cmds.map((v) => Math.hypot(v.x - c.x, v.y - c.y))), `${key}: dot on its path`).toBeLessThan(0.1)
    }
  }
  // The part already passed is drawn fainter than the part still to come.
  const op = (sel: string) => strip.locator(`[data-testid=strip-track-sun] ${sel}`).evaluate((e) => Number(getComputedStyle(e).opacity))
  expect(await op('.is-past')).toBeLessThan(await op('.is-next'))
  await expect(strip).toContainText('lines: paths over the mission dates')
})

// ---------- D4, revised 14 Nov by ninja + Bene: four header controls (mission, date, Find better dates, Details); UI track 14 Nov: + Points of interest, Search ----------

for (const vp of VIEWPORTS) {
  test(`D4: header has 6 controls, main screen 10, one slider, no horizontal scroll at ${vp.width} px`, async ({ page }) => {
    await page.setViewportSize(vp)
    await page.goto(DEMO)
    await expectAnswer(page, RIDGE, AUG, 60_000)
    const header = page.locator('header.top')
    await expect(header.getByRole('button').or(header.getByRole('link'))).toHaveCount(6)
    // 6 in the header (mission, date, Points of interest, Search, Find better dates, Details) + "View" and
    // "Simulate" beside the timeline (Brief C4) + the footer's "how this is computed" and "Docs"; the answer line is
    // text, not a control.
    await expect(page.getByRole('button').or(page.getByRole('link'))).toHaveCount(10)
    await expect(page.getByTestId('details')).toHaveAccessibleName('Details')
    await expect(page.getByRole('slider')).toHaveCount(1)
    await noHorizontalScroll(page)
  })
}

test('answer sits in the timeline as text; Details opens the drawer; nothing on the screen can be highlighted', async ({ page }) => {
  await page.goto(DEMO)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  // The answer is one line of text inside the timeline, directly above the tracks: not a button, not a link.
  const answer = page.getByTestId('answer')
  await expect(page.locator('.timeline').getByTestId('answer')).toHaveCount(1)
  expect(await answer.evaluate((e) => e.tagName)).toBe('P')
  const a = (await answer.boundingBox())!
  const track = (await page.getByTestId('track-sun').boundingBox())!
  expect(a.y + a.height).toBeLessThanOrEqual(track.y)
  expect(track.y - (a.y + a.height)).toBeLessThan(40)
  expect(Math.abs(a.x - track.x)).toBeLessThan(2)
  await answer.click()
  await expect(page.getByTestId('drawer')).toBeHidden()
  // Dragging or select-all highlights nothing; form fields stay editable.
  expect(await page.evaluate(() => getComputedStyle(document.body).userSelect)).toBe('none')
  await page.keyboard.press('ControlOrMeta+a')
  expect(await page.evaluate(() => String(window.getSelection()))).toBe('')
  await page.getByTestId('mission').click()
  const name = page.getByTestId('mission-panel').getByLabel('Name', { exact: true })
  expect(await name.evaluate((e) => getComputedStyle(e).userSelect)).toBe('text')
  await page.keyboard.press('Escape')
  // The gear button top right opens the details drawer the answer used to open.
  const details = page.getByTestId('details')
  const box = (await details.boundingBox())!
  expect(box.x + box.width).toBeGreaterThan(page.viewportSize()!.width - 60)
  expect(box.y).toBeLessThan(60)
  await details.click()
  await expect(page.getByTestId('drawer')).toBeVisible()
})

// ---------- URL state, keys, drawer ----------

test('a copied link reproduces site, period, cursor, stations and drawer', async ({ page }) => {
  await page.goto(`/#site=${MASSIF}&period=malapert-2026-12&t=2026-12-22T06:30Z&st=madrid,canberra&drawer=details`)
  await expectAnswer(page, MASSIF, 'malapert-2026-12', 60_000)
  await expect(page.getByTestId('date')).toHaveText('22 December 2026, 06:30 UTC')
  const drawer = page.getByTestId('drawer')
  await expect(drawer).toBeVisible()
  const all = await stationIds(page)
  // The drawer shows the selected stations' states and links to the one checklist, in the Mission panel.
  await expect(drawer.locator('table.stations tbody tr')).toHaveCount(2)
  await drawer.getByRole('button', { name: 'Choose ground stations' }).click()
  const panel = page.getByTestId('mission-panel')
  await expect(panel.getByRole('checkbox')).toHaveCount(all.length)
  await expect(panel.getByRole('checkbox', { checked: true })).toHaveCount(2)
  await panel.getByRole('checkbox', { name: /Goldstone/ }).check()
  const sel = all.filter((id) => ['goldstone', 'madrid', 'canberra'].includes(id))
  // All stations selected is the default and leaves `st` out of the link.
  if (sel.length === all.length) await expect.poll(() => page.evaluate(() => location.hash)).not.toContain('st=')
  else await expect.poll(() => page.evaluate(() => location.hash)).toContain(`st=${sel.join(',')}`)
})

test('the drawer\'s "Terms of use" link opens the approved terms next to the sources', async ({ page }) => {
  await page.goto(`${DEMO}&drawer=details`)
  const drawer = page.getByTestId('drawer')
  await expect(drawer).toBeVisible()
  const link = drawer.getByRole('button', { name: 'Terms of use' })
  await expect(link).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('terms')).toHaveCount(0)
  await link.click()
  const terms = page.getByTestId('terms')
  await expect(link).toHaveAttribute('aria-expanded', 'true')
  await expect(terms.getByRole('heading', { name: 'Terms of use' })).toBeVisible()
  await expect(terms).toContainText('This app is not made, endorsed or reviewed by NASA or ESA.')
  await expect(terms).toContainText('Team SFZ | MEXG, via the NASA Space Apps Challenge 2026 project page.')
  await expect(terms).toBeInViewport()
  await link.click()
  await expect(page.getByTestId('terms')).toHaveCount(0)
})

// ---------- Mission layer (Brief C3) ----------

test('(e) mission: the name defaults to "Mission 1" and the goal to Consistent light; a copied link restores name and goal', async ({ page }) => {
  await page.goto(DEMO)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  await expect(page.getByTestId('mission')).toHaveText('Mission 1')
  await expect(page.getByTestId('mission')).toHaveAccessibleName('Mission 1')
  await expect.poll(() => page.evaluate(() => location.hash)).not.toContain('goal=')
  await expect.poll(() => page.evaluate(() => location.hash)).not.toContain('name=')

  await page.goto(`/#site=${MASSIF}&period=${SEP}&name=Ice%20survey%201&goal=cold-trap`)
  await expectAnswer(page, MASSIF, SEP, 60_000)
  await expect(page.getByTestId('mission')).toHaveText('Ice survey 1')
  await expect(page.getByTestId('site-name')).toHaveText('Malapert Massif')
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('name=Ice+survey+1')
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('goal=cold-trap')
  await page.getByTestId('mission').click()
  const panel = page.getByTestId('mission-panel')
  await expect(panel.getByLabel('Name', { exact: true })).toHaveValue('Ice survey 1')
  await expect(panel.getByRole('radio', { name: 'Cold traps (permanent shadow)' })).toBeChecked()
  // Editing the name in the panel changes the header and the link at once.
  await panel.getByLabel('Name', { exact: true }).fill('Rim survey')
  await expect(page.getByTestId('mission')).toHaveText('Rim survey')
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('name=Rim+survey')
  await panel.getByRole('radio', { name: 'Water ice and volatiles' }).check()
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('goal=water-ice')

  // Invalid values fall back to the defaults, like every other key; names are cut to 40 characters.
  await page.goto(`/#site=${RIDGE}&period=${AUG}&goal=biology&name=${'x'.repeat(45)}`)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  await expect(page.getByTestId('mission')).toHaveText('x'.repeat(40))
  await expect.poll(() => page.evaluate(() => location.hash)).not.toContain('goal=')
})

test('(f) mission: a name containing <script> renders as text', async ({ page }) => {
  const name = '<script>window.__pwned=1</script>'
  await page.goto(`/#site=${RIDGE}&period=${AUG}&name=${encodeURIComponent(name)}`)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  await expect(page.getByTestId('mission')).toHaveText(name)
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
  await expect(page.locator('header.top script')).toHaveCount(0)
})

/** summarize() for one site, period and all stations, computed in the page straight from geometry + data files. */
async function summarizeInPage(page: Page, siteId: string, periodId: string): Promise<{ litPct: number; coveragePct: number }> {
  return page.evaluate(`(async () => {
    const g = await import('/src/geometry/index.ts')
    const L = await import('/src/data/load.ts')
    const [sites, stations, periods] = await Promise.all([L.loadSites(), L.loadStations(), L.loadPeriods()])
    const site = sites.find((s) => s.id === ${JSON.stringify(siteId)})
    const p = periods.find((x) => x.id === ${JSON.stringify(periodId)})
    const startMs = Date.parse(p.start_utc), endMs = Date.parse(p.end_utc)
    const [h, months] = await Promise.all([L.loadHorizon(site.horizon), L.loadMonthsFor(startMs, endMs)])
    const series = g.computeSeries(months, { lat: site.lat, lon: site.lon, elev_m: site.elev_m }, h, stations, startMs, endMs)
    const s = g.summarize(series, stations.map((x) => x.id))
    return { litPct: s.litPct, coveragePct: s.coveragePct }
  })()`)
}

test('(c) panel: goal "Consistent light", 12–26 Sep 2027: every site once; first row matches summarize()', async ({ page }) => {
  const sites = await data<{ id: string }[]>(page, 'sites.json')
  await page.goto(DEMO)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  await page.getByTestId('mission').click()
  const panel = page.getByTestId('mission-panel')
  await expect(panel.getByLabel('Start', { exact: true })).toHaveValue('16 Aug 2027')
  await expect(panel.getByLabel('End', { exact: true })).toHaveValue('29 Aug 2027')
  // Start keeps the length (14 days), End sets it; 12–26 Sep 2027 is the named period shackleton-2027-09.
  await panel.getByLabel('Start', { exact: true }).fill('12 Sep 2027')
  await panel.getByLabel('Start', { exact: true }).press('Enter')
  await expect(panel.getByLabel('End', { exact: true })).toHaveValue('25 Sep 2027')
  await panel.getByLabel('End', { exact: true }).fill('26 Sep 2027')
  await panel.getByLabel('End', { exact: true }).press('Enter')
  await expect(page.getByTestId('date')).toHaveAttribute('data-period-id', SEP)
  await expectAnswer(page, RIDGE, SEP)
  await panel.getByRole('radio', { name: 'Consistent light' }).check()
  await expect(panel).toContainText('by share of the mission in sunlight, then the shortest longest darkness, then station coverage')

  await expect(panel.locator('[data-fact=computing]')).toHaveCount(0, { timeout: 60_000 })
  const listed = await panel.locator('[data-group] [role=option]').evaluateAll((els) => els.map((e) => e.id.replace('site-opt-', '')))
  expect(new Set(listed).size).toBe(listed.length)
  expect([...listed].sort()).toEqual(sites.map((s) => s.id).sort())
  for (const g of ['ranked', 'failed']) expect(await panel.locator(`[data-group=${g}] [role=option]`).count()).toBeGreaterThan(0)

  const first = panel.locator('[data-group=ranked] [role=option]').first()
  await expect(first).toHaveAttribute('data-rank', '1')
  const id = (await first.getAttribute('id'))!.replace('site-opt-', '')
  const ref = await summarizeInPage(page, id, SEP)
  await expect(first.locator('[data-fact=lit]')).toHaveText(`lit ${ref.litPct.toFixed(1)} %`)
  await expect(first.locator('[data-fact=comms]')).toHaveText(`comms ${ref.coveragePct.toFixed(1)} %`)
  // A site above the slope limit says so and is never ranked.
  await expect(panel.locator(`#site-opt-${SHACK} [data-fact=slope]`)).toHaveText('slope 31.8° — too steep')
  await expect(panel.locator(`#site-opt-${SHACK}`)).toHaveAttribute('data-rank', '')
  await expect(panel).not.toContainText(/optimal|safe to land/i)
})

test('panel: evidence goals show the evidence and say when station coverage decides', async ({ page }) => {
  await page.goto(`/#site=${RIDGE}&period=${AUG}&goal=water-ice`)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  await page.getByTestId('mission').click()
  const panel = page.getByTestId('mission-panel')
  await expect(panel.locator('[data-fact=computing]')).toHaveCount(0, { timeout: 60_000 })
  const ranked = panel.locator('[data-group=ranked] [role=option]')
  await expect(ranked.first().locator('[data-fact=evidence]')).toContainText(/^water ice: /)
  // With today's data every site that passes the slope limit shares one water-ice tier: coverage orders them.
  await expect(ranked.first().locator('[data-fact=then]')).toHaveText('then by station coverage')
  await expect(panel).not.toContainText('NaN')
})

test('panel: invalid mission dates are rejected with a message', async ({ page }) => {
  await page.goto(DEMO)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  await page.getByTestId('mission').click()
  const panel = page.getByTestId('mission-panel')
  const start = panel.getByLabel('Start', { exact: true })
  const end = panel.getByLabel('End', { exact: true })
  await start.fill('soon')
  await start.press('Enter')
  await expect(panel.getByRole('alert')).toHaveText('Start: enter a date such as 16 Aug 2027.')
  await start.fill('2035-01-01')
  await start.press('Enter')
  await expect(panel.getByRole('alert')).toHaveText('Dates from 1 November 2026 to 31 December 2030 (UTC) are supported.')
  await start.fill('16 Aug 2027')
  await start.press('Enter')
  await end.fill('10 Aug 2027')
  await end.press('Enter')
  await expect(panel.getByRole('alert')).toHaveText('End is before Start.')
  await end.fill('30 Nov 2027')
  await end.press('Enter')
  await expect(panel.getByRole('alert')).toHaveText('A mission can last at most 60 days.')
  await end.fill('2027-08-20')
  await end.press('Enter')
  await expect(panel.getByRole('alert')).toHaveCount(0)
  await expect(page.getByTestId('date')).toHaveAttribute('data-period-id', 'custom')
  await expectAnswer(page, RIDGE, 'custom')
  await expect(page.locator('body')).not.toContainText('NaN')
})

test('panel: Play mission goes to eye level at the mission start and plays', async ({ page }) => {
  await page.goto(`/#site=${RIDGE}&period=${AUG}&t=2027-08-22T06:00Z`)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  await page.getByTestId('mission').click()
  await page.getByTestId('mission-panel').getByRole('button', { name: 'Play mission' }).click()
  await expect(page.getByTestId('mission-panel')).toBeHidden()
  await expect(page.getByTestId('date')).toHaveText(/^16 August 2027, \d\d:\d0 UTC$/)
  await expect(page.getByTestId('date')).not.toHaveText('16 August 2027, 00:00 UTC')
  await page.keyboard.press('Space') // pause; the link is written once the cursor rests
  const paused = await page.getByTestId('date').innerText()
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('view=eye')
  await expect(page.getByTestId('date')).toHaveText(paused)
})

test('(d) slope warning: Shackleton Rim Site04 (31.8°) shows it, Connecting Ridge (3.7°) does not', async ({ page }) => {
  const sites = await data<{ id: string; slope_deg: number | null }[]>(page, 'sites.json')
  expect(sites.find((s) => s.id === SHACK)!.slope_deg).toBe(31.8)
  expect(sites.find((s) => s.id === RIDGE)!.slope_deg).toBe(3.7)
  await page.goto(DEMO)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  await expect(page.getByTestId('slope-warning')).toHaveCount(0)
  await chooseSite(page, SHACK)
  await expectAnswer(page, SHACK, AUG)
  await expect(page.getByTestId('slope-warning')).toHaveText('Landing not recommended: slope 31.8° over 100 m, limit 5°')
  // The warning is text, not a control: the header still has 6 controls and the main screen 10.
  await expect(page.locator('header.top').getByRole('button').or(page.locator('header.top').getByRole('link'))).toHaveCount(6)
  await expect(page.getByRole('button').or(page.getByRole('link'))).toHaveCount(10)
  await chooseSite(page, RIDGE)
  await expectAnswer(page, RIDGE, AUG)
  await expect(page.getByTestId('slope-warning')).toHaveCount(0)
})

test('timeline: three dimmed context days each side, a bracket with the mission, a date moves the cursor to noon', async ({ page }) => {
  await page.goto(`/#site=${RIDGE}&period=${AUG}&name=Ridge%20ops`)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  await expectTracks(page)
  const slider = page.getByRole('slider')
  await expect(slider).toHaveAttribute('aria-valuemin', String(Date.UTC(2027, 7, 16)))
  await expect(slider).toHaveAttribute('aria-valuemax', String(Date.UTC(2027, 7, 30)))
  const bracket = page.getByTestId('mission-bracket')
  await expect(bracket).toHaveText('Ridge ops, 14 days')
  // 13 Aug – 2 Sep shown (20 days): the mission starts 3/20 in and covers 14/20.
  const s = (await slider.boundingBox())!
  const b = (await bracket.boundingBox())!
  expect(Math.abs((b.x - s.x) / s.width - 3 / 20)).toBeLessThan(0.005)
  expect(Math.abs(b.width / s.width - 14 / 20)).toBeLessThan(0.005)
  for (const id of ['track-sun', 'track-comms']) await expect(page.getByTestId(id).locator('.tl-veil')).toHaveCount(2)

  const day = page.locator('.tl-tick.is-day').nth(1)
  const label = await day.innerText() // e.g. "18 Aug"
  await day.click()
  await expect(page.getByTestId('date')).toHaveText(`${label.replace(/ (\w{3})$/, '')} August 2027, 12:00 UTC`)
  // Dragging into the context days keeps the cursor inside the mission.
  await page.mouse.click(s.x + 4, s.y + 10)
  await expect(page.getByTestId('date')).toHaveText('16 August 2027, 00:00 UTC')
})

test('globe: clicking a site pin selects that site', async ({ page }) => {
  type DebugScene = {
    ready: Promise<void>
    level(): string
    setView(o: Record<string, unknown>): Promise<unknown>
    projectPin(id: string): { x: number; y: number; visible: boolean } | null
  }
  const target = 'haworth' // far from every other pin
  const site = (await data<{ id: string; lat: number; lon: number }[]>(page, 'sites.json')).find((s) => s.id === target)!
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/?test=1${DEMO.slice(1)}`)
  await expectAnswer(page, RIDGE, AUG, 60_000)
  await page.waitForFunction(() => (window as unknown as { __scene?: DebugScene }).__scene !== undefined)
  await page.evaluate(() => (window as unknown as { __scene: DebugScene }).__scene.ready)
  await page.keyboard.press('Escape') // site level → globe
  await expect.poll(() => page.evaluate(() => (window as unknown as { __scene: DebugScene }).__scene.level())).toBe('globe')
  await page.waitForTimeout(1_800) // the 1.5 s fly-out
  // Camera straight above the pin, so its head projects onto its foot point.
  await page.evaluate(([lat, lon]) => (window as unknown as { __scene: DebugScene }).__scene.setView({ level: 'globe', el: lat, az: lon }), [site.lat, site.lon])
  const pt = await page.evaluate((id) => (window as unknown as { __scene: DebugScene }).__scene.projectPin(id), target)
  expect(pt?.visible).toBe(true)
  await page.mouse.click(pt!.x, pt!.y)
  await expectAnswer(page, target, AUG)
  await expect(page.getByTestId('site-name')).toHaveText('Haworth')
  await expect.poll(() => page.evaluate(() => location.hash)).not.toContain('view=globe')
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
  await page.getByTestId('details').click()
  const drawer = page.getByTestId('drawer')
  await expect(drawer.getByRole('heading', { name: 'Stations' })).toBeVisible()
  const n = (await stationIds(page)).length
  await expect(drawer.locator('table.stations tbody tr')).toHaveCount(n)
  await expect(drawer).toContainText(`${n} of ${n} stations selected.`)
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
    await page.getByTestId('mission').click()
    const panel = page.getByTestId('mission-panel')
    await expect(panel.locator('[data-fact=computing]')).toHaveCount(0, { timeout: 60_000 })
    await shot('panel')
    await panel.getByRole('heading', { name: 'Landing site' }).evaluate((h) => h.scrollIntoView({ block: 'start' }))
    await shot('panel-sites')
    await page.keyboard.press('Escape')
    // A site that fails the slope limit: the warning line sits above the answer.
    await chooseSite(page, SHACK)
    await expectAnswer(page, SHACK, AUG)
    await shot('main-steep')
    await chooseSite(page, RIDGE)
    await expectAnswer(page, RIDGE, AUG)
    await page.getByTestId('details').click()
    await expect(page.getByTestId('drawer')).toBeVisible()
    await shot('drawer')
    await page.getByTestId('drawer').getByRole('heading', { name: 'Compare' }).scrollIntoViewIfNeeded()
    await shot('drawer-compare')
    await page.getByTestId('drawer').getByRole('heading', { name: 'How this is computed' }).scrollIntoViewIfNeeded()
    await shot('drawer-sources')
  })
}
