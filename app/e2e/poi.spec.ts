// Points of interest (U2, U3): the top-bar toggle (off by default, absent from the link), the key, what reaches the
// scene through setPois (only POIs inside the pin region, no duplicate of a site pin), the info box at a pin, and
// "Add point here" outside the pin region. Run: PW_PORT=5182 npx playwright test e2e/poi.spec.ts --workers=1
//
// Expected sets are computed here from public/data/pois.json, sites.json and the PIN_REGION_NORTH_LAT constant,
// never typed in. Most tests read what the views passed to setPois and stub named() through the views' test hook
// (window.__views, ?test=1 only); "real POI pins" hovers a pin the scene draws, found through window.__scene.
import { expect, test, type Page } from '@playwright/test'
import { POI_GROUPS, type Poi } from '../src/data/pois'
import { PIN_REGION_NORTH_LAT } from '../src/scene3d/region'

const DEMO = 'site=connecting-ridge&period=shackleton-2027-08'
const SCARP = 'hazard:scarp_de_gerlache' // a hazard record with facts and two sources

interface ScenePoi {
  id: string
  name: string
  lat: number
  lon: number
  color: string
  landing: boolean
}
interface Views {
  pois(): ScenePoi[]
  setNamed(n: Record<string, unknown> | null | undefined): void
}
type SceneDebug = { ready: Promise<void>; setView(o: Record<string, unknown>): Promise<unknown>; surfaceAt(x: number, y: number): { lat: number; lon: number } | null }

async function data<T>(page: Page, file: string): Promise<T> {
  return (await (await page.request.get(`/data/${file}`)).json()) as T
}

async function openApp(page: Page, hash: string) {
  await page.goto(`/?test=1#${hash}`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await page.waitForFunction(() => (window as unknown as { __views?: unknown; __scene?: unknown }).__views !== undefined && (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await page.evaluate(() => (window as unknown as { __scene: SceneDebug }).__scene.ready)
}

const passed = (page: Page) => page.evaluate(() => (window as unknown as { __views: Views }).__views.pois())
const setNamed = (page: Page, n: Record<string, unknown> | null | undefined) =>
  page.evaluate((v) => (window as unknown as { __views: Views }).__views.setNamed(v), n)
const hash = (page: Page) => page.evaluate(() => location.hash)

/** The pins the layer must pass for these groups: inside the pin region, not a landing record of an app site. */
async function expectedPins(page: Page, groups: string[]) {
  const [pois, sites] = await Promise.all([data<Poi[]>(page, 'pois.json'), data<{ id: string }[]>(page, 'sites.json')])
  const siteIds = new Set(sites.map((s) => s.id))
  return pois
    .filter((p) => groups.includes(p.group) && p.lat <= PIN_REGION_NORTH_LAT && !(p.group === 'landing' && p.siteId && siteIds.has(p.siteId)))
    .map((p) => p.id)
    .sort()
}

test.describe('POI layer at 1440 × 900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('off by default and absent from the link; pois.json is not fetched until the layer is switched on', async ({ page }) => {
    const fetched: string[] = []
    page.on('request', (r) => r.url().includes('/data/pois.json') && fetched.push(r.url()))
    await openApp(page, DEMO)
    const toggle = page.getByTestId('poi-toggle')
    await expect(toggle).toHaveText('Points of interest')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByTestId('poi-key')).toHaveCount(0)
    await page.waitForTimeout(700) // the link is written 400 ms after a change
    expect(await hash(page)).not.toContain('poi')
    expect(await passed(page)).toEqual([])
    expect(fetched).toHaveLength(0)
    // An old link without `poi` keeps the layer off.
    await openApp(page, `${DEMO}&view=globe`)
    await expect(page.getByTestId('poi-toggle')).toHaveAttribute('aria-pressed', 'false')
    expect(fetched).toHaveLength(0)
  })

  test('switching it on passes only in-region POIs to setPois, the key shows six groups, and single groups switch', async ({ page }) => {
    await openApp(page, DEMO)
    await page.getByTestId('poi-toggle').click()
    await expect(page.getByTestId('poi-toggle')).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => hash(page)).toContain('poi=all')
    const key = page.getByTestId('poi-key')
    await expect(key).toBeVisible()
    // Six groups, each a checkbox with its name beside its colour, in POI_GROUPS order.
    const items = key.locator('.poi-key-item')
    await expect(items).toHaveCount(6)
    await expect(items.locator('.poi-key-name')).toHaveText(POI_GROUPS.map((g) => g.label))
    for (const [i, g] of POI_GROUPS.entries()) {
      const rgb = await items.nth(i).locator('.poi-swatch').evaluate((e) => getComputedStyle(e).backgroundColor)
      const hex = '#' + rgb.match(/\d+/g)!.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('')
      expect(hex).toBe(g.color)
      await expect(items.nth(i).getByRole('checkbox')).toBeChecked()
    }
    await expect(page.getByTestId('poi-key-note')).toContainText('not validated by the science lead')
    await expect(page.getByTestId('poi-key-note')).toContainText(`south of ${Math.abs(PIN_REGION_NORTH_LAT)}° S`)

    const all = POI_GROUPS.map((g) => g.id)
    const want = await expectedPins(page, all)
    await expect.poll(async () => (await passed(page)).map((p) => p.id).sort()).toEqual(want)
    const got = await passed(page)
    expect(got.length).toBeGreaterThan(100)
    for (const p of got) {
      expect(p.lat, p.id).toBeLessThanOrEqual(PIN_REGION_NORTH_LAT)
      expect(p.color).toBe(POI_GROUPS.find((g) => p.id.startsWith(`${g.id}:`))!.color)
      expect(p.landing).toBe(p.id.startsWith('landing:'))
    }
    // The landing record of the demo site is the site's own pin, so it is not passed again.
    expect(got.some((p) => p.id === 'landing:connecting_ridge')).toBe(false)
    // The key counts the pins per group.
    for (const [i, g] of POI_GROUPS.entries()) {
      await expect(items.nth(i).locator('.poi-key-n')).toHaveText(String(want.filter((id) => id.startsWith(`${g.id}:`)).length))
    }

    // One group off: its pins leave the scene and the link names the rest.
    await items.filter({ hasText: 'Permanent shadow' }).getByRole('checkbox').uncheck()
    const rest = all.filter((g) => g !== 'cold-trap')
    await expect.poll(async () => (await passed(page)).map((p) => p.id).sort()).toEqual(await expectedPins(page, rest))
    await expect.poll(() => hash(page)).toContain(`poi=${rest.join(',')}`)
    // A copied link reproduces the choice.
    await page.reload()
    await expect(page.getByTestId('poi-key').locator('.poi-key-item').filter({ hasText: 'Permanent shadow' }).getByRole('checkbox')).not.toBeChecked()
    await page.waitForFunction(() => (window as unknown as { __views?: unknown }).__views !== undefined)
    await expect.poll(async () => (await passed(page)).length).toBe((await expectedPins(page, rest)).length)
    // Off again: nothing is drawn and the link drops `poi`.
    await page.getByTestId('poi-toggle').click()
    await expect(page.getByTestId('poi-key')).toHaveCount(0)
    await expect.poll(() => passed(page)).toEqual([])
    await expect.poll(() => hash(page)).not.toContain('poi')
    // On again: the groups chosen before come back.
    await page.getByTestId('poi-toggle').click()
    await expect.poll(() => hash(page)).toContain(`poi=${rest.join(',')}`)
  })

  test('info box: a POI under the pointer shows its name, facts, evidence, caveat and source links; a click keeps it, Esc closes it', async ({ page }) => {
    const pois = await data<Poi[]>(page, 'pois.json')
    const scarp = pois.find((p) => p.id === SCARP)!
    expect(scarp.facts.length).toBeGreaterThan(0)
    await openApp(page, `${DEMO}&poi=all`)
    await expect.poll(async () => (await passed(page)).length).toBeGreaterThan(0)
    // The stubbed pin stands in the sky of the default site view, so a click there is not also a walk on the terrain.
    const [X, Y] = [760, 200]
    expect(await page.evaluate(([x, y]) => (window as unknown as { __scene: SceneDebug }).__scene.surfaceAt(x, y), [X, Y])).toBeNull()
    const pin = { name: scarp.name, poiId: SCARP, x: X, y: Y, visible: true }
    // Hover: named() reports the POI with its screen point.
    await setNamed(page, pin)
    const box = page.getByTestId('poi-info')
    await expect(box).toBeVisible()
    await expect(box).toHaveAttribute('data-poi-id', SCARP)
    await expect(box).toHaveAttribute('data-pinned', 'false')
    await expect(box.getByRole('heading', { name: scarp.name })).toBeVisible()
    await expect(box).toContainText('Hazards')
    await expect(box).toContainText(scarp.summary)
    await expect(box.locator('.poi-fact').first()).toHaveText(`${scarp.facts[0].label}${scarp.facts[0].value}`)
    await expect(box).toContainText(`Evidence ${scarp.evidence}`)
    await expect(box).toContainText('From research notes, not validated by the science lead.')
    const links = box.getByRole('link')
    await expect(links).toHaveCount(scarp.sources.length)
    for (const [i, u] of scarp.sources.entries()) {
      await expect(links.nth(i)).toHaveAttribute('href', u)
      await expect(links.nth(i)).toHaveAttribute('target', '_blank')
    }
    // The box sits beside the pin (above it, or below when there is no room), inside the stage, never over it;
    // the plain name label is not shown for it.
    const b = (await box.boundingBox())!
    expect(b.y >= Y || b.y + b.height <= Y).toBe(true)
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.x + b.width).toBeLessThanOrEqual(1440)
    await expect(page.getByTestId('pin-name')).toBeHidden()

    // The pointer leaves the pin but reaches the box within the grace time: the box stays, its links can be used.
    await setNamed(page, null)
    await page.mouse.move(b.x + 20, b.y + 20)
    await page.waitForTimeout(600)
    await expect(box).toBeVisible()
    // Off the box: it goes.
    await page.mouse.move(40, 600)
    await expect(box).toBeHidden()

    // A click on the pin keeps the box open after the pointer leaves; Esc closes it and the app stays at site level.
    await setNamed(page, pin)
    await expect(box).toBeVisible()
    await page.mouse.click(X, Y)
    await expect(box).toHaveAttribute('data-pinned', 'true')
    await setNamed(page, null)
    await page.mouse.move(40, 600)
    await page.waitForTimeout(600)
    await expect(box).toBeVisible()
    await expect(box.getByRole('button', { name: 'Close' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(box).toBeHidden()
    await page.waitForTimeout(600)
    expect(await hash(page)).not.toContain('view=globe')

    // Kept open, then a press elsewhere (the top bar) closes it; the Close button closes it too.
    await setNamed(page, pin)
    await page.mouse.click(X, Y)
    await setNamed(page, null)
    await expect(box).toHaveAttribute('data-pinned', 'true')
    await page.getByTestId('site-name').click()
    await expect(box).toBeHidden()
    await setNamed(page, pin)
    await page.mouse.click(X, Y)
    await setNamed(page, null)
    await box.getByRole('button', { name: 'Close' }).click()
    await expect(box).toBeHidden()

    // A site pin or a user point keeps its plain name label.
    await setNamed(page, { name: 'Haworth', x: 500, y: 400, visible: true })
    await expect(page.getByTestId('pin-name')).toHaveText('Haworth')
    await expect(box).toHaveCount(0)
    await setNamed(page, undefined)
  })

  test('"Add point here" is disabled outside the pin region, with the reason; inside it adds the point', async ({ page }) => {
    await openApp(page, DEMO)
    // Globe seen from above 70° S: the point under the pointer lies north of the region.
    await page.evaluate(() => (window as unknown as { __scene: SceneDebug }).__scene.setView({ level: 'globe', el: -70, az: 30, dist: 6500 }))
    const at = (await page.evaluate(() => (window as unknown as { __scene: SceneDebug }).__scene.surfaceAt(700, 420)))!
    expect(at).not.toBeNull()
    expect(at.lat).toBeGreaterThan(PIN_REGION_NORTH_LAT)
    await page.mouse.click(700, 420, { button: 'right' })
    const menu = page.getByTestId('scene-menu')
    const add = menu.getByRole('menuitem', { name: 'Add point here' })
    await expect(add).toBeDisabled()
    const reason = `Points can be added only south of ${Math.abs(PIN_REGION_NORTH_LAT)}° S.`
    await expect(add).toHaveAttribute('title', reason)
    await expect(page.getByTestId('scene-menu-note')).toHaveText(reason)
    await page.keyboard.press('Escape')
    // Site view at Connecting Ridge (89.46° S): inside the region, the entry adds a point.
    await page.evaluate(() => (window as unknown as { __scene: SceneDebug }).__scene.setView({ level: 'site' }))
    const ground = (await page.evaluate(() => (window as unknown as { __scene: SceneDebug }).__scene.surfaceAt(800, 430)))!
    expect(ground.lat).toBeLessThanOrEqual(PIN_REGION_NORTH_LAT)
    await page.mouse.click(800, 430, { button: 'right' })
    await expect(page.getByTestId('scene-menu-note')).toHaveCount(0)
    await page.getByTestId('scene-menu').getByRole('menuitem', { name: 'Add point here' }).click()
    await expect.poll(() => hash(page)).toContain(`pts=${ground.lat.toFixed(4)},${ground.lon.toFixed(4)}`)
  })
})

test.describe('real POI pins at 1440 × 900 (wave 3, E4: the scene draws them; no named() stub)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('switched on at the globe, a hovered pin opens its info box with that POI\'s name and a source link', async ({ page }) => {
    const [pois, sites] = await Promise.all([data<Poi[]>(page, 'pois.json'), data<{ id: string }[]>(page, 'sites.json')])
    await openApp(page, `${DEMO}&view=globe`)
    await page.getByTestId('poi-toggle').click()
    await expect(page.getByTestId('poi-toggle')).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(async () => (await passed(page)).length).toBeGreaterThan(0)
    // The globe from above the south pole, near enough for the pins to be drawn.
    await page.evaluate(() => (window as unknown as { __scene: SceneDebug }).__scene.setView({ level: 'globe', el: -89, az: 0, dist: 3600 }))
    // Screen positions through the scene's debug API: every drawn POI head and every site pin.
    const ids = (await passed(page)).map((p) => p.id)
    const heads = await page.evaluate(
      ([ids, siteIds]) => {
        const s = (window as unknown as { __scene: { projectPoi(id: string): { x: number; y: number; visible: boolean } | null; projectPin(id: string): { x: number; y: number; visible: boolean } | null } }).__scene
        return {
          pois: ids.map((id) => ({ id, p: s.projectPoi(id) })),
          sites: siteIds.map((id) => s.projectPin(id)).filter((p) => p !== null),
        }
      },
      [ids, sites.map((x) => x.id)] as const,
    )
    // A visible pin inside the stage, clear of the top bar and the timeline, and at least 40 px from every other
    // pin, so the pointer can only name this one.
    const on = heads.pois.filter((h) => h.p && h.p.visible && h.p.x > 80 && h.p.x < 1360 && h.p.y > 180 && h.p.y < 620)
    const others = [...heads.pois.filter((h) => h.p && h.p.visible).map((h) => ({ id: h.id, ...h.p! })), ...heads.sites.map((p) => ({ id: '', ...p! }))]
    const clear = on.find((h) => others.every((o) => o.id === h.id || Math.hypot(o.x - h.p!.x, o.y - h.p!.y) > 40))
    expect(clear, `a drawn POI pin clear of the others (${on.length} on screen)`).toBeDefined()
    const poi = pois.find((p) => p.id === clear!.id)!
    await page.mouse.move(clear!.p!.x, clear!.p!.y)
    const box = page.getByTestId('poi-info')
    await expect(box).toBeVisible()
    await expect(box).toHaveAttribute('data-poi-id', poi.id)
    await expect(box).toHaveAttribute('data-pinned', 'false')
    await expect(box.getByRole('heading', { name: poi.name })).toBeVisible()
    await expect(box.getByRole('link').first()).toHaveAttribute('href', poi.sources[0])
    await expect(box.getByRole('link').first()).toHaveAttribute('target', '_blank')
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: 'test-results/poi-real-pin-1440.png', animations: 'disabled' })
    // Off the pin and away from the box: it goes.
    await page.mouse.move(40, 760)
    await expect(box).toBeHidden()
  })
})

test.describe('POI layer at 375 × 812, touch only', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  test('tap the toggle, switch a group, tap a pin: the box opens and stays, its links fit on screen, Close closes it', async ({ page }) => {
    const pois = await data<Poi[]>(page, 'pois.json')
    const scarp = pois.find((p) => p.id === SCARP)!
    await openApp(page, DEMO)
    await page.getByTestId('poi-toggle').tap()
    const key = page.getByTestId('poi-key')
    await expect(key).toBeVisible()
    await key.locator('.poi-key-item').filter({ hasText: 'Hazards' }).getByRole('checkbox').tap()
    await expect.poll(() => hash(page)).toContain('poi=water,cold-trap,light,landing,science')
    await key.locator('.poi-key-item').filter({ hasText: 'Hazards' }).getByRole('checkbox').tap()
    await expect.poll(() => hash(page)).toContain('poi=all')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    // A tap on the pin: the scene reports the last tapped pin, and the tap keeps its box open.
    await setNamed(page, { name: scarp.name, poiId: SCARP, x: 190, y: 560, visible: true })
    await page.touchscreen.tap(190, 560)
    const box = page.getByTestId('poi-info')
    await expect(box).toHaveAttribute('data-pinned', 'true')
    const b = (await box.boundingBox())!
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.x + b.width).toBeLessThanOrEqual(375)
    await expect(box.getByRole('link').first()).toBeInViewport()
    await box.getByRole('button', { name: 'Close' }).tap()
    await expect(box).toBeHidden()
  })
})

for (const vp of [
  { width: 1440, height: 900, tag: '1440' },
  { width: 375, height: 812, tag: '375' },
]) {
  test(`screenshots: top bar with the layer on, info box at ${vp.tag} px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    const pois = await data<Poi[]>(page, 'pois.json')
    const scarp = pois.find((p) => p.id === SCARP)!
    await openApp(page, `${DEMO}&poi=all`)
    await expect(page.getByTestId('poi-key-note')).toContainText('not validated')
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `test-results/poi-topbar-${vp.tag}.png`, animations: 'disabled' })
    await setNamed(page, { name: scarp.name, poiId: SCARP, x: vp.width / 2, y: vp.height * 0.62, visible: true })
    await expect(page.getByTestId('poi-info')).toBeVisible()
    await page.screenshot({ path: `test-results/poi-info-${vp.tag}.png`, animations: 'disabled' })
    await setNamed(page, undefined)
  })
}
