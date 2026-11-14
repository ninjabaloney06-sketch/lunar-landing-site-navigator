"""Site-independent Sun/Earth ephemeris in MOON_ME (build-plan §2, §3, §4.1; Brief A steps 1 and 7).

    python3 scripts/ephemeris.py                      # write app/public/data/ephem/YYYY-MM.json, 2026-11 .. 2030-12
    python3 scripts/ephemeris.py --site LAT LON --start ISO --end ISO --step MIN [--elev-m M] [--stations [CSV]]

Monthly files: Moon centre -> Sun / Earth position vectors (km), frame MOON_ME, correction LT+S, observer MOON,
every 30 min; plus q_me_to_j2000 = pxform("MOON_ME", "J2000", et) and q_earth_to_me =
pxfrm2("IAU_EARTH", "MOON_ME", et - lt_earth, et), stored as (x, y, z, w) Hamilton quaternions with
R @ v = q v q*. Each month holds days*48 + 1 samples: the last one equals the next month's first, so one file
covers its whole month and 2030-12 reaches 2031-01-01T00:00Z.

--site prints a direct-SPICE (not interpolated) az/el table for one lunar site: the reference Leo compares
with JPL Horizons (V1). With --stations it adds each station's view of the Moon (Brief A step 7).

IAU_EARTH (pck00011) is used as an approximation of the terrestrial reference frame for station positions;
no high-precision Earth orientation kernel is loaded. Leo judges that error.
"""
import argparse
import calendar
import hashlib
import json
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import spiceypy as spice

import windows as geo
from config import APP_DATA, data_root

KERNELS = ["naif0012.tls", "pck00011.tpc", "de440s.bsp", "moon_pa_de440_200625.bpc", "moon_de440_250416.tf"]
FRAME = "MOON_ME"
CORRECTION = "LT+S"
STEP_MIN = 30
FIRST_MONTH = (2026, 11)
LAST_MONTH = (2030, 12)
EPHEM_DIR = APP_DATA / "ephem"

# Stored precision (orchestrator note 8): Sun vector to 1 km, Earth vector to 0.01 km, quaternions to 1e-7.
# Worst-case direction effect: Sun 0.5*sqrt(3) km / 1.47e8 km = 3.4e-7 deg; Earth 0.005*sqrt(3) km / 3.56e5 km
# = 1.4e-6 deg (topocentric, incl. parallax); quaternion component 5e-8 -> rotation <= ~2e-7 rad = 1.2e-5 deg.
SUN_DECIMALS = 0
EARTH_DECIMALS = 2
QUAT_DECIMALS = 7

IAU_EARTH_NOTE = ("IAU_EARTH (pck00011) approximates the terrestrial frame for station positions; "
                  "q_earth_to_me = pxfrm2('IAU_EARTH', 'MOON_ME', et - lt_earth, et)")

_loaded = None


# ---------- kernels ----------

def _sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_kernels():
    """Furnish the five kernels once; verify each against spice/SHA256SUMS.txt. Returns provenance strings."""
    global _loaded
    if _loaded is not None:
        return _loaded
    spice_dir = data_root() / "spice"
    sums = {}
    sums_file = spice_dir / "SHA256SUMS.txt"
    if sums_file.is_file():
        for line in sums_file.read_text().splitlines():
            if line.strip():
                digest, name = line.split()
                sums[name] = digest
    prov = []
    for name in KERNELS:
        path = spice_dir / name
        if not path.is_file():
            raise SystemExit(f"missing kernel {path}")
        digest = _sha256(path)
        if name in sums and sums[name] != digest:
            raise SystemExit(f"{name}: SHA-256 {digest} does not match SHA256SUMS.txt {sums[name]}")
        spice.furnsh(str(path))
        prov.append(f"{name} sha256:{digest[:12]}")
    _loaded = prov
    return prov


# ---------- states ----------

def m2q_xyzw(m):
    """SPICE rotation matrix -> (x, y, z, w) quaternion with M @ v = q v q* (SPICE m2q is scalar-first)."""
    w, x, y, z = spice.m2q(m)
    return [x, y, z, w]


def body_state(et):
    """Direct SPICE state at one ET: the same fields as one row of a month file (unrounded)."""
    sun, _ = spice.spkpos("SUN", et, FRAME, CORRECTION, "MOON")
    earth, lt_earth = spice.spkpos("EARTH", et, FRAME, CORRECTION, "MOON")
    q1 = m2q_xyzw(spice.pxform(FRAME, "J2000", et))
    q2 = m2q_xyzw(spice.pxfrm2("IAU_EARTH", FRAME, et - lt_earth, et))
    return {"sun_km": list(sun), "earth_km": list(earth), "q_me_to_j2000": q1, "q_earth_to_me": q2}


def utc_to_et(dt):
    return spice.str2et(dt.strftime("%Y-%m-%dT%H:%M:%S.%f"))


def parse_utc(s):
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def state_at(dt):
    st = body_state(utc_to_et(dt))
    st["utcMs"] = int(round(dt.timestamp() * 1000))
    return st


# ---------- monthly files ----------

def _months():
    y, m = FIRST_MONTH
    while (y, m) <= LAST_MONTH:
        yield y, m
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)


def _round_list(v, nd):
    if nd == 0:
        return [int(round(c)) for c in v]
    return [round(float(c), nd) for c in v]


def build_month(year, month):
    load_kernels()
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    days = calendar.monthrange(year, month)[1]
    n = days * 48 + 1
    rows = {"sun_km": [], "earth_km": [], "q_me_to_j2000": [], "q_earth_to_me": []}
    for k in range(n):
        # ET per UTC grid point (str2et handles leap seconds and the periodic TDB term).
        st = body_state(utc_to_et(start + timedelta(minutes=k * STEP_MIN)))
        rows["sun_km"].append(_round_list(st["sun_km"], SUN_DECIMALS))
        rows["earth_km"].append(_round_list(st["earth_km"], EARTH_DECIMALS))
        rows["q_me_to_j2000"].append(_round_list(st["q_me_to_j2000"], QUAT_DECIMALS))
        rows["q_earth_to_me"].append(_round_list(st["q_earth_to_me"], QUAT_DECIMALS))
    return {
        "_note": (f"Generated by scripts/ephemeris.py. Observer MOON, LT+S, frame MOON_ME. Stored to 1 km (Sun), "
                  f"0.01 km (Earth), 1e-7 (quaternions). Last sample = next month's first. {IAU_EARTH_NOTE}."),
        "start_utc": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "step_min": STEP_MIN,
        "n": n,
        "frame": FRAME,
        "correction": CORRECTION,
        **rows,
        "kernels": load_kernels(),
    }


def write_months(out_dir=EPHEM_DIR):
    out_dir.mkdir(parents=True, exist_ok=True)
    total = 0
    for y, m in _months():
        path = out_dir / f"{y}-{m:02d}.json"
        path.write_text(json.dumps(build_month(y, m), separators=(",", ":")))
        size = path.stat().st_size
        total += size
        print(f"{path.name}  {size / 1024:.0f} KB")
    print(f"total {total / 1024 / 1024:.2f} MB")


# ---------- --site table ----------

def _times(start, end, step_min):
    t = start
    while t <= end:
        yield t
        t += timedelta(minutes=step_min)


def site_table(lat, lon, start, end, step_min, elev_m=0.0, stations=None, stations_src=""):
    prov = load_kernels()
    site = {"lat": lat, "lon": lon, "elev_m": elev_m}
    site_km = geo.site_vector(lat, lon, geo.site_height_km(elev_m))
    enu = geo.enu_basis(lat, lon)
    radius = float(np.linalg.norm(site_km))
    out = [
        f"# ephemeris.py --site {lat} {lon}  {start:%Y-%m-%dT%H:%M}Z .. {end:%Y-%m-%dT%H:%M}Z  step {step_min:g} min",
        f"# Observer on the Moon at lat {lat} deg, lon {lon} deg (MOON_ME planetocentric, east-positive), radius "
        f"{radius:.5f} km = 1737.4 km + elev {elev_m:g} m + eye 1.75 m.",
        "# Targets Sun (10) and Earth (399) centres; SPICE observer MOON, correction LT+S, then the site vector is "
        "subtracted (topocentric). Az 0 = north, clockwise; el above the local horizontal plane; no refraction.",
        "# Direct SPICE values (not interpolated). r = angular radius of the disc (Sun 695700 km, Earth 6371 km).",
        f"# Kernels: {', '.join(prov)}",
        f"{'utc':<18} {'sun_az':>9} {'sun_el':>8} {'sun_r':>6} {'earth_az':>9} {'earth_el':>9} {'earth_r':>7}"
        f" {'earth_dist_km':>13}",
    ]
    states = []
    for t in _times(start, end, step_min):
        st = state_at(t)
        states.append((t, st))
        saz, sel, sd = geo.az_el(st["sun_km"], site_km, enu)
        eaz, eel, ed = geo.az_el(st["earth_km"], site_km, enu)
        out.append(f"{t:%Y-%m-%dT%H:%MZ} {saz:9.4f} {sel:8.4f} {geo.ang_radius_deg(geo.SUN_RADIUS_KM, sd):6.4f}"
                   f" {eaz:9.4f} {eel:9.4f} {geo.ang_radius_deg(geo.EARTH_RADIUS_KM, ed):7.4f} {ed:13.1f}")
    out.append(f"# rows: {len(states)}")
    if stations:
        ids = [s["id"] for s in stations]
        out += [
            "",
            f"# Stations ({stations_src}): " + "; ".join(
                f"{s['id']} = {s['name']} {s['lat_deg']:.6f} {s['lon_deg']:.6f} {s['h_m']:.1f} m {s['datum']},"
                f" min_elev {s['min_elev_deg']:g} deg" for s in stations),
            f"# {IAU_EARTH_NOTE}. Station position in MOON_ME = earth_km + R(q_earth_to_me) . s_earthfixed (WGS 84).",
            "# Moon elevation at each station, deg, above the station's geodetic (WGS 84 normal) horizon, airless, "
            "from the reversed LT+S geometry. site = the lunar site above; ctr = Moon centre (Horizons target 301).",
            f"{'utc':<18} " + " ".join(f"{i + '_site':>15} {i + '_ctr':>15}" for i in ids),
        ]
        for t, st in states:
            cells = []
            for s in stations:
                cells.append(f"{geo.moon_el_at_station(s, site_km, st):15.4f}")
                cells.append(f"{geo.moon_el_at_station(s, np.zeros(3), st):15.4f}")
            out.append(f"{t:%Y-%m-%dT%H:%MZ} " + " ".join(cells))
        out += [
            "",
            f"# Each station seen from the lunar site: az / el (deg) and line of sight. Flat horizon here (mask "
            f"{geo.flat_dip_deg():.4f} deg, no terrain). L = line of sight, T = below terrain mask, "
            "S = site below the station's min_elev_deg. Geometric line of sight only, not a working link.",
            f"{'utc':<18} " + " ".join(f"{i:>22}" for i in ids),
        ]
        for t, st in states:
            cells = []
            for s in stations:
                r = geo.station_los(s, site, st, None)
                flag = "L" if r["state"] == "los" else ("T" if r["reason"] == "terrain" else "S")
                cells.append(f"{r['az']:9.4f} {r['el']:9.4f} {flag:>2}")
            out.append(f"{t:%Y-%m-%dT%H:%MZ} " + " ".join(f"{c:>22}" for c in cells))
    return "\n".join(out)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", nargs=2, type=float, metavar=("LAT", "LON"))
    ap.add_argument("--start")
    ap.add_argument("--end")
    ap.add_argument("--step", type=float, default=60.0, help="minutes")
    ap.add_argument("--elev-m", type=float, default=0.0, help="terrain height above 1737.4 km (default 0)")
    ap.add_argument("--stations", nargs="?", const="scripts/stations.csv", default=None, metavar="CSV",
                    help="add station columns (default CSV: scripts/stations.csv)")
    args = ap.parse_args(argv)
    if args.site is None:
        write_months()
        return 0
    if not (args.start and args.end):
        ap.error("--site needs --start and --end")
    stations = None
    src = ""
    if args.stations:
        import stations as st_mod
        path = Path(args.stations)
        if not path.is_absolute():
            path = st_mod.REPO / path
        stations = st_mod.load_csv(path)
        src = f"{path.name}, {len(stations)} rows"
    print(site_table(args.site[0], args.site[1], parse_utc(args.start), parse_utc(args.end), args.step,
                     args.elev_m, stations, src))
    return 0


if __name__ == "__main__":
    sys.exit(main())
