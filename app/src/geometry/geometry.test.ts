import { describe, expect, it } from 'vitest'
import { MOON_RADIUS_KM } from './index'

describe('geometry skeleton', () => {
  it('uses the 1737.4 km reference sphere', () => {
    expect(MOON_RADIUS_KM).toBe(1737.4)
  })
})
