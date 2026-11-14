// Terrain mask for display (horizon strip, sample series). Uses Track A's geometry.maskAt once it exists;
// until then a plain linear interpolation of the horizon file, which the strip only draws, never counts.
import { maskAt } from '../geometry'
import type { Horizon } from './types'

const FLAT_DIP_DEG = -0.0813 // flat-sphere horizon dip for a 1.75 m observer (geometry contract)

export function isNotImplemented(e: unknown): boolean {
  return e instanceof Error && /not implemented yet/.test(e.message)
}

let contractReady: boolean | null = null

function interpolated(h: Horizon | null, az: number): number {
  if (!h || !h.mask.length) return FLAT_DIP_DEG
  const n = h.mask.length
  const x = (((az % 360) + 360) % 360) / h.az_step
  const i0 = Math.floor(x) % n
  const i1 = (i0 + 1) % n
  const f = x - Math.floor(x)
  return h.mask[i0] * (1 - f) + h.mask[i1] * f
}

export function displayMask(h: Horizon | null, az: number): number {
  if (contractReady !== false) {
    try {
      const v = maskAt(h, az)
      contractReady = true
      return v
    } catch (e) {
      if (!isNotImplemented(e)) throw e
      contractReady = false
    }
  }
  return interpolated(h, az)
}
