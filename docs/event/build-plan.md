# Build plan — Lunar Landing Site Navigator

What we build, how every part works, in which order, and how we know each part is right. Written 11 Nov 2026 on ninja's decision (see [decisions.md](../reference/decisions.md#build-plan-before-the-event-11-nov-2026)). **No code in here, and no code before Sat 09:00.** Schedule and checkpoints: [event-plan.md](event-plan.md). Physics background: [primer.md](../reference/primer.md).

Numbers marked **(derived)** are our own arithmetic from sourced constants; everything else links to a source.

---

## 1. The product in one paragraph

A static web app. Pick a landing site (curated list, map click, or typed lat/long) and a date. The app shows where the Sun and Earth are relative to that site's **real terrain horizon**. It shows the time left until sunset and Earthset, the solar elevation in large type, and windows for light, Earth contact, and both together, for any day from Nov 2026 to Dec 2030. Two or three sites, or two date ranges, sit side by side. Every number carries its source and its limits.

**Demo question** (from ninja's timed tool run, [existing-tools.md](../reference/existing-tools.md)): *"At Shackleton Connecting Ridge, 14–28 Nov 2026 UTC: when do we have sunlight, when can we talk to Earth, and when both?"* The app answers it in under 60 s, and switching site or date updates the answer in under 10 s (UX-01–05).

**What the app does not do:** route or traverse planning, landing trajectories, atmospheric refraction (the Moon has none).

---

## 2. Architecture

```
raw data (USB / data computer, never in git)
  SPICE kernels ──► scripts/ephemeris.py ──► app/public/data/ephem/YYYY-MM.json   (site-independent)
  LOLA 20 m DEM ──► scripts/horizon.py   ──► app/public/data/horizons/<site>.json (one per curated site)
                ──► scripts/coarse_dem.py──► app/public/data/dem_coarse.bin      (custom sites)
                ──► scripts/basemap.py   ──► app/public/data/basemap.png         (2D map)
  docs/reference/sources.md ─► scripts/sites.csv ─► scripts/sites.py ─► app/public/data/sites.json
                                                 scripts/periods.py ─► app/public/data/periods.json
app/ (Vite + React + TypeScript, D3 for SVG, three.js lazy-loaded) ──► Cloudflare Pages
```

**Key design choice: the ephemeris does not depend on the site.** The pipeline stores the Sun and Earth position vectors in the Moon-fixed frame MOON_ME, relative to the Moon's centre, for every 30 minutes from 2026-11-01 to 2030-12-31. The browser turns them into azimuth and elevation for any site in microseconds:

- topocentric vector = body vector − site vector;
- rotate into the site's local east-north-up frame.

What this buys:

- **Custom coordinates** work without a server.
- **The time scrubber** needs no extra data.
- **Any date** in the range works, not just two presets.
- **Fewer moving parts:** the browser computes the windows; the Python code computes the same thing again, only as the test reference.

Why we can't take a shortcut with Earth's direction: the site sits up to 1737 km off the Moon's centre. Against Earth at ~384,400 km that shifts Earth's direction by up to **0.26° (derived)**, which is five times our 0.05° accuracy target. So the browser must subtract the site vector rather than use the direction from the Moon's centre.

**Size budget:**

| Item | Size |
|---|---|
| One month of ephemeris | ~90 KB raw, ~35 KB gzipped **(derived: 1440 rows × 6 numbers)** |
| One site horizon | ~10 KB |
| Coarse DEM | ~4.6 MB, loaded only when a custom site is used |
| 3D view | three.js, loaded only when the 3D tab opens |
| Target first load | ≤ 1.5 MB gzipped |

**Code folders (only these two):** `scripts/` (Python pipeline, tests in `scripts/tests/`) and `app/` (frontend). Raw data path comes from the environment variable `CLPS_DATA`: `~/Documents/clps-data/clps` on ninja's Mac, or the USB stick's `clps/` folder elsewhere. Sub-paths are listed in the "Path under root" column of [data-sources.md](../reference/data-sources.md).

---

## 3. Data contracts (the agents build against these; change only with I + S agreeing)

All angles in degrees, distances in km unless named `_m`, times in UTC ISO 8601 or Unix seconds. Frame is always MOON_ME planetocentric, east-positive longitude, on the 1737.4 km sphere ([primer, frames](../reference/primer.md#coordinate-frames-which-one-we-use)).

**`sites.json`**: list of sites:

| Field | Meaning |
|---|---|
| `id` | slug, e.g. `connecting-ridge` |
| `name` | as printed in the source |
| `group` | `artemis-region`, `clps`, `other-lander`, `apollo` (step 5) |
| `lat`, `lon` | as quoted by the source |
| `frame_note` | e.g. "ME inferred, not stated" (from sources.md) |
| `elev_m` | DEM height at the site (filled by `horizon.py`) |
| `source_url`, `source_label` | primary source; every site needs one |
| `horizon` | file name in `horizons/`, or `null` → flat horizon, labelled |

**`horizons/<id>.json`**:

| Field | Meaning |
|---|---|
| `site_id`, `lat`, `lon`, `elev_m` | site |
| `observer_height_m` | height above ground of the "eye" (default 2) |
| `az_step` | 0.5 |
| `mask` | 720 numbers: terrain elevation angle per azimuth, north = 0, clockwise |
| `mask_dist_km` | 720 numbers: distance of the blocking terrain (for 3D silhouette and debugging) |
| `ray_max_km` | 150 |
| `truncated` | list of azimuths where the ray left the DEM before `ray_max_km` |
| `dem` | product ID + DOI (Barker et al. 2023) |

**`ephem/YYYY-MM.json`**:

| Field | Meaning |
|---|---|
| `start_utc`, `step_min` (30), `n` | time grid |
| `frame` | `MOON_ME` |
| `correction` | `LT+S` (see §4.1, trap 1) |
| `sun_km`, `earth_km` | `n` × 3 position vectors, Moon centre → body |
| `kernels` | file names + SHA-256 prefixes from data-sources.md |

**`periods.json`**: preset date ranges with a one-line reason each ("Now", "Best sun season 2027", "Worst sun season 2027", "Best Earth visibility"), produced by `periods.py`.

**`dem_coarse.bin` + `dem_coarse.json`**: 80°S–90°S, polar stereographic, 400 m/px, 16-bit heights in metres; the JSON holds grid origin, pixel size, size, CRS string and nodata value.

**`fixtures.json`** (tests only, in `app/src/test/`): 200 random (site, time) cases with Python-computed az/el, mask and visibility. The TypeScript code must reproduce them.

---

## 4. Pipeline (Python, `scripts/`)

### 4.1 `ephemeris.py`: Sun and Earth vectors

- **Load kernels:** `naif0012.tls`, `pck00011.tpc`, `de440s.bsp`, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf` (all on the USB stick, [data-sources.md](../reference/data-sources.md)).
- **For each 30-minute step:** Sun and Earth position, observer Moon, frame `MOON_ME`, written per month.
- **Second mode, `--site lat lon`:** prints az/el for one site and time range. This is the reference Leo compares with JPL Horizons.

**Traps, stated first:**

1. **Light time.** The Sun's light takes ~499 s to arrive. In that time the Moon turns about **0.07° (derived: 360°/29.53 d × 499 s)**, more than our tolerance. Horizons reports apparent positions, so we use correction `LT+S` (light time + stellar aberration) for both bodies. The primer's example uses `NONE`; **Leo confirms `LT+S` against Horizons at 16:00.**
2. **Frame.** Never IAU_MOON. Name `MOON_ME` explicitly in every call ([primer](../reference/primer.md#coordinate-frames-which-one-we-use)). Before trusting a Horizons comparison, find out which lunar frame Horizons uses for surface observers; a ~0.7 km site offset otherwise looks like an ephemeris error (primer, open item).
3. **Libration** is included automatically: MOON_ME orientation comes from the DE440 lunar orientation kernel, so Earth's wobble near the horizon is real, not modelled.

**Done when:** monthly files from 2026-11 to 2030-12 exist; a ±1 step interpolation check deviates by < 0.001°; Leo's 10-point table passes (§6, V1).

### 4.2 `horizon.py`: terrain horizon per site (the risky part, specified in full)

**Input:** site lat/lon, `LDEM_80S_20MPP_ADJ.TIF` (20 m/px, 80°S–90°S, polar stereographic, MOON_ME DE421, heights relative to 1737.4 km; [data guide §2](../reference/data-guide.md#2-lola-south-pole-elevation-products-pgda)), observer height (default 2 m).

**Method** (the published approach, [primer: horizon mask](../reference/primer.md#what-a-horizon-mask-is), Barker et al. 2023):

1. **Site point.** Convert lat/lon to the DEM's x/y with the CRS read from the file itself (pyproj), never a hand-typed projection. Site height = DEM height (bilinear) + observer height. Site vector O = (1737.4 km + height) × unit vector(lat, lon).
2. **Local frame.**
   - up = unit vector(lat, lon);
   - east = unit(z-axis × up);
   - north = up × east.
   The same frame is used in the browser. If the horizon and the ephemeris disagree on north, every Sun position is wrong. Otto's test T4 catches this.
3. **Rays.** 720 azimuths, 0.5° apart (the Sun's disc is ~0.53° wide **(derived: 2 × 696,000 km / 1 AU)**, so 1° would be too coarse; this replaces the 1° in TASKS.md).
4. **Samples along each ray.**
   - 20 m steps out to 4 km;
   - then each step 0.5 % longer than the last, out to 150 km: ~930 samples per ray **(derived)**.
   - Each sample point is the great-circle destination from the site at that azimuth and distance, then converted to DEM x/y.
5. **Two-level DEM in memory, not 2.7 GB.**
   - Near field (≤ 20 km): a 40 × 40 km window at full 20 m resolution, 2000 × 2000 pixels, ~16 MB.
   - Far field (20–150 km): the same area read decimated to 160 m/px, ~1900 × 1900 pixels, ~14 MB.
   Read both once per site with windowed reads.
6. **Elevation angle of each sample.**
   - Target vector P = (1737.4 km + DEM height) × unit vector of the sample.
   - Angle = arcsin(((P − O) · up) / |P − O|).
   This handles lunar curvature exactly; no "curvature correction" formula is needed.
7. **Mask.** mask(az) = the maximum angle along the ray. Also keep the distance at which it occurred.
8. **Edges.** If a sample is outside the DEM or nodata, stop the ray there and add the azimuth to `truncated`. This matters only for sites near 80°S. The UI shows "horizon incomplete in these directions".

**Expected scale:** ~670,000 samples per site **(derived)**, a few seconds with numpy. All curated sites take minutes, so this runs live at the event, not overnight.

**Done when:** the synthetic tests T5–T7 pass, every curated site has a horizon file, and Leo signs V3 and V4 (§6).

### 4.3 `coarse_dem.py`, `basemap.py`, `sites.py`, `periods.py`

- **`coarse_dem.py`:** the 20 m DEM averaged to 400 m, 80°S–90°S → `dem_coarse.bin` (~1515 × 1515 × 2 bytes ≈ 4.6 MB **(derived)**). The browser runs the same ray method on it for custom sites.
- **`basemap.py`:** hillshade of the coarse DEM as a 1024 px PNG in the same polar stereographic grid, so map clicks convert to lat/lon with the same projection maths as the DEM. Optional layer: PGDA average illumination (`avgvisib_85s_060m_201608.img`, cite Mazarico et al. 2011) as a "% time lit" overlay.
- **`sites.py`:**
  - `scripts/sites.csv` is hand-built from [sources.md](../reference/sources.md): only entries Leo checked, one source URL each.
  - Start with Connecting Ridge, Connecting Ridge Extension, Peak Near Shackleton, de Gerlache Rim 1 and 2, Faustini Rim A, Haworth, Malapert Massif, Nobile Rim 1 and 2, Leibnitz Beta Plateau, Amundsen Rim, de Gerlache-Kocher Massif, IM-2 actual and intended, VIPER / Mons Mouton, IM-1 actual.
  - Nobile Rim 2 (83.95°S) and IM-1 (80.13°S) will have truncated rays: expected, labelled.
- **`periods.py`:**
  - Finds in 2027: the date of maximum and minimum subsolar latitude (best and worst sun season at the south pole) and the period with the highest share of Earth above the flat horizon.
  - Output: 14-day presets with a one-line reason each, plus "Now" = 14–28 Nov 2026 (the demo question).

### 4.4 `windows.py`: reference visibility and summaries (tests and Leo's checks, not the app)

**Sun.**
- Angular radius from the actual distance (~0.27°).
- Visible fraction = the share of the disc above a horizontal line at the mask height for the Sun's azimuth. This is a circular-segment area; mask slope across 0.5° is ignored, as noted.
- *Lit* = fraction > 0 ("any part of the disc", the same definition as PGDA's maps, so V4 compares like with like).
- Power proxy = fraction, i.e. a vertical, sun-tracking panel. Label it that way.

**Earth.**
- Angular radius ~0.95° **(derived: 6371 / 384,400 km)**.
- *Visible* = any part of the disc above the mask (PGDA definition, [data guide §4](../reference/data-guide.md#4-published-illumination-and-earth-visibility-maps-mazarico-et-al)).
- Also report the centre elevation above the mask as "link margin".

**Windows.**
- Find state changes on the 30-minute grid.
- Refine each change by bisection on the interpolated vectors to ±1 minute.

**Summaries per site and period:**
- % lit, % Earth visible, % both;
- longest dark, longest blackout (hours);
- mean power proxy;
- the list of windows.

### 4.5 Cross-language fixtures

`export_fixtures.py` writes `app/src/test/fixtures.json` (§3). The app's TypeScript geometry must match it to within 1e-6° (T9). This is the single guarantee that the browser shows what Leo validated in Python.

---

## 5. App (`app/`)

### 5.1 Layout (one screen, no setup dialogs: UX-02)

```
┌ Site: [list ▾ grouped] [map] [lat ___ lon ___ ▸]   Date: [2026-11-14 ▾] [presets ▾]   [Explain ◻] ┐
├────────────────────────────────────────────── Numbers ──────────────────────────────────────────────┤
│ SUN ELEVATION  1.2°   │ SUNSET IN  3 d 04 h │ EARTHSET IN  18 h 20 m │ LIT NOW ●  EARTH NOW ●          │
├─────────────────────────────────────────── Horizon view ────────────────────────────────────────────┤
│ panorama: azimuth 0–360° across, elevation −2…+10° up; terrain filled grey; Sun ☉ and Earth ⊕ with    │
│ their tracks for the selected day; [panorama | polar | 3D] tabs                                     │
├───────────────────────────────────────────── Timeline ──────────────────────────────────────────────┤
│ ███ lit  ▒▒▒ Earth  ▓▓▓ both  over the period, cursor = scrubber (drag, ±1 day keys, ▶ 1 h/s…1 d/s)  │
├──────────────────────────────────────── Compare (step 4) ───────────────────────────────────────────┤
│ up to 3 sites or 2 periods: same metrics as columns, stacked timelines on one time axis              │
└ Sources · limits · frame · data versions (always visible footer, UX-04/05) ──────────────────────────┘
```

**Why a panorama and not only a polar plot:** at the south pole the Sun stays within about ±1.6° and Earth within about ±7° of the horizon ([primer](../reference/primer.md)). On a standard polar plot that is a thin ring at the edge. Stretching the elevation axis makes the terrain-versus-Sun story readable at a glance. The polar plot stays as the second tab (it is the familiar form, [inspiration](../reference/inspiration.md) #1–3).

### 5.2 Modules

| Module | Does | Key rules |
|---|---|---|
| `geometry/` | Interpolate ephemeris to time t; site vector; ENU; az/el; disc fractions; windows; ray-casting on the coarse DEM | Pure functions, no UI; mirrors `windows.py` exactly; covered by fixtures |
| `data/` | Load sites, horizons, months of ephemeris on demand, coarse DEM on first custom site; cache | Show loading / error / empty states; never show the previous site's numbers under a new site's name (UX-03) |
| `state` | Selected sites (1–3), period, cursor time, view tab, explain mode, all in the URL hash | Shareable link reproduces the exact view |
| `views/Numbers` | The four big values + lit/Earth indicators | Values as text, not colour only |
| `views/Panorama`, `views/Polar` | D3 SVG sky views, hover/tap shows exact az/el | Touch and mouse both expose values (UX-04) |
| `views/Timeline` | Window bars + scrubber; keyboard ←/→ = 30 min, shift = 1 day; play speeds | Scrubber form from [inspiration](../reference/inspiration.md) #19 |
| `views/Compare` | Columns per site/period, synced cursor | Same scales across columns |
| `views/Map` | Basemap PNG, site markers, click = custom site | Pure projection maths, no map library; list still works if the map fails (UX-03/04) |
| `views/View3D` | Local 3D panorama: terrain silhouette ring from `mask` + `mask_dist_km`, Sun and Earth as sprites, drag to orbit (three.js) | Lazy-loaded; no textures, no models; pixel ratio capped at 1; ≥ 30 fps on the team laptop |
| `views/CustomSite` | lat/lon input with validation; computes horizon from the coarse DEM in a Web Worker (< 1 s) | Inside 80°S–90°S: "coarse horizon (400 m), typical error X°" with X from V6; outside: flat horizon, "no terrain data"; rejects invalid input, never NaN |
| `views/Explain` | Toggle: one-sentence caption under each view, glossary (horizon mask, DTE, libration, PSR) from the primer | For educators and the public |

**Colours:** lit = warm yellow, Earth = blue, both = green, plus pattern fills for colour-blind users. **Dark theme only** (space context, projector-friendly). Fonts: system stack.

### 5.3 Stack and deploy

- **Stack:** Vite + React + TypeScript + D3 (sky views, timeline). three.js only inside `View3D`.
- **No backend, no accounts, no analytics** (AGENTS.md: static JSON + static frontend).
- **Deploy:** Cloudflare Pages on ninja's existing account ([setup.md](../reference/setup.md)). Same URL from the first preview (Sat 20:00) to the final build.

---

## 6. Validation (Leo signs, evidence in `docs/event/validation.md`)

| ID | Check | Tolerance | When |
|---|---|---|---|
| V1 | 10 site/time points: our az/el vs JPL Horizons, observer = site on the Moon (body 301), targets Sun (10) and Earth (399), apparent, refraction off; settings screenshot attached | < 0.05° | Sat 16:00 |
| V2 | Leo derives one row by hand (calculator): Sun elevation at the pole ≈ −subsolar latitude ([primer](../reference/primer.md)) | sign and size agree | Sat 16:00 |
| V3 | Synthetic horizons: flat sphere → mask = curvature dip, −0.087° for 2 m **(derived: √(2h/R))**; one cone of known height and distance → its angle | < 0.01° | Sat 20:00 |
| V4 | Real horizons: our % lit and % Earth visible over a full year, hourly, vs PGDA 18.6-year average maps at the site pixel. **Context only**, since the periods differ ([data guide review](../reference/data-guide.md#candidate-review--28-oct-2026)) | same ballpark; investigate > 15 points | Sat 22:00 |
| V5 | Window edges: bisection result vs 1-minute brute force on 3 sites × 3 days | ≤ 1 min | Sun 09:00 |
| V6 | Coarse (400 m) vs full (20 m) horizon on all curated sites: max and median difference | reported, shown in UI | before step 7 ships |
| V7 | 5 values read off the UI vs `windows.py` | exact to display precision | Sun 12:00 (freeze gate) |

---

## 7. Tests (Otto writes the rules, agents write the tests, Otto reviews)

| ID | Test |
|---|---|
| T1 | Kernels load; `MOON_ME` named in every call (grep check: no `IAU_MOON`, no default-frame helpers) |
| T2 | Sun elevation at a polar site stays within ±2° for a year; Earth within ±8° |
| T3 | Sun–Earth separation matches the Moon's phase (full Moon ≈ 180°) |
| T4 | ENU consistency: a target placed due north in the horizon code has az = 0 in the ephemeris code, and due east has az = 90 |
| T5–T7 | Synthetic DEMs: flat, single cone, wall at a known azimuth → expected mask |
| T8 | Edge of DEM: a site near 80°S produces `truncated` entries, not zeros |
| T9 | TypeScript geometry matches `fixtures.json` within 1e-6° |
| T10 | UI: invalid lat/lon, failed data load and map unavailable still leave a usable core flow (UX-03) |
| T11 | Security: no secrets, keys or personal data in the build; dependencies pinned |

---

## 8. Build order, owners, timing

Ships strictly in this order. A step is done only when its bugs are fixed and Leo (numbers) and Otto (code) have signed it off. Feature freeze **Sun 12:00** (ninja, 11 Nov). Roles: **I** Isaac/ninja (integration, agents, pitch), **S** Leo, **Q** Otto, **D** Bene.

| Step | Contents | Owner | Target |
|---|---|---|---|
| 0 | Kickoff 10:30: confirm this plan, the 5 decisions in §9, demo owner; copy AI-use log template; app skeleton + LICENSE (Apache 2.0) | I | Sat 11:00 |
| 1 | Core: §4.1, §4.2, `sites.py`, geometry + Numbers (sun elevation) + Panorama + Timeline (windows) + basic site/date switch for ≥ 2 sites and ≥ 2 periods; first deploy | Tracks A/B/C below | Sat 22:00 |
| 2 | Sunset/Earthset countdown, large solar elevation, sunlight hours, Earth windows as numbers | D + I | Sun 08:30 |
| 3 | Scrubber with play speeds; periods presets from `periods.py` (seasons) | D + I | Sun 09:30 |
| 4 | Compare view (3 sites / 2 periods), 2D map with basemap | D + I | Sun 10:30 |
| 5 | More curated sites incl. Apollo (flat horizon outside DEM, labelled) | I + S | Sun 11:00 |
| 6 | 3D local panorama | D | Sun 11:30 |
| 7 | Custom lat/long with coarse horizon + V6 accuracy label | I + S | Sun 12:00 |

**Saturday tracks (step 1), disjoint files:**

- **Track A (I + agent):** `ephemeris.py`, `periods.py`, `export_fixtures.py`, `app/src/geometry/`. Leo runs V1, V2.
- **Track B (Otto + agent):** `horizon.py`, `sites.py`, `coarse_dem.py`, `basemap.py`, `scripts/tests/`. Leo runs V3, V4.
- **Track C (Bene + agent):** `app/src/views/`, `app/src/data/`, `app/src/state`. Works on `fixtures.json` and a fake horizon until the real data lands (contract §3).

**Honest note on speed:** steps 5–7 fit only if steps 1–4 pass their gates on time. If a gate fails, the remaining steps drop. They do not ship half-checked (cut list, [event-plan.md](event-plan.md#cut-list-in-order--cut-top-down-one-checkpoint-at-a-time)).

### 8.1 Agent brief template (one per step and track; fill at the event)

Every brief carries:

- **exact paths:** files to create or edit, `CLPS_DATA`, kernel names;
- **the contract section** from §3 it must meet;
- **the traps** from §4 that apply, stated before the steps;
- **a scope fence:** only these files; nothing in another track's folder;
- **done-when commands:** the pytest IDs, the fixture check, a screenshot at 375 px;
- **the one human decision** it must not make on its own.

Model: Opus for pipeline and geometry, Haiku for mechanical UI chores. Two agents never edit the same file.

---

## 9. Decisions to confirm at the 10:30 kickoff (defaults in bold)

1. **Observer height: 2 m** (solar panel or antenna on a lander). Alternative: 10 m mast as an educator toggle, which needs a second horizon set.
2. **Earth "visible" = any part of the disc** (PGDA definition). Alternative: centre ≥ mask + margin.
3. **Light-time correction: LT+S** (Leo confirms against Horizons in V1).
4. **Primary user: mission planner**, with the Explain toggle for educators and the public.
5. **Date range: Nov 2026 – Dec 2030** at 30-minute steps.

## 10. Before Saturday (allowed preparation only, no code)

- **Leo:** collect sourced coordinates for the Apollo landing sites (NASA NSSDC pages) and add them to [sources.md](../reference/sources.md). This is source collection, needed for step 5.
- **Bene:** check that every team laptop opens a WebGL page smoothly (Arc 140V: expected fine).
- **Isaac:** 13 Nov submission-form check ([submission-check-13nov.md](submission-check-13nov.md)); read the Resources tab when it opens.
