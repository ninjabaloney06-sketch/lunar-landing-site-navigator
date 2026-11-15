// The flight calculator offers two designs, Apollo and SLS; every architecture is reachable through one of them.
import { describe, expect, it } from 'vitest'
import { ALL_OFFERED, DEFAULT_ARCHITECTURE_ID, DESIGNS, designOf, designShortName } from './designs'
import { ARCHITECTURES } from './spacecraft'

describe('mission designs offered', () => {
  it('Apollo and SLS, and every architecture belongs to exactly one', () => {
    expect(DESIGNS.map((d) => d.id)).toEqual(['apollo', 'sls'])
    expect(ALL_OFFERED).toBe(true)
    for (const a of ARCHITECTURES) expect(DESIGNS.filter((d) => d.architectureIds.includes(a.id))).toHaveLength(1)
    for (const d of DESIGNS) for (const id of d.architectureIds) expect(ARCHITECTURES.some((a) => a.id === id)).toBe(true)
  })

  it('short names for the table, and the default is SLS with Starship', () => {
    expect(designShortName('apollo')).toBe('Apollo')
    expect(designShortName('artemis-starship')).toBe('SLS + Starship HLS')
    expect(designShortName('artemis-blue-moon')).toBe('SLS + Blue Moon Mark 2')
    expect(DEFAULT_ARCHITECTURE_ID).toBe('artemis-starship')
    expect(designOf('nope').id).toBe('apollo')
  })

  it('every design shows at most three short bullets', () => {
    for (const d of DESIGNS) {
      expect(d.bullets.length).toBeGreaterThan(0)
      expect(d.bullets.length).toBeLessThanOrEqual(3)
      for (const b of d.bullets) expect(b.length).toBeLessThanOrEqual(70)
    }
  })
})
