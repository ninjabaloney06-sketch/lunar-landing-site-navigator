import { describe, expect, it } from 'vitest'
import { missionOf } from '../missions'
import { parseHash } from '../state'
import { flightSummary } from './flightSummary'

describe('flight line of a saved mission', () => {
  it('defaults: LC-39B, SLS with Starship, a stay as long as the mission dates', () => {
    expect(flightSummary(missionOf(parseHash('')), 14)).toBe('LC-39B · SLS + Starship HLS · 14 d on the surface')
  })
  it('a mission longer than 30 days stays 30 days, the most the flight plan accepts', () => {
    expect(flightSummary(missionOf(parseHash('')), 45)).toBe('LC-39B · SLS + Starship HLS · 30 d on the surface')
  })
  it('the saved choices: a stay of its own wins over the mission length', () => {
    expect(flightSummary(missionOf(parseHash('#pad=kourou-ela4&rocket=apollo&stay=2.5')), 14)).toBe('ELA-4 · Apollo · 2.5 d on the surface')
    expect(flightSummary(missionOf(parseHash('#rocket=apollo')), 14)).toBe('LC-39B · Apollo · 14 d on the surface')
  })
})
