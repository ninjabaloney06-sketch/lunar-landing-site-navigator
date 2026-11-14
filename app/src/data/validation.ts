// ONE switch for the "not validated" marker (integrator, 14 Nov). No V-check is signed yet, so every computed
// number carries the marker. The integrator flips VALIDATED to true after Leo signs; the footer and every view
// that shows numbers read it, so the marker disappears everywhere at once.
export const VALIDATED = false

export const NOT_VALIDATED = 'sample values — not validated'
