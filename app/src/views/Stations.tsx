// Ground-station checklist: the one place stations are chosen (Mission panel). Every station is selected by
// default; at least one stays selected. The details drawer shows their state and links here.
import type { Station } from '../data/types'

interface Props {
  stations: Station[]
  ids: string[]
  onToggle(id: string): void
}

export function StationChecklist({ stations, ids, onToggle }: Props) {
  return (
    <>
      <ul className="plain checklist">
        {stations.map((s) => {
          const on = ids.includes(s.id)
          return (
            <li key={s.id}>
              <label className="check">
                <input type="checkbox" checked={on} disabled={on && ids.length === 1} onChange={() => onToggle(s.id)} />
                <span>
                  {s.complex}
                  <span className="th-sub">
                    {s.name} · {s.network}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {ids.length === 1 && <p className="quiet">At least one station stays selected.</p>}
    </>
  )
}
