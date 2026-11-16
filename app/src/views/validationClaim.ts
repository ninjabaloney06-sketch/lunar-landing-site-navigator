// The one on-screen validation claim for the app as a whole (add-on Task 3, badge; wording from the validation audit,
// 15 Nov). It may say only what docs/event/validation.md records: section "Validation status 15 Nov" records the
// science lead's statement of 15 Nov 2026, 08:50, in chat ("validated everything means EVERYTHING"), with no per-check
// record of what was compared. By the science lead's decision of 16 Nov 2026 the app does not say "validated by the
// science lead" until the record is signed: validation.md ("What the app's validation sentence rests on", "Open for
// the science lead's signature") shows that no item has a written sign-off, so the claim is worded as what the
// record holds, a statement: "stated as validated by the science lead", dated, "no per-check sign-off", and a link
// to the record; never "verified", "certified" or a comparison that is not recorded. What was built after the
// statement is not covered by it and is named in the documentation ("Validation results"). Change the wording only
// when validation.md changes.
// Rendered as `${V1_CLAIM}; ${OTHER_CHECKS}: <a>${RECORD_LABEL}</a>` by the "Open in NASA tools" section and the
// footer in App.tsx (the export names are kept so those two files need no change).

export const V1_CLAIM = 'Computed results stated as validated by the science lead'
export const OTHER_CHECKS = '15 Nov 2026, no per-check sign-off'
/** The validation results on the documentation page (docs/documentation.md, "Validation results"). */
export const RECORD_HREF = '/docs#validation-results'
export const RECORD_LABEL = 'see record'
