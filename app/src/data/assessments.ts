// Site assessments: public/data/assessments.json, written by scripts/assessments.py (method and evidence in
// docs/event/validation.md, "Mandatory site assessments"). Fetched once, the first time the Site assessment section
// in the Details drawer is opened, never at start: the same pattern as pois.json (data/load.loadPois), one request
// per session, a failed request forgotten so the next opening retries.
//
// The file is read as `unknown` and checked field by field in views/assessmentView.ts: every value shown is a value
// of this file, and a missing or malformed field shows as "unknown", never as NaN or undefined.
import { MissingDataError } from './load'

export const ASSESSMENTS_FILE = 'assessments.json'

let pending: Promise<unknown> | null = null

async function fetchAssessments(): Promise<unknown> {
  // Same checks as data/load.getJson (not exported there): 404 or the SPA page = not in this build.
  const res = await fetch(`${import.meta.env.BASE_URL}data/${ASSESSMENTS_FILE}`)
  if (res.status === 404) throw new MissingDataError(`${ASSESSMENTS_FILE}: not in this build`)
  if (!res.ok) throw new Error(`${ASSESSMENTS_FILE}: HTTP ${res.status}`)
  if ((res.headers.get('content-type') ?? '').includes('text/html')) {
    throw new MissingDataError(`${ASSESSMENTS_FILE}: not in this build`)
  }
  try {
    return (await res.json()) as unknown
  } catch {
    throw new Error(`${ASSESSMENTS_FILE}: not valid JSON`)
  }
}

/** The parsed file (not yet checked). */
export function loadAssessments(): Promise<unknown> {
  if (!pending) {
    const p = fetchAssessments()
    pending = p
    p.catch(() => {
      if (pending === p) pending = null
    })
  }
  return pending
}
