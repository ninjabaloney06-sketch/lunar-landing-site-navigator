// Scene audit (15 Nov): earthshine and the night fill are one level for the whole scene (site.setLevels); with the
// per-place sunlight they must stay within their caps and fade as the site's Sun share rises, at all 18 sites and
// three times, so a shadowed site is never brighter than before. (The seam check of the Sun share itself is the
// vitest src/scene3d/sunlight-seams.test.ts: on the drawn terrain the share steps legitimately where the ground
// is steep next to the crest.)
// Run: PW_GPU=1 PW_PORT=5217 npx playwright test e2e/scene-audit-fills.spec.ts
import { expect, test } from '@playwright/test'

const SITES = [
  'haworth', 'malapert-massif', 'nobile-rim-1', 'nobile-rim-2', 'de-gerlache-rim-2', 'amundsen-rim', 'connecting-ridge-extension', 'faustini-rim-a',
  'leibnitz-beta-plateau', 'peak-near-shackleton', 'de-gerlache-rim-1', 'de-gerlache-kocher-massif', 'malapert-site23', 'shackleton-rim-site04',
  'connecting-ridge', 'im-1', 'im-2-intended', 'viper-mons-mouton',
]
const TIMES = ['2027-08-17T00:00Z', '2027-08-22T00:00Z', '2027-08-26T12:00Z']
const NIGHT_FILL_MAX = 0.05 * Math.PI
const EARTHSHINE_MAX = 0.06 * Math.PI

type Scene = {
  ready: Promise<void>
  setView(o: Record<string, unknown>): Promise<unknown>
  lights(): { sun: number; hidden: number; fill: number; earth: number }
}

test('night fill and earthshine stay within their caps and fade with the site share at all sites', async ({ page }) => {
  test.setTimeout(300_000)
  await page.goto('/?test=1#site=haworth&period=shackleton-2027-08&view=site')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await page.evaluate(() => (window as unknown as { __scene: Scene }).__scene.ready)
  for (const id of SITES) {
    for (const t of TIMES) {
      const l = await page.evaluate(
        async ([id, t]) => {
          const s = (window as unknown as { __scene: Scene }).__scene
          await s.setView({ site: id, utc: t, level: 'site' })
          return s.lights()
        },
        [id, t],
      )
      expect(l.fill, `${id} ${t}`).toBeLessThanOrEqual(NIGHT_FILL_MAX + 1e-9)
      expect(l.earth, `${id} ${t}`).toBeLessThanOrEqual(EARTHSHINE_MAX + 1e-9)
      expect(l.sun).toBeGreaterThanOrEqual(l.hidden - 1e-9)
      const share = (l.sun - l.hidden) / (1 - l.hidden)
      expect(l.fill).toBeCloseTo(NIGHT_FILL_MAX * (1 - share), 6)
    }
  }
})
