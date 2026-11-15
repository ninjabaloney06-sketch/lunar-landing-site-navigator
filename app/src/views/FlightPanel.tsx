// Flight plan panel: the docked side panel of the Flight plan tab. First the mission at a glance (when it
// launches, lands, leaves and returns, the total Δv, whether every stage has enough propellant), then named
// sections that open and close: the choices, the notes, the events, the propellant budget, the flight facts, the
// view and its legend, the explanations (FlightExplain) and how the numbers are made. Presentational only: the
// mission is computed outside, and the status it is given drives the loading and error text.
import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import '../styles/flight.css'
import type { ArchitectureSpec } from '../flight/hardware'
import type { LandingTarget, Launchpad, MissionPlan } from '../flight/types'
import { DESIGNS, SLS_LANDERS, designOf } from '../flight/designs'
import { ARCHITECTURES, SPACECRAFT } from '../flight/spacecraft'
import { useFullData } from './advanced'
import { Glossary, HaloOrbit, LandingWays, SurfaceStay, rememberPlan } from './FlightExplain'
import { fmtCoords, fmtDeg } from './format'
import { fmtDayTime, fmtDays, fmtDuration, fmtKm, fmtKms, fmtMetres, fmtTonnes, fmtUtc } from './flightFormat'
import { useFlightAnalysis } from './flightAnalysis'
import { Abbr } from './flightGlossary'
import { AnalysisActions, DispersionDetails, PayloadDetails, PayloadLine, RouteDetails, Unvalidated } from './flightResult'
import { lowerBoundPropellant, lowerBoundShort } from './flightResultText'
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
  onChangeSite(): void // opens the Mission panel
  onSeek(utcMs: number): void // jump the playback to an event
  collapsed: boolean
  onCollapsed(v: boolean): void
  missionName: string
  onSaveMission(): void
  missionSaved: boolean // the current mission is already in the saved list
  canSaveMission: boolean // false when the list is full
  /** Back to the landing-site view (the menu's own way out once the Flight plan tab is gone). */
  onClose?(): void
}

const TRANSFER_LIMITS: { value: string; label: string }[] = [
  { value: '4.5', label: 'At most 4.5 days' },
  { value: '4', label: '4 days' },
  { value: '3.5', label: '3.5 days' },
  { value: '3', label: '3 days' },
  { value: '2.5', label: '2.5 days' },
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
        <span className="flight-sec-title">{title}</span>
        {count && <span className="flight-sec-count mono">{count}</span>}
      </summary>
      {open && <div className="flight-sec-body">{children}</div>}
    </details>
  )
}

export function FlightPanel(p: FlightPanelProps) {
  const { architectureId, rendezvous, pads, padId, target, siteMode, status, trueScale, picking, collapsed } = p
  const uid = useId()
  const plan = status.state === 'ready' ? status.plan : null

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
      {p.onClose && (
        <button type="button" className="link flight-close" data-testid="flight-close" onClick={p.onClose}>
          Back to landing site
        </button>
      )}
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
    <section className="popover menu flight-panel" aria-labelledby="flight-title" data-testid="flight-panel">
      {head}
      <ul className="plain flight-mission" data-testid="flight-mission">
        <li>
          <span className="quiet">Mission</span> <strong>{p.missionName}</strong>
        </li>
        <li className="flight-site-row">
          <span className="quiet">Landing site</span> <span className="flight-site-name">{target.name}</span>
          {siteMode === 'mission' && (
            <button type="button" className="link flight-change-site" onClick={p.onChangeSite}>
              change site
            </button>
          )}
        </li>
      </ul>

      {status.state === 'loading' && (
        <p className="menu-msg is-quiet flight-status" role="status">
          Computing the mission… a few seconds.
        </p>
      )}
      {status.state === 'error' && (
        <p className="menu-msg is-error flight-status" role="alert">
          {status.message}
        </p>
      )}
      {plan && <ResultCard plan={plan} onSeek={p.onSeek} />}
      {plan && <AnalysisSections />}

      <fieldset className="flight-designs" data-testid="flight-designs">
        <legend className="mp-label">Rocket and lander</legend>
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
                <strong>{d.title}</strong>
              </span>
              <span className="quiet flight-design-stack">{d.stack}</span>
              <ul className="flight-bullets">
                {d.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
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
                {l.label}
              </button>
            ))}
          </div>
        )}
      </fieldset>

      <div className="mp-fields flight-fields">
        <div className="mp-field">
          <label className="mp-label" htmlFor={`${uid}-pad`}>
            Launchpad
          </label>
          <select id={`${uid}-pad`} className="field" value={padId} data-testid="flight-pad" onChange={(e) => p.onPad(e.target.value)}>
            {pads.map((x) => (
              <option key={x.id} value={x.id}>
                {`${x.name} · ${x.site}`}
              </option>
            ))}
            <option value="custom">Other coordinates</option>
          </select>
        </div>
        <div className="mp-field">
          <span className="mp-label">Landing</span>
          <span className="flight-line">
            not before <span className="mono">{fmtUtc(p.earliestTouchdownMs)}</span>
          </span>
        </div>
        <div className="mp-field">
          <label className="mp-label" htmlFor={`${uid}-stay`}>
            Surface stay
          </label>
          <div className="flight-control">
            <StayField id={`${uid}-stay`} value={p.surfaceStayDays} onChange={p.onSurfaceStayDays} />
            {plan && Math.abs(plan.facts.surfaceStayDays - p.surfaceStayDays) > 0.05 && (
              <p className="quiet" data-testid="flight-stay-planned">
                flown: <span className="mono">{fmtDays(plan.facts.surfaceStayDays, 2)}</span>
                {rendezvous === 'nrho' ? ' (the lander leaves once per halo-orbit revolution)' : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flight-save">
        <button type="button" className="btn" data-testid="flight-save-mission" disabled={p.missionSaved || !p.canSaveMission} onClick={p.onSaveMission}>
          Save mission
        </button>
        <span className="quiet" aria-live="polite">
          {p.missionSaved ? 'Saved: see the mission table under Details.' : 'Keeps site, dates, launchpad, rocket and stay.'}
        </span>
      </div>

      {plan && <MissionResult plan={plan} onSeek={p.onSeek} />}

      <Section id="advanced" title="More choices">
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
          </div>
          <div className="mp-field">
            <label className="mp-label" htmlFor={`${uid}-transfer`}>
              Transfer
            </label>
            <select
              id={`${uid}-transfer`}
              className="field"
              value={p.maxTransferDays === null ? '' : String(p.maxTransferDays)}
              data-testid="flight-transfer"
              onChange={(e) => p.onMaxTransferDays(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">Minimum energy (about 5 days)</option>
              {TRANSFER_LIMITS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
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
        <ul className="flight-bullets quiet">
          <li>Every phase integrated numerically with the engines' thrust and propellant flow</li>
          <li>
            Gravity of Earth (with its oblateness), the Moon and the Sun; positions from <Abbr>JPL DE440</Abbr>
          </li>
          <li>Launch time, azimuth, burn lengths and ignition points searched for the least propellant</li>
          <li>
            Max payload: the rocket equation per stage on the plan's burns, every element loaded with what it needs plus a 3 % reserve, the
            error a root sum of squares of one-at-a-time changes (not yet validated by the science lead)
          </li>
          <li>Landing dispersion: 200 descents flown with small errors in thrust, specific impulse, pointing and launch time (not yet validated by the science lead)</li>
          <li>Not modelled: the Moon's uneven gravity in the plans (its J2 term is in the landing dispersion only), winds, engine transients, atmospheric entry after Entry Interface</li>
        </ul>
        {plan && plan.sources.length > 0 && (
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

/** The result: the payload line first, then the mission in three short bullets (times are buttons into the
 *  playback), then the two analyses the user can start. */
function ResultCard({ plan, onSeek }: { plan: MissionPlan; onSeek(utcMs: number): void }) {
  const [full] = useFullData()
  const f = plan.facts
  const short = plan.propellant.filter((u) => u.usedKg > u.capacityKg)
  const lb = lowerBoundOf(plan.architecture.id)
  return (
    <section className="flight-result" aria-label="Result" data-testid="flight-result">
      <PayloadLine />
      <ul className="flight-bullets">
        <li>
          <Abbr>Δv</Abbr> after launch: <span className="mono">{fmtKms(dvAfterLaunchOf(plan))}</span>
        </li>
        <li>
          Launch{' '}
          <button type="button" className="link mono" onClick={() => onSeek(plan.launchMs)}>
            {fmtUtc(plan.launchMs)}
          </button>
          , landing{' '}
          <button type="button" className="link mono" onClick={() => onSeek(plan.touchdownMs)}>
            {fmtUtc(plan.touchdownMs)}
          </button>
          , home after <span className="mono">{fmtDays(f.missionDays, 1)}</span>
        </li>
        <li data-testid="flight-glance-propellant">
          {short.length === 0 ? (
            'Propellant: every stage has enough.'
          ) : (
            <>
              Propellant short:{' '}
              {short.map((u, i) => (
                <span key={i} className="flight-glance-short">
                  <Abbr>{u.element}</Abbr> <span className="mono">{fmtTonnes(u.usedKg - u.capacityKg)}</span>
                  {i < short.length - 1 ? ', ' : ''}
                </span>
              ))}{' '}
              <span className="quiet">(why: Notes on this plan)</span>
            </>
          )}
          {lb && (
            <span className="flight-lower-bound quiet" data-testid="flight-lower-bound">
              {' '}
              {full ? lb.note : lowerBoundShort(lb.kg)}
            </span>
          )}
        </li>
      </ul>
      <AnalysisActions />
    </section>
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
    ? [['ascent-losses', 'Ascent losses', [`gravity ${fmtKms(loss.gravity)}`, `drag ${fmtKms(loss.drag)}`, `steering ${fmtKms(loss.steering)}`]]]
    : []
  const facts: Fact[] = [
    ['launch', 'Launch', [fmtUtc(plan.launchMs)]],
    ['azimuth', 'Launch azimuth', [`${f.launchAzimuthDeg.toFixed(1)}° (inertial)`]],
    ['parking', 'Parking orbit', [`${int(f.parkingPerigeeKm)} × ${int(f.parkingApogeeKm)} km, inclined ${f.parkingInclDeg.toFixed(1)}°`]],
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
                  <td className="flight-num mono">{e.dvKms === null ? '–' : fmtKms(e.dvKms)}</td>
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
              <td className="flight-num mono">{fmtKms(dvAfterLaunch)}</td>
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
