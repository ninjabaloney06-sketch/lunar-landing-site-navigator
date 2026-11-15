// Scene audit (15 Nov): GPU resources do not grow with use. three's renderer.info.memory (geometries, textures) and
// the program count after 20 site switches and after entering and leaving the flight view 10 times, against the
// count after the first few rounds (caches and shared textures are loaded by then).
// Run: PW_GPU=1 PW_PORT=5217 npx playwright test e2e/scene-audit-memory.spec.ts
import { expect, test, type Page } from '@playwright/test'

const SITES = [
  'haworth', 'malapert-massif', 'nobile-rim-1', 'nobile-rim-2', 'de-gerlache-rim-2', 'amundsen-rim', 'connecting-ridge-extension', 'faustini-rim-a',
  'leibnitz-beta-plateau', 'peak-near-shackleton', 'de-gerlache-rim-1', 'de-gerlache-kocher-massif', 'malapert-site23', 'shackleton-rim-site04',
  'connecting-ridge', 'im-1', 'im-2-intended', 'viper-mons-mouton',
]
type Info = { geometries: number; textures: number; programs: number }
type Scene = { ready: Promise<void>; siteId(): string | null; level(): string; renderInfo(): Info }
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>

async function open(page: Page, h: string) {
  await page.goto(`/?test=1#${h}`)
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
}
const setParam = (page: Page, k: string, v: string) =>
  page.evaluate(([k, v]) => {
    const p = new URLSearchParams(location.hash.slice(1))
    p.set(k, v)
    location.hash = p.toString()
  }, [k, v])
const info = async (page: Page) => {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  return scene(page, (s) => s.renderInfo())
}

test('20 site switches leave no geometry, texture or program behind', async ({ page }) => {
  test.setTimeout(300_000)
  await open(page, 'site=haworth&period=shackleton-2027-08&view=site')
  const go = async (id: string) => {
    await setParam(page, 'site', id)
    await page.waitForFunction((id) => (window as unknown as { __scene: Scene }).__scene.siteId() === id, id, { timeout: 60_000 })
  }
  for (const id of SITES.slice(1, 4)) await go(id)
  const base = await info(page)
  for (let i = 0; i < 20; i++) await go(SITES[(i * 7 + 4) % SITES.length])
  const end = await info(page)
  console.log('site switches', JSON.stringify(base), JSON.stringify(end))
  expect(end.geometries).toBeLessThanOrEqual(base.geometries + 2)
  expect(end.textures).toBeLessThanOrEqual(base.textures + 2)
  expect(end.programs).toBeLessThanOrEqual(base.programs + 1)
})

test('entering and leaving the flight view 10 times leaves no geometry, texture or program behind', async ({ page }) => {
  test.setTimeout(300_000)
  await open(page, 'site=haworth&period=shackleton-2027-08&view=site&rocket=apollo&pad=kourou-ela4&stay=2')
  const view = async (v: string, level: string) => {
    await setParam(page, 'view', v)
    await page.waitForFunction((l) => (window as unknown as { __scene: Scene }).__scene.level() === l, level, { timeout: 60_000 })
    await page.waitForTimeout(300)
  }
  for (let i = 0; i < 2; i++) { await view('flight', 'flight'); await view('site', 'site') }
  const base = await info(page)
  for (let i = 0; i < 10; i++) { await view('flight', 'flight'); await view('site', 'site') }
  const end = await info(page)
  console.log('flight in/out', JSON.stringify(base), JSON.stringify(end))
  expect(end.geometries).toBeLessThanOrEqual(base.geometries + 2)
  expect(end.textures).toBeLessThanOrEqual(base.textures + 2)
  expect(end.programs).toBeLessThanOrEqual(base.programs + 1)
})
