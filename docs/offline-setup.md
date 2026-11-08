# Offline laptop setup — every laptop ready offline

Repo-only part of the TASKS.md phase-2 task "Every laptop ready offline" (`[AI+H]` `device`).
Each person runs their OS section on their own laptop (a device agent sets up Isaac's laptop,
which is macOS); the self-test in §5 is what "each person confirms with a tutorial example
that runs offline" means concretely. The repo records no OS per person — run the macOS
section on a Mac, the Windows 11 section on a PC.

Boundaries:

- Preparation only: installers and the libraries' own quickstart examples, nothing about our
  sites, our data or our app (prep rule in [AGENTS.md](../AGENTS.md)). Every example below is
  the library's tutorial example or a trivial variant of it.
- Do this at home before 13 Nov, on real internet. Downloads per laptop total roughly
  300–500 MB (installers + pip wheels + npm packages + saved doc pages). Not on venue Wi-Fi.
- `naif0012.tls` (5 KB) is the only data file: the leap-seconds kernel, same one as in the
  [download-checklist](download-checklist.md); each laptop fetches its own copy in §5.
- Optional NEEDS.md items (skyfield cross-check, MapLibre/Leaflet site map) are not needed for
  this check — the site map is first on the event cut list anyway.

Versions pinned on 2026-10-25, verified read-only via `pip index versions <pkg>` and
`npm view <pkg> version` (nothing was installed to write this file). Install exactly these
pins; if a newer stable exists on your day, the pinned lines still work.

| Tool / package | Pin | Note |
|---|---|---|
| Python | 3.13.x (3.12–3.15 all fine) | ≥ 3.12 matters: current numpy/scipy/rasterio/pyproj wheels require it; on 3.11 pip resolves to older releases |
| Node.js | 24 LTS (any ≥ 22.12) | Vite 8 engines: `^20.19.0 \|\| >=22.12.0` |
| git | latest | any recent version |
| VS Code (editor) | latest | or your own editor |
| spiceypy | 8.3.0 | pip |
| numpy | 2.5.4 | pip |
| scipy | 1.18.1 | pip |
| rasterio | 1.5.2 | pip; the wheel bundles GDAL — no separate GDAL install |
| pyproj | 3.8.0 | pip; bundles PROJ, works offline |
| pytest | 9.1.1 | pip |
| skyfield | 1.55 | optional; quickstart needs a ~17 MB BSP — only if you actually cross-check |
| Vite / React | 8.3.5 / 19.3.1 | via the `npm create vite` scaffold (create-vite 9.3.1) |
| plotly.js-dist-min | 4.1.2 | D, recommended polar-plot path |
| d3 | 7.9.0 | D alternative to Plotly |
| Claude Code | 2.1.310 | npm global; login needs internet — do it while online |

## 1 — macOS (Homebrew)

```bash
xcode-select --install          # git via Command Line Tools (or: brew install git)
brew install python@3.13 node   # node formula = current release (≥ 22.12, satisfies Vite 8)
brew install --cask visual-studio-code

# verify (new terminal window so PATH is fresh):
python3.13 --version            # expect 3.13.x
node --version && npm --version # expect v24+ (any ≥ 22.12)
git --version
```

Python libraries in a scratch venv (outside this repo — learning.md ground rule):

```bash
mkdir -p ~/clps-tutorial && cd ~/clps-tutorial
python3.13 -m venv .venv && source .venv/bin/activate
python -m pip install --upgrade pip
pip install spiceypy==8.3.0 numpy==2.5.4 scipy==1.18.1 rasterio==1.5.2 pyproj==3.8.0 pytest==9.1.1
# optional cross-check only: pip install skyfield==1.55
```

## 2 — Windows 11 (winget)

Run in PowerShell. Installers come from winget; no manual PATH editing needed.

```powershell
winget install --id Git.Git -e
winget install --id Python.Python.3.13 -e
winget install --id OpenJS.NodeJS.LTS -e    # Node 24 LTS (≥ 22.12, satisfies Vite 8)
winget install --id Microsoft.VisualStudioCode -e
```

Open a NEW PowerShell window (PATH updates only apply there), then verify:

```powershell
git --version
py -3.13 --version                # expect 3.13.x
node --version; npm --version     # expect v24+ (any ≥ 22.12)
```

Python libraries in a scratch venv (outside this repo — learning.md ground rule):

```powershell
mkdir $env:USERPROFILE\clps-tutorial; cd $env:USERPROFILE\clps-tutorial
py -3.13 -m venv .venv
.venv\Scripts\activate            # if blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
python -m pip install --upgrade pip
pip install spiceypy==8.3.0 numpy==2.5.4 scipy==1.18.1 rasterio==1.5.2 pyproj==3.8.0 pytest==9.1.1
# optional cross-check only: pip install skyfield==1.55
```

## 3 — Node libraries and Claude Code (everyone; D especially)

The Vite scaffold pulls packages from the npm registry — run it while online. Afterwards
`node_modules/` is local and `npm run dev` / `npm run build` never touch the network.

```bash
mkdir -p ~/node-tutorial && cd ~/node-tutorial     # Windows: mkdir $env:USERPROFILE\node-tutorial; cd ...
npm create vite@latest my-vite-app -- --template react   # create-vite 9.3.1, React 19.3.1, Vite 8.3.5
cd my-vite-app
npm install
npm run dev        # browser opens the scaffold; Ctrl-C to stop
npm run build      # must end without errors and create dist/
npm install plotly.js-dist-min@4.1.2    # D, recommended; alternative: npm install d3@7.9.0
```

Claude Code (needs internet to log in — do this while online, then it stays logged in):

```bash
npm install -g @anthropic-ai/claude-code    # 2.1.310 on 2026-10-25
claude            # log in with the account you will use at the event
```

## 4 — Save the tutorial pages offline (per role, from [learning.md](learning.md))

Same URLs on every OS. macOS/Linux: one wget per page, all small (single page + assets).
Windows 11: no wget — open each URL and "Save as → Webpage, Complete" (Ctrl+S). react.dev
is heavy either way — browser save-as is the better route for it on all OSes.

| Person (rows in learning.md) | Pages to save |
|---|---|
| All | Claude Code docs: common-workflows (git worktrees), sub-agents |
| S (L) | spiceypy docs + example page; NAIF tutorials + lessons index (open the time and frames lessons); Horizons manual |
| Q (O) | pytest Get Started + its fixtures and parametrize pages |
| D (B) | Vite guide; React Learn (save-as); Plotly getting-started + polar-chart (or D3 getting-started + d3-shape line) |
| I | spiceypy example page; rasterio quickstart; pyproj docs + advanced examples |

wget pattern — one command per URL, run online from a scratch folder:

```bash
mkdir -p offline-docs && cd offline-docs
WGET='wget --mirror --convert-links --adjust-extension --page-requisites --no-parent --level=1 -e robots=off'
$WGET -P claude-code https://code.claude.com/docs/en/common-workflows
$WGET -P claude-code https://code.claude.com/docs/en/sub-agents
$WGET -P spiceypy   https://spiceypy.readthedocs.io/en/latest/exampleone.html
$WGET -P naif       https://naif.jpl.nasa.gov/naif/tutorials.html
$WGET -P naif       https://naif.jpl.nasa.gov/naif/lessons.html
$WGET -P horizons   https://ssd.jpl.nasa.gov/horizons/manual.html
$WGET -P pytest     https://docs.pytest.org/en/stable/getting-started.html
$WGET -P pytest     https://docs.pytest.org/en/stable/how-to/fixtures.html
$WGET -P pytest     https://docs.pytest.org/en/stable/how-to/parametrize.html
$WGET -P vite       https://vite.dev/guide/
$WGET -P plotly     https://plotly.com/javascript/getting-started/
$WGET -P plotly     https://plotly.com/javascript/polar-chart/
$WGET -P d3         https://d3js.org/getting-started
$WGET -P d3         https://d3js.org/d3-shape/line
$WGET -P rasterio   https://rasterio.readthedocs.io/en/stable/quickstart.html
$WGET -P pyproj     https://pyproj4.github.io/pyproj/stable/advanced_examples.html
# react.dev/learn: browser save-as (Save Page As → Web Page, Complete) — wget renders it poorly
```

(Commands listed only — nothing was mirrored to write this file. Each page stays in the
low-single-digit MBs; total well under 100 MB.)

## 5 — Offline self-test (Wi-Fi OFF; per person, in the scratch venv)

One tiny example per library, all taken from the library's own tutorial pages, nothing about
our app. Preparation (the only online step): put the leap-seconds kernel next to the scripts.

```bash
cd ~/clps-tutorial        # Windows: cd $env:USERPROFILE\clps-tutorial
curl -fL -O https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls   # 5 KB
# now switch Wi-Fi off, activate the venv, and run every file below with: python <file>
```

`check_spice.py` — spiceypy docs example pattern (furnsh + str2et + et2utc).
Pass: prints `2026-11-14T09:00:00.000`.

```python
import spiceypy
spiceypy.furnsh("naif0012.tls")
et = spiceypy.str2et("2026-11-14T09:00:00")
print(spiceypy.et2utc(et, "ISOC", 3))
```

`check_numpy.py` — numpy quickstart example (arange + reshape).
Pass: prints `15 2.5`.

```python
import numpy as np
a = np.arange(6).reshape(2, 3)
print(a.sum(), a.mean())
```

`check_scipy.py` — scipy interpolate tutorial example (CubicSpline).
Pass: prints `0.988` (the cubic spline's approximation at 1.5).

```python
import numpy as np
from scipy.interpolate import CubicSpline
cs = CubicSpline(np.arange(10), np.sin(np.arange(10)))
print(round(float(cs(1.5)), 3))
```

`check_raster.py` — rasterio quickstart "Creating data" example, polar-stereographic CRS.
Pass: prints `EPSG:3031 (1.0, 1.0) 0.0`. If this imports, GDAL is fine (bundled in the wheel).

```python
import numpy as np, rasterio
from rasterio.transform import from_origin
with rasterio.open("check.tif", "w", driver="GTiff", width=4, height=4, count=1,
                   dtype="float32", crs="EPSG:3031", transform=from_origin(0, 4, 1, 1)) as dst:
    dst.write(np.arange(16, dtype="float32").reshape(4, 4), 1)
with rasterio.open("check.tif") as src:
    print(src.crs, src.res, src.read(1)[0, 0])
```

`check_proj.py` — pyproj Transformer example (round-trip, no expected constant needed).
Pass: prints `100.0 -85.0`.

```python
from pyproj import Transformer
fwd = Transformer.from_crs("EPSG:4326", "EPSG:3031", always_xy=True)
back = Transformer.from_crs("EPSG:3031", "EPSG:4326", always_xy=True)
x, y = fwd.transform(100.0, -85.0)
print(*back.transform(x, y))
```

`test_sample.py` — pytest "Get Started" example, run with `pytest -v`.
Pass: `1 passed`.

```python
def inc(x):
    return x + 1

def test_answer():
    assert inc(3) == 4
```

Node / git (still Wi-Fi off):

- `cd my-vite-app && npm run dev` — page opens; edit `src/App.jsx`, save, browser updates
  without reload errors (the learning.md done-when). Then `npm run build` — must succeed.
- Plotly (D): in a folder that has `node_modules/plotly.js-dist-min`, save this as
  `plotly-check.html` and double-click it (works over `file://`, no server, no network):

```html
<!doctype html>
<meta charset="utf-8">
<script src="node_modules/plotly.js-dist-min/plotly.min.js"></script>
<div id="plot"></div>
<script>
Plotly.newPlot("plot", [{x: [1, 2, 3, 4], y: [10, 15, 13, 17], type: "scatter"}]);
</script>
```

  Pass: the getting-started scatter chart renders. (D3 alternative: same file:// pattern
  with `node_modules/d3/dist/d3.min.js` and the d3 getting-started line example.)
- git worktrees (all; the learning.md practice): `git init toy && cd toy &&
  git commit --allow-empty -m init && git worktree add ../toy-b -b branch-b`, edit a
  different file in each worktree, commit both, `git merge branch-b` — both branches merged
  without conflict.

## 6 — Printable checklist (10 lines, one per laptop)

```
1. Python 3.12+ installed        python3.13 --version / py -3.13 --version   -> 3.13.x
2. Node >= 22.12                 node --version                              -> v24+
3. git present                   git --version
4. venv in ~/clps-tutorial       source .venv/bin/activate / .venv\Scripts\activate
5. All pip pins installed        pip list | findstr / grep spiceypy          -> 8.3.0
6. GDAL ok (bundled)             python -c "import rasterio; print(rasterio.__version__)"
7. Vite scaffold builds          npm run dev + npm run build in my-vite-app
8. Plotly (or d3) local          plotly-check.html renders from file:// (D)
9. Claude Code logged in         claude --version answers (do while online)
10. Wi-Fi OFF: all §5 checks green, doc pages open from disk -> tell Isaac "ready offline"
```

## 7 — Ninja's Mac setup, 6 Nov 2026

Prepared on ninja's Mac (`isaacmac`) at `~/Documents/clps-offline-prep`, outside this repo:

- Existing Python 3.14.8 and Node v26.7.0; ninja confirmed tools/login already ready.
- `.venv`: all six required Python library pins above installed; exact transitive versions in `requirements.lock.txt` there.
- `node-tutorial`: create-vite's React tutorial scaffold, Vite 8.3.5, React/React DOM 19.3.1, Plotly 4.1.2, installed dependencies and package lock retained for offline use.
- `docs/index.html`: 12 readable offline pages covering ninja's learning rows plus Vite, React, Plotly and Pytest; source URLs and capture hashes in `docs/manifest.json`. Text/code/images are local; interactive examples and external links require internet.
- The small leap-seconds kernel was copied from the previously approved local download; no mission data was processed.
- Online preflight passed: library tutorial examples, pytest sample, Vite production build, and saved-doc local resource checks. Ninja then reported the offline check worked and local pages opened in Safari; pasted terminal output confirms Python examples, pytest and Vite build passed. On 8 Nov ninja confirmed React live updates work with Wi-Fi off. **Ninja's laptop preparation is complete**; O/B/L's laptop confirmations remain pending.

Ninja completed the offline React dev-server/live-update check on 8 Nov. Full local handoff: `~/Documents/clps-offline-prep/README.md`.
