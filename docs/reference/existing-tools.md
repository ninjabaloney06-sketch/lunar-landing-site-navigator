# Existing tools — device-agent run (Phase 1)

TASKS.md Phase 1: "Test the existing tools (JPL Horizons, NASA Moon Trek, LRO QuickMap). Device agent runs 'Sun and Earth elevation at site X over dates Y' once and writes the steps and screenshots into `docs/reference/existing-tools.md`; then Isaac clicks through it himself, times it and writes the 5 biggest pain points."

- **Machine:** Isaac's laptop (device agent, browser automated end to end).
- **Agent run date:** 25 Oct 2026, ~00:45–01:45 local.
- **Question per tool:** "Sun and Earth elevation (and azimuth) at site X over dates Y", X = Connecting Ridge (Shackleton–de Gerlache ridge), Y = 2026-11-14 00:00 to 2026-11-28 00:00 UT, 1-hour step.
- Timings below are **agent** wall-clock times in a driven browser; they are indicative only. The pitch uses Isaac's own timed human run.

## Site and coordinate (with source)

**Connecting Ridge** (= Shackleton–de Gerlache ridge), center **−89.46° lat, −136.68° lon** (= 223.32° E), altitude 0 km.

- Source: [Collins et al., LPSC 2024 abstract #1775, Table 1](https://www.hou.usra.edu/meetings/lpsc2024/pdf/1775.pdf) (LROC team, ASU) — "Connecting Ridge −89.46 & −136.68"; already recorded in [docs/reference/sources.md](sources.md#shackleton-connecting-ridge). NASA's own 2022 candidate-region release names "Connecting Ridge" but gives no coordinates ([NASA release](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon)).
- Cross-check inside the tools: QuickMap parses the entry as "−89.46° LAT, −136.68° LON" and reports the created point as `(lat, lon) −89.46000, 223.32000`; Horizons echoes "Center geodetic: 223.32, −89.46, 0.0 {E-lon(deg),Lat(deg),Alt(km)}".

Screenshots live in [docs/reference/screenshots/](screenshots) (8 PNGs, all < 500 KB).

## 1. JPL Horizons web app — ANSWERS the question (ideal horizon, numbers)

<https://ssd.jpl.nasa.gov/horizons/app.html> — screenshots [01](screenshots/01-horizons-settings.png), [02](screenshots/02-horizons-sun-result.png), [03](screenshots/03-horizons-earth-result.png).

### Exact steps (Sun run, 12 UI steps)

1. Open the URL. ~7.5 s until the form is usable. Defaults: target **Mars**, observer **Geocentric [code: 500]**, next 30 days at 1-day steps, default quantities.
2. Ephemeris Type: leave "Observer Table".
3. **Target Body** → `Edit` → type `Sun` → `Search` → unique match resolves directly to `Sun [Sol]`.
4. **Observer Location** → `Edit` → method dropdown → `Specify Coordinates` → Coordinate Body: Earth → `change` → pick `[id:301] Moon [Luna]` in the ~80-body list → `Select Indicated Body` → enter longitude `-136.68`, latitude `-89.46`, altitude `0` kilometers → `Use Specified Coordinates`. Form now reads `-136.68°E, -89.46°N, 0 km @301 (Moon [Luna])`.
5. **Time Specification** → `Edit` → Start `2026-11-14 00:00`, Stop `2026-11-28 00:00`, Step `1` with unit `hours` → `Use Specified Time Span`.
6. **Table Settings** → `Edit` → preset `None` (clears defaults) → tick `4. Apparent AZ & EL` → `Use Specified Settings`.
7. `Generate Ephemeris` → ~8 s → in-page text table, 337 hourly rows (14 days).

Earth run (settings persist): `Edit` Target Body → type `Earth` → `Search` → **two** matches, `Earth-Moon Barycenter [EMB]` is pre-selected → choose `MB: Earth` → `Select Indicated Body` → `Generate Ephemeris` (~8 s). Total re-run ≈ 15 s.

### Output format

Fixed-width plain text in the page (`Download Results` saves it as a text file). Columns: `Date__(UT)__HR:MN`, `Azi____(a-app)___`, `Elev`. Result header confirms `Target body name: Sun (10) {source: DE441}`, `Center body name: Moon (301)`, `Center geodetic: 223.32, -89.46, 0.0`, `Center pole/equ: MEAN_ME`, `Step-size: 60 minutes`, `Atmos refraction: NO (AIRLESS)`.

5-line sample, Sun (first rows of 337):

```text
2026-Nov-14 00:00 * 263.283184 1.493512
2026-Nov-14 01:00 * 262.775355 1.488772
2026-Nov-14 02:00 * 262.267536 1.484035
2026-Nov-14 03:00 * 261.759728 1.479302
2026-Nov-14 04:00 * 261.251930 1.474574
```

5-line sample, Earth (first rows of 337):

```text
2026-Nov-14 00:00 * 135.422185 -5.032870
2026-Nov-14 01:00 * 135.364743 -4.990300
2026-Nov-14 02:00 * 135.307236 -4.947407
2026-Nov-14 03:00 * 135.249670 -4.904196
2026-Nov-14 04:00 * 135.192050 -4.860668
```

Reading of the tables (agent): Sun elevation hovers just above +1.4° for the whole window (1.49° at the start, ~1.46° at the end; azimuth sweeps 263° → 93°); Earth starts at −5.03° (below the horizon on 14 Nov), peaks around +3.3° on 27 Nov and ends at +2.68° (azimuth ~135° → 140.5°). Science validation is S's job, not this run's.

### Time it took the agent

Load 7.5 s; each `Generate Ephemeris` ~8 s. Sun run (12 steps through 4 nested dialogs) ≈ 3–4 min of pointing and clicking; agent wall time including verification ~8 min. Earth re-run ≈ 15 s.

### Is the question answerable?

**Yes, completely — as numbers against an airless reference sphere.** Azimuth + elevation, any site on the Moon, any dates, any step. Limits: no terrain horizon (altitude field is height above the reference sphere; the crater rim is nowhere in the model), no plot, no summaries, Sun and Earth must be run separately, times in UT only.

## 2. NASA Moon Trek — Sun tool exists, but the run could NOT be completed

<https://trek.nasa.gov/moon/> — screenshots [04](screenshots/04-moontrek-tools-menu.png), [05](screenshots/05-moontrek-sunangle-tool.png).

### Exact steps (as far as they went)

1. Open the URL. 23–40 s until the globe is usable; a "Welcome to Moon Trek" tutorial modal appears on every load → `Skip Tutorial` (there is a "do not show again" checkbox).
2. In this driven browser the 3D globe rendered on some loads and stayed black on others (3 of ~7 loads; a reload fixes it). Scale bar reads `NaNkm` while broken.
3. `Search` panel (magnifier): this is the **data-product catalog** (9359 layers: Apollo DEMs, LROC mosaics, ...). There is no feature-name search — "Shackleton" is not findable. Getting to the south pole means manual globe dragging or the FlyTo box.
4. `FlyTo` (plane icon): one field "Lat, Lon". My entries `-89.46, -136.68` and `-89.46, 223.32` both left the viewer at `x=NaN` in the URL and `NaNkm` on the scale bar (full reload needed to recover). **Needs retest by a human typing normally** — synthetic keystrokes may be the cause.
5. Hamburger menu → tools list: Calculate Distance, Calculate Elevation Profile, Data Plotter, **Calculate Sun Angle**, Annotate, PointEditor, Generate 3D Print File, NAC Search, Trek VR, Country Mover, Detect Craters, Detect Rocks, Subsetting, Slope, **Surface Lighting**, Surface Electrostatic Potential, Lunar Laser Retroreflectors, **Line of Sight**, Rock Fall, MoonDiff.
6. `Calculate Sun Angle` opens an instruction dialog, verbatim: 1. Select "Point" button. 2. Drop a pin on the map. 3. Click on the pin. 4. Select the "Sun Angle Calculation" option. 5. To remove the point, click on the shape and select the "Remove" option.
7. `Point` button → click on the map → the pin drops (verified visually). But clicking the pin (head, tip, double-click) never opened the "Sun Angle Calculation" menu — no numeric output was obtained in this environment.

### Output format

None obtained. (Expected from the tool name: sun azimuth/elevation at one point for one chosen time — single values, not a 14-day table.)

### Time it took the agent

Load 23–40 s (+ tutorial modal every load). Reaching a usable south-pole view and finding the tool ≈ 4 min. The pin-to-calculation step failed after ~6 attempts; total time sink ≈ 35 min including reloads.

### Is the question answerable?

**Partially, in principle.** A "Calculate Sun Angle" tool exists (plus "Surface Lighting" and "Line of Sight", which look even more relevant), but in this run it could not be driven to a result, its workflow is a 5-step pin dance, and nothing in the menu computes **Earth** elevation. No time-series capability is visible anywhere. Isaac should retry the Sun Angle tool in a normal browser before judging it dead.

## 3. LRO QuickMap — best navigation, no numeric answer

<https://quickmap.lroc.asu.edu/> (now redirects internally to <https://quickmap.lroc.im-ldi.com/>) — screenshots [06](screenshots/06-quickmap-southpole-stereo.png), [07](screenshots/07-quickmap-point-inspector.png), [08](screenshots/08-quickmap-time-controls.png).

### Exact steps

1. Open the URL: 28 s. An update dialog announces "LROC QuickMap has moved … the old site … will be retired soon" → `Close` (it reappears once after the internal redirect).
2. Search field, placeholder `Type a lat,lon(,height) or search...` (top left). Type `-89.46,-136.68` → suggestions appear: `Go to -89.46° LAT, -136.68° LON` and `Create Point at -89.46° LAT, -136.68° LON`. This is the cleanest coordinate handling of the three tools.
3. `Create Point …` → alert: **"Location is outside of bounds of current projection"** — the default projection is Orthographic (Nearside) and the site is on the farside limb. The Object Inspector confirms the point: `Point, 1 vertex, (lat, lon) -89.46000, 223.32000`.
4. Projection button (top-left) → menu: Equidistant Cylindrical (< 75 deg.), Stereographic (North/South Pole), Orthographic (Farside/Nearside/North/South Pole), Lunar Globe (3D). Choose `Stereographic (South Pole)` → polar view, site visible.
5. Bottom-left **Visibility Analysis** panel: `Lat --`, `Lon --`, `Res` (dropdown, tracks view resolution, e.g. 8000 → 2586 m/px), `Accuracy` (dropdown). Clicking the map (on the pin, on empty terrain) never filled Lat/Lon. The user guide (docs.quickmap.io) documents no Visibility Analysis section at all — only "Time Control", which "only appears if a time-dependent layer is active".
6. Clock icon (bottom-left) toggles **time controls**: a timeline slider with week ticks (Oct 22 → Oct 29 → Nov 5 → Nov 12 → Nov 19 → Nov 26 2026), a current-time readout (e.g. `2026-10-24 23:30:53 UTC`, clickable to set any time), play/pause and speed (1x). With the earth-shadow layer active (URL param `earthShadowEnabled=true`) the terrain shadows animate — a visual illumination simulation, no numbers.

### Output format

None numeric. Visual only: map, animated terrain shadows over the time slider, and the inert Visibility Analysis panel. No azimuth/elevation table or export, nothing about Earth position.

### Time it took the agent

Load 28 s. Coordinate entry + point + projection switch ≈ 1 min. Exploring the Visibility Analysis, time controls and help docs ≈ 15 min (inconclusive).

### Is the question answerable?

**No — not as asked.** QuickMap is the best of the three for *getting to* the exact site (typed coordinates parse directly, proper south-pole projection), and its shadow animation shows *whether* a spot is lit over time. But it never produces Sun/Earth azimuth/elevation numbers, the Visibility Analysis could not be made to run, and Earth geometry is absent.

## Summary

| Tool | Reach site X | Sun az/el over Y | Earth az/el over Y | Output |
|---|---|---|---|---|
| JPL Horizons | yes (typed topocentric coordinates, 4 dialogs) | **yes, hourly table** | **yes, hourly table** (separate run) | fixed-width text, 337 rows each |
| Moon Trek | painful (no feature search; FlyTo broke; manual dragging) | tool exists, run failed | no tool | none obtained |
| LRO QuickMap | **best** (lat,lon parse, S-pole projection) | visual shadows only | no | none numeric |

No single existing tool answers "Sun AND Earth elevation at site X over dates Y" as a readable plot or summary — the only numeric path is Horizons' raw text, read by hand, with terrain ignored.

## Isaac's timed run, 27 Oct 2026 — the pitch pain points

Human run in a normal browser, first-time user, without reading the agent steps above. Same question: Sun AND Earth elevation at Connecting Ridge (−89.46°, −136.68°), 14–28 Nov 2026, hourly. Stopwatch from opening the URL; cap 15 min per tool.

| Tool | Time | Answered? |
|---|---|---|
| JPL Horizons | 6:11 | **No — wrong answer that looked right** |
| NASA Moon Trek | gave up at 5:00 | No |
| LRO QuickMap | 3:00 | No |

### The 5 pain points

1. **Horizons gives a wrong answer that looks right.** Searching "moon" for the observer lists Earth observatories with "Moon" in their name. The run produced two complete hourly tables: the Sun seen from Crescent Moon Observatory, Columbus, Ohio ([txt](screenshots/h-horizons-sun-from-ohio.txt): `Center-site name: Crescent Moon Observatory, Columbus`) and the Moon seen from Earth's centre ([txt](screenshots/h-horizons-moon-from-geocentre.txt): `Center-site name: GEOCENTRIC`). No warning; neither answers the question. Screenshots [h01](screenshots/h01-horizons-observer-search-moon.webp), [h05](screenshots/h05-horizons-observer-search-luna.webp), [h04](screenshots/h04-horizons-observer-equals-target.webp).
2. **Horizons won't let you just type a point on the Moon.** No lat/lon field on the obvious path; the location search finds named sites only; 5 nested dialogs and 49 output checkboxes; the default output is RA/Dec, not elevation (both txt files contain no azimuth/elevation column). Old layout, duplicate buttons, unusable on an iPad or phone. Screenshots [h02](screenshots/h02-horizons-49-checkboxes.webp), [h03](screenshots/h03-horizons-table-settings.webp).
3. **Moon Trek hides its tools, then locks them.** 15 s to load; lighting tools are behind small buttons in a menu; "Surface Lighting" is "not available in this projection and requires a Trek account"; the search box searches a data catalog, not places or tools; the globe rendered only partly. Gave up after 5 min without a number. Screenshots [h06](screenshots/h06-moontrek-flyto.webp), [h07](screenshots/h07-moontrek-search-catalog.webp), [h08](screenshots/h08-moontrek-tools-need-account.webp), [h09](screenshots/h09-moontrek-partial-render.webp).
4. **QuickMap is a good map with no answer.** Fast load, typed coordinates, hover shows lat/lon, right-click to go there or set a point. But the default view can't show the site ("Location is outside of bounds of current projection"), and there is no Sun or Earth elevation anywhere. 3 min, no number. Screenshots [h10](screenshots/h10-quickmap-out-of-bounds.webp), [h11](screenshots/h11-quickmap-projections.webp).
5. **None of the three answered the question.** ~14 minutes across three NASA tools: one wrong answer, two dead ends. Nothing shows Sun and Earth together for a point on the Moon.

## AGENT OBSERVATIONS — Isaac must do his own timed run; the pitch uses his 5 pain points, not these

Candidate pain points observed by the device agent, 25 Oct 2026. They are input for Isaac's timed human run, not the pitch material themselves.

1. **Horizons hides the Moon-surface observer.** Default is Earth geocentric; getting an observer onto the Moon takes 4 nested dialogs (Edit → "Specify Coordinates" → "change" body → pick Moon from ~80 bodies → confirm). Nothing in the UI suggests surface sites on other bodies are even possible.
2. **Horizons "Earth" trap.** Searching "Earth" returns two matches with *Earth-Moon Barycenter* pre-selected; one careless click gives numbers for the wrong target that look perfectly plausible.
3. **Horizons gives raw text, twice.** 337 fixed-width rows per body, Sun and Earth in separate runs; no plot, no "% time lit", no comms-blackout summary — the mission-planner question is answered only by eyeballing two text tables.
4. **No terrain anywhere.** Horizons elevations are above an airless reference sphere (site altitude defaults to 0 km); the crater rim that actually decides sunlight at Connecting Ridge is in no tool's numbers.
5. **Moon Trek's Sun Angle tool is a 5-step pin dance** (Point button → pin → click pin → menu option) that this run could not complete; the globe failed to render on ~half of loads; there is no feature-name search (only a 9359-product data catalog), and FlyTo left the viewer at `NaNkm`.
6. **QuickMap's Visibility Analysis sat inert** (Lat/Lon "--", undocumented in the user guide); the default projection cannot even display the site ("outside of bounds") until switched to a polar projection; the time slider animates shadows but yields no numbers and has no Earth geometry.
7. **Cross-tool:** answering one planning question needs Horizons (numbers, no terrain, text only) *plus* a map tool (terrain, no numbers) — nothing combines them, and nothing anywhere reports Earth azimuth/elevation as a table.

## What Isaac should do next (per TASKS.md, human part) — done 27 Oct, see "Isaac's timed run" above

- Repeat the Horizons run timed (both targets), note your 5 pain points.
- Retry Moon Trek's Calculate Sun Angle and Surface Lighting in a normal browser (my failure may be webview-specific); also try FlyTo by real typing.
- Retry QuickMap's Visibility Analysis with a time-dependent layer enabled; if it runs, note what it outputs.
- Keep the 5 pitch pain points your own; the list above is only candidate material.

## Product follow-through — 28 Oct 2026

Source: ninja's timed human run above, 27 Oct. These are failures of that run and product usability findings, not proof that the other tools calculate physics incorrectly. Previously the plan covered the combined sky plot, terrain and timeline, but did not explicitly prevent all five failures. The tasks below now appear in TASKS.md phases 3–5 and the team/event checklists. Implementation and test execution happen during the event.

| ID / human finding | Previous coverage | Required response and owner | Evidence before freeze |
|---|---|---|---|
| UX-01 — wrong observer/output looks plausible | Ephemeris validation existed, but no explicit observer/output trap check | Q + S: fixed lunar-surface observer and explicit Sun/Earth targets; verify reference metadata before comparing values. D: label site, coordinates, UTC and units in results | Regressions reject Ohio-observatory/geocentre and RA/Dec-only references; correct reference passes; S signs numerical comparison |
| UX-02 — nested setup, wrong default columns, poor phone use | Site picker existed; direct date controls and mobile completion were unspecified | D: visible site/date controls, azimuth/elevation as the built-in output, both bodies together; no output-column configuration | Unbriefed human completes the original question on desktop and 375 px touch viewport; no setup dialogs or instructions needed |
| UX-03 — hidden/account-gated tools, partial globe | No explicit account-free or map-failure acceptance check | D: core answer available signed out, site list works without map; clear loading/error/empty states; invalid input cannot produce NaN or relabel stale results | Q + D exercise failed data load, map unavailable and invalid/out-of-coverage input; supported core flow remains usable without map |
| UX-04 — selected south-pole site out of projection; map gives no numbers | Sky plot planned; map fallback and readable numeric output unspecified | D: reach every offered site with a list; any map uses a suitable polar view; numeric az/el available by mouse or touch | Both supported sites reachable without projection changes; numbers agree with S's validated output |
| UX-05 — no single answer to Sun AND Earth over the requested period | Combined plot + timeline + summaries already planned | I + D: one flow with both bodies, windows and summary; basic site/date comparison remains required when optional views are cut | Original Connecting Ridge question answered; switch between two validated sites over one period and two supported periods at one site; selected context and results update together |

Reference setup for UX-01: [NAIF body identifiers](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/naif_ids.html) identify Moon = 301, Sun = 10, Earth = 399; Earth-Moon barycentre = 3 is not the Earth target. The original site's source, dates and output headers are recorded above. S supplies trusted expected values; a plausible-looking screenshot alone is not a science check.

Internal acceptance targets (not NASA rules or measured product performance): from a fresh signed-out URL, an unbriefed tester answers the original Connecting Ridge / 14–28 Nov 2026 UTC question with correct Sun/Earth numbers, plot and windows within 60 seconds. After load, changing a supported site/date gives a readable updated answer within 10 seconds. The event spec must name at least two validated sites and two supported date ranges; a reduced single-site demo must be reported as a challenge gap. Static precomputed data is sufficient; unrestricted dates, arbitrary custom sites and a backend are not required.

Record actual timings, environment, numerical sign-off, failures and fixes in docs/event/validation.md at the event. Q checks UX-01 regressions by Saturday 16:00; D implements the core controls/fallback by Saturday's 20:00 sky-plot checkpoint; I + Q + D run UX-01–05 before Sunday's 12:00 freeze. Core failures block freeze; drop score, extra layouts and map before dropping correct, usable answers. None of these future implementation checks is marked passed by this planning review.
