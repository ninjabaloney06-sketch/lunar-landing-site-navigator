// The global "Full data" setting (U8, decided by ninja 15 Nov): every info card and detail view opens in summary
// mode by default; once the user switches "Full data" on in any card, every other card opens in full data mode too,
// until it is switched off. One value for the whole app, kept in localStorage so it survives a reload. Storage that
// throws (private mode, blocked site data) or holds anything unexpected means summary.
//
// Use: `const [full, setFull] = useFullData()` in a card, and put <FullDataSwitch /> (FullDataSwitch.tsx) in the
// card's top-right corner.
import { useSyncExternalStore } from 'react'

export const FULL_DATA_KEY = 'llsn.fullData'

const listeners = new Set<() => void>()
let memory: boolean | null = null // the value this page set, when storage refuses to keep it

function read(): boolean {
  try {
    const v = window.localStorage.getItem(FULL_DATA_KEY)
    if (v !== null) return v === '1'
  } catch {
    // storage unavailable: fall through
  }
  return memory ?? false
}

/** Reads the setting outside React (default false = summary). */
export function getFullData(): boolean {
  return read()
}

/** Sets the setting for every card on the page (and later visits, when storage works). */
export function setFullData(on: boolean): void {
  memory = on
  try {
    window.localStorage.setItem(FULL_DATA_KEY, on ? '1' : '0')
  } catch {
    // storage unavailable: the page still switches, the choice is not kept
  }
  for (const f of listeners) f()
}

function subscribe(f: () => void): () => void {
  listeners.add(f)
  // Another tab changed it.
  const onStorage = (e: StorageEvent) => {
    if (e.key === FULL_DATA_KEY || e.key === null) f()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(f)
    window.removeEventListener('storage', onStorage)
  }
}

/** [full data on, set it]. Every component using it re-renders when any card switches it. */
export function useFullData(): [boolean, (on: boolean) => void] {
  const full = useSyncExternalStore(subscribe, read, () => false)
  return [full, setFullData]
}
