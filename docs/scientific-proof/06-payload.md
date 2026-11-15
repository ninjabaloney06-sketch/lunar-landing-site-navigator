# How much cargo reaches the surface? Maximum payload and the cheapest route

**Not yet validated by the science lead.** Both calculations in this file were built on 15 Nov 2026 (tasks P2 and P3). Every result carries the marker `{ validated: false, text: 'not yet validated by the science lead' }` (`NOT_VALIDATED` in `app/src/flight/payload.ts`).

- **Maximum payload** (`maxPayload()`): for a mission already planned, the largest cargo the lander can set down when every element carries exactly the propellant the flight needs plus a stated reserve.
- **Cheapest route** (`cheapestRoute()`, `planCheapestRoute()`): among the options the planner already offers (landing day within a window, transfer type, orbit design), the plan that burns the least propellant in total, and why it wins.

Both are a layer over finished plans of `planMission()` / `planMissionNrho()` (`04-trajectory.md`, `05-descent.md`); they do not fly anything new, except the launch, which is flown twice to measure its sensitivity.

## Equations

### 1. Extra propellant of one burn

The plan gives, per burn, the Δv the flight needed (integrated, losses included) and the element that fired it. Holding each burn's Δv fixed, the rocket equation burn by burn makes every element's propellant an affine function of the cargo mass X (header and `propagate()` in `payload.ts`):

```text
r_i  = exp( Δv_i / (g₀ · Isp_i) )
Δp_i = (r_i − 1) · q_i                         element loaded to need
Δp_i = (r_i − 1) · q_i / r_i                   firing tank loaded as planned (upper stage, kept full)
Δp_i = s · q_i                                 the launch
```

- `Δv_i` — the plan's Δv of burn i, km/s (converted to m/s); `Isp_i` — vacuum specific impulse of the firing engine, s; `g₀` — 9.80665 m/s²
- `Δp_i` — extra propellant burn i takes, kg
- `q_i` — extra mass left after burn i, kg (below)
- `s` — extra upper-stage propellant burned in the launch per kg of payload, kg/kg (`ascentSensitivity()`)

The extra mass after a burn:

```text
q_i = X                               while the cargo is aboard
    + extra dry mass of every module in the stack (only in the ε terms)
    + Σ over tanks in the stack of the change in what is still in that tank:
        need-loaded tank:   f · U_t + U_t,plan − L_t,plan + (extra of the later burns from this tank)
        fixed-load tank:    − (extra already burned from this tank)
U_t = U_t,plan + Σ Δp from tank t
```

- `X` — cargo, kg. In the Apollo (low lunar orbit) design it rides from liftoff to touchdown; in the halo-orbit design it is loaded on the lander at undocking in the NRHO. It stays on the surface.
- `f` — reserve fraction, 0.03
- `U_t,plan, L_t,plan` — what tank t burned and was loaded with in the plan, kg

Because each tank's load depends on its later burns, `propagate()` iterates backward over the burns until no Δp changes by more than 1e-7 kg (at most 200 passes).

### 2. Launch sensitivity

`ascentSensitivity()` flies the ascent twice due east from the pad's latitude into the parking orbit, with the plan's payload and with 1000 kg more:

```text
s = ( m_upper,left(P) − m_upper,left(P + 1000 kg) ) / 1000 kg
```

- `m_upper,left` — propellant left in the launch vehicle's upper stage at orbit insertion, kg (`simulateAscent()`, `ascent.ts`)

### 3. The limit

`solve()` evaluates the chain at X = 0 and X = 1 kg. Every constraint is affine in X:

```text
propellant:  (1 + f) · U_t(X) ≤ C_t       for every tank t that the cargo affects
thrust:      F_lander ≥ 1 · (m_touchdown + Δm(X)) · g_M
X_max = the smallest X at which one constraint becomes tight
```

- `C_t` — tank capacity, kg; `F_lander` — full thrust of the descent engines, N
- `g_M` — μ_M / R², 1.6242 m/s² on the 1737.4 km sphere (`G_MOON`)
- `m_touchdown` — the plan's mass at touchdown; `Δm(X)` — the extra mass after the last descent burn

Verdicts: `payload` (a number); `extrapolated` (cargo above 30 % of the lander's mass at undocking, beyond the checked range); `short` (an element the cargo rides with lacks propellant even with no cargo); `undetermined` (short, but only against a capacity that is a lower limit).

### 4. Uncertainty ε of the payload

One-at-a-time partial derivatives, 1σ each, combined as a root sum of squares (`maxPayload()`):

```text
δX_dry,m  = | X_max(dry_m + σ_dry,m) − X_max |
δX_isp,t  = | X_max(Isp_t · (1 − σ_isp,t)) − X_max |
δX_losses = 0.06 · |X_max|
ε         = √( Σ δX² )
```

- `σ_dry` — 1 %, 10 % or 30 % of the dry mass for a value stated by NASA or the builder, by Wikipedia only, or assumed by the app (`DRY_MASS_SIGMA`)
- `σ_isp` — 0.5 %, 1 % or 3 % of Isp for the same three grades (`ISP_SIGMA`)
- `0.06` — `LOSS_MODEL_FRACTION`: the fixed-Δv chain does not see that a heavier lander burns longer and loses more to gravity; this term covers that

The largest term is reported as the dominant one.

### 5. Cheapest route

`routeSummary()` and `cheapestRoute()`:

```text
total propellant = Σ over every burn of the plan, the launch included, kg
rank: plans with no shortfall first; then by total propellant (shortfall plans by their shortfall)
why   = per phase, winner minus other: Δv (km/s) and propellant (kg); negative = the winner needs less
tie   ⇔ runner-up − winner < 0.005 · (winner's propellant from TLI on)
```

When the runner-up is a tie, the comparison also names the first clearly costlier option and the phases that make the difference.

## Inputs and their sources

| Input | Value | Where | Source given in the code |
|---|---|---|---|
| Reserve | 3 % of what each element needs | `PROPELLANT_RESERVE_FRACTION` | **ASSUMPTION**; compared with Apollo 11's descent stage, which consumed 17,414 of 18,184 lbm loaded (4.2 % left): NASA SP-2000-4029, Apollo 11 summary, https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm |
| Dry-mass and Isp σ per grade | 1 / 10 / 30 % and 0.5 / 1 / 3 % | `DRY_MASS_SIGMA`, `ISP_SIGMA` | **ASSUMPTION** |
| Grade of each module | Apollo CSM, LM, Orion: agency; Starship HLS: dry mass assumed, Isp from Wikipedia; Blue Moon Mark 2: both from Wikipedia, capacity a lower bound | `MODULE_GRADES` | read from the comments in `spacecraft.ts` |
| Loss term | 6 % of the cargo, 1σ | `LOSS_MODEL_FRACTION` | calibrated in `payload.test.ts` on the Apollo LM only (5.4 % with 1 t of cargo, 6.5 % with 3.2 t); one-sided, the code says the real figure is lower |
| Checked range | cargo ≤ 30 % of the lander's mass | `MAX_CHECKED_CARGO_FRACTION` | the range the tests re-plan |
| Touchdown thrust-to-weight | ≥ 1 | `MIN_TOUCHDOWN_THRUST_TO_WEIGHT` | physics: below 1 a vertical descent cannot be stopped |
| Tie threshold | 0.5 % of the propellant burned from TLI on | `ROUTE_TIE_FRACTION` | **ASSUMPTION** |
| Route options | days of a window × transfers: minimum energy, at most 4.5, 4, 3.5, 3, 2.5 days | `ROUTE_TRANSFER_CHOICES` | the Flight panel's choices |
| Hardware: capacities, dry masses, Isp, thrust | per element | `spacecraft.ts`, `launchVehicles.ts` | as quoted there; see `04-trajectory.md` |

## Assumptions

- Each burn's Δv is the planned one; the heavier craft is not re-flown. The loss term stands in for the difference.
- Every element is loaded with need × 1.03, so propellant the plan carried but did not burn becomes room for cargo. The launch vehicle's upper stage stays full, as launch vehicles fly.
- The cargo stays on the surface and does not come back.
- In the halo-orbit design the lander's own launch, its trip to the NRHO and its refuelling are not part of the plan. The cargo "is loaded on the lander where it waits in the halo orbit … how it gets there … is not part of the plan" (assumptions list in `maxPayload()`). Totals of the two designs therefore count different things; `cheapestRoute()` adds a caveat when it compares them.
- Structure, volume and centre of mass of the cargo are not modelled; only propellant and thrust limit it.
- Starship HLS: its dry mass is an assumption of the app, so its payload is "an illustration, not a prediction" (caveat in the code). SpaceX's own figure, "up to 100 tons directly to the lunar surface" with on-orbit refilling, is quoted next to it.
- Blue Moon Mark 2: its 29,000 kg propellant is a lower bound (more than 45 t fuelled minus 16 t dry; `propellantStatus` in `spacecraft.ts`), so a shortfall against it cannot be decided from this data.

## ε and how it propagates

Worked example, `payload.test.ts`: Apollo (Saturn V, CSM, LM), KSC LC-39B, Connecting Ridge (89.46° S, 136.68° W), earliest touchdown 16 Aug 2027, 3-day stay, minimum-energy transfer. Values as the test printed them in a run on 15 Nov 2026:

| Quantity | Value |
|---|---|
| Launch sensitivity s | 0.801 kg of upper-stage propellant per kg of payload |
| Maximum payload | 3,173 kg ± 196 kg (1σ) |
| Limited by | the Descent Stage: 8,008 kg used + 240 kg reserve = its 8,248 kg capacity |
| Dominant term | extra gravity losses of the heavier lander, 190 kg |
| Next terms | ascent stage dry mass ±1 %: 41 kg; descent stage dry mass ±1 %: 20 kg; descent engine Isp ±0.5 %: 10 kg; all others ≤ 1 kg |
| Propellant per phase, plan → at maximum payload | TLI 71,317 → 71,082 kg; LOI 10,090 → 9,573 kg; descent 6,768 → 8,008 kg; lunar ascent 2,072 → 1,865 kg; TEI 4,701 → 3,587 kg |
| Check by re-planning with 3,173 kg of cargo | the planner burns 8,088 kg in the descent against the chain's 8,008 kg (80 kg more, inside 1σ) |

The same run for the halo-orbit designs:
- Starship HLS: `extrapolated`, 1,154 t ± 115 t, limited by its 1,600 t tank; dominant term its assumed dry mass ±30 % (91 t). Far outside the checked range; the ICPS is short by 0.9 t even with no cargo, which limits the mission, not the cargo.
- Blue Moon Mark 2: `undetermined`, bound `lower`: even empty it would need 35,410 kg + 1,062 kg reserve against the 29,000 kg lower bound (raw figure −8,990 kg ± 4,422 kg; dominant term its dry mass ±10 %, 4,388 kg).

What ε covers and what it does not:
- Covered: dry masses and Isp of every module (with assumed σ by source grade), and the fixed-Δv approximation (calibrated on Apollo only).
- **Not covered:** the trajectory's own Δv uncertainty (navigation, correction burns, the real approach profile; see `04-trajectory.md` and `05-descent.md`), the launch sensitivity s, the reserve choice itself, and correlations between terms (the root sum of squares assumes them independent).
- The loss term is one-sided (the real figure is lower) but is added symmetrically to ε.

Cheapest route, worked example (`payloadRoute.test.ts`, same Apollo case, landing day 16–18 Aug 2027, minimum energy or at most 3 days; values printed on 15 Nov 2026): 16 Aug with a minimum-energy transfer wins; 17 Aug costs 6 kg more, below the 475 kg tie threshold, so it is a tie; the first clearly costlier option, 18 Aug with at most 3 days, needs 816 kg more, mostly in lunar orbit insertion (109 m/s and 1.2 t less for the winner).

The uncertainty budget for numbers shown in the app is in `uncertainty.md`.

## Tests that check it

| Test file | Test name | What it asserts |
|---|---|---|
| `app/src/flight/payload.test.ts` | "gives a positive payload with its uncertainty, the dominant term and the not-validated marker" | verdict `payload`, 0 < ε < payload, marker text present, under 50 ms |
| `app/src/flight/payload.test.ts` | "the launch costs the upper stage less than a kilogram per kilogram of payload" | 0.3 < s < 1 |
| `app/src/flight/payload.test.ts` | "at the maximum payload the limiting element holds exactly its reserve and none is over capacity" | limiting load = capacity; reserve = 3 % of use everywhere |
| `app/src/flight/payload.test.ts` | "every burn follows the rocket equation with its planned delta-v" | plan propellant = (r − 1) · mass after the burn |
| `app/src/flight/payload.test.ts` | "is no worse with the reserve set to zero, and more cargo needs more propellant everywhere it rides" | monotonic in f and X |
| `app/src/flight/payload.test.ts` | "re-planned with the cargo: the chain predicts what the planner burns (calibrates the losses term)" | with 1 t of cargo: S-IVB within 1 %; descent stage under-predicted by less than 1.5 × 6 % |
| `app/src/flight/payload.test.ts` | "re-planned at the maximum payload with the loads it gives: the limiting element is within ε of full" | the re-planned miss is below 2ε and below 1.5 × 6 % of the payload |
| `app/src/flight/payload.test.ts` | "artemis-starship", "artemis-blue-moon" (under "payload: Artemis landers waiting in the halo orbit") | marker present; cargo only on the lander; Blue Moon bound `lower` with the lower-limit caveat; Starship `extrapolated` with the "100 tons" caveat |
| `app/src/flight/payloadRoute.test.ts` | "every day of the window × every transfer, with stable keys and readable labels" | the options |
| `app/src/flight/payloadRoute.test.ts` | "ranks plans without a shortfall first, cheapest first, and names winner and runner-up"; "explains the win per phase: the differences add up to the total"; "calls a difference below half a percent of the propellant in space a tie and names the first clear one" | ranking on made-up plans |
| `app/src/flight/payloadRoute.test.ts` | "picks the plan with the least propellant and says why" | six real plans; the winner has the least propellant; per-phase differences add up to the total; marker present |

These tests check the method (the rocket equation over the plan's burns), not the hardware data, as the header of `payload.test.ts` says.

## Validation status

- **Not yet validated by the science lead.** This is stated in the code (`NOT_VALIDATED` in `payload.ts`, carried by every result) and in the header of `payload.test.ts`.
- Not recorded in `docs/event/validation.md`.
- The science lead's statement of 14 Nov 2026 20:59 on the flight physics (`BUILD_LOG.md`) predates these calculations and does not cover them.
