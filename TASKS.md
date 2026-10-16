# Tasks

Markers: `[AI]` AI alone · `[AI+H]` AI does it, human checks/decides · `[H]` human only · `device` needs a device agent on Isaac's computer (browser, files, accounts). No tag = a repo-only agent is enough. See [README](README.md).

Downloads, copying files outside the repo, creating accounts and sending anything outside the team always need Isaac's explicit approval first, per action. Downloads go to Isaac's data computer by default (see [AGENTS.md](AGENTS.md)).

Roles: **S** = science teammate · **D** = data/web teammate · **I** = Isaac (product, UI, integration, pitch).

---

## Phase 0 — Organisation (now → 1 Nov)

- [x] `[AI+H]` `device` **I** — Register the 3-person team on the CLPS challenge page from Isaac's Space Apps account and invite S and D. Isaac approves before submitting and accepts the participation terms personally.
- [x] `[H]` **S, D** — Create your own Space Apps account and accept the team invite. Isaac confirms all three members show as linked.
- [x] `[AI+H]` `device` **I** — Ask the Heilbronn organisers (OpenSpace) for: Friday agenda, daily opening hours, Wi-Fi, food, overnight access, power sockets, number of global nominations, local prizes, and whether pre-event code is allowed. Agent drafts the email; sends from Isaac's account after Isaac approves the text. Answers go into `docs/decisions.md`. Reply arrived 16 Oct — answers in `docs/decisions.md`.
- [x] `[AI+H]` `device` **I** — Read the official participation terms and rules. Done 16 Oct: Participant Terms (7 Aug 2026) and participant FAQ read in a browser; rules summary and plan consequences in `docs/decisions.md` ("Official rules read", 16 Oct). Submission format and award categories are not findable before 13 Nov — the official guides publish then.
- [ ] `[AI+H]` `device` **I** — Ask Sarah in the next email two things: (1) the team registered their own Space Apps accounts (confirmed 16 Oct); the terms require under-18 registration by a parent or legal guardian — how should this be fixed, if it must be? (2) Written confirmation that the school-provided Betreuer plus one written authorisation per participant satisfies NASA's "accompanied by a parent or legal guardian at all times" wording — the FAQ lets local events set their own requirements, so her answer is the operative one.
- [ ] `[H]` **All** — Agree roles (S / D / I) and who owns the final submission form.
- [ ] `[H]` **All + parents** — Accompanying person = a Betreuer provided by Isaac's school (decided 16 Oct; the organiser said one adult can cover all three). Each participant's parents write a signed authorisation naming that Betreuer, valid for the whole event including overnight. Blocked on: the Betreuer's name — fill it in as soon as the school names them. Done by 7 Nov; every participant carries their own.
- [ ] `[H]` **All** — Decide the sleeping plan before booking travel: overnight at the venue is allowed with the chaperone, but the organiser provides no sleeping accommodation — bring bedding or book off-site; optionally take the organiser's offer to connect with local students (not guaranteed). Agent may research options; humans decide and book. Decide by 7 Nov.
- [ ] `[H]` **All** — Agree travel from Stuttgart: train or car, arrival before the 8:30 check-in on Sat 14 Nov, overnight per the decision above. Agent may look up connections and prices; humans book and pay.
- [ ] `[H]` **All** — Agree on a team chat tool and a weekly 30-minute sync slot.
- [ ] `[AI+H]` `device` **I** — Create the team chat and the recurring calendar invite from Isaac's accounts, then invite S and D. Isaac approves before invites go out.
- [x] `[AI]` — Create this repo, task list and requirements list.

## Phase 1 — Understand the problem (by 20 Oct)

- [ ] `[AI]` — Write a 1-page primer: why the lunar south pole has extreme lighting (Sun within ~1.5° of the horizon), why Earth hovers near the horizon (libration ±~7°), what direct-to-Earth (DTE) comms needs, what a horizon mask is.
- [ ] `[AI+H]` **S** — Verify the primer's physics. S signs off before anyone builds on it.
- [ ] `[AI]` — List current CLPS and Artemis south-pole sites with coordinates: Artemis III candidate regions, Shackleton–de Gerlache connecting ridge, IM-2 site, VIPER / Mons Mouton area, other planned CLPS polar landers. Every coordinate with source link.
- [ ] `[AI+H]` **S** — Check the site list against primary sources (NASA, LRO, mission pages). Remove anything without a source.
- [ ] `[AI+H]` `device` **I** — Test the existing tools (JPL Horizons, NASA Moon Trek, LRO QuickMap). Device agent runs the workflow "Sun and Earth elevation at site X over dates Y" once, writes the steps and screenshots into `docs/existing-tools.md`; then Isaac clicks through it, times it, and writes the 5 biggest pain points. These pain points are the pitch, so they must come from a human run.
- [ ] `[H]` **All** — Decide the primary user for the demo (mission planner vs. educator vs. public). One user, one story.
- [ ] `[AI+H]` **I** — Write a one-sentence problem statement and a one-sentence solution statement. Human picks the final wording.

## Phase 2 — Ephemeris: Sun and Earth in the local sky (by 27 Oct)

The official challenge statements (full requirements, resources) release **28 Oct**. Until then this phase plans against the 17 Sep summary — after reading the statements, rescope before building anything heavy. Outputs of Phases 2–3 are validation artefacts (proven data and math), documented as preparation; the judged app itself is written at the event (`docs/decisions.md`, 16 Oct).

- [ ] `[AI]` `device` — 28 Oct: read the official CLPS challenge statement in a real browser (full requirements, resources, judging-relevant details). Compare against this plan line by line, rescope Phases 2–5 where the statement differs, record the deltas in `docs/decisions.md`.
- [ ] `[AI+H]` `device` — **Needs Isaac's approval + target machine before downloading.** Device agent on the data computer downloads NAIF SPICE kernels: `de440s.bsp` (planets), `naif0012.tls` (leap seconds), `pck00011.tpc`, lunar orientation (`moon_pa_de440_200625.bpc`, `moon_de440_250416.tf` or current equivalents). Record exact versions, URLs, sizes, checksums, license and path in `data/SOURCES.md` (terms require licensing every material).
- [ ] `[AI]` — Script `ephemeris.py`: input lat, lon, elevation on the Moon (MOON_ME frame) + time range + step; output Sun and Earth azimuth and elevation (topocentric, local horizon). Python + `spiceypy`.
- [ ] `[AI]` — Unit tests: known geometry checks (Sun elevation at equator noon ≈ 90° − |latitude offset|, symmetry checks, Earth always low at the pole).
- [ ] `[AI+H]` **S** — Validate 10 sample points against JPL Horizons (observer on the Moon at site coordinates). Agreement target: < 0.05°. S records the comparison table in `docs/validation.md`.
- [ ] `[AI]` — Add Earth-phase and Sun–Earth separation output (useful for comms context, cheap to add).
- [ ] `[AI+H]` **S** — Decide on coordinate conventions (MOON_ME vs. MOON_PA, IAU vs. mean Earth) and write them down once. Mixing them silently is the classic error.

## Phase 3 — Terrain horizon masks (by 3 Nov, hardest part)

- [ ] `[AI+H]` `device` **D** — Identify the right LOLA south-pole elevation product on NASA PGDA (~20 m/px polar stereographic, maybe 5 m tiles near key sites). AI finds candidates; D confirms size, projection and license.
- [ ] `[AI+H]` `device` — **Needs Isaac's approval + target machine before downloading.** Device agent on the data computer checks free disk space, downloads the selected elevation tiles, and records URL, size, checksum, license and path in `data/SOURCES.md`. (Expect several GB.)
- [ ] `[AI]` — Script `horizon.py`: for a site, cast rays in 360 directions (1° steps, later 0.5°) out to ~100–150 km; for each, find the maximum elevation angle of terrain including lunar curvature. Output a horizon profile (azimuth → horizon elevation).
- [ ] `[AI]` — Performance: vectorize with numpy; cache profiles per site as JSON.
- [ ] `[AI+H]` **S** — Validate horizon results: compare computed illumination for 2–3 sites against PGDA published illumination maps (e.g. Mazarico et al. average illumination). Target: same ranking of sites and roughly matching percentages. Document gaps.
- [ ] `[AI+H]` **D** — Decide resolution vs. speed trade-off (20 m vs. 5 m, max ray distance). D decides based on validation results.
- [ ] `[AI]` — Precompute horizon profiles for every site on the site list.
- [ ] `[H]` **All** — Go / no-go on 3 Nov: if horizon masks are not validated, cut scope to fewer sites with published data rather than shipping wrong numbers.

## Phase 4 — Combine: power and comms windows (by 7 Nov)

- [ ] `[AI]` — Script `windows.py`: for site + date range, per time step decide `sun_visible` (Sun upper limb above horizon mask), `earth_visible` (Earth centre above mask + margin), and both.
- [ ] `[AI]` — Partial-Sun handling: fraction of solar disk above the horizon (Sun is ~0.5° wide; at the pole this matters).
- [ ] `[AI]` — Summaries: % time lit, % time Earth visible, longest continuous darkness, longest comms blackout, overlapping windows.
- [ ] `[AI+H]` **S** — Define a simple power-and-comms score (e.g. weighted lit % + comms % − longest darkness penalty). S approves the formula; it must be explainable in one sentence to a judge.
- [ ] `[AI+H]` **I** — Decide the default date range for the demo (e.g. the next CLPS launch window or one lunar year).
- [ ] `[AI]` — Export precomputed results as static JSON per site and month so the frontend needs no backend.

## Phase 5 — Product design (by 10 Nov)

- [ ] `[AI+H]` **I** — Wireframes for four screens: (1) site picker map, (2) polar sky plot with horizon outline and Sun/Earth tracks, (3) daily timeline (lit / Earth visible / both), (4) side-by-side comparison of 2–3 sites with score. AI drafts; Isaac decides.
- [ ] `[AI+H]` **I** — Choose stack and hosting (see NEEDS.md). AI recommends; Isaac decides.
- [ ] `[AI+H]` `device` **I** — Create the hosting account (Vercel or Cloudflare Pages, free tier) with Isaac's email and connect it to this private repo. Isaac approves the sign-up and handles 2FA. Pre-event code rule confirmed 16 Oct (project built at the event) — nothing deployed public before the event.
- [ ] `[AI]` — Prepare an empty project skeleton and component list. The 16 Oct rule allows preparation but not a brought-in solution, so the skeleton stays empty scaffolding — no challenge logic in it. If in doubt, keep it as a checklist to execute on Saturday morning instead (the day starts at the 8:30 check-in).
- [ ] `[AI+H]` **I** — Write the demo script: the 60-second story from "mission planner has a question" to "answer in 10 seconds".
- [ ] `[H]` **I** — Test the wireframes on one person outside the team (5 minutes). Note what confused them.
- [ ] `[AI]` — Write the glossary shown in the app (horizon mask, DTE, libration, PSR) in plain language.

## Phase 6 — Event preparation (11–13 Nov)

- [ ] `[AI]` — Write a 2-day hour-by-hour plan starting at the Sat 8:30 check-in, with checkpoints (Sat 12:00 sky plot works, Sat 20:00 timeline works, Sun 10:00 feature freeze, Sun 12:00 video recorded, submission deadline − 2 h submitted).
- [ ] `[AI]` — Write the cut list in order: score → comparison view → site map → keep sky plot + timeline.
- [ ] `[H]` **All** — Pack: laptops, chargers, power strips (organiser 16 Oct: not a socket for every device at every table), adapters, headphones, ID, the signed authorisations naming the Betreuer (one per participant), bedding if sleeping at the venue.
- [ ] `[AI+H]` `device` **All** — Make sure every laptop has the repo, Python env and data offline (venue Wi-Fi may fail). A device agent sets up Isaac's laptop; S and D set up their own (or run an agent on their own machine). Each person confirms by running the tests offline.
- [ ] `[AI+H]` `device` **D** — Copy precomputed data and kernels from Isaac's data computer to a USB stick, only after Isaac approves. Repo agent writes the checklist (files, sizes, checksums); device agent copies and verifies checksums; D checks the stick works on a second laptop.
- [ ] `[AI]` `device` — 13 Nov: read the official Project Submission Guide and Judging & Awards Guide (published 13 Nov per FAQ). Submission format, required fields and award categories come from them — update the submission tasks below to match, same day.

## Phase 7 — Hackathon day 1 (Sat 14 Nov)

- [ ] `[H]` **All** — Check in at 8:30, find a table, set up the power strips, test Wi-Fi.
- [ ] `[H]` **I** — Talk to mentors in the first 2 hours: show the problem statement, ask what a judge would challenge. Also confirm the empty-skeleton question (phase 5).
- [ ] `[AI+H]` **I** — Keep a running SI/AI-use log from the first hour (tool, what it did, who ran it). The submission must include a description of how SI tools were used (participant FAQ).
- [ ] `[AI+H]` **D** — Build the frontend shell and load static JSON. AI writes code; D reviews and runs it.
- [ ] `[AI+H]` **I** — Build the polar sky plot (D3 / Plotly). AI writes; Isaac checks it against a known case.
- [ ] `[AI+H]` **I** — Build the daily timeline view.
- [ ] `[AI+H]` **S** — Spot-check 5 values shown in the UI against the validated scripts. Any mismatch blocks progress.
- [ ] `[H]` **All** — Evening checkpoint: what works, what gets cut.

## Phase 8 — Hackathon day 2 (Sun 15 Nov)

- [ ] `[AI+H]` **D** — Comparison view and score, only if day 1 checkpoints passed.
- [ ] `[AI+H]` `device` **D** — Deploy (Vercel / Cloudflare Pages) and test the public URL on a phone. Agent deploys; D tests on a phone.
- [ ] `[H]` **All** — Feature freeze at the agreed time. Only bug fixes after.
- [ ] `[AI+H]` **I** — Write the project page text (summary, how it works, data sources, limitations). Cite every source — even open-source ones — and state the license of every Solution Material: NASA rejects Solutions without license documentation and can strip nominations for missing citations (terms). Include the SI/AI-use description from the phase 7 log. AI drafts; Isaac cuts to essentials.
- [ ] `[AI+H]` **I** — Slides (max 7) or demo video, per the Project Submission Guide (13 Nov). AI drafts structure and captions; human records and edits.
- [ ] `[H]` **I** — Record the demo video: screen-only, no faces and no voices of anyone under 18 (rules bar minors' photos, voices and likenesses from submissions) — captions or a TTS narration instead of voiceover.
- [ ] `[AI+H]` `device` **I** — Submit the project form before the deadline. Agent fills in the form from the project page text; Isaac reviews and clicks submit. Agent saves the confirmation screenshot to `docs/`.
- [ ] `[H]` **All** — Rehearse the live pitch twice with a timer.
- [ ] `[H]` **I** — Pitch to the local judges.
- [ ] `[AI]` — Make sure the repo README lists data sources, licenses and a short "how to run".

## Phase 9 — After the event

- [ ] `[H]` **All** — Collect judge and mentor feedback while it is fresh.
- [ ] `[AI+H]` **I** — Write a short retrospective: what worked, what to change next time.
- [ ] `[AI]` — Clean up the repo: remove secrets, add screenshots, add license.
- [ ] `[H]` **I** — Decide whether the project continues (portfolio, outreach to educators, nothing).
