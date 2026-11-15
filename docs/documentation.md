# Lunar Landing Site Navigator — documentation

Technical and product documentation for the app as it is on 15 Nov 2026. Team SFZ | MEXG, NASA Space Apps 2026, local event Heilbronn. Install and run steps: [README](../README.md).

> How this document was made: an AI tool (SI in Space Apps terms), Claude Code, wrote it on 14 Nov 2026 and updated it on 15 Nov 2026 from the repository's code and records. No team member has reviewed this text as a whole yet. Where a statement rests on a human check, the check and its recorded status are named. Most scientific checks are still open: see [Validation results](#validation-results).

Contents: [Part 1, technical](#part-1--technical) (data flow, frames and units, calculations, points of interest, validation results, limits) · [Part 2, product](#part-2--product) (who it is for, the question, how to read each view, what is not covered).

---

## Part 1 — technical

### Data flow

```
raw NASA data (outside git)  →  Python scripts (scripts/)  →  JSON, binary tiles, textures (app/public/)  →  browser (app/src/)
```

1. **Raw data** stays outside the repository. Every file is registered with URL, version, size, SHA-256 and licence note in [docs/reference/data-sources.md](reference/data-sources.md). The scripts find it through the environment variable `CLPS_DATA`.
2. **Scripts** turn it into small files. Each script names its inputs and method in its header.

| Script | Reads | Writes (under `app/public/data/` unless noted) |
|---|---|---|
| `scripts/ephemeris.py` | 5 SPICE kernels | `ephem/YYYY-MM.json`, 50 monthly files, Nov 2026 to Dec 2030 |
| `scripts/horizon.py` | `LDEM_80S_20MPP_ADJ.TIF`, `scripts/sites.csv` | `horizons/<site>.json`: terrain horizon in 720 directions, site height, site slope |
| `scripts/sites.py` | `scripts/sites.csv`, the horizon files, `scripts/site_potential.json` | `sites.json`: 18 sites |
| `scripts/stations.py` | `scripts/stations.csv` | `stations.json`: 5 antennas |
| `scripts/periods.py` | its own list | `periods.json`: 5 named periods |
| `scripts/terrain_tiles.py` | `LDEM_80S_20MPP_ADJ.TIF`, `ldem_16_uint.tif`, the 60 m and 120 m Sun-visibility maps | `terrain/`: per site an 80 m tile plus fine, mid and far levels, and an overlay image |
| `scripts/south_cap.py` | `LDEM_80S_20MPP_ADJ.TIF`, `LDEM_60S_120MPP_ADJ.TIF` | `terrain/cap/`: the south-cap rasters for custom landing sites |
| `scripts/textures.py` | NASA SVS and Blue Marble images | `app/public/textures/`: Moon colour, Moon normal map, Earth, stars |
| `scripts/assessments.py` | both LOLA models, the Sun-visibility maps, the Diviner table, `sites.json` | `assessments.json` |
| `scripts/windows.py` | — | nothing: the Python reference of the browser geometry, used by tests |
| `scripts/export_fixtures.py` | the shipped `ephem/`, `sites.json`, `horizons/` | `app/src/test/fixtures.json`: 200 test cases |
| `scripts/pois.py` | `docs/POIs/*.json` (seven research files and `additional-sites.json`) | `pois.json`: one record per point of interest, 206 on 15 Nov 2026 |
| `scripts/poi_horizons.py` | `docs/POIs/*.json`, `LDEM_80S_20MPP_ADJ.TIF`, `LDEM_60S_120MPP_ADJ.TIF`, `scripts/sites.csv`, `ephem/YYYY-MM.json` | `horizons/poi-<group>-<id>.json`: terrain horizon per point; `search-sites.json`: 180 entries on 15 Nov 2026 |

3. **The browser** loads `sites.json`, `periods.json` and `stations.json` at start, then the horizon of the chosen site and the ephemeris months the chosen dates need. All results on screen are computed in the browser from these files (`app/src/geometry/`, `app/src/flight/`, `app/src/power/`). There is no server-side computation, no database, no account, no cookie. Saved missions and the "Full data" setting are kept in the browser's local storage.

The ephemeris is independent of the site. The horizon is independent of the date. This split lets the browser combine any listed site with any supported dates without a server.

### Frames and units

| Quantity | Convention |
|---|---|
| Lunar coordinates | Planetocentric latitude and east-positive longitude in the Moon Mean Earth / polar axis frame, SPICE name `MOON_ME`, on a sphere of radius 1737.4 km |
| Site height | Metres above the 1737.4 km sphere, from the LOLA model ([Barker et al. 2023](https://doi.org/10.3847/PSJ/acf3e1)) |
| Observer | 1.75 m above the ground at the site |
| Body positions | Moon centre to Sun and Moon centre to Earth, km, in `MOON_ME`, with light-time and stellar aberration correction (SPICE `LT+S`), observer `MOON` |
| Local frame at the site | up = direction from the Moon's centre through the site; east = z × up; north = up × east |
| Azimuth, elevation | Degrees; azimuth 0° = north, clockwise; elevation above the local horizontal plane; no refraction |
| Earth stations | Geodetic latitude, east-positive longitude, ellipsoidal height in metres on WGS 84 (DSN) or GRS80/ITRF2014 (JAXA); the two ellipsoids differ by less than 0.1 mm at the surface (`scripts/stations.py`) |
| Earth orientation | SPICE frame `IAU_EARTH` from `pck00011.tpc`, used as an approximation of the terrestrial frame; no high-precision Earth orientation kernel is loaded |
| Time | UTC, ISO 8601; periods are half-open intervals [start, end) |
| Other units | Kilometres for distances unless a name ends in `_m`; hours and days for durations; percent for shares of a period |

Where a site's source does not name its frame, `MOON_ME` is assumed and the site's "Frame" line in the app says so. The two sites taken from the NASA Lunar Surface Data Book are centre points of terrain-model polygons, not points picked on the terrain ([Data Book](https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf), section A2.1; check recorded in [validation.md](event/validation.md)).

### Calculations

Each calculation has its own file with equations, inputs, assumptions, uncertainty, tests and validation status under `docs/scientific-proof/` (the "Scientific proof" part of the documentation page). The list below is the short version.

**1. Ephemeris (`scripts/ephemeris.py`).** SPICE gives the Sun and Earth position vectors every 30 minutes, plus two rotations per sample: `MOON_ME` → J2000 and `IAU_EARTH` → `MOON_ME`, stored as quaternions. Stored precision: Sun vector 1 km, Earth vector 0.01 km, quaternions 1e-7.

**2. Interpolation (`app/src/geometry/index.ts`, `interpolate`).** Between samples the vectors are interpolated linearly and the rotations by spherical linear interpolation. The Earth rotation is interpolated through J2000, because a direct interpolation of `IAU_EARTH` → `MOON_ME` errs by about 0.002° mid-step.

**3. Direction of a body from the site (`siteVector`, `enuBasis`, `azEl`).** The site vector is (1737.4 km + height + 1.75 m) along the site's direction. The body's direction is body vector minus site vector, expressed in the local east/north/up frame. Subtracting the site vector accounts for parallax, which reaches 0.26° for Earth.

**4. Terrain horizon (`scripts/horizon.py`).** For each of 720 azimuths (0.5° apart) a ray is sampled along a great circle: every 20 m to 4 km, then each step 0.5 % longer, to 300 km. Within 20 km the 20 m model is used at full resolution; beyond it the model's 160 m overview. The elevation angle of each sample is computed between points on the sphere plus their heights, so lunar curvature is included. The horizon value is the largest angle along the ray. A sample outside the 20 m model (a 608 km square around the pole, reaching 80° S) or on missing data is read from the same product's 120 m model, which reaches 60° S (`LDEM_60S_120MPP_ADJ.TIF`, since 14 Nov 2026 17:47). A ray stops only where neither model has data; its azimuth is then listed as truncated. No shipped horizon has a truncated direction. In the browser the horizon between two azimuths is interpolated linearly (`maskAt`).

**5. Sunlit and Earth visible (`discFraction`).** The visible share of a disc is the part of a circle above a straight horizontal line at the horizon value for the disc centre's azimuth. Angular radius = asin(radius / distance), with 695,700 km for the Sun and 6,371.0 km for Earth. "Sunlit" means any part of the Sun's disc is above the terrain. "Earth visible" means any part of Earth's disc is.

**6. Geometric visibility of a station (`stationLos`).** Two conditions, both needed:

- seen from the site, the station (its own position on Earth, not Earth's centre) is above the terrain horizon at its azimuth;
- seen from the station, the site is at or above the station's minimum elevation.

The minimum elevation is one value per antenna for all azimuths: 6.0° for the three DSN antennas (the generic receive limit of [DSN 810-005, module 301](https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301P.pdf), section 2.2.3), and the highest value of JAXA's own horizon mask for the two JAXA antennas (12.5° and 6.22°; [JAXA Station Coordinates](https://ddor.nav.isas.jaxa.jp/station_coordinates/)). When both conditions fail, terrain is reported as the reason.

**7. Coverage (`coverage`).** For each moment: "covered" if at least one selected station is geometrically visible, counted once however many stations are; "none" if no selected station is; "unknown" only when an input is missing. Unknown is never counted as covered.

**8. Windows (`windows`).** The state (lit or dark; covered, none or unknown) is evaluated every minute on the interpolated ephemeris (every 5 minutes for periods longer than 31 days). Each change is then narrowed by bisection to ±10 seconds. Consecutive equal states form one window.

**9. Summary (`summarize`).** Percent of the period sunlit, with Earth visible, covered, unknown; the longest dark window and the longest window without coverage, in hours. All are time-weighted over the windows of step 8.

**10. Answer sentences (`answerState`, `answerSentence`).** For the time under the cursor: the current state and the time to the next change. Durations of 48 hours or more are given in whole days, shorter ones in whole hours. Remaining good time (sunlight, contact) is rounded down and waiting time is rounded up, so a sentence never promises more than the data. "Earth never rises here" is only said when no part of Earth's disc clears the terrain for any libration state in a box derived from the shipped ephemeris.

**11. Find better dates (`finder`).** Candidate landing times every 30 minutes, from the mission start to 60 days later (never past the end of the ephemeris; `app/src/views/finderSpan.ts`). The step was 6 hours until 15 Nov 2026; an AI recheck found a qualifying Haworth window that the 6-hour grid missed ([validation.md](event/validation.md), V8). Each candidate mission is scored on 30-minute samples against four thresholds: minimum percent sunlit, minimum percent coverage, longest coverage gap, longest darkness. Defaults: 14 days, 70 %, 50 %, 48 h, 72 h; these are proposed defaults, all editable ([spec.md](event/spec.md), "Finder"). Neighbouring candidates that qualify are merged into one landing window. Windows are ranked by coverage, then percent sunlit, then date. If nothing qualifies, the nearest miss and the thresholds it fails are shown. The date menu's "Best periods" run the same finder with the default thresholds over the mission's calendar year and list up to five.

**12. Site slope and the 5° limit (`scripts/horizon.py`, `app/src/geometry/rankSites.ts`).** The slope of a site is taken over a 100 m baseline (heights 50 m east, west, north and south of the site on the 20 m model). A site passes the 5° slope limit at 5.0° or less; above it fails; without a value it is unknown. The 5° is the team's project criterion, not a sourced NASA or vehicle limit ([spec.md](event/spec.md), "Terrain slope").

**13. Site ranking (`rankSites`).** First the slope filter of step 12. Sites that pass are ordered by the rule of the chosen science goal, then by coverage, then by percent sunlit. The goal rules: "Consistent light" = percent sunlit, then the shortest longest darkness; "Water ice", "Cold traps" and "Science targets" = the best evidence label among the site's sourced entries for that goal (direct measurement, remote observation, modeled condition, hypothesis, unknown); "Any" = coverage. There is no weighted score: keys are compared one after another, so each row's place can be checked by hand. Ties share a rank and are named.

**14. Site assessments (`scripts/assessments.py`).** Computed for all 18 sites and shipped as `assessments.json`; shown in the Details drawer, section *Site assessment*. Method, data and limits are in [validation.md, "Mandatory site assessments"](event/validation.md#mandatory-site-assessments--method-and-evidence-ai-not-validated). In short: per-pixel slope statistics over a 100 m landing disk and a 2 km exploration disk; RMS height deviation from a plane over the 100 m disk as roughness; clusters of zero average Sun visibility in the Mazarico et al. maps with distance, bearing and a straight-line slope check; annual mean and annual maximum temperature from the Diviner Polar Resource Product. The thresholds 5.0° (landing, ≤ passes) and 20.0° (exploration, < meets) are project criteria set by the team, not NASA or vehicle limits ([decisions.md, "Mandatory site assessments — 14 Nov 2026"](reference/decisions.md#mandatory-site-assessments--14-nov-2026)).

**15. Power estimate (`app/src/power/power.ts`).** First estimate, not a power budget; not validated by the science lead. One panel that always faces the Sun: P(t) = S × A × η × f(t) × (AU / r(t))², with S = 1361 W/m² at 1 AU ([Kopp & Lean 2011](https://doi.org/10.1029/2010GL045777)), A the panel area, η the cell efficiency, f(t) the visible share of the Sun's disc from calculation 5 on the same 30-minute samples as the summary, and r(t) the site–Sun distance from the ephemeris (AU from [JPL Solar System Dynamics](https://ssd.jpl.nasa.gov/astro_par.html)). A constant load and a battery give the answer: does the battery last through the longest dark window, and by how much. Not modelled: temperature, panel degradation, dust, tilt, partial shading of the panel. Method and hand-computed cases: [validation.md, "P1 power estimate"](event/validation.md).

**16. Rocket flight (`app/src/flight/`).** Launch, translunar transfer under Earth, Moon and Sun gravity, lunar orbit, a finite-burn powered descent and the return, for a saved mission's site and dates. Its results never enter a site value or the ranking. The analyses added on 15 Nov 2026 — maximum payload with its uncertainty, the cheapest route and the landing dispersion with the Moon's J2 term — are **not yet validated by the science lead**. Equations and inputs: `docs/scientific-proof/04-trajectory.md` to `07-dispersion.md`.

**17. 3D scene (`app/src/scene3d/`).** A view of the same geometry, not a source of numbers. Sun, Earth and stars are drawn at their true directions and true angular sizes. Lit and dark are never taken from rendered shadows. At eye level the terrain silhouette is the horizon of step 4.

### Points of interest

The points of interest come from the records in `docs/POIs/`: seven research files and `additional-sites.json`, which adds researched points. Each file states its source (`derived_from`) and its coordinate convention in its header fields.

- **Which records become pins.** A record is shipped only if its geometry is a point and it has at least one source URL. Regional findings without coordinates are not pins (`scripts/pois.py`).
- **Groups.** Hazards (`hazards.json`), Water and volatiles (`ice-volatile-evidence.json`), Permanent shadow (`psr-cold-traps.json`), Sunlit points (`illumination-sites.json`), Landing candidates (`landing-sites.json` and `additional-sites.json`), Science features (`science-features.json`). `pgda-study-sites.json` has names only and contributes no point.
- **Values.** `scripts/pois.py` copies each value from its record by a fixed mapping: name, category, summary, facts, evidence, limitations and sources. Short summary bullets come from `docs/POIs/plain.json`, each from a fact in the record. Labels of the info card come from `KEY_LABELS` in `scripts/pois.py`.
- **Coordinates.** Latitude is planetocentric, south negative. Longitude is taken from `lon_east_180` (east-positive, -180 to 180) and must agree with `lon_east_360` to 1e-9°, or the script stops. Where a source names no frame, `MOON_ME` is assumed (`app/src/data/pois.ts`).
- **Status.** Point coordinates and facts come from the cited research sources and are not individually checked by the science lead. The app's computed results (sunlight, Earth visibility and station contact, ranking, flight) carry the validation status recorded under [Validation results](#validation-results); most of those checks are still open.
- **What is shown.** The app shows only points south of 80° S (`app/src/scene3d/region.ts`; filter in `app/src/views/poiLayer.ts`). On 15 Nov 2026 `pois.json` holds 206 records, of which 195 lie at or south of 80° S.
- **Counts on 15 Nov 2026** (from `pois.json`): Landing candidates 88, Permanent shadow 69, Sunlit points 18, Science features 16, Water and volatiles 8, Hazards 7.
- **Terrain horizons.** `scripts/poi_horizons.py` gives each point that lies inside the 20 m model a terrain horizon, by the method of step 4. Each one is copied into `search-sites.json` as a site-shaped entry with its `poi_id`. A point without a horizon file shows "no data" in the search. Its `far_side` flag is derived from the shipped ephemeris and ignores terrain.

### Validation results

Copied from [docs/event/validation.md](event/validation.md) on 15 Nov 2026 with their status. That file is the record; if the two differ, it is right.

| ID | Check | Status in validation.md |
|---|---|---|
| V1 | 10 site/time points against JPL Horizons, tolerance 0.05° | passed, as reported by a team member in chat on 14 Nov 2026, 15:56; no written sign-off by the science lead in the repository |
| V2 | One row by hand: Sun elevation near the pole ≈ −(sub-solar latitude) | passed, reported the same way; no written sign-off |
| Station check | Moon elevation at the stations against Horizons; `IAU_EARTH` approximation | open; an AI recheck on 15 Nov found a worst difference of 0.0782° over all five stations; tolerance not decided |
| V3 | Synthetic horizons (flat sphere −0.0813° for 1.75 m; cone) | open; AI rechecks agree |
| V4 | Real horizons against PGDA averages (context) | open |
| V5–V9 | Window edges, coarse terrain, values in the user interface, finder, panel types | open; AI rechecks agree for window edges, interface values and coarse terrain; the finder missed a window with the 6-hour grid and now uses 30 minutes; panel types were not built |
| Horizon range | 150 km against 300 km rays at three sites | open |
| Truncated horizons | Directions cut at the edge of the terrain model | open; an AI recomputation agrees within 0.09° |

No check carries a written sign-off by the science lead. AI rechecks are inputs to a check, not a sign-off.

- The app's switch `VALIDATED` was set to true on 14 Nov by team decision after an independent recomputation by an AI tool agreed with the app (validation.md, "Independent recomputation by AI"). Before that every value carried the marker "sample values — not validated".
- `BUILD_LOG.md`, 14 Nov 2026 20:59, records the science lead's statement that the flight physics are validated. The same entry says it was not entered in validation.md, and who validated the flight physics against what is not recorded.
- Everything built on 15 Nov 2026 — maximum payload, the cheapest route, the landing dispersion and J2, the power estimate — is not yet validated by the science lead.
- How the three records relate, and how each proof file quotes them: `docs/scientific-proof/README.md`, "How to read the validation status".

Inputs recorded for V1, V2 and the station check (filled in by an AI tool, not a sign-off):

- V1: 20 rows (Sun and Earth, two sites, five times each) from direct SPICE values against Horizons. Largest difference 0.0000° in azimuth and 0.0001° in elevation.
- V2: Horizons sub-solar point for 14 Nov 2026 12:00 UTC gives an elevation of 1.4376° at Connecting Ridge by the spherical formula; the pipeline gives 1.4369°; difference 0.0007°.
- Station check: 10 values at Madrid DSS-54 and Canberra DSS-34. Largest difference in Moon elevation 0.0763°. The tolerance and whether `IAU_EARTH` is acceptable are not decided.

Site assessments: code review by the team's code checker and acceptance of the numbers by the science lead are recorded as reported by a team member for commit `6650ed1`; no written sign-off is in the repository. Seven method choices are listed there as not separately decided (landing pass rule, cluster size, roughness measure, map projection reading, use of the 5 m model, one source match, thermal scope). Recorded evidence includes: site heights and slopes reproduced from the 20 m model for three sites; Diviner maximum temperatures at four published reference points, three within 0.3 K and one 2.9 K off at a 2 km scale.

Automated tests: on 14 Nov 2026, 18:01, 206 Python tests, 76 unit tests and 63 end-to-end tests (one skipped by design). Counts of the final gate: see BUILD_LOG.md, 15 Nov. The tests include a comparison of the interpolated ephemeris against direct SPICE values below 0.001° (`scripts/tests/test_ephemeris.py`) and 200 fixture cases in which the browser code must reproduce the Python reference to 1e-6° (`app/src/geometry/fixtures.test.ts`). Tests show that the code does what it was written to do. They are not scientific validation.

### Limits

**Not modelled**

- A radio link. No link budget, frequency, antenna schedule or availability, weather, or equipment. "Comms" is geometric visibility of the selected stations only.
- Relay satellites and stations other than the five listed. ESA ESTRACK antennas are not included: no sourced minimum elevation was found ([spec.md](event/spec.md)).
- Per-azimuth horizon masks of the stations. One minimum elevation per antenna is used.
- Precise Earth orientation. `IAU_EARTH` is an approximation.
- Power beyond a first estimate. The power estimate (calculation 15) has one Sun-facing panel and a constant load; no temperature, degradation, dust, tilt or partial shading. Not validated by the science lead.
- Temperature over a mission period. Only annual mean and annual maximum exist, in the site assessment.
- Boulders and obstacles. They are below the resolution of the terrain models and are reported as unknown.
- Routes and access. Only a straight-line slope check to the nearest shadow cluster exists, in the site assessment.
- Landing safety. Passing the 5° slope limit is one criterion on one measurement.
- Terrain beyond 80° S. Outside the 20 m model the horizon uses a 120 m model, coarser than the 20 m used near the site. This matters for IM-1 only, which lies about 4 km from the edge of the 20 m model: its skyline to the north-north-east (52 of 720 directions) comes from 120 m data.
- The change of the horizon across the width of a disc. The horizon is taken at the disc centre's azimuth.
- Scattered light, earthshine and heat from surrounding terrain as inputs to any result.
- Arbitrary coordinates outside the south cap. A place south of 80° S can be set as a custom landing site; its numbers are approximate (see "Custom landing sites"). North of 80° S only the listed sites can be analysed.
- Launch, transfer and descent in the site analysis. The Rocket flight menu (Part 2) computes them separately; its result does not enter any site value or ranking. The flight plans leave out the Moon's uneven gravity (its J2 term is in the landing dispersion only), winds, engine transients and atmospheric entry after Entry Interface.
- Uncertainty of the site results. The terrain model's errors are not propagated. The uncertainty budget of every number shown is in `docs/scientific-proof/uncertainty.md`; the Rocket flight menu's maximum payload carries ± ε, not yet validated by the science lead.

**Resolution at which each result holds**

| Result | Holds at |
|---|---|
| Dates | 1 Nov 2026 00:00 UTC to 1 Jan 2031 00:00 UTC; a mission of at most 60 days |
| Sun and Earth direction | Ephemeris sampled every 30 min and interpolated; interpolation tested against direct SPICE below 0.001° |
| Terrain horizon | 0.5° in azimuth; 20 m terrain within 20 km, 160 m averages from 20 km to 300 km; observer 1.75 m above the site point |
| Sunlit / Earth visible | Yes or no for "any part of the disc above the horizon" |
| Window start and end | Found numerically to ±10 s on the interpolated model; events shorter than 1 min (5 min for periods over 31 days) can be missed. This is the numerical resolution, not a validated accuracy: the window-edge check V5 is open |
| Finder | 30-minute samples; landing times 30 minutes apart |
| Station geometry | Moon elevation at a station differs from JPL Horizons by up to 0.0763° in the 10 recorded values (station check open) |
| Site position | As printed in each site's source, a representative point of a region; frame assumed where the source does not name it |
| Site slope (5° limit) | One value per site over a 100 m baseline on the 20 m model, stored to 0.1° |
| Assessment slopes | Per pixel over a 10 m baseline (5 m model, 7 sites) or a 40 m baseline (20 m model, 11 sites); landing disk 100 m radius, exploration disk 2 km radius |
| Roughness | RMS over the 100 m disk; features smaller than about 2 pixels (10 m or 40 m) are not resolved |
| Shadow clusters | 60 m map (15 sites) or 120 m map (3 sites); clusters of at least 0.1 km² within 50 km |
| Temperature | Mesh triangles of 0.13–0.15 km², coarser than the 100 m landing disk; annual values from a model fit |
| 3D terrain | 20 m within ±2.5 km, 80 m within ±20 km, 160 m within ±40 km (from the south-cap 80 m tiles), 400 m within ±60 km, 2 km within ±300 km; for viewing only |

---

## Part 2 — product

### Who it is for

- NASA mission planners first: which site near the lunar south pole, which dates, and the answer again when a date slips.
- Educators and the public: hover explanations in the app and this page.
- No account and no setup.

### The question it answers

- At this site, in this period: when is there sunlight?
- When is at least one of the selected Earth stations geometrically visible?
- Which evaluated site is best for this mission, and which dates would be better?

The existing tools did not answer this in a timed test on 27 Oct 2026: one produced a wrong answer that looked right, two produced no number ([existing-tools.md](reference/existing-tools.md), section "timed run, 27 Oct 2026").

### How to read each view

**Summary and full data.** One "Full data" switch, top right in each panel (Details drawer, search, point card, Rocket flight menu), sets the mode everywhere.

- Summary (default): the decision values only.
- Full data: adds breakdowns, raw values, method and sources.
- The setting is kept in this browser.

**Header (top left).**

- The mission name with a rocket icon opens the Mission menu.
- Under it: the site name and its coordinates, and a caveat label where the site has one.
- The date and time is the cursor time in UTC; it opens the date menu.

**Header (top right).** "Points of interest", "Search" and "Details" (with an info icon; opens the Details drawer). In the flight view only "Back to landing site" is shown.

**3D scene.**

- Three levels: *Globe* (the Moon with one pin per site; click a pin to select it), *Site* (the terrain around the landing site from above) and *Eye* (standing at the site, 1.75 m above the ground).
- Labels: "Sun" and "Earth" with their elevation in degrees, and "Landing site". A negative elevation means below the horizontal plane; whether terrain hides the body, the answer and the horizon strip tell.
- Keys: `E` switches between site and eye level. `Esc` goes to the globe; during a simulation it stops it and returns to the landing-site view.
- Without WebGL the scene is replaced by the horizon strip.

**Camera, viewpoints and points.**

- Left-drag orbits. Middle-drag looks around from where the camera is.
- Wheel or pinch moves the camera and stops 1.75 m above the terrain; at eye level it narrows the lens (54° down to 4°).
- A left-click on the terrain at site or eye level stands the camera on that spot.
- "View", beside the timeline, lists Landing site, Eye level and Moon. A right-click on the scene lists Moon.
- "Add point here" (right-click) or typed coordinates in the Mission menu add a user point with a name, kept in the link.
- A user point has no horizon file: the app shows its marker and coordinates, never a value.
- None of this changes the site, the dates or a number.

**Simulate.** "Simulate", beside the timeline, plays the mission by the clock. While a simulation runs or is paused, a speed slider and "Reset to start" sit beside it.

**Answer line (above the timeline).**

- First sentence: sunlight ("Sunlight for 3 more days.", "Dark for 5 more hours.").
- Second sentence: geometric station contact ("Station contact for 9 more hours.", "Next station contact in 2 days.").
- Good time is rounded down, waiting time up.

**Timeline.**

- Two tracks over the mission, plus three dimmed days before and after.
- *Light*: yellow = sunlit, dark = not. *Comms*: blue = at least one selected station geometrically visible, dark = none, hatched = unknown.
- The bracket marks the mission with its name and length.
- Drag to move the cursor; click a date to jump to 12:00 UTC that day. Space plays and pauses; arrow keys step 30 minutes, with Shift one day.

**Slope warning.** Shown above the timeline only when the site fails the 5° slope limit, with the slope and the 100 m baseline.

**Footer.**

- The terrain and ephemeris sources, "how this is computed", "Docs" and "Full documentation" (this page).
- On wide screens, one validation line worded from the record: the V1 check against JPL Horizons is reported, with no written sign-off; other checks are open; a link to [Validation results](#validation-results). On phones the same line is in the Details drawer, under "Open in NASA tools".

**Mission menu.** Top to bottom:

- "Mission" with "Play mission" (eye level, first to last mission day).
- Name; start and end date (changing the start keeps the length).
- Science goal.
- Landing site: the ranking of calculation 13 for the mission's dates, stations and goal, in three groups: "Passes the 5° slope limit" (ranked), "Too steep to land (slope above 5°)" and "Not enough data". Each row shows what it was ranked by. "Best" means best among the 18 evaluated sites for these inputs. Your points follow.
- Ground stations.
- Saved missions: "Compare" opens them in the All sites table; each row has "Calculate flight".
- "Calculate flight" for the current mission and "Add mission" (kept in this browser only).

**Date menu.**

- "Best periods" for the mission at its site: up to five, from calculation 11 over the mission's calendar year. Choosing one sets the mission dates.
- Five named periods: the team's test periods, not verified best windows; each says so.
- A field for any UTC date and time in the supported range.

**Details drawer.** One scrolling panel, top to bottom:

- *Find better dates*: the thresholds of calculation 11 and up to five landing windows with sunlit, coverage and longest gap. "Show" opens exactly the scored interval.
- *Year timeline*: light or comms over a calendar year, one bar row for the current site and one per saved mission's site, with the mission spans outlined.
- *Horizon*: the terrain horizon over all azimuths with the Sun and Earth at the cursor time. Pointing at an azimuth shows the terrain angle, the distance of the blocking terrain, and whether the data ends before 300 km.
- *Stations*: per selected station its state at the cursor time ("line of sight", "blocked by terrain", "Moon below station mask"), its elevation seen from the site and the Moon's elevation at the station.
- *Compare*: the current view next to one other site or named period, same stations. "Switch" makes it the main view.
- *All sites*: every site once, for the mission's dates or 365 days from its first day; light, comms or both. "Find better location" orders the rows by calculation 13. "Find better dates" on another site's row opens the finder for it. Saved missions follow as rows, with "Calculate flight".
- *Site potential*: sourced statements about the site, each with a category; evidence and source in full data.
- *Site assessment* (collapsed; data fetched when first opened): calculation 14 for the selected site, labelled "Accepted by the science lead at 6650ed1 (reported, no written sign-off)". Slope over the 100 m landing disk and the 2 km exploration disk, roughness, the nearest zero-Sun-visibility cluster, Diviner temperatures. Thresholds are project criteria, not NASA limits. A custom site shows "Not computed for this place".
- *Power estimate*: four inputs (panel area, cell efficiency, constant load, battery; example values, kept in the link) and one sentence: does the battery last through the longest dark window. Marked "First estimate, not a power budget. Not validated by the science lead."
- *Open in NASA tools*: the site in NASA Moon Trek and LROC QuickMap, and JPL Horizons Sun and Earth tables for the site over the mission dates. The link formats were read from the tools on 15 Nov 2026 ([validation.md](event/validation.md), "NASA-tools link check").
- *Export*: windows and summary as CSV, and a link that reproduces the view.
- *How this is computed*: the site's source and frame, the terrain and ephemeris sources, the comms definition, and the Terms of use.

**Rocket flight.** There is no flight tab.

- "Calculate flight" on a saved mission (Mission menu, All sites) or on the current mission opens the flight view with that mission's site, dates, launchpad, rocket and surface stay.
- "Back to landing site" returns.
- The menu shows the maximum payload ± ε, Δv after launch, launch, landing and mission length, and whether every stage has enough propellant. For Blue Moon the lander's propellant figure is a lower bound from the hardware data, and the menu says so.
- "Find cheapest route" and "Landing dispersion" (200 descents with small errors; a 1σ/3σ tube in the scene) are started by the user.
- Payload, cheapest route and dispersion are marked "not yet validated by the science lead".
- Below: rocket and lander (Apollo or SLS with Starship HLS or Blue Moon Mark 2), launchpad, surface stay, "Save mission", then collapsed sections (more choices, reading the 3D view, explanations, abbreviations, how it is computed).

**States.** While data loads, the answer line says so and the tracks stay empty. A site or date without data gives a plain "no data" message. The previous selection's values are never shown under a new selection.

### Points of interest layer

- "Points of interest" switches the layer on and off. Off by default; the link has no `poi` parameter until it is on.
- While on, a key lists the six groups with colour, a checkbox and the pin count. `pois.json` is fetched the first time the layer or the search opens.
- Link format (`app/src/state.ts`, `poi`): absent = off; `poi=all` = every group; `poi=none` = on with no group; otherwise `poi=hazard,water,…`.
- Key note: "Hover or tap a pin to read about it. Only south of 80° S." Without a 3D view it says that no pins are drawn.
- Pins: on the globe every given point; at site and eye level the points and other landing sites within 60 km (`POI_NEAR_KM` in `app/src/scene3d/pins.ts`).
- Info card (`app/src/views/PoiInfo.tsx`): sits beside its pin. Hover shows it; a click or tap keeps it; it closes with "Close", Esc or a click outside. Summary: name, feature type, plain bullets and the distance from the landing site. Full data: the whole record with sources.
- A right-click outside the south cap gives "Points can be added only south of 80° S."
- Where the points come from and their status: [Points of interest](#points-of-interest) in Part 1.

### Search sites

"Search" opens the search panel (`app/src/views/SearchPanel.tsx`; `drawer=search` in the link). Candidates: the sites of `sites.json` and the points of interest with a horizon file (`search-sites.json`).

- Defaults: groups Water and volatiles, Permanent shadow, Science features; within 20 km (1 to 200 km); "Must pass the 5° slope limit" on; rank by Both. The settings are not part of the link.
- Records with the same place name within 5 km (1 km for illumination points) are one row.
- Each row: rank, "Best" for up to the first 3 ranks, the nearby counts in words ("Within 20 km: 1 water 3 shadow 1 science"), Sunlit, Coverage and Slope ("— too steep" when it fails).
- A site row offers "Select". A point row offers "Show", which makes the point the landing site (a custom landing site) and opens it at eye level with its group on.
- No group chosen, or nothing within the distance: one plain sentence.

Order (`app/src/geometry/poiSearch.ts`, header comment):

1. Rows that pass the slope filter and have a value: places with a value of 0 last, then groups covered, then the value, then flatter slope, then points nearby. "Both" = the smaller of sunlit and coverage. Equal keys share a rank (1, 1, 3).
2. Rows that pass but have no data.
3. Rows that fail the slope filter.

"Best" needs a value above 0 and at least one chosen point nearby. Sunlit and Coverage are the comparison table's values for the mission dates.

### Documentation view

- The footer's "Docs" opens a short in-app version as a panel (`drawer=docs` in the link); its text is in `app/src/docs/content.tsx`.
- "Full documentation" opens this page at `/docs`. It is built from `docs/documentation.md`, `docs/why-ours.md`, `docs/scientific-proof/*.md` and `docs/credits.md` at build time.

### Custom landing sites

A place south of 80° S can be the landing site: typed coordinates in the Mission menu, a user point ("Set as landing site", also in its right-click menu) and "Show" in the search. The link carries it as `site=cap:<lat>,<lon>` with five decimals (`app/src/state.ts`).

- Terrain and horizon are computed in the browser from the south-cap rasters (`app/src/data/southcap.ts`, written by `scripts/south_cap.py` from `LDEM_80S_20MPP_ADJ.TIF` and `LDEM_60S_120MPP_ADJ.TIF`): 40 m and 80 m tiles on demand, a 400 m base, a 1920 m outer raster. Same conventions as `scripts/horizon.py` (720 directions, eye 1.75 m, rays to 300 km).
- All results come from the same functions as for a listed site, marked "Approximate: from 40 m / 80 m terrain, not validated."
- Against the pipeline horizons of the 18 listed sites (14 Nov 2026, `app/src/data/southcap.test.ts`): 0.013° median difference over sites, up to 1.68° in single directions. That can move a sunrise or sunset. Not validated by the science lead.
- A custom site is not a row in the site list, the all-sites table or the search. Site assessment is not computed for it.

### What is not covered

- Whether a radio link would work. The app shows geometric visibility of the selected stations.
- Whether a site is suitable for landing. The app shows the 5° slope limit and the site assessment.
- Places north of 80° S other than the 18 listed sites, and any date outside 1 Nov 2026 to 31 Dec 2030.
- Power beyond a first estimate, temperature during the mission, obstacles, routes.
- Scientific validation with a written sign-off. See [Validation results](#validation-results).

The complete list is under [Limits](#limits).
