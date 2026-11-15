# Which site, which dates? How the app ranks landing sites and landing windows

The app ranks in two places, and in neither is there a weighted score. Rows are compared key by key, one after another, so a row's place can be checked by hand from the values shown next to it (comment at the top of `app/src/geometry/rankSites.ts`).

- **Site search** (Search panel): candidate landing sites ordered by nearby points of interest, the slope limit, and sunlight and station coverage over the mission dates. Code: `searchSites()` in `app/src/geometry/poiSearch.ts`, which takes the slope rule from `rankSites()`.
- **Landing-window finder** ("Find better dates", in the drawer and the date menu): landing times ranked by station coverage, then sunlight, over a mission of a set length. Code: `finder()` in `app/src/geometry/index.ts`.

The sunlight and coverage values they rank by are the ones described in [01-sunlight-horizon.md](01-sunlight-horizon.md) and [02-earth-visibility-contact.md](02-earth-visibility-contact.md).

## Equations

### 1. Slope filter

`rankSites()`:

```text
slope state = pass      if slope ≤ 5.0°
              fail      if slope > 5.0°
              unknown   if the slope is missing or not a finite number
```

- `slope` — the site's `slope_deg`: for a prepared site, the DEM slope over a 100 m baseline at the site point, written by `scripts/horizon.py` (`atan(√(((h_E − h_W)/100 m)² + ((h_N − h_S)/100 m)²))`, see [01-sunlight-horizon.md](01-sunlight-horizon.md)); for a custom point, the same rule in the browser on the south-cap rasters (`capHorizon()`)

An unknown slope is never counted as a pass.

### 2. Site search order

`searchSites()`, with the options chosen in the panel (groups of points, radius, whether the slope limit is required, and the "rank by" choice):

```text
d(a, b)        = R · atan2( |â × b̂|, â·b̂ )                 great-circle distance, R = 1737.4 km
nearTotal      = number of points of the selected groups with d ≤ radius (the site's own record excluded)
groupsCovered  = number of selected groups with at least one such point
share          = lit %             ("Light")
               = coverage %        ("Comms")
               = lit % + coverage % ("Both", the default)
rank key       = ( −groupsCovered, −nearTotal, −share )   compared left to right, lower first
```

- `â, b̂` — unit vectors of the two points on the sphere (`siteVector()`)
- `lit %`, `coverage %` — over the mission period, from `summarize()`
- Rows equal on every key share a rank (competition ranking 1, 1, 3) and are listed by site id. The first three ranks are marked best (`BEST_COUNT = 3`; more when tied).
- Order of the whole list: ranked rows; then rows that pass but have no data (`share` null); then, when the slope limit is required, rows that fail or have an unknown slope.

The only sum in the app's ranking is `lit % + coverage %` for "Both". It adds two percentages of time with equal weight; the code calls it "the declared litPct + coveragePct sum".

### 3. Science-goal rules in `rankSites()`

`rankSites()` also holds goal rules: `'light'` orders by lit % (descending) then longest dark spell (ascending); `'water-ice'`, `'cold-trap'` and `'science'` order by the best evidence tier of the site's sourced entries (direct measurement, remote observation, modeled condition, hypothesis, unknown); every goal then breaks ties by coverage % and lit %. In the current app `rankSites()` is called only by the site search, with the goal `'any'` (coverage, then lit %), to apply the slope rule and the finite-number guard. The goal rules are tested but not shown in the app.

### 4. Landing-window finder

`finder()` in `geometry/index.ts`. Candidate landing times every 30 min from the earliest to the latest date; each candidate mission `[landing, landing + mission length)` is scored on 30-minute samples:

```text
lit %        = 100 · (samples lit) / (samples in the mission)
coverage %   = 100 · (samples with any selected station in line of sight) / (samples in the mission)
longest gap  = longest run of samples with no station, h
longest dark = longest run of dark samples, h
qualifies    ⇔ lit % ≥ min_lit  and  coverage % ≥ min_cov  and  longest gap ≤ max_gap  and  longest dark ≤ max_dark
```

Neighbouring qualifying candidates merge into one window. Windows are ranked by the coverage % of their best candidate (descending), then its lit % (descending), then the earlier date. When nothing qualifies, the result names the nearest miss: the candidate that fails the fewest thresholds, then the one with the highest coverage, with the thresholds it fails.

These values come from the samples, not from the refined window edges of `windows()` (comment on `finder()`: "sample-based, not edge-refined"), so they can differ slightly from the percentages shown for the same span elsewhere in the app.

## Inputs and their sources

| Input | Value | Where | Source given in the code |
|---|---|---|---|
| Slope limit | 5.0° (exactly 5.0 passes) | `SLOPE_LIMIT_DEG`, `rankSites.ts` | the code comment calls it a project criterion of the team, "not a sourced safety limit. Passing it alone does not make a site safe to land." |
| Slope at the site | per site, 100 m baseline | `slope_deg` in `app/public/data/horizons/*.json` | LDEM_80S_20MPP_ADJ (PGDA product 90), see [01-sunlight-horizon.md](01-sunlight-horizon.md) |
| Points of interest (positions, groups) | per record | `app/public/data/pois.json`, built from `docs/POIs/*.json` | the research sources cited per record; not individually checked by the science lead (see the README of this section) |
| Default groups | water, cold trap, science | `DEFAULT_GROUPS`, `views/SearchPanel.tsx` | "UI defaults (not sourced values)" |
| Default radius | 20 km (input 1 to 200 km) | `DEFAULT_RADIUS_KM` | UI default: "the reach of the 20 m terrain model around each site that the horizons use" |
| Best marked | top 3 ranks | `BEST_COUNT` | source not recorded in the code |
| Finder thresholds | mission 14 days, lit ≥ 70 %, coverage ≥ 50 %, longest gap ≤ 48 h, longest dark ≤ 72 h | `FINDER_DEFAULTS`, `geometry/index.ts` | "Proposed defaults (spec.md …, 14 Nov); [the science lead] reviews the values. Every value is editable in the UI." No external source |
| Finder steps | candidates every 30 min, samples every 30 min | `CANDIDATE_STEP_MS`, `FINDER_STEP_MIN` | source not recorded in the code |
| Ground stations | the five of `stations.json` | see [02-earth-visibility-contact.md](02-earth-visibility-contact.md) | DSN 810-005 module 301; JAXA station coordinates page |

## Assumptions

- A lexicographic order says which value matters first. It does not trade one value against another, so a site with one more nearby group always ranks above one with better light and coverage. That is the rule as written, not a scientific weighting.
- "Both" treats one percentage point of sunlight and one of station coverage as worth the same. No source is given for that.
- The slope at one point over 100 m stands for the site. The mandatory site assessments (`scripts/assessments.py`, `docs/event/validation.md`) use a stricter rule for the 18 prepared sites (every pixel in a 100 m disk ≤ 5°); the search does not use it.
- Counting points within a radius treats every point as equally important and ignores whether it can be reached over the terrain.
- The finder uses the default thresholds unless the planner changes them. In the date menu (`views/DateMenu.tsx`) only the mission length changes; the other thresholds stay at their defaults.

## ε and how it propagates

The ranking itself is exact: integer counts, comparisons and a sum. Its uncertainty is that of its inputs.

- **Ties and near ties.** Two sites whose `share` differs by less than the uncertainty of lit % and coverage % are ranked in an order the data cannot support. The ranking does not mark near ties; only exact ties share a rank. **Not quantified:** how often that happens.
- **Slope near 5°.** A site whose 100 m slope lies close to 5° can pass or fail on the DEM's height error. **Not quantified** in the code; the reading check in `docs/event/validation.md` found the 5 m and 20 m DEMs differ at one site by +0.98° in point slope (Shackleton Rim Site04, a 32° wall).
- **Finder sampling.** Values over 30-minute samples, not refined edges: each window edge inside a mission can move a percentage by up to half a sample. The Python reference test asserts this bound for the summary (`test_summary_matches_samples` in `scripts/tests/test_windows.py`); for the finder it is not asserted.
- **Candidate step.** Landing times are tried every 30 min (until 15 Nov 2026: every 6 h, which missed a qualifying Haworth window, check V8); a better landing time between two candidates is not found. Not quantified.
- **Custom points.** Their horizon and slope come from the coarser browser rasters (see [01-sunlight-horizon.md](01-sunlight-horizon.md)), so their values carry that larger error into the ranking.

The uncertainty budget for numbers shown in the app is in [uncertainty.md](uncertainty.md).

## Tests that check it

| Test file | Test name | What it asserts |
|---|---|---|
| `app/src/geometry/rankSites.test.ts` | "slope exactly 5.0 passes"; "slope 5.1 fails: in `failed`, rank null, values still shown"; "null, missing or non-finite slope is unknown, never a pass" | the slope filter |
| `app/src/geometry/rankSites.test.ts` | "'any' orders by coverage, then % sunlit"; "'light' orders by litPct desc, then longestDarkH asc, before coverage"; "evidence tiers order correctly for 'water-ice' and the best entry's source is kept" | the goal rules |
| `app/src/geometry/rankSites.test.ts` | "sites equal on every key share a rank (1, 1, 3), list each other, and sort by siteId"; "does not mutate the input and never produces NaN" | ties and purity |
| `app/src/geometry/poiSearch.test.ts` | "10 deg of latitude from the pole is R·10·π/180"; "stays accurate for a metre-scale separation"; "antipodes are π·R apart" | the distance |
| `app/src/geometry/poiSearch.test.ts` | "excludes the site's own record, counts per selected group in opts.groups order"; "radius is inclusive" | the counts |
| `app/src/geometry/poiSearch.test.ts` | "'light' = litPct, 'comms' = coveragePct, 'both' = their sum"; "is null when a needed value is missing" | the share |
| `app/src/geometry/poiSearch.test.ts` | "groupsCovered before nearTotal before share"; "equal keys share a rank, are listed by siteId, and are both best"; "only ranks 1..3 are best; a tie at the cut-off keeps every tied row" | the order |
| `app/src/geometry/poiSearch.test.ts` | "when required: a failing or unknown slope does not pass and goes last, after no-data rows"; "when not required: every row passes and is ranked by its values" | slope filter in the search |
| `app/src/geometry/windows.test.ts` | "always lit and covered: every candidate passes, one window"; "always dark: no window, lit and darkness thresholds named"; "Earth below the horizon (far side): coverage thresholds named"; "runs on a real month in well under a second" | the finder (T12) |

These tests show that the code orders rows by the rules written above. They are not a scientific validation of the rules or of the thresholds.

## Validation status

- **Validated by the science lead (statement of 15 Nov 2026; see record).** `docs/event/validation.md`, section "Validation status 15 Nov", records his statement of 15 Nov 2026, 08:50, in chat with the build session: "validated everything means EVERYTHING", including what was built on 15 Nov. It does not say what was compared against what for this calculation; no per-check sign-off is written in `validation.md`. The record before the statement, unchanged:

- `docs/event/validation.md`, status table: V8, "Landing window finder: 3 sites × 1 threshold set, browser result vs `windows.py` brute force", is **open** (row "V5–V9 … finder …: open"); the independent recomputation by AI of 14 Nov lists "the finder's ranking" under "Not rechecked".
- The site search ranking: not recorded in `validation.md`.
- The finder thresholds and the 5° slope limit are project choices awaiting review by the science lead (comments in `geometry/index.ts` and `rankSites.ts`); no review is recorded in `validation.md`.
- `app/src/data/validation.ts`: `VALIDATED = true` (14 Nov 2026, team decision); its comment says it is not a sign-off by the science lead and that the open rows of `validation.md` stay open.
