# Lunar South Pole: Illumination, Earth Visibility / Communications, and Thermal Environment (for landing-site and landing-window ranking)

Conventions used throughout: coordinates are decimal degrees (lat, lon), south negative, longitude east-positive (0-360 E; where a source gives West longitude the conversion is shown). "Avg illumination" = time-average of the visible fraction of the solar disc; "solar visibility" = fraction of time any part of the Sun is visible (these are different metrics, see Q2). 1 deg of lunar latitude = 30.3 km. Publication year is given for every figure.

Method caveats for the report writer: (a) several primary PDFs (Bussey 2010, Glaeser 2018, Barker 2021, NASA OCHMO-TB-001, NESC/IAASS 2023, LPSC abstracts) were read by local text extraction, so table values below are transcribed from the papers themselves; (b) paywalled full texts (Mazarico 2011 Table 3, Speyerer and Robinson 2013, Glaeser 2014, Williams 2019, Paige 2010, Wueller 2025/2026, De Rosa 2012) could NOT be opened, so their numbers come from abstracts or from tables reproduced in later papers and are flagged; (c) the web-search budget for this session ran out before the thermal and Earth-visibility questions were fully closed, so those sections have more gaps.

## Q1. Geometry basics (axial tilt, Sun elevation, lunar day, seasons, 18.6-year cycle, PSRs and peaks of near-eternal light)

### Takeaway
The Moon's 1.54 deg obliquity keeps the Sun within about +/-1.5 deg of the horizon at the pole, so local topography (near-field horizon ~100 m away, far-field horizon 50-200 km away) decides whether a point is lit: depressions become permanently shadowed, isolated rims/ridges become lit 70-90 % of the time, and no point is lit 100 % of the time at surface level. A weak but operationally decisive seasonal cycle (summer/winter by subsolar latitude) shifts roughly 2-3 weeks earlier every calendar year.

### Cited Findings

| Quantity | Value | Year | Source |
|---|---|---|---|
| Lunar rotational obliquity (to ecliptic) | 1.54 deg | 2018 | [Glaeser et al. 2018, PSS 162, NTRS preprint](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf) |
| Maximum elevation of the Sun at the poles | 1.54 deg (centre of disc) | 2018 | [Glaeser et al. 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf) |
| Sun as seen from Shackleton rim | "never more than 1.5 degrees above or below" the horizon; glides 360 deg around the horizon | 2021 | [NASA SVS 4944](https://svs.gsfc.nasa.gov/4944/) |
| Max/min subsolar latitude over 1000 years of JPL Horizons ephemerides | +/-1.59 deg | 2010 | [Bussey et al. 2010, Icarus 208](https://spudislunarresources.nss.org/Bibliography/p/98.pdf) |
| Sun's apparent latitude range at the lunar poles | ~3 deg total (vs 47 deg on Earth), "still enough to substantially affect sunlight at the lunar poles" | 2020 | [NASA SVS 4770](https://svs.gsfc.nasa.gov/4770) |
| "Sun incidence at the surface of the South Pole" | 1.5 deg | 2023 | [NASA OCHMO-TB-001 Rev B](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-001-artemis-lighting-considerations.pdf) |
| Highest possible Sun elevation in the Artemis target landing regions (all within ~6 deg of pole) | 7 deg | 2024 | [NASA NESC](https://www.nasa.gov/centers-and-facilities/nesc/characterizing-the-visual-experience-of-astronauts-at-the-lunar-south-pole/) |
| Sun and Earth elevation range at south-polar sites | rise only ~2 to 7 deg above horizon | 2023 | [NASA Artemis overview deck, NTRS 20230005904](https://ntrs.nasa.gov/api/citations/20230005904/downloads/PlatteCity_Artemis.pdf) |
| Solar elevation at two potential Artemis sites for a 12/2024 mission | LS1 < 2.1 deg; LS2 < 1.75 deg (authors' calculation) | 2020 | [Fassett and Zanetti 2020, NASA MSFC](https://www.hou.usra.edu/meetings/lunarsurface2020/pdf/5067.pdf) |
| Lunar (synodic) day | "about 29.5 Earth-days"; at the equator ~15 d light / ~15 d night; near poles "no specific statement about the duration of illumination periods can be made" | 2018 | [Glaeser et al. 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf) |
| Lunar precession (nodal) cycle used for long-run illumination averages | 18.6 years | 2011/2018 | [PGDA Lunar Polar Illumination](https://pgda.gsfc.nasa.gov/products/69); [Glaeser et al. 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf) |
| Distance of terrain that can cast shadows on a polar site | mountains "as far as 75 miles (120 km) away" | 2023 | [NASA OCHMO-TB-001](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-001-artemis-lighting-considerations.pdf) |
| Horizon structure seen from a ridge site | near-field horizon ~100 m away (10s of m to ~1 km); far-field horizon ~50-200 km away | 2021 | [Barker et al. 2021, PSS 203](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf) |
| Shadow length at 1.5-2 deg Sun elevation | L = ~27 x object height | 2023 | [NASA OCHMO-TB-001](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-001-artemis-lighting-considerations.pdf) |

- Seasons: in 2024 "the year begins mid-South Pole summer, with the subsolar latitude near its greatest southern extent"; shadows deepen until mid-year (South Pole winter, subsolar latitude at its northern extreme) (2020) — [NASA SVS 4770](https://svs.gsfc.nasa.gov/4770)
- Seasons shift on the calendar: "south polar illumination conditions [exhibit] strong seasonal variability and [shift] approximately 2-3 weeks per year" (NASA Artemis III site-selection team, 2026) — [George et al., LPSC 2026 #1901](https://www.hou.usra.edu/meetings/lpsc2026/pdf/1901.pdf)
- "Peak lighting conditions are periodic and shift 2-3 weeks earlier each year, where by 2030, peak solar illumination occurs around the month of August" (2023 NASA slide; text recovered from an encoded PDF and consistent with the search-engine rendering) — [NTRS 20230005904](https://ntrs.nasa.gov/api/citations/20230005904/downloads/PlatteCity_Artemis.pdf)
- Clementine (71 days in early 1994) began imaging "just after mid-winter for the Moon's southern hemisphere" (2010) — [Bussey et al. 2010](https://spudislunarresources.nss.org/Bibliography/p/98.pdf)
- Illumination at the poles depends on "local topography and the slight seasons caused by the 1.54 deg tilt, but also on the height above ground and on the lunar precessional cycle" (2018) — [Glaeser et al. 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf)
- No place is constantly illuminated, but areas exist that receive sunlight >80 % of the time (Noda et al. 2008, Kaguya laser altimeter; as summarised by Bussey 2010) — [Bussey et al. 2010](https://spudislunarresources.nss.org/Bibliography/p/98.pdf)
- PSR area: 12,866 km2 (north) and 16,055 km2 (south) from 240 m/px LOLA; every PSR receives some singly-scattered light during the year (2011) — [Mazarico et al. 2011, NTRS record](https://ntrs.nasa.gov/citations/20120010094)
- PSR area within 4 deg of the south pole from Kaguya 474 m/px DEM: 5,058 km2 Sun-shadowed (2010) — [Bussey et al. 2010](https://spudislunarresources.nss.org/Bibliography/p/98.pdf)
- Poleward of 80 S the PSR size-frequency distribution is approximately a power law; PSRs smaller than 1 km2 hold 15 +/- 5 % of total PSR area (2023) — [Barker et al. 2023, "A New View of the Lunar South Pole from LOLA"](https://ntrs.nasa.gov/api/citations/20230014419/downloads/BarkernewviewSTIupdated.pdf)
- The most-illuminated points all "represent local topographic maximums"; high-illumination zones are thin, elongated strips along rims/ridges, several km long but only 20-40 m wide at surface level (1-2 pixels of a 20 m DEM) (2010; 2018) — [Bussey et al. 2010](https://spudislunarresources.nss.org/Bibliography/p/98.pdf); [Glaeser et al. 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf)
- NASA simulation products for any date: SVS 4930 (within 2 deg of the pole, 2-hour steps, 2023-2030, 35,064 frames), SVS 5027 (to 80 S, 2025-2028, 17,532 frames), built from LOLA DEM + JPL DE421; SVS 5229 "Moon Essentials: Seasons"; SVS 5038 "The Sun's Path at Different Lunar Latitudes" — [SVS 4930](https://svs.gsfc.nasa.gov/4930/); [SVS 5027](https://svs.gsfc.nasa.gov/5027/)

### Inferences
- Season model usable in the app (my derivation, not a published table): subsolar latitude ~ +1.54 deg x sin(L_sun - Omega), with L_sun the Sun's ecliptic longitude and Omega the mean longitude of the lunar ascending node (regresses 19.34 deg/yr). Southern midsummer is at L_sun - Omega = 270 deg, midwinter at 90 deg. Calibration checks: reproduces "just after mid-winter" for Clementine's start (Feb 1994) and "year begins mid-summer" for 2024, and Fassett and Zanetti's choice of 12/2024.
- The repeat period of the seasons is the eclipse (draconic) year of ~346.6 days, i.e. 18.6 days shorter than a calendar year, which is the physical origin of NASA's "2-3 weeks earlier each year".
- At 1.5 deg Sun elevation a 6 km-high massif 120 km away can still occult the Sun, which is why far-field terrain (Malapert, Mons Mouton, crater rims) produces the multi-day winter eclipses at ridge sites.

### Gaps
- The exact draconic-year length (346.62 d), libration amplitude in latitude (~6.7 deg) and Sun angular diameter were not confirmed from a fetched primary page; they are standard values supplied in the brief.
- No source was found that quantifies how the 18.6-year cycle changes illumination percentages at a given site year to year (studies average over it rather than report the variation).

## Q2. Highest-illumination locations: coordinates, average illumination, longest sunlit and dark periods, by study

### Takeaway
All studies agree on the same handful of places — Shackleton rim, the Shackleton-de Gerlache "Connecting Ridge", de Gerlache rim, a peak/ridge ~1.2 deg from the pole near 124 E, and (further out) Malapert and Mons Mouton — but the percentages differ by 10-25 points with DEM resolution and metric: coarse DEMs (240-474 m) give 81-89 %, the 20 m LOLA DEM gives 76-81 % at surface level, and 100 m imagery gives 64-72 %. Winter maximum darkness at the best surface points is roughly 6-12 days in the coarse/1-year studies and 2.8-11 days (65-268 h) in the 20-year, 20 m study.

### Cited Findings

**Table 2a. Cross-study comparison at the same sites (surface level), as tabulated by Glaeser et al. 2018 (Table 1)** — [Glaeser et al. 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf)

| Site | Study (data, resolution, period) | Lat | Lon E | Max avg illumination % | Solar visibility % | Max time in shadow (h) |
|---|---|---|---|---|---|---|
| Connecting Ridge C1 (= Mazarico Site 1, De Rosa CR1) | Glaeser 2018 (LOLA 20 m, 2017-2037, 1 h) | -89.4505 | 222.84 | 76.0 | 81.3 | 268 |
| Connecting Ridge C1 | Mazarico 2011 (LOLA 240 m, 18.6 yr) | -89.45 | 222.69 | 89.0 | 92.7 | 141.12 |
| Connecting Ridge C1 | Speyerer and Robinson 2013 (WAC images 100 m, 1 yr) | -89.418 | 221.3 | 64.2 | n/a | 308 |
| Connecting Ridge C2 (new in 2018) | Glaeser 2018 | -89.3157 | 245.94 | 75.6 | 80.6 | 166 |
| Shackleton rim S (= Mazarico Site 4, De Rosa SR1) | Glaeser 2018 | -89.7849 | 203.97 | 81.0 | 85.5 | 221 |
| Shackleton rim S | Mazarico 2011 | -89.78 | 204.27 | 86.7 | 90.5 | n/a |
| Shackleton rim S | Speyerer and Robinson 2013 | -89.740 | 201.2 | 71.6 | n/a | 145 |

**Table 2b. Same sites at 2 m above ground, 20-year average (Glaeser et al. 2018, Table 2)** — [Glaeser et al. 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf)

| Site | Lat | Lon E | Max avg illumination % | Solar visibility % | Max time in shadow (h) |
|---|---|---|---|---|---|
| Connecting Ridge C1 | -89.4398 | 222.83 | 88.0 | 92.1 | 112 |
| Connecting Ridge C2 | -89.3130 | 245.98 | 78.1 | 82.0 | 165 |
| Shackleton rim S (max illumination point) | -89.6866 | 197.19 | 85.5 | 89.4 | 66 |
| Shackleton rim S (max visibility point) | -89.7815 | 204.70 | 82.1 | 89.8 | 65 |

**Table 2c. High-illumination clusters (>=70 % at 2 m) and nearest PSR (Glaeser et al. 2018, Table 3)** — [Glaeser et al. 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf)

| Cluster | Max avg illum % | Max solar vis % | Cluster area m2 | Nearest PSR area m2 | Distance to PSR m | Max slope in PSR deg |
|---|---|---|---|---|---|---|
| Connecting Ridge C1-0 | 88.0 | 92.1 | 135,200 | 5,200 | 100 | 12.8 |
| Connecting Ridge C1-1 | 81.3 | 86.0 | 26,800 | 9,600 | 70 | 13.7 |
| Connecting Ridge C2-0 | 71.6 | 75.1 | 4,400 | 5,600 | 60 | 11.5 |
| Connecting Ridge C2-1 | 78.1 | 82.0 | 11,600 | 22,800 | 80 | 17.1 |
| Shackleton S0 | 85.5 | 89.4 | 21,600 | 58,400 | 370 | 17.0 |
| Shackleton S1 | 84.3 | 89.8 | 120,400 | 4,400 | 30 | 11.1 |
| Shackleton S2 | 73.9 | 78.8 | 31,200 | 1,200 | 80 | 6.0 |

**Table 2d. Bussey et al. 2010 (Kaguya laser altimeter DEM, 474 m/px, year 2020, 12-hour steps)** — [Bussey et al. 2010](https://spudislunarresources.nss.org/Bibliography/p/98.pdf)

| Point | Description | Lat | Lon (as published) | Lon E | 2020 mean % | Longest continuous sunlight | Longest eclipse / notes |
|---|---|---|---|---|---|---|---|
| A | Shackleton rim | -89.68 | 166.0 W | 194.0 | 81 | (with B) >8 continuous months collectively | A+B together lit ~94 % of the year; "less than 10 km apart" |
| B | Ridge close to Shackleton (Connecting Ridge) | -89.44 | 141.8 W | 218.2 | 82 | >4.5 continuous months | only 12-24 h eclipses in the 8 months centred on midsummer (4.5 days total) |
| C | de Gerlache rim | -88.71 | 68.7 W | 291.3 | 85 | n/a | shortest maximum single eclipse of all points: ~6 days |
| D | Small ridge along ~120 E from Shackleton rim | -88.79 | 124.5 E | 124.5 | 86 (highest) | >5 continuous months centred on midsummer | one ~2-day eclipse in 7 months; longest eclipse ~11.5 days at midwinter |
| M1 | Malapert Mountain | -86.04 | 2.7 E | 2.7 | 74 | n/a | n/a |
| M2 | Malapert Mountain | -86.00 | 2.9 W | 357.1 | 74 | n/a | n/a |

Note: Bussey 2010 gives Point D's latitude inconsistently (text "99.79 S" is a typo, Table 2 "88.79 S", conclusions "88.74 S 124.5 E").

**Table 2e. Other study-level results**

| Study | Data / method | Key south-pole results | Source |
|---|---|---|---|
| Noda et al. 2008 (GRL 35, L24203) | Kaguya laser altimeter | No constantly lit place; some areas lit >80 % of the time | [as summarised in Bussey 2010](https://spudislunarresources.nss.org/Bibliography/p/98.pdf) |
| Mazarico et al. 2011 (Icarus 211, 1066) | LOLA 240 m, horizon method, several 18.6-yr cycles at 6 h steps (abstract) / hourly over 18.6 yr (PGDA text) | A site near Shackleton rim is sunlit continuously ~240 days each year; its longest continuous total darkness ~1.5 days; ~10 m of height gives large improvements. Sites ranked by 18.6-yr average illumination (Table 3 of the paper) | [NTRS record](https://ntrs.nasa.gov/citations/20120010094); [PGDA](https://pgda.gsfc.nasa.gov/products/69) |
| Speyerer and Robinson 2013 (Icarus 222, 122) | LROC WAC images, 100 m/px, 15 Feb 2010 - 5 Feb 2011, 3,807 south-pole images (~every 2 h) | Single-point maxima 64.2 % (ridge) and 71.6 % (Shackleton rim) with max shadow 308 h and 145 h; some Shackleton rim station sets reach ~94 % of the year with a longest joint eclipse of 43 h (the latter per Wikipedia's summary of the paper) | [Glaeser 2018 Table 1](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf); [LROC](https://lroc.im-ldi.com/news/991); [Wikipedia](https://en.wikipedia.org/wiki/Peak_of_eternal_light) |
| Glaeser et al. 2014 (Icarus 243, 78-90) | LOLA 20 m DTM co-registered to NAC; 1-yr survey of a 20 x 20 km area + 19-yr study on Connecting Ridge | Connecting Ridge spots lit 92.27 % of the time at 2 m and 95.65 % at 10 m; longest continuous darkness "typically only 3-5 days" | [DLR elib record](https://elib.dlr.de/94240) |
| Speyerer et al. 2016 (Icarus 273) | Rover traverse optimisation on the ridge | "a small amount of mobility" keeps a rover lit 94.4 % of the year, longest eclipse 101 h | [cited in Glaeser 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf) |
| Glaeser et al. 2018 (PSS 162, 170) | LOLA 20 m, 400 x 400 km DTM, 50 x 50 km study area, 1 Jan 2017 - 1 Jan 2037, hourly | Six best sites (3 per pole) have average illumination 69.5-82.9 % at surface and 77.1-88.0 % at 2 m; max shadow "less than three and up to eight days", i.e. 20-50 % of a lunar night; sites "typically illuminated for about 90 % of the time" | [Glaeser et al. 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf) |
| Barker et al. 2021 (PSS 203, 105119) | LOLA-only 5 m DEMs of four 16 x 16 km areas, 100 statistical "clone" DEMs, 1 Jan 2024 - 1 Jan 2026, hourly | See Table 2f | [Barker et al. 2021](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf) |
| Barker et al. 2023 | Enhanced LOLA south-polar altimetry, maps out to 30 deg from the pole, new PSR and roughness maps | Mapping product paper (no site illumination table found in the text read) | [NTRS](https://ntrs.nasa.gov/api/citations/20230014419/downloads/BarkernewviewSTIupdated.pdf) |
| Wueller et al. 2026 (JGR Planets 131, e2025JE009434) | Illumination + simultaneous Sun/Earth visibility for each Artemis candidate region for each midsummer 2025-2032 | 130 candidate landing sites meet HLS requirements; "favourable" = sunlit >= 10 consecutive days; sites HW04 and HW10 (Haworth) exceed 25 days of simultaneous Sun and Earth visibility; largest suitable fractional area: Slater Plain, then Nobile Rim 2, Faustini Rim A; smallest: Connecting Ridge Extension, de Gerlache Rim 1, MMA, PCB (per search-result excerpt of the abstract) | [doi:10.1029/2025JE009434](https://doi.org/10.1029/2025JE009434); [data on Zenodo](https://zenodo.org/records/17084058) |
| Wueller et al. 2025 (JGR Planets, 2025JE009127) | Region-averaged scores | Mons Mouton plateau: Sun visibility 0.45 +/- 0.14, Earth visibility 74 +/- 19 % of the lunar year, coldest PSR 85 K; Mons Malapert candidate region: Sun 0.31 +/- 0.25, Earth 0.41 +/- 0.32 (per search-result excerpts) | [doi:10.1029/2025JE009127](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2025JE009127) |
| De Rosa et al. 2012 (ESA Lunar Lander) | LOLA 40 m grid, quasi-continuous illumination period (LQCIP) at 3 m height with 100-h night survivability, year 2009 | Areas with LQCIP of "several months" (>3 months on parts of the Connecting Ridge) exist on the Connecting Ridge, Leibnitz-beta plateau, Shackleton and de Gerlache rims and Malapert peaks; such areas are only "a few hundreds of metres" across and LQCIP drops quickly to <1 month outside them | [De Rosa et al., LPSC 2012 #1585](https://www.lpi.usra.edu/meetings/lpsc2012/pdf/1585.pdf) |

**Table 2f. Barker et al. 2021, Site 1 (Connecting Ridge), regions of interest (RoIs = connected pixels >70 % avg illumination at 1 m and >2,500 m2), 2024-2026, statistics over 100 DEM clones** — [Barker et al. 2021](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf)

| Case | Avg illumination (1st percentile) | Longest continuous illumination period LCIP (1st percentile) | Longest continuous shadow period LCSP (99th percentile) |
|---|---|---|---|
| 1 m above surface, whole-RoI average | 67 % (RoI 7) to 71 % (RoI 6) | 63 d (RoI 1) to 142 d (RoI 5) | 13 d (RoI 4, 6) to 22 d (RoI 3) |
| 5 m above surface, whole-RoI average | 83 % (RoI 7) to 89 % (RoI 1) | 119 d (RoI 7) to 231 d (RoI 4) | 4 d (RoI 4-6) to 8 d (RoI 3) |
| 1 m, best pixel in RoI at each hour (i.e. with roving) | 77 % (RoI 3) to 87 % (RoI 4, 6) | 118 d (RoI 7) to 232 d (RoI 4) | 4 d (RoI 4) to 16 d (RoI 3) |
| 5 m with roving | +2-5 % over fixed | n/a | ~3-6 d |

- Barker 2021 site key: Site 1 = Connecting Ridge, Site 4 = Shackleton rim, Site 7 = isolated peak near Shackleton on the far side, Site 11 = de Gerlache rim (numbering = Mazarico 2011 Table 3 rank); these equal CR1, SR1, SV1, GR1 of De Rosa 2012 and C1 and S of Glaeser 2018 — [Barker et al. 2021](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf)
- Site 1 has the most area with >70 % average illumination at 1 m, and RoIs 4-6 there are best even after uncertainties; at 5 m Site 1 has LCIP >200 days for RoIs 1-6 versus ~150-175 days at the other three sites (2021) — [Barker et al. 2021](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf)
- NASA PGDA 5 m/px LOLA site products (IDs follow the Mazarico 2011 ranking): Site01 Connecting ridge; Site04 Shackleton rim; Site06 Nobile rim 1; Site07 Peak near Shackleton; Site11 de Gerlache rim; Site20 / Site20v2 Leibnitz beta plateau; Site23 Malapert massif; Site42 de Gerlache-Kocher massif; Haworth; Shoemaker; DM1 Amundsen rim; DM2 Nobile rim 2; SL2 de Gerlache rim; SL3 Connecting ridge extension; NPA Cabeus exterior wall 1; NPB Amundsen 1; NPC Idel'son L crater 1; NPD Malapert crater 1; LM1 Shackleton Rim B; LM2-LM6, LM8 Shoemaker Rim A-F; LM7 Faustini Rim A. Files at `https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/SiteXX/` (surface DEM, slope, error maps, 100 clones, RoI shapefiles) — [PGDA product 78](https://pgda.gsfc.nasa.gov/products/78)
- NASA PGDA polar illumination rasters (18.6-yr hourly averages): `AVGVISIB_65S_240M_201608`, `AVGVISIB_75S_120M_201608`, `AVGVISIB_85S_060M_201608` (Sun), same names with `_EARTH` (Earth visibility), `LPSR_*` (permanent shadow), `SKYV_65S_240M` (sky visibility); IMG/JP2/GeoTIFF/COG; base `https://pgda.gsfc.nasa.gov/data/MoonIllumination/` — [PGDA product 69](https://pgda.gsfc.nasa.gov/products/69)
- LROC image-based maps: `WAC_POLE_ILL_PCT_SOUTH` (percentage-based) and `WAC_POLE_ILL_TWI_SOUTH` (time-weighted), from 3,807 south-pole WAC images (2018 PDS release 32) — [LROC](https://lroc.im-ldi.com/news/991)
- Why the studies disagree: Mazarico 2011 "overestimates illumination ... due to smoothing of the close-range topography by the larger grid size"; WAC imagery underestimates because lit strips <100 m across are not resolved and one year does not sample seasonal/orbital effects; Glaeser 2018 values fall between the two; maximum shadow times in the 20 m study are up to 70 % shorter than in Speyerer and Robinson 2013 (2018) — [Glaeser et al. 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf)
- A 40 m DTM gives generally higher illumination than a 20 m DTM (horizon smoothing); best sites persist at 10 m resolution (2018) — [Glaeser et al. 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf)
- Accounting for DEM height errors "will usually result in less favorable conditions" because errors are more likely to raise than lower the horizon; median RMS height error in RoIs ~0.30-0.50 m, slope error ~1.5-2.5 deg; ~90 % of 5 m pixels are interpolated (2021) — [Barker et al. 2021](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf)
- The Shackleton-rim maximum in Glaeser 2014 and Glaeser 2018 is ~3 km apart and ~5 % different in illumination, purely from improved topography (2018) — [Glaeser et al. 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf)
- Malapert: Kaguya-based total illumination 74 % (2010); an older estimate says less than full sunlight only 11 % of the time (Sharpe and Schrunk 2002, as reported by Wikipedia); a 2023 iScience site study rates a Malapert solar-panel site at 50-82 % (search excerpt) — [Bussey et al. 2010](https://spudislunarresources.nss.org/Bibliography/p/98.pdf); [Wikipedia](https://en.wikipedia.org/wiki/Peak_of_eternal_light); [iScience 2023](https://www.cell.com/iscience/fulltext/S2589-0042(23)01930-2)
- Mons Mouton (formerly Leibnitz Beta; renamed 13 May 2022): centre -84.6, 31.0; ~6 km base-to-peak; just under 100 km wide — [Wikipedia, citing USGS Gazetteer and NASA SVS 5074](https://en.wikipedia.org/wiki/Mons_Mouton)

### Inferences
- Bussey's Point A (-89.68, 194.0 E) is the same Shackleton-rim strip as Glaeser's S at 2 m (-89.6866, 197.19 E), and Point B (-89.44, 218.2 E) is Connecting Ridge C1 (-89.44, 222.8 E); Bussey's Point C is the de Gerlache rim site (Mazarico Site 11) and Point D is very probably Mazarico Site 7 / Artemis "Peak Near Shackleton".
- PGDA's site IDs imply the Mazarico 2011 average-illumination rank: Connecting Ridge #1, Shackleton rim #4, Nobile rim 1 #6, Peak near Shackleton #7, de Gerlache rim #11, Leibnitz beta (Mons Mouton) plateau #20, Malapert massif #23, de Gerlache-Kocher massif #42.
- For ranking, use 20 m or 5 m LOLA-based numbers at a stated mast height; treat 240-474 m DEM percentages as upper bounds and 100 m image-based percentages as lower bounds.
- Winter darkness of ~3-11 days at the best points is the binding constraint for a solar-powered surface asset, not the annual average.

### Gaps
- Mazarico et al. 2011 Table 3 (full ranked list with coordinates, percentages and Earth visibility for all ~50 sites) could not be opened; only the C1 and Shackleton rows (via Glaeser 2018) were recovered.
- No coordinates or illumination statistics were retrieved for Nobile rim, Haworth/Cabeus-area ridges, de Gerlache-Kocher massif, or the Sverdrup/Henson area; Mons Mouton has only region-averaged scores.
- Speyerer and Robinson 2013 multi-station numbers (94 %, 43 h, station spacing) are from a Wikipedia summary, not the paper.
- Barker 2021 Table 2 per-RoI values and RoI coordinates were not recoverable from the PDF text (available as shapefiles on PGDA).
- Wueller 2026 per-site consecutive-day counts and the names of all 16 regions were not accessible (data are in the Zenodo archive).

## Q3. Gain from height above the surface, and spacing of complementary sites

### Takeaway
A few metres of mast height is worth 5-20 percentage points and cuts the worst-case darkness by half or more at the best ridge sites (e.g. Connecting Ridge C1: 76.0 % to 88.0 % and 268 h to 112 h going from 0 to 2 m; 67-71 % to 83-89 % going from 1 to 5 m), and pairs of sites less than 10 km apart on Shackleton rim and the Connecting Ridge are jointly lit about 94 % of the year. No primary source quantifying 100 m masts was found.

### Cited Findings

| Site | Height | Avg illumination % | Max darkness | Period / DEM | Year | Source |
|---|---|---|---|---|---|---|
| Connecting Ridge C1 | 0 m | 76.0 | 268 h | 2017-2037, 20 m | 2018 | [Glaeser 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf) |
| Connecting Ridge C1 | 2 m | 88.0 | 112 h | same | 2018 | [Glaeser 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf) |
| Shackleton rim S | 0 m | 81.0 | 221 h | same | 2018 | [Glaeser 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf) |
| Shackleton rim S | 2 m | 85.5 | 66 h | same | 2018 | [Glaeser 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf) |
| Connecting Ridge C2 | 0 m / 2 m | 75.6 / 78.1 | 166 h / 165 h (no gain) | same | 2018 | [Glaeser 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf) |
| Connecting Ridge (best spots) | 2 m | 92.27 (time sunlit) | typically 3-5 days | 19 yr, 20 m | 2014 | [Glaeser 2014 abstract](https://elib.dlr.de/94240) |
| Connecting Ridge (best spots) | 10 m | 95.65 (time sunlit) | typically 3-5 days | 19 yr, 20 m | 2014 | [Glaeser 2014 abstract](https://elib.dlr.de/94240) |
| Connecting Ridge RoIs | 1 m | 67-71 (1st pct) | 13-22 d (99th pct) | 2024-2026, 5 m | 2021 | [Barker 2021](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf) |
| Connecting Ridge RoIs | 5 m | 83-89 (1st pct) | 4-8 d (99th pct) | 2024-2026, 5 m | 2021 | [Barker 2021](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf) |

- At 2 m the high-illumination strips widen from 20-40 m to "several hundred meters across the crater rims and ridges"; the best 2 m location does not coincide with the best surface location (2018) — [Glaeser et al. 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf)
- At 5 m above Site 1 the RoIs merge and "nearly the entire connecting ridge has an average illumination > 70 %"; DEM uncertainty has "an almost negligible effect" on illumination at 5 m (2021) — [Barker et al. 2021](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf)
- "height gains of ~10 m" can substantially improve illumination and shorten nights at some locations (2011) — [Mazarico et al. 2011, NTRS abstract](https://ntrs.nasa.gov/citations/20120010094)
- The size of favourable areas and the quasi-continuous illumination duration are "very sensitive to the height above the surface" (ESA Lunar Lander study at 3 m, 2012) — [De Rosa et al. 2012](https://www.lpi.usra.edu/meetings/lpsc2012/pdf/1585.pdf)
- Complementary sites: Points A (Shackleton rim) and B (Connecting Ridge) are "less than 10 km apart", lit collectively for >8 continuous months and >~94 % of the year; "when one site is dark, the other is often illuminated" (2010) — [Bussey et al. 2010](https://spudislunarresources.nss.org/Bibliography/p/98.pdf)
- Mobility as an alternative to masts: roving inside a single RoI raises 1 m illumination to 77-87 % and cuts worst darkness to 4-16 days (2021); a mobile rover on the ridge can stay lit 94.4 % of the year with a 101 h longest eclipse (2016) — [Barker et al. 2021](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf); [Speyerer et al. 2016 via Glaeser 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf)
- Very tall towers: a 2021-22 engineering study finds regolith-concrete towers "several kilometers tall" structurally stable (mass ~760 t at 1 km, ~4,100 t at 2 km) but its abstract gives no illumination-versus-height figures — [Ruppert, Ross, Vlassak and Elvis, arXiv:2103.00612](https://arxiv.org/abs/2103.00612)
- A popular summary of Glaeser 2018 states that constant light might be reached only at 50 m or more, and that ~2 m panels are the realistic case (secondary source) — [ScienceTrends](https://sciencetrends.com/the-sunniest-spots-on-the-moon-are-not-where-youd-expect-them)
- A 5 m mast on the Malapert summit "enables a wider line-of-site" for communications relay toward the pole (2021) — [Petro and Moriarty 2021, NASA GSFC](https://www.hou.usra.edu/meetings/lunarsurface12/pdf/8015.pdf)

### Inferences
- Great-circle separation of Bussey's Points A and B computed from their coordinates is about 9 km (A is 9.7 km and B 17.0 km from the pole, 24 deg apart in longitude), matching "less than 10 km" and Wikipedia's "~8 km".
- Diminishing returns: 0 to 2 m gives +4.5 to +12 points; 2 to 10 m gives about +3.4 points on the ridge (Glaeser 2014). The app can model illumination gain as steep in the first 2-5 m and shallow beyond.
- Height matters most where the limiting horizon is near-field (tens to hundreds of metres away); it does nothing where the limiting horizon is a far-field massif (C2's unchanged 165 h is an example).

### Gaps
- No primary-literature numbers for 100 m masts at specific south-pole sites were found.
- No published table of pairwise distances and joint illumination for other site pairs (e.g. Shackleton rim with de Gerlache rim, ~50+ km) was retrieved; a "Sunlit pathways between south pole sites" paper exists but was not accessible.

## Q4. Seasonal effects, south-polar summers 2026-2035, and eclipses by Earth

### Takeaway
Summer versus winter is the difference between months of unbroken light and lunar days that are only 44-64 % lit at the very best points; the long dark periods all fall around midwinter. NASA states that peak lighting moves 2-3 weeks earlier each year and falls around August by 2030; no source gives a dated list of solstices, so the dates below are derived.

### Cited Findings

**Table 4a. Percent of each lunar day illuminated, midsummer (Day 1) to midwinter (Day 7), year 2020 (Bussey et al. 2010, Table 2; Kaguya 474 m DEM)** — [Bussey et al. 2010](https://spudislunarresources.nss.org/Bibliography/p/98.pdf)

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

- Point D: lit >5 continuous months centred on midsummer; longest eclipse ~11.5 days at midwinter. Point B: >4.5 continuous months; only 12-24 h eclipses during the 8 summer-centred months (2010) — [Bussey et al. 2010](https://spudislunarresources.nss.org/Bibliography/p/98.pdf)
- A Shackleton-rim site is sunlit continuously for ~240 days each year (2011) — [Mazarico et al. 2011](https://ntrs.nasa.gov/citations/20120010094)
- 2024-2026 time series at Connecting Ridge RoIs show "similar seasonal and monthly patterns ... with higher illumination during southern lunar summer"; LCIP of 119-231 days at 5 m (2021) — [Barker et al. 2021](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf)
- A lander on the illuminated ridges would get ~70-90 % lighting in southern winter and likely all of the summer (Kruijff 2000, via Wikipedia) — [Wikipedia](https://en.wikipedia.org/wiki/Peak_of_eternal_light)
- 2024: summer at the start of the year, winter at mid-year (2020) — [NASA SVS 4770](https://svs.gsfc.nasa.gov/4770)
- Peak lighting shifts 2-3 weeks earlier each year; around August by 2030 (2023) — [NTRS 20230005904](https://ntrs.nasa.gov/api/citations/20230005904/downloads/PlatteCity_Artemis.pdf); seasonal variability "shifting approximately 2-3 weeks per year" and regions with "reduced sensitivity to seasonal effects" were favoured in the 13-to-9 down-selection (2026) — [George et al., LPSC 2026 #1901](https://www.hou.usra.edu/meetings/lpsc2026/pdf/1901.pdf)
- Midsummer-by-midsummer illumination rasters for every Artemis candidate region for 2025-2032 exist as a public dataset (`Illumination_Modeling.zip`) (2025/2026) — [Zenodo 17084058](https://zenodo.org/records/17084058)
- Seasonal thermal effect: the area cold enough (<110 K) to trap water grows by a factor of 2.8 in southern winter (4.3 in the north); seasonally shadowed regions are much larger than PSRs (2019) — [Williams et al. 2019, JGR Planets 124, 2505](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2019JE006028)
- Eclipses by Earth: from Shackleton's rim, a lunar eclipse appears as the Earth passing in front of the Sun (shown in NASA's 3-month simulation) (2021) — [NASA SVS 4944](https://svs.gsfc.nasa.gov/4944/)
- 14 March 2025 total lunar eclipse as experienced by a solar-powered lander (Blue Ghost, Mare Crisium, not polar): ran on batteries for ~5 hours; reported surface temperature fall from about +40 C to -170 C; whole eclipse 6 h 3 min with 65 min of totality (press reports via search summary, 2025) — [Space.com](https://www.space.com/total-lunar-eclipse-march-2025-what-happens-to-solar-powered-spacecraft); [Astronomy.com](https://www.astronomy.com/space-exploration/fireflys-blue-ghost-lander-nails-lunar-mission/)

### Inferences
- Derived approximate dates (my calculation from the season model in Q1; uncertainty about +/-5 days; NOT from a published table). Southern midsummer: 2024-01-11, 2024-12-23, 2025-12-05, 2026-11-16, 2027-10-29, 2028-10-10, 2029-09-21, 2030-09-03, 2031-08-16, 2032-07-27, 2033-07-09, 2034-06-20, 2035-06-02. Southern midwinter: 2026-05-27, 2027-05-09, 2028-04-19, 2029-04-01, 2030-03-14, 2031-02-23, 2032-02-05, 2033-01-17, 2033-12-29, 2034-12-10, 2035-11-22.
- Consistency checks: 2024-01-11 and mid-2024 match SVS 4770; 2024-12-23 matches Fassett and Zanetti's "12/2024 mission"; 2030-09-03 is within days of NASA's "around the month of August by 2030".
- "Summer" for planning is roughly the ~5 months centred on each midsummer date (Bussey's >4.5-5 continuous months; Mazarico's ~240 days), and the worst darkness falls within about +/-1.5 lunar days of midwinter (Bussey Days 5-7).
- Because the lunar day (29.53 d) and season are independent, within a given winter month the dark gap occurs at a fixed Sun azimuth (the direction of the blocking massif); landing-window logic should combine season with subsolar longitude.
- An Earth eclipse adds at most a few hours of darkness, small against the 3-11 day winter gaps, but it removes heat and power simultaneously at every site, including "always lit" summer sites, so battery sizing should cover ~5-6 h.

### Gaps
- No NASA or peer-reviewed source lists dated south-polar solstices for 2026-2035; the dates above should be verified with SPICE/Horizons before use.
- No source was found describing the effect of a lunar eclipse specifically at a south-pole site, nor a sourced list of 2026-2035 total lunar eclipses (NASA's eclipse catalogue was not consulted).

## Q5. Earth visibility and direct-to-Earth (DTE) communication; relay satellites

### Takeaway
Near the pole Earth hovers within a few degrees of the horizon around 0 deg longitude and rises and sets roughly monthly: typical sites alternate ~2 weeks visible / ~2 weeks hidden, not in phase with sunlight. Only high Earth-facing summits further north — Malapert (region around -85.95, +/-5 deg) and peaks of Mons Mouton — have ~100 % Earth visibility, while Shackleton/de Gerlache sites are reported below ~60 %; NASA says that without relays south-pole landing opportunities are "significantly limited".

### Cited Findings

| Location | Earth visibility | Basis | Year | Source |
|---|---|---|---|---|
| Malapert summit region, around -85.95, lon +/-5 | 100 % (permanent line of sight) with slopes <15 deg in places | LOLA-based Earth-visibility map (Mazarico 2011) viewed in QuickMap | 2021 | [Petro and Moriarty 2021](https://www.hou.usra.edu/meetings/lunarsurface12/pdf/8015.pdf) |
| Peaks of "Malapert alpha" and "Leibnitz beta" | "100 percent visibility of Earth at all times" | Goldstone radar DEM (search excerpt) | 2008/2009 | [Bryant, JPL IPN PR 42-176](https://ipnpr.jpl.nasa.gov/progress_report/42-176/176C.pdf) |
| Mons Mouton plateau (region average) | 74 +/- 19 % of the lunar year | region-averaged score (search excerpt) | 2025 | [Wueller et al. 2025](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2025JE009127) |
| Mons Malapert candidate landing region (region average) | 0.41 +/- 0.32 | region-averaged score (search excerpt) | 2025 | [Wueller et al. 2025](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2025JE009127) |
| Malapert vs de Gerlache and Shackleton | Malapert "Excellent (100 %)"; de Gerlache and Shackleton under 60 % | comparative site table (search excerpt) | 2023 | [iScience 2023](https://www.cell.com/iscience/fulltext/S2589-0042(23)01930-2) |
| South-pole vicinity in general | line-of-sight period ~14 days, "a little longer for Malapert Peak"; windows "not synchronised with illumination windows"; at one analysed site Earth disappears after 3 days for 15 days | Kaguya DEM (search excerpt) | 2010 | [Vanoutryve et al. 2010](https://www.researchgate.net/publication/228790017_An_analysis_of_illumination_and_communication_conditions_near_lunar_south_pole_based_on_Kaguya_Data) |
| ESA Lunar Lander candidate sites | DTE windows "generally follow a regular pattern of 14 days" | LOLA 40 m simulation | 2012 | [De Rosa et al. 2012](https://www.lpi.usra.edu/meetings/lpsc2012/pdf/1585.pdf) |
| South-pole landing regions | "Earth is in a 4-week cycle, visible two weeks, not visible two weeks" | NASA slide (decoded text) | 2023 | [NTRS 20230005904](https://ntrs.nasa.gov/api/citations/20230005904/downloads/PlatteCity_Artemis.pdf) |
| Within 4 deg of the pole | 10,520 km2 never see Earth (79 % of that is not Sun-PSR); 2,653 km2 hidden from both Sun and Earth | Kaguya 474 m DEM | 2010 | [Bussey et al. 2010](https://spudislunarresources.nss.org/Bibliography/p/98.pdf) |

- From Shackleton's rim the Earth "bobs up and down", stays near 0 deg longitude, appears upside-down; Mons Malapert sits on the horizon ~85 miles (~137 km) away in the Earth direction (2021) — [NASA SVS 4944](https://svs.gsfc.nasa.gov/4944/)
- Mons Malapert lies on the direct line of sight from Earth to the south pole, blocking a clear view of the pole from Earth (2025, search excerpt) — [Kring et al. 2025, JGR Planets](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2024JE008905)
- NASA's Earth-visibility rasters (`AVGVISIB_*_EARTH`, 60/120/240 m) average hourly steps over 18.6 years with Earth as a finite disc; Earth counts as visible if any part of its disc is unobscured, which "may be slightly optimistic" for links limited to DSN stations — [PGDA product 69](https://pgda.gsfc.nasa.gov/products/69)
- Artemis III planning filter: Earth visibility <25 % and solar visibility <5 % exclude areas; requirement stated as "Direct with Earth (DWE) communication, assume no comm relay available" (2023 slide, decoded text) — [NTRS 20230005904](https://ntrs.nasa.gov/api/citations/20230005904/downloads/PlatteCity_Artemis.pdf)
- "If Artemis III employs a Direct-to-Earth (DTE) communication architecture, regions with greater Earth visibility are preferred"; NRHO "provides favorable Earth visibility and access to the south pole region" (2026) — [George et al., LPSC 2026 #1901](https://www.hou.usra.edu/meetings/lpsc2026/pdf/1901.pdf)
- Simultaneous Sun + Earth visibility at Haworth sites HW04 and HW10 exceeds 25 days at midsummer; requiring both imposes "only minor limitations" at most sites (2026, search excerpt) — [Wueller et al. 2026](https://doi.org/10.1029/2025JE009434)
- IM-5 (CLPS) is described as targeting Mons Malapert for its continuous Earth visibility (trade press via search summary) — [Military Aerospace](https://www.militaryaerospace.com/commercial-aerospace/article/55366507/nasa-awards-1804-million-clps-contract-to-intuitive-machines-for-lunar-south-pole-payload-delivery)

**Table 5b. Relay systems**

| System | Operator | Facts | Year | Source |
|---|---|---|---|---|
| Near Space Network lunar relay (NSN Subcategory 2.2 "GEO to Cislunar Relay Services") | NASA GSFC; contractor Intuitive Machines | Firm-fixed-price IDIQ, max value $4.82 B; base period 1 Oct 2024 - 30 Sep 2029, option to 30 Sep 2034; comms + PNT for the South Pole region; intended for HLS, LTV and CLPS; NASA: without relays "landing opportunities at the Moon's South Pole will be significantly limited" because of the lack of direct communication between landing sites and Earth stations | 2024 | [NASA release via PR Newswire](https://www.prnewswire.com/news-releases/nasa-selects-lunar-relay-contractor-for-near-space-network-services-302250981.html) |
| Intuitive Machines data-relay constellation ("Khon") | Intuitive Machines | Satellites named Khon ordered from York Space Systems (2021 deal); first relay to launch with IM-3, two more with IM-4 (2027), remainder on a fifth mission (plans as reported 2024; status unverified) | 2024 | [Payload](https://payloadspace.com/intuitive-machines-will-build-a-lunar-communications-network); [IM-3 page](https://www.intuitivemachines.com/im-3-lunar-mission) |
| Moonlight | ESA | 5 satellites (4 navigation, 1 communications), 3 ground stations, positioned to prioritise south-pole coverage; initial services end of 2028, full operations 2030; precursor Lunar Pathfinder (SSTL) to begin operations 2026 | 2024 | [ESA press release 60-2024](https://www.esa.int/Newsroom/Press_Releases/ESA_launches_Moonlight_to_establish_lunar_communications_and_navigation_infrastructure) |
| Lunar Pathfinder orbit | ESA/SSTL | Elliptical: perilune altitude 673.4 km, apolune 7,331.8 km, inclination 46.8 deg, period 10 h, designed to maximise windows over the South Pole (2023 slides, search excerpt) | 2023 | [ESA slides](https://spacefinland.fi/documents/60305973/0/ESA+-+Moonlight_LP_and_LCNS_Slides+(1).pdf/d5399da8-26d6-016b-2cda-703c8ac70f16/ESA+-+Moonlight_LP_and_LCNS_Slides+(1).pdf?t=1695736353872) |
| Queqiao-2 | CNSA | Launched 20 Mar 2024; elliptical frozen orbit planned ~200 x 16,000 km, 24 h period, 62.4 deg inclination (observed ~254 x 16,941 km, 26.18 h, 119.25 deg retrograde per amateur tracking); 4.2 m X-band antenna; supports Chang'e 6, then Chang'e 7 (2026) and Chang'e 8; a 12 h orbit is planned for later south-polar missions; ~8 h of contact per orbit quoted for the 12 h orbit | 2024 | [Wikipedia](https://en.wikipedia.org/wiki/Queqiao-2); [Planetary Society](https://www.planetary.org/space-missions/queqiao-2-chinas-bridge-for-lunar-exploration) |

### Inferences
- Earth visibility is strongly anti-correlated with closeness to the pole and with being behind Malapert/Mons Mouton as seen from Earth; ranking should treat (a) ~100 % sites (Malapert summit, Mons Mouton peaks), (b) ~40-75 % regional sites, and (c) ~50 %-or-less ridge sites near Shackleton as distinct classes.
- For a DTE-only mission the usable landing window is the intersection of a ~2-week Earth-visible window with sunlit time and with a 6.5-day NRHO descent opportunity, which is why NASA finds each region offers few viable dates and keeps several regions open.
- Mast height improves Earth line of sight for the same reason it improves sunlight (near-field horizon), per the Malapert 5 m viewshed argument.

### Gaps
- Per-site Earth-visibility percentages for Shackleton rim, Connecting Ridge, de Gerlache rim, Nobile rim and Haworth from a primary source were not obtained (they are in Mazarico 2011 and the PGDA `_EARTH` rasters).
- No fetched source states the libration amplitude or the exact up/down period of Earth; "~2 weeks on / 2 weeks off" comes from NASA and ESA study summaries.
- Nothing was found tying the name "LCRNS" (Lunar Communications Relay and Navigation Systems) to specific coverage numbers; the Khon schedule is from 2024 trade press and may be out of date.

## Q6. Thermal environment (Diviner): sunlit terrain vs PSRs, subsurface, swings, low-Sun effects

### Takeaway
PSR floors are among the coldest measured surfaces in the Solar System (annual average 37 K at the LCROSS site in Cabeus; winter minimum maps bottom out near 18 K), whereas the water-ice stability threshold used in the literature is ~110 K maximum temperature and typical polar averages are ~200 K maximum / ~50 K minimum. Temperature is controlled by slope and shadow at metre scale, so a lander straddles hot sunlit faces and ~100 K shadows at the same time.

### Cited Findings

| Quantity | Value | Year | Source |
|---|---|---|---|
| Annual average temperature, PSR part of Cabeus (LCROSS impact site) | 37 K | 2010 | [UCLA/Diviner release on Paige et al. 2010 and Hayne et al. 2010, Science](https://www.eurekalert.org/news-releases/648084) |
| Estimated subsurface temperature at the LCROSS site | 38 K | 2010 | [Paige et al. 2010 abstract](https://researchconnect.stonybrook.edu/en/publications/diviner-lunar-radiometer-observations-of-cold-traps-in-the-moons-/) |
| Minimum daytime brightness temperature in parts of south-polar PSR craters | below -397 F (~35 K) | 2009 | [Space.com on Diviner first results](https://www.space.com/7311-moon-craters-coldest-place-solar-system.html) |
| South-pole winter minimum temperature map (13 Artemis regions) colour scale | 90 K down to 18 K | 2023 | [NASA NESC webinar, NTRS 20230017131](https://ntrs.nasa.gov/api/citations/20230017131/downloads/The%20Visual%20Experience%20at%20the%20Lunar%20South%20Pole.pdf) |
| Polar-region averages | ~200 K maximum, ~50 K minimum; south polar mean maxima ~11 K warmer than north (search excerpt) | 2017 | [Williams et al. 2017, Icarus](https://www.sciencedirect.com/science/article/pii/S0019103516304869) |
| Water cold-trap threshold | maximum temperature < ~110 K (ice stable over ~1 Gyr); PSR surfaces with maxima >125 K cannot keep surface frost | 2017/2019 | [Fisher et al. 2017](https://ntrs.nasa.gov/api/citations/20170003782/downloads/20170003782.pdf); [Williams et al. 2019](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2019JE006028) |
| Seasonal change in cold-trap area (<110 K), south | x2.8 larger in winter | 2019 | [Williams et al. 2019](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2019JE006028) |
| Seasonal change in maximum temperature in seasonally shadowed terrain | exceeds 100 K (search excerpt of the paper's Fig. 7) | 2019 | [Williams et al. 2019, Fig. 7](https://www.researchgate.net/figure/Difference-in-maximum-summer-and-winter-temperatures-for-the-a-south-and-b-north_fig7_335171553) |
| Total lunar water cold-trap area incl. micro cold traps | ~40,000 km2, mostly poleward of 80 deg; 10-20 % in "micro" traps (1 km to 1 cm) | 2020 | [Hayne et al. 2020, arXiv:2005.05369](https://arxiv.org/abs/2005.05369) |
| Coldest PSR on the Mons Mouton plateau | 85 K (search excerpt) | 2025 | [Wueller et al. 2025](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2025JE009127) |
| Shadowed 20 m crater where IM-2 came to rest (Mons Mouton) | about -173 C (-280 F), ~100 K | 2025 | [Ars Technica via Wikipedia IM-2](https://en.wikipedia.org/wiki/IM-2) |

- Diviner data set: Williams et al. 2019 compiled ~10 years (2009-2019) of radiance data into polar maps poleward of 80 deg by local time and season; grazing sunlight makes topography the dominant control (2019) — [Williams et al. 2019](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2019JE006028)
- PSRs are not uniformly cold: "infrared emission from nearby illuminated walls raise some PSR temperatures above the water ice preservation temperature" (2017) — [Fisher et al. 2017](https://ntrs.nasa.gov/api/citations/20170003782/downloads/20170003782.pdf)
- South-pole surface reflectance rises sharply below ~110 K maximum temperature within 5 deg of the pole, consistent with surface frost (2017) — [Fisher et al. 2017](https://ntrs.nasa.gov/api/citations/20170003782/downloads/20170003782.pdf)
- Water ice is stable in PSRs out to ~10 deg from the poles, and in the subsurface of unshaded ground within ~2 deg of the pole (Vasavada et al. 1999, as cited 2018) — [Glaeser et al. 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf)
- Paige et al. 2010 measurements were taken in Sept-Oct 2009 when south polar temperatures were near their annual maximum (search excerpt) — [Paige et al. 2010](https://researchconnect.stonybrook.edu/en/publications/diviner-lunar-radiometer-observations-of-cold-traps-in-the-moons-/)
- Slope sensitivity measured in situ at 69.37 S (Chandrayaan-3 ChaSTE, 2023): peak surface temperature 355 K (+/-0.5 K) on a ~6 deg Sun-facing slope versus ~332 K (+/-1 K) on flat ground about a metre away; pre-landing prediction ~330 K — [Wikipedia Chandrayaan-3](https://en.wikipedia.org/wiki/Chandrayaan-3)
- Short darkness swings: a ~5-hour eclipse took a mid-latitude surface from about +40 C to -170 C (press report, 2025) — [Astronomy.com](https://www.astronomy.com/space-exploration/fireflys-blue-ghost-lander-nails-lunar-mission/)
- Maximum time in shadow is the key thermal parameter for hardware ("time a rover is exposed to very low temperature levels while there is no possibility to charge the batteries"); at the best sites it is 20-50 % of a normal lunar night (2018) — [Glaeser et al. 2018](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf)
- Low-Sun optical effects: shadows ~27x object height; rocks cast shadows of feet, a lander casts shadows of miles; white surfaces become blinding in direct sunlight; deep shadows are only partly filled by earthshine or terrain reflection and can hide large obstacles (2023-2025) — [NASA OCHMO-TB-001](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-001-artemis-lighting-considerations.pdf); [NASA MSFC](https://www.nasa.gov/directorates/esdmd/artemis-campaign-development-division/human-landing-system-program/nasa-engineers-simulate-lunar-lighting-for-artemis-iii-moon-landing); [NESC webinar](https://ntrs.nasa.gov/api/citations/20230017131/downloads/The%20Visual%20Experience%20at%20the%20Lunar%20South%20Pole.pdf)
- Sunward-pointing sensors at ~2 deg elevation may be challenged; Apollo 12's colour TV camera was burned out when pointed at a 7.5 deg Sun; LIDAR is suggested for hazard sensing where cameras struggle (2020; 2023) — [Fassett and Zanetti 2020](https://www.hou.usra.edu/meetings/lunarsurface2020/pdf/5067.pdf); [Null et al. 2023](https://ntrs.nasa.gov/api/citations/20230006313/downloads/IAASS%202023%20Paper_Final_24apr23.pdf)

### Inferences
- With the Sun at 1-7 deg, the lander body receives near-full solar flux on one vertical side while the ground receives very little, so heating is horizontal and one-sided and rotates 360 deg per lunar day; radiators and arrays must be designed for a horizon-hugging Sun (vertical arrays, upward-facing radiators).
- A site's thermal desirability can be approximated in the app by (i) maximum continuous darkness and (ii) distance to <110 K terrain for science, since published per-site summer maximum temperatures for the sunlit ridges were not found.

### Gaps
- Could not retrieve Diviner summer-maximum and winter-minimum values for named features (Shackleton, Haworth, Shoemaker, Faustini, de Gerlache floors; sunlit Shackleton rim / Connecting Ridge), nor the often-quoted ~25 K minimum (attributed in press coverage to a north-polar crater) from a primary source. The Diviner UCLA site failed certificate checks and Paige 2010 / Williams 2019 full texts were inaccessible.
- No sourced subsurface temperature profile for sunlit polar regolith was found (only the 38 K LCROSS-site estimate).
- No NASA document with a lander-level thermal environment specification (sink temperatures, fluxes) for south-pole sites was read; NASA's Lunar Surface Data Book (M2M-30044 / ACD-50044) likely has it but exceeded the fetch size limit: [NTRS 20250002845](https://ntrs.nasa.gov/api/citations/20250002845/downloads/M2M-30044%20Lunar%20Surface%20Data%20Book%20Baseline_Final.pdf).

## Q7. Practical consequences from real missions and NASA's crewed-landing lighting constraints

### Takeaway
NASA's Artemis III rules of thumb are: land within 6 deg of the pole, on <10 deg slope, within 100 m of the target, with the surface lit for the whole ~6-6.5-day stay and (absent relays) Earth in view; a descent is possible only once per ~6.5-day NRHO revolution, and each region offers few dates when everything lines up. The two commercial polar-region landings so far (IM-1 at 80.13 S, IM-2 at 84.79 S) both tipped over after altimeter failures, and IM-2 ended in a ~100 K shadowed crater producing ~100 W for under 13 hours — the clearest demonstration of how metre-scale shadow decides mission outcome.

### Cited Findings

**Table 7a. NASA Artemis III landing-site constraints**

| Constraint | Value | Year | Source |
|---|---|---|---|
| Latitude | within 6 deg of the South Pole | 2022 | [NASA release 22-089](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/) |
| Region / site definition | region ~15 x 15 km; landing site = ~100 m radius | 2022 | [NASA release 22-089](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/) |
| Light for the surface stay | all 13 regions contain sites with "continuous access to sunlight throughout a 6.5-day period" | 2022 | [NASA release 22-089](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/) |
| Surface stay duration (updated) | ~5.75 to 6.25 days depending on mission epoch; solar illumination "a critical requirement for the entire crewed surface stay" | 2026 | [George et al., LPSC 2026 #1901](https://www.hou.usra.edu/meetings/lpsc2026/pdf/1901.pdf) |
| Slope | landing (100 m) <10 deg; EVA (2 km) <20 deg | 2023 | [NTRS 20230005904 (decoded slide text)](https://ntrs.nasa.gov/api/citations/20230005904/downloads/PlatteCity_Artemis.pdf) |
| Landing accuracy | within 100 m of target (HLS-RQMT-001: 100 m-radius landing ellipse) | 2021/2023 | [Barker et al. 2021](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf) |
| Communications | direct with Earth, assuming no relay; Earth visibility <25 % removes areas | 2023 | [NTRS 20230005904](https://ntrs.nasa.gov/api/citations/20230005904/downloads/PlatteCity_Artemis.pdf) |
| Lighting | (a) surface lighting, solar visibility below 5 % removes areas; (b) approach lighting: "Illumination along the approach trajectory is beneficial. The approach trajectory is different for each landing opportunity" | 2023 | [NTRS 20230005904](https://ntrs.nasa.gov/api/citations/20230005904/downloads/PlatteCity_Artemis.pdf) |
| Descent opportunities | NRHO period ~6.5 days, so descent possible once per ~6.5 days (~55 per year), further reduced by Earth-Moon mechanics and SLS/Orion limits | 2023 | [NTRS 20230005904](https://ntrs.nasa.gov/api/citations/20230005904/downloads/PlatteCity_Artemis.pdf) |
| Availability | constraints are "evaluated simultaneously on a calendar basis"; individual regions "typically provide limited viable opportunities"; more than one region must be retained | 2026 | [George et al., LPSC 2026 #1901](https://www.hou.usra.edu/meetings/lpsc2026/pdf/1901.pdf) |
| Final site choice | made after target launch dates are set, because dates fix transfer trajectories and surface conditions | 2024 | [NASA release 24-136](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/) |

- 13 candidate regions (19 Aug 2022): Faustini Rim A, Peak Near Shackleton, Connecting Ridge, Connecting Ridge Extension, de Gerlache Rim 1, de Gerlache Rim 2, de Gerlache-Kocher Massif, Haworth, Malapert Massif, Leibnitz Beta Plateau, Nobile Rim 1, Nobile Rim 2, Amundsen Rim — [NASA release 22-089](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/)
- 9 candidate regions (28 Oct 2024): Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater Plain; criteria: science potential, launch-window availability, terrain, communication with Earth, lighting — [NASA release 24-136](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/)
- Regions "demonstrating greater robustness across mission epochs and reduced sensitivity to seasonal effects were favored"; removed regions are not deemed unsuitable for later missions (2026) — [George et al., LPSC 2026 #1901](https://www.hou.usra.edu/meetings/lpsc2026/pdf/1901.pdf)

**Table 7b. Sun elevation during crewed surface work: Apollo vs Artemis (NASA MSFC, 2020)** — [Fassett and Zanetti 2020](https://www.hou.usra.edu/meetings/lunarsurface2020/pdf/5067.pdf)

| EVA | Sun elevation |
|---|---|
| Apollo 12 EVA-1 (lowest of Apollo) | 7.5-9.5 deg |
| Apollo 14 EVA-1 | 13.0-15.5 deg |
| Apollo 11 EVA-1 | 14.0-15.4 deg |
| Apollo 15 EVA-1 / EVA-3 | 19.6-22.9 / 41.7-44.2 deg |
| Apollo 16 EVA-1 / EVA-3 | 22.1-25.7 / 45.8-48.7 deg |
| Apollo 17 EVA-1 / EVA-3 | 15.3-19.0 / 39.0-42.6 deg |
| Artemis candidate LS1 (12/2024) | < 2.1 deg |
| Artemis candidate LS2 (12/2024) | < 1.75 deg |

- NASA NESC findings (2022 workshop, 2023-2024 reports): Sun never above 7 deg in the landing regions; crews cannot avoid having the Sun in their eyes; no existing requirement guaranteed functional vision when moving between sunlight and shadow; NESC recommended making functional vision a design requirement and integrating lighting, window and visor design — [NASA NESC](https://www.nasa.gov/centers-and-facilities/nesc/characterizing-the-visual-experience-of-astronauts-at-the-lunar-south-pole/); [Null et al., IAASS 2023](https://ntrs.nasa.gov/api/citations/20230006313/downloads/IAASS%202023%20Paper_Final_24apr23.pdf)
- NASA-STD-3001 Vol. 2 Rev D requirements cited for Artemis lighting: [V2 8051] illumination levels, [V2 8053] emergency lighting, [V2 8058] glare prevention, [V2 8103] environmental lighting attenuation, [V2 8104] reduce contrast in sunlit-area shadows to within 2 orders of magnitude of the maximum predicted surface luminance; test meters must cover up to 130,000 lux (2023) — [NASA OCHMO-TB-001 Rev B](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-001-artemis-lighting-considerations.pdf)
- Apollo experience at low Sun: slope misjudged (Apollo 12 crew thought a ~10 deg slope was ~40 deg), washed-out view down-Sun, glare up-Sun; in driving simulations crews tacked +/-20-30 deg to avoid Sun glare and their own shadow (2020; 2024) — [Fassett and Zanetti 2020](https://www.hou.usra.edu/meetings/lunarsurface2020/pdf/5067.pdf); [NTRS 20240011393](https://ntrs.nasa.gov/citations/20240011393)

**Table 7c. Robotic landings at high southern latitude**

| Mission | Date (UTC) | Site (lat, lon E) | What happened (lighting/thermal/comm-relevant) | Source |
|---|---|---|---|---|
| IM-1 Odysseus | 22 Feb 2024, 23:23:53 | Malapert A, -80.13, 1.44; elevation 2,579 m; ~300 km from pole | Laser altimeters unusable; landed on a 12 deg slope in a degraded ~1 km crater (design/nav target <=5-10 deg), broke a leg, rested ~30 deg tilted; antennas mis-pointed so data rates far below plan; ended when the Sun moved off the one lit panel and lunar night began (power lost 29 Feb); not revived after the night | [LROC](https://lroc.im-ldi.com/images/1360); [Wikipedia IM-1](https://en.wikipedia.org/wiki/IM-1) |
| IM-2 Athena | 6 Mar 2025, ~17:28 | Mons Mouton, -84.7906, 29.1957 (~158 km from pole, derived) | Altimeter failed again; hit plateau, skidded, came to rest on its side in a ~20 m shadowed crater at about -173 C; arrays not facing the Sun and dust-coated, ~100 W, insufficient for heaters plus high-gain antenna; operations ended <13 h after landing (7 Mar 06:15); >400 MB returned | [LROC](https://lroc.im-ldi.com/images/1408); [Wikipedia IM-2](https://en.wikipedia.org/wiki/IM-2); [NASA](https://www.nasa.gov/news-release/nasa-receives-some-data-before-intuitive-machines-ends-lunar-mission/) |
| Chandrayaan-3 Vikram | 23 Aug 2023, 12:33 | Statio Shiv Shakti, -69.373, 32.319 | Landed about a day after local dawn to maximise the ~14-Earth-day sunlit mission; lander shut down at sunset 12 days later; neither lander nor rover answered wake-up calls on 22 Sep 2023 after the night; ChaSTE measured 355 K on a 6 deg Sun-facing slope vs 332 K on flat ground | [Wikipedia Chandrayaan-3](https://en.wikipedia.org/wiki/Chandrayaan-3); [jatan.space](https://jatan.space/chandrayaan-3-makes-historic-touchdown/) |

- IM-2 "reached the landing site right around local sunrise", a timing meant to give a two-week operating span (2025) — [Sky and Telescope](https://skyandtelescope.org/astronomy-news/intuitive-machines-athena-lands-on-the-moon-then-dies/)
- Shadow hazards for the ESA Lunar Lander were assessed with LROC images taken at illumination angles equivalent to the planned landing time, and combined illumination + communication patterns were used "to establish possible landing dates and a mission timeline" (2012) — [De Rosa et al. 2012](https://www.lpi.usra.edu/meetings/lpsc2012/pdf/1585.pdf)

### Inferences
- Landing-window ranking should require, per NASA practice: Sun continuously visible at the site for the whole stay (>= ~6.5 days; >= 10 days is Wueller's "favourable" threshold), Earth visible if DTE, and a date near the site's local illumination peak; landing early in a long lit interval (as IM-2 and Chandrayaan-3 did at local sunrise) maximises operating time.
- Both IM failures were navigation-sensor failures, but the outcome (dead in hours rather than days) was set by the polar light geometry: at 5 deg Sun elevation any 20 m crater floor is in shadow, and a tipped lander cannot point arrays at a horizon Sun.
- A site's value should be discounted by the fraction of its 100 m-radius landing circle that is in shadow at the landing epoch, not only by the pixel-level illumination of the target.

### Gaps
- No NASA document giving a numeric Sun-azimuth-versus-approach-path constraint or a minimum Sun elevation for Artemis descent was found; only the qualitative "illumination along the approach trajectory is beneficial". The HLS descent design paper ([NTRS 20220011114](https://ntrs.nasa.gov/api/citations/20220011114/downloads/ArtemisHLSDDL_v3.pdf)) exceeded the fetch size limit.
- Sun elevation at touchdown for IM-1, IM-2 and Chandrayaan-3 was not found in any source read; no official IM or NASA statement attributing the altimeter problems to low Sun or long shadows was found.
- NASA slide values in Tables 5 and 7a taken from NTRS 20230005904 were decoded from an obfuscated PDF text layer and should be checked against the slides visually.
