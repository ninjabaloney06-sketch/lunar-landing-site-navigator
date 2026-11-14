"""periods.json: five ids, UTC [start, end) with the last named day included."""
from datetime import date, datetime, timedelta, timezone

from periods import PERIODS, build

START_LIMIT = datetime(2026, 11, 1, tzinfo=timezone.utc)
END_LIMIT = datetime(2031, 1, 1, tzinfo=timezone.utc)


def parse(s):
    assert s.endswith("T00:00:00Z"), s
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def test_five_ids():
    ids = [p["id"] for p in build()]
    assert ids == ["now", "shackleton-2027-08", "shackleton-2027-09",
                   "malapert-2026-12", "malapert-2028-01"]


def test_start_before_end_and_within_range():
    for p in build():
        s, e = parse(p["start_utc"]), parse(p["end_utc"])
        assert s < e, p["id"]
        assert START_LIMIT <= s and e <= END_LIMIT, p["id"]


def test_end_is_day_after_last_named_day():
    by_id = {p["id"]: p for p in build()}
    for pid, _label, first, last, _reason in PERIODS:
        p = by_id[pid]
        expected_end = datetime(last.year, last.month, last.day, tzinfo=timezone.utc) + timedelta(days=1)
        assert parse(p["end_utc"]) == expected_end, pid
        assert parse(p["start_utc"]).date() == first, pid


def test_spec_dates():
    by_id = {p["id"]: p for p in build()}
    assert by_id["shackleton-2027-08"]["end_utc"] == "2027-08-30T00:00:00Z"
    assert by_id["now"]["end_utc"] == "2026-11-29T00:00:00Z"
    assert by_id["malapert-2028-01"]["start_utc"] == "2028-01-09T00:00:00Z"
    assert by_id["now"]["reason"] == "demo period of the build plan"
    assert by_id["malapert-2026-12"]["reason"] == "team candidate period, not a verified best window"
