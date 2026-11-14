"""Earth ground-station catalogue: scripts/stations.csv -> app/public/data/stations.json (Brief A step 6).

Every row needs a primary source URL and a sourced min_elev_deg; a missing value raises instead of defaulting
(Brief A trap 8). Coordinates are geodetic (WGS 84 or GRS80 ellipsoid, see each row's datum; the two differ by
less than 0.1 mm at the surface), east-positive longitude, height in metres.

    python3 scripts/stations.py            # read scripts/stations.csv, write app/public/data/stations.json
    python3 scripts/stations.py --csv PATH # read another CSV (e.g. for a check), same output
"""
import argparse
import csv
import json
import sys
from pathlib import Path

from config import APP_DATA, REPO

CSV_PATH = REPO / "scripts" / "stations.csv"
OUT_PATH = APP_DATA / "stations.json"
COLUMNS = ["id", "name", "network", "complex", "lat_deg", "lon_deg", "h_m", "datum", "min_elev_deg",
           "source_url", "source_label"]
NETWORKS = {"DSN", "ESTRACK", "JAXA"}


class StationError(ValueError):
    pass


def _number(row, key, lo, hi):
    raw = (row.get(key) or "").strip()
    if raw == "":
        raise StationError(f"{row.get('id') or '?'}: {key} missing (no default; source it or leave the station out)")
    try:
        v = float(raw)
    except ValueError as exc:
        raise StationError(f"{row.get('id')}: {key} is not a number: {raw!r}") from exc
    if not lo <= v <= hi:
        raise StationError(f"{row.get('id')}: {key} = {v} outside [{lo}, {hi}]")
    return v


def parse_row(row):
    """One CSV row (dict of strings) -> Station dict (types.ts Station). Raises StationError."""
    sid = (row.get("id") or "").strip()
    if not sid:
        raise StationError("row without id")
    for key in ("name", "complex", "datum", "source_url", "source_label"):
        if not (row.get(key) or "").strip():
            raise StationError(f"{sid}: {key} missing")
    network = row["network"].strip()
    if network not in NETWORKS:
        raise StationError(f"{sid}: network {network!r} not in {sorted(NETWORKS)}")
    url = row["source_url"].strip()
    if not url.startswith("https://") and not url.startswith("http://"):
        raise StationError(f"{sid}: source_url is not a URL: {url!r}")
    return {
        "id": sid,
        "name": row["name"].strip(),
        "network": network,
        "complex": row["complex"].strip(),
        "lat_deg": _number(row, "lat_deg", -90, 90),
        "lon_deg": _number(row, "lon_deg", -180, 180),
        "h_m": _number(row, "h_m", -500, 9000),
        "datum": row["datum"].strip(),
        "min_elev_deg": _number(row, "min_elev_deg", -5, 90),
        "source_url": url,
        "source_label": row["source_label"].strip(),
        "link_state_inputs": "unknown",
    }


def parse_rows(rows):
    out, seen = [], set()
    for row in rows:
        st = parse_row(row)
        if st["id"] in seen:
            raise StationError(f"{st['id']}: duplicate id")
        seen.add(st["id"])
        out.append(st)
    return out


def load_csv(path=CSV_PATH):
    path = Path(path)
    if not path.is_file():
        raise SystemExit(f"stations CSV not found: {path}")
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        missing = [c for c in COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            raise StationError(f"{path.name}: missing columns {missing}")
        return parse_rows(reader)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", default=str(CSV_PATH))
    ap.add_argument("--out", default=str(OUT_PATH))
    args = ap.parse_args(argv)
    stations = load_csv(args.csv)
    Path(args.out).write_text(json.dumps(stations, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(stations)} stations to {args.out}: {', '.join(s['id'] for s in stations)}")


if __name__ == "__main__":
    sys.exit(main())
