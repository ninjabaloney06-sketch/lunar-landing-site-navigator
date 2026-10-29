# Learning path per role

Phase 1 preparation ([TASKS.md](../TASKS.md)): short official tutorials, practised on **the tutorials' own examples in a scratch folder outside this repo**. Nothing about our sites, our data or our app before Sat 14 Nov 2026, 09:00 (prep rule in [AGENTS.md](../AGENTS.md) and [decisions.md](decisions.md)).

Budget: **≤ 6 h per person.** Pick your rows, note where you get stuck (feeds the phase-1 task "work through your part of learning.md"), and save your notes offline for the event (phase-2 laptop task).

Roles are a proposal, not yet agreed (phase 0) — read your proposed rows anyway: **S** = science lead (proposed L), **Q** = code checks (proposed O), **D** = frontend and design (proposed B), **I** = Isaac.

| Person | Rows | Total |
|---|---|---|
| S (L) | spiceypy · JPL Horizons · worktrees | ~4 h |
| Q (O) | pytest · worktrees | ~2.5 h |
| D (B) | Replaced 26 Oct: B directs the agents instead of learning React/Plotly; his prep is in [team/bene.md](team/bene.md). The D sections below stay as optional reference. | ~6 h |
| I | spiceypy (short) · rasterio + pyproj · worktrees | ~4.5 h |

Links checked 2026-10-24 with `curl -sI` (HTTP 200 unless noted). If one is dead later, search for the title — don't guess a URL.

---

## All — Claude Code worktrees and parallel agents (~0.5–1 h)

- Tutorial: [Common workflows — git worktrees](https://code.claude.com/docs/en/common-workflows) and [Subagents](https://code.claude.com/docs/en/sub-agents) (Claude Code docs).
- Practise: in a throwaway toy repo (not this one), create two git worktrees, run two agent sessions in parallel, give each one small independent edit, then merge both branches.
- Done when: both toy-repo branches merged without conflict, and you can say in one sentence why two agents must never edit the same file set at the same time.

## S — spiceypy (~2.5 h) · also I, shorter (~1.5 h)

- Tutorial: [spiceypy docs](https://spiceypy.readthedocs.io/en/latest/) incl. the worked [example page](https://spiceypy.readthedocs.io/en/latest/exampleone.html); the underlying concepts in the official NAIF [tutorials](https://naif.jpl.nasa.gov/naif/tutorials.html) and [code lessons](https://naif.jpl.nasa.gov/naif/lessons.html) (pick the time and coordinate-system lessons, not all of them).
- Practise (NAIF example kernels only): install spiceypy, load kernels with `furnsh`, convert UTC ↔ ET with `str2et`, get the Sun's position with `spkezr`, and express it as azimuth and elevation for a generic lat/lon point on a generic surface (a local topocentric frame via `pxform`; the NAIF frames lesson shows the pattern).
- Done when (S level): using only tutorial kernels — none of our data — you can produce the Sun's azimuth and elevation at one generic point and time, and get the same elevation within 0.01° by a second, independent route (another NAIF routine or a hand calculation). I level (agent-executed since 29 Oct): the agent runs load / time-conversion / position-vector; you read its script and output and state in one sentence which `spkpos` argument is the observer and which is the target.

## S — JPL Horizons (~1 h)

- Tutorial: [Horizons](https://ssd.jpl.nasa.gov/horizons/) web app plus its [manual](https://ssd.jpl.nasa.gov/horizons/manual.html).
- Practise: run an observer-table query for a generic point on the lunar surface (any lat/lon; Horizons' own docs show the settings), quantities azimuth and elevation, one day at 1-hour steps, for the Sun and then the Earth. Re-derive one table row with spiceypy.
- Done when: you have a one-day Sun/Earth az/el table for a generic point and can explain which settings change the numbers (observer site, frame, elevation reference, refraction off for the Moon). This is the same flow S uses to validate our ephemeris at the event.

## Q — pytest basics (~2 h)

- Tutorial: [pytest — Get Started](https://docs.pytest.org/en/stable/getting-started.html), then its pages on fixtures and `parametrize`.
- Practise: a toy module in a scratch folder — plain asserts, one fixture, one parametrized test; then break one test on purpose and read the failure diff.
- Done when: `pytest -v` is green with ≥ 5 tests including one parametrized over ≥ 3 cases, and you can explain in one sentence what a fixture is good for.

## D — Vite + React (~2.5 h)

- Tutorial: [Vite guide](https://vite.dev/guide/) (build its own counter app) and [React Learn](https://react.dev/learn) (state, rendering lists, conditional rendering).
- Practise: `npm create vite@latest` with the React template and work through the guide's own examples; then the React Learn examples with your own small components.
- Done when: the dev server hot-reloads a change you made, `npm run build` succeeds, and you can render a list from an array of objects without looking it up.

## D — Polar charts: Plotly (recommended) or D3 (~2 h, pick one)

- Plotly.js: [Getting started](https://plotly.com/javascript/getting-started/) then the [polar chart examples](https://plotly.com/javascript/polar-chart/).
- D3: [Getting started](https://d3js.org/getting-started) and the radial line in [d3-shape](https://d3js.org/d3-shape/line).
- Practise: the tutorial's own polar examples first; then plot two fake tracks with dummy numbers — angle = azimuth 0–360°, radius = elevation 0–90°, zenith in the centre if the library allows inverting the radius.
- Done when: a polar chart in the browser shows two tracks on a labelled 0–360° / 0–90° disc, built from the tutorial example plus your own dummy numbers. No decision about our app is needed now; at the event Plotly is the fast path, D3 the one with full control over custom shapes.

## I — rasterio + pyproj (~2.5 h)

- Tutorial: [rasterio quickstart](https://rasterio.readthedocs.io/en/stable/quickstart.html); [pyproj docs](https://pyproj4.github.io/pyproj/stable/) incl. the [advanced examples](https://pyproj4.github.io/pyproj/stable/advanced_examples.html).
- Practise: open the quickstart's own sample raster and read its metadata and pixel values; transform coordinates between two coordinate systems with pyproj; combine both — read the raster value at a lat/lon you picked yourself.
- Done when (agent-executed for I since 29 Oct): the agent prints the pixel value at your chosen lat/lon on the tutorial's sample GeoTIFF; you read its output and state the raster's CRS and resolution in one sentence. The real elevation tiles stay on the data computer and are only touched after approval (AGENTS.md).

---

## Ground rules

- **Isaac's tool rows are agent-executed (decided 29 Oct, see [decisions.md](decisions.md)).** The agent runs the tutorial exercises in his scratch folder; his check is understanding the output, not typing the code. Leo and Otto still own physics and code review — the human who cannot eyeball a number must never also be the one who signs it off.
- Scratch folders only; nothing in this repo except your notes on where you got stuck.
- Tutorial kernels and tutorial data only — never our sites, never our app (prep rule).
- If a done-when check fails, that is the point: write down what broke and move on; the event needs the basics, not mastery.
