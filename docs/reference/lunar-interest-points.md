# Lunar points of interest — research and feature specification

Researched 14 November 2026. Requested scope: research and source-backed specification, no app implementation. AI-assisted synthesis; human science review: none. This is a catalogue of relevant **types and representative places**, not an exhaustive inventory of every lunar feature or a verified coordinate dataset. Proposed product rules below are our design decisions, not NASA requirements.

## Research catalogue

| Interest | Representative locations / evidence | Potential advantage of landing nearby | Qualification |
|---|---|---|---|
| Water ice | LCROSS detected water ice in material excavated from Cabeus. Orbital hydrogen evidence includes PSRs in Cabeus, Haworth, Shoemaker and Faustini. [LCROSS](https://www.nasa.gov/general/what-is-lcross-the-lunar-crater-observation-and-sensing-satellite/), [LRO research](https://science.nasa.gov/solar-system/moon/nasas-lro-lunar-ice-deposits-are-widespread/) | Sample preserved water; investigate its origins; prospect for future water, oxygen and propellant production. | A local detection does not establish the entire crater's composition. Hydrogen evidence is indirect. No extraction yield or mineable reserve established by these sources. |
| Cold traps / permanently shadowed regions | Shackleton interior and other polar PSRs. [Shackleton](https://science.nasa.gov/resource/shackleton-craters-illuminated-rim-shadowed-interior/) | Search for preserved volatiles and compare frozen material with illuminated soil. | Shadow is a thermal/geometric condition, not proof of ice. Access requires darkness and cold capability. |
| Other volatiles | LCROSS material at Cabeus included hydrogen, ammonia and methane. [LCROSS](https://www.nasa.gov/general/what-is-lcross-the-lunar-crater-observation-and-sensing-satellite/) | Investigate delivery and retention of volatiles; test separation and processing. | Do not copy Cabeus chemistry to every PSR. Useful compounds may be mixed with unwanted material. |
| Water in sunlit soil | SOFIA detected molecular water in sunlit Clavius terrain. [SOFIA](https://www.nasa.gov/news-release/nasas-sofia-discovers-water-on-sunlit-surface-of-moon/?linkId=102908392) | Study how water survives outside cold traps and changes with surface conditions. | Molecular water in soil is not a surface ice deposit or liquid reservoir. Clavius is a global-catalogue example, not automatically near the demo sites. |
| Water-bearing volcanic deposits | Hydration signatures in pyroclastic deposits, including near Apollo 15 and 17 regions. [Primary research](https://www.nature.com/articles/ngeo2993), [research team](https://www.brown.edu/news/2017-07-24/moonwater) | Sample volcanic glass to investigate water in the lunar interior and eruption history. | Spectral OH/H2O evidence must retain its original interpretation; no implied accessible ice. |
| Oxygen-bearing minerals and metals | Lunar regolith; local composition must come from mineral maps or samples. Laboratory extraction from simulated regolith demonstrates the concept. [ESA](https://www.esa.int/media/oxygen-and-metal-from-lunar-regolith) | Test oxygen production and metal recovery using local material. | Oxygen is chemically bound; processing needs equipment and energy. Generic regolith availability is not a unique site advantage. |
| Illuminated ridges | Shackleton rim and ridge between Shackleton and de Gerlache have favorable modeled illumination. [Illumination study](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/20170007365.pdf) | Potentially longer solar-power windows and shorter battery-supported gaps near polar science targets. | Recompute for exact coordinates, height and dates. Do not label a site permanently sunlit or substitute annual means for mission-window results. |
| Earth observation | Earth-facing locations with suitable target visibility; LEXI is an example of magnetospheric X-ray science from the Moon. [LEXI](https://svs.gsfc.nasa.gov/14739) | Observe Earth's magnetic environment and solar-wind interactions. | Depends on instrument field of view, target geometry and interference. Earth visibility is not proof of a working communications link. |
| Radio astronomy | Far-side sites shielded from terrestrial interference; LuSEE-Night demonstrates the science rationale. [NASA experiment](https://www.nasa.gov/solar-system/nasa-department-of-energy-join-forces-on-innovative-lunar-experiment/), [payload description](https://science.nasa.gov/lunar-science/clps-deliveries/cs-3/) | Observe low-frequency radio emission inaccessible to equivalent Earth-based measurements; investigate early-universe signals. | Requires appropriate receiver, power, interference control and relay communications. A shadowed south-pole crater is not automatically radio quiet. |
| Impact geology and ancient crust | Basin materials, crater ejecta, peak rings and contacts between mapped geological units. [USGS geologic map](https://astrogeology.usgs.gov/search/map/Moon/Geology/Unified_Geologic_Map_of_the_Moon_GIS_v2/), [NASA craters](https://science.nasa.gov/moon/lunar-craters/) | Sample different rock units to constrain impact history and crustal evolution. | Map units are areas; individual sampling targets need local imagery and geological interpretation. Global mapping is not traverse-scale validation. |
| Seismology and interior structure | Schrödinger basin is the Farside Seismic Suite target. [JPL](https://www.jpl.nasa.gov/missions/farside-seismic-suite/) | Measure moonquakes and impacts to investigate the lunar interior. | Seismic science can operate at a stationary lander; it does not require driving to a mapped quake epicentre. Local coupling and instrument configuration matter. |
| Unusual volcanism | Gruithuisen domes, suspected silica-rich volcanic structures. [NASA](https://science.nasa.gov/resource/a-lunar-mystery-the-gruithuisen-domes/) | Test how evolved lunar magma formed; compare dome and surrounding basalt composition. | Global-catalogue target; not a south-pole nearby feature. Composition and formation hypotheses must remain qualified. |
| Magnetic anomalies / swirls | Reiner Gamma, associated with localized magnetic fields. [NASA](https://science.nasa.gov/resource/lunar-swirl-reiner-gamma/) | Study solar-wind interaction, surface weathering and lunar magnetism. | No inference of safe human radiation shielding or usable magnetic protection. |
| Pits and possible caves | Mare Tranquillitatis pit; thermal observations and models suggest moderated temperatures in shaded portions. [NASA](https://www.nasa.gov/solar-system/nasas-lro-finds-lunar-pits-harbor-comfortable-temperatures/), [LROC atlases](https://lroc.im-ldi.com/atlases) | Study exposed layers and potential underground environments; investigate future shelter concepts. | A pit is not proof of a traversable cave or safe habitat. Access and structural stability remain separate questions. |
| Surface environment and engineering measurements | Regolith, dust, radiation, plasma and local thermal conditions. [NASA science priorities](https://science.nasa.gov/lunar-science/focus-areas/) | Characterize conditions affecting landing, mobility, instruments and future surface operations. | Usually an experiment opportunity at the landing site, not a special nearby POI; show only if relevant to the payload. |

Do not add helium-3 mining, commercial resource value, settlement capacity or guaranteed extraction as benefits without specific evidence and a credible mission objective. Historical spacecraft sites can be contextual markers, but proximity alone is not a landing advantage.

## Spatial data to obtain before calculating proximity

| Layer | Source | Use / limits |
|---|---|---|
| PSR footprints, slopes, roughness and elevation | [LOLA PGDA product 90](https://pgda.gsfc.nasa.gov/products/90) | Spatial screening and terrain context. Product includes PSR mapping. Preserve original frame, projection, resolution and citation; use existing data-guide frame notes. |
| Polar temperature and hydrogen evidence | [PDS LRO archives](https://pds-geosciences.wustl.edu/missions/lro/) — Diviner and LEND | Temperature is evidence of trapping conditions; neutron data constrain hydrogen. Neither alone is a local ice assay. Store footprint/resolution with each observation. |
| Surface composition / hydration | [Lunar Orbital Data Explorer](https://ode.rsl.wustl.edu/moon2/) and cited mineralogical papers | Select the actual archived product and documented interpretation before ingestion; a portal link alone is not dataset provenance. |
| Pits and PSR context imagery | [LROC atlases](https://lroc.im-ldi.com/atlases) | Feature identification and inspection; preserve credits and terms. Image context does not validate a driving route. |
| Geological units | [USGS unified map](https://astrogeology.usgs.gov/search/map/Moon/Geology/Unified_Geologic_Map_of_the_Moon_GIS_v2/) | Regional context and diversity of units; do not infer fine-scale hazards from the global map. |

No new dataset downloaded, coordinates invented, or feature polygons digitized in this research. Existing landing-site representative coordinates in `sources.md` are not coordinates of ice deposits. Source-page names are a shortlist for data preparation, not production POI records. Reuse terms must be recorded for each selected product/image before inclusion; article citations do not grant blanket image rights.

## Proposed nearby-interest infographic

**Question answered:** “What could this landing location enable, given this mission's dates and capabilities?” Keep the existing sunlight/communications answer primary. Put the infographic in the existing site details rather than adding another main-screen control.

Use one polar map with the selected landing marker, accurately mapped feature footprints and direct labels. Show a search-radius outline only when a radius is supplied; label it **distance filter**, not rover range or reachable area. Under the map, show the three most relevant supported benefits; expand to the full list. Each item contains:

- Feature name and category.
- Short benefit phrased as an opportunity: “Investigate preserved volatiles.”
- Evidence: direct measurement / remote observation / modeled condition / hypothesis; state what was measured, not a generic confidence percentage.
- Surface separation and whether it is to a point, footprint edge or approximate representative location.
- Access state, material limitation, source and observation date.

Example copy structure, deliberately without invented numbers:

> **Potential science near this landing site**
>
> [Mapped cold trap] — [computed distance] to mapped boundary
>
> Investigate preserved volatiles. Permanent shadow mapped; local ice abundance unknown. Access not assessed. [Source]

An ice-specific source must support stronger “ice detected” copy at its actual footprint. Do not render numerical placeholders in production. A shaded region with no detection remains “cold-trap candidate.” On mobile, use the same labeled map followed by a compact text list; keyboard/touch access must expose the same information as hover. Use plain text for states, semantic color only, no decorative scores or equal-sized icon-card grid.

## Proximity and reachability contract

Separate three questions: **nearby**, **reachable**, and **observable**. A radio-astronomy advantage is a property of the observing site, not a resource to drive toward.

1. Require landing coordinates with reference frame; optionally accept a landing uncertainty region. Transform all POI geometry into a compatible lunar frame. Missing/ambiguous frame blocks distance display.
2. Use lunar geodesic separation for the distance filter. For areas, measure to the closest mapped boundary (zero when inside), retaining the observation footprint's uncertainty. Label point-to-centre distances when only centres exist; do not represent them as access distances. Never use latitude/longitude Euclidean distance at the pole.
3. A proximity-only match says **Nearby; access not assessed**. No validated rover mobility profile means reachability is unknown. A fixed lander may measure locally or observe remotely; it cannot collect a distant sample merely because that sample is nearby.
4. **Modeled reachable** requires a terrain-aware route and explicit mission constraints: total traverse budget, one-way/return requirement, slope/roughness limits, power/thermal capability, time, illumination along the route and communications/autonomy requirements. Missing critical inputs yield unknown. Meeting a straight-line radius alone never satisfies this condition.
5. **Outside distance filter** is not equivalent to physically unreachable. **No mapped interests found** is not equivalent to no resources. Excluded or absent data must not become negative scientific evidence.
6. Observation opportunities need target visibility, instrument requirements and observing windows. Do not reuse rover-range logic or equate Earth visibility with station link availability.

Minimal static record: `id`, `name`, `category`, `geometry` (or null), `frame`, `locationUncertainty`, `evidenceType`, `measuredQuantity`, `benefit`, `limitations`, `requiredCapabilities`, `sources` (URL, publication/observation date, dataset version, resolution, credits/terms). Derived distances, access states and windows belong to the current query, not to permanent feature metadata. Unknowns remain null/explicit unknown, never zero. No backend or live LLM needed.

## Proposed event scope and acceptance

First release: verified south-pole PSR footprints, source-linked ice/volatile evidence, and existing exact-site/date sunlight and Earth visibility results. Keep global examples such as Reiner Gamma, Gruithuisen, Clavius and Tranquillitatis out of the nearby list unless their actual geometries satisfy the selected filter. Do not associate an entire polar crater with every polar landing site.

Acceptance checks for later implementation:

- Moving the landing point or changing the filter updates distances and matches; old values never remain under the new selection.
- A PSR without ice evidence says “cold-trap candidate,” not “water available.” A coarse hydrogen footprint cannot become a precisely located ice deposit.
- A nearby target across an unvalidated crater wall remains access unknown. A fixed lander gets no distant sample-collection claim.
- A footprint containing the landing point has zero boundary separation, but still retains its measurement uncertainty and access limitations.
- Longitude wrap and points near the pole return consistent lunar distances; missing frames produce unknown.
- Date changes update modeled operational/observation benefits while retaining the dates of static scientific measurements.
- No match, missing coverage, missing route model and out-of-filter results are distinguishable; every displayed benefit has a supporting source.
- Every data record receives science review; human geometry validation is required before displaying computed results as validated.

Research/specification complete. Implementation, geospatial catalogue creation, route calculations and human science sign-off are outside this deliverable.
