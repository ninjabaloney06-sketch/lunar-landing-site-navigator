// Points of interest (POIs): contract shared by the data pipeline (scripts/pois.py → public/data/pois.json),
// the 3D scene (scene3d, through ScenePoi) and the views. Source records: docs/POIs/*.json.
// Only records with a point geometry become POIs; regional findings without coordinates are not pins.

import type { Site } from './types'

/** One colour and one toggle per group. */
export type PoiGroup = 'hazard' | 'water' | 'cold-trap' | 'light' | 'landing' | 'science'

/** Plain summary text of one record (U8, docs/POIs/plain.json merged by scripts/pois.py): every fact in it comes
 *  from that record's fields. bullets may be empty (thin records: the card shows name and type only). */
export interface PoiPlain {
  type: string // plain feature type, e.g. "Host crater", "Permanently shadowed region"
  bullets: string[] // 0-3 short lines for the summary card
}

export interface PoiFact {
  label: string
  value: string
}

/** One record of pois.json. Coordinates: planetocentric degrees, MOON_ME assumed where the source names no frame. */
export interface Poi {
  id: string // unique over all groups: "<group>:<source id>"
  name: string
  group: PoiGroup
  category: string // the source record's category, e.g. "hazard_scarp"
  lat: number // south negative
  lon: number // east-positive, -180..180
  summary: string // one or two plain sentences taken from the record (notes, science value, location note); '' if none
  facts: PoiFact[] // a few short values from the record's properties, as written there
  evidence: string | null
  limitations: string | null
  sources: string[] // URLs; at least one (a record without a source is not shipped)
  siteId: string | null // id in sites.json when the record is one of the app's landing sites
  plain?: PoiPlain // absent when plain.json is missing or has no entry for this id
}

export interface PoiGroupInfo {
  id: PoiGroup
  label: string
  color: string // CSS hex; the scene draws the pin in this colour, the views use it for the key
}

/** Order of the toggles and the key. Final colours (UI track, 14 Nov): hazards red and water blue as ninja asked; the
 *  others chosen to differ from each other, from the Sun yellow and comms blue tokens and from the white site pins
 *  (closest pairs in OKLab: water–permanent shadow 0.125, sunlit–Sun 0.126). Contrast on the space background
 *  #0b0d11 is 5.2:1 (water) to 9.7:1 (science); on sunlit grey terrain (#8b8781) only 1.0–1.8:1, so a pin needs an
 *  outline there, and the key never relies on hue alone (the name stands beside each swatch).
 *  15 Nov (visual sweep item 20): landing candidates were pink #f387c7, too close to the purple of permanent shadow;
 *  now cyan, OKLab distance 0.26 to permanent shadow, 0.17 to science, 0.14 to the comms token (the closest pair
 *  stays water–permanent shadow 0.125). Label "Landing candidates", so the key's count (published candidate points
 *  that are not one of the app's own sites) no longer reads as a second count of the app's landing sites. */
export const POI_GROUPS: PoiGroupInfo[] = [
  { id: 'hazard', label: 'Hazards', color: '#f9423d' }, // oklch(65% 0.22 27)
  { id: 'water', label: 'Water and volatiles', color: '#3d7efc' }, // oklch(62% 0.20 262)
  { id: 'cold-trap', label: 'Permanent shadow', color: '#a27dfa' }, // oklch(68% 0.18 295)
  { id: 'light', label: 'Sunlit points', color: '#fb9a32' }, // oklch(77% 0.16 62)
  { id: 'landing', label: 'Landing candidates', color: '#67def2' }, // oklch(84% 0.11 210)
  { id: 'science', label: 'Science features', color: '#57ce70' }, // oklch(76% 0.17 148)
]

/** One record of search-sites.json (terrain track): a POI point with its own horizon file, shaped like a site.
 *  id "poi-<group>-<record id>" (lowercase, hyphens); poi_id is the Poi.id it was made from. */
export interface SearchSite extends Site {
  poi_id: string
}
