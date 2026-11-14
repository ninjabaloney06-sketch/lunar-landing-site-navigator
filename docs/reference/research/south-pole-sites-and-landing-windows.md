# NASA data frames south-pole sites and landing windows

**NASA has named regions but has selected no landing site, published no region coordinates and released no landing calendar for 2027-2030, so site and window selection must be computed from terrain and ephemerides.** The 2026 replan matters first: Artemis III became a low-Earth-orbit docking test, the first crewed south-pole landing moved to Artemis IV (target 2028), NRHO was replaced as the rendezvous orbit, Gateway was paused and the "Moon Base" programme replaced Artemis Base Camp ([NASA-Oct26]; [Spaceflight Now, 25 Mar 2026](https://spaceflightnow.com/2026/03/25/nasa-outlines-ambitious-20-billion-plan-for-moon-base/)). Every quantitative NASA window analysis found (about 55 descent opportunities per year, about 28 crewed opportunities, a 5.75-6.5-day stay) assumes the retired NRHO design and is therefore legacy ([HLS-OV]; [LPSC26]). The durable inputs are terrain and geometry: land within 6 degrees of the pole, slope below 10 degrees over 100 m, 100 m landing accuracy, sunlight for the whole stay and direct-to-Earth visibility ([HLS-OV]). The best ridge sites are lit 76-88 % of the time at 0-2 m height with worst-case darkness of 65-268 hours ([GLAESER18]), Earth is up roughly two weeks in four ([HLS-OV]), and peak lighting drifts 2-3 weeks earlier each year ([LPSC26]). Researcher-derived south-summer solstices fall on about 17 Nov 2026, 30 Oct 2027 and 11 Oct 2028 (unverified; see the solstice table below). Water ice has one ground truth, LCROSS in Cabeus at 5.6 +/- 2.9 wt% ([COLAPRETE10]), while ShadowCam (2026) found no widespread surface ice ([SHADOWCAM26]). The "possible bacteria" question is forward contamination by terrestrial microbes in modelled shadow niches, not lunar life ([SAXENA-NASA]).

## How to read this report

Research date is 14 November 2026. Coordinates are decimal degrees, latitude negative = south, longitude east-positive (-180..180 unless a 0-360 E value is quoted). No site source names its reference frame; LRO-based products use the Mean-Earth/Polar-Axis frame of DE421 ([ldem_875s_5m.lbl](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.lbl)). Short tags in square brackets such as [HLS-OV] are links; the documents behind them are named in the source key at the end.

| Label | Meaning |
|---|---|
| ESTABLISHED / MODEL / CONTESTED / SPECULATIVE | measured or documented / published simulation / published but disputed / hypothesis without data |
| DIRECT / INDIRECT / MODEL / SPEC | ice evidence class: direct detection / proxy (neutrons, temperature, albedo, radar) / modelling / speculation or press |
| REQ / CHOICE / RULE / LEGACY | stated NASA requirement / mission-specific screening value / rule of thumb / belongs to the superseded NRHO-era plan |
| FLOWN / PLANNED / SUPERSEDED | mission status on 14 Nov 2026 |
| V / L / P / X | URL check on 14 Nov 2026: fetched with HTTP 200 / read from a directory listing / built from a verified naming pattern / found broken |
| **[derived]** | computed by the researchers, not published by NASA |
| **[secondary]** / **[excerpt]** | rests on Wikipedia, press or tracker sites / on a search-result excerpt, not the full text |

## The 2026 replan moves the first landing to Artemis IV and makes NRHO analyses legacy

### Programme changes recorded for 2026

| Change | Current state (Nov 2026) | Superseded plan | Source and caveat |
|---|---|---|---|
| Artemis III re-scope (27 Feb 2026 briefing, posted 3 Mar) | Crewed LEO test, 14-17 days: Orion docks with a Blue Moon MK2 test vehicle, then a Starship test article | First crewed south-pole landing from NRHO, about 6.5-day stay | [NASA-Oct26]; [Spaceflight Now, 27 Feb 2026](https://spaceflightnow.com/2026/02/27/nasa-announces-major-overhaul-of-artemis-moon-program/); [WP-A3] **[secondary]** |
| Artemis III date | "Next year" (NASA, Oct 2026); mid-2027 still official; about 90 days behind per the administrator (Sep 2026) | 2026-2027 landing | [NASA-Oct26]; [SPOL-Oct26]; [PAYLOAD-Oct26]. Conflict: Wikipedia cites "no earlier than late 2027" and an infobox value NET June 2027 ([WP-A3]) |
| First crewed landing | Artemis IV, 2028; two crew land near the South Pole with Starship HLS or Blue Moon MK2 | Artemis III | [NASA-Oct26]. Conflict: "early 2028" (Feb-Mar 2026) versus end-of-2028 goal (Oct 2026) ([Starlust, 4 Mar 2026](https://starlust.org/heres-what-nasa-is-planning-for-artemis-iv-and-v-now-that-the-roadmap-to-the-moon-has-been-revised/); [PAYLOAD-Oct26]) |
| Artemis V | Second landing, late 2028 | Blue Moon debut on Artemis V | [Starlust, 4 Mar 2026](https://starlust.org/heres-what-nasa-is-planning-for-artemis-iv-and-v-now-that-the-roadmap-to-the-moon-has-been-revised/); [WP-ART] **[secondary]** |
| Rendezvous orbit | NRHO replaced. Starship: docks with Orion in Earth orbit, performs TLI, goes to low lunar orbit. Blue Moon: elliptical polar lunar orbit | 9:2 southern L2 NRHO, about 6.5-day period | [NASA-Oct26]. NASA gives no altitudes; Wikipedia gives 100 x 6,500 km for the polar ellipse ([WP-A4]) **[secondary]** |
| Lander assignment | "Neither provider is assigned to a specific lunar landing mission"; Plan A Starship, Plan B New Glenn + MK2 | Starship for Artemis III/IV, Blue Moon for Artemis V | [NASA-Oct26]; [PAYLOAD-Oct26] |
| Surface mission | Two crew on the surface for "several days"; two moonwalks of about two hours each; lighter "sortie" suit | 6.5-day stay, multiple EVAs | [NASA-Oct26]; [SPOL-Oct26] |
| SLS | Block 1B and Block 2, Exploration Upper Stage and Mobile Launcher 2 dropped; standardised on Block 1 | Block 1B from Artemis IV | [WP-ART] **[secondary]**; [Starlust, 4 Mar 2026](https://starlust.org/heres-what-nasa-is-planning-for-artemis-iv-and-v-now-that-the-roadmap-to-the-moon-has-been-revised/). Conflict on the Artemis IV upper stage: ICPS ([WP-A4]) versus Centaur V ([WP-ART]) |
| Gateway | "Paused in its current form" (24 Mar 2026); hardware repurposed for the surface | Staging node in NRHO from Artemis IV | [Spaceflight Now, 25 Mar 2026](https://spaceflightnow.com/2026/03/25/nasa-outlines-ambitious-20-billion-plan-for-moon-base/); [CBS News, 24 Mar 2026](https://www.cbsnews.com/news/nasa-moon-base-plan-lunar-south-pole/). Conflict: Wikipedia lists it as "cancelled" ([WP-A4]) |
| Base programme | "Moon Base", three phases to 2032 and beyond, announced 24 Mar 2026 | "Artemis Base Camp" (no formal cancellation reported) | [MB-PDF]; [PBS NewsHour, May 2026](https://www.pbs.org/newshour/amp/science/watch-nasa-shares-plans-to-construct-moon-base) |
| Landing region | South Pole remains the target; site undecided; NASA wants more robotic-lander data | Nine regions of Oct 2024 | [SPOL-Oct26]; [NASA-Oct26]. One newsletter reports NASA considered a first landing away from the pole ([MM277]) **[secondary, unconfirmed]** |

### Mission status on 14 November 2026

| Mission | Status | Date | Profile | Source |
|---|---|---|---|---|
| Artemis I | FLOWN | Launch 16 Nov 2022 06:47:44 UTC, 25 days | Uncrewed, distant retrograde orbit | [WP-ART] **[secondary]** |
| Artemis II | FLOWN | Launch 1 Apr 2026 22:35:12 UTC; splashdown 10 Apr 2026 8:07 pm ET off San Diego | Crewed free-return flyby; 695,081 miles; re-entry 24,664 mph | [WP-ART] **[secondary]**; [Space.com, Apr 2026](https://www.space.com/space-exploration/artemis/artemis-2-astronauts-return-to-earth-ending-historic-moon-mission/amp/) |
| Artemis III | PLANNED, LEO test | 2027 | Orion on SLS Block 1 to about 230 nmi (430 km), 33 deg inclination; day 3 docking with Blue Moon vehicle, day 8 docking with Starship for about 2 hours | [PAYLOAD-Oct26]; [SPOL-Oct26]; orbit from [WP-A3] **[secondary]** |
| Artemis IV | PLANNED, first landing | 2028 | Four crew on Orion/SLS, two land | [NASA-Oct26] |
| Artemis V | PLANNED, second landing | Late 2028 | Start of base build-up | [WP-ART] **[secondary]** |

Hardware status adds schedule risk. Artemis III booster stacking finished on 30 Sep 2026 and the core stage was mated on 28 Oct 2026 ([NASA blog, 13 Oct 2026](https://www.nasa.gov/blogs/artemis/2026/10/13/nasa-completes-artemis-iii-booster-stacking-shares-status-update/); [Lunar Week tracker](https://spacenexus.us/moon/weekly/week-of-2026-11-02) **[secondary]**). Starship reached orbit in Sep 2026, while New Glenn had not returned to flight after a reported pad explosion in May 2026 ([PAYLOAD-Oct26]; [CRS In Focus IF11643, 25 Jun 2026](https://www.everycrsreport.com/files/2026-06-25_IF11643_f42f123e3663b5d6aef757a78d6406c1af3dc8be.html)). One researcher could not verify the explosion independently, so treat it as reported, not confirmed. The NASA Inspector General found at least two years of Starship HLS delay since 2021, at least eight months for Blue Moon, a tip-over risk from Starship's height and no capability to rescue a stranded crew ([OIG26]; [REG-OIG]). NASA tolerates a landed tilt of 8 degrees or less for crew operations, per the same OIG coverage ([REG-OIG]). Both providers must fly an uncrewed lunar demonstration first; SpaceX plans an in-orbit propellant transfer in early 2027 and an uncrewed landing test in late 2027 ([NASA-Oct26]; [SPOL-Oct26]).

### Which NASA analyses are now legacy

| Analysis or figure | Assumption that no longer holds | Still usable for | Source |
|---|---|---|---|
| 13-to-9 region down-selection (LPSC 2026 abstract) | NRHO, Starship HLS, stay of 5.75-6.25 days | Method (calendar-based end-to-end availability) and qualitative criteria. NASA states the nine are specific to Artemis III and do "not affect site selection for Artemis IV and later" | [LPSC26] |
| "All 13 regions contain sites with continuous sunlight throughout a 6.5-day period" | 6.5-day stay | Region names and the 6-degree latitude band | [REL22] |
| About 55 descent opportunities and about 28 NRHO departure opportunities per year | One descent per 6.5-day NRHO revolution | Nothing in the 2028 architecture; legacy mode only | [HLS-OV] |
| HLS viable about 90 days after reaching NRHO | Lander pre-staged in NRHO | Illustrates loiter limits | [WP-SITE] |
| HLS NRHO-to-surface mission design (557 opportunities in ten years at Malapert) | NRHO staging, 100 km LLO loiter | Descent sequence, abort logic | [HLS-MD] |
| Orion rescue study, best solutions in winter 2026-2027 | NRHO | Orion constraints (eclipse, consumables) | [AAS25] |
| White paper "Lunar Site Selection": Artemis IV and later use SLS Block 1B/2 | Block 1B cancelled | Lighting and Earth-visibility reasoning | [WP-SITE] |
| LEAG slides (Dec 2025 / Jan 2026): Artemis IV with a 6.5-day surface mission and about 1 km EVA radius | Superseded two months later | Shows the baseline just before the replan; records the Artemis IV landing-site workshop of 10 Sep 2025 | [LEAG25] |

Orion-side rules survive the replan because they belong to the vehicle, not the orbit: no more than 90 minutes in eclipse, daylight splashdown, and consumables for four crew for 21 days ([A1-AVAIL]; [IAC22]). NASA has published no altitude, period, plane, opportunity cadence, stay length in days or loiter limit for the new orbits ([NASA-Oct26]).

### Moon Base replaces Artemis Base Camp and names one location

| Phase | Years | Content | Numbers | Source |
|---|---|---|---|---|
| 1 "Experiment, Learn" | Now-2029 | Robotic and uncrewed scouting ahead of 2028 crews; rovers; MoonFall hopper drones; relay and observation satellites; RHU night-survival demos | Up to 25 missions including 21 landings; 4 tons of payload | [MB-PDF] |
| 2 "Early Habitation" | 2029-2032 | Semi-permanent infrastructure; solar and RTG power; surface-to-orbit communications across the South Pole | About 60 tons of cargo in 24 landings | [MB-PDF] |
| 3 "Sustained Human Presence" | 2032 and beyond | Habitation modules; fission surface power; pressurised rovers | Up to 38 tons of cargo per year | [MB-PDF] |

Secondary reporting conflicts with the fact sheet on details: Phase 1 "through 2028", Phase 2 with 27 launches, Phase 3 with 29 launches and over 150,000 kg cumulative ([STARLUST-MB3]). Cost is quoted as about $20 billion over seven years ([CBS News, 24 Mar 2026](https://www.cbsnews.com/news/nasa-moon-base-plan-lunar-south-pole/)) and as $30 billion over a decade ([ASTRO-Jun26]).

| Location statement | Evidence level | Source |
|---|---|---|
| The Moon Base is "located at the lunar South Pole" | ESTABLISHED (NASA) | [MB-PDF] |
| Phase 1 robotic missions "identify promising locations for future infrastructure"; Phase 2 deploys "across multiple locations" | ESTABLISHED (NASA) | [MB-PAGE] |
| Moon Base I (Blue Moon MK1 "Endurance") "will land on the Shackleton Connecting Ridge"; no coordinates | ESTABLISHED (NASA wording), coordinates unpublished | [NASA MK1 event page](https://www.nasa.gov/event/clps-flight-blue-origins-blue-moon-mark-1/); [MB-PHASES] |
| Base site described as the ridge above Shackleton and de Gerlache, for sunlit ridges and nearby ice | **[secondary]** | [ASTRO-Jun26] |
| Plan "locks" the Shackleton rim for a nuclear-powered outpost by 2036 | **[secondary]**, single outlet, contradicted by NASA's scouting language | [TechTimes, 26 May 2026](https://www.techtimes.com/articles/317212/20260526/nasa-moon-base-30b-79-launch-plan-locks-shackleton-crater-2036.htm); contrast [MB-PAGE] |
| Environment: above 54 C in sunlit areas to -203 C in permanently shadowed craters | ESTABLISHED (NASA) | [MB-PAGE] |

| Element | Detail bearing on site choice | Source |
|---|---|---|
| Lunar Terrain Vehicle | Astrolab $219M, Lunar Outpost $220M; about 1 t each; deployed about 2 km from crewed landing sites; up to 400 km total driving; two on the surface by 2028 | [STARLUST-May26]; [ASTRO-Jun26] |
| MoonFall | Four hopping drones surveying the South Pole at centimetre scale; Firefly $75M subcontract | [STARLUST-May26]; [MB-PAGE] |
| Pressurised rover (JAXA) | Two crew for up to 30 days; climbs 15-degree slopes; survives 150 hours without light | [ASTRO-Jun26]; [MB-PAGE] |
| Power | Phase 2 solar arrays with batteries above 10 kW plus radioisotope generators; Phase 3 fission | [ASTRO-Jun26]; [MB-PDF] |
| Communications | Phase 2 towers each covering about a 10 km radius | [ASTRO-Jun26] |
| PROMISE | Nuclear-powered rover, 1 m drill, 18-month mission, from late 2028; reported $94M plus $140M option | [MB-PHASES]; [SpaceQ, Nov 2026](https://spaceq.ca/?p=53144) |
| VIPER | Late 2027 on the second Blue Moon MK1, 1 m drill | [MB-PHASES] |

| Architecture document | Date | Relevance | Link |
|---|---|---|---|
| Moon to Mars Architecture Definition Document, Rev C (ESDMD-001, NASA/TM-20250010956) | Dec 2025 | Segments; regional exploration of the South Pole | [NTRS 20250010956](https://ntrs.nasa.gov/citations/20250010956) |
| 2025 Architecture Update | Dec 2025 | Annual update | [NASA PDF](https://www.nasa.gov/wp-content/uploads/2025/12/2025-architecture-update-for-publication.pdf) |
| White paper "Lunar Site Selection" | 2023 | Lighting, Earth visibility, terrain, launch availability | [WP-SITE] |
| White paper "Why Artemis Will Focus on the Lunar South Polar Region" | 2022 | Geometry and thermal rationale | [WP-POLE] |
| White paper "Lunar Mobility Drivers and Needs" | Jun 2024 | Mobility ranges | [NASA PDF](https://www.nasa.gov/wp-content/uploads/2024/06/acr24-lunar-mobility-drivers-and-needs.pdf) |
| Moon Base User's Guide | Apr 2026 | Site plans "must be robust to the challenges presented by lighting in the lunar South Pole region" **[excerpt]** | [NASA PDF](https://www.nasa.gov/wp-content/uploads/2026/04/moon-base-architecture-users-guide.pdf) |
| "Environmental Challenges and Infrastructure Needs of the Lunar South Pole" | 2026 | Habitation, mobility, power, communications needs (not read) | [NTRS 20260008640](https://ntrs.nasa.gov/citations/20260008640) |
| "NASA Mission Needs at the Moon: Communications, PNT, and Observability" | Aug 2026 | Demand signal | [NASA PDF](https://www.nasa.gov/wp-content/uploads/2026/08/scan-cislunar-industry-demand-signal.pdf) |
| Lunar Surface Data Book (M2M-30044) | 2025 | Likely holds lander thermal environments (not read; too large) | [NTRS 20250002845](https://ntrs.nasa.gov/api/citations/20250002845/downloads/M2M-30044%20Lunar%20Surface%20Data%20Book%20Baseline_Final.pdf) |
| Artemis III Science Definition Team report | 2020 | Science objectives behind site choice | [SDT report](https://science.nasa.gov/wp-content/uploads/2023/07/artemis-iii-science-definition-report-12042020c.pdf) |

For site selection the meaning is plain. The sortie list and the base location are separate problems, NASA ranks neither, and the Connecting Ridge is both a region dropped from the 2024 sortie list and the first Moon Base robotic target ([REL24]; [MB-PHASES]).

## Region names are official; nearly every coordinate is a proxy

### The two NASA region lists and their criteria

| List | Regions | Stated definition and criteria | Source |
|---|---|---|---|
| 19 Aug 2022, release 22-089 (13 regions) | Faustini Rim A; Peak Near Shackleton; Connecting Ridge; Connecting Ridge Extension; de Gerlache Rim 1; de Gerlache Rim 2; de Gerlache-Kocher Massif; Haworth; Malapert Massif; Leibnitz Beta Plateau; Nobile Rim 1; Nobile Rim 2; Amundsen Rim | Each region about 15 x 15 km; a landing site is a spot of about 100 m radius; all within 6 degrees of latitude of the pole; criteria: terrain slope, ease of communications with Earth, lighting, launch-window availability, combined SLS/Orion/Starship capability, proximity to a PSR for a moonwalk | [REL22] |
| 28 Oct 2024, release 24-136 (9 regions, "in no priority order") | Peak near Cabeus B; Haworth; Malapert Massif; Mons Mouton Plateau; Mons Mouton; Nobile Rim 1; Nobile Rim 2; de Gerlache Rim 2; Slater Plain | Science potential, launch-window availability, terrain suitability, communication capabilities with Earth, lighting, combined trajectory capabilities; no sizes or coordinates | [REL24] |
| Dropped in 2024 **[derived]** by comparing the lists | Faustini Rim A; Peak Near Shackleton; Connecting Ridge; Connecting Ridge Extension; de Gerlache Rim 1; de Gerlache-Kocher Massif; Leibnitz Beta Plateau (renamed area); Amundsen Rim | New in 2024: Peak near Cabeus B, Mons Mouton Plateau, Mons Mouton, Slater Plain | [REL22]; [REL24] |

NASA's own account of the down-selection gives the logic but no numbers per region ([LPSC26]). Constraints were evaluated together on a calendar basis: launch opportunities, transit and rendezvous geometry, communications, landing performance, surface illumination and terrain safety. Terrain work minimised slope variability inside a landing ellipse and screened craters, block populations and rough ground. Regions with more Earth visibility were preferred if direct-to-Earth links are used. Regions "demonstrating greater robustness across mission epochs and reduced sensitivity to seasonal effects were favored". Individual regions "typically provide limited viable opportunities when all constraints are simultaneously satisfied", which is why several were kept. Specific sites are chosen only after launch dates are set, because the dates fix trajectories and surface conditions ([REL22]; [REL24]).

No down-selection after October 2024 was found. A tracker article says the nine carry over to Artemis IV ([spaceinfo.club, Nov 2026](https://spaceinfo.club/artemis-iv-what-we-know-about-nasas-first-planned-moon-landing-mission-november-2026-update/)) **[secondary]**, which conflicts with NASA's statement that the nine do not constrain Artemis IV ([LPSC26]). A NASA-requested NASEM report identified four non-polar sites of scientific value, and Artemis II pilot Victor Glover argued for an equatorial site ([SPOL-Oct26]).

### NASA Trek polygons for the 13 regions of 2022

The only official machine-readable geometry found is the Moon Trek feature service `A3_Named_regions_SP` (created 22 Aug 2022), which returns axis-aligned squares in south polar stereographic metres on a 1,737,400 m sphere ([TREK-A3]; status V). Extents are quoted from the service. **Centre latitude and longitude are [derived]** by the researchers with the spherical inverse (lat = -90 + 2 atan(rho / 2R), lon = atan2(x, y)); they are not NASA-published numbers.

| FID | Label as served | x min / max (m) | y min / max (m) | Side (km) | Centre lat **[derived]** | Centre lon E **[derived]** |
|---|---|---|---|---|---|---|
| 0 | Amundsen Rim | 154000 / 174000 | 51500 / 71500 | 20 | -84.229 | 69.444 |
| 1 | Nobile Rim 2 | 147000 / 167000 | 85000 / 105000 | 20 | -83.954 | 58.822 |
| 2 | Haworth | -52900 / -23100 | 75600 / 105400 | 29.8 | -86.764 | -22.777 |
| 3 | Faustini Rim A | 54000 / 74000 | -10000 / 10000 | 20 | -87.890 | 90.000 |
| 4 | de Gerlache Rim 2 | -58500 / -38500 | 13000 / 33000 | 20 | -88.230 | -64.628 |
| 5 | Connecting Ridge Extension | -38700 / -18700 | -16100 / 3900 | 20 | -89.032 | -101.999 |
| 6 | Connecting Ridge | -19000 / -3000 | -20000 / -4000 | 16 | -89.463 | -137.490 |
| 7 | Nobile Rim 1 | 74000 / 94000 | 100000 / 120000 | 20 | -85.438 | 37.367 |
| 8 | Peak Near Shakleton (sic) | 22000 / 38000 | -28000 / -12000 | 16 | -88.811 | 123.690 |
| 9 | de Gerlache Rim | -45000 / -29000 | 7000 / 23000 | 16 | -88.683 | -67.932 |
| 10 | Leibnitz Beta Plateau | 65000 / 81000 | 110000 / 126000 | 16 | -85.427 | 31.743 |
| 11 | Malapert Massif | -11000 / 10000 | 111000 / 132000 | 21 | -85.995 | -0.236 |
| 12 | de Gerlache-Kocher Massif | -123400 / -103400 | -66100 / -46100 | 20 | -85.830 | -116.322 |

The boxes measure 16 to 29.8 km, not the 15 km of the press release, so they are schematic regions of interest and not landing ellipses. The projection places +y toward longitude 0 and +x toward 90 E, verified on the Malapert and Faustini boxes ([TREK-A3]). No equivalent layer exists for the nine regions of 2024; both Trek indexes were searched ([TREK-SEARCH]).

### LROC mosaic centres, including two regions of the 2024 list

These are centres and bounds of LROC NAC controlled mosaics built for "Artemis III candidate landing sites" (1 m/px, absolute accuracy 5-20 m). They are **not NASA-declared region centres**, and footprints are larger than the nominal boxes (north-south extent 21 km at Malapert to 88 km at Mons Mouton Plateau, **[derived]** from the bounds). The mapping of product names to 2024 region names is the researchers' reading of the product titles.

| Region (list) | LROC product | Centre lat | Centre lon (-180..180) | Lat bounds | Lon bounds | Source |
|---|---|---|---|---|---|---|
| Peak near Cabeus B (2024) | NAC_ROI_CABEUSPKLO2_P836S2912 | -83.6 | -68.8 (291.2 E) | -84.06 to -83.21 | -72.47 to -64.80 | [LROC RDR](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_CABEUSPKLO2) |
| Haworth (2022, 2024) | NAC_ROI_HAWORTH_LO1_P867S3363 | -86.7 | -23.7 (336.3 E) | -87.39 to -86.11 | -34.98 to -12.36 | [LROC RDR](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_HAWORTH_LO1) |
| Malapert Massif (2022, 2024) | NAC_ROI_MALAPERTLO1_P860S0003 | -86.0 | 0.3 | -86.33 to -85.63 | -5.66 to 5.15 | [LROC RDR](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_MALAPERTLO1) |
| Mons Mouton Plateau (2024) | NAC_ROI_MOUTNPLTLO1_P843S0306 | -84.3 | 30.6 | -85.76 to -82.85 | 15.49 to 46.61 | [LROC RDR](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_MOUTNPLTLO1) |
| Nobile Rim 1 and Mons Mouton / Leibnitz Beta Plateau | NAC_ROI_MTMOUTONLO1_P854S0353 | -85.4 | 35.3 | -86.07 to -84.82 | 27.29 to 43.23 | [LROC RDR](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_MTMOUTONLO1) |
| Nobile Rim 2 (2022, 2024) | NAC_ROI_NOBILE02LO1_P839S0587 | -83.9 | 58.7 | -84.40 to -83.50 | 54.46 to 63.02 | [LROC RDR](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_NOBILE02LO1) |
| de Gerlache Rim (covers Rim 1 and Rim 2) | NAC_ROI_DEGERRIMLO1_P885S2933 | -88.5 | -66.7 (293.3 E) | -89.02 to -87.79 | -83.18 to -41.31 | [LROC RDR](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_DEGERRIMLO1) |
| Faustini Rim A (2022 only) | NAC_ROI_FAUSTINILO1_P878S0900 | -87.8 | 90.0 | -88.19 to -87.54 | 79.51 to 100.49 | [LROC RDR](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_FAUSTINILO1) |
| Peak near Shackleton (2022 only) | NAC_ROI_SHKLTNPKLO1_P888S1247 | -88.8 | 124.7 | -89.17 to -88.44 | 107.53 to 141.84 | [LROC RDR](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_SHKLTNPKLO1) |
| Amundsen Rim (2022 only) | NAC_ROI_AMUNDRIMLO1_P842S0693 | -84.2 | 69.3 | -84.65 to -83.80 | 65.10 to 73.51 | [LROC RDR](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_AMUNDRIMLO1) |
| de Gerlache-Kocher Massif (2022 only) | NAC_ROI_DEGERKCHLO1_P858S24363 | -85.8 | -116.4 (243.6 E) | -86.27 to -85.39 | -122.59 to -110.48 | [LROC RDR](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_DEGERKCHLO1) |

No coordinates of any kind were found for Slater Plain or for the 2024 "Mons Mouton" region as distinct from the plateau.

### Point coordinates from LROC, NASA mission documents and site studies

| Feature or proposed site | Lat | Lon E | What it is | Evidence | Source |
|---|---|---|---|---|---|
| Malapert Massif region "heart" | -86 | 0 | Flat area of the candidate region; summit more than 5,000 m above its base | ESTABLISHED (LROC description) | [LROC 1294](https://lroc.im-ldi.com/images/1294) |
| Mons Mouton (feature) | -84.6 | 31.0 | Flat-topped mountain about 100 km wide, about 6 km high; named 13 May 2022 | **[secondary]** | [WP-MOUTON] |
| VIPER planned landing location (2021 Griffin-era plan) | -85.449452 | 31.064135 | Average slope 5 degrees; chosen for high WEH, varied ice-stability depths, survivable shadow, Earth line of sight | ESTABLISHED for 2021; may be superseded for the 2027 delivery | [VIPER-21] |
| IM-2 intended landing site (LROC) | -84.78 | 29.13 | "Central portion of one of the Artemis 3 potential landing regions"; 160 km from the pole | ESTABLISHED | [LROC 1401](https://lroc.im-ldi.com/images/1401) |
| IM-2 PRIME-1 target (NASA slides) | -84.7754 | 29.1280 | Target on Mons Mouton | ESTABLISHED | [MSOLO26] |
| IM-2 final site | -84.79059 | 29.19567 | On its side in a crater about 20 m wide | ESTABLISHED | [MSOLO26]; [LROC 1408](https://lroc.im-ldi.com/images/1408) |
| Shackleton crater | -89.667 | 129.783 | 21.0 km diameter, 4.2 km deep | **[secondary]** | [WP-SHACK] |
| Connecting Ridge, junction with Shackleton rim | -89.684 | -163.261 (196.739 E) | Ridge about 14 km long; blocks of about 8 m are sampling targets; flat spot with line of sight into the Shackleton PSR | ESTABLISHED (LROC) | [LROC 1247](https://lroc.im-ldi.com/images/1247) |
| Chang'e-7 target (unofficial) | -88.8 | 123.4 | Illuminated rim of Shackleton | **[secondary]** | [WP-CE7] |
| Proposed site, "Connecting Ridge" | -89.53432 | -150.05233 (209.94767 E) | Near rim of the crater holding H2O-ice PSR no. 107 | Proposal (non-NASA abstract) | [GRACY24] |
| Proposed site, "Peak Near Shackleton" | -89.01701 | 126.27302 | Near rim of the crater holding H2O-ice PSR no. 112 | Proposal | [GRACY24] |
| Top-ranked point, Nobile Rim 2 ("DM2") | -84.20156 | 60.69989 | Rank 1 of 1,247 points (TOPSIS) | MODEL (academic ranking) | [PENA24] |
| Best point, Amundsen Rim ("DM1") | -84.19184 | 67.22904 | Rank 10 | MODEL | [PENA24] |
| Point in "Site04" (Shackleton rim near the pole) | -89.95919 | 135.81846 | Rank 13 | MODEL | [PENA24] |
| Best point, Peak Near Shackleton ("Site07") | -89.00506 | 125.30930 | Rank 15 | MODEL | [PENA24] |
| Best point, Faustini Rim A ("LM7") | -88.08695 | 98.35549 | Rank 16 | MODEL | [PENA24] |
| Best point, de Gerlache Rim 2 ("SL2") | -88.51566 | -61.16732 | Rank 19 | MODEL | [PENA24] |
| Unnamed crater inside Faustini Rim A | -88.0573 | 89.1596 | 2023 workshop abstract | **[excerpt]** | [USRA 2042](https://www.hou.usra.edu/meetings/Artemis_III_2023/pdf/2042.pdf) |

Wueller et al. 2026 list 130 candidate landing sites inside the Artemis regions that meet HLS requirements and reach PSRs within 2 km, with coordinates in their Table A1; the table could not be retrieved (HTTP 403), but the data are archived on Zenodo ([Wueller 2026](https://doi.org/10.1029/2025JE009434); [Zenodo 17084058](https://zenodo.org/records/17084058)).

### Robotic precursors: three soft landings poleward of 69 S, none poleward of 85 S

| Mission | Date | Site | Lat | Lon E | Outcome | Status | Source |
|---|---|---|---|---|---|---|---|
| Chandrayaan-1 Moon Impact Probe | 14 Nov 2008 | Near Shackleton rim | n/a | n/a | Deliberate impact; water detected during descent | FLOWN | [WP-LSP] **[secondary]** |
| LCROSS | 9 Oct 2009 | Cabeus | -84.6796 | -48.7093 | Impact; ejecta water 5.6 +/- 2.9 wt% | FLOWN | [Marshall et al.](https://ar5iv.labs.arxiv.org/html/1103.1687); [COLAPRETE10] |
| Luna-25 | 19 Aug 2023 | Crashed on SW rim of Pontecoulant G | -57.865 | 61.360 | Lost after an orbit-lowering burn; intended -69.545, 43.544 | FLOWN, failure | [SpacePolicyOnline, 2023](https://spacepolicyonline.com/news/nasas-lro-spots-likely-luna-25-crash-site) |
| Chandrayaan-3 | 23 Aug 2023, 12:33 UTC | Statio Shiv Shakti | -69.373 (ISRO -69.367621) | 32.319 (ISRO 32.348126) | Success; one lunar day | FLOWN | [WP-CH3] **[secondary]**; [Moon Monday 136](https://jatan.space/moon-monday-issue-136.md) |
| IM-1 Odysseus | 22 Feb 2024, 23:23:53 UTC | Near Malapert A, 2,579 m elevation | -80.13 | 1.44 | Landed about 1.5 km off target on a 12-degree slope, tipped about 30 degrees | FLOWN, partial | [LROC 1360](https://lroc.im-ldi.com/images/1360); [Moon Monday 165](https://jatan.space/moon-monday-issue-165/) |
| IM-2 Athena | 6 Mar 2025, about 17:28 UTC | Mons Mouton | -84.7906 | 29.1957 | On its side in a shadowed crater at about -173 C; about 100 W; ended under 13 hours after landing | FLOWN, failure | [LROC 1408](https://lroc.im-ldi.com/images/1408); [NASA, 7 Mar 2025](https://www.nasa.gov/news-release/nasa-receives-some-data-before-intuitive-machines-ends-lunar-mission/); [WP-IM2] **[secondary]** |
| Lunar Trailblazer | Launched 26 Feb 2025 | orbiter | n/a | n/a | Contact lost one day after launch; ended 31 Jul 2025; no water maps | FLOWN, lost | [JPL](https://www.jpl.nasa.gov/news/nasas-lunar-trailblazer-moon-mission-ends/) |
| Danuri with NASA ShadowCam | In orbit since Dec 2022 | orbiter | n/a | n/a | Extended to end of 2027; orbit lowered to 60 km for seven months | FLOWN, active | [Korea Herald](https://www.koreaherald.com/article/10416318); [ShadowCam news](https://shadowcam.im-ldi.com/news/1472) |

| Planned mission | Target | Coordinates | Latest date found | Notes | Source |
|---|---|---|---|---|---|
| Moon Base I, Blue Moon MK1 "Endurance" | Shackleton Connecting Ridge | not published | NET Q1 2027 per listings; another source says no earlier than second half of 2027 (was NET fall 2026, SUPERSEDED) | SCALPSS plume cameras and LRA retroreflectors; precision landing within 100 m | [WP-BMP] **[secondary]**; [NASA, 4 Aug 2026](https://nasa.gov/missions/moon-base/nasa-provides-updates-on-moon-base-cargo-landers-tech-demonstrations); [MM277] |
| Moon Base II, Griffin Mission One | Nobile crater region | not published | Listing moved from 31 Dec 2026 to 31 Jan 2027 | Astrolab FLIP rover; METAL helium-3 payload | [Lunar Week tracker](https://spacenexus.us/moon/weekly/week-of-2026-11-02) **[secondary]**; [MB-PHASES] |
| VIPER (CS-7, second MK1) | Mons Mouton, west of Nobile | 2027 site not confirmed | Late 2027; a newsletter judges second half of 2028 more likely | 100-day mission; contingent on the first MK1 landing | [MB-PHASES]; [MM277] |
| IM-4 | Mons Mouton plateau | not published | 2027 | ESA PROSPECT; two relay satellites | [WP-CLPS] **[secondary]** |
| Blue Ghost Mission 4 | South Pole | not published | 2029 | Canadian rover | [WP-CLPS] **[secondary]** |
| IM-5 | Mons Malapert | not published | 2030 | Awarded Mar 2026; chosen for continuous Earth visibility per trade press | [WP-CLPS] **[secondary]**; [Military Aerospace](https://www.militaryaerospace.com/commercial-aerospace/article/55366507/nasa-awards-1804-million-clps-contract-to-intuitive-machines-for-lunar-south-pole-payload-delivery) |
| Chang'e-7 | Illuminated Shackleton rim | -88.8, 123.4 (unofficial) | 2027 at the earliest; the Aug 2026 window was missed | Landing accuracy better than 100 m; launch tied to lighting at Shackleton | [SpaceNews, Aug 2026](https://spacenews.com/china-delays-change-7-lunar-south-pole-landing-mission-launch/); [Scientific American, 24 Aug 2026](https://www.scientificamerican.com/article/china-delays-ambitious-change-7-moon-mission-until-2027/) |
| Chang'e-8 | Leibnitz Beta plateau (Mons Mouton) | not published | Around 2029 | ISRU demonstration | [WP-CE8] **[secondary]** |

Both US polar landers tipped over after altimetry failures, not after proven terrain or lighting effects. IM-1's laser rangefinders were disabled by a safety switch left on before launch ([Payload, Feb 2024](https://payloadspace.com/im-1-is-sideways-but-weve-all-been-there/)). IM-2's rangefinder returned noise, and the lander touched down at 10-13 m/s while its software believed it was about 400 m up ([Aerospace America, 22 Jul 2025](https://aerospaceamerica.aiaa.org/how-intuitive-machines-is-planning-to-make-its-third-moon-landing-a-successful-one/)). The polar geometry then set the outcome, because a lander on its side in a 20 m crater at a horizon Sun cannot recharge. Chang'e-7 shows the calendar cost: missing a lighting-tied August window pushed the mission a year ([SpaceNews, Aug 2026](https://spacenews.com/china-delays-change-7-lunar-south-pole-landing-mission-launch/)).

### Sortie sites and base sites answer different questions

| Aspect | First sortie (was Artemis III, now Artemis IV) | Long-term base (Moon Base) | Source |
|---|---|---|---|
| Priority | "Identifying safe places for this first landing", then science | Sustained presence | [REL24]; [CBS News, 24 Mar 2026](https://www.cbsnews.com/news/nasa-moon-base-plan-lunar-south-pole/) |
| Site set | Nine regions, specific to Artemis III's crew-safety emphasis | Identified by Phase 1 robotics; multiple locations | [LPSC26]; [MB-PAGE] |
| Duration and range | 6.5 days (2022), 5.75-6.25 days (2026 abstract), on foot within 2 km; Oct 2026: two EVAs of about two hours | Crew rotations; 30-day pressurised-rover excursions; LTVs up to 400 km total | [REL22]; [LPSC26]; [NASA-Oct26]; [ASTRO-Jun26] |
| Lighting need | Sunlight for the entire crewed stay | Must survive lunar night: RHU, then solar plus RTG, then fission | [LPSC26]; [MB-PDF] |
| Communications | Direct-to-Earth visibility preferred | Relay satellites plus towers of about 10 km radius | [LPSC26]; [ASTRO-Jun26] |
| Named locations | The nine regions | Shackleton Connecting Ridge (Moon Base I target) | [REL24]; [MB-PHASES] |

Non-NASA comparisons point the same way but rest on weak sources: Connecting Ridge at about 89.4 S with over 80 % annual illumination at favoured sub-sites and slopes up to about 20 degrees on rim approaches, against Malapert and Mons Mouton at about 86 S with better Earth visibility and poorer PSR access ([moonresource.com](https://moonresource.com/research/artemis-iii-candidate-sites)) **[secondary, low reliability]**.

### Published rankings disagree because their criteria differ

| Study | Method and thresholds | Result | Evidence | Source |
|---|---|---|---|---|
| NASA Cross Agency Site Selection Analysis | Constraint-based, no published score | 13 to 9 regions, unranked | ESTABLISHED | [LPSC26] |
| NASA "accessible terrain" definition as used by Gracy and Lee | Slope below 5 degrees, sunlit, DTE visible; two crew on foot within 2 km; screening: 2 km-radius zone (12.57 km2) with slope at or below 5 degrees over at least 25 %, illumination at least 33 %, DTE at least 50 % | South Pole-Aitken material: Connecting Ridge 46 % (rank 3 of 13), Peak Near Shackleton 47 % (rank 2) | Proposal | [GRACY24] |
| Pena-Asensio et al. 2024 (TOPSIS, cross-checked with MABAC, CoCoSo, VIKOR) | 1,247 points in 13 regions plus Site 004, pre-filtered to slope 0-5 degrees with a 100 m buffer (732 polygons of 25 to 25,000 m2); criteria: visible area from 40 m height, lander line of sight within 2 km, illumination x PSR share within 2 km, Earth communication, geologic units, mafic abundance; equal weights | Best point in Nobile Rim 2 (-84.20156, 60.69989), Ri = 0.6916; top-100 share: Nobile Rim 2 36 %, Malapert Massif 30 %, Amundsen Rim 13 %; none in Connecting Ridge Extension, Leibnitz Beta Plateau or Haworth | MODEL; sensitive to the slope pre-filter | [PENA24] |
| Points per region in that study | Nobile Rim 2 473; Amundsen Rim 149; de Gerlache Rim 2 104; Malapert Massif 102; Nobile Rim 1 94; Faustini Rim A 80; de Gerlache-Kocher 56; Site04 56; Connecting Ridge Extension 36; Leibnitz Beta Plateau 23; Haworth 20; Connecting Ridge 20; Peak Near Shackleton 19; de Gerlache Rim 1 15 | Counts of surviving low-slope points | MODEL | [PENA24] |
| Wueller et al. 2026 | "Favourable" = sunlit at least 10 consecutive days at midsummer, 2025-2032 | 130 sites; Haworth sites HW04 and HW10 exceed 25 days of simultaneous Sun and Earth visibility; largest suitable area fraction: Slater Plain, then Nobile Rim 2, Faustini Rim A | MODEL **[excerpt]** | [Wueller 2026](https://doi.org/10.1029/2025JE009434) |
| Wueller et al. 2025 | Region-averaged scores | Mons Mouton plateau: Sun visibility 0.45 +/- 0.14, Earth visibility 74 +/- 19 %, coldest PSR 85 K; Malapert region: Sun 0.31 +/- 0.25, Earth 0.41 +/- 0.32 | MODEL **[excerpt]** | [Wueller 2025](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2025JE009127) |
| Lemelin et al. 2014 | Six equally weighted volatile criteria | South-polar sites meeting all six: Shoemaker and Faustini; relaxing one adds Haworth, de Gerlache, Cabeus | MODEL **[secondary summary]** | [catalogue record](https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_proquest_miscellaneous_1642215543) |
| Lemelin, LEAG 2016 | H above 150 ppm; mean annual T below 110 K; slope below 10 degrees; PSR within 1 km of lit terrain | Cabeus, Shoemaker/Nobile | MODEL **[excerpt]** | [LEAG presentation](https://lunarvolatiles.nasa.gov/wp-content/uploads/sites/46/2018/12/Regions-of-Interest-LEAG_Lemelin.pdf) |
| Flahaut et al. 2020 | H above 100 ppm; surface ice stable; slope, illumination, Earth visibility | 11 regions of interest near Cabeus, Amundsen, Ibn Bajja, Wiechert J, Idel'son; "very stringent constraints" above 80 degrees | MODEL | [VU Amsterdam record](https://research.vu.nl/en/publications/regions-of-interest-roi-for-future-exploration-missions-to-the-lu/) |
| Brown et al. 2022 | Ten datasets from eight instruments; surface-activity criterion slope below 10 degrees, more than 45 % sunlight, Earth line of sight | Most resource-rich PSRs: Faustini, Cabeus, de Gerlache, Shoemaker, Haworth, Sverdrup, Slater, Amundsen | MODEL | [ASU record](https://asu.elsevierpure.com/en/publications/resource-potential-of-lunar-permanently-shadowed-regions/); [LROC1255] |

None of these rankings includes seismic hazard, contamination persistence or SPA-rim sampling value, and four of the nine 2024 regions (Peak near Cabeus B, Mons Mouton, Mons Mouton Plateau, Slater Plain) have no published multi-criteria score.

## Ridge sites are lit 76-88 % of the time, and winter darkness is the binding number

### Geometry: a Sun that never climbs above 7 degrees

| Quantity | Value | Evidence | Source |
|---|---|---|---|
| Lunar obliquity to the ecliptic | 1.54 deg | ESTABLISHED | [GLAESER18]; [WP-POLE] |
| Maximum Sun elevation at the pole (disc centre) | 1.54 deg | ESTABLISHED | [GLAESER18] |
| Subsolar latitude extremes over 1,000 years of Horizons ephemerides | +/-1.59 deg | ESTABLISHED | [BUSSEY10] |
| Sun as seen from Shackleton rim | Never more than 1.5 deg above or below the horizon; circles 360 deg | ESTABLISHED | [NASA SVS 4944](https://svs.gsfc.nasa.gov/4944/) |
| Highest Sun elevation in the Artemis landing regions | 7 deg | ESTABLISHED | [NASA NESC](https://www.nasa.gov/centers-and-facilities/nesc/characterizing-the-visual-experience-of-astronauts-at-the-lunar-south-pole/) |
| Sun and Earth elevation range at south-polar sites | About 2 to 7 deg | RULE | [HLS-OV]; [PLATTE23] |
| Sun elevation in the 85-90 S region | Never above about 6 deg | RULE | [IAC22] |
| Sun elevation at two candidate sites for a 12/2024 mission | LS1 below 2.1 deg; LS2 below 1.75 deg | MODEL (authors' calculation) | [FZ20] |
| Lunar synodic day | About 29.5 Earth days | ESTABLISHED | [GLAESER18] |
| Nodal cycle used for long-run averages | 18.6 years | ESTABLISHED | [PGDA69] |
| Distance of terrain that can shadow a polar site | Mountains up to 120 km away | ESTABLISHED | [OCHMO] |
| Horizon structure at a ridge site | Near field about 100 m away (tens of m to 1 km); far field 50-200 km away | ESTABLISHED | [BARKER21] |
| Shadow length at 1.5-2 deg Sun elevation | About 27 x object height | ESTABLISHED | [OCHMO] |
| Maximum geometric Sun elevation on a smooth sphere | About (90 - latitude) + 1.54 deg: 3.5 deg at 88 S, 5.5 deg at 86 S, 7.5 deg at 84 S | **[derived]** | consistent with [HLS-OV] |

No south-polar location is continuously sunlit, lighting differs between adjacent touchdown sites within one sortie, and a few metres of hardware height add sunlight ([WP-SITE]; [IAC22]). The most-lit points are local topographic maxima, in strips several kilometres long but only 20-40 m wide at surface level ([BUSSEY10]; [GLAESER18]).

### The best-lit points, by study

Percentages differ by 10-25 points with DEM resolution and metric. "Average illumination" is the time-average of the visible solar-disc fraction; "solar visibility" is the fraction of time any part of the Sun is visible. Coarse DEMs (240-474 m) overestimate because they smooth near-field relief, and 100 m imagery underestimates because lit strips are unresolved ([GLAESER18]).

Cross-study comparison at surface level, as tabulated in Glaeser et al. 2018, Table 1 ([GLAESER18]):

| Site | Study (data, resolution, period) | Lat | Lon E | Max avg illumination % | Solar visibility % | Max time in shadow (h) |
|---|---|---|---|---|---|---|
| Connecting Ridge C1 | Glaeser 2018 (LOLA 20 m, 2017-2037, 1 h) | -89.4505 | 222.84 | 76.0 | 81.3 | 268 |
| Connecting Ridge C1 | Mazarico 2011 (LOLA 240 m, 18.6 yr) | -89.45 | 222.69 | 89.0 | 92.7 | 141.12 |
| Connecting Ridge C1 | Speyerer and Robinson 2013 (WAC 100 m, 1 yr) | -89.418 | 221.3 | 64.2 | n/a | 308 |
| Connecting Ridge C2 | Glaeser 2018 | -89.3157 | 245.94 | 75.6 | 80.6 | 166 |
| Shackleton rim S | Glaeser 2018 | -89.7849 | 203.97 | 81.0 | 85.5 | 221 |
| Shackleton rim S | Mazarico 2011 | -89.78 | 204.27 | 86.7 | 90.5 | n/a |
| Shackleton rim S | Speyerer and Robinson 2013 | -89.740 | 201.2 | 71.6 | n/a | 145 |

Same sites at 2 m above ground, 20-year average, Glaeser et al. 2018, Table 2 ([GLAESER18]):

| Site | Lat | Lon E | Max avg illumination % | Solar visibility % | Max time in shadow (h) |
|---|---|---|---|---|---|
| Connecting Ridge C1 | -89.4398 | 222.83 | 88.0 | 92.1 | 112 |
| Connecting Ridge C2 | -89.3130 | 245.98 | 78.1 | 82.0 | 165 |
| Shackleton rim S (max illumination) | -89.6866 | 197.19 | 85.5 | 89.4 | 66 |
| Shackleton rim S (max visibility) | -89.7815 | 204.70 | 82.1 | 89.8 | 65 |

High-illumination clusters (at least 70 % at 2 m) and their nearest PSR, Glaeser et al. 2018, Table 3 ([GLAESER18]):

| Cluster | Max avg illum % | Max solar vis % | Cluster area (m2) | Nearest PSR area (m2) | Distance to PSR (m) | Max slope in PSR (deg) |
|---|---|---|---|---|---|---|
| Connecting Ridge C1-0 | 88.0 | 92.1 | 135,200 | 5,200 | 100 | 12.8 |
| Connecting Ridge C1-1 | 81.3 | 86.0 | 26,800 | 9,600 | 70 | 13.7 |
| Connecting Ridge C2-0 | 71.6 | 75.1 | 4,400 | 5,600 | 60 | 11.5 |
| Connecting Ridge C2-1 | 78.1 | 82.0 | 11,600 | 22,800 | 80 | 17.1 |
| Shackleton S0 | 85.5 | 89.4 | 21,600 | 58,400 | 370 | 17.0 |
| Shackleton S1 | 84.3 | 89.8 | 120,400 | 4,400 | 30 | 11.1 |
| Shackleton S2 | 73.9 | 78.8 | 31,200 | 1,200 | 80 | 6.0 |

Bussey et al. 2010 (Kaguya 474 m DEM, year 2020, 12-hour steps) ([BUSSEY10]). The source prints Point D's latitude inconsistently (88.79 S in its table, 88.74 S in its conclusions).

| Point | Description | Lat | Lon E | 2020 mean % | Longest continuous sunlight | Longest eclipse |
|---|---|---|---|---|---|---|
| A | Shackleton rim | -89.68 | 194.0 (166.0 W) | 81 | With B more than 8 continuous months | A and B together lit about 94 % of the year; less than 10 km apart |
| B | Connecting Ridge | -89.44 | 218.2 (141.8 W) | 82 | More than 4.5 continuous months | Only 12-24 h eclipses in the 8 months centred on midsummer |
| C | de Gerlache rim | -88.71 | 291.3 (68.7 W) | 85 | n/a | About 6 days, the shortest maximum of all points |
| D | Ridge along about 120 E from Shackleton | -88.79 | 124.5 | 86 | More than 5 continuous months centred on midsummer | About 11.5 days at midwinter |
| M1 | Malapert Mountain | -86.04 | 2.7 | 74 | n/a | n/a |
| M2 | Malapert Mountain | -86.00 | 357.1 (2.9 W) | 74 | n/a | n/a |

Barker et al. 2021, Table 2: Site 1 (Connecting Ridge) regions of interest, defined as connected pixels above 70 % average illumination at 1 m with area above 2,500 m2. X and Y are south-polar stereographic kilometres. Values are conservative 1st/99th percentiles over 100 DEM clones, case A (RoI average), for 1 Jan 2024 to 1 Jan 2026. LCIP is the longest continuous illumination period, LCSP the longest continuous shadow period ([BARKER21]). One researcher could not recover these per-RoI rows from the PDF text and a second transcribed them, so check them against the PGDA shapefiles before use.

| RoI | X (km) | Y (km) | Area (m2) | Avg illum. 1 m (%) | LCIP 1 m (d) | LCSP 1 m (d) | Avg illum. 5 m (%) | LCIP 5 m (d) | LCSP 5 m (d) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 11.5825 | 12.4625 | 8625 | 68.03 | 63.35 | 16.55 | 89.26 | 215.79 | 5.29 |
| 2 | 11.4875 | 12.5575 | 7550 | 70.32 | 113.80 | 17.84 | 88.51 | 216.28 | 7.31 |
| 3 | 11.3525 | 12.5025 | 3825 | 67.51 | 117.86 | 22.23 | 84.53 | 216.89 | 8.41 |
| 4 | 11.2875 | 12.1675 | 13300 | 69.61 | 136.49 | 13.27 | 88.12 | 231.20 | 4.00 |
| 5 | 11.1025 | 11.9425 | 10075 | 70.38 | 142.17 | 15.24 | 85.71 | 218.98 | 4.52 |
| 6 | 10.8025 | 11.7375 | 10000 | 71.15 | 81.01 | 12.74 | 87.35 | 220.98 | 4.16 |
| 7 | 10.2275 | 11.5525 | 7075 | 67.36 | 100.23 | 14.54 | 82.79 | 119.07 | 5.42 |

With roving inside one RoI, 1 m illumination rises to 77-87 % and the worst shadow falls to 4-16 days ([BARKER21]). Site 1 has the most area above 70 % at 1 m, and at 5 m its RoIs 1-6 exceed 200 days of continuous light against about 150-175 days at the other three sites ([BARKER21]; [PGDA78]).

| Other study | Data and method | South-pole result | Evidence | Source |
|---|---|---|---|---|
| Noda et al. 2008 | Kaguya laser altimeter | No constantly lit place; some areas lit more than 80 % | ESTABLISHED, via Bussey | [BUSSEY10] |
| Mazarico et al. 2011 | LOLA 240 m, horizon method | A site near Shackleton rim sunlit continuously about 240 days; longest total darkness about 1.5 days; about 10 m of height gives large gains | MODEL (abstract) | [MAZ11] |
| Glaeser et al. 2014 | LOLA 20 m, 19-year study | Connecting Ridge spots sunlit 92.27 % of the time at 2 m and 95.65 % at 10 m; longest darkness typically 3-5 days | MODEL (abstract) | [DLR elib](https://elib.dlr.de/94240) |
| Speyerer and Robinson 2013 | LROC WAC, 3,807 images, 15 Feb 2010 to 5 Feb 2011 | Station sets on Shackleton rim reach about 94 % of the year, longest joint eclipse 43 h | **[secondary]** (Wikipedia summary) | [WP-PEL] |
| Speyerer et al. 2016 | Rover traverse optimisation | A mobile rover stays lit 94.4 % of the year; longest eclipse 101 h | MODEL, via Glaeser | [GLAESER18] |
| Glaeser et al. 2018 | LOLA 20 m, 2017-2037, hourly | Six best sites (three per pole): 69.5-82.9 % at surface, 77.1-88.0 % at 2 m; max shadow under three to eight days | MODEL | [GLAESER18] |
| De Rosa et al. 2012 (ESA Lunar Lander) | LOLA 40 m, 3 m height, 100-h night survivability | Quasi-continuous illumination of several months on Connecting Ridge, Leibnitz-beta plateau, Shackleton and de Gerlache rims, Malapert peaks; areas only a few hundred metres across | MODEL | [DEROSA12] |
| JPL Goldstone radar DEM study | Multi-year average | Best site: solar power availability 92 %, DTE availability 51 % | MODEL | [JPL IPN PR 42-176](https://ipnpr.jpl.nasa.gov/progress_report/42-176/176C.html) |
| Malapert | Kaguya total 74 %; a 2023 site study rates a solar-panel site at 50-82 % **[excerpt]** | — | MODEL | [BUSSEY10]; [iScience 2023](https://www.cell.com/iscience/fulltext/S2589-0042(23)01930-2) |

PGDA site numbers follow the Mazarico 2011 illumination ranking, which implies **[derived]**: Connecting Ridge 1st, Shackleton rim 4th, Nobile rim 1 6th, Peak near Shackleton 7th, de Gerlache rim 11th, Leibnitz beta plateau 20th, Malapert massif 23rd, de Gerlache-Kocher massif 42nd ([PGDA78]).

### Height: the first two to five metres do most of the work

| Site | Height | Avg illumination % | Max darkness | Period and DEM | Source |
|---|---|---|---|---|---|
| Connecting Ridge C1 | 0 m | 76.0 | 268 h | 2017-2037, 20 m | [GLAESER18] |
| Connecting Ridge C1 | 2 m | 88.0 | 112 h | same | [GLAESER18] |
| Shackleton rim S | 0 m | 81.0 | 221 h | same | [GLAESER18] |
| Shackleton rim S | 2 m | 85.5 | 66 h | same | [GLAESER18] |
| Connecting Ridge C2 | 0 m / 2 m | 75.6 / 78.1 | 166 h / 165 h (no gain) | same | [GLAESER18] |
| Connecting Ridge RoIs | 1 m | 67-71 (1st percentile) | 13-22 d (99th percentile) | 2024-2026, 5 m | [BARKER21] |
| Connecting Ridge RoIs | 5 m | 83-89 (1st percentile) | 4-8 d (99th percentile) | 2024-2026, 5 m | [BARKER21] |

At 2 m the lit strips widen from 20-40 m to several hundred metres, and the best 2 m point is not the best surface point ([GLAESER18]). Height does nothing where the limiting horizon is a far-field massif, as C2's unchanged 165 hours shows **[derived reading]**. No primary figures for 100 m masts were found; an engineering study of kilometre-scale regolith-concrete towers gives no illumination-versus-height values ([arXiv:2103.00612](https://arxiv.org/abs/2103.00612)).

### Seasons: months of light in summer, 44-64 % lit days in winter

Percent of each lunar day illuminated from midsummer (day 1) to midwinter (day 7), year 2020, Bussey et al. 2010, Table 2 ([BUSSEY10]):

| Lunar day | A Shackleton rim | B Connecting Ridge | C de Gerlache rim | D ridge at 124.5 E | M1 Malapert | M2 Malapert |
|---|---|---|---|---|---|---|
| 1 (midsummer) | 98 | 100 | 98 | 100 | 95 | 90 |
| 2 | 97 | 100 | 98 | 100 | 92 | 83 |
| 3 | 97 | 95 | 97 | 100 | 88 | 83 |
| 4 | 92 | 90 | 86 | 93 | 69 | 75 |
| 5 | 73 | 64 | 71 | 80 | 64 | 66 |
| 6 | 51 | 56 | 66 | 63 | 54 | 58 |
| 7 (midwinter) | 44 | 56 | 64 | 58 | 54 | 58 |
| 2020 mean | 81 | 82 | 85 | 86 | 74 | 74 |

| NASA statement on seasons | Evidence | Source |
|---|---|---|
| Illumination shows strong seasonal variability and shifts about 2-3 weeks per year | ESTABLISHED (NASA site-selection team) | [LPSC26] |
| Peak lighting shifts 2-3 weeks earlier each year; around August by 2030 | RULE (2023 slide, decoded from an obfuscated PDF text layer) | [PLATTE23]; [HLS-OV] |
| The Moon has roughly 11 seasonal cycles per 10 Earth years | RULE | [WP-SITE] |
| South-polar summer was roughly October to March in 2022 | RULE | [IAC22] |
| 2024 begins in mid south-pole summer; winter falls mid-year | ESTABLISHED (visualisation) | [NASA SVS 4770](https://svs.gsfc.nasa.gov/4770) |
| A gentle-slope site can be dark for periods from brief to weeks or months, depending on launch date | RULE | [WP-SITE] |
| The area colder than 110 K grows 2.8-fold in southern winter | ESTABLISHED | [WILLIAMS19] |
| Midsummer illumination rasters for every Artemis region, 2025-2032, are public (`Illumination_Modeling.zip`) | ESTABLISHED (dataset) | [Zenodo 17084058](https://zenodo.org/records/17084058) |

### Solstice dates 2024-2040 are researcher-derived, not NASA-published

No NASA or peer-reviewed source lists dated south-polar solstices. The table below was **[derived]** by one researcher from mean lunar-node and solar-longitude formulae (subsolar latitude most negative when the Sun's ecliptic longitude minus the mean ascending node equals 270 degrees), with stated accuracy of about 1-2 days. A second researcher's independent derivation gives dates within two days (for example 16 Nov 2026, 29 Oct 2027, 10 Oct 2028 for midsummer; 9 May 2027 and 19 Apr 2028 for midwinter) with a stated uncertainty of about 5 days. Both rest on textbook constants not sourced in the research (synodic month 29.5306 d, draconic year 346.62 d). **Verify with SPICE sub-solar latitude before use.** The physical check is NASA's own statement: 365.25 - 346.62 = 18.6 days per year earlier, matching "2-3 weeks earlier each year" ([LPSC26]).

| South-summer solstice (best lighting) | Following equinox | South-winter solstice (worst lighting) | Following equinox |
|---|---|---|---|
| 2024-12-23 | 2025-03-18 | 2025-06-13 | 2025-09-10 |
| 2025-12-05 | 2026-02-27 | 2026-05-25 | 2026-08-23 |
| 2026-11-17 | 2027-02-09 | 2027-05-07 | 2027-08-04 |
| 2027-10-30 | 2028-01-23 | 2028-04-17 | 2028-07-15 |
| 2028-10-11 | 2029-01-04 | 2029-03-30 | 2029-06-26 |
| 2029-09-23 | 2029-12-17 | 2030-03-11 | 2030-06-07 |
| 2030-09-04 | 2030-11-29 | 2031-02-21 | 2031-05-19 |
| 2031-08-16 | 2031-11-11 | 2032-02-03 | 2032-04-29 |
| 2032-07-27 | 2032-10-23 | 2033-01-16 | 2033-04-11 |
| 2033-07-08 | 2033-10-05 | 2033-12-29 | 2034-03-23 |
| 2034-06-19 | 2034-09-16 | 2034-12-11 | 2035-03-05 |
| 2035-05-31 | 2035-08-29 | 2035-11-23 | 2036-02-15 |
| 2036-05-12 | 2036-08-09 | 2036-11-04 | 2037-01-27 |
| 2037-04-23 | 2037-07-21 | 2037-10-17 | 2038-01-10 |
| 2038-04-05 | 2038-07-02 | 2038-09-29 | 2038-12-23 |
| 2039-03-17 | 2039-06-13 | 2039-09-10 | 2039-12-05 |
| 2040-02-27 | 2040-05-24 | 2040-08-21 | 2040-11-16 |

The dates reproduce documented mission choices: VIPER's November 2024 landing for a 100-day mission, Chang'e-7's August 2026 launch for a late-2026 landing, and the "12/2024 mission" of Fassett and Zanetti ([VIPER-SB]; [SpaceNews, Aug 2026](https://spacenews.com/china-delays-change-7-lunar-south-pole-landing-mission-launch/); [FZ20]). One tension remains: NASA's slide says "around August" by 2030, while the derived solstice is 4 Sep 2030. For a 2028 landing the derived favourable season is roughly August to December 2028; an early-2028 landing would fall near the January 2028 equinox heading into winter. That is a derived observation, not a NASA statement.

### Thermal environment: 37 K in Cabeus, about 100 K in a 20 m shadowed crater

| Quantity | Value | Evidence | Source |
|---|---|---|---|
| Annual average temperature, PSR part of Cabeus (LCROSS site) | 37 K | ESTABLISHED (Diviner) | [UCLA/Diviner release](https://www.eurekalert.org/news-releases/648084) |
| Estimated subsurface temperature at the LCROSS site | 38 K | MODEL | [Paige et al. 2010 abstract](https://researchconnect.stonybrook.edu/en/publications/diviner-lunar-radiometer-observations-of-cold-traps-in-the-moons-/) |
| South-pole winter minimum map, 13 Artemis regions, colour scale | 90 K down to 18 K | ESTABLISHED (NASA map) | [NESC webinar](https://ntrs.nasa.gov/api/citations/20230017131/downloads/The%20Visual%20Experience%20at%20the%20Lunar%20South%20Pole.pdf) |
| Polar-region averages | About 200 K maximum, about 50 K minimum | **[excerpt]** | [Williams et al. 2017](https://www.sciencedirect.com/science/article/pii/S0019103516304869) |
| Water cold-trap threshold | Maximum temperature below about 110 K; surfaces above 125 K cannot keep frost | ESTABLISHED | [Fisher et al. 2017](https://ntrs.nasa.gov/api/citations/20170003782/downloads/20170003782.pdf); [WILLIAMS19] |
| Haworth coldest areas | Never exceed about 40 K | ESTABLISHED | [EPSC2013-864](https://meetingorganizer.copernicus.org/EPSC2013/EPSC2013-864.pdf) |
| Shackleton floor | About 88-90 K; lit near-rim sites about -50 +/- 10 C | **[secondary]** | [WP-SHACK] |
| Coldest PSR on the Mons Mouton plateau | 85 K | **[excerpt]** | [Wueller 2025](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2025JE009127) |
| Shadowed 20 m crater where IM-2 came to rest | About -173 C, about 100 K | **[secondary]** | [WP-IM2] |
| Slope sensitivity at 69.37 S (Chandrayaan-3 ChaSTE) | 355 K on a 6-degree Sun-facing slope against about 332 K on flat ground a metre away | ESTABLISHED (in situ) | [WP-CH3] **[secondary]** |
| Mid-latitude eclipse swing (Blue Ghost, 14 Mar 2025) | About +40 C to -170 C over roughly 5 hours on batteries | **[secondary]** press | [Astronomy.com](https://www.astronomy.com/space-exploration/fireflys-blue-ghost-lander-nails-lunar-mission/) |
| Maximum time in shadow at the best sites | 20-50 % of a normal lunar night | MODEL | [GLAESER18] |

### Low Sun changes what crews and sensors can see

| EVA or site | Sun elevation | Source |
|---|---|---|
| Apollo 12 EVA-1 (lowest of Apollo) | 7.5-9.5 deg | [FZ20] |
| Apollo 14 EVA-1 | 13.0-15.5 deg | [FZ20] |
| Apollo 11 EVA-1 | 14.0-15.4 deg | [FZ20] |
| Apollo 15 EVA-1 / EVA-3 | 19.6-22.9 / 41.7-44.2 deg | [FZ20] |
| Apollo 16 EVA-1 / EVA-3 | 22.1-25.7 / 45.8-48.7 deg | [FZ20] |
| Apollo 17 EVA-1 / EVA-3 | 15.3-19.0 / 39.0-42.6 deg | [FZ20] |
| Artemis candidate LS1 / LS2 (12/2024) | below 2.1 / below 1.75 deg | [FZ20] |

NASA's Engineering and Safety Center found that crews cannot avoid the Sun in their eyes and that no requirement guaranteed functional vision between sunlight and shadow ([NASA NESC](https://www.nasa.gov/centers-and-facilities/nesc/characterizing-the-visual-experience-of-astronauts-at-the-lunar-south-pole/)). NASA-STD-3001 requirements cited for Artemis lighting include V2 8051 (illumination levels), V2 8058 (glare) and V2 8104 (shadow contrast within two orders of magnitude of maximum surface luminance), with test meters covering up to 130,000 lux ([OCHMO]). Apollo 12's crew judged a 10-degree slope to be 40 degrees at low Sun, and the Apollo 12 colour camera burned out when pointed at a 7.5-degree Sun ([FZ20]). Deep shadows hide large obstacles, so a site's value depends on how much of its 100 m landing circle is shadowed at the landing epoch, not only on the target pixel.

## Earth is up two weeks in four, and only Earth-facing summits escape the cycle

| Location or rule | Earth visibility | Evidence | Source |
|---|---|---|---|
| South-pole landing regions | "Earth is in a 4-week cycle, visible two weeks, not visible two weeks" | RULE | [PLATTE23]; [HLS-OV] |
| With DTE only | Libration limits site availability to 2-3 weeks per lunar month; areas nearest the pole are most constrained | RULE | [IAC22] |
| Malapert summit region, around -85.95, longitude +/-5 | 100 % with slopes below 15 degrees in places | MODEL (LOLA map viewed in QuickMap) | [Petro and Moriarty 2021](https://www.hou.usra.edu/meetings/lunarsurface12/pdf/8015.pdf) |
| Peaks of "Malapert alpha" and "Leibnitz beta" | 100 % | MODEL **[excerpt]** | [JPL IPN PR 42-176](https://ipnpr.jpl.nasa.gov/progress_report/42-176/176C.pdf) |
| Mons Mouton plateau, region average | 74 +/- 19 % of the lunar year | MODEL **[excerpt]** | [Wueller 2025](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2025JE009127) |
| Malapert candidate region, region average | 0.41 +/- 0.32 | MODEL **[excerpt]** | [Wueller 2025](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2025JE009127) |
| de Gerlache and Shackleton | Under 60 % | MODEL **[excerpt]** | [iScience 2023](https://www.cell.com/iscience/fulltext/S2589-0042(23)01930-2) |
| Best site in the JPL radar-DEM study | 92 % solar against only 51 % DTE | MODEL | [JPL IPN PR 42-176](https://ipnpr.jpl.nasa.gov/progress_report/42-176/176C.html) |
| ESA Lunar Lander candidate sites | DTE windows follow a regular 14-day pattern | MODEL | [DEROSA12] |
| Within 4 degrees of the pole | 10,520 km2 never see Earth; 2,653 km2 hidden from both Sun and Earth | MODEL (Kaguya 474 m) | [BUSSEY10] |
| Haworth sites HW04, HW10 | More than 25 days of simultaneous Sun and Earth visibility at midsummer | MODEL **[excerpt]** | [Wueller 2026](https://doi.org/10.1029/2025JE009434) |
| NASA screening masks | Areas with Earth visibility below 25 % or solar visibility below 5 % excluded | CHOICE | [HLS-OV] |
| NASA Earth-visibility rasters | Earth counts as visible if any part of its disc is unobscured, "slightly optimistic" for DSN-only links | Method caveat | [PGDA69] |

From Shackleton's rim Earth "bobs up and down" near longitude 0, and Mons Malapert sits on the horizon about 137 km away in the Earth direction ([NASA SVS 4944](https://svs.gsfc.nasa.gov/4944/)). Earth windows are not synchronised with illumination windows ([Vanoutryve et al. 2010](https://www.researchgate.net/publication/228790017_An_analysis_of_illumination_and_communication_conditions_near_lunar_south_pole_based_on_Kaguya_Data)) **[excerpt]**. The researchers derived, from Cassini's laws, that the Sun-azimuth cycle and the Earth-up fortnight beat with the 346.6-day draconic year, so that at south-summer solstice Earth is highest at Full Moon, when the Sun stands at the Earth-facing azimuth. That phase relation is **[derived]** and unverified numerically. Its consequence is that sites open toward the Earth-facing azimuths, such as the north sides of Malapert and Mons Mouton, get light and Earth view in phase in summer.

| Relay system | Facts | Status | Source |
|---|---|---|---|
| NASA Near Space Network lunar relay (Intuitive Machines) | Firm-fixed-price IDIQ, maximum $4.82 billion; base period 1 Oct 2024 to 30 Sep 2029; without relays "landing opportunities at the Moon's South Pole will be significantly limited" | Contracted | [NASA via PR Newswire](https://www.prnewswire.com/news-releases/nasa-selects-lunar-relay-contractor-for-near-space-network-services-302250981.html) |
| Intuitive Machines "Khon" constellation | Five satellites; first with IM-3, two with IM-4 | Schedule from 2024 trade press, unverified for Nov 2026 | [Payload](https://payloadspace.com/intuitive-machines-will-build-a-lunar-communications-network) |
| ESA Moonlight | Five satellites, initial services end of 2028, full operations 2030; Lunar Pathfinder orbit 673.4 x 7,331.8 km altitude, 46.8 deg, 10 h **[excerpt]** | Planned | [ESA press release 60-2024](https://www.esa.int/Newsroom/Press_Releases/ESA_launches_Moonlight_to_establish_lunar_communications_and_navigation_infrastructure) |
| Queqiao-2 (CNSA) | Launched 20 Mar 2024; planned about 200 x 16,000 km, 24 h, 62.4 deg | FLOWN | [Wikipedia](https://en.wikipedia.org/wiki/Queqiao-2) **[secondary]** |
| Moon Base towers | About 10 km radius each, Phase 2 | Planned | [ASTRO-Jun26] |

Relay coverage for a 2028 landing cannot be assumed from these sources, so direct-to-Earth visibility remains the conservative constraint.

## Landing windows follow from thresholds, cadence, season and eclipses

### Every published threshold in one table

| Constraint | Value | Type | Applies to | Source |
|---|---|---|---|---|
| Latitude | Land within 6 deg of the South Pole | REQ | Crewed | [HLS-OV]; [REL22] |
| HLS surface access (LWIMS table) | 84-90 deg S initially | REQ | Crewed | [LWIMS] |
| Landing slope | Below 10 deg over 100 m; maps also contour continuous 8-deg slope | REQ | Crewed | [HLS-OV] |
| Landed tilt | 0-8 deg threshold, 0-5 deg goal; Apollo 15 settled at about 11 deg | REQ | Crewed | [LWIMS]; [REG-OIG] |
| EVA slope | Below 20 deg within 2 km; no EVAs above 20 deg | REQ | Crewed | [HLS-OV] |
| Landing accuracy | Within 100 m of target; HLS-RQMT-001 100 m-radius ellipse; 100 m (3-sigma) in LWIMS | REQ | Crewed | [HLS-OV]; [BARKER21]; [LWIMS] |
| Lighting | Site sunlit for descent, the whole stay and ascent | REQ | Crewed | [IAC22]; [HLS-OV]; [LPSC26] |
| Duration of required sunlight | About 6-6.5 days | REQ, LEGACY | Crewed | [WP-SITE]; [REL22] |
| Stay achievable from NRHO | 5.75-6.25 days; 6.1-6.2 days with 2-3 LLO revolutions (epoch 25 Mar 2028); about 5.9 days (epoch 12 Jan 2025) | CHOICE, LEGACY | Crewed | [LPSC26]; [HLS-MD] |
| Stay in the 2028 architecture | "Several days"; two EVAs of about two hours | Stated plan, no number of days | Crewed | [NASA-Oct26] |
| Darkness survival (HLS, LWIMS table) | 50 h threshold, 191 h goal | REQ | Crewed | [LWIMS] |
| Solar-visibility mask | Areas below 5 % excluded | CHOICE | Crewed | [HLS-OV] |
| Earth-visibility mask | Areas below 25 % excluded | CHOICE | Crewed | [HLS-OV] |
| Communications | Direct with Earth, assume no relay | REQ (Key Artemis III Landing Requirement no. 4) | Crewed | [HLS-OV] |
| Approach lighting | "Beneficial"; approach differs per opportunity; from NRHO a general left-to-right direction | RULE, no numeric limit | Crewed | [HLS-OV] |
| "Favourable" site in an academic study | Sunlit at least 10 consecutive days at midsummer | CHOICE | Crewed | [Wueller 2026](https://doi.org/10.1029/2025JE009434) **[excerpt]** |
| "Ideal" surface activity (LROC) | Slope below 10 deg, more than 45 % sunlight, Earth line of sight | CHOICE | Either | [LROC1255] |
| Rover slope limit (VIPER) | 15 deg | REQ | Robotic | [VIPER-SB] |
| Rover survivable darkness (VIPER) | 50 h in minimal-power mode; about 9 h working in shadow; PSR sorties under 8 h; other VIPER material quotes 70-72 h hibernation limits | REQ / CHOICE | Robotic | [VIPER-SB]; [VIPER-EN]; [Lim et al. 2024](https://ntrs.nasa.gov/api/citations/20240001709/downloads/20240001709-LPSC2024_Lim%20et%20al_vFINAL.pdf) |
| Pressurised rover | Climbs 15-deg slopes; survives 150 h without light | Design figure | Crewed base | [ASTRO-Jun26] |
| LTV thermal study | Night or shadow up to 125 h | Assumption | Crewed base | [NTRS 20230002802](https://ntrs.nasa.gov/citations/20230002802) |
| ISRU siting | Ice at under 1 m depth; sustained sunlight above 220 days; power within 5 km of the shadowed resource; traverse below 20 deg, under 5 km desired | CHOICE (NASA ISRU plan) | Base | [ISRU22] |
| ISRU reserve | Water at least 2 wt% at 5-100 cm depth over a 500 m radius | REQ (study threshold) | Base | [LWIMS] |
| Planetary protection | Category IIb south of 79 S | REQ (documentation) | All | [STD8719] |
| Seismic shaking, modelled Mw about 5.3 event | Strong to moderate out to about 40 km; light beyond about 50 km | MODEL | All | [WATTERS24] |
| Orion eclipse | No more than 90 minutes in darkness | REQ | SLS/Orion | [A1-AVAIL] |

NASA publishes no minimum or maximum Sun elevation at touchdown, no Sun-azimuth-versus-approach limit and no Earth mask angle for direct links.

### NRHO parameters and cadence (LEGACY)

| Parameter | Value | Source |
|---|---|---|
| Orbit family | L2 southern NRHO, 9:2 synodic resonance, phased to avoid Earth eclipses | [LEE19] |
| Mean period | 6.562 days | [LEE19] |
| Perilune radius | 3,196-3,557 km, mean 3,366 km | [LEE19] |
| Apolune radius | Mean about 71,100 km (exact document unverified) | [NTRS AAS paper](https://ntrs.nasa.gov/api/citations/20220010495/downloads/AAS_Charlotte_DavSchWilSprMigHow.pdf) |
| Reference trajectory | 15 years, 2 Jan 2020 to 11 Feb 2035, SPK on the NAIF server; DE430 | [LEE19] |
| Eclipses | Earth-shadow eclipses up to about 5 h if not avoided; Moon-shadow eclipses several per year, always under 80 minutes | [LEE19] |
| Surface access | About 0.5 day; transfer about 750 m/s each way, descent about 2,050 m/s, ascent about 1,860 m/s (notional) | [NRHO-WS]; [LEE19] |
| Descent opportunities | One per 6.5 days, about 55 per year | [HLS-OV] |
| Crewed opportunities | About 28 NRHO departures per year after SLS/Orion constraints | [HLS-OV] |
| Opportunity counts in scans | 557 in ten years from 3 Sep 2024 (Malapert, -86.0, 2.4); 56 between 6 Oct 2024 and 30 Sep 2025; 80 between 16 Mar 2024 and 25 Aug 2025 | [HLS-MD] |
| Effect of lighting, 3-day loiter and 8-day Orion outbound on those 80 | 42 Orion opportunities, 13 HLS missions accessible | [HLS-MD] |
| Nominal sequence | 12-h transfer to 100 km LLO; loiter 3-4 revolutions; descent orbit 100 x 15.24 km; about 6-day stay; ascent; 12-h return | [HLS-MD] |
| Rendezvous blackout | None within +/-6 h of perilune | [HLS-MD] |
| Surface abort (Connecting Ridge, epoch 14 Nov 2024) | In-space delta-v up to about 1,554 m/s; abort transfer 1-3.8 days | [HLS-MD] |

The researchers derived that 365.25 / 6.562 = 55.7 revolutions per year, matching NASA's "about 55", and that the 9:2 resonance advanced the Sun azimuth about 80 degrees per revolution, so legacy opportunities sampled only nine repeating Sun azimuths **[derived]**.

### SLS and Orion launch constraints

| Constraint | Value | Type | Source |
|---|---|---|---|
| Orion eclipse limit | At most 90 minutes; longer-eclipse launch days removed | REQ | [A1-AVAIL]; [IAC22] |
| Splashdown | Daylight; off San Diego | REQ | [A1-AVAIL] |
| Block 1 trans-lunar geometry | Launch availability a few days to two weeks per month; Orion reaches lunar orbit for roughly half of the Moon's orbit | RULE | [IAC22]; [WP-SITE] |
| Artemis I launch periods (worked example) | About two weeks on, two weeks off; 23 Aug-6 Sep 2022: 12 days; 19 Sep-4 Oct: 15; 17-31 Oct: 11; 12-27 Nov: 12; 9-23 Dec: 11 | Example | [A1-AVAIL] |
| Orion consumables | Four crew for up to 21 days; 84 crew-days assumed in the rescue study | REQ / assumption | [IAC22]; [AAS25] |
| Earth-entry target line | Realigns every 1.03 days | RULE | [AAS25] |
| Apollo comparison | One prime launch day per month for J-missions | Historical | [IAC22] |
| 2028 architecture | Starship propellant aggregation gives flexibility in SLS launch timing; Blue Origin's gives multiple SLS/Orion launch opportunities; no numbers | Stated | [NASA-Oct26] |

"Mission availability" is NASA's term for the number of launch days on which the whole end-to-end mission meets every vehicle's constraints ([IAC22]).

### How robotic missions picked their dates

| Mission | Landing | Timing logic | Source |
|---|---|---|---|
| Chandrayaan-3 | 23 Aug 2023, 12:33 UTC, 69 S | Landed shortly after local sunrise to use a full lunar day of about 14 Earth days; no wake-up on 22 Sep 2023 | [Planetary Society](https://planetary.org/space-missions/chandrayaan-3) |
| IM-1 | 22 Feb 2024 | Planned about 7 days before local night; ended 28 or 29 Feb (sources differ) | [EarthSky](https://earthsky.org/spaceflight/im-1-lunar-lander-makes-valentines-day-liftoff/) |
| IM-2 | 6 Mar 2025 (17:28 UTC per NASA slides, 17:31 UTC per collectSPACE) | Arrived around local sunrise; planned about 10 Earth days until local sunset | [collectSPACE](https://www.collectspace.com/news/news-030625a-intuitivie-machines-im2-athena-moon-landing.html); [Sky and Telescope](https://skyandtelescope.org/astronomy-news/intuitive-machines-athena-lands-on-the-moon-then-dies/) |
| Blue Ghost M1 (Mare Crisium, eclipse example) | 2 Mar 2025 | Operated more than 14 days; ran on batteries through the 14 Mar 2025 eclipse | [Firefly](https://fireflyspace.com/news/firefly-aerospace-successfully-completes-14-days-of-surface-operations-on-the-moon) |
| VIPER (original plan) | Nov 2023, then Nov 2024 | 100-day mission in south-polar summer; slipping past Nov 2025 meant waiting 9-12 months for lighting | [VIPER-SB]; [Planetary Society](https://www.planetary.org/articles/nasa-cancels-viper) |
| Chang'e-7 | NOTAM windows 24-31 Aug 2026, daily 00:00-04:00 UTC; postponed 23 Aug 2026 | Launch possible only when landing coincides with best lighting at Shackleton | [SpacePolicyOnline](https://spacepolicyonline.com/?p=90081) |
| ESA Lunar Lander study | — | Combined illumination and communication patterns "to establish possible landing dates"; shadow hazards assessed with images at the planned lighting | [DEROSA12] |

| VIPER planning number | Value | Source |
|---|---|---|
| Mission | 100+ Earth days; up to 20 km driving; about 5 days transfer plus 5 days in lunar orbit | [VIPER-SB]; [VIPER-EN] |
| Leg | One lunar day, 10-14 Earth days of operations | [VIPER-EN] |
| Safe Haven | Sustained sunlight with shadow under 50 h, where the rover waits for Earthrise | [VIPER-EN] |
| Speed | Up to 20 cm/s; effective about 1 cm/s (0.813 cm/s normal, 0.613 cm/s sunward) | [VIPER-EN]; [Lim et al. 2024](https://ntrs.nasa.gov/api/citations/20240001709/downloads/20240001709-LPSC2024_Lim%20et%20al_vFINAL.pdf) |
| Site requirements | Volatiles, sunlight, traversable terrain (15-deg limit), DTE; all four needed | [VIPER-SB] |
| Working days per candidate area (6-month 2023-24 analysis) | Nobile 45; Haworth Lower 20; Haworth Upper 12; de Gerlache 12; Slater Upper 10; Slater 8; Shackleton Ridge 7; Shoemaker 7; Cabeus 5 | [VIPER-SB] |
| Top-ranked 2021 traverse | 12 stations (2 PSR, 4 shallow, 4 deep, 2 dry); 4.4 km prospecting, 27.4 km total; 94-day surface mission, 45 active days; full success by day 37 | [VIPER-21] |
| Planning maps | 20 m/px LOLA, 4 m/px thermal, 1 m/px shape-from-shading | [VIPER-EN] |
| Robustness tests | Landing-time error, power, speed, DSN failures, solar proton events | [VIPER-EN] |

The researchers noted that IM-1 and IM-2 both landed 1.5-2.5 months after a derived summer solstice and planned 7-10 days to local sunset, and that "solstice plus or minus about 50-60 days" brackets the VIPER and Chang'e-7 plans **[derived]**.

### Lunar eclipses 2026-2040: the one hard-dated outage list

A lunar eclipse is a solar eclipse for a lander. Times are Terrestrial Time of greatest eclipse ([LE2021]; [LE2031]).

| Date | TD of greatest eclipse | Type | Umbral magnitude | Partial duration | Total duration |
|---|---|---|---|---|---|
| 2026 Mar 03 | 11:34:52 | Total | 1.151 | 3h27m | 0h58m |
| 2026 Aug 28 | 04:14:04 | Partial | 0.930 | 3h18m | - |
| 2027 Feb 20 | 23:14:06 | Penumbral | -0.057 | - | - |
| 2027 Jul 18 | 16:04:09 | Penumbral | -1.068 | - | - |
| 2027 Aug 17 | 07:14:59 | Penumbral | -0.525 | - | - |
| 2028 Jan 12 | 04:14:13 | Partial | 0.066 | 0h56m | - |
| 2028 Jul 06 | 18:20:57 | Partial | 0.389 | 2h21m | - |
| 2028 Dec 31 | 16:53:15 | Total | 1.246 | 3h29m | 1h11m |
| 2029 Jun 26 | 03:23:22 | Total | 1.844 | 3h40m | 1h42m |
| 2029 Dec 20 | 22:43:12 | Total | 1.117 | 3h33m | 0h54m |
| 2030 Jun 15 | 18:34:34 | Partial | 0.502 | 2h24m | - |
| 2030 Dec 09 | 22:28:51 | Penumbral | -0.163 | - | - |
| 2031 May 07 | 03:52:02 | Penumbral | -0.090 | - | - |
| 2031 Jun 05 | 11:45:17 | Penumbral | -0.820 | - | - |
| 2031 Oct 30 | 07:46:45 | Penumbral | -0.320 | - | - |
| 2032 Apr 25 | 15:14:51 | Total | 1.191 | 3h31m | 1h06m |
| 2032 Oct 18 | 19:03:40 | Total | 1.103 | 3h16m | 0h47m |

Later total eclipses to 2040: 2033 Apr 14 (0h49m), 2033 Oct 08 (1h19m), 2036 Feb 11 (1h14m), 2036 Aug 07 (1h35m), 2037 Jan 31 (1h04m), 2040 May 26 (1h32m), 2040 Nov 18 (1h28m) ([LE2031]). The eclipse dates line up with the derived equinoxes (26 Jun 2029 on both lists; 27 Feb against 3 Mar 2026), so umbral eclipses cluster about 87 days from each solstice and cannot fall in polar midsummer **[derived]**. The total eclipse of 31 Dec 2028 falls about 81 days after the derived solstice of 11 Oct 2028, which matters for any asset left on the surface after a late-2028 landing **[derived]**.

Other time-varying factors are thinly sourced. Solar cycle 25 peaked around 2024 with a minimum expected around 2031, and warning times for particle events are 24-48 hours ([New Space Economy](https://newspaceeconomy.ca/2026/04/08/how-does-space-weather-affect-the-artemis-missions/)) **[secondary]**; no NASA date criterion based on solar-cycle phase or meteoroid streams was found.

### How windows are computed in the published work

| Method element | Published practice | Source |
|---|---|---|
| Core algorithm | Horizon method: terrain horizon elevation versus azimuth per pixel, then Sun or Earth disc against that horizon at each epoch | [BARKER21]; [MAZ11] |
| Azimuth sampling | 720 sight lines at 0.5 deg | [BARKER21] |
| Nested DEMs | 5 m/px within 5 km, 80 m/px for 5-100 km, 240 m/px beyond | [BARKER21] |
| Sun model | Finite disc with limb darkening at 550 nm; visible fraction cut at the horizon elevation | [BARKER21]; [PGDA69] |
| Earth visibility | Same code with Earth as the source; visible if any part of the disc is unobscured | [PGDA69] |
| Time step | 1 h (Barker 2021, Glaeser 2018, PGDA averages); 2 h (NASA SVS); 6 h (Mazarico 2011 abstract) | [BARKER21]; [NASA SVS 5027](https://svs.gsfc.nasa.gov/5027); [MAZ11] |
| Height above ground | 1 m and 5 m (Barker); surface, 2 m, 10 m (Glaeser) | [BARKER21]; [GLAESER18] |
| Metrics | Average illumination, LCIP, LCSP | [BARKER21] |
| Uncertainty | 100 fractal "clone" DEMs per site, 1st/99th percentiles; errors usually worsen conditions because they more often raise the horizon | [BARKER21]; [PGDA78] |
| Frame | MOON_ME of DE421, matching LRO products | [BARKER21] |
| Ephemerides in NASA work | DE421 (Copernicus HLS design, SVS lighting); DE430 (NRHO reference) | [HLS-MD]; [LEE19]; [NASA SVS 4875](https://svs.gsfc.nasa.gov/4875) |
| VIPER Safe-Haven search | Horizons for every 20 m pixel of a 3,000 square-mile DEM; lighting and Earth visibility over six months; search for intervals meeting the 50 h rule | [VIPER-SB] |
| JSC Copernicus with Initial Guess Generator | Ten-year epoch scan in about 30 s with under 1 % delta-v error; terrain lighting was future work in 2022 | [HLS-MD] |
| Dated analysis epochs in NASA documents (cases, not announced windows) | 14 Nov 2024, 12 Jan 2025, 30 May 2025, 25 Mar 2028; NRHO revolutions in 2026-2027; illumination 1 Jan 2024 to 1 Jan 2026 | [HLS-MD]; [AAS25]; [BARKER21] |

A sensitivity estimate by the researchers shows why edges are uncertain: a 0.4 m height error at an obstacle 100 m away moves the horizon about 0.2 degrees, comparable to the Sun's radius **[derived]**. Window edges from 20-60 m public DEMs therefore carry an uncertainty of hours.

## Water ice has one ground truth; everything else is a proxy below NASA's 2 wt% reserve line

### What each dataset says, and where

| Dataset (year) | Class | Depth and resolution | Finding | Where | Status and conflicts | Source |
|---|---|---|---|---|---|---|
| LCROSS impact and spectrometers (2009) | DIRECT | Excavated possibly deeper than 0.7 m; one sample of about 50 m | 155 +/- 12 kg water in view; 5.6 +/- 2.9 wt% in regolith | Cabeus PSR | Single point; depends on excavated-mass estimate | [COLAPRETE10]; [LWIMS] |
| LRO LAMP on the LCROSS plume | DIRECT (gas) | Plume | About 140 kg H2, equal to 1.4 % initial concentration | Cabeus | Cited within Colaprete | [COLAPRETE10] |
| Lunar Prospector neutrons | INDIRECT | 0.8-1 m; footprint about 45 km | About 1.5 +/- 0.8 wt% WEH if confined to PSRs; pixon maps up to about 1 wt% | Cabeus, Shoemaker, Haworth, Faustini | Background-dependent | [ICE-REVIEW]; [Eke et al.](https://arxiv.org/pdf/0810.2478) |
| Lunar Prospector at Shoemaker; end-of-mission impact 31 Jul 1999 | INDIRECT / attempted DIRECT | — | About 146 ppm H on the floor against about 50 ppm average; no water plume from the crash | Shoemaker | Negative plume | [WP-SHOE] **[secondary]** |
| LRO LEND collimated (2010-2024) | INDIRECT | Top 1 m; claimed 10 km resolution is "controversial"; 30 km footprint used in 2024 | 502 PSRs consistent with 0.28 +/- 0.03 wt% WEH above background; evidence to at least 77 S; maxima at the coldest spots below 75 K | 75-90 S | Resolution disputed | [MCCLANAHAN24]; [LEND-NASA24]; [LWIMS] |
| LRO LAMP far-UV albedo | INDIRECT to DIRECT (surface) | About 250 m | 0.1-2.0 % frost by mass in cold traps, or up to about 10 % areal pure ice; patchy | South-polar PSRs | Signal could be frost or OH | [Hayne et al. 2015](https://escholarship.org/uc/item/5wq6z2wf); [ICE-REVIEW] |
| LRO LOLA 1064 nm reflectance | INDIRECT | Optical surface | Shackleton floor consistent with up to about 22 % surface ice; reflectance rises below about 110 K within 5 deg of the pole | Shackleton; south of 85 S | May be space weathering | [EurekAlert](https://www.eurekalert.org/news-releases/551736); [Fisher et al. 2017](https://ntrs.nasa.gov/citations/20170003782) |
| LRO Diviner | INDIRECT | Surface temperature | LCROSS site among the coldest; CO2 cold traps (below about 60 K) total 204 km2, 82 km2 in Amundsen | Whole region | Temperature does not prove ice | [Paige et al. 2010](https://pubs.usgs.gov/publication/70036393); [AGU 2021](https://news.agu.org/press-release/carbon-dioxide-cold-traps-on-the-moon-are-confirmed-for-the-first-time) |
| Chandrayaan-1 M3 (Li et al. 2018) | DIRECT, surface only | 280 m pixels | About 3.5 % of cold traps show ice; some pixels about 30 wt% if intimately mixed; all below 110 K | Near Haworth, Shoemaker, Sverdrup, Shackleton; none in Amundsen, Idel'son L, Wiechert | Low signal in shadow; contradicted at face value by ShadowCam | [LI18] |
| Arecibo radar | INDIRECT | — | No thick ice deposits | Shackleton | Negative | [WP-SHACK] **[secondary]** |
| Mini-SAR / Mini-RF | INDIRECT | 1-2 m; 150 m baseline | High-CPR craters could be ice or roughness; no thick ice at the LCROSS site; the "at least 600 million t" estimate depends on assumed thickness | Cabeus and others | Anomalous craters "resolved as boulders" | [ICE-REVIEW]; [LWIMS] |
| Chandrayaan-2 DFSAR (ISRO release 27 May 2026) | INDIRECT | Subsurface | Possible ice beneath 4 of 9 doubly shadowed craters; strongest case a 1.1 km crater in Faustini | Faustini, Haworth, Shoemaker | "Possible" | [ISRO DFSAR](https://www.isro.gov.in/ISRO_EN/Chandrayaan2_Dual_Frequency_Synthetic_Aperture_Radar.html) |
| Kaguya Terrain Camera | INDIRECT | 10 m/px | No exposed ice on the Shackleton floor | Shackleton | Negative | [WP-SHACK] **[secondary]** |
| SOFIA | DIRECT, sunlit surface | Grains | 100-412 ppm H2O at Clavius (about 58 S) | Not PSRs | Not a deposit | [NASA, 26 Oct 2020](https://www.nasa.gov/news-release/nasas-sofia-discovers-water-on-sunlit-surface-of-moon/) |
| ShadowCam (Science Advances, 18 Mar 2026) | Optical, about 2 m/px | Surface | No widespread surface ice above about 20-30 wt%; a few 20-50 m patches consistent with more than 10 wt% | PSRs with stereo coverage | Cannot exclude widespread ice below about 1-10 % | [SHADOWCAM26]; [LROC1255] |
| Chandrayaan-3 ChaSTE | INDIRECT (in situ, 69 S) | Top 10 cm | No ice; poleward-facing slopes above 14 deg could hold shallow ice | 69 S | Extrapolation is press-level | [ISRO](https://www.isro.gov.in/ISRO_EN/India_Bags_Credit_First-Ever_In-Situ_Measurement.html) |
| IM-2 PRIME-1 (TRIDENT, MSolo) | Attempted DIRECT | 1 m drill planned | About 12 h on its side; drill moved but did not drill; MSolo made 43 scans and saw only brought-along species | Mons Mouton | No lunar volatile measurement | [MSOLO26] |
| Chang'e-7 | Planned DIRECT | — | No data; launch slipped to 2027 | Shackleton rim | — | [WP-CE7] **[secondary]** |

No landed mission has measured ice in situ at the south pole as of November 2026.

### LCROSS, the only ground truth

| Item | Value | Source |
|---|---|---|
| Impact | Centaur at 11:31:19.506 UTC, 9 Oct 2009; nominal 2,305 kg at about 2.5 km/s | [Marshall et al.](https://ar5iv.labs.arxiv.org/html/1103.1687); [WP-LCROSS] **[secondary]** |
| Target / reconstructed point | -84.675, 311.275 E / -84.6796, -48.7093 (311.2907 E); 1-sigma 115 m in latitude, 44 m in longitude; 146 m from target | [Marshall et al.](https://ar5iv.labs.arxiv.org/html/1103.1687) |
| Water by time window | 4.5 +/- 1.4 %, 6.4 +/- 1.7 %, 7.2 +/- 1.9 %; mean 5.6 +/- 2.9 % by mass (53 +/- 15 kg vapour, 68 +/- 10 kg ice against 2,175 +/- 544 kg dust) | [Planetary Society](https://www.planetary.org/articles/2728) reproducing [COLAPRETE10] |
| NASA ISRU reading | Consistent with neutron data if ice fills 30-40 % of the area or lies under a 10-30 cm dry layer | [LWIMS] |
| Age of that PSR | Permanently shadowed for about 0.9 Ga (0.93 +/- 0.13) | [SR23] |

LCROSS Table 2, abundances from near-infrared fits; the authors caution the plume was far from equilibrium ([COLAPRETE10]). One researcher recalled these values without a source and a second read them from a copy of the paper, so they are verified here.

| Compound | Molecules per cm2 | % relative to H2O |
|---|---|---|
| H2O | 5.1(1.4)E19 | 100.00 |
| H2S | 8.5(0.9)E18 | 16.75 |
| NH3 | 3.1(1.5)E18 | 6.03 |
| SO2 | 1.6(0.4)E18 | 3.19 |
| C2H4 | 1.6(1.7)E18 | 3.12 |
| CO2 | 1.1(1.0)E18 | 2.17 |
| CH3OH | 7.8(42)E17 | 1.55 |
| CH4 | 3.3(3.0)E17 | 0.65 |
| OH | 1.7(0.4)E16 | 0.03 |

An extraction plant must expect H2S, SO2, NH3, Hg, HF, CO2 and CO to be released below about 200 C ([LWIMS]). No retrieved source lists HCN among the LCROSS detections.

### LEND hydrogen maxima per PSR

McClanahan et al. 2024, Table 1 ([MCCLANAHAN24]). NASA's release adds that each square metre over the deposits should hold "at least about five more liters" of ice in the top metre than its surroundings ([LEND-NASA24]).

| PSR | Lat of maximum | Lon (E-positive) | Collimated WEH (wt%) | Diviner max T at that spot (K) |
|---|---|---|---|---|
| Cabeus-1 | -84.35 | -48.22 (311.78 E) | 0.39 | 78 |
| Shoemaker | -87.98 | 43.67 | 0.37 | 59 |
| Haworth | -87.28 | 4.31 | 0.27 | 60 |
| Faustini | -86.92 | 81.24 | 0.26 | 73 |

### Documented disputes between datasets

| Dispute | Positions | Evidence level | Source |
|---|---|---|---|
| LEND spatial resolution | Critics: collimated flux about 1 % or "negligible"; LEND team: about one third of signal is collimated | CONTESTED | [Teodoro et al.](https://ar5iv.arxiv.org/html/1304.8123); [Lawrence et al. 2011](https://doi.org/10.1126/science.1203341); [LWIMS] |
| Surface versus buried ice | "No strong correlation" between surface and buried datasets; LAMP, LOLA and M3 maps are mutually inconsistent | CONTESTED | [LWIMS]; [ICE-REVIEW] |
| Concentration scale | LCROSS 5.6 wt% against neutron 0.2-0.9 wt% WEH | Reconciled only by patchiness or a dry lid | [LWIMS] |
| Age paradox | High hydrogen at the young Cabeus PSR, none in old Shackleton | CONTESTED | [ICE-REVIEW] |
| M3 against ShadowCam | Up to 30 wt% pixels against no widespread ice above 20-30 wt%; LROC team sees "no albedo patterns indicative of ice, frost, or lag deposits" in Shoemaker or other PSR craters | CONTESTED | [LI18]; [SHADOWCAM26]; [LROC1255] |
| Radar | Mini-RF anomalies attributed to boulders; DFSAR 2026 revives a subsurface-ice reading | CONTESTED | [ICE-REVIEW]; [ISRO DFSAR](https://www.isro.gov.in/ISRO_EN/Chandrayaan2_Dual_Frequency_Synthetic_Aperture_Radar.html) |

### Host craters: centres and sizes

Most centres are Wikipedia infobox values (stated to derive from the IAU/USGS Gazetteer) and are **[secondary]**; Cabeus and Amundsen were confirmed on the Gazetteer list.

| Feature | Lat | Lon E | Diameter (km) | Note | Source |
|---|---|---|---|---|---|
| Shackleton | -89.67 | 129.78 | 21.0 | Depth 4.2 km; walls about 30 deg | [WP-SHACK] |
| Haworth | -86.9 | -4.0 | 51.4 | IAU notice gives 86.8 S, 4 W | [WP-HAW] |
| Shoemaker | -88.1 | 44.9 | 50.9 | Depth 3.81 km | [WP-SHOE] |
| Faustini | -87.3 | 77.0 | 42.48 | 664 km2 PSR | [WP-FAU] |
| Cabeus | -85.33 | -42.13 | 100.58 | Wikipedia gives -84.9, -35.5 (conflict) | [USGS Gazetteer list](https://planetarynames.wr.usgs.gov/SearchResults?Target=16_Moon&Feature%20Type=9_Crater,%20craters); [WP-CAB] |
| Cabeus A / Cabeus B | -82.2 / -82.4 | -39.1 / -53.0 | 48 / 61 | — | [WP-CAB] |
| de Gerlache | -88.5 | -87.1 | 32.4 | Depth 7.5 km; possible CO2 cold trap | [WP-DEG] |
| Sverdrup | -88.5 | -152.0 | 35 | — | [Wikipedia](https://en.wikipedia.org/wiki/Sverdrup_(crater)) |
| Slater | -88.08 | 111.29 | 25.12 | — | [Wikipedia](https://en.wikipedia.org/wiki/Slater_(crater)) |
| Nobile | -85.28 | 53.27 | 79.27 | — | [Wikipedia](https://en.wikipedia.org/wiki/Nobile_(crater)) |
| Amundsen | -84.44 | 83.07 | 103.39 | — | [USGS Gazetteer list](https://planetarynames.wr.usgs.gov/SearchResults?Target=16_Moon&Feature%20Type=9_Crater,%20craters) |
| Wiechert / Wiechert J | -84.5 / -85.6 | 165.0 / -177.0 | 41 / 34 | — | [Wikipedia](https://en.wikipedia.org/wiki/Wiechert_(crater)) |
| Idel'son L | -84.2 | 115.8 | 28 | — | [Wikipedia](https://en.wikipedia.org/wiki/Idel%27son_(crater)) |
| Malapert | -84.9 | 12.9 | 69 | Massif peak near longitude 0 | [Wikipedia](https://en.wikipedia.org/wiki/Malapert_(crater)) |
| Schrodinger (context, 75 S) | -75.0 | 132.4 | 312 | Peak-ring basin | [Wikipedia](https://en.wikipedia.org/wiki/Schr%C3%B6dinger_(crater)) |

### The 40 largest south-polar PSRs (LROC PSR Atlas)

Source for every row: [PSR-ATLAS]. Atlas IDs encode latitude and longitude; the east-positive longitudes were converted by the researchers from the published 0-360 values.

| # | Atlas ID | Host | Centroid lat | Lon (E+) | Area (km2) | Perimeter (km) |
|---|---|---|---|---|---|---|
| 1 | SP_880260_0452790 | Shoemaker | -88.026 | 45.279 | 1075.518 | 166.2 |
| 2 | SP_874930_3578760 | Haworth | -87.493 | -2.124 | 1017.932 | 173.9 |
| 3 | SP_871460_0840750 | Faustini | -87.146 | 84.075 | 663.930 | 133.4 |
| 4 | SP_882490_2164550 | Sverdrup | -88.249 | -143.545 | 548.791 | 177.4 |
| 5 | SP_835240_0910150 | Amundsen | -83.524 | 91.015 | 439.222 | 413.3 |
| 6 | SP_816910_3053810 | Cabeus B | -81.691 | -54.619 | 376.916 | 197.4 |
| 7 | SP_850230_1826070 | Wiechert J | -85.023 | -177.393 | 371.549 | 133.3 |
| 8 | SP_838910_1184700 | Idel'son L | -83.891 | 118.470 | 326.779 | 102.0 |
| 9 | SP_844580_3134320 | Cabeus (LCROSS PSR) | -84.458 | -46.568 | 315.029 | 340.9 |
| 10 | SP_821760_0111040 | Malapert F / E | -82.176 | 11.104 | 300.589 | 109.0 |
| 11 | SP_883120_2691430 | de Gerlache | -88.312 | -90.857 | 243.292 | 111.1 |
| 12 | SP_867440_0218610 | Between Haworth and Shoemaker | -86.744 | 21.861 | 237.287 | 170.6 |
| 13 | SP_896450_1282030 | Shackleton | -89.645 | 128.203 | 233.698 | 70.3 |
| 14 | SP_837400_1630860 | Wiechert | -83.740 | 163.086 | 194.702 | 104.4 |
| 15 | SP_841420_0059530 | Malapert | -84.142 | 5.953 | 194.479 | 139.2 |
| 16 | SP_881000_1147820 | Slater | -88.100 | 114.782 | 183.172 | 106.9 |
| 17 | SP_845510_0602900 | Nobile / Amundsen ("Nobile 2") | -84.551 | 60.290 | 182.268 | 114.1 |
| 18 | SP_809710_0357350 | Scott E | -80.971 | 35.735 | 166.374 | 98.6 |
| 19 | SP_804240_1354850 | Nefed'ev | -80.424 | 135.485 | 155.074 | 171.8 |
| 20 | SP_837670_3387710 | Newton B / Cabeus | -83.767 | -21.229 | 142.949 | 76.4 |
| 21 | SP_832600_0820620 | Amundsen | -83.260 | 82.062 | 138.251 | 158.5 |
| 22 | SP_863550_0488280 | Shoemaker / Nobile | -86.355 | 48.828 | 132.347 | 98.5 |
| 23 | SP_830550_0674490 | Demonax B | -83.055 | 67.449 | 129.557 | 172.0 |
| 24 | SP_854150_3078410 | Cabeus | -85.415 | -52.159 | 127.296 | 87.4 |
| 25 | SP_824820_3550120 | Newton B | -82.482 | -4.988 | 124.330 | 100.3 |
| 26 | SP_864040_0314430 | Nobile / Haworth (south of Mons Mouton) | -86.404 | 31.443 | 120.575 | 55.4 |
| 27 | SP_828530_0080500 | Malapert F / E | -82.853 | 8.050 | 119.171 | 115.3 |
| 28 | SP_832950_1495450 | Wiechert U | -83.295 | 149.545 | 114.437 | 144.8 |
| 29 | SP_834700_1757740 | Wiechert E | -83.470 | 175.774 | 113.414 | 76.1 |
| 30 | SP_845770_0017070 | Malapert | -84.577 | 1.707 | 103.727 | 88.7 |
| 31 | SP_875930_3125710 | Ibn Bajja / Haworth | -87.593 | -47.429 | 101.833 | 55.7 |
| 32 | SP_830490_3505380 | Newton B | -83.049 | -9.462 | 101.758 | 125.2 |
| 33 | SP_802260_0424290 | Scott E / Scott | -80.226 | 42.429 | 99.558 | 121.1 |
| 34 | SP_814440_3172250 | Cabeus A | -81.444 | -42.775 | 98.230 | 85.6 |
| 35 | SP_842890_0563440 | Nobile | -84.289 | 56.344 | 97.967 | 60.5 |
| 36 | SP_819690_0250940 | Scott E / Malapert E | -81.969 | 25.094 | 95.083 | 80.0 |
| 37 | SP_887280_1688800 | Sverdrup / Slater ("PSR 120") | -88.728 | 168.880 | 88.607 | 45.8 |
| 38 | SP_807910_0455060 | Scott | -80.791 | 45.506 | 85.180 | 109.1 |
| 39 | SP_816480_0652210 | Svedberg | -81.648 | 65.221 | 79.788 | 35.9 |
| 40 | SP_817610_0619190 | von Baeyer | -81.761 | 61.919 | 79.142 | 46.9 |

### Per-PSR ice evidence and access (Lemelin et al. 2021)

Source for every row: [LEMELIN21]. "Access slope" is the minimum slope class a rover must tolerate to enter. "Dist" is the minimum traverse in metres from a landing site when slopes up to 10 / 15 / 20 / 25 deg are allowed. "Illum" is the percentage of time sunlit within 1 / 5 / 10 km of the PSR boundary. The 2 K and 14 K minimum temperatures are as printed and look like artefacts. This WEH column is a different product from the LEND values above and should not share a field with them.

| PSR | Lat | Lon E | Area (km2) | M3 detections (per km2) | H max (ppm) | Max WEH (wt%) | T min/max/mean (K) | Slope max/mean (deg) | Access slope (deg) | Ice stability depth (m) | Dist 10/15/20/25 (m) | Illum 1/5/10 km (%) | Model age (Ga) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Shoemaker | -88.0517 | 45.4880 | 1071 | 134 (0.13) | 168 | 0.24 | 2/109/44 | 28/9 | 10-15 | 0.00-0.11 | - / 13,843 / 9,134 / 8,160 | 2/24/47 | 4.15 |
| Haworth | -87.5109 | -2.2324 | 1009 | 80 (0.08) | 145 | 0.31 | 14/128/42 | 31/9 | 5-10 | 0.00-0.36 | not tabulated | n/a | 4.18 |
| Faustini | -87.1557 | 84.0797 | 660 | 34 (0.05) | 168 | 0.37 | 14/201/47 | 30/11 | 10-15 | 0.00-0.43 | - / 10,433 / 4,784 / 4,243 | 5/65/68 | 4.10 |
| Sverdrup 1 | -88.2432 | -143.9156 | 541 | 93 (0.17) | 141 | 0.12 | 28/125/55 | 26/7 | 0-5 | 0.00-0.32 | 20,741 / 8,583 / 4,527 / 3,684 | 29/55/77 | 3.80 |
| Cabeus 1 (LCROSS) | -84.4630 | -46.2819 | 285 | 9 (0.03) | 178 | 0.90 | 24/243/51 | 23/10 | 5-10 | 0.00-0.11 | not tabulated | n/a | 3.50 |
| Wiechert J | -85.0288 | -140.3766 as printed (atlas: -177.39) | 367 | 17 (0.05) | 94 | 0.06 | 36/180/66 | 30/12 | 0-5 | 0.00-0.31 | - / 11,204 / 7,548 / 6,720 | 41/45/50 | 3.20 |
| Malapert | -84.1452 | 5.9438 | 191 | 17 (0.09) | 97 | 0.05 | 37/206/66 | 33/15 | 0-5 | 0.00-0.24 | 15,413 / 9,792 / 5,906 / 1,800 | 43/55/55 | n/a |
| Nobile 2 | -84.5522 | 60.2933 | 178 | 15 (0.08) | 121 | 0.13 | 31/137/57 | 24/9 | 0-5 | 0.00-0.18 | 3,836 / 2,028 / 2,028 / 2,028 | 45/54/54 | 3.80 |
| Unnamed PSR 120 | -88.7290 | 168.8992 | 87 | 36 (0.41) | 141 | 0.15 | 28/174/47 | 22/6 | 5-10 | 0.00-0.25 | 16,356 / 10,400 / 6,601 / 6,391 | 6/44/64 | n/a |
| Unnamed PSR 89 | -88.9996 | -42.9735 | 42 | 10 (0.24) | 140 | 0.84 | 33/123/53 | 17/5 | 0-5 | 0.00-0.14 | not tabulated | n/a | n/a |
| Unnamed PSR 57 | -87.3678 | -30.7628 | 32 | 10 (0.31) | 135 | 0.08 | 27/96/47 | 25/11 | 5-10 | 0.00-0.15 | 7,549 / 7,479 / 7,467 / 7,467 | 9/37/62 | n/a |
| Shackleton (not recommended) | -89.67 | 129.78 | 233.7 (atlas) | 34 (0.15) | 152 | 0.17 | 20/173/63 | 35/27 | 25 or more | n/a | n/a | n/a | n/a |

The same paper counts 169 ice-bearing PSRs, of which 6 are enterable on slopes up to 5 deg, 133 up to 10 deg, 161 up to 15 deg and 168 up to 20-25 deg; only Shackleton's floor needs more. Upper-limit tonnages if the LCROSS grade applied everywhere are about 9e9 to 3e10 kg each for Haworth and Shoemaker ([LEMELIN21]) (SPEC). Evidence and access are anti-correlated: Shoemaker and Faustini have no route on slopes up to 10 deg and 2-5 % illumination within 1 km, while Nobile 2, Sverdrup 1 and Malapert are easy to enter but show 0.05-0.13 wt% WEH.

### Evidence by location, condensed

| Location | Positive evidence | Negative or missing evidence | Access and context | Source |
|---|---|---|---|---|
| Cabeus (LCROSS PSR) | LCROSS 5.6 wt%; LEND 0.39 wt%; Lemelin 0.90 wt% | Mini-RF no thick ice; ShadowCam no brightening after 15 years; few M3 detections | PSR only about 0.9 Ga old; access class 5-10 deg | [COLAPRETE10]; [MCCLANAHAN24]; [LEMELIN21]; [ICE-REVIEW] |
| Shoemaker | LEND 0.37 wt%; most M3 detections (134); DFSAR candidates | ShadowCam: no ice-like albedo patterns; 1999 crash without plume | Largest PSR; no route under 10 deg | [MCCLANAHAN24]; [LEMELIN21]; [LROC1255] |
| Haworth | LEND 0.27 wt%; 80 M3 detections; DFSAR candidates; some areas never above about 40 K | — | Access class 5-10 deg; 2024 candidate region | [MCCLANAHAN24]; [LEMELIN21] |
| Faustini | LEND 0.26 wt%; DFSAR strongest case; Brown 2022 potential top site | ShadowCam suggests rocks dominate its radar-bright signal | 65 % illumination within 5 km | [MCCLANAHAN24]; [Diviner/UCLA](https://www.diviner.ucla.edu/single-post/unveiling-the-faustini-permanently-shadowed-region-of-the-moon) |
| Shackleton | 34 M3 detections; LOLA bright floor (contested) | No neutron excess; Arecibo and Kaguya negative; ShadowCam "no obvious ice" | Mean slope 27 deg; worst access | [LEMELIN21]; [ICE-REVIEW] |
| de Gerlache | Brown 2022 top list; CO2-capable pocket | No instrument-specific numbers found | PSR 243.3 km2; 2024 region de Gerlache Rim 2 | [PSR-ATLAS]; [WP-DEG] |
| Sverdrup | 93 M3 detections | Modest hydrogen (0.12 wt%) | Easiest large PSR: 0-5 deg, 77 % illumination within 10 km | [LEMELIN21] |
| Slater | Adjacent PSR 120 has the highest M3 density (0.41 per km2) | No direct numbers | 2024 region Slater Plain | [LEMELIN21]; [PSR-ATLAS] |
| Nobile small PSRs | 15 M3 detections | Modest hydrogen (0.13 wt%) | Best access: 2-4 km from landable terrain | [LEMELIN21] |
| Amundsen | Largest CO2 cold-trap area | No M3 ice | Broad flat floor; proposed for subsurface survey | [LI18]; [LEMELIN21] |
| Malapert PSRs | 17 M3 detections | Low hydrogen (0.05 wt%); mean 66 K | 1,800 m traverse at 25 deg, 15.4 km at 10 deg | [LEMELIN21] |
| Mons Mouton | All four VIPER ice-stability classes within about 3 km | IM-2 returned no volatile data | Nearest atlas PSRs 120.6 km2 and 237.3 km2 | [VIPER-21]; [MSOLO26]; [PSR-ATLAS] |
| Connecting Ridge | NASA 2022: the ridge "could have ice below the surface" | No detection | Moon Base I target | [NASA, 2022](https://www.nasa.gov/missions/artemis/clps/nasa-intuitive-machines-announce-landing-site-location-for-lunar-drill/) |

### Areas, inventory and age

| Quantity | Value | Class | Source |
|---|---|---|---|
| PSR area poleward of 80 S | 20,800 km2 (20,600 km2 for PSRs of 5 pixels or more); 466,204 PSRs | MODEL (LOLA 20 m) | [BARKER23] |
| PSR size distribution | Power law, exponent -0.77 +/- 0.07 below 10 km2; PSRs under 1 km hold 15 +/- 5 % of area | MODEL | [BARKER23] |
| Older PSR totals | 16,055 km2 south, 12,866 km2 north (240 m LOLA) | MODEL; one researcher could not confirm these from the record | [MAZ11] |
| Cold traps at all scales | About 40,000 km2 Moon-wide; south about 23,000 km2; 10-20 % in micro traps | MODEL | [HAYNE21] |
| Diviner cold-trap area below 110 K | 13,000 km2 poleward of 80 S | INDIRECT | [HAYNE21] |
| Seasonal growth of cold-trap area | 2.8-fold in southern winter | INDIRECT | [WILLIAMS19] |
| CO2 cold traps | 204 km2 total | INDIRECT | [AGU 2021](https://news.agu.org/press-release/carbon-dioxide-cold-traps-on-the-moon-are-confirmed-for-the-first-time) |
| PSR age | Most PSRs arose less than 2.2 Ga ago; estimates of trapped ice "have to be revised downward" | MODEL | [SR23] |
| Inventory claims | About 100 million t to more than 1 billion t across methods | SPEC | [Physics Today](https://physicstoday.aip.org/news/water-ice-estimates-for-the-moon); [ICE-REVIEW] |
| Sublimation loss | About 100 kg per m2 per Ga at 109 K and 1,000 at 114 K | MODEL | [ICE-REVIEW] |

### Form of the ice, ISRU thresholds and other resources

| Aspect | Finding | Source |
|---|---|---|
| NASA taxonomy | Surface frost, shallow bulk water, deep bulk water, pyroclastics; "Shallow bulk water is the target for ISRU" | [LWIMS] |
| Reserve threshold | At least 2 wt% (1 wt% detection limit); 5-100 cm depth in 10 cm steps; overburden 5-50 cm; 500 m radius; 15 t water per lander | [LWIMS] |
| Water-mining case | 15 t per year over 225 days at 5 wt% needs 398 t regolith, a 32 x 32 m pit 30 cm deep; system 4.9 t and 68 kW against 2.7 t and 45 kW for oxygen from regolith; "1 wt% is unlikely to be a viable ISRU water-ice deposit" | [ISRU22] |
| NASA sequencing | Pursue oxygen and metal demonstrations; "delay water mining demonstration until better knowledge is obtained" | [ISRU22] |
| Heterogeneity | Expected at 50-150 m scale | [LWIMS] |
| VIPER ice stability regions | Surface (PSR); Shallow (0-50 cm); Deep (50-100 cm); Dry | [VIPER-21] |
| Bearing capacity | 13 boulder tracks: PSR regolith somewhat stronger than elsewhere at 0.28-1.00 m. The notes disagree on where the tracks lie (in south-polar PSRs, or in shadowed terrain at 70-76 deg latitude) | [Sargeant et al. 2020](https://oro.open.ac.uk/69451) |
| Regolith oxygen | More than 40 % oxygen by mass; polar regolith more than 75 % anorthite, iron-poor; "very accessible and ubiquitous" | [ISRU22] |
| Ilmenite | Typically under 2 vol% in polar highland regolith | [arXiv:2601.14719](https://arxiv.org/html/2601.14719v1) |
| Nearest bulk chemistry ground truth | Chandrayaan-3 APXS at 69.37 S: Al2O3 26.1 wt%, FeO+MgO 14.4 wt% | [ISRO APXS](https://www.isro.gov.in/Ch3_Alpha_Particle_X-ray_Spectrometer.html) |
| Thorium and KREEP | Concentrated in the nearside western maria; no south-polar concentration | [Lawrence et al. 1998](https://openpolar.no/Record/craaas:10.1126%2Fscience.281.5382.1484) |
| Helium-3 | About 4 ppb average; polar retention "not currently known"; METAL payload on Griffin-1 will measure it | [Crawford review](https://arxiv.org/pdf/1410.6865); [MB-PHASES] |
| Favourability products | Ice Favorability Index raster (USGS, 591 m); Coyan et al. 2025 prospectivity model for Mons Mouton | [USGS product](https://astrogeology.usgs.gov/search/map/moon_ice_favorability_index_south_pole_591mp); [USGS record](https://pubs.usgs.gov/publication/70266320) |

Against NASA's 2 wt% line only Cabeus has measured evidence above threshold, and every neutron value sits below it unless the ice is patchy or buried ([LWIMS]). Oxygen, metals and construction feedstock barely vary between south-polar sites, so they do not discriminate ([ISRU22]).

## "Possible bacteria" means terrestrial contamination, and every polar site is Category IIb

### Life on the Moon: status of each claim

| Question | Answer | Evidence level | Source |
|---|---|---|---|
| Indigenous life detected? | No. Quarantine testing of Apollo 11, 12 and 14 samples "revealed no evidence of life or hazard" | ESTABLISHED | [NTRS 20120000717](https://ntrs.nasa.gov/api/citations/20120000717/downloads/20120000717.pdf); [NTRS 20140005965](https://ntrs.nasa.gov/api/citations/20140005965/downloads/20140005965.pdf) |
| Conditions for microbial growth known? | No: "no evidence the Moon has liquid water or other ingredients needed for microbial growth and replication" | ESTABLISHED (authors' statement) | [SAXENA-NASA] |
| Did *Streptococcus mitis* survive 2.5 years on Surveyor 3? | Almost certainly not; attributed to contamination during 1970 handling | CONTESTED, now regarded as refuted | [Space.com, 2011](https://www.space.com/11536-moon-microbe-mystery-solved-apollo-12.html) |
| Can terrestrial microbes stay viable in shadowed south-polar terrain? | Yes per models: at least one Earth day to about seven days for cells and fungi; decades for spores inside PSRs | MODEL, no in-situ measurement | [SAXENA-NASA]; [Astrobiology.com on Moores 2025](https://astrobiology.com/2025/06/09/a-microbial-survival-model-for-the-permanently-shadowed-regions-of-the-moon-shows-long-term-survival-of-terrestrial-microbial-contamination/) |
| Can they grow or spread? | No evidence; "survival" in the 2026 study excludes growth | ESTABLISHED (study definition) | [SAXENA-NASA] |
| Did Beresheet's tardigrades survive the 2019 crash? | Unlikely; impact shock exceeded the measured limit of about 1.14 GPa | MODEL / laboratory | [CosmoQuest](https://cosmoquest.org/x/2021/05/tardigrades-designed-for-high-impact-collisions) |
| Apollo waste bags (96 bags, six equatorial sites) | Survival "highly improbable"; untested | SPECULATIVE | [BBC Science Focus](https://www.sciencefocus.com/space/why-is-there-poo-on-the-moon/) |
| Chang'e-4 cotton sprout (2019) | Grew only inside a pressurised, lit, watered canister; died at the first lunar night | ESTABLISHED | [Universe Today](https://universetoday.com/143614/chinas-lander-successfully-grew-some-cotton-plants-on-the-moon-fruit-flies-and-potatoes-didnt-fare-so-well/) |
| Amino acids in Apollo regolith | "Primarily terrestrial" contamination with a minor meteoritic share | ESTABLISHED for those samples | [Elsila et al. 2016](https://ael.gsfc.nasa.gov/sed/content/uploadFiles/publication_files/Elsila2016.pdf) |

| Survival model | Locations | Organisms | Key numbers | Source |
|---|---|---|---|---|
| Schuerger et al. 2019, Lunar Microbial Survival model | Sunlit surface | Spacecraft spores | Sunlit surfaces above 100 C; about -6 logs per 8 h at local noon; external surfaces unlikely to retain viable spores after one lunation | [DLR record](https://elib.dlr.de/126719/) |
| Moores et al. 2025 (York University) | **Shackleton** and **Faustini** PSRs | *Bacillus subtilis*-type spores | -0.0815 and -0.0683 logs per lunation; 30.0 and 30.8 years to one sterility assurance level (-12 logs); PSRs "one of the least biocidal environments in the solar system" | [Astrobiology.com](https://astrobiology.com/2025/06/09/a-microbial-survival-model-for-the-permanently-shadowed-regions-of-the-moon-shows-long-term-survival-of-terrestrial-microbial-contamination/); [PubMed](https://pubmed.ncbi.nlm.nih.gov/40415593/) |
| Saxena et al. 2026 (NASA Goddard / JSC, Science Advances, 19 Aug 2026) | **Nobile Rim, Connecting Ridge, de Gerlache Rim** | *Aspergillus niger*, *Bacillus subtilis*, *Staphylococcus aureus*, *Deinococcus radiodurans*, *Fusarium* species | Survival means alive at least one Earth day; *A. niger* up to seven days or more; niches range from a miles-wide crater floor to a boot print; robotic craft can be baked above 400 F, crews cannot | [SAXENA-NASA] |

The Shackleton and Faustini spore result belongs to Moores et al. (York University), not to the NASA Goddard paper, which studied three Artemis regions. NASA's stated implications are a baseline of human-introduced contaminants before surface science and the use of shaded regions as a "natural lab" ([SAXENA-NASA]). The National Academies judged organismal contamination the least concerning for lunar science, and NASA's planetary-protection office says crewed missions and biological payloads "are not a concern for PP compliance" at the Moon ([NASEM20]; [OPP-NASEM]). For site selection this is a contamination-persistence attribute, highest in and beside persistent shadow; it is not a life-potential score.

### Planetary protection: paperwork south of 79 S, no prohibition

| Category | Applies to | Propulsion volatiles reported | Whole-spacecraft organic inventory | Bioburden control | Source |
|---|---|---|---|---|---|
| II (lunar) | Orbiters, flybys | No | No | No | [STD8719] |
| IIa (lunar) | Landings outside "a PSR and the lunar poles" | Yes | No | No | [STD8719] |
| IIb (lunar) | Landing or surface operations "within a PSR and the lunar poles" | Yes | Yes (items above 1.0 kg) | No | [STD8719] |

NASA-STD-8719.27 section 4.2.2.1.1 defines the PSR and polar zone as "locations south of 79 S latitude and north of 86 N latitude", and section 4.4.1 excludes lunar missions from bioburden management ([STD8719]). There are "no limits on the types or quantities of organics", and an inventory is also required if the probability of landing in a IIb region within 15 years exceeds 1 x 10^-3 ([OPP-TRISMAC]). Every site in this report poleward of 80 S is therefore Category IIb **[derived from the rule]**.

| Date | Document | Content | Source |
|---|---|---|---|
| 2008 | COSPAR | Moon raised to Category II for polar volatile deposits | [OPP-TRISMAC] |
| Jul 2020 | NASA NID 8715.128 | Category II-L for PSRs (south of 79 S, north of 86 N) and Apollo and historic sites | [NASEM briefing](https://www.nationalacademies.org/cdn/materials/9fba0ba4-582c-446f-aa03-0894b84a3620) |
| 3 Jun 2021 | COSPAR policy update | Categories IIa and IIb; IIa covers about 99 % of the surface | [NASA SMA 2021](https://sma.nasa.gov/news/articles/newsitem/2021/08/31/cospar-updates-planetary-protection-policy-for-lunar-missions) |
| 24 Sep 2021 | NASA NPR 8715.24 | Robotic procedural requirements; being expanded to crewed missions | [NODIS](https://nodis3.gsfc.nasa.gov/displayDir.cfm?t=NPR&c=8715&s=24); [OPP-NASEM] |
| 30 Aug 2022 | NASA-STD-8719.27 | Technical requirements | [STD8719] |
| 29 May 2025 | NASA lunar reporting forms | Organic inventory and end-of-mission forms | [NASA SMA 2025](https://sma.nasa.gov/news/articles/newsitem/2025/05/29/new-lunar-reporting-forms-now-available-to-fulfill-reporting-requirements) |
| Nov 2025 / Jan 2026 | COSPAR policy, Space Research Today 224 | New version; lunar clauses unverified | [SRT 224 editorial](https://cosparhq.cnes.fr/assets/uploads/2026/01/SRT_224_Editorial_PPP-Nov-2025.pdf) |

Lander exhaust is the practical contamination pathway. Prem et al. 2020 modelled a 1,200 kg lander: exhaust water spreads globally within hours and roughly 20 % ultimately freezes out near the poles (MODEL) ([Scientific American](https://www.scientificamerican.com/article/will-increasing-traffic-to-the-moon-contaminate-its-precious-ice/)). The National Academies found that most contaminants should not penetrate more than a few centimetres ([NASEM20]). Artemis Accords section 11 creates temporary "safety zones" and section 9 protects heritage sites; no numerical radius exists ([NASA Artemis Accords](https://www.nasa.gov/artemis-accords/)). Protected "Sites of Extraordinary Scientific Importance", including polar cold traps, remain proposals ([IAU paper to COPUOS](https://www.unoosa.org/res/oosadoc/data/documents/2024/aac_105c_12024crp/aac_105c_12024crp_14_0_html/AC105_C1_2024_CRP14E.pdf)).

## Science value clusters at SPA-rim massifs and old PSR craters; hazards cluster at scarps and steep walls

### Science objectives and dated features

The Artemis III Science Definition Team set seven objectives: planetary processes; character and origin of polar volatiles; impact history of the Earth-Moon system; record of the ancient Sun; observing from a unique location; experimental science; and exploration-risk mitigation ([SDT report](https://science.nasa.gov/wp-content/uploads/2023/07/artemis-iii-science-definition-report-12042020c.pdf); list taken from a [secondary summary](https://www.universetoday.com/articles/here-are-nasas-science-priorities-for-the-artemis-missions)). Sample-mass figures differ between sources: a NASA requirement of at least 35 kg with a 100 kg goal, and team scenarios of 25 kg and 83 kg ([SpaceNews](https://spacenews.com/?p=108995)).

Crater ages and slopes from Tye et al. 2015 (LOLA 20 m; 1-sigma counting errors; pre-Nectarian ages are "particularly uncertain") ([TYE15]):

| Crater | Formation model age | Period | Floor retention age | Mean slope floor / wall / ejecta (deg) |
|---|---|---|---|---|
| Haworth | 4.18 +/- 0.02 Ga | pre-Nectarian | 3.55 Ga | 5.1 / 15.1 / 9.7 |
| Shoemaker | 4.15 +/- 0.02 Ga | pre-Nectarian | 3.46 Ga | 5.0 / 15.5 / 8.6 |
| Faustini | 4.10 +/- 0.03 Ga | pre-Nectarian | 3.50 Ga | 4.7 / 15.4 / 7.2 |
| Shackleton | 3.51 +0.05/-0.08 Ga (rim) | Late Imbrian | 2.63 Ga (slope-limited) | 9.4 / 28.6 / 12.3 |

| Science fact | Evidence level | Source |
|---|---|---|
| South Pole-Aitken basin dated at 4247 +/- 5 Ma from Chang'e-6 norite; landing site -41.625, -153.978 | ESTABLISHED measurement; attribution is the authors' interpretation | [Su et al. 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12086667/) |
| Mons Mouton "possibly" and Malapert "thought to be" SPA rim remnants | Interpretation, unsampled | [WP-MOUTON]; [LROC 1294](https://lroc.im-ldi.com/posts/1294) |
| Near Shackleton rim and Connecting Ridge: 86,896 boulders, 3,556 rocky craters, 7,553 outcrops mapped; targets on slopes below 15 deg | ESTABLISHED | [AAS Nova](https://aasnova.org/2023/04/14/planning-for-touchdown-new-maps-of-the-moons-south-pole/) |
| 1:300,000 geologic map of the south circumpolar region with about 200 dated units | ESTABLISHED (map) | [Zenodo 7780129](https://zenodo.org/record/7780129) |
| "Earth's attic": about 7 ppm terrestrial material in regolith, not location-specific | MODEL | [arXiv:astro-ph/0207316](https://arxiv.org/abs/astro-ph/0207316) |
| No catalogued pit poleward of 80 S; southernmost is Schomberger A 1 at -78.0579, 25.3441 | ESTABLISHED for the catalogue | [Wikipedia list](https://en.wikipedia.org/wiki/List_of_lunar_pits) **[secondary]** |
| Artemis III deployed instruments (selected Mar 2024): LEMS seismometer, LEAF, LDA; manifest after the replan unknown | ESTABLISHED selection | [Military+Aerospace Electronics](https://www.militaryaerospace.com/home/article/55000283/nasa-announces-first-lunar-instruments-for-artemis-astronaut-deployment) |
| Strongest Apollo shallow moonquake (13 Mar 1973, mb about 5-5.6) had an original epicentre near -84, 134 | ESTABLISHED record, location uncertain | [WATTERS24] |

### Hazards with site-specific data

Seismic and slope-stability data from Watters et al. 2024 ([WATTERS24]). Scarps are ESTABLISHED; the link to the 1973 moonquake and the shaking and landslide maps are MODEL.

| Item | Value |
|---|---|
| Lobate thrust scarps within 150 km of the pole | 15 |
| de Gerlache scarp | -88.02, -59.1 (300.9 E); about 4 km long; relief 60-80 m; lies within the de Gerlache Rim 2 region |
| Shoemaker scarp | -86.25, 54.55; relief about 80 m; about 30 km from Nobile Rim 1 |
| Wiechert cluster | -86.7, 146.7; at least 5 scarps |
| Ibn Bajja cluster | -86.6, -174.7 (185.3 E); 3 scarps |
| Newton E scarp | -80.02, -32.65 |
| Modelled event | Mw about 5.3; strong to moderate shaking to at least 40 km |
| Landslide trigger | About 2.3 % of lunar gravity for a 1 m slab on slopes above 30 deg at low cohesion |
| Susceptible areas (cohesion 0.1 kPa) | Large parts of Shackleton's interior walls and northwest rim, parts of the Connecting Ridge near the rim, interior walls in Nobile Rim 1, a PSR north of de Gerlache Rim 2 |
| Observational check | Recent boulder falls on Shackleton's wall (ShadowCam); no recent landslides where predicted |

| Hazard | Data | Evidence level | Source |
|---|---|---|---|
| Wall slopes | Shackleton walls 28.6 +/- 6.1 deg; large PSR crater walls about 15 deg | ESTABLISHED | [TYE15] |
| Rocks | Rocks above about 1 m cover about 1 % of area, locally 10-20 %; highland regolith 10-15 m deep | ESTABLISHED (design environment) | [DSNE] |
| PSR regolith porosity | About 70 % inferred from far-UV albedo against about 40 % elsewhere | CONTESTED | [The Space Resource](https://www.thespaceresource.com/news/2019/4/surface-strength-of-psrs) |
| Plume-surface interaction | "Apollo flight experience cannot be extrapolated to upcoming large Human Landing Systems"; no validated crater or ejecta numbers for Starship or Blue Moon | ESTABLISHED gap | [NTRS 20260004959](https://ntrs.nasa.gov/api/citations/20260004959/downloads/NASAPSI_IPPW2026_v0.pdf) |
| Dust lofting | Electrostatic "fountain" for grains below 0.1 micron | MODEL, open question | [NTRS 20050175993](https://ntrs.nasa.gov/citations/20050175993) |
| Radiation | Chang'e-4: about 1,369 microsieverts per day, 13.2 +/- 1 microgray per hour in silicon | ESTABLISHED (far side, solar minimum) | [Sci.News](https://www.sci.news/space/radiation-dose-rates-lunar-surface-08893.html) |
| Topographic shielding | Solar-particle dose down at least 40 % inside a 20 km crater like Shackleton, at least 10 % just outside the rim | MODEL | [Phipps et al. 2021](https://ntrs.nasa.gov/api/citations/20210021039/downloads/Phipps_NESF_2021_abstract.pdf) |
| Micrometeoroids | NASA MEM 3 for primaries; ejecta model MeMoSeE predicts flux 2-3 orders of magnitude below SP-8013 | ESTABLISHED models | [DSNE] |
| Demonstrated outcome | IM-2 on Mons Mouton: tipped, in a shadowed crater, dust-coated arrays | ESTABLISHED | [WP-MOUTON] **[secondary]** |

Region-level hazard flags follow directly **[derived]**: de Gerlache Rim 2 contains a young scarp, Nobile Rim 1 lies about 30 km from another, and the Shackleton rim combines the steepest walls with the best crater-wall shielding and PSR access. Recurrence of Mw 5-class events is not quantified in the sources.

## Datasets and services: what exists, in which format, and what was broken on 14 November 2026

This section lists only items beyond the kernels, the 20 m DEM and the illumination averages already inventoried in the repository's data guide.

### Terrain and imagery

| Product | Content | Resolution and coverage | URL | Status | Citation |
|---|---|---|---|---|---|
| PGDA product 78, per-site LOLA DEMs | Height, slope, height error, slope error, 100 clones, RoI shapefiles for 27 named sites | 5 m/px; median height error 0.30-0.50 m, slope error 1.5-2.5 deg; about 90 % of pixels interpolated | `https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/{Site}/{Site}_final_adj_5mpp_{surf,ldec,slp,toterr,slperr}.tif`; [PGDA78] | V for Site01, P for others | Barker et al. 2021, doi:10.1016/j.pss.2020.105119 |
| PGDA product 81, 87-90 S mosaic | `ldem_87s_5mpp.tif` (3,465,285,714 bytes), slope (4.9 GB), counts (140 MB) | 5 m/px, track-adjusted | [PGDA81](https://pgda.gsfc.nasa.gov/products/81) | V / L | Barker et al. 2021 |
| PGDA product 90 suite | Height, error, effective resolution, slope, slope error, roughness at 100-1600 m baselines, PSR polygons | 10-240 m/px; 60/75/80/83-90 S | `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/{FILENAME}`; [PGDA90] | V for `LDEM_80S_20MPP_ADJ.TIF` | Barker et al. 2023, doi:10.3847/PSJ/acf3e1 |
| PGDA PSR polygons | `LPSR_80S_20MPP_ADJ` (506,349 PSRs) and `..._1km2` (1,531 PSRs above 1 km2; SHP 20,743,300 bytes) | 20 m/px | [PGDA90] | L / V | Barker et al. 2023 |
| PGDA product 104 | Shape-from-shading DEMs for the 13 regions of 2022 | 5 m/px | [PGDA104]; [Zenodo 17954508](https://doi.org/10.5281/zenodo.17954508) | V | Bertone et al. 2026, doi:10.3847/PSJ/ae5b70 |
| PDS LOLA "LDEM" polar grids (2017, pre-adjustment) | 19 south-pole grids from `ldem_875s_5m` to `ldem_45s_400m`; int16, height = DN x 0.5 m | 5-400 m/px | [PDS listing](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/) | L | LOLA PDS |
| LROC NAC south-pole mosaics | `NAC_POLE_SOUTH` (85.5-90 S) and controlled `NAC_POLE_SOUTH_CM_AVG` (84-90 S) | 1 m/px; about 36 GB each on Trek | [LROC RDR](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_POLE_SOUTH_CM_AVG) | V | LROC |
| LROC PSR mosaic with LOLA PSR shapefile | `NAC_POLE_PSR_SOUTH.ZIP` (1,121,858 bytes); PSRs above 5 km2 | 10 m/px, 80-90 S | [LROC PDS](https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/BROWSE/NAC_POLE/NAC_POLE_PSR_SOUTH/NAC_POLE_PSR_SOUTH.ZIP) | V | LROC |
| ShadowCam DTMs | 11 south-polar directories including `shackleton1_p896s1181`, `lcross1_p847s3110`, `nobile-mouton1_p855s0321` | 6 m DTM, 1.8 m ortho | [ShadowCam PDS](https://pds.shadowcam.im-ldi.com/derived/dtm/) | V | ShadowCam |
| Kaguya TC DTMs via USGS STAC | 19,646 south-polar items, CC0-1.0 | About 30 m | [USGS STAC](https://stac.astrogeology.usgs.gov/api/collections) | V | USGS |

The older PDS grids predate the track adjustment; PGDA calls the adjusted models "substantially more realistic" ([PGDA78]). SLDEM2015 covers only 60 S to 60 N and does not reach the pole ([PGDA 54](https://pgda.gsfc.nasa.gov/products/54)).

### Illumination, thermal and volatile layers

| Product | Content | URL | Status |
|---|---|---|---|
| LOLA 18.6-year averages, 2016 release | Solar illumination, Earth visibility, PSR mask at 240, 120 and 60 m/px; sky visibility at 240 m | [PGDA69]; non-COG `.TIF` at `https://pgda.gsfc.nasa.gov/data/MoonIllumination/` | V for `AVGVISIB_85S_060M_201608.TIF` (33,994,464 bytes); L for the rest |
| Same, COG variants | Every `*_COG.TIF` link on the PGDA page | [PGDA69] | **X**: returned a 404 page on 14 Nov 2026 |
| LROC WAC empirical illumination | `WAC_POLE_ILL_PCT_SOUTH_100M` and `..._TWI_...`; 3,807 images over one year; 88-90 S | [LROC PDS](https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/WAC_POLE/WAC_POLE_ILL_PCT_SOUTH/WAC_POLE_ILL_PCT_SOUTH_100M.IMG) | V (5,904,896 bytes each) |
| NASA SVS 4930 | Rendered lighting within 2 deg of the pole, 2-hour steps, 2023-2030, 35,064 frames; not georeferenced | [SVS 4930](https://svs.gsfc.nasa.gov/4930) | V |
| NASA SVS 5027 | Same to 80 S, 2025-2028, 17,532 frames | [SVS 5027](https://svs.gsfc.nasa.gov/5027) | V |
| Diviner Polar Resource Product | `dlre_prp_south.tab`: average and maximum temperature and ice depth per mesh triangle; 604,800,210 bytes | [PDS](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.tab) | V |
| Trek Diviner seasonal layers | `polar_south_80_{summer,winter}_{min,avg,max}` and classes below 50 K, 50-100 K, above 100 K, maximum below 110 K; 240 m | `https://trek.nasa.gov/tiles/Moon/SP/{label}`; [TREK-SEARCH] | L |
| Trek ice stability at depth | `sp_ice_depth_new_240m.mat_today_27-Oct-2016` and a paleo-axis variant; 240 m | [TREK-SEARCH] | L |
| M3 ice exposures | `SP_IceLoc_280m` feature service (Li et al. 2018) | [Trek service](https://trek.nasa.gov/moon/trekarcgis/rest/services/SP_IceLoc_280m/MapServer/0) | L |
| Lunar Prospector WEH | `sp_weh_5km_adapt.map`, 5 km | [TREK-SEARCH] | L |
| LAMP polar maps | `LAMP_80s_240mpp_*` albedo, brightness, ratio; 240 m, 80-90 S | [PDS Imaging](https://pds-imaging.jpl.nasa.gov/data/lro/lamp/gdr/LROLAM_2001/DATA/ALBEDO/) | V |
| Trek PSR polygons | `PSR_SP` feature service | [Trek service](https://trek.nasa.gov/moon/trekarcgis/rest/services/PSR_SP/MapServer/0) | L |
| Polar lobate scarps | `POLAR_SCARP_LOCATIONS_180.ZIP` (1,361,971 bytes) | [LROC PDS](https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/SHAPEFILE/POLAR_SCARP_LOCATIONS/POLAR_SCARP_LOCATIONS_180.ZIP) | V |
| Spacecraft and impact sites | `ANTHROPOGENIC_OBJECTS_180.ZIP` (1,569,089 bytes) | [LROC PDS](https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/SHAPEFILE/ANTHROPOGENIC_OBJECTS/ANTHROPOGENIC_OBJECTS_180.ZIP) | V |
| IAU nomenclature centre points | Shapefile ZIP (23,845,070 bytes) | [USGS](https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.zip) | V |

No NASA product gives a per-pixel illumination time series as numeric georeferenced data; PGDA invites users to "contact us" for a given duration at a given site ([PGDA69]).

### Services, cross-origin access and frames

| Service | Endpoint | CORS header observed | Note |
|---|---|---|---|
| Moon Trek catalogue | [TREK-SEARCH] | `*` | 569 polar products; WMTS at `https://trek.nasa.gov/tiles/Moon/SP/{productLabel}` |
| Trek ImageServer | [5 m DEM service](https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_SPole875_5mp_v04/ImageServer?f=json) | `*` | Point `identify` at (10000, -5000) returned -2814.5 m |
| PDS ODE REST v2.1.6 | [ODE REST](https://oderest.rsl.wustl.edu/) | `*` | Product search by instrument and bounding box |
| USGS STAC | [USGS STAC](https://stac.astrogeology.usgs.gov/api/collections) | `*` | CC0-1.0 |
| LROC PDS file host | `pds.lroc.im-ldi.com` | `*` | Range requests work |
| PGDA, PDS Geosciences, imbrium, NAIF | static files | none | Range requests work |
| JPL Horizons API | [Horizons docs](https://ssd-api.jpl.nasa.gov/doc/horizons.html) | none | Surface observer via `CENTER='coord@301'` |

A Horizons test for a site at 0 E, -89.5 on 1 Jan 2027 returned a header reading "Center pole/equ: MEAN_ME (high precision)" with radii of 1737.4 km, and Sun elevation 0.953942 falling to 0.834769 degrees over 24 hours ([Horizons example call](https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%2710%27&OBJ_DATA=NO&MAKE_EPHEM=YES&EPHEM_TYPE=OBSERVER&CENTER=%27coord@301%27&COORD_TYPE=GEODETIC&SITE_COORD=%270,-89.5,0%27&START_TIME=%272027-01-01%27&STOP_TIME=%272027-01-02%27&STEP_SIZE=%276h%27&QUANTITIES=%274%27)). Horizons gives elevation above the reference sphere only, so terrain masking still has to come from a DEM.

All south-polar NASA rasters share one projection: polar stereographic, latitude of origin -90, central meridian 0, scale 1, sphere of 1,737,400 m, whose current code is `IAU_2015:30135` ([spatialreference.org](https://spatialreference.org/ref/iau_2015/30135/proj4.txt)). Moon Trek labels the same projection `IAU2000:30120`, while `IAU_2015:30120` is a sinusoidal system, so the Trek code must not be passed to an IAU_2015-aware library ([Trek config](https://trek.nasa.gov/tiles/apidoc/config/config.json); [spatialreference.org](https://spatialreference.org/ref/iau_2015/30120/proj4.txt)). Mean-Earth and Principal-Axis frames differ by about 875 m ([moon_de440_250416.tf](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf)). Explicit licences were seen only for USGS STAC (CC0-1.0); PGDA asks for citation, and LOLA illumination extras "are not supported by the PDS or the LOLA Science Team" ([readme](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/readme_illumination_2016.txt)).

## Gaps and unverified items

### Values in this report that are derived or rest on weak sources

| Item | Status | What would settle it |
|---|---|---|
| Solstice and equinox dates 2024-2040 | **[derived]**, two derivations agreeing within two days; textbook constants unsourced | SPICE or Horizons sub-solar latitude |
| Phase relation between Earth-up fortnight and Sun azimuth; eclipse clustering at equinoxes; nine repeating Sun azimuths in NRHO | **[derived]**, not stated by NASA | Numerical check against ephemerides |
| Trek region centre latitudes and longitudes | **[derived]** from NASA polygon extents | None needed if labelled as derived |
| Mapping of LROC mosaic names to the 2024 region names | Researchers' reading of product titles | A NASA boundary file for the nine regions |
| NASA slide values from NTRS 20230005904 (masks of 5 % and 25 %, 2-7 deg, "August by 2030") | Decoded from an obfuscated PDF text layer; the same figures appear in [HLS-OV] | Visual check of the slides |
| Barker 2021 per-RoI table | Transcribed by one researcher, not recoverable by another | PGDA RoI shapefiles ([PGDA78]) |
| Speyerer and Robinson 94 % and 43 h | **[secondary]** (Wikipedia) | The 2013 paper |
| Wueller 2025 and 2026 figures; Malapert and Leibnitz beta 100 % Earth visibility; under 60 % at Shackleton and de Gerlache | **[excerpt]** | Full texts and the Zenodo archive |
| Crater centre coordinates other than Cabeus and Amundsen | **[secondary]** (Wikipedia infoboxes) | IAU Gazetteer shapefile |
| Chang'e-7 target -88.8, 123.4; IM-1 position | **[secondary]** in the notes; the repository holds a NASA source for IM-1 | CNSA publication |
| New Glenn pad explosion in May 2026 | Reported by a CRS brief and press; one researcher could not verify | Blue Origin or NASA statement |
| Blue Moon polar orbit of 100 x 6,500 km; Artemis III orbit of 430 km at 33 deg | **[secondary]** (Wikipedia) | NASA mission documents |
| Mazarico 2011 PSR totals (16,055 and 12,866 km2) | Cited by one note, unconfirmed by another | The paper |
| Diviner "about 25 K" coldest value | Press attribution to a north-polar crater; not retrieved from a primary source | Paige et al. 2010 |
| Location of the 13 boulder tracks in Sargeant et al. 2020 | Notes disagree | The paper |
| SDT objectives list and sample-mass figures | Taken from a secondary list; the report PDF could not be opened | The SDT report |

### Data that NASA has not published or that could not be retrieved

| Theme | Gap |
|---|---|
| Programme | No November 2026 NASA statement with a specific Artemis III or IV launch date; Artemis IV and V crews, stay length in days and upper stage unconfirmed by a primary source; OIG report IG-26-004 full text and any 2026 GAO report not read |
| New architecture | No orbit altitude, period or plane for the low lunar orbit or the polar ellipse; no landing or ascent cadence; no lander loiter limits; no Earth mask angle; no statement on whether direct-to-Earth is required during powered descent |
| Regions | No NASA centre coordinates or boundary files for the 13 or the 9 regions beyond the 2022 Trek boxes; no coordinates at all for Slater Plain or the 2024 "Mons Mouton" region; no per-region scores, slopes, illumination percentages or launch-window calendars; no Artemis IV region list; the four NASEM non-polar sites are not named |
| Base | No coordinates for the Moon Base I target; no quantitative base-site thresholds; Moon Base User's Guide, NTRS 20260008640 and the Architecture Definition Document not read; whether the first crewed landing must be near the base site is unstated |
| Missions | No published landing coordinates for Endurance, Griffin-1, the 2027 VIPER delivery, IM-4, IM-5, PROMISE or Chang'e-8; no confirmed return-to-flight date for New Glenn; Chang'e-7's 2027 launch period unconfirmed |
| Lighting | No published "usable days per month" for any Artemis region; no NASA landing-opportunity calendar for 2027-2030; no numeric Sun-elevation or Sun-azimuth descent limit; Mazarico 2011 Table 3 (about 50 ranked sites with Earth visibility) not opened; no illumination statistics for Nobile rim, Haworth, Cabeus-area ridges or de Gerlache-Kocher; no 100 m mast figures; Sun elevation at touchdown for IM-1, IM-2 and Chandrayaan-3 not found |
| Earth visibility and relays | No per-site Earth-visibility percentages for Shackleton rim, Connecting Ridge, de Gerlache rim, Nobile rim or Haworth from a primary source (they exist in the PGDA Earth rasters); relay satellites actually in orbit in November 2026 unconfirmed |
| Thermal | No Diviner summer-maximum and winter-minimum values for named features; no lander-level thermal environment specification read (the Lunar Surface Data Book was too large to fetch) |
| Ice | ShadowCam 2026 paper read only through press releases (PSR names and number of candidate spots unknown); Brown et al. 2022 per-PSR scores and Cannon and Britt 2020 inputs paywalled; no quantitative data for Cabeus B, de Gerlache, Slater, Idel'son L or Wiechert beyond PSR area; no in-situ geotechnical measurement of PSR regolith; NTRS 20250008823 (per-PSR planning metrics) not extractable |
| Astrobiology and protection | Saxena et al. 2026 paper itself not retrieved, so per-site niche areas and UV doses are missing; COSPAR policy texts (2021, 2024, and the 2025/2026 version) could not be opened; no stand-off distance from PSRs and no numerical safety-zone radius exists |
| Hazards | No site-by-site boulder, crater or slope tables for the nine regions; no validated plume crater or ejecta predictions for Starship or Blue Moon; bearing-capacity values in kPa not retrieved; moonquake recurrence unquantified; annual south-pole dose and site sky-view shielding factors not found |
| Datasets | No official polygon layer for the nine regions; PGDA COG links broken; scaling factors of the illumination IMG labels not read; no numeric per-site illumination time series; LEND gridded hydrogen rasters not located; Trek lighting and sun-angle tool endpoints and QuickMap API not located; no documented rate limits for ODE, Trek, Horizons, STAC or SVS; JAXA, CNSA, KARI and ISRO licence texts not retrieved; NASA's general data-usage policy page not fetched by the researchers |

## Where this research contradicts or updates the repository reference docs

| Repository file | What the file says | What the new research says | Source |
|---|---|---|---|
| `docs/reference/sources.md` | The 2022 release names regions with "no coordinates on the page"; coordinates come only from LROC mosaic centres (Collins et al.) | NASA Moon Trek serves official polygons for the 13 regions; derived box centres agree with the Collins centres to within about a degree of longitude | [TREK-A3] |
| `docs/reference/sources.md` | Each region is approximately 15 by 15 km | The Trek boxes measure 16, 20, 21 and 29.8 km | [TREK-A3] |
| `docs/reference/sources.md` | "(ours)" the candidate-region set remains the reference list for landings beginning with Artemis IV | NASA states the nine are specific to Artemis III and do not affect site selection for Artemis IV and later; an Artemis IV landing-site workshop took place on 10 Sep 2025 | [LPSC26]; [LEAG25] |
| `docs/reference/sources.md`, `scripts/sites.csv`, `app/public/data/sites.json` | Nine-region update listed without coordinates; no rows for Peak near Cabeus B, Mons Mouton Plateau, Mons Mouton or Slater Plain | LROC mosaic centres exist for Peak near Cabeus B (-83.6, -68.8) and Mons Mouton Plateau (-84.3, 30.6); none for Slater Plain | [LROC RDR](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_CABEUSPKLO2); [LROC RDR](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_MOUTNPLTLO1) |
| `docs/reference/sources.md` | Griffin-1: "planned launch to the Moon in late 2026", no named site | Listing moved to 31 Jan 2027; target described as the Nobile crater region | [Lunar Week tracker](https://spacenexus.us/moon/weekly/week-of-2026-11-02) **[secondary]** |
| `docs/reference/sources.md` | Blue Moon MK1: no firm launch date | NET Q1 2027 per listings, or no earlier than the second half of 2027 per a newsletter; sources conflict | [WP-BMP] **[secondary]**; [MM277] |
| `docs/reference/sources.md` | Chang'e-7 and IM-3 "not verified" | Chang'e-7 missed its August 2026 window and is now 2027 at the earliest, unofficial target -88.8, 123.4; IM-3 is early 2027 | [SpaceNews, Aug 2026](https://spacenews.com/china-delays-change-7-lunar-south-pole-landing-mission-launch/); [WP-CLPS] **[secondary]** |
| `docs/reference/sources.md` | "NASA has awarded 17 lunar deliveries to five CLPS vendors" | Other sources count 14 CLPS 1.0 missions to five vendors with four launched, and report eight CLPS 2.0 providers selected on 7 Nov 2026; the counts conflict | [ASTRO-Jun26]; [WP-CLPS] **[secondary]**; [SpaceQ, Nov 2026](https://spaceq.ca/?p=53144) |
| `docs/reference/sources.md`, `scripts/sites.csv` (viper-mons-mouton) | Mission-area centre 31.6218 E, 85.42088 S (Beyer et al. 2025) | NASA's 2021 plan gave a planned landing location of -85.449452, 31.064135; the two are different quantities, and the 2027 site is unconfirmed | [VIPER-21] |
| `docs/reference/sources.md`, `scripts/sites.csv` (im-2-intended) | Intended site -84.78, 29.13; NASA "more than 400 m" from it | NASA slides give a finer target of -84.7754, 29.1280 and about 500 m; press figures of about 250 m and 400 m also circulate; landing time 17:28 or 17:31 UTC | [MSOLO26]; [collectSPACE](https://www.collectspace.com/news/news-030625a-intuitivie-machines-im2-athena-moon-landing.html) |
| `scripts/sites.csv` (malapert-site23) | -85.9948, -0.23578 from the Lunar Surface Data Book | Matches the derived centre of the Trek "Malapert Massif" box (-85.995, -0.236), which corroborates rather than contradicts | [TREK-A3] |
| `scripts/sites.csv` (shackleton-rim-site04) | -89.7668, -171.87 | The illumination statistics in this report attach to other rim points (for example -89.7849, 203.97 E and -89.6866, 197.19 E), so they cannot be copied to the Site04 coordinates | [GLAESER18] |
| `docs/reference/primer.md` | Open item: find out which lunar frame Horizons uses for a surface observer | A Horizons call returned "Center pole/equ: MEAN_ME (high precision)", radii 1737.4 km | [Horizons docs](https://ssd-api.jpl.nasa.gov/doc/horizons.html) |
| `docs/reference/primer.md` | Horizon mask with 360 directions out to 100-150 km (team design choice) | Barker et al. 2021 use 720 sight lines at 0.5 deg; far-field horizons lie 50-200 km away; NASA says mountains up to 120 km away cast shadows | [BARKER21]; [OCHMO] |
| `docs/reference/primer.md` | Libration in latitude cycle of about 27.12 days (NASA SVS) | The research notes use a 27.21-day draconic month from unsourced textbook values; the primer's sourced figure stands until checked | this report, section on Earth visibility |
| `docs/reference/data-guide.md` | PGDA product 69 offers cloud-optimised GeoTIFFs | Every `*_COG.TIF` link returned a 404 page on 14 Nov 2026; the plain `.TIF` files work | [PGDA69] |
| `docs/reference/data-guide.md`, `docs/reference/data-sources.md` | "The canonical 5 m files live in the PDS LOLA archive"; `ldem_875s_5m.img` (PDS V2.0) was downloaded | Track-adjusted 5 m products exist at PGDA (87-90 S mosaic and 27 site DEMs with error maps); the PDS grid dates from 2017 and predates the adjustment; it also stops at 87.5 S, so Malapert, Mons Mouton, Nobile and Haworth lie outside it | [PGDA78]; [PGDA81](https://pgda.gsfc.nasa.gov/products/81) |
| `docs/reference/data-sources.md` | Illumination files downloaded from `.../extras/illumination/release_2016/img/` | The research notes list the base path without `release_2016`; the repository path was checksum-verified, so the notes' path is probably abbreviated | [PDS readme](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/readme_illumination_2016.txt) |
| `docs/reference/data-guide.md` | Frame kernel `moon_de440_250416.tf` | One research note names `moon_de440_220930.tf` from an older NAIF readme; the NAIF listing verified on 14 Nov 2026 shows `moon_de440_250416.tf`, so the repository choice is current | [moon_de440_250416.tf](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf) |
| `docs/reference/lunar-interest-points.md` | Water ice row cites LEND's "widespread" deposits | ShadowCam (March 2026) found no widespread surface ice above 20-30 wt%, and LEND's spatial resolution is disputed | [SHADOWCAM26]; [LWIMS] |
| `docs/reference/lunar-interest-points.md` | Other volatiles: "hydrogen, ammonia and methane" at Cabeus | Full LCROSS table adds H2S, SO2, C2H4, CO2, CH3OH and OH with relative abundances | [COLAPRETE10] |
| `docs/reference/lunar-interest-points.md` | Schrodinger basin is the Farside Seismic Suite target | The CLPS delivery to Schrodinger was reported cancelled in July 2026, so the suite's status is unconfirmed | [WP-CLPS] **[secondary]** |
| `docs/reference/lunar-interest-points.md` | Pits and possible caves as a category | No catalogued pit lies poleward of 80 S | [Wikipedia list](https://en.wikipedia.org/wiki/List_of_lunar_pits) **[secondary]** |
| `docs/reference/lunar-interest-points.md` | Radio astronomy cites LuSEE-Night | Its carrier, Blue Ghost Mission 2, is now listed for early 2027 | [WP-CLPS] **[secondary]** |
| `app/public/data/periods.json` (malapert-2028-01, 9-15 Jan 2028) | "team candidate period" | A partial lunar eclipse falls inside it: 12 Jan 2028, 04:14 TD, umbral magnitude 0.066, 56 minutes | [LE2021] |
| `app/public/data/periods.json` (shackleton-2027-08, 16-29 Aug 2027) | "team candidate period" | A penumbral eclipse falls on 17 Aug 2027 (no umbral phase); the period starts about two weeks after the derived equinox of 4 Aug 2027 and ten weeks before the derived summer solstice of 30 Oct 2027 **[derived]** | [LE2021] |
| `app/public/data/periods.json` (now, 14-28 Nov 2026; malapert-2026-12) | Demo and candidate periods | The demo period contains the derived summer solstice of 16-17 Nov 2026; the December period lies about five weeks after it **[derived]** | this report, solstice table |

## Conclusion

The research separates what is stable from what moved in 2026. Terrain, ephemerides, the 6-degree band, the slope and accuracy limits, the eclipse list and the Orion rules are stable. Opportunity counts, stay lengths and the nine-region list are tied to a design NASA has retired, and NASA has not yet replaced them with numbers. A site-and-window calculation therefore stands on its own computed lighting and Earth visibility, with every NASA cadence figure labelled as legacy.

Three findings change how the data should be read. First, the 2028 target date interacts with the lunar season: by the derived dates an early-2028 landing would meet the poor half of the cycle, a late-2028 landing the good half, and a total eclipse on 31 Dec 2028 follows that summer. Second, ice evidence and access pull in opposite directions, so the best-endowed craters (Shoemaker, Faustini, Cabeus) are the hardest to reach, and Mons Mouton is the only sector where NASA plans ground truth across all ice-stability classes before about 2028. Third, the sortie list moved away from the pole in 2024 while the first Moon Base robotic landing goes back to the Connecting Ridge, which suggests NASA treats safe first landings and long-term infrastructure as different siting problems. The solstice table, the region coordinates and the legacy cadence numbers are the items most in need of verification before anyone relies on them.

## Source key

| Tag | Document |
|---|---|
| [REL22] / [REL24] | NASA release 22-089 (19 Aug 2022) / NASA release 24-136 (28 Oct 2024) |
| [NASA-Oct26] | NASA, "NASA, Partners Accelerate Lander Development for 2028 Moon Missions", 23 Oct 2026 |
| [LPSC26] | George, Rubio, Lawrence, Curell, "Artemis III Site Selection Update", LPSC 2026 abstract, NTRS 20250011660 |
| [HLS-OV] / [PLATTE23] | "Artemis Human Landing System Overview", NTRS 20250009323 / NASA Artemis overview deck, NTRS 20230005904 |
| [IAC22] / [IAC25] | Merancy et al., "Artemis Lunar Mission Availability & Design", NTRS 20220012445 / Creech et al., IAC-25-B3.1.7 |
| [WP-SITE] / [WP-POLE] | NASA white papers "Lunar Site Selection" (2023) / "Why Artemis Will Focus on the Lunar South Polar Region" (2022) |
| [NRHO-WS] / [LEE19] | Merancy, "How: NRHO - The Artemis Orbit" (2023) / Lee, NRHO reference trajectory white paper, NTRS 20190030294 |
| [HLS-MD] / [AAS25] / [LEAG25] | Mahajan and Condon, HLS mission design, NTRS 20230002566 / Prado Pino and Condon, AAS 25-205 / "NASA Artemis Updates", LEAG 2025 |
| [A1-AVAIL] | NASA, "Artemis I Mission Availability" |
| [MB-PDF] / [MB-PAGE] / [MB-PHASES] | NASA "Building the Moon Base" fact sheet / Moon Base reference page / Moon Base Phases page |
| [OIG26] / [REG-OIG] | NASA OIG, 10 Mar 2026 / The Register coverage |
| [SPOL-Oct26] / [PAYLOAD-Oct26] / [ASTRO-Jun26] / [MM277] | SpacePolicyOnline, Oct 2026 / Payload, 23 Oct 2026 / Astronomy.com, 5 Jun 2026 / Moon Monday 277 |
| [STARLUST-MB3] / [STARLUST-May26] | Starlust, Mar 2026 (three phases) / Starlust, May 2026 (three missions) |
| [TREK-A3] / [TREK-SEARCH] | NASA Moon Trek feature query for the 2022 regions / Trek catalogue search |
| [PGDA69] / [PGDA78] / [PGDA90] / [PGDA104] | NASA GSFC PGDA products: polar illumination / 5 m site DEMs / "A New View of the Lunar South Pole" / shape-from-shading DEMs |
| [MAZ11] / [BARKER21] / [BARKER23] | Mazarico et al. 2011 (NTRS record) / Barker et al. 2021 / Barker et al. 2023 |
| [GLAESER18] / [BUSSEY10] / [DEROSA12] | Glaeser et al. 2018 / Bussey et al. 2010 / De Rosa et al. 2012 |
| [FZ20] / [OCHMO] | Fassett and Zanetti 2020 / NASA OCHMO-TB-001 Rev B |
| [VIPER-SB] / [VIPER-EN] / [VIPER-21] | Shirley and Balaban 2022 / Ennico-Smith et al. 2023 / VIPER slides to NASEM, 2021 |
| [LE2021] / [LE2031] | NASA lunar-eclipse decade tables 2021-2030 / 2031-2040 |
| [COLAPRETE10] / [LWIMS] / [ISRU22] | Colaprete et al. 2010 / NASA Lunar Water ISRU Measurement Study, TM-20205008626 / NASA ISRU Plans, COSPAR 2022 |
| [MCCLANAHAN24] / [LEND-NASA24] | McClanahan et al. 2024 / NASA release, 3 Oct 2024 |
| [LI18] / [LEMELIN21] / [PSR-ATLAS] / [LROC1255] | Li et al. 2018 / Lemelin et al. 2021 / LROC PSR Atlas / LROC feature on PSR resource potential |
| [SHADOWCAM26] / [MSOLO26] / [ICE-REVIEW] | University of Hawaii release on ShadowCam, 27 Mar 2026 / NASA MSolo PRIME-1 results, NTRS 20260003150 / lunar ice review, arXiv:2502.06056 |
| [SR23] / [HAYNE21] / [WILLIAMS19] | Schorghofer and Rufu 2023 / Hayne et al. 2021 / Williams et al. 2019 |
| [SAXENA-NASA] / [NASEM20] | NASA Science, 19 Aug 2026 / NASEM, Planetary Protection for the Study of Lunar Volatiles |
| [STD8719] / [OPP-TRISMAC] / [OPP-NASEM] | NASA-STD-8719.27 / NASA planetary-protection presentations |
| [TYE15] / [WATTERS24] / [DSNE] | Tye et al. 2015 / Watters et al. 2024 / NASA DSNE lunar surface briefing |
| [PENA24] / [GRACY24] | Pena-Asensio et al. 2024 / Gracy and Lee, LPSC 2024 no. 1695 |
| [WP-A3] [WP-A4] [WP-ART] [WP-CLPS] [WP-BMP] [WP-CE7] [WP-CE8] [WP-CH3] [WP-IM2] [WP-LSP] [WP-PEL] [WP-LCROSS] [WP-MOUTON] [WP-SHACK] [WP-SHOE] [WP-HAW] [WP-FAU] [WP-CAB] [WP-DEG] | Wikipedia articles (secondary) |

[REL22]: https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/
[REL24]: https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/
[NASA-Oct26]: https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/
[LPSC26]: https://ntrs.nasa.gov/citations/20250011660
[HLS-OV]: https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf
[PLATTE23]: https://ntrs.nasa.gov/api/citations/20230005904/downloads/PlatteCity_Artemis.pdf
[IAC22]: https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf
[IAC25]: https://ntrs.nasa.gov/api/citations/20250008727/downloads/IAC%2025%20B3%201%20v3.pdf
[WP-SITE]: https://ntrs.nasa.gov/api/citations/20230016267/downloads/Lunar%20Site%20Selection.pdf
[WP-POLE]: https://www.nasa.gov/wp-content/uploads/2023/10/acr22-wp-why-lunar-south-polar-region.pdf
[NRHO-WS]: https://www.nasa.gov/wp-content/uploads/2023/10/nrho-artemis-orbit.pdf
[LEE19]: https://ntrs.nasa.gov/api/citations/20190030294/downloads/20190030294.pdf
[HLS-MD]: https://ntrs.nasa.gov/api/citations/20230002566/downloads/HLS%20NRHO%20to%20Lunar%20Surface%20and%20Back%20Mission%20Design_STRIVES.pptx.pdf
[AAS25]: https://ntrs.nasa.gov/api/citations/20250002331/downloads/AAS%2025-205%20PradoPino%20and%20Condon.pdf
[LEAG25]: https://ntrs.nasa.gov/api/citations/20250011534/downloads/LEAG-2025_NASA%20Artemis%20Updates.pdf
[A1-AVAIL]: https://www.nasa.gov/missions/artemis/artemis-i-mission-availability
[MB-PDF]: https://www.nasa.gov/wp-content/uploads/2026/03/building-the-moon-base.pdf
[MB-PAGE]: https://www.nasa.gov/reference/moonbase-about/
[MB-PHASES]: https://www.nasa.gov/moonbase-phases/
[OIG26]: https://oig.nasa.gov/news/artemis-lander-program-faces-schedule-delays-and-unmitigated-crew-safety-risks
[REG-OIG]: https://www.theregister.com/2026/03/11/nasa_oig_artemis_lander/
[SPOL-Oct26]: https://spacepolicyonline.com/news/nasa-is-full-steam-ahead-on-artemis-iii-iv-and-v/
[PAYLOAD-Oct26]: https://payloadspace.com/nasa-outlines-the-details-of-artemis-iii-and-iv-missions/
[ASTRO-Jun26]: https://www.astronomy.com/space-exploration/how-nasa-plans-to-build-a-moon-base/
[MM277]: https://jatan.space/moon-monday-issue-277/
[STARLUST-MB3]: https://starlust.org/nasa-has-adopted-a-3-phase-approach-to-establish-a-moon-base-heres-what-it-looks-like/
[STARLUST-May26]: https://starlust.org/nasa-to-launch-three-moon-base-missions-this-year-itselfheres-all-you-need-to-know-about-them/
[TREK-A3]: https://trek.nasa.gov/moon/trekarcgis2/rest/services/A3_Named_regions_SP/MapServer/0/query?where=1%3D1&outFields=*&f=json
[TREK-SEARCH]: https://trek.nasa.gov/moon/TrekServices/ws/index/polar/searchItems?start=0&rows=2147483647&facetKeys=itemType&facetValues=product
[PGDA69]: https://pgda.gsfc.nasa.gov/products/69
[PGDA78]: https://pgda.gsfc.nasa.gov/products/78
[PGDA90]: https://pgda.gsfc.nasa.gov/products/90
[PGDA104]: https://pgda.gsfc.nasa.gov/products/104
[MAZ11]: https://ntrs.nasa.gov/citations/20120010094
[BARKER21]: https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf
[BARKER23]: https://ntrs.nasa.gov/api/citations/20230014419/downloads/BarkernewviewSTIupdated.pdf
[GLAESER18]: https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf
[BUSSEY10]: https://spudislunarresources.nss.org/Bibliography/p/98.pdf
[DEROSA12]: https://www.lpi.usra.edu/meetings/lpsc2012/pdf/1585.pdf
[FZ20]: https://www.hou.usra.edu/meetings/lunarsurface2020/pdf/5067.pdf
[OCHMO]: https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-001-artemis-lighting-considerations.pdf
[VIPER-SB]: https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf
[VIPER-EN]: https://ntrs.nasa.gov/api/citations/20230004239/downloads/SSR2023-VIPER-Planning-Ennico.pdf
[VIPER-21]: https://www.nationalacademies.org/cdn/materials/9fba0b0c-198c-4772-a367-136febe32e2a
[LE2021]: https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2021.html
[LE2031]: https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2031.html
[COLAPRETE10]: https://www.chem.uci.edu/~unicorn/old/H2A/handouts/PDFs/LCROSSPaper.pdf
[LWIMS]: https://ntrs.nasa.gov/api/citations/20205008626/downloads/TM-20205008626.pdf
[ISRU22]: https://ntrs.nasa.gov/api/citations/20220008799/downloads/NASA%20ISRU%20Plans_Sanders_COSPAR-Final.pdf
[MCCLANAHAN24]: https://www.arxiv.org/pdf/2303.03911
[LEND-NASA24]: https://science.nasa.gov/solar-system/moon/nasas-lro-lunar-ice-deposits-are-widespread/
[LI18]: https://pmc.ncbi.nlm.nih.gov/articles/6130389
[LEMELIN21]: https://iopscience.iop.org/article/10.3847/PSJ/abf3c5
[PSR-ATLAS]: https://lroc.im-ldi.com/atlases/psr/list
[LROC1255]: https://lroc.im-ldi.com/images/1255
[SHADOWCAM26]: https://www.soest.hawaii.edu/soestwp/announce/news/scarce-ice-in-moons-darkest-regions/
[MSOLO26]: https://ntrs.nasa.gov/api/citations/20260003150/downloads/MSolo%20PRIME-1%20overview%20and%20results%20-%20LSSW.pdf
[ICE-REVIEW]: https://arxiv.org/html/2502.06056v2
[SR23]: https://pmc.ncbi.nlm.nih.gov/articles/PMC10499310/
[HAYNE21]: https://arxiv.org/pdf/2005.05369
[WILLIAMS19]: https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2019JE006028
[SAXENA-NASA]: https://science.nasa.gov/humans-in-space/human-related-microbes-may-survive-moons-south-pole-nasa-finds/
[NASEM20]: https://www.nationalacademies.org/read/26029/chapter/6
[STD8719]: https://standards.nasa.gov/sites/default/files/standards/NASA/Baseline/0/NASA-STD-871927_Baseline.pdf
[OPP-TRISMAC]: https://airdrive.eventsair.com/eventsairwesteuprod/production-nikal-public/266377ae1582435fbcd8c005f1442571
[OPP-NASEM]: https://www.nationalacademies.org/cdn/materials/a172f18a-07ad-4ab0-a14e-bdc86f0b2d32
[TYE15]: https://ntrs.nasa.gov/api/citations/20150006822/downloads/20150006822.pdf
[WATTERS24]: https://iopscience.iop.org/article/10.3847/PSJ/ad1332
[DSNE]: https://ntrs.nasa.gov/api/citations/20230015518/downloads/DSNE_LunarSurfaceEnvironment_Chambers_v2.pdf
[PENA24]: https://arxiv.org/html/2406.19863v2
[GRACY24]: https://www.hou.usra.edu/meetings/lpsc2024/pdf/1695.pdf
[WP-A3]: https://en.wikipedia.org/wiki/Artemis_III
[WP-A4]: https://en.wikipedia.org/wiki/Artemis_IV
[WP-ART]: https://en.wikipedia.org/wiki/Artemis_program
[WP-CLPS]: https://en.wikipedia.org/wiki/Commercial_Lunar_Payload_Services
[WP-BMP]: https://en.wikipedia.org/wiki/Blue_Moon_Pathfinder_Mission_1
[WP-CE7]: https://en.wikipedia.org/wiki/Chang%27e_7
[WP-CE8]: https://en.wikipedia.org/wiki/Chang%27e_8
[WP-CH3]: https://en.wikipedia.org/wiki/Chandrayaan-3
[WP-IM2]: https://en.wikipedia.org/wiki/IM-2
[WP-LSP]: https://en.wikipedia.org/wiki/Lunar_south_pole
[WP-PEL]: https://en.wikipedia.org/wiki/Peak_of_eternal_light
[WP-LCROSS]: https://en.wikipedia.org/wiki/LCROSS
[WP-MOUTON]: https://en.wikipedia.org/wiki/Mons_Mouton
[WP-SHACK]: <https://en.wikipedia.org/wiki/Shackleton_(crater)>
[WP-SHOE]: <https://en.wikipedia.org/wiki/Shoemaker_(lunar_crater)>
[WP-HAW]: <https://en.wikipedia.org/wiki/Haworth_(crater)>
[WP-FAU]: <https://en.wikipedia.org/wiki/Faustini_(crater)>
[WP-CAB]: <https://en.wikipedia.org/wiki/Cabeus_(crater)>
[WP-DEG]: <https://en.wikipedia.org/wiki/De_Gerlache_(crater)>
