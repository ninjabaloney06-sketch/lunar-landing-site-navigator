// URL builder for "Open in NASA tools" (add-on Task 3). Expected URLs are the ones opened in Chromium on 15 Nov 2026
// and recorded in docs/event/validation.md ("NASA-tools link check"): each landed on the site.
import { describe, expect, it } from 'vitest'
import { horizonsTime, horizonsUrl, lon180, lon360, moonTrekUrl, nasaLinks, quickMapUrl, southPolarXY, spanProblem } from './nasaTools'

const RIDGE = { lat: -89.46, lon: -136.68, elev_m: 1944.6 } // sites.json
const MALAPERT = { lat: -85.98, lon: -0.26, elev_m: 4817.6 } // sites.json
const CUSTOM = { lat: -87.5, lon: 60, elev_m: null } // cap:-87.50000,60.00000 before its height is computed
const NOW = { startMs: Date.parse('2026-11-14T00:00:00Z'), endMs: Date.parse('2026-11-29T00:00:00Z') } // periods.json "now"
const MAL_DEC = { startMs: Date.parse('2026-12-21T00:00:00Z'), endMs: Date.parse('2026-12-28T00:00:00Z') }

const H = 'https://ssd.jpl.nasa.gov/api/horizons.api?format=text'
const V1_TAIL = '&STEP_SIZE=%276%20h%27&QUANTITIES=%274%27&ANG_FORMAT=%27DEG%27&EXTRA_PREC=%27YES%27&TIME_DIGITS=%27MINUTES%27&APPARENT=%27AIRLESS%27'
const head = (cmd: string) =>
  `${H}&COMMAND=%27${cmd}%27&OBJ_DATA=%27NO%27&MAKE_EPHEM=%27YES%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27coord%40301%27&COORD_TYPE=%27GEODETIC%27`

describe('Connecting Ridge', () => {
  const l = nasaLinks(RIDGE, NOW)
  it('Moon Trek: South Pole Map centred in polar stereographic metres', () => {
    expect(l.moonTrek.href).toBe(
      'https://trek.nasa.gov/moon/#v=0.1&x=-11234.2&y=-11913.2&z=8&p=urn%3Aogc%3Adef%3Acrs%3AIAU2000%3A%3A30120&d=&locale=&b=moon&e=&sfz=&w=',
    )
    expect(l.polar).toBe(true)
  })
  it('QuickMap: 40 km box in the Stereographic South Pole view (proj 27)', () => {
    expect(l.quickMap.href).toBe('https://quickmap.lroc.im-ldi.com/?prjExtent=-31234.2%2C-31913.2%2C8765.8%2C8086.8&proj=27')
  })
  it('Horizons: Sun and Earth with the V1 settings over the mission dates, eye height = terrain + 1.75 m', () => {
    const site = '&SITE_COORD=%27223.32%2C-89.46%2C1.94635%27&START_TIME=%272026-11-14%2000%3A00%27&STOP_TIME=%272026-11-29%2000%3A00%27'
    expect(l.horizonsSun.href).toBe(head('10') + site + V1_TAIL)
    expect(l.horizonsEarth.href).toBe(head('399') + site + V1_TAIL)
  })
})

describe('Malapert Massif', () => {
  const l = nasaLinks(MALAPERT, MAL_DEC)
  it('builds the three tools', () => {
    expect(l.moonTrek.href).toBe(
      'https://trek.nasa.gov/moon/#v=0.1&x=-553.4&y=121948.6&z=8&p=urn%3Aogc%3Adef%3Acrs%3AIAU2000%3A%3A30120&d=&locale=&b=moon&e=&sfz=&w=',
    )
    expect(l.quickMap.href).toBe('https://quickmap.lroc.im-ldi.com/?prjExtent=-20553.4%2C101948.6%2C19446.6%2C141948.6&proj=27')
    expect(l.horizonsSun.href).toBe(
      head('10') +
        '&SITE_COORD=%27359.74%2C-85.98%2C4.81935%27&START_TIME=%272026-12-21%2000%3A00%27&STOP_TIME=%272026-12-28%2000%3A00%27' +
        V1_TAIL,
    )
  })
})

describe('custom site', () => {
  it('links are only coordinates; an unknown height puts the eye 1.75 m above the sphere', () => {
    const l = nasaLinks(CUSTOM, NOW)
    expect(l.horizonsSun.href).toContain('&SITE_COORD=%2760%2C-87.5%2C0.00175%27&')
    expect(l.quickMap.href).toBe('https://quickmap.lroc.im-ldi.com/?prjExtent=45662.4%2C17910.2%2C85662.4%2C57910.2&proj=27')
    expect(l.moonTrek.href).toContain('&x=65662.4&y=37910.2&z=8&p=urn%3Aogc%3Adef%3Acrs%3AIAU2000%3A%3A30120&')
  })
})

describe('north of 80° S: non-polar views', () => {
  it('45° S: Moon Trek Global Map in degrees, QuickMap Equidistant Cylindrical (proj 16) in metres', () => {
    const s = { lat: -45, lon: 30, elev_m: 0 }
    expect(moonTrekUrl(s).href).toBe(
      'https://trek.nasa.gov/moon/#v=0.1&x=30&y=-45&z=8&p=urn%3Aogc%3Adef%3Acrs%3AEPSG%3A%3A104903&d=&locale=&b=moon&e=&sfz=&w=',
    )
    expect(moonTrekUrl(s).view).toBe('global map')
    expect(quickMapUrl(s).href).toBe('https://quickmap.lroc.im-ldi.com/?prjExtent=889700.5%2C-1384550.8%2C929700.5%2C-1344550.8&proj=16')
    expect(nasaLinks(s, NOW).polar).toBe(false)
  })
  it('78° S: QuickMap keeps the polar view (its cylindrical view ends at 75°), Moon Trek the Global Map', () => {
    const s = { lat: -78, lon: 10, elev_m: 0 }
    expect(quickMapUrl(s).href).toBe('https://quickmap.lroc.im-ldi.com/?prjExtent=43419.1%2C339667.7%2C83419.1%2C379667.7&proj=27')
    expect(moonTrekUrl(s).view).toBe('global map')
  })
  it('north of 75° N: QuickMap opens without a position and says what to type', () => {
    expect(quickMapUrl({ lat: 80, lon: 10, elev_m: 0 })).toEqual({ href: 'https://quickmap.lroc.im-ldi.com/', note: 'opens the tool; enter 80, 10' })
  })
})

describe('longitude near ±180°', () => {
  it('179.9° E and −180° give the same place as the tools expect', () => {
    expect(quickMapUrl({ lat: -45, lon: 179.9, elev_m: 0 }).href).toBe(
      'https://quickmap.lroc.im-ldi.com/?prjExtent=5435170.7%2C-1384550.8%2C5475170.7%2C-1344550.8&proj=16',
    )
    expect(moonTrekUrl({ lat: -45, lon: 180.1, elev_m: 0 }).href).toContain('&x=-179.9&y=-45&')
    const a = horizonsUrl({ lat: -89.5, lon: -180, elev_m: 0 }, NOW, 'sun').href!
    const b = horizonsUrl({ lat: -89.5, lon: 180, elev_m: 0 }, NOW, 'sun').href!
    expect(a).toContain('SITE_COORD=%27180%2C-89.5%2C0.00175%27')
    expect(a).toBe(b)
    expect(moonTrekUrl({ lat: -89.5, lon: -180, elev_m: 0 }).href).toBe(moonTrekUrl({ lat: -89.5, lon: 180, elev_m: 0 }).href)
    expect(lon180(180)).toBe(-180)
    expect(lon360(-136.68)).toBeCloseTo(223.32, 10)
    expect(lon360(-0.0)).toBe(0)
  })
  it('polar metres are continuous across the antimeridian', () => {
    const [x1, y1] = southPolarXY(-89.5, 179.999)
    const [x2, y2] = southPolarXY(-89.5, -179.999)
    expect(Math.hypot(x1 - x2, y1 - y2)).toBeLessThan(1)
  })
})

describe('dates', () => {
  it('a month and a year boundary', () => {
    const span = { startMs: Date.parse('2026-12-30T18:00:00Z'), endMs: Date.parse('2027-01-02T00:00:00Z') }
    expect(horizonsUrl(RIDGE, span, 'sun').href).toContain('&START_TIME=%272026-12-30%2018%3A00%27&STOP_TIME=%272027-01-02%2000%3A00%27&')
    const month = { startMs: Date.parse('2027-01-31T00:00:00Z'), endMs: Date.parse('2027-02-02T00:00:00Z') }
    expect(horizonsUrl(RIDGE, month, 'earth').href).toContain('&START_TIME=%272027-01-31%2000%3A00%27&STOP_TIME=%272027-02-02%2000%3A00%27&')
  })
  it('seconds round outward to whole minutes, in UTC', () => {
    const span = { startMs: Date.parse('2026-11-14T00:00:30Z'), endMs: Date.parse('2026-11-15T00:00:01Z') }
    const href = horizonsUrl(RIDGE, span, 'sun').href!
    expect(href).toContain('START_TIME=%272026-11-14%2000%3A00%27')
    expect(href).toContain('STOP_TIME=%272026-11-15%2000%3A01%27')
    expect(horizonsTime(Date.parse('2027-03-05T07:08:00Z'))).toBe('2027-03-05 07:08')
  })
  it('no mission dates: no Horizons link, with the reason; the map links still work', () => {
    const l = nasaLinks(RIDGE, null)
    expect(l.horizonsSun).toEqual({ href: null, note: 'No mission dates are set.' })
    expect(l.horizonsEarth.href).toBeNull()
    expect(l.moonTrek.href).not.toBeNull()
    expect(spanProblem({ startMs: NaN, endMs: 1 })).toBe('No mission dates are set.')
    expect(spanProblem({ startMs: 0, endMs: 0 })).toBe('The mission period is shorter than a minute.')
  })
})

describe('encoding', () => {
  it('every Horizons value is quoted and fully URL-encoded: no raw space, quote, comma, colon or @', () => {
    const href = horizonsUrl(RIDGE, NOW, 'earth').href!
    const query = href.split('?')[1]
    expect(query).not.toMatch(/[ ',:@]/)
    const params = new URLSearchParams(query)
    expect(params.get('CENTER')).toBe("'coord@301'")
    expect(params.get('SITE_COORD')).toBe("'223.32,-89.46,1.94635'")
    expect(params.get('START_TIME')).toBe("'2026-11-14 00:00'")
    expect(params.get('STEP_SIZE')).toBe("'6 h'")
    expect(params.get('APPARENT')).toBe("'AIRLESS'")
  })
  it('map links carry the CRS and extent encoded', () => {
    expect(moonTrekUrl(RIDGE).href).not.toMatch(/crs:/)
    expect(quickMapUrl(RIDGE).href!.split('?')[1]).not.toMatch(/,/)
  })
})
