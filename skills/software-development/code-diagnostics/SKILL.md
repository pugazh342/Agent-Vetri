---
name: code-diagnostics
description: "Lint files; report findings with file, line, and severity."
version: 1.0.0
author: "Pugazhmani K (pugazh342), Vetri Agent"
license: MIT
platforms: [linux, macos, windows]
metadata:
  vetri:
    tags: [diagnostics, lint, type-checking, code-quality, review]
    category: software-development
    related_skills: [codebase-inspection, requesting-code-review, systematic-debugging]
---

# Code Diagnostics Skill

Run Vetri's unified diagnostics command to check source files for lint and type
errors before and after edits. `vetri diagnose` picks whichever checkers are
installed, normalizes their output, and reports one stream of findings. It does
not fix anything, run tests, or provide navigation features like go-to-definition.

## When to Use

- User asks to lint, type-check, find errors, or asks "what's wrong with this file"
- Verifying an edit without waiting for the full test suite
- Pre-commit or pre-PR sanity checks over changed directories
- Triaging a directory before delegating fixes via `delegate_task`

## Prerequisites

- Nothing extra to install - the command runs through `terminal`
- `vetri diagnose --checkers` lists which optional checkers exist on this machine:
  Python (`pyright`, `basedpyright`, or `ruff`), JS/TS (`tsc` or `eslint`), and
  shell (`shellcheck`). A language can only be checked when its checker exists.

## How to Run

Run these with `terminal` from the project root:

```bash
vetri diagnose .                      # everything under the current directory
vetri diagnose src/ tests/            # specific directories
vetri diagnose path/to/module.py      # single file
vetri diagnose --checkers             # what is installed right now
vetri diagnose --json                 # machine-readable output
vetri diagnose --timeout 60 --max-files 200   # bounded run
```

## Quick Reference

| Flag | Purpose |
|---|---|
| `--checkers` | Report installed checkers and exit |
| `--json` | Only JSON on stdout: diagnostics, counts, skipped, errors |
| `--timeout SECONDS` | Per-checker time budget (default 120) |
| `--max-files N` | Stop after N files (default 500; sets `truncated` in `--json`) |

Exit codes: `0` nothing found, `1` diagnostics found, `2` nothing could run.

## Procedure

1. Run `vetri diagnose --checkers` once per session when the languages are unknown.
2. Point `vetri diagnose` at touched files or the directories from recent edits.
3. Read records as `file:line:column: severity: message CODE [source]`.
4. Inspect each hit with `read_file`, fix with `patch`, then re-run the same command.
5. Repeat until the command exits `0`, and run the project's tests via `terminal`
   whenever code changed.
6. Use `--json` when reporting counts or feeding results into another step.

## Pitfalls

- Exit code `1` means findings, not a crash; `2` means no checker could run
  (inspect `skipped`/`errors` in `--json` for the reason).
- Ruff applies the project's own configuration discovered from the working
  directory - a clean run can simply reflect lenient local rules.
- `--max-files` caps collection (default 500); `--json` marks `truncated: true`.
- `tsc` and `eslint` need the project's dependencies available on `PATH`.
- Static analysis only: it complements the test suite, it never replaces it.

## Verification

- Re-run `vetri diagnose <same paths>` and confirm exit code `0`.
- With `--json`, confirm `counts.error == 0` and `truncated == false` whenever a
  full run was intended.
- After fixes, the project's test suite must still pass via `terminal`.
