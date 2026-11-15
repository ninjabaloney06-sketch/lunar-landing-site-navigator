// The "Solar system — top view" was removed by U14 (ninja, 15 Nov 2026). What is left is its display constants,
// which the drawer's text still quotes (views/Drawer.tsx, owned by another agent: the diff that removes that text
// and this file is in cam's report).

/** Display radii and display distances from the Moon, in units of the drawn Moon radius (the removed top view). */
export const TOP_VIEW = {
  radius: { moon: 1, earth: 2, sun: 3 },
  dist: { earth: 6, sun: 14 },
}
