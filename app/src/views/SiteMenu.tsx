// Site menu (mockup v4, menu open): search that also accepts typed coordinates, grouped list, selected row
// highlighted, and the "Add a point" row, disabled until the step-7 terrain checks pass (never flat-horizon
// numbers at the pole).
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Site } from '../data/types'
import type { UserPoint } from '../state'
import { fmtCoords, parseCoords } from './format'

// Every group in the site contract has a home, so no site is unreachable (UX-04).
const GROUPS: { title: string; groups: Site['group'][] }[] = [
  { title: 'Artemis regions, NASA 2024', groups: ['artemis-2024'] },
  { title: 'Artemis regions, NASA 2022', groups: ['artemis-2022'] },
  { title: 'Reference points', groups: ['reference'] },
  { title: 'Landers', groups: ['clps', 'commercial', 'international', 'apollo'] },
]

interface Props {
  sites: Site[]
  currentId: string
  points: UserPoint[]
  onSelect(id: string): void
  onClose(): void
}

export function SiteMenu({ sites, currentId, points, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(() => Math.max(0, GROUPS.flatMap((g) => sites.filter((s) => g.groups.includes(s.group))).findIndex((s) => s.id === currentId)))
  const input = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    input.current?.focus()
    // The selected site may sit far down the list (reference points): show it on open.
    root.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element
      if (root.current && !root.current.contains(t) && !t.closest?.('[data-menu-trigger]')) onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [onClose])

  const coords = parseCoords(query)
  const q = query.trim().toLowerCase()
  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({
        title: g.title,
        items: sites.filter((s) => g.groups.includes(s.group) && (coords.kind !== 'none' || !q || `${s.name} ${s.label ?? ''}`.toLowerCase().includes(q))),
      })).filter((g) => g.items.length > 0),
    [sites, q, coords.kind],
  )
  const flat = groups.flatMap((g) => g.items)
  const activeIdx = Math.min(active, Math.max(0, flat.length - 1))

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((activeIdx + 1) % Math.max(1, flat.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((activeIdx - 1 + flat.length) % Math.max(1, flat.length))
    } else if (e.key === 'Enter' && coords.kind === 'none' && flat[activeIdx]) {
      e.preventDefault()
      onSelect(flat[activeIdx].id)
    }
  }

  return (
    <div ref={root} className="popover menu site-menu" role="dialog" aria-label="Choose a site" onKeyDown={onKey}>
      <div className="menu-search">
        <input
          ref={input}
          className="field"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="site-list"
          aria-activedescendant={flat[activeIdx] ? `site-opt-${flat[activeIdx].id}` : undefined}
          aria-label="Search a site or type coordinates"
          placeholder="Search a site or type coordinates"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
        />
      </div>
      {coords.kind === 'error' && (
        <p className="menu-msg is-error" role="alert">
          {coords.message}
        </p>
      )}
      {coords.kind === 'ok' && (
        <p className="menu-msg" role="status">
          <span className="mono">{fmtCoords(coords.lat, coords.lon)}</span>: adding points is coming after terrain checks.
        </p>
      )}
      <div id="site-list" className="menu-list" role="listbox" aria-label="Sites">
        {groups.map((g) => (
          <div key={g.title} role="group" aria-label={g.title}>
            <div className="menu-group">{g.title}</div>
            {g.items.map((s) => {
              const i = flat.indexOf(s)
              return (
                <div
                  key={s.id}
                  id={`site-opt-${s.id}`}
                  role="option"
                  aria-selected={s.id === currentId}
                  className={`opt${i === activeIdx ? ' is-active' : ''}`}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => onSelect(s.id)}
                >
                  <span className="opt-name">
                    {s.name}
                    {s.label && <span className="opt-label"> {s.label}</span>}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
        {coords.kind === 'none' && q && flat.length === 0 && <p className="menu-msg">No site matches “{query.trim()}”.</p>}
        <div role="group" aria-label="Your points">
          <div className="menu-group">Your points</div>
          {points.length === 0 && <p className="menu-msg is-quiet">None yet.</p>}
          {points.map((p, i) => (
            <div key={i} className="opt is-disabled" role="option" aria-selected="false" aria-disabled="true">
              <span className="opt-name">Point {String.fromCharCode(65 + i)}</span>
              <span className="opt-meta mono">{fmtCoords(p.lat, p.lon)}</span>
            </div>
          ))}
        </div>
      </div>
      <button className="menu-add" type="button" disabled>
        Add a point: click the terrain, or type coordinates above
        <span className="menu-add-note">coming after terrain checks</span>
      </button>
    </div>
  )
}
