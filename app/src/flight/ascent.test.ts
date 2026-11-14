// The launch-to-orbit simulator against flown missions (Apollo 11, Artemis I), against its own conservation
// laws, and on vehicles and launch geometries it was not tuned for.
import { describe, expect, it } from 'vitest'
import { AscentError, dragCoefficient, earthJ2Field, simulateAscent, standardAtmosphere } from './ascent'
import type { AscentResult, AscentVehicle } from './ascent'
import { MU_EARTH, OMEGA_EARTH, R_EARTH_EQ } from './astro'
import type { LaunchVehicleSpec } from './hardware'
import { LAUNCH_VEHICLES, launchVehicle } from './launchVehicles'
import { LAUNCHPADS } from './pads'
import { J2_EARTH, integrate } from './sim'
import type { Vec3 } from './types'
import { DEG, cross, dot, norm, unit } from './vec'

const POLE: Vec3 = [0, 0, 1]

/** Pad direction and target plane normal for a launch from latitude latDeg on azimuth azDeg (0 = north, 90 =
 *  east). The pad's longitude does not matter to the ascent; it is put on the x-z plane. */
function launchGeometry(latDeg: number, azDeg: number): { pad: Vec3; normal: Vec3 } {
  const la = latDeg * DEG
  const az = azDeg * DEG
  const pad: Vec3 = [Math.cos(la), 0, Math.sin(la)]
  const north: Vec3 = [-Math.sin(la), 0, Math.cos(la)]
  const east: Vec3 = [0, 1, 0]
  const heading: Vec3 = [
    Math.cos(az) * north[0] + Math.sin(az) * east[0],
    Math.cos(az) * north[1] + Math.sin(az) * east[1],
    Math.cos(az) * north[2] + Math.sin(az) * east[2],
  ]
  return { pad, normal: unit(cross(pad, heading)) }
}

const eventTime = (res: AscentResult, id: string): number => {
  const e = res.events.find((ev) => ev.id === id)
  if (!e) throw new Error(`no event ${id}: ${res.events.map((ev) => ev.id).join(', ')}`)
  return e.tS
}
const labels = (res: AscentResult) => res.events.map((e) => e.label)

/** Checks that hold for every ascent: the target is met, the path is continuous, the budget closes. */
function expectSoundAscent(res: AscentResult, perigeeKm: number, apogeeKm: number) {
  expect(Math.abs(res.insertion.perigeeKm - perigeeKm)).toBeLessThan(1)
  expect(Math.abs(res.insertion.apogeeKm - apogeeKm)).toBeLessThan(1)
  expect(res.insertion.planeErrorDeg).toBeLessThan(0.01)
  // samples: time strictly increasing, mass never increasing, position continuous
  for (let i = 1; i < res.t.length; i++) {
    expect(res.t[i]).toBeGreaterThan(res.t[i - 1])
    expect(res.m[i]).toBeLessThanOrEqual(res.m[i - 1] + 1e-6)
    const dr = norm([res.r[i][0] - res.r[i - 1][0], res.r[i][1] - res.r[i - 1][1], res.r[i][2] - res.r[i - 1][2]])
    expect(dr).toBeLessThan(10 * (res.t[i] - res.t[i - 1]) + 1e-6) // slower than 10 km/s
  }
  expect(res.t[res.t.length - 1]).toBeCloseTo(res.insertion.tS, 6)
  expect(res.thrusting[0]).toBe(true)
  // ideal Δv − losses + rotation gain = inertial speed at insertion
  const b = res.budget
  const sum = b.idealDvKms - b.gravityLossKms - b.dragLossKms - b.steeringLossKms + b.earthRotationGainKms
  expect(Math.abs(sum / norm(res.insertion.v) - 1)).toBeLessThan(2e-3)
}

describe('standard atmosphere and drag curve', () => {
  it('reproduces the U.S. Standard Atmosphere 1976', () => {
    const air = { rho: 0, p: 0, a: 0 }
    // sea level: 101 325 Pa, 288.15 K → 1.2250 kg/m³, 340.3 m/s (https://www.pdas.com/atmosTable2SI.html, row 0.0 km)
    standardAtmosphere(0, air)
    expect(air.p).toBeCloseTo(101325, 6)
    expect(air.rho).toBeCloseTo(1.225, 3)
    expect(air.a).toBeCloseTo(340.3, 1)
    // base of the stratosphere at 11 km geopotential: 22 632.1 Pa (layer table of the 1976 standard)
    standardAtmosphere((6356.766 * 11) / (6356.766 - 11), air)
    expect(air.p / 22632.1).toBeCloseTo(1, 5)
    // tabulated values above the layer model (https://www.pdas.com/bigtables.html, Table 1): 100 km and 150 km
    standardAtmosphere(100, air)
    expect(air.rho / 5.6044e-7).toBeCloseTo(1, 6)
    standardAtmosphere(150, air)
    expect(air.rho / 2.0752e-9).toBeCloseTo(1, 6)
    // the layer model and the tabulated tail meet at 86 km, and the table's own 85 km value fits the layers
    const below = { rho: 0, p: 0, a: 0 }
    standardAtmosphere(86 - 1e-9, below)
    standardAtmosphere(86, air)
    expect(air.rho / below.rho).toBeCloseTo(1, 6)
    standardAtmosphere(85, air)
    expect(air.rho / 8.2195e-6).toBeCloseTo(1, 2)
    // density falls monotonically all the way up
    let last = Infinity
    for (let z = 0; z <= 600; z += 0.5) {
      standardAtmosphere(z, air)
      expect(air.rho).toBeLessThan(last)
      last = air.rho
    }
  })

  it('has a smooth drag curve with its peak just above Mach 1', () => {
    let peak = 0
    let peakMach = 0
    for (let m = 0; m <= 10; m += 0.01) {
      const cd = dragCoefficient(m)
      expect(cd).toBeGreaterThan(0.2)
      expect(Math.abs(dragCoefficient(m + 0.01) - cd)).toBeLessThan(0.02)
      if (cd > peak) {
        peak = cd
        peakMach = m
      }
    }
    expect(peakMach).toBeGreaterThan(1)
    expect(peakMach).toBeLessThan(1.5)
  })
})

describe('conservation', () => {
  it('conserves energy and polar angular momentum when thrust and drag are off', () => {
    // a suborbital arc such as a spent stage flies: 60 km up, 2.7 km/s, climbing at 20°, inclined to the equator
    const pole = unit([0.1, -0.2, 1])
    const r0: Vec3 = [R_EARTH_EQ + 60, 0, 0]
    const v0: Vec3 = [2.7 * Math.sin(20 * DEG), 2.7 * Math.cos(20 * DEG) * Math.cos(32 * DEG), 2.7 * Math.cos(20 * DEG) * Math.sin(32 * DEG)]
    // potential of the field: −μ/r · [1 − J2 (R/r)² (3 sin²φ − 1)/2], φ the latitude above the pole's equator
    const energy = (r: Vec3, v: Vec3) => {
      const rm = norm(r)
      const s = dot(r, pole) / rm
      return 0.5 * dot(v, v) - (MU_EARTH / rm) * (1 - (J2_EARTH * (R_EARTH_EQ / rm) ** 2 * (3 * s * s - 1)) / 2)
    }
    const run = integrate(earthJ2Field(pole), { r: r0, v: v0, m: 1000 }, 0, { maxSeconds: 400, maxStepS: 5 })
    expect(Math.abs(energy(run.end.r, run.end.v) / energy(r0, v0) - 1)).toBeLessThan(1e-9)
    expect(dot(cross(run.end.r, run.end.v), pole) / dot(cross(r0, v0), pole)).toBeCloseTo(1, 9)
    expect(run.end.m).toBe(1000)
    // and the J2 term is really there: without it the energy defined above would drift
    const twoBody = (r: Vec3, v: Vec3) => 0.5 * dot(v, v) - MU_EARTH / norm(r)
    expect(Math.abs(twoBody(run.end.r, run.end.v) - twoBody(r0, v0))).toBeGreaterThan(1e-4)
  })
})

describe('Saturn V: Apollo 11', () => {
  // Apollo 11 as flown. Launch Complex 39A geodetic latitude 28.608422° N; flight azimuth 72.058° ("the vehicle
  // rolled from a launch pad azimuth of 90° to a flight azimuth of 72.058°"): NASA SP-2000-4029, Apollo by the
  // Numbers, https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_18-01_General_Background.htm
  // and .../Apollo_11a_Summary.htm. (The brief's "due east" would add 1.1 t in orbit; the flown azimuth is used
  // so that the comparison is like for like.)
  // Parking orbit: apogee 186.0 km, perigee 183.2 km above a sphere of 6378.165 km (flight evaluation report,
  // Table 4-5): a 185 km circle above the equatorial radius.
  // Payload: spacecraft 109,646 lbm less the Launch Escape System 8,910 lbm = 45,693 kg (Apollo by the Numbers,
  // .../Apollo_18-19_Ground_Ignition_Weights.htm).
  const geo = launchGeometry(28.608422, 72.058)
  const res = simulateAscent({
    vehicle: launchVehicle('saturn-v')!,
    payloadKg: 45693,
    padEci: geo.pad,
    pole: POLE,
    target: { planeNormal: geo.normal, perigeeKm: 185, apogeeKm: 185 },
  })
  // Documented, Saturn V Launch Vehicle Flight Evaluation Report AS-506 (MPR-SAT-FE-69-9),
  // https://archive.org/stream/nasa_techdoc_19900066485/19900066485_djvu.txt. Range time; the simulation starts
  // at first motion, range time 0.3 s (Table 2-2: "All Holddown Arms Released (First Motion) 0.3").
  const FIRST_MOTION = 0.3
  const DOC = {
    sicCutoffS: 161.63, // Table 2-2: "S-IC Outboard Engine Cutoff (OECO) 161.63"
    siiCutoffS: 548.22, // Table 2-2: "S-II Outboard Engine Cutoff (OECO) 548.22"
    sivbCutoffS: 699.34, // Table 2-2: "S-IVB Velocity Cutoff Command (First Guidance Cutoff) 699.34"
    massInOrbitKg: 135182, // Table 20-9: third flight stage at first S-IVB cut-off, 135,182 kg (298,026 lbm)
    mach1S: 66.3, // Table 4-1: "Mach 1 66.3 s"
    maxQS: 83.0, // Table 4-1: maximum dynamic pressure 83.0 s, 3.52 N/cm² (735.2 lbf/ft²), altitude 13.6 km
    maxQPa: 35200,
    maxG: 3.94, // Table 4-1: maximum total inertial acceleration, S-IC, 38.61 m/s² (3.94 g)
    sicCutoffAltKm: 66.1, // Table 4-2, S-IC OECO: altitude 66.1 km, space-fixed velocity 2,764.1 m/s
    sicCutoffSpeedKms: 2.7641,
  }

  it('reaches the parking orbit with a sound path and budget', () => {
    expectSoundAscent(res, 185, 185)
    expect(res.insertionStage).toBe(2)
    const b = res.budget
    expect(b.gravityLossKms).toBeGreaterThan(1.2)
    expect(b.gravityLossKms).toBeLessThan(1.9)
    expect(b.dragLossKms).toBeGreaterThan(0.02)
    expect(b.dragLossKms).toBeLessThan(0.08)
    expect(b.earthRotationGainKms).toBeGreaterThan(0.38)
    expect(b.earthRotationGainKms).toBeLessThan(OMEGA_EARTH * R_EARTH_EQ)
  })

  it('names the events as NASA does, in flight order', () => {
    const l = labels(res)
    const order = [
      'Liftoff',
      'Mach 1',
      'Max Q',
      'S-IC centre engine cut-off (CECO)',
      'S-IC outboard engine cut-off (OECO)',
      'S-IC / S-II separation',
      'S-II ignition',
      'S-II aft interstage jettison',
      'Launch Escape System jettison',
      'S-II centre engine cut-off (CECO)',
      'S-II outboard engine cut-off (OECO)',
      'S-II / S-IVB separation',
      'S-IVB ignition',
      'S-IVB first cut-off',
      'Orbit insertion',
    ]
    let at = -1
    for (const name of order) {
      const i = l.indexOf(name)
      expect(i, name).toBeGreaterThan(at)
      at = i
    }
  })

  it('matches the flown event times (brief: within 10%; held here to 3%)', () => {
    const sic = eventTime(res, 'cutoff-s-ic') + FIRST_MOTION
    const sii = eventTime(res, 'cutoff-s-ii') + FIRST_MOTION
    const sivb = res.insertion.tS + FIRST_MOTION
    expect(Math.abs(sic / DOC.sicCutoffS - 1)).toBeLessThan(0.03)
    expect(Math.abs(sii / DOC.siiCutoffS - 1)).toBeLessThan(0.03)
    expect(Math.abs(sivb / DOC.sivbCutoffS - 1)).toBeLessThan(0.03)
    expect(Math.abs((eventTime(res, 'mach-1') + FIRST_MOTION) / DOC.mach1S - 1)).toBeLessThan(0.05)
    expect(Math.abs((res.maxQ.tS + FIRST_MOTION) / DOC.maxQS - 1)).toBeLessThan(0.1)
    expect(Math.abs(res.maxQ.pa / DOC.maxQPa - 1)).toBeLessThan(0.1)
    expect(Math.abs(res.maxAxialG / DOC.maxG - 1)).toBeLessThan(0.03)
  })

  it('matches the flown mass in orbit (brief: within 5%; held here to 2%)', () => {
    expect(Math.abs(res.insertion.massKg / DOC.massInOrbitKg - 1)).toBeLessThan(0.02)
    // what is left for the trans-lunar injection: Apollo 11 burnt 70,684 kg in the second S-IVB burn (Table 20-9)
    expect(res.upperStagePropellantKg).toBeGreaterThan(0.95 * 70684)
    expect(res.upperStagePropellantKg).toBeLessThan(1.05 * 70684)
    // stage, instrument unit and spacecraft add up to the mass in orbit
    expect(res.upperStageDryKg + res.upperStagePropellantKg + 45693).toBeCloseTo(res.insertion.massKg, 3)
  })

  it('flies the first stage along the flown path', () => {
    // state at S-IC cut-off: the simulated one comes 2 s early (the F-1's flow rises in flight, the model's does
    // not), so altitude and speed are compared loosely
    const t = eventTime(res, 'cutoff-s-ic')
    const i = res.t.findIndex((ts) => ts >= t - 1e-6)
    expect(Math.abs((norm(res.r[i]) - R_EARTH_EQ) / DOC.sicCutoffAltKm - 1)).toBeLessThan(0.15)
    expect(Math.abs(norm(res.v[i]) / DOC.sicCutoffSpeedKms - 1)).toBeLessThan(0.03)
  })
})

describe('SLS Block 1: Artemis I', () => {
  // Insertion orbit: "places the ICPS/Orion stack into a 16 × 975 nmi orbit (30 x 1806 km)" (Batcha et al., Artemis I
  // Trajectory Design and Optimization, AAS 20-649, https://ntrs.nasa.gov/citations/20205005150); flown: "972.6
  // nautical miles (1,801 km) by 15.9 nautical miles (29.4 km)" (Askins, JANNAF 2024, NTRS 20240003963).
  // Pad: LC-39B (pads.ts). Inclination 30.5°: J. McDowell, https://planet4589.org/space/misc/artemis1.txt ("30 x 1808
  // km x 30.5 deg"); NASA publishes neither the flown azimuth nor the inclination. cos i = cos(lat) · sin(azimuth).
  // Payload: Orion crew module 9,350 kg + service module 14,000 kg + spacecraft adapter 450 kg (NASA, Artemis I
  // Reference Guide, Orion quick facts); the Launch Abort System and the fairing panels are in the vehicle's jettisons.
  const pad = LAUNCHPADS.find((p) => p.id === 'ksc-39b')!
  const azDeg = Math.asin(Math.cos(30.5 * DEG) / Math.cos(pad.latDeg * DEG)) / DEG
  const geo = launchGeometry(pad.latDeg, azDeg)
  const vehicle = launchVehicle('sls-block-1')!
  const res = simulateAscent({
    vehicle,
    payloadKg: 9350 + 14000 + 450,
    padEci: geo.pad,
    pole: POLE,
    target: { planeNormal: geo.normal, perigeeKm: 30, apogeeKm: 1806 },
  })
  const DOC = {
    boosterSeparationS: 130.818, // Lee et al., NTRS 20230017676: "the best current estimate is 130.818 s MET" (planned 00:02:12)
    mecoS: 481, // JANNAF 2024: "Main engine cutoff occurred 8 minutes, 1 second into the mission" (planned: "At T + 483 seconds, MECO")
    throttleForGS: 421, // SLS Reference Guide: "At T + 421 seconds engines throttle back as needed to reduce acceleration forces"
    maxG: 3.25, // SciTech 2024: "topped off at approximately 3.25 G"
    mecoSpeedKms: 7.79674, // JANNAF 2024: "The vehicle was traveling at 25,579.86 ft./sec. (7,796.74 m/sec.)" at MECO
    mecoAltKm: 161.7, // JANNAF 2024: "inserted into that orbit at an altitude of 87.3 nautical miles (161.7 km)"
    maxQPa: 661 * 47.880259, // JANNAF 2024: "Maximum dynamic pressure on the vehicle was 661 pounds-per-square-foot"
    maxQS: 71, // JANNAF 2024: "1 minute, 11 seconds into flight"
  }

  it('inserts on the core stage into the documented elliptical orbit, the ICPS untouched', () => {
    expectSoundAscent(res, 30, 1806)
    expect(res.insertionStage).toBe(0)
    expect(res.upperStagePropellantKg).toBe(vehicle.stages[1].propellantKg)
    expect(res.upperStageDryKg).toBeCloseTo(vehicle.stages[1].dryKg + vehicle.upperStageExtrasKg, 6)
    const l = labels(res)
    for (const name of ['Liftoff', 'Max Q', 'Solid Rocket Booster separation', 'Launch Abort System jettison', 'Main Engine Cutoff (MECO)', 'Orbit insertion']) {
      expect(l, name).toContain(name)
    }
    expect(l).not.toContain('Interim Cryogenic Propulsion Stage (ICPS) ignition')
    // the core stage is cut off by guidance with a small reserve, not run dry: mass at MECO less everything
    // that is not core stage propellant
    const core = vehicle.stages[0]
    const reserve = res.insertion.massKg - core.dryKg - res.upperStageDryKg - res.upperStagePropellantKg - 23800
    expect(reserve).toBeGreaterThan(0)
    expect(reserve / core.propellantKg).toBeLessThan(0.04)
  })

  it('matches booster separation and MECO of Artemis I (brief: within 10%; MECO held here to 2%)', () => {
    expect(eventTime(res, 'booster-separation')).toBeCloseTo(DOC.boosterSeparationS, 3)
    expect(Math.abs(res.insertion.tS / DOC.mecoS - 1)).toBeLessThan(0.02)
    expect(eventTime(res, 'cutoff-core-stage')).toBeCloseTo(res.insertion.tS, 9)
    expect(Math.abs(eventTime(res, 'acceleration-limit') / DOC.throttleForGS - 1)).toBeLessThan(0.03)
    expect(res.maxAxialG).toBeLessThan(DOC.maxG * 1.01)
    expect(res.maxAxialG).toBeGreaterThan(DOC.maxG * 0.99)
  })

  it('arrives with the flown speed', () => {
    // The flown MECO was at 161.7 km; the simulation inserts lower on the same orbit (the lowest point its
    // heating rule allows). Compare at the flown altitude: speed on the simulated orbit there (vis-viva), less
    // what the Earth's rotation contributes; the documented 7,796.74 m/s is Earth-relative.
    const i = res.insertion
    const sma = R_EARTH_EQ + (i.perigeeKm + i.apogeeKm) / 2
    const inertial = Math.sqrt(MU_EARTH * (2 / (R_EARTH_EQ + DOC.mecoAltKm) - 1 / sma))
    expect(Math.abs((inertial - res.budget.earthRotationGainKms) / DOC.mecoSpeedKms - 1)).toBeLessThan(0.005)
    expect(norm(i.r) - R_EARTH_EQ).toBeGreaterThan(120)
    expect(norm(i.r) - R_EARTH_EQ).toBeLessThan(DOC.mecoAltKm + 5)
  })

  it('passes max Q near the flown one (loosely: the booster thrust curve is a reconstruction)', () => {
    expect(Math.abs(res.maxQ.pa / DOC.maxQPa - 1)).toBeLessThan(0.25)
    expect(Math.abs(res.maxQ.tS / DOC.maxQS - 1)).toBeLessThan(0.2)
  })
})

describe('other planes and pads', () => {
  // Saturn V with the Apollo 11 spacecraft; SLS Block 1B with Orion (23,800 kg) and 10 t of co-manifested payload
  // (NASA Block 1B fact sheet: "10-t (22,046-lb.)" co-manifested)
  const cases: [string, number][] = [
    ['saturn-v', 45693],
    ['sls-block-1b', 33800],
  ]
  for (const [id, payloadKg] of cases) {
    it(`${id}: converges for azimuths 72° to 108° from latitudes 5°, 28.6° and 46°`, () => {
      const mass: Record<string, number> = {}
      for (const lat of [5, 28.6, 46]) {
        for (const az of [72, 90, 108]) {
          const geo = launchGeometry(lat, az)
          const res = simulateAscent({
            vehicle: launchVehicle(id)!,
            payloadKg,
            padEci: geo.pad,
            pole: POLE,
            target: { planeNormal: geo.normal, perigeeKm: 185, apogeeKm: 185 },
          })
          expectSoundAscent(res, 185, 185)
          expect(res.insertionStage).toBeGreaterThan(0) // neither vehicle reaches orbit on its first stage
          // the orbit's inclination is the plane's: cos i = cos(lat) · sin(azimuth)
          const h = unit(cross(res.insertion.r, res.insertion.v))
          expect(Math.acos(h[2]) / DEG).toBeCloseTo(Math.acos(Math.cos(lat * DEG) * Math.sin(az * DEG)) / DEG, 2)
          // downrange angle: the insertion point lies that far along the plane from the pad
          expect(dot(unit(res.insertion.r), geo.pad)).toBeCloseTo(Math.cos(res.downrangeAngleRad), 6)
          mass[`${lat}/${az}`] = res.insertion.massKg
        }
      }
      // Earth's rotation helps most due east and near the equator, and equally 18° north or south of east
      for (const lat of [5, 28.6, 46]) {
        expect(mass[`${lat}/90`]).toBeGreaterThan(mass[`${lat}/72`])
        expect(mass[`${lat}/90`]).toBeGreaterThan(mass[`${lat}/108`])
        expect(Math.abs(mass[`${lat}/72`] / mass[`${lat}/108`] - 1)).toBeLessThan(0.005)
      }
      expect(mass['5/90']).toBeGreaterThan(mass['28.6/90'])
      expect(mass['28.6/90']).toBeGreaterThan(mass['46/90'])
    }, 60_000)
  }
})

describe('vehicles described only by data', () => {
  const made = [{ label: 'made up for this test', url: 'about:blank' }]
  // three stages, no ascent profile, nothing like a preset
  const threeStage: LaunchVehicleSpec = {
    id: 'test-three-stage',
    name: 'Three-stage test vehicle',
    boosters: null,
    stages: [
      {
        id: 'first',
        name: 'First',
        dryKg: 22000,
        propellantKg: 300000,
        engine: { name: 'A', count: 6, thrustVacN: 900000, thrustSlN: 800000, ispVacS: 310, ispSlS: 275, throttleMin: 1 },
        diameterM: 4,
        lengthM: 30,
        sources: made,
      },
      {
        id: 'second',
        name: 'Second',
        dryKg: 6000,
        propellantKg: 70000,
        engine: { name: 'B', count: 1, thrustVacN: 900000, thrustSlN: null, ispVacS: 345, ispSlS: null, throttleMin: 1 },
        diameterM: 4,
        lengthM: 12,
        sources: made,
      },
      {
        id: 'third',
        name: 'Third',
        dryKg: 2500,
        propellantKg: 18000,
        engine: { name: 'C', count: 1, thrustVacN: 100000, thrustSlN: null, ispVacS: 450, ispSlS: null, throttleMin: 1 },
        diameterM: 3,
        lengthM: 8,
        sources: made,
      },
    ],
    jettisons: [{ name: 'Payload fairing', massKg: 1500, afterStage: 1, delayS: 20, sources: made }],
    upperStageExtrasKg: 300,
    note: '',
    sources: made,
  }

  it('a made-up three-stage vehicle reaches a 300 km orbit from 46° N', () => {
    const geo = launchGeometry(46, 100)
    const res = simulateAscent({
      vehicle: threeStage,
      payloadKg: 8000,
      padEci: geo.pad,
      pole: POLE,
      target: { planeNormal: geo.normal, perigeeKm: 300, apogeeKm: 300 },
    })
    expectSoundAscent(res, 300, 300)
    expect(res.insertionStage).toBe(2)
    const l = labels(res)
    expect(l).toContain('First / Second separation')
    expect(l).toContain('Second / Third separation')
    expect(l).toContain('Payload fairing jettison')
    expect(l).toContain('Third cut-off')
    // every stage below the last is run dry: the mass in orbit is the last stage, extras, payload and what is left
    expect(res.insertion.massKg).toBeCloseTo(2500 + 300 + 8000 + res.upperStagePropellantKg, 3)
    expect(res.upperStagePropellantKg).toBeGreaterThan(0)
    expect(res.upperStagePropellantKg).toBeLessThan(18000)
    // a lighter payload leaves more propellant in the last stage
    const light = simulateAscent({
      vehicle: threeStage,
      payloadKg: 4000,
      padEci: geo.pad,
      pole: POLE,
      target: { planeNormal: geo.normal, perigeeKm: 300, apogeeKm: 300 },
    })
    expect(light.upperStagePropellantKg).toBeGreaterThan(res.upperStagePropellantKg + 2000)
  })

  it('a made-up vehicle with strap-on boosters and a throttled, acceleration-limited core reaches an elliptical orbit', () => {
    const boosted: AscentVehicle = {
      id: 'test-boosted',
      name: 'Boosted test vehicle',
      boosters: {
        id: 'strap-on',
        name: 'Strap-on booster',
        count: 4,
        dryKg: 4000,
        propellantKg: 40000,
        engine: { name: 'S', count: 1, thrustVacN: 1.1e6, thrustSlN: 1.0e6, ispVacS: 280, ispSlS: 250, throttleMin: 1 },
        burnTimeS: 95,
        diameterM: 2,
        lengthM: 15,
        sources: made,
      },
      stages: [
        {
          id: 'core',
          name: 'Core',
          dryKg: 14000,
          propellantKg: 170000,
          engine: { name: 'K', count: 2, thrustVacN: 1.0e6, thrustSlN: 0.8e6, ispVacS: 430, ispSlS: 350, throttleMin: 0.5 },
          diameterM: 5,
          lengthM: 30,
          sources: made,
        },
        {
          id: 'upper',
          name: 'Upper',
          dryKg: 4000,
          propellantKg: 28000,
          engine: { name: 'U', count: 1, thrustVacN: 180000, thrustSlN: null, ispVacS: 455, ispSlS: null, throttleMin: 1 },
          diameterM: 5,
          lengthM: 10,
          sources: made,
        },
      ],
      jettisons: [{ name: 'Payload fairing', massKg: 2500, afterStage: 0, delayS: 200, sources: made }],
      upperStageExtrasKg: 0,
      note: '',
      sources: made,
      ascent: { maxAxialG: 4, separationCoastS: [8], sources: made },
    }
    const geo = launchGeometry(5, 90)
    const res = simulateAscent({
      vehicle: boosted,
      payloadKg: 15000,
      padEci: geo.pad,
      pole: POLE,
      target: { planeNormal: geo.normal, perigeeKm: 200, apogeeKm: 800 },
    })
    expectSoundAscent(res, 200, 800)
    // boosters burn their propellant in burnTimeS and are dropped then
    expect(eventTime(res, 'booster-separation')).toBeCloseTo(95, 6)
    const i = res.t.findIndex((ts) => ts >= 95 - 1e-6)
    expect(res.m[i - 1] - res.m[i]).toBeGreaterThan(4 * 4000) // the four empty boosters leave within one step
    expect(res.maxAxialG).toBeLessThanOrEqual(4 * 1.001)
    if (res.insertionStage === 1) {
      // the coast between the stages: 8 s without thrust
      const cut = eventTime(res, 'cutoff-core')
      expect(eventTime(res, 'ignition-upper') - cut).toBeCloseTo(8, 6)
      const k = res.t.findIndex((ts) => ts >= cut + 1)
      expect(res.thrusting[k]).toBe(false)
    }
  })
})

describe('what cannot fly', () => {
  const geo = launchGeometry(28.6, 90)
  const input = (payloadKg: number) => ({
    vehicle: LAUNCH_VEHICLES.find((v) => v.id === 'saturn-v')!,
    payloadKg,
    padEci: geo.pad,
    pole: POLE,
    target: { planeNormal: geo.normal, perigeeKm: 185, apogeeKm: 185 },
  })

  it('a payload far too heavy for orbit throws AscentError', () => {
    // four times what a Saturn V carries: it lifts off (thrust 34 MN, weight 32 MN) but cannot reach orbit
    expect(() => simulateAscent(input(400000))).toThrow(AscentError)
    expect(() => simulateAscent(input(400000))).toThrow(/cannot reach 185 × 185 km/)
  }, 30_000)

  it('a payload too heavy to lift off throws AscentError at once', () => {
    expect(() => simulateAscent(input(900000))).toThrow(/cannot lift off/)
  })
})
