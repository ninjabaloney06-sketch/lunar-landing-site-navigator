# CLPS Lunar Mission Browser — NASA Space Apps 2026, Heilbronn

Team plan for the [CLPS Lunar Mission Browser](https://www.spaceappschallenge.org/2026/challenges/clps-lunar-mission-browser/) challenge at NASA Space Apps 2026 (OpenSpace Heilbronn, 14–15 Nov 2026).

> Build an intuitive tool that lets mission planners, educators and the public compare lunar south-pole landing sites and dates, visualizing Sun and Earth positions relative to the local horizon to assess solar power potential and direct-to-Earth communication windows.

## Files

| File | Content |
|---|---|
| [AGENTS.md](AGENTS.md) | Rules for AI agents (repo agents and device agents) working on tasks |
| [BUILD_LOG.md](BUILD_LOG.md) | What got done, by humans and agents — add your line |
| [docs/decisions.md](docs/decisions.md) | Why CLPS, odds, event facts, open questions |
| [TASKS.md](TASKS.md) | Every task from now until submission, marked by who can do it |
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

Code for the final project is written during the hackathon weekend unless the official rules allow otherwise (check before 13 Nov). Research, data downloads, validation scripts and design happen before.
