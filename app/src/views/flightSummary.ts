// One line for the flight choices a saved mission carries, shared by the mission table and the Mission panel.
import { DEFAULT_ARCHITECTURE_ID, designShortName } from '../flight/designs'
import { DEFAULT_PAD_ID, LAUNCHPADS } from '../flight/pads'
import { ARCHITECTURES } from '../flight/spacecraft'
import type { MissionState } from '../missions'
import { missionStay } from './useFlight'

/** "LC-39B · SLS + Starship HLS · 14 d on the surface": the flight choices a saved mission carries. A mission saved
 *  without a stay of its own stays for its mission days (`missionDays`), as the flight plan does. */
export function flightSummary(m: MissionState, missionDays: number): string {
  const pad = LAUNCHPADS.find((x) => x.id === m.pad) ?? LAUNCHPADS.find((x) => x.id === DEFAULT_PAD_ID) ?? LAUNCHPADS[0]
  const arch = ARCHITECTURES.find((a) => a.id === m.rocket) ?? ARCHITECTURES.find((a) => a.id === DEFAULT_ARCHITECTURE_ID)!
  const stay = m.stay ?? missionStay(missionDays).days
  return `${pad.name} · ${designShortName(arch.id)} · ${Number(stay.toFixed(1))} d on the surface`
}
