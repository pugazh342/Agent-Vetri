<div align="center">

```
██╗   ██╗  ███████╗  ████████╗  ██████╗   ██╗             █████╗    █████╗   ███████╗  ██╗   ██╗  ████████╗
██║   ██║  ██╔════╝  ╚══██╔══╝  ██╔══██╗  ██║            ██╔══██╗  ██╔══██╗  ██╔════╝  ████╗  ██║  ╚══██╔══╝
██║   ██║  █████╗       ██║     ██████╔╝  ██║            ███████║  ██║  ██║  █████╗    ██╔██╗ ██║     ██║
╚██╗ ██╔╝  ██╔══╝       ██║     ██╔══██╗  ██║            ██╔══██║  ██║  ██║  ██╔══╝    ██║╚██╗██║     ██║
 ╚████╔╝   ███████╗     ██║     ██║  ██║  ██║            ██║  ██║  ╚█████╔╝  ███████╗  ██║ ╚████║     ██║
  ╚═══╝    ╚══════╝     ╚═╝     ╚═╝  ╚═╝  ╚═╝            ╚═╝  ╚═╝   ╚════╝   ╚══════╝  ╚═╝  ╚══╝     ╚═╝
```

**The open-source AI agent built for security work.**

[![Version](https://img.shields.io/badge/version-0.3.0-blue?style=flat-square)](CHANGELOG.md)
[![CI](https://github.com/pugazh342/Agent-Vetri/actions/workflows/ci.yml/badge.svg)](https://github.com/pugazh342/Agent-Vetri/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11%20%E2%80%93%203.14-blue?style=flat-square)](pyproject.toml)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)](#quick-start)
[![Security Skills](https://img.shields.io/badge/security%20skills-72%20active-red?style=flat-square)](skills/)

*Developed by **[Pugazhmani K](https://github.com/pugazh342)** — AI & Cybersecurity Researcher*

</div>

---

## What is Vetri?

Vetri (வெற்றி — *victory*) is a personal AI agent that runs the **same agent core** across a CLI,
a terminal TUI, an Electron desktop app, a web dashboard, and a messaging gateway covering
Telegram, Discord, Slack and ~20 more platforms. It remembers across sessions, delegates to
subagents, runs scheduled jobs, drives a real terminal and browser — and it **ships with a
cybersecurity and penetration-testing skill arsenal by default**.

Vetri is free, open-source software, released under the [MIT License](LICENSE).

## Highlights

- 🧠 **Persistent memory** — learns across sessions with pluggable memory providers
- 🛠️ **Real tool use** — drives your terminal, files, browser (CDP), computer-use and 50+ built-in tools
- 🤖 **Subagents & delegation** — parallel specialist workers with isolated contexts
- ⏰ **Scheduled jobs** — cron-style autonomous tasks and Kanban-driven goal loops
- 🔌 **Plugins & skills** — capability lives at the edges: extend with plugins, MCP servers and skills
- 🌉 **Messaging gateway** — one agent, ~20 chat platforms (Telegram, Discord, Slack, WhatsApp, …)
- 🖥️ **Four surfaces** — Rich CLI, Ink-based TUI, Electron desktop app, embedded web dashboard
- 💸 **Cost-aware** — per-conversation prompt caching, context compression, auxiliary side-LLM routing
- 🔐 **Model-agnostic** — NVIDIA NIM, OpenAI-compatible, Anthropic, Ollama and more; bring any key
- **Model catalog** - `vetri models`: active model, context window, aliases and profiles at a glance
- **Code diagnostics** - `vetri diagnose`: lint/type-check any repo with whatever checkers are installed

## 🔴 Security Arsenal

Vetri is the first personal agent distribution that treats offensive security as a first-class
capability, with **72 active security skills** in two categories:

| Category | Count | Coverage |
|---|---|---|
| `cybersecurity` | 62 | Web/API pentesting (OWASP Top 10, JWT, OAuth2, XSS, SQLi, SSRF, BOLA), recon (nmap, subfinder, OSINT, Shodan), AD & network (priv-esc, Kerberoasting, NTLM relay), cloud & K8s (Pacu), malware RE (Ghidra, YARA), AI security (prompt injection, LLM red-teaming) |
| `pentesting` | 10 | Autonomous pentest orchestration, agent-safe tool playbooks, vulnerability-class testing (IDOR, SQLi, XSS, SSRF), evidence discipline, task-tree methodology |

- Curated from [mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills)
  (818 skills, Apache-2.0) — attribution in [`skills/cybersecurity/ATTRIBUTION.md`](skills/cybersecurity/ATTRIBUTION.md).
- Activate any of the remaining 700+ upstream skills by copying its directory into
  `skills/cybersecurity/` — Vetri indexes it on next start.

> ⚠️ **Authorized and lawful use only.** Security skills contain offensive techniques for
> authorized penetration testing, research and education. You are responsible for legal compliance.

## Quick Start

**Requirements:** Python 3.11–3.14 · [uv](https://docs.astral.sh/uv/) · an LLM API key
(NVIDIA NIM free tier works out of the box)

```bash
git clone <this-repo>
cd vetri

# Provision the environment (uv-managed venv)
./activate            # macOS/Linux — PowerShell: activate.ps1 · fish: activate.fish

# First-run setup wizard (model, provider, API key)
vetri setup

# Health check — everything green means you're ready
vetri doctor

# Talk to your agent
vetri
```

Your first message in a fresh terminal:

```
vetri chat -q "Hello — who are you?" --yolo
```

> 💬 The agent introduces itself: *"I am Vetri Agent, a free, open-source AI agent developed by
> Pugazhmani K."*

## Configuration

| File | Purpose |
|---|---|
| `~/.vetri/config.yaml` | All behaviour: model, toolsets, memory, compression, gateway, skills (`vetri config set …`) |
| `~/.vetri/.env` | **Secrets only** — API keys, tokens, passwords |
| `~/.vetri/skills/` | Skills by category (`cybersecurity/`, `pentesting/`, …) |
| `~/.vetri/logs/` | `vetri logs` |

On Windows the home is `%LOCALAPPDATA%\vetri`. Example `.env`:

```ini
NVIDIA_API_KEY=nvapi-...      # https://integrate.api.nvidia.com
```

```yaml
# config.yaml
model: nvidia/nemotron-3-super-120b-a12b
```

## Surfaces

| Surface | Command | Notes |
|---|---|---|
| CLI | `vetri` | Rich panels, slash commands, autocomplete |
| TUI | `vetri --tui` | Ink-based full-screen terminal UI |
| One-shot | `vetri chat -q "…" --yolo` | Scripting & CI friendly |
| Gateway | `vetri gateway setup` | Telegram/Discord/Slack/… service install |
| MCP | `vetri mcp serve` | Expose Vetri tools to any MCP client |
| Dashboard | `vetri dashboard` | Web UI embedding the real TUI |

## Project Layout

```
vetri/
├── run_agent.py       # AIAgent facade — the turn loop lives in agent/turn_*.py
├── cli.py             # VetriCLI (REPL, slash dispatch) + vetri_cli/cli_*_mixin.py
├── agent/             # turn phases, providers, memory, compression, prompt builder
├── tools/             # tool implementations + environments/backends
├── gateway/           # messaging gateway facade + ~20 platform adapters
├── skills/            # bundled skills (cybersecurity, pentesting, devops, web, …)
├── plugins/           # memory, kanban, image-gen, model providers, platforms
├── ui-tui/            # Ink terminal UI        apps/desktop/  # Electron app
├── web/               # dashboard SPA          tui_gateway/   # JSON-RPC backend
├── cron/              # scheduler              pm/            # env & deps manager
└── website/           # docs (Docusaurus)
```

## Updating

```bash
cd vetri
git pull
uv sync --extra all
```

## Credits

- **Security skills:** curated from [Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills)
  by Mahipal Jangra ([@mukul975](https://github.com/mukul975)), [Apache-2.0](https://github.com/mukul975/Anthropic-Cybersecurity-Skills/blob/main/LICENSE).
- **Pentesting skills:** methodology playbooks by [Strix](https://docs.strix.ai) (Apache-2.0).
- **Vetri development & branding:** [Pugazhmani K](https://github.com/pugazh342) — AI & Cybersecurity Researcher.

## License

[MIT](LICENSE) — © Pugazhmani K and contributors. Bundled third-party skills keep
their own licenses (see [`skills/cybersecurity/ATTRIBUTION.md`](skills/cybersecurity/ATTRIBUTION.md)).

---

<div align="center">

**Vetri** · built for the people who secure things ⬢

</div>
