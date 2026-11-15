// Drawer content (U4) and the Time periods menu (U3). Expected values are computed in the page from geometry +
// the data files, never typed in. Run: PW_GPU=1 PW_PORT=5185 npx playwright test e2e/dates.spec.ts
import { expect, test, type Page } from '@playwright/test'

const RIDGE = 'connecting-ridge'
const MASSIF = 'malapert-massif'
const AUG = 'shackleton-2027-08'
const MISSIONS_KEY = 'llsn.missions.v1'

async function seedMissions(page: Page, hashes: string[]) {
  await page.addInitScript(
    ([key, list]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(key as string, JSON.stringify(list))
        sessionStorage.setItem('seeded', '1')
      }
    },
    [MISSIONS_KEY, hashes] as const,
  )
}

async function open(page: Page, hash: string) {
  await page.goto(`/?test=1#${hash}`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
}

/** Sunlit and in-contact window counts for a site over [startMs, endMs), all stations. */
async function windowCounts(page: Page, siteId: string, startMs: number, endMs: number) {
  return page.evaluate(`(async () => {
    const g = await import('/src/geometry/index.ts')
    const L = await import('/src/data/load.ts')
    const [sites, stations] = await Promise.all([L.loadSites(), L.loadStations()])
    const site = sites.find((s) => s.id === ${JSON.stringify(siteId)})
    const h = await L.loadHorizon(site.horizon)
    const months = await L.loadMonthsFor(${startMs}, ${endMs})
    const series = g.computeSeries(months, { lat: site.lat, lon: site.lon, elev_m: site.elev_m }, h, stations, ${startMs}, ${endMs})
    const ids = stations.map((x) => x.id)
    return {
      lit: g.windows(series, 'sun').filter((w) => w.state === 'lit').length,
      covered: g.windows(series, 'coverage', ids).filter((w) => w.state === 'covered').length,
    }
  })()`) as Promise<{ lit: number; covered: number }>
}

test.describe('U4: the drawer starts with the date search, then the year timeline', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('order of sections; one bar row per location; Light | Communication and the year change the bars', async ({ page }) => {
    test.setTimeout(120_000)
    await seedMissions(page, [`site=${MASSIF}&period=shackleton-2027-09&name=Massif%20survey`, `site=${RIDGE}&period=shackleton-2027-09&name=Ridge%20ops`])
    await open(page, `site=${RIDGE}&period=${AUG}`)
    await page.getByTestId('details').click()
    const drawer = page.getByTestId('drawer')
    // 15 Nov, team request: the date search and the year timeline are the drawer's Dates tab (before: its first two
    // sections, above Horizon).
    await page.getByTestId('drawer-tab-dates').click()
    const headings = await drawer.locator('section.drawer-sec > h3').allInnerTexts()
    expect(headings).toEqual(['Find better dates', 'Year timeline'])
    expect(headings).not.toContain('Simulation')

    const yt = drawer.getByTestId('year-timeline')
    await expect(yt.getByTestId('year-kind').locator('option')).toHaveText(['Sunlight', 'Station contact'])
    await expect(yt.getByTestId('year-select').locator('option')).toHaveText(['2026', '2027', '2028', '2029', '2030'])
    await expect(yt.getByTestId('year-select')).toHaveValue('2027')
    await expect(yt.locator('.yt-month')).toHaveCount(12)
    // The current site first, then each saved mission's site once (Ridge ops is at the current site).
    const rows = yt.getByTestId('year-row')
    await expect(rows).toHaveCount(2)
    expect(await rows.evaluateAll((rs) => rs.map((r) => r.getAttribute('data-site-id')))).toEqual([RIDGE, MASSIF])
    await expect(rows.nth(0)).toHaveAttribute('data-state', 'done', { timeout: 60_000 })
    await expect(rows.nth(1)).toHaveAttribute('data-state', 'done', { timeout: 60_000 })
    // The current mission and Ridge ops are outlined on the Ridge row, Massif survey on the Massif row.
    await expect(rows.nth(0).locator('.yt-mission')).toHaveCount(2)
    await expect(rows.nth(1).locator('.yt-mission')).toHaveAttribute('title', 'Massif survey')

    const y2027 = await windowCounts(page, RIDGE, Date.UTC(2027, 0, 1), Date.UTC(2028, 0, 1))
    await expect(rows.nth(0).getByTestId('year-seg')).toHaveCount(y2027.lit)
    await expect(rows.nth(0).locator('.yt-bar')).toHaveAttribute('aria-label', /^Connecting Ridge: sunlit \d+ % of 2027$/)
    await yt.getByTestId('year-kind').selectOption('comms')
    await expect(rows.nth(0).getByTestId('year-seg')).toHaveCount(y2027.covered)
    await expect(rows.nth(0).locator('.yt-bar')).toHaveClass(/is-comms/)

    // 2026: data from 1 Nov only; the months before are marked as no data, every bar starts inside the data.
    await yt.getByTestId('year-select').selectOption('2026')
    await expect(rows.nth(0)).toHaveAttribute('data-state', 'done', { timeout: 60_000 })
    const y2026 = await windowCounts(page, RIDGE, Date.UTC(2026, 10, 1), Date.UTC(2027, 0, 1))
    await expect(rows.nth(0).getByTestId('year-seg')).toHaveCount(y2026.covered)
    await expect(rows.nth(0).locator('.yt-nodata')).toHaveCount(1)
    const lefts = await rows.nth(0).getByTestId('year-seg').evaluateAll((s) => s.map((e) => parseFloat((e as HTMLElement).style.left)))
    const nov1 = (100 * (Date.UTC(2026, 10, 1) - Date.UTC(2026, 0, 1))) / (Date.UTC(2027, 0, 1) - Date.UTC(2026, 0, 1))
    for (const l of lefts) expect(l).toBeGreaterThanOrEqual(nov1 - 1e-9)
  })

  test('horizon chart: each elevation shown once; the Sun and Earth labels clear the terrain and each other', async ({ page }) => {
    // Sweep item 22: at this time the chart showed "Sun −0.2°" over the skyline, the caption "el −0.15°" again.
    for (const [site, t] of [
      [RIDGE, '2027-08-16T00:00Z'],
      [MASSIF, '2027-08-20T06:00Z'],
      ['haworth', '2027-08-18T12:00Z'],
    ] as const) {
      await open(page, `site=${site}&period=${AUG}&t=${t}&drawer=details`)
      const strip = page.getByTestId('drawer').getByTestId('horizon-strip')
      await expect(strip.getByTestId('strip-sun')).toContainText(/Sun −?\d+\.\d°/)
      await expect(strip.locator('figcaption')).not.toContainText('el ')
      const r = await strip.locator('svg').evaluate((svg) => {
        const terrain = svg.querySelector('.strip-terrain') as SVGPathElement
        const box = (k: string) => (svg.querySelector(`[data-testid="strip-${k}"] text`) as SVGTextElement).getBBox()
        const sun = box('sun')
        const earth = box('earth')
        const inTerrain = (b: DOMRect) =>
          [b.x + 1, b.x + b.width / 2, b.x + b.width - 1].some((px) => terrain.isPointInFill(new DOMPoint(px, b.y + b.height - 3)))
        const overlap = sun.x < earth.x + earth.width && earth.x < sun.x + sun.width && sun.y < earth.y + earth.height && earth.y < sun.y + sun.height
        return { sunIn: inTerrain(sun), earthIn: inTerrain(earth), overlap }
      })
      expect(r, `${site} at ${t}`).toEqual({ sunIn: false, earthIn: false, overlap: false })
    }
  })

  test('the "How this is computed" figures for a prepared site come from its horizon file', async ({ page }) => {
    await open(page, `site=${RIDGE}&period=${AUG}&drawer=sources`)
    const h = (await (await page.request.get('/data/horizons/connecting-ridge.json')).json()) as { ray_max_km: number; observer_height_m: number; mask: number[] }
    expect(h.mask).toHaveLength(720)
    const drawer = page.getByTestId('drawer')
    // Summary mode (footer link): short bullets with the same figures; Full data: the full text.
    await expect(drawer.getByTestId('method-short')).toContainText(`720 directions, up to ${h.ray_max_km} km, eye ${h.observer_height_m} m above ground`)
    await drawer.getByTestId('full-data-switch').click()
    await expect(drawer).toContainText(`searched in 720 directions up to ${h.ray_max_km} km for an eye ${h.observer_height_m} m above the ground`)
    await expect(drawer).not.toContainText('80 m mesh')
    // The 20 m model's edge as scripts/horizon.py states it (a 608 km square around the pole), not "about 80° S".
    await expect(drawer).toContainText('a square about 608 km across, centred on the pole')
    await expect(drawer).not.toContainText('about 80° S')
  })
})

test.describe('U3: Time periods show the current mission and the best computed periods for its site', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('the list is the finder ranking for the site over the mission year; picking one edits the mission dates', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page, `site=${RIDGE}&period=${AUG}&name=Ridge%20ops`)
    await page.getByTestId('date').click()
    const best = page.getByTestId('best-periods')
    await expect(best).toContainText('Best periods in 2027')
    await expect(best).toContainText('Ridge ops at Connecting Ridge')
    const rows = best.getByTestId('best-period')
    await expect(rows.first()).toBeVisible({ timeout: 60_000 })
    // Reference: the finder with its defaults and the mission's 14 days, landing times in 2027, all stations.
    const ref = (await page.evaluate(`(async () => {
      const g = await import('/src/geometry/index.ts')
      const L = await import('/src/data/load.ts')
      const [sites, stations] = await Promise.all([L.loadSites(), L.loadStations()])
      const site = sites.find((s) => s.id === ${JSON.stringify(RIDGE)})
      const h = await L.loadHorizon(site.horizon)
      const from = Date.UTC(2027, 0, 1), to = Date.UTC(2028, 0, 1)
      const months = await L.loadMonthsFor(from, to + 14 * 86400000)
      const r = g.finder(months, { lat: site.lat, lon: site.lon, elev_m: site.elev_m }, h, stations, stations.map((x) => x.id), from, to, { ...g.FINDER_DEFAULTS, missionDays: 14 })
      return r.windows.slice(0, 5).map((w) => w.best.landingMs)
    })()`)) as number[]
    expect(ref.length).toBeGreaterThan(0)
    expect(await rows.evaluateAll((bs) => bs.map((b) => Number(b.getAttribute('data-start'))))).toEqual(ref)
    await expect(rows.first()).toContainText(/sunlit \d+ % · coverage \d+ %/)

    const pick = ref[ref.length > 1 ? 1 : 0]
    await rows.nth(ref.length > 1 ? 1 : 0).click()
    await expect(best).toHaveCount(0) // the menu closes
    await expect(page.getByTestId('date')).toHaveAttribute('data-period-id', 'custom')
    const slider = page.getByRole('slider', { name: 'Time in the selected period' })
    await expect(slider).toHaveAttribute('aria-valuemin', String(pick))
    await expect(slider).toHaveAttribute('aria-valuemax', String(pick + 14 * 86_400_000))
    await expect(page.getByTestId('answer')).toHaveAttribute('data-period-id', 'custom', { timeout: 60_000 })
    // Opened again: the chosen period is marked as the current one; the mission keeps its name.
    await page.getByTestId('date').click()
    await expect(best.locator('[aria-current="true"]')).toHaveAttribute('data-start', String(pick), { timeout: 60_000 })
    await expect(page.getByTestId('mission')).toContainText('Ridge ops')
  })
})

for (const vp of [
  { width: 1280, height: 720 },
  { width: 375, height: 812 },
]) {
  test(`Time periods menu: no horizontal scroll, screenshot at ${vp.width} px`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize(vp)
    await open(page, `site=${RIDGE}&period=${AUG}`)
    await page.getByTestId('date').click()
    await expect(page.getByTestId('best-period').first()).toBeVisible({ timeout: 60_000 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await page.screenshot({ path: `test-results/dates-time-periods-${vp.width}.png` })
  })
}

for (const vp of [
  { width: 1280, height: 720 },
  { width: 375, height: 812 },
]) {
  test(`drawer and year timeline: no horizontal scroll, screenshot at ${vp.width} px`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize(vp)
    await seedMissions(page, [`site=${MASSIF}&period=shackleton-2027-09&name=Massif%20survey`])
    await open(page, `site=${RIDGE}&period=${AUG}&drawer=finder`) // the Dates tab
    const yt = page.getByTestId('drawer').getByTestId('year-timeline')
    await expect(yt.getByTestId('year-row').nth(1)).toHaveAttribute('data-state', 'done', { timeout: 60_000 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    const drawerOverflow = await page.getByTestId('drawer').evaluate((d) => d.scrollWidth - d.clientWidth)
    expect(drawerOverflow).toBeLessThanOrEqual(0)
    await page.screenshot({ path: `test-results/dates-drawer-top-${vp.width}.png` })
    await yt.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `test-results/dates-year-timeline-${vp.width}.png` })
    await page.getByTestId('drawer-tab-site').click() // 15 Nov: the Details drawer has tabs (Site details, Dates, Compare)
    await page.getByTestId('drawer').getByTestId('horizon-strip').evaluate((e) => e.scrollIntoView({ block: 'center' }))
    await page.screenshot({ path: `test-results/dates-horizon-${vp.width}.png` })
  })
}
