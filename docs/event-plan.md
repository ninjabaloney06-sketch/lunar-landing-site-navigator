# Event plan — hackathon weekend, Sat 14 Nov 10:30 → Sun 15 Nov 15:45

Logistics and schedule for the 30 build hours. Written before the event from repo facts only:
[TASKS.md](../TASKS.md) phases 3–6, [decisions.md](decisions.md) ("Event facts", "Heilbronn schedule",
"Official rules read", "Team strengths and roles"), [AGENTS.md](../AGENTS.md). No project code, no spec,
no app designs in here — those are decided at the event (prep rule).

**Hard anchors**

- Local submission deadline: **Sun 15 Nov, 15:45** (OpenSpace Heilbronn). The global deadline (23:59)
  exists but the local one counts for us (decisions.md) — this plan targets **submit by 15:00**, a
  45-minute buffer. We do not plan around the global window.
- Official project start: Sat 14 Nov, **09:00** local (Team Formation Guide, quoted in decisions.md).
  Before that: setup and logistics only.
- Venue schedule: Sat check-in 08:30, hacking begins 10:30, day-1 wrap 22:30; Sun doors open 07:30,
  live pitches from 16:00, awards 18:00. Breakfast, lunch and dinner are on the venue schedule
  (exact serving times unknown — check the schedule board on site).
- Four checkpoints guard the build: Sat **16:00** (ephemeris validated), Sat **20:00** (sky plot with
  real ephemeris), Sat **22:00** (horizon go/no-go), Sun **12:00** (feature freeze). Submission checkpoint:
  Sun **15:00** (form submitted).
- Compliance during the build (decisions.md, "Official rules read"): keep the AI/SI-use log running
  from the first hour (tool, what it did, who ran it — the submission must describe it); cite every
  source and state every material's license; demo video is screen-only with captions or TTS — no
  faces, voices or recognizable names of anyone under 18; original content open source (Apache 2.0
  unless we choose otherwise).

## Roles (proposal, not agreed)

Mapping from decisions.md ("Team strengths and roles", 22 Oct). TASKS.md phase 0 has role agreement
as an open task — if the team agrees different roles, remap the names, keep the checkpoints.

| Role | Owns | Person (proposed) |
|---|---|---|
| **S** — science lead | coordinate frames, ephemeris + horizon validation (Horizons, PGDA), score formula, science call at 22:00, physics Q&A in pitch | L |
| **Q** — code checks | unit tests, review of agent-written scripts, security check before deploy | O |
| **D** — frontend + design | app shell, site picker, sky plot, timeline, comparison view, deploy | B |
| **I** — Isaac | product, spec, integration, agent orchestration, submission form, pitch | Isaac |

Agent capacity (decisions.md): Isaac's Claude account + O's two Claude Max plans → parallel agents on
separate worktrees, one file set per agent (AGENTS.md). Standing rule: agents write, a human runs and
reviews — S signs every number that reaches the UI.

## Sleep plan (team of 4, at least 2 awake)

**Decided 25 Oct: we sleep at the Jugendherberge Heilbronn, not at the venue.** The Betreuerin (Dagny Locher)
sleeps there, and she has to stay with us, so everyone leaves the venue after the 22:30 wrap-up and is back
at 07:30 ([WHERE-WHEN.md](../WHERE-WHEN.md)). The shift table below only works if the hostel has Wi-Fi
in a common room and quiet hours allow it; otherwise everyone sleeps 23:00–06:45. The venue-overnight text
below is kept for reference.

Overnight at the venue is allowed with the Betreuer; no sleeping accommodation provided — bedding
comes with us (decision venue vs. off-site is an open phase-0 task, due 7 Nov). The arithmetic first:
22:45–07:30 is 8 h 45; with 2 of 4 sleeping at a time there are only ~17.5 bed-hours for 4 × 6 h = 24
person-hours of sleep. Both TASKS.md rules ("at least 6 hours each" and ≥ 2 awake) cannot hold
simultaneously. Baseline below keeps ≥ 2 awake at all times and gets two members a full 6 h; the two
night-shift members get ~2 h 45 plus optional staggered top-ups Sunday. If the team prefers, the
alternative is one all-hands sleep block 23:00–05:15 (everyone ≥ 6 h, nobody awake 23:00–05:15) —
that needs the Betreuer's OK and a team decision; decide together with the sleeping-plan task by 7 Nov.
TASKS.md warning stands: tired people ship wrong numbers.

| Block | Asleep | Awake and what they do |
|---|---|---|
| 22:45 → 04:45 | **D (B), S (L)** — 6 h | **I, Q (O)** — night shift: run and review agent tasks on inputs that already exist (windows/summaries drafts, glossary, JSON plumbing), quiet work, no deploy, no irreversible decisions |
| 04:45 → 07:30 | **I, Q (O)** — 2 h 45 | **D, S** — from 04:45: validate the night agents' output, start phase-5 morning items (timeline from summary JSON, spot-check list) |
| 07:30 onward | — | all four; staggered 30–45 min top-up naps for I and Q during 08:00–09:00 only if phase 5 is on schedule |

Betreuer: present for the whole event including overnight (organiser requirement); one Betreuer covers
our four and a second team. How the shared Betreuer covers the night across two teams — unknown — check
with the organiser/Betreuer; name and written authorisations due 7 Nov (phase 0).

## Food and breaks

- Meals are on the venue schedule (breakfast/lunch/dinner, both days per the organiser). Serving
  times not published — check the board at check-in and put them on the whiteboard. Plan slots below
  are placeholders until then.
- Nobody skips a meal; whoever is on break hands their track to their partner; agents keep running
  during breaks.
- Break rhythm per person: 5–10 min roughly every 90–120 min, away from the screen; drink water; one
  short walk after each checkpoint. S takes an explicit pause before every validation sign-off.
- Night shift: bring snacks and drinks for 22:45–07:30 — kitchen/vending access overnight unknown — check.
- Packing (phase 0, due 7 Nov): laptops, chargers, power strips (sockets scarce — organiser 12 Oct),
  adapters, headphones, ID, tickets, signed authorisations naming the Betreuer, USB stick with raw
  data, overnight bag (hostel), DJH group card, phone hotspot.

## Saturday 14 Nov — 08:30 to 10:30 (setup, before hacking begins)

| Time | Who | What |
|---|---|---|
| 08:30–09:00 | All + Betreuer | Check-in, breakfast, find a table, set up power strips, test Wi-Fi. Write venue meal times + Wi-Fi password on the table card. |
| 09:00–09:15 | I | Official project start (09:00). Start the AI/SI-use log (tool, what it did, who ran it) — runs from now to submission. |
| 09:15–10:25 | I (S joins for validation questions) | Mentor round inside the first 2 hours: show the problem statement, ask what a judge would attack, ask for a lunar/geodesy contact for the validation plan, ask whether first names of minors may appear in the submission. Meanwhile: Q, D and S set up laptops offline-ready and verify USB-stick checksums against `data/SOURCES.md`. |
| 10:25–10:30 | All | Quick sync: roles confirmed or still proposed? Who drives which agents today. |

## Saturday — 10:30 to 12:30 (kickoff, phase 3)

| Time | Who | What |
|---|---|---|
| 10:30–11:30 | All, I leads | Spec interview (about 1 h): an agent interviews the team and writes `docs/spec.md`. Work backwards from the winning demo: who the user is, one-sentence problem and solution, the 60-second demo story, the four screens (site picker map, polar sky plot with horizon outline and Sun/Earth tracks, daily timeline, side-by-side comparison with score), default date range, and the JSON contract between scripts and frontend so tracks can run in parallel. Isaac decides. |
| 11:30–12:15 | I + agents | Isaac cuts the spec to one page; team confirms. Agents scaffold the repo skeleton from the spec: `scripts/`, `tests/`, `data/`, Vite + React frontend, sample JSON in the agreed format, LICENSE (Apache 2.0 unless we choose otherwise). |
| 12:15–12:30 | All | Lock the JSON contract and the worktree/file-set split per track. Agents start on the three tracks. |

## Saturday — 12:30 to 22:45 (build, phase 4, three parallel tracks)

Lunch ~12:30–13:00 in rotating pairs (serving time unknown — check). Tracks run through it; agents
don't eat. Every block ends with the output committed so the next block builds on it.

| Time | Track A — ephemeris (I + agents, S validates) | Track B — terrain horizon (I + agents, S validates) | Track C — frontend (D + agents) |
|---|---|---|---|
| 12:30–14:30 | `scripts/ephemeris.py`: lat/lon/elevation + time range + step → Sun/Earth az/el in the local horizon frame (spiceypy, kernels from the USB stick) | `data/sites.json` from `docs/sources.md` (checked entries only, source link per site); start `scripts/horizon.py` (rays in 360 directions, 1° steps, ~100–150 km, curvature, numpy, cached JSON) | App shell on sample JSON + site picker (examples from `docs/inspiration.md`) |
| 14:30–16:00 | Q writes unit tests from S's expected values (symmetry, Earth always low at the pole, Sun elevation bounds) and reviews the script; S validates 10 sample points against JPL Horizons (< 0.05°) into `docs/validation.md` | `horizon.py` runs end-to-end on one site; Earth phase + Sun–Earth separation output added to A | Sky plot frame: horizon outline rendering, placeholder tracks |
| **16:00 — checkpoint 1** | **S: ephemeris validated?** Pass → real ephemeris JSON feeds the sky plot. Fail → pivot to a published-table subset, clearly labelled; I + S decide by 16:30, agents re-tasked. | geometry re-checked by S (curvature, ray length, Sun as 0.5° disk) | plug real ephemeris into the sky plot |
| 16:00–18:00 | Sun–Earth separation + phase output finished; agents freeze A unless bugs surface | ray casting vectorised + cached for all candidate sites; performance pass | Sun/Earth tracks live in the sky plot |
| ~18:30–19:00 | Dinner, all four, rotating (time unknown — check) | | |
| 19:00–20:00 | A on standby for B/C integration questions | S validates one site's illumination against the PGDA published maps (same ranking, roughly matching percentages) into `docs/validation.md`; Q reviews `horizon.py` | **20:00 — checkpoint 2: sky plot with real ephemeris data.** Isaac checks it against a known case. Pass (together with 22:00) → comparison view unlocked for Sunday. |
| 20:00–21:45 | Bugfix queue from C; A supports B | finish PGDA comparison; prepare the 22:00 evidence pack (validation tables) | polish sky plot; start timeline scaffolding |
| 21:45–22:00 | All — pitch rehearsal 1 with a timer: demo story, what exists so far, what each judge question gets for an answer | | |
| **22:00 — go/no-go** | **S makes the science call: are horizon masks validated?** Pass → full site set. Partial → fewer sites, labelled. Fail → published data, clearly labelled — wrong numbers never ship (decisions.md). Also fixes which Sunday conditionals are live (comparison view needs 20:00 + 22:00 passed). | | |
| 22:00–22:30 | All — day-1 wrap-up (venue schedule): what works, what gets cut (cut list below), Sunday block assignments, first items for the night shift | | |
| 22:45 | Sleep shift 1: D + S sleep. I + Q hold the night shift (see sleep plan). | | |

## Overnight — 22:45 to 07:30

Night shift (I + Q) works only on inputs that already exist and stores nothing irreversible:
windows.py and the summary exports drafted against the agreed JSON format, glossary drafted from the
primer, JSON plumbing and tests for whatever B/L's tracks left unfinished. No deploy, no score-formula
decision (that needs the timeline working, called Sunday morning), no new sites. Betreuer present
throughout. Swap tasks are written down before D and S go to bed so the 04:45 handover takes 5 minutes.

## Sunday 15 Nov — 04:45 to 07:30

| Time | Who | What |
|---|---|---|
| 04:45 | D + S wake | 5-minute handover from I + Q: what the night agents produced, what is blocked. |
| 04:45–07:30 | D + S awake; I + Q asleep 04:45 | S validates the night agents' windows/summary output against the horizon + ephemeris results; D starts the daily timeline view from summary JSON. Quiet work; breakfast things out at 07:00. |

## Sunday — 07:30 to 12:00 (phase 5: windows, views, deploy)

Breakfast at doors-open (time on the board). Doors open 07:30 for day guests — we are already inside.

| Time | Who | What |
|---|---|---|
| 07:30–09:00 | I + Q (awake), D, S | Q reviews and merges the night agents' `scripts/windows.py` output (per step: `sun_visible` upper limb, `earth_visible` centre + margin, both, solar-disk fraction) and the summary exports (% lit, % Earth visible, longest darkness, longest comms blackout, overlapping windows) as static JSON per site. D builds the timeline (lit / Earth visible / both). Agents draft the glossary (horizon mask, DTE, libration, PSR) from the primer. Staggered top-up naps for I/Q if on schedule. |
| 09:00–10:30 | S, then D | **S: power-and-comms score formula, explainable in one sentence — only if the timeline works** (TASKS.md condition). **D: comparison view of 2–3 sites with score — only if the 20:00 and 22:00 checkpoints passed.** |
| 10:00–11:00 | S + D + Q | **S spot-checks 5 UI values against the validated scripts — any mismatch blocks the freeze.** Q runs the pre-deploy security check: no secrets, keys or personal data in repo or build; dependencies pinned. |
| 10:30–11:30 | D (device agent on D's/B's machine or Isaac's) | Deploy to Vercel / Cloudflare Pages (account created in phase 2), test the URL on a phone. |
| 11:30–12:00 | All | Freeze sweep: console errors, broken links, missing citations visible in the UI. |
| **12:00 — feature freeze** | All | Only bug fixes after this line. |

## Sunday — 12:00 to 18:00 (phase 6: submission and pitch)

| Time | Who | What |
|---|---|---|
| 12:00–12:30 | All | Lunch (serving time unknown — check the board). Last full-team sync before submission. |
| 12:30–13:30 | I drafts (agents), I cuts; Q parallel | Project page text: summary, how it works, data sources, limitations. Cite every source, state every material's license (NASA can reject or strip awards for missing citations), include the AI/SI-use description from the phase-3 log. Q: README in parallel — data sources, licenses, how to run; make the judged code public only if the Submission Guide requires a code link (Isaac decides; the guides were read 13 Nov in phase 2). |
| 13:30–14:30 | I records; D + S parallel | Demo video per the Submission Guide format: screen-only, captions or TTS — no faces, voices or recognizable names of anyone under 18. AI drafts structure and captions; Isaac records the screen. D + S fix last bugs; S preps pitch backup numbers. |
| 14:30–15:00 | I | Isaac reviews the filled submission form on the team's project page end to end, then **clicks submit by 15:00**. Save the confirmation screenshot to `docs/`. |
| 15:00–15:30 | All | Buffer use: re-submit if a fix was needed, then **pitch rehearsal 2 with a timer** — live demo, screen recording and an offline build as backup. |
| 15:30–15:45 | All | Pure buffer. Nothing new gets touched. |
| **15:45 — local submission deadline** | — | Deadline passes; submission is already in. |
| 15:45–16:00 | All | Demo setup for the pitch: online build, screen recording queued, offline build ready. |
| 16:00–17:00 | I (All stand by) | Pitch to the local judges, within the time slot. S takes physics questions; live demo from the validated app. |
| 17:00–18:00 | All | Collect judge and mentor feedback while it is fresh (phase 7). |
| 18:00 | All | Awards. After: walk to Heilbronn Hbf (18 min) and train home ([WHERE-WHEN.md](../WHERE-WHEN.md)). |

## Checkpoints and what they decide

| When | Checkpoint | Owner | Pass | Fail |
|---|---|---|---|---|
| Sat 16:00 | Ephemeris validated: 10 sample points vs JPL Horizons, < 0.05°, table in `docs/validation.md` | S | Real ephemeris feeds the sky plot | Published-table subset, clearly labelled; I + S re-task agents by 16:30 |
| Sat 20:00 | Sky plot runs on real ephemeris; Isaac checks against a known case | I (+S for the known case) | Comparison view unlocked for Sunday (needs 22:00 too) | Debug until 21:30, then published-data subset, labelled |
| Sat 22:00 | Horizon go/no-go: one site's illumination vs PGDA maps, same ranking | S (science call) | Full site set | Fewer sites or published data, clearly labelled — wrong numbers never ship |
| Sun 12:00 | Feature freeze — gated by S's 5-value UI spot-check and Q's security check | S + Q | Freeze; bug fixes only | Mismatch or security finding blocks the freeze until fixed |
| Sun 15:00 | Submission form clicked, screenshot saved | I | 45-min buffer before the deadline | Use the buffer to fix and re-submit; escalation at 15:30 latest |

## Cut list (in order — cut top-down, one checkpoint at a time)

Triggers: a failed checkpoint, or the next block starting with the previous one unfinished.

1. **Cut the score** (power-and-comms formula, score column). Trigger: timeline not working by Sun
   10:30, or the 22:00 go/no-go failed. The demo stands without a number.
2. **Cut the comparison view** (side-by-side 2–3 sites). Trigger: 20:00 or 22:00 checkpoint failed.
   Single-site deep-dive instead.
3. **Cut the site map** (site picker map). Trigger: frontend behind schedule Sun ~11:00. A plain
   site list with sources replaces it.

**Never cut: the polar sky plot and the daily timeline** — they are the demo. Floor if everything
else is gone: sky plot + timeline on validated (or clearly labelled published) data, plus the
recorded demo as backup.

## Unknown — check (in this order at check-in Sat 08:30)

- Exact meal times Sat/Sun (board at the venue) and overnight kitchen/vending access.
- Friday 13 Nov: no separate programme known as of 12 Oct; organisers said they notify separately if
  one exists — check the last organiser messages before travelling.
- Hostel: entry after 22:30, Sunday key return before 07:30, Wi-Fi in a common room, quiet hours —
  asked at booking by Dagny Locher ([WHERE-WHEN.md](../WHERE-WHEN.md)). Decides whether the night shift happens.
- Submission-format details from the Project Submission Guide and Judging & Awards Guide (published
  13 Nov; read in phase 2) — they decide the video format, public-repo question and form fields used
  in phase 6.
- Train times both ways (travel task, phase 0).

Open item from phase 0 that touches this plan: role agreement (`[H]` All) — the S/Q/D/I names above
stay "proposed" until the team confirms; the checkpoints do not depend on the names.
