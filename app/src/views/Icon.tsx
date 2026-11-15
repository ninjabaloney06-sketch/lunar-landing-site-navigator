// The icons the plan allows (ninja, 14 Nov): Ionicons rocket, warning and settings outlines (MIT), used as static
// SVG files that Vite bundles at build time. No Ionicons web component and no icon font: the SVG is a CSS mask
// filled with currentColor, so the icon always matches the text it sits beside.
// Relative paths, because the package's `exports` map hides dist/svg; its `ionicons/icons` strings rely on the
// web component's CSS for their strokes and would render as filled shapes.
import rocket from '../../node_modules/ionicons/dist/svg/rocket-outline.svg'
import warning from '../../node_modules/ionicons/dist/svg/warning-outline.svg'
import settings from '../../node_modules/ionicons/dist/svg/settings-outline.svg'
import info from '../../node_modules/ionicons/dist/svg/information-circle-outline.svg' // U4 (15 Nov): information-circle-outline
import type { CSSProperties } from 'react'

const SRC = { rocket, warning, settings, info }

export function Icon({ name }: { name: keyof typeof SRC }) {
  return <span className={`icon icon-${name}`} aria-hidden="true" style={{ '--icon': `url("${SRC[name]}")` } as CSSProperties} />
}
