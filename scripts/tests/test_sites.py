"""Checks for scripts/sites.csv and the sites.json it produces (Site contract, types.ts)."""
import csv
import json

from config import APP_DATA, REPO

CSV_PATH = REPO / "scripts" / "sites.csv"
SITES_JSON = APP_DATA / "sites.json"

ALLOWED_GROUPS = {"artemis-2024", "artemis-2022", "clps", "commercial", "international", "apollo", "reference"}
SITE_FIELDS = {
    "id", "name", "group", "label", "lat", "lon", "frame_note", "elev_m", "slope_deg",
    "far_side", "source_url", "source_label", "horizon", "potential",
}
POTENTIAL_CATEGORIES = {"water-ice", "cold-trap", "illumination", "science", "other"}
POTENTIAL_EVIDENCE = {"direct measurement", "remote observation", "modeled condition", "hypothesis", "unknown"}


def rows():
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def test_ids_unique():
    ids = [r["id"] for r in rows()]
    assert len(ids) == len(set(ids))


def test_every_row_has_source_url():
    for r in rows():
        assert r["source_url"].startswith("https://"), r["id"]


def test_latitude_in_south_polar_range():
    for r in rows():
        assert -90 <= float(r["lat"]) <= -80, r["id"]


def test_groups_allowed():
    for r in rows():
        assert r["group"] in ALLOWED_GROUPS, r["id"]


def test_reference_points_present():
    refs = {r["id"] for r in rows() if r["group"] == "reference"}
    assert {"shackleton-rim-site04", "malapert-site23"} <= refs


def test_sites_json_shape_if_present():
    if not SITES_JSON.exists():
        return
    sites = json.loads(SITES_JSON.read_text(encoding="utf-8"))
    assert isinstance(sites, list) and sites
    for s in sites:
        assert set(s) == SITE_FIELDS, s.get("id")
        assert s["source_url"], s["id"]
        for p in s["potential"]:
            assert p["category"] in POTENTIAL_CATEGORIES
            assert p["evidence"] in POTENTIAL_EVIDENCE
            assert p["source_url"] and p["text"]
