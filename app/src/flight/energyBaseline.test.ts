// The committed baseline (energyBaseline.json) and the multiplier read from it.
import { describe, expect, it } from 'vitest'
import baseline from './energyBaseline.json'
import { REFERENCE, energyMultiplier, fmtFactor } from './energyBaseline'
import type { BaselineFile } from './energyBaseline'
import { ARCHITECTURES } from './spacecraft'
import type { MissionPlan } from './types'

const FILE = baseline as BaselineFile
const planWith = (id: string, spaceJetEnergyMj: number | null) =>
  ({ architecture: { id }, facts: spaceJetEnergyMj === null ? {} : { ideal: { spaceJetEnergyMj } } }) as unknown as Pick<MissionPlan, 'architecture' | 'facts'>

describe('energy multiplier baseline', () => {
  it('one baseline per design, for the stated reference mission and grid', () => {
    expect(FILE.reference).toEqual(REFERENCE)
    expect(FILE.gridPoints).toBeGreaterThanOrEqual(100)
    for (const a of ARCHITECTURES) {
      const b = FILE.designs[a.id]
      expect(b, a.id).toBeDefined()
      expect(b.spaceJetEnergyMj).toBeGreaterThan(0)
      expect(b.worstOnGridMj).toBeGreaterThanOrEqual(b.spaceJetEnergyMj)
      expect(Math.abs(b.idealPoint.latDeg)).toBeLessThanOrEqual(90)
    }
  })

  it('the ideal point is 1.00×, a dearer one more; no baseline or no energy gives null', () => {
    for (const a of ARCHITECTURES) {
      const b = FILE.designs[a.id]
      expect(energyMultiplier(planWith(a.id, b.spaceJetEnergyMj))!.factor).toBeCloseTo(1, 12)
      const m = energyMultiplier(planWith(a.id, b.worstOnGridMj))!
      expect(m.factor).toBeCloseTo(m.worstOnGrid, 12)
      expect(m.idealPoint).toEqual(b.idealPoint)
    }
    expect(energyMultiplier(planWith('no-such-design', 1))).toBeNull()
    expect(energyMultiplier(planWith('apollo', null))).toBeNull()
  })

  it('two decimals with the multiplication sign', () => {
    expect(fmtFactor(1)).toBe('1.00×')
    expect(fmtFactor(1.1357)).toBe('1.14×')
  })
})
