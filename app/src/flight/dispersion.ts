// Monte Carlo dispersion of the descent: the planned descent (lunar.ts, planDescent) flown again N times
// (default 200) with random errors in burn magnitude, burn direction, launch time and specific impulse, under
// the Moon-centred field with the Moon's J2 switched on (sim.ts, J2_MOON). Output: the 1σ / 3σ envelope ("tube")
// around the descent path, the landing dispersion on the surface (km) and the spread of the propellant used.
//
// Validated by the science lead: statement of 15 Nov 2026 (docs/event/validation.md, "Validation status 15 Nov"),
// no per-check record. Every result carries the marker text; `validated` stays false (no per-check written sign-off).
//
// What is flown (lunar.ts, replayDescent): Descent Orbit Insertion and the braking burn open loop, with their
// commanded lengths and steering laws; they do not re-aim. The braking burn is cut off early if it comes down to
// the gate height (100 m; higher when it sinks too fast to stop from there) before its commanded end. The
// vertical terminal descent closes its own loop on the point below where the braking burn ended. So this is the dispersion of an UNGUIDED descent: a real powered
// descent guidance re-aims the braking burn all the way down and lands far closer to its target. The numbers say
// how much the commanded flight depends on its errors, not how precisely a guided lander lands.
//
// Errors, one draw per run, Gaussian, each σ below (DISPERSION_SIGMAS): engine thrust and specific impulse (one
// factor each for both burns: the same engine), pointing of the DOI and of the braking burn (a rotation vector
// per burn, σ per axis), launch time. A launch that slips by Δt flies the same trajectory Δt later (the transfer
// takes up a slip within the window); the Moon has turned on by ω Δt under it, so the landing point moves on the
// surface while the path in space stays. The path's tube therefore shows the burn errors and J2; the landing
// ellipse shows all four.
//
// Random numbers: mulberry32 seeded by an integer, normal deviates by Box–Muller, drawn in a fixed order per run
// (thrust, Isp, DOI pointing x y z, braking pointing x y z, launch) so a seed fixes every statistic exactly.
import { LunarOpsError, NO_PERTURBATION, replayDescent } from './lunar'
import type { DescentInput, DescentPerturbation, DescentResult, ReplayResult } from './lunar'
import { moonField } from './sim'
import type { Field } from './sim'
import type { FlightEphemeris, Vec3 } from './types'
import { add, cross, DEG, dot, norm, scale, sub, unit } from './vec'

/** Machine-readable marker carried by every output of this file (Trap 2 of the build brief). */
export const NOT_VALIDATED = 'validated by the science lead (statement of 15 Nov 2026; see record)'

/** 1σ of each error. */
export interface DispersionSigmas {
  thrustFrac: number // engine thrust, fraction of nominal
  ispFrac: number // specific impulse, fraction of nominal
  pointingRad: number // burn direction, per axis, rad
  launchS: number // launch time, s
}

/** Where each σ comes from: every one is an ASSUMPTION of this file; no published dispersion of the modelled
 *  landers' engines was found. They are round numbers of the size commonly used in early mission studies and
 *  are meant to be replaced by sourced values. */
export const DISPERSION_SIGMAS: Record<keyof DispersionSigmas, { value: number; unit: string; basis: 'assumption'; note: string }> = {
  thrustFrac: { value: 1 / 300, unit: 'fraction', basis: 'assumption', note: 'ASSUMPTION: thrust within ±1 % at 3σ' },
  ispFrac: { value: 1 / 300, unit: 'fraction', basis: 'assumption', note: 'ASSUMPTION: specific impulse within ±1 % at 3σ' },
  pointingRad: { value: 0.05 * DEG, unit: 'rad', basis: 'assumption', note: 'ASSUMPTION: thrust direction within 0.15° per axis at 3σ' },
  launchS: { value: 1, unit: 's', basis: 'assumption', note: 'ASSUMPTION: liftoff within 3 s of the planned instant at 3σ' },
}

export const DEFAULT_SIGMAS: DispersionSigmas = {
  thrustFrac: DISPERSION_SIGMAS.thrustFrac.value,
  ispFrac: DISPERSION_SIGMAS.ispFrac.value,
  pointingRad: DISPERSION_SIGMAS.pointingRad.value,
  launchS: DISPERSION_SIGMAS.launchS.value,
}

export const ZERO_SIGMAS: DispersionSigmas = { thrustFrac: 0, ispFrac: 0, pointingRad: 0, launchS: 0 }

// ---------------------------------------------------------------------------------------------------------
// Random numbers
// ---------------------------------------------------------------------------------------------------------

/** mulberry32: a 32-bit seeded generator, uniform in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Standard normal deviates (Box–Muller, both values of each pair used). */
export function gaussian(seed: number): () => number {
  const u = mulberry32(seed)
  let spare: number | null = null
  return () => {
    if (spare !== null) {
      const s = spare
      spare = null
      return s
    }
    let u1 = u()
    while (u1 <= 0) u1 = u()
    const u2 = u()
    const r = Math.sqrt(-2 * Math.log(u1))
    spare = r * Math.sin(2 * Math.PI * u2)
    return r * Math.cos(2 * Math.PI * u2)
  }
}

// ---------------------------------------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------------------------------------

export interface DispersionOptions {
  n?: number // runs, default 200
  seed?: number // default 1
  sigmas?: DispersionSigmas // default DEFAULT_SIGMAS
  /** Moon J2 in the runs' field. Default true. With false (and zero σ) every run is the planned descent. */
  j2?: boolean
  tubePoints?: number // instants of the tube, default 64
}

/** One flown run. */
export interface DispersionRun {
  ok: boolean
  error?: string // why a run could not be flown (ok false)
  /** Touchdown relative to the site on the surface, km east and north (local horizontal at the site). */
  eastKm: number
  northKm: number
  usedKg: number // propellant from DOI ignition to touchdown
  touchdownSpeedMs: number
  brakingCutShort: boolean
}

/** A cross-section of the tube: the spread of the runs' positions at one instant, in the plane across the
 *  nominal path. Positions Moon-centred, J2000 axes, km (the frame of the plan's Moon-centred legs). A kσ tube is
 *  the ring  center + mean + k (sigmaMajorKm cos θ · axisMajor + sigmaMinorKm sin θ · axisMinor),  θ ∈ [0, 2π). */
export interface TubePoint {
  utcMs: number
  center: Vec3 // nominal position
  mean: Vec3 // mean offset of the runs from the nominal position, km
  axisMajor: Vec3 // unit, across the path
  axisMinor: Vec3 // unit, across the path, ⟂ axisMajor
  sigmaMajorKm: number
  sigmaMinorKm: number
  sigmaAlongKm: number // spread along the path (shown as text, not as tube width)
}

export interface DispersionResult {
  validated: false
  marker: typeof NOT_VALIDATED
  n: number // runs asked for
  flown: number // runs that reached the surface
  seed: number
  sigmas: DispersionSigmas
  j2: boolean
  /** The model in one line, for the UI's hover text. */
  method: string
  tube: TubePoint[]
  landing: {
    meanEastKm: number
    meanNorthKm: number
    /** 1σ ellipse on the surface around the mean touchdown: semi-axes (km) and the major axis's azimuth
     *  (degrees from north toward east). The 3σ ellipse is three times as large (Gaussian approximation). */
    sigmaMajorKm: number
    sigmaMinorKm: number
    majorAzimuthDeg: number
    /** Distance from the site containing 99.7 % of the runs (empirical, the 3σ level), km. */
    radius997Km: number
    maxKm: number
  }
  propellant: {
    nominalKg: number // the planned descent
    meanKg: number
    sigmaKg: number
    minKg: number
    maxKg: number
    availableKg: number // usable at undocking
    overBudget: number // runs that needed more than availableKg
  }
  touchdown: { meanSpeedMs: number; maxSpeedMs: number; hard: number } // hard: above 3 m/s
  brakingCutShort: number // runs whose braking burn was cut off at the switch height before its commanded end
  runs: DispersionRun[]
  /** Shift of the touchdown by J2 alone (the zero-error run in the J2 field), km east / north and kg. */
  j2Only: { eastKm: number; northKm: number; usedKg: number } | null
}

/** What the analysis needs: the descent as planned and the ephemeris the plan used. */
export interface DispersionInput {
  descentInput: DescentInput
  descent: DescentResult
  ephem: FlightEphemeris
}

// ---------------------------------------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------------------------------------

/** The error of one run from the next nine deviates. */
export function drawPerturbation(next: () => number, s: DispersionSigmas): { p: DescentPerturbation; launchS: number } {
  const thrustScale = 1 + s.thrustFrac * next()
  const ispScale = 1 + s.ispFrac * next()
  const pointingDoi: Vec3 = [s.pointingRad * next(), s.pointingRad * next(), s.pointingRad * next()]
  const pointingBraking: Vec3 = [s.pointingRad * next(), s.pointingRad * next(), s.pointingRad * next()]
  const launchS = s.launchS * next()
  // σ = 0 gives exactly the commanded flight (−0 and 0 compare equal, 1 + 0·x is 1)
  return { p: { thrustScale, ispScale, pointingDoi, pointingBraking }, launchS }
}

/** Touchdown relative to the site at the instant the turning surface is there (launch slip launchS), km. */
function onSurface(input: DescentInput, r: ReplayResult, launchS: number): { eastKm: number; northKm: number } {
  const t = r.touchdownMs + launchS * 1000
  const S = input.site(t)
  const up = unit(S)
  const east = unit(sub(input.site(t + 1000), input.site(t - 1000)))
  const north = cross(up, east)
  const d = sub(scale(unit(r.touchdown.r), norm(S)), S)
  return { eastKm: dot(d, east), northKm: dot(d, north) }
}

/** Position on a sampled path at utcMs (linear between samples, held at the ends). */
function positionAt(t: number[], r: Vec3[], utcMs: number): Vec3 {
  if (utcMs <= t[0]) return r[0]
  const last = t.length - 1
  if (utcMs >= t[last]) return r[last]
  let lo = 0
  let hi = last
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (t[mid] <= utcMs) lo = mid
    else hi = mid
  }
  const u = (utcMs - t[lo]) / (t[hi] - t[lo])
  return add(r[lo], scale(sub(r[hi], r[lo]), u))
}

/** Eigen-decomposition of a symmetric 2×2 matrix [[a, b], [b, c]]: larger eigenvalue first, its unit vector. */
function eig2(a: number, b: number, c: number): { l1: number; l2: number; v1: [number, number] } {
  const tr = 0.5 * (a + c)
  const det = Math.sqrt(Math.max(0, 0.25 * (a - c) ** 2 + b * b))
  const l1 = tr + det
  const l2 = tr - det
  let v1: [number, number] = Math.abs(b) > 1e-300 ? [l1 - c, b] : a >= c ? [1, 0] : [0, 1]
  const n = Math.hypot(v1[0], v1[1])
  v1 = [v1[0] / n, v1[1] / n]
  return { l1: Math.max(0, l1), l2: Math.max(0, l2), v1 }
}

/** Unit chord from centers[from] to centers[to]; fallback (the previous tangent) when the two coincide or are not
 *  finite, so a tube point never gets a NaN axis. Where the chord is usable this is exactly unit(sub(b, a)). */
export function pathTangent(centers: Vec3[], from: number, to: number, fallback: Vec3): Vec3 {
  const chord = sub(centers[to], centers[from])
  const len = norm(chord)
  return len > 0 && Number.isFinite(len) ? unit(chord) : fallback
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)
const sd = (xs: number[]) => {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}

/** The analysis as steps: yields after every run (done, total) and returns the result. Drive it with
 *  runDispersion (all at once) or step by step from a worker that must stay responsive. */
export function* dispersionSteps(inp: DispersionInput, opt: DispersionOptions = {}): Generator<{ done: number; total: number }, DispersionResult> {
  const n = Math.max(1, Math.floor(opt.n ?? 200))
  const seed = opt.seed ?? 1
  const sigmas = opt.sigmas ?? DEFAULT_SIGMAS
  const j2 = opt.j2 ?? true
  const K = Math.max(2, Math.floor(opt.tubePoints ?? 64))
  const { descentInput, descent } = inp
  const c = descent.controls
  const t0 = c.startMs
  const t1 = descent.touchdownMs
  // the runs' field: the planning field, or the same span with J2 (a field built over the descent and an hour
  // either side; a run that lasts longer than that is reported as not flown)
  const field: Field = j2 ? moonField(inp.ephem, t0 - 3600_000, t1 + 3 * 3600_000, { j2: true }) : descentInput.field

  const nominal = replayDescent(descentInput, c, NO_PERTURBATION)
  const times = Array.from({ length: K }, (_, j) => t0 + ((t1 - t0) * j) / (K - 1))
  const centers = times.map((t) => positionAt(nominal.path.t, nominal.path.r, t))
  const dev: Vec3[][] = times.map(() => [])

  const next = gaussian(seed)
  const runs: DispersionRun[] = []
  for (let i = 0; i < n; i++) {
    const { p, launchS } = drawPerturbation(next, sigmas)
    try {
      const r = replayDescent(descentInput, c, p, field)
      const where = onSurface(descentInput, r, launchS)
      runs.push({ ok: true, ...where, usedKg: r.usedKg, touchdownSpeedMs: r.touchdownSpeedMs, brakingCutShort: r.brakingCutShort })
      times.forEach((t, j) => dev[j].push(sub(positionAt(r.path.t, r.path.r, t), centers[j])))
    } catch (err) {
      if (!(err instanceof LunarOpsError || err instanceof RangeError)) throw err
      runs.push({ ok: false, error: err.message, eastKm: NaN, northKm: NaN, usedKg: NaN, touchdownSpeedMs: NaN, brakingCutShort: false })
    }
    yield { done: i + 1, total: n }
  }

  // ---- tube
  let prevAlong: Vec3 = pathTangent(centers, 0, centers.length - 1, [1, 0, 0])
  const tube: TubePoint[] = times.map((utcMs, j) => {
    const ds = dev[j]
    const m: Vec3 = ds.length ? scale(ds.reduce((s, d) => add(s, d), [0, 0, 0] as Vec3), 1 / ds.length) : [0, 0, 0]
    const along = pathTangent(centers, Math.max(0, j - 1), Math.min(K - 1, j + 1), prevAlong)
    prevAlong = along
    const ref: Vec3 = Math.abs(along[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
    const u0 = unit(cross(along, ref))
    const v0 = cross(along, u0)
    let suu = 0
    let suv = 0
    let svv = 0
    let saa = 0
    for (const d of ds) {
      const x = sub(d, m)
      const a = dot(x, u0)
      const b = dot(x, v0)
      const l = dot(x, along)
      suu += a * a
      suv += a * b
      svv += b * b
      saa += l * l
    }
    const k = Math.max(1, ds.length - 1)
    const e = eig2(suu / k, suv / k, svv / k)
    const axisMajor = unit(add(scale(u0, e.v1[0]), scale(v0, e.v1[1])))
    return {
      utcMs,
      center: centers[j],
      mean: m,
      axisMajor,
      axisMinor: cross(along, axisMajor),
      sigmaMajorKm: Math.sqrt(e.l1),
      sigmaMinorKm: Math.sqrt(e.l2),
      sigmaAlongKm: Math.sqrt(saa / k),
    }
  })

  // ---- landing ellipse and propellant
  const ok = runs.filter((r) => r.ok)
  const E = ok.map((r) => r.eastKm)
  const N = ok.map((r) => r.northKm)
  const mE = mean(E)
  const mN = mean(N)
  const k = Math.max(1, ok.length - 1)
  let see = 0
  let sen = 0
  let snn = 0
  for (const r of ok) {
    see += (r.eastKm - mE) ** 2
    sen += (r.eastKm - mE) * (r.northKm - mN)
    snn += (r.northKm - mN) ** 2
  }
  // in (north, east) order so that the angle of the eigenvector is the azimuth from north toward east
  const e = eig2(snn / k, sen / k, see / k)
  let az = (Math.atan2(e.v1[1], e.v1[0]) * 180) / Math.PI
  if (az < 0) az += 180
  if (az >= 180) az -= 180
  const dist = ok.map((r) => Math.hypot(r.eastKm, r.northKm)).sort((a, b) => a - b)
  const used = ok.map((r) => r.usedKg)
  const speeds = ok.map((r) => r.touchdownSpeedMs)

  let j2Only: DispersionResult['j2Only'] = null
  if (j2) {
    try {
      const r = replayDescent(descentInput, c, NO_PERTURBATION, field)
      j2Only = { ...onSurface(descentInput, r, 0), usedKg: r.usedKg }
    } catch (err) {
      if (!(err instanceof LunarOpsError || err instanceof RangeError)) throw err
    }
  }

  return {
    validated: false,
    marker: NOT_VALIDATED,
    n,
    flown: ok.length,
    seed,
    sigmas,
    j2,
    method:
      `Monte Carlo, ${n} runs of the planned descent flown open loop (DOI and braking burn do not re-aim) with Gaussian errors in thrust, ` +
      `specific impulse, burn direction and launch time (all σ assumptions)${j2 ? ', Moon J2 on' : ''}; ${NOT_VALIDATED}.`,
    tube,
    landing: {
      meanEastKm: mE,
      meanNorthKm: mN,
      sigmaMajorKm: Math.sqrt(e.l1),
      sigmaMinorKm: Math.sqrt(e.l2),
      majorAzimuthDeg: az,
      radius997Km: dist.length ? dist[Math.min(dist.length - 1, Math.ceil(0.997 * dist.length) - 1)] : NaN,
      maxKm: dist.length ? dist[dist.length - 1] : NaN,
    },
    propellant: {
      nominalKg: nominal.usedKg,
      meanKg: mean(used),
      sigmaKg: sd(used),
      minKg: used.length ? Math.min(...used) : NaN,
      maxKg: used.length ? Math.max(...used) : NaN,
      availableKg: c.propellantKg,
      overBudget: used.filter((u) => u > c.propellantKg).length,
    },
    touchdown: { meanSpeedMs: mean(speeds), maxSpeedMs: speeds.length ? Math.max(...speeds) : NaN, hard: speeds.filter((v) => v > 3).length },
    brakingCutShort: ok.filter((r) => r.brakingCutShort).length,
    runs,
    j2Only,
  }
}

/** The whole analysis at once. */
export function runDispersion(inp: DispersionInput, opt: DispersionOptions = {}): DispersionResult {
  const steps = dispersionSteps(inp, opt)
  for (;;) {
    const s = steps.next()
    if (s.done) return s.value
  }
}

/** The sentence the UI shows for the landing dispersion. */
export function landingSentence(r: DispersionResult): string {
  const f = (x: number) => (x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x.toFixed(2))
  const offKm = Math.hypot(r.landing.meanEastKm, r.landing.meanNorthKm)
  return (
    `Landing dispersion (3σ, ${r.flown} of ${r.n} unguided runs): ${f(3 * r.landing.sigmaMajorKm)} × ${f(3 * r.landing.sigmaMinorKm)} km ellipse, ` +
    `long axis ${r.landing.majorAzimuthDeg.toFixed(0)}° from north, centred ${f(offKm)} km from the site; propellant ${Math.round(r.propellant.meanKg).toLocaleString('en-US')} ± ` +
    `${Math.round(3 * r.propellant.sigmaKg).toLocaleString('en-US')} kg (3σ). Validated by the science lead (statement of 15 Nov 2026; see record).`
  )
}
