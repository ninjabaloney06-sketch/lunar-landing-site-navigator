# Scientific proof

One file per calculation the app makes. Each has the same six parts: the equations as the code computes them, the inputs with their sources, the assumptions, the uncertainty ε and how it propagates, the tests that check it, and the validation status as recorded. Every equation and constant is cited to the file and function that implements it, so a reader can check the text against the code.

| File | Calculation |
|---|---|
| [01-sunlight-horizon.md](01-sunlight-horizon.md) | Terrain horizon from LOLA elevation data, Sun direction, sunlit % |
| [02-earth-visibility-contact.md](02-earth-visibility-contact.md) | Earth above the skyline; line of sight to DSN and JAXA stations |
| [03-ranking-score.md](03-ranking-score.md) | Site search order and the landing-window finder |
| [04-trajectory.md](04-trajectory.md) | Launch, translunar transfer, lunar orbit, return |
| [05-descent.md](05-descent.md) | Powered descent from lunar orbit to the site |
| [06-payload.md](06-payload.md) | Maximum payload and the cheapest route |
| [07-dispersion.md](07-dispersion.md) | Monte Carlo dispersion of the descent, the Moon's J2 |
| [uncertainty.md](uncertainty.md) | Uncertainty budget for every number shown in the app |

## How to read the validation status

Three records exist, and they say different things. Each file quotes them as they are.

- `docs/event/validation.md` is the record of the checks V1–V9 and the station, horizon-range and truncated-horizon checks. On 14 Nov 2026, V1 and V2 (Sun and Earth directions against JPL Horizons) were reported passed in chat, with no written sign-off by the science lead in the repository; every other check there is open. It has no row for the flight physics.
- `app/src/data/validation.ts` sets `VALIDATED = true`. That was a team decision on 14 Nov 2026, after an independent recomputation by AI agreed with the app. The file says it is not a sign-off by the science lead.
- `BUILD_LOG.md`, 14 Nov 2026 20:59, records the science lead's statement that the flight physics are validated. The same entry says the statement was not entered in `validation.md` and that who validated the flight physics, and against what, is not recorded.

Calculations built on 15 Nov 2026 — maximum payload, the cheapest route, the Moon's J2 term and the descent dispersion — are **not yet validated by the science lead**. The proof tests written the same night (gravity varying with altitude, mass loss during burns, Sun and Earth as third bodies) are tests, not a sign-off.

A passing test shows that the code computes what it was written to compute. It is not a scientific validation.

## Points of interest

Point coordinates and facts come from the cited research sources and are not individually checked by the science lead. The app's computed results (sunlight, Earth visibility and station contact, ranking, flight) carry the validation status recorded in the files above; most of those checks are still open.
