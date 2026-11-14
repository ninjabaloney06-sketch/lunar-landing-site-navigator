# Validation — evidence and sign-offs

Leo (S) signs every check here; Otto (Q) checks reference configurations. Agents and the orchestrator add inputs and never mark a check passed. Tolerances and timing: [build-plan §6](build-plan.md#6-validation-leo-signs-evidence-in-docseventvalidationmd).

| ID | Check | Status | Signed by | Evidence |
|---|---|---|---|---|
| V1 | 10 site/time points vs JPL Horizons, < 0.05° | open | — | inputs below |
| V2 | One row by hand: Sun elevation at the pole ≈ −subsolar latitude | open | — | inputs below |
| Station check | Moon elevation at two stations vs Horizons (station as observer); IAU_EARTH approximation | open | — | inputs below |
| V3 | Synthetic horizons (flat sphere −0.0813° for 1.75 m; cone) | open | — | — |
| V4 | Real horizons vs PGDA averages (context) | open | — | — |
| V5–V9 | Window edges, coarse DEM, UI values, finder, panel types | open | — | — |

## How Leo checks V1, V2 and the station check (now about 5 min)

> **Update 14 Nov ~13:10 (integrator, AI):** the Horizons values, the differences and the V2 arithmetic are already filled in below by a script that fetched the seven links. Leo: open two or three links, spot-check that the numbers in the tables match what Horizons shows, read the worst-case lines in the evidence box, decide the two station questions, then sign in the table at the top. Nothing is marked passed until you sign.

You need a browser and a calculator. Each link below opens a plain-text JPL Horizons table with every setting fixed: observer table, apparent azimuth/elevation (quantity 4), refraction off (`AIRLESS`), decimal degrees, UTC, 6-hour steps. Our values are already in the tables below; you type in the Horizons values and the differences. Edit this file on GitHub (pencil icon), or send the numbers to Isaac and the orchestrator copies them in.

**Before comparing, check the header of every Horizons result** (copy these lines into the evidence box at the end; they replace the "settings screenshot" of build-plan §6):
- `Target body name`: Sun (10) or Earth (399). Earth must be 399, never the Earth-Moon barycentre (3).
- `Center body name`: Moon (301) for V1; Earth (399) for the station check.
- `Center geodetic`: the site's east longitude, latitude, altitude (km), as in the link.
- `Center pole/equ`: `MEAN_ME` for the Moon (the same frame as ours) or `ITRF93` for Earth. If it says anything else, stop and tell Isaac.
- `Center radii`: 1737.4 km (Moon) or 6378.137 / 6356.752 km (Earth, WGS 84).
- Column header `Azimuth__(a-app)__Elevation`: apparent az/el. Not RA/Dec.

### V1: 10 site/time points, Sun and Earth (pass: every |Δ| < 0.05°)

Links (each gives 5 rows: 00, 06, 12, 18, 24 UTC):
- [V1-a Sun from Connecting Ridge, 14 Nov 2026](https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%2710%27&OBJ_DATA=%27NO%27&MAKE_EPHEM=%27YES%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27coord%40301%27&COORD_TYPE=%27GEODETIC%27&SITE_COORD=%27223.32%2C-89.46%2C0.00175%27&START_TIME=%272026-11-14%2000%3A00%27&STOP_TIME=%272026-11-15%2000%3A00%27&STEP_SIZE=%276%20h%27&QUANTITIES=%274%27&ANG_FORMAT=%27DEG%27&EXTRA_PREC=%27YES%27&TIME_DIGITS=%27MINUTES%27&APPARENT=%27AIRLESS%27)
- [V1-b Earth from Connecting Ridge, 14 Nov 2026](https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%27399%27&OBJ_DATA=%27NO%27&MAKE_EPHEM=%27YES%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27coord%40301%27&COORD_TYPE=%27GEODETIC%27&SITE_COORD=%27223.32%2C-89.46%2C0.00175%27&START_TIME=%272026-11-14%2000%3A00%27&STOP_TIME=%272026-11-15%2000%3A00%27&STEP_SIZE=%276%20h%27&QUANTITIES=%274%27&ANG_FORMAT=%27DEG%27&EXTRA_PREC=%27YES%27&TIME_DIGITS=%27MINUTES%27&APPARENT=%27AIRLESS%27)
- [V1-c Sun from Shackleton Rim Site04, 16 Aug 2027](https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%2710%27&OBJ_DATA=%27NO%27&MAKE_EPHEM=%27YES%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27coord%40301%27&COORD_TYPE=%27GEODETIC%27&SITE_COORD=%27188.13%2C-89.7668%2C0.00175%27&START_TIME=%272027-08-16%2000%3A00%27&STOP_TIME=%272027-08-17%2000%3A00%27&STEP_SIZE=%276%20h%27&QUANTITIES=%274%27&ANG_FORMAT=%27DEG%27&EXTRA_PREC=%27YES%27&TIME_DIGITS=%27MINUTES%27&APPARENT=%27AIRLESS%27)
- [V1-d Earth from Shackleton Rim Site04, 16 Aug 2027](https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%27399%27&OBJ_DATA=%27NO%27&MAKE_EPHEM=%27YES%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27coord%40301%27&COORD_TYPE=%27GEODETIC%27&SITE_COORD=%27188.13%2C-89.7668%2C0.00175%27&START_TIME=%272027-08-16%2000%3A00%27&STOP_TIME=%272027-08-17%2000%3A00%27&STEP_SIZE=%276%20h%27&QUANTITIES=%274%27&ANG_FORMAT=%27DEG%27&EXTRA_PREC=%27YES%27&TIME_DIGITS=%27MINUTES%27&APPARENT=%27AIRLESS%27)

Sites: Connecting Ridge −89.46°, −136.68° (= 223.32° E); Shackleton Rim Site04 −89.7668°, −171.87° (= 188.13° E); altitude 0.00175 km (1.75 m eye on the 1737.4 km sphere, as in our table). Δ = Horizons − ours. At these low elevations compare azimuth and elevation separately.

| # | Site | UTC | Body | Our az | Our el | Horizons az | Horizons el | Δaz | Δel |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Connecting Ridge | 14 Nov 2026 00:00 | Sun | 263.2832 | 1.4935 | 263.2832 | 1.4935 | -0.0000 | +0.0000 |
| 2 | Connecting Ridge | 14 Nov 2026 00:00 | Earth | 135.4222 | -5.0329 | 135.4222 | -5.0329 | -0.0000 | +0.0000 |
| 3 | Connecting Ridge | 14 Nov 2026 06:00 | Sun | 260.2364 | 1.4651 | 260.2364 | 1.4651 | -0.0000 | +0.0000 |
| 4 | Connecting Ridge | 14 Nov 2026 06:00 | Earth | 135.0767 | -4.7727 | 135.0767 | -4.7727 | -0.0000 | +0.0000 |
| 5 | Connecting Ridge | 14 Nov 2026 12:00 | Sun | 257.1899 | 1.4369 | 257.1899 | 1.4369 | +0.0000 | +0.0000 |
| 6 | Connecting Ridge | 14 Nov 2026 12:00 | Earth | 134.7297 | -4.5014 | 134.7297 | -4.5014 | +0.0000 | -0.0000 |
| 7 | Connecting Ridge | 14 Nov 2026 18:00 | Sun | 254.1439 | 1.4090 | 254.1439 | 1.4090 | -0.0000 | +0.0000 |
| 8 | Connecting Ridge | 14 Nov 2026 18:00 | Earth | 134.3825 | -4.2197 | 134.3825 | -4.2197 | +0.0000 | -0.0000 |
| 9 | Connecting Ridge | 15 Nov 2026 00:00 | Sun | 251.0982 | 1.3815 | 251.0982 | 1.3815 | -0.0000 | -0.0000 |
| 10 | Connecting Ridge | 15 Nov 2026 00:00 | Earth | 134.0362 | -3.9282 | 134.0362 | -3.9282 | +0.0000 | -0.0000 |
| 11 | Shackleton Site04 | 16 Aug 2027 00:00 | Sun | 186.3703 | 0.0906 | 186.3703 | 0.0906 | -0.0000 | +0.0000 |
| 12 | Shackleton Site04 | 16 Aug 2027 00:00 | Earth | 172.1676 | -0.8013 | 172.1676 | -0.8013 | -0.0000 | -0.0000 |
| 13 | Shackleton Site04 | 16 Aug 2027 06:00 | Sun | 183.3231 | 0.0963 | 183.3231 | 0.0963 | +0.0000 | -0.0000 |
| 14 | Shackleton Site04 | 16 Aug 2027 06:00 | Earth | 171.8156 | -0.4488 | 171.8156 | -0.4488 | +0.0000 | +0.0000 |
| 15 | Shackleton Site04 | 16 Aug 2027 12:00 | Sun | 180.2760 | 0.1026 | 180.2760 | 0.1026 | +0.0000 | +0.0000 |
| 16 | Shackleton Site04 | 16 Aug 2027 12:00 | Earth | 171.4660 | -0.0961 | 171.4660 | -0.0961 | -0.0000 | +0.0000 |
| 17 | Shackleton Site04 | 16 Aug 2027 18:00 | Sun | 177.2291 | 0.1096 | 177.2291 | 0.1096 | -0.0000 | +0.0000 |
| 18 | Shackleton Site04 | 16 Aug 2027 18:00 | Earth | 171.1193 | 0.2558 | 171.1193 | 0.2559 | +0.0000 | +0.0001 |
| 19 | Shackleton Site04 | 17 Aug 2027 00:00 | Sun | 174.1822 | 0.1172 | 174.1822 | 0.1172 | -0.0000 | +0.0000 |
| 20 | Shackleton Site04 | 17 Aug 2027 00:00 | Earth | 170.7763 | 0.6062 | 170.7763 | 0.6062 | +0.0000 | -0.0000 |

### V2: one row by hand (pass: sign and size agree)

1. Open [V2 sub-solar point on the Moon, 14 Nov 2026 12:00 UTC](https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%27301%27&OBJ_DATA=%27NO%27&MAKE_EPHEM=%27YES%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27500%40399%27&START_TIME=%272026-11-14%2012%3A00%27&STOP_TIME=%272026-11-14%2018%3A00%27&STEP_SIZE=%276%20h%27&QUANTITIES=%2715%27&ANG_FORMAT=%27DEG%27&EXTRA_PREC=%27YES%27&TIME_DIGITS=%27MINUTES%27). Columns `SunSub-LON` (east longitude) and `SunSub-LAT` give the sub-solar point λs, φs at 12:00.
2. Rough check: at the pole, Sun elevation ≈ −φs. Our Connecting Ridge value at 12:00 is 1.4369°. Connecting Ridge is 0.54° from the pole, so the rough check can differ by up to ~0.5°.
3. Exact, by calculator: sin(el) = sin φ · sin φs + cos φ · cos φs · cos(λ − λs), with φ = −89.46°, λ = 223.32°. Compare el with 1.4369°. Write your arithmetic in the evidence box.

### Station check: Moon elevation at two DSN stations (tolerance: you set it)

Links (Moon centre seen from the station, coordinates from `scripts/stations.csv`, WGS 84):
- [S-mad Moon from Madrid DSS-54, 16 Aug 2027](https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%27301%27&OBJ_DATA=%27NO%27&MAKE_EPHEM=%27YES%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27coord%40399%27&COORD_TYPE=%27GEODETIC%27&SITE_COORD=%27355.745903169%2C40.425621681%2C0.837051%27&START_TIME=%272027-08-16%2000%3A00%27&STOP_TIME=%272027-08-17%2000%3A00%27&STEP_SIZE=%276%20h%27&QUANTITIES=%274%27&ANG_FORMAT=%27DEG%27&EXTRA_PREC=%27YES%27&TIME_DIGITS=%27MINUTES%27&APPARENT=%27AIRLESS%27)
- [S-can Moon from Canberra DSS-34, 16 Aug 2027](https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%27301%27&OBJ_DATA=%27NO%27&MAKE_EPHEM=%27YES%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27coord%40399%27&COORD_TYPE=%27GEODETIC%27&SITE_COORD=%27148.981964419%2C-35.398478842%2C0.692020%27&START_TIME=%272027-08-16%2000%3A00%27&STOP_TIME=%272027-08-17%2000%3A00%27&STEP_SIZE=%276%20h%27&QUANTITIES=%274%27&ANG_FORMAT=%27DEG%27&EXTRA_PREC=%27YES%27&TIME_DIGITS=%27MINUTES%27&APPARENT=%27AIRLESS%27)

Compare the Horizons elevation with our `madrid_ctr` / `canberra_ctr` columns (Moon centre). Our station positions use the IAU_EARTH rotation model, Horizons uses ITRF93 with Earth-orientation data, so expect small differences; set a tolerance, write it and your reason here.

| UTC (16 Aug 2027) | Our Madrid el | Horizons Madrid el | Δ | Our Canberra el | Horizons Canberra el | Δ |
|---|---|---|---|---|---|---|
| 00:00 | 29.9062 | 29.8941 | -0.0121 | -34.3161 | -34.3423 | -0.0262 |
| 06:00 | -16.4283 | -16.4979 | -0.0696 | -6.8698 | -6.8018 | +0.0680 |
| 12:00 | -65.9508 | -65.9413 | +0.0095 | 61.1885 | 61.2502 | +0.0617 |
| 18:00 | -10.0222 | -9.9532 | +0.0690 | 28.9276 | 28.8513 | -0.0763 |
| 00:00 (17 Aug) | 34.9398 | 34.9425 | +0.0027 | -34.5199 | -34.5620 | -0.0421 |

Also decide and write down:
- Is IAU_EARTH acceptable for station positions, given the differences above?
- Is the generic 6.0° minimum elevation (DSN 810-005 module 301, section 2.2.3) acceptable, or must the per-antenna horizon masks (module 301, Figures 10–25) be used?

### Sign-off

- All pass → in the status table at the top set `passed`, `Leo`, and the time. Any fail → `failed`, plus the row number and the largest Δ, and tell Isaac at once. V1 off by > 0.05° with no cause found by 16:30 → Brief A abort rule: Isaac and Leo decide the fallback.
- Our tables come from Track A's working copy (12:21). If Track A changes `ephemeris.py` before it merges, the orchestrator reruns the tables and marks the change here.

Evidence box (paste the Horizons header lines, V2 arithmetic, tolerance and notes):

```text
AI-filled comparison (integrator, Claude Code, 14 Nov 2026 ~13:10 CET). NOT a sign-off: Leo reviews and signs.
Method: a script fetched the seven links above and wrote the Horizons values and differences into the tables.
V1 worst |Δaz| = 0.0000 deg, worst |Δel| = 0.0001 deg over 20 rows (limit 0.05).
Station check worst |Δel| = 0.0763 deg over 10 values (tolerance: Leo sets it).
V2: Horizons sub-solar point 14 Nov 2026 12:00 UTC: lon_s = 120.523877, lat_s = -1.557282.
    sin(el) = sin(-89.46)*sin(-1.557282) + cos(-89.46)*cos(-1.557282)*cos(223.32 - 120.523877)  ->  el = 1.4376 deg; ours 1.4369; difference +0.0007 deg.
    Rough check: -lat_s = 1.5573 deg (site is 0.54 deg from the pole).
Horizons headers:
V1-a: Target body name: Sun (10)                        {source: DE441} | Center body name: Moon (301)                      {source: DE441} | Center geodetic : 223.32, -89.46, .00175          {E-lon(deg),Lat(deg),Alt(km)} | Center pole/equ : MEAN_ME (high precision)        {East-longitude positive} | Center radii    : 1737.4, 1737.4, 1737.4 km       {Equator_a, b, pole_c}
V1-b: Target body name: Earth (399)                     {source: DE441} | Center body name: Moon (301)                      {source: DE441} | Center geodetic : 223.32, -89.46, .00175          {E-lon(deg),Lat(deg),Alt(km)} | Center pole/equ : MEAN_ME (high precision)        {East-longitude positive} | Center radii    : 1737.4, 1737.4, 1737.4 km       {Equator_a, b, pole_c}
V1-c: Target body name: Sun (10)                        {source: DE441} | Center body name: Moon (301)                      {source: DE441} | Center geodetic : 188.13, -89.7668, .00175        {E-lon(deg),Lat(deg),Alt(km)} | Center pole/equ : MEAN_ME (high precision)        {East-longitude positive} | Center radii    : 1737.4, 1737.4, 1737.4 km       {Equator_a, b, pole_c}
V1-d: Target body name: Earth (399)                     {source: DE441} | Center body name: Moon (301)                      {source: DE441} | Center geodetic : 188.13, -89.7668, .00175        {E-lon(deg),Lat(deg),Alt(km)} | Center pole/equ : MEAN_ME (high precision)        {East-longitude positive} | Center radii    : 1737.4, 1737.4, 1737.4 km       {Equator_a, b, pole_c}
V2: Target body name: Moon (301)                      {source: DE441} | Center body name: Earth (399)                     {source: DE441} | Center geodetic : 0.0, 0.0, -6378.137             {E-lon(deg),Lat(deg),Alt(km)} | Center pole/equ : ITRF93                          {East-longitude positive} | Center radii    : 6378.137, 6378.137, 6356.752 km {Equator_a, b, pole_c}
S-mad: Target body name: Moon (301)                      {source: DE441} | Center body name: Earth (399)                     {source: DE441} | Center geodetic : 355.7459032,40.4256217,.837051  {E-lon(deg),Lat(deg),Alt(km)} | Center pole/equ : ITRF93                          {East-longitude positive} | Center radii    : 6378.137, 6378.137, 6356.752 km {Equator_a, b, pole_c}
S-can: Target body name: Moon (301)                      {source: DE441} | Center body name: Earth (399)                     {source: DE441} | Center geodetic : 148.9819644,-35.3984788,.69202  {E-lon(deg),Lat(deg),Alt(km)} | Center pole/equ : ITRF93                          {East-longitude positive} | Center radii    : 6378.137, 6378.137, 6356.752 km {Equator_a, b, pole_c}
```

## V1 / V2 / station check — inputs (AI output, not validated)

- Source: `scripts/ephemeris.py --site` on branch `track-a` (Track A agent, Opus 5.5), working copy at 12:21 CET, not yet merged. Regenerate after merge if ephemeris.py changes.
- Kernels: naif0012.tls, pck00011.tpc, de440s.bsp, moon_pa_de440_200625.bpc, moon_de440_250416.tf (SHA-256 prefixes in the table header). Frame MOON_ME, correction LT+S, observer height 1.75 m on the 1737.4 km sphere (no DEM height yet), no refraction.
- Integrator cross-check (12:45, not a validation): SPICE `azlcpo` (independent topocentric routine, same kernels) reproduces all 12 Sun/Earth az/el values at 00:00, 12:00 and 24:00 of both tables to 0.0001°. This rules out frame, azimuth-convention and parallax errors in the code; it does not replace the Horizons comparison.
- Horizons settings for V1 (build-plan §6, TASKS UX-01): observer = site on the Moon (body 301, "coord@301", east longitude, latitude, altitude), targets Sun (10) and Earth (399), apparent azimuth/elevation, refraction off, UTC. Check which lunar body-fixed frame Horizons uses for surface coordinates: a ME vs PA mismatch (~0.9 km at the surface) tilts the local vertical by up to ~0.03°, which looks like an ephemeris error at the 0.05° tolerance.
- Station table: three DSN stations only (ESTRACK not sourced). Station positions use IAU_EARTH as an approximation of the terrestrial frame; `madrid_site` etc. = Moon-site elevation above the station's WGS 84 horizon, `_ctr` = Moon centre (what Horizons gives with the station as observer and target 301).

```text
# V1/V2 tables from branch track-a (scripts/ephemeris.py), ninja Mac / Guest123, 2026-11-14 12:21 CET. UNTRACKED file, never committed.
# Table 2 reads stations from the A-h branch copy of scripts/stations.csv (3 DSN rows; no ESTRACK rows in it yet) because stations.csv is not on main yet.

$ python3 scripts/ephemeris.py --site -89.46 -136.68 --start 2026-11-14T00:00 --end 2026-11-15T00:00 --step 60
# ephemeris.py --site -89.46 -136.68  2026-11-14T00:00Z .. 2026-11-15T00:00Z  step 60 min
# Observer on the Moon at lat -89.46 deg, lon -136.68 deg (MOON_ME planetocentric, east-positive), radius 1737.40175 km = 1737.4 km + elev 0 m + eye 1.75 m.
# Targets Sun (10) and Earth (399) centres; SPICE observer MOON, correction LT+S, then the site vector is subtracted (topocentric). Az 0 = north, clockwise; el above the local horizontal plane; no refraction.
# Direct SPICE values (not interpolated). r = angular radius of the disc (Sun 695700 km, Earth 6371 km).
# Kernels: naif0012.tls sha256:678e32bdb5a7, pck00011.tpc sha256:3dff7b1dbece, de440s.bsp sha256:c1c7feeab882, moon_pa_de440_200625.bpc sha256:60cd55aa401e, moon_de440_250416.tf sha256:a47c71e9c9f3
utc                   sun_az   sun_el  sun_r  earth_az  earth_el earth_r earth_dist_km
2026-11-14T00:00Z  263.2832   1.4935 0.2697  135.4222   -5.0329  0.8998      405701.2
2026-11-14T01:00Z  262.7754   1.4888 0.2697  135.3647   -4.9903  0.8998      405687.4
2026-11-14T02:00Z  262.2675   1.4840 0.2697  135.3072   -4.9474  0.8999      405671.7
2026-11-14T03:00Z  261.7597   1.4793 0.2697  135.2497   -4.9042  0.8999      405654.0
2026-11-14T04:00Z  261.2519   1.4746 0.2697  135.1920   -4.8607  0.8999      405634.5
2026-11-14T05:00Z  260.7441   1.4698 0.2697  135.1344   -4.8168  0.9000      405613.0
2026-11-14T06:00Z  260.2364   1.4651 0.2697  135.0767   -4.7727  0.9000      405589.6
2026-11-14T07:00Z  259.7286   1.4604 0.2697  135.0189   -4.7282  0.9001      405564.2
2026-11-14T08:00Z  259.2208   1.4557 0.2697  134.9611   -4.6835  0.9002      405536.9
2026-11-14T09:00Z  258.7131   1.4510 0.2697  134.9033   -4.6384  0.9002      405507.7
2026-11-14T10:00Z  258.2054   1.4463 0.2697  134.8455   -4.5930  0.9003      405476.4
2026-11-14T11:00Z  257.6976   1.4416 0.2697  134.7876   -4.5474  0.9004      405443.2
2026-11-14T12:00Z  257.1899   1.4369 0.2697  134.7297   -4.5014  0.9004      405408.0
2026-11-14T13:00Z  256.6822   1.4323 0.2697  134.6719   -4.4552  0.9005      405370.9
2026-11-14T14:00Z  256.1745   1.4276 0.2697  134.6140   -4.4087  0.9006      405331.7
2026-11-14T15:00Z  255.6668   1.4229 0.2697  134.5561   -4.3618  0.9007      405290.5
2026-11-14T16:00Z  255.1592   1.4183 0.2697  134.4982   -4.3148  0.9008      405247.3
2026-11-14T17:00Z  254.6515   1.4137 0.2697  134.4404   -4.2674  0.9009      405202.1
2026-11-14T18:00Z  254.1439   1.4090 0.2697  134.3825   -4.2197  0.9010      405154.9
2026-11-14T19:00Z  253.6362   1.4044 0.2697  134.3247   -4.1718  0.9011      405105.6
2026-11-14T20:00Z  253.1286   1.3998 0.2697  134.2669   -4.1236  0.9012      405054.3
2026-11-14T21:00Z  252.6210   1.3952 0.2697  134.2092   -4.0752  0.9013      405001.0
2026-11-14T22:00Z  252.1134   1.3906 0.2697  134.1515   -4.0264  0.9015      404945.6
2026-11-14T23:00Z  251.6058   1.3860 0.2697  134.0938   -3.9775  0.9016      404888.1
2026-11-15T00:00Z  251.0982   1.3815 0.2697  134.0362   -3.9282  0.9017      404828.6
# rows: 25


$ python3 scripts/ephemeris.py --site -89.7668 -171.87 --start 2027-08-16T00:00 --end 2027-08-17T00:00 --step 60 --stations   (CSV = A-h branch copy)
# ephemeris.py --site -89.7668 -171.87  2027-08-16T00:00Z .. 2027-08-17T00:00Z  step 60 min
# Observer on the Moon at lat -89.7668 deg, lon -171.87 deg (MOON_ME planetocentric, east-positive), radius 1737.40175 km = 1737.4 km + elev 0 m + eye 1.75 m.
# Targets Sun (10) and Earth (399) centres; SPICE observer MOON, correction LT+S, then the site vector is subtracted (topocentric). Az 0 = north, clockwise; el above the local horizontal plane; no refraction.
# Direct SPICE values (not interpolated). r = angular radius of the disc (Sun 695700 km, Earth 6371 km).
# Kernels: naif0012.tls sha256:678e32bdb5a7, pck00011.tpc sha256:3dff7b1dbece, de440s.bsp sha256:c1c7feeab882, moon_pa_de440_200625.bpc sha256:60cd55aa401e, moon_de440_250416.tf sha256:a47c71e9c9f3
utc                   sun_az   sun_el  sun_r  earth_az  earth_el earth_r earth_dist_km
2027-08-16T00:00Z  186.3703   0.0906 0.2624  172.1676   -0.8013  0.8990      406037.9
2027-08-16T01:00Z  185.8624   0.0915 0.2624  172.1088   -0.7426  0.8991      406023.9
2027-08-16T02:00Z  185.3545   0.0924 0.2624  172.0500   -0.6839  0.8991      406008.8
2027-08-16T03:00Z  184.8467   0.0934 0.2624  171.9914   -0.6251  0.8991      405992.4
2027-08-16T04:00Z  184.3388   0.0943 0.2624  171.9327   -0.5664  0.8992      405974.8
2027-08-16T05:00Z  183.8310   0.0953 0.2624  171.8742   -0.5076  0.8992      405956.1
2027-08-16T06:00Z  183.3231   0.0963 0.2624  171.8156   -0.4488  0.8993      405936.2
2027-08-16T07:00Z  182.8153   0.0973 0.2624  171.7572   -0.3900  0.8993      405915.1
2027-08-16T08:00Z  182.3074   0.0983 0.2624  171.6988   -0.3312  0.8994      405892.8
2027-08-16T09:00Z  181.7996   0.0994 0.2624  171.6405   -0.2724  0.8994      405869.3
2027-08-16T10:00Z  181.2917   0.1004 0.2624  171.5822   -0.2136  0.8995      405844.7
2027-08-16T11:00Z  180.7839   0.1015 0.2624  171.5241   -0.1548  0.8995      405819.0
2027-08-16T12:00Z  180.2760   0.1026 0.2624  171.4660   -0.0961  0.8996      405792.1
2027-08-16T13:00Z  179.7682   0.1037 0.2624  171.4080   -0.0374  0.8997      405764.0
2027-08-16T14:00Z  179.2604   0.1049 0.2624  171.3501    0.0213  0.8997      405734.8
2027-08-16T15:00Z  178.7525   0.1060 0.2624  171.2922    0.0800  0.8998      405704.5
2027-08-16T16:00Z  178.2447   0.1072 0.2624  171.2345    0.1387  0.8999      405673.0
2027-08-16T17:00Z  177.7369   0.1084 0.2624  171.1769    0.1973  0.8999      405640.4
2027-08-16T18:00Z  177.2291   0.1096 0.2624  171.1193    0.2558  0.9000      405606.7
2027-08-16T19:00Z  176.7212   0.1108 0.2624  171.0619    0.3144  0.9001      405571.9
2027-08-16T20:00Z  176.2134   0.1121 0.2624  171.0045    0.3728  0.9002      405535.9
2027-08-16T21:00Z  175.7056   0.1133 0.2624  170.9473    0.4313  0.9002      405498.8
2027-08-16T22:00Z  175.1978   0.1146 0.2624  170.8902    0.4896  0.9003      405460.7
2027-08-16T23:00Z  174.6900   0.1159 0.2624  170.8332    0.5479  0.9004      405421.4
2027-08-17T00:00Z  174.1822   0.1172 0.2625  170.7763    0.6062  0.9005      405381.0
# rows: 25

# Stations (stations-track-a-h.csv, 3 rows): goldstone = DSS-24 (34 m BWG) 35.339893 -116.874794 951.5 m WGS 84 ellipsoid, min_elev 6 deg; madrid = DSS-54 (34 m BWG) 40.425622 -4.254097 837.1 m WGS 84 ellipsoid, min_elev 6 deg; canberra = DSS-34 (34 m BWG) -35.398479 148.981964 692.0 m WGS 84 ellipsoid, min_elev 6 deg
# IAU_EARTH (pck00011) approximates the terrestrial frame for station positions; q_earth_to_me = pxfrm2('IAU_EARTH', 'MOON_ME', et - lt_earth, et). Station position in MOON_ME = earth_km + R(q_earth_to_me) . s_earthfixed (WGS 84).
# Moon elevation at each station, deg, above the station's geodetic (WGS 84 normal) horizon, airless, from the reversed LT+S geometry. site = the lunar site above; ctr = Moon centre (Horizons target 301).
utc                 goldstone_site   goldstone_ctr     madrid_site      madrid_ctr   canberra_site    canberra_ctr
2027-08-16T00:00Z        -22.6668        -22.4938         29.6760         29.9062        -34.0737        -34.3161
2027-08-16T01:00Z        -11.0074        -10.8261         26.5501         26.7559        -36.8015        -37.0406
2027-08-16T02:00Z          0.2677          0.4608         20.8336         21.0108        -36.1020        -36.3223
2027-08-16T03:00Z         10.8881         11.0959         13.1415         13.2913        -32.0988        -32.2893
2027-08-16T04:00Z         20.4667         20.6907          4.0576          4.1844        -25.4033        -25.5614
2027-08-16T05:00Z         28.4425         28.6815         -5.9509         -5.8416        -16.7529        -16.8818
2027-08-16T06:00Z         34.0679         34.3152        -16.5261        -16.4283         -6.7646         -6.8698
2027-08-16T07:00Z         36.5575         36.7992        -27.3760        -27.2829          4.1146          4.0270
2027-08-16T08:00Z         35.4648         35.6845        -38.2113        -38.1146         15.5656         15.4897
2027-08-16T09:00Z         30.9952         31.1823        -48.6430        -48.5309         27.3384         27.2676
2027-08-16T10:00Z         23.8542         24.0072        -57.9580        -57.8127         39.1856         39.1115
2027-08-16T11:00Z         14.8384         14.9616        -64.6375        -64.4398         50.7561         50.6657
2027-08-16T12:00Z          4.5912          4.6909        -66.1895        -65.9508         61.3183         61.1885
2027-08-16T13:00Z         -6.4300         -6.3473        -61.7110        -61.4757         68.9259         68.7251
2027-08-16T14:00Z        -17.9023        -17.8304        -53.3706        -53.1542         69.6924         69.4436
2027-08-16T15:00Z        -29.5733        -29.5051        -43.2530        -43.0499         62.9900         62.7611
2027-08-16T16:00Z        -41.1898        -41.1164        -32.3882        -32.1909         52.6911         52.4874
2027-08-16T17:00Z        -52.3788        -52.2867        -21.2759        -21.0784         41.1119         40.9217
2027-08-16T18:00Z        -62.3410        -62.2070        -10.2245        -10.0222         29.1131         28.9276
2027-08-16T19:00Z        -69.0161        -68.8130          0.5008          0.7113         17.0766         16.8898
2027-08-16T20:00Z        -68.8820        -68.6401         10.5988         10.8202          5.2449          5.0526
2027-08-16T21:00Z        -62.0112        -61.7880         19.6709         19.9043         -6.1558         -6.3572
2027-08-16T22:00Z        -51.9109        -51.7097         27.1723         27.4161        -16.8454        -17.0587
2027-08-16T23:00Z        -40.5772        -40.3875         32.4127         32.6603        -26.4202        -26.6471
2027-08-17T00:00Z        -28.7794        -28.5932         34.7006         34.9398        -34.2811        -34.5199

# Each station seen from the lunar site: az / el (deg) and line of sight. Flat horizon here (mask -0.0813 deg, no terrain). L = line of sight, T = below terrain mask, S = site below the station's min_elev_deg. Geometric line of sight only, not a working link.
utc                             goldstone                 madrid               canberra
2027-08-16T00:00Z  172.7546   -1.3880  T  171.8846   -1.5277  T  172.1140   -0.0600  S
2027-08-16T01:00Z  172.7032   -1.3954  T  171.6645   -1.4115  T  172.2352   -0.0356  S
2027-08-16T02:00Z  172.6061   -1.3907  T  171.4653   -1.2861  T  172.3557   -0.0266  S
2027-08-16T03:00Z  172.4652   -1.3700  T  171.2960   -1.1564  T  172.4643   -0.0296  S
2027-08-16T04:00Z  172.2857   -1.3307  T  171.1636   -1.0275  T  172.5508   -0.0406  S
2027-08-16T05:00Z  172.0750   -1.2713  T  171.0725   -0.9043  T  172.6060   -0.0547  S
2027-08-16T06:00Z  171.8431   -1.1918  T  171.0243   -0.7911  T  172.6229   -0.0671  S
2027-08-16T07:00Z  171.6014   -1.0937  T  171.0178   -0.6917  T  172.5964   -0.0728  S
2027-08-16T08:00Z  171.3618   -0.9799  T  171.0493   -0.6086  T  172.5243   -0.0673  L
2027-08-16T09:00Z  171.1366   -0.8544  T  171.1126   -0.5434  T  172.4071   -0.0470  L
2027-08-16T10:00Z  170.9364   -0.7220  T  171.1998   -0.4963  T  172.2485   -0.0089  L
2027-08-16T11:00Z  170.7704   -0.5881  T  171.3017   -0.4665  T  172.0549    0.0484  L
2027-08-16T12:00Z  170.6454   -0.4578  T  171.4082   -0.4518  T  171.8350    0.1252  L
2027-08-16T13:00Z  170.5652   -0.3364  T  171.5088   -0.4494  T  171.5997    0.2203  L
2027-08-16T14:00Z  170.5307   -0.2279  T  171.5938   -0.4554  T  171.3607    0.3309  L
2027-08-16T15:00Z  170.5399   -0.1357  T  171.6541   -0.4655  T  171.1302    0.4533  L
2027-08-16T16:00Z  170.5880   -0.0619  S  171.6821   -0.4750  T  170.9197    0.5830  L
2027-08-16T17:00Z  170.6679   -0.0074  S  171.6721   -0.4794  T  170.7393    0.7148  L
2027-08-16T18:00Z  170.7708    0.0283  S  171.6207   -0.4743  T  170.5968    0.8435  L
2027-08-16T19:00Z  170.8865    0.0469  S  171.5272   -0.4559  T  170.4977    0.9642  L
2027-08-16T20:00Z  171.0042    0.0510  S  171.3935   -0.4214  T  170.4441    1.0727  S
2027-08-16T21:00Z  171.1130    0.0444  S  171.2243   -0.3691  T  170.4355    1.1655  S
2027-08-16T22:00Z  171.2026    0.0314  S  171.0265   -0.2984  T  170.4683    1.2406  S
2027-08-16T23:00Z  171.2636    0.0168  S  170.8093   -0.2102  T  170.5367    1.2970  S
2027-08-17T00:00Z  171.2884    0.0055  S  170.5832   -0.1067  T  170.6326    1.3349  S
```

## Shackleton Rim Site04 coordinate — source check (integrator, AI, 14 Nov ~13:08; not validated)

- **Printed value confirmed.** [NASA Lunar Surface Data Book, ACD-50044 Rev A](https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf), table A2-2, p. 58: "R04 or Site04 — Shackleton Rim — -89.7668 — -171.87". The spec value is not a transcription error. The same table prints "R23 or Site23 — Malapert Massif — -85.9948 — -0.23578" (the name printed is "Malapert Massif", not "Malapert Site23") and "R01 or Site01 — Connecting Ridge — -89.4632 — -137.49".
- **What the coordinate is.** Same document, section A2.1, p. 57: "Coordinates have been generated from the DEM files on the PGDA website (https://pgda.gsfc.nasa.gov/products/81), so the center points of the original polygons are accurate to 5 to 10 meters." So −89.7668, −171.87 is the centre of the Site04 DEM polygon (a region named Shackleton Rim), not a point chosen on the rim crest. No frame is named; the PGDA LOLA products it points to are the frame source.
- **Consequence (Track B, re-run by the integrator).** In the LOLA DEM that centre point lies about 1.8 km inside the rim crest, on the inner wall: elevation 771 m, slope 31.8°, horizon mask 0.08° … 32.0° (peak at azimuth 87.5°). The Sun reaches about 0.1° there on 16 Aug 2027, so the spec demo question (Shackleton Rim, 16–29 Aug 2027) answers "dark" for this exact point. The number is correct for the point; the point is a region centre.
- **Decided (ninja, 14 Nov ~13:15): the demo site is Connecting Ridge** (spec.md). Preview, 10-min steps, Track B horizons, 3 DSN stations, not validated: Connecting Ridge 16–29 Aug 2027 lit 91 %, covered 98 %; 12–26 Sep 2027 lit 100 %, covered 96 %; Site04 centre lit 0 % and covered 0 % in both.
- Earlier open decision, now closed: keep the region centre and label it as such, or use a sourced point on lit ground for the demo. The Data Book itself names one: landing location CR1 at 89.468° S, 222.6° E on the Shackleton–de Gerlache connecting ridge (section 7.3.3, p. 46; also Figure caption p. 38).
