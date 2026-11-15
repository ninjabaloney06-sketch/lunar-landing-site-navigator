// Timeline tick texts never touch (visual defect 15: "Docking" on "TEI", "Touchdown" stacked on "LOI"): one line
// only, placed by priority; a text that would touch one already placed is left out (its name stays in the
// tooltip, at the burn in the 3D view and in the panel's table).
import { describe, expect, it } from 'vitest'
import { textRows } from './FlightTransport'

const CHAR_PX = 7.2
const GAP = 4

function boxes(ticks: { id: string; pct: number; text: string | null }[], px: number, rows: (0 | null)[]) {
  return ticks
    .map((t, i) => ({ t, on: rows[i] === 0 }))
    .filter((x) => x.on)
    .map(({ t }) => {
      const half = (t.text!.length * CHAR_PX) / 2 + GAP
      const left = Math.min(Math.max((t.pct / 100) * px - half, 0), px - 2 * half)
      return [left, left + 2 * half] as const
    })
}

describe('textRows', () => {
  // the Apollo plan of the visual sweep at 1280 px (track ≈ 750 px): LOI and touchdown, docking and TEI close
  const ticks = [
    { id: 'tli', pct: 0.4, text: 'TLI' },
    { id: 'loi', pct: 47.4, text: 'LOI' },
    { id: 'touchdown', pct: 48.4, text: 'Touchdown' },
    { id: 'docking', pct: 57.6, text: 'Docking' },
    { id: 'tei', pct: 60.3, text: 'TEI' },
    { id: 'ei', pct: 100, text: 'EI' },
  ]
  for (const px of [750, 310]) {
    it(`no two texts overlap and none leaves the track (${px} px)`, () => {
      const rows = textRows(ticks, px)
      const b = boxes(ticks, px, rows)
      for (let i = 0; i < b.length; i++) {
        expect(b[i][0]).toBeGreaterThanOrEqual(0)
        expect(b[i][1]).toBeLessThanOrEqual(px + 1e-9)
        for (let j = i + 1; j < b.length; j++) expect(b[i][0] < b[j][1] && b[i][1] > b[j][0]).toBe(false)
      }
      // the higher-priority texts win: touchdown over LOI, TEI over docking
      expect(rows[2]).toBe(0)
      expect(rows[1]).toBeNull()
      expect(rows[0]).toBe(0)
      // at 1280 px there is room for TEI beside touchdown; on a phone touchdown takes the room
      if (px === 750) expect(rows[4]).toBe(0)
    })
  }
})
