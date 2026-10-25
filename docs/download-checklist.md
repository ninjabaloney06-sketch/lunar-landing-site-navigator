# Phase 2 download checklist

**Needs Isaac's approval before any download (AGENTS.md).** Every command below runs on the data computer, per action, only after Isaac says yes for that specific item. Nothing in this file has been downloaded; all sizes are HTTP HEAD results.

Content-Lengths recorded 2026-10-25 (CEST) via `curl -sI`. Repo agent re-verified every URL 200; deviations from [data-guide.md](data-guide.md) found on that pass:

- The 20 m DEM path in data-guide.md has the wrong case: `.../data/LOLA_20MPP/...` now returns the PGDA "Not Found" page. The working path (linked from [PGDA product 90](https://pgda.gsfc.nasa.gov/products/90)) is lowercase `.../data/LOLA_20mpp/...`.
- PGDA's own illumination/COG copies (`.../data/MoonIllumination/...`) all returned the PGDA "Not Found" HTML page (HTTP 200, Content-Length 3,789) on 2026-10-25. Download the PDS / MIT mirrors below and re-check the PGDA COG links on download day.
- NAIF's `.cmt` companion file is named `moon_pa_de440_200625.cmt` (not `.bpc.cmt`); it adds 1,898 bytes on top of the data-guide's 5-kernel total of 45,745,465 bytes (confirmed correct).

## 0. Before anything: free disk space

```sh
DATA_ROOT="/path/on/data/computer"   # set once; every command below uses it
df -h "$DATA_ROOT"
# Required set is ~5.1 GB; with the optional 10 m band and PSR map ~7.0 GB.
# Only continue if "Avail" shows >= 12 GB (required set + one 2.7 GB re-download),
# >= 15 GB if optional rows will be downloaded too.
```

## 1. SPICE kernels (NAIF, generic kernels)

Target dir: `<DATA_ROOT>/clps/spice/`

| File | URL | Content-Length (HEAD 2026-10-25) | Version / coverage | Published checksum | License |
|---|---|---|---|---|---|
| `de440s.bsp` | [naif...spk/planets/de440s.bsp](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp) | 32,726,016 | DE440, 1849-12-26 → 2150-01-22 | MD5 `3917ee56769db332790c751e2168843d`, published in [aa_checksums.txt](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/aa_checksums.txt) | no license file; attribute NASA/JPL/Caltech |
| `naif0012.tls` | [naif...lsk/naif0012.tls](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls) | 5,257 | latest LSK (naif0012) | none published | no license file; attribute NASA/JPL/Caltech |
| `pck00011.tpc` | [naif...pck/pck00011.tpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc) | 131,226 | latest generic text PCK | none published | no license file; attribute NASA/JPL/Caltech |
| `moon_pa_de440_200625.bpc` | [naif...pck/moon_pa_de440_200625.bpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc) | 12,863,488 | DE440 lunar orientation, DE421→DE440-era PA frame | none published | no license file; attribute NASA/JPL/Caltech |
| `moon_pa_de440_200625.cmt` | [naif...pck/moon_pa_de440_200625.cmt](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.cmt) | 1,898 | comments companion of the BPC | none published | no license file; attribute NASA/JPL/Caltech |
| `moon_de440_250416.tf` | [naif...fk/satellites/moon_de440_250416.tf](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf) | 19,478 | Moon FK, Apr 2025 (MOON_PA 31000, MOON_ME 31001) | none published | no license file; attribute NASA/JPL/Caltech |

NAIF `lsk/`, `pck/` and `fk/satellites/` directories publish no checksum files (checked 2026-10-25); their SHA-256 recorded at download time is the reference for the USB verify.

### 1a. Download + checksum commands (SPICE)

```sh
mkdir -p "$DATA_ROOT/clps/spice" && cd "$DATA_ROOT/clps/spice"
curl -fL --retry 3 -O https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp && shasum -a 256 de440s.bsp | tee -a SHA256SUMS.txt
md5 -q de440s.bsp   # must print 3917ee56769db332790c751e2168843d (NAIF aa_checksums.txt); on Linux use: md5sum -b de440s.bsp
curl -fL --retry 3 -O https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls && shasum -a 256 naif0012.tls | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc && shasum -a 256 pck00011.tpc | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc && shasum -a 256 moon_pa_de440_200625.bpc | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.cmt && shasum -a 256 moon_pa_de440_200625.cmt | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf && shasum -a 256 moon_de440_250416.tf | tee -a SHA256SUMS.txt
shasum -a 256 -c SHA256SUMS.txt   # every line must end ': OK'
```

Group 1 total: 45,747,363 bytes (~45.7 MB).

## 2. LOLA south-pole elevation (20 m and 5 m)

Target dir: `<DATA_ROOT>/clps/lola/`. Both products are polar stereographic in MOON_ME of DE421, reference radius 1737.4 km (PGDA product page + PDS label `COORDINATE_SYSTEM_NAME = "MEAN EARTH/POLAR AXIS OF DE421"`).

| File | URL | Content-Length (HEAD 2026-10-25) | Version / coverage | Published checksum | License |
|---|---|---|---|---|---|
| `LDEM_80S_20MPP_ADJ.TIF` | [pgda.../data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF) | 2,696,082,051 | Barker et al. 2023 COG, 80S–90S at 20 m/px (last-modified 7 Jul 2023) | none published (no checksum or directory listing at PGDA) | cite Barker et al. 2023 (DOI [10.3847/PSJ/acf3e1](https://iopscience.iop.org/article/10.3847/PSJ/acf3e1)) + data DOI 10.60903/gsfcpgda-lola-spole |
| `ldem_875s_5m.img` | [pds.../polar/img/ldem_875s_5m.img](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.img) | 1,840,545,792 | PDS LOLA GDR V2.0, 87.5S–90S at 5 m/px (last-modified 6 Jul 2017) | none published (bundle inventory CSV and `index/` carry no checksums; checked 2026-10-25) | PDS: free use, attribute NASA/LOLA team / PDS Geosciences Node; no license file in the bundle |
| `ldem_875s_5m.lbl` | [pds.../polar/img/ldem_875s_5m.lbl](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.lbl) | 4,990 | PDS label for the IMG (read it, it defines geometry) | none published | same as IMG |

Optional row (the 5 m grid stops at 87.5°S; the Artemis candidate regions between 85° and 87.5°S need this instead):

| File | URL | Content-Length (HEAD 2026-10-25) | Version / coverage | Published checksum | License |
|---|---|---|---|---|---|
| `ldem_85s_10m.img` | [pds.../polar/img/ldem_85s_10m.img](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_85s_10m.img) | 1,840,545,792 | PDS LOLA GDR V2.0 (per label), 85S–90S at 10 m/px | none published | same as 5 m IMG |
| `ldem_85s_10m.lbl` | [pds.../polar/img/ldem_85s_10m.lbl](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_85s_10m.lbl) | 4,993 | PDS label for the IMG | none published | same as IMG |

Which candidate sites need which grid is Isaac's call at download time (phase 1 site decision, `docs/sources.md`). The 20 m COG alone covers every site coarsely; 10 m and 5 m refine the chosen ones.

### 2a. Download + checksum commands (LOLA)

```sh
mkdir -p "$DATA_ROOT/clps/lola" && cd "$DATA_ROOT/clps/lola"
curl -fL --retry 3 -O https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF && shasum -a 256 LDEM_80S_20MPP_ADJ.TIF | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.img && shasum -a 256 ldem_875s_5m.img | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.lbl && shasum -a 256 ldem_875s_5m.lbl | tee -a SHA256SUMS.txt
# optional, only if a chosen site lies between 85S and 87.5S:
curl -fL --retry 3 -O https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_85s_10m.img && shasum -a 256 ldem_85s_10m.img | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_85s_10m.lbl && shasum -a 256 ldem_85s_10m.lbl | tee -a SHA256SUMS.txt
shasum -a 256 -c SHA256SUMS.txt   # every line must end ': OK'
```

Group 2 total: 4,536,632,833 bytes (~4.54 GB); with the optional 10 m pair 6,377,183,618 bytes (~6.38 GB).

## 3. Illumination and Earth-visibility maps (Mazarico et al., 2016 release)

Target dir: `<DATA_ROOT>/clps/illumination/`. PGDA's COG TIF copies were unreachable on 2026-10-25 (see header), so the downloads use the PDS extras and the MIT mirror of the same 2016 release; the PGDA [product 69](https://pgda.gsfc.nasa.gov/products/69) COG links are the fallback to re-check on download day. Per the release readme, the EXTRAS products "are not supported by the PDS or the LOLA Science Team".

| File | URL | Content-Length (HEAD 2026-10-25) | Version / coverage | Published checksum | License |
|---|---|---|---|---|---|
| `avgvisib_85s_060m_201608.img` | [pds.../release_2016/img/avgvisib_85s_060m_201608.img](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_85s_060m_201608.img) | 51,166,728 | avg solar illumination, 85S–90S, 60 m/px, 18.6-yr average | none published | cite Mazarico et al. 2011 (Icarus 211, 1066–1081, doi:10.1016/j.icarus.2010.10.030) |
| `avgvisib_85s_060m_201608.lbl` | [pds.../avgvisib_85s_060m_201608.lbl](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_85s_060m_201608.lbl) | 4,096 | PDS label | none published | same |
| `avgvisib_85s_060m_201608_earth.img` | [pds.../avgvisib_85s_060m_201608_earth.img](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_85s_060m_201608_earth.img) | 51,166,728 | avg Earth visibility, 85S–90S, 60 m/px | none published | same |
| `avgvisib_85s_060m_201608_earth.lbl` | [pds.../avgvisib_85s_060m_201608_earth.lbl](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_85s_060m_201608_earth.lbl) | 4,113 | PDS label | none published | same |
| `avgvisib_65s_240m_201608.img` | [pds.../avgvisib_65s_240m_201608.img](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_65s_240m_201608.img) | 82,432,800 | avg solar illumination, 65S–90S, 240 m/px | none published | same |
| `avgvisib_65s_240m_201608.lbl` | [pds.../avgvisib_65s_240m_201608.lbl](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_65s_240m_201608.lbl) | 4,098 | PDS label | none published | same |
| `avgvisib_65s_240m_201608_earth.img` | [pds.../avgvisib_65s_240m_201608_earth.img](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_65s_240m_201608_earth.img) | 82,432,800 | avg Earth visibility, 65S–90S, 240 m/px | none published | same |
| `avgvisib_65s_240m_201608_earth.lbl` | [pds.../avgvisib_65s_240m_201608_earth.lbl](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_65s_240m_201608_earth.lbl) | 4,116 | PDS label | none published | same |
| `AVGVISIB_75S_120M_201608.IMG` | [imbrium.../IMG/AVGVISIB_75S_120M_201608.IMG](http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608.IMG) | 116,250,752 | avg solar illumination, 75S–90S, 120 m/px (MIT mirror; 75S band is not in the PDS release_2016 tree) | none published | same |
| `AVGVISIB_75S_120M_201608.LBL` | [imbrium.../AVGVISIB_75S_120M_201608.LBL](http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608.LBL) | 4,092 | PDS label | none published | same |
| `AVGVISIB_75S_120M_201608_EARTH.IMG` | [imbrium.../AVGVISIB_75S_120M_201608_EARTH.IMG](http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608_EARTH.IMG) | 116,250,752 | avg Earth visibility, 75S–90S, 120 m/px | none published | same |
| `AVGVISIB_75S_120M_201608_EARTH.LBL` | [imbrium.../AVGVISIB_75S_120M_201608_EARTH.LBL](http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608_EARTH.LBL) | 4,112 | PDS label | none published | same |

Optional row: PSR map for the 85S band (useful context for the dark-ratio story, not needed for validation):

| File | URL | Content-Length (HEAD 2026-10-25) | Version / coverage | Published checksum | License |
|---|---|---|---|---|---|
| `lpsr_85s_060m_201608.img` (+`.lbl`) | [pds.../lpsr_85s_060m_201608.img](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/lpsr_85s_060m_201608.img) · [.lbl](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/lpsr_85s_060m_201608.lbl) | 51,166,728 + 3,916 | permanently shadowed regions, 85S–90S, 60 m/px | none published | same as AVGVISIB |

### 3a. Download + checksum commands (illumination)

```sh
mkdir -p "$DATA_ROOT/clps/illumination" && cd "$DATA_ROOT/clps/illumination"
B=https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img
M=http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG
curl -fL --retry 3 -O "$B/avgvisib_85s_060m_201608.img" && shasum -a 256 avgvisib_85s_060m_201608.img | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O "$B/avgvisib_85s_060m_201608.lbl" && shasum -a 256 avgvisib_85s_060m_201608.lbl | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O "$B/avgvisib_85s_060m_201608_earth.img" && shasum -a 256 avgvisib_85s_060m_201608_earth.img | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O "$B/avgvisib_85s_060m_201608_earth.lbl" && shasum -a 256 avgvisib_85s_060m_201608_earth.lbl | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O "$B/avgvisib_65s_240m_201608.img" && shasum -a 256 avgvisib_65s_240m_201608.img | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O "$B/avgvisib_65s_240m_201608.lbl" && shasum -a 256 avgvisib_65s_240m_201608.lbl | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O "$B/avgvisib_65s_240m_201608_earth.img" && shasum -a 256 avgvisib_65s_240m_201608_earth.img | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O "$B/avgvisib_65s_240m_201608_earth.lbl" && shasum -a 256 avgvisib_65s_240m_201608_earth.lbl | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O "$M/AVGVISIB_75S_120M_201608.IMG" && shasum -a 256 AVGVISIB_75S_120M_201608.IMG | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O "$M/AVGVISIB_75S_120M_201608.LBL" && shasum -a 256 AVGVISIB_75S_120M_201608.LBL | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O "$M/AVGVISIB_75S_120M_201608_EARTH.IMG" && shasum -a 256 AVGVISIB_75S_120M_201608_EARTH.IMG | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O "$M/AVGVISIB_75S_120M_201608_EARTH.LBL" && shasum -a 256 AVGVISIB_75S_120M_201608_EARTH.LBL | tee -a SHA256SUMS.txt
# optional PSR map:
curl -fL --retry 3 -O "$B/lpsr_85s_060m_201608.img" && shasum -a 256 lpsr_85s_060m_201608.img | tee -a SHA256SUMS.txt
curl -fL --retry 3 -O "$B/lpsr_85s_060m_201608.lbl" && shasum -a 256 lpsr_85s_060m_201608.lbl | tee -a SHA256SUMS.txt
shasum -a 256 -c SHA256SUMS.txt   # every line must end ': OK'
```

Group 3 total: 499,725,187 bytes (~500 MB); with the optional PSR pair 550,895,831 bytes.

## 4. Size totals

| Group | Required | With optional rows |
|---|---|---|
| 1. SPICE kernels | 45,747,363 B (~45.7 MB) | — |
| 2. LOLA DEMs | 4,536,632,833 B (~4.5 GB) | 6,377,183,618 B (~6.4 GB) |
| 3. Illumination / visibility | 499,725,187 B (~0.5 GB) | 550,895,831 B (~0.55 GB) |
| **Overall** | **5,082,105,383 B (~5.1 GB / 4.7 GiB)** | **6,973,826,812 B (~7.0 GB / 6.5 GiB)** |

USB stick needs the same size plus file-system overhead; a 16 GB stick is enough even with all optionals. FAT32 works (largest single file is 2.7 GB < 4 GB limit) but exFAT is safer.

## 5. `data/SOURCES.md` row template (do not create the file here; fill in on the data computer after each download)

One row per downloaded file, then commit the filled file into the repo:

```markdown
| File (basename) | Source URL | Version / release | Size (bytes, HEAD) | SHA-256 (recorded at download) | Published checksum (URL or "none") | License / required citation | Path on data computer | Downloaded (date, by whom, approved by Isaac) |
|---|---|---|---|---|---|---|---|---|
| de440s.bsp | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp | DE440 | 32726016 | <sha256> | MD5 in https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/aa_checksums.txt | NASA/JPL/Caltech attribution | <DATA_ROOT>/clps/spice/de440s.bsp | 2026-11-xx, device agent, Isaac yes |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |
```

## 6. USB stick copy + verify (after all downloads; second laptop compares checksums)

```sh
# data computer — find the mounted stick and copy
ls /Volumes                                  # note the stick's volume name, use it below
VOL="/Volumes/CLPS_DATA"                     # adjust to the real volume name
rsync -ah --progress "$DATA_ROOT/clps/" "$VOL/clps/"
# data computer — verify the copies on the stick against the recorded sums
cd "$VOL/clps/spice" && shasum -a 256 -c SHA256SUMS.txt
cd "$VOL/clps/lola" && shasum -a 256 -c SHA256SUMS.txt
cd "$VOL/clps/illumination" && shasum -a 256 -c SHA256SUMS.txt
# every line must end ': OK' before the stick leaves the data computer

# second laptop — independent read of the stick, same three checks
VOL="/Volumes/CLPS_DATA"                     # adjust; on Linux the stick may mount at /media/<user>/CLPS_DATA
cd "$VOL/clps/spice" && shasum -a 256 -c SHA256SUMS.txt
cd "$VOL/clps/lola" && shasum -a 256 -c SHA256SUMS.txt
cd "$VOL/clps/illumination" && shasum -a 256 -c SHA256SUMS.txt
# every line must end ': OK' on the second laptop too; record both runs' output in data/SOURCES.md
```
