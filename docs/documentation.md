# Lunar Landing Site Navigator — documentation

Technical and product documentation for the app as it is on the `main` branch on 14 Nov 2026. Team SFZ | MEXG, NASA Space Apps 2026, local event Heilbronn. Install and run steps: [README](../README.md).

> SI marking: this document was drafted by an SI (AI) tool, Claude Code, on 14 Nov 2026 from the repository's code and records. It awaits review by the team (code checks against behaviour; science lead for the validation part).

Contents: [Part 1, technical](#part-1--technical) (data flow, frames and units, calculations, validation results, limits) · [Part 2, product](#part-2--product) (who it is for, the question, how to read each view, what is not covered).

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
| `scripts/textures.py` | NASA SVS and Blue Marble images | `app/public/textures/`: Moon colour, Moon normal map, Earth, stars |
| `scripts/assessments.py` | both LOLA models, the Sun-visibility maps, the Diviner table, `sites.json` | `assessments.json` |
| `scripts/windows.py` | — | nothing: the Python reference of the browser geometry, used by tests |
| `scripts/export_fixtures.py` | the shipped `ephem/`, `sites.json`, `horizons/` | `app/src/test/fixtures.json`: 200 test cases |
| `scripts/pois.py` | `docs/POIs/*.json` (seven research files and `additional-sites.json`) | `pois.json`: one record per point of interest, 206 on 14 Nov 2026 |
| `scripts/poi_horizons.py` | `docs/POIs/*.json`, `LDEM_80S_20MPP_ADJ.TIF`, `LDEM_60S_120MPP_ADJ.TIF`, `scripts/sites.csv`, `ephem/YYYY-MM.json` | `horizons/poi-<group>-<id>.json`: terrain horizon per point; `search-sites.json`: 180 entries on 14 Nov 2026 |

3. **The browser** loads `sites.json`, `periods.json` and `stations.json` at start, then the horizon of the chosen site and the ephemeris months the chosen dates need. All results on screen are computed in the browser from these files (`app/src/geometry/`). There is no server-side computation, no database, no account, no cookie.

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

**11. Find better dates (`finder`).** Candidate landing times every 6 hours, from the mission start to 60 days later. Each candidate mission is scored on 30-minute samples against four thresholds: minimum percent sunlit, minimum percent coverage, longest coverage gap, longest darkness. Defaults: 14 days, 70 %, 50 %, 48 h, 72 h; these are proposed defaults, all editable ([spec.md](event/spec.md), "Finder"). Neighbouring candidates that qualify are merged into one landing window. Windows are ranked by coverage, then percent sunlit, then date. If nothing qualifies, the nearest miss and the thresholds it fails are shown.

**12. Site slope and the 5° limit (`scripts/horizon.py`, `app/src/geometry/rankSites.ts`).** The slope of a site is taken over a 100 m baseline (heights 50 m east, west, north and south of the site on the 20 m model). A site passes the 5° slope limit at 5.0° or less; above it fails; without a value it is unknown. The 5° is the team's project criterion, not a sourced NASA or vehicle limit ([spec.md](event/spec.md), "Terrain slope").

**13. Site ranking (`rankSites`).** First the slope filter of step 12. Sites that pass are ordered by the rule of the chosen science goal, then by coverage, then by percent sunlit. The goal rules: "Consistent light" = percent sunlit, then the shortest longest darkness; "Water ice", "Cold traps" and "Science targets" = the best evidence label among the site's sourced entries for that goal (direct measurement, remote observation, modeled condition, hypothesis, unknown); "Any" = coverage. There is no weighted score: keys are compared one after another, so each row's place can be checked by hand. Ties share a rank and are named.

**14. Site assessments (`scripts/assessments.py`).** Computed for all 18 sites and shipped as `assessments.json`; not shown in the user interface on main. Method, data and limits are in [validation.md, "Mandatory site assessments"](event/validation.md#mandatory-site-assessments--method-and-evidence-ai-not-validated). In short: per-pixel slope statistics over a 100 m landing disk and a 2 km exploration disk; RMS height deviation from a plane over the 100 m disk as roughness; clusters of zero average Sun visibility in the Mazarico et al. maps with distance, bearing and a straight-line slope check; annual mean and annual maximum temperature from the Diviner Polar Resource Product.

**15. 3D scene (`app/src/scene3d/`).** A view of the same geometry, not a source of numbers. Sun, Earth and stars are drawn at their true directions and true angular sizes. Lit and dark are never taken from rendered shadows. At eye level the terrain silhouette is the horizon of step 4.

### Points of interest

The points of interest come from the records in `docs/POIs/`: seven research files and `additional-sites.json`, which adds researched points. Each file states its source (`derived_from`), its coordinate convention and its validation status in its header fields.

- **Which records become pins.** A record is shipped only if its geometry is a point and it has at least one source URL. Regional findings without coordinates are not pins (`scripts/pois.py`).
- **Groups.** Hazards (`hazards.json`), Water and volatiles (`ice-volatile-evidence.json`), Permanent shadow (`psr-cold-traps.json`), Sunlit points (`illumination-sites.json`), Landing sites (`landing-sites.json` and `additional-sites.json`), Science features (`science-features.json`). `pgda-study-sites.json` has names only and contributes no point.
- **Values.** `scripts/pois.py` copies each value from its record by a fixed mapping: name, category, summary, facts, evidence, limitations and sources. Nothing is reworded. Labels of the info box come from `KEY_LABELS` in `scripts/pois.py`.
- **Coordinates.** Latitude is planetocentric, south negative. Longitude is taken from `lon_east_180` (east-positive, -180 to 180) and must agree with `lon_east_360` to 1e-9°, or the script stops. Where a source names no frame, `MOON_ME` is assumed (`app/src/data/pois.ts`).
- **Status.** These are research notes, not validated by the science lead. Landing records carry the note that their coordinates still need a check.
- **What is shown.** The app shows only points south of 80° S (`app/src/scene3d/region.ts`; filter in `app/src/views/poiLayer.ts`). On 14 Nov 2026 `pois.json` holds 206 records, of which 195 lie at or south of 80° S.
- **Counts on 14 Nov 2026** (from `pois.json`): Landing sites 88, Permanent shadow 69, Sunlit points 18, Science features 16, Water and volatiles 8, Hazards 7.
- **Terrain horizons.** `scripts/poi_horizons.py` gives each point that lies inside the 20 m model a terrain horizon, by the method of step 4. Each one is copied into `search-sites.json` as a site-shaped entry with its `poi_id`. A point without a horizon file shows "no data" in the search. Its `far_side` flag is derived from the shipped ephemeris and ignores terrain.

### Validation results

Copied from [docs/event/validation.md](event/validation.md) on 14 Nov 2026 with their status. That file is the record; if the two differ, it is right.

| ID | Check | Status in validation.md |
|---|---|---|
| V1 | 10 site/time points against JPL Horizons, tolerance 0.05° | passed, as reported by a team member in chat on 14 Nov 2026, 15:56; no written sign-off by the science lead in the repository |
| V2 | One row by hand: Sun elevation near the pole ≈ −(sub-solar latitude) | passed, reported the same way; no written sign-off |
| Station check | Moon elevation at two DSN stations against Horizons; `IAU_EARTH` approximation | open |
| V3 | Synthetic horizons (flat sphere −0.0813° for 1.75 m; cone) | open |
| V4 | Real horizons against PGDA averages (context) | open |
| V5–V9 | Window edges, coarse terrain, values in the user interface, finder, panel types | open |

No check carries a written sign-off by the science lead. The app's switch `VALIDATED` was set to true on 14 Nov by team decision after an independent recomputation by an SI tool agreed with the app (validation.md, "Independent recomputation by AI"); before that every value carried the marker "sample values — not validated".

Inputs recorded for these checks (filled in by an SI tool, not a sign-off):

- V1: 20 rows (Sun and Earth, two sites, five times each) from direct SPICE values against Horizons. Largest difference 0.0000° in azimuth and 0.0001° in elevation.
- V2: Horizons sub-solar point for 14 Nov 2026 12:00 UTC gives an elevation of 1.4376° at Connecting Ridge by the spherical formula; the pipeline gives 1.4369°; difference 0.0007°.
- Station check: 10 values at Madrid DSS-54 and Canberra DSS-34. Largest difference in Moon elevation 0.0763°. The tolerance and whether `IAU_EARTH` is acceptable are not decided.

Site assessments: code review by the team's code checker and acceptance of the numbers by the science lead are recorded as reported by a team member for commit `6650ed1`; no written sign-off is in the repository. Seven method choices are listed there as not separately decided (landing pass rule, cluster size, roughness measure, map projection reading, use of the 5 m model, one source match, thermal scope). Recorded evidence includes: site heights and slopes reproduced from the 20 m model for three sites; Diviner maximum temperatures at four published reference points, three within 0.3 K and one 2.9 K off at a 2 km scale.

Automated tests (run on 14 Nov 2026, see README): 206 Python tests, 76 unit tests, 63 end-to-end tests (one skipped by design); counts of 14 Nov 18:01. They include a comparison of the interpolated ephemeris against direct SPICE values below 0.001° (`scripts/tests/test_ephemeris.py`) and 200 fixture cases in which the browser code must reproduce the Python reference to 1e-6° (`app/src/geometry/fixtures.test.ts`). Tests show that the code does what it was written to do. They are not scientific validation.

### Limits

**Not modelled**

- A radio link. No link budget, frequency, antenna schedule or availability, weather, or equipment. "Comms" is geometric visibility of the selected stations only.
- Relay satellites and stations other than the five listed. ESA ESTRACK antennas are not included: no sourced minimum elevation was found ([spec.md](event/spec.md)).
- Per-azimuth horizon masks of the stations. One minimum elevation per antenna is used.
- Precise Earth orientation. `IAU_EARTH` is an approximation.
- Power. Sunlit is yes or no; there is no solar-panel model and no partial-disc power value.
- Temperature over a mission period. Only annual mean and annual maximum exist, and only in `assessments.json`.
- Boulders and obstacles. They are below the resolution of the terrain models and are reported as unknown.
- Routes and access. Only a straight-line slope check to the nearest shadow cluster exists, in `assessments.json`.
- Landing safety. Passing the 5° slope limit is one criterion on one measurement.
- Terrain beyond 80° S. Outside the 20 m model the horizon uses a 120 m model, coarser than the 20 m used near the site. This matters for IM-1 only, which lies about 4 km from the edge of the 20 m model: its skyline to the north-north-east (52 of 720 directions) comes from 120 m data.
- The change of the horizon across the width of a disc. The horizon is taken at the disc centre's azimuth.
- Scattered light, earthshine and heat from surrounding terrain as inputs to any result.
- Arbitrary coordinates outside the south cap. A place south of 80° S can be set as a custom landing site; its numbers are approximate (see "Custom landing sites"). North of 80° S only the listed sites can be analysed.
- Launch, transfer, descent and any trajectory.
- Uncertainty. No error bars are computed; errors of the terrain model are not propagated.

**Resolution at which each result holds**

| Result | Holds at |
|---|---|
| Dates | 1 Nov 2026 00:00 UTC to 1 Jan 2031 00:00 UTC; a mission of at most 60 days |
| Sun and Earth direction | Ephemeris sampled every 30 min and interpolated; interpolation tested against direct SPICE below 0.001° |
| Terrain horizon | 0.5° in azimuth; 20 m terrain within 20 km, 160 m averages from 20 km to 300 km; observer 1.75 m above the site point |
| Sunlit / Earth visible | Yes or no for "any part of the disc above the horizon" |
| Window start and end | Found numerically to ±10 s on the interpolated model; events shorter than 1 min (5 min for periods over 31 days) can be missed. This is the numerical resolution, not a validated accuracy: the window-edge check V5 is open |
| Finder | 30-minute samples; landing times 6 hours apart |
| Station geometry | Moon elevation at a station differs from JPL Horizons by up to 0.0763° in the 10 recorded values (station check open) |
| Site position | As printed in each site's source, a representative point of a region; frame assumed where the source does not name it |
| Site slope (5° limit) | One value per site over a 100 m baseline on the 20 m model, stored to 0.1° |
| Assessment slopes | Per pixel over a 10 m baseline (5 m model, 7 sites) or a 40 m baseline (20 m model, 11 sites); landing disk 100 m radius, exploration disk 2 km radius |
| Roughness | RMS over the 100 m disk; features smaller than about 2 pixels (10 m or 40 m) are not resolved |
| Shadow clusters | 60 m map (15 sites) or 120 m map (3 sites); clusters of at least 0.1 km² within 50 km |
| Temperature | Mesh triangles of 0.13–0.15 km², coarser than the 100 m landing disk; annual values from a model fit |
| 3D terrain | 20 m within ±2.5 km, 80 m within ±20 km, 400 m within ±60 km, 2 km within ±300 km; for viewing only |

---

## Part 2 — product

### Who it is for

A mission planner who has to decide which site near the lunar south pole and which period to use, and who needs the answer again when a date slips. The challenge also names educators and the public; the app needs no account and no setup.

### The question it answers

At this site, in this period: when is there sunlight, and when is at least one of the selected Earth stations geometrically visible? And from there: which of the evaluated sites is best for this mission, and which dates would be better?

The existing tools did not answer this in a timed test on 27 Oct 2026: one produced a wrong answer that looked right, two produced no number ([existing-tools.md](reference/existing-tools.md), section "timed run, 27 Oct 2026").

### How to read each view

**Header (top left).** The mission name with a rocket icon opens the Mission panel. Under it: the site name, its coordinates, and a caveat label where the site has one (for example a reference point that is not a landing site). The date and time shown is the cursor time in UTC; it opens the date menu.

**3D scene.** Three levels. *Globe*: the Moon with one pin per site; a click on a pin selects that site. *Site*: the terrain around the landing site from above. *Eye*: the view of a person standing at the site, 1.75 m above the ground. Labels sit on the objects: "Sun" and "Earth" with their elevation in degrees, and "Landing site". A negative elevation means below the horizontal plane; whether the body is hidden depends on the terrain, which the sentences and the horizon strip tell. Keys: `E` switches between site and eye level, `Esc` goes back to the globe. Without WebGL the scene is replaced by the horizon strip.

**Camera, viewpoints and points (merged 14 Nov 17:29, `5b08db8`).** Left-drag orbits as before. Middle-drag looks around from where the camera is. The wheel or a two-finger pinch moves the camera along the view and stops 1.75 m above the terrain; at eye level it narrows the lens instead (54° down to 4°), and the Sun and Earth keep their computed angular size. A left-click on the terrain at site or eye level moves the camera to stand on that spot. "View", beside the timeline, and a right-click on the scene list the viewpoints: Moon, Point start, Point end, Earth, Sun and "Solar system — top view" (seen down the Moon's +z axis, not to scale, and marked so); "View" also lists Landing site and Eye level, so a phone needs no keyboard. "Add point here" in the right-click menu, or typed coordinates in the Mission panel, add a user point with a name and an optional role (Start, End), kept in the link. A user point has no horizon file: the app shows its marker, its coordinates and "No terrain data for this point", never a value. Hovering or tapping a pin shows its name. "Simulate", beside the timeline, plays the mission by the clock; the speed and "Reset to start" are in the Details drawer. None of this changes the site, the dates or a number: the labels and the answer always describe the landing site.

**Answer line (above the timeline).** Two sentences for the cursor time. The first is about sunlight ("Sunlight for 3 more days.", "Dark for 5 more hours."). The second is about station contact in the geometric sense ("Station contact for 9 more hours.", "Next station contact in 2 days."). Good time is rounded down and waiting time up.

**Timeline.** Two tracks over the mission, plus three dimmed days before and after for context. *Light*: yellow = sunlit, dark = not. *Comms*: blue = at least one selected station geometrically visible, dark = none, hatched = unknown. The bracket marks the mission with its name and length. Drag to move the cursor; click a date to jump to that day at 12:00 UTC. Keys: space plays and pauses, the arrow keys step 30 minutes, with shift one day.

**Slope warning.** Shown above the timeline only when the selected site fails the 5° slope limit, with the measured slope and the 100 m baseline.

**Footer.** The terrain and ephemeris sources in one line, a link to "how this is computed", and, while the switch `VALIDATED` is false, the marker "sample values — not validated".

**Mission panel.** Fields in this order: name; start and end date (changing the start keeps the length); science goal; landing site; ground stations; Play mission. The landing-site list is the ranking of calculation 13 for the mission's own dates, stations and goal. It has three groups: "Passes the 5° slope limit" (ranked, with rank numbers), "Too steep to land (slope above 5°)" and "Not enough data". Each row shows the values it was ranked by: percent lit, percent comms, slope, and for evidence goals the evidence label with its source link. "Best" here means best among the 18 evaluated sites for these inputs. Play mission moves the cursor from the first to the last mission day at eye level.

Added after this text was written: see [BUILD_LOG.md](../BUILD_LOG.md).

**Date menu.** Five named periods and a field for any date and time in the supported range. The named periods are the team's test periods, not verified best windows; each says so.

**Details drawer (gear button, top right).** One scrolling panel:

- *Horizon*: the terrain horizon over all azimuths (N, E, S, W) with the Sun and Earth at the cursor time. A body below the plotted range is pinned to the bottom edge as a hollow dot and keeps its true value in the label. Pointing at an azimuth shows the terrain angle there, how far away the blocking terrain is, and whether the terrain data ends before 300 km.
- *Stations*: one row per selected station with its state at the cursor time ("line of sight", "blocked by terrain", "Moon below station mask"), its elevation seen from the site and the Moon's elevation at the station.
- *Find better dates*: the thresholds of calculation 11 and up to five landing windows with percent sunlit, coverage and longest gap. "Show" opens exactly the interval that was scored.
- *Compare*: the current view next to one other site or named period, with the same stations: sunlit, station coverage, unknown, longest darkness, longest coverage gap. "Switch" makes the compared choice the main view.
- *All sites* (merged 14 Nov 18:09, `efbbedf`): one table with every site once. Columns: both (sunlit, station coverage), light (sunlit, longest darkness) or comms (station coverage, longest coverage gap). Dates: the mission's own, or a whole year of 365 days from its first day. "Find better location" orders the rows by calculation 13 for the mission's science goal, with rank numbers; sites above the slope limit and sites without data follow, unranked. "Find better dates" on a row opens the finder for that site. Checked rows show their sunlit windows as tracks on one time axis. Saved missions ("Add mission" in the Mission panel; kept in this browser only, no account) follow as rows, each for its own site, dates and stations. Every value is the summary of calculation 9 for that site and span; a site without a horizon file shows "no data".
- *Site potential*: sourced statements about the site, each with a category, an evidence label and a source link. Access is not assessed.
- *Export*: the windows and the summary as CSV, and a link that reproduces the view.
- *How this is computed*: the site's source and frame, the terrain and ephemeris sources, the comms definition, and the Terms of use.

Added after this text was written: see [BUILD_LOG.md](../BUILD_LOG.md).

**States.** While data loads, the answer line says so and the tracks stay empty. A site or date without data gives a plain "no data" message. The previous selection's values are never shown under a new selection.

### Points of interest layer

The top-bar button "Points of interest" switches the layer on and off. It is off by default, so a first visit shows the plain scene, and the link carries no `poi` parameter until it is on. While it is on, a key under the top bar lists the six groups with their colour, a checkbox per group and, once the data has loaded, the number of pins in each group. The file `pois.json` is fetched the first time the layer or the search opens.

- Link format (`app/src/state.ts`, `poi`): absent = off; `poi=all` = every group; `poi=none` = on with no group; otherwise `poi=hazard,water,…` in key order.
- Key note: "Hover or tap a pin to read about it." With no 3D view the note says that no pins are drawn. Both end with "Only south of 80° S. From research notes, not validated by the science lead."
- Pins: the view hands the visible points to the 3D scene through `setPois` (`app/src/scene3d/index.ts`). On the globe every given point is drawn as a coloured pin with a dark outline; at site and eye level only the points and other landing sites within 60 km of the current site are drawn (`POI_NEAR_KM` in `app/src/scene3d/pins.ts`).
- Info box (`app/src/views/SceneView.tsx`, `app/src/views/PoiInfo.tsx`): with a mouse it shows while the pointer is on a pin and stays while the pointer moves onto it. A click on the pin, or a tap, keeps it open. A kept box closes with its "Close" button, Esc, a press anywhere else, or a camera move away from it. It shows the group and coordinates, the name, the summary, the record's facts, "Evidence", "Limitations", the caveat about research notes, and the source links, each shown by host name.
- A right-click outside the south cap gives "Points can be added only south of 80° S."

### Search sites

The top-bar button "Search" opens the search panel (`app/src/views/SearchPanel.tsx`; drawer `search` in the link). Candidates are the sites of `sites.json` and the points of interest that have a horizon file (`search-sites.json`). Until the points of interest are loaded the panel says "Loading the points of interest…".

Defaults, as the code has them:

- Groups selected: Water and volatiles, Permanent shadow, Science features. Hazards is off. Landing sites and Sunlit points are off too.
- "Within, km": 20. The field accepts 1 to 200 km.
- "Must pass the 5° slope limit": on.
- "Rank by": Both.

The search settings are not part of the link. Only `drawer=search` is.

Each row shows its rank (once the list is ordered), "Best" for the first 3 rows (more when tied), the count of each chosen group within the radius, Sunlit, Coverage and Slope ("— too steep" when it fails the limit). A site row offers "Select". A point row offers "Show" only, which opens the globe with the point's group switched on.

The count of a group is the number of its points within the radius (inclusive), measured along a 1737.4 km sphere. A candidate's own record is not counted. The order of the list (`app/src/geometry/poiSearch.ts`, header comment) is:

1. Rows that meet the slope filter and have a sunlit or coverage value, ranked by the number of chosen groups covered (most first), then by the number of points nearby (most first), then by that value (most first). Equal keys share a rank (1, 1, 3) and are listed by site id. For "Both" the value is the sunlit percentage plus the coverage percentage; no other weighted score is used.
2. Then rows that meet the slope filter but have no data, by groups covered, points nearby and site id.
3. Then rows that fail the slope filter, by groups covered, points nearby and value (no data last), then site id.

With the slope filter off, the panel says "Order:" in place of the slope sentence and every row counts as meeting it. Sunlit and Coverage are the values of the comparison table for the mission dates. A place without a horizon file shows "no data". The list appears once every row is computed; until then the panel shows "Computing X of N places for these dates…".

### Documentation view

The footer link "Docs" opens the documentation as a panel (drawer `docs`; `drawer=docs` in the link). The panel is loaded as a separate part of the app the first time it is opened (`app/src/App.tsx`). Its text is in `app/src/docs/content.tsx`.

### Custom landing sites

A place south of 80° S can be made the landing site: typed coordinates in the Mission panel search and every user point offer "Set as landing site" (`app/src/views/MissionPanel.tsx`; the right-click menu on a user point offers the same). Outside the cap the action is not offered. The link carries the place as `site=cap:<lat>,<lon>` with five decimals (`app/src/state.ts`); older links are read as before.

- Terrain and horizon are computed in the browser from the south-cap rasters (`app/src/data/southcap.ts`, files under `app/public/data/terrain/cap/`, written by `scripts/south_cap.py` from `LDEM_80S_20MPP_ADJ.TIF` and `LDEM_60S_120MPP_ADJ.TIF`): 40 m and 80 m tiles fetched on demand, a 400 m base and a 1920 m outer raster. The horizon uses the conventions of `scripts/horizon.py` (720 directions, eye 1.75 m above the ground, rays to 300 km).
- All results (answer, timeline, horizon chart, slope warning, finder) come from the same functions as for a listed site. They are marked "Approximate: from 40 m / 80 m terrain, not validated."
- How approximate: compared with the pipeline horizons of the 18 listed sites on 14 Nov 2026 (`app/src/data/southcap.test.ts`), the browser horizon differs by 0.013° in the median over sites, and by up to 1.68° in single directions (four sites above 0.8°). A difference of that size can move a sunrise or sunset. Only those 18 places (rims, ridges and plateaus) were measured. Not validated by the science lead.
- A custom site is named "Custom site" and is not a row in the site list, the all-sites table or the search.

### What is not covered

- Whether a radio link would work. The app shows geometric visibility of the selected stations.
- Whether a site is suitable for landing. The app shows whether it passes the 5° slope limit.
- Any site outside the list of 18, and any date outside 1 Nov 2026 to 31 Dec 2030.
- Power, temperature during the mission, obstacles, routes, trajectories.
- The site assessments in `assessments.json`: computed, not yet shown.
- Scientific validation with a written sign-off. See [Validation results](#validation-results).

Added after this text was written: see [BUILD_LOG.md](../BUILD_LOG.md).

The complete list is under [Limits](#limits).
