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

- Assumed 10–25 teams in Heilbronn across all 14 challenges. Corrected 13 Oct by the organisers: the number of global nominations scales with the number of projects submitted at the local event — no fixed quota per country.
- Local win / nomination: ~25–35 % with the prep in TASKS.md done; ~5–10 % without prep. Global award: ~1–3 %. Plan for a local win, treat global as a bonus.
- Biggest levers: validated numbers (horizon + ephemeris) and a tight 3-minute pitch built on concrete pain points of existing tools.

## Event facts

- Venue: OpenSpace Heilbronn, Weipertstraße 8–10. Venue listing: 13–15 Nov, 13:00–19:00. Global hackathon: 14–15 Nov.
- Official challenge page: https://www.spaceappschallenge.org/2026/challenges/clps-lunar-mission-browser/ — summary only on 7 Oct. Official challenge statements (full requirements and resources) release 28 Oct — confirmed by the participant FAQ 16 Oct, no longer hearsay.
- The challenge pages render client-side; plain `curl` returns nothing useful — use a real browser (a device agent, or a human).
- Space Apps team maximum: 6. Our team: 4 (Leo joined 22 Oct; registered in the team online, GitHub access).
- **Betreuer (22 Oct):** one Betreuer covers our four and a second team. Settled — not an open question for Sarah.
- Check-in Sat 14 Nov, 8:30. No separate Friday programme known as of 13 Oct; the organisers will notify separately if Friday offers exist.
- Wi-Fi available, no restrictions on ports or number of devices. Sockets are scarce — bring power strips (both 13 Oct).
- Under 18: an accompanying person named by name must stay with the participants for the whole event including overnight. One adult can accompany all three; each participant needs a written parental authorisation naming that person (13 Oct). Decided 16 Oct (after Isaac discussed it further; an earlier idea was a Betreuer from the Jugendforschungszentrum BW): the accompanying person will be a **Betreuer provided by Isaac's school**: **Dagny Locher** (named 25 Oct). Isaac decided 25 Oct that this scheme is accepted despite the NASA terms' "parent or legal guardian" wording; no question to Sarah.
- Overnight at the venue allowed with the chaperone; no sleeping accommodation provided — we organise our own. Organisers offer to connect us with local students for the search, not guaranteed (13 Oct). **Decided 25 Oct:** Jugendherberge Heilbronn, 4-bed room Sat → Sun; the Betreuerin sleeps there, so the team sleeps there too. Day timeline: [WHERE-WHEN.md](../WHERE-WHEN.md).
- Selection funnel (13 Oct): the local jury rates the submitted projects and the strongest eligible ones go in as Global Nominees — the number scales with the number of local submissions, no fixed quota for Germany or Europe. NASA and partner-agency experts then pick Global Finalists, then Global Winners. Local prizes are independent of the global funnel.
- Heilbronn schedule ([local event page](https://www.spaceappschallenge.org/2026/local-events/heilbronn/?tab=schedule), read 10 Oct): Sat 14 Nov 08:30 registration and breakfast, 10:30 hacking begins, 22:30 day-1 wrap-up; Sun 15 Nov 07:30 doors open, **15:45 final submission deadline** (global deadline is 23:59, the local one counts for us), live pitches from 16:00, 18:00 awards. Breakfast, lunch and dinner are on the schedule.

## Open questions (update when answered)

Answered 13 Oct 2026 by the organiser reply: pre-event code rule · Friday agenda · Wi-Fi · sockets · overnight access · global nomination count · local prizes.

Still open:

- Submission format for 2026 and 2026 award categories — answered by the Project Submission Guide and Judging & Awards Guide, both published **13 Nov** (official FAQ timeline). Do not chase these earlier.
- Whether first names on slides or in the video count as "recognizable names" of minors (the rules bar them from submissions; past winning teams of minors used first names, likely fine — confirm with a mentor).

## Organiser reply — answers to the question list (13 Oct 2026)

Sarah (OpenSpace Heilbronn) answered the emailed questions (sent 10 Oct) on 13 Oct. Facts are mirrored under Event facts above. Consequences for the plan:

- **Prep rule confirmed.** Allowed before the event: physics reading, public information, NASA datasets, existing tools like JPL Horizons. The actual project must arise during the hackathon — a finished solution brought along and slightly adapted on site does not count. Plan consequence: see "Plan rewritten around the pre-event rule" below.
- **New logistics tasks in TASKS.md phase 0:** written authorisation per participant naming the accompanying adult, sleeping plan (venue with bedding vs. off-site), travel planned around the 8:30 check-in. Authorisation and sleeping decision due 7 Nov, before travel booking. Updated 16 Oct: the accompanying adult will be a **Betreuer provided by Isaac's school**, not a parent — each set of parents authorises that person in writing.
- **Odds entry corrected:** nominations scale with local submission count; no country quota. Local prizes exist and are independent of the global funnel — a local award is not a lesser version of a nomination.

## Official rules read — Participant Terms and participant FAQ (16 Oct 2026)

Sources: 2026 Participant Terms and Conditions (updated 7 Aug 2026), https://www.spaceappschallenge.org/legal/ · participant FAQ, https://www.spaceappschallenge.org/resources/participant-faqs/ . Read 16 Oct in a real browser.

- **Prep rule is stricter than Sarah's email.** FAQ, verbatim: "Teams are not allowed to begin working on the challenges prior to the hackathon." And the full requirements only exist from 28 Oct (statements release) — until then we plan against the 17 Sep summary. **Our position (revised 17 Oct):** before the event only general preparation: physics reading, learning NASA datasets and tools, collecting sources, downloading raw public data, logistics. No project scripts, no processed or precomputed project data, no app designs, no skeleton. The earlier position ("validation scripts and design before, as validation artefacts") was dropped: the precomputed per-site JSON would be the data the judged app shows, which is exactly the "finished solution brought along" Sarah ruled out. The [Team Formation Guide](https://www.spaceappschallenge.org/resources/team-formation-guide/) is explicit too: "participants should NOT begin working on their project until the hackathon begins on November 14, 2026 (9:00 a.m. local time)".
- **Under 18 (terms + FAQ):** registration by a parent or legal guardian required (our accounts were self-registered); accompanied by a parent or legal guardian at all times during the event; local events may add requirements (FAQ defers to the Local Lead — the school-Betreuer + authorisation scheme is Sarah's requirement). Isaac decided 25 Oct: self-registration stays, the scheme is accepted, no question to Sarah.
- **Minors in the submission:** no participant photos on avatars or the team page; no photo, video, voices or likeness of anyone under 18 in the project demo or submission; no recognizable names of under-18s in submissions. Consequence: demo video = screen-only with captions or TTS, no voiceover, no faces.
- **License and citation requirements are hard:** original content is open source (OSI) — unspecified license means NASA redistributes under Apache 2.0; third-party Solution Materials must be open/free; every material's license stated in the submission documentation; **every source cited, even open source; missing citations can remove the Solution or strip nominations and awards.** Consequence: licenses column in `data/SOURCES.md`, license manifest in the project page text, LICENSE file in the submitted repo.
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
