// Main screen (build-plan §5.1, Brief C2): the 3D scene with labels on its objects, three header controls
// (site name, date, Find better dates), the answer sentence, the timeline and one footer line.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadPeriods, loadSites, loadStations } from './data/load'
import { makeLoadFrame, NUMBERS_VALIDATED, useResults } from './data/results'
import type { ResultsState } from './data/results'
import type { Period, Site, Station } from './data/types'
import { webglAvailable } from './scene3d'
import {
  COVERAGE_END_MS,
  COVERAGE_START_MS,
  DAY_MS,
  DEFAULT_DAYS,
  DEFAULT_PERIOD_ID,
  DEFAULT_SITE_ID,
  STEP_MS,
  useHashState,
} from './state'
import { DateMenu } from './views/DateMenu'
import { Drawer } from './views/Drawer'
import type { ViewPeriod } from './views/Drawer'
import { HorizonStrip } from './views/HorizonStrip'
import { SceneView } from './views/SceneView'
import { SiteMenu } from './views/SiteMenu'
import { Timeline } from './views/Timeline'
import { fmtCoords, fmtDateTime, fmtRange } from './views/format'

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

/** The answer slot while results load or fail: never the previous selection's sentence (UX-03). */
function AnswerPending({ state, siteName }: { state: ResultsState; siteName: string }) {
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
  const [menu, setMenu] = useState<null | 'site' | 'date'>(null)
  const [playing, setPlaying] = useState(false)
  const [webgl, setWebgl] = useState(() => webglAvailable())
  const siteBtn = useRef<HTMLButtonElement>(null)
  const dateBtn = useRef<HTMLButtonElement>(null)

  const site = sites.find((s) => s.id === hs.site) ?? sites.find((s) => s.id === DEFAULT_SITE_ID) ?? sites[0]

  const period: ViewPeriod = useMemo(() => {
    if (hs.period === 'custom' && hs.from !== null) {
      const end = Math.min(hs.from + hs.days * DAY_MS, COVERAGE_END_MS)
      return { id: 'custom', label: fmtRange(hs.from, end), startMs: hs.from, endMs: end }
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
  const idx = Math.round((cursor - period.startMs) / STEP_MS)
  const sample = ready ? (results.results.series.samples[idx] ?? null) : null
  const answer = ready ? results.results.answerAt(cursor) : null
  const isSample = !NUMBERS_VALIDATED || (ready && (results.results.source === 'sample' || !!answer?.sample))

  const deps = useMemo(() => ({ sites, loadFrame: makeLoadFrame(sites) }), [sites])
  const onUnavailable = useCallback(() => setWebgl(false), [])

  const closeMenu = useCallback((focus = false) => {
    setMenu((m) => {
      if (focus) (m === 'date' ? dateBtn : siteBtn).current?.focus()
      return null
    })
  }, [])
  const closeMenuQuiet = useCallback(() => closeMenu(false), [closeMenu])

  // Play: one 30-minute step every 50 ms until the period ends.
  useEffect(() => {
    if (!playing) return
    if (cursor >= lastStep) {
      setPlaying(false)
      return
    }
    const id = window.setTimeout(() => patch({ t: cursor + STEP_MS }), 50)
    return () => window.clearTimeout(id)
  }, [playing, cursor, lastStep, patch])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) || t.isContentEditable) return
      if (e.key === 'Escape') {
        if (menu) closeMenu(true)
        else if (hs.drawer) patch({ drawer: null })
        else patch({ view: 'globe' })
        return
      }
      if (menu || hs.drawer || e.metaKey || e.ctrlKey || e.altKey) return
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
  }, [menu, hs.drawer, hs.view, cursor, snap, patch, closeMenu])

  const toggleStation = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : stations.map((s) => s.id).filter((x) => x === id || ids.includes(x))
    if (next.length === 0) return
    patch({ st: next.length === stations.length ? null : next })
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
    if (sample && ready) {
      parts.push(sample.sun.lit ? 'sunlit' : 'dark')
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
            sunEl={sample ? sample.sun.el : null}
            earthEl={sample ? sample.earth.el : null}
            onUnavailable={onUnavailable}
          />
        ) : (
          <div className="fallback" data-testid="fallback">
            <HorizonStrip horizon={ready ? results.results.series.horizon : null} sample={sample} height={220} className="strip-main" />
            <p className="quiet">The 3D view needs WebGL, which this browser does not provide. The horizon strip shows the same sky.</p>
          </div>
        )}
      </div>

      <header className="top">
        <div className="place">
          <h1 className="site-h">
            <button
              ref={siteBtn}
              type="button"
              className="site-name"
              data-testid="site-name"
              data-site-id={site.id}
              data-menu-trigger=""
              aria-haspopup="dialog"
              aria-expanded={menu === 'site'}
              onClick={() => setMenu(menu === 'site' ? null : 'site')}
            >
              {site.name}
            </button>
          </h1>
          {site.label && <p className="site-label">{site.label}</p>}
          <p className="coords mono" data-testid="coords">
            {fmtCoords(site.lat, site.lon)}
          </p>
          <button
            ref={dateBtn}
            type="button"
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
          {menu === 'site' && (
            <SiteMenu
              sites={sites}
              currentId={site.id}
              points={hs.pts}
              onSelect={(id) => {
                setMenu(null)
                patch({ site: id, view: 'site' })
                siteBtn.current?.focus()
              }}
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
        </div>
        <button type="button" className="find" onClick={() => patch({ drawer: 'finder' })}>
          Find better dates
        </button>
      </header>

      <div className="bottom">
        {ready && answer ? (
          <button
            type="button"
            className="answer"
            data-testid="answer"
            data-state="ready"
            data-site-id={site.id}
            data-period-id={period.id}
            data-source={results.results.source}
            onClick={() => patch({ drawer: 'details' })}
          >
            <span className="answer-line answer-sun">{answer.lines.sun}</span>
            <span className="answer-line answer-comms">{answer.lines.comms}</span>
          </button>
        ) : (
          <AnswerPending state={results} siteName={site.name} />
        )}
        <Timeline
          startMs={period.startMs}
          endMs={period.endMs}
          cursorMs={cursor}
          sun={ready ? results.results.sun : null}
          comms={ready ? results.results.comms : null}
          valueText={valueText}
          onScrub={(ms) => patch({ t: snap(ms) })}
        />
        <footer className="foot">
          <p>
            Terrain LOLA 20 m · ephemeris JPL DE440 ·{' '}
            <button type="button" className="link" onClick={() => patch({ drawer: 'sources' })}>
              how this is computed
            </button>
          </p>
          {isSample && (
            <p className="foot-sample" data-testid="sample-flag">
              sample values
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
          sample={sample}
          isSample={isSample}
          onToggleStation={toggleStation}
          onShowWindow={(startMs, days, landingMs) =>
            patch({ period: 'custom', from: dayStart(startMs), days, t: landingMs, drawer: null })
          }
          onSwitch={(siteId, periodId) => patch({ site: siteId, period: periodId, from: null, t: null })}
          onClose={() => patch({ drawer: null })}
        />
      )}
    </div>
  )
}
