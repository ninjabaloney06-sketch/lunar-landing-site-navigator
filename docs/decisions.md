# Decisions and context

Newest at the bottom. Facts checked on 7 Oct 2026 unless noted.

## Challenge choice — CLPS Lunar Mission Browser (7 Oct 2026)

- **Before:** Junior Astronaut Mission Trainer → Flame in Freefall (6 Oct) → **CLPS** (7 Oct).
- **Why not Flame in Freefall:** at least 4 polished public repos already existed by 7 Oct (MicroFire Atlas, FlameScout, FlareNexus, others), all building the same AI-over-NASA-papers dashboard. Hard to stand out; science claims are easy for judges to attack.
- **Why CLPS:** the deliverable is a browse / compare / decide web tool, which matches Isaac's product skills; the team's science and Python skills cover the geometry. About 7 public repos matched the name on 7 Oct, none seen polished. Strong visual demo (sky plot, timeline).
- **Main risk:** terrain horizon masks from LOLA elevation data. Without them, lighting and comms answers are wrong. Go / no-go on 3 Nov (see TASKS.md phase 3).
- **AI is not required** by the CLPS brief (unlike Flame). Don't add AI features unless they make the demo better.

## Odds (estimate, not data)

- Assumed 10–25 teams in Heilbronn across all 14 challenges; local judges likely pick overall winners and up to two global nominees, not per-challenge winners.
- Local win / nomination: ~25–35 % with the prep in TASKS.md done; ~5–10 % without prep. Global award: ~1–3 %. Plan for a local win, treat global as a bonus.
- Biggest levers: validated numbers (horizon + ephemeris) and a tight 3-minute pitch built on concrete pain points of existing tools.

## Event facts

- Venue: OpenSpace Heilbronn, Weipertstraße 8–10. Venue listing: 13–15 Nov, 13:00–19:00. Global hackathon: 14–15 Nov.
- Official challenge page: https://www.spaceappschallenge.org/2026/challenges/clps-lunar-mission-browser/ — summary only on 7 Oct; full resources expected 28 Oct (per a local organiser, unconfirmed).
- The challenge pages render client-side; plain `curl` returns nothing useful — use a real browser.
- Space Apps team maximum: 6. Our team: 3.

## Open questions (update when answered)

- Is code written before the event allowed in the final project? Until confirmed: prepare data, validation scripts and designs; write the judged frontend at the event.
- Submission format for 2026 (past years: 30-second video or up to 7 slides).
- Number of global nominations from Heilbronn; local prizes.
- Friday 13 Nov agenda, daily hours, Wi-Fi, food, overnight access.
- 2026 award categories (2025 categories used for now: Best Use of Data, Best Use of Technology, Galactic Impact).
