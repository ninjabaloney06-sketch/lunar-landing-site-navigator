// Flight calculator as a sub-feature: a saved mission carries its launchpad, rocket and surface stay; "Calculate
// flight" on its row opens the Rocket flight menu with exactly those values; the result leads with the maximum
// payload (the energy multiplier was removed on 15 Nov); the layer toggles are visible without opening anything. Apollo is used because its plan takes
// about two seconds (a halo-orbit plan about ten).
// Run: PW_PORT=5186 npx playwright test e2e/flight.spec.ts
import { expect, test } from '@playwright/test'

const MISSION = 'site=haworth&name=Haworth+flight&pad=kourou-ela4&rocket=apollo&stay=2'

test.beforeEach(async ({ page }) => {
  await page.addInitScript((m) => window.localStorage.setItem('llsn.missions.v1', JSON.stringify([m])), MISSION)
})

test('Calculate flight on a saved mission opens the Rocket flight menu pre-filled, max payload first', async ({ page }) => {
  await page.goto('/#drawer=details')
  const row = page.locator(`tr[data-mission="${MISSION}"]`)
  await expect(row).toBeVisible()
  await expect(row.getByTestId('mission-flight')).toHaveText('ELA-4 · Apollo · 2 d on the surface')
  await row.getByTestId('calculate-flight').click()

  // the mission's values, in the link and in the menu
  await expect(page).toHaveURL(/view=flight/)
  const hash = new URLSearchParams(new URL(page.url()).hash.slice(1))
  expect(Object.fromEntries(['site', 'pad', 'rocket', 'stay', 'name'].map((k) => [k, hash.get(k)]))).toEqual({
    site: 'haworth', pad: 'kourou-ela4', rocket: 'apollo', stay: '2', name: 'Haworth flight',
  })
  const panel = page.getByTestId('flight-panel')
  await expect(panel.getByTestId('flight-mission')).toContainText('Haworth flight')
  await expect(panel.getByTestId('flight-mission')).toContainText('Haworth')
  await expect(panel.getByTestId('flight-design-apollo')).toBeChecked()
  await expect(panel.getByTestId('flight-pad')).toHaveValue('kourou-ela4')
  await expect(panel.getByTestId('flight-stay')).toHaveValue('2')

  // the result: the maximum payload with its 1σ and the validation marker; no energy multiplier any more
  const payload = panel.getByTestId('flight-payload')
  await expect(payload).toHaveAttribute('data-state', 'ready', { timeout: 90_000 })
  await expect(payload).toContainText(/Max payload: [\d,]+ kg ± [\d,.]+ kg \(1σ\)/)
  await expect(payload).toContainText('Not yet validated by the science lead.')
  await expect(panel.getByTestId('flight-result')).not.toContainText('×')
  await expect(panel.getByTestId('flight-result')).not.toContainText('MJ')

  // layer toggles: in view and working without opening a menu
  for (const k of ['paths', 'burns', 'burnNames', 'stageNames', 'trail']) await expect(page.getByTestId(`layer-${k}`)).toBeVisible()
  await page.getByTestId('layer-paths').uncheck()
  await expect(page.getByTestId('layer-paths')).not.toBeChecked()
})

test('switching to SLS keeps the site and offers its two landers; saving keeps the flight choices', async ({ page }) => {
  await page.goto('/#view=flight&site=haworth&rocket=apollo&name=Switch+test')
  const panel = page.getByTestId('flight-panel')
  await panel.getByTestId('flight-design-sls').check()
  await expect(page).not.toHaveURL(/rocket=apollo/)
  await expect(panel.getByTestId('flight-lander-artemis-starship')).toHaveAttribute('aria-checked', 'true')
  await panel.getByTestId('flight-lander-artemis-blue-moon').click()
  await expect(page).toHaveURL(/rocket=artemis-blue-moon/)
  await expect(panel.getByTestId('flight-mission')).toContainText('Haworth')

  await panel.getByTestId('flight-save-mission').click()
  await expect(panel.getByTestId('flight-save-mission')).toBeDisabled()
  const saved = await page.evaluate(() => JSON.parse(window.localStorage.getItem('llsn.missions.v1') ?? '[]') as string[])
  expect(saved.some((s) => s.includes('site=haworth') && s.includes('rocket=artemis-blue-moon') && s.includes('name=Switch+test'))).toBe(true)
})
