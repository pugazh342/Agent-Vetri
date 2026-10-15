"""Resolve VETRI_HOME for standalone skill scripts.

Skill scripts may run outside the Vetri process (system Python, nix env,
CI) where ``vetri_constants`` is not importable.  This module provides the
same ``get_vetri_home()`` contract without requiring it on ``sys.path``.

When ``vetri_constants`` IS available it is used directly so profile
resolution and any future enhancements are picked up automatically.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from vetri_constants import get_vetri_home
except (ModuleNotFoundError, ImportError):

    def get_vetri_home() -> Path:
        """Return the Vetri home directory (default: ``~/.vetri``)."""
        val = os.environ.get("VETRI_HOME", "").strip()
        return Path(val) if val else Path.home() / ".vetri"
