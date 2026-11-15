// User points in the link (Brief C4 part 3): old links still parse, names and roles survive a copied link,
// and editing the list never renames another point.
import { describe, expect, it } from 'vitest'
import { EMPTY_STATE, MAX_POINTS, addPoint, parseHash, pointName, removePoint, renamePoint, serializeHash, setPointRole } from './state'
import type { UserPoint } from './state'
import { customSiteId, parseCustomSiteId } from './data/customSite'
import { capSiteId } from './data/southcap'

const link = (pts: UserPoint[]) => serializeHash({ ...EMPTY_STATE, pts })
const roundTrip = (pts: UserPoint[]) => parseHash(link(pts)).pts

describe('user points in the link', () => {
  it('parses the old format lat,lon;lat,lon, with letter names and no roles', () => {
    const pts = parseHash('#pts=-89.3000,-130.0000;-85.5,12.25').pts
    expect(pts).toEqual([
      { lat: -89.3, lon: -130, name: null, role: null },
      { lat: -85.5, lon: 12.25, name: null, role: null },
    ])
    expect(pts.map(pointName)).toEqual(['Point A', 'Point B'])
    // Written back unchanged: a reload neither drops nor renames a point.
    expect(link(pts)).toBe('pts=-89.3000,-130.0000;-85.5000,12.2500')
  })

  it('keeps name and role through a copied link, including separators and percent signs in a name', () => {
    const pts: UserPoint[] = [
      { lat: -89.3, lon: -130, name: 'Rim, north; 50% lit', role: 'start' },
      { lat: -85.5, lon: 12.25, name: null, role: 'end' },
      { lat: 10, lon: 179.9999, name: 'Crater %2C', role: null },
    ]
    expect(roundTrip(pts)).toEqual(pts)
    expect(roundTrip(roundTrip(pts))).toEqual(pts)
  })

  it('drops invalid entries and never yields NaN', () => {
    const pts = parseHash('#pts=999,1;abc,2;-80,;,5;-80,400;-70,200,s,X').pts
    expect(pts).toEqual([{ lat: -70, lon: -160, name: 'X', role: 'start' }])
  })

  it('allows one Start and one End: a second in a link is ignored, a second set by the user replaces the first', () => {
    expect(parseHash('#pts=1,1,s;2,2,s;3,3,e').pts.map((p) => p.role)).toEqual(['start', null, 'end'])
    let pts = addPoint(addPoint([], 1, 1)!, 2, 2)!
    pts = setPointRole(pts, 0, 'start')
    pts = setPointRole(pts, 1, 'start')
    expect(pts.map((p) => p.role)).toEqual([null, 'start'])
    pts = setPointRole(pts, 0, 'end')
    expect(pts.map((p) => p.role)).toEqual(['end', 'start'])
    expect(setPointRole(pts, 1, null).map((p) => p.role)).toEqual(['end', null])
  })

  it('names new points with the first free letter and never renames the others', () => {
    let pts = parseHash('#pts=1,1;2,2;3,3').pts
    pts = removePoint(pts, 0)
    expect(pts.map(pointName)).toEqual(['Point B', 'Point C'])
    pts = addPoint(pts, 4, 4)!
    expect(pts.map(pointName)).toEqual(['Point B', 'Point C', 'Point A'])
    pts = renamePoint(pts, 1, '  Ridge   camp ')
    expect(pts.map(pointName)).toEqual(['Point B', 'Ridge camp', 'Point A'])
    expect(renamePoint(pts, 1, '   ').map(pointName)).toEqual(['Point B', 'Point C', 'Point A'])
    expect(roundTrip(pts)).toEqual(pts)
  })

  it('wraps longitude, rejects a latitude off the Moon and stops at the maximum', () => {
    expect(addPoint([], -89, 190)![0].lon).toBeCloseTo(-170, 9)
    expect(addPoint([], 91, 0)).toBeNull()
    let pts: UserPoint[] = []
    for (let i = 0; i < MAX_POINTS; i++) pts = addPoint(pts, -80, i)!
    expect(pts).toHaveLength(MAX_POINTS)
    expect(new Set(pts.map(pointName)).size).toBe(MAX_POINTS)
    expect(addPoint(pts, -80, 100)).toBeNull()
  })
})

describe('points-of-interest layer in the link', () => {
  const poi = (h: string) => parseHash(h).poi
  it('is off by default and absent from the link', () => {
    expect(EMPTY_STATE.poi).toBeNull()
    expect(poi('')).toBeNull()
    expect(poi('#site=connecting-ridge')).toBeNull()
    expect(serializeHash(EMPTY_STATE)).not.toContain('poi')
  })
  it('round-trips all, none and a subset in POI_GROUPS order', () => {
    expect(poi('#poi=all')).toEqual(['hazard', 'water', 'cold-trap', 'light', 'landing', 'science'])
    expect(serializeHash({ ...EMPTY_STATE, poi: ['science', 'hazard', 'water', 'cold-trap', 'light', 'landing'] })).toBe('poi=all')
    expect(poi('#poi=none')).toEqual([])
    expect(serializeHash({ ...EMPTY_STATE, poi: [] })).toBe('poi=none')
    expect(poi('#poi=water,hazard')).toEqual(['hazard', 'water'])
    expect(serializeHash({ ...EMPTY_STATE, poi: ['water', 'hazard'] })).toBe('poi=hazard,water')
  })
  it('drops unknown words and treats a value with no known group as off', () => {
    expect(poi('#poi=hazard,lava')).toEqual(['hazard'])
    expect(poi('#poi=lava')).toBeNull()
    expect(poi('#poi=')).toBeNull()
  })
  it('parses the search and docs panels as drawer values', () => {
    expect(parseHash('#drawer=search').drawer).toBe('search')
    expect(parseHash('#drawer=docs').drawer).toBe('docs')
    expect(parseHash('#drawer=other').drawer).toBeNull()
  })
})

describe('landing site in the link: a site id, or a custom site cap:<lat>,<lon>', () => {
  const site = (h: string) => parseHash(h).site
  it('reads every site id as before', () => {
    expect(site('#site=connecting-ridge')).toBe('connecting-ridge')
    expect(site('#site=malapert-site23&period=shackleton-2027-08')).toBe('malapert-site23')
    expect(site('#site=Nope!')).toBeNull()
    expect(site('')).toBeNull()
  })
  it('round-trips a custom site id, readable in the link', () => {
    const id = customSiteId(-85.5, 12.25)!
    expect(id).toBe('cap:-85.50000,12.25000')
    const link = serializeHash({ ...EMPTY_STATE, pts: [], site: id })
    expect(link).toBe('site=cap:-85.50000,12.25000')
    expect(site(`#${link}`)).toBe(id)
    // the percent-encoded form a browser may write reads the same
    expect(site('#site=cap%3A-85.50000%2C12.25000')).toBe(id)
  })
  it('rounds to the five decimals of the id, wraps longitude and never writes −0', () => {
    expect(customSiteId(-89.123456789, 190)).toBe('cap:-89.12346,-170.00000')
    expect(customSiteId(-85, -0.000001)).toBe('cap:-85.00000,0.00000')
    expect(site(`#site=${customSiteId(-85, -0.000001)}`)).toBe('cap:-85.00000,0.00000')
  })
  it('ignores a custom id outside the pin region, off the Moon or in another form', () => {
    expect(customSiteId(-70, 10)).toBeNull()
    expect(customSiteId(Number.NaN, 10)).toBeNull()
    for (const v of ['cap:-70.00000,10.00000', 'cap:-85.5,12.25', 'cap:-85.50000,12.25000,1', 'cap:-95.00000,1.00000', 'cap:-85.00000,190.00000', 'cap:-85.00000,-0.00000', 'cap:abc'])
      expect(site(`#site=${v}`), v).toBeNull()
  })
  it('the id equals capSiteId of its own coordinates (the terrain meta.site_id the scene rebuilds on)', () => {
    const id = customSiteId(-88.2, -45.75)!
    const c = parseCustomSiteId(id)!
    expect(c).toEqual({ lat: -88.2, lon: -45.75 })
    expect(capSiteId(c.lat, c.lon)).toBe(id)
  })
})

describe('a malformed link never throws and never yields NaN', () => {
  const junk = [
    '#%', '#%E0%A4%A', '#site=%ZZ', '#=&&=&', '#site=&period=&t=&days=&pts=&poi=&stay=&tmax=',
    '#period=custom&from=2030-12-31T23:45Z&days=60', '#period=custom&days=0', '#t=2026-13-45T25:61Z',
    '#t=9999-01-01T00:00Z&from=0000-01-01T00:00Z', '#days=1e3&stay=Infinity&tmax=NaN', '#stay=-1&tmax=4.50000001',
    '#pts=,;;,,;NaN,NaN;1e999,0;-91,0;0,361;0,0,x,%zz', '#view=__proto__&drawer=constructor&goal=toString',
    '#site=cap:NaN,NaN&rocket=../x&pad=<script>', '#st=,,,&name=%00%01%7F', `#name=${'x'.repeat(5000)}`,
  ]
  it.each(junk)('%s', (h) => {
    const s = parseHash(h)
    const nums = [s.from, s.days, s.t, s.tmax, s.stay, ...s.pts.flatMap((p) => [p.lat, p.lon])]
    for (const n of nums) if (n !== null) expect(Number.isFinite(n)).toBe(true)
    expect(['globe', 'site', 'eye', 'flight']).toContain(s.view)
    expect(s.drawer === null || ['details', 'finder', 'sources', 'search', 'docs'].includes(s.drawer)).toBe(true)
    expect(s.name === null || s.name.length <= 40).toBe(true)
    expect(() => parseHash(serializeHash(s))).not.toThrow()
    expect(serializeHash(parseHash(serializeHash(s)))).toBe(serializeHash(s))
  })
})
