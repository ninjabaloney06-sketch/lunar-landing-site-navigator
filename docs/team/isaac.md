# Isaac — team lead and agent orchestrator (I)

You put everyone's work together, run the agents on Otto's two Claude Max 20x plans, and teach the others to use them. You assign tasks during the event by adding them to each person's file in this folder.

**Rule before the event:** only preparation. No project code, no processing of our data before Sat 14 Nov, 09:00 (see [AGENTS.md](../../AGENTS.md)).

## Before the event (now → Fri 13 Nov)

- [ ] **Existing tools run (Tue 27 Oct)** — click through JPL Horizons, NASA Moon Trek and LRO QuickMap yourself ("Sun and Earth elevation at site X over dates Y"), time it, write the 5 biggest pain points into [docs/existing-tools.md](../existing-tools.md). These are the pitch.
- [ ] **Read the official challenge statement (28 Oct)** — compare it line by line with TASKS.md; deltas into `docs/decisions.md`.
- [ ] **LOLA candidates** — from [docs/data-guide.md](../data-guide.md): confirm size, projection and license; decide what is downloaded in phase 2.
- [ ] **Learn spiceypy, short (~1.5 h)** — load kernels, UTC → ET, position vectors without looking it up ([docs/learning.md](../learning.md)).
- [ ] **Learn rasterio + pyproj (~2.5 h)** — on the tutorial's sample GeoTIFF, print the pixel value at a lat/lon you picked and state CRS and resolution.
- [ ] **Teach the agent workflow** — one session with Leo, Otto and Bene on a throwaway toy repo: two worktrees, two agents, merge without conflict. Agree who runs which agent on which account.
- [ ] **Raw data download + USB stick** (phase 2, needs your approval per download).
- [ ] **Hosting account** (Vercel or Cloudflare Pages, free tier), nothing deployed before Saturday.
- [ ] **Laptop offline-ready** — [docs/offline-setup.md](../offline-setup.md), Wi-Fi-off self-test.
- [ ] **Check-in with the team** before the event: learning done, laptops ready, authorisations signed.
- [ ] **Read the Submission Guide + Judging Guide (13 Nov)** and update phases 5–6.
- [ ] **Signed parental authorisation** naming Dagny Locher, by Sat 7 Nov (calendar 29 Oct).
- [ ] **Pack** — laptop, charger, power strips, USB stick, sleeping bag, mat, ID, the signed authorisation.

## At the event

| When | Task |
|---|---|
| Sat 08:30 | Check in, table, power strips, Wi-Fi. Start the AI-use log (tool, what it did, who ran it). |
| Sat 10:30 | **Spec interview** (~1 h): an agent interviews the team and writes `docs/spec.md`. You decide. Then the repo skeleton + sample JSON so all tracks start in parallel. |
| Sat first 2 h | **Talk to mentors:** what would a judge challenge; someone with lunar/geodesy background for the validation plan; first names of minors in the submission? |
| Sat 12:30 → 22:30 | **Run the agents** on tracks A (ephemeris) and B (horizon masks); hand scripts to Otto for review and to Leo for validation; assign tasks in the team files. Check the sky plot against a known case. |
| Sat 22:30 | Wrap-up: what works, what gets cut; sleep shifts. |
| Sun → 12:00 | Agents on `windows.py`, summaries, glossary. **Feature freeze 12:00.** |
| Sun 12:00 → 15:00 | Project page text (sources + licenses + AI-use description), slides or video (no faces, voices or names of minors), README. **Submit by 15:00** (local deadline 15:45). |
| Sun 16:00 | Pitch together. |

## Assigned during the event

<!-- - [ ] HH:MM — task -->
