// Saved missions are stored as link text and read back through parseHash: anything else in storage is ignored.
import { describe, expect, it } from 'vitest'
import { MAX_MISSIONS, missionKey, missionOf, parseMissions } from './missions'
import { parseHash } from './state'

describe('saved missions', () => {
  it('a mission is the name, site, dates, stations and goal of a link, without cursor, view, drawer or points', () => {
    const hs = parseHash('#site=malapert-massif&period=custom&from=2027-09-12T00:00Z&days=10&t=2027-09-14T06:00Z&st=madrid,canberra&view=eye&drawer=details&pts=1,2&name=Massif+survey&goal=cold-trap')
    const m = missionOf(hs)
    expect(m).toEqual({ site: 'malapert-massif', period: 'custom', from: Date.UTC(2027, 8, 12), days: 10, st: ['madrid', 'canberra'], name: 'Massif survey', goal: 'cold-trap', pad: null, rocket: null, stay: null, tmax: null })
    expect(missionKey(m)).toBe('site=malapert-massif&period=custom&from=2027-09-12T00:00Z&to=2027-09-22T00:00Z&st=madrid,canberra&name=Massif+survey&goal=cold-trap')
    expect(parseMissions(JSON.stringify([missionKey(m)]))).toEqual([m])
  })

  it('ignores what is not a list of strings, drops duplicates and stops at the maximum', () => {
    expect(parseMissions(null)).toEqual([])
    expect(parseMissions('{not json')).toEqual([])
    expect(parseMissions('{"a":1}')).toEqual([])
    expect(parseMissions(JSON.stringify([42, null, 'name=A', 'name=A', 'name=B']))).toHaveLength(2)
    const many = Array.from({ length: MAX_MISSIONS + 5 }, (_, i) => `name=M${i}`)
    expect(parseMissions(JSON.stringify(many))).toHaveLength(MAX_MISSIONS)
  })

  it('a broken entry falls back to the defaults of a link, never NaN', () => {
    const [m] = parseMissions(JSON.stringify(['site=Nope!&period=zzz&days=999&goal=biology&from=garbage']))
    expect(m.site).toBeNull()
    expect(m.from).toBeNull()
    expect(Number.isFinite(m.days)).toBe(true)
    expect(m.goal).toBe('light')
  })

  it('keeps the flight choices: launchpad, rocket and surface stay', () => {
    const m = missionOf(parseHash('#site=haworth&pad=kourou-ela4&rocket=apollo&stay=2.5&view=flight'))
    expect(m).toMatchObject({ site: 'haworth', pad: 'kourou-ela4', rocket: 'apollo', stay: 2.5 })
    expect(missionKey(m)).toBe('site=haworth&pad=kourou-ela4&rocket=apollo&stay=2.5')
    expect(parseMissions(JSON.stringify([missionKey(m)]))).toEqual([m])
  })

  it('a mission saved before U10 removed point roles still loads: its points and their roles are ignored', () => {
    const old = 'site=cap:-89.47000,-136.78000&period=shackleton-2027-08&pts=-89.4700,-136.7800,s,Ridge+camp;-89.4,-130,e;-89.3,-120,zz&name=Ridge'
    const [m] = parseMissions(JSON.stringify([old, 'name=Other&pts=1,1,q,']))
    expect(m).toEqual({ ...missionOf(parseHash('#site=cap:-89.47000,-136.78000&period=shackleton-2027-08&name=Ridge')) })
    expect(m.site).toBe('cap:-89.47000,-136.78000')
    expect(m).not.toHaveProperty('pts')
    expect(missionKey(m)).not.toContain('pts')
    expect(parseMissions(JSON.stringify([old, 'name=Other&pts=1,1,q,'])).map((x) => x.name)).toEqual(['Ridge', 'Other'])
  })

  it('keeps the transfer cap; a mission saved without one loads with none, so Calculate flight never takes the cap on screen', () => {
    const m = missionOf(parseHash('#site=haworth&rocket=apollo&tmax=3&view=flight'))
    expect(m.tmax).toBe(3)
    expect(missionKey(m)).toBe('site=haworth&rocket=apollo&tmax=3')
    expect(parseMissions(JSON.stringify([missionKey(m)]))).toEqual([m])
    // saved before tmax was part of a mission: it loads, with tmax null (minimum energy)
    const [old] = parseMissions(JSON.stringify(['site=haworth&pad=kourou-ela4&rocket=apollo&stay=2']))
    expect(old).toMatchObject({ site: 'haworth', pad: 'kourou-ela4', rocket: 'apollo', stay: 2, tmax: null })
  })

  it('a surface stay outside 0.5 to 30 days is dropped, never NaN', () => {
    for (const bad of ['0', '31', 'abc', '', '-2']) expect(missionOf(parseHash(`#stay=${bad}`)).stay).toBeNull()
    expect(missionOf(parseHash('#stay=0.9')).stay).toBe(0.9)
  })
})
