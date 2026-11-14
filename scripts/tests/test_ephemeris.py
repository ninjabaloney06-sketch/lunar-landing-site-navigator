"""Brief A step 2: T1 (frame grep), T2 (polar ranges), T3 (Sun-Earth separation), interpolation check, plus the
LT+S size (trap 2), quaternion convention (trap 4) and the monthly-file contract (size caps, coverage)."""
import calendar
import json
import math
import os
import random
import re
from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

import windows as geo
from config import APP_DATA, REPO

needs_spice = pytest.mark.skipif(not os.environ.get("CLPS_DATA"), reason="CLPS_DATA not set (raw SPICE kernels)")

EPHEM = APP_DATA / "ephem"
SHACKLETON = (-89.7668, -171.87)  # Lunar Surface Data Book table A2-2 (spec.md)
MALAPERT = (-85.9948, -0.23578)
CONNECTING_RIDGE = (-89.46, -136.68)
FORBIDDEN = "IAU_" + "MOON"  # built so this file does not match its own grep


def month_names():
    y, m = 2026, 11
    while (y, m) <= (2030, 12):
        yield y, m
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)


@pytest.fixture(scope="module")
def months():
    return [geo.load_month(EPHEM / f"{y}-{m:02d}.json") for y, m in month_names()]


@pytest.fixture(scope="module")
def eph():
    import ephemeris
    ephemeris.load_kernels()
    return ephemeris


def sep_deg(a, b):
    a, b = geo.unit(a), geo.unit(b)
    return math.degrees(math.atan2(np.linalg.norm(np.cross(a, b)), float(a @ b)))


def quat_angle_deg(q1, q2):
    d = abs(sum(x * y for x, y in zip(geo.unit(q1), geo.unit(q2))))
    return math.degrees(2 * math.acos(min(1.0, d)))


# ---------- T1 ----------

def test_t1_no_forbidden_frame_and_moon_me_named():
    hits = []
    for root in (REPO / "scripts", REPO / "app" / "src"):
        for p in root.rglob("*"):
            if p.is_file() and p.suffix in {".py", ".ts", ".tsx", ".js", ".json", ".md"}:
                if FORBIDDEN in p.read_text(errors="ignore"):
                    hits.append(str(p.relative_to(REPO)))
    assert hits == []
    src = (REPO / "scripts" / "ephemeris.py").read_text(encoding="utf-8")
    calls = re.findall(r"spice\.(spkpos|pxform|pxfrm2)\(([^)]*)\)", src)
    assert calls, "no SPICE geometry calls found"
    for fn, args in calls:
        assert "FRAME" in args or '"MOON_ME"' in args, f"{fn} without MOON_ME: {args}"
    assert 'FRAME = "MOON_ME"' in src


@needs_spice
def test_t1_kernels_load_with_checksums(eph):
    prov = eph.load_kernels()
    assert [p.split()[0] for p in prov] == eph.KERNELS
    assert all(re.fullmatch(r"\S+ sha256:[0-9a-f]{12}", p) for p in prov)


# ---------- trap 2 and trap 4 ----------

@needs_spice
def test_lt_s_size_matches_trap2(eph):
    import spiceypy as sp
    for utc in ("2026-11-14T00:00:00", "2027-08-16T12:00:00", "2029-03-01T06:00:00"):
        et = sp.str2et(utc)
        d = {}
        for body in ("SUN", "EARTH"):
            a, _ = sp.spkpos(body, et, "MOON_ME", "LT+S", "MOON")
            g, _ = sp.spkpos(body, et, "MOON_ME", "NONE", "MOON")
            d[body] = sep_deg(a, g)
        print(utc, d)
        assert 0.003 < d["SUN"] < 0.009, d  # aberration ~0.006 deg; ~0.07 would mean a wrong frame epoch
        assert d["EARTH"] < 0.001, d


@needs_spice
def test_quaternion_convention(eph):
    import spiceypy as sp
    et = sp.str2et("2027-08-16T00:00:00")
    for m in (sp.pxform("MOON_ME", "J2000", et), sp.pxfrm2("IAU_EARTH", "MOON_ME", et - 1.3, et)):
        assert np.abs(geo.quat_to_matrix(eph.m2q_xyzw(m)) - m).max() < 1e-12


# ---------- T2 ----------

@needs_spice
def test_t2_polar_site_ranges_2027(eph):
    lat, lon = SHACKLETON
    site = geo.site_vector(lat, lon, geo.site_height_km(0))
    enu = geo.enu_basis(lat, lon)
    sun_el, earth_el = [], []
    t = datetime(2027, 1, 1, tzinfo=timezone.utc)
    while t < datetime(2028, 1, 1, tzinfo=timezone.utc):
        st = eph.state_at(t)
        sun_el.append(geo.az_el(st["sun_km"], site, enu)[1])
        earth_el.append(geo.az_el(st["earth_km"], site, enu)[1])
        t += timedelta(hours=6)
    print(f"Shackleton Site04 2027: Sun el [{min(sun_el):.3f}, {max(sun_el):.3f}], "
          f"Earth el [{min(earth_el):.3f}, {max(earth_el):.3f}]")
    assert max(abs(x) for x in sun_el) < 2.0
    assert max(abs(x) for x in earth_el) < 8.0


# ---------- T3 (corrected: ~180 deg at NEW Moon; orbit inclination lets some months peak near 174.7) ----------

def test_t3_monthly_max_sun_earth_separation(months):
    maxima = []
    for m in months:
        best, at = -1.0, 0
        for i, (s, e) in enumerate(zip(m["sun_km"], m["earth_km"])):
            a = sep_deg(s, e)
            if a > best:
                best, at = a, i
        when = datetime.fromisoformat(m["start_utc"].replace("Z", "+00:00")) + timedelta(minutes=30 * at)
        maxima.append((m["start_utc"][:7], best, when))
    for name, best, when in maxima:
        print(f"T3 {name}: max Sun-Earth separation from the Moon's centre {best:.3f} deg at {when:%Y-%m-%dT%H:%MZ}")
    assert all(best > 174.0 for _, best, _ in maxima), [x for x in maxima if x[1] <= 174.0]


# ---------- interpolation check (< 0.001 deg) ----------

TEST_STATION = {"id": "t", "lat_deg": 35.34, "lon_deg": -116.87, "h_m": 950.0, "min_elev_deg": 6.0}


@needs_spice
def test_interpolation_vs_direct_spice(months, eph):
    rng = random.Random(20261114)
    t0 = datetime(2026, 11, 1, tzinfo=timezone.utc)
    t1 = datetime(2031, 1, 1, tzinfo=timezone.utc)
    span_min = int((t1 - t0).total_seconds() // 60)
    times = [t0 + timedelta(minutes=rng.randrange(span_min)) for _ in range(1500)]
    times += [t0 + timedelta(minutes=30 * k + 15) for k in range(0, span_min // 30, 97)]  # mid-steps
    times.append(t1 - timedelta(minutes=1))  # last half-hour of the coverage
    worst = {"sun": 0.0, "earth": 0.0, "sun_ctr": 0.0, "earth_ctr": 0.0, "q_j2000": 0.0, "q_earth": 0.0,
             "moon_el_station": 0.0}
    sites = [geo.site_vector(*ll, geo.site_height_km(0)) for ll in (SHACKLETON, MALAPERT, CONNECTING_RIDGE)]
    for t in times:
        ms = int(t.timestamp() * 1000)
        a = geo.interpolate(months, ms)
        b = eph.state_at(t)
        worst["sun_ctr"] = max(worst["sun_ctr"], sep_deg(a["sun_km"], b["sun_km"]))
        worst["earth_ctr"] = max(worst["earth_ctr"], sep_deg(a["earth_km"], b["earth_km"]))
        for s in sites:
            worst["sun"] = max(worst["sun"], sep_deg(np.subtract(a["sun_km"], s), np.subtract(b["sun_km"], s)))
            worst["earth"] = max(worst["earth"],
                                 sep_deg(np.subtract(a["earth_km"], s), np.subtract(b["earth_km"], s)))
            worst["moon_el_station"] = max(worst["moon_el_station"], abs(
                geo.moon_el_at_station(TEST_STATION, s, a) - geo.moon_el_at_station(TEST_STATION, s, b)))
        worst["q_j2000"] = max(worst["q_j2000"], quat_angle_deg(a["q_me_to_j2000"], b["q_me_to_j2000"]))
        worst["q_earth"] = max(worst["q_earth"], quat_angle_deg(a["q_earth_to_me"], b["q_earth_to_me"]))
    print("interpolation worst case (deg):", {k: f"{v:.2e}" for k, v in worst.items()})
    assert all(v < 0.001 for v in worst.values()), worst


@needs_spice
def test_stored_rounding_effect(months, eph):
    """At grid points the only difference is the stored rounding (orchestrator note 8)."""
    worst = {"sun": 0.0, "earth": 0.0, "q": 0.0}
    site = geo.site_vector(*SHACKLETON, geo.site_height_km(0))
    for m in months[::6]:
        start = datetime.fromisoformat(m["start_utc"].replace("Z", "+00:00"))
        for i in range(0, m["n"], 37):
            b = eph.state_at(start + timedelta(minutes=30 * i))
            worst["sun"] = max(worst["sun"], sep_deg(np.subtract(m["sun_km"][i], site), np.subtract(b["sun_km"], site)))
            worst["earth"] = max(worst["earth"],
                                 sep_deg(np.subtract(m["earth_km"][i], site), np.subtract(b["earth_km"], site)))
            worst["q"] = max(worst["q"], quat_angle_deg(m["q_earth_to_me"][i], b["q_earth_to_me"]),
                             quat_angle_deg(m["q_me_to_j2000"][i], b["q_me_to_j2000"]))
    print("rounding worst case (deg):", {k: f"{v:.2e}" for k, v in worst.items()})
    assert worst["sun"] < 1e-6 and worst["earth"] < 5e-6 and worst["q"] < 5e-5, worst


# ---------- monthly-file contract ----------

def test_month_files_contract(months):
    total = 0
    for (y, m), month in zip(month_names(), months):
        path = EPHEM / f"{y}-{m:02d}.json"
        size = path.stat().st_size
        total += size
        assert size <= 250 * 1024, (path.name, size)
        days = calendar.monthrange(y, m)[1]
        assert month["start_utc"] == f"{y}-{m:02d}-01T00:00:00Z"
        assert month["step_min"] == 30 and month["n"] == days * 48 + 1
        assert month["frame"] == "MOON_ME" and month["correction"] == "LT+S"
        for key in ("sun_km", "earth_km", "q_me_to_j2000", "q_earth_to_me"):
            assert len(month[key]) == month["n"]
        assert len(month["kernels"]) == 5
    assert total <= 12 * 1024 * 1024, total
    for a, b in zip(months, months[1:]):
        for key in ("sun_km", "earth_km", "q_me_to_j2000", "q_earth_to_me"):
            assert a[key][-1] == b[key][0], (a["start_utc"], key)


def test_month_files_are_compact_json():
    raw = (EPHEM / "2027-08.json").read_text(encoding="utf-8")
    assert "\n" not in raw and json.loads(raw)["n"] == 31 * 48 + 1
