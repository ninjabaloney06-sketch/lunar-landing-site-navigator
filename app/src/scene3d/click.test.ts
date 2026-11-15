import { describe, expect, it } from 'vitest'
import { siteLevelClick } from './click'

const sites = [
  { id: 'connecting-ridge', lat: -89.46, lon: -136.68 },
  { id: 'peak-near-shackleton', lat: -88.81, lon: 124.68 },
  { id: 'shackleton-rim-site04', lat: -89.7668, lon: -171.87 },
]

describe('siteLevelClick (bug of 15 Nov night: a site pin clicked at site level did nothing)', () => {
  it("another landing site's pin selects it with the site's own coordinates", () => {
    expect(siteLevelClick({ kind: 'site', id: 'peak-near-shackleton' }, 'connecting-ridge', sites)).toEqual({ act: 'pick', lat: -88.81, lon: 124.68 })
    expect(siteLevelClick({ kind: 'site', id: 'connecting-ridge' }, 'shackleton-rim-site04', sites)).toEqual({ act: 'pick', lat: -89.46, lon: -136.68 })
  })
  it('is never a walk on a site pin', () => {
    expect(siteLevelClick({ kind: 'site', id: 'connecting-ridge' }, 'connecting-ridge', sites)).toEqual({ act: 'none' })
    expect(siteLevelClick({ kind: 'site', id: 'unknown' }, 'connecting-ridge', sites)).toEqual({ act: 'none' })
  })
  it('a POI pin is left to the page; terrain and user points may walk', () => {
    expect(siteLevelClick({ kind: 'poi', id: 'x' }, 'connecting-ridge', sites)).toEqual({ act: 'none' })
    expect(siteLevelClick({ kind: 'point', index: 0 }, 'connecting-ridge', sites)).toEqual({ act: 'walk' })
    expect(siteLevelClick(null, 'connecting-ridge', sites)).toEqual({ act: 'walk' })
  })
})
