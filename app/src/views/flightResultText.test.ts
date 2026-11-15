// Every payload verdict gets an honest sentence; numbers are rounded with their error, never invented.
import { describe, expect, it } from 'vitest'
import { DEFAULT_SIGMAS } from '../flight/dispersion'
import type { PayloadResult } from '../flight/payload'
import { SPACECRAFT } from '../flight/spacecraft'
import { DISPERSION_BRIEF, dispersionMeaning, errorText, limitSentence, lowerBoundPropellant, lowerBoundShort, payloadSentence, propellantStatus, roundWithError, routeText, shortElementsOf } from './flightResultText'

const base: PayloadResult = {
  validation: { validated: false, text: 'validated by the science lead (statement of 15 Nov 2026; see record)' },
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
  it('extrapolated: no magnitude, only the reason', () => {
    const s = payloadSentence({ ...base, verdict: 'extrapolated', maxPayloadKg: 1_154_000, withinCheckedRange: false })
    expect(s).toBe("Max payload: outside the range this method is checked for (cargo above 30 % of the lander's mass).")
    expect(s).not.toMatch(/\d+ t\b|kg/)
  })
  it('an element of the flight short of propellant: no payload figure, the element named', () => {
    const ext = { ...base, verdict: 'extrapolated' as const, maxPayloadKg: 1_154_000, withinCheckedRange: false }
    expect(payloadSentence(ext, ['ICPS'])).toBe('Max payload: not estimated — ICPS is short of propellant for this flight. That limits the mission as planned, not the cargo.')
    expect(payloadSentence(base, ['ICPS', 'Descent Stage'])).toBe('Max payload: not estimated — ICPS and Descent Stage are short of propellant for this flight. That limits the mission as planned, not the cargo.')
    // the plan's condition ("… short by …"); the Blue Moon lower-bound-only case keeps its own sentence
    const use = (element: string, usedKg: number, capacityKg: number) => ({ element, usedKg, capacityKg })
    expect(shortElementsOf([use('ICPS', 30_500, 29_000), use('Descent Stage', 8_000, 8_248)], null)).toEqual(['ICPS'])
    expect(shortElementsOf([use('Blue Moon Mark 2', 36_500, 29_000)], 'Blue Moon Mark 2')).toEqual([])
    expect(shortElementsOf([use('Descent Stage', 8_000, 8_248)], null)).toEqual([])
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
    expect(lowerBoundShort(lb!.kg)).toBe(
      "Propellant shown (29 t) is a lower bound: the lander's full load is not published, so this verdict cannot be decided from published data. Validated by the science lead (statement of 15 Nov 2026; see record).",
    )
    expect(lb!.element).toBe('Blue Moon Mark 2')
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
    expect(s).toContain('Every error size is an assumption')
  })
  it('the summary form keeps both warnings', () => {
    expect(DISPERSION_BRIEF).toContain('Unguided descent')
    expect(DISPERSION_BRIEF).toContain('guided lander lands much closer')
    expect(DISPERSION_BRIEF).toContain('Every error size is an assumption')
  })
})

describe('propellantStatus', () => {
  const use = (element: string, usedKg: number, capacityKg: number) => ({ element, usedKg, capacityKg })
  it('enough when no element needs more than its capacity (the threshold of the propellant table)', () => {
    expect(propellantStatus([use('S-IVB', 70_000, 71_000), use('Descent Stage', 8248, 8248)], null)).toEqual({ tone: 'enough', text: 'Propellant: every stage has enough.' })
  })
  it('names each short element and its shortfall in kg', () => {
    expect(propellantStatus([use('Descent Stage', 9_460, 8_248)], null)).toEqual({ tone: 'short', text: 'Propellant: Descent Stage short by 1,200 kg.' })
  })
  it('undecided when only the lower-bound element is short (Blue Moon)', () => {
    expect(propellantStatus([use('Blue Moon Mark 2', 36_500, 29_000)], 'Blue Moon Mark 2').tone).toBe('undecided')
    expect(propellantStatus([use('Blue Moon Mark 2', 36_500, 29_000), use('ICPS', 30_000, 29_000)], 'Blue Moon Mark 2').tone).toBe('short')
  })
})

describe('errorText', () => {
  it('one plain sentence with what to do; the planner reason only as detail', () => {
    const e = errorText('mission', 'Could not compute the mission. the insertion did not converge (0.12 km, 0.0001° off)')
    expect(e.sentence).toBe('This flight could not be planned. Try another landing date, launchpad, transfer or rocket.')
    expect(e.detail).toBe('the insertion did not converge (0.12 km, 0.0001° off)')
    expect(errorText('mission', 'No ephemeris for these dates in this build. A mission needs …').sentence).toContain('Choose other mission dates')
    expect(errorText('payload', 'The payload needs a background worker, which this browser did not start.').sentence).toContain('Reload the page')
    expect(errorText('route', 'The search stopped: boom').sentence).toBe('The cheapest-route search stopped. Start it again, or change the inputs first.')
  })
})

describe('routeText', () => {
  it('writes delta-v as Δv', () => {
    expect(routeText('The largest saving is in LOI: 109 m/s less delta-v, 1.2 t less propellant.')).toBe('The largest saving is in LOI: 109 m/s less Δv, 1.2 t less propellant.')
  })
  it('groups thousands in m/s figures, leaves dates alone', () => {
    expect(routeText('Least propellant: 16 Aug 2027. The largest saving is in TLI: 1945 m/s less delta-v.')).toBe(
      'Least propellant: 16 Aug 2027. The largest saving is in TLI: 1,945 m/s less Δv.',
    )
  })
})
