"""Points of interest: docs/POIs/*.json -> app/public/data/pois.json, a JSON array of Poi (app/src/data/pois.ts).

Only records with a point geometry become pins; records without one are regional findings and are skipped.
Every value is copied from the source record; nothing is reworded or computed except the fixed rules below.

File -> group (any other file in docs/POIs raises; a missing one raises):
    hazards -> hazard, ice-volatile-evidence -> water, psr-cold-traps -> cold-trap, illumination-sites -> light,
    landing-sites -> landing, science-features -> science; additional-sites -> landing when the file is present
    (researched points added on ninja's request, 14 Nov; absent is fine).
    pgda-study-sites has no point geometry (names only); it is read and must contribute 0 points, else it raises,
    so a new point there is never dropped silently.

A record is shipped iff geometry.type == "Point" AND it has >= 1 source URL. Output order: groups in POI_GROUPS
order (hazard, water, cold-trap, light, landing, science), then source item order.

Fields of one Poi:
    id          "<group>:<record id>"; a duplicate raises.
    name        record.name, verbatim.
    group       from the file, see above.
    category    record.category, verbatim.
    lat         geometry.lat as a float, equal to the source value; outside [-90, 90] raises.
    lon         geometry.lon_east_180 as a float, equal to the source value; outside [-180, 180] raises.
                geometry.lon_east_360 must equal it modulo 360 to within 1e-9 deg, else it raises (a conversion
                error in the notes must not reach a pin).
    summary     the first non-empty string (after stripping outer whitespace) of
                [properties.notes, properties.science_value, record.location_note], outer whitespace stripped,
                otherwise unchanged; '' if none of the three is a non-empty string.
    facts       one {label, value} per entry of record.properties, in source key order, skipping
                - the property used for the summary,
                - null values, dicts, and lists that contain a dict or a list,
                - values that render to an empty (or whitespace-only) string, e.g. an empty list.
                Then, as the last fact, {"Location note", record.location_note} when location_note is a non-empty
                string and was not used as the summary.
                value: the source text exactly as written in the file (numbers keep their JSON token text, e.g.
                76.0 stays "76.0"; strings verbatim, not stripped); true/false -> "yes"/"no"; a list of scalars ->
                its elements rendered the same way and joined with ", ", where a null element becomes "no value"
                (the lists are positional, e.g. "traverse_dist_m_at_10_15_20_25_deg", so a null is never dropped).
                label: KEY_LABELS[key] when listed, else key.replace("_", " ") with the first letter upper-cased.
    evidence    record.evidence (string or null), verbatim.
    limitations record.limitations (string or null), verbatim.
    sources     the http(s) strings of record.sources, in source order, duplicates removed.
    siteId      record.app_site_id when it is an id in app/public/data/sites.json, else null.
    plain       {type, bullets} from docs/POIs/plain.json under the Poi's id (U8, the summary card): type a non-empty
                string, bullets a list of 0-3 non-empty strings, copied verbatim. Only when plain.json exists and has
                an entry for that id (a missing file adds no plain field anywhere). plain.json is not a group file: it
                is excluded from the file -> group check. An entry whose id is not a shipped Poi raises (a typo or a
                dropped record must not pass silently); a malformed entry raises.

Output: json.dumps(pois, ensure_ascii=False, indent=1) + "\\n", UTF-8. Two runs give identical bytes.

    python3 scripts/pois.py          # write app/public/data/pois.json
    python3 scripts/pois.py --check  # exit 1 if the file on disk differs from a fresh build (writes nothing)
"""
import argparse
import json
import sys
from pathlib import Path

from config import APP_DATA, REPO

POI_DIR = REPO / "docs" / "POIs"
PLAIN_STEM = "plain"  # docs/POIs/plain.json: plain summary texts keyed by output id, not a group file
OUT_PATH = APP_DATA / "pois.json"
SITES_PATH = APP_DATA / "sites.json"

FILE_GROUPS = {
    "hazards": "hazard",
    "ice-volatile-evidence": "water",
    "psr-cold-traps": "cold-trap",
    "illumination-sites": "light",
    "landing-sites": "landing",
    "science-features": "science",
}
OPTIONAL_FILES = {"additional-sites": "landing"}  # read when present, after the group's required file
NO_POINT_FILES = {"pgda-study-sites"}
GROUP_ORDER = ["hazard", "water", "cold-trap", "light", "landing", "science"]  # POI_GROUPS in app/src/data/pois.ts

SUMMARY_FIELDS = ["notes", "science_value", "location_note"]  # first two in properties, the last on the record
LON_TOL_DEG = 1e-9
NULL_IN_LIST = "no value"
LOCATION_NOTE_LABEL = "Location note"

# Labels for every scalar or list-of-scalar property key of the current point records (science_value is listed for a
# record that has both notes and science_value; today none has). Units after a comma, as in the key.
KEY_LABELS = {
    # hazards
    "length": "Length",
    "relief_m": "Relief, m",
    "slope_setting": "Slope setting",
    "distance_from_pole_km": "Distance from pole, km",
    "count": "Count",
    "date": "Date",
    "magnitude": "Magnitude",
    "context": "Context",
    "IM-1": "IM-1",
    "IM-2": "IM-2",
    "common_cause": "Common cause",
    "crewed_lander_concerns": "Crewed lander concerns",
    # ice-volatile-evidence
    "impact_time_utc": "Impact time, UTC",
    "collimated_suppression": "Collimated suppression",
    "collimated_weh_wt_pct": "Collimated WEH, wt%",
    "diviner_max_T_K": "Diviner max temperature, K",
    # illumination-sites
    "study": "Study",
    "year": "Year",
    "data": "Data",
    "dem_resolution_m": "DEM resolution, m",
    "period": "Period",
    "time_step": "Time step",
    "height_m": "Height, m",
    "avg_illumination_pct": "Average illumination, %",
    "solar_visibility_pct": "Solar visibility, %",
    "longest_lit": "Longest lit",
    "longest_dark_h": "Longest dark, h",
    "longest_dark_text": "Longest dark (text)",
    "earth_visibility_pct": "Earth visibility, %",
    "earth_visibility_text": "Earth visibility (text)",
    "lon_as_published": "Longitude as published",
    "percent_lit_by_lunar_day_midsummer_to_midwinter": "Lit by lunar day, midsummer to midwinter, %",
    # landing-sites
    "size_km": "Size, km",
    "selection_criteria_notes": "Selection criteria notes",
    "side_km": "Side, km",
    "shared_point_warning": "Shared point warning",
    "agency": "Agency",
    "status": "Status",
    "dates": "Dates",
    "outcome": "Outcome",
    # psr-cold-traps
    "atlas_id": "Atlas ID",
    "psr_area_km2": "PSR area, km²",
    "perimeter_km": "Perimeter, km",
    "m3_ice_detections": "M3 ice detections",
    "m3_detections_per_km2": "M3 detections per km²",
    "h_max_ppm": "H max, ppm",
    "max_weh_wt_pct": "Max WEH, wt%",
    "temp_K_min_max_mean": "Temperature min, max, mean, K",
    "slope_deg_max_mean": "Slope max, mean, °",
    "access_slope_class_deg": "Access slope class, °",
    "h2o_stability_depth_m": "H₂O stability depth, m",
    "traverse_dist_m_at_10_15_20_25_deg": "Traverse distance at 10, 15, 20, 25°, m",
    "illum_pct_within_1_5_10_km": "Illumination within 1, 5, 10 km, %",
    "model_age_Ga": "Model age, Ga",
    "diameter_km": "Diameter, km",
    "depth_km": "Depth, km",
    # science-features
    "size": "Size",
    "age": "Age",
    "science_value": "Science value",
    "formation_model_age_Ga": "Formation model age, Ga",
    "N1_per_km2": "N1 per km²",
    "floor_retention_age_Ga": "Floor retention age, Ga",
    # additional-sites (researched 14 Nov evening)
    "as_printed": "As printed in the source",
    "pgda_site_id": "PGDA site ID",
    "pgda_site_name": "PGDA site name",
    "pgda_study_sites_record": "PGDA study-sites record",
    "source_document": "Source document",
    "same_position_within_0_01_deg": "Same position within 0.01°",
    "region_name": "Region name",
    "roi_id": "Region ID",
    "published_version_doi": "Published version, DOI",
    "also_printed_in": "Also printed in",
    "impact_time_as_printed": "Impact time, as printed",
    "impact_date_as_printed": "Impact date, as printed",
    "other_published_estimates_cited_in_same_abstract": "Other published estimates cited in the same abstract",
    "fills_gap_in": "Fills gap in",
    "significance_as_printed": "Significance, as printed",
}


class PoiError(ValueError):
    pass


def label(key):
    if key in KEY_LABELS:
        return KEY_LABELS[key]
    text = key.replace("_", " ")
    return text[:1].upper() + text[1:]


def _scalar(v):
    """One scalar from the token load (numbers are their token text) -> its fact text."""
    if isinstance(v, bool):
        return "yes" if v else "no"
    if v is None:
        return NULL_IN_LIST
    return v


def fact_value(v):
    """A property value from the token load -> fact text, or None when it is not shown."""
    if v is None or isinstance(v, dict):
        return None
    if isinstance(v, list):
        if any(isinstance(x, (dict, list)) for x in v):
            return None
        text = ", ".join(_scalar(x) for x in v)
    else:
        text = _scalar(v)
    return None if text.strip() == "" else text


def summary_of(props, rec):
    """(summary text, the field it came from or None)."""
    for key in SUMMARY_FIELDS:
        v = rec.get(key) if key == "location_note" else props.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip(), key
    return "", None


def _coord(geom, key, rid, lo, hi):
    v = geom.get(key)
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise PoiError(f"{rid}: geometry.{key} is not a number: {v!r}")
    v = float(v)
    if not lo <= v <= hi:
        raise PoiError(f"{rid}: geometry.{key} = {v} outside [{lo}, {hi}]")
    return v


def _optional_text(rec, key, rid):
    v = rec.get(key)
    if v is not None and not isinstance(v, str):
        raise PoiError(f"{rid}: {key} is neither a string nor null: {v!r}")
    return v


def source_urls(rec):
    sources = rec.get("sources") or []
    if not isinstance(sources, list):
        raise PoiError(f"{rec.get('id')}: sources is not a list")
    out = []
    for s in sources:
        if isinstance(s, str) and s.startswith(("http://", "https://")) and s not in out:
            out.append(s)
    return out


def is_point(rec):
    return (rec.get("geometry") or {}).get("type") == "Point"


def make_poi(group, rec, tok, site_ids):
    """One shipped record -> Poi dict. rec: default JSON load; tok: the same record loaded with number tokens as
    text (facts). Returns (poi, app_site_id not found in sites.json or None)."""
    rid = rec.get("id")
    if not isinstance(rid, str) or not rid:
        raise PoiError(f"{group}: record without id")
    for key in ("name", "category"):
        if not isinstance(rec.get(key), str) or not rec[key]:
            raise PoiError(f"{rid}: {key} missing")
    geom = rec["geometry"]
    lat = _coord(geom, "lat", rid, -90, 90)
    lon = _coord(geom, "lon_east_180", rid, -180, 180)
    lon360 = _coord(geom, "lon_east_360", rid, 0, 360)
    d = (lon360 - lon) % 360
    if min(d, 360 - d) > LON_TOL_DEG:
        raise PoiError(f"{rid}: lon_east_360 {lon360} disagrees with lon_east_180 {lon} (mod 360)")

    props = tok.get("properties") or {}
    summary, used = summary_of(props, tok)
    facts = []
    for key, v in props.items():
        if key == used:
            continue
        value = fact_value(v)
        if value is not None:
            facts.append({"label": label(key), "value": value})
    note = tok.get("location_note")
    if used != "location_note" and isinstance(note, str) and note.strip():
        facts.append({"label": LOCATION_NOTE_LABEL, "value": note})

    app_site = rec.get("app_site_id")
    site_id = app_site if app_site in site_ids else None
    poi = {
        "id": f"{group}:{rid}",
        "name": rec["name"],
        "group": group,
        "category": rec["category"],
        "lat": lat,
        "lon": lon,
        "summary": summary,
        "facts": facts,
        "evidence": _optional_text(rec, "evidence", rid),
        "limitations": _optional_text(rec, "limitations", rid),
        "sources": source_urls(rec),
        "siteId": site_id,
    }
    return poi, (app_site if app_site is not None and site_id is None else None)


def parse_doc(text):
    """File text -> (default load, token load). Token load keeps every number's text (facts 'as written')."""
    return json.loads(text), json.loads(text, parse_float=str, parse_int=str)


def load_docs(poi_dir=POI_DIR):
    poi_dir = Path(poi_dir)
    if not poi_dir.is_dir():
        raise SystemExit(f"POI folder not found: {poi_dir}")
    return {p.stem: parse_doc(p.read_text(encoding="utf-8")) for p in sorted(poi_dir.glob("*.json")) if p.stem != PLAIN_STEM}


def load_plain(poi_dir=POI_DIR):
    """docs/POIs/plain.json -> {output id: {type, bullets}}, or None when the file does not exist."""
    path = Path(poi_dir) / f"{PLAIN_STEM}.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def check_plain(pid, entry):
    """One plain.json entry -> {type, bullets} in that key order; raises when it is malformed."""
    if not isinstance(entry, dict) or set(entry) != {"type", "bullets"}:
        raise PoiError(f"plain.json {pid}: expected exactly the keys type and bullets")
    t, bullets = entry["type"], entry["bullets"]
    if not isinstance(t, str) or not t.strip():
        raise PoiError(f"plain.json {pid}: type is not a non-empty string")
    if not isinstance(bullets, list) or len(bullets) > 3 or not all(isinstance(b, str) and b.strip() for b in bullets):
        raise PoiError(f"plain.json {pid}: bullets must be a list of 0-3 non-empty strings")
    return {"type": t, "bullets": list(bullets)}


def merge_plain(pois, plain):
    """Adds poi['plain'] from plain.json (None = no file: nothing added). Returns the number of Pois without an entry."""
    if plain is None:
        return 0
    if not isinstance(plain, dict):
        raise PoiError("plain.json is not an object keyed by POI id")
    ids = {p["id"] for p in pois}
    unknown = sorted(set(plain) - ids)
    if unknown:
        raise PoiError(f"plain.json: id(s) that are not shipped POIs: {unknown}")
    missing = 0
    for p in pois:
        if p["id"] in plain:
            p["plain"] = check_plain(p["id"], plain[p["id"]])
        else:
            missing += 1
    return missing


def load_site_ids(path=SITES_PATH):
    return {s["id"] for s in json.loads(Path(path).read_text(encoding="utf-8"))}


def build(docs, site_ids, plain=None):
    """docs: {file stem: (default load, token load)}; plain: load_plain() (None = no plain.json) ->
    (pois, skipped for lack of a source, unknown app_site_ids)."""
    unknown_files = sorted(set(docs) - set(FILE_GROUPS) - set(OPTIONAL_FILES) - NO_POINT_FILES)
    if unknown_files:
        raise PoiError(f"unknown file(s) in docs/POIs: {unknown_files} (map them to a group in scripts/pois.py)")
    missing = sorted((set(FILE_GROUPS) | NO_POINT_FILES) - set(docs))
    if missing:
        raise PoiError(f"missing file(s) in docs/POIs: {missing}")
    for stem in sorted(NO_POINT_FILES):
        n = sum(is_point(r) for r in docs[stem][0]["items"])
        if n:
            raise PoiError(f"{stem}: {n} point record(s); map the file to a group instead of dropping them")

    stems = [*FILE_GROUPS.items(), *((s, g) for s, g in OPTIONAL_FILES.items() if s in docs)]
    pois, seen, skipped, unknown_sites = [], set(), 0, []
    for group, stem in ((g, s) for g in GROUP_ORDER for s, x in stems if x == g):
        raw, tok = docs[stem]
        if len(raw["items"]) != len(tok["items"]):
            raise PoiError(f"{stem}: item count differs between loads")
        for rec, rec_tok in zip(raw["items"], tok["items"]):
            if not is_point(rec):
                continue
            if not source_urls(rec):
                skipped += 1
                continue
            poi, unknown = make_poi(group, rec, rec_tok, site_ids)
            if poi["id"] in seen:
                raise PoiError(f"duplicate id {poi['id']}")
            seen.add(poi["id"])
            pois.append(poi)
            if unknown is not None:
                unknown_sites.append(unknown)
    merge_plain(pois, plain)
    return pois, skipped, unknown_sites


def render(pois):
    return (json.dumps(pois, ensure_ascii=False, indent=1) + "\n").encode("utf-8")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="exit 1 if the file on disk differs from a fresh build")
    args = ap.parse_args(argv)
    plain = load_plain()
    pois, skipped, unknown_sites = build(load_docs(), load_site_ids(), plain)
    data = render(pois)
    counts = ", ".join(f"{g} {sum(p['group'] == g for p in pois)}" for g in GROUP_ORDER)
    print(f"{len(pois)} POIs ({counts}); skipped for lack of a source: {skipped}")
    if plain is None:
        print("docs/POIs/plain.json not found: no plain field")
    else:
        print(f"plain texts: {sum('plain' in p for p in pois)} of {len(pois)} POIs")
    for s in unknown_sites:
        print(f"app_site_id not in sites.json (siteId null): {s}")
    if args.check:
        same = OUT_PATH.is_file() and OUT_PATH.read_bytes() == data
        print(f"{OUT_PATH}: {'up to date' if same else 'differs from a fresh build'}")
        return 0 if same else 1
    OUT_PATH.write_bytes(data)
    print(f"wrote {OUT_PATH} ({len(data)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
