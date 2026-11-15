import { describe, expect, it } from 'vitest'
import { missionOf } from '../missions'
import { parseHash } from '../state'
import { flightSummary } from './flightSummary'

describe('flight line of a saved mission', () => {
  it('defaults: LC-39B, SLS with Starship, its 6.5-day stay', () => {
    expect(flightSummary(missionOf(parseHash('')))).toBe('LC-39B · SLS + Starship HLS · 6.5 d on the surface')
  })
  it('the saved choices', () => {
    expect(flightSummary(missionOf(parseHash('#pad=kourou-ela4&rocket=apollo&stay=2.5')))).toBe('ELA-4 · Apollo · 2.5 d on the surface')
    expect(flightSummary(missionOf(parseHash('#rocket=apollo')))).toBe('LC-39B · Apollo · 0.9 d on the surface') // Apollo 11's 21 h 36 min
  })
})
