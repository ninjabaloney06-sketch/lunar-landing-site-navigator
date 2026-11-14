// Text formatting for the views. UTC everywhere; no locale-dependent output.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MINUS = '−'

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

/** "14 Nov 2026, 12:00" */
export function fmtShort(ms: number): string {
  const d = new Date(ms)
  return `${fmtDay(ms)} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** "16–29 Aug 2027" for [start, end) with end at 00:00 of the day after the last day. */
export function fmtRange(startMs: number, endMs: number): string {
  const a = new Date(startMs)
  const b = new Date(endMs - 1)
  const y = (d: Date) => d.getUTCFullYear()
  const m = (d: Date) => MONTHS[d.getUTCMonth()].slice(0, 3)
  if (y(a) === y(b) && a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${b.getUTCDate()} ${m(a)} ${y(a)}`
  if (y(a) === y(b)) return `${a.getUTCDate()} ${m(a)} – ${b.getUTCDate()} ${m(b)} ${y(a)}`
  return `${a.getUTCDate()} ${m(a)} ${y(a)} – ${b.getUTCDate()} ${m(b)} ${y(b)}`
}

/** Signed degrees with a true minus sign: "1.2°", "−0.4°". */
export function fmtDeg(v: number, digits = 1): string {
  const s = Math.abs(v).toFixed(digits)
  return `${v < 0 && Number(s) !== 0 ? MINUS : ''}${s}°`
}

/** "89.77° S · 171.87° W" (planetocentric, east-positive input). */
export function fmtCoords(lat: number, lon: number): string {
  const lo = ((((lon + 180) % 360) + 360) % 360) - 180
  return `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'} · ${Math.abs(lo).toFixed(2)}° ${lo < 0 ? 'W' : 'E'}`
}

export function fmtPct(v: number): string {
  return `${v.toFixed(1)} %`
}

export function fmtHours(v: number): string {
  return `${v.toFixed(1)} h`
}

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
