// POI card and key, read at a glance (U17, wave 3 `read-cards`): no internals in summary mode, every abbreviation
// expanded, the computed block "At this point, for your mission dates", the hover card that survives its own Full data
// switch, 375 px without horizontal scroll.
// Run: PW_GPU=1 PW_PORT=5185 npx playwright test e2e/poi-read.spec.ts --workers=1
//
// The card is opened through the views' test hook (window.__views.setNamed, ?test=1 only), as in poi-card.spec.ts.
import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Poi } from '../src/data/pois'

const DEMO = 'site=connecting-ridge&period=shackleton-2027-08&poi=all'
const CABEUS = 'science:feat_cabeus'
const SHOEMAKER = 'cold-trap:atlas_01' // has a horizon of its own (search-sites.json)
const SHOTS = process.env.POI_SHOTS

interface Views {
  setNamed(n: Record<string, unknown> | null | undefined): void
}
type SceneDebug = { ready: Promise<void> }

async function pois(page: Page): Promise<Map<string, Poi>> {
  const all = (await (await page.request.get('/data/pois.json')).json()) as Poi[]
  return new Map(all.map((p) => [p.id, p]))
}

async function openApp(page: Page) {
  await page.goto(`/?test=1#${DEMO}`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await page.waitForFunction(() => (window as unknown as { __views?: unknown; __scene?: unknown }).__views !== undefined && (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await page.evaluate(() => (window as unknown as { __scene: SceneDebug }).__scene.ready)
  await expect(page.getByTestId('poi-key-note')).toHaveAttribute('data-state', 'ready')
}

const show = (page: Page, poi: Poi | null, x = 0, y = 0) =>
  page.evaluate((v) => (window as unknown as { __views: Views }).__views.setNamed(v), poi ? { name: poi.name, poiId: poi.id, x, y, visible: true } : null)

async function openCard(page: Page, poi: Poi, x: number, y: number, tap = false) {
  await show(page, poi, x, y)
  const box = page.getByTestId('poi-info')
  await expect(box).toHaveAttribute('data-poi-id', poi.id)
  await expect(box).toHaveAttribute('data-side', /\w/) // placed beside its pin by the scene's frame loop
  await expect(box.getByTestId('poi-here')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 }) // filled in
  if (tap) await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
  await expect(box).toHaveAttribute('data-pinned', 'true')
  return box
}

const INTERNALS = ['Access not assessed', 'ESTABLISHED', 'not retrieved', '.json', 'NaN', 'undefined']
const DIRECTION = '(north|north-east|east|south-east|south|south-west|west|north-west)'
const ABBR_TOKEN = /(?<![\w-])(PSRs?|LEND|LCROSS|LROC?|NAC|LAMP|LOLA|WEH|M3|DEM|HLS|NRHO|DTE|DSN|SPA|PGDA|CLPS|LUPEX|TOPSIS|wt%|Ga|Ma)(?![\w-])/

/** Abbreviation tokens in the card's visible text that are not inside an <abbr title>. */
function unexpandedAbbr(box: Locator): Promise<string[]> {
  return box.evaluate((el, src) => {
    const re = new RegExp(src, 'g')
    const out: string[] = []
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (n.parentElement?.closest('abbr[title]')) continue
      for (const m of (n.textContent ?? '').matchAll(re)) out.push(m[1])
    }
    return out
  }, ABBR_TOKEN.source)
}

test.describe('POI card, read at a glance, 1280 × 720', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('a card opened only by hover stays open when its Full data switch is used and the pointer moves on inside it', async ({ page }) => {
    // Regression: full data -> summary made a hover card shorter; it kept its side above the pin, so the pointer was
    // left outside it and the next pointer step closed it after the hover grace.
    await page.addInitScript(() => window.localStorage.setItem('llsn.fullData', '1'))
    const byId = await pois(page)
    const cabeus = byId.get(CABEUS)!
    await openApp(page)
    await show(page, cabeus, 640, 600)
    const box = page.getByTestId('poi-info')
    await expect(box).toHaveAttribute('data-pinned', 'false')
    await expect(box).toHaveAttribute('data-mode', 'full')
    await page.waitForTimeout(300) // the computed block fills in; the card has its height
    const sw = box.getByRole('switch', { name: 'Full data' })
    const s = (await sw.boundingBox())!
    const at = { x: s.x + s.width / 2, y: s.y + s.height / 2 }
    // The pointer leaves the pin for the card (the scene names no pin under it any more) and uses the switch.
    await page.mouse.move(at.x, at.y, { steps: 4 })
    await show(page, null)
    await page.mouse.down()
    await page.mouse.up()
    await expect(box).toHaveAttribute('data-mode', 'summary')
    // The next hover steps, from where the switch was.
    await page.mouse.move(at.x + 3, at.y + 2, { steps: 3 })
    await page.waitForTimeout(800) // longer than the scene's hover grace (350 ms)
    await expect(box).toHaveCount(1)
    await expect(box).toHaveAttribute('data-poi-id', cabeus.id)
    // The switch is still under the pointer: a second press switches back, and the card stays.
    const s2 = (await sw.boundingBox())!
    expect(at.x).toBeGreaterThan(s2.x - 4)
    expect(at.x).toBeLessThan(s2.x + s2.width + 4)
    expect(at.y).toBeGreaterThan(s2.y - 4)
    expect(at.y).toBeLessThan(s2.y + s2.height + 4)
    await page.mouse.down()
    await page.mouse.up()
    await expect(box).toHaveAttribute('data-mode', 'full')
    await page.mouse.move(at.x + 1, at.y + 1, { steps: 2 })
    await page.waitForTimeout(800)
    await expect(box).toHaveCount(1)
  })

  test('summary: no internals, every abbreviation expanded, direction next to the distance, the computed block', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('llsn.fullData', '0'))
    const byId = await pois(page)
    await openApp(page)
    const sample = [CABEUS, SHOEMAKER, 'cold-trap:lem21_haworth', 'water:lend_cabeus_1', 'landing:topsis_dm2_nobile_rim_2', 'landing:gracy_lee_connecting_ridge', 'light:gl18_c1_surface', 'hazard:seismic_n9']
    for (const id of sample) {
      const poi = byId.get(id)!
      const box = await openCard(page, poi, 760, 200)
      await expect(box).toHaveAttribute('data-mode', 'summary')
      const here = box.getByTestId('poi-here')
      await expect(here).toHaveAttribute('data-state', 'ready', { timeout: 30_000 })
      const text = (await box.innerText()).replace(/\s+/g, ' ')
      for (const bad of INTERNALS) expect(text, `${id}: ${bad}`).not.toContain(bad)
      expect(await unexpandedAbbr(box), id).toEqual([])
      await expect(box.getByTestId('poi-distance')).toHaveText(new RegExp(`^[\\d.,]+ km ${DIRECTION} of Connecting Ridge$`))
      await expect(here.locator('.poi-here-title')).toContainText('At this point, for your mission dates')
      await expect(here.locator('.poi-here-row dt')).toHaveText(['Sunlit', 'Station contact', 'Slope'])
      await expect(here.locator('.poi-here-row[data-key="lit"] .poi-here-value')).toHaveText(/^\d{1,3}\.\d %$/)
      await expect(here.locator('.poi-here-row[data-key="comms"] .poi-here-value')).toHaveText(/^\d{1,3}\.\d %$/)
      await expect(here.locator('.poi-here-row[data-key="slope"] .poi-here-value')).toHaveText(/^\d+\.\d°$/)
      await expect(here.getByTestId('poi-here-method')).toHaveCount(0)
      if (SHOTS && id === SHOEMAKER) await page.screenshot({ path: `${SHOTS}/poi-card-summary-1280.png`, animations: 'disabled' })
      await box.getByRole('button', { name: 'Close' }).click()
      await expect(box).toHaveCount(0)
    }
  })

  test('full data: the computed block says how it was computed and carries the validation line; sources stay last', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('llsn.fullData', '1'))
    const byId = await pois(page)
    await openApp(page)
    const box = await openCard(page, byId.get(SHOEMAKER)!, 760, 200)
    await expect(box).toHaveAttribute('data-mode', 'full')
    const here = box.getByTestId('poi-here')
    await expect(here).toHaveAttribute('data-state', 'ready', { timeout: 30_000 })
    const method = here.getByTestId('poi-here-method')
    await expect(method).toContainText('Computed in this app from the point’s terrain horizon')
    await expect(method).toContainText('reported, no written sign-off')
    await expect(method).toContainText('other checks open')
    const full = box.getByTestId('poi-full')
    expect(await full.evaluate((el) => el.lastElementChild?.classList.contains('poi-info-sources'))).toBe(true)
    const text = (await box.innerText()).replace(/\s+/g, ' ')
    for (const bad of INTERNALS) expect(text, bad).not.toContain(bad)
    expect(await unexpandedAbbr(box)).toEqual([])
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/poi-card-full-1280.png`, animations: 'disabled' })
  })

  test('cost: the card opens at once and fills in after', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('llsn.fullData', '0'))
    const byId = await pois(page)
    await openApp(page)
    const poi = byId.get('cold-trap:atlas_07')!
    await page.evaluate(() => {
      const w = window as unknown as { __long: number[] }
      w.__long = []
      new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__long.push(e.duration))).observe({ type: 'longtask' })
    })
    const t0 = await page.evaluate(() => performance.now())
    await show(page, poi, 760, 200)
    const box = page.getByTestId('poi-info')
    await expect(box).toHaveAttribute('data-poi-id', poi.id)
    const shown = await page.evaluate(() => performance.now())
    await expect(box.getByTestId('poi-here')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 })
    const filled = await page.evaluate(() => performance.now())
    const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long)
    console.log(
      `POI card cost: shown after ${(shown - t0).toFixed(0)} ms, values after ${(filled - t0).toFixed(0)} ms, long tasks ${long.map((d) => d.toFixed(0)).join(', ') || 'none'} ms`,
    )
    expect(shown - t0).toBeLessThan(1000)
  })
})

test.describe('POI card and key at 375 × 812, touch', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  test('card and key never stack, a tap toggles the switch, no horizontal scroll, the block fits', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('llsn.fullData', '0'))
    const byId = await pois(page)
    await openApp(page)
    const key = page.getByTestId('poi-key')
    await expect(key).toBeVisible()
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/poi-key-375.png`, animations: 'disabled' })
    const box = await openCard(page, byId.get(SHOEMAKER)!, 190, 560, true)
    await expect(key).toBeHidden()
    await expect(box.getByTestId('poi-here')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 })
    const text = (await box.innerText()).replace(/\s+/g, ' ')
    for (const bad of INTERNALS) expect(text, bad).not.toContain(bad)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/poi-card-summary-375.png`, animations: 'disabled' })
    const sw = box.getByRole('switch', { name: 'Full data' })
    await sw.tap()
    await expect(sw).toHaveAttribute('aria-checked', 'true')
    await expect(box).toHaveAttribute('data-mode', 'full')
    const b = (await box.boundingBox())!
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.x + b.width).toBeLessThanOrEqual(375)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/poi-card-full-375.png`, animations: 'disabled' })
    await sw.tap()
    await expect(sw).toHaveAttribute('aria-checked', 'false')
    await box.getByRole('button', { name: 'Close' }).tap()
    await expect(key).toBeVisible()
  })
})
