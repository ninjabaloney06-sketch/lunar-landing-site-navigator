# Bene — frontend and design (D)

You decide how it looks. The judges see the app before anything else, so your taste carries the demo. Isaac assigns new tasks here during the event; tick them off when done.

**Rule before the event:** only learning and setup. No designs or code of our app before Sat 14 Nov, 09:00 (see [AGENTS.md](../../AGENTS.md)).

## Before the event (now → Fri 13 Nov)

- [ ] **Learn Vite + React (~2.5 h)** — [Vite guide](https://vite.dev/guide/) (build its counter app) and [React Learn](https://react.dev/learn) (state, rendering lists, conditional rendering). In a scratch folder outside this repo: `npm create vite@latest` with the React template, then the React Learn examples with your own small components. **Done when:** the dev server hot-reloads your change, `npm run build` succeeds, and you can render a list from an array of objects without looking it up.
- [ ] **Learn polar charts with Plotly (~2 h)** — [Plotly getting started](https://plotly.com/javascript/getting-started/) and [polar chart examples](https://plotly.com/javascript/polar-chart/). Do the examples first; then plot two fake tracks with dummy numbers: angle = azimuth 0–360°, radius = elevation 0–90°, zenith in the centre if you can invert the radius. **Done when:** a polar chart shows two tracks on a labelled 0–360° / 0–90° disc.
- [ ] **Look at the inspiration list** — [docs/inspiration.md](../inspiration.md): sky plots, lighting timelines, mission tools. Note the 3 you like most and why (looks only, nothing built). At the event we point the agents at these.
- [ ] **Agents in parallel (~0.5–1 h)** — [worktrees](https://code.claude.com/docs/en/common-workflows), [subagents](https://code.claude.com/docs/en/sub-agents). In a throwaway toy repo: two worktrees, two agent sessions, one small edit each, merge both. Isaac shows you how.
- [ ] **Laptop offline-ready** — follow your OS section in [docs/offline-setup.md](../offline-setup.md) (Node 20+, npm packages, git, Claude Code logged in). Do the Wi-Fi-off self-test.
- [ ] **Signed parental authorisation** naming Dagny Locher, by Sat 7 Nov.
- [ ] **Pack** — laptop, charger, sleeping bag, mat, ID, the signed authorisation.

## At the event

| When | Task |
|---|---|
| Sat 10:30 | Spec interview with the team: the four screens (site picker, polar sky plot, daily timeline, comparison). You decide the look. |
| Sat 12:30 → | **App shell** loading the sample JSON + site picker. Point the agent at your picks from `docs/inspiration.md`; review and run what it builds. |
| Sat → 20:00 | **Polar sky plot:** horizon outline, Sun and Earth tracks. **Checkpoint 20:00: sky plot with real ephemeris data.** |
| Sun morning | **Daily timeline view** (lit / Earth visible / both). |
| Sun morning | **Comparison view** of 2–3 sites with score — only if the 20:00 and 22:00 checkpoints passed. |
| Sun before 12:00 | **Deploy** (Vercel / Cloudflare Pages) and test the URL on a phone. |
| Sun 16:00 | Pitch together; you drive the live demo. |

## Assigned during the event

<!-- Isaac adds tasks here: - [ ] HH:MM — task -->
