"""``vetri diagnose`` - run installed language checkers over files, report unified diagnostics.

A deliberately small, dependency-free stand-in for a full LSP session: no language
server is spawned, no state is kept - each invocation discovers which checkers exist
on PATH, picks files by extension, runs the best checker per language, and normalizes
everything into ``file:line:column`` records.

Checkers (first available wins per language):
  Python      pyright --outputjson, basedpyright --outputjson, ruff check --output-format json
  JS/TS       tsc --noEmit, eslint -f json
  Shell       shellcheck -f json1

``--json`` writes only JSON to stdout so scripts can consume it.
Exit codes: 0 = no diagnostics, 1 = diagnostics found, 2 = nothing could run.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Optional

# Exit-code contract (documented in ``vetri diagnose --help``, the code-diagnostics
# skill, and tests/skills/test_code_diagnostics_skill.py).
EXIT_CLEAN = 0        # everything that ran found nothing
EXIT_DIAGNOSTICS = 1  # at least one diagnostic record
EXIT_NO_CHECKERS = 2  # no language could be checked at all

# extension -> language id
_LANG_BY_EXT = {
    ".py": "python",
    ".pyi": "python",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".mts": "typescript",
    ".cts": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".sh": "shell",
    ".bash": "shell",
    ".zsh": "shell",
}

_SKIP_DIRS = {
    ".git", ".hg", ".svn", "node_modules", "__pycache__", ".venv", "venv",
    "env", ".tox", ".mypy_cache", ".ruff_cache", ".pytest_cache", "dist",
    "build", ".worktrees", "target", ".next", ".cache", "coverage",
}

# checker per language, in preference order (first on PATH wins)
_CHECKER_ORDER: dict[str, tuple[str, ...]] = {
    "python": ("pyright", "basedpyright", "ruff"),
    "typescript": ("tsc", "eslint"),
    "javascript": ("tsc", "eslint"),
    "shell": ("shellcheck",),
}


def find_checkers() -> dict[str, Optional[str]]:
    """Map every known checker name to its resolved path (or None when absent)."""
    names = {name for order in _CHECKER_ORDER.values() for name in order}
    return {name: shutil.which(name) for name in sorted(names)}


def pick_checker(language: str, checkers: dict[str, Optional[str]]) -> Optional[str]:
    """First available checker name for a language, or None."""
    for name in _CHECKER_ORDER.get(language, ()):
        if checkers.get(name):
            return name
    return None


def collect_files(paths: list[str], *, max_files: int = 500) -> tuple[list[Path], bool]:
    """Expand files/directories into supported source files.

    Returns ``(files, truncated)``; hidden directories and known noise trees are
    skipped, the walk order is deterministic (sorted) so runs are reproducible.
    """
    out: list[Path] = []
    truncated = False
    seen: set[Path] = set()

    def _add(path: Path) -> None:
        nonlocal truncated
        if path in seen:
            return
        if len(out) >= max_files:
            truncated = True
            return
        seen.add(path)
        out.append(path)

    roots = [Path(p) for p in (paths or ["."])]
    for root in roots:
        if root.is_file():
            if root.suffix.lower() in _LANG_BY_EXT:
                _add(root)
            continue
        if not root.exists():
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = sorted(d for d in dirnames if d not in _SKIP_DIRS and not d.startswith("."))
            for filename in sorted(filenames):
                path = Path(dirpath) / filename
                if path.suffix.lower() in _LANG_BY_EXT:
                    _add(path)
                    if truncated:
                        break
            if truncated:
                break
        if truncated:
            break
    return out, truncated


def _run(cmd: list[str], timeout: float) -> tuple[str, Optional[str]]:
    """Run a checker; returns ``(stdout, error)``. Never raises on timeout/failure."""
    exe = cmd[0]
    if os.name == "nt" and exe.lower().endswith((".cmd", ".bat")):
        cmd = [os.environ.get("COMSPEC", "cmd.exe"), "/c", *cmd]
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=timeout, check=False,
        )
    except subprocess.TimeoutExpired:
        return "", f"timeout after {timeout:.0f}s"
    except OSError as exc:
        return "", str(exc)
    return proc.stdout or "", None


def _record(file: str, line: int, column: int, severity: str, source: str,
            message: str, code: Optional[str] = None) -> dict[str, Any]:
    return {
        "file": file, "line": int(line), "column": int(column),
        "severity": severity, "source": source, "message": message, "code": code,
    }


def _display_file(path: str) -> str:
    """Repo-relative path when possible; forward slashes always, so output is
    identical on every platform and stable for scripts and editors."""
    try:
        shown = str(Path(path).resolve().relative_to(Path.cwd()))
    except ValueError:
        shown = path
    return shown.replace("\\", "/")


# ---------------------------------------------------------------- parsers

def parse_pyright(stdout: str) -> list[dict[str, Any]]:
    """pyright/basedpyright ``--outputjson`` payload -> records.

    pyright reports 1-based lines and 0-based columns; columns are normalized to
    1-based here to match every other checker's output.
    """
    payload = json.loads(stdout)
    records: list[dict[str, Any]] = []
    for entry in payload.get("files", []):
        fname = _display_file(str(entry.get("name", "")))
        for diag in entry.get("diagnostics", []):
            severity = str(diag.get("severity", "warning")).lower()
            if severity not in ("error", "warning"):
                severity = "info"
            records.append(_record(
                fname,
                int(diag.get("line", 0) or 1),
                int(diag.get("startCol", 0) or 0) + 1,
                severity,
                "pyright",
                str(diag.get("message", "")).strip(),
                str(diag.get("rule") or diag.get("category") or "") or None,
            ))
    return records


def parse_ruff(stdout: str) -> list[dict[str, Any]]:
    """ruff ``--output-format json`` payload -> records.

    Ruff names the path key ``filename`` (not ``file``) and newer versions emit an
    explicit ``severity`` (``error``/``warning``); older ones carry none, which we
    report as ``warning`` since bare lint findings are advisory by default.
    """
    payload = json.loads(stdout)
    records: list[dict[str, Any]] = []
    for item in payload:
        loc = item.get("location") or {}
        raw_severity = str(item.get("severity") or "warning").lower()
        severity = "error" if raw_severity == "error" else "warning"
        records.append(_record(
            _display_file(str(item.get("filename") or item.get("file") or "")),
            int(loc.get("row", 1) or 1),
            int(loc.get("column", 1) or 1),
            severity,
            "ruff",
            str(item.get("message", "")).strip(),
            str(item.get("code") or "") or None,
        ))
    return records


_TSC_LINE = re.compile(
    r"^(?P<file>.+?)\((?P<line>\d+),(?P<col>\d+)\):\s+(?P<severity>error|warning|message)\s+"
    r"(?P<code>TS\d+):\s+(?P<message>.*)$"
)


def parse_tsc(stdout: str) -> list[dict[str, Any]]:
    """``tsc --noEmit --pretty false`` line output -> records."""
    records: list[dict[str, Any]] = []
    for raw in stdout.splitlines():
        match = _TSC_LINE.match(raw.strip())
        if not match:
            continue
        severity = match.group("severity")
        records.append(_record(
            _display_file(match.group("file")),
            int(match.group("line")),
            int(match.group("col")),
            "error" if severity == "error" else ("warning" if severity == "warning" else "info"),
            "tsc",
            match.group("message").strip(),
            match.group("code"),
        ))
    return records


def parse_eslint(stdout: str) -> list[dict[str, Any]]:
    """eslint ``-f json`` payload -> records."""
    payload = json.loads(stdout)
    records: list[dict[str, Any]] = []
    for entry in payload:
        fname = _display_file(str(entry.get("filePath", "")))
        for msg in entry.get("messages", []):
            records.append(_record(
                fname,
                int(msg.get("line", 1) or 1),
                int(msg.get("column", 1) or 1),
                "error" if msg.get("severity") == 2 else "warning",
                "eslint",
                str(msg.get("message", "")).strip(),
                str(msg.get("ruleId") or "") or None,
            ))
    return records


def parse_shellcheck(stdout: str) -> list[dict[str, Any]]:
    """shellcheck ``-f json1`` payload -> records."""
    payload = json.loads(stdout)
    records: list[dict[str, Any]] = []
    for item in payload:
        level = str(item.get("level", "warning")).lower()
        severity = "error" if level == "error" else ("info" if level in ("info", "style", "note") else "warning")
        records.append(_record(
            _display_file(str(item.get("file", ""))),
            int(item.get("line", 1) or 1),
            int(item.get("column", 1) or 1),
            severity,
            "shellcheck",
            str(item.get("message", "")).strip(),
            str(item.get("code") or "") or None,
        ))
    return records


# ---------------------------------------------------------------- runners

def _run_python(checker_path: str, checker: str, files: list[Path], timeout: float,
                ) -> tuple[list[dict[str, Any]], Optional[str]]:
    if checker in ("pyright", "basedpyright"):
        stdout, err = _run([checker_path, "--outputjson", *[str(f) for f in files]], timeout)
        if err:
            return [], err
        try:
            return parse_pyright(stdout), None
        except (json.JSONDecodeError, TypeError, ValueError):
            return [], f"{checker} produced no parseable JSON"
    stdout, err = _run(
        [checker_path, "check", "--output-format", "json", *[str(f) for f in files]], timeout)
    if err:
        return [], err
    try:
        return parse_ruff(stdout), None
    except (json.JSONDecodeError, TypeError, ValueError):
        return [], "ruff produced no parseable JSON"


def _run_js(checker_path: str, checker: str, files: list[Path], timeout: float,
            ) -> tuple[list[dict[str, Any]], Optional[str]]:
    if checker == "tsc":
        stdout, err = _run(
            [checker_path, "--noEmit", "--pretty", "false", *[str(f) for f in files]], timeout)
        if err:
            return [], err
        return parse_tsc(stdout), None
    stdout, err = _run([checker_path, "-f", "json", "--", *[str(f) for f in files]], timeout)
    if err:
        return [], err
    try:
        return parse_eslint(stdout), None
    except (json.JSONDecodeError, TypeError, ValueError):
        return [], "eslint produced no parseable JSON (missing config?)"


def _run_shell(checker_path: str, files: list[Path], timeout: float,
               ) -> tuple[list[dict[str, Any]], Optional[str]]:
    stdout, err = _run([checker_path, "-f", "json1", *[str(f) for f in files]], timeout)
    if err:
        return [], err
    try:
        return parse_shellcheck(stdout), None
    except (json.JSONDecodeError, TypeError, ValueError):
        return [], "shellcheck produced no parseable JSON"


def run_language(language: str, checker: str, checker_path: str, files: list[Path],
                 timeout: float) -> tuple[list[dict[str, Any]], Optional[str]]:
    """Dispatch one language to its checker; returns ``(records, error)``."""
    if language == "python":
        return _run_python(checker_path, checker, files, timeout)
    if language in ("typescript", "javascript"):
        return _run_js(checker_path, checker, files, timeout)
    if language == "shell":
        return _run_shell(checker_path, files, timeout)
    return [], f"no checker for language {language}"


# ---------------------------------------------------------------- command

def cmd_diagnose(args) -> int:
    """Handler for ``vetri diagnose [paths...] [--json] [--checkers] [--timeout] [--max-files]``."""
    checkers = find_checkers()
    want_json = bool(getattr(args, "json", False))

    if getattr(args, "checkers", False):
        rows = [
            {"checker": name, "path": path, "available": bool(path)}
            for name, path in checkers.items()
        ]
        if want_json:
            print(json.dumps({"checkers": rows}, indent=2))
            return 0
        print()
        print("Checkers")
        for row in rows:
            state = row["path"] or "(not installed)"
            print(f"  {row['checker']:<14} {state}")
        return 0

    files, truncated = collect_files(
        list(getattr(args, "paths", None) or ["."]),
        max_files=int(getattr(args, "max_files", 500) or 500),
    )
    if not files:
        if want_json:
            print(json.dumps({"files_checked": 0, "diagnostics": [], "skipped": {}, "errors": []}))
        else:
            print("No supported source files found (.py .ts .tsx .js .jsx .sh ...).")
        return EXIT_CLEAN

    # group by language, pick a checker per language
    by_language: dict[str, list[Path]] = {}
    for path in files:
        by_language.setdefault(_LANG_BY_EXT[path.suffix.lower()], []).append(path)

    timeout = float(getattr(args, "timeout", 120.0) or 120.0)
    records: list[dict[str, Any]] = []
    skipped: dict[str, str] = {}
    errors: dict[str, str] = {}
    used: dict[str, str] = {}

    for language in sorted(by_language):
        checker = pick_checker(language, checkers)
        if not checker:
            skipped[language] = "no checker installed"
            continue
        lang_files = by_language[language]
        lang_records, err = run_language(language, checker, checkers[checker] or checker, lang_files, timeout)
        if err is not None:
            errors[language] = err
            continue
        used[language] = checker
        records.extend(lang_records)

    records.sort(key=lambda r: (r["file"], r["line"], r["column"], r["severity"]))
    counts = {
        "error": sum(1 for r in records if r["severity"] == "error"),
        "warning": sum(1 for r in records if r["severity"] == "warning"),
        "info": sum(1 for r in records if r["severity"] == "info"),
    }

    if want_json:
        print(json.dumps({
            "files_checked": len(files),
            "truncated": truncated,
            "checkers_used": used,
            "skipped": skipped,
            "errors": errors,
            "counts": counts,
            "diagnostics": records,
        }, indent=2))
    else:
        print()
        for rec in records:
            code = f" {rec['code']}" if rec.get("code") else ""
            print(f"{rec['file']}:{rec['line']}:{rec['column']}: "
                  f"{rec['severity']}: {rec['message']}{code} [{rec['source']}]")
        used_desc = ", ".join(f"{lang}: {chk}" for lang, chk in sorted(used.items())) or "none"
        print()
        print(f"{len(files)} files checked ({len(records)} diagnostics: "
              f"{counts['error']} errors, {counts['warning']} warnings, {counts['info']} info)")
        print(f"checkers used: {used_desc}")
        for language, reason in sorted(skipped.items()):
            print(f"skipped {language}: {reason}")
        for language, reason in sorted(errors.items()):
            print(f"failed {language}: {reason}")
        if truncated:
            print(f"truncated: stopped at --max-files {getattr(args, 'max_files', 500)} files")

    if not used and (errors or skipped):
        return EXIT_NO_CHECKERS
    return EXIT_DIAGNOSTICS if records else EXIT_CLEAN
