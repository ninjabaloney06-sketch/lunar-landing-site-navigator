// The 3D scene (C1's scene3d, through its contract only) plus the labels that sit on its objects:
// "Sun 1.2°" at the Sun, "Earth 4.8°" at Earth, "Landing site" at the mast top. A label is hidden whenever
// project() returns null or a point that is not visible. On the flight level the labels are Earth, Moon, the
// launchpad, the landing site and the two burns that shape the transfer (TLI, LOI).
import { useEffect, useRef, useState } from 'react'
import type { FlightPlan } from '../flight/types'
import { mountScene } from '../scene3d'
import type { FlightAnchor, SceneDeps, SceneHandle, SceneLevel, ScreenPoint } from '../scene3d'
import { fmtDeg } from './format'

/** What the flight level draws. `clock` is read on every animation frame, so playback never re-renders React. */
export interface FlightScene {
  plan: FlightPlan | null
  trueScale: boolean
  clock: { timeMs: number }
  viewKey: number // changes when the default flight view is asked for again
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

const FLIGHT_LABELS: FlightAnchor[] = ['earth', 'moon', 'arrival', 'pad', 'site', 'tli', 'loi']

export function SceneView({ deps, siteId, utcMs, view, sunEl, earthEl, flight, onUnavailable, onPick }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const handle = useRef<SceneHandle | null>(null)
  const pick = useRef(onPick)
  pick.current = onPick
  const sun = useRef<HTMLDivElement>(null)
  const earth = useRef<HTMLDivElement>(null)
  const site = useRef<HTMLDivElement>(null)
  const flightEls = useRef<Partial<Record<FlightAnchor, HTMLDivElement | null>>>({})
  const flightRef = useRef(flight)
  flightRef.current = flight
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
    h.setFlight(flightRef.current.plan, flightRef.current.trueScale)
    const offPick = h.onPick((lat, lon) => pick.current(lat, lon))
    let raf = 0
    const tick = () => {
      h.setFlightTime(flightRef.current.clock.timeMs)
      place(sun.current, h.project('sun'), have.current.sun)
      place(earth.current, h.project('earth'), have.current.earth)
      place(site.current, h.project('site'), true)
      for (const name of FLIGHT_LABELS) place(flightEls.current[name] ?? null, h.projectFlight(name), true)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      offPick()
      handle.current = null
      h.dispose()
    }
  }, [deps, onUnavailable])

  useEffect(() => {
    handle.current?.setLevel(view)
  }, [view])

  useEffect(() => {
    handle.current?.setFlight(flight.plan, flight.trueScale)
  }, [flight.plan, flight.trueScale])

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
        if (alive) setFailedFor(siteId)
      })
    return () => {
      alive = false
    }
  }, [deps, siteId, utcMs])

  const plan = flight.plan
  const tag = (name: FlightAnchor, text: string) => (
    <div ref={(el) => void (flightEls.current[name] = el)} className="obj" hidden>
      <div className="obj-tag" data-testid={`label-${name}`}>
        {text}
      </div>
    </div>
  )

  return (
    <>
      <div ref={host} className="scene" data-testid="scene" />
      {failedFor === siteId && view !== 'flight' && (
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
        {view === 'flight' && plan && (
          <>
            <div ref={(el) => void (flightEls.current.earth = el)} className="obj" hidden>
              <div className="obj-box obj-body" data-testid="label-flight-earth">
                <span className="obj-name">Earth</span>
              </div>
            </div>
            <div ref={(el) => void (flightEls.current.moon = el)} className="obj" hidden>
              <div className="obj-box obj-body" data-testid="label-flight-moon">
                <span className="obj-name">Moon</span>
              </div>
            </div>
            <div ref={(el) => void (flightEls.current.arrival = el)} className="obj" hidden>
              <div className="obj-box obj-body obj-ghost" data-testid="label-flight-arrival">
                Moon at arrival
              </div>
            </div>
            {tag('pad', plan.pad.name)}
            {tag('site', plan.target.name)}
            {tag('tli', 'TLI')}
            {tag('loi', 'LOI')}
          </>
        )}
      </div>
    </>
  )
}
