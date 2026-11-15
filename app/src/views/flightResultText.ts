// The sentences of the Rocket flight menu's analyses (maximum payload, cheapest route, landing dispersion; all
// validated by the science lead, statement of 15 Nov 2026; see record). Pure functions, so every verdict has a test (flightResultText.test.ts).
// Numbers come from flight/payload.ts and flight/dispersion.ts unchanged; this file only rounds and words them.
import type { DispersionResult, DispersionSigmas } from '../flight/dispersion'
import type { SpacecraftSpec } from '../flight/hardware'
import type { PayloadResult } from '../flight/payload'
import { fmtKg } from './flightFormat'

export const NOT_VALIDATED_TEXT = 'Validated by the science lead (statement of 15 Nov 2026; see record).'

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

/** The one summary line for the maximum payload, for every verdict. `shortElements`: the elements of this flight's
 *  plan that are short of propellant (the condition of propellantStatus, "… short by …"); when there are any, no
 *  payload figure is stated next to them. */
export function payloadSentence(p: PayloadResult, shortElements: string[] = []): string {
  if ((p.verdict === 'payload' || p.verdict === 'extrapolated') && shortElements.length > 0) {
    const names = shortElements.join(' and ')
    return `Max payload: not estimated — ${names} ${shortElements.length > 1 ? 'are' : 'is'} short of propellant for this flight.`
  }
  switch (p.verdict) {
    case 'payload': {
      const r = roundWithError(p.maxPayloadKg, p.epsilonKg)
      return `Max payload: ${p.bound === 'lower' ? 'at least ' : ''}${r.value} kg ± ${r.eps} kg (1σ).`
    }
    case 'extrapolated':
      // far beyond the checked range: no magnitude (the figure is an extrapolation of a linearised method)
      return "Max payload: outside the range this method is checked for (cargo above 30 % of the lander's mass)."
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
export function lowerBoundPropellant(lander: SpacecraftSpec | undefined): { kg: number; note: string; element: string } | null {
  for (const m of lander?.modules ?? []) {
    if (m.propellantStatus?.kind === 'lower-bound') return { kg: m.propellantKg, note: m.propellantStatus.note, element: m.name }
  }
  return null
}

/** The short form shown beside any propellant verdict of such a lander (the full note is for full data mode). */
export function lowerBoundShort(kg: number): string {
  return (
    `Propellant shown (${grouped(kg / 1000)} t) is a lower bound: the lander's full load is not published, ` +
    `so this verdict cannot be decided from published data. ${NOT_VALIDATED_TEXT}`
  )
}

/** Summary-mode propellant verdict. The threshold is the plan's own: an element is short when it needs more than its
 *  capacity (usedKg > capacityKg, as in the propellant table). 'undecided': every short element has a capacity that
 *  the hardware data marks as a lower bound, so the shortfall cannot be decided from published data. */
export function propellantStatus(
  uses: { element: string; usedKg: number; capacityKg: number }[],
  lowerBoundElement: string | null,
): { tone: 'enough' | 'short' | 'undecided'; text: string } {
  const short = uses.filter((u) => u.usedKg > u.capacityKg)
  if (short.length === 0) return { tone: 'enough', text: 'Propellant: every stage has enough.' }
  const list = short.map((u) => `${u.element} short by ${fmtKg(u.usedKg - u.capacityKg)}`).join(', ')
  const undecided = lowerBoundElement !== null && short.every((u) => u.element === lowerBoundElement)
  return { tone: undecided ? 'undecided' : 'short', text: `Propellant: ${list}.` }
}

/** The elements propellantStatus calls short, for the payload line; empty when none is short or when only the
 *  lower-bound element is (Blue Moon: that case keeps its own sentence). */
export function shortElementsOf(uses: { element: string; usedKg: number; capacityKg: number }[], lowerBoundElement: string | null): string[] {
  if (propellantStatus(uses, lowerBoundElement).tone !== 'short') return []
  return uses.filter((u) => u.usedKg > u.capacityKg && u.element !== lowerBoundElement).map((u) => u.element)
}

/** The route search's sentence as the menu shows it: NASA's symbol for delta-v, and m/s figures with a thousands
 *  separator as everywhere else in the menu ("1945 m/s" → "1,945 m/s"; the number itself is unchanged). */
export function routeText(sentence: string): string {
  return sentence.replace(/delta-v/g, 'Δv').replace(/\b(\d{4,}) m\/s/g, (_, d: string) => `${Number(d).toLocaleString('en-US')} m/s`)
}

// ---- errors: one plain sentence with what the user can do; the planner's own reason only in full data mode

const TRY_INPUTS = 'Try another landing date, launchpad, transfer or rocket.'

/** An error of the mission plan, the payload or an analysis, as the menu shows it. */
export function errorText(what: 'mission' | 'payload' | 'route' | 'dispersion', message: string): { sentence: string; detail: string | null } {
  const m = message.trim()
  const detail = (prefix: RegExp) => {
    const rest = m.replace(prefix, '').trim()
    return rest === '' ? null : rest
  }
  if (/worker|this browser/i.test(m)) {
    return { sentence: 'This browser did not start the background calculation. Reload the page or use a current browser.', detail: m }
  }
  if (what === 'mission') {
    if (/ephemeris/i.test(m)) {
      // useFlight states the touchdowns the build supports (from the months present); shown in every mode
      const range = /With a [^]*? the flight calculator supports touchdowns from [^]*? UTC to [^]*? UTC\./.exec(m)?.[0]
      const sentence = 'This build has no ephemeris (Moon, Earth and Sun positions) for these dates. Choose other mission dates in the Mission menu.'
      return { sentence: range ? `${sentence} ${range}` : sentence, detail: m }
    }
    if (/No launch opportunity/i.test(m)) return { sentence: `No launch opportunity was found for this landing time. ${TRY_INPUTS}`, detail: null }
    if (/shortest transfer/i.test(m)) return { sentence: 'The shortest transfer this planner supports is about 2.5 days. Choose a longer transfer limit.', detail: null }
    if (/not reachable from this orbit/i.test(m)) return { sentence: `The site is not reachable from the lunar orbit at this pass. ${TRY_INPUTS}`, detail: m }
    return { sentence: `This flight could not be planned. ${TRY_INPUTS}`, detail: detail(/^Could not compute the mission\.\s*/) }
  }
  if (what === 'payload') return { sentence: 'The maximum payload could not be worked out for this plan. The plan itself is unaffected.', detail: detail(/^Could not work out the payload\.\s*/) }
  if (what === 'route') return { sentence: 'The cheapest-route search stopped. Start it again, or change the inputs first.', detail: detail(/^The search stopped:\s*/) }
  return { sentence: 'The dispersion analysis stopped. Start it again, or change the inputs first.', detail: detail(/^The dispersion analysis stopped:\s*/) }
}

// ---- landing dispersion

const DEG = 180 / Math.PI

/** Summary mode, beside the numbers: what kind of scatter this is, and that its inputs are assumed. */
export const DISPERSION_BRIEF = 'Unguided descent: a guided lander lands much closer. Every error size is an assumption.'

/** Full data mode: what the dispersion is and what its σ are, in one sentence beside the numbers. */
export function dispersionMeaning(s: DispersionSigmas): string {
  const pct = (f: number) => `${(3 * f * 100).toFixed(1).replace(/\.0$/, '')} %`
  return (
    'Scatter of an unguided descent: DOI and braking flown as commanded, so a guided lander lands much closer. ' +
    `Every error size is an assumption (3σ): thrust ${pct(s.thrustFrac)}, specific impulse (Isp) ${pct(s.ispFrac)}, ` +
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

/** Progress in words: "Flying descent 120 of 200…". */
export function progressText(what: 'route' | 'dispersion', done: number, total: number): string {
  const n = Math.min(done + 1, total)
  return what === 'route' ? `Planning option ${n} of ${total}…` : `Flying descent ${n} of ${total}…`
}
