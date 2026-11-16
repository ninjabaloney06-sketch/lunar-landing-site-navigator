// P4: the Blue Moon Mark 2 shortfall comes from the data, not the physics. The lander's propellant is the
// difference of two published figures (fuelled mass "more than 45 metric tons", dry 16 t), so it is a lower
// bound, and no NASA or Blue Origin source states the tank capacity or the load at the start of the descent.
// This file holds that fact in the data: the value stays 29,000 kg, flagged as a lower bound with its reason and
// sources for the UI, and no other vehicle carries the flag. The shortfall itself is asserted in
// missionNrho.test.ts ("reports what each element needs against what it carries") and stays true.
import { describe, expect, it } from 'vitest'
import { G0 } from './astro'
import { SPACECRAFT } from './spacecraft'

describe('P4 Blue Moon Mark 2 propellant is a flagged lower bound', () => {
  const bm = SPACECRAFT.find((s) => s.id === 'blue-moon-mk2')!
  const stage = bm.modules[0]

  it('keeps the derived value: fuelled mass > 45,000 kg minus dry mass 16,000 kg', () => {
    expect(bm.modules.length).toBe(1)
    expect(stage.dryKg).toBe(16_000)
    expect(stage.propellantKg).toBe(29_000)
  })

  it('marks it as a lower bound, not validated, with the article that states the masses and the refuelling', () => {
    const st = stage.propellantStatus!
    expect(st.kind).toBe('lower-bound')
    expect(st.validated).toBe(false)
    expect(st.note).toContain('lower bound')
    expect(st.note).toContain('stated as validated by the science lead on 15 Nov 2026; no per-check sign-off; see record')
    const urls = st.sources.map((s) => s.url)
    expect(urls).toContain('https://thespacereview.com/article/4587/1')
    expect(urls).toContain('https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/')
    // every flagged source is also listed with the vehicle, so the UI's source list shows it
    for (const u of urls) expect(bm.sources.map((s) => s.url)).toContain(u)
  })

  it('no other vehicle is flagged', () => {
    for (const s of SPACECRAFT) for (const m of s.modules) if (s.id !== 'blue-moon-mk2') expect(m.propellantStatus).toBeUndefined()
  })

  it('with this lower bound the lander has about 4.7 km/s, less than the 5.2 km/s the NRHO sortie needs', () => {
    // the comment of the shortfall test in missionNrho.test.ts, checked here from the data alone
    const e = stage.engine!
    const dvKms = (G0 * e.ispVacS * Math.log((stage.dryKg + stage.propellantKg) / stage.dryKg)) / 1000
    expect(dvKms).toBeGreaterThan(4.6)
    expect(dvKms).toBeLessThan(4.8)
  })
})
