// Site assessment section (add-on Task 1): one site's record of public/data/assessments.json → the strings the
// Details drawer shows. Pure; no React. Field names are those written by scripts/assessments.py.
//
// Rules: every value is the file's value with its unit and status. Nothing is recomputed, re-rounded or derived,
// except (a) slope degrees printed to the file's stated comparison precision (meta.thresholds.
// comparison_precision_deg = 0.01 → two decimals, the precision scripts/assessments.py rounds them to), (b) the
// compass point next to bearing_deg (16-point rose, from the file's own convention "bearing 0 = north,
// clockwise"), and (c) typography in the file's text: "<=" → "≤", "5 deg" → "5°", "km2" → "km²", and team
// members' names replaced by their role (on screen the repository writes "the science lead").
// A field that is missing, null or not a finite number shows as "unknown" (with the file's reason when it has one),
// never NaN or undefined.
//
// Layout (U17, wave 3): the section opens with a headline a planner reads in three lines: the landing-rule verdict
// with the rule beside it, the value that decides it (the landing disk's maximum slope; the rule is "every valid
// pixel slope in the disk <= 5.0 deg", so the maximum decides), and the line that the thresholds are project
// criteria. File names, pixel counts and status strings are Full data rows; source, method and limitations sit
// behind each block's disclosure. A long file text is cut at its first "; " in summary mode only (Row.fullValues /
// Note.fullText keep the whole text for Full data); nothing is reworded.

export const ASSESSMENT_STATUS = 'Validated by the science lead (statement of 15 Nov 2026; see record)'
export const NOT_COMPUTED = 'Not computed for this place'
export const NO_DATA = 'No site assessment data in this build.'
export const UNKNOWN = 'unknown'

export type Tone = 'pass' | 'fail' | null

export interface Row {
  label: string
  values: string[] // one per column (slope: landing disk, exploration disk); a single value spans all columns
  full?: boolean // shown in Full data mode only
  fullValues?: string[] // the whole text, shown instead of values in Full data mode
}

export interface Note {
  text: string
  links: string[]
  full?: boolean
  fullText?: string // the whole text, shown instead of text in Full data mode
}

export interface Block {
  id: 'slope' | 'roughness' | 'psr' | 'thermal'
  title: string
  message: string | null // set when the block has no values to show (not computed, unknown with reason)
  columns: string[] | null // table header after the label column; null = a two-column label/value table
  rows: Row[]
  verdict: { label: string; tone: Tone; rule: string } | null
  notes: Note[]
  source: string | null
  method: string | null
  limitations: string[]
  extra: string[] // further statements of the file about the block (map projection note, data terms)
}

/** The three lines at the top of the section. */
export interface Headline {
  verdict: string // "Fails" / "Passes" / "unknown: <reason>"
  tone: Tone
  rule: string // "every pixel slope in the 100 m radius landing disk ≤ 5.0°", or the file's own rule text
  decider: string | null // "Maximum slope in the landing disk: 8.73°"
  criteria: string | null // "The 5° and 20° slope thresholds are project criteria …"
}

export type AssessmentView =
  | { state: 'ready'; status: string; thresholds: string | null; headline: Headline; blocks: Block[] }
  | { state: 'not-computed'; blocks: Block[] }
  | { state: 'no-data'; message: string }

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const obj = (v: unknown): Obj | null => (isObj(v) ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const links = (v: unknown): string[] => (typeof v === 'string' ? [v] : strs(v))

/** Role names instead of team members' names, and the file's ASCII notation in print form. */
export function clean(s: string): string {
  const out = s
    .replace(/\bLeo \(S\)/g, 'the science lead')
    .replace(/\bOtto \(Q\)/g, 'the code checker')
    .replace(/\bLeo\b/g, 'the science lead')
    .replace(/\(ninja\)/g, '(set by the team)')
    .replace(/\bby ninja\b/g, 'by a team member')
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/(\d) ?deg\b/g, '$1°')
    .replace(/\bkm2\b/g, 'km²')
  // a sentence that now starts with "the science lead" ("Leo to confirm.")
  return out.replace(/(^|\. )the (science lead|code checker)/g, (_m, pre: string, role: string) => `${pre}The ${role}`)
}

const cleanOrNull = (v: unknown) => {
  const s = str(v)
  return s === null ? null : clean(s)
}

/** 16-point compass name of a bearing in degrees (0 = north, clockwise). */
export function compass(deg: number): string {
  const names = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return names[(((Math.round(deg / 22.5) % 16) + 16) % 16)]
}

const withUnit = (v: unknown, unit: string) => {
  const n = num(v)
  return n === null ? UNKNOWN : `${n}${unit}`
}

/** A file text up to its first "; " (the summary form of a long reason). */
export const firstClause = (s: string) => {
  const i = s.indexOf('; ')
  return i > 0 ? s.slice(0, i) : s
}

/** A radius in metres as the planner reads it: "100 m", "2 km" (exact thousands only; nothing is rounded). */
export const radius = (m: number) => (m >= 1000 && m % 1000 === 0 ? `${m / 1000} km` : `${m} m`)

/** "unknown — <the file's reason>" or "unknown". */
const unknownBecause = (reason: unknown) => {
  const r = cleanOrNull(reason)
  return r ? `${UNKNOWN}: ${r}` : UNKNOWN
}

const latLon = (lat: unknown, lon: unknown) => {
  const a = num(lat)
  const o = num(lon)
  if (a === null || o === null) return UNKNOWN
  return `${Math.abs(a)}° ${a < 0 ? 'S' : 'N'}, ${Math.abs(o)}° ${o < 0 ? 'W' : 'E'}`
}

function emptyBlock(id: Block['id'], title: string, message: string | null): Block {
  return { id, title, message, columns: null, rows: [], verdict: null, notes: [], source: null, method: null, limitations: [], extra: [] }
}

const TITLES: Record<Block['id'], string> = {
  slope: 'Slope',
  roughness: 'Roughness and obstacles',
  psr: 'Nearest permanent shadow',
  thermal: 'Temperature (Diviner)',
}

function described(b: Block, rec: Obj): Block {
  b.source = cleanOrNull(rec.source)
  b.method = cleanOrNull(rec.method)
  b.limitations = strs(rec.limitations).map(clean)
  return b
}

function statusRow(rec: Obj, statusValues: Obj | null): Row {
  const s = str(rec.status)
  const meaning = s && statusValues ? str(statusValues[s]) : null
  return { label: 'Status', values: [s ? (meaning ? `${s}: ${clean(meaning)}` : s) : UNKNOWN], full: true }
}

/** A slope in degrees at the file's stated precision (digits), or verbatim when the file states none. */
const slopeDeg = (v: unknown, digits: number | null) => {
  const n = num(v)
  return n === null ? UNKNOWN : `${digits === null ? String(n) : n.toFixed(digits)}°`
}

function slopeBlock(rec: Obj | null, digits: number | null, statusValues: Obj | null): Block {
  const b = emptyBlock('slope', TITLES.slope, null)
  if (!rec) return { ...b, message: unknownBecause('no slope record in the file') }
  described(b, rec)
  const deg = (v: unknown) => slopeDeg(v, digits)
  const land = obj(rec.landing_area)
  const expl = obj(rec.exploration_area)
  const head = (a: Obj | null, name: string) => {
    const r = a ? num(a.radius_m) : null
    return r === null ? name : `${name}, ${radius(r)} radius`
  }
  b.columns = [head(land, 'Landing disk'), head(expl, 'Exploration disk')]
  const cell = (a: Obj | null, f: (a: Obj) => string) => {
    if (!a) return UNKNOWN
    if (str(a.status) !== 'computed') return unknownBecause(a.reason)
    return f(a)
  }
  const row = (label: string, f: (a: Obj) => string, full = false): Row => ({ label, values: [cell(land, f), cell(expl, f)], full })
  const any = (a: Obj | null, f: (a: Obj) => string) => (a ? f(a) : UNKNOWN)
  b.rows = [
    row('Median slope', (a) => deg(a.median_slope_deg)),
    row('Maximum slope', (a) => deg(a.max_slope_deg)),
    row('Share of pixels ≤ 5°', (a) => withUnit(a.pct_le_5deg, ' %')),
    row('Share of pixels < 20°', (a) => withUnit(a.pct_lt_20deg, ' %')),
    { label: 'Elevation model', values: [land, expl].map((a) => any(a, (x) => `${str(x.dem_file) ?? UNKNOWN}, ${withUnit(x.dem_pixel_m, ' m')} per pixel`)), full: true },
    { label: 'Slope baseline', values: [land, expl].map((a) => any(a, (x) => withUnit(x.slope_baseline_m, ' m'))), full: true },
    { label: 'Pixels in the disk', values: [land, expl].map((a) => any(a, (x) => withUnit(x.n_pixels, ''))), full: true },
    { label: 'No data', values: [land, expl].map((a) => any(a, (x) => withUnit(x.nodata_pct, ' %'))), full: true },
    statusRow(rec, statusValues), // one value: spans both columns
  ]
  const pass = rec.landing_slope_pass
  b.verdict = {
    label: pass === true ? 'Passes' : pass === false ? 'Fails' : unknownBecause(rec.reason),
    tone: pass === true ? 'pass' : pass === false ? 'fail' : null,
    rule: cleanOrNull(rec.landing_rule) ?? UNKNOWN,
  }
  return b
}

function roughnessBlock(rec: Obj | null, statusValues: Obj | null): Block {
  const b = emptyBlock('roughness', TITLES.roughness, null)
  if (!rec) return { ...b, message: unknownBecause('no roughness record in the file') }
  described(b, rec)
  const computed = str(rec.status) === 'computed'
  const obstacles = str(rec.obstacles) ?? UNKNOWN
  const reason = cleanOrNull(rec.obstacles_reason)
  b.rows = [
    { label: 'RMS height', values: [computed ? withUnit(rec.rms_height_m, ' m') : unknownBecause(rec.reason)] },
    {
      label: 'Obstacles',
      values: [reason ? `${obstacles}: ${firstClause(reason)}` : obstacles],
      fullValues: [reason ? `${obstacles}: ${reason}` : obstacles],
    },
    { label: 'Measure', values: [cleanOrNull(rec.measure) ?? UNKNOWN], full: true },
    { label: 'Area radius', values: [withUnit(rec.area_radius_m, ' m')], full: true },
    { label: 'Detection limit', values: [withUnit(rec.detection_limit_m, ' m')], full: true },
    { label: 'Elevation model', values: [`${str(rec.dem_file) ?? UNKNOWN}, ${withUnit(rec.dem_pixel_m, ' m')} per pixel`], full: true },
    { label: 'No data', values: [withUnit(rec.nodata_pct, ' %')], full: true },
    statusRow(rec, statusValues),
  ]
  const hz = Array.isArray(rec.sourced_hazards) ? rec.sourced_hazards : []
  b.notes = hz.flatMap((h) => {
    const o = obj(h)
    const s = o ? cleanOrNull(o.statement) : null
    if (!o || !s) return []
    const d = num(o.distance_from_site_km)
    return [{ text: d === null ? s : `${s} (${d} km from the site)`, links: links(o.source_url), full: true }]
  })
  return b
}

function psrBlock(rec: Obj | null, digits: number | null, statusValues: Obj | null): Block {
  const b = emptyBlock('psr', TITLES.psr, null)
  if (!rec) return { ...b, message: unknownBecause('no shadow record in the file') }
  described(b, rec)
  const crs = cleanOrNull(rec.crs_note)
  if (crs) b.extra.push(`Map projection: ${crs}`)
  const c = obj(rec.nearest_cluster)
  if (str(rec.status) !== 'computed' || !c) {
    b.message = str(rec.status) === 'computed' ? cleanOrNull(rec.reason) ?? 'No cluster in the search area.' : unknownBecause(rec.reason)
    return b
  }
  const bearing = num(c.bearing_deg)
  const line = obj(c.straight_line)
  const lineOk = line !== null && str(line.status) === 'computed'
  const named = obj(c.named_psr)
  const areas = obj(rec.shadow_area_within_km2)
  b.rows = [
    { label: 'Distance', values: [withUnit(c.distance_km, ' km')] },
    { label: 'Bearing', values: [bearing === null ? cleanOrNull(c.distance_to) ?? UNKNOWN : `${compass(bearing)}, ${bearing}°`] },
    { label: 'Cluster area', values: [withUnit(c.cluster_area_km2, ' km²')] },
    {
      label: 'Straight line: maximum slope',
      values: [lineOk ? (num(line.max_slope_deg) === null ? unknownBecause(line.reason) : slopeDeg(line.max_slope_deg, digits)) : unknownBecause(line?.reason)],
    },
    {
      label: 'Straight line: share < 20°',
      values: [lineOk ? (num(line.pct_lt_20deg) === null ? unknownBecause(line.reason) : withUnit(line.pct_lt_20deg, ' %')) : unknownBecause(line?.reason)],
    },
    {
      label: 'Catalogue PSR',
      values: [named ? `${str(named.name) ?? UNKNOWN} (LROC PSR Atlas, ${withUnit(named.atlas_psr_area_km2, ' km²')})` : cleanOrNull(c.named_psr_reason) ?? 'none'],
      full: true,
    },
    { label: 'Measured to', values: [cleanOrNull(c.distance_to) ?? UNKNOWN], full: true },
    { label: 'Cluster point', values: [latLon(c.lat, c.lon)], full: true },
    { label: 'Line length', values: [line ? withUnit(line.length_km, ' km') : UNKNOWN], full: true },
    { label: 'Line samples', values: [line ? `${withUnit(line.n_samples, '')} on ${str(line.dem_file) ?? UNKNOWN}, baseline ${withUnit(line.slope_baseline_m, ' m')}` : UNKNOWN], full: true },
    { label: 'Average Sun visibility at the site pixel', values: [withUnit(rec.site_avg_sun_visibility, '')], full: true },
    {
      label: 'Shadow area within',
      values: [
        areas
          ? Object.entries(areas)
              .map(([k, v]) => `${k.replace(/km$/, ' km')}: ${withUnit(v, ' km²')}`)
              .join(' · ')
          : UNKNOWN,
      ],
      full: true,
    },
    { label: 'Map', values: [`${str(rec.map_file) ?? UNKNOWN}, ${withUnit(rec.map_pixel_m, ' m')} per pixel`], full: true },
    { label: 'Search', values: [`clusters ≥ ${withUnit(rec.min_cluster_area_km2, ' km²')} within ${withUnit(rec.search_radius_km, ' km')}`], full: true },
    statusRow(rec, statusValues),
  ]
  const label = line ? cleanOrNull(line.label) : null
  if (label) b.notes.push({ text: `Straight line: ${label}.`, links: [] })
  if (named) b.notes.push({ text: `Catalogue match: ${cleanOrNull(named.match_basis) ?? UNKNOWN}.`, links: links(named.source_url), full: true })
  return b
}

const kelvin = (unit: unknown) => (str(unit) === 'Kelvin' ? ' K' : str(unit) ? ` ${str(unit)}` : '')

function thermalBlock(rec: Obj | null, statusValues: Obj | null): Block {
  const b = emptyBlock('thermal', TITLES.thermal, null)
  if (!rec) return { ...b, message: unknownBecause('no temperature record in the file') }
  described(b, rec)
  const terms = cleanOrNull(rec.terms)
  if (terms) b.extra.push(`Terms: ${terms}`)
  const cols = obj(rec.columns)
  const avg = cols ? obj(cols.temp_avg) : null
  const max = cols ? obj(cols.temp_max) : null
  const ok = str(rec.status) === 'sourced' || str(rec.status) === 'computed'
  const temp = (v: unknown, col: Obj | null) => (!ok ? unknownBecause(rec.reason) : num(v) === null ? unknownBecause(rec.reason) : `${num(v)}${kelvin(col?.unit ?? 'Kelvin')}`)
  const land = obj(rec.landing_area)
  b.rows = [
    { label: 'Annual mean (2 cm depth)', values: [temp(rec.temp_avg_k, avg)] },
    { label: 'Annual maximum (surface)', values: [temp(rec.temp_max_k, max)] },
    { label: 'Annual minimum', values: [num(rec.annual_min_temp_k) === null ? unknownBecause(rec.annual_min_reason) : `${num(rec.annual_min_temp_k)} K`] },
    { label: 'Mean column', values: [avg ? cleanOrNull(avg.description) ?? UNKNOWN : UNKNOWN], full: true },
    { label: 'Maximum column', values: [max ? cleanOrNull(max.description) ?? UNKNOWN : UNKNOWN], full: true },
    { label: 'Match', values: [cleanOrNull(rec.match) ?? UNKNOWN], full: true },
    { label: 'Triangle area', values: [withUnit(rec.triangle_area_km2, ' km²')], full: true },
    { label: 'Site to triangle centre', values: [withUnit(rec.distance_to_triangle_centre_km, ' km')], full: true },
    { label: 'Landing disk', values: [land ? cleanOrNull(land.note) ?? `${withUnit(land.n_triangle_centres, '')} triangle centres` : UNKNOWN], full: true },
    statusRow(rec, statusValues),
  ]
  const near = Array.isArray(rec.nearby_sourced_values) ? rec.nearby_sourced_values : []
  b.notes = near.flatMap((v) => {
    const o = obj(v)
    if (!o) return []
    const value = cleanOrNull(o.value)
    const where = cleanOrNull(o.applies_to)
    const st = cleanOrNull(o.statement)
    if (!value && !st) return []
    const text = `Nearby sourced value: ${value ?? UNKNOWN}${where ? `, ${where}` : ''}.`
    return [{ text, fullText: `${text}${st ? ` ${st}.` : ''}`, links: links(o.source_url) }]
  })
  return b
}

/** The verdict with its rule, the value that decides it, and that the thresholds are project criteria. */
function headline(rec: Obj | null, slope: Block, th: Obj | null, digits: number | null): Headline {
  const v = slope.verdict
  const land = rec ? obj(rec.landing_area) : null
  const r = land ? num(land.radius_m) : null
  // "<= 5.0 passes" → "≤ 5.0°": the comparison and limit exactly as the file states them
  const lr = th ? cleanOrNull(th.landing_rule) : null
  const limit = lr ? /[≤<]\s*\d+(?:\.\d+)?/.exec(lr)?.[0] : undefined
  const rule =
    limit && r !== null ? `every valid pixel slope in the ${radius(r)} radius landing disk ${limit}°` : (v?.rule ?? UNKNOWN)
  let decider: string | null = null
  if (land) {
    decider =
      str(land.status) === 'computed'
        ? `Maximum slope in the landing disk: ${slopeDeg(land.max_slope_deg, digits)}`
        : `Maximum slope in the landing disk: ${unknownBecause(land.reason)}`
  }
  const lo = th ? num(th.landing_max_slope_deg) : null
  const hi = th ? num(th.exploration_max_slope_deg) : null
  const st = th ? cleanOrNull(th.status) : null
  const criteria = lo !== null && hi !== null && st ? `The ${lo}° and ${hi}° slope thresholds are ${st}.` : null
  return { verdict: v?.label ?? UNKNOWN, tone: v?.tone ?? null, rule, decider, criteria }
}

/** Every block says "Not computed for this place" (a custom site, or a site the file has no record for). */
export function notComputedView(): AssessmentView {
  const ids: Block['id'][] = ['slope', 'roughness', 'psr', 'thermal']
  return { state: 'not-computed', blocks: ids.map((id) => emptyBlock(id, TITLES[id], NOT_COMPUTED)) }
}

/** The section's content for one site id, from the parsed file. */
export function mapAssessment(file: unknown, siteId: string): AssessmentView {
  const root = obj(file)
  const sites = root ? obj(root.sites) : null
  if (!root || !sites) return { state: 'no-data', message: NO_DATA }
  const rec = obj(sites[siteId])
  if (!rec) return notComputedView()
  const meta = obj(root.meta)
  const th = meta ? obj(meta.thresholds) : null
  const statusValues = meta ? obj(meta.status_values) : null
  const prec = th ? num(th.comparison_precision_deg) : null
  const digits = prec !== null && prec > 0 && prec < 1 ? Math.round(-Math.log10(prec)) : null
  let thresholds: string | null = null
  if (th) {
    const lr = cleanOrNull(th.landing_rule)
    const er = cleanOrNull(th.exploration_rule)
    const st = cleanOrNull(th.status)
    const deg = (r: string) => r.replace(/(\d+(?:\.\d+)?) (passes|meets)/, '$1° $2')
    if (lr && er) thresholds = `Landing slope ${deg(lr)}; exploration slope ${deg(er)}${st ? `: ${st}` : ''}.`
  }
  const slope = slopeBlock(obj(rec.slope), digits, statusValues)
  return {
    state: 'ready',
    status: ASSESSMENT_STATUS,
    thresholds,
    headline: headline(obj(rec.slope), slope, th, digits),
    blocks: [
      slope,
      roughnessBlock(obj(rec.roughness), statusValues),
      psrBlock(obj(rec.psr), digits, statusValues),
      thermalBlock(obj(rec.thermal), statusValues),
    ],
  }
}

/** Abbreviations the three site sections (assessment, power, NASA tools) show, with their long form for <abbr>. */
export const TERMS: Record<string, string> = {
  RMS: 'root mean square',
  DEM: 'digital elevation model: the terrain height map',
  PSR: 'permanently shadowed region',
  LOLA: 'Lunar Orbiter Laser Altimeter (LRO)',
  LRO: 'Lunar Reconnaissance Orbiter',
  LROC: 'Lunar Reconnaissance Orbiter Camera',
  JPL: 'Jet Propulsion Laboratory (NASA)',
  UTC: 'Coordinated Universal Time',
  AU: 'astronomical unit, the mean Earth–Sun distance',
  'IM-2': 'Intuitive Machines’ second lunar landing mission',
  DE440: 'JPL planetary and lunar ephemeris DE440',
}

const TERM_RE = new RegExp(
  `(?<![A-Za-z0-9-])(${Object.keys(TERMS)
    .sort((a, b) => b.length - a.length)
    .join('|')})(?![A-Za-z0-9])`,
  'g',
)

/** A text split into plain parts and abbreviations (with their long form). */
export function termParts(s: string): ({ text: string } | { text: string; title: string })[] {
  const out: ({ text: string } | { text: string; title: string })[] = []
  let last = 0
  for (const m of s.matchAll(TERM_RE)) {
    const i = m.index ?? 0
    if (i > last) out.push({ text: s.slice(last, i) })
    out.push({ text: m[0], title: TERMS[m[0]] })
    last = i + m[0].length
  }
  if (last < s.length) out.push({ text: s.slice(last) })
  return out
}

export type TextPart = { text: string } | { text: string; href: string }

/** A source text split into plain parts and links (http(s) URLs and "doi:10.…"). */
export function linkParts(s: string): TextPart[] {
  const out: TextPart[] = []
  const re = /(https?:\/\/[^\s;,)]+[^\s;,.)]|doi:10\.[^\s;,)]+[^\s;,.)])/g
  let last = 0
  for (const m of s.matchAll(re)) {
    const i = m.index ?? 0
    if (i > last) out.push({ text: s.slice(last, i) })
    const t = m[0]
    out.push({ text: t, href: t.startsWith('doi:') ? `https://doi.org/${t.slice(4)}` : t })
    last = i + t.length
  }
  if (last < s.length) out.push({ text: s.slice(last) })
  return out
}
