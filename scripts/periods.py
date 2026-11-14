"""Writes app/public/data/periods.json (Brief A step 5, spec "Dates").

Each period is UTC [start_utc, end_utc). The last named day is included, so
end_utc is 00:00Z on the day after it.
"""
import json
from datetime import date, timedelta

from config import APP_DATA

REASON_CANDIDATE = "team candidate period, not a verified best window"

# (id, label, first day, last named day, reason)
# The two 2027 periods keep their old ids; the demo site moved to Connecting Ridge (spec.md, 14 Nov).
PERIODS = [
    ("now", "Now, 14–28 Nov 2026", date(2026, 11, 14), date(2026, 11, 28),
     "demo period of the build plan"),
    ("shackleton-2027-08", "Connecting Ridge, 16–29 Aug 2027", date(2027, 8, 16), date(2027, 8, 29),
     REASON_CANDIDATE),
    ("shackleton-2027-09", "Connecting Ridge, 12–26 Sep 2027", date(2027, 9, 12), date(2027, 9, 26),
     REASON_CANDIDATE),
    ("malapert-2026-12", "Malapert, 21–27 Dec 2026", date(2026, 12, 21), date(2026, 12, 27),
     REASON_CANDIDATE),
    ("malapert-2028-01", "Malapert, 9–15 Jan 2028", date(2028, 1, 9), date(2028, 1, 15),
     REASON_CANDIDATE),
]


def utc_midnight(d: date) -> str:
    return f"{d.isoformat()}T00:00:00Z"


def build() -> list[dict]:
    out = []
    for pid, label, first, last, reason in PERIODS:
        out.append({
            "id": pid,
            "label": label,
            "start_utc": utc_midnight(first),
            "end_utc": utc_midnight(last + timedelta(days=1)),
            "reason": reason,
        })
    return out


def main() -> None:
    path = APP_DATA / "periods.json"
    path.write_text(json.dumps(build(), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
