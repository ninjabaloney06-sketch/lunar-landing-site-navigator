# Visual sweep task (add-on to ORCHESTRATOR-PROMPT.md)

Written 2026-11-15 by Claude Code on ninja's request. For the orchestrator (Fable 5.2) that is running
`ORCHESTRATOR-PROMPT.md`. To use: tell it "Read VISUAL-SWEEP-TASK.md and add it to the run."

---

## What to do

Spawn one more agent now, `sweep-visual` (`model: "opus"`, `run_in_background: true`, own worktree, a
free Playwright port from 5190–5199 via `PW_PORT`). If wave 0 has not finished yet, it counts as a wave-0
agent. If wave 0 is already merged, run it right away against the merged `main`. Do not hold up wave 1 for
it: findings that arrive while wave 1 is running go into the briefs of wave 2 and 3 agents.

The code sweep agents only read code. This agent looks at the app: what a judge, teacher or mission planner
actually sees.

## Machine

The run is on a laptop with an NVIDIA RTX 5060. Always run Playwright with **`PW_GPU=1`** (real GPU
rendering, see `app/playwright.config.ts` and README). Screenshots from the software renderer
(SwiftShader) do not show what users see and are too slow for the 3D scene. Use relative paths and
cross-platform commands: the main prompt's macOS-only commands (`caffeinate`, `~/...`) do not
apply on this laptop.

## Brief for `sweep-visual`

1. Read the taste rules below, then `ORCHESTRATOR-PROMPT.md` ("Target user" section and tasks U1–U19), so
   you know what waves 1–3 will change anyway.
2. Write a Playwright script (in your worktree, e.g. `app/e2e/visual-sweep.spec.ts`; commit it, it is
   reusable for the final review) that opens the built app (`npm run build` + `vite preview`, or the dev
   server) and screenshots every screen and state at **1440×900, 1280×720 and 375×812**:
   - globe view; site view; eye level at 3 different sites (wait until terrain has loaded); during a
     simulation (playing and paused)
   - the Mission menu open (closed list, site field focused, ground stations), with 1 and with 5 saved
     missions; a site with the longest name in `sites.json`
   - the settings / details drawer at the top and scrolled to every section
   - the Flight plan tab: before calculating, during, result with details expanded and collapsed
   - POI layer on; a POI card open near each screen edge (top, bottom, left, right); the search panel with
     results and with no results
   - sites table and compare view; the docs view; every empty state, error message and loading state you
     can trigger
   Save them under `app/test-results/visual-baseline/<viewport>/<screen>.png` (git-ignored; also copy
   the set to the orchestrator's report location it names).
3. Look at **every** screenshot yourself (read the image files). For each defect write one line:
   `screen — viewport — defect — severity (high = demo-visible / blocks use, medium, low) — owning file`.
   Look for: overlapping or clipped text; a card or panel covering the thing it describes (pins, the
   landing site); misaligned buttons, uneven spacing, inconsistent sizes of the same control; text
   unreadable over the bright Moon surface or dark space (contrast); layout broken or scrolling sideways at
   375 px; controls too small to tap at 375 px (< 44 px); more than ~3 clickable things competing on the
   main screen; the same number shown in several places; labels far from what they label; jumps or
   flashes between states; anything from the slop list below.
4. **Fix nothing.** Other agents own every file. Return the list sorted by severity, ≤ 80 lines, plus the
   path of the screenshot set. Then `touch .agent-done`.

## What the orchestrator does with the result

- Each defect goes into the brief of the wave 1–3 agent that owns the file (Orchestration tables in
  `ORCHESTRATOR-PROMPT.md`). If that agent has already finished, give the high-severity ones to the next
  agent on that file, or to the wave-4 fix pass.
- `final-review` (wave 4) reruns `visual-sweep.spec.ts`, compares against the baseline, and confirms every
  high-severity defect is gone.
- One BUILD_LOG line and one AI-use row for `sweep-visual`.

## Taste rules (paste into the brief of every UI agent in waves 1–3 and of `sweep-visual`)

These are ninja's taste rules (from his taste books, `Ninja-2/wiki/system/taste/taste-ui-web.md` and
`taste-product-ux.md`, copied here because that folder is not on this laptop). They define what he counts
as AI slop.

**General**
- Slop is anything too perfect, a blatant lie, or something that makes no sense. No invented numbers,
  placeholder people, fake logos or testimonials. A rough true thing beats a polished fake one.
- No emojis anywhere in the product. Icons: Ionicons only.
- Minimal, never crowded (anti-reference: chatgpt.com; reference: claude.ai, apple.com). Never
  overcomplicated or unclear.
- Light is the default for reading surfaces; dark is fine for cinematic scenes such as space.

**Slop tells — avoid; two or more together = slop**
- Purple→blue gradients, gradient headlines, Inter for everything.
- Frosted-glass pills and cards with nothing behind them worth blurring.
- Every control a rounded pill with icon + label; a sparkles icon on "smart" actions; one saturated blue
  primary button everywhere.
- ALL-CAPS letter-spaced micro-labels everywhere; numbered section tags.
- Equal 3-up icon cards; a dashboard card floating over a hero.
- The same number shown in several places; legends, status dots and chips that repeat what the picture
  already shows.

**Do instead (ninja's direction for this very app, 13 Nov 2026, after rejecting the first mockup as "way too
ai-slop like" with "too many buttons/informations on the main screen")**
- One answer per screen: the result in one plain sentence, the visual carries the rest.
- Fewest controls that do the job: main screen ≤ 3 clickable things; the rest by direct manipulation
  (drag, scroll, keys) or one drawer. Text links over pill buttons.
- Labels sit on the thing they describe (at the Sun, at the landing site), not in a separate panel.
- Colour only for meaning (Sun warm, Earth blue, used the same in text and charts); accent ≤ 5 % of the
  screen.
- Type with character used sparingly (a serif for the one sentence, mono for numbers), sentence case.
- A marker touches the exact point it means, not a ring floating near it.
- Density: airy where content breathes, dense where data lives (tables).
- Settings only where a choice actually matters.
- Every repeated action gets a small, specific reaction (the number updates, a short settle), never silence
  and never fireworks. Smooth feedback on tap and while waiting (no jumps).
- Motion: animate `transform` and `opacity` for DOM elements, keep 60 fps, honour
  `prefers-reduced-motion`. A janky effect is worse than none.
- Charts that answer a drag (scrub to a value) where it fits.
