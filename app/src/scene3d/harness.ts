// C1 test harness (dev only, not in the production build): implements SceneDeps.loadFrame with data/load.ts +
// geometry, the way C2's data layer does in the app. URL: ?test=1&site=<id>&utc=<ISO>&level=globe|site|eye.

import { loadEphem, loadHorizon, loadSites, loadTerrain } from '../data/load'
import type { EphemMonth, Horizon, TerrainTile } from '../data/types'
import { interpolate } from '../geometry'
import { mountScene, type SceneDeps, type SceneFrame, type SceneLevel } from './index'

const monthCache = new Map<string, Promise<EphemMonth | null>>()
const month = (key: string) => {
  if (!monthCache.has(key)) monthCache.set(key, loadEphem(key).catch(() => null))
  return monthCache.get(key)!
}
const key = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`

/** Monthly files ephem/YYYY-MM.json (Track A); the synthetic ephem/sample.json only when no month file exists. */
async function monthsFor(utcMs: number): Promise<EphemMonth[]> {
  const d = new Date(utcMs)
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  const real = (await Promise.all([month(key(d)), month(key(next))])).filter((m): m is EphemMonth => m !== null)
  if (real.length) return real
  const sample = await month('sample')
  return sample ? [sample] : []
}

const horizonCache = new Map<string, Promise<Horizon>>()
const horizon = (file: string) => {
  if (!horizonCache.has(file)) horizonCache.set(file, loadHorizon(file))
  return horizonCache.get(file)!
}

/** The app's loader (data/load.ts): 80 m tile plus the extra levels its meta lists. Missing → null (fallback). */
const terrain = (id: string): Promise<TerrainTile | null> => loadTerrain(id).catch(() => null)

// deps.sites is looked up on every load, so tests can add synthetic sites through __scene.setSites.
const deps: SceneDeps = { sites: await loadSites(), loadFrame }

async function loadFrame(siteId: string, utcMs: number): Promise<SceneFrame> {
  const site = deps.sites.find((s) => s.id === siteId)
  if (!site) throw new Error(`unknown site ${siteId}`)
  const [h, t, months] = await Promise.all([
    site.horizon ? horizon(site.horizon) : Promise.resolve(null),
    terrain(site.id),
    monthsFor(utcMs),
  ])
  return { site, horizon: h, terrain: t, state: interpolate(months, utcMs) }
}

const params = new URLSearchParams(window.location.search)
const handle = mountScene(document.getElementById('scene')!, deps)
// E = eye level, Esc = back (eye → site → globe). In the app, App.tsx owns these keys.
let level: SceneLevel = 'globe'
window.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return
  const next = e.key === 'e' || e.key === 'E' ? (level === 'site' ? 'eye' : null) : e.key === 'Escape' ? ({ eye: 'site', site: 'globe', globe: null, flight: null } as const)[level] : null
  if (next) handle.setLevel((level = next))
})
handle.onLevel((l) => (level = l)) // a walk ends at eye level
const siteId = params.get('site')
if (siteId) {
  const utc = Date.parse(params.get('utc') ?? '2027-08-16T12:00:00Z') // demo time
  handle.update(await loadFrame(siteId, utc))
  await handle.ready
  level = (params.get('level') as SceneLevel | null) ?? 'site'
  handle.setLevel(level)
}
