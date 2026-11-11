# South-pole site sources (Phase 1 reading list)

Primary sources for current CLPS and Artemis south-pole sites. Reading list only — the site data file (`app/public/data/sites.json`) is built at the event, not before. All URLs checked to load (HTTP 200) on 24 Oct 2026, re-checked 26 and 31 Oct; coordinates are quoted **exactly as written in the source**. Audit fixes from [sources-audit.md](../archive/sources-audit.md) applied 10 Nov 2026. What could not be verified is labeled **(unverified)**; our own conclusions are labeled **(ours)**.

**Frame of all coordinates below:** no site source names ME or PA. All are LRO-based, so MOON_ME planetocentric, east-positive is the likely frame **(inferred, not stated)**. Only VIPER (Beyer et al. 2025) names its datum. See [primer.md](primer.md#coordinate-frames-which-one-we-use).

## Artemis III candidate regions (13 regions, 2022)

**Source:** [NASA news release, 19 Aug 2022 (last updated 8 Jan 2024)](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon) — names the 13 regions (no coordinates on the page): Faustini Rim A · Peak Near Shackleton · Connecting Ridge · Connecting Ridge Extension · de Gerlache Rim 1 · de Gerlache Rim 2 · de Gerlache-Kocher Massif · Haworth · Malapert Massif · Leibnitz Beta Plateau · Nobile Rim 1 · Nobile Rim 2 · Amundsen Rim, all "within six degrees of latitude of the lunar South Pole". Quoted facts: "All 13 regions contain sites that provide continuous access to sunlight throughout a 6.5-day period"; selection criteria listed as "terrain slope, ease of communications with Earth, and lighting conditions". Each region is approximately 15 by 15 km; landing sites have an approximate 100 m radius (same page, image caption).
**License/usage:** no explicit license text on the page; NASA media content "generally ... not subject to copyright in the United States", reuse for educational/informational purposes with NASA acknowledged as source, no implied endorsement, NASA insignia/logotype protected ([NASA Images and Media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)). **AI rule on the same page:** for information incorporated into an LLM, "attribution of the information directly to NASA is not permitted"; NASA insignia may not appear with AI-generated imagery; NASA "strongly encourages AI-generated products maintain a marking". Goes into the submission's AI-use section.

**Region coordinates (mosaic centres, as quoted):** [Collins et al., LPSC 55 (2024) abstract #1775, LROC team, ASU](https://www.hou.usra.edu/meetings/lpsc2024/pdf/1775.pdf), Table 1. These are centres of "ten combined LROC NAC and ShadowCam controlled mosaics of the 13 Artemis III landing regions", **not** region centres defined by NASA; paired regions share one mosaic but get separate centre pairs. The header reads "Cen. Lon. Cen. Lat.", but latitude is printed first: confirmed by the Figure 1 caption "Nobile Rim 2 (-83.95°S, 58.74°E)". Longitudes east-positive (−180…180).

| Region (as printed) | Cen. lat | Cen. lon |
|---|---|---|
| Connecting Ridge & Connecting Ridge Extension | −89.46 & −88.99 | −136.68 & −104.47 |
| Peak Near Shackleton | −88.81 | 124.68 |
| de Gerlache Rim 1 & 2 | −88.67 & −88.22 | −66.37 & −63.43 |
| Faustini Rim A | −87.86 | 90 |
| Haworth | −86.75 | −23.67 |
| Malapert Massif | −85.98 | −0.26 |
| Nobile Rim 1 & Leibnitz Beta Plateau | −85.44 & −85.43 | 37.44 & 31.83 |
| Nobile Rim 2 | −83.95 | 58.74 |
| Amundsen Rim | −84.23 | 69.3 |
| de Gerlache-Kocher Massif | −85.83 | −116.54 |

Note: Nobile Rim 2's mosaic centre (−83.95°) is 6.05° from the pole, just outside "within six degrees". Harmless (regions are ~15 km across; this is a mosaic centre) but keep in mind when building sites.

**License/usage (LPSC abstract):** no license stated; cite authors + LPSC 55 (2024) abstract #1775. Projection and control, as written: ShadowCam images were "map projected at 1 meter/pixel in the Moon south polar stereographic projection [IAU2000:30120;9]"; images were "manually shifted ... to hillshade maps made from the LOLA 5 meter/pixel DTMs", accurate "within 5 meters of LOLA". The abstract does not name the frame of the Table 1 latitude/longitude.

**Update, nine regions:** [NASA news release, 28 Oct 2024](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions) — updated set "in no priority order": "Peak near Cabeus B", "Haworth", "Malapert Massif", "Mons Mouton Plateau", "Mons Mouton", "Nobile Rim 1", "Nobile Rim 2", "de Gerlache Rim 2", "Slater Plain" (no coordinates given). Criteria include "communication capabilities with Earth, and lighting conditions". Same license situation as above.

**Status note (checked 24 Oct 2026):** NASA's [Artemis III mission page](https://www.nasa.gov/mission/artemis-iii/) (last updated 19 Oct 2026) describes Artemis III as "a series of objectives in low Earth orbit", with "future lunar landings, beginning with Artemis IV". **(ours, not stated by NASA):** the candidate-region set above remains the reference list of south-pole landing regions.

## Shackleton Connecting Ridge

NASA lists **Connecting Ridge** and **Connecting Ridge Extension** in the 2022 set (link above). NASA's own wording ties it to Shackleton: Blue Origin's Blue Moon MK1 "will land on the Shackleton Connecting Ridge" ([NASA event page "Moon Base: Blue Origin Blue Moon Mark 1"](https://www.nasa.gov/event/clps-flight-blue-origins-blue-moon-mark-1/), last updated 21 Oct 2026; also [NASA "Moon Base Phases"](https://www.nasa.gov/moonbase-phases/), last updated 8 Oct 2026, lander Endurance, payloads SCALPSS and LRA). Neither page gives coordinates or a firm launch date. Beyer et al. 2025 call it "the connecting ridge near Shackleton". **(ours):** that it runs to de Gerlache. Coordinates as quoted in [LPSC 2024 #1775, Table 1](https://www.hou.usra.edu/meetings/lpsc2024/pdf/1775.pdf): Connecting Ridge **−89.46** (lat), **−136.68** (lon); Connecting Ridge Extension **−88.99**, **−104.47** (mosaic centres). Do not attach these coordinates to the Blue Moon mission. License as for the LPSC abstract and NASA pages.

## IM-2 (Intuitive Machines, "Athena"; landed 6 Mar 2025)

**Intended site, as quoted:** "The Intuitive Machines IM-2 intended landing site (-84.78°, 29.13°E)" — [LROC featured image "IM-2 Landing Region", 26 Feb 2025](https://lroc.im-ldi.com/images/1401); same page (pre-landing): "on Mons Mouton on 6 March 2025", "160 kilometers from the south pole".
**Actual touchdown, as quoted:** "ended up on its side within a 20-meter diameter crater (84.7906° S, 29.1957° E)" — [LROC "IM-2 Athena Seen Obliquely", 10 Mar 2025](https://lroc.im-ldi.com/images/1408). NASA: "more than 1,300 feet (400 meters) from its intended landing site" ([NASA release, 7 Mar 2025](https://www.nasa.gov/news-release/nasa-receives-some-data-before-intuitive-machines-ends-lunar-mission/)). Cross-check **(derived)**: intended vs. actual ≈ 0.37 km apart (intended rounded to 0.01°), consistent.
**License (LROC):** pages show "©2026 NASA/GSFC/LROC ... All rights reserved."; reuse is governed by the [LROC Terms & Citation page](https://lroc.im-ldi.com/about/terms): website images "are copyrighted", use "for educational purposes is encouraged and permitted without prior permission" with credit "NASA/GSFC/Arizona State University"; commercial use needs permission; PDS-delivered data "are in the public domain". For us: cite with that credit line; prefer PDS products for any image in the app (Isaac to confirm).

## VIPER / Mons Mouton (cancelled 2024, delivery re-awarded 2025)

**Site, as quoted:** "The mission area ... is approximately 5 × 4 km and centered at **31.6218°E, 85.42088°S**" (longitude first), "on the southern edge of Mons Mouton (previously Leibnitz β)", northwest of Nobile crater — [Beyer et al. 2025, "VIPER Site Analysis", Planet. Sci. J. 6, 236](https://iopscience.iop.org/article/10.3847/PSJ/ae061a). **Frame (Appendix B):** "Moon (2015) - Sphere / Ocentric", R = 1 737 400 m, IAU 30100:2015 (planetocentric, east-positive); site projection `+proj=stere +lon_0=31.6218 +lat_0=-85.42088 +R=1737400 +units=m`. Primary-area polygon (Appendix A, lon/lat): (30.48 −85.368, 32.626 −85.367, 32.666 −85.49, 30.461 −85.491). **License:** "Creative Commons Attribution 4.0 licence" (CC BY 4.0).
**Earlier announcement (2021, Nobile rim):** NASA SVS visualization "The VIPER Landing Site" — rover to explore "an area west of Nobile crater, near the lunar South Pole", ~36 square miles, no coordinates — [SVS 4937, 20 Sep 2021](https://svs.gsfc.nasa.gov/4937). **License:** NASA media guidelines, except the soundtrack ("Music Provided by Universal Production Music"), which is third-party: do not reuse the video audio.
**Status:** [NASA, 17 Jul 2024](https://www.nasa.gov/news-release/nasa-ends-viper-project-continues-moon-exploration/): "its intent to discontinue development of its VIPER ... project", citing "cost increases, delays to the launch date, and the risks of future cost growth". Then [NASA, 19 Sep 2025](https://www.nasa.gov/news-release/nasa-selects-blue-origin-to-deliver-viper-rover-to-moons-south-pole/): "Blue Origin will deliver VIPER to the lunar surface in late 2027, using a second Blue Moon MK1 lander" (task order CS-7; delivery is an option NASA has yet to exercise). Neither release names a landing site, so whether the Mons Mouton site still applies is **(unverified)**.

## Other polar landers

| Mission | Site / coordinates (as quoted) | Source | License |
|---|---|---|---|
| IM-1 ("Odysseus", landed 22 Feb 2024) | Actual: "Odysseus came to rest at 80.13 degrees south latitude, 1.44 degrees east longitude", 2,579 m elevation, "local terrain is sloped at 12 degrees". Pre-landing nominal area: "80.2°S, 1.0°E", "between the craters Malapert C and Malapert B and east of Malapert A" | Actual: [NASA "NASA's LRO Images Intuitive Machines' Odysseus Lander", 26 Feb 2024](https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/). Nominal: [LROC "IM-1 Landing Region", 19 Jan 2024](https://lroc.im-ldi.com/images/1321) | NASA guidelines; LROC terms as under IM-2 |
| Griffin-1 (Voyager Technologies) | "the Moon's South Pole region", "planned launch to the Moon in late 2026"; no named site, no coordinates | [NASA "Moon Base Phases"](https://www.nasa.gov/moonbase-phases/) | NASA guidelines |
| IM-3, Chang'e 7, further CLPS polar task orders | not verified — NASA's CLPS landing-site details live in an interactive map, not page text ([CLPS landing sites page](https://www.nasa.gov/commercial-lunar-payload-services/landing-sites/), last updated 2 Sep 2025). IM-3 goes to Reiner Gamma (not polar, out of scope) per [Moon Base Phases](https://www.nasa.gov/moonbase-phases/) | — | — |

NASA-wide context: the [CLPS overview page](https://www.nasa.gov/commercial-lunar-payload-services/) (updated 6 Jul 2026) states "NASA has awarded 17 lunar deliveries to five CLPS vendors to carry more than 60 payloads to the Moon."

Checked by Claude Code for Isaac, 10 Nov 2026 (every claim against its source; derived numbers recomputed).
