// Frame helpers for scene3d. No trigonometry here: every angle → vector or vector → angle conversion goes
// through geometry/ (siteVector, azEl), whose conventions Track A tests (T4/T9). frames.test.ts proves the
// round trips below against geometry.azEl.

import { Matrix4, Quaternion, Vector3 } from 'three'
import type { Vec3 } from '../data/types'
import { azEl, siteVector, type Enu } from '../geometry'

export { EARTH_RADIUS_KM, SUN_RADIUS_KM } from '../geometry' // one source for the disc radii (Track A)

export const v3 = (a: Vec3) => new Vector3(a[0], a[1], a[2])
export const arr = (v: Vector3): Vec3 => [v.x, v.y, v.z]

/**
 * Unit vector in local ENU (x east, y north, z up) for azimuth az (0 = north, clockwise) and elevation el,
 * in degrees. geometry.siteVector(lat, lon) = r·(cos lat cos lon, cos lat sin lon, sin lat); with lat = el and
 * lon = 90 − az that is r·(cos el sin az, cos el cos az, sin el), which is exactly the ENU direction.
 * Inverse of geometry.azEl (tested). Request to Track A: export this as geometry.dirFromAzEl.
 */
export function enuDir(azDeg: number, elDeg: number): Vector3 {
  return v3(siteVector(elDeg, 90 - azDeg, 0)).normalize()
}

/** Azimuth/elevation (degrees) of an ENU direction, via geometry.azEl with the identity basis. */
const ENU_IDENTITY: Enu = { east: [1, 0, 0], north: [0, 1, 0], up: [0, 0, 1] }
export function azElOfEnu(d: Vector3): { az: number; el: number } {
  const a = azEl([d.x, d.y, d.z], [0, 0, 0], ENU_IDENTITY)
  return { az: a.az, el: a.el }
}

/**
 * Planetocentric lat/lon (degrees, east-positive, lon in (−180, 180]) of a MOON_ME vector, via geometry.azEl:
 * with the basis east = +y, north = +x, up = +z, azEl's elevation is the latitude and its azimuth the east
 * longitude. Request to Track A: export this as geometry.latLonOf.
 */
const EQUATOR_BASIS: Enu = { east: [0, 1, 0], north: [1, 0, 0], up: [0, 0, 1] }
export function latLonOf(p: Vector3): { lat: number; lon: number } {
  const a = azEl([p.x, p.y, p.z], [0, 0, 0], EQUATOR_BASIS)
  return { lat: a.el, lon: a.az > 180 ? a.az - 360 : a.az }
}

/** Rotation ENU → MOON_ME (columns east, north, up). The only matrix scene3d builds. */
export function enuToMeQuat(enu: Enu): Quaternion {
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(v3(enu.east), v3(enu.north), v3(enu.up)))
}

/**
 * SphereGeometry → body-fixed frame. three's SphereGeometry puts texture u = 0.5 at local +x and the image top
 * at local +y, with u growing toward local −z. An equirectangular map with longitude 0 at the image centre
 * (build-plan §5.4) therefore needs local +x → body +x, local +y → body +z (north), local −z → body +y (90° E).
 */
export const SPHERE_TO_BODY = new Quaternion().setFromRotationMatrix(
  new Matrix4().makeBasis(new Vector3(1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, -1, 0)),
)

/**
 * Radius that gives a sphere of true radius r at true distance dist the same angular size when its centre is
 * drawn at display distance d: scaling the whole configuration about the observer by d/dist keeps every angle,
 * so the radius is d·r/dist (exact for a sphere; the brief's d·tan(asin(r/dist)) is the flat-disc form and
 * differs by < 3e-6° for the Sun and Earth).
 */
export function displayRadius(d: number, rKm: number, distKm: number): number {
  return (d * rKm) / distKm
}

/** Quaternion (x, y, z, w) from the ephemeris as a three.js Quaternion (active rotation source → target). */
export const quat = (q: [number, number, number, number]) => new Quaternion(q[0], q[1], q[2], q[3])
