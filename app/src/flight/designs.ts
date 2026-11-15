// The two mission designs the flight calculator offers, as the reader sees them: Apollo and SLS (Artemis).
// SLS comes with one of two landers. Every statement here restates a sourced fact from spacecraft.ts
// (notes and surfaceStay), shortened to a bullet.
import { ARCHITECTURES } from './spacecraft'

/** The design a fresh link opens with: the current NASA plan (SLS, Orion, a lander waiting in the halo orbit). */
export const DEFAULT_ARCHITECTURE_ID = (ARCHITECTURES.find((a) => a.id === 'artemis-starship') ?? ARCHITECTURES[0]).id

export interface DesignChoice {
  id: 'apollo' | 'sls'
  title: string
  stack: string // launch vehicle · capsule · lander
  bullets: string[]
  /** Architecture ids behind this choice; the first is the default. */
  architectureIds: string[]
}

export const DESIGNS: DesignChoice[] = [
  {
    id: 'apollo',
    title: 'Apollo',
    stack: 'Saturn V · Command and Service Module · Lunar Module',
    bullets: [
      'One rocket launches capsule and lander together',
      'They part and meet again in low lunar orbit',
      'As flown 1969–1972: 21 h to 75 h on the surface',
    ],
    architectureIds: ['apollo'],
  },
  {
    id: 'sls',
    title: 'SLS (Artemis)',
    stack: 'SLS · Orion · Starship HLS or Blue Moon Mark 2',
    bullets: [
      'SLS sends Orion to a halo orbit around the Moon',
      'The lander launches separately and waits there',
      'Planned stay: about a week (one halo-orbit revolution, 6.5 days)',
    ],
    architectureIds: ['artemis-starship', 'artemis-blue-moon'],
  },
]

/** The lander behind each SLS architecture, for the lander switch. */
export const SLS_LANDERS: { architectureId: string; label: string }[] = [
  { architectureId: 'artemis-starship', label: 'Starship HLS' },
  { architectureId: 'artemis-blue-moon', label: 'Blue Moon Mark 2' },
]

export const designOf = (architectureId: string): DesignChoice => DESIGNS.find((d) => d.architectureIds.includes(architectureId)) ?? DESIGNS[0]

/** "Apollo", "SLS + Starship HLS": short enough for a table row. */
export function designShortName(architectureId: string): string {
  const d = designOf(architectureId)
  if (d.id === 'apollo') return 'Apollo'
  const lander = SLS_LANDERS.find((l) => l.architectureId === architectureId)
  return lander ? `SLS + ${lander.label}` : d.title
}

// Every architecture is offered by exactly one choice (checked by the tests).
export const ALL_OFFERED = ARCHITECTURES.every((a) => DESIGNS.some((d) => d.architectureIds.includes(a.id)))
