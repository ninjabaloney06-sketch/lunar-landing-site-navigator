// Visual sweep items 1, 2, 9 and 10 (cam, 15 Nov): the POI info card sits beside its pin, flips at the stage's
// edges and keeps off the header, the timeline and the POI key (the placement half of U8); the Sun and Earth labels
// are never drawn over the header text. Screenshots go to test-results/cam-*.png (CAM_SHOTS=<dir> for elsewhere).
// Run: PW_GPU=1 PW_PORT=5181 npx playwright test e2e/cam-visual.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { join } from 'node:path'

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
      await page.getByTestId('poi-toggle').click()
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

test('U7: the search panel no longer says per point that it waits for the science lead', async ({ page }) => {
  await open(page, `${DEMO}&view=site`)
  await page.getByTestId('search-open').click()
  const panel = page.getByTestId('search')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Distances are measured along the surface of a 1737.4 km sphere')
  await expect(panel).not.toContainText('science lead')
})
