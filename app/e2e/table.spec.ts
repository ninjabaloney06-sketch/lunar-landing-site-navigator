// Comparison table for all sites and saved missions (TASKS.md "P2: comparison table for all sites", notebook
// notes 2, 7, 13, 15). Expected values are computed in the page straight from geometry + the data files, never
// typed in. Run: PW_PORT=5184 npx playwright test e2e/table.spec.ts
import { expect, test, type Page } from '@playwright/test'

const RIDGE = 'connecting-ridge'
const AUG = 'shackleton-2027-08'
const DAY = 86_400_000

interface SummaryRef {
  litPct: number
  coveragePct: number
  longestDarkH: number
  longestGapH: number
}
type SiteRef = { id: string; name: string; horizon: string | null }

async function data<T>(page: Page, file: string): Promise<T> {
  return (await (await page.request.get(`/data/${file}`)).json()) as T
}

/** summarize() per site for [startMs, endMs) and the given stations (null = all), plus the rankSites order for a goal. */
async function reference(page: Page, startMs: number, endMs: number, goal: string, st: string[] | null = null) {
  return page.evaluate(`(async () => {
    const g = await import('/src/geometry/index.ts')
    const L = await import('/src/data/load.ts')
    const [sites, stations] = await Promise.all([L.loadSites(), L.loadStations()])
    const ids = ${JSON.stringify(st)} ?? stations.map((x) => x.id)
    const months = await L.loadMonthsFor(${startMs}, ${endMs})
    const rows = []
    for (const site of sites) {
      const h = await L.loadHorizon(site.horizon)
      const series = g.computeSeries(months, { lat: site.lat, lon: site.lon, elev_m: site.elev_m }, h, stations, ${startMs}, ${endMs})
      rows.push({ site, summary: g.summarize(series, ids), lit: g.windows(series, 'sun').filter((w) => w.state === 'lit').length })
    }
    const r = g.rankSites(rows, ${JSON.stringify(goal)})
    return {
      summaries: Object.fromEntries(rows.map((x) => [x.site.id, x.summary])),
      litWindows: Object.fromEntries(rows.map((x) => [x.site.id, x.lit])),
      order: [...r.ranked, ...r.failed, ...r.unknown].map((x) => x.siteId),
      ranks: Object.fromEntries(r.ranked.map((x) => [x.siteId, x.rank])),
    }
  })()`) as Promise<{ summaries: Record<string, SummaryRef>; litWindows: Record<string, number>; order: string[]; ranks: Record<string, number> }>
}

async function periodSpan(page: Page, id: string) {
  const p = (await data<{ id: string; start_utc: string; end_utc: string }[]>(page, 'periods.json')).find((x) => x.id === id)!
  return { startMs: Date.parse(p.start_utc), endMs: Date.parse(p.end_utc) }
}

async function openTable(page: Page, hash: string) {
  await page.goto(`/#${hash}&drawer=details`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  const table = page.getByTestId('site-table')
  await table.scrollIntoViewIfNeeded()
  await expect(table.getByText('…', { exact: true })).toHaveCount(0, { timeout: 60_000 })
  return table
}

const rowIds = (table: ReturnType<Page['getByTestId']>) =>
  table.getByTestId('site-rows').locator('tr').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.siteId!))
const pct = (v: number) => `${v.toFixed(1)} %`
// The table writes durations as a planner reads them (views/format.ts fmtSpanH): "5.2 h", "3 days 4 h".
const hours = (v: number) => {
  if (v < 23.95) return `${v.toFixed(1)} h`
  const t = Math.round(v)
  const d = Math.floor(t / 24)
  return `${d} ${d === 1 ? 'day' : 'days'}${t % 24 ? ` ${t % 24} h` : ''}`
}

test.describe('comparison table for all sites', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('lists every site in sites.json once; light and comms values equal summarize() for that site and the mission dates', async ({ page }) => {
    const sites = await data<SiteRef[]>(page, 'sites.json')
    const table = await openTable(page, `site=${RIDGE}&period=${AUG}`)
    await expect(table).toHaveAttribute('data-span', 'mission')
    const ids = await rowIds(table)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(sites.map((s) => s.id).sort())
    expect(ids).toEqual(sites.map((s) => s.id)) // sites.json order until "Find better location" is asked for
    const { startMs, endMs } = await periodSpan(page, AUG)
    const ref = await reference(page, startMs, endMs, 'light')
    const cell = (id: string, col: string) => table.locator(`tr[data-site-id="${id}"] [data-col=${col}]`)
    // Both (the default): every site.
    for (const s of sites) {
      await expect(cell(s.id, 'lit'), `${s.id} sunlit`).toHaveText(pct(ref.summaries[s.id].litPct))
      await expect(cell(s.id, 'comms'), `${s.id} station coverage`).toHaveText(pct(ref.summaries[s.id].coveragePct))
    }
    await expect(table.getByRole('columnheader')).toHaveText(['Site', 'Sunlit, % of time', 'Comms, % of time', 'Graph'])
    // Light only, then comms only.
    await table.getByRole('radio', { name: 'Light' }).check()
    await expect(table.getByRole('columnheader')).toHaveText(['Site', 'Sunlit, % of time', 'Longest darkness', 'Graph'])
    for (const s of sites) {
      await expect(cell(s.id, 'lit')).toHaveText(pct(ref.summaries[s.id].litPct))
      await expect(cell(s.id, 'dark')).toHaveText(hours(ref.summaries[s.id].longestDarkH))
      await expect(cell(s.id, 'comms')).toHaveCount(0)
    }
    await table.getByRole('radio', { name: 'Comms' }).check()
    await expect(table.getByRole('columnheader')).toHaveText(['Site', 'Comms, % of time', 'Longest comms gap', 'Graph'])
    for (const s of sites) {
      await expect(cell(s.id, 'comms')).toHaveText(pct(ref.summaries[s.id].coveragePct))
      await expect(cell(s.id, 'gap')).toHaveText(hours(ref.summaries[s.id].longestGapH))
    }
    // The same numbers as the answer's own summary in the Compare section above (one computation path).
    const compare = page.getByTestId('compare-table')
    await expect(compare.getByRole('row', { name: /^Sunlit/ }).getByRole('cell').first()).toHaveText(pct(ref.summaries[RIDGE].litPct))
    await expect(page.locator('body')).not.toContainText('NaN')
  })

  test('a selection of stations is used: values equal summarize() for those stations', async ({ page }) => {
    const table = await openTable(page, `site=${RIDGE}&period=${AUG}&st=canberra`)
    const { startMs, endMs } = await periodSpan(page, AUG)
    const ref = await reference(page, startMs, endMs, 'light', ['canberra'])
    const all = await reference(page, startMs, endMs, 'light')
    expect(ref.summaries[RIDGE].coveragePct).toBeLessThan(all.summaries[RIDGE].coveragePct)
    await expect(table.locator(`tr[data-site-id="${RIDGE}"] [data-col=comms]`)).toHaveText(pct(ref.summaries[RIDGE].coveragePct))
    await expect(table).toContainText('1 of 5 stations selected.')
  })

  test('"Find better location" gives the rankSites order for the mission goal, with ranks; pressed again it goes back', async ({ page }) => {
    const sites = await data<SiteRef[]>(page, 'sites.json')
    for (const goal of ['light', 'any']) {
      const table = await openTable(page, `site=${RIDGE}&period=${AUG}&goal=${goal}`)
      const { startMs, endMs } = await periodSpan(page, AUG)
      const ref = await reference(page, startMs, endMs, goal)
      const find = table.getByRole('button', { name: 'Find better location' })
      await expect(find).toHaveAttribute('aria-pressed', 'false')
      await find.click()
      await expect(table).toHaveAttribute('data-ranked', 'true')
      expect(await rowIds(table), `order for goal ${goal}`).toEqual(ref.order)
      for (const [id, rank] of Object.entries(ref.ranks)) {
        await expect(table.locator(`tr[data-site-id="${id}"]`)).toHaveAttribute('data-rank', String(rank))
      }
      // A site above the slope limit is listed after the ranked ones, unranked, and says why.
      const steep = table.locator('tr[data-site-id="shackleton-rim-site04"]')
      await expect(steep).toHaveAttribute('data-rank', '')
      await expect(steep).toContainText('slope 31.8° — too steep')
      await expect(table).not.toContainText(/optimal|safe to land/i)
      await find.click()
      expect(await rowIds(table)).toEqual(sites.map((s) => s.id))
    }
  })

  test('whole year: 365 days from the mission start; values equal summarize() for that span; ranking follows it', async ({ page }) => {
    test.setTimeout(180_000)
    const table = await openTable(page, `site=${RIDGE}&period=${AUG}`)
    const { startMs } = await periodSpan(page, AUG)
    const t0 = Date.now()
    await table.getByRole('radio', { name: 'Whole year' }).check()
    await expect(table).toHaveAttribute('data-span', 'year')
    await expect(table.getByText('…', { exact: true })).toHaveCount(0, { timeout: 60_000 })
    console.log(`whole year, 18 sites, in the table: ${Date.now() - t0} ms until every row was filled`)
    const ref = await reference(page, startMs, startMs + 365 * DAY, 'light')
    for (const id of [RIDGE, 'malapert-massif', 'shackleton-rim-site04', 'im-1']) {
      await expect(table.locator(`tr[data-site-id="${id}"] [data-col=lit]`)).toHaveText(pct(ref.summaries[id].litPct))
      await expect(table.locator(`tr[data-site-id="${id}"] [data-col=comms]`)).toHaveText(pct(ref.summaries[id].coveragePct))
    }
    await expect(table).toContainText("365 days from the mission's first day: 16 Aug 2027 – 14 Aug 2028, UTC.")
    await table.getByRole('button', { name: 'Find better location' }).click()
    expect(await rowIds(table)).toEqual(ref.order)
    // Back to the mission dates: the mission's values again, not the year's.
    await table.getByRole('radio', { name: 'Mission dates' }).check()
    const { endMs } = await periodSpan(page, AUG)
    const mission = await reference(page, startMs, endMs, 'light')
    await expect(table.locator(`tr[data-site-id="${RIDGE}"] [data-col=lit]`)).toHaveText(pct(mission.summaries[RIDGE].litPct))
    expect(mission.summaries[RIDGE].litPct).not.toBeCloseTo(ref.summaries[RIDGE].litPct, 1)
  })

  test('a site without a horizon file shows "no data", never a value', async ({ page }) => {
    await page.route('**/data/horizons/malapert-massif.json', (r) => r.fulfill({ status: 404, body: '' }))
    const table = await openTable(page, `site=${RIDGE}&period=${AUG}`)
    const row = table.locator('tr[data-site-id="malapert-massif"]')
    await expect(row.locator('[data-col=lit]')).toHaveText('no data')
    await expect(row.locator('[data-col=comms]')).toHaveText('no data')
    await expect(row).not.toContainText('%')
    // It is not ranked either.
    await table.getByRole('button', { name: 'Find better location' }).click()
    await expect(row).toHaveAttribute('data-rank', '')
    await row.getByRole('checkbox').check()
    await expect(page.getByTestId('sun-graphs').locator('[data-site-id="malapert-massif"]')).toContainText('no data')
  })

  test('sunlight graphs of the checked rows share one time axis and show the sunlit windows of windows()', async ({ page }) => {
    const table = await openTable(page, `site=${RIDGE}&period=${AUG}`)
    const { startMs, endMs } = await periodSpan(page, AUG)
    const ref = await reference(page, startMs, endMs, 'light')
    const graphs = page.getByTestId('sun-graphs')
    // The landing site's graph is shown from the start.
    await expect(graphs.locator('.st-graph-row')).toHaveCount(1)
    await expect(graphs.locator(`[data-site-id="${RIDGE}"] .seg-lit`)).toHaveCount(ref.litWindows[RIDGE])
    await table.locator('tr[data-site-id="malapert-massif"]').getByRole('checkbox').check()
    await table.locator('tr[data-site-id="shackleton-rim-site04"]').getByRole('checkbox').check()
    await expect(graphs.locator('.st-graph-row')).toHaveCount(3)
    for (const id of [RIDGE, 'malapert-massif', 'shackleton-rim-site04']) {
      const row = graphs.locator(`[data-site-id="${id}"]`)
      await expect(row.locator('.seg-lit')).toHaveCount(ref.litWindows[id])
      // The yellow share of the track is the sunlit share of the period.
      const share = await row.locator('.tl-track').evaluate((track) => {
        const w = track.getBoundingClientRect().width
        return [...track.querySelectorAll('.seg-lit')].reduce((a, s) => a + s.getBoundingClientRect().width, 0) / w
      })
      expect(Math.abs(100 * share - ref.summaries[id].litPct), `${id}: yellow share vs sunlit %`).toBeLessThan(0.5)
    }
    // Same axis: every track starts and ends at the same x.
    const boxes = await graphs.locator('.tl-track').evaluateAll((ts) => ts.map((t) => [t.getBoundingClientRect().left, t.getBoundingClientRect().right]))
    for (const b of boxes) expect(b).toEqual(boxes[0])
    await table.locator(`tr[data-site-id="${RIDGE}"]`).getByRole('checkbox').uncheck()
    await expect(graphs.locator('.st-graph-row')).toHaveCount(2)
  })

  test('"Find better dates" on a row opens the finder for that site; the header has no second "Find better dates" (U4)', async ({ page }) => {
    const table = await openTable(page, `site=${RIDGE}&period=${AUG}`)
    await table.locator('tr[data-site-id="malapert-massif"]').getByRole('button', { name: 'Find better dates' }).click()
    await expect(page.getByTestId('site-name')).toHaveText('Malapert Massif')
    await expect(page.getByTestId('answer')).toHaveAttribute('data-site-id', 'malapert-massif', { timeout: 20_000 })
    const drawer = page.getByTestId('drawer')
    await expect(drawer.getByRole('heading', { name: 'Find better dates' })).toBeInViewport()
    await expect(drawer.getByRole('heading', { level: 2 })).toHaveText('Malapert Massif')
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('drawer=finder')
    // U4: the header's "Find better dates" went; Details is the one way into the drawer (ui.spec D4: 5 controls).
    const header = page.locator('header.top')
    await expect(header.getByRole('button', { name: 'Find better dates' })).toHaveCount(0)
    await expect(header.getByRole('button').or(header.getByRole('link'))).toHaveCount(5)
  })
})

test.describe('saved missions', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('"Add mission" keeps the mission in this browser: it survives a reload, is listed in the Mission panel and is a row of the table', async ({ page }) => {
    const stations = (await data<{ id: string }[]>(page, 'stations.json')).map((s) => s.id)
    await page.goto(`/#site=malapert-massif&period=shackleton-2027-09&name=Massif%20survey&goal=cold-trap&st=${stations.slice(0, 2).join(',')}`)
    await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
    await page.getByTestId('mission').click()
    const panel = page.getByTestId('mission-panel')
    await expect(panel.getByTestId('saved-missions')).toHaveCount(0)
    const add = panel.getByTestId('add-mission')
    await expect(add).toHaveText('Add mission')
    await add.click()
    await expect(add).toBeDisabled()
    await expect(panel).toContainText('Saved in this browser.')
    await expect(panel.getByTestId('saved-missions').locator('li')).toHaveCount(1)
    // A second mission: another name and site.
    await panel.getByLabel('Name', { exact: true }).fill('Ridge ops')
    await expect(add).toBeEnabled()
    await panel.getByTestId('site-ranking').click() // U1: the site list opens on typing or from the ranking
    await page.locator(`#site-opt-${RIDGE}`).click()
    await page.getByTestId('mission').click()
    await page.getByTestId('mission-panel').getByTestId('add-mission').click()
    await expect(page.getByTestId('mission-panel').getByTestId('saved-missions').locator('li')).toHaveCount(2)

    // Reload on a fresh link: both are still there.
    await page.goto('about:blank')
    await page.goto(`/#site=${RIDGE}&period=${AUG}&drawer=details`)
    await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
    const table = page.getByTestId('site-table')
    await table.scrollIntoViewIfNeeded()
    const rows = table.getByTestId('mission-rows').locator('tr[data-mission]')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('Massif survey')
    await expect(rows.nth(0)).toContainText('Malapert Massif · 12–26 Sep 2027')
    await expect(rows.nth(1)).toContainText('Ridge ops')
    await expect(rows.nth(1)).toContainText('Connecting Ridge · 12–26 Sep 2027')
    // Its values are summarize() for its own site, dates and stations, not for the mission on screen.
    const { startMs, endMs } = await periodSpan(page, 'shackleton-2027-09')
    const ref = await reference(page, startMs, endMs, 'light', stations.slice(0, 2))
    await expect(rows.nth(0).locator('[data-col=lit]')).toHaveText(pct(ref.summaries['malapert-massif'].litPct), { timeout: 30_000 })
    await expect(rows.nth(0).locator('[data-col=comms]')).toHaveText(pct(ref.summaries['malapert-massif'].coveragePct))
    await expect(rows.nth(1).locator('[data-col=lit]')).toHaveText(pct(ref.summaries[RIDGE].litPct))
    // The site rows above are still for the mission on screen.
    const aug = await periodSpan(page, AUG)
    const onScreen = await reference(page, aug.startMs, aug.endMs, 'light')
    await expect(table.locator(`tr[data-site-id="${RIDGE}"] [data-col=lit]`)).toHaveText(pct(onScreen.summaries[RIDGE].litPct))

    // The mission picker: choosing a saved mission restores name, site, dates, stations and goal.
    await page.getByTestId('drawer').getByRole('button', { name: 'Close' }).click()
    await page.getByTestId('mission').click()
    const saved = page.getByTestId('mission-panel').getByTestId('saved-missions')
    await expect(saved.locator('li')).toHaveCount(2)
    await saved.getByRole('button', { name: 'Massif survey', exact: true }).click()
    await expect(page.getByTestId('mission')).toHaveText('Massif survey')
    await expect(page.getByTestId('site-name')).toHaveText('Malapert Massif')
    await expect(page.getByTestId('date')).toHaveAttribute('data-period-id', 'shackleton-2027-09')
    await expect(page.getByTestId('mission-panel').getByRole('radio', { name: 'Cold traps (permanent shadow)' })).toBeChecked()
    await page.getByTestId('mission-panel').getByTestId('stations-toggle').click() // folded to "n of m stations" (U2)
    await expect(page.getByTestId('mission-panel').getByRole('checkbox', { checked: true })).toHaveCount(2)
    await expect(page.getByTestId('mission-panel').getByTestId('add-mission')).toBeDisabled() // it is the saved one
    // Remove one: gone from the panel, and after a reload from the table too.
    await saved.getByRole('button', { name: 'Remove Ridge ops' }).click()
    await expect(saved.locator('li')).toHaveCount(1)
    await page.reload()
    await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
    await page.getByTestId('details').click()
    await page.getByTestId('site-table').scrollIntoViewIfNeeded()
    await expect(page.getByTestId('site-table').getByTestId('mission-rows').locator('tr[data-mission]')).toHaveCount(1)
  })

  test('stored text that is not a mission list is ignored; a broken entry falls back to defaults, never NaN', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('llsn.missions.v1', JSON.stringify(['site=Nope!&period=zzz&days=999&goal=biology&name=Odd', 42, null]))
        sessionStorage.setItem('seeded', '1')
      }
    })
    const table = await openTable(page, `site=${RIDGE}&period=${AUG}`)
    const rows = table.getByTestId('mission-rows').locator('tr[data-mission]')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Odd')
    await expect(rows.first().locator('[data-col=lit]')).toHaveText(/^(\d+\.\d %|no data)$/, { timeout: 30_000 })
    await expect(page.locator('body')).not.toContainText('NaN')
    await page.evaluate(() => localStorage.setItem('llsn.missions.v1', '{not json'))
    await page.reload()
    await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
    await expect(page.getByTestId('site-table').getByTestId('mission-rows')).toHaveCount(0)
  })
})

for (const vp of [
  { width: 1600, height: 1000 },
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
]) {
  test(`table and saved missions: no horizontal scroll, and screenshots, at ${vp.width} × ${vp.height}`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize(vp)
    const tag = `${vp.width}x${vp.height}`
    // A saved mission first, so the picker and the table both show one.
    await page.goto(`/#site=malapert-massif&period=shackleton-2027-09&name=Massif%20survey`)
    await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
    await page.getByTestId('mission').click()
    await page.getByTestId('mission-panel').getByTestId('add-mission').click()
    await page.evaluate(() => document.fonts.ready)
    const noScroll = async (what: string) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, `page: ${what} at ${tag}`).toBeLessThanOrEqual(0)
    }
    await page.getByTestId('mission-panel').getByTestId('saved-missions').evaluate((e) => e.scrollIntoView({ block: 'center' }))
    await noScroll('Mission panel with a saved mission')
    await page.screenshot({ path: `test-results/table-mission-panel-${tag}.png`, animations: 'disabled' })
    await page.getByTestId('mission-panel').getByRole('button', { name: 'Close' }).click() // a full-screen sheet on a phone

    const table = await openTable(page, `site=${RIDGE}&period=${AUG}`)
    const drawer = page.getByTestId('drawer')
    const inside = async (what: string) => {
      await noScroll(what)
      const d = await drawer.evaluate((e) => e.scrollWidth - e.clientWidth)
      expect(d, `drawer: ${what} at ${tag}`).toBeLessThanOrEqual(0)
    }
    await expect(table.getByTestId('mission-rows').locator('[data-col=lit]')).toHaveText(/%$/, { timeout: 30_000 })
    await page.getByRole('heading', { name: 'All sites' }).evaluate((e) => e.scrollIntoView({ block: 'start' }))
    await inside('table, both columns')
    await page.screenshot({ path: `test-results/table-both-${tag}.png`, animations: 'disabled' })
    await table.getByRole('radio', { name: 'Comms' }).check()
    await inside('table, comms columns')
    await table.getByRole('radio', { name: 'Light' }).check()
    await table.getByRole('button', { name: 'Find better location' }).click()
    await expect(table).toHaveAttribute('data-ranked', 'true')
    await inside('table, light columns, ranked')
    await page.screenshot({ path: `test-results/table-light-ranked-${tag}.png`, animations: 'disabled' })
    await table.getByRole('radio', { name: 'Whole year' }).check()
    await expect(table.getByText('…', { exact: true })).toHaveCount(0, { timeout: 60_000 })
    await table.locator('tr[data-site-id="malapert-massif"]').getByRole('checkbox').check()
    await table.locator('tr[data-site-id="peak-near-shackleton"]').getByRole('checkbox').check()
    await page.getByTestId('sun-graphs').evaluate((e) => e.scrollIntoView({ block: 'end' }))
    await inside('whole year with three sunlight graphs')
    await page.screenshot({ path: `test-results/table-year-graphs-${tag}.png`, animations: 'disabled' })
  })
}
