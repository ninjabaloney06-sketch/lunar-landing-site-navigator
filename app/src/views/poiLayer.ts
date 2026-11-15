// Points of interest for the layer, the info box and the search (U2–U4). pois.json is fetched once, the first
// time the layer or the search is opened (data/load.loadPois), never at start.
// Only POIs inside the pin region (scene3d/region.inPinRegion) are used anywhere in the app.
import { useEffect, useRef, useState } from 'react'
import { loadPois } from '../data/load'
import { POI_GROUPS } from '../data/pois'
import type { Poi, PoiGroup } from '../data/pois'
import type { Site } from '../data/types'
import type { ScenePoi } from '../scene3d'
import { PIN_REGION_NORTH_LAT, inPinRegion } from '../scene3d/region'
import { MOON_RADIUS_KM } from '../geometry'

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

/** The summary card's last bullet: "12 km from Connecting Ridge" (computed in the app, not stored). */
export function distanceText(poi: { lat: number; lon: number }, from: { name: string; lat: number; lon: number }): string {
  const d = distanceKm(from, poi)
  if (d < 0.1) return `At ${from.name}`
  return `${d < 10 ? d.toFixed(1) : Math.round(d).toLocaleString('en-US')} km from ${from.name}`
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
export function cleanText(text: string): string {
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
    .join(' ')
  s = s.replace(COORD_PAIR, (m, a: string, b: string) => {
    const lat = Number(a)
    const lon = Number(b)
    if (!(a.includes('.') || b.includes('.')) || lat < -90 || Math.abs(lon) > 180) return m
    return fmtLatLon(lat, lon, ' ')
  })
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
  const meaning = grades.map((g) => `${g.charAt(0)}${g.slice(1).toLowerCase()}: ${GRADES[g]}.`)
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
