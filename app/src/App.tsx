// Main screen (build-plan §5.1, Brief C2, Step 2-UI): the 3D scene with labels on its objects, the header controls
// (mission, date, points of interest, Search, Details), the answer sentence, the timeline and one footer line.
// The flight view shares the stage: the Earth-to-Moon trajectory for a mission's site and start date, with its own
// panel and playback bar. It has no tab: "Calculate flight" on a mission opens it (U12); "Back to landing site" or
// Esc leaves it.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadPeriods, loadSites, loadStations } from './data/load'
import { makeLoadFrame, useResults } from './data/results'
import type { ResultsState } from './data/results'
import type { Period, Site, Station } from './data/types'
import { NOT_VALIDATED, VALIDATED } from './data/validation'
import { LAUNCH_VEHICLES } from './flight/launchVehicles'
import { DEFAULT_PAD_ID, LAUNCHPADS } from './flight/pads'
import { DEFAULT_ARCHITECTURE_ID } from './flight/designs'
import { ARCHITECTURES, SPACECRAFT } from './flight/spacecraft'
import type { LandingTarget, Launchpad } from './flight/types'
import { DEFAULT_LAYERS, webglAvailable } from './scene3d'
import type { BodyPick, FlightFocus, FlightLayers, SceneLevel, ScenePoint, Viewpoint } from './scene3d'
import {
  addPoint,
  cleanName,
  COVERAGE_END_MS,
  COVERAGE_START_MS,
  DAY_MS,
  DEFAULT_DAYS,
  DEFAULT_MISSION_NAME,
  DEFAULT_SPEED_H_PER_S,
  DEFAULT_SITE_ID,
  MAX_POINTS,
  pointName,
  removePoint,
  renamePoint,
  STEP_MS,
  useHashState,
} from './state'
import { DateMenu } from './views/DateMenu'
import { Drawer } from './views/Drawer'
import type { ViewPeriod } from './views/Drawer'
import { FlightPanel } from './views/FlightPanel'
import { FlightTransport } from './views/FlightTransport'
import { HorizonStrip } from './views/HorizonStrip'
import { Icon } from './views/Icon'
import { MissionPanel } from './views/MissionPanel'
import { PoiKey, PoiToggle } from './views/PoiControl'
import { pinCounts, scenePois, usePois } from './views/poiLayer'
import { SearchPanel } from './views/SearchPanel'
import { SceneView, viewpointItems } from './views/SceneView'
import type { FlightScene, SceneApi } from './views/SceneView'
import { ViewMenu } from './views/ViewMenu'
import type { ViewItem } from './views/ViewMenu'
import { Timeline } from './views/Timeline'
import { fmtCoords, fmtDateTime, fmtDeg } from './views/format'
import { resolvePeriod } from './views/period'
import { MAX_MISSIONS, missionKey, missionOf, useMissions } from './missions'
import type { MissionState } from './missions'
import { SLOPE_BASELINE, slopeOf } from './views/slope'
import { approxText, footTerrain, useCustomSite } from './views/custom'
import { customSiteId } from './data/customSite'
import { defaultSurfaceStayDays, useFlight } from './views/useFlight'
import './styles/mission.css'
import './styles/view.css'
import './styles/poi.css'

// The documentation is a separate chunk, fetched when the Docs view is first opened.
const DocsView = lazy(() => import('./docs/DocsView').then((m) => ({ default: m.DocsView })))

type Boot =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; sites: Site[]; periods: Period[]; stations: Station[] }

export default function App() {
  const [boot, setBoot] = useState<Boot>({ status: 'loading' })
  useEffect(() => {
    Promise.all([loadSites(), loadPeriods(), loadStations()]).then(
      ([sites, periods, stations]) => setBoot({ status: 'ready', sites, periods, stations }),
      (e: Error) => setBoot({ status: 'error', error: e.message }),
    )
  }, [])

  if (boot.status === 'error')
    return (
      <main className="notice" role="alert">
        <p className="notice-title">Could not load the data.</p>
        <p className="quiet mono">{boot.error}</p>
      </main>
    )
  if (boot.status === 'loading')
    return (
      <main className="notice" aria-live="polite">
        <p className="notice-title">Loading…</p>
      </main>
    )
  if (!boot.sites.length || !boot.stations.length)
    return (
      <main className="notice">
        <p className="notice-title">{boot.sites.length ? 'No stations in this build.' : 'No sites in this build.'}</p>
      </main>
    )
  return <Main sites={boot.sites} periods={boot.periods} stations={boot.stations} />
}

const dayStart = (ms: number) => ms - (((ms % DAY_MS) + DAY_MS) % DAY_MS)
const CONTEXT_DAYS = 3
// Arrow keys on the Flight plan tab: ten minutes, or six hours with Shift.
const FLIGHT_STEP_MS = 10 * 60_000
const FLIGHT_STEP_BIG_MS = 6 * 3_600_000
type LatLon = { latDeg: number; lonDeg: number }

/** The answer slot while results load, have no data or fail: never the previous selection's sentence (UX-03). */
function AnswerPending({ state, siteName }: { state: ResultsState; siteName: string }) {
  if (state.status === 'empty')
    return (
      <p className="answer is-empty" data-testid="answer" data-state="empty" role="status">
        {state.message}
      </p>
    )
  if (state.status === 'error')
    return (
      <p className="answer is-error" data-testid="answer" data-state="error" role="alert">
        Could not load the data for {siteName}. <span className="mono">{state.error}</span>
      </p>
    )
  return (
    <p className="answer is-loading" data-testid="answer" data-state="loading" aria-live="polite">
      Loading {siteName}…
    </p>
  )
}

function Main({ sites, periods, stations }: { sites: Site[]; periods: Period[]; stations: Station[] }) {
  const [hs, patch] = useHashState()
  const [menu, setMenu] = useState<null | 'mission' | 'date' | 'view'>(null)
  const [panelAtStations, setPanelAtStations] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(DEFAULT_SPEED_H_PER_S) // hours of mission time per second
  // Simulation mode: from the first play until the run reaches its last step, Esc or the Flight plan tab.
  // A pause stays in it, so the speed slider and "Reset to start" stay beside Simulate.
  const [simMode, setSimMode] = useState(false)
  const leftSite = hs.view === 'flight'
  useEffect(() => {
    if (leftSite) setSimMode(false)
    else if (playing) setSimMode(true)
  }, [playing, leftSite])
  const [webgl, setWebgl] = useState(() => webglAvailable())
  const missionBtn = useRef<HTMLButtonElement>(null)
  const dateBtn = useRef<HTMLButtonElement>(null)
  const viewBtn = useRef<HTMLButtonElement>(null)
  const scene = useRef<SceneApi | null>(null)
  const [selPoint, setSelPoint] = useState<number | null>(null) // user point highlighted in the panel and the scene
  // A press on the scene that closes a menu is not also a click on the scene (it would walk the camera).
  const menuOpen = useRef(false)
  menuOpen.current = menu !== null
  const menuClosedAt = useRef(0)
  const clickGuard = useCallback(() => !menuOpen.current && performance.now() - menuClosedAt.current > 400, [])
  const onLevel = useCallback((view: SceneLevel) => patch({ view }), [patch])

  // A custom landing site (data/customSite.ts) lives in the link as its id; its height and slope arrive with capHorizon.
  const custom = useCustomSite(hs.site, hs.name ?? DEFAULT_MISSION_NAME)
  const site = custom?.site ?? sites.find((s) => s.id === hs.site) ?? sites.find((s) => s.id === DEFAULT_SITE_ID) ?? sites[0]
  const customReady = custom?.status === 'ready' ? custom : null
  const missionName = hs.name ?? DEFAULT_MISSION_NAME
  // Saved missions (this browser only): listed in the Mission panel and as rows of the comparison table.
  const missions = useMissions()
  // A launch point typed as coordinates lives only in this page; a saved mission keeps the default pad instead.
  const missionNow = useMemo(() => {
    const m = missionOf(hs)
    return m.pad === 'custom' ? { ...m, pad: null } : m
  }, [hs])
  const currentMission = missionKey(missionNow)
  const missionSaved = missions.list.some((m) => missionKey(m) === currentMission)

  const period: ViewPeriod = useMemo(
    () => resolvePeriod({ period: hs.period, from: hs.from, days: hs.days }, periods),
    [hs.period, hs.from, hs.days, periods],
  )

  const missionDays = Math.round((period.endMs - period.startMs) / DAY_MS)
  const lastStep = period.endMs - STEP_MS
  const snap = useCallback(
    (ms: number) => {
      const c = Math.min(lastStep, Math.max(period.startMs, ms))
      return period.startMs + Math.round((c - period.startMs) / STEP_MS) * STEP_MS
    },
    [period.startMs, lastStep],
  )
  const cursor = snap(hs.t ?? period.startMs)

  const ids = useMemo(() => {
    const known = stations.map((s) => s.id)
    const sel = hs.st ? known.filter((id) => hs.st!.includes(id)) : known
    return sel.length ? sel : known
  }, [hs.st, stations])

  const results = useResults({ site, stations, ids, startMs: period.startMs, endMs: period.endMs })
  const ready = results.status === 'ready'
  // The timeline also shows CONTEXT_DAYS before and after the mission (clipped to the supported dates). Those
  // windows come from their own series; the answer, the drawer and the ranking use the mission span only.
  const ctxStart = Math.max(COVERAGE_START_MS, period.startMs - CONTEXT_DAYS * DAY_MS)
  const ctxEnd = Math.min(COVERAGE_END_MS, period.endMs + CONTEXT_DAYS * DAY_MS)
  const context = useResults({ site, stations, ids, startMs: ctxStart, endMs: ctxEnd })
  const slope = slopeOf(site)
  const idx = Math.round((cursor - period.startMs) / STEP_MS)
  const atCursor = ready ? (results.results.series.samples[idx] ?? null) : null
  const answer = ready ? results.results.answerAt(cursor) : null

  // Points of interest: pois.json is fetched the first time the layer or the search is opened (layer off by default).
  const poiData = usePois(hs.poi !== null || hs.drawer === 'search')
  const visiblePois = useMemo(
    () => (poiData.status === 'ready' && hs.poi ? scenePois(poiData.pois, hs.poi, sites) : []),
    [poiData, hs.poi, sites],
  )
  const poiCounts = useMemo(() => (poiData.status === 'ready' ? pinCounts(poiData.pois, sites) : null), [poiData, sites])

  // ---------- Flight plan tab: launchpad → this mission's site, touching down at the mission start ----------
  const inFlight = hs.view === 'flight'
  const [customPad, setCustomPad] = useState<LatLon | null>(null)
  const [customSite, setCustomSite] = useState<LatLon | null>(null)
  const [siteMode, setSiteMode] = useState<'mission' | 'custom'>('mission')
  const [picking, setPicking] = useState<'pad' | 'site' | null>(null)
  const [returnWindowDays, setReturnWindowDays] = useState(0)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const pad: Launchpad = useMemo(() => {
    if (hs.pad === 'custom' && customPad) {
      return {
        id: 'custom', name: 'Chosen launch point', site: fmtCoords(customPad.latDeg, customPad.lonDeg), latDeg: customPad.latDeg, lonDeg: customPad.lonDeg,
        source: { label: 'Coordinates chosen in this app', url: '' },
      }
    }
    return LAUNCHPADS.find((x) => x.id === hs.pad) ?? LAUNCHPADS.find((x) => x.id === DEFAULT_PAD_ID) ?? LAUNCHPADS[0]
  }, [hs.pad, customPad])
  const target: LandingTarget = useMemo(
    () =>
      siteMode === 'custom' && customSite
        ? { id: 'custom', name: 'Chosen landing point', latDeg: customSite.latDeg, lonDeg: customSite.lonDeg }
        : { id: site.id, name: site.name, latDeg: site.lat, lonDeg: site.lon },
    [site, siteMode, customSite],
  )
  const architecture = ARCHITECTURES.find((a) => a.id === hs.rocket) ?? ARCHITECTURES.find((a) => a.id === DEFAULT_ARCHITECTURE_ID)!
  // The surface stay asked for belongs to a design: another design starts with its own default again.
  // It is part of the link and of a saved mission; choosing another design clears it (onArchitecture).
  const stayDays = hs.stay ?? defaultSurfaceStayDays(architecture)
  const flight = useFlight({
    active: inFlight,
    pad,
    target,
    architecture,
    launchVehicle: LAUNCH_VEHICLES.find((v) => v.id === architecture.launchVehicleId)!,
    capsule: SPACECRAFT.find((v) => v.id === architecture.capsuleId)!,
    lander: SPACECRAFT.find((v) => v.id === architecture.landerId)!,
    earliestTouchdownMs: period.startMs,
    surfaceStayDays: stayDays,
    returnWindowDays,
    maxTransferDays: hs.tmax,
  })
  const [layers, setLayers] = useState<FlightLayers>(DEFAULT_LAYERS)
  const [trueScale, setTrueScale] = useState(true)
  const [flightFocus, setFlightFocus] = useState<FlightFocus>('overview')
  const [flightViewKey, setFlightViewKey] = useState(0)
  const flightScene: FlightScene = useMemo(
    () => ({ plan: flight.plan, trueScale, clock: flight.clock, focus: flightFocus, viewKey: flightViewKey, picking: picking !== null, layers }),
    [flight.plan, flight.clock, trueScale, flightFocus, flightViewKey, picking, layers],
  )
  // A click on Earth or the Moon while the panel waits for one: the launch point or the landing point.
  const onFlightPick = useCallback(
    (hit: BodyPick) => {
      if (picking === 'pad' && hit.body === 'earth') {
        setCustomPad({ latDeg: hit.latDeg, lonDeg: hit.lonDeg })
        patch({ pad: 'custom' })
        setPicking(null)
      } else if (picking === 'site' && hit.body === 'moon') {
        setCustomSite({ latDeg: hit.latDeg, lonDeg: hit.lonDeg })
        setSiteMode('custom')
        setPicking(null)
      }
    },
    [picking, patch],
  )

  const deps = useMemo(() => ({ sites, loadFrame: makeLoadFrame(sites) }), [sites])
  const onUnavailable = useCallback(() => setWebgl(false), [])

  const closeMenu = useCallback((focus = false) => {
    menuClosedAt.current = performance.now()
    setMenu((m) => {
      if (focus) (m === 'date' ? dateBtn : m === 'view' ? viewBtn : missionBtn).current?.focus()
      return null
    })
  }, [])
  const closeMenuQuiet = useCallback(() => closeMenu(false), [closeMenu])

  // Simulate: the cursor follows the real clock (elapsed time × speed), on the 30-minute grid, until the
  // period's last step. A timer that reads the clock, so a throttled tab plays at the same pace, in fewer steps.
  const cursorNow = useRef(cursor)
  cursorNow.current = cursor
  useEffect(() => {
    if (!playing) return
    if (inFlight || cursorNow.current >= lastStep) {
      setPlaying(false)
      setSimMode(false)
      return
    }
    let from = cursorNow.current // mission time and
    let t0 = performance.now() // real time where the run is anchored
    let shown = from
    let before = from // the cursor before the last step this timer made
    const id = window.setInterval(() => {
      // Scrubbed or stepped by the user meanwhile: go on from there.
      const c = cursorNow.current
      if (c !== shown && c !== before) {
        from = shown = before = c
        t0 = performance.now()
      }
      const elapsed = (performance.now() - t0) * speed * 3600 // ms of mission time
      const next = Math.min(lastStep, from + Math.floor(elapsed / STEP_MS) * STEP_MS)
      if (next !== shown) {
        before = shown
        shown = next
        patch({ t: next })
      }
      if (next >= lastStep) {
        setPlaying(false)
        setSimMode(false)
      }
    }, 40)
    return () => window.clearInterval(id)
  }, [playing, inFlight, speed, lastStep, patch])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) || t.isContentEditable) return
      if (e.key === 'Escape') {
        if (menu) closeMenu(true)
        else if (hs.drawer) patch({ drawer: null })
        else {
          // Esc during the simulation stops it and goes to the landing-site view (U6); otherwise to the Moon.
          // `playing` is read before it is set to false.
          const toSite = inFlight || (playing && hs.view !== 'site')
          setPlaying(false)
          setSimMode(false)
          patch({ view: toSite ? 'site' : 'globe' })
        }
        return
      }
      if (menu || hs.drawer || e.metaKey || e.ctrlKey || e.altKey) return
      if (inFlight) {
        // The flight has its own clock: Space plays it, the arrows step it.
        if (e.key === ' ' && t.tagName !== 'BUTTON') {
          e.preventDefault()
          flight.setPlaying(!flight.playing)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          flight.seek(flight.clock.timeMs + (e.shiftKey ? FLIGHT_STEP_BIG_MS : FLIGHT_STEP_MS) * (e.key === 'ArrowLeft' ? -1 : 1))
        }
        return
      }
      if (e.key === ' ' && t.tagName !== 'BUTTON') {
        e.preventDefault()
        setPlaying((p) => !p)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const d = (e.shiftKey ? DAY_MS : STEP_MS) * (e.key === 'ArrowLeft' ? -1 : 1)
        patch({ t: snap(cursor + d) })
      } else if (e.key === 'e' || e.key === 'E') {
        patch({ view: hs.view === 'eye' ? 'site' : 'eye' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu, hs.drawer, hs.view, inFlight, playing, flight, cursor, snap, patch, closeMenu])

  const toggleStation = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : stations.map((s) => s.id).filter((x) => x === id || ids.includes(x))
    if (next.length === 0) return
    patch({ st: next.length === stations.length ? null : next })
  }

  // Mission dates from the panel: a span that equals a named period keeps its id (and its label in the date menu).
  const setMissionDates = (startMs: number, days: number) => {
    const endMs = startMs + days * DAY_MS
    const named = periods.find((x) => Date.parse(x.start_utc) === startMs && Date.parse(x.end_utc) === endMs)
    if (named) patch({ period: named.id, from: null, t: null })
    else patch({ period: 'custom', from: startMs, days, t: null })
  }

  // A pin on the globe: the scene reports a pin within its pick radius as that site's own source coordinates.
  // A click elsewhere on the globe chooses no site; custom landing sites come from setLandingSite below.
  const onPick = useCallback(
    (lat: number, lon: number) => {
      const hit = sites.find((s) => Math.abs(s.lat - lat) < 1e-9 && Math.abs(s.lon - lon) < 1e-9)
      if (hit) patch({ site: hit.id, view: 'site' })
    },
    [sites, patch],
  )

  // User points as the scene draws them: places only, nothing is computed for them.
  const scenePoints: ScenePoint[] = useMemo(
    () => hs.pts.map((p, i) => ({ name: pointName(p, i), lat: p.lat, lon: p.lon, selected: i === selPoint })),
    [hs.pts, selPoint],
  )
  const addUserPoint = useCallback(
    (lat: number, lon: number) => {
      const next = addPoint(hs.pts, lat, lon)
      if (!next) return
      patch({ pts: next })
      setSelPoint(next.length - 1)
    },
    [hs.pts, patch],
  )
  // "Set as landing site" (typed coordinates, a user point's row, the right-click menu on a user point): only
  // inside the pin region, where customSiteId gives an id. On the Flight plan tab the tab stays, as for a site
  // chosen in the Mission panel.
  const setLandingSite = useCallback(
    (lat: number, lon: number) => {
      const id = customSiteId(lat, lon)
      if (!id) return
      setMenu(null)
      patch(inFlight ? { site: id } : { site: id, view: 'site' })
    },
    [patch, inFlight],
  )

  // The View button: the two levels on the surface first (what E and Esc do on a keyboard; "Moon" is the
  // globe), then the Moon viewpoint of the right-click menu.
  const goLevel = (view: SceneLevel) => {
    if (hs.view === view) scene.current?.setLevel(view)
    else patch({ view })
  }
  const viewItems: ViewItem[] = [
    { id: 'site', label: 'Landing site', current: hs.view === 'site', onSelect: () => goLevel('site') },
    { id: 'eye', label: 'Eye level', current: hs.view === 'eye', onSelect: () => goLevel('eye') },
    ...viewpointItems(scenePoints, (v: Viewpoint) => scene.current?.goTo(v)).map((it, i) => ({ ...it, separated: i === 0 })),
  ]

  // The Simulate control beside the timeline: from the cursor, or from the start when the cursor is at the end.
  const toggleSimulate = () => {
    if (playing) return setPlaying(false)
    if (cursor >= lastStep) patch({ t: period.startMs })
    setPlaying(true)
  }

  // "Calculate flight" on a mission: its site, dates, launchpad, rocket, stay and transfer cap, in the flight view
  // (a mission saved without a cap patches tmax: null, so the cap on screen never carries over).
  const calculateFlight = (m: MissionState) => {
    setMenu(null)
    setPlaying(false)
    setSiteMode('mission')
    setPicking(null)
    setPanelCollapsed(false)
    patch({ ...m, t: null, view: 'flight', drawer: null })
  }

  const playMission = () => {
    setMenu(null)
    patch({ view: 'eye', t: period.startMs })
    setPlaying(true)
  }

  const openCustom = (ms: number) => {
    setMenu(null)
    if (ms >= period.startMs && ms < period.endMs) {
      patch({ t: ms })
      return
    }
    const from = Math.min(dayStart(ms), COVERAGE_END_MS - DEFAULT_DAYS * DAY_MS)
    patch({ period: 'custom', from, days: DEFAULT_DAYS, t: ms })
  }

  const valueText = (() => {
    const parts = [fmtDateTime(cursor)]
    if (atCursor && ready) {
      parts.push(atCursor.sun.lit ? 'sunlit' : 'dark')
      const c = results.results.coverage[idx]
      parts.push(c === 'covered' ? 'a selected station in line of sight' : c === 'unknown' ? 'comms unknown' : 'no selected station in line of sight')
    }
    return parts.join(', ')
  })()

  return (
    <div className="app">
      <div className="stage">
        {webgl ? (
          <SceneView
            deps={deps}
            siteId={site.id}
            utcMs={cursor}
            view={hs.view}
            sunEl={atCursor ? atCursor.sun.el : null}
            earthEl={atCursor ? atCursor.earth.el : null}
            flight={flightScene}
            onUnavailable={onUnavailable}
            onPick={onPick}
            onFlightPick={onFlightPick}
            onLevel={onLevel}
            clickGuard={clickGuard}
            points={scenePoints}
            api={scene}
            canAddPoint={hs.pts.length < MAX_POINTS}
            onAddPoint={addUserPoint}
            onSetSite={setLandingSite}
            pois={visiblePois}
            poiById={poiData.status === 'ready' ? poiData.byId : null}
          />
        ) : (
          <div className="fallback" data-testid="fallback">
            {inFlight ? (
              <p className="quiet">The flight view needs WebGL, which this browser does not provide. The flight plan's numbers are not affected.</p>
            ) : (
              <>
                <HorizonStrip
                  horizon={ready ? results.results.series.horizon : null}
                  sample={atCursor}
                  track={ready ? results.results.series.samples : null}
                  height={220}
                  className="strip-main"
                />
                <p className="quiet">The 3D view needs WebGL, which this browser does not provide. The horizon strip shows the same sky.</p>
              </>
            )}
          </div>
        )}
      </div>

      <header className="top">
        <div className="place">
          <h1 className="mission-h">
            <button
              ref={missionBtn}
              type="button"
              className="mission"
              data-testid="mission"
              data-menu-trigger=""
              aria-haspopup="dialog"
              aria-expanded={menu === 'mission'}
              onClick={() => {
                setPanelAtStations(false)
                setMenu(menu === 'mission' ? null : 'mission')
              }}
            >
              <Icon name="rocket" />
              <span className="mission-name">{missionName}</span>
            </button>
          </h1>
          <p className="site-line">
            <span className="site-line-name" data-testid="site-name" data-site-id={site.id}>
              {site.name}
            </span>
            <span className="site-line-sep" aria-hidden="true">
              {' · '}
            </span>
            <span className="coords mono" data-testid="coords">
              {fmtCoords(site.lat, site.lon)}
            </span>
          </p>
          {site.label && <p className="site-label">{site.label}</p>}
          <button
            ref={dateBtn}
            type="button"
            hidden={inFlight}
            className="date"
            data-testid="date"
            data-period-id={period.id}
            data-menu-trigger=""
            aria-haspopup="dialog"
            aria-expanded={menu === 'date'}
            onClick={() => setMenu(menu === 'date' ? null : 'date')}
          >
            {fmtDateTime(cursor)}
          </button>
          {menu === 'mission' && (
            <MissionPanel
              sites={sites}
              stations={stations}
              ids={ids}
              site={site}
              period={period}
              name={hs.name}
              goal={hs.goal}
              points={hs.pts}
              selectedPoint={selPoint}
              periods={periods}
              missions={missions.list}
              missionSaved={missionSaved}
              onAddMission={() => missions.add(missionNow)}
              onLoadMission={(m) => patch({ ...m, t: null })}
              onCalculateFlight={calculateFlight}
              onCalculateCurrentFlight={() => calculateFlight(missionOf(hs))}
              onRemoveMission={missions.remove}
              onAddPoint={addUserPoint}
              onSetSite={(lat, lon) => {
                setLandingSite(lat, lon)
                missionBtn.current?.focus()
              }}
              onPointName={(i, name) => patch({ pts: renamePoint(hs.pts, i, name) })}
              onPointSelect={setSelPoint}
              onPointDelete={(i) => {
                patch({ pts: removePoint(hs.pts, i) })
                setSelPoint(null)
              }}
              focusStations={panelAtStations}
              onName={(v) => patch({ name: cleanName(v) })}
              onDates={setMissionDates}
              onGoal={(goal) => patch({ goal })}
              onSelect={(id) => {
                // Closes like the site menu did, so the flight and the new answer are seen; the ranking is kept,
                // so reopening the panel shows it at once.
                setMenu(null)
                patch(inFlight ? { site: id } : { site: id, view: 'site' })
                missionBtn.current?.focus()
              }}
              onToggleStation={toggleStation}
              onPlay={playMission}
              onClose={closeMenuQuiet}
            />
          )}
          {menu === 'date' && (
            <DateMenu
              periods={periods}
              currentPeriodId={period.id}
              cursorMs={cursor}
              onPeriod={(id) => {
                setMenu(null)
                patch({ period: id, from: null, t: null })
                dateBtn.current?.focus()
              }}
              onCustom={openCustom}
              onClose={closeMenuQuiet}
              missionName={missionName}
              site={site}
              stations={stations}
              ids={ids}
              missionStartMs={period.startMs}
              missionEndMs={period.endMs}
              onBest={(startMs, days, landingMs) => {
                setMenu(null)
                patch({ period: 'custom', from: startMs, days, t: landingMs })
                dateBtn.current?.focus()
              }}
            />
          )}
          {inFlight && menu === null && (
            <FlightPanel
              architectures={ARCHITECTURES.map((a) => ({ id: a.id, name: a.name, note: a.note, available: true, unavailableReason: null }))}
              architectureId={architecture.id}
              onArchitecture={(id) => patch({ rocket: id === DEFAULT_ARCHITECTURE_ID ? null : id, stay: null })}
              rendezvous={architecture.rendezvous}
              pads={LAUNCHPADS}
              padId={pad.id}
              onPad={(id) => {
                if (id === 'custom' && !customPad) setCustomPad({ latDeg: pad.latDeg, lonDeg: pad.lonDeg })
                patch({ pad: id === DEFAULT_PAD_ID ? null : id })
              }}
              customPad={customPad}
              onCustomPad={setCustomPad}
              target={target}
              siteMode={siteMode}
              onSiteMode={(m) => {
                if (m === 'custom' && !customSite) setCustomSite({ latDeg: site.lat, lonDeg: site.lon })
                setSiteMode(m)
              }}
              onCustomSite={setCustomSite}
              earliestTouchdownMs={period.startMs}
              surfaceStayDays={stayDays}
              onSurfaceStayDays={(days) => patch({ stay: days })}
              surfaceStay={architecture.surfaceStay}
              returnWindowDays={returnWindowDays}
              onReturnWindowDays={setReturnWindowDays}
              maxTransferDays={hs.tmax}
              onMaxTransferDays={(tmax) => patch({ tmax })}
              status={flight.status}
              trueScale={trueScale}
              onTrueScale={setTrueScale}
              picking={picking}
              onPicking={setPicking}
              onChangeSite={() => {
                setPanelAtStations(false)
                setMenu('mission')
              }}
              onSeek={flight.seek}
              collapsed={panelCollapsed}
              onCollapsed={setPanelCollapsed}
              missionName={missionName}
              onSaveMission={() => missions.add(missionNow)}
              missionSaved={missionSaved}
              canSaveMission={missions.list.length < MAX_MISSIONS}
            />
          )}
        </div>
        <div className="actions-col">
          <div className="actions">
            {/* The flight view has no tab (U12): it opens from "Calculate flight" on a mission, and this link (or Esc)
                goes back to the landing site. */}
            {inFlight && (
              <button type="button" className="find" data-testid="back-to-site" onClick={() => patch({ view: 'site' })}>
                Back to landing site
              </button>
            )}
            {/* The points-of-interest layer, the search and Details belong to the landing-site view. */}
            {!inFlight && <PoiToggle groups={hs.poi} onChange={(poi) => patch({ poi })} />}
            <button
              type="button"
              hidden={inFlight}
              className="find"
              data-testid="search-open"
              aria-haspopup="dialog"
              aria-expanded={hs.drawer === 'search'}
              onClick={() => patch({ drawer: 'search' })}
            >
              Search
            </button>
            {/* One entry point to the drawer, which starts with the date search (U4: "Find better dates" and the cog
                were two ways to the same drawer). */}
            <button
              type="button"
              hidden={inFlight}
              className="find details-btn"
              data-testid="details"
              aria-haspopup="dialog"
              aria-expanded={hs.drawer === 'details' || hs.drawer === 'finder' || hs.drawer === 'sources'}
              onClick={() => patch({ drawer: 'details' })}
            >
              <Icon name="info" />
              <span>Details</span>
            </button>
          </div>
          {hs.poi && !inFlight && <PoiKey groups={hs.poi} data={poiData} counts={poiCounts} webgl={webgl} onChange={(poi) => patch({ poi })} />}
        </div>
      </header>

      {inFlight && (
        <div className="bottom flight-bottom">
          {flight.plan && (
            <FlightTransport
              plan={flight.plan}
              timeMs={flight.timeMs}
              playing={flight.playing}
              speed={flight.speed}
              focus={flightFocus}
              layers={layers}
              onLayers={setLayers}
              onPlaying={flight.setPlaying}
              onSeek={flight.seek}
              onSpeed={flight.setSpeed}
              onFocus={(f) => {
                // "Whole flight" again while it is already chosen puts the camera back where it started.
                if (f === 'overview' && flightFocus === 'overview') setFlightViewKey((k) => k + 1)
                setFlightFocus(f)
              }}
            />
          )}
          <footer className="foot">
            <p>Gravity of Earth, Moon and Sun · ephemeris JPL DE440 · drag to turn, scroll to zoom</p>
          </footer>
        </div>
      )}

      <div className="bottom" hidden={inFlight}>
        {/* Only when the site fails the slope criterion; passing and unknown are stated in the Mission panel. */}
        {slope.state === 'fail' && slope.deg !== null && (
          <p className="slope-warning" data-testid="slope-warning">
            <Icon name="warning" />
            <span>
              Landing not recommended: slope {fmtDeg(slope.deg)} over {SLOPE_BASELINE}, limit 5°
            </span>
          </p>
        )}
        {/* A custom site: its slope (no Mission panel row shows it) and why its numbers are approximate. */}
        {customReady && (
          <p className="custom-note" data-testid="custom-note">
            {slope.state !== 'fail' && slope.deg !== null && (
              <span data-testid="custom-slope">
                Slope {fmtDeg(slope.deg)} over {SLOPE_BASELINE}, limit 5°.{' '}
              </span>
            )}
            <span data-testid="approx-note">{approxText(customReady.horizon.computed)}.</span>
          </p>
        )}
        <Timeline
          answer={
            ready && answer ? (
              <p className="answer" data-testid="answer" data-state="ready" data-site-id={site.id} data-period-id={period.id}>
                <span className={`answer-line answer-sun${atCursor?.sun.lit ? '' : ' is-dark'}`}>{answer.sun}</span>
                <span className="answer-line answer-comms">{answer.comms}</span>
              </p>
            ) : (
              <AnswerPending state={results} siteName={site.name} />
            )
          }
          startMs={ctxStart}
          endMs={ctxEnd}
          missionStartMs={period.startMs}
          missionEndMs={period.endMs}
          missionLabel={`${missionName}, ${missionDays} ${missionDays === 1 ? 'day' : 'days'}`}
          cursorMs={cursor}
          sun={context.status === 'ready' ? context.results.sun : null}
          comms={context.status === 'ready' ? context.results.comms : null}
          valueText={valueText}
          tools={
            <>
              {webgl && (
                <span className="tool-wrap">
                  <button
                    ref={viewBtn}
                    type="button"
                    className="tool"
                    data-testid="view"
                    data-menu-trigger=""
                    aria-haspopup="menu"
                    aria-expanded={menu === 'view'}
                    onClick={() => setMenu(menu === 'view' ? null : 'view')}
                  >
                    View
                  </button>
                  {menu === 'view' && <ViewMenu label="View" testId="view-menu" className="is-anchored" items={viewItems} onClose={closeMenu} />}
                </span>
              )}
              <button type="button" className="tool" data-testid="simulate" aria-pressed={playing} onClick={toggleSimulate}>
                {playing ? 'Pause' : 'Simulate'}
              </button>
            </>
          }
          sim={
            simMode
              ? {
                  speed,
                  onSpeed: setSpeed,
                  onReset: () => {
                    setPlaying(false)
                    patch({ t: period.startMs })
                  },
                }
              : null
          }
          onScrub={(ms) => patch({ t: snap(ms) })}
        />
        <footer className="foot">
          <p data-testid="foot-sources">
            {/* A custom site: the spacings capHorizon used (nothing while it computes); a prepared site: its fixed text. */}
            {custom ? (customReady ? `${footTerrain(customReady.horizon.computed)} · ` : '') : 'Terrain LOLA 20 m (160 m beyond 20 km) · '}
            ephemeris JPL DE440 ·{' '}
            <button type="button" className="link" onClick={() => patch({ drawer: 'sources' })}>
              how this is computed
            </button>
            {' · '}
            <button type="button" className="link" data-testid="docs-open" aria-haspopup="dialog" onClick={() => patch({ drawer: 'docs' })}>
              Docs
            </button>
            {' · '}
            <a className="link" href="/docs" data-testid="docs-page-link">
              Full documentation
            </a>
          </p>
          {!VALIDATED && (
            <p className="foot-sample" data-testid="sample-flag">
              {NOT_VALIDATED}
            </p>
          )}
        </footer>
      </div>

      {hs.drawer === 'search' && (
        <SearchPanel
          sites={sites}
          stations={stations}
          ids={ids}
          site={site}
          period={period}
          pois={poiData}
          // Selecting a site also shows the chosen groups on the scene (the layer stays as it was when none is chosen).
          onSelectSite={(id, groups) => patch({ site: id, view: 'site', drawer: null, ...(groups.length ? { poi: groups } : {}) })}
          // "Show" opens the point as a custom landing site at eye level, as opening a landing site does (U16).
          onShowPoi={(poi, groups) => {
            const id = customSiteId(poi.lat, poi.lon)
            const g = [...new Set([...(hs.poi ?? []), ...groups, poi.group])]
            patch(id ? { site: id, view: 'eye', drawer: null, poi: g } : { view: 'globe', drawer: null, poi: g })
          }}
          onClose={() => patch({ drawer: null })}
        />
      )}

      {hs.drawer === 'docs' && (
        <Suspense fallback={null}>
          <DocsView onClose={() => patch({ drawer: null })} />
        </Suspense>
      )}

      {(hs.drawer === 'details' || hs.drawer === 'finder' || hs.drawer === 'sources') && (
        <Drawer
          section={hs.drawer}
          site={site}
          customHorizon={customReady?.horizon ?? null}
          period={period}
          cursorMs={cursor}
          sites={sites}
          periods={periods}
          stations={stations}
          ids={ids}
          results={results}
          atCursor={atCursor}
          onChooseStations={() => {
            patch({ drawer: null })
            setPanelAtStations(true)
            setMenu('mission')
          }}
          onShowWindow={(startMs, days, landingMs) =>
            // open exactly the interval the finder scored: [landing, landing + days), not the landing day's midnight
            patch({ period: 'custom', from: startMs, days, t: landingMs, drawer: null })
          }
          onSwitch={(siteId, periodId) => patch({ site: siteId, period: periodId, from: null, t: null })}
          goal={hs.goal}
          missions={missions.list}
          onFindDates={(siteId) => patch({ site: siteId, drawer: 'finder' })}
          onCalculateFlight={calculateFlight}
          onClose={() => patch({ drawer: null })}
        />
      )}
    </div>
  )
}
