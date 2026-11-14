"""Mandatory site assessments (spec.md, 14 Nov): slope, roughness, PSR access, thermal.

    CLPS_DATA=... python3 scripts/assessments.py          # all sites in app/public/data/sites.json

Writes app/public/data/assessments.json. Data side only; AI-built, not validated by S.
Projection: every raster is opened with rasterio and lat/lon <-> map x/y goes through
pyproj with the raster's CRS, exactly as in horizon.py (Grid, enu, unit, ray_points are
imported from there). One documented exception: the 60 m and 240 m Sun-visibility labels
say CENTER_LONGITUDE = 180, but their pixels line up with the DEM only when read with
lon_0 = 0 (see ILLUM_CRS_NOTE); those two maps are read with the DEM's CRS.
"""
import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Proj, Transformer
from rasterio.windows import Window
from scipy.ndimage import label

from config import APP_DATA, REPO, data_root
from horizon import DEM_LABEL, R_KM, Grid, enu, ray_points, to_latlon, unit

# --- project criteria (ninja, 14 Nov) and assessment parameters (AI proposals, Leo decides) ---
LANDING_MAX_DEG = 5.0          # landing passes at <= 5.0 deg
EXPLORATION_MAX_DEG = 20.0     # exploration requires < 20.0 deg
SLOPE_DECIMALS = 2             # slopes are rounded to 0.01 deg (the reported precision) before comparing
LANDING_RADIUS_M = 100.0
EXPLORATION_RADIUS_M = 2000.0
NODATA_MAX_FRACTION = 0.20     # more nodata than this in an area -> status unknown
PSR_MIN_AREA_KM2 = 0.1         # smallest zero-visibility cluster counted
PSR_SEARCH_KM = 50.0           # nearest-cluster search radius
PSR_RADII_KM = (5, 10, 15)
LINE_5M_MAX_KM = 15.0          # longer straight lines use the 20 m DEM (memory)
CONNECTIVITY = np.ones((3, 3), dtype=bool)  # 8-connected clusters

DEM20 = ("lola/LDEM_80S_20MPP_ADJ.TIF", 20.0)
DEM5 = ("lola/ldem_875s_5m.lbl", 5.0)
ILLUM_MAPS = [  # finest first
    ("illumination/avgvisib_85s_060m_201608.lbl", 60.0, True),
    ("illumination/AVGVISIB_75S_120M_201608.LBL", 120.0, False),
    ("illumination/avgvisib_65s_240m_201608.lbl", 240.0, True),
]
DEM_CRS = "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
ILLUM_CRS_NOTE = (
    "The 60 m and 240 m map labels state CENTER_LONGITUDE = 180, the 120 m label and both DEMs 0. "
    "Read with lon_0 = 180 (as GDAL parses the label), the 60 m map correlates with the 120 m map "
    "at r = -0.05 and with LOLA elevation at r = -0.02 (4000 random points, 85.5-89.5 S); read with "
    "lon_0 = 0 it correlates at r = 0.98 and 0.27 (120 m map: 0.28). The 60 m and 240 m maps are "
    "therefore read with the DEM's CRS (lon_0 = 0). Leo to confirm."
)

SITES_JSON = APP_DATA / "sites.json"
OUT_JSON = APP_DATA / "assessments.json"
RESEARCH = REPO / "docs" / "reference" / "research" / "data"

CRITERIA_NOTE = "project criteria (ninja), not NASA or vehicle limits"
SHADOW_WORDING = "zero average Sun visibility in the Mazarico et al. model map"
LINE_LABEL = "straight-line terrain check, not a route"
SLOPE_METHOD = (
    "per-pixel slope from central differences over two pixels in map x and y "
    "(baseline 2 px), gradient corrected by the polar stereographic scale factor at the site; "
    "statistics over pixel centres inside a disk of the stated ground radius around the site; "
    f"slopes rounded to 0.{'0' * (SLOPE_DECIMALS - 1)}1 deg before threshold comparison"
)
MAZARICO = ("Mazarico et al. 2011, Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030; "
            "LOLA PDS average Sun visibility maps AVGVISIB_*_201608 (V1.05, 2016 release); "
            "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/; "
            "120 m map from the MIT mirror http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/")
PDS_LOLA_URL = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.lbl"
PGDA_URL = "https://pgda.gsfc.nasa.gov/products/90"
ROUGHNESS_REF = ("Shepard et al. 2001, JGR 106(E12), 32777-32795, doi:10.1029/2000JE001429 "
                 "(RMS height after removing a best-fit plane)")


# ---------------------------------------------------------------- raster access

class Raster:
    """An opened raster with the CRS and transformers used for every coordinate conversion."""

    def __init__(self, path, res_m, crs_override=None, scale=None):
        self.path = Path(path)
        self.ds = rasterio.open(self.path)
        self.res_m = res_m
        self.crs_overridden = crs_override is not None
        self.crs = CRS(crs_override) if crs_override else CRS.from_wkt(self.ds.crs.to_wkt())
        self.to_xy = Transformer.from_crs(self.crs.geodetic_crs, self.crs, always_xy=True)
        self.to_ll = Transformer.from_crs(self.crs, self.crs.geodetic_crs, always_xy=True)
        # PDS labels: HEIGHT = DN * SCALING_FACTOR (OFFSET is the 1737.4 km reference radius)
        self.scale = float(self.ds.scales[0]) if scale is None else scale

    def xy(self, lat, lon):
        return self.to_xy.transform(lon, lat)

    def contains(self, lat, lon):
        x, y = self.xy(lat, lon)
        b = self.ds.bounds
        return b.left < x < b.right and b.bottom < y < b.top

    def k(self, lat, lon):
        """Map scale factor (map length / ground length) at the site."""
        return float(Proj(self.crs).get_factors(lon, lat).meridional_scale)

    def read_box(self, x, y, half_m, pad_px=2, raw=False):
        """Boundless window around map x/y; pixels outside the raster or on nodata become NaN."""
        t = self.ds.transform
        c0 = math.floor((x - half_m - t.c) / t.a) - pad_px
        c1 = math.ceil((x + half_m - t.c) / t.a) + pad_px
        r0 = math.floor((y + half_m - t.f) / t.e) - pad_px
        r1 = math.ceil((y - half_m - t.f) / t.e) + pad_px
        win = Window(c0, r0, c1 - c0, r1 - r0)
        nod = self.ds.nodata
        fill = nod if nod is not None and not np.isnan(nod) else np.nan
        a = self.ds.read(1, window=win, boundless=True, fill_value=fill)
        if raw:
            return a, self.ds.window_transform(win)
        a = a.astype(np.float64)
        if nod is not None and not np.isnan(nod):
            a[a == nod] = np.nan
        a *= self.scale
        return Grid(a, self.ds.window_transform(win))


def pixel_centres(transform, shape):
    rows, cols = np.indices(shape)
    x = transform.c + (cols + 0.5) * transform.a
    y = transform.f + (rows + 0.5) * transform.e
    return x, y


# ---------------------------------------------------------------- slope and roughness (pure)

def slope_grid(z, res_m, k=1.0):
    """Slope in degrees per pixel, central differences over 2 px; NaN at edges and next to nodata."""
    s = np.full(z.shape, np.nan)
    gx = (z[1:-1, 2:] - z[1:-1, :-2]) / (2 * res_m)
    gy = (z[2:, 1:-1] - z[:-2, 1:-1]) / (2 * res_m)
    s[1:-1, 1:-1] = np.degrees(np.arctan(k * np.hypot(gx, gy)))
    return s


def disk_mask(transform, shape, x, y, radius_map_m):
    px, py = pixel_centres(transform, shape)
    return (px - x) ** 2 + (py - y) ** 2 <= radius_map_m ** 2


def rslope(v):
    return np.round(v, SLOPE_DECIMALS)


def area_slope_stats(slope, mask):
    """Median/max slope and threshold fractions over `mask`; None stats if nodata > 20 %."""
    n = int(mask.sum())
    vals = rslope(slope[mask])
    valid = vals[np.isfinite(vals)]
    nodata_frac = 1.0 - valid.size / n if n else 1.0
    out = {"n_pixels": n, "nodata_pct": round(100 * nodata_frac, 2)}
    if n == 0 or nodata_frac > NODATA_MAX_FRACTION:
        out.update(status="unknown", median_slope_deg=None, max_slope_deg=None,
                   pct_le_5deg=None, pct_lt_20deg=None,
                   reason=f"nodata {100 * nodata_frac:.1f} % of the area (limit {100 * NODATA_MAX_FRACTION:.0f} %)")
        return out
    out.update(status="computed",
               median_slope_deg=round(float(np.median(valid)), SLOPE_DECIMALS),
               max_slope_deg=round(float(valid.max()), SLOPE_DECIMALS),
               pct_le_5deg=round(100 * float(np.mean(valid <= LANDING_MAX_DEG)), 2),
               pct_lt_20deg=round(100 * float(np.mean(valid < EXPLORATION_MAX_DEG)), 2))
    return out


def landing_pass(stats):
    """Rule (AI proposal): every valid pixel in the landing disk <= 5.0 deg. None if unknown."""
    if stats.get("status") != "computed":
        return None
    return bool(stats["max_slope_deg"] <= LANDING_MAX_DEG)


def plane_rms(z, mask, transform, k=1.0):
    """RMS height deviation (m) from a least-squares plane over valid pixels in `mask`."""
    px, py = pixel_centres(transform, z.shape)
    m = mask & np.isfinite(z)
    n = int(mask.sum())
    nodata_frac = 1.0 - m.sum() / n if n else 1.0
    if n == 0 or nodata_frac > NODATA_MAX_FRACTION or m.sum() < 4:
        return None, nodata_frac
    X = np.column_stack([(px[m] - px[m].mean()) / k, (py[m] - py[m].mean()) / k, np.ones(m.sum())])
    coef, *_ = np.linalg.lstsq(X, z[m], rcond=None)
    resid = z[m] - X @ coef
    return float(np.sqrt(np.mean(resid ** 2))), nodata_frac


# ---------------------------------------------------------------- geometry helpers

def _uvec(lat, lon):
    return np.moveaxis(unit(np.asarray(lat, dtype=float), np.asarray(lon, dtype=float)), 0, -1)


def gc_distance_km(lat0, lon0, lat, lon):
    """Great-circle distance on the R_KM sphere (atan2 form, stable at small angles)."""
    u = unit(lat0, lon0)
    v = _uvec(lat, lon)
    return R_KM * np.arctan2(np.linalg.norm(np.cross(v, u), axis=-1), v @ u)


def bearing_deg(lat0, lon0, lat, lon):
    east, north, _ = enu(lat0, lon0)
    v = unit(lat, lon)
    return float(np.degrees(np.arctan2(v @ east, v @ north)) % 360.0)


# ---------------------------------------------------------------- per-site blocks

def choose_dem(lat, lon, dem5, dem20):
    """5 m DEM if the whole exploration disk lies inside it with <= 20 % nodata, else 20 m."""
    notes = []
    if dem5 is not None and dem5.contains(lat, lon):
        x, y = dem5.xy(lat, lon)
        k = dem5.k(lat, lon)
        g = dem5.read_box(x, y, EXPLORATION_RADIUS_M * k)
        mask = disk_mask(g.transform, g.data.shape, x, y, EXPLORATION_RADIUS_M * k)
        frac = 1 - np.isfinite(g.data[mask]).mean()
        if frac <= NODATA_MAX_FRACTION:
            return dem5, g, notes
        notes.append(f"5 m DEM has {100 * frac:.1f} % nodata in the 2 km disk; 20 m DEM used")
    else:
        notes.append("site outside the 5 m DEM (87.5-90 S); 20 m DEM used")
    if not dem20.contains(lat, lon):
        return None, None, notes + ["site outside the 20 m DEM (80-90 S)"]
    x, y = dem20.xy(lat, lon)
    k = dem20.k(lat, lon)
    return dem20, dem20.read_box(x, y, EXPLORATION_RADIUS_M * k), notes


def dem_desc(dem):
    return {"dem_file": dem.path.name, "dem_pixel_m": dem.res_m, "slope_baseline_m": 2 * dem.res_m}


def slope_and_roughness(lat, lon, dem, grid, notes):
    lim_slope = [
        "Slope at the DEM's own scale over a 2-pixel baseline; it is not the 100 m point slope in sites.json.",
        "Passing the 5 deg slope criterion alone does not establish overall landing suitability.",
        "A slope fraction over a disk does not establish that a route exists.",
    ] + notes
    if dem is None:
        unknown = {"status": "unknown", "reason": "; ".join(notes), "landing_slope_pass": None}
        return ({**unknown, "source": None, "method": SLOPE_METHOD, "limitations": lim_slope,
                 "landing_area": None, "exploration_area": None},
                {"status": "unknown", "reason": "; ".join(notes), "rms_height_m": None,
                 "obstacles": "unknown", "source": None, "method": None, "limitations": []})
    x, y = dem.xy(lat, lon)
    k = dem.k(lat, lon)
    s = slope_grid(grid.data, dem.res_m, k)
    land_mask = disk_mask(grid.transform, s.shape, x, y, LANDING_RADIUS_M * k)
    expl_mask = disk_mask(grid.transform, s.shape, x, y, EXPLORATION_RADIUS_M * k)
    land = {"radius_m": LANDING_RADIUS_M, **dem_desc(dem), **area_slope_stats(s, land_mask)}
    expl = {"radius_m": EXPLORATION_RADIUS_M, **dem_desc(dem), **area_slope_stats(s, expl_mask)}
    lp = landing_pass(land)
    status = "computed" if land["status"] == "computed" else "unknown"
    slope = {
        "status": status,
        "landing_slope_pass": lp,
        "landing_rule": (f"passes the 5 deg slope criterion only if every valid pixel slope in the "
                         f"{LANDING_RADIUS_M:.0f} m radius disk is <= {LANDING_MAX_DEG} deg "
                         "(AI proposal; Leo decides radius and rule)"),
        "landing_area": land,
        "exploration_area": expl,
        "source": dem_source(dem),
        "method": SLOPE_METHOD,
        "limitations": lim_slope,
    }
    if lp is None:
        slope["reason"] = land.get("reason", "slope data missing")

    rms, nf = plane_rms(grid.data, land_mask, grid.transform, k)
    det_m = 2 * dem.res_m
    rough = {
        "status": "computed" if rms is not None else "unknown",
        "measure": "RMS height deviation from a least-squares plane, landing disk, DEM pixel scale",
        "area_radius_m": LANDING_RADIUS_M,
        **dem_desc(dem),
        "rms_height_m": round(rms, 2) if rms is not None else None,
        "nodata_pct": round(100 * nf, 2),
        "detection_limit_m": det_m,
        "obstacles": "unknown",
        "obstacles_reason": (f"features smaller than about two DEM pixels (~{det_m:.0f} m on the "
                             f"{dem.res_m:.0f} m DEM), including all boulders, are not resolved; "
                             "no rock-abundance or boulder map is used"),
        "source": dem_source(dem) + "; measure: " + ROUGHNESS_REF,
        "method": ("fit z = a x + b y + c to the valid DEM heights inside the landing disk "
                   "(least squares, ground metres), report sqrt(mean(residual^2))"),
        "limitations": [
            "DEM heights are interpolated between LOLA tracks; RMS reflects the gridded surface, "
            "not metre-scale roughness.",
            "Not a hazard map: obstacles below the detection limit are unknown, not absent.",
        ],
        "sourced_hazards": [],
    }
    if rms is None:
        rough["reason"] = f"nodata {100 * nf:.1f} % of the landing disk"
    return slope, rough


def dem_source(dem):
    if dem.res_m == 20.0:
        return f"{DEM_LABEL}; {PGDA_URL}"
    return ("LDEM_875S_5M (LOLA PDS GDR, LRO-L-LOLA-4-GDR-V1.0, PRODUCT_VERSION_ID V2.0, 2017-06-15; "
            f"heights = DN x 0.5 m relative to 1737.4 km, from the .lbl); {PDS_LOLA_URL}")


def straight_line(lat, lon, az, length_km, dem):
    """Slope along the great circle from the site toward `az` for `length_km` (2 px baseline)."""
    step_km = dem.res_m / 1000.0
    n = max(2, int(math.ceil(length_km / step_km)) + 1)
    d = np.linspace(0.0, length_km, n)
    la, lo = to_latlon(ray_points(lat, lon, [az], d)[0])
    px, py = dem.to_xy.transform(lo, la)
    px, py = np.asarray(px), np.asarray(py)
    k = dem.k(lat, lon)
    xc, yc = (px.min() + px.max()) / 2, (py.min() + py.max()) / 2
    half = max(px.max() - px.min(), py.max() - py.min()) / 2 + 3 * dem.res_m
    g = dem.read_box(xc, yc, half)
    r = dem.res_m
    gx = (g.sample(px + r, py) - g.sample(px - r, py)) / (2 * r)
    gy = (g.sample(px, py + r) - g.sample(px, py - r)) / (2 * r)
    s = rslope(np.degrees(np.arctan(k * np.hypot(gx, gy))))
    valid = s[np.isfinite(s)]
    nodata = 1 - valid.size / s.size
    out = {"label": LINE_LABEL, "length_km": round(float(length_km), 3), **dem_desc(dem),
           "n_samples": int(n), "nodata_pct": round(100 * nodata, 2)}
    if nodata > NODATA_MAX_FRACTION or valid.size == 0:
        out.update(status="unknown", max_slope_deg=None, pct_lt_20deg=None,
                   reason=f"nodata {100 * nodata:.1f} % along the line")
    else:
        out.update(status="computed", max_slope_deg=round(float(valid.max()), SLOPE_DECIMALS),
                   pct_lt_20deg=round(100 * float(np.mean(valid < EXPLORATION_MAX_DEG)), 2))
    return out


def shadow_clusters(dn, transform, raster, lat, lon, k):
    """Label zero-visibility pixels; return per-pixel distance info for clusters >= min area."""
    zero = dn == 0
    lab, nlab = label(zero, structure=CONNECTIVITY)
    px_area_km2 = (raster.res_m / k / 1000.0) ** 2
    sizes = np.bincount(lab.ravel(), minlength=nlab + 1) * px_area_km2
    keep = np.flatnonzero(sizes >= PSR_MIN_AREA_KM2)
    keep = keep[keep > 0]
    sel = np.isin(lab, keep)
    rows, cols = np.nonzero(sel)
    x = transform.c + (cols + 0.5) * transform.a
    y = transform.f + (rows + 0.5) * transform.e
    plo, pla = raster.to_ll.transform(x, y)
    dist = gc_distance_km(lat, lon, np.asarray(pla), np.asarray(plo)) if rows.size else np.array([])
    return lab, sizes, rows, cols, np.asarray(pla), np.asarray(plo), dist, px_area_km2


def match_named_psr(lab, cluster_id, transform, raster, catalogue):
    """Catalogue PSRs whose listed coordinate falls inside (or 1 px from) the given cluster."""
    hits = []
    for it in catalogue:
        x, y = raster.xy(it["lat"], it["lon_east_180"])
        c = int(math.floor((x - transform.c) / transform.a))
        r = int(math.floor((y - transform.f) / transform.e))
        sub = lab[max(r - 1, 0):r + 2, max(c - 1, 0):c + 2]
        if 0 <= r < lab.shape[0] and 0 <= c < lab.shape[1] and np.any(sub == cluster_id):
            hits.append(it)
    return hits


def psr_block(lat, lon, illum, dem5, dem20, psr_items):
    lim = [
        f"Shadow = {SHADOW_WORDING} (pixel value exactly 0), not the LROC PSR Atlas.",
        "Permanent shadow is a geometric/thermal condition; it is not evidence of ice.",
        "Proximity is not reachability; the straight line ignores obstacles below the DEM's "
        "detection limit, illumination, power, thermal and communication constraints.",
        f"Clusters are 8-connected pixels inside a {PSR_SEARCH_KM:.0f} km search box; clusters "
        "cut by the box edge are measured only inside it.",
    ]
    base = {"source": MAZARICO, "method": None, "limitations": lim}
    raster = next((r for r in illum if r.contains(lat, lon)), None)
    if raster is None:
        return {**base, "status": "unknown", "reason": "site outside every Sun-visibility map on disk",
                "nearest_cluster": None}
    k = raster.k(lat, lon)
    x, y = raster.xy(lat, lon)
    dn, t = raster.read_box(x, y, (PSR_SEARCH_KM + 2) * 1000 * k, raw=True)
    nod = raster.ds.nodata
    outside = dn == nod
    dn = np.where(outside, -1, dn)
    c0 = int(math.floor((x - t.c) / t.a))
    r0 = int(math.floor((y - t.f) / t.e))
    site_dn = int(dn[r0, c0])
    lab, sizes, rows, cols, pla, plo, dist, pxa = shadow_clusters(dn, t, raster, lat, lon, k)
    method = (f"{raster.path.name}: pixels with DN = 0 grouped into 8-connected clusters; clusters "
              f">= {PSR_MIN_AREA_KM2} km2 kept; great-circle distance (R = {R_KM} km) from the site to "
              "each kept pixel centre; bearing 0 = north, clockwise; areas use the scale factor at the site")
    out = {
        **base, "method": method, "map_file": raster.path.name, "map_pixel_m": raster.res_m,
        "min_cluster_area_km2": PSR_MIN_AREA_KM2, "search_radius_km": PSR_SEARCH_KM,
        "site_avg_sun_visibility": round(site_dn * float(raster.ds.scales[0]), 4) if site_dn >= 0 else None,
        "site_pixel_zero_visibility": site_dn == 0,
        "search_box_nodata_pct": round(100 * float(outside.mean()), 2),
        "crs_note": ILLUM_CRS_NOTE if raster.crs_overridden else None,
    }
    in_search = dist <= PSR_SEARCH_KM
    out["shadow_area_within_km2"] = {
        f"{r}km": round(float(np.sum(dist <= r) * pxa), 3) for r in PSR_RADII_KM}
    if not np.any(in_search):
        out.update(status="computed", nearest_cluster=None,
                   reason=f"no cluster >= {PSR_MIN_AREA_KM2} km2 within {PSR_SEARCH_KM:.0f} km")
        return out
    i = int(np.argmin(dist))
    cid = int(lab[rows[i], cols[i]])
    d_km = float(dist[i])
    on_site = lab[r0, c0] == cid
    az = None if on_site or d_km == 0 else bearing_deg(lat, lon, float(pla[i]), float(plo[i]))
    nearest = {
        "distance_km": 0.0 if on_site else round(d_km, 3),
        "distance_to": "site pixel is inside the cluster" if on_site else "nearest cluster pixel centre",
        "bearing_deg": round(az, 1) if az is not None else None,
        "cluster_area_km2": round(float(sizes[cid]), 3),
        "lat": round(float(pla[i]), 5), "lon": round(float(plo[i]), 5),
    }
    if on_site or d_km == 0:
        nearest["straight_line"] = {"label": LINE_LABEL, "status": "computed", "length_km": 0.0,
                                    "max_slope_deg": None, "pct_lt_20deg": None,
                                    "reason": "site pixel already has zero visibility"}
    else:
        use5 = (dem5 is not None and d_km <= LINE_5M_MAX_KM and dem5.contains(lat, lon)
                and dem5.contains(float(pla[i]), float(plo[i])))
        dem = dem5 if use5 else dem20
        if dem.contains(lat, lon) and dem.contains(float(pla[i]), float(plo[i])):
            nearest["straight_line"] = straight_line(lat, lon, az, d_km, dem)
        else:
            nearest["straight_line"] = {"label": LINE_LABEL, "status": "unknown",
                                        "reason": "line endpoint outside the DEMs on disk"}
    atlas = [it for it in psr_items if it["type"] == "psr_atlas"]
    hits = match_named_psr(lab, cid, t, raster, atlas)
    if len(hits) == 1:
        a = hits[0]
        named = {"name": a["name"], "atlas_id": a["atlas_id"], "atlas_psr_area_km2": a["psr_area_km2"],
                 "source_url": a["source_url"],
                 "match_basis": "the catalogue coordinate lies inside (or 1 px from) this cluster and no other catalogue PSR does"}
        lem = [it for it in psr_items if it["type"] == "psr_lemelin2021" and it.get("lat") is not None]
        lhits = match_named_psr(lab, cid, t, raster, lem)
        if len(lhits) == 1:
            L = lhits[0]
            named["lemelin2021"] = {
                "name": L["name"], "temp_K_min_max_mean": L["temp_K_min_max_mean"],
                "access_slope_class_deg": L["access_slope_class_deg"],
                "evidence_note": "temperature values as printed in Lemelin et al. 2021 (copied in psr_and_ice.json); apply to the PSR, not to the landing site",
                "caveat": L.get("caveat"), "source_url": L["source_url"]}
        nearest["named_psr"] = named
    else:
        nearest["named_psr"] = None
        nearest["named_psr_reason"] = ("no catalogue PSR coordinate in this cluster" if not hits else
                                       f"ambiguous: {len(hits)} catalogue PSRs fall in this cluster ("
                                       + ", ".join(h["name"] for h in hits) + ")")
    out.update(status="computed", nearest_cluster=nearest)
    return out


# ---------------------------------------------------------------- sourced hazards / thermal

# (site_id, hazards_and_science item id, property key, how the item was matched to the site)
SITE_HAZARDS = [
    ("im-1", "terrain_landing_outcomes", "IM-1", "the item's IM-1 coordinates (-80.13, 1.44) equal this site's"),
    ("im-2-intended", "terrain_landing_outcomes", "IM-2",
     "IM-2 actual touchdown (item coordinates); this site is the intended point, see distance"),
    ("shackleton-rim-site04", "terrain_boulders_shackleton", "blocks",
     "item names 'site 004 (Shackleton rim)'; numbering assumed to match NASA Data Book Site04 - Leo to confirm"),
    ("de-gerlache-rim-1", "terrain_narrow_rims", "statement", "region name in the item"),
    ("de-gerlache-rim-2", "terrain_narrow_rims", "statement", "region name in the item"),
    ("nobile-rim-1", "terrain_narrow_rims", "statement", "region name in the item"),
    ("nobile-rim-2", "terrain_narrow_rims", "statement", "region name in the item"),
    ("connecting-ridge", "terrain_narrow_rims", "statement", "region name in the item"),
    ("malapert-massif", "terrain_narrow_rims", "statement", "region name in the item"),
    ("malapert-site23", "terrain_narrow_rims", "statement", "region name in the item"),
]
SCARP_RADIUS_KM = 50.0


def sourced_hazards(site, hazards):
    out = []
    by_id = {h["id"]: h for h in hazards}
    for sid, hid, key, basis in SITE_HAZARDS:
        if sid != site["id"]:
            continue
        h = by_id[hid]
        entry = {"item_id": hid, "statement": h["properties"][key], "evidence": h["evidence"],
                 "match_basis": basis, "source_url": h["source_url"]}
        if hid == "terrain_landing_outcomes" and key == "IM-2":
            entry["distance_from_site_km"] = round(float(gc_distance_km(
                site["lat"], site["lon"], h["lat"], h["lon_east_180"])), 3)
        out.append(entry)
    for h in hazards:
        if h["category"] == "hazard_scarp" and h.get("lat") is not None:
            d = float(gc_distance_km(site["lat"], site["lon"], h["lat"], h["lon_east_180"]))
            if d <= SCARP_RADIUS_KM:
                out.append({"item_id": h["id"], "statement": h["name"] + ": " + json.dumps(h["properties"]),
                            "evidence": h["evidence"], "distance_from_site_km": round(d, 1),
                            "distance_to": "the scarp's representative point in the item, not its trace",
                            "match_basis": f"mapped scarp within {SCARP_RADIUS_KM:.0f} km",
                            "source_url": h["source_url"]})
    return out


DIVINER_TAB = "diviner/dlre_prp_south.tab"
DIVINER_URL = "https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/"
DIVINER_TERMS = (
    "public NASA PDS data; no licence or usage terms in the .lbl or .xml; NASA SMD policy SPD-41a "
    "requires SMD-funded scientific information to be made publicly available "
    "(https://science.nasa.gov/researchers/science-data/science-information-policy/); "
    "cite the product as below")
DIVINER_CITATION = ("Paige et al., LRO DLRE LEVEL 5 PRP V2.0, NASA Planetary Data System, "
                    "LRO-L-DLRE-5-PRP-V2.0, 2018 (citation as given in the PDS catalogue prpds.cat); "
                    "method: Paige et al. 2010, Science 330(6003), 479 (prpds.cat prints p. 497)")
PRP_CANDIDATE_KM = 3.0         # triangle centres searched for the containing triangle
PRP_FIELDS = ("tri1_x", "tri1_y", "tri1_z", "tri2_x", "tri2_y", "tri2_z", "tri3_x", "tri3_y", "tri3_z",
              "tri_clon", "tri_clat", "temp_avg", "temp_max")


def read_pds4_table_spec(xml_path):
    """Field name -> (1-based byte location, length, unit, description, invalid constants), plus
    table offset and record length, read from the PDS4 label (namespace-agnostic)."""
    import xml.etree.ElementTree as ET
    tag = lambda e: e.tag.rsplit("}", 1)[-1]
    root = ET.parse(xml_path).getroot()
    table = next(e for e in root.iter() if tag(e) == "Table_Character")
    get = lambda e, name: next((c for c in e.iter() if tag(c) == name), None)
    spec = {"offset": int(get(table, "offset").text), "records": int(get(table, "records").text),
            "record_length": int(get(table, "record_length").text), "fields": {}}
    for f in (e for e in table.iter() if tag(e) == "Field_Character"):
        sc = get(f, "Special_Constants")
        inval = [float(c.text) for c in sc.iter() if tag(c) != "Special_Constants"] if sc is not None else []
        unit = get(f, "unit")
        spec["fields"][get(f, "name").text.strip()] = {
            "location": int(get(f, "field_location").text), "length": int(get(f, "field_length").text),
            "unit": unit.text.strip() if unit is not None else None,
            "description": " ".join(get(f, "description").text.split()), "invalid": inval}
    return spec


class PRPMesh:
    """Diviner polar resource product: triangle centres, vertices and temperatures."""

    def __init__(self, spec, rows, tab_path=None):
        self.spec, self.rows, self.tab_path = spec, rows, tab_path
        self.n = rows.shape[0]
        clat, clon = self.column("tri_clat"), self.column("tri_clon")
        self.centre = _uvec(clat, clon)

    @classmethod
    def from_files(cls, tab_path, xml_path=None):
        tab_path = Path(tab_path)
        spec = read_pds4_table_spec(xml_path or tab_path.with_suffix(".xml"))
        rl = spec["record_length"]
        raw = np.memmap(tab_path, dtype=np.uint8, mode="r", offset=spec["offset"],
                        shape=(spec["records"] * rl,))
        return cls(spec, raw.reshape(spec["records"], rl), tab_path)

    def column(self, name, idx=None):
        f = self.spec["fields"][name]
        r = self.rows if idx is None else self.rows[idx]
        a = np.ascontiguousarray(r[:, f["location"] - 1:f["location"] - 1 + f["length"]])
        v = a.view(f"S{f['length']}").ravel().astype(np.float64)
        for c in f["invalid"]:
            v[v == c] = np.nan
        return v

    def lookup(self, lat, lon, radius_km):
        u = unit(lat, lon)
        dist = R_KM * np.arctan2(np.linalg.norm(np.cross(self.centre, u), axis=-1), self.centre @ u)
        cand = np.flatnonzero(dist <= PRP_CANDIDATE_KM)
        nearest = int(np.argmin(dist))
        out = {"nearest_idx": nearest, "nearest_km": float(dist[nearest]), "containing_idx": None,
               "within_idx": np.flatnonzero(dist <= radius_km)}
        if cand.size:
            v = np.stack([np.stack([self.column(f"tri{i}_{c}", cand) for c in "xyz"], -1)
                          for i in (1, 2, 3)], 1)                      # (n, 3 vertices, xyz) km
            s = [np.einsum("ij,j->i", np.cross(v[:, i], v[:, (i + 1) % 3]), u) for i in range(3)]
            inside = ((s[0] >= 0) & (s[1] >= 0) & (s[2] >= 0)) | ((s[0] <= 0) & (s[1] <= 0) & (s[2] <= 0))
            if inside.any():
                j = cand[np.flatnonzero(inside)]
                out["containing_idx"] = int(j[np.argmin(dist[j])])
        return out

    def triangle_area_km2(self, idx):
        v = np.stack([np.stack([self.column(f"tri{i}_{c}", [idx]) for c in "xyz"], -1)[0] for i in (1, 2, 3)])
        return float(np.linalg.norm(np.cross(v[1] - v[0], v[2] - v[0])) / 2)


SITE_THERMAL_NOTES = {
    "shackleton-rim-site04": [
        "Site-specific: annual maximum 319.6 K on a steep, intermittently lit inner wall; annual "
        "mean 112.5 K. AI plausibility check (not validation): a plane fitted to the 5 m DEM over "
        "the triangle's footprint slopes 32.1 deg facing azimuth 264 deg; with SPICE Sun positions "
        "for 2009-09-15..2010-09-14 and this site's horizon mask it is lit 10.2 % of the time "
        "(Sun-visibility map: 0.11) and the best incidence gives cos(i) = 0.554, a radiative "
        "equilibrium of 333 K (albedo 0.12, emissivity 0.95, 1361 W/m2). A sunward wall can be "
        "hot at its annual maximum while cold on average. Numbers accepted by Leo (S), 14 Nov 2026, "
        "as reported by ninja.",
    ],
}


def _k(v):
    return None if v is None or not np.isfinite(v) else round(float(v), 2)


def thermal_block(site, psr, hazards, prp=None):
    vals = []
    if site["id"] == "im-2-intended":
        h = next(x for x in hazards if x["id"] == "terrain_landing_outcomes")
        d = float(gc_distance_km(site["lat"], site["lon"], h["lat"], h["lon_east_180"]))
        vals.append({"value": "~100 K", "applies_to": (
            f"the ~20 m shadowed crater where IM-2 came to rest, {d:.2f} km from this site point; "
            "not the site itself"), "statement": h["properties"]["IM-2"], "evidence": h["evidence"],
            "source_url": h["source_url"]})
    named = ((psr.get("nearest_cluster") or {}).get("named_psr") or {}).get("lemelin2021")
    if named:
        vals.append({"value_K_min_max_mean": named["temp_K_min_max_mean"],
                     "applies_to": f"PSR '{named['name']}' (Lemelin et al. 2021), not the landing site",
                     "caveat": named["caveat"], "source_url": named["source_url"]})
    lim = [
        "Model-fit values from the first Diviner mapping year (Paige et al. 2010 method), per the label: "
        "temp_avg = annual average at 2 cm depth, temp_max = annual maximum at the surface.",
        "Not an annual minimum, not a time series and not a value for the mission dates: thermal "
        "stability over the mission period is NOT assessed.",
        "One mesh triangle (about 0.1-0.2 km2, Kaguya-derived DEM) is larger than the 100 m landing "
        "disk; sub-triangle slopes and shadows are averaged out.",
        "Frame: label says Moon-centered (planetocentric, east-positive, R = 1737.4 km); "
        "read as MOON_ME, confirmed by Leo (S) on 14 Nov 2026.",
        "temp_max_k minus temp_avg_k is not a temperature range (different depths and statistics); "
        "no range is given.",
        "The ice_depth column (model ice-stability depth) is not used; no ice is inferred.",
        "Sun visibility is not used as a temperature proxy.",
    ]
    lim += SITE_THERMAL_NOTES.get(site["id"], [])
    base = {"nearby_sourced_values": vals, "annual_min_temp_k": None,
            "annual_min_reason": "not provided by this product",
            "source": None, "method": None, "limitations": lim}
    if prp is None:
        return {**base, "status": "unknown", "reason": "Diviner PRP table not on disk",
                "temp_avg_k": None, "temp_max_k": None}
    fs = prp.spec["fields"]
    base["source"] = f"{DIVINER_CITATION}; {DIVINER_URL}{prp.tab_path.name if prp.tab_path else ''}"
    base["terms"] = DIVINER_TERMS
    base["method"] = (
        "site unit vector tested against the vertices of every mesh triangle whose centre is within "
        f"{PRP_CANDIDATE_KM:.0f} km (great circle, R = {R_KM} km); values of the containing triangle; "
        f"landing-disk statistics over triangle centres within {LANDING_RADIUS_M:.0f} m")
    base["columns"] = {n: {"unit": fs[n]["unit"], "description": fs[n]["description"]}
                       for n in ("temp_avg", "temp_max")}
    lk = prp.lookup(site["lat"], site["lon"], LANDING_RADIUS_M / 1000.0)
    ci = lk["containing_idx"]
    if ci is None:
        return {**base, "status": "unknown",
                "reason": f"site not inside any mesh triangle (nearest centre {lk['nearest_km']:.3f} km): outside the mesh",
                "nearest_triangle_centre_km": round(lk["nearest_km"], 3), "temp_avg_k": None, "temp_max_k": None}
    ta, tm = prp.column("temp_avg", [ci])[0], prp.column("temp_max", [ci])[0]
    clat, clon = prp.column("tri_clat", [ci])[0], prp.column("tri_clon", [ci])[0]
    out = {**base,
           "match": "mesh triangle containing the site",
           "triangle_centre_lat": round(float(clat), 5), "triangle_centre_lon": round(float(clon), 5),
           "distance_to_triangle_centre_km": round(float(gc_distance_km(site["lat"], site["lon"], clat, clon)), 3),
           "triangle_area_km2": round(prp.triangle_area_km2(ci), 4),
           "temp_avg_k": _k(ta), "temp_max_k": _k(tm)}
    missing = [n for n, v in (("temp_avg_k", ta), ("temp_max_k", tm)) if not np.isfinite(v)]
    if len(missing) == 2:
        out.update(status="unknown", reason="both temperature values are fill values in the containing triangle")
    else:
        out["status"] = "sourced"
        if missing:
            out["reason"] = f"{', '.join(missing)} is a fill value (null)"
    w = lk["within_idx"]
    land = {"radius_m": LANDING_RADIUS_M, "n_triangle_centres": int(w.size)}
    if w.size > 1:
        for name in ("temp_avg", "temp_max"):
            v = prp.column(name, w)
            v = v[np.isfinite(v)]
            land[f"{name}_k"] = ({"min": _k(v.min()), "median": _k(np.median(v)), "max": _k(v.max())}
                                 if v.size else None)
    else:
        land["note"] = ("mesh is coarser than the landing area: at most one triangle centre lies within "
                        f"{LANDING_RADIUS_M:.0f} m, so no landing-area statistics")
    out["landing_area"] = land
    return out


# ---------------------------------------------------------------- run

def sha_lookup(root):
    out = {}
    for f in [root / d / "SHA256SUMS.txt" for d in ("lola", "illumination", "diviner")]:
        if f.exists():
            for line in f.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    h, name = line.split()
                    out[name.lower()] = h
    return out


def label_version(path):
    p = Path(path)
    if p.suffix.lower() != ".lbl":
        return None
    for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.strip().startswith("PRODUCT_VERSION_ID"):
            return line.split("=")[1].strip().strip('"')
    return None


def build(root=None, sites=None):
    root = Path(root) if root else data_root()
    sites = sites if sites is not None else json.loads(SITES_JSON.read_text(encoding="utf-8"))
    dem20 = Raster(root / DEM20[0], DEM20[1])
    dem5 = Raster(root / DEM5[0], DEM5[1])
    illum = [Raster(root / p, r, crs_override=DEM_CRS if fix else None) for p, r, fix in ILLUM_MAPS]
    psr_items = json.loads((RESEARCH / "psr_and_ice.json").read_text(encoding="utf-8"))["items"]
    hazards = json.loads((RESEARCH / "hazards_and_science.json").read_text(encoding="utf-8"))["items"]
    shas = sha_lookup(root)
    tab = root / DIVINER_TAB
    prp = PRPMesh.from_files(tab) if tab.exists() else None

    out_sites = {}
    for s in sites:
        lat, lon = float(s["lat"]), float(s["lon"])
        dem, grid, notes = choose_dem(lat, lon, dem5, dem20)
        slope, rough = slope_and_roughness(lat, lon, dem, grid, notes)
        rough["sourced_hazards"] = sourced_hazards(s, hazards)
        psr = psr_block(lat, lon, illum, dem5, dem20, psr_items)
        thermal = thermal_block(s, psr, hazards, prp)
        out_sites[s["id"]] = {"slope": slope, "roughness": rough, "psr": psr, "thermal": thermal}
        nc = psr.get("nearest_cluster") or {}
        print(f"{s['id']}: dem {dem.res_m if dem else None} m, landing pass {slope['landing_slope_pass']}, "
              f"max {slope['landing_area'] and slope['landing_area'].get('max_slope_deg')} deg, "
              f"rms {rough['rms_height_m']} m, nearest shadow {nc.get('distance_km')} km, "
              f"T avg/max {thermal['temp_avg_k']}/{thermal['temp_max_k']} K ({thermal['status']})")

    files = []
    for p, res in [DEM20, DEM5] + [(p, r) for p, r, _ in ILLUM_MAPS]:
        fp = root / p
        data_name = fp.name if fp.suffix.lower() == ".tif" else fp.with_suffix(fp.suffix.replace("lbl", "img").replace("LBL", "IMG")).name
        files.append({"file": p, "pixel_m": res, "product_version": label_version(fp),
                      "sha256_data": shas.get(data_name.lower())})
    if prp is not None:
        files.append({"file": DIVINER_TAB, "pixel_m": None, "product_version": "LRO-L-DLRE-5-PRP-V2.0",
                      "sha256_data": shas.get("dlre_prp_south.tab"),
                      "note": "triangle mesh, 2,880,000 triangles, square to 80 S"})
    meta = {
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "generator": "scripts/assessments.py (AI-built)",
        "validation_status": ("code reviewed by Otto (Q) and numbers accepted by Leo (S), 14 Nov 2026, "
                              "as reported by ninja for commit 6650ed1; no written sign-off in the repo"),
        "frame": "MOON_ME planetocentric, east-positive longitude, sphere R = 1737.4 km",
        "files": files,
        "thresholds": {
            "landing_max_slope_deg": LANDING_MAX_DEG, "landing_rule": "<= 5.0 passes",
            "exploration_max_slope_deg": EXPLORATION_MAX_DEG, "exploration_rule": "< 20.0 meets",
            "status": CRITERIA_NOTE,
            "comparison_precision_deg": 10 ** -SLOPE_DECIMALS,
        },
        "parameters": {
            "landing_radius_m": LANDING_RADIUS_M, "exploration_radius_m": EXPLORATION_RADIUS_M,
            "nodata_max_pct": 100 * NODATA_MAX_FRACTION, "psr_min_cluster_area_km2": PSR_MIN_AREA_KM2,
            "psr_search_radius_km": PSR_SEARCH_KM, "line_5m_max_km": LINE_5M_MAX_KM,
            "status": "AI proposals; Leo decides",
        },
        "method_summary": [
            "slope: " + SLOPE_METHOD,
            "DEM: 5 m LOLA GDR where the 2 km disk lies inside it with <= 20 % nodata, else 20 m PGDA ADJ",
            "roughness: RMS height deviation from a least-squares plane over the 100 m landing disk",
            f"PSR: {SHADOW_WORDING}; finest map covering the site; " + ILLUM_CRS_NOTE,
            "thermal: Diviner PRP (model-fit annual mean at 2 cm depth and annual maximum surface temperature) "
            "of the mesh triangle containing the site; no minimum, no time series, mission-period stability not assessed",
        ],
        "status_values": {"computed": "derived here from the named raster", "sourced": "copied from a cited source",
                          "unknown": "data missing or insufficient; see reason"},
    }
    return {"meta": meta, "sites": out_sites}


def main():
    t0 = time.perf_counter()
    res = build()
    OUT_JSON.write_text(json.dumps(res, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_JSON} ({OUT_JSON.stat().st_size / 1024:.0f} KB, {len(res['sites'])} sites) in {time.perf_counter() - t0:.1f} s")


if __name__ == "__main__":
    main()
