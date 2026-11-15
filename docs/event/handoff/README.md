# Handoff — build step 1 orchestration (Sat 14 Nov 2026, 12:05 CET)

> **Update 12:10: ninja resumed the orchestration on his Mac. Do NOT start a second orchestrator from this file.** Pre-flight (§4) is done on main (commit "Step 1 pre-flight"). This file stays as the reference for the contracts, split and decisions, and as the fallback if the Mac session stops again.

Written by the step-1 orchestrator session (Claude Code, Opus 5.5, ninja's Mac / Guest123), which ninja stopped at ~12:00 so that a session on another device continues. Read this file completely before acting. It pre-loads every fact, decision and design choice the stopped session had. Do not re-derive or re-ask anything stated here.

## 0. Paste this into the new session

```text
Repo: lunar-landing-site-navigator (GitHub, private). Pull main. Read, in this order: AGENTS.md, docs/event/handoff/README.md (this handoff: decisions, setup, contracts, split), docs/event/spec.md, the precedence table at the top of docs/event/agent-briefs.md, docs/event/build-plan.md, then the rest of docs/event/agent-briefs.md. Your job is the orchestrator prompt in agent-briefs.md (complete build step 1, build-plan §8) with the changes listed in the handoff. Start with handoff §2 (device setup) and §4 (pre-flight on main), then spawn the agents in handoff §5.
```

## 1. State at handoff

- **Nothing of step 1 is built.** main = `8c67f74` plus this handoff commit. No track branch exists. Track B's Opus agent started at ~12:05, was stopped by ninja's instruction after a few minutes with **no commits**; its branch was deleted. Start every track fresh.
- **Brief 0 is incomplete**, although TASKS.md calls it done. Pre-flight (§4) must fix these on main before any agent starts:
  - `app/package.json` lacks `@playwright/test`, `pixelmatch`, `pngjs`, `@fontsource/newsreader`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` (all listed in Brief 0). Several devDependencies still use `^`.
  - No `app/playwright.config.ts`. Vitest's default include would also pick up Playwright files in `app/e2e/*.spec.ts` and fail.
  - `.gitignore` lacks `app/test-results/`.
  - `scripts/requirements.lock.txt` lacks Pillow (needed by `textures.py` and the terrain overlay PNGs).
  - System `python3` on ninja's Mac has none of the libraries; a venv is required (§2).
- Time plan unchanged: V1/V2 Leo 16:00, T9 fallback trigger 18:00 (build-plan §8 "step 1-lite"), V3 20:00, V4 + horizon go/no-go + T14 stop rule 21:30, night shifts from 22:00 (event-plan "Overnight"), freeze Sun 12:00.

## 2. Device setup on the new device

1. Clone or pull: `git clone https://github.com/ninjabaloney06-sketch/lunar-landing-site-navigator` (or `git pull --ff-only`). Commit email must be `274549381+ninjabaloney06-sketch@users.noreply.github.com` (`git config user.email`; set it repo-locally if needed).
2. Raw data: the stick **Ninja**, folder `clps/` (same files as ninja's Mac; verify with `python3 clps/verify-data.py`). Set `CLPS_DATA` to that `clps` folder (macOS `export CLPS_DATA=/Volumes/Ninja/clps`; Windows `$env:CLPS_DATA='E:\clps'`). Copying it to the laptop is faster for the 2.7 GB DEM reads; then point `CLPS_DATA` at the copy. Copying needs ninja's yes (AGENTS.md: files outside the repo).
3. Device-only material from ninja's Mac is on the stick in `clps/handoff/` (§9).
4. Python ≥ 3.12. Create a **repo-local, git-ignored** venv at `<repo>/.venv` and use its absolute path in every agent prompt (`source <repo>/.venv/bin/activate`, Windows `.venv\Scripts\activate`), so `python3 -m pytest scripts/tests -q` uses it.
   - macOS Apple Silicon + Python 3.14 only: `pip install --no-index --find-links $CLPS_DATA/python/wheels-macos-arm64-cp314 -r $CLPS_DATA/python/wheels-macos-arm64-cp314/requirements.lock.txt`, then `pip install Pillow` (approved, §3).
   - Any other OS/Python: `pip install -r scripts/requirements.lock.txt` plus `Pillow` (venue Wi-Fi). Record the Pillow version in `scripts/requirements.lock.txt`.
   - Check: `python -c "import spiceypy, numpy, rasterio, pyproj, scipy, pytest, PIL"` and `python3 -m pytest scripts/tests -q` (3 contract tests pass).
5. Node ≥ 22.12 (Vite 8). `cd app && npm ci`.
6. Playwright browser: on ninja's Mac `@playwright/test` **1.64.0** matched the cached Chromium build 1248 (no download). On another device, `npx playwright install chromium` downloads ~150 MB: **ask ninja for that specific download first** (AGENTS.md; his 12:05 approval covered the npm packages on his Mac, see §3).
7. The slop checker for C2's done-check: `node <stick>/clps/handoff/check-slop.mjs app/src` (copy of `~/.claude/skills/ui/check-slop.mjs`; no dependencies).
8. `/usage`: the stopped session could not read it (no tool). Ask ninja to watch the 5-hour window and tell the orchestrator when it passes 70 %; then pause in the order C2 polish → B assets → C1 polish, never A or the merge queue.

## 3. Decisions ninja made in the stopped session (Sat 14 Nov, ~12:05) — do not re-ask

| # | Question | Answer |
|---|---|---|
| D1 | Install Brief-0 deps missing from package.json, exact pins (`@playwright/test` 1.64.0, `pixelmatch`, `pngjs`, three `@fontsource` packages) | **Approved** |
| D2 | Pillow (~3 MB) into a git-ignored repo `.venv` | **Approved** |
| D3 | Generated files > 10 MB inside the repo at the brief caps: `app/public/data/ephem` ~10.5 MB (cap 12, each month ≤ 250 KB), `app/public/textures` ≤ 12 MB, `app/public/data/terrain` ≤ 12 MB | **Approved** |
| D4 | Brief C2 contradicts itself (answer sentence opens the drawer + footer "how this is computed" link, yet "exactly 3 buttons/links") | **Header has exactly 3 controls** (site name, date, Find better dates); the answer sentence and the footer link stay quiet text links. Test asserts 3 buttons/links inside the header, 5 in the whole main screen, 1 slider, no horizontal scroll at 375 px |
| D5 | Per-site caveat labels ("Blue Moon MK1 target", "dropped in 2024", "NASA reference point, not a chosen landing site") have no §3 field | **Add optional `label` (string or null)** to sites.json and `types.ts`; C2 shows it under the site name. Contract change: flag it to Leo |

Approvals D1–D3 were given for this step-1 work; the browser download on a new device (§2.6) and copying raw data to a laptop (§2.2) are separate actions and need their own yes.

## 4. Pre-flight on main (orchestrator, before spawning anything)

The orchestrator owns these shared files; after the agents start, only the named track touches them. One commit, e.g. "Step 1 pre-flight: deps, test config, shared contracts". Run `cd app && npm run build && npx vitest run` and `python3 -m pytest scripts/tests -q` before committing.

1. `cd app && npm install --save-exact -D @playwright/test@1.64.0 pixelmatch pngjs && npm install --save-exact @fontsource/newsreader @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono`. Leave the existing `^` pins (mention them in the report; not this step's job).
2. `app/vite.config.ts`: import `defineConfig` from `vitest/config`, add `test: { include: ['src/**/*.test.ts'] }`.
3. `app/playwright.config.ts`: `testDir: 'e2e'`, `outputDir: 'test-results/pw'` (Playwright wipes outputDir each run; screenshots go to `test-results/*.png` beside it and survive), default viewport 1280 × 720, Chromium only, `launchOptions.args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']` (WebGL in headless), `webServer: { command: 'npm run dev -- --port ' + PORT + ' --strictPort', url: 'http://localhost:' + PORT, reuseExistingServer: false }` with `PORT = Number(process.env.PW_PORT ?? 5180)`. **Ports: orchestrator 5180, C1 5181, C2 5182.** Without separate ports and `reuseExistingServer: false`, C1's tests silently hit C2's dev server.
4. `.gitignore`: add `app/test-results/` and `app/playwright-report/`.
5. `scripts/requirements.lock.txt`: add `Pillow==<installed version>`.
6. `app/src/data/types.ts` (Track A owns it afterwards). Add:
   - `Site`: group union gains `'reference'`; `label: string | null`; `potential: SitePotential[]`.
   - `SitePotential { category: 'water-ice' | 'cold-trap' | 'illumination' | 'science' | 'other'; text: string; evidence: 'direct measurement' | 'remote observation' | 'modeled condition' | 'hypothesis' | 'unknown'; source_url: string }`. `'unknown'` is for step 3b's explicit unknown entry.
   - `Horizon`: optional `slope_deg?: number`. Track B writes it into the horizon file for sites.py.
   - `Station { id; name; network: 'DSN' | 'ESTRACK' | 'JAXA'; complex; lat_deg; lon_deg /* east-positive */; h_m; datum; min_elev_deg; source_url; source_label; link_state_inputs: 'unknown' }` (Brief A step 6).
   - `TerrainMeta { site_id; size /* 500 */; spacing_m /* 80 */; order: string /* "row-major; row 0 = north edge; col 0 = west edge" */; height_ref: string /* "metres relative to the site's ground height" */; nodata /* -32768 */; illum_png: string | null; illum_map: string | null; illum_res_m: number | null; dem: string }` and `TerrainTile { meta: TerrainMeta; heights: Int16Array }`. Sample (row i, col j) sits at x_east_m = (j − (size−1)/2)·spacing_m, y_north_m = ((size−1)/2 − i)·spacing_m. Track B writes this format; C1 reads it.
7. Sample data, so C2 can build before A/B merge: add `"label": null, "potential": []` to the sample site in `app/public/data/sites.json`; create `app/public/data/stations.json` with six obviously fake rows (`_note` "SYNTHETIC placeholder …" as in the other samples, ids `goldstone`, `madrid`, `canberra`, `cebreros`, `malargue`, `new-norcia`). Track A replaces it.
8. `app/src/geometry/index.ts`: the **geometry contract** (below). Implement only the four primitives the preamble fully defines: `interpolate`, `siteVector`, `enuBasis`, `azEl`. Every other function throws `Error('not implemented yet (Track A)')`. Track A owns the folder afterwards. It may change internals; renaming a signature or field needs the orchestrator.
9. `app/src/geometry/answerSentence.ts`: `AnswerState`, `AnswerLines` and a throwing `answerSentence`. The A-h agent owns it. `index.ts` re-exports it.
10. `app/src/scene3d/index.ts`: the **scene contract** (below), with a stub `mountScene` whose `project()` returns `null`. C1 owns the folder afterwards.

### Geometry contract (`app/src/geometry/`, pure TS, no DOM, no fetch)

```ts
MOON_RADIUS_KM = 1737.4; OBSERVER_HEIGHT_M = 1.75
BodyState { utcMs; sun_km: Vec3; earth_km: Vec3; q_me_to_j2000: Quat; q_earth_to_me: Quat }   // MOON_ME, Moon centre → body, LT+S; quats (x,y,z,w)
interpolate(months: EphemMonth[], utcMs): BodyState        // vectors linear, quats slerp; spans month boundaries; RangeError outside coverage
siteVector(latDeg, lonDeg, h_km): Vec3                     // (1737.4 + h_km) · unit(lat, lon)
Enu { east: Vec3; north: Vec3; up: Vec3 }; enuBasis(latDeg, lonDeg): Enu   // up = unit(lat,lon), east = unit(z × up), north = up × east
AzEl { az /* 0 = N, clockwise, [0,360) */; el; dist_km; dirEnu: Vec3 /* unit, x east, y north, z up */ }
azEl(body_km, site_km, enu): AzEl                          // topocentric: body − site (parallax up to 0.26°)
SiteGeo { lat; lon; elev_m: number | null }
maskAt(horizon | null, azDeg): number                      // null → flat-sphere dip for 1.75 m (−0.0813°)
discFraction(elDeg, maskDeg, angRadiusDeg): number         // 0..1 visible share of the disc
StationLos { az; el; moonElAtStation; state: 'los' | 'blocked'; reason: 'terrain' | 'station-mask' | null }
stationLos(station: Station, site: SiteGeo, s: BodyState, horizon | null): StationLos
CoverageState = 'covered' | 'none' | 'unknown'
Sample { utcMs; sun: AzEl & { mask; frac; lit }; earth: AzEl & { mask; frac; visible }; stations: Record<string, StationLos> }
Series { site; horizon; stations: Station[]; startMs; endMs; stepMin; samples: Sample[] }   // [startMs, endMs)
computeSeries(months, site, horizon, stations, startMs, endMs, stepMin = 30): Series
coverage(series, stationIds: string[]): CoverageState[]    // union over the selection, never double-counted; 'unknown' only where an input is missing
Window { kind: 'sun' | 'earth' | 'coverage'; startMs; endMs; state: 'lit' | 'dark' | 'visible' | 'hidden' | 'covered' | 'none' | 'unknown' }
windows(series, kind, stationIds?): Window[]               // edges refined by bisection to ±1 min, clipped to the period
Summary { litPct; earthVisiblePct; coveragePct; unknownPct; longestDarkH; longestGapH }
summarize(series, stationIds): Summary
answerState(series, stationIds, utcMs): AnswerState        // inputs for answerSentence at the cursor
FinderThresholds { missionDays; minLitPct; minCoveragePct; maxGapH; maxDarkH }
FINDER_DEFAULTS = { missionDays: 14, minLitPct: 70, minCoveragePct: 50, maxGapH: 48, maxDarkH: 72 }
FinderResult { windows: { startMs; endMs; best: { landingMs; litPct; coveragePct; longestGapH; longestDarkH } }[]; nearestMiss: { landingMs; failed: (keyof FinderThresholds)[] } | null }
finder(months, site, horizon, stations, stationIds, earliestMs, latestMs, t: FinderThresholds): FinderResult   // rank by combined coverage (spec), ties shown
// answerSentence.ts (A-h)
AnswerState { sunLit; sunHoursToChange; sunChangeInPeriod; comms: CoverageState; commsHoursToChange; commsChangeInPeriod; anyCoverageInPeriod; earthEverRises }
AnswerLines { sun: string; comms: string }; answerSentence(s: AnswerState): AnswerLines
```

### Scene contract (`app/src/scene3d/index.ts`, C1 ↔ C2)

```ts
SceneLevel = 'globe' | 'site' | 'eye'
SceneFrame { site: Site | null; horizon: Horizon | null; terrain: TerrainTile | null; state: BodyState }
SceneDeps { sites: Site[]; loadFrame(siteId: string, utcMs: number): Promise<SceneFrame> }   // C2's data layer implements it in the app; C1's harness implements it for tests
ScreenPoint { x; y; visible }                              // CSS px relative to the container
SceneHandle { ready: Promise<void>; update(f: SceneFrame): void; setLevel(l: SceneLevel): void;
              project(name: 'sun' | 'earth' | 'site'): ScreenPoint | null;   // 'site' = mast top, for the "Landing site" label
              onCameraChange(cb): () => void; onPick(cb: (lat, lon) => void): () => void; dispose(): void }
webglAvailable(): boolean
mountScene(container: HTMLElement, deps: SceneDeps): SceneHandle   // throws without WebGL; C2 then shows strip + sentence
// ?test=1: mountScene also sets window.__scene = { ready, setView({site, utc, level, az, el, dist, fov}), project, camera } (Brief C1 debug API)
```

C1 cannot edit `App.tsx`, so its Playwright tests run against its own harness page inside its folder: `app/src/scene3d/harness.html` + `harness.ts` (Vite dev serves it at `/src/scene3d/harness.html?test=1`). The harness uses `data/load.ts` + geometry to implement `loadFrame`.

## 5. Agents, models, branches, file ownership

Cost rule (ninja): Haiku where the model table in agent-briefs.md says Haiku, Opus where it says Opus, **never Sonnet**. So Briefs A and B are each split into an Opus agent and a Haiku agent on disjoint files. Every agent runs with `isolation: "worktree"` and renames its branch first (`git branch -m <branch>`).

| Agent | Model | Branch | Owns (nothing else) |
|---|---|---|---|
| A | opus | `track-a` | Brief A except the A-h files: `scripts/ephemeris.py`, `scripts/stations.py`, `scripts/export_fixtures.py`, `scripts/tests/test_ephemeris.py`, `scripts/tests/test_stations.py`, `app/src/geometry/` except `answerSentence*`, `app/src/data/types.ts`, `app/public/data/ephem/`, `app/public/data/stations.json`, `app/src/test/fixtures.json` |
| A-h | haiku | `track-a-h` | `scripts/stations.csv`, `scripts/periods.py`, `scripts/tests/test_periods.py`, `app/public/data/periods.json`, `app/src/geometry/answerSentence.ts` + `answerSentence.test.ts` |
| B | opus | `track-b` | `scripts/horizon.py`, `scripts/tests/test_horizon.py`, `app/public/data/horizons/` (keep `sample-site.json`: `test_contract.py` reads it), new `scripts/site_potential.json` |
| B-h | haiku | `track-b-h` | `scripts/sites.csv`, `scripts/sites.py`, `scripts/textures.py`, `scripts/terrain_tiles.py`, `app/public/data/sites.json`, `app/public/textures/`, `app/public/data/terrain/` |
| C1 | opus | `track-c1` | `app/src/scene3d/` (incl. harness), `app/e2e/scene.spec.ts`; Playwright with `PW_PORT=5181` |
| C2 | opus | `track-c2` | `app/src/views/`, `app/src/data/` except `types.ts`, `app/src/state.ts`, `app/src/App.tsx`, `app/src/main.tsx`, `app/src/index.css`, `app/src/styles/`, `app/e2e/ui.spec.ts`; Playwright with `PW_PORT=5182` |

Interfaces between the split agents (state them in both prompts):
- **stations.csv** (A-h → A): columns `id,name,network,complex,lat_deg,lon_deg,h_m,datum,min_elev_deg,source_url,source_label`. One representative deep-space antenna per complex. ids `goldstone`, `madrid`, `canberra`, `cebreros`, `malargue`, `new-norcia`. Primary sources only (DSN Telecommunications Link Design Handbook 810-005, ESA ESTRACK pages). A station without a sourced value is left out and listed in the report; never pick a mask.
- **site IDs** (B-h ↔ B): slug of the name as printed in the source (lowercase ASCII, spaces to hyphens). Expected: `shackleton-rim-site04`, `malapert-site23`, `connecting-ridge`, `connecting-ridge-extension`, `peak-near-shackleton`, `de-gerlache-rim-1`, `de-gerlache-rim-2`, `faustini-rim-a`, `haworth`, `malapert-massif`, `nobile-rim-1`, `leibnitz-beta-plateau`, `nobile-rim-2`, `amundsen-rim`, `de-gerlache-kocher-massif`, plus polar landers from sources.md (e.g. `im-1`, `im-2-intended`, `viper-mons-mouton`). The four 2024-only regions with no sourced coordinates are left out. Groups: the five regions in both sets → `artemis-2024`; 2022-only → `artemis-2022` (label "dropped in 2024"); Connecting Ridge → `commercial` (label "Blue Moon MK1 target"); the two Data Book points → `reference` (label "NASA reference point, not a chosen landing site"; frame_note records the source frame, or "frame not stated in source; MOON_ME assumed — Leo to verify").
- **horizon.py** CLI: `--site ID LAT LON` and `--all` (reads `scripts/sites.csv`). Each output file carries `observer_height_m: 1.75` and an extra `slope_deg`; `sites.py` reads `elev_m` and `slope_deg` from `horizons/<id>.json` and `potential` from `scripts/site_potential.json` (`{"<id>": [entries]}`). B runs `--site` for the three required sites first.
- **Cross-branch pickup:** worktrees share refs, so an agent that needs the other half runs `git merge --no-edit main` once the orchestrator has merged the Haiku branch (A needs `stations.csv` before writing stations.json; B needs `sites.csv` for `--all`, then reruns `sites.py`). If the other half is not on main yet, the agent delivers its own part and reports what is pending; the orchestrator runs the pipeline after both merges.

Prompt for each agent = **orchestrator notes + shared preamble verbatim + its brief verbatim** (C1/C2 also get the image paths in §9; tell them to Read the images and not copy them into the repo). The orchestrator notes the stopped session used for B, adapt per agent:
1. You are in an isolated worktree; `git branch -m <branch>`; report `pwd`; never touch the main checkout, never merge into main, never push.
2. Environment: `CLPS_DATA`, `source <repo>/.venv/bin/activate`, no pip installs; device name for BUILD_LOG.
3. The file split above: what you own, what the other half owns, the interface files.
4. Shared IDs and formats from this section and the §4 contracts.
5. Order of work, and the `git merge --no-edit main` pickup before the final done-checks.
6. Do **not** edit BUILD_LOG.md or docs/event/ai-use-log.md: put the exact line and row (the row includes its prompt cell: the name of your brief) in the final report; the orchestrator writes them on main (four parallel branches would conflict; AGENTS.md "hand the entry to the log owner"). This replaces the preamble's last two "Before finishing" bullets.
7. The brief corrections in §6 that apply to this agent.
8. Final report: branch + worktree path + SHA; each done-check with pasted output; files changed; BUILD_LOG line + ai-use-log row with its prompt cell; screenshots (C1/C2) with paths; anything in the brief that looks wrong; items for Leo/Otto/Bene.

Fresh-context review: one Opus reviewer per Opus branch (A, B, C1, C2) before its merge, read-only, findings ranked. The orchestrator reviews the small Haiku branches itself and re-runs their checks.

## 6. Brief corrections found (precedence: spec > build-plan > briefs; pass these in the orchestrator notes)

1. **Brief A T3 / build-plan T3 physics slip.** Seen from the Moon, the Sun and Earth are ~180° apart at **new Moon** (Sun–Moon–Earth), not full Moon (at full Moon they are nearly in the same direction). Because the Moon's orbit is inclined up to ~5.3° to the ecliptic, some months peak at only ~174.7°, so "> 175°" can fail on correct data. Assert > 174°, print each month's maximum, and let Leo judge. For C1: Earth seen from the Moon is "full" at new Moon.
2. **Brief A trap 4.** `pxform` evaluates both frames at one epoch. For IAU_EARTH at et − lt and MOON_ME at et, use `pxfrm2("IAU_EARTH", "MOON_ME", et - lt_earth, et)` (difference ~5e-6°, so either is acceptable; state which).
3. **Brief C1 eye level "2 m"** → 1.75 m (spec).
4. **Brief C1 terrain mesh.** The build-plan §5.4 order table puts the real terrain mesh in step 4. Step 1 needs the far ring from `mask` + `mask_dist_km`, the discs, eye level and orbit. C1 writes the tile loader against the §4 TerrainMeta format and falls back to a flat ground disc when no tile exists.
5. **Finder ranking** = combined selected-station contact (spec, precedence table), not "% both" (build-plan §4.4).
6. **Answer sentence cases the rules do not cover**: no change before the period ends, station contact `unknown`, under 1 h left. A-h proposes wording, keeping "never round up, never minutes". The orchestrator shows it to ninja at the wording gate.
7. **Logs**: see §5 note 6.
8. **C2 button count**: D4 above.

## 7. Integration procedure (orchestrator)

1. Merge order: **A-h → A → B-h → B → C1 → C2**. A goes first because it owns types.ts and stations. C1 and C2 run `git merge main` after A and B land, switch from sample to real data, and rerun their checks. If they have already finished, send them that follow-up (SendMessage to the same agent, or a Haiku agent for fixes a reviewer named exactly).
2. For each branch: read the report, re-run its done-checks yourself in its worktree, look at its screenshots (C1/C2: `<worktree>/app/test-results/*.png`; compare with the §9 images), get the Opus review for A/B/C1/C2, then `git merge --no-ff <branch>` on main. Never merge a branch whose checks you have not re-run. After each merge run `cd app && npm run build && npx vitest run` and `python3 -m pytest scripts/tests -q` on main.
3. After each merge, write that branch's BUILD_LOG line and ai-use-log row (from its report, prompt cell included) on main.
4. **Human gates** stop the orchestrator. At each one, post the evidence in one message and wait for ninja's "yes"; never mark a V-check passed:
   - V1/V2 (Leo, 16:00): the two `ephemeris.py --site` tables from Brief A's done-checks (Connecting Ridge 2026-11-14, and Shackleton Site04 2027-08-16 `--stations`).
   - V3 (20:00); V4 + horizon go/no-go + T14 stop rule (21:30).
   - Bene's look approval and ninja's visible-wording approval come **before** merging C1/C2: screenshots at 1440 × 900 and 375 × 812, plus every visible string.
5. Stop rules: T14 red at 21:30 → the horizon strip becomes the main view (build-plan §5.4); T9 red at 18:00 → step 1-lite (build-plan §8); event-plan cut list.
6. From 22:00: overnight queue only (event-plan "Overnight"): branches, no merges, no deploys, no gate items; one report per finished branch.
7. Step 1 is complete when every condition at the end of the orchestrator prompt in agent-briefs.md holds. Then push main and write the step-1 report (passed / waiting for Leo, Otto, Bene / cut). Tick TASKS.md boxes only for `[AI]` items that are fully verified.

## 8. Ninja's working rules the new device may not have (his global CLAUDE.md)

- Subagents: Haiku by default, Opus only where needed (here: the model table), never Sonnet. Spawn only for an independent file set or a fresh-context review.
- Ask when < 95 % sure what he wants; say plainly when something in his plan is wrong, with the reason and the better move, before doing the work; once he decides, do it without repeating the objection.
- Direct, concise reports; no emojis; state failures with output.
- Before UI work, read the taste books (copies on the stick, §9): slop = too perfect, a blatant lie, or something that makes no sense; no invented numbers.

## 9. Material only ninja's Mac had → stick `Ninja`, folder `clps/handoff/`

| File on the stick | Was on the Mac at | Used by |
|---|---|---|
| `reference-images/lunar-site-navigator-mockup-v4.png` | `~/Downloads/` | C1, C2 (main screen reference) |
| `reference-images/lunar-site-navigator-mockup-v4-site-menu.png` | `~/Downloads/` | C2 (menu open) |
| `reference-images/WhatsApp Image 2026-11-13 at 12.21.47.jpeg` | `~/Downloads/` | C2: ninja's timeline reference (yellow sunlight bar, blue comms bar). Its numbers and terrain are fictional |
| `check-slop.mjs` | `~/.claude/skills/ui/check-slop.mjs` | C2 done-check (`node <path> app/src`) |
| `taste/taste-ui-web.md`, `taste/taste-product-ux.md`, `taste/taste-questionnaire-2026-10-10.md` | `~/Documents/Ninja-2/wiki/` | C2 look; what ninja counts as AI slop |
| `HANDOFF.md` | this file | offline copy |
| `../repo/lunar-landing-site-navigator-2026-11-14.bundle` | git bundle of main incl. this handoff | clone offline: `git clone <bundle> lunar-landing-site-navigator` |

The reference images must **not** be copied into the repo (ninja). Everything else the build needs (SPICE kernels, LOLA DEM, PGDA maps, textures, macOS wheels) was already on the stick and matches the Mac copy.
