# Credits

Every library, font, icon, texture and data source used in the app, with its licence and link. Each entry names the file it was taken from. Where a source states no licence, the entry says so.

## Special thanks

- Dagny Locher and Elia Jonas — our supervisors and teachers
- The Student Research Center in Bad Saulgau, Germany (SFZ) — https://sfz-bw.de
- MEXG, our school — https://mexg.de
- Sponsor: Prime Balance — https://prime-balance.de
- Our team: Otto Erwerle — Code Lead · Leonhard Greiner — Science Lead · Isaac Brauer — AI Lead · Benedikt Schmidt — Design & UI Lead

## Libraries

Shipped in `app/package.json` under `dependencies`. Licence from the `license` field of each package in `app/node_modules`; link from its `homepage`.

| Library | Version | Licence | Link |
|---|---|---|---|
| three | 0.170.0 | MIT | https://threejs.org/ |
| d3 | 7.9.0 | ISC | https://d3js.org |
| react | 19.3.1 | MIT | https://react.dev/ |
| react-dom | 19.3.1 | MIT | https://react.dev/ |
| ionicons | 8.1.0 | MIT | http://ionicons.com/ |

## Fonts

Shipped as web fonts through four `@fontsource` packages in `app/package.json`. Licence from each package's `LICENSE` file, which reproduces the SIL Open Font License 1.1 (OFL-1.1, as stated in `package.json`).

| Font | Package and version | Copyright line in LICENSE | Licence | Link |
|---|---|---|---|---|
| IBM Plex Sans | @fontsource/ibm-plex-sans 5.3.0 | Copyright 2019 IBM Corp. | SIL OFL 1.1 | https://fontsource.org/fonts/ibm-plex-sans |
| IBM Plex Mono | @fontsource/ibm-plex-mono 5.3.0 | Copyright 2017 IBM Corp. | SIL OFL 1.1 | https://fontsource.org/fonts/ibm-plex-mono |
| Newsreader | @fontsource/newsreader 5.3.0 | Copyright 2020 The Newsreader Project Authors | SIL OFL 1.1 | https://fontsource.org/fonts/newsreader |
| Michroma (mission name) | @fontsource/michroma 5.3.0 | Copyright 2011 The Michroma Project Authors | SIL OFL 1.1 | https://fontsource.org/fonts/michroma |

## Icons

| Set | Version | Licence | Link | Icons used |
|---|---|---|---|---|
| Ionicons | 8.1.0 | MIT (`package.json` and `LICENSE` in the package) | http://ionicons.com/ | `rocket-outline` (Mission menu), `warning-outline` (slope warning), `information-circle-outline` (Details button), used as static SVG files in `app/src/views/Icon.tsx`; `settings-outline` is still bundled there but no longer shown |

## Textures and images

`app/public/` contains no 3D models, artwork or photographs other than the textures below (checked with `git ls-files app/public`). The four main textures are resampled from NASA products by `scripts/textures.py`; the south-cap colour texture by `scripts/south_cap.py`. Per-file details are in `app/public/textures/CREDITS.md`.

| File | Made from | Source | Credit as stated |
|---|---|---|---|
| `app/public/textures/moon_color_4k.webp` | `lroc_color_poles_4k.tif` | NASA SVS 4720, CGI Moon Kit: https://svs.gsfc.nasa.gov/4720 | NASA's Scientific Visualization Studio; LRO/LROC/LOLA teams |
| `app/public/textures/moon_normal_2k.png` | `ldem_16_uint.tif` (LOLA elevation) | NASA SVS 4720: https://svs.gsfc.nasa.gov/4720 | NASA's Scientific Visualization Studio; LRO/LOLA team |
| `app/public/textures/cap_color_2k.webp` | `lroc_color_poles_8k.tif` | NASA SVS 4720: https://svs.gsfc.nasa.gov/4720 | NASA's Scientific Visualization Studio; LRO/LROC/LOLA teams |
| `app/public/textures/earth_2k.jpg` | `world.200411.3x5400x2700.jpg` (Blue Marble Next Generation, November 2004) | https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/november/world.200411.3x5400x2700.jpg | NASA Earth Observatory (Stöckli et al.) |
| `app/public/textures/stars_4k.jpg` | `starmap_2020_4k.exr` (Deep Star Maps 2020) | NASA SVS 4851: https://svs.gsfc.nasa.gov/4851 | NASA/Goddard Space Flight Center Scientific Visualization Studio |

**Licence:** NASA media. `app/public/textures/CREDITS.md` quotes the NASA Images and Media Usage Guidelines (https://www.nasa.gov/nasa-brand-center/images-and-media/): such content is "generally not subject to copyright in the United States", NASA "should be acknowledged as the source", use must not imply endorsement, and the NASA insignia and logotype are not in the public domain (the app uses neither).

## Data sources

### Raw NASA, PDS and NAIF files

From the register table in `docs/reference/data-sources.md`. Licence column copied from that table. The files themselves are not in git.

| File | Source | Licence or citation, as recorded |
|---|---|---|
| de440s.bsp | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp | No license file; attribute NASA/JPL/Caltech |
| naif0012.tls | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls | No license file; attribute NASA/JPL/Caltech |
| pck00011.tpc | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc | No license file; attribute NASA/JPL/Caltech |
| moon_pa_de440_200625.bpc | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc | No license file; attribute NASA/JPL/Caltech |
| moon_pa_de440_200625.cmt | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.cmt | No license file; attribute NASA/JPL/Caltech |
| moon_de440_250416.tf | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf | No license file; attribute NASA/JPL/Caltech |
| LDEM_80S_20MPP_ADJ.TIF | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF | Cite Barker et al. 2023 (DOI 10.3847/PSJ/acf3e1) + data DOI 10.60903/gsfcpgda-lola-spole |
| LDEM_60S_120MPP_ADJ.TIF | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_120MPP_ADJ.TIF | Cite Barker et al. 2023 (DOI 10.3847/PSJ/acf3e1) + data DOI 10.60903/gsfcpgda-lola-spole; no explicit licence on the product page |
| ldem_875s_5m.img | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.img | PDS: free use, attribute NASA/LOLA team / PDS Geosciences Node; no license file in the bundle |
| ldem_875s_5m.lbl | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.lbl | PDS: free use, attribute NASA/LOLA team / PDS Geosciences Node; no license file in the bundle |
| avgvisib_85s_060m_201608.img | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_85s_060m_201608.img | Cite Mazarico et al. 2011 (Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030); see docs/archive/download-checklist.md section 3 |
| avgvisib_85s_060m_201608.lbl | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_85s_060m_201608.lbl | Cite Mazarico et al. 2011 (Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030); see docs/archive/download-checklist.md section 3 |
| avgvisib_85s_060m_201608_earth.img | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_85s_060m_201608_earth.img | Cite Mazarico et al. 2011 (Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030); see docs/archive/download-checklist.md section 3 |
| avgvisib_85s_060m_201608_earth.lbl | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_85s_060m_201608_earth.lbl | Cite Mazarico et al. 2011 (Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030); see docs/archive/download-checklist.md section 3 |
| avgvisib_65s_240m_201608.img | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_65s_240m_201608.img | Cite Mazarico et al. 2011 (Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030); see docs/archive/download-checklist.md section 3 |
| avgvisib_65s_240m_201608.lbl | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_65s_240m_201608.lbl | Cite Mazarico et al. 2011 (Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030); see docs/archive/download-checklist.md section 3 |
| avgvisib_65s_240m_201608_earth.img | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_65s_240m_201608_earth.img | Cite Mazarico et al. 2011 (Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030); see docs/archive/download-checklist.md section 3 |
| avgvisib_65s_240m_201608_earth.lbl | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_65s_240m_201608_earth.lbl | Cite Mazarico et al. 2011 (Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030); see docs/archive/download-checklist.md section 3 |
| AVGVISIB_75S_120M_201608.IMG | http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608.IMG | Cite Mazarico et al. 2011 (Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030); see docs/archive/download-checklist.md section 3 |
| AVGVISIB_75S_120M_201608.LBL | http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608.LBL | Cite Mazarico et al. 2011 (Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030); see docs/archive/download-checklist.md section 3 |
| AVGVISIB_75S_120M_201608_EARTH.IMG | http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608_EARTH.IMG | Cite Mazarico et al. 2011 (Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030); see docs/archive/download-checklist.md section 3 |
| AVGVISIB_75S_120M_201608_EARTH.LBL | http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608_EARTH.LBL | Cite Mazarico et al. 2011 (Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030); see docs/archive/download-checklist.md section 3 |
| dlre_prp_south.tab | https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.tab | No licence or usage terms in the .lbl or .xml; public NASA PDS data, released under NASA SMD policy SPD-41a (https://science.nasa.gov/researchers/science-data/science-information-policy/). Cite "Paige et al., LRO DLRE LEVEL 5 PRP V2.0, NASA Planetary Data System, LRO-L-DLRE-5-PRP-V2.0, 2018" (prpds.cat CITATION_DESC) |
| dlre_prp_south.lbl | https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.lbl | No licence or usage terms in the .lbl or .xml; public NASA PDS data, released under NASA SMD policy SPD-41a (https://science.nasa.gov/researchers/science-data/science-information-policy/). Cite "Paige et al., LRO DLRE LEVEL 5 PRP V2.0, NASA Planetary Data System, LRO-L-DLRE-5-PRP-V2.0, 2018" (prpds.cat CITATION_DESC) |
| dlre_prp_south.xml | https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.xml | No licence or usage terms in the .lbl or .xml; public NASA PDS data, released under NASA SMD policy SPD-41a (https://science.nasa.gov/researchers/science-data/science-information-policy/). Cite "Paige et al., LRO DLRE LEVEL 5 PRP V2.0, NASA Planetary Data System, LRO-L-DLRE-5-PRP-V2.0, 2018" (prpds.cat CITATION_DESC) |

### Mission and site sources

From `docs/reference/sources.md` (reading list for the south-pole sites, checked 24 Oct to 10 Nov 2026). Licence entries copy what that file records for each source.

| Source | Link | Licence as recorded in sources.md |
|---|---|---|
| NASA news release, Artemis III candidate regions, 19 Aug 2022 | https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon | No explicit licence text on the page; NASA media guidelines (below) |
| NASA news release, update on Artemis III landing regions, 28 Oct 2024 | https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions | No explicit licence text on the page; NASA media guidelines |
| NASA Artemis III mission page | https://www.nasa.gov/mission/artemis-iii/ | Not recorded in sources.md |
| Collins et al., LPSC 55 (2024), abstract 1775, LROC team | https://www.hou.usra.edu/meetings/lpsc2024/pdf/1775.pdf | No licence stated; cite the authors and abstract 1775 |
| NASA event page, Blue Origin Blue Moon MK1 | https://www.nasa.gov/event/clps-flight-blue-origins-blue-moon-mark-1/ | Not recorded in sources.md |
| NASA "Moon Base Phases" | https://www.nasa.gov/moonbase-phases/ | Not recorded in sources.md |
| NASA CLPS overview | https://www.nasa.gov/commercial-lunar-payload-services/ | Not recorded in sources.md |
| NASA CLPS landing sites | https://www.nasa.gov/commercial-lunar-payload-services/landing-sites/ | Not recorded in sources.md |
| NASA LRO image of the Odysseus lander (IM-1) | https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/ | NASA guidelines (as recorded in sources.md) |
| NASA news release, IM-2 data before end of mission, 7 Mar 2025 | https://www.nasa.gov/news-release/nasa-receives-some-data-before-intuitive-machines-ends-lunar-mission/ | Not recorded in sources.md |
| NASA news release, VIPER project ended, 17 Jul 2024 | https://www.nasa.gov/news-release/nasa-ends-viper-project-continues-moon-exploration/ | Not recorded in sources.md |
| NASA news release, Blue Origin to deliver VIPER, 19 Sep 2025 | https://www.nasa.gov/news-release/nasa-selects-blue-origin-to-deliver-viper-rover-to-moons-south-pole/ | Not recorded in sources.md |
| NASA SVS 4937, VIPER landing site visualisation, 20 Sep 2021 | https://svs.gsfc.nasa.gov/4937 | NASA media guidelines, except the soundtrack, which is third-party and not to be reused |
| Beyer et al. 2025, "VIPER Site Analysis", Planetary Science Journal 6, 236 | https://iopscience.iop.org/article/10.3847/PSJ/ae061a | "Creative Commons Attribution 4.0 licence" (CC BY 4.0) |
| LROC featured image, IM-2 landing region, 26 Feb 2025 | https://lroc.im-ldi.com/images/1401 | "©2026 NASA/GSFC/LROC ... All rights reserved" on the page; terms at https://lroc.im-ldi.com/about/terms |
| LROC image, IM-2 Athena seen obliquely, 10 Mar 2025 | https://lroc.im-ldi.com/images/1408 | As the LROC image above |
| LROC image, IM-1 landing region, 19 Jan 2024 | https://lroc.im-ldi.com/images/1321 | As the LROC image above |
| LROC terms and citation | https://lroc.im-ldi.com/about/terms | Website images are copyrighted; educational use is permitted without prior permission with the credit "NASA/GSFC/Arizona State University"; commercial use needs permission; PDS-delivered data are in the public domain |

**NASA media guidelines:** https://www.nasa.gov/nasa-brand-center/images-and-media/ (as quoted in `docs/reference/sources.md`). The same page states that attribution of information incorporated into an LLM directly to NASA is not permitted.

### Ground stations

From `app/public/data/stations.json` (the sources are inside the file, in its `source_url` and `source_label` fields).

| Source | Link | Licence |
|---|---|---|
| DSN 810-005, Rev P, module 301, Table 5 (NASA JPL Deep Space Network) | https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301P.pdf | Licence not stated by the source |
| JAXA, station coordinates (DDOR) | https://ddor.nav.isas.jaxa.jp/station_coordinates/ | Licence not stated by the source |

### Research notes (points of interest)

Every distinct URL in the `sources` field of `docs/POIs/*.json`, grouped by site. The repository records no licence for these web pages; the terms of each page were not checked.

#### en.wikipedia.org (29)

- <https://en.wikipedia.org/wiki/Artemis_program>
- <https://en.wikipedia.org/wiki/Blue_Ghost_Mission_2>
- <https://en.wikipedia.org/wiki/Blue_Moon_Pathfinder_Mission_1>
- <https://en.wikipedia.org/wiki/Cabeus_(crater)>
- <https://en.wikipedia.org/wiki/Chandrayaan-3>
- <https://en.wikipedia.org/wiki/Chang%27e_7>
- <https://en.wikipedia.org/wiki/Chang%27e_8>
- <https://en.wikipedia.org/wiki/Commercial_Lunar_Payload_Services>
- <https://en.wikipedia.org/wiki/De_Gerlache_(crater)>
- <https://en.wikipedia.org/wiki/Faustini_(crater)>
- <https://en.wikipedia.org/wiki/Haworth_(crater)>
- <https://en.wikipedia.org/wiki/IM-1>
- <https://en.wikipedia.org/wiki/IM-2>
- <https://en.wikipedia.org/wiki/Idel%27son_(crater)>
- <https://en.wikipedia.org/wiki/LCROSS>
- <https://en.wikipedia.org/wiki/List_of_lunar_pits>
- <https://en.wikipedia.org/wiki/Lunar_south_pole>
- <https://en.wikipedia.org/wiki/Malapert_(crater)>
- <https://en.wikipedia.org/wiki/Mini-RF>
- <https://en.wikipedia.org/wiki/Mons_Mouton>
- <https://en.wikipedia.org/wiki/Nobile_(crater)>
- <https://en.wikipedia.org/wiki/Peak_of_eternal_light>
- <https://en.wikipedia.org/wiki/Schr%C3%B6dinger_(crater)>
- <https://en.wikipedia.org/wiki/Shackleton_(crater)>
- <https://en.wikipedia.org/wiki/Shoemaker_(lunar_crater)>
- <https://en.wikipedia.org/wiki/Slater_(crater)>
- <https://en.wikipedia.org/wiki/Sverdrup_(crater)>
- <https://en.wikipedia.org/wiki/VIPER_(rover)>
- <https://en.wikipedia.org/wiki/Wiechert_(crater)>

#### ntrs.nasa.gov (23)

- <https://ntrs.nasa.gov/api/citations/20150006822/downloads/20150006822.pdf>
- <https://ntrs.nasa.gov/api/citations/20170003782/downloads/20170003782.pdf>
- <https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf>
- <https://ntrs.nasa.gov/api/citations/20205008626/downloads/TM-20205008626.pdf>
- <https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf>
- <https://ntrs.nasa.gov/api/citations/20210021039/downloads/Phipps_NESF_2021_abstract.pdf>
- <https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf>
- <https://ntrs.nasa.gov/api/citations/20220008799/downloads/NASA%20ISRU%20Plans_Sanders_COSPAR-Final.pdf>
- <https://ntrs.nasa.gov/api/citations/20230002566/downloads/HLS%20NRHO%20to%20Lunar%20Surface%20and%20Back%20Mission%20Design_STRIVES.pptx.pdf>
- <https://ntrs.nasa.gov/api/citations/20230006313/downloads/IAASS%202023%20Paper_Final_24apr23.pdf>
- <https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf>
- <https://ntrs.nasa.gov/api/citations/20230014419/downloads/BarkernewviewSTIupdated.pdf>
- <https://ntrs.nasa.gov/api/citations/20230015518/downloads/DSNE_LunarSurfaceEnvironment_Chambers_v2.pdf>
- <https://ntrs.nasa.gov/api/citations/20230017131/downloads/The%20Visual%20Experience%20at%20the%20Lunar%20South%20Pole.pdf>
- <https://ntrs.nasa.gov/api/citations/20240011028/downloads/PSI_FLT_status_240905.pdf>
- <https://ntrs.nasa.gov/api/citations/20250011534/downloads/LEAG-2025_NASA%20Artemis%20Updates.pdf>
- <https://ntrs.nasa.gov/api/citations/20260003150/downloads/MSolo%20PRIME-1%20overview%20and%20results%20-%20LSSW.pdf>
- <https://ntrs.nasa.gov/api/citations/20260004959/downloads/NASAPSI_IPPW2026_v0.pdf>
- <https://ntrs.nasa.gov/citations/20050175993>
- <https://ntrs.nasa.gov/citations/20120010094>
- <https://ntrs.nasa.gov/citations/20170003782>
- <https://ntrs.nasa.gov/citations/20230002802>
- <https://ntrs.nasa.gov/citations/20240011393>

#### planetarynames.wr.usgs.gov (17)

- <https://planetarynames.wr.usgs.gov/Feature/10114>
- <https://planetarynames.wr.usgs.gov/Feature/13888>
- <https://planetarynames.wr.usgs.gov/Feature/1439>
- <https://planetarynames.wr.usgs.gov/Feature/14502>
- <https://planetarynames.wr.usgs.gov/Feature/15325>
- <https://planetarynames.wr.usgs.gov/Feature/1919>
- <https://planetarynames.wr.usgs.gov/Feature/247>
- <https://planetarynames.wr.usgs.gov/Feature/2650>
- <https://planetarynames.wr.usgs.gov/Feature/3603>
- <https://planetarynames.wr.usgs.gov/Feature/4321>
- <https://planetarynames.wr.usgs.gov/Feature/5450>
- <https://planetarynames.wr.usgs.gov/Feature/5494>
- <https://planetarynames.wr.usgs.gov/Feature/5782>
- <https://planetarynames.wr.usgs.gov/Feature/6541>
- <https://planetarynames.wr.usgs.gov/Feature/8057>
- <https://planetarynames.wr.usgs.gov/Feature/8058>
- <https://planetarynames.wr.usgs.gov/Feature/953>

#### nasa.gov (15)

- <https://nasa.gov/missions/moon-base/nasa-provides-updates-on-moon-base-cargo-landers-tech-demonstrations>
- <https://www.nasa.gov/centers-and-facilities/nesc/characterizing-the-visual-experience-of-astronauts-at-the-lunar-south-pole/>
- <https://www.nasa.gov/centers/ames/news/releases/2010/10-89AR.html>
- <https://www.nasa.gov/feature/goddard/2019/moon-mercury-ice>
- <https://www.nasa.gov/missions/artemis/clps/nasa-intuitive-machines-announce-landing-site-location-for-lunar-drill/>
- <https://www.nasa.gov/missions/artemis/clps/nasas-lunar-drill-technology-passes-tests-on-the-moon/>
- <https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/>
- <https://www.nasa.gov/moonbase-phases/>
- <https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/>
- <https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/>
- <https://www.nasa.gov/news-release/nasa-receives-some-data-before-intuitive-machines-ends-lunar-mission/>
- <https://www.nasa.gov/news-release/nasas-sofia-discovers-water-on-sunlit-surface-of-moon/>
- <https://www.nasa.gov/reference/moonbase-about/>
- <https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-001-artemis-lighting-considerations.pdf>
- <https://www.nasa.gov/wp-content/uploads/2026/03/building-the-moon-base.pdf>

#### data.lroc.im-ldi.com (11)

- <https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_AMUNDRIMLO1>
- <https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_CABEUSPKLO2>
- <https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_DEGERKCHLO1>
- <https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_DEGERRIMLO1>
- <https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_FAUSTINILO1>
- <https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_HAWORTH_LO1>
- <https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_MALAPERTLO1>
- <https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_MOUTNPLTLO1>
- <https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_MTMOUTONLO1>
- <https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_NOBILE02LO1>
- <https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_SHKLTNPKLO1>

#### lroc.im-ldi.com (11)

- <https://lroc.im-ldi.com/atlases/psr/list>
- <https://lroc.im-ldi.com/images/1128>
- <https://lroc.im-ldi.com/images/1131>
- <https://lroc.im-ldi.com/images/1247>
- <https://lroc.im-ldi.com/images/1255>
- <https://lroc.im-ldi.com/images/1294>
- <https://lroc.im-ldi.com/images/1360>
- <https://lroc.im-ldi.com/images/1401>
- <https://lroc.im-ldi.com/images/1408>
- <https://lroc.im-ldi.com/news/991>
- <https://lroc.im-ldi.com/posts/1294>

#### arxiv.org (10)

- <https://arxiv.org/abs/1208.5587>
- <https://arxiv.org/html/2406.19863v2>
- <https://arxiv.org/html/2502.06056v2>
- <https://arxiv.org/html/2601.14719v1>
- <https://arxiv.org/pdf/0810.2478>
- <https://arxiv.org/pdf/1208.5587>
- <https://arxiv.org/pdf/1410.6865>
- <https://arxiv.org/pdf/2005.05369>
- <https://arxiv.org/pdf/2302.10815v1.pdf>
- <https://www.arxiv.org/pdf/2303.03911>

#### doi.org (5)

- <https://doi.org/10.1029/2020GL088920>
- <https://doi.org/10.1029/2025JE009434>
- <https://doi.org/10.1038/s41586-025-08870-x>
- <https://doi.org/10.1126/science.1186986>
- <https://doi.org/10.1126/science.1203341>

#### hou.usra.edu (5)

- <https://www.hou.usra.edu/meetings/Artemis_III_2023/pdf/2042.pdf>
- <https://www.hou.usra.edu/meetings/lpsc2021/pdf/1013.pdf>
- <https://www.hou.usra.edu/meetings/lpsc2024/pdf/1695.pdf>
- <https://www.hou.usra.edu/meetings/lunarsurface12/pdf/8015.pdf>
- <https://www.hou.usra.edu/meetings/lunarsurface2020/pdf/5067.pdf>

#### jatan.space (5)

- <https://jatan.space/chandrayaan-3-makes-historic-touchdown/>
- <https://jatan.space/moon-monday-issue-136.md>
- <https://jatan.space/moon-monday-issue-165/>
- <https://jatan.space/moon-monday-issue-219/>
- <https://jatan.space/moon-monday-issue-277/>

#### elib.dlr.de (4)

- <https://elib.dlr.de/119091>
- <https://elib.dlr.de/126719/>
- <https://elib.dlr.de/140650>
- <https://elib.dlr.de/94240>

#### iopscience.iop.org (4)

- <https://iopscience.iop.org/article/10.3847/PSJ/abf3c5>
- <https://iopscience.iop.org/article/10.3847/PSJ/ac88c2>
- <https://iopscience.iop.org/article/10.3847/PSJ/ad1332>
- <https://iopscience.iop.org/article/10.3847/PSJ/ae10a4>

#### isro.gov.in (4)

- <https://www.isro.gov.in/Ch3_Alpha_Particle_X-ray_Spectrometer.html>
- <https://www.isro.gov.in/ISRO_EN/Chandrayaan2_Dual_Frequency_Synthetic_Aperture_Radar.html>
- <https://www.isro.gov.in/ISRO_EN/India_Bags_Credit_First-Ever_In-Situ_Measurement.html>
- <https://www.isro.gov.in/Recent_studies_suggest_more_ice_Moon.html>

#### spacepolicyonline.com (4)

- <https://spacepolicyonline.com/?p=90081>
- <https://spacepolicyonline.com/news/im-2-mission-ends-one-day-after-lunar-landing/>
- <https://spacepolicyonline.com/news/nasa-is-full-steam-ahead-on-artemis-iii-iv-and-v/>
- <https://spacepolicyonline.com/news/nasas-lro-spots-likely-luna-25-crash-site>

#### starlust.org (4)

- <https://starlust.org/heres-what-nasa-is-planning-for-artemis-iv-and-v-now-that-the-roadmap-to-the-moon-has-been-revised/>
- <https://starlust.org/microbes-in-the-moons-shadow-nasa-finds-some-organisms-could-survive-at-the-lunar-south-pole/>
- <https://starlust.org/nasa-prepares-for-moon-landings-begins-the-most-complex-plume-surface-interaction-tests/>
- <https://starlust.org/nasa-to-launch-three-moon-base-missions-this-year-itselfheres-all-you-need-to-know-about-them/>

#### zendy.io (4)

- <https://zendy.io/title/10.1029/2019je006028>
- <https://zendy.io/title/10.1029/2020je006464>
- <https://zendy.io/title/10.3847/psj/abb6ff>
- <https://zendy.io/title/10.3847/psj/ac532c>

#### nationalacademies.org (3)

- <https://www.nationalacademies.org/cdn/materials/9fba0b0c-198c-4772-a367-136febe32e2a>
- <https://www.nationalacademies.org/cdn/materials/a055a7cb-d07b-49dc-b8c1-d3636a5c507e>
- <https://www.nationalacademies.org/read/26029/chapter/6>

#### pgda.gsfc.nasa.gov (3)

- <https://pgda.gsfc.nasa.gov/products/69>
- <https://pgda.gsfc.nasa.gov/products/78>
- <https://pgda.gsfc.nasa.gov/products/90>

#### pmc.ncbi.nlm.nih.gov (3)

- <https://pmc.ncbi.nlm.nih.gov/articles/6130389>
- <https://pmc.ncbi.nlm.nih.gov/articles/PMC10499310/>
- <https://pmc.ncbi.nlm.nih.gov/articles/PMC12086667/>

#### science.nasa.gov (3)

- <https://science.nasa.gov/humans-in-space/human-related-microbes-may-survive-moons-south-pole-nasa-finds/>
- <https://science.nasa.gov/solar-system/moon/nasas-lro-lunar-ice-deposits-are-widespread/>
- <https://science.nasa.gov/wp-content/uploads/2023/05/NuggetHydrogenAtTheLunarPoles20170210.pdf>

#### scientificamerican.com (3)

- <https://www.scientificamerican.com/article/china-delays-ambitious-change-7-moon-mission-until-2027/>
- <https://www.scientificamerican.com/article/moon-ice/>
- <https://www.scientificamerican.com/article/will-increasing-traffic-to-the-moon-contaminate-its-precious-ice/>

#### space.com (3)

- <https://www.space.com/7311-moon-craters-coldest-place-solar-system.html>
- <https://www.space.com/space-exploration/launches-spacecraft/bad-weather-delays-launch-of-chinas-historic-change-7-mission-to-moons-south-pole>
- <https://www.space.com/total-lunar-eclipse-march-2025-what-happens-to-solar-powered-spacecraft>

#### ui.adsabs.harvard.edu (3)

- <https://ui.adsabs.harvard.edu/abs/2020P&SS..18004775L>
- <https://ui.adsabs.harvard.edu/abs/2021LPI....52.2530W/abstract>
- <https://ui.adsabs.harvard.edu/abs/2023NatGe..16..294H>

#### agupubs.onlinelibrary.wiley.com (2)

- <https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2019JE006028>
- <https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2025JE009127>

#### astronomy.com (2)

- <https://astronomy.com/observing/the-lunar-reconnaissance-orbiters-lyman-alpha-mapping-project-reveals-lunar-surface-features>
- <https://www.astronomy.com/space-exploration/how-nasa-plans-to-build-a-moon-base/>

#### diviner.ucla.edu (2)

- <https://www.diviner.ucla.edu/science>
- <https://www.diviner.ucla.edu/single-post/unveiling-the-faustini-permanently-shadowed-region-of-the-moon>

#### eurekalert.org (2)

- <https://www.eurekalert.org/news-releases/551736>
- <https://www.eurekalert.org/news-releases/648084>

#### ipnpr.jpl.nasa.gov (2)

- <https://ipnpr.jpl.nasa.gov/progress_report/42-176/176C.html>
- <https://ipnpr.jpl.nasa.gov/progress_report/42-176/176C.pdf>

#### militaryaerospace.com (2)

- <https://www.militaryaerospace.com/commercial-aerospace/article/55366507/nasa-awards-1804-million-clps-contract-to-intuitive-machines-for-lunar-south-pole-payload-delivery>
- <https://www.militaryaerospace.com/home/article/55000283/nasa-announces-first-lunar-instruments-for-artemis-astronaut-deployment>

#### payloadspace.com (2)

- <https://payloadspace.com/im-1-is-sideways-but-weve-all-been-there/>
- <https://payloadspace.com/nasa-outlines-the-details-of-artemis-iii-and-iv-missions/>

#### sciencedaily.com (2)

- <https://www.sciencedaily.com/releases/1998/09/980904041903.htm>
- <https://www.sciencedaily.com/releases/2012/06/120620141159.htm>

#### spaceflightnow.com (2)

- <https://spaceflightnow.com/2025/03/07/intuitive-machines-im-2-mission-ends-with-lander-on-its-side-on-the-moon/>
- <https://spaceflightnow.com/2025/10/28/astrobotic-delays-griffin-1-moon-mission-to-net-july-2026/>

#### spacenews.com (2)

- <https://spacenews.com/?p=130778>
- <https://spacenews.com/china-delays-change-7-lunar-south-pole-landing-mission-launch/>

#### spacenexus.us (2)

- <https://spacenexus.us/moon/missions/change-8>
- <https://spacenexus.us/moon/weekly/week-of-2026-11-02>

#### universetoday.com (2)

- <https://universetoday.com/143614/chinas-lander-successfully-grew-some-cotton-plants-on-the-moon-fruit-flies-and-potatoes-didnt-fare-so-well/>
- <https://www.universetoday.com/articles/here-is-where-astronauts-might-land-on-the-moon>

#### zenodo.org (2)

- <https://zenodo.org/record/7780129>
- <https://zenodo.org/records/17084058>

#### aasnova.org (1)

- <https://aasnova.org/2023/04/14/planning-for-touchdown-new-maps-of-the-moons-south-pole/>

#### aerospaceamerica.aiaa.org (1)

- <https://aerospaceamerica.aiaa.org/how-intuitive-machines-is-planning-to-make-its-third-moon-landing-a-successful-one/>

#### ar5iv.arxiv.org (1)

- <https://ar5iv.arxiv.org/html/1304.8123>

#### ar5iv.labs.arxiv.org (1)

- <https://ar5iv.labs.arxiv.org/html/1103.1687>

#### astrobiology.com (1)

- <https://astrobiology.com/2025/06/09/a-microbial-survival-model-for-the-permanently-shadowed-regions-of-the-moon-shows-long-term-survival-of-terrestrial-microbial-contamination/>

#### asu.elsevierpure.com (1)

- <https://asu.elsevierpure.com/en/publications/resource-potential-of-lunar-permanently-shadowed-regions/>

#### authors.library.caltech.edu (1)

- <https://authors.library.caltech.edu/records/mw7br-nw117>

#### behindtheblack.com (1)

- <https://behindtheblack.com/tag/shadowcam>

#### boris-portal.unibe.ch (1)

- <https://boris-portal.unibe.ch/items/8a475dd4-fed2-411d-a7a0-4f44660492be>

#### cell.com (1)

- <https://www.cell.com/iscience/fulltext/S2589-0042(23)01930-2>

#### chem.uci.edu (1)

- <https://www.chem.uci.edu/~unicorn/old/H2A/handouts/PDFs/LCROSSPaper.pdf>

#### cnes.fr (1)

- <https://cnes.fr/en/projects/fss>

#### collectspace.com (1)

- <https://www.collectspace.com/ubb/Forum33/HTML/000840.html>

#### cosmoquest.org (1)

- <https://cosmoquest.org/x/2021/05/tardigrades-designed-for-high-impact-collisions>

#### downtoearth.org.in (1)

- <https://www.downtoearth.org.in/science-technology/chandrayaan-3-finds-clues-to-hidden-water-ice-on-the-moon>

#### e3.eurekalert.org (1)

- <https://e3.eurekalert.org/news-releases/1121967>

#### eos.org (1)

- <https://eos.org/articles/shedding-light-on-the-darkest-regions-of-the-moon>

#### escholarship.org (1)

- <https://escholarship.org/uc/item/5wq6z2wf>

#### experts.arizona.edu (1)

- <https://experts.arizona.edu/en/publications/hydrogen-distribution-in-the-lunar-polar-regions/>

#### fireflyspace.com (1)

- <https://fireflyspace.com/news/firefly-aerospace-successfully-completes-14-days-of-surface-operations-on-the-moon>

#### foxnews.com (1)

- <https://www.foxnews.com/science/moon-crater-has-more-water-than-parts-of-earth.amp>

#### global.jaxa.jp (1)

- <https://global.jaxa.jp/press/2009/06/20090611_kaguya_e.html>

#### indiatvnews.com (1)

- <https://www.indiatvnews.com/science/more-evidence-suggesting-water-on-moon-as-chandrayaan-2-finds-possible-ice-under-lunar-south-pole-2026-05-27-1042708>

#### iop.cas.cn (1)

- <https://www.iop.cas.cn/xwzx/kydt/202407/P020240719527141588783.pdf>

#### jlpeda.jaxa.jp (1)

- <https://jlpeda.jaxa.jp/en/product/archive/detail_14/>

#### jpl.nasa.gov (1)

- <https://www.jpl.nasa.gov/missions/farside-seismic-suite/>

#### kiss.caltech.edu (1)

- <https://kiss.caltech.edu/workshops/lunar_ice/presentations2/neish.pdf>

#### leonarddavid.com (1)

- <https://www.leonarddavid.com/india-russia-moon-missions-south-pole-landing-targets/>

#### lpi.usra.edu (1)

- <https://www.lpi.usra.edu/meetings/lpsc2012/pdf/1585.pdf>

#### mdpi.com (1)

- <https://mdpi.com/2226-4310/10/11/970>

#### mdsoar.org (1)

- <https://mdsoar.org/items/22abcc8f-0963-417b-bbc2-cfb7c9e93916>

#### meetingorganizer.copernicus.org (1)

- <https://meetingorganizer.copernicus.org/EPSC2013/EPSC2013-864.pdf>

#### moonresource.com (1)

- <https://moonresource.com/research/artemis-iii-candidate-sites>

#### news.agu.org (1)

- <https://news.agu.org/press-release/carbon-dioxide-cold-traps-on-the-moon-are-confirmed-for-the-first-time>

#### nssdc.gsfc.nasa.gov (1)

- <https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1998-001A>

#### oro.open.ac.uk (1)

- <https://oro.open.ac.uk/69451>

#### ouci.dntb.gov.ua (1)

- <https://ouci.dntb.gov.ua/works/4VYEwab7>

#### pds.mcp.nasa.gov (1)

- <https://pds.mcp.nasa.gov/data/store/img/lunar_reconnaissance_orbiter/pds4/lroc/lro-l-lroc-5-rdr/LROLRC_2001/DATA/BDR/NAC_ROI/SHKLTNPKLO1/NAC_ROI_SHKLTNPKLO1_P888S1247_README.TXT>

#### physicstoday.aip.org (1)

- <https://physicstoday.aip.org/news/water-ice-estimates-for-the-moon>

#### physicsworld.com (1)

- <https://physicsworld.com/a/moonquakes-and-landslides-make-the-lunar-south-pole-unstable/>

#### planetary.org (1)

- <https://www.planetary.org/articles/2728>

#### pubmed.ncbi.nlm.nih.gov (1)

- <https://pubmed.ncbi.nlm.nih.gov/40415593/>

#### pubs.usgs.gov (1)

- <https://pubs.usgs.gov/publication/70036393>

#### research.polyu.edu.hk (1)

- <https://research.polyu.edu.hk/en/publications/stratigraphic-cross-sections-geologic-history-and-provenance-of-m/>

#### researchconnect.stonybrook.edu (1)

- <https://researchconnect.stonybrook.edu/en/publications/diviner-lunar-radiometer-observations-of-cold-traps-in-the-moons-/>

#### researchgate.net (1)

- <https://www.researchgate.net/publication/228790017_An_analysis_of_illumination_and_communication_conditions_near_lunar_south_pole_based_on_Kaguya_Data>

#### satnews.com (1)

- <https://satnews.com/2025/12/17/nasa-solidifies-lunar-strategy-with-blue-origin-viper-delivery-task-order/>

#### sci.news (1)

- <https://www.sci.news/space/radiation-dose-rates-lunar-surface-08893.html>

#### sciencealert.com (1)

- <https://www.sciencealert.com/moons-shadows-could-harbor-microbes-heres-why-thats-a-concern>

#### sciencedirect.com (1)

- <https://www.sciencedirect.com/science/article/pii/S0019103516304869>

#### seismosoc.secure-platform.com (1)

- <https://seismosoc.secure-platform.com/a/gallery/rounds/43/details/13014>

#### soest.hawaii.edu (1)

- <https://www.soest.hawaii.edu/soestwp/announce/news/scarce-ice-in-moons-darkest-regions/>

#### spacedaily.com (1)

- <https://spacedaily.com/?p=1090113>

#### spaceinfo.club (1)

- <https://spaceinfo.club/artemis-iv-what-we-know-about-nasas-first-planned-moon-landing-mission-november-2026-update/>

#### spaceq.ca (1)

- <https://spaceq.ca/?p=53144>

#### spudislunarresources.nss.org (1)

- <https://spudislunarresources.nss.org/Bibliography/p/98.pdf>

#### techtimes.com (1)

- <https://www.techtimes.com/articles/317212/20260526/nasa-moon-base-30b-79-launch-plan-locks-shackleton-crater-2036.htm>

#### theconversation.com (1)

- <https://theconversation.com/cool-discovery-new-studies-confirm-moon-has-icy-poles-148639>

#### theregister.com (1)

- <https://www.theregister.com/2026/03/11/nasa_oig_artemis_lander/>

#### thespaceresource.com (1)

- <https://www.thespaceresource.com/news/2019/4/surface-strength-of-psrs>

#### trek.nasa.gov (1)

- <https://trek.nasa.gov/moon/trekarcgis2/rest/services/A3_Named_regions_SP/MapServer/0>

#### x-mol.com (1)

- <https://www.x-mol.com/paper/1309588122420613120>

### Other URLs in the shipped site files

Distinct `source_url` values in `app/public/data/search-sites.json` that are not already listed above. The licence is not recorded in the repository.

None beyond the list above.

## Derived data

Shipped under `app/public/data/` and `app/public/data/terrain/`. These are computed from the sources above, not downloaded; each row names the script and the input files. Licence: the licence of the input listed in the row (see the sections above).

| Shipped files | Made by | Derived from |
|---|---|---|
| `terrain/<site>.bin`, `<site>.json`, `-far`, `-mid`, `-fine` variants, and `<site>-illum.png` | `scripts/terrain_tiles.py` | LOLA DEM `LDEM_80S_20MPP_ADJ.TIF` (PGDA, and `LDEM_60S_120MPP_ADJ.TIF` outside its coverage); PDS illumination maps (2016 release, the `avgvisib_*` files). The `-illum.png` files use the illumination map named in the tile JSON (`illum_map`). |
| `terrain/cap/` (`base.bin`, `outer.bin`, `80/`, `40/` tiles, `cap.json`) | `scripts/south_cap.py` | LOLA DEM `LDEM_80S_20MPP_ADJ.TIF` and `LDEM_60S_120MPP_ADJ.TIF` (PGDA) |
| `horizons/*.json` (`<site>.json` and `poi-*.json`) | `scripts/horizon.py`, `scripts/poi_horizons.py` | LOLA DEM tiles (PGDA, as above) |
| `search-sites.json` | `scripts/poi_horizons.py` | `docs/POIs/*.json` points, sampled in the 20 m LOLA DEM |
| `pois.json` | `scripts/pois.py` | `docs/POIs/*.json` (research notes, listed above) |
| `ephem/*.json` (51 monthly files) | `scripts/ephemeris.py` | SPICE kernels named in each file's `kernels` field: `naif0012.tls`, `pck00011.tpc`, `de440s.bsp`, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf` (NAIF, above) |
| `stations.json` | `scripts/stations.py`, from `scripts/stations.csv` | DSN 810-005 and JAXA (above) |
| `sites.json` | `scripts/sites.py`, from `scripts/sites.csv` | Per-site `source_url` values, listed below |
| `assessments.json` | `scripts/assessments.py` | The LOLA DEM, LOLA GDR and PDS illumination files named in its `files` list (above) |
| `periods.json` | `scripts/periods.py` | No external source. The `reason` field gives the team's own demo period. |

Distinct `source_url` values in `app/public/data/sites.json`:

- <https://iopscience.iop.org/article/10.3847/PSJ/ae061a>
- <https://lroc.im-ldi.com/images/1401>
- <https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf>
- <https://www.hou.usra.edu/meetings/lpsc2024/pdf/1775.pdf>
- <https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/>
