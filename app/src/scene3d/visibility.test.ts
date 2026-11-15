// The sky follows the computed horizon: a body the site's mask hides is drawn hollow, a visible one as a disc.
import { Mesh, MeshBasicMaterial, Quaternion, RingGeometry, SphereGeometry, Vector3, type WebGLRenderer } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { Horizon } from '../data/types'
import { OBSERVER_HEIGHT_M, enuBasis, maskAt, siteVector } from '../geometry'
import { Sky } from './sky'
import { eyeVisibility } from './visibility'
import horizonJson from '../../public/data/horizons/connecting-ridge.json?raw'

const horizon = JSON.parse(horizonJson) as Horizon
const site = { lat: horizon.lat, lon: horizon.lon, elev_m: horizon.elev_m }
const SUN_KM = 1.496e8

/** A state with the Sun at (az, el) from the site's eye and Earth on the opposite side, 384400 km away. */
function stateAt(az: number, sunEl: number) {
  const eye = siteVector(site.lat, site.lon, ((site.elev_m ?? 0) + OBSERVER_HEIGHT_M) / 1000)
  const { east, north, up } = enuBasis(site.lat, site.lon)
  const dir = (a: number, e: number): [number, number, number] => {
    const r = (Math.PI / 180)
    const h = Math.cos(e * r)
    const c = [Math.sin(a * r) * h, Math.cos(a * r) * h, Math.sin(e * r)]
    return [0, 1, 2].map((i) => east[i] * c[0] + north[i] * c[1] + up[i] * c[2]) as [number, number, number]
  }
  const at = (d: [number, number, number], km: number) => [0, 1, 2].map((i) => eye[i] + d[i] * km) as [number, number, number]
  return {
    utcMs: 0,
    sun_km: at(dir(az, sunEl), SUN_KM),
    earth_km: at(dir(az + 180, -sunEl), 384_400),
    q_me_to_j2000: [0, 0, 0, 1] as [number, number, number, number],
    q_earth_to_me: [0, 0, 0, 1] as [number, number, number, number],
  }
}

describe('eyeVisibility: the number the answer sentence uses', () => {
  const az = 315.8 // 1 Sep 2027 00:00 UTC at Connecting Ridge: Sun at +1.1 deg, mask +2.5 deg
  const mask = maskAt(horizon, az)
  it('the mask there is above the Sun (the premise of the dark-time check)', () => expect(mask).toBeGreaterThan(2))
  it('Sun at +1.1 deg under a +2.5 deg mask: hidden', () => {
    const v = eyeVisibility(stateAt(az, 1.1), site, horizon)
    expect(v.sun.fraction).toBe(0)
    expect(v.sun.el).toBeCloseTo(1.1, 1)
    expect(v.sun.mask).toBeCloseTo(mask, 6)
  })
  it('Sun well above the mask: whole disc', () => expect(eyeVisibility(stateAt(az, mask + 2), site, horizon).sun.fraction).toBe(1))
  it('Sun centre on the mask: about half the disc', () => expect(eyeVisibility(stateAt(az, mask), site, horizon).sun.fraction).toBeCloseTo(0.5, 1))
  it('Sun centre a degree below a 0 deg mask but above the real mask here: visible (ridge site, mask below 0)', () => {
    const lowAz = 151.2 // 16 Aug 2027 00:00 UTC: Sun -0.15 deg, mask -1.8 deg
    expect(maskAt(horizon, lowAz)).toBeLessThan(-1)
    expect(eyeVisibility(stateAt(lowAz, -0.15), site, horizon).sun.fraction).toBe(1)
  })
})

describe('Sky: hollow outline for a body the mask hides', () => {
  // The glow texture is drawn on a canvas; node has none, so a stub is enough for the scene graph.
  vi.stubGlobal('document', {
    createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} }), width: 0, height: 0 }),
  })
  const sky = new Sky({} as never)
  const eye = new Vector3(...siteVector(site.lat, site.lon, ((site.elev_m ?? 0) + OBSERVER_HEIGHT_M) / 1000))
  sky.update(stateAt(315.8, 1.1), eye, new Quaternion())
  const renderer = { render: () => {} } as unknown as WebGLRenderer
  /** The visible meshes the sky draws, by geometry: discs are spheres (the Sun, Earth, the star sphere), outlines are rings. */
  const drawn = () => {
    sky.render(renderer)
    const out = { discs: 0, rings: 0 }
    sky.scene.traverse((o) => {
      const m = o as Mesh
      if (!m.isMesh || !m.visible) return
      if (m.geometry instanceof RingGeometry) out.rings++
      else if (m.geometry instanceof SphereGeometry && m.material instanceof MeshBasicMaterial && !m.material.map) out.discs++ // the Sun
    })
    return out
  }
  it('by default the Sun is a disc and there is no outline', () => {
    expect(drawn()).toEqual({ discs: 1, rings: 0 })
    expect(sky.isHollow('sun')).toBe(false)
  })
  it('hidden by the mask: the Sun disc is not drawn, its outline is', () => {
    sky.setBelowHorizon({ sun: true, earth: false })
    expect(sky.isHollow('sun')).toBe(true)
    expect(drawn()).toEqual({ discs: 0, rings: 1 })
  })
  it('both hidden: two outlines; visible again: back to the disc', () => {
    sky.setBelowHorizon({ sun: true, earth: true })
    expect(drawn().rings).toBe(2)
    sky.setBelowHorizon({ sun: false, earth: false })
    expect(drawn()).toEqual({ discs: 1, rings: 0 })
  })
})
