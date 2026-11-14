// Flight plan panel: the docked side panel of the Flight plan tab. Choices (mission design, launchpad, landing
// point, departure, transfer limit) and the computed mission: its events with Δv and propellant, the propellant
// budget, the flight facts, the view toggle and how the numbers are made. Presentational only: the mission is
// computed outside, and the status it is given drives the loading and error text.
import { useId, useState } from 'react'
import '../styles/flight.css'
import type { LandingTarget, Launchpad, MissionPlan } from '../flight/types'
import { fmtCoords, fmtDeg } from './format'
import { fmtDayTime, fmtDuration, fmtKm, fmtKms, fmtMetres, fmtTonnes, fmtUtc } from './flightFormat'

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
  surfaceStayDays: number // the mission length
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

const MINUS = '−'

interface LatLon {
  latDeg: number
  lonDeg: number
}

export function FlightPanel(p: FlightPanelProps) {
  const { architectures, architectureId, pads, padId, target, siteMode, status, trueScale, picking, collapsed } = p
  const uid = useId()
  const head = (
    <div className="mp-head flight-head">
      <h2 id="flight-title" className="mp-title">
        Flight plan
      </h2>
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

  const architecture = architectures.find((x) => x.id === architectureId)
  const plan = status.state === 'ready' ? status.plan : null
  const siteCoords = (
    <p className="flight-used mono" data-testid="flight-site-coords">
      {fmtCoords(target.latDeg, target.lonDeg)}
    </p>
  )

  return (
    <section className="popover menu flight-panel" aria-labelledby="flight-title" data-testid="flight-panel">
      {head}
      <p className="quiet flight-intro">
        Launch, landing at the chosen point, stay, ascent, docking and the flight home, with the least propellant.
      </p>

      <div className="mp-fields">
        <div className="mp-field">
          <label className="mp-label" htmlFor={`${uid}-architecture`}>
            Mission design
          </label>
          <div className="flight-control">
            <select
              id={`${uid}-architecture`}
              className="field"
              value={architectureId}
              data-testid="flight-architecture"
              onChange={(e) => p.onArchitecture(e.target.value)}
            >
              {architectures.map((x) => (
                <option key={x.id} value={x.id} disabled={!x.available}>
                  {x.available ? x.name : `${x.name} (not yet available)`}
                </option>
              ))}
            </select>
            {architecture && <p className="quiet flight-note">{architecture.note}</p>}
            {architecture && !architecture.available && architecture.unavailableReason && (
              <p className="quiet flight-note">{architecture.unavailableReason}</p>
            )}
          </div>
        </div>

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
            {padId === 'custom' && (
              <>
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
                {picking === 'pad' && (
                  <p className="quiet flight-hint" role="status">
                    Click a point on Earth in the 3D view.
                  </p>
                )}
                {p.customPad && (
                  <p className="flight-used mono" data-testid="flight-pad-coords">
                    {fmtCoords(p.customPad.latDeg, p.customPad.lonDeg)}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mp-field">
          <span className="mp-label" id={`${uid}-site`}>
            Landing point
          </span>
          <div className="flight-control" role="radiogroup" aria-labelledby={`${uid}-site`}>
            <div className="flight-choice">
              <label className="check mp-radio">
                <input
                  type="radio"
                  name={`${uid}-site-mode`}
                  checked={siteMode === 'mission'}
                  data-testid="flight-site-mission"
                  onChange={() => p.onSiteMode('mission')}
                />
                <span>{siteMode === 'mission' ? `Mission site: ${target.name}` : 'Mission site'}</span>
              </label>
              {siteMode === 'mission' && (
                <button type="button" className="link" onClick={p.onChangeSite}>
                  Change
                </button>
              )}
            </div>
            {siteMode === 'mission' && siteCoords}
            <label className="check mp-radio">
              <input
                type="radio"
                name={`${uid}-site-mode`}
                checked={siteMode === 'custom'}
                data-testid="flight-site-custom"
                onChange={() => p.onSiteMode('custom')}
              />
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
                {picking === 'site' && (
                  <p className="quiet flight-hint" role="status">
                    Click a point on the Moon in the 3D view.
                  </p>
                )}
                {siteCoords}
              </>
            )}
          </div>
        </div>

        <div className="mp-field">
          <span className="mp-label">Touchdown</span>
          <div className="flight-control">
            <p className="flight-line">
              not before <span className="mono">{fmtUtc(p.earliestTouchdownMs)}</span>
            </p>
            {plan && (
              <p className="flight-line flight-line-next" data-testid="flight-touchdown">
                planned <span className="mono">{fmtUtc(plan.touchdownMs)}</span>
              </p>
            )}
            <p className="quiet">the earliest opportunity after the mission start</p>
          </div>
        </div>

        <div className="mp-field">
          <span className="mp-label" id={`${uid}-stay`}>
            Surface stay
          </span>
          <div className="flight-control">
            <p className="flight-line">
              <span className="mono">{p.surfaceStayDays}</span> {p.surfaceStayDays === 1 ? 'day' : 'days'} (the mission length)
            </p>
            <select
              className="field"
              aria-labelledby={`${uid}-stay`}
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
      </div>

      {status.state === 'loading' && (
        <p className="menu-msg is-quiet flight-status" role="status">
          Computing the mission… This takes a few seconds.
        </p>
      )}
      {status.state === 'error' && (
        <p className="menu-msg is-error flight-status" role="alert">
          {status.message}
        </p>
      )}

      {plan && <MissionResult plan={plan} uid={uid} onSeek={p.onSeek} />}

      <section className="mp-sec" aria-labelledby={`${uid}-view`}>
        <h3 id={`${uid}-view`} className="mp-h">
          View
        </h3>
        <label className="check">
          <input type="checkbox" checked={trueScale} onChange={(e) => p.onTrueScale(e.target.checked)} />
          <span>True scale</span>
        </label>
        <p className="quiet flight-foot">
          At true scale Earth is one sixtieth of the way to the Moon: use Look at Earth, Moon, Capsule or Lander in the playback
          bar, or zoom, to see the parking orbit and the lunar orbit. Unticked, Earth (3×), the Moon (4×) and the orbits close to
          them are drawn enlarged, which bends the drawn path near them. Times and Δv are the same either way.
        </p>
        <p className="quiet flight-foot">
          The line from Earth is the path in space; the ring marks where the Moon will be then. The lunar orbit and the descent are
          drawn around the Moon and travel with it. The bright point is the capsule; the second point is the lander while it flies
          on its own. Orange stretches are engine burns.
        </p>
      </section>

      <section className="mp-sec" aria-labelledby={`${uid}-how`}>
        <h3 id={`${uid}-how`} className="mp-h">
          How this is computed
        </h3>
        <p className="quiet">
          Every phase is integrated numerically with the engines' thrust and propellant flow: the ascent through the atmosphere,
          the burns in space, the powered descent to the chosen point, the ascent and the rendezvous. Gravity of Earth (with its
          oblateness), the Moon and the Sun; Moon and Sun positions from the JPL DE440 ephemeris. Launch time, launch azimuth, burn
          lengths and ignition points are searched for the least propellant; the stay in lunar orbit before landing is as short as
          the geometry allows.
        </p>
        <p className="quiet flight-foot">
          Not modelled: the Moon's uneven gravity, winds, engine start-up and shut-down transients, the entry through Earth's
          atmosphere after Entry Interface. Planning estimate, not validated flight dynamics.
        </p>
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
      </section>
    </section>
  )
}

// ---------- the computed mission: notes, events, propellant, flight facts ----------

type Fact = [id: string, label: string, lines: string[]] // id is the row's data-fact

interface MissionResultProps {
  plan: MissionPlan
  uid: string
  onSeek(utcMs: number): void
}

function MissionResult({ plan, uid, onSeek }: MissionResultProps) {
  const f = plan.facts
  const dvAfterLaunch = plan.events.reduce(
    (sum, e) => (e.kind === 'burn' && e.id !== 'ascent' && e.dvKms !== null ? sum + e.dvKms : sum),
    0,
  )
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

  return (
    <>
      {plan.notes.length > 0 && (
        <ul className="plain flight-notes" aria-label="Notes on this mission" data-testid="flight-notes">
          {plan.notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      )}

      <section className="mp-sec" aria-labelledby={`${uid}-events`}>
        <h3 id={`${uid}-events`} className="mp-h">
          Events
        </h3>
        <table className="tbl flight-burns" data-testid="flight-events">
          <thead>
            <tr>
              <th scope="col">Event</th>
              <th scope="col">Time (UTC)</th>
              <th scope="col" className="flight-num">
                Δv
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
            {plan.events.map((e, i) => {
              const who = [e.by, e.craft === 'lander' ? 'lander' : null].filter((x) => x).join(' · ')
              const [day, time] = fmtDayTime(e.utcMs).split(', ')
              return (
                <tr key={`${i}-${e.id}`} data-event={e.id} data-kind={e.kind}>
                  <th scope="row" className="flight-name">
                    {e.label}
                    {who && <span className="flight-sub">{who}</span>}
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
                Total Δv after launch
              </th>
              <td className="flight-num mono">{fmtKms(dvAfterLaunch)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="mp-sec" aria-labelledby={`${uid}-propellant`}>
        <h3 id={`${uid}-propellant`} className="mp-h">
          Propellant
        </h3>
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
                    {u.element}
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
      </section>

      <section className="mp-sec" aria-labelledby={`${uid}-flight`}>
        <h3 id={`${uid}-flight`} className="mp-h">
          Flight
        </h3>
        <dl className="flight-facts">
          {facts.map(([id, label, lines]) => (
            <div key={id} data-fact={id}>
              <dt className="quiet">{label}</dt>
              <dd className="mono">
                {lines.map((line, i) => (
                  <span key={i} className="flight-fact-line">
                    {line}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </section>
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
