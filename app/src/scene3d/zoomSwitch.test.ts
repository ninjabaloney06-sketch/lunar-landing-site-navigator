import { describe, expect, it } from 'vitest'
import { createZoomSwitch, ZOOM_SWITCH } from './zoomSwitch'

const NOTCH = 0.128 // controls.ts STEP
/** Three inputs of one gesture at the limit, the first at t; true when the third switched. */
const gesture = (z: ReturnType<typeof createZoomSwitch>, dir: 'in' | 'out', t: number) => {
  z.feed(dir, 1, true, t)
  z.feed(dir, 1, true, t + 10)
  return z.feed(dir, 1, true, t + 20)
}

describe('zoomSwitch', () => {
  it('three wheel notches at the limit switch; one or two do not', () => {
    const z = createZoomSwitch()
    expect(z.feed('in', NOTCH, true, 0)).toBe(false)
    expect(z.feed('in', NOTCH, true, 50)).toBe(false)
    expect(z.feed('in', NOTCH, true, 100)).toBe(true)
  })

  it('a single small step at the limit never switches, however often it is repeated with pauses', () => {
    const z = createZoomSwitch()
    for (let i = 0; i < 20; i++) expect(z.feed('in', NOTCH, true, i * (ZOOM_SWITCH.WINDOW_MS + 1))).toBe(false)
  })

  it('input away from the limit does not count and clears what was gathered', () => {
    const z = createZoomSwitch()
    for (let i = 0; i < 50; i++) expect(z.feed('in', 0.5, false, i * 10)).toBe(false)
    z.feed('in', NOTCH, true, 600)
    z.feed('in', NOTCH, true, 610)
    expect(z.feed('in', NOTCH, false, 620)).toBe(false)
    expect(z.feed('in', NOTCH, true, 630)).toBe(false)
  })

  it('a change of direction starts again', () => {
    const z = createZoomSwitch()
    z.feed('out', NOTCH, true, 0)
    z.feed('out', NOTCH, true, 10)
    expect(z.feed('in', NOTCH, true, 20)).toBe(false)
    expect(z.feed('in', NOTCH, true, 30)).toBe(false)
    expect(z.feed('in', NOTCH, true, 40)).toBe(true)
  })

  it('a trackpad pinch gathers small inputs up to the threshold', () => {
    const z = createZoomSwitch()
    let fired = -1
    for (let i = 0; i < 100 && fired < 0; i++) if (z.feed('out', 0.02, true, i * 16)) fired = i
    expect(fired).toBe(Math.ceil(ZOOM_SWITCH.THRESHOLD_LN / 0.02) - 1)
  })

  it('one long scroll with inertia switches once: nothing counts until the cooldown is over and the input has paused', () => {
    const z = createZoomSwitch()
    let fired = 0
    let t = 0
    // 6 s of events every 16 ms, always at a limit (as after a switch whose new view is at its own limit).
    for (; t < 6000; t += 16) if (z.feed('out', NOTCH, true, t)) fired++
    expect(fired).toBe(1)
    // A pause shorter than the quiet time keeps it off; a real pause arms it again.
    expect(gesture(z, 'out', (t += ZOOM_SWITCH.QUIET_MS - 50))).toBe(false)
    expect(gesture(z, 'out', (t += ZOOM_SWITCH.QUIET_MS + 30))).toBe(true)
  })

  it('a pause right after a switch does not arm it before the cooldown ends', () => {
    const z = createZoomSwitch()
    expect(gesture(z, 'in', 0)).toBe(true)
    expect(gesture(z, 'out', ZOOM_SWITCH.COOLDOWN_MS - 30)).toBe(false)
    // Those inputs were inside the cooldown; the next gesture comes after a pause and counts.
    expect(gesture(z, 'out', ZOOM_SWITCH.COOLDOWN_MS + ZOOM_SWITCH.QUIET_MS)).toBe(true)
  })

  it('reset forgets the cooldown', () => {
    const z = createZoomSwitch()
    expect(gesture(z, 'in', 0)).toBe(true)
    z.reset()
    expect(gesture(z, 'out', 30)).toBe(true)
  })

  it('one large input at the limit counts as one notch: a single event never switches', () => {
    const z = createZoomSwitch()
    expect(z.feed('in', 5, true, 0)).toBe(false)
    expect(z.feed('in', 5, true, 10)).toBe(false)
    expect(z.feed('in', 5, true, 20)).toBe(true)
  })
})
