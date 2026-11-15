import { describe, expect, it } from 'vitest'
import { customSiteId } from '../data/customSite'
import type { Period, Site } from '../data/types'
import type { MissionState } from '../missions'
import { EMPTY_STATE } from '../state'
import { SITE_REGION_TEXT } from './custom'
import { buildYearRows, CURRENT_TAG, POINT_TAG } from './yearStack'

const site = (id: string): Site => ({ id, name: id.toUpperCase(), group: 'artemis', horizon: `${id}.json` }) as unknown as Site
const SITES = [site('a'), site('b'), site('c'), site('d')]
const PERIODS = [
  { id: 'p1', start_utc: '2027-08-16T00:00:00Z', end_utc: '2027-08-30T00:00:00Z' },
  { id: 'p2', start_utc: '2027-09-14T00:00:00Z', end_utc: '2027-09-28T00:00:00Z' },
] as unknown as Period[]
const mission = (m: Partial<MissionState>): MissionState => ({ ...EMPTY_STATE, ...m })
const period = { startMs: Date.UTC(2027, 7, 16), endMs: Date.UTC(2027, 7, 30) }
const base = { site: SITES[1], period, sites: SITES, periods: PERIODS }

describe('buildYearRows', () => {
  it('a fresh link: the current site alone, every other prepared site behind the fold', () => {
    const { rows, rest } = buildYearRows({ ...base, missions: [], points: [] })
    expect(rows.map((r) => [r.key, r.tags])).toEqual([['b', [CURRENT_TAG]]])
    expect(rows[0].missions).toEqual([{ name: CURRENT_TAG, ...period }])
    expect(rest.map((s) => s.id)).toEqual(['a', 'c', 'd'])
  })

  it('order: current site, saved missions in saved order, points, then the rest in site-list order', () => {
    const { rows, rest } = buildYearRows({
      ...base,
      missions: [mission({ site: 'd', period: 'p2', name: 'Delta' }), mission({ site: 'a', period: 'p1', name: null })],
      points: [{ lat: -85.5, lon: 12.25, name: 'Camp' }],
    })
    expect(rows.map((r) => r.name)).toEqual(['B', 'D', 'A', 'Camp'])
    expect(rows.map((r) => r.tags)).toEqual([[CURRENT_TAG], ['Delta'], ['Saved mission'], [POINT_TAG]])
    expect(rows[1].missions).toEqual([{ name: 'Delta', startMs: Date.UTC(2027, 8, 14), endMs: Date.UTC(2027, 8, 28) }])
    expect(rows[3].site).toMatchObject({ id: customSiteId(-85.5, 12.25), group: 'custom', name: 'Camp' })
    expect(rest.map((s) => s.id)).toEqual(['c'])
  })

  it('one row per site: missions on the same site share it, each with its own dates', () => {
    const { rows } = buildYearRows({
      ...base,
      missions: [mission({ site: 'b', period: 'p2', name: 'Ops' }), mission({ site: 'c', period: 'p1', name: 'One' }), mission({ site: 'c', period: 'p2', name: 'Two' })],
      points: [],
    })
    expect(rows.map((r) => r.key)).toEqual(['b', 'c'])
    expect(rows[0].tags).toEqual([CURRENT_TAG, 'Ops'])
    expect(rows[0].missions.map((m) => m.name)).toEqual([CURRENT_TAG, 'Ops'])
    expect(rows[1].tags).toEqual(['One', 'Two'])
    expect(rows[1].missions.map((m) => m.startMs)).toEqual([Date.UTC(2027, 7, 16), Date.UTC(2027, 8, 14)])
  })

  it('a saved mission on a custom site is a row named after the mission; a point at the same place joins it', () => {
    const id = customSiteId(-86, 20)!
    const { rows } = buildYearRows({ ...base, missions: [mission({ site: id, period: 'p1', name: 'Rim' })], points: [{ lat: -86, lon: 20, name: null }] })
    expect(rows.map((r) => r.key)).toEqual(['b', id])
    expect(rows[1]).toMatchObject({ name: 'Rim', tags: ['Rim', POINT_TAG] })
  })

  it('a mission without a site is at the default site; a site this build does not have gives no row', () => {
    const sites = [...SITES, site('connecting-ridge')]
    const { rows } = buildYearRows({ ...base, sites, missions: [mission({ site: null, name: 'Default' }), mission({ site: 'gone', name: 'Gone' })], points: [] })
    expect(rows.map((r) => r.key)).toEqual(['b', 'connecting-ridge'])
  })

  it('a point that cannot be a landing site: a row with the reason and no site', () => {
    const { rows } = buildYearRows({ ...base, missions: [], points: [{ lat: 45, lon: 10, name: 'North' }] })
    expect(rows[1]).toEqual({ key: 'pt:0', site: null, name: 'North', tags: [POINT_TAG], missions: [], reason: SITE_REGION_TEXT })
  })
})
