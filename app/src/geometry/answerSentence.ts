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

export function answerSentence(s: AnswerState): AnswerLines {
  void s
  throw new Error('answerSentence: not implemented yet (Track A, A-h agent)')
}
