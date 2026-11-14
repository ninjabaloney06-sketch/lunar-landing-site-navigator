// Cross-dissolve between two pictures of the same frame (S3): during the fly between the globe and the site the
// space scene and the site scene are both drawn from the same camera pose, and one is laid over the other with a
// weight, so the change of scene is a fade and never a cut. The first picture is copied from the canvas as it
// is (tone-mapped, display-encoded) and drawn back by a full-screen quad with plain alpha blending.

import { FramebufferTexture, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, type WebGLRenderer } from 'three'

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

// No tone mapping and no colour-space conversion: the copied pixels are final already.
const FRAG = /* glsl */ `
uniform sampler2D tFrame;
uniform float uMix;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(tFrame, vUv).rgb, uMix);
}`

export class Dissolve {
  private tex: FramebufferTexture | null = null
  private readonly mat = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { tFrame: { value: null as FramebufferTexture | null }, uMix: { value: 0 } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  private readonly scene = new Scene()
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private readonly buf = new Vector2()

  constructor() {
    const quad = new Mesh(new PlaneGeometry(2, 2), this.mat)
    quad.frustumCulled = false
    this.scene.add(quad)
  }

  /** Keeps the picture now on the canvas. */
  capture(renderer: WebGLRenderer) {
    renderer.getDrawingBufferSize(this.buf)
    if (!this.tex || this.tex.image.width !== this.buf.x || this.tex.image.height !== this.buf.y) {
      this.tex?.dispose()
      this.tex = new FramebufferTexture(this.buf.x, this.buf.y)
      this.mat.uniforms.tFrame.value = this.tex
    }
    renderer.copyFramebufferToTexture(this.tex)
  }

  /** Lays the kept picture over the canvas with weight mix (0..1). */
  draw(renderer: WebGLRenderer, mix: number) {
    if (!this.tex) return
    this.mat.uniforms.uMix.value = mix
    renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.tex?.dispose()
    this.mat.dispose()
  }
}
