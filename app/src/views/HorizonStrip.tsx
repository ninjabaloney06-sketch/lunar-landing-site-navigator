// Horizon strip (build-plan §5.2): terrain mask over azimuth 0–360°, elevation −2…+10° (taller when the
// site's terrain mask rises above 9°, so a 32° crater wall is not flattened at 10°), with the Sun and
// Earth at the cursor. A body below the axis is pinned to the bottom edge as a hollow dot; its label keeps the true value. Exact values on hover or tap. Also the full fallback view when WebGL is unavailable.
// U7 (ninja, 14 Nov: "a line indicator which shows where the two dots will be"): each body's path over the mission
// period, from the series samples the app already computed, as a thin line in its colour; the part still to come is
// brighter than the part already passed. The line breaks where the azimuth wraps at north and where the body leaves
// the chart.
import { area, line, scaleLinear } from 'd3'
import { useEffect, useMemo, useRef, useState } from 'react'
import { maskAt } from '../geometry'
import type { Sample } from '../geometry'
import type { Horizon } from '../data/types'
import { fmtDeg } from './format'

const EL_MIN = -2
const EL_MAX_DEFAULT = 10

/** Top of the axis: 10°, or the terrain mask's maximum + 1° rounded up to the tick step. */
function axisTop(horizon: Horizon | null): { top: number; step: number } {
  const maxMask = horizon ? Math.max(...horizon.mask) : 0
  if (!(maxMask + 1 > EL_MAX_DEFAULT)) return { top: EL_MAX_DEFAULT, step: 2 }
  const step = maxMask + 1 <= 24 ? 4 : 8
  return { top: Math.ceil((maxMask + 1) / step) * step, step }
}
const AZ_TICKS: [number, string][] = [
  [0, 'N'],
  [90, 'E'],
  [180, 'S'],
  [270, 'W'],
  [360, 'N'],
]

interface Props {
  horizon: Horizon | null
  sample: Sample | null // Sun and Earth at the cursor; null while loading
  height: number
  className?: string
  track?: Sample[] | null // the series over the mission period; null or absent = no paths
}

/** SVG path of one body over the samples: pen up outside [elMin, elMax] and across the 360°/0° wrap. */
function trackPath(samples: Sample[], key: 'sun' | 'earth', x: (az: number) => number, y: (el: number) => number, elMax: number): string {
  let d = ''
  let pen = false
  let prevAz: number | null = null
  for (const s of samples) {
    const b = s[key]
    const wrap = prevAz !== null && Math.abs(b.az - prevAz) > 180
    prevAz = b.az
    if (b.el < EL_MIN || b.el > elMax) {
      pen = false
      continue
    }
    d += `${pen && !wrap ? 'L' : 'M'}${x(b.az).toFixed(1)},${y(b.el).toFixed(1)}`
    pen = true
  }
  return d
}

export function HorizonStrip({ horizon, sample, height, className, track }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hoverAz, setHoverAz] = useState<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const m = { l: 36, r: 8, t: 12, b: 24 }
  const x = useMemo(() => scaleLinear().domain([0, 360]).range([m.l, Math.max(m.l + 1, width - m.r)]), [width, m.l, m.r])
  const { top: elMax, step: tickStep } = useMemo(() => axisTop(horizon), [horizon])
  const y = useMemo(() => scaleLinear().domain([EL_MIN, elMax]).range([height - m.b, m.t]).clamp(true), [height, m.b, m.t, elMax])
  const ticks = useMemo(() => {
    const out: number[] = []
    for (let v = 0; v <= elMax; v += tickStep) out.push(v)
    return out
  }, [elMax, tickStep])

  const paths = useMemo(() => {
    const pts: [number, number][] = []
    for (let az = 0; az <= 360; az += 0.5) pts.push([az, maskAt(horizon, az)])
    const a = area<[number, number]>()
      .x((d) => x(d[0]))
      .y0(y(EL_MIN))
      .y1((d) => y(d[1]))
    const l = line<[number, number]>()
      .x((d) => x(d[0]))
      .y((d) => y(d[1]))
    return { fill: a(pts) ?? '', edge: l(pts) ?? '' }
  }, [horizon, x, y])

  // Split at the cursor (the cursor sample belongs to both parts, so they join).
  const cursorMs = sample?.utcMs ?? null
  const tracks = useMemo(() => {
    if (!track || track.length === 0) return []
    const past = cursorMs === null ? [] : track.filter((s) => s.utcMs <= cursorMs)
    const next = cursorMs === null ? track : track.filter((s) => s.utcMs >= cursorMs)
    return (['sun', 'earth'] as const).map((key) => ({
      key,
      past: trackPath(past, key, x, y, elMax),
      next: trackPath(next, key, x, y, elMax),
    }))
  }, [track, cursorMs, x, y, elMax])

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const az = x.invert(e.clientX - r.left)
    setHoverAz(Math.min(360, Math.max(0, az)))
  }

  const bodies = sample
    ? [
        { key: 'sun', name: 'Sun', az: sample.sun.az, el: sample.sun.el },
        { key: 'earth', name: 'Earth', az: sample.earth.az, el: sample.earth.el },
      ]
    : []

  // Hover: the terrain angle, how far away the blocking terrain is, and whether the search hit the DEM edge.
  const terrainAt = (az: number) => {
    const parts = [`terrain ${fmtDeg(maskAt(horizon, az), 2)}`]
    if (horizon) {
      const i = Math.round(az / horizon.az_step) % horizon.mask.length
      const d = horizon.mask_dist_km[i]
      if (Number.isFinite(d)) parts.push(`${d.toFixed(1)} km away`)
      if (horizon.truncated.includes(i * horizon.az_step)) parts.push(`terrain data ends before ${horizon.ray_max_km} km`)
    }
    return parts.join(', ')
  }
  // The elevations are on the chart labels (one rounding, one place); the caption adds the azimuths.
  const readout =
    hoverAz !== null
      ? `Azimuth ${hoverAz.toFixed(1)}° · ${terrainAt(hoverAz)}`
      : sample
        ? `Sun azimuth ${sample.sun.az.toFixed(1)}° · Earth azimuth ${sample.earth.az.toFixed(1)}°`
        : ''
  const spoken = sample
    ? `Sun azimuth ${sample.sun.az.toFixed(1)}°, elevation ${fmtDeg(sample.sun.el)}; Earth azimuth ${sample.earth.az.toFixed(1)}°, elevation ${fmtDeg(sample.earth.el)}`
    : ''

  // Labels: beside the dot, raised above the terrain line under them and above the other body's label, so
  // neither crosses the skyline or the other; a thin leader joins a raised label to its dot.
  const LINE_H = 17 // a label's height with a gap (12 px text)
  const TOP = m.t + 10 // highest baseline
  const labels: { x: number; y: number; right: boolean; raised: boolean; x0: number; x1: number }[] = []
  for (const b of bodies) {
    const cx = x(b.az)
    const cy = y(b.el)
    const w = (b.name.length + 1 + fmtDeg(b.el).length) * 7 // generous width estimate of "Earth −1.0°"
    const right = cx > width - 96
    const x0 = right ? cx - 8 - w : cx + 8
    const x1 = x0 + w
    let skyline = Infinity // smallest y (highest terrain) under the label
    for (let px = x0; px <= x1; px += 2) skyline = Math.min(skyline, y(maskAt(horizon, Math.min(360, Math.max(0, x.invert(px))))))
    const base = Math.max(TOP, Math.min(cy - 8, skyline - 4))
    const clear = (ly: number) => ly >= TOP && ly <= skyline - 4 && labels.every((o) => !(x0 < o.x1 && o.x0 < x1 && Math.abs(o.y - ly) < LINE_H))
    // the natural place, then above or below each placed label, then stacked under the top edge
    const tries = [base, ...labels.flatMap((o) => [o.y - LINE_H, o.y + LINE_H]), TOP, TOP + LINE_H]
    const ly = tries.find(clear) ?? base
    labels.push({ x: right ? cx - 8 : cx + 8, y: ly, right, raised: Math.abs(cy - 8 - ly) > 4, x0, x1 })
  }

  return (
    <figure className={`strip ${className ?? ''}`} data-testid="horizon-strip">
      <div ref={wrap} className="strip-plot">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Horizon by azimuth. ${hoverAz !== null ? readout : spoken}`}
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={() => setHoverAz(null)}
          >
            {ticks.map((v) => (
              <g key={v}>
                <line className={v === 0 ? 'strip-zero' : 'strip-grid'} x1={m.l} x2={width - m.r} y1={y(v)} y2={y(v)} />
                <text className="strip-tick" x={m.l - 6} y={y(v)} dy="0.32em" textAnchor="end">
                  {v}°
                </text>
              </g>
            ))}
            <path className="strip-terrain" d={paths.fill} />
            <path className="strip-edge" d={paths.edge} />
            {tracks.map((t) => (
              <g key={t.key} className={`strip-track strip-track-${t.key}`} data-testid={`strip-track-${t.key}`}>
                <path className="is-past" d={t.past} />
                <path className="is-next" d={t.next} />
              </g>
            ))}
            {AZ_TICKS.map(([az, lab]) => (
              <text key={az} className="strip-tick" x={x(az)} y={height - 6} textAnchor={az === 0 ? 'start' : az === 360 ? 'end' : 'middle'}>
                {width < 480 ? lab : `${lab} ${az}°`}
              </text>
            ))}
            {bodies.map((b, i) => {
              const cx = x(b.az)
              const cy = y(b.el)
              const l = labels[i]
              return (
                <g
                  key={b.key}
                  className={`strip-body strip-${b.key}${b.el < EL_MIN ? ' is-below' : ''}`}
                  data-testid={`strip-${b.key}`}
                >
                  {l.raised && <line className="strip-leader" x1={cx} y1={cy - 5} x2={l.right ? l.x + 4 : l.x - 4} y2={l.y - 4} />}
                  <circle cx={cx} cy={cy} r={4} />
                  <text x={l.x} y={l.y} textAnchor={l.right ? 'end' : 'start'}>
                    <tspan className="strip-body-name">{b.name}</tspan> <tspan className="strip-body-num">{fmtDeg(b.el)}</tspan>
                  </text>
                </g>
              )
            })}
            {hoverAz !== null && <line className="strip-guide" x1={x(hoverAz)} x2={x(hoverAz)} y1={m.t} y2={height - m.b} />}
          </svg>
        )}
      </div>
      <figcaption className="strip-readout">
        {readout || ' '}
        {!horizon && <span> · flat horizon, no terrain data</span>}
        {tracks.length > 0 && <span className="strip-track-note"> · lines: paths over the mission dates, brighter for the part still to come</span>}
      </figcaption>
    </figure>
  )
}
