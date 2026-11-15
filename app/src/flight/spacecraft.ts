// Spacecraft the mission simulators know: capsules and landers, and the architectures that combine them with
// a launch vehicle. The simulators (lunar.ts, mission.ts) read nothing else about a spacecraft, so adding one
// is adding an entry here.
//
// Rule: every number carries the wording of a source that states it, in the comment above it. Numbers are
// written in the source's own unit and converted in code (LB, LBF, FT), so the source's figure stays visible.
// Where two stated numbers are subtracted, the comment shows both. Where no agency or manufacturer states a
// number, the comment starts with ASSUMPTION (a value of this file's own choosing, with the reasoning) or
// with FALLBACK (stated only by Wikipedia). Starship HLS and Blue Moon Mark 2 consist mostly of those two
// kinds: treat what the simulators compute for them as an illustration, not as a prediction.
//
// Apollo numbers are those of Apollo 11 where a mission-specific figure exists. Abbreviations in the comments:
// ABTN = Apollo by the Numbers (NASA SP-2000-4029); MR = Apollo 11 Mission Report (MSC-00171). MR, TM X-58040,
// TN D-7143 and the News References are scans: their wording was read through the scans' text layer (OCR).
import type { ArchitectureSpec, SpacecraftSpec } from './hardware'
import type { SourceRef } from './types'

const LB = 0.45359237 // kg per pound (exact, international avoirdupois pound)
const LBF = 4.4482216152605 // N per pound-force (exact)
const FT = 0.3048 // m per foot (exact)

// ---- Sources
const ABTN_KEY_FACTS_LM: SourceRef = {
  label: 'NASA SP-2000-4029, Apollo by the Numbers: Launch Vehicle/Spacecraft Key Facts (LM, CM; press-kit values)',
  url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_18-13_Launch_Vehicle-Spacecraft_Key_Facts.htm',
}
const ABTN_KEY_FACTS_SM: SourceRef = {
  label: 'NASA SP-2000-4029, Apollo by the Numbers: Launch Vehicle/Spacecraft Key Facts (SM, SPS)',
  url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_18-12_Launch_Vehicle-Spacecraft_Key_Facts.htm',
}
const ABTN_DPS_PROPELLANT: SourceRef = {
  label: 'NASA SP-2000-4029, Apollo by the Numbers: LM Descent Stage Propellant Status',
  url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_18-28a_LM_Descent_Stage_Propellant_Status.htm',
}
const ABTN_APS_PROPELLANT: SourceRef = {
  label: 'NASA SP-2000-4029, Apollo by the Numbers: LM Ascent Stage Propellant Status',
  url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_18-28b_LM_Ascent_Stage_Propellant_Status.htm',
}
const A11_MISSION_REPORT: SourceRef = {
  label: 'NASA MSC-00171, Apollo 11 Mission Report (November 1969)',
  url: 'https://www.nasa.gov/wp-content/uploads/static/apollo50th/pdf/A11_MissionReport.pdf',
}
const TM_X_58040: SourceRef = {
  label: 'NASA TM X-58040, Apollo Lunar Descent and Ascent Trajectories (Bennett, March 1970)',
  url: 'https://ntrs.nasa.gov/api/citations/19700024568/downloads/19700024568.pdf',
}
const TN_D_7143: SourceRef = {
  label: 'NASA TN D-7143, Apollo Experience Report: Descent Propulsion System (March 1973)',
  url: 'https://ntrs.nasa.gov/api/citations/19730011150/downloads/19730011150.pdf',
}
const LM_NEWS_REFERENCE: SourceRef = {
  label: 'Grumman, Apollo News Reference: Lunar Module, Main Propulsion (pp. MP-1 to MP-22)',
  url: 'https://apollojournals.org/alsj/LM09_Main_Propulsion_ppMP1-22.pdf',
}
const CSM_NEWS_REFERENCE_SPS: SourceRef = {
  label: 'North American Rockwell, Apollo Spacecraft News Reference: Service Propulsion Subsystem (pp. 159–172)',
  url: 'https://apollojournals.org/alsj/CSM17_Service_Propulsion_Subsystem_pp159-172.pdf',
}
const APOLLO_7_SPS: SourceRef = {
  label: 'NASA-CR-109929, Apollo 7 CSM 101 service propulsion system, flight evaluation',
  url: 'https://ntrs.nasa.gov/api/citations/19700025288/downloads/19700025288.pdf',
}
const ORION_BY_THE_NUMBERS: SourceRef = {
  label: 'NASA, Orion by the Numbers (fact sheet, 2026)',
  url: 'https://www.nasa.gov/wp-content/uploads/2026/01/orion-by-the-numbers-2026b.pdf',
}
const ORION_FUN_FACTS: SourceRef = {
  label: 'NASA, Orion Fun Facts',
  url: 'https://www.nasa.gov/reference/orion-fun-facts/',
}
const ESM_ENGINE_PAPER: SourceRef = {
  label: 'Belair et al. (NASA / ESA / Airbus), Artemis I Orion ESM Propulsion System Engine Performance, Space Propulsion 2024 (NTRS 20240003648)',
  url: 'https://ntrs.nasa.gov/api/citations/20240003648/downloads/382_BELAIR_ARTEMIS_I_ENGINE_PERFORMANCE_FINAL.pdf',
}
const NASA_HLS: SourceRef = {
  label: 'NASA, Human Landing Systems (reference page)',
  url: 'https://www.nasa.gov/reference/human-landing-systems/',
}
const NASA_HLS_RAPTOR_TEST: SourceRef = {
  label: "NASA, SpaceX Completes Engine Tests for NASA's Artemis III Moon Lander (14 Sep 2023)",
  url: 'https://www.nasa.gov/blogs/missions/2023/09/14/spacex-completes-engine-tests-for-nasas-artemis-iii-moon-lander/',
}
const SPACEX_MOON: SourceRef = {
  label: 'SpaceX, Human Spaceflight: Moon (the lander variant)',
  url: 'https://www.spacex.com/humanspaceflight/moon',
}
const SPACEX_STARSHIP: SourceRef = {
  label: 'SpaceX, Starship (the generic ship, not the lander variant)',
  url: 'https://www.spacex.com/vehicles/starship',
}
const WIKI_RAPTOR: SourceRef = {
  label: 'Wikipedia: SpaceX Raptor (fallback: SpaceX states neither specific impulse nor throttle range)',
  url: 'https://en.wikipedia.org/wiki/SpaceX_Raptor',
}
const NASA_BLUE_MOON_CABIN: SourceRef = {
  label: 'NASA, Industry Moon Lander Training Cabin Lands at NASA for Artemis',
  url: 'https://www.nasa.gov/directorates/esdmd/artemis-campaign-development-division/human-landing-system-program/industry-moon-lander-training-cabin-lands-at-nasa-for-artemis/',
}
const BLUE_ORIGIN_ENGINES: SourceRef = {
  label: 'Blue Origin, Engines (BE-7)',
  url: 'https://www.blueorigin.com/engines',
}
const WIKI_BLUE_MOON: SourceRef = {
  label: 'Wikipedia: Blue Moon (spacecraft) (fallback: Blue Origin and NASA state no masses and no engine count)',
  url: 'https://en.wikipedia.org/wiki/Blue_Moon_(spacecraft)',
}
const SPACE_REVIEW_BLUE_MOON: SourceRef = {
  label: 'J. Foust, A lunar lander makeover, The Space Review (22 May 2023; Blue Origin\'s HLS program manager on Mark 2 masses)',
  url: 'https://thespacereview.com/article/4587/1',
}
const NASA_LANDERS_2028: SourceRef = {
  label: 'NASA, NASA, Partners Accelerate Lander Development for 2028 Moon Missions (23 Oct 2026)',
  url: 'https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/',
}
const WIKI_BE7: SourceRef = {
  label: 'Wikipedia: BE-7 (fallback: Blue Origin states no specific impulse)',
  url: 'https://en.wikipedia.org/wiki/BE-7',
}

const ABTN_A11_SUMMARY: SourceRef = {
  label: 'NASA SP-2000-4029, Apollo by the Numbers: Apollo 11 summary (time on the lunar surface)',
  url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm',
}
const ABTN_A17_SUMMARY: SourceRef = {
  label: 'NASA SP-2000-4029, Apollo by the Numbers: Apollo 17 summary (time on the lunar surface)',
  url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_17a_Summary.htm',
}
const CSM_NEWS_REFERENCE_LM: SourceRef = {
  label: 'North American Rockwell, Apollo Spacecraft News Reference: Lunar Module and SLA overview (p. 62, the original LM)',
  url: 'https://apollojournals.org/alsj/CSM08_LM_&_SLA_Overview_pp61-68.pdf',
}
const APOLLO_PROGRAM_SUMMARY: SourceRef = {
  label: 'NASA JSC-09423, Apollo Program Summary Report (April 1975), section 4.6.5.1 (the Extended LM)',
  url: 'https://archive.org/stream/apolloprogramsum00unse/apolloprogramsum00unse_djvu.txt',
}
const HLS_IAC_2023: SourceRef = {
  label: 'Watson-Morgan et al. (NASA), NASA Human Landing System, IAC-23-B3.1.10 (2023)',
  url: 'https://ntrs.nasa.gov/api/citations/20230013222/downloads/DRAFT- IAC Final_Sept14.pdf',
}
const NASA_ARTEMIS_IV: SourceRef = {
  label: 'NASA, Artemis IV mission page (the first crewed landing in the plan of 2026)',
  url: 'https://www.nasa.gov/mission/artemis-iv/',
}
const NASA_BLUE_ORIGIN_SELECTION: SourceRef = {
  label: 'NASA selects Blue Origin as second Artemis lunar lander provider (19 May 2023)',
  url: 'https://www.nasa.gov/news-release/nasa-selects-blue-origin-as-second-artemis-lunar-lander-provider/',
}

// ---- Surface stays
// Apollo by the Numbers, Apollo 11 summary: "The LM had been on the lunar surface for 21 hours 36 minutes 20.9 seconds."
const APOLLO_11_STAY_DAYS = (21 + 36 / 60 + 20.9 / 3600) / 24
// Apollo by the Numbers, Apollo 17 summary: "The LM had been on the lunar surface for 74 hours 59 minutes 40 seconds."
// The longest of the programme (Apollo 15: 66 h 54 min 53.9 s; Apollo 16: 71 h 2 min 13 s, same source).
const APOLLO_17_STAY_DAYS = (74 + 59 / 60 + 40 / 3600) / 24
// NASA (Watson-Morgan et al., IAC-23-B3.1.10), the landing with the initial Starship lander: "Starship will then
// descend to the lunar surface for an approximate 6.5 day stay". One revolution of the near-rectilinear halo orbit.
const ARTEMIS_FIRST_STAY_DAYS = 6.5
// The same paper, later missions: "use pre-placed habitats and rovers at the southern pole area to live for up to
// 33 days"; and "the initial trips will last approximately one week while later trips to the lunar surface could
// last nearly a month".
const ARTEMIS_LATER_STAY_DAYS = 33

export const SPACECRAFT: SpacecraftSpec[] = [
  {
    id: 'apollo-csm',
    name: 'Apollo Command and Service Module (CSM)',
    role: 'capsule',
    note: 'As flown on Apollo 11. One Service Propulsion System engine, not throttleable.',
    modules: [
      {
        id: 'apollo-cm',
        name: 'Command Module (CM)',
        // ABTN, Apollo 11 column, Command Module: "Weight, lb | 12,250" (as published in the mission press kit)
        dryKg: 12250 * LB,
        propellantKg: 0,
        engine: null,
        // ABTN, Command Module: "Diameter, ft | 12.833"
        diameterM: 12.833 * FT,
        // ABTN, Command Module: "Height, ft | 11.417"
        lengthM: 11.417 * FT,
        sources: [ABTN_KEY_FACTS_LM],
      },
      {
        id: 'apollo-sm',
        name: 'Service Module (SM)',
        // Difference of two stated numbers (no source states the Apollo 11 SM without its SPS propellant):
        //   ABTN, Apollo 11 column, Service Module: "Weight, lb | 51,243" (at launch)
        //   MR 8.11.1, service propulsion propellant loaded: "Total 15 712 25 091 40 803" (fuel, oxidizer, total, lb)
        // 51,243 − 40,803 = 10,440 lb: structure, systems, reaction control propellant and fuel-cell reactants.
        dryKg: (51243 - 40803) * LB,
        // MR 8.11.1, loaded: "Total 15 712 25 091 40 803" lb (the loaded quantity; the report gives no usable figure)
        propellantKg: 40803 * LB,
        engine: {
          name: 'Service Propulsion System (SPS) engine',
          count: 1,
          // ABTN: "Rated Thrust, SPS engine, lbf | 20,500"; News Reference: "provides 20,500 pounds of thrust in vacuum"
          thrustVacN: 20500 * LBF,
          thrustSlN: null,
          // No Apollo 11 figure found. Flight evaluation of the first Block II engine (Apollo 7, CSM-101):
          // "thrust, 21180 pounds; specific impulse, 314.0" (NASA-CR-109929)
          ispVacS: 314.0,
          ispSlS: null,
          // News Reference: "The engine has no throttle, producing a single-value thrust."
          throttleMin: 1,
        },
        // ABTN, Service Module: "Diameter, ft | 12.833"
        diameterM: 12.833 * FT,
        // ABTN, Service Module: "Height (with engine bell), ft | 24.583"
        lengthM: 24.583 * FT,
        sources: [ABTN_KEY_FACTS_SM, A11_MISSION_REPORT, CSM_NEWS_REFERENCE_SPS, APOLLO_7_SPS],
      },
    ],
    sources: [ABTN_KEY_FACTS_LM, ABTN_KEY_FACTS_SM, A11_MISSION_REPORT, CSM_NEWS_REFERENCE_SPS, APOLLO_7_SPS],
  },
  {
    id: 'apollo-lm',
    name: 'Apollo Lunar Module (LM)',
    role: 'lander',
    note:
      'Two stages, as flown on Apollo 11. The Descent Stage stays on the surface; the Ascent Stage returns to the CSM. ' +
      'Dry masses without crew, suits and surface equipment that changes hands (Apollo 11 at separation from the CSM: 33,683.5 lb in all).',
    modules: [
      {
        id: 'apollo-lm-ascent',
        name: 'Ascent Stage',
        // ABTN, Apollo 11 column, LM Ascent Stage: "Weight, dry, lb | 4,804" (as published in the mission press kit)
        dryKg: 4804 * LB,
        // MR 9.13.2 and ABTN, ascent propulsion propellant, Apollo 11: "Loaded 2020 3218 5238" (fuel, oxidizer, total, lb).
        // The loaded quantity: MR 9.9 gives "usable propellant remaining at engine shutdown was 174 pounds oxidizer
        // and 121 pounds fuel" but no usable load.
        propellantKg: 5238 * LB,
        engine: {
          name: 'Ascent Propulsion System (APS) engine',
          count: 1,
          // Grumman News Reference, p. MP-5: "delivers a fixed thrust of 3,500 pounds"
          // (TM X-58040, p. 16: "provides a constant thrust of approximately 3500 pounds")
          thrustVacN: 3500 * LBF,
          thrustSlN: null,
          // MR table 9.9-I, Apollo 11 pre-flight prediction 10 s after ignition: "Specific impulse, sec ... 309.4"
          // (308.8 at 400 s; the table has no measured value)
          ispVacS: 309.4,
          ispSlS: null,
          // TM X-58040, p. 16: "The APS, unlike the DPS, is not throttleable"
          throttleMin: 1,
        },
        // ABTN, LM Ascent Stage: "Diameter, ft | 14.083"
        diameterM: 14.083 * FT,
        // ABTN, LM Ascent Stage: "Height, ft | 12.333"
        lengthM: 12.333 * FT,
        sources: [ABTN_KEY_FACTS_LM, ABTN_APS_PROPELLANT, A11_MISSION_REPORT, LM_NEWS_REFERENCE, TM_X_58040],
      },
      {
        id: 'apollo-lm-descent',
        name: 'Descent Stage',
        // ABTN, Apollo 11 column, LM Descent Stage: "Weight, dry, lb | 4,483" (as published in the mission press kit)
        dryKg: 4483 * LB,
        // MR 9.13.1 and ABTN, descent propulsion propellant, Apollo 11: "Loaded 6975 11 209 18 184" (fuel, oxidizer, total, lb).
        // The loaded quantity; of the 770 lb "Remaining at Cutoff" the same table counts 674 lb as "Usable at Cutoff".
        propellantKg: 18184 * LB,
        engine: {
          name: 'Descent Propulsion System (DPS) engine',
          count: 1,
          // ABTN, Apollo 11 column, LM Descent Stage: "Maximum rated thrust, lb | 9,870". This is the thrust at the
          // fixed throttle position; TN D-7143 has "Maximum-rated thrust: 10 500 lb" with "FTP was optimized at
          // 92.5 percent of maximum-rated thrust", the News Reference "Nominal engine thrust (full throttle) ... 9,900 pounds (FTP)".
          thrustVacN: 9870 * LBF,
          thrustSlN: null,
          // TN D-7143, design requirement: "Specific impulse (end of duty cycle): 305 lbf-sec/lbm". No NASA source read
          // gives the Apollo 11 flight value (Wikipedia has 311 s at full thrust).
          ispVacS: 305,
          ispSlS: null,
          // TM X-58040, p. 7: "It is throttleable between 10 percent and 60 percent for controlled operations in the
          // approach and landing phases." The real engine could not be run between 60 % and the fixed throttle
          // position; the data contract has one continuous range, 10 % to full.
          throttleMin: 0.1,
        },
        // ABTN, LM Descent Stage: "Diameter, ft | 14.083" (the body without the landing gear)
        diameterM: 14.083 * FT,
        // ABTN, LM Descent Stage: "Height, ft | 10.583"
        lengthM: 10.583 * FT,
        sources: [ABTN_KEY_FACTS_LM, ABTN_DPS_PROPELLANT, A11_MISSION_REPORT, TN_D_7143, TM_X_58040, LM_NEWS_REFERENCE],
      },
    ],
    sources: [ABTN_KEY_FACTS_LM, ABTN_APS_PROPELLANT, ABTN_DPS_PROPELLANT, A11_MISSION_REPORT, TM_X_58040, TN_D_7143, LM_NEWS_REFERENCE],
  },
  {
    id: 'orion',
    name: 'Orion',
    role: 'capsule',
    note: 'Crew Module and European Service Module (ESM), Artemis II figures. One Orbital Maneuvering System Engine of fixed thrust.',
    modules: [
      {
        id: 'orion-cm',
        name: 'Crew Module (CM)',
        // NASA, Orion by the Numbers, Crew Module: "MASS AT LIFTOFF ... 22,900 lbs / 10,387 kg" (what it includes is not said)
        dryKg: 10387,
        propellantKg: 0,
        engine: null,
        // same sheet: "DIAMETER ... 16.5 ft / 5 m"
        diameterM: 5,
        // same sheet: "HEIGHT ... 11 ft / 3.35 m"
        lengthM: 3.35,
        sources: [ORION_BY_THE_NUMBERS],
      },
      {
        id: 'orion-esm',
        name: 'European Service Module (ESM)',
        // Difference of two stated numbers (neither NASA, ESA nor Airbus states a dry mass):
        //   NASA, Orion by the Numbers, Service Module: "MASS AT LIFTOFF ... 34,400 lbs / 15,604 kg"
        //   same sheet: "USABLE PROPELLANT ... 19,000 lbs / 8,618 kg"
        // 15,604 − 8,618 = 6,986 kg: structure, systems, unusable propellant, water and gases for the crew.
        dryKg: 15604 - 8618,
        // NASA, Orion by the Numbers: "USABLE PROPELLANT ... 19,000 lbs / 8,618 kg"
        propellantKg: 8618,
        engine: {
          name: 'Orbital Maneuvering System Engine (OMS-E)',
          count: 1,
          // NASA, Orion Fun Facts: "Orion's orbital maneuvering system engine, called the OMS-e, produces 6,000 pounds,
          // or 26.7 kN, of thrust." (ESA's propulsion page says 25.7 kN)
          thrustVacN: 26700,
          thrustSlN: null,
          // Belair et al., OMS-E table: "Thrust 26.7 kN / Specific Impulse 315.1 seconds"
          ispVacS: 315.1,
          ispSlS: null,
          // Belair et al.: "The OMS-E is a pressure fed, hypergolic-reacting bipropellant, regenerative and film cooled,
          // fixed thrust engine."
          throttleMin: 1,
        },
        // NASA, Orion by the Numbers, Service Module: "DIAMETER ... 16.5 ft / 5 m"
        diameterM: 5,
        // same sheet: "HEIGHT ... 15.7 ft / 4.79 m"
        lengthM: 4.79,
        sources: [ORION_BY_THE_NUMBERS, ORION_FUN_FACTS, ESM_ENGINE_PAPER],
      },
    ],
    sources: [ORION_BY_THE_NUMBERS, ORION_FUN_FACTS, ESM_ENGINE_PAPER],
  },
  {
    id: 'starship-hls',
    name: 'Starship Human Landing System (HLS)',
    role: 'lander',
    note:
      'Single stage: lands and returns to orbit on the same engines. Only the height is published for the lander itself; diameter, propellant ' +
      'capacity and engine thrust are those of the generic Starship ship, the dry mass and the number of engines are assumptions, ' +
      'specific impulse and throttle range come from Wikipedia. An illustration, not a prediction.',
    modules: [
      {
        id: 'starship-hls',
        name: 'Starship HLS',
        // ASSUMPTION: 100 t. Neither NASA nor SpaceX publishes the lander's dry mass. A placeholder of the order of
        // the payload SpaceX gives for the lander ("On-orbit refilling enables Starship to deliver up to 100 tons
        // directly to the lunar surface"); replace it when a figure is published.
        dryKg: 100_000,
        // SpaceX, Starship (generic ship, not the lander), specification block: propellant capacity 1,600 t / 3.5 Mlb. The lander's own
        // capacity is not published, and how full it is in lunar orbit depends on the refilling in Earth orbit.
        propellantKg: 1_600_000,
        engine: {
          name: 'Raptor Vacuum (RVac)',
          // ASSUMPTION: 3, the number on the generic ship (SpaceX: "Three RVacs power Starship in addition to three
          // Raptor engines"). NASA says only that the lander "will be powered by two variants of the company's
          // Raptor engines"; how many, and which fire for the lunar descent and ascent, is not published.
          count: 3,
          // SpaceX, Starship, Raptor Vacuum specification block: thrust 275 tf / 606 klbf. 275 tf × 9.80665 kN/tf = 2,696.8 kN.
          thrustVacN: 275 * 9806.65,
          thrustSlN: null,
          // FALLBACK, Wikipedia SpaceX Raptor infobox: specific impulse in vacuum 380 s for the vacuum-optimised engine.
          ispVacS: 380,
          ispSlS: null,
          // FALLBACK, Wikipedia SpaceX Raptor infobox: throttle range 40–100% (cited there to a 2020 post by SpaceX's
          // chief executive). NASA reports a test of the engine's "throttle profile" without a percentage.
          throttleMin: 0.4,
        },
        // SpaceX, Starship (generic ship), specification block: diameter 9 m / 29.5 ft
        diameterM: 9,
        // NASA, Human Landing Systems: "At about 165 feet (50 m), Starship HLS will be about the same height as a
        // 15-story building."
        lengthM: 50,
        sources: [NASA_HLS, NASA_HLS_RAPTOR_TEST, SPACEX_MOON, SPACEX_STARSHIP, WIKI_RAPTOR],
      },
    ],
    sources: [NASA_HLS, NASA_HLS_RAPTOR_TEST, SPACEX_MOON, SPACEX_STARSHIP, WIKI_RAPTOR],
  },
  {
    id: 'blue-moon-mk2',
    name: 'Blue Moon Mark 2 (MK2)',
    role: 'lander',
    note:
      'Single stage: lands and returns to orbit on the same BE-7 engines. NASA and Blue Origin publish the height and the BE-7 thrust range; ' +
      'masses, the number of engines and the specific impulse come from Wikipedia, the diameter is an assumption. An illustration, not a prediction.',
    modules: [
      {
        id: 'blue-moon-mk2',
        name: 'Blue Moon Mark 2',
        // FALLBACK, Wikipedia Blue Moon (spacecraft), Mark 2 infobox: dry mass 16,000 kg (cited there to SpaceNews, 19 May 2023)
        dryKg: 16_000,
        // LOWER BOUND: fuelled mass more than 45,000 kg − dry mass 16,000 kg = 29,000 kg. Wikipedia's infobox calls the
        // 45,000 kg "launch mass"; the article it cites (Foust, SpaceNews, reprinted in The Space Review) says it is the
        // fuelled mass: "When loaded with liquid hydrogen and liquid oxygen propellants, its mass increases to more than
        // 45 metric tons" and "weighs 16 metric tons dry". Same article: "The lander will need to be refueled in lunar
        // orbit before attempting a landing." NASA (23 Oct 2026) has since changed the plan: "Blue Origin will defer
        // propellant transfer and use three transfer stages", rendezvous in "an elliptical polar orbit", which "reduces
        // Blue Moon lander propellant requirements" compared with the halo orbit. Neither source, nor NASA's selection
        // release, states a tank capacity or the load at the start of the descent: the real load is at least 29,000 kg.
        propellantKg: 45_000 - 16_000,
        propellantStatus: {
          kind: 'lower-bound',
          note:
            'Blue Moon’s propellant here (29 t) is a lower bound: the only published figure is a fuelled mass of more than 45 t, ' +
            'the real lander was to be refuelled in lunar orbit (NASA’s 2028 plan uses transfer stages and a cheaper orbit instead), ' +
            'and its full load is not published, so the real lander may not be short (validated by the science lead: statement of 15 Nov 2026; see record).',
          validated: false,
          sources: [SPACE_REVIEW_BLUE_MOON, WIKI_BLUE_MOON, NASA_LANDERS_2028],
        },
        engine: {
          name: 'BE-7',
          // FALLBACK, Wikipedia Blue Moon (spacecraft): "Mark 1 is to use a single engine, whereas the other spacecraft are
          // to each use three." Blue Origin and NASA do not state the number.
          count: 3,
          // Blue Origin, Engines, BE-7: "Thrust: 10,000 lbf (44.5 kN) with deep throttle capability to 2,000 lbf (8.9kN)"
          thrustVacN: 44_500,
          thrustSlN: null,
          // FALLBACK, Wikipedia BE-7 infobox: specific impulse in vacuum 460 s. Blue Origin says only that the engine
          // "delivers high specific impulse".
          ispVacS: 460,
          ispSlS: null,
          // Blue Origin (same sentence): 8.9 kN of 44.5 kN = 0.2
          throttleMin: 8.9 / 44.5,
        },
        // ASSUMPTION: 7 m. No source states the lander's diameter (the 3.08 m in Wikipedia belongs to Mark 1). Chosen as
        // a body that a 7 m class payload fairing could carry; used for drawing only, not by the simulators.
        diameterM: 7,
        // NASA: "The Blue Moon crew lander that will fly to the Moon will stand about 52 feet tall."
        lengthM: 52 * FT,
        sources: [NASA_BLUE_MOON_CABIN, BLUE_ORIGIN_ENGINES, WIKI_BLUE_MOON, SPACE_REVIEW_BLUE_MOON, NASA_LANDERS_2028, WIKI_BE7],
      },
    ],
    sources: [NASA_BLUE_MOON_CABIN, BLUE_ORIGIN_ENGINES, WIKI_BLUE_MOON, SPACE_REVIEW_BLUE_MOON, NASA_LANDERS_2028, WIKI_BE7],
  },
]

export const ARCHITECTURES: ArchitectureSpec[] = [
  {
    id: 'apollo',
    name: 'Apollo: Saturn V, lunar orbit rendezvous',
    launchVehicleId: 'saturn-v',
    capsuleId: 'apollo-csm',
    landerId: 'apollo-lm',
    rendezvous: 'llo',
    note:
      'One Saturn V sends the Command and Service Module and the Lunar Module to low lunar orbit together. The Lunar Module lands, ' +
      'its Ascent Stage returns to the CSM in lunar orbit, and the CSM flies home.',
    surfaceStay: {
      defaultDays: APOLLO_11_STAY_DAYS,
      maxDays: APOLLO_17_STAY_DAYS,
      basis:
        'Apollo 11 stayed 21 h 36 min; its Lunar Module was built for at most 35 hours on the Moon. The Extended Lunar Module of ' +
        'Apollo 15 to 17 (a fifth battery, larger descent tanks) was built for up to 72 hours; Apollo 17 stayed 74 h 59 min 40 s, the longest of the programme.',
      // Original LM, News Reference p. 62: "is designed to operate for 48 hours while separated from the CM, with a
      // maximum stay time of 35 hours on the moon". Extended LM, Apollo Program Summary Report 4.6.5.1: "the first
      // lunar module with the five-battery configuration for a lunar surface stay of up to 72 hours".
      sources: [ABTN_A11_SUMMARY, ABTN_A17_SUMMARY, CSM_NEWS_REFERENCE_LM, APOLLO_PROGRAM_SUMMARY],
    },
  },
  {
    id: 'artemis-starship',
    name: 'Artemis: SLS Block 1, Orion, Starship HLS',
    launchVehicleId: 'sls-block-1',
    capsuleId: 'orion',
    landerId: 'starship-hls',
    rendezvous: 'nrho',
    note:
      'SLS Block 1 sends Orion to a near-rectilinear halo orbit around the Moon. The Starship Human Landing System, launched and ' +
      'refilled separately, waits there, takes the crew to the surface and brings them back to Orion.',
    surfaceStay: {
      defaultDays: ARTEMIS_FIRST_STAY_DAYS,
      maxDays: ARTEMIS_LATER_STAY_DAYS,
      basis:
        'NASA planned the first landing with Starship as a stay of about 6.5 days (two crew), one revolution of the halo orbit; ' +
        'in the plan of 2026 the first landing is Artemis IV, "approximately a week near the South Pole". Later missions with four crew ' +
        'and habitats placed beforehand are to stay up to 33 days.',
      // NASA, Artemis IV: "spend approximately a week near the South Pole of the Moon"
      sources: [HLS_IAC_2023, NASA_ARTEMIS_IV],
    },
  },
  {
    id: 'artemis-blue-moon',
    name: 'Artemis: SLS Block 1B, Orion, Blue Moon Mark 2',
    launchVehicleId: 'sls-block-1b',
    capsuleId: 'orion',
    landerId: 'blue-moon-mk2',
    rendezvous: 'nrho',
    note:
      'SLS Block 1B sends Orion to a near-rectilinear halo orbit around the Moon. Blue Moon Mark 2, launched separately, waits there, ' +
      'takes the crew to the surface and brings them back to Orion.',
    surfaceStay: {
      // No NASA or Blue Origin figure in days for this lander. NASA at its selection: "for about a weeklong trip to
      // the Moon's South Pole region". The default is the 6.5 days of one halo-orbit revolution, as for Starship.
      defaultDays: ARTEMIS_FIRST_STAY_DAYS,
      maxDays: ARTEMIS_LATER_STAY_DAYS,
      basis:
        'NASA describes the Blue Moon landing as "about a weeklong trip to the Moon\'s South Pole region"; no stay in days is published for this lander. ' +
        'One revolution of the halo orbit gives about 6.5 days. Later Artemis missions with habitats placed beforehand are to stay up to 33 days.',
      sources: [NASA_BLUE_ORIGIN_SELECTION, HLS_IAC_2023],
    },
  },
]
