"""Terrain levels (scripts/terrain_tiles.py, track-terrain): orientation, nesting and agreement.

Expectations are computed here, independently of terrain_tiles' vector code: lat/lon of a grid sample from
the spherical "destination point" formula (bearing atan2(x, y), arc R*atan(rho/R) for the radial projection),
raw DEM values from our own windowed reads, ldem_16 decoded here. Two sites: the demo site and Shackleton
Rim Site04 (steep rim, the known ground-reference case); the seam between the two DEMs at im-1 and Amundsen Rim.
"""
import json
import math
import os
from pathlib import Path

import numpy as np
import pytest

import terrain_tiles as tt

TERRAIN = Path(__file__).resolve().parents[2] / "app" / "public" / "data" / "terrain"
SITES = {s[0]: (s[1], s[2]) for s in tt.load_sites()}
OVERLAP_SITES = ["connecting-ridge", "shackleton-rim-site04"]
SEAM_SITES = ["im-1", "amundsen-rim"]
R_M = 1737400.0


def destination(lat_deg, lon_deg, az_deg, d_m):
    """Great-circle destination (bearing from north, clockwise), spherical trig."""
    p1, l1, th = map(math.radians, (lat_deg, lon_deg, az_deg))
    dl = d_m / R_M
    p2 = math.asin(math.sin(p1) * math.cos(dl) + math.cos(p1) * math.sin(dl) * math.cos(th))
    l2 = l1 + math.atan2(math.sin(th) * math.sin(dl) * math.cos(p1), math.cos(dl) - math.sin(p1) * math.sin(p2))
    return math.degrees(p2), (math.degrees(l2) + 180) % 360 - 180


def grid_point(site, size, spacing, i, j):
    """Independent lat/lon of grid sample (i, j): row 0 = north edge, col 0 = west edge."""
    half = (size - 1) / 2
    x, y = (j - half) * spacing, (half - i) * spacing
    rho = math.hypot(x, y)
    az = math.degrees(math.atan2(x, y))
    return destination(*SITES[site], az, R_M * math.atan(rho / R_M))


def load(site, level=None):
    name = site if level is None else f"{site}-{level}"
    meta = json.loads((TERRAIN / f"{name}.json").read_text())
    raw = np.fromfile(TERRAIN / f"{name}.bin", dtype="<i2").reshape(meta["size"], meta["size"])
    h = np.where(raw == meta["nodata"], np.nan, raw * meta.get("height_scale_m", 1.0))
    return meta, h


def bilinear(h, spacing, x, y):
    n = h.shape[0]
    half = (n - 1) / 2
    fj, fi = x / spacing + half, half - y / spacing
    j0 = np.clip(np.floor(fj).astype(int), 0, n - 2)
    i0 = np.clip(np.floor(fi).astype(int), 0, n - 2)
    dj, di = fj - j0, fi - i0
    return ((h[i0, j0] * (1 - dj) + h[i0, j0 + 1] * dj) * (1 - di)
            + (h[i0 + 1, j0] * (1 - dj) + h[i0 + 1, j0 + 1] * dj) * di)


def rms(d):
    d = d[np.isfinite(d)]
    return float(np.sqrt(np.mean(d * d)))


# ---------- grid orientation (no raw data) ----------

@pytest.mark.parametrize("site", OVERLAP_SITES + ["im-1"])
@pytest.mark.parametrize("level", list(tt.LEVELS))
def test_grid_latlon_matches_destination_formula(site, level):
    size, spacing, _ = tt.LEVELS[level]
    lat, lon = tt.grid_latlon(*SITES[site], size, spacing)
    q = size // 4
    for i, j in [(q, size // 2), (size // 2, size - 1 - q), (size - 1 - q, q), (0, 0), (size - 1, size - 1)]:
        la, lo = grid_point(site, size, spacing, i, j)
        assert lat[i, j] == pytest.approx(la, abs=1e-9)
        assert ((lon[i, j] - lo + 180) % 360 - 180) == pytest.approx(0, abs=1e-8)


def test_80m_grid_unchanged_by_refactor():
    lat, lon = tt.sample_latlon(*SITES["connecting-ridge"])
    la, lo = grid_point("connecting-ridge", tt.SIZE, tt.SPACING_M, 0, tt.SIZE - 1)  # north-east corner
    assert lat.shape == (500, 500)
    assert lat[0, -1] == pytest.approx(la, abs=1e-9)
    assert ((lon[0, -1] - lo + 180) % 360 - 180) == pytest.approx(0, abs=1e-8)


# ---------- generated files: one reference height, nesting, agreement with the 80 m tile ----------

@pytest.mark.parametrize("site", sorted(SITES))
def test_level_files_share_one_reference_height(site):
    meta, _ = load(site)
    assert meta["levels"] == list(tt.LEVELS)
    for level, (size, spacing, _) in tt.LEVELS.items():
        m, h = load(site, level)
        assert (m["level"], m["size"], m["spacing_m"], m["nodata"]) == (level, size, spacing, meta["nodata"])
        assert m["order"] == meta["order"] and m["height_ref"] == meta["height_ref"]
        assert m["ground_m"] == meta["ground_m"]
        assert np.isfinite(h).any()
    # Odd sizes: each level's square nests on the next one's grid lines (scene stitching).
    exts = [(tt.SIZE - 1) / 2 * tt.SPACING_M] + [(s - 1) / 2 * sp for s, sp, _ in tt.LEVELS.values()]
    assert exts[1] < exts[0] < exts[2] < exts[3]
    assert all(s % 2 == 1 for s, _, _ in tt.LEVELS.values())


def _overlap_errors(site, level, transform=None):
    """Level minus the 80 m tile resampled to the level's footprint (fine: bilinear of the fine level at the
    tile's samples; mid/far: the tile's samples averaged over each level cell)."""
    tm, tile = load(site)
    m, h = load(site, level)
    if transform:
        h = transform(h)
    if level == "fine":
        half = (tm["size"] - 1) / 2
        k = np.arange(tm["size"])
        x = (k - half) * tm["spacing_m"]
        inside = np.abs(x) < m["spacing_m"] * (m["size"] - 1) / 2
        X, Y = np.meshgrid(x[inside], -x[inside])
        ii, jj = np.nonzero(inside)[0], np.nonzero(inside)[0]
        return bilinear(h, m["spacing_m"], X, Y) - tile[np.ix_(ii, jj)]
    sp, n = m["spacing_m"], m["size"]
    half = (n - 1) / 2
    w = int(round(sp / tm["spacing_m"] / 2))  # tile samples per half cell
    th = (tm["size"] - 1) / 2
    d = []
    for i in range(n):
        for j in range(n):
            x, y = (j - half) * sp, (half - i) * sp
            cj, ci = x / tm["spacing_m"] + th, th - y / tm["spacing_m"]  # .5 positions in the tile
            j0, i0 = int(round(cj - w + 0.5)), int(round(ci - w + 0.5))
            if j0 < 0 or i0 < 0 or j0 + 2 * w > tm["size"] or i0 + 2 * w > tm["size"]:
                continue
            d.append(h[i, j] - np.nanmean(tile[i0:i0 + 2 * w, j0:j0 + 2 * w]))
    return np.array(d)


# Tolerances (m, RMS over the overlap): both sides come from the same 20 m DEM; the differences are the
# resampling (bilinear of bilinear for fine, box means vs point samples for mid/far). A mirrored or rotated
# level is checked to be at least 5x worse, so these tolerances do detect an orientation error.
OVERLAP_RMS_M = {"fine": 2.0, "mid": 25.0, "far": 30.0}


@pytest.mark.parametrize("site", OVERLAP_SITES)
@pytest.mark.parametrize("level", list(tt.LEVELS))
def test_level_agrees_with_80m_tile_where_they_overlap(site, level):
    err = rms(_overlap_errors(site, level))
    print(f"{site} {level}: RMS vs 80 m tile {err:.2f} m")
    assert err < OVERLAP_RMS_M[level]
    for name, f in [("mirrored E-W", np.fliplr), ("mirrored N-S", np.flipud), ("rotated 90", np.rot90)]:
        bad = rms(_overlap_errors(site, level, f))
        print(f"  {name}: {bad:.1f} m")
        assert bad > 5 * max(err, 1.0), f"{site} {level}: {name} not detected ({bad:.1f} m vs {err:.1f} m)"


# ---------- raw data: three independent points per level, seam between the two DEMs ----------

def _data_root():
    root = os.environ.get("CLPS_DATA")
    return Path(root).expanduser() if root else None


DEM = (_data_root() / "lola" / tt.DEM_NAME) if _data_root() else None
LDEM16 = (_data_root() / "textures" / tt.FILL_NAME) if _data_root() else None
needs_dem = pytest.mark.skipif(not (DEM and DEM.exists()), reason="CLPS_DATA / LOLA DEM not available")
needs_fill = pytest.mark.skipif(not (LDEM16 and LDEM16.exists()), reason="CLPS_DATA / ldem_16 not available")


@pytest.fixture(scope="module")
def dem():
    import rasterio
    from pyproj import CRS, Transformer
    ds = rasterio.open(DEM)
    crs = CRS.from_wkt(ds.crs.to_wkt())
    yield ds, Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
    ds.close()


def raw_window(dem, lat, lon, half_px):
    """Raw DEM pixels in a (2 half_px) square around lat/lon (projected axes), and the point's pixel position."""
    from rasterio.windows import Window
    ds, tr = dem
    x, y = tr.transform(lon, lat)
    col, row = ~ds.transform * (x, y)
    c0, r0 = int(math.floor(col - half_px)), int(math.floor(row - half_px))
    a = ds.read(1, window=Window(c0, r0, 2 * half_px + 1, 2 * half_px + 1)).astype(float)
    return a, col - c0, row - r0


def raw_bilinear(dem, lat, lon):
    a, c, r = raw_window(dem, lat, lon, 2)
    c, r = c - 0.5, r - 0.5  # pixel-centre indices
    c0, r0 = int(math.floor(c)), int(math.floor(r))
    dc, dr = c - c0, r - r0
    return ((a[r0, c0] * (1 - dc) + a[r0, c0 + 1] * dc) * (1 - dr)
            + (a[r0 + 1, c0] * (1 - dc) + a[r0 + 1, c0 + 1] * dc) * dr)


def raw_box_mean(dem, lat, lon, width_m):
    half = int(round(width_m / 20 / 2))
    a, c, r = raw_window(dem, lat, lon, half + 1)
    ci, ri = int(round(c)), int(round(r))
    return float(np.nanmean(a[ri - half:ri + half, ci - half:ci + half]))


# Fine: bilinear of the same raster, only Int16 rounding left. Mid/far: our box is axis-aligned in the DEM's
# projection, the generator's is a box filter on 100 m block means, sampled bilinearly (footprints differ by
# up to one 100 m pixel and the grid convergence rotation).
POINT_TOL_M = {"fine": 0.6, "mid": 25.0, "far": 60.0}


@needs_dem
@pytest.mark.parametrize("site", OVERLAP_SITES)
@pytest.mark.parametrize("level", list(tt.LEVELS))
def test_level_matches_raw_dem_north_east_southwest(site, level, dem):
    m, h = load(site, level)
    size, sp = m["size"], m["spacing_m"]
    c, q = size // 2, size // 4
    ground = raw_bilinear(dem, *SITES[site])
    assert m["ground_m"] == pytest.approx(ground, abs=0.01)
    for label, (i, j) in {"north": (q, c), "east": (c, size - 1 - q), "south-west": (size - 1 - q, q)}.items():
        lat, lon = grid_point(site, size, sp, i, j)
        want = (raw_bilinear(dem, lat, lon) if level == "fine" else raw_box_mean(dem, lat, lon, sp)) - ground
        print(f"{site} {level} {label}: file {h[i, j]:.0f} m, raw {want:.1f} m")
        assert abs(h[i, j] - want) <= POINT_TOL_M[level]


@needs_dem
@needs_fill
@pytest.mark.parametrize("site", SEAM_SITES)
def test_far_level_seam_between_polar_dem_and_ldem16(site, dem):
    """Far samples next to the polar DEM's square edge: polar box means (raw) vs ldem_16 (decoded here as
    0.5 m/DN - 10000 m, longitude 0 at the image centre). Bias must be small against the relief; and the far
    file's filled samples just outside the edge must equal ldem_16 there (fill encoding and orientation)."""
    import rasterio
    from scipy.ndimage import map_coordinates
    with rasterio.open(LDEM16) as src:
        l16 = src.read(1).astype(float) * 0.5 - 10000.0
    ppd = l16.shape[1] / 360

    def l16_at(lat, lon):
        return float(map_coordinates(l16, [[(90 - lat) * ppd - 0.5], [((lon + 180) % 360) * ppd - 0.5]],
                                     order=1, mode="grid-wrap", prefilter=False)[0])

    m, h = load(site, "far")
    ground = m["ground_m"]
    ds, tr = dem
    edge_m = abs(ds.bounds.right)
    size, sp = m["size"], m["spacing_m"]
    inside, outside = [], []
    for i in range(0, size, 2):
        for j in range(0, size, 2):
            lat, lon = grid_point(site, size, sp, i, j)
            x, y = tr.transform(lon, lat)
            d_edge = edge_m - max(abs(x), abs(y))
            if 2 * sp < d_edge < tt.SEAM_BAND_M:
                inside.append((raw_box_mean(dem, lat, lon, sp) - l16_at(lat, lon), i, j))
            elif -tt.SEAM_BAND_M < d_edge < -2 * sp:
                outside.append((i, j, lat, lon))
    d = np.array([v[0] for v in inside])
    print(f"{site}: polar - ldem_16 at {d.size} far samples inside the seam: mean {d.mean():+.1f} m, "
          f"median {np.median(d):+.1f} m, std {d.std():.1f} m, p5 {np.percentile(d, 5):+.1f}, "
          f"p95 {np.percentile(d, 95):+.1f}, max |d| {np.abs(d).max():.0f} m")
    assert d.size > 50 and len(outside) > 50, (d.size, len(outside))
    assert abs(np.median(d)) < 10 and abs(d.mean()) < 10 and d.std() < 60
    # Filled samples (cell means of ldem_16) vs a single ldem_16 bilinear sample at the cell centre.
    e = np.array([h[i, j] + ground - l16_at(lat, lon) for i, j, lat, lon in outside])
    print(f"{site}: far file vs ldem_16 at {e.size} filled samples: median {np.median(e):+.1f} m, "
          f"RMS {rms(e):.1f} m")
    assert abs(np.median(e)) < 10 and rms(e) < 80
