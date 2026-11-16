// Flight view, scrubbing backwards (16 Nov: it was unconfirmed). The flight plan of the default mission (SLS with the
// Starship lander) is opened from the header, the playback bar is scrubbed forward to 20 % and 70 % of the flight and
// back to 20 %: the readout goes back, and the craft stand where they stood at that time on the way forward, in the
// scene's own projection and in the picture. The plan is waited for by the playback bar appearing (the bar exists
// only with a plan), not by a fixed time: under load the plan takes minutes.
// Run: PW_GPU=1 PW_PORT=5222 npx playwright test e2e/flight-scrub.spec.ts
import { expect, test, type Page } from '@playwright/test'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

type Pt = { x: number; y: number; visible: boolean } | null
type W = Window & { __scene?: { ready: Promise<void>; handle(): { projectFlight(name: string): Pt } } }

const PLAN_TIMEOUT = 400_000

/** Sets the scrubber as a drag does: the range input's value, then the input event React's onChange listens to. */
async function scrubTo(page: Page, fraction: number): Promise<number> {
  const ms = await page.getByTestId('flight-scrub').evaluate((el, f) => {
    const input = el as HTMLInputElement
    const min = Number(input.min)
    const max = Number(input.max)
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(min + f * (max - min)))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return Number(input.value) // the browser has moved it onto the input's 1 s steps
  }, fraction)
  await expect(page.getByTestId('flight-scrub')).toHaveValue(String(ms))
  // two frames: the view's frame loop hands the time to the scene, the scene draws it
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))))
  return ms
}

/** What the bar and the scene show now. */
async function state(page: Page) {
  const craft = await page.evaluate(() => {
    const h = (window as W).__scene!.handle()
    return { capsule: h.projectFlight('capsule'), lander: h.projectFlight('lander') }
  })
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('.labels .obj:not([hidden]) > *')].map((e) => {
      const r = e.getBoundingClientRect()
      return `${(e as HTMLElement).dataset.testid ?? e.className} ${(e as HTMLElement).dataset.pos ?? ''} ${r.left.toFixed(1)},${r.top.toFixed(1)} ${r.width.toFixed(1)}x${r.height.toFixed(1)}`
    }),
  )
  return {
    labels,
    elapsed: (await page.getByTestId('flight-elapsed').innerText()).trim(),
    phase: (await page.getByTestId('flight-phase').innerText()).trim(),
    value: Number(await page.getByTestId('flight-scrub').inputValue()),
    craft,
    // The 3D picture alone: the labels and panels over it are compared by their boxes (a label's text layer is
    // composited at sub-pixel offsets that differ from one paint to the next, which is no difference in the app).
    shot: PNG.sync.read(await page.locator('[data-testid="scene"] canvas').first().screenshot({ style: '.labels, .top, .bottom, .flight-panel, .flight-transport { visibility: hidden !important }' })),
  }
}

/** The same screen point within 1 px (or both not drawn). */
const near = (a: Pt, b: Pt) => (a === null || b === null ? a === b : a.visible === b.visible && Math.hypot(a.x - b.x, a.y - b.y) <= 1)

test('flight view: scrubbing back shows the earlier time and puts the craft where they were at that time', async ({ page }) => {
  test.setTimeout(PLAN_TIMEOUT + 200_000)
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('/?test=1#site=connecting-ridge&period=shackleton-2027-08')
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 120_000 })
  await page.getByTestId('flight-open').click()
  await expect(page).toHaveURL(/view=flight/)
  await expect(page.getByTestId('flight-panel')).toBeVisible({ timeout: 60_000 })
  // the default mission flies the SLS design
  await expect(page.getByTestId('flight-design-sls')).toBeChecked()
  // ready: the playback bar is there only once the plan is, and the payload line has its answer
  const bar = page.getByTestId('flight-transport')
  await expect(bar).toBeVisible({ timeout: PLAN_TIMEOUT })
  await expect(page.getByTestId('flight-payload')).toHaveAttribute('data-state', 'ready', { timeout: PLAN_TIMEOUT })
  await page.waitForFunction(() => (window as W).__scene !== undefined, null, { timeout: 60_000 })
  await page.evaluate(() => (window as W).__scene!.ready)
  await expect(page.getByTestId('flight-play')).toHaveText('Play') // not playing: only the scrubber moves the time

  // burn ticks of the SLS design: the Perigee Raise Maneuver is one of them
  const ticks = await bar.locator('.flight-tick').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.tick))
  expect(ticks).toContain('prm')
  expect(ticks).toContain('tli')
  await expect(bar.locator('.flight-tick.is-burn[data-tick="prm"]')).toHaveCount(1)

  const start = await state(page)
  await scrubTo(page, 0.2)
  const forward20 = await state(page)
  await scrubTo(page, 0.7)
  const at70 = await state(page)
  await scrubTo(page, 0.2)
  const back20 = await state(page)

  // the time goes forward, then back
  expect(forward20.value).toBeGreaterThan(start.value)
  expect(at70.value).toBeGreaterThan(forward20.value)
  expect(back20.value).toBe(forward20.value)
  expect(new Set([start.elapsed, forward20.elapsed, at70.elapsed]).size).toBe(3)
  expect(back20.elapsed).toBe(forward20.elapsed)
  expect(back20.phase).toBe(forward20.phase)

  // the craft: moved between 20 % and 70 %, and back where they were
  expect(forward20.craft.capsule).not.toBeNull()
  expect(near(at70.craft.capsule, forward20.craft.capsule), `capsule did not move: ${JSON.stringify([forward20.craft, at70.craft])}`).toBe(false)
  expect(near(back20.craft.capsule, forward20.craft.capsule), `capsule: ${JSON.stringify([forward20.craft.capsule, back20.craft.capsule])}`).toBe(true)
  expect(near(back20.craft.lander, forward20.craft.lander), `lander: ${JSON.stringify([forward20.craft.lander, back20.craft.lander])}`).toBe(true)

  // the labels on the flight (Earth, Moon, craft, burns): each in the same place with the same corner
  expect(back20.labels).toEqual(forward20.labels)
  expect(back20.labels.join()).toContain('label-capsule')

  // the picture: the same as on the way forward (paths, burn marks, craft), and not the one at 70 %
  const { width, height } = forward20.shot
  const diff = (a: PNG, b: PNG) => pixelmatch(a.data, b.data, undefined, width, height, { threshold: 0.1 }) / (width * height)
  const back = diff(forward20.shot, back20.shot)
  const moved = diff(forward20.shot, at70.shot)
  console.log(`flight scrub: picture at 20 % forward vs back differs in ${(back * 100).toFixed(3)} % of the pixels; 20 % vs 70 % in ${(moved * 100).toFixed(3)} %`)
  expect(moved).toBeGreaterThan(0)
  expect(back).toBeLessThan(Math.max(0.0005, moved / 20))

  // the keyboard steps back too (one step of the range input)
  await page.getByTestId('flight-scrub').focus()
  await page.keyboard.press('ArrowLeft')
  await expect.poll(async () => Number(await page.getByTestId('flight-scrub').inputValue())).toBeLessThan(back20.value)

  expect(errors).toEqual([])
})
