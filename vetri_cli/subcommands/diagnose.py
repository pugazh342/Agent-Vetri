"""``vetri diagnose`` subcommand parser."""

from __future__ import annotations


def build_diagnose_parser(subparsers) -> None:
    """Attach the ``diagnose`` subcommand to ``subparsers``."""
    diagnose_parser = subparsers.add_parser(
        "diagnose",
        help="Run available language checkers over files and report diagnostics",
        description=(
            "Code intelligence without a language server: runs whatever checkers are "
            "installed (pyright/basedpyright or ruff for Python, tsc or eslint for "
            "JS/TS, shellcheck for shell) over the given files/directories and prints "
            "unified `file:line:col: severity message` diagnostics. "
            "Exit codes: 0 clean, 1 diagnostics found, 2 nothing could run."
        ),
    )
    diagnose_parser.add_argument(
        "paths", nargs="*", default=None,
        help="Files or directories to check (default: current directory)",
    )
    diagnose_parser.add_argument(
        "--json", action="store_true",
        help="Machine-readable output (diagnostics, skipped languages, checker map)",
    )
    diagnose_parser.add_argument(
        "--checkers", action="store_true",
        help="Only report which checkers are installed, then exit",
    )
    diagnose_parser.add_argument(
        "--timeout", type=float, default=120.0, metavar="SECONDS",
        help="Per-checker timeout in seconds (default: 120)",
    )
    diagnose_parser.add_argument(
        "--max-files", type=int, default=500, metavar="N",
        help="Stop after collecting N files (default: 500)",
    )

    def _dispatch_diagnose(_args):
        from vetri_cli.diagnose_cmd import cmd_diagnose

        return cmd_diagnose(_args)

    diagnose_parser.set_defaults(func=_dispatch_diagnose)
