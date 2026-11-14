# Lunar Landing Site Navigator — NASA Space Apps 2026, Heilbronn

Team plan for the [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) challenge at NASA Space Apps 2026 (OpenSpace Heilbronn, 14–15 Nov 2026).

> “Your challenge is to create an intuitive tool or application that lets mission planners, educators, and the public compare landing sites and dates quickly, visualizing Sun and Earth positions relative to the horizon to assess power generation potential and direct-to-Earth communication windows.” — official challenge statement, quoted 14 Nov 2026

## Start here

| Read | Why |
|---|---|
| [docs/event/build-plan.md](docs/event/build-plan.md) | What we build and how every part works: architecture, data, horizon method, UI, validation, build order |
| [docs/event/agent-briefs.md](docs/event/agent-briefs.md) | Copy-paste prompts for Saturday's agents: shared preamble + step 0, tracks A, B, C1 (3D), C2 (screen), C3 (mission layer, site ranking) |
| [docs/event/event-plan.md](docs/event/event-plan.md) | The weekend hour by hour: checkpoints, cut list |
| [TASKS.md](TASKS.md) | Every task until submission, marked by who does it |
| [docs/event/team.md](docs/event/team.md) | Your own checklist (one section per person) |
| [docs/event/where-when.md](docs/event/where-when.md) | Where to be on 14–15 Nov: train, venue |

Everything else is reference: physics [primer](docs/reference/primer.md), [site sources](docs/reference/sources.md), [data guide](docs/reference/data-guide.md), [existing tools](docs/reference/existing-tools.md), [inspiration](docs/reference/inspiration.md), [past winners](docs/reference/past-winners.md), [setup and needs](docs/reference/setup.md), [learning](docs/reference/learning.md), [decisions and reasons](docs/reference/decisions.md), [one-page plan PDF](docs/event/NASA-Heilbronn-CLPS.pdf). Finished audits and checklists are in [docs/archive/](docs/archive). Code goes only in `scripts/` and `app/`. Agents read [AGENTS.md](AGENTS.md) and log in [BUILD_LOG.md](BUILD_LOG.md).

## Repository layout

| Path | Contents |
|---|---|
| `app/` | React frontend, frontend tests, and build/deploy configuration |
| `app/public/data/` | Small JSON data consumed by the app |
| `scripts/` | Python data pipeline and its dependency lock file |
| `scripts/tests/` | Python contract and pipeline tests |
| `scripts/tools/` | Plan and pitch PDF generators |
| `docs/event/` | Active weekend plans, spec, submission material, and AI-use log |
| `docs/reference/` | Sources, science background, setup, and decisions |
| `docs/archive/` | Completed audits and checklists; retained for reference |
| `private/` | Local private material; ignored by git |

Keep raw datasets outside the repository and register them in `docs/reference/data-sources.md`. Generated dependencies, build output, and caches are ignored by git.

PDF commands, run from the repository root (require `reportlab`):

```sh
python3 scripts/tools/make_pdf.py
python3 scripts/tools/make_pitch_pdf.py
```

## Challenge in short (checked 11 Nov, re-checked 13 Nov 2026)

- **Required:** Sun and Earth positions relative to the horizon at a selected landing site on a chosen date.
- **Optional ("you may consider"):** curated site list and custom coordinates; side-by-side comparison; dates across lunar days and seasons; time left before sunset/Earthset; prominent solar elevation, sunlight duration, Earth visibility windows; 2D map or 3D view; animation or timeline; usable by planners, educators and the public.
- **User story:** schedules slip, so engineers must quickly check other sites nearby or other dates at the same site. Quickmap, Moon Trek and JPL Horizons are too slow for that.
- Resources tab (live 13 Nov): Quickmap, Moon Trek, JPL Horizons, CSA Moon Exploration portal. No datasets beyond what we already hold.
- **13 Nov fact check and plan holes:** [docs/event/plan-review-13nov.md](docs/event/plan-review-13nov.md) — 2024 Artemis region list, light-time size, 300 km rays, landing window finder, international sites, official schedule.

## Rule

No code before **Sat 14 Nov, 09:00** (official FAQ and Team Formation Guide). Exceptions decided by ninja: the written build plan (11 Nov) and the pitch outline + backup deck (13 Nov); see AGENTS.md and the open disclosure task in TASKS.md phase 6. Local submission target Sun 15:00, deadline 15:45.

## Task markers

| Marker | Meaning |
|---|---|
| `[AI]` | An AI agent does it alone; a human skims the result. |
| `[AI+H]` | AI does the bulk; a human checks, decides or approves before it counts. |
| `[H]` | Human only. |
| `device` | Needs a device agent on Isaac's computer; each download, copy, account or message needs Isaac's approval ([AGENTS.md](AGENTS.md)). |
