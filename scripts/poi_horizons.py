"""Terrain horizons for the point records in docs/POIs, and the search list built from them.

    python3 scripts/poi_horizons.py                    # every POI inside the 20 m DEM, nearest first
    python3 scripts/poi_horizons.py --limit 20         # at most 20 new horizons, then the search list
    python3 scripts/poi_horizons.py --only poi-cold-trap-atlas-01
    python3 scripts/poi_horizons.py --force            # recompute horizon files that already exist

Records: docs/POIs/<file>.json items whose `geometry` is a Point with numeric `lat` and `lon_east_180`
(group from the file name, FILE_GROUPS). Skipped, each printed with its reason: records with an
`app_site_id` (already an app site), coordinates out of range, a second record with an already used file
stem, no source, points outside the 20 m DEM, and points horizon.py raises ValueError for.

Horizons: horizon.horizon_for_site with the 120 m fill DEM, as horizon.py's run_one calls it, written to
app/public/data/horizons/poi-<group>-<id>.json with site_id = that stem and lat/lon = the record's `lat`
and `lon_east_180`. Same guard as run_one: a point over 60 s or 4 GB peak RSS is not written and the run
stops. Existing files are reused (unless --force). Computation order: ascending great-circle distance to
the nearest of the scripts/sites.csv rows and the south pole, so an interrupted run has the nearest points.

Search list: app/public/data/search-sites.json, one Site-shaped entry (app/src/data/types.ts) per POI that
has a horizon file, sorted by id, plus `poi_id` ("<group>:<record id>", the id format of pois.ts).

far_side rule (build-plan §3: "true if Earth can never rise"): sites.py copies a hand-set column; for a
POI it is derived. The point is taken on the smooth 1737.4 km sphere (site = 1737.4 km * up,
up = unit(lat, lon)); far_side is true only if the elevation of the Earth's centre,
asin(dot(unit(earth_km - site), up)), is below 0 at every time step of every shipped month file
app/public/data/ephem/YYYY-MM.json (`earth_km`, MOON_ME). It ignores terrain (Earth hidden behind a ridge
does not count) and covers only the shipped months; ephem/sample.json, a synthetic placeholder, is not read.
"""
import argparse
import csv
import json
import math
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import numpy as np

from config import APP_DATA, REPO, data_root
from horizon import (ABORT_RSS_BYTES, ABORT_SECONDS, DEM_NAME, FILL_DEM_NAME, HORIZON_DIR, R_KM, SITES_CSV,
                     horizon_for_site, inside_dem, peak_rss_bytes, unit)

POI_DIR = REPO / "docs" / "POIs"
EPHEM_DIR = APP_DATA / "ephem"
SEARCH_JSON = APP_DATA / "search-sites.json"
# Read order matters: of two records with the same stem, the later one is skipped.
FILE_GROUPS = {
    "hazards": "hazard",
    "ice-volatile-evidence": "water",
    "psr-cold-traps": "cold-trap",
    "illumination-sites": "light",
    "landing-sites": "landing",
    "science-features": "science",
    "additional-sites": "landing",
}
OPTIONAL_FILES = {"additional-sites"}
FRAME_DEFAULT = "frame not stated in source (MOON_ME assumed)"
SIZE_BUDGET_BYTES = 2_500_000  # all poi-*.json together (track brief, 14 Nov)


def stem(group, record_id):
    """`poi-<group>-<id>`: id lowercased, every run of characters outside [a-z0-9] one hyphen, no edge hyphens."""
    return f"poi-{group}-" + re.sub(r"[^a-z0-9]+", "-", record_id.lower()).strip("-")


def frame_note(rec):
    f, loc = rec.get("frame"), rec.get("location_note")
    note = f if isinstance(f, str) and f.strip() else FRAME_DEFAULT
    if isinstance(loc, str) and loc.strip():
        note += "; " + loc
    return note


def far_side(lat, lon, earth_km):
    """True only if Earth's centre is below the smooth-sphere horizon at every step of `earth_km` (N x 3, km)."""
    up = unit(lat, lon)
    v = np.asarray(earth_km, dtype=float) - R_KM * up
    el = np.arcsin(np.clip((v @ up) / np.linalg.norm(v, axis=1), -1, 1))
    return bool(np.all(el < 0))


def load_earth_km(ephem_dir=EPHEM_DIR):
    files = sorted(Path(ephem_dir).glob("[0-9][0-9][0-9][0-9]-[0-9][0-9].json"))
    if not files:
        raise SystemExit(f"no month files ephem/YYYY-MM.json in {ephem_dir}")
    earth = [np.asarray(json.loads(f.read_text(encoding="utf-8"))["earth_km"], dtype=float) for f in files]
    return np.concatenate(earth), len(files)


def _num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def point_of(rec):
    g = rec.get("geometry")
    if isinstance(g, dict) and g.get("type") == "Point" and _num(g.get("lat")) and _num(g.get("lon_east_180")):
        return g["lat"], g["lon_east_180"]
    return None


def coord_problem(geo):
    lat, lon, l360 = geo["lat"], geo["lon_east_180"], geo.get("lon_east_360")
    if not -90 <= lat <= 90:
        return f"lat {lat} out of range"
    if not -180 <= lon <= 180:
        return f"lon_east_180 {lon} out of range"
    if _num(l360) and abs((l360 - lon + 180) % 360 - 180) > 1e-6:
        return f"lon_east_180 {lon} and lon_east_360 {l360} disagree"
    return None


def first_source(rec):
    s = rec.get("sources")
    if isinstance(s, list) and s and isinstance(s[0], str) and urlparse(s[0]).hostname:
        return s[0]
    return None


def load_records(poi_dir=POI_DIR):
    """[(file, group, record)] in read order, and {file: (items, point records)}."""
    out, counts = [], {}
    for name, group in FILE_GROUPS.items():
        path = Path(poi_dir) / f"{name}.json"
        if not path.exists():
            if name in OPTIONAL_FILES:
                continue
            raise SystemExit(f"{path} is missing")
        items = json.loads(path.read_text(encoding="utf-8"))["items"]
        pts = [r for r in items if point_of(r)]
        counts[name] = (len(items), len(pts))
        out += [(name, group, r) for r in pts]
    return out, counts


def select(records, dem_path):
    """POIs to ship and [(reason, detail)] for the point records that are not."""
    pois, skipped, used = [], [], {}
    for name, group, rec in records:
        rid = rec.get("id")
        label = f"{name}:{rid}"
        if rec.get("app_site_id"):
            skipped.append(("already an app site (app_site_id)", f"{label} = {rec['app_site_id']}"))
            continue
        if not isinstance(rid, str) or not re.search(r"[a-z0-9]", rid.lower()):
            skipped.append(("no usable id", label))
            continue
        bad = coord_problem(rec["geometry"])
        if bad:
            skipped.append(("coordinates look wrong", f"{label}: {bad}"))
            continue
        s = stem(group, rid)
        if s in used:
            skipped.append(("file stem already used", f"{label} -> {s}, first used by {used[s]}"))
            continue
        used[s] = label
        if not isinstance(rec.get("name"), str) or not rec["name"].strip():
            skipped.append(("no name", label))
            continue
        url = first_source(rec)
        if not url:
            skipped.append(("no source URL", label))
            continue
        lat, lon = point_of(rec)
        if not inside_dem(lat, lon, dem_path):
            skipped.append(("outside the 20 m DEM", f"{label} ({lat}, {lon})"))
            continue
        pois.append({"stem": s, "group": group, "rec": rec, "lat": lat, "lon": lon, "source_url": url})
    return pois, skipped


def anchor_units():
    with SITES_CSV.open(newline="", encoding="utf-8") as f:
        pts = [(float(r["lat"]), float(r["lon"])) for r in csv.DictReader(f)]
    return np.array([unit(la, lo) for la, lo in pts + [(-90.0, 0.0)]])


def nearest_anchor_deg(lat, lon, anchors):
    return float(np.degrees(np.arccos(np.clip(anchors @ unit(lat, lon), -1, 1))).min())


def reusable(path, p):
    h = json.loads(path.read_text(encoding="utf-8"))
    return h.get("lat") == p["lat"] and h.get("lon") == p["lon"] and h.get("site_id") == p["stem"]


def poi_bytes():
    return sum(f.stat().st_size for f in HORIZON_DIR.glob("poi-*.json"))


def entry(p, earth):
    h = json.loads((HORIZON_DIR / f"{p['stem']}.json").read_text(encoding="utf-8"))
    rec, url = p["rec"], p["source_url"]
    return {
        "id": p["stem"],
        "name": rec["name"],
        "group": "poi",
        "label": None,
        "lat": p["lat"],
        "lon": p["lon"],
        "frame_note": frame_note(rec),
        "elev_m": h.get("elev_m"),
        "slope_deg": h.get("slope_deg"),
        "horizon": f"{p['stem']}.json",
        "far_side": far_side(p["lat"], p["lon"], earth),
        "source_url": url,
        "source_label": urlparse(url).hostname,
        "potential": [],
        "poi_id": f"{p['group']}:{rec['id']}",
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--limit", type=int, help="compute at most N new horizons")
    ap.add_argument("--only", metavar="STEM", help="compute only this POI")
    ap.add_argument("--force", action="store_true", help="recompute horizon files that exist")
    args = ap.parse_args(argv)
    dem_path = data_root() / "lola" / DEM_NAME
    fill_path = data_root() / "lola" / FILL_DEM_NAME
    for p in (dem_path, fill_path):
        if not p.exists():
            raise SystemExit(f"{p} is missing: see its row in docs/reference/data-sources.md")

    records, counts = load_records()
    pois, skipped = select(records, dem_path)
    if args.only and args.only not in {p["stem"] for p in pois}:
        raise SystemExit(f"{args.only}: not a POI stem, or skipped (a run without --only prints why)")

    anchors = anchor_units()
    order = sorted(pois, key=lambda p: (nearest_anchor_deg(p["lat"], p["lon"], anchors), p["stem"]))
    computed, reused, failed, times, pending, over_budget = [], [], set(), [], [], []
    attempts = 0
    for p in order:
        if args.only and p["stem"] != args.only:
            continue
        path = HORIZON_DIR / f"{p['stem']}.json"
        if path.exists() and not args.force and reusable(path, p):
            reused.append(p)
            continue
        if over_budget or (args.limit is not None and attempts >= args.limit):
            (over_budget if over_budget else pending).append(p["stem"])
            continue
        attempts += 1
        t0 = time.perf_counter()
        try:
            res = horizon_for_site(p["stem"], p["lat"], p["lon"], dem_path, fill_path=fill_path)
        except ValueError as e:
            skipped.append(("horizon.py ValueError", f"{p['group']}:{p['rec']['id']}: {e}"))
            failed.add(p["stem"])
            continue
        secs = time.perf_counter() - t0
        rss = peak_rss_bytes()
        m = res["mask"]
        print(f"{p['stem']}: {secs:.1f} s, peak RSS {rss / 1e6:.0f} MB, elev {res['elev_m']} m, "
              f"slope {res['slope_deg']} deg, mask {min(m):.3f}..{max(m):.3f} deg, "
              f"truncated {len(res['truncated'])}/720")
        if secs > ABORT_SECONDS or rss > ABORT_RSS_BYTES:
            print(f"ABORT: {p['stem']} took {secs:.1f} s / peak RSS {rss / 1e9:.2f} GB "
                  f"(limits {ABORT_SECONDS:.0f} s, 4 GB); not written, stopping.", file=sys.stderr)
            sys.exit(2)
        text = json.dumps(res, separators=(",", ":")) + "\n"
        old = path.stat().st_size if path.exists() else 0
        if poi_bytes() - old + len(text.encode("utf-8")) > SIZE_BUDGET_BYTES:
            print(f"SIZE BUDGET: {p['stem']} would take poi-*.json over {SIZE_BUDGET_BYTES} bytes; "
                  "not written, no further horizons.", file=sys.stderr)
            over_budget.append(p["stem"])
            continue
        HORIZON_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        computed.append(p)
        times.append(secs)

    earth, n_months = load_earth_km()
    have = [p for p in pois if p["stem"] not in failed and (HORIZON_DIR / f"{p['stem']}.json").exists()]
    sites = sorted((entry(p, earth) for p in have), key=lambda s: s["id"])
    SEARCH_JSON.write_text(json.dumps(sites, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    known = {p["stem"] for p in have}
    orphans = sorted(f.stem for f in HORIZON_DIR.glob("poi-*.json") if f.stem not in known)

    print("\nrecords read (items, point records):")
    for name, (n, k) in counts.items():
        print(f"  {name}: {n}, {k}")
    if "additional-sites" not in counts:
        print("  additional-sites: file not present")
    print("per group (computed this run, reused, in search list):")
    for g in dict.fromkeys(FILE_GROUPS.values()):
        print(f"  {g}: {sum(p['group'] == g for p in computed)}, {sum(p['group'] == g for p in reused)}, "
              f"{sum(p['group'] == g for p in have)}")
    reasons = {}
    for r, d in skipped:
        reasons.setdefault(r, []).append(d)
    print(f"skipped: {len(skipped)}")
    for r, ds in reasons.items():
        print(f"  {r}: {len(ds)}")
        for d in ds:
            print(f"    {d}")
    if pending:
        print(f"not computed yet (--limit): {len(pending)}")
    if over_budget:
        print(f"missing because of the size budget: {len(over_budget)}: {', '.join(over_budget)}")
    if orphans:
        print(f"WARNING: horizon files without a current POI (not in the search list): {', '.join(orphans)}")
    print(f"poi-*.json total: {poi_bytes()} bytes in {len(list(HORIZON_DIR.glob('poi-*.json')))} files")
    if times:
        print(f"seconds per point: mean {sum(times) / len(times):.1f}, max {max(times):.1f} ({len(times)} points)")
    print(f"peak RSS {peak_rss_bytes() / 1e6:.0f} MB")
    print(f"far_side from {n_months} month files: {sum(s['far_side'] for s in sites)} of {len(sites)} true")
    print(f"wrote {len(sites)} entries to {SEARCH_JSON.relative_to(REPO)}")


if __name__ == "__main__":
    main()
