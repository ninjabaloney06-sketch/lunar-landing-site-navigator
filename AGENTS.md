# Instructions for AI agents

Read before doing anything in this repo. Applies to Claude Code, Codex, ZCode and any other agent.

## Context

Team plan for NASA Space Apps 2026, challenge **CLPS Lunar Mission Browser**, local event OpenSpace Heilbronn, 14–15 Nov 2026. Team of 3: S (science), D (data/web), I (Isaac: product, UI, integration, pitch). Background and decisions: [docs/decisions.md](docs/decisions.md). Repo is **private**; never make it public.

## Picking a task

1. Open [TASKS.md](TASKS.md). Take the first unchecked task in the earliest phase whose marker allows you to act.
2. `[AI]` — do it fully.
3. `[AI+H]` — do the AI part, then stop and hand over. Write what the human must check or decide in the task line (`→ needs S: ...`) and in your final message. Do not tick the box.
4. `[H]` — never do it. You may prepare material for it (draft email, checklist) if asked.
5. One task per session unless told otherwise. Work on one file set at a time; two agents must not edit the same file in parallel.

## Finishing a task

- Tick the box in TASKS.md only for `[AI]` tasks that are fully done and verified (tests pass, output exists).
- Add one line to [BUILD_LOG.md](BUILD_LOG.md). No line = not done.
- Commit with a clear message; push to `main`. Commit email must be the account's noreply address (check `git config user.email`).

## Where things go

| Path | Content |
|---|---|
| `scripts/` | Python computation and tooling (`ephemeris.py`, `horizon.py`, `windows.py`, `make_pdf.py`) |
| `tests/` | `pytest` tests for scripts |
| `data/` | Small derived outputs (site list, horizon profiles JSON). Large raw data (elevation tiles, kernels) stays out of git; record URL, version and checksum in `data/SOURCES.md` |
| `docs/` | Primer, validation tables (`docs/validation.md`), decisions, PDF |

## Hard rules

- Every coordinate, number and claim about NASA data needs a source link. No source → don't write it.
- Physics and coordinate results are not done until S has validated them (`[AI+H]` tasks in phases 2–4).
- Final project code (the frontend shown to judges) is written during the event unless the official rules allow pre-event code. Check `docs/decisions.md` for the current status of that rule before building UI.
- No secrets, API keys or personal data in the repo.
- Keep it simple: static JSON + static frontend. No database, no backend (see NEEDS.md).

## Regenerating the PDF

`python3 scripts/make_pdf.py` writes `docs/NASA-Heilbronn-CLPS.pdf` (needs `reportlab`). Edit the script, not the PDF.
