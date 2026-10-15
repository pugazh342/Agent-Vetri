"""Resolve VETRI_HOME for standalone skill scripts.

Skill scripts may run outside the Vetri process (e.g. system Python,
nix env, CI) where ``vetri_constants`` is not importable.  This module
provides the same ``get_vetri_home()`` and ``display_vetri_home()``
contracts as ``vetri_constants`` without requiring it on ``sys.path``.

When ``vetri_constants`` IS available it is used directly so that any
future enhancements (profile resolution, Docker detection, etc.) are
picked up automatically.  The fallback path replicates the core logic
from ``vetri_constants.py`` using only the stdlib.

All scripts under ``google-workspace/scripts/`` should import from here
instead of duplicating the ``VETRI_HOME = Path(os.getenv(...))`` pattern.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from vetri_constants import display_vetri_home
    from vetri_constants import get_vetri_home
except (ModuleNotFoundError, ImportError):

    def get_vetri_home() -> Path:
        """Return the Vetri home directory (default: ~/.vetri).

        Mirrors ``vetri_constants.get_vetri_home()``."""
        val = os.environ.get("VETRI_HOME", "").strip()
        return Path(val) if val else Path.home() / ".vetri"

    def display_vetri_home() -> str:
        """Return a user-friendly ``~/``-shortened display string.

        Mirrors ``vetri_constants.display_vetri_home()``."""
        home = get_vetri_home()
        try:
            return "~/" + home.relative_to(Path.home()).as_posix()
        except ValueError:
            return str(home)
