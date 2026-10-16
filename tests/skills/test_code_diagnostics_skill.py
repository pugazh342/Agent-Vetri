"""Contracts for skills/software-development/code-diagnostics/SKILL.md.

The skill is documentation the agent follows, so it must never teach flags that
do not exist and never document exit codes that disagree with the real
implementation (vetri_cli.diagnose_cmd).
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import pytest

import vetri_yaml as yaml
from vetri_cli import diagnose_cmd as dc
from vetri_cli.subcommands.diagnose import build_diagnose_parser

SKILL = (
    Path(__file__).resolve().parents[2]
    / "skills" / "software-development" / "code-diagnostics" / "SKILL.md"
)


@pytest.fixture(scope="module")
def skill_text() -> str:
    assert SKILL.exists(), f"missing skill at {SKILL}"
    return SKILL.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def frontmatter(skill_text: str) -> dict:
    assert skill_text.startswith("---"), "SKILL.md must start with frontmatter"
    end = re.search(r"\n---\s*\n", skill_text[3:])
    assert end, "unclosed frontmatter"
    fm = yaml.safe_load(skill_text[3:end.start() + 3])
    assert isinstance(fm, dict)
    return fm


def _diagnose_parser() -> argparse.ArgumentParser:
    top = argparse.ArgumentParser(prog="vetri")
    sub = top.add_subparsers()
    build_diagnose_parser(sub)
    return sub.choices["diagnose"]


def test_frontmatter_contract(frontmatter: dict):
    assert frontmatter["name"] == "code-diagnostics"
    desc = str(frontmatter["description"])
    assert len(desc) <= 60
    assert desc.rstrip().endswith(".")
    assert "windows" in frontmatter["platforms"]
    vetri = frontmatter["metadata"]["vetri"]
    assert "code-diagnostics" not in str(vetri.get("related_skills"))  # don't relate to self
    assert vetri.get("category") == "software-development"


SECTIONS = [
    "## When to Use",
    "## Prerequisites",
    "## How to Run",
    "## Quick Reference",
    "## Procedure",
    "## Pitfalls",
    "## Verification",
]


def test_sections_follow_modern_order(skill_text: str):
    positions = [skill_text.index(section) for section in SECTIONS]
    assert positions == sorted(positions), "sections out of the documented order"
    assert skill_text.startswith("---") and "# Code Diagnostics Skill" in skill_text


def test_every_documented_flag_exists_in_parser(skill_text: str):
    parser = _diagnose_parser()
    known = set(parser._option_string_actions)
    documented = set(re.findall(r"--[a-z][a-z-]+", skill_text))
    assert documented, "skill should document at least one flag"
    unknown = documented - known
    assert not unknown, f"skill teaches flags the CLI does not have: {sorted(unknown)}"


def test_bash_snippets_only_use_real_flags(skill_text: str):
    parser = _diagnose_parser()
    known = set(parser._option_string_actions)
    in_fence = False
    used: set[str] = set()
    for line in skill_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("```"):
            in_fence = not in_fence and stripped in ("```bash", "```sh")
            if stripped in ("```", "```bash", "```sh"):
                continue
        if in_fence and stripped.startswith("vetri diagnose"):
            used.update(re.findall(r"--[a-z][a-z-]+", stripped))
    assert used, "How to Run must show concrete invocations"
    assert used <= known, f"snippets use unknown flags: {sorted(used - known)}"


def test_exit_codes_match_implementation(skill_text: str):
    assert (dc.EXIT_CLEAN, dc.EXIT_DIAGNOSTICS, dc.EXIT_NO_CHECKERS) == (0, 1, 2)
    line = next(
        (ln for ln in skill_text.splitlines() if ln.startswith("Exit codes:")),
        None,
    )
    assert line, "skill must document the exit-code line"
    for constant in (dc.EXIT_CLEAN, dc.EXIT_DIAGNOSTICS, dc.EXIT_NO_CHECKERS):
        assert f"`{constant}`" in line
