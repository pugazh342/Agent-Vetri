"""``vetri models`` subcommand parser.

``vetri model`` (singular) is the interactive provider/model picker; ``vetri models``
(plural) is its read-only sibling - a non-interactive catalog of what is configured
right now, for humans and scripts alike.
"""

from __future__ import annotations


def build_models_parser(subparsers) -> None:
    """Attach the ``models`` subcommand to ``subparsers``."""
    models_parser = subparsers.add_parser(
        "models",
        help="Show the active model, context window, and configured aliases",
        description=(
            "Non-interactive model catalog: active provider/model, resolved context "
            "window and where it came from, configured aliases and profiles. "
            "Read-only - change things with `vetri model`."
        ),
    )
    models_parser.add_argument(
        "--json", action="store_true",
        help="Machine-readable catalog (model, provider, context, aliases, profiles)",
    )
    models_parser.add_argument(
        "--catalog", action="store_true",
        help="Also list every model in the built-in context-window catalog",
    )

    def _dispatch_models(_args):
        from vetri_cli.models_cmd import cmd_models

        return cmd_models(_args)

    models_parser.set_defaults(func=_dispatch_models)
