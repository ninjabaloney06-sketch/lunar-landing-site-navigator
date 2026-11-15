// Click outside closes (U9): the mechanism the date menu, the Mission panel and the View menu already used, as one
// hook. A press (pointerdown, capture phase, so a handler inside the page that stops it cannot hide it) anywhere
// outside `root` calls onOutside: the 3D canvas, the header and the timeline count as outside. A press on an element
// marked `data-menu-trigger` (the button that opens and closes this very menu) is left to that button's own click.
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

export function isOutside(root: Element | null, target: EventTarget | null): boolean {
  if (!root || !(target instanceof Element)) return false
  if (root.contains(target)) return false
  return !target.closest('[data-menu-trigger]')
}

/** Calls onOutside on a press outside root while active is true. */
export function useClickOutside(root: RefObject<Element | null>, onOutside: () => void, active = true): void {
  const cb = useRef(onOutside)
  cb.current = onOutside
  useEffect(() => {
    if (!active) return
    const onDown = (e: PointerEvent) => {
      if (isOutside(root.current, e.target)) cb.current()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [root, active])
}
