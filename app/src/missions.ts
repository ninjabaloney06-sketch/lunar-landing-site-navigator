// Saved missions (notebook note 13): "Add mission" keeps the current mission — name, landing site, dates,
// stations, science goal and the flight choices (launchpad, mission design, surface stay, transfer cap) — in this
// browser's localStorage. "Calculate flight" on a saved mission opens the flight view with exactly these values; a
// mission saved before the transfer cap was stored reads it as unset (minimum energy), never as the cap on screen. No account, nothing leaves the device. Each
// mission is stored as the same text a link holds (serializeHash) and read back through parseHash, so a stored
// value is validated exactly like a link and can never yield NaN or an unknown key.
import { useCallback, useEffect, useState } from 'react'
import { EMPTY_STATE, parseHash, serializeHash } from './state'
import type { HashState } from './state'

const MISSIONS_KEY = 'llsn.missions.v1'
export const MAX_MISSIONS = 12

/** The part of the state that is the mission: not the cursor, the view, the drawer or the user points. */
export type MissionState = Pick<HashState, 'site' | 'period' | 'from' | 'days' | 'st' | 'name' | 'goal' | 'pad' | 'rocket' | 'stay' | 'tmax'>

export function missionOf(s: HashState): MissionState {
  return { site: s.site, period: s.period, from: s.from, days: s.days, st: s.st, name: s.name, goal: s.goal, pad: s.pad, rocket: s.rocket, stay: s.stay, tmax: s.tmax }
}

/** One mission as link text; also its identity (two saves of the same mission are one entry). */
export function missionKey(m: MissionState): string {
  return serializeHash({ ...EMPTY_STATE, pts: [], ...m })
}

export function parseMissions(raw: string | null): MissionState[] {
  if (!raw) return []
  let list: unknown
  try {
    list = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const out: MissionState[] = []
  for (const item of list) {
    if (typeof item !== 'string') continue
    const m = missionOf(parseHash(item))
    const key = missionKey(m)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(m)
    if (out.length === MAX_MISSIONS) break
  }
  return out
}

function read(): MissionState[] {
  try {
    return parseMissions(window.localStorage.getItem(MISSIONS_KEY))
  } catch {
    return [] // storage blocked: the app works without saved missions
  }
}

function write(list: MissionState[]): boolean {
  try {
    window.localStorage.setItem(MISSIONS_KEY, JSON.stringify(list.map(missionKey)))
    return true
  } catch {
    return false
  }
}

/** Saved missions, shared by the Mission panel and the comparison table, and across tabs. */
export function useMissions() {
  const [list, setList] = useState<MissionState[]>(read)

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === MISSIONS_KEY) setList(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /** false when it is already saved, the list is full, or the browser refuses storage. */
  const add = useCallback((m: MissionState): boolean => {
    const cur = read()
    const key = missionKey(m)
    if (cur.length >= MAX_MISSIONS || cur.some((x) => missionKey(x) === key)) return false
    const next = [...cur, m]
    if (!write(next)) return false
    setList(next)
    return true
  }, [])

  const remove = useCallback((key: string) => {
    const next = read().filter((x) => missionKey(x) !== key)
    write(next)
    setList(next)
  }, [])

  return { list, add, remove }
}
