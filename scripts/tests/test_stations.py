"""Brief A step 8: station geometry and catalogue. Sub-site station sees the Moon at ~90 deg, its antipode at
~-90 deg; overlapping windows are not double-counted; a missing min_elev_deg raises. Plus: the reversed LT+S
geometry agrees with an independent SPICE spkcpt computation, both-ends LOS reasons, and the CSV -> JSON shape."""
import json
import math
import os

import numpy as np
import pytest

import stations as st_mod
import windows as geo
from config import APP_DATA

needs_spice = pytest.mark.skipif(not os.environ.get("CLPS_DATA"), reason="CLPS_DATA not set (raw SPICE kernels)")

SHACKLETON = {"lat": -89.7668, "lon": -171.87, "elev_m": None}  # Lunar Surface Data Book table A2-2 (spec.md)

# Inline CSV rows: test inputs for the parser only (not the catalogue).
ROW = {
    "id": "goldstone", "name": "DSS-24 (34 m BWG)", "network": "DSN", "complex": "Goldstone",
    "lat_deg": "35.339892822", "lon_deg": "-116.874794425", "h_m": "951.499", "datum": "WGS 84 ellipsoid",
    "min_elev_deg": "6.0", "source_url": "https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301P.pdf",
    "source_label": "DSN 810-005 module 301",
}
STATION_KEYS = {"id", "name", "network", "complex", "lat_deg", "lon_deg", "h_m", "datum", "min_elev_deg",
                "source_url", "source_label", "link_state_inputs"}


@pytest.fixture(scope="module")
def month():
    return [geo.load_month(APP_DATA / "ephem" / "2027-08.json")]


def synthetic_station(lat, lon, min_elev=0.0):
    return {"id": "s", "lat_deg": lat, "lon_deg": lon, "h_m": 0.0, "min_elev_deg": min_elev}


def sub_site_point(state, site):
    """Geodetic lat/lon whose surface normal points at the lunar site (Earth-fixed frame of the state)."""
    site_km = geo.site_vector(site["lat"], site["lon"], geo.site_height_km(site["elev_m"]))
    v = geo.quat_to_matrix(state["q_earth_to_me"]).T @ (site_km - np.asarray(state["earth_km"]))
    v = geo.unit(v)
    return math.degrees(math.asin(v[2])), math.degrees(math.atan2(v[1], v[0])), site_km


# ---------- geometry ----------

def test_sub_site_station_sees_moon_at_zenith_and_antipode_at_nadir(month):
    for hour in (0, 7, 13, 19):
        state = geo.interpolate(month, geo.iso_to_ms(f"2027-08-16T{hour:02d}:00:00Z"))
        lat, lon, site_km = sub_site_point(state, SHACKLETON)
        up_el = geo.moon_el_at_station(synthetic_station(lat, lon), site_km, state)
        down_el = geo.moon_el_at_station(synthetic_station(-lat, lon + 180 if lon < 0 else lon - 180), site_km, state)
        print(f"{hour:02d}h sub-site ({lat:.3f}, {lon:.3f}): Moon el {up_el:.4f}; antipode {down_el:.4f}")
        assert up_el > 89.9
        assert down_el < -89.9


def test_both_ends_reasons(month):
    t = geo.iso_to_ms("2027-08-20T00:00:00Z")
    state = geo.interpolate(month, t)
    site_km = geo.site_vector(SHACKLETON["lat"], SHACKLETON["lon"], geo.site_height_km(None))
    earth_el = geo.az_el(state["earth_km"], site_km, geo.enu_basis(SHACKLETON["lat"], SHACKLETON["lon"]))[1]
    assert earth_el > 1.0, earth_el  # precondition: Earth well above a flat horizon
    lat, lon, _ = sub_site_point(state, SHACKLETON)
    zenith = synthetic_station(lat, lon, min_elev=6.0)
    antipode = synthetic_station(-lat, lon + 180 if lon < 0 else lon - 180, min_elev=6.0)
    flat = geo.station_los(zenith, SHACKLETON, state, None)
    wall = {"az_step": 0.5, "mask": [10.0] * 720}  # synthetic 10 deg wall all round
    walled = geo.station_los(zenith, SHACKLETON, state, wall)
    far = geo.station_los(antipode, SHACKLETON, state, None)
    print(f"Earth el {earth_el:.3f}", flat, walled, far, sep="\n")
    assert flat["state"] == "los" and flat["reason"] is None
    assert walled["state"] == "blocked" and walled["reason"] == "terrain"
    assert far["state"] == "blocked" and far["reason"] == "station-mask"
    assert far["moonElAtStation"] < -89.9


@needs_spice
def test_reversed_geometry_matches_spice_spkcpt():
    """Model (Earth seen from the Moon at t, IAU_EARTH at t - lt) vs SPICE's apparent site seen from Earth with
    LT+S at t - lt: the model's station epoch. Same-UTC comparison differs by the 1.3 s light time (<= 0.006 deg)."""
    import spiceypy as sp

    import ephemeris
    ephemeris.load_kernels()
    station = {"lat_deg": 35.339892822, "lon_deg": -116.874794425, "h_m": 951.499}
    s_ef = geo.geodetic_to_ecef_km(station["lat_deg"], station["lon_deg"], station["h_m"])
    up = geo.geodetic_up(station["lat_deg"], station["lon_deg"])
    site_km = geo.site_vector(SHACKLETON["lat"], SHACKLETON["lon"], geo.site_height_km(None))
    worst_station_epoch = worst_same_utc = 0.0
    et0 = sp.str2et("2027-08-16T00:00:00")
    for k in range(96):
        et = et0 + k * 900.0
        model = geo.moon_el_at_station(station, site_km, ephemeris.body_state(et))
        _, lt = sp.spkpos("EARTH", et, "MOON_ME", "LT+S", "MOON")
        for et_e, label in ((et - lt, "station"), (et, "same")):
            pos, _ = sp.spkcpt(site_km, "MOON", "MOON_ME", et_e, "IAU_EARTH", "OBSERVER", "LT+S", "EARTH")
            d = geo.unit(np.asarray(pos[:3]) - s_ef)
            ref = math.degrees(math.atan2(float(d @ up), float(np.linalg.norm(np.cross(d, up)))))
            if label == "station":
                worst_station_epoch = max(worst_station_epoch, abs(model - ref))
            else:
                worst_same_utc = max(worst_same_utc, abs(model - ref))
    print(f"model vs spkcpt: {worst_station_epoch:.5f} deg at the station epoch t - lt; "
          f"{worst_same_utc:.5f} deg at the same UTC")
    assert worst_station_epoch < 0.001
    assert worst_same_utc < 0.006


# ---------- union ----------

def test_union_of_overlapping_windows_is_not_double_counted():
    a = (0, 10)
    b = (5, 15)
    assert geo.union_intervals([a, b]) == [(0, 15)]
    assert geo.total_length([a, b]) == 15 < (10 + 10)
    assert geo.total_length([(0, 2), (4, 6), (1, 5)]) == 6
    assert geo.total_length([(0, 2), (3, 4)]) == 3


def test_coverage_state_union(month):
    smp = {"stations": {"a": {"state": "los"}, "b": {"state": "blocked"}}}
    assert geo.coverage_state(smp, ["a", "b"]) == "covered"
    assert geo.coverage_state(smp, ["b"]) == "none"
    assert geo.coverage_state(smp, ["b", "missing"]) == "unknown"
    assert geo.coverage_state(smp, []) == "none"


# ---------- catalogue ----------

def test_missing_min_elev_raises_instead_of_defaulting():
    with pytest.raises(st_mod.StationError, match="min_elev_deg missing"):
        st_mod.parse_row({**ROW, "min_elev_deg": ""})
    with pytest.raises(st_mod.StationError, match="min_elev_deg missing"):
        st_mod.parse_row({k: v for k, v in ROW.items() if k != "min_elev_deg"})


def test_other_bad_rows_raise():
    for bad in ({"source_url": ""}, {"source_url": "deepspace.jpl.nasa.gov"}, {"network": "NASA"},
                {"lat_deg": "95"}, {"lon_deg": "x"}, {"datum": ""}):
        with pytest.raises(st_mod.StationError):
            st_mod.parse_row({**ROW, **bad})
    with pytest.raises(st_mod.StationError, match="duplicate"):
        st_mod.parse_rows([ROW, ROW])


def test_row_maps_to_station_contract():
    s = st_mod.parse_row(ROW)
    assert set(s) == STATION_KEYS
    assert s["link_state_inputs"] == "unknown"
    assert s["lon_deg"] == -116.874794425 and s["min_elev_deg"] == 6.0


def test_csv_round_trip(tmp_path):
    csv_path = tmp_path / "stations.csv"
    header = ",".join(st_mod.COLUMNS)
    csv_path.write_text(header + "\n" + ",".join(ROW[c] for c in st_mod.COLUMNS) + "\n")
    out = tmp_path / "stations.json"
    st_mod.main(["--csv", str(csv_path), "--out", str(out)])
    data = json.loads(out.read_text())
    assert len(data) == 1 and set(data[0]) == STATION_KEYS


def test_shipped_stations_json_is_generated_from_stations_csv():
    rows = json.loads((APP_DATA / "stations.json").read_text())
    assert rows
    assert rows == st_mod.load_csv(), "stations.json is stale: run python3 scripts/stations.py"
    for r in rows:
        assert set(r) == STATION_KEYS and "SYNTHETIC" not in json.dumps(r)
        assert r["source_url"].startswith("https://") and isinstance(r["min_elev_deg"], float)
