// Textures: files from app/public/textures/ (Track B) with silent fallbacks, plus the two textures generated
// in code (T16 debug checker, Sun glow). A missing file never breaks the scene: the material keeps its plain
// colour.

import { CanvasTexture, SRGBColorSpace, TextureLoader, type Texture } from 'three'

export const TEXTURE_FILES = {
  moon: 'moon_color_4k.webp',
  moonNormal: 'moon_normal_2k.png',
  stars: 'stars_4k.jpg',
  earth: 'earth_2k.jpg',
} as const

export type TextureName = keyof typeof TEXTURE_FILES
export type TextureSet = Partial<Record<TextureName, Texture>>

const loader = new TextureLoader()

function loadOne(file: string, srgb: boolean): Promise<Texture | null> {
  return new Promise((resolve) => {
    loader.load(
      `${import.meta.env.BASE_URL}textures/${file}`,
      (t) => {
        if (srgb) t.colorSpace = SRGBColorSpace
        t.anisotropy = 4
        resolve(t)
      },
      undefined,
      () => resolve(null), // 404 (or Vite's HTML fallback, which fails to decode) → plain material
    )
  })
}

/** Resolves once every texture has loaded or failed. */
export async function loadTextures(): Promise<TextureSet> {
  const names = Object.keys(TEXTURE_FILES) as TextureName[]
  const loaded = await Promise.all(names.map((n) => loadOne(TEXTURE_FILES[n], n !== 'moonNormal')))
  const set: TextureSet = {}
  names.forEach((n, i) => {
    const t = loaded[i]
    if (t) set[n] = t
  })
  return set
}

/** Longitude (deg, east-positive) → canvas x for an equirectangular map with longitude 0 at the centre. */
const lonToX = (lon: number, w: number) => (((0.5 + lon / 360) % 1) + 1) % 1 * w

/** T16 debug checker: 15° squares, coloured meridian bands (±2°): 0° red, 90° E green, 180° blue, 90° W yellow. */
export const CHECKER_MERIDIANS = [
  { lon: 0, rgb: [230, 40, 40], label: '0°' },
  { lon: 90, rgb: [40, 200, 60], label: '90°E' },
  { lon: 180, rgb: [50, 90, 240], label: '180°' },
  { lon: -90, rgb: [235, 210, 40], label: '90°W' },
] as const

export function checkerTexture(): Texture {
  const w = 2048
  const h = 1024
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const sq = w / 24 // 15° of longitude
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 12; j++) {
      g.fillStyle = (i + j) % 2 ? '#5a5a5a' : '#9a9a9a'
      g.fillRect(i * sq, j * sq, sq, sq)
    }
  }
  g.fillStyle = '#ffffff'
  g.fillRect(0, h / 2 - 2, w, 4) // equator
  const band = (4 / 360) * w // ±2°
  g.font = 'bold 40px sans-serif'
  for (const m of CHECKER_MERIDIANS) {
    const x = lonToX(m.lon, w)
    g.fillStyle = `rgb(${m.rgb.join(',')})`
    g.fillRect(x - band / 2, 0, band, h)
    if (m.lon === 180) g.fillRect(w - band / 2, 0, band, h) // wraps to both edges
    g.fillStyle = '#ffffff'
    g.fillText(m.label, ((x + band) % w) + 4, h / 2 - 12)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Soft radial glow for the Sun sprite (additive). */
export function glowTexture(): Texture {
  const s = 256
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  grad.addColorStop(0, 'rgba(255,244,228,0.9)')
  grad.addColorStop(0.08, 'rgba(255,236,210,0.45)')
  grad.addColorStop(0.25, 'rgba(255,220,180,0.10)')
  grad.addColorStop(0.6, 'rgba(255,210,170,0.02)')
  grad.addColorStop(1, 'rgba(255,210,170,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, s, s)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}
