// The 3D scene (C1's scene3d, through its contract only) plus the labels that sit on its objects:
// "Sun 1.2°" at the Sun, "Earth 4.8°" at Earth, "Landing site" at the mast top. A label is hidden whenever
// project() returns null or a point that is not visible.
import { useEffect, useRef, useState } from 'react'
import { mountScene } from '../scene3d'
import type { SceneDeps, SceneHandle, SceneLevel, ScreenPoint } from '../scene3d'
import { fmtDeg } from './format'

interface Props {
  deps: SceneDeps
  siteId: string
  utcMs: number
  view: SceneLevel
  sunEl: number | null // null while results load: the label hides rather than show a stale number
  earthEl: number | null
  onUnavailable(): void
  onPick(lat: number, lon: number): void // a click on the globe (scene contract: a pin reports its site's coordinates)
  onLevel(level: SceneLevel): void // the scene changed level itself (a walk ends at eye level)
  clickGuard(): boolean // false while a click on the scene only closes a menu
}

function place(el: HTMLElement | null, p: ScreenPoint | null, ok: boolean) {
  if (!el) return
  if (!ok || !p || !p.visible) {
    el.hidden = true
    return
  }
  el.hidden = false
  el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`
}

export function SceneView({ deps, siteId, utcMs, view, sunEl, earthEl, onUnavailable, onPick, onLevel, clickGuard }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const handle = useRef<SceneHandle | null>(null)
  const pick = useRef(onPick)
  pick.current = onPick
  const cb = useRef({ onLevel, clickGuard })
  cb.current = { onLevel, clickGuard }
  // A level the scene reached by itself: the matching `view` change must not send it there a second time.
  const ownLevel = useRef<SceneLevel | null>(null)
  const sun = useRef<HTMLDivElement>(null)
  const earth = useRef<HTMLDivElement>(null)
  const site = useRef<HTMLDivElement>(null)
  // Site whose frame failed to load: the scene would otherwise keep showing the previous site's terrain and
  // sky under the new site's name, so a notice says the 3D view is stale.
  const [failedFor, setFailedFor] = useState<string | null>(null)
  const have = useRef({ sun: false, earth: false })
  have.current = { sun: sunEl !== null, earth: earthEl !== null }

  useEffect(() => {
    let h: SceneHandle
    try {
      h = mountScene(host.current!, deps)
    } catch {
      onUnavailable()
      return
    }
    handle.current = h
    const offPick = h.onPick((lat, lon) => pick.current(lat, lon))
    const offLevel = h.onLevel((l) => {
      ownLevel.current = l
      cb.current.onLevel(l)
    })
    h.setClickGuard(() => cb.current.clickGuard())
    let raf = 0
    const tick = () => {
      place(sun.current, h.project('sun'), have.current.sun)
      place(earth.current, h.project('earth'), have.current.earth)
      place(site.current, h.project('site'), true)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      offPick()
      offLevel()
      handle.current = null
      h.dispose()
    }
  }, [deps, onUnavailable])

  useEffect(() => {
    const own = ownLevel.current
    ownLevel.current = null
    if (own !== view) handle.current?.setLevel(view)
  }, [view])

  useEffect(() => {
    let alive = true
    deps
      .loadFrame(siteId, utcMs)
      .then((f) => {
        if (!alive) return
        handle.current?.update(f)
        setFailedFor(null)
      })
      .catch(() => {
        // The results panel reports data errors; the scene keeps its last frame, so mark it as not this site.
        if (alive) setFailedFor(siteId)
      })
    return () => {
      alive = false
    }
  }, [deps, siteId, utcMs])

  return (
    <>
      <div ref={host} className="scene" data-testid="scene" />
      {failedFor === siteId && (
        <p className="msg scene-msg" role="status" data-testid="scene-stale">
          The 3D view could not load this site and may still show the previous one. The numbers and timeline are
          not affected.
        </p>
      )}
      <div className="labels">
        {/* .obj is a zero-size anchor at the projected point; the boxes inside carry the text. */}
        <div ref={sun} className="obj" hidden>
          <div className="obj-box" data-testid="label-sun">
            <span className="obj-name obj-sun">Sun</span> <span className="obj-num">{sunEl === null ? '' : fmtDeg(sunEl)}</span>
            <span className="obj-tick" />
          </div>
        </div>
        <div ref={earth} className="obj" hidden>
          <div className="obj-box" data-testid="label-earth">
            <span className="obj-name obj-earth">Earth</span> <span className="obj-num">{earthEl === null ? '' : fmtDeg(earthEl)}</span>
            <span className="obj-tick" />
          </div>
        </div>
        <div ref={site} className="obj" hidden>
          <div className="obj-site" data-testid="label-site">
            Landing site
          </div>
        </div>
      </div>
    </>
  )
}
