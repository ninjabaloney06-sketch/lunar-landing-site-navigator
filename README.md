# Lunar Landing Site Navigator

A web app that compares landing sites near the Moon's south pole by sunlight and by geometric visibility of Earth ground stations, over dates the user chooses. Built by team SFZ | MEXG at NASA Space Apps 2026 (local event Heilbronn, 14–15 Nov 2026) for the challenge [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/).

- Hosted preview: <https://nasa.digi-works.org> (the deployed revision is recorded in [BUILD_LOG.md](BUILD_LOG.md))
- Technical and product documentation: [docs/documentation.md](docs/documentation.md)
- Project page draft: [docs/event/project-page.md](docs/event/project-page.md)
- Status of the numbers: the app marks every computed value "sample values — not validated". Which checks are passed and which are open: [docs/event/validation.md](docs/event/validation.md).

> SI marking: this README was drafted by an SI (AI) tool, Claude Code, on 14 Nov 2026 from the repository's own files. See [AI/SI use](#aisi-use).

## What the app answers

The question a mission planner asks when a schedule slips: at this site, in this period, when is there sunlight, and when is at least one of my ground stations geometrically visible?

A fresh URL opens on the demo question: Connecting Ridge (−89.46°, −136.68°; [Collins et al., LPSC 2024 #1775, Table 1](https://www.hou.usra.edu/meetings/lpsc2024/pdf/1775.pdf)), 16–29 August 2027 UTC, all five stations selected.

What you can do on main today:

- Choose a mission: name, start and end date (1 Nov 2026 to 31 Dec 2030 UTC, at most 60 days), a science goal, one of 18 sourced sites, and the ground stations to count.
- Read two sentences above the timeline: one for sunlight, one for geometric visibility of the selected stations, both for the time under the cursor.
- Scrub or play the period on a timeline with a Light track and a Comms track.
- See the Sun and Earth over the real terrain horizon in a 3D view (globe, site, eye level) or, without WebGL, in a horizon strip.
- Rank the 18 sites for the mission's dates, stations and science goal. Sites that pass the 5° slope limit are ranked; the others are listed separately.
- Find better dates: landing times within 60 days after the mission start that meet adjustable thresholds.
- Compare the current view with another site or another named period.
- Download the windows as CSV and copy a link that reproduces the view.

Added after this text was written: see [BUILD_LOG.md](BUILD_LOG.md).

"Comms" in the app means geometric visibility of the selected stations at both ends of the path. It is not a working radio link. "Passes the 5° slope limit" is a project criterion on one terrain measurement; it says nothing else about a landing.

## Install and run

Needs Node.js and npm. Tested on macOS with Node 26.13.0 and npm 11.20.0; Vite 8.3.5 requires Node ^20.19 or ≥ 22.12 (`app/package-lock.json`). The app is static: no backend, no database, no account. All data it needs is in `app/public/`.

```sh
cd app && npm ci && npm run dev
```

Vite prints the local address (default `http://localhost:5173/`).

Production build (output in `app/dist/`):

```sh
npm run build
```

## Tests

Run from `app/`:

```sh
npm test
```

```sh
npx playwright test
```

`npm test` runs the unit tests (vitest; 70 passed on 14 Nov 2026). `npx playwright test` starts its own dev server on port 5180 and runs the end-to-end tests in Chromium (40 passed, 1 skipped by design). It needs Playwright's Chromium, installed once with `npx playwright install chromium` (not run here: the browser was already installed on the test machine, and installing it is a download).

## Data pipeline (Python)

The JSON and terrain files in `app/public/data/` and the textures in `app/public/textures/` are committed, so the app runs without this step. The pipeline regenerates them from raw NASA data.

Needs Python ≥ 3.12 ([docs/reference/setup.md](docs/reference/setup.md)); tested with Python 3.14.10. Run from the repository root:

```sh
python3 -m venv .venv
```

```sh
source .venv/bin/activate
```

```sh
python -m pip install -r scripts/requirements.lock.txt
```

```sh
python -m pytest scripts/tests -q
```

Without raw data the tests that need it are skipped (184 passed, 22 skipped). With `CLPS_DATA` set, all run (206 passed).

To regenerate data, download the raw files listed in [docs/reference/data-sources.md](docs/reference/data-sources.md) (about 6.6 GB; URL, size and SHA-256 per file) into one folder with the sub-folders `spice/`, `lola/`, `illumination/`, `diviner/` and `textures/`, as in the register's "Path under root" column. Then:

```sh
export CLPS_DATA=/path/to/clps
```

| Command | Writes | Run on 14 Nov 2026 |
|---|---|---|
| `python scripts/ephemeris.py` | `app/public/data/ephem/YYYY-MM.json`, Nov 2026 to Dec 2030 | not run here: the output is over 10 MB, which needs the team lead's approval under [AGENTS.md](AGENTS.md) |
| `python scripts/ephemeris.py --site -89.46 -136.68 --start 2026-11-14T00:00 --end 2026-11-14T02:00 --step 60` | nothing; prints a direct SPICE table for one site | exit 0 |
| `python scripts/horizon.py --all` | `horizons/<site>.json` for every site in `scripts/sites.csv` | exit 0, files identical to the committed ones |
| `python scripts/sites.py` | `sites.json` from `scripts/sites.csv`, the horizons and `scripts/site_potential.json` | exit 0, identical |
| `python scripts/stations.py` | `stations.json` from `scripts/stations.csv` | exit 0, identical |
| `python scripts/periods.py` | `periods.json` | exit 0, identical |
| `python scripts/terrain_tiles.py` | `terrain/` tiles and levels for the 3D view | not run here: the output is over 10 MB (same rule) |
| `python scripts/textures.py` | `app/public/textures/` | exit 0, identical |
| `python scripts/assessments.py` | `assessments.json` | exit 0; only `meta.generated_utc` differs |
| `python scripts/export_fixtures.py` | `app/src/test/fixtures.json` (test fixtures) | exit 0, identical (file regenerated on 14 Nov 2026 with the sites' terrain heights) |

Order: `horizon.py` before `sites.py`; `sites.py` and `ephemeris.py` before `assessments.py` and `export_fixtures.py`. Docker is not used anywhere.

## Data sources and licences

Every raw file with its URL, version, size, SHA-256 and licence note is in [docs/reference/data-sources.md](docs/reference/data-sources.md). Summary of what the app and its pipeline use:

| Dataset | Version | Used for | Licence / required citation |
|---|---|---|---|
| NAIF SPICE kernels: [de440s.bsp](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp), [naif0012.tls](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls), [pck00011.tpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc), [moon_pa_de440_200625.bpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc), [moon_de440_250416.tf](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf) | DE440; naif0012; pck00011; Moon FK Apr 2025 | Sun and Earth positions, Moon and Earth orientation | No licence file; attribute NASA/JPL/Caltech |
| LOLA south-pole elevation model [LDEM_80S_20MPP_ADJ.TIF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF) | Barker et al. 2023, 80° S to 90° S, 20 m/px | Terrain horizon, site height and slope, 3D terrain, site assessments | Cite Barker et al. 2023 ([doi:10.3847/PSJ/acf3e1](https://doi.org/10.3847/PSJ/acf3e1)) and data [doi:10.60903/gsfcpgda-lola-spole](https://doi.org/10.60903/gsfcpgda-lola-spole) |
| LOLA south-pole elevation model [LDEM_60S_120MPP_ADJ.TIF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_120MPP_ADJ.TIF) | Barker et al. 2023, 60° S to 90° S, 120 m/px | Terrain horizon beyond the edge of the 20 m model | Cite Barker et al. 2023 ([doi:10.3847/PSJ/acf3e1](https://doi.org/10.3847/PSJ/acf3e1)) and data [doi:10.60903/gsfcpgda-lola-spole](https://doi.org/10.60903/gsfcpgda-lola-spole) |
| LOLA polar elevation model [ldem_875s_5m.img](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.img) | PDS LOLA GDR V2.0, 87.5° S to 90° S, 5 m/px | Site assessments (slope, roughness) where it covers the site | PDS: free use; attribute NASA/LOLA team and PDS Geosciences Node; no licence file in the bundle |
| LOLA average Sun-visibility maps [avgvisib_85s_060m_201608](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_85s_060m_201608.img), [AVGVISIB_75S_120M_201608](http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608.IMG), [avgvisib_65s_240m_201608](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_65s_240m_201608.img) | 2016 release; 60 m, 120 m, 240 m | Site assessments (zero-visibility shadow clusters); overlay images generated with the terrain tiles | Cite Mazarico et al. 2011 (Icarus 211, 1066–1081, [doi:10.1016/j.icarus.2010.10.030](https://doi.org/10.1016/j.icarus.2010.10.030)) |
| LRO Diviner Polar Resource Product [dlre_prp_south.tab](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.tab) | LRO-L-DLRE-5-PRP-V2.0 | Site assessments (annual mean and maximum temperature) | No licence terms in the labels; public NASA PDS data under NASA SMD policy [SPD-41a](https://science.nasa.gov/researchers/science-data/science-information-policy/). Cite "Paige et al., LRO DLRE LEVEL 5 PRP V2.0, NASA Planetary Data System, LRO-L-DLRE-5-PRP-V2.0, 2018" |
| NASA SVS CGI Moon Kit: [lroc_color_poles_4k.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif), [ldem_16_uint.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif), [ldem_4.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_4.tif) | SVS 4720 | Moon colour and normal map in the 3D view; `ldem_16` also fills the far terrain outside the polar model; `ldem_4` only to check `ldem_16`'s encoding | Credit NASA's Scientific Visualization Studio and the LRO/LROC/LOLA teams |
| NASA SVS Deep Star Maps [starmap_2020_4k.exr](https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_4k.exr) | SVS 4851, 2020 | Star background in the 3D view | Credit NASA/Goddard Space Flight Center Scientific Visualization Studio |
| Blue Marble Next Generation [world.200411.3x5400x2700.jpg](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/november/world.200411.3x5400x2700.jpg) | November 2004 base map | Earth texture in the 3D view | Credit NASA Earth Observatory (Stöckli et al.) |

NASA media, including texture maps, are "generally not subject to copyright in the United States"; NASA must be acknowledged as the source and use must not imply endorsement ([NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/), read 14 Nov 2026). Credits for the four processed texture files: [app/public/textures/CREDITS.md](app/public/textures/CREDITS.md).

Downloaded and registered, not used by the app or the pipeline: the three Earth-visibility maps (`*_earth`), `lroc_color_2k.jpg`, `lroc_color_poles_8k.tif`, `starmap_2020_4k_print.jpg`, and the comment file `moon_pa_de440_200625.cmt`.

Other sourced inputs, kept in the repository as small text files. They are not rows of `data-sources.md`, and no licence statement for them is recorded in the repository yet:

- Ground stations, `scripts/stations.csv`: three NASA Deep Space Network antennas from [DSN 810-005, module 301, Rev P](https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301P.pdf); two JAXA antennas from the [JAXA Station Coordinates page](https://ddor.nav.isas.jaxa.jp/station_coordinates/).
- Sites, `scripts/sites.csv`: each row carries its own source link ([Collins et al., LPSC 2024 #1775](https://www.hou.usra.edu/meetings/lpsc2024/pdf/1775.pdf); [NASA Lunar Surface Data Book, table A2-2](https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf); [NASA LRO on IM-1](https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/); [LROC image 1401](https://lroc.im-ldi.com/images/1401); [Beyer et al. 2025](https://iopscience.iop.org/article/10.3847/PSJ/ae061a)).
- Site potential, `scripts/site_potential.json`: 56 entries, each with an evidence label and a source link shown in the app.
- Validation reference: [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/), through the request links in [docs/event/validation.md](docs/event/validation.md).

Software (licences as recorded in `app/package-lock.json`): React 19.3.1 (MIT), three.js 0.170.0 (MIT), D3 7.9.0 (ISC), Ionicons 8.1.0 (MIT), fonts IBM Plex Sans, IBM Plex Mono and Newsreader via @fontsource 5.3.0 (OFL-1.1); build and test tools Vite 8.3.5 (MIT), Vitest (MIT), Playwright 1.64.0 (Apache-2.0), TypeScript (Apache-2.0). Python packages and versions: `scripts/requirements.lock.txt`.

## AI/SI use

Space Apps calls AI tools "SI". This project was built with them, and says so here, in the app's Terms of use and in the log.

- **Tools:** Claude Code (Anthropic; models Claude Fable 5.2, Opus 5.5 and Haiku 5.5), Codex (OpenAI), and before the event also ZCode and VS Code chat for planning documents; Whisper large-v3-turbo for transcribing the kickoff recordings locally.
- **What SI tools wrote:** the app code (`app/`), the data pipeline and its tests (`scripts/`), the generated JSON and terrain files (by running that pipeline on the NASA data above), the planning documents, and this README, the documentation and the project-page draft.
- **What people did:** chose the scope, the demo site, the slope criteria and the station set; ran the timed test of the existing tools; approved the Terms of use text and each download; approved the look of the user interface; reported the results of validation checks V1 and V2 and of the review of the site-assessment code and numbers. The approval of the look and these results are recorded as reported by a team member; no written sign-off by the science lead is in the repository ([validation.md](docs/event/validation.md)).
- **How SI output was checked:** automated tests (vitest, pytest, Playwright), a cross-language fixture test that pins the browser code to the Python reference, a comparison against JPL Horizons, and independent review sessions before merges. Each session, its errors and what was rejected: [docs/event/ai-use-log.md](docs/event/ai-use-log.md).
- **Not SI-generated:** the NASA and JAXA source data. No SI-generated image, video or audio is part of the app.

## Known limits

Full list with the resolution of each result: [docs/documentation.md, Limits](docs/documentation.md#limits).

- Comms is geometric visibility of the selected stations, at both ends. No link budget, antenna schedule, weather or equipment is modelled.
- No validation check has a written sign-off. V1 and V2 are recorded as passed as reported; the station check and V3 to V9 are open. The app therefore marks all values "sample values — not validated".
- Only the 18 listed sites can be analysed. They are representative points of regions, not chosen landing points.
- The 20 m terrain model ends at 80° S; beyond it the horizon search continues on a 120 m model of the same product. Only IM-1, about 4 km from that edge, has skyline directions (52 of 720) that come from the coarser model.
- The slope shown is one measurement over a 100 m baseline on the 20 m terrain model, compared with a project criterion of 5°.
- The site assessments (slope statistics, roughness, shadow access, temperature) are computed and shipped in `assessments.json` but not shown in the user interface.

Added after this text was written: see [BUILD_LOG.md](BUILD_LOG.md).

## Repository layout

| Path | Contents |
|---|---|
| `app/` | React + TypeScript frontend, its tests, build and deploy configuration |
| `app/public/data/` | Generated JSON and terrain files the app loads |
| `scripts/` | Python data pipeline, lock file, `scripts/tests/` |
| `docs/documentation.md` | Technical and product documentation |
| `docs/event/` | Spec, validation, AI-use log, project-page draft, plans for the event weekend |
| `docs/reference/` | Data register, sources, background, decisions |
| `docs/archive/` | Finished audits and checklists |

Working files of the team: [TASKS.md](TASKS.md) (task list), [BUILD_LOG.md](BUILD_LOG.md) (what was done, with times and commits), [AGENTS.md](AGENTS.md) (rules for AI agents in this repository), [docs/event/spec.md](docs/event/spec.md), [docs/event/build-plan.md](docs/event/build-plan.md), [docs/reference/decisions.md](docs/reference/decisions.md).

## Licence

Code and original text: Apache License 2.0 ([LICENSE](LICENSE)). Third-party data keeps its own terms and citations, listed above. This project is not made, endorsed or reviewed by NASA.
