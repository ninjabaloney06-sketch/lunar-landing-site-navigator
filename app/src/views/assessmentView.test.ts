// The site assessment section's strings, from the shipped file (public/data/assessments.json, written by
// scripts/assessments.py). Expected values are the file's own values for Haworth, read once by hand from the file
// on 15 Nov 2026 (they match the Results table in docs/event/validation.md, "Mandatory site assessments").
import { describe, expect, it } from 'vitest'
import raw from '../../public/data/assessments.json?raw'
import { ASSESSMENT_STATUS, STRICTER_THAN_LIST, NOT_COMPUTED, NO_DATA, TERMS, clean, compass, firstClause, linkParts, mapAssessment, radius, termParts } from './assessmentView'
import type { AssessmentView, Block } from './assessmentView'

const file = JSON.parse(raw) as { sites: Record<string, Record<string, unknown>> }

function ready(v: AssessmentView) {
  if (v.state !== 'ready') throw new Error(`state ${v.state}`)
  return v
}
const block = (v: AssessmentView, id: Block['id']) => ready(v).blocks.find((b) => b.id === id)!
const row = (b: Block, label: string) => b.rows.find((r) => r.label === label)?.values

describe('mapAssessment: Haworth from the shipped file', () => {
  const v = mapAssessment(file, 'haworth')

  it('status label and thresholds as given and as the file states them', () => {
    expect(ready(v).status).toBe(ASSESSMENT_STATUS)
    expect(ready(v).status).toBe('Validated by the science lead (statement of 15 Nov 2026; see record)')
    expect(ready(v).thresholds).toBe(
      'Landing slope ≤ 5.0° passes; exploration slope < 20.0° meets: project criteria (set by the team), not NASA or vehicle limits.',
    )
  })

  it('headline: the verdict with its rule, the value that decides it, and the project-criteria line', () => {
    expect(ready(v).headline).toEqual({
      verdict: 'Fails',
      tone: 'fail',
      rule: 'every valid pixel slope in the 100 m radius landing disk ≤ 5.0°',
      decider: 'Maximum slope in the landing disk: 14.07°',
      criteria: 'The 5° and 20° slope thresholds are project criteria (set by the team), not NASA or vehicle limits.',
    })
    // the deciding value is the landing disk's maximum-slope cell of the table, not a new number
    expect(ready(v).headline.decider).toContain(row(block(v, 'slope'), 'Maximum slope')![0])
  })

  it('headline of the one site that passes (IM-2 intended point)', () => {
    const h = ready(mapAssessment(file, 'im-2-intended')).headline
    expect([h.verdict, h.tone, h.decider]).toEqual(['Passes', 'pass', 'Maximum slope in the landing disk: 3.60°'])
  })

  it('slope: both disks, at the stated 0.01° precision, and the landing verdict', () => {
    const b = block(v, 'slope')
    expect(b.message).toBeNull()
    expect(b.columns).toEqual(['Landing disk, 100 m radius', 'Exploration disk, 2 km radius'])
    expect(row(b, 'Median slope')).toEqual(['9.96°', '7.42°'])
    expect(row(b, 'Maximum slope')).toEqual(['14.07°', '21.11°'])
    expect(row(b, 'Share of pixels ≤ 5°')).toEqual(['0 %', '24.79 %'])
    expect(row(b, 'Share of pixels < 20°')).toEqual(['100 %', '99.99 %'])
    expect(row(b, 'Elevation model')).toEqual(['LDEM_80S_20MPP_ADJ.TIF, 20 m per pixel', 'LDEM_80S_20MPP_ADJ.TIF, 20 m per pixel'])
    expect(row(b, 'Pixels in the disk')).toEqual(['79', '31465'])
    expect(b.verdict).toEqual({
      label: 'Fails',
      tone: 'fail',
      rule: 'passes the 5° slope criterion only if every valid pixel slope in the 100 m radius disk is ≤ 5.0° (AI proposal; the science lead decides radius and rule)',
    })
    expect(b.source).toContain('doi:10.3847/PSJ/acf3e1')
    expect(b.limitations).toHaveLength(4)
    expect(b.limitations[3]).toBe('site outside the 5 m DEM (87.5-90 S); 20 m DEM used')
  })

  it('roughness: RMS height and obstacles unknown with the stated reason', () => {
    const b = block(v, 'roughness')
    expect(row(b, 'RMS height')).toEqual(['1.02 m'])
    // summary: the file's reason up to its first "; "; Full data: the whole reason
    expect(row(b, 'Obstacles')).toEqual(['unknown: features smaller than about two DEM pixels (~40 m on the 20 m DEM), including all boulders, are not resolved'])
    expect(b.rows.find((r) => r.label === 'Obstacles')?.fullValues).toEqual([
      'unknown: features smaller than about two DEM pixels (~40 m on the 20 m DEM), including all boulders, are not resolved; no rock-abundance or boulder map is used',
    ])
    expect(row(b, 'Detection limit')).toEqual(['40 m'])
  })

  it('nearest permanent shadow: distance, bearing with compass point, straight-line slope check', () => {
    const b = block(v, 'psr')
    expect(row(b, 'Distance')).toEqual(['1.866 km'])
    expect(row(b, 'Bearing')).toEqual(['ENE, 63.9°'])
    expect(row(b, 'Cluster area')).toEqual(['3.774 km²'])
    expect(row(b, 'Straight line: maximum slope')).toEqual(['14.13°'])
    expect(row(b, 'Straight line: share < 20°')).toEqual(['100 %'])
    expect(row(b, 'Catalogue PSR')).toEqual(['no catalogue PSR coordinate in this cluster'])
    expect(row(b, 'Cluster point')).toEqual(['86.72246° S, 22.70366° W'])
    expect(row(b, 'Shadow area within')).toEqual(['5 km: 3.9 km² · 10 km: 4.787 km² · 15 km: 9.809 km²'])
    expect(b.notes[0].text).toBe('Straight line: straight-line terrain check, not a route.')
    expect(b.extra[0]).toMatch(/^Map projection: The 60 m and 240 m map labels/)
    expect(b.extra[0]).toMatch(/The science lead to confirm\.$/)
  })

  it('thermal: annual mean and maximum in K, minimum unknown with its reason', () => {
    const b = block(v, 'thermal')
    expect(row(b, 'Annual mean (2 cm depth)')).toEqual(['124.73 K'])
    expect(row(b, 'Annual maximum (surface)')).toEqual(['244.52 K'])
    expect(row(b, 'Annual minimum')).toEqual(['unknown: not provided by this product'])
    expect(row(b, 'Status')).toEqual(['sourced: copied from a cited source'])
    expect(b.limitations.some((l) => l.includes('confirmed by the science lead on 14 Nov 2026'))).toBe(true)
  })

  it('no value string is NaN, undefined or null, and no team member is named', () => {
    for (const id of Object.keys(file.sites)) {
      const s = JSON.stringify(mapAssessment(file, id))
      expect(s, id).not.toMatch(/NaN|undefined|null°|\bnull\b(?! *[,}\]])/)
      expect(s, id).not.toMatch(/\bLeo\b|\bOtto\b|ninja/)
    }
  })
})

describe('mapAssessment: other states', () => {
  it('a site the file has no record for (a custom place) is not computed, in every block', () => {
    const v = mapAssessment(file, 'cap:-89.47000,-136.78000')
    expect(v.state).toBe('not-computed')
    if (v.state !== 'not-computed') return
    expect(v.blocks.map((b) => b.message)).toEqual([NOT_COMPUTED, NOT_COMPUTED, NOT_COMPUTED, NOT_COMPUTED])
    expect(v.blocks.every((b) => b.rows.length === 0)).toBe(true)
  })

  it('a missing or malformed file is the plain no-data message', () => {
    for (const bad of [null, 'x', [], {}, { meta: {} }, { sites: [] }]) {
      expect(mapAssessment(bad, 'haworth')).toEqual({ state: 'no-data', message: NO_DATA })
    }
  })

  it('a record with broken fields shows "unknown", with the file reason, never NaN', () => {
    const v = mapAssessment(
      {
        meta: {},
        sites: {
          x: {
            slope: { status: 'unknown', reason: 'nodata 40.0 % of the area (limit 20 %)', landing_slope_pass: null, landing_area: null },
            roughness: { status: 'computed', rms_height_m: 'NaN' },
            psr: { status: 'unknown', reason: 'site outside every Sun-visibility map on disk', nearest_cluster: null },
            thermal: { status: 'sourced', temp_avg_k: null, temp_max_k: Number.NaN },
          },
        },
      },
      'x',
    )
    const r = ready(v)
    expect(r.thresholds).toBeNull()
    const slope = block(v, 'slope')
    expect(row(slope, 'Median slope')).toEqual(['unknown', 'unknown'])
    expect(slope.verdict?.label).toBe('unknown: nodata 40.0 % of the area (limit 20 %)')
    expect(slope.verdict?.tone).toBeNull()
    expect(r.headline.verdict).toBe('unknown: nodata 40.0 % of the area (limit 20 %)')
    expect(r.headline.decider).toBeNull()
    expect(r.headline.criteria).toBeNull()
    expect(row(block(v, 'roughness'), 'RMS height')).toEqual(['unknown'])
    expect(block(v, 'psr').message).toBe('unknown: site outside every Sun-visibility map on disk')
    expect(row(block(v, 'thermal'), 'Annual mean (2 cm depth)')).toEqual(['unknown'])
    expect(JSON.stringify(v)).not.toMatch(/NaN|undefined/)
  })
})

describe('helpers', () => {
  it('compass points', () => {
    expect([0, 63.9, 90, 205, 261.1, 351, 359].map(compass)).toEqual(['N', 'ENE', 'E', 'SSW', 'W', 'N', 'N'])
  })
  it('role names and print notation', () => {
    expect(clean('Leo to confirm. AI proposals; Leo decides')).toBe('The science lead to confirm. AI proposals; the science lead decides')
    expect(clean('clusters >= 0.1 km2 kept, 5 deg')).toBe('clusters ≥ 0.1 km² kept, 5°')
  })
  it('first clause and radius', () => {
    expect(firstClause('a, b; c; d')).toBe('a, b')
    expect(firstClause('no clause')).toBe('no clause')
    expect([100, 2000, 2500].map(radius)).toEqual(['100 m', '2 km', '2500 m'])
  })
  it('abbreviations are marked with their long form, not inside other words', () => {
    expect(termParts('RMS height on the 20 m DEM; LROC and DEMO')).toEqual([
      { text: 'RMS', title: TERMS.RMS },
      { text: ' height on the 20 m ' },
      { text: 'DEM', title: TERMS.DEM },
      { text: '; ' },
      { text: 'LROC', title: TERMS.LROC },
      { text: ' and DEMO' },
    ])
    expect(termParts('where IM-2 came to rest')[1]).toEqual({ text: 'IM-2', title: TERMS['IM-2'] })
  })
  it('links in a source text', () => {
    expect(linkParts('Barker et al. 2023, doi:10.3847/PSJ/acf3e1; https://pgda.gsfc.nasa.gov/products/90')).toEqual([
      { text: 'Barker et al. 2023, ' },
      { text: 'doi:10.3847/PSJ/acf3e1', href: 'https://doi.org/10.3847/PSJ/acf3e1' },
      { text: '; ' },
      { text: 'https://pgda.gsfc.nasa.gov/products/90', href: 'https://pgda.gsfc.nasa.gov/products/90' },
    ])
  })
})

describe('the landing rule is stricter than the site list slope (Connecting Ridge)', () => {
  it('passes the 100 m point slope in sites.json, fails the per-pixel disk rule; the sentence says why both hold', async () => {
    const sites = JSON.parse((await import('../../public/data/sites.json?raw')).default) as { id: string; slope_deg: number }[]
    expect(sites.find((s) => s.id === 'connecting-ridge')!.slope_deg).toBeLessThanOrEqual(5)
    const v = mapAssessment(file, 'connecting-ridge')
    expect(ready(v).headline.verdict).toBe('Fails')
    expect(block(v, 'slope').limitations.join(' ')).toContain('it is not the 100 m point slope in sites.json')
    expect(STRICTER_THAN_LIST).toBe(
      'This is stricter than the slope shown in the site list (the 100 m point slope at the site); a site can pass that and fail this.',
    )
  })
})
