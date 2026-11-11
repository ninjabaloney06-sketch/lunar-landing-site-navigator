# Team checklists

One section per person. Tick your own boxes.

## Isaac — team lead and agent orchestrator (I)

You put everyone's work together, run the agents on Otto's two Claude Max 20x plans, and teach the others to use them. You assign tasks during the event by adding them to each person's file in this folder.

**Rule before the event:** only preparation. No project code, no processing of our data before Sat 14 Nov, 09:00 (see [AGENTS.md](../../AGENTS.md)).

### Before the event (now → Fri 13 Nov)

- [ ] **Existing tools run (Tue 27 Oct)** — click through JPL Horizons, NASA Moon Trek and LRO QuickMap yourself ("Sun and Earth elevation at site X over dates Y"), time it, write the 5 biggest pain points into [docs/reference/existing-tools.md](../reference/existing-tools.md). These are the pitch.
- **Challenge comparison complete (28 Oct)** — current challenge page + Sarah's email compared; changes in docs/reference/decisions.md and TASKS.md. No future-publication blocker.
- **LOLA selection complete (28 Oct)** — reviewed sizes/projections/usage terms; ninja chose the 5.1 GB set in [docs/reference/data-guide.md](../reference/data-guide.md). Downloads remain a separate phase-2 task.
- [x] **spiceypy via agent (~1.5 h, agent-executed)** — the agent runs kernels → ET → position vectors on the tutorial kernels; you restate its output and can say what `furnsh`/`str2et`/`spkpos` each did ([docs/reference/learning.md](../reference/learning.md)).
- [x] **rasterio + pyproj via agent (~2.5 h, agent-executed)** — the agent reads the sample GeoTIFF at a lat/lon you pick; you state the CRS and resolution from its output.
- [ ] **Teach the agent workflow** — one session with Leo, Otto and Bene on a throwaway toy repo: two worktrees, two agents, merge without conflict. Agree who runs which agent on which account.
- [x] **Raw data download + USB stick** (phase 2, needs your approval per download). Download done 1 Nov, see [docs/reference/data-sources.md](../reference/data-sources.md); USB copy done 8 Nov, verified 21/21 OK on ninja's Mac and on a second laptop.
- [ ] **Hosting account** (Vercel or Cloudflare Pages, free tier), nothing deployed before Saturday.
- [ ] **Laptop offline-ready** — [docs/reference/setup.md](../reference/setup.md), Wi-Fi-off self-test.
- [ ] **Walk the team through [build-plan.md](build-plan.md) (~30 min, Thu/Fri)** — everyone reads their sections first; agree the §9 defaults (observer height 2 m, Earth = any part of the disc, LT+S, mission planner, Nov 2026 – Dec 2030) or note objections for the 10:30 kickoff.
- [ ] **Write the agent briefs for step 1 (§8.1)** — one per track (A ephemeris, B horizon, C frontend) as plain text in your own notes, not in the repo: exact paths, contract section, traps, scope fence, done-when checks. No code.
- [ ] **Check-in with the team** before the event: learning done, laptops ready, authorisations signed.
- [ ] **Check actual submission requirements (13 Nov)** — form fields, media format and code-link requirement from the organiser/form; use guides if supplied. Separate from the completed challenge comparison.
- [ ] **Signed parental authorisation** naming Dagny Locher, by Sat 7 Nov (calendar 29 Oct).
- [ ] **Pack** — laptop, charger, power strips, USB stick, sleeping bag, mat, ID, the signed authorisation.

### At the event

| When | Task |
|---|---|
| Sat 08:30 | Check in, table, power strips, Wi-Fi. Start the AI-use log (tool, what it did, who ran it). |
| Sat 10:30 | **Kickoff (~30 min):** confirm [build-plan.md](build-plan.md) and its §9 decisions, name the demo owner. Then step 0: app skeleton, LICENSE, `CLPS_DATA` set on every laptop. You decide. |
| Sat first 2 h | **Talk to mentors:** what would a judge challenge; someone with lunar/geodesy background for the validation plan; first names of minors in the submission? |
| Sat 11:00 → 22:00 | **Track A + integration (step 1):** `ephemeris.py` (LT+S, MOON_ME only), `periods.py`, `export_fixtures.py`, `app/src/geometry/` (build plan §4.1, §4.4, §4.5). Hand scripts to Otto for review and to Leo for V1/V2; assign tasks in this file. First deploy by 20:00. |
| Sat 22:30 | Wrap-up: what works, what gets cut; save morning queue and confirm venue sleep block with the Betreuer. No required human night shift. |
| Sun 07:30 → 12:00 | **Steps 2–7 in order** (build plan §8), each only after the previous passed the bug gate: integrate Bene's views, run step 5 (more sites) and step 7 (custom lat/long) with Leo. Core windows/summaries/comparison first. With Q + D run UX-01–05: original question ≤60 s, changed site/date ≤10 s, desktop + touch, signed out, map/data failure checks. Record evidence in docs/event/validation.md; S verifies numbers. **Core failures block 12:00 freeze; optional score/layout/map are cut first.** |
| Sun 12:00 → 15:00 | Project page text (sources + licenses + AI-use description), slides or video (no faces, voices or names of minors), README. **Submit by 15:00** (local deadline 15:45). |
| Sun 16:00 | Pitch together. |

### Assigned during the event

<!-- - [ ] HH:MM — task -->

## Leo — science lead (S)

You own the physics. If a number in our app is wrong, it's your call to stop it. Isaac assigns new tasks here during the event; tick them off when done.

**You write no code (decided 10 Nov).** Agents write and run every script. Your job is the part an agent cannot be trusted with: knowing what the right number should be, getting it by a route that does not touch our code (Horizons by hand, a calculator), and saying stop when the two disagree.

**Rule before the event:** only learning and checking public material. No project code, no processing of our sites or data before Sat 14 Nov, 09:00 (see [AGENTS.md](../../AGENTS.md)).

### Before the event (now → Fri 13 Nov)

- [x] **Review Isaac's two audits FIRST (2 min, unblocks him)** — [docs/archive/primer-audit.md](../archive/primer-audit.md): decide on the two sign errors and the coordinate-frame note at the bottom; [docs/archive/sources-audit.md](../archive/sources-audit.md): decide on the VIPER line and the source corrections. Reply per item accept/reject, then the tasks below fold your decisions in. **10 Nov: done** by Claude Code for Isaac: every fix accepted and applied.
- [x] **Check the primer** — read [docs/reference/primer.md](../reference/primer.md) completely. For every physics claim, open its source link and check that the source actually says it. Mark anything wrong or unclear directly in the file (or tell Isaac). When you are satisfied, add a line at the bottom: `Checked by Leo, <date>`. **Done 10 Nov** (Claude Code for Isaac; every claim checked, derived numbers recomputed).
- [x] **Coordinate-frame note** — learn the difference between MOON_ME (mean Earth / polar axis) and MOON_PA (principal axis), and IAU vs. mean-Earth conventions (NAIF frames lesson, see below). Add a half-page section to `docs/reference/primer.md`: which frame we use for site coordinates, which for the ephemeris, and how we convert. Mixing them silently is the classic error and shifts positions by hundreds of metres. **Done 10 Nov**: the section is written ("Coordinate frames: which one we use" in primer.md). The learning part is yours, see below.
- [x] **Check the sources** — go through [docs/reference/sources.md](../reference/sources.md) entry by entry. Each site needs a primary source (NASA, LRO, mission page, paper) that states the coordinates. Remove or mark anything without one. **Done 10 Nov** (Claude Code for Isaac).
- [ ] **JPL Horizons by hand (~1.5 h)** — [Horizons](https://ssd.jpl.nasa.gov/horizons/) web app + [manual](https://ssd.jpl.nasa.gov/horizons/manual.html). No code, only the web form. Observer = a generic point on the lunar surface (body 301, your own lat/lon), target Sun (10), then Earth (399); azimuth/elevation, one day at 1-hour steps. Then break it on purpose: run it once with an Earth observer and see how plausible the wrong table looks. **Done when:** you get a correct table in under 5 minutes and can explain which settings change the numbers (observer body and site, elevation reference, refraction off). This is your reference at the event. **Also find out:** which lunar frame Horizons uses for an observer on the surface (MOON_ME, MOON_PA or IAU_MOON). If it differs from ours, sites sit ~0.7 km apart and the validation will look wrong.
- [ ] **One row with a calculator (~1 h)** — your second route, independent of every script. From Horizons, get the sub-solar latitude and longitude on the Moon for one time (target Moon, "Sun sub-longitude & sub-latitude"). On paper: sin(el) = sin φ · sin δ + cos φ · cos δ · cos(λ☉ − λ), with φ, λ your point and δ, λ☉ the sub-solar point. Compare with the Sun elevation in your Horizons table. **Done when:** both agree within about 0.1° and you can say why the same formula is worse for the Earth (parallax, up to ~0.28°, see primer).
- [ ] **Reading an agent's numbers (~30 min, with Isaac)** — Isaac's agent runs the spiceypy tutorial example and shows you only the output. You do not read the code. **Done when:** you have your own checklist of what to ask before believing any table an agent gives you: degrees or radians, km or m, UTC or ephemeris time, which frame, who is the observer and who is the target, light-time correction on or off.
- [ ] **What the published illumination maps mean (~30 min)** — the PGDA / Mazarico south-pole illumination maps (links in [docs/reference/data-guide.md](../reference/data-guide.md)). Read the description and figures, not the methods. **Done when:** you can say what "average illumination %" is averaged over (period; whole disc or any part of it) and why a 14-day result of ours must not be compared with it directly. You need this for Saturday evening.
- [ ] **Read the build plan's science (~45 min)** — [build-plan.md](build-plan.md) §2 (why the browser subtracts the site vector), §4.1 (light time, frames), §4.2 (horizon method), §4.4 (what "lit" and "Earth visible" mean), §6 (your checks V1–V7). **Done when:** you have either no objection or a written list of what is physically wrong, sent to Isaac before Saturday.
- [ ] **Light time in Horizons (~20 min)** — run one Sun row twice: apparent and geometric (Horizons table settings). **Done when:** you know the size of the difference (build plan expects ~0.07°) and can confirm or reject LT+S on Saturday.
- [ ] **Apollo site coordinates (~45 min)** — find the six Apollo landing coordinates on official NASA pages (e.g. NSSDC) and add them to [sources.md](../reference/sources.md) with source link and license, the same way as the other sites. Source collection only, no processing. Needed for build step 5.
- [ ] **Judge questions (~1 h)** — after the reading list below: write 10 physics questions a judge could ask and your answer to each in your own words, two sentences maximum (include: how wrong can our numbers be, and how do we know). Your own notes, not in the repo. You answer these at the pitch.
- [ ] **Laptop ready** — follow your OS section in [docs/reference/setup.md](../reference/setup.md) so agents can run scripts on your machine (Python, libraries, git, Claude Code logged in, docs saved). Do the Wi-Fi-off self-test. You install; you do not need to understand the libraries.
- [ ] **Signed parental authorisation** naming Dagny Locher — was due Sat 7 Nov. If not done: today.
- [ ] **Pack** — laptop, charger, sleeping bag, mat, ID, the signed authorisation.


#### Must understand before the event (~30 min reading)

The checks are done; you don't need to redo them. But you are the one who answers the judges and catches wrong numbers, so read these and make sure you could explain them:

1. **Why the south pole has extreme light**: primer.md, "Why lighting is extreme at the poles". The Sun's elevation at the pole is *minus* the subsolar latitude and stays within ±1.6°, so terrain decides everything.
2. **Why Earth sits low on the horizon**: primer.md, "Why Earth hovers near the horizon". Earth's elevation is *minus* the sub-Earth latitude, about ±7°, on a ~27-day cycle. Also the 0.28° parallax and the ~1° Earth disc.
3. **Horizon masks**: primer.md, "What a horizon mask is". Our 100–150 km rays vs. Barker's 310 km; you check at the event that ours are long enough.
4. **Coordinate frames (most important)**: primer.md, "Coordinate frames: which one we use". MOON_ME vs MOON_PA vs IAU_MOON, why mixing them moves a polar site ~0.7 km, and our four rules. This is the classic error and your call to stop.
5. **What our site coordinates actually are**: sources.md, intro paragraph and the Artemis table. They are LROC mosaic centres, not official NASA centres, and their frame is inferred, not stated.

### At the event

| When | Task |
|---|---|
| Sat 10:30 | Kickoff: confirm or change the science defaults in [build-plan.md](build-plan.md) §9 (observer height, Earth visibility definition, LT+S). |
| Sat 12:30 → 16:00 | **Validate the ephemeris:** you choose 10 sample points (sites and times, including hard cases: Sun on the horizon, Earth at its lowest). You pull the reference values from Horizons by hand; an agent runs our script for the same points and builds the comparison table in `docs/event/validation.md`. Target < 0.05°. You decide pass or fail and hand the reference values to Otto for the unit tests. **Checkpoint 16:00.** |
| Sat → 20:00 | **V3, horizon geometry:** the synthetic cases (flat sphere → −0.087° for 2 m; one cone of known size) must match within 0.01°. Have the agent explain one real ray in plain words (720 directions, 150 km, curvature, edge truncation) and check it by hand with a calculator. |
| Sat → 22:00 | **V4:** validate the sites against the PGDA illumination maps: an agent produces our percentages; you judge whether the comparison is like with like (period, disc definition) and whether the ranking matches. Gaps into `docs/event/validation.md`. |
| Sat 22:00 | **Go / no-go call:** if the horizon masks are not validated, we cut to fewer sites or published data and label it. Your decision on the science. |
| Sun → 09:00 | **V5, window edges:** our sunrise/sunset/Earthrise/Earthset times vs a 1-minute brute force for 3 sites × 3 days, ≤ 1 min. Approve the wording of the power proxy (visible disc fraction, vertical tracking panel). |
| Sun → 11:30 | **Steps 5 and 7:** check every new site's source (step 5) and the coarse-vs-full horizon error table (V6) before custom lat/long ships (step 7). |
| Sun before 12:00 | **V7: spot-check 5 values in the UI** against your Saturday validation table. Any mismatch blocks the freeze. |
| Sun 16:00 | Pitch together; you answer the physics questions from the judges. |

### Assigned during the event

<!-- Isaac adds tasks here: - [ ] HH:MM — task -->

## Otto — code review, tests, security (Q)

You read the code line by line. Nothing an agent writes goes in without your review. Isaac assigns new tasks here during the event; tick them off when done.

**Rule before the event:** only learning and setup. No project code before Sat 14 Nov, 09:00 (see [AGENTS.md](../../AGENTS.md)).

### Before the event (now → Fri 13 Nov)

- [ ] **Learn pytest (~2 h)** — [pytest Get Started](https://docs.pytest.org/en/stable/getting-started.html), then the pages on fixtures and `parametrize`. In a scratch folder outside this repo: a toy module with plain asserts, one fixture, one parametrized test; break one test on purpose and read the failure diff. **Done when:** `pytest -v` is green with at least 5 tests, one parametrized over at least 3 cases, and you can say in one sentence what a fixture is good for.
- [ ] **Agents in parallel (~0.5–1 h)** — [worktrees](https://code.claude.com/docs/en/common-workflows), [subagents](https://code.claude.com/docs/en/sub-agents). In a throwaway toy repo: two worktrees, two agent sessions, one small edit each, merge both. **Done when:** both branches merged without conflict and you can say why two agents must never edit the same files at the same time.
- [ ] **Your two Claude Max 20x plans** — make sure both are active for 14–15 Nov and that you can log in on the event laptops. Agree with Isaac which agent runs on which account.
- [ ] **Read the build plan's code side (~45 min)** — [build-plan.md](build-plan.md) §2 (folders), §3 (data contracts), §4 (pipeline traps), §7 (tests T1–T11), §8 (tracks; you own Track B). **Done when:** for each test T1–T11 you know what input it needs and what failure looks like; questions go to Isaac before Saturday.
- [ ] **Review checklist** — write yourself a short list of what you check in every agent-written script (inputs validated, units and angles in degrees vs. radians, no hard-coded paths, no secrets, tests cover the edge cases). You use it all weekend.
- [ ] **Know that Isaac's side is agent-executed too (29 Oct decision)** — Isaac's tool learning and his event scripts are written and run by agents; he reviews output, he does not hand-type physics. Since you read through everything: treat I's scripts exactly like every other agent script — run them through your checklist — and remember that on the I side no human eyeballs SPICE numbers directly, so your tests and Leo's validation are the only net.
- [ ] **Laptop offline-ready** — follow your OS section in [docs/reference/setup.md](../reference/setup.md) (Python, pytest, Node, git, Claude Code logged in). Do the Wi-Fi-off self-test.
- [ ] **Signed parental authorisation** naming Dagny Locher, by Sat 7 Nov.
- [ ] **Pack** — laptop, charger, power strip, sleeping bag, mat, ID, the signed authorisation.

### At the event

| When | Task |
|---|---|
| Sat 10:30 | Kickoff: confirm the data contracts in [build-plan.md](build-plan.md) §3 are testable as written. |
| Sat 11:00 → 22:00 | **Track B (step 1):** run the agent on `horizon.py`, `sites.py`, `coarse_dem.py`, `basemap.py` (build plan §4.2–4.3); tests T4–T8 first, then hand Leo V3/V4 by 20:00/22:00. |
| Sat 11:00 → 16:00 | **Unit tests T1–T3 + UX-01:** geometry expectations from Leo; lunar observer/Sun/Earth metadata and az/el output checks. Reject Ohio/geocentre or RA/Dec-only reference results before validation. Review tests and ephemeris script; S signs reference setup. |
| Sat afternoon/evening | **Review every agent-written script** (Track A's ephemeris and geometry too) before it is merged; T9 (TypeScript matches `fixtures.json`) must pass before the 20:00 deploy. |
| Sun morning | Review `windows.py`; for each of steps 2–7 run the bug gate: known bugs fixed, tests green, then the next step may start. T10 (invalid input, failed load, map unavailable) before step 7 ships. |
| Sun before 12:00 | With I + D run [UX-01–05](../reference/existing-tools.md#product-follow-through--28-oct-2026), including invalid input, failed data load, map unavailable and mobile completion; record failures/fixes in docs/event/validation.md. Core failures block freeze. **Security check:** no secrets, keys or personal data; dependencies pinned. |
| Sun 16:00 | Pitch together; you explain how we know the code is correct (tests, validation). |

### Assigned during the event

<!-- Isaac adds tasks here: - [ ] HH:MM — task -->

## Bene — frontend and design (D)

You decide how it looks. The judges see the app before anything else, so your taste carries the demo. Isaac assigns new tasks here during the event; tick them off when done.

**Rule before the event:** only learning and setup. No designs or code of our app before Sat 14 Nov, 09:00 (see [AGENTS.md](../../AGENTS.md)).

### Before the event (now → Fri 13 Nov)

You don't need to learn React or a chart library: the agents write the code, you direct them. What the agents can't replace is your eye, your judgement and your feedback. Prepare those.

- [ ] **Understand what we show (~1 h)** — read [docs/reference/primer.md](../reference/primer.md). You must be able to explain in your own words what a polar sky plot shows (azimuth around the circle, elevation from the edge to the centre, horizon outline, Sun and Earth tracks) and what "lit / Earth visible / both" means on a timeline. **Done when:** you can sketch a sky plot on paper and explain every element to someone who has never heard of it. If you can't explain it, the judges won't get it either.
- [ ] **Reference board (~1.5 h)** — go through [docs/reference/inspiration.md](../reference/inspiration.md) and look further (NASA/ESA mission tools, data-viz galleries, apps you like). Save screenshots into a folder on your laptop (outside this repo). Pick your **top 3** and write for each one sentence on what exactly is good (layout, colour, how the data reads at a glance). General references only, nothing designed for our app. **Done when:** 3 picks with one sentence each, ready to show an agent on Saturday.
- [ ] **Data-viz rules (~1 h)** — learn the basics that make a chart readable: one clear message per view, colour only where it means something, readable labels and units, colour-blind-safe palettes, what to cut. Good free sources: the [Datawrapper blog](https://www.datawrapper.de/blog) (colour and chart guides) and [Material Design data visualization](https://m2.material.io/design/communication/data-visualization.html). **Done when:** you have a short personal checklist (5–8 rules) you will apply to every screen at the event.
- [ ] **Practise directing an agent on a toy UI (~1.5 h)** — in a throwaway folder (not this repo, nothing about our project): let Claude Code build a small generic page, e.g. "a weather dashboard with a chart". Then improve it only through feedback: look at it in the browser, say precisely what is wrong ("labels too small, the second line is unreadable on the dark background, move the legend under the chart") and let the agent fix it. Do at least 5 rounds. **Done when:** the page looks clearly better than round 1, and you have noticed which kind of feedback works (precise and visual) and which doesn't ("make it nicer").
- [ ] **Read the build plan's UI side (~30 min)** — [build-plan.md](build-plan.md) §1 (demo question) and §5 (layout, panorama vs polar plot, modules, colours). **Done when:** you can sketch the one-screen layout on paper from memory and have picked which of your 3 references fits it best. Objections to Isaac before Saturday.
- [ ] **WebGL check (~10 min)** — open any public three.js example page on your laptop and on the ThinkPad; note whether it runs smoothly. Needed for build step 6 (3D).
- [ ] **Agents in parallel (~0.5 h)** — Isaac shows the team how two agents work in parallel without touching the same files. You need to know it so you don't break someone else's work.
- [ ] **Demo story (~0.5 h)** — you drive the live demo on Sunday. Think about how a 60-second demo of a tool like ours should flow (question → click → answer). Watch 2–3 past Space Apps winner videos for how they show their app. **Done when:** you can describe a good 60-second demo flow in 3 steps.
- [ ] **Laptop offline-ready** — Claude Code logged in, browser, Node 20+ so you can run the app locally ([docs/reference/setup.md](../reference/setup.md), your OS section).
- [X] **Signed parental authorisation** naming Dagny Locher, by Sat 7 Nov.
- [ ] **Pack** — laptop, charger, sleeping bag, mat, ID, the signed authorisation.

### At the event

| When | Task |
|---|---|
| Sat 10:30 | Kickoff: confirm the layout in [build-plan.md](build-plan.md) §5.1. Read [UX-01–05](../reference/existing-tools.md#product-follow-through--28-oct-2026). You decide the look. |
| Sat 11:00 → | **Track C (step 1), UX-02/03 app shell:** `app/src/views/`, `data/`, `state` on `fixtures.json` until real data lands; obvious site/date controls, signed-out access, usable site list when map is unavailable, clear loading/error/invalid-input behavior. Show agents your references; use your data-viz checklist. |
| Sat → 20:00 | **Numbers, panorama + polar sky views, timeline:** terrain outline, Sun and Earth tracks, solar elevation as a number. **Checkpoint 20:00: sky views with real ephemeris data.** |
| Sun morning | **UX-04/05:** daily windows + numeric az/el for both bodies, touch-readable values, site/UTC/source labels; basic switching between two validated sites and two supported periods is required. |
| Sun 07:30 → 11:30 | **Steps 2, 3, 4, 6 in order** (build plan §8): sunset/Earthset countdown and big numbers → scrubber with play speeds and season presets → compare view and 2D map → 3D local panorama. Next step only after the bug gate. |
| Sun before 12:00 | With I + Q run UX-01–05 on desktop + 375 px touch viewport (≤60 s original answer, ≤10 s changed context); fix core failures. Deploy and recheck on a phone; record evidence in docs/event/validation.md. |
| Sun 16:00 | Pitch together; you drive the live demo. |

### Assigned during the event

<!-- Isaac adds tasks here: - [ ] HH:MM — task -->
