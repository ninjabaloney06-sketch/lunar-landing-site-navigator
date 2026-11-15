// User points (U10, U11): "Set … as landing site" on a second point makes THAT point the landing site, not the one
// set before; points have no role. Run: PW_GPU=1 PW_PORT=5182 npx playwright test e2e/points.spec.ts --workers=1
import { expect, test, type Page } from '@playwright/test'

const RIDGE = 'connecting-ridge'
const AUG = 'shackleton-2027-08'
// Two places about 1 km from Connecting Ridge, inside the pin region.
const A = { text: '89.47 S, 136.78 W', id: 'cap:-89.47000,-136.78000', shown: '89.47° S · 136.78° W' }
const B = { text: '89.43 S, 137.50 W', id: 'cap:-89.43000,-137.50000', shown: '89.43° S · 137.50° W' }

type Pt = { x: number; y: number; visible: boolean }
type SceneDebug = { ready: Promise<void>; projectMark(i: number): Pt | null }

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

async function addTyped(page: Page, text: string) {
  const panel = await openPanel(page)
  await panel.getByRole('combobox', { name: 'Search a site or type coordinates' }).fill(text)
  await panel.getByTestId('add-point').click()
  return panel
}

test.describe('user points at 1440 × 900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('U11: after a second point is added, its row sets it as the landing site, not the first one', async ({ page }) => {
    test.setTimeout(240_000)
    await openApp(page, `site=${RIDGE}&period=${AUG}`)
    let panel = await addTyped(page, A.text)
    await panel.getByRole('button', { name: 'Set as landing site: Point A' }).click()
    await expect.poll(() => hashSite(page)).toBe(A.id)
    await expect(page.getByTestId('answer')).toHaveAttribute('data-site-id', A.id, { timeout: 60_000 })

    panel = await addTyped(page, B.text)
    await expect(panel.getByTestId('point')).toHaveCount(2)
    await panel.getByRole('button', { name: 'Set as landing site: Point B' }).click()
    await expect.poll(() => hashSite(page)).toBe(B.id)
    await expect(page.getByTestId('coords')).toHaveText(B.shown)
    await expect(page.getByTestId('answer')).toHaveAttribute('data-site-id', B.id, { timeout: 60_000 })
  })

  test('U11: a right-click on empty ground offers no "Set … as landing site" for the point set before; the new point there becomes the landing site', async ({ page }) => {
    test.setTimeout(240_000)
    await openApp(page, `site=${RIDGE}&period=${AUG}`)
    const panel = await addTyped(page, A.text)
    await panel.getByRole('button', { name: 'Set as landing site: Point A' }).click()
    await expect.poll(() => hashSite(page)).toBe(A.id)
    await expect(page.getByTestId('answer')).toHaveAttribute('data-site-id', A.id, { timeout: 60_000 })
    // Point A is still the selected point; the pointer is far from its marker.
    const a = (await page.evaluate(() => (window as unknown as { __scene: SceneDebug }).__scene.projectMark(0)))!
    const spot = { x: a.x + 180, y: a.y + 170 }
    await page.mouse.move(spot.x, spot.y)
    await page.mouse.click(spot.x, spot.y, { button: 'right' })
    const menu = page.getByTestId('scene-menu')
    await expect(menu.getByRole('menuitem', { name: 'Add point here' })).toBeEnabled()
    await expect(menu.getByRole('menuitem', { name: /as landing site/ })).toHaveCount(0)
    // The second point, added there, is the one the menu on its marker sets.
    await menu.getByRole('menuitem', { name: 'Add point here' }).click()
    await expect(page.getByTestId('scene-menu')).toHaveCount(0)
    const b = (await page.evaluate(() => (window as unknown as { __scene: SceneDebug }).__scene.projectMark(1)))!
    await page.mouse.move(b.x, b.y)
    await page.mouse.click(b.x, b.y, { button: 'right' })
    await expect(menu.getByRole('menuitem', { name: /as landing site/ })).toHaveText('Set Point B as landing site')
    const before = await hashSite(page)
    await menu.getByRole('menuitem', { name: 'Set Point B as landing site' }).click()
    await expect.poll(() => hashSite(page)).not.toBe(before)
    expect(await hashSite(page)).toMatch(/^cap:/)
  })

  test('U11: the right-click menu on the second point sets that point as the landing site', async ({ page }) => {
    test.setTimeout(240_000)
    await openApp(page, `site=${RIDGE}&period=${AUG}`)
    let panel = await addTyped(page, A.text)
    await panel.getByRole('button', { name: 'Set as landing site: Point A' }).click()
    await expect.poll(() => hashSite(page)).toBe(A.id)
    await expect(page.getByTestId('answer')).toHaveAttribute('data-site-id', A.id, { timeout: 60_000 })
    panel = await addTyped(page, B.text)
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)

    await expect
      .poll(async () => (await page.evaluate(() => (window as unknown as { __scene: SceneDebug }).__scene.projectMark(1)))?.visible ?? false, { timeout: 30_000 })
      .toBe(true)
    const mark = (await page.evaluate(() => (window as unknown as { __scene: SceneDebug }).__scene.projectMark(1)))!
    await page.mouse.move(mark.x, mark.y)
    await expect(page.getByTestId('pin-name')).toHaveText('Point B')
    await page.mouse.click(mark.x, mark.y, { button: 'right' })
    const menu = page.getByTestId('scene-menu')
    await menu.getByRole('menuitem', { name: 'Set Point B as landing site' }).click()
    await expect.poll(() => hashSite(page)).toBe(B.id)
    await expect(page.getByTestId('coords')).toHaveText(B.shown)
    await expect(page.getByTestId('answer')).toHaveAttribute('data-site-id', B.id, { timeout: 60_000 })
  })
})
