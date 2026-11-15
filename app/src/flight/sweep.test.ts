// The integrated planner across launchpads, landing sites, dates and transfer caps on the real DE440 files:
// the shooting has to converge everywhere the app offers a choice, and every plan has to hold together.
import { describe, expect, it } from 'vitest'
import aug2027 from '../../public/data/ephem/2027-08.json?raw'
import sep2027 from '../../public/data/ephem/2027-09.json?raw'
import oct2027 from '../../public/data/ephem/2027-10.json?raw'
import type { EphemMonth } from '../data/types'
import { R_MOON } from './astro'
import { makeFlightEphemeris } from './ephemeris'
import { LAUNCHPADS } from './pads'
import { planFlight, sampleTrack } from './plan'
import { DEFAULT_OPTIONS } from './types'
import type { LandingTarget } from './types'
import { VEHICLES } from './vehicles'
import { add, norm, sub } from './vec'

const ephem = makeFlightEphemeris([aug2027, sep2027, oct2027].map((m) => JSON.parse(m) as EphemMonth))
const SITES: LandingTarget[] = [
  { id: 'pole', name: 'South pole ridge', latDeg: -89.46, lonDeg: -136.68 },
  { id: 'equator', name: 'Near-side equator', latDeg: 0.67, lonDeg: 23.47 },
  { id: 'far', name: 'Far-side mid latitude', latDeg: -45, lonDeg: 178 },
]
// A week apart: the Moon near apogee, at its largest southern and northern declination, near perigee.
const LANDINGS = [Date.UTC(2027, 7, 16), Date.UTC(2027, 7, 23), Date.UTC(2027, 7, 30), Date.UTC(2027, 8, 6, 9), Date.UTC(2027, 8, 20, 17)]
const vehicle = VEHICLES[0]

describe('integrated planner: every launchpad, three sites, five dates', () => {
  const rows: string[] = []
  let total = 0
  let integrated = 0
  for (const pad of LAUNCHPADS) {
    for (const target of SITES) {
      it(`${pad.id} → ${target.id}`, () => {
        for (const landingMs of LANDINGS) {
          const plan = planFlight({ pad, vehicle, target, options: { ...DEFAULT_OPTIONS, landingMs }, ephem })
          total++
          if (plan.model === 'n-body') integrated++
          rows.push(
            `${pad.id} ${target.id} ${new Date(landingMs).toISOString().slice(0, 10)} ${plan.model} ` +
              `az ${plan.launchAzimuthDeg.toFixed(1)} incl ${plan.parkingInclDeg.toFixed(1)} tli ${plan.burns[1].dvKms.toFixed(3)} ` +
              `loi ${plan.burns[2].dvKms.toFixed(3)} days ${plan.transferDays.toFixed(2)} loiter ${plan.loiterH.toFixed(1)}`,
          )
          // The path is continuous where the Moon-centred track takes over, enters lunar orbit at 100 km and
          // touches down on the surface, whichever model produced it.
          const end = plan.geo.p[plan.geo.p.length - 1]
          expect(norm(sub(end, add(ephem.moonPos(plan.handoverMs), plan.seleno.p[0])))).toBeLessThan(2)
          expect(Math.abs(norm(sampleTrack(plan.seleno, plan.loiMs)!) - (R_MOON + 100))).toBeLessThan(0.5)
          expect(plan.landingMs).toBe(landingMs)
          expect(plan.burns[1].dvKms).toBeGreaterThan(3.08)
          expect(plan.burns[1].dvKms).toBeLessThan(3.2)
          expect(plan.burns[2].dvKms).toBeGreaterThan(0.6)
          expect(plan.burns[2].dvKms).toBeLessThan(1.3)
        }
      })
    }
  }
  it('the shooting converges for every case', () => {
    console.log(`[flight sweep] integrated ${integrated} of ${total}\n` + rows.join('\n'))
    expect(integrated).toBe(total)
  })
})

describe('integrated planner: transfer caps', () => {
  const pad = LAUNCHPADS[0]
  const landingMs = LANDINGS[0]
  for (const cap of [4.5, 4, 3.5, 3, 2.5]) {
    it(`at most ${cap} days`, () => {
      const plan = planFlight({ pad, vehicle, target: SITES[0], options: { ...DEFAULT_OPTIONS, landingMs, maxTransferDays: cap }, ephem })
      expect(plan.model).toBe('n-body')
      expect(plan.transferDays).toBeLessThan(cap + 0.35)
    })
  }
})
