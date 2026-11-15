// Pinned results: the full numeric output of the planners, recorded bit for bit before any change made only for
// speed. Every Δv, propellant figure, event instant, note and every sampled point of every track goes into a
// hash over the exact Float64 values (and the strings); a few values are also spelled out, so a failure shows
// what moved. A speed change that moves any number, by any amount, fails here. Do not edit the expected values
// to make a change pass: a change that moves them is not a speed change, it is a change of the results.
//
// Cases: both mission designs (low lunar orbit, halo orbit), all three architectures and so every launch
// vehicle (Saturn V, SLS Block 1, SLS Block 1B), a polar, a near-equatorial and a mid-latitude far-side site,
// three launchpads, a return window; plus the patched-conic planner (plan.ts), the ascent sensitivity
// (payload.ts), the payload maximum and the descent dispersion (dispersion.ts).
import { describe, expect, it } from 'vitest'
import aug2027 from '../../public/data/ephem/2027-08.json?raw'
import sep2027 from '../../public/data/ephem/2027-09.json?raw'
import oct2027 from '../../public/data/ephem/2027-10.json?raw'
import nov2027 from '../../public/data/ephem/2027-11.json?raw'
import type { EphemMonth } from '../data/types'
import { MU_MOON, R_MOON } from './astro'
import { runDispersion } from './dispersion'
import { makeFlightEphemeris } from './ephemeris'
import { LAUNCH_VEHICLES } from './launchVehicles'
import { planDescent } from './lunar'
import type { DescentInput, OrbitState } from './lunar'
import { planMission } from './mission'
import type { MissionInput } from './mission'
import { planMissionNrho } from './missionNrho'
import { LAUNCHPADS } from './pads'
import { ascentSensitivity, maxPayload } from './payload'
import { planFlight } from './plan'
import { moonField } from './sim'
import { ARCHITECTURES, SPACECRAFT } from './spacecraft'
import { circularEphemeris } from './testEphem'
import { DEFAULT_OPTIONS } from './types'
import type { Vec3 } from './types'
import { cross, latLonUnit, qrot, scale, unit } from './vec'

/** FNV-1a (two independent 32-bit lanes) over a canonical byte stream of a value: numbers as their 8 Float64
 *  bytes, strings as UTF-16 code units, object keys sorted, functions skipped. Returns 16 hex digits. */
export function pinHash(value: unknown): { hash: string; numbers: number } {
  let a = 0x811c9dc5
  let b = 0x01000193 ^ 0x5bd1e995
  const buf = new DataView(new ArrayBuffer(8))
  let numbers = 0
  const byte = (x: number) => {
    a = Math.imul(a ^ x, 0x01000193) >>> 0
    b = Math.imul(b ^ x, 0x01000193 + 0x100) >>> 0
  }
  const tag = (c: string) => byte(c.charCodeAt(0))
  const num = (x: number) => {
    numbers++
    buf.setFloat64(0, x)
    for (let i = 0; i < 8; i++) byte(buf.getUint8(i))
  }
  const str = (s: string) => {
    num(s.length)
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i)
      byte(c & 0xff)
      byte(c >>> 8)
    }
  }
  const walk = (v: unknown) => {
    if (v === null) return tag('n')
    if (v === undefined) return tag('u')
    switch (typeof v) {
      case 'number':
        tag('d')
        return num(v)
      case 'string':
        tag('s')
        return str(v)
      case 'boolean':
        return tag(v ? 'T' : 'F')
      case 'function':
        return tag('f')
      case 'object': {
        if (Array.isArray(v) || ArrayBuffer.isView(v)) {
          const arr = v as ArrayLike<unknown>
          tag('[')
          num(arr.length)
          for (let i = 0; i < arr.length; i++) walk(arr[i])
          return tag(']')
        }
        tag('{')
        for (const k of Object.keys(v as object).sort()) {
          str(k)
          walk((v as Record<string, unknown>)[k])
        }
        return tag('}')
      }
      default:
        return tag('?')
    }
  }
  walk(value)
  const hex = (x: number) => x.toString(16).padStart(8, '0')
  return { hash: hex(a) + hex(b), numbers }
}

const ephem = makeFlightEphemeris([aug2027, sep2027, oct2027, nov2027].map((m) => JSON.parse(m) as EphemMonth))
const padOf = (id: string) => LAUNCHPADS.find((p) => p.id === id)!
const hardwareOf = (id: string) => {
  const arch = ARCHITECTURES.find((a) => a.id === id)!
  return {
    architecture: arch,
    launchVehicle: LAUNCH_VEHICLES.find((v) => v.id === arch.launchVehicleId)!,
    capsule: SPACECRAFT.find((v) => v.id === arch.capsuleId)!,
    lander: SPACECRAFT.find((v) => v.id === arch.landerId)!,
  }
}

interface Case {
  name: string
  arch: string
  pad: string
  latDeg: number
  lonDeg: number
  stayDays: number
  returnWindowDays: number
  earliest: number
  /** Expected: hash of the whole plan (ephem left out), count of numbers hashed, and three spelled-out values. */
  hash: string
  numbers: number
  touchdownMs: number
  dvTotalKms: number
  endMs: number
}

// Recorded on branch w2/perf before any change for speed (commit message says which commit).
const CASES: Case[] = [
  { name: 'LLO Apollo, south pole, KSC', arch: 'apollo', pad: 'ksc-39b', latDeg: -89.5, lonDeg: 0, stayDays: 0.9, returnWindowDays: 0, earliest: Date.UTC(2027, 7, 16), hash: 'af5e840715c08ea6', numbers: 26306, touchdownMs: 1818382412530.0715, dvTotalKms: 17.50415138185501, endMs: 1818869649448 },
  { name: 'LLO Apollo, near-side equator, Kourou, return window', arch: 'apollo', pad: 'kourou-ela4', latDeg: 0.5, lonDeg: 10, stayDays: 3, returnWindowDays: 1, earliest: Date.UTC(2027, 8, 2), hash: 'e3228e7eafd203bf', numbers: 42812, touchdownMs: 1819868980205.591, dvTotalKms: 17.668598688327602, endMs: 1820607706007 },
  { name: 'LLO Apollo, far side 30°N, Tanegashima', arch: 'apollo', pad: 'tanegashima-yoshinobu', latDeg: 30, lonDeg: 180, stayDays: 14, returnWindowDays: 0, earliest: Date.UTC(2027, 7, 20), hash: 'bb7fbf52572345c3', numbers: 124209, touchdownMs: 1818753479166.3406, dvTotalKms: 19.186367915666224, endMs: 1820353443248 },
  { name: 'NRHO Starship, south pole, KSC', arch: 'artemis-starship', pad: 'ksc-39b', latDeg: -89.5, lonDeg: 0, stayDays: 6.5, returnWindowDays: 0, earliest: Date.UTC(2027, 8, 12), hash: 'dfc4306c48d4c3d1', numbers: 34004, touchdownMs: 1820725369339.9985, dvTotalKms: 18.32295136095005, endMs: 1822203540463 },
  { name: 'NRHO Starship, near-side equator, KSC', arch: 'artemis-starship', pad: 'ksc-39b', latDeg: 0, lonDeg: 0, stayDays: 3, returnWindowDays: 0, earliest: Date.UTC(2027, 8, 12), hash: 'e5cb9efa1c7fe83d', numbers: 57793, touchdownMs: 1820722454800.5786, dvTotalKms: 18.633059028922666, endMs: 1822203540308 },
  { name: 'NRHO Blue Moon, far side 30°N, Kourou', arch: 'artemis-blue-moon', pad: 'kourou-ela4', latDeg: 30, lonDeg: 180, stayDays: 6.5, returnWindowDays: 0, earliest: Date.UTC(2027, 8, 12), hash: '6972db0cf0c93273', numbers: 36580, touchdownMs: 1820729878207.954, dvTotalKms: 18.663909015399774, endMs: 1822210863740 },
]

// PIN_RECORD=1 prints the values instead of checking them (only for recording a new case).
const RECORD = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.PIN_RECORD === '1'
const inputOf = (c: Case): MissionInput => ({
  ...hardwareOf(c.arch),
  pad: padOf(c.pad),
  target: { id: 'x', name: 'Chosen landing point', latDeg: c.latDeg, lonDeg: c.lonDeg },
  ephem,
  earliestTouchdownMs: c.earliest,
  surfaceStayDays: c.stayDays,
  returnWindowDays: c.returnWindowDays,
  maxTransferDays: null,
})
const planOf = (c: Case) => {
  const inp = inputOf(c)
  return ARCHITECTURES.find((a) => a.id === c.arch)!.rendezvous === 'nrho' ? planMissionNrho(inp) : planMission(inp)
}

describe('pinned planner results, bit for bit', () => {
  it.each(CASES)('$name', (c) => {
    const { ephem: _e, ...plan } = planOf(c)
    const h = pinHash(plan)
    const got = { hash: h.hash, numbers: h.numbers, touchdownMs: plan.touchdownMs, dvTotalKms: plan.events.reduce((s, e) => s + (e.dvKms ?? 0), 0), endMs: plan.endMs }
    if (RECORD) {
      console.log(`[pin] ${c.name}: ${JSON.stringify(got)}`)
      return
    }
    expect(got.touchdownMs).toBe(c.touchdownMs)
    expect(got.endMs).toBe(c.endMs)
    expect(got.dvTotalKms).toBe(c.dvTotalKms)
    expect(got.numbers).toBe(c.numbers)
    expect(got.hash).toBe(c.hash)
  }, 300000)
})

// payload.ts: the ascent sensitivity (two ascents) and the payload maximum over the Apollo south-pole plan.
const PAYLOAD = { sensitivity: 0.8009121998565679, hash: '7ce69daf54f20752' }
describe('pinned payload results, bit for bit', () => {
  it('ascent sensitivity and maximum payload, Apollo south pole', () => {
    const c = CASES[0]
    const h = hardwareOf(c.arch)
    const s = ascentSensitivity({ ...h, pad: padOf(c.pad), rendezvous: 'llo' })
    const plan = planOf(c)
    const r = maxPayload({ plan, ...h, rendezvous: 'llo', ascentKgPerKg: s })
    const hash = pinHash(r).hash
    if (RECORD) {
      console.log(`[pin] payload: ${JSON.stringify({ sensitivity: s, hash })}`)
      return
    }
    expect(s).toBe(PAYLOAD.sensitivity)
    expect(hash).toBe(PAYLOAD.hash)
  }, 300000)
})

// plan.ts (patched conics + n-body transfer): the inputs of plan.test.ts.
const PLAN_FLIGHT = { hash: '6551c3fd4066cc64', numbers: 7480 }
describe('pinned patched-conic planner, bit for bit', () => {
  it('plan.test.ts case', () => {
    const plan = planFlight({
      pad: { id: 'test-pad', name: 'Test pad', site: 'Test site', latDeg: 28.627, lonDeg: -80.621, source: { label: 'hand-written', url: 'https://example.invalid' } },
      vehicle: {
        id: 'test-vehicle', name: 'Test vehicle', note: 'hand-written', parkingAltKm: 185, ascentLossKms: 1.5, ascentTimeS: 510, ascentArcDeg: 20,
        injectedMassKg: 27000, tliStageDryKg: 3500, tliEngine: { name: 'TLI engine', ispS: 465.5, thrustN: 110100 },
        spacecraftEngine: { name: 'Spacecraft engine', ispS: 316, thrustN: 26700 }, sources: [],
      },
      target: { id: 'test-site', name: 'Test site', latDeg: -89.45, lonDeg: 222.69 },
      options: { ...DEFAULT_OPTIONS, landingMs: Date.UTC(2026, 10, 14) + 30 * 86400_000 },
      ephem: circularEphemeris(),
    })
    const { ephem: _e, ...rest } = plan
    const h = pinHash(rest)
    if (RECORD) {
      console.log(`[pin] planFlight: ${JSON.stringify(h)}`)
      return
    }
    expect(h.numbers).toBe(PLAN_FLIGHT.numbers)
    expect(h.hash).toBe(PLAN_FLIGHT.hash)
  }, 300000)
})

// dispersion.ts: the scenario of dispersion.test.ts, 12 runs, with and without the Moon's J2.
const DISPERSION = { j2: 'e8398de1ba770d3e', noJ2: 'c95bd25c59cd140b' }
describe('pinned descent dispersion, bit for bit', () => {
  it('12 runs, seed 7', () => {
    const e = circularEphemeris()
    const t0 = Date.UTC(2026, 10, 20)
    const lm = SPACECRAFT.find((s) => s.id === 'apollo-lm')!
    const massKg = lm.modules.reduce((s, m) => s + m.dryKg + m.propellantKg, 0)
    const siteUnit = latLonUnit(-89.5, 45)
    const site = (utcMs: number): Vec3 => scale(qrot(e.moonFixedToInertial(utcMs), siteUnit), R_MOON)
    const pole = qrot(e.moonFixedToInertial(t0), [0, 0, 1])
    const inEquator = unit(cross(pole, cross(site(t0), pole)))
    const rOrbit = R_MOON + 100
    const orbit: OrbitState = { utcMs: t0, r: scale(inEquator, rOrbit), v: scale(pole, -Math.sqrt(MU_MOON / rOrbit)) }
    const descentInput: DescentInput = { field: moonField(e, t0 - 3600_000, t0 + 86400_000), orbit, earliestMs: t0 + 0.5 * 3600_000, site, lander: lm, massKg, pdiAltKm: 15 }
    const descent = planDescent(descentInput)
    const j2 = pinHash(runDispersion({ descentInput, descent, ephem: e }, { n: 12, seed: 7 })).hash
    const noJ2 = pinHash(runDispersion({ descentInput, descent, ephem: e }, { n: 12, seed: 7, j2: false })).hash
    if (RECORD) {
      console.log(`[pin] dispersion: ${JSON.stringify({ j2, noJ2 })}`)
      return
    }
    expect(j2).toBe(DISPERSION.j2)
    expect(noJ2).toBe(DISPERSION.noJ2)
  }, 300000)
})
