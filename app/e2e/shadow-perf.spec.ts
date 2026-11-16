// Frame time of the default Play (a measurement for a human, not an assertion; it depends on the machine).
// Chromium runs without vsync and without the frame-rate limit, so the time between two animation frames is what a
// frame costs (JS, the shadow passes, the draw). Only runs when PERF is set:
// PERF=after PW_GPU=1 PW_PORT=5221 npx playwright test e2e/shadow-perf.spec.ts
import { expect, test, type Page } from '@playwright/test'

const TAG = process.env.PERF
test.use({
  launchOptions: {
    args: [
      '--use-angle=' + (process.platform === 'win32' ? 'd3d11' : 'default'),
      '--ignore-gpu-blocklist',
      '--enable-gpu',
      '--enable-gpu-rasterization',
      '--disable-gpu-vsync',
      '--disable-frame-rate-limit',
    ],
  },
})

async function measure(page: Page, label: string) {
  await page.goto('/#site=connecting-ridge&period=shackleton-2027-08&view=site')
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await page.waitForTimeout(6000) // the first picture, the near level and the fly have settled
  const frames = (ms: number) =>
    page.evaluate(
      (ms) =>
        new Promise<number[]>((resolve) => {
          const d: number[] = []
          let last = performance.now()
          const t0 = last
          const step = (t: number) => {
            d.push(t - last)
            last = t
            if (t - t0 < ms) requestAnimationFrame(step)
            else resolve(d)
          }
          requestAnimationFrame(step)
        }),
      ms,
    )
  const stats = (d: number[]) => {
    const v = d.slice(5).sort((a, b) => a - b)
    const q = (p: number) => v[Math.min(Math.floor(v.length * p), v.length - 1)]
    return `${v.length} frames, median ${q(0.5).toFixed(2)} ms, p90 ${q(0.9).toFixed(2)} ms, p99 ${q(0.99).toFixed(2)} ms, mean ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)} ms`
  }
  const idle = await frames(3000)
  await page.getByRole('button', { name: /^Play/ }).first().click()
  await page.waitForTimeout(500)
  const play = await frames(8000)
  console.log(`PERF ${TAG} ${label}: idle ${stats(idle)}`)
  console.log(`PERF ${TAG} ${label}: Play ${stats(play)}`)
}

test.describe('frame time of the default Play', () => {
  test.skip(!TAG, 'set PERF=<tag> to measure')
  test.setTimeout(180_000)
  test('1280 × 720', async ({ page }) => {
    await measure(page, '1280x720')
  })
  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true })
    test('390 × 844 at 3x', async ({ page }) => {
      await measure(page, '390x844@3')
    })
  })
})
