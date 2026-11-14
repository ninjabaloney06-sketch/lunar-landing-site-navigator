// The 3D scene (C1's scene3d, through its contract only) plus the labels that sit on its objects:
// "Sun 1.2°" at the Sun, "Earth 4.8°" at Earth, "Landing site" at the mast top, and "Moon" at the Moon where it is
// a body in the picture (the Earth and Sun viewpoints; labelPoint('moon') is null elsewhere). A label is hidden
// whenever project() / labelPoint() returns null or a point that is not visible.
//
// Points of interest (U2, U3): the visible ones go to the scene through setPois(). A POI that named() reports
// opens its info box at the pin, instead of the plain name label site pins and user points keep:
// - mouse: the box shows while the pointer is on the pin, and stays while the pointer moves onto the box (a short
//   grace time bridges the gap), so its links can be reached; a click on the pin keeps it open;
// - touch: a tap on the pin opens it and keeps it open (the scene reports the last tapped pin);
// - a kept box closes with its Close button, Esc, a press anywhere else, or a camera move away from it.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { mountScene } from '../scene3d'
import type { SceneDeps, SceneHandle, SceneLevel, SceneMenu, SceneName, ScenePoi, ScenePoint, ScreenPoint, Viewpoint } from '../scene3d'
import { inPinRegion } from '../scene3d/region'
import type { Poi } from '../data/pois'
import { PoiInfo } from './PoiInfo'
import { REGION_TEXT } from './poiLayer'
import { SITE_REGION_TEXT } from './custom'
import { ViewMenu, VIEWPOINTS } from './ViewMenu'
import type { ViewItem } from './ViewMenu'
import { fmtDeg } from './format'

/** What the View button needs from the mounted scene. */
export interface SceneApi {
  goTo(v: Viewpoint): boolean
  setLevel(level: SceneLevel): void
}

/** The six viewpoint entries, shared by the View button and the right-click menu. */
export function viewpointItems(points: ScenePoint[], goTo: (v: Viewpoint) => void): ViewItem[] {
  return VIEWPOINTS.map((v) => ({
    id: v.id,
    label: v.label,
    disabled: (v.id === 'start' || v.id === 'end') && !points.some((p) => p.role === v.id),
    onSelect: () => goTo(v.id),
  }))
}

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
  points: ScenePoint[] // user points, drawn as markers
  api: RefObject<SceneApi | null>
  onTopView(on: boolean): void // the not-to-scale top view is shown
  canAddPoint: boolean // false when the list of user points is full
  onAddPoint(lat: number, lon: number): void // "Add point here" in the right-click menu
  onSetSite(lat: number, lon: number): void // "Set … as landing site" in the right-click menu on a user point
  pois: ScenePoi[] // points of interest to draw ([] = layer off)
  poiById: Map<string, Poi> | null // records for the info box; null until pois.json is loaded
}

const HOVER_GRACE_MS = 350 // pointer from the pin onto its info box
const LABEL_NEAR_PX = { x: 110, y: 52 } // two label points this close would put the label boxes over each other
const CLICK_SLOP_PX = 5 // the scene's own limit between a click and a drag

/** Test hook (?test=1 only, like the scene's window.__scene): the POIs last passed to setPois, and an override of
 *  named() so the info box can be tested before the scene draws POI pins. */
interface ViewsTestHook {
  pois(): ScenePoi[]
  setNamed(n: SceneName | null | undefined): void // undefined = the scene's own named()
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

export function SceneView(props: Props) {
  const { deps, siteId, utcMs, view, sunEl, earthEl, onUnavailable, onPick, onLevel, clickGuard, points, api, onTopView, canAddPoint, onAddPoint, onSetSite, pois, poiById } = props
  const host = useRef<HTMLDivElement>(null)
  const handle = useRef<SceneHandle | null>(null)
  const pick = useRef(onPick)
  pick.current = onPick
  const cb = useRef({ onLevel, clickGuard, onTopView })
  cb.current = { onLevel, clickGuard, onTopView }
  const name = useRef<HTMLDivElement>(null)
  const nameText = useRef<HTMLDivElement>(null)
  // Right-click menu: where it opened, the Moon point under it, and the user point named() reports at that moment
  // (the hovered marker, the last tapped one, or the one selected in the Mission panel: the point whose name label
  // is showing), whose place can become the landing site.
  const [ctx, setCtx] = useState<(SceneMenu & { point: number | null }) | null>(null)
  const pointsNow = useRef(points)
  pointsNow.current = points
  const ctxOpen = useRef(false)
  ctxOpen.current = ctx !== null
  const ctxClosedAt = useRef(0)
  const closeCtx = useCallback(() => {
    ctxClosedAt.current = performance.now()
    setCtx(null)
  }, [])
  // A level the scene reached by itself: the matching `view` change must not send it there a second time.
  const ownLevel = useRef<SceneLevel | null>(null)
  const sun = useRef<HTMLDivElement>(null)
  const earth = useRef<HTMLDivElement>(null)
  const moon = useRef<HTMLDivElement>(null)
  const moonBox = useRef<HTMLDivElement>(null)
  const site = useRef<HTMLDivElement>(null)
  // Site whose frame failed to load: the scene would otherwise keep showing the previous site's terrain and
  // sky under the new site's name, so a notice says the 3D view is stale.
  const [failedFor, setFailedFor] = useState<string | null>(null)
  const have = useRef({ sun: false, earth: false })
  have.current = { sun: sunEl !== null, earth: earthEl !== null }
  // Info box of a point of interest: which one, and whether a click or tap keeps it open.
  const [info, setInfo] = useState<{ id: string; pinned: boolean } | null>(null)
  const infoNow = useRef(info)
  const showInfo = useCallback((v: { id: string; pinned: boolean } | null) => {
    infoNow.current = v
    setInfo(v)
  }, [])
  const byId = useRef(poiById)
  byId.current = poiById
  const box = useRef<HTMLElement>(null)
  const overBox = useRef(false)
  const lostAt = useRef<number | null>(null)
  const anchor = useRef<{ x: number; y: number } | null>(null)
  const namedOverride = useRef<SceneName | null | undefined>(undefined)
  const lastPois = useRef<ScenePoi[]>([])

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
    // A press that closes the right-click menu is not also a click on the scene.
    h.setClickGuard(() => !ctxOpen.current && performance.now() - ctxClosedAt.current > 400 && cb.current.clickGuard())
    const offTop = h.onTopView((on) => cb.current.onTopView(on))
    api.current = { goTo: (v) => h.goTo(v), setLevel: (l) => h.setLevel(l) }
    const namedNow = () => (namedOverride.current !== undefined ? namedOverride.current : h.named())
    const offMenu = h.onMenu((m) => {
      const n = namedNow()
      const i = n && !n.poiId ? pointsNow.current.findIndex((q) => q.name === n.name) : -1
      setCtx({ ...m, point: i >= 0 ? i : null })
    })
    const poiOf = (n: SceneName | null) => (n && n.poiId && byId.current?.has(n.poiId) ? n.poiId : null)
    const testHook = new URLSearchParams(window.location.search).has('test')
    if (testHook) {
      const hook: ViewsTestHook = { pois: () => lastPois.current, setNamed: (n) => (namedOverride.current = n) }
      ;(window as unknown as { __views?: ViewsTestHook }).__views = hook
    }

    // The box sits above the pin (below it when there is no room), inside the stage.
    const placeBox = () => {
      const el = box.current
      const a = anchor.current
      const stage = host.current
      if (!el || !a || !stage) return
      const w = el.offsetWidth
      const ht = el.offsetHeight
      const W = stage.clientWidth
      const H = stage.clientHeight
      const gap = 14
      const x = Math.max(8, Math.min(a.x - w / 2, W - w - 8))
      let y = a.y - ht - gap
      if (y < 8) y = a.y + gap
      y = Math.max(8, Math.min(y, H - ht - 8))
      const t = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`
      if (el.style.transform !== t) el.style.transform = t
    }

    let raf = 0
    const tick = () => {
      place(sun.current, h.labelPoint('sun'), have.current.sun)
      const ep = h.labelPoint('earth')
      place(earth.current, ep, have.current.earth)
      const mp = h.labelPoint('moon')
      place(moon.current, mp, true)
      // From the Sun's side the Moon and Earth are a fraction of a degree apart: the Moon's label then hangs below
      // its point, so the two labels never cover each other.
      const near = !!(mp?.visible && ep?.visible && have.current.earth && Math.abs(ep.x - mp.x) < LABEL_NEAR_PX.x && Math.abs(ep.y - mp.y) < LABEL_NEAR_PX.y)
      moonBox.current?.classList.toggle('is-below', near)
      place(site.current, h.project('site'), true)
      const n = namedNow()
      const id = n && n.visible ? poiOf(n) : null
      const cur = infoNow.current
      if (id) {
        lostAt.current = null
        if (!cur || (!cur.pinned && cur.id !== id)) showInfo({ id, pinned: false })
        if (!cur || !cur.pinned || cur.id === id) anchor.current = { x: n!.x, y: n!.y }
      } else if (cur && !cur.pinned && !overBox.current) {
        const t = performance.now()
        if (lostAt.current === null) lostAt.current = t
        else if (t - lostAt.current > HOVER_GRACE_MS) {
          lostAt.current = null
          showInfo(null)
        }
      }
      placeBox()
      // The plain name: site pins and user points, and a POI only while another POI's box is kept open.
      const plain = n && !(n.poiId && infoNow.current?.id === n.poiId) ? n : null
      if (plain && nameText.current && nameText.current.textContent !== plain.name) nameText.current.textContent = plain.name
      place(name.current, plain, true)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    // A click or tap on a POI pin keeps its box open; any other press closes a kept box.
    const stage = host.current!
    let down: { x: number; y: number } | null = null
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY }
    }
    const onUp = (e: PointerEvent) => {
      const d = down
      down = null
      if (!d) return
      const click = Math.hypot(e.clientX - d.x, e.clientY - d.y) <= CLICK_SLOP_PX
      const n = click ? namedNow() : null
      const id = poiOf(n)
      if (n && id) {
        anchor.current = { x: n.x, y: n.y }
        showInfo({ id, pinned: true })
      } else if (infoNow.current?.pinned) showInfo(null)
    }
    const onOutside = (e: PointerEvent) => {
      const t = e.target as Node
      if (infoNow.current?.pinned && !box.current?.contains(t) && !stage.contains(t)) showInfo(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !infoNow.current?.pinned) return
      e.preventDefault()
      e.stopPropagation() // capture phase: the app's Esc (globe view, close drawer) does not also run
      showInfo(null)
    }
    stage.addEventListener('pointerdown', onDown)
    stage.addEventListener('pointerup', onUp)
    document.addEventListener('pointerdown', onOutside, true)
    window.addEventListener('keydown', onKey, true)
    const offCam = h.onCameraChange(() => {
      const cur = infoNow.current
      if (cur?.pinned && poiOf(namedNow()) !== cur.id) showInfo(null)
    })
    return () => {
      stage.removeEventListener('pointerdown', onDown)
      stage.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointerdown', onOutside, true)
      window.removeEventListener('keydown', onKey, true)
      offCam()
      if (testHook) delete (window as unknown as { __views?: ViewsTestHook }).__views
      cancelAnimationFrame(raf)
      offPick()
      offLevel()
      offTop()
      offMenu()
      api.current = null
      cb.current.onTopView(false)
      handle.current = null
      h.dispose()
    }
  }, [deps, onUnavailable, api])

  useEffect(() => {
    handle.current?.setMarkers(points)
  }, [points, deps])

  useEffect(() => {
    lastPois.current = pois
    handle.current?.setPois(pois)
  }, [pois, deps])

  // A box whose POI is no longer drawn (group switched off, layer off) closes.
  useEffect(() => {
    if (info && !pois.some((p) => p.id === info.id)) showInfo(null)
  }, [pois, info, showInfo])

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

  const ctxPoint = ctx && ctx.point !== null ? (points[ctx.point] ?? null) : null

  return (
    <>
      <div ref={host} className="scene" data-testid="scene" />
      {failedFor === siteId && (
        <p className="msg scene-msg" role="status" data-testid="scene-stale">
          The 3D view could not load this site and may still show the previous one. The numbers and timeline are
          not affected.
        </p>
      )}
      {info && poiById?.get(info.id) && (
        <PoiInfo
          poi={poiById.get(info.id)!}
          pinned={info.pinned}
          boxRef={box}
          onClose={() => showInfo(null)}
          onPointerEnter={() => {
            overBox.current = true
          }}
          onPointerLeave={() => {
            overBox.current = false
            lostAt.current = performance.now()
          }}
        />
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
        <div ref={moon} className="obj" hidden>
          <div ref={moonBox} className="obj-box" data-testid="label-moon">
            <span className="obj-name">Moon</span>
            <span className="obj-tick" />
          </div>
        </div>
        <div ref={site} className="obj" hidden>
          <div className="obj-site" data-testid="label-site">
            Landing site
          </div>
        </div>
        <div ref={name} className="obj" hidden>
          <div ref={nameText} className="obj-pin-name" data-testid="pin-name" />
        </div>
      </div>
      {ctx && (
        <ViewMenu
          label="View"
          testId="scene-menu"
          at={ctx}
          note={
            [
              ctx.hit && !inPinRegion(ctx.hit.lat) ? `Points can be added only ${REGION_TEXT}.` : null,
              ctxPoint && !inPinRegion(ctxPoint.lat) ? SITE_REGION_TEXT : null,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          items={[
            {
              // Disabled when the pointer is not on the Moon (sky, or another body in view) or outside the pin region.
              id: 'add',
              label: 'Add point here',
              disabled: !ctx.hit || !canAddPoint || !inPinRegion(ctx.hit.lat),
              title: ctx.hit && !inPinRegion(ctx.hit.lat) ? `Points can be added only ${REGION_TEXT}.` : undefined,
              onSelect: () => ctx.hit && onAddPoint(ctx.hit.lat, ctx.hit.lon),
            },
            // Only on a user point inside the pin region; outside it the note says why.
            ...(ctxPoint && inPinRegion(ctxPoint.lat)
              ? [{ id: 'set-site', label: `Set ${ctxPoint.name} as landing site`, onSelect: () => onSetSite(ctxPoint.lat, ctxPoint.lon) }]
              : []),
            ...viewpointItems(points, (v) => handle.current?.goTo(v)),
          ]}
          onClose={closeCtx}
        />
      )}
    </>
  )
}
