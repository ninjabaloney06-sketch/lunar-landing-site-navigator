// Scene track, 14 Nov: camera input easing (S1), the fly between the globe and the site (S3), the zoom at the
// body viewpoints (S6) and the camera following a body over time (S7). All on the scene harness in test mode,
// where the animation clock stands still: setAnimated(true) turns the easing on and advance(ms) is one frame.
// Run: PW_PORT=5181 npx playwright test e2e/scene-motion.spec.ts --workers=1
import { expect, test, type Page } from '@playwright/test'

export interface Cam {
  level: string
  units: string
  position: number[]
  quaternion: number[]
  forward: number[]
  fov: number
  width: number
  height: number
}
type Pt = { x: number; y: number; visible: boolean } | null
interface FlyPose {
  flying: boolean
  mix: number
  position: number[]
  quaternion: number[]
  fov: number
  site: number[]
}
interface Scene {
  ready: Promise<void>
  setView(o: Record<string, unknown>): Promise<Cam>
  camera(): Cam
  surfaceDist(): number
  setAnimated(on: boolean): void
  advance(ms: number): void
  flying(): boolean
  level(): string
  goTo(v: string): Promise<boolean>
  project(n: string): Pt
  bodies(): { name: string; center: number[]; camera: number[] }[]
  flyPose(): FlyPose
  load(siteId: string, utc: string | number): Promise<void>
  handle(): { setLevel(l: string): void; goTo(v: string): boolean; project(n: string): Pt; labelPoint(n: string): Pt }
}
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
const camera = (page: Page) => scene(page, (s) => s.camera())
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const angleDeg = (a: number[], b: number[]) => (Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI
const FRAME = 1000 / 60
const RIDGE = { site: 'connecting-ridge', utc: '2027-08-16T12:00:00Z' }

async function open(page: Page) {
  await page.goto('/src/scene3d/harness.html?test=1')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
}
const setView = (page: Page, o: Record<string, unknown>) =>
  page.evaluate((o) => (window as unknown as { __scene: Scene }).__scene.setView(o), o)
/** n frames of `ms` each on the test clock; returns the camera after each one. */
const advance = (page: Page, n: number, ms = FRAME) =>
  page.evaluate(
    ([n, ms]) => {
      const s = (window as unknown as { __scene: Scene }).__scene
      const out: Cam[] = []
      for (let i = 0; i < n; i++) {
        s.advance(ms)
        out.push(s.camera())
      }
      return out
    },
    [n, ms] as const,
  )

test.describe('S1: eased camera input (site level, 1280 × 720)', () => {
  const SITE_VIEW = { ...RIDGE, level: 'site', az: 40, el: 35, dist: 6 }

  test('the wheel: the eased step takes many frames, never overshoots and lands where the whole step lands', async ({ page }) => {
    await open(page)
    const a = await setView(page, SITE_VIEW)
    await page.mouse.move(640, 360)
    await page.mouse.wheel(0, -100)
    await frames(page)
    const whole = await camera(page) // test mode without easing: the notch lands at once
    const step = dist(whole.position, a.position)
    expect(step).toBeGreaterThan(100)

    await setView(page, SITE_VIEW)
    await scene(page, (s) => s.setAnimated(true))
    await page.mouse.wheel(0, -100)
    await frames(page)
    expect(dist((await camera(page)).position, a.position), 'nothing moves until the clock does').toBeLessThan(1e-9)
    const path = await advance(page, 150)
    const d = path.map((c) => dist(c.position, a.position))
    expect(d[0], 'first frame: about a tenth of the step').toBeGreaterThan(0.05 * step)
    expect(d[0]).toBeLessThan(0.2 * step)
    for (let i = 1; i < d.length; i++) expect(d[i], `frame ${i} moves on, never back`).toBeGreaterThanOrEqual(d[i - 1] - 1e-9)
    // Each frame covers less than the one before: an ease-out with no stutter.
    for (let i = 2; i < 60; i++) expect(d[i] - d[i - 1], `frame ${i} step`).toBeLessThanOrEqual(d[i - 1] - d[i - 2] + 1e-6)
    expect(d[9] / step, 'about 63 % after one time constant (160 ms)').toBeGreaterThan(0.5)
    expect(d[9] / step).toBeLessThan(0.75)
    expect(Math.abs(d[d.length - 1] - step) / step, 'ends where the whole step ends').toBeLessThan(0.02)
    expect(angleDeg(path[path.length - 1].forward, a.forward)).toBeLessThan(1e-6)

    // The same notch at 30 frames per second ends at the same place.
    await setView(page, SITE_VIEW)
    await page.mouse.wheel(0, -100)
    await frames(page)
    const slow = await advance(page, 75, 2 * FRAME)
    expect(dist(slow[slow.length - 1].position, path[path.length - 1].position) / step, '30 fps and 60 fps agree').toBeLessThan(0.01)
    expect(dist(slow[4].position, path[9].position) / step, 'and at the same time on the way').toBeLessThan(0.02)
  })

  test('the middle-drag and the orbit drag keep turning after the release and end where the unsmoothed drag ends', async ({ page }) => {
    await open(page)
    const drag = async (button: 'middle' | 'left') => {
      await page.mouse.move(640, 360)
      await page.mouse.down({ button })
      await page.mouse.move(700, 380)
      await page.mouse.move(800, 420)
      await page.mouse.up({ button })
      await frames(page)
    }
    for (const button of ['middle', 'left'] as const) {
      await scene(page, (s) => s.setAnimated(false))
      const a = await setView(page, SITE_VIEW)
      await drag(button)
      const whole = await camera(page)
      const total = angleDeg(a.forward, whole.forward)
      expect(total, `${button}: the drag turns the view`).toBeGreaterThan(5)

      await setView(page, SITE_VIEW)
      await scene(page, (s) => s.setAnimated(true))
      await drag(button)
      expect(angleDeg((await camera(page)).forward, a.forward), `${button}: nothing moves until the clock does`).toBeLessThan(1e-6)
      const path = await advance(page, 150)
      const turned = path.map((c) => angleDeg(a.forward, c.forward))
      expect(turned[0], `${button}: first frame after the release is part of the turn`).toBeGreaterThan(0.03 * total)
      expect(turned[0]).toBeLessThan(0.25 * total)
      expect(turned[20], `${button}: still turning 20 frames after the release`).toBeGreaterThan(turned[10])
      for (let i = 1; i < turned.length; i++) expect(turned[i], `${button}: frame ${i}`).toBeGreaterThanOrEqual(turned[i - 1] - 1e-9)
      const end = path[path.length - 1]
      // The look-around composes yaw and pitch per step, so many small steps and two large ones differ slightly.
      expect(angleDeg(end.forward, whole.forward), `${button}: ends where the unsmoothed drag ends`).toBeLessThan(button === 'middle' ? 0.03 * total : 0.05)
      if (button === 'middle') expect(dist(end.position, a.position), 'a look-around does not move the camera').toBeLessThan(1e-6)
      else expect(dist(end.position, whole.position) / dist(whole.position, a.position)).toBeLessThan(0.01)
    }
    await page.screenshot({ path: 'test-results/s1-controls-after-eased-drag.png' })
  })
})

// ---------- S3: the fly between the globe and the site ----------

const MOON_KM = 1737.4
/** Rotation angle between two orientations, degrees. */
const turnDeg = (a: number[], b: number[]) => {
  const d = Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]))
  return (2 * Math.acos(d) * 180) / Math.PI
}
/** Runs the fly that is under way to its end, one 60 Hz frame per step, and returns the pose after every frame. */
const runFly = (page: Page, shotAt: number | null = null) =>
  page.evaluate(
    async ([frame, shotAt]) => {
      const s = (window as unknown as { __scene: Scene }).__scene
      const out: FlyPose[] = [s.flyPose()]
      for (let i = 0; i < 600 && s.flying(); i++) {
        s.advance(frame as number)
        out.push(s.flyPose())
        if (shotAt !== null && out.length - 1 === shotAt) await new Promise((r) => setTimeout(r, 0))
      }
      return out
    },
    [FRAME, shotAt] as const,
  )

// Bounds for one 60 Hz frame of the 2.4 s fly, stated in the report:
const MAX_STEP = 0.15 // the camera moves less than 15 % of its distance to the site (of 1 km when nearer than that)
const MAX_TURN_DEG = 3 // and turns less than 3°
const MAX_FOV_DEG = 1 // the lens changes by less than 1° (it only changes when the fly starts on a zoomed eye-level lens)
const MAX_MIX = 0.1 // and the share of the site scene in the picture by less than 0.1

function checkContinuous(path: FlyPose[], label: string) {
  let worst = { step: 0, turn: 0, fov: 0, mix: 0 }
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const toSite = Math.max(1, Math.min(dist(a.position, a.site), dist(b.position, b.site)))
    const step = dist(a.position, b.position) / toSite
    const turn = turnDeg(a.quaternion, b.quaternion)
    worst = { step: Math.max(worst.step, step), turn: Math.max(worst.turn, turn), fov: Math.max(worst.fov, Math.abs(a.fov - b.fov)), mix: Math.max(worst.mix, Math.abs(a.mix - b.mix)) }
    expect(step, `${label}: frame ${i} moves a small part of the distance to the site`).toBeLessThan(MAX_STEP)
    expect(turn, `${label}: frame ${i} turn`).toBeLessThan(MAX_TURN_DEG)
    expect(Math.abs(a.fov - b.fov), `${label}: frame ${i} lens`).toBeLessThan(MAX_FOV_DEG)
    expect(Math.abs(a.mix - b.mix), `${label}: frame ${i} share of the site scene`).toBeLessThan(MAX_MIX)
    expect(Math.hypot(...b.position), `${label}: frame ${i} is outside the Moon`).toBeGreaterThan(MOON_KM)
  }
  console.log(
    `S3 ${label}: ${path.length - 1} frames; largest step ${(worst.step * 100).toFixed(1)} % of the distance to the site, turn ${worst.turn.toFixed(2)}°, lens ${worst.fov.toFixed(2)}°, scene share ${worst.mix.toFixed(3)}`,
  )
  return worst
}

test.describe('S3: the fly between the globe and the site is one continuous move', () => {
  test('globe → site and back: no frame-to-frame jump of the camera or of the picture, the same path both ways', async ({ page }) => {
    test.setTimeout(300_000)
    await open(page)
    const globe = await setView(page, { ...RIDGE, level: 'globe' })
    const siteDefault = await setView(page, { level: 'site' })
    await setView(page, { level: 'globe' })
    await scene(page, (s) => s.setAnimated(true))
    const start = await scene(page, (s) => s.flyPose())

    await scene(page, (s) => s.handle().setLevel('site'))
    expect(await scene(page, (s) => s.flying())).toBe(true)
    const down = await runFly(page)
    expect(dist(down[0].position, start.position), 'the fly starts where the camera was').toBeLessThan(1e-9)
    expect(turnDeg(down[0].quaternion, start.quaternion)).toBeLessThan(1e-3)
    expect(down.length - 1, 'frames at 60 Hz for 2.4 s').toBe(144)
    checkContinuous(down, 'globe → site')
    expect(down[0].mix).toBe(0)
    expect(down[down.length - 1].mix).toBe(1)
    const fading = down.filter((p) => p.mix > 0 && p.mix < 1).length
    expect(fading, 'frames in which both scenes are in the picture').toBeGreaterThan(20)
    // It ends on the default site view, the pose a direct change of level gives.
    expect(await scene(page, (s) => s.level())).toBe('site')
    const arrived = await camera(page)
    expect(dist(arrived.position, siteDefault.position)).toBeLessThan(1e-3)
    expect(angleDeg(arrived.forward, siteDefault.forward)).toBeLessThan(1e-6)
    expect(arrived.fov).toBe(siteDefault.fov)

    await scene(page, (s) => s.handle().setLevel('globe'))
    const up = await runFly(page)
    checkContinuous(up, 'site → globe')
    expect(up[0].mix).toBe(1)
    expect(up[up.length - 1].mix).toBe(0)
    expect(await scene(page, (s) => s.level())).toBe('globe')
    const back = await camera(page)
    expect(dist(back.position, globe.position)).toBeLessThan(1e-6)
    expect(angleDeg(back.forward, globe.forward)).toBeLessThan(1e-6)
    // The way back is the way down, reversed.
    expect(Math.abs(up.length - down.length), 'the same number of frames, give or take the rounding of the clock').toBeLessThanOrEqual(1)
    for (let i = 0; i <= 144; i += 12) {
      const d = down[144 - i]
      expect(dist(up[i].position, d.position) / dist(d.position, d.site), `frame ${i} of the way back`).toBeLessThan(1e-6)
      expect(turnDeg(up[i].quaternion, d.quaternion)).toBeLessThan(1e-4)
    }
  })

  test('from the far side of the Moon and from a zoomed eye-level lens: the same bounds, never inside the Moon', async ({ page }) => {
    test.setTimeout(300_000)
    await open(page)
    // Camera over 75° N: the site at the south pole is behind the Moon.
    await setView(page, { ...RIDGE, level: 'globe', el: 75, az: 30, dist: 6500 })
    await scene(page, (s) => s.setAnimated(true))
    await scene(page, (s) => s.handle().setLevel('site'))
    const down = await runFly(page)
    checkContinuous(down, 'far side → site')
    const lowest = Math.min(...down.map((p) => Math.hypot(...p.position)))
    expect(lowest, 'the path goes around the Moon, not through it').toBeGreaterThan(MOON_KM + 3)

    // Eye level with the lens zoomed in: the lens opens during the fly, with no jump at its start.
    await scene(page, (s) => s.setAnimated(false))
    await setView(page, { level: 'eye', az: 120, el: 3 })
    await page.mouse.move(640, 360)
    for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -100)
    await frames(page)
    const eye = await scene(page, (s) => s.flyPose())
    expect(eye.fov).toBeLessThan(20)
    await scene(page, (s) => s.setAnimated(true))
    await scene(page, (s) => s.handle().setLevel('globe'))
    const up = await runFly(page)
    expect(up[0].fov, 'the fly starts on the zoomed lens').toBeCloseTo(eye.fov, 9)
    expect(dist(up[0].position, eye.position)).toBeLessThan(1e-6)
    checkContinuous(up, 'zoomed eye level → globe')
    expect(up[up.length - 1].fov).toBe(54)
  })

  test('the site changes while the fly is on its way down (the app delivers the new site after asking for the site view): the fly turns to it without a jump', async ({ page }) => {
    await open(page)
    await setView(page, { ...RIDGE, level: 'globe' })
    const im1Default = await setView(page, { site: 'im-1', level: 'site' })
    await setView(page, { ...RIDGE, level: 'globe' })
    await scene(page, (s) => s.setAnimated(true))
    await scene(page, (s) => s.handle().setLevel('site'))
    const first = await page.evaluate(async (frame) => {
      const s = (window as unknown as { __scene: Scene }).__scene
      const out: FlyPose[] = [s.flyPose()]
      for (let i = 0; i < 12; i++) {
        s.advance(frame)
        out.push(s.flyPose())
      }
      await s.load('im-1', '2027-08-16T12:00:00Z')
      out.push(s.flyPose())
      return out
    }, FRAME)
    expect(first[first.length - 1].flying, 'still flying after the new site arrived').toBe(true)
    const rest = await runFly(page)
    checkContinuous([...first, ...rest.slice(1)], 'globe → site, site replaced on the way')
    expect(await scene(page, (s) => s.level())).toBe('site')
    const arrived = await camera(page)
    expect(dist(arrived.position, im1Default.position), 'it ends on the new site\'s default view').toBeLessThan(1e-3)
    expect(angleDeg(arrived.forward, im1Default.forward)).toBeLessThan(1e-6)
  })

  test('the picture: no frame of the fly stands out from its neighbours, and the last frame is the site view', async ({ page }) => {
    test.setTimeout(400_000)
    const { PNG } = await import('pngjs')
    await open(page)
    await setView(page, { ...RIDGE, level: 'globe' })
    await scene(page, (s) => s.setAnimated(true))
    await scene(page, (s) => s.handle().setLevel('site'))
    // Mean change of a pixel (0..255) from every frame to the next, through the whole fly.
    const diffs: number[] = []
    const mixes: number[] = []
    let prev: Buffer = PNG.sync.read(await page.screenshot()).data
    let last = { flying: true, mix: 0 }
    for (let i = 1; i <= 200 && last.flying; i++) {
      last = await scene(page, (s) => {
        s.advance(1000 / 60)
        const p = s.flyPose()
        return { flying: p.flying, mix: p.mix }
      })
      const png = PNG.sync.read(await page.screenshot())
      let sum = 0
      for (let k = 0; k < png.data.length; k += 4) sum += Math.abs(png.data[k] - prev[k]) + Math.abs(png.data[k + 1] - prev[k + 1]) + Math.abs(png.data[k + 2] - prev[k + 2])
      diffs.push(sum / (png.data.length / 4) / 3)
      mixes.push(last.mix)
      prev = png.data
      if (Math.abs(last.mix - 0.5) < 0.04) await page.screenshot({ path: 'test-results/s3-fly-mid-dissolve.png' })
    }
    const worst = diffs.indexOf(Math.max(...diffs))
    console.log(`S3 picture: ${diffs.length} frames; largest mean pixel change from one frame to the next ${diffs[worst].toFixed(1)} of 255 at frame ${worst + 1} (scene share ${mixes[worst].toFixed(2)})`)
    console.log(`S3 picture: change per frame, every 8th: ${diffs.filter((_, i) => i % 8 === 0).map((d) => d.toFixed(1)).join(' ')}`)
    // A cut is one frame that changes far more than the frames around it (before S3: the last frame of the fly).
    // The picture changes fastest in the middle of the fly, where the ground comes up; the bound is on how
    // much one frame may exceed its neighbours.
    for (let i = 1; i < diffs.length - 1; i++) {
      expect(diffs[i], `frame ${i + 1} (scene share ${mixes[i].toFixed(2)}) against the frames around it`).toBeLessThan(1.6 * Math.max(diffs[i - 1], diffs[i + 1]) + 1)
    }
    expect(diffs[diffs.length - 1], 'the last frame of the fly is no jump').toBeLessThan(1.6 * diffs[diffs.length - 2] + 1)
    // The frame after the fly has ended is the frame the fly ended on.
    const end = PNG.sync.read(await page.screenshot())
    await scene(page, (s) => s.advance(1000 / 60))
    const rest = PNG.sync.read(await page.screenshot())
    let sum = 0
    for (let k = 0; k < end.data.length; k += 4) sum += Math.abs(end.data[k] - rest.data[k])
    expect(sum / (end.data.length / 4), 'no change after the fly has ended').toBeLessThan(0.5)
    await page.screenshot({ path: 'test-results/s3-fly-arrived-site.png' })
  })
})
