// TESTS ONLY. Never import this from app code: the glob would bundle every ephem month.
// Loads shipped JSON (ephem months, horizons) and the T9 fixtures without node:fs typings.
import type { EphemMonth, Horizon, Station } from '../data/types'

const ephemFiles = import.meta.glob('../../public/data/ephem/20*.json', { import: 'default' })
const horizonFiles = import.meta.glob('../../public/data/horizons/*.json', { import: 'default' })
const fixtureFiles = import.meta.glob('../test/fixtures.json', { import: 'default' })

export async function loadMonths(ids: string[]): Promise<EphemMonth[]> {
  return Promise.all(
    ids.map(async (id) => {
      const load = ephemFiles[`../../public/data/ephem/${id}.json`]
      if (!load) throw new Error(`no ephem file for ${id}`)
      return (await load()) as EphemMonth
    }),
  )
}

export async function loadHorizonFile(name: string): Promise<Horizon> {
  const load = horizonFiles[`../../public/data/horizons/${name}`]
  if (!load) throw new Error(`no horizon file ${name}`)
  return (await load()) as Horizon
}

type Body = { az: number; el: number; dist_km: number; mask: number; frac: number }
export interface FixtureCase {
  site: string
  horizon: string | null
  utc: string
  utcMs: number
  state: { sun_km: number[]; earth_km: number[]; q_me_to_j2000: number[]; q_earth_to_me: number[] }
  sun: Body & { lit: boolean }
  earth: Body & { visible: boolean }
  stations: Record<string, { az: number; el: number; moonElAtStation: number; state: string; reason: string | null }>
  coverage_all: string
}
export interface Fixtures {
  tolerance_deg: number
  ephem_months: string[]
  horizon_files: string[]
  sites: Record<string, { lat: number; lon: number; elev_m: number | null }>
  stations: Station[]
  cases: FixtureCase[]
}

export async function loadFixtures(): Promise<Fixtures> {
  return (await fixtureFiles['../test/fixtures.json']()) as Fixtures
}
