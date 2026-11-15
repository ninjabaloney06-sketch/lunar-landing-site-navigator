// ONE switch for the "not validated" marker (integrator, 14 Nov). The footer and every view that shows numbers
// read it, so the marker appears or disappears everywhere at once.
// Set to true on 14 Nov 2026 by ninja's decision ("Yes, remove it") after the independent recomputation by AI
// recorded in docs/event/validation.md ("Independent recomputation by AI"). Since 15 Nov 2026 it also stands on the
// science lead's statement of 15 Nov 2026, 08:50, in chat ("validated everything means EVERYTHING"), recorded in
// docs/event/validation.md, section "Validation status 15 Nov"; that statement has no per-check record of what was
// compared, and no row of that file is signed by it.
export const VALIDATED = true

/** Shown only while VALIDATED is false (never in this build). */
export const NOT_VALIDATED = 'sample values — not validated'
