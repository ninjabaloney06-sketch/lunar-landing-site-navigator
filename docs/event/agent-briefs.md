# Agent briefs — Saturday step 0 and step 1

Copy-paste prompts for the agents on Sat 14 Nov. Written 13 Nov from [build-plan.md](build-plan.md) (the spec) and ninja's mockup review (§5.1). Plan text only; nothing here is code. If a brief and the build plan disagree, the build plan wins; fix the brief.

## Orchestrator prompt (Isaac drives every agent — 13 Nov)

Run this in **one** Claude Code session on the **Max 20x** account (check with `/usage` or the app's usage card first: it must say Max, not Pro). The Max 5x account runs a second session on the other laptop only when the orchestrator hands it a brief.

```text
Find the repo ~/Documents/clps-lunar-mission-browser and read AGENTS.md, docs/event/build-plan.md and docs/event/agent-briefs.md. Execute the briefs in this order: 0, then A + B + C1 + C2 in parallel. Follow my global rules (CLAUDE.md) and the brief table exactly.

How to run them:
- Each brief runs as a subagent with isolation "worktree" (its own branch, never the main checkout) and the model in the model table below. Pass the shared preamble + the full brief text verbatim, plus the two mockup PNGs from ~/Downloads for C1 and C2.
- You are the integrator: read each subagent's report, re-run its done-checks yourself, look at its screenshots, then merge its branch into main with --no-ff. Never merge a branch whose checks you have not re-run.
- Human gates stop you: V1/V2 (Leo, 16:00), V3 (20:00), V4 + horizon go/no-go (22:00), look approval (Bene), visible wording (me). At a gate, post the evidence in one message and wait for my "yes". Do not mark any V-check passed yourself.
- Cost: Haiku for every task in the model table marked Haiku; Opus only where it says Opus; never Sonnet. Spawn a subagent only for an independent file set or a fresh-context review — never two subagents on the same files.
- Pace: call get_usage (or /usage) every hour; if the 5-hour window passes 70 %, pause the lowest-priority track (order: C2 polish → B assets → C1 polish), never A or the merge queue.
- Overnight (from ~22:45 until 07:30): keep working on the overnight queue in docs/event/event-plan.md ("Overnight" section) — branches only, no merges, no deploys, no gate items; write one morning report listing each branch, its checks and its screenshots.
- Stop rules: build-plan §5.4 (T14 red at 22:00 → strip becomes main view) and the event-plan cut list. Feature freeze Sun 12:00.
```

### Model table (cost: Haiku where the job is mechanical or checkable by a command)

| Task | Model | Why |
|---|---|---|
| Brief 0 scaffold, folder READMEs, sample JSON | Haiku | mechanical, fully checkable by build/test commands |
| A: ephemeris.py, quaternions, geometry/, windows, finder, fixtures | Opus | physics and frames; errors are silent |
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
| A Ephemeris + geometry | Leo (numbers), Otto (code) | Opus 5.5 | after 0 merged | `../clps-wt/a`, `track-a` | `scripts/ephemeris.py`, `scripts/periods.py`, `scripts/export_fixtures.py`, `scripts/tests/test_ephemeris.py`, `app/src/geometry/`, `app/public/data/ephem/`, `app/public/data/periods.json`, `app/src/test/fixtures.json` |
| B Horizon + assets | Leo (numbers), Otto (code) | Opus 5.5 | after 0 merged | `../clps-wt/b`, `track-b` | `scripts/horizon.py`, `scripts/sites.py`, `scripts/sites.csv`, `scripts/textures.py`, `scripts/terrain_tiles.py`, `scripts/tests/test_horizon.py`, `app/public/data/sites.json`, `app/public/data/horizons/`, `app/public/data/terrain/`, `app/public/textures/` |
| C1 3D scene | Bene (look), Leo (T14–T17) | Opus 5.5 | after 0 merged | `../clps-wt/c1`, `track-c1` | `app/src/scene3d/`, `app/e2e/scene.spec.ts` |
| C2 Screen UI | Bene (look), Isaac (wording) | Opus 5.5 | after 0 merged | `../clps-wt/c2`, `track-c2` | `app/src/views/`, `app/src/data/`, `app/src/state.ts`, `app/src/App.tsx`, `app/src/styles/`, `app/e2e/ui.spec.ts` |

Worktrees: `cd ~/Documents/clps-lunar-mission-browser && git worktree add ../clps-wt/a -b track-a` (same for b, c1, c2), after brief 0 is merged.

---

## Shared preamble (paste first, every time)

```text
You are working in the repo "Lunar Landing Site Navigator" for NASA Space Apps 2026 (local event OpenSpace Heilbronn, 14–15 Nov 2026). Hacking started Sat 14 Nov 10:30; feature freeze Sun 12:00; submission Sun 15:00.

Read before acting, in this order: AGENTS.md (rules for agents), docs/event/build-plan.md sections named in your brief (this is the spec), then your brief below. Do not read the rest of docs/ unless the brief points there.

Facts you must not re-derive:
- Raw data root: environment variable CLPS_DATA (ninja's Mac: ~/Documents/clps-data/clps; other laptops: the USB stick's clps/ folder). Subfolders: spice/ (naif0012.tls, pck00011.tpc, de440s.bsp, moon_pa_de440_200625.bpc, moon_de440_250416.tf), lola/LDEM_80S_20MPP_ADJ.TIF (20 m/px, 80–90°S, polar stereographic, MOON_ME DE421, heights relative to 1737.4 km), illumination/ (PGDA average-illumination maps), textures/ (lroc_color_poles_4k.tif, lroc_color_poles_8k.tif, ldem_16_uint.tif, starmap_2020_4k.exr, world.200411.3x5400x2700.jpg). Never copy raw data into git.
- Frame: MOON_ME everywhere, planetocentric, east-positive longitude, sphere radius 1737.4 km. Never IAU_MOON. Units: degrees, km (metres only in names ending _m), UTC.
- Azimuth: 0 = north, clockwise, degrees. Local frame at a site: up = unit(lat, lon), east = unit(z × up), north = up × east.
- Data contracts are build-plan §3. Do not change a field name or unit; if you think one is wrong, stop and say so.
- Commit email must be 274549381+ninjabaloney06-sketch@users.noreply.github.com (check `git config user.email` first). Commit to your own branch only. Never push to main, never force-push.

Hard rules:
- Every number shown to a user must come from validated code; if it is not validated yet, the UI says "sample" next to it.
- No secrets, keys or personal data in the repo. No backend, no database, no analytics.
- Touch only the files your brief owns. Need a change elsewhere (package.json, another track's file, a contract)? Stop and write the request in your final message.
- Before finishing: run your brief's done-checks, paste their output, list every file you changed, and add one line to BUILD_LOG.md (format: "- 2026-11-14 · AI (Claude Code, device: <machine>) · <what shipped>").
- Add one line to docs/event/ai-use-log.md: time, tool + model, what it did, who ran it.
```

---

## Brief 0 — Scaffold (Haiku 5.5, Otto drives, ~30 min)

```text
TASK: Create the empty project skeleton so four agents can work in parallel without touching shared files afterwards. Nothing in this repo exists yet except docs/ and scripts/make_pdf.py — there is no app/ and no scripts/tests/.

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
TASK: Build the site-independent Sun/Earth ephemeris (Python), the browser geometry that turns it into azimuth/elevation for any site (TypeScript), and the fixtures that prove both agree. Spec: build-plan §2 (why the browser subtracts the site vector), §3 (ephem, periods, fixtures contracts), §4.1, §4.4 (windows, finder), §4.5. Step 0 is merged; app/public/data/sample/ shows the JSON shapes.

TRAPS (read first):
1. Frame: pass "MOON_ME" explicitly in every spkpos/pxform call. A grep for IAU_MOON in scripts/ and app/src must return nothing (test T1).
2. Correction "LT+S" for both bodies, observer MOON. Expected difference vs geometric ~0.006° for the Sun (aberration), < 0.001° for Earth. If you see ~0.07°, your frame epoch is wrong — stop and report.
3. Earth direction from a site must subtract the site vector (parallax up to 0.26°). Never use the Moon-centre direction for a surface observer.
4. Quaternions (added 13 Nov): q_me_to_j2000 = pxform("MOON_ME","J2000",et); q_earth_to_me = pxform("IAU_EARTH","MOON_ME",et - lt_earth). Store as (x, y, z, w). Interpolate with slerp in the browser, vectors linearly.
5. Earth's angular radius from the actual distance (0.90–1.02°), Sun's likewise.

STEPS:
1. scripts/ephemeris.py: load the 5 kernels from $CLPS_DATA/spice; write app/public/data/ephem/YYYY-MM.json for 2026-11 … 2030-12 at 30-min steps per §3, with kernel names + SHA-256 prefixes. Mode `--site LAT LON --start ISO --end ISO --step MIN` prints az/el table for Leo.
2. scripts/tests/test_ephemeris.py: T1 (grep), T2 (polar site: Sun within ±2°, Earth within ±8° over 2027), T3 (in every month, the maximum Sun–Earth separation seen from the Moon's centre is > 175° — that is full Moon; do not hard-code dates), interpolation check < 0.001°.
3. app/src/geometry/: pure TS, no DOM: loadMonth, interpolate(t), siteVector(lat,lon,h), enuBasis, azEl(bodyVec, site), discFraction(elev, mask, angRadius), windows(series, mask) with ±1 min bisection, finder(site, earliest, latest, missionDays, thresholds) per §4.4, answerSentence(state) (rules below).
4. scripts/export_fixtures.py → app/src/test/fixtures.json: 200 random (site from sample sites, time in 2026-11 … 2027-12) with Python az/el, visibility. app/src/geometry/*.test.ts must match within 1e-6° (T9). Also T4: a target due north has az 0, due east az 90.
5. scripts/periods.py → app/public/data/periods.json per §3 ("Now" = 14–28 Nov 2026 UTC).

answerSentence rules (C2 renders it; Leo approves wording):
- Lit now: "Sunlight for {N} more days." (≥ 48 h → days, rounded down; < 48 h → hours). Dark now: "Dark for {N} more days." / hours.
- Earth up: "Earth sets in {N} hours/days." Earth down: "Earth rises in {N} …". Earth never rises at this site: "Earth never rises here."
- Never round up; never show minutes in the sentence.

DONE WHEN (paste outputs):
- `python3 -m pytest scripts/tests/test_ephemeris.py -q` all pass.
- `cd app && npx vitest run src/geometry` all pass, including fixtures (T9) and T4.
- `python3 scripts/ephemeris.py --site -89.46 -136.68 --start 2026-11-14T00:00 --end 2026-11-15T00:00 --step 60` prints 25 rows; hand this table to Leo for V1.
- `du -sh app/public/data/ephem` ≤ 12 MB; each month ≤ 250 KB.
- `grep -rn IAU_MOON scripts app/src` prints nothing.

SCOPE FENCE: no UI, no scene3d, no horizon code. Use the sample horizon until Track B merges.
HUMAN DECISION: Leo signs V1 (10 points vs JPL Horizons, < 0.05°) and V2 by 16:00. Until he signs, everything you produce stays "sample" in the UI. Do not mark V1 passed yourself.
ABORT: if V1 fails by > 0.05° at 16:00 and the cause is not found by 16:30, stop and report; Isaac + Leo decide the fallback (event-plan checkpoint 1).
```

---

## Brief B — Horizon masks, sites, textures, terrain tiles (Opus 5.5, Otto drives)

```text
TASK: Produce the terrain horizon for every curated site, the sites file, the processed 3D textures and the per-site terrain tiles. Spec: build-plan §3 (sites, horizons contracts), §4.2 (horizon method, in full), §4.3 (site list), §5.4 "Assets" table. Step 0 is merged.

TRAPS (read first):
1. Convert lat/lon to DEM x/y with the CRS read from the GeoTIFF itself (pyproj), never a hand-typed projection.
2. 720 azimuths (0.5°), rays out to 300 km (NOT 150 km — changed 13 Nov), 20 m steps to 4 km then +0.5 % per step. Elevation angle via the 3D vector formula in §4.2 step 6; that already includes curvature, so do not add a curvature correction on top.
3. Rays leaving the DEM or hitting nodata stop and go into "truncated"; never write 0 for them.
4. Do not load the 2.7 GB DEM into memory: windowed reads, near field full-res (40 × 40 km), far field decimated to 160 m (600 × 600 km box, clipped).
5. Site coordinates only from docs/reference/sources.md, copied exactly, with the source URL. A site with no sourced coordinates is left out, not guessed. Groups per §3: artemis-2024 first, then artemis-2022 (label "dropped in 2024"); Connecting Ridge is group "commercial", label "Blue Moon MK1 target".
6. Texture orientation: equirectangular, longitude 0 at the image centre — check with the debug test in C1 (T16), do not flip or mirror by eye.

STEPS:
1. scripts/tests/test_horizon.py first: T5 flat sphere → mask = −0.087° for 2 m (±0.01°); T6 single cone of known height/distance → its angle; T7 wall at a known azimuth; T8 site near 80°S yields truncated entries; T13 a 5 km cone at 200 km appears in the mask.
2. scripts/horizon.py → app/public/data/horizons/<id>.json per §3 (+ elev_m and slope_deg written back for sites.py).
3. scripts/sites.csv (hand-built from sources.md, one URL per row) → scripts/sites.py → app/public/data/sites.json.
4. scripts/textures.py → app/public/textures/: moon_color_4k.webp (from lroc_color_poles_4k.tif), moon_normal_2k.png (from ldem_16_uint.tif), stars_4k.jpg (tone-mapped starmap_2020_4k.exr), earth_2k.jpg (from world.200411…jpg). Each ≤ 3 MB.
5. scripts/terrain_tiles.py → app/public/data/terrain/<id>.bin + <id>.json: 40 × 40 km around each curated site, 80 m spacing, 500 × 500 Int16 heights in metres relative to the site, ENU-aligned (x east, y north), plus a 500 × 500 PNG of the PGDA average-illumination map for the "% time lit" overlay: avgvisib_85s_060m for sites south of 85°S, AVGVISIB_75S_120M for sites between 80° and 85°S (label which map and resolution in the tile JSON).

DONE WHEN (paste outputs):
- `python3 -m pytest scripts/tests/test_horizon.py -q` all pass (T5–T8, T13).
- `ls app/public/data/horizons | wc -l` equals the number of sites with horizon != null in sites.json.
- `python3 -c "import json;d=json.load(open('app/public/data/horizons/connecting-ridge.json'));print(len(d['mask']),d['ray_max_km'],min(d['mask']),max(d['mask']))"` prints 720 300 and plausible angles (−1° … +5°).
- `du -sh app/public/textures app/public/data/terrain` each ≤ 12 MB.
- Every row of sites.json has source_url (check with a one-line python assertion, paste it).

SCOPE FENCE: no TypeScript, no UI. Do not touch ephemeris files.
HUMAN DECISION: Leo signs V3 (synthetic cases, by 20:00) and V4 (PGDA comparison, by 22:00). The 22:00 go/no-go on horizons is Leo's call, not yours.
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
6. Until Tracks A/B merge, use app/public/data/sample/; when a value is sample, C2 shows it — you just render.

SITE LEVEL (default when a site is selected — ninja, 13 Nov):
- OrbitControls (three/examples) with target = the landing site, fixed. Default: distance 17 km, 16° above the site's horizon, vertical FOV 54°, azimuth chosen so the Sun sits ~18° left of centre (if Earth is up and fits, it lands right). Drag = circle the site; scroll = distance 2–60 km; target never moves. `E` = eye level (2 m above ground, drag to look around), `Esc` back.
- Terrain: mesh from app/public/data/terrain/<id>.bin (Track B); beyond 20 km, a ring built from horizon mask + mask_dist_km. Material: MeshStandardMaterial roughness 1, metalness 0; ACESFilmic tone mapping, sRGB output, pixel ratio ≤ 1.5, MSAA.
- Landing-site marker: a thin vertical mast standing exactly on the surface point (about 1.6 km tall at default distance, thin) plus a small cross on the ground; expose the mast-top position for C2's label. No rings, no glow, no pulsing.
- Sun: emissive disc at true size + one soft additive glow sprite, modest. Earth: textured sphere lit by the Sun so its phase is automatic, thin atmosphere rim. Stars: app/public/textures/stars_4k.jpg on an inside-out sphere rotated by q_me_to_j2000, dim.
GLOBE LEVEL (step 1 v1): textured Moon lit by the true Sun direction, pins for sites, click on surface → lat/lon event (C2 decides what to do with it), fly-in to the site level over 1.5 s (position lerp + quaternion slerp).

DEBUG API (?test=1): window.__scene = { ready: Promise, setView({site, utc, level, az, el, dist, fov}), project(name) → {x, y} in CSS px for "sun" | "earth" | "site", camera() → pose }. C2 uses project() to place labels.

DONE WHEN (paste outputs):
- `cd app && npx playwright test e2e/scene.spec.ts` passes: T14 (eye level, camera at the Sun's azimuth: projected Sun pixel within 1 px of the pinhole projection of geometry's az/el; same for Earth), T16 (debug checker texture: pin at 0°N 0°E faces +x MOON_ME, pin at 0°N 90°E at +y), T17 (mask says Sun hidden → Sun pixel dark).
- 4 screenshots at 1440 × 900 saved to app/test-results/: system (if built), globe, site default, eye level. Look at each yourself and list, per screenshot, what is wrong compared with the reference image and Bene's checklist; fix and repeat at most 3 rounds, then hand over.
- fps ≥ 30 on the ThinkPad at the site level (show the debug fps counter in ?debug=1).
- `grep -nE "Euler|Math\.(sin|cos|tan|atan)|new Matrix4\(" -r app/src/scene3d` prints nothing except makeBasis lines.

SCOPE FENCE: no HTML overlay, no text on screen, no data loading logic beyond reading files C2's data/ hands you. Stop and ask before adding any dependency.
HUMAN DECISION: Bene approves the look; his approved screenshots become the golden images (app/e2e/golden/). You never approve your own look.
ABORT (stop rule): if T14 is not green by Sat 22:00, stop; the horizon strip becomes the main view (build-plan §5.4). Report what fails.
```

---

## Brief C2 — The screen around the scene (Opus 5.5, Bene drives, Isaac reviews wording)

```text
TASK: Build everything on screen except the 3D scene: the three controls, the answer sentence, labels on objects, the timeline, the site menu and the details drawer. Spec: build-plan §5.1 (revised 13 Nov — read every bullet), §5.2 (modules), UX-01–05 in docs/reference/existing-tools.md. Reference images: lunar-site-navigator-mockup-v4.png (main) and lunar-site-navigator-mockup-v4-site-menu.png (menu open); ninja attaches them. Match layout, type and restraint; do not copy code (none exists in the repo).

TRAPS (read first — ninja rejected the first mockup as "AI slop" for exactly these):
1. Main screen has exactly three clickable things: site name, date/time, "Find better dates". No icon chips, no pill buttons, no frosted glass, no sparkles icon, no ALL-CAPS letter-spaced labels, no floating readout card, no legend that repeats the picture.
2. Every number appears once, on its object: "Sun 1.2°" at the Sun, "Earth 4.8°" at Earth (positions from window.__scene.project). Coordinates under the site name, mono.
3. The answer sentence comes from geometry.answerSentence (Track A); never write your own wording. Until A merges, show the sample sentence with "sample" in the footer.
4. Colour means something: Sun amber oklch(80% 0.13 70), Earth blue oklch(72% 0.11 245), used identically in sentence, labels and timeline; accent ≤ 5 % of the screen. Background near-black oklch(11% 0.006 260), never #000; text oklch(94% 0.008 85), never #fff.
5. Never show the previous site's numbers under a new site's name while loading (UX-03).

TOKENS: fonts Newsreader 400/500 (site name, answer), IBM Plex Sans 400/500 (UI), IBM Plex Mono 400 (numbers, coordinates, dates on the axis) via @fontsource (offline). Spacing 4 px scale. Site name 32 px, answer 32 px, UI 14 px, small 12 px. One dark bottom fade behind the answer and timeline only for legibility.

SCREEN (1440 × 900 reference; must also work at 375 px wide):
- Top left: site name (underlined, opens site menu), coordinates "89.46° S · 136.68° W", date "14 November 2026, 12:00 UTC" (underlined, opens date + time picker, UTC).
- Top right: "Find better dates" (thin outline button) → opens the finder in the details drawer (Track A's finder; defaults 14 days, ≥ 70 % lit, ≥ 50 % Earth, blackout ≤ 48 h, darkness ≤ 72 h, every value editable).
- Bottom left: the answer sentence, two lines ("Sunlight" in amber, "Earth" in blue).
- Bottom: timeline 14 days: two 4 px tracks labelled Sun and Earth, dates in mono below, a 1 px cursor; drag = scrub, space = play, ←/→ = 30 min, shift = 1 day.
- Footer line: "Terrain LOLA 20 m · ephemeris JPL DE440 · how this is computed" (opens sources + limits) and, while any value is sample, "sample values" on the right.
- Landing-site label: "Landing site" on a small solid dark backing at the mast top (from project("site")).
SITE MENU (per mockup): search field that also accepts typed coordinates; groups "Artemis regions, NASA 2024", "Landers", "Your points"; selected row highlighted; bottom row "Add a point: click the terrain, or type coordinates above" — DISABLED with "coming after terrain checks" until step 7 passes (never show flat-horizon numbers at the pole).
DETAILS DRAWER (opened from the answer sentence or Find better dates): horizon strip (D3 SVG, az 0–360°, el −2…+10°, exact values on hover/tap), finder, compare (step 4), CSV export (step 4). The strip is also the full fallback when WebGL is unavailable.
STATE: site, utc, view, drawer, user points — all in the URL hash; a copied link reproduces the view.

DONE WHEN (paste outputs):
- On ninja's Mac only: `node ~/.claude/skills/ui/check-slop.mjs app/src` → 0 ERROR; every WARN fixed or justified in one line. On other laptops skip this line and say so; Isaac runs it before merge.
- `cd app && npx playwright test e2e/ui.spec.ts` passes: UX-01 (fresh browser, Connecting Ridge 14 Nov: sentence + both labels visible within 60 s), UX-03 (invalid coordinates rejected with a message, never NaN; failed data load shows an error; WebGL disabled → strip + sentence still work), the main screen before any menu opens has exactly 3 buttons/links (site name, date, Find better dates) plus the timeline slider — assert with `page.getByRole('button').or(page.getByRole('link'))` count = 3 and `getByRole('slider')` count = 1, no horizontal scroll at 375 px.
- Screenshots at 1440 × 900 and 375 × 812, main and menu open, in app/test-results/. Compare with the reference images and list differences; fix, max 3 rounds, then hand over.

SCOPE FENCE: no 3D code (scene3d is C1's), no geometry maths, no wording of the answer sentence. Stop and ask before adding a dependency.
HUMAN DECISION: Bene approves the look; Isaac approves any visible wording; Leo approves every number shown (V7 before freeze).
```

---

## After each brief

Isaac: read the agent's final message, check the pasted done-outputs, look at the screenshots, then merge with `git merge --no-ff track-x` on main. Log who signed what in docs/event/validation.md.
