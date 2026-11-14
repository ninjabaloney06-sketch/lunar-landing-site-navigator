# NASA (and partner) datasets, APIs, formats and algorithms for lunar south-pole landing-site and landing-window apps

**Method note (read first).** All URLs below were fetched directly (HTTP GET/HEAD or directory listing) on **2026-11-14** unless marked otherwise. Verification codes used in tables:

- **V** = the exact URL was fetched and returned HTTP 200 with the stated byte size.
- **L** = the file name and byte size were read from an archive directory listing fetched on 2026-11-14 (file itself not individually requested).
- **P** = URL built from a verified naming pattern; not individually fetched.
- **X** = fetched and found broken on 2026-11-14.

Byte sizes are exact where given as integers; "M"/"G" figures are quoted as printed on the PGDA pages. The web-search budget for this research turn was exhausted part-way, so several items could only be checked by direct fetch of known URLs; these are listed under Gaps.

---

## 1. Topography: LOLA polar DEMs, improved site DEMs, NAC/ShadowCam/Kaguya DTMs, slope/roughness/uncertainty

### Takeaway
There are three generations of LOLA south-polar DEMs a developer should know: (a) the PDS "LDEM" polar GDRs (5–400 m/px, PDS3 IMG int16 + JP2, 2017 vintage), (b) the PGDA track-adjusted site DEMs at 5 m/px with height/slope uncertainty and 100 statistical "clones" (Barker et al. 2021) plus the 87–90°S 5 m/px mosaic, and (c) the PGDA 2023 "New View" COG GeoTIFF suite (10–240 m/px, with error, effective-resolution, slope, slope-error, roughness and PSR products). All use south polar stereographic, R = 1737.4 km, MOON_ME/DE421.

### Cited Findings

#### 1.1 LOLA PDS polar GDR "LDEM" south-pole files (PDS3 IMG, 16-bit LSB integer)

Base URL (PDS Geosciences): `https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/` — each product has `.img`, `.lbl` (PDS3) and `.xml` (PDS4) files. Mirror with upper-case names: `https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/` (e.g. `LDEM_875S_5M.IMG`, 1,840,545,792 bytes, V). Float32 versions in `.../polar/float_img/` (suffix `_float.img`, exactly 2x the size); GeoJPEG2000 in `.../polar/jp2/`. — [PDS listing img](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/); [float_img](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/float_img/); [jp2](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/)

| id | file (img) | variable | m/px | coverage | IMG bytes (L) | float IMG bytes (L) | JP2 bytes (L) | pixels per side (derived = sqrt(bytes/2)) |
|---|---|---|---|---|---|---|---|---|
| lola_ldem_875s_5m | ldem_875s_5m.img | height (m, DN*0.5) | 5 | 87.5–90°S | 1,840,545,792 | 3,681,091,584 | 185,186,696 | 30336 (label-confirmed) |
| lola_ldem_875s_10m | ldem_875s_10m.img | height | 10 | 87.5–90°S | 460,136,448 | 920,272,896 | 64,886,912 | 15168 |
| lola_ldem_875s_20m | ldem_875s_20m.img | height | 20 | 87.5–90°S | 115,034,112 | 230,068,224 | 21,462,406 | 7584 |
| lola_ldem_85s_10m | ldem_85s_10m.img | height | 10 | 85–90°S | 1,840,545,792 | 3,681,091,584 | 231,368,857 | 30336 |
| lola_ldem_85s_20m | ldem_85s_20m.img | height | 20 | 85–90°S | 460,136,448 | 920,272,896 | 79,150,148 | 15168 |
| lola_ldem_85s_40m | ldem_85s_40m.img | height | 40 | 85–90°S | 115,034,112 | 230,068,224 | 24,960,972 | 7584 |
| lola_ldem_80s_20m | ldem_80s_20m.img | height | 20 | 80–90°S | 1,848,320,000 | 3,696,640,000 | 267,689,172 | 30400 |
| lola_ldem_80s_40m | ldem_80s_40m.img | height | 40 | 80–90°S | 462,080,000 | 924,160,000 | 91,722,831 | 15200 |
| lola_ldem_80s_80m | ldem_80s_80m.img | height | 80 | 80–90°S | 115,520,000 | 231,040,000 | 29,837,992 | 7600 |
| lola_ldem_75s_30m | ldem_75s_30m.img | height | 30 | 75–90°S | 1,860,012,032 | 3,720,024,064 | 299,122,509 | 30496 |
| lola_ldem_75s_60m | ldem_75s_60m.img | height | 60 | 75–90°S | 465,003,008 | 930,006,016 | 103,313,776 | 15248 |
| lola_ldem_75s_120m | ldem_75s_120m.img | height | 120 | 75–90°S | 116,250,752 | 232,501,504 | 33,948,010 | 7624 |
| lola_ldem_75s_240m | ldem_75s_240m.img | height | 240 | 75–90°S | 29,062,688 | 58,125,376 | 10,766,928 | 3812 |
| lola_ldem_60s_60m | ldem_60s_60m.img | height | 60 | 60–90°S | 1,926,963,200 | 3,853,926,400 | 385,729,140 | 31040 |
| lola_ldem_60s_120m | ldem_60s_120m.img | height | 120 | 60–90°S | 481,740,800 | 963,481,600 | 132,441,860 | 15520 |
| lola_ldem_60s_240m | ldem_60s_240m.img | height | 240 | 60–90°S | 120,435,200 | 240,870,400 | 43,435,022 | 7760 |
| lola_ldem_45s_100m | ldem_45s_100m.img | height | 100 | 45–90°S | 1,658,880,000 | 3,317,760,000 | 393,679,678 | 28800 |
| lola_ldem_45s_200m | ldem_45s_200m.img | height | 200 | 45–90°S | 414,720,000 | 829,440,000 | 134,118,606 | 14400 |
| lola_ldem_45s_400m | ldem_45s_400m.img | height | 400 | 45–90°S | 103,680,000 | 207,360,000 | 43,124,560 | 7200 |

Companion PDS products in the same directories (south, all L):

| id | file | variable | m/px | IMG bytes |
|---|---|---|---|---|
| lola_ldec_* | ldec_875s_5m / 875s_10m / 875s_20m / 85s_10m / 85s_20m / 85s_40m / 80s_20m / 80s_40m / 80s_80m / 75s_30m / 75s_60m / 75s_120m / 75s_240m / 60s_60m / 60s_120m / 60s_240m / 45s_100m / 45s_200m / 45s_400m `.img` | LOLA shot counts per pixel | as named | 920,272,896 / 230,068,224 / 57,517,056 / 920,272,896 / 230,068,224 / 57,517,056 / 924,160,000 / 231,040,000 / 115,520,000 / 930,006,016 / 232,501,504 / 116,250,752 / 29,062,688 / 963,481,600 / 481,740,800 / 120,435,200 / 1,658,880,000 / 414,720,000 / 103,680,000 |
| lola_ldsm_75s_120m | ldsm_75s_120m.img | slope map | 120 | 116,250,752 |
| lola_ldsm_75s_240m | ldsm_75s_240m.img | slope map | 240 | 29,062,688 |
| lola_ldsm_85s_40m | ldsm_85s_40m.img | slope map | 40 | 115,034,112 |
| lola_ldrm_75s_240m | ldrm_75s_240m.img | roughness map | 240 | 29,062,688 |
| lola_ldrm_85s_40m | ldrm_85s_40m.img | roughness map | 40 | 115,034,112 |
| lola_ldrm_40s_1000m | ldrm_40s_1000m.img, ldrm_40s_1000m_nn.img | roughness (single-shot product; `_nn` variant) | 1000 | 20,480,000 each |
| lola_ldrc_40s_1000m | ldrc_40s_1000m.img | roughness counts | 1000 | 20,480,000 |
| lola_ldac_50s | ldac_50s_1000m.img, ldac_50s_3000m.img | 1064 nm albedo counts | 1000 / 3000 | 12,822,048 / 1,424,672 |
| lola_ldam_50s | ldam_50s_1000m_float.img, ldam_50s_3000m_float.img (float_img dir); ldam_50s_1000m.jp2 (4,933,455 bytes) | LOLA 1064 nm normal albedo map | 1000 / 3000 | 25,644,096 / 2,849,344 |

- Label facts for `ldem_875s_5m.lbl` (V, 4,990 bytes): `DATA_SET_ID = "LRO-L-LOLA-4-GDR-V1.0"`, `PRODUCT_VERSION_ID = "V2.0"`, data through `LRO_ES_54`, `START_TIME 2009-07-13`, `STOP_TIME 2017-02-02`, `PRODUCT_CREATION_TIME 2017-06-15`; `LINES = LINE_SAMPLES = 30336`; `SAMPLE_TYPE = LSB_INTEGER`, `SAMPLE_BITS = 16`, `SCALING_FACTOR = 0.5`, `OFFSET = 1737400.`; "HEIGHT = (DN * SCALING_FACTOR)"; `MAP_PROJECTION_TYPE = "POLAR STEREOGRAPHIC"`, `A/B/C_AXIS_RADIUS = 1737.4 km`, `CENTER_LATITUDE = -90`, `CENTER_LONGITUDE = 0`, `MAP_SCALE = 5 m/pix`, `MAP_RESOLUTION = 6064.67 pix/deg`, `LINE_PROJECTION_OFFSET = SAMPLE_PROJECTION_OFFSET = 15167.5`, `COORDINATE_SYSTEM_NAME = "MEAN EARTH/POLAR AXIS OF DE421"`, pixel registration; "about 0.004% of the data have been flagged as erroneous"; gridding done with GMT `mapproject`, `blockmedian`, `surface`. — [ldem_875s_5m.lbl](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.lbl)
- The LOLA PDS volume root also holds `extras/` with `illumination`, `geoid`, `fractal` (roughness coefficients), `sldem2015`, `software`. — [extrinfo.txt](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/extrinfo.txt)

#### 1.2 PGDA improved LOLA products (GeoTIFF / COG)

| id | name | variable | res | coverage | format | size | url | status | citation / DOI |
|---|---|---|---|---|---|---|---|---|---|
| pgda78_site_dem | High-Resolution LOLA Topography for Lunar South Pole Sites (per-site) | height `_surf`, counts `_ldec`, slope `_slp`, total Z RMS error `_toterr`, slope RMS error `_slperr`, point cloud `.xyzi`, ROI shapefiles `_ROIs.tgz`, 100 clones | 5 m/px | 27 named sites (list below) | GeoTIFF (pixel-registered), binary float64 XYZI, tgz | Site01: surf 40,980,810 bytes; xyzi 32,765,376; ROIs.tgz 2,934 (V) | `https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/{Site}/{Site}_final_adj_5mpp_{surf,ldec,slp,toterr,slperr}.tif` ; landing page https://pgda.gsfc.nasa.gov/products/78 ; README https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/README | V for Site01, P for others | Barker et al. 2021, doi:10.1016/j.pss.2020.105119 |
| pgda81_ldem_87s | South Pole LOLA DEM Mosaic | height | 5 m/px | 87–90°S | GeoTIFF | 3,465,285,714 bytes (V; page says 3.3 GB) | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/ldem_87s_5mpp.tif | V | Barker et al. 2021 |
| pgda81_hill_87s | hillshade of above | hillshade | 5 m/px | 87–90°S | GeoTIFF | 820 MB (page) | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/ldem_87s_5mpp_hillshade.tif | L | same |
| pgda81_ldsm_87s | slope | slope (deg) | 5 m/px | 87–90°S | GeoTIFF | 4.9 GB (page) | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/ldsm_87s_5mpp.tif | L | same |
| pgda81_ldec_87s | counts | LOLA returns per pixel | 5 m/px | 87–90°S | GeoTIFF | 140 MB (page) | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/ldec_87s_5mpp.tif | L | same |
| pgda90_* | A New View of the Lunar South Pole from LOLA (table below) | height, error, effective resolution, hillshade, slope, slope error, counts, roughness, PSR | 10–240 m/px (roughness 50 and 1000 m/px) | 83/80/75/60–90°S | COG GeoTIFF | see below | `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/{FILENAME}` ; landing page https://pgda.gsfc.nasa.gov/products/90 | LDEM_80S_20MPP_ADJ.TIF V (2,696,082,051 bytes) | Barker et al. 2023, doi:10.3847/PSJ/acf3e1; data DOI 10.60903/gsfcpgda-lola-spole |
| pgda104_sdem | Enhanced Topography Models (Shape-from-Shading) for the 13 original Artemis III regions | SfS DEM, hillshade, max-illumination orthomosaic, coverage/solar-bin counts, best-input-resolution, SDEM minus LDEM, multi-baseline slope, VRM roughness | 5 m/px | 13 regions, ">4,500 km2" | GeoTIFF on Zenodo | not stated on page | https://doi.org/10.5281/zenodo.17954508 ; page https://pgda.gsfc.nasa.gov/products/104 | V (Zenodo record page 200) | Bertone et al. 2026, doi:10.3847/PSJ/ae5b70 |
| pgda92_opnav | Large-scale Lunar Elevation Models to Support Optical Navigation | SfS DEM mosaic + verification products | 30 m/px | 18,000 km2 strip, 60–80°S | TAR of GeoTIFFs | 1.1 GB (page) | https://pgda.gsfc.nasa.gov/data/LargeDEM/share_hls_v2_mar.tar ; code doi:10.5281/zenodo.10258683 | L | Bertone, Barker, Mazarico 2023 |
| pgda95_lola_pa | LOLA MOON_PA gridded dataset | global shape in principal-axis frame | 64 and 128 ppd | global | netCDF/GMT `.grd`, GeoTIFF | 702 MB / 683 MB (64 ppd); 2.7 GB / 2.6 GB (128 ppd) | https://pgda.gsfc.nasa.gov/data/LOLA_PA/LDEM128_PA_pixel_202405.tif (also `LDEM64_PA_pixel_202405.tif/.grd`, `LDEM128_PA_pixel_202405.grd`, `*_gridline_202405.grd`) | L | Neumann 2024, doi:10.60903/LOLA_PA |
| pgda106_sb | Improving Lunar Topography with Deep Learning Schroedinger Bridges | ML super-resolution 320 m to 20 m/px, method demo | 20 m/px | patches poleward of 80° | n/a | n/a | https://pgda.gsfc.nasa.gov/products/106 | V | Repasky et al. (PGDA post 2026-05-08) |
| pgda98_north | Large-Scale Roughness Properties of the Lunar Poles (north analogue of product 90) | same suite, north | 20–240 m/px | 60–90°N | COG | e.g. LDEM_80N_20MPP_ADJ.TIF 2.7G | https://pgda.gsfc.nasa.gov/products/98 | V | Barker (PGDA post 2025-02-28) |

Sources: [PGDA 78](https://pgda.gsfc.nasa.gov/products/78), [PGDA 81](https://pgda.gsfc.nasa.gov/products/81), [PGDA 90](https://pgda.gsfc.nasa.gov/products/90), [PGDA 92](https://pgda.gsfc.nasa.gov/products/92), [PGDA 95](https://pgda.gsfc.nasa.gov/products/95), [PGDA 98](https://pgda.gsfc.nasa.gov/products/98), [PGDA 104](https://pgda.gsfc.nasa.gov/products/104), [PGDA 106](https://pgda.gsfc.nasa.gov/products/106)

**PGDA product 78 site list** (directory names): Site01 Connecting ridge; Site04 Shackleton rim; Site06 Nobile rim 1; Site07 Peak near Shackleton; Site11 de Gerlache rim; Site20 Leibnitz beta plateau; Site20v2 (extended boundaries); Site23 Malapert massif; Site42 de Gerlache-Kocher massif; Haworth; Shoemaker; DM1 Amundsen rim; DM2 Nobile rim 2; SL2 de Gerlache rim; SL3 Connecting ridge extension; NPA Cabeus exterior wall 1; NPB Amundsen 1; NPC Idel'son L crater 1; NPD Malapert crater 1; LM1 Shackleton Rim B; LM2–LM6 and LM8 Shoemaker Rim A–F; LM7 Faustini Rim A. "The site name numbering follows the Mazarico et al. (2011) paper." Update log: 2021-04-26 (Site42, DM1, SL2), 2021-05-24 (NPA, NPB), 2021-06-14 (NPC, NPD), 2021-08-10 (LM1–LM8), 2022-08-15 (Site20v2). — [PGDA 78](https://pgda.gsfc.nasa.gov/products/78)

**PGDA product 78 quality figures:** track geolocation uncertainty after co-adjustment "~10–20 cm horizontally and ~2–4 cm vertically"; orbital errors reduced "by over a factor of 10"; fraction of interpolated 5 m pixels "~90%"; "median RMS Z error ~0.30–0.50 m and a median RMS slope error ~1.5–2.5 deg"; XYZI format "Binary double precision floating point tables with 4 columns: X, Y, Z, RDRid ... (in km)" with RDRid format YYDOYHHMM. The 87°S mosaic was built from "97 individual 20x20 km fields with 2 km overlaps" with "typical RMS residual of 30–55 cm". — [PGDA 78](https://pgda.gsfc.nasa.gov/products/78); [README](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/README); [PGDA 81](https://pgda.gsfc.nasa.gov/products/81)

**PGDA product 90 file inventory** (file name — size as printed on page; all under `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/`). Naming: `PREFIX_LAT_PIX_STEMS.TIF`; PREFIX in {LDEM height, LDEC counts, LDSM slope, LDRM roughness, LPSR}; stems `ADJ`, `ADJ_ERR` (height or slope error), `ADJ_EFFRES` (effective resolution, m), `ADJ_HILL` (hillshade 45° alt / 45° az). — [PGDA 90](https://pgda.gsfc.nasa.gov/products/90)

| pixel scale / coverage | LDEC | LDEM | LDEM_EFFRES | LDEM_ERR | LDEM_HILL | LDSM | LDSM_ERR |
|---|---|---|---|---|---|---|---|
| 83S, 10MPP | 415M | 4.8G | 7.5G | 7.5G | 2.5G | 7.1G | 7.0G |
| 80S, 20MPP | 1.3G | 2.6G | 3.8G | 3.7G | 1.3G | 3.6G | 3.7G |
| 80S, 40MPP | 369M | 685M | 955M | 964M | 330M | 912M | 944M |
| 80S, 80MPP | 111M | 181M | 239M | 244M | 85M | 231M | 239M |
| 75S, 30MPP | 489M | 2.7G | 3.8G | 3.8G | 1.3G | 3.6G | 3.7G |
| 60S, 60MPP | 1.5G | 2.9G | 3.9G | 4.0G | 1.4G | 3.8G | 3.9G |
| 60S, 120MPP | 463M | 785M | 1000M | 1016M | 354M | 972M | 1001M |
| 60S, 240MPP | 131M | 210M | 248M | 255M | 93M | 247M | 248M |

Example exact names: `LDEM_80S_20MPP_ADJ.TIF`, `LDEM_80S_20MPP_ADJ_ERR.TIF`, `LDEM_80S_20MPP_ADJ_EFFRES.TIF`, `LDEM_80S_20MPP_ADJ_HILL.TIF`, `LDSM_80S_20MPP_ADJ.TIF`, `LDSM_80S_20MPP_ADJ_ERR.TIF`, `LDEC_80S_20MPP_ADJ.TIF`, `LDEM_83S_10MPP_ADJ.TIF`.

Roughness (80–90°S; baselines 100, 200, 400, 800, 1600 m; two grids, 50 m/px and 1000 m/px):

| file pattern | meaning (quoted) | size 50MPP | size 1000MPP |
|---|---|---|---|
| `LDRM_80S_{50,1000}MPP_ADJ_ROUGH_{100..1600}M.TIF` | "spread of height residuals of individual LOLA spots around a plane fit to the LDEM within a circular window whose diameter is equal to a baseline" (m) | 584–616M each | 1.4–1.5M each |
| `LDRM_80S_{50,1000}MPP_ADJ_SLP_{100..1600}M.TIF` | "corresponding slope (in degrees) of the plane fit" | 523–591M | 1.5M |
| `LDRM_80S_{50,1000}MPP_ADJ_RMSD_{100..1600}M.TIF` | "RMS height deviation (in meters) between a central point and surrounding annulus" | 536–588M | 1.5M |
| `LDRM_80S_{50,1000}MPP_ADJ_ROUGH_RGB.TIF` | colour composite of multi-baseline roughness (50–1000 m) | 924M | 2.2M |
| `LDRM_80S_{50,1000}MPP_ADJ_H.TIF`, `LDRM_80S_1000MPP_ADJ_CLASS.TIF`, `..._AVGROUGH.TIF`, `..._SPSLP.TIF` | additional roughness layers (linked on page; descriptions not captured) | n/a | n/a |

Point clouds: `LDEM_80S_ADJ.XYZI` 13G ("for products with 20MPP or LDRM in the filename"), `LDEM_60S_ADJ.XYZI` 48G; "binary double precision, 4 columns: X,Y,Z,ID" (X,Y stereographic metres). NAC image/model pairs at 20 m/px for 9 NAC observations (e.g. `M1188426614_20MPP_MODEL.TIF` 30M in W/m^2, `M1188426614LE_20MPP.TIF` 1.4M in I/F). — [PGDA 90](https://pgda.gsfc.nasa.gov/products/90)

#### 1.3 Other DEM/imagery sources

| id | name | instrument/mission | variable | res | coverage | format | size | url | licence | status / notes |
|---|---|---|---|---|---|---|---|---|---|---|
| sldem2015 | SLDEM2015 | LOLA + Kaguya TC | height | 512/256/128 ppd | **60°S–60°N only** ("Global maps (for latitudes between 60 deg South and 60 deg North)") | IMG/JP2 | n/a | https://pgda.gsfc.nasa.gov/products/54 ; PDS `.../lrolol_1xxx/extras/sldem2015/` | PDS | V; **does not cover the south pole** |
| usgs_lola_118m | Moon LRO LOLA DEM 118m | LOLA | height | 118 m | global | GeoTIFF | 8,494,203,833 bytes (V) | https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif ; page https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m | USGS | V; ACAO `*`, range requests OK |
| usgs_lola_kaguya_59m | Moon LRO LOLA – SELENE Kaguya TC DEM Merge 60N60S 59m | LOLA + TC | height | 59 m (512 ppd) | 60°S–60°N | GeoTIFF | n/a | https://planetarymaps.usgs.gov/mosaic/LolaKaguya_Topo/Lunar_LRO_LOLAKaguya_DEMmerge_60N60S_512ppd.tif | USGS | L (link on page) |
| usgs_nac_sp_dem | Moon LRO South Pole DEM (LROC NAC stereo, SOCET SET) | LROC NAC | height | 4 m/px (file name `..._4mp.tif`) | near 89°S 210°E (file name) | GeoTIFF | 295.77 MB (page) | https://asc-astropedia.s3.us-west-2.amazonaws.com/Moon/LRO/MOON_LRO_NAC_DEM_89S210E_4mp.tif ; page https://astrogeology.usgs.gov/search/map/moon_lro_south_pole_dem | USGS | L |
| lroc_nac_dtm_* | LROC NAC DTMs (SOCET SET), south-polar examples: `NAC_DTM_SHACKRDGE02` (Shackleton–de Gerlache Connecting Ridge, 3.5 m/px DTM, orthophotos 1.20 and 3.50 m/px), `NAC_DTM_ESALL_SR12`, `NAC_DTM_ESALL_CR1`, `NAC_DTM_ESALL_MP1`, `NAC_DTM_MALAPERT01/02/03`, `NAC_DTM_MALAPERTA01`, `NAC_DTM_NOBILE01/02/03/04` | LROC NAC | height, orthophoto, slope, confidence | 2–5 m/px typical ("3 to 10 times the pixel scale of the image") | individual stereo sites | PDS IMG + GeoTIFF browse | varies | `https://data.lroc.im-ldi.com/lroc/view_rdr/{PRODUCT}` ; files under `https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/SDP/NAC_DTM/{SITE}/` | PDS | V (product pages); ODE counts 668 NAC DTM products (SDNDTM) and 101 ASP DEMs (ASPDTM) Moon-wide |
| lroc_nac_pole_south | NAC_POLE_SOUTH — uncontrolled 1 m/px south pole mosaic | LROC NAC | reflectance mosaic | 1 m/px | 85.5–90°S, 40 tiles | PDS IMG + 8-bit GeoTIFF/PNG browse | Trek copy 36,250,716,050 bytes | https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_POLE_SOUTH ; README https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/NAC_POLE/NAC_POLE_SOUTH/NAC_POLE_SOUTH_README.TXT | PDS | V; tile names `NAC_POLE_SOUTH_P###S????`; images from 2010-07-23 to 2010-12-11 |
| lroc_nac_pole_south_cm_avg | NAC_POLE_SOUTH_CM_AVG — controlled 1 m/px average mosaic (also `_CM_MAX`, and 36 sub-solar-longitude bins `_CM_005` … `_CM_355`) | LROC NAC | reflectance | 1 m/px | 84–90°S, 40 tiles | PDS IMG + GeoTIFF | Trek copy 34,464,253,117 bytes | https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_POLE_SOUTH_CM_AVG | PDS | V; "18323 NAC images ... 2009 and 2013"; control to 85°S, "1,677,811 points and over 14 million measures" |
| lroc_nac_psr_south | NAC_POLE_PSR_SOUTH — 10 m/px PSR mosaic (long-exposure NAC) + LOLA PSR shapefile | LROC NAC | I/F inside PSRs | 10 m/px | 80–90°S, PSRs buffered 10 km | IMG/TIF + shapefile ZIP | ZIP 1,121,858 bytes (V) | https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/BROWSE/NAC_POLE/NAC_POLE_PSR_SOUTH/NAC_POLE_PSR_SOUTH.ZIP | PDS | V |
| lroc_nac_roi_* | Controlled low-Sun NAC ROI mosaics for Artemis-relevant sites: `NAC_ROI_SHKLTNPK*`, `NAC_ROI_MALAPERT*`, `NAC_ROI_HAWORTH_*`, `NAC_ROI_MTMOUTON*` (Nobile Rim 1 and Mons Mouton / Leibnitz Beta Plateau), `NAC_ROI_MOUTNPLT*` (Mons Mouton Plateau), `NAC_ROI_NOBILE02*`, `NAC_ROI_DEGERKCH*`, `NAC_ROI_DEGERRIM*`, `NAC_ROI_AMUNDRIM*`, `NAC_ROI_CABEUSPK*` (Peak near Cabeus B), `NAC_ROI_FAUSTINI*`, PSR sets `NAC_ROI_PSR{AMUND,CABEU,FAUST,HAWOR,SHOEM,SLATR}LOA` | LROC NAC | reflectance | ~1 m/px | per site, binned by sub-solar longitude | IMG/TIF | varies | https://data.lroc.im-ldi.com/lroc/rdr_product_select?filter[text]=... | PDS | V (catalogue query) |
| lroc_wac_gld100 | WAC_GLD100 global DTM | LROC WAC | height | 100 m | global (not poleward of ~79° in original; not verified here) | IMG | n/a | https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_GLD100 | PDS | V page only |
| shadowcam_dtm | ShadowCam DTMs (PDS4) — directories: `amundsen-n-wall1_p834s0913`, `faustini1_p871s0839`, `faustiniloworbit1_p872s0832`, `ibnbajja1_p863s2856`, `lcross1_p847s3110`, `mouton-h-crater1_p848s0292`, `nobile-mouton1_p855s0321`, `nobile-west-rim1_p853s0364`, `schrodinger-g-vent1_p753s1394`, `shackleton1_p896s1181`, `shoemaker-rim1_p883s0607` (plus 5 north) | ShadowCam on KARI KPLO (NASA-funded instrument, ASU) | DTM (`_dtm_6m`), slope, color-slope, shade, confidence, orthos (`_180cm`, `_6m`) | 6 m DTM; 1.8 m ortho | PSR interiors | PDS4 | n/a | https://pds.shadowcam.im-ldi.com/derived/dtm/ | PDS | V; ACAO `*` |
| shadowcam_cmosaic | ShadowCam controlled mosaics, e.g. `shadowcam_cmosaic_faustini01_p871s0904_summer_10am` (+ `_5m`, `_20m`), `..._cabeusb01_p820s3048_winter_10am`, `..._amundsen01_p840s0789_fall_09am` | ShadowCam | PSR imagery | native, 5 m, 20 m | individual PSRs by season/local time | PDS4 | n/a | https://pds.shadowcam.im-ldi.com/derived/cmosaic/ | PDS | V; ODE lists CAL 39,518, UMOS 1,635, CMOS 18, DTM 11 products |
| kaguya_tc_usgs_sp | Kaguya/SELENE TC Version 2.0 USGS DTMs, south polar collection | SELENE TC (JAXA data, USGS/ASP processing) | DTM, orthoimages, LAZ, hillshade | orthoimage "~30 meters" horizontal precision; "mean vertical precision is ~3 me[ters]" | 19,646 items | COG GeoTIFF, LAZ, JSON camera states | per item | STAC `https://stac.astrogeology.usgs.gov/api/collections/kaguya_terrain_camera_usgs_dtms_v2_southpolar/items` ; assets on `https://astrogeo-ard.s3-us-west-2.amazonaws.com/moon/kaguya/terrain_camera/usgs_dtms_v2/...` | CC0-1.0 (STAC field) | V; CRS IAU:30135 |
| lola_copc | LOLA shot observations as Cloud Optimized Point Cloud | LOLA RDR | lat/lon/radius spots | per shot | global tiles | COPC (LAZ) | n/a | https://stac.astrogeology.usgs.gov/api/collections/lunar_orbiter_laser_altimeter | CC0-1.0 | V |
| ce2_dem_20m_sp | CE-2 CCD DEM, S Pole (Trek layer `CE2_DEM_20m_SP`) | Chang'e-2 stereo camera (CNSA) | height | 20 m | south polar | Trek WMTS/ImageServer | 34,749,994,235 bytes | via Trek (section 5) | CNSA data via NASA Trek; terms not checked | L |
| ch2_ohrc | Chandrayaan-2 OHRC / TMC-2 | ISRO | panchromatic images; TMC-2 stereo | OHRC "GSD ... 0.25m and swath 3km" from 100 km; TMC-2 "5m spatial resolution" stereo triplets | targeted | PDS4 | n/a | https://pradan.issdc.gov.in/ch2/ (Login/Signup required) | ISRO; registration | V page only |

Sources: [PGDA 54](https://pgda.gsfc.nasa.gov/products/54); [USGS Astropedia LOLA 118m](https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m); [USGS South Pole DEM](https://astrogeology.usgs.gov/search/map/moon_lro_south_pole_dem); [LROC RDR catalogue](https://data.lroc.im-ldi.com/lroc/rdr_product_select); [NAC_POLE_SOUTH README](https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/NAC_POLE/NAC_POLE_SOUTH/NAC_POLE_SOUTH_README.TXT); [NAC_POLE_SOUTH_CM_AVG README](https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/NAC_POLE/NAC_POLE_SOUTH_CM_AVG/NAC_POLE_SOUTH_CM_AVG_README.TXT); [NAC_POLE_PSR_SOUTH README](https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/BROWSE/NAC_POLE/NAC_POLE_PSR_SOUTH/NAC_POLE_PSR_SOUTH_README.TXT); [NAC_DTM_SHACKRDGE02](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_SHACKRDGE02); [ShadowCam PDS derived](https://pds.shadowcam.im-ldi.com/derived/); [ShadowCam DTM dir](https://pds.shadowcam.im-ldi.com/derived/dtm/); [USGS STAC collections](https://stac.astrogeology.usgs.gov/api/collections); [ISRO PRADAN CH-2](https://pradan.issdc.gov.in/ch2/); [ODE REST IIPT list](https://oderest.rsl.wustl.edu/live2/?query=iipy&odemetadb=moon&output=JSON)

### Inferences
- For an app, the practical default DEM is `LDEM_80S_20MPP_ADJ.TIF` (COG, 2.7 GB, 80–90°S) with `LDEM_80S_20MPP_ADJ_ERR.TIF` and `LDSM_80S_20MPP_ADJ.TIF`; use `ldem_87s_5mpp.tif` (3.5 GB) or the per-site 5 m GeoTIFFs (~40–140 MB each) for landing-ellipse-scale work. The older PDS `ldem_*` IMG files predate the track adjustment and contain more orbital-error artefacts (PGDA 78 says the adjusted LDEMs are "substantially more realistic than the previous ones").
- Because ~90% of 5 m pixels are interpolated, sub-20 m slope from LOLA alone is not a measurement; the PGDA `_toterr`, `_slperr`, `ADJ_EFFRES` rasters and the 2026 SfS SDEMs (Zenodo 17954508) are the products that quantify or fix this.
- Pixel dimensions computed from byte counts are consistent with the label for `ldem_875s_5m` (30336) and with Trek's bbox (−75840…75840 m), so the other derived dimensions in the table are likely correct but were not label-checked individually.

### Gaps
- Per-site file sizes for the 26 PGDA sites other than Site01 were not individually fetched (the Trek catalogue gives sizes for ten of them, see section 5).
- Descriptions of `LDRM_*_H`, `_CLASS`, `_AVGROUGH`, `_SPSLP` were not captured.
- Kaguya TC original polar DTM mosaics at JAXA DARTS: the portal https://darts.isas.jaxa.jp/planet/pdap/selene/ responded (200) but product names, coverage and JAXA terms of use were not extracted.
- WAC_GLD100 latitude coverage and file sizes not verified.
- No file-level check of ShadowCam DTM file names/sizes or licence statement.

---

## 2. Illumination and Earth-visibility products

### Takeaway
NASA publishes four kinds of precomputed lighting products: LOLA-derived 18.6-year averages (solar illumination, Earth visibility, sky visibility, PSR masks; 60/120/240 m/px), LROC WAC empirical one-year illumination maps (100 m/px, 88–90°S), PSR polygon shapefiles (LOLA 2011-based via LROC; LOLA 2023 20 m/px via PGDA), and NASA SVS rendered time series (2-hourly frames, 2023–2030 for >88°S and 2025–2028 for >80°S). No NASA product gives a per-pixel illumination time series as georeferenced numeric data; that must be computed.

### Cited Findings

#### 2.1 LOLA illumination "EXTRAS" (Mazarico et al. 2011 method, 2016 release)

Base URLs: PDS `https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/{img,jp2}/` (lower-case names); MIT mirror `https://imbrium.mit.edu/EXTRAS/ILLUMINATION/{IMG,JP2}/` (upper-case). PGDA GeoTIFF conversions (added 2025-03-20): `https://pgda.gsfc.nasa.gov/data/MoonIllumination/{NAME}.TIF`.

| id | file stem | variable | m/px | coverage (full / partial) | IMG bytes (L) | JP2 bytes (L) | PGDA TIF | status |
|---|---|---|---|---|---|---|---|---|
| lola_avgvisib_65s | avgvisib_65s_240m_201608 | average solar illumination fraction | 240 | 65–90°S (±770 km; partial to ~55.2°) | 82,432,800 | 48,625,783 | AVGVISIB_65S_240M_201608.TIF | L |
| lola_avgvisib_75s | avgvisib_75s_120m_201608 | average solar illumination | 120 | 75–90°S | 116,250,752 | 67,449,137 | AVGVISIB_75S_120M_201608.TIF | L |
| lola_avgvisib_85s | avgvisib_85s_060m_201608 | average solar illumination | 60 | 85–90°S (±151 km; partial to ~82.9°) | 51,166,728 (V on MIT mirror) | 28,731,942 | AVGVISIB_85S_060M_201608.TIF = 33,994,464 bytes (V) | V |
| lola_earthvis_65s | avgvisib_65s_240m_201608_earth | average Earth visibility | 240 | 65–90°S | 82,432,800 | 21,812,303 | AVGVISIB_65S_240M_201608_EARTH.TIF | L |
| lola_earthvis_75s | avgvisib_75s_120m_201608_earth | average Earth visibility | 120 | 75–90°S | 116,250,752 | 37,997,440 | AVGVISIB_75S_120M_201608_EARTH.TIF | L |
| lola_earthvis_85s | avgvisib_85s_060m_201608_earth | average Earth visibility | 60 | 85–90°S | 51,166,728 | 21,642,698 | AVGVISIB_85S_060M_201608_EARTH.TIF | L |
| lola_lpsr_65s | lpsr_65s_240m_201608 | permanently shadowed region mask | 240 | 65–90°S | 82,432,800 | 2,632,458 | LPSR_65S_240M_201608.TIF | L |
| lola_lpsr_75s | lpsr_75s_120m_201608 | PSR mask | 120 | 75–90°S | 116,250,752 | 6,991,935 | LPSR_75S_120M_201608.TIF | L |
| lola_lpsr_85s | lpsr_85s_060m_201608 | PSR mask | 60 | 85–90°S | 51,166,728 | 5,574,318 | LPSR_85S_060M_201608.TIF | L |
| lola_skyv_65s | skyv_65s_240m (release_2014) | sky visibility (unobscured solid angle) | 240 | 65–90°S | 82,432,800 | 52,099,859 | SKYV_65S_240M.TIF | L |

- **Broken links (X):** every `*_COG.TIF` link on the PGDA illumination page (e.g. `https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608_COG.TIF`, `..._EARTH_COG.TIF`, `AVGVISIB_65S_240M_201608_COG.TIF`, `LPSR_85S_060M_201608_COG.TIF`, `SKYV_65S_240M_COG.TIF`) returned a PGDA "404 – Not Found" HTML page (served with HTTP status 200, 3,789 bytes) on 2026-11-14. The non-COG `.TIF` works. Also, on that page the "JP2" link for LPSR 65S points to the `.IMG`, and three north "IMG" links point to `.JP2`. — [PGDA 69](https://pgda.gsfc.nasa.gov/products/69)
- Method summary (quoted): "Mazarico et al. (2011) used 240 meters-per-pixel polar maps from LOLA and computed the illumination conditions at the lunar poles over an entire lunar nutation cycle (~18.6 years) with a timestep of one hour"; products are "typically averages over long time periods"; "polar stereographic projection, with a reference radius of 1737.4 km and true scale at the pole"; "PDS IMG format (int16 binary tables) and the GeoJPEG2000 format". Earth visibility: "the Earth is considered visible if any part of its disc is not obscured, so it may be very slightly optimistic for radio link studies that would involve only DSN stations". PGDA note: "Contact us if you have specific needs (e.g., a given duration for a given site)". — [PGDA 69](https://pgda.gsfc.nasa.gov/products/69)
- README: maps "extend to +/- 770 km or +/- 151 km"; "Some maps show linear artifacts that arise from the topographic DEMS"; "these files are not supported by the PDS or the LOLA Science Team". — [readme_illumination_2016.txt](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/readme_illumination_2016.txt)
- ODE catalogues the same family as LRO/LOLA product types `GDRVIS` (48 products), `GDRPSR` (28), `GDRSKY` (12). — [ODE REST IIPT](https://oderest.rsl.wustl.edu/live2/?query=iipy&odemetadb=moon&output=JSON)

#### 2.2 PSR vector products

| id | name | source | features | format | size | url | status |
|---|---|---|---|---|---|---|---|
| pgda_lpsr_80s_20m | LPSR_80S_20MPP_ADJ (all PSRs, N = 506,349) | LOLA 20 m/px adjusted DEM (Barker et al. 2023) | polygons + attribute table | SHP/SHX/DBF/PRJ + CSV + raster TIF | SHP 154M, DBF 117M, SHX 3.9M, PRJ 368 bytes, CSV 209M, TIF 148M | `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LPSR_80S_20MPP_ADJ.{SHP,SHX,DBF,PRJ,CSV,TIF}` | L |
| pgda_lpsr_80s_1km2 | LPSR_80S_20MPP_ADJ_1km2 (PSRs with area > 1 km2, N = 1,531) | same | polygons | SHP etc. | SHP 20,743,300 bytes (V; page "20M"), DBF 360K, SHX 12K, CSV 28M | `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LPSR_80S_20MPP_ADJ_1km2.{SHP,SHX,DBF,PRJ,CSV}` | V |
| lroc_lola_psr_sp | LOLA South Pole PSR shapefile bundled with NAC_POLE_PSR_SOUTH | "digitization of south pole PSRs (larger than 5 square km)" from Mazarico et al. 2011 maps; 60 m/px DTMs for 82–90°S, 120 m/px for 81–82°S | polygons | ZIP (shp, dbf, shx, prj) | 1,121,858 bytes (V) | https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/BROWSE/NAC_POLE/NAC_POLE_PSR_SOUTH/NAC_POLE_PSR_SOUTH.ZIP | V |
| trek_psr_sp | Permanently Shadowed Regions (PSRs), S Pole (`PSR_SP`) | LROC/LOLA | polygons | ArcGIS feature service (query as JSON/GeoJSON) | 22,462 bytes | https://trek.nasa.gov/moon/trekarcgis/rest/services/PSR_SP/MapServer/0 | L |
| lroc_psr_atlas | LROC PSR Atlas (PSR list, downloadable atlas, long-exposure NAC images per PSR) | LROC | per-PSR pages | web + download | n/a | https://lroc.im-ldi.com/psr | V page |

Sources: [PGDA 90](https://pgda.gsfc.nasa.gov/products/90); [NAC_POLE_PSR_SOUTH README](https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/BROWSE/NAC_POLE/NAC_POLE_PSR_SOUTH/NAC_POLE_PSR_SOUTH_README.TXT); [Trek search API](https://trek.nasa.gov/moon/TrekServices/ws/index/polar/searchItems?start=0&rows=2147483647&facetKeys=itemType&facetValues=product); [LROC PSR atlas](https://lroc.im-ldi.com/psr)

#### 2.3 LROC WAC empirical illumination

| id | product | variable | res | coverage | format | size | url | status |
|---|---|---|---|---|---|---|---|---|
| wac_ill_pct_south | WAC_POLE_ILL_PCT_SOUTH_100M | percentage of WAC observations in which pixel was lit | 100 m/px | 88–90°S | PDS IMG; 8-bit GeoTIFF browse | IMG 5,904,896 bytes (V); TIF 1,476,925 bytes (V) | IMG: https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/WAC_POLE/WAC_POLE_ILL_PCT_SOUTH/WAC_POLE_ILL_PCT_SOUTH_100M.IMG ; TIF: https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/BROWSE/WAC_POLE/WAC_POLE_ILL_PCT_SOUTH/WAC_POLE_ILL_PCT_SOUTH_100M.TIF | V |
| wac_ill_twi_south | WAC_POLE_ILL_TWI_SOUTH_100M | time-weighted illumination (gaps linearly interpolated; sparse periods weighted x2) | 100 m/px | 88–90°S | PDS IMG | 5,904,896 bytes (V) | https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/WAC_POLE/WAC_POLE_ILL_TWI_SOUTH/WAC_POLE_ILL_TWI_SOUTH_100M.IMG | V |
| wac_movie_south | WAC_POLE_MOVIE_SOUTH | WAC time-lapse (frames archived as BDR movie products; MP4/MOV) | 100 m/px | 80–90°S | MP4/MOV + frames | cropped MPEG-4 839.88 MB | https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/BROWSE/WAC_POLE/WAC_POLE_MOVIE_SOUTH/WAC_MOVIE_CROPPED_S20100402T1354_MPEG4.MP4 | L |
| wac_roi_south_summer | WAC_ROI_SOUTH_SUMMER | WAC south-pole summer mosaic | 100 m/px (not verified) | polar | IMG | n/a | https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_ROI_SOUTH_SUMMER | V page |

- Derivation (quoted): "WAC images (n=3807) acquired over one lunar year from 15 February 2010 to 5 February 2011"; "Temporal gaps were filled with 229 observations"; "map-projected at 100 meters/pixel in polar stereographic projection onto a 30 m LOLA DEM"; repeat imaging "approximately every 2 hours"; "some regions that are permanently shadowed ... have percentage values that are close to, but not equal to zero". Cite Speyerer & Robinson 2013, doi:10.1016/j.icarus.2012.10.010. — [WAC_POLE_ILL_PCT_SOUTH README](https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/WAC_POLE/WAC_POLE_ILL_PCT_SOUTH/WAC_POLE_ILL_PCT_SOUTH_README.TXT); [WAC_POLE_ILL_TWI_SOUTH](https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_POLE_ILL_TWI_SOUTH)

#### 2.4 NASA SVS precomputed time series (rendered images, not numeric rasters)

| id | SVS id / title | content | cadence | span | field of view | assets | url | status |
|---|---|---|---|---|---|---|---|---|
| svs4930 | 4930 "Illumination at the Moon's South Pole, 2023 to 2030" | simulated sunlight/shadow from LOLA terrain | 2 h | 2023–2030, "35,064 time steps or frames" | south of 88°S | per-year MP4 (e.g. `sp_illum_2deg_2027_1080p30.mp4`) and TIFF frame directories `frames/1920x1080_16x9_30p/{YEAR}/sp_illum.NNNN.tif` (2027 directory: 4,380 frames; frame 0001 = 1,843,738 bytes, V) | https://svs.gsfc.nasa.gov/4930 ; API https://svs.gsfc.nasa.gov/api/4930 ; frames https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004930/frames/1920x1080_16x9_30p/2027/ | V |
| svs5027 | 5027 "Illumination at the Moon's South Pole to 80°S, 2025 to 2028" | same, wider view | 2 h | 2025–2028, "17,532 time steps" | south of 80°S | MP4 (e.g. `sp_illum_10deg_2026_1080p30.mp4`, 2025 file 176.7 MB) + frame dirs `frames/1920x1080_16x9_30p/{2025..2028}/` | https://svs.gsfc.nasa.gov/5027 ; https://svs.gsfc.nasa.gov/api/5027 | V (API) |
| svs5228 | 5228 "Lunar South Pole Illumination with Earth and Sun" | animation of Sun and Earth motion as seen near the pole | n/a | six months compressed | horizon view | MP4 10.5 MB | https://svs.gsfc.nasa.gov/5228 | V (API) |
| svs_other | 5127 "Lunar South Pole Terrain in Coded Color"; 5029 "Illumination at Schroedinger Basin"; 4893 "Shadows near the Moon's South Pole"; 4770 "From Apollo Sites To The South Pole" | context visualisations | n/a | n/a | n/a | n/a | https://svs.gsfc.nasa.gov/api/search/?search=lunar%20south%20pole%20illumination | V (search API) |

Source: [SVS API 4930](https://svs.gsfc.nasa.gov/api/4930); [SVS API 5027](https://svs.gsfc.nasa.gov/api/5027); [SVS API 5228](https://svs.gsfc.nasa.gov/api/5228); [SVS search API](https://svs.gsfc.nasa.gov/api/search/?search=lunar%20south%20pole%20illumination&limit=15)

#### 2.5 Illumination-related findings for specific sites (PGDA 78, Barker et al. 2021)
- "Between Jan. 1, 2024 and Jan. 1, 2026, Site 1 has the most area with average illumination > 70% at 1 m above the surface and RoIs 4–6 at this site generally have the most favorable illumination conditions even considering their uncertainties. At 5 m above the surface, the effect of LDEM uncertainties on illumination conditions are significantly reduced, and Site 1 has longer continuous illumination periods than the other sites." — [PGDA 78](https://pgda.gsfc.nasa.gov/products/78)
- Trek also serves the LOLA Earth-visibility and sky-visibility rasters as tiles/image services: `AVGVISIB_85S_060M_201608_EARTH_SP` (60 m; 104,913,550 bytes), `AVGVISIB_75S_120M_201608_EARTH_SP`, `AVGVISIB_65S_240M_201608_EARTH_SP`, `SKYV_65S_240M_SP`, `LRO_LOLA_Illumination_SPole65S_240m` ("LOLA Permanently Shadowed Regions Southpole 240m"), plus `WAC_POLE_ILL_PCT_SOUTH_100M` and `WAC_POLE_ILL_TWI_SOUTH_100M`. — [Trek search API](https://trek.nasa.gov/moon/TrekServices/ws/index/polar/searchItems?start=0&rows=2147483647&facetKeys=itemType&facetValues=product)

### Inferences
- The SVS frame sets are the only NASA-published dated lighting time series; they are perspective/orthographic renders at 1920x1080 without georeferencing metadata, so they suit visual validation or UI playback rather than quantitative window computation. Cadence check: 4,380 frames/year x 2 h = 8,760 h, consistent with the stated two-hour interval.
- Average-illumination rasters rank sites but cannot answer "is the Sun up during a given 6-day stay"; landing windows need a horizon-based time-series computation (section 7) using DEM + ephemeris.
- The 2016 AVGVISIB products are derived from pre-adjustment LOLA DEMs at 60–240 m/px; at landing-site scale (tens of metres) local illumination can differ materially, which is why Barker et al. 2021 recomputed illumination on 5 m DEMs with clones.

### Gaps
- Scaling factor/offset for AVGVISIB/LPSR IMG DNs were not read from the labels (labels exist: e.g. `avgvisib_85s_060m_201608.lbl`, 4,094 bytes).
- No numeric per-site time-series illumination product (e.g. the Barker 2021 Jan 2024–Jan 2026 series) was found as a download; PGDA only invites contact.
- WAC_POLE_MOVIE_SOUTH frame naming and count not extracted.

---

## 3. Volatile and thermal products

### Takeaway
Diviner polar temperatures exist as PDS ASCII point tables (240 m polar stereographic grids; diurnal and new seasonal sets) and as ready-made Trek raster layers (summer/winter min/avg/max and thresholded classes); ice-stability depth exists as the Diviner Polar Resource Product (triangular mesh table with `ice_depth`) and as Trek 240 m rasters; LAMP, Mini-RF, LP neutron WEH and M3 ice detections are all available, mostly at 240 m to 5 km resolution.

### Cited Findings

| id | name | instrument/mission | variable | res | coverage | format | size | url | licence | status / notes |
|---|---|---|---|---|---|---|---|---|---|---|
| dlre_prp_south | Diviner Polar Resource Product, south (`dlre_prp_south.tab`) | LRO Diviner (model of Paige et al. 2010) | per-triangle `temp_avg`, `temp_max` (K), `ice_depth`; columns: tri1_x … tri3_z (vertices, km), tri_clon, tri_clat, tri_calt | triangular mesh; 2,880,000 rows | south polar (first rows at ~75.9°S) | PDS3/PDS4 fixed-width ASCII, 210 bytes/row, 15 columns | 604,800,210 bytes (L) | https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.tab (+ `.lbl`, `.xml`; format `label/dlre_prp.fmt`) | PDS | V (range read); `DATA_SET_ID = "LRO-L-DLRE-5-PRP-V2.0"`, version 2, created 2018-02-21; value −999 seen where no ice depth |
| dlre_pcp_diurnal_south | Diviner Polar Cumulative Products, diurnal, south: `pcp_avg_tbol_pols_sum_ltim{01..}_240.tab` (also `diurnal/slon/pols/`) | LRO Diviner | average bolometric brightness temperature `tbol` (K) per local-time bin; columns x, y (polar stereographic, normalised by 1737.4 km), clon, clat, tbol | 240 m (per file name) | south polar | ASCII table + PDS3 `.lbl` + PDS4 `.xml` | ~190–213 MB per file (e.g. ltim01 212,653,759 bytes) | https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_pcp/diurnal/ltim/pols/ | PDS | L; ODE counts 912 PCP products total |
| dlre_pcp_seasonal_south | Diviner PCP seasonal, south: `pcp_avg_tbol_pols_ls030_slon{01..}_240.tab` (and further `lsNNN` sets) | LRO Diviner (Williams et al. 2019 seasonal polar temperatures) | `tbol` per season (Ls) and sub-solar-longitude bin | 240 m | south polar | ASCII table + PDS4 `.xml` only | ~187–220 MB per file (e.g. ls030_slon01 215,979,356 bytes) | https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_pcp/seasonal/slon/pols/ | PDS | L; "new seasonal PCP products do not include PDS3 labels" |
| dlre_gcp / gdr / ghrm | Diviner Global Cumulative Products, GDR L2/L3, Global High-Resolution Mosaics | LRO Diviner | brightness temperatures, global | 128 ppd tables (GCP `global_cumul_avg_cyl_*_002.tab`, 156,211,313 bytes each) | global | ASCII / IMG / GeoTIFF | large | https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/ | PDS | L; GHRM IMG needs ENVI >= 6.0 per readme |
| trek_dlre_seasonal_sp | Trek Diviner south-pole layers: `polar_south_80_{summer,winter}_{min,avg,max}`, `polar_south_80_{summer,winter}_amplitude`, `polar_south_80_sw_max_diff`; thresholded `Diviner_Temp_SP_80_{summer,winter}_{min,avg,max}_{below_50K,50-100K,above_100K}`; `DIVINER_{summer,winter}_Max_Temp_SP_below110K_240mp`; older `LRO_Diviner_Temp_{Avg,Max}_Clr_SPole80_135mp` | LRO Diviner via NASA Trek | seasonal min/avg/max temperature (K) and derived classes | 240 m (res field 240.0 for `polar_south_80_summer_max`) | 80–90°S (bbox about ±304 km) | WMTS tiles (PNG) and, for some, ArcGIS ImageServer | ~26.2 MB each raw; `_RGB` ~19.7 MB | WMTS root `https://trek.nasa.gov/tiles/Moon/SP/{label}` e.g. https://trek.nasa.gov/tiles/Moon/SP/polar_south_80_summer_max | NASA Trek | L |
| trek_ice_depth_sp | Ice Stability at Depth, SP: `sp_ice_depth_new_240m.mat_today_27-Oct-2016`, `sp_ice_depth_new_240m.mat_paleo_27-Oct-2016` | Diviner-based model (Trek category "IceStabilityatDepth") | depth at which ice is stable, present-day and paleo spin axis | 240 m | bbox ±300 km | WMTS + ImageServer | 25,218,882 / 25,218,890 bytes | https://trek.nasa.gov/tiles/Moon/SP/sp_ice_depth_new_240m.mat_today_27-Oct-2016 ; ImageServer https://trek.nasa.gov/moon/trekarcgis/rest/services/sp_ice_depth_new_240m_mat_today_27_Oct_2016/ImageServer | NASA Trek | L |
| trek_dlre_rock_sp | `Diviner_avg_RockAbundance_SP` (Trek category Hazard/Abundance) | LRO Diviner | rock abundance | n/a | south polar | Trek | 67,275,558 bytes | via Trek | NASA Trek | L |
| lamp_gdr_south | LAMP GDR south polar maps: `LAMP_80s_240mpp_{long,lya,on,off}_{albed,brite,illum}_01.img`, `LAMP_80s_240mpp_ratio_{albed,brite}_01.img`, monthly variants `_{YYYYMM}_01`; also COUNTS, DATA_QUALITY, ERROR, EXPOSURE, PHOTONS directories | LRO LAMP | FUV albedo, brightness, illumination per band, band ratio | 240 m | 80–90°S | PDS3 IMG + detached `.lbl`, polar stereographic | `LAMP_80s_240mpp_long_albed_01.img` 24M; 56 south files in each of ALBEDO/BRIGHTNESS/ILLUMINATION | https://pds-imaging.jpl.nasa.gov/data/lro/lamp/gdr/LROLAM_2001/DATA/ALBEDO/ (and sibling dirs) | PDS | V; `LRO-L-LAMP-5-GDR-V1.0`; ODE count 694 GDR products; ACAO `*` |
| trek_lamp_albedo_sp | `LRO_LAMP_Albedo_Clr_SPole80_240mp` | LRO LAMP | colourised albedo | 240 m | 80–90°S | Trek | 18,785,656 bytes | via Trek | NASA Trek | L |
| minirf_global_cpr | Mini-RF global mosaics: `global_cpr_128ppd_simp_0c.img` (also `lpr`, `m`, `mc`, `ml`, `oc`, `sc`, `s1`–`s4`), 32 ppd versions | LRO Mini-RF (S-band) | CPR, Stokes parameters, etc. | 128 ppd (~237 m at equator) | global simple cylindrical | PDS3 IMG + PDS4 xml | 4,246,732,800 bytes each | https://pds-geosciences.wustl.edu/lro/lro-l-mrflro-5-global-mosaic-v1/lromrf_1001/data/128ppd/ | PDS | L |
| minirf_polar_mosaic_s | Mini-RF south polar mosaics: `lsz_xxxxx_3cp_piu_90s000_v1.img`, `lsz_xxxxx_3s1_piu_90s000_v1.img` (428,158,864 bytes each), `..._pfu_...` (6,697,744 bytes), and higher-resolution east/west-looking `lsz_04790_3cp_pju_90s000_e_v1.img`, `lsz_05034_3cp_pju_90s000_w_v1.img` (1,712,469,924 bytes each) with `_phu_` (107,039,716 bytes) | LRO Mini-RF | `3cp` and `3s1` layers (CPR and S1 per Trek titles) | not read from labels | polar stereographic centred 90°S | PDS3 IMG + `.lbl` | as listed | https://pds-geosciences.wustl.edu/lro/lro-l-mrflro-4-cdr-v1/lromrf_0005/data/sar/mosaics/ | PDS | L |
| trek_minirf_sp | `LRO_MiniRF_CPR_SPole70_118mp`, `LRO_MiniRF_S1_SPole70_118mp` (428,242,294 bytes each), `Mini-RF_SP_cpr_128ppd_v2`, `minirf_s1_49dnorm` ("Mini-RF CPR 15mpp, Malapert"); Chandrayaan-1 `CH1_MiniSAR_CPR_SPole80_75mp`, `CH1_MiniSAR_S1_SPole80_75mp` | Mini-RF; Mini-SAR | CPR, S1 | 118 m; 75 m; 15 m (Malapert) | 70–90°S / 80–90°S | Trek WMTS | as listed | via Trek | NASA Trek | L |
| m3_ice_sp | M3 Ice Exposures, South Polar (`SP_IceLoc_280m`) | Chandrayaan-1 M3 (Li et al. 2018, doi:10.1073/pnas.1802345115) | ice-bearing pixel locations | 280 m | bbox x −383,180…338,382 m, y −337,537…401,776 m | ArcGIS feature service | 45,750 bytes | https://trek.nasa.gov/moon/trekarcgis/rest/services/SP_IceLoc_280m/MapServer/0 | NASA Trek | L (service not queried for feature count) |
| lp_weh_sp | LP NS Water Equivalent Hydrogen SP (`sp_weh_5km_adapt.map`, colourised `sp_weh_5km_adapt.map_clr`) | Lunar Prospector Neutron Spectrometer | water-equivalent hydrogen | 5 km (res field 5000.0) | bbox ±600 km | Trek WMTS + ImageServer | 234,248 bytes | https://trek.nasa.gov/tiles/Moon/SP/sp_weh_5km_adapt.map ; https://trek.nasa.gov/moon/trekarcgis/rest/services/sp_weh_5km_adapt_map/ImageServer | NASA Trek | L |
| lend_rdr | LEND PDS4 bundle: raw/reduced/derived daily products 2009–2026; "Averaged LEND Counts" products `lend_rdr_ald{e,n,s}_20090915`, `lend_rdr_ald{e,n,s}_20111211` | LRO LEND | neutron counts (averaged maps `alds` = south, by naming) | not read | polar | PDS4 | n/a | https://pds-geosciences.wustl.edu/lro/lro-l-lend-2-edr-v1/lrolen_0xxx/data/ ; docs https://pds-geosciences.wustl.edu/lro/lro-l-lend-2-edr-v1/lrolen_0xxx/document/lend_rdr_sis.pdf | PDS | L; ODE counts RDRALD4 = 6, RDRDLD4 = 5,511 |
| lola_albedo_1064 | LOLA 1064 nm normal albedo `ldam_50s_1000m` / `ldam_50s_3000m` | LRO LOLA | active reflectance | 1 km / 3 km | 50–90°S | IMG float / JP2 | 25,644,096 / 2,849,344 bytes (float) | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/float_img/ | PDS | L |
| kaguya_sp_minerals | Kaguya Spectral Profiler abundance maps SP: `sp_feo_mlemelin_031417`, `sp_plg_…`, `sp_opx_…`, `sp_cpx_…`, `sp_olivine_…` | Kaguya SP + LOLA (Lemelin) | FeO, plagioclase, pyroxenes, olivine | n/a | south polar | Trek | 13.1–26.2 MB | via Trek | NASA Trek | L |
| lpi_sp_atlas | LPI Lunar South Pole Atlas (PDF maps: LOLA 20 m elevation 80–90°S with PSRs > 10 km2; "Near-Surface Temperatures Modeled for the Moon's South Pole (85°S to Pole)" after Paige et al. 2010) | LPI/USRA (NASA-funded) | cartographic PDFs | n/a | 80–90°S, 85–90°S | PDF | 30.4 MB, 5.3 MB, 22.5 MB | https://www.lpi.usra.edu/lunar/lunar-south-pole-atlas/ | LPI | V |

Sources: [Diviner derived bundle root](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/); [bundle readme](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/readme.txt); [dlre_prp_south.lbl](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.lbl); [dlre_pcp.fmt](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/label/dlre_pcp.fmt); [PCP seasonal south listing](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_pcp/seasonal/slon/pols/); [PCP diurnal south listing](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_pcp/diurnal/ltim/pols/); [LAMP GDR volume](https://pds-imaging.jpl.nasa.gov/data/lro/lamp/gdr/LROLAM_2001/); [Mini-RF global mosaic 128ppd](https://pds-geosciences.wustl.edu/lro/lro-l-mrflro-5-global-mosaic-v1/lromrf_1001/data/128ppd/); [Mini-RF polar mosaics](https://pds-geosciences.wustl.edu/lro/lro-l-mrflro-4-cdr-v1/lromrf_0005/data/sar/mosaics/); [LEND data dir](https://pds-geosciences.wustl.edu/lro/lro-l-lend-2-edr-v1/lrolen_0xxx/data/); [Trek search API](https://trek.nasa.gov/moon/TrekServices/ws/index/polar/searchItems?start=0&rows=2147483647&facetKeys=itemType&facetValues=product); [LPI South Pole Atlas](https://www.lpi.usra.edu/lunar/lunar-south-pole-atlas/)

Key literature DOIs (titles confirmed via Crossref on 2026-11-14): Paige et al. 2010 "Diviner Lunar Radiometer Observations of Cold Traps in the Moon's South Polar Region" doi:10.1126/science.1187726; Williams et al. 2017 "The global surface temperatures of the Moon as measured by the Diviner Lunar Radiometer Experiment" doi:10.1016/j.icarus.2016.08.012; Williams et al. 2019 "Seasonal Polar Temperatures on the Moon" doi:10.1029/2019JE006028; Gladstone et al. 2012 "Far-ultraviolet reflectance properties of the Moon's permanently shadowed regions" doi:10.1029/2011JE003913; Hayne et al. 2015 "Evidence for exposed water ice in the Moon's south polar regions from LRO ultraviolet albedo and temperature measurements" doi:10.1016/j.icarus.2015.03.032; Li et al. 2018 "Direct evidence of surface exposed water ice in the lunar polar regions" doi:10.1073/pnas.1802345115; Sanin et al. 2017 "Hydrogen distribution in the lunar polar regions" doi:10.1016/j.icarus.2016.06.002; Fisher et al. 2017 (LOLA reflectance + Diviner temperature evidence for surface water ice) doi:10.1016/j.icarus.2017.03.023. — [Crossref API](https://api.crossref.org/works/10.1029/2019JE006028)

### Inferences
- For an app, the Trek 240 m Diviner seasonal rasters and ice-stability-depth rasters are the lowest-effort volatile/thermal inputs (small files, tile/image services with CORS); the PDS PCP tables are point lists that must be gridded (x,y are normalised stereographic coordinates: multiply by 1737.4 km).
- The pre-thresholded Trek classes (<50 K, 50–100 K, >100 K, max <110 K) indicate the cut-offs NASA's portal treats as meaningful for cold-trapping; 110 K is the commonly used water-ice stability threshold in the literature (not verified in this session).
- No single NASA "water-ice favourability" raster was found; a composite must be built from Diviner max temperature / ice-stability depth, LAMP ratio, LOLA albedo, M3 detections, Mini-RF CPR and neutron WEH.

### Gaps
- Li et al. 2018 supplementary data location at PNAS not fetched (only the Trek feature layer verified).
- LEND gridded polar hydrogen maps (Sanin et al. 2017) as rasters: not located; only LEND "averaged counts" products seen by name.
- LAMP band definitions (Lyman-alpha / on-band / off-band / long), units and scaling were not read from labels.
- Lunar Prospector reduced hydrogen products at PDS (page `reduced_special.html`) did not yield file links.
- Mini-RF polar mosaic resolution (pixel scale) not read from labels.

---

## 4. Site and feature vectors (Artemis regions, nomenclature, scarps, anthropogenic sites)

### Takeaway
An official machine-readable polygon layer for the **13 Artemis III candidate regions (2022)** exists on NASA Moon Trek as an ArcGIS feature service (`A3_Named_regions_SP`), returning simple square polygons in south polar stereographic metres. No equivalent layer for the **nine regions announced 2024-10-28** was found; NASA publishes only names and a figure.

### Cited Findings

#### 4.1 Artemis III 2022 candidate regions (13) — polygons from NASA Trek

Service: `https://trek.nasa.gov/moon/trekarcgis2/rest/services/A3_Named_regions_SP/MapServer/0` (layer UUID `2a261565-52ca-42e2-ab67-01427512dbea`, created 2022-08-22, 3,565 bytes; fields `FID`, `label`, `selected`). Query used: `.../MapServer/0/query?where=1%3D1&outFields=*&f=json` (ACAO `*`). CRS returned: `PROJCS["Moon2000_spole" ... SPHEROID["Moon_2000_IAU_IAG",1737400.0,0.0] ... PROJECTION["Stereographic_South_Pole"] ... central_meridian 0, standard_parallel_1 -90, metres]`. An equirectangular twin `A3_Named_regions` (UUID `82d31599-9957-4d79-b30a-720c918d1515`) also exists. — [Trek A3 feature query](https://trek.nasa.gov/moon/trekarcgis2/rest/services/A3_Named_regions_SP/MapServer/0/query?where=1%3D1&outFields=*&f=json); [Trek layer services](https://trek.nasa.gov/moon/TrekServices/ws/index/getLayerServices?uuid=2a261565-52ca-42e2-ab67-01427512dbea)

Polygon extents are quoted from the service (x, y in metres). Centre lat/lon were computed in this session from the polygon centre with the spherical polar stereographic inverse (lat = −90 + 2·atan(rho/(2R)), lon = atan2(x, y), R = 1,737,400 m), i.e. they are derived values, not NASA-published numbers.

| FID | label (as served) | x_min (m) | x_max (m) | y_min (m) | y_max (m) | side (km) | centre x (m) | centre y (m) | centre lat (deg) | centre lon (deg E) |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Amundsen Rim | 154000 | 174000 | 51500 | 71500 | 20 | 164000 | 61500 | −84.229 | 69.444 |
| 1 | Nobile Rim 2 | 147000 | 167000 | 85000 | 105000 | 20 | 157000 | 95000 | −83.954 | 58.822 |
| 2 | Haworth | −52900 | −23100 | 75600 | 105400 | 29.8 | −38000 | 90500 | −86.764 | −22.777 |
| 3 | Faustini Rim A | 54000 | 74000 | −10000 | 10000 | 20 | 64000 | 0 | −87.890 | 90.000 |
| 4 | de Gerlache Rim 2 | −58500 | −38500 | 13000 | 33000 | 20 | −48500 | 23000 | −88.230 | −64.628 |
| 5 | Connecting Ridge Extension | −38700 | −18700 | −16100 | 3900 | 20 | −28700 | −6100 | −89.032 | −101.999 |
| 6 | Connecting Ridge | −19000 | −3000 | −20000 | −4000 | 16 | −11000 | −12000 | −89.463 | −137.490 |
| 7 | Nobile Rim 1 | 74000 | 94000 | 100000 | 120000 | 20 | 84000 | 110000 | −85.438 | 37.367 |
| 8 | Peak Near Shakleton (sic) | 22000 | 38000 | −28000 | −12000 | 16 | 30000 | −20000 | −88.811 | 123.690 |
| 9 | de Gerlache Rim | −45000 | −29000 | 7000 | 23000 | 16 | −37000 | 15000 | −88.683 | −67.932 |
| 10 | Leibnitz Beta Plateau | 65000 | 81000 | 110000 | 126000 | 16 | 73000 | 118000 | −85.427 | 31.743 |
| 11 | Malapert Massif | −11000 | 10000 | 111000 | 132000 | 21 | −500 | 121500 | −85.995 | −0.236 |
| 12 | de Gerlache-Kocher Massif | −123400 | −103400 | −66100 | −46100 | 20 | −113400 | −56100 | −85.830 | −116.322 |

- NASA description attached to the layer: the 13 regions were "announced by NASA on August 19 2022"; "Each of these regions is located within six degrees of latitude of the lunar South Pole"; evaluated "using criteria including terrain slope, ease of communications with Earth, and lighting conditions"; "All 13 regions contain sites that provide continuous access to sunlight throughout a 6.5-day period – the planned duration of the Artemis III surface mission"; goal "to land close enough to a permanently shadowed region to allow crew to conduct a moonwalk". — [Trek search API record for A3_Named_regions_SP](https://trek.nasa.gov/moon/TrekServices/ws/index/polar/searchItems?start=0&rows=2147483647&facetKeys=itemType&facetValues=product); 2022 release page https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/ (URL returned 200; text not re-read)

#### 4.2 Artemis III 2024 refined regions (9)
- NASA release dated Oct 28, 2024: "The refined candidate Artemis III lunar landing regions are, in no priority order: Peak near Cabeus B; Haworth; Malapert Massif; Mons Mouton Plateau; Mons Mouton; Nobile Rim 1; Nobile Rim 2; de Gerlache Rim 2; Slater Plain". Factors: "science potential, launch window availability, terrain suitability, communication capabilities with Earth, and lighting conditions", plus "combined trajectory capabilities of NASA's SLS ... Orion ... and Starship HLS". — [NASA release 2024-10-28](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/)
- NTRS extended abstract 20250011660 "Artemis III Site Selection Update: Downselection From Thirteen to Nine Candidate Regions" (T. George, M. A. Rubio, S. J. Lawrence, P. Curell; for LPSC 2026): "Surface stay duration varies approximately 5.75 to 6.25 days depending on mission epoch"; operations from NRHO impose "strong temporal and geometric constraints on surface access"; constraints "evaluated simultaneously on a calendar basis"; terrain safety "focused on minimizing the degree of slope variability within a landing ellipse"; hazards include "impact craters, block populations, and rough or highly variable terrain"; "If Artemis III employs a Direct-to-Earth (DTE) communication architecture, regions with greater Earth visibility are preferred"; "south polar illumination conditions exhibiting strong seasonal variability and shifting approximately 2-3 weeks per year"; "individual regions typically provide limited viable opportunities when all constraints are simultaneously satisfied". — [NTRS 20250011660](https://ntrs.nasa.gov/api/citations/20250011660) (download: https://ntrs.nasa.gov/api/citations/20250011660/downloads/AIIIUpdateLPSC2026.docx)
- Secondary press reporting (not a NASA page) states each region is "approximately 15 by 15 kilometers" and a landing site is a location "with an approximate 100-meter radius". — [UPI 2024-10-28](https://www.upi.com/Science_News/2024/10/28/nasa-artemis-moon-landing-regions/5971730152372/); [Space.com](https://www.space.com/space-exploration/artemis/nasa-announces-9-possible-moon-landing-sites-for-artemis-3-lunar-mission)
- LROC controlled NAC mosaics exist under names matching several 2024 regions: `NAC_ROI_CABEUSPK*` "Peak Near Cabeus B", `NAC_ROI_MOUTNPLT*` "Mons Mouton Plateau", `NAC_ROI_MTMOUTON*` "Nobile Rim 1 and Mons Mouton (Leibnitz Beta Plateau)", `NAC_ROI_NOBILE02*` "Nobile Rim 2", `NAC_ROI_HAWORTH_*`, `NAC_ROI_MALAPERT*`. — [LROC RDR catalogue](https://data.lroc.im-ldi.com/lroc/rdr_product_select)

#### 4.3 Other vector datasets

| id | name | content | format | size | url | licence | status |
|---|---|---|---|---|---|---|---|
| iau_moon_nomenclature | IAU Gazetteer of Planetary Nomenclature, Moon centre points | all approved lunar feature names with coordinates | Shapefile ZIP; KMZ | ZIP 23,845,070 bytes (V) | https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.zip ; KMZ https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.kmz ; index https://planetarynames.wr.usgs.gov/GIS_Downloads | USGS/IAU | V |
| lroc_polar_scarps | SHAPEFILE_POLAR_SCARP_LOCATIONS — lobate scarps at the poles (±65–90°), Watters et al. 2015 (doi:10.1130/G37120.1) | polylines/points + raw XLS/CSV | ZIP (180 and 360 longitude domains), CSV, XLS | ZIP 1,361,971 bytes (V); CSV 4.79 KB; XLS 28.5 KB | https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/SHAPEFILE/POLAR_SCARP_LOCATIONS/POLAR_SCARP_LOCATIONS_180.ZIP (also `_360.ZIP`, `POLAR_SCARP_LOCATIONS.CSV`) | PDS | V |
| lroc_lobate_scarps | SHAPEFILE_LOBATE_SCARPS — lobate scarps 60°S–60°N | polylines | ZIP | n/a | https://data.lroc.im-ldi.com/lroc/view_rdr/SHAPEFILE_LOBATE_SCARPS | PDS | L (catalogue) |
| lroc_anthropogenic | SHAPEFILE_ANTHROPOGENIC_OBJECTS — coordinates of spacecraft, rovers, payloads, impact sites (Wagner et al. 2017, doi:10.1016/j.icarus.2016.05.011) with `COORD_SRC` | points | ZIP (180/360) | 1,569,089 bytes (V) | https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/SHAPEFILE/ANTHROPOGENIC_OBJECTS/ANTHROPOGENIC_OBJECTS_180.ZIP | PDS | V |
| trek_anthropogenic_sp | Lunar Anthropogenic Impacts and Spacecraft Sites, S Pole (`Lunar_Anthropogenic_Impacts_and_Spacecraft_SP`) | points | Trek feature service | 11,061 bytes | via Trek | NASA Trek | L |
| lroc_craters_spole | SHAPEFILE_LROC_5TO20KM_CRATERS_SPOLE — craters 5–20 km, 90°S–60°S | polygons/points | ZIP | n/a | https://data.lroc.im-ldi.com/lroc/view_rdr/SHAPEFILE_LROC_5TO20KM_CRATERS_SPOLE | PDS | L |
| lroc_cx_targets | SHAPEFILE_CX_TARGETS — Constellation Program regions of interest | polygons | ZIP | n/a | https://data.lroc.im-ldi.com/lroc/view_rdr/SHAPEFILE_CX_TARGETS | PDS | L |
| lroc_footprints_sp | SHAPEFILE_NAC_SP_* / SHAPEFILE_WAC_SP_* (per mission phase), SHAPEFILE_STEREO_OBSERVATIONS_SP, SHAPEFILE_FEATURE_MOSAICS_SP, SHAPEFILE_NAC_DTMS, SHAPEFILE_CONTROLLED_MOSAICS | image/DTM footprints 60°S–90°S | ZIP | n/a | https://data.lroc.im-ldi.com/lroc/rdr_product_select?filter[text]=SHAPEFILE (86 shapefile products) | PDS | V (catalogue) |
| trek_rockfall_sp | Rock Fall Locations, South Pole (`Lunar_Rock_Fall_Spolar`) | points | Trek feature service | 5,101 bytes | via Trek | NASA Trek | L |
| usgs_geologic_map | Unified Geologic Map of the Moon, 1:5M, 2020 (Trek SP layers: `Unified_Global_Geologic_Map_of_the_Moon_Geologic_Units_SP`, `..._Geologic_Contacts_SP`, `..._Linear_Features_SP`) | geologic units, contacts, linear features | GIS ZIP; raster ZIP | n/a | https://asc-astropedia.s3.us-west-2.amazonaws.com/Moon/Geology/Unified_Geologic_Map_of_the_Moon_GIS_v2.zip ; page https://astrogeology.usgs.gov/search/map/unified_geologic_map_of_the_moon_1_5m_2020 | USGS | L |
| trek_endurance_a | Endurance-A concept traverse: `EnduranceA_Path_SouthernTraverse_v2_SP`, `EnduranceA_Waypoints_SouthernTraverse_v2_SP` and coverage layers | rover traverse path, science stations | Trek feature services | 3,973,336 bytes (path v2) | via Trek | NASA Trek | L |
| trek_im1 | IM-1 landing site products: `LRO_NAC_DEM_3_5mpp_IM_1_LandingSite_SP` (62,941,084 bytes), `LRO_LOLA_NAC_DEM_3_5mpp_IM_1_LandingSite_SP`, pre/post-landing ortho mosaics 1 m/px | landing-site DEM and orthos | Trek raster | as listed | via Trek | NASA Trek | L |
| pgda78_rois | Per-site ROI shapefiles (`{Site}_ROIs.tgz`) for PGDA 5 m sites | ROI polygons used by Barker et al. 2021 | tgz of shapefiles | Site01: 2,934 bytes (V) | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_ROIs.tgz | PGDA | V |

Sources: [USGS GIS downloads](https://planetarynames.wr.usgs.gov/GIS_Downloads); [SHAPEFILE_POLAR_SCARP_LOCATIONS](https://data.lroc.im-ldi.com/lroc/view_rdr/SHAPEFILE_POLAR_SCARP_LOCATIONS); [SHAPEFILE_ANTHROPOGENIC_OBJECTS](https://data.lroc.im-ldi.com/lroc/view_rdr/SHAPEFILE_ANTHROPOGENIC_OBJECTS); [LROC shapefile catalogue](https://data.lroc.im-ldi.com/lroc/rdr_product_select); [Trek search API](https://trek.nasa.gov/moon/TrekServices/ws/index/polar/searchItems?start=0&rows=2147483647&facetKeys=itemType&facetValues=product); [USGS unified geologic map](https://astrogeology.usgs.gov/search/map/unified_geologic_map_of_the_moon_1_5m_2020)

### Inferences
- The 2022 Trek polygons are axis-aligned squares of 16, 20, 21 or 29.8 km side in stereographic x/y, i.e. schematic region boxes rather than surveyed boundaries; they are suitable as app "regions of interest" but not as landing ellipses.
- For the 2024 set, five names carry over unchanged from the 2022 polygons (Haworth, Malapert Massif, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2); "Mons Mouton" corresponds to the feature formerly called Leibnitz Beta (LROC product titles pair "Mons Mouton (Leibnitz Beta Plateau)"). Whether the 2024 boxes equal the 2022 boxes is not confirmed. Polygons for Peak near Cabeus B, Mons Mouton Plateau and Slater Plain would have to be digitised from the NASA figure or approximated from LROC ROI mosaic footprints.

### Gaps
- No official shapefile/GeoJSON/KML for the nine 2024 regions was found on Trek (both polar and equirectangular indexes searched for "Artemis"). LROC/LPI/NTRS were not exhaustively searched because the web-search budget ran out.
- Region size "15 by 15 km" comes from press reports, not from a NASA page fetched here; it conflicts with the 16–30 km boxes of the 2022 Trek layer.
- Feature counts/attributes of `PSR_SP`, `SP_IceLoc_280m` and the anthropogenic layers were not queried.

---

## 5. Access points and APIs

### Takeaway
Four NASA/USGS services are usable programmatically with open CORS: PDS ODE REST (product search), Moon Trek (Solr-style catalogue search + WMTS tiles + ArcGIS Image/Feature services, including point "identify" on the 5 m DEM), USGS STAC (CC0 analysis-ready COGs), and LROC's PDS file host. JPL Horizons works for Sun/Earth azimuth–elevation at a lunar surface point but returned no CORS header, and PGDA/PDS Geosciences/imbrium/NAIF file hosts also returned none, so browser apps need a proxy or pre-processed tiles for those.

### Cited Findings

#### 5.1 Endpoint catalogue

| id | service | endpoint (verified 2026-11-14) | what it does | response | CORS header observed (request sent with `Origin:`) | notes |
|---|---|---|---|---|---|---|
| ode_rest | PDS Geosciences ODE REST v2.1.6 | `https://oderest.rsl.wustl.edu/live2/?query=product&results=fmp&output=JSON&target=moon&ihid=LRO&iid=LOLA&pt=GDRDEM&limit=3&minlat=-90&maxlat=-87&westlon=0&eastlon=360` | product search by target/instrument host (`ihid`)/instrument (`iid`)/product type (`pt`) and bounding box; returns footprints, labels, file URLs (`External_url`, `FilesURL`) | JSON or XML | `Access-Control-Allow-Origin: *` | manual: https://oderest.rsl.wustl.edu/ODE_REST_V2.1.6.pdf (1,819,825 bytes) |
| ode_iipt | ODE valid product-type list | `https://oderest.rsl.wustl.edu/live2/?query=iipy&odemetadb=moon&output=JSON` | lists every instrument-host/instrument/product-type with counts | JSON (132,411 bytes) | `*` | hosts for Moon: ARCB-NRAO, CE, CH1-ORB, CLEM, GRAIL, KPLO, LO, LP, LRO, SLN |
| ode_gds | ODE Granular Data System | `https://oderest.rsl.wustl.edu/livegds?query=lolardr&results=vsi&maxlat=-89.99&minlat=-90.0&westernlon=0.0&easternlon=1.0` ; Diviner: `...livegds?query=divinerrdr&results=vsi&...&channel=tffffffff` | extracts individual LOLA RDR shots / Diviner RDR records inside a lat/lon box | XML | `*` | manual: https://oderest.rsl.wustl.edu/GDS_REST_V2.0.pdf (974,255 bytes); async option `async=t`; web forms https://oderest.rsl.wustl.edu/GDSWeb/GDSLOLARDR.html |
| ode_web | Lunar ODE web UI | https://ode.rsl.wustl.edu/moon/ | search/download; "Footprint Coverage Downloads (Shapefile / KMZ for GIS)"; LOLA and Diviner RDR query tools | HTML | n/a | covers LRO, GRAIL, Clementine, LP, LO, Chandrayaan-1 (and KPLO ShadowCam per IIPT list) |
| trek_search | Moon Trek catalogue search | `https://trek.nasa.gov/moon/TrekServices/ws/index/polar/searchItems?start=0&rows=2147483647&facetKeys=itemType&facetValues=product` (use `eq` instead of `polar` for equirectangular) | returns every product with `productLabel`, `title`, `item_UUID`, `bbox`, `resolution`, `fileSize`, `projection`, `description` | JSON (Solr); polar numFound = 569 (396 with south-pole CRS), eq numFound = 1,256 | `*` | endpoint template from https://trek.nasa.gov/tiles/apidoc/config/config.json |
| trek_services | Trek layer service lookup | `https://trek.nasa.gov/moon/TrekServices/ws/index/getLayerServices?uuid={item_UUID}` | returns WMTS endpoint and ArcGIS Image/Feature service endpoints for a layer | JSON | `*` | |
| trek_wmts | Trek WMTS | `https://trek.nasa.gov/tiles/Moon/SP/{productLabel}/1.0.0/WMTSCapabilities.xml` ; tile template `https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_DEM_SPole875_5mp_v04/1.0.0//{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png` | pre-rendered tiles (PNG or JPG) | XML capabilities (7,849 bytes; 13 tile matrices for the 5 m DEM) | `*` | global sample: `https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/0/0/0.jpg`; API doc https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon |
| trek_imageserver | Trek ArcGIS ImageServer (numeric raster access) | `https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_SPole875_5mp_v04/ImageServer?f=json` ; point value: `.../ImageServer/identify?geometry={"x":10000,"y":-5000}&geometryType=esriGeometryPoint&returnGeometry=false&f=json` | metadata and pixel queries on the float DEM | JSON; service reports `pixelType F32`, 1 band, pixel size 5, extent −75840…75840, min/max −4382.5/2372.5, capabilities "Image,Metadata,Mensuration", max image 15000x4100 | `*` | identify at (10000, −5000) returned value "-2814.5" |
| trek_featureserver | Trek ArcGIS feature layers | `https://trek.nasa.gov/moon/trekarcgis2/rest/services/A3_Named_regions_SP/MapServer/0/query?where=1%3D1&outFields=*&f=json` ; `https://trek.nasa.gov/moon/trekarcgis/rest/services/PSR_SP/MapServer/0` ; `.../SP_IceLoc_280m/MapServer/0` | vector queries | JSON | `*` | |
| trek_meta | Trek abstract / metadata | `https://trek.nasa.gov/moon/TrekWS/rest/cat/abstract?label={productLabel}` ; `https://trek.nasa.gov/moon/TrekWS/rest/cat/metadata/fgdc/html?label={productLabel}` | text abstract, FGDC metadata | text/HTML | `*` | templates from Trek config; not individually exercised |
| usgs_stac | USGS Astrogeology STAC API (Analysis Ready Data) | `https://stac.astrogeology.usgs.gov/api/collections` ; items `.../collections/{id}/items?limit=…` ; docs https://stac.astrogeology.usgs.gov/docs/ | STAC search; lunar collections: `lunar_orbiter_laser_altimeter`, `kaguya_terrain_camera_usgs_dtms_v2_southpolar` (19,646 items), `..._v2_northpolar`, `..._v2_equi`, `kaguya_terrain_camera_usgs_dtms`, `kaguya_terrain_camera_{monoscopic,stereoscopic,spsupport}_uncontrolled_observations` | JSON (64,658 bytes) | `*` (API and S3 assets) | every collection `license: CC0-1.0` |
| usgs_astropedia | USGS Astropedia | https://astrogeology.usgs.gov/search/map/{slug} ; files on `https://planetarymaps.usgs.gov/mosaic/` and `https://asc-astropedia.s3.us-west-2.amazonaws.com/Moon/` | product pages with direct downloads | HTML | planetarymaps: `*`, range requests OK | unknown slugs return a generic catalogue page with HTTP 200 (soft 404) |
| lroc_rdr | LROC RDR catalogue | `https://data.lroc.im-ldi.com/lroc/rdr_product_select?filter[text]={TEXT}&per_page=100&commit=Search` ; product page `https://data.lroc.im-ldi.com/lroc/view_rdr/{NAME}` ; files `https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/...` | HTML catalogue of 4,155 RDR groups; filters: text, lat/lon/radius, bounding box, topographic flag, group type, prefix (NAC_ANAGLYPH, NAC_DTM, NAC_IFPASP, NAC_PHO, NAC_POLE, NAC_ROI, SHAPEFILE, WAC) | HTML | file host `*`, range requests OK | file browser at `pds.lroc.im-ldi.com/data/` is JavaScript-rendered; SIS: https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DOCUMENT/RDRSIS.PDF (2,528,722 bytes) |
| quickmap | LROC QuickMap | https://quickmap.lroc.im-ldi.com/ ; docs https://docs.quickmap.io/ | interactive map with LROC/LOLA/Diviner layers and analysis tools | web app | none observed on root | no public REST API endpoint was identified in this session |
| pgda | NASA GSFC PGDA | https://pgda.gsfc.nasa.gov/products ; files `https://pgda.gsfc.nasa.gov/data/...` | static file downloads | HTTP | **none observed** (range requests OK) | "48 Products and Counting" |
| pds_geo | PDS Geosciences Node | https://pds-geosciences.wustl.edu/lro/ | static directory listings | HTTP | **none observed** (range requests OK) | LRO bundles listed: lro-l-dlre-2-edr-v1, lro-l-dlre-4-rdr-v1, lro-l-lend-2-edr-v1, lro-l-lola-2-edr-v1, lro-l-lola-3-rdr-v1, lro-l-mrflro-*, urn-nasa-pds-lro_diviner_derived1/2, urn-nasa-pds-lro_minirf_bistatic |
| imbrium | LOLA PDS Data Node (MIT) | https://imbrium.mit.edu/ | mirror of LOLA archive, LRO radio science | HTTP | **none observed** (range requests OK) | |
| pds_img | PDS Cartography and Imaging Sciences Node | https://pds-imaging.jpl.nasa.gov/data/lro/lamp/ ; volume index https://pds-imaging.jpl.nasa.gov/volumes/lro.html | LAMP EDR/RDR/GDR | HTTP | `*` | |
| shadowcam_pds | ShadowCam PDS4 archive | https://pds.shadowcam.im-ldi.com/ | calibration, derived, document, observation | HTTP | `*` | bundle label `bundle_kplo-shadowcam.xml` (18,069 bytes) |
| horizons | JPL Horizons API v1.2 | `https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND='10'&OBJ_DATA=NO&MAKE_EPHEM=YES&EPHEM_TYPE=OBSERVER&CENTER='coord@301'&COORD_TYPE=GEODETIC&SITE_COORD='0,-89.5,0'&START_TIME='2027-01-01'&STOP_TIME='2027-01-02'&STEP_SIZE='6h'&QUANTITIES='4'` | Sun (COMMAND '10') or Earth ('399') azimuth/elevation from a lunar surface site (`coord@301`, SITE_COORD = E-lon deg, lat deg, alt km) | text or JSON | **no `Access-Control-Allow-Origin` header observed**; HEAD returns 405 | docs https://ssd-api.jpl.nasa.gov/doc/horizons.html; TLIST allows "up to 10,000 discrete output times" |
| webgeocalc | NAIF WebGeocalc | https://naif.jpl.nasa.gov/naif/webgeocalc.html ; API `https://wgc2.jpl.nasa.gov:8443/webgeocalc/api/kernel-sets` | server-side SPICE computations | JSON | none observed | API root returned 200 JSON |
| ntrs | NASA Technical Reports Server API | `https://ntrs.nasa.gov/api/citations/search?q=…` ; `https://ntrs.nasa.gov/api/citations/{id}` | document metadata/abstracts/downloads | JSON | not checked | |
| svs_api | NASA SVS API | `https://svs.gsfc.nasa.gov/api/{id}` ; `https://svs.gsfc.nasa.gov/api/search/?search=…` | visualisation metadata and media URLs | JSON | restricted origin (`https://tempo.multiverse.music`) | |
| eclipse | NASA eclipse pages | https://eclipse.gsfc.nasa.gov/lunar.html ; decade table https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2021.html | lunar-eclipse dates (Earth blocks the Sun as seen from the Moon) | HTML | none | |
| nasa_open_api | api.nasa.gov | https://api.nasa.gov/ | NASA Open APIs portal | HTML | `*` | no lunar-terrain endpoint was identified here (not examined in depth) |

Sources: [ODE REST home](https://oderest.rsl.wustl.edu/); [ODE IIPT query](https://oderest.rsl.wustl.edu/live2/?query=iipy&odemetadb=moon&output=JSON); [Lunar ODE](https://ode.rsl.wustl.edu/moon/); [Trek API doc](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon); [Trek config](https://trek.nasa.gov/tiles/apidoc/config/config.json); [Trek WMTS capabilities example](https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_DEM_SPole875_5mp_v04/1.0.0/WMTSCapabilities.xml); [Trek ImageServer example](https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_SPole875_5mp_v04/ImageServer?f=json); [USGS STAC](https://stac.astrogeology.usgs.gov/api/collections); [LROC RDR catalogue](https://data.lroc.im-ldi.com/lroc/rdr_product_select); [Horizons API doc](https://ssd-api.jpl.nasa.gov/doc/horizons.html); [Horizons example call](https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%2710%27&OBJ_DATA=NO&MAKE_EPHEM=YES&EPHEM_TYPE=OBSERVER&CENTER=%27coord@301%27&COORD_TYPE=GEODETIC&SITE_COORD=%270,-89.5,0%27&START_TIME=%272027-01-01%27&STOP_TIME=%272027-01-02%27&STEP_SIZE=%276h%27&QUANTITIES=%274%27); [PDS Geosciences LRO](https://pds-geosciences.wustl.edu/lro/); [imbrium](https://imbrium.mit.edu/); [NAIF WebGeocalc](https://naif.jpl.nasa.gov/naif/webgeocalc.html)

#### 5.2 Horizons behaviour verified for a lunar surface observer
- Example output header: "Target body name: Sun (10) {source: DE441}; Center body name: Moon (301); Center geodetic: 0.0, -89.5, 0.0 {E-lon(deg),Lat(deg),Alt(km)}; Center pole/equ: MEAN_ME (high precision); Center radii: 1737.4, 1737.4, 1737.4 km; Vis. interferer: EARTH; Atmos refraction: NO (AIRLESS)". Returned rows for 2027-Jan-01 00:00 to 2027-Jan-02 00:00 UT at 6 h steps: azimuth 263.107140 → 250.941297 deg, elevation 0.953942 → 0.834769 deg. — [Horizons example call](https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%2710%27&OBJ_DATA=NO&MAKE_EPHEM=YES&EPHEM_TYPE=OBSERVER&CENTER=%27coord@301%27&COORD_TYPE=GEODETIC&SITE_COORD=%270,-89.5,0%27&START_TIME=%272027-01-01%27&STOP_TIME=%272027-01-02%27&STEP_SIZE=%276h%27&QUANTITIES=%274%27)
- Quantity 4 definition (quoted): "Airless apparent azimuth and elevation of target center. Compensated for light-time, the gravitational deflection of light, stellar aberration, precession and nutation. Azimuth is measured clockwise from north ... Elevation angle is with respect to a plane perpendicular to the reference surface local zenith direction." Solar-presence flag `*` means "solar upper-limb on or above apparent horizon" of the reference sphere. — same source

#### 5.3 Selected Moon Trek south-pole layers with sizes (from the catalogue JSON)

| productLabel | title | res | bytes | services |
|---|---|---|---|---|
| LRO_LOLA_DEM_SPole875_5mp_v04 | LRO LOLA DEM, 87.5 deg v4, S Pole | 5 m | 3,685,593,580 | WMTS + ImageServer |
| Slope_LRO_LOLA_DEM_SPole875_5mp_v04 | LRO LOLA Slope, S Pole, 87.5 deg | 5 m | 3,684,693,102 | n/c |
| ColorSlope_{05below,10below,15below,20below,20above}_LRO_LOLA_DEM_SPole875_5m | LRO LOLA Color Slope <5 / <10 / <15 / <20 / >20 deg | 5 m | ~2.76 GB each | n/c |
| LRO_LOLA_DEM_SPole75_30mp_v04 | LRO LOLA DEM, 75 deg v4, S Pole | 30 m | 3,748,059,996 | n/c |
| LRO_LOLA_DEM_SPole45_100mp_v04 | LRO LOLA DEM, 45 deg v4, S Pole | 100 m | 3,321,818,468 | n/c |
| LOLA_RGB_Slope_below_{10,15,20}deg_SPole45 | LRO LOLA Color Slope classes, S Pole | 100 m | 510,203,951 each | n/c |
| LRO_LOLA_ClrSlope_SPole75S_120m | LOLA Slope Southpole 120m, Colorized | 120 m | 174,437,763 | n/c |
| LRO_LOLA_ClrRoughness_SPole75S_240m | LOLA Roughness Southpole 240m, Colorized | 240 m | 43,625,171 | n/c |
| {Site}_final_adj_5mpp_surf | PGDA 5 m site DEMs on Trek: Site01 39,181,558; Site04 41,208,538; Site06 57,452,012; Site07 40,011,564; Site11 41,295,350; Site20 (`_SP`) 41,001,578; Site23 61,158,798; DM2 62,521,426; Haworth 138,100,704; Shoemaker 65,304,998 | 5 m | as listed | n/c |
| {Site}_final_adj_5mpp_Slope | PGDA 5 m site slope: Site01 44,556,075; Site04 44,050,067; Site06 68,601,244; Site07 44,545,653; Site11 44,156,067; Site23 75,891,155; DM2 68,750,388; Haworth 155,082,078; Shoemaker 70,259,904 | 5 m | as listed | n/c |
| Site06/Site20 `_toterr_SP`, `_slperr_SP` | DEM error and slope error for Nobile Rim 1 and Leibnitz Beta Plateau | 5 m | 41–64 MB | n/c |
| LRO_NAC_Mosaic_SPole85.5_1mp | LRO LROC NAC Image Mosaic, S Pole | 1 m | 36,250,716,050 | n/c |
| LRO_NAC_AvgMosaic_SPole855_1mp | NAC mosaic, average merge | 1 m | 34,464,253,117 | n/c |
| NAC_POLE_PSR_SOUTH_STRETCH | LRO NAC PSR Mosaic 20mpp, S Pole | 20 m | 952,850,136 | n/c |
| LRO_WAC_Mosaic_SPole60_100m_v02 | LRO WAC Mosaic, S Pole v2 | 100 m | 346,305,102 | n/c |
| CE2_DEM_20m_SP / CE2_Slope_20m_SP / CE2_OrthoMosaic_7m_SP | Chang'e-2 DEM, slope (20 m), ortho mosaic (7 m) | 20 m / 7 m | 34.7 GB / 34.8 GB / 71.0 GB | n/c |
| SPA_GeoMap_lqbal_et_al_SP | Geologic Map of South Pole-Aitken Basin and South Pole Region | n/a | 1,397,482,175 | n/c |

(n/c = service endpoints not individually checked; pattern `https://trek.nasa.gov/tiles/Moon/SP/{productLabel}` verified for four labels.) — [Trek search API](https://trek.nasa.gov/moon/TrekServices/ws/index/polar/searchItems?start=0&rows=2147483647&facetKeys=itemType&facetValues=product)

#### 5.4 NAIF SPICE kernels (generic) — verified listing

| id | kernel | type | size / date (listing) | url |
|---|---|---|---|---|
| spk_de440 | de440.bsp | planetary/lunar ephemeris SPK | 119,799,808 bytes (V; listing "114M"), 2020-12-21 | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440.bsp |
| spk_de440s | de440s.bsp | short-span SPK | 31M, 2020-12-21 | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp |
| spk_de442 | de442.bsp / de442s.bsp | newest SPK in directory | 114M / 31M, 2025-02-06 | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/ |
| pck_moon_pa_de440 | moon_pa_de440_200625.bpc | binary PCK, lunar orientation (PA frame) | 12,863,488 bytes (V), 2021-06-25 | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc |
| pck_moon_pa_de421 | moon_pa_de421_1900-2050.bpc | binary PCK matching DE421 products | 1.7M, 2008-03-18 | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de421_1900-2050.bpc |
| fk_moon_de440 | moon_de440_250416.tf | lunar frame kernel (defines MOON_PA, MOON_ME aliases) | 19,478 bytes (V), 2025-04-16 | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf |
| fk_moon_080317 | moon_080317.tf, moon_assoc_me.tf, moon_assoc_pa.tf | DE421-era lunar FKs | 21K / 8.3K / 8.3K | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/ |
| pck_text | pck00011.tpc (also pck00010.tpc) | text PCK (body radii, IAU rotation) | 128K, 2022-12-27 | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc |
| pck_gm | gm_de440.tpc | GM constants | 12K | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/gm_de440.tpc |
| pck_earth | earth_latest_high_prec.bpc | Earth orientation (for DSN station visibility) | 4.9M, updated 2026-11-13 | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/earth_latest_high_prec.bpc |
| lsk | naif0012.tls (= latest_leapseconds.tls) | leap seconds | 5,257 bytes (V) | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls |
| lro_spice | LRO archived SPICE (ck, ek, fk, ik, lsk, pck, sclk, spk) | mission kernels | updated 2026-09-11 | https://naif.jpl.nasa.gov/pub/naif/pds/data/lro-l-spice-6-v1.0/lrosp_1000/data/ |

Sources: [NAIF pck dir](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/); [NAIF fk/satellites](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/); [NAIF spk/planets](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/); [NAIF lsk](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/); [LRO SPICE archive](https://naif.jpl.nasa.gov/pub/naif/pds/data/lro-l-spice-6-v1.0/lrosp_1000/data/)

### Inferences
- A browser-only app can use Trek (tiles, ImageServer `identify`, feature queries), ODE REST, USGS STAC/S3 and the LROC file host directly; for PGDA COGs, PDS Geosciences/imbrium IMG files, NAIF kernels and Horizons it needs a backend proxy or self-hosted copies, because no CORS header was returned (range requests are supported, so COG partial reads work once proxied or re-hosted).
- Horizons gives Sun/Earth elevation relative to the reference sphere only; terrain masking must be added from a DEM-derived horizon. Its "MEAN_ME" site frame matches the ME frame of the LOLA products.
- Trek ImageServer `identify` on the 5 m DEM is a workable way to sample elevation at a point without downloading 3.7 GB.

### Gaps
- No documented rate limits were found for ODE REST, Trek, Horizons, STAC or SVS in the pages fetched; Horizons documentation search for "limit/concurrent" returned nothing relevant. Treat limits as unknown.
- QuickMap: no public API endpoint or layer-list URL was identified (docs site responded but contained no API section in the extracted text).
- Trek tools (lighting, slope, elevation profile, sun-angle calculator) are known UI features of Moon Trek but their REST endpoints were not located in this session.
- NASA Planetary Data Ecosystem and api.nasa.gov were not examined beyond a reachability check.
- `https://www.spaceappschallenge.org/2026/challenges/` could not be reached (connection failed), so any official challenge resource list was not captured.

---

## 6. Formats and georeferencing pitfalls

### Takeaway
All south-polar NASA rasters share one projection (polar stereographic, lat_0 = −90, lon_0 = 0, k = 1, sphere R = 1,737,400 m) but differ in container (PDS3 IMG int16 with scale 0.5, float IMG, JP2, GeoTIFF/COG, ASCII tables), in CRS code naming (IAU2000:30120 in Trek is south polar stereographic, whereas IAU_2015:30120 is a sinusoidal CRS; the IAU_2015 south-polar code is 30135), and in vintage (pre- vs post-track-adjustment). Everything is in the Mean-Earth/Polar-Axis (ME) frame of DE421, about 875 m away from the Principal-Axis frame.

### Cited Findings
- PROJ definitions fetched from spatialreference.org: `IAU_2015:30135` = `+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs +type=crs`; `ESRI:103878` ("Moon_2000_South_Pole_Stereographic") = identical string; `IAU_2015:30100` = `+proj=longlat +R=1737400 +no_defs +type=crs`; `IAU_2015:30120` = `+proj=sinu +lon_0=0 +x_0=0 +y_0=0 +R=1737400 +units=m`. ESRI:103877 is "Moon_2000_North_Pole_Stereographic". Note the URL path uses an underscore (`/ref/iau_2015/30135/`); `/ref/iau/30135/` and `/ref/iau-2015/30135/` return 404. — [IAU_2015:30135 proj4](https://spatialreference.org/ref/iau_2015/30135/proj4.txt); [ESRI:103878](https://spatialreference.org/ref/esri/103878/); [IAU_2015:30120 proj4](https://spatialreference.org/ref/iau_2015/30120/proj4.txt); [IAU_2015:30100 proj4](https://spatialreference.org/ref/iau_2015/30100/proj4.txt)
- Moon Trek identifies its projections as `urn:ogc:def:crs:IAU2000::30120` (south pole), `urn:ogc:def:crs:IAU2000::30118` (north pole) and `urn:ogc:def:crs:EPSG::104903` (equirectangular). — [Trek config](https://trek.nasa.gov/tiles/apidoc/config/config.json)
- USGS STAC south-polar Kaguya items carry WKT `PROJCS["Moon (2015) - Sphere / Ocentric / South Polar" ... SPHEROID["Moon (2015) - Sphere",1737400,0 ...] ... PROJECTION["Polar_Stereographic"], latitude_of_origin −90, central_meridian 0, scale_factor 1 ... AUTHORITY["IAU","30135"]]`. — [STAC item sample](https://stac.astrogeology.usgs.gov/api/collections/kaguya_terrain_camera_usgs_dtms_v2_southpolar/items?limit=1)
- LOLA PDS3 IMG: 16-bit LSB signed integers, height (m) = DN x 0.5, radius = DN x 0.5 + 1,737,400; "pixel registration"; projection offsets 15167.5 for a 30336-pixel grid at 5 m; frame "MEAN EARTH/POLAR AXIS OF DE421"; planetocentric latitude, east-positive longitude. Float IMG versions store metres directly at twice the byte size. — [ldem_875s_5m.lbl](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.lbl)
- PGDA GeoTIFFs: "south polar stereographic X/Y coords in meters, MOON_ME reference frame of ephemeris DE421"; "X/Y coords follow the Generic Mapping Tools 'pixel-registered' convention (i.e., they are the centers of the pixels)". PGDA XYZI clouds: product 78 README says X, Y, Z "(in km)"; product 90 says X, Y "in meters". — [PGDA LOLA_5mpp README](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/README); [PGDA 90](https://pgda.gsfc.nasa.gov/products/90)
- PGDA on GeoTIFF/COG conversions of illumination maps: "Scaling/offets should be applied automatically for the GeoTIFFs, but please refer to the PDS label files"; "values seen when zoomed out may be taken from overview layers, which are built by averaging true full-resolution values. Be aware of this if doing quantitative analysis." — [PGDA 69](https://pgda.gsfc.nasa.gov/products/69)
- ME vs PA: "a constant coordinate transformation from MOON_PA to MOON_ME ... results in an offset of approximately 875 m"; rotation angle "approximately 0.0288473 degrees" (moon_080317.tf, DE421); for DE421 `TKFRAME_31007_ANGLES = ( 67.92 78.56 0.30 )` arcseconds, axes (3, 2, 1); SPICE recipe `furnsh('moon_080317.tf')`, `furnsh('moon_assoc_me.tf')`, `PXFORM('MOON_ME','MOON_PA', et, …)`. — [PGDA 95](https://pgda.gsfc.nasa.gov/products/95)
- DE440 frame kernel: `MOON_PA` (ID 31000) is an alias for `MOON_PA_DE440` (31008, PCK-based, needs `moon_pa_de440_200625.bpc`); `MOON_ME` (31001) is an alias for `MOON_ME_DE440_ME421` (31009), "closely aligned" with MOON_ME_DE421; separation ME–PA "approximately 0.02886 degrees ... approximately 875 m". — [moon_de440_250416.tf](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf)
- Diviner PCP tables give x, y as "Polar Stereographic X-Coordinate, normalized by the mean lunar radius 1737.4 km" with UNKNOWN_CONSTANT −9999, INVALID_CONSTANT −9998. — [dlre_pcp.fmt](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/label/dlre_pcp.fmt)
- Diviner bundle note: PDS4 IMG/XML GHRM products "are compatible with ENVI version 6.0 and newer"; "ArcGIS Pro (3.2) is also incompatible with PDS4 IMG and XML formats". — [Diviner derived readme](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/readme.txt)
- The LOLA south-pole stereographic convention places +y toward longitude 0° and +x toward 90°E (verified numerically here: the Trek "Malapert Massif" box at x ≈ 0, y ≈ +121 km maps to lon ≈ 0°, and "Faustini Rim A" at x = +64 km, y = 0 maps to lon 90°E with the standard inverse). — [Trek A3 feature query](https://trek.nasa.gov/moon/trekarcgis2/rest/services/A3_Named_regions_SP/MapServer/0/query?where=1%3D1&outFields=*&f=json)

### Inferences
- With pyproj/GDAL (PROJ >= 8 ships the IAU_2015 authority, per the spatialreference.org build note "PROJ 9.9.0"), use `IAU_2015:30135` or the explicit PROJ string; do not pass Trek's "30120" to a IAU_2015-aware library.
- Reading PDS3 IMG: GDAL's PDS driver reads the detached `.lbl` (open the `.lbl`), applying scale/offset metadata; rasterio users should apply `scales`/`offsets` or multiply DN by 0.5 themselves. This is standard GDAL behaviour but was not exercised in this session.
- Geotransform for `ldem_875s_5m`: upper-left corner x = −75,840 m, y = +75,840 m, pixel 5 m (derived from LINE/SAMPLE_PROJECTION_OFFSET 15167.5 and matching Trek's bbox).
- For ephemeris work, compute Sun/Earth vectors in `MOON_ME` (DE440 alias) so they line up with ME-frame maps; mixing PA-frame vectors with ME-frame DEMs introduces up to ~875 m of horizontal mis-registration (about 0.029°), which matters for grazing-incidence horizon tests.
- Illumination results are sensitive to observer height: Barker et al. 2021 report markedly different statistics at 1 m and 5 m above the surface, so an app should expose solar-array/antenna height as a parameter.

### Gaps
- Not tested: actual GDAL/rasterio opening of each format, whether PGDA "COG" files validate as COGs, JP2 georeferencing boxes.
- The pixel-registration half-pixel convention of each GeoTIFF (PixelIsArea vs PixelIsPoint tags) was not inspected.

---

## 7. Algorithms and open-source libraries

### Takeaway
The verified building blocks are: SPICE (SpiceyPy) or Horizons for Sun/Earth direction in the ME frame; the horizon-map method of Mazarico et al. 2011 (hourly steps over 18.6 years on LOLA grids) or ray tracing (as in NASA SVS renders and the Embree-based Python tools from the GSFC group) for terrain masking; PGDA slope/roughness/error rasters for hazard screening; and NASA's stated Artemis III criteria (slope, Earth visibility, continuous sunlight for about 6 days, PSR proximity, launch-window/NRHO availability) as the multi-criteria framework. No NASA-published numeric weights were found.

### Cited Findings

#### 7.1 Methods documented by NASA sources
- Horizon/illumination method (Mazarico et al. 2011, doi:10.1016/j.icarus.2010.10.030): 240 m/px LOLA polar maps; illumination "over an entire lunar nutation cycle (~18.6 years) with a timestep of one hour"; light source treated as "a finite disc", so the same code gives Earth visibility by changing source position and size; sky visibility = "solid angle not obscured by topography". — [PGDA 69](https://pgda.gsfc.nasa.gov/products/69)
- LROC's PSR identification: "the horizon elevation was determined in several directions based on polar DTMs" (60 m/px for 82–90°S, 120 m/px for 81–82°S). — [NAC_POLE_PSR_SOUTH README](https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/BROWSE/NAC_POLE/NAC_POLE_PSR_SOUTH/NAC_POLE_PSR_SOUTH_README.TXT)
- Uncertainty propagation (Barker et al. 2021, doi:10.1016/j.pss.2020.105119): instead of the "infeasible computation of the full error-covariance matrix of the LDEM", "use the fractal nature of lunar topography to build a more computationally manageable statistical ensemble of clones with similar error properties as the data" (100 clones per site) to study "height and slope uncertainty, as well as the uncertainty in illumination conditions"; illumination evaluated at 1 m and 5 m above the surface, Jan 1 2024–Jan 1 2026. — [PGDA 78](https://pgda.gsfc.nasa.gov/products/78)
- Empirical alternative (Speyerer & Robinson 2013, doi:10.1016/j.icarus.2012.10.010): binary lit/unlit classification of 3,807 WAC images over one year, ratio lit/observed per 100 m pixel; time-weighted variant interpolates gaps. — [WAC_POLE_ILL_PCT_SOUTH README](https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/WAC_POLE/WAC_POLE_ILL_PCT_SOUTH/WAC_POLE_ILL_PCT_SOUTH_README.TXT)
- Rendered simulation (NASA SVS 4930/5027): LOLA terrain lit for every 2 h step, 35,064 frames for 2023–2030. — [SVS API 4930](https://svs.gsfc.nasa.gov/api/4930)
- Roughness definitions used by GSFC (Barker et al. 2023): plane-fit residual spread, plane-fit slope, and RMS height deviation at baselines 100/200/400/800/1600 m. — [PGDA 90](https://pgda.gsfc.nasa.gov/products/90)
- Shape-from-Shading (photoclinometry) with Ames Stereo Pipeline: PGDA pipelines use ASP + ISIS + GDAL; image selection keeps "at least three distinct illumination directions per pixel"; 30 m/px tiles of 10 km x 10 km with ~30 images each for the 60–80°S approach strip. — [PGDA 104](https://pgda.gsfc.nasa.gov/products/104); [PGDA 92](https://pgda.gsfc.nasa.gov/products/92)
- ML super-resolution demo (Schroedinger Bridge, 320 m → 20 m/px): "RMS elevation error of 5-6 m" and "mean slope errors below 2°" on a 9,171-patch test set; trained on 91,708 patches from LOLA polar DEMs > 80° latitude rendered "with a ray-tracing planetary shape-model renderer". — [PGDA 106](https://pgda.gsfc.nasa.gov/products/106)
- Further illumination studies with confirmed titles: Gläser et al. 2014 "Illumination conditions at the lunar south pole using high resolution Digital Terrain Models from LOLA" doi:10.1016/j.icarus.2014.08.013; Gläser et al. 2018 "Illumination conditions at the lunar poles: Implications for future exploration" doi:10.1016/j.pss.2017.07.006; Smith et al. 2017 "Summary of the results from the lunar orbiter laser altimeter after seven years in lunar orbit" doi:10.1016/j.icarus.2016.06.006; Barker et al. 2016 (SLDEM2015) doi:10.1016/j.icarus.2015.07.039; Alexandrov & Beyer 2018 "Multiview Shape-From-Shading for Planetary Images" doi:10.1029/2018EA000390. — [Crossref API](https://api.crossref.org/works/10.1016/j.icarus.2014.08.013)

#### 7.2 NASA's published site-selection criteria (qualitative framework)
- 2022: criteria "terrain slope, ease of communications with Earth, and lighting conditions"; "continuous access to sunlight throughout a 6.5-day period"; within "six degrees of latitude" of the pole; proximity to a PSR for a moonwalk; accessibility given SLS/Orion/Starship HLS. — [Trek record for A3_Named_regions_SP](https://trek.nasa.gov/moon/TrekServices/ws/index/polar/searchItems?start=0&rows=2147483647&facetKeys=itemType&facetValues=product)
- 2024: "science potential, launch window availability, terrain suitability, communication capabilities with Earth, and lighting conditions". — [NASA release 2024-10-28](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/)
- 2025/2026 update: surface stay "approximately 5.75 to 6.25 days"; calendar-based simultaneous evaluation of "launch opportunities, transit and rendezvous geometry, communication constraints, landing performance, surface illumination, and terrain safety"; preference for low slope variability in the landing ellipse, few craters/blocks, DTE Earth visibility, and illumination robust to timing; illumination pattern "shifting approximately 2-3 weeks per year". — [NTRS 20250011660](https://ntrs.nasa.gov/api/citations/20250011660)
- NASA Trek pre-computes slope class layers at < 5°, < 10°, < 15°, < 20° and > 20° on the 5 m LOLA DEM, and (for Chang'e-2 DEM) < 10°, < 12°, < 15°, < 20°. — [Trek search API](https://trek.nasa.gov/moon/TrekServices/ws/index/polar/searchItems?start=0&rows=2147483647&facetKeys=itemType&facetValues=product)

#### 7.3 Open-source libraries (GitHub metadata fetched 2026-11-14 via api.github.com)

| id | repo / URL | purpose | licence | stars | last push | notes |
|---|---|---|---|---|---|---|
| asp | https://github.com/NeoGeographyToolkit/StereoPipeline | NASA Ames Stereo Pipeline: stereo, bundle adjustment, `sfs` (shape-from-shading), `dem_mosaic` | Apache-2.0 | 627 | 2026-11-14 | docs https://stereopipeline.readthedocs.io/en/latest/tools/sfs.html (200) |
| spiceypy | https://github.com/AndrewAnnex/SpiceyPy | Python wrapper for NAIF SPICE (Sun/Earth vectors in MOON_ME, frame transforms) | MIT | 495 | 2026-11-11 | docs https://spiceypy.readthedocs.io/ |
| skyfield | https://github.com/skyfielders/python-skyfield | Python astronomy/ephemerides | MIT | 1806 | 2026-09-29 | |
| lunarsky | https://github.com/aelanman/lunarsky | "An astropy extension to describe observations from the surface of the Moon" | BSD-3-Clause | 18 | 2026-06-25 | |
| craterpy | https://github.com/cjtu/craterpy | "A python library for impact crater data science" | MIT | 24 | 2026-06-19 | |
| moonpies | https://github.com/cjtu/moonpies | "Moon Polar Ice and Ejecta Stratigraphy (MoonPIES) model" | MIT | 9 | 2025-06-18 | |
| planetary_code_collection | https://github.com/nschorgh/Planetary-Code-Collection | "Thermal, Ice Evolution, and Exosphere Models for Planetary Surfaces" (Fortran) | none stated | 44 | 2026-11-01 | |
| fluxpy | https://github.com/sampotter/fluxpy (formerly `sampotter/python-flux`, which now redirects) | "Fast thermal modeling and radiosity in Python" | none stated | 14 | 2025-12-05 | related: https://github.com/sampotter/python-embree (23 stars), ray tracing bindings |
| heat1d | https://github.com/phayne/heat1d | "Thermal model for planetary science applications" | MIT | 31 | 2026-10-27 | |
| gsfc_bertone | https://github.com/steo85it (user): `shadowspy`, `raster2mesh` ("read raster maps, convert to triangular meshes"), `pyxover`, `pyRTX`, `python-flux` fork | illumination/mesh tools by a PGDA author | not stated | 0–5 | various | repo descriptions sparse; `shadowspy` has no description |
| solshade | https://github.com/amanchokshi/solshade | "Terrain-aware solar illumination modeling using DEMs and orbital sun geometry" | MIT | 7 | 2026-06-03 | Earth-oriented; described in search results as generating horizon maps and using Skyfield |
| isis | https://github.com/DOI-USGS/ISIS3 | USGS ISIS (camera models, map projection of LROC etc.) | see repo | 246 | 2026-11-13 | |
| ale | https://github.com/DOI-USGS/ale | Abstraction Layer for Ephemerides | see repo | 19 | 2026-11-12 | |
| pdr | https://github.com/MillionConcepts/pdr | "Planetary Data Reader - A single function to read all PDS data into Python" | see repo | 74 | 2026-09-17 | |
| pvl | https://github.com/planetarypy/pvl | PVL/PDS3 label parser | BSD-3-Clause | 23 | 2025-06-14 | |
| pds4_tools | https://github.com/Small-Bodies-Node/pds4_tools | read/display PDS4 data | none stated | 26 | 2026-02-14 | |
| planetcantile | https://github.com/AndrewAnnex/planetcantile | "tile matrix sets for other planets" (for tiling lunar COGs) | BSD-3-Clause | 16 | 2026-05-25 | |
| titiler | https://github.com/developmentseed/titiler | dynamic COG tile server | MIT | 1208 | 2026-11-13 | |
| geotiffjs | https://github.com/geotiffjs/geotiff.js | browser/Node GeoTIFF + COG range reads | MIT | 1058 | 2026-09-13 | |
| rasterio / pyproj | https://github.com/rasterio/rasterio ; https://github.com/pyproj4/pyproj | raster I/O; PROJ bindings | see repo ; MIT | 2592 ; 1239 | 2026-11 | |
| shtools | https://github.com/SHTOOLS/SHTOOLS | spherical harmonics (used for LOLA_PA expansions) | BSD-3-Clause | 434 | 2026-11-11 | |
| pygmt | https://github.com/GenericMappingTools/pygmt | GMT interface (LOLA grids are produced with GMT) | BSD-3-Clause | 882 | 2026-11-10 | |
| mmgis | https://github.com/NASA-AMMOS/MMGIS | NASA web GIS for "Earth, Lunar and Planetary Visualization, Research, Science, Planning and Operations" | Apache-2.0 | 240 | 2026-11-14 | |
| planet_crs_registry | https://github.com/pdssp/planet_crs_registry | IAU planetary CRS registry | not checked | n/a | n/a | page 200 |

Source for all rows: [GitHub REST API](https://api.github.com/repos/NeoGeographyToolkit/StereoPipeline) (one call per repository) and [GitHub user repos](https://api.github.com/users/steo85it/repos?per_page=100&sort=pushed).

- Not found on GitHub under the guessed names: `seignovert/planetary-coverage`, `steo85it/mesh_illumination`, `nasa/Lunar-Illumination` (all "Not Found"). — [GitHub API](https://api.github.com/repos/seignovert/planetary-coverage)
- A GitHub repository search on 2026-11-14 returned many small projects pushed in Nov 2026 that describe themselves as NASA Space Apps 2026 entries on lunar south-pole landing-site/illumination/DTE evaluation (e.g. `itzvarunv/lunar-landing-site-navigator`: "Uses NASA LOLA 5 m and 80 m elevation maps and JPL Horizons; validated against NASA slope and illumination maps"; `partofcosmos-site/lunarsite-compass`; `kians11sadeghy/bavamia-team-`; `arsyadpelajar01-coder/Xasuai`: "Integrates NASA LOLA DEM and JPL Horizons data to analyze surface slopes, solar illumination, and direct-to-Earth communication at Mons Mouton"). — [GitHub search API](https://api.github.com/search/repositories?q=lunar+south+pole+illumination&sort=stars&per_page=8)
- A general web search surfaced "TUB-Light", described as "software to compute illumination at the lunar south pole using parallel computing on GPUs" with instructions on Zenodo. — [openpolar record](https://openpolar.no/Record/ftzenodo:oai:zenodo.org:5777269)

### Inferences
(The following combine verified facts with standard practice; items marked † are background knowledge not verified against a source in this session.)
- Minimal landing-window pipeline: (1) load DEM in polar stereographic ME frame; (2) for each candidate pixel (plus mast height h) precompute horizon elevation vs azimuth; (3) for each time step get Sun and Earth direction in MOON_ME via SpiceyPy (`de440.bsp`, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf`, `naif0012.tls`) or Horizons; convert to local azimuth/elevation; (4) compute visible fraction of the solar disc above the terrain horizon (Sun angular radius about 0.27°†) and Earth visibility (any part of disc, per Mazarico, or centre above horizon plus margin for DSN); (5) scan for intervals where illumination ≥ threshold continuously for the stay duration (NASA: 6.5 days in 2022 text; 5.75–6.25 days in the 2026 abstract) and Earth is visible; (6) repeat on DEM clones or with ±error rasters for confidence.
- Cost†: horizon precomputation scales as N_pixels x N_azimuths x search radius (far-field terrain up to ~150+ km matters at grazing Sun because of lunar curvature); time stepping is then O(N_pixels) per step. 18.6 years hourly = about 163,000 steps (18.6 x 8,766 h). A 5 m site grid of 4,000 x 4,000 pixels with 720 azimuths needs multi-resolution horizons (fine DEM near field, 60–240 m DEM far field) or GPU/Embree ray tracing.
- Slope/roughness from DEM†: slope via finite differences (Horn) at a stated baseline; roughness as RMS deviation from a fitted plane or as terrain ruggedness (the PGDA SfS product ships "VRM roughness maps at multiple baselines"); use PGDA `LDSM_*` and `LDRM_*` rasters directly where the baseline fits, and report slope together with `*_slperr`.
- Multi-criteria scoring: NASA gives criteria but no weights; an app must choose its own (hard constraints: slope below a limit over the ellipse, continuous sunlight for the stay, Earth visibility; soft scores: mean illumination, distance to PSR ≥ area threshold, ice-stability depth, Diviner max T, hazard density, DEM confidence/effective resolution). Any numeric weights should be labelled as the app's assumptions.
- Traverse planning data needs (from the Endurance-A layers on Trek): path polylines, science-station points, DEM-resolution-along-path and NAC coverage/lighting coverage layers, i.e. slope, lighting and image coverage are evaluated along the route.
- The wave of Space Apps 2026 repositories suggests an official NASA challenge on exactly this theme exists; its resource list (not retrieved) would be worth checking for NASA-endorsed datasets.

### Gaps
- Published quantitative multi-criteria frameworks with weights (journal papers on lunar south-pole site selection/AHP) could not be searched for after the search budget was exhausted; none is cited here.
- HLS landing constraints (maximum slope, hazard size, ellipse radius) from NASA requirement documents were not retrieved; only the press-reported "approximate 100-meter radius" exists in these notes.
- Details of Mazarico et al. 2011 implementation (number of azimuths, horizon range, treatment of the solar limb) were not verified from the paper itself.
- No GSFC/Mazarico illumination code release was located; `steo85it/shadowspy` is a candidate but undocumented.
- Rover path-planning open-source tools specific to lunar polar lighting were not found (one small student repo only).

---

## 8. Practical constraints: download sizes, rate limits, CORS, licences

### Takeaway
A complete "analysis-ready" south-pole stack is about 10–20 GB if restricted to the 20 m/px 80–90°S COGs plus the 5 m 87°S mosaic and site DEMs, but more than 100 GB if all resolutions, error layers, roughness and point clouds are taken. Licensing is explicit only for USGS STAC (CC0-1.0); PDS/PGDA products ask for citation; JAXA, ISRO, CNSA and KARI-hosted data have their own portals and terms (ISRO requires login).

### Cited Findings

| bundle | contents | size | source |
|---|---|---|---|
| Core 20 m | `LDEM_80S_20MPP_ADJ.TIF` (2,696,082,051 bytes) + `LDEM_80S_20MPP_ADJ_ERR.TIF` (3.7G) + `LDSM_80S_20MPP_ADJ.TIF` (3.6G) + `LDSM_80S_20MPP_ADJ_ERR.TIF` (3.7G) + `LDEM_80S_20MPP_ADJ_EFFRES.TIF` (3.8G) | about 17.5 GB | [PGDA 90](https://pgda.gsfc.nasa.gov/products/90) |
| Light 80 m | `LDEM_80S_80MPP_ADJ.TIF` 181M + `_ERR` 244M + `LDSM_80S_80MPP_ADJ.TIF` 231M + `_ERR` 239M | about 0.9 GB | [PGDA 90](https://pgda.gsfc.nasa.gov/products/90) |
| 5 m polar cap | `ldem_87s_5mpp.tif` 3,465,285,714 bytes + `ldsm_87s_5mpp.tif` 4.9 GB + `ldec_87s_5mpp.tif` 140 MB | about 8.5 GB | [PGDA 81](https://pgda.gsfc.nasa.gov/products/81) |
| 10 m 83°S set | all seven `*_83S_10MPP_*` files | about 36.8 GB (415M + 4.8G + 7.5G + 7.5G + 2.5G + 7.1G + 7.0G) | [PGDA 90](https://pgda.gsfc.nasa.gov/products/90) |
| Roughness 50 m | 15 baseline files (ROUGH/SLP/RMSD x 5) + RGB | about 9.5 GB | [PGDA 90](https://pgda.gsfc.nasa.gov/products/90) |
| Point clouds | `LDEM_80S_ADJ.XYZI` 13G; `LDEM_60S_ADJ.XYZI` 48G | 61 GB | [PGDA 90](https://pgda.gsfc.nasa.gov/products/90) |
| LOLA illumination (PDS IMG, south) | 3 AVGVISIB + 3 Earth + 3 LPSR + SKYV | 832,133,360 bytes (2 x 82,432,800 + 2 x 116,250,752 + 2 x 51,166,728 for Sun+Earth = 499,700,560; LPSR 249,850,280; SKYV 82,432,800) | [PDS illumination img listing](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/img/) |
| LROC WAC illumination | two 100 m IMG maps | 11,809,792 bytes | [LROC PDS](https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/WAC_POLE/WAC_POLE_ILL_PCT_SOUTH/WAC_POLE_ILL_PCT_SOUTH_100M.IMG) |
| Diviner PRP south | `dlre_prp_south.tab` | 604,800,210 bytes | [PRP listing](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/) |
| Diviner PCP south (one file) | each seasonal/diurnal table | about 0.19–0.22 GB per file | [PCP listing](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_pcp/seasonal/slon/pols/) |
| SPICE minimum | de440s.bsp 31M (or de440.bsp 119,799,808 bytes) + moon_pa_de440_200625.bpc 12,863,488 bytes + moon_de440_250416.tf 19,478 bytes + naif0012.tls 5,257 bytes + pck00011.tpc 128K | about 44 MB (with de440s) | [NAIF generic kernels](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/) |
| SVS frames | 4,380 TIFF frames per year at about 1.84 MB (frame 0001 of 2027) | roughly 8 GB per year (estimate from one frame) | [SVS frames dir](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004930/frames/1920x1080_16x9_30p/2027/) |
| NAC 1 m mosaics | uncontrolled and controlled south-pole mosaics on Trek | 36.25 GB and 34.46 GB | [Trek search API](https://trek.nasa.gov/moon/TrekServices/ws/index/polar/searchItems?start=0&rows=2147483647&facetKeys=itemType&facetValues=product) |

**CORS / range support observed 2026-11-14** (HEAD with `Origin: https://example.org`):

| host | `Access-Control-Allow-Origin` | `Accept-Ranges: bytes` | example URL |
|---|---|---|---|
| pgda.gsfc.nasa.gov | none | yes | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF |
| pds-geosciences.wustl.edu | none | yes | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.lbl |
| imbrium.mit.edu | none | yes | https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_85S_060M_201608.IMG |
| pds.lroc.im-ldi.com | `*` | yes | https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/WAC_POLE/WAC_POLE_ILL_PCT_SOUTH/WAC_POLE_ILL_PCT_SOUTH_100M.IMG |
| naif.jpl.nasa.gov | none | yes | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls |
| trek.nasa.gov (search, WMTS, ArcGIS) | `*` | yes (WMTS XML) | https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_DEM_SPole875_5mp_v04/1.0.0/WMTSCapabilities.xml |
| oderest.rsl.wustl.edu | `*` | n/a | https://oderest.rsl.wustl.edu/live2/?query=iipy&odemetadb=moon&output=JSON |
| stac.astrogeology.usgs.gov and astrogeo-ard S3 | `*` | yes | https://stac.astrogeology.usgs.gov/api/collections |
| planetarymaps.usgs.gov | `*` | yes | https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif |
| pds-imaging.jpl.nasa.gov | `*` | not recorded | https://pds-imaging.jpl.nasa.gov/data/lro/lamp/ |
| pds.shadowcam.im-ldi.com | `*` | yes | https://pds.shadowcam.im-ldi.com/bundle_kplo-shadowcam.xml |
| ssd.jpl.nasa.gov (Horizons API) | none | n/a (HEAD 405) | https://ssd.jpl.nasa.gov/api/horizons.api |
| svs.gsfc.nasa.gov | restricted to `https://tempo.multiverse.music` | yes | https://svs.gsfc.nasa.gov/api/4930 |
| asc-planetarynames-data S3 | none | yes | https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.zip |
| api.nasa.gov | `*` | n/a | https://api.nasa.gov/ |

**Licence / usage statements actually seen:**
- USGS STAC collections: `license: CC0-1.0` for every collection, including Kaguya TC DTMs (source data from JAXA DARTS, processed by USGS). — [USGS STAC](https://stac.astrogeology.usgs.gov/api/collections)
- PGDA: "Data Usage Policy – Please cite this paper when using these products" (per product; e.g. Barker et al. 2023 and data DOI 10.60903/gsfcpgda-lola-spole); footer links to "Reproduction Guidelines" and "Privacy Policy and Important Notices". — [PGDA 90](https://pgda.gsfc.nasa.gov/products/90)
- LOLA illumination extras: "As with all EXTRAs products, these files are not supported by the PDS or the LOLA Science Team"; cite Mazarico et al. 2011. — [readme_illumination_2016.txt](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/readme_illumination_2016.txt); [PGDA 69](https://pgda.gsfc.nasa.gov/products/69)
- LROC products: each README names the reference to cite (e.g. Speyerer & Robinson 2013; Wagner et al. 2015; Archinal et al. 2023; Brown et al. 2022). — [WAC_POLE_ILL_PCT_SOUTH README](https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/WAC_POLE/WAC_POLE_ILL_PCT_SOUTH/WAC_POLE_ILL_PCT_SOUTH_README.TXT)
- PGDA SfS pipeline code: "distributed as-is ... will not work without significant expert user guidance and manual intervention. It is not intended to be used operationally". — [PGDA 92](https://pgda.gsfc.nasa.gov/products/92)
- ISRO Chandrayaan-2 data portal shows "Login/Signup" for access. — [ISRO PRADAN](https://pradan.issdc.gov.in/ch2/)
- ODE REST page carries a maintenance notice pattern ("unavailable due to scheduled system maintenance December 19th, 7am - 5pm, US Central Time"), i.e. the service has planned outages. — [ODE REST home](https://oderest.rsl.wustl.edu/)

### Inferences
- NASA-produced PDS/PGDA/SVS data are US Government works and are generally usable without copyright restriction, with citation requested; this general rule was not re-verified against a NASA policy page in this session and should be confirmed (NASA media usage guidelines) before publishing an app. Third-party-derived layers on Trek (Chang'e-2 DEM, Chandrayaan-1 Mini-SAR/M3, Kaguya SP abundance maps) inherit the originating agency's terms.
- Because PGDA publishes the adjusted DEMs as COGs with HTTP range support, a backend (or a re-hosting bucket with CORS) can serve windows of the 2.7 GB 20 m DEM without full download; in the browser this needs a proxy since PGDA sends no CORS header.
- Storage planning: prefer 20 m (80–90°S) for regional screening, 5 m for the polar cap and candidate regions; avoid the 10 m 83°S set (about 37 GB) unless Malapert/Mons Mouton detail at 10 m is required (those lie at about 84–86°S, outside the 87°S mosaic but inside the 5 m per-site DEMs Site20/Site20v2/Site23/Site06/DM2 and the 2026 SfS SDEMs).

### Gaps
- Rate limits: none documented in fetched pages for any service (ODE, Trek, Horizons, STAC, SVS, NTRS, GitHub aside). api.nasa.gov key limits were not read.
- JAXA (SELENE/Kaguya), CNSA (Chang'e-2), KARI (KPDS; https://www.kari.re.kr/kpds/ returned an empty 200 response) and ISRO licence texts were not retrieved.
- NASA's general media/data usage policy page was not fetched; the public-domain statement above is therefore an inference.
- Zenodo record sizes for doi:10.5281/zenodo.17954508 (SfS SDEMs) and doi:10.5281/zenodo.10258683 were not read.
- The remaining web-search budget was zero from roughly the midpoint of this task; items needing discovery rather than verification (2024 region polygons, MCDA weight papers, Space Apps 2026 resource list, LEND hydrogen rasters, Li et al. supplementary files, QuickMap API) remain open and are good targets for a follow-up search.
