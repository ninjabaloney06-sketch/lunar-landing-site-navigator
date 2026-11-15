// The POI card's text rules (U8): the full data card cleans every record of pois.json; the summary card's distance.
import poisJson from '../../public/data/pois.json'
import { describe, expect, it } from 'vitest'
import type { Poi } from '../data/pois'
import { MOON_RADIUS_KM } from '../geometry'
import { cleanText, distanceKm, distanceText, evidenceText, fmtLatLon, fullFacts } from './poiLayer'

const POIS = poisJson as Poi[]
const byId = new Map(POIS.map((p) => [p.id, p]))

const RAW_COORD = /(?<![\w.])-\d{1,2}\.\d+,\s*-?\d/
const GRADE_CAPS = /\b(ESTABLISHED|MODEL|CONTESTED|SPECULATIVE|SPEC|DIRECT|INDIRECT|INTERPRETATION)\b/
const INTERNAL = /\.json|\.csv|\b[a-z][a-z0-9]*_[a-z0-9_]+\b/

describe('full data card: cleaned record', () => {
  it('Cabeus crater: conflict as a sentence with formatted coordinates, no file name, no "not retrieved" row', () => {
    const cabeus = byId.get('science:feat_cabeus')!
    expect(cleanText(cabeus.limitations!)).toBe(
      'Centre position differs between sources: Wikipedia 84.90° S 35.50° W; USGS Gazetteer list gives 85.33° S 42.13° W.',
    )
    expect(cabeus.facts.some((f) => f.value === 'not retrieved')).toBe(true) // the record has the empty row ...
    expect(fullFacts(cabeus).map((f) => f.label)).toEqual(['Size']) // ... the card hides it
    expect(cleanText(cabeus.summary)).toBe('LCROSS ground truth (5.6 ± 2.9 wt% water + other volatiles); impact at 84.68° S 48.71° W')
    const ev = evidenceText(cabeus.evidence)!
    expect(ev.text).toBe('Established: measured or documented in primary or official sources.')
    expect(ev.meaning).toEqual([])
    // A longer note keeps its words (grades in lower case) and explains each grade once.
    const mixed = evidenceText('ESTABLISHED (scarp); link to N9 MODEL/plausible')!
    expect(mixed.text).toBe('Established (scarp); link to N9 model/plausible')
    expect(mixed.meaning).toEqual([
      'Established: measured or documented in primary or official sources.',
      'Model: result of a published simulation, not a measurement.',
    ])
    expect(evidenceText('USGS Gazetteer (primary) for centre and diameter; depth WP (secondary)')!.text).toBe(
      'USGS Gazetteer (primary) for centre and diameter; depth Wikipedia (secondary)',
    )
  })

  it('coordinates read "84.90° S, 35.50° W"', () => {
    expect(fmtLatLon(-84.9, -35.5)).toBe('84.90° S, 35.50° W')
    expect(fmtLatLon(-89.4588, 222.69)).toBe('89.46° S, 137.31° W')
  })

  it('no record shows a file name, record id, raw signed coordinates, "not retrieved" or a grade in capitals', () => {
    let n = 0
    for (const p of POIS) {
      const texts = [cleanText(p.summary), ...fullFacts(p).map((f) => f.value), p.limitations ? cleanText(p.limitations) : '']
      const ev = evidenceText(p.evidence)
      if (ev) texts.push(ev.text)
      for (const t of texts) {
        expect(t, p.id).not.toMatch(INTERNAL)
        expect(t, p.id).not.toMatch(RAW_COORD)
        expect(t, p.id).not.toMatch(/\b(Lat|Lon)(itude|gitude)?( \(°\))?\s+[−-]\d/)
        expect(t, p.id).not.toMatch(/not retrieved/i)
        expect(t, p.id).not.toMatch(GRADE_CAPS)
        n++
      }
      for (const f of fullFacts(p)) expect(f.value.trim(), p.id).not.toBe('')
    }
    expect(n).toBeGreaterThan(500)
  })

  it('keeps ordinary text and numbers as written', () => {
    expect(cleanText('Relief ~60-80 m; walls 10-15 deg')).toBe('Relief ~60-80 m; walls 10-15°')
    expect(cleanText('24, 243, 51')).toBe('24, 243, 51')
    expect(cleanText('not tabulated')).toBe('')
    expect(cleanText('no value, no value')).toBe('')
    expect(cleanText('Longitude −67.12 | Latitude −88.65')).toBe('Longitude 67.12° W | Latitude 88.65° S')
    expect(cleanText('Geodetic Lat (°) -89.4679, Lon (°) -137.411, Polar stereographic X (km) -10.92')).toBe(
      'Geodetic Lat (°) 89.4679° S, Lon (°) 137.411° W, Polar stereographic X (km) -10.92',
    )
  })
})

describe('summary card: distance from the current site', () => {
  it('great-circle distance on the reference sphere', () => {
    expect(distanceKm({ lat: -90, lon: 0 }, { lat: -89, lon: 123 })).toBeCloseTo((MOON_RADIUS_KM * Math.PI) / 180, 6)
    expect(distanceKm({ lat: -85, lon: 10 }, { lat: -85, lon: 10 })).toBe(0)
  })

  it('reads "<n> km from <site>"', () => {
    const site = { name: 'Connecting Ridge', lat: -89.4588, lon: -137.31 }
    const near = { lat: -89.5, lon: -137.31 } // under 10 km: one decimal
    expect(distanceText(near, site)).toBe(`${distanceKm(site, near).toFixed(1)} km from Connecting Ridge`)
    expect(distanceText({ lat: -90, lon: 0 }, site)).toBe(`${Math.round(distanceKm(site, { lat: -90, lon: 0 }))} km from Connecting Ridge`)
    expect(distanceText(byId.get('science:feat_cabeus')!, site)).toMatch(/^\d{2,3} km from Connecting Ridge$/)
    expect(distanceText(site, site)).toBe('At Connecting Ridge')
  })
})
