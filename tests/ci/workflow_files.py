"""Resolve workflow files across the active and parked workflow directories.

The lean v0.3.0 CI keeps upstream's release/orchestration workflows parked in
``.github/workflows-upstream/`` (re-adoption is a v0.3.1 item), but their
graph contracts still guard the parked definitions. Every loader resolves a
workflow NAME against the active directory first and falls back to the parked
copy; directory globs see both sets so parked-only workflows stay guarded.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ACTIVE = ROOT / ".github" / "workflows"
PARKED = ROOT / ".github" / "workflows-upstream"


def workflow_file(name: str) -> Path:
    """The active workflow of this name, else its parked copy."""
    active = ACTIVE / name
    return active if active.exists() else PARKED / name


def workflow_paths(pattern: str = "*.y*ml") -> list[Path]:
    """Every workflow file matching ``pattern``, active and parked (active wins)."""
    seen = {path.name: path for path in PARKED.glob(pattern)}
    seen.update({path.name: path for path in ACTIVE.glob(pattern)})
    return [seen[name] for name in sorted(seen)]
