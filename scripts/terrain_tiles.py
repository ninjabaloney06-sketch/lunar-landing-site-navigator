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

Extra levels (same grid convention, Int16, nodata and height reference; meta field "level"):
  <id>-fine.bin/.json  251 x 251 at 20 m (+-2.5 km): bilinear samples of the 20 m DEM (native spacing)
  <id>-mid.bin/.json   301 x 301 at 400 m (+-60 km): 400 m box means of the 20 m DEM
  <id>-far.bin/.json   301 x 301 at 2 km (+-300 km, the masks' ray length): 2 km box means of the 20 m
                       DEM; outside the polar DEM's square, cell means of the global ldem_16 (fill)
Box means come from one pass over the whole DEM in strips: exact 5 x 5 block means to a 100 m grid,
then a nan-aware box filter as wide as the level's spacing, sampled bilinearly. Every level of a site
uses ONE reference height, the 80 m tile's ground (bilinear DEM at the site centre), written to every
meta as ground_m; the 80 m meta lists the levels that exist ("levels"). Heights are plain DEM heights
minus ground_m, stored in units of height_scale_m (finest of 0.1/0.25/0.5/1 m that fits Int16; 1 m
rounding steps show as stripes under a grazing Sun). Curvature is applied by the scene (scene3d/levels.ts).
ldem_16_uint.tif encoding (not documented by SVS): h_m = 0.5 * DN - 10000, longitude 0 at the image
centre, row 0 = 90 N; inferred from ldem_4.tif (km) and checked against the polar DEM by seam_stats().
"""
import argparse
import csv
import json
import math
import sys

import numpy as np
import rasterio
from PIL import Image
from pyproj import CRS, Transformer
from rasterio.windows import Window
from scipy.ndimage import map_coordinates, uniform_filter

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

# Illumination maps (PGDA average visibility), chosen by site latitude (Brief B step 5).
MAP_85S = ("avgvisib_85s_060m_201608", "avgvisib_85s_060m_201608.lbl", 60.0)
MAP_75S = ("avgvisib_75s_120m_201608", "AVGVISIB_75S_120M_201608.LBL", 120.0)

# Extra levels: name -> (size, spacing_m, resampling). Sizes are odd, so grid lines fall on multiples
# of the spacing and each level's square nests on the next one's grid lines (scene stitching).
LEVELS = {
    "fine": (251, 20.0, "bilinear samples of the 20 m DEM"),
    "mid": (301, 400.0, "400 m box means of the 20 m DEM"),
    "far": (301, 2000.0, "2 km box means of the 20 m DEM; ldem_16 cell means outside the polar DEM"),
}
BASE_M = 100.0  # block-mean grid the box filters run on (5 x 5 DEM pixels)
FILL_NAME = "ldem_16_uint.tif"
FILL_DN_M, FILL_OFFSET_M = 0.5, -10000.0  # inferred encoding, see module docstring
FILL_SUPERSAMPLE = 4  # k x k bilinear samples per far cell
SEAM_BAND_M = 6000.0  # seam statistics: far samples within this distance inside the polar DEM's edge
HEIGHT_SCALES = (0.1, 0.25, 0.5, 1.0)  # m per Int16 unit, extra levels only (the 80 m tile keeps 1 m)


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


def enu_to_latlon(lat_deg, lon_deg, x_e, y_n):
    """Lat/lon (deg) of local ENU offsets (m) put on the 1737.4 km sphere (radial projection)."""
    up, east, north = enu_basis(lat_deg, lon_deg)
    x_e, y_n = np.broadcast_arrays(np.asarray(x_e, dtype=float), np.asarray(y_n, dtype=float))
    p = (R_M * up)[:, None] + x_e.ravel()[None] * east[:, None] + y_n.ravel()[None] * north[:, None]
    p = p / np.linalg.norm(p, axis=0)
    lat = np.degrees(np.arcsin(np.clip(p[2], -1.0, 1.0)))
    lon = np.degrees(np.arctan2(p[1], p[0]))
    return lat.reshape(x_e.shape), lon.reshape(x_e.shape)


def grid_xy(size, spacing):
    """ENU x (east, by column) and y (north, by row) of a size x size grid, row 0 = north, col 0 = west."""
    half = (size - 1) / 2
    idx = np.arange(size)
    return np.broadcast_arrays((idx[None, :] - half) * spacing, (half - idx[:, None]) * spacing)


def grid_latlon(lat_deg, lon_deg, size, spacing):
    x_e, y_n = grid_xy(size, spacing)
    return enu_to_latlon(lat_deg, lon_deg, x_e, y_n)


def sample_latlon(lat_deg, lon_deg):
    """Lat/lon (deg, east-positive) of every 80 m tile sample, shape (SIZE, SIZE)."""
    return grid_latlon(lat_deg, lon_deg, SIZE, SPACING_M)


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
    return h_int, gray, alpha, valid, np.isfinite(frac), illum_name, illum_res, float(ground)


def to_int16(site_id, heights, scale=1.0):
    """Heights / scale rounded to Int16, NODATA where not finite; raises instead of clipping."""
    valid = np.isfinite(heights)
    h_int = np.where(valid, np.rint(heights / scale), NODATA)
    if np.any(valid & ((h_int < -32767) | (h_int > 32767))):
        raise SystemExit(f"{site_id}: height out of Int16 range")
    return h_int.astype("<i2"), valid


def height_scale(heights):
    """Finest of HEIGHT_SCALES (m per Int16 unit) that holds the level's range. Under a Sun 0-1.5 deg high a
    1 m rounding step is a visible slope kink (2.9 deg over 20 m), so the new levels store finer units."""
    peak = np.nanmax(np.abs(heights)) if np.isfinite(heights).any() else 0.0
    return next(s for s in HEIGHT_SCALES if peak / s <= 32767)


class PolarAverage:
    """Box means of the 20 m polar DEM: exact block means to a BASE_M grid (one strip-wise pass over the
    file, never the whole raster in memory), then nan-aware box filters of a level's spacing."""

    def __init__(self, dem, strip_rows=800):
        f = int(round(BASE_M / abs(dem.transform.a)))
        rows, cols = dem.height // f, dem.width // f
        data = np.full((rows, cols), np.nan, dtype=np.float32)
        step = (strip_rows // f) * f
        for r0 in range(0, rows * f, step):
            n = min(step, rows * f - r0)
            a = dem.read(1, window=Window(0, r0, cols * f, n)).astype(np.float32)
            if dem.nodata is not None and not math.isnan(dem.nodata):
                a[a == dem.nodata] = np.nan
            blocks = a.reshape(n // f, f, cols, f)
            ok = np.isfinite(blocks)
            cnt = ok.sum(axis=(1, 3))
            s = np.where(ok, blocks, 0).sum(axis=(1, 3), dtype=np.float64)
            data[r0 // f:(r0 + n) // f] = np.where(cnt > 0, s / np.maximum(cnt, 1), np.nan)
        self.data = data
        t = dem.transform
        self.x0, self.y0, self.res = t.c, t.f, abs(t.a) * f  # top-left corner, base pixel size
        self.crs = CRS.from_wkt(dem.crs.to_wkt())
        self.to_xy = Transformer.from_crs(self.crs.geodetic_crs, self.crs, always_xy=True)
        self._box = {}

    def box(self, spacing):
        w = int(round(spacing / self.res))
        if w not in self._box:
            ok = np.isfinite(self.data)
            num = uniform_filter(np.where(ok, self.data, 0).astype(np.float64), w, mode="constant")
            den = uniform_filter(ok.astype(np.float64), w, mode="constant")
            self._box[w] = np.where(den >= 0.5, num / np.maximum(den, 1e-12), np.nan)
        return self._box[w]

    def xy(self, lat, lon):
        x, y = self.to_xy.transform(np.asarray(lon), np.asarray(lat))
        return np.asarray(x, dtype=float), np.asarray(y, dtype=float)

    def sample(self, lat, lon, spacing):
        """Box mean (width = spacing) at lat/lon, bilinear between base pixels; NaN outside the DEM."""
        x, y = self.xy(lat, lon)
        col = (x - self.x0) / self.res - 0.5
        row = (self.y0 - y) / self.res - 0.5
        return map_coordinates(self.box(spacing), [row, col], order=1, mode="constant", cval=np.nan,
                               prefilter=False, output=np.float64)

    def edge_distance(self, lat, lon):
        """Distance (m, projected) from lat/lon to the DEM's square edge; negative outside."""
        x, y = self.xy(lat, lon)
        rows, cols = self.data.shape
        return np.minimum.reduce([x - self.x0, self.x0 + cols * self.res - x,
                                  self.y0 - y, y - (self.y0 - rows * self.res)])


class Ldem16:
    """Global LOLA ldem_16_uint.tif (16 px/deg, equirectangular, row 0 = 90 N, longitude 0 at the
    image centre), decoded with the inferred encoding h_m = 0.5 * DN - 10000."""

    def __init__(self, path):
        with rasterio.open(path) as src:
            self.h = src.read(1).astype(np.float64) * FILL_DN_M + FILL_OFFSET_M
        self.ppd = self.h.shape[1] / 360.0

    def at(self, lat, lon):
        col = ((np.asarray(lon) + 180.0) % 360.0) * self.ppd - 0.5
        row = (90.0 - np.asarray(lat)) * self.ppd - 0.5
        return map_coordinates(self.h, [row, col], order=1, mode="grid-wrap", prefilter=False)

    def cell_mean(self, lat0, lon0, x_e, y_n, spacing, k=FILL_SUPERSAMPLE):
        """Mean of k x k bilinear samples spread over each ENU cell (x_e, y_n) of width spacing."""
        acc = np.zeros(np.shape(x_e))
        for a in range(k):
            for b in range(k):
                dx = ((a + 0.5) / k - 0.5) * spacing
                dy = ((b + 0.5) / k - 0.5) * spacing
                la, lo = enu_to_latlon(lat0, lon0, np.asarray(x_e) + dx, np.asarray(y_n) + dy)
                acc += self.at(la, lo)
        return acc / (k * k)


def level_heights(name, lat, lon, ground, dem, dem_tr, polar, fill):
    """Absolute-minus-ground heights (float, NaN = nodata) of one extra level, plus its fill mask."""
    size, spacing, _ = LEVELS[name]
    x_e, y_n = grid_xy(size, spacing)
    g_lat, g_lon = enu_to_latlon(lat, lon, x_e, y_n)
    filled = np.zeros((size, size), dtype=bool)
    if name == "fine":
        h = bilinear_read(dem, dem_tr, g_lat, g_lon)
    else:
        h = polar.sample(g_lat, g_lon, spacing)
        if name == "far" and fill is not None:
            filled = ~np.isfinite(h)
            if filled.any():
                h[filled] = fill.cell_mean(lat, lon, x_e[filled], y_n[filled], spacing)
    return h - ground, filled


def seam_stats(lat, lon, polar, fill):
    """Polar DEM minus ldem_16, both as far-level cell means, at far samples within SEAM_BAND_M inside
    the polar DEM's edge: the overlap next to the seam where the far level switches datasets."""
    size, spacing, _ = LEVELS["far"]
    x_e, y_n = grid_xy(size, spacing)
    g_lat, g_lon = enu_to_latlon(lat, lon, x_e, y_n)
    pv = polar.sample(g_lat, g_lon, spacing)
    edge = polar.edge_distance(g_lat, g_lon)
    band = np.isfinite(pv) & (edge > spacing) & (edge < SEAM_BAND_M)
    if not band.any():
        return None
    d = pv[band] - fill.cell_mean(lat, lon, x_e[band], y_n[band], spacing)
    return {"n": int(d.size), "mean": float(d.mean()), "median": float(np.median(d)), "std": float(d.std()),
            "p5": float(np.percentile(d, 5)), "p95": float(np.percentile(d, 95)),
            "max_abs": float(np.abs(d).max())}


def write_level(site_id, name, h_int, ground, filled, scale):
    size, spacing, resampling = LEVELS[name]
    (OUT / f"{site_id}-{name}.bin").write_bytes(h_int.tobytes(order="C"))
    meta = {
        "site_id": site_id,
        "level": name,
        "size": size,
        "spacing_m": spacing,
        "order": ORDER,
        "height_ref": HEIGHT_REF,
        "ground_m": round(ground, 2),
        "height_scale_m": scale,
        "nodata": NODATA,
        "illum_png": None,
        "illum_map": None,
        "illum_res_m": None,
        "dem": DEM_NAME,
        "resampling": resampling,
    }
    if filled.any():
        meta["fill_dem"] = FILL_NAME
        meta["fill_fraction"] = round(float(filled.mean()), 3)
    (OUT / f"{site_id}-{name}.json").write_text(json.dumps(meta, indent=1) + "\n")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--site", action="append", help="only these site ids (default: all)")
    args = ap.parse_args(argv)
    dem_path = data_root() / "lola" / DEM_NAME
    OUT.mkdir(parents=True, exist_ok=True)
    report = []
    with rasterio.open(dem_path) as dem, \
            rasterio.open(data_root() / "illumination" / MAP_85S[1]) as m85, \
            rasterio.open(data_root() / "illumination" / MAP_75S[1]) as m75:
        dem_crs = CRS.from_wkt(dem.crs.to_wkt())
        dem_tr = Transformer.from_crs(dem_crs.geodetic_crs, dem_crs, always_xy=True)
        polar = PolarAverage(dem)
        fill = Ldem16(data_root() / "textures" / FILL_NAME)
        m85_tr = Transformer.from_crs(CRS.from_wkt(m85.crs.to_wkt()).geodetic_crs,
                                      CRS.from_wkt(m85.crs.to_wkt()), always_xy=True)
        m75_tr = Transformer.from_crs(CRS.from_wkt(m75.crs.to_wkt()).geodetic_crs,
                                      CRS.from_wkt(m75.crs.to_wkt()), always_xy=True)
        for site_id, lat, lon in load_sites():
            if args.site and site_id not in args.site:
                continue
            if not site_centre_inside(dem, dem_tr, np.array([lat]), np.array([lon])):
                report.append((site_id, "skipped: site centre outside the DEM"))
                continue
            if lat < -85.0:
                illum = {"src": m85, "meta": MAP_85S}
                illum_tr = m85_tr
            else:
                illum = {"src": m75, "meta": MAP_75S}
                illum_tr = m75_tr
            res = build_site(site_id, lat, lon, dem, dem_tr, illum, illum_tr)
            if res is None:
                report.append((site_id, "skipped: no DEM value at the site"))
                continue
            h_int, gray, alpha, valid, illum_ok, illum_name, illum_res, ground = res
            (OUT / f"{site_id}.bin").write_bytes(h_int.astype("<i2").tobytes(order="C"))
            Image.merge("LA", [Image.fromarray(gray), Image.fromarray(alpha)]).save(
                OUT / f"{site_id}-illum.png", optimize=True)
            sizes = {"80m": h_int.nbytes}
            for name in LEVELS:
                h, filled = level_heights(name, lat, lon, ground, dem, dem_tr, polar, fill)
                scale = height_scale(h)
                lv_int, lv_valid = to_int16(f"{site_id}-{name}", h, scale)
                write_level(site_id, name, lv_int, ground, filled, scale)
                sizes[name] = lv_int.nbytes
                report.append((f"{site_id}-{name}",
                               f"valid={lv_valid.mean():.3f} filled={filled.mean():.3f} "
                               f"scale={scale} m h_min={lv_int[lv_valid].min() * scale:.1f} "
                               f"h_max={lv_int[lv_valid].max() * scale:.1f}"))
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
                "ground_m": round(ground, 2),
                "levels": list(LEVELS),
            }
            (OUT / f"{site_id}.json").write_text(json.dumps(meta, indent=1) + "\n")
            report.append((site_id,
                           f"dem_valid={valid.mean():.3f} illum_valid={illum_ok.mean():.3f} "
                           f"h_min={h_int[valid].min() if valid.any() else 'na'} "
                           f"h_max={h_int[valid].max() if valid.any() else 'na'} "
                           f"map={illum_name} bytes " + " ".join(f"{k}={v}" for k, v in sizes.items())))
            stats = seam_stats(lat, lon, polar, fill)
            if stats:
                report.append((f"{site_id} seam (polar - ldem_16, m)",
                               " ".join(f"{k}={v:+.1f}" if k != "n" else f"n={v}" for k, v in stats.items())))
    for site_id, msg in report:
        print(f"{site_id}: {msg}")
    total = sum(p.stat().st_size for p in OUT.iterdir() if p.is_file())
    new = sum(p.stat().st_size for p in OUT.iterdir() if p.is_file() and
              any(p.name.endswith(f"-{n}.bin") or p.name.endswith(f"-{n}.json") for n in LEVELS))
    print(f"terrain folder: {total} bytes, of which extra levels {new} bytes")


if __name__ == "__main__":
    sys.exit(main())
