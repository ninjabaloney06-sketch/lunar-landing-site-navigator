"""Sample JSON in app/public/data must match the build-plan §3 contract shape."""
import json

from config import APP_DATA


def load(rel):
    return json.loads((APP_DATA / rel).read_text())


def test_sites_shape():
    for s in load("sites.json"):
        for key in ("id", "name", "group", "lat", "lon", "source_url", "source_label", "horizon"):
            assert key in s


def test_horizon_shape():
    h = load("horizons/sample-site.json")
    assert h["az_step"] == 0.5
    assert len(h["mask"]) == 720 and len(h["mask_dist_km"]) == 720
    assert h["ray_max_km"] == 300


def test_ephem_shape():
    e = load("ephem/sample.json")
    assert e["frame"] == "MOON_ME" and e["correction"] == "LT+S"
    n = e["n"]
    assert len(e["sun_km"]) == n and len(e["earth_km"]) == n
    assert len(e["q_me_to_j2000"]) == n and len(e["q_earth_to_me"]) == n


# ---------- every shipped file, not only the samples (review 14 Nov) ----------

import math
from datetime import datetime, timedelta, timezone

import pytest

HORIZON_FILES = sorted(p.name for p in (APP_DATA / "horizons").glob("*.json") if p.name != "sample-site.json")
EPHEM_FILES = sorted(p.name for p in (APP_DATA / "ephem").glob("20*.json"))


def _finite(xs):
    return all(isinstance(x, (int, float)) and math.isfinite(x) for x in xs)


def test_every_site_has_its_horizon_file():
    names = {s["horizon"] for s in load("sites.json") if s["horizon"]}
    assert names <= set(HORIZON_FILES)


@pytest.mark.parametrize("name", HORIZON_FILES)
def test_real_horizon_shape(name):
    h = load(f"horizons/{name}")
    assert h["az_step"] == 0.5 and h["ray_max_km"] == 300
    assert h["observer_height_m"] == 1.75
    assert len(h["mask"]) == 720 and len(h["mask_dist_km"]) == 720
    assert _finite(h["mask"])
    assert all(-90 < m < 90 for m in h["mask"])
    assert all(isinstance(d, (int, float)) and d >= 0 for d in h["mask_dist_km"] if d is not None)
    # truncated directions are azimuths on the 0.5 deg grid, each listed once
    assert all(0 <= a < 360 and (a * 2) == int(a * 2) for a in h["truncated"])
    assert len(set(h["truncated"])) == len(h["truncated"])
    site = next(s for s in load("sites.json") if s["horizon"] == name)
    assert (h["lat"], h["lon"]) == (site["lat"], site["lon"])


@pytest.mark.parametrize("name", EPHEM_FILES)
def test_real_ephem_month_shape(name):
    e = load(f"ephem/{name}")
    assert e["frame"] == "MOON_ME" and e["correction"] == "LT+S" and e["step_min"] == 30
    start = datetime.fromisoformat(e["start_utc"].replace("Z", "+00:00"))
    assert start.day == 1 and start.hour == 0 and start.tzinfo == timezone.utc
    assert name == f"{start:%Y-%m}.json"
    nxt = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    # samples cover [month start, next month start] inclusive: days * 48 + 1
    assert e["n"] == int((nxt - start).total_seconds() // 1800) + 1
    for key in ("sun_km", "earth_km", "q_me_to_j2000", "q_earth_to_me"):
        assert len(e[key]) == e["n"]
    for v in e["sun_km"][:: 97]:
        assert 1.45e8 < math.dist(v, (0, 0, 0)) < 1.53e8  # 1 AU +- Earth's eccentricity
    for v in e["earth_km"][:: 97]:
        assert 3.55e5 < math.dist(v, (0, 0, 0)) < 4.08e5  # lunar perigee .. apogee
    for q in e["q_me_to_j2000"][:: 97] + e["q_earth_to_me"][:: 97]:
        assert abs(math.dist(q, (0, 0, 0, 0)) - 1) < 1e-6


def test_ephem_months_are_contiguous():
    # last sample of each month equals the first sample of the next (the interpolator relies on it)
    for a, b in zip(EPHEM_FILES, EPHEM_FILES[1:]):
        ea, eb = load(f"ephem/{a}"), load(f"ephem/{b}")
        assert ea["sun_km"][-1] == eb["sun_km"][0] and ea["earth_km"][-1] == eb["earth_km"][0]
