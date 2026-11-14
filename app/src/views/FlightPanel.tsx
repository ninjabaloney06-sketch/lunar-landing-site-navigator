// Flight plan panel: the docked side panel of the Flight plan tab. Choices (launchpad, rocket, transfer
// limit) and the computed plan: burns with Δv, the flight facts, the view toggle and how the numbers are made.
// Presentational only: the solver runs outside, and the status it is given drives the loading and error text.
import { useId } from 'react'
import '../styles/flight.css'
import { DEFAULT_OPTIONS } from '../flight/types'
import type { FlightPlan, LandingTarget, Launchpad, Vehicle } from '../flight/types'
import { fmtCoords } from './format'
import { fmtDayTime, fmtDuration, fmtKms, fmtTonnes, fmtUtc } from './flightFormat'

export type FlightStatus =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; plan: FlightPlan }

export interface FlightPanelProps {
  pads: Launchpad[]
  padId: string
  onPad(id: string): void
  vehicles: Vehicle[]
  vehicleId: string
  onVehicle(id: string): void
  target: LandingTarget
  landingMs: number
  maxTransferDays: number | null
  onMaxTransferDays(v: number | null): void
  status: FlightStatus
  trueScale: boolean
  onTrueScale(v: boolean): void
  onChangeSite(): void // opens the Mission panel, where site and dates are chosen
  onSeek(utcMs: number): void // jump the playback to an event
}

const TRANSFER_LIMITS: { value: string; label: string }[] = [
  { value: '4.5', label: 'At most 4.5 days' },
  { value: '4', label: '4 days' },
  { value: '3.5', label: '3.5 days' },
  { value: '3', label: '3 days' },
  { value: '2.5', label: '2.5 days' },
]

export function FlightPanel(p: FlightPanelProps) {
  const { pads, padId, vehicles, vehicleId, target, status, trueScale, onSeek } = p
  const uid = useId()
  const pad = pads.find((x) => x.id === padId)
  const vehicle = vehicles.find((x) => x.id === vehicleId)
  const plan = status.state === 'ready' ? status.plan : null
  const pdiAltKm = plan ? plan.options.pdiAltKm : DEFAULT_OPTIONS.pdiAltKm

  return (
    <section className="popover menu flight-panel" aria-labelledby="flight-title" data-testid="flight-panel">
      <div className="mp-head flight-head">
        <div>
          <h2 id="flight-title" className="mp-title">
            Flight plan
          </h2>
          <p className="quiet">Most fuel-efficient direct flight from the launchpad to the landing site.</p>
        </div>
      </div>

      <div className="mp-fields">
        <div className="mp-field">
          <label className="mp-label" htmlFor={`${uid}-pad`}>
            Launchpad
          </label>
          <select
            id={`${uid}-pad`}
            className="field"
            value={padId}
            data-testid="flight-pad"
            onChange={(e) => p.onPad(e.target.value)}
          >
            {pads.map((x) => (
              <option key={x.id} value={x.id}>
                {`${x.name} · ${x.site}`}
              </option>
            ))}
          </select>
        </div>

        <div className="mp-field">
          <label className="mp-label" htmlFor={`${uid}-rocket`}>
            Rocket
          </label>
          <div className="flight-control">
            <select
              id={`${uid}-rocket`}
              className="field"
              value={vehicleId}
              data-testid="flight-rocket"
              onChange={(e) => p.onVehicle(e.target.value)}
            >
              {vehicles.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            {vehicle && <p className="quiet flight-note">{vehicle.note}</p>}
          </div>
        </div>

        <div className="mp-field">
          <span className="mp-label">Landing site</span>
          <div className="flight-control">
            <p className="flight-line">
              {target.name}
              <span className="flight-sub mono">{fmtCoords(target.latDeg, target.lonDeg)}</span>
            </p>
            <button type="button" className="link" onClick={p.onChangeSite}>
              Change
            </button>
          </div>
        </div>

        <div className="mp-field">
          <span className="mp-label">Touchdown</span>
          <div className="flight-control">
            <p className="flight-line mono">{fmtUtc(p.landingMs)}</p>
            <p className="quiet">mission start; change it in the Mission panel</p>
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
        <p className="menu-msg is-quiet" role="status">
          Computing the trajectory…
        </p>
      )}
      {status.state === 'error' && (
        <p className="menu-msg is-error" role="alert">
          {status.message}
        </p>
      )}

      {plan && (
        <>
          <section className="mp-sec" aria-labelledby={`${uid}-burns`}>
            <h3 id={`${uid}-burns`} className="mp-h">
              Burns
            </h3>
            <table className="tbl flight-burns" data-testid="flight-burns">
              <thead>
                <tr>
                  <th scope="col">Burn</th>
                  <th scope="col">Time (UTC)</th>
                  <th scope="col" className="flight-num">
                    Δv
                  </th>
                  <th scope="col" className="flight-num">
                    Propellant
                  </th>
                  <th scope="col" className="flight-num">
                    Burn time
                  </th>
                </tr>
              </thead>
              <tbody>
                {plan.burns.map((b) => (
                  <tr key={b.id} data-burn={b.id}>
                    <th scope="row" className="flight-name">
                      {b.label}
                    </th>
                    <td>
                      <button
                        type="button"
                        className="link mono"
                        aria-label={`Go to ${b.label}`}
                        onClick={() => onSeek(b.utcMs)}
                      >
                        {fmtDayTime(b.utcMs)}
                      </button>
                    </td>
                    <td className="flight-num mono">{fmtKms(b.dvKms, b.estimate)}</td>
                    <td className="flight-num mono">{b.propellantKg === null ? '–' : fmtTonnes(b.propellantKg)}</td>
                    <td className="flight-num mono">{b.durationS === null ? '–' : fmtDuration(b.durationS)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={2}>
                    In space (TLI to touchdown)
                  </th>
                  <td className="flight-num mono">{fmtKms(plan.dvInSpaceKms)}</td>
                  <td colSpan={2} />
                </tr>
                <tr>
                  <th scope="row" colSpan={2}>
                    With ascent
                  </th>
                  <td className="flight-num mono">{fmtKms(plan.dvTotalKms, true)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
            <p className="quiet flight-foot">
              ≈ includes an assumed loss term: {plan.vehicle.ascentLossKms} km/s for the ascent, {plan.options.descentLossKms} km/s for the
              powered descent.
            </p>
          </section>

          <section className="mp-sec" aria-labelledby={`${uid}-flight`}>
            <h3 id={`${uid}-flight`} className="mp-h">
              Flight
            </h3>
            <dl className="flight-facts">
              <div data-fact="launch">
                <dt className="quiet">Launch</dt>
                <dd className="mono">{fmtUtc(plan.launchMs)}</dd>
              </div>
              <div data-fact="azimuth">
                <dt className="quiet">Launch azimuth</dt>
                <dd className="mono">{`${plan.launchAzimuthDeg.toFixed(1)}° (inertial)`}</dd>
              </div>
              <div data-fact="parking">
                <dt className="quiet">Parking orbit</dt>
                <dd className="mono">
                  {`${plan.vehicle.parkingAltKm} km, inclined ${plan.parkingInclDeg.toFixed(1)}°, coast ${fmtDuration(plan.parkingCoastS)}`}
                </dd>
              </div>
              <div data-fact="transfer">
                <dt className="quiet">Transfer</dt>
                <dd className="mono">{`${plan.transferDays.toFixed(2)} days to lunar orbit`}</dd>
              </div>
              <div data-fact="moon">
                <dt className="quiet">Moon at arrival</dt>
                <dd className="mono">
                  {`${Math.round(plan.moonDistKm).toLocaleString('en-US')} km, declination ${plan.moonDeclDeg.toFixed(1)}°`}
                </dd>
              </div>
              <div data-fact="arrival">
                <dt className="quiet">Arrival speed</dt>
                <dd className="mono">{`v∞ ${plan.vInfKms.toFixed(2)} km/s`}</dd>
              </div>
              <div data-fact="lunar-orbit">
                <dt className="quiet">Lunar orbit</dt>
                <dd className="mono">
                  {`${plan.options.lloAltKm} km, inclined ${plan.lunarInclDeg.toFixed(1)}°, ${plan.lunarRevs} revolutions in ${plan.loiterH.toFixed(1)} h`}
                </dd>
              </div>
              <div data-fact="mass-tli">
                <dt className="quiet">Mass through TLI</dt>
                <dd className="mono">{fmtTonnes(plan.vehicle.injectedMassKg)}</dd>
              </div>
              <div data-fact="mass-surface">
                <dt className="quiet">Mass on the surface</dt>
                <dd className="mono">
                  {fmtTonnes(plan.landedMassKg)} <span className="quiet">spacecraft dry mass plus payload</span>
                </dd>
              </div>
            </dl>
          </section>
        </>
      )}

      <section className="mp-sec" aria-labelledby={`${uid}-view`}>
        <h3 id={`${uid}-view`} className="mp-h">
          View
        </h3>
        <label className="check">
          <input type="checkbox" checked={trueScale} onChange={(e) => p.onTrueScale(e.target.checked)} />
          <span>True scale</span>
        </label>
        <p className="quiet flight-foot">
          At true scale Earth is one sixtieth of the way to the Moon: use Look at Earth, Moon or Rocket under the playback bar, or
          zoom, to see the parking orbit and the lunar orbit. Unticked, Earth (3×), the Moon (4×) and the orbits close to them are
          drawn enlarged, which bends the drawn path near them. Times and Δv are the same either way.
        </p>
        <p className="quiet flight-foot">
          The line from Earth is the path in space, ending where the rocket enters lunar orbit; the ring marks where the Moon will be
          then. The lunar orbit and the descent are drawn around the Moon and travel with it.
        </p>
      </section>

      <section className="mp-sec" aria-labelledby={`${uid}-how`}>
        <h3 id={`${uid}-how`} className="mp-h">
          How this is computed
        </h3>
        {plan?.model === 'patched-conic' ? (
          <p className="menu-msg is-error flight-model" role="status">
            The numerical aiming did not converge for this flight. Shown instead: the two-conic first guess (an ellipse around Earth
            joined to a hyperbola around the Moon), which is good to a few hours near the Moon.
          </p>
        ) : null}
        <p className="quiet">
          The flight from the injection burn to the lunar orbit is integrated numerically under the gravity of Earth, the Moon and
          the Sun, with the Moon and Sun where the JPL DE440 ephemeris puts them. A two-conic solution gives the first guess: a
          parking orbit in the plane through the launchpad and the Moon's position at arrival, and the launch time within the day
          with the smallest total Δv. The size of the injection burn and the launch azimuth are then corrected until the integrated
          flight has its closest approach to the Moon at {plan ? plan.options.lloAltKm : DEFAULT_OPTIONS.lloAltKm} km, in a plane that passes over
          the landing site. The lunar orbit is circular; the descent starts from a {pdiAltKm} km periapsis.
        </p>
        <p className="quiet">
          Burns are instantaneous. Not modelled: Earth's oblateness, the Moon's uneven gravity, the ascent and the powered descent
          in detail (their Δv is an estimate with an assumed loss), the cost of phasing in lunar orbit, low-energy transfers of
          several months. Planning estimate, not validated flight dynamics.
        </p>
        <ul className="plain flight-sources">
          {vehicle?.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.label}
              </a>
            </li>
          ))}
          {pad && (
            <li key={pad.source.url}>
              <a href={pad.source.url} target="_blank" rel="noreferrer">
                {pad.source.label}
              </a>
            </li>
          )}
        </ul>
      </section>
    </section>
  )
}
