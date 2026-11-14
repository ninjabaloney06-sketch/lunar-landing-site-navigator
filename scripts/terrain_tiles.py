"""Per-site terrain tiles for the 3D view (TerrainMeta in app/src/data/types.ts).

For each site in scripts/sites.csv whose centre lies inside the LOLA DEM:
  app/public/data/terrain/<id>.bin       500 x 500 little-endian Int16, row-major
                                         row 0 = north edge, col 0 = west edge
                                         heights in metres relative to the site's ground height
  app/public/data/terrain/<id>.json      TerrainMeta
  app/public/data/terrain/<id>-illum.png 500 x 500 grey+alpha PNG, 0 = 0 % lit .. 255 = 100 % lit
                                         (PGDA average-illumination map; alpha 0 where the map
                                         does not cover the sample)

Grid: sample (i, j) sits at x_east_m = (j - 249.5) * 80, y_north_m = (249.5 - i) * 80 in the site's
local ENU plane (up = unit(lat, lon), east = unit(z x up), north = up x east). Each offset is put
on the 1737.4 km sphere and converted to lat/lon; the DEM and illumination CRSs are read from their
own files (pyproj), and values are bilinear samples from one windowed read per raster.
"""
import csv
import json
import math
import sys

import numpy as np
import rasterio
from PIL import Image
from pyproj import CRS, Transformer
from rasterio.windows import Window

from config import APP_DATA, REPO, data_root

R_M = 1737400.0
SIZE = 500
SPACING_M = 80.0
HALF = (SIZE - 1) / 2  # 249.5
NODATA = -32768
ORDER = "row-major; row 0 = north edge; col 0 = west edge"
HEIGHT_REF = "metres relative to the site's ground height"
DEM_NAME = "LDEM_80S_20MPP_ADJ.TIF"
SITES_CSV = REPO / "scripts" / "sites.csv"
OUT = APP_DATA / "terrain"

# Illumination maps (PGDA average visibility). Brief B step 5 chose the 60 m 85S map south of 85 S, but the
# overlays built from it do not line up with the terrain: on all 14 tiles from that map, lit fraction and local
# relief are uncorrelated (|r| <= 0.07, under any flip or rotation), while the 4 tiles from the 75S map give
# r = +0.31..+0.52 (review 14 Nov; tests/test_illum_overlay.py). The 85S georeferencing (its PDS3 label as read
# by GDAL) is suspect. Until it is checked against a known feature, every site uses the 75S map at 120 m
# (south of 75 S; check that the run reports illum_valid=1.000 for the polar sites, and rerun
# tests/test_illum_overlay.py). Set USE_85S = True only after the 85S map passes that test.
MAP_85S = ("avgvisib_85s_060m_201608", "avgvisib_85s_060m_201608.lbl", 60.0)
MAP_75S = ("avgvisib_75s_120m_201608", "AVGVISIB_75S_120M_201608.LBL", 120.0)
USE_85S = False


def load_sites():
    with SITES_CSV.open(newline="", encoding="utf-8") as f:
        return [(r["id"], float(r["lat"]), float(r["lon"])) for r in csv.DictReader(f)]


def enu_basis(lat_deg, lon_deg):
    lat, lon = math.radians(lat_deg), math.radians(lon_deg)
    up = np.array([math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)])
    z = np.array([0.0, 0.0, 1.0])
    east = np.cross(z, up)
    east /= np.linalg.norm(east)
    north = np.cross(up, east)
    return up, east, north


def sample_latlon(lat_deg, lon_deg):
    """Lat/lon (deg, east-positive) of every tile sample, shape (SIZE, SIZE)."""
    up, east, north = enu_basis(lat_deg, lon_deg)
    idx = np.arange(SIZE)
    x_e = (idx[None, :] - HALF) * SPACING_M  # col j
    y_n = (HALF - idx[:, None]) * SPACING_M  # row i
    x_e, y_n = np.broadcast_arrays(x_e, y_n)
    p = (R_M * up)[:, None, None] + x_e[None] * east[:, None, None] + y_n[None] * north[:, None, None]
    p /= np.linalg.norm(p, axis=0)
    lat = np.degrees(np.arcsin(np.clip(p[2], -1.0, 1.0)))
    lon = np.degrees(np.arctan2(p[1], p[0]))
    return lat, lon


def bilinear_read(src, transformer, lat, lon):
    """Bilinear samples of band 1 of an open raster at lat/lon arrays; NaN where not valid.

    One windowed read covering all requested points (plus a 2 px margin), clipped to the raster.
    """
    x, y = transformer.transform(lon, lat)
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    inv = ~src.transform
    cf, rf = inv * (x, y)
    fc, fr = np.asarray(cf) - 0.5, np.asarray(rf) - 0.5  # pixel-centre indices
    finite = np.isfinite(fc) & np.isfinite(fr)
    if not finite.any():
        return np.full(lat.shape, np.nan)
    c_lo = max(int(math.floor(np.nanmin(fc))) - 2, 0)
    r_lo = max(int(math.floor(np.nanmin(fr))) - 2, 0)
    c_hi = min(int(math.ceil(np.nanmax(fc))) + 3, src.width)
    r_hi = min(int(math.ceil(np.nanmax(fr))) + 3, src.height)
    if c_hi <= c_lo or r_hi <= r_lo:
        return np.full(lat.shape, np.nan)
    arr = src.read(1, window=Window(c_lo, r_lo, c_hi - c_lo, r_hi - r_lo)).astype(float)
    if src.nodatavals[0] is not None and not math.isnan(src.nodatavals[0]):
        arr[arr == src.nodatavals[0]] = np.nan
    arr[~np.isfinite(arr)] = np.nan
    return _bilinear_local(arr, fc - c_lo, fr - r_lo, scale=src.scales[0])


def _bilinear_local(arr, lc, lr, scale=1.0):
    h, w = arr.shape
    c0 = np.floor(lc).astype(int)
    r0 = np.floor(lr).astype(int)
    ok = (c0 >= 0) & (r0 >= 0) & (c0 + 1 < w) & (r0 + 1 < h)
    c0c = np.clip(c0, 0, w - 2)
    r0c = np.clip(r0, 0, h - 2)
    dc = lc - c0c
    dr = lr - r0c
    v00 = arr[r0c, c0c]
    v01 = arr[r0c, c0c + 1]
    v10 = arr[r0c + 1, c0c]
    v11 = arr[r0c + 1, c0c + 1]
    val = (v00 * (1 - dc) * (1 - dr) + v01 * dc * (1 - dr) + v10 * (1 - dc) * dr + v11 * dc * dr) * scale
    return np.where(ok & np.isfinite(val), val, np.nan)


def site_centre_inside(src, transformer, lat, lon):
    x, y = transformer.transform(lon, lat)
    col, row = (~src.transform) * (x, y)
    return 0 <= col < src.width and 0 <= row < src.height


def build_site(site_id, lat, lon, dem, dem_tr, illum_src, illum_tr):
    grid_lat, grid_lon = sample_latlon(lat, lon)
    # One DEM read covers the tile and the site centre (last element, for the ground height).
    all_lat = np.append(grid_lat.ravel(), lat)
    all_lon = np.append(grid_lon.ravel(), lon)
    dem_all = bilinear_read(dem, dem_tr, all_lat, all_lon)
    ground = dem_all[-1]
    if not np.isfinite(ground):
        return None
    dem_vals = dem_all[:-1].reshape(SIZE, SIZE)
    heights = dem_vals - ground
    valid = np.isfinite(heights)
    h_int = np.where(valid, np.rint(heights), NODATA)
    if np.any((h_int != NODATA) & ((h_int < -32767) | (h_int > 32767))):
        raise SystemExit(f"{site_id}: height out of Int16 range")
    h_int = h_int.astype("<i2")

    illum_name, _, illum_res = illum_src["meta"]
    frac = bilinear_read(illum_src["src"], illum_tr, grid_lat, grid_lon)
    lit = np.clip(np.nan_to_num(frac, nan=0.0), 0.0, 1.0)
    gray = np.rint(lit * 255).astype(np.uint8)
    alpha = np.where(np.isfinite(frac), 255, 0).astype(np.uint8)
    return h_int, gray, alpha, valid, np.isfinite(frac), illum_name, illum_res


def main():
    dem_path = data_root() / "lola" / DEM_NAME
    OUT.mkdir(parents=True, exist_ok=True)
    report = []
    with rasterio.open(dem_path) as dem, \
            rasterio.open(data_root() / "illumination" / MAP_85S[1]) as m85, \
            rasterio.open(data_root() / "illumination" / MAP_75S[1]) as m75:
        dem_crs = CRS.from_wkt(dem.crs.to_wkt())
        dem_tr = Transformer.from_crs(dem_crs.geodetic_crs, dem_crs, always_xy=True)
        m85_tr = Transformer.from_crs(CRS.from_wkt(m85.crs.to_wkt()).geodetic_crs,
                                      CRS.from_wkt(m85.crs.to_wkt()), always_xy=True)
        m75_tr = Transformer.from_crs(CRS.from_wkt(m75.crs.to_wkt()).geodetic_crs,
                                      CRS.from_wkt(m75.crs.to_wkt()), always_xy=True)
        for site_id, lat, lon in load_sites():
            if not site_centre_inside(dem, dem_tr, np.array([lat]), np.array([lon])):
                report.append((site_id, "skipped: site centre outside the DEM"))
                continue
            if USE_85S and lat < -85.0:
                illum = {"src": m85, "meta": MAP_85S}
                illum_tr = m85_tr
            else:
                illum = {"src": m75, "meta": MAP_75S}
                illum_tr = m75_tr
            res = build_site(site_id, lat, lon, dem, dem_tr, illum, illum_tr)
            if res is None:
                report.append((site_id, "skipped: no DEM value at the site"))
                continue
            h_int, gray, alpha, valid, illum_ok, illum_name, illum_res = res
            (OUT / f"{site_id}.bin").write_bytes(h_int.astype("<i2").tobytes(order="C"))
            Image.merge("LA", [Image.fromarray(gray), Image.fromarray(alpha)]).save(
                OUT / f"{site_id}-illum.png", optimize=True)
            meta = {
                "site_id": site_id,
                "size": SIZE,
                "spacing_m": SPACING_M,
                "order": ORDER,
                "height_ref": HEIGHT_REF,
                "nodata": NODATA,
                "illum_png": f"{site_id}-illum.png",
                "illum_map": illum_name,
                "illum_res_m": illum_res,
                "dem": DEM_NAME,
            }
            (OUT / f"{site_id}.json").write_text(json.dumps(meta, indent=1) + "\n", encoding="utf-8")
            report.append((site_id,
                           f"dem_valid={valid.mean():.3f} illum_valid={illum_ok.mean():.3f} "
                           f"h_min={h_int[valid].min() if valid.any() else 'na'} "
                           f"h_max={h_int[valid].max() if valid.any() else 'na'} "
                           f"map={illum_name}"))
    for site_id, msg in report:
        print(f"{site_id}: {msg}")


if __name__ == "__main__":
    sys.exit(main())
