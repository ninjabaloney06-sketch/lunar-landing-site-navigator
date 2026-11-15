# Is the Sun up at the site? Terrain horizon and sunlight

The app says a site is sunlit when any part of the Sun's disc stands above the terrain skyline seen by an eye 1.75 m above the ground. Two pieces make that answer: a horizon mask per site, computed once from LOLA elevation data (`scripts/horizon.py`), and the Sun's direction at every instant, computed in the browser from a precomputed SPICE ephemeris (`app/src/geometry/index.ts`). The same browser code is mirrored in Python (`scripts/windows.py`) as the reference.

## Equations

### 1. Horizon mask (per site, offline)

`compute_horizon()` in `scripts/horizon.py`. For each of 720 azimuths and each sample distance d along the ray:

```text
p(az, d) = cos(d/R)·up + sin(d/R)·(cos(az)·north + sin(az)·east)
O        = (R + (h_ground + h_eye)/1000) · up
P        = (R + h(p)/1000) · p
el(az, d) = asin( ((P − O)·up) / |P − O| )
mask(az) = max over d of el(az, d)
```

- `R` — reference sphere radius, 1737.4 km
- `up, north, east` — local unit vectors at the site (`enu()`: up = unit(lat, lon), east = unit(z × up), north = up × east)
- `az` — azimuth, 0° = north, clockwise, in steps of 0.5°
- `d` — distance along the surface, km; `p` is the great-circle destination point as a unit vector
- `h_ground` — DEM height at the site, m; `h_eye` — 1.75 m; `h(p)` — DEM height at the sample, m, read bilinearly
- `el` — elevation angle of the terrain sample above the site's local horizontal plane, degrees

Because O and P are placed on the curved sphere, lunar curvature is already in the angle; the code applies no separate curvature correction (docstring of `horizon.py`). On a smooth sphere the mask reduces to the curvature dip

```text
FLAT_DIP_DEG = −acos( R / (R + h_eye) ) = −0.0813°
```

which is also what the app uses when a site has no horizon file (`maskAt(null, …)` in `geometry/index.ts`).

Ray sampling (`ray_distances_km()`): every 20 m to 4 km, then each step 0.5 % longer than the one before, last sample at 300 km (1065 samples per ray). Samples within 20 km come from the full-resolution 20 m window; beyond 20 km from a 160 m average of the same file (`load_grids()`, `FAR_RES_M = 160`). A sample outside the 20 m DEM is read from the 120 m, 60° S product (`FilledGrid`). A ray that leaves both DEMs stops; its azimuth is listed in `truncated`.

Site slope, written to the same file (`slope_deg`), is

```text
slope = atan( √( ((h_E − h_W)/100 m)² + ((h_N − h_S)/100 m)² ) )
```

with heights 50 m east, west, north and south of the site.

### 2. Sun direction at the site (browser)

`siteVector()`, `enuBasis()`, `azEl()` in `app/src/geometry/index.ts`:

```text
s     = (R + (h_ground + h_eye)/1000) · (cos φ cos λ, cos φ sin λ, sin φ)
u     = (r_sun − s) / |r_sun − s|
az    = atan2(u·east, u·north)            (0° … 360°)
el    = atan2(u·up, √((u·east)² + (u·north)²))
ρ_sun = asin( R_sun / |r_sun − s| )
```

- `φ, λ` — site latitude and east longitude, MOON_ME, degrees
- `r_sun` — Moon centre → Sun vector in MOON_ME, km, light time and stellar aberration corrected (LT+S), linearly interpolated between 30-minute samples (`interpolate()`)
- `s` — site position, km
- `ρ_sun` — angular radius of the Sun's disc, degrees (`angRadiusDeg()`)
- `R_sun` — 695 700 km

### 3. Visible part of the disc and the "lit" rule

`maskAt()` and `discFraction()` in `geometry/index.ts`:

```text
m = mask[i0] + (mask[i0+1] − mask[i0]) · f          (linear between 0.5° samples, wraps at 360°)
c = (m − el) / ρ
F = (acos c − c·√(1 − c²)) / π                      for −1 < c < 1
F = 1 for c ≤ −1,  F = 0 for c ≥ 1
lit  ⇔  F > 0
```

- `m` — terrain mask at the Sun's azimuth, degrees
- `F` — visible share of the disc, 0 … 1: the area of a circular segment above a straight horizon line, divided by the disc area

`F` is the textbook circular-segment area. The code treats the skyline across the disc as a straight horizontal line at the mask value of the disc centre's azimuth; the slope of the skyline across the 0.5° disc is ignored (comment on `discFraction`). "Lit" is any part of the disc above the skyline, the same rule the published LOLA illumination maps state ("sunlit (by any fraction of the solar disc)", quoted in `docs/event/validation.md`, V4 section).

### 4. Sunlit time over a period

`windows()` and `summarize()` in `geometry/index.ts`:

```text
lit %         = 100 · Σ (lit window lengths) / (t_end − t_start)
longest dark  = longest dark window, h, clipped to the period
```

The state is evaluated on the interpolated ephemeris every 1 min for periods up to 31 days and every 5 min for longer ones (`SCAN_FINE_MS`, `SCAN_COARSE_MS`); each change of state is bisected to ±10 s (`EDGE_TOL_MS`). A sunlit or dark spell shorter than the scan step can be missed (comment on `windows()`).

The landing-window finder (`finder()`) does not use the refined edges: it counts the 30-minute samples inside each candidate mission (comment: "sample-based, not edge-refined").

## Inputs and their sources

| Input | Value | Where in the code | Source recorded in the repository |
|---|---|---|---|
| Elevation model, near field and far field | LDEM_80S_20MPP_ADJ, 20 m/px, 80–90° S, south polar stereographic | `DEM_NAME`, `DEM_LABEL` in `scripts/horizon.py` | PGDA product 90, Barker et al. 2023, doi:10.3847/PSJ/acf3e1, data doi:10.60903/gsfcpgda-lola-spole; file URL and SHA-256 in `docs/reference/data-sources.md` |
| Elevation model outside the 20 m file | LDEM_60S_120MPP_ADJ, 120 m/px, 60–90° S | `FILL_DEM_NAME` in `scripts/horizon.py` | same product family; URL, size and SHA-256 in `docs/reference/data-sources.md` (downloaded 14 Nov 2026) |
| Reference sphere | R = 1737.4 km | `R_KM` (`horizon.py`), `MOON_RADIUS_KM` (`geometry/index.ts`) | the DEM's own sphere ("heights relative to 1737.4 km", `DEM_LABEL`) |
| Eye height | 1.75 m | `OBSERVER_HEIGHT_M` in both files | project decision, comment "spec.md, 14 Nov (the build plan's 2 m is superseded)" |
| Ray length | 300 km | `RAY_MAX_KM` | project decision, comment "changed from 150 km on 13 Nov"; reasoning in `docs/event/validation.md`, "Horizon range check" |
| Near-field radius, far-field spacing | 20 km, 160 m | `NEAR_KM`, `FAR_RES_M` | source not recorded in the code (design choice of the build plan §4.2) |
| Azimuth step | 0.5°, 720 directions | `AZ_STEP`, `N_AZ` | source not recorded in the code |
| Sun position | Moon centre → Sun, MOON_ME, LT+S, every 30 min, Nov 2026 – Dec 2030 | `scripts/ephemeris.py` (`KERNELS`, `FRAME`, `CORRECTION`, `STEP_MIN`), files `app/public/data/ephem/YYYY-MM.json` | NAIF kernels `naif0012.tls`, `pck00011.tpc`, `de440s.bsp`, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf`; URLs and SHA-256 in `docs/reference/data-sources.md` |
| Sun radius | 695 700 km | `SUN_RADIUS_KM` | comment: "IAU 2015 Resolution B3 nominal solar radius" |
| Stored precision of the ephemeris | Sun vector to 1 km, quaternions to 1e-7 | `SUN_DECIMALS`, `QUAT_DECIMALS` in `ephemeris.py` | the code's own estimate: Sun direction effect ≤ 3.4e-7°, rotation ≤ 1.2e-5° |

## Assumptions

- The DEM heights are relative to a 1737.4 km sphere in MOON_ME; the site coordinates are read in the same frame.
- The eye is 1.75 m above the DEM ground at the exact site point. A lander's deck, a mast or a solar array higher than that is not modelled.
- The skyline between two 0.5° azimuth samples is linear, and it is flat across the Sun's disc.
- Bilinear interpolation of the DEM between pixels; beyond 20 km the terrain is a 160 m average, so narrow far peaks are smoothed.
- No refraction (the Moon has no atmosphere) and no limb darkening; F is a geometric area fraction.
- The Sun's position between two 30-minute samples is a straight line in MOON_ME.
- Custom points use a different, coarser horizon: `capHorizon()` in `app/src/data/southcap.ts` follows the same method in the browser on the south-cap rasters (40 m within 5 km where tiles exist, 80 m within 20 km, 400 m beyond). The code labels this mask approximate.

## ε and how it propagates

What is measured, and where:

| Term | Size | Where it is measured |
|---|---|---|
| Ephemeris interpolation (30-min samples) vs direct SPICE | < 0.001° in every Sun and Earth direction, 1500 random times plus mid-steps | `scripts/tests/test_ephemeris.py`, `test_interpolation_vs_direct_spice` |
| Stored rounding of the ephemeris files | Sun < 1e-6°, Earth < 5e-6°, quaternion < 5e-5° | `test_ephemeris.py`, `test_stored_rounding_effect` |
| Browser code vs Python reference | 1e-6° on 200 cases | `app/src/geometry/fixtures.test.ts`, "Sun, Earth and station angles match within 1e-6 deg; visibility matches" |
| Sun azimuth and elevation vs JPL Horizons | largest difference 0.0000° in azimuth, 0.0001° in elevation, 20 rows | `docs/event/validation.md`, V1 evidence box |
| Horizon method on synthetic terrain | within 0.01° (flat sphere, single cones, a ridge, a 5 km cone at 200 km) | `scripts/tests/test_horizon.py`, see the test list below |
| Shipped horizons vs a separate ray march written from the definitions | largest difference per site 0.006° to 0.087°, median per site ≤ 0.009° | `docs/event/validation.md`, "Independent recomputation by AI", row 2 |
| Window edges | bisected to ±10 s; checked to ±1 min against a 1-minute scan | `EDGE_TOL_MS`; `windows.test.ts` |
| Custom-point horizon (`capHorizon`) vs the 18 pipeline horizons | default rings: median of the per-site medians < 0.02°, every per-site median < 0.3°, largest difference < 2° | `app/src/data/southcap.test.ts`, "accuracy table: default …" |

How an angle error becomes a time error: where the skyline is level, a mask or Sun-elevation error δ moves a sunrise or sunset by δ divided by the rate at which the Sun's elevation changes at that moment. Near the pole that rate is small (in the V1 table the Sun at Connecting Ridge changes elevation by about 0.03° in 6 hours), so on a level skyline a difference of a few hundredths of a degree already moves an edge by hours. Where the skyline is steep, the Sun's azimuth motion dominates and the effect is smaller. The code does not compute this propagation per site. **Not quantified:** the resulting uncertainty in lit % and in longest dark spell. The uncertainty budget for numbers shown in the app is in `uncertainty.md`.

Not quantified at all, and not estimated here:
- vertical error of the LOLA DEM itself and its effect on the mask;
- smoothing of distant peaks by the 160 m far field (bounded only by the independent recomputation above, which used its own 100 m steps);
- the gap between our 2027–2030 lit % and the published 18.6-year average maps (mean +2.1 points, largest 9.0 points, `docs/event/validation.md`, V4 section; the two quantities differ in period, terrain product and observer height, so this is context, not an error bar).

## Tests that check it

| Test file | Test name | What it asserts |
|---|---|---|
| `scripts/tests/test_horizon.py` | `test_ray_distances` | first sample 0.02 km, last 300 km, 200 equal steps to 4 km, then a step ratio of 1.005 |
| `scripts/tests/test_horizon.py` | `test_t5_flat_sphere_dip` | on a flat sphere every one of 720 mask values equals −0.0813° within 0.01°, reached at about 2.47 km; nothing truncated |
| `scripts/tests/test_horizon.py` | `test_t6_single_cone` | a cone 3 km and one 60 km away: the mask at its azimuth equals the angle to its apex within 0.01°; the opposite direction stays at the flat dip |
| `scripts/tests/test_horizon.py` | `test_t7_wall_at_known_azimuth` | a ridge 5 km away at 120°: peak found within 0.5° of azimuth, mask within 0.01° of a 1 m brute-force truth at three azimuths |
| `scripts/tests/test_horizon.py` | `test_t8_synthetic_edge_truncates_not_zero` | a ray that leaves the grid is listed as truncated and keeps the maximum of its valid part, never 0 |
| `scripts/tests/test_horizon.py` | `test_t8_rays_continue_on_the_fill_grid` | with the wider grid behind it no ray is truncated and a cone present only in that grid appears in the mask |
| `scripts/tests/test_horizon.py` | `test_t8_real_im1_is_complete_with_the_60s_dem` | on the real DEMs (skipped without the raw data) IM-1 has no truncated ray and equals the shipped file |
| `scripts/tests/test_horizon.py` | `test_t13_5km_cone_at_200km` | a 5 km cone 200 km away is in the 300 km mask and missed by a 150 km cutoff |
| `app/src/geometry/geometry.test.ts` | "flat horizon = curvature dip for a 1.75 m eye" | `maskAt(null, …)` returns `FLAT_DIP_DEG` ≈ −0.0813° |
| `app/src/geometry/geometry.test.ts` | "interpolates between 0.5 deg samples and wraps at 360" | linear interpolation of the mask and the wrap at 0° / 360° |
| `app/src/geometry/geometry.test.ts` | "disc fraction: full, none, half, symmetric, monotonic" | F = 1, 0 and 0.5 at the limits and centre; F(+x) + F(−x) = 1; F rises with elevation |
| `app/src/geometry/geometry.test.ts` | "T4: due north has az 0, due east az 90" | azimuth convention at several sites |
| `app/src/geometry/fixtures.test.ts` | "Sun, Earth and station angles match within 1e-6 deg; visibility matches" | browser = Python reference on 200 cases |
| `app/src/geometry/windows.test.ts` | "refined edges are within ±1 min of the true change, and no edge is missed at 1-min sampling" | edges against a 1-minute scan at two sites, with and without a horizon |
| `app/src/geometry/windows.test.ts` | "summary is consistent with the windows" | lit, Earth and coverage % between 0 and 100; union rules hold |
| `scripts/tests/test_windows.py` | `test_windows_tile_the_period_and_edges_are_real` | Python reference: windows tile the period and each edge is a real change within ±10 s |
| `scripts/tests/test_ephemeris.py` | `test_interpolation_vs_direct_spice` | interpolated ephemeris within 0.001° of direct SPICE |

These tests show that the code computes what it is written to compute. They are not a scientific validation.

## Validation status

As recorded, with the place it is recorded:

- `docs/event/validation.md`, status table (14 Nov 2026):
  - V1, 10 site/time points against JPL Horizons (< 0.05°): "passed — reported … in chat, 2026-11-14 15:56"; no written sign-off by the science lead in the repository.
  - V2, one row by hand: passed, reported the same way; no written sign-off.
  - V3, synthetic horizons: open (the flat-sphere value recomputed by AI, the cone case not rechecked).
  - V4, real horizons against the PGDA average maps: open, needs the science lead.
  - V5 (window edges) and V6 (coarse DEM): open; AI recheck agrees for window edges in 6 cases, coarse DEM not rechecked.
  - Horizon range (150 km against 300 km rays): open, needs the science lead.
  - Truncated horizons (recomputed with the 60° S DEM, horizons regenerated 14 Nov 17:47): open; AI recomputed all 18 from the raw DEM with separate code, agreement within 0.09°.
- `app/src/data/validation.ts`: `VALIDATED = true`, set on 14 Nov 2026 by team decision after the independent recomputation by AI. The comment in the file says: "Not a sign-off by the science lead: the open rows of that file stay open."
- Custom-point horizons (`capHorizon`): the code comment says "Nothing here is validated by the science lead". Not recorded in `validation.md`.
