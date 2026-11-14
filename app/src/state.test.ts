// User points in the link (Brief C4 part 3): old links still parse, names and roles survive a copied link,
// and editing the list never renames another point.
import { describe, expect, it } from 'vitest'
import { EMPTY_STATE, MAX_POINTS, addPoint, parseHash, pointName, removePoint, renamePoint, serializeHash, setPointRole } from './state'
import type { UserPoint } from './state'

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
