"""South-cap terrain rasters for the browser (app/src/data/southcap.ts) -> app/public/data/terrain/cap/.

    python3 scripts/south_cap.py --plan                 # tile counts and sizes only, writes nothing
    python3 scripts/south_cap.py --sample im-1 connecting-ridge   # base + outer + the tiles around these sites
    python3 scripts/south_cap.py --full                 # base + outer + every tile of every level
    python3 scripts/south_cap.py --texture              # app/public/textures/cap_color_2k.webp only

Everything is in the DEM's own projection, read from the GeoTIFF (south polar stereographic on the 1737.4 km
sphere, lon_0 = 0: +x toward 90 E, +y toward longitude 0), never from a label. Heights are plain DEM heights
(metres above the 1737.4 km sphere), stored as little-endian Int16 in units of height_scale_m, nodata -32768,
row-major, row 0 = +y edge, col 0 = -x edge. A sample is the mean of the DEM pixels it covers (nan-aware block
mean); sample (r, c) of a raster with corner (x0_m, y0_m) and spacing s is centred on
x = x0_m + (c + 0.5) s, y = y0_m - (r + 0.5) s.

  cap.json      meta: projection, origin, spacing, height reference, nodata, source files with the SHA-256 of
                the raw-data register (docs/reference/data-sources.md), tile index, measured sizes
  base.bin      1520 x 1520 at 400 m: 20 x 20 block means of LDEM_80S_20MPP_ADJ.TIF (its whole 608 km square;
                the 80 S circle has a projected radius of 304,005.6 m, so it leaves the square by 5.6 m at the
                four axis longitudes: there the outer raster is used)
  outer.bin     768 x 768 at 1920 m: 16 x 16 block means of LDEM_60S_120MPP_ADJ.TIF, +-737.3 km around the pole:
                a 300 km horizon ray from any point of the cap, and the corners of its +-300 km far level
                (projected up to 729 km from the pole for a site on the 80 S edge), stay on data
  <level>/<row>/<col>.bin   tile pyramid, 256 x 256 samples per tile, level = spacing in metres:
                80 (4 x 4 block means) south of 80 S, 40 (2 x 2 block means) south of 85.1 S (85 S would put the
                folder over its 200 MB ceiling). Tile (row, col) holds
                samples [row*256, row*256+256) x [col*256, col*256+256) of the level's full grid; a tile with no
                part south of the level's latitude limit is not written; samples past the DEM edge are nodata.

--texture: the globe's colour map (NASA SVS CGI Moon Kit, lroc_color_poles_8k.tif: 8192 x 4096 equirectangular,
no georeferencing in the file; longitude 0 at the image centre, row 0 = 90 N, as its 4k sibling the globe uses)
resampled bilinearly into the base raster's square (+-304 km, row 0 = +y edge, col 0 = -x edge), 2048 x 2048.
The source has about 1.3 km per pixel in latitude there, so the result is soft; it only removes the pole pinch.

One pass over the 20 m DEM in strips of 1024 rows (one 80 m tile row), never the whole array in memory.
Nothing here is validated by the science lead.
"""
import argparse
import json
import math
import shutil
import sys
import time

import numpy as np
import rasterio
from pyproj import CRS, Transformer
from rasterio.windows import Window

from config import APP_DATA, REPO, data_root
from horizon import DEM_NAME, FILL_DEM_NAME, peak_rss_bytes
from terrain_tiles import HEIGHT_SCALES, load_sites

R_M = 1737400.0
NODATA = -32768
TILE = 256
BASE_FACTOR = 20          # 400 m
OUTER_FACTOR = 16         # 1920 m on the 120 m DEM
OUTER_HALF_BLOCKS = 384   # +-737.3 km: a far-level corner of a site at 80 S projects to 729 km from the pole
TILE_SCALE_M = 0.25       # Int16 unit of the tiles; holds +-8191 m (checked while writing)
# Tiled levels, finest first: name = spacing in metres -> (block factor on the 20 m DEM, northern latitude limit)
LEVELS = {"40": (2, -85.1), "80": (4, -80.0)}
SAMPLE_RADIUS_M = 21_000.0  # --sample: tiles within this distance of a site (the 80 m tile's +-20 km)
OUT = APP_DATA / "terrain" / "cap"
TEXTURES = REPO / "app" / "public" / "textures"
COLOR_NAME = "lroc_color_poles_8k.tif"
COLOR_OUT = "cap_color_2k.webp"
COLOR_SIZE = 2048
CAP_HALF_M = 304_000.0  # half-width of the 20 m DEM's square (checked against the file in main)
REGISTER = REPO / "docs" / "reference" / "data-sources.md"
ORDER = "row-major; row 0 = +y edge (toward longitude 0); col 0 = -x edge (toward 90 W); little-endian Int16"
SAMPLE_POSITION = ("sample (r, c) is the mean of the DEM pixels it covers, centred on "
                   "x = x0_m + (c + 0.5) * spacing_m, y = y0_m - (r + 0.5) * spacing_m")
CITATION = ("Barker et al. 2023, PSJ 4, 183, doi:10.3847/PSJ/acf3e1; data doi:10.60903/gsfcpgda-lola-spole "
            "(PGDA product 90)")


def register_row(name):
    """Source URL and SHA-256 of a raw file as recorded in the raw-data register."""
    for line in REGISTER.read_text(encoding="utf-8").splitlines():
        cells = [c.strip() for c in line.split("|")]
        if len(cells) > 6 and cells[1] == name:
            return {"file": name, "url": cells[2], "bytes": int(cells[4]), "sha256": cells[5],
                    "sha256_from": "docs/reference/data-sources.md (raw-data register)", "citation": CITATION}
    raise SystemExit(f"{name}: no row in {REGISTER}")


def rho_of_lat(lat_deg):
    """Projected distance from the pole (m) of a latitude: spherical south polar stereographic, true scale at
    the pole (lat_ts = -90): rho = 2 R tan((90 + lat) / 2)."""
    return 2.0 * R_M * math.tan(math.radians(90.0 + lat_deg) / 2.0)


def block_mean(a, f):
    """Nan-aware f x f block means of a 2-D array whose sides are multiples of f; NaN where a block is empty."""
    rows, cols = a.shape[0] // f, a.shape[1] // f
    blocks = a.reshape(rows, f, cols, f)
    ok = np.isfinite(blocks)
    cnt = ok.sum(axis=(1, 3))
    s = np.where(ok, blocks, 0).sum(axis=(1, 3), dtype=np.float64)
    return np.where(cnt > 0, s / np.maximum(cnt, 1), np.nan)


def to_int16(h, scale, what):
    valid = np.isfinite(h)
    q = np.where(valid, np.rint(h / scale), NODATA)
    if np.any(valid & ((q < -32767) | (q > 32767))):
        raise SystemExit(f"{what}: height out of Int16 range at {scale} m per unit")
    return q.astype("<i2")


def finest_scale(h):
    peak = float(np.nanmax(np.abs(h)))
    return next(s for s in HEIGHT_SCALES if peak / s <= 32767)


def tile_grid(n_samples):
    return -(-n_samples // TILE)


def tile_min_rho(row, col, spacing, x0, y0):
    """Smallest projected distance from the pole (m) of any point of tile (row, col)."""
    xa, xb = x0 + col * TILE * spacing, x0 + (col + 1) * TILE * spacing
    ya, yb = y0 - (row + 1) * TILE * spacing, y0 - row * TILE * spacing
    dx = 0.0 if xa <= 0.0 <= xb else min(abs(xa), abs(xb))
    dy = 0.0 if ya <= 0.0 <= yb else min(abs(ya), abs(yb))
    return math.hypot(dx, dy)


def tile_min_dist(row, col, spacing, x0, y0, px, py):
    xa, xb = x0 + col * TILE * spacing, x0 + (col + 1) * TILE * spacing
    ya, yb = y0 - (row + 1) * TILE * spacing, y0 - row * TILE * spacing
    return math.hypot(max(xa - px, 0.0, px - xb), max(ya - py, 0.0, py - yb))


def plan_level(name, dem_width, x0, y0, north_lat=None, near=None):
    """Tiles of a level as {row: [col, ...]}: those with a part south of the level's latitude limit and, with
    `near` (projected site positions), within SAMPLE_RADIUS_M of one of them."""
    factor, limit = LEVELS[name] if name in LEVELS else (int(name) // 20, -80.0)
    limit = limit if north_lat is None else north_lat
    spacing = 20.0 * factor
    n = tile_grid(dem_width // factor)
    rho = rho_of_lat(limit)
    out = {}
    for r in range(n):
        cols = [c for c in range(n) if tile_min_rho(r, c, spacing, x0, y0) <= rho and
                (near is None or any(tile_min_dist(r, c, spacing, x0, y0, px, py) <= SAMPLE_RADIUS_M
                                     for px, py in near))]
        if cols:
            out[r] = cols
    return out


def ranges(cols):
    """Sorted column list -> [[first, last], ...] of consecutive runs."""
    runs = []
    for c in cols:
        if runs and c == runs[-1][1] + 1:
            runs[-1][1] = c
        else:
            runs.append([c, c])
    return runs


def print_plan(dem_width, x0, y0):
    print("full pyramid sizes (256 x 256 Int16 tiles = 131072 bytes each):")
    for name, lim in [("40", -80.0), ("40", -85.0), ("80", -80.0), ("160", -80.0)]:
        n = sum(len(v) for v in plan_level(name, dem_width, x0, y0, north_lat=lim).values())
        print(f"  {name:>3} m south of {abs(lim):.0f} S: {n} tiles, {n * TILE * TILE * 2 / 1e6:.1f} MB")


def build_outer(path):
    """16 x 16 block means of the 120 m DEM in a block-aligned window around the pole."""
    with rasterio.open(path) as ds:
        res = abs(ds.transform.a)
        cx = int(round(-ds.transform.c / res))  # pixel column of x = 0
        cy = int(round(ds.transform.f / res))
        half = OUTER_HALF_BLOCKS * OUTER_FACTOR
        if cx - half < 0 or cx + half > ds.width or cy - half < 0 or cy + half > ds.height:
            raise SystemExit(f"{path}: window +-{half} px does not fit")
        n = 2 * OUTER_HALF_BLOCKS
        out = np.empty((n, n))
        step = OUTER_FACTOR * 40
        for r in range(0, 2 * half, step):
            rows = min(step, 2 * half - r)
            a = ds.read(1, window=Window(cx - half, cy - half + r, 2 * half, rows)).astype(np.float32)
            out[r // OUTER_FACTOR:(r + rows) // OUTER_FACTOR] = block_mean(a, OUTER_FACTOR)
        spacing = res * OUTER_FACTOR
        crs = CRS.from_wkt(ds.crs.to_wkt())
    return out, spacing, -OUTER_HALF_BLOCKS * spacing, OUTER_HALF_BLOCKS * spacing, crs


def cap_color(src_path=None, size=COLOR_SIZE, half_m=CAP_HALF_M):
    """RGB uint8 array (size, size, 3): the equirectangular colour map in the cap's stereographic layout."""
    from scipy.ndimage import map_coordinates
    src_path = src_path or data_root() / "textures" / COLOR_NAME
    xs = ((np.arange(size) + 0.5) / size * 2 - 1) * half_m
    x, y = np.meshgrid(xs, -xs)  # row 0 = +y edge, col 0 = -x edge
    lat = -90.0 + 2.0 * np.degrees(np.arctan(np.hypot(x, y) / (2.0 * R_M)))  # inverse of rho_of_lat
    lon = np.degrees(np.arctan2(x, y))
    with rasterio.open(src_path) as ds:
        ppd = ds.width / 360.0
        if ds.height * 2 != ds.width or ds.count < 3:
            raise SystemExit(f"{src_path}: not a 2:1 RGB equirectangular map")
        r0 = int(math.floor((90.0 - lat.max()) * ppd)) - 2
        rgb = ds.read([1, 2, 3], window=Window(0, r0, ds.width, ds.height - r0)).astype(np.float32)
    row = np.clip((90.0 - lat) * ppd - 0.5 - r0, 0, rgb.shape[1] - 1)  # the last row stands for the pole itself
    col = ((lon + 180.0) % 360.0) * ppd - 0.5
    out = np.stack([map_coordinates(rgb[b], [row, col], order=1, mode="grid-wrap", prefilter=False)
                    for b in range(3)], axis=-1)
    return np.rint(np.clip(out, 0, 255)).astype(np.uint8)


def write_texture():
    from PIL import Image
    out = TEXTURES / COLOR_OUT
    Image.fromarray(cap_color(), "RGB").save(out, "WEBP", quality=88, method=6)
    print(f"wrote {out.relative_to(REPO)}: {COLOR_SIZE} x {COLOR_SIZE}, {out.stat().st_size} bytes")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--plan", action="store_true", help="print tile counts and sizes, write nothing")
    g.add_argument("--sample", nargs="+", metavar="SITE", help="tiles around these site ids only")
    g.add_argument("--texture", action="store_true", help="write the cap colour texture only")
    g.add_argument("--full", action="store_true",
                   help="every tile (about 190 MB: needs Isaac's approval, AGENTS.md)")
    args = ap.parse_args(argv)
    if args.texture:
        return write_texture()
    t_start = time.perf_counter()
    dem_path = data_root() / "lola" / DEM_NAME
    outer_path = data_root() / "lola" / FILL_DEM_NAME

    with rasterio.open(dem_path) as dem:
        crs = CRS.from_wkt(dem.crs.to_wkt())
        t = dem.transform
        res, x0, y0, width, height = abs(t.a), t.c, t.f, dem.width, dem.height
        if not (res == 20.0 and width == height and t.b == 0 and t.d == 0 and t.e == -res):
            raise SystemExit(f"{dem_path}: unexpected geotransform {t}")
        if width % BASE_FACTOR or any(width % f for f, _ in LEVELS.values()):
            raise SystemExit(f"{dem_path}: width {width} is not a multiple of the block factors")
        proj = crs.to_dict()
        if not (proj.get("proj") == "stere" and proj.get("lat_0") == -90 and proj.get("lon_0") == 0
                and proj.get("R") == R_M):
            raise SystemExit(f"{dem_path}: unexpected projection {proj}")
        if -x0 != CAP_HALF_M:
            raise SystemExit(f"{dem_path}: half-width {-x0} m, CAP_HALF_M says {CAP_HALF_M}")
        print_plan(width, x0, y0)
        if args.plan:
            return

        near = None
        if args.sample:
            to_xy = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
            sites = {s[0]: s for s in load_sites()}
            near = [to_xy.transform(sites[s][2], sites[s][1]) for s in args.sample]
        plans = {name: plan_level(name, width, x0, y0, near=near) for name in LEVELS}

        if OUT.exists():
            old = OUT / "cap.json"
            if near is not None and old.exists() and any(
                    lv.get("complete") for lv in json.loads(old.read_text(encoding="utf-8")).get("levels", [])):
                raise SystemExit(f"{OUT} holds a complete tile level; --sample would replace it with a sample. "
                                 "Delete the folder first if that is what you want.")
            shutil.rmtree(OUT)
        OUT.mkdir(parents=True)
        for name, plan in plans.items():
            for r in plan:
                (OUT / name / str(r)).mkdir(parents=True, exist_ok=True)

        nb = width // BASE_FACTOR
        base_sum = np.zeros((nb, nb))
        base_cnt = np.zeros((nb, nb))
        tile_bytes = {name: 0 for name in LEVELS}
        strip = TILE * max(f for f, _ in LEVELS.values())  # DEM rows of one tile row of the coarsest level
        for r0 in range(0, height, strip):
            n = min(strip, height - r0)
            a = dem.read(1, window=Window(0, r0, width, n)).astype(np.float32)
            if dem.nodata is not None and not math.isnan(dem.nodata):
                a[a == dem.nodata] = np.nan
            ok = np.isfinite(a)
            rows = (r0 + np.arange(n)) // BASE_FACTOR
            np.add.at(base_sum, rows, np.where(ok, a, 0).reshape(n, nb, BASE_FACTOR).sum(axis=2, dtype=np.float64))
            np.add.at(base_cnt, rows, ok.reshape(n, nb, BASE_FACTOR).sum(axis=2))
            del ok
            for name, (f, _) in LEVELS.items():
                px = TILE * f  # DEM pixels per tile side
                for k in range(0, n, px):
                    tr = (r0 + k) // px
                    cols = plans[name].get(tr)
                    if not cols:
                        continue
                    c_lo, c_hi = cols[0] * px, min((cols[-1] + 1) * px, width)
                    m = block_mean(a[k:min(k + px, n), c_lo:c_hi], f)
                    for tc in cols:
                        part = m[:, (tc - cols[0]) * TILE:(tc - cols[0] + 1) * TILE]
                        tile = np.full((TILE, TILE), np.nan)
                        tile[:part.shape[0], :part.shape[1]] = part
                        (OUT / name / str(tr) / f"{tc}.bin").write_bytes(
                            to_int16(tile, TILE_SCALE_M, f"{name}/{tr}/{tc}").tobytes(order="C"))
                        tile_bytes[name] += TILE * TILE * 2
            del a
            print(f"  DEM rows {r0}..{r0 + n} done, {time.perf_counter() - t_start:.0f} s", flush=True)

    base = np.where(base_cnt > 0, base_sum / np.maximum(base_cnt, 1), np.nan)
    base_scale = finest_scale(base)
    (OUT / "base.bin").write_bytes(to_int16(base, base_scale, "base").tobytes(order="C"))

    outer, outer_spacing, ox0, oy0, outer_crs = build_outer(outer_path)
    if outer_crs != crs:
        raise SystemExit(f"{outer_path}: projection differs from the main DEM's")
    outer_scale = finest_scale(outer)
    (OUT / "outer.bin").write_bytes(to_int16(outer, outer_scale, "outer").tobytes(order="C"))

    seconds = time.perf_counter() - t_start
    levels = []
    for name, (f, limit) in LEVELS.items():
        plan = plans[name]
        count = sum(len(v) for v in plan.values())
        levels.append({
            "name": name,
            "spacing_m": res * f,
            "tile_size": TILE,
            "x0_m": x0,
            "y0_m": y0,
            "width": width // f,
            "height": height // f,
            "north_lat": limit,
            "height_scale_m": TILE_SCALE_M,
            "resampling": f"{f} x {f} block means of the 20 m DEM",
            "path": f"{name}/<row>/<col>.bin",
            "complete": near is None,
            "tile_count": count,
            "bytes": tile_bytes[name],
            "tiles": {str(r): ranges(cols) for r, cols in plan.items()},
        })
    meta = {
        "name": "south-cap",
        "generated_by": "scripts/south_cap.py",
        "validation": "Resampled DEM heights for display and approximate horizons. Not validated by the science lead.",
        "projection": {
            "proj4": crs.to_proj4(),
            "read_from": f"the CRS of {DEM_NAME} (not from a label)",
            "lat_0": -90, "lon_0": 0, "lat_ts": -90, "R_m": R_M,
            "axes": "+x toward 90 E, +y toward longitude 0",
            "forward": "rho = 2 R tan((90 + lat) / 2); x = rho sin(lon); y = rho cos(lon)",
        },
        "height_ref": "metres above the 1737.4 km sphere (the DEM's reference)",
        "nodata": NODATA,
        "order": ORDER,
        "sample_position": SAMPLE_POSITION,
        "north_lat": -80.0,
        "source": register_row(DEM_NAME),
        "base": {
            "file": "base.bin", "spacing_m": res * BASE_FACTOR, "width": nb, "height": nb,
            "x0_m": x0, "y0_m": y0, "height_scale_m": base_scale,
            "resampling": f"{BASE_FACTOR} x {BASE_FACTOR} block means of the 20 m DEM",
            "bytes": (OUT / "base.bin").stat().st_size,
        },
        "outer": {
            "file": "outer.bin", "spacing_m": outer_spacing, "width": outer.shape[1], "height": outer.shape[0],
            "x0_m": ox0, "y0_m": oy0, "height_scale_m": outer_scale,
            "resampling": f"{OUTER_FACTOR} x {OUTER_FACTOR} block means of the 120 m DEM",
            "bytes": (OUT / "outer.bin").stat().st_size,
            "source": register_row(FILL_DEM_NAME),
        },
        "levels": levels,
        "measured": {"note": "sizes and time measured by this run", "generation_seconds": round(seconds, 1),
                     "total_bytes": int(sum(p.stat().st_size for p in OUT.rglob("*.bin")))},
    }
    (OUT / "cap.json").write_text(json.dumps(meta, indent=1) + "\n", encoding="utf-8")

    for lv in levels:
        print(f"level {lv['name']} m: {lv['tile_count']} tiles, {lv['bytes'] / 1e6:.1f} MB"
              + ("" if lv["complete"] else " (sample)"))
    print(f"base {nb} x {nb} at {res * BASE_FACTOR:.0f} m, scale {base_scale} m, "
          f"{meta['base']['bytes'] / 1e6:.2f} MB, {np.nanmin(base):.1f}..{np.nanmax(base):.1f} m, "
          f"nodata {int((~np.isfinite(base)).sum())}")
    print(f"outer {outer.shape[1]} x {outer.shape[0]} at {outer_spacing:.0f} m, scale {outer_scale} m, "
          f"{meta['outer']['bytes'] / 1e6:.2f} MB, {np.nanmin(outer):.1f}..{np.nanmax(outer):.1f} m, "
          f"nodata {int((~np.isfinite(outer)).sum())}")
    print(f"total {meta['measured']['total_bytes'] / 1e6:.1f} MB in {seconds:.0f} s, "
          f"peak RSS {peak_rss_bytes() / 1e6:.0f} MB")


if __name__ == "__main__":
    sys.exit(main())
