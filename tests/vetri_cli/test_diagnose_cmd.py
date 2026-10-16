"""Tests for ``vetri diagnose`` (vetri_cli.diagnose_cmd).

Behaviour contracts: file collection skips noise trees and honours the cap, the
per-language parsers normalize real checker payloads (ruff/pyright/tsc/eslint/
shellcheck JSON and tsc line output) into ``file:line:column`` records, and the
command's exit codes follow the documented 0/1/2 contract.
"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from vetri_cli import diagnose_cmd as dc


def _args(**kwargs) -> SimpleNamespace:
    defaults = {"paths": None, "json": False, "checkers": False,
                "timeout": 30.0, "max_files": 500}
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


# ------------------------------------------------------------------ collection

def test_collect_files_skips_noise_trees(tmp_path):
    (tmp_path / "a.py").write_text("x = 1\n", encoding="utf-8")
    (tmp_path / "sub").mkdir()
    (tmp_path / "sub" / "b.ts").write_text("export {}\n", encoding="utf-8")
    (tmp_path / "notes.txt").write_text("not code\n", encoding="utf-8")
    for noise in (".venv", "node_modules", "__pycache__", ".git"):
        (tmp_path / noise).mkdir()
        (tmp_path / noise / "hidden.py").write_text("x = 1\n", encoding="utf-8")

    files, truncated = dc.collect_files([str(tmp_path)])
    names = sorted(p.name for p in files)
    assert names == ["a.py", "b.ts"]
    assert truncated is False


def test_collect_files_respects_max_files(tmp_path):
    for i in range(5):
        (tmp_path / f"f{i}.py").write_text("x = 1\n", encoding="utf-8")
    files, truncated = dc.collect_files([str(tmp_path)], max_files=2)
    assert len(files) == 2
    assert truncated is True


def test_collect_files_accepts_explicit_file(tmp_path):
    target = tmp_path / "one.py"
    target.write_text("x = 1\n", encoding="utf-8")
    files, _ = dc.collect_files([str(target)])
    assert files == [target]


# ------------------------------------------------------------------ parsers

def test_parse_ruff_uses_filename_and_severity():
    payload = [{
        "filename": "/repo/bad.py",
        "code": "F821",
        "message": "Undefined name `foo`",
        "severity": "error",
        "location": {"row": 4, "column": 7},
    }]
    records = dc.parse_ruff(json.dumps(payload))
    assert records == [{
        "file": "/repo/bad.py", "line": 4, "column": 7, "severity": "error",
        "source": "ruff", "message": "Undefined name `foo`", "code": "F821",
    }]


def test_parse_pyright_normalizes_zero_based_columns():
    payload = {"files": [{"name": "C:/repo/x.py", "diagnostics": [
        {"severity": "warning", "message": "  Bad thing  ", "line": 2,
         "startCol": 0, "category": "type"}]}]}
    records = dc.parse_pyright(json.dumps(payload))
    assert records[0]["line"] == 2
    assert records[0]["column"] == 1  # startCol 0 -> display 1
    assert records[0]["severity"] == "warning"
    assert records[0]["message"] == "Bad thing"


def test_parse_tsc_line_output():
    stdout = (
        "src/app.ts(12,5): error TS2304: Cannot find name 'foo'.\n"
        "noise that does not match\n"
        "src/other.ts(3,1): warning TS6133: 'x' is declared but never read.\n"
    )
    records = dc.parse_tsc(stdout)
    assert len(records) == 2
    assert records[0] == {
        "file": "src/app.ts", "line": 12, "column": 5, "severity": "error",
        "source": "tsc", "message": "Cannot find name 'foo'.", "code": "TS2304",
    }
    assert records[1]["severity"] == "warning"


def test_parse_eslint_severity_mapping():
    payload = [{"filePath": "/repo/a.js", "messages": [
        {"line": 1, "column": 10, "severity": 2, "ruleId": "no-undef", "message": "x"},
        {"line": 2, "column": 1, "severity": 1, "ruleId": None, "message": "y"},
    ]}]
    records = dc.parse_eslint(json.dumps(payload))
    assert records[0]["severity"] == "error" and records[0]["code"] == "no-undef"
    assert records[1]["severity"] == "warning" and records[1]["code"] is None


def test_parse_shellcheck_levels():
    payload = [
        {"file": "run.sh", "line": 3, "column": 1, "level": "error", "code": 2086,
         "message": "Double quote to prevent globbing"},
        {"file": "run.sh", "line": 9, "column": 5, "level": "style", "code": 2006,
         "message": "Use $(...) instead of backticks"},
    ]
    records = dc.parse_shellcheck(json.dumps(payload))
    assert records[0]["severity"] == "error" and records[0]["code"] == "2086"
    assert records[1]["severity"] == "info"


def test_parse_pyright_unknown_severity_becomes_info():
    payload = {"files": [{"name": "f.py", "diagnostics": [
        {"severity": "information", "message": "note", "line": 1, "startCol": 4}]}]}
    records = dc.parse_pyright(json.dumps(payload))
    assert records[0]["severity"] == "info"


# ------------------------------------------------------------------ checkers

def test_pick_checker_prefers_first_available():
    checkers = {"pyright": None, "basedpyright": "/bin/bpy", "ruff": "/bin/ruff"}
    assert dc.pick_checker("python", checkers) == "basedpyright"
    assert dc.pick_checker("typescript", {"tsc": None, "eslint": None}) is None
    assert dc.pick_checker("unknown-lang", checkers) is None


# ------------------------------------------------------------------ command

def _stub_runner(records, err=None):
    def _run(language, checker, checker_path, files, timeout):
        return list(records), err
    return _run


def test_cmd_diagnose_json_contract(tmp_path, monkeypatch, capsys):
    (tmp_path / "ok.py").write_text("x = 1\n", encoding="utf-8")
    records = [{"file": "ok.py", "line": 1, "column": 1, "severity": "error",
                "source": "ruff", "message": "boom", "code": "E1"}]
    monkeypatch.setattr(dc, "find_checkers",
                        lambda: {"pyright": None, "basedpyright": None, "ruff": "/ruff",
                                 "tsc": None, "eslint": None, "shellcheck": None})
    monkeypatch.setattr(dc, "run_language", _stub_runner(records))

    rc = dc.cmd_diagnose(_args(paths=[str(tmp_path)], json=True))
    out = json.loads(capsys.readouterr().out)
    assert rc == dc.EXIT_DIAGNOSTICS
    assert out["files_checked"] == 1
    assert out["checkers_used"] == {"python": "ruff"}
    assert out["counts"]["error"] == 1
    assert out["diagnostics"] == records
    assert out["skipped"] == {} and out["errors"] == {}


def test_cmd_diagnose_exit_clean_when_stub_finds_nothing(tmp_path, monkeypatch, capsys):
    (tmp_path / "ok.py").write_text("x = 1\n", encoding="utf-8")
    monkeypatch.setattr(dc, "find_checkers",
                        lambda: {"pyright": None, "basedpyright": None, "ruff": "/ruff",
                                 "tsc": None, "eslint": None, "shellcheck": None})
    monkeypatch.setattr(dc, "run_language", _stub_runner([]))
    rc = dc.cmd_diagnose(_args(paths=[str(tmp_path)], json=True))
    capsys.readouterr()
    assert rc == dc.EXIT_CLEAN


def test_cmd_diagnose_exit_2_when_no_checker_available(tmp_path, monkeypatch, capsys):
    (tmp_path / "ok.py").write_text("x = 1\n", encoding="utf-8")
    monkeypatch.setattr(dc, "find_checkers", lambda: {
        "pyright": None, "basedpyright": None, "ruff": None,
        "tsc": None, "eslint": None, "shellcheck": None})
    rc = dc.cmd_diagnose(_args(paths=[str(tmp_path)], json=True))
    out = json.loads(capsys.readouterr().out)
    assert rc == dc.EXIT_NO_CHECKERS
    assert out["skipped"] == {"python": "no checker installed"}


def test_cmd_diagnose_checkers_report(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(dc, "find_checkers",
                        lambda: {"pyright": "C:/pyright.exe", "ruff": None})
    rc = dc.cmd_diagnose(_args(checkers=True, json=True))
    out = json.loads(capsys.readouterr().out)
    assert rc == 0
    by_name = {row["checker"]: row for row in out["checkers"]}
    assert by_name["pyright"]["available"] is True
    assert by_name["ruff"]["available"] is False
