# Orchestrator prompt: final build night (notebook pages 1–3 + Otto's list)

Written 2026-11-15 03:30 by Claude Code on ninja's request. To run: open a fresh Claude Code session with
**Fable 5.2** in `/Users/Guest123/Documents/clps-lunar-mission-browser` on ninja's Mac (Guest123) and say
"Read ORCHESTRATOR-PROMPT.md and execute everything below its line."

---

You are the orchestrator for the last build night of the NASA Space Apps 2026 project "Lunar Landing Site
Navigator" (repo `/Users/Guest123/Documents/clps-lunar-mission-browser`, GitHub
`ninjabaloney06-sketch/lunar-landing-site-navigator`, preview https://nasa.digi-works.org). The operator is
ninja (= Isaac / "I" in the repo docs). Read `AGENTS.md` first; its rules apply on top of this prompt
(AI-use log row with the prompt for every task, one BUILD_LOG line per shipped unit with exact local time,
no download / no output > 10 MB / no send without Isaac's yes).

## Hard time box

Local submission deadline **Sun 15 Nov 2026, 15:45**; the team submits **by 15:00** and rehearses the pitch
from 15:00. Everything you merge must be on `main`, green and deployable by **12:00**. After 12:00: only
fixes to things you broke. If an agent is not green by its wave's cut-off (Orchestration), drop its work,
leave main untouched, and report what is left.

## Target user (applies to every UI and docs task)

NASA's challenge statement names **mission planners, educators and the public** (`docs/reference/decisions.md`
l. 128 and 188). Priority, decided by ninja (15 Nov): **NASA mission planners first** — the judges read the
app as NASA people. Educators and the public are served by hover explanations and the docs page, not by
dumbing the app down.
- **Language:** NASA's own terms, with units: Δv (m/s), TLI, LOI, line of sight, DSN, PSR, illumination
  (% of time), slope (°), landing ellipse, 3σ. Every abbreviation expands on hover once ("Δv — change in
  velocity a burn must deliver"); no invented layman's substitutes.
- **Summary mode (default):** the decision values only — is this site / date / route good, and why — in
  short labels and bullets, each with its status (green / yellow / red against a stated threshold).
- **Full data mode (the global toggle, U8):** everything a planner would check: breakdown per phase, raw
  values, ε and its dominant term, method, sources.
- **Remove in both modes:** research-note internals (evidence grades in capitals, "not retrieved",
  internal file names, raw signed decimal coordinates, unformatted numbers, process notes about the team).

## State at start (verify, do not trust)

- `main` = merge commit `4c3cb3e` (PR #21, 04:06) plus the log commit that records the deploy below. It
  contains notebook page 2, the two bug lists, the Flight plan tab and Leo's `feature/flight-calculator-lite`
  (`d7f56b7` + test fixes `7e68c7d`). Deployed to https://nasa.digi-works.org as Worker
  `7b0a0906-6739-4352-adde-e30554d6144c` (Cloudflare `Created` 2026-11-15 03:20:52 UTC = 04:20 local).
  All other branches were deleted after the merge; only `main` exists. **Before you start: `git fetch`,
  confirm `4c3cb3e` is an ancestor of `origin/main` and `git status` is clean. If not, stop and tell ninja.**
- Tests on that main (Leo's laptop, 04:05): tsc, vitest 343 passed + 1 skipped, `flight/anySite.test.ts`
  19 passed, Playwright three full runs with `PW_GPU=1`: 126 passed, 1 skipped, 0 failed. With the default
  software renderer, `e2e/scene-motion.spec.ts:363` (S3 fly picture) can exceed its timeout on a slow
  machine — that is pre-existing, not a regression. If it times out here, rerun with `PW_GPU=1` before
  blaming a change.
- Leo's merged branch added:
  - "Calculate flight" button on saved-mission rows (All sites table + Mission panel list) → opens the
    Flight plan tab pre-filled with that mission (site, dates, launchpad, rocket, new hash key `stay`).
  - Flight panel compacted into a short "Rocket flight" menu (energy multiplier, Apollo/SLS cards,
    details collapsed).
  - Energy multiplier = exhaust energy from TLI on / cheapest landing point of a reference mission
    (`app/src/flight/energyBaseline.*`). **Not validated by S.**
  - Leo's log: "with this repo's hardware data the Blue Moon lander is short of propellant at every point".
- Already in the code — check before building anything new:
  - Rocket equation: `rocketPropellant()` in `app/src/flight/astro.ts`.
  - Transfer integrated under Earth + Moon + Sun gravity (`flight/nbody.ts`, `flight/sim.ts`), finite-burn
    descent with `MU_MOON`/r² gravity (`flight/lunar.ts`) → gravity varying with altitude and mass loss
    during burns are probably already modelled. Prove it with a test, then surface it in UI + docs; do not
    rebuild it.
  - Sunlight: terrain horizon in 720 directions from LOLA 20 m/px + Sun-disc fraction
    (`app/src/geometry/index.ts`: `maskAt`, `discFraction`). This is already ray-casting to the Sun disc.
  - In-app docs: `app/src/docs/DocsView.tsx` + `content.tsx` (opened as a drawer); long-form
    `docs/documentation.md`; POI research with sources in `docs/POIs/*.json`.
  - Saved-missions table: `views/SiteTable.tsx`; basic site/period compare: `views/Compare.tsx`.
  - Worker serves `app/dist` with SPA fallback (`app/wrangler.jsonc`), so `/docs` can be a client route.

## Traps (read before the steps)

1. **Team names: decided by ninja (15 Nov 2026): full names in the credits.** This overrides the
   AGENTS.md "no recognizable names of minors" line for the credits file only; record the decision with date
   in `docs/reference/decisions.md`. Spell them exactly: Leonhard Greiner, Otto Erwerle, Benedikt Schmidt,
   Isaac Brauer. Full names only in `docs/credits.md` and the `/docs` page built from it, nowhere else
   (no demo video, no screenshots, no app UI).
2. **Validation markers.** Leo (S) declared the flight physics validated on 14 Nov 20:59; ninja set
   `VALIDATED = true`. Any NEW physics (payload optimiser, dispersion tube, J2/mascon term, energy
   multiplier) is not covered by that. Mark new numbers "not yet validated by the science lead" in UI and
   docs until Leo signs; record his sign-off in `docs/event/validation.md`. Removing the POI marker (task U7)
   is a separate change: per-point markers go, decided by ninja.
3. **File ownership is in the Orchestration tables.** `App.tsx` is the conflict hotspot (tabs, Esc, camera,
   routing): only the wave-2 `shell` agent edits it; everyone else hands it an exact diff. `docs/POIs/**`,
   `scripts/pois.py` and `pois.json` belong to the `poi` agent and the orchestrator; docs agents only read them.
4. Do not regenerate terrain tiles or download data without ninja's yes (> 10 MB, data computer).
5. Never delete or rewrite an existing test to make it pass. Never `--admin`, never force-push.

## Orchestration: parallel agents in waves (replaces any per-workstream schedule below)

The task lists U / P / D below say WHAT to build. This section says WHO builds it, WHEN, and in which files.
Workstream headers' branch names and cut-offs are superseded by the waves here.

### Setup (once, before wave 0)

- Keep the Mac awake for the whole run: `caffeinate -dimsu &` (kill it at the end). A sleeping Mac kills
  every agent.
- Orchestrator works in the main checkout on branch `integration`, created from `origin/main` after the
  start-state check (recreate it from the pushed `main` after wave 0) (if a stale local `integration` exists, rename it `integration-old` first). Keep
  `integration` checked out there all night: agent worktrees branch from the main checkout's HEAD, so each
  wave starts from what is merged. Nobody else touches the main checkout except the Haiku text agents' `private/` folder.
- Every coding agent: `Agent` with `run_in_background: true` and `isolation: "worktree"`. First commands in
  its worktree: `ln -s /Users/Guest123/Documents/clps-lunar-mission-browser/app/node_modules app/node_modules`
  (no `npm install`), then `export PW_PORT=<its port>` (ports 5181–5199, one per agent, listed below; the
  orchestrator uses 5180). Playwright already reads `PW_PORT` and never reuses another agent's server.
- Disk: 24 GB free when this prompt was written; each worktree is ~0.5 GB (`app/public` is tracked). At most 12 worktrees at once;
  `git worktree remove` each one right after its branch is merged.
- Usage limits: if agents start failing on rate limits, lower concurrency (Haiku agents keep running, Opus
  agents queue) instead of retrying in a loop.

### Conflict rules (what keeps parallel agents mergeable)

- Each agent owns the files listed for it and edits only those. Need a change elsewhere → put the exact diff
  in its final report; the orchestrator applies it at merge time. Never two agents on one file in a wave.
- Agents do NOT write `BUILD_LOG.md`, `docs/event/ai-use-log.md` or `TASKS.md`. The orchestrator writes one
  line / row per merged agent (with the agent's brief name as the prompt) — these files never conflict.
- `views/Icon.tsx` is append-only (new icon imports + keys); a conflict there is resolved by keeping both.
- Each agent commits on its own branch and runs `npx tsc --noEmit`, the vitest files it touched, and its own
  Playwright specs. The orchestrator runs the full suites on `integration` after every merge (tsc + full
  vitest) and full Playwright at the end of each wave.
- Merge as each agent finishes (do not wait for the whole wave). Conflict > ~30 lines or touching logic you
  cannot verify → do not hand-resolve: re-run that agent on fresh `integration` with the same brief.

### Monitoring: event-driven, a shell watchdog checks every 30 s

You do not poll with model turns. Background agents wake you when they finish. In addition, start this
watchdog with the `Monitor` tool at the start of each wave; it costs no tokens while things are fine and wakes
you only on a problem. After handling it, start it again.

```bash
REPO=/Users/Guest123/Documents/clps-lunar-mission-browser
while true; do
  free=$(df -g ~ | awk 'NR==2{print $4}')
  [ "$free" -lt 5 ] && { echo "DISK LOW: ${free} GB free"; exit 0; }
  for wt in $(git -C "$REPO" worktree list --porcelain | awk '/^worktree /{print $2}' | grep -vx "$REPO"); do
    [ -e "$wt/.agent-done" ] && continue
    recent=$(find "$wt" \( -name node_modules -o -name dist -o -name test-results -o -name .git \) -prune \
             -o -type f -mmin -15 -print 2>/dev/null | head -1)
    [ -z "$recent" ] && { echo "STALLED: $wt (no file change in 15 min)"; exit 0; }
  done
  pgrep -qx caffeinate || { echo "CAFFEINATE NOT RUNNING"; exit 0; }
  sleep 30
done
```

Each agent's brief ends with: "When finished, `touch .agent-done` in your worktree root, then report."
On STALLED: read that agent's last commits and output (`SendMessage` to ask for status once); if it is stuck,
stop it (`TaskStop`), keep its commits, and respawn a narrower brief from where it stopped. On DISK LOW:
remove merged worktrees and `dist/`, `test-results/` folders first.

### Wave 0 — read every line, fix small bugs, clean the repo (start immediately, cut-off 06:00)

Goal: waves 1–4 start from a flat, clean, green `main` whose every line of code has been read once.
**You (the orchestrator) do not read the code yourself** — ~50,000 lines would fill your context and leave
nothing for orchestrating. Nine sweep agents read it in parallel and send you compact reports.

**Clean the repo state first (you, before spawning):**
- `git status` clean on `main`; `git fetch --prune`; `git worktree prune`; delete any local branch other than
  `main` that is fully merged (`git branch --merged origin/main`); report, don't delete, unmerged ones.
- Kill stray dev servers on ports 5180–5199 (`lsof -ti tcp:5180-5199 | xargs kill`); delete `app/dist`,
  `app/test-results`, `app/playwright-report` (all git-ignored, regenerable).
- Create `integration` from `origin/main`.

**Sweep agents (all `model: "opus"`, worktree + node_modules symlink as in Setup):**

| Agent | Reads every line of (and owns) | Port |
|---|---|---|
| sweep-views | `app/src/views/**` (~6.1k lines) | 5181 |
| sweep-shell | `app/src/App.tsx`, `state.ts`, `missions.ts`, `main.tsx`, their tests, `app/src/styles/**` (~4.5k) | 5182 |
| sweep-scene | `app/src/scene3d/**` (~7.1k) | 5183 |
| sweep-flight-a | `flight/ascent.ts`, `lunar.ts`, `transit.ts`, `sim.ts`, `nbody.ts`, `astro.ts`, `vec.ts`, `ephemeris.ts`, `numeric*`, `testEphem.ts` and their tests (~6k) | — |
| sweep-flight-b | all other `app/src/flight/**` files and their tests (`nrho`, `missionNrho`, `mission`, `plan`, `planWorker`, `guess`, `ideal`, `planeChange`, `spacecraft`, `launchVehicles`, `vehicles`, `pads`, `hardware`, `designs`, `craft`, `types`, `energyBaseline*`) (~7k) | — |
| sweep-geo | `app/src/geometry/**`, `app/src/data/**`, `app/src/docs/**` (~5.2k) | — |
| sweep-e2e | `app/e2e/**`, `app/playwright.config.ts`, `vite.config.ts`, `tsconfig*.json`, `package.json`, `wrangler.jsonc`, `index.html` (~5.3k) | 5184 |
| sweep-scripts | `scripts/**` (Python, ~7.3k); runs `pytest scripts/tests` | — |
| sweep-docs | every tracked `*.md` except `docs/archive/**`, `AGENTS.md`, `CLAUDE.md`, `ORCHESTRATOR-PROMPT.md`, `BUILD_LOG.md`, `TASKS.md`, `docs/event/ai-use-log.md`; plus `.gitignore` | — |

**What a sweep agent fixes directly** (each fix small, local and verifiable, with a test where one fits):
type errors and unsafe casts that can fail, wrong or missing units in labels, off-by-one and boundary bugs,
unhandled `null`/empty states that crash or show `NaN`/`undefined`, console errors and React key warnings,
event listeners or timers that are never cleaned up, unused imports and exports (confirmed unused by a
repo-wide grep), dead code orphaned by earlier changes, comments that contradict the code, broken relative
links and references to files that no longer exist (docs), stale facts in docs that contradict the code.

**What a sweep agent does NOT do:** refactor, rename, move or split files (the wave tables depend on today's
paths); reformat; change behaviour a user would notice; change any physics or geometry result, constant
or data value (Leo validated them — report instead); polish the parts waves 1–3 rewrite anyway (Mission menu
site list and layout, the drawer's Simulation section, POI card text, the view menu entries, flight panel
wording) — fix real bugs there, nothing else. No edits to `AGENTS.md`, `CLAUDE.md`, logs, `docs/archive/**`.

**Report format (compact, ≤ 60 lines):** (1) fixes made: `file:line — bug — fix — test`; (2) not fixed,
needs a decision or bigger change: `file:line — problem — suggested owner (wave agent or ninja)`;
(3) checks run and results. Then `touch .agent-done`.

**Your merge and gate:** merge each sweep branch as it finishes (they own disjoint files, so conflicts should
be zero). Then on `integration`: tsc, full vitest incl. `flight/anySite.test.ts`, `pytest scripts/tests`,
full Playwright (`PW_GPU=1` if S3 times out), `npm run build`. Green → fast-forward `main`, push, one
BUILD_LOG line listing the sweep fixes. Add every "not fixed" item that falls in a wave-1–3 agent's files to
that agent's brief; list the rest for ninja in your final report. Waves 1–4 branch from this pushed `main`.

### Wave 1 — starts when wave 0 is merged and pushed, all in parallel (cut-off 07:45)

| Agent | Model | Tasks | Owns (edit only these) | Port |
|---|---|---|---|---|
| cam | opus | U5, U6, U16, U14 | `app/src/scene3d/**`, `views/SceneView.tsx`, `views/ViewMenu.tsx`, `views/SearchPanel.tsx` (the "Show" handler for U16 and the U7 string at l. 255); Esc change in `App.tsx` → diff in report | 5181 |
| points | opus | U10, U11 | `views/custom.ts`, `data/customSite.ts`, the file holding the role button (locate first; if another agent owns it → diff in report), `e2e/` new spec | 5182 |
| poi | opus | U7, U8 card + toggle | `views/PoiInfo.tsx`, `views/PoiControl.tsx`, `views/poiLayer.ts`, `styles/poi.css`, new `views/advanced.ts` (the global summary / full-data hook with `localStorage`; no `state.ts` edit), `views/Icon.tsx` (add `information-circle-outline` as key `info`, for U4), `scripts/pois.py` (merge `docs/POIs/plain.json` if present; missing file → no `plain` field), `app/public/data/pois.json` | 5183 |
| poi-text-01 … 09 | haiku | U8 plain texts, 25 records each (batch NN = records 25·(NN−1)+1 … 25·NN in `app/public/data/pois.json` order; give each agent its records inline) | write only `private/poi-plain/batch-NN.json` in the main checkout (no worktree, no git) | — |
| mission | opus | U1, U2 | `views/MissionPanel.tsx`, `styles/mission.css` | 5184 |
| dates | opus | U3, U4, U18 | `views/Drawer.tsx`, `views/DateMenu.tsx`, `views/Timeline.tsx`, `views/HorizonStrip.tsx`, `views/period.ts`, `styles/panels.css` (uses the info icon from `poi`'s branch: import name `info`; add it to `Icon.tsx` too if not merged yet) | 5185 |
| phys-a | opus | P1, P4 | new `app/src/flight/*.proof.test.ts`, `flight/hardware.ts` | — |
| phys-b | opus | P2, P3 (compute only, no UI) | new `flight/payload.ts`, `flight/plan.ts`, `flight/mission.ts`, `flight/missionNrho.ts`, `flight/designs.ts` | — |
| phys-c | opus | P5 compute (J2 + Monte Carlo, no UI) | `flight/sim.ts`, `flight/nbody.ts`, `flight/lunar.ts`, new `flight/dispersion.ts`, `flight/planWorker.ts` | — |
| credits | haiku | D2 | new `docs/credits.md` only | — |
| docs-page | opus | D1 | `app/src/docs/**`, `styles/docs.css`, `app/src/main.tsx` (route on `location.pathname === '/docs'`, so `App.tsx` stays untouched), `vite.config.ts` (Markdown import) | 5186 |
| why-ours | opus | D4 | new `docs/why-ours.md` only | — |

After all 9 `poi-text` batches: one Opus reviewer (`poi-text-review`) checks 25 random entries against
their records (U8 fact rule); failed batches are redone by Haiku; then the orchestrator merges the batches
into `docs/POIs/plain.json` on `integration` and runs `scripts/pois.py`.

### Wave 2 — starts when wave 1 is merged into `integration` (cut-off 09:45)

| Agent | Model | Tasks | Owns | Port |
|---|---|---|---|---|
| shell | opus | U9, U12, U13, U8 toggle on the other cards (site info, search results, flight details link), the Esc diff from `cam`, an in-app link to `/docs` | `App.tsx`, `state.ts`, `views/SiteTable.tsx`, `views/Compare.tsx`, `views/SearchPanel.tsx`, `views/Stations.tsx`, `views/Finder.tsx` | 5187 |
| flight-ui | opus | P2/P3/P5 UI (payload, cheapest route, 1σ/3σ tube in the scene), P6 uncertainty budget, P7 markers | `views/FlightPanel.tsx`, `views/FlightExplain.tsx`, `views/FlightTransport.tsx`, `views/flight*.ts`, `views/useFlight.ts`, `scene3d/flight.ts`, `styles/flight.css`, new `docs/scientific-proof/uncertainty.md` | 5188 |
| proof | opus | D3 except uncertainty | new `docs/scientific-proof/*.md` (not `uncertainty.md`) | — |

### Wave 3 — starts when wave 2 is merged (cut-off 11:00): U17 readability, one agent per screen

U17 cuts across every view, so it runs last, split by file so the agents never meet. Each agent first puts its
current → proposed wording table in its report, then implements, then a 375 px screenshot.

| Agent | Model | Screen | Owns | Port |
|---|---|---|---|---|
| read-mission | opus | Mission menu | `views/MissionPanel.tsx`, `styles/mission.css` | 5181 |
| read-dates | opus | Find better dates, info screen, drawer, timeline | `views/Drawer.tsx`, `views/DateMenu.tsx`, `views/Timeline.tsx`, `views/HorizonStrip.tsx`, `views/Terms.tsx` | 5182 |
| read-flight | opus | Rocket flight menu + explanations | `views/FlightPanel.tsx`, `views/FlightExplain.tsx`, `views/FlightTransport.tsx`, `views/flightGlossary.tsx`, `views/flightFormat.ts` | 5183 |
| read-tables | opus | Saved missions, compare, search, stations, finder | `views/SiteTable.tsx`, `views/Compare.tsx`, `views/SearchPanel.tsx`, `views/Stations.tsx`, `views/Finder.tsx`, `views/format.ts` | 5184 |
| read-cards | opus | POI and site cards | `views/PoiInfo.tsx`, `views/PoiControl.tsx`, and the site info card's file (locate it; if another wave-3 agent owns it → diff in report) | 5185 |
| docs-update | opus | D5 | `docs/documentation.md`, `app/src/docs/content.tsx` | — |

### Wave 4 — integration and release (11:00–12:00)

1. Full `tsc`, vitest, Playwright, `npm run build` on `integration`.
2. One fresh-context Opus reviewer (`final-review`) reads the whole `origin/main..integration` diff and clicks
   through the built app at 1280 px and 375 px; returns only real defects. Fix them (or revert the offending
   merge) by 11:50.
3. Fast-forward `main`, show ninja the diff stat, push. Write the BUILD_LOG lines and AI-use rows.
4. Ask ninja for the deploy yes. Kill `caffeinate`. Remove all worktrees.

### Cut-offs and drop order

An agent still running at its wave cut-off is stopped; its finished commits merge only if green. Wave 0 is never extended: at 06:00 merge the green sweeps and start wave 1. If a wave is
late, start the next wave anyway with what is merged. Drop order, first dropped first: U13, U10, U4, U3, U2,
U17 screens (cards → tables → dates → flight → mission), P5 tube UI, D4.

### Models

Orchestrator: you (Fable 5.2). Subagents never inherit your model: pass `model: "opus"` (Opus 5.5) or
`model: "haiku"` (Haiku 5.5) explicitly on every `Agent` call, as the tables say. Opus for everything that
needs judgment (code, physics, wording, reviews); Haiku for the plain-text batches and the credits list. Never Sonnet. No gauntlet-loop (deadline): each agent builds and self-tests, the
orchestrator reviews every diff before merging, and `final-review` checks the whole.

## Workstream U — UI and bugs (agents and timing: see Orchestration)

U1. **Landing-site dropdown** (Mission 1 menu, top left, `views/MissionPanel.tsx` ~l. 373–530): the site list
    shows nothing until the user types in the text box; then matching sites. Keep the current site visible
    as the field value. Empty field + focus → at most a one-line hint, no list.
U2. **Compact the Mission menu**: remove from the first view what a user does not need to decide (Target user). Concretely, propose
    in your report and implement: ground stations as one summary row ("3 of 5 stations ▸") expanding on
    click; "Play mission" as one compact button; per-site numbers behind a disclosure; "Add mission" moved to
    the bottom of the menu. Do not remove a function, only fold it.
U3. **Time periods tab**: shows the mission currently selected in the Mission table, lists the best computed
    periods for that mission's current landing site, and picking one edits that mission's dates.
U4. **Split "Find better dates" and the button next to it into two screens.** Replace the settings (cog)
    icon with an info icon (Ionicons `information-circle-outline`, MIT, same import pattern as
    `views/Icon.tsx`). The info screen contains the stacked timeline: a `Light | Communication` select, a year
    select (2026–2030, within data coverage Nov 2026–Dec 2030), a month axis, and one bar row per location
    (current site + saved missions' sites) under each other, bars = lit / in contact spans. Compact: one
    select row, legend inline, no prose paragraphs.
U5. **Camera at eye height**: entering a simulation from the Moon view, and looking at a newly added point,
    puts the camera inside the floor. Keep the angle, raise the camera to `OBSERVER_HEIGHT_M` (1.75 m) above
    the terrain under it. Regression test in `scene3d/`.
U6. **Esc during an animation** returns to the landing-site view, not the Moon view. Esc outside an
    animation keeps today's behaviour.
U7. **Per-point science-lead markers** (ninja, 15 Nov: Leo will not validate every single point):
    remove every per-point marker from the UI — "From research notes, not validated by the science lead" and
    "The coordinates still need a check." in `PoiInfo.tsx` (l. 72), `SearchPanel.tsx` (l. 255),
    `PoiControl.tsx` (l. 59), and any other place a point says it waits for the science lead (grep the app,
    `app/public/data/*.json` and `docs/POIs/*.json` for wording like "science lead", "need a check",
    "waiting", "pending"). Replace them with ONE statement on the `/docs` page (D3, and `content.tsx`
    l. 465 / 567–568): point coordinates and facts come from the cited research sources; they are not
    individually checked by the science lead; the app's computed results (sunlight, contact, flight) are.
    Do not remove the marker from new physics (trap 2) — that is a different thing.
U8. **POI info card: summary by default, full data on demand** (ninja, 15 Nov, on the Cabeus crater card:
    "meaningless to even the average mission coordinator"). Today's card shows raw research notes: "LCROSS
    ground truth (5.6 +/- 2.9 wt% water + other volatiles); impact at -84.6796, -48.7093", "Age: not
    retrieved", "Evidence ESTABLISHED", "Limitations: Centre conflict ... (see psr_and_ice.json)", the
    science-lead marker, sources, "Click the pin to keep this open."
    - **Summary mode (default):** name, feature type, and 2–3 bullets on what matters for landing-site
      planning, in NASA's terms (see Target user). Example of the target (check every fact against the
      record before using it): "Cabeus crater · PSR · • Water ice confirmed: LCROSS impact 2009,
      5.6 ± 2.9 wt% H₂O · • D ≈ 100 km, depth ≈ 4 km · • <computed distance> km from your site". No evidence grades in
      capitals, no file names, no "not retrieved" rows, no raw signed decimal coordinates, no sources.
    - **Full data mode:** the full record, cleaned: coordinates as `84.90° S, 35.50° W`; rows with no value
      are hidden (never "not retrieved"); evidence level explained in a short phrase; conflicts written as
      a sentence ("Centre position differs between sources: Wikipedia 84.9° S 35.5° W, USGS Gazetteer
      85.33° S 42.13° W"); no internal file names (`psr_and_ice.json` etc.); source links at the bottom.
    - **Toggle** (decided by ninja, 15 Nov: labelled toggle, no icon-only button): a small switch in the
      card's top-right corner with the visible text label "Full data" — `<button role="switch"
      aria-checked>`, label always shown (also at 375 px), on/off state visible by the switch position and
      not by colour alone, keyboard operable. No icon. The choice is **one global setting**: once on, every
      other info card and detail view across the site opens in full data mode (POI cards, landing-site
      info, the Rocket flight menu's collapsed details, search results) until switched off. Keep it in one shared hook (`views/advanced.ts`) persisted in `localStorage`
      (wrap reads/writes in try/catch; default summary if storage fails). Put the toggle in the same corner
      of every card that has both modes.
    - **Plain texts for all ~206 points:** add a `plain` field per record, from a new
      `docs/POIs/plain.json` keyed by POI id, merged by `scripts/pois.py` into `pois.json`. Haiku writes
      them in batches of 25 under one rule: every fact in a summary-mode bullet must appear in that record's
      fields — no outside knowledge, no new numbers. An Opus reviewer checks 25 random entries against
      their records; any invented fact → that batch is redone. Records too thin for a useful sentence get
      just the plain type ("Crater", "Planned landing site").
    - Delete "Click the pin to keep this open." The card must not cover its pin (place beside it, flip at
      screen edges). Sources leave the summary card; they stay in full data mode and on the docs page (D2).
    - Tests: toggle persists across cards and reload; summary card for Cabeus contains no "ESTABLISHED",
      no ".json", no "not retrieved", no "-84."; full data card hides empty rows; the switch shows the text "Full data" at 375 px.
U9. **Click outside closes**: every open menu, card or panel closes on a click outside it (same mechanism as
    `FlightTransport.tsx` l. 100). The 3D canvas counts as outside.
U10. **Custom point naming**: adding your own point and assigning it to a mission renames the location to the
    mission name. Remove the role button / roles for points entirely (code + state + tests).
U11. **Bug: "Set point xyz as landing site" goes to the old site** after creating a second point. Reproduce
    with a Playwright test first, then fix.
U12. **Flight plan access**: the Flight plan tab is reached only from a selected mission ("Calculate flight"
    in the Mission table, already on Leo's branch). Remove the standalone header tab button if it still
    exists after the merge.
U13. **Compare saved missions**: if `SiteTable.tsx` after Leo's merge already shows saved missions with name,
    key info and the "Calculate flight" button, that is the compare tab — make it reachable in one click and
    stop. Only build a new tab if it does not.
U14. **View menu** (decided by ninja, 15 Nov): remove "Point start", "Point end", "Earth", "Sun" and
    "Solar system — top view" from `VIEWPOINTS` in `views/ViewMenu.tsx`; only "Moon" stays. Remove the code
    that becomes unreachable (camera presets, keyboard shortcuts, tests for those entries); if the menu with a
    single entry is pointless, replace it with a plain "Moon view" button and say so in the report.
U16. **Bug: search → "Show" does not land in eye-level view.** Searching for a site and pressing "Show"
    must bring the camera to that site in the same eye-level view as opening a landing site (1.75 m above
    terrain, same angle as U5). Reproduce with a Playwright test first; share the camera code path with U5
    rather than adding a second one.
U17. **Inputs and values a NASA mission planner reads at a glance** (ninja, 15 Nov: NASA-oriented,
    intuitive even for experienced planners; educators and the public via hover and docs; see Target user). Applies to every screen with inputs or result
    values: Mission menu, Find better dates, the info/settings drawer (`views/Drawer.tsx`), Rocket flight
    menu, saved-missions table, compare view, POI and site cards. Rules:
    - **Every input** has a short label in NASA's terms, its unit, and a one-line hint (e.g. "Ground
      stations — DSN / ESTRACK antennas for line-of-sight contact"). Sensible default preselected. A
      disabled option says why in one short phrase.
    - **Every value** answers "is this good for my mission?": plain unit and rounding ("62 % of the time —
      about 18 of 29 days", not "0.6214"), and a status colour (green / yellow / red) against a stated
      threshold, with the threshold in the hint. Dates as `16 Aug 2027`, durations as `3 days 4 h`.
    - **NASA terms, internals never**: standard terms with units, each abbreviation expanded on hover;
      summary mode shows decision values and status, full data mode adds breakdown, raw values, method
      and ε. Remove app-internal or research-note wording in both modes ("Access not assessed", evidence
      grades in capitals, "not retrieved", file names, unexplained codes).
    - **Long texts become bullet points**: any explanatory paragraph longer than ~2 lines turns into at most
      3–4 bullets of ≤ 12 words each; the full text moves to full data mode or the docs page. Applies to panel
      intros, method notes (`FlightExplain.tsx`), drawer sections, empty states and error messages.
    - Before you build: list every input and value per screen with its current and proposed wording in a
      table in your report, then implement. Do not change what is computed, only how it is labelled and shown.
    - Check: a 375 px screenshot of each screen; `grep` the summary-mode render output for the internals list
      above ("Access not assessed", "ESTABLISHED", "not retrieved", ".json") returns nothing; every
      abbreviation shown has a hover/hint expansion.
U18. **Simulation speed slider** (ninja, 15 Nov). Today the speed is a `<select>` in the drawer's
    "Simulation" section (`views/Drawer.tsx` ~l. 330–350, values `SPEEDS_H_PER_S = [3, 10, 24, 72]` in
    `state.ts`, labels from `speedLabel`). Replace it with a slider like the Flight plan's
    (`views/FlightTransport.tsx` l. 307–320: `type="range"` over the step index, `aria-valuetext`, label
    beside it), placed with the timeline's playback controls on the stage. It is **visible only while the
    simulation is running or paused in simulation mode**; it disappears when the simulation ends or is
    left. Move "Reset to start" next to it. Then delete the whole "Simulation" section from the drawer
    (heading, the "Simulate, beside the timeline ..." text, the select, the button). Keep Space = pause.
    Tests: slider absent before Simulate, present during, absent after Esc/end; changing it changes the
    speed; the drawer no longer contains `data-testid="speed"` (update the existing test that uses it to the
    new slider's test id — this is a moved control, not a deleted test).
U15. **Top view**: dropped. Its only entry point goes in U14. If the solar-system top view is still
    reachable some other way after U14 (check), report where; do not build anything on it.

Done = `npx tsc --noEmit`, `npx vitest run`, `npx playwright test` green in `app/`; a new or updated test
for U1, U3, U5, U6, U7, U8, U9, U10, U11, U16, U18; desktop + 375 px browser check of each changed screen with screenshots
named in the report.

## Workstream P — physics (agents and timing: see Orchestration)

P1. **Prove what exists**: tests that (a) descent gravity follows μ/r² with altitude, (b) vehicle mass drops
    with burned propellant during finite burns, (c) the transfer includes Sun and Earth third-body terms.
    Output a one-line statement per item for the docs (D3).
P2. **Payload maximisation** (Otto: "how do we get the most research material to the Moon", "NASA cares
    about mass optimisation"): for the chosen vehicle, site and dates, compute the maximum payload landed
    when propellant is exactly what the flight needs (Tsiolkovsky per stage, mass decreasing over each burn,
    reserve margin stated). Show "max payload: X kg ± ε" in the Rocket flight menu and the propellant
    breakdown per phase in the collapsed details.
P3. **Minimum-propellant route** (Otto): over the options the planner already has (launch day within the
    window, transfer type, orbit design), pick the one with lowest total propellant; show why it wins
    (Δv per phase vs the next best).
P4. **Blue Moon shortfall**: Leo's log says the Blue Moon lander is short of propellant everywhere. Check
    `flight/hardware.ts` against a sourced value (cite it). If the data is wrong, fix with source; if the
    model is wrong, fix the model; if both are right, the UI says so plainly.
P5. **Perturbations + dispersion tube** (notebook + Otto: "+- epsilon and perturbation, a kind of tube"):
    add the Moon's J2 term to the lunar-orbit/descent phase (cite value). Then a Monte Carlo of N=200 runs in
    the existing `planWorker.ts` with dispersions in burn magnitude, burn direction, launch time and Isp (each
    σ sourced or stated as an assumption) → draw the 1σ/3σ envelope around the trajectory and report landing
    dispersion (km) and propellant spread. Must stay responsive: run in the worker, progress shown.
P6. **Uncertainty budget**: for every number shown in the UI (light %, contact %, Δv, propellant, payload,
    landing error) a stated ε, with propagation (Gaussian, partial derivatives, or the Monte Carlo of P5) and
    the dominant term named. Include Moon rotation at the site (~4.6 m/s × cos lat, ≈ 0.4 m/s at 85° S) as a
    quantified, negligible term. Write the table to `docs/scientific-proof/uncertainty.md` for D3.
P7. Mark all P2–P6 outputs "not yet validated by the science lead" (trap 2).

Not in scope (decided, see report to ninja): astronaut-nutrition trade-off as a feature; full raytracing or
Monte Carlo for sunlight.

Done = new tests per item, all suites green, planner still returns a plan for every site in
`flight/anySite.test.ts`, a 375 px check of the Rocket flight menu.

## Workstream D — docs (agents and timing: see Orchestration)

D1. **`/docs` page** on https://nasa.digi-works.org/docs: full page (not a drawer), same tokens and type as
    the main page (`styles/tokens.css`), clean, one column, side table of contents. Single source: render
    from `docs/*.md` at build time so a new calculation or source added to `docs/` updates the page without
    hand-editing (ninja's standing rule). Isaac adds the domain route himself; you only make `/docs` work on
    a direct load, routed in `main.tsx` so `App.tsx` is not touched.
D2. **`docs/credits.md`**: every 3D model, artwork, texture, icon, font, library with link and licence
    (scan `app/public/`, `node_modules` licences of shipped deps, `scripts/textures.py`, `views/Icon.tsx`);
    every data source and scraped source (POI research `docs/POIs/*.json`, `docs/reference/data-sources.md`,
    `docs/reference/sources.md`). Special thanks, exactly:
    - Dagny Gocher and Elia Jonas — our supervisors and teachers
    - The Student Research Center in Bad Saulgau, Germany (SFZ) — https://sfz-bw.de
    - MEXG, our school — https://mexg.de
    - Sponsor: Prime Balance — https://prime-balance.de
    - Our team: Otto Erwerle — Code & Backend Lead · Leonhard Greiner — Science Lead · Isaac Brauer — AI Lead ·
      Benedikt Schmidt — Design & Frontend Lead
D3. **`docs/scientific-proof/`**: one file per calculation (sunlight/horizon, Earth visibility/contact,
    ranking score, trajectory, descent, payload, dispersion, uncertainty), each with: equation, inputs with
    source, assumptions, ε and its propagation, test that checks it, validation status. As detailed as
    possible. Everything else on the docs page: short and understandable.
D4. **Why ours is better** (Otto): one section comparing against the tools in
    `docs/reference/existing-tools.md`, claim by claim, each claim backed by a feature that exists on main.
D5. Update `docs/documentation.md` and `content.tsx` (or retire `content.tsx` if D1 makes it redundant).

Done = `/docs` loads directly and from in-app link in `vite preview`, every link in credits returns 200
(check with curl, list failures), full team names appear only in credits (`grep -rn "Greiner\|Erwerle\|Brauer"`
outside `docs/credits.md`, `docs/reference/decisions.md`, `ORCHESTRATOR-PROMPT.md` and the built docs page
returns nothing).

## Merge, push, deploy

- Push to `main` only in wave 4, after the full suites pass (allowed by AGENTS.md); show ninja the diff stat first.
- **Deploy needs ninja's explicit yes** in chat; record Cloudflare `Created` time and Worker version in BUILD_LOG.
- Abort: anything not green stays on its branch; `main` stays at the last green commit.

## Ask ninja (the only decisions that are his)

1. Deploy.

## Final report

Per task ID: done / dropped / needs decision, commit hash, test names, screenshot paths. Then the BUILD_LOG
lines and AI-use log rows you wrote.
