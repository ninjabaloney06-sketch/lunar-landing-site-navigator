// Points of interest for the layer, the info box and the search (U2–U4). pois.json is fetched once, the first
// time the layer or the search is opened (data/load.loadPois), never at start.
// Only POIs inside the pin region (scene3d/region.inPinRegion) are used anywhere in the app.
import { useEffect, useRef, useState } from 'react'
import { loadPois } from '../data/load'
import { POI_GROUPS } from '../data/pois'
import type { Poi, PoiGroup } from '../data/pois'
import type { Site } from '../data/types'
import type { ScenePoi } from '../scene3d'
import { PIN_REGION_NORTH_LAT, inPinRegion } from '../scene3d/region'

export type PoiData =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; pois: Poi[]; byId: Map<string, Poi> } // pois: inside the pin region only
  | { status: 'error'; error: string }

/** Starts loading the first time `wanted` is true and keeps the data; a failed load is retried the next time
 *  `wanted` turns true (the layer or the search is opened again). */
export function usePois(wanted: boolean): PoiData {
  const [data, setData] = useState<PoiData>({ status: 'idle' })
  const now = useRef(data)
  now.current = data
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (!wanted || now.current.status === 'ready' || now.current.status === 'loading') return
    setData({ status: 'loading' })
    loadPois().then(
      (all) => {
        const pois = all.filter((p) => inPinRegion(p.lat))
        if (mounted.current) setData({ status: 'ready', pois, byId: new Map(pois.map((p) => [p.id, p])) })
      },
      (e: Error) => mounted.current && setData({ status: 'error', error: e.message }),
    )
  }, [wanted])
  return data
}

export const groupInfo = (g: PoiGroup) => POI_GROUPS.find((x) => x.id === g)!

/** "south of 80° S", from the shared constant. */
export const REGION_TEXT = `south of ${Math.abs(PIN_REGION_NORTH_LAT)}° S`

/** A landing record that is one of the app's sites is drawn once, as that site's pin. */
export const isSitePin = (p: Poi, siteIds: Set<string>) => p.group === 'landing' && p.siteId !== null && siteIds.has(p.siteId)

/** The pins of the chosen groups, as the scene draws them. */
export function scenePois(pois: Poi[], groups: PoiGroup[], sites: Site[]): ScenePoi[] {
  const ids = new Set(sites.map((s) => s.id))
  return pois
    .filter((p) => groups.includes(p.group) && !isSitePin(p, ids))
    .map((p) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, color: groupInfo(p.group).color, landing: p.group === 'landing' }))
}

/** Pins per group (what the key counts). */
export function pinCounts(pois: Poi[], sites: Site[]): Record<PoiGroup, number> {
  const ids = new Set(sites.map((s) => s.id))
  const out = Object.fromEntries(POI_GROUPS.map((g) => [g.id, 0])) as Record<PoiGroup, number>
  for (const p of pois) if (!isSitePin(p, ids)) out[p.group]++
  return out
}
