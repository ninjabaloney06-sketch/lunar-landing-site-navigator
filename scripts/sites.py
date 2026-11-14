"""Build app/public/data/sites.json from scripts/sites.csv (Site contract, types.ts).

Horizons (horizons/<id>.json, written by horizon.py) supply elev_m, slope_deg and horizon.
Potential entries come from scripts/site_potential.json ({"<id>": [entries]}) when present.
"""
import csv
import json
import sys
from pathlib import Path

from config import APP_DATA, REPO

SITES_CSV = REPO / "scripts" / "sites.csv"
POTENTIAL_JSON = REPO / "scripts" / "site_potential.json"
OUT = APP_DATA / "sites.json"
HORIZON_DIR = APP_DATA / "horizons"

GROUP_ORDER = ["artemis-2024", "artemis-2022", "reference", "commercial", "clps"]
ALLOWED_GROUPS = set(GROUP_ORDER) | {"international", "apollo"}


def load_rows():
    with SITES_CSV.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def horizon_fields(site_id):
    path = HORIZON_DIR / f"{site_id}.json"
    if not path.exists():
        return {"elev_m": None, "slope_deg": None, "horizon": None}
    h = json.loads(path.read_text(encoding="utf-8"))
    return {
        "elev_m": h.get("elev_m"),
        "slope_deg": h.get("slope_deg"),
        "horizon": f"{site_id}.json",
    }


def potential_for(site_id, table):
    return table.get(site_id, [])


def build():
    table = json.loads(POTENTIAL_JSON.read_text(encoding="utf-8")) if POTENTIAL_JSON.exists() else {}
    sites = []
    for row in load_rows():
        if row["group"] not in ALLOWED_GROUPS:
            raise SystemExit(f"{row['id']}: group {row['group']!r} not allowed")
        site = {
            "id": row["id"],
            "name": row["name"],
            "group": row["group"],
            "label": row["label"] or None,
            "lat": float(row["lat"]),
            "lon": float(row["lon"]),
            "frame_note": row["frame_note"],
            **horizon_fields(row["id"]),
            "far_side": row["far_side"].strip().lower() == "true",
            "source_url": row["source_url"],
            "source_label": row["source_label"],
            "potential": potential_for(row["id"], table),
        }
        sites.append(site)

    def key(s):
        rank = GROUP_ORDER.index(s["group"]) if s["group"] in GROUP_ORDER else len(GROUP_ORDER)
        return (rank, s["name"])

    sites.sort(key=key)
    return sites


def main():
    sites = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(sites, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    for s in sites:
        if not s["potential"]:
            print(f"WARNING: {s['id']} has no potential entries", file=sys.stderr)
    print(f"wrote {len(sites)} sites to {OUT.relative_to(REPO)}")


if __name__ == "__main__":
    main()
