// Main screen (build-plan §5.1, Brief C2, Step 2-UI): the 3D scene with labels on its objects, three header
// controls (mission, date, Find better dates), the answer sentence, the timeline and one footer line.
// Two tabs share the stage: "Landing site" (the above) and "Flight plan" (the Earth-to-Moon trajectory for the
// mission's site and start date, with its own panel and playback bar).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadPeriods, loadSites, loadStations } from './data/load'
import { makeLoadFrame, useResults } from './data/results'
import type { ResultsState } from './data/results'
import type { Period, Site, Station } from './data/types'
import { NOT_VALIDATED, VALIDATED } from './data/validation'
import { DEFAULT_PAD_ID, LAUNCHPADS } from './flight/pads'
import type { LandingTarget } from './flight/types'
import { DEFAULT_VEHICLE_ID, VEHICLES } from './flight/vehicles'
import { webglAvailable } from './scene3d'
import {
  cleanName,
  COVERAGE_END_MS,
  COVERAGE_START_MS,
  DAY_MS,
  DEFAULT_DAYS,
  DEFAULT_PERIOD_ID,
  DEFAULT_MISSION_NAME,
  DEFAULT_SITE_ID,
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
import { SceneView } from './views/SceneView'
import type { FlightScene } from './views/SceneView'
import { Timeline } from './views/Timeline'
import { fmtCoords, fmtDateTime, fmtDeg, fmtRange, fmtShort } from './views/format'
import { SLOPE_BASELINE, slopeOf } from './views/slope'
import { useFlight } from './views/useFlight'
import './styles/mission.css'

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
  const [menu, setMenu] = useState<null | 'mission' | 'date'>(null)
  const [panelAtStations, setPanelAtStations] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [webgl, setWebgl] = useState(() => webglAvailable())
  const missionBtn = useRef<HTMLButtonElement>(null)
  const dateBtn = useRef<HTMLButtonElement>(null)

  const site = sites.find((s) => s.id === hs.site) ?? sites.find((s) => s.id === DEFAULT_SITE_ID) ?? sites[0]
  const missionName = hs.name ?? DEFAULT_MISSION_NAME

  const period: ViewPeriod = useMemo(() => {
    if (hs.period === 'custom' && hs.from !== null) {
      const end = Math.min(hs.from + hs.days * DAY_MS, COVERAGE_END_MS)
      // A period that does not start at 00:00 UTC (e.g. opened from the finder at the landing time) says so,
      // so the label does not suggest whole calendar days.
      const label = hs.from % DAY_MS === 0 ? fmtRange(hs.from, end) : `${fmtShort(hs.from)} – ${fmtShort(end)} UTC`
      return { id: 'custom', label, startMs: hs.from, endMs: end }
    }
    const p = periods.find((x) => x.id === hs.period) ?? periods.find((x) => x.id === DEFAULT_PERIOD_ID) ?? periods[0]
    if (!p) {
      const start = COVERAGE_START_MS
      return { id: 'custom', label: fmtRange(start, start + DEFAULT_DAYS * DAY_MS), startMs: start, endMs: start + DEFAULT_DAYS * DAY_MS }
    }
    const startMs = Date.parse(p.start_utc)
    const endMs = Date.parse(p.end_utc)
    return { id: p.id, label: fmtRange(startMs, endMs), startMs, endMs }
  }, [hs.period, hs.from, hs.days, periods])

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
  const missionDays = Math.round((period.endMs - period.startMs) / DAY_MS)
  const slope = slopeOf(site)
  const idx = Math.round((cursor - period.startMs) / STEP_MS)
  const atCursor = ready ? (results.results.series.samples[idx] ?? null) : null
  const answer = ready ? results.results.answerAt(cursor) : null

  // ---------- Flight plan tab: launchpad → this mission's site, touching down at the mission start ----------
  const inFlight = hs.view === 'flight'
  const pad = LAUNCHPADS.find((x) => x.id === hs.pad) ?? LAUNCHPADS.find((x) => x.id === DEFAULT_PAD_ID) ?? LAUNCHPADS[0]
  const vehicle = VEHICLES.find((x) => x.id === hs.rocket) ?? VEHICLES.find((x) => x.id === DEFAULT_VEHICLE_ID) ?? VEHICLES[0]
  const target: LandingTarget = useMemo(() => ({ id: site.id, name: site.name, latDeg: site.lat, lonDeg: site.lon }), [site])
  const flight = useFlight({ active: inFlight, pad, vehicle, target, landingMs: period.startMs, maxTransferDays: hs.tmax })
  const [trueScale, setTrueScale] = useState(false)
  const [flightViewKey, setFlightViewKey] = useState(0)
  const flightScene: FlightScene = useMemo(
    () => ({ plan: flight.plan, trueScale, clock: flight.clock, viewKey: flightViewKey }),
    [flight.plan, flight.clock, trueScale, flightViewKey],
  )

  const deps = useMemo(() => ({ sites, loadFrame: makeLoadFrame(sites) }), [sites])
  const onUnavailable = useCallback(() => setWebgl(false), [])

  const closeMenu = useCallback((focus = false) => {
    setMenu((m) => {
      if (focus) (m === 'date' ? dateBtn : missionBtn).current?.focus()
      return null
    })
  }, [])
  const closeMenuQuiet = useCallback(() => closeMenu(false), [closeMenu])

  // Play: one 30-minute step every 50 ms until the period ends.
  useEffect(() => {
    if (!playing) return
    if (inFlight || cursor >= lastStep) {
      setPlaying(false)
      return
    }
    const id = window.setTimeout(() => patch({ t: cursor + STEP_MS }), 50)
    return () => window.clearTimeout(id)
  }, [playing, inFlight, cursor, lastStep, patch])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) || t.isContentEditable) return
      if (e.key === 'Escape') {
        if (menu) closeMenu(true)
        else if (hs.drawer) patch({ drawer: null })
        else patch({ view: inFlight ? 'site' : 'globe' })
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
  }, [menu, hs.drawer, hs.view, inFlight, flight, cursor, snap, patch, closeMenu])

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
  // Any other point on the surface matches no site and is ignored (no arbitrary coordinates before step 7).
  const onPick = useCallback(
    (lat: number, lon: number) => {
      const hit = sites.find((s) => Math.abs(s.lat - lat) < 1e-9 && Math.abs(s.lon - lon) < 1e-9)
      if (hit) patch({ site: hit.id, view: 'site' })
    },
    [sites, patch],
  )

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
          />
        ) : (
          <div className="fallback" data-testid="fallback">
            {inFlight ? (
              <p className="quiet">The flight view needs WebGL, which this browser does not provide. The flight plan's numbers are not affected.</p>
            ) : (
              <>
                <HorizonStrip horizon={ready ? results.results.series.horizon : null} sample={atCursor} height={220} className="strip-main" />
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
            />
          )}
          {inFlight && menu === null && (
            <FlightPanel
              pads={LAUNCHPADS}
              padId={pad.id}
              onPad={(id) => patch({ pad: id === DEFAULT_PAD_ID ? null : id })}
              vehicles={VEHICLES}
              vehicleId={vehicle.id}
              onVehicle={(id) => patch({ rocket: id === DEFAULT_VEHICLE_ID ? null : id })}
              target={target}
              landingMs={period.startMs}
              maxTransferDays={hs.tmax}
              onMaxTransferDays={(tmax) => patch({ tmax })}
              status={flight.status}
              trueScale={trueScale}
              onTrueScale={setTrueScale}
              onChangeSite={() => {
                setPanelAtStations(false)
                setMenu('mission')
              }}
              onSeek={flight.seek}
            />
          )}
        </div>
        <div className="actions">
          <div className="tabs" role="tablist" aria-label="View">
            <button
              type="button"
              role="tab"
              className="tab"
              data-testid="tab-site"
              aria-selected={!inFlight}
              onClick={() => inFlight && patch({ view: 'site' })}
            >
              Landing site
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              data-testid="tab-flight"
              aria-selected={inFlight}
              onClick={() => {
                setMenu(null)
                setPlaying(false)
                patch({ view: 'flight', drawer: null })
              }}
            >
              Flight plan
            </button>
          </div>
          <button type="button" className="find" hidden={inFlight} onClick={() => patch({ drawer: 'finder' })}>
            Find better dates
          </button>
          {/* Opens the details panel the answer text used to open (ninja + Bene, 14 Nov). */}
          <button
            type="button"
            hidden={inFlight}
            className="details-btn"
            data-testid="details"
            aria-label="Details"
            title="Details"
            aria-haspopup="dialog"
            aria-expanded={hs.drawer !== null}
            onClick={() => patch({ drawer: 'details' })}
          >
            <Icon name="settings" />
          </button>
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
              onPlaying={flight.setPlaying}
              onSeek={flight.seek}
              onSpeed={flight.setSpeed}
            />
          )}
          <footer className="foot">
            <p>
              Patched conics, impulsive burns · ephemeris JPL DE440 · drag to turn, scroll to zoom ·{' '}
              <button type="button" className="link" onClick={() => setFlightViewKey((k) => k + 1)}>
                reset view
              </button>
            </p>
            <p className="foot-sample" data-testid="flight-flag">
              Planning estimate — not validated
            </p>
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
        <Timeline
          answer={
            ready && answer ? (
              <p className="answer" data-testid="answer" data-state="ready" data-site-id={site.id} data-period-id={period.id}>
                <span className="answer-line answer-sun">{answer.sun}</span>
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
          onScrub={(ms) => patch({ t: snap(ms) })}
        />
        <footer className="foot">
          <p>
            Terrain LOLA 20 m (160 m beyond 20 km) · ephemeris JPL DE440 ·{' '}
            <button type="button" className="link" onClick={() => patch({ drawer: 'sources' })}>
              how this is computed
            </button>
          </p>
          {!VALIDATED && (
            <p className="foot-sample" data-testid="sample-flag">
              {NOT_VALIDATED}
            </p>
          )}
        </footer>
      </div>

      {hs.drawer && (
        <Drawer
          section={hs.drawer}
          site={site}
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
          onClose={() => patch({ drawer: null })}
        />
      )}
    </div>
  )
}
