"""Shared paths. Raw data root comes from CLPS_DATA (build-plan §2)."""
import os
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
APP_DATA = REPO / "app" / "public" / "data"


def data_root() -> Path:
    root = os.environ.get("CLPS_DATA")
    if not root:
        raise SystemExit(
            "Set CLPS_DATA to the raw data folder "
            "(~/Documents/clps-data/clps on ninja's Mac, or the USB stick's clps/)."
        )
    path = Path(root).expanduser()
    if not path.is_dir():
        raise SystemExit(f"CLPS_DATA does not exist: {path}")
    return path
