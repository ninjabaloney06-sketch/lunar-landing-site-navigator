// Greyed examples in the free-text fields (U6; ninja, 14 Nov: "add a grayed out 'example' for the text inputs, like
// lat:123.45 lon:123.45"). Each example is accepted exactly as written after "e.g. " (e2e/ui.spec.ts types them in).
// The coordinates are Connecting Ridge's as sites.json gives them (89.46° S, 136.68° W, from its source_url there),
// in the lat/lon form parseCoords reads; the dates are the demo period's first and last day.
export const EXAMPLE = {
  coords: 'lat -89.46 lon -136.68',
  name: 'Ridge survey',
  start: '16 Aug 2027',
  end: '29 Aug 2027',
  point: 'Rim camp',
} as const

export const eg = (s: string) => `e.g. ${s}`
