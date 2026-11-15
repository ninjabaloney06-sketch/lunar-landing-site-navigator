// The rows of the Dates tab's year timeline (team lead, 15 Nov: compare places over the whole year): the current
// mission's site first, then every saved mission's site, then every point under "Your points" that can be a landing
// site, and last the prepared sites not named so far (shown behind a fold). One row per place: missions and points
// on the same place share its row and its computation, and each mission's dates are outlined on it.
import { customSiteBase, customSiteId, customSiteName } from '../data/customSite'
import type { Period, Site } from '../data/types'
import type { MissionState } from '../missions'
import { DEFAULT_SITE_ID, pointName } from '../state'
import type { UserPoint } from '../state'
import { SITE_REGION_TEXT } from './custom'
import { resolvePeriod } from './period'

export const CURRENT_TAG = 'Current mission'
export const POINT_TAG = 'Your point'

export interface StackRow {
  key: string
  site: Site | null // null: a point that cannot be a landing site, so nothing is computed for it
  name: string
  tags: string[] // what the place is: "Current mission", saved mission names, "Your point"
  missions: { name: string; startMs: number; endMs: number }[] // mission spans drawn as an outline on the row
  reason?: string // with site null: why, in plain words
}

interface Input {
  site: Site
  period: { startMs: number; endMs: number }
  missions: MissionState[]
  sites: Site[]
  periods: Period[]
  points: UserPoint[]
}

export function buildYearRows({ site, period, missions, sites, periods, points }: Input): { rows: StackRow[]; rest: Site[] } {
  const rows: StackRow[] = [
    { key: site.id, site, name: site.name, tags: [CURRENT_TAG], missions: [{ name: CURRENT_TAG, startMs: period.startMs, endMs: period.endMs }] },
  ]
  const rowOf = (id: string) => rows.find((r) => r.site?.id === id)

  for (const m of missions) {
    const id = m.site ?? DEFAULT_SITE_ID
    let row = rowOf(id)
    if (!row) {
      const custom = customSiteBase(id) // a saved custom site: named after its mission, as when it is selected
      const s = sites.find((x) => x.id === id) ?? (custom && { ...custom, name: customSiteName(m.name) })
      if (!s) continue // a site this build does not have
      rows.push((row = { key: s.id, site: s, name: s.name, tags: [], missions: [] }))
    }
    const name = m.name ?? 'Saved mission'
    const span = resolvePeriod(m, periods)
    if (!row.tags.includes(name)) row.tags.push(name)
    row.missions.push({ name, startMs: span.startMs, endMs: span.endMs })
  }

  points.forEach((pt, i) => {
    const name = pointName(pt, i)
    const id = customSiteId(pt.lat, pt.lon)
    const base = id ? customSiteBase(id) : null
    if (!id || !base) {
      rows.push({ key: `pt:${i}`, site: null, name, tags: [POINT_TAG], missions: [], reason: SITE_REGION_TEXT })
      return
    }
    const row = rowOf(id)
    if (row) {
      if (!row.tags.includes(POINT_TAG)) row.tags.push(POINT_TAG)
    } else rows.push({ key: id, site: { ...base, name }, name, tags: [POINT_TAG], missions: [] })
  })

  return { rows, rest: sites.filter((s) => !rowOf(s.id)) }
}
