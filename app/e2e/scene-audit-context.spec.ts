// Scene audit (15 Nov): WebGL context loss and restore, and a change of devicePixelRatio.
// Before the fix a restored context left the canvas black until the user moved the camera (the loop draws only dirty
// frames), and a devicePixelRatio change (window dragged to another monitor, browser zoom) left the drawing buffer
// at the old size.
// Run: PW_GPU=1 PW_PORT=5217 npx playwright test e2e/scene-audit-context.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'

async function open(page: Page) {
  await page.goto('/?test=1#site=haworth&period=shackleton-2027-08&view=site')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await page.evaluate(() => (window as unknown as { __scene: { ready: Promise<void> } }).__scene.ready)
  await page.waitForTimeout(800)
}

async function meanLuma(page: Page): Promise<number> {
  const p = PNG.sync.read(await page.locator('canvas').first().screenshot())
  let s = 0
  for (let i = 0; i < p.data.length; i += 4) s += p.data[i] + p.data[i + 1] + p.data[i + 2]
  return s / (p.data.length / 4) / 3
}

test('the picture comes back by itself after the WebGL context is lost and restored', async ({ page }) => {
  test.setTimeout(120_000)
  const logs: string[] = []
  page.on('console', (m) => logs.push(m.text()))
  await open(page)
  const before = await meanLuma(page)
  // 16 Nov 2026: with real cast shadows most of this Haworth picture is shadow (mean about 19); the check is
  // "a picture is drawn", and the restored canvas below is still compared with this value.
  expect(before).toBeGreaterThan(12)
  await page.evaluate(() => {
    const c = document.querySelector('canvas')!
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGL2RenderingContext
    ;(window as unknown as { __lose: WEBGL_lose_context }).__lose = gl.getExtension('WEBGL_lose_context')!
    ;(window as unknown as { __lose: WEBGL_lose_context }).__lose.loseContext()
  })
  await page.waitForTimeout(300)
  await page.evaluate(() => (window as unknown as { __lose: WEBGL_lose_context }).__lose.restoreContext())
  await page.waitForTimeout(2000)
  const after = await meanLuma(page)
  expect(after).toBeGreaterThan(before * 0.8)
  expect(after).toBeLessThan(before * 1.25)
  expect(logs.filter((l) => /THREE\.[A-Za-z]+: .*(error|invalid)/i.test(l))).toEqual([])
})

test('a devicePixelRatio change resizes the drawing buffer', async ({ page }) => {
  test.setTimeout(120_000)
  // The emulation changes devicePixelRatio but Chromium does not fire the (resolution) query's change event for it, as
  // a real monitor change does: record the app's queries and fire their change event ourselves.
  await page.addInitScript(() => {
    const w = window as unknown as { __mq: MediaQueryList[] }
    w.__mq = []
    const orig = window.matchMedia.bind(window)
    window.matchMedia = (q: string) => {
      const m = orig(q)
      if (/resolution/.test(q)) w.__mq.push(m)
      return m
    }
  })
  await open(page)
  const fire = () => page.evaluate(() => (window as unknown as { __mq: MediaQueryList[] }).__mq.forEach((m) => m.dispatchEvent(new Event('change'))))
  const cdp = await page.context().newCDPSession(page)
  const buf = () => page.evaluate(() => { const c = document.querySelector('canvas')!; return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, dpr: window.devicePixelRatio } })
  for (const dpr of [1, 1.25, 2, 1]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: dpr, mobile: false })
    await fire()
    await expect.poll(async () => (await buf()).w, { timeout: 5000 }).toBe(Math.round((await buf()).cw * Math.min(dpr, 1.5)))
    const b = await buf()
    expect(b.h).toBe(Math.round(b.ch * Math.min(dpr, 1.5)))
  }
})
