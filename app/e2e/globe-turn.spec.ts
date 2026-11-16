// The Moon view turns past the poles (tester feedback, 15 Nov: "when you orbit the Moon, at a certain point you
// cannot go on and have to turn another way"). Before, the camera orbited around MOON_ME north and stopped over a
// pole, which is where the app's sites are. Now a drag turns about the camera's own axes (index.ts turnGlobe).
// Run: PW_GPU=1 PW_PORT=5191 npx playwright test e2e/globe-turn.spec.ts
import { expect, test, type Page } from '@playwright/test'

type Cam = { level: string; position: number[]; forward: number[] }
type Scene = { ready: Promise<void>; camera(): Cam; level(): string; siteId(): string | null }
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>

test.use({ viewport: { width: 1280, height: 720 } })

test('a long vertical drag carries the camera over the south pole and on, at the same distance', async ({ page }) => {
  await page.goto('/?test=1#site=connecting-ridge&period=shackleton-2027-08&view=globe')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
  await page.waitForFunction(() => (window as unknown as { __scene: Scene }).__scene.siteId() === 'connecting-ridge', null, { timeout: 60_000 })
  expect(await scene(page, (s) => s.level())).toBe('globe')

  const start = (await scene(page, (s) => s.camera())).position
  const dist = Math.hypot(...start)
  const zs: number[] = [start[2]]
  let last = start
  // Twelve drags of 150 px upward: each turns the camera 150 / 720 of half a turn toward the south (the picture
  // follows the pointer), 450° in all, so the camera passes over the south pole and then over the north pole.
  for (let i = 0; i < 12; i++) {
    // Starts at y = 450, clear of the timeline: since 16 Nov 2026 the footer's validation line is longer and wraps
    // to a second row at this width, which moves the timeline's tool row up to y = 493 to 522.
    await page.mouse.move(640, 450)
    await page.mouse.down()
    await page.mouse.move(640, 375, { steps: 3 })
    await page.mouse.move(640, 300, { steps: 3 })
    await page.mouse.up()
    const p = (await scene(page, (s) => s.camera())).position
    expect(Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]), `drag ${i + 1} moves the camera (km)`).toBeGreaterThan(0.2 * dist)
    expect(Math.abs(Math.hypot(...p) - dist), `distance after drag ${i + 1}`).toBeLessThan(1e-6 * dist)
    zs.push(p[2])
    last = p
  }
  // Over the south pole (z near −dist) and later over the north pole (z near +dist): no stop at either.
  expect(Math.min(...zs)).toBeLessThan(-0.9 * dist)
  expect(Math.max(...zs)).toBeGreaterThan(0.9 * dist)
  expect(await scene(page, (s) => s.level())).toBe('globe')
})

test('a horizontal drag still turns the Moon sideways, and the picture follows the pointer', async ({ page }) => {
  await page.goto('/?test=1#site=connecting-ridge&period=shackleton-2027-08&view=globe')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
  await page.waitForFunction(() => (window as unknown as { __scene: Scene }).__scene.siteId() === 'connecting-ridge', null, { timeout: 60_000 })
  const a = (await scene(page, (s) => s.camera())).position
  await page.mouse.move(640, 360)
  await page.mouse.down()
  await page.mouse.move(790, 360, { steps: 4 })
  await page.mouse.up()
  const b = (await scene(page, (s) => s.camera())).position
  // The camera started upright (north up): a sideways drag keeps its height above the equator plane and turns it
  // about the polar axis, clockwise seen from the north for a drag to the right (the surface follows the pointer).
  expect(Math.abs(b[2] - a[2])).toBeLessThan(1e-6 * Math.hypot(...a))
  const turn = Math.atan2(b[1], b[0]) - Math.atan2(a[1], a[0])
  const wrapped = Math.atan2(Math.sin(turn), Math.cos(turn))
  expect(wrapped).toBeLessThan(-0.2)
})
