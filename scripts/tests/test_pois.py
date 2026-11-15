"""POI pipeline (U1): docs/POIs/*.json -> app/public/data/pois.json. Every shipped value is traced back to its source
record: counts, ids, coordinates, sources, summary and facts are re-derived here from the raw files (default JSON
load, independent of the script's token load) and compared; the checked-in file must equal a fresh build."""
import copy
import json
import re
from collections import Counter

import pytest

import pois
from config import APP_DATA, REPO

POI_DIR = REPO / "docs" / "POIs"
OUT = APP_DATA / "pois.json"
GROUP_OF = {  # restated here on purpose: the test does not trust the script's own table
    "hazards": "hazard",
    "ice-volatile-evidence": "water",
    "psr-cold-traps": "cold-trap",
    "illumination-sites": "light",
    "landing-sites": "landing",
    "science-features": "science",
    "additional-sites": "landing",  # optional file: counted only when present
}
POI_KEYS = ["id", "name", "group", "category", "lat", "lon", "summary", "facts", "evidence", "limitations",
            "sources", "siteId"]
PLAIN = POI_DIR / "plain.json"  # U8 plain summary texts keyed by output id; not a group file
CAVEAT = "Not validated by the science lead"
NUM = re.compile(r"-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?")


def _http(s):
    return isinstance(s, str) and s.startswith(("http://", "https://"))


def _point(rec):
    return (rec.get("geometry") or {}).get("type") == "Point"


@pytest.fixture(scope="module")
def raw():
    return {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in sorted(POI_DIR.glob("*.json")) if p != PLAIN}


@pytest.fixture(scope="module")
def records(raw):
    """Output id -> raw source record."""
    return {f"{GROUP_OF[stem]}:{r['id']}": r for stem, doc in raw.items() if stem in GROUP_OF for r in doc["items"]}


@pytest.fixture(scope="module")
def float_tokens():
    """Output id -> properties loaded with every float as its token text (to prove "as written", e.g. 76.0)."""
    out = {}
    for path in sorted(POI_DIR.glob("*.json")):
        if path.stem in GROUP_OF:
            for r in json.loads(path.read_text(encoding="utf-8"), parse_float=str)["items"]:
                out[f"{GROUP_OF[path.stem]}:{r['id']}"] = r["properties"]
    return out


@pytest.fixture(scope="module")
def out():
    return json.loads(OUT.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def site_ids():
    return {s["id"] for s in json.loads((APP_DATA / "sites.json").read_text(encoding="utf-8"))}


# ---------- what ships ----------

def test_counts_per_group_equal_point_records_with_a_source(raw, out):
    expected = Counter()
    for stem, doc in raw.items():
        n = sum(1 for r in doc["items"] if _point(r) and any(_http(s) for s in r.get("sources") or []))
        if stem in GROUP_OF:
            expected[GROUP_OF[stem]] += n
        else:
            assert stem == "pgda-study-sites", f"unexpected file docs/POIs/{stem}.json"
            assert n == 0
    got = Counter(p["group"] for p in out)
    print(dict(got))
    assert got == expected
    assert len(out) == sum(expected.values())


def test_pgda_study_sites_contributes_zero(raw, out):
    pgda = raw["pgda-study-sites"]["items"]
    assert pgda and not any(_point(r) for r in pgda)
    assert {p["group"] for p in out} <= set(GROUP_OF.values())


def test_record_shape_and_unique_ids(out):
    ids = [p["id"] for p in out]
    assert len(ids) == len(set(ids))
    for p in out:
        assert list(p) in (POI_KEYS, POI_KEYS + ["plain"])
        assert p["id"].startswith(p["group"] + ":")


def test_order_follows_poi_groups_contract_then_source_order(raw, out):
    ts = (REPO / "app" / "src" / "data" / "pois.ts").read_text(encoding="utf-8")
    block = ts[ts.index("export const POI_GROUPS"):]
    contract = re.findall(r"\{ id: '([a-z-]+)'", block)
    assert contract == pois.GROUP_ORDER == ["hazard", "water", "cold-trap", "light", "landing", "science"]
    stems = [s for g in contract for s, x in GROUP_OF.items() if x == g and s in raw]  # landing-sites, then additional-sites
    expected = [f"{GROUP_OF[s]}:{r['id']}" for s in stems for r in raw[s]["items"] if _point(r)]
    assert [p["id"] for p in out] == expected


# ---------- values equal the source ----------

def test_coordinates_equal_source_geometry(out, records):
    for p in out:
        g = records[p["id"]]["geometry"]
        assert p["lat"] == g["lat"] and p["lon"] == g["lon_east_180"], p["id"]
        assert -90 <= p["lat"] <= 90 and -180 <= p["lon"] <= 180, p["id"]
        d = (g["lon_east_360"] - g["lon_east_180"]) % 360
        assert min(d, 360 - d) <= 1e-9, p["id"]


def test_sources_are_http_urls_of_the_record(out, records):
    for p in out:
        src = records[p["id"]]["sources"]
        assert len(p["sources"]) >= 1, p["id"]
        assert len(p["sources"]) == len(set(p["sources"])), p["id"]
        assert all(_http(u) and u in src for u in p["sources"]), p["id"]
        assert p["sources"] == [u for i, u in enumerate(src) if _http(u) and u not in src[:i]], p["id"]


def _summary_field(rec):
    for key in ("notes", "science_value", "location_note"):
        v = rec.get(key) if key == "location_note" else rec["properties"].get(key)
        if isinstance(v, str) and v.strip():
            return key, v.strip()
    return None, ""


def test_summary_is_one_of_the_three_source_fields(out, records):
    for p in out:
        rec = records[p["id"]]
        allowed = {v.strip() for v in (rec["properties"].get("notes"), rec["properties"].get("science_value"),
                                       rec.get("location_note")) if isinstance(v, str)}
        assert p["summary"] in allowed | {""}, p["id"]
        assert p["summary"] == _summary_field(rec)[1], p["id"]


def _same_scalar(text, v, token):
    if isinstance(v, bool):
        return text == ("yes" if v else "no")
    if v is None:
        return text == "no value"
    if isinstance(v, int):
        return text == str(v)
    if isinstance(v, float):  # the token as written in the file, and a JSON number whose value is v
        return text == token and NUM.fullmatch(text) is not None and float(text) == v
    return text == v


def _same_value(text, v, token):
    if not isinstance(v, list):
        return _same_scalar(text, v, token)
    if any(isinstance(x, str) for x in v):  # a string element may contain ", "; mixed lists do not occur today
        return all(isinstance(x, str) for x in v) and text == ", ".join(v)
    parts = text.split(", ")
    return len(parts) == len(v) and all(_same_scalar(t, x, k) for t, x, k in zip(parts, v, token))


def _expected_facts(rec, tokens):
    """(label, raw value, float-token value) per documented rule, from the default JSON load."""
    used, _ = _summary_field(rec)
    out = []
    for key, v in rec["properties"].items():
        if key == used or v is None or isinstance(v, dict):
            continue
        if isinstance(v, list) and (not v or any(isinstance(x, (dict, list)) for x in v)):
            continue
        if isinstance(v, str) and not v.strip():
            continue
        out.append((pois.label(key), v, tokens[key]))
    note = rec.get("location_note")
    if used != "location_note" and isinstance(note, str) and note.strip():
        out.append(("Location note", note, note))
    return out


def test_every_fact_is_a_source_value_rendered_by_the_rule(out, records, float_tokens):
    n = 0
    for p in out:
        expected = _expected_facts(records[p["id"]], float_tokens[p["id"]])
        assert [f["label"] for f in p["facts"]] == [lab for lab, _, _ in expected], p["id"]
        for f, (_, v, token) in zip(p["facts"], expected):
            assert list(f) == ["label", "value"] and isinstance(f["value"], str)
            assert _same_value(f["value"], v, token), (p["id"], f, v)
            n += 1
    print(f"{n} facts checked")
    assert n > 0


def test_fact_labels_come_from_key_labels(out):
    labels = set(pois.KEY_LABELS.values()) | {"Location note"}
    assert all(f["label"] in labels for p in out for f in p["facts"])
    assert pois.label("some_new_key") == "Some new key"


def test_evidence_and_limitations_verbatim(out, records):
    for p in out:
        rec = records[p["id"]]
        assert p["evidence"] == rec["evidence"] and p["limitations"] == rec["limitations"], p["id"]
        assert p["name"] == rec["name"] and p["category"] == rec["category"], p["id"]


def test_site_ids_exist_in_sites_json(out, records, site_ids):
    for p in out:
        app = records[p["id"]].get("app_site_id")
        assert p["siteId"] == (app if app in site_ids else None), p["id"]
    assert sum(p["siteId"] is not None for p in out) > 0


def test_group_files_carry_the_validation_caveat(raw):
    for stem in (s for s in GROUP_OF if s in raw):  # additional-sites only when present
        assert CAVEAT in raw[stem]["meta"]["validation"], stem


def test_checked_in_file_equals_fresh_build():
    plain = pois.load_plain()
    pois_, skipped, _ = pois.build(pois.load_docs(), pois.load_site_ids(), plain)
    assert skipped == 0
    assert OUT.read_bytes() == pois.render(pois_)
    assert pois.render(pois_) == pois.render(pois.build(pois.load_docs(), pois.load_site_ids(), plain)[0])


# ---------- plain summary texts (U8): docs/POIs/plain.json merged verbatim ----------

def test_plain_field_equals_plain_json_entry(out):
    plain = json.loads(PLAIN.read_text(encoding="utf-8"))
    assert set(plain) == {p["id"] for p in out}  # every shipped POI has its plain text today, and nothing else
    for p in out:
        assert p["plain"] == plain[p["id"]], p["id"]
        assert list(p["plain"]) == ["type", "bullets"]
        assert p["plain"]["type"].strip() and len(p["plain"]["bullets"]) <= 3, p["id"]


def test_plain_texts_carry_no_research_internals(out):
    """The summary card shows these: no evidence grades in capitals, no file names, no 'not retrieved', no raw signed
    decimal coordinates (U8)."""
    bad = re.compile(r"\b(ESTABLISHED|INDIRECT|DIRECT|MODEL|CONTESTED|SPECULATIVE)\b|\.json|not retrieved|(?<![\w.~-])-\d{1,2}\.\d+\s*,")
    for p in out:
        for text in [p["plain"]["type"], *p["plain"]["bullets"]]:
            assert not bad.search(text), (p["id"], text)


def test_missing_plain_file_adds_no_plain_field(docs, site_ids, tmp_path):
    assert pois.load_plain(tmp_path) is None
    shipped, _, _ = pois.build(docs, site_ids, None)
    assert all(list(p) == POI_KEYS for p in shipped)


def test_plain_json_is_not_a_group_file(docs):
    assert "plain" not in docs  # load_docs skips it, so build() does not call it an unknown file


def test_plain_entry_for_an_unknown_id_or_malformed_raises(docs, site_ids):
    good = pois.load_plain()
    with pytest.raises(pois.PoiError, match="not shipped"):
        pois.build(docs, site_ids, {**good, "hazard:no_such_record": {"type": "Crater", "bullets": []}})
    pid = next(iter(good))
    for bad in ({"type": "", "bullets": []}, {"type": "Crater", "bullets": ["a", "b", "c", "d"]},
                {"type": "Crater", "bullets": [""]}, {"type": "Crater"}, {"type": "Crater", "bullets": [], "x": 1}):
        with pytest.raises(pois.PoiError, match="plain.json"):
            pois.build(copy.deepcopy(docs), site_ids, {**good, pid: bad})


def test_poi_without_a_plain_entry_has_no_plain_field(docs, site_ids):
    good = pois.load_plain()
    pid = next(iter(good))
    shipped, _, _ = pois.build(docs, site_ids, {k: v for k, v in good.items() if k != pid})
    by_id = {p["id"]: p for p in shipped}
    assert "plain" not in by_id[pid]
    assert all("plain" in p for p in shipped if p["id"] != pid)


# ---------- the script refuses bad input (in memory, nothing written) ----------

@pytest.fixture()
def docs():
    return copy.deepcopy(pois.load_docs())


def _first_point(docs, stem):
    raw_doc, tok_doc = docs[stem]
    i = next(k for k, r in enumerate(raw_doc["items"]) if _point(r))
    return raw_doc["items"][i], tok_doc["items"][i]


def test_raises_on_lon_360_disagreement(docs, site_ids):
    rec, _ = _first_point(docs, "hazards")
    rec["geometry"]["lon_east_360"] = (rec["geometry"]["lon_east_180"] + 0.001) % 360
    with pytest.raises(pois.PoiError, match="disagrees"):
        pois.build(docs, site_ids)


def test_raises_on_latitude_out_of_range(docs, site_ids):
    rec, _ = _first_point(docs, "landing-sites")
    rec["geometry"]["lat"] = -90.5
    with pytest.raises(pois.PoiError, match="outside"):
        pois.build(docs, site_ids)


def test_raises_on_duplicate_id(docs, site_ids):
    raw_doc, tok_doc = docs["science-features"]
    rec, tok = _first_point(docs, "science-features")
    raw_doc["items"].append(copy.deepcopy(rec))
    tok_doc["items"].append(copy.deepcopy(tok))
    with pytest.raises(pois.PoiError, match="duplicate"):
        pois.build(docs, site_ids)


def test_raises_on_a_point_in_pgda_study_sites(docs, site_ids):
    for d in docs["pgda-study-sites"]:
        d["items"][0]["geometry"] = {"type": "Point", "lat": -89.0, "lon_east_180": 0.0, "lon_east_360": 0.0}
    with pytest.raises(pois.PoiError, match="pgda-study-sites"):
        pois.build(docs, site_ids)


def test_raises_on_unknown_or_missing_file(docs, site_ids):
    extra = {**docs, "new-layer": docs["hazards"]}
    with pytest.raises(pois.PoiError, match="unknown file"):
        pois.build(extra, site_ids)
    missing = {k: v for k, v in docs.items() if k != "hazards"}
    with pytest.raises(pois.PoiError, match="missing file"):
        pois.build(missing, site_ids)


def test_record_without_source_is_skipped_not_shipped(docs, site_ids):
    rec, _ = _first_point(docs, "hazards")
    rec["sources"] = ["not a url"]
    shipped, skipped, _ = pois.build(docs, site_ids)
    assert skipped == 1
    assert f"hazard:{rec['id']}" not in {p["id"] for p in shipped}


def test_additional_sites_file_is_read_as_landing_when_present(docs, site_ids):
    rec, tok = _first_point(docs, "landing-sites")
    extra_rec, extra_tok = copy.deepcopy(rec), copy.deepcopy(tok)
    extra_rec["id"] = extra_tok["id"] = "researched_point_fixture"
    base = {k: v for k, v in docs.items() if k != "additional-sites"}
    with_extra = {**base, "additional-sites": ({"meta": {}, "items": [extra_rec]}, {"meta": {}, "items": [extra_tok]})}
    before, _, _ = pois.build(base, site_ids)
    after, _, _ = pois.build(with_extra, site_ids)
    assert len(after) == len(before) + 1
    ids = [p["id"] for p in after]
    i = ids.index("landing:researched_point_fixture")
    assert after[i]["group"] == "landing"
    assert all(p["group"] == "landing" for p in after[: i + 1] if p["id"].startswith("landing:"))
    assert after[i + 1]["group"] == "science"  # after every landing-sites record, before the next group
