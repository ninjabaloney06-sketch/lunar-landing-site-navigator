// Points of interest (POIs): contract shared by the data pipeline (scripts/pois.py → public/data/pois.json),
// the 3D scene (scene3d, through ScenePoi) and the views. Source records: docs/POIs/*.json.
// Only records with a point geometry become POIs; regional findings without coordinates are not pins.

/** One colour and one toggle per group. */
export type PoiGroup = 'hazard' | 'water' | 'cold-trap' | 'light' | 'landing' | 'science'

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
}

export interface PoiGroupInfo {
  id: PoiGroup
  label: string
  color: string // CSS hex; the scene draws the pin in this colour, the views use it for the key
}

/** Order of the toggles and the key. Colours are placeholders until the views track sets the final ones. */
export const POI_GROUPS: PoiGroupInfo[] = [
  { id: 'hazard', label: 'Hazards', color: '#e5484d' },
  { id: 'water', label: 'Water and volatiles', color: '#4aa8ff' },
  { id: 'cold-trap', label: 'Permanent shadow', color: '#8e7cf0' },
  { id: 'light', label: 'Sunlit points', color: '#f2c94c' },
  { id: 'landing', label: 'Landing sites', color: '#e8e6e1' },
  { id: 'science', label: 'Science features', color: '#3ecf8e' },
]
