# Changelog

All notable changes to Vetri are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/) · Versioning: [SemVer](https://semver.org/)

## [0.3.0] - 2026-10-23

**Independence release** — Vetri now stands entirely on its own identity,
infrastructure and release channel, with a guard that keeps it that way.

### Added

- **`scripts/check_vetri_independence.py`** — blocking guard (part of
  `python scripts/check`, now 13 checks) failing on hermes/Nous branding
  regressions outside an explicit reviewed allow-list: hermes identifiers,
  `Nous Research` / `nousresearch.com` outside the known model-provider
  subdomains, `NousResearch/` slugs, Discord invite links, the
  nous-research org handle. Technical IDs (`com.nousresearch.vetri`, MSIX
  org, signing CN, GUID) and CHANGELOG provenance are deliberately
  preserved.
- **CI (`ci.yml`)** — four blocking lanes on every push and PR: the full
  `python scripts/check` gate, the canonical Python suite
  (`scripts/run_tests.sh`, 4-slice matrix, WAL-checked, duration-cached),
  every workspace's JS/TS checks, and an advisory prompt-surface diff summary
  on PRs. Read-only token, SHA-pinned actions, no secrets.
- **GitHub Pages docs deployment (`deploy-site.yml`)** building the Docusaurus
  site and skills index on pushes to `main` and on releases →
  <https://pugazh342.github.io/Agent-Vetri>.
- **`osv-scanner.yml`** — weekly lockfile CVE scan (SHA-pinned upstream
  reusable workflow, non-blocking) into the repository's Security tab.

### Changed

- **Identity independence completed** — remaining hermes/Nous branding removed
  across code, docs, workflows and the plugin catalog: attribution →
  Pugazhmani K, community → GitHub Discussions, docs host → GitHub Pages,
  releases → `pugazh342/Agent-Vetri`. Nous Research is retained solely as a
  model provider (portal/API endpoints, sign-in) and in the MIT LICENSE
  copyright line; v0.1.0 provenance history stays in this changelog.
- **The first-party plugin catalog installs for real.** The catalog's target
  repositories now exist as `pugazh342/vetri-official-plugins`,
  `pugazh342/vetri-nvidia` and `pugazh342/vetri-example-plugins`, adapted to
  Vetri's host contracts (extension gate `com.nousresearch.vetri`,
  `VETRI_*` environment contract incl. `VETRI_HOME` / kanban / transport-wrap,
  `@vetri/plugin-sdk` imports) and re-pinned: all 13 first-party catalog
  entries point at the adapted commits. `requires_vetri` floors normalized to
  the Vetri version line; first-party `maintainer:` → `Pugazhmani K`.
- **Holographic catalog entry** points at the third-party maintainer's real
  repository again (`itpartypattaya/hermes-plugin-holographic`); an earlier
  blind rename had left the URL dead.
- **`@vetri/ui` vendored** under `vendor/ui` (wired via a `file:` dependency)
  instead of fetching the upstream-scoped workspace package; `misaki`
  dependency moved to `hexgrad/misaki`.
- **Prompt-surface snapshots render byte-identically on every OS** —
  `USERPROFILE` pinned in the render child env, `psutil` imported before the
  platform pin, `newline="\n"` on snapshot writers, backslash-normalizing
  `_scrub` — so Windows, Linux and macOS CI agree on the goldens.
- **Deployment workflow** adapted: Vercel job removed, GitHub-hosted runners,
  `github.token` instead of a GitHub App token, installers fetched from this
  repository's raw URLs.

### Notes

- Version unified at **0.3.0** across `pyproject.toml` and all workspace
  `package.json` files; `uv.lock` relocked canonically through
  `pm.cli lock` (no dependency changes).
- Community links moved to GitHub Discussions; the former Discord invite
  surfaces were removed.

## [0.2.0] - 2026-10-16

"Power tools" release - closes the gaps a side-by-side architecture comparison with
modern coding agents surfaced, with zero changes to existing behaviour.

### Added

- **`vetri models`** - non-interactive model catalog: active provider/model, resolved
  context window with its source (config override vs built-in catalog vs fallback),
  configured `model_aliases:` entries and multiplex profiles. `--json` for scripts,
  `--catalog` to list every model in the built-in context-window table.
- **`vetri diagnose`** - code intelligence without a language server: runs whichever
  checkers are installed (`pyright`/`basedpyright`/`ruff` for Python, `tsc`/`eslint`
  for JS/TS, `shellcheck` for shell) over files and directories and normalizes
  everything into a single `file:line:column: severity` stream. Flags: `--json`,
  `--checkers`, `--timeout`, `--max-files`. Exit codes: `0` clean, `1` diagnostics
  found, `2` nothing could run.
- **`code-diagnostics` skill** (software-development) - teaches the agent the
  diagnostics workflow; contract tests tie the skill's documented flags and exit
  codes to the real CLI implementation.

### Notes

- Both commands are read-only, TTY-optional, and covered by unit tests
  (`tests/vetri_cli/test_models_cmd.py`, `tests/vetri_cli/test_diagnose_cmd.py`,
  `tests/skills/test_code_diagnostics_skill.py` - 32 tests).
- The 72 vendored security skills (`skills/cybersecurity/`, `skills/pentesting/`)
  were brought to full authoring-standards conformance - frontmatter fields,
  <=60-char descriptions, placeholder-safe paths - restoring a fully green global
  skills sweep (1,989 checks).
- Version unified at **0.2.0** across `pyproject.toml` and all workspace
  `package.json` files.

## [0.1.0] - 2026-10-15

First public release of **Vetri** — the open-source AI agent for security work, developed by
Pugazhmani K. Rebuilt and rebranded from the MIT-licensed
[Hermes Agent](https://github.com/NousResearch/hermes-agent) core by Nous Research.

### Added

- **Vetri identity** — complete rebrand (name, CLI, TUI, desktop, web, gateway, docs, 20 locales);
  zero remaining Hermes branding outside preserved upstream service endpoints.
- **Original logo** — hexagonal "V" emblem generated from vector geometry (braille art),
  shipped in the CLI banner (`VETRI_EMBLEM`) and TUI (`EMBLEM_ART`).
- **Azure-blue theme** — default skin "Classic Vetri — azure blue" across CLI, TUI, light mode
  and dashboard seeds.
- **Self-introduction** — `SOUL.md` identity ("open-source AI agent developed by Pugazhmani K,
  AI & Cybersecurity Researcher") plus a visible banner tagline.
- **Security arsenal** — 72 skills active by default:
  - `skills/cybersecurity/` — 62 curated skills from
    [mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills)
    (Apache-2.0; web/API pentesting, recon, AD/network, cloud, malware RE, AI security).
  - `skills/pentesting/` — 10 autonomous-pentest methodology playbooks (Strix, Apache-2.0).
- **CHANGELOG.md**, professional README, repo-scoped `SECURITY.md` disclosure channel.

### Changed

- Version unified at **0.1.0** across `pyproject.toml` and all workspace `package.json` files.
- Brand glyph: caduceus `☤` → hexagon `⬢` on every surface (90 files, 227 occurrences).
- Default model on NVIDIA NIM free tier: `nvidia/nemotron-3-super-120b-a12b`.
- Config migrated along the v33 → v51 path from the legacy installation.
- Upstream CI workflows moved to `.github/workflows-upstream/` (inactive) pending
  repo-specific adaptation.

### Fixed

- Stale provider `base_url` from the legacy configuration (NVIDIA endpoint verified live).
- Removed retired toolsets `messaging` / `moa` from the CLI platform toolsets.

### Notes

- Upstream MIT license and Nous Research copyright notices preserved (see `LICENSE`).
- Known accepted advisories: SQLite WAL-reset notice (system SQLite); optional platforms
  (`homeassistant`, `teams`, `google_chat`) unconfigured until `vetri tools`.
