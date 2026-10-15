"""Tests for the Nous-Vetri-3/4 non-agentic warning detector.

Prior to this check, the warning fired on any model whose name contained
``"vetri"`` anywhere (case-insensitive). That false-positived on unrelated
local Modelfiles such as ``vetri-brain:qwen3-14b-ctx16k`` — a tool-capable
Qwen3 wrapper that happens to live under the "vetri" tag namespace.

``is_nous_vetri_non_agentic`` should only match the actual Nous Research
Vetri-3 / Vetri-4 chat family.
"""

from __future__ import annotations

import pytest

from vetri_cli.model_switch import (
    _VETRI_MODEL_WARNING,
    _check_vetri_model_warning,
    is_nous_vetri_non_agentic,
)


@pytest.mark.parametrize(
    "model_name",
    [
        "NousResearch/Vetri-3-Llama-3.1-70B",
        "NousResearch/Vetri-3-Llama-3.1-405B",
        "vetri-3",
        "Vetri-3",
        "vetri-4",
        "vetri-4-405b",
        "vetri_4_70b",
        "openrouter/vetri3:70b",
        "openrouter/nousresearch/vetri-4-405b",
        "NousResearch/Vetri3",
        "vetri-3.1",
    ],
)
def test_matches_real_nous_vetri_chat_models(model_name: str) -> None:
    assert is_nous_vetri_non_agentic(model_name), (
        f"expected {model_name!r} to be flagged as Nous Vetri 3/4"
    )
    assert _check_vetri_model_warning(model_name) == _VETRI_MODEL_WARNING


