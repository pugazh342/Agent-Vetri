# Vetri — Final Project Report

**Project:** Complete rebuild and rebrand of the Hermes Agent personal AI stack as **Vetri**
**Date:** 2026-10-15
**Operator:** Pugazhmani K — AI & Cybersecurity Researcher
**Product root:** `C:\Users\kpuga\vetri`
**Runtime home:** `C:\Users\kpuga\AppData\Local\vetri`

---

## 1. Executive Summary

A working Hermes Agent installation (config-only backup, no source on the machine) was analyzed,
reconstructed from the official upstream source, and delivered as a fully rebranded product named
**Vetri** — with zero loss of functionality, a custom blue identity, an original logo, an
open-source developer identity wired into the agent's brain, and a cybersecurity/pentesting skill
arsenal active by default.

| Deliverable | Status |
|---|---|
| Full rebuild, no functionality lost | ✅ verified end-to-end |
| Complete Hermes → Vetri rebrand (130,923 replacements, 1,908 files) | ✅ zero leftovers |
| User config/migration preserved | ✅ config v33→v51 path, keys verified live |
| Blue theme everywhere (CLI + TUI + light mode) | ✅ |
| Original modern logo (hexagon + V emblem), generated from vector geometry | ✅ |
| All Hermes glyphs (☤) replaced with Vetri glyph (⬢) — 90 files, 227 occurrences | ✅ |
| Self-introduction: open-source agent by Pugazhmani K (SOUL.md + banner) | ✅ model-verified live |
| Cybersecurity + pentesting skills by default (72 active, 818 cached) | ✅ in system prompt |

## 2. Origin & Provenance

- Source of truth: `C:\Users\kpuga\Desktop\hermes-backup-20260817-165802` (config.yaml v33,
  `.env`, `auth.json`) — untouched, verified byte-identical throughout.
- Upstream source: `hermes-agent` (Nous Research), **MIT licensed** → fetched as source zipball,
  rebranded in place. MIT LICENSE and Nous Research attribution preserved; a provenance note was
  added to `README.md`.
- Live Nous Research service endpoints (`*.nousresearch.com`: model catalog, Tool Gateway, OAuth,
  docs) were explicitly protected during the rename sweep so all integrations keep working.

## 3. Rebrand Execution

- **130,923 text replacements across 1,908 files**; **294 files and 14 directories renamed**.
- Result: zero "hermes" occurrences outside protected hostnames.
- Global command: `vetri` (shim at `C:\Users\kpuga\.local\bin\vetri.cmd` →
  `.venv\Scripts\vetri.exe`, Python 3.14.7, `uv sync --extra all`).

## 4. Migration & Configuration

- Runtime home created at `%LOCALAPPDATA%\vetri` (config.yaml, `.env`, `auth.json`, state.db, logs).
- Config migrated along the v33 → v51 path (deep-merge).
- Stale Google `base_url` fixed; **NVIDIA key verified live** (HTTP 200 against
  `integrate.api.nvidia.com`).
- Retired toolsets `messaging`/`moa` removed from `platform_toolsets.cli`.
- Default model in use: `nvidia/nemotron-3-super-120b-a12b` (Nous Research).

## 5. Verification Matrix

| Check | Method | Result |
|---|---|---|
| Model round-trip | `vetri chat -q "..." --yolo` | ✅ responses stream correctly |
| Agentic tool loop | terminal echo + write_file/read_file with diff review | ✅ real file created |
| MCP server | `vetri mcp serve` JSON-RPC handshake | ✅ 10 tools advertised |
| Doctor | `vetri doctor` | ✅ green |
| Skill catalog | `build_skills_system_prompt()` | ✅ 123 skills, ~3.5k token index |
| Self-introduction | live question "who are you / who developed you" | ✅ "open-source AI agent developed by Pugazhmani K" |
| Brand glyphs | repo-wide `rg` for ☤ | ✅ 0 residual (outside vendored trees) |

## 6. Identity & Branding

- **Name:** Vetri (வெற்றி — "victory")
- **Theme:** Azure-blue gradient (`#7DD3FC → #1E3A8A`), default skin "Classic Vetri — azure blue";
  light-mode remap and TUI dark/light seeds converted.
- **Logo:** original emblem — hexagonal tech badge with a bold **V** monogram and AI sparkles,
  generated programmatically (vector geometry rasterized to braille art). Constants:
  `VETRI_EMBLEM` (`vetri_cli/banner.py`), `EMBLEM_ART` (`ui-tui/src/banner.ts`).
- **Glyph:** caduceus `☤` → hexagon `⬢` across 90 files / 227 occurrences (response panels,
  status bar model segment, TUI, gateway adapters for Telegram/Discord/WhatsApp/QQ, web dashboard
  i18n, 20 locale files, setup scripts, docs, READMEs).
- **Self-introduction (agent brain):** `SOUL.md` (repo default + runtime copy) now states Vetri is
  the open-source AI agent developed by Pugazhmani K, AI & Cybersecurity Researcher, and instructs
  the model to credit the developer when asked.
- **Self-introduction (visible):** welcome banner shows under the model name:
  *open-source AI agent by* / **Pugazhmani K** / *AI & Cybersecurity Researcher*.

## 7. Security Skill Arsenal (active by default)

| Category | Source | Count |
|---|---|---|
| `cybersecurity` | curated core of [mukul975/anthropic-cybersecurity-skills](https://github.com/mukul975/anthropic-cybersecurity-skills) | 62 |
| `pentesting` | local `D:\Skills` (Strix/PentestGPT methodology packs) | 10 |

- Curated set covers: web app & API penetration testing (OWASP Top 10, BOLA, JWT, OAuth2, XSS,
  SQLi, XXE, SSRF, CSRF-adjacent, CORS, WAF bypass), recon (nmap, subfinder, DNS, OSINT,
  SpiderFoot, Shodan), network/AD (priv-esc, Kerberoasting, NTLM relay, lateral movement), cloud &
  K8s (Pacu, k8s pentest), malware/RE (YARA, PE-STUDIO, Ghidra), AI security (prompt injection,
  system-prompt leakage, garak LLM red-teaming, agentic tool-invocation security), and social
  (GoPhish, Evilginx).
- **Full 818-skill pack cached** at
  `%LOCALAPPDATA%\vetri\skills-pack-cache\anthropic-cybersecurity-skills\skills\` for on-demand
  activation. Rationale: every skill name+description enters the system prompt on every API call
  (~3.5k tokens for the current 123 skills); activating all 818 would add ~45k+ tokens of permanent
  prompt overhead, so a curated default + on-demand cache is the cost-correct design.
- Activate any cached skill on demand:
  `Copy-Item "$env:LOCALAPPDATA\vetri\skills-pack-cache\anthropic-cybersecurity-skills\skills\<skill>" "$env:LOCALAPPDATA\vetri\skills\cybersecurity\" -Recurse`

## 8. Known Accepted Warnings

- SQLite 3.50.4 WAL-reset advisory (system SQLite, cosmetic).
- `homeassistant`/`teams`/`google_chat` platforms report unconfigured toolsets (optional platforms).
- Optional plugin extras `python-telegram-bot` / `discord.py` not installed (not in use).

## 9. Day-to-Day Use

```powershell
vetri                       # interactive chat (TUI)
vetri chat -q "prompt" --yolo    # non-interactive one-shot
vetri doctor                # health check
vetri skills list           # skill inventory
vetri --resume              # resume last session
```

The original Hermes backup on the Desktop remains untouched as the rollback source of truth.
