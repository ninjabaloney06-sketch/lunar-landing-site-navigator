# How this app compares with the NASA tools

The first question a planner asks about a south-pole landing site is: at this spot, on these days, when is the Sun above the real terrain, and when can the lander see a ground station on Earth? Before the event we tried to answer it for Connecting Ridge, 14–28 Nov 2026, with JPL Horizons, NASA Moon Trek and LRO QuickMap: an automated run on 25 Oct 2026 and a timed run by a team member on 27 Oct 2026 ([notes, steps and screenshots](reference/existing-tools.md)). We did not get both answers from any one of them. This app shows Sun, Earth, terrain and stations together for one site and period.

Everything in the middle column is what we saw in those two runs, not a general statement about the tools.

| Question | What we observed | What this app does |
|---|---|---|
| Where are the Sun and Earth (azimuth, elevation) from the site? | Horizons answered it on 25 Oct: a 337-row hourly text table per body, Sun and Earth in separate runs, set up through four nested dialogs ([Sun result](reference/screenshots/02-horizons-sun-result.png)). On 27 Oct the observer search for "moon" offered observatories on Earth; the run ended with a table for an observatory in Ohio and one for Earth's centre, with no warning ([txt](reference/screenshots/h-horizons-sun-from-ohio.txt), [txt](reference/screenshots/h-horizons-moon-from-geocentre.txt)). | The observer is always the chosen point on the Moon, 1.75 m above the ground. Sun and Earth elevation are labelled on the bodies in the 3D view and drawn on a horizon chart with their paths over the period; times are UTC. Positions come from SPICE kernels (DE440s) in 30-minute steps. |
| Is the site in sunlight, given the terrain around it? | Horizons elevations are for an airless sphere with no terrain (result header, 25 Oct). QuickMap's time slider animated terrain shadows but gave no numbers ([time controls](reference/screenshots/08-quickmap-time-controls.png), 25 Oct). In Moon Trek the Sun Angle tool could not be driven to a result on 25 Oct ([tool](reference/screenshots/05-moontrek-sunangle-tool.png)), and on 27 Oct "Surface Lighting" asked for a Trek account ([screenshot](reference/screenshots/h08-moontrek-tools-need-account.webp)). | Each site has a terrain horizon in 720 directions, rays out to 300 km on the LOLA south-pole elevation models (20 m per pixel near the site, coarser further out). The app counts how much of the Sun's disc is above that horizon and shows lit and dark windows on a timeline, and the sunlit % for the dates. |
| Can the lander see Earth and a ground station? | Horizons gave Earth as a second run, and its "Earth" search pre-selected the Earth–Moon barycentre (25 Oct). We found no Earth tool in Moon Trek's tools menu ([menu](reference/screenshots/04-moontrek-tools-menu.png), 25 Oct) and no Earth geometry in QuickMap (25 Oct). | Line of sight from the site, over its terrain horizon, to five stations: DSN Goldstone, Madrid and Canberra, JAXA Usuda and Uchinoura, each with its minimum elevation. Shown as a station contact track and as station contact %. |
| How do I get to the site? | QuickMap read typed coordinates directly, the cleanest of the three, but its default projection called the site "outside of bounds" until we switched to a polar one ([screenshot](reference/screenshots/h10-quickmap-out-of-bounds.webp), 27 Oct). Moon Trek's search box searched its data catalogue, not place names ([screenshot](reference/screenshots/h07-moontrek-search-catalog.webp), 27 Oct). | A list of 18 south-pole sites; the details drawer names the source of each site's coordinates. The search also takes typed coordinates, and a point south of 80° S can be made the landing site. The answer and the horizon chart still work without WebGL. |
| Which site, or which dates, are better? | Not part of our test question; we did not test it. | A table of all sites with sunlit % and station contact % for the mission dates or a whole year, a side-by-side comparison of two sites or two periods, and a search for better dates at one site. |
| Can I take the numbers away? | Horizons saves its text table ("Download Results", 25 Oct). We got no numeric output from Moon Trek or QuickMap. | A CSV per site and period: lit and station contact windows with UTC start and end, plus the summary percentages. It does not export the azimuth and elevation series. |

## What this app adds

Each point is the right-hand column of the table above, in one place. It says what this app does, not that the other tools cannot do it in general.

- **One question, one answer.** Site, dates and stations are chosen once; the answer is one sentence and one timeline with sunlight and station contact together. In our runs the same question needed separate runs per body in Horizons and gave no number in the other two tools.
- **Terrain in the sunlight answer.** The Sun counts as up only when it is above the terrain horizon computed from the LOLA elevation model, in 720 directions around the site.
- **Earth stations.** Line of sight from the site over its terrain to five named ground stations, with the station's own elevation limit.
- **Comparison and search.** All sites in one table for the same dates, two sites or two periods side by side, a search for better dates, and a search for sites by what is nearby and by how much sunlight and station contact they must have.
- **The site as a place.** The 3D view from above and from eye level with the Sun and Earth where the calculation puts them, plus the points of interest around it with their sources.
- **Numbers to take away.** A CSV of the windows and summary values, and a link that reproduces the view.

## What the other tools do better

- Horizons takes any observer, any target and any date range and step, with many more output quantities. It is also our reference: our Sun and Earth positions were checked against it.
- QuickMap covers the whole Moon with LROC imagery and data layers, several projections and animated shadows on the terrain.
- Moon Trek has a large data catalogue (9359 layers in our 25 Oct run) and analysis tools we do not have, such as slope, elevation profiles, line of sight between points and 3D print files.

## Limits of ours

- South polar region only: the 18 prepared sites, plus custom sites south of 80° S. A custom site's horizon is computed in the browser on coarser terrain and marked approximate.
- Dates from 1 Nov 2026 to 31 Dec 2030 only. All data is precomputed; nothing is fetched live.
- Station contact means geometric line of sight to a station, not a working radio link. Station minimum elevations are generic values from the station documents; per-antenna horizon masks are not included.
- Results are for one eye height, 1.75 m above the ground.
- Validation ([status](event/validation.md#validation-status-15-nov)): validated by the science lead (statement of 15 Nov 2026; see record), covering every check, including the calculations built on 15 Nov; the record has no per-check line of what he compared. Before that, the comparison of our Sun and Earth positions with Horizons (V1, V2) was reported as passed on 14 Nov and the other checks were open. An independent recomputation by AI agrees with the app; that is not a sign-off by the science lead.
