# Getting there and back: launch, transfer and lunar orbit

The Flight plan tab flies a whole mission, from liftoff to Entry Interface, by numerical integration with finite burns. Two mission designs are offered (`app/src/flight/designs.ts`):

- **Apollo** (lunar orbit rendezvous): `planMission()` in `app/src/flight/mission.ts`.
- **SLS (Artemis)**, with Starship HLS or Blue Moon Mark 2 (rendezvous in a near-rectilinear halo orbit, NRHO): `planMissionNrho()` in `app/src/flight/missionNrho.ts`.

Both run in the web worker (`app/src/flight/planWorker.ts`). The phases and their modules:

| Phase | Module | Gravity field |
|---|---|---|
| Liftoff to parking orbit (185 km circular by default) | `ascent.ts`, `simulateAscent()` | Earth point mass + J2; air drag; no Moon, no Sun |
| Trans-Lunar Injection (TLI), translunar coast | `transit.ts`, `flyOutbound()` | `earthField()`: Earth + J2, Moon and Sun as third bodies |
| Lunar Orbit Insertion (LOI), 100 km circular (Apollo design) | `transit.ts` | `moonField()`: Moon point mass, Earth and Sun as third bodies |
| NRHO arrival, lander transfers NRHO ↔ low orbit, NRHO departure (Artemis design) | `nrho.ts` | the same Moon-centred ephemeris field |
| Lunar Orbit Plane Change | `planeChange.ts` | Moon-centred field |
| Descent, surface ascent, rendezvous | `lunar.ts` | see [05-descent.md](05-descent.md) |
| Trans-Earth Injection (TEI), coast to Entry Interface (121.92 km, −6.5° by default) | `transit.ts`, `flyHomebound()` | as outbound |

No burn anywhere in a plan is an instantaneous velocity change. Impulsive burns are used only as first guesses (`guess.ts`, and the header of `nrho.ts`).

## Equations

### 1. One integrator for every phase

`integrate()` in `app/src/flight/sim.ts`, Dormand–Prince 5(4) with adaptive steps and exact event location by bisection:

```text
dr/dt = v
dv/dt = a_grav(r, t) + F/m + a_extra
dm/dt = −F / (g₀ · Isp)
```

- `r, v` — position (km) and velocity (km/s) relative to the field's centre, J2000 axes
- `m` — mass, kg; `F` — thrust, N; `Isp` — specific impulse, s; `g₀` — 9.80665 m/s²
- `a_extra` — air drag during the launch only

### 2. Earth-centred field (TLI, coasts, TEI)

`earthField()` in `sim.ts`:

```text
a = −μ_E r/|r|³
    − (3/2) J2_E μ_E R_E² / |r|⁵ · [ r(1 − 5s²) + 2 s |r| p ],   s = (r·p)/|r|
    − μ_M [ (r − r_M)/|r − r_M|³ + r_M/|r_M|³ ]
    − μ_S [ (r − r_S)/|r − r_S|³ + r_S/|r_S|³ ]
```

- `μ_E, μ_M, μ_S` — Earth, Moon, Sun GM, km³/s²; `R_E` — 6378.137 km; `J2_E` — 1.08262668 × 10⁻³
- `p` — Earth's spin axis (unit, J2000); `r_M, r_S` — Moon and Sun relative to Earth, km
- the second bracket term of each body is the indirect term: the frame's centre falls toward that body too

The Moon-centred field (`moonField()`) is the same with the roles exchanged and the Moon as a point mass (formula in [05-descent.md](05-descent.md)).

### 3. Positions of the Moon and Sun

`makeFlightEphemeris()` in `app/src/flight/ephemeris.ts` builds the flight ephemeris from the app's own SPICE files. Those hold apparent vectors (LT+S), which the sky views need; a trajectory needs geometric positions. The code corrects Earth's position seen from the Moon to first order in v/c:

```text
geometric = p + (d/c) · [ (v_o·u) u + dp/dt ]
```

- `p` — apparent Earth vector seen from the Moon's centre, km; `u = p/|p|`; `d = |p|`
- `v_o` — the Moon's velocity relative to the Sun, km/s; `dp/dt` — the apparent vector's rate (central differences over ±10 min)
- `c` — 299 792.458 km/s

The code comment gives the size of this correction as up to about 38 km, almost all in range. The Sun's direction is left apparent. Body positions enter the force through a table with cubic interpolation (`makeBodyTable`, `nbody.ts`).

### 4. Launch

`simulateAscent()` in `app/src/flight/ascent.ts`, in the Earth-centred inertial frame:

```text
a = gravity (point mass + J2) + F(p_amb)/m − ½ ρ |v_air|² C_d(Mach) A / m · v̂_air
v_air = v − ω × r
F, Isp linear in ambient pressure between the sea-level and vacuum values
```

- `ρ, p_amb` — U.S. Standard Atmosphere 1976 above the WGS 84 equatorial radius (the flattening ignored)
- `ω` — Earth rotation, 7.292115 × 10⁻⁵ rad/s; `A` — frontal area of the stages still attached
- steering: vertical rise, pitch-over at 1°/s to a kick angle, gravity turn at zero angle of attack, then closed-loop primer-vector guidance to the target orbit, re-solved every guidance cycle; kick angle and pitch-over start optimised per call for the largest mass at insertion

### 5. Aiming the transfer

`flyOutbound()` and `flyHomebound()` in `transit.ts`:

- **TLI**: burn length and a small turn of the parking-orbit plane are corrected by Newton iteration until the unpowered approach passes the Moon at the lunar-orbit altitude in a plane over the landing site (the B-plane miss).
- **LOI**: thrust along the velocity still to be gained toward circular velocity at the present radius, started before closest approach so the burn straddles it, ended when nothing is left to gain.
- **TEI**: thrust along the Moon-relative velocity; for each ignition point the burn length is solved so the return meets the atmosphere at the entry flight-path angle; the ignition point with the shortest burn is taken.

The mission searches the liftoff instant within the day, the launch azimuth, the length and start of each burn in space, and the return day (header of `mission.ts`).

### 6. NRHO (Artemis design)

`nrhoAround()` in `nrho.ts`: the 9:2 lunar-synodic-resonant L2 southern halo orbit, started from two neighbouring members of the JPL three-body periodic orbit catalogue interpolated at the resonant period (2/9 of the synodic month of 29.530588853 days) and corrected by multiple shooting until one ballistic path in the real Earth–Moon–Sun field stays on it for the requested revolutions. The lander transfers to and from a 100 km low orbit over the site and the crew vehicle's powered flybys are solved on integrated flights (Parts 3–5 of `nrho.ts`).

### 7. Δv as reported

For every burn, Δv is the rocket-equation equivalent of the propellant burned in the integrated flight, `Δv = v_e · ln(m_before / m_after)`; the test "the speed the engine adds, summed over the falling mass, is the rocket equation vₑ·ln(m₀/m₁)" checks this against ∫F/m dt. Gravity losses are therefore included, unlike the impulsive Δv of a textbook budget.

## Inputs and their sources

| Input | Value | Where | Source given in the code |
|---|---|---|---|
| GM of Earth, Moon | 398600.435507, 4902.800118 km³/s² | `astro.ts` | JPL DE440, https://ssd.jpl.nasa.gov/astro_par.html |
| GM of the Sun | 132712440041.279419 km³/s² | `nbody.ts` | same |
| Earth J2 | 1.08262668 × 10⁻³ | `J2_EARTH`, `sim.ts` | comment: "EGM96 value" |
| Earth equatorial radius | 6378.137 km | `R_EARTH_EQ` | https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html (same as WGS 84) |
| Earth rotation | 7.292115 × 10⁻⁵ rad/s | `OMEGA_EARTH` | NSSDC Earth fact sheet (sidereal day 23.9345 h) |
| Moon's sphere of influence | 66 183 km | `SOI_MOON` | Bate, Mueller, White, *Fundamentals of Astrodynamics*, ch. 7 |
| Moon, Sun, Earth orientation | the app's ephemeris, Nov 2026 – Dec 2030 | `ephemeris.ts` | JPL DE440 through `scripts/ephemeris.py`; kernels in `docs/reference/data-sources.md` |
| Atmosphere | U.S. Standard Atmosphere 1976 | `ascent.ts` | named in the code; reproduced by a test |
| Drag coefficient against Mach | 0.30 subsonic, 0.55 peak, 0.25 at Mach 8 | `CD_MACH`, `CD_VAL` | **ASSUMPTION** in the code; shape as in Sutton & Biblarz, *Rocket Propulsion Elements* §4.2; the comment estimates that an error of a quarter in the curve moves the result by about 0.1 % |
| Saturn V (AS-506), SLS Block 1 (Artemis I), SLS Block 1B | stage masses, thrust, Isp, events | `launchVehicles.ts` | NASA SP-2000-4029, Saturn V flight evaluation and flight manual, SLS reference guide, Artemis I reference guide and NASA pages; each number quoted with its source; values without a source marked ASSUMPTION |
| Capsules and landers | CSM, LM, Orion, Starship HLS, Blue Moon Mark 2 | `spacecraft.ts` | NASA and manufacturer sources per number; Starship HLS and Blue Moon mostly FALLBACK (Wikipedia only) or ASSUMPTION |
| Launchpads | KSC LC-39B and others | `pads.ts` | Wikipedia pages and The Space Devs per pad, as linked in the file |
| NRHO first guess | two L2 southern halo members | `nrho.ts` | JPL Three-Body Periodic Orbits catalogue, https://ssd-api.jpl.nasa.gov/periodic_orbits.api (query in the code) |
| Parking orbit, lunar orbit, descent perilune | 185 km, 100 km, 15 km | defaults in `mission.ts`, `missionNrho.ts` | source not recorded in the code (15 km noted as "15 for Apollo") |
| Entry Interface | 121.92 km (400,000 ft), −6.5° | defaults in `mission.ts` | source not recorded in the code for −6.5°; the NRHO test uses −5.66° with the source Rea, McNamara, Kane, "Orion Artemis I Entry Performance", https://ntrs.nasa.gov/citations/20240000024 |
| Timeline choices | capsule plane change 6 h before liftoff; 7 h 21 min from docking to TEI | `LOPC_BEFORE_LIFTOFF_H`, `DOCKED_BEFORE_TEI_H` | NASA SP-2000-4029, Apollo 11, 15, 16, 17 timelines (links in `mission.ts`) |

## Assumptions

- Earth and Moon are point masses in the transfer, except Earth's J2. No solar radiation pressure. The Moon's J2 is off in every plan (see [05-descent.md](05-descent.md)).
- The launch leaves out the Moon and the Sun ("change the ten minutes of an ascent by a few metres", comment on `earthJ2Field`). Not modelled in the launch: winds, lift, engine start-up and shut-down transients, heating, a limit on dynamic pressure.
- Perfect navigation and perfect burns: every solved burn is flown exactly. No midcourse correction is needed in the model, so none is budgeted, except the small outbound correction of the NRHO design.
- The NRHO's phase is chosen to suit the launch (the planner puts the NRHO's perilune 3.5 h before the flyby). The code says: "A real mission flies to an orbit whose phase is given and waits for a launch day that fits" (header of `missionNrho.ts`).
- The app's Artemis designs rendezvous in the NRHO. The Blue Moon entry in `spacecraft.ts` quotes NASA's page of 23 Oct 2026 that the plan now uses "an elliptical polar orbit" for that lander. The architectures were not changed tonight.
- Laying the lunar orbit beside the site at touchdown so that it is nearer at liftoff (as Apollo did), and entering lunar orbit with a plane change, are not done (header of `mission.ts`).

## ε and how it propagates

| Term | Size | Where it is measured |
|---|---|---|
| Earth-centred vs Moon-centred integration of the same 4.45-day free flight | < 10 km apart (5.4 km measured with the geometric correction, 73 km without, per the test comment) | `ephemeris.test.ts`, "a four-day free flight ends in the same place whether it is integrated Earth-centred or Moon-centred" |
| Re-flown translunar coast vs the planner's own flight | < 1 km at LOI ignition | `transfer.proof.test.ts`, "the re-flown translunar coast under the full Earth-centred field reaches the flown LOI ignition point" |
| Launch against Apollo 11 | stage cut-off times within 3 %; mass in orbit within 2 %; propellant left for TLI within 5 % of the 70,684 kg burned | `ascent.test.ts`, "matches the flown event times …", "matches the flown mass in orbit …" |
| Launch against Artemis I | MECO time within 2 %; speed at the flown MECO altitude within 0.5 %; max axial g within 1 % | `ascent.test.ts`, "matches booster separation and MECO of Artemis I …", "arrives with the flown speed" |
| TLI against the impulsive first guess | finite burn costs more, by less than 80 m/s | `transit.test.ts`, "the injection is a burn of minutes, not an instant, and costs a little more than the ideal impulse" |
| Artemis design against NASA mission-design numbers | Orion arrival, return and total within 10 % of 428.5, 411.5 and 840 m/s; lander NRHO → 100 km orbit within 5 % of 704.7 and 730 m/s, and back within 5 % of 730 m/s | `missionNrho.test.ts`, "costs what NASA publishes for Orion and for the lander [WHITLEY] [HLS]"; sources: Whitley & Martinez 2016, https://ntrs.nasa.gov/citations/20160003079; Mahajan & Condon 2022, https://ntrs.nasa.gov/citations/20230002566 |
| NRHO shape | perilune radius 3195–3557 km, apolune 70 005–71 849 km, 9:2 resonant period | `missionNrho.test.ts`, `nrho.test.ts` ("has the 9:2 resonant period [LEE]", "holds for at least six revolutions around the epoch, each inside the published ranges [DAVIS]") |
| Independent check of the integrator | a separate RK4 integration follows the planned injection, coasts and flybys | `numeric.test.ts`, `nrho.test.ts`, the tests named "an independent RK4 integration …" |

The published comparisons are for other dates and, for Whitley & Martinez, for an earlier candidate orbit; the test file says so and sets its tolerances to match (10 % for Orion, 5 % for the lander). The dominant error of a trajectory number is therefore the difference between this model mission and a real one (dates, orbit phase, navigation, correction burns, the vehicle data), not the integration. **Not quantified:** a Δv or propellant uncertainty per phase for the trajectory. The dispersion analysis ([07-dispersion.md](07-dispersion.md)) covers the descent only, and the uncertainty budget for numbers shown in the app is in [uncertainty.md](uncertainty.md).

## Tests that check it

Proof tests written tonight for task P1 (`app/src/flight/transfer.proof.test.ts`), on the DE440 ephemeris of August 2027, south polar site, KSC pad:

| Test name | What it asserts |
|---|---|
| "the re-flown burn ends where the flown one did" | re-flying the TLI from the plan's own start lands within 50 m of the flown burn |
| "mass falls linearly with burn time at thrust / (g0·Isp), and the flown event reports that mass" | mass at every sample within 1 g of m₀ − ṁt; propellant is more than 40 % of the start mass |
| "the speed the engine adds, summed over the falling mass, is the rocket equation vₑ·ln(m₀/m₁)" | ∫F/m dt within 1 m/s of the rocket equation; the reported Δv equals it; a constant-mass model would be more than 500 m/s lower |
| "the same burn with the mass held at its ignition value misses the flown cut-off by thousands of km" | more than 500 m/s less at cut-off, more than 10 000 km off at LOI |
| "the re-flown translunar coast under the full Earth-centred field reaches the flown LOI ignition point" | < 1 km |
| "without the Sun, the same coast arrives kilometres off and passes the Moon at a different altitude" | more than 400 km off (811 km measured, per the comment in the file) |
| "without the Earth, the lunar orbit insertion burn ends in a measurably different orbit" | more than 0.15 km apart 4 h after LOI (0.35 km measured, per the comment) |

Measured values, as the tests printed them in a run on 15 Nov 2026 (the assertions are the thresholds in the table): the TLI burn lasts 290.8 s and the vehicle's mass falls from 132.0 to 61.6 t; ∫F/m dt gives 3149.3 m/s against 3148.9 m/s from the rocket equation; with the mass held constant the burn ends 933 m/s slower; the re-flown coast ends 270 m from the flown LOI ignition point after 5.26 days; without the Sun it ends 811.4 km off and passes the Moon 433.2 km up instead of 123.0 km; without the Earth the lunar orbit is 0.4 m off at LOI cut-off and 0.35 km off 4 hours later.

Proof sentences for the docs (task P1 (b), (c)): during every finite burn the vehicle's mass falls at thrust / (g₀·Isp): on the flown TLI it drops from 132.0 to 61.6 t and the speed gained matches the rocket equation (3149 m/s), where the same burn at constant mass ends 933 m/s slower; the transfer is integrated with the Sun and the Earth as third bodies: without the Sun the translunar coast ends 811 km from the flown point, and without the Earth the lunar orbit after insertion drifts 0.35 km in 4 hours (`transfer.proof.test.ts`).

Other tests:

| Test file | Test name |
|---|---|
| `sim.test.ts` | "keeps a circular orbit circular and closes it after one period"; "thrust in free space gives the rocket-equation delta-v and burns the right propellant"; "J2 turns the orbit plane at the textbook rate" |
| `ascent.test.ts` | "reproduces the U.S. Standard Atmosphere 1976"; "conserves energy and polar angular momentum when thrust and drag are off"; the Saturn V and SLS tests above; "a payload far too heavy for orbit throws AscentError" |
| `transit.test.ts` | "enters a near-circular 100 km lunar orbit whose plane passes over the landing site"; "reaches Entry Interface at the asked flight-path angle and lunar-return speed"; "a week after arriving the orbit is edge-on to the way home: the return exists but costs far more" |
| `mission.test.ts` | "lands on the asked point, soon after arriving, not before the earliest touchdown"; "the capsule path is continuous from liftoff to Entry Interface"; "comes home: Entry Interface at the asked angle" |
| `missionNrho.test.ts` | "is one chained, continuous mission from liftoff to Entry Interface at −5.66° [REA]"; "costs what NASA publishes for Orion and for the lander [WHITLEY] [HLS]" |
| `planeChange.test.ts` | "an Apollo 15 size turn costs what Apollo 15 paid: about 100 m/s for 3.5°" |
| `anySite.test.ts` | "latitude …°: near side, limbs and far side" (low lunar orbit design, latitudes −89.5° to 85° at four longitudes, four stays) and the halo orbit design on a sampled grid: every case returns a plan that lands on the point, brings the lander back and the capsule home; a stage short of propellant is reported in a note |

These tests show that the code computes what it is written to compute and that its results agree with flown and published missions within the stated tolerances. They are not a scientific validation.

## Validation status

- Not recorded in `docs/event/validation.md`: that file has no row for the flight physics.
- `BUILD_LOG.md`, 14 Nov 2026 20:59: on the science lead's statement "flight physics are validated", the "not validated" marker was removed from the Flight plan tab. The entry adds: "No entry was added to docs/event/validation.md: who validated the flight physics and against what is not recorded here."
- `app/src/data/validation.ts`: `VALIDATED = true` (14 Nov 2026, team decision); its comment says it is not a sign-off by the science lead.
- The P1 proof tests of tonight are tests, not a sign-off.
