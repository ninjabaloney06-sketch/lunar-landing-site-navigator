# Lunar south pole landing sites and landing windows: data files

Generated 2026-11-14 from six Markdown research-note files (`research_notes/Mond Südpol Landeorte und Landefenster/`). All files are UTF-8 without BOM, in English, and each is a JSON object with `meta` (`description`, `generated`, `coordinate_convention`, `notes`) and `items` (array). Some files carry extra top-level keys, listed below.

| File | Contents | Items | Extra top-level keys |
|---|---|---|---|
| `candidate_regions.json` | Artemis candidate regions (13 of Aug 2022, 9 of Oct 2024, with list-membership flags), the Moon Base / Shackleton Connecting Ridge site, and literature point sites. LROC mosaic centres and bounds, centres computed from NASA Trek polygons, paper point sites. | 32 (17 regions, 1 Moon Base site, 14 point sites / features) | `meta.general_selection_criteria` |
| `illumination_sites.json` | One row per study-site-height: Glaeser 2018/2014, Mazarico 2011, Speyerer and Robinson 2013, Bussey 2010, Barker 2021 (per RoI at 1 m and 5 m), Wueller 2025/2026, De Rosa 2012 and others; Earth-visibility rows; VIPER working days. | 62 | none |
| `psr_and_ice.json` | LROC PSR Atlas (40 largest south-polar PSRs), Lemelin 2021 per-PSR evidence and access slopes (12), LEND maxima (4), host craters (19), per-location evidence matrix (16), per-instrument findings (18). | 109 | `lcross` (ground truth, impact points, abundances), `totals` (areas and counts, inventory estimates, age and supply, thresholds) |
| `missions.json` | Artemis I-V, HLS landers, programme milestones 2025-2026, Moon Base phases, flown and planned robotic missions, orbiters, relay systems; actual and intended landing coordinates; `secondary_source` flag. | 57 | none |
| `landing_constraints.json` | Numeric thresholds and constraints: lighting, Earth visibility, slope, latitude, stay length, NRHO and other orbit numbers, Orion limits, VIPER rules, ISRU criteria, study screening values, planetary-protection boundary, hazard distances. Each has a `status`. | 82 | `researcher_derived_rules` (5) |
| `time_tables.json` | Lunar eclipses 2026-2032 (plus later totals to 2040), researcher-derived south-polar solstice/equinox dates (`"derived_not_published": true`, with stated uncertainty), seasonal-shift statements, cycle lengths, launch-period examples, analysis epochs. | 72 (25 eclipses, 17 derived season cycles, 2 alternative derived lists, 10 seasonal statements, 14 cycle lengths, 2 launch-period examples, 2 analysis epochs) | none |
| `hazards_and_science.json` | Hazards (scarps with coordinates, seismic, terrain, regolith, plume, dust, radiation, micrometeoroids, thermal, lighting), science features with coordinates and ages, crater ages, astrobiology and microbial-survival findings with evidence labels, planetary-protection rules, published site rankings. | 78 | none |
| `datasets.json` | Dataset / API / SPICE kernel / library catalogue with `url_check` codes (V/L/P/X as in the notes), CORS and licence fields. | 212 | `algorithms` (23), `gaps` (34), `site_selection_statements`, `georeferencing_facts`, `download_bundles`, `cors_by_host`, `licence_statements`, `literature_dois`, `researcher_inferences` |

## General caveats

- **All values are copied from research notes dated 2026-11-14. They have not been independently validated.** Physics and coordinates need validation by the team's science lead before use.
- No new web research was done for these files and no value was estimated. Where the notes give no value, the field is `null` and a `caveat` says why.
- Coordinates are decimal degrees, south negative, longitude east-positive, given as `lon_east_180` (-180..180) and `lon_east_360` (0..360). Where a note gave only one form, the other was obtained by adding or subtracting 360; nothing else was computed.
- NASA has published no official centre coordinates or boundary files for the 13 or the 9 candidate regions. Region positions are LROC mosaic centres (LROC team product) or centres the researcher computed from NASA Trek polygons; both are approximate. Slater Plain has no coordinates at all.
- The south-polar solstice and equinox dates are the researcher's own calculation, not a published table. Two derivations exist in the notes (stated uncertainty about +/-1-2 days and about +/-5 days); both are kept. Verify with SPICE or JPL Horizons.
- Several cycle lengths (synodic month 29.5306 d, draconic month 27.2122 d, draconic year 346.62 d, libration amplitude) are textbook values the researcher supplied without a fetched source; they have `source_url: null`.
- Conflicting values for the same quantity are kept side by side with their sources (for example Cabeus centre, Chandrayaan-3 and IM-2 coordinates, PSR area totals, mission dates).
- Evidence labels from the notes are preserved: ESTABLISHED / MODEL / CONTESTED / SPECULATIVE (science and hazards), DIRECT / INDIRECT / MODEL / SPEC (ice), primary vs secondary source, and "derived by researcher".
- The NRHO-based Artemis III design (6.5-day stay, about 55 descent opportunities per year) was superseded in 2026. Those constraints are marked `superseded`; NASA has published no window numbers for the 2028 architecture.
- Many numbers in the notes come from abstracts, search-result excerpts or secondary sources because full texts were not accessible; this is flagged per item in `evidence` or `caveat`.
- `source_url` is a string or an array of strings. Items with `source_url: null` carry a `caveat`.
