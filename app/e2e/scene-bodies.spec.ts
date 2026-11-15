// Scene track, 14 Nov, ninja's bug list: the zoom at the Earth, Sun and Moon viewpoints (S6), the camera following
// its body over time (S7), the Moon's label anchor (S8) and bodies hiding each other (S9). Scene harness, test mode.
// Run: PW_PORT=5181 npx playwright test e2e/scene-bodies.spec.ts --workers=1
import { expect, test, type Page } from '@playwright/test'

type Pt = { x: number; y: number; visible: boolean }
interface Cam {
  level: string
  position: number[]
  quaternion: number[]
  forward: number[]
  fov: number
  width: number
  height: number
}
interface Body {
  name: string
  center: number[]
  camera: number[]
}
interface Scene {
  ready: Promise<void>
  setView(o: Record<string, unknown>): Promise<Cam>
  camera(): Cam
  goTo(v: string): Promise<boolean>
  bodies(): Body[]
  surfaceDist(): number
  load(siteId: string, utc: string | number): Promise<void>
  setAnimated(on: boolean): void
  advance(ms: number): void
  flying(): boolean
  topView(): boolean
  setMoonVisible(on: boolean): void
  handle(): { project(n: string): Pt | null; labelPoint(n: string): Pt | null; goTo(v: string): boolean }
}
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>
const setView = (page: Page, o: Record<string, unknown>) => page.evaluate((o) => (window as unknown as { __scene: Scene }).__scene.setView(o), o)
const goTo = (page: Page, v: string) => page.evaluate((v) => (window as unknown as { __scene: Scene }).__scene.goTo(v), v)
const load = (page: Page, utc: string | number) => page.evaluate((utc) => (window as unknown as { __scene: Scene }).__scene.load('connecting-ridge', utc), utc)
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
async function open(page: Page) {
  await page.goto('/src/scene3d/harness.html?test=1')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
}
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const SITE = 'connecting-ridge'
const FULL_MOON = '2027-08-17T07:00:00Z' // full Moon of 17 Aug 2027 (JPL Horizons via the app's ephemeris: Sun and Earth opposite, tested below)
const NEW_MOON = '2027-08-02T10:00:00Z'
const DAY = 86_400_000

/** n wheel events of deltaY px each on the middle of the canvas, as a trackpad sends them (ctrl = a pinch). */
const trackpad = (page: Page, deltaY: number, n: number, ctrl = false) =>
  page.evaluate(
    ([deltaY, n, ctrl]) => {
      const c = document.querySelector('#scene canvas')!
      const r = c.getBoundingClientRect()
      for (let i = 0; i < (n as number); i++) {
        c.dispatchEvent(
          new WheelEvent('wheel', { deltaY: deltaY as number, deltaMode: 0, ctrlKey: ctrl as boolean, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }),
        )
      }
    },
    [deltaY, n, ctrl] as const,
  )
/** Distance from the camera to the centre of the body a viewpoint is about, km. */
const bodyDist = (page: Page, name: string) =>
  page.evaluate((name) => {
    const b = (window as unknown as { __scene: Scene }).__scene.bodies().find((x) => x.name === name)!
    return Math.hypot(b.center[0] - b.camera[0], b.center[1] - b.camera[1], b.center[2] - b.camera[2])
  }, name)

test.describe('S6: the zoom works in both directions at every viewpoint', () => {
  for (const [label, utc] of [
    ['full Moon', FULL_MOON],
    ['new Moon', NEW_MOON],
  ] as const) {
    test(`${label}: small wheel steps in and the same steps out return to the start at the Earth, Sun and Moon viewpoints; the pinch too`, async ({ page }) => {
      await open(page)
      for (const vp of ['earth', 'sun', 'moon']) {
        await setView(page, { site: SITE, utc, level: 'globe' })
        expect(await goTo(page, vp)).toBe(true)
        const d0 = await bodyDist(page, vp)
        // 40 events of 3 px, as a slow two-finger scroll: in, then out.
        await trackpad(page, -3, 40)
        const dIn = await bodyDist(page, vp)
        expect(dIn / d0, `${vp}: scrolling in comes closer`).toBeLessThan(0.97)
        await trackpad(page, 3, 40)
        const back = await bodyDist(page, vp)
        expect(Math.abs(back - d0) / d0, `${vp}: the same steps out return to the start`).toBeLessThan(1e-6)
        // Out first, then in.
        await trackpad(page, 3, 40)
        const dOut = await bodyDist(page, vp)
        expect(dOut / d0, `${vp}: scrolling out moves away`).toBeGreaterThan(1.03)
        await trackpad(page, -3, 40)
        expect(Math.abs((await bodyDist(page, vp)) - d0) / d0, `${vp}: and back in returns to the start`).toBeLessThan(1e-6)
        // A pinch arrives as wheel events with ctrlKey: fingers apart (negative) comes closer, and it reverses.
        await trackpad(page, -2, 20, true)
        const pinched = await bodyDist(page, vp)
        expect(pinched / d0, `${vp}: pinch in`).toBeLessThan(0.9)
        await trackpad(page, 2, 20, true)
        expect(Math.abs((await bodyDist(page, vp)) - d0) / d0, `${vp}: pinch out returns`).toBeLessThan(1e-6)
        console.log(`S6 ${label} ${vp}: ${d0.toFixed(0)} km → in ${dIn.toFixed(0)} → back ${back.toFixed(0)} → out ${dOut.toFixed(0)} km; pinch ${pinched.toFixed(0)} km`)
      }
    })
  }

  test('zooming out stops at an outer limit around the body and comes back in from it; site level reverses too', async ({ page }) => {
    await open(page)
    const R: Record<string, number> = { earth: 6371.0, sun: 695700, moon: 1737.4 }
    for (const vp of ['earth', 'sun', 'moon']) {
      await setView(page, { site: SITE, utc: FULL_MOON, level: 'globe' })
      await goTo(page, vp)
      await trackpad(page, 100, 60)
      const far = await bodyDist(page, vp)
      // The Moon's own outer limit is 20 000 km from its centre, 11.51 radii; the same number of radii for Earth and the Sun.
      expect(far / R[vp], `${vp}: outer limit in body radii`).toBeGreaterThan(11.4)
      expect(far / R[vp], `${vp}: outer limit in body radii`).toBeLessThanOrEqual(20000 / 1737.4 + 1e-6)
      await trackpad(page, -100, 3)
      expect((await bodyDist(page, vp)) / far, `${vp}: back in from the limit`).toBeLessThan(0.8)
    }
    await setView(page, { site: SITE, utc: FULL_MOON, level: 'site', az: 40, el: 35, dist: 6 })
    const h0 = await scene(page, (s) => s.surfaceDist())
    await trackpad(page, -3, 40)
    const hIn = await scene(page, (s) => s.surfaceDist())
    expect(hIn / h0, 'site level: in').toBeLessThan(0.97)
    await trackpad(page, 3, 40)
    // The step follows the terrain height under the camera, so the way back is not exactly the way in.
    expect(Math.abs((await scene(page, (s) => s.surfaceDist())) - h0) / h0, 'site level: out returns within 2 %').toBeLessThan(0.02)
    await trackpad(page, 3, 40)
    expect((await scene(page, (s) => s.surfaceDist())) / h0, 'site level: out').toBeGreaterThan(1.03)
    await frames(page)
    await page.screenshot({ path: 'test-results/s6-site-after-trackpad-zoom.png' })
  })
})

test.describe('S7: at the Sun and Earth viewpoints the camera stays with the body while the time changes', () => {
  const T0 = Date.parse('2027-08-10T00:00:00Z')

  test('14 days in daily steps: the body stays within 1 px of where it was, at the zoom the user chose', async ({ page }) => {
    await open(page)
    for (const vp of ['sun', 'earth']) {
      await setView(page, { site: SITE, utc: T0, level: 'globe' })
      await goTo(page, vp)
      await trackpad(page, -3, 40) // the user's zoom
      const p0 = (await page.evaluate((vp) => (window as unknown as { __scene: Scene }).__scene.handle().project(vp), vp))!
      const d0 = await bodyDist(page, vp)
      expect(Math.hypot(p0.x - 640, p0.y - 360), `${vp}: centred to begin with`).toBeLessThan(1)
      let worst = 0
      let moved = 0
      const c0 = (await scene(page, (s) => s.bodies())).find((b) => b.name === vp)!.center
      for (let day = 1; day <= 14; day++) {
        await load(page, T0 + day * DAY)
        const p = (await page.evaluate((vp) => (window as unknown as { __scene: Scene }).__scene.handle().project(vp), vp))!
        worst = Math.max(worst, Math.hypot(p.x - p0.x, p.y - p0.y))
        expect(Math.hypot(p.x - p0.x, p.y - p0.y), `${vp}, day ${day}: still where it was in the picture`).toBeLessThan(1)
        expect(Math.abs((await bodyDist(page, vp)) - d0) / d0, `${vp}, day ${day}: the zoom is kept`).toBeLessThan(1e-9)
        moved = dist((await scene(page, (s) => s.bodies())).find((b) => b.name === vp)!.center, c0)
      }
      console.log(`S7 ${vp}: over 14 days its centre moved ${moved.toFixed(0)} km in the Moon's frame; on screen it stayed within ${worst.toFixed(3)} px`)
      expect(moved, `${vp}: the body did move`).toBeGreaterThan(vp === 'sun' ? 1e8 : 1e3)
      await page.screenshot({ path: `test-results/s7-${vp}-viewpoint-after-14-days.png` })
      // Leaving the viewpoint ends it: a new time no longer moves the camera.
      await goTo(page, 'moon')
      const cam = (await scene(page, (s) => s.camera())).position
      await load(page, T0 + 20 * DAY)
      expect(dist((await scene(page, (s) => s.camera())).position, cam), 'at the Moon viewpoint the camera stays').toBe(0)
    }
  })

  test('the time changes during the flight to the Sun: it arrives on the Sun where it is now', async ({ page }) => {
    await open(page)
    await setView(page, { site: SITE, utc: T0, level: 'globe' })
    await scene(page, (s) => s.setAnimated(true))
    expect(await scene(page, (s) => s.handle().goTo('sun'))).toBe(true)
    await page.evaluate(() => {
      const s = (window as unknown as { __scene: Scene }).__scene
      for (let i = 0; i < 30; i++) s.advance(1000 / 60)
    })
    await load(page, T0 + 3 * DAY)
    await page.evaluate(() => {
      const s = (window as unknown as { __scene: Scene }).__scene
      for (let i = 0; i < 200 && s.flying(); i++) s.advance(1000 / 60)
    })
    expect(await scene(page, (s) => s.flying())).toBe(false)
    const p = (await scene(page, (s) => s.handle().project('sun')))!
    expect(Math.hypot(p.x - 640, p.y - 360), 'the Sun is in the middle of the picture').toBeLessThan(1)
    expect((await bodyDist(page, 'sun')) / 695700, 'at the viewpoint distance').toBeCloseTo(5.5, 6)
  })
})

// ---------- S8, S9: expectations computed here from the camera and the bodies the scene reports ----------

const RADIUS: Record<string, number> = { moon: 1737.4, earth: 6371.0, sun: 695700 }
type V = number[]
const sub = (a: V, b: V) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
/** v rotated by the inverse of the unit quaternion q = (x, y, z, w): world → camera axes. */
function toCamera(v: V, q: V): V {
  const [x, y, z, w] = [-q[0], -q[1], -q[2], q[3]]
  const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])]
  return [v[0] + w * t[0] + (y * t[2] - z * t[1]), v[1] + w * t[1] + (z * t[0] - x * t[2]), v[2] + w * t[2] + (x * t[1] - y * t[0])]
}
/** Pinhole projection of a MOON_ME point, with whether it is in front of the camera and inside the picture. */
function pinhole(cam: Cam, p: V) {
  const c = toCamera(sub(p, cam.position), cam.quaternion)
  const t = Math.tan((cam.fov / 2) * (Math.PI / 180))
  const x = ((c[0] / -c[2] / (t * (cam.width / cam.height)) + 1) / 2) * cam.width
  const y = ((1 - c[1] / -c[2] / t) / 2) * cam.height
  return { x, y, inView: c[2] < 0 && x >= 0 && x <= cam.width && y >= 0 && y <= cam.height }
}
/** Is the centre of `name` behind another body, seen from the camera? Segment against sphere. */
function behind(name: string, bodies: Body[]): string | null {
  const cam = bodies[0].camera
  const target = bodies.find((b) => b.name === name)!.center
  const d = sub(target, cam)
  const len = Math.hypot(...d)
  for (const b of bodies) {
    if (b.name === name) continue
    const oc = sub(b.center, cam)
    const along = dot(oc, d) / len
    if (along <= 0 || along >= len) continue
    const miss = Math.sqrt(Math.max(dot(oc, oc) - along * along, 0))
    if (miss < RADIUS[b.name] * 0.999) return b.name
    if (miss < RADIUS[b.name] * 1.001) return 'edge'
  }
  return null
}
const snapshot = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __scene: Scene }).__scene
    const h = s.handle()
    return {
      cam: s.camera(),
      bodies: s.bodies(),
      sun: h.project('sun'),
      earth: h.project('earth'),
      moon: h.project('moon'),
      moonLabel: h.labelPoint('moon'),
      sunLabel: h.labelPoint('sun'),
    }
  })

test.describe('S8: the Moon has a label anchor where it is a body in the picture', () => {
  test('null at globe, site and eye level and in the top view; at the Earth and Sun viewpoints the projected centre of the Moon', async ({ page }) => {
    await open(page)
    for (const level of ['globe', 'site', 'eye']) {
      await setView(page, { site: SITE, utc: FULL_MOON, level })
      const s = await snapshot(page)
      expect(s.moon, `${level}: no Moon label`).toBeNull()
      expect(s.moonLabel, `${level}: no Moon label`).toBeNull()
    }
    await setView(page, { site: SITE, utc: FULL_MOON, level: 'globe', el: -60, az: 20, dist: 20000 })
    expect((await snapshot(page)).moon, 'the farthest globe view: still the globe').toBeNull()
    await goTo(page, 'top')
    expect(await scene(page, (s) => s.topView())).toBe(true)
    expect((await snapshot(page)).moon, 'top view: it names the Moon itself').toBeNull()

    // Sun viewpoint, then two weeks of half-day steps: the camera goes with the Sun (S7) and the Moon passes
    // from behind the camera through the picture to behind the Sun.
    const T0 = Date.parse('2027-08-03T00:00:00Z')
    await setView(page, { site: SITE, utc: T0, level: 'globe' })
    await goTo(page, 'sun')
    let inPicture = 0
    let offScreen = 0
    let shot = false
    for (let k = 0; k <= 34; k++) {
      await load(page, T0 + (k * DAY) / 2)
      const s = await snapshot(page)
      expect(s.moon, 'the Moon has an anchor at the Sun viewpoint').not.toBeNull()
      const want = pinhole(s.cam, [0, 0, 0])
      const hid = behind('moon', s.bodies)
      if (want.inView) {
        expect(Math.hypot(s.moon!.x - want.x, s.moon!.y - want.y), `step ${k}: the Moon's centre on screen`).toBeLessThan(1)
        if (hid !== 'edge') expect(s.moon!.visible, `step ${k}: ${hid ? `behind the ${hid}` : 'in the open'}`).toBe(hid === null)
        if (hid === null) inPicture++
        // At 150 million km the Moon is far smaller than a pixel: the label is at its centre.
        if (s.moon!.visible) expect(s.moonLabel).toEqual(s.moon)
        if (hid === null && !shot && want.x > 200 && want.x < 1080) {
          shot = true
          console.log(`S8: Sun viewpoint, step ${k}: Moon anchor at ${s.moon!.x.toFixed(1)}, ${s.moon!.y.toFixed(1)} px`)
          await page.screenshot({ path: 'test-results/s8-sun-viewpoint-moon-in-picture.png' })
        }
      } else {
        expect(s.moon!.visible, `step ${k}: outside the picture`).toBe(false)
        offScreen++
      }
    }
    console.log(`S8: Sun viewpoint over 17 days: Moon in the picture and in the open at ${inPicture} steps, outside the picture at ${offScreen}`)
    expect(inPicture).toBeGreaterThan(2)
    expect(offScreen).toBeGreaterThan(2)
  })

  test('a Moon disc wider than 40 px is labelled at its top edge: leaving the Moon for the Sun viewpoint', async ({ page }) => {
    await open(page)
    // Start between the Moon and the Sun, looking at the Moon: the flight to the Sun backs away from it, so the
    // Moon stays in the middle of the picture while it shrinks. 2 ms steps of the test clock.
    await setView(page, { site: SITE, utc: NEW_MOON, level: 'globe' })
    const sun = (await scene(page, (s) => s.bodies())).find((b) => b.name === 'sun')!.center
    const lat = (Math.asin(sun[2] / Math.hypot(...sun)) * 180) / Math.PI
    const lon = (Math.atan2(sun[1], sun[0]) * 180) / Math.PI
    await setView(page, { level: 'globe', el: lat, az: lon, dist: 6500 })
    await scene(page, (s) => s.setAnimated(true))
    expect(await scene(page, (s) => s.handle().goTo('sun'))).toBe(true)
    let checked = 0
    let sawNull = false
    for (let i = 0; i < 40; i++) {
      await scene(page, (s) => s.advance(2))
      const s = await snapshot(page)
      const d = Math.hypot(...s.cam.position)
      if (d <= 20000) {
        expect(s.moon, 'within the globe view\'s range: no Moon label yet').toBeNull()
        sawNull = true
        continue
      }
      expect(s.moon, `${d.toFixed(0)} km from the Moon: it has an anchor`).not.toBeNull()
      const r = ((RADIUS.moon / d) * (s.cam.height / 2)) / Math.tan((s.cam.fov / 2) * (Math.PI / 180))
      const want = pinhole(s.cam, [0, 0, 0])
      expect(Math.hypot(s.moon!.x - want.x, s.moon!.y - want.y)).toBeLessThan(1)
      expect(s.moon!.visible).toBe(true)
      expect(s.moonLabel!.x).toBeCloseTo(s.moon!.x, 6)
      if (r > 21) {
        expect(s.moonLabel!.y, `disc radius ${r.toFixed(0)} px: the label sits on its top edge`).toBeCloseTo(Math.max(s.moon!.y - r, 48), 1)
        checked++
      } else if (r < 19) expect(s.moonLabel!.y, `disc radius ${r.toFixed(0)} px: the label sits on its centre`).toBeCloseTo(s.moon!.y, 6)
    }
    expect(sawNull).toBe(true)
    expect(checked, 'frames with a Moon disc wider than 40 px').toBeGreaterThan(2)
  })
})

test.describe('S9: a body behind another is hidden by it, and its label with it', () => {
  test('Sun viewpoint over 17 days: Earth and the Moon are reported visible exactly when the Sun does not cover them', async ({ page }) => {
    await open(page)
    const T0 = Date.parse('2027-08-03T00:00:00Z')
    await setView(page, { site: SITE, utc: T0, level: 'globe' })
    await goTo(page, 'sun')
    const seen = { earth: { open: 0, covered: 0 }, moon: { open: 0, covered: 0 } }
    for (let k = 0; k <= 34; k++) {
      await load(page, T0 + (k * DAY) / 2)
      const s = await snapshot(page)
      for (const name of ['earth', 'moon'] as const) {
        const want = pinhole(s.cam, s.bodies.find((b) => b.name === name)!.center)
        const got = s[name]!
        if (!want.inView) {
          expect(got.visible, `step ${k}: ${name} outside the picture`).toBe(false)
          continue
        }
        expect(Math.hypot(got.x - want.x, got.y - want.y), `step ${k}: ${name} on screen`).toBeLessThan(1)
        const hid = behind(name, s.bodies)
        if (hid === 'edge') continue
        expect(got.visible, `step ${k}: ${name} ${hid ? `is behind the ${hid}` : 'is beside the Sun, in the open'}`).toBe(hid === null)
        seen[name][hid ? 'covered' : 'open']++
        if (hid === 'sun' && name === 'earth' && seen.earth.covered === 1) {
          console.log(`S9: Sun viewpoint, step ${k}: Earth is behind the Sun at ${got.x.toFixed(0)}, ${got.y.toFixed(0)} px → visible ${got.visible}`)
          await page.screenshot({ path: 'test-results/s9-sun-viewpoint-earth-behind-sun.png' })
        }
      }
      // The Sun itself is never covered from its own viewpoint.
      expect(s.sun!.visible).toBe(true)
    }
    console.log(`S9: Sun viewpoint: Earth in the open ${seen.earth.open} steps, behind the Sun ${seen.earth.covered}; Moon in the open ${seen.moon.open}, behind the Sun ${seen.moon.covered}`)
    for (const name of ['earth', 'moon'] as const) {
      expect(seen[name].open, `${name}: frames beside the disc`).toBeGreaterThan(1)
      expect(seen[name].covered, `${name}: frames behind the disc`).toBeGreaterThan(1)
    }
  })

  test('Earth viewpoint at full Moon: the Moon behind Earth is not drawn over it and not reported visible; turned aside, it is', async ({ page }) => {
    const { PNG } = await import('pngjs')
    await open(page)
    await setView(page, { site: SITE, utc: FULL_MOON, level: 'globe' })
    await goTo(page, 'earth')
    const s = await snapshot(page)
    const want = pinhole(s.cam, [0, 0, 0])
    expect(want.inView, 'at full Moon the Moon is behind Earth, in the middle of the picture').toBe(true)
    expect(behind('moon', s.bodies)).toBe('earth')
    expect(s.moon!.visible, 'the Moon is behind Earth').toBe(false)
    expect(s.earth!.visible, 'Earth is in front of the Moon, not hidden by it').toBe(true)
    // The picture is the same with and without the Moon's mesh: Earth covers it.
    const patch = async () => {
      const png = PNG.sync.read(await page.screenshot())
      const out: number[] = []
      for (let y = Math.round(want.y) - 8; y <= Math.round(want.y) + 8; y++) {
        for (let x = Math.round(want.x) - 8; x <= Math.round(want.x) + 8; x++) out.push(...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3))
      }
      return out
    }
    const withMoon = await patch()
    await page.screenshot({ path: 'test-results/s9-earth-viewpoint-moon-behind-earth.png' })
    await scene(page, (sc) => {
      sc.setMoonVisible(false)
      sc.advance(0)
    })
    await frames(page)
    const without = await patch()
    await scene(page, (sc) => {
      sc.setMoonVisible(true)
      sc.advance(0)
    })
    const changed = withMoon.reduce((n, v, i) => n + Math.abs(v - without[i]), 0)
    expect(changed, 'pixels at the Moon\'s place changed by its mesh').toBe(0)

    // Orbit the camera around Earth until the Moon comes out beside it: reported visible, and drawn.
    let out: Awaited<ReturnType<typeof snapshot>> | null = null
    for (let i = 0; i < 12 && !out; i++) {
      await page.mouse.move(640, 600)
      await page.mouse.down()
      await page.mouse.move(700, 600)
      await page.mouse.move(760, 600)
      await page.mouse.up()
      await frames(page)
      const t = await snapshot(page)
      const w = pinhole(t.cam, [0, 0, 0])
      if (w.inView && behind('moon', t.bodies) === null) out = t
    }
    expect(out, 'the Moon comes out from behind Earth').not.toBeNull()
    expect(out!.moon!.visible, 'beside Earth the Moon is visible').toBe(true)
    const at = pinhole(out!.cam, [0, 0, 0])
    expect(Math.hypot(out!.moon!.x - at.x, out!.moon!.y - at.y)).toBeLessThan(1)
    const png = PNG.sync.read(await page.screenshot())
    const i = (Math.round(at.y) * png.width + Math.round(at.x)) * 4
    expect(png.data[i] + png.data[i + 1] + png.data[i + 2], 'the sunlit Moon is drawn at its place').toBeGreaterThan(120)
    await page.screenshot({ path: 'test-results/s9-earth-viewpoint-moon-beside-earth.png' })
  })
})
