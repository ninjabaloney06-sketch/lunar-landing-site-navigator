// Text formatting for the views. UTC everywhere; no locale-dependent output.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MINUS = '−'
/** Shown for a value that is not a finite number (e.g. a share of a zero-length span), never "NaN %". */
export const NO_VALUE = '—'

const pad = (n: number) => String(n).padStart(2, '0')

/** "14 November 2026, 12:00 UTC" */
export function fmtDateTime(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
}

/** "14 Nov" */
export function fmtDay(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`
}

/** "16 Aug 2027" (ninja, 14 Nov: the Mission panel's date format; it cannot be misread). */
export function fmtDate(ms: number): string {
  return `${fmtDay(ms)} ${new Date(ms).getUTCFullYear()}`
}

/** A typed day, UTC midnight: "16 Aug 2027", "16 August 2027" or "2027-08-16". null when it is not a real date. */
export function parseDate(input: string): number | null {
  const t = input.trim()
  let y: number, m: number, d: number
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  const dmy = /^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})$/i.exec(t)
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])]
  else if (dmy) {
    const word = dmy[2].toLowerCase()
    m = MONTHS.findIndex((x) => x.toLowerCase() === word || (word.length >= 3 && x.toLowerCase().startsWith(word)))
    ;[y, d] = [Number(dmy[3]), Number(dmy[1])]
  } else return null
  const ms = Date.UTC(y, m, d)
  const back = new Date(ms)
  return m >= 0 && back.getUTCFullYear() === y && back.getUTCMonth() === m && back.getUTCDate() === d ? ms : null
}

/** "14 Nov 2026, 12:00" */
export function fmtShort(ms: number): string {
  const d = new Date(ms)
  return `${fmtDay(ms)} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** "16–29 Aug 2027" for [start, end) with end at 00:00 of the day after the last day; one day is "31 Dec 2030"
 *  (feature review: a one-day mission read "31–31 Dec 2030"). */
export function fmtRange(startMs: number, endMs: number): string {
  const a = new Date(startMs)
  const b = new Date(endMs - 1)
  const y = (d: Date) => d.getUTCFullYear()
  const m = (d: Date) => MONTHS[d.getUTCMonth()].slice(0, 3)
  if (y(a) === y(b) && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()) return `${a.getUTCDate()} ${m(a)} ${y(a)}`
  if (y(a) === y(b) && a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${b.getUTCDate()} ${m(a)} ${y(a)}`
  if (y(a) === y(b)) return `${a.getUTCDate()} ${m(a)} – ${b.getUTCDate()} ${m(b)} ${y(a)}`
  return `${a.getUTCDate()} ${m(a)} ${y(a)} – ${b.getUTCDate()} ${m(b)} ${y(b)}`
}

/** Signed degrees with a true minus sign: "1.2°", "−0.4°". */
export function fmtDeg(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return NO_VALUE
  const s = Math.abs(v).toFixed(digits)
  return `${v < 0 && Number(s) !== 0 ? MINUS : ''}${s}°`
}

/** "89.77° S · 171.87° W" (planetocentric, east-positive input). */
export function fmtCoords(lat: number, lon: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return NO_VALUE
  const lo = ((((lon + 180) % 360) + 360) % 360) - 180
  return `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'} · ${Math.abs(lo).toFixed(2)}° ${lo < 0 ? 'W' : 'E'}`
}

/** First letter upper case: "Sample values — not validated" at the start of a sentence. */
export function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function fmtPct(v: number): string {
  if (!Number.isFinite(v)) return NO_VALUE
  return `${v.toFixed(1)} %`
}

export function fmtHours(v: number): string {
  if (!Number.isFinite(v)) return NO_VALUE
  return `${v.toFixed(1)} h`
}

/** A span given in hours, as a planner reads it: "5.2 h" under a day, "3 days 4 h" (whole hours) from a day on,
 *  "1 day", "13 days". Not finite → "no data". */
export function fmtSpanH(v: number): string {
  if (!Number.isFinite(v)) return 'no data'
  if (v < 23.95) return fmtHours(Math.max(0, v))
  const total = Math.round(v)
  const d = Math.floor(total / 24)
  const h = total % 24
  return `${d} ${d === 1 ? 'day' : 'days'}${h ? ` ${h} h` : ''}`
}

/** The Mission menu's name for the same formatter (hours in; not flightFormat's fmtDuration, which takes seconds). */
export const fmtDuration = fmtSpanH

export type CoordParse = { kind: 'none' } | { kind: 'ok'; lat: number; lon: number } | { kind: 'error'; message: string }

/** Typed coordinates in the site search: "-89.3, -130", "89.3 S 130 W", "89.30° S · 130.00° W".
 *  Returns 'none' for text that is not an attempt at coordinates (a site name). Never yields NaN. */
export function parseCoords(input: string): CoordParse {
  const text = input.trim()
  if (!/\d/.test(text)) return { kind: 'none' }
  if (/[a-z]{2,}/i.test(text.replace(/\b(lat|lon|latitude|longitude)\b/gi, ''))) return { kind: 'none' }
  const re = /([+−-]?\d+(?:[.,]\d+)?)\s*°?\s*([NSEW])?/gi
  const parts: { v: number; h: string | null }[] = []
  for (const m of text.matchAll(re)) {
    const v = Number(m[1].replace('−', '-').replace(',', '.'))
    if (!Number.isFinite(v)) return { kind: 'error', message: 'Coordinates must be numbers, for example 89.3 S, 130 W.' }
    parts.push({ v, h: m[2] ? m[2].toUpperCase() : null })
  }
  if (parts.length !== 2) return { kind: 'error', message: 'Type a latitude and a longitude, for example 89.3 S, 130 W.' }
  let [a, b] = parts
  if (a.h === 'E' || a.h === 'W' || b.h === 'N' || b.h === 'S') [a, b] = [b, a]
  let lat = a.v
  let lon = b.v
  if (a.h === 'S') lat = -Math.abs(lat)
  if (a.h === 'N') lat = Math.abs(lat)
  if (b.h === 'W') lon = -Math.abs(lon)
  if (b.h === 'E') lon = Math.abs(lon)
  if (lat < -90 || lat > 90) return { kind: 'error', message: 'Latitude must be between 90° S and 90° N.' }
  if (lon < -180 || lon > 360) return { kind: 'error', message: 'Longitude must be between 180° W and 180° E.' }
  return { kind: 'ok', lat, lon: lon > 180 ? lon - 360 : lon }
}
