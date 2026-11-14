"""Science checks of 14 Nov 2026: read-only analyses, evidence in docs/event/validation.md.

    python scripts/tools/sci_checks.py range [SITE ...]   # skyline at 150 km vs 300 km rays   (needs CLPS_DATA)
    python scripts/tools/sci_checks.py truncated [--fill ldem16|dem60s]  # truncated directions and bounds
                                                          # (--fill needs CLPS_DATA; dem60s = LDEM_60S_120MPP_ADJ.TIF)
    python scripts/tools/sci_checks.py v4                 # average sunlight vs AVGVISIB maps  (needs CLPS_DATA)

Reads app/public/data (sites, stations, ephemeris months, horizons) and never writes there. Horizons it
computes go to private/sci-horizons (git-ignored). Prints Markdown tables. Nothing here is a validation:
Leo (S) signs in validation.md.

Conventions are those of scripts/windows.py: a body is "lit"/"visible" when any part of its disc is above the
mask (el + angular radius > mask at its azimuth); a station counts when it is above the mask seen from the site
(as a point) and the site is at or above the station's minimum elevation.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import windows as geo  # noqa: E402
from config import APP_DATA, REPO  # noqa: E402

OUT_DIR = REPO / "private" / "sci-horizons"
LONG_START, LONG_END = "2027-01-01T00:00:00Z", "2031-01-01T00:00:00Z"  # four whole years of shipped months
YEAR_START, YEAR_END = "2027-01-01T00:00:00Z", "2028-01-01T00:00:00Z"
PERIOD_ID = "shackleton-2027-08"
RANGE_SITES = ["connecting-ridge", "malapert-massif", "leibnitz-beta-plateau"]
N_AZ = 720
BLOCKED_DEG = 90.0
SUN_MAPS = [("illumination/avgvisib_85s_060m_201608.lbl", 60.0, True),
            ("illumination/AVGVISIB_75S_120M_201608.LBL", 120.0, False)]
FILL_DEM60 = "LDEM_60S_120MPP_ADJ.TIF"  # PGDA product 90, 60-90 S at 120 m/px (downloaded 14 Nov 2026)
EARTH_MAPS = [("illumination/avgvisib_85s_060m_201608_earth.lbl", 60.0, True),
              ("illumination/AVGVISIB_75S_120M_201608_EARTH.LBL", 120.0, False)]


# ---------- shipped inputs ----------

def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_sites():
    return load_json(APP_DATA / "sites.json")


def load_horizon(site):
    return load_json(APP_DATA / "horizons" / site["horizon"])


def load_months():
    paths = sorted((APP_DATA / "ephem").glob("20[0-9][0-9]-[0-9][0-9].json"))
    return [geo.load_month(p) for p in paths]


def stack_months(months, start_iso, end_iso):
    """Stored 30-min samples in [start, end): times (ms), Sun and Earth vectors (km, MOON_ME). No interpolation."""
    t, sun, earth = [], [], []
    for m in months:
        n = m["n"] - 1  # the last sample is the next month's first
        t.append(geo.iso_to_ms(m["start_utc"]) + np.arange(n) * m["step_min"] * 60_000)
        sun.append(np.asarray(m["sun_km"][:n], dtype=float))
        earth.append(np.asarray(m["earth_km"][:n], dtype=float))
    t, sun, earth = np.concatenate(t), np.concatenate(sun), np.concatenate(earth)
    keep = (t >= geo.iso_to_ms(start_iso)) & (t < geo.iso_to_ms(end_iso))
    return t[keep], sun[keep], earth[keep]


# ---------- vector geometry (same formulas as windows.az_el / mask_at / disc_fraction) ----------

def az_el_r(body_km, site, radius_km):
    site_km = geo.site_vector(site["lat"], site["lon"], geo.site_height_km(site.get("elev_m")))
    east, north, up = geo.enu_basis(site["lat"], site["lon"])
    d = body_km - site_km
    dist = np.linalg.norm(d, axis=1)
    e, n, z = d @ east / dist, d @ north / dist, d @ up / dist
    az = np.degrees(np.arctan2(e, n)) % 360.0
    el = np.degrees(np.arctan2(z, np.hypot(e, n)))
    return az, el, np.degrees(np.arcsin(radius_km / dist))


def mask_at(mask, az):
    """Linear between the 0.5 deg samples, wrapping at 360 (windows.mask_at for arrays)."""
    mask = np.asarray(mask, dtype=float)
    x = (np.asarray(az, dtype=float) % 360.0) / (360.0 / len(mask))
    i0 = np.floor(x).astype(int)
    f = x - i0
    i0 %= len(mask)
    return mask[i0] + (mask[(i0 + 1) % len(mask)] - mask[i0]) * f


def disc_fraction(el, mask_deg, r):
    c = np.clip((mask_deg - el) / r, -1.0, 1.0)
    return (np.arccos(c) - c * np.sqrt(1 - c * c)) / np.pi


def body_series(site, t_sun_earth):
    _, sun_km, earth_km = t_sun_earth
    return {"sun": az_el_r(sun_km, site, geo.SUN_RADIUS_KM), "earth": az_el_r(earth_km, site, geo.EARTH_RADIUS_KM)}


def visible(body, mask):
    az, el, r = body
    return el + r > mask_at(mask, az)


def reach_bins(body, mask):
    """0.5 deg azimuth samples whose mask value decided at least one 'visible' sample of this body."""
    az, _, _ = body
    x = (az[visible(body, mask)] % 360.0) / (360.0 / N_AZ)
    bins = np.zeros(N_AZ, dtype=bool)
    i0 = np.floor(x).astype(int) % N_AZ
    bins[i0] = True
    bins[(i0 + 1) % N_AZ] = True
    return bins


def runs(bins, step=0.5):
    """Circular runs of True as [(az_from, az_to)], both inclusive."""
    bins = np.asarray(bins, dtype=bool)
    n = len(bins)
    if bins.all():
        return [(0.0, (n - 1) * step)]
    if not bins.any():
        return []
    start = int(np.argmin(bins))  # a False sample, so no run wraps past it
    out, cur = [], None
    for k in range(1, n + 1):
        i = (start + k) % n
        if bins[i] and cur is None:
            cur = i
        if not bins[i] and cur is not None:
            out.append((cur * step, ((i - 1) % n) * step))
            cur = None
    return out


def runs_text(bins):
    r = runs(bins)
    if not r:
        return "none"
    if len(r) > 3:
        return f"{len(r)} runs within {r[0][0]:g}–{r[-1][1]:g}°"
    return ", ".join(f"{a:g}–{b:g}°" for a, b in r)


def az_range(az):
    """Smallest circular interval containing every azimuth: (from, to) clockwise, deg."""
    a = np.sort(np.asarray(az) % 360.0)
    gaps = np.diff(np.concatenate([a, [a[0] + 360.0]]))
    k = int(np.argmax(gaps))
    return float(a[(k + 1) % len(a)]), float(a[k])


def blocked(horizon):
    """The shipped mask with every truncated direction closed: the lowest sky a complete horizon could leave."""
    mask = np.array(horizon["mask"], dtype=float)
    mask[trunc_bins(horizon)] = BLOCKED_DEG
    return mask


def trunc_bins(horizon):
    bins = np.zeros(N_AZ, dtype=bool)
    bins[(np.asarray(horizon["truncated"]) / horizon["az_step"]).round().astype(int)] = True
    return bins


# ---------- one period at 1-minute steps, through the reference code ----------

def period_samples(site, months, stations, start_ms, end_ms, step_ms=60_000):
    """Az/el of Sun, Earth and each station from windows.interpolate + windows.sample (flat horizon: only the
    directions are used; masks are applied afterwards so several masks can share one pass)."""
    rows = []
    for t in range(start_ms, end_ms, step_ms):
        s = geo.sample(geo.interpolate(months, t), site, None, stations)
        row = [s["sun"]["az"], s["sun"]["el"], geo.ang_radius_deg(geo.SUN_RADIUS_KM, s["sun"]["dist_km"]),
               s["earth"]["az"], s["earth"]["el"], geo.ang_radius_deg(geo.EARTH_RADIUS_KM, s["earth"]["dist_km"])]
        for st in stations:
            r = s["stations"][st["id"]]
            row += [r["az"], r["el"], r["moonElAtStation"]]
        rows.append(row)
    a = np.array(rows)
    return {"sun": (a[:, 0], a[:, 1], a[:, 2]), "earth": (a[:, 3], a[:, 4], a[:, 5]),
            "stations": [(a[:, 6 + 3 * k], a[:, 7 + 3 * k], a[:, 8 + 3 * k]) for k in range(len(stations))]}


def period_states(samples, stations, mask):
    """Boolean arrays lit / Earth visible / covered (any station in line of sight) for one mask."""
    cov = np.zeros(len(samples["sun"][0]), dtype=bool)
    for st, (az, el, moon_el) in zip(stations, samples["stations"]):
        cov |= (el > mask_at(mask, az)) & (moon_el >= st["min_elev_deg"])
    return {"lit": visible(samples["sun"], mask), "earth": visible(samples["earth"], mask), "cov": cov}


def pct(flags):
    return 100.0 * float(np.mean(flags))


# ---------- raw-data helpers (imported lazily: need rasterio and CLPS_DATA) ----------

def horizon_at(site, ray_max_km, fill=None):
    """horizon.py's own compute_horizon at another ray length (constant untouched), optionally with samples
    outside the polar DEM taken from the global 16 px/deg LOLA grid instead of stopping the ray."""
    import rasterio

    import horizon as hz
    from config import data_root

    with rasterio.Env(GDAL_CACHEMAX=256):
        with rasterio.open(data_root() / "lola" / hz.DEM_NAME) as ds:
            near, far, crs = hz.load_grids(ds, site["lat"], site["lon"], ray_max_km)
    label = hz.DEM_LABEL
    if fill is not None:
        near, far = _FillGrid(near, crs, fill), _FillGrid(far, crs, fill)
        label += "; outside that DEM: " + fill.label
    return hz.compute_horizon(site["id"], float(site["lat"]), float(site["lon"]), near, far, crs,
                              ray_max_km=ray_max_km, dem_label=label)


class _FillGrid:
    def __init__(self, grid, crs, fill):
        from pyproj import CRS, Transformer
        self.grid, self.fill = grid, fill
        self.to_ll = Transformer.from_crs(CRS(crs), CRS(crs).geodetic_crs, always_xy=True)

    def sample(self, x, y):
        x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
        h = self.grid.sample(x, y)
        bad = ~np.isfinite(h)
        if bad.any():
            lon, lat = self.to_ll.transform(x[bad], y[bad])
            h[bad] = self.fill.at(lat, lon)
        return h


class _PolarFill:
    """Heights from the wider south-polar DEM of the same product (60-90 S, 120 m/px): one full-resolution
    window per site, covering every sample its rays need, read with horizon.py's own window code."""
    name = "dem60s"
    label = FILL_DEM60 + " (PGDA product 90, Barker et al. 2023; 120 m/px, bilinear)"

    def __init__(self, path, site, ray_max_km):
        import rasterio
        from pyproj import CRS, Transformer

        import horizon as hz

        with rasterio.Env(GDAL_CACHEMAX=256):
            with rasterio.open(path) as ds:
                _, self.grid, crs = hz.load_grids(ds, site["lat"], site["lon"], ray_max_km)
        self.to_xy = Transformer.from_crs(CRS(crs).geodetic_crs, CRS(crs), always_xy=True)

    def at(self, lat, lon):
        x, y = self.to_xy.transform(lon, lat)
        return self.grid.sample(np.asarray(x, dtype=float), np.asarray(y, dtype=float))


def make_fill(kind, site=None, ray_max_km=None, _cache={}):
    """'ldem16': the global 16 px/deg grid (one object for all sites); 'dem60s': a window of the 60 S DEM."""
    from config import data_root
    if kind == "dem60s":
        return _PolarFill(data_root() / "lola" / FILL_DEM60, site, ray_max_km)
    if "ldem16" not in _cache:
        from terrain_tiles import FILL_NAME, Ldem16
        f = Ldem16(data_root() / "textures" / FILL_NAME)
        f.name = "ldem16"
        f.label = "global ldem_16_uint.tif (16 px/deg, encoding inferred in terrain_tiles.py)"
        _cache["ldem16"] = f
    return _cache["ldem16"]


def write_private(name, horizon):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / name).write_text(json.dumps(horizon, separators=(",", ":")) + "\n", encoding="utf-8")


def outside_margin(site, hor, fill):
    """Per truncated direction: shipped mask minus the highest elevation angle that terrain beyond the polar
    DEM's edge reaches in the global 16 px/deg grid (same ray samples and angle formula as horizon.py).
    Positive = that terrain stays below our skyline. Returns an array over all 720 directions (NaN = complete)."""
    import rasterio
    from pyproj import CRS, Transformer

    import horizon as hz
    from config import data_root

    with rasterio.open(data_root() / "lola" / hz.DEM_NAME) as ds:
        b, crs = ds.bounds, CRS.from_wkt(ds.crs.to_wkt())
    to_xy = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
    tb = trunc_bins(hor)
    p = hz.ray_points(site["lat"], site["lon"], np.flatnonzero(tb) * hor["az_step"],
                      hz.ray_distances_km(float(hor["ray_max_km"])))
    la, lo = hz.to_latlon(p)
    x, y = to_xy.transform(lo, la)
    outside = (x <= b.left) | (x >= b.right) | (y <= b.bottom) | (y >= b.top)
    up = hz.unit(site["lat"], site["lon"])
    v = (hz.R_KM + fill.at(la, lo)[..., None] / 1000.0) * p \
        - (hz.R_KM + (hor["elev_m"] + hor["observer_height_m"]) / 1000.0) * up
    ang = np.degrees(np.arcsin(np.clip((v @ up) / np.linalg.norm(v, axis=-1), -1, 1)))
    out = np.full(N_AZ, np.nan)
    out[tb] = np.array(hor["mask"])[tb] - np.where(outside, ang, -np.inf).max(axis=1)
    return out


def map_value(rasters, lat, lon):
    """Value of the finest map covering the point: (centre pixel, min, max of the 3 x 3 pixels, res_m)."""
    from rasterio.windows import Window
    for r in rasters:
        if not r.contains(lat, lon):
            continue
        row, col = r.ds.index(*r.xy(lat, lon))
        a = r.ds.read(1, window=Window(col - 1, row - 1, 3, 3)).astype(float)
        a[a == r.ds.nodata] = np.nan
        a *= 100.0 * r.scale
        return float(a[1, 1]), float(np.nanmin(a)), float(np.nanmax(a)), r.res_m
    return None


# ---------- commands ----------

def cmd_range(site_ids):
    sites = {s["id"]: s for s in load_sites()}
    months = load_months()
    long_t = stack_months(months, LONG_START, LONG_END)
    print("| Site | Largest skyline difference (300 km − 150 km) | at azimuth | 300 km skyline there: height / distance "
          "| Sun can reach that azimuth | Earth can reach it | Largest difference where the Sun / Earth can reach "
          "| Directions differing > 0.01° | Lit % 150 → 300 km | Earth visible % 150 → 300 km |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for sid in site_ids:
        site = sites[sid]
        h150, h300 = horizon_at(site, 150.0), horizon_at(site, 300.0)
        write_private(f"{sid}-150km.json", h150)
        write_private(f"{sid}-300km.json", h300)
        same = h300["mask"] == load_horizon(site)["mask"]
        m150, m300 = np.array(h150["mask"]), np.array(h300["mask"])
        d = m300 - m150
        i = int(np.argmax(np.abs(d)))
        bodies = body_series(site, long_t)
        low = np.minimum(m150, m300)
        sun_b, earth_b = reach_bins(bodies["sun"], low), reach_bins(bodies["earth"], low)

        def worst(bins):
            if not bins.any():
                return "never up"
            if not np.abs(d[bins]).max() > 0:
                return "none"
            return f"{np.abs(d[bins]).max():.4f}° at {np.argmax(np.abs(d) * bins) * 0.5:g}°"

        where = (f"{i * 0.5:g}° | {m300[i]:.4f}° / {h300['mask_dist_km'][i]:.1f} km "
                 f"| {'yes' if sun_b[i] else 'no'} | {'yes' if earth_b[i] else 'no'}") if d[i] else "– | – | – | –"
        print(f"| {sid} | {d[i]:+.4f}° | {where} "
              f"| {worst(sun_b)} / {worst(earth_b)} | {int(np.sum(np.abs(d) > 0.01))} of 720 "
              f"| {pct(visible(bodies['sun'], m150)):.2f} → {pct(visible(bodies['sun'], m300)):.2f} "
              f"| {pct(visible(bodies['earth'], m150)):.2f} → {pct(visible(bodies['earth'], m300)):.2f} |")
        print(f"<!-- {sid}: 300 km mask equals shipped file: {same}; truncated 150 km {len(h150['truncated'])}, "
              f"300 km {len(h300['truncated'])}; min difference {d.min():+.4f}; Sun reach {runs_text(sun_b)}; "
              f"Earth reach {runs_text(earth_b)} -->")


def cmd_truncated(fill):
    sites = load_sites()
    stations = load_json(APP_DATA / "stations.json")
    months = load_months()
    period = next(p for p in load_json(APP_DATA / "periods.json") if p["id"] == PERIOD_ID)
    p0, p1 = geo.iso_to_ms(period["start_utc"]), geo.iso_to_ms(period["end_utc"])
    long_t = stack_months(months, LONG_START, LONG_END)
    notes = []

    head = ("| Site | Truncated of 720 | Truncated azimuths | Earth centre azimuth range | Earth-visible directions "
            "truncated | Sun-lit directions truncated | Earth visible %: shipped / filled / all closed "
            "| Coverage %: shipped / filled / all closed | Lit %: shipped / filled / all closed "
            "| Upper bound of overstatement (points): Earth / coverage / lit "
            "| Terrain beyond the DEM edge stays below our skyline by at least: all truncated / Earth-visible directions |")
    print(head)
    print("|" + "---|" * head.count("|", 1))
    for site in sorted(sites, key=lambda s: -len(load_horizon(s)["truncated"])):
        hor = load_horizon(site)
        mask, tb = np.array(hor["mask"]), trunc_bins(hor)
        bodies = body_series(site, long_t)
        sun_b, earth_b = reach_bins(bodies["sun"], mask), reach_bins(bodies["earth"], mask)
        e0, e1 = az_range(bodies["earth"][0])
        smp = period_samples(site, months, stations, p0, p1)
        a = period_states(smp, stations, mask)
        b = period_states(smp, stations, blocked(hor))
        c, margin = None, "– / –"
        if fill:
            filler = make_fill(fill, site, float(hor["ray_max_km"]))
            mg = outside_margin(site, hor, filler)
            margin = (f"{np.nanmin(mg):+.2f}°" if tb.any() else "–") + " / " + \
                     (f"{np.nanmin(mg[earth_b & tb]):+.2f}°" if (earth_b & tb).any() else "–")
            hf = horizon_at(site, float(hor["ray_max_km"]), fill=filler)
            write_private(f"{site['id']}-{filler.name}fill.json", hf)
            mf = np.array(hf["mask"])
            c = period_states(smp, stations, mf)
            d = mf - mask
            j = int(np.argmax(d))
            notes.append(
                f"<!-- {site['id']}: {filler.name} fill leaves {len(hf['truncated'])} truncated; raises "
                f"{int(np.sum(d > 0.01))} directions by > 0.01 deg ({runs_text(d > 0.01)}), most {d[j]:+.4f} at "
                f"{j * 0.5:g} deg (skyline then at {hf['mask_dist_km'][j]:.1f} km); lowers {int(np.sum(d < -1e-9))}; "
                f"raised Earth-visible directions {int(np.sum((d > 0.01) & earth_b))}, Sun-lit {int(np.sum((d > 0.01) & sun_b))}; "
                f"2027-2030 lit % {pct(visible(bodies['sun'], mask)):.2f} -> {pct(visible(bodies['sun'], mf)):.2f}, "
                f"Earth % {pct(visible(bodies['earth'], mask)):.2f} -> {pct(visible(bodies['earth'], mf)):.2f} -->")

        def three(k):
            mid = f"{pct(c[k]):.1f}" if c else "–"
            return f"{pct(a[k]):.1f} / {mid} / {pct(b[k]):.1f}"

        def share(bins):
            return f"{int(np.sum(bins & tb))} of {int(np.sum(bins))}" if bins.any() else "never up"

        print(f"| {site['id']} | {len(hor['truncated'])} | {runs_text(tb)} | {e0:.1f}–{e1:.1f}° | {share(earth_b)} "
              f"| {share(sun_b)} | {three('earth')} | {three('cov')} | {three('lit')} "
              f"| {pct(a['earth']) - pct(b['earth']):.1f} / {pct(a['cov']) - pct(b['cov']):.1f} "
              f"/ {pct(a['lit']) - pct(b['lit']):.1f} | {margin} |")
    print("\n".join(notes))


def cmd_v4():
    from assessments import DEM_CRS, Raster
    from config import data_root
    root = data_root()

    def open_maps(maps):
        return [Raster(root / p, res, crs_override=DEM_CRS if fix else None) for p, res, fix in maps]

    sun_maps, earth_maps = open_maps(SUN_MAPS), open_maps(EARTH_MAPS)
    months = load_months()
    long_t = stack_months(months, LONG_START, LONG_END)
    year_t = stack_months(months, YEAR_START, YEAR_END)
    print("| Site | Ours 2027–2030, lit % | Ours 2027 only | Ours, mean visible disc % | Map % (pixel) | Map, 3 × 3 pixels "
          "| Map | 120 m map % | Difference, ours − map (points) | Earth: ours 2027–2030 % | Earth: map % (pixel) "
          "| Earth: map, 3 × 3 pixels | Earth: difference |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    rows, inside, e_rows, e_inside = [], [], [], []
    for site in load_sites():
        mask = np.array(load_horizon(site)["mask"])
        b4, b1 = body_series(site, long_t), body_series(site, year_t)
        az, el, r = b4["sun"]
        ours, ours_1y = pct(visible(b4["sun"], mask)), pct(visible(b1["sun"], mask))
        frac = 100.0 * float(np.mean(disc_fraction(el, mask_at(mask, az), r)))
        m = map_value(sun_maps, site["lat"], site["lon"])
        m120 = map_value(sun_maps[1:], site["lat"], site["lon"])
        e_ours = pct(visible(b4["earth"], mask))
        e_map = map_value(earth_maps, site["lat"], site["lon"])
        rows.append((ours, m[0]))
        e_rows.append((e_ours, e_map[0]))
        if not m[1] <= ours <= m[2]:
            inside.append(site["id"])
        if not e_map[1] <= e_ours <= e_map[2]:
            e_inside.append(site["id"])
        print(f"| {site['id']} | {ours:.1f} | {ours_1y:.1f} | {frac:.1f} | {m[0]:.1f} | {m[1]:.1f}–{m[2]:.1f} "
              f"| {m[3]:g} m | {m120[0]:.1f} | {ours - m[0]:+.1f} | {e_ours:.1f} | {e_map[0]:.1f} "
              f"| {e_map[1]:.1f}–{e_map[2]:.1f} | {e_ours - e_map[0]:+.1f} |")
    o, p = np.array(rows).T
    d = o - p
    print(f"<!-- n {len(d)}; mean difference {d.mean():+.2f}; mean |difference| {np.abs(d).mean():.2f}; "
          f"max |difference| {np.abs(d).max():.2f}; r {np.corrcoef(o, p)[0, 1]:.3f}; "
          f"sites with |difference| > 15: {int(np.sum(np.abs(d) > 15))}; ours higher at {int(np.sum(d > 0))}; "
          f"ours outside the 3 x 3 pixel range: {inside} -->")
    eo, ep = np.array(e_rows).T
    ed = eo - ep
    print(f"<!-- Earth: mean difference {ed.mean():+.2f}; mean |difference| {np.abs(ed).mean():.2f}; "
          f"max |difference| {np.abs(ed).max():.2f}; r {np.corrcoef(eo, ep)[0, 1]:.3f}; "
          f"ours outside the 3 x 3 pixel range: {e_inside} -->")
    # the 60 m maps read as their label says (lon_0 = 180), for Leo's open question on the projection
    labelled = open_maps([(SUN_MAPS[0][0], 60.0, False)])
    pairs = [(pct(visible(body_series(s, long_t)["sun"], np.array(load_horizon(s)["mask"]))),
              map_value(labelled, s["lat"], s["lon"])) for s in load_sites()]
    pairs = np.array([(a, v[0]) for a, v in pairs if v and math.isfinite(v[0])])
    print(f"<!-- 60 m map read with the label's lon_0 = 180: n {len(pairs)}, "
          f"r {np.corrcoef(pairs[:, 0], pairs[:, 1])[0, 1]:.3f} -->")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("range").add_argument("sites", nargs="*", default=RANGE_SITES)
    sub.add_parser("truncated").add_argument("--fill", choices=["ldem16", "dem60s"],
                                             help="also fill beyond the 80 S DEM from the global 16 px/deg grid "
                                                  "or from the 60 S DEM")
    sub.add_parser("v4")
    args = ap.parse_args(argv)
    if args.cmd == "range":
        cmd_range(args.sites)
    elif args.cmd == "truncated":
        cmd_truncated(args.fill)
    else:
        cmd_v4()


if __name__ == "__main__":
    main()
