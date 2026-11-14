// Answer sentence wording (Brief A rules; Leo approves the wording, Isaac approves visible text).
// CONTRACT (integrator, 14 Nov): the A-h agent owns this file and implements answerSentence;
// AnswerState and AnswerLines stay as they are unless the integrator agrees.

export interface AnswerState {
  sunLit: boolean
  sunHoursToChange: number // hours from the cursor to the next lit/dark change (or to the period end)
  sunChangeInPeriod: boolean // false → no change before the period ends
  sunSinceStart?: boolean // true → the current state already held at the period start (one window only)
  comms: 'covered' | 'none' | 'unknown'
  commsHoursToChange: number // hours to the next coverage change (or to the period end)
  commsChangeInPeriod: boolean
  commsSinceStart?: boolean // true → the current coverage state already held at the period start
  anyCoverageInPeriod: boolean // false → "No selected station can reach this site in this period."
  earthEverRises: boolean // false → "Earth never rises here."
}

export interface AnswerLines {
  sun: string // rendered in sunlight yellow
  comms: string // rendered in comms blue
}

// Durations: >= 48 h → whole days; < 48 h → whole hours. Remaining good time (sunlight, contact) is rounded
// down and waiting time (dark, no contact) is rounded up, so the sentence never promises more than the data:
// 71.9 h until the next contact reads "3 days", not "2 days".
// Under 1 hour there is no whole hour to show, so a separate wording applies (proposed case c).
function quantity(hours: number, up: boolean): { n: number; unit: 'day' | 'hour' } {
  const round = up ? Math.ceil : Math.floor
  if (hours >= 48) return { n: round(hours / 24), unit: 'day' }
  return { n: round(hours), unit: 'hour' }
}

function unitWord({ n, unit }: { n: number; unit: 'day' | 'hour' }): string {
  return `${unit}${n === 1 ? '' : 's'}`
}

// "3 days" / "47 hours" / "1 hour" (a wait: rounded up)
function count(hours: number): string {
  const q = quantity(hours, true)
  return `${q.n} ${unitWord(q)}`
}

// "2 more days" / "47 more hours" / "1 more hour"
function moreCount(hours: number, up: boolean): string {
  const q = quantity(hours, up)
  return `${q.n} more ${unitWord(q)}`
}

function sunLine(s: AnswerState): string {
  // Proposed case (a): no lit/dark change before the period ends.
  // "throughout" only when the state also held at the period start; otherwise it holds only until the end.
  if (!s.sunChangeInPeriod) {
    if (s.sunSinceStart !== false) {
      return s.sunLit ? 'Sunlight throughout this period.' : 'Dark throughout this period.'
    }
    return s.sunLit ? 'Sunlight until the end of this period.' : 'Dark until the end of this period.'
  }
  // Proposed case (c): under 1 hour to the change.
  if (s.sunHoursToChange < 1) {
    return s.sunLit ? 'Sunlight ends in under 1 hour.' : 'Sunlight returns in under 1 hour.'
  }
  return s.sunLit
    ? `Sunlight for ${moreCount(s.sunHoursToChange, false)}.`
    : `Dark for ${moreCount(s.sunHoursToChange, true)}.`
}

function commsLine(s: AnswerState): string {
  if (!s.earthEverRises) return 'Earth never rises here.'
  // Proposed case (b): unknown must never read as contact, nor as a definite "no". Link inputs are not modelled yet.
  if (s.comms === 'unknown') return 'Station contact unknown: link inputs are missing.'
  if (!s.anyCoverageInPeriod) return 'No selected station can reach this site in this period.'
  const covered = s.comms === 'covered'
  // Proposed case (a): no coverage change before the period ends.
  if (!s.commsChangeInPeriod) {
    if (s.commsSinceStart !== false) {
      return covered ? 'Station contact throughout this period.' : 'No station contact throughout this period.'
    }
    return covered ? 'Station contact until the end of this period.' : 'No station contact until the end of this period.'
  }
  // Proposed case (c): under 1 hour to the change.
  if (s.commsHoursToChange < 1) {
    return covered ? 'Station contact ends in under 1 hour.' : 'Next station contact in under 1 hour.'
  }
  return covered
    ? `Station contact for ${moreCount(s.commsHoursToChange, false)}.`
    : `Next station contact in ${count(s.commsHoursToChange)}.`
}

export function answerSentence(s: AnswerState): AnswerLines {
  return { sun: sunLine(s), comms: commsLine(s) }
}
