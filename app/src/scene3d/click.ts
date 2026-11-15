// What a click (not a drag) at site or eye level does with the thing under the pointer (index.ts onUp).
// Bug of 15 Nov night ("switching from one landing site to another fails in the landing-site view"): another
// landing site's pin was named on hover, but its click fell through to the walk and nothing happened.

export type ClickTarget = { kind: 'site'; id: string } | { kind: 'point'; index: number } | { kind: 'poi'; id: string } | null

export type ClickAction =
  /** Select that landing site: onPick with the site's own coordinates, as its pin on the globe does. */
  | { act: 'pick'; lat: number; lon: number }
  /** Nothing: the current site's own pin, or a POI pin (its info box belongs to the page). */
  | { act: 'none' }
  /** A click on terrain or a user point: a possible first or second click of a walk. */
  | { act: 'walk' }

export function siteLevelClick(under: ClickTarget, currentSiteId: string | null, sites: readonly { id: string; lat: number; lon: number }[]): ClickAction {
  if (under?.kind === 'site') {
    const s = sites.find((x) => x.id === under.id)
    return s && s.id !== currentSiteId ? { act: 'pick', lat: s.lat, lon: s.lon } : { act: 'none' }
  }
  if (under?.kind === 'poi') return { act: 'none' }
  return { act: 'walk' }
}
