// The one on-screen validation claim for the app as a whole (add-on Task 3, badge; wording from the validation audit,
// 15 Nov). It may say only what docs/event/validation.md records: section "Validation status 15 Nov" records the
// science lead's statement of 15 Nov 2026, 08:50, in chat ("validated everything means EVERYTHING"), with no per-check
// record of what was compared. So: "validated by the science lead", dated, and a link to the record; never
// "verified", "certified" or a comparison that is not recorded. Change the wording only when validation.md changes.
// Rendered as `${V1_CLAIM}; ${OTHER_CHECKS}: <a>${RECORD_LABEL}</a>` by the "Open in NASA tools" section and the
// footer in App.tsx (the export names are kept so those two files need no change).

export const V1_CLAIM = 'All computed results validated by the science lead'
export const OTHER_CHECKS = 'statement of 15 Nov 2026'
/** The validation results on the documentation page (docs/documentation.md, "Validation results"). */
export const RECORD_HREF = '/docs#validation-results'
export const RECORD_LABEL = 'see record'
