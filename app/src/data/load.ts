import type { EphemMonth, Horizon, Period, Site, Station, TerrainMeta, TerrainTile } from './types'

/** A file the build does not contain (404, or the dev server / Worker answering with the SPA page). */
export class MissingDataError extends Error {}

async function fetchData(path: string): Promise<Response> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${path}`)
  if (res.status === 404) throw new MissingDataError(`${path}: not in this build`)
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  if ((res.headers.get('content-type') ?? '').includes('text/html')) {
    throw new MissingDataError(`${path}: not in this build`)
  }
  return res
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetchData(path)
  try {
    return (await res.json()) as T
  } catch {
    throw new Error(`${path}: not valid JSON`)
  }
}

// One request per file per session; a failed request is forgotten so a retry can succeed.
const cache = new Map<string, Promise<unknown>>()
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined
  if (!p) {
    p = load()
    cache.set(key, p)
    p.catch(() => cache.delete(key))
  }
  return p
}

export const loadSites = () => cached('sites', () => getJson<Site[]>('sites.json'))
export const loadPeriods = () => cached('periods', () => getJson<Period[]>('periods.json'))
export const loadStations = () => cached('stations', () => getJson<Station[]>('stations.json'))
export const loadHorizon = (file: string) => cached(`h:${file}`, () => getJson<Horizon>(`horizons/${file}`))
export const loadEphem = (month: string) => cached(`e:${month}`, () => getJson<EphemMonth>(`ephem/${month}.json`))

/** One grid: terrain/<name>.json (TerrainMeta) + terrain/<name>.bin (little-endian Int16, size × size). */
async function loadGrid(name: string): Promise<TerrainTile> {
  const [meta, buf] = await Promise.all([
    getJson<TerrainMeta>(`terrain/${name}.json`),
    fetchData(`terrain/${name}.bin`).then((r) => r.arrayBuffer()),
  ])
  const n = meta.size * meta.size
  if (buf.byteLength !== n * 2) throw new Error(`terrain/${name}.bin: ${buf.byteLength} bytes, expected ${n * 2}`)
  const view = new DataView(buf)
  const heights = new Int16Array(n)
  for (let i = 0; i < n; i++) heights[i] = view.getInt16(i * 2, true)
  return { meta, heights }
}

/** Terrain tile: terrain/<id>.json + .bin, plus the extra levels its meta lists (terrain/<id>-<level>.*,
 *  fetched in parallel and attached as `levels`). null when the build has no tile for this site; the scene then
 *  draws its flat fallback. A level that is missing or broken is left out: the scene renders the rest. */
export function loadTerrain(siteId: string): Promise<TerrainTile | null> {
  return cached(`t:${siteId}`, async () => {
    try {
      const base = await loadGrid(siteId)
      const names = base.meta.levels ?? []
      if (!names.length) return base
      const levels = await Promise.all(names.map((l) => loadGrid(`${siteId}-${l}`).catch(() => null)))
      const ok = levels.filter((t): t is TerrainTile => t !== null && t.meta.level !== undefined)
      return ok.length ? { ...base, levels: ok } : base
    } catch (e) {
      if (e instanceof MissingDataError) return null
      throw e
    }
  })
}

/** "YYYY-MM" of a UTC instant: the ephemeris file name. */
export function monthKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 7)
}

function nextMonthStart(ms: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
}

/** Ephemeris months covering [startMs, endMs), plus the following month when present (interpolation across
 *  the boundary). null when a required month is not in this build. */
export async function loadMonthsFor(startMs: number, endMs: number): Promise<EphemMonth[] | null> {
  const keys: string[] = []
  for (let t = Date.UTC(new Date(startMs).getUTCFullYear(), new Date(startMs).getUTCMonth(), 1); t < endMs; t = nextMonthStart(t)) {
    keys.push(monthKey(t))
  }
  const opt = monthKey(endMs)
  const all = await Promise.all(
    [...keys, ...(keys.includes(opt) ? [] : [opt])].map((k) =>
      loadEphem(k).catch((e) => {
        if (e instanceof MissingDataError) return null
        throw e
      }),
    ),
  )
  const required = all.slice(0, keys.length)
  if (required.some((m) => m === null)) return null
  return all.filter((m): m is EphemMonth => m !== null)
}
