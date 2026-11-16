// Terrain shadows on the GPU (16 Nov): for the Sun's direction of this frame, one texture per terrain level that
// holds, per sample of the level, how high the shadow of the terrain ahead stands above the ground there. The
// terrain shader (site.ts) reads it per fragment; sunlight.ts says what that means for the picture.
//
// Why not a three.js shadow map: at the lunar poles the Sun stands −1.5° … +5° above the horizontal, shadows are
// tens of kilometres long and the terrain reaches ±300 km, so a depth map seen from the Sun has one texel for
// kilometres of ground along the ray. Why not a horizon map per azimuth, built once per site: a shadow 20 km long
// moves 350 m sideways per degree of azimuth, so the map needs about one azimuth per degree to keep the shadows
// from ghosting between two of them: 360 values per sample, about 270 MB for the 746 000 samples of five levels.
// What is done instead costs 24 bytes per sample and is recomputed only when the Sun or the terrain changes:
//
// For a ray toward the Sun with elevation tangent T, S′(x) is the height of the shadow boundary at ground point x:
// the highest of z(occluder) − distance · T over all terrain ahead of x along the Sun's azimuth (heights in the
// site's ENU frame, so the Moon's curvature is in z and the ray is straight; shadows.ts header). A point at height
// z sees that ray iff z > S′(x). S′ over a reach of 4m steps follows from S′ over m steps:
//   S′₄ₘ(x) = max over k = 0…3 of S′ₘ(x + k·m·s·dir) − k·m·s·T
// so log₄(samples across) passes over a level's texture cover every occluder in the level (5 passes for 500
// samples a side), each pass three bilinear reads of the previous one (shadows.ts SHADOW_RADIX = 4; doubling needs
// 11 passes per level, and measured, the passes cost more than the reads).
// A step that leaves the level's square reads the next coarser level's finished texture
// where the ray leaves, which already holds everything beyond; levels are therefore computed coarsest first.
// Three rays are followed at once (the red, green and blue channel): toward the Sun's lower limb, its centre and
// its upper limb. The disc is whole where the lower limb's ray is free and gone where the upper limb's is blocked;
// between, the shader places the horizon across the disc (shadows.ts cOfClearances) and takes the visible share of
// the disc by geometry.discFraction's formula, so a shadow edge is the penumbra of the 0.53° Sun, as wide as the
// distance to the crest that casts it makes it.
//
// Stored is D = S′ − z(x) (half floats, relative precision 1/2048: fine near a shadow edge, where D is small).
// Heights are stored as two half floats (a multiple of 64 m and the rest), exact to 2 cm.
// shadows.ts propagate() is the same recursion on the CPU; its unit test compares it with the direct march.
//
// Cost (measured on an integrated GPU, five levels): 2.7 ms for all levels. While the time plays, the Sun moves by
// a small angle per frame (under 0.3°), and the levels are then updated in two halves on alternating frames
// (the coarser levels, then the finer ones, about 1.4 ms each), each for the Sun of its own frame; when the Sun
// stops, the frames that follow bring both to its final direction. A larger step of the Sun (a jump of the time, a
// new site) updates everything at once, and so does test mode.

import {
  ClampToEdgeWrapping,
  DataTexture,
  DataUtils,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from 'three'
import { SHADOW_RADIX, limbTans, shadowPasses, type ShadowLevel } from './shadows'

/** Most levels the terrain shader reads (fine, 80 m tile, near, mid, far). */
export const MAX_SHADOW_LEVELS = 5
/** D of a sample with no terrain ahead at all. */
const NONE = -30000

const VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uH;
uniform sampler2D uPrev;
uniform sampler2D uHc;
uniform sampler2D uDc;
uniform vec3 uLvl;   // samples a side, spacing (m), half-width (m)
uniform vec3 uLvlC;  // the next coarser level; half-width 0: there is none
uniform vec2 uDir;   // unit horizontal direction toward the Sun (east, north)
uniform vec3 uTan;   // elevation tangents of the lower limb, the centre and the upper limb
uniform float uJump; // length of one step of this pass, m
uniform float uFirst;
vec2 uvOf(vec2 g, vec3 l) {
  return vec2((g.x + l.z) / l.y + 0.5, (l.z - g.y) / l.y + 0.5) / l.x;
}
float heightOf(sampler2D t, vec2 uv) {
  vec4 v = texture2D(t, uv);
  return v.r + v.g;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uLvl.x;
  vec2 ij = gl_FragCoord.xy - 0.5;
  vec2 x = vec2(ij.x * uLvl.y - uLvl.z, uLvl.z - ij.y * uLvl.y);
  float z0 = heightOf(uH, uv);
  vec3 best = vec3(-1.0e9);
  for (int k = 1; k < ${SHADOW_RADIX}; k++) {
    float t = float(k) * uJump;
    vec2 q = x + t * uDir;
    if (max(abs(q.x), abs(q.y)) <= uLvl.z) {
      vec2 uq = uvOf(q, uLvl);
      vec3 dq = uFirst > 0.5 ? vec3(0.0) : texture2D(uPrev, uq).rgb;
      best = max(best, heightOf(uH, uq) + dq - t * uTan);
    } else {
      if (uLvlC.z > 0.0) {
        // Where the ray leaves this level's square: the coarser level's ground there and everything beyond it.
        vec2 lim = vec2(
          abs(uDir.x) > 1.0e-6 ? (sign(uDir.x) * uLvl.z - x.x) / uDir.x : 1.0e9,
          abs(uDir.y) > 1.0e-6 ? (sign(uDir.y) * uLvl.z - x.y) / uDir.y : 1.0e9);
        float tExit = max(min(lim.x, lim.y), 0.0);
        vec2 ue = uvOf(x + tExit * uDir, uLvlC);
        best = max(best, heightOf(uHc, ue) + max(texture2D(uDc, ue).rgb, vec3(0.0)) - tExit * uTan);
      }
      break; // every farther step leaves the square too
    }
  }
  vec3 d = best - z0;
  if (uFirst < 0.5) d = max(d, texture2D(uPrev, uv).rgb);
  gl_FragColor = vec4(clamp(d, ${NONE.toFixed(1)}, 30000.0), 1.0);
}`

interface GpuLevel {
  level: ShadowLevel
  heights: DataTexture
  a: WebGLRenderTarget
  b: WebGLRenderTarget
  /** The target that holds the finished pass. */
  done: WebGLRenderTarget
}

function heightTexture(l: ShadowLevel): DataTexture {
  const data = new Uint16Array(l.n * l.n * 4)
  for (let v = 0; v < l.n * l.n; v++) {
    const hi = Math.round(l.z[v] / 64) * 64
    data[v * 4] = DataUtils.toHalfFloat(hi)
    data[v * 4 + 1] = DataUtils.toHalfFloat(l.z[v] - hi)
  }
  const t = new DataTexture(data, l.n, l.n, RGBAFormat, HalfFloatType)
  t.minFilter = t.magFilter = LinearFilter
  t.wrapS = t.wrapT = ClampToEdgeWrapping
  t.colorSpace = NoColorSpace
  t.generateMipmaps = false
  t.needsUpdate = true
  return t
}

function target(n: number): WebGLRenderTarget {
  return new WebGLRenderTarget(n, n, {
    type: HalfFloatType,
    format: RGBAFormat,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
    colorSpace: NoColorSpace,
  })
}

/** A step of the Sun's direction larger than this (squared chord, about 0.3°) updates every level in one frame. */
const STAGED_MAX_SQ = 0.005 * 0.005

export class ShadowMap {
  private levels: GpuLevel[] = []
  private pending: ShadowLevel[] | null = null
  private supported: boolean | null = null
  private readonly sun = new Vector3(0, 1, 0)
  private angRadDeg = 0.27
  // What is up to date: `version` counts the changes of the Sun and the terrain; each half of the levels (0: the
  // coarser ones, 1: the finer ones, split at `split`) remembers the version it was computed for, and the finer
  // half the coarser half's version it read at its edges.
  private version = 0
  private readonly computed = [-1, -1]
  private fineRead = -1
  private split = 0
  private turn = 0
  private all = true // the next update runs every level (new terrain)
  private readonly ranFor = new Vector3()
  private readonly mat = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uH: { value: null as Texture | null },
      uPrev: { value: null as Texture | null },
      uHc: { value: null as Texture | null },
      uDc: { value: null as Texture | null },
      uLvl: { value: new Vector3() },
      uLvlC: { value: new Vector3() },
      uDir: { value: new Vector2(0, 1) },
      uTan: { value: new Vector3() },
      uJump: { value: 1 },
      uFirst: { value: 1 },
    },
  })
  private readonly scene = new Scene()
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  /** How many times the passes ran (test helper: once per change of the Sun or the terrain, not per frame). */
  runs = 0

  constructor() {
    const quad = new Mesh(new PlaneGeometry(2, 2), this.mat)
    quad.frustumCulled = false
    this.scene.add(quad)
  }

  /** The terrain's levels, finest first (at most MAX_SHADOW_LEVELS: the coarsest are kept). Uploaded at the next update. */
  setLevels(levels: ShadowLevel[]) {
    this.pending = levels.slice(-MAX_SHADOW_LEVELS)
    this.version++
    this.all = true
  }

  setSun(sun: Vector3, angRadDeg: number) {
    if (this.sun.distanceToSquared(sun) < 1e-18 && angRadDeg === this.angRadDeg) return
    this.sun.copy(sun)
    this.angRadDeg = angRadDeg
    this.version++
  }

  /** The textures' contents are gone (a restored WebGL context): everything is computed again at the next update. */
  invalidate() {
    this.version++
    this.all = true
  }

  /** False where the GPU cannot render to half-float textures: the terrain is then drawn without cast shadows. */
  get active(): boolean {
    return this.supported !== false
  }

  /** Level i (finest first) as the shader needs it: the finished texture and (samples, spacing, half-width). */
  texture(i: number): { tex: Texture; n: number; spacing: number; ext: number } | null {
    const g = this.levels[i]
    return g && this.supported ? { tex: g.done.texture, n: g.level.n, spacing: g.level.spacing, ext: g.level.ext } : null
  }

  get count(): number {
    return this.supported ? this.levels.length : 0
  }

  private upload() {
    const next = this.pending
    if (!next) return
    this.pending = null
    // Targets are kept for a level of the same size (every prepared site has the same level sizes), so a site
    // switch allocates the height textures only.
    const old = this.levels
    this.levels = next.map((level) => {
      const k = old.findIndex((o) => o && o.level.n === level.n)
      const reuse = k >= 0 ? old.splice(k, 1)[0] : null
      reuse?.heights.dispose()
      const a = reuse?.a ?? target(level.n)
      const b = reuse?.b ?? target(level.n)
      return { level, heights: heightTexture(level), a, b, done: a }
    })
    for (const o of old) {
      o.heights.dispose()
      o.a.dispose()
      o.b.dispose()
    }
    // The two halves: levels [split, …) and [0, split), cut where the larger half is smallest (by samples).
    const size = this.levels.map((g) => g.level.n * g.level.n)
    const total = size.reduce((a, b) => a + b, 0)
    let best = Infinity
    let fine = 0
    this.split = 0
    for (let k = 0; k <= this.levels.length; k++) {
      const worst = Math.max(fine, total - fine)
      if (worst < best) {
        best = worst
        this.split = k
      }
      fine += size[k] ?? 0
    }
  }

  /** The passes of levels [from, to), coarsest first, for the current Sun. */
  private run(renderer: WebGLRenderer, from: number, to: number) {
    const u = this.mat.uniforms
    const hl = Math.hypot(this.sun.x, this.sun.y)
    ;(u.uDir.value as Vector2).set(this.sun.x / hl, this.sun.y / hl)
    ;(u.uTan.value as Vector3).fromArray(limbTans(this.sun, this.angRadDeg))
    const before = renderer.getRenderTarget()
    for (let li = to - 1; li >= from; li--) {
      const g = this.levels[li]
      const c = this.levels[li + 1] as GpuLevel | undefined
      const { n, spacing, ext } = g.level
      ;(u.uLvl.value as Vector3).set(n, spacing, ext)
      ;(u.uLvlC.value as Vector3).set(c?.level.n ?? 1, c?.level.spacing ?? 1, c?.level.ext ?? 0)
      u.uH.value = g.heights
      u.uHc.value = c?.heights ?? g.heights
      u.uDc.value = c?.done.texture ?? null
      // Never the texture the shader may still be reading as the finished one of a pass before.
      let from_ = g.done === g.a ? g.a : g.b
      let to_ = g.done === g.a ? g.b : g.a
      const jumps = shadowPasses(n)
      for (let p = 0; p < jumps.length; p++) {
        u.uFirst.value = p === 0 ? 1 : 0
        u.uJump.value = spacing * jumps[p]
        u.uPrev.value = p === 0 ? null : from_.texture
        renderer.setRenderTarget(to_)
        renderer.render(this.scene, this.camera)
        ;[from_, to_] = [to_, from_]
      }
      g.done = from_
    }
    renderer.setRenderTarget(before)
    this.ranFor.copy(this.sun)
    this.runs++
  }

  /**
   * Brings the shadow textures up to date with the Sun and the terrain, all levels at once or (`staged`, for a
   * small step of the Sun) one half of them per call. Returns true while a half is still behind: the caller then
   * draws another frame.
   */
  update(renderer: WebGLRenderer, staged = false): boolean {
    if (this.supported === null) {
      const gl = renderer.getContext()
      this.supported = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))
    }
    if (!this.supported) return false
    this.upload()
    const n = this.levels.length
    const behind = () => this.computed[0] !== this.version || this.computed[1] !== this.version || this.fineRead !== this.computed[0]
    if (!behind() || !n || Math.hypot(this.sun.x, this.sun.y) < 1e-9) return false
    const whole = !staged || this.all || this.split === 0 || this.split === n || this.ranFor.distanceToSquared(this.sun) > STAGED_MAX_SQ
    if (whole) {
      this.all = false
      this.run(renderer, 0, n)
      this.computed[0] = this.computed[1] = this.fineRead = this.version
      return false
    }
    const coarseBehind = this.computed[0] !== this.version
    const fineBehind = this.computed[1] !== this.version || this.fineRead !== this.computed[0]
    if (coarseBehind && (!fineBehind || this.turn === 0)) {
      this.run(renderer, this.split, n)
      this.computed[0] = this.version
      this.turn = 1
    } else {
      this.run(renderer, 0, this.split)
      this.computed[1] = this.version
      this.fineRead = this.computed[0]
      this.turn = 0
    }
    return behind()
  }

  /**
   * Test helper: the three clearances D (lower limb, centre, upper limb) the GPU holds for level i at its sample
   * (row, col), read back from the texture. null where reading half floats back is not possible.
   */
  read(renderer: WebGLRenderer, i: number, row: number, col: number): [number, number, number] | null {
    const g = this.levels[i]
    if (!g || !this.supported) return null
    const buf = new Uint16Array(4)
    try {
      renderer.readRenderTargetPixels(g.done, col, row, 1, 1, buf)
    } catch {
      return null
    }
    return [DataUtils.fromHalfFloat(buf[0]), DataUtils.fromHalfFloat(buf[1]), DataUtils.fromHalfFloat(buf[2])]
  }

  dispose() {
    for (const g of this.levels) {
      g.heights.dispose()
      g.a.dispose()
      g.b.dispose()
    }
    this.levels = []
    this.mat.dispose()
    ;(this.scene.children[0] as Mesh).geometry.dispose()
  }
}
