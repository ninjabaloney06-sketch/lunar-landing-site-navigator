// The POI card's text rules (U8): the full data card cleans every record of pois.json; the summary card's distance.
import poisJson from '../../public/data/pois.json'
import searchSitesJson from '../../public/data/search-sites.json'
import { describe, expect, it, vi } from 'vitest'
import type { Poi, SearchSite } from '../data/pois'
import type { Period, Station } from '../data/types'
import { loadPoiSite } from '../data/poiHorizon'
import { customSiteId } from '../data/customSite'
import { MOON_RADIUS_KM } from '../geometry'
import {
  abbrParts,
  bearingDeg,
  cleanText,
  compassText,
  conditionLines,
  distanceKm,
  distanceText,
  evidenceText,
  fmtLatLon,
  fullFacts,
  goToState,
  missionFromLink,
  POI_ABBR,
  poiQualifiers,
  qualifiedName,
  scenePois,
  sourceHost,
} from './poiLayer'

// The search rows as shipped, without a fetch.
vi.mock('../data/load', async (orig) => ({ ...(await orig<typeof import('../data/load')>()), loadSearchSites: async () => searchSitesJson }))

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

  it('reads "<n> km <direction> of <site>"', () => {
    const site = { name: 'Connecting Ridge', lat: -89.4588, lon: -137.31 }
    const near = { lat: -89.5, lon: -137.31 } // under 10 km: one decimal; same meridian, further south
    expect(distanceText(near, site)).toBe(`${distanceKm(site, near).toFixed(1)} km south of Connecting Ridge`)
    expect(distanceText({ lat: -90, lon: 0 }, site)).toBe(`${Math.round(distanceKm(site, { lat: -90, lon: 0 }))} km south of Connecting Ridge`)
    expect(distanceText(byId.get('science:feat_cabeus')!, site)).toMatch(/^\d{2,3} km (north|north-east|east|south-east|south|south-west|west|north-west) of Connecting Ridge$/)
    expect(distanceText(site, site)).toBe('At Connecting Ridge')
  })
})

describe('summary card: direction from the current site (U17)', () => {
  it('initial great-circle bearing, eight compass words', () => {
    expect(bearingDeg({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(0, 9)
    expect(bearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(90, 9)
    expect(bearingDeg({ lat: -85, lon: 0 }, { lat: -86, lon: 0 })).toBeCloseTo(180, 9)
    expect(bearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: -1 })).toBeCloseTo(270, 9)
    expect([0, 44, 46, 90, 135, 180, 225, 270, 315, 338, 359].map(compassText)).toEqual([
      'north', 'north-east', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north',
    ])
  })
})

describe('card texts: every abbreviation has its long form (U17)', () => {
  it('marks WEH, wt%, M3, PSR and K after a number; leaves a K in a name alone', () => {
    const text = 'Max WEH 0.24 wt%, 134 M3 ice detections; PSR floor 40 K; Kocher massif'
    const parts = abbrParts(text)
    expect(parts.filter((p) => p.title).map((p) => p.text)).toEqual(['WEH', 'wt%', 'M3', 'PSR', 'K'])
    expect(parts.map((p) => p.text).join('')).toBe(text)
  })

  it('every capitalised abbreviation in the summary texts of pois.json has an expansion', () => {
    const known = new Set(Object.keys(POI_ABBR))
    const missing = new Set<string>()
    for (const p of POIS) {
      for (const t of [p.plain?.type ?? '', ...(p.plain?.bullets ?? [])]) {
        for (const m of t.matchAll(/(?<![\w-])([A-Z][A-Za-z]*[A-Z][A-Za-z0-9]*(?:-\d+)?|[A-Z]\d)(?![\w-])/g)) {
          if (!known.has(m[1])) missing.add(m[1])
        }
      }
    }
    // Names written in capitals, not abbreviations: a crater (Gill), a Roman numeral (Artemis III), an instrument.
    for (const name of ['GILL', 'III', 'ShadowCam']) missing.delete(name)
    expect([...missing].sort()).toEqual([])
  })
})

describe('"At this point, for your mission dates" (U17)', () => {
  const site = {
    id: 'poi-x', name: 'X', group: 'poi', lat: -88, lon: 45, elev_m: 0, slope_deg: 2.6, horizon: 'poi-x.json', poi_id: 'cold-trap:x',
  } as unknown as SearchSite
  const mission = { stations: [], ids: ['a'], startMs: Date.UTC(2027, 7, 1), endMs: Date.UTC(2027, 7, 15) }
  const summary = { litPct: 62.345, earthVisiblePct: 50, coveragePct: 41, unknownPct: 0, longestDarkH: 10, longestGapH: 5 }

  it('three lines: sunlit and station contact as the search shows them, the slope with the 5° limit', () => {
    const lines = conditionLines(site, mission, summary)
    expect(lines.map((l) => [l.label, l.value, l.note])).toEqual([
      ['Sunlit', '62.3 %', 'about 9 of 14 days'],
      ['Station contact', '41.0 %', 'about 6 of 14 days'],
      ['Slope', '2.6°', 'within the 5° limit'],
    ])
    expect(lines[2].status).toBe('pass')
    expect(conditionLines({ ...site, slope_deg: 7.2 }, mission, summary)[2]).toMatchObject({ value: '7.2°', status: 'fail' })
  })

  it('while computing, "…" holds the place of sunlit and contact with the same notes; no slope in the file, no slope line; never NaN', () => {
    const wait = conditionLines(site, mission, null, true)
    expect(wait.map((l) => [l.value, l.note])).toEqual([
      ['…', 'about … of 14 days'],
      ['…', 'about … of 14 days'],
      ['2.6°', 'within the 5° limit'],
    ])
    expect(conditionLines(site, mission, null).map((l) => l.key)).toEqual(['slope'])
    expect(conditionLines({ ...site, slope_deg: null } as unknown as SearchSite, mission, null)).toEqual([])
    const bad = { ...summary, litPct: Number.NaN, coveragePct: Number.NaN }
    expect(conditionLines(site, mission, bad).map((l) => l.key)).toEqual(['slope'])
  })

  it('the mission from the link: named period, station selection, all stations when the link names none', () => {
    const periods = [{ id: 'p1', start_utc: '2027-08-01T00:00:00Z', end_utc: '2027-08-15T00:00:00Z' }] as unknown as Period[]
    const stations = [{ id: 'goldstone' }, { id: 'madrid' }] as unknown as Station[]
    expect(missionFromLink('#period=p1&st=madrid', periods, stations)).toMatchObject({ ids: ['madrid'], startMs: Date.UTC(2027, 7, 1), endMs: Date.UTC(2027, 7, 15) })
    expect(missionFromLink('#period=p1', periods, stations).ids).toEqual(['goldstone', 'madrid'])
  })

  it('"Show as landing site": go inside the pin region, "here" for the current site, nothing north of 80° S', () => {
    const shoemaker = byId.get('cold-trap:atlas_01')!
    expect(goToState(shoemaker, 'connecting-ridge')).toBe('go')
    expect(goToState(shoemaker, customSiteId(shoemaker.lat, shoemaker.lon))).toBe('here')
    expect(goToState({ lat: -79.5, lon: 10 }, 'connecting-ridge')).toBeNull()
    // Every record north of the limit gets no action (pois.json has some; the app draws no pins for them).
    const north = POIS.filter((x) => x.lat > -80)
    expect(north.length).toBeGreaterThan(0)
    for (const p of north) expect(goToState(p, null), p.id).toBeNull()
  })

  it('which points have a horizon: the search rows by poi_id; a point without one gets null (no values)', async () => {
    expect(await loadPoiSite('cold-trap:atlas_01')).toMatchObject({ id: 'poi-cold-trap-atlas-01', horizon: 'poi-cold-trap-atlas-01.json' })
    expect(await loadPoiSite('science:no_such_point')).toBeNull()
  })
})

describe('cleanText: a note that only repeats the stated centre', () => {
  it('drops "Another note gives …" when it rounds to the point itself, keeps it when it differs', () => {
    const t = 'floor 6.6 km wide; walls ~30 deg. Another note gives -89.667, 129.783.'
    expect(cleanText(t, { lat: -89.67, lon: 129.78 })).toBe('floor 6.6 km wide; walls ~30°.')
    expect(cleanText(t, { lat: -89.5, lon: 129.78 })).toContain('Another note gives 89.67° S 129.78° E')
    expect(cleanText(t)).toContain('Another note gives')
  })
})


// 16 Nov: points of different sources that share a name ("Cabeus": the host crater and a permanently shadowed region
// of the LROC atlas) are told apart by a qualifier from the record's own fields, in every list they can share.
describe('poiQualifiers: points that share a name', () => {
  const all = poisJson as unknown as Poi[]
  const q = poiQualifiers(all)
  const groups = new Map<string, Poi[]>()
  for (const p of all) groups.set(p.name, [...(groups.get(p.name) ?? []), p])
  const shared = [...groups.entries()].filter(([, g]) => g.length > 1)

  it('the shipped data has such groups, Cabeus, Cabeus A and Cabeus B among them', () => {
    expect(shared.length).toBeGreaterThanOrEqual(10)
    for (const name of ['Cabeus', 'Cabeus A', 'Cabeus B']) expect(groups.get(name)!.length, name).toBe(2)
    // about eleven sourced points carry "Cabeus" in their name
    expect(all.filter((p) => p.name.includes('Cabeus')).length).toBeGreaterThanOrEqual(11)
  })

  it('every point of every shared-name group has a qualifier, and no two of a group read the same', () => {
    for (const [name, g] of shared) {
      const texts = g.map((p) => qualifiedName(p.name, q.get(p.id)))
      for (const t of texts) expect(t, name).not.toBe(name)
      expect(new Set(texts).size, `${name}: ${texts.join(' | ')}`).toBe(g.length)
    }
  })

  it('a point with a name of its own has none and keeps its plain name', () => {
    const alone = all.filter((p) => groups.get(p.name)!.length === 1)
    expect(alone.length).toBeGreaterThan(100)
    for (const p of alone) expect(q.has(p.id), p.name).toBe(false)
    const lcross = all.find((p) => p.id === 'water:lcross_measurements')!
    expect(qualifiedName(lcross.name, q.get(lcross.id))).toBe('LCROSS impact measurements (Cabeus)')
  })

  it('the qualifier is the record\'s own type and the host of its first source', () => {
    expect(q.get('cold-trap:host_cabeus')!.text).toBe('Host crater, planetarynames.wr.usgs.gov')
    expect(q.get('cold-trap:atlas_24')!.text).toBe('Permanently shadowed region, lroc.im-ldi.com')
    expect(qualifiedName('Cabeus', q.get('cold-trap:host_cabeus'))).toBe('Cabeus (Host crater, planetarynames.wr.usgs.gov)')
    for (const [id, x] of q) {
      const p = all.find((r) => r.id === id)!
      expect(x.kind).toBe(p.plain!.type)
      expect(x.source).toBe(sourceHost(p.sources[0]))
    }
  })

  it('two records of one name with the same type and source are told apart by their coordinates', () => {
    // the LROC atlas lists two shadowed regions named Amundsen
    const a = q.get('cold-trap:atlas_05')!
    const b = q.get('cold-trap:atlas_21')!
    expect(a.where).toBe('83.52° S 91.01° E') // fmtLatLon's two decimals of 91.015
    expect(b.where).toBe('83.26° S 82.06° E')
    expect(a.text).toBe('Permanently shadowed region, lroc.im-ldi.com, 83.52° S 91.01° E')
    // the third Amundsen (the host crater) differs by type and source already
    expect(q.get('cold-trap:host_amundsen')!.where).toBeNull()
  })

  it('a name shared with a listed landing site counts, except for the record that is that site', () => {
    const poi = (id: string, name: string, siteId: string | null): Poi => ({ ...all[0], id, name, siteId })
    expect(poiQualifiers([poi('a', 'Ridge', null)]).size).toBe(0)
    expect(poiQualifiers([poi('a', 'Ridge', null)], ['Ridge']).has('a')).toBe(true)
    expect(poiQualifiers([poi('a', 'Ridge', 'ridge')], ['Ridge']).size).toBe(0)
  })

  it('the pins of the scene carry the qualified name', () => {
    const pins = scenePois(all, ['cold-trap'], [])
    const names = pins.filter((p) => p.name.startsWith('Cabeus (')).map((p) => p.name)
    expect(names).toEqual(expect.arrayContaining(['Cabeus (Host crater, planetarynames.wr.usgs.gov)', 'Cabeus (Permanently shadowed region, lroc.im-ldi.com)']))
    expect(new Set(pins.map((p) => p.name)).size).toBe(pins.length)
  })
})
