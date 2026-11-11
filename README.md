# Lunar Landing Site Navigator — NASA Space Apps 2026, Heilbronn

Team plan for the [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) challenge at NASA Space Apps 2026 (OpenSpace Heilbronn, 14–15 Nov 2026).

> Build an intuitive tool that lets mission planners, educators and the public compare lunar south-pole landing sites and dates, visualizing Sun and Earth positions relative to the local horizon to assess solar power potential and direct-to-Earth communication windows.

## Challenge statement (checked 11 Nov 2026)

Full statement published 10 Nov; unchanged on 11 Nov. Details: [docs/decisions.md](docs/decisions.md#full-challenge-statement-published-10-nov-2026).

- **Only required item:** display the Sun and Earth positions relative to the horizon at a selected landing site on a chosen date. Everything else is "you may consider".
- **Optional objectives:** curated site list (Apollo, CLPS, commercial, other countries) and custom coordinates; side-by-side or sequential comparison; date/time selection across lunar days and seasons; time remaining before sunset/Earthset; solar elevation shown prominently, sunlight duration, Earth visibility windows; 2D maps or 3D views; animations or timelines; usable by planners, educators and the public.
- **User story:** schedules slip, so engineers must quickly check alternative sites in the same region or alternative dates at the same site. Quickmap, Moon Trek and JPL Horizons are named as too hard for rapid comparison.
- **Considerations:** Horizons or pre-computed ephemeris, LOLA topography for terrain horizons, no atmospheric refraction, libration, steep south-pole terrain.
- **Format:** open (web app, mobile app, visualization, game, other). Tags: Advanced, Intermediate · Human Exploration, Moon, Software, Space Exploration.
- **Resources tab:** "Resources will be available on Friday, November 13." Participant Guides still list no Submission or Judging guide.

## Files

| File | Content |
|---|---|
| [AGENTS.md](AGENTS.md) | Rules for AI agents (repo agents and device agents) working on tasks |
| [BUILD_LOG.md](BUILD_LOG.md) | What got done, by humans and agents — add your line |
| [docs/decisions.md](docs/decisions.md) | Why CLPS, odds, event facts, open questions |
| [TASKS.md](TASKS.md) | Every task from now until submission, marked by who can do it |
| [WHERE-WHEN.md](WHERE-WHEN.md) | Where the team and the Betreuerin have to be on 14–15 Nov, hour by hour: train, venue, hostel |
| [NEEDS.md](NEEDS.md) | Accounts, tools, libraries and data we need |
| [docs/NASA-Heilbronn-CLPS.pdf](docs/NASA-Heilbronn-CLPS.pdf) | One-page plan (regenerate: `python3 scripts/make_pdf.py`) |

## Task markers

| Marker | Meaning |
|---|---|
| `[AI]` | An AI agent can do this alone. A human only skims the result. |
| `[AI+H]` | AI does the bulk; a human must check, decide or approve before it counts. |
| `[H]` | Human only: decisions, physical presence, judgement, pitching, anything on a teammate's own account, payments. |
| `device` | Needs a **device agent** (runs on Isaac's computer with browser and file access). Without the tag, a repo-only agent is enough. See [AGENTS.md](AGENTS.md). |

Device agents can download, copy files, create accounts and send messages, but only after Isaac approves each action (see [AGENTS.md](AGENTS.md#actions-that-need-isaacs-explicit-approval)).

## Rule

Code for the final project is written during the hackathon weekend — Sarah confirmed on 12 Oct 2026 that the project must arise during the event; a finished solution brought along and slightly adapted on site does not count. Before the event: research, learning NASA data and tools, raw data downloads and logistics (phases 1–2); scripts, processed data, designs and app code are built at the event (phases 3–6). Local submission target: Sun 15:00, deadline 15:45. On 28 Oct ninja specified the current challenge page and Sarah's email as the basis for this comparison; the review is complete and does not wait for another statement. Core site/date comparison stays even when optional map, score or side-by-side views are cut. The five pain points from ninja's timed tools run have [owned checks](docs/existing-tools.md#product-follow-through--28-oct-2026) in TASKS.md and the event plan. Submission-form details are checked separately before the event. Decisions: [docs/decisions.md](docs/decisions.md).
