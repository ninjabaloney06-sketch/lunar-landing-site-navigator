"""South-cap rasters (scripts/south_cap.py): file inventory, georeferencing, orientation, box means.

Expectations are computed here, independently of south_cap's own code: projected positions from pyproj with a
CRS string written in this file, lat/lon of the existing site grids from the spherical destination formula (as in
test_terrain_tiles.py), raw DEM values from our own windowed reads. Orientation is checked against files another
script wrote (terrain/<id>.json ground heights and the 80 m / mid / far grids of terrain_tiles.py): a mirrored or
rotated cap raster must be at least 5x worse, so the tolerances do detect an orientation error.
"""
import json
import math
import os
from pathlib import Path

import numpy as np
import pytest
from pyproj import CRS, Transformer

import south_cap as sc
import terrain_tiles as tt

REPO = Path(__file__).resolve().parents[2]
CAP = REPO / "app" / "public" / "data" / "terrain" / "cap"
TERRAIN = CAP.parent
R_M = 1737400.0
TEST_CRS = CRS.from_proj4("+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs")
TO_XY = Transformer.from_crs(TEST_CRS.geodetic_crs, TEST_CRS, always_xy=True)
SITES = {s[0]: (s[1], s[2]) for s in tt.load_sites()}
# One site per quadrant of the projection: +x (90 E side), -x, +y (longitude 0 side), -x/-y.
ORIENT_SITES = ["amundsen-rim", "de-gerlache-rim-2", "malapert-massif", "connecting-ridge"]
MIRRORS = {"mirrored x": lambda x, y: (-x, y), "mirrored y": lambda x, y: (x, -y), "x/y swapped": lambda x, y: (y, x)}

needs_cap = pytest.mark.skipif(not (CAP / "cap.json").exists(), reason="cap rasters not generated")


@pytest.fixture(scope="module")
def meta():
    return json.loads((CAP / "cap.json").read_text())


class Raster:
    """Bilinear reader of one cap raster (single file or tile level), written for this test."""

    def __init__(self, info, nodata, tiled):
        self.i, self.nodata, self.tiled, self.cache = info, nodata, tiled, {}
        if not tiled:
            raw = np.fromfile(CAP / info["file"], dtype="<i2").reshape(info["height"], info["width"])
            self.data = np.where(raw == nodata, np.nan, raw * info["height_scale_m"])

    def _tile(self, tr, tc):
        if (tr, tc) not in self.cache:
            p = CAP / self.i["name"] / str(tr) / f"{tc}.bin"
            n = self.i["tile_size"]
            if p.exists():
                raw = np.fromfile(p, dtype="<i2").reshape(n, n)
                self.cache[(tr, tc)] = np.where(raw == self.nodata, np.nan, raw * self.i["height_scale_m"])
            else:
                self.cache[(tr, tc)] = np.full((n, n), np.nan)
        return self.cache[(tr, tc)]

    def at(self, r, c):
        """Sample values at integer index arrays; NaN outside."""
        r, c = np.asarray(r), np.asarray(c)
        out = np.full(r.shape, np.nan)
        ok = (r >= 0) & (c >= 0) & (r < self.i["height"]) & (c < self.i["width"])
        if not self.tiled:
            out[ok] = self.data[r[ok], c[ok]]
            return out
        n = self.i["tile_size"]
        for tr, tc in set(zip((r[ok] // n).tolist(), (c[ok] // n).tolist())):
            sel = ok & (r // n == tr) & (c // n == tc)
            out[sel] = self._tile(tr, tc)[r[sel] % n, c[sel] % n]
        return out

    def bilinear(self, x, y):
        s = self.i["spacing_m"]
        fc = (np.asarray(x, dtype=float) - self.i["x0_m"]) / s - 0.5
        fr = (self.i["y0_m"] - np.asarray(y, dtype=float)) / s - 0.5
        c0, r0 = np.floor(fc).astype(int), np.floor(fr).astype(int)
        dc, dr = fc - c0, fr - r0
        return ((self.at(r0, c0) * (1 - dc) + self.at(r0, c0 + 1) * dc) * (1 - dr)
                + (self.at(r0 + 1, c0) * (1 - dc) + self.at(r0 + 1, c0 + 1) * dc) * dr)


def raster(meta, name):
    if name in ("base", "outer"):
        return Raster(meta[name], meta["nodata"], tiled=False)
    return Raster(next(lv for lv in meta["levels"] if lv["name"] == name), meta["nodata"], tiled=True)


def destination(lat_deg, lon_deg, az, d_m):
    """Great-circle destination (bearing from north, clockwise), spherical trig; arrays for az and d_m."""
    p1, l1 = math.radians(lat_deg), math.radians(lon_deg)
    dl = d_m / R_M
    p2 = np.arcsin(math.sin(p1) * np.cos(dl) + math.cos(p1) * np.sin(dl) * np.cos(az))
    l2 = l1 + np.arctan2(np.sin(az) * np.sin(dl) * math.cos(p1), np.cos(dl) - math.sin(p1) * np.sin(p2))
    return np.degrees(p2), (np.degrees(l2) + 180) % 360 - 180


def site_grid_xy(site, size, spacing, step):
    """Projected x/y of every step-th sample of a terrain_tiles grid (row 0 = north, col 0 = west)."""
    half = (size - 1) / 2
    k = np.arange(0, size, step)
    x, y = np.meshgrid((k - half) * spacing, (half - k) * spacing)
    rho = np.hypot(x, y)
    lat, lon = destination(*SITES[site], np.arctan2(x, y), R_M * np.arctan(rho / R_M))
    px, py = TO_XY.transform(lon, lat)
    return k, np.asarray(px), np.asarray(py)


def site_level(site, level=None):
    name = site if level is None else f"{site}-{level}"
    m = json.loads((TERRAIN / f"{name}.json").read_text())
    raw = np.fromfile(TERRAIN / f"{name}.bin", dtype="<i2").reshape(m["size"], m["size"])
    return m, np.where(raw == m["nodata"], np.nan, raw * m.get("height_scale_m", 1.0)) + m["ground_m"]


def rms(d):
    d = d[np.isfinite(d)]
    return float(np.sqrt(np.mean(d * d)))


# ---------- pure functions (no data) ----------

@pytest.mark.parametrize("lat", [-80.0, -85.0, -89.5, -90.0])
def test_rho_of_lat_matches_pyproj(lat):
    x, y = TO_XY.transform(37.0, lat)
    assert sc.rho_of_lat(lat) == pytest.approx(math.hypot(x, y), abs=1e-6)


def test_dem_square_is_the_square_around_the_80s_circle():
    assert sc.rho_of_lat(-80.0) == pytest.approx(304_000, abs=10)  # the DEM's half-width


def test_block_mean_ignores_nan_and_marks_empty_blocks():
    a = np.arange(16, dtype=float).reshape(4, 4)
    a[0, 0] = np.nan
    a[2:, 2:] = np.nan
    m = sc.block_mean(a, 2)
    assert m[0, 0] == pytest.approx((1 + 4 + 5) / 3)
    assert m[0, 1] == pytest.approx((2 + 3 + 6 + 7) / 4)
    assert np.isnan(m[1, 1])


def test_ranges_and_int16():
    assert sc.ranges([3, 4, 5, 9, 11, 12]) == [[3, 5], [9, 9], [11, 12]]
    q = sc.to_int16(np.array([[1.1, np.nan, -2.6]]), 0.25, "t")
    assert q.tolist() == [[4, sc.NODATA, -10]]
    with pytest.raises(SystemExit):
        sc.to_int16(np.array([[9000.0]]), 0.25, "t")


@pytest.mark.parametrize("name", list(sc.LEVELS))
def test_plan_keeps_exactly_the_tiles_with_a_part_south_of_the_limit(name):
    f, limit = sc.LEVELS[name]
    plan = sc.plan_level(name, 30400, -304000.0, 304000.0)
    spacing, rho = 20.0 * f, sc.rho_of_lat(limit)
    n = sc.tile_grid(30400 // f)
    k = (np.arange(64) + 0.5) / 64 * sc.TILE * spacing  # dense points inside a tile
    kept = 0
    for r in range(n):
        for c in range(n):
            x = -304000.0 + c * sc.TILE * spacing + k[None, :]
            y = 304000.0 - r * sc.TILE * spacing - k[:, None]
            inside = bool((np.hypot(x, y) <= rho).any())
            assert (c in plan.get(r, [])) or not inside, (r, c)  # every tile with data south of the limit is kept
            kept += c in plan.get(r, [])
    pole_tile = int(304000.0 // (sc.TILE * spacing))
    assert pole_tile in plan[pole_tile]
    assert kept == sum(len(v) for v in plan.values()) < n * n


# ---------- generated files (no raw data) ----------

@needs_cap
def test_meta_states_projection_reference_and_sources(meta):
    assert meta["projection"]["lon_0"] == 0 and meta["projection"]["lat_0"] == -90
    assert meta["projection"]["R_m"] == R_M and "+proj=stere" in meta["projection"]["proj4"]
    assert "1737.4 km" in meta["height_ref"] and meta["nodata"] == -32768
    assert "Not validated" in meta["validation"]
    for src, name in [(meta["source"], sc.DEM_NAME), (meta["outer"]["source"], sc.FILL_DEM_NAME)]:
        row = sc.register_row(name)
        assert src["file"] == name and src["sha256"] == row["sha256"] and len(src["sha256"]) == 64
        assert src["url"].startswith("https://pgda.gsfc.nasa.gov/")
    b = meta["base"]
    assert (b["spacing_m"], b["width"], b["height"], b["x0_m"], b["y0_m"]) == (400.0, 1520, 1520, -304000.0, 304000.0)
    assert (CAP / "base.bin").stat().st_size == 1520 * 1520 * 2 < 10e6
    o = meta["outer"]
    assert (CAP / "outer.bin").stat().st_size == o["width"] * o["height"] * 2
    assert -o["x0_m"] == o["y0_m"] >= 304_000 + 300_000  # a 300 km ray from the cap's edge stays on data


@needs_cap
def test_tile_index_equals_the_files_on_disk(meta):
    listed = set()
    for lv in meta["levels"]:
        for r, runs in lv["tiles"].items():
            for a, b in runs:
                listed |= {f"{lv['name']}/{r}/{c}.bin" for c in range(a, b + 1)}
        assert lv["tile_count"] == sum(b - a + 1 for runs in lv["tiles"].values() for a, b in runs)
        assert lv["bytes"] == lv["tile_count"] * lv["tile_size"] ** 2 * 2
    on_disk = {p.relative_to(CAP).as_posix() for p in CAP.rglob("*.bin")} - {"base.bin", "outer.bin"}
    assert on_disk == listed
    sizes = [p.stat().st_size for p in CAP.rglob("*") if p.is_file()]
    assert all((CAP / t).stat().st_size == 256 * 256 * 2 for t in listed)
    assert max(sizes) < 20e6  # host limit per file (25 MiB), orchestrator's limit 20 MB
    assert sum(sizes) < 200e6  # ceiling for the folder (ninja's approval of 14 Nov, orchestrator's limit)
    assert meta["measured"]["total_bytes"] == sum(s for s in sizes) - (CAP / "cap.json").stat().st_size


@needs_cap
@pytest.mark.parametrize("name", list(sc.LEVELS))
def test_complete_levels_hold_every_planned_tile(meta, name):
    lv = next(v for v in meta["levels"] if v["name"] == name)
    if not lv["complete"]:
        pytest.skip("sample run: only tiles around the sample sites exist")
    plan = sc.plan_level(name, 30400, -304000.0, 304000.0)
    assert lv["tiles"] == {str(r): sc.ranges(c) for r, c in plan.items()}
    assert lv["north_lat"] == sc.LEVELS[name][1]


@needs_cap
@pytest.mark.parametrize("site", ORIENT_SITES)
def test_ground_height_at_known_sites(meta, site):
    """Finest cap level at the site vs the ground height terrain_tiles.py wrote (bilinear 20 m DEM)."""
    ground = json.loads((TERRAIN / f"{site}.json").read_text())["ground_m"]
    x, y = TO_XY.transform(SITES[site][1], SITES[site][0])
    # Tolerances: a 40 m / 80 m / 400 m box mean against a point value of the 20 m DEM on sloping ground.
    for name, tol in [("40", 6.0), ("80", 12.0), ("base", 150.0)]:
        h = float(raster(meta, name).bilinear(x, y))
        if math.isnan(h):
            assert name == "40" and SITES[site][0] > -85.1 or not next(
                v for v in meta["levels"] if v["name"] == name)["complete"]
            continue
        print(f"{site} {name}: cap {h:.1f} m, ground_m {ground:.1f} m")
        assert abs(h - ground) < tol


@needs_cap
@pytest.mark.parametrize("site", ORIENT_SITES)
@pytest.mark.parametrize("name,level,step,tol", [("40", None, 5, 3.0), ("80", None, 5, 3.0),
                                                  ("base", "mid", 3, 25.0), ("outer", "far", 3, 120.0)])
def test_orientation_against_the_site_grids(meta, site, name, level, step, tol):
    """Cap raster resampled at the samples of an existing site grid (80 m tile, mid 400 m, far 2 km) vs that
    grid: small RMS as built, at least 5x larger when the cap raster is mirrored or its axes are swapped."""
    m, want = site_level(site, level)
    k, px, py = site_grid_xy(site, m["size"], m["spacing_m"], step)
    want = want[np.ix_(k, k)]
    if level == "far":
        want = np.where(np.hypot(px, py) < 300_000, want, np.nan)  # the site far level is ldem_16 fill out there
    ra = raster(meta, name)
    got = ra.bilinear(px, py)
    if not np.isfinite(got - want).sum() > 500:
        pytest.skip(f"{name}: no tiles around {site}")
    err = rms(got - want)
    print(f"{site} {name} vs {level or '80 m tile'}: RMS {err:.2f} m over {np.isfinite(got - want).sum()} samples")
    assert err < tol
    for label, f in MIRRORS.items():
        bad = rms(ra.bilinear(*f(px, py)) - want)
        print(f"  {label}: {bad:.1f} m")
        assert bad > 5 * max(err, 1.0), f"{site} {name}: {label} not detected"


# ---------- raw data: stored samples equal the DEM's box means ----------

def _data_root():
    root = os.environ.get("CLPS_DATA")
    return Path(root).expanduser() if root else None


DEM = (_data_root() / "lola" / sc.DEM_NAME) if _data_root() else None
DEM60 = (_data_root() / "lola" / sc.FILL_DEM_NAME) if _data_root() else None
needs_dem = pytest.mark.skipif(not (DEM and DEM.exists() and DEM60.exists()), reason="CLPS_DATA / LOLA DEMs not available")
BOX_POINTS = [SITES[s] for s in ORIENT_SITES] + [SITES["im-1"], (-89.999, 10.0), (-86.3, 151.0), (-82.5, -99.0)]


@needs_cap
@needs_dem
@pytest.mark.parametrize("name", ["40", "80", "base", "outer"])
def test_samples_equal_the_raw_box_mean(meta, name):
    import rasterio
    from rasterio.windows import Window
    ra = raster(meta, name)
    info = ra.i
    checked = 0
    with rasterio.open(DEM60 if name == "outer" else DEM) as ds:
        f = int(round(info["spacing_m"] / abs(ds.transform.a)))
        for lat, lon in BOX_POINTS:
            x, y = TO_XY.transform(lon, lat)
            c, r = int((x - info["x0_m"]) // info["spacing_m"]), int((info["y0_m"] - y) // info["spacing_m"])
            got = float(ra.at(np.array([r]), np.array([c]))[0])
            if math.isnan(got):
                continue  # no tile here (40 m north of its limit, or a sample run)
            # DEM pixel of the sample's top-left corner, from the DEM's own geotransform
            x_left, y_top = info["x0_m"] + c * info["spacing_m"], info["y0_m"] - r * info["spacing_m"]
            col0, row0 = (round(v) for v in ~ds.transform * (x_left, y_top))
            want = float(np.nanmean(ds.read(1, window=Window(col0, row0, f, f)).astype(np.float64)))
            print(f"{name} at ({lat}, {lon}): file {got:.2f} m, raw {f} x {f} mean {want:.3f} m")
            assert abs(got - want) <= info["height_scale_m"] / 2 + 1e-3
            checked += 1
    assert checked >= (4 if name == "40" else 6)


# ---------- cap colour texture (south_cap.py --texture) ----------

COLOR = REPO / "app" / "public" / "textures" / sc.COLOR_OUT
COLOR_SRC = (_data_root() / "textures" / sc.COLOR_NAME) if _data_root() else None


@needs_cap
@pytest.mark.skipif(not COLOR.exists(), reason="cap texture not generated")
def test_texture_orientation_against_the_relief(meta):
    """The colour map has no georeferencing, so its layout is checked against the DEM: local brightness (minus
    its 8 km mean) correlates with local height (crater floors are darker in the mosaic) only when the texture
    lies in the base raster's layout; mirrored or swapped, the correlation vanishes."""
    from PIL import Image
    from scipy.ndimage import uniform_filter
    im = Image.open(COLOR)
    assert im.size == (sc.COLOR_SIZE, sc.COLOR_SIZE) and COLOR.stat().st_size < 3e6
    n = meta["base"]["width"]
    tex = np.asarray(im.convert("L").resize((n, n), Image.Resampling.BILINEAR)).astype(float)
    base = raster(meta, "base").data
    hp = base - uniform_filter(base, 20)
    yy, xx = np.mgrid[0:n, 0:n]
    inside = np.hypot(xx - (n - 1) / 2, yy - (n - 1) / 2) * meta["base"]["spacing_m"] < 300_000

    def r(t):
        return float(np.corrcoef((t - uniform_filter(t, 20))[inside], hp[inside])[0, 1])

    built = r(tex)
    others = {"mirrored x": r(tex[:, ::-1]), "mirrored y": r(tex[::-1]), "swapped": r(tex.T), "rotated 180": r(tex[::-1, ::-1])}
    print(f"texture vs relief: as built r = {built:.3f}; " + ", ".join(f"{k} {v:+.3f}" for k, v in others.items()))
    assert built > 0.08
    assert all(abs(v) < 0.02 for v in others.values())


@pytest.mark.skipif(not (COLOR_SRC and COLOR_SRC.exists()), reason="CLPS_DATA / colour map not available")
def test_cap_color_samples_the_source_where_the_projection_says():
    """Four points on the 85 S circle and the pole, read straight from the equirectangular source."""
    import rasterio
    size = 512
    out = sc.cap_color(size=size).astype(float)
    with rasterio.open(COLOR_SRC) as ds:
        src = ds.read([1, 2, 3]).astype(float)
        ppd = ds.width / 360.0
    for lon in (0.0, 90.0, 180.0, -90.0, 37.0):
        x, y = TO_XY.transform(lon, -85.0)
        col, row = (x + sc.CAP_HALF_M) / (2 * sc.CAP_HALF_M) * size - 0.5, (sc.CAP_HALF_M - y) / (2 * sc.CAP_HALF_M) * size - 0.5
        got = out[int(round(row)), int(round(col))]
        sr, scol = int((90 + 85.0) * ppd), int(((lon + 180) % 360) * ppd) % src.shape[2]
        want = src[:, sr - 3:sr + 4, :].take(range(scol - 6, scol + 7), axis=2, mode="wrap").mean(axis=(1, 2))
        print(f"85 S, lon {lon}: texture {got}, source neighbourhood mean {np.round(want, 1)}")
        assert np.abs(got - want).max() < 12  # same place in the map (8-bit colour, soft source)
    pole = out[size // 2 - 1:size // 2 + 1, size // 2 - 1:size // 2 + 1].mean(axis=(0, 1))
    assert np.abs(pole - src[:, -1, :].mean(axis=1)).max() < 12
