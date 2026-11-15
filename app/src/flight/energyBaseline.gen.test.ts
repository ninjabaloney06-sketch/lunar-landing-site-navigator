// Generator for energyBaseline.json, not part of the normal test run (it takes about 40 minutes):
//
//     GEN_BASELINE=1 npx vitest run src/flight/energyBaseline.gen.test.ts
//
// For every mission design, the reference mission (energyBaseline.ts: REFERENCE) is planned to every point of a
// grid over the whole Moon and to the 18 sites of this app. The point whose plan needs the least exhaust energy
// from the Trans-Lunar Injection on (facts.ideal.spaceJetEnergyMj) is the design's ideal landing point; its value
// is the baseline the energy multiplier divides by. Every plan that computes is a candidate, also one that leaves a
// stage short of propellant: the multiplier compares the energy a mission needs, and the menu reports a shortfall on
// its own line. (With this repo's hardware data, Blue Moon Mark 2 comes out short at every point.)
//
// GEN_ONLY=artemis-starship,artemis-blue-moon limits a run to those designs and keeps the others in the file.
import { it } from 'vitest'
import jul2027 from '../../public/data/ephem/2027-07.json?raw'
import aug2027 from '../../public/data/ephem/2027-08.json?raw'
import sep2027 from '../../public/data/ephem/2027-09.json?raw'
import sitesJson from '../../public/data/sites.json'
import type { EphemMonth } from '../data/types'
import { defaultSurfaceStayDays } from '../views/useFlight'
import { REFERENCE } from './energyBaseline'
import type { BaselineFile } from './energyBaseline'
import { LAUNCH_VEHICLES } from './launchVehicles'
import { LAUNCHPADS } from './pads'
import { runPlan } from './planWorker'
import { ARCHITECTURES, SPACECRAFT } from './spacecraft'

const months = [jul2027, aug2027, sep2027].map((m) => JSON.parse(m) as EphemMonth)
const LATS = [-89.5, -75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 89.5]
const LONS = [0, 45, 90, 135, 180, -135, -90, -45]

// Vitest copies the environment into import.meta.env; the app's tsconfig has no Node types, hence the casts.
const ENV = import.meta.env as unknown as Record<string, string | undefined>

it.skipIf(!ENV.GEN_BASELINE)(
  'writes energyBaseline.json',
  async () => {
    const pad = LAUNCHPADS.find((p) => p.id === REFERENCE.padId)!
    const sites = ((sitesJson as unknown as { sites?: unknown[] }).sites ?? (sitesJson as unknown as unknown[])) as { id: string; name: string; lat: number; lon: number }[]
    const points = [
      ...LATS.flatMap((lat) => (Math.abs(lat) > 89 ? [0] : LONS).map((lon) => ({ id: `grid ${lat},${lon}`, name: `${lat}°, ${lon}°`, lat, lon }))),
      ...sites.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon })),
    ]
    const only = ENV.GEN_ONLY?.split(',').filter(Boolean) ?? null
    const designs: BaselineFile['designs'] = {}
    for (const a of ARCHITECTURES.filter((x) => !only || only.includes(x.id))) {
      let best: { name: string; lat: number; lon: number; mj: number } | null = null
      let worst = 0
      for (const p of points) {
        const r = runPlan({
          id: 1, months, rendezvous: a.rendezvous,
          input: {
            pad, target: { id: p.id, name: p.name, latDeg: p.lat, lonDeg: p.lon }, architecture: { id: a.id, name: a.name },
            launchVehicle: LAUNCH_VEHICLES.find((v) => v.id === a.launchVehicleId)!,
            capsule: SPACECRAFT.find((v) => v.id === a.capsuleId)!, lander: SPACECRAFT.find((v) => v.id === a.landerId)!,
            earliestTouchdownMs: Date.parse(REFERENCE.earliestTouchdownUtc), surfaceStayDays: defaultSurfaceStayDays(a),
            returnWindowDays: 0, maxTransferDays: null,
          },
        })
        if (!r.ok || !r.plan.facts.ideal) continue
        const mj = r.plan.facts.ideal.spaceJetEnergyMj
        worst = Math.max(worst, mj)
        if (!best || mj < best.mj) best = { name: p.name, lat: p.lat, lon: p.lon, mj }
      }
      if (best) designs[a.id] = { idealPoint: { name: best.name, latDeg: best.lat, lonDeg: best.lon }, spaceJetEnergyMj: best.mj, worstOnGridMj: worst }
      console.log(`[baseline] ${a.id}: ${best ? `${best.name} ${best.mj.toExponential(5)} MJ, worst ${worst.toExponential(5)}` : 'no candidate'}`)
    }
    // read the file just before writing, so runs for different designs can share it
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as {
      readFileSync(u: URL, enc: string): string
      writeFileSync(u: URL, s: string): void
    }
    const file = new URL('./energyBaseline.json', import.meta.url)
    const old = JSON.parse(fs.readFileSync(file, 'utf8')) as BaselineFile
    const out: BaselineFile = { reference: REFERENCE, gridPoints: points.length, designs: { ...(only ? old.designs : {}), ...designs } }
    fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n')
  },
  4 * 3_600_000,
)
