"""scripts/tools/sci_checks.py: its vector geometry must give what windows.py gives, and its bounds must bound.

Needs only the shipped JSON, except the last test (real DEM, skipped without CLPS_DATA).
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

import sci_checks as sc  # noqa: E402
import windows as geo  # noqa: E402
from config import APP_DATA  # noqa: E402

DEM = Path(os.environ.get("CLPS_DATA", "~/Documents/clps-data/clps")).expanduser() / "lola" / "LDEM_80S_20MPP_ADJ.TIF"


@pytest.fixture(scope="module")
def ctx():
    months = [geo.load_month(APP_DATA / "ephem" / "2027-08.json")]
    sites = {s["id"]: s for s in sc.load_sites()}
    stations = json.loads((APP_DATA / "stations.json").read_text(encoding="utf-8"))
    return months, sites, stations


@pytest.mark.parametrize("site_id", ["connecting-ridge", "im-1"])
def test_stored_samples_match_windows_sample(ctx, site_id):
    months, sites, _ = ctx
    site, hor = sites[site_id], sc.load_horizon(sites[site_id])
    stack = sc.stack_months(months, "2027-08-10T00:00:00Z", "2027-08-20T00:00:00Z")
    bodies = sc.body_series(site, stack)
    assert len(stack[0]) == 10 * 48
    for i in range(0, len(stack[0]), 37):
        ref = geo.sample(geo.interpolate(months, int(stack[0][i])), site, hor, [])
        for key, flag in (("sun", "lit"), ("earth", "visible")):
            az, el, r = (v[i] for v in bodies[key])
            assert az == pytest.approx(ref[key]["az"], abs=1e-9) and el == pytest.approx(ref[key]["el"], abs=1e-9)
            assert sc.mask_at(hor["mask"], az) == pytest.approx(ref[key]["mask"], abs=1e-12)
            assert sc.disc_fraction(el, ref[key]["mask"], r) == pytest.approx(ref[key]["frac"], abs=1e-12)
            assert bool(sc.visible(bodies[key], hor["mask"])[i]) == ref[key][flag]


def test_period_states_match_windows_state_at(ctx):
    months, sites, stations = ctx
    site, hor = sites["connecting-ridge"], sc.load_horizon(sites["connecting-ridge"])
    ids = [s["id"] for s in stations]
    t0 = geo.iso_to_ms("2027-08-16T00:00:00Z")
    step = 97 * 60_000
    smp = sc.period_samples(site, months, stations, t0, t0 + 14 * 24 * geo.HOUR_MS, step)
    st = sc.period_states(smp, stations, hor["mask"])
    names = {"lit": ("sun", "lit"), "earth": ("earth", "visible"), "cov": ("coverage", "covered")}
    for k, (kind, yes) in names.items():
        ref = [geo.state_at(kind, months, site, hor, stations, ids, t0 + i * step) == yes for i in range(len(st[k]))]
        assert st[k].tolist() == ref
    assert all(0 < sc.pct(st[k]) < 100 for k in ("lit", "cov"))  # the 14 days contain both states of these


def test_closing_truncated_directions_can_only_remove_visibility(ctx):
    months, sites, stations = ctx
    site, hor = sites["im-1"], sc.load_horizon(sites["im-1"])
    t0 = geo.iso_to_ms("2027-08-16T00:00:00Z")
    smp = sc.period_samples(site, months, stations, t0, t0 + 2 * 24 * geo.HOUR_MS, 30 * 60_000)
    a, b = sc.period_states(smp, stations, hor["mask"]), sc.period_states(smp, stations, sc.blocked(hor))
    for k in a:
        assert not np.any(b[k] & ~a[k])
    closed = sc.blocked(hor)
    tb = sc.trunc_bins(hor)
    assert tb.sum() == len(hor["truncated"]) == 380
    assert np.all(closed[tb] == 90.0) and np.array_equal(closed[~tb], np.array(hor["mask"])[~tb])
    whole = dict(hor, truncated=[])
    assert np.array_equal(sc.blocked(whole), np.array(hor["mask"]))


def test_runs_and_azimuth_range_wrap_through_north():
    bins = np.zeros(720, dtype=bool)
    bins[[718, 719, 0, 1, 100]] = True
    assert sc.runs(bins) == [(50.0, 50.0), (359.0, 0.5)]
    assert sc.runs(np.ones(720, dtype=bool)) == [(0.0, 359.5)] and sc.runs(np.zeros(720, dtype=bool)) == []
    assert sc.az_range([350.0, 355.0, 2.0, 8.5]) == (350.0, 8.5)
    assert sc.az_range([10.0, 20.0, 15.0]) == (10.0, 20.0)


def test_reach_bins_marks_the_two_mask_samples_that_decided():
    mask = np.zeros(720)
    az, el, r = np.array([10.2, 200.0]), np.array([0.5, -1.0]), np.array([0.27, 0.27])
    bins = sc.reach_bins((az, el, r), mask)
    assert np.flatnonzero(bins).tolist() == [20, 21]  # 10.0 and 10.5 deg; the body at 200 deg is below the mask


@pytest.mark.skipif(not DEM.exists(), reason="real DEM not available (set CLPS_DATA)")
def test_ray_length_is_passed_in_without_touching_the_constant(ctx):
    import horizon as hz
    _, sites, _ = ctx
    site = sites["connecting-ridge"]
    h150, h300 = sc.horizon_at(site, 150.0), sc.horizon_at(site, 300.0)
    assert hz.RAY_MAX_KM == 300.0 and h150["ray_max_km"] == 150 and h300["ray_max_km"] == 300
    assert h300["mask"] == sc.load_horizon(site)["mask"]  # same as the shipped file
    d = np.array(h300["mask"]) - np.array(h150["mask"])
    # the 300 km ray has every 150 km sample except the last one (at exactly 150 km), so it is lower only there
    assert d.min() > -0.05 and d.max() > 0.1
    assert max(h150["mask_dist_km"]) <= 150.0
