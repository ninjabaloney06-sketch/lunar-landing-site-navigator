# Tasks

Markers: `[AI]` AI alone · `[AI+H]` AI does it, human checks/decides · `[H]` human only. See [README](README.md).

Roles: **S** = science teammate · **D** = data/web teammate · **I** = Isaac (product, UI, integration, pitch).

---

## Phase 0 — Organisation (now → 13 Oct)

- [ ] `[H]` **I** — Register the 3-person team on the CLPS challenge page and confirm every member's Space Apps account is linked. Needs each person's own login.
- [ ] `[H]` **I** — Ask the Heilbronn organisers (OpenSpace) for: Friday agenda, daily opening hours, Wi-Fi, food, overnight access, power sockets, number of global nominations, local prizes.
- [ ] `[AI+H]` **I** — Read the official participation terms and rules; AI summarizes what may be prepared before the event (code, data, design) and what must be built on site. Human confirms the reading with the organisers if unclear.
- [ ] `[H]` **All** — Agree roles (S / D / I) and who owns the final submission form.
- [ ] `[H]` **All** — Agree travel from Stuttgart: train or car, departure times, whether anyone stays overnight.
- [ ] `[H]` **All** — Set up a team chat and a weekly 30-minute sync until the event.
- [ ] `[AI]` — Create this repo, task list and requirements list.

## Phase 1 — Understand the problem (by 20 Oct)

- [ ] `[AI]` — Write a 1-page primer: why the lunar south pole has extreme lighting (Sun within ~1.5° of the horizon), why Earth hovers near the horizon (libration ±~7°), what direct-to-Earth (DTE) comms needs, what a horizon mask is.
- [ ] `[AI+H]` **S** — Verify the primer's physics. S signs off before anyone builds on it.
- [ ] `[AI]` — List current CLPS and Artemis south-pole sites with coordinates: Artemis III candidate regions, Shackleton–de Gerlache connecting ridge, IM-2 site, VIPER / Mons Mouton area, other planned CLPS polar landers. Every coordinate with source link.
- [ ] `[AI+H]` **S** — Check the site list against primary sources (NASA, LRO, mission pages). Remove anything without a source.
- [ ] `[AI+H]` **I** — Test the existing tools (JPL Horizons, NASA Moon Trek, LRO QuickMap). AI drafts the workflow for "Sun and Earth elevation at site X over dates Y"; Isaac actually clicks through it, times it, and writes the 5 biggest pain points. These pain points are the pitch.
- [ ] `[H]` **All** — Decide the primary user for the demo (mission planner vs. educator vs. public). One user, one story.
- [ ] `[AI+H]` **I** — Write a one-sentence problem statement and a one-sentence solution statement. Human picks the final wording.

## Phase 2 — Ephemeris: Sun and Earth in the local sky (by 27 Oct)

- [ ] `[AI]` — Download NAIF SPICE kernels: `de440s.bsp` (planets), `naif0012.tls` (leap seconds), `pck00011.tpc`, lunar orientation (`moon_pa_de440_200625.bpc`, `moon_de440_250416.tf` or current equivalents). Record exact versions and URLs.
- [ ] `[AI]` — Script `ephemeris.py`: input lat, lon, elevation on the Moon (MOON_ME frame) + time range + step; output Sun and Earth azimuth and elevation (topocentric, local horizon). Python + `spiceypy`.
- [ ] `[AI]` — Unit tests: known geometry checks (Sun elevation at equator noon ≈ 90° − |latitude offset|, symmetry checks, Earth always low at the pole).
- [ ] `[AI+H]` **S** — Validate 10 sample points against JPL Horizons (observer on the Moon at site coordinates). Agreement target: < 0.05°. S records the comparison table in `docs/validation.md`.
- [ ] `[AI]` — Add Earth-phase and Sun–Earth separation output (useful for comms context, cheap to add).
- [ ] `[AI+H]` **S** — Decide on coordinate conventions (MOON_ME vs. MOON_PA, IAU vs. mean Earth) and write them down once. Mixing them silently is the classic error.

## Phase 3 — Terrain horizon masks (by 3 Nov, hardest part)

- [ ] `[AI+H]` **D** — Identify the right LOLA south-pole elevation product on NASA PGDA (~20 m/px polar stereographic, maybe 5 m tiles near key sites). AI finds candidates; D confirms size, projection and license.
- [ ] `[AI]` — Download the selected elevation tiles; document size and checksum. (Expect several GB; check disk space first.)
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
- [ ] `[AI+H]` **I** — Choose stack (see NEEDS.md). AI recommends; Isaac decides.
- [ ] `[AI]` — Prepare an empty project skeleton and component list, only if the rules allow pre-event setup. Otherwise write it down as a checklist to execute on Saturday morning.
- [ ] `[AI+H]` **I** — Write the demo script: the 60-second story from "mission planner has a question" to "answer in 10 seconds".
- [ ] `[H]` **I** — Test the wireframes on one person outside the team (5 minutes). Note what confused them.
- [ ] `[AI]` — Write the glossary shown in the app (horizon mask, DTE, libration, PSR) in plain language.

## Phase 6 — Event preparation (11–13 Nov)

- [ ] `[AI]` — Write a 2-day hour-by-hour plan with checkpoints (Sat 12:00 sky plot works, Sat 20:00 timeline works, Sun 10:00 feature freeze, Sun 12:00 video recorded, submission deadline − 2 h submitted).
- [ ] `[AI]` — Write the cut list in order: score → comparison view → site map → keep sky plot + timeline.
- [ ] `[H]` **All** — Pack: laptops, chargers, power strip, adapters, headphones, ID, tickets.
- [ ] `[H]` **All** — Make sure every laptop has the repo, Python env and data offline (venue Wi-Fi may fail).
- [ ] `[AI+H]` **D** — Copy precomputed data and kernels to a USB stick / each laptop. AI writes the checklist; D does it.
- [ ] `[AI]` — Check the 28 Oct full challenge resources and update this task list.

## Phase 7 — Hackathon day 1 (Sat 14 Nov)

- [ ] `[H]` **All** — Check in, find a table, test Wi-Fi and power.
- [ ] `[H]` **I** — Talk to mentors in the first 2 hours: show the problem statement, ask what a judge would challenge.
- [ ] `[AI+H]` **D** — Build the frontend shell and load static JSON. AI writes code; D reviews and runs it.
- [ ] `[AI+H]` **I** — Build the polar sky plot (D3 / Plotly). AI writes; Isaac checks it against a known case.
- [ ] `[AI+H]` **I** — Build the daily timeline view.
- [ ] `[AI+H]` **S** — Spot-check 5 values shown in the UI against the validated scripts. Any mismatch blocks progress.
- [ ] `[H]` **All** — Evening checkpoint: what works, what gets cut.

## Phase 8 — Hackathon day 2 (Sun 15 Nov)

- [ ] `[AI+H]` **D** — Comparison view and score, only if day 1 checkpoints passed.
- [ ] `[AI+H]` **D** — Deploy (Vercel / Cloudflare Pages) and test the public URL on a phone.
- [ ] `[H]` **All** — Feature freeze at the agreed time. Only bug fixes after.
- [ ] `[AI+H]` **I** — Write the project page text (summary, how it works, data sources, limitations). AI drafts; Isaac cuts to essentials.
- [ ] `[AI+H]` **I** — Slides (max 7) or 30-second demo video, per the official submission format. AI drafts structure and captions; human records and edits.
- [ ] `[H]` **I** — Record the demo video (screen recording + voice).
- [ ] `[H]` **I** — Submit the project form before the deadline. Screenshot the confirmation.
- [ ] `[H]` **All** — Rehearse the live pitch twice with a timer.
- [ ] `[H]` **I** — Pitch to the local judges.
- [ ] `[AI]` — Make sure the repo README lists data sources, licenses and a short "how to run".

## Phase 9 — After the event

- [ ] `[H]` **All** — Collect judge and mentor feedback while it is fresh.
- [ ] `[AI+H]` **I** — Write a short retrospective: what worked, what to change next time.
- [ ] `[AI]` — Clean up the repo: remove secrets, add screenshots, add license.
- [ ] `[H]` **I** — Decide whether the project continues (portfolio, outreach to educators, nothing).
