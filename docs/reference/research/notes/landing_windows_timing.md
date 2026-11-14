# Optimal time windows for landing at the lunar south pole: constraints, thresholds and computation methods

Research date: 2026-11-14. Scope: south of ~80°S plus Malapert / Mons Mouton. Labels used in tables: **REQ** = stated NASA/mission requirement, **CHOICE** = mission-specific design choice or screening value, **RULE** = rule of thumb / descriptive statement, **SUPERSEDED** = belonged to a plan that is no longer current.

Source shorthand used repeatedly (all are primary NASA documents unless noted):

| Tag | Document | URL |
|---|---|---|
| NASA-Oct26 | NASA article "NASA, Partners Accelerate Lander Development for 2028 Moon Missions", 23 Oct 2026 (updated 26 Oct 2026) | https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/ |
| LPSC26 | George, Rubio, Lawrence, Curell, "Artemis III Site Selection Update: Downselection From Thirteen to Nine Candidate Regions", LPSC 2026 extended abstract, NTRS 20250011660 | https://ntrs.nasa.gov/citations/20250011660 |
| REL24 | NASA release 24-136, 28 Oct 2024, "NASA Provides Update on Artemis III Moon Landing Regions" | https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/ |
| REL22 | NASA release 22-089, 19 Aug 2022, "NASA Identifies Candidate Regions for Landing Next Americans on Moon" | https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/ |
| HLS-OV | "Artemis Human Landing System Overview" (A. Dwyer Cianciolo, LaRC, 1 Aug 2024; re-presented by L. Ortiz, 4 Oct 2025), NTRS 20250009323 | https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf |
| IAC22 | Merancy, Digiuseppe, Nelson, "Artemis Lunar Mission Availability & Design", IAC-22-B3.1, NTRS 20220012445 | https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf |
| WP-SITE | 2023 Moon to Mars Architecture white paper "Lunar Site Selection", NTRS 20230016267 | https://ntrs.nasa.gov/api/citations/20230016267/downloads/Lunar%20Site%20Selection.pdf |
| WP-POLE | 2022 Architecture Concept Review white paper "Why Artemis Will Focus on the Lunar South Polar Region" | https://www.nasa.gov/wp-content/uploads/2023/10/acr22-wp-why-lunar-south-polar-region.pdf |
| NRHO-WS | N. Merancy, "How: NRHO - The Artemis Orbit", NASA Architecture Workshop, June 2023 | https://www.nasa.gov/wp-content/uploads/2023/10/nrho-artemis-orbit.pdf |
| LEE19 | D. E. Lee, NASA white paper "Gateway Destination Orbit Model: A Continuous 15 Year NRHO Reference Trajectory", 20 Aug 2019, NTRS 20190030294 | https://ntrs.nasa.gov/api/citations/20190030294/downloads/20190030294.pdf |
| HLS-MD | Mahajan & Condon, "HLS NRHO to Lunar Surface and Back Mission Design", JSC, 9 Aug 2022, NTRS 20230002566 | https://ntrs.nasa.gov/api/citations/20230002566/downloads/HLS%20NRHO%20to%20Lunar%20Surface%20and%20Back%20Mission%20Design_STRIVES.pptx.pdf |
| AAS25 | Prado Pino & Condon, "Orion Capability to Rescue and Return Crew After a Human Lunar Landing Vehicle Failure Scenario", AAS 25-205, NTRS 20250002331 | https://ntrs.nasa.gov/api/citations/20250002331/downloads/AAS%2025-205%20PradoPino%20and%20Condon.pdf |
| IAC25 | Creech et al., HLS programme overview paper, IAC-25-B3.1.7, NTRS 20250008727 | https://ntrs.nasa.gov/api/citations/20250008727/downloads/IAC%2025%20B3%201%20v3.pdf |
| LEAG25 | Noble & Needham (chairs), "NASA Artemis Updates", LEAG 2025 (slides dated Dec 2025 / Jan 2026), NTRS 20250011534 | https://ntrs.nasa.gov/api/citations/20250011534/downloads/LEAG-2025_NASA%20Artemis%20Updates.pdf |
| A1-AVAIL | NASA "Artemis I Mission Availability" | https://www.nasa.gov/missions/artemis/artemis-i-mission-availability |
| PGDA69 | NASA GSFC PGDA product page "Lunar Polar Illumination" | https://pgda.gsfc.nasa.gov/products/69 |
| MAZ11 | Mazarico et al. 2011, Icarus 211, 1066-1081 (NTRS record 20120010094) | https://ntrs.nasa.gov/citations/20120010094 |
| BARKER21 | Barker et al. 2021, Planetary and Space Science, doi 10.1016/j.pss.2020.105119 (NTRS 20205009660) | https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf |
| VIPER-SB | Shirley & Balaban, "An Overview of Mission Planning for the VIPER Rover", 2 June 2022, NTRS 20220008301 | https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf |
| VIPER-EN | Ennico-Smith et al., "VIPER Mission Traverse Planning - Design, Strategies, and Dynamics" (2023), NTRS 20230004239 | https://ntrs.nasa.gov/api/citations/20230004239/downloads/SSR2023-VIPER-Planning-Ennico.pdf |

---

## Status check: what is the current Artemis mission design as of November 2026, and which earlier assumptions are superseded?

### Takeaway
The NRHO-based "Artemis III = first south-polar landing with a ~6.5-day stay" design that almost all published NASA window analyses assume was superseded in 2026: Artemis III is now a 2027 low-Earth-orbit docking test, the first landing is Artemis IV (target 2028), and per NASA's 23 Oct 2026 article the landers and Orion will no longer rendezvous in NRHO. NASA has not yet published window/availability analyses for the new rendezvous orbits, so the NRHO-era numbers below are the only quantitative NASA data but must be flagged as legacy.

### Cited Findings

| Item | Current state (Nov 2026) | Earlier plan (now superseded) | Source |
|---|---|---|---|
| Artemis II | Flown; crew returned by 12 Apr 2026 | (was "spring 2026" in IAC25) | [Daily Signal 12 Apr 2026](https://www.dailysignal.com/2026/04/12/artemis-ii-home-safe-when-are-we-going-moon/); [IAC25](https://ntrs.nasa.gov/api/citations/20250008727/downloads/IAC%2025%20B3%201%20v3.pdf) |
| Artemis III | Re-scoped on 27 Feb 2026 to a crewed Earth-orbit test (rendezvous/docking of Orion with one or both commercial landers), target 2027; described as a 14-17 day LEO mission; reported ~3 months behind schedule on paper | First crewed south-polar landing with Starship HLS from NRHO, ~6.5-day stay | [Spaceflight Now 27 Feb 2026](https://spaceflightnow.com/2026/02/27/nasa-announces-major-overhaul-of-artemis-moon-program/); [Payload 23 Oct 2026](https://payloadspace.com/nasa-outlines-the-details-of-artemis-iii-and-iv-missions/); [NASA-Oct26](https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/) |
| First crewed landing | Artemis IV, target 2028 (Feb 2026 reporting: "early 2028"; Oct 2026 reporting: end-of-2028 target); Artemis V a possible second 2028 landing; lander chosen by readiness (either Starship HLS or Blue Moon Mark 2) | Artemis III, 2026-2027 | [Spaceflight Now](https://spaceflightnow.com/2026/02/27/nasa-announces-major-overhaul-of-artemis-moon-program/); [Moon Monday 264](https://jatan.space/moon-monday-issue-264/); [Payload](https://payloadspace.com/nasa-outlines-the-details-of-artemis-iii-and-iv-missions/); [NASA-Oct26](https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/) |
| Rendezvous / staging orbit | No longer NRHO. SpaceX: Starship HLS waits in Earth orbit, docks with Orion there, then performs TLI and takes the stack to low lunar orbit. Blue Origin: stack goes to an elliptical polar lunar orbit (stated benefits: faster returns to Orion, less lander propellant, maximises SLS performance). No orbit altitudes/periods published | 9:2 southern L2 NRHO, ~6.5-day period | [NASA-Oct26](https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/) |
| Surface mission | SpaceX lander keeps two crew on the surface for "several days"; initial surface missions target two moonwalks of roughly two hours each; two crew stay in Orion | ~6.5-day stay, multiple EVAs (~1 km radius on foot) | [NASA-Oct26](https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/); [LEAG25](https://ntrs.nasa.gov/api/citations/20250011534/downloads/LEAG-2025_NASA%20Artemis%20Updates.pdf) |
| Launch-timing flexibility | SpaceX: propellant aggregation in LEO gives flexibility in SLS crew launch timing. Blue Origin: architecture gives multiple SLS/Orion launch opportunities to reach the elliptical polar orbit. No numbers given | SLS Block 1 could reach NRHO only ~half of each lunar orbit; ~28 NRHO-departure opportunities/year | [NASA-Oct26](https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/); [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf) |
| SLS configuration | Exploration Upper Stage / Block 1B / Block 2 dropped; a "standardized" upper stage with performance similar to the current one; aim of roughly yearly launches | Block 1B with EUS from Artemis IV | [Spaceflight Now](https://spaceflightnow.com/2026/02/27/nasa-announces-major-overhaul-of-artemis-moon-program/); [Moon Monday 264](https://jatan.space/moon-monday-issue-264/) |
| Gateway | Not mentioned in the Feb 2026 announcement or the Oct 2026 article; status reported as unclear/diminished, not formally cancelled in the sources found | Staging node in NRHO from Artemis IV | [Moon Monday 264](https://jatan.space/moon-monday-issue-264/); [NASA-Oct26](https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/) |
| Landing location | Blue Origin's Mark 2 stack is described as landing at the South Pole; NASA text says future missions explore near the South Pole. One newsletter (1 June 2026) reports NASA was considering a first Artemis landing away from the south pole (secondary, unconfirmed) | South-polar region, within 6° of pole | [NASA-Oct26](https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/); [Moon Monday 277](https://jatan.space/moon-monday-issue-277/) |
| Candidate regions | The nine-region set (Oct 2024) applies to Artemis III as then defined only; NASA states it does not constrain Artemis IV and later, which are expected to consider broader parts of the south polar region. An Artemis IV landing-site workshop was held 10 Sep 2025 to define figures of merit | - | [LPSC26](https://ntrs.nasa.gov/citations/20250011660); [LEAG25](https://ntrs.nasa.gov/api/citations/20250011534/downloads/LEAG-2025_NASA%20Artemis%20Updates.pdf) |
| Pre-requisites | Both providers must fly an uncrewed demonstration before crewed landings; SpaceX plans an in-orbit propellant-transfer demo in early 2027 | - | [NASA-Oct26](https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/); [Payload](https://payloadspace.com/nasa-outlines-the-details-of-artemis-iii-and-iv-missions/) |

- In January 2026 (LEAG slides) the plan of record for Artemis IV was still a Starship HLS south-polar landing with a 6.5-day surface mission and on-foot EVAs of ~1 km radius, with "architecture options under review" - i.e. the 6.5-day figure was still the baseline two months before the February 2026 restructure. - [LEAG25](https://ntrs.nasa.gov/api/citations/20250011534/downloads/LEAG-2025_NASA%20Artemis%20Updates.pdf)

### Inferences
- For an app, the NRHO cadence (one descent opportunity per ~6.56 days; fixed 6-6.5 day stay) should be implemented as a selectable "legacy NRHO" mode, not as the default for 2028 missions. A low-lunar-orbit or elliptical-polar-orbit staging removes the hard coupling between surface-stay length and the NRHO period; the stay can then be set by lighting/consumables rather than orbital period.
- Because the first landings now plan only two ~2-hour moonwalks and a stay of "several days", the continuous-sunlight requirement for the first landing is probably shorter than 6.5 days; a user-configurable stay length (e.g. 2-7 days) is the safest design choice.
- Concrete, officially published landing-window dates for 2027-2030 do not exist yet for the new architecture (none found).

### Gaps
- No NASA document found giving orbit parameters (altitude, period, plane) of the new LLO / elliptical polar orbit, the resulting landing/ascent opportunity cadence, the new surface-stay duration in days, or the lander loiter limits in the new architecture.
- No official target launch date (month) for Artemis IV; sources conflict between "early 2028" (Feb 2026) and "end of 2028" (Oct 2026).
- The nasaspaceflight.com March 2026 article and an October 2026 wire story could not be fetched (HTTP 403).

---

## Lighting-driven constraints: required Sun geometry, monthly and seasonal cycles, usable days, continuous-sunlight requirement, approach lighting

### Takeaway
NASA's published crewed-landing rule is binary rather than an elevation threshold: the site must be sunlit for descent, the entire surface stay (~6-6.5 days in the NRHO design) and ascent, and regions with <5% average solar visibility were screened out; lighting peaks in south-polar summer, which drifts 2-3 weeks earlier every calendar year. Because the Sun only reaches a few degrees elevation, whether a given site is lit at a given hour is decided by the local horizon profile, so windows must be computed per site from terrain.

### Cited Findings

**Numerical thresholds and rules actually published**

| Constraint | Value | Type | Applies to | Source |
|---|---|---|---|---|
| Site sunlit for descent, whole surface stay and ascent (visibility, thermal, power) | Continuous lighting for mission duration | REQ (general constraint for Artemis III as then defined) | Crewed | [IAC22](https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf); [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf); [LPSC26](https://ntrs.nasa.gov/citations/20250011660) |
| Duration of required sunlight | ~6-6.5 days (initial Human Lunar Return site) | REQ / SUPERSEDED with NRHO design | Crewed | [WP-SITE](https://ntrs.nasa.gov/api/citations/20230016267/downloads/Lunar%20Site%20Selection.pdf) |
| All 13 original regions contain sites with continuous sunlight through a 6.5-day period | 6.5 days | CHOICE (selection criterion) | Crewed | [REL22](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/) |
| Surface stay actually achievable from NRHO | ~5.75-6.25 days depending on epoch and LLO-rev considerations; ~6 days nominal; 6.1-6.2 days with 2-3 LLO revs (epoch 25 Mar 2028); ~5.9 days "optimal" (epoch 12 Jan 2025) | CHOICE / SUPERSEDED | Crewed | [LPSC26](https://ntrs.nasa.gov/citations/20250011660); [HLS-MD](https://ntrs.nasa.gov/api/citations/20230002566/downloads/HLS%20NRHO%20to%20Lunar%20Surface%20and%20Back%20Mission%20Design_STRIVES.pptx.pdf) |
| Screening mask for landing areas: average solar visibility | Areas with solar visibility < 5% excluded | CHOICE (screening map) | Crewed | [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf) |
| Approach lighting | Illumination along the approach trajectory is "beneficial"; approach trajectory differs for each landing opportunity; from NRHO the approach has a general left-to-right direction | RULE (no numeric azimuth/elevation limit published) | Crewed | [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf) |
| Landing slope | < 10° over 100 m | REQ (listed "Key Artemis III Landing Requirements") | Crewed | [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf) |
| EVA slope | < 20° within 2 km | REQ (same list) | Crewed | [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf) |
| Latitude | Land within 6° of the South Pole | REQ (same list) | Crewed | [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf); [REL22](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/) |
| Landing accuracy | Within 100 m of target (100 m x 100 m); HLS requirement of a 100 m-radius landing ellipse (HLS-RQMT-001) | REQ | Crewed | [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf); [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf) |
| Region / site size | Region ~15 x 15 km; a landing site = ~100 m radius spot; several sites per region | CHOICE | Crewed | [REL22](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/) |
| Solar-powered rover: survivable darkness | 50 h in minimal-power mode; ~9 h working in shadow (with drill) | REQ (VIPER engineering spec) | Robotic | [VIPER-SB](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf) |
| Rover drives and science stations must occur in sunlight (except deliberate PSR entry) | - | CHOICE (VIPER planner constraint) | Robotic | [VIPER-SB](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf) |

**Geometry and cycles (descriptive statements from NASA sources)**

- The lunar equator is inclined 1.54° to the ecliptic; near the poles the Sun circles the observer, never more than a few degrees above the horizon and at times below it; equatorial (Apollo) sites instead get ~14.5 Earth days of light then ~14.5 of night. - [WP-POLE](https://www.nasa.gov/wp-content/uploads/2023/10/acr22-wp-why-lunar-south-polar-region.pdf)
- In the 85-90°S region the Sun's elevation never exceeds ~6°; NASA's HLS overview gives "Sun and Earth only rise above the horizon ~2 to 7 deg"; NASA EVA-lighting work states the Sun never rises more than 7° in the target landing regions (sites south of 84°S); at VIPER's Mons Mouton site the Sun was described as never exceeding 10°. - [IAC22](https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf); [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf); [NASA IAASS 2023 paper, NTRS 20230006313](https://ntrs.nasa.gov/citations/20230006313); [Planetary Society](https://www.planetary.org/articles/nasa-cancels-viper)
- The terminator rotates around the pole and is not smooth; lighting changes constantly; lighting can differ significantly between adjacent touchdown sites within one sortie duration. - [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf); [IAC22](https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf)
- Every location has its own sunlight/darkness pattern; patterns are predictable but can vary strongly over short distances, so "day/night" is not consistent across the region; no known south-polar location is continuously sunlit; higher terrain and extra hardware height increase sunlight access. - [WP-SITE](https://ntrs.nasa.gov/api/citations/20230016267/downloads/Lunar%20Site%20Selection.pdf)
- Choosing sites with favourable lighting restricts landing access to limited periods in the year; depending on launch date a desired gentle-slope site may be dark, for periods ranging from brief to weeks or months. - [WP-SITE](https://ntrs.nasa.gov/api/citations/20230016267/downloads/Lunar%20Site%20Selection.pdf)
- Seasons: in 2022 NASA described south-polar "summer" as roughly October to March, with some high peaks/ridges getting near-continuous light then. - [IAC22](https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf)
- Seasonal drift: the Moon has roughly 11 seasonal cycles per 10 Earth years, so the best lighting months slide through the Earth calendar. - [WP-SITE](https://ntrs.nasa.gov/api/citations/20230016267/downloads/Lunar%20Site%20Selection.pdf)
- Peak lighting conditions are periodic and shift 2-3 weeks earlier each year; by 2030 peak solar illumination is around August. - [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf); [LPSC26](https://ntrs.nasa.gov/citations/20250011660)
- Site-selection consequence: NASA favoured regions that performed consistently across mission epochs and were less sensitive to seasonal effects and timing uncertainty. - [LPSC26](https://ntrs.nasa.gov/citations/20250011660)
- A mission-design paper notes that lighting varies seasonally and can disqualify a large number of nominal HLS missions over a year; for 2026-2027 its best Orion/HLS solutions fell in the winter 2026-2027 (Earth calendar) period, and the three representative sites were chosen for lighting advantage. - [AAS25](https://ntrs.nasa.gov/api/citations/20250002331/downloads/AAS%2025-205%20PradoPino%20and%20Condon.pdf)

**Published illumination statistics for specific south-polar sites (how many lit days sites offer)**

| Site / study | DEM | Period analysed | Result | Source |
|---|---|---|---|---|
| Location near Shackleton rim (Mazarico 2011) | LOLA 240 m | several 18.6-yr cycles, 6 h step | Sunlit continuously for 240 days; longest total darkness ~1.5 days; ~10 m of added height can substantially improve illumination | [MAZ11](https://ntrs.nasa.gov/citations/20120010094) |
| "Connecting Ridge" (Shackleton-de Gerlache), Gläser et al. 2014 | LOLA 20 m | 19 years (precession cycle) | Sunlight 92.27% of the time at 2 m height, 95.65% at 10 m; longest continuous darkness typically 3-5 days | [Gläser 2014, DLR elib](https://elib.dlr.de/94240/) |
| South-pole ridge between Shackleton and de Gerlache, Gläser et al. 2018 | LOLA 20 m, 2 m panel height | 2017-2037, 1 h step | Best-lit locations average 77.1%-88.0% illumination | [Gläser 2018, DLR elib](https://elib.dlr.de/119091) |
| Site 1 (connecting ridge) regions of interest, Barker et al. 2021 | LOLA 5 m (new) | 1 Jan 2024 - 1 Jan 2026, 1 h step | See table below | [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf) |
| Shackleton rim (Speyerer & Robinson 2013, LROC images) | WAC imaging | one lunar year | Some rim sites lit ~94% of a lunar year (figure taken from a secondary summary; not verified against the paper) | [Wikipedia summary](https://en.wikipedia.com/wiki/Peak_of_eternal_light) |
| Best site in JPL GSSR-DEM study | Goldstone radar DEM | multi-year average | Solar power availability 92%, direct-to-Earth comm availability 51% | [JPL IPN PR 42-176](https://ipnpr.jpl.nasa.gov/progress_report/42-176/176C.html) |

Barker et al. 2021, Table 2 - Site 1 (Shackleton-de Gerlache connecting ridge) regions of interest (RoIs = connected pixels with average illumination > 70% at 1 m height and area > 2500 m²); X/Y are south-polar stereographic km; values are conservative 1st/99th-percentile results over 100 DEM "clones", case A (RoI-averaged). LCIP = longest continuous illumination period (any part of the Sun visible), LCSP = longest continuous shadow period. Period 1 Jan 2024 - 1 Jan 2026. - [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf)

| RoI | X (km) | Y (km) | Area (m²) | Avg illum. at 1 m (%) | LCIP at 1 m (days) | LCSP at 1 m (days) | Avg illum. at 5 m (%) | LCIP at 5 m (days) | LCSP at 5 m (days) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 11.5825 | 12.4625 | 8625 | 68.03 | 63.35 | 16.55 | 89.26 | 215.79 | 5.29 |
| 2 | 11.4875 | 12.5575 | 7550 | 70.32 | 113.80 | 17.84 | 88.51 | 216.28 | 7.31 |
| 3 | 11.3525 | 12.5025 | 3825 | 67.51 | 117.86 | 22.23 | 84.53 | 216.89 | 8.41 |
| 4 | 11.2875 | 12.1675 | 13300 | 69.61 | 136.49 | 13.27 | 88.12 | 231.20 | 4.00 |
| 5 | 11.1025 | 11.9425 | 10075 | 70.38 | 142.17 | 15.24 | 85.71 | 218.98 | 4.52 |
| 6 | 10.8025 | 11.7375 | 10000 | 71.15 | 81.01 | 12.74 | 87.35 | 220.98 | 4.16 |
| 7 | 10.2275 | 11.5525 | 7075 | 67.36 | 100.23 | 14.54 | 82.79 | 119.07 | 5.42 |

- Barker et al. stress that a few metres of height make a dramatic difference: at 5 m above the surface nearly the whole connecting ridge exceeds 70% average illumination. - [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf)
- VIPER "working days available" per candidate area (days on which the solar/comm constraints allow work, from a 6-month 2023-24 analysis): Nobile 45, Haworth Lower 20, Haworth Upper 12, de Gerlache 12, Slater Upper 10, Slater 8, Shackleton Ridge 7, Shoemaker 7, Cabeus 5. - [VIPER-SB](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf)

### Inferences
- Standard astronomical constants needed by the app (not separately sourced in this research; taken as textbook values consistent with the NASA statements above): synodic month 29.5306 d (Sun azimuth cycle at the pole), draconic month 27.2122 d, draconic ("eclipse"/lunar seasonal) year 346.62 d, lunar obliquity to ecliptic 1.54°. 365.25 - 346.62 = 18.6 d/yr earlier, matching NASA's "2-3 weeks earlier each year"; 3652.5/346.62 = 10.5 cycles per decade, matching NASA's "roughly 11 per 10 years".
- Maximum geometric Sun elevation on a smooth sphere is about (90° - |latitude|) + 1.54°: 1.5° at the pole, ~3.5° at 88°S, ~5.5° at 86°S, ~7.5° at 84°S - consistent with the quoted "2-7°", "~6°", "7°" figures.
- Computed (by this researcher, from mean lunar-node and solar-longitude formulae; accuracy about ±1-2 days; verify with SPICE sub-solar latitude — checked 14 Nov against the app ephemeris: up to ~10 days off the instantaneous extremes, see the main report) dates of south-polar seasons. South-summer solstice = sub-solar latitude most negative (-1.54°), i.e. Sun's ecliptic longitude minus mean ascending node = 270°. The dates reproduce NASA's statements ("Oct-Mar summer" in 2022-23; VIPER's Nov 2024 landing for a 100-day mission centred on late Dec 2024; Chang'e-7's Aug 2026 launch for a late-2026 landing).

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

- Note a small tension: NASA's slide says peak illumination is "around August" by 2030, whereas the computed solstice is 4 Sep 2030 (16 Aug in 2031). The slide is approximate; treat "summer" as roughly ±2-3 months around the solstice dates.
- For a 2028 landing the favourable season is roughly Aug-Dec 2028 (solstice 11 Oct 2028); an "early 2028" landing would fall near the January 2028 equinox heading into winter (worst lighting around 17 Apr 2028), a "late 2028" landing would be in summer. This is a derived observation, not a NASA statement.
- A sensible app parameterisation: per site, a time series of visible Sun-disc fraction at lander/solar-array height (1 m, 2 m, 5 m, 10 m all appear in the literature) and a window test "fraction > threshold continuously for N days", with N = 6.5 (legacy crewed), N configurable (new architecture), N = 10-14 (one lunar day, robotic).

### Gaps
- No NASA source found that states a numeric minimum/maximum Sun elevation at touchdown, a Sun-azimuth-versus-approach-azimuth limit, or shadow-length criteria for hazard detection at the south pole; only the qualitative "approach illumination is beneficial" was found.
- No published per-region statistics of "usable days per month / months per year" for the 9 or 13 Artemis candidate regions were found; NASA only states qualitatively that individual regions have limited viable opportunities.
- Speyerer & Robinson (2013) numbers and Mazarico's Table 3 site coordinates were not retrieved from primary text.

---

## Earth-visibility constraints: libration cycle, direct-to-Earth requirement, overlap with lighting, effect on region selection

### Takeaway
Without a lunar relay, NASA required direct-with-Earth communication for Artemis III ("assume no comm relay"), and Earth is only above the horizon for roughly two weeks in each ~4-week cycle at near-pole sites, giving 2-3 weeks of site availability per month from Earth line-of-sight alone. NASA states explicitly that once launch, rendezvous, communications, illumination and terrain are imposed together, each region has few viable opportunities, which is why several regions were retained.

### Cited Findings

| Constraint / fact | Value | Type | Source |
|---|---|---|---|
| Direct-with-Earth (DWE) communication, assume no relay available | Required | REQ (Key Artemis III Landing Requirement no. 4) | [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf) |
| Screening mask: average Earth visibility | Areas with Earth visibility < 25% excluded | CHOICE (screening map) | [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf) |
| Alternative screen in an informal site-screening slide deck (authorship/date unverified) | Sites with DTE visibility < 50% of the time eliminated; sites grouped in 2.5 km radius areas; 120 m Mazarico illumination map | CHOICE (unverified source) | [Google Slides deck](https://docs.google.com/presentation/d/1qThuKA1AqsDu07t4blwmiTCECd3IPgBI/htmlpresent) |
| Earth cycle at the pole | Earth visible ~two weeks, not visible ~two weeks; Earth and Sun rise only ~2-7° | RULE | [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf) |
| Effect of DTE on availability | With direct line of sight, the libration of the Moon limits landing-site availability to only 2-3 weeks per lunar month; areas nearest the pole are most constrained; coverage approaches continuous as latitude decreases toward Earth | RULE | [IAC22](https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf) |
| Crewed mission needs comm throughout the surface mission | Continuous | REQ (stated need) | [IAC22](https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf) |
| VIPER: Earth below horizon | About half of each lunar day (i.e. ~2 weeks per month) from near the south pole; rover hibernates then | RULE (mission analysis) | [VIPER-SB](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf) |
| VIPER "Safe Haven" definition | Location with <= 50 h of darkness while Earth is below the horizon (other VIPER material quotes < 70 h / < 72 h hibernation shadow limits) | CHOICE | [VIPER-SB](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf); [VIPER-EN](https://ntrs.nasa.gov/api/citations/20230004239/downloads/SSR2023-VIPER-Planning-Ennico.pdf); [NASA VIPER planning overview](https://www.nasa.gov/wp-content/uploads/2022/05/overview_of_mission_planning_for_the_viper_rover.pdf) |
| Definition of "Earth visible" in the GSFC maps | Any part of Earth's disc unobscured - therefore slightly optimistic for radio links restricted to DSN stations | RULE (method caveat) | [PGDA69](https://pgda.gsfc.nasa.gov/products/69) |
| Best-site multi-year averages | 92% solar availability vs only 51% DTE availability | Result | [JPL IPN PR 42-176](https://ipnpr.jpl.nasa.gov/progress_report/42-176/176C.html) |

- Geography of Earth visibility: the farther a site lies past the pole toward the far side, the less likely Earth is visible (possibly only from high terrain); low terrain on the Earth-facing side can also lose Earth view at times; no single location constantly or even routinely has ideal lighting and Earth visibility together, but sites can be identified that are available over specific periods. - [WP-SITE](https://ntrs.nasa.gov/api/citations/20230016267/downloads/Lunar%20Site%20Selection.pdf)
- The lunar seasonal cycle and relay infrastructure do not coincide, so an early landing site would likely depend on direct-to-Earth comm, i.e. Earth must be in the sky at the site; relays (and Gateway in NRHO) would relax this and open more sites/dates. - [WP-SITE](https://ntrs.nasa.gov/api/citations/20230016267/downloads/Lunar%20Site%20Selection.pdf); [IAC22](https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf)
- Region-selection logic: assessments moved to end-to-end mission availability evaluated on a calendar basis (launch opportunities, transit/rendezvous geometry, communications, landing performance, surface illumination, terrain safety together). If DTE is used, regions with greater Earth visibility are preferred. Individual regions usually offer few viable opportunities when all constraints hold simultaneously, so more than one region must be kept to maintain acceptable annual availability. No per-region numbers are given. - [LPSC26](https://ntrs.nasa.gov/citations/20250011660)
- 2022 framing: the set of 13 regions was chosen so that there are landing options for every potential Artemis III launch opportunity through the year; specific sites are tightly tied to launch timing and are chosen only after target launch dates are set, because those dates fix transfer trajectories and surface conditions. Same statement repeated for the nine regions in 2024. - [REL22](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/); [REL24](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/)
- Region lists. 2022 (13): Faustini Rim A, Peak Near Shackleton, Connecting Ridge, Connecting Ridge Extension, de Gerlache Rim 1, de Gerlache Rim 2, de Gerlache-Kocher Massif, Haworth, Malapert Massif, Leibnitz Beta Plateau, Nobile Rim 1, Nobile Rim 2, Amundsen Rim. 2024 (9): Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater Plain. - [REL22](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/); [REL24](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/)
- NRHO itself has 100% Earth visibility and long south-pole visibility during apolune passes with a short dropout near perilune - relevant if a spacecraft in NRHO is used as relay. - [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf); [NRHO-WS](https://www.nasa.gov/wp-content/uploads/2023/10/nrho-artemis-orbit.pdf)

### Inferences
- Earth's elevation at a polar site is driven by the libration in latitude (period = draconic month, 27.21 d; amplitude about ±6.7° = 5.15° orbit inclination + 1.54° obliquity) plus a smaller libration-in-longitude/diurnal term; Earth's ~1.9° disc means partial visibility around rise/set. These are textbook values, not sourced in this research.
- Derived phase relationship (this researcher's derivation from Cassini's laws; verify numerically): the Earth-up fortnight and the Sun-azimuth cycle beat with a period equal to the draconic year (1/(1/27.2122 - 1/29.5306) = 346.6 d). At south-summer solstice, Earth is highest at Full Moon, i.e. when the Sun stands at the Earth-facing (0° longitude) azimuth; at winter solstice Earth is highest at New Moon (Sun over the far side); at the equinoxes Earth is highest near the quarter phases. Consequently the overlap between "site lit" and "Earth visible" for a given site repeats with the lunar seasonal cycle and drifts ~18.6 days earlier each calendar year - which explains why NASA speaks of region availability "by launch date/epoch".
- Practical consequence for ranking: sites whose terrain horizon is open toward the Earth-facing azimuths (north side of massifs such as Malapert / Mons Mouton) get lighting and Earth view in phase during summer; sites lit mainly when the Sun is over the far side have lighting and Earth visibility out of phase in summer.
- A per-site window = intersection of (Sun-lit interval of length >= stay) with (Earth disc above local horizon, ideally with a margin of a degree or two and restricted to times when a ground station is in view) with (trajectory opportunities). The app should let the user switch off the Earth-visibility constraint to model relay coverage.

### Gaps
- No published table of Earth-visibility/lighting overlap per Artemis candidate region and month was found; NASA's statements are qualitative.
- No explicit NASA statement found on the minimum Earth elevation (mask angle) required for HLS direct-with-Earth links, nor on whether DTE is required specifically during powered descent in the new 2028 architecture.

---

## Orbital-mechanics constraints for Artemis: NRHO, surface-stay coupling, eclipse avoidance, SLS/Orion launch windows, HLS constraints, opportunities per month/year

### Takeaway
In the (now superseded) NRHO design, a lander could descend only once per NRHO revolution (~6.56 days, ~55 opportunities/year), SLS Block 1/Orion could reach NRHO for only about half of them (~28 NRHO-departure opportunities/year), and the stay was fixed at about one revolution minus transfers (5.75-6.5 days); Starship HLS had to be used within about 90 days of arriving in NRHO. Orion-side constraints that still apply to any SLS/Orion mission are the <= 90-minute eclipse limit, daylight splashdown, the ~2-weeks-on/2-weeks-off Block 1 launch pattern and consumables (21 days for 4 crew).

### Cited Findings

**NRHO parameters (legacy staging orbit)**

| Parameter | Value | Source |
|---|---|---|
| Family / resonance | L2 southern NRHO, 9:2 lunar synodic resonance (9 revs per 2 synodic months), phased to avoid Earth eclipses | [LEE19](https://ntrs.nasa.gov/api/citations/20190030294/downloads/20190030294.pdf) |
| Mean period | 6.562 days | [LEE19](https://ntrs.nasa.gov/api/citations/20190030294/downloads/20190030294.pdf) |
| Perilune radius | 3196-3557 km, mean 3366 km | [LEE19](https://ntrs.nasa.gov/api/citations/20190030294/downloads/20190030294.pdf) |
| Apolune radius | Mean ~71,100 km, range ~70,005-71,849 km (reported in NASA/AAS NRHO papers via search summary; exact document not verified) | [NTRS AAS paper (Davis et al.)](https://ntrs.nasa.gov/api/citations/20220010495/downloads/AAS_Charlotte_DavSchWilSprMigHow.pdf) |
| Rounded figures used in NASA briefings | Periapsis ~1500 km, apoapsis nearly 70,000 km, period ~6.5 d; elsewhere "1000 km x 70,000 km, 7 days" | [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf); [NRHO-WS](https://www.nasa.gov/wp-content/uploads/2023/10/nrho-artemis-orbit.pdf) |
| Reference trajectory | 15 years, 2 Jan 2020 - 11 Feb 2035, SPICE SPK kernel on NAIF server; DE430; lunar gravity GRGM660PRIM 8x8; mean correction 1.86 mm/s per rev | [LEE19](https://ntrs.nasa.gov/api/citations/20190030294/downloads/20190030294.pdf) |
| Earth-shadow eclipses if not avoided | Up to ~5 h overall, > 2.6 h total - beyond Gateway/Orion hardware limits; avoided by resonance phasing (except two grazing partials in years 14-15) | [LEE19](https://ntrs.nasa.gov/api/citations/20190030294/downloads/20190030294.pdf) |
| Moon-shadow eclipses in NRHO | Several per year, always < 80 minutes (within hardware limits) | [LEE19](https://ntrs.nasa.gov/api/citations/20190030294/downloads/20190030294.pdf) |
| Phasing slots | Two possible eclipse-avoiding phasing slots; Gateway uses one; a satellite in the other slot plus Gateway would give continuous south-pole comm | [LEE19](https://ntrs.nasa.gov/api/citations/20190030294/downloads/20190030294.pdf) |
| Access time NRHO to surface | ~0.5 day; delta-v transfer ~750 m/s each way, descent ~2,050 m/s, ascent ~1,860 m/s (notional) | [NRHO-WS](https://www.nasa.gov/wp-content/uploads/2023/10/nrho-artemis-orbit.pdf); [LEE19](https://ntrs.nasa.gov/api/citations/20190030294/downloads/20190030294.pdf) |
| Earth view / comm | Orbit always faces Earth: continuous Earth comm; long south-pole visibility at apolune, short dropout at perilune | [NRHO-WS](https://www.nasa.gov/wp-content/uploads/2023/10/nrho-artemis-orbit.pdf) |

**How the NRHO period set landing/ascent opportunities and stay length (legacy)**

| Item | Value | Source |
|---|---|---|
| Descent opportunities | With a fixed NRHO, descent possible once every 6.5 days: ~55 opportunities to land per year | [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf) |
| Crewed-mission opportunities | Earth/Moon orbital mechanics and SLS/Orion limits reduce this to ~28 NRHO departure opportunities per year | [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf) |
| HLS opportunity counts in scans | 557 opportunities in a 10-year scan from 3 Sep 2024 (Malapert, lat -86.0°, lon 2.4°); 56 HLS missions between 6 Oct 2024 and 30 Sep 2025; 80 nominal HLS missions 16 Mar 2024 - 25 Aug 2025 | [HLS-MD](https://ntrs.nasa.gov/api/citations/20230002566/downloads/HLS%20NRHO%20to%20Lunar%20Surface%20and%20Back%20Mission%20Design_STRIVES.pptx.pdf) |
| Effect of adding lighting + loiter + Orion limits (2019 study) | With "lighting at any site", 3-day loiter and 8-day max Orion outbound applied to the 80 HLS missions of Mar 2024 - Aug 2025: 42 Orion mission opportunities, 13 HLS missions accessible | [HLS-MD](https://ntrs.nasa.gov/api/citations/20230002566/downloads/HLS%20NRHO%20to%20Lunar%20Surface%20and%20Back%20Mission%20Design_STRIVES.pptx.pdf) |
| Nominal HLS sequence | Separate from Orion/Gateway in NRHO; two-burn 12-h transfer to 100 km circular LLO; loiter 3-4 revs (2 full revs + phasing rev); DOI to 100 x 15.24 km; PDI near perilune; ~6-day stay; ascent to 100 x 15.24 km; circularise; loiter 3-4 revs; 12-h transfer; NRHO insertion; RPOD | [HLS-MD](https://ntrs.nasa.gov/api/citations/20230002566/downloads/HLS%20NRHO%20to%20Lunar%20Surface%20and%20Back%20Mission%20Design_STRIVES.pptx.pdf) |
| Stay = one NRHO period | Crew stay ~6.5 days "(one NRHO period)" | [IAC25](https://ntrs.nasa.gov/api/citations/20250008727/downloads/IAC%2025%20B3%201%20v3.pdf) |
| RPOD blackout | No rendezvous within ±6 h of NRHO perilune; full RPOD with re-attempts up to 12 h, so RPOD cannot start after perilune minus 18 h | [HLS-MD](https://ntrs.nasa.gov/api/citations/20230002566/downloads/HLS%20NRHO%20to%20Lunar%20Surface%20and%20Back%20Mission%20Design_STRIVES.pptx.pdf) |
| Surface abort to NRHO (Connecting Ridge, epoch 14 Nov 2024) | Min-time aborts with in-space delta-v <= ~1554 m/s: abort transfer 1-3.8 days, total mission up to 9 days, no coverage gaps; nominal NRD+LOI 704.5 m/s; nominal return 0.75 d | [HLS-MD](https://ntrs.nasa.gov/api/citations/20230002566/downloads/HLS%20NRHO%20to%20Lunar%20Surface%20and%20Back%20Mission%20Design_STRIVES.pptx.pdf) |
| Descent approach direction | Varies orbit to orbit; scans were run for different powered-descent approach directions; nominal descent is coplanar with the LLO plane | [HLS-OV](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf); [HLS-MD](https://ntrs.nasa.gov/api/citations/20230002566/downloads/HLS%20NRHO%20to%20Lunar%20Surface%20and%20Back%20Mission%20Design_STRIVES.pptx.pdf) |
| HLS usable lifetime in NRHO | Expected viable for a landing for about 90 days after reaching NRHO; crew must arrive within that window; carrying several landing-site options maximises the chance of a landing within it | [WP-SITE](https://ntrs.nasa.gov/api/citations/20230016267/downloads/Lunar%20Site%20Selection.pdf) |
| Boil-off | Copernicus HLS model includes propellant boil-off; the depot is optimised to limit cryogenic boil-off (no numbers given) | [HLS-MD](https://ntrs.nasa.gov/api/citations/20230002566/downloads/HLS%20NRHO%20to%20Lunar%20Surface%20and%20Back%20Mission%20Design_STRIVES.pptx.pdf); [IAC25](https://ntrs.nasa.gov/api/citations/20250008727/downloads/IAC%2025%20B3%201%20v3.pdf) |

**SLS / Orion launch-window constraints**

| Constraint | Value | Type | Source |
|---|---|---|---|
| Orion eclipse limit | Not in darkness more than 90 minutes at a time; launch days producing longer eclipses are removed (or mitigated by trajectory tailoring within propellant margin) | REQ | [A1-AVAIL](https://www.nasa.gov/missions/artemis/artemis-i-mission-availability); [IAC22](https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf) |
| Transit eclipses | Earth-Moon transit or phasing can produce multi-hour shadows, tied to lunar-month phase and solar season | RULE | [IAC22](https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf) |
| Splashdown | Daylight at splashdown; skip-entry trajectory; target off San Diego | REQ | [A1-AVAIL](https://www.nasa.gov/missions/artemis/artemis-i-mission-availability); [IAC22](https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf) |
| TLI geometry (Block 1) | Elliptical parking orbit ties launch availability to lunar position: a few days up to two weeks per month; Orion can reach lunar orbit for roughly half of the Moon's orbit, nearly centred on the Moon's minimum declination | RULE | [IAC22](https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf); [WP-SITE](https://ntrs.nasa.gov/api/citations/20230016267/downloads/Lunar%20Site%20Selection.pdf) |
| Launch-period pattern (Artemis I, Block 1) | ~2 weeks of opportunities then ~2 weeks without; 2022 periods had 11-15 launch days each (e.g. 23 Aug-6 Sep: 12; 19 Sep-4 Oct: 15; 17-31 Oct: 11; 12-27 Nov: 12; 9-23 Dec: 11) | Worked example | [A1-AVAIL](https://www.nasa.gov/missions/artemis/artemis-i-mission-availability) |
| NRHO rendezvous timing | Fixed transit would allow rendezvous only once per ~7 days; variable short/long-class transits let several consecutive launch days target the same NRHO arrival; best insertion on the apolune approach | CHOICE | [IAC22](https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf) |
| Orion consumables | 4 crew for up to 21 days; assumed Orion total 84 crew-days and >= 5-day outbound in rescue study | REQ / assumption | [IAC22](https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf); [AAS25](https://ntrs.nasa.gov/api/citations/20250002331/downloads/AAS%2025-205%20PradoPino%20and%20Condon.pdf) |
| Earth-entry target line | Re-aligns every ~1.03 days (tidal day), giving daily return options per NRHO rev | RULE | [AAS25](https://ntrs.nasa.gov/api/citations/20250002331/downloads/AAS%2025-205%20PradoPino%20and%20Condon.pdf) |
| Orion must arrive in NRHO before HLS departure and leave after HLS return | - | REQ (logical) | [AAS25](https://ntrs.nasa.gov/api/citations/20250002331/downloads/AAS%2025-205%20PradoPino%20and%20Condon.pdf) |
| Apollo comparison | One prime launch day per month (two with variations) for J-missions | Historical | [IAC22](https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf) |
| Crew timeline | Burns and events must fit crew workdays; docked prep time before descent sets a minimum rendezvous-to-descent interval | RULE | [IAC22](https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf) |

- Definition: "mission availability" = number/frequency of viable launch days per period for which the entire end-to-end mission meets every vehicle's constraints; it is the intersection of all constraints. - [IAC22](https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf)
- Mapping regions to launch periods: NASA never published a table; it states that sites are chosen after launch dates are known and that the multi-region set exists to keep availability across the calendar. - [REL24](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/); [LPSC26](https://ntrs.nasa.gov/citations/20250011660)

### Inferences
- 365.25 / 6.562 = 55.7 NRHO revs per year, matching "~55"; ~28 crewed opportunities is about half, consistent with SLS Block 1 reaching the Moon for about half of each lunar orbit.
- Perilune altitude = radius - 1737.4 km = ~1460-1820 km (mean ~1630 km), consistent with the "~1500 km" briefing figure; the "1000 km" figure in the workshop deck is a rounder approximation.
- Because the NRHO is 9:2 resonant with the synodic month, the Sun azimuth at successive landing opportunities advances by 360° x 6.562/29.53 = ~80° per revolution, so in the legacy design landing opportunities sampled only nine repeating Sun azimuths (40° apart) - one reason individual regions were viable on few dates. (Derived; not stated by NASA.)
- Stay length arithmetic in the legacy design: 6.56 d period minus two ~0.5 d transfers minus LLO loiter (several ~2 h revs each way) plus timing flexibility gives the published 5.75-6.25 d.
- In the 2026 architecture the lander is no longer pre-staged in NRHO, so the "90-day HLS viability" clock and the once-per-6.5-day descent cadence presumably no longer apply in that form; what replaces them is unpublished.

### Gaps
- No public numbers for the new architecture: LLO altitude/inclination, elliptical polar orbit size, Orion's ability to enter/leave LLO with a Starship-provided TLI, launch periods per month, or landing-opportunity cadence.
- Quantitative Starship HLS boil-off/loiter limits were not found in primary sources (only the "about 90 days" figure for NRHO).
- NASA's internal region-versus-calendar availability charts (shown at LEAG 2022/2024) were not retrievable as text.

---

## Robotic-mission practice: how real missions chose landing dates

### Takeaway
Solar-powered landers time touchdown for early in the local lit period and plan operations until local sunset (7-14 days), while south-polar missions additionally wait for the summer season: VIPER and Chang'e-7 both have launch periods tied to seasonal lighting, and missing the season means a wait of most of a year. Published Sun-elevation-at-landing values were not found for any of these missions.

### Cited Findings

| Mission | Landing date / plan | Site | Timing logic and duration | Source |
|---|---|---|---|---|
| Chandrayaan-3 (ISRO) | 23 Aug 2023, 12:33 UTC | ~69°S, 32°E ("Shiv Shakti") | Landed shortly after local sunrise to use a full period of lunar daylight (~14 Earth days); wake-up attempt planned at next local sunrise, 22 Sep 2023 | [Planetary Society](https://planetary.org/space-missions/chandrayaan-3); [Wikipedia](https://Www.Wikipedia.org/wiki/Chandrayaan-3) |
| IM-1 Odysseus (Intuitive Machines / CLPS) | 22 Feb 2024 | Near Malapert A, ~5° from the south pole | Planned ~7 days of operations before lunar night set at the site (later quoted 8-9 days); ended 28/29 Feb 2024 (sources differ) after landing ~1.5 km off target on a 12° slope | [EarthSky](https://earthsky.org/spaceflight/im-1-lunar-lander-makes-valentines-day-liftoff/); [Astronomy.com](https://www.astronomy.com/space-exploration/odysseus-traveled-to-the-moon-broke-its-leg-and-still-pinged-earth-to-tell-the-story/) |
| IM-2 Athena (CLPS) | Launched 26 Feb 2025, lunar orbit 3 Mar, landed 6 Mar 2025 17:31 UTC | Mons Mouton, ~160 km from the pole | Planned ~10 Earth days on the surface until local sunset; planned to image the 14 Mar 2025 eclipse; ended up on its side in a crater 250 m from target and could not recharge | [collectSPACE](https://www.collectspace.com/news/news-030625a-intuitivie-machines-im2-athena-moon-landing.html); [Space.com](https://www.space.com/the-universe/moon/intuitive-machines-lands-private-athena-lander-near-moon-south-pole-historic-touchdown) |
| Blue Ghost M1 (Firefly / CLPS; not polar - Mare Crisium, included as eclipse example) | Landed 2 Mar 2025 | Mare Crisium | Operated > 14 days (one lunar day); ran on batteries through the 14 Mar 2025 eclipse (total lunar eclipse = solar eclipse at the lander); imaged sunset 16 Mar and worked ~5 h into the night | [Firefly](https://fireflyspace.com/news/firefly-aerospace-successfully-completes-14-days-of-surface-operations-on-the-moon); [Smithsonian](https://www.smithsonianmag.com/smart-news/see-last-weeks-stunning-eclipse-from-the-moon-in-photos-captured-by-the-blue-ghost-lander-now-at-the-end-of-its-mission-180986253/) |
| VIPER (original Griffin plan) | Landing planned Nov 2023, then Nov 2024 (later Sep 2025 launch); cancelled July 2024 | Mons Mouton / Nobile region | 100+ Earth-day mission in south-polar summer, several lunar days ("legs") separated by hibernation at Safe Havens while Earth is down; slipping past Nov 2025 would have meant waiting 9-12 months for suitable lighting | [VIPER-SB](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf); [VIPER-EN](https://ntrs.nasa.gov/api/citations/20230004239/downloads/SSR2023-VIPER-Planning-Ennico.pdf); [Planetary Society](https://www.planetary.org/articles/nasa-cancels-viper) |
| VIPER (revived) | Sept 2025: CLPS task order to Blue Origin (~$190M), delivery on the second Blue Moon Mark 1, target late 2027; a June 2026 newsletter judges second half of 2028 more likely because the first Mark 1 slipped (no earlier than 2H 2027) and polar lighting is favourable only at certain times | South polar region | Needs favourable lighting along traverse routes | [Space.com](https://www.space.com/astronomy/moon/viper-lives-jeff-bezos-blue-origin-will-land-ice-hunting-nasa-rover-on-the-moon-in-2027); [Moon Monday 277](https://jatan.space/moon-monday-issue-277/) |
| Chang'e-7 (CNSA) | NOTAM window opened 24 Aug 2026 00:00 UTC with daily 00:00-04:00 UTC windows to 31 Aug; on 23 Aug 2026 the launch was postponed (cannot occur in this year's window; reported as 2027); a pre-delay source expected landing in Nov 2026 | Illuminated rim of Shackleton crater | Launch only possible when landing coincides with best lighting at Shackleton, so opportunities are rarer than for other landers | [SpacePolicyOnline](https://spacepolicyonline.com/?p=90081); [Scientific American](https://scientificamerican.com/article/chinas-change-7-moonshot-will-seek-water-ice-at-the-lunar-south-pole) |
| Blue Moon Mark 1 "Endurance" (first flight) | Was end-2026; expected no earlier than 2H 2027 | Lunar south pole | Lighting at the polar site favourable only during certain times constrains launch/landing windows | [Moon Monday 277](https://jatan.space/moon-monday-issue-277/) |

**VIPER planning numbers (most complete published robotic south-pole planning dataset)**

| Parameter | Value | Source |
|---|---|---|
| Mission duration | 100+ Earth days (>90 days in 2023 abstract); up to 20 km driving | [VIPER-SB](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf); [VIPER-EN](https://ntrs.nasa.gov/api/citations/20230004239/downloads/SSR2023-VIPER-Planning-Ennico.pdf) |
| Transit | ~5 days lunar transfer + ~5 days lunar orbit before descent | [VIPER-SB](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf) |
| Leg | One lunar day (~10-14 Earth days of operations); starts at landing site or a Safe Haven | [VIPER-EN](https://ntrs.nasa.gov/api/citations/20230004239/downloads/SSR2023-VIPER-Planning-Ennico.pdf) |
| Safe Haven | Sustained sunlight with shadow periods < 50 h, where the rover waits for the next Earthrise | [VIPER-EN](https://ntrs.nasa.gov/api/citations/20230004239/downloads/SSR2023-VIPER-Planning-Ennico.pdf) |
| Speed | Up to 20 cm/s; effective "speed made good" ~1 cm/s - comparable to the speed of moving Sun and radio shadows | [VIPER-EN](https://ntrs.nasa.gov/api/citations/20230004239/downloads/SSR2023-VIPER-Planning-Ennico.pdf); [VIPER-SB](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf) |
| Site requirements | Volatiles, Sun illumination, traversable terrain (15° slope limit), direct-to-Earth comm - all four needed; preference for multi-lunar-day mission | [VIPER-SB](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf) |
| Tracked plan metrics | Time to Sun shadow, time to DSN shadow, stations visited, odometry | [VIPER-EN](https://ntrs.nasa.gov/api/citations/20230004239/downloads/SSR2023-VIPER-Planning-Ennico.pdf) |
| Robustness tests | Plans tested against landing-time error, power, speed, DSN failures and solar energetic proton events; delays cascade because later Sun/comm windows are tight | [VIPER-EN](https://ntrs.nasa.gov/api/citations/20230004239/downloads/SSR2023-VIPER-Planning-Ennico.pdf) |
| Plan cadence | Strategic plan baselined at launch minus 1 year, updated monthly during hibernation; tactical plans per lunar day | [VIPER-EN](https://ntrs.nasa.gov/api/citations/20230004239/downloads/SSR2023-VIPER-Planning-Ennico.pdf) |

### Inferences
- VIPER's Nov 2024 landing with a ~100-day mission brackets the computed south-summer solstice of 23 Dec 2024; Chang'e-7's late-Aug 2026 launch for a reported Nov 2026 landing brackets the computed solstice of 17 Nov 2026; a 2027 retry would need to target the season around 30 Oct 2027. This supports using "solstice ± ~50-60 days" as the robotic south-pole season in the app.
- IM-1 (22 Feb 2024) and IM-2 (6 Mar 2025) both landed 1.5-2.5 months after a south-summer solstice (11 Jan 2024, 23 Dec 2024), i.e. still in the summer half of the cycle, and both planned roughly 7-10 days until local sunset rather than a full 14 days - consistent with terrain-shortened lit periods at 80-85°S.
- The 14 Mar 2025 eclipse fell close to the computed lunar equinox of 18 Mar 2025, illustrating that eclipses cluster at the polar equinoxes, not in mid-summer.

### Gaps
- Sun elevation/azimuth at touchdown and the explicit date-selection rationale were not found in press kits for IM-1, IM-2 or Chandrayaan-3 (the reviewed sources give only "after sunrise"/"until sunset" statements).
- Luna-25 (Aug 2023) and Griffin Mission 1 timing were not researched to a citable level in this session.
- Chang'e-7's new launch period in 2027 and its relay arrangement were not confirmed.

---

## Other time-varying factors: eclipses, thermal, space weather, meteoroids, 18.6-year cycle, relays, ground stations

### Takeaway
Lunar eclipses (2-3 per year, total phase up to ~1.7 h, partial phases ~3.5 h) are precisely predictable and fall near the lunar polar equinoxes, away from mid-summer; relay satellites that would lift the Earth-visibility constraint are only planned from about 2026-2027; the 18.6-year cycle mainly shifts when seasons fall in the calendar. Space-weather and meteoroid timing criteria for landing dates were not found in authoritative form.

### Cited Findings

**Lunar eclipses 2026-2032 (Earth's shadow on the Moon = solar eclipse for a lander).** Times are Terrestrial Time of greatest eclipse. - [NASA eclipse page 2021-2030](https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2021.html); [NASA eclipse page 2031-2040](https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2031.html)

| Date | TD of greatest eclipse | Type | Umbral magnitude | Partial-phase duration | Total-phase duration |
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

Later total eclipses to 2040: 2033 Apr 14 (0h49m), 2033 Oct 08 (1h19m), 2036 Feb 11 (1h14m), 2036 Aug 07 (1h35m), 2037 Jan 31 (1h04m), 2040 May 26 (1h32m), 2040 Nov 18 (1h28m). - [NASA eclipse page 2031-2040](https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2031.html)

- Eclipse operations example: Blue Ghost ran solely on battery power during the 14 Mar 2025 eclipse; reported surface temperatures without sunlight fall below -100°C (night lows quoted near -170°C). - [Smithsonian](https://www.smithsonianmag.com/smart-news/see-last-weeks-stunning-eclipse-from-the-moon-in-photos-captured-by-the-blue-ghost-lander-now-at-the-end-of-its-mission-180986253/); [Moon Monday 217](https://jatan.space/moon-monday-issue-217.md)
- Thermal rationale for lighting constraints: continuous sunlight gives power and reduces temperature swings; long-lit "oases" give more constant thermal conditions and need less battery to survive shadow. - [REL22](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/); [WP-POLE](https://www.nasa.gov/wp-content/uploads/2023/10/acr22-wp-why-lunar-south-polar-region.pdf)
- 18.6-year cycle in NASA products: average illumination and Earth-visibility maps are averaged over one lunar nutation/precession cycle (~18.6 years) precisely because conditions at a site vary across that cycle; Barker et al. plot the Sun's altitude over 18.6 years from 1 Jan 2024 against site horizons. - [PGDA69](https://pgda.gsfc.nasa.gov/products/69); [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf)
- Relay timing: NASA's Near Space Network contract with Intuitive Machines (potentially $4.82B) covers a five-satellite lunar comm/nav constellation aimed at continuous coverage especially at the south pole; first satellite planned on IM-3 (announced as 2026), two more on IM-4 (no earlier than 2H 2027). Whether IM-3 has flown was not confirmed. - [Payload](https://payloadspace.com/intuitive-machines-will-build-a-lunar-communications-network); [Space.com](https://www.space.com/space-exploration/spacex-to-launch-fourth-intuitive-machines-moon-lander-lunar-satellites-in-2027)
- Relay effect per NASA: relays could fully mitigate location/libration constraints if enough relays and suitable timing exist; Gateway in NRHO would also relay to the south pole. - [IAC22](https://ntrs.nasa.gov/api/citations/20220012445/downloads/IAC2022_LunarMissionAvailability_Paper.docx.pdf)
- Ground stations: the GSFC Earth-visibility maps count any part of the Earth's disc, so they are optimistic for DSN-only links; VIPER plans tracked "time to DSN shadow" and scheduled DSN passes/handovers and injected DSN failures in robustness tests. - [PGDA69](https://pgda.gsfc.nasa.gov/products/69); [VIPER-EN](https://ntrs.nasa.gov/api/citations/20230004239/downloads/SSR2023-VIPER-Planning-Ennico.pdf)
- Space weather (weak, secondary sourcing): commentary in 2026 notes solar cycle 25 peaked around 2024 and is declining toward a minimum around ~2031; forecasts give only ~24-48 h warning of solar particle events; the Aug 1972 event occurred in a declining phase between Apollo 16 and 17. No NASA launch/landing date criterion based on solar-cycle phase was found. - [New Space Economy (secondary)](https://newspaceeconomy.ca/2026/04/08/how-does-space-weather-affect-the-artemis-missions/)
- Solar energetic proton events are treated in VIPER planning as an operational contingency injected into plans, not as a date-selection criterion. - [VIPER-EN](https://ntrs.nasa.gov/api/citations/20230004239/downloads/SSR2023-VIPER-Planning-Ennico.pdf)

### Inferences
- Computed lunar equinox dates (table in the lighting section) line up with every eclipse above (e.g. equinox 26 Jun 2029 vs the deep total eclipse of 26 Jun 2029; 27 Feb 2026 vs 3 Mar 2026; 4 Jan 2029 vs 31 Dec 2028). Therefore a mission in south-polar mid-summer cannot experience an umbral lunar eclipse; eclipses matter for missions operating around the equinoxes (about 87 days before/after each solstice) or surviving across seasons. The 31 Dec 2028 total eclipse falls ~81 days after the 11 Oct 2028 solstice - relevant to a late-2028 landing with long-lived surface assets.
- For the app, an eclipse is a 3-3.5 h power/thermal outage with <= 1.7 h of totality; whether it is acceptable depends on battery capacity (compare VIPER's 50 h dark survival, Orion's 90 min eclipse limit).
- Effect of the 18.6-year nodal cycle (reasoning, not sourced): the amplitudes of Sun (±1.54°) and Earth (about ±6.7°) elevation swings at the pole do not change, because lunar obliquity and orbital inclination to the ecliptic are constant; what changes is the calendar date of the seasons (full circuit through the calendar every 18.6 years) and the detailed combination of Sun azimuth/elevation each month, so exact lit intervals at a site do not repeat year to year and multi-year statistics should span 18.6 years (as NASA's maps do).
- Relay availability for a 2028 landing cannot be assumed; the conservative default is "direct-to-Earth required".

### Gaps
- No authoritative source collected for: NOAA/NASA solar-cycle minimum forecast, crewed-mission solar-particle-event flight rules, meteoroid-stream avoidance criteria (e.g. NASA Meteoroid Environment Office forecasts), or surface thermal limits versus Sun elevation at landing.
- Status of lunar relay satellites actually in orbit as of Nov 2026 (IM-3 relay, ESA Lunar Pathfinder, Queqiao-2 use by non-Chinese missions) and of NASA's LEGS ground stations was not confirmed.

---

## Methods used to compute windows: horizon masks, DEMs, ephemerides and frames, extended Sun, time steps, accuracy, tools and published calendars

### Takeaway
The standard method is the horizon-elevation method of Mazarico et al. (2011): precompute, for each DEM pixel (or site), the terrain horizon elevation versus azimuth from LOLA DEMs (nested resolutions; 5 m near field for site work), then at each time step compare the Sun's (or Earth's) disc from a SPICE ephemeris against that horizon to get the visible disc fraction; typical time steps are 1-2 h. Window finding is then a search over the resulting time series for intervals satisfying stay-length and comm conditions, as VIPER's "Safe Haven" search did; no public NASA "landing calendar" with dates for 2027-2030 was found.

### Cited Findings

| Method element | Published practice | Source |
|---|---|---|
| Core algorithm | Horizon method: horizon elevation from every pixel along azimuthal sight lines; then Sun position vs horizon at each epoch | [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf); [MAZ11](https://ntrs.nasa.gov/citations/20120010094) |
| Azimuth sampling | 720 sight lines at 0.5° spacing (Barker 2021); a later-paper description of the original method cites 36 directions (unverified, from a search summary) | [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf) |
| Nested DEMs | New 5 m/pix LDEM for distances < 5 km, 80 m/pix for 5-100 km, 240 m/pix beyond; much cheaper than single resolution | [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf) |
| Near vs far horizon | Near-field horizon typically ~100 m away (tens of m to ~1 km), far-field ~50-200 km away; far-field changes negligibly between nearby points | [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf) |
| Original regional product | 240 m/pix LOLA polar DEMs to 75° latitude; illumination computed out to 80°; validated against LROC WAC images; 6 h step over several 18.6-yr cycles (abstract); PGDA describes hourly steps over one 18.6-yr cycle, later updated with better maps | [MAZ11](https://ntrs.nasa.gov/citations/20120010094); [PGDA69](https://pgda.gsfc.nasa.gov/products/69) |
| Sun model | Finite disc (extended source), with limb darkening at 550 nm in Barker 2021; visible fraction approximated by cutting the disc horizontally at the horizon elevation at the disc-centre azimuth; Gläser et al. also treat the Sun as an extended source | [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf); [PGDA69](https://pgda.gsfc.nasa.gov/products/69); [Gläser et al. EPSC 2017](https://meetingorganizer.copernicus.org/EPSC2017/EPSC2017-693-3.pdf) |
| Earth visibility | Same machinery with the Earth as the source; "visible" if any part of the disc is unobscured | [PGDA69](https://pgda.gsfc.nasa.gov/products/69) |
| Time step | 1 h (Barker 2021; Gläser 2018; PGDA averages); 2 h (NASA SVS animations); 6 h (Mazarico 2011 abstract) | [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf); [Gläser 2018](https://elib.dlr.de/119091); [NASA SVS 5027](https://svs.gsfc.nasa.gov/5027); [MAZ11](https://ntrs.nasa.gov/citations/20120010094) |
| Height above ground | Evaluated at 1 m and 5 m (Barker), surface / 2 m / 10 m (Gläser 2014), 2 m panel height (Gläser 2018) | [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf); [Gläser 2014](https://elib.dlr.de/94240/); [Gläser 2018](https://elib.dlr.de/119091) |
| Metrics | Average illumination (mean visible disc fraction), LCIP, LCSP; note that average illumination does not say when or how much of the Sun is visible | [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf) |
| Reference frame | Mean Earth/Polar Axis (MOON_ME) frame of DE421, consistent with LRO products; differs from principal-axis frame at the few-metre level | [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf) |
| SPICE lunar orientation kernels | DE440: `moon_pa_de440_200625.bpc` with frame kernel `moon_de440_220930.tf`, coverage ~1550-2650; DE421: `moon_pa_de421_1900-2050.bpc` with `moon_080317.tf`; DE418: `moon_pa_de418_1950-2050.bpc` with `moon_071218.tf` (all principal-axis orientation; ME frames defined in the frame kernels) | [NAIF PCK readme](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/aareadme.txt) |
| Ephemerides in NASA trajectory work | Copernicus HLS design: GRAIL GL0660B 8x8 gravity, Earth/Sun third bodies from DE421; NRHO reference: DE430; NASA SVS lighting: LOLA + DE421 | [HLS-MD](https://ntrs.nasa.gov/api/citations/20230002566/downloads/HLS%20NRHO%20to%20Lunar%20Surface%20and%20Back%20Mission%20Design_STRIVES.pptx.pdf); [LEE19](https://ntrs.nasa.gov/api/citations/20190030294/downloads/20190030294.pdf); [NASA SVS 4875](https://svs.gsfc.nasa.gov/4875) |

**DEM resolution and accuracy**

| Item | Value | Source |
|---|---|---|
| LOLA sampling | 28 Hz, 5-spot pattern; from 50 km: 12 m cross-track between profiles, 57 m along-track, 5 m spot diameter; range precision ~10 cm; natural minimum pixel 5 m | [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf) |
| Fill factor | ~90% of 5 m pixels are interpolated (7-10% filled at 5 m; 69-78% at 20 m; 96-98% at 40 m) | [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf) |
| Improved 5 m LDEMs (4 sites, 16 x 16 km each: Site 1 connecting ridge, Site 4 Shackleton rim, Site 7 peak near Shackleton, Site 11 de Gerlache rim) | Track geolocation uncertainty ~10-20 cm horizontal, ~2-4 cm vertical; surface height RMS error ~0.30-0.50 m (median 0.37 m at Site 1; ~1% of pixels > 1 m; max 5.65 m); slope RMS error ~1.5-2.5° (median 1.90°) | [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf) |
| Uncertainty propagation | 100 Monte Carlo "clone" DEMs per site; illumination computed on each; 1st/99th percentiles reported (see Site 1 table in lighting section) | [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf) |
| PGDA gridded products | Average solar illumination, average Earth visibility, permanent shadow, sky visibility: 240 m/px (65-90°), 120 m/px (75-90°), 60 m/px (85-90°); polar stereographic on 1737.4 km sphere; IMG/JP2/GeoTIFF/COG; files e.g. `AVGVISIB_85S_060M_201608.IMG`, `AVGVISIB_*_201608_EARTH`, `LPSR_85S_060M_201608`; base URLs `http://imbrium.mit.edu/EXTRAS/ILLUMINATION/` and `https://pgda.gsfc.nasa.gov/data/MoonIllumination/` | [PGDA69](https://pgda.gsfc.nasa.gov/products/69) |
| Image resolution limits | Best lunar image data ~1 m, not available everywhere at the poles; site characterisation depends on data availability | [WP-SITE](https://ntrs.nasa.gov/api/citations/20230016267/downloads/Lunar%20Site%20Selection.pdf) |
| VIPER maps | Strategic: 20 m/pix LOLA DEM products (plus 4 m thermal maps); tactical: 1 m/pix shape-from-shading DEMs (Ames Stereo Pipeline) | [VIPER-EN](https://ntrs.nasa.gov/api/citations/20230004239/downloads/SSR2023-VIPER-Planning-Ennico.pdf) |

**Published tools, planners and time-resolved products**

| Tool / product | What it does | Source |
|---|---|---|
| VIPER Safe-Haven search | Compute horizons for all pixels of a ~3000 sq-mile DEM at 20 m spacing; compute lighting and Earth visibility per pixel over a 6-month period in 2023-24; search for intervals of Sun and Earth visibility meeting the 50 h dark-survival rule | [VIPER-SB](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf) |
| VIPER traverse planner | Cost-constrained travelling-salesman with time windows (stations and drives in sunlight; total time limited by Earth-above-horizon time); brute force 3-6 h runtime; later automated planners incl. the SHERPA AI system | [VIPER-SB](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf); [Aerospace America](https://aerospaceamerica.aiaa.org/departments/vipers-ai-assistant/) |
| NASA SVS "Illumination at the Moon's South Pole, 2023 to 2030" (ID 4930) | Yearly animations of sunlight/shadow within 2° of the pole at 2-hour steps from LOLA terrain | [NASA SVS 4930](https://svs.gsfc.nasa.gov/4930/) |
| NASA SVS "Illumination at the Moon's South Pole to 80°S, 2025 to 2028" (ID 5027) | Same for the region south of 80°S; 2-hour steps, 17,532 frames | [NASA SVS 5027](https://svs.gsfc.nasa.gov/5027) |
| JSC Copernicus + Initial Guess Generator (IGG) | End-to-end HLS trajectory optimisation and fast epoch/landing-site scans (10-year epoch scan in ~30 s; <1% delta-v error); terrain modelling for surface lighting and line-of-sight analyses was listed as future work in 2022 | [HLS-MD](https://ntrs.nasa.gov/api/citations/20230002566/downloads/HLS%20NRHO%20to%20Lunar%20Surface%20and%20Back%20Mission%20Design_STRIVES.pptx.pdf) |
| NRHO reference SPK | 15-year NRHO ephemeris on the NAIF server (`naif.jpl.nasa.gov/pub/naif/misc/MORE_PROJECTS/DSG/`) for timing legacy NRHO opportunities | [LEE19](https://ntrs.nasa.gov/api/citations/20190030294/downloads/20190030294.pdf) |
| Academic multi-criteria study (Peña-Asensio et al. 2024) | 1247 candidate locations meeting HLS requirements in the 13 regions; 5 m LOLA DEMs for visibility, 240 m illumination/PSR maps; best site "DM2" in Nobile Rim 2 | [arXiv 2406.19863](https://arxiv.org/html/2406.19863v2) |
| Earlier JSC site study (2010) | Earth and Sun access for thousands of locations from Kaguya altimetry in STK | [Georgia Tech-hosted AIAA 2010-8780](https://ssdl1.gatech.edu/sites/default/files/ssdl-files/papers/conferencePapers/AIAA-2010-8780.pdf) |
| Data access | Planetary Data System; LROC QuickMap named by NASA as the access tool | [WP-SITE](https://ntrs.nasa.gov/api/citations/20230016267/downloads/Lunar%20Site%20Selection.pdf) |

- Concrete dated analysis epochs that do appear in NASA documents (analysis cases, not announced windows): NRHO revolution of 1 Jan 2026 and all revolutions in 2026-2027 (rescue study); HLS epochs 14 Nov 2024, 12 Jan 2025, 30 May 2025, 25 Mar 2028; illumination statistics for 1 Jan 2024 - 1 Jan 2026. - [AAS25](https://ntrs.nasa.gov/api/citations/20250002331/downloads/AAS%2025-205%20PradoPino%20and%20Condon.pdf); [HLS-MD](https://ntrs.nasa.gov/api/citations/20230002566/downloads/HLS%20NRHO%20to%20Lunar%20Surface%20and%20Back%20Mission%20Design_STRIVES.pptx.pdf); [BARKER21](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf)

### Inferences
- Recommended computation chain for an app, assembled from the cited practice: (1) per site, build a 0.5°-azimuth horizon mask from nested LOLA DEMs (5-20 m within ~5 km, 60-240 m beyond, out to ~200 km or more), at the relevant height above ground; (2) with SPICE (DE440 + `moon_pa_de440_200625.bpc` + `moon_de440_220930.tf`, site coordinates in the ME frame to match LOLA) compute topocentric azimuth/elevation of Sun and Earth centres hourly; (3) convert to visible disc fraction (Sun angular radius ~0.27°, Earth ~0.95°); (4) scan for windows meeting stay length, Earth visibility, eclipse exclusion and trajectory cadence; (5) rank by margin (e.g. minimum Sun fraction, hours of slack before first shadow, Earth elevation margin).
- Sensitivity: with the Sun grazing at <= 1.5-7°, a height error of 0.4 m at a near-field obstacle 100 m away changes horizon elevation by ~0.2°, comparable to the Sun's radius - which is why Barker et al. report percentile ranges; an app using 20-60 m public DEMs should present window edges with an uncertainty of hours and total lit durations with a margin, and should avoid claiming metre-scale site precision.
- A 1 h step resolves window edges adequately (the Sun moves ~0.5° of azimuth per hour); edges can be refined by root-finding.

### Gaps
- No publicly released NASA "landing opportunity calendar" or list of Artemis landing dates per region for 2027-2030 was found; NASA states sites/dates follow from launch dates that are not yet set.
- Moon Trek / QuickMap lighting-tool capabilities were not verified in this session (searches returned no documentation).
- Mazarico et al. (2011) full text (number of horizon azimuths, Table 3 site coordinates) and Speyerer & Robinson (2013) were not retrieved; NASA's internal Artemis III lighting analysis reports are not public.
- Whether NASA's current analyses use DE440 rather than DE421/DE430 is not stated in the documents found.
