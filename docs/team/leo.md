# Leo — science lead (S)

You own the physics. If a number in our app is wrong, it's your call to stop it. Isaac assigns new tasks here during the event; tick them off when done.

**Rule before the event:** only learning and checking public material. No project code, no processing of our sites or data before Sat 14 Nov, 09:00 (see [AGENTS.md](../../AGENTS.md)).

## Before the event (now → Fri 13 Nov)

- [ ] **Check the primer** — read [docs/primer.md](../primer.md) completely. For every physics claim, open its source link and check that the source actually says it. Mark anything wrong or unclear directly in the file (or tell Isaac). When you are satisfied, add a line at the bottom: `Checked by Leo, <date>`.
- [ ] **Coordinate-frame note** — learn the difference between MOON_ME (mean Earth / polar axis) and MOON_PA (principal axis), and IAU vs. mean-Earth conventions (NAIF frames lesson, see below). Add a half-page section to `docs/primer.md`: which frame we use for site coordinates, which for the ephemeris, and how we convert. Mixing them silently is the classic error and shifts positions by hundreds of metres.
- [ ] **Check the sources** — go through [docs/sources.md](../sources.md) entry by entry. Each site needs a primary source (NASA, LRO, mission page, paper) that states the coordinates. Remove or mark anything without one.
- [ ] **Learn spiceypy (~2.5 h)** — [spiceypy docs](https://spiceypy.readthedocs.io/en/latest/) + [worked example](https://spiceypy.readthedocs.io/en/latest/exampleone.html); NAIF [tutorials](https://naif.jpl.nasa.gov/naif/tutorials.html) and [lessons](https://naif.jpl.nasa.gov/naif/lessons.html) (time and coordinate-system lessons only). In a scratch folder outside this repo, with the NAIF example kernels only: load kernels (`furnsh`), convert UTC → ET (`str2et`), get the Sun's position (`spkezr`), turn it into azimuth/elevation for a generic point (`pxform`). **Done when:** you get the Sun's elevation at one generic point and time, and the same value within 0.01° by a second, independent route.
- [ ] **Learn JPL Horizons (~1 h)** — [Horizons](https://ssd.jpl.nasa.gov/horizons/) + [manual](https://ssd.jpl.nasa.gov/horizons/manual.html). Observer table for a generic point on the lunar surface, azimuth/elevation, one day at 1-hour steps, for the Sun and then the Earth. Re-derive one row with spiceypy. **Done when:** you can explain which settings change the numbers (observer site, frame, elevation reference, refraction off). This is exactly how you validate our ephemeris at the event.
- [ ] **Agents in parallel (~0.5–1 h)** — [worktrees](https://code.claude.com/docs/en/common-workflows), [subagents](https://code.claude.com/docs/en/sub-agents). In a throwaway toy repo: two worktrees, two agent sessions, one small edit each, merge both. Isaac shows you how.
- [ ] **Laptop offline-ready** — follow your OS section in [docs/offline-setup.md](../offline-setup.md) (Python, spiceypy, git, Claude Code logged in, docs saved). Do the Wi-Fi-off self-test.
- [ ] **Signed parental authorisation** naming Dagny Locher, by Sat 7 Nov.
- [ ] **Pack** — laptop, charger, sleeping bag, mat, ID, the signed authorisation.

## At the event

| When | Task |
|---|---|
| Sat 10:30 | Spec interview with the team (Isaac leads). Make sure the science in the spec is right. |
| Sat 12:30 → 16:00 | **Validate the ephemeris:** 10 sample points against JPL Horizons, target < 0.05°. Table in `docs/validation.md`. Supply the expected values for Otto's unit tests. **Checkpoint 16:00.** |
| Sat afternoon | **Check the horizon-mask geometry:** lunar curvature, ray length (100–150 km), Sun as a 0.5° disk. |
| Sat evening | **Validate one site against the PGDA illumination maps:** same ranking, roughly matching percentages. Gaps into `docs/validation.md`. |
| Sat 22:00 | **Go / no-go call:** if the horizon masks are not validated, we cut to fewer sites or published data and label it. Your decision on the science. |
| Sun morning | **Power-and-comms score formula**, explainable in one sentence (only if the timeline works). |
| Sun before 12:00 | **Spot-check 5 values in the UI** against the validated scripts. Any mismatch blocks the freeze. |
| Sun 16:00 | Pitch together; you answer the physics questions from the judges. |

## Assigned during the event

<!-- Isaac adds tasks here: - [ ] HH:MM — task -->
