// Launch vehicles the ascent simulator (ascent.ts) knows as presets: Saturn V as flown on Apollo 11 (AS-506),
// SLS Block 1 as flown on Artemis I, SLS Block 1B. The simulator reads nothing but these numbers; a vehicle
// that is not here flies the same way from its own LaunchVehicleSpec.
//
// Rule: every number carries the wording of the source that states it. Where a number is the sum or difference
// of stated numbers the arithmetic is written out. Where no source states a number the entry says ASSUMPTION
// and why; the assumptions are listed again at the end of this file.
//
// Unit conversions: 1 lbm = 0.45359237 kg, 1 lbf = 4.4482216 N, 1 ft = 0.3048 m.
import type { AscentVehicle, ParkingEllipse } from './ascent'
import type { LaunchVehicleSpec } from './hardware'
import type { SourceRef } from './types'

const LBM = 0.45359237
const LBF = 4.4482216
const FT = 0.3048

// ---------------------------------------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------------------------------------

const FER_AS506: SourceRef = {
  label: 'NASA MSFC, Saturn V Launch Vehicle Flight Evaluation Report AS-506 Apollo 11 Mission, MPR-SAT-FE-69-9 (NTRS 19900066485; text read at archive.org)',
  url: 'https://archive.org/stream/nasa_techdoc_19900066485/19900066485_djvu.txt',
}
const ABTN_WEIGHTS: SourceRef = {
  label: 'NASA SP-2000-4029, Apollo by the Numbers: Ground Ignition Weights',
  url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_18-19_Ground_Ignition_Weights.htm',
}
const ABTN_KEYFACTS: SourceRef = {
  label: 'NASA SP-2000-4029, Apollo by the Numbers: Launch Vehicle/Spacecraft Key Facts',
  url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_18-11_Launch_Vehicle-Spacecraft_Key_Facts.htm',
}
const A11_PRESS_KIT: SourceRef = {
  label: 'NASA, Apollo 11 Press Kit, release 69-83K (NTRS 19690022248; text read at archive.org)',
  url: 'https://archive.org/stream/NASA_NTRS_Archive_19690022248/NASA_NTRS_Archive_19690022248_djvu.txt',
}
const SA507_MANUAL: SourceRef = {
  label: 'NASA MSFC, Saturn V Flight Manual SA-507, MSFC-MAN-507 (text read at archive.org)',
  url: 'https://archive.org/stream/saturn-5-flight-manual-sa-507/saturn-5-flight-manual-sa-507_djvu.txt',
}
const WIKI_F1: SourceRef = {
  label: 'Wikipedia: Rocketdyne F-1 (infobox; fallback, no NASA document opened states the vacuum specific impulse)',
  url: 'https://en.wikipedia.org/wiki/Rocketdyne_F-1',
}

const SLS_REF_GUIDE: SourceRef = {
  label: 'NASA, Space Launch System Reference Guide (2022, Artemis I)',
  url: 'https://www.nasa.gov/wp-content/uploads/2021/12/sls_reference_guide_2022_web_0.pdf',
}
const ARTEMIS_I_REF_GUIDE: SourceRef = {
  label: 'NASA, Artemis I Reference Guide',
  url: 'https://www.nasa.gov/wp-content/uploads/2023/03/Artemis20I20Reference20Guide_Inter.pdf',
}
const ARTEMIS_I_TIMELINE: SourceRef = {
  label: 'NASA, Artemis I liftoff blog: ascent timeline (planned times)',
  url: 'https://www.nasa.gov/blogs/missions/2022/11/16/artemis-i-liftoff/',
}
const QM1_PAPER: SourceRef = {
  label: 'Redden (Orbital ATK / NASA), QM-1 Demonstration of New Technology, AIAA Propulsion & Energy 2015 (NTRS 20150016520)',
  url: 'https://ntrs.nasa.gov/api/citations/20150016520/downloads/20150016520.pdf',
}
const NG_BOOSTER_FACTS: SourceRef = {
  label: 'Northrop Grumman, SLS booster fact sheet',
  url: 'https://cdn.northropgrumman.com/-/media/wp-content/uploads/NG-SLS-Booster-2020-1.pdf?v=1.0.0',
}
const JANNAF_2024: SourceRef = {
  label: "Askins (NASA MSFC), Successful First Flight of NASA's Space Launch System, 71st JANNAF 2024 (NTRS 20240003963)",
  url: 'https://ntrs.nasa.gov/api/citations/20240003963/downloads/Final%20-%20JANNAF%202024%20Paper.pdf',
}
const SCITECH_2024: SourceRef = {
  label: "Honeycutt et al. (NASA MSFC), NASA's Space Launch System: Artemis I Results and the Path Forward, AIAA SciTech 2024 (NTRS 20230017105)",
  url: 'https://ntrs.nasa.gov/api/citations/20230017105/downloads/Final%20-%20SciTech%202024%20-%20SLS%20Update.pdf',
}
const BOOSTER_SEP_PAPER: SourceRef = {
  label: 'Lee et al. (NASA), Post-Flight Aerodynamics Assessment of the Artemis-I Booster Separation Event, AIAA SciTech 2024 (NTRS 20230017676)',
  url: 'https://ntrs.nasa.gov/api/citations/20230017676/downloads/2024scitech_boosterSep_pfac_v5.pdf.txt',
}
const L3_RS25: SourceRef = {
  label: 'L3Harris (Aerojet Rocketdyne), RS-25 engine page and specification sheet',
  url: 'https://www.l3harris.com/all-capabilities/rs-25-engine',
}
const NAS_PROPULSION_REVIEW: SourceRef = {
  label: 'National Academies: Review of US Air Force and DoD Aerospace Propulsion Needs (2006), p. 256',
  url: 'https://www.nationalacademies.org/read/11780/page/256',
}
const MCDOWELL_ARTEMIS1: SourceRef = {
  label: "J. McDowell, Artemis I mission notes (fallback: no NASA or Boeing document states the ICPS dry mass)",
  url: 'https://planet4589.org/space/misc/artemis1.txt',
}
const SLS_B1B_FACTS: SourceRef = {
  label: 'NASA, SLS Block 1B fact sheet (December 2025)',
  url: 'https://www.nasa.gov/wp-content/uploads/2026/02/sls-5644-sls-block-1b-fact-sheet-dec2025-508.pdf',
}
const WIKI_EUS: SourceRef = {
  label: 'Wikipedia: Exploration Upper Stage (specifications; fallback, no NASA or Boeing document states the stage masses)',
  url: 'https://en.wikipedia.org/wiki/Exploration_Upper_Stage',
}

// ---------------------------------------------------------------------------------------------------------
// Saturn V, as flown on Apollo 11 (AS-506)
// ---------------------------------------------------------------------------------------------------------
// Masses follow the flight evaluation report's "Flight Sequence Mass Summary" (Table 20-9, actual). The model
// starts at holddown arm release (range time 0.3 s) and switches each stage on at full thrust at the report's
// "mainstage" instant, so stage masses are taken at those instants:
//   1st flight stage at holddown arm release              2,899,008 kg
//   S-IC mainstage propellant                             2,069,957 kg
//   2nd flight stage at mainstage (S-II, 166.2 s)           657,459 kg
//   S-II mainstage [propellant] + venting                   435,499 kg
//   S-IC/S-II interstage large (jettisoned at 192.3 s)        3,982 kg
//   launch escape system (jettisoned at 197.9 s)              4,042 kg
//   3rd flight stage at mainstage (S-IVB, 554.7 s)          166,396 kg
//   S-IVB mainstage propellant, first burn 68,678 lbm = 31,152 kg; second burn 70,684 kg
//   instrument unit 1,939 kg; spacecraft less the launch escape system 109,646 − 8,910 lbm = 45,693 kg
// "Dry" below is what the stack loses when a stage goes, as the hardware contract defines it: the stage itself
// with residuals, the interstage it takes along, and the small items the report lists between its cut-off and
// the next stage's mainstage (thrust-decay and start propellants, ullage rockets, frost).
const SATURN_V: AscentVehicle = {
  id: 'saturn-v',
  name: 'Saturn V',
  boosters: null,
  stages: [
    {
      id: 's-ic',
      name: 'S-IC',
      // 2,899,008 − 2,069,957 − 657,459 = 171,592 kg (FER Table 20-9: holddown arm release, "S-IC mainstage
      // propellant", "2nd flight stage at mainstage"). The report's "S-IC stage at separation" alone is 164,381 kg.
      dryKg: 171592,
      // FER Table 20-9: "S-IC mainstage propellant" 2,069,957 kg (4,563,474 lbm), holddown arm release to cut-off
      propellantKg: 2069957,
      engine: {
        name: 'F-1',
        count: 5,
        // Press kit: "7,653,854 pounds at liftoff to 9,088,419 pounds just before center engine cutoff" (five
        // engines). Centre engine cut-off is at 44 km, where the air pressure is 0.2% of sea level, so the second
        // figure is the vacuum thrust to within 0.05%. Thrust grows in flight with the falling air pressure and
        // with the propellant flow (tank head pressure rises with the acceleration); taking the two ends of
        // the flight as the sea-level and vacuum values covers both. Pre-flight prediction: the report says the
        // flown "stage site thrust ... was 0.62 percent lower than predicted".
        thrustVacN: (9088419 / 5) * LBF,
        // Press kit: "develop approximately 1,530,771 pounds of thrust each at liftoff"
        thrustSlN: 1530771 * LBF,
        // Wikipedia infobox: "Specific impulse, vacuum 304 s (2.98 km/s)" (fallback)
        ispVacS: 304,
        // FER Table 5-1, flight reconstruction reduced to sea level, engines 1–5: 265.0, 264.9, 264.7, 264.6,
        // 263.5 lbf-s/lbm; mean 264.5
        ispSlS: 264.5,
        throttleMin: 1,
      },
      // Apollo by the Numbers: "Diameter, base, ft 33.000", "Height, ft 138.030"
      diameterM: 33 * FT,
      lengthM: 138.03 * FT,
      sources: [FER_AS506, A11_PRESS_KIT, ABTN_KEYFACTS, WIKI_F1],
    },
    {
      id: 's-ii',
      name: 'S-II',
      // 657,459 − 435,499 − 3,982 − 4,042 − 166,396 = 47,540 kg (FER Table 20-9; includes the S-II/S-IVB
      // interstage, 3,180 kg dry, which stays on the S-II). "S-II stage at separation" alone is 43,436 kg.
      dryKg: 47540,
      // FER Table 20-9: "S-II mainstage [propellant] + venting" 435,499 kg (960,110 lbm)
      propellantKg: 435499,
      engine: {
        name: 'J-2',
        count: 5,
        // FER 6.3, engine start command + 61 s: "total vehicle thrust was 5,141,516 Newtons (1,155,859 lbf)",
        // five engines at the high mixture ratio
        thrustVacN: 5141516 / 5,
        thrustSlN: null,
        // FER 6.3, same instant: specific impulse "4150.2 N-s/kg (423.2 lbf-s/lbm)"
        ispVacS: 423.2,
        ispSlS: null,
        throttleMin: 1,
      },
      // Apollo by the Numbers: "Diameter, ft 33.000", "Height, ft 81.500"
      diameterM: 33 * FT,
      lengthM: 81.5 * FT,
      sources: [FER_AS506, ABTN_KEYFACTS],
    },
    {
      id: 's-ivb',
      name: 'S-IVB',
      // Stage at its mainstage: 166,396 − 1,939 (instrument unit) − 45,693 (spacecraft) = 118,764 kg; less the
      // usable propellant below = 16,928 kg. That is the dry stage (11,273 kg, FER Table 20-10), the residuals
      // at the second cut-off (2,488 kg LOX + 970 kg LH2, FER Table 7-3) and what was vented or used for
      // chilldown and ullage between the burns.
      dryKg: 16928,
      // Main-stage propellant actually burnt in the two burns of Apollo 11: 31,152 kg (68,678 lbm, first burn)
      // + 70,684 kg (155,832 lbm, second burn) = 101,836 kg (FER Table 20-9). The small reserve left at the
      // guided second cut-off is not counted as usable.
      propellantKg: 101836,
      engine: {
        name: 'J-2',
        count: 1,
        // FER Table 7-1, first burn, flight reconstruction: thrust 901,223 N (202,603 lbf)
        thrustVacN: 901223,
        thrustSlN: null,
        // FER Table 7-1: specific impulse 4204 N-s/kg (428.7 lbf-s/lbm) at mixture ratio 4.93
        ispVacS: 428.7,
        ispSlS: null,
        throttleMin: 1,
      },
      // Apollo by the Numbers: "Diameter, ft (top) 21.667", "Height, ft 58.630"
      diameterM: 21.667 * FT,
      lengthM: 58.63 * FT,
      sources: [FER_AS506, ABTN_KEYFACTS],
    },
  ],
  jettisons: [
    {
      // "S-II aft interstage": the large part of the S-IC/S-II interstage, dropped at second-plane separation
      name: 'S-II aft interstage',
      // FER Table 20-9: "S-IC/S-II interstage large" 3,982 kg (8,779 lbm)
      massKg: 3982,
      afterStage: 1,
      // FER Table 2-2: "S-II Second Plane Separation Command" 192.3 s; "S-II Mainstage" 166.2 s
      delayS: 192.3 - 166.2,
      sources: [FER_AS506],
    },
    {
      name: 'Launch Escape System',
      // FER Table 20-9: "Launch escape system" 4,042 kg (8,910 lbm)
      massKg: 4042,
      afterStage: 1,
      // FER Table 2-2: "Launch Escape Tower (LET) Jettison" 197.9 s; "S-II Mainstage" 166.2 s
      delayS: 197.9 - 166.2,
      sources: [FER_AS506],
    },
  ],
  // Instrument Unit. FER Table 20-9: 1,939 kg (4,275 lbm); Apollo by the Numbers: "Total Instrument Unit 4,275"
  upperStageExtrasKg: 1939,
  note:
    'As flown on Apollo 11 (AS-506): masses, thrust levels and event times from the flight evaluation report. ' +
    'Payload = spacecraft without the Launch Escape System (Apollo 11: 45,693 kg with the adapter).',
  sources: [FER_AS506, ABTN_WEIGHTS, ABTN_KEYFACTS, A11_PRESS_KIT, SA507_MANUAL, WIKI_F1],
  ascent: {
    // Flight Manual SA-507: "The vehicle rises nearly vertically from the pad, for approximately 450 feet, to clear the tower."
    towerClearanceM: 450 * FT,
    // Cut-off of one stage to "mainstage" (full thrust) of the next, FER Table 2-2:
    //   S-IC outboard engine cut-off 161.63 s → S-II mainstage 166.2 s; S-II cut-off 548.22 s → S-IVB mainstage 554.7 s
    separationCoastS: [166.2 - 161.63, 554.7 - 548.22],
    engineEvents: [
      {
        stage: 0,
        // FER: "Center Engine Cutoff (CECO) was initiated by the Instrument Unit (IU) at 135.20 seconds as planned";
        // first motion at 0.3 s. The Flight Manual gives the reason: "to limit the vehicle acceleration to a nominal 3.98 g".
        afterIgnitionS: 135.2 - 0.3,
        id: 'ceco-s-ic',
        label: 'S-IC centre engine cut-off (CECO)',
        enginesRunning: 4,
      },
      {
        stage: 1,
        // FER 6.3: centre engine cut-off at "ESC +297.58 seconds (460.62 seconds)"; S-II mainstage 166.2 s
        afterIgnitionS: 460.62 - 166.2,
        id: 'ceco-s-ii',
        label: 'S-II centre engine cut-off (CECO)',
        enginesRunning: 4,
      },
      {
        stage: 1,
        // FER Table 2-2: "S-II Low Engine Mixture Ratio (EMR) Shift (Actual)" 498.0 s
        afterIgnitionS: 498.0 - 166.2,
        id: 'emr-shift-s-ii',
        label: 'S-II engine mixture ratio shift',
        // FER 6.3: "at ESC +351 seconds the total vehicle thrust was 3,082,769 Newtons (693,034 lbf)", four engines
        thrustVacN: 3082769 / 4,
        // ASSUMPTION: the report does not state the specific impulse after the shift (mixture ratio 4.3). Used:
        // 428.7 s, the J-2 value it reconstructs for the S-IVB at mixture ratio 4.93 (Table 7-1), the nearest
        // stated operating point. A leaner J-2 is slightly more efficient, so this is if anything low.
        ispVacS: 428.7,
      },
    ],
    cutoffLabels: ['S-IC outboard engine cut-off (OECO)', 'S-II outboard engine cut-off (OECO)', 'S-IVB first cut-off'],
    sources: [FER_AS506, SA507_MANUAL],
  },
}

// ---------------------------------------------------------------------------------------------------------
// Space Launch System
// ---------------------------------------------------------------------------------------------------------

// Solid Rocket Booster (five-segment), one of two.
const SLS_BOOSTER: NonNullable<LaunchVehicleSpec['boosters']> = {
  id: 'sls-srb',
  name: 'Solid Rocket Booster',
  count: 2,
  // Reference guide: "Weight (each): 1.6 million lbs. (726 t) loaded, 219,000 lbs. (99.3 t) empty"
  dryKg: 219000 * LBM,
  // QM-1 paper: "Propellant mass 1.385 Mlbm"; Northrop Grumman: "Burns 1,385,000 pounds of propellant in two minutes"
  propellantKg: 1385000 * LBM,
  engine: {
    name: 'Five-segment solid rocket motor',
    count: 1,
    // Reference guide: "Maximum thrust: 3.6 million lbs. (16,014 kN) each (vacuum)". Quoted for reference: the
    // simulator takes the boosters' thrust from the profile below and the specific impulse, not from this figure.
    thrustVacN: 3.6e6 * LBF,
    // QM-1 paper: "Max sea level thrust 3.28 Mlbf"
    thrustSlN: 3.28e6 * LBF,
    // QM-1 paper: "Action time vacuum total impulse 368.1 Mlbf-sec" over "Propellant mass 1.385 Mlbm":
    // 368.1 / 1.385 = 265.8 s. No NASA or Northrop Grumman document opened states the specific impulse itself.
    ispVacS: 368.1 / 1.385,
    // ASSUMPTION (derived, not stated): vacuum value × 3.28 / 3.6, the ratio of the QM-1 paper's maximum
    // sea-level and vacuum thrusts, i.e. the same propellant flow at both pressures. 242.2 s.
    ispSlS: ((368.1 / 1.385) * 3.28) / 3.6,
    throttleMin: 1,
  },
  // Reference guide: "Burn time: 126 sec."; QM-1 paper: "Action time 126.2 sec"
  burnTimeS: 126,
  // Reference guide: "Each SLS booster is 177 ft. (54.1 m) tall, 12 ft. (3.7 m) in diameter"
  diameterM: 3.7,
  lengthM: 54.1,
  sources: [SLS_REF_GUIDE, QM1_PAPER, NG_BOOSTER_FACTS],
}

// Booster thrust against time. No table is published; this is the profile the reference guide describes in
// words: "is designed to provide a maximum 3.6 million lbs. (16,014 kN) thrust for roughly 25 seconds, ramp
// down to about 2.8 million lbs. (12,455 kN) thrust as SLS passes through max Q, and then ramp up to about
// 3.3 million lbs. (14,679 kN) of thrust before beginning to tail off about 90 seconds into flight."
// Knots [s, million lbf vacuum], straight lines between: 3.6 to 25 s; 2.8 at 70 s (max Q: "Max dynamic pressure
// 00:01:10", Artemis I timeline); 3.3 at 90 s; zero at 126 s (burn time). ASSUMPTION for the one thing the
// words leave open, the shape of the tail-off: 3.3 is held until 98.3 s and then falls linearly, which makes
// the area under the curve the QM-1 paper's total impulse (368.1 Mlbf-sec). The simulator scales the shape to
// the propellant mass and specific impulse above, which is the same total impulse.
const SLS_BOOSTER_THRUST: [number, number][] = [
  [0, 3.6],
  [25, 3.6],
  [70, 2.8],
  [90, 3.3],
  [98.3, 3.3],
  [126, 0],
]

// RS-25 at 109% rated power level, the setting SLS flies.
const RS25 = {
  name: 'RS-25',
  count: 4,
  // Reference guide: "Maximum thrust: 418,000 lbs. (1,852 kN), sea level; 512,300 lbs. (2,279 kN), vacuum at
  // 109 percent power level". (The guide's 1,852 kN is 416,300 lbf, the figure of an older NASA fact sheet;
  // L3Harris states 418,000 lb as well, so the pound value is used.)
  thrustVacN: 512300 * LBF,
  thrustSlN: 418000 * LBF,
  // L3Harris specification sheet: "In Vacuum: 452.3 sec"; engine page: "Sea Level: 366 sec."
  ispVacS: 452.3,
  ispSlS: 366,
  // Reference guide: "thrust ranging from 65 percent to 109 percent" of rated power level: 65 / 109
  throttleMin: 65 / 109,
}

// Core Stage without the adapter above it.
// Reference guide: "Weight (without engines): 2.4 million lbs. (1,090 t) fueled, 188,000 lbs. (85.3 t) empty";
// RS-25 "Weight (each): 7,750 lbs. (3.5 t)". 188,000 + 4 × 7,750 = 219,000 lb = 99,337 kg.
const CORE_DRY_KG = (188000 + 4 * 7750) * LBM
// Reference guide: "Capacities: 537,000 gal. (2 million L), 317,000 lbs. (143.8 t) liquid hydrogen fuel;
// 196,000 gal. (741,941 L), 1.86 million lbs. (843.7 t) liquid oxygen oxidizer"; 143.8 + 843.7 = 987.5 t.
// ASSUMPTION: all of it counts as usable from liftoff. NASA publishes neither the residuals nor what the
// engines use before liftoff ("Engines start about 6 seconds prior to booster ignition"); the core stage is
// cut off by guidance before it runs dry (see the Artemis I test), so this affects only the margin shown.
const CORE_PROPELLANT_KG = 143800 + 843700
// Reference guide, Launch Vehicle Stage Adapter: "Weight: 10,000 lbs. (4.5 t)". It stays on the core stage:
// "a separation system that fires to separate itself and the core stage from the ICPS, Orion stage adapter, and Orion."
const LVSA_KG = 10000 * LBM

// Orion hardware dropped on the way up. Artemis I Reference Guide, Orion quick facts: launch abort system
// liftoff weight 16,700 lb (7,600 kg); spacecraft adapter jettisoned fairings 2,800 lb (1,300 kg).
// Planned times, Artemis I timeline: "Service module fairing jettison (MET 00:03:11)", "Launch abort system
// jettison (MET 00:03:16)". Both are counted here, so payloadKg must NOT contain them: Orion on SLS is the crew
// module, the service module and the spacecraft adapter.
const ORION_JETTISONS: LaunchVehicleSpec['jettisons'] = [
  { name: 'Service module fairing', massKg: 1300, afterStage: 0, delayS: 191, sources: [ARTEMIS_I_REF_GUIDE, ARTEMIS_I_TIMELINE] },
  { name: 'Launch Abort System', massKg: 7600, afterStage: 0, delayS: 196, sources: [ARTEMIS_I_REF_GUIDE, ARTEMIS_I_TIMELINE] },
]

// RS-25 power levels through the ascent, reference guide: "Engines throttled to 109 percent rated power level at
// booster ignition (T-0)."; "At T + 55 seconds, engines throttle down to lessen stress on the rocket during
// maximum dynamic pressure (max Q)." (no level given; the post-flight paper has it: maximum dynamic pressure
// "with the RS-25s at 100 percent RPL"); "At T + 81 seconds engines throttle back up to 109 percent rated power
// level."; "At T + 123 seconds engines throttle down to 85 percent rated power level"; "At T + 132 seconds engines
// throttle back up to 109 percent rated power level following booster separation."; "At T + 421 seconds engines
// throttle back as needed to reduce acceleration forces (max g level)."
const RS25_EVENTS = [
  { stage: 0, afterIgnitionS: 55, id: 'throttle-max-q', label: 'RS-25 throttle down for Max Q', throttle: 100 / 109 },
  { stage: 0, afterIgnitionS: 81, id: 'throttle-up', label: 'RS-25 throttle up', throttle: 1 },
  { stage: 0, afterIgnitionS: 123, id: 'throttle-booster-sep', label: 'RS-25 throttle down for booster separation', throttle: 85 / 109 },
  { stage: 0, afterIgnitionS: 132, id: 'throttle-up-2', label: 'RS-25 throttle up', throttle: 1 },
]
// Acceleration held by throttling late in the core stage burn. The reference guide gives no number ("as needed
// to reduce acceleration forces"); the flown value is used: "Maximum acceleration on the launch vehicle occurred
// shortly before MECO and topped off at approximately 3.25 G" (SciTech 2024 paper). ASSUMPTION: that maximum is
// the limit. It reproduces the planned start of the throttling (T + 421 s) to within a few seconds.
const SLS_MAX_G = 3.25
// Artemis I, actual: "the best current estimate is 130.818 s MET" for booster separation (planned 00:02:12).
const SLS_BOOSTER_SEPARATION_S = 130.818

// The orbit before the Trans-Lunar Injection, as flown on Artemis I (new in this model; NOT YET VALIDATED by the
// science lead, see PARKING_ELLIPSE_MARKER in missionNrho.ts). 1 nmi = 1.852 km.
//  - Insertion by the Core Stage, flight-reconstructed (used): JANNAF 2024, "The orbital insertion parameters were
//    972.6 nautical miles (1,801 km) by 15.9 nautical miles (29.4 km)". Other NASA statements, not used:
//    pre-flight "16 × 975 nmi orbit (30 x 1806 km)" (AAS 20-649, ARTEMIS_I_TRAJECTORY; JANNAF 2024: "Predicted
//    parameters were 975 nautical miles (1,806 km) by 16 nautical miles (29.6 km)"); flown "an initial orbit of
//    16 x 972 nautical miles (nmi)" (IAC 2023, ARTEMIS_I_IAC_2023, rounded); SciTech 2024 "972.1 mi. (1,564 km) by
//    16 mi. (25.7 km)" (converted as statute miles there, which contradicts the other three; not used).
//  - Perigee Raise Maneuver by the ICPS: flown "raising ICPS/Orion to a 100 x 974.5 nmi Earth orbit" (IAC 2023);
//    pre-flight "to raise the perigee to 100 nmi (185 km)" (AAS 20-649). Both say 100 nmi. When: "Approximately
//    45 minutes after CoreSep, the vehicle stack has coasted near apogee" (AAS 20-649); "a 45-minute coast phase
//    before the ICPS performed at perigee raise maneuver" (JANNAF 2024); planned "Perigee Raise Maneuver (MET
//    00:52:56)", "22 seconds in duration" (Artemis I press kit, ARTEMIS_I_PRESS_KIT). The planner burns
//    prograde, centred on the first apogee, as long as it takes to reach the 100 nmi perigee; the flown apogee
//    after it (974.5 nmi) and the planned 22 s are for comparison, not inputs.
//  - Injection: "The TLI burn begins prior to the next perigee passage and occurs at a true anomaly between −40◦
//    and −95◦" (AAS 20-649, pre-flight design; no flown value published). The planner centres the burn in time on
//    the perigee and checks the ignition against this range. Planned "Trans-lunar injection (MET 01:29:27)",
//    "Approximately 18 minute burn" (press kit); flown "The 18-minute burn" (JANNAF 2024), "the 20-minute TLI
//    burn" (IAC 2023): for comparison only.
// Altitudes are taken as above R_EARTH_EQ, as everywhere in ascent.ts; the sources do not say above which surface.
const ARTEMIS_I_TRAJECTORY: SourceRef = {
  label: 'Batcha et al. (NASA JSC), Artemis I Trajectory Design and Optimization, AAS 20-649 (NTRS 20205005150)',
  url: 'https://ntrs.nasa.gov/api/citations/20205005150/downloads/AAS20649_Artemis1_Trajectory_Design_Optimization.pdf',
}
const ARTEMIS_I_IAC_2023: SourceRef = {
  label: 'NASA, Artemis I flight results paper, IAC 2023 (NTRS 20230012789)',
  url: 'https://ntrs.nasa.gov/api/citations/20230012789/downloads/IAC%202023Artemis%20I%20paper-FINALSTRIVES.pdf',
}
const ARTEMIS_I_PRESS_KIT: SourceRef = {
  label: 'NASA, Artemis I press kit: ascent and mission timeline (planned times)',
  url: 'https://www.nasa.gov/artemis-i-press-kit/',
}
const NMI = 1.852
const SLS_BLOCK_1_PARKING: ParkingEllipse = {
  // JANNAF 2024 (flown): "972.6 nautical miles (1,801 km) by 15.9 nautical miles (29.4 km)"
  insertionPerigeeKm: 15.9 * NMI,
  insertionApogeeKm: 972.6 * NMI,
  // IAC 2023 (flown): "a 100 x 974.5 nmi Earth orbit"; AAS 20-649 (pre-flight): "raise the perigee to 100 nmi (185 km)"
  raisedPerigeeKm: 100 * NMI,
  // AAS 20-649: "occurs at a true anomaly between −40◦ and −95◦"
  ignitionTrueAnomalyDeg: [-95, -40],
  sources: [JANNAF_2024, ARTEMIS_I_IAC_2023, ARTEMIS_I_TRAJECTORY, ARTEMIS_I_PRESS_KIT],
}

const SLS_BLOCK_1: AscentVehicle = {
  id: 'sls-block-1',
  name: 'SLS Block 1',
  boosters: SLS_BOOSTER,
  stages: [
    {
      id: 'core-stage',
      name: 'Core Stage',
      dryKg: CORE_DRY_KG + LVSA_KG,
      propellantKg: CORE_PROPELLANT_KG,
      engine: RS25,
      // Reference guide: "Height: 212 ft. (64.6 m) from forward skirt to engine exhaust exit plane"; "Diameter: 27.6 ft. (8.4 m)"
      diameterM: 8.4,
      lengthM: 64.6,
      sources: [SLS_REF_GUIDE, L3_RS25],
    },
    {
      id: 'icps',
      name: 'Interim Cryogenic Propulsion Stage (ICPS)',
      // Fallback, no NASA, Boeing or ULA document states it: "Dry mass of 3.8 tonnes; 32.7 tonnes fuelled."
      // (J. McDowell; Wikipedia's ICPS entry gives the same 3,800 kg)
      dryKg: 3800,
      // Reference guide: "Weight: 72,197 lbs. (32.7 t) fueled"; 72,197 lb = 32,748 kg, less the dry mass above.
      // ASSUMPTION: everything that is not dry mass is usable main-engine propellant.
      propellantKg: 72197 * LBM - 3800,
      engine: {
        name: 'RL10B-2',
        count: 1,
        // Reference guide: "single Aerojet Rocketdyne RL10B-2 engine producing 24,750 lbs. (110 kN) of thrust"
        thrustVacN: 24750 * LBF,
        thrustSlN: null,
        // National Academies review, RL10B-2: "develops an Isp of 465.5 sec."
        ispVacS: 465.5,
        ispSlS: null,
        throttleMin: 1,
      },
      // Reference guide: "Height: 45 ft. (13.7 m)"; "Diameter: 16.7 ft. (5.1 m)"
      diameterM: 5.1,
      lengthM: 13.7,
      sources: [SLS_REF_GUIDE, NAS_PROPULSION_REVIEW, MCDOWELL_ARTEMIS1],
    },
  ],
  jettisons: ORION_JETTISONS,
  // Orion Stage Adapter. Reference guide: "Weight: 1,800 lbs. (0.8 t)"
  upperStageExtrasKg: 1800 * LBM,
  note:
    'As flown on Artemis I. The Launch Vehicle Stage Adapter leaves with the Core Stage, the Orion Stage Adapter stays on the ICPS. ' +
    'Payload = Orion without Launch Abort System and service module fairing (both are in the jettison list).',
  sources: [SLS_REF_GUIDE, ARTEMIS_I_REF_GUIDE, ARTEMIS_I_TIMELINE, QM1_PAPER, NG_BOOSTER_FACTS, L3_RS25, JANNAF_2024, SCITECH_2024, BOOSTER_SEP_PAPER],
  ascent: {
    maxAxialG: SLS_MAX_G,
    // Artemis I, actual: "Main engine cutoff occurred 8 minutes, 1 second into the mission"; "Staging of the core
    // stage from ICPS and Orion was at T+8 minutes, 13 seconds." An ICPS burn during the ascent (not flown on
    // Artemis I, where the core stage alone reaches the insertion orbit) can start no earlier than that.
    separationCoastS: [12],
    engineEvents: RS25_EVENTS,
    boosterThrustProfile: SLS_BOOSTER_THRUST,
    boosterSeparationS: SLS_BOOSTER_SEPARATION_S,
    cutoffLabels: ['Main Engine Cutoff (MECO)', 'ICPS engine cut-off'],
    parkingEllipse: SLS_BLOCK_1_PARKING,
    sources: [SLS_REF_GUIDE, JANNAF_2024, SCITECH_2024, BOOSTER_SEP_PAPER, QM1_PAPER],
  },
}

const SLS_BLOCK_1B: AscentVehicle = {
  id: 'sls-block-1b',
  name: 'SLS Block 1B',
  boosters: SLS_BOOSTER,
  stages: [
    {
      id: 'core-stage',
      name: 'Core Stage',
      // Core Stage as on Block 1. ASSUMPTION: NASA has not published the mass of the Block 1B interstage that
      // leaves with the core stage; the Launch Vehicle Stage Adapter's 10,000 lb stands in for it (a structure
      // of the same 8.4 m diameter in the same place).
      dryKg: CORE_DRY_KG + LVSA_KG,
      propellantKg: CORE_PROPELLANT_KG,
      engine: RS25,
      diameterM: 8.4,
      lengthM: 64.6,
      sources: [SLS_REF_GUIDE, L3_RS25],
    },
    {
      id: 'eus',
      name: 'Exploration Upper Stage (EUS)',
      // Wikipedia (fallback): "Empty (dry) mass: 14,110 kg (31,110 lb)"
      dryKg: 14110,
      // Wikipedia (fallback, uncited there): propellant mass "129,000 kg (284,000 lb)"
      propellantKg: 129000,
      engine: {
        name: 'RL10C-3',
        count: 4,
        // Block 1B fact sheet: "four RL10C-3 engines", total "97,360 lbf"; a quarter each
        thrustVacN: (97360 / 4) * LBF,
        thrustSlN: null,
        // Wikipedia (fallback): "Specific impulse: 460.1 s (4.512 km/s)"
        ispVacS: 460.1,
        ispSlS: null,
        throttleMin: 1,
      },
      // Wikipedia (fallback): height "17.3 m (57 ft)"; "LH2 tank: 8.4 m (28 ft)"
      diameterM: 8.4,
      lengthM: 17.3,
      sources: [SLS_B1B_FACTS, WIKI_EUS],
    },
  ],
  jettisons: ORION_JETTISONS,
  // ASSUMPTION: the Universal Stage Adapter, which stays on the EUS under Orion, has no published mass; the
  // Launch Vehicle Stage Adapter's 10,000 lb stands in for it (same diameter, similar size).
  upperStageExtrasKg: LVSA_KG,
  note:
    'Boosters and Core Stage as on Block 1; the Exploration Upper Stage finishes the ascent into a circular parking orbit ' +
    '(NASA: "the EUS engines will burn on ascent to help place Orion in a 100 x 100 nautical mile (nmi) circular orbit"). ' +
    'EUS masses are Wikipedia values; interstage and Universal Stage Adapter masses are stand-ins.',
  sources: [SLS_REF_GUIDE, SLS_B1B_FACTS, ARTEMIS_I_REF_GUIDE, QM1_PAPER, L3_RS25, SCITECH_2024, WIKI_EUS],
  ascent: {
    maxAxialG: SLS_MAX_G,
    // No source gives the time between core stage cut-off and EUS ignition: zero.
    separationCoastS: [0],
    engineEvents: RS25_EVENTS,
    boosterThrustProfile: SLS_BOOSTER_THRUST,
    boosterSeparationS: SLS_BOOSTER_SEPARATION_S,
    cutoffLabels: ['Main Engine Cutoff (MECO)', 'EUS engine cut-off'],
    sources: [SLS_REF_GUIDE, SCITECH_2024, BOOSTER_SEP_PAPER, QM1_PAPER],
  },
}

/** The presets. Typed as the hardware contract; each entry also carries its ascent profile (AscentVehicle). */
export const LAUNCH_VEHICLES: LaunchVehicleSpec[] = [SATURN_V, SLS_BLOCK_1, SLS_BLOCK_1B]

export const launchVehicle = (id: string): AscentVehicle | undefined => LAUNCH_VEHICLES.find((v) => v.id === id)

// Assumptions and fallbacks in this file, in one place:
//  - F-1 vacuum specific impulse 304 s: Wikipedia.
//  - S-II specific impulse after the mixture ratio shift: the S-IVB's reconstructed J-2 value, 428.7 s.
//  - SLS booster sea-level specific impulse: derived from the ratio of maximum sea-level to vacuum thrust.
//  - SLS booster tail-off shape after 90 s: chosen to give the QM-1 total impulse.
//  - SLS core stage: the whole propellant capacity counts as usable.
//  - SLS acceleration limit: the 3.25 g observed on Artemis I.
//  - ICPS dry mass 3,800 kg: J. McDowell / Wikipedia; propellant = fuelled weight minus that.
//  - EUS dry mass, propellant, specific impulse, size: Wikipedia.
//  - Block 1B interstage and Universal Stage Adapter: each the Launch Vehicle Stage Adapter's 10,000 lb.
//  - SLS tower clearance: no figure; the simulator's default (1.5 × the summed stage lengths) applies.
