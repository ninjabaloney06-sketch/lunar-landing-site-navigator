// The viewpoint menu (Brief C4 part 2). One list, two places: under the "View" button beside the timeline
// (keyboard and touch) and at the pointer after a right-click on the scene. Arrow keys move, Enter or Space
// chooses, Esc closes and gives the focus back.
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { Viewpoint } from '../scene3d'

export const VIEWPOINTS: { id: Viewpoint; label: string }[] = [
  { id: 'moon', label: 'Moon' },
  { id: 'start', label: 'Point start' },
  { id: 'end', label: 'Point end' },
  { id: 'earth', label: 'Earth' },
  { id: 'sun', label: 'Sun' },
  { id: 'top', label: 'Solar system — top view' },
]

export interface ViewItem {
  id: string
  label: string
  disabled?: boolean
  current?: boolean // the level the scene is at
  separated?: boolean // a rule above this entry
  onSelect(): void
}

interface Props {
  label: string
  items: ViewItem[]
  className?: string
  at?: { x: number; y: number } // right-click position inside the stage; the menu is kept inside it
  testId: string
  onClose(returnFocus: boolean): void
}

export function ViewMenu({ label, items, className, at, testId, onClose }: Props) {
  const root = useRef<HTMLDivElement>(null)

  const enabled = () => [...(root.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)') ?? [])]

  useEffect(() => {
    enabled()[0]?.focus({ preventScroll: true })
    // on open only
  }, [])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element
      if (root.current && !root.current.contains(t) && !t.closest?.('[data-menu-trigger]')) onClose(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [onClose])

  // A menu opened at the pointer moves left or up when it would leave the stage.
  useLayoutEffect(() => {
    const el = root.current
    const box = el?.offsetParent as HTMLElement | null
    if (!at || !el || !box) return
    el.style.left = `${Math.max(8, Math.min(at.x, box.clientWidth - el.offsetWidth - 8))}px`
    el.style.top = `${Math.max(8, Math.min(at.y, box.clientHeight - el.offsetHeight - 8))}px`
  }, [at])

  const onKey = (e: React.KeyboardEvent) => {
    const list = enabled()
    const i = list.indexOf(document.activeElement as HTMLButtonElement)
    const go = (n: number) => {
      e.preventDefault()
      list[(n + list.length) % list.length]?.focus()
    }
    if (e.key === 'ArrowDown') go(i + 1)
    else if (e.key === 'ArrowUp') go(i - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(list.length - 1)
    else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose(true)
    } else if (e.key === 'Tab') onClose(false)
  }

  const style: CSSProperties | undefined = at ? { left: at.x, top: at.y } : undefined
  return (
    <div ref={root} className={`view-menu ${className ?? ''}`} role="menu" aria-label={label} data-testid={testId} style={style} onKeyDown={onKey}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="menuitem"
          className={`view-item${it.separated ? ' is-separated' : ''}`}
          data-item={it.id}
          disabled={it.disabled}
          aria-current={it.current ? 'true' : undefined}
          onClick={() => {
            onClose(true)
            it.onSelect()
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
