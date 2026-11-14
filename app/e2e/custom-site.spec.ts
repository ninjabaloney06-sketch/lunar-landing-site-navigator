// Custom landing sites (wave 3, E1): a place inside the pin region becomes the landing site, with its numbers
// computed by the app's own functions on the browser horizon of the south cap (data/southcap.capHorizon), labelled
// approximate from the resolution that horizon actually used. Run: PW_PORT=5182 npx playwright test e2e/custom-site.spec.ts --workers=1
//
// The test place, 89.47° S 136.78° W, lies 1 km from Connecting Ridge on a slope of about 1° (capHorizon, 14 Nov
// 2026), so its slope passes the limit and the slope line is the custom one, not the warning.
import { expect, test, type Page } from '@playwright/test'
import { PIN_REGION_NORTH_LAT } from '../src/scene3d/region'

const RIDGE = 'connecting-ridge'
const AUG = 'shackleton-2027-08'
const PLACE = { text: '89.47 S, 136.78 W', lat: -89.47, lon: -136.78, id: 'cap:-89.47000,-136.78000', shown: '89.47° S · 136.78° W' }
const REGION_TEXT = `south of ${Math.abs(PIN_REGION_NORTH_LAT)}° S`

type Pt = { x: number; y: number; visible: boolean }
type SceneDebug = { ready: Promise<void>; projectMark(i: number): Pt | null; setView(o: Record<string, unknown>): Promise<unknown> }

async function openApp(page: Page, hash: string) {
  await page.goto(`/?test=1#${hash}`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await page.evaluate(() => (window as unknown as { __scene: SceneDebug }).__scene.ready)
}

async function openPanel(page: Page) {
  await page.getByTestId('mission').click()
  const panel = page.getByTestId('mission-panel')
  await expect(panel).toBeVisible()
  return panel
}

const hashSite = (page: Page) => page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('site'))

/** The series the answer uses (data/results, the app's own module instance and cache) and an independent one:
 *  geometry.computeSeries on capHorizon for the same place, summarized. */
async function seriesFacts(page: Page, id: string, startMs: number, endMs: number) {
  return page.evaluate(`(async () => {
    const R = await import('/src/data/results.ts')
    const C = await import('/src/data/customSite.ts')
    const S = await import('/src/data/southcap.ts')
    const L = await import('/src/data/load.ts')
    const g = await import('/src/geometry/index.ts')
    const stations = await L.loadStations()
    const ids = stations.map((s) => s.id)
    const site = C.customSiteBase(${JSON.stringify(id)})
    const r = await R.computeResults({ site, stations, ids, startMs: ${startMs}, endMs: ${endMs} })
    const h = r.series.horizon
    const ref = await S.capHorizon(site.lat, site.lon)
    const months = await L.loadMonthsFor(${startMs}, ${endMs})
    const own = g.summarize(g.computeSeries(months, { lat: site.lat, lon: site.lon, elev_m: ref.elev_m }, ref, stations, ${startMs}, ${endMs}), ids)
    return { n: h.mask.length, computed: h.computed ?? null, siteId: h.site_id, litPct: r.summary.litPct, ownLitPct: own.litPct, ownCoveragePct: own.coveragePct, coveragePct: r.summary.coveragePct, slope: ref.slope_deg, elev: ref.elev_m }
  })()`) as Promise<{
    n: number
    computed: { site_res_m: number; near_res_m: number; far_res_m: number; rings: { nearKm: number } } | null
    siteId: string
    litPct: number
    coveragePct: number
    ownLitPct: number
    ownCoveragePct: number
    slope: number
    elev: number
  }>
}

test.describe('custom landing site at 1440 × 900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('typed coordinates inside the cap become the landing site, with computed and labelled values; the link reopens it', async ({ page }) => {
    test.setTimeout(240_000)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await openApp(page, `site=${RIDGE}&period=${AUG}`)
    // A prepared site: no custom line, the footer's fixed terrain text.
    await expect(page.getByTestId('custom-note')).toHaveCount(0)
    await expect(page.getByTestId('foot-sources')).toContainText('Terrain LOLA 20 m (160 m beyond 20 km) · ephemeris JPL DE440')

    const panel = await openPanel(page)
    const search = panel.getByRole('combobox', { name: 'Search a site or type coordinates' })
    await search.fill(PLACE.text)
    await expect(panel.getByRole('status')).toContainText(PLACE.shown)
    await panel.getByTestId('set-site').click()
    await expect(panel).toHaveCount(0)
    await expect.poll(() => hashSite(page)).toBe(PLACE.id)
    await expect(page.getByTestId('site-name')).toHaveText('Custom site')
    await expect(page.getByTestId('coords')).toHaveText(PLACE.shown)

    // Answer and timeline: ready for this site, with values.
    const answer = page.getByTestId('answer')
    await expect(answer).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
    await expect(answer).toHaveAttribute('data-site-id', PLACE.id)
    await expect(answer.locator('.answer-sun')).not.toBeEmpty()
    await expect(answer.locator('.answer-comms')).not.toBeEmpty()
    for (const id of ['track-sun', 'track-comms']) {
      await expect(page.getByTestId(id)).toHaveAttribute('data-ready', 'true')
      expect(await page.getByTestId(id).locator('.seg').count()).toBeGreaterThan(0)
    }

    // The horizon used is capHorizon's: 720 values, marked as computed in the browser, for this id; the values equal
    // an independent computeSeries on capHorizon.
    const p = (await (await page.request.get('/data/periods.json')).json()).find((x: { id: string }) => x.id === AUG)
    const f = await seriesFacts(page, PLACE.id, Date.parse(p.start_utc), Date.parse(p.end_utc))
    expect(f.n).toBe(720)
    expect(f.computed).not.toBeNull()
    expect(f.siteId).toBe(PLACE.id)
    expect(f.litPct).toBe(f.ownLitPct)
    expect(f.coveragePct).toBe(f.ownCoveragePct)

    // Slope line and the approximate line, built from computed.
    const res = [...new Set([f.computed!.site_res_m, f.computed!.near_res_m])].map((v) => `${v} m`).join(' / ')
    const approx = `Approximate: from ${res} terrain, not validated.`
    expect(f.slope).toBeLessThanOrEqual(5)
    await expect(page.getByTestId('custom-slope')).toHaveText(`Slope ${f.slope.toFixed(1)}° over 100 m, limit 5°.`)
    await expect(page.getByTestId('slope-warning')).toHaveCount(0)
    await expect(page.getByTestId('approx-note')).toHaveText(approx)
    await expect(page.getByTestId('foot-sources')).toContainText(`Terrain LOLA ${res} (${f.computed!.far_res_m} m beyond ${f.computed!.rings.nearKm} km) · ephemeris JPL DE440`)
    await expect(page.getByTestId('foot-sources')).not.toContainText('20 m (160 m')
    await expect(page.locator('body')).not.toContainText('NaN')

    // Screenshot at site level, once the scene has the custom terrain.
    await expect(page.getByTestId('label-site')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('scene-stale')).toHaveCount(0)
    await page.waitForTimeout(1500)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: 'test-results/custom-site-1440.png', animations: 'disabled' })

    // Details: the horizon chart and the computed values, the approximate line, the terrain text from computed.
    await page.getByTestId('details').click()
    const drawer = page.getByTestId('drawer')
    await expect(drawer.getByRole('heading', { level: 2 })).toHaveText('Custom site')
    await expect(drawer.getByTestId('drawer-approx-note')).toHaveText(approx)
    await expect(drawer.getByTestId('horizon-strip').locator('svg')).toBeVisible()
    await expect(drawer.getByTestId('compare-table').locator('tbody tr').first().locator('td').first()).toHaveText(`${f.litPct.toFixed(1)} %`)
    const terrain = drawer.getByTestId('custom-terrain')
    await expect(terrain).toContainText(`${f.computed!.site_res_m} m at the site, up to ${f.computed!.near_res_m} m within ${f.computed!.rings.nearKm} km`)
    await expect(terrain).not.toContainText('20 m per pixel')
    await expect(drawer).toContainText("Frame: the user's own coordinates; MOON_ME assumed.")
    // The finder runs on the same horizon.
    await drawer.getByRole('button', { name: 'Find dates' }).click()
    await expect(drawer.locator('.finder-results')).toBeVisible({ timeout: 60_000 })
    await expect(drawer.locator('.finder')).not.toContainText('failed')
    await drawer.getByRole('button', { name: 'Close' }).first().click()

    // The link reopens it.
    const link = await page.evaluate(() => location.href)
    await page.goto('about:blank')
    await page.goto(link)
    await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
    await expect(page.getByTestId('answer')).toHaveAttribute('data-site-id', PLACE.id)
    await expect(page.getByTestId('site-name')).toHaveText('Custom site')
    await expect(page.getByTestId('coords')).toHaveText(PLACE.shown)
    await expect(page.getByTestId('approx-note')).toHaveText(approx)
    expect(errors).toEqual([])
  })

  test('a user point inside the cap: its row and the right-click menu on its marker set it as the landing site', async ({ page }) => {
    test.setTimeout(240_000)
    await openApp(page, `site=${RIDGE}&period=${AUG}&pts=${PLACE.lat},${PLACE.lon},,Ridge%20camp`)
    // Right-click on the marker (hovered first, as a mouse does): the menu names the point.
    const mark = (await page.evaluate(() => (window as unknown as { __scene: SceneDebug }).__scene.projectMark(0)))!
    expect(mark, 'the marker is on screen at site level').not.toBeNull()
    expect(mark.visible).toBe(true)
    await page.mouse.move(mark.x, mark.y)
    await expect(page.getByTestId('pin-name')).toHaveText('Ridge camp')
    await page.mouse.click(mark.x, mark.y, { button: 'right' })
    const menu = page.getByTestId('scene-menu')
    await expect(menu.getByRole('menuitem')).toHaveText(['Add point here', 'Set Ridge camp as landing site', 'Moon', 'Point start', 'Point end', 'Earth', 'Sun', 'Solar system — top view'])
    await menu.getByRole('menuitem', { name: 'Set Ridge camp as landing site' }).click()
    await expect.poll(() => hashSite(page)).toBe(PLACE.id)
    await expect(page.getByTestId('answer')).toHaveAttribute('data-site-id', PLACE.id, { timeout: 60_000 })

    // Back to the ridge, then the same through the point's row in the Mission panel.
    await page.evaluate((r) => (location.hash = `site=${r}&period=shackleton-2027-08&pts=-89.47,-136.78,,Ridge%20camp`), RIDGE)
    await expect(page.getByTestId('site-name')).toHaveText('Connecting Ridge')
    const panel = await openPanel(page)
    const row = panel.getByTestId('point')
    await expect(row.locator('[data-fact=none]')).toHaveText('No terrain data for this point')
    await row.getByRole('button', { name: 'Set as landing site: Ridge camp' }).click()
    await expect.poll(() => hashSite(page)).toBe(PLACE.id)
    await expect(page.getByTestId('site-name')).toHaveText('Custom site')
  })

  test('outside the cap no such action is offered, with the reason; a prepared site keeps its texts', async ({ page }) => {
    await openApp(page, `site=${RIDGE}&period=${AUG}&pts=45,10,,North`)
    const panel = await openPanel(page)
    const search = panel.getByRole('combobox', { name: 'Search a site or type coordinates' })
    await search.fill('75 S, 10 E')
    await expect(panel.getByRole('status')).toContainText('75.00° S · 10.00° E')
    await expect(panel.getByTestId('set-site')).toHaveCount(0)
    await expect(panel.getByTestId('set-site-none')).toHaveText(`Landing sites can be set only ${REGION_TEXT}.`)
    await expect(panel.getByTestId('add-point')).toBeVisible() // a point can still be added
    // A point outside the cap: its row has the reason, not the action.
    const row = panel.getByTestId('point')
    await expect(row.getByTestId('point-set-site')).toHaveCount(0)
    await expect(row).toContainText(`Landing sites can be set only ${REGION_TEXT}.`)
    // A link with a custom id outside the cap opens the default site.
    await page.goto(`/?test=1#site=cap:-70.00000,10.00000&period=${AUG}`)
    await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
    await expect(page.getByTestId('site-name')).toHaveText('Connecting Ridge')
    await expect(page.getByTestId('foot-sources')).toContainText('Terrain LOLA 20 m (160 m beyond 20 km) · ephemeris JPL DE440 ·')
    await page.getByTestId('details').click()
    await expect(page.getByTestId('drawer')).toContainText('Terrain: LOLA south-pole elevation model, 20 m per pixel within 20 km of the site and 160 m averages')
    await expect(page.getByTestId('drawer-approx-note')).toHaveCount(0)
  })
})

test('custom site at 375 × 812: no horizontal scroll, the lines wrap', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await openApp(page, `site=${PLACE.id}&period=${AUG}`)
  await expect(page.getByTestId('approx-note')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.screenshot({ path: 'test-results/custom-site-375.png', animations: 'disabled' })
})
