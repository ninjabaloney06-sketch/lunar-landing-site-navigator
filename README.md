# Lunar Landing Site Navigator — NASA Space Apps 2026, Heilbronn

Team plan for the [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) challenge at NASA Space Apps 2026 (OpenSpace Heilbronn, 14–15 Nov 2026).

> Build an intuitive tool that lets mission planners, educators and the public compare lunar south-pole landing sites and dates, visualizing Sun and Earth positions relative to the local horizon to assess solar power potential and direct-to-Earth communication windows.

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

Code for the final project is written during the hackathon weekend — the organiser confirmed on 12 Oct 2026 that the project must arise during the event; a finished solution brought along and slightly adapted on site does not count. The formal wording is stricter (participant FAQ): "Teams are not allowed to begin working on the challenges prior to the hackathon." So before the event only general preparation: research, learning NASA data and tools, raw data downloads, logistics (TASKS.md phases 1–2). Scripts, project data, designs and app code are built at the event (phases 3–6); local submission deadline Sun 15:45. The organiser explicitly encourages reading up on the physics, NASA datasets and tools like JPL Horizons beforehand. Official challenge statements release 28 Oct; submission format and award categories come with the participant guides on 13 Nov. Rules summary: [docs/decisions.md](docs/decisions.md).
