// Independent checks of the flight planner against a fixed-step RK4 integrator written here, which shares no
// code with the closed-form Kepler functions in astro.ts nor with the adaptive integrator in nbody.ts, and
// against the app's real DE440 ephemeris files.
//   1. Two-body: the ellipse and hyperbola time/position formulas reproduce an integrated orbit.
//   2. Real ephemeris: the default mission's plan is self-consistent and physically plausible.
//   3. The planned injection, integrated here under Earth, Moon and Sun gravity read straight from the
//      ephemeris, arrives at the planned perilune: right altitude, right instant, a plane over the landing site.
import { describe, expect, it } from 'vitest'
import aug2027 from '../../public/data/ephem/2027-08.json?raw'
import sep2027 from '../../public/data/ephem/2027-09.json?raw'
import type { EphemMonth } from '../data/types'
import { MU_EARTH, MU_MOON, R_EARTH_EQ, R_MOON, SOI_MOON, ellipse, hyperbola, hyperbolicTimeFromPeriapsis, perifocal, timeFromPeriapsis } from './astro'
import { MU_SUN } from './nbody'
import { makeFlightEphemeris } from './ephemeris'
import { LAUNCHPADS } from './pads'
import { planFlight, sampleTrack } from './plan'
import { DEFAULT_OPTIONS } from './types'
import type { FlightEphemeris, LandingTarget, Vec3 } from './types'
import { VEHICLES } from './vehicles'
import { DEG, add, cross, dot, latLonUnit, norm, qrot, scale, sub, unit } from './vec'

type State = { r: Vec3; v: Vec3 }
type Accel = (r: Vec3, tS: number) => Vec3

function rk4(s: State, tS: number, h: number, acc: Accel): State {
  const k1v = acc(s.r, tS)
  const k1r = s.v
  const k2v = acc(add(s.r, scale(k1r, h / 2)), tS + h / 2)
  const k2r = add(s.v, scale(k1v, h / 2))
  const k3v = acc(add(s.r, scale(k2r, h / 2)), tS + h / 2)
  const k3r = add(s.v, scale(k2v, h / 2))
  const k4v = acc(add(s.r, scale(k3r, h)), tS + h)
  const k4r = add(s.v, scale(k3v, h))
  return {
    r: add(s.r, scale(add(add(k1r, scale(k2r, 2)), add(scale(k3r, 2), k4r)), h / 6)),
    v: add(s.v, scale(add(add(k1v, scale(k2v, 2)), add(scale(k3v, 2), k4v)), h / 6)),
  }
}

function propagate(s0: State, seconds: number, step: number, acc: Accel): State {
  let s = s0
  let t = 0
  while (t < seconds - 1e-9) {
    const h = Math.min(step, seconds - t)
    s = rk4(s, t, h, acc)
    t += h
  }
  return s
}

const central = (mu: number): Accel => (r) => scale(r, -mu / norm(r) ** 3)
const P: Vec3 = [1, 0, 0]
const Q: Vec3 = [0, 1, 0]

describe('Kepler formulas against numerical integration', () => {
  it('transfer ellipse: position after the closed-form time matches the integrated orbit', () => {
    const el = ellipse(R_EARTH_EQ + 185, 384400)
    const start = perifocal(el, MU_EARTH, 0, P, Q)
    for (const nuDeg of [60, 120, 160, 175]) {
      const nu = nuDeg * DEG
      const t = timeFromPeriapsis(MU_EARTH, el, nu)
      const num = propagate(start, t, 2, central(MU_EARTH))
      const exact = perifocal(el, MU_EARTH, nu, P, Q)
      expect(norm(sub(num.r, exact.r))).toBeLessThan(0.5) // km, after up to 4.6 days
      expect(norm(sub(num.v, exact.v))).toBeLessThan(1e-5) // km/s
    }
  })

  it('approach hyperbola: time from periapsis to the sphere of influence matches the integrated orbit', () => {
    const hy = hyperbola(MU_MOON, 0.8, R_MOON + 100)
    const nuS = Math.acos((hy.p / SOI_MOON - 1) / hy.e)
    const t = hyperbolicTimeFromPeriapsis(MU_MOON, hy, nuS)
    const num = propagate(perifocal(hy, MU_MOON, 0, P, Q), t, 1, central(MU_MOON))
    expect(Math.abs(norm(num.r) - SOI_MOON)).toBeLessThan(0.5)
    expect(norm(sub(num.r, perifocal(hy, MU_MOON, nuS, P, Q).r))).toBeLessThan(0.5)
    // energy: speed at the SOI is sqrt(vInf² + 2 mu / r)
    expect(Math.abs(norm(num.v) - Math.sqrt(0.8 ** 2 + (2 * MU_MOON) / SOI_MOON))).toBeLessThan(1e-6)
  })
})

describe('default mission on the real DE440 ephemeris', () => {
  const ephem: FlightEphemeris = makeFlightEphemeris([JSON.parse(aug2027) as EphemMonth, JSON.parse(sep2027) as EphemMonth])
  const landingMs = Date.UTC(2027, 7, 16)
  const target: LandingTarget = { id: 'connecting-ridge', name: 'Connecting Ridge', latDeg: -89.46, lonDeg: -136.68 }
  const pad = LAUNCHPADS.find((p) => p.id === 'ksc-39b')!
  const vehicle = VEHICLES.find((v) => v.id === 'sls-block-1')!
  const plan = planFlight({ pad, vehicle, target, options: { ...DEFAULT_OPTIONS, landingMs }, ephem })
  const dv = (id: string) => plan.burns.find((b) => b.id === id)!.dvKms

  it('ephemeris adapter: the Moon is where and as fast as it should be', () => {
    const d = norm(ephem.moonPos(landingMs))
    expect(d).toBeGreaterThan(356000)
    expect(d).toBeLessThan(407000)
    const v = norm(ephem.moonVel(landingMs))
    expect(v).toBeGreaterThan(0.95)
    expect(v).toBeLessThan(1.09)
    // prograde about J2000 north, declination within the Moon's range
    expect(cross(ephem.moonPos(landingMs), ephem.moonVel(landingMs))[2]).toBeGreaterThan(0)
    expect(Math.abs(Math.asin(unit(ephem.moonPos(landingMs))[2]) / DEG)).toBeLessThan(29)
    // Earth turns once per sidereal day about +z
    const q0 = ephem.earthFixedToInertial(landingMs)
    expect(Math.abs(q0[0])).toBeLessThan(0.01)
    expect(Math.abs(q0[1])).toBeLessThan(0.01)
  })

  it('burns are in the textbook range for a minimum-energy direct transfer', () => {
    expect(dv('tli')).toBeGreaterThan(3.1)
    expect(dv('tli')).toBeLessThan(3.16)
    expect(plan.model).toBe('n-body')
    expect(dv('loi')).toBeGreaterThan(0.75)
    expect(dv('loi')).toBeLessThan(1.0)
    expect(plan.transferDays).toBeGreaterThan(4.2)
    expect(plan.transferDays).toBeLessThan(5.5)
    expect(plan.loiterH).toBeGreaterThanOrEqual(4)
    expect(plan.loiterH).toBeLessThanOrEqual(34)
    expect(plan.landingMs).toBe(landingMs)
  })

  it('launch is as close to due east as the Moon allows', () => {
    const bound = Math.max(pad.latDeg, Math.abs(plan.moonDeclDeg))
    expect(plan.parkingInclDeg).toBeGreaterThan(bound - 0.05)
    expect(plan.parkingInclDeg).toBeLessThan(bound + 3)
  })

  it('the pad is under the parking orbit at liftoff and the path is continuous', () => {
    const p0 = plan.geo.p[0]
    const padNow = scale(qrot(ephem.earthFixedToInertial(plan.launchMs), latLonUnit(pad.latDeg, pad.lonDeg)), R_EARTH_EQ)
    expect(norm(sub(p0, padNow))).toBeLessThan(1e-6)
    // The orbit plane (two parking-orbit points) contains the pad: the rocket never has to leave its plane.
    const a = sampleTrack(plan.geo, plan.tliMs - 120_000)!
    const b = sampleTrack(plan.geo, plan.tliMs)!
    expect(Math.abs(dot(unit(cross(a, b)), unit(padNow)))).toBeLessThan(1e-3)
    const end = plan.geo.p[plan.geo.p.length - 1]
    const start = add(ephem.moonPos(plan.handoverMs), plan.seleno.p[0])
    expect(norm(sub(end, start))).toBeLessThan(1)
    // no jump larger than the local step anywhere on either track
    for (const tr of [plan.geo, plan.seleno]) {
      for (let i = 1; i < tr.p.length; i++) {
        const dtS = (tr.t[i] - tr.t[i - 1]) / 1000
        expect(norm(sub(tr.p[i], tr.p[i - 1]))).toBeLessThan(11.5 * dtS + 1) // below 11.5 km/s everywhere
      }
    }
  })

  it('the flight arrives tangent to the lunar orbit: no corner where the Moon-centred track takes over', () => {
    // Direction of the last integrated step relative to the Moon against the first step of the lunar orbit.
    const n = plan.geo.p.length
    const before = unit(sub(sub(plan.geo.p[n - 1], ephem.moonPos(plan.geo.t[n - 1])), sub(plan.geo.p[n - 2], ephem.moonPos(plan.geo.t[n - 2]))))
    const after = unit(sub(plan.seleno.p[1], plan.seleno.p[0]))
    expect(Math.acos(Math.min(1, dot(before, after))) / DEG).toBeLessThan(4)
  })

  it('touchdown is on the landing site and the lunar orbit passes over it', () => {
    const last = plan.seleno.p[plan.seleno.p.length - 1]
    expect(Math.abs(norm(last) - R_MOON)).toBeLessThan(0.01)
    expect(Math.abs(norm(sampleTrack(plan.seleno, plan.loiMs)!) - (R_MOON + 100))).toBeLessThan(0.5)
    expect(plan.lunarInclDeg).toBeGreaterThan(89)
    expect(plan.lunarInclDeg).toBeLessThan(91)
  })

  it('an independent RK4 integration of the planned injection reaches the planned perilune', () => {
    const third = (r: Vec3, body: Vec3, mu: number) => {
      const d = sub(r, body)
      return add(scale(d, -mu / norm(d) ** 3), scale(body, -mu / norm(body) ** 3))
    }
    const acc: Accel = (r, tS) => {
      const t = plan.tliMs + tS * 1000
      return add(scale(r, -MU_EARTH / norm(r) ** 3), add(third(r, ephem.moonPos(t), MU_MOON), third(r, ephem.sunPos(t), MU_SUN)))
    }
    let s: State = { r: plan.injection.r, v: plan.injection.v }
    let closest = Infinity
    let tClosest = 0
    let atClosest: State = s
    const total = (plan.loiMs - plan.tliMs) / 1000 + 3600
    // 5 s steps near Earth and near the Moon, 30 s in between
    for (let t = 0; t < total; ) {
      const step = t < 6 * 3600 || t > total - 9 * 3600 ? 5 : 30
      s = rk4(s, t, step, acc)
      t += step
      const d = norm(sub(s.r, ephem.moonPos(plan.tliMs + t * 1000)))
      if (d < closest) {
        closest = d
        tClosest = t
        atClosest = s
      }
    }
    const lateS = tClosest - (plan.loiMs - plan.tliMs) / 1000
    const tMs = plan.tliMs + tClosest * 1000
    const rRel = sub(atClosest.r, ephem.moonPos(tMs))
    const vRel = sub(atClosest.v, ephem.moonVel(tMs))
    const siteHat = qrot(ephem.moonFixedToInertial(landingMs), latLonUnit(target.latDeg, target.lonDeg))
    const offPlaneDeg = Math.asin(Math.abs(dot(unit(cross(rRel, vRel)), siteHat))) / DEG
    const loi = norm(vRel) - Math.sqrt(MU_MOON / norm(rRel))
    console.log(
      `[flight check] independent RK4: perilune ${closest.toFixed(1)} km from the Moon's centre (planned ${R_MOON + 100}), ` +
        `${lateS.toFixed(0)} s after the planned LOI, landing site ${offPlaneDeg.toFixed(3)}° off the orbit plane, ` +
        `LOI ${loi.toFixed(4)} km/s (planned ${dv('loi').toFixed(4)}). Plan: TLI ${dv('tli').toFixed(3)}, ascent ${dv('ascent').toFixed(3)} km/s, ` +
        `incl ${plan.parkingInclDeg.toFixed(2)}°, az ${plan.launchAzimuthDeg.toFixed(2)}°, decl ${plan.moonDeclDeg.toFixed(2)}°, ` +
        `transfer ${plan.transferDays.toFixed(3)} d, vInf ${plan.vInfKms.toFixed(3)}, loiter ${plan.loiterH.toFixed(1)} h, ` +
        `revs ${plan.lunarRevs}, landed ${(plan.landedMassKg / 1000).toFixed(2)} t, dist ${plan.moonDistKm.toFixed(0)} km, ` +
        `geo points ${plan.geo.t.length}`,
    )
    // The two integrators differ in method, step control and how they read the ephemeris (cubic table against
    // the files' linear interpolation), so a few kilometres and seconds are the expected agreement.
    expect(Math.abs(closest - (R_MOON + 100))).toBeLessThan(15)
    expect(Math.abs(lateS)).toBeLessThan(60)
    expect(offPlaneDeg).toBeLessThan(0.3)
    expect(Math.abs(loi - dv('loi'))).toBeLessThan(0.005)
  })
})
