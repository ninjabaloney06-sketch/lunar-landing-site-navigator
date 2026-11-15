# Texture credits and licence

The four files in this folder are resampled by `scripts/textures.py` from NASA products. Download details, sizes and checksums of the originals: [docs/reference/data-sources.md](../../../docs/reference/data-sources.md#textures-for-the-3d-viewer-downloaded-13-nov-2026-ninjas-mac-approved-by-ninja).

| File | Made from | Source | Credit |
|---|---|---|---|
| `moon_color_4k.webp` | `lroc_color_poles_4k.tif` (LROC WAC colour incl. poles) | [NASA SVS 4720, CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) | NASA's Scientific Visualization Studio; LRO/LROC/LOLA teams |
| `moon_normal_2k.png` | `ldem_16_uint.tif` (LOLA elevation, 16 px/deg) | [NASA SVS 4720, CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) | NASA's Scientific Visualization Studio; LRO/LOLA team |
| `earth_2k.jpg` | `world.200411.3x5400x2700.jpg` (Blue Marble Next Generation, November 2004) | [NASA Earth Observatory, Blue Marble NG (file URL)](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/november/world.200411.3x5400x2700.jpg) | NASA Earth Observatory (Stöckli et al.) |
| `stars_4k.jpg` | `starmap_2020_4k.exr` (Deep Star Maps 2020, J2000 celestial) | [NASA SVS 4851, Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851) | NASA/Goddard Space Flight Center Scientific Visualization Studio |

**Licence:** NASA content, explicitly including "texture maps and polygon data in any format", is "generally not subject to copyright in the United States" and may be used for educational or informational purposes ([NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/), read 14 Nov 2026). The same page says NASA "should be acknowledged as the source", that use must not imply endorsement, and that the NASA insignia and logotype are not in the public domain; the app uses no NASA insignia or logotype.

**Processing note:** `moon_normal_2k.png` assumes 0.5 m per DN for `ldem_16_uint.tif` (not documented in the source; see `scripts/textures.py`). It is a visual layer only; no number in the app comes from it.

## South-cap colour texture (added 14 Nov 2026)

| File | Made from | Source | Credit |
|---|---|---|---|
| `cap_color_2k.webp` | `lroc_color_poles_8k.tif` (LROC WAC colour incl. poles, 8192 x 4096 equirectangular), resampled by `scripts/south_cap.py --texture` into the south polar stereographic square of the cap rasters (+-304 km around the pole, 2048 x 2048; top = toward longitude 0, right = toward 90 E) | [NASA SVS 4720, CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) | NASA's Scientific Visualization Studio; LRO/LROC/LOLA teams |

Same licence as above (NASA media, source acknowledged). The source file carries no georeferencing; its layout (longitude 0 at the image centre, row 0 = 90 N) is the one the globe already uses for `moon_color_4k.webp`, and the resampled texture's orientation is checked against the LOLA relief in `scripts/tests/test_south_cap.py`. The source has about 1.3 km per pixel in latitude near the pole, so the texture is soft: it removes the pinch at the pole, it adds no detail. A visual layer only; no number in the app comes from it.
