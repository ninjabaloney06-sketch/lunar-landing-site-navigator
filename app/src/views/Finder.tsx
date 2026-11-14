// Find better dates (Track A's finder). Defaults from FINDER_DEFAULTS; every threshold is editable and
// validated before the search runs (never NaN). Ranked by combined selected-station coverage (spec).
import { useState } from 'react'
import { FINDER_DEFAULTS, finder } from '../geometry'
import type { FinderResult, FinderThresholds } from '../geometry'
import { loadHorizon, loadMonthsFor } from '../data/load'
import type { Site, Station } from '../data/types'
import { NOT_VALIDATED, VALIDATED } from '../data/validation'
import { COVERAGE_END_MS, DAY_MS } from '../state'
import { capital, fmtDay, fmtHours, fmtPct, fmtRange, fmtShort } from './format'

const FIELDS: { key: keyof FinderThresholds; label: string; min: number; max: number }[] = [
  { key: 'missionDays', label: 'Mission length, days', min: 1, max: 60 },
  { key: 'minLitPct', label: 'Sunlit at least, %', min: 0, max: 100 },
  { key: 'minCoveragePct', label: 'Station coverage at least, %', min: 0, max: 100 },
  { key: 'maxGapH', label: 'Longest coverage gap at most, h', min: 0, max: 720 },
  { key: 'maxDarkH', label: 'Longest darkness at most, h', min: 0, max: 720 },
]

const SEARCH_DAYS = 60

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

  const latestMs = Math.min(fromMs + SEARCH_DAYS * DAY_MS, COVERAGE_END_MS - Number(values.missionDays || 14) * DAY_MS)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: string[] = []
    const t = {} as FinderThresholds
    for (const f of FIELDS) {
      const v = Number(values[f.key])
      if (values[f.key].trim() === '' || !Number.isFinite(v) || v < f.min || v > f.max) errs.push(`${f.label}: a number from ${f.min} to ${f.max}.`)
      else t[f.key] = v
    }
    setErrors(errs)
    if (errs.length) return
    setRun({ status: 'running' })
    try {
      const months = await loadMonthsFor(fromMs, latestMs + t.missionDays * DAY_MS)
      if (!months) {
        setRun({ status: 'message', text: 'This build has no ephemeris for these dates yet, so the finder cannot run.' })
        return
      }
      const horizon = site.horizon ? await loadHorizon(site.horizon) : null
      const result = finder(months, { lat: site.lat, lon: site.lon, elev_m: site.elev_m }, horizon, stations, ids, fromMs, latestMs, t)
      setRun({ status: 'done', result, t })
    } catch (err) {
      setRun({
        status: 'message',
        text: `The finder failed: ${(err as Error).message}`,
      })
    }
  }

  return (
    <div className="finder">
      <p className="quiet">
        Landing between {fmtDay(fromMs)} and {fmtDay(latestMs)} {new Date(latestMs).getUTCFullYear()}, with the stations selected above.
      </p>
      <form className="finder-form" onSubmit={submit} noValidate>
        {FIELDS.map((f) => (
          <label key={f.key} className="finder-field">
            <span>{f.label}</span>
            <input
              className="field mono"
              type="number"
              inputMode="decimal"
              min={f.min}
              max={f.max}
              value={values[f.key]}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          </label>
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
            <p className="msg">
              No landing date meets every threshold.
              {run.result.nearestMiss &&
                ` Closest: ${fmtShort(run.result.nearestMiss.landingMs)} UTC, which misses ${run.result.nearestMiss.failed
                  .map((k) => FIELDS.find((f) => f.key === k)?.label.split(',')[0].toLowerCase())
                  .join(', ')}.`}
            </p>
          )}
          {run.result.windows.length > 0 && (
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Land between</th>
                  <th scope="col">Sunlit</th>
                  <th scope="col">Coverage</th>
                  <th scope="col">Gap</th>
                  <th scope="col">
                    <span className="sr-only">Show</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {run.result.windows.slice(0, 5).map((w) => (
                  <tr key={w.startMs}>
                    <td>{fmtRange(w.startMs, Math.max(w.endMs, w.startMs + DAY_MS))}</td>
                    <td className="mono">{fmtPct(w.best.litPct)}</td>
                    <td className="mono">{fmtPct(w.best.coveragePct)}</td>
                    <td className="mono">{fmtHours(w.best.longestGapH)}</td>
                    <td>
                      <button className="link" type="button" onClick={() => onShow(w.best.landingMs, run.t.missionDays, w.best.landingMs)}>
                        Show
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!VALIDATED && <p className="quiet">{capital(NOT_VALIDATED)}.</p>}
        </div>
      )}
    </div>
  )
}
