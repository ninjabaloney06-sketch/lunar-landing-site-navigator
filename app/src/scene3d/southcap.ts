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
// all the way, so the shading does not flatten in that band. A lip ring just outside the rim sits below the
// sphere and only closes sub-pixel cracks between the two meshes' rims.
//
// No trigonometry here: directions come from geometry.siteVector, the projection from data/southcap.ts.

import { BufferAttribute, BufferGeometry, Vector3 } from 'three'
import { capUnitOfXY, capXY } from '../data/southcap'
import { MOON_RADIUS_KM, siteVector } from '../geometry'

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
  lipKm?: number // how far the hidden lip reaches beyond the rim (default 12)
  lipDropKm?: number // how far below the sphere the lip's outer edge sits (default 1)
  exaggeration?: number // vertical scale of the relief (default 1 = true scale)
}

export const CAP_GEOMETRY_DEFAULTS: Required<CapGeometryOptions> = { rings: 256, sectors: 768, blendKm: 30, lipKm: 12, lipDropKm: 1, exaggeration: 1 }

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
  /** Surface point with the real relief (km). */
  const real = (x: number, y: number, out: Vector3) => {
    const u = capUnitOfXY(x, y)
    return out.set(u[0], u[1], u[2]).multiplyScalar(MOON_RADIUS_KM + height(x, y) / 1000)
  }
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const d = new Vector3()
  const put = (v: number, x: number, y: number, fade: number, dropKm: number) => {
    const u = capUnitOfXY(x, y)
    const r = MOON_RADIUS_KM + (fade * height(x, y)) / 1000 - dropKm
    pos[v * 3] = u[0] * r
    pos[v * 3 + 1] = u[1] * r
    pos[v * 3 + 2] = u[2] * r
    // ∂P/∂x × ∂P/∂y points outward: at the pole +x is body +y and +y is body +x, and y × x = −z.
    a.subVectors(real(x + delta, y, c), real(x - delta, y, d))
    b.subVectors(real(x, y + delta, c), real(x, y - delta, d))
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
    const rho = lip ? rimRho + o.lipKm * 1000 : (rimRho * i) / o.rings
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

/** Vertex index of ring i (1 … rings = the rim; rings + 1 = the lip), sector j, in capGeometry's order. */
export const capVertex = (i: number, j: number, sectors = CAP_GEOMETRY_DEFAULTS.sectors) => 1 + (i - 1) * sectors + j
