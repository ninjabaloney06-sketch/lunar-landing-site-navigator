"""Python reference windows/summaries (windows.py) on the shipped ephemeris and horizon: no raw data needed.

Checks the properties V5/V8 rely on: windows tile [start, end) without gaps, neighbours differ in state, each
edge is a real state change within EDGE_TOL_MS, and the summary agrees with the 30-min samples.
"""
import json

import pytest

import windows as geo
from config import APP_DATA

START = geo.iso_to_ms("2027-08-16T00:00:00Z")
END = START + 2 * 24 * geo.HOUR_MS  # two days keep the 1-min scan fast


@pytest.fixture(scope="module")
def ctx():
    months = [geo.load_month(APP_DATA / "ephem" / "2027-08.json")]
    site = next(s for s in json.loads((APP_DATA / "sites.json").read_text(encoding="utf-8"))
                if s["id"] == "connecting-ridge")
    horizon = json.loads((APP_DATA / "horizons" / site["horizon"]).read_text(encoding="utf-8"))
    stations = json.loads((APP_DATA / "stations.json").read_text(encoding="utf-8"))
    return months, site, horizon, stations


@pytest.mark.parametrize("kind", ["sun", "earth", "coverage"])
def test_windows_tile_the_period_and_edges_are_real(ctx, kind):
    months, site, horizon, stations = ctx
    ids = [s["id"] for s in stations]
    ws = geo.windows(months, site, horizon, stations, kind, ids, START, END)
    assert ws[0]["startMs"] == START and ws[-1]["endMs"] == END
    for a, b in zip(ws, ws[1:]):
        assert a["endMs"] == b["startMs"] and a["state"] != b["state"]
        e = a["endMs"]
        tol = geo.EDGE_TOL_MS
        assert geo.state_at(kind, months, site, horizon, stations, ids, e - tol) == a["state"]
        assert geo.state_at(kind, months, site, horizon, stations, ids, e + tol) == b["state"]


def test_summary_matches_samples(ctx):
    months, site, horizon, stations = ctx
    ids = [s["id"] for s in stations]
    sun = geo.windows(months, site, horizon, stations, "sun", ids, START, END)
    earth = geo.windows(months, site, horizon, stations, "earth", ids, START, END)
    cov = geo.windows(months, site, horizon, stations, "coverage", ids, START, END)
    s = geo.summarize(sun, earth, cov, START, END)
    step = 30 * 60_000
    lit = [geo.state_at("sun", months, site, horizon, stations, ids, t) == "lit" for t in range(START, END, step)]
    # edge refinement can move each edge by up to half a step against the sample count
    assert abs(s["litPct"] - 100 * sum(lit) / len(lit)) <= 100 * (len(sun) * 0.5) / len(lit) + 1e-9
    assert 0 <= s["coveragePct"] <= 100 and s["unknownPct"] == 0
