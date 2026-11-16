# How far off could the landing be? Descent dispersion and the Moon's J2

**Stated as validated by the science lead on 15 Nov 2026 (no per-check sign-off; see [record](../event/validation.md#validation-status-15-nov)).** The dispersion analysis and the Moon's J2 term were built on 15 Nov 2026 (task P5). Every dispersion result carries `validated: false` (no per-check sign-off is written) and the marker text "stated as validated by the science lead on 15 Nov 2026 (no per-check sign-off; see record)" (`NOT_VALIDATED` in `app/src/flight/dispersion.ts`); the J2 constant carries the same statement in its comment (`J2_MOON` in `app/src/flight/sim.ts`).

The analysis flies the planned descent ([05-descent.md](05-descent.md)) again N times, 200 by default, with random errors in engine thrust, specific impulse, burn direction and launch time, in the Moon's gravity with its J2 term switched on. Output: a 1σ / 3σ tube around the descent path, the landing ellipse on the surface (km) and the spread of the propellant used. It runs in the web worker (`runDispersionRequest()` in `app/src/flight/planWorker.ts`) with progress after every run and can be cancelled.

**What it is the dispersion of.** Only the descent, from Descent Orbit Insertion (DOI) ignition to touchdown, and flown **unguided**: DOI and the braking burn keep their commanded lengths and steering and do not re-aim. The code says: "a real powered descent guidance re-aims the braking burn all the way down and lands far closer to its target. The numbers say how much the commanded flight depends on its errors, not how precisely a guided lander lands" (header of `dispersion.ts`). The translunar flight is not dispersed: an open-loop transfer without correction burns would give meaningless dispersions.

## Equations

### 1. The Moon's J2

`addJ2()` in `sim.ts`, added to the point-mass Moon of `moonField()` when `j2: true`:

```text
a_J2 = −(3/2) · J2 · μ_M · R_ref² / |r|⁵ · [ r·(1 − 5 s²) + 2 s |r| p ],     s = (r·p) / |r|
```

- `J2` — 203.3 × 10⁻⁶ (unnormalised); `R_ref` — 1738.0 km; `μ_M` — 4902.800118 km³/s²
- `r` — position relative to the Moon's centre, km, J2000 axes
- `p` — the Moon's spin axis: the MOON_ME z axis at the middle of the span, held fixed. The code comment: it "moves by a few hundredths of a degree in a month, and the GRAIL fields' principal-axis frame differs from MOON_ME by well under 0.1°"

J2 is **off in every plan the app shows** and on only in the dispersion runs (`DispersionOptions.j2`, default true) and in tests.

### 2. One run's errors

`drawPerturbation()`, one draw per run, Gaussian, in a fixed order:

```text
thrust scale  k_F   = 1 + σ_F · z₁
Isp scale     k_Isp = 1 + σ_Isp · z₂
DOI pointing      θ_DOI = σ_θ · (z₃, z₄, z₅)        rotation vector, rad
braking pointing  θ_BR  = σ_θ · (z₆, z₇, z₈)
launch slip       Δt    = σ_t · z₉                   s
```

- `z₁ … z₉` — standard normal deviates (Box–Muller on the seeded `mulberry32` generator; seed 1 by default, so a seed fixes every statistic exactly)
- one thrust and one Isp factor for both burns (the same engine)
- the terminal descent closes its own loop and gets no pointing error

### 3. One run

`replayDescent()` in `lunar.ts`: DOI and braking flown open loop with thrust `k_F · F`, Isp `k_Isp · Isp` and the commanded directions turned by θ. The braking burn is cut off early if it comes down to the switch height (the 100 m gate, or higher when it sinks faster than the terminal profile can stop from there); the terminal descent then lands on the point below where braking ended, with no knowledge of the site.

A launch slip Δt flies the same path Δt later, so in space nothing changes; on the surface the site has turned on by ω·Δt. The landing point relative to the site (`onSurface()`):

```text
d      = R_site · r̂_touchdown − S(t_td + Δt)
east   = d · ê,   north = d · n̂        (local east and north at the site at that instant)
```

So the tube shows thrust, Isp, pointing and J2; the landing ellipse shows all four errors.

### 4. Statistics

`dispersionSteps()`, over the runs that reached the surface:

```text
landing mean      (Ē, N̄)
covariance        C = 1/(n−1) · Σ [ (N − N̄)²  (N − N̄)(E − Ē) ; (N − N̄)(E − Ē)  (E − Ē)² ]
1σ ellipse        semi-axes √λ₁, √λ₂ of C; azimuth of the major axis from north toward east
3σ ellipse        three times the 1σ ellipse (Gaussian approximation)
radius 99.7 %     the empirical distance from the site containing 99.7 % of the runs
propellant        nominal, mean, sample σ, min, max; runs over the usable load counted
hard landings     runs touching down above 3 m/s
tube              at 64 instants from DOI to touchdown: mean offset and the 2×2 covariance of the offsets
                  across the nominal path → ring  center + mean + k·(σ_maj cos θ · a_maj + σ_min sin θ · a_min), k = 1, 3
```

A separate zero-error run in the J2 field gives the shift by J2 alone (`j2Only`).

## Inputs and their sources

| Input | Value | Where | Source given in the code |
|---|---|---|---|
| Moon J2 | 203.3 × 10⁻⁶ | `J2_MOON`, `sim.ts` | GRAIL gravity fields (Konopliv et al. 2014, Lemoine et al. 2013, Williams et al. 2014) as tabulated in https://en.wikipedia.org/wiki/Gravitation_of_the_Moon ("Selected coefficients") |
| J2 reference radius | 1738.0 km | `J2_MOON_REF_RADIUS_KM` | label of the GRAIL field GL0660B, https://pds-geosciences.wustl.edu/grail/grail-l-lgrs-5-rdr-v1/grail_1001/shadr/jggrx_0660b_sha.xml |
| Thrust σ | 1/300 (±1 % at 3σ) | `DISPERSION_SIGMAS.thrustFrac` | **ASSUMPTION** |
| Isp σ | 1/300 (±1 % at 3σ) | `DISPERSION_SIGMAS.ispFrac` | **ASSUMPTION** |
| Pointing σ | 0.05° per axis per burn (0.15° at 3σ) | `DISPERSION_SIGMAS.pointingRad` | **ASSUMPTION** |
| Launch-time σ | 1 s (3 s at 3σ) | `DISPERSION_SIGMAS.launchS` | **ASSUMPTION** |
| Runs, seed, tube instants | 200, 1, 64 | `DispersionOptions` defaults | choices of the code |
| The planned descent | per plan | [05-descent.md](05-descent.md) | as there |

For all four σ the code says: "every one is an ASSUMPTION of this file; no published dispersion of the modelled landers' engines was found. They are round numbers of the size commonly used in early mission studies and are meant to be replaced by sourced values." No study is cited for "commonly used".

## Assumptions

- The descent is flown open loop through DOI and braking. A guided lander lands much closer; this analysis does not estimate a guided landing ellipse.
- The errors are Gaussian and independent; one draw per run, constant over the run (no noise within a burn).
- J2 is the only gravity term beyond the point mass; mascons and higher harmonics are not modelled.
- The Moon's spin axis is held fixed over the span.
- The landing ellipse uses the 1σ covariance scaled by 3 for 3σ, which is exact only for a Gaussian spread; the empirical 99.7 % radius is reported beside it.
- The translunar flight, lunar orbit and ascent are not dispersed.

## ε and how it propagates

This calculation is the propagation: Monte Carlo instead of partial derivatives, for the descent only.

Worked example 1, `dispersion.test.ts`: Apollo LM, 100 km polar orbit, site at 89.5° S, the test ephemeris (Moon on a circular orbit), N = 200, seed 1. The test asserts these to 7–9 decimals:

| Quantity | Value |
|---|---|
| 1σ landing ellipse | 0.730 × 0.296 km, long axis at 177.7° from north |
| Propellant | mean 6,949.2 kg, σ 42.2 kg |

The same run, as the test printed it on 15 Nov 2026: 200 of 200 runs flown; mean landing offset 4.63 km (−0.12 km east, 4.63 km north); 99.7 % of runs within 6.73 km; nominal propellant 6,768.2 kg, range 6,777.8–7,081.4 kg; no hard landing, touchdown 0.50 m/s; J2 alone, flown open loop, moves the touchdown 4.66 km north and costs 156.8 kg (the test asserts 4 to 5.5 km); widest 1σ of the tube across the path 0.522 km.

Worked example 2, `planWorker.test.ts`: the worker on a real plan (Apollo, KSC, site 89.5° S 0°, earliest touchdown 16 Aug 2027, DE440), N = 200, as printed on 15 Nov 2026: 1σ 0.734 × 0.296 km, mean offset 4.63 km; propellant 6,768 kg nominal, 6,950 ± 43 kg; J2 alone 4.68 km and 157.7 kg; no hard landing.

What these numbers say:
- **Dominant term of the landing offset: J2, flown without re-aiming.** The mean offset (4.6 km) is almost all the J2 shift of a plan made without J2 and flown in J2 gravity; the scatter around it, from the four assumed errors, is 0.73 × 0.30 km (1σ).
- **J2 re-planned is negligible for the plan itself:** re-planned with J2, the same descent still lands on the point and its propellant changes from 6,768.2 to 6,769.0 kg, touchdown 1.2 s later (`moonJ2.test.ts`, printed on 15 Nov 2026; the test asserts less than 1 %). The 4.7 km and 157 kg above are what an unguided lander would pay for ignoring J2, not an error of the plan.
- **Sampling error of the statistics:** the test "the sample statistics converge: N = 50 and N = 200 agree within their sampling error" uses the standard error of a σ estimate, about σ/√(2N) (5 % at N = 200), and asserts N = 50 and N = 200 agree within 30 % on σ and within 3 standard errors on the mean propellant.
- **Not quantified:** how the result depends on the assumed σ values (the output scales with them, but no sensitivity is computed); the dispersion of a guided descent; the effect of mascons.

The uncertainty budget for numbers shown in the app, which uses these results for the landing error, is in [uncertainty.md](uncertainty.md).

## Tests that check it

| Test file | Test name | What it asserts |
|---|---|---|
| `app/src/flight/moonJ2.test.ts` | "is off unless asked for: the default field is the one with j2 false, value for value" | plans keep the point-mass Moon |
| `app/src/flight/moonJ2.test.ts` | "adds 3/2 J2 μ R²/r⁴ of pull over the equator and takes 3 J2 μ R²/r⁴ away over the pole" | the formula (0.396 mm/s² at 100 km over the equator, printed) |
| `app/src/flight/moonJ2.test.ts` | "turns the node of a 100 km, 45° orbit at the rate −3/2 n J2 (R/a)² cos i" | integrated −0.851°/day against −0.849°/day from first-order theory (printed); asserted within 5 % |
| `app/src/flight/moonJ2.test.ts` | "re-planned with J2 the descent still lands; its propellant changes by the amount logged" | miss < 10 m; propellant change < 1 % |
| `app/src/flight/dispersion.test.ts` | "without errors repeats the planned descent to the last bit" | the replay is exact |
| `app/src/flight/dispersion.test.ts` | "a 1 % stronger engine, flown open loop, still comes down, somewhere else, with another propellant use" | errors move the result |
| `app/src/flight/dispersion.test.ts` | "is seeded (the same seed gives the same numbers) and standard normal" | the random numbers |
| `app/src/flight/dispersion.test.ts` | "zero σ without J2 reproduces the planned descent exactly in every run" | no hidden error source |
| `app/src/flight/dispersion.test.ts` | "N = 200 with the default σ and J2: seeded statistics, every output marked not validated" | the seeded values above, J2 shift 4 to 5.5 km, marker in every output, tube 64 points starting with zero spread |
| `app/src/flight/dispersion.test.ts` | "the sample statistics converge: N = 50 and N = 200 agree within their sampling error" | convergence |
| `app/src/flight/planWorker.test.ts` | "disperses the descent of the plan just computed: progress after every run, then one reply with the marker" | 200 progress messages; the nominal propellant is the plan's DOI + PDI propellant |
| `app/src/flight/planWorker.test.ts` | "stops when asked between runs and says it was cancelled" | cancellation |

The header of `dispersion.test.ts` says what these tests check: "the machinery (exact reproduction, seeded statistics, convergence), not that the σ values are right; those are assumptions."

## Validation status

- **Stated as validated by the science lead on 15 Nov 2026 (no per-check sign-off; see record).** `docs/event/validation.md`, section "Validation status 15 Nov", records his statement of 15 Nov 2026, 08:50, in chat with the build session: "validated everything means EVERYTHING", including what was built on 15 Nov. It does not say what was compared against what for this calculation; no per-check sign-off is written in `validation.md`. The record before the statement, unchanged:

- Before the statement: **not yet validated by the science lead**: the J2 term, the dispersion method and all four σ values. Then stated in the code (`dispersion.ts`, `sim.ts`) and carried by every result.
- Not recorded in `docs/event/validation.md`.
- The science lead's statement of 14 Nov 2026 20:59 on the flight physics (`BUILD_LOG.md`) predates these calculations and does not cover them.
