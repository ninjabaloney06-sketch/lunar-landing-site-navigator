# Bene — frontend and design (D)

You decide how it looks. The judges see the app before anything else, so your taste carries the demo. Isaac assigns new tasks here during the event; tick them off when done.

**Rule before the event:** only learning and setup. No designs or code of our app before Sat 14 Nov, 09:00 (see [AGENTS.md](../../AGENTS.md)).

## Before the event (now → Fri 13 Nov)

You don't need to learn React or a chart library: the agents write the code, you direct them. What the agents can't replace is your eye, your judgement and your feedback. Prepare those.

- [ ] **Understand what we show (~1 h)** — read [docs/primer.md](../primer.md). You must be able to explain in your own words what a polar sky plot shows (azimuth around the circle, elevation from the edge to the centre, horizon outline, Sun and Earth tracks) and what "lit / Earth visible / both" means on a timeline. **Done when:** you can sketch a sky plot on paper and explain every element to someone who has never heard of it. If you can't explain it, the judges won't get it either.
- [ ] **Reference board (~1.5 h)** — go through [docs/inspiration.md](../inspiration.md) and look further (NASA/ESA mission tools, data-viz galleries, apps you like). Save screenshots into a folder on your laptop (outside this repo). Pick your **top 3** and write for each one sentence on what exactly is good (layout, colour, how the data reads at a glance). General references only, nothing designed for our app. **Done when:** 3 picks with one sentence each, ready to show an agent on Saturday.
- [ ] **Data-viz rules (~1 h)** — learn the basics that make a chart readable: one clear message per view, colour only where it means something, readable labels and units, colour-blind-safe palettes, what to cut. Good free sources: the [Datawrapper blog](https://www.datawrapper.de/blog) (colour and chart guides) and [Material Design data visualization](https://m2.material.io/design/communication/data-visualization.html). **Done when:** you have a short personal checklist (5–8 rules) you will apply to every screen at the event.
- [ ] **Practise directing an agent on a toy UI (~1.5 h)** — in a throwaway folder (not this repo, nothing about our project): let Claude Code build a small generic page, e.g. "a weather dashboard with a chart". Then improve it only through feedback: look at it in the browser, say precisely what is wrong ("labels too small, the second line is unreadable on the dark background, move the legend under the chart") and let the agent fix it. Do at least 5 rounds. **Done when:** the page looks clearly better than round 1, and you have noticed which kind of feedback works (precise and visual) and which doesn't ("make it nicer").
- [ ] **Agents in parallel (~0.5 h)** — Isaac shows the team how two agents work in parallel without touching the same files. You need to know it so you don't break someone else's work.
- [ ] **Demo story (~0.5 h)** — you drive the live demo on Sunday. Think about how a 60-second demo of a tool like ours should flow (question → click → answer). Watch 2–3 past Space Apps winner videos for how they show their app. **Done when:** you can describe a good 60-second demo flow in 3 steps.
- [ ] **Laptop offline-ready** — Claude Code logged in, browser, Node 20+ so you can run the app locally ([docs/offline-setup.md](../offline-setup.md), your OS section).
- [ ] **Signed parental authorisation** naming Dagny Locher, by Sat 7 Nov.
- [ ] **Pack** — laptop, charger, sleeping bag, mat, ID, the signed authorisation.

## At the event

| When | Task |
|---|---|
| Sat 10:30 | Spec interview with the team: the four screens (site picker, polar sky plot, daily timeline, comparison). You decide the look. |
| Sat 12:30 → | **App shell** loading the sample JSON + site picker. Show the agent your top 3 references; review in the browser and give precise feedback until it looks right. Every screen goes through your data-viz checklist. |
| Sat → 20:00 | **Polar sky plot:** horizon outline, Sun and Earth tracks. **Checkpoint 20:00: sky plot with real ephemeris data.** |
| Sun morning | **Daily timeline view** (lit / Earth visible / both). |
| Sun morning | **Comparison view** of 2–3 sites with score — only if the 20:00 and 22:00 checkpoints passed. |
| Sun before 12:00 | **Deploy** (Vercel / Cloudflare Pages) and test the URL on a phone. |
| Sun 16:00 | Pitch together; you drive the live demo. |

## Assigned during the event

<!-- Isaac adds tasks here: - [ ] HH:MM — task -->
