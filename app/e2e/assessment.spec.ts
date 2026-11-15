// Site assessment section of the Details drawer (add-on Task 1). assessments.json is fetched only when the section is
// first opened; a listed site shows the file's values (expected strings computed in the page by the app's own
// mapping module from the same file, never typed in); a custom site shows "Not computed for this place" and fetches
// nothing; a missing or broken file shows the plain no-data message.
// Run: PW_GPU=1 PW_PORT=5191 npx playwright test e2e/assessment.spec.ts
import { expect, test, type Page } from '@playwright/test'

const AUG = 'shackleton-2027-08'
const CUSTOM = 'cap:-89.47000,-136.78000' // 1 km from Connecting Ridge, inside the cap (custom-site.spec.ts)
const SHOTS = process.env.ASSESS_SHOTS // folder for the report screenshots, when set

function countRequests(page: Page) {
  const urls: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/data/assessments.json')) urls.push(r.url())
  })
  return urls
}

async function openDrawer(page: Page, site: string) {
  await page.goto(`/?test=1#site=${site}&period=${AUG}&drawer=details`)
  await expect(page.getByTestId('answer')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  const drawer = page.getByTestId('drawer')
  await expect(drawer).toBeVisible()
  const sec = drawer.getByTestId('site-assessment')
  await expect(sec).toBeVisible()
  return sec
}

async function openSection(page: Page, sec: ReturnType<Page['getByTestId']>) {
  await sec.getByText('Landing site assessment', { exact: true }).click()
}

test('a listed site: no request before the section opens; then the file values, the status and the verdict', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const urls = countRequests(page)
  const sec = await openDrawer(page, 'malapert-massif')
  await page.waitForTimeout(1000)
  expect(urls, 'assessments.json is not fetched when the drawer opens').toEqual([])
  await expect(sec.getByTestId('assess-slope')).toHaveCount(0)

  await openSection(page, sec)
  await expect(sec.getByTestId('assess-status')).toHaveText('Validated by the science lead (statement of 15 Nov 2026; see record).')
  expect(urls).toHaveLength(1)
  await expect(sec.getByTestId('assess-criteria')).toContainText('project criteria (set by the team), not NASA or vehicle limits')

  // Expected strings: the app's mapping of the same file (summary rows only; Full data is off by default).
  const want = (await page.evaluate(`(async () => {
    const V = await import('/src/views/assessmentView.ts')
    const A = await import('/src/data/assessments.ts')
    const v = V.mapAssessment(await A.loadAssessments(), 'malapert-massif')
    return v.blocks.map((b) => ({ id: b.id, rows: b.rows.filter((r) => !r.full).map((r) => [r.label, ...r.values]), verdict: b.verdict }))
  })()`)) as { id: string; rows: string[][]; verdict: { label: string; rule: string } | null }[]
  expect(urls, 'one request per session').toHaveLength(1)
  expect(want.map((b) => b.id)).toEqual(['slope', 'roughness', 'psr', 'thermal'])
  for (const b of want) {
    const rows = sec.getByTestId(`assess-${b.id}`).locator('tbody tr')
    await expect(rows).toHaveCount(b.rows.length)
    for (let i = 0; i < b.rows.length; i++) {
      await expect(rows.nth(i).locator('th, td')).toHaveText(b.rows[i])
    }
  }
  // Spot checks against validation.md's Results row for malapert-massif: 4.10 / 8.73, 69.2 %, RMS 1.43 m, shadow 6.53 km (rounded there).
  const slope = sec.getByTestId('assess-slope')
  await expect(slope.locator('tbody tr').first()).toContainText('4.10°')
  await expect(sec.getByTestId('assess-verdict')).toContainText(`${want[0].verdict!.label} the landing rule: every valid pixel slope`)
  await expect(sec.getByTestId('assess-verdict').locator('[data-tone]')).toHaveAttribute('data-tone', 'fail')
  await expect(sec.getByTestId('assess-decider')).toHaveText('Maximum slope in the landing disk: 8.73°.')
  await expect(sec.getByTestId('assess-roughness')).toContainText('1.43 m')
  await expect(sec.getByTestId('assess-roughness')).toContainText('Obstacles')
  await expect(sec.getByTestId('assess-psr')).toContainText('6.528 km') // the file's value (validation.md rounds it to 6.53)
  await expect(sec.getByTestId('assess-thermal')).toContainText('unknown: not provided by this product')
  // Source, method and limitations sit behind a disclosure in each block.
  const src = slope.locator('details.assess-src')
  await src.locator('summary').click()
  await expect(src).toContainText('Barker et al. 2023')
  await expect(src.getByRole('link', { name: 'doi:10.3847/PSJ/acf3e1' })).toHaveAttribute('href', 'https://doi.org/10.3847/PSJ/acf3e1')
  await expect(sec).not.toContainText(/NaN|undefined|Leo|Otto|ninja/)

  // Full data shows the extra rows.
  await page.getByTestId('drawer').getByTestId('full-data-switch').first().click()
  await expect(slope).toContainText('Pixels in the disk')
  if (SHOTS) {
    await slope.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOTS}/assessment-listed-1280.png` })
  }
  expect(errors).toEqual([])
})

test('a custom site: every block says "Not computed for this place", and the file is not fetched', async ({ page }) => {
  const urls = countRequests(page)
  const sec = await openDrawer(page, CUSTOM)
  await openSection(page, sec)
  const msgs = sec.getByTestId('assess-message')
  await expect(msgs).toHaveCount(4)
  await expect(msgs).toHaveText(Array(4).fill('Not computed for this place'))
  await expect(sec.locator('tbody tr')).toHaveCount(0)
  await expect(sec.getByTestId('assess-status')).toHaveCount(0)
  await expect(sec.getByTestId('full-data-switch')).toHaveCount(0) // nothing for it to add here
  await expect(sec).not.toContainText(/NaN|undefined|°/)
  expect(urls).toEqual([])
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/assessment-custom-1280.png` })
})

for (const [name, fulfil] of [
  ['missing', { status: 404, body: 'Not found' }],
  ['malformed', { status: 200, contentType: 'application/json', body: '{"meta": {}, "sites": ' }],
] as const) {
  test(`a ${name} file: the plain no-data message, no crash`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('**/data/assessments.json', (r) => r.fulfill(fulfil))
    const sec = await openDrawer(page, 'haworth')
    await openSection(page, sec)
    await expect(sec.getByTestId('assess-no-data')).toHaveText('No site assessment data in this build.')
    await expect(sec).not.toContainText(/NaN|undefined/)
    expect(errors).toEqual([])
  })
}

test.describe('375 px', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })
  test('the section fits the phone width', async ({ page }) => {
    const sec = await openDrawer(page, 'shackleton-rim-site04')
    await openSection(page, sec)
    await expect(sec.getByTestId('assess-status')).toBeVisible()
    await expect(sec.getByTestId('assess-psr')).toContainText('0.79 km') // validation.md reference case: 0.79 km at 261°
    await expect(sec.getByTestId('assess-psr')).toContainText('W, 261.1°')
    const overflow = await page.getByTestId('drawer').evaluate((d) => d.scrollWidth - d.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    if (SHOTS) {
      await sec.getByTestId('assess-slope').scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${SHOTS}/assessment-listed-375.png` })
    }
  })
})
