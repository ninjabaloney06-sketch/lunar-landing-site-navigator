# AI-use log

One row per task or session. Times are local (CET). Use first names only; remove names of minors before publication. Do not record secrets, tokens, account emails or personal data. See [the template](ai-use-log-template.md).

| Time | Tool + account owner | Run by | What it did (task / files) | Output used where | Checked by | Notes (errors caught, things rejected) |
|---|---|---|---|---|---|---|
| Sat 11:09 | Codex (account owner unconfirmed) | Isaac | Added the AI-use logging rule | AGENTS.md | none | Account owner and human review to be confirmed. |
| Sat 10:04–11:11 | Codex (account owner unconfirmed) | Isaac | Spec interview; wrote the spec review draft; transcribed kickoff recordings with 4-bit Whisper | docs/event/spec.md | none | Transcript had a repetition loop and gaps; replaced by the Claude Code re-run below. |
| Sat 11:15–11:30 | Claude Code (account owner unconfirmed) | Isaac | Reviewed the Codex session; re-transcribed both kickoff recordings with full-precision Whisper large-v3-turbo; added judging/admin facts to the spec | docs/event/spec.md, TASKS.md | none | Corrected the spec's claim that recordings gave no judging-format information. |

| Sat 11:19 | Codex (account owner unconfirmed) | ninja | Deleted 9 merged remote and 6 merged local branches; moved PDF generators to scripts/tools/ and updated paths and layout guide | Git branches, scripts/tools/, README.md, AGENTS.md, related documentation | none | Verified ancestry against fetched main, merged PRs, Python syntax, output roots and references. First remote deletion attempt included the symbolic origin alias and failed atomically; corrected and completed. |

## Summary for the project page (fill in Sun ~12:30)

- Tools used:
- What AI wrote (code, text, data scripts):
- What humans did themselves (decisions, validation, design, pitch):
- How AI output was checked:
- Known limits / where AI output was wrong and corrected:
