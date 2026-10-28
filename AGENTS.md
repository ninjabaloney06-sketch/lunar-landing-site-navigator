# Instructions for AI agents

Read before doing anything in this repo. Applies to Claude Code, Codex, ZCode and any other agent, whether it runs in a sandbox or on one of Isaac's computers.

## Context

Team plan for NASA Space Apps 2026, challenge **Lunar Landing Site Navigator**, local event OpenSpace Heilbronn, 14–15 Nov 2026. Team of 4: S (science lead: physics, math, validation), Q (code checks: tests, script review, security), D (frontend and design), I (Isaac: product, integration, data scripts via agents, pitch); roles proposal in `docs/decisions.md`. Background and decisions: [docs/decisions.md](docs/decisions.md). Repo is **private**; never make it public.

28 Oct planning review is complete against the current challenge page and Sarah's 12 Oct email, as ninja instructed. Do not reopen it merely because Resources says "coming soon". Basic site/date comparison is required even when optional views are cut; implement and verify UX-01–05 from `docs/existing-tools.md` during the event, per TASKS.md phases 4–5. No implementation checks have passed yet.

## Two kinds of agent

| Kind | Runs where | Can do | Cannot do |
|---|---|---|---|
| **Repo agent** | Cloud sandbox or a terminal with only this repo checked out | Read/write code and docs in the repo, run scripts and tests, commit and push | Reach Isaac's machines, browse as a user, log in anywhere, move files between computers |
| **Device agent** | On one of Isaac's computers (data computer or a laptop), with computer use: browser, file manager, apps | Everything a repo agent can, plus: use websites that need a real browser, download to that machine, copy files between folders / machines / USB stick, create accounts, fill in forms, draft and send messages | Anything on a teammate's account or machine; anything without the approvals below |

Tasks in [TASKS.md](TASKS.md) that need a device agent are tagged `device`. A repo agent that reaches a `device` task does the repo-only part (scripts, checklists, exact commands and URLs), writes `→ needs device agent: ...` in the task line, and stops.

A device agent states which machine it is on (`data computer`, `Isaac's laptop`, …) at the start of its work and in its BUILD_LOG line.

## Picking a task

1. Open [TASKS.md](TASKS.md). Take the first unchecked task in the earliest phase whose marker and tag allow you to act.
2. `[AI]` — do it fully.
3. `[AI+H]` — do the AI part, then stop and hand over. Write what the human must check or decide in the task line (`→ needs S: ...`) and in your final message. Do not tick the box.
4. `[H]` — never do it. You may prepare material for it (draft email, checklist, lookup of train times) if asked.
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
| `data/` | Small derived outputs (site list, horizon profiles JSON). Large raw data (elevation tiles, kernels) stays out of git, on Isaac's data computer; record URL, version, size, checksum and path on the data computer in `data/SOURCES.md` |
| `docs/` | Primer, validation tables (`docs/validation.md`), decisions, PDF |

## Actions that need Isaac's explicit approval

**Ask Isaac in chat before each of these, and wait for a yes for that specific action.** Approval for one action does not cover the next.

| Action | Ask with | Default |
|---|---|---|
| Downloading any file (SPICE kernels, LOLA tiles, PDFs, datasets, packages beyond what the task strictly needs) | what, URL, approx. size, target machine and path | Target is Isaac's **data computer**, not a laptop or sandbox |
| Writing or copying files outside this repo's working tree (other folders, other machines, USB stick) | source, destination, size | — |
| Generating outputs > 10 MB anywhere, including inside the repo | what, size, where | — |
| Creating an account or signing up for a service | service, which email/identity, free tier or not | Only for Isaac, with Isaac's email. Never for S, Q or D |
| Sending anything outside the team (email to organisers, form submissions, posts, invites) | full text / form content, recipient | Draft first, send after yes |
| Spending money, booking travel, accepting paid plans | — | Never; humans do this |

If approval is not given, write the exact commands, URLs or draft text into the task line (`→ needs Isaac: approve ...`) and stop.

Small text edits inside the repo (code, Markdown, JSON < 10 MB) and reading public web pages need no approval.

## Accounts and credentials (device agents)

- Stop and hand over to Isaac at 2FA, CAPTCHA, ID checks, payment details and legal terms that bind a person (e.g. Space Apps participation terms).
- Passwords, tokens and recovery codes go into Isaac's password manager, never into the repo, BUILD_LOG, chat or a plain-text file.
- Each teammate registers and logs in with their own account. A device agent on Isaac's computer acts only as Isaac.
- Record which accounts exist (service, purpose, owner, no credentials) in [NEEDS.md](NEEDS.md).

## Hard rules

- Every coordinate, number and claim about NASA data needs a source link. No source → don't write it.
- Physics and coordinate results are not done until S has validated them (`[AI+H]` **S** tasks in phases 1 and 4–5).
- Nothing of the project itself is built before Sat 14 Nov 2026, 09:00 (participant FAQ, Team Formation Guide, organiser reply of 12 Oct). Before then only general preparation: reading up, learning NASA datasets and existing tools, collecting sources, downloading raw public data, logistics. No project scripts, processed or precomputed project data, app designs or project skeleton before the event. Reasoning: `docs/decisions.md`.
- Submission constraints from the official terms that apply to anything agents produce: no photos, voices or recognizable names of anyone under 18 in the demo or submission; cite every source and document the license of every material (NASA can reject or strip awards for missing citations); the submission must describe how AI/SI tools were used. Original content is open source by default (Apache 2.0 if unspecified).
- No secrets, API keys or personal data in the repo.
- Keep it simple: static JSON + static frontend. No database, no backend (see NEEDS.md).

## Regenerating the PDF

`python3 scripts/make_pdf.py` writes `docs/NASA-Heilbronn-CLPS.pdf` (needs `reportlab`). Edit the script, not the PDF.
