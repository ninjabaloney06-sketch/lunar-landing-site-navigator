# Build plan — Lunar Landing Site Navigator

What we build, how every part works, in which order, and how we know each part is right. Written 11 Nov 2026 on ninja's decision (see [decisions.md](../reference/decisions.md#build-plan-before-the-event-11-nov-2026)). Updated 13 Nov after the fact check in [plan-review-13nov.md](plan-review-13nov.md) (2024 site list, light-time size, 300 km rays, landing window finder, objective coverage). **No code in here, and no code before Sat 09:00.** Schedule and checkpoints: [event-plan.md](event-plan.md). Physics background: [primer.md](../reference/primer.md).

Numbers marked **(derived)** are our own arithmetic from sourced constants; everything else links to a source.

---

## 1. The product in one paragraph

A static web app. Pick a landing site (curated list, map click, or typed lat/long) and a date. The app shows where the Sun and Earth are relative to that site's **real terrain horizon**. It shows the time left until sunset and Earthset, the solar elevation in large type, and windows for light, Earth contact, and both together, for any day from Nov 2026 to Dec 2030. Two or three sites, or two date ranges, sit side by side. When a date slips, the **landing window finder** lists the next dates that still meet the mission's sunlight and Earth-contact needs. Every number carries its source and its limits.

**Demo question** (from ninja's timed tool run, [existing-tools.md](../reference/existing-tools.md)): *"At Shackleton Connecting Ridge, 14–28 Nov 2026 UTC: when do we have sunlight, when can we talk to Earth, and when both?"* The app answers it in under 60 s, and switching site or date updates the answer in under 10 s (UX-01–05).

**Mandatory scope update (ninja, 14 Nov):** terrain slope (**≤ 5° for landing; < 20° for exploration**), surface roughness and surrounding obstacles, thermal stability, and scientific value including PSRs and accessibility are required, not bonuses. See [spec.md](spec.md#mandatory-site-assessments--confirmed-by-ninja-14-nov-2026) and the [owned checklist](../../TASKS.md#mandatory-site-assessments--confirmed-14-nov-2026) for evidence and acceptance requirements. The slope thresholds are project criteria from ninja. Landing-site slope above 5° fails; exactly 5° passes only the slope criterion; missing slope data leaves landing suitability unknown. Earlier thermal/access exclusions and optional PSR treatment do not remove these assessments. Selected-ground-station geometry is also required by spec.md.

**What the app does not do:** landing trajectories or full automated traverse optimisation. Accessibility assessment is required; its extent and limits must be explicit. Thermal assessment is required using sourced observations or a documented model; a full thermal simulator is not prescribed.

**Leo's energy comparison:** parked until after the 12:00 freeze (ninja, 14 Nov). If time permits, S may assess ideal payload energy at explicitly labelled 100% efficiency, an accessible calculation breakdown, and a route with required burns. Use no SLS performance or efficiency data. Define the model, assumptions and validation before claiming any route is most efficient; 100% efficiency is an assumption, not a claim of 100% accuracy. It is not a feature for the submission; decide whether to pursue it after the event.

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
app/ (Vite + React + TypeScript, D3 for SVG, three.js lazy-loaded) ──► Cloudflare Worker (static assets), nasa.digi-works.org
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
| PGDA 60 m illumination crops per curated site (PNG, step 4) | ~20 KB each |
| One month of ephemeris | ~210 KB raw, ~80 KB gzipped **(derived: 1440 rows × 14 numbers: two vectors + two quaternions)** |
| One site horizon | ~10 KB |
| Coarse DEM | ~4.6 MB, loaded only when a custom site is used |
| 3D assets at first load | Moon colour 4k WebP ~1.5 MB, Moon normal map 2k ~0.8 MB, stars 4k JPG ~1 MB, Earth 2k JPG ~0.4 MB, three.js ~0.2 MB gzipped |
| Site terrain tile (on fly-in) | 500 × 500 heights Int16 ~0.5 MB + overlay PNG ~0.2 MB |
| Target first load | ≤ 5 MB gzipped (was 1.5 MB before the 3D-first decision); numbers render before textures finish |

**Code folders (only these two):** `scripts/` (Python pipeline, tests in `scripts/tests/`) and `app/` (frontend). Raw data path comes from the environment variable `CLPS_DATA`: `~/Documents/clps-data/clps` on ninja's Mac, or the USB stick's `clps/` folder elsewhere. Sub-paths are listed in the "Path under root" column of [data-sources.md](../reference/data-sources.md).

---

## 3. Data contracts (the agents build against these; change only with I + S agreeing)

All angles in degrees, distances in km unless named `_m`, times in UTC ISO 8601 or Unix seconds. Frame is always MOON_ME planetocentric, east-positive longitude, on the 1737.4 km sphere ([primer, frames](../reference/primer.md#coordinate-frames-which-one-we-use)).

**`sites.json`**: list of sites:

| Field | Meaning |
|---|---|
| `id` | slug, e.g. `connecting-ridge` |
| `name` | as printed in the source |
| `group` | `artemis-2024` (NASA's nine regions, 28 Oct 2024), `artemis-2022` (dropped in 2024, labelled so), `clps`, `commercial`, `international`, `apollo` (step 5) |
| `slope_deg` | DEM slope at the site over a 100 m baseline (filled by `horizon.py`; NASA names terrain slope as a region criterion) |
| `far_side` | `true` if Earth can never rise (sub-Earth longitude ± libration never reaches it); the UI says why |
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
| `ray_max_km` | 300 |
| `truncated` | list of azimuths where the ray left the DEM before `ray_max_km` |
| `dem` | product ID + DOI (Barker et al. 2023) |

**`ephem/YYYY-MM.json`**:

| Field | Meaning |
|---|---|
| `start_utc`, `step_min` (30), `n` | time grid |
| `frame` | `MOON_ME` |
| `correction` | `LT+S` (see §4.1, trap 1) |
| `sun_km`, `earth_km` | `n` × 3 position vectors, Moon centre → body |
| `q_me_to_j2000` | `n` × 4 quaternion (x, y, z, w), MOON_ME → J2000, from `pxform`; orients the star sphere and the system view (added 13 Nov for 3D) |
| `q_earth_to_me` | `n` × 4 quaternion, IAU_EARTH → MOON_ME at the light-time-corrected epoch; rotates the Earth texture so the right continent faces the Moon |
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

1. **Light time.** Horizons reports apparent positions, so we use correction `LT+S` (light time + stellar aberration) for both bodies; the primer's example uses `NONE`. **Size (corrected 13 Nov):** the MOON_ME orientation is evaluated at observation time, so the Moon's rotation during the 499 s light time does *not* enter. The real geometric-vs-apparent difference for the Sun is about the aberration, **~0.006° (derived: 30 km/s × 499 s / 1 AU)**; for Earth the two terms nearly cancel (< 0.001°). Both are below our 0.05° tolerance, so LT+S is for matching Horizons exactly, not a make-or-break trap. **Leo confirms `LT+S` against Horizons at 16:00.**
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
   - then each step 0.5 % longer than the last, out to 300 km: ~1070 samples per ray **(derived)**. Changed from 150 km on 13 Nov: a 5 km massif clears a flat horizon from ~132 km, and from a site 2 km up the line of sight reaches ~215 km (√(2Rh) per side); Barker et al. use 310 km.
   - Each sample point is the great-circle destination from the site at that azimuth and distance, then converted to DEM x/y.
5. **Two-level DEM in memory, not 2.7 GB.**
   - Near field (≤ 20 km): a 40 × 40 km window at full 20 m resolution, 2000 × 2000 pixels, ~16 MB.
   - Far field (20–300 km): a 600 × 600 km box (clipped to the DEM) read decimated to 160 m/px, up to ~3750 × 3750 pixels, ~56 MB.
   Read both once per site with windowed reads.
6. **Elevation angle of each sample.**
   - Target vector P = (1737.4 km + DEM height) × unit vector of the sample.
   - Angle = arcsin(((P − O) · up) / |P − O|).
   This handles lunar curvature exactly; no "curvature correction" formula is needed.
7. **Mask.** mask(az) = the maximum angle along the ray. Also keep the distance at which it occurred.
8. **Edges.** If a sample is outside the DEM or nodata, stop the ray there and add the azimuth to `truncated`. This matters only for sites near 80°S. The UI shows "horizon incomplete in these directions".

**Expected scale:** ~770,000 samples per site **(derived)**, a few seconds with numpy. All curated sites take minutes, so this runs live at the event, not overnight.

**Done when:** the synthetic tests T5–T7 pass, every curated site has a horizon file, and Leo signs V3 and V4 (§6).

### 4.3 `coarse_dem.py`, `basemap.py`, `sites.py`, `periods.py`

- **`coarse_dem.py`:** the 20 m DEM averaged to 400 m, 80°S–90°S → `dem_coarse.bin` (~1515 × 1515 × 2 bytes ≈ 4.6 MB **(derived)**). The browser runs the same ray method on it for custom sites.
- **`basemap.py`:** hillshade of the coarse DEM as a 1024 px PNG in the same polar stereographic grid, so map clicks convert to lat/lon with the same projection maths as the DEM. Optional layer: PGDA average illumination (`avgvisib_85s_060m_201608.img`, cite Mazarico et al. 2011) as a "% time lit" overlay.
- **`sites.py`:**
  - `scripts/sites.csv` is hand-built from [sources.md](../reference/sources.md): only entries Leo checked, one source URL each.
  - **First, NASA's 2024 set** (`artemis-2024`, 28 Oct 2024 release): Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater Plain. NASA gives no coordinates; the five that were also in 2022 use the LROC mosaic centres in sources.md; the four new ones need a source (Leo, Fri 13 Nov) or ship without terrain, labelled.
  - **Then the 2022-only regions** (`artemis-2022`, labelled "dropped in 2024"): Faustini Rim A, Peak Near Shackleton, Connecting Ridge Extension, de Gerlache Rim 1, de Gerlache-Kocher Massif, Leibnitz Beta Plateau, Amundsen Rim.
  - **Connecting Ridge** (the demo site) is labelled "Blue Moon MK1 target" (`commercial`), not "Artemis region": it is not in the 2024 set.
  - **Polar landers:** IM-2 actual and intended, VIPER / Mons Mouton, IM-1 actual.
  - **Step 5, outside the DEM (flat horizon, labelled):** Apollo 11, 12, 14, 15, 16, 17; Chandrayaan-3 (ISRO); Chang'e 3, 4, 5, 6 (CNSA); SLIM (JAXA); Luna-25 target (Roscosmos, crashed); Blue Ghost M1 (CLPS). Coordinates only from primary sources Leo adds to sources.md. Chang'e 4 and 6 are on the far side: Earth never rises, the UI explains why they needed the Queqiao relay. Chandrayaan-3 and Luna-25 (~69°S) lie inside the PGDA 65°S illumination maps on disk: show those averages as context.
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
- Angular radius from the actual distance: 0.90°–1.02° **(derived: 6371 km / 406,700–356,400 km)**, ~0.95° on average.
- *Visible* = any part of the disc above the mask (PGDA definition, [data guide §4](../reference/data-guide.md#4-published-illumination-and-earth-visibility-maps-mazarico-et-al)).
- Also report the centre elevation above the mask as "link margin".

**Windows.**
- Find state changes on the 30-minute grid.
- Refine each change by bisection on the interpolated vectors to ±1 minute.

**Power proxy by panel type** (Explain mode shows why the Moon differs from Earth):
- vertical, sun-tracking: fraction × 1 (default);
- horizontal: fraction × sin(elevation) — ~2.6 % at 1.5° elevation;
- vertical, fixed azimuth: fraction × cos(elevation) × max(0, cos(az − panel_az)).

**Landing window finder** (also mirrored in `app/src/geometry/`):
- Inputs: site, earliest landing date, latest landing date, mission length (days), thresholds: minimum % lit, minimum % Earth visible, maximum single blackout (hours) and maximum single darkness (hours).
- For every candidate landing time on a 6-hour grid, evaluate the mission interval on the 30-minute series; keep candidates that pass all thresholds; merge neighbours into windows; rank by % both.
- Output: the next 5 windows with their numbers, or the nearest miss and which threshold failed.
- Cost: ≤ 4 years × 4 candidates/day; prefix sums make % lit / % Earth O(1) per candidate, longest-gap checks use precomputed gap lists. Under 1 s in the browser.

**Summaries per site and period:**
- % lit, % Earth visible, % both;
- longest dark, longest blackout (hours);
- mean power proxy;
- the list of windows.

### 4.5 Cross-language fixtures

`export_fixtures.py` writes `app/src/test/fixtures.json` (§3). The app's TypeScript geometry must match it to within 1e-6° (T9). This is the single guarantee that the browser shows what Leo validated in Python.

---

## 5. App (`app/`)

### 5.1 Layout: one 3D screen, almost no UI (ninja, 13 Nov)

**Direction (ninja, 13 Nov):** "the most simple UI possible but with a beautiful 3D viewer", built "from the start", where you "move around … to see multiple angles". It shows only the bodies that matter here (Sun, Earth, Moon, stars), not a full solar system. The 3D scene *is* the answer, not decoration. Full method: §5.4.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Connecting Ridge                                                          [Find better dates] │
│ 14 November 2026, 12:00 UTC                                                                  │
│                                                                                              │
│              Sun 1.2°                                         Earth 4.8°                     │
│                ☀                                                 ◐                           │
│      ~~~~~~~~ real terrain, drag to orbit, scroll to zoom ~~~~~~~~                           │
│                                   Landing site │ (mast on the exact point, cross on ground)  │
│ Sunlight for 3 more days.                                                                    │
│ Earth sets in 18 hours.                                                                      │
│ Sun   ━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  (cursor │)        │
│ Earth ━━━                                                    ━━━━━━━━━━━━                    │
│ 14 Nov      16 Nov      18 Nov      20 Nov      22 Nov      24 Nov      26 Nov      28 Nov   │
└ Terrain LOLA 20 m · ephemeris JPL DE440 · how this is computed ──────────────────────────────┘
```

**Revised 13 Nov after ninja's review of a throwaway mockup** ("too AI-slop like", "too many buttons/informations on the main screen"; the mockup itself stays outside the repo). Rules, from ninja's taste book (Ninja-2 `taste-ui-web`, section "AI slop"):

- **Three clickable things on the main screen:** the site name (opens search/list), the date (opens date/time), *Find better dates*. Everything else is direct manipulation or keys: drag = orbit, scroll = zoom, double-click pin = fly to site, `E` eye level, `S`/`T` look at Sun/Earth, space = play, `Esc` = back out to the globe. One "details" drawer (opened from the answer sentence) holds the horizon strip with exact az/el, compare, CSV export and panel type.
- **Coordinates always shown** under the site name (lat/lon in degrees, mono), from the site's source or, for user points, as entered (Bene, 13 Nov).
- **Adding points** (Bene, 13 Nov) lives inside the site menu, not as a fourth button: search field that also accepts typed coordinates, groups (Artemis regions NASA 2024 · Landers · Your points), and "Add a point: click the terrain or type coordinates". User points get letters (Point A, B…), are kept in the URL so a shared link carries them, and use the step-7 coarse-terrain horizon with its accuracy label; outside 80–90°S they get a flat horizon, labelled. Until step 7 passes, the menu shows "Add a point" disabled with "coming after terrain checks", never flat-horizon numbers at the pole.
- **One answer in plain words** ("Sunlight for 3 more days. Earth sets in 18 hours.") instead of a readout card. Numbers appear once, on the thing: "Sun 1.2°" at the Sun, "Earth 4.8°" at Earth.
- **The landing site marker touches the exact point:** a thin mast from the surface point plus a small ground cross, label at the mast top. No floating rings.
- **No:** frosted-glass pills, icon+label chips, sparkles icons, ALL-CAPS tracked labels, legends or status dots that repeat what the picture shows, a saturated primary button.
- **Type and colour:** Newsreader (serif) for the place name and the answer, IBM Plex Sans for UI, IBM Plex Mono for numbers; Sun = warm amber, Earth = blue, used the same in scene labels, sentence and timeline; near-black tinted background, a bottom fade only where text needs contrast.
- **The horizon strip** moves from the main screen into the details drawer; it stays the exact readout (UX-04) and the full fallback without WebGL (UX-03).
- **Compare** opens in the same drawer: columns of numbers + stacked timelines; the 3D view shows the selected column.

### 5.2 Modules

| Module | Does | Key rules |
|---|---|---|
| `geometry/` | Interpolate ephemeris to time t; site vector; ENU; az/el; disc fractions; windows; ray-casting on the coarse DEM | Pure functions, no UI; mirrors `windows.py` exactly; covered by fixtures |
| `data/` | Load sites, horizons, months of ephemeris on demand, coarse DEM on first custom site; cache | Show loading / error / empty states; never show the previous site's numbers under a new site's name (UX-03) |
| `state` | Selected sites (1–3), period, cursor time, view tab, explain mode, all in the URL hash | Shareable link reproduces the exact view |
| `views/Numbers` | The four big values + lit/Earth indicators | Values as text, not colour only |
| `views/HorizonStrip` | D3 SVG panorama strip under the 3D view, hover/tap shows exact az/el | Touch and mouse both expose values (UX-04); full fallback without WebGL |
| `views/Timeline` | Window bars + scrubber; keyboard ←/→ = 30 min, shift = 1 day; play speeds | Scrubber form from [inspiration](../reference/inspiration.md) #19 |
| `views/Compare` | Columns per site/period, synced cursor | Same scales across columns |
| (map) | Replaced by the 3D globe: site pins, click on the surface = custom site (raycast → lat/lon) | The site list still works if WebGL fails (UX-03/04) |
| `scene3d/` | The main 3D view, spec in §5.4: system, globe and site levels, camera, assets, debug API | Only consumes MOON_ME vectors from `geometry/`; no hand-written matrices; ≥ 30 fps on the team laptop |
| `views/CustomSite` | lat/lon input with validation; computes horizon from the coarse DEM in a Web Worker (< 1 s) | Inside 80°S–90°S: "coarse horizon (400 m), typical error X°" with X from V6; outside: flat horizon, "no terrain data"; rejects invalid input, never NaN |
| `views/Explain` | Toggle: one-sentence caption under each view, glossary (horizon mask, DTE, libration, PSR) from the primer; "vs. Earth" card: Sun's highest elevation here vs. Stuttgart on the same date, day length (29.5 Earth days), no atmosphere | For educators and the public |
| `views/Finder` | Landing window finder (§4.4): threshold form with mission-planner defaults, list of next 5 windows, "show in compare" button | Same numbers as `windows.py` (V8); explains a miss |
| (inset) | The PGDA 60 m average-illumination map becomes an overlay toggle on the 3D site terrain ("% of time lit"), PSR cells hatched | Answers "why does 500 m matter"; labelled 18.6-year average, Mazarico et al. 2011 |
| `export` | CSV of windows + summaries for the current view, next to "copy link" | For handing numbers to another team |

**Colours:** lit = warm yellow, Earth = blue, both = green, plus pattern fills for colour-blind users. **Dark theme only** (space context, projector-friendly). Fonts: system stack.

### 5.3 Stack and deploy

- **Stack:** Vite + React + TypeScript + D3 (horizon strip, timeline) + three.js (main view, loaded from the start; postprocessing for bloom). No other 3D framework.
- **No backend, no accounts, no analytics** (AGENTS.md: static JSON + static frontend).
- **Deploy:** Cloudflare Worker with static assets on ninja's existing account ([setup.md](../reference/setup.md)), URL **https://nasa.digi-works.org** (set up 13 Nov; serves a "coming soon" placeholder until the first deploy replaces it). Same URL from the first preview (Sat 20:00) to the final build. In step 0, create `app/wrangler.jsonc` with exactly this content (kept here as text because no project files may exist before Sat 09:00):

  ```jsonc
  {
    "name": "digi-works-nasa",
    "compatibility_date": "2026-11-01",
    "assets": { "directory": "./dist", "not_found_handling": "single-page-application" },
    "routes": [{ "pattern": "nasa.digi-works.org", "custom_domain": true }]
  }
  ```

  Deploy from `app/`: `npm run build && npx wrangler deploy`. Wrangler is logged in on ninja's Mac via OAuth (no API token). The name must stay `digi-works-nasa`; another name creates a second Worker and the domain will not move.

### 5.4 The 3D viewer: how we build it, and how agents build it without seeing it

**Goal:** one beautiful, simple 3D scene that is also correct. Every bright thing in it sits where our validated numbers say. Sizes and distances may be compressed for the eye; **directions and angular sizes never are**.

#### What the user sees: three zoom levels, one continuous camera

| Level | Camera | Shows | Purpose |
|---|---|---|---|
| **System** | Far out, orbiting the Moon–Earth pair | Sun as glow in its true direction; Earth and Moon (sizes ×N, labelled "sizes enlarged"); Moon's orbit line; stars | Why the Sun circles the pole once a month and Earth barely moves (libration wobble). Educators and public. |
| **Globe** | 3,000–20,000 km from the Moon's centre | Textured Moon lit by the true Sun direction (terminator correct), site pins, Earth in its true direction, stars | Pick a site (pin or click on the surface → custom lat/lon). Seeing that the pole sits on the terminator *is* the problem statement. |
| **Site** | **Default (ninja, 13 Nov):** orbit camera locked on the landing site as its only target, ~17 km away, ~16° above the site's horizon, 54° field of view, azimuth chosen so the **Sun is in frame beyond the site** (Sun ~18° left of centre, Earth to the right when it is up). Drag circles around the site, scroll changes distance (2–60 km); the target never moves. Eye level (2 m) on `E`. | Real LOLA terrain around the site, far horizon ring from the mask, Sun and Earth discs at true angular size, optional "% time lit" overlay | The answer: Sun grazing the ridge, Earth above or below the far rim, shadows sweeping as time plays. "Many angles" (ninja) = orbit + eye level + "look at Sun" / "look at Earth" buttons. |

Double-click a pin → 1.5 s fly-in (eased position + slerped orientation). `Esc` or the back button → fly out. Time play animates all three levels.

#### Frames and scale: why no hand-written matrix is needed

1. **Two scenes, two unit systems** (avoids float precision problems):
   - *Space scene* (system + globe): origin = Moon centre, axes = MOON_ME, unit = km. Sun and Earth vectors come straight from the ephemeris JSON.
   - *Site scene*: origin = the site, axes = local east-north-up (ENU), unit = m. Terrain heights within ±10 km stay precise in float32; the space scene at 1737 km would jitter by decimetres.
   - The fly-in crossfades from space to site scene at ~30 km altitude.
2. **The only transform we write ourselves** is the ENU basis at a site (east, north, up), already in `geometry/` and tested (T4). In three.js it is one call: `new Matrix4().makeBasis(east, north, up)`. Everything else uses three.js primitives: `position.copy(v)`, `lookAt`, `Quaternion.setFromUnitVectors`, `Quaternion.slerp`. **Rule for agents: no Euler angles, no hand-typed 4×4 matrices, no trigonometry in `scene3d/`**; anything angular goes through `geometry/` and its fixtures.
3. **True direction, true angular size, compressed distance.** The Sun (1 AU) and the stars would wreck the depth buffer. Each distant body is placed at a display distance `d` along its true unit vector with radius `d × tan(true angular radius)`. On screen this is pixel-identical to the real geometry. Earth in the site scene: true topocentric direction (site vector subtracted, §2) at display distance 50 km. `logarithmicDepthBuffer: true` in the space scene.
4. **Orientation of the textures:**
   - Moon texture: equirectangular, longitude 0 at the centre of the image, in MOON_ME (SVS CGI Moon Kit convention; S checks once with a known crater, test T16).
   - Stars: J2000 equatorial sky map on an inside-out sphere, rotated by `q_me_to_j2000` (inverse) for the current time.
   - Earth texture: rotated by `q_earth_to_me`, so the continent facing the Moon is right; lit by the Sun direction, so Earth's phase seen from the Moon comes out by itself (and must match T3).

#### Assets (downloaded 13 Nov to `$CLPS_DATA/textures/`, see [data-sources.md](../reference/data-sources.md); processed at the event)

| Asset | Raw file | Event processing (`scripts/textures.py`) | In the app |
|---|---|---|---|
| Moon colour | `lroc_color_poles_8k.tif` / `_4k.tif` (LRO WAC, SVS 4720) | → 4096 × 2048 WebP, sRGB | globe base colour |
| Moon relief | `ldem_16_uint.tif` (LOLA 16 px/deg) | → 2048 × 1024 normal map (no geometry displacement at globe scale: ±10 km on 1737 km is invisible) | globe lighting detail |
| South-pole cap | LOLA 20 m DEM (already on disk) | hillshade 80–90°S, polar stereographic → spherical-cap mesh over the globe | hides the pole pinching of equirectangular maps exactly where we zoom |
| Site terrain | LOLA 20 m DEM | `terrain_tiles.py`: 40 × 40 km around each curated site at 80 m → 500 × 500 Int16 heights | site-scene mesh; far ring from `mask` + `mask_dist_km` |
| Stars | `starmap_2020_4k.exr` (SVS 4851) | tone-map → 4096 × 2048 JPG | sky sphere |
| Earth | `world.200411.3x5400x2700.jpg` (Blue Marble NG, Nov) | → 2048 × 1024 JPG | Earth sphere + thin atmosphere rim shader |
| Sun | none | — | emissive disc + bloom |

#### Looks: the recipe for "super beautiful", kept cheap

- One directional light = the Sun; **no ambient light**: lunar shadows are black, which is what makes the Moon look real. Add a faint "earthshine" fill from Earth's direction only.
- `MeshStandardMaterial`, roughness 1, metalness 0 for regolith; ACES filmic tone mapping, sRGB output.
- Bloom on the Sun only; Earth gets a 30-line fresnel atmosphere rim; stars dimmed when the camera looks near the Sun.
- Site scene: one shadow-casting light with a tight shadow camera (4096² map) around the view. **Label: "shadows are visual; lit/dark comes from the validated horizon mask".** Grazing-angle shadow maps are not exact and are never used for numbers.
- UI on top: no panels, three text controls, one answer sentence, labels on the objects (§5.1). Bene owns the look; the taste rules in §5.1 are the brief.
- Performance: device-pixel-ratio cap 1.5, MSAA, shadows only in the site scene; target ≥ 30 fps on the ThinkPad (Arc 140V), checked with an fps counter in `?debug=1`.

#### How agents build and check 3D they cannot "see"

The risk with agent-written 3D is a pretty scene that is subtly wrong: a mirrored texture, Sun 90° off, Earth on the wrong side. We remove guesswork in five layers:

1. **Maths outside the renderer.** All positions come from `geometry/`, already proven against Python (T9) and Horizons (V1). `scene3d/` only places objects at given vectors.
2. **Debug API.** In `?test=1` the page exposes `window.__scene` with: camera pose, world position of every body, `project(name)` → screen pixel, and `setView({site, utc, level, az, el, fov})` for a deterministic camera.
3. **Numeric screen tests** (Playwright + headless Chromium, fixed 1280 × 720 viewport):
   - **T14 projection:** eye-level camera looking at the Sun's azimuth; the Sun's projected pixel must match the pinhole projection of the `geometry/` az/el within 1 px. Same for Earth.
   - **T15 silhouette:** for 8 azimuths, scan the pixel column downward from the top until the first terrain pixel; its elevation angle must match `mask(az)` within the angle of one pixel (~0.05° at 60° field of view).
   - **T16 orientation:** debug checker texture with labelled meridians; a pin at (0° N, 0° E) must face Earth's mean direction (+x in MOON_ME), a pin at 90° E must sit at +y. Then the real texture: a known crater (Tycho, coordinates from a primary source) lands under its pin.
   - **T17 occlusion:** at a time when the mask says "Sun below terrain", the Sun pixel must be dark (depth-occluded), and lit when the mask says lit.
4. **Screenshots the agent reads.** Claude reads images. Every 3D agent loop ends with: take 4 fixed screenshots (system, globe, site orbit, eye level) → read them → check against a written list (horizon level? Sun disc ≈ 0.53° wide? terminator through the sub-solar point? Earth phase matches T3? text readable at 375 px?) → fix → repeat. Bene approves the look; the agent never approves its own look.
5. **Golden images.** Once Bene approves, the 4 screenshots become golden files; later changes are compared with pixelmatch, and a large difference needs Bene's yes. This keeps one agent's "improvement" from silently breaking another's scene.

**Agent split (disjoint files):** C1 `app/src/scene3d/` (scene, camera, assets, debug API); C2 `app/src/views/` + overlay UI; Track B adds `scripts/textures.py` and `scripts/terrain_tiles.py`; Track A adds the two quaternions to `ephemeris.py`. Otto reviews; Leo checks T14–T17 numbers.

#### Order inside the build steps

| Build step | 3D content | Gate |
|---|---|---|
| 1 (Sat) | Globe level: textured Moon lit by the real Sun direction, pins, Earth and Sun at true directions, orbit controls. Site level v1: far horizon ring from the mask + Sun/Earth discs, eye-level and orbit. Horizon strip in the details drawer. Runs on `fixtures.json` until real data lands. | T14, T16 by Sat 21:30 |
| 3 | Time play animates every level | T17 |
| 4 | Real terrain mesh per curated site, "% time lit" overlay, fly-in transitions, globe click → custom site | T15 |
| 6 | Polish: system level, bloom, Earth atmosphere, oriented stars, shadows, golden images | Bene approves |

**Stop rule:** if T14 is not green by Sat 21:30, the horizon strip becomes the main view and the globe stays as a site picker; the numbers never wait for the visuals.

---

## 6. Validation (Leo signs, evidence in `docs/event/validation.md`)

| ID | Check | Tolerance | When |
|---|---|---|---|
| V1 | 10 site/time points: our az/el vs JPL Horizons, observer = site on the Moon (body 301), targets Sun (10) and Earth (399), apparent, refraction off; settings screenshot attached | < 0.05° | Sat 16:00 |
| V2 | Leo derives one row by hand (calculator): Sun elevation at the pole ≈ −subsolar latitude ([primer](../reference/primer.md)) | sign and size agree | Sat 16:00 |
| V3 | Synthetic horizons: flat sphere → mask = curvature dip, −0.087° for 2 m **(derived: √(2h/R))**; one cone of known height and distance → its angle | < 0.01° | Sat 20:00 |
| V4 | Real horizons: our % lit and % Earth visible over a full year, hourly, vs PGDA 18.6-year average maps at the site pixel. **Context only**, since the periods differ ([data guide review](../reference/data-guide.md#candidate-review--28-oct-2026)) | same ballpark; investigate > 15 points | Sat 21:30 |
| V5 | Window edges: bisection result vs 1-minute brute force on 3 sites × 3 days | ≤ 1 min | Sun 09:00 |
| V6 | Coarse (400 m) vs full (20 m) horizon on all curated sites: max and median difference | reported, shown in UI | before step 7 ships |
| V7 | 5 values read off the UI vs `windows.py` | exact to display precision | Sun 12:00 (freeze gate) |
| V8 | Landing window finder: 3 sites × 1 threshold set, browser result vs `windows.py` brute force over every 30-min landing time; Leo checks one window by hand on the timeline | same windows, edges ≤ 6 h | Sun 10:00 |
| V9 | Panel types: horizontal power at a polar site ≈ sin(elevation) of the tracking value; one value by calculator | 3 significant digits | Sun 10:00 |

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
| T12 | Finder: synthetic always-lit site → every candidate passes; always-dark → none, with the failed threshold named; far-side site → Earth threshold fails |
| T13 | Ray length: a synthetic 5 km cone at 200 km is in the mask (fails with the old 150 km cutoff) |
| T14–T17 | 3D projection, silhouette, texture orientation, occlusion (§5.4) |

---

## 8. Build order, owners, timing

Ships strictly in this order. A step is done only when its bugs are fixed and Leo (numbers) and Otto (code) have signed it off. Feature freeze **Sun 12:00** (ninja, 11 Nov). Roles: **I** Isaac/ninja (integration, agents, pitch), **S** Leo, **Q** Otto, **D** Bene.

| Step | Contents | Owner | Target |
|---|---|---|---|
| 0 | Kickoff 10:30: confirm this plan, the 5 decisions in §9, demo owner; copy AI-use log template; app skeleton + LICENSE (Apache 2.0) | I | Sat 11:00 |
| 1 | Core: §4.1, §4.2, `sites.py`, geometry + Numbers (sun elevation) + **3D globe and site view v1 (§5.4)** + horizon strip + Timeline (windows) + basic site/date switch for ≥ 2 sites and ≥ 2 periods; first deploy | Tracks A/B/C below | Sat 21:30 |
| 2 | Sunset/Earthset countdown, large solar elevation, sunlight hours, Earth windows as numbers; UTC time field | D + I | Sun 08:30 |
| 2b | **Landing window finder** (§4.4) + V8 — the answer to "the date slipped, what now?" | I + S | Sun 09:00 |
| 3 | Scrubber with play speeds; periods presets from `periods.py` (seasons); panel-type toggle + "vs. Earth" card (V9) | D + I | Sun 09:30 |
| 4 | Compare drawer (3 sites / 2 periods), real terrain mesh + "% time lit" overlay with PSR hatching, globe click → custom site, fly-in, CSV export (§5.4) | D + I | Sun 10:30 |
| 5 | More curated sites: Apollo, Chandrayaan-3, Chang'e 3–6, SLIM, Luna-25, Blue Ghost M1 (flat horizon outside DEM, labelled; far-side explanation) | I + S | Sun 11:00 |
| 6 | 3D polish: system level, bloom, Earth atmosphere, oriented stars, shadows, golden images (§5.4) | D | Sun 11:30 |
| 7 | Custom lat/long with coarse horizon + V6 accuracy label | I + S | Sun 12:00 |

**Saturday tracks (step 1), disjoint files:**

- **Track A (I + agent):** `ephemeris.py`, `periods.py`, `export_fixtures.py`, `app/src/geometry/`. Leo runs V1, V2.
- **Track B (Otto + agent):** `horizon.py`, `sites.py`, `coarse_dem.py`, `basemap.py`, `scripts/tests/`. Leo runs V3, V4.
- **Track C (Bene + two agents):** C1 `app/src/scene3d/` (3D, §5.4); C2 `app/src/views/`, `app/src/data/`, `app/src/state` (overlay UI, strip, timeline). Both work on `fixtures.json` and a fake horizon until the real data lands (contract §3). Track A adds the two quaternions; Track B adds `textures.py` and `terrain_tiles.py`.

**Fallback for step 1 (added 13 Nov):** step 1 has one chain that can sink the demo: ephemeris → horizon → TypeScript geometry → fixture parity (T9) → views. If T9 is not green by **Sat 18:00**, switch to *step 1-lite*: `windows.py` writes per-site time series (az/el, lit, Earth, both, every 30 min) for the preset periods, and the views draw those directly. The TS geometry then becomes the upgrade that unlocks custom sites (7) and the in-browser finder (2b; the finder can also run in Python over presets). Track C builds against the same JSON shape either way.

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
6. **Finder defaults — CONFIRMED by ninja 13 Nov, every value adjustable in the UI** (form fields, kept in the URL): mission length **14 days**, ≥ **70 %** lit, ≥ **50 %** Earth visible, no blackout > **48 h**, no darkness > **72 h**. Leo proposes final numbers with a one-line reason each.
7. **Ray length: 300 km** (was 150 km; plan-review-13nov.md §2).
8. **Demo site label:** Connecting Ridge = Blue Moon MK1 target; Artemis regions = NASA's 2024 set first.
9. **CONFIRMED by ninja 13 Nov:** finder (step 2b) ranks above the scrubber (step 3).
10. **CONFIRMED by ninja 13 Nov:** simplest possible UI around a beautiful 3D viewer with only the bodies that matter (Sun, Earth, Moon, stars), built from step 1, free camera movement for many angles (§5.1, §5.4).

## 10. Before Saturday (allowed preparation only, no code)

- **Leo:** collect sourced coordinates for the Apollo landing sites (NASA NSSDC pages), for the international and commercial landers in §4.3 (ISRO, CNSA, JAXA, Roscosmos, Firefly/NASA pages or peer-reviewed papers) and for the four 2024-only Artemis regions; add them to [sources.md](../reference/sources.md). This is source collection, needed for steps 1 and 5.
- **Bene:** check that every team laptop opens a WebGL page smoothly (Arc 140V: expected fine).
- **Isaac:** 13 Nov submission-form check ([submission-check-13nov.md](submission-check-13nov.md)); read the Resources tab when it opens.
