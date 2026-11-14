"""Checks for scripts/poi_horizons.py and its output (horizons/poi-*.json, search-sites.json).

The unit tests need no data files. The output tests read the generated files and docs/POIs, never the
raw DEM; record lookups and the frame-note rule are written here independently of the generator.
"""
import json
import math
from urllib.parse import urlparse

import numpy as np

import poi_horizons as ph
from config import APP_DATA, REPO
from test_sites import SITE_FIELDS

POI_DIR = REPO / "docs" / "POIs"
HORIZONS = APP_DATA / "horizons"
SEARCH_JSON = APP_DATA / "search-sites.json"
GROUP_OF_FILE = {
    "hazards": "hazard",
    "ice-volatile-evidence": "water",
    "psr-cold-traps": "cold-trap",
    "illumination-sites": "light",
    "landing-sites": "landing",
    "additional-sites": "landing",
    "science-features": "science",
}
R_KM = 1737.4


def records_by_poi_id():
    out = {}
    for name, group in GROUP_OF_FILE.items():
        path = POI_DIR / f"{name}.json"
        if not path.exists():
            continue
        for r in json.loads(path.read_text(encoding="utf-8"))["items"]:
            out.setdefault(f"{group}:{r['id']}", []).append(r)
    return out


def entries():
    assert SEARCH_JSON.exists(), "run scripts/poi_horizons.py"
    sites = json.loads(SEARCH_JSON.read_text(encoding="utf-8"))
    assert isinstance(sites, list) and sites
    return sites


def expected_frame_note(rec):
    f, loc = rec.get("frame"), rec.get("location_note")
    note = f if isinstance(f, str) and f.strip() else "frame not stated in source (MOON_ME assumed)"
    return note + ("; " + loc if isinstance(loc, str) and loc.strip() else "")


# ---------- pure functions ----------

def test_stem_rule():
    assert ph.stem("cold-trap", "atlas_01") == "poi-cold-trap-atlas-01"
    assert ph.stem("water", "lcross.targeted_impact_point") == "poi-water-lcross-targeted-impact-point"
    assert ph.stem("landing", "_Luna__25--Actual.") == "poi-landing-luna-25-actual"
    assert ph.stem("light", "GL18 C1/surface") == "poi-light-gl18-c1-surface"


def test_group_mapping():
    assert ph.FILE_GROUPS == GROUP_OF_FILE
    assert "pgda-study-sites" not in ph.FILE_GROUPS


def test_frame_note():
    d = "frame not stated in source (MOON_ME assumed)"
    assert ph.frame_note({"frame": None, "location_note": None}) == d
    assert ph.frame_note({"frame": None}) == d
    assert ph.frame_note({"frame": "", "location_note": "PSR centre"}) == d + "; PSR centre"
    assert ph.frame_note({"frame": "MOON_ME", "location_note": ""}) == "MOON_ME"
    assert ph.frame_note({"frame": "MOON_ME", "location_note": "rim"}) == "MOON_ME; rim"


def test_far_side_rule_synthetic_ephemeris():
    near = [384400.0, 0.0, 0.0]   # above the horizon of (-89, 0): 384400 cos 89 deg = 6709 km > 1737.4 km
    far = [-384400.0, 0.0, 0.0]
    assert ph.far_side(-89.0, 0.0, [far, far, far]) is True
    assert ph.far_side(-89.0, 0.0, [far, near, far]) is False
    assert ph.far_side(-89.0, 180.0, [near, near]) is True
    # Earth above the Moon-centre horizon but below the surface point's horizon (670.9 km < 1737.4 km):
    # the rule measures from the point on the sphere, not from the Moon's centre.
    assert 0 < 384400 * math.cos(math.radians(89.9)) < R_KM
    assert ph.far_side(-89.9, 0.0, [near]) is True


def test_load_earth_km_reads_month_files_only(tmp_path):
    (tmp_path / "2030-01.json").write_text(json.dumps({"earth_km": [[1, 2, 3], [4, 5, 6]]}))
    (tmp_path / "2030-02.json").write_text(json.dumps({"earth_km": [[7, 8, 9]]}))
    (tmp_path / "sample.json").write_text(json.dumps({"earth_km": [[0, 0, 0]]}))
    earth, n = ph.load_earth_km(tmp_path)
    assert n == 2 and earth.tolist() == [[1, 2, 3], [4, 5, 6], [7, 8, 9]]


# ---------- generated files ----------

def test_entry_shape():
    for s in entries():
        assert set(s) == SITE_FIELDS | {"poi_id"}, s.get("id")
        assert s["group"] == "poi" and s["label"] is None and s["potential"] == [], s["id"]
        assert s["horizon"] == f"{s['id']}.json", s["id"]
        assert isinstance(s["far_side"], bool), s["id"]


def test_ids_unique_sorted_and_follow_stem_rule():
    sites = entries()
    ids = [s["id"] for s in sites]
    assert len(ids) == len(set(ids)) and ids == sorted(ids)
    assert len({s["poi_id"] for s in sites}) == len(sites)
    for s in sites:
        group, rid = s["poi_id"].split(":", 1)
        assert s["id"] == ph.stem(group, rid), s["poi_id"]


def test_entries_match_source_records():
    recs = records_by_poi_id()
    for s in entries():
        found = recs.get(s["poi_id"], [])
        assert len(found) == 1, s["poi_id"]
        r = found[0]
        assert not r.get("app_site_id"), s["poi_id"]
        assert r["geometry"]["type"] == "Point"
        assert s["lat"] == r["geometry"]["lat"] and s["lon"] == r["geometry"]["lon_east_180"], s["id"]
        assert s["name"] == r["name"], s["id"]
        assert s["source_url"] in r["sources"] and s["source_url"] == r["sources"][0], s["id"]
        assert s["source_label"] == urlparse(s["source_url"]).hostname, s["id"]
        assert s["frame_note"] == expected_frame_note(r), s["id"]


def test_horizon_files_match_entries():
    recs = records_by_poi_id()
    for s in entries():
        path = HORIZONS / s["horizon"]
        assert path.exists(), s["id"]
        h = json.loads(path.read_text(encoding="utf-8"))
        assert len(h["mask"]) == 720 and len(h["mask_dist_km"]) == 720, s["id"]
        assert np.all(np.isfinite(h["mask"])) and np.all(np.isfinite(h["mask_dist_km"])), s["id"]
        assert h["az_step"] == 0.5 and h["observer_height_m"] == 1.75, s["id"]
        assert h["site_id"] == s["id"]
        g = recs[s["poi_id"]][0]["geometry"]
        assert h["lat"] == g["lat"] and h["lon"] == g["lon_east_180"], s["id"]
        assert s["elev_m"] == h["elev_m"] and s["slope_deg"] == h["slope_deg"], s["id"]


def test_no_entry_or_file_for_app_sites():
    sites = entries()
    ids, poi_ids = {s["id"] for s in sites}, {s["poi_id"] for s in sites}
    for poi_id, rs in records_by_poi_id().items():
        for r in rs:
            if r.get("app_site_id"):
                s = ph.stem(*poi_id.split(":", 1))
                assert poi_id not in poi_ids and s not in ids, poi_id
                assert not (HORIZONS / f"{s}.json").exists(), poi_id


def test_no_orphan_horizon_files():
    ids = {s["id"] for s in entries()}
    files = {p.stem for p in HORIZONS.glob("poi-*.json")}
    assert files == ids, sorted(files ^ ids)
