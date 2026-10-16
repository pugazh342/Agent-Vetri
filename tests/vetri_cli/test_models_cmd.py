"""Tests for ``vetri models`` (vetri_cli.models_cmd) - the non-interactive model catalog.

Behaviour contracts: the command reflects the merged config (whatever shape the
model key takes), ``--json`` is machine-readable and stable-keyed, and ``--catalog``
attaches the static context-window table.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from vetri_cli import models_cmd


def _args(**kwargs) -> SimpleNamespace:
    defaults = {"json": False, "catalog": False}
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


@pytest.fixture
def patch_config(monkeypatch):
    """Replace the config loader the handler imports at call time."""
    def _apply(config: dict):
        monkeypatch.setattr("vetri_cli.config.load_config", lambda: dict(config))
    return _apply


def test_active_model_tolerates_all_documented_shapes():
    # bare string
    assert models_cmd._active_model({"model": "m1"})[0] == "m1"
    # flat dict
    assert models_cmd._active_model({"model": {"default": "m2"}})[0] == "m2"
    # nested provider form carries provider up
    name, cfg = models_cmd._active_model(
        {"model": {"model": {"model": "m3", "provider": "p3"}}})
    assert name == "m3"
    assert cfg.get("provider") == "p3"
    # absent
    assert models_cmd._active_model({})[0] == ""


def test_cmd_models_json_reflects_config(patch_config, capsys):
    patch_config({
        "model": "unit/model-1",
        "provider": "unitprov",
        "model_aliases": {"fast": "unit/model-2"},
    })
    rc = models_cmd.cmd_models(_args(json=True))
    out = json.loads(capsys.readouterr().out)
    assert rc == 0
    assert out["model"] == "unit/model-1"
    assert out["provider"] == "unitprov"
    assert out["aliases"]["fast"] == "unit/model-2"
    # context resolved somehow and labelled with its source
    assert isinstance(out["context_length"], int)
    assert out["context_source"]


def test_cmd_models_context_config_override_wins(patch_config, capsys):
    patch_config({
        "model": {"default": "some-unknown-model", "context_length": 123456},
    })
    models_cmd.cmd_models(_args(json=True))
    out = json.loads(capsys.readouterr().out)
    assert out["context_length"] == 123456
    assert out["context_source"] == "config"


def test_cmd_models_catalog_flag_adds_table(patch_config, capsys):
    patch_config({})
    models_cmd.cmd_models(_args(json=True, catalog=True))
    out = json.loads(capsys.readouterr().out)
    catalog = out["catalog"]
    assert isinstance(catalog, list) and catalog, "catalog must be populated"
    row = catalog[0]
    assert set(row) == {"model", "context_length"}
    assert all(isinstance(r["context_length"], int) for r in catalog[:20])


def test_cmd_models_pretty_mode_mentions_change_command(patch_config, capsys):
    patch_config({"model": "m-x", "provider": "p-x"})
    rc = models_cmd.cmd_models(_args())
    text = capsys.readouterr().out
    assert rc == 0
    assert "m-x" in text
    assert "vetri model" in text
    assert "--catalog" in text  # discoverability of the catalog flag
