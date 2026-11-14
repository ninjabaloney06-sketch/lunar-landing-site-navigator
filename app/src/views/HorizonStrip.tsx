// Horizon strip (build-plan §5.2): terrain mask over azimuth 0–360°, elevation −2…+10° (taller when the
// site's terrain mask rises above 9°, so a 32° crater wall is not flattened at 10°), with the Sun and
// Earth at the cursor. A body below the axis is pinned to the bottom edge as a hollow dot; its label keeps the true value. Exact values on hover or tap. Also the full fallback view when WebGL is unavailable.
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
}

export function HorizonStrip({ horizon, sample, height, className }: Props) {
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
  const readout =
    hoverAz !== null
      ? `Azimuth ${hoverAz.toFixed(1)}° · ${terrainAt(hoverAz)}`
      : sample
        ? `Sun az ${sample.sun.az.toFixed(1)}°, el ${fmtDeg(sample.sun.el, 2)} · Earth az ${sample.earth.az.toFixed(1)}°, el ${fmtDeg(sample.earth.el, 2)}`
        : ''

  return (
    <figure className={`strip ${className ?? ''}`} data-testid="horizon-strip">
      <div ref={wrap} className="strip-plot">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Horizon by azimuth. ${readout}`}
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
            {AZ_TICKS.map(([az, lab]) => (
              <text key={az} className="strip-tick" x={x(az)} y={height - 6} textAnchor={az === 0 ? 'start' : az === 360 ? 'end' : 'middle'}>
                {width < 480 ? lab : `${lab} ${az}°`}
              </text>
            ))}
            {bodies.map((b, i) => {
              const cx = x(b.az)
              const cy = y(b.el)
              const right = cx > width - 96
              // Sun and Earth close together: the second label goes below its dot so the two never overlap.
              const o = i > 0 ? bodies[0] : null
              const below = !!o && Math.abs(x(o.az) - cx) < 96 && Math.abs(y(o.el) - cy) < 24
              return (
                <g
                  key={b.key}
                  className={`strip-body strip-${b.key}${b.el < EL_MIN ? ' is-below' : ''}`}
                  data-testid={`strip-${b.key}`}
                >
                  <circle cx={cx} cy={cy} r={4} />
                  <text x={right ? cx - 8 : cx + 8} y={below ? cy + 16 : cy - 8} textAnchor={right ? 'end' : 'start'}>
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
      </figcaption>
    </figure>
  )
}
