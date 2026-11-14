# Lunar Landing Site Navigator — kickoff spec

**Status: review draft, 14 November 2026.** The product choices below are from the team conversation; scientific results and the revised communications contract are not validated. This document authorizes no build or data download. Where a detail was delegated to the agent, it is marked as a proposed choice, not a team or Leo sign-off.

## User and answer

The primary user is a **mission planner** deciding which lunar site and mission period offer the best average communications coverage while providing enough sunlight and useful conditions for future operations.

**Confirmed demo question:** At Shackleton Rim from 16–29 August 2027 UTC, when is the site sunlit, and when can at least one selected Earth station communicate with it?

**Answer sentence template:** “At [site] during [period], sunlight is available for [hours / percentage], and at least one selected station has [modeled usable link / geometric visibility only] for [hours / percentage]; [longest blackout] is the longest communications gap.” Never fill this with unvalidated numbers or describe geometry alone as a working link.

## Decisions and scope

- **Coverage:** the user selects Earth ground stations; the objective is the highest average coverage over the mission, measured as the fraction of its elapsed time with at least one selected station available. Do not add overlapping station windows twice. Recalculate with other stations when a station cannot support the link. Identify the station(s) and reason for a gap. A real usable link depends on equipment, availability and propagation as well as line of sight; missing inputs must yield **unknown**, not an invented working link or fabricated outage. Proposed starting station set: NASA DSN's [Goldstone, Madrid and Canberra complexes](https://www.nasa.gov/directorates/somd/space-communications-navigation-program/dsn-complexes/); individual antenna coordinates, capabilities and schedules require sourcing.
- **Observer and geometry:** 1.75 m above local terrain; planetocentric MOON_ME, east-positive longitude; LT+S, subject to Leo's comparison against Horizons; 300 km maximum terrain-search distance, not a fixed distance to the visible horizon. Terrain and lunar curvature determine the horizon by direction; mark truncated rays and quantify limitations. A smooth 1.75 m observer's lunar horizon is approximately 2.47 km, while distant elevated terrain may still obstruct the sky. Crater ejecta rays are unrelated to horizon-search rays. See [illumination-model study](https://pmc.ncbi.nlm.nih.gov/articles/PMC6398960/).
- **Dates:** supported coverage 2026-11-01 00:00 UTC inclusive to 2031-01-01 00:00 UTC exclusive; 30-minute ephemeris steps. Date-only ranges below include the final named day and end at 00:00 UTC the next day. Interpolate and validate window edges; do not imply 30-minute sampling alone proves edge precision.
- **Finder:** proposed defaults retained from the plan: 14 days, at least 70% sunlit, at least 50% combined station coverage, no coverage gap over 48 h, no darkness over 72 h; all adjustable. Rank qualifying windows by combined coverage, with ties and missing inputs explicitly shown. **Leo's rationale and numerical sign-off remain open.** Finder before time scrubber; simple 3D-first UI with Sun, Earth, Moon and stars. Preserve a usable non-WebGL answer.
- **Units:** degrees for angles, kilometres for distances unless `_m`, hours/days for duration, percentages for coverage; ISO 8601 UTC timestamps. Site-scene local ENU coordinates may use metres and must be identified as such. These conventions are explicit, not a claim that every NASA dataset uses them.
- **Site information:** offer the [nine 2024 NASA candidate regions](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/): Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2 and Slater Plain. Label historical regions separately. Connecting Ridge is a separate Blue Moon MK1 target, not a 2024 Artemis region. Regions are areas: identify the exact representative point, source, coordinate frame and uncertainty; do not claim a representative point is NASA's chosen final landing site.
- **Site benefits:** each site's entry must explain its sourced potential for a lunar base and future missions, including site-specific evidence or explicit unknowns for sunlight, terrain/access, communications, science and proximity to permanently shadowed regions or potential water ice. Do not infer usable ice from shadow alone or repeat generic claims as site-specific evidence. The [NASA south-pole overview](https://www.nasa.gov/reference/moonbase-environment/) and [site study](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2025JE009434) provide starting points; individual site claims need checking.
- **Energy and trajectory:** proposed decision, delegated by ninja: keep the ideal-energy and burn assessment outside the event submission, as in the later TASKS item and build plan. No SLS or efficiency data in the event core.

## Comparison points and periods

**Proposed reference points, not proven optimal:** NASA's [Lunar Surface Data Book, table A2-2](https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf) lists Shackleton Rim Site04 at latitude −89.7668°, longitude −171.87°, and Malapert Massif Site23 at −85.9948°, −0.23578°. They are reproducible reference locations; verify the source frame and coordinate conversion before using them. A numerical optimum cannot be chosen without the agreed objective, terrain, station and link inputs, and Leo's validation.

Compare Shackleton Rim for **16–29 August 2027** and **12–26 September 2027**, and Malapert for **21–27 December 2026** and **9–15 January 2028**. These are team-supplied candidate periods, **not verified best windows**. Report calculations, limitations and alternatives before ranking them. The first two are the required same-site/two-period comparison; the first Shackleton period is also used for a two-site comparison with Malapert.

## Data contract — revised contract requires Isaac + Leo sign-off

The existing [build-plan §3](build-plan.md#3-data-contracts-the-agents-build-against-these-change-only-with-i--s-agreeing) remains the baseline: `sites.json` contains sourced sites, frame notes and horizon references; `horizons/<id>.json` contains observer height, azimuth grid, mask, blocking distance, search limit, truncated directions and DEM provenance; monthly `ephem` contains UTC grid, frame, correction, Sun/Earth centre vectors in km, orientations and kernel provenance; `periods.json` has named UTC intervals. See the plan for the full fields.

**Proposed, not approved:** add a sourced station catalogue with stable ID, name, coordinates, terrestrial reference frame and coordinate epoch, antenna capabilities, elevation mask and provenance. Add timestamped station availability and explicit unknown states for schedules, equipment, frequency, weather/attenuation and link-budget parameters. Define a per-station result with geometric lunar and ground visibility, modeled link state (`available`, `unavailable`, `unknown`), reason, inputs and provenance; aggregate by union of available intervals, preserving unknown intervals. Store period boundaries as UTC `[start, end)` and state interpolation and edge tolerances. The existing Moon-centred Earth vector and Earth-orientation quaternion alone do not specify this contract or prove a working link; precise Earth orientation, station coordinates and models require scientific review. Unknown link inputs must not silently become “available”.

## Acceptance criteria

- **UX-01 — correct observer and provenance:** Sun and station calculations identify the lunar site, coordinates, frame, UTC and units. Reject wrong-body observers, Earth-Moon barycentre as Earth, and RA/Dec-only references for azimuth/elevation validation. Q checks the reference configuration; Leo signs Sun/Earth and station geometry against independent references. Results state their source and limitations.
- **UX-02 — direct controls:** A signed-out, unbriefed person can choose a site, date range and stations without setup dialogs, and see sunlight and station coverage together. On desktop and a 375 px touch viewport, answer the confirmed demo question within 60 seconds of opening a fresh URL; no output-column setup.
- **UX-03 — robust core:** Show loading, empty and error states. Invalid or out-of-coverage inputs cannot display NaN or stale values under a new selection. If the 3D/map view fails, the site list, numbers and timeline remain usable. Unknown station availability or link conditions are visibly unknown, not blue active links.
- **UX-04 — reachable sites and numbers:** Every offered site is selectable from a list; any map uses a suitable polar view. Mouse and touch reveal Sun and Earth/station azimuth and elevation as applicable, numerical values and windows. Compare values with Leo's independently validated results.
- **UX-05 — one answer:** One flow presents sunlight, combined selected-station coverage, overlap, daily windows, summaries and selected site/date/station context. Yellow indicates sunlight, black/dark indicates none, and blue indicates a modeled active communications link; provide text/pattern labels and a distinct unknown state. The reference image is a visual mockup with fictional terrain and values, not scientific evidence.
- **Basic comparison:** With two Leo-validated sites and two supported periods, switch Shackleton ↔ Malapert over the same period and switch the two specified Shackleton periods at one site. Context and results update together; after load each change produces a readable answer within 10 seconds. Optional side-by-side layout, map and score may be cut; basic comparison may not. Record timings, failures, fixes and Leo's sign-off in `validation.md`; none is yet passed.

## Demo — team-owned

**Owner: the team together**, per ninja. Proposed storyboard, maximum 30 seconds:

| Time | Screen / narration |
|---|---|
| 0–5 s | Challenge: choosing a lunar site requires sunlight and communications. |
| 5–10 s | Problem: terrain and Earth-station coverage change over a mission. |
| 10–24 s | Show the real app answering the confirmed Shackleton question, including sunlight and selected-station coverage; identify unknowns. |
| 24–30 s | Show a comparison and why it helps a planner choose a mission window. |

The demo must use validated outputs, not the reference image's sample values. Measure its actual runtime.

## Judging map

- **Impact:** site and period comparison helps a planner assess sunlight and communications coverage.
- **Creativity:** terrain, selected Earth stations and the combined timeline connect geometry to a concrete planning choice.
- **Validity:** Leo's independent geometry, horizon and link-model validation and visible uncertainty support the results.
- **Relevance:** the site/date flow and required basic comparison answer the lunar landing-site challenge.
- **Presentation:** the 30-second challenge → problem → app answer → significance storyboard demonstrates the decision.

## Open decisions, validation and mentor questions

- **OPEN — scientific contract:** Isaac and Leo must approve the station model, Earth frame/epoch, elevation masks, link inputs, treatment of unknowns and validation references. Station schedules, actual outages, atmospheric conditions and equipment capabilities cannot be inferred from line of sight. Until sourced and validated, report geometric visibility only and do not claim an active link.
- **OPEN — sources and site coverage:** choose sourced representative points for the remaining candidate regions, verify frames, research each site's distinct potential and limitations, and validate the four candidate date windows. The two NASA reference points are not established as optimal. No proposed period is yet a validated result.
- **OPEN — finder defaults and storyboard:** Leo to assess each numerical threshold and why; team to review the proposed storyboard and the contract before implementation. Exact model of communications failures and rerouting depends on available inputs.
- **MENTOR QUESTIONS — unanswered:** What would judges challenge? Can a lunar/geodesy expert review the validation plan? May minors' first names appear in the submission (default until answered: no, per the official terms in AGENTS.md)? What are the local pitch length and live-demo/slides format?
- **Kickoff recordings (OpenSpace Heilbronn, 14 Nov):** transcribed locally with Whisper large-v3-turbo (full precision); raw transcripts stay in git-ignored `private/transcripts/`. Recognition errors are possible; confirm with organisers before relying on a detail. Not team decisions. What they state:
  - CLPS challenge: compare lunar sites; the named factors are sunlight and the communication link to Earth, "because it needs a direct line of sight". This supports geometric line of sight as the baseline of the station model above.
  - Judging: the local winner is selected Sunday. Finalists are then reviewed through the following Friday by two professors in Munich and industry reviewers; the winner of that Friday round goes on to the global round (prize: NASA visit, engineer contacts, campus tour).
  - Criteria named: the technical aspect, plus creativity (transcribed as "activity") and presentation; "pay attention to both".
  - Local prizes: a design-thinking workshop by Campus Founders, and direct entry to Campus Founders' AI Start programme for the winning team.
  - Admin: every member must be registered on the NASA Space Apps site for both the local (Heilbronn) and the global event, and the project must be submitted on that site.

## Conflicts requiring reconciliation

- `TASKS.md` specifies Earth-centre-above-mask plus margin; build-plan §4.4/§9 specifies any part of Earth's disc. The team's selected-station requirement is a third, more specific model. Neither disc rule by itself establishes station-to-site communications. Keep the old definitions identifiable; reconcile files only after the revised contract is approved.
- The prominent TASKS energy note requests an energy/route feature, while its later phase-6 item and build plan park assessment and exclude it from the event submission. The proposed delegated scope above follows the latter; TASKS has not been changed.
- Build-plan §9 says 2 m observer height; the team confirmed 1.75 m. The existing horizon contract must be updated only after the revised contract is approved.
