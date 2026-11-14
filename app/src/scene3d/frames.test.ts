// Proves the scene3d frame helpers against geometry/ (the only place with angle maths).
import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { azEl, enuBasis, siteVector } from '../geometry'
import { SPHERE_TO_BODY, azElOfEnu, displayRadius, enuDir, enuToMeQuat, latLonOf, v3 } from './frames'

describe('scene3d frames', () => {
  it('enuDir is the inverse of geometry.azEl at a polar site', () => {
    const lat = -89.7668
    const lon = -171.87
    const site = siteVector(lat, lon, 0)
    const enu = enuBasis(lat, lon)
    const q = enuToMeQuat(enu)
    for (const [az, el] of [
      [0, 0],
      [90, 0],
      [171.87, 1.21],
      [271.5, -0.4],
      [359.5, 12],
    ]) {
      const dMe = enuDir(az, el).applyQuaternion(q)
      const far = v3(site).addScaledVector(dMe, 1e6)
      const r = azEl([far.x, far.y, far.z], site, enu)
      expect(Math.abs(((r.az - az + 540) % 360) - 180)).toBeLessThan(1e-9)
      expect(r.el).toBeCloseTo(el, 9)
      const back = azElOfEnu(enuDir(az, el))
      expect(Math.abs(((back.az - az + 540) % 360) - 180)).toBeLessThan(1e-9)
      expect(back.el).toBeCloseTo(el, 9)
    }
  })

  it('ENU basis rotation maps east/north/up to geometry vectors', () => {
    const enu = enuBasis(-85.9948, -0.23578)
    const q = enuToMeQuat(enu)
    const e = new Vector3(1, 0, 0).applyQuaternion(q)
    const n = new Vector3(0, 1, 0).applyQuaternion(q)
    const u = new Vector3(0, 0, 1).applyQuaternion(q)
    expect(e.distanceTo(v3(enu.east))).toBeLessThan(1e-12)
    expect(n.distanceTo(v3(enu.north))).toBeLessThan(1e-12)
    expect(u.distanceTo(v3(enu.up))).toBeLessThan(1e-12)
  })

  it('latLonOf inverts geometry.siteVector', () => {
    for (const [lat, lon] of [
      [0, 0],
      [0, 90],
      [-89.7668, -171.87],
      [45, -120],
      [-10, 179.5],
    ]) {
      const r = latLonOf(v3(siteVector(lat, lon, 3)))
      expect(r.lat).toBeCloseTo(lat, 9)
      expect(r.lon).toBeCloseTo(lon, 9)
    }
  })

  it('sphere texture frame: u = 0.5 at +x (lon 0), u = 0.75 at +y (90° E), image top at +z', () => {
    // three's SphereGeometry: u = 0.5 → local +x, u = 0.75 → local −z, v top → local +y.
    expect(new Vector3(1, 0, 0).applyQuaternion(SPHERE_TO_BODY).distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-12)
    expect(new Vector3(0, 0, -1).applyQuaternion(SPHERE_TO_BODY).distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-12)
    expect(new Vector3(0, 1, 0).applyQuaternion(SPHERE_TO_BODY).distanceTo(new Vector3(0, 0, 1))).toBeLessThan(1e-12)
  })

  it('displayRadius scales about the observer: same angular radius (sin = r / dist) at the display distance', () => {
    const d = 1000
    for (const [r, D] of [
      [695_700, 1.496e8],
      [6371, 384_400],
    ]) {
      expect(displayRadius(d, r, D) / d).toBeCloseTo(r / D, 15)
    }
  })
})
