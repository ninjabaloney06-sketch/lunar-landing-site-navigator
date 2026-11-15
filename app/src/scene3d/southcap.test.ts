// Cap mesh for the globe (southcap.ts): synthetic surfaces with known heights, then the shipped base raster.
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import { type CapIo, type SouthCap, capXY, openCap } from '../data/southcap'
import { MOON_RADIUS_KM, siteVector } from '../geometry'
import { SPHERE_TO_BODY, latLonOf } from './frames'
import { CAP_GEOMETRY_DEFAULTS, type CapSurface, capGeometry, capSurfacePoint, capVertex, globeWithoutCap, matchRimNormals } from './southcap'
import source from './southcap.ts?raw'

const HALF = 304_000
const flat = (h: number): CapSurface => ({ heightXY: () => h, halfWidthM: HALF, northLat: -80 })
const small = { rings: 32, sectors: 256 }
const vec = (g: ReturnType<typeof capGeometry>, name: 'position' | 'normal', v: number) => new Vector3().fromBufferAttribute(g.getAttribute(name), v)

describe('capGeometry on synthetic surfaces', () => {
  it('pole vertex: at 1737.4 km + height, straight down the −z axis, uv at the texture centre', () => {
    const g = capGeometry(flat(2000), small)
    const p = vec(g, 'position', 0)
    expect(p.length()).toBeCloseTo(MOON_RADIUS_KM + 2, 4)
    expect(p.x).toBeCloseTo(0, 6)
    expect(p.y).toBeCloseTo(0, 6)
    expect(p.z).toBeLessThan(0)
    expect(g.getAttribute('uv').getX(0)).toBe(0.5)
    expect(g.getAttribute('uv').getY(0)).toBe(0.5)
  })

  it('rim vertices: on the 1737.4 km sphere at 80° S, at the longitudes of the globe sphere’s segments', () => {
    const g = capGeometry(flat(2000), small)
    for (const j of [0, 1, 64, 128, 200, 255]) {
      const p = vec(g, 'position', capVertex(small.rings, j, small.sectors))
      expect(p.length()).toBeCloseTo(MOON_RADIUS_KM, 3) // the relief has faded to the sphere: no step
      const { lat, lon } = latLonOf(p)
      expect(lat).toBeCloseTo(-80, 4)
      const want = -180 + (j * 360) / small.sectors
      expect(Math.abs(((lon - want + 540) % 360) - 180)).toBeLessThan(1e-4)
      // the same point from geometry.siteVector
      const s = siteVector(-80, want, 0)
      expect(p.distanceTo(new Vector3(s[0], s[1], s[2]))).toBeLessThan(1e-3)
    }
  })

  it('heights are real up to the blend band and fade inside it; the lip sits straight below the rim', () => {
    const g = capGeometry(flat(2000), { ...small, blendKm: 30 })
    const rimRho = capXY(-80, 0)[1]
    for (let i = 1; i <= small.rings; i++) {
      const r = vec(g, 'position', capVertex(i, 7, small.sectors)).length()
      const inside = rimRho - (rimRho * i) / small.rings
      if (inside >= 30_000) expect(r).toBeCloseTo(MOON_RADIUS_KM + 2, 3) // Float32 km: 0.1 m steps
      else expect(r).toBeLessThan(MOON_RADIUS_KM + 2)
      expect(r).toBeGreaterThanOrEqual(MOON_RADIUS_KM - 1e-3)
    }
    // the lip: straight below the rim vertex, never outside the rim
    const lip = vec(g, 'position', capVertex(small.rings + 1, 7, small.sectors))
    const rim = vec(g, 'position', capVertex(small.rings, 7, small.sectors))
    expect(lip.length()).toBeCloseTo(MOON_RADIUS_KM - CAP_GEOMETRY_DEFAULTS.lipDropKm, 3)
    expect(lip.clone().normalize().distanceTo(rim.clone().normalize())).toBeLessThan(1e-6)
  })

  it('uv follows the cap texture layout: +y (longitude 0) up, +x (90° E) right', () => {
    const g = capGeometry(flat(0), small)
    const uvOf = (j: number) => {
      const v = capVertex(small.rings, j, small.sectors)
      return [g.getAttribute('uv').getX(v), g.getAttribute('uv').getY(v)]
    }
    const rim = capXY(-80, 0)[1] / (2 * HALF)
    const close = (got: number[], u: number, v: number) => {
      expect(got[0]).toBeCloseTo(u, 5)
      expect(got[1]).toBeCloseTo(v, 5)
    }
    close(uvOf(128), 0.5, 0.5 + rim) // longitude 0
    close(uvOf(192), 0.5 + rim, 0.5) // 90° E
    close(uvOf(0), 0.5, 0.5 - rim) // 180°
    close(uvOf(64), 0.5 - rim, 0.5) // 90° W
    expect(rim).toBeCloseTo(0.5, 3) // the 80° S circle touches the texture's edges
  })

  it('normals: radial on a level surface, tilted away from the uphill side on a slope, also in the blend band', () => {
    const level = capGeometry(flat(1500), small)
    for (const v of [0, capVertex(10, 3, small.sectors), capVertex(small.rings, 100, small.sectors)]) {
      expect(vec(level, 'normal', v).dot(vec(level, 'position', v).normalize())).toBeCloseTo(1, 6)
    }
    // Height rising 0.1 m per metre toward +x (90° E): the normal leans toward −x, i.e. body −y near the pole.
    const slope = capGeometry({ heightXY: (x) => 0.1 * x, halfWidthM: HALF, northLat: -80 }, small)
    const n = vec(slope, 'normal', 0)
    expect(n.y / -n.z).toBeCloseTo(-0.1, 2)
    expect(Math.abs(n.x)).toBeLessThan(1e-6)
    // At the rim the position is on the sphere but the normal still shows the slope (shading does not flatten).
    const rim = capVertex(small.rings, 128, small.sectors) // longitude 0: +x is east there
    const nr = vec(slope, 'normal', rim)
    expect(nr.dot(new Vector3(0, 1, 0))).toBeLessThan(-0.09)
  })

  it('every triangle faces outward and the mesh is closed around the pole', () => {
    const g = capGeometry(flat(800), small)
    const idx = g.getIndex()
    expect(idx).not.toBeNull()
    if (!idx) return
    expect(idx.count).toBe((small.sectors + 2 * small.sectors * small.rings) * 3)
    expect(g.getAttribute('position').count).toBe(1 + (small.rings + 1) * small.sectors)
    const ab = new Vector3()
    const ac = new Vector3()
    const lipStart = idx.count - 2 * small.sectors * 3 // the lip's wall is vertical: it has no outward side
    for (let t = 0; t < lipStart; t += 3) {
      const a = vec(g, 'position', idx.getX(t))
      const b = vec(g, 'position', idx.getX(t + 1))
      const c = vec(g, 'position', idx.getX(t + 2))
      const out = ab.subVectors(b, a).cross(ac.subVectors(c, a)).dot(a.add(b).add(c))
      expect(out).toBeGreaterThan(0)
    }
  })

  it('where the data end next to a vertex, its normal does not see a cliff', () => {
    // 3 km high everywhere the square has data, nothing outside it: the rim vertices on the axes touch the edge.
    const g = capGeometry({ heightXY: (x, y) => (Math.max(Math.abs(x), Math.abs(y)) < HALF - 200 ? 3000 : NaN), halfWidthM: HALF, northLat: -80 }, small)
    for (const j of [0, 64, 128, 192]) {
      const v = capVertex(small.rings, j, small.sectors)
      expect(vec(g, 'normal', v).dot(vec(g, 'position', v).normalize())).toBeGreaterThan(0.999)
    }
  })

  it('a missing height (NaN) is drawn on the sphere, not as a spike', () => {
    const g = capGeometry({ heightXY: () => NaN, halfWidthM: HALF, northLat: -80 }, small)
    expect(vec(g, 'position', capVertex(5, 5, small.sectors)).length()).toBeCloseTo(MOON_RADIUS_KM, 4)
  })

  it('globeWithoutCap: last ring on the cap rim at the cap’s rim longitudes, texture coordinates of the full sphere', () => {
    const g = globeWithoutCap(MOON_RADIUS_KM, 256, 128, -80)
    const pos = g.getAttribute('position')
    const uv = g.getAttribute('uv')
    const cap = capGeometry(flat(0), small) // 256 sectors, as the sphere's segments
    const q = SPHERE_TO_BODY
    const first = 128 * 257 // row 128 of 129, 257 vertices per row
    for (const k of [0, 1, 77, 128, 255]) {
      const p = new Vector3().fromBufferAttribute(pos, first + k).applyQuaternion(q)
      expect(latLonOf(p).lat).toBeCloseTo(-80, 4)
      expect(p.distanceTo(vec(cap, 'position', capVertex(small.rings, k, small.sectors)))).toBeLessThan(1e-3)
      expect(uv.getY(first + k)).toBeCloseTo(10 / 180, 6) // 80 S in a pole-to-pole map
      expect(uv.getX(first + k)).toBeCloseTo(k / 256, 6)
    }
    expect(uv.getY(64 * 257)).toBeCloseTo(1 - 85 / 180, 6) // ring 64 of 128 over 170 deg = colatitude 85 deg
    expect(uv.getY(0)).toBe(1)
  })

  it('capSurfacePoint: on the mesh along the radial line, everywhere in the cap; null outside it', () => {
    const g = capGeometry(flat(2000), small)
    for (const [lat, lon] of [[-90, 0], [-89.99, 33], [-85, -179.9], [-85, 180], [-82.5, 0.7], [-80.02, 91], [-80, 45]]) {
      const s = siteVector(lat, lon, 0)
      const u = new Vector3(s[0], s[1], s[2]).normalize()
      const p = capSurfacePoint(g, -80, u, small)
      expect(p, `${lat}, ${lon}`).not.toBeNull()
      expect(p!.clone().normalize().distanceTo(u)).toBeLessThan(1e-9)
      // Flat 2 km relief: the mesh is at 1739.4 km inside the blend band, fading to 1737.4 km at the rim.
      expect(p!.length()).toBeLessThanOrEqual(MOON_RADIUS_KM + 2 + 1e-3)
      if (lat < -81) expect(p!.length()).toBeCloseTo(MOON_RADIUS_KM + 2, 2)
    }
    const s = siteVector(-79.5, 10, 0)
    expect(capSurfacePoint(g, -80, new Vector3(s[0], s[1], s[2]).normalize(), small)).toBeNull()
  })

  it('matchRimNormals: the sphere’s normal-mapped normal at the rim, the relief beyond the band, a blend between', () => {
    // A slope of 0.1 toward +x everywhere; a normal map that leans every normal toward local north by 0.2.
    const g = capGeometry({ heightXY: (x) => 0.1 * x, halfWidthM: HALF, northLat: -80 }, small)
    const before = g.getAttribute('normal').clone()
    matchRimNormals(g, -80, () => [0, 0.2, Math.sqrt(1 - 0.04)], 60, small)
    const n = (v: number) => vec(g, 'normal', v)
    const rimRho = capXY(-80, 0)[1]
    for (const j of [0, 50, 128, 200]) {
      const rim = capVertex(small.rings, j, small.sectors)
      const u = vec(g, 'position', rim).normalize()
      const c = Math.hypot(u.x, u.y) // cos(80°)
      const north = new Vector3(-u.x * u.z, -u.y * u.z, c * c).divideScalar(c)
      // three’s frame at 80° S: north scaled by 2 cos φ (the longer gradient, east, is 1).
      const want = north.multiplyScalar(0.2 * 2 * c).addScaledVector(u, Math.sqrt(1 - 0.04)).normalize()
      expect(n(rim).distanceTo(want), `rim ${j}`).toBeLessThan(1e-6)
      expect(n(capVertex(small.rings + 1, j, small.sectors)).distanceTo(want), `lip ${j}`).toBeLessThan(1e-6)
      // Beyond 60 km from the rim: unchanged.
      for (let i = 1; i < small.rings; i++) {
        if (rimRho - (rimRho * i) / small.rings < 60_000) continue
        const v = capVertex(i, j, small.sectors)
        expect(n(v).distanceTo(new Vector3().fromBufferAttribute(before, v))).toBe(0)
      }
    }
  })

  it('uses no trigonometry (scene3d rule: angles go through geometry/)', () => {
    expect(source).not.toMatch(/Math\.(sin|cos|tan|asin|acos|atan|atan2)\b/)
    expect(source).not.toMatch(/Matrix[34]/)
  })
})

describe('capGeometry on the shipped base raster', () => {
  let cap: SouthCap
  beforeAll(async () => {
    const fsName = 'node:fs/promises'
    const fs = (await import(/* @vite-ignore */ fsName)) as { readFile(u: URL): Promise<{ buffer: ArrayBuffer; byteOffset: number; byteLength: number; toString(e: string): string }> }
    const data = new URL('../../public/data/', import.meta.url)
    const io: CapIo = {
      json: async (p) => JSON.parse((await fs.readFile(new URL(p, data))).toString('utf8')),
      bytes: async (p) => {
        const b = await fs.readFile(new URL(p, data))
        return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
      },
    }
    cap = await openCap(io)
  })

  it('default mesh: pole and an inner vertex carry the base heights, the rim is on the sphere, normals are unit', () => {
    const g = capGeometry(cap)
    const o = CAP_GEOMETRY_DEFAULTS
    expect(g.getAttribute('position').count).toBe(1 + (o.rings + 1) * o.sectors)
    expect(vec(g, 'position', 0).length()).toBeCloseTo(MOON_RADIUS_KM + cap.heightXY(0, 0) / 1000, 3)
    // ring 128 of 256, sector 384 of 768 = longitude 0, halfway to the rim
    const rho = capXY(-80, 0)[1] / 2
    const v = capVertex(128, 384)
    const p = vec(g, 'position', v)
    expect(p.length()).toBeCloseTo(MOON_RADIUS_KM + cap.heightXY(0, rho) / 1000, 3)
    expect(Math.abs(latLonOf(p).lon)).toBeLessThan(1e-4)
    for (const j of [0, 100, 500, 767]) expect(vec(g, 'position', capVertex(o.rings, j)).length()).toBeCloseTo(MOON_RADIUS_KM, 3)
    let worst = 0
    const n = g.getAttribute('normal')
    for (let i = 0; i < n.count; i += 97) worst = Math.max(worst, Math.abs(vec(g, 'normal', i).length() - 1))
    expect(worst).toBeLessThan(1e-5)
    // capSurfacePoint agrees with a ray cast against the whole mesh (three's Raycaster), on real relief.
    const mesh = new Mesh(g, new MeshBasicMaterial())
    const ray = new Raycaster()
    for (const [lat, lon] of [[-89.46, -136.68], [-85.98, -0.26], [-88.0, 120.3], [-81.3, -45.1], [-89.99, 10]]) {
      const s = siteVector(lat, lon, 0)
      const u = new Vector3(s[0], s[1], s[2]).normalize()
      ray.set(u.clone().multiplyScalar(MOON_RADIUS_KM + 50), u.clone().negate())
      const want = ray.intersectObject(mesh)[0]?.point
      const got = capSurfacePoint(g, cap.northLat, u)
      expect(got && want && got.distanceTo(want), `${lat}, ${lon}`).toBeLessThan(1e-6)
    }
    // real relief: normals are not all radial
    const tilt = vec(g, 'normal', capVertex(20, 100)).dot(vec(g, 'position', capVertex(20, 100)).normalize())
    expect(tilt).toBeLessThan(1)
    expect(tilt).toBeGreaterThan(0.5)
  })
})
