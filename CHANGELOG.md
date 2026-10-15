# Changelog

All notable changes to Vetri are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/) · Versioning: [SemVer](https://semver.org/)

## [0.1.0] — 2026-10-15

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
