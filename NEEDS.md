# What we need

Status: `required` · `optional` · `not needed`.

## Accounts and services

| Item | Status | Why |
|---|---|---|
| NASA Space Apps account (each member) | required | Team registration and submission. Each person owns and logs into their own; a device agent may only set up Isaac's |
| GitHub | required | This repo, code, issues |
| Vercel or Cloudflare Pages | required | Free static hosting for the demo URL. Device agent creates it with Isaac's email after approval |
| AI repo agents (Claude Code / Codex / ZCode) | required | Write most scripts, docs and frontend code (see TASKS.md markers). Available: Isaac's Claude account; O has two Claude Max plans |
| AI device agents with computer use | required | Run on Isaac's computers: browser-only pages, downloads, copying data, creating Isaac's accounts, filling forms (tasks tagged `device`; every such action needs Isaac's approval) |
| Password manager (Isaac) | required | Where device agents store credentials for accounts they create. Never in the repo or chat |
| JPL Horizons (web or API) | required | Reference values for validating ephemeris output; no account needed |
| Cloudflare R2 or GitHub Releases | optional | Hosting precomputed data if it exceeds normal repo size |
| LLM API key | optional | Only if we add a "explain this site" text feature. Not part of the core challenge. |

## Account register

Accounts that exist for this project. Add a row when one is created. No passwords, tokens or recovery codes here — those live in the owner's password manager.

| Service | Purpose | Owner (whose email) | Created by | Date |
|---|---|---|---|---|
| GitHub (account hosting this private repo) | Code, plan, build log | Isaac | existing account | — |
| NASA Space Apps (Isaac) | Team owner; CLPS team registration and submission | Isaac | Isaac (self-registered; see open question on parent registration) | before 10 Oct |
| NASA Space Apps (O) | Team member | O | O (self-registered) | before 10 Oct |
| NASA Space Apps (B) | Team member | B | B (self-registered) | before 10 Oct |
| NASA Space Apps (L) | Team member (joined 22 Oct) | L | L (pending) | — |

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
| Isaac's data computer | required | All large downloads (elevation tiles, kernels) go here, done by a device agent running on it, only with Isaac's explicit approval |
| 3 laptops | required | Work machines; only small derived data, copied after approval |
| Power strip + chargers | required | Organiser (13 Oct): cannot guarantee a socket per device per table — bring strips |
| USB stick with data + kernels | required | Venue Wi-Fi may fail. Filled from the data computer by a device agent after approval |
| Bedding (sleeping bags/mats) or an off-site bed | required | Overnight at the venue is allowed with the chaperone, but the organiser provides no sleeping accommodation (13 Oct). Decide by 7 Nov (TASKS.md phase 0) |
| Train/car from Stuttgart | required | Arrive before the 8:30 check-in on Sat 14 Nov; overnight per the phase-0 decision. Humans book and pay |
| Headphones | optional | Focus at the venue. No voice-over in the video (no voices of under-18s in the submission) |

## People and knowledge

| Item | Status | Owner |
|---|---|---|
| Someone who can verify orbital/coordinate math | required | Proposed: L (physics, joined 22 Oct), backed by a mentor and hard checks against JPL Horizons / PGDA |
| Someone who can handle GeoTIFF/raster data | required | Nobody claims it; Isaac + AI agents, L checks the geometry, O reviews the code (see `docs/decisions.md`, team strengths) |
| Product, UI decisions and pitch | required | Isaac |
| A mentor with lunar mission or geodesy background | optional | Ask on day 1 in Heilbronn |
| Accompanying Betreuer (provided by Isaac's school, decided 16 Oct) | required | One adult can cover all three (organiser, 13 Oct); now four with L — Sarah to confirm; must stay with the team for the whole event incl. overnight (organiser, 13 Oct). Name pending from the school |
| Written parental authorisation, one per participant | required | Names the Betreuer and authorises them for the whole event; bring originals on 14 Nov (organiser, 13 Oct). NASA terms additionally say "parent or legal guardian" — Sarah to confirm in writing that this scheme is accepted (TASKS.md phase 0) |
