// Rocket flight menu: the docked side panel of the flight view. First the answer (maximum payload, whether every
// stage has enough propellant, when it launches, lands and returns, the Δv after launch), then the inputs with a
// label, unit and one-line hint each, then named sections that open and close: the notes, the events, the
// propellant budget, the flight facts, the view and its legend, the explanations (FlightExplain) and how the
// numbers are made. Summary mode shows the decision values; full data mode opens the breakdown and the long texts.
// Presentational only: the mission is computed outside, and the status it is given drives the loading and error text.
import { energyMultiplier, fmtFactor } from '../flight/energyBaseline'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import '../styles/flight.css'
import type { ArchitectureSpec } from '../flight/hardware'
import type { LandingTarget, Launchpad, MissionPlan } from '../flight/types'
import { DESIGNS, SLS_LANDERS, designOf } from '../flight/designs'
import { ARCHITECTURES, SPACECRAFT } from '../flight/spacecraft'
import { useFullData } from './advanced'
import { Glossary, HaloOrbit, LandingWays, SurfaceStay, rememberPlan } from './FlightExplain'
import { fmtCoords, fmtDeg } from './format'
import { fmtDayTime, fmtDays, fmtDuration, fmtDv, fmtKm, fmtKms, fmtMetres, fmtTonnes, fmtUtc } from './flightFormat'
import { useFlightAnalysis } from './flightAnalysis'
import { Abbr } from './flightGlossary'
import { AnalysisActions, DispersionDetails, PayloadDetails, PayloadLine, RouteDetails, Unvalidated } from './flightResult'
import { NOT_VALIDATED_TEXT, SHORT_MEANING, errorText, lowerBoundPropellant, lowerBoundShort, propellantStatus, shortElementsOf } from './flightResultText'
import { FullDataSwitch } from './FullDataSwitch'

export type MissionStatus = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; plan: MissionPlan }

export interface ArchitectureChoice {
  id: string
  name: string
  note: string
  available: boolean
  unavailableReason: string | null
}

export interface FlightPanelProps {
  architectures: ArchitectureChoice[]
  architectureId: string
  onArchitecture(id: string): void
  rendezvous: ArchitectureSpec['rendezvous'] // where capsule and lander meet in the chosen design
  pads: Launchpad[]
  padId: string // an id from pads, or 'custom'
  onPad(id: string): void
  customPad: { latDeg: number; lonDeg: number } | null
  onCustomPad(p: { latDeg: number; lonDeg: number }): void
  target: LandingTarget // the landing point in use
  siteMode: 'mission' | 'custom' // the mission's site, or free coordinates
  onSiteMode(m: 'mission' | 'custom'): void
  onCustomSite(p: { latDeg: number; lonDeg: number }): void
  earliestTouchdownMs: number // the mission start
  surfaceStayDays: number // the stay asked for; the plan's own stay can differ
  onSurfaceStayDays(v: number): void
  missionDays?: number // length of the mission dates, days: offered as the surface stay when it differs
  /** The stay follows the mission's length (no stay of the user's own); capped: the mission is outside 0.5–30 days. */
  stayFromMission?: { days: number; capped: boolean } | null
  surfaceStay: ArchitectureSpec['surfaceStay'] // what the chosen design documents about its stay, when it does
  returnWindowDays: number // 0 = leave when the stay ends; 7 or 14 = cheapest departure within that many days after
  onReturnWindowDays(v: number): void
  maxTransferDays: number | null
  onMaxTransferDays(v: number | null): void
  status: MissionStatus
  trueScale: boolean
  onTrueScale(v: boolean): void
  picking: 'pad' | 'site' | null // the 3D view is waiting for a click on Earth (pad) or on the Moon (site)
  onPicking(p: 'pad' | 'site' | null): void
  onChangeSite(): void // opens the landing-site picker
  onSeek(utcMs: number): void // jump the playback to an event
  collapsed: boolean
  onCollapsed(v: boolean): void
  missionName: string
  onSaveMission(): void
  missionSaved: boolean // the current mission is already in the saved list
  canSaveMission: boolean // false when the list is full
  /** Back to the landing-site view (the menu's own way out of the flight view). */
  onClose?(): void
}

// Worded as the Mission menu's flight line words a saved mission's cap ("transfer at most 3 days 12 h").
const TRANSFER_LIMITS: { value: string; label: string }[] = [
  { value: '4.5', label: 'Transfer at most 4 days 12 h' },
  { value: '4', label: 'Transfer at most 4 days' },
  { value: '3.5', label: 'Transfer at most 3 days 12 h' },
  { value: '3', label: 'Transfer at most 3 days' },
  { value: '2.5', label: 'Transfer at most 2 days 12 h' },
]

const RETURN_WINDOWS: { value: number; label: string }[] = [
  { value: 0, label: 'Leave when the stay ends' },
  { value: 7, label: 'Cheapest departure within 7 days after' },
  { value: 14, label: 'Cheapest departure within 14 days after' },
]

const STAY_DAYS = { min: 0.5, max: 30, step: 0.5 }

const MINUS = '−'

interface LatLon {
  latDeg: number
  lonDeg: number
}

// ---------- the panel ends above the playback bar ----------

/** The panel's height: down to the playback bar (no fixed height that cuts it mid-line while room is left), and
 *  on a phone at most 36 % of the screen, so the trajectory stays in view. Measured, because the bar's height
 *  depends on the plan and the window. */
function usePanelFit() {
  const ref = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      const bar = document.querySelector('.flight-bottom')
      const bottom = bar ? bar.getBoundingClientRect().top : window.innerHeight
      const top = el.getBoundingClientRect().top
      const room = bottom - top - 12
      const narrow = window.innerWidth <= 640
      const max = Math.max(160, narrow ? Math.min(room, window.innerHeight * 0.36) : room)
      el.style.maxHeight = `${Math.round(max)}px`
    }
    fit()
    window.addEventListener('resize', fit)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    const bar = document.querySelector('.flight-bottom')
    if (bar) ro?.observe(bar)
    return () => {
      window.removeEventListener('resize', fit)
      ro?.disconnect()
    }
  })
  return ref
}

// ---------- a section that opens and closes ----------

// Which sections are open, kept for the session: the panel is taken down while the Mission panel is open and when
// it is hidden, and it should come back the way the reader left it.
const openSections = new Map<string, boolean>()

interface SectionProps {
  id: string
  title: string
  count?: string // a short figure beside the title: how many notes, how many events
  defaultOpen?: boolean
  /** A section of data (not an explanation): open by default in full data mode. */
  data?: boolean
  children: ReactNode
}

function Section({ id, title, count, defaultOpen = false, data = false, children }: SectionProps) {
  const [full] = useFullData()
  const [open, setOpen] = useState(() => openSections.get(id) ?? (defaultOpen || (data && full)))
  // Switching full data on or off opens or closes every data section; the reader's own choice after that.
  const [seenFull, setSeenFull] = useState(full)
  if (data && full !== seenFull) {
    setSeenFull(full)
    openSections.delete(id)
    setOpen(full)
  }
  return (
    <details
      className="flight-sec"
      open={open}
      data-section={id}
      onToggle={(e) => {
        const next = e.currentTarget.open
        openSections.set(id, next)
        setOpen(next)
      }}
    >
      <summary>
        <span className="flight-sec-title">
          <Abbr>{title}</Abbr>
        </span>
        {count && <span className="flight-sec-count mono">{count}</span>}
      </summary>
      {open && <div className="flight-sec-body">{children}</div>}
    </details>
  )
}

export function FlightPanel(p: FlightPanelProps) {
  const { architectureId, rendezvous, pads, padId, target, siteMode, status, trueScale, picking, collapsed } = p
  const uid = useId()
  const [full] = useFullData()
  const plan = status.state === 'ready' ? status.plan : null
  const fitRef = usePanelFit()

  // Remembered per kind of design, so the explanations can set a halo-orbit plan beside a low-orbit one.
  useEffect(() => {
    if (plan) rememberPlan(rendezvous, plan)
  }, [plan, rendezvous])

  const head = (
    <div className="mp-head flight-head">
      <h2 id="flight-title" className="mp-title">
        Rocket flight
      </h2>
      {!collapsed && <FullDataSwitch className="flight-full" />}
      <button
        type="button"
        className="link flight-collapse"
        aria-expanded={!collapsed}
        data-testid="flight-collapse"
        onClick={() => p.onCollapsed(!collapsed)}
      >
        {collapsed ? 'Show' : 'Hide'}
      </button>
    </div>
  )

  if (collapsed) {
    return (
      <section className="popover menu flight-panel is-collapsed" aria-labelledby="flight-title" data-testid="flight-panel">
        {head}
      </section>
    )
  }

  const design = designOf(architectureId)

  return (
    <section ref={fitRef} className="popover menu flight-panel" aria-labelledby="flight-title" data-testid="flight-panel">
      {head}
      <p className="flight-mission" data-testid="flight-mission">
        <strong>{p.missionName}</strong>
        <span className="quiet"> at </span>
        <span className="flight-site-name">{target.name}</span>
        {siteMode === 'mission' && (
          <>
            <span className="quiet" aria-hidden="true">
              {' · '}
            </span>
            <button type="button" className="link flight-change-site" onClick={p.onChangeSite}>
              change site
            </button>
          </>
        )}
        {p.onClose && (
          <>
            <span className="quiet" aria-hidden="true">
              {' · '}
            </span>
            <button type="button" className="link flight-close" data-testid="flight-close" onClick={p.onClose}>
              back to landing site
            </button>
          </>
        )}
      </p>

      {status.state === 'loading' && (
        <p className="menu-msg is-quiet flight-status" role="status">
          Planning the flight… this takes a few seconds.
        </p>
      )}
      {status.state === 'error' && <PlanError message={status.message} />}
      {plan && <ResultCard plan={plan} onSeek={p.onSeek} missionStartMs={p.earliestTouchdownMs} missionDays={p.missionDays} fromMission={!!p.stayFromMission} />}
      {plan && <AnalysisSections />}

      <fieldset className="flight-designs" data-testid="flight-designs">
        <legend className="mp-label">Rocket and lander</legend>
        <p className="quiet flight-hint flight-designs-hint">Launch vehicle · capsule · lander of the mission design.</p>
        {DESIGNS.map((d) => {
          const on = d.id === design.id
          return (
            <label key={d.id} className={`flight-design${on ? ' is-on' : ''}`} data-design={d.id}>
              <span className="flight-design-head">
                <input
                  type="radio"
                  name={`${uid}-design`}
                  checked={on}
                  data-testid={`flight-design-${d.id}`}
                  onChange={() => p.onArchitecture(d.architectureIds[0])}
                />
                <strong>
                  <Abbr>{d.title}</Abbr>
                </strong>
              </span>
              <span className="quiet flight-design-stack">
                <Abbr>{d.stack}</Abbr>
              </span>
              {full && (
                <ul className="flight-bullets">
                  {d.bullets.map((b) => (
                    <li key={b}>
                      <Abbr>{b}</Abbr>
                    </li>
                  ))}
                </ul>
              )}
            </label>
          )
        })}
        {design.id === 'sls' && (
          <div className="tabs flight-lander" role="radiogroup" aria-label="Lander">
            {SLS_LANDERS.map((l) => (
              <button
                key={l.architectureId}
                type="button"
                role="radio"
                className="tab"
                aria-checked={architectureId === l.architectureId}
                data-testid={`flight-lander-${l.architectureId}`}
                onClick={() => p.onArchitecture(l.architectureId)}
              >
                <Abbr>{l.label}</Abbr>
              </button>
            ))}
          </div>
        )}
        {design.id === 'sls' && (
          <p className="quiet flight-hint flight-designs-hint">
            Lander: the Human Landing System (<Abbr>HLS</Abbr>) that takes two of the crew down and back.
          </p>
        )}
      </fieldset>

      <div className="mp-fields flight-fields">
        <div className="mp-field">
          <label className="mp-label" htmlFor={`${uid}-pad`}>
            Launchpad
          </label>
          <div className="flight-control">
            <select id={`${uid}-pad`} className="field" value={padId} data-testid="flight-pad" onChange={(e) => p.onPad(e.target.value)}>
              {pads.map((x) => (
                <option key={x.id} value={x.id}>
                  {`${x.name} · ${x.site}`}
                </option>
              ))}
              <option value="custom">Other coordinates</option>
            </select>
            <p className="quiet flight-hint">Launch site on Earth where the ascent starts.</p>
          </div>
        </div>
        <div className="mp-field">
          <span className="mp-label">Landing</span>
          <div className="flight-control">
            <span className="flight-line">
              not before{' '}
              <span className="mono">
                <Abbr>{fmtUtc(p.earliestTouchdownMs)}</Abbr>
              </span>
            </span>
            <p className="quiet flight-hint">The mission start; change it in the Mission menu.</p>
          </div>
        </div>
        <div className="mp-field">
          <label className="mp-label" htmlFor={`${uid}-stay`}>
            Surface stay
          </label>
          <div className="flight-control">
            <StayField id={`${uid}-stay`} value={p.surfaceStayDays} onChange={p.onSurfaceStayDays} />
            <p className="quiet flight-hint">Touchdown to liftoff, 0.5 to 30 days.</p>
            {p.stayFromMission?.capped && p.missionDays !== undefined && (
              <p className="quiet" data-testid="flight-stay-capped">
                Your mission dates are {p.missionDays} {p.missionDays === 1 ? 'day' : 'days'}; the stay is capped at {Number(p.stayFromMission.days.toFixed(1))} days, the
                limit of this flight plan.
              </p>
            )}
            {!p.stayFromMission && p.missionDays !== undefined && Math.abs(Math.min(30, p.missionDays) - p.surfaceStayDays) > 0.05 && (
              <p className="quiet" data-testid="flight-stay-mission">
                Your mission dates are {p.missionDays} {p.missionDays === 1 ? 'day' : 'days'}; this flight stays {Number(p.surfaceStayDays.toFixed(1))} days, as you set it.{' '}
                <button type="button" className="btn" data-testid="flight-stay-use-mission" onClick={() => p.onSurfaceStayDays(Math.min(30, p.missionDays!))}>
                  Use {Math.min(30, p.missionDays)} days
                </button>
              </p>
            )}
            {plan && Math.abs(plan.facts.surfaceStayDays - p.surfaceStayDays) > 0.05 && (
              <p className="quiet" data-testid="flight-stay-planned">
                flown: <span className="mono">{fmtDays(plan.facts.surfaceStayDays, 2)}</span>
                {rendezvous === 'nrho' ? ' (the lander leaves once per halo-orbit revolution, every 6.56 days)' : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flight-save">
        <button type="button" className="btn" data-testid="flight-save-mission" disabled={p.missionSaved || !p.canSaveMission} onClick={p.onSaveMission}>
          Save mission
        </button>
        <span className="quiet" aria-live="polite" data-testid="flight-save-hint">
          {p.missionSaved
            ? 'Saved: see the mission table under Details.'
            : p.canSaveMission
              ? 'Keeps site, dates, launchpad, rocket, stay and transfer limit.'
              : 'The mission list is full: remove a mission under Details to save this one.'}
        </span>
      </div>

      {plan && <MissionResult plan={plan} onSeek={p.onSeek} />}

      <Section id="advanced" title="More inputs: launch and landing point, return, transfer">
        <div className="mp-fields flight-fields">
          {padId === 'custom' && (
            <div className="mp-field">
              <span className="mp-label">Launch point</span>
              <div className="flight-control">
                <CoordFields value={p.customPad} testId="flight-pad" onChange={p.onCustomPad} />
                <button
                  type="button"
                  className="link flight-pick"
                  aria-pressed={picking === 'pad'}
                  data-testid="flight-pick-pad"
                  onClick={() => p.onPicking(picking === 'pad' ? null : 'pad')}
                >
                  Pick on Earth
                </button>
                <p className="quiet flight-hint">Latitude and longitude in degrees, or pick a point on Earth.</p>
              </div>
            </div>
          )}
          <div className="mp-field">
            <span className="mp-label" id={`${uid}-site`}>
              Landing point
            </span>
            <div className="flight-control" role="radiogroup" aria-labelledby={`${uid}-site`}>
              <label className="check mp-radio">
                <input type="radio" name={`${uid}-site-mode`} checked={siteMode === 'mission'} data-testid="flight-site-mission" onChange={() => p.onSiteMode('mission')} />
                <span>The mission's site</span>
              </label>
              <label className="check mp-radio">
                <input type="radio" name={`${uid}-site-mode`} checked={siteMode === 'custom'} data-testid="flight-site-custom" onChange={() => p.onSiteMode('custom')} />
                <span>Other coordinates</span>
              </label>
              {siteMode === 'custom' && (
                <>
                  <CoordFields value={target} testId="flight-site" onChange={p.onCustomSite} />
                  <button
                    type="button"
                    className="link flight-pick"
                    aria-pressed={picking === 'site'}
                    data-testid="flight-pick-site"
                    onClick={() => p.onPicking(picking === 'site' ? null : 'site')}
                  >
                    Pick on the Moon
                  </button>
                </>
              )}
              <p className="flight-used mono" data-testid="flight-site-coords">
                {fmtCoords(target.latDeg, target.lonDeg)}
              </p>
              <p className="quiet flight-hint">Where the lander touches down.</p>
            </div>
          </div>
          {picking && (
            <p className="quiet flight-hint" role="status">
              Click a point on {picking === 'pad' ? 'Earth' : 'the Moon'} in the 3D view.
            </p>
          )}
          <div className="mp-field">
            <label className="mp-label" htmlFor={`${uid}-return`}>
              Leaving the Moon
            </label>
            <div className="flight-control">
            <select
              id={`${uid}-return`}
              className="field"
              value={String(p.returnWindowDays)}
              data-testid="flight-return"
              onChange={(e) => p.onReturnWindowDays(Number(e.target.value))}
            >
              {RETURN_WINDOWS.map((x) => (
                <option key={x.value} value={String(x.value)}>
                  {x.label}
                </option>
              ))}
            </select>
            <p className="quiet flight-hint">When the crew leaves for Earth after the stay.</p>
            </div>
          </div>
          <div className="mp-field">
            <label className="mp-label" htmlFor={`${uid}-transfer`}>
              Transfer limit
            </label>
            <div className="flight-control">
            <select
              id={`${uid}-transfer`}
              className="field"
              value={p.maxTransferDays === null ? '' : String(p.maxTransferDays)}
              data-testid="flight-transfer"
              onChange={(e) => p.onMaxTransferDays(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">Minimum-energy transfer (about 5 days)</option>
              {TRANSFER_LIMITS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <p className="quiet flight-hint">
              Longest flight from <Abbr>TLI</Abbr> to the Moon; a shorter one needs more <Abbr>Δv</Abbr>.
            </p>
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={trueScale} onChange={(e) => p.onTrueScale(e.target.checked)} />
            <span>True scale (untick: Earth 3×, Moon 4× for visibility)</span>
          </label>
        </div>
      </Section>

      <Section id="view" title="Reading the 3D view">
        <ul className="plain flight-legend" aria-label="Legend">
          <li>
            <span className="flight-key is-capsule" aria-hidden="true" />
            <span>Capsule: glowing point</span>
          </li>
          <li>
            <span className="flight-key is-lander" aria-hidden="true" />
            <span>Lander: diamond (around the capsule while docked)</span>
          </li>
          <li>
            <span className="flight-key is-burn" aria-hidden="true" />
            <span>Engine burn: ring at ignition, wide orange line while firing</span>
          </li>
          <li>
            <span className="flight-key is-path" aria-hidden="true" />
            <span>Flight path: bright behind the craft, dim ahead</span>
          </li>
          <li>
            <span className="flight-key is-ring" aria-hidden="true" />
            <span>Dashed ring: the Moon at the capsule's arrival</span>
          </li>
        </ul>
      </Section>

      <Section id="halo" title="The halo orbit: why it looks unusual">
        <HaloOrbit plan={plan} rendezvous={rendezvous} />
      </Section>
      <Section id="landing" title="Apollo and Artemis: two ways to land">
        <LandingWays plan={plan} rendezvous={rendezvous} />
      </Section>
      <Section id="stay" title="Time on the surface">
        <SurfaceStay plan={plan} rendezvous={rendezvous} askedDays={p.surfaceStayDays} stay={p.surfaceStay} />
      </Section>
      <Section id="glossary" title="Abbreviations">
        <Glossary />
      </Section>

      <Section id="how" title="How this is computed">
        {full ? (
          <ul className="flight-bullets quiet">
            <li>Every phase integrated numerically with the engines' thrust and propellant flow</li>
            <li>
              Gravity of Earth (with its oblateness, <Abbr>J2</Abbr>), the Moon and the Sun; positions from <Abbr>JPL DE440</Abbr>
            </li>
            <li>Launch time, azimuth, burn lengths and ignition points searched for the least propellant</li>
            <li>
              Max payload: the rocket equation per stage on the plan's burns, every element loaded with what it needs plus a 3 % reserve, the
              error a root sum of squares of one-at-a-time changes (validated by the science lead: statement of 15 Nov 2026; see record)
            </li>
            <li>
              Cheapest route: one full plan per option (landing day and transfer limit), ranked by total propellant (validated by the
              science lead: statement of 15 Nov 2026; see record)
            </li>
            <li>
              Landing dispersion: 200 descents flown with small errors in thrust, specific impulse (<Abbr>Isp</Abbr>), pointing and launch time (validated
              by the science lead: statement of 15 Nov 2026; see record)
            </li>
            <li>
              Not modelled: the Moon's uneven gravity in the plans (its <Abbr>J2</Abbr> term is in the landing dispersion only), winds, engine
              transients, atmospheric entry after Entry Interface
            </li>
          </ul>
        ) : (
          <ul className="flight-bullets quiet">
            <li>Every phase integrated numerically with thrust and propellant flow</li>
            <li>
              Gravity of Earth, Moon and Sun; positions from <Abbr>JPL DE440</Abbr>
            </li>
            <li>Launch time, azimuth and burns searched for least propellant</li>
            <li>Payload, cheapest route, dispersion: validated by the science lead (statement of 15 Nov 2026; see record)</li>
          </ul>
        )}
        {full && plan && plan.sources.length > 0 && (
          <ul className="plain flight-sources">
            {plan.sources.map((s, i) => (
              <li key={`${i}-${s.url}`}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </section>
  )
}

// ---------- the result: the payload and the mission in three lines ----------

const dvAfterLaunchOf = (plan: MissionPlan) =>
  plan.events.reduce((sum, e) => (e.kind === 'burn' && e.id !== 'ascent' && e.dvKms !== null ? sum + e.dvKms : sum), 0)

/** The lander's propellant figure when the hardware data marks it as a lower bound (Blue Moon). */
const lowerBoundOf = (architectureId: string) => {
  const a = ARCHITECTURES.find((x) => x.id === architectureId)
  return lowerBoundPropellant(SPACECRAFT.find((x) => x.id === a?.landerId))
}

/** A time in the result: a button into the playback. */
function TimeLink({ ms, label, onSeek }: { ms: number; label: string; onSeek(utcMs: number): void }) {
  return (
    <button type="button" className="link mono flight-glance-time" aria-label={`Go to ${label}, ${fmtUtc(ms)}`} onClick={() => onSeek(ms)}>
      <Abbr>{fmtUtc(ms)}</Abbr>
    </button>
  )
}

/** The result, in the order a planner asks: how much can it carry (the payload line), is it feasible (propellant,
 *  coloured only when a stage is short: the plan's own threshold usedKg > capacityKg), when does it launch, land and
 *  return (buttons into the playback), and its Δv; then the two analyses the user can start. */
/** The energy multiplier, on top of the result as it was until 15 Nov 06:35 (restored on the team's request the same
 *  day): this mission's exhaust energy from the TLI on, over the same for the design's ideal landing point. */
function EnergyFactor({ plan }: { plan: MissionPlan }) {
  const m = energyMultiplier(plan)
  return (
    <details className="flight-energy" data-testid="flight-energy">
      <summary className="flight-factor">
        <span className="quiet">Energy multiplier</span>
        <span className="flight-factor-value mono" data-testid="flight-factor" data-factor={m ? m.factor.toFixed(4) : ''}>
          {m ? fmtFactor(m.factor) : '–'}
        </span>
      </summary>
      <ul className="flight-bullets">
        {m ? (
          <li data-testid="flight-factor-note">
            1.00× = this design's ideal landing point (<span className="mono">{fmtCoords(m.idealPoint.latDeg, m.idealPoint.lonDeg)}</span>); the
            costliest point on the Moon: {fmtFactor(m.worstOnGrid)}
          </li>
        ) : (
          <li>No baseline for this design in this build</li>
        )}
        <li className="quiet">
          Exhaust energy of every burn from <Abbr>TLI</Abbr> on, divided by the same for this design's cheapest landing point (reference
          mission: Launch Complex 39B at Kennedy Space Center, landing from 16 Aug 2027, the design's default stay, a grid of {m ? m.gridPoints : 108} points over the whole Moon).
        </li>
      </ul>
    </details>
  )
}

/** One line tying the flight's dates to the mission's (reported bug, 15 Nov: the launch, days before the landing, was
 *  read as the flight ignoring the mission dates). */
function MissionDatesLine({ plan, missionStartMs, missionDays, fromMission }: { plan: MissionPlan; missionStartMs: number; missionDays?: number; fromMission: boolean }) {
  const sameDay = Math.floor(plan.touchdownMs / 86_400_000) === Math.floor(missionStartMs / 86_400_000)
  const day = (ms: number) => fmtDayTime(ms).split(',')[0]
  return (
    <p className="flight-dates-line" data-testid="flight-dates-line">
      Lands {day(plan.touchdownMs)}
      {sameDay ? ', the first day of your mission' : ', the first landing chance after your mission starts'}; lifts off {day(plan.lunarLiftoffMs)}
      {fromMission && missionDays !== undefined ? `, after a stay as long as your mission dates` : ''}. Launch is {day(plan.launchMs)}, because the trip to
      the Moon takes days.
    </p>
  )
}

function ResultCard({ plan, onSeek, missionStartMs, missionDays, fromMission }: { plan: MissionPlan; onSeek(utcMs: number): void; missionStartMs: number; missionDays?: number; fromMission: boolean }) {
  const [full] = useFullData()
  const f = plan.facts
  const lb = lowerBoundOf(plan.architecture.id)
  const status = propellantStatus(plan.propellant, lb?.element ?? null)
  return (
    <section className="flight-result" aria-label="Result" data-testid="flight-result">
      {/* The answer first (science lead, 15 Nov: "readable, intuitive"): does this design have the propellant for this
          mission, then when it launches, lands and returns, then what it can carry; the energy multiplier folds. */}
      <ul className="flight-glance">
        <li className="flight-verdict" data-testid="flight-glance-propellant" data-tone={status.tone}>
          <span className={status.tone === 'short' ? 'flight-glance-short' : undefined}>
            <Abbr>{status.text}</Abbr>
          </span>
          {status.tone !== 'enough' && !full && <span className="quiet"> Per stage: Propellant, below.</span>}
          {status.tone === 'short' && (
            <span className="flight-short-meaning" data-testid="flight-short-meaning">
              {SHORT_MEANING}
            </span>
          )}
          {lb && (
            <span className="flight-lower-bound quiet" data-testid="flight-lower-bound">
              {full ? `${lb.note} ${NOT_VALIDATED_TEXT}` : lowerBoundShort(lb.kg)}
            </span>
          )}
        </li>
        <li className="flight-glance-times" data-testid="flight-glance-times">
          <MissionDatesLine plan={plan} missionStartMs={missionStartMs} missionDays={missionDays} fromMission={fromMission} />
          <span className="flight-glance-row">
            <span className="quiet">Launch</span> <TimeLink ms={plan.launchMs} label="launch" onSeek={onSeek} />
          </span>
          <span className="flight-glance-row">
            <span className="quiet">Landing</span> <TimeLink ms={plan.touchdownMs} label="touchdown" onSeek={onSeek} />
          </span>
          <span className="flight-glance-row">
            <span className="quiet">
              Return (<Abbr>EI</Abbr>)
            </span>{' '}
            <TimeLink ms={plan.endMs} label="Entry Interface" onSeek={onSeek} />
            <span className="quiet"> · {fmtDays(f.missionDays, 1)} in all</span>
          </span>
        </li>
        <li data-testid="flight-glance-dv">
          <span className="quiet">
            <Abbr>Δv</Abbr> after launch
          </span>{' '}
          <span className="mono">{fmtDv(dvAfterLaunchOf(plan))}</span>
        </li>
      </ul>
      <PayloadLine shortElements={shortElementsOf(plan.propellant, lb?.element ?? null)} />
      <EnergyFactor plan={plan} />
      <AnalysisActions />
    </section>
  )
}

/** The plan could not be made: one plain sentence with what to do; the planner's own reason in full data mode. */
function PlanError({ message }: { message: string }) {
  const [full] = useFullData()
  const e = errorText('mission', message)
  return (
    <div className="menu-msg is-error flight-status" role="alert" data-testid="flight-error">
      <p>{e.sentence}</p>
      {full && e.detail && <p className="quiet">Planner: {e.detail}</p>}
    </div>
  )
}

/** Details of the analyses, in sections that open by default in full data mode. */
function AnalysisSections() {
  const a = useFlightAnalysis()
  return (
    <>
      {a.payload.state === 'ready' && (
        <Section id="payload" title="Payload: propellant per phase, limit and assumptions" data>
          <PayloadDetails p={a.payload.result} />
          <p>
            <Unvalidated />
          </p>
        </Section>
      )}
      {a.route.state === 'ready' && (
        <Section id="route" title="Cheapest route: Δv per phase" data>
          <RouteDetails r={a.route.result} />
        </Section>
      )}
      {a.dispersion.state === 'ready' && (
        <Section id="dispersion" title="Landing dispersion: the runs" data>
          <DispersionDetails />
        </Section>
      )}
    </>
  )
}

// ---------- the surface stay asked for ----------

interface StayFieldProps {
  id: string
  value: number // days in use; it also changes from outside, when the mission design changes
  onChange(v: number): void // called with a value in range, rounded to half a day
}

// A design's own default need not be a half day (Apollo 11 stayed 21 h 36 min): it is shown to two decimals.
const stayText = (v: number) => String(Number(v.toFixed(2)))

function StayField({ id, value, onChange }: StayFieldProps) {
  const [draft, setDraft] = useState(stayText(value))
  const [seen, setSeen] = useState(value)
  // A value from outside (a new design's default, or the rounding of what was typed) replaces the text.
  if (value !== seen) {
    setSeen(value)
    if (Number(draft) !== value) setDraft(stayText(value))
  }
  const typed = draft.trim() === '' ? NaN : Number(draft)
  const bad = !(typed >= STAY_DAYS.min && typed <= STAY_DAYS.max)

  return (
    <>
      <div className="flight-stay">
        <input
          id={id}
          className="field mono"
          type="number"
          inputMode="decimal"
          min={STAY_DAYS.min}
          max={STAY_DAYS.max}
          step={STAY_DAYS.step}
          aria-invalid={bad || undefined}
          value={draft}
          data-testid="flight-stay"
          onChange={(e) => {
            setDraft(e.target.value)
            const v = e.target.value.trim() === '' ? NaN : Number(e.target.value)
            if (v >= STAY_DAYS.min && v <= STAY_DAYS.max) onChange(Math.round(v / STAY_DAYS.step) * STAY_DAYS.step)
          }}
        />
        <span>days asked for</span>
      </div>
      {bad && (
        <p className="msg is-error flight-hint" role="alert">
          {STAY_DAYS.min} to {STAY_DAYS.max} days, in steps of half a day.
        </p>
      )}
    </>
  )
}

// ---------- the computed mission: notes, events, propellant, flight facts ----------

type Fact = [id: string, label: string, lines: string[]] // id is the row's data-fact

interface MissionResultProps {
  plan: MissionPlan
  onSeek(utcMs: number): void
}

function MissionResult({ plan, onSeek }: MissionResultProps) {
  const [burnsOnly, setBurnsOnly] = useState(false)
  const f = plan.facts
  const dvAfterLaunch = dvAfterLaunchOf(plan)
  const int = (v: number) => Math.round(v).toLocaleString('en-US')
  const days = (v: number, digits: number) => `${v.toFixed(digits)} days`

  const loss = f.ascentLossKms
  const losses: Fact[] = loss
    ? [['ascent-losses', 'Ascent losses (Δv)', [`gravity ${fmtDv(loss.gravity)}`, `drag ${fmtDv(loss.drag)}`, `steering ${fmtDv(loss.steering)}`]]]
    : []
  const facts: Fact[] = [
    ['launch', 'Launch', [fmtUtc(plan.launchMs)]],
    ['azimuth', 'Launch azimuth', [`${f.launchAzimuthDeg.toFixed(1)}° (inertial)`]],
    ['parking', 'Parking orbit', [
      `${int(f.parkingPerigeeKm)} × ${int(f.parkingApogeeKm)} km, inclined ${f.parkingInclDeg.toFixed(1)}°`,
      // New physics (15 Nov 2026): the Artemis I parking orbit of SLS Block 1 carries its own marker until the science lead signs it.
      ...(plan.unvalidated ?? []).map((u) => `${u.what}: ${u.text}`),
    ]],
    ...losses,
    ['transfer', 'Translunar flight', [days(f.transferDays, 2)]],
    ['moon', 'Moon at arrival', [fmtKm(f.moonDistKm)]],
    ['arrival', 'Arrival speed', [`v∞ ${f.vInfKms.toFixed(2)} km/s`]],
    ['lunar-orbit', 'Lunar orbit', [`${int(f.lunarPeriluneKm)} × ${int(f.lunarApoluneKm)} km, inclined ${f.lunarInclDeg.toFixed(1)}°`]],
    ['orbit-before-landing', 'In lunar orbit before landing', [fmtDuration(f.orbitBeforeLandingH * 3600)]],
    ['touchdown', 'Touchdown', [fmtUtc(plan.touchdownMs), ...(f.landingMissM === null ? [] : [`miss ${fmtMetres(f.landingMissM)}`])]],
    ['surface-stay', 'Surface stay', [days(f.surfaceStayDays, 1)]],
    ['lunar-liftoff', 'Lunar liftoff', [fmtUtc(plan.lunarLiftoffMs)]],
    ['docking', 'Docking', [fmtUtc(plan.dockingMs)]],
    ['return-geometry', 'Return geometry', [`orbit plane ${f.returnPlaneOffDeg.toFixed(1)}° from the way home`]],
    ['flight-home', 'Flight home', [days(f.returnDays, 1)]],
    [
      'entry',
      'Entry Interface',
      [
        fmtUtc(plan.endMs),
        fmtKms(f.entry.speedKms),
        `flight-path angle ${fmtDeg(f.entry.fpaDeg, 2)}`,
        fmtCoords(f.entry.latDeg, f.entry.lonDeg),
      ],
    ],
    ['duration', 'Mission duration', [days(f.missionDays, 1)]],
  ]
  const burnCount = plan.events.filter((e) => e.kind === 'burn').length
  const events = burnsOnly ? plan.events.filter((e) => e.kind === 'burn') : plan.events
  const shortCount = plan.propellant.filter((u) => u.usedKg > u.capacityKg).length

  return (
    <>
      {plan.notes.length > 0 && (
        <Section data id="notes" title="Notes on this plan" count={String(plan.notes.length)}>
          <ul className="plain flight-notes" aria-label="Notes on this mission" data-testid="flight-notes">
            {plan.notes.map((note, i) => (
              <li key={i}>
                <Abbr>{note}</Abbr>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section data id="events" title="Events and burns" count={`${burnCount} burns, ${plan.events.length - burnCount} other`}>
        <label className="check flight-filter">
          <input type="checkbox" checked={burnsOnly} onChange={(e) => setBurnsOnly(e.target.checked)} />
          <span>Engine burns only</span>
        </label>
        <table className="tbl flight-burns" data-testid="flight-events">
          <thead>
            <tr>
              <th scope="col">Event</th>
              <th scope="col">
                Time (<Abbr>UTC</Abbr>)
              </th>
              <th scope="col" className="flight-num">
                <Abbr>Δv</Abbr>
              </th>
              <th scope="col" className="flight-num">
                Propellant
              </th>
              <th scope="col" className="flight-num">
                Duration
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => {
              const who = [e.by, e.craft === 'lander' ? 'lander' : null].filter((x): x is string => !!x).join(' · ')
              const [day, time] = fmtDayTime(e.utcMs).split(', ')
              return (
                <tr key={`${i}-${e.id}`} data-event={e.id} data-kind={e.kind}>
                  <th scope="row" className="flight-name">
                    <Abbr>{e.label}</Abbr>
                    {who && (
                      <span className="flight-sub">
                        <Abbr>{who}</Abbr>
                      </span>
                    )}
                  </th>
                  <td>
                    <button type="button" className="link mono flight-time" aria-label={`Go to ${e.label}`} onClick={() => onSeek(e.utcMs)}>
                      <span>{day}</span> <span>{time}</span>
                    </button>
                  </td>
                  <td className="flight-num mono">{e.dvKms === null ? '–' : fmtDv(e.dvKms)}</td>
                  <td className="flight-num mono">{e.propellantKg === null ? '–' : fmtTonnes(e.propellantKg)}</td>
                  <td className="flight-num mono">{e.durationS === null ? '–' : fmtDuration(e.durationS)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr data-testid="flight-dv-total">
              <th scope="row" colSpan={2}>
                Total <Abbr>Δv</Abbr> after launch
              </th>
              <td className="flight-num mono">{fmtDv(dvAfterLaunch)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </Section>

      <Section data id="propellant" title="Propellant" count={shortCount === 0 ? 'enough' : `${shortCount} short`}>
        <table className="tbl flight-propellant" data-testid="flight-propellant">
          <thead>
            <tr>
              <th scope="col">Element</th>
              <th scope="col" className="flight-num">
                Needed
              </th>
              <th scope="col" className="flight-num">
                Capacity
              </th>
              <th scope="col" className="flight-num">
                Margin
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.propellant.map((u, i) => {
              const margin = u.capacityKg - u.usedKg
              const short = margin < 0
              return (
                <tr key={`${i}-${u.element}`} className={short ? 'is-short' : undefined}>
                  <th scope="row" className="flight-name">
                    <Abbr>{u.element}</Abbr>
                  </th>
                  <td className="flight-num mono">{fmtTonnes(u.usedKg)}</td>
                  <td className="flight-num mono">{fmtTonnes(u.capacityKg)}</td>
                  <td className="flight-num">
                    <span className="mono">{`${short ? MINUS : '+'}${fmtTonnes(Math.abs(margin))}`}</span>
                    {short && <span className="flight-fact-line">short</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Section>

      <Section data id="facts" title="Flight facts">
        <dl className="flight-facts">
          {facts.map(([id, label, lines]) => (
            <div key={id} data-fact={id}>
              <dt className="quiet">{label}</dt>
              <dd className="mono">
                {lines.map((line, i) => (
                  <span key={i} className="flight-fact-line">
                    <Abbr>{line}</Abbr>
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  )
}

// ---------- latitude and longitude inputs for a free point (launchpad on Earth, landing point on the Moon) ----------

interface CoordFieldsProps {
  value: LatLon | null // the point in use; it also changes from outside, when a point is picked in the 3D view
  testId: string // 'flight-pad' gives flight-pad-lat and flight-pad-lon
  onChange(p: LatLon): void // called when both fields hold a number in range
}

const coordText = (v: number) => String(Number(v.toFixed(2)))

const toDraft = (v: LatLon | null) => ({ lat: v ? coordText(v.latDeg) : '', lon: v ? coordText(v.lonDeg) : '' })

const sameCoords = (a: LatLon | null, b: LatLon | null) =>
  a === b || (a !== null && b !== null && a.latDeg === b.latDeg && a.lonDeg === b.lonDeg)

/** The number a field holds, or null. Text that still shows the point in use stands for its exact value. */
function readCoord(text: string, inUse: number | undefined, limit: number): number | null {
  if (inUse !== undefined && text === coordText(inUse)) return inUse
  const v = text.trim() === '' ? NaN : Number(text)
  return Number.isFinite(v) && Math.abs(v) <= limit ? v : null
}

function CoordFields({ value, testId, onChange }: CoordFieldsProps) {
  const [draft, setDraft] = useState(() => toDraft(value))
  const [seen, setSeen] = useState(value)
  const lat = readCoord(draft.lat, value?.latDeg, 90)
  const lon = readCoord(draft.lon, value?.lonDeg, 180)

  // A point that arrives from outside (picked in the 3D view) replaces what was typed; the echo of the user's
  // own typing does not.
  if (!sameCoords(value, seen)) {
    setSeen(value)
    if (value && !(lat === value.latDeg && lon === value.lonDeg)) setDraft(toDraft(value))
  }

  const edit = (next: { lat: string; lon: string }) => {
    setDraft(next)
    const la = readCoord(next.lat, value?.latDeg, 90)
    const lo = readCoord(next.lon, value?.lonDeg, 180)
    if (la === null || lo === null) return
    if (value && value.latDeg === la && value.lonDeg === lo) return
    onChange({ latDeg: la, lonDeg: lo })
  }

  const latBad = draft.lat.trim() !== '' && lat === null
  const lonBad = draft.lon.trim() !== '' && lon === null

  return (
    <>
      <div className="flight-coords">
        <label className="flight-coord">
          <span className="quiet">Lat</span>
          <input
            className="field mono"
            type="number"
            inputMode="decimal"
            min={-90}
            max={90}
            step={0.01}
            aria-label="Latitude in degrees, north positive"
            aria-invalid={latBad || undefined}
            value={draft.lat}
            data-testid={`${testId}-lat`}
            onChange={(e) => edit({ lat: e.target.value, lon: draft.lon })}
          />
        </label>
        <label className="flight-coord">
          <span className="quiet">Lon</span>
          <input
            className="field mono"
            type="number"
            inputMode="decimal"
            min={-180}
            max={180}
            step={0.01}
            aria-label="Longitude in degrees, east positive"
            aria-invalid={lonBad || undefined}
            value={draft.lon}
            data-testid={`${testId}-lon`}
            onChange={(e) => edit({ lat: draft.lat, lon: e.target.value })}
          />
        </label>
      </div>
      {(latBad || lonBad) && (
        <p className="msg is-error flight-hint" role="alert">
          {latBad ? 'Latitude: −90 to 90°, north positive.' : 'Longitude: −180 to 180°, east positive.'}
        </p>
      )}
    </>
  )
}
