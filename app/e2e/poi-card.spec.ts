// POI info card, summary by default and full data on demand (U8), per-point markers removed (U7), the key at phone
// width (visual sweep item 7). Run: PW_GPU=1 PW_PORT=5183 npx playwright test e2e/poi-card.spec.ts --workers=1
//
// Expected texts come from public/data/pois.json (its `plain` field is docs/POIs/plain.json merged by
// scripts/pois.py); the card is opened through the views' test hook (window.__views.setNamed, ?test=1 only).
import { expect, test, type Page } from '@playwright/test'
import type { Poi } from '../src/data/pois'

const DEMO = 'site=connecting-ridge&period=shackleton-2027-08&poi=all'
const CABEUS = 'science:feat_cabeus'
const OTHER = 'hazard:scarp_de_gerlache'
const SHOTS = process.env.POI_SHOTS // folder for the report's screenshots (optional)

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

const show = (page: Page, poi: Poi, x: number, y: number) =>
  page.evaluate((v) => (window as unknown as { __views: Views }).__views.setNamed(v), { name: poi.name, poiId: poi.id, x, y, visible: true })

/** Opens the card of `poi` and keeps it open (a click on the stubbed pin, which stands in the sky). */
async function openCard(page: Page, poi: Poi, x: number, y: number, tap = false) {
  await show(page, poi, x, y)
  const box = page.getByTestId('poi-info')
  await expect(box).toHaveAttribute('data-poi-id', poi.id)
  if (tap) await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
  await expect(box).toHaveAttribute('data-pinned', 'true')
  return box
}

test.describe('POI card at 1440 × 900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Cabeus summary card: name, plain type and bullets; no evidence grade, file name, "not retrieved", raw coordinates, sources or marker', async ({ page }) => {
    const byId = await pois(page)
    const cabeus = byId.get(CABEUS)!
    // The raw record carries the research-note internals the summary must not show.
    expect(`${cabeus.summary} ${cabeus.evidence} ${cabeus.limitations} ${cabeus.facts.map((f) => f.value).join(' ')}`).toMatch(/ESTABLISHED[\s\S]*not retrieved|not retrieved[\s\S]*ESTABLISHED/)
    await openApp(page)
    const box = await openCard(page, cabeus, 760, 200)
    await expect(box).toHaveAttribute('data-mode', 'summary')
    await expect(box.getByRole('heading', { name: cabeus.name })).toBeVisible()
    await expect(box.getByTestId('poi-type')).toHaveText(cabeus.plain!.type)
    await expect(box.getByTestId('poi-bullets').locator('li:not(.poi-distance)')).toHaveText(cabeus.plain!.bullets)
    const text = (await box.innerText()).replace(/\s+/g, ' ')
    for (const bad of ['ESTABLISHED', '.json', 'not retrieved', '-84.', 'science lead', 'Click the pin', 'Sources', 'Evidence']) {
      expect(text, bad).not.toContain(bad)
    }
    await expect(box.getByRole('link')).toHaveCount(0)
    // The switch sits in the card's top-right corner, labelled, off.
    const sw = box.getByRole('switch', { name: 'Full data' })
    await expect(sw).toHaveAttribute('aria-checked', 'false')
    await expect(sw).toHaveText('Full data')
    const [b, s] = [(await box.boundingBox())!, (await sw.boundingBox())!]
    expect(s.y - b.y).toBeLessThan(40)
    expect(b.x + b.width - (s.x + s.width)).toBeLessThan(120)
    if (SHOTS) await box.screenshot({ path: `${SHOTS}/poi-card-summary-1440.png` })
  })

  test('full data card: coordinates formatted, empty rows hidden, evidence explained, conflict as a sentence, sources at the bottom', async ({ page }) => {
    const byId = await pois(page)
    const cabeus = byId.get(CABEUS)!
    await openApp(page)
    const box = await openCard(page, cabeus, 760, 200)
    await box.getByRole('switch', { name: 'Full data' }).click()
    await expect(box).toHaveAttribute('data-mode', 'full')
    await expect(box.getByRole('switch', { name: 'Full data' })).toHaveAttribute('aria-checked', 'true')
    const full = box.getByTestId('poi-full')
    await expect(full).toContainText('84.90° S, 35.50° W')
    // The record has an "Age: not retrieved" row; the card hides it.
    expect(cabeus.facts.find((f) => f.label === 'Age')?.value).toBe('not retrieved')
    await expect(full.locator('.poi-fact dt')).toHaveText(cabeus.facts.filter((f) => f.value !== 'not retrieved').map((f) => f.label))
    await expect(full.getByTestId('poi-evidence')).toContainText('measured or documented in primary or official sources')
    await expect(full).toContainText('Centre position differs between sources: Wikipedia 84.90° S 35.50° W; USGS Gazetteer list gives 85.33° S 42.13° W.')
    const text = await full.innerText()
    for (const bad of ['ESTABLISHED', '.json', 'not retrieved', '-84.', 'science lead']) expect(text, bad).not.toContain(bad)
    const links = full.getByRole('link')
    await expect(links).toHaveCount(cabeus.sources.length)
    for (const [i, u] of cabeus.sources.entries()) await expect(links.nth(i)).toHaveAttribute('href', u)
    // Sources are the last thing in the card.
    expect(await full.evaluate((el) => el.lastElementChild?.classList.contains('poi-info-sources'))).toBe(true)
    if (SHOTS) await box.screenshot({ path: `${SHOTS}/poi-card-full-1440.png` })
  })

  test('the Full data choice is global: it carries to the next card and survives a reload; off again returns to summary', async ({ page }) => {
    const byId = await pois(page)
    await openApp(page)
    let box = await openCard(page, byId.get(CABEUS)!, 760, 200)
    await box.getByRole('switch', { name: 'Full data' }).click()
    await expect(box).toHaveAttribute('data-mode', 'full')
    await box.getByRole('button', { name: 'Close' }).click()
    await expect(box).toHaveCount(0)
    // Another card opens in full data mode.
    box = await openCard(page, byId.get(OTHER)!, 760, 200)
    await expect(box).toHaveAttribute('data-mode', 'full')
    await expect(box.getByRole('switch', { name: 'Full data' })).toHaveAttribute('aria-checked', 'true')
    // A reload keeps it (localStorage).
    await page.reload()
    await openApp(page)
    box = await openCard(page, byId.get(CABEUS)!, 760, 200)
    await expect(box).toHaveAttribute('data-mode', 'full')
    // Off: summary again, also after a reload.
    await box.getByRole('switch', { name: 'Full data' }).click()
    await expect(box).toHaveAttribute('data-mode', 'summary')
    await page.reload()
    await openApp(page)
    box = await openCard(page, byId.get(OTHER)!, 760, 200)
    await expect(box).toHaveAttribute('data-mode', 'summary')
  })

  test('storage that throws: the card opens in summary and the switch still works', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('SecurityError')
        },
      })
    })
    const byId = await pois(page)
    await openApp(page)
    const box = await openCard(page, byId.get(CABEUS)!, 760, 200)
    await expect(box).toHaveAttribute('data-mode', 'summary')
    await box.getByRole('switch', { name: 'Full data' }).click()
    await expect(box).toHaveAttribute('data-mode', 'full')
  })

  // Needs SceneView to pass the current site to PoiInfo (`from` prop), which it does.
  test('the summary card ends with the distance from the current landing site, computed in the app', async ({ page }) => {
    const byId = await pois(page)
    const cabeus = byId.get(CABEUS)!
    const sites = (await (await page.request.get('/data/sites.json')).json()) as { id: string; name: string; lat: number; lon: number }[]
    const ridge = sites.find((s) => s.id === 'connecting-ridge')!
    const r = Math.PI / 180
    const h = Math.sin(((cabeus.lat - ridge.lat) * r) / 2) ** 2 + Math.cos(ridge.lat * r) * Math.cos(cabeus.lat * r) * Math.sin(((cabeus.lon - ridge.lon) * r) / 2) ** 2
    const km = 2 * 1737.4 * Math.asin(Math.sqrt(h))
    await openApp(page)
    const box = await openCard(page, cabeus, 760, 200)
    await expect(box.getByTestId('poi-distance')).toHaveText(new RegExp(`^${Math.round(km)} km (north|north-east|east|south-east|south|south-west|west|north-west) of ${ridge.name}$`))
    await expect(box.getByTestId('poi-bullets').locator('li').last()).toHaveAttribute('data-testid', 'poi-distance')
  })

  test('the switch is keyboard operable', async ({ page }) => {
    const byId = await pois(page)
    await openApp(page)
    const box = await openCard(page, byId.get(CABEUS)!, 760, 200)
    const sw = box.getByRole('switch', { name: 'Full data' })
    await sw.focus()
    await page.keyboard.press('Space')
    await expect(sw).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Enter')
    await expect(sw).toHaveAttribute('aria-checked', 'false')
  })
})

test.describe('POI card at 375 × 812, touch', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  test('the switch shows the text "Full data" on screen; state reads from the knob position; the key is one row and steps aside for the card', async ({ page }) => {
    const byId = await pois(page)
    await openApp(page)
    // The key: one row under the buttons (visual sweep item 7), no note paragraph.
    const key = page.getByTestId('poi-key')
    await expect(key).toBeVisible()
    expect((await key.boundingBox())!.height).toBeLessThan(48)
    await expect(page.getByTestId('poi-key-note')).toBeHidden()
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/poi-key-375.png`, animations: 'disabled' })

    const box = await openCard(page, byId.get(CABEUS)!, 190, 560, true)
    const sw = box.getByRole('switch', { name: 'Full data' })
    await expect(sw).toBeVisible()
    await expect(sw).toHaveText('Full data')
    await expect(sw.locator('.full-switch-label')).toBeInViewport({ ratio: 1 })
    // The key steps aside while a card is open, so the card never stacks on it.
    await expect(key).toBeHidden()
    const knob = sw.locator('.full-switch-knob')
    const offX = (await knob.boundingBox())!.x
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/poi-card-summary-375.png`, animations: 'disabled' })
    await sw.tap()
    await expect(sw).toHaveAttribute('aria-checked', 'true')
    await expect.poll(async () => (await knob.boundingBox())!.x - offX).toBeGreaterThan(6)
    await expect(box).toHaveAttribute('data-mode', 'full')
    const b = (await box.boundingBox())!
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.x + b.width).toBeLessThanOrEqual(375)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/poi-card-full-375.png`, animations: 'disabled' })
    await box.getByRole('button', { name: 'Close' }).tap()
    await expect(key).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test.describe('POI layer at 1280 × 720', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('key names the landing group "Landing candidates"; summary and full card fit in the stage', async ({ page }) => {
    const byId = await pois(page)
    await openApp(page)
    await expect(page.getByTestId('poi-key').locator('.poi-key-name')).toContainText(['Landing candidates'])
    await expect(page.getByTestId('poi-key')).not.toContainText('Landing sites')
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/poi-key-1280.png`, animations: 'disabled' })
    const box = await openCard(page, byId.get(CABEUS)!, 640, 260)
    for (const mode of ['summary', 'full']) {
      if (mode === 'full') await box.getByRole('switch', { name: 'Full data' }).click()
      await expect(box).toHaveAttribute('data-mode', mode)
      const b = (await box.boundingBox())!
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.x + b.width).toBeLessThanOrEqual(1280)
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/poi-card-${mode}-1280.png`, animations: 'disabled' })
    }
  })
})
