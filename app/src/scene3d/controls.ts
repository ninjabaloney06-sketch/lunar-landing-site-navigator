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
  /** Outer limit: the wheel never moves the camera farther than this from the scene origin. */
  far: number
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
const SMOOTH = 0.3 // share of the pending wheel input applied per frame
const POLE_LIMIT = 0.9998 // |cos| of the angle between the view and the up axis: 1.1° from straight up or down
const MIN_AHEAD = 1e-3 // the orbit target stays at least this far in front of the camera

export interface FreeCam {
  /** Applies pending wheel input; call once per frame. True when the camera changed. */
  step(): boolean
  /** Test and API entry: factor > 1 = closer or narrower. */
  zoomBy(factor: number): void
  lookBy(dxPx: number, dyPx: number): void
  dispose(): void
}

export function installFreeCam(host: FreeCamHost): FreeCam {
  const { canvas } = host
  let pending = 0 // ln of the zoom factor still to apply
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
    const ok = (p: Vector3) => r.allowed(p) && (p.length() <= r.far || p.length() <= p0.length())
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

  function step() {
    if (pending === 0) return false
    const take = Math.abs(pending) < 0.01 ? pending : pending * SMOOTH
    pending -= take
    const r = host.rig()
    if (!r) {
      pending = 0
      return false
    }
    return r.mode === 'zoom' ? zoom(r, Math.exp(take)) : dolly(r, Math.exp(take))
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    if (!host.rig()) return
    const notches = MathUtils.clamp(e.deltaMode === 1 ? e.deltaY / 3 : e.deltaY / 100, -4, 4)
    pending -= notches * STEP // wheel up = closer
    // Test mode has no easing: the whole step lands in the frame of the event.
    if (host.testMode) {
      const all = pending
      pending = 0
      zoomBy(Math.exp(all))
    } else host.changed()
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
      if (gap > 0) zoomBy(gap / pinch) // fingers apart = closer
      pinch = gap
      return
    }
    if (!look || e.pointerId !== look.id) return
    lookBy(e.clientX - look.x, e.clientY - look.y)
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
    // Orbit around what is now in the middle of the view, when that is a surface.
    const r = host.rig()
    const p = r?.pivot()
    if (r && p) {
      const keep = r.cam.position.clone()
      r.ctl.target.copy(p)
      r.ctl.update()
      r.cam.position.copy(keep)
      host.changed()
    }
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
