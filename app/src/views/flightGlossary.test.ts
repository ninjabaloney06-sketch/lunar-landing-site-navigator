// The glossary has to cover every abbreviation the Flight plan tab can show: the burn and event names of both
// mission designs, the stage and engine names of the hardware files, and the symbols of the tables.
import { describe, expect, it } from 'vitest'
import { LAUNCH_VEHICLES } from '../flight/launchVehicles'
import { SPACECRAFT } from '../flight/spacecraft'
import { GLOSSARY, expand } from './flightGlossary'

const REQUIRED = [
  'TLI', 'LOI', 'DOI', 'PDI', 'TPI', 'TPF', 'TEI', 'EI', 'OTC', 'OPF', 'NRI', 'NRD', 'RPF', 'LOPC', 'NRHO', 'LLO', 'MECO', 'CECO', 'OECO',
  'Max Q', 'SLS', 'ICPS', 'EUS', 'HLS', 'CSM', 'LM', 'ESM', 'OMS-E', 'SPS', 'RL10', 'Δv', 'v∞',
]

describe('glossary', () => {
  it('explains every abbreviation the tab is required to explain', () => {
    for (const term of REQUIRED) expect(expand(term), term).not.toBeNull()
  })

  it('explains every abbreviation in parentheses in a vehicle, stage or engine name', () => {
    const names = [
      ...LAUNCH_VEHICLES.flatMap((v) => [v.name, ...v.stages.flatMap((s) => [s.name, s.engine?.name ?? ''])]),
      ...SPACECRAFT.flatMap((v) => [v.name, ...v.modules.flatMap((m) => [m.name, m.engine?.name ?? ''])]),
    ]
    const abbreviations = new Set(names.flatMap((n) => [...n.matchAll(/\(([A-Za-z0-9-]{2,6})\)/g)].map((m) => m[1])))
    expect(abbreviations.size).toBeGreaterThan(5)
    for (const term of abbreviations) expect(expand(term), term).not.toBeNull()
  })

  it('has no term twice', () => {
    const terms = GLOSSARY.map((g) => g.term)
    expect(new Set(terms).size).toBe(terms.length)
  })
})
