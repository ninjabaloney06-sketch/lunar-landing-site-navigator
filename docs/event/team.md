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
- [ ] **Check-in with the team** before the event: learning done, laptops ready, authorisations signed.
- [ ] **Check actual submission requirements (13 Nov)** — form fields, media format and code-link requirement from the organiser/form; use guides if supplied. Separate from the completed challenge comparison.
- [ ] **Signed parental authorisation** naming Dagny Locher, by Sat 7 Nov (calendar 29 Oct).
- [ ] **Pack** — laptop, charger, power strips, USB stick, sleeping bag, mat, ID, the signed authorisation.

### At the event

| When | Task |
|---|---|
| Sat 08:30 | Check in, table, power strips, Wi-Fi. Start the AI-use log (tool, what it did, who ran it). |
| Sat 10:30 | **Spec interview** (~1 h): turn [UX-01–05](../reference/existing-tools.md#product-follow-through--28-oct-2026) into criteria; require two validated sites/two supported periods, simple site/date controls and combined Sun/Earth answers. Then the repo skeleton + sample JSON. You decide. |
| Sat first 2 h | **Talk to mentors:** what would a judge challenge; someone with lunar/geodesy background for the validation plan; first names of minors in the submission? |
| Sat 12:30 → 22:30 | **Run the agents** on tracks A (ephemeris) and B (horizon masks); hand scripts to Otto for review and to Leo for validation; assign tasks in the team files. Check the sky plot against a known case. |
| Sat 22:30 | Wrap-up: what works, what gets cut; save morning queue and confirm venue sleep block with the Betreuer. No required human night shift. |
| Sun → 12:00 | Core windows/summaries/comparison first. With Q + D run UX-01–05: original question ≤60 s, changed site/date ≤10 s, desktop + touch, signed out, map/data failure checks. Record evidence in docs/event/validation.md; S verifies numbers. **Core failures block 12:00 freeze; optional score/layout/map are cut first.** |
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
| Sat 10:30 | Spec interview with the team (Isaac leads). Make sure the science in the spec is right. |
| Sat 12:30 → 16:00 | **Validate the ephemeris:** you choose 10 sample points (sites and times, including hard cases: Sun on the horizon, Earth at its lowest). You pull the reference values from Horizons by hand; an agent runs our script for the same points and builds the comparison table in `docs/event/validation.md`. Target < 0.05°. You decide pass or fail and hand the reference values to Otto for the unit tests. **Checkpoint 16:00.** |
| Sat afternoon | **Check the horizon-mask geometry:** have the agent explain in plain words and one sketch how it handles lunar curvature, ray length (100–150 km) and the Sun as a 0.5° disk. Check one ray by hand with a calculator. |
| Sat evening | **Validate one site against the PGDA illumination maps:** an agent produces our percentages; you judge whether the comparison is like with like (period, disc definition) and whether the ranking matches. Gaps into `docs/event/validation.md`. |
| Sat 22:00 | **Go / no-go call:** if the horizon masks are not validated, we cut to fewer sites or published data and label it. Your decision on the science. |
| Sun morning | **Power-and-comms score formula**, explainable in one sentence (only if the timeline works). |
| Sun before 12:00 | **Spot-check 5 values in the UI** against your Saturday validation table. Any mismatch blocks the freeze. |
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
- [ ] **Review checklist** — write yourself a short list of what you check in every agent-written script (inputs validated, units and angles in degrees vs. radians, no hard-coded paths, no secrets, tests cover the edge cases). You use it all weekend.
- [ ] **Know that Isaac's side is agent-executed too (29 Oct decision)** — Isaac's tool learning and his event scripts are written and run by agents; he reviews output, he does not hand-type physics. Since you read through everything: treat I's scripts exactly like every other agent script — run them through your checklist — and remember that on the I side no human eyeballs SPICE numbers directly, so your tests and Leo's validation are the only net.
- [ ] **Laptop offline-ready** — follow your OS section in [docs/reference/setup.md](../reference/setup.md) (Python, pytest, Node, git, Claude Code logged in). Do the Wi-Fi-off self-test.
- [ ] **Signed parental authorisation** naming Dagny Locher, by Sat 7 Nov.
- [ ] **Pack** — laptop, charger, power strip, sleeping bag, mat, ID, the signed authorisation.

### At the event

| When | Task |
|---|---|
| Sat 10:30 | Spec interview with the team. Check that the JSON format between scripts and frontend is testable. |
| Sat 12:30 → 16:00 | **Unit tests + UX-01:** geometry expectations from Leo; lunar observer/Sun/Earth metadata and az/el output checks. Reject Ohio/geocentre or RA/Dec-only reference results before validation. Review tests and ephemeris script; S signs reference setup. |
| Sat afternoon/evening | **Review every agent-written data script** (`horizon.py`, `sites.json` builder) before it is merged. |
| Sun morning | Review `windows.py` and the summaries export. |
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
- [ ] **Agents in parallel (~0.5 h)** — Isaac shows the team how two agents work in parallel without touching the same files. You need to know it so you don't break someone else's work.
- [ ] **Demo story (~0.5 h)** — you drive the live demo on Sunday. Think about how a 60-second demo of a tool like ours should flow (question → click → answer). Watch 2–3 past Space Apps winner videos for how they show their app. **Done when:** you can describe a good 60-second demo flow in 3 steps.
- [ ] **Laptop offline-ready** — Claude Code logged in, browser, Node 20+ so you can run the app locally ([docs/reference/setup.md](../reference/setup.md), your OS section).
- [X] **Signed parental authorisation** naming Dagny Locher, by Sat 7 Nov.
- [ ] **Pack** — laptop, charger, sleeping bag, mat, ID, the signed authorisation.

### At the event

| When | Task |
|---|---|
| Sat 10:30 | Spec interview: required site/date controls, combined Sun/Earth plot + numbers, timeline and basic site/date comparison. Map/score/side-by-side are optional. Read [UX-01–05](../reference/existing-tools.md#product-follow-through--28-oct-2026). You decide the look. |
| Sat 12:30 → | **UX-02/03 app shell:** obvious site/date controls, signed-out access, usable site list when map is unavailable, clear loading/error/invalid-input behavior. Show agents your references; use your data-viz checklist. |
| Sat → 20:00 | **Polar sky plot:** horizon outline, Sun and Earth tracks. **Checkpoint 20:00: sky plot with real ephemeris data.** |
| Sun morning | **UX-04/05:** daily windows + numeric az/el for both bodies, touch-readable values, site/UTC/source labels; basic switching between two validated sites and two supported periods is required. |
| Sun morning | **Optional side-by-side view**, after the 20:00/22:00 checkpoints; score only with S's approval and after core acceptance passes. |
| Sun before 12:00 | With I + Q run UX-01–05 on desktop + 375 px touch viewport (≤60 s original answer, ≤10 s changed context); fix core failures. Deploy and recheck on a phone; record evidence in docs/event/validation.md. |
| Sun 16:00 | Pitch together; you drive the live demo. |

### Assigned during the event

<!-- Isaac adds tasks here: - [ ] HH:MM — task -->
