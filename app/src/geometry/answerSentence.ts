// Answer sentence wording (Brief A rules; Leo approves the wording, Isaac approves visible text).
// CONTRACT (integrator, 14 Nov): the A-h agent owns this file and implements answerSentence;
// AnswerState and AnswerLines stay as they are unless the integrator agrees.

export interface AnswerState {
  sunLit: boolean
  sunHoursToChange: number // hours from the cursor to the next lit/dark change (or to the period end)
  sunChangeInPeriod: boolean // false → no change before the period ends
  comms: 'covered' | 'none' | 'unknown'
  commsHoursToChange: number // hours to the next coverage change (or to the period end)
  commsChangeInPeriod: boolean
  anyCoverageInPeriod: boolean // false → "No selected station can reach this site in this period."
  earthEverRises: boolean // false → "Earth never rises here."
}

export interface AnswerLines {
  sun: string // rendered in sunlight yellow
  comms: string // rendered in comms blue
}

// Durations: >= 48 h → whole days (rounded down); < 48 h → whole hours (rounded down).
// Under 1 hour there is no whole hour to show, so a separate wording applies (proposed case c).
function quantity(hours: number): { n: number; unit: 'day' | 'hour' } {
  if (hours >= 48) return { n: Math.floor(hours / 24), unit: 'day' }
  return { n: Math.floor(hours), unit: 'hour' }
}

function unitWord({ n, unit }: { n: number; unit: 'day' | 'hour' }): string {
  return `${unit}${n === 1 ? '' : 's'}`
}

// "2 days" / "47 hours" / "1 hour"
function count(hours: number): string {
  const q = quantity(hours)
  return `${q.n} ${unitWord(q)}`
}

// "2 more days" / "47 more hours" / "1 more hour"
function moreCount(hours: number): string {
  const q = quantity(hours)
  return `${q.n} more ${unitWord(q)}`
}

function sunLine(s: AnswerState): string {
  // Proposed case (a): no lit/dark change before the period ends.
  if (!s.sunChangeInPeriod) {
    return s.sunLit ? 'Sunlight throughout this period.' : 'Dark throughout this period.'
  }
  // Proposed case (c): under 1 hour to the change.
  if (s.sunHoursToChange < 1) {
    return s.sunLit ? 'Sunlight ends in under 1 hour.' : 'Sunlight returns in under 1 hour.'
  }
  return s.sunLit
    ? `Sunlight for ${moreCount(s.sunHoursToChange)}.`
    : `Dark for ${moreCount(s.sunHoursToChange)}.`
}

function commsLine(s: AnswerState): string {
  if (!s.earthEverRises) return 'Earth never rises here.'
  if (!s.anyCoverageInPeriod) return 'No selected station can reach this site in this period.'
  // Proposed case (b): unknown must never read as contact. Link inputs are not modelled yet.
  if (s.comms === 'unknown') return 'Station contact unknown: link inputs are missing.'
  const covered = s.comms === 'covered'
  // Proposed case (a): no coverage change before the period ends.
  if (!s.commsChangeInPeriod) {
    return covered ? 'Station contact throughout this period.' : 'No station contact throughout this period.'
  }
  // Proposed case (c): under 1 hour to the change.
  if (s.commsHoursToChange < 1) {
    return covered ? 'Station contact ends in under 1 hour.' : 'Next station contact in under 1 hour.'
  }
  return covered
    ? `Station contact for ${moreCount(s.commsHoursToChange)}.`
    : `Next station contact in ${count(s.commsHoursToChange)}.`
}

export function answerSentence(s: AnswerState): AnswerLines {
  return { sun: sunLine(s), comms: commsLine(s) }
}
