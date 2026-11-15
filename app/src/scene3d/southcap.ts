// The south polar cap of the globe as its own mesh (track-terrain, 14 Nov): replaces the part of the lat/lon sphere
// where its equirectangular colour map and normal map pinch into radial streaks.
//
// Layout: the cap rasters' south polar stereographic plane (data/southcap.ts: +x toward 90° E, +y toward
// longitude 0). Vertices sit on rings of constant projected radius around the pole (ring 0 = the pole itself)
// and on `sectors` meridians starting at longitude −180°, so with sectors a multiple of the globe sphere's 256
// width segments every rim vertex of a SphereGeometry cut at the same latitude coincides with a cap rim vertex.
//   position  MOON_ME km, as globe.ts: (1737.4 + h/1000) · unit(x, y), h = real relief of the 400 m cap base
//   normal    from the relief itself (finite differences of the surface), not from the mesh faces
//   uv        the cap texture's layout: u = 0.5 + x / (2·half), v = 0.5 + y / (2·half); no pole pinch
// Edge: within `blendKm` of the rim the vertex heights fade (smoothstep) to 0, so the rim lies exactly on the
// 1737.4 km sphere at the cap's northern latitude: no step against the globe. The normals keep the real relief
// all the way, so the shading does not flatten in that band. A lip ring straight below the rim (same directions,
// `lipDropKm` under the sphere) closes the sub-pixel cracks between the two meshes' rims; being vertical it can
// never show outside the rim.
//
// The globe's own sphere must end where the cap begins: globeWithoutCap() is three's SphereGeometry cut at the
// cap's latitude with the full sphere's texture coordinates (SphereGeometry alone would stretch the whole map
// over the remaining latitudes).
//
// No trigonometry here: directions come from geometry.siteVector, the projection from data/southcap.ts.

import { BufferAttribute, BufferGeometry, Ray, SphereGeometry, Vector3 } from 'three'
import { capUnitOfXY, capXY, capXYOfUnit } from '../data/southcap'
import { MOON_RADIUS_KM, siteVector } from '../geometry'
import { latLonOf } from './frames'

/** What the mesh needs from the cap data (data/southcap.ts SouthCap has exactly these). */
export interface CapSurface {
  /** Height (m above the 1737.4 km sphere) at projected metres; NaN where there is no data. */
  heightXY(x: number, y: number): number
  /** Half-width (m) of the square the cap texture covers. */
  halfWidthM: number
  /** Northern edge of the cap, degrees (−80). */
  northLat: number
}

export interface CapGeometryOptions {
  rings?: number // rings from the pole to the rim (default 256: 1.2 km apart)
  sectors?: number // meridians (default 768 = 3 × the globe sphere's 256 segments: 2.5 km apart at the rim)
  blendKm?: number // width of the band at the rim where heights fade to the sphere (default 30)
  lipDropKm?: number // how far below the rim the hidden lip ring sits (default 2)
  exaggeration?: number // vertical scale of the relief (default 1 = true scale)
}

export const CAP_GEOMETRY_DEFAULTS: Required<CapGeometryOptions> = { rings: 256, sectors: 768, blendKm: 30, lipDropKm: 2, exaggeration: 1 }

/** File in public/textures/ with the cap's colour in this layout (scripts/south_cap.py --texture). */
export const CAP_TEXTURE_FILE = 'cap_color_2k.webp'

/**
 * Cap surface as an indexed BufferGeometry (position, normal, uv) in MOON_ME km. Vertex order: the pole, then
 * ring 1 … ring `rings` (the rim) with `sectors` vertices each (sector j at longitude −180° + j · 360° / sectors),
 * then the lip ring. Triangles face outward.
 */
export function capGeometry(surface: CapSurface, options: CapGeometryOptions = {}): BufferGeometry {
  const o = { ...CAP_GEOMETRY_DEFAULTS, ...options }
  const rimRho = capXY(surface.northLat, 0)[1] // projected radius of the cap's edge (m)
  const blendM = o.blendKm * 1000
  const delta = Math.max(rimRho / o.rings, 400) // finite-difference step of the normals (m)
  const nVert = 1 + (o.rings + 1) * o.sectors
  const pos = new Float32Array(nVert * 3)
  const nor = new Float32Array(nVert * 3)
  const uv = new Float32Array(nVert * 2)

  const height = (x: number, y: number) => {
    const h = surface.heightXY(x, y)
    return Number.isNaN(h) ? 0 : h * o.exaggeration
  }
  /** Surface point (km) at projected metres with height h (m). */
  const at = (x: number, y: number, h: number, out: Vector3) => {
    const u = capUnitOfXY(x, y)
    return out.set(u[0], u[1], u[2]).multiplyScalar(MOON_RADIUS_KM + (h * o.exaggeration) / 1000)
  }
  /** Difference of the real-relief surface across ±delta along one projected axis. Where the data end on one
   *  side, that side takes the vertex's own height (or the other side's), so the edge is never read as a cliff. */
  const across = (x: number, y: number, dx: number, dy: number, out: Vector3) => {
    const hc = surface.heightXY(x, y)
    let hp = surface.heightXY(x + dx, y + dy)
    let hm = surface.heightXY(x - dx, y - dy)
    if (Number.isNaN(hp)) hp = Number.isNaN(hc) ? hm : hc
    if (Number.isNaN(hm)) hm = Number.isNaN(hc) ? hp : hc
    if (Number.isNaN(hp)) hp = hm = 0
    return out.subVectors(at(x + dx, y + dy, hp, c), at(x - dx, y - dy, hm, d))
  }
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const d = new Vector3()
  const put = (v: number, x: number, y: number, fade: number, dropKm: number) => {
    const u = capUnitOfXY(x, y)
    const h0 = height(x, y)
    const r = MOON_RADIUS_KM + (fade * h0) / 1000 - dropKm
    pos[v * 3] = u[0] * r
    pos[v * 3 + 1] = u[1] * r
    pos[v * 3 + 2] = u[2] * r
    // ∂P/∂x × ∂P/∂y points outward: at the pole +x is body +y and +y is body +x, and y × x = −z.
    across(x, y, delta, 0, a)
    across(x, y, 0, delta, b)
    a.cross(b).normalize()
    nor[v * 3] = a.x
    nor[v * 3 + 1] = a.y
    nor[v * 3 + 2] = a.z
    uv[v * 2] = 0.5 + x / (2 * surface.halfWidthM)
    uv[v * 2 + 1] = 0.5 + y / (2 * surface.halfWidthM)
  }

  put(0, 0, 0, 1, 0)
  // Meridian directions in the projected plane: longitude lon lies along (x, y) = (sin lon, cos lon), which are the
  // y and x components of the equatorial unit vector geometry.siteVector(0, lon) / R.
  const dirX = new Float64Array(o.sectors)
  const dirY = new Float64Array(o.sectors)
  for (let j = 0; j < o.sectors; j++) {
    const e = siteVector(0, -180 + (j * 360) / o.sectors, 0)
    dirX[j] = e[1] / MOON_RADIUS_KM
    dirY[j] = e[0] / MOON_RADIUS_KM
  }
  for (let i = 1; i <= o.rings + 1; i++) {
    const lip = i === o.rings + 1
    const rho = lip ? rimRho : (rimRho * i) / o.rings
    const t = Math.min(Math.max((rimRho - rho) / blendM, 0), 1)
    const fade = i === o.rings ? 0 : t * t * (3 - 2 * t)
    for (let j = 0; j < o.sectors; j++) put(1 + (i - 1) * o.sectors + j, rho * dirX[j], rho * dirY[j], lip ? 0 : fade, lip ? o.lipDropKm : 0)
  }

  // Longitude grows with j, i.e. counter-clockwise seen from the north and clockwise seen from below the south
  // pole (outside): outward-facing triangles run pole → j+1 → j and, per quad, inner j → inner j+1 → outer j.
  const idx = new Uint32Array((o.sectors + 2 * o.sectors * o.rings) * 3)
  let k = 0
  const ring = (i: number, j: number) => 1 + (i - 1) * o.sectors + (j % o.sectors)
  for (let j = 0; j < o.sectors; j++) {
    idx[k++] = 0
    idx[k++] = ring(1, j + 1)
    idx[k++] = ring(1, j)
  }
  for (let i = 1; i <= o.rings; i++) {
    for (let j = 0; j < o.sectors; j++) {
      idx[k++] = ring(i, j)
      idx[k++] = ring(i, j + 1)
      idx[k++] = ring(i + 1, j)
      idx[k++] = ring(i, j + 1)
      idx[k++] = ring(i + 1, j + 1)
      idx[k++] = ring(i + 1, j)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('normal', new BufferAttribute(nor, 3))
  geo.setAttribute('uv', new BufferAttribute(uv, 2))
  geo.setIndex(new BufferAttribute(idx, 1))
  geo.computeBoundingSphere()
  return geo
}

/**
 * The globe's sphere without the cap: three's SphereGeometry from the north pole down to `northLat`, its last
 * ring exactly on the cap's rim, with the texture coordinates of the full sphere (v = 0 stays the south pole of
 * the map, so the equirectangular colour and normal maps keep their place). Orient it like the full sphere
 * (frames.SPHERE_TO_BODY); its rim vertices then sit at longitudes −180° + k · 360° / widthSegments.
 */
export function globeWithoutCap(radiusKm: number, widthSegments: number, heightSegments: number, northLat: number): SphereGeometry {
  const kept = (90 - northLat) / 180 // share of the pole-to-pole arc that remains
  const geo = new SphereGeometry(radiusKm, widthSegments, heightSegments, 0, 2 * Math.PI, 0, kept * Math.PI)
  const uv = geo.getAttribute('uv')
  for (let v = 0; v < uv.count; v++) uv.setY(v, 1 - (1 - uv.getY(v)) * kept)
  uv.needsUpdate = true
  return geo
}

/**
 * Width of the band inside the rim over which the shading goes from the sphere's normal map to the real relief,
 * km. Wider than the height fade (30 km): the relief shades darker than the normal map under a high Sun (measured
 * at 80.5–81.5° S on the sunward meridian, 20 Aug 2027 07:30 UTC: 110 against 123 of 255), and a change of that
 * size over 30 km read as a ring; over 120 km (80° S to about 84° S) it does not.
 */
export const RIM_SHADING_KM = 120

/** A sample of an equirectangular normal map at texture coordinates (u, v): the decoded vector, components −1 … 1. */
export type NormalSampler = (u: number, v: number) => [number, number, number]

/**
 * Shading at the rim as on the sphere beside it (wave 3). Within `bandKm` of the rim (the heights fade to the sphere
 * within the first `blendKm`), the cap's normals fade (smoothstep) into the normal the globe's sphere has there with its
 * equirectangular normal map (map u = 0.5 + lon / 360, v = (lat + 90) / 180). three's tangent frame without a
 * tangent attribute (normalmap_pars_fragment.glsl getTangentFrame) is the surface gradients of u (east) and
 * v (north) scaled together so that the longer one is 1: east × min(1, 1 / (2 cos φ)) and north × min(1, 2 cos φ),
 * where cos φ is the horizontal length of the unit position (no angles). At the rim the cap is shaded like the
 * sphere, so the 80° S circle does not show as a ring; inward the real relief takes over. The lip copies the rim.
 */
export function matchRimNormals(geo: BufferGeometry, northLat: number, sample: NormalSampler, bandKm = RIM_SHADING_KM, options: CapGeometryOptions = {}) {
  const o = { ...CAP_GEOMETRY_DEFAULTS, ...options }
  const rimRho = capXY(northLat, 0)[1]
  const blendM = bandKm * 1000
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')
  const u = new Vector3()
  const n = new Vector3()
  const m = new Vector3()
  for (let i = o.rings; i >= 1; i--) {
    const t = Math.min(Math.max((rimRho - (rimRho * i) / o.rings) / blendM, 0), 1)
    if (t >= 1) break
    const w = t * t * (3 - 2 * t)
    for (let j = 0; j < o.sectors; j++) {
      const v = capVertex(i, j, o.sectors)
      u.fromBufferAttribute(pos, v).normalize()
      const c = Math.hypot(u.x, u.y)
      const [mx, my, mz] = sample(j / o.sectors, (latLonOf(u).lat + 90) / 180)
      const te = Math.min(1, 1 / (2 * c)) / c // east = (−u_y, u_x, 0) / c
      const tn = Math.min(1, 2 * c) / c // north = (−u_x u_z, −u_y u_z, c²) / c
      m.set(-u.y * te * mx - u.x * u.z * tn * my + u.x * mz, u.x * te * mx - u.y * u.z * tn * my + u.y * mz, c * c * tn * my + u.z * mz).normalize()
      n.fromBufferAttribute(nor, v).sub(m).multiplyScalar(w).add(m).normalize()
      nor.setXYZ(v, n.x, n.y, n.z)
      if (i === o.rings) nor.setXYZ(capVertex(o.rings + 1, j, o.sectors), n.x, n.y, n.z)
    }
  }
  nor.needsUpdate = true
}

/** Vertex index of ring i (1 … rings = the rim; rings + 1 = the lip), sector j, in capGeometry's order. */
export const capVertex = (i: number, j: number, sectors = CAP_GEOMETRY_DEFAULTS.sectors) => 1 + (i - 1) * sectors + j

/**
 * The point of a capGeometry() mesh (built with the same northLat and options) on the radial line along the unit
 * MOON_ME direction u: where a pin's foot stands on the relief as drawn, between the mesh's own vertices. Finds the
 * mesh quad from u's projected radius (ring) and longitude (sector) and intersects the ray with its two triangles,
 * then with the neighbouring quads (a chord between two vertices of a ring runs inside the ring's circle). null
 * outside the cap.
 */
export function capSurfacePoint(geo: BufferGeometry, northLat: number, u: Vector3, options: CapGeometryOptions = {}): Vector3 | null {
  const o = { ...CAP_GEOMETRY_DEFAULTS, ...options }
  const [x, y] = capXYOfUnit(u.x, u.y, u.z)
  const rimRho = capXY(northLat, 0)[1]
  const fi = (Math.hypot(x, y) / rimRho) * o.rings
  if (fi > o.rings * (1 + 1e-9)) return null // the edge itself counts (rounding)
  const i0 = Math.min(Math.floor(fi), o.rings - 1)
  const j0 = Math.floor(((latLonOf(u).lon + 180) / 360) * o.sectors)
  const pos = geo.getAttribute('position')
  const ray = new Ray(u.clone().multiplyScalar(MOON_RADIUS_KM + 50), u.clone().negate())
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const hit = new Vector3()
  const vert = (i: number, j: number, out: Vector3) => out.fromBufferAttribute(pos, i === 0 ? 0 : capVertex(i, ((j % o.sectors) + o.sectors) % o.sectors, o.sectors))
  const tri = (p: [number, number], q: [number, number], r: [number, number]) =>
    ray.intersectTriangle(vert(...p, a), vert(...q, b), vert(...r, c), false, hit) !== null
  // Quad (i, j) lies between rings i and i + 1 (ring 0 = the pole) and sectors j and j + 1.
  const quad = (i: number, j: number) =>
    i < 0 || i >= o.rings
      ? false
      : i === 0
        ? tri([0, 0], [1, j + 1], [1, j])
        : tri([i, j], [i, j + 1], [i + 1, j]) || tri([i, j + 1], [i + 1, j + 1], [i + 1, j])
  for (const [di, dj] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    if (quad(i0 + di, j0 + dj)) return hit.clone()
  }
  // Exactly on the rim (the ray grazes a Float32 vertex from outside): the nearest vertex's radius.
  const lonF = ((latLonOf(u).lon + 180) / 360) * o.sectors
  return u.clone().multiplyScalar(vert(Math.min(Math.round(fi), o.rings), Math.round(lonF), a).length())
}
