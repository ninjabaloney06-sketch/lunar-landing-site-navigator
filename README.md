# Lunar Landing Site Navigator — NASA Space Apps 2026, Heilbronn

Team plan for the [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) challenge at NASA Space Apps 2026 (OpenSpace Heilbronn, 14–15 Nov 2026).

> Build an intuitive tool that lets mission planners, educators and the public compare lunar south-pole landing sites and dates, visualizing Sun and Earth positions relative to the local horizon to assess solar power potential and direct-to-Earth communication windows.

## Start here

| Read | Why |
|---|---|
| [docs/event-plan.md](docs/event-plan.md) | The weekend hour by hour: checkpoints, build order, cut list |
| [TASKS.md](TASKS.md) | Every task until submission, marked by who does it |
| `docs/team/<your name>.md` | Your own checklist ([Isaac](docs/team/isaac.md), [Leo](docs/team/leo.md), [Otto](docs/team/otto.md), [Bene](docs/team/bene.md)) |
| [WHERE-WHEN.md](WHERE-WHEN.md) | Where to be on 14–15 Nov: train, venue |

Everything else is reference: physics [primer](docs/primer.md), [site sources](docs/sources.md), [data guide](docs/data-guide.md), [existing tools](docs/existing-tools.md), [inspiration](docs/inspiration.md), [past winners](docs/past-winners.md), [laptop setup](docs/offline-setup.md), [learning](docs/learning.md), [NEEDS.md](NEEDS.md), [decisions and reasons](docs/decisions.md), [one-page plan PDF](docs/NASA-Heilbronn-CLPS.pdf). Finished audits and checklists are in [docs/archive/](docs/archive/). Agents read [AGENTS.md](AGENTS.md) and log in [BUILD_LOG.md](BUILD_LOG.md).

## Challenge in short (checked 11 Nov 2026)

- **Required:** Sun and Earth positions relative to the horizon at a selected landing site on a chosen date.
- **Optional ("you may consider"):** curated site list and custom coordinates; side-by-side comparison; dates across lunar days and seasons; time left before sunset/Earthset; prominent solar elevation, sunlight duration, Earth visibility windows; 2D map or 3D view; animation or timeline; usable by planners, educators and the public.
- **User story:** schedules slip, so engineers must quickly check other sites nearby or other dates at the same site. Quickmap, Moon Trek and JPL Horizons are too slow for that.
- Resources tab opens Fri 13 Nov. Full comparison against our plan: [docs/decisions.md](docs/decisions.md#full-challenge-statement-published-10-nov-2026).

## Rule

Nothing of the project is built before **Sat 14 Nov, 09:00** (official FAQ and Team Formation Guide). Local submission target Sun 15:00, deadline 15:45.

## Task markers

| Marker | Meaning |
|---|---|
| `[AI]` | An AI agent does it alone; a human skims the result. |
| `[AI+H]` | AI does the bulk; a human checks, decides or approves before it counts. |
| `[H]` | Human only. |
| `device` | Needs a device agent on Isaac's computer; each download, copy, account or message needs Isaac's approval ([AGENTS.md](AGENTS.md)). |
