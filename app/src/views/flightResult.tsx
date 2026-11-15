// The analyses of the Rocket flight menu (all NOT YET VALIDATED BY THE SCIENCE LEAD): the maximum payload as one
// line in the result, the cheapest route and the landing dispersion as actions the user starts (they take
// seconds), each with progress and a way to stop it, and their details for the collapsed sections. Reads the
// store that useFlight fills (flightAnalysis.ts); the words come from flightResultText.ts.
import type { ReactNode } from 'react'
import { landingSentence } from '../flight/dispersion'
import type { PayloadResult, RouteComparison } from '../flight/payload'
import type { Job } from './flightAnalysis'
import { flightActions, useFlightAnalysis } from './flightAnalysis'
import { useFullData } from './advanced'
import { fmtTonnes } from './flightFormat'
import { Abbr } from './flightGlossary'
import {
  DISPERSION_BRIEF,
  NOT_VALIDATED_TEXT,
  dispersionDetails,
  dispersionMeaning,
  dominantSentence,
  errorText,
  limitSentence,
  payloadSentence,
  progressText,
  routeText,
} from './flightResultText'

const grouped = (v: number) => Math.round(v).toLocaleString('en-US')
/** "+11 kg", "−16 kg", "±0 m/s": the sign of the rounded value, so a difference that rounds to zero has none. */
const signed = (v: number, unit: string, digits = 0) => {
  const r = Number(v.toFixed(digits))
  return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${unit}`
}

/** "not yet validated by the science lead", the marker every new number carries (Trap 2). */
export function Unvalidated() {
  return <span className="flight-unvalidated">{NOT_VALIDATED_TEXT}</span>
}

/** An analysis that failed: one plain sentence with what to do; the technical reason in full data mode. */
function ErrorLine({ what, message }: { what: 'payload' | 'route' | 'dispersion'; message: string }) {
  const [full] = useFullData()
  const e = errorText(what, message)
  return (
    <span className="quiet" role="alert">
      {e.sentence}
      {full && e.detail ? ` (${e.detail})` : ''}
    </span>
  )
}

/** The payload's summary line: the answer, then the marker. */
export function PayloadLine() {
  const { payload } = useFlightAnalysis()
  if (payload.state === 'idle') return null
  return (
    <p className="flight-payload" data-testid="flight-payload" data-state={payload.state} data-verdict={payload.state === 'ready' ? payload.result.verdict : undefined}>
      {payload.state === 'loading' && <span className="quiet">Max payload: working it out… a few seconds.</span>}
      {payload.state === 'error' && <ErrorLine what="payload" message={payload.message} />}
      {payload.state === 'ready' && (
        <>
          <Abbr>{payloadSentence(payload.result)}</Abbr> <Unvalidated />
        </>
      )}
    </p>
  )
}

/** The payload's details: breakdown per phase, the limit, the uncertainty, the assumptions. */
export function PayloadDetails({ p }: { p: PayloadResult }) {
  const limit = limitSentence(p)
  const dominant = dominantSentence(p)
  const showPhases = p.verdict === 'payload' || p.verdict === 'extrapolated'
  return (
    <div className="flight-analysis-body" data-testid="flight-payload-details">
      {limit && <p>{limit}</p>}
      {dominant && <p>{dominant}</p>}
      {showPhases && p.phases.length > 0 && (
        <table className="tbl flight-phases">
          <caption className="quiet">Propellant per phase the cargo rides through: as planned, and at the maximum payload</caption>
          <thead>
            <tr>
              <th scope="col">Phase</th>
              <th scope="col" className="flight-num">
                Planned
              </th>
              <th scope="col" className="flight-num">
                Max payload
              </th>
            </tr>
          </thead>
          <tbody>
            {p.phases.map((ph) => (
              <tr key={ph.phase}>
                <th scope="row" className="flight-name">
                  <Abbr>{ph.label}</Abbr>
                </th>
                <td className="flight-num mono">{fmtTonnes(ph.planPropellantKg)}</td>
                <td className="flight-num mono">{fmtTonnes(ph.propellantKg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {p.terms.length > 1 && (
        <>
          <p className="quiet">
            Uncertainty terms (<Abbr>1σ</Abbr>, combined as a root sum of squares):
          </p>
          <ul className="flight-bullets">
            {p.terms.slice(0, 5).map((t) => (
              <li key={t.id}>
                <Abbr>{t.label}</Abbr>: <span className="mono">±{grouped(t.kg)} kg</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {p.caveats.length > 0 && (
        <ul className="flight-bullets">
          {p.caveats.map((c) => (
            <li key={c}>
              <Abbr>{c}</Abbr>
            </li>
          ))}
        </ul>
      )}
      <p className="quiet">Assumptions:</p>
      <ul className="flight-bullets quiet">
        {p.assumptions.map((a) => (
          <li key={a}>
            <Abbr>{a}</Abbr>
          </li>
        ))}
      </ul>
      {p.sources.length > 0 && (
        <ul className="plain flight-sources">
          {p.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** A job the user starts: the link, then progress with a stop link, then the answer. */
function JobRow<T>({ id, label, hint, job, what, start, cancel, answer }: {
  id: string
  label: string
  hint: string // what the analysis does, in one line, shown until it has an answer
  job: Job<T>
  what: 'route' | 'dispersion'
  start(): void
  cancel(): void
  answer(result: T): ReactNode
}) {
  return (
    <div className="flight-job" data-testid={`flight-${id}`} data-state={job.state}>
      {job.state === 'running' ? (
        <p className="flight-job-progress" role="status">
          <span className="quiet">{progressText(what, job.done, job.total)}</span>{' '}
          <progress className="flight-progress" max={job.total} value={job.done} aria-label={label} />{' '}
          <button type="button" className="link" onClick={cancel}>
            Stop
          </button>
        </p>
      ) : (
        <>
          {job.state === 'ready' && <div className="flight-job-answer">{answer(job.result)}</div>}
          {job.state === 'error' && (
            <p>
              <ErrorLine what={what} message={job.message} />
            </p>
          )}
          <button type="button" className="link flight-job-start" data-testid={`flight-${id}-start`} onClick={start}>
            {job.state === 'ready' ? `${label} again` : label}
          </button>
          {job.state !== 'ready' && <span className="quiet flight-job-hint"> {hint}</span>}
        </>
      )}
    </div>
  )
}

/** The two analyses the user starts, under the result. Not offered where no worker runs. */
export function AnalysisActions() {
  const a = useFlightAnalysis()
  const [full] = useFullData()
  if (!a.canAnalyse) return null
  return (
    <div className="flight-jobs">
      <JobRow
        id="route"
        label="Find cheapest route"
        hint="Plans nearby landing days and transfer limits; compares propellant."
        what="route"
        job={a.route}
        start={flightActions.findRoute}
        cancel={flightActions.cancelRoute}
        answer={(r: RouteComparison) => (
          <p data-testid="flight-route-sentence">
            <Abbr>{routeText(r.sentence)}</Abbr> <Unvalidated />
          </p>
        )}
      />
      <JobRow
        id="dispersion"
        label="Landing dispersion"
        hint="Flies 200 descents with small errors; shows the landing scatter."
        what="dispersion"
        job={a.dispersion}
        start={flightActions.runDispersion}
        cancel={flightActions.cancelDispersion}
        answer={(r) => (
          <>
            <p data-testid="flight-dispersion-sentence">
              <Abbr>{landingSentence(r)}</Abbr>
            </p>
            <p className="quiet" data-testid="flight-dispersion-meaning">
              <Abbr>{full ? dispersionMeaning(r.sigmas) : DISPERSION_BRIEF}</Abbr>
            </p>
          </>
        )}
      />
    </div>
  )
}

/** The per-phase comparison of the cheapest route with the next best (and, in a tie, the first clearly costlier). */
export function RouteDetails({ r }: { r: RouteComparison }) {
  const table = (title: string, rows: RouteComparison['why']) => (
    <table className="tbl flight-phases">
      <caption className="quiet">{title}</caption>
      <thead>
        <tr>
          <th scope="col">Phase</th>
          <th scope="col" className="flight-num">
            <Abbr>Δv</Abbr>
          </th>
          <th scope="col" className="flight-num">
            Propellant
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((w) => (
          <tr key={w.phase}>
            <th scope="row" className="flight-name">
              <Abbr>{w.label}</Abbr>
            </th>
            <td className="flight-num mono">{signed(w.dvDeltaKms * 1000, 'm/s')}</td>
            <td className="flight-num mono">{signed(w.propellantDeltaKg, 'kg')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
  return (
    <div className="flight-analysis-body" data-testid="flight-route-details">
      {r.winner && r.runnerUp && table(`Cheapest minus next best (${r.runnerUp.option.label}); negative: the cheapest needs less`, r.why)}
      {r.tie && r.clearlyWorse && table(`Cheapest minus the first clearly costlier option (${r.clearlyWorse.option.label})`, r.whyVsClearlyWorse)}
      <p className="quiet">
        Compared: {r.ranked.length + r.failed.length} options ({r.ranked.map((x) => x.option.label).join('; ')}). Ranked by total propellant, the launch included; plans that
        run short come last.
      </p>
      {r.caveats.length > 0 && (
        <ul className="flight-bullets">
          {r.caveats.map((c) => (
            <li key={c}>
              <Abbr>{c}</Abbr>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function DispersionDetails() {
  const { dispersion } = useFlightAnalysis()
  if (dispersion.state !== 'ready') return null
  return (
    <ul className="flight-bullets" data-testid="flight-dispersion-details">
      {dispersionDetails(dispersion.result).map((line) => (
        <li key={line}>
          <Abbr>{line}</Abbr>
        </li>
      ))}
      <li className="quiet">
        <Abbr>{dispersion.result.method}</Abbr>
      </li>
    </ul>
  )
}
