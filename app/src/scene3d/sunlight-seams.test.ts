// Scene audit (15 Nov): no seam in the drawn Sun share at the strip edge or the 400 m site patch, at any of the 18
// sites, with the site's real horizon file, for the Sun at the mask, a little under and a little over it. On flat
// ground the share along a cut across the strip depends only on the strip's fade and the site patch's fade, both
// smoothsteps, so a step between samples 10 m apart is small; the crest line itself (a real shadow edge) is not
// crossed. A jump here would be a seam in the picture.
import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import type { Horizon } from '../data/types'
import { maskAt } from '../geometry'
import { enuDir } from './frames'
import { drawnShare, sunCrest } from './sunlight'

const SITES = [
  'haworth', 'malapert-massif', 'nobile-rim-1', 'nobile-rim-2', 'de-gerlache-rim-2', 'amundsen-rim', 'connecting-ridge-extension', 'faustini-rim-a',
  'leibnitz-beta-plateau', 'peak-near-shackleton', 'de-gerlache-rim-1', 'de-gerlache-kocher-massif', 'malapert-site23', 'shackleton-rim-site04',
  'connecting-ridge', 'im-1', 'im-2-intended', 'viper-mons-mouton',
]
const RAW = import.meta.glob<string>('../../public/data/horizons/*.json', { query: '?raw', import: 'default', eager: true })
const STEP_MAX = 0.065

describe('sunlight seams at all 18 sites', () => {
  for (const id of SITES) {
    it(id, () => {
      const h = JSON.parse(RAW[`../../public/data/horizons/${id}.json`]) as Horizon
      let worst = 0
      for (let az = 0; az < 360; az += 15) {
        const m = maskAt(h, az)
        for (const el of [m - 0.3, m, m + 0.3]) {
          const c = sunCrest(h, enuDir(az, el), 0.267)
          for (const site of [0, 0.12, 0.5, 1]) {
            for (const behind of [0, 700, 2000]) {
              let prev: number | null = null
              for (let l = -9000; l <= 9000; l += 10) {
                const p = new Vector3(-c.horiz.x * behind - c.horiz.y * l, -c.horiz.y * behind + c.horiz.x * l, 0)
                const v = drawnShare(c, p, site, 0)
                if (prev !== null) worst = Math.max(worst, Math.abs(v - prev))
                prev = v
              }
            }
          }
        }
      }
      expect(worst).toBeLessThanOrEqual(STEP_MAX)
    })
  }
})
