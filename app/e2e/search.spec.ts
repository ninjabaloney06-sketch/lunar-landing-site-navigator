// Site search (U4): opened from the top bar; every site of sites.json is listed (plus the POI points of
// search-sites.json when the build has that file); the best ones are marked and come first; counts, sunlight and
// coverage are checked against a hand count and against the table's own computation.
// Run: PW_PORT=5182 npx playwright test e2e/search.spec.ts --workers=1
import { expect, test, type Page } from '@playwright/test'
import type { Poi } from '../src/data/pois'
import { PIN_REGION_NORTH_LAT } from '../src/scene3d/region'

const RIDGE = 'connecting-ridge'
const AUG = 'shackleton-2027-08'
const DEMO = `site=${RIDGE}&period=${AUG}`

type SiteRef = { id: string; name: string; lat: number; lon: number; slope_deg: number | null; horizon: string | null }

async function data<T>(page: Page, file: string): Promise<T> {
  return (await (await page.request.get(`/data/${file}`)).json()) as T
}

async function openSearch(page: Page, hash = DEMO) {
  await page.goto(`/#${hash}`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  const t0 = Date.now()
  await page.getByTestId('search-open').click()
  const panel = page.getByTestId('search')
  await expect(panel).toBeVisible()
  await expect(panel.getByTestId('search-results')).toHaveAttribute('data-ordered', 'true', { timeout: 120_000 })
  return { panel, ms: Date.now() - t0 }
}

const row = (page: Page, id: string) => page.getByTestId('search-results').locator(`li[data-site-id="${id}"]`)
const count = (page: Page, id: string, group: string) => row(page, id).locator(`.search-count[data-group="${group}"] .mono`)

/** summarize() for one site and the mission dates, straight from geometry + the data files (as table.spec does). */
async function reference(page: Page, siteId: string, startMs: number, endMs: number) {
  return page.evaluate(`(async () => {
    const g = await import('/src/geometry/index.ts')
    const L = await import('/src/data/load.ts')
    const [sites, stations] = await Promise.all([L.loadSites(), L.loadStations()])
    const site = sites.find((s) => s.id === ${JSON.stringify(siteId)})
    const months = await L.loadMonthsFor(${startMs}, ${endMs})
    const h = await L.loadHorizon(site.horizon)
    const series = g.computeSeries(months, { lat: site.lat, lon: site.lon, elev_m: site.elev_m }, h, stations, ${startMs}, ${endMs})
    return g.summarize(series, stations.map((x) => x.id))
  })()`) as Promise<{ litPct: number; coveragePct: number }>
}

test.describe('search at 1440 × 900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('lists all 18 sites without search-sites.json, marks the best first, and matches a hand count and the table', async ({ page }) => {
    const sites = await data<SiteRef[]>(page, 'sites.json')
    expect(sites).toHaveLength(18)
    // The build without search-sites.json (this branch today; forced here so the test keeps meaning once it exists).
    await page.route('**/data/search-sites.json', (r) => r.fulfill({ status: 404, body: '' }))
    const { panel } = await openSearch(page)
    const items = panel.getByTestId('search-results').locator('li')
    await expect(items).toHaveCount(18)
    expect((await items.evaluateAll((li) => li.map((x) => x.getAttribute('data-site-id')))).sort()).toEqual(sites.map((s) => s.id).sort())

    // The rule is written on screen; the best ones are marked and listed first, and each passes the slope limit.
    await expect(panel.getByTestId('search-rule')).toContainText('Places that pass the 5° slope limit first')
    await expect(panel.getByTestId('search-rule')).toContainText('within 20 km')
    const best = await items.evaluateAll((li) => li.map((x) => x.getAttribute('data-best') === 'true'))
    expect(best.filter(Boolean).length).toBeGreaterThanOrEqual(1)
    expect(best.indexOf(false)).toBe(best.filter(Boolean).length) // every best row precedes every other row
    for (const id of await items.evaluateAll((li) => li.filter((x) => x.getAttribute('data-best') === 'true').map((x) => x.getAttribute('data-site-id')!))) {
      const s = sites.find((x) => x.id === id)!
      expect(s.slope_deg, id).not.toBeNull()
      expect(s.slope_deg!, id).toBeLessThanOrEqual(5)
      await expect(row(page, id).getByText('Best', { exact: true })).toBeVisible()
    }

    // Hand count, defaults (water, permanent shadow, science; 20 km). Connecting Ridge (89.46° S, 136.68° W) has,
    // in pois.json and by great-circle distance on the 1737.4 km sphere:
    //   science:feat_connecting_ridge_junction 8.91 km, science:feat_shackleton 19.71 km, science:age_shackleton
    //   19.71 km, cold-trap:host_shackleton 19.71 km; cold-trap:atlas_13 (Shackleton atlas PSR) is 20.38 km away,
    //   just outside; no water record within 20 km. Its own record landing:connecting_ridge is not counted.
    await expect(count(page, RIDGE, 'water')).toHaveText('0')
    await expect(count(page, RIDGE, 'cold-trap')).toHaveText('1')
    await expect(count(page, RIDGE, 'science')).toHaveText('3')
    // 21 km takes in atlas_13 as well.
    await panel.getByLabel('Within, km').fill('21')
    await expect(count(page, RIDGE, 'cold-trap')).toHaveText('2')
    await panel.getByLabel('Within, km').fill('20')
    await expect(count(page, RIDGE, 'cold-trap')).toHaveText('1')

    // Sunlit and coverage are the table's values (summarize over the mission dates, all stations).
    const p = (await data<{ id: string; start_utc: string; end_utc: string }[]>(page, 'periods.json')).find((x) => x.id === AUG)!
    const ref = await reference(page, RIDGE, Date.parse(p.start_utc), Date.parse(p.end_utc))
    await expect(row(page, RIDGE).locator('[data-col=lit] .mono')).toHaveText(`${ref.litPct.toFixed(1)} %`)
    await expect(row(page, RIDGE).locator('[data-col=comms] .mono')).toHaveText(`${ref.coveragePct.toFixed(1)} %`)
    // A site above the limit shows "too steep", is not ranked while the filter is on, and is ranked without it.
    await expect(row(page, 'shackleton-rim-site04')).toContainText('31.8° — too steep')
    await expect(row(page, 'shackleton-rim-site04')).toHaveAttribute('data-rank', '')
    await panel.getByLabel('Must pass the 5° slope limit').uncheck()
    await expect(panel.getByTestId('search-rule')).not.toContainText('slope limit')
    await expect(row(page, 'shackleton-rim-site04')).not.toHaveAttribute('data-rank', '')
    await panel.getByLabel('Must pass the 5° slope limit').check()

    // Selecting a row selects that site and shows the chosen groups on the scene.
    await row(page, 'malapert-massif').getByRole('button', { name: 'Select' }).click()
    await expect(page.getByTestId('search')).toHaveCount(0)
    await expect(page.getByTestId('site-name')).toHaveText('Malapert Massif')
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('poi=water,cold-trap,science')
    await expect(page.getByTestId('poi-toggle')).toHaveAttribute('aria-pressed', 'true')
  })

  test('with search-sites.json (fixture of every in-region POI point) the POI points are listed once each, never count themselves, and the time is measured', async ({ page }) => {
    const [pois, sites] = await Promise.all([data<Poi[]>(page, 'pois.json'), data<SiteRef[]>(page, 'sites.json')])
    const siteIds = new Set(sites.map((s) => s.id))
    const template = sites.find((s) => s.id === RIDGE)!
    // Same shape as the terrain track's file: a Site plus poi_id, id "poi-<group>-<record id>", one horizon each.
    const fixture = pois.map((p) => {
      const [group, rec] = p.id.split(':')
      const id = `poi-${group}-${rec.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      return { ...template, id, name: p.name, lat: p.lat, lon: p.lon, slope_deg: 2.0, horizon: `${id}.json`, label: null, potential: [], poi_id: p.id }
    })
    const horizon = await (await page.request.get(`/data/horizons/${template.horizon}`)).text()
    await page.route('**/data/search-sites.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture) }))
    await page.route('**/data/horizons/poi-*.json', (r) => r.fulfill({ contentType: 'application/json', body: horizon }))
    const inRegion = pois.filter((p) => p.lat <= PIN_REGION_NORTH_LAT)
    const expected = sites.length + inRegion.filter((p) => !(p.siteId && siteIds.has(p.siteId))).length

    const { panel, ms } = await openSearch(page)
    test.info().annotations.push({ type: 'search time', description: `${expected} places computed and ranked in ${ms} ms (mission dates, 14 days)` })
    console.log(`search: ${expected} places computed and ranked in ${ms} ms`)
    const items = panel.getByTestId('search-results').locator('li')
    await expect(items).toHaveCount(expected)
    // A POI that is an app site appears once, as the site; a POI outside the pin region is not a candidate.
    await expect(row(page, 'poi-landing-connecting-ridge')).toHaveCount(0)
    const north = pois.find((p) => p.lat > PIN_REGION_NORTH_LAT)!
    await expect(panel.locator(`li[data-site-id^="poi-"][data-site-id$="${north.id.split(':')[1].toLowerCase().replace(/[^a-z0-9]+/g, '-')}"]`)).toHaveCount(0)
    // The point made from science:feat_shackleton stands on the same spot as science:age_shackleton: it counts that
    // one, never itself.
    const own = row(page, 'poi-science-feat-shackleton')
    await expect(own).toContainText('Science features point')
    await panel.getByLabel('Within, km').fill('1')
    await expect(own.locator('.search-count[data-group="science"] .mono')).toHaveText('1')
    // "Show" turns the layer on with the chosen groups and that point's group, and goes to the globe.
    await own.getByRole('button', { name: 'Show' }).click()
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('view=globe')
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('poi=water,cold-trap,science')
  })
})

for (const vp of [
  { width: 1440, height: 900, tag: '1440' },
  { width: 375, height: 812, tag: '375' },
]) {
  test(`search screenshot and no horizontal scroll at ${vp.tag} px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    const { panel } = await openSearch(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await expect(panel.locator('li[data-best="true"]').first()).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `test-results/search-${vp.tag}.png`, animations: 'disabled' })
    await panel.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByTestId('search')).toHaveCount(0)
  })
}
