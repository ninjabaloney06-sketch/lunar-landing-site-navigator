"""Tests for scripts/assessments.py on synthetic grids (no raw data needed)."""
import math

import numpy as np
import pytest
import rasterio
from affine import Affine
from pyproj import CRS, Geod, Transformer

import assessments as A

RES = 5.0
N = 81  # 81 x 81 px at 5 m: a 100 m disk fits with margin


def plane(deg, n=N, res=RES):
    """Heights of a plane tilted `deg` degrees along +x, plus its transform and centre x/y."""
    t = Affine(res, 0, 0, 0, -res, n * res)
    cols = np.arange(n)[None, :].repeat(n, 0)
    z = math.tan(math.radians(deg)) * (cols + 0.5) * res
    c = (n * res) / 2
    return z, t, c, c


def landing_stats(z, t, x, y):
    s = A.slope_grid(z, RES, 1.0)
    mask = A.disk_mask(t, z.shape, x, y, A.LANDING_RADIUS_M)
    return A.area_slope_stats(s, mask)


@pytest.mark.parametrize("deg,passes,lt20", [
    (4.99, True, 100.0), (5.0, True, 100.0), (5.01, False, 100.0),
    (19.99, False, 100.0), (20.0, False, 0.0)])
def test_tilted_plane_thresholds(deg, passes, lt20):
    st = landing_stats(*plane(deg))
    assert st["status"] == "computed"
    assert st["max_slope_deg"] == pytest.approx(deg, abs=1e-9)
    assert st["median_slope_deg"] == pytest.approx(deg, abs=1e-9)
    assert A.landing_pass(st) is passes
    assert st["pct_le_5deg"] == (100.0 if deg <= 5.0 else 0.0)
    assert st["pct_lt_20deg"] == lt20


def test_roughness_flat_and_tilted_plane_is_zero():
    for deg in (0.0, 12.0):
        z, t, x, y = plane(deg)
        mask = A.disk_mask(t, z.shape, x, y, A.LANDING_RADIUS_M)
        rms, nodata = A.plane_rms(z, mask, t)
        assert rms == pytest.approx(0.0, abs=1e-9)
        assert nodata == 0.0


def test_roughness_known_value():
    z, t, x, y = plane(0.0)
    z = z + np.where((np.indices(z.shape).sum(0) % 2) == 0, 1.0, -1.0)  # +-1 m checkerboard
    mask = A.disk_mask(t, z.shape, x, y, A.LANDING_RADIUS_M)
    rms, _ = A.plane_rms(z, mask, t)
    assert rms == pytest.approx(1.0, abs=0.01)


def test_nodata_handling():
    z, t, x, y = plane(3.0)
    rows = np.indices(z.shape)[0]
    z_small = np.where(rows < 26, np.nan, z)   # top cap of the disk lost (< 20 % incl. the slope edge row)
    st = landing_stats(z_small, t, x, y)
    assert st["status"] == "computed"
    assert 0 < st["nodata_pct"] <= 20
    assert st["max_slope_deg"] == pytest.approx(3.0, abs=1e-9)  # NaN excluded, not counted as 0
    z_big = np.where(rows < 41, np.nan, z)     # about half the disk lost
    st = landing_stats(z_big, t, x, y)
    assert st["status"] == "unknown" and st["max_slope_deg"] is None and st["nodata_pct"] > 20
    assert A.landing_pass(st) is None
    mask = A.disk_mask(t, z.shape, x, y, A.LANDING_RADIUS_M)
    rms, nf = A.plane_rms(z_big, mask, t)
    assert rms is None and nf > 0.2


def write_tif(path, data, transform, nodata=None):
    with rasterio.open(path, "w", driver="GTiff", width=data.shape[1], height=data.shape[0], count=1,
                       dtype=data.dtype, crs=CRS(A.DEM_CRS).to_wkt(), transform=transform,
                       nodata=nodata) as ds:
        ds.write(data, 1)


def site_xy(lat, lon):
    tr = Transformer.from_crs(CRS(A.DEM_CRS).geodetic_crs, CRS(A.DEM_CRS), always_xy=True)
    return tr.transform(lon, lat)


def test_site_outside_coverage_is_unknown(tmp_path):
    x0, y0 = site_xy(-89.0, 0.0)
    p = tmp_path / "dem.tif"
    write_tif(p, np.zeros((50, 50), np.float32), Affine(20, 0, x0 - 500, 0, -20, y0 + 500))
    dem = A.Raster(p, 20.0)
    lat, lon = -85.0, 0.0                      # ~120 km away from the tile
    assert dem.contains(-89.0, 0.0) and not dem.contains(lat, lon)
    d, g, notes = A.choose_dem(lat, lon, None, dem)
    assert d is None and g is None
    slope, rough = A.slope_and_roughness(lat, lon, d, g, notes)
    assert slope["status"] == "unknown" and slope["landing_slope_pass"] is None
    assert rough["status"] == "unknown" and rough["obstacles"] == "unknown"
    psr = A.psr_block(lat, lon, [dem], None, dem, [])
    assert psr["status"] == "unknown" and psr["nearest_cluster"] is None


def test_nearest_shadow_distance_on_synthetic_grid(tmp_path):
    lat, lon = -85.0, 0.0
    sx, sy = site_xy(lat, lon)
    res, n = 60.0, 200
    # site at the centre of pixel (100, 100)
    t = Affine(res, 0, sx - 100.5 * res, 0, -res, sy + 100.5 * res)
    dn = np.full((n, n), 1000, np.int16)
    dn[95:115, 150:170] = 0      # 20 x 20 px = 1.44 km2, starts 50 px east (+x) of the site
    dn[100, 120:122] = 0         # 2 px = 0.0072 km2, closer but below the minimum area
    p = tmp_path / "vis.tif"
    write_tif(p, dn, t, nodata=-32768)
    vis = A.Raster(p, res)
    dp = tmp_path / "flat.tif"
    write_tif(dp, np.zeros((n, n), np.float32), t)
    dem = A.Raster(dp, res)

    out = A.psr_block(lat, lon, [vis], None, dem, [])
    nc = out["nearest_cluster"]
    # expected: geodesic (pyproj.Geod on the 1737.4 km sphere) to the centre of pixel (100, 150)
    tx, ty = t.c + 150.5 * res, t.f - 100.5 * res
    tlon, tlat = Transformer.from_crs(CRS(A.DEM_CRS), CRS(A.DEM_CRS).geodetic_crs,
                                      always_xy=True).transform(tx, ty)
    _, _, d_m = Geod(a=1737400.0, b=1737400.0).inv(lon, lat, tlon, tlat)
    assert out["status"] == "computed"
    assert nc["distance_km"] == pytest.approx(d_m / 1000, abs=0.002)
    assert nc["distance_km"] == pytest.approx(3.0 / vis.k(lat, lon), abs=0.01)
    assert nc["bearing_deg"] == pytest.approx(90.0, abs=0.5)   # +x is east at lon 0
    assert nc["cluster_area_km2"] == pytest.approx(400 * (res / vis.k(lat, lon) / 1000) ** 2, abs=0.001)
    assert out["shadow_area_within_km2"]["5km"] > 0
    assert out["site_pixel_zero_visibility"] is False
    line = nc["straight_line"]
    assert line["label"] == A.LINE_LABEL
    assert line["max_slope_deg"] == 0.0 and line["pct_lt_20deg"] == 100.0
    assert nc["named_psr"] is None


def test_wording_in_output_constants():
    text = " ".join([A.SLOPE_METHOD, A.SHADOW_WORDING, A.LINE_LABEL, A.CRITERIA_NOTE]).lower()
    for bad in ("safe to land", "optimal", "ice confirmed"):
        assert bad not in text




def _repro(dem, lat, lon):
    """elev and 100 m point slope as horizon.py computes them, read through assessments.Raster."""
    from horizon import SLOPE_HALF_BASE_KM, ray_points, to_latlon
    x, y = dem.xy(lat, lon)
    g = dem.read_box(x, y, 200.0)
    h = float(g.sample([x], [y])[0])
    la, lo = to_latlon(ray_points(lat, lon, [90.0, 270.0, 0.0, 180.0], [SLOPE_HALF_BASE_KM])[:, 0, :])
    hx, hy = dem.to_xy.transform(lo, la)
    he, hw, hn, hs = g.sample(hx, hy)
    return h, math.degrees(math.atan(math.hypot((he - hw) / 100.0, (hn - hs) / 100.0)))


@pytest.mark.skipif(not __import__("os").environ.get("CLPS_DATA"), reason="needs CLPS_DATA raw DEMs")
@pytest.mark.parametrize("sid", ["connecting-ridge", "haworth", "shackleton-rim-site04"])
def test_reproduces_sites_json_elev_and_point_slope(sid):
    import json
    from config import data_root
    site = next(s for s in json.loads(A.SITES_JSON.read_text()) if s["id"] == sid)
    dem20 = A.Raster(data_root() / A.DEM20[0], A.DEM20[1])
    h, s = _repro(dem20, site["lat"], site["lon"])
    assert abs(h - site["elev_m"]) <= 1.0
    assert abs(s - site["slope_deg"]) <= 0.5
    dem5 = A.Raster(data_root() / A.DEM5[0], A.DEM5[1])
    assert dem5.scale == 0.5                       # read from the .lbl, not assumed
    if dem5.contains(site["lat"], site["lon"]):
        h5, s5 = _repro(dem5, site["lat"], site["lon"])
        print(f"{sid}: 20 m {h:.2f} m {s:.2f} deg; 5 m {h5:.2f} m {s5:.2f} deg; json {site['elev_m']} {site['slope_deg']}")
        assert abs(h5 - site["elev_m"]) <= 2.5       # different product (LOLA GDR 2017 vs PGDA ADJ 2023)
    else:
        print(f"{sid}: 20 m {h:.2f} m {s:.2f} deg; outside 5 m DEM; json {site['elev_m']} {site['slope_deg']}")
