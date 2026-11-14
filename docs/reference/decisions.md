# Decisions and context

Newest at the bottom. Facts checked on 7 Oct 2026 unless noted.

## Challenge choice — CLPS Lunar Mission Browser (7 Oct 2026)

- **Before:** Junior Astronaut Mission Trainer → Flame in Freefall (6 Oct) → **CLPS** (7 Oct).
- **Why not Flame in Freefall:** at least 4 polished public repos already existed by 7 Oct (MicroFire Atlas, FlameScout, FlareNexus, others), all building the same AI-over-NASA-papers dashboard. Hard to stand out; science claims are easy for judges to attack.
- **Why CLPS:** the deliverable is a browse / compare / decide web tool, which matches Isaac's product skills; the team's science and Python skills cover the geometry. About 7 public repos matched the name on 7 Oct, none seen polished. Strong visual demo (sky plot, timeline).
- **Main risk:** terrain horizon masks from LOLA elevation data. Without them, lighting and comms answers are wrong. Built at the event; go / no-go Sat 14 Nov 22:00 (see TASKS.md phase 4).
- **AI is not required** by the CLPS brief (unlike Flame). Don't add AI features unless they make the demo better.

## Agent setup — repo agents and device agents (7 Oct 2026)

- **Before:** agents could only edit this repo, so every download, file copy, account and form was a human `[H]` task.
- **Now:** Isaac also runs **device agents** with computer use on Isaac's own computers (data computer, laptop). They can browse client-side pages, download, copy files between machines and to the USB stick, create Isaac's accounts and fill in forms.
- **Consequence:** tasks that need this are tagged `device` in TASKS.md; several former `[H]` tasks became `[AI+H]` `device`. Rules in AGENTS.md.
- **Still human:** decisions, anything on S's or D's accounts or machines, 2FA/CAPTCHA/ID checks, accepting binding terms, payments and bookings, the timed run through existing tools (pitch pain points), voice recording, pitching.
- **Still gated:** every download, copy outside the repo, account creation and outward message needs Isaac's explicit approval for that action.

## Odds (estimate, not data)

- Assumed 10–25 teams in Heilbronn across all 14 challenges. Corrected 12 Oct by the organisers: the number of global nominations scales with the number of projects submitted at the local event — no fixed quota per country.
- Local win / nomination: ~25–35 % with the prep in TASKS.md done; ~5–10 % without prep. Global award: ~1–3 %. Plan for a local win, treat global as a bonus.
- Biggest levers: validated numbers (horizon + ephemeris) and a tight 3-minute pitch built on concrete pain points of existing tools.

## Existing team attachment verified (25 Oct 2026)

Device agent on ninja's Mac: after ninja signed in, the Space Apps dashboard listed the existing team **SFZ | MEXG**, local event **Heilbronn** and challenge **Lunar Landing Site Navigator**. The [public team page](https://www.spaceappschallenge.org/2026/find-a-team/mint-exzellenzgymnasium-team-2/) independently shows Team Information → Challenge: Lunar Landing Site Navigator; Local Event: Heilbronn, Germany. The [new challenge page](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) renders that title with the10-CLPS badge. Its old name remains in the team's description, but the structured challenge assignment is correct. No registration, invite, terms or account data changed. This verifies assignment, not the still-pending full statement/resources or human role/physics checks.

## Event facts

- Venue: OpenSpace Heilbronn, Weipertstraße 8–10. Venue listing: 13–15 Nov, 13:00–19:00. Global hackathon: 14–15 Nov.
- Official challenge page: https://www.spaceappschallenge.org/2026/challenges/clps-lunar-mission-browser/ — summary only on 7 Oct. Official challenge statements (full requirements and resources) release 28 Oct — confirmed by the participant FAQ 16 Oct, no longer hearsay.
- The challenge pages render client-side; plain `curl` returns nothing useful — use a real browser (a device agent, or a human).
- Space Apps team maximum: 6. Our team: 4 (Leo joined 22 Oct; registered in the team online, GitHub access).
- **Betreuer (22 Oct):** one Betreuer covers our four and a second team. Settled — not an open question for Sarah.
- Check-in Sat 14 Nov, 8:30. No separate Friday programme known as of 12 Oct; the organisers will notify separately if Friday offers exist.
- Wi-Fi available, no restrictions on ports or number of devices. Sockets are scarce — bring power strips (both 12 Oct).
- Under 18: an accompanying person named by name must stay with the participants for the whole event including overnight. One adult can accompany all three; each participant needs a written parental authorisation naming that person (12 Oct). Decided 16 Oct (after Isaac discussed it further; an earlier idea was a Betreuer from the Jugendforschungszentrum BW): the accompanying person will be a **Betreuer provided by Isaac's school**: **Dagny Locher** (named 25 Oct). Isaac decided 25 Oct that this scheme is accepted despite the NASA terms' "parent or legal guardian" wording; no question to Sarah.
- Overnight at the venue allowed with the chaperone; no sleeping accommodation provided — we organise our own. Organisers offer to connect us with local students for the search, not guaranteed (12 Oct). **Decided 25 Oct:** Jugendherberge Heilbronn, 4-bed room Sat → Sun; the Betreuerin sleeps there, so the team sleeps there too. Day timeline: [docs/event/where-when.md](../event/where-when.md).
- Selection funnel (12 Oct): the local jury rates the submitted projects and the strongest eligible ones go in as Global Nominees — the number scales with the number of local submissions, no fixed quota for Germany or Europe. NASA and partner-agency experts then pick Global Finalists, then Global Winners. Local prizes are independent of the global funnel.
- Heilbronn schedule ([local event page](https://www.spaceappschallenge.org/2026/local-events/heilbronn/?tab=schedule), read 10 Oct): Sat 14 Nov 08:30 registration and breakfast, 10:30 hacking begins, 22:30 day-1 wrap-up; Sun 15 Nov 07:30 doors open, **15:45 final submission deadline** (global deadline is 23:59, the local one counts for us), live pitches from 16:00, 18:00 awards. Breakfast, lunch and dinner are on the schedule.

## Open questions (update when answered)

Answered 12 Oct 2026 by the organiser reply: pre-event code rule · Friday agenda · Wi-Fi · sockets · overnight access · global nomination count · local prizes.

Still open:

- Submission format for 2026 and 2026 award categories — answered by the Project Submission Guide and Judging & Awards Guide, both published **13 Nov** (official FAQ timeline). Do not chase these earlier.
- Whether first names on slides or in the video count as "recognizable names" of minors (the rules bar them from submissions; past winning teams of minors used first names, likely fine — confirm with a mentor).

## Organiser reply — answers to the question list (12 Oct 2026)

Sarah (OpenSpace Heilbronn) answered the emailed questions (sent 10 Oct) on 12 Oct. Facts are mirrored under Event facts above. Consequences for the plan:

- **Prep rule confirmed.** Allowed before the event: physics reading, public information, NASA datasets, existing tools like JPL Horizons. The actual project must arise during the hackathon — a finished solution brought along and slightly adapted on site does not count. Plan consequence: see "Plan rewritten around the pre-event rule" below.
- **New logistics tasks in TASKS.md phase 0:** written authorisation per participant naming the accompanying adult, sleeping plan (venue with bedding vs. off-site), travel planned around the 8:30 check-in. Authorisation and sleeping decision due 7 Nov, before travel booking. Updated 16 Oct: the accompanying adult will be a **Betreuer provided by Isaac's school**, not a parent — each set of parents authorises that person in writing.
- **Odds entry corrected:** nominations scale with local submission count; no country quota. Local prizes exist and are independent of the global funnel — a local award is not a lesser version of a nomination.

## Official rules read — Participant Terms and participant FAQ (16 Oct 2026)

Sources: 2026 Participant Terms and Conditions (updated 7 Aug 2026), https://www.spaceappschallenge.org/legal/ · participant FAQ, https://www.spaceappschallenge.org/resources/participant-faqs/ . Read 16 Oct in a real browser.

- **Prep rule is stricter than Sarah's email.** FAQ, verbatim: "Teams are not allowed to begin working on the challenges prior to the hackathon." And the full requirements only exist from 28 Oct (statements release) — until then we plan against the 17 Sep summary. **Our position (revised 17 Oct):** before the event only general preparation: physics reading, learning NASA datasets and tools, collecting sources, downloading raw public data, logistics. No project scripts, no processed or precomputed project data, no app designs, no skeleton. The earlier position ("validation scripts and design before, as validation artefacts") was dropped: the precomputed per-site JSON would be the data the judged app shows, which is exactly the "finished solution brought along" Sarah ruled out. The [Team Formation Guide](https://www.spaceappschallenge.org/resources/team-formation-guide/) is explicit too: "participants should NOT begin working on their project until the hackathon begins on November 14, 2026 (9:00 a.m. local time)".
- **Under 18 (terms + FAQ):** registration by a parent or legal guardian required (our accounts were self-registered); accompanied by a parent or legal guardian at all times during the event; local events may add requirements (FAQ defers to the Local Lead — the school-Betreuer + authorisation scheme is Sarah's requirement). Isaac decided 25 Oct: self-registration stays, the scheme is accepted, no question to Sarah.
- **Minors in the submission:** no participant photos on avatars or the team page; no photo, video, voices or likeness of anyone under 18 in the project demo or submission; no recognizable names of under-18s in submissions. Consequence: demo video = screen-only with captions or TTS, no voiceover, no faces.
- **License and citation requirements are hard:** original content is open source (OSI) — unspecified license means NASA redistributes under Apache 2.0; third-party Solution Materials must be open/free; every material's license stated in the submission documentation; **every source cited, even open source; missing citations can remove the Solution or strip nominations and awards.** Consequence: licenses column in `docs/reference/data-sources.md`, license manifest in the project page text, LICENSE file in the submitted repo.
- **AI use is allowed and its disclosure mandatory.** The FAQ (following a Sep 2026 U.S. EO) calls AI "Super Intelligence (SI)"; SI tools may be used; the submission must include a description of how they were used. Consequence: keep an SI-use log during the event.
- **Official timeline:** 28 Oct statements · 3 Nov Space Apps Connect (community forum, closes at hackathon end) · 13 Nov Project Submission Guide + Judging & Awards Guide · 14–15 Nov event (terms: event starts 14 Nov) · judging after · Dec 2026 Global Nominees, Finalists, Honorable Mentions · Jan 2027 Global Winners.
- **Submission channel:** the team's project page on spaceappschallenge.org — required to be eligible for Global Judging.
- **Team rules reconfirmed:** max 6 members, all members signed up for the same Local Event, one team per person, one challenge per team. Members can be added until 15 Nov 23:59 local; the team owner approves and removes members and can hand over ownership ([Team Formation Guide](https://www.spaceappschallenge.org/resources/team-formation-guide/), read 10 Oct).
- **2025 award categories** (for orientation until the 2026 guide on 13 Nov): Best Use of Science, Best Use of Data, Best Use of Technology, Galactic Impact, Best Mission Concept, Most Inspirational, Best Use of Storytelling, Global Connection, Art & Technology, Local Impact ([2025 awards](https://www.spaceappschallenge.org/2025/awards/)).

## Team strengths and roles (10 Oct 2026, proposal)

Teammates by initial (B, O, L); no contact data in the repo.

| Person | Says they are strong in |
|---|---|
| Isaac | UI, UX, design, AI |
| B | UI, design |
| O | logic, security |
| L (joined 22 Oct) | physics, rocket science, aerodynamics, MINT |

- **Gap:** the original plan assumed **S** (checks orbital and coordinate math) and **D** (GeoTIFF / raster data). Nobody claims either, and three people lean towards UI.
- **Proposal (not agreed yet, TASKS.md phase 0):** O takes **S** (checking logic and math: tests, Horizons comparisons, the score formula) plus security for deployment. B takes **D = frontend and visual design** (sky plot, timeline, site cards). Isaac keeps product, pitch and integration and drives the AI agents that write the data scripts; O reviews them.
- **Update 22 Oct — L joins and takes S (proposal, not agreed yet).** L is the first teammate who claims physics, which closes the biggest gap. L = **S, science lead**: owns the primer sign-off and the coordinate-frame note, validates ephemeris output against JPL Horizons, checks the horizon-mask geometry (lunar curvature, ray length, Sun as a 0.5° disk) and the PGDA illumination comparison, writes the power-and-comms score formula, makes the science call at the 22:00 go / no-go, and answers the physics questions in pitch Q&A. O moves from S to **Q, code checks**, which fits logic and security better than physics: reviews the agent-written data scripts, owns the tests, runs the security check before deploy. B (D) and Isaac (I) unchanged. Raster / GeoTIFF handling still has no owner: Isaac + agents write it, L checks the geometry, O reviews the code.
- **Consequence (10 Oct, before L):** science validation is the weakest point. Ask a mentor with lunar or geodesy background early on Saturday, and rely on hard external checks (JPL Horizons, PGDA illumination maps).
- **Agent capacity:** O has two Claude Max plans; Isaac has his own Claude account. That allows parallel agents on separate worktrees (one file set per agent, AGENTS.md).

## Plan rewritten around the pre-event rule (17 Oct 2026)

- **Before:** phases 1–6 built scripts, horizon masks, precomputed JSON, wireframes and a skeleton before the event.
- **Now:** phases 1–2 are allowed preparation only (primer, source list, data guide, tool tests, learning, raw data downloads, laptops, logistics). Phases 3–6 are the build at the event, Sat 10:30 → Sun 15:45, with checkpoints Sat 16:00 (ephemeris validated), 20:00 (sky plot with real data), 22:00 (horizon go / no-go), Sun 12:00 (freeze), 15:00 (submitted, 45 min before the local deadline).
- **Judgement call:** downloading raw kernels and LOLA tiles before the event counts as getting to know NASA datasets (allowed by Sarah); processing them for our sites does not.
- **Consequence:** the riskiest part (horizon masks) now happens on Saturday afternoon. The 22:00 go / no-go protects the demo: fewer sites with validated numbers beat many sites with wrong ones.
- **Workflow ideas kept from a hackathon video Isaac found:** start the spec from the winning demo and work backwards; split the spec into independent tasks for parallel agents; point agents at good examples (inspiration list); live demo with a recorded backup. Rejected: skipping sleep (minors with a Betreuer; tired people ship wrong numbers), stalling judges, databases and payment services.

## Official challenge statement read (25 Oct 2026)

Source: challenge page read 25 Oct 2026, 03:07 CET, on Isaac's laptop (device agent, real browser; pages render client-side). Read early against the 28 Oct task in TASKS.md phase 1. **The full statement is not published yet** — only the summary is live. The line-by-line comparison against TASKS.md phases 3–6 therefore stays open; repeat this read on/after 28 Oct (that task stays open).

- **The challenge was renamed and moved.** The URL recorded on 7 Oct in this file ([…/challenges/clps-lunar-mission-browser/](https://www.spaceappschallenge.org/2026/challenges/clps-lunar-mission-browser/)) returns "Oops! Page Not Found" (checked 25 Oct). The same challenge now lives at [https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) as **"Lunar Landing Site Navigator"**. Same challenge confirmed: the agency badge on the page still reads "10 - CLPS" and the summary is the CLPS brief (south-pole lighting and comms, Sun/Earth positions vs. the horizon).
- **What the page has (25 Oct).** Details tab: event, difficulty badges **Advanced + Intermediate**, subjects **Human Exploration, Moon, Software, Space Exploration**, and the summary paragraph quoted below. Resources tab: "Resources coming soon." Teams tab: no team list visible while logged out. No objectives, no "potential considerations", no resource list, no deliverable requirements anywhere on the page.
- **Summary (verbatim, 25 Oct):** "Missions to the Moon’s south pole face extreme lighting and communication constraints, and planning them takes careful coordination between science and engineering teams. Tools for determining Sun and Earth positions at candidate landing sites exist, but their complicated interfaces make it difficult to evaluate critical information with efficiency. Your challenge is to create an intuitive tool or application that lets mission planners, educators, and the public compare landing sites and dates quickly, visualizing Sun and Earth positions relative to the horizon to assess power generation potential and direct-to-Earth communication windows."
- **Summary vs. plan: no contradiction.** Compare landing sites and dates → site picker + comparison view; Sun/Earth positions relative to the horizon → sky plot with horizon mask; power generation potential → lit-fraction windows; direct-to-Earth communication windows → comms windows. The named audiences (mission planners, educators, the public) confirm the phase-1 "who is the user" question; the answer is still due at the Saturday kickoff. Nothing in the summary supports adding AI features — "AI is not required" (7 Oct) stands.
- **Open because of the rename (needs Isaac, logged in):** check the team is still attached to the challenge on the new page (phase-0 registration tick was made on the old URL; the Teams tab shows nothing publicly). If the team shows "Lunar Landing Site Navigator" under "my challenges", nothing to do.

## Roles agreed and sleeping at the venue (26 Oct 2026)

- **Roles (Isaac as team lead, 26 Oct; confirmed by the team in the WhatsApp group the same day):** Isaac = team lead and **BOA** (big orchestrator of agents): runs the agents on Otto's two Claude Max 20x plans during the event and teaches the others how to use them properly. **L = S, science lead** (primer and sources sign-off, physics, go / no-go). **O = Q** (reads the code line by line, tests, security). **B = D** (frontend and design; B's taste decides how it looks). **Everyone presents the pitch and the product** — no single presenter.
- **Weekly sync:** in the WhatsApp group instead of a call. Proposed: every Sunday by 20:00 each member posts done / next / blocked.
- **Sleeping: the whole team stays overnight at the venue** (OpenSpace Heilbronn; overnight allowed with the chaperone, organiser reply 12 Oct). This **replaces the Jugendherberge decision of 25 Oct**: no hostel booking, no DJH card, no late-entry or key arrangements. The venue provides no sleeping accommodation, so everyone brings sleeping bag and mat. The hostel rows in docs/event/where-when.md are superseded.
- **Still needed:** each participant's written parental authorisation naming Dagny Locher, due 7 Nov (Isaac's: calendar slot 29 Oct).

## Challenge release-day check and data review (28 Oct 2026)

Device agent: Codex on ninja's Mac (`Guest123`), approximately 14:04 CET. Read the [current challenge page](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) in a real browser, including both Details and Resources.

**Release status:** Details still contains the summary and metadata only; Resources says "Resources coming soon." No full objectives, considerations, required deliverables or challenge resource list were visible. The expected release date does not establish that publication has happened. The full statement comparison remains open; no full-statement rescope or judging requirements can be claimed from this check.

Summary-to-plan comparison (not a substitute for the missing full statement):

| Published summary requirement | Existing plan | Result on 28 Oct |
|---|---|---|
| Intuitive tool for mission planners, educators and the public | Phase 3 spec interview chooses the primary user using the timed tools run | Compatible; primary user remains a team decision at kickoff |
| Quickly compare sites and dates | Phase 4 site picker; phase 5 timelines, summaries and optional side-by-side view | Compatible if switching sites/dates remains possible; cutting the side-by-side view must not remove all comparison |
| Sun and Earth relative to the horizon | Phase 4 ephemeris, terrain mask and sky plot | Already covered |
| Assess power generation potential | Phase 5 illumination/windows and summaries | Already planned as illumination potential; no new claim of electrical power in watts |
| Direct-to-Earth communication windows | Phase 5 Earth-visibility windows | Already planned as geometric visibility; no claim of a complete radio-link budget |
| Resources, judging details and required submission format | Phase 2 guide read on 13 Nov; phase 6 format remains guide-dependent | Not available from this challenge-page check |

**Plan decision:** retain phases 3–6 provisionally. No new requirements were published in the material visible today. Re-open the full comparison when the Details tab gains the full statement and the Resources tab gains its sources; the 13 Nov submission/judging guide task stays separate. Nothing was built, designed or processed for the project.

**Data review:** candidate sizes, projections and usage terms are recorded in [data-guide.md](data-guide.md#candidate-review--28-oct-2026). Recommendation for phase 2: the existing [download-checklist.md](../archive/download-checklist.md) required set, 5,082,105,383 bytes (~5.1 GB): SPICE + adjusted 20 m DEM + PDS 5 m polar DEM/label + reference maps. Keep the PDS 10 m pair and PSR map optional; defer the SDEM archive. **Selected by ninja on 28 Oct:** use this recommended 5.1 GB set; keep 10 m optional and defer SDEM. The data-selection decision is complete. This does not approve downloads or select final sites; physics/frame sign-off remains with S. Only public pages/metadata and HTTP headers were read; no datasets were saved.

## Completed source comparison and product gaps (28 Oct 2026, ninja clarification)

**DECIDED — DO NOT REOPEN without new source material:** ninja specified the [current challenge page](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) and Sarah's email as the sources for this slot. Codex re-read the page in a real browser and the actual email in Apple Mail: Sarah, 12 Oct 2026, 10:29, subject "Re: NASA Space Apps 2026 Heilbronn – Fragen vor dem Event (CLPS Lunar Mission Browser)". The earlier release-day entry accurately records what was visible, but its conclusion that another publication was needed to close the review is superseded. The comparison is complete against the supplied sources. Resources not yet supplied are not a blocker; actual submission-field instructions are checked separately before submission. Prior terms/FAQ notes above remain historical records and do not imply additional missing challenge deliverables.

The summary-to-plan matrix above covers every functional request on the challenge page. One concrete gap needed a plan change: comparing sites and dates cannot disappear when the side-by-side view is cut. Phases 3 and 5 now require comparison across at least two validated sites and two supported date ranges, even with simple selectors. Score, extra layout and map remain optional. Illumination is a power-potential proxy and geometric visibility a DTE proxy; neither is presented as a full electrical/radio engineering result.

Sarah's email-to-plan check:

| Email point | Plan consequence / status |
|---|---|
| Saturday 08:30 check-in; Friday updates separately | Phase 0 travel and phase 3 check-in already match; check latest organiser messages before travel |
| Written parental authorisation per participant naming the accompanying adult; adult stays throughout, including overnight | Phase 0 authorisation/packing and the venue sleep plan retain this. Sarah's email refers to the then-three-person team; the four-person school-Betreuer arrangement is ninja's later recorded decision, not a new claim made by this email |
| Venue overnight allowed with accompaniment; no sleeping accommodation provided | Keep 26 Oct venue decision, sleeping bag + mat; remove the stale hostel dependency in event-plan.md. No human work is required overnight to make the build schedule succeed |
| WLAN available, no port/device-count restriction | Existing offline laptop/data preparation stays as a reliability measure, not a response to an imposed port limit |
| Bring a power strip; socket per device not guaranteed | Existing packing task already matches |
| Nominations scale with local submissions, no Germany/Europe quota; local awards separate | Existing event facts already match; no product feature or fixed nomination count added |
| Learn physics, public NASA data and existing tools; project itself arises at hackathon, not a finished solution lightly adapted | Phases 1–2 stay preparation; all scripts, processed site data, interface design and implementation tests stay in phases 3–6. This review changes the plan only |

**Tool-review follow-through:** only partial before today. Existing tasks addressed terrain, combined Sun/Earth plots and timelines, but not the wrong-observer trap, visible defaults, account-free access, map failure/projection recovery or a timed mobile usability check. [UX-01–05](existing-tools.md#product-follow-through--28-oct-2026) now map every human pain point to an owner, implementation phase and acceptance evidence. TASKS.md, the event plan and I/Q/D team files carry these checks. They are future event work, not already-fixed product bugs.

## I rows agent-executed (29 Oct 2026)

**DECIDED — DO NOT REOPEN without a reason:** ninja's own tool learning (I rows: spiceypy short, rasterio + pyproj) and his event-side scripting run agent-first — the agent writes and executes the tutorial exercises and project scripts, ninja reviews and restates the output. Reason: the whole weekend is agent-driven anyway (Claude Code on Otto's plans, AI-use log required), so the human bar on the I side is judging output, not typing code. Consequence recorded everywhere: since no human on the I side eyeballs SPICE or raster numbers directly, Otto's tests/review and Leo's independent validation are the only correctness net — their sign-off gates stay unchanged and Leo's audit review stays first in his checklist. learning.md and the team files carry the changed Done-when wording. No project code was written by this decision; it changes who types, not the prep rule.

## Full challenge statement published (10 Nov 2026)

Device agent: Claude Code on ninja's Mac (`Guest123`), real browser, 10 Nov 2026. Read the [challenge page](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/), Details and Resources tabs, and the [Resources / Participant Guides page](https://www.spaceappschallenge.org/resources/). This is new source material, so it reopens the 28 Oct comparison for the points below only.

**What changed on the page:** Details now carries Background, Objectives and Potential Considerations in addition to the summary (summary text unchanged from 25 Oct). The Resources tab reads "Resources will be available on Friday, November 13." The Participant Guides page lists only the FAQ, Team Formation Guide and Space Apps Connect Guide — no Submission or Judging guide yet.

**Requirement strength:** only one objective is phrased as a requirement: "Display the positions of the Sun and Earth relative to the horizon at a selected landing site on a chosen date." Every other objective is "you may consider"; the considerations are "may (but are not required to)". The stated format is open: "a web application, a mobile app, an interactive visualization, an educational game, or another format entirely — as long as it makes rapid site evaluation clear and efficient."

**User story from the Background (use in the pitch):** schedules slip ("hardware development challenges, launch delays"), and "engineers need to quickly evaluate alternative sites in the same region, or alternative dates at the same site". The page names Quickmap, Moon Trek and JPL Horizons as the hard-to-use existing tools — the same three as ninja's 27 Oct timed run.

Statement vs. plan (TASKS.md phases 3–6):

| Statement item (all optional unless marked) | Plan today | Result |
|---|---|---|
| **Required:** Sun and Earth positions relative to the horizon, selected site, chosen date | Sky plot with terrain horizon, numeric az/el | Covered |
| Curated site list, side-by-side or sequential comparison | Curated list; comparison across ≥ 2 sites and ≥ 2 date ranges required, side-by-side optional | Covered |
| Alternative dates at one site / alternative sites in one region | Same required comparison | Covered; matches the Background story |
| "How much time remains before sunset or Earthset" (objectives and considerations, twice) | Windows and longest-blackout summaries; no time-remaining readout | **Gap** — derivable from `windows.py` output |
| Solar elevation angle displayed "prominently"; duration of sunlight; Earth visibility windows | Numeric az/el for the selected time; % lit and windows in summaries | Partly covered — elevation not planned as a prominent value |
| Animations or timeline views over a lunar day or several days | Daily timeline | Partly covered — no time scrubber/animation |
| Conditions across "different lunar days or seasons" | Two supported date ranges | Partly covered — depends on which ranges the spec picks |
| Custom lunar coordinates | Excluded (static precomputed data, 28 Oct) | Not planned — terrain masks cannot be precomputed for arbitrary sites |
| Notable sites beyond the south pole (Apollo, other countries' landers) | South-pole sites from `docs/reference/sources.md` only | Not planned |
| 2D maps, 3D surface views | Map optional (third on the cut list); 3D not planned | Unchanged |
| Terrain-based horizon, no atmospheric refraction, libration | Horizon mask from LOLA; SPICE ephemeris | Covered |
| Help users see why small location/date changes matter; serve planners, educators and the public | Comparison view, glossary | Covered |

**Not decided here:** whether time-remaining, a prominent solar-elevation value or a time scrubber enter the spec is decided at the Saturday 10:30 spec interview (prep rule: no spec or app design before 14 Nov 09:00). TASKS.md and the event plan are unchanged by this entry.

**For the 13 Nov check (TASKS.md phase 2):** also read the challenge Resources tab that day and compare its list against `docs/reference/data-guide.md` and `docs/reference/data-sources.md`.

**Stale after this read:** statements in README.md, AGENTS.md and `docs/event/NASA-Heilbronn-CLPS.pdf` that the page shows the summary only. Not edited here.

**Re-check 11 Nov 2026** (Claude Code, real browser): Details, Resources tab and Participant Guides unchanged from 10 Nov. The stale statements above are fixed: README.md now summarises the full statement, AGENTS.md and the PDF no longer say summary-only, and the PDF links the current challenge URL. GitHub repo renamed `clps-lunar-mission-browser` → `lunar-landing-site-navigator` to match the challenge name.

## Leo writes no code (10 Nov 2026)

**DECIDED — DO NOT REOPEN without a reason:** ninja, 10 Nov: Leo does not learn spiceypy or any programming language for this event; agents write and run all code. His spiceypy and worktree prep rows are removed. Reason: four days left, and a science lead's value is judging numbers, not typing them. Consequence: Leo's sign-off must rest on values obtained without our code, otherwise nobody independent checks the agents (29 Oct decision). His prep is now Horizons by hand, one hand-calculated row, a checklist for reading agent output, the illumination-map definitions and judge questions; at the event he picks the sample points and pulls the Horizons reference himself while an agent runs our script. Sign-off gates unchanged. Files: docs/event/team.md (section Leo), docs/reference/learning.md.

## Build order and bonus scope (11 Nov 2026)

**DECIDED by ninja, 11 Nov:** the team builds strictly in order of importance and goes as far as time allows, aiming at as many optional items of the statement as possible. A step is done only when its known bugs are fixed and Leo/Otto signed it off (bug gate); no new features after the feature freeze. The seven-step order is in [event-plan.md](../event/event-plan.md#build-order-ninja-11-nov). This replaces "3D not planned" and "custom coordinates not planned" (10 Nov table above): both are now the last two steps (6 and 7), reached only if steps 1–5 pass. Reason: the team laptops (ThinkPad X1 Carbon Gen 13, Arc 140V, 16 GB) can run a light 3D view, and Leo and Otto review fast. No route or traverse planning: the challenge evaluates a site and a date, not how the lander gets there (statement read 10/11 Nov).

## Build plan before the event (11 Nov 2026)

**DECIDED by ninja, 11 Nov:** a detailed written build plan is made before the event: [docs/event/build-plan.md](../event/build-plan.md). It contains no code. Reason (ninja): a precise plan is worth more than any hour of the hackathon; without knowing what you want you cannot judge what to improve. The agent pointed out the FAQ wording ("Teams are not allowed to begin working on the challenges prior to the hackathon") and offered to ask Sarah; ninja declined. Unchanged: no scripts, processed data, app skeleton or other code before Sat 14 Nov 09:00. The plan supersedes "spec written at the 10:30 interview" (the kickoff now confirms the plan and its open decisions) and changes the horizon azimuth step from 1° to 0.5°.

## Repo layout (11 Nov 2026)

ninja asked for folders people browse to stay minimal. Layout since 11 Nov: code only in `scripts/` and `app/`; `docs/event/` (weekend material), `docs/reference/` (background), `docs/archive/` (finished). The four team files are merged into `docs/event/team.md`; `NEEDS.md` and the offline setup into `docs/reference/setup.md`; `data/SOURCES.md` is now `docs/reference/data-sources.md`; pipeline output goes to `app/public/data/`. `private/` is git-ignored.

## Plan review and fact check (13 Nov 2026)

Full review: [docs/event/plan-review-13nov.md](../event/plan-review-13nov.md). Applied to build-plan.md, event-plan.md, team.md and TASKS.md the same day (ninja asked for the fact check and for as many challenge objectives as possible in the plan; plan text only, no code before Sat 09:00).

- Curated sites follow NASA's **28 Oct 2024** nine-region set first; 2022-only regions labelled "dropped in 2024"; Connecting Ridge labelled as Blue Moon MK1 target.
- Light-time effect corrected to ~0.006° (aberration), not 0.07°; LT+S stays to match Horizons.
- Horizon rays 300 km (was 150 km).
- New: landing window finder (step 2b), panel-type toggle + "vs. Earth" card, PSR layer + PGDA 60 m inset + CSV export (step 4), international and commercial sites (step 5), UTC time field, step-1-lite fallback if T9 is not green by Sat 18:00.
- Event plan aligned with the official local schedule (Mentor Round #1 11:00, stand-ups 18:00, Mentor Round #2 Sun 10:30, workshop 12:00, submission checkpoint 14:30).
- **Open, for ninja/Isaac at kickoff:** confirm build-plan §9 items 6–8; whether step 2b ranks above step 3 (recommended: yes, it answers the problem statement directly).

## 3D-first, simple UI (13 Nov 2026)

**DECIDED by ninja, 13 Nov:** "the most simple UI possible but with beautiful 3D", started "from the start", camera free to "move around … to see multiple angles"; bodies limited to what matters ("not like the full solar system but with the necessary planets and suns and moons"). Finder defaults confirmed and adjustable; finder ranks above the scrubber. Plan: [build-plan.md §5.1 and §5.4](../event/build-plan.md#54-the-3d-viewer-how-we-build-it-and-how-agents-build-it-without-seeing-it). Consequences: polar plot and 2D map dropped (globe replaces the map), horizon strip kept for exact values and as the no-WebGL fallback, first-load budget 1.5 → 5 MB, ephemeris gains two quaternions, tests T14–T17, stop rule at Sat 22:00 (T14 red → strip becomes the main view). Textures downloaded 13 Nov on ninja's Mac with ninja's approval ("yes, do now on this laptop"), see data-sources.md.

## Agent driving and capacity (13 Nov 2026)

- **Isaac drives every agent** (ninja, 13 Nov), through one orchestrator session that runs the briefs in [agent-briefs.md](../event/agent-briefs.md) as worktree-isolated subagents and merges after re-running each brief's checks. Otto, Bene and Leo review and sign; they do not drive agents.
- **Capacity (ninja, 13 Nov):** one Claude Max 20x and one Max 5x plan (supersedes "O has two Claude Max plans", 26 Oct). Haiku for mechanical work, Opus for physics, horizon, 3D and visual review; never Sonnet (model table in agent-briefs.md).
- **Checked 13 Nov 12:40:** the Claude account logged in on ninja's Mac reports plan **Pro** (weekly 45 % used, reset 13 Nov 19:00). Before Saturday, log the Max 20x account into the laptop that runs the orchestrator.

## Sleep in two shifts (13 Nov 2026)

**DECIDED by ninja, 13 Nov:** Leo + Isaac sleep 22:00–01:00, Otto + Bene 01:00–04:00. Reason (ninja): Isaac's and Leo's concentration drops after 22:00, Otto and Bene work well late; three hours is accepted, catch-up after the event. Replaces the six-hour baseline of 26 Oct. Plan changes: horizon go/no-go and T14 stop rule 22:00 → 21:30, pitch rehearsal 1 → 21:15, handover 21:40–22:00, Otto + Bene take the official 22:30 wrap-up, Sunday steps start 01:00. Open: Dagny Locher confirms (she stays with the team all night).


## Pitch deck drafted before the event (13 Nov 2026)

**DECIDED by ninja, 13 Nov:** draft the full 7-slide backup deck before Saturday (second exception to the pre-event rule, after the build plan). Agent flagged that slides are a judged submission artifact; ninja chose the full deck over an outline only. Limits: problem, timed-tool results, approach and known limits only; every fact about the built app (screenshot, measured error, validated sites, cut features) stays a visible [Sunday] slot in [pitch-outline.md](../event/pitch-outline.md) until it exists. Regenerate with `python3 scripts/tools/make_pitch_pdf.py`.

## 2026 Project Submission Guide read (14 Nov 2026, 09:35)

Source: https://www.spaceappschallenge.org/resources/project-submission-guide/ (dated 13 Nov 2026).

1. **Demo limit:** video ≤ 30 s or slide deck ≤ 7 slides incl. title and intro. Exceeding either makes the project ineligible for Global Judging. English, or English subtitles on a video.
2. **Links without login:** yes. Demo and final-project links must open with no password, permission or registration. Images (JPG/PNG/GIF ≤ 10 MB) can be uploaded to the page; videos and documents cannot.
3. **Public code link:** not required. "Link to Final Project" may be a website. → The repo stays private; final-project link = https://nasa.digi-works.org. Optional: request a FortiGuard web-filter classification for the site so judges' networks don't block it.

Also: SI (AI) use must be marked in the project itself: code and data need an acknowledgement in descriptive text and metadata, images/videos a visible watermark. SI must not be used to come up with the idea. At least one NASA dataset is required for a Global Award. Global submission closes Sun 15 Nov 23:59 local; our local deadline 15:45 stays. Submit = tick Terms and "Confirm All Work is Original", then "Submit for Judging"; resubmission allowed until close.
