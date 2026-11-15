// P1 power estimate section of the details drawer: four inputs (kept in the link), one answer sentence (does the
// battery survive the longest dark window, by how much) and the period's numbers. Arithmetic: power/power.ts, on the
// same series and sun windows the summary uses. First estimate, not a power budget; not validated by the science lead.
import { useEffect, useId, useMemo, useState } from 'react'
import type { Results, ResultsState } from '../data/results'
import {
  AU_SOURCE,
  POWER_DEFAULTS,
  POWER_MAX,
  SOLAR_CONSTANT_SOURCE,
  SOLAR_CONSTANT_W_M2,
  estimateForResults,
  fmtNum,
  parsePowerText,
  powerCsvRows,
  powerSentence,
} from '../power/power'
import type { PowerInputs, PowerKey } from '../power/power'
import '../styles/power.css'

export type { PowerInputs }

interface Props {
  results: ResultsState
  custom: boolean // a custom site (site=cap:…)
  approx: string | null // the custom site's "Approximate: …" text, once its horizon is computed
  inputs?: PowerInputs // absent: the example values
  onChange?(next: PowerInputs): void
}

/** The power rows of the drawer's CSV export (P1: first estimate, not validated by the science lead). */
export function powerCsvLines(r: Results, inputs: PowerInputs = POWER_DEFAULTS): string[] {
  return powerCsvRows(inputs, estimateForResults(r, inputs))
}

const FIELDS: { key: PowerKey; label: string; unit: string }[] = [
  { key: 'panelM2', label: 'Panel area', unit: 'm²' },
  { key: 'effPct', label: 'Cell efficiency', unit: '%' },
  { key: 'loadW', label: 'Constant load', unit: 'W' },
  { key: 'battWh', label: 'Battery', unit: 'Wh' },
]

const NOT_MODELLED = 'Not modelled: temperature, panel degradation, dust, tilt, partial-panel shading.'

function Field({ id, f, value, onValue, onBad }: { id: string; f: (typeof FIELDS)[number]; value: number; onValue(v: number): void; onBad(bad: boolean): void }) {
  const [draft, setDraft] = useState(String(value))
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    // the value changed from outside (a link, a reload): show it unless the draft already means it
    setSeen(value)
    if (parsePowerText(f.key, draft) !== value) setDraft(String(value))
  }
  const bad = parsePowerText(f.key, draft) === null
  // the parent hides the estimate while any field is invalid; it follows the draft, also after an outside change
  useEffect(() => onBad(bad), [bad])
  return (
    <div className="power-field">
      <label htmlFor={id}>{f.label}</label>
      <span className="power-input">
        <input
          id={id}
          className="field mono"
          inputMode="decimal"
          autoComplete="off"
          value={draft}
          aria-invalid={bad || undefined}
          data-testid={`power-in-${f.key}`}
          onChange={(e) => {
            const t = e.target.value
            setDraft(t)
            const v = parsePowerText(f.key, t)
            if (v !== null && v !== value) onValue(v)
          }}
        />
        <span>{f.unit}</span>
      </span>
    </div>
  )
}

export function PowerSection(props: Props) {
  const uid = useId()
  const p = { ...props, inputs: props.inputs ?? POWER_DEFAULTS }
  const [badKeys, setBadKeys] = useState<PowerKey[]>([])
  const ready = p.results.status === 'ready' ? p.results.results : null
  const est = useMemo(() => estimateForResults(ready, p.inputs), [ready, p.inputs])
  const examples = FIELDS.filter((f) => p.inputs[f.key] === POWER_DEFAULTS[f.key]).map((f) => f.label.toLowerCase())
  const bad = badKeys.length > 0

  let body: React.ReactNode
  if (p.results.status === 'loading') body = <p className="quiet">Computing…</p>
  else if (!ready) body = <p className="quiet" data-testid="power-none">{p.custom ? 'Not computed for this place.' : 'No light data for this site and these dates.'}</p>
  else if (bad) body = <p className="quiet">Enter a number above 0 in the marked field (efficiency at most 100 %) to see the estimate.</p>
  else if (!est) body = <p className="quiet" data-testid="power-none">Not computed for this place.</p>
  else
    body = (
      <>
        <p className={`power-answer ${est.survives ? 'is-ok' : 'is-short'}`} data-testid="power-answer" aria-live="polite">
          {powerSentence(est)}
        </p>
        <table className="tbl power-out">
          <tbody>
            <tr>
              <th scope="row">Mean power over the period</th>
              <td className="mono" data-testid="power-mean">{fmtNum(est.meanW, 1)} W</td>
            </tr>
            <tr>
              <th scope="row">Energy over the period</th>
              <td className="mono" data-testid="power-energy">{fmtNum(est.energyKWh, 2)} kWh</td>
            </tr>
            <tr>
              <th scope="row">
                Balance against the load
                <span className="th-sub">energy minus load × {fmtNum(est.hours, 0)} h</span>
              </th>
              <td className="mono" data-testid="power-balance">{est.balanceKWh > 0 ? '+' : ''}{fmtNum(est.balanceKWh, 2)} kWh</td>
            </tr>
            <tr>
              <th scope="row">
                Needed in the longest dark window
                <span className="th-sub">load × dark hours</span>
              </th>
              <td className="mono" data-testid="power-need">{fmtNum(est.darkNeedWh, 0)} Wh</td>
            </tr>
          </tbody>
        </table>
        {p.custom && p.approx && <p className="msg" data-testid="power-approx">{p.approx}.</p>}
      </>
    )

  return (
    <section className="drawer-sec power" aria-labelledby={`${uid}-h`} data-testid="power-section">
      <h3 id={`${uid}-h`}>Power estimate</h3>
      <p className="msg sample-note power-status">First estimate, not a power budget. Not validated by the science lead.</p>
      <div className="power-fields">
        {FIELDS.map((f) => (
          <Field
            key={f.key}
            id={`${uid}-${f.key}`}
            f={f}
            value={p.inputs[f.key]}
            onValue={(v) => p.onChange?.({ ...p.inputs, [f.key]: v })}
            onBad={(b) => setBadKeys((ks) => (b ? (ks.includes(f.key) ? ks : [...ks, f.key]) : ks.filter((k) => k !== f.key)))}
          />
        ))}
      </div>
      {examples.length > 0 && (
        <p className="quiet power-example" data-testid="power-example">
          Example values, change them: {examples.join(', ')}.
        </p>
      )}
      {body}
      <p className="quiet power-limits">{NOT_MODELLED}</p>
      <details className="power-model">
        <summary>Model</summary>
        <p className="quiet">
          One panel that always faces the Sun: P(t) = S × A × η × f(t) × (1 AU / r(t))². S = {SOLAR_CONSTANT_W_M2} W/m², the total
          solar irradiance at 1 AU (
          <a href={SOLAR_CONSTANT_SOURCE} target="_blank" rel="noreferrer">
            Kopp &amp; Lean 2011
          </a>
          ); A panel area; η cell efficiency; f(t) the visible share of the Sun's disc above the terrain horizon, from the same
          30-minute samples as the sunlit share; r(t) the site's distance to the Sun from the JPL DE440 ephemeris, with 1 AU ={' '}
          <a href={AU_SOURCE} target="_blank" rel="noreferrer">
            149 597 870.7 km
          </a>
          . Energy is the sum of P × 30 min. The longest dark window is the one the summary reports, clipped to the period; the
          battery is taken as full when it starts. Inputs accepted: above 0, panel up to {fmtNum(POWER_MAX.panelM2, 0)} m²,
          efficiency up to 100 %.
        </p>
      </details>
    </section>
  )
}
