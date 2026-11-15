// Every payload verdict gets an honest sentence; numbers are rounded with their error, never invented.
import { describe, expect, it } from 'vitest'
import { DEFAULT_SIGMAS } from '../flight/dispersion'
import type { PayloadResult } from '../flight/payload'
import { SPACECRAFT } from '../flight/spacecraft'
import { dispersionMeaning, limitSentence, lowerBoundPropellant, lowerBoundShort, payloadSentence, roundWithError } from './flightResultText'

const base: PayloadResult = {
  validation: { validated: false, text: 'not yet validated by the science lead' },
  verdict: 'payload',
  maxPayloadKg: 3173,
  rawPayloadKg: 3173,
  epsilonKg: 196,
  dominantTerm: { id: 'losses', label: 'Extra gravity losses', kg: 190 },
  terms: [],
  bound: 'value',
  limitedBy: { element: 'Descent Stage', kind: 'propellant' },
  shortfall: [],
  withinCheckedRange: true,
  reserveFraction: 0.03,
  cargoFrom: 'launch',
  burns: [],
  elements: [{ element: 'Descent Stage', capacityKg: 8248, capacityIsLowerBound: false, planLoadKg: 8248, planUsedKg: 6768, usedKg: 8008, reserveKg: 240, loadKg: 8248 }],
  phases: [],
  assumptions: [],
  caveats: [],
  sources: [],
}

describe('payloadSentence', () => {
  it('a payload: value and 1σ rounded together (the worked example of phys-b: 3,173 ± 196 kg)', () => {
    expect(payloadSentence(base)).toBe('Max payload: 3,170 kg ± 200 kg (1σ).')
    expect(limitSentence(base)).toBe('Limited by the Descent Stage: 8,008 kg burned + 240 kg reserve = its 8,248 kg capacity.')
  })
  it('a lower bound says "at least"', () => {
    expect(payloadSentence({ ...base, bound: 'lower' })).toMatch(/^Max payload: at least 3,170 kg/)
  })
  it('extrapolated: only an order of magnitude, with the reason', () => {
    const s = payloadSentence({ ...base, verdict: 'extrapolated', maxPayloadKg: 1_154_000, withinCheckedRange: false })
    expect(s).toContain('of the order of 1,000 t')
    expect(s).toContain('beyond the range this method is checked for')
  })
  it('undetermined (Blue Moon): cannot be decided from published data, no number', () => {
    const s = payloadSentence({ ...base, verdict: 'undetermined', maxPayloadKg: 0, bound: 'lower' })
    expect(s).toContain('cannot be decided from published data')
    expect(s).not.toMatch(/\d/)
  })
  it('short: names the element and the shortfall', () => {
    const s = payloadSentence({ ...base, verdict: 'short', maxPayloadKg: 0, shortfall: [{ element: 'Ascent Stage', kg: 1234, capacityIsLowerBound: false, carriesCargo: true }] })
    expect(s).toBe('Max payload: none. Even with no cargo the Ascent Stage is 1.2 t short of propellant (reserve included).')
    expect(limitSentence({ ...base, verdict: 'short' })).toBeNull()
  })
})

describe('roundWithError', () => {
  it('keeps two significant digits of the error', () => {
    expect(roundWithError(41.3, 4.4)).toEqual({ value: '41.3', eps: '4.4' })
    expect(roundWithError(12_345, 1_234)).toEqual({ value: '12,300', eps: '1,200' })
  })
})

describe('Blue Moon lower-bound note', () => {
  it('is read from the hardware data, not typed in', () => {
    const bm = SPACECRAFT.find((s) => s.id === 'blue-moon-mk2')
    const lb = lowerBoundPropellant(bm)
    expect(lb).not.toBeNull()
    expect(lowerBoundShort(lb!.kg)).toBe("Propellant shown (29 t) is a lower bound: the lander's full load is not published. Not yet validated by the science lead.")
    expect(lowerBoundPropellant(SPACECRAFT.find((s) => s.id === 'apollo-lm'))).toBeNull()
  })
})

describe('dispersionMeaning', () => {
  it('says the descent is unguided and states the assumed σ from the analysis itself', () => {
    const s = dispersionMeaning(DEFAULT_SIGMAS)
    expect(s).toContain('unguided')
    expect(s).toContain('assumption')
    expect(s).toContain('thrust 1 %')
    expect(s).toContain('pointing 0.15° per axis')
    expect(s).toContain('launch time 3 s')
  })
})
