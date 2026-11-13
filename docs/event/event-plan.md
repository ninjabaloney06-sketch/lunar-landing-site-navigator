# Event plan — hackathon weekend, Sat 14 Nov 10:30 → Sun 15 Nov 15:45

Logistics and schedule for the ~28.5 hours between hacking start and our submission target (about 19 hours of human work after sleep and meals). Written before the event from repo facts only:
[TASKS.md](../../TASKS.md) phases 3–6, [decisions.md](../reference/decisions.md) ("Event facts", "Heilbronn schedule",
"Official rules read", "Team strengths and roles"), [AGENTS.md](../../AGENTS.md). No project code, no spec,
no app designs in here — those are decided at the event (prep rule).

**28 Oct comparison complete:** the current challenge page + Sarah's 12 Oct email are the basis for the review (ninja). No later statement/resources publication blocks this plan. Basic site/date comparison and [UX-01–05](../reference/existing-tools.md#product-follow-through--28-oct-2026) are required; optional score, side-by-side layout and map may be cut. Check submission-form instructions separately before the event.

**Hard anchors**

- Local submission deadline: **Sun 15 Nov, 15:45** (OpenSpace Heilbronn). The global deadline (23:59)
  exists but the local one counts for us (decisions.md) — this plan targets **submit by 15:00**, a
  45-minute buffer. We do not plan around the global window.
- Official project start: Sat 14 Nov, **09:00** local (Team Formation Guide, quoted in decisions.md).
  Before that: setup and logistics only.
- Venue schedule ([official local schedule](https://www.spaceappschallenge.org/2026/local-events/heilbronn/?tab=schedule), re-read 13 Nov):
  Sat 08:30 registration + breakfast, 09:00 opening, 09:30 challenge lightning talks, 10:00 team formation,
  **10:30 hacking begins, 11:00 Mentor Round #1 (problem validation)**, 13:00 lunch, 13:45 sprint #2,
  16:00 mentor office hours, **18:00 progress check: 60-second stand-ups**, 18:45 dinner, 19:30 night sprint,
  21:30 optional mentor clinic, 22:30 day-1 wrap-up. Sun 07:30 breakfast, 09:00 final build sprint,
  **10:30 Mentor Round #2 (judge your project)**, **12:00 submission & pitch workshop**, 12:30 lunch,
  13:15 submission sprint, **14:30 submission checkpoint**, 15:00 pitch rehearsals, **15:45 deadline**,
  16:00 pitches + live judging, 17:30 deliberation, 18:00 awards.
- Four checkpoints guard the build: Sat **16:00** (ephemeris validated), Sat **20:00** (sky plot with
  real ephemeris), Sat **21:30** (horizon go/no-go), Sun **12:00** (feature freeze). Submission checkpoint:
  Sun **15:00** (form submitted).
- Compliance during the build (decisions.md, "Official rules read"): keep the AI/SI-use log running
  from the first hour (tool, what it did, who ran it — the submission must describe it); cite every
  source and state every material's license; demo video is screen-only with captions or TTS — no
  faces, voices or recognizable names of anyone under 18; original content open source (Apache 2.0
  unless we choose otherwise).

## Roles (agreed 26 Oct)

Mapping from decisions.md ("Roles agreed and sleeping at the venue", 26 Oct): S = L, Q = O, D = B, I = ninja. Everyone presents; I owns submission integration. Keep the checkpoints if assignments change.

| Role | Owns | Person |
|---|---|---|
| **S** — science lead | coordinate frames, ephemeris + horizon validation (Horizons, PGDA), score formula, science call at 21:30, physics Q&A in pitch | L |
| **Q** — code checks | unit tests, review of agent-written scripts, security check before deploy; drives the Track B (horizon) agents on Saturday | O |
| **D** — frontend + design | app shell, site picker, sky plot, timeline, comparison view, deploy | B |
| **I** — Isaac | product, spec, integration, agent orchestration, submission form, pitch | Isaac |

Agent capacity (decisions.md, updated 13 Nov): one Max 20x + one Max 5x plan, Isaac drives all agents via one orchestrator → parallel agents on
separate worktrees, one file set per agent (AGENTS.md). Standing rule: agents write, a human runs and
reviews — S signs every number that reaches the UI.

## Sleep plan — at the venue

**Decided 26 Oct:** the whole team stays at the venue with Dagny Locher; everyone brings a sleeping bag and mat. This replaces the hostel plan. Sarah requires the accompanying adult to stay with the participants throughout, including overnight; she does not require two teammates to keep working.

**DECIDED by ninja, 13 Nov: sleep in two batches.** Leo + Isaac sleep **22:00–01:00**, Otto + Bene sleep **01:00–04:00** (Isaac and Leo concentrate badly after 22:00; Otto and Bene work well late). This replaces the 26 Oct six-hour baseline; ninja accepts the shorter sleep and plans to catch up after the event. Consequences in the timeline below: go/no-go moved to 21:30, handover 21:40–21:30, Otto and Bene take the official 22:30 wrap-up, Sunday work starts at 01:00. The Betreuerin (Dagny Locher) must confirm, since she stays with the team all night.

## Food and breaks

- Meals are on the venue schedule (breakfast/lunch/dinner, both days per the organiser). Serving
  times not published — check the board at check-in and put them on the whiteboard. Plan slots below
  are placeholders until then.
- Nobody skips a meal; whoever is on break hands their track to their partner; agents keep running
  during breaks.
- Break rhythm per person: 5–10 min roughly every 90–120 min, away from the screen; drink water; one
  short walk after each checkpoint. S takes an explicit pause before every validation sign-off.
- Bring snacks/water; overnight kitchen access is unknown — check at the venue.
- Packing (phase 0, due Thu 12 Nov, team check Fri 13 Nov morning): laptops, chargers, power strips (sockets scarce — organiser 12 Oct),
  adapters, headphones, ID, tickets, signed authorisations naming the Betreuer, USB stick with raw
  data, sleeping bag, mat and phone hotspot.

## Saturday 14 Nov — 08:30 to 10:30 (setup, before hacking begins)

| Time | Who | What |
|---|---|---|
| 08:30–09:00 | All + Betreuer | Check-in, breakfast, find a table, set up power strips, test Wi-Fi. Write venue meal times + Wi-Fi password on the table card. |
| 09:00–09:15 | I | Official project start (09:00). Start the AI/SI-use log (tool, what it did, who ran it) — runs from now to submission. |
| 09:30–10:00 | All | Challenge lightning talks: listen for anything said about our challenge or judging. |
| 10:00–10:25 | I; Q, D, S | Team formation slot (we are formed): I confirms our team page lists the challenge; Q, D and S set up laptops offline-ready and verify USB-stick checksums against `docs/reference/data-sources.md`. |
| 10:25–10:30 | All | Quick sync: roles confirmed? Who drives which agents today. |

## Saturday — 10:30 to 12:30 (kickoff, phase 3)

| Time | Who | What |
|---|---|---|
| 10:30–11:00 | All, I leads | **Kickoff (30 min, replaces the spec interview since the build plan exists):** confirm build-plan §9 decisions 1–8 and the step-1-lite fallback trigger (Sat 18:00), name the demo owner. |
| 11:00–11:45 | I + S | **Mentor Round #1 (official):** show the problem statement and [plan-review-13nov.md](plan-review-13nov.md) §4, ask what a judge would attack, ask for a lunar/geodesy contact for the validation plan, whether first names of minors may appear in the submission, and how the local judges judge (pitch length, live demo or slides, project page read first?). Q and D start step 0 meanwhile. |
| (reference) | — | Old spec-interview scope, now covered by the build plan: an agent interviews the team and writes `docs/event/spec.md`. Work backwards from the winning demo: who the user is, one-sentence problem and solution, the demo story (≤30 s, see below), the required site/date selection, combined Sun/Earth sky plot, numbers and timeline; at least two validated sites and two supported date ranges; UX-01–05 checks; optional map, score and side-by-side layout; the JSON contract between scripts and frontend. Also: the user's decision and the one-sentence answer the app gives, one named demo owner (proposal: D), a ≤30 s storyboard, and a one-line-per-criterion judging map (Impact, Creativity, Validity, Relevance, Presentation). See [past-winners.md](../reference/past-winners.md). Isaac decides. |
| 11:30–12:15 | I + agents | Isaac cuts the spec to one page; team confirms. Agents scaffold the repo skeleton from the spec: `scripts/`, `scripts/tests/`, `data/`, Vite + React frontend, sample JSON in the agreed format, LICENSE (Apache 2.0 unless we choose otherwise). |
| 12:15–12:30 | All | Lock the JSON contract and the worktree/file-set split per track. Agents start on the three tracks. |

## Saturday — 12:30 to 22:45 (build, phase 4, three parallel tracks)

Lunch ~12:30–13:00 in rotating pairs (serving time unknown — check). Tracks run through it; agents
don't eat. Every block ends with the output committed so the next block builds on it.

| Time | Track A — ephemeris (I + agents, S validates) | Track B — terrain horizon (Q + agents, S validates) | Track C — frontend (D + agents) |
|---|---|---|---|
| 12:30–14:30 | `scripts/ephemeris.py`: lat/lon/elevation + time range + step → Sun/Earth az/el in the local horizon frame (spiceypy, kernels from the USB stick) | `app/public/data/sites.json` from `docs/reference/sources.md` (checked entries only, source link per site); start `scripts/horizon.py` (rays in 360 directions, 1° steps, ~100–150 km, curvature, numpy, cached JSON) | UX-02/03: obvious site/date controls, signed-out core flow, site-list fallback, loading/error/input checks (sample JSON) |
| 14:30–16:00 | Q writes geometry tests plus UX-01 observer/target/output regressions; S verifies the lunar reference metadata and 10 sample points against Horizons (< 0.05°), recording evidence in `docs/event/validation.md` | `horizon.py` runs end-to-end on one site; Earth phase + Sun–Earth separation output added to A | Sky plot frame: horizon outline rendering, placeholder tracks |
| **16:00 — checkpoint 1** | **S: ephemeris validated?** Pass → real ephemeris JSON feeds the sky plot. Fail → pivot to a published-table subset, clearly labelled; I + S decide by 16:30, agents re-tasked. | geometry re-checked by S (curvature, ray length, Sun as 0.5° disk) | plug real ephemeris into the sky plot |
| 16:00–18:00 | Sun–Earth separation + phase output finished; agents freeze A unless bugs surface | ray casting vectorised + cached for all candidate sites; performance pass | Sun/Earth tracks live in the sky plot |
| 18:00 | All, I speaks | **Official 60-second stand-up:** what works, what the 21:30 call decides, one ask for mentors. Prepare the 3 sentences at 17:45. | | |
| 18:45–19:30 | Dinner, all four, rotating (venue schedule) | | |
| 19:00–20:00 | A on standby for B/C integration questions | S validates horizon/window results with compatible periods and disc/centre definitions; long-term PGDA averages alone cannot validate a short window. Record evidence in `docs/event/validation.md`; Q reviews `horizon.py` | **20:00 — checkpoint 2: sky plot with real ephemeris data.** Isaac checks it against a known case. Pass (together with 21:30) → optional side-by-side view unlocked; basic site/date comparison remains required. Then D deploys a public no-login preview (private-window phone check) and the demo owner records a 10–20 s clip. |
| 20:00–21:15 | Bugfix queue from C; A supports B | finish PGDA comparison; prepare the 21:30 evidence pack (validation tables) | polish sky plot; start timeline scaffolding |
| 21:15–21:30 | All — pitch rehearsal 1 with a timer: demo story, what exists so far, what each judge question gets for an answer | | |
| **21:30 — go/no-go** (moved from 22:00 on 13 Nov: Leo and Isaac sleep from 22:00) | **S makes the science call: are horizon masks validated?** Pass → full site set. Partial → fewer sites, labelled. Fail → published data, clearly labelled — wrong numbers never ship (decisions.md). Also fixes optional scope (side-by-side view needs 20:00 + 21:30 passed); fewer than two validated sites leaves an explicit challenge gap. T14 stop rule (build-plan §5.4) is decided here too. | | |
| 21:40–22:00 | I + S → Q + D | **Handover:** Isaac gives the orchestrator the night queue and tells Otto what he may approve; Leo writes the open number checks for 01:00. |
| 22:00–01:00 | **Q + D awake, I + S sleep** | Otto + Bene attend the official 22:30 day-1 wrap-up for the team, watch the orchestrator, Otto reviews finished branches, Bene approves or rejects screenshots. No merges, no deploys, no number sign-offs. |
| 01:00–04:00 | **I + S awake, Q + D sleep** | Isaac merges what Otto reviewed; Leo signs the open checks; Sunday phase 5 (steps 2 and 2b) starts now instead of 07:30. |
| 04:00 → | All awake | Sunday plan below, now with three extra hours of buffer. |

## Overnight — no required build work

**Agents work overnight, humans sleep (added 13 Nov; Sarah, 12 Nov: "you can code at the event venue through the night").** Before 22:00, Isaac gives the orchestrator an overnight queue of gate-free work only, each on its own branch, **nothing merged until Isaac is back at 01:00 and Otto has reviewed it**:
- horizons, terrain tiles and textures for every remaining curated site (Track B, already-signed method);
- 3D polish branch (step 6 items) and screenshot rounds against the reference images;
- Playwright tests for UX-01–05 and T10, CSV export, README and submission-text drafts (Haiku).
Not overnight: anything that needs Leo's sign-off to be meaningful, changes to the data contracts, merges, deploys. Laptops plugged in, sleep disabled, lid open. Otto reviews branches during 22:00–01:00; Isaac reads the reports and merges at 01:00; whatever finishes 01:00–04:00 Otto reviews at 04:00.

Shift plan above (22:00–01:00 / 01:00–04:00). No unattended agent output is merged without Q's review and S's numeric sign-off. Resume phase 5 at 07:30; cut optional features if the morning queue is too large.

## Sunday — 07:30 to 12:00 (phase 5: windows, views, deploy)

Breakfast at doors-open (time on the board). Doors open 07:30 for day guests — we are already inside.

| Time | Who | What |
|---|---|---|
| 07:30–09:00 | I + Q, D, S | Build/review `windows.py` and summaries from Saturday's validated inputs. D builds the timeline, combined numeric Sun/Earth output and source/context labels (UX-04/05). S checks definitions. Basic site/date comparison is required. |
| 09:00–10:30 | I + Q + D, S | Finish required comparison across two sites/two supported date ranges. Run UX-01–05 on desktop and 375 px touch viewport: original question within 60 s, site/date change within 10 s; signed-out, invalid input, failed data load and map unavailable. S verifies numbers; record evidence in docs/event/validation.md. Score/side-by-side only if core checks pass and time remains. |
| 10:00–11:00 | S + I (agents) + Q | I's agents fix UX-01–05 failures while D finishes the comparison. **S spot-checks 5 UI values against validated scripts; mismatch or a core usability failure blocks freeze.** Q checks secrets/keys/personal data and pinned dependencies. |
| 10:30 | I + D | **Mentor Round #2 (official, "judge your project")**: a mentor uses the app cold with ninja's demo question and the finder ("the date slipped to Dec — what now?"). Record time-to-answer for UX-01. |
| 11:00–11:30 | D (device agent on D's/B's machine or Isaac's) | Deploy to the same URL as Saturday's preview (Vercel / Cloudflare Pages, account created in phase 2), test the URL on a phone in a private window. |
| 11:30–12:00 | All | Freeze sweep: console errors, broken links, missing citations visible in the UI. |
| **12:00 — feature freeze** | All | Only bug fixes after this line. |

## Sunday — 12:00 to 18:00 (phase 6: submission and pitch)

| Time | Who | What |
|---|---|---|
| 12:00–12:30 | I (+ one more) | **Official submission & pitch workshop.** Take notes on form fields and pitch format; update the submission checklist. |
| 12:30–13:15 | All | Lunch (venue schedule). Last full-team sync before submission. |
| 12:30–13:30 | I drafts (agents), I cuts; Q parallel | Project page text: summary, how it works, data sources, limitations. Cite every source, state every material's license (NASA can reject or strip awards for missing citations), include the AI/SI-use description from the phase-3 log. Q: README in parallel — data sources, licenses, how to run; make the judged code public only if the Submission Guide requires a code link (Isaac decides; actual form/organiser requirements checked in phase 2). |
| 13:30–14:30 | Demo owner records; I, D + S parallel | Demo video per the actual submission format checked in phase 2 (default ≤30 s video or ≤7 slides; 2022 judges stopped at the limit), built from the spec storyboard and the checkpoint clips. Screen-only, English captions or TTS — no faces, voices or recognizable names of anyone under 18. AI drafts structure and captions. Check: runtime within limit, link opens without login. Others fix last bugs; S preps pitch backup numbers. |
| 14:30 | I | **Official submission checkpoint:** a complete draft is in the form (all fields, links working). |
| 14:30–15:00 | I | Isaac opens every link in the form in a private window, reviews the filled submission form on the team's project page end to end, then **clicks submit by 15:00**. Save the confirmation screenshot to `docs/`. |
| 15:00–15:30 | All | Buffer use: re-submit if a fix was needed, then **pitch rehearsal 2 with a timer** — live demo, screen recording and an offline build as backup. Before it, someone outside the team (Betreuerin or a mentor) watches the demo cold and repeats the problem and the answer. |
| 15:30–15:45 | All | Pure buffer. Nothing new gets touched. |
| **15:45 — local submission deadline** | — | Deadline passes; submission is already in. |
| 15:45–16:00 | All | Demo setup for the pitch: online build, screen recording queued, offline build ready. |
| 16:00–17:00 | I (All stand by) | Pitch to the local judges, within the time slot. S takes physics questions; live demo from the validated app. |
| 17:00–18:00 | All | Collect judge and mentor feedback while it is fresh (phase 7). |
| 18:00 | All | Awards. After: walk to Heilbronn Hbf (18 min) and train home ([docs/event/where-when.md](where-when.md)). |

## Checkpoints and what they decide

| When | Checkpoint | Owner | Pass | Fail |
|---|---|---|---|---|
| Sat 16:00 | Ephemeris validated: 10 sample points vs JPL Horizons, < 0.05°, table in `docs/event/validation.md` | S | Real ephemeris feeds the sky plot | Published-table subset, clearly labelled; I + S re-task agents by 16:30 |
| Sat 20:00 | Sky plot runs on real ephemeris; Isaac checks against a known case | I (+S for the known case) | Optional side-by-side view unlocked (needs 21:30 too); basic comparison stays required | Debug until 21:30, then published-data subset, labelled |
| Sat 21:30 | Horizon go/no-go: compatible reference definitions, DEM geometry and documented uncertainty | S (science call) | Validated site set | Fewer sites or published data, clearly labelled; a single site remains a challenge gap |
| Sun 12:00 | Feature freeze — gated by S's 5-value UI spot-check, UX-01–05 acceptance and Q's security check | S + Q | Freeze; bug fixes only | Numeric mismatch, core UX failure or security finding blocks freeze until fixed |
| Sun 15:00 | Submission form clicked, screenshot saved | I | 45-min buffer before the deadline | Use the buffer to fix and re-submit; escalation at 15:30 latest |

## Build order (ninja, 11 Nov)

Full detail per step (contents, owners, target times, agent briefs): [build-plan.md §8](build-plan.md#8-build-order-owners-timing).

Work strictly in order of importance and see how far we get. Two rules:

- **Bug gate:** a step counts as done only when its known bugs are fixed and Leo/Otto have signed off its numbers and code. Nobody starts the next step before that.
- **Feature stop:** no new features after the feature freeze; only bug fixes.

| Order | Step | Starts when |
|---|---|---|
| 1 | Core (required): Sun + Earth vs. terrain horizon in the sky plot, site and date selection, comparison of ≥ 2 sites and ≥ 2 date ranges | Sat 10:30 |
| 2 | Time left before sunset / Earthset; solar elevation shown large; sunlight hours and Earth-visible windows as numbers | Step 1 passed the bug gate |
| 3 | Time scrubber over one or more lunar days (form: inspiration #19); dates chosen to show different lunar days and seasons | Step 2 passed |
| 4 | Side-by-side view; 2D south-pole map as site picker | Step 3 passed and horizon go at 21:30 |
| 5 | More curated sites beyond the south pole (Apollo, other countries), each with a validated horizon | Step 4 passed |
| 6 | Light 3D view (one low-res lunar texture, no models, pixel ratio capped at 1) | Step 5 passed |
| 7 | Custom lat/long input (needs a horizon computed on demand; label the accuracy) | Step 6 passed |

Team laptop model (ThinkPad X1 Carbon Gen 13: Core Ultra 7 256V, Arc 140V, 16 GB) handles a light 3D view, so step 6 is a time question, not a hardware one.

## Cut list (in order — cut top-down, one checkpoint at a time)

Triggers: a failed checkpoint, or the next block starting with the previous one unfinished.

1. **Cut the score** (power-and-comms formula, score column). Trigger: timeline not working by Sun
   10:30, or the 21:30 go/no-go failed. The demo stands without a number.
2. **Cut the comparison view** (side-by-side 2–3 sites). Trigger: 20:00 or 21:30 checkpoint failed.
   Keep basic switching between at least two validated sites and two supported date ranges. A single-site demo is an explicit challenge gap, not a complete replacement.
3. **Cut the site map** (site picker map). Trigger: frontend behind schedule Sun ~11:00. A plain
   site list with sources replaces it.

**3D view:** step 6 of the build order, only after steps 1–5 pass. No game or first-person view. Three of four past lunar winners had 3D, but non-winners did too, and our brief is a decision tool ([past-winners.md](../reference/past-winners.md), P8).

**Never cut: correct combined Sun/Earth output, sky plot + daily timeline, and basic site/date comparison.** Use simple lists/selectors and validated (or clearly labelled published) data. If the data cannot support two sites and two periods, report the remaining challenge gap; do not relabel a single-site fallback as complete. Keep a recorded demo as backup.

## Unknown — check (in this order at check-in Sat 08:30)

- Exact meal times Sat/Sun (board at the venue) and overnight kitchen/vending access.
- Friday 13 Nov: no separate programme known as of 12 Oct; organisers said they notify separately if
  one exists — check the last organiser messages before travelling.
- Team/Betreuer confirmation of the venue sleep block; bring bedding. No hostel arrangements remain.
- Actual submission form / organiser instructions: media format, required fields and code-link requirements. A future guide is not a prerequisite for the completed 28 Oct comparison.
- Train times both ways (travel task, phase 0).

Roles and venue sleeping location were confirmed 26 Oct (decisions.md). The team and Betreuer still confirm the sleep hours; the build plan does not require a human night shift.
