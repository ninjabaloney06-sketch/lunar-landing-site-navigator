// Rockets the flight planner knows. The solver (plan.ts) reads nothing but these numbers, so adding a rocket is
// adding an entry here. SLS Block 1 is the default. Every performance number carries its source's wording.
import type { Vehicle } from './types'

// Shared planner assumptions (not facts about the rockets, so unsourced):
//   parkingAltKm 185, ascentLossKms 1.5, ascentTimeS 510, ascentArcDeg 20.

const NASA_SLS_BLOCK_TLI = {
  label: 'NASA NTRS 20180007908: SLS Block 1 and Block 1B payload capability',
  url: 'https://ntrs.nasa.gov/citations/20180007908',
}
const NASA_RL10_PAGE = {
  label: 'NASA: Space Launch System RL10 engine',
  url: 'https://www.nasa.gov/reference/space-launch-system-rl10-engine',
}
const NAS_PROPULSION_REVIEW = {
  label: 'National Academies: Review of US Air Force and DoD Aerospace Propulsion Needs (2006), p. 256',
  url: 'https://www.nationalacademies.org/read/11780/page/256',
}
const WIKI_DCSS = {
  label: 'Wikipedia: Delta Cryogenic Second Stage (ICPS infobox; fallback, no NASA page states mass)',
  url: 'https://en.wikipedia.org/wiki/Delta_Cryogenic_Second_Stage',
}
const WIKI_EUS = {
  label: 'Wikipedia: Exploration Upper Stage (specifications; fallback, not confirmed by NASA page)',
  url: 'https://en.wikipedia.org/wiki/Exploration_Upper_Stage',
}
const WIKI_AJ10 = {
  label: 'Wikipedia: AJ10 (AJ10-190 / Orion service module engine; fallback, agency page not opened)',
  url: 'https://en.wikipedia.org/wiki/AJ10',
}

export const VEHICLES: Vehicle[] = [
  {
    id: 'sls-block-1',
    name: 'SLS Block 1 (ICPS)',
    note: 'ICPS upper stage, one RL10B-2. Flown on Artemis I (uncrewed).',
    parkingAltKm: 185,
    ascentLossKms: 1.5,
    ascentTimeS: 510,
    ascentArcDeg: 20,
    // NASA: "The initial SLS configuration, Block 1, will deliver at least 26 metric tons (t) to trans-lunar injection (TLI)."
    // (The 27 t figure from Wikipedia is not stated by a NASA source, so 26 t is used.)
    injectedMassKg: 26000,
    // Wikipedia ICPS infobox: "Empty (dry) mass: 3,800 kg (8,400 lb)". No NASA page gives ICPS mass.
    tliStageDryKg: 3800,
    tliEngine: {
      name: 'RL10B-2',
      // Isp: "develops an Isp of 465.5 sec." (National Academies 2006 review, RL-10B-2)
      ispS: 465.5,
      // NASA: "producing 24,750 pounds (lbs.) or 110 kN of thrust" (ICPS, RL10B-2)
      thrustN: 110000,
    },
    spacecraftEngine: {
      name: 'OMS-E (AJ10-190)',
      // Wikipedia AJ10: "They produced 26.7 kilonewtons (6,000 lbf) of thrust with a specific impulse (Isp) of 316 seconds."
      ispS: 316,
      thrustN: 26700,
    },
    sources: [NASA_SLS_BLOCK_TLI, NASA_RL10_PAGE, NAS_PROPULSION_REVIEW, WIKI_DCSS, WIKI_AJ10],
  },
  {
    id: 'sls-block-1b',
    name: 'SLS Block 1B (EUS)',
    note: 'Exploration Upper Stage, four RL10C-3 engines. Cargo configuration payload used.',
    parkingAltKm: 185,
    ascentLossKms: 1.5,
    ascentTimeS: 510,
    ascentArcDeg: 20,
    // NASA: "at least 40 t to TLI in its cargo configuration." (crew configuration: at least 34 t)
    injectedMassKg: 40000,
    // Wikipedia EUS specifications: "Empty (dry) mass: 14,110 kg (31,110 lb)".
    tliStageDryKg: 14110,
    tliEngine: {
      name: 'RL10C-3 (x4)',
      // Wikipedia EUS specifications: "Specific impulse: 460.1 s (4.512 km/s)"
      ispS: 460.1,
      // NASA: "The four RL10 engines on EUS provide more than 97,000 lbs. (431 kN) of thrust." (total of four)
      thrustN: 431000,
    },
    spacecraftEngine: {
      name: 'OMS-E (AJ10-190)',
      ispS: 316,
      thrustN: 26700,
    },
    sources: [NASA_SLS_BLOCK_TLI, NASA_RL10_PAGE, WIKI_EUS, WIKI_AJ10],
  },
]

export const DEFAULT_VEHICLE_ID = 'sls-block-1'
