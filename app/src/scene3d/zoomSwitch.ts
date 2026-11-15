// Zooming past a limit changes the view (15 Nov): on the Moon view, more zoom-in at the closest allowed zoom opens the
// landing-site view; there, more zoom-out at the farthest allowed zoom goes back to the Moon. This file only decides
// when; controls.ts reports each wheel or pinch input and index.ts changes the level.
//
// A switch needs a deliberate, continued gesture at the limit: THRESHOLD_LN of zoom in one direction, each input
// within WINDOW_MS of the one before and none counting for more than INPUT_MAX_LN (so never fewer than three inputs). After a switch nothing counts for COOLDOWN_MS, and then not until the input
// has paused for QUIET_MS, so one long trackpad scroll with inertia changes the view once and never flips back.

export const ZOOM_SWITCH = {
  /** ln of the zoom factor asked for at the limit: three wheel notches (controls.ts STEP 0.128), a pinch by 1.47. */
  THRESHOLD_LN: 0.384,
  /** The most one input counts: one wheel notch, so a single large wheel event at the limit does not switch. */
  INPUT_MAX_LN: 0.128,
  /** Longest gap between two inputs of one gesture, ms. */
  WINDOW_MS: 500,
  /** After a switch no input counts for this long, ms. */
  COOLDOWN_MS: 1500,
  /** After the cooldown the input must have paused this long before it counts again, ms. */
  QUIET_MS: 250,
}

export type ZoomDir = 'in' | 'out'

export interface ZoomSwitch {
  /**
   * One wheel or pinch input at time tMs: its direction, |ln of its zoom factor|, and whether the camera is at the
   * limit that switches the view in this direction. True when the view is to switch now.
   */
  feed(dir: ZoomDir, ln: number, atLimit: boolean, tMs: number): boolean
  reset(): void
}

export function createZoomSwitch(o = ZOOM_SWITCH): ZoomSwitch {
  let sum = 0
  let dir: ZoomDir | null = null
  let last = -Infinity // time of the input before this one
  let until = -Infinity // end of the cooldown
  let cooling = false // a switch happened and the input has not paused since
  return {
    feed(d, ln, atLimit, t) {
      const gap = t - last
      last = t
      if (cooling) {
        if (t < until || gap < o.QUIET_MS) return false
        cooling = false
      }
      if (!atLimit || !(ln > 0)) {
        sum = 0
        dir = null
        return false
      }
      if (d !== dir || gap > o.WINDOW_MS) sum = 0
      dir = d
      sum += Math.min(ln, o.INPUT_MAX_LN)
      if (sum < o.THRESHOLD_LN) return false
      sum = 0
      dir = null
      cooling = true
      until = t + o.COOLDOWN_MS
      return true
    },
    reset() {
      sum = 0
      dir = null
      cooling = false
      last = until = -Infinity
    },
  }
}
