# AI-use log template (start Sat 14 Nov, 08:30)

Empty template, prepared 31 Oct. It is process paperwork, not project work. During the event, copy it to `docs/event/ai-use-log.md` and add a row whenever an AI ("SI") tool produces or changes something that ends up in the project.

Why: the participant FAQ requires the submission to describe how SI tools were used ([docs/reference/decisions.md](../reference/decisions.md), "Official rules read", 16 Oct). NASA's media guidelines add that information incorporated into an LLM may not be attributed directly to NASA, and NASA "strongly encourages AI-generated products maintain a marking" ([docs/archive/sources-audit.md](../archive/sources-audit.md), fix 9). Phase 6 builds the project page's AI-use paragraph from this table.

Rules for filling it in:
- One row per task or session, not per prompt. Time is local (CET).
- "Prompt (summary)" is required: what the human asked, quoted or shortened to one sentence. For a subagent or a pasted brief, name the brief (e.g. "Brief C3 part 1" in agent-briefs.md) instead of copying it. Several prompts in one session: the one that defined the task. A prompt that was not recorded is written as "not recorded", never reconstructed. A row without this cell is incomplete.
- "Checked by" names the human who reviewed the output (S for physics and numbers, Q for code). If no one did, write "none".
- No secrets, tokens, account emails or personal data. Use first names only, and none of anyone under 18 if the log will be published (participant terms).

| Time | Tool + account owner | Run by | What it did (task / files) | Output used where | Checked by | Notes (errors caught, things rejected) | Prompt (summary) |
|---|---|---|---|---|---|---|---|
| Sat 08:45 | e.g. Claude Code (Isaac's account) | I | e.g. wrote docs/event/spec.md from the spec interview | docs/event/spec.md | Isaac | | e.g. "Interview me about the spec and write it down" |
| | | | | | | | |

## Summary for the project page (fill in Sun ~12:30)

- Tools used:
- What AI wrote (code, text, data scripts):
- What humans did themselves (decisions, validation, design, pitch):
- How AI output was checked (tests, Horizons validation table in docs/event/validation.md, reviews):
- Known limits / where AI output was wrong and corrected:
