# Claudex

A Claude Code plugin for multi-AI deliberation between Claude and Codex.

When you enter `/plan`, Claude and Codex debate your technical decision from
independent perspectives, optionally bringing specialist agent teams for deeper
analysis. The result is a higher-quality plan, not just one AI's opinion.

## Install

```
/plugin install bhaskar-melkani/claude-codex
```

That's it. The plugin registers everything automatically:

- The `/claudex:deliberate` skill
- Codex MCP server wiring
- Auto-deliberation hook on `/plan`
- Specialist agent definitions (security, performance, DX)
- Codex subagent templates (copied to `~/.codex/agents/` on first session)

### Enable Agent Teams (optional)

For team-enhanced deliberation with specialist agents on both sides:

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

Add this to your shell profile to persist it. Without this, deliberation still
works in classic 1-on-1 mode.

### Prerequisites

- [Claude Code](https://code.claude.com) installed
- [Codex CLI](https://github.com/openai/codex) installed as `codex` and authenticated

## Usage

### Automatic (on /plan)

```
/plan should we migrate from REST to GraphQL for our internal API?
```

The hook detects `/plan` and triggers the deliberation workflow automatically.
Claude and Codex debate in structured rounds, then deliver a plan-first answer.

### Manual

```
/claudex:deliberate should we use Prisma or Drizzle for a new service?
```

### Vague Topics

```
/plan auth
```

Claude asks one clarifying question before starting the deliberation.

## How It Works

```
Phase 1: Topic Setup            Parse topic, create log file
Phase 2: Intent Clarification   1-2 micro-rounds to align on scope & expertise
    |
    Teams available?
    |-- Yes --> Phase 3: Team Assembly (spawn specialists, collect findings)
    '-- No  --> Skip to Phase 4
    |
Phase 4: Deliberation Rounds    2-5 rounds with structured positions
Phase 5: Summary & Cleanup      Final plan, tie-breaking, team teardown
```

Each round uses a structured format:
- **Thesis**: One-sentence position
- **Position**: Full argument with reasoning
- **Team Input**: Specialist findings (when teams are active)
- **Agrees With**: Points endorsed from the other side
- **Challenges**: Specific disagreements

## Configuration

Plugin settings are configured via userConfig at install time:

| Setting | Default | Description |
|---------|---------|-------------|
| `auto_on_plan` | `true` | Auto-trigger deliberation on `/plan` |
| `enable_teams` | `true` | Enable agent teams for specialist input |
| `max_specialists_per_side` | `3` | Max specialist agents per side |

## Repo Layout

```
.claude-plugin/
  plugin.json              Plugin manifest
.mcp.json                  Codex MCP server config
skills/
  deliberate/
    SKILL.md               Full deliberation workflow (source of truth)
agents/                    Claude specialist agent definitions
  security-reviewer.md
  performance-analyst.md
  dx-reviewer.md
hooks/
  hooks.json               Hook declarations
scripts/
  auto-deliberate-on-plan.js   /plan detection + instruction injection
  setup-codex-agents.sh        Copies Codex TOML agents on session start
codex-agents/              Codex subagent templates
  architecture-reviewer.toml
  testing-strategist.toml
  scalability-analyst.toml
.claude/
  settings.json            Project permissions
```

## Agent Teams

When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set and `enable_teams` is
true, the deliberation gains two extra phases:

**Intent Clarification**: Claude and Codex do 1-2 fast rounds to agree on what
expertise is needed (e.g., "this topic needs security and performance analysis").

**Team Assembly**: Each side spawns specialists:
- **Claude** uses `TeamCreate` to spawn agent teammates (defined in `agents/`)
- **Codex** activates subagents (from `codex-agents/*.toml`)

Specialists provide focused analysis that feeds into the main deliberation
rounds via "Team Input" sections. Teams are cleaned up after the final plan.

If teams fail to spawn, the deliberation falls back to classic 1-on-1 mode.

## Deliberation Logs

Logs are saved to `~/.claude/deliberations/{date}-{slug}.md` with YAML
frontmatter tracking topic, participants, rounds, thread IDs, and team status.

## Updating

The plugin updates when the source repository is updated. Claude Code handles
plugin cache management automatically.

## Uninstall

```
/plugin uninstall claudex
```
