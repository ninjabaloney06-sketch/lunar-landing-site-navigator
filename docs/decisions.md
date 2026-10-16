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
- Official challenge page: https://www.spaceappschallenge.org/2026/challenges/clps-lunar-mission-browser/ — summary only on 7 Oct; full resources expected 28 Oct (per a local organiser, unconfirmed).
- The challenge pages render client-side; plain `curl` returns nothing useful — use a real browser (a device agent, or a human).
- Space Apps team maximum: 6. Our team: 3.
- Check-in Sat 14 Nov, 8:30. No separate Friday programme known as of 16 Oct; the organisers will notify separately if Friday offers exist.
- Wi-Fi available, no restrictions on ports or number of devices. Sockets are scarce — bring power strips (both 16 Oct).
- Under 18: an accompanying person named by name must stay with the participants for the whole event including overnight. One parent can accompany all three; each participant needs a written parental authorisation naming that person (16 Oct).
- Overnight at the venue allowed with the chaperone; no sleeping accommodation provided — we organise our own. Organisers offer to connect us with local students for the search, not guaranteed (16 Oct).
- Selection funnel (16 Oct): the local jury rates the submitted projects and the strongest eligible ones go in as Global Nominees — the number scales with the number of local submissions, no fixed quota for Germany or Europe. NASA and partner-agency experts then pick Global Finalists, then Global Winners. Local prizes are independent of the global funnel.

## Open questions (update when answered)

Answered 16 Oct 2026 by the organiser reply: pre-event code rule · Friday agenda · Wi-Fi · sockets · overnight access · global nomination count · local prizes.

Still open:

- Submission format for 2026 (past years: 30-second video or up to 7 slides).
- Daily opening hours and Sunday end time; food.
- 2026 award categories (2025 categories used for now: Best Use of Data, Best Use of Technology, Galactic Impact).
- Whether an empty pre-made repo skeleton counts as preparation or a brought-in project (assumed preparation; confirm with a mentor on day 1).

## Organiser reply — answers to the question list (16 Oct 2026)

Sarah (OpenSpace Heilbronn) answered the emailed questions on 16 Oct. Facts are mirrored under Event facts above. Consequences for the plan:

- **Prep rule confirmed.** Allowed before the event: physics reading, public information, NASA datasets, existing tools like JPL Horizons. The actual project must arise during the hackathon — a finished solution brought along and slightly adapted on site does not count. Our split (data, validation scripts and design before; judged frontend at the event) fits the rule.
- **New logistics tasks in TASKS.md phase 0:** pick the accompanying parent, written authorisation per participant, sleeping plan (venue with bedding vs. off-site), travel planned around the 8:30 check-in. Authorisation and sleeping decision due 7 Nov, before travel booking.
- **Odds entry corrected:** nominations scale with local submission count; no country quota. Local prizes exist and are independent of the global funnel — a local award is not a lesser version of a nomination.
