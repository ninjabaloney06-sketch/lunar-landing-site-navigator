// Text formatting for the Flight plan tab. UTC everywhere; English month abbreviations; no locale output.
// Estimates carry a leading "≈" (the caller passes estimate = true).

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number) => String(n).padStart(2, '0')

/** "0.019 km/s" below 0.1 km/s, otherwise "3.13 km/s"; "≈ 9.42 km/s" for an estimate. */
export function fmtKms(v: number, estimate = false): string {
  const s = `${v.toFixed(Math.abs(v) < 0.1 ? 3 : 2)} km/s`
  return estimate ? `≈ ${s}` : s
}

/** "27.0 t"; "0.21 t" below one tonne. */
export function fmtTonnes(kg: number): string {
  const t = kg / 1000
  return `${t.toFixed(Math.abs(t) < 1 ? 2 : 1)} t`
}

/** "45 s", "8 min 30 s", "8 min", "4 h 12 min", "4 h", "4 d 23 h", "4 d". Zero units are left out. */
export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s} s`
  if (s < 3600) {
    const m = Math.floor(s / 60)
    const r = s % 60
    return r ? `${m} min ${r} s` : `${m} min`
  }
  if (s < 86400) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return m ? `${h} h ${m} min` : `${h} h`
  }
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  return h ? `${d} d ${h} h` : `${d} d`
}

/** Mission elapsed time: "T+ 0 d 00:08:30". Negative input is shown as T+ 0. */
export function fmtElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86400)
  const hh = Math.floor((total % 86400) / 3600)
  const mm = Math.floor((total % 3600) / 60)
  const ss = total % 60
  return `T+ ${d} d ${pad(hh)}:${pad(mm)}:${pad(ss)}`
}

/** "16 Aug 2027, 07:42 UTC" */
export function fmtUtc(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
}

/** "16 Aug, 07:42" for the burn times in the table and the timeline ticks. */
export function fmtDayTime(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** Simulated seconds per real second. */
export const SPEEDS: { value: number; label: string }[] = [
  { value: 60, label: '1 min/s' },
  { value: 300, label: '5 min/s' },
  { value: 900, label: '15 min/s' },
  { value: 3600, label: '1 h/s' },
  { value: 14400, label: '4 h/s' },
  { value: 43200, label: '12 h/s' },
  { value: 86400, label: '1 day/s' },
]

export const DEFAULT_SPEED = 14400
