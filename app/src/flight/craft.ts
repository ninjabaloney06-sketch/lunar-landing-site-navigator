// Where the capsule and the lander are at an instant of a planned mission. Pure lookups in the plan's legs.
import type { CraftId, CraftState, MissionEvent, MissionLeg, MissionPlan, Track, Vec3 } from './types'
import { lerp } from './vec'

/** Linear interpolation along a track at UTC ms; null outside [t[0], t[last]]. */
export function sampleTrack(track: Track, utcMs: number): Vec3 | null {
  const { t, p } = track
  const n = t.length
  if (n === 0 || utcMs < t[0] || utcMs > t[n - 1]) return null
  if (utcMs === t[n - 1]) return p[n - 1]
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (t[mid] <= utcMs) lo = mid
    else hi = mid
  }
  return t[hi] === t[lo] ? p[lo] : lerp(p[lo], p[hi], (utcMs - t[lo]) / (t[hi] - t[lo]))
}

/** The leg of a craft that contains utcMs (the later one where two legs meet). */
export function legAt(plan: MissionPlan, craft: CraftId, utcMs: number): MissionLeg | null {
  let found: MissionLeg | null = null
  for (const leg of plan.legs) {
    if (leg.craft !== craft || leg.track.t.length === 0) continue
    if (utcMs >= leg.track.t[0] && utcMs <= leg.track.t[leg.track.t.length - 1]) found = leg
  }
  return found
}

/** Position of a craft at utcMs (clamped to the mission). The lander rides with the capsule while it is docked. */
export function craftAt(plan: MissionPlan, craft: CraftId, utcMs: number): CraftState | null {
  const t = Math.min(plan.endMs, Math.max(plan.launchMs, utcMs))
  const leg = legAt(plan, craft, t)
  if (leg) {
    const pos = sampleTrack(leg.track, t)
    if (pos) return { frame: leg.frame, pos, legId: leg.id, label: leg.label, powered: leg.powered, docked: false }
  }
  if (craft === 'lander') {
    const c = craftAt(plan, 'capsule', t)
    return c && { ...c, docked: true }
  }
  return null
}

/** Where an event happens: the craft's position at its instant. */
export function eventPlace(plan: MissionPlan, e: MissionEvent): CraftState | null {
  return craftAt(plan, e.craft, e.utcMs)
}
