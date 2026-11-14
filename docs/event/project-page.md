# Project page — draft text

Draft for the team's project page on spaceappschallenge.org, written 14 Nov 2026 for the app as it is on `main`. Everything below the line is page text. Notes for the person who pastes it:

- The team lead cuts this text; the science lead approves "How we checked the numbers" before it goes on the page.
- Links to files in this repository are relative here. On the project page, replace them with the public repository URL once the repository is public.
- Update "How we checked the numbers" from [validation.md](validation.md) on the day of submission. Never write a check as passed without a sign-off recorded there.
- No names of team members, no faces, no voices (participant terms). The page uses the team name only.

---

## Lunar Landing Site Navigator

**Team SFZ | MEXG · NASA Space Apps 2026 · Heilbronn · challenge: Lunar Landing Site Navigator**

Live app: <https://nasa.digi-works.org> · Documentation: [docs/documentation.md](../documentation.md) · Install steps: [README](../../README.md)

### Summary

A mission to the Moon's south pole needs sunlight for power and a line to Earth for contact. Both come and go with the terrain: near the pole the Sun and Earth stay low over the horizon ([primer](../reference/primer.md)), so a ridge decides. When a launch date slips, the planner needs the answer again for new dates or a nearby site.

Lunar Landing Site Navigator answers that in one screen. Choose a mission period, a science goal and the Earth stations to count. The app ranks 18 sourced south-pole sites for that mission and, for the site you pick, shows when it is sunlit and when at least one selected station is geometrically visible: as two sentences, a timeline and a 3D view with the Sun and Earth over the real terrain horizon. "Find better dates" searches the following 60 days for landing times that meet your thresholds.

Every computed value in the app is currently marked "sample values — not validated"; see "How we checked the numbers".

### The gap in existing tools

On 27 Oct 2026 a first-time user asked three NASA tools for the Sun and Earth elevation at one south-pole site over two weeks: after about 14 minutes, one had given a wrong answer that looked right and two had given no number ([record of the timed run](../reference/existing-tools.md)).

### How it works

1. **Positions.** Sun and Earth positions relative to the Moon come from NASA/JPL SPICE kernels (DE440), every 30 minutes from November 2026 to December 2030, in the Moon's mean-Earth frame.
2. **Terrain horizon.** For each site, the highest terrain angle in 720 directions is computed from NASA's LOLA elevation model, out to 300 km, for an observer 1.75 m above the ground.
3. **In the browser.** The app combines the two: a moment is "sunlit" when any part of the Sun's disc is above the terrain. A station counts when it is above the terrain as seen from the site and the Moon is above the station's minimum elevation as seen from the station. This is geometric visibility of the selected stations. It is not a radio link: schedules, equipment, weather and link budget are not modelled.
4. **Ranking.** Sites that pass the 5° slope limit (the team's project criterion, measured over a 100 m baseline) are ordered by the rule of the chosen science goal, then by station coverage, then by sunlight. No weighted score: every row shows the values it was ranked by.

The app is static files: no backend, no account, no cookies. Calculations, frames and units in detail: [documentation](../documentation.md).

### Data

Used by the app or its data pipeline. Sizes, checksums and licence notes per file: [data-sources.md](../reference/data-sources.md).

| Dataset | Version | What we computed from it | Licence / citation |
|---|---|---|---|
| NAIF SPICE kernels: [de440s.bsp](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp), [naif0012.tls](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls), [pck00011.tpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc), [moon_pa_de440_200625.bpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc), [moon_de440_250416.tf](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf) | DE440; naif0012; pck00011; Moon FK Apr 2025 | Sun and Earth vectors and the Moon's and Earth's orientation every 30 min, Nov 2026 to Dec 2030 | No licence file; credit NASA/JPL/Caltech |
| LOLA south-pole elevation model [LDEM_80S_20MPP_ADJ.TIF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF) | Barker et al. 2023, 20 m/px, 80° S to 90° S | Terrain horizon, height and slope of each site; 3D terrain; slope and roughness statistics | Cite Barker et al. 2023, [doi:10.3847/PSJ/acf3e1](https://doi.org/10.3847/PSJ/acf3e1); data [doi:10.60903/gsfcpgda-lola-spole](https://doi.org/10.60903/gsfcpgda-lola-spole) |
| LOLA polar elevation model [ldem_875s_5m.img](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.img) | PDS LOLA GDR V2.0, 5 m/px, 87.5° S to 90° S | Slope and roughness statistics for the 7 sites it covers (in the data, not yet on screen) | PDS: free use; credit NASA/LOLA team and PDS Geosciences Node |
| LOLA average Sun-visibility maps: [60 m](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_85s_060m_201608.img), [120 m](http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608.IMG), [240 m](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_65s_240m_201608.img) | 2016 release | Areas of zero average Sun visibility near each site, with distance and a straight-line slope check (in the data, not yet on screen) | Cite Mazarico et al. 2011, Icarus 211, 1066–1081, [doi:10.1016/j.icarus.2010.10.030](https://doi.org/10.1016/j.icarus.2010.10.030) |
| LRO Diviner Polar Resource Product [dlre_prp_south.tab](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.tab) | LRO-L-DLRE-5-PRP-V2.0 | Annual mean and annual maximum temperature at each site (in the data, not yet on screen) | Public NASA PDS data, NASA SMD policy [SPD-41a](https://science.nasa.gov/researchers/science-data/science-information-policy/); cite "Paige et al., LRO DLRE LEVEL 5 PRP V2.0, NASA Planetary Data System, LRO-L-DLRE-5-PRP-V2.0, 2018" |
| NASA SVS CGI Moon Kit: [lroc_color_poles_4k.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif), [ldem_16_uint.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif), [ldem_4.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_4.tif) | SVS 4720 | Moon colour and relief shading in the 3D view; far terrain outside the polar model (viewing only) | Credit NASA's Scientific Visualization Studio; LRO/LROC/LOLA teams |
| NASA SVS Deep Star Maps [starmap_2020_4k.exr](https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_4k.exr) | SVS 4851, 2020 | Star background (viewing only) | Credit NASA/Goddard Space Flight Center Scientific Visualization Studio |
| Blue Marble Next Generation [world.200411.3x5400x2700.jpg](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/november/world.200411.3x5400x2700.jpg) | November 2004 | Earth texture (viewing only) | Credit NASA Earth Observatory (Stöckli et al.) |

NASA media are "generally not subject to copyright in the United States"; NASA is acknowledged as the source and no endorsement is implied ([NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)).

Other sources:

- Ground stations: NASA Deep Space Network antennas DSS-24, DSS-54 and DSS-34 from [DSN 810-005, module 301](https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301P.pdf); JAXA Usuda 64 m and Uchinoura 34 m from the [JAXA Station Coordinates page](https://ddor.nav.isas.jaxa.jp/station_coordinates/).
- Site coordinates: [Collins et al., LPSC 2024 #1775](https://www.hou.usra.edu/meetings/lpsc2024/pdf/1775.pdf); [NASA Lunar Surface Data Book](https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf); [NASA LRO](https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/); [LROC](https://lroc.im-ldi.com/images/1401); [Beyer et al. 2025](https://iopscience.iop.org/article/10.3847/PSJ/ae061a). The source of each site is linked next to it in the app.
- Reference for checking: [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/).
- Software: React, three.js, Ionicons, Vite (MIT), D3 (ISC), fonts IBM Plex and Newsreader (OFL-1.1); Python: SpiceyPy, NumPy, SciPy, rasterio, pyproj (versions in `scripts/requirements.lock.txt`).

Downloaded but not used: the LOLA Earth-visibility maps, `lroc_color_2k.jpg`, `lroc_color_poles_8k.tif`, `starmap_2020_4k_print.jpg`.

Our own code and text are open source under the Apache License 2.0.

### How we checked the numbers

Status on 14 Nov 2026, from [validation.md](validation.md):

| Check | Status |
|---|---|
| V1: Sun and Earth direction at two sites against JPL Horizons, tolerance 0.05° | passed, as reported by a team member on 14 Nov 2026; no written sign-off by the science lead yet. Recorded comparison: 20 rows, largest difference 0.0001° |
| V2: one row by hand from the sub-solar point | passed, reported the same way; no written sign-off. Recorded arithmetic: 1.4376° by hand, 1.4369° from the pipeline |
| Station check: Moon elevation at two DSN stations against JPL Horizons | open. Recorded comparison: largest difference 0.0763° in 10 values; tolerance not decided |
| V3: synthetic horizons | open |
| V4: real horizons against PGDA averages (context) | open |
| V5–V9: window edges, coarse terrain, values on screen, finder, panel types | open |

The comparisons were filled in by an SI tool from Horizons output and are inputs for the science lead, not sign-offs. Until checks are signed, the app marks all values "sample values — not validated".

Separately, automated tests pin the code: 195 Python tests, 70 unit tests and 40 end-to-end tests ran on 14 Nov 2026, including 200 cases in which the browser code must reproduce the Python reference to 0.000001°. Tests show the code does what it was written to do; they are not scientific validation.

### Not done yet

- A written sign-off for any validation check; the station check and V3 to V9.
- A radio-link model. The app reports geometric visibility of the selected stations only.
- ESA ESTRACK stations (no sourced minimum elevation found) and per-antenna horizon masks.
- The site assessments on screen: slope statistics, roughness, shadow access and temperature are computed for all 18 sites but not shown.
- Sites outside the list of 18.
- Solar-panel types and power; a score formula; a glossary; landers outside the south pole; a second language.
- Temperature during the mission period; boulders and obstacles; routes.
- Launch, transfer and energy estimates: kept outside this submission.

Added after this text was written: see [BUILD_LOG.md](../../BUILD_LOG.md).

### AI/SI use

We used SI (AI) tools throughout and logged each session with its task, its errors and who checked it ([AI-use log](ai-use-log.md)).

- **Tools:** Claude Code (Anthropic) and Codex (OpenAI) for code, data scripts, tests and documents; ZCode and VS Code chat for planning documents before the event; Whisper for a local transcript of the kickoff.
- **Written by SI tools:** the app code, the data pipeline and its tests, the generated data files (by running that pipeline on the NASA data above), and the first draft of this text.
- **Done by people:** the scope and the demo question, the slope criteria, the choice of stations, the timed test of the existing tools, approval of downloads and of the Terms of use, review of the interface, and the validation results reported above.
- **How SI output was checked:** automated tests, a cross-check of the browser code against a Python reference, the comparison with JPL Horizons, and separate review sessions before merges. Errors found this way are in the log's notes column.
- **Marking:** the app's Terms of use, the README and the documentation state the SI use. The app contains no SI-generated images, video or audio.

> SI marking: this page text was drafted by an SI tool (Claude Code) on 14 Nov 2026; the team edits it before submission.
