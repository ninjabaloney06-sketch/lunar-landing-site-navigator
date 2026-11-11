# Inspiration: sky plots, lighting timelines, illumination maps, mission-planning tools

Agents copy good examples better than they invent — this is what we point them at on Saturday ([TASKS.md](../TASKS.md), phase 1). Copy **form and method only**: nothing of our app is designed or built before Sat 14 Nov 2026, 09:00 (prep rule in [AGENTS.md](../AGENTS.md), reasoning in [decisions.md](decisions.md)).

Site and data-product sources live in `docs/sources.md` and `docs/data-guide.md` (separate task) — this list is about visuals and tools. 19 entries, grouped. Links checked 2026-10-24 with `curl`; entries marked **(unverified)** sit behind bot blocks (WAF / captcha) that curl cannot pass — URL confirmed by web search, browser check still owed. Most tools here are client-side apps: judge them in a browser, not by curl (same as the challenge page).

## Saturday shortlist (agreed 8 Nov)

Show the UI agents only these six: sky plot #3, #1, #2; timeline #6, #13; benchmark #16. The rest is reference for S (#7–12, #14, #15) or pitch background (#17, #18).

## A. Polar sky plots (azimuth / elevation)

1. **Heavens-Above — satellite pass chart** — <https://heavens-above.com/PassSummary.aspx?satid=25544>
   The classic polar sky chart: horizon as the outer circle, zenith in the centre, a time-stamped track across it, next to a table of pass windows. Copy: the time stamps written along the track, and the start/max/end pass table as a compact timeline form.
2. **Stellarium** — <https://stellarium.org/>
   Desktop planetarium with an az/el grid and configurable ground ("landscapes" are just azimuth/altitude outlines). Copy: the landscape idea — a horizon mask is nothing more than an az/alt outline that hides everything below it.
3. **Andrew Marsh — 2D sun-path tool** — <https://andrewmarsh.com/apps/staging/sunpath2d.html>
   Interactive polar sun-path diagram: azimuth as angle, altitude as radius, many days' paths in one plot, draggable date and time. Copy: the ring/spoke labelling and the way everything below the horizon is shaded out.
4. **SunCalc** — <https://www.suncalc.org/>
   Map plus per-day sun path with hour marks and rise/set times. Copy: hour markers placed directly on the path, so "where is the sun at 14:00" reads instantly.
5. **MoonCalc** — <https://www.mooncalc.org/>
   The same idea for the Moon: azimuth/elevation through the day, moonrise and moonset listed beside it. Copy: pairing the polar path with an explicit rise/set list — that list is the daily window we care about.
6. **In-The-Sky — sky map** — <https://in-the-sky.org/skymap.php>
   Online planetarium with alt/az charts and visibility windows for sky events. Copy: the colour-coded visible / not-visible windows along a time axis.

## B. Illumination maps and lighting timelines

7. **Moon Trek (NASA/JPL)** — <https://trek.nasa.gov/moon/>
   JPL's lunar web GIS: pick a polar crater, pull illumination profiles (% lit vs. time) and elevation data. Copy: the illumination-profile-over-time chart — the "lighting timeline" shape in the wild. (Note: `moontrek.jpl.nasa.gov` no longer resolves; the tool lives at this URL.)
8. **LROC QuickMap (ASU)** — <https://quickmap.lroc.asu.edu/>
   LRO map client: permanently-shadowed-region and shadow layers, pole-centred stereographic view, measuring tools. Copy: layer toggles and the pole-centred disc — a polar site map is the site-picker cousin of a polar sky plot. (Redirects to `quickmap.lroc.im-ldi.com` — same tool.)
9. **PGDA — LOLA products (Goddard)** — <https://pgda.gsfc.nasa.gov/>
   LOLA archive: polar elevation grids (down to ~20 m/px) and published illumination maps for south-pole craters. Copy: how the published crater figures state "% time lit" with a colour bar, and the product-metadata discipline. Product URLs, versions, licences: see `docs/data-guide.md`.
10. **PDS Geosciences Node — LOLA archive** — <https://pds-geosciences.wustl.edu/missions/lro/lola.htm>
    The formal PDS archive of the same data, with volume documentation. Copy: the citation and version discipline (product IDs) — the rules require licence and version documented for every material.
11. **Mazarico et al. 2011 — Illumination of the lunar polar regions using LOLA topography** — <https://ui.adsabs.harvard.edu/abs/2011Icar..211.1066M/abstract> **(unverified: ADS bot-block)**
    The classic south-pole illumination study, including terrain masking from the elevation model. Copy: the horizon-mask method (maximum terrain elevation angle per azimuth) and figures that pair a polar map with per-site timelines.
12. **Speyerer & Robinson 2013 — Persistently illuminated regions at the lunar poles** — <https://ui.adsabs.harvard.edu/abs/2013Icar..222..122S/abstract> **(unverified: ADS bot-block)**
    Maps persistently lit regions from LROC imagery; the source of the "peaks of light" statistics. Copy: windows presented as connected lit periods per site, and the % lit table layout.
13. **Gläser et al. 2018 — Illumination conditions at the lunar poles: Implications for future exploration** — <https://ui.adsabs.harvard.edu/abs/2018P%26SS..162..170G/abstract> **(unverified: ADS bot-block; DOI [10.1016/j.pss.2018.07.006](https://doi.org/10.1016/j.pss.2018.07.006) resolves)**
    Illumination and Earth visibility at the poles, with horizon masks from topography. Copy: the combined sun-visible / Earth-visible / both presentation — the timeline grouping we would try; method inspiration only.
14. **LPI Lunar South Pole Atlas** — <https://www.lpi.usra.edu/lunar/lunar-south-pole-atlas> **(unverified: bot-blocked, curl 403; URL from LPI's own site)**
    Curated atlas: elevation, illumination, PSR and landing-site maps of the south pole with references. Copy: the one-glance layered map set and its per-site detail pages.
15. **NASA SVS — Moon Phase and Libration** — <https://svs.gsfc.nasa.gov/gallery/moonphase/>
    Annual visualisation of the Moon through the year, including the libration wobble. Copy: the intuitive way to *see* libration — why Earth hovers low over the pole instead of sitting still.

## C. Mission-planning tools and context

16. **JPL Horizons web app** — <https://ssd.jpl.nasa.gov/horizons/app.html>
    Authoritative ephemerides; observer-table mode gives Sun/Earth az/el for a lunar-surface point — the external check for our geometry at the event. Copy: the clean settings → table flow as the "10-second answer" benchmark; the [manual](https://ssd.jpl.nasa.gov/horizons/manual.html) documents the exact quantity definitions to cite when validating.
17. **NASA — Commercial Lunar Payload Services (CLPS)** — <https://www.nasa.gov/commercial-lunar-payload-services>
    The customer side: which CLPS landers fly, to which sites, carrying which payloads. Copy: the mission list as the pool of candidate sites for the demo (checked, sourced coordinates go in `docs/sources.md` — this entry is for knowing the missions).
18. **ESA Moonlight** — <https://www.esa.int/Applications/Connectivity_and_Secure_Communications/Moonlight>
    ESA's lunar communications and navigation constellation programme. Copy: the comms context — why direct-to-Earth gaps at the poles matter and what relay satellites would change; good pitch background.

## D. 3D viewers (checked 11 Nov in a real browser)

19. **Our Solar System — 3D orrery (Polyxmedia)** — <https://3dsolarsystem.online/viewer/#/iss>
    Three.js/WebGL 2 orrery: drag to rotate, scroll to zoom, click to select; a time panel (Now, presets, 0.01x–1000x, "drag to move up to a week either way"); a "Walk on the Moon" mode at the Apollo 15 site. Measured on ninja's Mac, 11 Nov: ~96 MB transferred on first load (108 requests, 24 MB ISS model, 8 MB cloud texture), 1.2 MB of JS, canvas rendered at device-pixel-ratio 2.
    Fit for us: **form only, not data or code.** The page itself says its telemetry is "scene-derived, not JPL Horizons ephemeris yet", so none of its positions may be used or cited; it is a commercial product (paid VR unlock), so no code or assets are reusable. Copy: the time-scrubber panel (drag ± a week, preset jumps, speed buttons) — the closest example yet of the "time scrubber" gap in decisions.md (10 Nov); and drag-to-orbit as the camera control if a 3D view survives the spec interview. Do not copy: the payload — on a weak laptop a 3D view has to stay a few MB (one low-res lunar texture, no models, DPR capped at 1).
    Out of scope noted on 11 Nov: ninja suggested an "optimal route" between user-entered start and end coordinates. The challenge asks for site and date evaluation (Sun/Earth vs. horizon, power, direct-to-Earth comms), not traverse planning; custom coordinates are already "Not planned" (decisions.md, 10 Nov). Both go to the Saturday 10:30 spec interview as cut-list candidates, not as prep work.

---

If a link is dead or a tool behaves badly in the browser, write it down — the device-agent tool test in TASKS.md phase 1 turns those pain points into the pitch.
