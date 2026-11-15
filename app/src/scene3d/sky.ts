// Sky layer: stars, Sun, Earth. Drawn first with its own camera at the origin that copies the main camera's
// orientation and projection, so every body sits at its true direction and true angular size from wherever
// the main camera is (build-plan §5.4 "true direction, true angular size, compressed distance"). The terrain
// or the Moon is drawn over it afterwards, which is what hides a body behind terrain.

import {
  AdditiveBlending,
  BackSide,
  Color,
  DirectionalLight,
  DoubleSide,
  FrontSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  RingGeometry,
  Quaternion,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type WebGLRenderer,
} from 'three'
import type { BodyState } from '../geometry'
import { glowTexture, type TextureSet } from './assets'
import { EARTH_RADIUS_KM, SPHERE_TO_BODY, SUN_RADIUS_KM, displayRadius, quat, v3 } from './frames'

// Display distances in sky units: of Earth and the Sun, the one nearer to the observer is drawn at D_NEAR and
// hides the other where they overlap (S9); the stars are behind both.
const D_NEAR = 1000
const D_FAR = 1500
const D_STARS = 5000
const RING_NORMAL = new Vector3(0, 0, 1)

// stars_4k.jpg (NASA SVS 4851): RA 0h at the image centre, RA growing to the left, as seen from inside. Checked
// on the image itself (C1, 14 Nov): the brightest region sits at RA 266°/Dec −29° (galactic centre) and the
// Magellanic Clouds at RA 81°/Dec −70° and RA 13°/Dec −73° only under this convention.
const STARMAP_RA_INCREASES_LEFT = true

export const ATMO_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`

export const ATMO_FRAG = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 uSun;
varying vec3 vN;
varying vec3 vV;
void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vN);
  float rim = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 3.0);
  float day = smoothstep(-0.25, 0.35, dot(n, uSun));
  gl_FragColor = vec4(vec3(0.38, 0.62, 1.0) * rim * day * 1.4, 1.0);
}`

export type SkyBody = 'sun' | 'earth'

export class Sky {
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(54, 1, 1, 20_000)
  /** Children live in MOON_ME directions; root.quaternion rotates MOON_ME into the current view frame. */
  readonly root = new Group()
  private readonly sun: Mesh
  private readonly glow: Sprite
  private readonly earth: Mesh
  private readonly atmo: Mesh
  private readonly atmoMat: ShaderMaterial
  private readonly stars: Mesh | null = null
  // Outline drawn instead of a disc the computed horizon mask hides from the site (setBelowHorizon).
  private readonly sunRing: Mesh
  private readonly earthRing: Mesh
  private below = { sun: false, earth: false }
  private readonly sunLight = new DirectionalLight(0xffffff, 2.5 * Math.PI)
  private readonly dirMe = { sun: new Vector3(1, 0, 0), earth: new Vector3(1, 0, 0) }
  earthPhase = 0 // illuminated fraction of Earth's disc seen by the observer (0..1), vector algebra only
  // Nearer to the observer than the Moon's centre is: drawn after the Moon, over it (never so from the Moon's surface).
  private readonly front = { sun: false, earth: false }
  private bodiesOn = true
  private earthOn = true // false on the flight level, whose scene draws its own Earth (setEarthVisible)

  constructor(tex: TextureSet) {
    this.scene.add(this.root)

    if (tex.stars) {
      const m = new MeshBasicMaterial({ map: tex.stars, side: BackSide, depthWrite: false, color: new Color(0.22, 0.22, 0.22) })
      const s = new Mesh(new SphereGeometry(D_STARS, 64, 32), m)
      if (STARMAP_RA_INCREASES_LEFT) s.scale.set(1, 1, -1)
      s.renderOrder = -1
      this.stars = s
      this.root.add(s)
    }

    const sunMat = new MeshBasicMaterial({ color: new Color(1, 0.95, 0.86).multiplyScalar(8) })
    this.sun = new Mesh(new SphereGeometry(1, 96, 48), sunMat) // round at the Sun viewpoint too, where it is 330 px wide
    this.glow = new Sprite(
      new SpriteMaterial({ map: glowTexture(), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }),
    )
    this.glow.renderOrder = 2

    const earthMat = new MeshStandardMaterial({
      map: tex.earth ?? null,
      color: tex.earth ? 0xffffff : 0x4d6d93,
      roughness: 0.9,
      metalness: 0,
    })
    this.earth = new Mesh(new SphereGeometry(1, 64, 32), earthMat)
    this.atmoMat = new ShaderMaterial({
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      uniforms: { uSun: { value: new Vector3(1, 0, 0) } },
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: FrontSide,
    })
    this.atmo = new Mesh(new SphereGeometry(1, 64, 32), this.atmoMat)
    this.atmo.renderOrder = 1

    const ring = (hex: number) => {
      const m = new Mesh(
        new RingGeometry(0.7, 1, 64),
        new MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.8, side: DoubleSide, depthWrite: false }),
      )
      m.renderOrder = 2
      m.visible = false
      return m
    }
    this.sunRing = ring(0x9a8f7c)
    this.earthRing = ring(0x6f86a8)

    this.root.add(this.sun, this.glow, this.earth, this.atmo, this.sunRing, this.earthRing, this.sunLight, this.sunLight.target)
  }

  /**
   * observerKm: where the bodies are seen from, MOON_ME km (the site for site/eye, the camera for the globe).
   * meToWorld: rotation from MOON_ME into the frame of the scene drawn on top (ENU for the site, identity for the globe).
   */
  update(s: BodyState, observerKm: Vector3, meToWorld: Quaternion) {
    this.root.quaternion.copy(meToWorld)
    const sunRel = v3(s.sun_km).sub(observerKm)
    const earthRel = v3(s.earth_km).sub(observerKm)
    const sunDist = sunRel.length()
    const earthDist = earthRel.length()
    this.dirMe.sun.copy(sunRel).normalize()
    this.dirMe.earth.copy(earthRel).normalize()

    const dSun = sunDist < earthDist ? D_NEAR : D_FAR
    const dEarth = sunDist < earthDist ? D_FAR : D_NEAR
    const moonDist = observerKm.length()
    this.front.sun = sunDist < moonDist
    this.front.earth = earthDist < moonDist

    const rs = displayRadius(dSun, SUN_RADIUS_KM, sunDist)
    this.sun.position.copy(this.dirMe.sun).multiplyScalar(dSun)
    this.sun.scale.setScalar(rs)
    this.glow.position.copy(this.sun.position)
    this.glow.scale.setScalar(rs * 16)

    const re = displayRadius(dEarth, EARTH_RADIUS_KM, earthDist)
    this.earth.position.copy(this.dirMe.earth).multiplyScalar(dEarth)
    this.earth.scale.setScalar(re)
    // IAU_EARTH → MOON_ME (q_earth_to_me) after the sphere's own texture frame.
    this.earth.quaternion.copy(quat(s.q_earth_to_me)).multiply(SPHERE_TO_BODY)
    this.atmo.position.copy(this.earth.position)
    this.atmo.scale.setScalar(re * 1.035)
    for (const [ring, body, r] of [[this.sunRing, this.sun, rs], [this.earthRing, this.earth, re]] as const) {
      ring.position.copy(body.position)
      ring.scale.setScalar(r)
      ring.quaternion.setFromUnitVectors(RING_NORMAL, body.position.clone().negate().normalize()) // faces the observer
    }

    if (this.stars) this.stars.quaternion.copy(quat(s.q_me_to_j2000)).invert().multiply(SPHERE_TO_BODY)

    this.sunLight.position.copy(this.dirMe.sun)
    this.sunLight.target.position.set(0, 0, 0)
    this.root.updateMatrixWorld(true)
    this.atmoMat.uniforms.uSun.value.copy(this.dirMe.sun).applyQuaternion(meToWorld)

    // Phase: cos of the Sun–Earth–observer angle, from unit vectors (no trig): fraction = (1 + cos α) / 2.
    const earthToSun = v3(s.sun_km).sub(v3(s.earth_km)).normalize()
    const earthToObs = observerKm.clone().sub(v3(s.earth_km)).normalize()
    this.earthPhase = (1 + earthToSun.dot(earthToObs)) / 2
  }

  /** Unit direction observer → body in the world frame of the scene drawn on top. */
  worldDir(b: SkyBody): Vector3 {
    return this.dirMe[b].clone().applyQuaternion(this.root.quaternion)
  }

  /** Position of the body in sky-world units (for projection with this.camera). */
  worldPos(b: SkyBody): Vector3 {
    return (b === 'sun' ? this.sun : this.earth).getWorldPosition(new Vector3())
  }

  /**
   * The bodies the site's computed horizon mask hides from the site: each is drawn as a dim outline instead of a
   * bright disc (the sky layer cannot know the terrain; the caller passes the mask's answer).
   */
  setBelowHorizon(b: { sun: boolean; earth: boolean }) {
    this.below = { ...b }
  }

  /** True when the body is currently drawn as an outline, not a disc. */
  isHollow(b: SkyBody): boolean {
    return this.below[b]
  }

  setEarthVisible(v: boolean) {
    this.earthOn = v
  }

  /** The top view draws its own bodies over the star field: the sky's Sun and Earth are hidden meanwhile. */
  showBodies(on: boolean) {
    this.bodiesOn = on
    this.earthOn = true // as before render() chose the parts: showing or hiding the bodies also undoes setEarthVisible
  }

  /** True when Earth or the Sun is nearer than the Moon and has to be drawn over it: render(…, 'front') after the Moon. */
  get hasFront(): boolean {
    return this.bodiesOn && (this.front.sun || this.front.earth)
  }

  /** Drawn radius over drawn distance of a body: its angular size as geometry computed it, whatever the lens. */
  sizeRatio(b: SkyBody): number {
    const m = b === 'sun' ? this.sun : this.earth
    return m.scale.x / m.position.length()
  }

  syncCamera(main: PerspectiveCamera) {
    this.camera.quaternion.copy(main.quaternion)
    this.camera.position.set(0, 0, 0)
    if (this.camera.fov !== main.fov || this.camera.aspect !== main.aspect) {
      this.camera.fov = main.fov
      this.camera.aspect = main.aspect
      this.camera.updateProjectionMatrix()
    }
    this.camera.updateMatrixWorld(true)
  }

  /**
   * 'back': the stars and the bodies beyond the Moon, drawn before the Moon or the terrain. 'front': the bodies
   * nearer than the Moon, drawn after it with the depth cleared, so they hide the part of the Moon behind them.
   */
  render(renderer: WebGLRenderer, part: 'back' | 'front' = 'back') {
    const front = part === 'front'
    if (this.stars) this.stars.visible = !front
    const sunOn = this.bodiesOn && this.front.sun === front
    const earthOn = this.bodiesOn && this.earthOn && this.front.earth === front
    this.sun.visible = this.glow.visible = sunOn && !this.below.sun
    this.sunRing.visible = sunOn && this.below.sun
    this.earth.visible = this.atmo.visible = earthOn && !this.below.earth
    this.earthRing.visible = earthOn && this.below.earth
    renderer.render(this.scene, this.camera)
  }
}
