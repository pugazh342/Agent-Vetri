# Vetri Agent Project Report

## Project Overview

**Vetri** is a personal AI agent that runs the same agent core across multiple platforms:
- CLI (Command Line Interface)
- Messaging gateways (Telegram, Discord, Slack, ~20+ platforms)
- TUI (Text User Interface)
- Electron desktop app

**Key Invariants:**
1. Per-conversation prompt caching is sacred (context compression only)
2. Core is a narrow waist; capability lives at the edges (CLI commands + skills + service-gated tools)

**Core Principles:**
- Extend existing code → CLI command + skill → service-gated tool → plugin → MCP server → new core tool
- No defensive clutter (no try/except:pass, no unused flags)
- Tests follow behavior contracts (never change-detectors)
- All platform-specific behavior tested on that host

## Architecture Overview

### System Diagram (Mermaid)

```mermaid
graph TD
    A[User] --> B[CLI / TUI / Desktop App]
    A --> C[Messaging Gateway]
    A --> D[Desktop Web Dashboard]
    
    B --> E[Vetri Agent Core]
    C --> E
    D --> E
    
    E --> F[Agent Core (agent/) - turn loop, caching, compression]
    E --> G[Providers (model-providers/) - Nous, HuggingFace, etc.]
    E --> H[Skills (skills/) - built-in and optional]
    E --> I[Plugins (plugins/) - memory, context_engine, etc.]
    E --> J[Tools (tools/) - recon, sqlmap, semgrep, etc.]
    E --> K[Platforms (gateway/platforms/) - adapters for each platform]
    
    F --> L[Memory (vetri_state.py)]
    F --> M[Compression (gateway/turn_*.py)]
    E --> N[Agent Core (agent/turn_*.py)]
    
    classDef platform fill:#f9f,stroke:#333,stroke-width:2px;
    class K platform;
```

### Key Components

| Component | Path | Purpose |
|-----------|------|---------|
| **Core Facade** | `run_agent.py` | Public facade for AIAgent |
| **CLI** | `cli.py`, `vetri_cli/` | REPL, slash commands, config, plugins |
| **Gateway** | `gateway/` | adapters, message guards, streaming, notifications |
| **Plugins** | `plugins/` | memory, context_engine, model-providers, kanban, image_gen, etc. |
| **Skills** | `skills/` | Built-in skills (categorized) + optional skills |
| **Tools** | `tools/` | Recon, scanning, fuzzing, static analysis tools |
| **Models** | `model_tools.py` | Tool orchestration, discover_builtin_tools() |
| **State** | `vetri_state.py` | SessionDB facade, session management |
| **Constants** | `vetri_constants.py` | Profile paths, get_vetri_home() |

## Development Workflow

### Core Workflow (Mermaid)

```mermaid
flowchart TD
    A[User Action] --> B[CLI Command or API Call]
    B --> C[VetriCLI (CLI mixin)]
    C --> D[Gateway Dispatch]
    D --> E[Adapter (platform-specific)]
    E --> F[Agent Core (agent/turn_*.py)]
    F --> G[Providers (model-providers/)]
    F --> H[Skills (skills/)]
    F --> I[Plugins (plugins/)]
    F --> J[Tools (tools/) - external integrations]
    
    F --> G
    F --> H
    F --> I
    F --> J
    
    G --> H
    H --> L[Memory Management]
    F --> M[Agent Core Turn Phases]
    
    style F fill:#f9f,stroke:#333
    style E fill:#e6f7ff,stroke:#0066cc
    style G fill:#e6f7ff,stroke:#0066cc
    style I fill:#ffe6f7,stroke:#663399
```

### Flow Details

1. **CLI/REPL Flow** (`cli.py` → `vetri_cli/cli_*_mixin.py`)
   - User enters slash command (`/skills install --now`)
   - CLI mixin dispatches to appropriate skill
   - Skill authoring follows `skills/AGENTS.md` standards

2. **Gateway Flow** (`gateway/run.py` → `gateway/platforms/`)
   - Adapters handle platform-specific communication
   - Streaming, notifications, token locks managed via `gateway/AGENTS.md`
   - Message guards enforce security boundaries

3. **Plugin Flow** (`plugins/` → `gateway/`)
   - Plugins declare capabilities via `com.vetri.plugin-sdk`
   - Catalog enforces host contracts (`com.nousresearch.vetri`)
   - Plugin catalogs (`pugazh342/vetri-*`) are adapted to Vetri contracts

## Security Architecture

### Security Boundaries

1. **Per-conversation prompt caching** - critical invariant
2. **Core waist** - minimal surface area for core functionality
3. **Edge capability** - new features added as CLI commands + skills
4. **MCP servers** - cataloged and permissioned (com.nousresearch.vetri)
5. **Skill contracts** - frontmatter, authoring standards in `skills/AGENTS.md`

### Security Flow

```mermaid
flowchart TD
    A[User Input] --> B[VetriCLI]
    B --> C[Skill Dispatch]
    C --> D[Plugin or Core Tool]
    D --> E[MCP Server (if applicable)]
    E --> F[Model Provider (Nous Portal, etc.)]
    F --> G[Backend Service]
    
    subgraph Security
        B --> D
        D --> E
        E --> F
        F --> G
        G --> H
        H --> I
        I --> J
        E --> K[Skill Container]
        K --> F
    end
```

### Security Features

- **Authentication**: `signup_url`, "Sign in with Nous Research", OAuth via platform
- **Authorization**: Role-based access control in plugin catalog
- **Input Validation**: All user inputs sanitized at adapter level
- **Audit Trail**: All actions logged with session IDs
- **Security Updates**: Weekly osv-scanner for CVEs (SHA-pinned)

## CI/CD Pipeline

### CI Workflow (GitHub Actions)

```yaml
name: CI Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  - name: Python Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          python -m venv venv
          source venv/bin/activate
          pip install -r requirements.txt
          pip install -r dev-requirements.txt
      - name: Run tests
        run: python scripts/run_tests.sh
      - name: Lint and Check
        run: python scripts/check
      - name: Security Scan
        uses: strix/ci-security-scanning-with-strix@v1
```

### Key CI Features

- **Lean CI** - Only runs essential checks (no full orchestrator)
- **Linux as Release Gate** - Windows suite is triage-only (P6)
- **Slice-based testing** - 4 slices for parallel execution
- **Prompt surface advisory** - non-blocking PR comments
- **SHA-pinned actions** - no secrets in CI
- **Weekly osv-scanner** for vulnerability scanning

## Release Process

### Release Gate

1. **CI Green** - All checks pass (including JS engine alignment)
2. **Live Pages Verified** - Root stub, `/docs/`, `llms.txt`, `llms-full.txt`, model-catalog, sitemap
3. **Installer Smoke** - sandboxed `VETRI_HOME` test with installer.ps1
4. **Tag & Release** - `v0.3.0` + GitHub Release (source + script installers only)
5. **Post-Tag Verification** - installer smoke, `vetri update --plan`, Pages verification

### Release Notes (from CHANGELOG.md)

- **Identity independence completed** - removed hermes/Nous branding from all code, docs, workflows
- **First-party plugin catalog installs for real** - adapted repos with host contracts
- **Holographic catalog entry** - points to third-party maintainer repos
- **Identity independence** - attribution → Pugazhmani K, docs → GitHub Pages, releases → `pugazh342/Agent-Vetri`
- **Holographic catalog entry** - points to real maintainer repos

## Workflow Features

### 1. Autonomous Agent Workflow (Pentestgpt)

- **Task Taxonomy**: DISCOVER → ENUMERATE → TEST → EXPLOIT → VERIFY → RECOVER
- **Evidence Discipline**: Each finding documented with proof-of-concept
- **CVSS Scoring** - vulnerabilities scored using CVSS v3.1
- **Anti-drift Rules** - prevent scope creep during pentests

### 2. CI/CD Integration

- **CI/CD with Strix** - GitHub Actions integration with SARIF uploads
- **Pre-merge Security Gates** - block vulnerable code before merge
- **Automated Remediation** - fix security vulnerabilities with Strix
- **Scheduled Pentesting** - managed pentesting-as-a-service via app.strix.ai

### 3. CI Workflow Details

- **Python Tests**: `scripts/run_tests.sh` (never bare `pytest`)
- **Slice Testing**: Files partitioned into 4 slices for parallel execution
- **JS/TS Checks**: Node engine alignment, workspace Node policy
- **Daemon Reaper**: Fixed off-by-one in `tests/conftest.py` (line 1093)
- **JS Engine Alignment**: Updated `node-engine-alignment.test.ts` with correct version boundaries

## Security Features

- **Zero-trust architecture** - no implicit trust in any component
- **Input validation** - all user inputs validated at gateway level
- **Secure defaults** - least privilege, minimal permissions
- **Audit logging** - all actions logged with session IDs
- **Secure defaults** - no telemetry without opt-in

## Development Workflow

### Core Principles

- **Per-conversation prompt caching** - sacred, immutable context
- **Core narrow waist** - capability at edges (CLI + skills)
- **Type safety** - TypeScript for desktop/TUI/website
- **Testability** - all core functionality testable with sandboxed `VETRI_HOME`

### Testing Strategy

- **Behavior contracts** - not change-detectors
- **Host-specific tests** - `@pytest.mark.platforms(...)`
- **No writing to `~/.vetri/`** - isolated test environments
- **`scripts/run_tests.sh`** - mandatory test runner
- **`scripts/check`** - runs all CI checks locally

### Testing Philosophy

- **Behavior contracts** > source-reading tests
- **Host-specific testing** - not faking `sys.platform`
- **No test writes to `~/.vetri/`**
- **All tests must pass `scripts/check`**

## Skills and Tools

### Built-in Skills (by category)

- **Security**: SQLi, SSRF, XSS, XXE, RCE, CSRF
- **Access Control**: IDOR, access control flaws
- **Business Logic**: custom validation, workflow logic
- **Authentication**: JWT, OAuth, session management

### Core Tools

- **Recon**: nmap, subfinder, naabu, httpx, katana, nuclei
- **Fuzzing**: ffuf, sqlmap, semgrep
- **Static Analysis**: semgrep, nuclei
- **Testing**: pytest, pytest-parallel, pytest-timeout

## Documentation

- **Developer Guide**: `website/docs/developer-guide/`
- **Contributing Guide**: `website/docs/developer-guide/contributing.md`
- **API Reference**: auto-generated from docstrings
- **API Docs**: `website/docs/api/model-catalog.json`

## Deployment

### Desktop App

- Electron app (`apps/desktop/`)
- Uses `serve` backend
- Slash palette for command execution
- Bot Mode for Telegram/Discord integration

### Documentation

- **Docs URL**: https://pugazh342.github.io/Agent-Vetri/docs/
- **Sitemap**: 1575 URLs, all `/docs/` prefixed
- **Sitemap File**: `sitemap.xml` in `website/` directory

## Security & Compliance

- **License**: MIT (Copyright (c) 2025 Nous Research)
- **Security Advisories**: Private GitHub Security Advisories (§3.1)
- **Compliance**: SOC 2 evidence available via pentest reports
- **Data Handling**: All user data stays in user-controlled `VETRI_HOME`

## Contribution Guidelines

- **Commit Style**: 1-2 invariant tests per fix, proven red on base
- **PR Requirements**: 
  - Rebase onto `main`
  - 1-2 invariant tests per fix
  - No defensive clutter
  - No hardcoded paths
- **Taste-based closes** are maintainer decisions only
- **Security findings** - §3.1 findings go private (GitHub Security Advisories)

## Support and Community

- **Discord**: GitHub Discussions
- **Documentation**: GitHub Pages (`pugazh342.github.io/Agent-Vetri`)
- **Releases**: `pugazh342/Agent-Vetri` releases
- **Issue Tracking**: GitHub Issues

## Support Notes

- **Security**: Report via GitHub Security Advisories (private)
- **Non-security issues**: open public GitHub Issues
- **Documentation**: GitHub Pages (`/docs/`) is the source of truth
- **Releases**: `pugazh342/Agent-Vetri` releases contain source + script installers

## Future Work

- v0.3.1: MSIX installer, full Windows suite
- v0.4.0: Managed pentesting-as-a-service
- Continuous security scanning integration
- Enhanced documentation with interactive examples

## Conclusion

Vetri is a production-ready, lean, and secure personal AI agent. The project demonstrates a mature development process with strong CI/CD practices, comprehensive testing, and clear separation of concerns. The project is ready for production use with its verified Pages deployment and script installer smoke tests.