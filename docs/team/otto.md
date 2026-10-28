# Otto — code review, tests, security (Q)

You read the code line by line. Nothing an agent writes goes in without your review. Isaac assigns new tasks here during the event; tick them off when done.

**Rule before the event:** only learning and setup. No project code before Sat 14 Nov, 09:00 (see [AGENTS.md](../../AGENTS.md)).

## Before the event (now → Fri 13 Nov)

- [ ] **Learn pytest (~2 h)** — [pytest Get Started](https://docs.pytest.org/en/stable/getting-started.html), then the pages on fixtures and `parametrize`. In a scratch folder outside this repo: a toy module with plain asserts, one fixture, one parametrized test; break one test on purpose and read the failure diff. **Done when:** `pytest -v` is green with at least 5 tests, one parametrized over at least 3 cases, and you can say in one sentence what a fixture is good for.
- [ ] **Agents in parallel (~0.5–1 h)** — [worktrees](https://code.claude.com/docs/en/common-workflows), [subagents](https://code.claude.com/docs/en/sub-agents). In a throwaway toy repo: two worktrees, two agent sessions, one small edit each, merge both. **Done when:** both branches merged without conflict and you can say why two agents must never edit the same files at the same time.
- [ ] **Your two Claude Max 20x plans** — make sure both are active for 14–15 Nov and that you can log in on the event laptops. Agree with Isaac which agent runs on which account.
- [ ] **Review checklist** — write yourself a short list of what you check in every agent-written script (inputs validated, units and angles in degrees vs. radians, no hard-coded paths, no secrets, tests cover the edge cases). You use it all weekend.
- [ ] **Laptop offline-ready** — follow your OS section in [docs/offline-setup.md](../offline-setup.md) (Python, pytest, Node, git, Claude Code logged in). Do the Wi-Fi-off self-test.
- [ ] **Signed parental authorisation** naming Dagny Locher, by Sat 7 Nov.
- [ ] **Pack** — laptop, charger, power strip, sleeping bag, mat, ID, the signed authorisation.

## At the event

| When | Task |
|---|---|
| Sat 10:30 | Spec interview with the team. Check that the JSON format between scripts and frontend is testable. |
| Sat 12:30 → 16:00 | **Unit tests + UX-01:** geometry expectations from Leo; lunar observer/Sun/Earth metadata and az/el output checks. Reject Ohio/geocentre or RA/Dec-only reference results before validation. Review tests and ephemeris script; S signs reference setup. |
| Sat afternoon/evening | **Review every agent-written data script** (`horizon.py`, `sites.json` builder) before it is merged. |
| Sun morning | Review `windows.py` and the summaries export. |
| Sun before 12:00 | With I + D run [UX-01–05](../existing-tools.md#product-follow-through--28-oct-2026), including invalid input, failed data load, map unavailable and mobile completion; record failures/fixes in docs/validation.md. Core failures block freeze. **Security check:** no secrets, keys or personal data; dependencies pinned. |
| Sun 16:00 | Pitch together; you explain how we know the code is correct (tests, validation). |

## Assigned during the event

<!-- Isaac adds tasks here: - [ ] HH:MM — task -->
