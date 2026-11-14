"""Terrain horizon mask per site (build-plan §3 horizons contract, §4.2 method).

    python3 scripts/horizon.py --site ID LAT LON   # one site
    python3 scripts/horizon.py --all               # every row of scripts/sites.csv inside the DEM

Writes app/public/data/horizons/<id>.json. Method, as specified in §4.2:
- site lat/lon → DEM x/y with the CRS read from the GeoTIFF (pyproj);
- 720 azimuths (0.5°, 0 = north, clockwise); samples every 20 m to 4 km, then each
  step 0.5 % longer than the last, to 300 km; sample points are great-circle destinations;
- near field (≤ 20 km) from a full-resolution 20 m window (~40 × 40 km), far field from
  the file's 160 m overview over the ~600 × 600 km box the rays need (clipped to the DEM);
- elevation angle = asin(((P − O)·up) / |P − O|) with O, P on the 1737.4 km sphere plus
  heights; this includes lunar curvature, so no extra curvature correction is applied;
- a sample outside the 20 m DEM (it is a 608 km square around the pole) or on nodata is read from
  LDEM_60S_120MPP_ADJ.TIF, the same product at 120 m/px down to 60°S (added 14 Nov 2026);
- a ray stops at the first sample that neither DEM covers; its azimuth goes into `truncated`
  and its mask value is the maximum over the samples before that point.
Extra field `slope_deg` (DEM slope over a 100 m baseline at the site) is read by sites.py.
"""
import argparse
import csv
import json
import math
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from affine import Affine
from pyproj import CRS, Transformer
from rasterio.enums import Resampling
from rasterio.windows import Window
from scipy.ndimage import map_coordinates

from config import APP_DATA, REPO, data_root

R_KM = 1737.4
OBSERVER_HEIGHT_M = 1.75   # spec.md, 14 Nov (the build plan's 2 m is superseded)
AZ_STEP = 0.5
N_AZ = 720
RAY_MAX_KM = 300.0         # changed from 150 km on 13 Nov
NEAR_KM = 20.0             # near field radius; beyond it the 160 m far field is used
FAR_RES_M = 160.0
SLOPE_HALF_BASE_KM = 0.05  # ±50 m → 100 m baseline
DEM_NAME = "LDEM_80S_20MPP_ADJ.TIF"
DEM_LABEL = (
    "LDEM_80S_20MPP_ADJ (PGDA product 90, Barker et al. 2023, PSJ 4, 183, doi:10.3847/PSJ/acf3e1; "
    "data doi:10.60903/gsfcpgda-lola-spole); MOON_ME (DE421) south polar stereographic, heights "
    "relative to 1737.4 km; near field <= 20 km at 20 m/px, far field at 160 m/px (file overview)"
)
FILL_DEM_NAME = "LDEM_60S_120MPP_ADJ.TIF"
FILL_LABEL = ("; samples outside that DEM from LDEM_60S_120MPP_ADJ (same product and frame, 60-90 S, "
              "120 m/px, bilinear)")
HORIZON_DIR = APP_DATA / "horizons"
SITES_CSV = REPO / "scripts" / "sites.csv"
ABORT_SECONDS = 60.0
ABORT_RSS_BYTES = 4 * 1024**3


@dataclass
class Grid:
    """A north-up raster in the DEM's projected CRS; transform maps pixel corners (rasterio convention)."""
    data: np.ndarray
    transform: Affine

    def sample(self, x, y):
        """Bilinear height at projected x/y in metres; NaN outside the grid or next to nodata."""
        t = self.transform
        col = (np.asarray(x) - t.c) / t.a - 0.5
        row = (np.asarray(y) - t.f) / t.e - 0.5
        return map_coordinates(self.data, [row, col], order=1, mode="constant", cval=np.nan,
                               prefilter=False, output=np.float64)


@dataclass
class FilledGrid:
    """`grid` where it has a height, `fill` elsewhere; both in the same projected CRS."""
    grid: Grid
    fill: Grid

    def sample(self, x, y):
        x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
        h = self.grid.sample(x, y)
        bad = ~np.isfinite(h)
        if bad.any():
            h[bad] = self.fill.sample(x[bad], y[bad])
        return h


def ray_distances_km(ray_max_km=RAY_MAX_KM):
    """20 m steps to 4 km, then each step 0.5 % longer than the last; final sample at ray_max_km."""
    d = list(np.arange(1, 201) * 0.02)
    step = 0.02
    while True:
        step *= 1.005
        nxt = d[-1] + step
        if nxt >= ray_max_km:
            break
        d.append(nxt)
    d.append(float(ray_max_km))
    return np.array(d)


def unit(lat_deg, lon_deg):
    la, lo = np.radians(lat_deg), np.radians(lon_deg)
    return np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])


def enu(lat_deg, lon_deg):
    """up = unit(lat, lon), east = unit(z × up), north = up × east (same frame as the browser)."""
    if abs(lat_deg) > 89.9999:
        raise ValueError("site too close to the pole for a defined north direction")
    up = unit(lat_deg, lon_deg)
    east = np.cross([0.0, 0.0, 1.0], up)
    east /= np.linalg.norm(east)
    north = np.cross(up, east)
    return east, north, up


def ray_points(lat_deg, lon_deg, az_deg, d_km):
    """Unit vectors of great-circle destinations, shape (len(az), len(d), 3)."""
    east, north, up = enu(lat_deg, lon_deg)
    a = np.radians(np.asarray(az_deg, dtype=float))[:, None, None]
    th = (np.asarray(d_km, dtype=float) / R_KM)[None, :, None]
    direction = np.cos(a) * north + np.sin(a) * east
    return np.cos(th) * up + np.sin(th) * direction


def to_latlon(p):
    return np.degrees(np.arcsin(np.clip(p[..., 2], -1, 1))), np.degrees(np.arctan2(p[..., 1], p[..., 0]))


def compute_horizon(site_id, lat, lon, near: Grid, far: Grid, crs, ray_max_km=RAY_MAX_KM,
                    observer_height_m=OBSERVER_HEIGHT_M, dem_label=DEM_LABEL):
    """Horizon dict (build-plan §3 + slope_deg) from a near and a far grid in projected CRS `crs`."""
    to_xy = Transformer.from_crs(CRS(crs).geodetic_crs, CRS(crs), always_xy=True)
    east, north, up = enu(lat, lon)

    sx, sy = to_xy.transform(lon, lat)
    ground_m = float(near.sample([sx], [sy])[0])
    if not math.isfinite(ground_m):
        raise ValueError(f"{site_id}: no DEM height at the site ({lat}, {lon})")

    # slope over a 100 m baseline: heights 50 m east/west/north/south of the site
    sp = ray_points(lat, lon, [90.0, 270.0, 0.0, 180.0], [SLOPE_HALF_BASE_KM])[:, 0, :]
    sla, slo = to_latlon(sp)
    hx, hy = to_xy.transform(slo, sla)
    he, hw, hn, hs = near.sample(hx, hy)
    base_m = 2 * SLOPE_HALF_BASE_KM * 1000
    slope = math.degrees(math.atan(math.hypot((he - hw) / base_m, (hn - hs) / base_m)))

    az = np.arange(N_AZ) * AZ_STEP
    d = ray_distances_km(ray_max_km)
    p = ray_points(lat, lon, az, d)
    pla, plo = to_latlon(p)
    px, py = to_xy.transform(plo, pla)
    px, py = np.asarray(px), np.asarray(py)

    h = np.full(px.shape, np.nan)
    is_near = np.broadcast_to(d[None, :] <= NEAR_KM, px.shape)
    h[is_near] = near.sample(px[is_near], py[is_near])
    h[~is_near] = far.sample(px[~is_near], py[~is_near])

    O = (R_KM + (ground_m + observer_height_m) / 1000.0) * up
    P = (R_KM + h[..., None] / 1000.0) * p
    v = P - O
    ang = np.degrees(np.arcsin(np.clip((v @ up) / np.linalg.norm(v, axis=-1), -1, 1)))

    valid = np.isfinite(h)
    stop = np.where(valid.all(axis=1), len(d), np.argmin(valid, axis=1))  # first invalid sample
    if np.any(stop == 0):
        bad = az[stop == 0].tolist()
        raise ValueError(f"{site_id}: rays with no valid sample at azimuths {bad[:10]}")
    ang = np.where(np.arange(len(d))[None, :] < stop[:, None], ang, -np.inf)
    k = np.argmax(ang, axis=1)
    mask = ang[np.arange(N_AZ), k]
    mask_dist = d[k]
    truncated = az[stop < len(d)]

    return {
        "site_id": site_id,
        "lat": lat,
        "lon": lon,
        "elev_m": round(ground_m, 1),
        "observer_height_m": observer_height_m,
        "az_step": AZ_STEP,
        "mask": [round(float(m), 4) for m in mask],
        "mask_dist_km": [round(float(x), 3) for x in mask_dist],
        "ray_max_km": int(ray_max_km) if float(ray_max_km).is_integer() else float(ray_max_km),
        "truncated": [float(a) for a in truncated],
        "dem": dem_label,
        "slope_deg": round(slope, 1),
    }


def _window(ds, x_min, x_max, y_min, y_max, pad_px, align=1):
    """Pixel window covering the projected bbox (+pad), clipped to the file, aligned to `align` pixels."""
    t = ds.transform
    c0 = math.floor((x_min - t.c) / t.a) - pad_px
    c1 = math.ceil((x_max - t.c) / t.a) + pad_px
    r0 = math.floor((y_max - t.f) / t.e) - pad_px
    r1 = math.ceil((y_min - t.f) / t.e) + pad_px
    c0, r0 = (max(c0, 0) // align) * align, (max(r0, 0) // align) * align
    c1 = min(-(-c1 // align) * align, ds.width)
    r1 = min(-(-r1 // align) * align, ds.height)
    return Window(c0, r0, c1 - c0, r1 - r0)


def _read(ds, win, factor):
    out_shape = (int(win.height // factor), int(win.width // factor))
    resampling = Resampling.average if factor > 1 else Resampling.nearest
    data = ds.read(1, window=win, out_shape=out_shape, resampling=resampling).astype(np.float32)
    if ds.nodata is not None and not np.isnan(ds.nodata):
        data[data == ds.nodata] = np.nan
    t = ds.window_transform(win) @ Affine.scale(win.width / out_shape[1], win.height / out_shape[0])
    return Grid(data, t)


def load_grids(ds, lat, lon, ray_max_km=RAY_MAX_KM):
    """Near (full-res) and far (160 m) grids covering exactly the samples this site's rays need."""
    crs = CRS.from_wkt(ds.crs.to_wkt())
    to_xy = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
    az = np.arange(0, 360, 1.0)
    res = abs(ds.transform.a)

    def bbox(dists):
        la, lo = to_latlon(ray_points(lat, lon, az, dists))
        x, y = to_xy.transform(lo, la)
        return np.min(x), np.max(x), np.min(y), np.max(y)

    sx, sy = to_xy.transform(lon, lat)
    nb = bbox([NEAR_KM])
    nb = (min(nb[0], sx), max(nb[1], sx), min(nb[2], sy), max(nb[3], sy))
    far_ring = np.linspace(NEAR_KM, ray_max_km, 40)
    fb = bbox(far_ring)
    factor = int(round(FAR_RES_M / res))
    near = _read(ds, _window(ds, *nb, pad_px=4), 1)
    far = _read(ds, _window(ds, *fb, pad_px=4 * factor, align=factor), factor)
    return near, far, crs


def horizon_for_site(site_id, lat, lon, dem_path=None, ray_max_km=RAY_MAX_KM, fill_path=None):
    """Without fill_path the rays stop at the edge of the DEM; with it they continue on that wider DEM."""
    dem_path = Path(dem_path) if dem_path else data_root() / "lola" / DEM_NAME
    label = DEM_LABEL
    with rasterio.Env(GDAL_CACHEMAX=256):
        with rasterio.open(dem_path) as ds:
            near, far, crs = load_grids(ds, lat, lon, ray_max_km)
        if fill_path:
            with rasterio.open(fill_path) as fs:
                if CRS.from_wkt(fs.crs.to_wkt()) != crs:
                    raise ValueError(f"{fill_path}: projection differs from the main DEM's")
                _, fill, _ = load_grids(fs, lat, lon, ray_max_km)
            near, far = FilledGrid(near, fill), FilledGrid(far, fill)
            label += FILL_LABEL
    return compute_horizon(site_id, float(lat), float(lon), near, far, crs, ray_max_km=ray_max_km,
                           dem_label=label)


def inside_dem(lat, lon, dem_path):
    with rasterio.open(dem_path) as ds:
        crs = CRS.from_wkt(ds.crs.to_wkt())
        x, y = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True).transform(lon, lat)
        b = ds.bounds
        return b.left < x < b.right and b.bottom < y < b.top


def peak_rss_bytes():
    # `resource` exists only on Unix; on Windows the memory guard is skipped (0 = unknown).
    try:
        import resource
    except ImportError:
        return 0
    rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return rss if sys.platform == "darwin" else rss * 1024


def run_one(site_id, lat, lon, dem_path, out_dir, fill_path=None):
    t0 = time.perf_counter()
    res = horizon_for_site(site_id, lat, lon, dem_path, fill_path=fill_path)
    secs = time.perf_counter() - t0
    rss = peak_rss_bytes()
    m = res["mask"]
    print(f"{site_id}: {secs:.1f} s, peak RSS {rss / 1e6:.0f} MB, elev {res['elev_m']} m, "
          f"slope {res['slope_deg']} deg, mask {min(m):.3f}..{max(m):.3f} deg, "
          f"truncated {len(res['truncated'])}/720")
    if secs > ABORT_SECONDS or rss > ABORT_RSS_BYTES:
        print(f"ABORT: {site_id} took {secs:.1f} s / peak RSS {rss / 1e9:.2f} GB "
              f"(limits {ABORT_SECONDS:.0f} s, 4 GB); not written, stopping.", file=sys.stderr)
        sys.exit(2)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / f"{site_id}.json").write_text(json.dumps(res, separators=(",", ":")) + "\n", encoding="utf-8")
    return secs, rss


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--site", nargs=3, metavar=("ID", "LAT", "LON"))
    g.add_argument("--all", action="store_true", help="every row of scripts/sites.csv inside the DEM")
    ap.add_argument("--out-dir", type=Path, default=HORIZON_DIR)
    args = ap.parse_args(argv)
    dem_path = data_root() / "lola" / DEM_NAME
    fill_path = data_root() / "lola" / FILL_DEM_NAME
    if not fill_path.exists():
        raise SystemExit(f"{fill_path} is missing: see its row in docs/reference/data-sources.md")

    if args.site:
        sid, lat, lon = args.site[0], float(args.site[1]), float(args.site[2])
        run_one(sid, lat, lon, dem_path, args.out_dir, fill_path)
        return
    with SITES_CSV.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        lat, lon = float(r["lat"]), float(r["lon"])
        if not inside_dem(lat, lon, dem_path):
            print(f"{r['id']}: outside the DEM, skipped (flat horizon in sites.json)")
            continue
        run_one(r["id"], lat, lon, dem_path, args.out_dir, fill_path)


if __name__ == "__main__":
    main()
