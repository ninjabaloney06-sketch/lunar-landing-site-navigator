// Scene audit (15 Nov): the Moon view after the turn over the poles (globe-turn.spec.ts). Re-entering the Moon view
// from the site, after a drag has carried the camera over a pole (the picture upside down), shows north up again:
// the camera's up vector has a positive MOON_ME z (north) component.
// Run: PW_GPU=1 PW_PORT=5217 npx playwright test e2e/scene-audit-moon.spec.ts
import { expect, test, type Page } from '@playwright/test'

type Cam = { level: string; position: number[]; quaternion: number[] }
type Scene = {
  ready: Promise<void>
  camera(): Cam
  level(): string
  siteId(): string | null
  setAnimated(on: boolean): void
  advance(ms: number): void
  flying(): boolean
  handle(): { setLevel(l: string): void }
  goTo(v: string): Promise<boolean>
  setView(o: Record<string, unknown>): Promise<Cam>
}
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>

/** The camera's up vector (0, 1, 0 in camera space) in MOON_ME. */
const upOf = (q: number[]) => {
  const [x, y, z, w] = q
  return [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)]
}

async function open(page: Page) {
  await page.goto('/?test=1#site=connecting-ridge&period=shackleton-2027-08&view=globe')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
  await page.waitForFunction(() => (window as unknown as { __scene: Scene }).__scene.siteId() === 'connecting-ridge', null, { timeout: 60_000 })
}

async function settle(page: Page) {
  await scene(page, (s) => { for (let i = 0; i < 2000 && s.flying(); i++) s.advance(50) })
}

test('after a drag over the pole, going to the site and back to the Moon view has north up', async ({ page }) => {
  test.setTimeout(120_000)
  await open(page)
  // Drag over the south pole: 3 x 150 px upward from lat -60 or so carries the camera past it.
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(640, 500)
    await page.mouse.down()
    await page.mouse.move(640, 425, { steps: 3 })
    await page.mouse.move(640, 350, { steps: 3 })
    await page.mouse.up()
  }
  const turned = upOf((await scene(page, (s) => s.camera())).quaternion)
  console.log('up after the drags', turned.map((v) => v.toFixed(2)).join(' '))
  await scene(page, (s) => { s.setAnimated(true); s.handle().setLevel('site') })
  await settle(page)
  expect(await scene(page, (s) => s.level())).toBe('site')
  await scene(page, (s) => s.handle().setLevel('globe'))
  await settle(page)
  expect(await scene(page, (s) => s.level())).toBe('globe')
  const up = upOf((await scene(page, (s) => s.camera())).quaternion)
  expect(up[2], `up ${up.join(' ')}`).toBeGreaterThan(0.2)
})

test('the Moon viewpoint (goTo moon) from the site has north up', async ({ page }) => {
  test.setTimeout(120_000)
  await open(page)
  await scene(page, (s) => { s.setAnimated(true); s.handle().setLevel('site') })
  await settle(page)
  await scene(page, (s) => { s.goTo('moon') })
  await settle(page)
  const c = await scene(page, (s) => s.camera())
  expect(c.level).toBe('globe')
  expect(upOf(c.quaternion)[2]).toBeGreaterThan(0.2)
})
