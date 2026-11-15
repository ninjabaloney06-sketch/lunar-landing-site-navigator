// The sentences of the Rocket flight menu's analyses (maximum payload, cheapest route, landing dispersion; all
// NOT YET VALIDATED BY THE SCIENCE LEAD). Pure functions, so every verdict has a test (flightResultText.test.ts).
// Numbers come from flight/payload.ts and flight/dispersion.ts unchanged; this file only rounds and words them.
import type { DispersionResult, DispersionSigmas } from '../flight/dispersion'
import type { SpacecraftSpec } from '../flight/hardware'
import type { PayloadResult } from '../flight/payload'

export const NOT_VALIDATED_TEXT = 'Not yet validated by the science lead.'

const grouped = (v: number) => Math.round(v).toLocaleString('en-US')

/** A value and its 1σ rounded together: ε to two significant digits, the value to the same place.
 *  3,173 ± 196 → "3,170" and "200"; 41.3 ± 4.4 → "41" and "4.4". */
export function roundWithError(value: number, eps: number): { value: string; eps: string } {
  if (!(eps > 0) || !Number.isFinite(eps)) return { value: grouped(value), eps: '0' }
  const place = Math.floor(Math.log10(eps)) - 1 // two significant digits of ε
  const step = 10 ** place
  const r = (x: number) => Math.round(x / step) * step
  const digits = Math.max(0, -place)
  const fmt = (x: number) => x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return { value: fmt(r(value)), eps: fmt(r(eps)) }
}

const tonnes = (kg: number) => `${(kg / 1000).toFixed(kg < 10_000 ? 1 : 0)} t`

/** The one summary line for the maximum payload, for every verdict. */
export function payloadSentence(p: PayloadResult): string {
  switch (p.verdict) {
    case 'payload': {
      const r = roundWithError(p.maxPayloadKg, p.epsilonKg)
      return `Max payload: ${p.bound === 'lower' ? 'at least ' : ''}${r.value} kg ± ${r.eps} kg (1σ).`
    }
    case 'extrapolated': {
      // far beyond the checked range: an order of magnitude at most
      const t = p.maxPayloadKg / 1000
      const mag = 10 ** Math.round(Math.log10(Math.max(t, 1)))
      return `Max payload: of the order of ${grouped(mag)} t, beyond the range this method is checked for (cargo above 30 % of the lander's mass).`
    }
    case 'undetermined':
      // the reason (the propellant figure is a lower bound) is the note under the result, not repeated here
      return 'Max payload: cannot be decided from published data.'
    case 'short': {
      const s = p.shortfall.find((x) => x.carriesCargo) ?? p.shortfall[0]
      if (s) return `Max payload: none. Even with no cargo the ${s.element} is ${tonnes(s.kg)} short of propellant (reserve included).`
      return 'Max payload: none. The engines cannot hold the empty lander at touchdown.'
    }
  }
}

/** The tank or engines that set the limit, in words; null when none applies. */
export function limitSentence(p: PayloadResult): string | null {
  if (!p.limitedBy || (p.verdict !== 'payload' && p.verdict !== 'extrapolated')) return null
  if (p.limitedBy.kind === 'thrust') return `Limited by the ${p.limitedBy.element}: at touchdown they must still hold the lander's weight.`
  const e = p.elements.find((x) => x.element === p.limitedBy!.element)
  if (!e) return `Limited by the ${p.limitedBy.element}'s propellant.`
  return (
    `Limited by the ${e.element}: ${grouped(e.usedKg)} kg burned + ${grouped(e.reserveKg)} kg reserve = its ` +
    `${grouped(e.capacityKg)} kg ${e.capacityIsLowerBound ? 'capacity (a lower limit)' : 'capacity'}.`
  )
}

/** The largest uncertainty term, in words; null when there is none. */
export function dominantSentence(p: PayloadResult): string | null {
  if (!p.dominantTerm || !(p.epsilonKg > 0)) return null
  return `Largest uncertainty: ${p.dominantTerm.label}, ±${grouped(p.dominantTerm.kg)} kg.`
}

/** The lander's propellant figure when the hardware data marks it as a lower bound (Blue Moon), else null. */
export function lowerBoundPropellant(lander: SpacecraftSpec | undefined): { kg: number; note: string } | null {
  for (const m of lander?.modules ?? []) {
    if (m.propellantStatus?.kind === 'lower-bound') return { kg: m.propellantKg, note: m.propellantStatus.note }
  }
  return null
}

/** The short form shown beside any propellant verdict of such a lander (the full note is for full data mode). */
export function lowerBoundShort(kg: number): string {
  return `Propellant shown (${grouped(kg / 1000)} t) is a lower bound: the lander's full load is not published. ${NOT_VALIDATED_TEXT}`
}

// ---- landing dispersion

const DEG = 180 / Math.PI

/** What the dispersion is and what its σ are, in one sentence beside the numbers. */
export function dispersionMeaning(s: DispersionSigmas): string {
  const pct = (f: number) => `${(3 * f * 100).toFixed(1).replace(/\.0$/, '')} %`
  return (
    'Scatter of an unguided descent: DOI and braking flown as commanded, so a guided lander lands much closer. ' +
    `Every error is an assumption (3σ): thrust ${pct(s.thrustFrac)}, specific impulse ${pct(s.ispFrac)}, ` +
    `pointing ${(3 * s.pointingRad * DEG).toFixed(2)}° per axis, launch time ${(3 * s.launchS).toFixed(0)} s.`
  )
}

/** Full data mode: what the runs show besides the ellipse. */
export function dispersionDetails(r: DispersionResult): string[] {
  const out = [
    `${r.flown} of ${r.n} runs reached the surface (seed ${r.seed}); 99.7 % landed within ${r.landing.radius997Km.toFixed(1)} km of the site, the farthest ${r.landing.maxKm.toFixed(1)} km.`,
    `Touchdown speed: mean ${r.touchdown.meanSpeedMs.toFixed(2)} m/s, highest ${r.touchdown.maxSpeedMs.toFixed(2)} m/s; ${r.touchdown.hard} above 3 m/s.`,
    `Descent propellant: planned ${grouped(r.propellant.nominalKg)} kg, runs ${grouped(r.propellant.minKg)} to ${grouped(r.propellant.maxKg)} kg; ` +
      `${r.propellant.overBudget} of ${r.flown} needed more than the ${grouped(r.propellant.availableKg)} kg on board.`,
  ]
  if (r.j2Only) {
    const km = Math.hypot(r.j2Only.eastKm, r.j2Only.northKm)
    out.push(
      `The Moon's J2 alone, with no other error, moves the touchdown ${km.toFixed(1)} km and changes the propellant by ` +
        `${(r.j2Only.usedKg - r.propellant.nominalKg).toFixed(0)} kg: the plan itself is computed without J2, so most of the offset of the ellipse's centre is that bias.`,
    )
  }
  if (r.brakingCutShort > 0) out.push(`${r.brakingCutShort} runs reached the switch height before the braking burn's commanded end.`)
  return out
}

/** Progress in words: "Flying run 120 of 200…". */
export function progressText(what: 'route' | 'dispersion', done: number, total: number): string {
  return what === 'route' ? `Planning option ${Math.min(done + 1, total)} of ${total}…` : `Flying run ${Math.min(done + 1, total)} of ${total}…`
}
