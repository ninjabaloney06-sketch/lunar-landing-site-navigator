# Can the site talk to Earth? Earth visibility and station line of sight

Two separate answers come out of the same geometry code (`app/src/geometry/index.ts`, mirrored in `scripts/windows.py`):

- **Earth visible**: any part of Earth's disc stands above the terrain skyline at the site.
- **Station contact (coverage)**: at least one selected ground station has a geometric line of sight to the site, checked at both ends — the station above the site's terrain skyline, and the site above the station's minimum elevation.

Contact here is geometry only. The code says so at the top of `geometry/index.ts`: "geometric line of sight to selected Earth stations at both ends; never a guaranteed working link". Antenna schedules, link budget, transmitter power and station availability are not modelled.

## Equations

### 1. Earth visible

The same disc rule as for the Sun (see [01-sunlight-horizon.md](01-sunlight-horizon.md)), with Earth's position and radius. `discOf()` and `sampleAt()`:

```text
u       = (r_earth − s) / |r_earth − s|
el, az  from u in the site's east-north-up frame
ρ_earth = asin( R_earth / |r_earth − s| )
c       = (mask(az) − el) / ρ_earth
F       = (acos c − c·√(1 − c²)) / π        (F = 1 for c ≤ −1, 0 for c ≥ 1)
Earth visible  ⇔  F > 0
```

- `r_earth` — Moon centre → Earth centre in MOON_ME, km, LT+S, interpolated between 30-minute samples
- `s` — site position: 1737.4 km + ground height + 1.75 m, km
- `R_earth` — 6371.0 km
- `mask(az)` — terrain skyline at Earth's azimuth, degrees

Subtracting the site vector matters: from the Moon's surface Earth's direction differs from the Moon-centre direction by up to 0.26° (comment on `azEl()`; test "Earth parallax: a surface observer is not the Moon centre (up to 0.26 deg)").

### 2. Station position on Earth

`prepStation()`: WGS 84 geodetic to Earth-fixed coordinates.

```text
e²  = f·(2 − f)
N   = a / √(1 − e² sin²φ_s)
x   = (N + h) cos φ_s cos λ_s
y   = (N + h) cos φ_s sin λ_s
z   = (N·(1 − e²) + h) sin φ_s
n_s = (cos φ_s cos λ_s, cos φ_s sin λ_s, sin φ_s)
```

- `a` — 6378.137 km; `f` — 1/298.257223563 (comment: "WGS 84 (NGA TR8350.2)")
- `φ_s, λ_s, h` — station geodetic latitude, east longitude (degrees) and ellipsoidal height (km)
- `n_s` — the station's geodetic up direction (the ellipsoid normal)

### 3. Line of sight at both ends

`losAt()` and `stationLos()`:

```text
S_me     = r_earth + M · S_ef                        station in MOON_ME, km
site end:    el_st = elevation of (S_me − s) above the site's horizontal plane
             ok_terrain  ⇔  el_st > mask(az_st)
station end: v = Mᵀ · (s − r_earth) − S_ef            site seen from the station, Earth-fixed
             el_moon = atan2( v̂·n_s, |v̂ × n_s| )
             ok_station  ⇔  el_moon ≥ min_elev
line of sight  ⇔  ok_terrain and ok_station
```

- `M` — rotation IAU_EARTH → MOON_ME from the stored quaternion `q_earth_to_me`. In `scripts/ephemeris.py` it is `pxfrm2("IAU_EARTH", "MOON_ME", et − lt_earth, et)`: Earth's orientation at the time the light left Earth.
- `S_ef` — station in the Earth-fixed frame (equation 2)
- `min_elev` — the station's minimum elevation, degrees, per station
- When both ends fail, the reason reported is "terrain" (comment on `stationLos()`).

The station point is treated as a point, not a disc: the site-end test uses the station's own direction against the skyline, with no disc fraction.

Between 30-minute samples the rotation is interpolated by a slerp of IAU_EARTH → J2000 and recomposed with MOON_ME → J2000, because a plain slerp of IAU_EARTH → MOON_ME "errs by ~0.002 deg mid-step" (comment in `stateBetween()`).

### 4. Coverage over a period

`coverage()`, `windows()`, `summarize()`:

```text
covered(t)  ⇔  some selected station has line of sight at t     (union, never double-counted)
unknown(t)  ⇔  no line of sight and a selected station has no result
coverage %  = 100 · Σ (covered window lengths) / (t_end − t_start)
longest gap = longest "none" window, h (unknown time is reported separately)
```

Edges are found as for sunlight: scan every 1 min (5 min above 31 days), bisect to ±10 s.

### 5. "Earth never rises here"

`earthCanEverRise()` checks a box of sub-Earth points, latitude −7.4° … 7.4° and longitude −8.6° … 8.6° in 0.25° steps, at the nearest Earth distance 356 600 km. The sentence "Earth never rises" is shown only if no point in that box shows any part of the disc above the skyline. The box limits are, per the code comment, the range of the sub-Earth point in the shipped ephemeris for Nov 2026 – Dec 2030 (latitude −6.86° … 6.85°, longitude −8.05° … 8.05°, distance ≥ 356 652 km), widened by 0.5°.

## Inputs and their sources

| Input | Value | Where | Source recorded in the repository |
|---|---|---|---|
| Earth position and Earth orientation | MOON_ME, LT+S, every 30 min, Nov 2026 – Dec 2030; IAU_EARTH rotation | `scripts/ephemeris.py` → `app/public/data/ephem/*.json` | NAIF kernels `de440s.bsp`, `pck00011.tpc`, `naif0012.tls`, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf`; URLs and SHA-256 in `docs/reference/data-sources.md` |
| Earth radius | 6371.0 km | `EARTH_RADIUS_KM` | comment: "mean radius 6371.0 km (build-plan §4.4)"; no external source named in the code |
| Ellipsoid | WGS 84, a = 6378.137 km, f = 1/298.257223563 | `WGS84_A_KM`, `WGS84_F` | comment: "NGA TR8350.2" |
| Terrain skyline | per-site horizon mask | `app/public/data/horizons/*.json` | see [01-sunlight-horizon.md](01-sunlight-horizon.md) |
| DSN Goldstone DSS-24, Madrid DSS-54, Canberra DSS-34 | coordinates WGS 84; minimum elevation 6.0° | `scripts/stations.csv` → `app/public/data/stations.json` | [DSN 810-005 Rev P, module 301](https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301P.pdf), Table 5; 6.0° is the generic receive limit of section 2.2.3; the per-antenna horizon masks (Figures 10–25) are not transcribed (`source_label`) |
| JAXA Usuda 64 m (DSS-48) | GRS80 / ITRF2014; minimum elevation 12.5° | same files | [JAXA station coordinates page](https://ddor.nav.isas.jaxa.jp/station_coordinates/); 12.5° is the highest value of JAXA's downlink horizon mask for this antenna, applied at every azimuth ("so conservative"); 2026 operating status not confirmed (`source_label`) |
| JAXA Uchinoura 34 m (DSS-38) | GRS80 / ITRF2014; minimum elevation 6.22° | same files | same page; 6.22° is the highest value of its horizon mask, applied at every azimuth |

No ESTRACK station is in `stations.json`. `scripts/stations.py` refuses a station row without a sourced minimum elevation (`test_missing_min_elev_raises_instead_of_defaulting`).

## Assumptions

- IAU_EARTH (pck00011) stands in for the terrestrial reference frame. No high-precision Earth orientation kernel is loaded (docstring of `ephemeris.py`). This is the open question of the station check in `docs/event/validation.md`.
- One minimum elevation per station, the same at every azimuth. For DSN this is the generic 6.0° limit, not the antenna's own horizon mask.
- Line of sight is geometric: no link budget, no antenna scheduling, no station downtime, no relay satellite.
- The Earth-visible rule is any part of the disc above the skyline; the station test treats the station as a point.
- GRS80 and WGS 84 are treated as the same ellipsoid (they differ by less than 0.1 mm at the surface, comment in `geometry/index.ts` and `stations.py`).
- The terrain assumptions of [01-sunlight-horizon.md](01-sunlight-horizon.md) apply unchanged: Earth sits very low in the sky at the south pole, so the skyline decides most of the result.

## ε and how it propagates

| Term | Size | Where it is measured |
|---|---|---|
| Earth azimuth and elevation vs JPL Horizons | largest difference 0.0000° in azimuth, 0.0001° in elevation (10 Earth rows of the 20) | `docs/event/validation.md`, V1 evidence box |
| Moon elevation at Madrid DSS-54 and Canberra DSS-34 vs JPL Horizons (station as observer, Horizons uses ITRF93) | largest difference 0.0763°, 10 values | `docs/event/validation.md`, station check |
| Station-end geometry vs SPICE `spkcpt` at the station epoch | < 0.001° (at the same UTC < 0.006°, the 1.3 s light time) | `scripts/tests/test_stations.py`, `test_reversed_geometry_matches_spice_spkcpt` |
| Ephemeris interpolation, including the Moon's elevation at a test station | < 0.001° | `scripts/tests/test_ephemeris.py`, `test_interpolation_vs_direct_spice` |
| Browser vs Python reference | 1e-6° | `app/src/geometry/fixtures.test.ts` |
| Coverage % at 18 sites, app vs an independent 1-minute computation from the SPICE kernels | 35 of 36 values identical to 0.1 %; Connecting Ridge 98.1 % against 98.2 % | `docs/event/validation.md`, "Independent recomputation by AI", row 4 |
| Our Earth-visible % against the published LOLA Earth-visibility maps | ours higher by about 1.5 points at most sites, largest +8.4 points; cause not established | `docs/event/validation.md`, V4 section |

The 0.0763° station-end difference matters only when the site sits within that angle of a station's minimum elevation. At the site end, Earth's elevation error is far smaller than the skyline's (see [01-sunlight-horizon.md](01-sunlight-horizon.md)), so the skyline dominates the Earth-visible and coverage edges. **Not quantified:** how these angle differences carry into coverage % and longest gap per site, and the effect of using the generic 6.0° DSN limit instead of each antenna's horizon mask. The uncertainty budget for numbers shown in the app is in [uncertainty.md](uncertainty.md).

## Tests that check it

| Test file | Test name | What it asserts |
|---|---|---|
| `app/src/geometry/geometry.test.ts` | "Earth parallax: a surface observer is not the Moon centre (up to 0.26 deg)" | the site vector is subtracted before the direction is taken |
| `app/src/geometry/windows.test.ts` | "is covered where at least one selected station is in line of sight" | coverage is the union over the selected stations; no selection gives "none" |
| `app/src/geometry/windows.test.ts` | "never double-counts overlapping station windows" | union of two overlapping stations is 75 % on the synthetic case, less than their sum |
| `app/src/geometry/windows.test.ts` | "is 'unknown' only where a selected station has no result" | missing input is reported as unknown, not as no contact |
| `app/src/geometry/windows.test.ts` | "says Earth never rises only when no libration state shows it" | a far-side site gets "never"; a pole site and a limb site reachable by libration do not |
| `app/src/geometry/windows.test.ts` | "refined edges are within ±1 min of the true change, and no edge is missed at 1-min sampling" | Earth and coverage edges included |
| `app/src/geometry/fixtures.test.ts` | "Sun, Earth and station angles match within 1e-6 deg; visibility matches" | browser = Python reference on 200 cases, every station |
| `scripts/tests/test_stations.py` | `test_sub_site_station_sees_moon_at_zenith_and_antipode_at_nadir` | a station placed under the site sees it above 89.9°, its antipode below −89.9° |
| `scripts/tests/test_stations.py` | `test_both_ends_reasons` | open sky gives line of sight; a 10° wall gives "terrain"; the antipode station gives "station-mask" |
| `scripts/tests/test_stations.py` | `test_reversed_geometry_matches_spice_spkcpt` | station-end elevation within 0.001° of SPICE (needs the kernels) |
| `scripts/tests/test_stations.py` | `test_union_of_overlapping_windows_is_not_double_counted`, `test_coverage_state_union` | Python reference union rules |
| `scripts/tests/test_stations.py` | `test_missing_min_elev_raises_instead_of_defaulting` | no station without a sourced minimum elevation |

These tests show that the code computes what it is written to compute. They are not a scientific validation.

## Validation status

As recorded:

- `docs/event/validation.md`, status table (14 Nov 2026):
  - V1 includes the Earth rows: "passed — reported … in chat, 2026-11-14 15:56"; no written sign-off by the science lead in the repository.
  - Station check (Moon elevation at two DSN stations against Horizons, IAU_EARTH approximation): **open**. The tolerance, whether IAU_EARTH is acceptable, and whether the generic 6.0° minimum elevation is acceptable are written there as questions for the science lead and are not answered.
  - V4 (Earth-visible % against the published maps): open; the file asks whether the Earth offset of about 1.5 points needs a cause "before Earth percentages are shown as validated".
  - V5 (window edges) and V8 (finder): open.
- `app/src/data/validation.ts`: `VALIDATED = true` by team decision on 14 Nov 2026 after the independent recomputation by AI; the comment says it is "Not a sign-off by the science lead: the open rows of that file stay open."
