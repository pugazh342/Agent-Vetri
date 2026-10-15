# Vetri CLI Reference

Live sources when anything looks stale: `vetri --help`, `vetri <command> --help`,
https://hermes-agent.nousresearch.com/docs/reference/cli-commands

### Global Flags

```
vetri [flags] [command]        (no subcommand = interactive chat)

  --version, -V             Show version
  -z, --oneshot PROMPT      One-shot: print ONLY the final response (for scripts/pipes)
  -m MODEL  --provider P    Model/provider override for this invocation
  -t, --toolsets LIST       Comma-separated toolsets for this invocation
  --resume, -r SESSION      Resume session by ID or title
  --continue, -c [NAME]     Resume by name, or most recent session
  --worktree, -w            Isolated git worktree mode (parallel agents)
  --skills, -s SKILL        Preload skills (comma-separate or repeat)
  --profile, -p NAME        Use a named profile
  --yolo                    Skip dangerous command approval
  --tui / --cli             Force the Ink TUI / classic REPL
  --ignore-rules            Skip AGENTS.md/SOUL.md/memory/skill injection
  --safe-mode               Disable ALL customizations (troubleshooting)
  --pass-session-id         Include session ID in system prompt
```

### Chat

```
vetri chat [flags]
  -q, --query TEXT          Single query, non-interactive
  --image PATH              Attach a local image to a single query
  -Q, --quiet               Suppress banner, spinner, tool previews
  --checkpoints             Enable filesystem checkpoints (/rollback)
  --max-turns N             Cap tool-calling iterations
  --source TAG              Session source tag (default: cli)
```
(plus the global flags above)

### Configuration

```
vetri setup [section]      Wizard (model|tts|terminal|gateway|tools|agent)
vetri model                Interactive model/provider picker
vetri fallback [add|remove|list]  Fallback provider chain
vetri config [show|edit|get|set|unset|path|env-path|check|migrate]
vetri login / logout       OAuth sign-in / clear stored auth
vetri doctor [--fix]       Check dependencies and config
vetri status [--full]      Component summary (--full: every section)
```

### Tools & Skills

```
vetri tools [list|enable NAME|disable NAME]   Per-platform toolsets (curses UI with no args)

vetri skills list|browse|search QUERY|inspect ID
vetri skills install ID    Hub identifier OR a direct https://…/SKILL.md URL
vetri skills config        Enable/disable skills per platform
vetri skills check|update|uninstall|publish PATH
vetri skills tap add REPO  Add a GitHub repo as a skill source
vetri bundles              Skill bundles (one /<name> alias loads several skills)
```

### MCP Servers

```
vetri mcp add NAME (--url or --command) | remove | list | test NAME
vetri mcp catalog | install NAME     Curated catalog install
vetri mcp configure NAME             Toggle tool selection
vetri mcp serve                      Run Vetri as an MCP server
```
Details (transport, tool discovery, catalog): `references/native-mcp.md`.

### Gateway (Messaging Platforms)

```
vetri gateway run|install|start|stop|restart|status|setup
```

20+ platforms: Telegram, Discord, Slack, WhatsApp (Baileys + Business Cloud API), iMessage (Photon — `vetri photon setup`), Signal, Email, SMS, Matrix, Mattermost, Teams, LINE, SimpleX, ntfy, Google Chat, Home Assistant, DingTalk, Feishu, WeCom, Weixin, API Server, Webhooks. Open WebUI connects via the API Server adapter. Most adapters ship under `plugins/platforms/`.
Docs: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/

### Sessions

```
vetri sessions list|browse|rename ID TITLE|delete ID|export OUT|prune|stats
```

### Cron / Webhooks

```
vetri cron list|create SCHED|edit ID|pause|resume|run ID|remove|status
    Schedules: '30m', 'every 2h', '0 9 * * *', ISO timestamp
vetri webhook subscribe NAME|list|remove NAME|test NAME
```
Webhook payloads/routes: `references/webhooks.md`.

### Profiles

```
vetri profile list|create NAME (--clone|--clone-all|--clone-from)|use|show|delete
vetri profile rename A B | alias NAME | export NAME | import FILE
vetri profile migrate-identity A B   Retry a completed rename's session/routing identity migration
```

### Credentials & Pools

```
vetri auth                 Interactive credential manager
vetri auth add [PROVIDER]  Add OAuth or API-key credential (nous, openai-codex, qwen-oauth, …)
vetri auth list|remove P IDX|reset PROVIDER|status
```
Multiple credentials per provider form a pool that rotates automatically and skips exhausted keys.

### Other

```
vetri desktop / gui        Native desktop app
vetri dashboard            Web admin panel + embedded chat (--stop / --status)
vetri proxy                OpenAI-compatible local proxy backed by an OAuth provider
vetri portal               Quick setup / sign in via Nous Portal
vetri kanban <verb>        Multi-agent work-queue board
vetri project              Named multi-folder workspaces
vetri skin list|use|set    Switch/tweak skins (see references/themes.md)
vetri pets <verb>          Pet mascots (see references/petdex.md)
vetri memory setup|status|off|reset   Memory provider
vetri secrets bitwarden|onepassword   External secret stores
vetri moa                  Mixture-of-Agents slots
vetri hooks / security / backup / import / checkpoints / console
vetri logs [-f] [errors]   View agent/error logs
vetri send                 One-off message through a gateway platform
vetri pairing / plugins / insights / journey / computer-use
vetri acp                  ACP server (IDE integration)
vetri completion bash|zsh|fish
vetri update / uninstall / claw migrate
```

Plugin- and provider-supplied subcommands (e.g. `vetri photon setup`) only appear once their plugin is installed/active.

### Where to Find Things

| Looking for... | Location |
|---|---|
| Config options | `vetri config edit` · [Configuration docs](https://hermes-agent.nousresearch.com/docs/user-guide/configuration) |
| Tools / toolsets | `vetri tools list` · [Tools reference](https://hermes-agent.nousresearch.com/docs/reference/tools-reference) |
| Skills catalog | `vetri skills browse` · [Skills catalog](https://hermes-agent.nousresearch.com/docs/reference/skills-catalog) |
| Provider setup | `vetri model` · [Providers guide](https://hermes-agent.nousresearch.com/docs/integrations/providers) |
| Env variables | `vetri config env-path` · [Env vars reference](https://hermes-agent.nousresearch.com/docs/reference/environment-variables) |
| Gateway logs | `~/.vetri/logs/gateway.log` (or `vetri logs`) |
| Sessions | `vetri sessions browse` (reads state.db) |
