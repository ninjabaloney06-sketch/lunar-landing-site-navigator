// The one on-screen validation claim (add-on Task 3, badge). It may say only what docs/event/validation.md records:
// V1 and V2 "passed — reported by ninja in chat, 2026-11-14 15:56 … no written sign-off by Leo in the repo"; every
// other check open. `VALIDATED = true` (data/validation.ts) hides the old "not validated" marker, so this line is
// what tells the reader how far the checks go. Change the wording only when validation.md changes.
// Used by the "Open in NASA tools" section and, through the orchestrator, by the footer in App.tsx.

export const V1_CLAIM = 'Sun and Earth directions checked against JPL Horizons (V1, reported, no written sign-off)'
export const OTHER_CHECKS = 'other checks open'
/** The validation results on the documentation page (docs/documentation.md, "Validation results"). */
export const RECORD_HREF = '/docs#validation-results'
export const RECORD_LABEL = 'see record'
