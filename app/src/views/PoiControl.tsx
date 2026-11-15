// Points-of-interest layer in the top bar (U2): one button switches it on and off (off by default, so a first visit
// shows the plain scene); while it is on, a key under the top bar's buttons names each group beside its colour and
// switches single groups. The groups live in the URL hash (state.ts `poi`).
import { useRef } from 'react'
import { POI_GROUPS } from '../data/pois'
import type { PoiGroup } from '../data/pois'
import type { PoiData } from './poiLayer'
import { REGION_TEXT } from './poiLayer'

interface Props {
  groups: PoiGroup[] | null // null = off
  data: PoiData
  counts: Record<PoiGroup, number> | null // pins per group once loaded
  webgl: boolean // without the 3D view there are no pins to draw
  onChange(groups: PoiGroup[] | null): void
}

const ALL = POI_GROUPS.map((g) => g.id)

/** What each group holds (U17), from the record categories in pois.json: shown on hover over the group's name. */
export const GROUP_HINT: Record<PoiGroup, string> = {
  hazard: 'Thrust scarps, a shallow moonquake and landing outcomes from published studies',
  water: 'Hydrogen maxima (LEND, Lunar Exploration Neutron Detector) and LCROSS impact points',
  'cold-trap': 'Permanently shadowed regions (PSR) from two catalogues, and their host craters',
  light: 'Modelled illumination points from published studies',
  landing: 'Artemis III regions, points from published studies, and past or planned landing and impact sites',
  science: 'Craters, massifs and crater ages from published sources',
}

export function PoiToggle({ groups, onChange }: Pick<Props, 'groups' | 'onChange'>) {
  // Switching off and on again brings back the groups chosen before (all of them the first time).
  const last = useRef<PoiGroup[]>(groups ?? ALL)
  if (groups) last.current = groups
  const on = groups !== null
  return (
    <button
      type="button"
      className="find poi-toggle"
      data-testid="poi-toggle"
      aria-pressed={on}
      aria-controls={on ? 'poi-key' : undefined}
      onClick={() => onChange(on ? null : last.current.length ? last.current : ALL)}
    >
      Points of interest
    </button>
  )
}

export function PoiKey({ groups, data, counts, webgl, onChange }: Props & { groups: PoiGroup[] }) {
  const toggle = (g: PoiGroup) => onChange(ALL.filter((x) => (x === g ? !groups.includes(g) : groups.includes(x))))
  return (
    <div id="poi-key" className="poi-key" role="group" aria-label="Points of interest shown" data-testid="poi-key">
      <ul className="plain poi-key-list">
        {POI_GROUPS.map((g) => (
          <li key={g.id}>
            <label className="check poi-key-item" data-group={g.id} title={GROUP_HINT[g.id]}>
              <input type="checkbox" checked={groups.includes(g.id)} onChange={() => toggle(g.id)} />
              <span className="poi-swatch" style={{ background: g.color }} aria-hidden="true" />
              <span className="poi-key-name">{g.label}</span>
              {counts && (
                <span className="poi-key-n mono" aria-label={`${counts[g.id]} pins`}>
                  {counts[g.id]}
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
      <p className="poi-key-note" data-testid="poi-key-note" data-state={data.status}>
        {data.status === 'error'
          ? `Could not load the points of interest. ${data.error}`
          : data.status === 'ready'
            ? `Pins per group, ${REGION_TEXT}; the app's own sites are not counted. ${webgl ? 'Hover or tap a pin to read about it.' : 'The 3D view is not available, so no pins are drawn.'}`
            : 'Loading the points of interest…'}
      </p>
    </div>
  )
}
