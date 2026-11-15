# Plan review — 13 Nov 2026 (fact check + holes)

Checked against: the [challenge page](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) (Details + Resources tab, read 13 Nov), the [Heilbronn local schedule](https://www.spaceappschallenge.org/2026/local-events/heilbronn/?tab=schedule) (read 13 Nov), the [Participant FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/) (dated 5 Nov, read 13 Nov), the organiser's welcome email (12 Nov), and the repo at `4b3478e`. Inspiration re-checked: [3D orrery](https://3dsolarsystem.online/viewer/#earth) (#19).

Status per item: 🔴 must fix before Saturday 10:30 · 🟡 fix at kickoff / in the build · 🟢 checked, correct.

## 1. New facts from 13 Nov

| Fact | Source | Consequence |
|---|---|---|
| Resources tab is live. It lists **only** Quickmap, Moon Trek, JPL Horizons (NASA) and CSA's Moon Exploration portal (partner). No dataset, no SPICE, no LOLA product. | Challenge page, Resources tab | 🟢 Nothing we lack. Our SPICE + LOLA + PGDA data go beyond the listed resources; cite them as "additional NASA data" (Best Use of Data). Mention CSA portal only if we use it. |
| Project Submission Guide and Judging & Awards Guide are scheduled for **13 Nov**, but were **not** on the Resources page when checked (13 Nov, afternoon). | FAQ, "Participant Guides … November 13" | 🔴 Isaac rechecks Fri night and Sat 08:30; fill [submission-check-13nov.md](submission-check-13nov.md) then. 2022 defaults stay until then. |
| Official local schedule differs from our event plan: 09:30 Challenge Lightning Talks, 10:00 Team Formation, **11:00 Mentor Round #1**, 16:00 Mentor Office Hours, **18:00 60-second stand-ups**, Sun **10:30 Mentor Round #2 (Judge Your Project)**, **12:00 Submission & Pitch Workshop**, 12:30 Lunch, **14:30 Submission Checkpoint**, 15:00 Pitch Rehearsals, 17:30 Deliberation. | Local schedule | 🔴 Fixed in [event-plan.md](event-plan.md). The plan's 09:15–10:25 mentor slot does not exist; mentors come at 11:00. |
| The organiser: "officially start at 9:30"; "24h event, you can code … through the night"; sleeping place → email her. | The organiser, 12 Nov | 🟢 Venue overnight already decided (decisions.md, 26 Oct). 09:30 = lightning talks; hacking still starts 10:30. |
| FAQ: under-18s "must be accompanied by a parent or legal guardian at all times"; local events may set own rules. | FAQ | 🟡 We rely on the organiser's acceptance of a named Betreuerin with signed parental authorisations. Bring her 12 Oct email on a phone + the signed forms. |
| FAQ: "Teams are not allowed to begin working on the challenges prior to the hackathon." | FAQ | 🟢 This review and the build plan are plan text, no code (ninja's exception, 11 Nov). **No code was written for this review.** |

## 2. Fact check of the build plan

| Claim (build-plan.md) | Check | Verdict |
|---|---|---|
| Earth parallax from a site: up to 0.26° | 1737.4 / 384,400 rad = 0.259°; at perigee (356,500 km) 0.279° | 🟢 (0.26° mean, 0.28° max; team.md says 0.28°: both fine, state range) |
| Sun disc ~0.53°, Earth radius ~0.95° | 2 × 696,000 / 1.496e8 = 0.533°; 6371 / 384,400 = 0.95° | 🟢 Sun. 🟡 Earth radius varies **0.90°–1.02°** with distance; compute from the actual distance (like the Sun), not a constant. Fixed in §4.4. |
| Curvature dip for 2 m: −0.087° | √(2 × 0.002 / 1737.4) = 0.0869° | 🟢 |
| Coarse DEM 1515² × 2 B ≈ 4.6 MB | 10° of latitude = 303 km → 606 km / 0.4 = 1516 px | 🟢 |
| ~930 samples per ray, ~670k per site | 200 + ln(37.5)/ln(1.005) ≈ 927; × 720 = 667k | 🟢 |
| Near field 2000², far field ~1900² "same area" | Far field covers the 300 km box (150 km radius), not the near-field area | 🟡 wording; now a 600 km box with the 300 km rays, fixed in §4.2 |
| **Light time: "the Moon turns 0.07° in 499 s", so LT+S matters** | The 0.07° is the right arithmetic but the wrong mechanism: the MOON_ME orientation is evaluated at observation time for an observer at the Moon, not at emission time. Real geometric-vs-apparent difference for the Sun ≈ aberration ≈ 30 km/s × 499 s / 1 AU ≈ **0.006° (20″)**; for Earth the LT and aberration terms nearly cancel (< 0.001°). | 🔴 Plan and Leo's task said "expect ~0.07°". Fixed: expect ~0.006°, still use LT+S because Horizons reports apparent positions. |
| Ray length 150 km | A 5 km massif is visible above a flat horizon from √(2Rh) ≈ 132 km; from a site itself 2 km up the combined line of sight reaches ≈ 215 km. Barker et al. use 310 km. | 🔴 150 km can miss distant massifs (Malapert seen from Shackleton region is ~120 km, edge case). Raised to **300 km** in §4.2; costs ~140 extra samples per ray. |
| DEM product, citation (Barker et al. 2023, PSJ 4, 183) | Matches data-guide.md + PGDA 90 | 🟢 |
| Data on disk: LDEM 80S 20 m, 87.5S 5 m, PGDA illumination 65S/75S/85S (Sun + Earth), SPICE set | `ls ~/Documents/clps-data/clps` 13 Nov | 🟢 No global DEM on disk: sites north of 80°S get **no terrain horizon**. |
| Curated list = "Connecting Ridge … Amundsen Rim" (13 Artemis regions) | That is the **2022** list. NASA's **28 Oct 2024** update keeps nine: Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater Plain ([sources.md](../reference/sources.md)). | 🔴 A judge from NASA would spot this. Fixed in §4.3: 2024 regions first, 2022-only regions labelled "dropped in 2024". Connecting Ridge stays as demo site, labelled "Blue Moon MK1 target", not "Artemis region". |
| Event plan: "the 30 build hours" | Hacking 10:30 Sat → submit 15:00 Sun = 28.5 h elapsed; minus sleep 23:00–06:45 and meals ≈ **19 h of human work** | 🟡 fixed wording; the cut list already assumes this |

## 3. Holes in the plan (ranked by what they cost us with the judges)

1. 🔴 **The user story is "find an alternative" — the plan only lets you compare alternatives you already picked.** The challenge's core scenario: a date slips, engineers need the next workable date or a nearby site. Our plan has compare (step 4) but no search. **Fix:** *Landing window finder* (new step 2b): site + earliest landing date + mission length + thresholds (e.g. ≥ 70 % lit, ≥ 50 % Earth, no blackout > 48 h) → the next 5 landing dates that pass, ranked. Runs in the browser on the same ephemeris + mask, ~70k time steps, < 1 s. This is the feature that answers the problem statement in one click; it is also our best demo moment.
2. 🔴 **Outdated Artemis region list** (see §2). Fixed in plan.
3. 🔴 **"Landing sites from other countries' programs" and "other commercial missions" are named examples in the objectives; we have none.** Fix: add Chandrayaan-3, Chang'e 3/4/5/6, SLIM, Luna-25 target, Blue Ghost M1, plus Apollo 11–17 (step 5). Far-side sites (Chang'e 4, 6) never see Earth: that teaches *why* DTE fails and why Queqiao relays exist, with a flat horizon and zero extra data. Leo sources the coordinates tonight (allowed: source collection).
4. 🔴 **Single point of failure in step 1.** The demo needs `ephemeris.py` + `horizon.py` + the TypeScript geometry port + fixture parity (T9) + three views by Sat 22:00. If the TS port slips, nothing ships. **Fallback (step 1-lite):** Python writes per-site time series (az/el/lit/Earth every 30 min for the preset periods) and the frontend draws those; the TS geometry becomes the upgrade that unlocks custom sites and the finder. Decide at kickoff; trigger: T9 not green by Sat 18:00.
5. 🔴 **Ray length 150 km too short** (see §2). Fixed.
6. 🟡 **"Why small changes have large impacts" has no feature.** Fix: show the PGDA 60 m average-illumination map (`avgvisib_85s_060m`, on disk) as a 4 × 4 km inset around the site, with the site's region outline (regions are ~15 × 15 km, landing sites ~100 m radius). Moving 500 m off a ridge visibly drops from ~80 % to ~20 % lit. Sourced, no new computation. Promoted from optional to step 4.
7. 🟡 **Power metric hides the lunar-vs-Earth contrast.** "Visible disc fraction on a vertical tracking panel" is right, but the challenge asks to make "extreme differences between lunar and terrestrial conditions apparent". Fix: panel toggle *vertical tracking / horizontal / vertical fixed in one direction*: horizontal at the pole gets sin(1.5°) ≈ 2.6 % of normal, vertical gets ~100 %. One formula (cos of incidence × disc fraction), one sentence in Explain mode, plus a "vs. Stuttgart today" card (Sun max elevation, day length 29.5 Earth days, no atmosphere).
8. 🟡 **Slopes and craters / extreme shadow** (a listed consideration): nothing in the plan. Fix: site slope from the 20 m DEM in `sites.json` (NASA lists "terrain slope" as a region criterion) and a PSR layer = cells with 0 % average illumination in the PGDA map, on the 2D map.
9. 🟡 **Earth visible ≠ link available.** DTE also needs a DSN ground station with the Moon above its horizon. Out of scope; one line in the limits footer ("Earth visibility only; ground-station coverage not modelled").
10. 🟡 **Landing *time*, not just date.** Objective says "landing dates and times". Add a UTC time field next to the date; the scrubber alone is not a picker.
11. 🟡 **Science ↔ engineering coordination** (a listed impact): add CSV export of windows and summaries next to the shareable URL. ~20 lines.
12. 🟡 **Libration and orbital variation** are handled (MOON_ME + DE440 lunar orientation) but invisible. Say it in the UI footer and pitch: "includes libration; Earth's track wobbles ±7° because of it". The orrery (#19) shows the opposite case: its own panel says "Live telemetry is scene-derived, not JPL Horizons ephemeris yet". Validated numbers are our edge over pretty viewers.
13. 🟡 **Thermal** is named in the background ("thermal conditions for equipment"). Out of scope; list as limitation, mention "hours since sunset" as the honest proxy.
14. 🟡 **Schedule collisions** (see §1). Kickoff/plan confirmation must finish before 11:00 Mentor Round #1; use Mentor Round #2 (Sun 10:30) as our UX acceptance run with a stranger; the 18:00 stand-up is 60 s: prepare it.
15. 🟢 Libration, refraction (none on the Moon), disc vs point, frames, curvature, DEM edge truncation, mobile/touch, no-login, minors' media rule, SI-use log: all already in the plan.

## 4. Objective coverage after this review

| Challenge objective / consideration | Where in the plan | Step |
|---|---|---|
| Sun + Earth vs horizon at site and date (required) | Panorama + polar + Numbers | 1 |
| Curated list: Apollo, CLPS, other commercial, other countries | sites.json groups `artemis-2024`, `artemis-2022`, `clps`, `commercial`, `international`, `apollo` | 1 (polar), 5 (rest) |
| Custom coordinates | CustomSite, coarse DEM | 7 |
| Side-by-side / sequential comparison | Compare view | 4 |
| Dates **and times**, lunar days, seasons | Date + UTC time field, presets from `periods.py` | 1, 3 |
| Time until sunset / Earthset | Numbers row | 2 |
| Solar elevation prominent, sunlight duration, Earth windows | Numbers row + Timeline | 2 |
| **Alternative dates when schedules slip** | **Landing window finder** | **2b** |
| 2D map, 3D view | Map (+ PSR layer), View3D | 4, 6 |
| Animation / timeline | Scrubber with play speeds | 3 |
| Planners **and** educators/public | Explain toggle, "vs. Earth" card, panel toggle | 2–3 |
| Why small changes matter | PGDA 60 m inset around the site | 4 |
| Topography, steep slopes, craters, shadow | LOLA horizon, slope in sites.json, PSR layer | 1, 4 |
| Libration / orbital variation | DE440 + MOON_ME, stated in footer | 1 |
| No atmosphere → terrain + sphere edge decide | Horizon method §4.2, Explain text | 1 |
| Science–engineering coordination | Share URL + CSV export | 4 |

## 5. Leo's new and changed tasks

In [team.md](team.md#leo--science-lead-s) and [TASKS.md](../../TASKS.md): light-time expectation corrected (~0.006°), source international/commercial sites tonight, source coordinates for the four new 2024 regions, sign the ray-length change, define the finder thresholds and the panel formula at kickoff, validate the finder (V8) on Sunday.
