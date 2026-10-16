# Decisions and context

Newest at the bottom. Facts checked on 7 Oct 2026 unless noted.

## Challenge choice — CLPS Lunar Mission Browser (7 Oct 2026)

- **Before:** Junior Astronaut Mission Trainer → Flame in Freefall (6 Oct) → **CLPS** (7 Oct).
- **Why not Flame in Freefall:** at least 4 polished public repos already existed by 7 Oct (MicroFire Atlas, FlameScout, FlareNexus, others), all building the same AI-over-NASA-papers dashboard. Hard to stand out; science claims are easy for judges to attack.
- **Why CLPS:** the deliverable is a browse / compare / decide web tool, which matches Isaac's product skills; the team's science and Python skills cover the geometry. About 7 public repos matched the name on 7 Oct, none seen polished. Strong visual demo (sky plot, timeline).
- **Main risk:** terrain horizon masks from LOLA elevation data. Without them, lighting and comms answers are wrong. Go / no-go on 3 Nov (see TASKS.md phase 3).
- **AI is not required** by the CLPS brief (unlike Flame). Don't add AI features unless they make the demo better.

## Agent setup — repo agents and device agents (7 Oct 2026)

- **Before:** agents could only edit this repo, so every download, file copy, account and form was a human `[H]` task.
- **Now:** Isaac also runs **device agents** with computer use on Isaac's own computers (data computer, laptop). They can browse client-side pages, download, copy files between machines and to the USB stick, create Isaac's accounts and fill in forms.
- **Consequence:** tasks that need this are tagged `device` in TASKS.md; several former `[H]` tasks became `[AI+H]` `device`. Rules in AGENTS.md.
- **Still human:** decisions, anything on S's or D's accounts or machines, 2FA/CAPTCHA/ID checks, accepting binding terms, payments and bookings, the timed run through existing tools (pitch pain points), voice recording, pitching.
- **Still gated:** every download, copy outside the repo, account creation and outward message needs Isaac's explicit approval for that action.

## Odds (estimate, not data)

- Assumed 10–25 teams in Heilbronn across all 14 challenges. Corrected 16 Oct by the organisers: the number of global nominations scales with the number of projects submitted at the local event — no fixed quota per country.
- Local win / nomination: ~25–35 % with the prep in TASKS.md done; ~5–10 % without prep. Global award: ~1–3 %. Plan for a local win, treat global as a bonus.
- Biggest levers: validated numbers (horizon + ephemeris) and a tight 3-minute pitch built on concrete pain points of existing tools.

## Event facts

- Venue: OpenSpace Heilbronn, Weipertstraße 8–10. Venue listing: 13–15 Nov, 13:00–19:00. Global hackathon: 14–15 Nov.
- Official challenge page: https://www.spaceappschallenge.org/2026/challenges/clps-lunar-mission-browser/ — summary only on 7 Oct. Official challenge statements (full requirements and resources) release 28 Oct — confirmed by the participant FAQ 16 Oct, no longer hearsay.
- The challenge pages render client-side; plain `curl` returns nothing useful — use a real browser (a device agent, or a human).
- Space Apps team maximum: 6. Our team: 3.
- Check-in Sat 14 Nov, 8:30. No separate Friday programme known as of 16 Oct; the organisers will notify separately if Friday offers exist.
- Wi-Fi available, no restrictions on ports or number of devices. Sockets are scarce — bring power strips (both 16 Oct).
- Under 18: an accompanying person named by name must stay with the participants for the whole event including overnight. One adult can accompany all three; each participant needs a written parental authorisation naming that person (16 Oct). Decided 16 Oct: the accompanying person will be a **Betreuer provided by Isaac's school** (name still pending); the NASA terms' stricter "parent or legal guardian" wording is to be confirmed against this scheme by Sarah (see open questions).
- Overnight at the venue allowed with the chaperone; no sleeping accommodation provided — we organise our own. Organisers offer to connect us with local students for the search, not guaranteed (16 Oct).
- Selection funnel (16 Oct): the local jury rates the submitted projects and the strongest eligible ones go in as Global Nominees — the number scales with the number of local submissions, no fixed quota for Germany or Europe. NASA and partner-agency experts then pick Global Finalists, then Global Winners. Local prizes are independent of the global funnel.

## Open questions (update when answered)

Answered 16 Oct 2026 by the organiser reply: pre-event code rule · Friday agenda · Wi-Fi · sockets · overnight access · global nomination count · local prizes.

Still open:

- Submission format for 2026 and 2026 award categories — answered by the Project Submission Guide and Judging & Awards Guide, both published **13 Nov** (official FAQ timeline). Do not chase these earlier.
- The team registered their own Space Apps accounts (confirmed 16 Oct). The terms require under-18 registration by a parent or legal guardian — ask Sarah how (or whether this) must be fixed.
- Written confirmation from Sarah that the school-Betreuer + written-authorisation scheme satisfies NASA's "accompanied by a parent or legal guardian at all times" wording — the FAQ lets local events set their own extra requirements, her answer is the operative one, get it in writing.
- Whether first names on slides or in the video count as "recognizable names" of minors (the rules bar them from submissions; past winning teams of minors used first names, likely fine — confirm with a mentor).
- Daily opening hours and Sunday end time; food.
- Whether an empty pre-made repo skeleton counts as preparation or a brought-in project (assumed preparation; confirm with a mentor on day 1).

## Organiser reply — answers to the question list (16 Oct 2026)

Sarah (OpenSpace Heilbronn) answered the emailed questions on 16 Oct. Facts are mirrored under Event facts above. Consequences for the plan:

- **Prep rule confirmed.** Allowed before the event: physics reading, public information, NASA datasets, existing tools like JPL Horizons. The actual project must arise during the hackathon — a finished solution brought along and slightly adapted on site does not count. Our split (data, validation scripts and design before; judged frontend at the event) fits the rule.
- **New logistics tasks in TASKS.md phase 0:** written authorisation per participant naming the accompanying adult, sleeping plan (venue with bedding vs. off-site), travel planned around the 8:30 check-in. Authorisation and sleeping decision due 7 Nov, before travel booking. Updated 16 Oct: the accompanying adult will be a **Betreuer provided by Isaac's school**, not a parent — each set of parents authorises that person in writing.
- **Odds entry corrected:** nominations scale with local submission count; no country quota. Local prizes exist and are independent of the global funnel — a local award is not a lesser version of a nomination.

## Official rules read — Participant Terms and participant FAQ (16 Oct 2026)

Sources: 2026 Participant Terms and Conditions (updated 7 Aug 2026), https://www.spaceappschallenge.org/legal/ · participant FAQ, https://www.spaceappschallenge.org/resources/participant-faqs/ . Read 16 Oct in a real browser.

- **Prep rule is stricter than Sarah's email.** FAQ, verbatim: "Teams are not allowed to begin working on the challenges prior to the hackathon." And the full requirements only exist from 28 Oct (statements release) — until then we plan against the 17 Sep summary. **Our position:** pre-event work = general preparation the FAQ and Sarah both welcome (research, physics learning, data downloads, tool exploration, validation scripts, design). Nothing that is itself part of the submission is built before the event; the judged app is written 14–15 Nov. Phase 2–3 outputs are validation artefacts proving the data and math work — documented as preparation in the submission, not solution code.
- **Under 18 (terms + FAQ):** registration by a parent or legal guardian required (our accounts were self-registered — open question above); accompanied by a parent or legal guardian at all times during the event; local events may add requirements (FAQ defers to the Local Lead — the school-Betreuer + authorisation scheme is Sarah's requirement, ask her to confirm it in writing).
- **Minors in the submission:** no participant photos on avatars or the team page; no photo, video, voices or likeness of anyone under 18 in the project demo or submission; no recognizable names of under-18s in submissions. Consequence: demo video = screen-only with captions or TTS, no voiceover, no faces.
- **License and citation requirements are hard:** original content is open source (OSI) — unspecified license means NASA redistributes under Apache 2.0; third-party Solution Materials must be open/free; every material's license stated in the submission documentation; **every source cited, even open source; missing citations can remove the Solution or strip nominations and awards.** Consequence: licenses column in `data/SOURCES.md`, license manifest in the project page text, LICENSE file in the submitted repo.
- **AI use is allowed and its disclosure mandatory.** The FAQ (following a Sep 2026 U.S. EO) calls AI "Super Intelligence (SI)"; SI tools may be used; the submission must include a description of how they were used. Consequence: keep an SI-use log during the event.
- **Official timeline:** 28 Oct statements · 3 Nov Space Apps Connect (community forum, closes at hackathon end) · 13 Nov Project Submission Guide + Judging & Awards Guide · 14–15 Nov event (terms: event starts 14 Nov) · judging after · Dec 2026 Global Nominees, Finalists, Honorable Mentions · Jan 2027 Global Winners.
- **Submission channel:** the team's project page on spaceappschallenge.org — required to be eligible for Global Judging.
- **Team rules reconfirmed:** max 6 members, all members signed up for the same Local Event, one team per person, one challenge per team.
