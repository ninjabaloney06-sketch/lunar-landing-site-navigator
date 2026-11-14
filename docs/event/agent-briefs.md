# Agent briefs — Saturday step 0 and step 1

Copy-paste prompts for the agents on Sat 14 Nov. Written 13 Nov from [build-plan.md](build-plan.md) and ninja's mockup review (§5.1); updated 14 Nov ~11:45 with the kickoff decisions in [spec.md](spec.md) and the research in [lunar-interest-points.md](../reference/lunar-interest-points.md). Plan text only; nothing here is code.

**Handoff (14 Nov, 12:05):** step-1 orchestration moved to another device before any track was built. Read [handoff/README.md](handoff/README.md) first: ninja's decisions, device setup, pre-flight, shared contracts, agent split and brief corrections.

**Precedence:** the decisions in `spec.md` (14 Nov) override `build-plan.md`; `build-plan.md` overrides these briefs. Where they disagree, fix the brief. The 14 Nov changes that override the build plan:

| Topic | Build plan (13 Nov) | Now (spec.md, ninja 14 Nov) |
|---|---|---|
| Observer height | 2 m | **1.75 m** |
| Communications | Earth disc above the terrain mask; DSN coverage out of scope (§1) | **Line of sight to selected Earth ground stations, both ends**: station above the lunar terrain mask as seen from the site, and Moon above the station's elevation mask. **At least one** selected station = comms available. Outage inputs = `unknown`, never invented. Earth-disc visibility stays as a secondary number. |
| Stations | — | Decided: **NASA DSN** (Goldstone, Madrid, Canberra) + **ESA ESTRACK deep-space** (Cebreros, Malargüe, New Norcia); every coordinate and elevation mask with a source link. **Built: DSN + JAXA (Usuda, Uchinoura); ESTRACK left out, no sourced mask.** |
| Finder | % Earth visible, max blackout | Same thresholds, applied to **combined selected-station coverage**: 14 days, ≥ 70 % lit, ≥ 50 % coverage, gap ≤ 48 h, darkness ≤ 72 h, all adjustable; rank by coverage. Leo reviews the values in parallel |
| Demo question | Connecting Ridge, 14–28 Nov 2026 | **Shackleton Rim, 16–29 Aug 2027 UTC**: when is the site sunlit, and when can at least one selected station communicate with it? |
| Test periods | "Now" etc. | Plus the four named periods: Shackleton Rim 16–29 Aug 2027 and 12–26 Sep 2027; Malapert 21–27 Dec 2026 and 9–15 Jan 2028 (candidates, not proven best; the finder computes the real best windows) |
| Timeline colours | Sun / Earth tracks | Sun track: **yellow = lit, black = dark**. Comms track: **blue = at least one station in line of sight, dark = none, hatched = unknown**. Text labels too, never colour alone |
| Site information | Name, coordinates, slope | Plus a sourced **site potential** (water ice / cold traps, illumination, science) with evidence labels, from `lunar-interest-points.md` |
| Mandatory assessments (ninja, 14 Nov) | Thermal/access exclusions; PSR work in later steps | **Required, not bonus:** terrain slope (≤ 5° for landing; < 20° for exploration; above 5° fails landing, exactly 5° passes only the slope criterion, missing slope data leaves landing suitability unknown), surface roughness and surrounding obstacles, thermal stability, scientific value including PSRs and accessibility. Follow spec.md and the mandatory TASKS checklist; missing evidence remains unknown and the assessment stays open. |

Brief 0 (scaffold) is **done** (TASKS.md, 14 Nov 09:20): `app/` exists, contract types are in `app/src/data/types.ts`, synthetic sample JSON is in `app/public/data/` (`sites.json`, `periods.json`, `ephem/sample.json`, `horizons/sample-site.json`), not in a `sample/` folder. Start at step 1.

## Orchestrator prompt (Isaac drives every agent — 13 Nov)

Run this in **one** Claude Code session on the **Max 20x** account (check with `/usage` or the app's usage card first: it must say Max, not Pro). The Max 5x account runs a second session on the other laptop only when the orchestrator hands it a brief.

```text
Find the repo ~/Documents/clps-lunar-mission-browser and read AGENTS.md, docs/event/spec.md, docs/event/build-plan.md and docs/event/agent-briefs.md (start with its precedence table). Your job: complete build step 1 (build-plan §8) fully. Brief 0 is already done; execute A + B + C1 + C2 in parallel. Follow my global rules (CLAUDE.md) and the brief table exactly.

How to run them:
- Each brief runs as a subagent with isolation "worktree" (its own branch, never the main checkout) and the model in the model table below. Pass the shared preamble + the full brief text verbatim, plus for C1 and C2: ~/Downloads/lunar-site-navigator-mockup-v4.png, ~/Downloads/lunar-site-navigator-mockup-v4-site-menu.png, and ~/Downloads/"WhatsApp Image 2026-11-13 at 12.21.47.jpeg" (ninja's timeline reference: yellow sunlight / blue comms bars; its numbers and terrain are fictional). Do not copy these images into the repo.
- Merge order: A first (it owns the contract types and stations), then B, then C1 and C2 rebased on A + B so they switch from sample to real data.
- You are the integrator: read each subagent's report, re-run its done-checks yourself, look at its screenshots, then merge its branch into main with --no-ff. Never merge a branch whose checks you have not re-run.
- Human gates stop you: V1/V2 (Leo, 16:00), V3 (20:00), V4 + horizon go/no-go (21:30), look approval (Bene), visible wording (me). At a gate, post the evidence in one message and wait for my "yes". Do not mark any V-check passed yourself.
- Cost: Haiku for every task in the model table marked Haiku; Opus only where it says Opus; never Sonnet. Spawn a subagent only for an independent file set or a fresh-context review — never two subagents on the same files.
- Pace: call get_usage (or /usage) every hour; if the 5-hour window passes 70 %, pause the lowest-priority track (order: C2 polish → B assets → C1 polish), never A or the merge queue.
- Night shifts (ninja, 13 Nov): Isaac + Leo sleep 22:00–01:00, Otto + Bene 01:00–04:00. From 22:00 work the overnight queue in docs/event/event-plan.md — branches only, no merges, no deploys, no gate items; Otto may review, Bene may approve screenshots, only Isaac merges (from 01:00). Write one report per finished branch: checks, screenshots, open questions.
- Stop rules: build-plan §5.4 (T14 red at 21:30 → strip becomes main view) and the event-plan cut list. Feature freeze Sun 12:00.
- Step 1 is complete when: all four branches are merged with their done-checks re-run by you on main; `cd app && npm run build && npx vitest run && npx playwright test` and `python3 -m pytest scripts/tests -q` pass on main; the app answers the spec demo question (Shackleton Rim, 16–29 Aug 2027, sunlight + station coverage) from a fresh URL; basic comparison works (Shackleton ↔ Malapert same period; Shackleton Aug ↔ Sep 2027); every unvalidated number still shows "sample"; TASKS.md, BUILD_LOG.md and docs/event/ai-use-log.md are updated; main is pushed. Then write one report: what passed, what waits for Leo/Otto/Bene, what was cut.
```

### Model table (cost: Haiku where the job is mechanical or checkable by a command)

| Task | Model | Why |
|---|---|---|
| Brief 0 scaffold, folder READMEs, sample JSON | Haiku | mechanical, fully checkable by build/test commands |
| A: ephemeris.py, quaternions, stations, geometry/, windows, finder, fixtures | Opus | physics and frames; errors are silent |
| A: stations.csv (copy sourced coordinates) | Haiku | conversion with source check |
| B: site potential text (from lunar-interest-points.md + sources) | Opus | evidence wording must not overclaim |
| A: periods.py, answerSentence wording table | Haiku | small, rule-driven, tested by fixtures |
| B: horizon.py + tests T5–T8, T13 | Opus | the risky algorithm |
| B: sites.csv / sites.py (copy from sources.md), textures.py, terrain_tiles.py | Haiku | conversion scripts with size and count checks |
| C1: scene, frames, camera, debug API, T14/T16/T17 | Opus | 3D correctness |
| C1/C2: screenshot review against the reference images | Opus | visual judgement |
| C2: layout, tokens, menu, timeline, drawer | Opus first pass, Haiku for follow-up fixes the reviewer names exactly | taste on the first pass, mechanics after |
| CSV export, Playwright boilerplate, README, submission text drafts, logs | Haiku | mechanical |
| Fresh-context review of each branch before merge | Opus | one reviewer per merge, not per file |

**How to use (manual fallback if the orchestrator stalls):** paste **the shared preamble + one brief** into a fresh Claude Code session (Opus 5.5 unless the brief says otherwise) opened in that brief's worktree. Order below = least operator attention first: start 0, then A and B, then C1 and C2 once step 0 is merged. One brief per session. Only Isaac merges to `main`.

| Brief | Reviewer (human) | Model | Starts | Worktree / branch | Files it owns |
|---|---|---|---|---|---|
| 0 Scaffold | Otto | Haiku 5.5 | Sat 11:00 | main checkout, branch `step0-scaffold` | everything it creates; nothing after merge |
| A Ephemeris + stations + geometry | Leo (numbers), Otto (code) | Opus 5.5 | now (0 is done) | `../clps-wt/a`, `track-a` | `scripts/ephemeris.py`, `scripts/stations.py`, `scripts/stations.csv`, `scripts/periods.py`, `scripts/export_fixtures.py`, `scripts/tests/test_ephemeris.py`, `scripts/tests/test_stations.py`, `app/src/geometry/`, `app/src/data/types.ts` (only Track A edits it), `app/public/data/ephem/`, `app/public/data/stations.json`, `app/public/data/periods.json`, `app/src/test/fixtures.json` |
| B Horizon + sites + assets | Leo (numbers), Otto (code) | Opus 5.5 | now (0 is done) | `../clps-wt/b`, `track-b` | `scripts/horizon.py`, `scripts/sites.py`, `scripts/sites.csv`, `scripts/textures.py`, `scripts/terrain_tiles.py`, `scripts/tests/test_horizon.py`, `app/public/data/sites.json`, `app/public/data/horizons/`, `app/public/data/terrain/`, `app/public/textures/` |
| C1 3D scene | Bene (look), Leo (T14–T17) | Opus 5.5 | now (0 is done) | `../clps-wt/c1`, `track-c1` | `app/src/scene3d/`, `app/e2e/scene.spec.ts` |
| C2 Screen UI | Bene (look), Isaac (wording) | Opus 5.5 | now (0 is done) | `../clps-wt/c2`, `track-c2` | `app/src/views/`, `app/src/data/` (except `types.ts`, read-only), `app/src/state.ts`, `app/src/App.tsx`, `app/src/styles/`, `app/e2e/ui.spec.ts` |

Worktrees: `cd ~/Documents/clps-lunar-mission-browser && git worktree add ../clps-wt/a -b track-a` (same for b, c1, c2).

---

## Shared preamble (paste first, every time)

```text
You are working in the repo "Lunar Landing Site Navigator" for NASA Space Apps 2026 (local event OpenSpace Heilbronn, 14–15 Nov 2026). Hacking started Sat 14 Nov 10:30; feature freeze Sun 12:00; submission Sun 15:00.

Read before acting, in this order: AGENTS.md (rules for agents), docs/event/spec.md (kickoff decisions, 14 Nov — they override the build plan), the precedence table at the top of docs/event/agent-briefs.md, docs/event/build-plan.md sections named in your brief, then your brief below. Do not read the rest of docs/ unless the brief points there.

Facts you must not re-derive:
- Raw data root: environment variable CLPS_DATA (ninja's Mac: ~/Documents/clps-data/clps; other laptops: the USB stick's clps/ folder). Subfolders: spice/ (naif0012.tls, pck00011.tpc, de440s.bsp, moon_pa_de440_200625.bpc, moon_de440_250416.tf), lola/LDEM_80S_20MPP_ADJ.TIF (20 m/px, 80–90°S, polar stereographic, MOON_ME DE421, heights relative to 1737.4 km), illumination/ (PGDA average-illumination maps), textures/ (lroc_color_poles_4k.tif, lroc_color_poles_8k.tif, ldem_16_uint.tif, starmap_2020_4k.exr, world.200411.3x5400x2700.jpg). Never copy raw data into git.
- Frame: MOON_ME everywhere, planetocentric, east-positive longitude, sphere radius 1737.4 km. Never IAU_MOON. Units: degrees, km (metres only in names ending _m), UTC.
- Observer height 1.75 m above the terrain (spec.md; the build plan's 2 m is superseded).
- Communications = geometric line of sight to selected Earth ground stations (as built: NASA DSN + JAXA; ESTRACK not sourced), both ends; "at least one selected station" counts as covered. Missing outage/link inputs are `unknown`, never "available" and never an invented outage. Never call line of sight a guaranteed working link.
- Demo question (spec.md): Shackleton Rim, 16–29 Aug 2027 UTC — when is the site sunlit, and when can at least one selected station communicate with it?
- Azimuth: 0 = north, clockwise, degrees. Local frame at a site: up = unit(lat, lon), east = unit(z × up), north = up × east.
- Data contracts are build-plan §3 plus the station extension defined in Brief A (stations.json) and the site `potential` field in Brief B. Do not change any other field name or unit; if you think one is wrong, stop and say so.
- Sample data from step 0 lives in app/public/data/ (sites.json, periods.json, ephem/sample.json, horizons/sample-site.json); contract types in app/src/data/types.ts.
- Commit email must be 274549381+ninjabaloney06-sketch@users.noreply.github.com (check `git config user.email` first). Commit to your own branch only. Never push to main, never force-push.

Hard rules:
- Every number shown to a user must come from validated code; if it is not validated yet, the UI says "sample" next to it.
- No secrets, keys or personal data in the repo. No backend, no database, no analytics.
- Touch only the files your brief owns. Need a change elsewhere (package.json, another track's file, a contract)? Stop and write the request in your final message.
- Before finishing: run your brief's done-checks, paste their output, list every file you changed, and add one line to BUILD_LOG.md (format: "- 2026-11-14 · AI (Claude Code, device: <machine>) · <what shipped>").
- Add one line to docs/event/ai-use-log.md: time, tool + model, what it did, who ran it, and the prompt in one sentence (for a brief: its name, e.g. "Brief C1").
```

---

## Brief 0 — Scaffold (Haiku 5.5, Otto drives, ~30 min) — DONE 14 Nov 09:20, do not rerun

Kept for the record. Actual result differs slightly: sample JSON sits in `app/public/data/`, not `app/public/data/sample/`; see TASKS.md.

```text
TASK: Create the empty project skeleton so four agents can work in parallel without touching shared files afterwards. Nothing in this repo exists yet except docs/ and scripts/tools/make_pdf.py — there is no app/ and no scripts/tests/.

TRAPS (read first):
- package.json and the lockfile are frozen after this brief. Install every dependency listed below now, with exact versions (no ^ or ~), so later agents never edit package.json.
- Do not write any physics, geometry, horizon or UI logic. Stubs only.
- Sample data must be visibly fake: every sample JSON gets "sample": true at the top level.

STEPS:
1. app/: Vite + React + TypeScript (`npm create vite@latest app -- --template react-ts`), Node ≥ 22.12. Install and pin exactly: three, @types/three, d3, @types/d3, @fontsource/newsreader, @fontsource/ibm-plex-sans, @fontsource/ibm-plex-mono, vitest, @playwright/test, pixelmatch, pngjs. Run `npx playwright install chromium`.
2. Folders with a one-line README.md each: app/src/geometry, app/src/scene3d, app/src/views, app/src/data, app/src/styles, app/src/test, app/e2e, app/public/data/ephem, app/public/data/horizons, app/public/data/terrain, app/public/textures, scripts/tests.
3. app/public/data/sample/: hand-written files that match build-plan §3 exactly, with obviously fake values and "sample": true — sites.json (3 sites: Connecting Ridge -89.46, -136.68; Haworth, Malapert Massif with lat/lon copied from docs/reference/sources.md), horizons/connecting-ridge.json (720-number mask, a smooth fake ridge 0–3°), ephem/2026-11.json (n = 48 rows, 30-min steps from 2026-11-14T00:00Z, made-up vectors of the right magnitude: Sun ~1.496e8 km, Earth ~3.84e5 km, plus the two quaternion fields as identity).
4. scripts/requirements.txt pinned: spiceypy, numpy, rasterio, pyproj, pytest, Pillow, OpenEXR or imageio[freeimage] for .exr. A trivial scripts/tests/test_smoke.py that imports each.
5. LICENSE (Apache 2.0, copyright "2026 the team" — no personal names), root .gitignore adds node_modules, dist, app/test-results, .venv.
6. docs/event/ai-use-log.md copied from docs/event/ai-use-log-template.md.

DONE WHEN (paste outputs):
- `cd app && npm ci && npm run build` exits 0.
- `cd app && npx vitest run --passWithNoTests` exits 0.
- `python3 -m pytest scripts/tests -q` passes.
- `grep -R '"\^\|"~' app/package.json` prints nothing.
- `git status` shows only new files plus .gitignore.

SCOPE FENCE: no edits to docs/ except creating docs/event/ai-use-log.md and BUILD_LOG.md's one line.
HUMAN DECISION: none. Otto reviews the diff; Isaac merges.
```

---

## Brief A — Ephemeris and browser geometry (Opus 5.5, Isaac drives)

```text
TASK: Build the site-independent Sun/Earth ephemeris (Python), the Earth ground-station catalogue, the browser geometry that turns both into azimuth/elevation and station line of sight for any site (TypeScript), and the fixtures that prove Python and TypeScript agree. Spec: docs/event/spec.md (decisions, comparison periods, data-contract section), build-plan §2 (why the browser subtracts the site vector), §3 (ephem, periods, fixtures contracts), §4.1, §4.4 (windows, finder), §4.5. Step 0 is done; app/public/data/ holds sample JSON and app/src/data/types.ts the contract types (you are the only track that edits types.ts).

TRAPS (read first):
1. Frame: pass "MOON_ME" explicitly in every spkpos/pxform call. A grep for IAU_MOON in scripts/ and app/src must return nothing (test T1).
2. Correction "LT+S" for both bodies, observer MOON. Expected difference vs geometric ~0.006° for the Sun (aberration), < 0.001° for Earth. If you see ~0.07°, your frame epoch is wrong — stop and report.
3. Earth direction from a site must subtract the site vector (parallax up to 0.26°). Never use the Moon-centre direction for a surface observer.
4. Quaternions (added 13 Nov): q_me_to_j2000 = pxform("MOON_ME","J2000",et); q_earth_to_me = pxform("IAU_EARTH","MOON_ME",et - lt_earth). Store as (x, y, z, w). Interpolate with slerp in the browser, vectors linearly.
5. Earth's angular radius from the actual distance (0.90–1.02°), Sun's likewise.
6. Station position in MOON_ME at time t: s_me = earth_km(t) + R(q_earth_to_me(t)) · s_earthfixed, with s_earthfixed from the station's geodetic lat/lon/height on its stated datum (WGS84/ITRF). IAU_EARTH is used as an approximation of the terrestrial frame; say so in the output and let Leo judge the error.
7. A station is in line of sight when BOTH hold: (a) from the site, its elevation exceeds the terrain mask at its azimuth (subtract the site vector, as for Earth); (b) at the station, the Moon site's elevation above the station's local horizon (geodetic normal) is ≥ that station's min_elev_deg. Coverage = union over the selected stations; never count overlapping windows twice.
8. Elevation masks and coordinates come only from primary sources (e.g. the DSN Telecommunications Link Design Handbook 810-005, ESA ESTRACK station pages). No source for a value → leave that station out and report it; never pick a mask yourself.

STEPS:
1. scripts/ephemeris.py: load the 5 kernels from $CLPS_DATA/spice; write app/public/data/ephem/YYYY-MM.json for 2026-11 … 2030-12 at 30-min steps per §3, with kernel names + SHA-256 prefixes. Mode `--site LAT LON --start ISO --end ISO --step MIN` prints az/el table for Leo.
2. scripts/tests/test_ephemeris.py: T1 (grep), T2 (polar site: Sun within ±2°, Earth within ±8° over 2027), T3 (in every month, the maximum Sun–Earth separation seen from the Moon's centre is > 175° — that is full Moon; do not hard-code dates), interpolation check < 0.001°.
3. app/src/geometry/: pure TS, no DOM: loadMonth, interpolate(t), siteVector(lat,lon,h), enuBasis, azEl(bodyVec, site), discFraction(elev, mask, angRadius), windows(series, mask) with ±1 min bisection, finder(site, earliest, latest, missionDays, thresholds) per §4.4, answerSentence(state) (rules below).
4. scripts/export_fixtures.py → app/src/test/fixtures.json: 200 random (site from sample sites, time in 2026-11 … 2027-12) with Python az/el, visibility. app/src/geometry/*.test.ts must match within 1e-6° (T9). Also T4: a target due north has az 0, due east az 90.
5. scripts/periods.py → app/public/data/periods.json per §3 ("Now" = 14–28 Nov 2026 UTC) plus the four spec periods, each as UTC [start, end) with the final named day included: shackleton-2027-08 (2027-08-16 → 2027-08-30T00:00Z), shackleton-2027-09 (2027-09-12 → 2027-09-27), malapert-2026-12 (2026-12-21 → 2026-12-28), malapert-2028-01 (2028-01-09 → 2028-01-16). Reason text: "team candidate period, not a verified best window".
6. scripts/stations.csv (one source URL per row) → scripts/stations.py → app/public/data/stations.json: list of {id, name, network ("DSN" | "ESTRACK" | "JAXA"), complex, lat_deg, lon_deg (east-positive), h_m, datum, min_elev_deg, source_url, source_label, link_state_inputs: "unknown"}. One representative deep-space antenna per complex: Goldstone, Madrid, Canberra, Cebreros, Malargüe, New Norcia. Add the TS types to app/src/data/types.ts.
7. app/src/geometry/: stationLos(station, site, t, mask) → {az, el, moonElAtStation, state: "los" | "blocked"}; coverage(series, stationIds) → per-sample "covered" | "none" (and "unknown" only where an input is missing). windows() and finder() use coverage instead of Earth-disc visibility; Earth-disc visibility stays available as a secondary series.
8. scripts/tests/test_stations.py: a station at the sub-site point on Earth sees the Moon near 90° elevation; its antipode near −90°; union of two overlapping windows is not double-counted; a missing min_elev_deg raises instead of defaulting.

answerSentence rules (C2 renders it; Leo approves wording):
- Lit now: "Sunlight for {N} more days." (≥ 48 h → days, rounded down; < 48 h → hours). Dark now: "Dark for {N} more days." / hours.
- Covered now: "Station contact for {N} more hours/days." Not covered: "Next station contact in {N} hours/days." No selected station ever reaches the site in the period: "No selected station can reach this site in this period." Earth never rises at this site: "Earth never rises here."
- Comms wording always means geometric line of sight; the details drawer explains that a real link also needs equipment and schedules.
- Never round up; never show minutes in the sentence.

DONE WHEN (paste outputs):
- `python3 -m pytest scripts/tests/test_ephemeris.py -q` all pass.
- `cd app && npx vitest run src/geometry` all pass, including fixtures (T9) and T4.
- `python3 scripts/ephemeris.py --site -89.46 -136.68 --start 2026-11-14T00:00 --end 2026-11-15T00:00 --step 60` prints 25 rows; hand this table to Leo for V1.
- `python3 scripts/ephemeris.py --site -89.7668 -171.87 --start 2027-08-16T00:00 --end 2027-08-17T00:00 --step 60 --stations` (Shackleton Rim Site04) prints Sun/Earth az/el plus each station's Moon elevation; hand to Leo for the station check (Moon elevation at two stations vs JPL Horizons with that station as observer; Leo sets the tolerance).
- `python3 -m pytest scripts/tests/test_stations.py -q` passes; every row of stations.json has source_url and min_elev_deg (paste a one-line assertion).
- `du -sh app/public/data/ephem` ≤ 12 MB; each month ≤ 250 KB.
- `grep -rn IAU_MOON scripts app/src` prints nothing.

SCOPE FENCE: no UI, no scene3d, no horizon code. Use the sample horizon until Track B merges. No link-budget, weather or schedule modelling: those inputs stay "unknown".
HUMAN DECISION: Leo signs V1 (10 points vs JPL Horizons, < 0.05°) and V2 by 16:00, plus the station check and the IAU_EARTH approximation. Until he signs, everything you produce stays "sample" in the UI. Do not mark V1 passed yourself.
ABORT: if V1 fails by > 0.05° at 16:00 and the cause is not found by 16:30, stop and report; Isaac + Leo decide the fallback (event-plan checkpoint 1).
```

---

## Brief B — Horizon masks, sites, textures, terrain tiles (Opus 5.5, Otto drives)

```text
TASK: Produce the terrain horizon for every curated site, the sites file, the processed 3D textures and the per-site terrain tiles. Spec: docs/event/spec.md (site information, site benefits, comparison points), build-plan §3 (sites, horizons contracts), §4.2 (horizon method, in full), §4.3 (site list), §5.4 "Assets" table, docs/reference/lunar-interest-points.md (site potential rules). Step 0 is done.

TRAPS (read first):
1. Convert lat/lon to DEM x/y with the CRS read from the GeoTIFF itself (pyproj), never a hand-typed projection.
2. 720 azimuths (0.5°), rays out to 300 km (NOT 150 km — changed 13 Nov), 20 m steps to 4 km then +0.5 % per step. Elevation angle via the 3D vector formula in §4.2 step 6; that already includes curvature, so do not add a curvature correction on top.
3. Rays leaving the DEM or hitting nodata stop and go into "truncated"; never write 0 for them.
4. Do not load the 2.7 GB DEM into memory: windowed reads, near field full-res (40 × 40 km), far field decimated to 160 m (600 × 600 km box, clipped).
5. Site coordinates only from docs/reference/sources.md or docs/event/spec.md, copied exactly, with the source URL. A site with no sourced coordinates is left out, not guessed. Groups per §3: artemis-2024 first, then artemis-2022 (label "dropped in 2024"); Connecting Ridge is group "commercial", label "Blue Moon MK1 target". Required for the demo: shackleton-rim-site04 (−89.7668, −171.87) and malapert-site23 (−85.9948, −0.23578) from NASA's Lunar Surface Data Book table A2-2 (link in spec.md), new group value "reference", label "NASA reference point, not a chosen landing site"; check and record the source frame in frame_note.
6. Texture orientation: equirectangular, longitude 0 at the image centre — check with the debug test in C1 (T16), do not flip or mirror by eye.
7. Observer height is 1.75 m (spec.md), not 2 m: write observer_height_m = 1.75.
8. Site potential: only site-specific, sourced claims. Shadow is not ice; hydrogen evidence is indirect; illumination must be recomputed for the exact point. No proximity distances in step 1 (PSR footprints are not downloaded; downloading needs Isaac's approval).

STEPS:
1. scripts/tests/test_horizon.py first: T5 flat sphere → mask = −0.0813° for 1.75 m (±0.01°; dip = arccos(R/(R+h)), R = 1737.4 km); T6 single cone of known height/distance → its angle; T7 wall at a known azimuth; T8 site near 80°S yields truncated entries; T13 a 5 km cone at 200 km appears in the mask.
2. scripts/horizon.py → app/public/data/horizons/<id>.json per §3 (+ elev_m and slope_deg written back for sites.py).
3. scripts/sites.csv (hand-built from sources.md and spec.md, one URL per row) → scripts/sites.py → app/public/data/sites.json. Compute horizons for shackleton-rim-site04 and malapert-site23 first (demo and comparison sites).
3b. Add a `potential` list to each site: {category ("water-ice" | "cold-trap" | "illumination" | "science" | "other"), text (one sentence, phrased as an opportunity, with its limitation), evidence ("direct measurement" | "remote observation" | "modeled condition" | "hypothesis"), source_url}. Draw on lunar-interest-points.md and its sources; a site with no site-specific evidence gets an explicit "unknown" entry, never a generic claim. Leo reviews every entry.
4. scripts/textures.py → app/public/textures/: moon_color_4k.webp (from lroc_color_poles_4k.tif), moon_normal_2k.png (from ldem_16_uint.tif), stars_4k.jpg (tone-mapped starmap_2020_4k.exr), earth_2k.jpg (from world.200411…jpg). Each ≤ 3 MB.
5. scripts/terrain_tiles.py → app/public/data/terrain/<id>.bin + <id>.json: 40 × 40 km around each curated site, 80 m spacing, 500 × 500 Int16 heights in metres relative to the site, ENU-aligned (x east, y north), plus a 500 × 500 PNG of the PGDA average-illumination map for the "% time lit" overlay: avgvisib_85s_060m for sites south of 85°S, AVGVISIB_75S_120M for sites between 80° and 85°S (label which map and resolution in the tile JSON).

DONE WHEN (paste outputs):
- `python3 -m pytest scripts/tests/test_horizon.py -q` all pass (T5–T8, T13).
- `ls app/public/data/horizons | wc -l` equals the number of sites with horizon != null in sites.json.
- `python3 -c "import json;d=json.load(open('app/public/data/horizons/connecting-ridge.json'));print(len(d['mask']),d['ray_max_km'],min(d['mask']),max(d['mask']))"` prints 720 300 and plausible angles (−1° … +5°).
- `du -sh app/public/textures app/public/data/terrain` each ≤ 12 MB.
- Every row of sites.json has source_url, and every potential entry has source_url and evidence (one-line python assertion, paste it).
- horizons/shackleton-rim-site04.json and horizons/malapert-site23.json exist with observer_height_m 1.75.

SCOPE FENCE: no TypeScript, no UI. Do not touch ephemeris files.
HUMAN DECISION: Leo signs V3 (synthetic cases, by 20:00) and V4 (PGDA comparison, by 21:30). The 21:30 go/no-go on horizons is Leo's call, not yours.
ABORT: one site takes > 60 s or uses > 4 GB RAM → stop, report the numbers, do not lower the ray length or resolution on your own.
```

---

## Brief C1 — 3D scene (Opus 5.5, Bene drives)

```text
TASK: Build the main 3D view: a camera that orbits the selected landing site with the Sun and Earth at their true directions, plus the globe level for picking sites. Spec: build-plan §5.1 (screen, revised 13 Nov) and §5.4 (3D method, in full). Reference image: ninja will attach lunar-site-navigator-mockup-v4.png. Match its composition and mood; do not try to reproduce its fake terrain, and do not copy any code from it (there is none in this repo, and that is deliberate).

TRAPS (read first):
1. No angle maths in scene3d/: no Euler angles, no Math.sin/cos/atan, no hand-typed Matrix4 (only makeBasis with east/north/up from app/src/geometry). Positions come from geometry/; you only place objects. Otto greps for this.
2. True direction and true angular size, compressed distance: a distant body at display distance d gets radius d × tan(true angular radius). Never scale the Sun or Earth "for looks".
3. Two scenes: space scene (Moon centre, MOON_ME axes, km, logarithmicDepthBuffer) and site scene (site origin, ENU, metres). Never render 20 m terrain in the km scene.
4. Shadows are visual only. Lit/dark comes from the horizon mask (geometry). Label in the "how this is computed" text, not on screen.
5. No ambient light. One directional light = Sun. Faint fill from Earth's direction only.
6. Until Tracks A/B merge, use the sample JSON in app/public/data/; when a value is sample, C2 shows it — you just render.
7. Demo site is shackleton-rim-site04 (−89.77°, deep south: Sun and Earth sit within a few degrees of the horizon). The default view and every screenshot must also work there, not only at Connecting Ridge.

SITE LEVEL (default when a site is selected — ninja, 13 Nov):
- OrbitControls (three/examples) with target = the landing site, fixed. Default: distance 17 km, 16° above the site's horizon, vertical FOV 54°, azimuth chosen so the Sun sits ~18° left of centre (if Earth is up and fits, it lands right). Drag = circle the site; scroll = distance 2–60 km; target never moves. `E` = eye level (2 m above ground, drag to look around), `Esc` back.
- Terrain: mesh from app/public/data/terrain/<id>.bin (Track B); beyond 20 km, a ring built from horizon mask + mask_dist_km. Material: MeshStandardMaterial roughness 1, metalness 0; ACESFilmic tone mapping, sRGB output, pixel ratio ≤ 1.5, MSAA.
- Landing-site marker: a thin vertical mast standing exactly on the surface point (about 1.6 km tall at default distance, thin) plus a small cross on the ground; expose the mast-top position for C2's label. No rings, no glow, no pulsing.
- Sun: emissive disc at true size + one soft additive glow sprite, modest. Earth: textured sphere lit by the Sun so its phase is automatic, thin atmosphere rim. Stars: app/public/textures/stars_4k.jpg on an inside-out sphere rotated by q_me_to_j2000, dim.
GLOBE LEVEL (step 1 v1): textured Moon lit by the true Sun direction, pins for sites, click on surface → lat/lon event (C2 decides what to do with it), fly-in to the site level over 1.5 s (position lerp + quaternion slerp).

DEBUG API (?test=1): window.__scene = { ready: Promise, setView({site, utc, level, az, el, dist, fov}), project(name) → {x, y} in CSS px for "sun" | "earth" | "site", camera() → pose }. C2 uses project() to place labels.

DONE WHEN (paste outputs):
- `cd app && npx playwright test e2e/scene.spec.ts` passes: T14 (eye level, camera at the Sun's azimuth: projected Sun pixel within 1 px of the pinhole projection of geometry's az/el; same for Earth), T16 (debug checker texture: pin at 0°N 0°E faces +x MOON_ME, pin at 0°N 90°E at +y), T17 (mask says Sun hidden → Sun pixel dark).
- 5 screenshots at 1440 × 900 saved to app/test-results/: system (if built), globe, site default, eye level, and site default at shackleton-rim-site04 on 2027-08-16 12:00 UTC. Look at each yourself and list, per screenshot, what is wrong compared with the reference image and Bene's checklist; fix and repeat at most 3 rounds, then hand over.
- fps ≥ 30 on the ThinkPad at the site level (show the debug fps counter in ?debug=1).
- `grep -nE "Euler|Math\.(sin|cos|tan|atan)|new Matrix4\(" -r app/src/scene3d` prints nothing except makeBasis lines.

SCOPE FENCE: no HTML overlay, no text on screen, no data loading logic beyond reading files C2's data/ hands you. Stop and ask before adding any dependency.
HUMAN DECISION: Bene approves the look; his approved screenshots become the golden images (app/e2e/golden/). You never approve your own look.
ABORT (stop rule): if T14 is not green by Sat 21:30, stop; the horizon strip becomes the main view (build-plan §5.4). Report what fails.
```

---

## Brief C2 — The screen around the scene (Opus 5.5, Bene drives, Isaac reviews wording)

```text
TASK: Build everything on screen except the 3D scene: the three controls, the answer sentence, labels on objects, the timeline, the site menu and the details drawer. Spec: docs/event/spec.md (acceptance criteria UX-01–05 and basic comparison — these replace the generic UX list), build-plan §5.1 (revised 13 Nov — read every bullet), §5.2 (modules), docs/reference/lunar-interest-points.md ("Proposed nearby-interest infographic": wording rules only). Reference images: lunar-site-navigator-mockup-v4.png (main), lunar-site-navigator-mockup-v4-site-menu.png (menu open), and ninja's timeline reference (WhatsApp image: yellow sunlight bar, blue comms bar; its numbers are fictional); ninja attaches them. Match layout, type and restraint; do not copy code (none exists in the repo).

TRAPS (read first — ninja rejected the first mockup as "AI slop" for exactly these):
1. Main screen has exactly three clickable things: site name, date/time, "Find better dates". No icon chips, no pill buttons, no frosted glass, no sparkles icon, no ALL-CAPS letter-spaced labels, no floating readout card, no legend that repeats the picture.
2. Every number appears once, on its object: "Sun 1.2°" at the Sun, "Earth 4.8°" at Earth (positions from window.__scene.project). Coordinates under the site name, mono. Station names and their elevations live in the drawer, not on the main screen.
3. The answer sentence comes from geometry.answerSentence (Track A); never write your own wording. Until A merges, show the sample sentence with "sample" in the footer.
4. Colour means something: sunlight yellow oklch(86% 0.15 95), comms/Earth blue oklch(72% 0.11 245), dark = background, unknown = diagonal hatch with the text "unknown"; used identically in sentence, labels and timeline; accent ≤ 5 % of the screen. Background near-black oklch(11% 0.006 260), never #000; text oklch(94% 0.008 85), never #fff.
5. Never show the previous site's numbers under a new site's name while loading (UX-03).
6. Station selection is NOT a fourth main-screen control: it lives in the details drawer ("Stations" checklist, all six selected by default) and in the URL hash.

TOKENS: fonts Newsreader 400/500 (site name, answer), IBM Plex Sans 400/500 (UI), IBM Plex Mono 400 (numbers, coordinates, dates on the axis) via @fontsource (offline). Spacing 4 px scale. Site name 32 px, answer 32 px, UI 14 px, small 12 px. One dark bottom fade behind the answer and timeline only for legibility.

SCREEN (1440 × 900 reference; must also work at 375 px wide):
- Top left: site name (underlined, opens site menu), coordinates "89.46° S · 136.68° W", date "14 November 2026, 12:00 UTC" (underlined, opens date + time picker, UTC).
- Top right: "Find better dates" (thin outline button) → opens the finder in the details drawer (Track A's finder; defaults 14 days, ≥ 70 % lit, ≥ 50 % station coverage, coverage gap ≤ 48 h, darkness ≤ 72 h, every value editable).
- Bottom left: the answer sentence, two lines (sunlight line in yellow, station-contact line in blue).
- Bottom: timeline over the selected period (default 14 days): two 4 px tracks labelled Sun (yellow = lit, black = dark) and Comms (blue = at least one selected station in line of sight, dark = none, hatch = unknown), dates in mono below, a 1 px cursor; drag = scrub, space = play, ←/→ = 30 min, shift = 1 day.
- Footer line: "Terrain LOLA 20 m · ephemeris JPL DE440 · how this is computed" (opens sources + limits) and, while any value is sample, "sample values" on the right.
- Landing-site label: "Landing site" on a small solid dark backing at the mast top (from project("site")).
SITE MENU (per mockup): search field that also accepts typed coordinates; groups "Artemis regions, NASA 2024", "Landers", "Your points"; selected row highlighted; bottom row "Add a point: click the terrain, or type coordinates above" — DISABLED with "coming after terrain checks" until step 7 passes (never show flat-horizon numbers at the pole).
DETAILS DRAWER (opened from the answer sentence or Find better dates): horizon strip (D3 SVG, az 0–360°, el −2…+10°, exact values on hover/tap), Stations checklist with each station's current state (line of sight / blocked by terrain / Moon below station mask), finder, basic comparison (step 1: switch site and named period; results and context update together), Site potential (from sites.json `potential`: category, sentence, evidence label, source link; "access not assessed"; no distances, no scores), CSV export (step 4). A short "what comms means" line: geometric line of sight, not a guaranteed radio link. The strip is also the full fallback when WebGL is unavailable.
STATE: site, utc, period, selected stations, view, drawer, user points — all in the URL hash; a copied link reproduces the view.

DONE WHEN (paste outputs):
- On ninja's Mac only: `node ~/.claude/skills/ui/check-slop.mjs app/src` → 0 ERROR; every WARN fixed or justified in one line. On other laptops skip this line and say so; Isaac runs it before merge.
- `cd app && npx playwright test e2e/ui.spec.ts` passes: UX-01/02 (fresh browser, Shackleton Rim Site04, period shackleton-2027-08: sentence, both labels and both timeline tracks visible within 60 s, at 1440 px and 375 px), basic comparison (Shackleton ↔ Malapert same period, Shackleton Aug ↔ Sep 2027: each change shows the new answer within 10 s, never the previous site's values), UX-03 (invalid coordinates rejected with a message, never NaN; failed data load shows an error; WebGL disabled → strip + sentence still work), the main screen before any menu opens has exactly 3 buttons/links (site name, date, Find better dates) plus the timeline slider — assert with `page.getByRole('button').or(page.getByRole('link'))` count = 3 and `getByRole('slider')` count = 1, no horizontal scroll at 375 px.
- Screenshots at 1440 × 900 and 375 × 812, main and menu open, in app/test-results/. Compare with the reference images and list differences; fix, max 3 rounds, then hand over.

SCOPE FENCE: no 3D code (scene3d is C1's), no geometry maths, no wording of the answer sentence. Stop and ask before adding a dependency.
HUMAN DECISION: Bene approves the look; Isaac approves any visible wording; Leo approves every number shown (V7 before freeze).
```

---

## After each brief

Isaac: read the agent's final message, check the pasted done-outputs, look at the screenshots, then merge with `git merge --no-ff track-x` on main. Log who signed what in docs/event/validation.md.

---

## Step 2-UI — Mission layer and science goals (plan + Brief C3, written 14 Nov 13:30)

**Status: plan approved by ninja, 14 Nov ~13:34. Part 1 (ranking) built and merged 13:45 (`6dbae83`); parts 2–4 not started.** Still open before an agent runs parts 2–4: Bene's look at the plan and the three wording choices below. track-c1 and track-c2 are merged (`6218d95`, `87c438d`). Sources: the four paper pages IMG_2339–2342 (copies in git-ignored `private/notes-14nov/`), the jury answers and kickoff transcript (decisions.md), ninja's instruction of 14 Nov ("prioritise points of interest for scientists; POIs can be water, places where bacteria could grow, consistent light, anything"), build-plan §5.1 and handoff D4.

### What the paper asks for, and what is taken

| Paper | Taken as | Not taken, and why |
|---|---|---|
| Rocket button + mission name, top left (2339, 2340) | The first header control becomes the mission: rocket icon + name. It opens the Mission panel. The header keeps exactly three controls (mission, date, Find better dates). | A fourth control, and the top-right menu icon (settings sidebar removed, decided 14 Nov). |
| "Missions" dialog: name, start/end date, launch location, mission HQ, landing location, simulate (2340) | One panel in the paper's field order: Name, Start, End, **Science goal** (new), Landing site, Ground stations, Play mission. | Launch location and "Rocket flight" (parked energy/route scope, P4). No disabled button that does nothing. "NASA – Los Angeles" is a placeholder, not a station. |
| "If no mission is added: all dates, blurred model, nothing to show" (2341) | — | A fresh URL must answer the demo question within 60 s (UX-02). A default mission is always loaded. |
| Light / Com bars over dates, "Mission Time" bracket, filled = yes, line = no, click a date (2339, 2341) | The existing two-track timeline, widened to show days before and after the mission; the mission span is bracketed and full strength, the rest dimmed; clicking a date moves the cursor there. | A separate legend box: row labels and the bracket label sit on the tracks. |
| Warning "landing not recommended, terrain too steep" (2339, 2342) | One warning line above the answer sentence, from `slope_deg` against the confirmed ≤ 5° criterion. Three states: fails, passes, unknown. | The 30 m / 50 m radius: `slope_deg` comes from horizon.py on the 20 m DEM over a 100 m baseline (±50 m); the 3D mesh is 80 m. The line states the baseline it really used. |
| Landing location by coordinates or click on the Moon; camera flies there; marker (2342) | Click a site pin on the globe to select it (curated sites). The mast marker already exists. | Arbitrary coordinates stay disabled until build step 7 passes (no flat-horizon numbers at the pole). |
| Mission HQ: choose a NASA/ESA base, changes the com diagram (2341) | "Ground stations" checklist in the panel (the five sourced stations); changes the Comms track. | Picking on an Earth model: P2. |
| Mission sim from the landing site; later from Earth/HQ (2342) | "Play mission": eye level at the site, cursor to mission start, plays to the end. | View from Earth: P3. |
| Mouse: left = turn, middle = drag, wheel = zoom, right click = set landing (later) (2341) | Part 5 of the brief, after everything else passes. | Right-click placement waits for step 7. |
| "Ray tracing?" for light and comms (2341) | — | Light and line of sight come from the precomputed horizon masks; no ray tracing in the browser. |
| "Show Bene when finished, test for errors, fix" (2341) | Bene approves the look before merge, as for C1/C2. | — |

### The innovative part: start from the science, not from coordinates

Existing tools (Horizons, Moon Trek, QuickMap) start from a coordinate. Here a scientist states the mission: dates, what they want to study, which stations. The app ranks the evaluated sites for exactly that mission and shows why each one ranks where it does: sunlight and station line of sight computed for those dates, the slope check, and the sourced evidence for the science goal. This is the kickoff's own wording of the challenge ("show the differences between lunar landing sites", sunlight and a direct line of sight to Earth) and the jury's first criterion (usefulness for researchers). It needs no new data: it joins what tracks A and B already produce.

**Science goals, in priority order** (ninja: POIs come first for scientists):

| # | Goal shown | Ranks by | Data today |
|---|---|---|---|
| 1 | Water ice and volatiles | evidence tier of the site's `water-ice` entries | 18 entries: 3 remote observation, 1 hypothesis, 14 unknown |
| 2 | Cold traps (permanent shadow) | evidence tier of `cold-trap` entries | 16 entries, mostly modeled condition |
| 3 | Consistent light | our own numbers for the mission dates: % of the period sunlit, then shortest longest-darkness | computed in the browser per site and period; the strongest goal because it is date-specific |
| 4 | Science targets (geology and others) | evidence tier of `science` and `other` entries | 7 entries |
| 5 | Biology experiments ("where bacteria could grow") | **not offered until Leo supplies a primary source** for the conditions it needs (temperature range, water, radiation). Then it is a derived goal from thermal stability + light + water evidence, labelled hypothesis. | no source in the repo; the hard rule "no source → don't write it" applies. The app never says anything grows on the Moon. |
| — | Any (default) | combined station coverage, as the finder does | computed |

Evidence tiers, best first: direct measurement, remote observation, modeled condition, hypothesis, unknown. No weighted score: hard filter first (slope ≤ 5°; unknown slope kept in a separate group, never counted as a pass), then the goal's rule, ties broken by combined coverage, then % sunlit. Every row shows the values it was ranked by, so the order can be checked by hand. Wording: "best among the 18 evaluated sites for this mission", never "optimal".

### Screen plan (1440 × 900, must work at 375 px)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [rocket] Mission 1                                                        Find better dates  │
│ Connecting Ridge · 89.46° S · 136.68° W                                                      │
│ 16 – 29 August 2027 UTC                                                                      │
│                                                                                              │
│              Sun 1.2°                                         Earth 4.8°                     │
│      ~~~~~~~~~~~~~~ 3D scene (C1), drag to turn, scroll to zoom ~~~~~~~~~~~~~~               │
│                                   Landing site │                                             │
│ ! Landing not recommended: slope 31.8° over 100 m, limit 5°     (only when it fails)         │
│ Sunlight for 3 more days.                                                                    │
│ Station contact for 6 more hours.                                                            │
│ Light ░░░━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━░░░░   (cursor │)          │
│ Comms ░░░━━━       ━━━━━━━━         ━━━━━━━━━━━━        ━━━━━━━━━░░░░                        │
│        └────────────────────── Mission 1, 14 days ──────────────────┘                        │
│ 13 Aug      16 Aug      19 Aug      22 Aug      25 Aug      28 Aug      31 Aug               │
└ Terrain LOLA 20 m · ephemeris JPL DE440 · how this is computed ──────────────────────────────┘
```

- Header: three controls. (1) rocket icon + mission name opens the Mission panel; the site name, coordinates and label under it are plain text. (2) the date range opens the existing date menu. (3) Find better dates.
- A fresh URL shows the default mission: name = site name, Connecting Ridge, period `shackleton-2027-08`, all stations, goal Any. Nothing is blurred or empty.
- Mission panel: slides in from the left under the rocket button, close X top left as on the paper, title "Mission". Fields top to bottom: Name · Start · End · Science goal · Landing site (ranked list) · Ground stations · Play mission. At 375 px it is a full-height sheet.
- Landing-site rows: rank, name, group label, then four facts in mono: `lit 71 %`, `comms 54 %`, `slope 3.7°` (or `slope 31.8° — too steep`, or `slope unknown`), and the goal's evidence label with the source link. Selecting a row flies the camera to the site and updates sentence, labels and timeline together.
- Timeline: tracks labelled Light and Comms (wording to confirm, today "Sun" and "Comms"); three context days before and after the mission, dimmed; mission bracket with the mission name and length; clicking a date label moves the cursor to that day 12:00 UTC.
- Warning line: only when the selected site fails the slope criterion. Passing and unknown states appear in the panel row and the details drawer, not on the main screen.
- Details drawer: unchanged (horizon strip, finder, comparison, site potential, sources). The stations checklist moves into the Mission panel and stays reachable from the drawer by a link, so there is one checklist, not two.

### Wording and decisions only ninja can make (before the agent starts)

**Decided by ninja, 14 Nov 13:47 (answers given in the step-1 integrator session):** (2) track labels "Light / Comms" — ninja wrote "light/communicatoin"; read as the offered option, "Communication" spelled out is a one-string change if he meant that; (3) date display "16 Aug 2027"; (4) `ionicons` may be added at an exact pinned version. Point 1 (the plan itself) is taken as yes, because he answered the three follow-up choices and asked for the work to start.

**Revised 14 Nov 15:01 (ninja + Bene, built and merged):** the header has 4 controls: mission, date, Find better dates and a gear button "Details" that opens the details drawer. The answer sentences are no longer a control: they are one small line above the timeline tracks. TRAP 1 and the screen plan above still say 3 controls and show the large sentences; this line overrides them. Bene approved the UI look; his terrain-detail criticism is handled on branch `track-terrain`.

**Parts 2–4 merged 14 Nov 14:32 (`06a7393`, branch `track-c3`):** the resource lock is released. Part 5 (middle-button pan) is not started and still needs ninja's go. Open after the merge: Bene's look approval, ninja's yes on the strings, Leo's validation. Decided by ninja 14 Nov ~14:33 and built on main: the default mission name is "Mission 1" (not the site name) and the default science goal is "Consistent light" (not "Any"); both live in app/src/state.ts as DEFAULT_MISSION_NAME and DEFAULT_GOAL.

1. ~~Yes or no to this plan~~ — **yes** (ninja, 14 Nov): panel instead of the paper dialog; launch location, rocket flight and the empty start state are dropped.
2. Track labels: "Light / Comms" (paper) or keep "Sun / Comms".
3. Date display in the panel: "16 Aug 2027" (recommended, cannot be misread) or the paper's MM.DD.YYYY, or DD.MM.YYYY. Data and URL stay ISO 8601 UTC.
4. Icons: add the `ionicons` package (exact pin, MIT, one rocket and one warning outline) — a new dependency needs your yes. Without it the control reads "Mission" as text.

### Brief C3 — paste into a fresh Claude Code session (Opus 5.5, L2; Bene drives, Isaac approves wording)

```text
Repo: /Users/Guest123/Documents/clps-lunar-mission-browser (GitHub ninjabaloney06-sketch/lunar-landing-site-navigator, branch main). Read first, in this order: AGENTS.md; docs/event/agent-briefs.md sections "Shared preamble", "Brief C2" and "Step 2-UI" (the plan above this prompt: tables, screen plan, science goals); docs/event/spec.md (UX-01–05, mandatory site assessments, conditional extras P2); docs/event/handoff/README.md §3 (D4, D5) and the two contracts in §4. Then Read the four paper pages private/notes-14nov/2339.jpg, 2340.jpg, 2341.jpg, 2342.jpg as images. They are intent, not layout to copy: where the paper and the plan differ, the plan wins.

TASK: add the Mission layer and science-goal site ranking to the existing app. Five parts, in this order, each committed separately on branch `track-c3` in your own worktree.

START CONDITION (check, do not assume): `git branch --merged main` lists both track-c1 and track-c2 (both merged 14 Nov: track-c2 87c438d, track-c1 6218d95). If either is missing, stop and report: C1 owns app/src/scene3d/ and C2 owns app/src/views/, app/src/state.ts, app/src/App.tsx, app/src/styles/ and app/e2e/ui.spec.ts until they are merged. Part 1 alone may start earlier (it only adds files under app/src/geometry/, free since track A merged as a4bd092).

ALREADY DONE — do not rebuild (state on 14 Nov 13:30): geometry, windows, summarize, finder, answerSentence (track A, merged a4bd092); horizons with slope_deg for all 18 sites and site_potential.json with 56 evidence-labelled entries (track B, merged a92cdfd); app/public/data/sites.json carries slope_deg, label and potential per site; stations.json has goldstone, madrid, canberra, usuda, uchinoura (e0b5704). C2's branch (614bba0) has SiteMenu, DateMenu, Drawer, Finder, Compare, HorizonStrip, Timeline, SceneView, URL-hash state in app/src/state.ts, tokens in app/src/styles/tokens.css and 20 Playwright tests in app/e2e/ui.spec.ts. Extend these files; do not create parallel versions.

TRAPS (read before coding):
1. The header has exactly three controls after your change too: mission (rocket + name), date, Find better dates. The D4 test in app/e2e/ui.spec.ts counts them; update its selector for the first control, not its counts (3 in the header, 5 on the main screen, 1 slider).
2. A fresh URL must still answer the demo question (Connecting Ridge, period shackleton-2027-08) with no panel open. Never an empty, blurred or "create a mission" start state.
3. No invented numbers. Every ranked value comes from summarize() for the mission's own dates and stations, from sites.json slope_deg, or from a potential entry with its source_url. A site with no entry for the chosen goal ranks as "unknown" and says so.
4. Slope: ≤ 5.0 passes the slope criterion only; > 5.0 fails; null or missing = unknown, shown in a separate group and never counted as a pass. The text says "passes the 5° slope limit", never "safe to land". State the baseline the number was computed on (read it from the horizon file / scripts/horizon.py; if you cannot find it, write "baseline not stated" and report it — do not write 30 m or 50 m from the paper).
5. No weighted score. Order = hard filter, then the goal rule from the plan table, then combined coverage, then % sunlit. Ties stay visible as ties.
6. Wording: "station line of sight" or "station contact" as answerSentence already says it; never "active link" or "connection guaranteed". "Best among the evaluated sites for this mission", never "optimal" or "best site on the Moon". The goal "Biology experiments" is NOT built unless ninja says Leo has delivered the source.
7. Taste rules that got the first mockup rejected: no frosted glass, no pill chips with icons, no ALL-CAPS tracked labels, no legend box, no number shown twice on the main screen, accent colour ≤ 5 % of the screen. Sunlight yellow and comms blue are the tokens already in tokens.css; the warning uses text colour plus the icon, not a red filled box.
8. Never show the previous site's values under a new site's name while results load (UX-03). Ranking 18 sites is async: show the list with "computing" per row, fill rows as they finish, keep the selected site usable meanwhile.
9. VALIDATED in app/src/data/validation.ts is false. Leave it. Everything you show keeps the existing "sample values — not validated" footer until Leo signs.

PART 1 — ranking: DONE, merged 14 Nov as 6dbae83 (app/src/geometry/rankSites.ts, 14 tests). Do not rebuild; import rankSites from '../geometry'. Known behaviour to respect in the UI: ties use exact values, not displayed ones; for goals 'water-ice' and 'science' most sites share a tier, so the order is mostly decided by coverage — the panel must say "then by station coverage" next to such rows. Original contract, for reference:
  type ScienceGoal = 'any' | 'water-ice' | 'cold-trap' | 'light' | 'science'
  type SlopeState = 'pass' | 'fail' | 'unknown'
  interface RankedSite { siteId; rank: number | null; slope: SlopeState; slopeDeg: number | null; litPct; coveragePct; longestDarkH; longestGapH; goalEvidence: SitePotential['evidence'] | null; goalSourceUrl: string | null; tiedWith: string[] }
  rankSites(rows: { site: Site; summary: Summary | null }[], goal: ScienceGoal): { ranked: RankedSite[]; failed: RankedSite[]; unknown: RankedSite[] }
  'science' reads categories 'science' and 'other'. summary null (no ephemeris or horizon) → unknown group.
  Tests: a passing site, slope exactly 5.0 (pass), 5.1 (fail), null (unknown), a tie, a goal with no entry, every site failing (ranked = []), 'light' ordering by litPct then longestDarkH.
PART 2 — state and header: add to the URL hash `name` (mission name, max 40 chars, plain text, default = site name) and `goal` (ScienceGoal, default 'any'); invalid values fall back to defaults like the other keys. Header control 1 becomes rocket icon + mission name; site name, coordinates and label move to plain text below it.
PART 3 — Mission panel: extend views/SiteMenu.tsx into views/MissionPanel.tsx (rename, keep its tests passing): fields Name, Start, End (reuse DateMenu's validation and the supported range in state.ts), Science goal (5 radio rows incl. Any, or 4 + Any), Landing site (rankSites output: ranked, then "Too steep to land (slope above 5°)", then "Not enough data"), Ground stations (move the checklist component out of Drawer.tsx, leave a link there), Play mission (view 'eye', cursor = mission start, play). Clicking a site pin on the globe selects that site (SceneHandle.onPick → nearest curated site within the pin radius; no arbitrary coordinates).
PART 4 — timeline and warning: Timeline gets contextDays = 3 on each side (clipped to coverage), dimmed outside the mission, a bracket with "<mission name>, <n> days", date labels clickable (cursor → that day 12:00 UTC). Warning line above the answer sentence only when the selected site's slope fails: "Landing not recommended: slope <x>° over <baseline>, limit 5°".
PART 5 — only if parts 1–4 pass and ninja says go: middle-button drag pans in app/src/scene3d/ (left drag and wheel unchanged, touch unchanged). No right-click placement.

DONE WHEN (paste every output in the final report):
- `cd app && npx vitest run` passes, including rankSites.test.ts (≥ 8 cases above).
- `cd app && PW_PORT=5183 npx playwright test e2e/ui.spec.ts` passes with all pre-existing tests still green plus new ones: (a) fresh URL shows the answer with no panel open at 1440 and 375 px; (b) header count 3 / main screen 5 / slider 1 / no horizontal scroll at 375 px; (c) opening the panel, choosing goal "Consistent light" and period shackleton-2027-09 lists all 18 site ids exactly once across the three groups, and the first ranked row's lit % equals summarize() for that site and period to display precision; (d) selecting shackleton-rim-site04 (slope_deg 31.8) shows the warning line, selecting connecting-ridge (3.7) does not; (e) a copied URL restores name and goal; (f) a name containing <script> renders as text.
- `cd app && npm run build` passes; `node ~/.claude/skills/ui/check-slop.mjs app/src` → 0 ERROR, every WARN fixed or justified in one line.
- Screenshots in app/test-results/: main and panel open, at 1440 × 900 and 375 × 812. Read them yourself, compare with the screen plan and the paper pages, list every difference, fix, at most 3 rounds.
- `git diff --stat main...track-c3` touches only: app/src/geometry/rankSites*.ts, app/src/geometry/index.ts (one re-export), app/src/state.ts, app/src/App.tsx, app/src/views/, app/src/styles/, app/e2e/ui.spec.ts, and for part 5 app/src/scene3d/ + app/e2e/scene.spec.ts.

SCOPE FENCE: no change to scripts/, app/public/data/, app/src/data/types.ts, answerSentence wording, finder defaults or VALIDATED. No launch location, rocket flight, Earth-view, settings menu, arbitrary coordinates, language switch or new site data. No new dependency without ninja's yes (see human decisions). Do not edit BUILD_LOG.md, TASKS.md or docs/event/ai-use-log.md: put the exact BUILD_LOG line and ai-use-log row in your final report; the integrator writes them on main.

HUMAN DECISIONS — already made by ninja on 14 Nov 13:47, do not ask again: (1) track labels "Light" and "Comms"; (2) dates in the panel as "16 Aug 2027"; (3) add `ionicons` at an exact pinned version (MIT) for the rocket and warning icons. Bene approves the look from the screenshots; ninja approves every visible string; Leo approves the numbers.

AUTHORIZATION AND ABORT: running this prompt authorizes commits on track-c3 in your worktree only. Never merge into main, never push, never deploy. If a pre-existing test fails before you change anything, stop and report it with the output. If part 3 is not green after 3 fix rounds, hand over parts 1–2 (and 4 if it stands alone) and report what is missing; do not ship a half-working panel.

RESOURCE LOCK: must not run while any other agent edits app/src/views/, app/src/state.ts, app/src/App.tsx or app/e2e/ui.spec.ts (C2 until merged; the UI–pipeline integration task if it touches App.tsx). Use Playwright port 5183.

FINAL REPORT: branch, worktree path, SHA per part; each done-check with pasted output; screenshot paths; list of visible strings added; differences from the plan; BUILD_LOG line and ai-use-log row (with its prompt cell); open items for Leo (numbers, slope baseline), Bene (look), ninja (wording).
```
