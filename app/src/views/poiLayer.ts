// Points of interest for the layer, the info box and the search (U2–U4). pois.json is fetched once, the first
// time the layer or the search is opened (data/load.loadPois), never at start.
// Only POIs inside the pin region (scene3d/region.inPinRegion) are used anywhere in the app.
import { useEffect, useRef, useState } from 'react'
import { loadPois } from '../data/load'
import { POI_GROUPS } from '../data/pois'
import type { Poi, PoiGroup } from '../data/pois'
import { customSiteId } from '../data/customSite'
import { loadMissionInputs, loadPoiSite } from '../data/poiHorizon'
import type { SearchSite } from '../data/pois'
import type { Period, Site, Station } from '../data/types'
import type { ScenePoi } from '../scene3d'
import { PIN_REGION_NORTH_LAT, inPinRegion } from '../scene3d/region'
import { MOON_RADIUS_KM, rankSites } from '../geometry'
import type { Summary } from '../geometry'
import { parseHash } from '../state'
import { fmtDeg, fmtPct } from './format'
import { resolvePeriod } from './period'
import { useSiteRows } from './useSiteRows'
import type { RowEntry } from './useSiteRows'

export type PoiData =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; pois: Poi[]; byId: Map<string, Poi> } // pois: inside the pin region only
  | { status: 'error'; error: string }

/** Starts loading the first time `wanted` is true and keeps the data; a failed load is retried the next time
 *  `wanted` turns true (the layer or the search is opened again). */
export function usePois(wanted: boolean): PoiData {
  const [data, setData] = useState<PoiData>({ status: 'idle' })
  const now = useRef(data)
  now.current = data
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (!wanted || now.current.status === 'ready' || now.current.status === 'loading') return
    setData({ status: 'loading' })
    loadPois().then(
      (all) => {
        const pois = all.filter((p) => inPinRegion(p.lat))
        if (mounted.current) setData({ status: 'ready', pois, byId: new Map(pois.map((p) => [p.id, p])) })
      },
      (e: Error) => mounted.current && setData({ status: 'error', error: e.message }),
    )
  }, [wanted])
  return data
}

export const groupInfo = (g: PoiGroup) => POI_GROUPS.find((x) => x.id === g)!

/** "south of 80° S", from the shared constant. */
export const REGION_TEXT = `south of ${Math.abs(PIN_REGION_NORTH_LAT)}° S`

/** A landing record that is one of the app's sites is drawn once, as that site's pin. */
const isSitePin = (p: Poi, siteIds: Set<string>) => p.group === 'landing' && p.siteId !== null && siteIds.has(p.siteId)

/** The pins of the chosen groups, as the scene draws them. */
export function scenePois(pois: Poi[], groups: PoiGroup[], sites: Site[]): ScenePoi[] {
  const ids = new Set(sites.map((s) => s.id))
  return pois
    .filter((p) => groups.includes(p.group) && !isSitePin(p, ids))
    .map((p) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, color: groupInfo(p.group).color, landing: p.group === 'landing' }))
}

/** Pins per group (what the key counts). */
export function pinCounts(pois: Poi[], sites: Site[]): Record<PoiGroup, number> {
  const ids = new Set(sites.map((s) => s.id))
  const out = Object.fromEntries(POI_GROUPS.map((g) => [g.id, 0])) as Record<PoiGroup, number>
  for (const p of pois) if (!isSitePin(p, ids)) out[p.group]++
  return out
}

// ---------- the info card's two modes (U8) ----------

/** "84.90° S, 35.50° W" (the full data card's coordinates; never raw signed decimals). */
export function fmtLatLon(lat: number, lon: number, sep = ', '): string {
  const lo = ((((lon + 180) % 360) + 360) % 360) - 180
  return `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'}${sep}${Math.abs(lo).toFixed(2)}° ${lo < 0 ? 'W' : 'E'}`
}

/** Great-circle distance on the app's reference sphere (MOON_RADIUS_KM, geometry/index.ts), km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r
  const dLon = (b.lon - a.lon) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2
  return 2 * MOON_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Initial great-circle bearing from a to b, degrees clockwise from north (0–360), on the same sphere as distanceKm.
 *  At the pole itself every direction is north; a is never exactly the pole for an app site. */
export function bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180
  const dLon = (b.lon - a.lon) * r
  const y = Math.sin(dLon) * Math.cos(b.lat * r)
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos(dLon)
  return ((Math.atan2(y, x) / r) % 360 + 360) % 360
}

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']

/** One of the eight compass directions for a bearing in degrees ("north-east"). */
export const compassText = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]

/** The summary card's last bullet: "12.4 km north-east of Connecting Ridge" (computed in the app, not stored):
 *  distance and the direction from the landing site to the point. */
export function distanceText(poi: { lat: number; lon: number }, from: { name: string; lat: number; lon: number }): string {
  const d = distanceKm(from, poi)
  if (d < 0.1) return `At ${from.name}`
  return `${d < 10 ? d.toFixed(1) : Math.round(d).toLocaleString('en-US')} km ${compassText(bearingDeg(from, poi))} of ${from.name}`
}

// ---------- abbreviations on the card (U17: every abbreviation shown expands on hover) ----------

/** Every abbreviation and unit symbol the POI texts use (plain.json bullets and types, the record's summary, facts,
 *  evidence and limitations), with its long form. The names are the instruments', missions' and methods' own. */
export const POI_ABBR: Record<string, string> = {
  PSR: 'Permanently shadowed region: never reached by direct sunlight',
  PSRs: 'Permanently shadowed regions: never reached by direct sunlight',
  LEND: 'Lunar Exploration Neutron Detector (LRO): maps hydrogen through neutrons',
  LCROSS: 'Lunar Crater Observation and Sensing Satellite (NASA impact mission)',
  LRO: 'Lunar Reconnaissance Orbiter (NASA)',
  LROC: 'Lunar Reconnaissance Orbiter Camera',
  NAC: 'Narrow Angle Camera (LROC)',
  LAMP: 'Lyman Alpha Mapping Project (ultraviolet spectrograph on LRO)',
  LOLA: 'Lunar Orbiter Laser Altimeter (LRO)',
  WEH: 'Water-equivalent hydrogen',
  M3: 'Moon Mineralogy Mapper (NASA instrument on Chandrayaan-1)',
  DEM: 'Digital elevation model',
  HLS: 'Human Landing System (Artemis)',
  NRHO: 'Near-rectilinear halo orbit',
  DTE: 'Direct to Earth (radio link without a relay)',
  DSN: 'NASA Deep Space Network',
  SPA: 'South Pole–Aitken basin',
  PGDA: 'Planetary Geodesy Data Archive (NASA Goddard)',
  CLPS: 'Commercial Lunar Payload Services (NASA)',
  LUPEX: 'Lunar Polar Exploration mission (JAXA and ISRO)',
  ESA: 'European Space Agency',
  TOPSIS: 'Technique for Order of Preference by Similarity to Ideal Solution: a multi-criteria ranking method',
  MABAC: 'Multi-Attributive Border Approximation area Comparison: a multi-criteria ranking method',
  CoCoSo: 'Combined Compromise Solution: a multi-criteria ranking method',
  VIKOR: 'VIseKriterijumska Optimizacija I Kompromisno Resenje: a multi-criteria ranking method',
  Ri: 'TOPSIS closeness score, 0 to 1 (higher ranks better)',
  LP: 'Lunar Prospector (NASA orbiter)',
  'IM-1': 'Intuitive Machines mission 1 (CLPS lander)',
  'IM-2': 'Intuitive Machines mission 2 (CLPS lander)',
  'IM-4': 'Intuitive Machines mission 4 (CLPS lander)',
  'IM-5': 'Intuitive Machines mission 5 (CLPS lander)',
  mb: 'Body-wave magnitude of a quake',
  'wt%': 'Percent by weight',
  ppm: 'Parts per million',
  Ga: 'Billion years (giga-annum)',
  Ma: 'Million years (mega-annum)',
  UTC: 'Coordinated Universal Time',
  UT: 'Universal Time',
  T_max: 'Maximum temperature',
  K: 'Kelvin (0 K = −273.15 °C)',
  CO2: 'Carbon dioxide',
  NASA: 'National Aeronautics and Space Administration',
  VIPER: 'Volatiles Investigating Polar Exploration Rover (NASA)',
  FLIP: 'FLEX Lunar Innovation Platform (Astrolab rover)',
  MK1: 'Mark 1 (Blue Moon cargo lander)',
  MB: 'Megabytes',
  SW: 'South-west',
}

const ABBR_RE = new RegExp(
  `(?<![\\w-])(${Object.keys(POI_ABBR)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\%-]/g, '\\$&'))
    .join('|')})(?![\\w-])`,
  'g',
)

/** A text split into plain parts and abbreviations with their long form, for <abbr title>. "K" is marked only after
 *  a number ("78 K"), so a capital K in a name is left alone. */
export function abbrParts(text: string): { text: string; title?: string }[] {
  const out: { text: string; title?: string }[] = []
  let last = 0
  for (const m of text.matchAll(ABBR_RE)) {
    const k = m[1]
    const at = m.index ?? 0
    if (k === 'K' && !/\d\s?$/.test(text.slice(0, at))) continue
    if (at > last) out.push({ text: text.slice(last, at) })
    out.push({ text: k, title: POI_ABBR[k] })
    last = at + k.length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

/** Evidence grades of the research notes and what they mean (definitions: "Evidence labels" in meta.source_meta_notes of
 *  docs/POIs/hazards.json and science-features.json; the classes of docs/reference/research/notes/water_ice_volatiles_resources.md). */
const GRADES: Record<string, string> = {
  ESTABLISHED: 'measured or documented in primary or official sources',
  MODEL: 'result of a published simulation, not a measurement',
  CONTESTED: 'published but disputed',
  SPECULATIVE: 'a hypothesis without supporting data',
  SPEC: 'speculation or a press characterisation',
  DIRECT: 'water or volatiles detected directly',
  INDIRECT: 'inferred from hydrogen (neutrons), temperature, illumination, albedo or radar proxies',
  INTERPRETATION: 'an interpretation, not a measurement',
}
const GRADE_WORD = new RegExp(`\\b(${Object.keys(GRADES).join('|')})\\b`, 'g')

/** Fact values that mean "no value": the full data card hides the row (never "not retrieved"). */
const EMPTY_VALUE = /^(not retrieved|not tabulated|not given|not available|no value|n\/a|unknown|none|-|—)$/i

/** Research-note internals: file names, record ids in snake_case, conversion notes about lon_east_* fields. */
const INTERNAL = /\.json\b|\.csv\b|\b[a-z][a-z0-9]*_[a-z0-9_]+\b/

/** A signed decimal coordinate pair in a note ("-84.9, -35.5"), south latitudes only (all the notes are polar). */
const COORD_PAIR = /(?<![\w.])(-\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)(?!\w|\.\d)/g

/** One research-note text cleaned for the full data card: no internal file names or record ids, coordinates as
 *  "84.90° S 35.50° W", conflicts as a sentence, "+/-" as "±", "deg" as "°". '' when nothing is left. */
export function cleanText(text: string, at?: { lat: number; lon: number }): string {
  let s = text
    // a parenthesis that only points into the research files: "(see psr_and_ice.json)"
    .replace(/\s*\([^()]*(?:\.json|\.csv|\b[a-z][a-z0-9]*_[a-z0-9_]+\b)[^()]*\)/g, '')
    .replace(/^\s*(?:Centre|Coordinate) conflict:\s*(?:this note uses\s+)?/i, 'Centre position differs between sources: ')
    .replace(/\+\/-/g, '±')
    .replace(/(\d)\s*deg\b/g, '$1°')
    .replace(/\s+->\s+/g, ': ')
    .replace(GRADE_WORD, (g) => g.toLowerCase())
  // sentences that still name a file or a record id go as a whole
  s = s
    .split(/(?<=\.)\s+(?=[A-Z])/)
    .filter((part) => !INTERNAL.test(part))
    // values audit (15 Nov): "Another note gives -89.667, 129.783." under a point stated at 89.67° S 129.78° E repeats
    // the centre; such a sentence goes when its pair rounds to the point's own position (2 decimals, as shown)
    .filter((part) => {
      const m = at && /^Another note gives (-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\.?$/.exec(part.trim())
      return !(m && Number(m[1]).toFixed(2) === at!.lat.toFixed(2) && Number(m[2]).toFixed(2) === at!.lon.toFixed(2))
    })
    .join(' ')
  s = s.replace(COORD_PAIR, (m, a: string, b: string) => {
    const lat = Number(a)
    const lon = Number(b)
    if (!(a.includes('.') || b.includes('.')) || lat < -90 || Math.abs(lon) > 180) return m
    return fmtLatLon(lat, lon, ' ')
  })
  // a labelled signed value as printed in a table: "Latitude -88.65", "Lon (°) -137.411" -> "88.65° S", "137.411° W"
  s = s
    .replace(/\b(Lat(?:itude)?(?: \(°\))?)\s+[−-](\d{1,2}(?:\.\d+)?)(?![\d.])/g, '$1 $2° S')
    .replace(/\b(Lon(?:gitude)?(?: \(°\))?)\s+([−-]?)(\d{1,3}(?:\.\d+)?)(?![\d.])/g, (_m, k: string, sign: string, v: string) => `${k} ${v}° ${sign ? 'W' : 'E'}`)
  s = s.replace(/\s+/g, ' ').trim()
  return EMPTY_VALUE.test(s) || /^(no value(, )?)+$/.test(s) ? '' : s
}

/** The record's facts for the full data card: cleaned, rows with no value left out. */
export function fullFacts(poi: Poi): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  for (const f of poi.facts) {
    const value = cleanText(f.value)
    if (value) out.push({ label: f.label, value })
  }
  return out
}

/** Evidence as plain text: grades in lower case ("established"), "WP" spelled out, and one short phrase per grade
 *  explaining it. null when the record has no evidence note. */
export function evidenceText(evidence: string | null): { text: string; meaning: string[] } | null {
  if (!evidence) return null
  const grades = [...new Set([...evidence.matchAll(GRADE_WORD)].map((m) => m[1]))]
  const text = cleanText(evidence.replace(/\bWP\b/g, 'Wikipedia'))
  if (!text) return null
  const word = (g: string) => `${g.charAt(0)}${g.slice(1).toLowerCase()}`
  // The note is only the grade: one line, "Established: measured or documented in primary or official sources."
  if (grades.length === 1 && text.toLowerCase() === grades[0].toLowerCase()) return { text: `${word(grades[0])}: ${GRADES[grades[0]]}.`, meaning: [] }
  const meaning = grades.map((g) => `${word(g)}: ${GRADES[g]}.`)
  return { text: text.charAt(0).toUpperCase() + text.slice(1), meaning }
}

/** Source link text: the host name. */
export const sourceHost = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return u
  }
}

// ---------- "At this point, for your mission dates" (U17, read-cards) ----------
// Sunlight and station contact of a point that has a terrain horizon of its own (search-sites.json): the search's
// values, from the same code (useSiteRows → data/results.computeRow → geometry summarize), never a second
// implementation and never an estimate. A point without a horizon gets no values.

/** The mission's dates and station choice, as the app holds them. */
export interface PoiMission {
  stations: Station[]
  ids: string[] // selected station ids
  startMs: number
  endMs: number
}

/** The mission as the link describes it (when the card is not handed the app's own): the dates by views/period and
 *  the stations by App.tsx's rule (the link's selection, all stations when it names none of them). */
export function missionFromLink(hash: string, periods: Period[], stations: Station[]): PoiMission {
  const hs = parseHash(hash)
  const p = resolvePeriod(hs, periods)
  const known = stations.map((s) => s.id)
  const sel = hs.st ? known.filter((id) => hs.st!.includes(id)) : known
  return { stations, ids: sel.length ? sel : known, startMs: p.startMs, endMs: p.endMs }
}

export type PoiConditions =
  | { status: 'none' } // no horizon for this point (or its list could not load): nothing is shown
  | { status: 'loading' }
  | { status: 'ready'; site: SearchSite; mission: PoiMission; entry: RowEntry }

/** The point's search row and its computed values for the mission. The work runs after the card is shown (one
 *  task per site in useSiteRows); a value computed for the search or an earlier card is reused, not recomputed. */
export function usePoiConditions(poiId: string, given: PoiMission | null): PoiConditions {
  const [found, setFound] = useState<{ id: string; site: SearchSite | null } | null>(null)
  const [linked, setLinked] = useState<PoiMission | null>(null)
  useEffect(() => {
    let alive = true
    loadPoiSite(poiId).then(
      (site) => alive && setFound({ id: poiId, site }),
      () => alive && setFound({ id: poiId, site: null }),
    )
    return () => {
      alive = false
    }
  }, [poiId])
  useEffect(() => {
    if (given) return
    let alive = true
    loadMissionInputs().then(
      ([periods, stations]) => alive && setLinked(missionFromLink(window.location.hash, periods, stations)),
      () => alive && setLinked(null),
    )
    return () => {
      alive = false
    }
  }, [given === null, poiId])
  const mission = given ?? linked
  const site = found && found.id === poiId ? found.site : undefined
  const rows = useSiteRows(site && mission ? [site] : [], mission?.stations ?? [], mission?.ids ?? [], mission?.startMs ?? 0, mission?.endMs ?? 0, false)
  if (site === null) return { status: 'none' }
  if (!site || !mission) return { status: 'loading' }
  return { status: 'ready', site, mission, entry: rows[site.id] ?? { status: 'computing' } }
}

export interface ConditionLine {
  key: 'lit' | 'comms' | 'slope'
  label: string
  value: string // mono, with its unit
  note: string
  status?: 'pass' | 'fail' // only where the app has a stated threshold (the 5° slope limit, geometry/rankSites.ts)
}

const DAY = 86_400_000

/** At most three lines: sunlit, station contact and slope (from the shipped file). Percentages as the search shows
 *  them (format.fmtPct); the days are the same share of the mission's length. While `computing`, sunlit and contact
 *  hold the place with "…" and the same note, so the card keeps its height when the values arrive (a card that grew
 *  under a still pointer for one frame covered its own pin). */
export function conditionLines(site: SearchSite, mission: PoiMission, summary: Summary | null, computing = false): ConditionLine[] {
  const out: ConditionLine[] = []
  const days = (mission.endMs - mission.startMs) / DAY
  const n = Math.round(days)
  const ofDays = (pct: number | null) => (n >= 1 ? `about ${pct === null ? '…' : Math.round((pct / 100) * days)} of ${n} days` : '')
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  const lit = summary && finite(summary.litPct) ? summary.litPct : null
  const cov = summary && finite(summary.coveragePct) ? summary.coveragePct : null
  const wait = computing && !summary
  if (lit !== null || wait) out.push({ key: 'lit', label: 'Sunlit', value: lit === null ? '…' : fmtPct(lit), note: ofDays(lit) })
  // Contact: line of sight to at least one chosen ground station (geometry coverage), as the search's "Coverage".
  if (cov !== null || wait) out.push({ key: 'comms', label: 'Station contact', value: cov === null ? '…' : fmtPct(cov), note: ofDays(cov) })
  // The slope rule is rankSites' (5° limit, spec.md "Terrain slope"); the card only words its answer.
  const r = rankSites([{ site, summary: null }], 'any')
  const row = [...r.ranked, ...r.failed, ...r.unknown][0]
  if (row && row.slopeDeg !== null) {
    out.push({
      key: 'slope',
      label: 'Slope',
      value: fmtDeg(row.slopeDeg),
      note: row.slope === 'fail' ? 'steeper than the 5° limit' : 'within the 5° limit',
      status: row.slope === 'fail' ? 'fail' : 'pass',
    })
  }
  return out
}

// ---------- "Show as landing site" (science lead, 15 Nov) ----------

/** What the card offers for going to the point: 'go' (it can be a custom landing site), 'here' (it already is the
 *  current landing site), or null (outside the pin region: customSiteId gives no id, so no action). */
export function goToState(poi: { lat: number; lon: number }, currentSiteId: string | null | undefined): 'go' | 'here' | null {
  const id = customSiteId(poi.lat, poi.lon)
  if (!id) return null
  return id === currentSiteId ? 'here' : 'go'
}
