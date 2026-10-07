# What we need

Status: `required` · `optional` · `not needed`.

## Accounts and services

| Item | Status | Why |
|---|---|---|
| NASA Space Apps account (each member) | required | Team registration and submission |
| GitHub | required | This repo, code, issues |
| Vercel or Cloudflare Pages | required | Free static hosting for the demo URL |
| AI coding assistant (Claude Code / Codex) | required | Writes most scripts and frontend code (see TASKS.md markers) |
| JPL Horizons (web or API) | required | Reference values for validating ephemeris output; no account needed |
| Cloudflare R2 or GitHub Releases | optional | Hosting precomputed data if it exceeds normal repo size |
| Supabase | not needed | All results are precomputed and served as static JSON. No users, no writes, no auth. Add only if we later want saved comparisons or accounts. |
| LLM API key | optional | Only if we add a "explain this site" text feature. Not part of the core challenge. |

## Data

| Item | Status | Source |
|---|---|---|
| NAIF SPICE kernels (de440s, leap seconds, lunar orientation, PCK) | required | naif.jpl.nasa.gov |
| LOLA south-pole elevation maps (~20 m/px, 5 m near key sites) | required | pgda.gsfc.nasa.gov (LRO LOLA) |
| Published south-pole illumination maps | required | pgda.gsfc.nasa.gov, for validation |
| Site coordinates (Artemis III regions, CLPS polar sites) | required | NASA mission pages, papers |
| LROC imagery / basemap tiles | optional | Moon Trek / LROC, for a nicer site map |
| Official challenge resources | required | Challenge page, expected 28 Oct |

## Software

| Item | Status | Use |
|---|---|---|
| Python 3.11+ | required | All computation scripts |
| `spiceypy` | required | Sun/Earth positions in the lunar local frame |
| `skyfield` | optional | Cross-check for ephemeris |
| `numpy`, `scipy` | required | Horizon ray casting, interpolation |
| `rasterio` / GDAL | required | Reading polar stereographic elevation GeoTIFFs |
| `pyproj` | required | Polar stereographic ↔ lat/lon |
| `pytest` | required | Tests for ephemeris and horizon scripts |
| Node.js 20+ | required | Frontend build |
| Vite + React (or Next.js static export) | required | Frontend |
| D3 or Plotly | required | Polar sky plot and timeline |
| MapLibre / Leaflet | optional | Site picker map |
| Screen recorder (QuickTime / OBS) | required | Demo video |
| Slides tool | required | Pitch deck |

## Hardware and logistics

| Item | Status | Note |
|---|---|---|
| 3 laptops with ≥ 20 GB free disk | required | Elevation tiles are large |
| Power strip + chargers | required | Venue sockets are usually scarce |
| USB stick with data + kernels | required | Venue Wi-Fi may fail |
| Train/car from Stuttgart | required | Day trip 13–15 Nov |
| Headphones + mic | optional | Recording voice-over |

## People and knowledge

| Item | Status | Owner |
|---|---|---|
| Someone who can verify orbital/coordinate math | required | Science teammate |
| Someone who can handle GeoTIFF/raster data | required | Data/web teammate |
| Product, UI decisions and pitch | required | Isaac |
| A mentor with lunar mission or geodesy background | optional | Ask on day 1 in Heilbronn |
