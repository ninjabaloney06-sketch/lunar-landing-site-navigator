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
