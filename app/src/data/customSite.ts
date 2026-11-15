// Custom landing sites: a place inside the pin region (scene3d/region.inPinRegion) that the user made the landing
// site. Its ground height, slope and horizon come from capHorizon and its terrain from capTerrain (data/southcap.ts,
// computed in the browser on the south-cap rasters, approximate); every result is then computed by the same
// functions as for a prepared site (data/results.ts). Nothing here computes a result.
//
// Identity: the id is capSiteId(lat, lon) ("cap:-85.12345,10.00000"), which is also the terrain's meta.site_id (the
// scene rebuilds on it). The id alone describes the site: a link holds it (state.ts), and the site, its horizon and
// its terrain are rebuilt from it. The cap rasters are fetched the first time a custom site is needed, never at start.
import { inPinRegion } from '../scene3d/region'
import { capHorizon, capSiteId, capTerrain } from './southcap'
import type { CapHorizon, CapTerrainTile } from './southcap'
import type { Site } from './types'

/** The id's own form: "cap:" + latitude and longitude with exactly five decimals (capSiteId). */
const ID_FORM = /^cap:-?\d{1,3}\.\d{5},-?\d{1,3}\.\d{5}$/

/** Five decimals, the id's precision; + 0 turns −0 into 0, so a rounded −0.000001 writes "0.00000". */
const r5 = (x: number) => Math.round(x * 1e5) / 1e5 + 0

/** The custom site id of a place, or null outside the pin region or off the Moon. */
export function customSiteId(lat: number, lon: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || !inPinRegion(lat)) return null
  const lo = ((((lon + 180) % 360) + 360) % 360) - 180
  return capSiteId(r5(lat), r5(lo))
}

/** Latitude and longitude of a custom site id; null for any other text (only the exact form customSiteId writes). */
export function parseCustomSiteId(id: string): { lat: number; lon: number } | null {
  if (!ID_FORM.test(id)) return null
  const [lat, lon] = id.slice(4).split(',').map(Number)
  if (lon < -180 || lon > 180 || customSiteId(lat, lon) !== id) return null
  return { lat, lon }
}

export const CUSTOM_SITE_NAME = 'Custom site'

/** U10: a custom landing site is the mission's own place and carries the mission's name; CUSTOM_SITE_NAME only when
 *  there is none (blank or absent). The name never changes the id or anything computed for the site. */
export const customSiteName = (missionName?: string | null): string => missionName?.trim() || CUSTOM_SITE_NAME

/** F10: the name of the point of interest a custom site was opened from ("Show as landing site" makes a custom site
 *  at the point's own coordinates, so its id is customSiteId of that point), or null. Only a lookup; the POI list is
 *  loaded lazily, so a caller passes null until it is there and the site keeps the mission's name meanwhile. */
export function poiNameAt(id: string | null, pois: readonly { name: string; lat: number; lon: number }[] | null): string | null {
  if (!id || !pois || !parseCustomSiteId(id)) return null
  return pois.find((p) => customSiteId(p.lat, p.lon) === id)?.name ?? null
}

/** The site as far as the id gives it: no height and no slope until capHorizon has run. */
export function customSiteBase(id: string): Site | null {
  const c = parseCustomSiteId(id)
  if (!c) return null
  return {
    id,
    name: CUSTOM_SITE_NAME,
    group: 'custom',
    label: null,
    lat: c.lat,
    lon: c.lon,
    frame_note: "the user's own coordinates; MOON_ME assumed",
    elev_m: null,
    slope_deg: null,
    far_side: false, // not computed for a custom site; the app does not read it
    source_url: '',
    source_label: 'Chosen by the user in this app',
    horizon: null,
    potential: [],
  }
}

interface Entry {
  horizon: Promise<CapHorizon>
  site: Promise<Site>
  terrain: Promise<CapTerrainTile | null> | null
}

// The last few custom sites: their horizon (50–90 ms) and terrain (a 500 × 500 grid and its levels) are computed once
// each, not on every time step the scene asks for.
const MAX_ENTRIES = 4
const entries = new Map<string, Entry>()

function entry(id: string): Entry {
  const base = customSiteBase(id)
  if (!base) throw new RangeError(`not a custom site id: ${id}`)
  let e = entries.get(id)
  if (e) {
    entries.delete(id)
    entries.set(id, e)
    return e
  }
  const horizon = capHorizon(base.lat, base.lon)
  const site = horizon.then((h): Site => ({ ...base, elev_m: h.elev_m, slope_deg: h.slope_deg }))
  const made: Entry = { horizon, site, terrain: null }
  entries.set(id, made)
  // A failed computation (cap data not loaded, a point the rasters do not cover) is forgotten so a retry can succeed;
  // the caller that awaits it gets the error.
  horizon.catch(() => entries.get(id) === made && entries.delete(id))
  site.catch(() => undefined)
  e = made
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value as string)
  return e
}

/** capHorizon for the site of this id (720 azimuths, ground height, slope, and how it was computed). */
export const customHorizon = (id: string): Promise<CapHorizon> => entry(id).horizon

/** The full Site: the base with elev_m and slope_deg from capHorizon. */
export const loadCustomSite = (id: string): Promise<Site> => entry(id).site

/** capTerrain for the site of this id, shaped like loadTerrain(siteId); its meta.site_id is the id. */
export function customTerrain(id: string): Promise<CapTerrainTile | null> {
  const e = entry(id)
  if (!e.terrain) {
    const base = customSiteBase(id)!
    const t = capTerrain(base.lat, base.lon)
    e.terrain = t
    t.catch(() => {
      if (e.terrain === t) e.terrain = null
    })
  }
  return e.terrain
}
