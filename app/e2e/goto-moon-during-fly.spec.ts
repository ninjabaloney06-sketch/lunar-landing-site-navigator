// 16 Nov: "View > Moon" did nothing while the camera was still flying after a site change (handle.goTo returned
// false during a fly). Now the scene takes the request during any fly: a fly down to a site turns back from where
// it is, a fly through space is redirected from where it is, any other fly ends first; every case ends in the
// default Moon view, the camera never jumps, and onLevel reports 'globe' when the request is taken.
// Harness, animations on a clock the test moves (setAnimated, advance).
// Run: PW_GPU=1 PW_PORT=5221 npx playwright test e2e/goto-moon-during-fly.spec.ts
import { expect, test, type Page } from '@playwright/test'

type Pose = { flying: boolean; mix: number; position: number[]; quaternion: number[]; fov: number }
interface Handle {
  setLevel(l: string): void
  goTo(v: string): boolean
  goToPoint(lat: number, lon: number): boolean
  onLevel(cb: (l: string) => void): () => void
}
interface Scene {
  ready: Promise<void>
  setView(o: Record<string, unknown>): Promise<unknown>
  setAnimated(on: boolean): void
  advance(ms: number): void
  flying(): boolean
  level(): string
  flyPose(): Pose
  handle(): Handle
}
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

async function open(page: Page) {
  await page.goto('/src/scene3d/harness.html?test=1')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
  await scene(page, (s) => s.setView({ site: 'connecting-ridge', utc: '2027-08-18T00:00Z', level: 'globe' }))
}
/** The default Moon view's pose, placed without a fly. */
async function moonPose(page: Page) {
  await scene(page, (s) => s.setView({ level: 'globe' }))
  return scene(page, (s) => s.flyPose())
}
/** Steps the clock in 50 ms frames until no fly runs; returns the camera positions on the way and the levels reported. */
const runOut = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __scene: Scene }).__scene
    const path: number[][] = []
    for (let i = 0; i < 400 && s.flying(); i++) {
      s.advance(50)
      path.push(s.flyPose().position)
    }
    return { path, flying: s.flying(), level: s.level(), pose: s.flyPose() }
  })

test.describe("goTo('moon') during a fly", () => {
  test.setTimeout(120_000)

  test('during the fly down to a site: the camera turns back from where it is and ends in the Moon view', async ({ page }) => {
    await open(page)
    const moon = await moonPose(page)
    const r = await page.evaluate(() => {
      const s = (window as unknown as { __scene: Scene }).__scene
      const levels: string[] = []
      s.handle().onLevel((l) => levels.push(l))
      s.setAnimated(true)
      s.handle().setLevel('site')
      const down: number[][] = []
      for (let i = 0; i < 20; i++) {
        s.advance(50)
        down.push(s.flyPose().position)
      }
      const before = s.flyPose()
      const ok = s.handle().goTo('moon')
      s.advance(16)
      const after = s.flyPose()
      return { ok, before, after, down, levels: [...levels], flying: s.flying() }
    })
    expect(r.before.flying, 'the fly down is running after 1 s').toBe(true)
    expect(r.ok, 'the request is taken').toBe(true)
    expect(r.levels, 'the page is told at once').toEqual(['globe'])
    expect(r.flying).toBe(true)
    // No jump: one 16 ms frame moves the camera less than the fly down did in its last 50 ms frame.
    const lastStep = dist(r.down[r.down.length - 1], r.down[r.down.length - 2])
    expect(dist(r.after.position, r.before.position)).toBeLessThanOrEqual(lastStep)
    const out = await runOut(page)
    expect(out.flying).toBe(false)
    expect(out.level).toBe('globe')
    expect(out.pose.mix, 'the space scene alone').toBe(0)
    expect(dist(out.pose.position, moon.position), 'the default Moon view').toBeLessThan(1e-6)
    expect(out.pose.fov).toBeCloseTo(moon.fov, 9)
    // On the way back the camera only moves away from the Moon or along the Moon view's distance: it never dives again.
    const radius = [r.after.position, ...out.path].map((p) => Math.hypot(p[0], p[1], p[2]))
    expect(Math.min(...radius)).toBeGreaterThanOrEqual(Math.hypot(...r.before.position) - 1e-6)
    await scene(page, (s) => s.setAnimated(false))
  })

  test('during the fly up from a site, and during a fly through space: taken, and it ends in the Moon view', async ({ page }) => {
    await open(page)
    const moon = await moonPose(page)
    // Up from the site toward a point on the far side of the pole, then Moon asked for half way.
    await scene(page, (s) => s.setView({ level: 'site' }))
    const up = await page.evaluate(() => {
      const s = (window as unknown as { __scene: Scene }).__scene
      s.setAnimated(true)
      const started = s.handle().goToPoint(-60, 100)
      for (let i = 0; i < 12; i++) s.advance(50)
      return { started, flyingBefore: s.flying(), ok: s.handle().goTo('moon') }
    })
    expect(up.started && up.flyingBefore).toBe(true)
    expect(up.ok).toBe(true)
    let out = await runOut(page)
    expect(out.flying).toBe(false)
    expect(out.level).toBe('globe')
    expect(dist(out.pose.position, moon.position)).toBeLessThan(1e-6)

    // A fly through space to another point, redirected from where the camera is.
    const space = await page.evaluate(() => {
      const s = (window as unknown as { __scene: Scene }).__scene
      const started = s.handle().goToPoint(-70, -120)
      for (let i = 0; i < 8; i++) s.advance(50)
      const before = s.flyPose()
      const ok = s.handle().goTo('moon')
      s.advance(16)
      return { started, before, ok, after: s.flyPose() }
    })
    expect(space.started && space.before.flying).toBe(true)
    expect(space.ok).toBe(true)
    expect(dist(space.after.position, space.before.position), 'no jump: it goes on from where it was').toBeLessThan(50)
    out = await runOut(page)
    expect(out.flying).toBe(false)
    expect(out.level).toBe('globe')
    expect(dist(out.pose.position, moon.position)).toBeLessThan(1e-6)
    await scene(page, (s) => s.setAnimated(false))
  })

  test('with no fly running nothing changed: the request flies to the Moon view as before', async ({ page }) => {
    await open(page)
    const moon = await moonPose(page)
    await scene(page, (s) => s.setView({ level: 'site' }))
    const ok = await page.evaluate(() => {
      const s = (window as unknown as { __scene: Scene }).__scene
      s.setAnimated(true)
      return s.handle().goTo('moon')
    })
    expect(ok).toBe(true)
    const out = await runOut(page)
    expect(out.level).toBe('globe')
    expect(dist(out.pose.position, moon.position)).toBeLessThan(1e-6)
    await scene(page, (s) => s.setAnimated(false))
  })
})
