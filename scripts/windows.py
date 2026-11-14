"""Python reference geometry (build-plan §4.4, Brief A). Mirrors app/src/geometry/index.ts line for line.

Used by ephemeris.py (--site tables for Leo), export_fixtures.py (T9 fixtures) and the tests. The app never
runs this file; the TypeScript code must reproduce it to 1e-6 deg (T9).

Conventions: MOON_ME planetocentric, east-positive longitude, 1737.4 km sphere; degrees, km (metres only in
names ending _m), UTC. Azimuth 0 = north, clockwise. Local frame: up = unit(lat, lon), east = unit(z x up),
north = up x east.
"""
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

MOON_RADIUS_KM = 1737.4
OBSERVER_HEIGHT_M = 1.75  # spec.md, 14 Nov (build plan's 2 m superseded)

# Disc radii for the visible-fraction rule. Sun: IAU 2015 Resolution B3 nominal solar radius
# (https://www.iau.org/static/resolutions/IAU2015_English.pdf). Earth: mean radius 6371.0 km as used in
# build-plan §4.4 for Earth's 0.90-1.02 deg angular radius.
SUN_RADIUS_KM = 695700.0
EARTH_RADIUS_KM = 6371.0

# Station ellipsoid: WGS 84 (NGA TR8350.2, https://earth-info.nga.mil/php/download.php?file=coord-wgs84).
# GRS 80 / ITRF coordinates differ from WGS 84 in the flattening by 1e-11, i.e. < 0.1 mm at the surface.
WGS84_A_KM = 6378.137
WGS84_F = 1.0 / 298.257223563


# ---------- vectors ----------

def unit(v):
    v = np.asarray(v, dtype=float)
    return v / np.linalg.norm(v)


def quat_to_matrix(q):
    """(x, y, z, w) Hamilton unit quaternion -> 3x3 matrix M with M @ v = q v q*. Normalises first."""
    x, y, z, w = (float(c) for c in q)
    n = math.sqrt(x * x + y * y + z * z + w * w)
    x, y, z, w = x / n, y / n, z / n, w / n
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


# ---------- ephemeris months (the shipped JSON) and interpolation ----------

def iso_to_ms(iso):
    return int(round(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000))


def ms_to_iso(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_month(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _lerp3(a, b, f):
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]


def slerp(a, b, f):
    """Same algorithm and thresholds as geometry/index.ts slerp()."""
    d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
    bb = b
    if d < 0:
        d = -d
        bb = [-b[0], -b[1], -b[2], -b[3]]
    if d > 0.9995:
        wa, wb = 1 - f, f
    else:
        th = math.acos(d)
        s = math.sin(th)
        wa = math.sin((1 - f) * th) / s
        wb = math.sin(f * th) / s
    q = [wa * a[i] + wb * bb[i] for i in range(4)]
    n = math.sqrt(q[0] ** 2 + q[1] ** 2 + q[2] ** 2 + q[3] ** 2)
    return [c / n for c in q]


def qmul(a, b):
    """Hamilton product a * b for (x, y, z, w); R(a * b) = R(a) @ R(b)."""
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ]


def qconj(q):
    return [-q[0], -q[1], -q[2], q[3]]


def _state_between(m0, i0, m1, i1, f, utc_ms):
    qj0, qj1 = m0["q_me_to_j2000"][i0], m1["q_me_to_j2000"][i1]
    q_me_to_j2000 = slerp(qj0, qj1, f)
    # IAU_EARTH -> MOON_ME combines Earth's spin and the Moon's rotation about different axes; a plain slerp of
    # it errs by ~0.002 deg mid-step. Slerp IAU_EARTH -> J2000 (a near-uniform spin about one axis) instead,
    # then recompose with the interpolated MOON_ME -> J2000. Exact at the samples.
    qe0 = qmul(qj0, m0["q_earth_to_me"][i0])
    qe1 = qmul(qj1, m1["q_earth_to_me"][i1])
    q = qmul(qconj(q_me_to_j2000), slerp(qe0, qe1, f))
    n = math.sqrt(q[0] ** 2 + q[1] ** 2 + q[2] ** 2 + q[3] ** 2)
    return {
        "utcMs": utc_ms,
        "sun_km": _lerp3(m0["sun_km"][i0], m1["sun_km"][i1], f),
        "earth_km": _lerp3(m0["earth_km"][i0], m1["earth_km"][i1], f),
        "q_me_to_j2000": q_me_to_j2000,
        "q_earth_to_me": [c / n for c in q],
    }


def interpolate(months, utc_ms):
    """Vectors linear, quaternions slerp; spans month boundaries. Mirrors geometry/index.ts interpolate()."""
    srt = sorted(months, key=lambda m: iso_to_ms(m["start_utc"]))
    for j, m in enumerate(srt):
        t0 = iso_to_ms(m["start_utc"])
        step = m["step_min"] * 60_000
        x = (utc_ms - t0) / step
        if x < 0:
            break
        i = math.floor(x)
        if i < m["n"] - 1:
            return _state_between(m, i, m, i + 1, x - i, utc_ms)
        if i == m["n"] - 1:
            if x == i:
                return _state_between(m, i, m, i, 0.0, utc_ms)
            nxt = srt[j + 1] if j + 1 < len(srt) else None
            if nxt and iso_to_ms(nxt["start_utc"]) == t0 + m["n"] * step:
                return _state_between(m, i, nxt, 0, x - i, utc_ms)
    raise ValueError(f"interpolate: {ms_to_iso(utc_ms)} is outside the loaded ephemeris months")


# ---------- site frame ----------

def site_vector(lat_deg, lon_deg, h_km):
    """(1737.4 + h_km) * unit(lat, lon) in MOON_ME, km."""
    r = MOON_RADIUS_KM + h_km
    la, lo = math.radians(lat_deg), math.radians(lon_deg)
    return np.array([r * math.cos(la) * math.cos(lo), r * math.cos(la) * math.sin(lo), r * math.sin(la)])


def site_height_km(elev_m):
    """Observer eye height above the 1737.4 km sphere: terrain height (None -> 0) + 1.75 m."""
    return ((elev_m or 0.0) + OBSERVER_HEIGHT_M) / 1000.0


def enu_basis(lat_deg, lon_deg):
    if abs(lat_deg) >= 90:
        raise ValueError("enu_basis: undefined at the exact pole")
    up = unit(site_vector(lat_deg, lon_deg, 0.0))
    east = unit(np.cross([0.0, 0.0, 1.0], up))
    north = np.cross(up, east)
    return east, north, up


def az_el(body_km, site_km, enu):
    """Topocentric direction body - site rotated into ENU -> (az, el, dist_km)."""
    east, north, up = enu
    d = np.asarray(body_km, dtype=float) - np.asarray(site_km, dtype=float)
    dist = float(np.linalg.norm(d))
    u = d / dist
    e, n, z = float(u @ east), float(u @ north), float(u @ up)
    az = math.degrees(math.atan2(e, n))
    if az < 0:
        az += 360.0
    el = math.degrees(math.atan2(z, math.hypot(e, n)))  # atan2: well conditioned at the zenith too
    return az, el, dist


def ang_radius_deg(radius_km, dist_km):
    return math.degrees(math.asin(radius_km / dist_km))


# ---------- horizon and discs ----------

def flat_dip_deg():
    """Horizon dip of a 1.75 m eye on a smooth 1737.4 km sphere: -acos(R / (R + h)) = -0.0813 deg."""
    return -math.degrees(math.acos(MOON_RADIUS_KM / (MOON_RADIUS_KM + OBSERVER_HEIGHT_M / 1000.0)))


def mask_at(horizon, az_deg):
    """Terrain mask at an azimuth, linear between az_step samples; None -> flat-sphere dip."""
    if horizon is None:
        return flat_dip_deg()
    mask = horizon["mask"]
    n = len(mask)
    x = (az_deg % 360.0) / horizon["az_step"]
    i0 = math.floor(x)
    f = x - i0
    i0 %= n
    i1 = (i0 + 1) % n
    return mask[i0] + (mask[i1] - mask[i0]) * f


def disc_fraction(el_deg, mask_deg, ang_radius_deg_):
    """Visible share (0..1) of a disc centred el above a straight horizon at mask (circular segment)."""
    c = (mask_deg - el_deg) / ang_radius_deg_
    if c <= -1:
        return 1.0
    if c >= 1:
        return 0.0
    return (math.acos(c) - c * math.sqrt(1 - c * c)) / math.pi


# ---------- Earth stations ----------

def geodetic_to_ecef_km(lat_deg, lon_deg, h_m):
    """WGS 84 geodetic -> Earth-fixed Cartesian, km."""
    la, lo = math.radians(lat_deg), math.radians(lon_deg)
    e2 = WGS84_F * (2 - WGS84_F)
    sl = math.sin(la)
    n = WGS84_A_KM / math.sqrt(1 - e2 * sl * sl)
    h = h_m / 1000.0
    return np.array([
        (n + h) * math.cos(la) * math.cos(lo),
        (n + h) * math.cos(la) * math.sin(lo),
        (n * (1 - e2) + h) * sl,
    ])


def geodetic_up(lat_deg, lon_deg):
    la, lo = math.radians(lat_deg), math.radians(lon_deg)
    return np.array([math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)])


def station_me_km(station, state):
    """Station in MOON_ME: earth_km + R(q_earth_to_me) . s_earthfixed (Brief A trap 6; IAU_EARTH approximates
    the terrestrial frame)."""
    r = quat_to_matrix(state["q_earth_to_me"])
    s_ef = geodetic_to_ecef_km(station["lat_deg"], station["lon_deg"], station["h_m"])
    return np.asarray(state["earth_km"], dtype=float) + r @ s_ef


def moon_el_at_station(station, site_km, state):
    """Elevation of the lunar site above the station's geodetic horizon, deg (reverse of the LT+S geometry)."""
    r = quat_to_matrix(state["q_earth_to_me"])
    v_ef = r.T @ (np.asarray(site_km, dtype=float) - np.asarray(state["earth_km"], dtype=float))
    s_ef = geodetic_to_ecef_km(station["lat_deg"], station["lon_deg"], station["h_m"])
    d = unit(v_ef - s_ef)
    up = geodetic_up(station["lat_deg"], station["lon_deg"])
    return math.degrees(math.atan2(float(d @ up), float(np.linalg.norm(np.cross(d, up)))))


def station_los(station, site, state, horizon):
    """Both ends (Brief A trap 7): station above the terrain mask seen from the site (site vector subtracted)
    AND the site at or above the station's min_elev_deg. Terrain is reported first when both fail."""
    site_km = site_vector(site["lat"], site["lon"], site_height_km(site.get("elev_m")))
    enu = enu_basis(site["lat"], site["lon"])
    az, el, _ = az_el(station_me_km(station, state), site_km, enu)
    moon_el = moon_el_at_station(station, site_km, state)
    terrain_ok = el > mask_at(horizon, az)
    station_ok = moon_el >= station["min_elev_deg"]
    reason = None if terrain_ok and station_ok else ("terrain" if not terrain_ok else "station-mask")
    return {"az": az, "el": el, "moonElAtStation": moon_el,
            "state": "los" if reason is None else "blocked", "reason": reason}


# ---------- one sample (mirrors computeSeries' per-sample body) ----------

def sample(state, site, horizon, stations):
    site_km = site_vector(site["lat"], site["lon"], site_height_km(site.get("elev_m")))
    enu = enu_basis(site["lat"], site["lon"])
    out = {"utcMs": state["utcMs"]}
    for key, body, radius, flag in (("sun", "sun_km", SUN_RADIUS_KM, "lit"),
                                    ("earth", "earth_km", EARTH_RADIUS_KM, "visible")):
        az, el, dist = az_el(state[body], site_km, enu)
        m = mask_at(horizon, az)
        frac = disc_fraction(el, m, ang_radius_deg(radius, dist))
        out[key] = {"az": az, "el": el, "dist_km": dist, "mask": m, "frac": frac, flag: frac > 0}
    out["stations"] = {s["id"]: station_los(s, site, state, horizon) for s in stations}
    return out


def coverage_state(sample_, station_ids):
    """Union over the selected stations: 'covered' if any is in line of sight; 'unknown' only where a selected
    station has no result (missing input); else 'none'."""
    any_missing = False
    for sid in station_ids:
        r = sample_["stations"].get(sid)
        if r is None:
            any_missing = True
        elif r["state"] == "los":
            return "covered"
    return "unknown" if any_missing else "none"


def union_intervals(intervals):
    """Merge [start, end) intervals so overlapping station windows are never counted twice."""
    out = []
    for a, b in sorted(intervals):
        if out and a <= out[-1][1]:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return [tuple(x) for x in out]


def total_length(intervals):
    return sum(b - a for a, b in union_intervals(intervals))


# ---------- windows and summaries (mirrors geometry/index.ts computeWindows / summarize) ----------
# Python reference for V5/V8 (review 14 Nov: the build plan's edge refinement existed only in TypeScript).
# State scanned every 1 min (5 min for spans over 31 days, never coarser than the ephemeris step) on the
# interpolated ephemeris; each change is bisected to EDGE_TOL_MS; the edge is the midpoint of the last bracket.
# Events shorter than the scan step can be missed, exactly as in the app.

HOUR_MS = 3_600_000
SCAN_FINE_MS = 60_000
SCAN_COARSE_MS = 5 * 60_000
EDGE_TOL_MS = 10_000


def _js_round(x):
    """Math.round for the positive millisecond values used here (Python's round() rounds half to even)."""
    return math.floor(x + 0.5)


def state_at(kind, months, site, horizon, stations, station_ids, utc_ms):
    """'lit'/'dark', 'visible'/'hidden' or 'covered'/'none'/'unknown' at one instant."""
    state = interpolate(months, utc_ms)
    if kind == "coverage":
        selected = [s for s in stations if s["id"] in station_ids]
        return coverage_state(sample(state, site, horizon, selected), station_ids)
    smp = sample(state, site, horizon, [])
    if kind == "sun":
        return "lit" if smp["sun"]["lit"] else "dark"
    if kind == "earth":
        return "visible" if smp["earth"]["visible"] else "hidden"
    raise ValueError(kind)


def windows(months, site, horizon, stations, kind, station_ids, start_ms, end_ms, step_min=30):
    """Contiguous [start, end) runs of one state, clipped to [start_ms, end_ms). Same algorithm and constants
    as the app (geometry/index.ts computeWindows with months), so edges agree to about EDGE_TOL_MS."""
    def f(t):
        return state_at(kind, months, site, horizon, stations, station_ids, t)

    fine = end_ms - start_ms <= 31 * 24 * HOUR_MS
    scan = min(step_min * 60_000, SCAN_FINE_MS if fine else SCAN_COARSE_MS)
    times = []
    k = 0
    while start_ms + k * scan < end_ms:
        times.append(start_ms + k * scan)
        k += 1
    if not times:
        return []
    states = [f(t) for t in times]
    out = []
    cur, start = states[0], times[0]
    for k in range(1, len(states)):
        if states[k] == cur:
            continue
        lo, hi, a = times[k - 1], times[k], states[k - 1]
        while hi - lo > EDGE_TOL_MS:
            mid = lo + (hi - lo) / 2
            if f(mid) == a:
                lo = mid
            else:
                hi = mid
        edge = _js_round(lo + (hi - lo) / 2)
        out.append({"kind": kind, "startMs": start, "endMs": edge, "state": cur})
        start, cur = edge, states[k]
    out.append({"kind": kind, "startMs": start, "endMs": end_ms, "state": cur})
    return out


def summarize(sun_ws, earth_ws, cov_ws, start_ms, end_ms):
    """Time-weighted percentages and longest runs (hours) over [start_ms, end_ms), as summarize() in the app."""
    total = end_ms - start_ms

    def pct(ws, state):
        return 100 * sum(w["endMs"] - w["startMs"] for w in ws if w["state"] == state) / total

    def longest(ws, state):
        return max([(w["endMs"] - w["startMs"]) / HOUR_MS for w in ws if w["state"] == state], default=0.0)

    return {
        "litPct": pct(sun_ws, "lit"),
        "earthVisiblePct": pct(earth_ws, "visible"),
        "coveragePct": pct(cov_ws, "covered"),
        "unknownPct": pct(cov_ws, "unknown"),
        "longestDarkH": longest(sun_ws, "dark"),
        "longestGapH": longest(cov_ws, "none"),
    }
