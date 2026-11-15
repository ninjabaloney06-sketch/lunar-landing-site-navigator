// Energy multiplier: how much more energy a mission to the chosen landing point takes than the same design's
// ideal landing point, the one that needs the least.
//
// What is compared. The exhaust energy of every burn from the Trans-Lunar Injection on (facts.ideal.spaceJetEnergyMj:
// Σ ½ · propellant · (g0 · Isp)², the energy the engines really put out, with the real efficiency of a staged
// chemical rocket; no 100 % assumption). The launch to Earth orbit is left out because it is the same for every
// landing point.
//
// The baseline is a constant per design (energyBaseline.json, written by energyBaseline.gen.test.ts): the
// reference mission (REFERENCE) planned to a grid over the whole Moon and to the 18 sites, and the least value
// found. Multiplier = this mission's value / that baseline. A mission with other dates, another launchpad or a
// longer stay than the reference changes the numerator too, so the multiplier also shows what those choices cost;
// below 1.00× means these choices need less than the reference mission's best point.
import baseline from './energyBaseline.json'
import type { MissionPlan } from './types'

export const REFERENCE = {
  padId: 'ksc-39b',
  earliestTouchdownUtc: '2027-08-16T00:00:00Z', // the demo period's start (state.ts DEFAULT_PERIOD_ID)
  surfaceStay: "the design's default",
  transfer: 'minimum energy',
}

export interface BaselineFile {
  reference: typeof REFERENCE
  gridPoints: number
  designs: Record<string, { idealPoint: { name: string; latDeg: number; lonDeg: number }; spaceJetEnergyMj: number; worstOnGridMj: number }>
}

const FILE = baseline as BaselineFile

export interface EnergyMultiplier {
  factor: number // this plan / the design's ideal landing point
  idealPoint: { name: string; latDeg: number; lonDeg: number }
  worstOnGrid: number // the most expensive grid point of the reference mission, as a multiplier: the scale's top
  gridPoints: number
}

/** null when the plan carries no energy figures or the design has no baseline in this build. */
export function energyMultiplier(plan: Pick<MissionPlan, 'architecture' | 'facts'>): EnergyMultiplier | null {
  const b = FILE.designs[plan.architecture.id]
  const mj = plan.facts.ideal?.spaceJetEnergyMj
  if (!b || mj === undefined || !(b.spaceJetEnergyMj > 0)) return null
  return { factor: mj / b.spaceJetEnergyMj, idealPoint: b.idealPoint, worstOnGrid: b.worstOnGridMj / b.spaceJetEnergyMj, gridPoints: FILE.gridPoints }
}

/** "1.04×": two decimals, the precision the baseline supports. */
export const fmtFactor = (f: number) => `${f.toFixed(2)}×`
