# Getting down: powered descent from lunar orbit to the site

The descent is flown, not estimated. `planDescent()` in `app/src/flight/lunar.ts` integrates the lander from undocking in lunar orbit to touchdown on the chosen point, with the engine on during each burn and the vehicle's mass falling as propellant is burned. Every burn is a run of the integrator in `app/src/flight/sim.ts`; there is no velocity jump anywhere in the descent (header comment of `lunar.ts`).

Phases, as named in the plan: Undocking → Descent Orbit Insertion (DOI) → coast to perilune → Powered Descent Initiation (PDI) and braking → terminal descent from a gate 100 m above the site → touchdown.

## Equations

### 1. Equations of motion

`integrate()` in `sim.ts`, an adaptive Dormand–Prince 5(4) scheme. State: position r (km), velocity v (km/s), mass m (kg), in Moon-centred J2000 axes.

```text
dr/dt = v
dv/dt = a_grav(r, t) + F(t) / m
dm/dt = −ṁ,      ṁ = F_max · throttle / (g₀ · Isp)
```

- `F` — thrust vector, N (divided by m and by 1000 to give km/s²)
- `ṁ` — propellant flow, kg/s; `F_max` — full vacuum thrust of all engines of the module; `Isp` — vacuum specific impulse, s
- `g₀` — 9.80665 m/s²

Step control: relative tolerance 1e-10 by default; a step with an error estimate that is not a finite number ≤ 1 is rejected (`!(err <= 1)`).

### 2. Gravity during the descent

`moonField()` in `sim.ts` — the Moon as a point mass, Earth and Sun as third bodies with the indirect term:

```text
a_grav = −μ_M · r/|r|³
         − μ_E · [ (r − r_E)/|r − r_E|³ + r_E/|r_E|³ ]
         − μ_S · [ (r − r_S)/|r − r_S|³ + r_S/|r_S|³ ]
```

- `μ_M` — 4902.800118 km³/s²; `μ_E` — 398600.435507 km³/s²; `μ_S` — 132712440041.279419 km³/s²
- `r_E, r_S` — Earth and Sun relative to the Moon's centre, km, from the flight ephemeris through a table with cubic interpolation (`makeBodyTable`, `nbody.ts`)

The field is evaluated at the lander's position at every integrator stage, so the Moon's pull follows μ/r² with altitude: from 1.452 m/s² at 100 km to 1.624 m/s² at the surface (μ_M / (1837.4 km)² and μ_M / (1737.4 km)²).

Optional J2 term (`addJ2()`, same formula as for Earth):

```text
a_J2 = −(3/2) · J2 · μ_M · R_ref² / |r|⁵ · [ r·(1 − 5 s²) + 2 s |r| p ],     s = (r·p)/|r|
```

- `J2` — 203.3 × 10⁻⁶; `R_ref` — 1738.0 km; `p` — the Moon's spin axis (MOON_ME z axis at the middle of the span, held fixed)

**J2 is off in every plan the app shows** (`MoonFieldOptions.j2`, default false). It is on only in the dispersion runs ([07-dispersion.md](07-dispersion.md)) and in the tests that measure its effect.

### 3. Descent Orbit Insertion

A retrograde burn half a revolution before the landing that lowers perilune to the descent-orbit altitude (default 15 km above 1737.4 km, `pdiAltKm` in `mission.ts`). Its length is solved on the integrated orbit so that the perilune comes out exactly at that height; its time is moved until the braking burn that starts at perilune ends over the site.

### 4. Braking (PDI to the gate)

One burn at a constant throttle setting, steered by a linear tangent law in the local frame (header of `lunar.ts`):

```text
thrust direction ∝ −ĥ + (a + b·t)·r̂ + (c + d·t)·n̂
```

- `ĥ` — local horizontal along the flight; `r̂` — up; `n̂` — orbit normal; `t` — time since ignition, s
- six unknowns (a, b, c, d, burn length, ignition time), solved by Newton shooting on the integrated flight so that at the gate (100 m above the site) the lander is over the site, has no horizontal speed relative to the turning surface, and sinks at the speed the terminal phase starts with
- `c, d` steer out the cross-range when the site is off the orbit plane, up to 30 % of the burn's arc (`MAX_CROSS_FRACTION`); beyond that the descent is refused

The code comment calls this "the form the optimal thrust direction takes for a transfer of free range in a uniform gravity field (the bilinear tangent law with its range multiplier zero)". It is a steering law of that textbook family flown in the full field, not an optimum proven for the real field. Throttle: full thrust, unless the engine is so strong that the short burn wastes propellant; then the setting that leaves the most mass at the gate (golden-section search, `bestThrottle`).

### 5. Terminal descent (gate to touchdown)

Throttleable engine (`designTerminal()`, `terminalEngine()`): a constant-deceleration profile of sink rate against height, flown in closed loop.

```text
w_ref(h)   = −√( w_td² + 2·a_d·h )
a_up       = a_d·(w/w_ref) + K_V·(w_ref − w)
a_side     = −K_P·(horizontal offset) − K_D·(horizontal velocity)
a_cmd      = a_up·û + a_side − g(r)
a_d        = ½·(lowest + 1)·a_max − g,     lowest = max(throttle_min, 1.15·g / a_max)
```

- `w` — vertical speed relative to the site, km/s (negative = sinking); `h` — height above the site, km
- `w_td` — touchdown sink rate, 0.5 m/s (`TOUCHDOWN_SPEED_KMS`)
- `K_V = 1.5 /s`, `K_P = 1 /s²`, `K_D = 2 /s` (`KV`, `KP`, `KD`)
- `a_max` — full thrust over the mass at the gate; `g` — local gravity, used only to design the profile (evaluated once near the gate); the flight itself uses the full field `g(r)` at every step
- thrust is clipped to the engine's range: `F = min(F_max, max(throttle_min·F_max, m·|a_cmd|))`

Fixed-thrust engine: the burn length T at full thrust is solved from

```text
L(t) = v_e · ln( m₀ / (m₀ − ṁ t) )
F(T) = h_gate − h_cut − w_cut·T + ½ g T² + v_e·T − (m₀/ṁ)·L(T) = 0
w_gate = w_cut + L(T) − g·T
```

with cut-off at a sink rate of 0.2 m/s planned 0.1 m above the ground (`CUTOFF_SINK_KMS`, `CUTOFF_HEIGHT_KM`); the lander then drops (the code comment gives about 0.6 m/s at touchdown).

### 6. Reported Δv and propellant

```text
Δv_burn  = v_e · ln( m_before / m_after ),   v_e = g₀ · Isp       (dvOf)
propellant used = m_undock − m_touchdown
```

`Δv` here is the rocket-equation equivalent of the propellant actually burned in the integrated flight, gravity and steering losses included. It is not an impulsive Δv.

Lower bound shown for comparison (`idealDvKms`): a Hohmann ellipse from the orbit's apolune down to the surface radius and a stop there, less the speed of the turning surface:

```text
Δv_ideal = √(μ(2/r_a − 1/a)) − √(μ(2/r_a − 1/a_down)) + √(μ(2/r_s − 1/a_down)) − |v_site|
a_down   = (r_a + r_s)/2
```

### 7. Propellant check

`planDescent()` throws "Not enough propellant for the descent" when the propellant used exceeds the usable load. In a full mission plan (`mission.ts`) the descent is planned with unlimited propellant (`propellantKg: landerMass`); the comment there says "a shortfall is reported, not thrown": what the flight takes is compared with what the tanks hold later in `mission.ts`.

## Inputs and their sources

| Input | Value | Where | Source given in the code |
|---|---|---|---|
| μ of the Moon, Earth | 4902.800118, 398600.435507 km³/s² | `MU_MOON`, `MU_EARTH` in `astro.ts` | JPL DE440, https://ssd.jpl.nasa.gov/astro_par.html |
| μ of the Sun | 132712440041.279419 km³/s² | `MU_SUN` in `nbody.ts` | JPL DE440, same page |
| Moon reference radius | 1737.4 km | `R_MOON` | "the app's reference sphere" (the DEM's sphere) |
| g₀ | 9.80665 m/s² | `G0` | standard gravity; no source named in the code |
| Moon J2, reference radius | 203.3 × 10⁻⁶, 1738.0 km | `J2_MOON`, `J2_MOON_REF_RADIUS_KM` in `sim.ts` | GRAIL fields (Konopliv et al. 2014, Lemoine et al. 2013, Williams et al. 2014) as tabulated in https://en.wikipedia.org/wiki/Gravitation_of_the_Moon; radius from the GL0660B label, https://pds-geosciences.wustl.edu/grail/grail-l-lgrs-5-rdr-v1/grail_1001/shadr/jggrx_0660b_sha.xml |
| Earth and Sun positions | flight ephemeris | `FlightEphemeris` (`flight/ephemeris.ts`) | built from the same SPICE-derived data as [01-sunlight-horizon.md](01-sunlight-horizon.md) |
| Apollo LM descent stage | dry 4,483 lb; propellant loaded 18,184 lb; DPS thrust 9,870 lb; Isp 305 s; throttle 10 % to full | `apollo-lm` in `spacecraft.ts` | NASA SP-2000-4029 (Apollo by the Numbers), NASA TN D-7143, NASA TM X-58040, Apollo 11 Mission Report; each figure quoted in the comment above it |
| Apollo LM ascent stage | dry 4,804 lb; propellant 5,238 lb; APS 3,500 lb fixed; Isp 309.4 s | same | same sources, quoted per figure |
| Other landers (Starship HLS, Blue Moon Mark 2) | per `spacecraft.ts` | `SPACECRAFT` | mostly values marked FALLBACK (Wikipedia only) or ASSUMPTION; the file says to "treat what the simulators compute for them as an illustration, not as a prediction" |
| Descent-orbit perilune | 15 km | `pdiAltKm` default in `mission.ts` | comment "(15 for Apollo)" in `lunar.ts`; no document cited for the value |
| Lunar parking orbit (Apollo design) | 100 km circular | `lunarOrbitAltKm` default in `mission.ts` | source not recorded in the code |
| Gate height, touchdown sink rate, cut-off values, loop gains, 30 % cross-range limit | 100 m; 0.5 m/s; 0.2 m/s at 0.1 m; K_V 1.5, K_P 1, K_D 2; 0.3 | constants in `lunar.ts` | "Design constants (choices of this planner, not facts about a vehicle)" |

## Assumptions

- The surface is a sphere through the site at 1737.4 km: the mission puts the site on the reference sphere (`site()` in `mission.ts`), so the terrain height of the site and the terrain under the approach are not used. `lunar.ts` lists terrain under "Not modelled".
- The Moon is a point mass in every plan shown (J2 off; no mascons, no higher harmonics).
- The thrust direction follows the steering law at once; attitude dynamics are not modelled. Isp does not change with the throttle setting. One main engine per module; no reaction control system.
- The DPS could not run between 60 % and its fixed throttle position; the data contract has one continuous range, 10 % to full (comment in `spacecraft.ts`).
- The braking phase brakes at full thrust down to the gate. Apollo 11 throttled down after 386 s and flew a slow piloted approach (comment in `lunar.ts`, citing the Apollo 11 Mission Report 5.3 and 9.8.1), so a flown mission needs more than the planner's descent.
- Guidance is perfect: the shooting solution is flown exactly. Errors in thrust, Isp, pointing and timing are the subject of [07-dispersion.md](07-dispersion.md).

## ε and how it propagates

| Term | Size | Where it is measured |
|---|---|---|
| Integrator, gravity only | radial fall in a point-mass field matches v² = 2μ(1/r − 1/r₀) to 7 decimals (km/s) | `sim.test.ts`, "stops exactly at an event" |
| Integrator, mass loss | free-space burn: mass and Δv equal the rocket equation (4 and 8 decimals) | `sim.test.ts`, "thrust in free space gives the rocket-equation delta-v and burns the right propellant" |
| Gravity model actually used | every field evaluation of a flown descent within 1e-4 of μ/r² (the rest is Earth and Sun tides) | `descentGravity.proof.test.ts` |
| Shooting tolerance at the gate | 1 cm in position, 0.02 mm/s in velocity | `POS_TOL_KM`, `VEL_TOL_KMS` in `lunar.ts` |
| Landing accuracy of the planned flight | miss < 10 m, touchdown < 1 m/s, last 50 m within 1 m of the vertical | `expectLanded()` in `lunar.test.ts` |
| Against Apollo 11 | DOI within 15 % of 76.4 ft/s; powered descent between 85 % and 100 % of the 6,775 ft/s Apollo 11 used; total DOI + powered within 8 % of the impulsive lower bound | `lunar.test.ts`, "lands on the point, softly, with a descent close to the documented one" |
| Planner vs impulsive bound, Apollo LM from 110 km | 1833 m/s against 1726 m/s, +6.2 % (code comment; the test asserts < 8 %) | header of `lunar.ts` |
| Point-mass Moon vs Moon with J2, re-planned | propellant changes by less than 1 % (asserted); printed on 15 Nov: 6768.2 → 6769.0 kg, touchdown 1.2 s later | `moonJ2.test.ts`, "re-planned with J2 the descent still lands; its propellant changes by the amount logged" |

Measured values, as the tests printed them in a run on 15 Nov 2026 (the assertions are the bounds in the table): Apollo LM from a 110 km equatorial orbit — DOI 21.6 m/s (Apollo 11: 23.3 m/s), powered descent 1811 m/s in 472.6 s (Apollo 11: 2065 m/s in 756.39 s), miss 1.3e-5 m, touchdown at 0.50 m/s, 1249 kg of propellant left, total 1833 m/s against the impulsive bound of 1726 m/s (+6.2 %). In the μ/r² proof: 63 274 field evaluations, largest deviation from μ/r² 8.93e-6, and the constant-g descent needs 64.9 m/s and 178 kg more.

Dominant error of the descent numbers: **the model, not the arithmetic.** The integrator matches closed-form cases to many decimals and the shooting closes to 1 cm at the gate; what moves the result is what is left out — terrain, the Moon's gravity beyond the point mass, a real (piloted, throttled-down) final approach, and the lander data itself. Of these, only J2 is quantified (above, and in [07-dispersion.md](07-dispersion.md)). **Not quantified:** the effect of mascons and higher harmonics, of the real approach profile, and of the uncertainty of the lander masses and Isp on the descent propellant (the payload method states σ for dry mass and Isp, see [06-payload.md](06-payload.md)). The uncertainty budget for numbers shown in the app is in [uncertainty.md](uncertainty.md).

## Tests that check it

| Test file | Test name | What it asserts |
|---|---|---|
| `app/src/flight/descentGravity.proof.test.ts` | "every field evaluation of the flown descent equals μ/r² at that radius, from orbit down to the surface" | an Apollo LM descent from a 100 km polar orbit to −89.5° is flown from above 99 km to the surface; more than 1000 field evaluations; each within 1e-4 of μ/r²; evaluated at both ends of the range; g at the top more than 10 % below g at the surface |
| `app/src/flight/descentGravity.proof.test.ts` | "the same descent in one constant g (the value at orbit altitude) needs a measurably different burn" | with the Moon's term replaced by a constant g the powered-descent Δv differs by more than 30 m/s (1806.2 against 1871.1 m/s in the comment: 65 m/s) |
| `app/src/flight/lunar.test.ts` | "lands on the point, softly, with a descent close to the documented one" | Apollo LM against Apollo 11 figures, see the ε table |
| `app/src/flight/lunar.test.ts` | "lands, stays 6.5 days while the Moon turns under the orbit, and returns" | polar orbit, site at −89.5°, Earth and Sun in the field: lands on the first pass, cross-range < 0.5° |
| `app/src/flight/lunar.test.ts` | "single stage, throttleable engine: lands and returns"; "single stage, fixed-thrust engine: one burn timed to end just above the ground, then a drop of 0.1 m"; "an engine four times stronger: …"; "too little thrust to land is reported, not flown" | landers defined only by data |
| `app/src/flight/lunar.test.ts` | "0.5° and 2° of cross-range are steered out during the braking burn"; "a site 20° off the plane is refused with a clear message" | cross-range handling |
| `app/src/flight/lunar.test.ts` | "descent: a half-empty descent stage is refused" | the propellant check fires |
| `app/src/flight/sim.test.ts` | "thrust in free space gives the rocket-equation delta-v and burns the right propellant" | mass falls at F/(g₀·Isp) |
| `app/src/flight/moonJ2.test.ts` | "is off unless asked for: the default field is the one with j2 false, value for value" | plans keep the point-mass Moon |
| `app/src/flight/moonJ2.test.ts` | "adds 3/2 J2 μ R²/r⁴ of pull over the equator and takes 3 J2 μ R²/r⁴ away over the pole" | the J2 formula |
| `app/src/flight/moonJ2.test.ts` | "turns the node of a 100 km, 45° orbit at the rate −3/2 n J2 (R/a)² cos i" | integrated nodal rate within 5 % of first-order theory |

Proof sentence for the docs, from the test above (task P1 (a)): the descent is integrated in the Moon's gravity μ/r², evaluated at the lander's position at every step; from 100 km down to touchdown it rises from 1.452 to 1.624 m/s², and the same descent flown in one constant g needs 65 m/s more braking (`descentGravity.proof.test.ts`).

These tests show that the code computes what it is written to compute. They are not a scientific validation.

## Validation status

- **Validated by the science lead (statement of 15 Nov 2026; see record).** `docs/event/validation.md`, section "Validation status 15 Nov", records his statement of 15 Nov 2026, 08:50, in chat with the build session: "validated everything means EVERYTHING", including what was built on 15 Nov. It does not say what was compared against what for this calculation; no per-check sign-off is written in `validation.md`. The record before the statement, unchanged:

- Not recorded in `docs/event/validation.md`: that file has no row for the flight physics.
- `BUILD_LOG.md`, 14 Nov 2026 20:59: on the science lead's statement "flight physics are validated", the marker "Planning estimate — not validated" was removed from the Flight plan tab. The same entry says: "No entry was added to docs/event/validation.md: who validated the flight physics and against what is not recorded here."
- `app/src/data/validation.ts`: `VALIDATED = true` (14 Nov 2026, team decision after the independent recomputation by AI of the sunlight and contact results); its comment says it is not a sign-off by the science lead.
- The three P1 proof tests of tonight (`descentGravity.proof.test.ts`, `transfer.proof.test.ts`) are tests, not a sign-off.
- The Moon's J2 term: before the statement, **not yet validated by the science lead** (comment on `J2_MOON` in `sim.ts`, now citing the statement). It is off in every plan.
