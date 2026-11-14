"""Processed 3D textures for the globe (build-plan §5.4 "Assets") -> app/public/textures/.

  moon_color_4k.webp   4096 x 2048 from lroc_color_poles_4k.tif (LROC colour, SVS 4720)
  moon_normal_2k.png   2048 x 1024 tangent-space normal map from ldem_16_uint.tif (LOLA 16 px/deg)
  earth_2k.jpg         2048 x 1024 from world.200411.3x5400x2700.jpg (Blue Marble NG)

All maps keep the source's equirectangular layout and orientation (no flips, no mirroring).
stars_4k.jpg is not produced: the EXR driver is missing from this venv (see the report).
"""
import math
import sys

import numpy as np
import rasterio
from rasterio.enums import Resampling
from PIL import Image

from config import REPO, data_root

R_M = 1737400.0
OUT = REPO / "app" / "public" / "textures"

# ASSUMED height encoding of ldem_16_uint.tif (not documented in docs/reference/data-sources.md):
# linear, 0.5 m per DN. Only the slope scale depends on it; the offset cancels in the gradient.
DN_TO_M = 0.5
NORMAL_STRENGTH = 1.0  # 1.0 = true slopes at the map's sample spacing; C1 tunes the visual strength


def moon_color():
    src = data_root() / "textures" / "lroc_color_poles_4k.tif"
    im = Image.open(src).convert("RGB")
    if im.size != (4096, 2048):
        im = im.resize((4096, 2048), Image.Resampling.LANCZOS)
    out = OUT / "moon_color_4k.webp"
    im.save(out, "WEBP", quality=88, method=6)
    return out


def moon_normal():
    src = data_root() / "textures" / "ldem_16_uint.tif"
    w, h = 2048, 1024
    with rasterio.open(src) as d:
        dn = d.read(1, out_shape=(h, w), resampling=Resampling.average).astype(np.float64)
    height = dn * DN_TO_M

    lat = math.pi / 2 - (np.arange(h) + 0.5) / h * math.pi  # row 0 = north
    dx = (2 * math.pi * R_M * np.cos(lat) / w)[:, None]  # metres per column, per row
    dy = math.pi * R_M / h  # metres per row

    g_east = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) / (2 * dx)  # wraps in longitude
    g_north = -np.gradient(height, axis=0) / dy  # row index grows southward

    nx = -g_east * NORMAL_STRENGTH
    ny = -g_north * NORMAL_STRENGTH
    nz = np.ones_like(nx)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    rgb = np.stack([nx / norm, ny / norm, nz / norm], axis=-1) * 0.5 + 0.5
    img = Image.fromarray(np.rint(rgb * 255).astype(np.uint8), "RGB")
    out = OUT / "moon_normal_2k.png"
    img.save(out, optimize=True)
    return out


def earth():
    src = data_root() / "textures" / "world.200411.3x5400x2700.jpg"
    im = Image.open(src).convert("RGB").resize((2048, 1024), Image.Resampling.LANCZOS)
    out = OUT / "earth_2k.jpg"
    im.save(out, "JPEG", quality=88, optimize=True, progressive=True)
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for make in (moon_color, moon_normal, earth):
        path = make()
        size_mb = path.stat().st_size / 1e6
        print(f"{path.relative_to(REPO)}: {size_mb:.2f} MB")
        if size_mb > 3.0:
            print(f"WARNING: {path.name} is above 3 MB", file=sys.stderr)


if __name__ == "__main__":
    main()
