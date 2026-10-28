# Data guide (Phase 1: what exists, where, under which terms)

Inventory of the ephemeris kernels, elevation products and illumination/visibility maps we would use. Nothing has been downloaded — sizes were read from HTTP HEAD requests and directory listings on 24 Oct 2026 (downloads are phase 2, need Isaac's approval, and go to the data computer per AGENTS.md).

## 1. NAIF SPICE kernels (generic kernels, all URLs verified 200)

| Kernel | URL | Size (HEAD, exact bytes) | Version / coverage | Role |
|---|---|---|---|---|
| `de440s.bsp` | [naif.jpl.nasa.gov/.../planets/de440s.bsp](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp) | 32,726,016 (~31 MB) | DE440, 26 Dec 1849 → 22 Jan 2150 (per [NAIF aa_summaries.txt](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/aa_summaries.txt): "MOON (301) w.r.t. EARTH BARYCENTER (3)") | Sun + Earth + Moon positions |
| `naif0012.tls` | [naif.jpl.nasa.gov/.../lsk/naif0012.tls](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls) | 5,257 | latest LSK in the [lsk directory](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/) | leap seconds (UTC↔TDB) |
| `pck00011.tpc` | [naif.jpl.nasa.gov/.../pck/pck00011.tpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc) | 131,226 | latest generic text PCK in the [pck directory](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/) | planetary constants (radii; orientation for bodies not covered by binary PCKs) |
| `moon_pa_de440_200625.bpc` | [naif.jpl.nasa.gov/.../pck/moon_pa_de440_200625.bpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc) | 12,863,488 (~12.3 MB) | DE440 lunar orientation (created 2020-06-25; `.cmt` comments file alongside) | Moon attitude, MOON_PA frame |
| `moon_de440_250416.tf` | [naif.jpl.nasa.gov/.../fk/satellites/moon_de440_250416.tf](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf) | 19,478 | current Moon frame kernel (Apr 2025); defines MOON_PA (31000), MOON_ME (31001) and the fixed rotation between them | frame definitions — required, see [primer](primer.md) |

- Set logic: DE440 ephemeris + DE440 lunar orientation + matching frame kernel. A newer planetary SPK exists (`de442.bsp`/`de442s.bsp`, listing dated 6 Feb 2025, coverage 31 Dec 1549 → 25 Jan 2650 per the same summaries file), but the [pck directory](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/) holds **no** `moon_pa_de442` binary PCK yet — so the DE440 set remains the current matched set. Legacy alternative: `moon_080317.tf` (21,437 bytes, verified) + `moon_pa_de421_1900-2050.bpc`.
- Background reading: [NAIF Frames Required Reading](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/frames.html), [NAIF PCK Required Reading](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/pck.html).
- **License/usage:** no license files in the NAIF `pub` tree; NASA media guidance applies (attribute NASA/JPL/Caltech; see [NASA Images and Media](https://www.nasa.gov/nasa-brand-center/images-and-media/)). Record in `data/SOURCES.md` at download time.

## 2. LOLA south-pole elevation products (PGDA)

**Main product — [PGDA product 90, "A New View of the Lunar South Pole from LOLA"](https://pgda.gsfc.nasa.gov/products/90)** (Barker et al. 2023, Planet. Sci. J. 4, 183, [DOI 10.3847/PSJ/acf3e1](https://iopscience.iop.org/article/10.3847/PSJ/acf3e1), CC BY 4.0):

- Elevation models (LDEM) at **10, 20, 30, 40, 60, 80, 120, 240 m/pixel**, covering latitude bands **60°S–90°S, 75°S–90°S, 80°S–90°S, 83°S–90°S**; the paper's reference product is "the 80°–90° 20 m pixel⁻¹ south polar LDEM".
- Projection/frame, quoted from the product page: cloud-optimized GeoTiffs "with south polar stereographic X/Y coordinates in meters and in the **MOON_ME reference frame of the JPL DE421 ephemeris**"; from the paper: "All the LOLA polar products use a stereographic projection centered at the pole in the MOON_ME frame of the JPL ephemeris DE421". Elevation referenced to 1737.4 km.
- Example sizes: `LDEM_80S_20MPP_ADJ.TIF` listed "2.6G" on the page — HEAD-verified **2,696,082,051 bytes** at [pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF); finest DEM `LDEM_83S_10MPP_ADJ.TIF` "4.8G"; point clouds `LDEM_80S_ADJ.XYZI` "13G", `LDEM_60S_ADJ.XYZI` "48G". Also slope maps, roughness maps and PSR maps (TIF/CSV/shapefile).
- **License/usage:** "Please cite this paper when using these products" — Barker et al. 2023 + data DOI **10.60903/gsfcpgda-lola-spole**. No explicit open license on the page; record the citation requirement in `data/SOURCES.md`.

**Finer grids near key sites (5 m):** the LOLA gridded data records step up near the pole — "20 m grid spacing at absolute latitudes greater than 80°, 10 m grid spacing at [greater than 85°], and 5 m spacing above 87.5°" ([Beyer et al. 2025, PSJ 6, 236, CC BY 4.0](https://iopscience.iop.org/article/10.3847/PSJ/ae061a); the same paper notes "90% of pixels in the 5 m gridded product being interpolated"). The LROC team likewise worked with "the LOLA 5 meter/pixel DTMs of the corresponding landing sites" ([LPSC 2024 #1775](https://www.hou.usra.edu/meetings/lpsc2024/pdf/1775.pdf)). The canonical 5 m files live in the PDS LOLA archive; exact product paths to be pinned by the device agent in phase 2 — archive root: [PDS Geosciences, LRO LOLA RDR](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/).

## 3. Enhanced 5 m topography for the 13 Artemis regions (SDEM)

[PGDA product 104, "Enhanced Topography Models for Selected Lunar South Pole Regions with Shape-from-Shading"](https://pgda.gsfc.nasa.gov/products/104): "5 m/pix Shape-from-Shading digital elevation models (SDEMs)" over "the 13 original Artemis III Candidate Landing Regions announced in 2022" (>4,500 km²), derived from LROC NAC images and "retain[ing] consistency with the LOLA geodetic reference".
Archive: [Zenodo record 17954508](https://zenodo.org/records/17954508) — **CC-BY-4.0**, version 1.0.0 (16 Dec 2025), **26.6 GB**, 32-bit compressed GeoTIFFs in ZIPs + README. Paper: Bertone et al., [DOI 10.3847/PSJ/ae5b70](https://doi.org/10.3847/PSJ/ae5b70). Citation of the paper required by the PGDA usage policy.

## 4. Published illumination and Earth-visibility maps (Mazarico et al.)

[PGDA product 69, "Lunar Polar Illumination"](https://pgda.gsfc.nasa.gov/products/69) — LOLA-derived maps for both poles: average solar illumination (18.6-year average, hourly steps), permanent shadow, **average Earth visibility** ("the Earth is considered visible if any part of its disc is not obscured"), sky visibility; bands 65°–90° and 75°–90° at 240 and 120 m/px, 85°–90° at 60 m/px.
Projection (quoted): "Polar stereographic, with a reference radius of 1737.4 km and true scale at the pole." Formats: PDS IMG, GeoJPEG2000, GeoTIFF, cloud-optimized GeoTIFF (COG note dated 2025-03-20). Hosts: [MIT imbrium extras](http://imbrium.mit.edu/EXTRAS/ILLUMINATION/), [PDS Geosciences extras](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/) (releases 2011/2014/2016 + readme_illumination_2016.txt, verified in the directory listing), and PGDA for TIF/COG.
**License/usage:** "Please cite the Mazarico et al. (2011) reference below when using the LOLA illumination maps" — Mazarico, E., et al. (2011), "Illumination conditions of the lunar polar regions using LOLA topography," Icarus 211, 1066–1081, doi:10.1016/j.icarus.2010.10.030 (the publisher page blocks automated checks; the citation is quoted from the verified PGDA page).

## 5. Global gridded LOLA (optional context)

[PGDA product 95, "LOLA MOON_PA gridded dataset"](https://pgda.gsfc.nasa.gov/products/95): global cylindrical LOLA shape at 64 ppd (~0.5 km/px) and 128 ppd (~250 m/px), netCDF/GMT and GeoTIFF, MOON_PA(DE421), reference radius 1737.4 km. Example: [LDEM128_PA_pixel_202405.grd](https://pgda.gsfc.nasa.gov/data/LOLA_PA/LDEM128_PA_pixel_202405.grd), HEAD-verified 2,792,908,233 bytes (~2.7 GiB). Usage: cite Neumann (2024), doi:10.60903/LOLA_PA. Not needed if the polar products suffice.

## Download planning (phase 2, nothing fetched now)

| Item | Size | Notes |
|---|---|---|
| 5 SPICE kernels above | ~45 MB total (45,745,465 bytes) | small; also copy to laptops |
| LDEM 80°S–90°S 20 m/px COG | 2.7 GB | reference DEM for horizon masks |
| LDEM 83°S–90°S 10 m/px | 4.8 GB (listed) | optional finer band |
| Illumination/visibility maps (PGDA/PDS) | sizes not listed on page; per-file sizes to be read in phase 2 | validation reference |
| SDEM archive (only if needed) | 26.6 GB | largest item; decide at the event |

USB-stick and disk planning should assume ≥ 35 GB for the full set. All downloads need Isaac's per-action approval and `data/SOURCES.md` entries (URL, version, size, checksum, license, path) per AGENTS.md.

## Candidate review — 28 Oct 2026

Reviewed on ninja's Mac; no dataset downloads. Exact raster sizes below were rechecked with HTTP HEAD (all returned 200 with raster/binary content types). PDS labels were read as metadata, not saved. This review narrows the full inventory above; it does not select project sites or approve downloads.

| Candidate | Size and coverage | Projection / reference | Usage terms and recommendation |
|---|---|---|---|
| [Adjusted 20 m DEM](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF) | 2,696,082,051 B; 80–90°S | COG; south polar stereographic, MOON_ME/DE421 ([PGDA 90](https://pgda.gsfc.nasa.gov/products/90)) | Product page requires Barker et al. 2023 and provides data DOI 10.60903/gsfcpgda-lola-spole; no explicit product license found. Recommended baseline |
| PDS 5 m polar grid + [label](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.lbl) | IMG 1,840,545,792 B; label 4,990 B per 25 Oct checklist; 87.5–90°S, V2.0 | Polar stereographic; planetocentric, east-positive, ME/polar axis of DE421, reference sphere 1737.4 km (label) | No explicit license in label; NASA mission-data default discussed below. Recommended to have available, with S checking suitability |
| PDS 10 m grid + [label](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_85s_10m.lbl) | IMG 1,840,545,792 B; label 4,993 B per 25 Oct checklist; 85–90°S, V2.0 | Same PDS conventions as the 5 m grid | Same usage status. Optional if the eventual sites need finer coverage outside the 5 m cap |
| [Adjusted 10 m DEM](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_83S_10MPP_ADJ.TIF) | 5,116,709,568 B (5.12 GB / 4.77 GiB); 83–90°S | Same COG/frame conventions as adjusted 20 m product | Same PGDA citation requirement. Defer; distinct from the smaller, older PDS 10 m product |
| [Regional SDEMs](https://zenodo.org/records/17954508) | 26,559,680,857 B total across archive files (Zenodo API); 13 original 2022 regions, 5 m grids | Compressed 32-bit GeoTIFF; Moon (2015) South Polar Stereographic per record | CC BY 4.0 confirmed in [record metadata](https://zenodo.org/api/records/17954508); cite Bertone et al. per [PGDA 104](https://pgda.gsfc.nasa.gov/products/104). Defer; partial regional coverage does not replace the broad DEM |

License interpretation: the [NASA Science Data Portal](https://science.data.nasa.gov/about/license) states CC0 as the default for NASA-led mission data unless a restrictive notice/license is supplied. Applying that default to the PDS LOLA mission products is an inference; the individual labels contain no explicit license. Record both the policy basis and the product citation/attribution, and recheck the archive's notices at download time. Do not confuse the paper's CC BY license with a dataset license. PGDA's citation instructions remain recorded separately.

Data limitations for S's review: the PDS labels explicitly describe interpolated grids; a 5 m pixel is not proof of 5 m measured terrain detail. Their height conversion is DN × 0.5 m; adding 1,737,400 m gives planetary radius, not height. The [published illumination/Earth maps](https://pgda.gsfc.nasa.gov/products/69) are long-period averages and use any visible part of Earth's disc: compare only compatible intervals/visibility definitions, not a short-window Earth-centre result directly against their percentages.

**Selected by ninja, 28 Oct 2026:** the existing checklist's 5.1 GB required set (20 m + 5 m terrain, SPICE, reference maps). With its optional PDS 10 m pair and PSR map: ~7.0 GB. A 16 GB USB stick is enough for those sets; the ≥35 GB estimate above applies to the much larger inventory including the SDEM archive. The 5.1 GB set is selected; optional rows are excluded from this selection. Downloads still need a target machine/path and per-action approval. S must resolve frame conventions before computation.
