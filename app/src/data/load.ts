import type { EphemMonth, Horizon, Period, Site } from './types'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${path}`)
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export const loadSites = () => getJson<Site[]>('sites.json')
export const loadPeriods = () => getJson<Period[]>('periods.json')
export const loadHorizon = (file: string) => getJson<Horizon>(`horizons/${file}`)
export const loadEphem = (month: string) => getJson<EphemMonth>(`ephem/${month}.json`)
