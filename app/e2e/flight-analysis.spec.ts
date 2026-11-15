// The analyses of the Rocket flight menu (all marked "not yet validated by the science lead"): the landing
// dispersion and the cheapest route start only on the user's click, show progress, can be stopped, are dropped
// when the inputs change, and answer in one sentence. Also the menu's fit at 375 px and 1280 px.
// Screenshots go to SHOTS_DIR when it is set (the build run's reports folder).
// Run: PW_GPU=1 PW_PORT=5188 npx playwright test e2e/flight-analysis.spec.ts
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const URL = '/#view=flight&site=haworth&rocket=apollo&name=Haworth+flight'
const SHOTS = process.env.SHOTS_DIR

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

async function ready(page: Page) {
  const panel = page.getByTestId('flight-panel')
  await expect(panel.getByTestId('flight-payload')).toHaveAttribute('data-state', 'ready', { timeout: 90_000 })
  return panel
}

test('landing dispersion: started by a click, shows progress, answers in one sentence with what it means', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(URL)
  const panel = await ready(page)
  const job = panel.getByTestId('flight-dispersion')
  await expect(job).toHaveAttribute('data-state', 'idle')
  await shot(page, 'flight-1280-result')
  await panel.getByTestId('flight-dispersion-start').click()
  await expect(job).toHaveAttribute('data-state', /running|ready/)
  await expect(job).toHaveAttribute('data-state', 'ready', { timeout: 120_000 })
  const sentence = panel.getByTestId('flight-dispersion-sentence')
  await expect(sentence).toContainText(/Landing dispersion \(3σ, \d+ of 200 unguided runs\): [\d.]+ × [\d.]+ km ellipse/)
  await expect(sentence).toContainText('Not yet validated by the science lead.')
  await expect(job).toContainText('Every error size is an assumption')
  await expect(job).toContainText('guided lander lands much closer')
  await shot(page, 'flight-1280-dispersion')
  // the tube is a layer like the others, offered once there is a dispersion
  const tube = page.getByTestId('layer-tube')
  await expect(tube).toBeChecked()
  await page.getByTestId('flight-focus').selectOption('lander')
  // a moment of the powered descent: PDI on the timeline
  await page.locator('[data-tick="pdi"]').dispatchEvent('click') // the PDI block sits under its DOI neighbour
  await page.waitForTimeout(1500)
  await shot(page, 'flight-1280-tube')
  await tube.uncheck()
  await expect(tube).not.toBeChecked()
})

test('a running dispersion is dropped when the inputs change', async ({ page }) => {
  await page.goto(URL)
  const panel = await ready(page)
  await panel.getByTestId('flight-dispersion-start').click()
  await expect(panel.getByTestId('flight-dispersion')).toHaveAttribute('data-state', 'running')
  await panel.getByTestId('flight-stay').fill('2')
  // the new inputs give a new plan; the old analysis is gone, not finished for the wrong plan
  await expect(panel.getByTestId('flight-payload')).toHaveAttribute('data-state', 'ready', { timeout: 90_000 })
  await expect(panel.getByTestId('flight-dispersion')).toHaveAttribute('data-state', 'idle')
})

test('cheapest route: started by a click, shows progress, can be stopped, answers in one sentence', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto(URL)
  const panel = await ready(page)
  const job = panel.getByTestId('flight-route')
  await panel.getByTestId('flight-route-start').click()
  await expect(job).toHaveAttribute('data-state', 'running')
  await expect(job).toContainText(/Planning option \d of 6/)
  await job.getByRole('button', { name: 'Stop' }).click()
  await expect(job).toHaveAttribute('data-state', 'idle')
  await panel.getByTestId('flight-route-start').click()
  await expect(job).toHaveAttribute('data-state', 'ready', { timeout: 180_000 })
  await expect(panel.getByTestId('flight-route-sentence')).toContainText(/^(Least propellant|Only one option)/)
  await expect(panel.getByTestId('flight-route-sentence')).toContainText('Not yet validated by the science lead.')
  await panel.locator('[data-section="route"] > summary').click()
  await expect(panel.getByTestId('flight-route-details')).toContainText('m/s')
  await shot(page, 'flight-1280-route')
})

test('375 px: the menu leaves the trajectory visible and nothing runs off the right edge', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(URL)
  await ready(page)
  await shot(page, 'flight-375-result')
  const vw = 375
  const panel = await page.getByTestId('flight-panel').boundingBox()
  expect(panel).not.toBeNull()
  // the panel takes at most about half of the screen height: the 3D view stays visible
  expect(panel!.height).toBeLessThan(812 * 0.55)
  // no element of the playback bar or the panel sticks out on the right
  const overflow = await page.evaluate((w) => {
    const out: string[] = []
    for (const el of document.querySelectorAll('.flight-panel *, .flight-transport *')) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.right > w + 1) out.push(`${el.tagName}.${(el as HTMLElement).className} "${(el.textContent ?? "").slice(0, 30)}" ${Math.round(r.right)}`)
    }
    return out
  }, vw)
  expect(overflow).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw)
})

test('full data mode: the switch sits in the panel and opens the details; summary keeps them closed', async ({ page }) => {
  await page.goto(URL)
  const panel = await ready(page)
  const payloadSec = panel.locator('[data-section="payload"]')
  await expect(payloadSec).not.toHaveAttribute('open', '')
  await panel.getByTestId('full-data-switch').click()
  await expect(payloadSec).toHaveAttribute('open', '')
  await expect(panel.getByTestId('flight-payload-details')).toContainText('Limited by the')
  await expect(panel.getByTestId('flight-payload-details')).toContainText('Largest uncertainty')
  await expect(panel.locator('[data-section="propellant"]')).toHaveAttribute('open', '')
  await panel.getByTestId('full-data-switch').click()
  await expect(payloadSec).not.toHaveAttribute('open', '')
})

test('Blue Moon: the payload cannot be decided from published data, and the propellant figure is marked a lower bound', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/#view=flight&site=haworth&rocket=artemis-blue-moon&name=Blue+Moon+test')
  const panel = page.getByTestId('flight-panel')
  const payload = panel.getByTestId('flight-payload')
  await expect(payload).toHaveAttribute('data-state', 'ready', { timeout: 150_000 })
  await expect(payload).toHaveAttribute('data-verdict', 'undetermined')
  await expect(payload).toContainText('cannot be decided from published data')
  await expect(panel.getByTestId('flight-lower-bound')).toContainText('Propellant shown (29 t) is a lower bound')
  await expect(panel.getByTestId('flight-lower-bound')).toContainText('Not yet validated by the science lead.')
  await shot(page, 'flight-1280-blue-moon')
})
