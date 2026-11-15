// Find better dates (Track A's finder). Defaults from FINDER_DEFAULTS; every threshold is editable and
// validated before the search runs (never NaN). Ranked by combined selected-station coverage (spec).
import { useState } from 'react'
import { FINDER_DEFAULTS, finder } from '../geometry'
import type { FinderResult, FinderThresholds } from '../geometry'
import { loadMonthsFor } from '../data/load'
import { finderInputs } from '../data/results'
import type { Site, Station } from '../data/types'
import { NOT_VALIDATED, VALIDATED } from '../data/validation'
import { DAY_MS } from '../state'
import { capital, fmtDate, fmtPct, fmtShort } from './format'
import { fmtDuration } from './period'
import { landingSpan } from './finderSpan'

// Label in NASA's terms with its unit; `short` names the threshold in the nearest-miss sentence; `hint` says what a
// planner sets it to (one line, the default named from FINDER_DEFAULTS).
const FIELDS: { key: keyof FinderThresholds; label: string; short: string; hint: string; min: number; max: number; integer?: true }[] = [
  // whole days: the custom period in the URL only accepts whole days, so "Show" must open exactly what was scored
  { key: 'missionDays', label: 'Mission length (days)', short: 'mission length', hint: 'Your planned surface stay, whole days.', min: 1, max: 60, integer: true },
  { key: 'minLitPct', label: 'Sunlit at least (%)', short: 'sunlit share', hint: 'Any part of the Sun disc above the terrain. Raise for solar power.', min: 0, max: 100 },
  { key: 'minCoveragePct', label: 'Station coverage at least (%)', short: 'station coverage', hint: 'Line of sight to at least one selected station.', min: 0, max: 100 },
  { key: 'maxGapH', label: 'Longest coverage gap at most (h)', short: 'coverage gap', hint: 'Longest time with no station in view; your loss-of-signal limit.', min: 0, max: 720 },
  { key: 'maxDarkH', label: 'Longest darkness at most (h)', short: 'darkness', hint: 'Longest night the lander must survive on batteries.', min: 0, max: 720 },
]

const unitOf = (k: keyof FinderThresholds) => (k === 'missionDays' ? ' days' : k === 'maxGapH' || k === 'maxDarkH' ? ' h' : ' %')

/** "the sunlit share and coverage gap" */
const joinAnd = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)


/** Landing times are candidates 30 min apart and the window's end is the LAST qualifying landing time
 *  (inclusive), so fmtRange (exclusive end) would drop or add a day. "16 Aug 2027, 18:00 UTC" for one
 *  candidate, "16 Aug 2027, 06:00 – 18 Aug 2027, 00:00 UTC" for a range. */
function fmtLandingRange(startMs: number, endMs: number): React.ReactNode {
  return (
    <>
      {endMs <= startMs ? fmtShort(startMs) : `${fmtShort(startMs)} – ${fmtShort(endMs)}`} <abbr title={UTC_LONG}>UTC</abbr>
    </>
  )
}

const UTC_LONG = 'Coordinated Universal Time'


interface Props {
  site: Site
  stations: Station[]
  ids: string[]
  fromMs: number
  onShow(startMs: number, days: number, landingMs: number): void
}

type Run = { status: 'idle' } | { status: 'running' } | { status: 'done'; result: FinderResult; t: FinderThresholds } | { status: 'message'; text: string }

export function Finder({ site, stations, ids, fromMs, onShow }: Props) {
  const [values, setValues] = useState<Record<keyof FinderThresholds, string>>(
    () => Object.fromEntries(FIELDS.map((f) => [f.key, String(FINDER_DEFAULTS[f.key])])) as Record<keyof FinderThresholds, string>,
  )
  const [errors, setErrors] = useState<string[]>([])
  const [run, setRun] = useState<Run>({ status: 'idle' })

  // An invalid mission length while typing must not turn the date line into "NaN": fall back to the default.
  const typedDays = Number(values.missionDays)
  const daysForRange =
    Number.isInteger(typedDays) && typedDays >= 1 && typedDays <= 60 ? typedDays : FINDER_DEFAULTS.missionDays
  // Never empty, never ending before it starts (the mission may start less than one mission length before the
  // end of the data coverage: then the span moves back to the last landing that fits).
  const { startMs, latestMs } = landingSpan(fromMs, daysForRange)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: string[] = []
    const t = {} as FinderThresholds
    for (const f of FIELDS) {
      const v = Number(values[f.key])
      if (values[f.key].trim() === '' || !Number.isFinite(v) || v < f.min || v > f.max || (f.integer && !Number.isInteger(v)))
        errs.push(`${f.label}: a ${f.integer ? 'whole number' : 'number'} from ${f.min} to ${f.max}.`)
      else t[f.key] = v
    }
    setErrors(errs)
    if (errs.length) return
    setRun({ status: 'running' })
    try {
      const span = landingSpan(fromMs, t.missionDays)
      const months = await loadMonthsFor(span.startMs, span.latestMs + t.missionDays * DAY_MS)
      if (!months) {
        setRun({ status: 'message', text: 'This build has no ephemeris for these dates yet, so the finder cannot run.' })
        return
      }
      const { geo, horizon } = await finderInputs(site)
      const result = finder(months, geo, horizon, stations, ids, span.startMs, span.latestMs, t)
      setRun({ status: 'done', result, t })
    } catch (err) {
      setRun({
        status: 'message',
        text: `The finder failed: ${(err as Error).message}`,
      })
    }
  }

  const n = ids.length
  return (
    <div className="finder">
      <p className="quiet sec-lead" data-testid="finder-lead">
        Landing between {fmtDate(startMs)} and {fmtDate(latestMs)}, with {n} selected {n === 1 ? 'station' : 'stations'}.
        Landing times tried every 30 minutes; best station coverage first. Defaults are proposals the science lead
        reviews.
      </p>
      <form className="finder-form" onSubmit={submit} noValidate>
        {FIELDS.map((f) => (
          <div key={f.key} className="finder-field">
            <label htmlFor={`finder-${f.key}`}>{f.label}</label>
            <input
              id={`finder-${f.key}`}
              className="field mono"
              type="number"
              inputMode="decimal"
              min={f.min}
              max={f.max}
              aria-describedby={`finder-${f.key}-hint`}
              data-testid={`finder-${f.key}`}
              value={values[f.key]}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
            <span id={`finder-${f.key}-hint`} className="finder-hint" data-testid="finder-hint">
              {f.hint} Default {FINDER_DEFAULTS[f.key]}
              {unitOf(f.key)}.
            </span>
          </div>
        ))}
        <button className="btn" type="submit" disabled={run.status === 'running'}>
          {run.status === 'running' ? 'Searching…' : 'Find dates'}
        </button>
      </form>
      {errors.map((m) => (
        <p key={m} className="msg is-error" role="alert">
          {m}
        </p>
      ))}
      {run.status === 'message' && (
        <p className="msg" role="status">
          {run.text}
        </p>
      )}
      {run.status === 'done' && (
        <div className="finder-results" role="status">
          {run.result.windows.length === 0 && (
            <p className="msg" data-testid="finder-none">
              No landing time meets every threshold.
              {run.result.nearestMiss &&
                ` Closest: ${fmtShort(run.result.nearestMiss.landingMs)} UTC, which misses the ${joinAnd(
                  run.result.nearestMiss.failed.map((k) => FIELDS.find((f) => f.key === k)?.short ?? k),
                )} ${run.result.nearestMiss.failed.length === 1 ? 'threshold' : 'thresholds'}.`}
            </p>
          )}
          {run.result.windows.length > 0 && (
            <>
              <p className="quiet">
                {run.result.windows.length} landing {run.result.windows.length === 1 ? 'window meets' : 'windows meet'} every threshold
                {run.result.windows.length > 5 ? '; the best 5 are shown' : ''}. Values for the best landing time in each window.
              </p>
              <table className="tbl" data-testid="finder-table">
                <thead>
                  <tr>
                    <th scope="col">Land between</th>
                    <th scope="col">Sunlit</th>
                    <th scope="col">Station coverage</th>
                    <th scope="col">Longest gap</th>
                    <th scope="col">
                      <span className="sr-only">Show</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {run.result.windows.slice(0, 5).map((w) => (
                    <tr key={w.startMs}>
                      <td>{fmtLandingRange(w.startMs, w.endMs)}</td>
                      <td className="mono">{fmtPct(w.best.litPct)}</td>
                      <td className="mono">{fmtPct(w.best.coveragePct)}</td>
                      <td className="mono">{fmtDuration(w.best.longestGapH)}</td>
                      <td>
                        <button className="link" type="button" onClick={() => onShow(w.best.landingMs, run.t.missionDays, w.best.landingMs)}>
                          Show
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {!VALIDATED && <p className="quiet">{capital(NOT_VALIDATED)}.</p>}
        </div>
      )}
    </div>
  )
}
