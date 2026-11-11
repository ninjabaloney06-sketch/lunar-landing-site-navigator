# Leo — science lead (S)

You own the physics. If a number in our app is wrong, it's your call to stop it. Isaac assigns new tasks here during the event; tick them off when done.

**You write no code (decided 10 Nov).** Agents write and run every script. Your job is the part an agent cannot be trusted with: knowing what the right number should be, getting it by a route that does not touch our code (Horizons by hand, a calculator), and saying stop when the two disagree.

**Rule before the event:** only learning and checking public material. No project code, no processing of our sites or data before Sat 14 Nov, 09:00 (see [AGENTS.md](../../AGENTS.md)).

## Before the event (now → Fri 13 Nov)

- [x] **Review Isaac's two audits FIRST (2 min, unblocks him)** — [docs/archive/primer-audit.md](../archive/primer-audit.md): decide on the two sign errors and the coordinate-frame note at the bottom; [docs/archive/sources-audit.md](../archive/sources-audit.md): decide on the VIPER line and the source corrections. Reply per item accept/reject, then the tasks below fold your decisions in. **10 Nov: done** by Claude Code for Isaac: every fix accepted and applied.
- [x] **Check the primer** — read [docs/primer.md](../primer.md) completely. For every physics claim, open its source link and check that the source actually says it. Mark anything wrong or unclear directly in the file (or tell Isaac). When you are satisfied, add a line at the bottom: `Checked by Leo, <date>`. **Done 10 Nov** (Claude Code for Isaac; every claim checked, derived numbers recomputed).
- [x] **Coordinate-frame note** — learn the difference between MOON_ME (mean Earth / polar axis) and MOON_PA (principal axis), and IAU vs. mean-Earth conventions (NAIF frames lesson, see below). Add a half-page section to `docs/primer.md`: which frame we use for site coordinates, which for the ephemeris, and how we convert. Mixing them silently is the classic error and shifts positions by hundreds of metres. **Done 10 Nov**: the section is written ("Coordinate frames: which one we use" in primer.md). The learning part is yours, see below.
- [x] **Check the sources** — go through [docs/sources.md](../sources.md) entry by entry. Each site needs a primary source (NASA, LRO, mission page, paper) that states the coordinates. Remove or mark anything without one. **Done 10 Nov** (Claude Code for Isaac).
- [ ] **JPL Horizons by hand (~1.5 h)** — [Horizons](https://ssd.jpl.nasa.gov/horizons/) web app + [manual](https://ssd.jpl.nasa.gov/horizons/manual.html). No code, only the web form. Observer = a generic point on the lunar surface (body 301, your own lat/lon), target Sun (10), then Earth (399); azimuth/elevation, one day at 1-hour steps. Then break it on purpose: run it once with an Earth observer and see how plausible the wrong table looks. **Done when:** you get a correct table in under 5 minutes and can explain which settings change the numbers (observer body and site, elevation reference, refraction off). This is your reference at the event. **Also find out:** which lunar frame Horizons uses for an observer on the surface (MOON_ME, MOON_PA or IAU_MOON). If it differs from ours, sites sit ~0.7 km apart and the validation will look wrong.
- [ ] **One row with a calculator (~1 h)** — your second route, independent of every script. From Horizons, get the sub-solar latitude and longitude on the Moon for one time (target Moon, "Sun sub-longitude & sub-latitude"). On paper: sin(el) = sin φ · sin δ + cos φ · cos δ · cos(λ☉ − λ), with φ, λ your point and δ, λ☉ the sub-solar point. Compare with the Sun elevation in your Horizons table. **Done when:** both agree within about 0.1° and you can say why the same formula is worse for the Earth (parallax, up to ~0.28°, see primer).
- [ ] **Reading an agent's numbers (~30 min, with Isaac)** — Isaac's agent runs the spiceypy tutorial example and shows you only the output. You do not read the code. **Done when:** you have your own checklist of what to ask before believing any table an agent gives you: degrees or radians, km or m, UTC or ephemeris time, which frame, who is the observer and who is the target, light-time correction on or off.
- [ ] **What the published illumination maps mean (~30 min)** — the PGDA / Mazarico south-pole illumination maps (links in [docs/data-guide.md](../data-guide.md)). Read the description and figures, not the methods. **Done when:** you can say what "average illumination %" is averaged over (period; whole disc or any part of it) and why a 14-day result of ours must not be compared with it directly. You need this for Saturday evening.
- [ ] **Judge questions (~1 h)** — after the reading list below: write 10 physics questions a judge could ask and your answer to each in your own words, two sentences maximum (include: how wrong can our numbers be, and how do we know). Your own notes, not in the repo. You answer these at the pitch.
- [ ] **Laptop ready** — follow your OS section in [docs/offline-setup.md](../offline-setup.md) so agents can run scripts on your machine (Python, libraries, git, Claude Code logged in, docs saved). Do the Wi-Fi-off self-test. You install; you do not need to understand the libraries.
- [ ] **Signed parental authorisation** naming Dagny Locher — was due Sat 7 Nov. If not done: today.
- [ ] **Pack** — laptop, charger, sleeping bag, mat, ID, the signed authorisation.


### Must understand before the event (~30 min reading)

The checks are done; you don't need to redo them. But you are the one who answers the judges and catches wrong numbers, so read these and make sure you could explain them:

1. **Why the south pole has extreme light**: primer.md, "Why lighting is extreme at the poles". The Sun's elevation at the pole is *minus* the subsolar latitude and stays within ±1.6°, so terrain decides everything.
2. **Why Earth sits low on the horizon**: primer.md, "Why Earth hovers near the horizon". Earth's elevation is *minus* the sub-Earth latitude, about ±7°, on a ~27-day cycle. Also the 0.28° parallax and the ~1° Earth disc.
3. **Horizon masks**: primer.md, "What a horizon mask is". Our 100–150 km rays vs. Barker's 310 km; you check at the event that ours are long enough.
4. **Coordinate frames (most important)**: primer.md, "Coordinate frames: which one we use". MOON_ME vs MOON_PA vs IAU_MOON, why mixing them moves a polar site ~0.7 km, and our four rules. This is the classic error and your call to stop.
5. **What our site coordinates actually are**: sources.md, intro paragraph and the Artemis table. They are LROC mosaic centres, not official NASA centres, and their frame is inferred, not stated.

## At the event

| When | Task |
|---|---|
| Sat 10:30 | Spec interview with the team (Isaac leads). Make sure the science in the spec is right. |
| Sat 12:30 → 16:00 | **Validate the ephemeris:** you choose 10 sample points (sites and times, including hard cases: Sun on the horizon, Earth at its lowest). You pull the reference values from Horizons by hand; an agent runs our script for the same points and builds the comparison table in `docs/validation.md`. Target < 0.05°. You decide pass or fail and hand the reference values to Otto for the unit tests. **Checkpoint 16:00.** |
| Sat afternoon | **Check the horizon-mask geometry:** have the agent explain in plain words and one sketch how it handles lunar curvature, ray length (100–150 km) and the Sun as a 0.5° disk. Check one ray by hand with a calculator. |
| Sat evening | **Validate one site against the PGDA illumination maps:** an agent produces our percentages; you judge whether the comparison is like with like (period, disc definition) and whether the ranking matches. Gaps into `docs/validation.md`. |
| Sat 22:00 | **Go / no-go call:** if the horizon masks are not validated, we cut to fewer sites or published data and label it. Your decision on the science. |
| Sun morning | **Power-and-comms score formula**, explainable in one sentence (only if the timeline works). |
| Sun before 12:00 | **Spot-check 5 values in the UI** against your Saturday validation table. Any mismatch blocks the freeze. |
| Sun 16:00 | Pitch together; you answer the physics questions from the judges. |

## Assigned during the event

<!-- Isaac adds tasks here: - [ ] HH:MM — task -->
