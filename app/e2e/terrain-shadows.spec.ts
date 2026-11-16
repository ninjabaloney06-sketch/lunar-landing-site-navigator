// Science lead, 16 Nov: "when starting the default timelapse there are some weird rectangular shadows". They were
// the shadow model of 15 Nov night (one crest shading a straight strip of ground that turned with the Sun, and the
// site's own share on a 400 m patch). The terrain now casts its own shadows (src/scene3d/shadowmap.ts, sunlight.ts).
// This spec checks the picture of the default Play (Connecting Ridge, 16–29 Aug 2027, landing-site view, the camera
// standing still while the time runs) against the terrain:
//   1. The GPU's shadow textures agree with the direct march over the drawn heights on the CPU (shadows.ts).
//   2. Light and dark in the frame follow the terrain: a pixel whose ground the terrain shades is dark, and ground
//      the terrain leaves in the Sun and that faces the Sun is bright. A strip, a patch or any other region that is
//      not the terrain's shadow would break one of the two.
//   3. Along straight cuts over the ground where the strip's edges and the patch's rim used to be, the drawn share
//      is the terrain's own share: no edge that the terrain does not have.
//   4. The shadow passes run once per change of the Sun, not per frame.
// Run: PW_GPU=1 PW_PORT=5221 npx playwright test e2e/terrain-shadows.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'

type Probe = { x: number; y: number; gpu: number; cpu: number } | null
interface Scene {
  ready: Promise<void>
  setView(o: Record<string, unknown>): Promise<unknown>
  load(site: string, utc: string): Promise<void>
  sunShareAt(x: number, y: number): number
  sunAzEl(): { az: number; el: number }
  terrainAt(x: number, y: number): { x: number; y: number; z: number } | null
  shadowInfo(): { runs: number; active: boolean; levels: { n: number; spacing: number; ext: number }[] }
  shadowProbe(li: number, x: number, y: number): Probe
}
const scene = <T>(page: Page, fn: (s: Scene) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__scene)`) as Promise<T>

async function open(page: Page) {
  await page.goto('/?test=1#site=connecting-ridge&period=shackleton-2027-08&view=site')
  await page.waitForFunction(() => (window as unknown as { __scene?: unknown }).__scene !== undefined)
  await scene(page, (s) => s.ready)
}
/** Share of the disc for c (−1 whole … +1 none): geometry.discFraction's formula. */
const share = (c: number) => (c <= -1 ? 1 : c >= 1 ? 0 : (Math.acos(c) - c * Math.sqrt(1 - c * c)) / Math.PI)
// Times across the default period: the Sun goes half way round the horizon.
const TIMES = ['2027-08-16T06:00Z', '2027-08-18T00:00Z', '2027-08-19T18:00Z', '2027-08-21T12:00Z', '2027-08-23T06:00Z', '2027-08-25T00:00Z', '2027-08-26T18:00Z', '2027-08-28T12:00Z']

test.describe('terrain shadows in the default Play', () => {
  test.setTimeout(300_000)

  test('the GPU shadow textures agree with the direct march on the CPU, at every level', async ({ page }) => {
    await open(page)
    const info = await scene(page, (s) => s.shadowInfo())
    expect(info.active, 'the GPU can render the shadow passes').toBe(true)
    expect(info.levels.length).toBeGreaterThanOrEqual(4)
    for (const utc of [TIMES[0], TIMES[3], TIMES[6]]) {
      await page.evaluate((utc) => (window as unknown as { __scene: Scene }).__scene.setView({ site: 'connecting-ridge', utc, level: 'site' }), utc)
      const rows = await page.evaluate((levels) => {
        const s = (window as unknown as { __scene: Scene }).__scene
        const out: { li: number; gpu: number; cpu: number }[] = []
        levels.forEach((l, li) => {
          // A regular 13 × 13 lattice of the level's samples, off the axes.
          for (let a = 0; a < 13; a++) {
            for (let b = 0; b < 13; b++) {
              const p = s.shadowProbe(li, (((a + 0.37) / 13) * 2 - 1) * l.ext, (((b + 0.61) / 13) * 2 - 1) * l.ext)
              if (p) out.push({ li, gpu: p.gpu, cpu: p.cpu })
            }
          }
        })
        return out
      }, info.levels)
      expect(rows.length, 'the textures can be read back').toBe(info.levels.length * 169)
      for (let li = 0; li < info.levels.length; li++) {
        const r = rows.filter((q) => q.li === li)
        const diff = r.map((q) => Math.abs(share(q.gpu) - share(q.cpu)))
        const mean = diff.reduce((a, b) => a + b, 0) / diff.length
        const flips = diff.filter((d) => d > 0.5).length / diff.length
        const lit = r.filter((q) => share(q.cpu) > 0.5).length / r.length
        console.log(`${utc} level ${li} (${info.levels[li].spacing} m): CPU lit ${(lit * 100).toFixed(0)} %, mean |GPU − CPU| share ${mean.toFixed(4)}, lit/dark flips ${(flips * 100).toFixed(1)} %`)
        expect(mean, `level ${li} at ${utc}: mean difference of the Sun share`).toBeLessThan(0.04)
        expect(flips, `level ${li} at ${utc}: samples lit in one and dark in the other`).toBeLessThan(0.04)
      }
    }
  })

  test('light and dark in the frame follow the terrain, at eight times with the camera standing still', async ({ page }) => {
    await open(page)
    // The default view once (as Play: the camera does not follow the Sun afterwards).
    await scene(page, (s) => s.setView({ site: 'connecting-ridge', utc: '2027-08-16T00:00Z', level: 'site' }))
    for (const utc of TIMES) {
      await page.evaluate((utc) => (window as unknown as { __scene: Scene }).__scene.load('connecting-ridge', utc), utc)
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      const png = PNG.sync.read(await page.screenshot())
      // Ground points under a lattice of pixels in the terrain part of the picture, with the share of the Sun the
      // terrain leaves there and 300 m to each side (so a point counts only well inside a shadow or well outside:
      // the ground under a pixel is found on the coarse pick mesh, a few pixels off near a crest).
      const pts = await page.evaluate(() => {
        const s = (window as unknown as { __scene: Scene }).__scene
        const sun = s.sunAzEl()
        const out: { px: number; py: number; share: number; around: number[] }[] = []
        for (let py = 250; py <= 480; py += 10) {
          for (let px = 20; px <= 1260; px += 20) {
            const g = s.terrainAt(px, py)
            if (!g || Math.hypot(g.x, g.y) > 55_000) continue
            const around = [0, 90, 180, 270].map((d) => s.sunShareAt(g.x + 300 * Math.sin(((sun.az + d) * Math.PI) / 180), g.y + 300 * Math.cos(((sun.az + d) * Math.PI) / 180)))
            out.push({ px, py, share: s.sunShareAt(g.x, g.y), around })
          }
        }
        return out
      })
      const lum = (x: number, y: number) => {
        // Mean of a 3 × 3 block, so one pixel of a label's edge does not count.
        let sum = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const i = ((y + dy) * png.width + x + dx) * 4
            sum += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]
          }
        }
        return sum / 9
      }
      // Points well inside a shadow (the share is 0 there and 300 m around) and well inside the Sun.
      const inShadow = pts.filter((p) => p.share === 0 && p.around.every((v) => v === 0))
      const dark = inShadow.map((p) => lum(p.px, p.py))
      const sunny = pts.filter((p) => p.share === 1 && p.around.every((v) => v === 1)).map((p) => lum(p.px, p.py))
      const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / Math.max(v.length, 1)
      const brightDark = dark.filter((v) => v > 70).length
      console.log(`${utc}: ${pts.length} ground points, ${dark.length} in shadow (mean luminance ${mean(dark).toFixed(1)}, ${brightDark} above 70), ${sunny.length} in the Sun (mean ${mean(sunny).toFixed(1)})`)
      expect(pts.length).toBeGreaterThan(600)
      expect(dark.length, 'there is shadow in the picture').toBeGreaterThan(50)
      expect(sunny.length, 'and sunlit ground').toBeGreaterThan(20)
      // Shadowed ground is dark everywhere, never a lit region (the mast, its cross, the pins and the labels cover
      // about ten of the points; a strip or patch of the old kind covered hundreds).
      expect(brightDark / dark.length, 'points in the terrain shadow that are drawn bright').toBeLessThan(0.03)
      expect(mean(dark), 'shadowed ground: dark, and not black').toBeGreaterThan(14)
      expect(mean(dark)).toBeLessThan(45)
      // Sunlit ground is clearly brighter than shadowed ground (it varies with its slope toward the Sun).
      expect(mean(sunny), 'sunlit ground against shadowed ground').toBeGreaterThan(2.5 * mean(dark))
      await page.screenshot({ path: `test-results/shadows/still-camera-${utc.slice(5, 13)}.png` })
    }
  })

  test('no edge the terrain does not have: across the old strip and patch boundaries the drawn share is the terrain shadow', async ({ page }) => {
    await open(page)
    for (const utc of TIMES) {
      await page.evaluate((utc) => (window as unknown as { __scene: Scene }).__scene.setView({ site: 'connecting-ridge', utc, level: 'site' }), utc)
      // The strip ran from the site away from the Sun, 0.6–4 km wide each side, with straight edges parallel to the
      // Sun's azimuth; the patch was a disc of 400–800 m. Cuts across both, 700 m and 3 km behind the site, and a
      // ring at 600 m. Wherever the share changes along a cut, the level-ground model of the strip would have put
      // the change at the same distance from the Sun line on both cuts and on both sides.
      const cuts = await page.evaluate(() => {
        const s = (window as unknown as { __scene: Scene }).__scene
        const sun = s.sunAzEl()
        const a = (sun.az * Math.PI) / 180
        const h = [Math.sin(a), Math.cos(a)] // toward the Sun
        const cut = (behind: number) => {
          const v: number[] = []
          for (let l = -9000; l <= 9000; l += 100) v.push(s.sunShareAt(-h[0] * behind - h[1] * l, -h[1] * behind + h[0] * l))
          return v
        }
        const ring: number[] = []
        for (let k = 0; k < 72; k++) ring.push(s.sunShareAt(600 * Math.sin((k * 5 * Math.PI) / 180), 600 * Math.cos((k * 5 * Math.PI) / 180)))
        return { near: cut(700), far: cut(3000), ring, site: s.sunShareAt(0, 0) }
      })
      // Edges of a cut: where the share crosses one half, as a distance from the Sun line.
      const edges = (v: number[]) => v.flatMap((x, i) => (i > 0 && x > 0.5 !== v[i - 1] > 0.5 ? [Math.abs(-9000 + i * 100)] : []))
      const eNear = edges(cuts.near)
      const eFar = edges(cuts.far)
      // The strip: exactly two edges on each cut, at one distance d (0.6–4 km) left and right on both cuts.
      const strip = (e: number[]) => e.length === 2 && Math.abs(e[0] - e[1]) <= 200 && e[0] >= 500 && e[0] <= 8100
      const both = strip(eNear) && strip(eFar) && Math.abs(eNear[0] - eFar[0]) <= 200
      console.log(`${utc}: site share ${cuts.site.toFixed(2)}, edges 700 m behind at ${eNear.join(' ')} m, 3 km behind at ${eFar.join(' ')} m from the Sun line`)
      expect(both, 'a strip of constant width along the Sun line').toBe(false)
      // The patch: a ring at 600 m all at the site's share while it differs from the ground beyond.
      const ringSame = cuts.ring.every((v) => Math.abs(v - cuts.site) < 0.02)
      const beyond = cuts.near.filter((v) => Math.abs(v - cuts.site) > 0.5).length
      expect(ringSame && beyond > cuts.near.length / 2 && cuts.site > 0.02 && cuts.site < 0.98, 'a disc at the site with a share of its own').toBe(false)
    }
  })

  test('the shadow passes run when the Sun or the terrain changes, not per frame', async ({ page }) => {
    await open(page)
    await scene(page, (s) => s.setView({ site: 'connecting-ridge', utc: '2027-08-18T00:00Z', level: 'site' }))
    const a = await scene(page, (s) => s.shadowInfo().runs)
    // Camera moves at the same time: frames are drawn, the Sun stands still.
    for (const az of [10, 80, 200]) await page.evaluate((az) => (window as unknown as { __scene: Scene }).__scene.setView({ level: 'site', az, el: 20, dist: 12 }), az)
    expect(await scene(page, (s) => s.shadowInfo().runs)).toBe(a)
    await scene(page, (s) => s.setView({ utc: '2027-08-18T06:00Z', level: 'site' }))
    expect(await scene(page, (s) => s.shadowInfo().runs)).toBe(a + 1)
  })
})
