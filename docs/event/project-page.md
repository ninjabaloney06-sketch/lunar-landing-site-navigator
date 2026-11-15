# Project page — draft text

Draft for the team's project page on spaceappschallenge.org, written 14 Nov 2026 and brought up to the app on `main` on 15 Nov 2026, 22:50. Everything below the line is page text. Notes for the person who pastes it:

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

Lunar Landing Site Navigator answers that in one screen. Choose a mission period, a science goal and the Earth stations to count. The app ranks 18 sourced south-pole sites for that mission and, for the site you pick, shows when it is sunlit and when at least one selected station is geometrically visible: as two sentences, a timeline and a 3D view with the Sun and Earth over the real terrain horizon. "Find better dates" searches the following 60 days for landing times that meet your thresholds, and "If the mission slips" shows the same mission 1, 7 and 30 days later and at the nearest other landing site, with the change in sunlit and station contact share.

Around that answer: a table of all sites for the mission dates or a whole year, a year view that stacks the saved missions and your own points, a site assessment (slope, roughness, nearest permanent shadow, temperature), a first power estimate, points of interest from the cited research, any point south of 80° S as a custom site (approximate, marked so), a CSV of the windows, a link that reproduces the view, and a flight plan for a saved mission (launch, transfer, descent, payload, landing dispersion).

On 15 Nov 2026 the app's Sun and Earth directions were compared with JPL Horizons at 72 body-site-time pairs: the largest elevation difference is 0.000043°, against a tolerance of 0.05° (run by an SI tool). The science lead stated on 15 Nov 2026 that he validated every check; no check has a per-check written sign-off. See "How we checked the numbers".

### The gap in existing tools

On 27 Oct 2026 a first-time user asked three NASA tools for the Sun and Earth elevation at one south-pole site over two weeks: after about 14 minutes, one had given a wrong answer that looked right and two had given no number ([record of the timed run](../reference/existing-tools.md)).

### How it works

1. **Positions.** Sun and Earth positions relative to the Moon come from NASA/JPL SPICE kernels (DE440), every 30 minutes from November 2026 to December 2030, in the Moon's mean-Earth frame.
2. **Terrain horizon.** For each site, the highest terrain angle in 720 directions is computed from NASA's LOLA elevation model, out to 300 km, for an observer 1.75 m above the ground.
3. **In the browser.** The app combines the two: a moment is "sunlit" when any part of the Sun's disc is above the terrain. A station counts when it is above the terrain as seen from the site and the Moon is above the station's minimum elevation as seen from the station. This is geometric visibility of the selected stations. It is not a radio link: schedules, equipment, weather and link budget are not modelled.
4. **Ranking.** Sites that pass the 5° slope limit (the team's project criterion, measured over a 100 m baseline) are ordered by the rule of the chosen science goal, then by station contact, then by sunlight. No weighted score: every row shows the values it was ranked by.

The app is static files: no backend, no account, no cookies. Calculations, frames and units in detail: [documentation](../documentation.md).

### Data

Used by the app or its data pipeline. Sizes, checksums and licence notes per file: [data-sources.md](../reference/data-sources.md).

| Dataset | Version | What we computed from it | Licence / citation |
|---|---|---|---|
| NAIF SPICE kernels: [de440s.bsp](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp), [naif0012.tls](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls), [pck00011.tpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc), [moon_pa_de440_200625.bpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc), [moon_de440_250416.tf](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf) | DE440; naif0012; pck00011; Moon FK Apr 2025 | Sun and Earth vectors and the Moon's and Earth's orientation every 30 min, Nov 2026 to Dec 2030 | No licence file; credit NASA/JPL/Caltech |
| LOLA south-pole elevation model [LDEM_80S_20MPP_ADJ.TIF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF) | Barker et al. 2023, 20 m/px, 80° S to 90° S | Terrain horizon, height and slope of each site; 3D terrain; slope and roughness statistics | Cite Barker et al. 2023, [doi:10.3847/PSJ/acf3e1](https://doi.org/10.3847/PSJ/acf3e1); data [doi:10.60903/gsfcpgda-lola-spole](https://doi.org/10.60903/gsfcpgda-lola-spole) |
| LOLA south-pole elevation model [LDEM_60S_120MPP_ADJ.TIF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_120MPP_ADJ.TIF) | Barker et al. 2023, 120 m/px, 60° S to 90° S | Terrain horizon beyond the edge of the 20 m model | Cite Barker et al. 2023, [doi:10.3847/PSJ/acf3e1](https://doi.org/10.3847/PSJ/acf3e1); data [doi:10.60903/gsfcpgda-lola-spole](https://doi.org/10.60903/gsfcpgda-lola-spole) |
| LOLA polar elevation model [ldem_875s_5m.img](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.img) | PDS LOLA GDR V2.0, 5 m/px, 87.5° S to 90° S | Slope and roughness statistics for the 7 sites it covers | PDS: free use; credit NASA/LOLA team and PDS Geosciences Node |
| LOLA average Sun-visibility maps: [60 m](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_85s_060m_201608.img), [120 m](http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608.IMG), [240 m](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_65s_240m_201608.img) | 2016 release | Areas of zero average Sun visibility near each site, with distance and a straight-line slope check | Cite Mazarico et al. 2011, Icarus 211, 1066–1081, [doi:10.1016/j.icarus.2010.10.030](https://doi.org/10.1016/j.icarus.2010.10.030) |
| LRO Diviner Polar Resource Product [dlre_prp_south.tab](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.tab) | LRO-L-DLRE-5-PRP-V2.0 | Annual mean and annual maximum temperature at each site | Public NASA PDS data, NASA SMD policy [SPD-41a](https://science.nasa.gov/researchers/science-data/science-information-policy/); cite "Paige et al., LRO DLRE LEVEL 5 PRP V2.0, NASA Planetary Data System, LRO-L-DLRE-5-PRP-V2.0, 2018" |
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

Status on 15 Nov 2026, from [validation.md](validation.md). The science lead stated on 15 Nov 2026 that he validated every check, including what was built that day; the record holds that statement and no per-check sign-off written by him. The comparisons below were run by SI tools and are recorded with their numbers.

| Check | Points | Largest difference | Tolerance |
|---|---|---|---|
| Sun and Earth direction from the app's own files and interpolation against JPL Horizons, three sites, 2027–2030 (15 Nov, [every pair](../../app/public/data/validation/horizons.json), script `scripts/tools/horizons_check.py`) | 72, half between the 30-minute samples | elevation 0.000043°, azimuth × cos(elevation) 0.000020° | 0.05° |
| V1: Sun and Earth direction at two sites against JPL Horizons | 20 values | 0.0001° | 0.05° |
| V2: one row by hand from the sub-solar point | 1, and 4 more on 15 Nov | 0.0007° | sign and size agree |
| Station check: Moon elevation at the Earth stations against JPL Horizons | 25 values, five stations | 0.0782° | not set |
| V3: synthetic horizons against exact sphere geometry | 720 directions | 0.00004° | 0.01° |
| V4: sunlit and Earth-visible share over 2027–2030 against the published average-illumination maps, 18 sites (context only: different periods and definitions) | 18 sites | Sun 9.0 percentage points (mean +2.1), Earth 8.4 | same ballpark; investigate above 15 |
| V5: window edges against a 1-minute brute force from Horizons | 12 edges | every edge inside the 1-minute bracket | 1 min |

The full list, with who ran each check and its status wording, is in the app's documentation under "What was checked" and in validation.md. Not checked: the terrain horizon against photographs or a second terrain model; the coordinates of the points of interest.

Separately, automated tests pin the code. On 15 Nov 2026: 645 unit tests passed on the build machine (10 more pin flight results bit for bit and pass only on the laptop they were recorded on); the last full runs logged that day had 456 Python tests and 124 end-to-end tests (one skipped by design). They include 200 cases in which the browser code must reproduce the Python reference to 0.000001°. Tests show the code does what it was written to do; they are not scientific validation.

### Limits

- Station contact is geometric visibility of the selected stations, not a radio link: schedules, equipment, weather and link budget are not modelled. Station minimum elevations are generic values; per-antenna horizon masks are not included. No ESA ESTRACK stations (no sourced minimum elevation found).
- South polar region only: 18 prepared sites plus custom sites south of 80° S, whose horizon is computed in the browser on coarser terrain and marked approximate.
- Dates from 1 Nov 2026 to 31 Dec 2030; everything is precomputed, nothing is fetched live.
- Power is a first estimate (one Sun-facing panel, constant load), not a power budget. Temperature is the annual mean and maximum, not the mission period. No boulders, obstacles or routes.
- The flight plan is a planning estimate from the documented models; see the documentation for each assumption.
- No per-check written sign-off by the science lead; no second language.

Build history: [BUILD_LOG.md](../../BUILD_LOG.md).

### AI/SI use

We used SI (AI) tools throughout and logged each session with its task, its errors and who checked it ([AI-use log](ai-use-log.md)).

- **Tools:** Claude Code (Anthropic) and Codex (OpenAI) for code, data scripts, tests and documents; ZCode and VS Code chat for planning documents before the event; Whisper for a local transcript of the kickoff.
- **Written by SI tools:** the app code, the data pipeline and its tests, the generated data files (by running that pipeline on the NASA data above), and the first draft of this text.
- **Done by people:** the scope and the demo question, the slope criteria, the choice of stations, the timed test of the existing tools, approval of downloads and of the Terms of use, review of the interface, and the validation results reported above.
- **How SI output was checked:** automated tests, a cross-check of the browser code against a Python reference, the comparison with JPL Horizons, and separate review sessions before merges. Errors found this way are in the log's notes column.
- **Marking:** the app's Terms of use, the README and the documentation state the SI use. The app contains no SI-generated images, video or audio.

> SI marking: this page text was drafted by an SI tool (Claude Code) on 14 Nov 2026 and updated by it on 15 Nov 2026; the team edits it before submission.
