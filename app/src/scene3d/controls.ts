// Free camera input on top of the two OrbitControls (Brief C4 part 1): middle-drag looks around from where
// the camera is, the wheel and a two-finger pinch dolly along the viewing direction, and at eye level they
// change the field of view instead (the bodies keep their computed angular size; only the lens changes).
// OrbitControls keeps the left drag and one-finger drag; its own middle, right, wheel and pinch are switched
// off in index.ts, so one gesture has one handler.
//
// No trig here: rotations are axis-angle quaternions, limits are compared as dot products.

import { MathUtils, Quaternion, Vector3, type PerspectiveCamera } from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/** What the wheel and the pinch act on at the moment. */
export interface Rig {
  cam: PerspectiveCamera
  ctl: OrbitControls
  /** 'dolly' moves the camera; 'zoom' changes the field of view (eye level). */
  mode: 'dolly' | 'zoom'
  /** Distance from p to the nearest surface, in the scene's unit. */
  surface(p: Vector3): number
  /** False where the camera may not be: under the floor or inside a body. */
  allowed(p: Vector3): boolean
  /**
   * Outer limit: how far out p is, 1 = on the limit (around the site at site level; around the nearest of the
   * Moon, Earth and the Sun in space). The wheel never moves the camera from inside a limit to outside it,
   * and a camera that is outside (a flight put it there) only moves inward.
   */
  reach(p: Vector3): number
  /** Called before the camera is moved off its orbit, so index.ts relaxes the orbit limits first. */
  free(what: 'look' | 'dolly'): void
  /** Surface point under the screen centre, if any: the orbit pivot after a look-around. */
  pivot(): Vector3 | null
  /** Widest and narrowest field of view for 'zoom', vertical, degrees. */
  fovMax: number
  fovMin: number
  fovChanged(): void
}

export interface FreeCamHost {
  canvas: HTMLCanvasElement
  testMode: boolean
  /** null while a fly runs or a fixed view is shown: input is ignored. */
  rig(): Rig | null
  heightPx(): number
  changed(): void
}

const STEP = 0.128 // ln of the zoom factor per wheel notch: one notch covers 12 % of the distance to the surface
/**
 * Time constant (ms) of every eased input: the wheel, the pinch, the middle-drag and (through index.ts) the
 * orbit drag all apply the share 1 − e^(−dt/RESPONSE_MS) of what is still pending in a frame of dt ms. At 60
 * frames per second that is the 0.1 per frame the orbit drag already had; the same on a 120 Hz or a slow screen.
 */
export const RESPONSE_MS = 160
export const easeShare = (dtMs: number) => (dtMs > 0 ? 1 - Math.exp(-dtMs / RESPONSE_MS) : 0)
const PINCH_LN_PER_PX = 0.01 // a trackpad pinch (wheel with ctrlKey): the browsers' own convention, factor e^(−deltaY/100)
const ZOOM_REST = 1e-4 // ln of the zoom factor below which the rest lands at once (0.01 % of the distance)
const LOOK_REST = 0.05 // same for the look-around, px
const POLE_LIMIT = 0.9998 // |cos| of the angle between the view and the up axis: 1.1° from straight up or down
const MIN_AHEAD = 1e-3 // the orbit target stays at least this far in front of the camera

export interface FreeCam {
  /** Applies the eased share of the pending input for a frame of dtMs; call once per frame. True when the camera changed. */
  step(dtMs: number): boolean
  /** Easing on or off. Off (test mode): every input lands whole in the frame of its event. */
  setSmooth(on: boolean): void
  /** Test and API entry: factor > 1 = closer or narrower. */
  zoomBy(factor: number): void
  lookBy(dxPx: number, dyPx: number): void
  dispose(): void
}

export function installFreeCam(host: FreeCamHost): FreeCam {
  const { canvas } = host
  let smooth = !host.testMode
  let pending = 0 // ln of the zoom factor still to apply
  const turn = { x: 0, y: 0 } // look-around still to apply, px
  let repivot = false // a look-around ended: set the orbit pivot once the view has come to rest
  let look: { id: number; x: number; y: number } | null = null
  const touches = new Map<number, { x: number; y: number }>()
  let pinch = 0 // finger distance at the last pinch event, px

  function lookBy(dx: number, dy: number) {
    const r = host.rig()
    if (!r) return
    const { cam, ctl } = r
    r.free('look')
    cam.updateMatrixWorld(true)
    const keep = cam.position.clone()
    const off = ctl.target.clone().sub(cam.position)
    // Dragging by the screen height turns the view by one field of view: the picture follows the pointer.
    const perPx = MathUtils.degToRad(cam.fov) / host.heightPx()
    const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0)
    // The turn about the up axis is divided by the view's horizontal share, so a view that looks steeply up
    // or down still moves by the dragged distance at the screen centre.
    const steep = off.clone().normalize().dot(cam.up)
    const yaw = new Quaternion().setFromAxisAngle(cam.up, (dx * perPx) / Math.max(Math.sqrt(1 - steep * steep), 0.2))
    const pitch = new Quaternion().setFromAxisAngle(right, dy * perPx)
    const both = off.clone().applyQuaternion(pitch).applyQuaternion(yaw)
    const tooSteep = Math.abs(both.clone().normalize().dot(cam.up)) > POLE_LIMIT
    ctl.target.copy(cam.position).add(tooSteep ? off.applyQuaternion(yaw) : both)
    ctl.update()
    cam.position.copy(keep) // the camera turns, it does not move: undo the controls' rounding
    cam.updateMatrixWorld(true)
    host.changed()
  }

  function dolly(r: Rig, factor: number) {
    const { cam, ctl } = r
    const p0 = cam.position.clone()
    const f = cam.getWorldDirection(new Vector3())
    // Straight toward the surface this divides the remaining distance by `factor`, so it never arrives.
    let s = r.surface(p0) * (1 - 1 / factor)
    const at = (t: number) => p0.clone().addScaledVector(f, s * t)
    const out0 = r.reach(p0)
    const ok = (p: Vector3) => r.allowed(p) && (r.reach(p) <= 1 || r.reach(p) <= out0)
    if (!ok(at(1))) {
      // Stop on the limit: largest part of the step that stays allowed.
      let lo = 0
      let hi = 1
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2
        if (ok(at(mid))) lo = mid
        else hi = mid
      }
      s *= lo
    }
    if (s === 0) return false
    r.free('dolly')
    const ahead = Math.max(ctl.target.distanceTo(p0) - s, MIN_AHEAD)
    cam.position.copy(p0).addScaledVector(f, s)
    ctl.target.copy(cam.position).addScaledVector(f, ahead)
    ctl.update()
    cam.position.copy(p0).addScaledVector(f, s)
    cam.updateMatrixWorld(true)
    return true
  }

  function zoom(r: Rig, factor: number) {
    const fov = MathUtils.clamp(r.cam.fov / factor, r.fovMin, r.fovMax)
    if (fov === r.cam.fov) return false
    r.cam.fov = fov
    r.cam.updateProjectionMatrix()
    r.fovChanged()
    return true
  }

  function zoomBy(factor: number) {
    const r = host.rig()
    if (!r || !(factor > 0) || factor === 1) return
    if (r.mode === 'zoom' ? zoom(r, factor) : dolly(r, factor)) host.changed()
  }

  /** Wheel, pinch: eased when smooth, whole in the frame of the event otherwise. */
  function queueZoom(lnFactor: number) {
    pending += lnFactor
    if (smooth) return host.changed()
    const all = pending
    pending = 0
    zoomBy(Math.exp(all))
  }

  /** Orbit around what is now in the middle of the view, when that is a surface. */
  function setPivot() {
    const r = host.rig()
    const p = r?.pivot()
    if (!r || !p) return
    const keep = r.cam.position.clone()
    r.ctl.target.copy(p)
    r.ctl.update()
    r.cam.position.copy(keep)
    host.changed()
  }

  function step(dtMs: number) {
    const share = easeShare(dtMs)
    let moved = false
    if (pending !== 0 && share > 0) {
      const r = host.rig()
      const take = Math.abs(pending) < ZOOM_REST ? pending : pending * share
      pending -= take
      // At a limit (or with no camera to move) the rest is dropped, so the opposite direction answers at once.
      if (r && (r.mode === 'zoom' ? zoom(r, Math.exp(take)) : dolly(r, Math.exp(take)))) moved = true
      else pending = 0
    }
    if ((turn.x !== 0 || turn.y !== 0) && share > 0) {
      const rest = Math.hypot(turn.x, turn.y) < LOOK_REST
      const dx = rest ? turn.x : turn.x * share
      const dy = rest ? turn.y : turn.y * share
      turn.x -= dx
      turn.y -= dy
      if (host.rig()) {
        lookBy(dx, dy)
        moved = true
      } else turn.x = turn.y = 0
    }
    if (repivot && !look && turn.x === 0 && turn.y === 0) {
      repivot = false
      setPivot()
    }
    return moved
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    if (!host.rig()) return
    // A pinch on a trackpad arrives as a wheel event with ctrlKey and a small delta: fingers apart = closer.
    if (e.ctrlKey && e.deltaMode === 0) return queueZoom(MathUtils.clamp(-e.deltaY * PINCH_LN_PER_PX, -0.5, 0.5))
    const notches = MathUtils.clamp(e.deltaMode === 1 ? e.deltaY / 3 : e.deltaY / 100, -4, 4)
    queueZoom(-notches * STEP) // wheel up = closer
  }

  const fingerGap = () => {
    const [a, b] = [...touches.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
      pinch = touches.size === 2 ? fingerGap() : 0
      return
    }
    if (e.button !== 1) return
    e.preventDefault() // no autoscroll cursor
    if (!host.rig()) return
    look = { id: e.pointerId, x: e.clientX, y: e.clientY }
    canvas.setPointerCapture(e.pointerId)
  }

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      if (!touches.has(e.pointerId)) return
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.size !== 2 || pinch <= 0) return
      const gap = fingerGap()
      if (gap > 0) queueZoom(Math.log(gap / pinch)) // fingers apart = closer
      pinch = gap
      return
    }
    if (!look || e.pointerId !== look.id) return
    if (smooth) {
      // The view follows the pointer with the same easing as the orbit drag and comes to rest after the release.
      turn.x += e.clientX - look.x
      turn.y += e.clientY - look.y
      host.changed()
    } else lookBy(e.clientX - look.x, e.clientY - look.y)
    look.x = e.clientX
    look.y = e.clientY
  }

  const onUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      touches.delete(e.pointerId)
      pinch = 0
      return
    }
    if (!look || e.pointerId !== look.id) return
    look = null
    if (smooth) {
      repivot = true
      host.changed()
    } else setPivot()
  }

  const stop = (e: Event) => e.preventDefault()
  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 1) e.preventDefault()
  }

  // Only on the canvas, never on the page (Brief C4).
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('auxclick', stop)
  canvas.addEventListener('contextmenu', stop)

  return {
    step,
    setSmooth(on) {
      smooth = on
      pending = turn.x = turn.y = 0
    },
    zoomBy,
    lookBy,
    dispose() {
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('auxclick', stop)
      canvas.removeEventListener('contextmenu', stop)
    },
  }
}
