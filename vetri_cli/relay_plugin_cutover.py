"""Shared migration guards for Vetri' native NeMo Relay ownership."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


RELAY_PLUGINS_CONFIG_ENV = "VETRI_NEMO_RELAY_PLUGINS_TOML"

LEGACY_RELAY_PLUGIN_KEYS = frozenset({"nemo_relay", "observability/nemo_relay"})

LEGACY_RELAY_EXPORT_ENV_VARS = frozenset({
    "VETRI_NEMO_RELAY_ATOF_ENABLED",
    "VETRI_NEMO_RELAY_ATOF_OUTPUT_DIRECTORY",
    "VETRI_NEMO_RELAY_ATOF_FILENAME",
    "VETRI_NEMO_RELAY_ATOF_MODE",
    "VETRI_NEMO_RELAY_ATIF_ENABLED",
    "VETRI_NEMO_RELAY_ATIF_OUTPUT_DIRECTORY",
    "VETRI_NEMO_RELAY_ATIF_FILENAME_TEMPLATE",
    "VETRI_NEMO_RELAY_ATIF_AGENT_NAME",
    "VETRI_NEMO_RELAY_ATIF_AGENT_VERSION",
    "VETRI_NEMO_RELAY_ATIF_EXPORT_TIMEOUT_S",
    "VETRI_NEMO_RELAY_ATIF_MODEL_NAME",
    "VETRI_NEMO_RELAY_ATIF_SUBAGENT_EXPORT_MODE",
})


def legacy_relay_plugin_keys(values: Any) -> tuple[str, ...]:
    """Return removed Relay plugin identities present in a config value."""
    if not isinstance(values, (list, tuple, set, frozenset)):
        return ()
    return tuple(sorted({v for v in values if isinstance(v, str) and v in LEGACY_RELAY_PLUGIN_KEYS}))


def configured_legacy_relay_env_vars(env: Mapping[str, Any] | None) -> tuple[str, ...]:
    """Return non-empty legacy Relay exporter variables in *env*."""
    if env is None:
        return ()
    return tuple(sorted(
        name for name in LEGACY_RELAY_EXPORT_ENV_VARS if env.get(name) is not None and str(env[name]).strip()
    ))
