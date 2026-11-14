// Space scene for the globe level: origin = Moon centre, axes = MOON_ME, unit = km. Textured Moon lit by the
// true Sun direction, one pin per site, click on the surface → planetocentric lat/lon.

import {
  BoxGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  Quaternion,
  Ray,
  Raycaster,
  Scene,
  Sphere,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three'
import type { Site } from '../data/types'
import { MOON_RADIUS_KM, siteVector } from '../geometry'
import { checkerTexture, type TextureSet } from './assets'
import { SPHERE_TO_BODY, latLonOf, v3 } from './frames'

const PIN_LEN_PX = 26
const PIN_W_PX = 1.6
const HEAD_PX = 3.2
const Z = new Vector3(0, 0, 1)

interface Pin {
  site: Site
  surface: Vector3
  group: Group
  stem: Mesh
  head: Mesh
}

export class GlobeWorld {
  readonly scene = new Scene()
  private readonly moon: Mesh
  private readonly moonMat: MeshPhysicalMaterial
  private checkerMat: MeshBasicMaterial | null = null
  private readonly pins: Pin[] = []
  private readonly pinGroup = new Group()
  private readonly sunLight = new DirectionalLight(0xfff4e6, 3 * Math.PI)
  private readonly earthLight = new DirectionalLight(0x9fb6d8, 0)
  private readonly raycaster = new Raycaster()
  private selected: string | null = null
  private pinLenKm = 100

  constructor(tex: TextureSet) {
    // Diffuse only, as the site terrain (site.ts: no GGX glare at the limb and terminator).
    this.moonMat = new MeshPhysicalMaterial({
      specularIntensity: 0,
      map: tex.moon ?? null,
      normalMap: tex.moonNormal ?? null,
      color: tex.moon ? 0xffffff : 0x8b8781,
      roughness: 1,
      metalness: 0,
    })
    this.moon = new Mesh(new SphereGeometry(MOON_RADIUS_KM, 256, 128), this.moonMat)
    this.moon.quaternion.copy(SPHERE_TO_BODY) // texture longitude 0 → +x MOON_ME, north → +z (T16)
    this.scene.add(this.moon, this.pinGroup, this.sunLight, this.sunLight.target, this.earthLight, this.earthLight.target)
  }

  /** 'checker' = T16 debug texture with labelled meridians, unlit so the terminator cannot hide it. */
  setTexture(mode: 'real' | 'checker') {
    if (mode === 'checker') {
      this.checkerMat ??= new MeshBasicMaterial({ map: checkerTexture(), toneMapped: false })
      this.moon.material = this.checkerMat
    } else this.moon.material = this.moonMat
  }

  setSites(sites: Site[], selectedId: string | null) {
    this.selected = selectedId
    for (const p of this.pins) this.pinGroup.remove(p.group)
    this.pins.length = 0
    const stemMat = new MeshBasicMaterial({ color: 0xd9d6cf, toneMapped: false })
    const headMat = new MeshBasicMaterial({ color: 0xf2efe8, toneMapped: false })
    for (const site of sites) {
      const surface = v3(siteVector(site.lat, site.lon, 0))
      const group = new Group()
      group.position.copy(surface)
      group.quaternion.copy(new Quaternion().setFromUnitVectors(Z, surface.clone().normalize()))
      const stem = new Mesh(new BoxGeometry(1, 1, 1).translate(0, 0, 0.5), stemMat)
      const head = new Mesh(new SphereGeometry(1, 12, 8), headMat)
      group.add(stem, head)
      this.pinGroup.add(group)
      this.pins.push({ site, surface, group, stem, head })
    }
  }

  setLights(sunDirMe: Vector3, earthDirMe: Vector3, earthFill: number) {
    this.sunLight.position.copy(sunDirMe).multiplyScalar(1e5)
    this.earthLight.position.copy(earthDirMe).multiplyScalar(1e5)
    this.earthLight.intensity = earthFill
  }

  /** Constant on-screen pin size. */
  updatePins(cam: PerspectiveCamera, heightPx: number) {
    for (const p of this.pins) {
      const dist = cam.position.distanceTo(p.surface)
      const perPx = (2 * dist) / (cam.projectionMatrix.elements[5] * heightPx)
      const sel = p.site.id === this.selected
      const len = PIN_LEN_PX * perPx * (sel ? 1.25 : 1)
      p.stem.scale.set(PIN_W_PX * perPx, PIN_W_PX * perPx, len)
      p.head.position.set(0, 0, len)
      p.head.scale.setScalar(HEAD_PX * perPx * (sel ? 1.3 : 1))
      if (sel) this.pinLenKm = len
    }
  }

  /** Pin head position (MOON_ME km) of a site, for labels and tests. */
  pinTop(siteId: string): Vector3 | null {
    const p = this.pins.find((q) => q.site.id === siteId)
    return p ? p.head.getWorldPosition(new Vector3()) : null
  }

  pinSurface(siteId: string): Vector3 | null {
    return this.pins.find((q) => q.site.id === siteId)?.surface.clone() ?? null
  }

  get selectedPinLength() {
    return this.pinLenKm
  }

  /** Click → a pin within 10 px (its source coordinates) or the surface point under the cursor. */
  pick(ndc: Vector2, cam: PerspectiveCamera, sizePx: Vector2): { lat: number; lon: number } | null {
    let best: Pin | null = null
    let bestD = 10
    for (const p of this.pins) {
      const s = p.head.getWorldPosition(new Vector3())
      if (this.occluded(cam.position, s)) continue
      const q = s.project(cam)
      const d = Math.hypot(((q.x - ndc.x) / 2) * sizePx.x, ((q.y - ndc.y) / 2) * sizePx.y)
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    if (best) return { lat: best.site.lat, lon: best.site.lon }
    this.raycaster.setFromCamera(ndc, cam)
    const hit = this.raycaster.intersectObject(this.moon, false)[0]
    return hit ? latLonOf(hit.point) : null
  }

  /** True when the Moon blocks the segment from `from` to `to` (km). */
  occluded(from: Vector3, to: Vector3): boolean {
    const dir = to.clone().sub(from)
    const len = dir.length()
    const hit = new Ray(from, dir.normalize()).intersectSphere(new Sphere(new Vector3(), MOON_RADIUS_KM * 0.9995), new Vector3())
    return hit !== null && hit.distanceTo(from) < len - 1e-6
  }

  /** True when the Moon blocks the ray from `from` along unit `dir`. */
  occludedDir(from: Vector3, dir: Vector3): boolean {
    return new Ray(from, dir).intersectSphere(new Sphere(new Vector3(), MOON_RADIUS_KM * 0.9995), new Vector3()) !== null
  }
}
