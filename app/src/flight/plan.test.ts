import { describe, it, expect } from 'vitest'
import { planFlight, flightStateAt, sampleTrack } from './plan'
import { circularEphemeris } from './testEphem'
import { DEFAULT_OPTIONS, FlightPlanError } from './types'
import type { Launchpad, LandingTarget, PlanOptions, Vehicle, Vec3 } from './types'
import { DAY_S, R_EARTH_EQ, R_MOON } from './astro'
import { DEG, add, latLonUnit, norm, unit, dot, qrot, sub } from './vec'

const pad: Launchpad = {
  id: 'test-pad',
  name: 'Test pad',
  site: 'Test site',
  latDeg: 28.627,
  lonDeg: -80.621,
  source: { label: 'hand-written', url: 'https://example.invalid' },
}

const vehicle: Vehicle = {
  id: 'test-vehicle',
  name: 'Test vehicle',
  note: 'hand-written',
  parkingAltKm: 185,
  ascentLossKms: 1.5,
  ascentTimeS: 510,
  ascentArcDeg: 20,
  injectedMassKg: 27000,
  tliStageDryKg: 3500,
  tliEngine: { name: 'TLI engine', ispS: 465.5, thrustN: 110100 },
  spacecraftEngine: { name: 'Spacecraft engine', ispS: 316, thrustN: 26700 },
  sources: [],
}

const target: LandingTarget = { id: 'test-site', name: 'Test site', latDeg: -89.45, lonDeg: 222.69 }

const EPOCH = Date.UTC(2026, 10, 14)
const landingMs = EPOCH + 30 * DAY_S * 1000
const options: PlanOptions = { ...DEFAULT_OPTIONS, landingMs }
const ephem = circularEphemeris()

const plan = planFlight({ pad, vehicle, target, options, ephem })
const base = plan.burns

const angleDeg = (a: Vec3, b: Vec3) => (Math.acos(Math.min(1, Math.max(-1, dot(unit(a), unit(b))))) / DEG)

describe('planFlight: default plan', () => {
  it('burns come in order with the expected delta-v', () => {
    expect(base.map((b) => b.id)).toEqual(['ascent', 'tli', 'loi', 'doi', 'pdi'])
    const dv = (id: string) => base.find((b) => b.id === id)!.dvKms
    expect(dv('tli')).toBeGreaterThanOrEqual(3.1)
    expect(dv('tli')).toBeLessThanOrEqual(3.2)
    expect(dv('loi')).toBeGreaterThanOrEqual(0.75)
    expect(dv('loi')).toBeLessThanOrEqual(1.05)
    expect(Math.abs(dv('doi') - 0.0194)).toBeLessThan(0.002)
    expect(Math.abs(dv('pdi') - 1.992)).toBeLessThan(0.01)
  })

  it('instants are ordered and the landing is the requested one', () => {
    expect(plan.landingMs).toBe(landingMs)
    expect(plan.launchMs).toBeLessThan(plan.tliMs)
    expect(plan.tliMs).toBeLessThan(plan.soiMs)
    expect(plan.soiMs).toBeLessThan(plan.loiMs)
    expect(plan.loiMs).toBeLessThan(plan.doiMs)
    expect(plan.doiMs).toBeLessThan(plan.pdiMs)
    expect(plan.pdiMs).toBeLessThan(plan.landingMs)
    expect(plan.loiterH).toBeGreaterThanOrEqual(4)
    expect(plan.transferDays).toBeGreaterThan(4.5)
    expect(plan.transferDays).toBeLessThan(5.6)
  })

  it('launch geometry: inclination bound and near-due-east azimuth', () => {
    const bound = Math.max(pad.latDeg, Math.abs(plan.moonDeclDeg))
    expect(plan.parkingInclDeg).toBeGreaterThanOrEqual(bound - 0.05)
    expect(plan.parkingInclDeg).toBeLessThanOrEqual(bound + 3)
    expect(Math.abs(plan.launchAzimuthDeg - 90)).toBeLessThan(12)
  })

  it('tracks are strictly increasing and join at SOI', () => {
    for (const tr of [plan.geo, plan.seleno]) {
      for (let i = 1; i < tr.t.length; i++) expect(tr.t[i]).toBeGreaterThan(tr.t[i - 1])
    }
    expect(plan.geo.t[0]).toBe(plan.launchMs)
    expect(Math.abs(norm(plan.geo.p[0]) - R_EARTH_EQ)).toBeLessThan(1)
    const lastGeo = plan.geo.t.length - 1
    expect(plan.geo.t[lastGeo]).toBe(plan.soiMs)
    expect(plan.seleno.t[0]).toBe(plan.soiMs)
    const gap = norm(sub(plan.geo.p[lastGeo], add(ephem.moonPos(plan.soiMs), plan.seleno.p[0])))
    expect(gap).toBeLessThan(1)
  })

  it('lunar orbit is 100 km up and the last point lands on the site', () => {
    const atLoi = sampleTrack(plan.seleno, plan.loiMs)!
    expect(Math.abs(norm(atLoi) - (R_MOON + 100))).toBeLessThan(0.5)
    const last = plan.seleno.p[plan.seleno.p.length - 1]
    expect(Math.abs(norm(last) - R_MOON)).toBeLessThan(0.01)
    const siteDir = qrot(ephem.moonFixedToInertial(landingMs), latLonUnit(target.latDeg, target.lonDeg))
    expect(angleDeg(last, siteDir)).toBeLessThan(0.01)
  })

  it('no track point dips below the surfaces', () => {
    for (const r of plan.geo.p) expect(norm(r)).toBeGreaterThanOrEqual(R_EARTH_EQ - 1)
    for (const r of plan.seleno.p) expect(norm(r)).toBeGreaterThanOrEqual(R_MOON - 0.01)
  })

  it('mass budget and TLI burn time are plausible', () => {
    expect(plan.landedMassKg).toBeGreaterThanOrEqual(8000)
    expect(plan.landedMassKg).toBeLessThanOrEqual(13000)
    const tli = base.find((b) => b.id === 'tli')!
    expect(tli.durationS).toBeGreaterThanOrEqual(900)
    expect(tli.durationS).toBeLessThanOrEqual(1500)
  })

  it('flightStateAt: frame and phase at launch and at landing', () => {
    const s0 = flightStateAt(plan, plan.launchMs)
    expect(s0.frame).toBe('earth')
    expect(s0.phase).toBe('ascent')
    const sL = flightStateAt(plan, plan.landingMs)
    expect(sL.frame).toBe('moon')
    expect(sL.phase).toBe('descent')
    expect(sL.pos).toEqual(plan.seleno.p[plan.seleno.p.length - 1])
  })
})

describe('planFlight: transfer cap', () => {
  const capped = planFlight({ pad, vehicle, target, options: { ...options, maxTransferDays: 3.5 }, ephem })
  it('a 3.5 day cap gives a faster, costlier transfer', () => {
    expect(capped.transferDays).toBeLessThan(4.2)
    expect(capped.burns[1].dvKms).toBeGreaterThan(base[1].dvKms)
    expect(capped.burns[2].dvKms).toBeGreaterThan(base[2].dvKms)
    expect(capped.dvTotalKms).toBeGreaterThan(plan.dvTotalKms)
  })
})

describe('planFlight: coverage', () => {
  it('throws FlightPlanError when the ephemeris ends before touchdown', () => {
    const short = { ...ephem, endMs: landingMs - DAY_S * 1000 }
    expect(() => planFlight({ pad, vehicle, target, options, ephem: short })).toThrow(FlightPlanError)
  })
})

describe('sampleTrack', () => {
  it('interpolates linearly and returns null outside the range', () => {
    const tr = { t: [0, 1000], p: [[0, 0, 0], [10, 0, 0]] as Vec3[] }
    expect(sampleTrack(tr, 250)).toEqual([2.5, 0, 0])
    expect(sampleTrack(tr, -1)).toBeNull()
    expect(sampleTrack(tr, 1001)).toBeNull()
  })
})
