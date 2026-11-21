"""Synthetic and edge tests for scripts/horizon.py (build-plan §4.2, §7: T5–T8, T13).

The synthetic DEMs are in-memory grids in a polar stereographic projection on the
1737.4 km sphere. Expected values come from formulas and helpers written here,
independently of horizon.py's ray code: a lat/lon "destination point" formula for
positions and the scalar elevation formula sin(e) = (rp·cos θ − ro) / L.
"""
import json
import math
import os
from pathlib import Path

import numpy as np
import pytest
from affine import Affine
from pyproj import CRS, Transformer

import horizon as hz

R_KM = 1737.4
H_OBS_M = 1.75
DIP_DEG = -math.degrees(math.acos(R_KM / (R_KM + H_OBS_M / 1000)))  # −0.08132°
TOL_DEG = 0.01  # V3 tolerance

SYN_CRS = CRS.from_proj4("+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs")
TO_XY = Transformer.from_crs(SYN_CRS.geodetic_crs, SYN_CRS, always_xy=True)

SITE_LAT, SITE_LON = -88.5, 45.0


# ---------- independent geometry helpers ----------

def destination(lat_deg, lon_deg, az_deg, d_km):
    """Great-circle destination (bearing from north, clockwise), spherical trig."""
    p1, l1, th, dl = map(math.radians, (lat_deg, lon_deg, az_deg, math.degrees(d_km / R_KM)))
    p2 = math.asin(math.sin(p1) * math.cos(dl) + math.cos(p1) * math.sin(dl) * math.cos(th))
    l2 = l1 + math.atan2(math.sin(th) * math.sin(dl) * math.cos(p1), math.cos(dl) - math.sin(p1) * math.sin(p2))
    return math.degrees(p2), (math.degrees(l2) + 180) % 360 - 180


def destination_arr(lat_deg, lon_deg, az_deg, d_km):
    p1, l1, th = map(math.radians, (lat_deg, lon_deg, az_deg))
    dl = np.asarray(d_km) / R_KM
    p2 = np.arcsin(math.sin(p1) * np.cos(dl) + math.cos(p1) * np.sin(dl) * math.cos(th))
    l2 = l1 + np.arctan2(math.sin(th) * np.sin(dl) * math.cos(p1), np.cos(dl) - math.sin(p1) * np.sin(p2))
    return np.degrees(p2), np.degrees(l2)


def elevation_deg(obs_total_m, d_km, target_m):
    """Elevation of a point at arc distance d_km and height target_m, seen from obs_total_m."""
    ro = R_KM + obs_total_m / 1000.0
    rp = R_KM + np.asarray(target_m) / 1000.0
    th = np.asarray(d_km) / R_KM
    L = np.sqrt(ro**2 + rp**2 - 2 * ro * rp * np.cos(th))
    return np.degrees(np.arcsin((rp * np.cos(th) - ro) / L))


def xy(lat, lon):
    return TO_XY.transform(lon, lat)


# ---------- synthetic grids ----------

def make_grid(center_xy, half_m, res_m, align_xy=None):
    """Zero grid; if align_xy is given, one pixel centre sits exactly on it."""
    ax, ay = align_xy if align_xy is not None else center_xy
    n_left = math.ceil((ax - (center_xy[0] - half_m)) / res_m)
    n_top = math.ceil(((center_xy[1] + half_m) - ay) / res_m)
    x0 = ax - (n_left + 0.5) * res_m
    y0 = ay + (n_top + 0.5) * res_m
    n = math.ceil(2 * half_m / res_m) + 2
    t = Affine(res_m, 0, x0, 0, -res_m, y0)
    return hz.Grid(np.zeros((n, n), dtype=np.float32), t)


def pixel_xy(grid, rows, cols):
    t = grid.transform
    return t.c + (cols + 0.5) * t.a, t.f + (rows + 0.5) * t.e


def add_feature(grid, center_xy, radius_m, fn):
    """Add fn(dx, dy) (metres) to the pixels within radius_m of center_xy."""
    t = grid.transform
    c0 = max(int((center_xy[0] - radius_m - t.c) / t.a) - 1, 0)
    c1 = min(int((center_xy[0] + radius_m - t.c) / t.a) + 2, grid.data.shape[1])
    r0 = max(int((center_xy[1] + radius_m - t.f) / t.e) - 1, 0)
    r1 = min(int((center_xy[1] - radius_m - t.f) / t.e) + 2, grid.data.shape[0])
    if c0 >= c1 or r0 >= r1:
        return
    rows, cols = np.mgrid[r0:r1, c0:c1]
    px, py = pixel_xy(grid, rows, cols)
    grid.data[r0:r1, c0:c1] += fn(px - center_xy[0], py - center_xy[1]).astype(np.float32)


def cone(height_m, radius_m):
    return lambda dx, dy: height_m * np.clip(1 - np.hypot(dx, dy) / radius_m, 0, None)


def grids(site_xy, near_align=None, far_align=None):
    near = make_grid(site_xy, 21_000, 20.0, near_align)
    far = make_grid(site_xy, 310_000, 160.0, far_align)
    return near, far


def run(near, far, lat=SITE_LAT, lon=SITE_LON, **kw):
    return hz.compute_horizon("synthetic", lat, lon, near, far, SYN_CRS, **kw)


def mask_at(res, az):
    return res["mask"][int(round(az / 0.5)) % 720]


# ---------- tests ----------

def test_ray_distances():
    d = hz.ray_distances_km()
    assert d[0] == pytest.approx(0.02) and d[-1] == 300.0
    near = d[d <= 4.0 + 1e-9]
    assert len(near) == 200 and np.allclose(np.diff(near), 0.02)
    steps = np.diff(d[199:-1])
    assert np.allclose(steps[1:] / steps[:-1], 1.005)
    assert 1050 < len(d) < 1080


def test_t5_flat_sphere_dip():
    site = xy(SITE_LAT, SITE_LON)
    res = run(*grids(site))
    m = np.array(res["mask"])
    assert len(m) == 720 and res["az_step"] == 0.5 and res["ray_max_km"] == 300
    assert res["observer_height_m"] == 1.75
    assert abs(DIP_DEG - (-0.0813)) < 1e-3
    assert np.all(np.abs(m - DIP_DEG) < TOL_DEG), (m.min(), m.max())
    # the dip is reached at sqrt(2 h R) ≈ 2.47 km
    assert np.all(np.abs(np.array(res["mask_dist_km"]) - 2.466) < 0.05)
    assert res["truncated"] == []
    assert res["elev_m"] == 0 and res["slope_deg"] == 0


@pytest.mark.parametrize("az, d_target_km, h_m, r_m", [(37.5, 3.0, 200.0, 1500.0), (251.0, 60.0, 3000.0, 15000.0)])
def test_t6_single_cone(az, d_target_km, h_m, r_m):
    """Near-field (3 km) and far-field (60 km) cone: mask at its azimuth = angle to its apex."""
    dists = hz.ray_distances_km()
    d = float(dists[np.argmin(np.abs(dists - d_target_km))])  # apex exactly on a ray sample
    apex = xy(*destination(SITE_LAT, SITE_LON, az, d))
    site = xy(SITE_LAT, SITE_LON)
    near, far = grids(site, near_align=apex, far_align=apex)
    for g in (near, far):
        add_feature(g, apex, r_m, cone(h_m, r_m))
    res = run(near, far)
    expected = float(elevation_deg(H_OBS_M, d, h_m))
    assert abs(mask_at(res, az) - expected) < TOL_DEG, (mask_at(res, az), expected)
    assert abs(res["mask_dist_km"][int(az / 0.5)] - d) < 0.05
    # opposite direction is still the flat-sphere dip
    assert abs(mask_at(res, az + 180) - DIP_DEG) < TOL_DEG


def test_t7_wall_at_known_azimuth():
    """A straight ridge with a rounded crest, 5 km away at azimuth 120°; compare with a 1 m brute-force truth."""
    A, D, H, W, L = 120.0, 5.0, 300.0, 800.0, 3000.0
    site = xy(SITE_LAT, SITE_LON)
    c = np.array(xy(*destination(SITE_LAT, SITE_LON, A, D)))
    n = (c - np.array(site)) / np.linalg.norm(c - np.array(site))  # across the crest
    p = np.array([-n[1], n[0]])                                      # along the crest

    def wall(dx, dy):
        t = dx * n[0] + dy * n[1]
        s = dx * p[0] + dy * p[1]
        across = np.where(np.abs(t) < W, np.cos(np.pi * t / (2 * W)) ** 2, 0.0)
        along = np.clip((L + 500 - np.abs(s)) / 500, 0, 1)
        along = np.sin(np.pi / 2 * along) ** 2
        return H * across * along

    near, far = grids(site)
    for g in (near, far):
        add_feature(g, tuple(c), L + 600 + W, wall)
    res = run(near, far)
    m = np.array(res["mask"])

    def truth(az):
        dd = np.arange(1, 12001) / 1000.0  # 1 m steps to 12 km
        la, lo = destination_arr(SITE_LAT, SITE_LON, az, dd)
        x, y = TO_XY.transform(lo, la)
        h = wall(np.asarray(x) - c[0], np.asarray(y) - c[1])
        return float(np.max(elevation_deg(H_OBS_M, dd, h)))

    assert abs(np.argmax(m) * 0.5 - A) <= 0.5
    for az in (A, A - 20, A + 20):
        assert abs(mask_at(res, az) - truth(az)) < TOL_DEG, (az, mask_at(res, az), truth(az))
    assert mask_at(res, A) > 3.0  # the wall is clearly visible
    for az in (A + 180, A + 120, A - 120):
        assert abs(mask_at(res, az) - DIP_DEG) < TOL_DEG


def test_t8_synthetic_edge_truncates_not_zero():
    """Grid ends 30 km north of the site, and a nodata patch lies east beyond 10 km."""
    site = xy(SITE_LAT, SITE_LON)
    near, far = grids(site)
    # north edge: drop far-grid rows beyond 30 km toward the site's north direction
    north_pt = np.array(xy(*destination(SITE_LAT, SITE_LON, 0.0, 30.0)))
    east_pt = np.array(xy(*destination(SITE_LAT, SITE_LON, 90.0, 12.0)))
    nvec = (north_pt - np.array(site)) / np.linalg.norm(north_pt - np.array(site))
    for g in (near, far):
        rows, cols = np.ogrid[0:g.data.shape[0], 0:g.data.shape[1]]
        px, py = pixel_xy(g, rows, cols)
        beyond = (px - site[0]) * nvec[0] + (py - site[1]) * nvec[1] > 30_000
        g.data[beyond] = np.nan
        patch = np.hypot(px - east_pt[0], py - east_pt[1]) < 1500
        g.data[patch] = np.nan
    res = run(near, far)
    trunc = set(res["truncated"])
    assert 0.0 in trunc and 90.0 in trunc
    assert 180.0 not in trunc and 270.0 not in trunc
    for az in (0.0, 90.0):
        v = mask_at(res, az)
        assert math.isfinite(v) and v != 0.0
        assert abs(v - DIP_DEG) < TOL_DEG  # max over the valid part of the ray, not a filler value
    assert all(math.isfinite(v) for v in res["mask"])


DEM = Path(os.environ.get("CLPS_DATA", "~/Documents/clps/data/clps")).expanduser() / "lola" / "LDEM_80S_20MPP_ADJ.TIF"


@pytest.mark.skipif(not DEM.exists(), reason="real DEM not available (set CLPS_DATA)")
def test_t8_real_dem_site_near_80s():
    """IM-1 (80.13°S, 1.44°E, sources.md): rays toward the 80°S edge are truncated, never written as 0."""
    res = hz.horizon_for_site("im-1-test", -80.13, 1.44, DEM)
    assert len(res["truncated"]) > 0
    assert 0.0 in res["truncated"]           # due north points away from the pole, toward the DEM edge
    assert 180.0 not in res["truncated"]     # toward the pole stays inside the DEM
    m = np.array(res["mask"])
    assert np.all(np.isfinite(m)) and len(m) == 720
    assert not np.any(m[[int(a / 0.5) for a in res["truncated"]]] == 0.0)


FILL_DEM = DEM.parent / hz.FILL_DEM_NAME


def test_t8_rays_continue_on_the_fill_grid():
    """Same cut as the synthetic T8 (grid ends 30 km north). With a wider fill grid behind it no ray is
    truncated, and a 3 km cone 60 km north, present only in the fill grid, is in the mask."""
    site = xy(SITE_LAT, SITE_LON)
    near, far = grids(site)
    north_pt = np.array(xy(*destination(SITE_LAT, SITE_LON, 0.0, 30.0)))
    nvec = (north_pt - np.array(site)) / np.linalg.norm(north_pt - np.array(site))
    for g in (near, far):
        rows, cols = np.ogrid[0:g.data.shape[0], 0:g.data.shape[1]]
        px, py = pixel_xy(g, rows, cols)
        g.data[(px - site[0]) * nvec[0] + (py - site[1]) * nvec[1] > 30_000] = np.nan
    dists = hz.ray_distances_km()
    d = float(dists[np.argmin(np.abs(dists - 60.0))])
    apex = xy(*destination(SITE_LAT, SITE_LON, 0.0, d))
    fill = make_grid(site, 310_000, 120.0, apex)
    add_feature(fill, apex, 15_000, cone(3000.0, 15_000))
    cut = run(near, far)
    res = run(hz.FilledGrid(near, fill), hz.FilledGrid(far, fill))
    assert 0.0 in cut["truncated"] and res["truncated"] == []
    expected = float(elevation_deg(H_OBS_M, d, 3000.0))
    assert expected > 1.5 and abs(mask_at(res, 0.0) - expected) < TOL_DEG
    assert abs(mask_at(cut, 0.0) - DIP_DEG) < TOL_DEG                  # without the fill the cone is missed
    assert mask_at(res, 180.0) == mask_at(cut, 180.0)                  # nothing changes where the DEM has data


@pytest.mark.skipif(not (DEM.exists() and FILL_DEM.exists()), reason="80 S and 60 S DEMs not available (set CLPS_DATA)")
def test_t8_real_im1_is_complete_with_the_60s_dem():
    """IM-1 lies about 4 km inside the 20 m DEM's edge. With the 60 S DEM behind it every ray reaches 300 km,
    the skyline never drops, changes only where the ray was cut before, and equals the shipped file."""
    cut = hz.horizon_for_site("im-1", -80.13, 1.44, DEM)
    res = hz.horizon_for_site("im-1", -80.13, 1.44, DEM, fill_path=FILL_DEM)
    assert res["truncated"] == [] and "LDEM_60S_120MPP_ADJ" in res["dem"]
    d = np.array(res["mask"]) - np.array(cut["mask"])
    was_cut = np.zeros(720, dtype=bool)
    was_cut[[int(a / 0.5) for a in cut["truncated"]]] = True
    assert d.min() >= 0 and np.all(d[~was_cut] == 0) and 0.5 < d.max() < 2.0
    shipped = json.loads((hz.HORIZON_DIR / "im-1.json").read_text(encoding="utf-8"))
    assert res["mask"] == shipped["mask"] and shipped["truncated"] == []


def test_t13_5km_cone_at_200km():
    """Site on a 2.5 km spire; a 5 km cone 200 km away is in the mask, and a 150 km cutoff would miss it."""
    az = 300.0
    dists = hz.ray_distances_km()
    d = float(dists[np.argmin(np.abs(dists - 200.0))])
    site = xy(SITE_LAT, SITE_LON)
    apex = xy(*destination(SITE_LAT, SITE_LON, az, d))
    near, far = grids(site, near_align=site, far_align=apex)
    for g in (near, far):
        add_feature(g, site, 10_000, cone(2500.0, 10_000))
        add_feature(g, apex, 20_000, cone(5000.0, 20_000))
    res = run(near, far)
    assert res["elev_m"] == pytest.approx(2500.0, abs=0.1)
    expected = float(elevation_deg(2500.0 + H_OBS_M, d, 5000.0))
    flat_dip = float(-np.degrees(np.arccos(R_KM / (R_KM + 2.50175))))
    assert expected > flat_dip + 0.2  # the cone really rises above the spire's own horizon
    assert abs(mask_at(res, az) - expected) < TOL_DEG, (mask_at(res, az), expected)
    assert abs(res["mask_dist_km"][int(az / 0.5)] - d) < 1.0
    short = run(near, far, ray_max_km=150.0)
    assert short["ray_max_km"] == 150
    assert abs(mask_at(short, az) - expected) > 0.2
    assert short["mask_dist_km"][int(az / 0.5)] < 150.0
