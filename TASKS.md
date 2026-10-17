# Tasks

Markers: `[AI]` AI alone · `[AI+H]` AI does it, human checks/decides · `[H]` human only · `device` needs a device agent on Isaac's computer (browser, files, accounts). No tag = a repo-only agent is enough. See [README](README.md).

Downloads, copying files outside the repo, creating accounts and sending anything outside the team always need Isaac's explicit approval first, per action. Downloads go to Isaac's data computer by default (see [AGENTS.md](AGENTS.md)).

Roles: **S** = science checks: physics, math, validation (proposed: O) · **D** = frontend and visual design (proposed: B) · **I** = Isaac: product, integration, data scripts via AI agents, pitch. Not agreed yet (phase 0).

**The rule that shapes this plan:** before Sat 14 Nov 09:00 only general preparation is allowed: learning the physics, getting to know NASA datasets and existing tools, collecting sources, raw data downloads, logistics. The project itself (scripts, processed data, designs of our app, the spec, app code) is built at the event; a finished solution adapted slightly does not count (participant FAQ, Team Formation Guide, organiser reply 13 Oct; see `docs/decisions.md`). Phases 1–2 are preparation, phases 3–6 happen at the event. **Local submission deadline: Sun 15 Nov, 15:45.**

---

## Phase 0 — Organisation (now → 1 Nov)

- [x] `[AI+H]` `device` **I** — Register the 3-person team on the CLPS challenge page from Isaac's Space Apps account and invite S and D. Isaac approves before submitting and accepts the participation terms personally.
- [x] `[H]` **S, D** — Create your own Space Apps account and accept the team invite. Isaac confirms all three members show as linked.
- [x] `[AI+H]` `device` **I** — Ask the Heilbronn organisers (OpenSpace) for: Friday agenda, daily opening hours, Wi-Fi, food, overnight access, power sockets, number of global nominations, local prizes, and whether pre-event code is allowed. Agent drafts the email; sends from Isaac's account after Isaac approves the text. Answers go into `docs/decisions.md`. Reply arrived 13 Oct — answers in `docs/decisions.md`.
- [x] `[AI+H]` `device` **I** — Read the official participation terms and rules. Done 16 Oct: Participant Terms (7 Aug 2026) and participant FAQ read in a browser; rules summary and plan consequences in `docs/decisions.md` ("Official rules read", 16 Oct). Submission format and award categories are not findable before 13 Nov — the official guides publish then.
- [ ] `[AI+H]` `device` **I** — Ask Sarah in the next email two things: (1) the team registered their own Space Apps accounts (confirmed 16 Oct); the terms require under-18 registration by a parent or legal guardian — how should this be fixed, if it must be? (2) Written confirmation that the school-provided Betreuer plus one written authorisation per participant satisfies NASA's "accompanied by a parent or legal guardian at all times" wording — the FAQ lets local events set their own requirements, so her answer is the operative one.
- [ ] `[H]` **All** — Agree roles (S / D / I) and who owns the final submission form. Strengths (10 Oct): Isaac UI, UX, design, AI · B UI, design · O logic, security. Nobody claims physics or raster data; proposal in `docs/decisions.md` ("Team strengths and roles").
- [ ] `[H]` **All + parents** — Accompanying person = a Betreuer provided by Isaac's school (decided 16 Oct; the organiser said on 13 Oct one adult can cover all three). Each participant's parents write a signed authorisation naming that Betreuer, valid for the whole event including overnight. Blocked on: the Betreuer's name — fill it in as soon as the school names them. Done by 7 Nov; every participant carries their own.
- [ ] `[H]` **All** — Decide the sleeping plan before booking travel: overnight at the venue is allowed with the chaperone, but the organiser provides no sleeping accommodation — bring bedding or book off-site; optionally take the organiser's offer to connect with local students (not guaranteed). Agent may research options; humans decide and book. Decide by 7 Nov.
- [ ] `[H]` **All** — Agree travel from Stuttgart: train or car, arrival before the 8:30 check-in on Sat 14 Nov, overnight per the decision above. Agent may look up connections and prices; humans book and pay.
- [ ] `[H]` **All** — Agree on a team chat tool and a weekly 30-minute sync slot. Status 10 Oct: WhatsApp group exists, everyone has Discord, most talk happens in person at school; a fixed weekly slot is still missing.
- [ ] `[AI+H]` `device` **I** — Create the team chat and the recurring calendar invite from Isaac's accounts, then invite S and D. Isaac approves before invites go out.
- [x] `[AI]` — Create this repo, task list and requirements list.

## Phase 1 — Learn the problem, the data and the tools (now → 1 Nov, allowed preparation)

Learning material and knowledge only. No project code, no project data files, no designs of our app.

- [ ] `[AI]` — Write a 1-page primer `docs/primer.md`: why the lunar south pole has extreme lighting (Sun within ~1.5° of the horizon), why Earth hovers near the horizon (libration ±~7°), what direct-to-Earth (DTE) comms needs, what a horizon mask is. Source link for every claim.
- [ ] `[AI+H]` **S** — Read the primer and check the physics. Mark anything unclear or wrong; S signs off.
- [ ] `[AI+H]` **S** — Learn the coordinate conventions (MOON_ME vs. MOON_PA, IAU vs. mean Earth) and add a half-page note to `docs/primer.md`: which one we will use and why. Mixing them silently is the classic error.
- [ ] `[AI]` — Source list `docs/sources.md`: links to primary sources (NASA, LRO, mission pages, papers) for current CLPS and Artemis south-pole sites (Artemis III candidate regions, Shackleton–de Gerlache ridge, IM-2 site, VIPER / Mons Mouton, other planned polar landers), with the coordinates as quoted there and the license of each source. Reading list only; the site data file is built at the event.
- [ ] `[AI+H]` **S** — Check `docs/sources.md` against the primary sources. Remove anything without a source.
- [ ] `[AI]` — Data guide `docs/data-guide.md`: which NAIF SPICE kernels (`de440s.bsp`, `naif0012.tls`, `pck00011.tpc`, lunar orientation `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf` or current equivalents), which LOLA south-pole elevation products on PGDA (~20 m/px polar stereographic, 5 m near key sites) and which published illumination maps (e.g. Mazarico et al.) exist: URL, version, size, format, projection, license.
- [ ] `[AI+H]` `device` **I** — Look at the LOLA candidates from the data guide; confirm size, projection and license, and decide which ones get downloaded in phase 2.
- [ ] `[AI+H]` `device` **I** — Test the existing tools (JPL Horizons, NASA Moon Trek, LRO QuickMap). Device agent runs "Sun and Earth elevation at site X over dates Y" once and writes the steps and screenshots into `docs/existing-tools.md`; then Isaac clicks through it himself, times it and writes the 5 biggest pain points. These pain points are the pitch, so they must come from a human run.
- [ ] `[AI]` — Learning path per role in `docs/learning.md`: short official tutorials for `spiceypy` (S, I), `rasterio` / `pyproj` (I), D3 or Plotly polar plots and Vite + React (D), Claude Code worktrees and parallel agents (all). Practise on the tutorials' own examples, outside this repo; nothing about our sites or our app.
- [ ] `[H]` **All** — Work through your part of `docs/learning.md`. Note what you got stuck on.
- [ ] `[AI]` — Inspiration list `docs/inspiration.md`: links and short notes on good sky plots, lighting timelines and mission-planning tools (NASA, ESA, papers, apps). Agents copy good examples better than they invent; this is what we point them at on Saturday.
- [ ] `[AI]` `device` — 28 Oct: read the official CLPS challenge statement in a real browser (full requirements, resources, judging-relevant details). Compare with this plan line by line, record the deltas in `docs/decisions.md` and adjust phases 3–6 where the statement differs.
- [ ] `[H]` **All** — Talk about who the user is (mission planner vs. educator vs. public), based on the pain points. Final decision at the Saturday kickoff.

## Phase 2 — Get ready for the weekend (2 → 13 Nov, allowed preparation)

- [ ] `[AI+H]` `device` — **Needs Isaac's approval + target machine before downloading.** Device agent on the data computer downloads the raw kernels and the chosen LOLA tiles and illumination maps (getting to know the datasets is allowed; no processing for the project before Saturday). Checks free disk space first; records URL, version, size, checksum, license and path in `data/SOURCES.md` (terms require licensing every material).
- [ ] `[AI+H]` `device` **I** — Copy the raw data to a USB stick, only after Isaac approves. Repo agent writes the checklist (files, sizes, checksums); device agent copies and verifies checksums; a second laptop reads the stick.
- [ ] `[AI+H]` `device` **All** — Every laptop ready offline: Python 3.11+, Node 20+, git, editor, Claude Code logged in, libraries from NEEDS.md installed, docs from `docs/learning.md` saved. No project code. A device agent sets up Isaac's laptop; O and B set up their own. Each person confirms with a tutorial example that runs offline.
- [ ] `[H]` **All** — Agent setup for the weekend: who runs which agents on which account (Isaac's Claude account, O's two Claude Max plans). Practise once on a throwaway toy project: two agents in parallel worktrees, merged without conflicts.
- [ ] `[AI+H]` `device` **I** — Create the hosting account (Vercel or Cloudflare Pages, free tier) with Isaac's email. Isaac approves the sign-up and handles 2FA. Nothing is deployed before Saturday.
- [ ] `[AI]` — Event plan `docs/event-plan.md`: hour by hour from Sat 10:30 to Sun 15:45 with the checkpoints of phases 3–6, who does what, sleep shifts, and the cut list in order (score → comparison view → site map; keep sky plot + timeline).
- [ ] `[AI]` `device` — 13 Nov: read the official Project Submission Guide and Judging & Awards Guide (published 13 Nov per FAQ). Submission format, required fields, public repo yes/no and award categories come from them; update `docs/decisions.md` and phases 5–6 the same day.
- [ ] `[H]` **All** — Pack: laptops, chargers, power strips (organiser 13 Oct: not a socket for every device at every table), adapters, headphones, ID, tickets, the signed authorisations naming the Betreuer (one per participant), USB stick, bedding if sleeping at the venue.

## Phase 3 — Saturday kickoff (Sat 14 Nov, 08:30 → 12:30)

- [ ] `[H]` **All** — Check in at 8:30, find a table, set up the power strips, test Wi-Fi.
- [ ] `[AI+H]` **I** — Keep a running AI-use log from the first hour (tool, what it did, who ran it). The submission must describe how AI ("SI") tools were used (participant FAQ).
- [ ] `[AI+H]` **I** — Spec interview from 10:30 (about 1 hour): an agent interviews the team and writes `docs/spec.md`. Start from the winning demo and work backwards: who the user is, one-sentence problem and solution, the 60-second demo story ("mission planner has a question" → "answer in 10 seconds"), the four screens (site picker map, polar sky plot with horizon outline and Sun/Earth tracks, daily timeline lit / Earth visible / both, side-by-side comparison with score), default date range, and the JSON format between scripts and frontend so the tracks can work in parallel. Isaac decides.
- [ ] `[AI]` — Repo skeleton from the spec: `scripts/`, `tests/`, `data/`, frontend (Vite + React, D3 or Plotly), sample JSON in the agreed format so the frontend can start before real data exists. LICENSE file (Apache 2.0 unless we choose another open-source license).
- [ ] `[H]` **I** — Talk to mentors in the first 2 hours: show the problem statement, ask what a judge would challenge, and ask for someone with lunar or geodesy background to look at the validation plan. Also ask whether first names of minors may appear in the submission.

## Phase 4 — Saturday build: core data and app shell (Sat 12:30 → 22:30, parallel tracks)

Track A — ephemeris (I + agents, S validates):
- [ ] `[AI]` — `scripts/ephemeris.py`: input lat, lon, elevation on the Moon (frame per the primer note) + time range + step; output Sun and Earth azimuth and elevation in the local horizon frame. Python + `spiceypy`, kernels from the USB stick.
- [ ] `[AI]` — Unit tests: known geometry checks (symmetry, Earth always low at the pole, Sun elevation bounds).
- [ ] `[AI+H]` **S** — Validate 10 sample points against JPL Horizons (observer on the Moon at the site). Target < 0.05°. Table in `docs/validation.md`. **Checkpoint 16:00.**
- [ ] `[AI]` — Earth phase and Sun–Earth separation output.

Track B — terrain horizon (I + agents, S validates):
- [ ] `[AI]` — `data/sites.json` from `docs/sources.md` (only checked entries, with source link per site).
- [ ] `[AI]` — `scripts/horizon.py`: for a site, cast rays in 360 directions (1° steps) out to ~100–150 km over the LOLA tiles; maximum terrain elevation angle including lunar curvature; vectorised with numpy; profiles cached as JSON.
- [ ] `[AI+H]` **S** — Validate one site's illumination against the PGDA published maps: same ranking, roughly matching percentages. Document gaps in `docs/validation.md`.
- [ ] `[H]` **All** — **Go / no-go 22:00:** if horizon masks are not validated, cut to fewer sites or published data and label it clearly, rather than show wrong numbers.

Track C — frontend (D + agents):
- [ ] `[AI+H]` **D** — App shell loading the sample JSON; site picker. Point the agent at examples from `docs/inspiration.md`. D reviews and runs it.
- [ ] `[AI+H]` **D** — Polar sky plot: horizon outline, Sun and Earth tracks. Isaac checks it against a known case. **Checkpoint 20:00: sky plot with real ephemeris data.**
- [ ] `[H]` **All** — 22:30 wrap-up: what works, what gets cut. Then sleep in shifts, at least 6 hours each, with the Betreuer. Tired people ship wrong numbers.

## Phase 5 — Sunday build: windows, views, deploy (Sun 07:30 → 12:00)

- [ ] `[AI]` — `scripts/windows.py`: per time step `sun_visible` (upper limb above mask), `earth_visible` (centre above mask + margin), both; fraction of solar disk above the horizon (Sun is ~0.5° wide).
- [ ] `[AI]` — Summaries: % time lit, % time Earth visible, longest darkness, longest comms blackout, overlapping windows. Export static JSON per site.
- [ ] `[AI+H]` **D** — Daily timeline view (lit / Earth visible / both).
- [ ] `[AI+H]` **S** — Power-and-comms score formula, explainable in one sentence. S approves. Only if the timeline works.
- [ ] `[AI+H]` **D** — Comparison view of 2–3 sites with score. Only if the 20:00 and 22:00 checkpoints passed.
- [ ] `[AI]` — Glossary in the app (horizon mask, DTE, libration, PSR) in plain language, from the primer.
- [ ] `[AI+H]` **S** — Spot-check 5 values in the UI against the validated scripts. Any mismatch blocks the freeze.
- [ ] `[AI+H]` `device` **D** — Deploy (Vercel / Cloudflare Pages); test the URL on a phone.
- [ ] `[H]` **All** — **Feature freeze 12:00.** Only bug fixes after.

## Phase 6 — Submission and pitch (Sun 12:00 → 18:00)

- [ ] `[AI+H]` **I** — Project page text: summary, how it works, data sources, limitations. Cite every source, even open-source ones, and state the license of every material (NASA can reject Solutions or strip nominations for missing citations or license documentation). Include the AI-use description from the phase 3 log. AI drafts; Isaac cuts.
- [ ] `[AI+H]` **I** — Slides or demo video in the format of the Project Submission Guide (13 Nov). Screen recording with captions or TTS only: no faces, voices or recognizable names of anyone under 18. AI drafts structure and captions; Isaac records the screen.
- [ ] `[AI]` — README: data sources, licenses, how to run. Make the judged code public only if the Submission Guide requires a code link (Isaac decides).
- [ ] `[AI+H]` `device` **I** — Fill in the submission form on the team's project page; Isaac reviews and clicks submit **by 15:00** (local deadline 15:45). Agent saves the confirmation screenshot to `docs/`.
- [ ] `[H]` **All** — Rehearse the pitch twice with a timer. Live demo, with the screen recording and an offline build as backup.
- [ ] `[H]` **I** — Pitch to the local judges (from 16:00). Stay within the time slot.

## Phase 7 — After the event

- [ ] `[H]` **All** — Collect judge and mentor feedback while it is fresh.
- [ ] `[AI+H]` **I** — Short retrospective: what worked, what to change next time.
- [ ] `[AI]` — Clean up the repo: remove secrets, add screenshots, check the license.
- [ ] `[H]` **I** — Decide whether the project continues (portfolio, outreach to educators, nothing).
