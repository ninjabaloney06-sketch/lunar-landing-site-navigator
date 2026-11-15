// Visual sweep (VISUAL-SWEEP-TASK.md): screenshots of every screen and state at 1440×900, 1280×720 and 375×812,
// for a human (or agent) to look at. It asserts nothing about the picture; a state that cannot be reached is
// listed in test-results/visual-baseline/<viewport>/not-captured.txt instead of failing the run.
// Skipped unless VISUAL_SWEEP is set, so it never runs as part of the normal suite.
// Run against the built app (real fonts; in a git worktree the dev server refuses the @fontsource files that resolve
// through the node_modules junction, so dev-server screenshots fall back to system fonts), from app/:
//   npm run build && npx vite preview --port 5191 --strictPort &
//   VISUAL_SWEEP=1 VISUAL_SWEEP_URL=http://localhost:5191 PW_GPU=1 PW_PORT=5190 npx playwright test e2e/visual-sweep.spec.ts --workers=1
// Without VISUAL_SWEEP_URL it uses the config's dev server (fine in the main checkout).
// Output: app/test-results/visual-baseline/<viewport>/<screen>.png (git-ignored).
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.skip(!process.env.VISUAL_SWEEP, 'visual sweep: set VISUAL_SWEEP=1 to run')
test.describe.configure({ mode: 'serial' })
// A state that cannot be reached fails fast and is listed, instead of waiting for the test timeout.
test.use({ actionTimeout: 10_000 })
if (process.env.VISUAL_SWEEP_URL) test.use({ baseURL: process.env.VISUAL_SWEEP_URL })

const OUT = join(process.cwd(), 'test-results', 'visual-baseline')
const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '375x812', width: 375, height: 812 },
]
const DEMO = 'site=connecting-ridge&period=shackleton-2027-08'
const EYE_SITES = ['connecting-ridge', 'malapert-massif', 'haworth']
const LONGEST = 'connecting-ridge-extension' // longest name in sites.json ("Connecting Ridge Extension")
const mission = (site: string, name: string) => `site=${site}&name=${encodeURIComponent(name)}&pad=kourou-ela4&rocket=apollo&stay=2`
const FIVE = [
  mission('haworth', 'Haworth flight'),
  mission('malapert-massif', 'Massif survey'),
  mission('connecting-ridge', 'Ridge long stay'),
  mission('shackleton-rim-site04', 'Shackleton rim'),
  mission(LONGEST, 'Extension ice prospecting'),
]

type W = Window & { __scene?: { ready: Promise<void> }; __views?: { setNamed(n: unknown): void } }

async function open(page: Page, hash: string, opts: { scene?: boolean; settle?: number } = {}) {
  // A goto that only changes the hash is a same-document navigation: leave first so every state is a fresh load.
  await page.goto('about:blank')
  await page.goto(`/?test=1#${hash}`)
  if (opts.scene !== false) {
    await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
    await page.waitForFunction(() => (window as W).__scene !== undefined, null, { timeout: 60_000 })
    await page.evaluate(() => (window as W).__scene!.ready)
  }
  await page.waitForTimeout(opts.settle ?? 2500)
}

function sweep(vp: (typeof VIEWPORTS)[number]) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })
    const dir = join(OUT, vp.name)
    const missed: string[] = []
    test.beforeAll(() => mkdirSync(dir, { recursive: true }))
    test.afterAll(() => writeFileSync(join(dir, 'not-captured.txt'), missed.join('\n') + '\n'))

    /** One state: run the steps, take the screenshot; any failure is recorded, not thrown. */
    async function shot(page: Page, name: string, steps: () => Promise<void>, fullPage = false) {
      try {
        await steps()
        await page.screenshot({ path: join(dir, `${name}.png`), fullPage })
      } catch (e) {
        missed.push(`${name}: ${String((e as Error).message).split('\n')[0]}`)
      }
    }

    test('scene views and simulation', async ({ page }) => {
      test.setTimeout(400_000)
      await shot(page, '00-loading', async () => {
        await page.goto(`/?test=1#${DEMO}`, { waitUntil: 'commit' })
        await page.waitForTimeout(700)
      })
      await shot(page, '01-globe', () => open(page, `${DEMO}&view=globe`))
      await shot(page, '02-site', () => open(page, `${DEMO}&view=site`))
      for (const s of EYE_SITES) await shot(page, `03-eye-${s}`, () => open(page, `site=${s}&period=shackleton-2027-08&view=eye`, { settle: 6000 }))
      await shot(page, '04-sim-playing', async () => {
        await open(page, `${DEMO}&view=site`)
        await page.getByTestId('simulate').click()
        await page.waitForTimeout(2500)
      })
      await shot(page, '05-sim-paused', async () => {
        await page.keyboard.press('Space')
        await page.waitForTimeout(800)
      })
      await shot(page, '06-view-menu', async () => {
        await open(page, `${DEMO}&view=site`)
        await page.getByTestId('view').click()
        await page.waitForTimeout(400)
      })
      await shot(page, '07-bad-link', () => open(page, 'site=Nope!&period=zzz&t=garbage&st=,,&view=sideways&pts=999,1'))
    })

    test('mission menu', async ({ page }) => {
      test.setTimeout(300_000)
      await shot(page, '10-mission-closed-list', async () => {
        await open(page, DEMO)
        await page.getByTestId('mission').click()
        await page.waitForTimeout(500)
      })
      await shot(page, '11-mission-site-focused', async () => {
        await page.locator('#mp-sites').locator('xpath=..').locator('input').first().focus()
        await page.waitForTimeout(400)
      })
      await shot(page, '12-mission-site-typed', async () => {
        await page.keyboard.type('ma')
        await page.waitForTimeout(400)
      })
      await shot(page, '13-mission-stations', async () => {
        await page.locator('#mp-stations').scrollIntoViewIfNeeded()
        await page.waitForTimeout(400)
      })
      await shot(page, '14-mission-longest-name', async () => {
        await open(page, `site=${LONGEST}&period=shackleton-2027-08&name=${encodeURIComponent('Extension ice prospecting')}`)
      })
      await shot(page, '15-mission-longest-name-menu', async () => {
        await page.getByTestId('mission').click()
        await page.waitForTimeout(500)
      })
      await page.addInitScript((m) => window.localStorage.setItem('llsn.missions.v1', JSON.stringify(m)), [FIVE[0]])
      await shot(page, '16-mission-1-saved', async () => {
        await open(page, DEMO)
        await page.getByTestId('mission').click()
        await page.locator('#mp-missions').scrollIntoViewIfNeeded()
        await page.waitForTimeout(500)
      })
    })

    test('mission menu with 5 saved missions, drawer, table, compare', async ({ page }) => {
      test.setTimeout(300_000)
      await page.addInitScript((m) => window.localStorage.setItem('llsn.missions.v1', JSON.stringify(m)), FIVE)
      await shot(page, '17-mission-5-saved', async () => {
        await open(page, DEMO)
        await page.getByTestId('mission').click()
        await page.locator('#mp-missions').scrollIntoViewIfNeeded()
        await page.waitForTimeout(500)
      })
      await shot(page, '20-drawer-top', async () => {
        await open(page, `${DEMO}&drawer=details`)
      })
      const secs = await page.locator('[data-testid="drawer"] section.drawer-sec h3').allTextContents().catch(() => [] as string[])
      for (const [i, h] of secs.entries()) {
        const slug = h.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        await shot(page, `21-drawer-${String(i).padStart(2, '0')}-${slug}`, async () => {
          await page.locator('[data-testid="drawer"] section.drawer-sec').nth(i).evaluate((el) => el.scrollIntoView({ block: 'start' }))
          await page.waitForTimeout(500)
        })
      }
      await shot(page, '22-drawer-finder', () => open(page, `${DEMO}&drawer=finder`))
      await shot(page, '23-drawer-sources', () => open(page, `${DEMO}&drawer=sources`))
      await shot(page, '24-compare-table', async () => {
        await open(page, `${DEMO}&drawer=details`)
        await page.getByTestId('compare-table').evaluate((el) => el.scrollIntoView({ block: 'start' }))
        await page.waitForTimeout(500)
      })
      await shot(page, '25-site-table', async () => {
        await page.getByTestId('site-table').evaluate((el) => el.scrollIntoView({ block: 'start' }))
        await page.waitForTimeout(500)
      })
    })

    test('flight plan', async ({ page }) => {
      test.setTimeout(300_000)
      await shot(page, '30-flight-before', async () => {
        await open(page, `view=flight&site=haworth&rocket=apollo&name=Haworth+flight`, { scene: false, settle: 800 })
      })
      await shot(page, '31-flight-calculating', async () => {
        await page.waitForTimeout(1500)
      })
      await shot(page, '32-flight-result', async () => {
        await expect(page.getByTestId('flight-payload')).toHaveAttribute('data-state', 'ready', { timeout: 90_000 })
        await page.waitForTimeout(2000)
      })
      await shot(page, '33-flight-toggled', async () => {
        await page.getByTestId('flight-collapse').click()
        await page.waitForTimeout(600)
      })
      await shot(page, '34-flight-toggled-back', async () => {
        await page.getByTestId('flight-collapse').click()
        await page.waitForTimeout(600)
      })
      await shot(page, '35-flight-playing', async () => {
        await page.getByTestId('flight-play').click()
        await page.waitForTimeout(3000)
      })
    })

    test('POI layer, cards, search, docs', async ({ page }) => {
      test.setTimeout(400_000)
      await shot(page, '40-poi-layer-on', async () => {
        await open(page, `${DEMO}&view=site`)
        await page.getByTestId('poi-toggle').click()
        await page.waitForTimeout(2500)
      })
      const card = { name: 'Cabeus', poiId: 'science:feat_cabeus', visible: true }
      const m = 30
      const edges: [string, number, number][] = [
        ['top', vp.width / 2, m],
        ['bottom', vp.width / 2, vp.height - m],
        ['left', m, vp.height / 2],
        ['right', vp.width - m, vp.height / 2],
        ['center', vp.width / 2, vp.height / 2],
      ]
      for (const [edge, x, y] of edges) {
        await shot(page, `41-poi-card-${edge}`, async () => {
          await page.evaluate((n) => (window as W).__views!.setNamed(n), { ...card, x, y })
          await expect(page.getByTestId('poi-info')).toBeVisible({ timeout: 5000 })
          await page.waitForTimeout(400)
        })
      }
      await page.evaluate(() => (window as W).__views?.setNamed(undefined)).catch(() => {})
      await shot(page, '42-search-results', async () => {
        await open(page, `${DEMO}&view=site`)
        await page.getByTestId('search-open').click()
        await expect(page.getByTestId('search-results')).toHaveAttribute('data-ordered', 'true', { timeout: 120_000 })
        await page.waitForTimeout(500)
      })
      await shot(page, '43-search-no-results', async () => {
        // No text query exists: a 1 km radius and no point groups is the emptiest search a user can make.
        const panel = page.getByTestId('search')
        await panel.getByTestId('search-filters').click() // folded behind one summary line (results first)
        await panel.locator('input[type="number"]').first().fill('1')
        const boxes = panel.locator('input[type="checkbox"]:checked')
        for (let n = await boxes.count(); n > 0; n--) await boxes.first().uncheck()
        await page.waitForTimeout(1500)
      })
      await shot(page, '44-docs', () => open(page, `${DEMO}&drawer=docs`, { scene: false }))
      await shot(page, '45-docs-scrolled', async () => {
        await page.getByTestId('docs').evaluate((el) => {
          const s = [el, ...el.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 20 && getComputedStyle(e).overflowY !== 'visible')
          if (s) s.scrollTop = s.scrollHeight / 2
        })
        await page.waitForTimeout(500)
      })
    })
  })
}

for (const vp of VIEWPORTS) sweep(vp)
