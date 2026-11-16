// Visual sweep items 1, 2, 9 and 10 (cam, 15 Nov): the POI info card sits beside its pin, flips at the stage's
// edges and keeps off the header, the timeline and the POI key (the placement half of U8); the Sun and Earth labels
// are never drawn over the header text. Screenshots go to test-results/cam-*.png (CAM_SHOTS=<dir> for elsewhere).
// Run: PW_GPU=1 PW_PORT=5181 npx playwright test e2e/cam-visual.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { join } from 'node:path'
import { headerAction } from './header'

const DEMO = 'site=connecting-ridge&period=shackleton-2027-08'
const SHOTS = process.env.CAM_SHOTS ?? 'test-results'
type Box = { x0: number; y0: number; x1: number; y1: number }
type W = Window & { __scene?: { ready: Promise<void> }; __views?: { setNamed(n: unknown): void } }
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

async function open(page: Page, hash: string) {
  await page.goto('about:blank')
  await page.goto(`/?test=1#${hash}`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await page.waitForFunction(() => (window as W).__scene !== undefined, null, { timeout: 60_000 })
  await page.evaluate(() => (window as W).__scene!.ready)
}

/** Page boxes of the header's parts, the timeline footer and the POI key (what a card or label must not cover). */
const textBoxes = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.top > :not(.actions-col), .top .actions-col > *, .bottom > *, .foot, .poi-key')]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom })),
  )
const boxOf = async (page: Page, testId: string): Promise<Box | null> => {
  const b = await page.getByTestId(testId).boundingBox()
  return b && { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height }
}

for (const vp of [
  { name: '1280', width: 1280, height: 720 },
  { name: '375', width: 375, height: 812 },
]) {
  test.describe(`${vp.name} px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('the POI card sits beside its pin at every edge, never on the pin, and off the header, timeline and POI key where there is room', async ({ page }) => {
      await open(page, `${DEMO}&view=site`)
      await (await headerAction(page, 'poi-toggle')).click()
      const stage = (await boxOf(page, 'scene'))!
      const m = 30
      // A pin just above the answer and timeline rows (a pin behind them is hidden by them anyway).
      const bottomY = (await page.evaluate(() => Math.min(...[...document.querySelectorAll('.bottom > *')].map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0).map((r) => r.top)))) - stage.y0 - 20
      const spots: [string, number, number][] = [
        ['top', vp.width / 2, m + 60],
        ['bottom', vp.width / 2, bottomY],
        ['left', m, vp.height / 2],
        ['right', vp.width - m, vp.height / 2],
        ['center', vp.width / 2, vp.height / 2],
      ]
      for (const [edge, x, y] of spots) {
        await page.evaluate((n) => (window as W).__views!.setNamed(n), { name: 'Cabeus', poiId: 'science:feat_cabeus', visible: true, x, y })
        await expect(page.getByTestId('poi-info')).toBeVisible({ timeout: 5000 })
        await page.waitForTimeout(300)
        const card = (await boxOf(page, 'poi-info'))!
        await page.screenshot({ path: join(SHOTS, `cam-poi-card-${edge}-${vp.name}.png`) })
        const pin = { x: stage.x0 + x, y: stage.y0 + y }
        expect(pin.x > card.x0 && pin.x < card.x1 && pin.y > card.y0 && pin.y < card.y1, `${edge}: the card covers its pin`).toBe(false)
        expect(card.x0 >= stage.x0 && card.x1 <= stage.x1 + 0.5 && card.y0 >= stage.y0 && card.y1 <= stage.y1 + 0.5, `${edge}: inside the stage`).toBe(true)
        // On a phone the card is as wide as the stage allows and may have no free side. On the desktop it has one, except
        // at the right edge between the POI key and the answer row (about 220 px for a card about 320 px tall: there
        // it takes the side that covers least).
        if (vp.width >= 1000 && edge !== 'right') {
          const hit = (await textBoxes(page)).filter((b) => overlaps(card, b))
          expect(hit, `${edge}: the card covers the header, the timeline or the POI key`).toEqual([])
        }
      }
    })

    test('while the simulation plays, the Sun and Earth labels are not drawn over the header text', async ({ page }) => {
      await open(page, `${DEMO}&view=site`)
      await page.getByTestId('simulate').click()
      const text = await textBoxes(page)
      for (let k = 0; k < 12; k++) {
        await page.waitForTimeout(250)
        for (const id of ['label-sun', 'label-earth']) {
          const el = page.getByTestId(id)
          if (!(await el.isVisible())) continue
          const b = await boxOf(page, id)
          if (!b) continue // hidden between the two calls
          expect(text.filter((t) => overlaps(b, t)), `${id} over the page text`).toEqual([])
        }
      }
      await page.screenshot({ path: join(SHOTS, `cam-sim-playing-${vp.name}.png`) })
    })
  })
}

// 16 Nov (3D audit, 15 Nov): the Sun and Earth labels lay on each other when the two bodies stand a few degrees apart
// low over the horizon (around full Moon the Sun and Earth are close together in the Moon's sky). SceneView moves one
// of them to another side of its tick. The sweep steps through the mission.
for (const vp of [
  { name: '1280', width: 1280, height: 720 },
  { name: '375', width: 375, height: 812 },
]) {
  test(`${vp.name} px: the Sun and Earth labels never lie on each other, on the page text or on the Landing site label, also when the bodies are a few degrees apart`, async ({ page }) => {
    test.setTimeout(300_000)
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await open(page, `${DEMO}&view=site`)
    const read = () =>
      page.evaluate(() => {
        const r = (id: string) => {
          const el = document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
          if (!el || el.closest('[hidden]')) return null
          const b = el.getBoundingClientRect()
          const p = el.parentElement!.getBoundingClientRect() // the zero-size anchor at the body's point
          const side = ['is-below', 'is-right', 'is-left'].find((c) => el.classList.contains(c)) ?? 'above'
          return b.width ? { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom, px: p.left, py: p.top, side, apart: el.dataset.apart ?? null } : null
        }
        return { sun: r('label-sun'), earth: r('label-earth'), site: r('label-site') }
      })
    const START = Date.UTC(2027, 7, 16)
    const HOUR = 3_600_000
    let both = 0
    let moved = 0
    let shot = false
    const at = async (ms: number) => {
      const t = new Date(ms).toISOString().slice(0, 16) + 'Z'
      await page.evaluate((hash) => (location.hash = hash), `${DEMO}&view=site&t=${t}`)
      await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready')
      // the scene has drawn this time once the labels rest: two equal readings 80 ms apart
      let now = await read()
      for (let k = 0; k < 40; k++) {
        await page.waitForTimeout(80)
        const next = await read()
        const same = JSON.stringify(next) === JSON.stringify(now)
        now = next
        if (same) break
      }
      const { sun, earth, site } = now
      const text = await textBoxes(page)
      for (const [id, b] of [['label-sun', sun], ['label-earth', earth]] as const) {
        if (b) expect(text.filter((x) => overlaps(b, x)), `${id} over the page text at ${t}`).toEqual([])
      }
      if (!sun || !earth) return null
      both++
      expect(overlaps(sun, earth), `the labels overlap at ${t}: Sun ${sun.side}, Earth ${earth.side}`).toBe(false)
      for (const b of [sun, earth]) {
        if (!b.apart) continue
        moved++
        if (site) expect(overlaps(b, site), `a moved label covers the Landing site label at ${t}`).toBe(false)
        if (!shot) {
          shot = true
          await page.screenshot({ path: join(SHOTS, `cam-labels-apart-${vp.name}.png`) })
        }
      }
      return Math.hypot(sun.px - earth.px, sun.py - earth.py)
    }
    // Every 2 h through the mission; where the two points come within 250 px, the half hours around that step too
    // (the ephemeris step), so the passage of one body past the other is not stepped over.
    for (let h = 0; h < 14 * 24; h += 2) {
      const d = await at(START + h * HOUR)
      if (d !== null && d < 250) for (const m of [0.5, 1, 1.5]) await at(START + (h + m) * HOUR)
    }
    console.log(`Sun/Earth labels at ${vp.name} px: both drawn at ${both} times, one moved off the other at ${moved}, none overlapping`)
    // The sweep must meet the case it is for and solve it by moving a label (desktop: the phone's narrow view rarely
    // holds both bodies under its header).
    if (vp.width > 640) expect(moved).toBeGreaterThan(0)
  })
}

test('U7: the search panel no longer says per point that it waits for the science lead', async ({ page }) => {
  await open(page, `${DEMO}&view=site`)
  await page.getByTestId('search-open').click()
  const panel = page.getByTestId('search')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Distances are measured along the surface of a 1737.4 km sphere')
  await expect(panel).not.toContainText('science lead')
})

test('visual sweep 20: at site level a POI on the landing site itself is left to the mast; one 3 km out is drawn', async ({ page }) => {
  await page.goto('/src/scene3d/harness.html?test=1&site=connecting-ridge&level=site')
  await page.waitForFunction(() => (window as unknown as { __scene?: { ready: Promise<void> } }).__scene !== undefined)
  type S = { ready: Promise<void>; frame?: unknown; siteId(): string | null; handle(): { setPois(p: unknown[]): void }; pins(): { near: { id: string }[] } }
  await page.evaluate(() => (window as unknown as { __scene: S }).__scene.ready)
  await page.waitForFunction(() => (window as unknown as { __scene: S }).__scene.siteId() === 'connecting-ridge', null, { timeout: 60_000 })
  const ids = await page.evaluate(async () => {
    const s = (window as unknown as { __scene: S }).__scene
    const sites = (await (await fetch('/data/sites.json')).json()) as { id: string; lat: number; lon: number }[]
    const r = sites.find((x) => x.id === 'connecting-ridge')!
    s.handle().setPois([
      { id: 'on-site', name: 'On the site', lat: r.lat, lon: r.lon, color: '#ff00ff', landing: true },
      { id: 'near-site', name: '100 m out', lat: r.lat + 0.003, lon: r.lon, color: '#ff00ff', landing: false },
      { id: 'three-km', name: '3 km out', lat: r.lat + 0.1, lon: r.lon, color: '#ff00ff', landing: false },
    ])
    return s.pins().near.map((n) => n.id)
  })
  expect(ids).toContain('three-km')
  expect(ids).not.toContain('on-site')
  expect(ids).not.toContain('near-site')
})
