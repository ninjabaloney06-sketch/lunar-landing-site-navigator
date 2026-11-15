// Scene audit (15 Nov): a camera pose set through the pose setter (setView / placeSite, so also any saved or linked
// pose) never puts the site camera under the drawn terrain: clearance at least the floor mouse input keeps (1.7 m).
// Measured by a ray straight down through the drawn terrain meshes (__scene.eyeClearance), not by the camera code.
// Run: PW_GPU=1 PW_PORT=5217 npx playwright test e2e/scene-audit-pose.spec.ts
import { expect, test, type Page } from '@playwright/test'

const AUG = 'shackleton-2027-08'
const MIN_M = 1.7
// Measured before the fix (clearance in m): haworth az 0 el 2 0.3 km -2.8; az 300 el 0 0.1 km -80.7;
// shackleton-rim-site04 az 200 el 5 1 km -439; nobile-rim-1 az 0 el 2 0.3 km -17.5.
const POSES: [string, number, number, number][] = [
  ['haworth', 0, 2, 0.3],
  ['haworth', 300, 0, 0.1],
  ['shackleton-rim-site04', 200, 5, 1],
  ['nobile-rim-1', 0, 2, 0.3],
]

type Scene = {
  ready: Promise<void>
  setView(o: Record<string, unknown>): Promise<unknown>
  eyeClearance(): { level: string; clearance: number | null }
  nearLevel(on: boolean): Promise<void>
}
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>

async function open(page: Page, id: string) {
  await page.goto(`/?test=1#site=${encodeURIComponent(id)}&period=${AUG}&view=site`)
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
}

for (const [id, az, el, dist] of POSES) {
  test(`setView below the terrain is raised onto it: ${id} az ${az} el ${el} ${dist} km`, async ({ page }) => {
    test.setTimeout(120_000)
    await open(page, id)
    await page.evaluate(`window.__scene.setView({ site: ${JSON.stringify(id)}, level: 'site', az: ${az}, el: ${el}, dist: ${dist} })`)
    const c = await scene(page, (s) => s.eyeClearance())
    expect(c.level).toBe('site')
    expect(c.clearance!).toBeGreaterThanOrEqual(MIN_M)
    // After the near level is built the finer ground may be higher: still clear.
    await scene(page, async (s) => { await s.nearLevel(true) })
    await page.waitForFunction(() => (window as unknown as { __scene: { nearReady(): Promise<void> } }).__scene.nearReady().then(() => true))
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    expect((await scene(page, (s) => s.eyeClearance())).clearance!).toBeGreaterThanOrEqual(MIN_M)
  })
}
