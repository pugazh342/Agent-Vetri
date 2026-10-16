"""``vetri models`` - non-interactive model catalog.

Shows the active provider/model, the resolved context window (and whether it came
from config, the built-in catalog, or a runtime fallback), configured
``model_aliases:`` entries, and multiplex profiles. Read-only: changing the model
stays with ``vetri model`` / config edits.

``--json`` writes only JSON to stdout so scripts can consume it.
"""

from __future__ import annotations

import json
from typing import Any, Optional


def _active_model(config: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """Return ``(model name, normalized model dict)`` from the merged config.

    Tolerates every documented shape: a bare string ``model:``, the flat dict with
    ``default``/``model``/``name`` keys, and the doubly-nested
    ``model: {model: {model: ..., provider: ...}}`` form.
    """
    raw = config.get("model")
    model: dict[str, Any] = dict(raw) if isinstance(raw, dict) else {}
    if raw and not isinstance(raw, dict):
        model["default"] = str(raw)
    name: Any = model.get("default") or model.get("model") or model.get("name") or ""
    if isinstance(name, dict):  # {"model": {"model": ..., "provider": ...}}
        nested = name
        name = nested.get("model") or nested.get("default") or ""
        for key in ("provider", "base_url", "api_base", "context_length"):
            if nested.get(key) and not model.get(key):
                model[key] = nested[key]
    return str(name or ""), model


def _catalog_context(model: str) -> tuple[Optional[int], str]:
    """``(context tokens, source label)`` from the static catalog. Display-only best
    effort: exact key first, then the longest family key contained in the name;
    runtime probing may still refine the number for live endpoints."""
    if not model:
        return None, ""
    from agent.model_metadata import DEFAULT_CONTEXT_LENGTHS, DEFAULT_FALLBACK_CONTEXT

    table = DEFAULT_CONTEXT_LENGTHS
    lower = model.lower()
    if lower in table:
        return table[lower], "catalog"
    best_key: Optional[str] = None
    for key in table:
        if len(key) >= 3 and key in lower and (best_key is None or len(key) > len(best_key)):
            best_key = key
    if best_key:
        return table[best_key], f"catalog-family ({best_key})"
    return DEFAULT_FALLBACK_CONTEXT, "fallback"


def _alias_target(value: Any) -> str:
    """Format one ``model_aliases:`` entry (string or dict) for display."""
    if isinstance(value, dict):
        target = str(value.get("model") or value.get("default") or "?")
        provider = str(value.get("provider") or "").strip()
        return f"{target}  (provider: {provider})" if provider else target
    return str(value)


def _profiles(config: dict[str, Any]) -> dict[str, str]:
    """Extract ``name -> model line`` for configured multiplex profiles, if any."""
    out: dict[str, str] = {}
    profiles = config.get("profiles")
    if not isinstance(profiles, dict):
        return out
    for name, prof in profiles.items():
        if not isinstance(prof, dict):
            continue
        pm, _ = _active_model(prof)
        prov = str(prof.get("provider") or "").strip()
        out[str(name)] = f"{pm or '(default)'}  (provider: {prov})" if prov else (pm or "(default)")
    return out


def cmd_models(args) -> int:
    """Handler for ``vetri models [--json] [--catalog]``."""
    from vetri_cli.config import load_config

    config = load_config()
    model_name, model_cfg = _active_model(config)

    provider = str(model_cfg.get("provider") or config.get("provider") or "").strip() or None
    base_url = (
        model_cfg.get("base_url") or model_cfg.get("api_base")
        or config.get("base_url") or config.get("api_base") or None
    )

    override = model_cfg.get("context_length") or config.get("context_length")
    if override:
        try:
            context: Optional[int] = int(override)
            source = "config"
        except (TypeError, ValueError):
            context, source = _catalog_context(model_name)
    else:
        context, source = _catalog_context(model_name)

    # Top-level model_aliases: wins over model.aliases: (documented precedence).
    aliases: dict[str, Any] = {}
    nested_aliases = model_cfg.get("aliases")
    if isinstance(nested_aliases, dict):
        aliases.update(nested_aliases)
    top_aliases = config.get("model_aliases")
    if isinstance(top_aliases, dict):
        aliases.update(top_aliases)

    payload: dict[str, Any] = {
        "model": model_name,
        "provider": provider,
        "base_url": base_url,
        "context_length": context,
        "context_source": source,
        "aliases": {str(k): _alias_target(v) for k, v in sorted(aliases.items())},
        "profiles": _profiles(config),
    }

    if getattr(args, "catalog", False):
        from agent.model_metadata import DEFAULT_CONTEXT_LENGTHS

        payload["catalog"] = [
            {"model": key, "context_length": DEFAULT_CONTEXT_LENGTHS[key]}
            for key in sorted(DEFAULT_CONTEXT_LENGTHS)
        ]

    if getattr(args, "json", False):
        print(json.dumps(payload, indent=2))
        return 0

    print()
    print("Active model")
    if model_name:
        print(f"  model        {model_name}")
    else:
        print("  model        (none configured - run `vetri model`)")
    print(f"  provider     {provider or '(auto/default)'}")
    if base_url:
        print(f"  endpoint     {base_url}")
    if context:
        ctx_text = f"  context      {context:,} tokens"
        if source == "config":
            ctx_text += "  (config override)"
        elif source == "catalog":
            ctx_text += "  (catalog)"
        elif source.startswith("catalog-family"):
            ctx_text += f"  ({source})"
        elif source == "fallback":
            ctx_text += "  (fallback - not yet probed)"
        print(ctx_text)

    if payload["aliases"]:
        print()
        print("Aliases (model_aliases:)")
        for name, target in payload["aliases"].items():
            print(f"  {name}  ->  {target}")

    if payload["profiles"]:
        print()
        print("Profiles")
        for name, line in payload["profiles"].items():
            print(f"  {name}: {line}")

    if getattr(args, "catalog", False):
        print()
        print(f"Context-window catalog ({len(payload['catalog'])} models)")
        for row in payload["catalog"]:
            print(f"  {row['model']:<44} {row['context_length']:>12,}")
    else:
        from agent.model_metadata import DEFAULT_CONTEXT_LENGTHS

        print()
        print(
            f"Known context windows: {len(DEFAULT_CONTEXT_LENGTHS)} models in the built-in "
            "catalog - `vetri models --catalog` lists them."
        )
    print("Change the active model with: vetri model")
    return 0
