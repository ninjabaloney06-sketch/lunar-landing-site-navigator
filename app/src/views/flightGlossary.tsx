// Every abbreviation and symbol that the Rocket flight menu shows, with what it stands for and one line on what it
// means. One list feeds two things: the glossary section of the menu, and <Abbr>, which marks the abbreviations
// inside any text of the menu (event names, stage names, notes) with <abbr title="long form: meaning"> so that a
// pointer or a screen reader gets the long form and a plain meaning where the short one is used.
import type { ReactNode } from 'react'
import type { SourceRef } from '../flight/types'

export interface GlossaryEntry {
  term: string // as shown: "TLI", "Max Q", "Δv"
  name: string // what it stands for
  meaning: string // one line
  group: 'burn' | 'orbit' | 'hardware' | 'unit'
  /** Regular-expression source that finds the term in running text. Left out: the term itself. null: the term is
   *  listed in the glossary but not marked in text (a single letter would match too much). */
  match?: string | null
}

export const GLOSSARY: GlossaryEntry[] = [
  // Burns and events, in the order of a mission
  { term: 'Max Q', name: 'Maximum dynamic pressure', meaning: 'The moment of the ascent when the air presses hardest on the rocket. The engines are throttled down around it.', group: 'burn' },
  { term: 'Mach 1', name: 'The speed of sound', meaning: 'The rocket passes it early in the ascent, shortly before Max Q.', group: 'burn' },
  { term: 'MECO', name: 'Main Engine Cutoff', meaning: 'The core stage engines shut down; the stage has done its work.', group: 'burn' },
  { term: 'CECO', name: 'Center Engine Cutoff', meaning: 'Saturn V: the middle engine of a stage shuts down before the others, to limit the acceleration and vibration.', group: 'burn' },
  { term: 'OECO', name: 'Outboard Engine Cutoff', meaning: 'Saturn V: the four outer engines of a stage shut down; the stage is spent.', group: 'burn' },
  { term: 'TLI', name: 'Trans-Lunar Injection', meaning: 'The burn that leaves Earth orbit for the Moon.', group: 'burn' },
  { term: 'OTC', name: 'Outbound Trajectory Correction', meaning: 'A small burn on the way to the Moon that trims the path.', group: 'burn' },
  { term: 'OPF', name: 'Outbound Powered Flyby', meaning: 'Artemis: a burn at the closest pass by the Moon on the way in. With the Moon’s pull it bends the path toward the halo orbit.', group: 'burn' },
  { term: 'LOI', name: 'Lunar Orbit Insertion', meaning: 'The braking burn at the Moon that turns the flyby into an orbit.', group: 'burn' },
  { term: 'NRI', name: 'NRHO Insertion', meaning: 'Artemis: the burn that puts the capsule on the near-rectilinear halo orbit.', group: 'burn' },
  { term: 'LOPC', name: 'Lunar Orbit Plane Change', meaning: 'Apollo: a burn that turns the plane of the orbit, here so that it passes over the landing point at liftoff ("Plane change" in the events).', group: 'burn' },
  { term: 'DOI', name: 'Descent Orbit Insertion', meaning: 'Lowers the low point of the lander’s orbit to about 15 km, where the landing burn starts.', group: 'burn' },
  { term: 'PDI', name: 'Powered Descent Initiation', meaning: 'The start of the long braking burn that ends with the touchdown.', group: 'burn' },
  { term: 'TPI', name: 'Terminal Phase Initiation', meaning: 'After the lunar liftoff: the burn that sends the lander on a path that meets the capsule.', group: 'burn' },
  { term: 'TPF', name: 'Terminal Phase Finalization', meaning: 'The braking at the end of that path, which matches the lander’s speed to the capsule’s for docking.', group: 'burn' },
  { term: 'NRD', name: 'NRHO Departure', meaning: 'Artemis: the burn that leaves the halo orbit for home.', group: 'burn' },
  { term: 'RPF', name: 'Return Powered Flyby', meaning: 'Artemis: a burn at a close pass by the Moon on the way out, which sends the capsule to Earth.', group: 'burn' },
  { term: 'TEI', name: 'Trans-Earth Injection', meaning: 'The burn that leaves lunar orbit for Earth.', group: 'burn' },
  { term: 'EI', name: 'Entry Interface', meaning: 'The point 400,000 ft (122 km) above Earth from which the atmospheric entry is counted. The plans here end at it.', group: 'burn' },

  // Orbits
  { term: 'NRHO', name: 'Near-Rectilinear Halo Orbit', meaning: 'A week-long loop over the Moon’s poles, balanced between the pull of Earth and of the Moon. See "The halo orbit".', group: 'orbit' },
  { term: 'LLO', name: 'Low Lunar Orbit', meaning: 'A circular orbit about 100 km above the Moon, flown in about two hours.', group: 'orbit' },
  { term: 'LOR', name: 'Lunar Orbit Rendezvous', meaning: 'Apollo’s method: only a small lander goes down, and it meets the mother ship again in lunar orbit.', group: 'orbit' },

  // Vehicles, stages, engines
  { term: 'SLS', name: 'Space Launch System', meaning: 'NASA’s rocket for Orion. Block 1 flies with the ICPS upper stage, Block 1B with the larger EUS.', group: 'hardware' },
  { term: 'ICPS', name: 'Interim Cryogenic Propulsion Stage', meaning: 'The upper stage of SLS Block 1. It performs the TLI.', group: 'hardware' },
  { term: 'EUS', name: 'Exploration Upper Stage', meaning: 'The larger upper stage of SLS Block 1B.', group: 'hardware' },
  { term: 'RL10', name: 'RL10 (an engine name)', meaning: 'The hydrogen and oxygen engine of the SLS upper stages: one RL10B-2 on the ICPS, four RL10C-3 on the EUS.', group: 'hardware', match: 'RL10[A-Z0-9-]*' },
  { term: 'RS-25', name: 'RS-25 (an engine name)', meaning: 'The four engines of the SLS core stage, formerly the Space Shuttle main engine.', group: 'hardware' },
  { term: 'ESM', name: 'European Service Module', meaning: 'Orion’s service module, built in Europe: propellant, power, air and water, and the main engine.', group: 'hardware' },
  { term: 'OMS-E', name: 'Orbital Maneuvering System Engine', meaning: 'The main engine of the European Service Module. It flies every Orion burn after TLI.', group: 'hardware' },
  { term: 'HLS', name: 'Human Landing System', meaning: 'NASA’s name for the Artemis landers: Starship HLS and Blue Moon Mark 2.', group: 'hardware' },
  { term: 'RVac', name: 'Raptor Vacuum', meaning: 'The Starship engine with the large nozzle for use in space.', group: 'hardware' },
  { term: 'BE-7', name: 'BE-7 (an engine name)', meaning: 'Blue Origin’s hydrogen and oxygen engine of the Blue Moon lander.', group: 'hardware' },
  { term: 'MK2', name: 'Mark 2', meaning: 'The crewed version of the Blue Moon lander.', group: 'hardware' },
  { term: 'CSM', name: 'Command and Service Module', meaning: 'The Apollo mother ship: the capsule and the module with its engine and supplies.', group: 'hardware' },
  { term: 'CM', name: 'Command Module (Apollo), Crew Module (Orion)', meaning: 'The capsule itself: the part the crew returns to Earth in.', group: 'hardware' },
  { term: 'SM', name: 'Service Module', meaning: 'The Apollo module behind the capsule with the SPS engine, propellant and supplies.', group: 'hardware' },
  { term: 'SPS', name: 'Service Propulsion System', meaning: 'The Apollo service module’s engine. It flies LOI and TEI.', group: 'hardware' },
  { term: 'LM', name: 'Lunar Module', meaning: 'The Apollo lander, in two stages.', group: 'hardware' },
  { term: 'DPS', name: 'Descent Propulsion System', meaning: 'The engine of the Lunar Module’s descent stage.', group: 'hardware' },
  { term: 'APS', name: 'Ascent Propulsion System', meaning: 'The engine of the Lunar Module’s ascent stage.', group: 'hardware' },
  { term: 'S-IC', name: 'Saturn V first stage', meaning: 'Five F-1 engines, kerosene and oxygen.', group: 'hardware' },
  { term: 'S-II', name: 'Saturn V second stage', meaning: 'Five J-2 engines, hydrogen and oxygen.', group: 'hardware' },
  { term: 'S-IVB', name: 'Saturn V third stage', meaning: 'One J-2 engine. It finishes the ascent and performs the TLI.', group: 'hardware' },
  { term: 'F-1', name: 'F-1 (an engine name)', meaning: 'The engine of the Saturn V first stage.', group: 'hardware' },
  { term: 'J-2', name: 'J-2 (an engine name)', meaning: 'The engine of the Saturn V second and third stages.', group: 'hardware' },
  { term: 'LC-39B', name: 'Launch Complex 39B', meaning: 'The SLS launchpad at Kennedy Space Center. Other pads carry their site’s own names.', group: 'hardware' },

  // Units, symbols, data
  { term: 'Δv', name: 'Delta-v', meaning: 'Change in velocity a burn must deliver, in m/s. The Δv of all burns is the cost of a mission; with the engine and the mass it gives the propellant.', group: 'unit' },
  { term: 'Isp', name: 'Specific impulse', meaning: 'How efficiently an engine uses propellant, in seconds: the higher, the less propellant for the same Δv.', group: 'unit' },
  { term: '1σ', name: 'One standard deviation', meaning: 'About 68 % of outcomes fall within this distance of the value, if the errors are normally distributed.', group: 'unit' },
  { term: '3σ', name: 'Three standard deviations', meaning: 'About 99.7 % of outcomes fall within this distance of the value, if the errors are normally distributed.', group: 'unit' },
  { term: 'J2', name: 'Oblateness term of a gravity field', meaning: 'The largest correction to a round planet’s gravity, from its flattening at the poles.', group: 'unit' },
  { term: 'v∞', name: 'Hyperbolic excess speed', meaning: 'The speed relative to the Moon that the craft arrives with, counted far out, before the Moon’s pull speeds it up.', group: 'unit' },
  { term: 'UTC', name: 'Coordinated Universal Time', meaning: 'Every time in this menu.', group: 'unit' },
  { term: 'T+', name: 'Time since liftoff', meaning: 'The mission elapsed time in the playback bar.', group: 'unit', match: null },
  { term: 'g', name: 'Standard gravity, 9.81 m/s²', meaning: 'Unit of acceleration: "hold 3.25 g" keeps the crew at 3.25 times their weight.', group: 'unit', match: null },
  { term: 't', name: 'Tonne, 1,000 kg', meaning: 'Unit of the propellant masses.', group: 'unit', match: null },
  { term: 'MJ/kg', name: 'Megajoule per kilogram', meaning: 'Energy per mass. 3.6 MJ are 1 kWh.', group: 'unit', match: null },
  { term: 'DE440', name: 'Development Ephemeris 440', meaning: 'The Jet Propulsion Laboratory’s table of where the Moon, Earth and Sun are, used for every plan here.', group: 'unit' },
  { term: 'JPL', name: 'Jet Propulsion Laboratory', meaning: 'The NASA centre that publishes the ephemeris.', group: 'unit' },
  { term: 'J2000', name: 'The reference axes of 1 January 2000', meaning: 'Directions fixed to the stars: the 3D view does not turn with Earth or the Moon.', group: 'unit' },
]

export const GLOSSARY_GROUPS: { id: GlossaryEntry['group']; title: string }[] = [
  { id: 'burn', title: 'Burns and events' },
  { id: 'orbit', title: 'Orbits' },
  { id: 'hardware', title: 'Vehicles, stages and engines' },
  { id: 'unit', title: 'Units, symbols and data' },
]

export const GLOSSARY_SOURCES: SourceRef[] = [
  { label: 'NASA: Apollo 11 Flight Plan, abbreviations (DOI, PDI, TPI, TPF, SPS, EI)', url: 'https://www.nasa.gov/wp-content/uploads/2025/11/a11fltpln-final-reformat.pdf' },
  { label: 'NASA: Trajectory Operations of the Artemis I Mission (TLI, ICPS, OTC, OPF, RPF, EI)', url: 'https://ntrs.nasa.gov/api/citations/20230010480/downloads/AAS_23-363_artemis1-operations_rev2.pdf' },
  { label: 'NASA: Artemis I Orion-ESM Propulsion System Engine Performance (ESM, OMS-E)', url: 'https://ntrs.nasa.gov/api/citations/20240003648/downloads/382_BELAIR_ARTEMIS_I_ENGINE_PERFORMANCE_FINAL.pdf' },
  { label: 'NASA: Artemis II Press Kit (Entry Interface at 400,000 feet)', url: 'https://www.nasa.gov/artemis-ii-press-kit/' },
  { label: 'NASA: Space Launch System Block 1B (EUS)', url: 'https://www.nasa.gov/reference/sls-space-launch-system-block-1b/' },
  { label: 'NASA: Apollo by the Numbers, Apollo 11 timeline (center and outboard engine cutoff)', url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11i_Timeline.htm' },
]

// One expression for all marked terms, longest first, so "S-IVB" wins over "S-II" and "OMS-E" over a bare word.
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const MARKED = GLOSSARY.filter((g) => g.match !== null).sort((a, b) => b.term.length - a.term.length)
const TERM_RE = new RegExp(`(?<![A-Za-z0-9-])(?:${MARKED.map((g) => `(${g.match ?? esc(g.term)})`).join('|')})(?![A-Za-z0-9])`, 'g')

/** What a pointer shows over a term: "Delta-v — Change in velocity a burn must deliver, in m/s." (the long form and
 *  the first sentence of the meaning, so the hover stays short). */
export function hoverText(g: GlossaryEntry): string {
  const first = g.meaning.split(/(?<=\.) /)[0]
  return `${g.name} — ${first}`
}

/** The hover text of a term, or null when it is not in the glossary. */
export function hoverOf(term: string): string | null {
  const g = GLOSSARY.find((x) => x.term === term)
  return g ? hoverText(g) : null
}

/** The long form of an abbreviation, or null when it is not in the glossary. */
export function expand(term: string): string | null {
  return GLOSSARY.find((g) => g.term === term)?.name ?? null
}

/** Text with every glossary term in it marked as an abbreviation. */
export function Abbr({ children }: { children: string }): ReactNode {
  const out: ReactNode[] = []
  let last = 0
  for (const m of children.matchAll(TERM_RE)) {
    const at = m.index
    const entry = MARKED[m.slice(1).findIndex((x) => x !== undefined)]
    if (at > last) out.push(children.slice(last, at))
    out.push(
      <abbr key={at} title={hoverText(entry)}>
        {m[0]}
      </abbr>,
    )
    last = at + m[0].length
  }
  if (out.length === 0) return children
  if (last < children.length) out.push(children.slice(last))
  return out
}
