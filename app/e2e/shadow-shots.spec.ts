// Pictures of the terrain light for a human to look at (not an assertion): the default landing-site view of
// Connecting Ridge every 6 h over 16–29 Aug 2027 (the default Play), and five other sites at three times.
// Only runs when SHOTS is set: SHOTS=after PW_GPU=1 PW_PORT=5221 npx playwright test e2e/shadow-shots.spec.ts
// Output: test-results/shadows/<SHOTS>-*.png
import { test, type Page } from '@playwright/test'

const TAG = process.env.SHOTS
const scene = <T>(page: Page, fn: string) => page.evaluate(`(${fn})(window.__scene)`) as Promise<T>

async function open(page: Page) {
  await page.goto('/?test=1#site=connecting-ridge&period=shackleton-2027-08&view=site')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, '(s) => s.ready')
}

test.describe('terrain light pictures', () => {
  test.skip(!TAG, 'set SHOTS=<tag> to write the pictures')
  test.setTimeout(600_000)

  test('default Play, every 6 h', async ({ page }) => {
    await open(page)
    const t0 = Date.parse('2027-08-16T00:00Z')
    for (let k = 0; k <= 13 * 4; k++) {
      const utc = new Date(t0 + k * 6 * 3600_000).toISOString()
      await scene(page, `(s) => s.setView({ site: 'connecting-ridge', utc: '${utc}', level: 'site' })`)
      await page.screenshot({ path: `test-results/shadows/${TAG}-play-${utc.slice(5, 13)}.png` })
    }
  })

  test('five other sites', async ({ page }) => {
    await open(page)
    for (const site of ['haworth', 'shackleton-rim-site04', 'malapert-massif', 'im-1', 'nobile-rim-1']) {
      for (const utc of ['2027-08-17T00:00Z', '2027-08-22T12:00Z', '2027-08-27T00:00Z']) {
        await scene(page, `(s) => s.setView({ site: '${site}', utc: '${utc}', level: 'site' })`)
        await page.screenshot({ path: `test-results/shadows/${TAG}-${site}-${utc.slice(5, 13)}.png` })
      }
      await scene(page, `(s) => s.setView({ site: '${site}', utc: '2027-08-22T12:00Z', level: 'eye' })`)
      await page.screenshot({ path: `test-results/shadows/${TAG}-${site}-eye.png` })
      await scene(page, `(s) => s.setView({ site: '${site}', utc: '2027-08-22T12:00Z', level: 'site', az: 0, el: 60, dist: 55 })`)
      await page.screenshot({ path: `test-results/shadows/${TAG}-${site}-high.png` })
    }
  })
})
