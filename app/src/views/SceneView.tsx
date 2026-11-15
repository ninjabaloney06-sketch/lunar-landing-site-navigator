// The 3D scene (C1's scene3d, through its contract only) plus the labels that sit on its objects:
// "Sun 1.2°" at the Sun, "Earth 4.8°" at Earth and "Landing site" at the mast top. A label is hidden
// whenever project() / labelPoint() returns null or a point that is not visible. On the flight level the labels are
// Earth, Moon, the launchpad, the landing point, the capsule, the lander, and one at each engine burn (its name, the
// stage that fires, or both: the layer checkboxes choose). Burn labels that would lie over another label are not
// drawn: the most important one at a spot is shown with the number of those it stands for.
//
// Points of interest (U2, U3): the visible ones go to the scene through setPois(). A POI that named() reports
// opens its info box at the pin, instead of the plain name label site pins and user points keep:
// - mouse: the box shows while the pointer is on the pin, and stays while the pointer moves onto the box (a short
//   grace time bridges the gap), so its links can be reached; a click on the pin keeps it open;
// - touch: a tap on the pin opens it and keeps it open (the scene reports the last tapped pin);
// - a kept box closes with its Close button, Esc, a press anywhere else, or a camera move away from it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { craftAt } from '../flight/craft'
import type { MissionPlan } from '../flight/types'
import { flightBurns, landerPresence, mountScene } from '../scene3d'
import type {
  BodyPick,
  FlightAnchor,
  FlightFocus,
  FlightLayers,
  SceneDeps,
  SceneHandle,
  SceneLevel,
  SceneMenu,
  SceneName,
  ScenePoi,
  ScenePoint,
  ScreenPoint,
  Viewpoint,
} from '../scene3d'
import { inPinRegion } from '../scene3d/region'
import type { Poi } from '../data/pois'
import { parseCustomSiteId } from '../data/customSite'
import { PoiInfo } from './PoiInfo'
import { REGION_TEXT } from './poiLayer'
import { SITE_REGION_TEXT } from './custom'
import { ViewMenu, VIEWPOINTS } from './ViewMenu'
import type { ViewItem } from './ViewMenu'
import { burnName, shortStage } from './flightFormat'
import { fmtDeg } from './format'

/** What the flight level draws. `clock` is read on every animation frame, so playback never re-renders React. */
export interface FlightScene {
  plan: MissionPlan | null
  trueScale: boolean
  clock: { timeMs: number }
  focus: FlightFocus // what the camera turns about and follows
  viewKey: number // changes when the default flight view is asked for again
  picking: boolean // the next click on Earth or the Moon chooses a launchpad or a landing point
  layers: FlightLayers // path lines, burns, burn and stage names, trail mode
}

/** What the View button needs from the mounted scene. */
export interface SceneApi {
  goTo(v: Viewpoint): boolean
  /** The Moon view, turned to a point (planetocentric degrees): "Show on the Moon" for a point of interest. */
  goToPoint(lat: number, lon: number): boolean
  setLevel(level: SceneLevel): void
}

/** The viewpoint entries (U14: only "Moon"), shared by the View button and the right-click menu. */
export function viewpointItems(goTo: (v: Viewpoint) => void): ViewItem[] {
  return VIEWPOINTS.map((v) => ({ id: v.id, label: v.label, onSelect: () => goTo(v.id) }))
}

interface Props {
  deps: SceneDeps
  siteId: string
  utcMs: number
  view: SceneLevel
  sunEl: number | null // null while results load: the label hides rather than show a stale number
  earthEl: number | null
  flight: FlightScene
  onUnavailable(): void
  onPick(lat: number, lon: number): void // a click on the globe (scene contract: a pin reports its site's coordinates)
  onFlightPick(pick: BodyPick): void // a click on Earth or the Moon in the flight view
  onLevel(level: SceneLevel): void // the scene changed level itself (a walk ends at eye level)
  clickGuard(): boolean // false while a click on the scene only closes a menu
  points: ScenePoint[] // user points, drawn as markers
  api: RefObject<SceneApi | null>
  canAddPoint: boolean // false when the list of user points is full
  onAddPoint(lat: number, lon: number): void // "Add point here" in the right-click menu
  onSetSite(lat: number, lon: number): void // "Set … as landing site" in the right-click menu on a user point
  pois: ScenePoi[] // points of interest to draw ([] = layer off)
  poiById: Map<string, Poi> | null // records for the info box; null until pois.json is loaded
  /** The landing site's own answer at this time: the Sun, or Earth, is behind the site's terrain horizon. The camera at
   *  site level is high above the site and still sees the body, so the label says it (15 Nov: "Sun drawn above the
   *  terrain while the answer says dark"). */
  sunHidden?: boolean
  earthHidden?: boolean
  /** The text at the mast top: "Landing site", or the mission's own name with it once the user named the mission. */
  siteLabel?: string
  onGoToPoi?(poi: Poi): void // the info box's "Show as landing site" (App.tsx showPoi, as the search's "Show")
}

const HOVER_GRACE_MS = 350 // pointer from the pin onto its info box
const CLICK_SLOP_PX = 5 // the scene's own limit between a click and a drag

/** Test hook (?test=1 only, like the scene's window.__scene): the POIs last passed to setPois, and an override of
 *  named() so the info box can be tested before the scene draws POI pins. */
interface ViewsTestHook {
  pois(): ScenePoi[]
  setNamed(n: SceneName | null | undefined): void // undefined = the scene's own named()
}

function place(el: HTMLElement | null, p: ScreenPoint | null, ok: boolean): boolean {
  if (!el) return false
  if (!ok || !p || !p.visible) {
    el.hidden = true
    return false
  }
  el.hidden = false
  el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`
  return true
}

// ---------- flight labels: where each one lies on screen, and which burn labels have room ----------

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

// Label metrics, px. They mirror flight.css: mono text at --t-small advances 7.2 px per character on a 16 px line;
// body names are the UI size, about 8 px per character.
const MONO_PX = 7.2
const NAME_PX = 8
const LINE_PX = 16
const TAG_GAP = 8 // .obj-tag: left of the text
const CRAFT_GAP = 12 // .obj-craft: beside the marker
const CRAFT_UP = 6 // .obj-craft: above or below it
const MARK_PX = 7 // half the size of a craft's marker, which no label may cover
const BURN_GAP = 13 // .obj-burn: beside the ring
const PAD_PX = 4 // air kept around a label
const SAME_SPOT_PX = 24 // burn markers closer than this on screen share one label

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0
const grown = (b: Box): Box => ({ x0: b.x0 - PAD_PX, y0: b.y0 - PAD_PX, x1: b.x1 + PAD_PX, y1: b.y1 + PAD_PX })

/**
 * Boxes (in the stage's coordinates) of the page's own text and controls that lie over the scene: the header's
 * parts (not its empty middle), the timeline footer, the POI key, the Mission panel and the flight panels. A label or
 * an info box placed there could not be read, or would hide them.
 */
const OVERLAY_SELECTORS = ['.top > :not(.actions-col)', '.top .actions-col > *', '.bottom > *', '.foot', '.poi-key', '.mission-panel', '.flight-panel', '.flight-transport']
function overlayBoxes(stage: HTMLElement): (Box & { w: number })[] {
  const o = stage.getBoundingClientRect()
  const out: (Box & { w: number })[] = []
  for (const el of document.querySelectorAll(OVERLAY_SELECTORS.join(','))) {
    const r = el.getBoundingClientRect()
    // The header's controls weigh three times the rest (phone audit, 15 Nov: with no free side, the card lay over
    // Landing site and Dates; covering the timeline for a moment is the lesser harm).
    const w = el.closest('.top') ? 3 : 1
    if (r.width > 0 && r.height > 0) out.push({ x0: r.left - o.left, y0: r.top - o.top, x1: r.right - o.left, y1: r.bottom - o.top, w })
  }
  return out
}

/** Writes text into an element only when it changed: this runs on every animation frame. */
function setText(el: HTMLElement | null, text: string) {
  if (el && el.textContent !== text) el.textContent = text
}

interface BurnLabel {
  name: string
  by: string
  dvKms: number
  startMs: number
  endMs: number
}

interface CraftEls {
  box: HTMLDivElement | null
  name: HTMLSpanElement | null
  sub: HTMLSpanElement | null
}

const BODY_LABELS: FlightAnchor[] = ['earth', 'moon', 'arrival']
const BODY_TEXT: Record<string, string> = { earth: 'Earth', moon: 'Moon', arrival: 'Moon at arrival' }

export function SceneView(props: Props) {
  const { deps, siteId, utcMs, view, sunEl, earthEl, flight, onUnavailable, onPick, onFlightPick } = props
  const { onLevel, clickGuard, points, api, canAddPoint, onAddPoint, onSetSite, pois, poiById, onGoToPoi } = props
  const host = useRef<HTMLDivElement>(null)
  const handle = useRef<SceneHandle | null>(null)
  const pick = useRef(onPick)
  pick.current = onPick
  const flightPick = useRef(onFlightPick)
  flightPick.current = onFlightPick
  const cb = useRef({ onLevel, clickGuard })
  cb.current = { onLevel, clickGuard }
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
  const site = useRef<HTMLDivElement>(null)
  const flightEls = useRef<Partial<Record<FlightAnchor, HTMLDivElement | null>>>({})
  const capsuleEls = useRef<CraftEls>({ box: null, name: null, sub: null })
  const landerEls = useRef<CraftEls>({ box: null, name: null, sub: null })
  const burnEls = useRef<(HTMLDivElement | null)[]>([])
  const flightRef = useRef(flight)
  flightRef.current = flight
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
  // A box closed on purpose (Close, Esc) stays closed while the same pin is still the one under the pointer. On a
  // touch screen that is the last tapped pin, which the scene keeps reporting: without this the next frame would
  // open the box again, unpinned, and Close would never stick.
  const dismissed = useRef<string | null>(null)
  const dismissInfo = useCallback(() => {
    dismissed.current = infoNow.current?.id ?? null
    showInfo(null)
  }, [showInfo])
  const byId = useRef(poiById)
  byId.current = poiById
  const box = useRef<HTMLElement>(null)
  const overBox = useRef(false)
  const lostAt = useRef<number | null>(null)
  const anchor = useRef<{ x: number; y: number } | null>(null)
  const namedOverride = useRef<SceneName | null | undefined>(undefined)
  const lastPois = useRef<ScenePoi[]>([])

  const plan = flight.plan
  const burns: BurnLabel[] = useMemo(
    () =>
      plan
        ? flightBurns(plan).map((e) => ({
            name: burnName(e),
            by: e.by ? shortStage(e.by) : '',
            dvKms: e.dvKms ?? 0,
            startMs: e.utcMs,
            endMs: e.utcMs + (e.durationS ?? 0) * 1000,
          }))
        : [],
    [plan],
  )
  const burnsRef = useRef(burns)
  burnsRef.current = burns

  useEffect(() => {
    let h: SceneHandle
    try {
      h = mountScene(host.current!, deps)
    } catch {
      onUnavailable()
      return
    }
    handle.current = h
    h.setFlight(flightRef.current.plan, flightRef.current.trueScale)
    h.setFlightLayers(flightRef.current.layers)
    h.setFlightFocus(flightRef.current.focus)
    const offPick = h.onPick((lat, lon) => pick.current(lat, lon))
    const offFlightPick = h.onFlightPick((p) => flightPick.current(p))

    /** Places the flight labels for this frame. Fixed labels first; then the burn labels, the burn in progress
     *  and the large burns before the small ones, each only where it covers no label placed before it. */
    const layoutFlight = () => {
      const f = flightRef.current
      const taken: Box[] = []
      if (!f.plan) return

      // The panel and the playback bar lie over the scene: a label under them could not be read, so they count
      // as taken. Their boxes are in page coordinates, the labels' in the scene's.
      const origin = host.current!.getBoundingClientRect()
      for (const selector of ['.flight-panel', '.flight-transport']) {
        const r = document.querySelector(selector)?.getBoundingClientRect()
        if (r) taken.push({ x0: r.left - origin.left, y0: r.top - origin.top, x1: r.right - origin.left, y1: r.bottom - origin.top })
      }

      for (const name of BODY_LABELS) {
        const p = h.projectFlight(name)
        if (place(flightEls.current[name] ?? null, p, true) && p) {
          const half = (BODY_TEXT[name].length * NAME_PX) / 2
          taken.push({ x0: p.x - half, y0: p.y - 26, x1: p.x + half, y1: p.y - 4 })
        }
      }

      // The two craft. While they are docked there is one label for the pair, at the capsule.
      const t = f.clock.timeMs
      const presence = landerPresence(f.plan, t)
      const capsule = craftAt(f.plan, 'capsule', t)
      const lander = presence === 'apart' ? craftAt(f.plan, 'lander', t) : null
      const free = (box: Box) => !taken.some((o) => overlaps(grown(box), o))
      // A craft label is always shown. It takes the first free corner in its own order (the capsule starts above
      // its point, the lander below, so the two part when the craft are close) and its first choice when none is.
      const craft = (els: CraftEls, anchor: 'capsule' | 'lander', name: string, sub: string, firing: boolean, corners: string[]) => {
        const p = h.projectFlight(anchor)
        if (!place(flightEls.current[anchor] ?? null, p, true) || !p) return
        setText(els.name, name)
        setText(els.sub, sub)
        if (els.sub) els.sub.hidden = sub === ''
        els.box?.classList.toggle('is-firing', firing)
        const w = Math.max(name.length + 2, sub.length) * MONO_PX + 8
        const hgt = sub ? 2 * LINE_PX : LINE_PX
        const boxAt = (corner: string): Box => {
          const x0 = corner[1] === 'e' ? p.x + CRAFT_GAP : p.x - CRAFT_GAP - w
          const y0 = corner[0] === 'n' ? p.y - CRAFT_UP - hgt : p.y + CRAFT_UP
          return { x0, y0, x1: x0 + w, y1: y0 + hgt }
        }
        const corner = corners.find((c) => free(boxAt(c))) ?? corners[0]
        if (els.box && els.box.dataset.pos !== corner) els.box.dataset.pos = corner
        taken.push(boxAt(corner))
        taken.push({ x0: p.x - MARK_PX, y0: p.y - MARK_PX, x1: p.x + MARK_PX, y1: p.y + MARK_PX }) // the marker itself
      }
      const firing = !!capsule?.powered && f.layers.burns
      craft(
        capsuleEls.current,
        'capsule',
        presence === 'docked' ? 'Capsule + lander' : 'Capsule',
        [presence === 'docked' ? 'docked' : '', firing ? 'engine firing' : ''].filter((x) => x).join(' · '),
        firing,
        ['ne', 'se', 'nw', 'sw'],
      )
      craft(landerEls.current, 'lander', 'Lander', lander?.label ?? '', !!lander?.powered && f.layers.burns, ['se', 'ne', 'sw', 'nw'])

      // Launchpad and landing point: their names are also in the panel, so they give way to the craft labels.
      for (const name of ['pad', 'site'] as const) {
        const el = flightEls.current[name] ?? null
        const p = h.projectFlight(name)
        if (!el || !p || !p.visible) {
          if (el) el.hidden = true
          continue
        }
        const w = (el.textContent ?? '').length * MONO_PX
        const box: Box = { x0: p.x + TAG_GAP, y0: p.y - LINE_PX / 2, x1: p.x + TAG_GAP + w, y1: p.y + LINE_PX / 2 }
        if (place(el, p, free(box))) taken.push(box)
      }

      const list = burnsRef.current
      const els = burnEls.current
      const showName = f.layers.burnNames
      const showBy = f.layers.stageNames
      if (!showName && !showBy) {
        for (const el of els) if (el) el.hidden = true
        return
      }
      const order = list
        .map((_, i) => i)
        .sort((a, b) => {
          const activeA = t >= list[a].startMs && t <= list[a].endMs
          const activeB = t >= list[b].startMs && t <= list[b].endMs
          return activeA !== activeB ? (activeA ? -1 : 1) : list[b].dvKms - list[a].dvKms
        })
      const shown: { i: number; box: Box; more: number }[] = []
      const lost: ScreenPoint[] = [] // burns whose label found no room beside anything it could be counted on
      for (const i of order) {
        const el = els[i]
        const b = list[i]
        if (!el) continue
        const p = h.projectFlightBurn(i)
        const lines = [showName ? b.name : '', showBy ? b.by : ''].filter((x) => x)
        if (!p || !p.visible || lines.length === 0) {
          el.hidden = true
          continue
        }
        const w = Math.max(...lines.map((x) => x.length), showName ? b.name.length + 3 : 0) * MONO_PX // room for " +n"
        const hgt = lines.length * LINE_PX
        // Beside the ring if there is room, else under or over it.
        const boxes: [side: string, box: Box][] = [
          ['right', { x0: p.x + BURN_GAP, y0: p.y - hgt / 2, x1: p.x + BURN_GAP + w, y1: p.y + hgt / 2 }],
          ['left', { x0: p.x - BURN_GAP - w, y0: p.y - hgt / 2, x1: p.x - BURN_GAP, y1: p.y + hgt / 2 }],
          ['below', { x0: p.x - w / 2, y0: p.y + BURN_GAP, x1: p.x + w / 2, y1: p.y + BURN_GAP + hgt }],
          ['above', { x0: p.x - w / 2, y0: p.y - BURN_GAP - hgt, x1: p.x + w / 2, y1: p.y - BURN_GAP }],
        ]
        // Where a more important burn found no room, a lesser one at the same spot must not stand in for it.
        const spotLost = lost.some((q) => Math.abs(q.x - p.x) < SAME_SPOT_PX && Math.abs(q.y - p.y) < SAME_SPOT_PX)
        const fit = spotLost ? undefined : boxes.find(([, box]) => free(box))
        if (!fit) {
          // Counted on the burn label it would have covered, so the reader knows there is more at that spot.
          const over = shown.find((s) => boxes.some(([, box]) => overlaps(grown(box), s.box)))
          if (over) over.more++
          else lost.push(p)
          el.hidden = true
          continue
        }
        const [side, box] = fit
        taken.push(box)
        shown.push({ i, box, more: 0 })
        place(el, p, true)
        if (el.dataset.side !== side) el.dataset.side = side
      }
      for (const s of shown) setText(els[s.i]?.querySelector<HTMLElement>('.obj-more') ?? null, s.more > 0 ? ` +${s.more}` : '')
    }

    const offLevel = h.onLevel((l) => {
      ownLevel.current = l
      cb.current.onLevel(l)
    })
    // A press that closes the right-click menu is not also a click on the scene.
    h.setClickGuard(() => !ctxOpen.current && performance.now() - ctxClosedAt.current > 400 && cb.current.clickGuard())
    // No eye-level view in the app (15 Nov): no walk. The scene's regression tests (?test=1) keep it.
    h.setWalkEnabled(new URLSearchParams(window.location.search).has('test'))
    api.current = { goTo: (v) => h.goTo(v), setLevel: (l) => h.setLevel(l), goToPoint: (lat, lon) => h.goToPoint(lat, lon) }
    const namedNow = () => (namedOverride.current !== undefined ? namedOverride.current : h.named())
    const offMenu = h.onMenu((m) => {
      // U11: only the point under the pointer, not the selected one elsewhere (that sent "Set … as landing site" to the old point).
      const n = namedNow()
      const under = n && !n.poiId && Math.hypot(n.x - m.x, n.y - m.y) <= 24
      const i = under ? pointsNow.current.findIndex((q) => q.name === n.name) : -1
      setCtx({ ...m, point: i >= 0 ? i : null })
    })
    const poiOf = (n: SceneName | null) => (n && n.poiId && byId.current?.has(n.poiId) ? n.poiId : null)
    const testHook = new URLSearchParams(window.location.search).has('test')
    if (testHook) {
      const hook: ViewsTestHook = { pois: () => lastPois.current, setNamed: (n) => (namedOverride.current = n) }
      ;(window as unknown as { __views?: ViewsTestHook }).__views = hook
    }

    // The info box (U8, visual sweep 9 and 10) sits beside its pin, never on it: right of the pin, flipped to the
    // left at the stage's right edge, else above or below it. Of those, the first that covers none of the page's
    // own text over the stage (header, timeline, POI key, open panels); when none is free, the one covering least.
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
      const m = 8
      const clampX = (x: number) => Math.max(m, Math.min(x, W - w - m))
      const clampY = (y: number) => Math.max(m, Math.min(y, H - ht - m))
      // Beside: moved only along the pin's vertical, so it never slides over the pin; above / below: only sideways.
      const sides: [string, Box][] = (
        [
          ['right', a.x + gap, clampY(a.y - ht / 2)],
          ['left', a.x - gap - w, clampY(a.y - ht / 2)],
          ['above', clampX(a.x - w / 2), a.y - gap - ht],
          ['below', clampX(a.x - w / 2), a.y + gap],
        ] as [string, number, number][]
      )
        .filter(([, x, y]) => x >= m - 0.5 && y >= m - 0.5 && x + w <= W - m + 0.5 && y + ht <= H - m + 0.5)
        .map(([side, x, y]) => [side, { x0: x, y0: y, x1: x + w, y1: y + ht }])
      const blocked = overlayBoxes(stage)
      const cover = (b: Box) => blocked.reduce((s, o) => s + o.w * Math.max(0, Math.min(b.x1, o.x1) - Math.max(b.x0, o.x0)) * Math.max(0, Math.min(b.y1, o.y1) - Math.max(b.y0, o.y0)), 0)
      let best: [string, Box] | null = null
      let least = Infinity
      for (const c of sides) {
        const k = cover(c[1])
        if (k < least) {
          least = k
          best = c
        }
        if (k === 0) break
      }
      // A stage too small for any side (a phone in landscape): inside the stage, below the pin if it fits.
      const [side, b] = best ?? ['inside', { x0: clampX(a.x - w / 2), y0: clampY(a.y + gap), x1: 0, y1: 0 }]
      const t = `translate(${b.x0.toFixed(0)}px, ${b.y0.toFixed(0)}px)`
      if (el.style.transform !== t) el.style.transform = t
      if (el.dataset.side !== side) el.dataset.side = side
    }

    // A Sun, Earth or Landing site label that would lie on the page's own text (the header over the sky, visual sweep
    // 1 and 2) hangs below its point instead (.obj-box.is-below); if that is covered too, it is not drawn.
    const clearOfText = (el: HTMLDivElement | null) => {
      const box = el?.firstElementChild
      if (!el || el.hidden || !box) return
      const o = host.current!.getBoundingClientRect()
      const blocked = overlayBoxes(host.current!)
      const covered = () => {
        const b = box.getBoundingClientRect()
        const me: Box = { x0: b.left - o.left, y0: b.top - o.top, x1: b.right - o.left, y1: b.bottom - o.top }
        return blocked.some((x) => overlaps(me, x))
      }
      box.classList.remove('is-below')
      if (!covered()) return
      if (box.classList.contains('obj-box')) {
        box.classList.add('is-below')
        if (!covered()) return
        box.classList.remove('is-below')
      }
      el.hidden = true
    }

    let raf = 0
    const tick = () => {
      h.setFlightTime(flightRef.current.clock.timeMs)
      place(sun.current, h.labelPoint('sun'), have.current.sun)
      clearOfText(sun.current)
      const ep = h.labelPoint('earth')
      place(earth.current, ep, have.current.earth)
      clearOfText(earth.current)
      place(site.current, h.project('site'), true)
      clearOfText(site.current)
      const n = namedNow()
      const named = n && n.visible ? poiOf(n) : null
      if (named !== dismissed.current) dismissed.current = null // the pointer has left the dismissed pin
      const id = named === dismissed.current ? null : named
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
      layoutFlight()
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
        dismissed.current = null // a new tap on the pin opens it again
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
      dismissInfo()
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
      offFlightPick()
      offLevel()
      offMenu()
      api.current = null
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

  // Another landing site: the scene is told before the level change below and before the site's frame is loaded, so no
  // fly goes down to the site that is still loaded (15 Nov: "it zoomed in to the wrong point"). This effect stays
  // above the level effect: effects run in this order.
  useEffect(() => {
    const at = deps.sites.find((s) => s.id === siteId) ?? null
    const custom = at ? null : parseCustomSiteId(siteId)
    handle.current?.expectSite(siteId, at?.lat ?? custom?.lat, at?.lon ?? custom?.lon)
  }, [deps, siteId])

  useEffect(() => {
    const own = ownLevel.current
    ownLevel.current = null
    if (own !== view) handle.current?.setLevel(view)
  }, [view])

  useEffect(() => {
    handle.current?.setFlight(flight.plan, flight.trueScale)
  }, [flight.plan, flight.trueScale])

  useEffect(() => {
    handle.current?.setFlightFocus(flight.focus)
  }, [flight.focus])

  useEffect(() => {
    handle.current?.setFlightLayers(flight.layers)
  }, [flight.layers])

  const viewKey = useRef(flight.viewKey)
  useEffect(() => {
    if (viewKey.current === flight.viewKey) return
    viewKey.current = flight.viewKey
    handle.current?.resetFlightView()
  }, [flight.viewKey])

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
        if (!alive) return
        setFailedFor(siteId)
        handle.current?.expectSite(null)
      })
    return () => {
      alive = false
    }
  }, [deps, siteId, utcMs])

  const ctxPoint = ctx && ctx.point !== null ? (points[ctx.point] ?? null) : null
  const tag = (name: FlightAnchor, text: string) => (
    <div ref={(el) => void (flightEls.current[name] = el)} className="obj" hidden>
      <div className="obj-tag" data-testid={`label-${name}`}>
        {text}
      </div>
    </div>
  )
  const above = (name: FlightAnchor, ghost = false) => (
    <div ref={(el) => void (flightEls.current[name] = el)} className="obj" hidden>
      <div className={`obj-box obj-body${ghost ? ' obj-ghost' : ''}`} data-testid={`label-flight-${name}`}>
        {ghost ? BODY_TEXT[name] : <span className="obj-name">{BODY_TEXT[name]}</span>}
      </div>
    </div>
  )
  // The text of a craft label changes while the flight plays (docked, engine firing, the lander's phase): the
  // frame loop writes it, React only makes the elements.
  const craftTag = (name: 'capsule' | 'lander', els: CraftEls) => (
    <div ref={(el) => void (flightEls.current[name] = el)} className="obj" hidden>
      <div ref={(el) => void (els.box = el)} className={`obj-craft obj-craft-${name}`} data-testid={`label-${name}`}>
        <span className="obj-glyph" aria-hidden="true" />
        <span ref={(el) => void (els.name = el)} />
        <span ref={(el) => void (els.sub = el)} className="obj-craft-sub" hidden />
      </div>
    </div>
  )

  return (
    <>
      <div ref={host} className={`scene${view === 'flight' && flight.picking ? ' is-picking' : ''}`} data-testid="scene" />
      {failedFor === siteId && view !== 'flight' && (
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
          from={deps.sites.find((s) => s.id === siteId) ?? null}
          onClose={dismissInfo}
          currentSiteId={siteId}
          onGoTo={
            onGoToPoi &&
            ((p) => {
              dismissInfo()
              onGoToPoi(p)
            })
          }
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
            {props.sunHidden && <span className="obj-note" data-testid="label-sun-hidden"> · behind terrain at the site</span>}
            <span className="obj-tick" />
          </div>
        </div>
        <div ref={earth} className="obj" hidden>
          <div className="obj-box" data-testid="label-earth">
            <span className="obj-name obj-earth">Earth</span> <span className="obj-num">{earthEl === null ? '' : fmtDeg(earthEl)}</span>
            {props.earthHidden && <span className="obj-note" data-testid="label-earth-hidden"> · behind terrain at the site</span>}
            <span className="obj-tick" />
          </div>
        </div>
        <div ref={site} className="obj" hidden>
          <div className="obj-site" data-testid="label-site">
            {props.siteLabel ?? 'Landing site'}
          </div>
        </div>
        <div ref={name} className="obj" hidden>
          <div ref={nameText} className="obj-pin-name" data-testid="pin-name" />
        </div>
        {view === 'flight' && plan && (
          <>
            {above('earth')}
            {above('moon')}
            {above('arrival', true)}
            {tag('pad', plan.pad.name)}
            {tag('site', plan.target.name)}
            {burns.map((b, i) => (
              <div key={i} ref={(el) => void (burnEls.current[i] = el)} className="obj" hidden>
                <div className="obj-burn" data-testid="label-burn">
                  {flight.layers.burnNames && (
                    <span className="obj-burn-name">
                      {b.name}
                      <span className="obj-more" />
                    </span>
                  )}
                  {flight.layers.stageNames && b.by && <span className="obj-burn-by">{b.by}</span>}
                </div>
              </div>
            ))}
            {craftTag('capsule', capsuleEls.current)}
            {craftTag('lander', landerEls.current)}
          </>
        )}
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
            // During a camera fly the scene refuses a viewpoint (goTo is false): ask for the Moon level instead,
            // which the scene keeps until the fly ends (feature review: "Moon" did nothing right after a site change).
            ...viewpointItems((v) => {
              if (!handle.current?.goTo(v)) onLevel('globe')
            }),
          ]}
          onClose={closeCtx}
        />
      )}
    </>
  )
}
