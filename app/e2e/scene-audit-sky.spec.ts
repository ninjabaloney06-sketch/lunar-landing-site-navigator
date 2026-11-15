// Scene audit (15 Nov): the Sun and Earth drawn in the site sky are where the geometry module (the app's own
// numbers) puts them, over a 14-day play at three sites: sunAzEl()/earthAzEl() against geometry.azEl on the
// frame's ephemeris state (within 0.01 deg), and the marker on screen: an eye-level camera aimed at the computed
// az/el has the body's label point at the middle of the picture (2 px).
// Run: PW_GPU=1 PW_PORT=5217 npx playwright test e2e/scene-audit-sky.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { azEl, enuBasis, siteVector, type BodyState } from '../src/geometry'

const SITES = ['haworth', 'connecting-ridge', 'malapert-massif']
const START = Date.parse('2027-08-16T00:00Z')
const STEP_MS = 12 * 3600e3
const N = 28 // 14 days

type Pt = { x: number; y: number; visible: boolean } | null
type Scene = {
  ready: Promise<void>
  setView(o: Record<string, unknown>): Promise<{ width: number; height: number }>
  sunAzEl(): { az: number; el: number } | null
  earthAzEl(): { az: number; el: number } | null
  frameInfo(): { state: BodyState; site: { lat: number; lon: number; elev_m: number | null } } | null
  project(n: string): Pt
  load(id: string, utc: number): Promise<void>
}

const dAz = (a: number, b: number) => Math.abs((((a - b + 540) % 360) + 360) % 360 - 180)

test('Sun and Earth in the sky agree with geometry.azEl over a 14-day play, at three sites', async ({ page }: { page: Page }) => {
  test.setTimeout(300_000)
  await page.goto('/?test=1#site=haworth&period=shackleton-2027-08&view=site')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await page.evaluate(() => (window as unknown as { __scene: Scene }).__scene.ready)
  let centred = 0
  for (const id of SITES) {
    for (let i = 0; i < N; i++) {
      const t = START + i * STEP_MS
      const r = await page.evaluate(
        async ([id, t]) => {
          const s = (window as unknown as { __scene: Scene }).__scene
          await s.setView({ site: id as string, utc: t as number, level: 'eye', az: 0, el: 3 })
          const info = s.frameInfo()!
          const out: Record<string, unknown> = { info, sun: s.sunAzEl(), earth: s.earthAzEl() }
          for (const b of ['sun', 'earth'] as const) {
            const a = (b === 'sun' ? s.sunAzEl() : s.earthAzEl())!
            if (a.el < 1.5) continue
            const cam = await s.setView({ level: 'eye', az: a.az, el: a.el })
            out[b + 'Pt'] = { p: s.project(b), w: cam.width, h: cam.height }
          }
          return out
        },
        [id, t],
      )
      const info = r.info as { state: BodyState; site: { lat: number; lon: number; elev_m: number | null } }
      const enu = enuBasis(info.site.lat, info.site.lon)
      const sk = siteVector(info.site.lat, info.site.lon, (info.site.elev_m ?? 0) / 1000)
      for (const [b, km] of [['sun', info.state.sun_km], ['earth', info.state.earth_km]] as const) {
        const want = azEl(km, sk, enu)
        const got = r[b] as { az: number; el: number }
        expect(dAz(got.az, want.az), `${id} ${new Date(t).toISOString()} ${b} az`).toBeLessThan(0.01)
        expect(Math.abs(got.el - want.el), `${id} ${new Date(t).toISOString()} ${b} el`).toBeLessThan(0.01)
        const m = r[b + 'Pt'] as { p: Pt; w: number; h: number } | undefined
        if (m?.p) {
          centred++
          expect(Math.hypot(m.p.x - m.w / 2, m.p.y - m.h / 2), `${id} ${new Date(t).toISOString()} ${b} marker`).toBeLessThan(2)
        }
      }
    }
  }
  expect(centred).toBeGreaterThan(20)
})
