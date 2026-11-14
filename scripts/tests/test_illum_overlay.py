"""Registration check for the shipped "% time lit" overlays (terrain/<id>-illum.png), no raw data needed.

A correctly placed average-illumination map is brighter on local highs (ridges, rims) than in local lows, so
on a 40 km tile its values correlate positively with local relief (height minus a ~2 km box mean). A map that is
offset, scaled or rotated against the terrain gives r close to 0. Review of 14 Nov: tiles from the 75S map give
r = +0.31..+0.52; all 14 tiles from the 85S map give |r| <= 0.07 under any flip or rotation, i.e. misplaced.
Cause: GDAL reads the 85S label's CENTER_LONGITUDE = 180, the data line up with lon_0 = 0 (assessments.py,
ILLUM_CRS_NOTE). terrain_tiles.py now reads that map with the DEM's CRS and records "illum_crs" in each tile JSON.
Tiles from the 85S map without that field were built before the fix and are marked xfail(strict=True) until
terrain_tiles.py is rerun on the data computer; after the rerun they carry the field and must pass.
"""
import json

import numpy as np
import pytest

from config import APP_DATA

TERRAIN = APP_DATA / "terrain"
MIN_R = 0.15
BOX = 25  # samples (25 x 80 m = 2 km)


def _tiles():
    return sorted(p.stem for p in TERRAIN.glob("*.json"))


def _relief_corr(site_id):
    from numpy.lib.stride_tricks import sliding_window_view
    from PIL import Image

    meta = json.loads((TERRAIN / f"{site_id}.json").read_text(encoding="utf-8"))
    n = meta["size"]
    h = np.fromfile(TERRAIN / f"{site_id}.bin", "<i2").reshape(n, n).astype(float)
    h[h == meta["nodata"]] = np.nan
    pad = np.pad(h, BOX // 2, mode="edge")
    with np.errstate(all="ignore"):
        local = h - np.nanmean(sliding_window_view(pad, (BOX, BOX)), axis=(-1, -2))
    la = np.asarray(Image.open(TERRAIN / meta["illum_png"]))
    lit, alpha = la[..., 0].astype(float), la[..., 1]
    ok = np.isfinite(local) & (alpha > 0)
    return meta, float(np.corrcoef(local[ok], lit[ok])[0, 1])


def _params():
    out = []
    for sid in _tiles():
        meta = json.loads((TERRAIN / f"{sid}.json").read_text(encoding="utf-8"))
        marks = []
        if str(meta.get("illum_map", "")).startswith("avgvisib_85s") and "illum_crs" not in meta:
            marks.append(pytest.mark.xfail(strict=True, reason="85S overlay built with the label's lon_0 = 180 (review 14 Nov); rerun terrain_tiles.py"))
        out.append(pytest.param(sid, marks=marks, id=sid))
    return out


@pytest.mark.parametrize("site_id", _params())
def test_overlay_follows_terrain(site_id):
    pytest.importorskip("PIL")
    meta, r = _relief_corr(site_id)
    assert r >= MIN_R, f"{site_id}: lit fraction vs local relief r = {r:+.2f} (map {meta['illum_map']})"
