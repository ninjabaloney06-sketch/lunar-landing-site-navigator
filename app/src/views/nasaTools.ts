// Links that open the selected site in NASA's own tools (add-on Task 3): Moon Trek, LROC QuickMap and JPL Horizons.
// Only URLs are built here; nothing is computed for the site.
//
// The two map tools document no deep-link format. Both formats below were read from the tools themselves in
// Chromium on 15 Nov 2026 (record: docs/event/validation.md, "NASA-tools link check"):
// - Moon Trek keeps its view in the hash: x, y = map centre, z = zoom level, p = map projection (CRS URN). In the
//   South Pole Map (IAU2000:30120) x, y are polar stereographic metres; in the Global Map (EPSG:104903) they are
//   east longitude and latitude in degrees.
// - QuickMap keeps it in the query: prjExtent = xmin,ymin,xmax,ymax in projected metres, proj = projection id
//   (27 = Stereographic South Pole, 16 = Equidistant Cylindrical, which ends at 75°).
// Polar stereographic metres, both tools: x = 2R·tan((90° + lat)/2)·sin(lon), y = 2R·tan((90° + lat)/2)·cos(lon),
// R = 1737.4 km; checked against both tools' own coordinate readouts.
//
// Horizons: the documented API (https://ssd-api.jpl.nasa.gov/doc/horizons.html) with the settings of check V1 in
// docs/event/validation.md: observer table, quantity 4 (apparent azimuth and elevation), refraction off (AIRLESS),
// decimal degrees, extra precision, UTC to the minute, 6-hour steps, observer = the site as a geodetic point on the
// Moon (coord@301). The altitude is the app's own eye height (terrain height + 1.75 m), so the table describes the
// same point the app computes for.

export const MOON_RADIUS_M = 1_737_400
/** South of this latitude both map tools open in their south polar view (task text). */
export const POLAR_LAT = -80
/** QuickMap's Equidistant Cylindrical view only covers |lat| < 75° ("Equidistant Cylindrical (< 75 deg.)"). */
const QM_CYL_LIMIT = 75
/** Half the side of the QuickMap box around the site, metres (opens at about 44 m per pixel on a 1400 px window). */
const QM_HALF_M = 20_000
/** Moon Trek zoom level: about 33 m per pixel in the South Pole Map, a 5 km scale bar in the Global Map. */
const TREK_ZOOM = 8

const TREK_SOUTH = 'urn:ogc:def:crs:IAU2000::30120'
const TREK_GLOBAL = 'urn:ogc:def:crs:EPSG::104903'
const QM_SOUTH = 27
const QM_CYL = 16

const HORIZONS_API = 'https://ssd.jpl.nasa.gov/api/horizons.api'
const STEP = '6 h'
const EYE_M = 1.75

export interface ToolSite {
  lat: number // planetocentric, south negative
  lon: number // east-positive
  elev_m: number | null // terrain height above the 1737.4 km sphere; null → 0, as the app does
}

export interface ToolLink {
  href: string | null // null: the tool opens, but not at the site (see note)
  note: string | null // shown next to the link when it does not open at the site, or why it is disabled
  view?: string // the map view the link opens in
}

export interface Span {
  startMs: number
  endMs: number
}

const DEG = Math.PI / 180

/** Longitude in [−180, 180). */
export function lon180(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180
}

/** Longitude in [0, 360), as Horizons wants it. */
export function lon360(lon: number): number {
  return ((lon % 360) + 360) % 360
}

/** Fixed decimals without trailing zeros (and never "-0"). */
function num(x: number, digits: number): string {
  const s = (Math.round(x * 10 ** digits) / 10 ** digits + 0).toFixed(digits)
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}

/** South polar stereographic metres, as both map tools use them. */
export function southPolarXY(lat: number, lon: number): [number, number] {
  const k = 2 * MOON_RADIUS_M * Math.tan(((90 + lat) / 2) * DEG)
  return [k * Math.sin(lon * DEG), k * Math.cos(lon * DEG)]
}

const typed = (s: ToolSite) => `${num(s.lat, 5)}, ${num(lon180(s.lon), 5)}`

export function moonTrekUrl(s: ToolSite): ToolLink {
  let x: string
  let y: string
  let crs: string
  if (s.lat < POLAR_LAT) {
    const [px, py] = southPolarXY(s.lat, s.lon)
    ;[x, y, crs] = [num(px, 1), num(py, 1), TREK_SOUTH]
  } else {
    ;[x, y, crs] = [num(lon180(s.lon), 5), num(s.lat, 5), TREK_GLOBAL]
  }
  // the parameters in the order Moon Trek writes them itself
  const hash = `v=0.1&x=${x}&y=${y}&z=${TREK_ZOOM}&p=${encodeURIComponent(crs)}&d=&locale=&b=moon&e=&sfz=&w=`
  return { href: `https://trek.nasa.gov/moon/#${hash}`, note: null, view: s.lat < POLAR_LAT ? 'south polar view' : 'global map' }
}

export function quickMapUrl(s: ToolSite): ToolLink {
  let cx: number
  let cy: number
  let proj: number
  if (s.lat < -QM_CYL_LIMIT) {
    // 75°–80° S as well: QuickMap's cylindrical view does not reach there, so the polar one is the only view that does
    ;[cx, cy] = southPolarXY(s.lat, s.lon)
    proj = QM_SOUTH
  } else if (s.lat < QM_CYL_LIMIT) {
    cx = MOON_RADIUS_M * lon180(s.lon) * DEG
    cy = MOON_RADIUS_M * s.lat * DEG
    proj = QM_CYL
  } else {
    // the north polar view's format was not checked in the tool: open QuickMap and say what to type
    return { href: 'https://quickmap.lroc.im-ldi.com/', note: `opens the tool; enter ${typed(s)}` }
  }
  const box = [cx - QM_HALF_M, cy - QM_HALF_M, cx + QM_HALF_M, cy + QM_HALF_M].map((v) => num(v, 1)).join(',')
  const view = proj === QM_SOUTH ? 'south polar view' : 'cylindrical map'
  return { href: `https://quickmap.lroc.im-ldi.com/?prjExtent=${encodeURIComponent(box)}&proj=${proj}`, note: null, view }
}

const pad = (n: number) => String(n).padStart(2, '0')
/** "YYYY-MM-DD HH:MM", UTC. */
export function horizonsTime(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** Every value quoted ('…') and URL-encoded, quotes included, as in the V1 links. */
const q = (v: string) => `%27${encodeURIComponent(v).replace(/'/g, '%27')}%27`

export type Target = 'sun' | 'earth'
const COMMAND: Record<Target, string> = { sun: '10', earth: '399' }

/** Why there is no Horizons link for these dates, or null when there is one. */
export function spanProblem(span: Span | null): string | null {
  if (!span || !Number.isFinite(span.startMs) || !Number.isFinite(span.endMs)) return 'No mission dates are set.'
  if (span.endMs - span.startMs < 60_000) return 'The mission period is shorter than a minute.'
  return null
}

export function horizonsUrl(s: ToolSite, span: Span | null, target: Target): ToolLink {
  const problem = spanProblem(span)
  if (problem || !span) return { href: null, note: problem }
  const altKm = ((s.elev_m ?? 0) + EYE_M) / 1000
  const start = Math.floor(span.startMs / 60_000) * 60_000
  const stop = Math.ceil(span.endMs / 60_000) * 60_000
  const params: [string, string][] = [
    ['format', 'text'],
    ['COMMAND', COMMAND[target]],
    ['OBJ_DATA', 'NO'],
    ['MAKE_EPHEM', 'YES'],
    ['EPHEM_TYPE', 'OBSERVER'],
    ['CENTER', 'coord@301'],
    ['COORD_TYPE', 'GEODETIC'],
    ['SITE_COORD', `${num(lon360(s.lon), 5)},${num(s.lat, 5)},${num(altKm, 5)}`],
    ['START_TIME', horizonsTime(start)],
    ['STOP_TIME', horizonsTime(stop)],
    ['STEP_SIZE', STEP],
    ['QUANTITIES', '4'],
    ['ANG_FORMAT', 'DEG'],
    ['EXTRA_PREC', 'YES'],
    ['TIME_DIGITS', 'MINUTES'],
    ['APPARENT', 'AIRLESS'],
  ]
  const query = params.map(([k, v]) => (k === 'format' ? `${k}=${v}` : `${k}=${q(v)}`)).join('&')
  return { href: `${HORIZONS_API}?${query}`, note: null }
}

export interface NasaLinks {
  moonTrek: ToolLink
  quickMap: ToolLink
  horizonsSun: ToolLink
  horizonsEarth: ToolLink
  polar: boolean // the map tools open in their south polar view
}

export function nasaLinks(s: ToolSite, span: Span | null): NasaLinks {
  return {
    moonTrek: moonTrekUrl(s),
    quickMap: quickMapUrl(s),
    horizonsSun: horizonsUrl(s, span, 'sun'),
    horizonsEarth: horizonsUrl(s, span, 'earth'),
    polar: s.lat < POLAR_LAT,
  }
}
