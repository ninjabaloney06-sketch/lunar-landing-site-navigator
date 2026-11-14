// "Solar system — top view" (Brief C4 part 2): Sun, Earth and Moon in one frame, seen from above the Moon's
// north pole, looking down the +z axis of MOON_ME. +x (0° longitude) points right on screen, +y (90° E) up.
//
// NOT TO SCALE. True distances cannot share one screen (Earth is about 221 Moon radii away, the Sun about
// 86 000), so the Moon sits at the centre and the two others are drawn at fixed display distances and sizes.
// What stays computed: the direction from the Moon to the Earth and from the Moon to the Sun (unit vectors of
// earth_km and sun_km), the lit side of each body (the Sun direction) and the bodies' orientation.

import {
  AdditiveBlending,
  Color,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import type { BodyState } from '../geometry'
import { glowTexture, type TextureSet } from './assets'
import { SPHERE_TO_BODY, quat, v3 } from './frames'

/** Display radii and display distances from the Moon, in units of the drawn Moon radius. */
export const TOP_VIEW = {
  radius: { moon: 1, earth: 2, sun: 3 },
  dist: { earth: 6, sun: 14 },
  frame: 17.5, // radius of the framed circle: the Sun's distance plus its radius and a small margin
  // Where the frame sits on screen: the header and the timeline cover the top corners and the bottom band, so
  // the Moon is drawn above the middle and the circle is kept inside the clear part.
  centerY: 0.43, // share of the screen height from the top
  fit: { height: 0.3, width: 0.46 }, // the circle's radius: at most these shares of the screen height and width
}

export type TopBody = 'moon' | 'earth' | 'sun'

export class TopView {
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(54, 1, 1, 2000)
  private readonly body: Record<TopBody, Mesh>
  private readonly glow: Sprite
  private readonly sunLight = new DirectionalLight(0xfff4e6, 3 * Math.PI)
  private pxPerUnit = 1

  constructor(tex: TextureSet) {
    const moon = new Mesh(
      new SphereGeometry(TOP_VIEW.radius.moon, 96, 48),
      new MeshPhysicalMaterial({ specularIntensity: 0, map: tex.moon ?? null, color: tex.moon ? 0xffffff : 0x8b8781, roughness: 1, metalness: 0 }),
    )
    moon.quaternion.copy(SPHERE_TO_BODY)
    const earth = new Mesh(
      new SphereGeometry(TOP_VIEW.radius.earth, 96, 48),
      new MeshStandardMaterial({ map: tex.earth ?? null, color: tex.earth ? 0xffffff : 0x4d6d93, roughness: 0.9, metalness: 0 }),
    )
    const sun = new Mesh(
      new SphereGeometry(TOP_VIEW.radius.sun, 48, 24),
      new MeshBasicMaterial({ color: new Color(1, 0.95, 0.86).multiplyScalar(8) }),
    )
    this.glow = new Sprite(
      new SpriteMaterial({ map: glowTexture(), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }),
    )
    this.glow.scale.setScalar(TOP_VIEW.radius.sun * 5)
    this.body = { moon, earth, sun }
    this.scene.add(moon, earth, sun, this.glow, this.sunLight, this.sunLight.target)
    // Looking down −z with +y up on screen. This is the scene's one camera pose; it never moves.
    this.camera.up.set(0, 1, 0)
  }

  /** Places the bodies for a body state and frames them for the main camera's lens and the viewport (CSS px). */
  update(s: BodyState, main: PerspectiveCamera, width: number, height: number) {
    const toEarth = v3(s.earth_km).normalize()
    const toSun = v3(s.sun_km).normalize()
    this.body.earth.position.copy(toEarth).multiplyScalar(TOP_VIEW.dist.earth)
    this.body.earth.quaternion.copy(quat(s.q_earth_to_me)).multiply(SPHERE_TO_BODY)
    this.body.sun.position.copy(toSun).multiplyScalar(TOP_VIEW.dist.sun)
    this.glow.position.copy(this.body.sun.position)
    this.sunLight.position.copy(toSun).multiplyScalar(100)
    this.sunLight.target.position.set(0, 0, 0)

    const cam = this.camera
    cam.fov = main.fov
    cam.aspect = main.aspect
    // The picture is shifted up on screen without tilting the camera: it stays on the +z axis, looking down it.
    cam.setViewOffset(width, height, 0, Math.round((0.5 - TOP_VIEW.centerY) * height), width, height)
    cam.updateProjectionMatrix()
    // elements[5] = 1 / tan(fov / 2): the camera height at which the framed circle has the wanted radius in px.
    const radiusPx = Math.min(TOP_VIEW.fit.height * height, TOP_VIEW.fit.width * width)
    this.pxPerUnit = radiusPx / TOP_VIEW.frame
    cam.position.set(0, 0, ((height / 2) * cam.projectionMatrix.elements[5]) / this.pxPerUnit)
    cam.lookAt(0, 0, 0)
    cam.updateMatrixWorld(true)
    this.scene.updateMatrixWorld(true)
  }

  /** Drawn radius of a body on screen, CSS px. */
  radiusPx(b: TopBody): number {
    return TOP_VIEW.radius[b] * this.pxPerUnit
  }

  worldPos(b: TopBody): Vector3 {
    return this.body[b].getWorldPosition(new Vector3())
  }

  /** Distance from the camera to the nearest drawn body surface (display units): > 0 = outside every body. */
  clearance(): number {
    return Math.min(
      ...(['moon', 'earth', 'sun'] as const).map((b) => this.camera.position.distanceTo(this.body[b].position) - TOP_VIEW.radius[b]),
    )
  }
}
