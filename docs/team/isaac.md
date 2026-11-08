# Isaac — team lead and agent orchestrator (I)

You put everyone's work together, run the agents on Otto's two Claude Max 20x plans, and teach the others to use them. You assign tasks during the event by adding them to each person's file in this folder.

**Rule before the event:** only preparation. No project code, no processing of our data before Sat 14 Nov, 09:00 (see [AGENTS.md](../../AGENTS.md)).

## Before the event (now → Fri 13 Nov)

- [ ] **Existing tools run (Tue 27 Oct)** — click through JPL Horizons, NASA Moon Trek and LRO QuickMap yourself ("Sun and Earth elevation at site X over dates Y"), time it, write the 5 biggest pain points into [docs/existing-tools.md](../existing-tools.md). These are the pitch.
- **Challenge comparison complete (28 Oct)** — current challenge page + Sarah's email compared; changes in docs/decisions.md and TASKS.md. No future-publication blocker.
- **LOLA selection complete (28 Oct)** — reviewed sizes/projections/usage terms; ninja chose the 5.1 GB set in [docs/data-guide.md](../data-guide.md). Downloads remain a separate phase-2 task.
- [x] **spiceypy via agent (~1.5 h, agent-executed)** — the agent runs kernels → ET → position vectors on the tutorial kernels; you restate its output and can say what `furnsh`/`str2et`/`spkpos` each did ([docs/learning.md](../learning.md)).
- [ ] **rasterio + pyproj via agent (~2.5 h, agent-executed)** — the agent reads the sample GeoTIFF at a lat/lon you pick; you state the CRS and resolution from its output.
- [ ] **Teach the agent workflow** — one session with Leo, Otto and Bene on a throwaway toy repo: two worktrees, two agents, merge without conflict. Agree who runs which agent on which account.
- [ ] **Raw data download + USB stick** (phase 2, needs your approval per download). Download done 1 Nov, see [data/SOURCES.md](../../data/SOURCES.md); USB copy done 8 Nov (21/21 OK); second-laptop verify open.
- [ ] **Hosting account** (Vercel or Cloudflare Pages, free tier), nothing deployed before Saturday.
- [ ] **Laptop offline-ready** — [docs/offline-setup.md](../offline-setup.md), Wi-Fi-off self-test.
- [ ] **Check-in with the team** before the event: learning done, laptops ready, authorisations signed.
- [ ] **Check actual submission requirements (13 Nov)** — form fields, media format and code-link requirement from the organiser/form; use guides if supplied. Separate from the completed challenge comparison.
- [ ] **Signed parental authorisation** naming Dagny Locher, by Sat 7 Nov (calendar 29 Oct).
- [ ] **Pack** — laptop, charger, power strips, USB stick, sleeping bag, mat, ID, the signed authorisation.

## At the event

| When | Task |
|---|---|
| Sat 08:30 | Check in, table, power strips, Wi-Fi. Start the AI-use log (tool, what it did, who ran it). |
| Sat 10:30 | **Spec interview** (~1 h): turn [UX-01–05](../existing-tools.md#product-follow-through--28-oct-2026) into criteria; require two validated sites/two supported periods, simple site/date controls and combined Sun/Earth answers. Then the repo skeleton + sample JSON. You decide. |
| Sat first 2 h | **Talk to mentors:** what would a judge challenge; someone with lunar/geodesy background for the validation plan; first names of minors in the submission? |
| Sat 12:30 → 22:30 | **Run the agents** on tracks A (ephemeris) and B (horizon masks); hand scripts to Otto for review and to Leo for validation; assign tasks in the team files. Check the sky plot against a known case. |
| Sat 22:30 | Wrap-up: what works, what gets cut; save morning queue and confirm venue sleep block with the Betreuer. No required human night shift. |
| Sun → 12:00 | Core windows/summaries/comparison first. With Q + D run UX-01–05: original question ≤60 s, changed site/date ≤10 s, desktop + touch, signed out, map/data failure checks. Record evidence in docs/validation.md; S verifies numbers. **Core failures block 12:00 freeze; optional score/layout/map are cut first.** |
| Sun 12:00 → 15:00 | Project page text (sources + licenses + AI-use description), slides or video (no faces, voices or names of minors), README. **Submit by 15:00** (local deadline 15:45). |
| Sun 16:00 | Pitch together. |

## Assigned during the event

<!-- - [ ] HH:MM — task -->
