// C1 test harness (dev only, not in the production build): implements SceneDeps.loadFrame with data/load.ts +
// geometry, the way C2's data layer does in the app. URL: ?test=1&site=<id>&utc=<ISO>&level=globe|site|eye.

import { loadEphem, loadHorizon, loadSites } from '../data/load'
import type { EphemMonth, Horizon, TerrainMeta, TerrainTile } from '../data/types'
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

/** terrain/<id>.json (TerrainMeta) + terrain/<id>.bin (size² Int16, little-endian). Missing → null (flat fallback). */
async function terrain(id: string): Promise<TerrainTile | null> {
  try {
    const base = `${import.meta.env.BASE_URL}data/terrain/${id}`
    const meta = (await (await fetch(`${base}.json`)).json()) as TerrainMeta
    const res = await fetch(`${base}.bin`)
    const buf = await res.arrayBuffer()
    if (!res.ok || buf.byteLength !== meta.size * meta.size * 2) return null
    return { meta, heights: new Int16Array(buf) }
  } catch {
    return null
  }
}

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
const siteId = params.get('site')
if (siteId) {
  const utc = Date.parse(params.get('utc') ?? '2026-11-14T00:00:00Z')
  handle.update(await loadFrame(siteId, utc))
  await handle.ready
  handle.setLevel((params.get('level') as SceneLevel | null) ?? 'site')
}
