#!/usr/bin/env python3
"""Fail when the tree carries upstream identity Vetri must not ship.

Vetri is an independent project: the hermes/Nous Agent branding, the hermes
documentation domain, the upstream Discord community, and ``@nous-research``
package references are all gone. ``Nous`` stays only as a *model provider*
(portal/inference endpoints, billing strings, the sign-in button) and as
historical record (LICENSE copyright, CHANGELOG provenance, .mailmap authorship,
release author tables) — those files are the explicit KEEP lists below, not a
policy exception made at match time.

Patterns checked (every tracked, non-binary file):

  hermes              case-insensitive; hermes branding / hermes-agent domains
  Nous Research       the upstream identity phrase (provider/history files kept)
  nousresearch.com    case-insensitive; must be a known provider endpoint
                      subdomain (portal., inference-api., ...) or a root-domain
                      hit in a KEEP file (.mailmap e-mails, host matching, ...)
  NousResearch/       GitHub slug of upstream repos (datasets, upstream refs)
  discord\\.gg/       upstream community invite links (third-party skill docs kept)
  @nous-research      package scope references (vendored UI, kept fixtures)

A violation is ``path:line: [pattern] excerpt``. Fix the text, move the
reference to ``pugazh342/Agent-Vetri``, or — when the mention really is the
kept provider/history — add the file to the matching KEEP list with a comment
explaining why. ``*`` in a KEEP entry crosses ``/`` (fnmatch), so ``tests/*``
covers the whole subtree.

Run: python scripts/check_vetri_independence.py
"""

from __future__ import annotations

import fnmatch
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]

# (pattern, git-grep -i?, compiled regex)
_PATTERNS: list[tuple[str, bool, re.Pattern[str]]] = [
    ("hermes", True, re.compile(r"hermes", re.IGNORECASE)),
    ("Nous Research", False, re.compile(r"Nous Research")),
    ("nousresearch.com", True, re.compile(r"nousresearch\.com", re.IGNORECASE)),
    ("NousResearch/", False, re.compile(r"NousResearch/")),
    ("discord.gg/", False, re.compile(r"discord\.gg/")),
    ("@nous-research", True, re.compile(r"@nous-research", re.IGNORECASE)),
]

# Provider/hosted endpoint subdomains of nousresearch.com that the kept Nous
# provider integration legitimately references (docs, client config, tests).
# A subdomain outside this set fails: new endpoint references are a review
# event, not a silent addition.
_KNOWN_SUBDOMAINS = frozenset({
    "agent", "agents", "api", "ares-3009", "connector-gateway",
    "evil-connector-gateway", "example", "example-env", "firecrawl-gateway",
    "gateway", "inference", "inference-api", "openai-audio-gateway", "portal",
    "staging", "stg-inference", "stg-inference-api", "telemetry", "tool-gateway",
    "tools", "welcome-api",
})

# fnmatch entries per pattern; `*` crosses `/`. Each entry keeps a reviewed
# class of upstream identity, not an individual slip.
_KEEP: dict[str, tuple[str, ...]] = {
    "hermes": (
        "CHANGELOG.md",        # v0.1.0 provenance entry (historical record)
        # hermes-parser / hermes-estree: Meta's Hermes Flow-parser npm packages,
        # a real transitive dependency of eslint-plugin-react-hooks. Registry
        # artifact names, not our branding surface (a lockfile rename breaks
        # npm ci with a 404).
        "package-lock.json",
        "PROJECT_REPORT.md",   # upstream project report (historical record)
        # Third-party maintainer's repository name (itpartypattaya's fork of the
        # holographic memory provider); not our branding and not renamable.
        "plugin-catalog/holographic.yaml",
        # Vendored @vetri/ui package: upstream hermes-era content and provenance
        # citations snapshot verbatim; not our branding surface (kept class,
        # like optional-skills).
        "vendor/ui/*",
    ),
    "Nous Research": (
        ".mailmap", "CHANGELOG.md", "LICENSE", "PROJECT_REPORT.md",
        "locales/*",                        # billing consent + "Sign in with Nous" UI
        "agent/agent_init.py",              # vetri_models_not_agentic warning
        "agent/anthropic_adapter.py",       # upstream-model -> wire-name table
        "apps/desktop/*",                   # MSIX cert, OAuth/sign-in fixtures, product ids
        "optional-skills/research/osint-investigation/references/sources/gdelt.md",
        "plugin-catalog/*",                 # non-affiliation disclaimers
        "plugins/*/nous/*",                 # Nous provider + dashboard auth plugins
        "scripts/msix-shared.mjs",          # MSIX signing cert identity
        "scripts/contributor_audit.py",     # release authorship e-mail filters
        "scripts/release.py",
        "scripts/releases/authors_legacy.py",
        "skills/creative/ascii-video/references/inputs.md",  # quoted upstream text
        "skills/index-cache/*",             # third-party skill index cache
        "skills/productivity/*/LICENSE",    # third-party licenses in skill dirs
        "tests/*",                          # fixtures mirroring kept product strings
        "ui-tui/*",                         # billing/subscription/branding catalog
        "vetri_cli/model_switch.py",        # vetri_models_not_agentic warning
        "vetri_platform/resolver/known_dirs.py",  # legacy upstream path resolution
        "website/docs/guides/run-nemotron-3-ultra-free.md",   # Nous model docs
        "website/docs/guides/run-vetri-with-nous-portal.md",  # Nous Portal provider guide
        "website/docs/integrations/nous-portal.md",
        "website/docs/integrations/providers.md",
        "website/docs/reference/faq.md",    # provider FAQ sections
        "website/docs/user-guide/desktop.md",            # "Default provider: Nous Research" ref
        "website/docs/user-guide/egress/iron-proxy.md",  # provider egress doc
        "website/docs/user-guide/features/memory-providers.md",  # holographic handoff history
        "website/docs/user-guide/features/web-dashboard.md",     # provider sections
        "website/i18n/*",                   # translated provider mirrors
        "vendor/ui/*",                      # vendored @vetri/ui (see hermes entry)
    ),
    "NousResearch/": (
        "CHANGELOG.md",
        "agent/nous_wire.py",               # upstream API reference
        "evals/postmortem/*",               # upstream incident citation
        "optional-skills/creative/kanban-video-orchestrator/*",  # upstream setup refs
        "optional-skills/gaming/pokemon-player/SKILL.md",
        "optional-skills/mlops/training/axolotl/references/other.md",
        "optional-skills/research/research-paper-writing/references/autoreason-methodology.md",
        "plugins/model-providers/nebius-token-factory/__init__.py",  # upstream verbatim import
        "scripts/sample_and_compress.py",   # upstream dataset script
        "tests/*",                          # fixtures (model warnings, provider slugs)
        "vetri_cli/config_defaults.py",     # model catalog warnings
        "vetri_cli/model_switch.py",
        "vetri_cli/providers.py",
        "website/docs/developer-guide/relay-connector-contract.md",  # upstream issue ref
        "website/docs/getting-started/learning-path.md",             # upstream Atropos repos
        "website/docs/user-guide/features/web-dashboard.md",
        "website/docs/user-guide/skills/optional/gaming/gaming-pokemon-player.md",
        "website/i18n/*",
        "vendor/ui/*",                      # vendored @vetri/ui (see hermes entry)
    ),
    "discord.gg/": (
        # Third-party (optional-skills) communities: upstream's, not ours —
        # they stay because the skills are verbatim third-party content.
        "optional-skills/mlops/*",
        "website/docs/user-guide/skills/optional/mlops/*",
        "website/i18n/*/docusaurus-plugin-content-docs/current/user-guide/skills/optional/mlops/*",
        "vendor/ui/*",                      # vendored @vetri/ui (see hermes entry)
    ),
    "@nous-research": (
        "optional-skills/creative/pretext/templates/donut-orbit.html",  # esm.sh CDN refs
        "vendor/ui/*",                      # vendored @vetri/ui (see hermes entry)
    ),
    "nousresearch.com": (
        # Root-domain (non-provider-subdomain) hits only: subdomains are
        # validated against _KNOWN_SUBDOMAINS instead.
        ".mailmap",                          # historical author e-mails
        "PROJECT_REPORT.md",
        "agent/agent_runtime_helpers.py",    # provider host matching
        "agent/chat_completion_helpers.py",
        "agent/message_sanitization.py",
        "agent/reasoning_params.py",
        "apps/desktop/electron/backend-health.test.ts",  # host-matching fixture
        "plugins/model-providers/nous/__init__.py",      # signup_url
        "scripts/contributor_audit.py",      # release authorship e-mail filters
        "scripts/release.py",
        "scripts/releases/authors_legacy.py",
        "tests/*",                           # host identity / gateway fixtures
        "tools/managed_tool_gateway.py",     # TOOL_GATEWAY_DOMAIN default
        "trajectory_compressor.py",          # provider slug mapping
        "vetri_cli/config_defaults.py",      # gateway domain comment
        "website/docs/reference/environment-variables.md",
        "website/i18n/*",
        "vendor/ui/*",                      # vendored @vetri/ui (see hermes entry)
    ),
}

_SUBDOMAIN_BEFORE = re.compile(r"([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\.$")


def _grep(pattern: str, ignore_case: bool) -> list[str]:
    argv = ["git", "grep", "-I", "-n"]
    if ignore_case:
        argv.append("-i")
    argv += ["-e", pattern]
    # The pattern table necessarily contains every pattern; never judge the judge.
    argv += ["--", ":(exclude)scripts/check_vetri_independence.py"]
    proc = subprocess.run(argv, cwd=REPO, capture_output=True, encoding="utf-8",
                          errors="replace", check=False, timeout=120)
    if proc.returncode not in (0, 1):  # 1 = no match
        sys.stderr.write(proc.stderr)
        raise SystemExit(2)
    return [ln for ln in proc.stdout.splitlines() if ln]


def _allowed(pattern: str, path: str) -> bool:
    return any(fnmatch.fnmatchcase(path, entry) for entry in _KEEP.get(pattern, ()))


def _domain_ok(line: str) -> bool:
    """Every nousresearch.com occurrence is a kept subdomain or root hit here."""
    for match in re.finditer(r"nousresearch\.com", line, re.IGNORECASE):
        sub = _SUBDOMAIN_BEFORE.search(line[:match.start()])
        if sub is not None and sub.group(1).lower() not in _KNOWN_SUBDOMAINS:
            return False
        # root-domain hits are validated by the file KEEP list
    return True


def main() -> int:
    violations: list[str] = []
    checked = 0
    for pattern, ignore_case, regex in _PATTERNS:
        hits = 0
        for raw in _grep(pattern, ignore_case):
            path, _, text = raw.partition(":")
            _, _, content = text.partition(":")  # drop the line number
            if not regex.search(content):
                continue  # line matched a different -e pattern in the same run
            hits += 1
            checked += 1
            if _allowed(pattern, path):
                continue
            if pattern == "nousresearch.com" and _domain_ok(content):
                continue  # known provider subdomain in an unlisted file
            excerpt = content.strip()
            violations.append(
                f"{path}: {pattern}: {excerpt[:160]}"
                if len(excerpt) > 160 else f"{path}: {pattern}: {excerpt}"
            )
        print(f"{pattern:<18} {hits} hits")
    if violations:
        print(f"\nvetri-independence: {len(violations)} violation(s):")
        for v in violations:
            print(f"  {v}")
        print(
            "\nRebrand the mention, point it at pugazh342/Agent-Vetri, or — for a"
            "\nreviewed provider/history reference — add the file to _KEEP in"
            "\nscripts/check_vetri_independence.py with a comment saying why."
        )
        return 1
    print(f"vetri-independence: clean ({checked} allowed hits checked)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
