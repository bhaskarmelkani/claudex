# Claudex

This repo packages a shareable Claude Code setup for multi-AI deliberation.

It adds:

- automatic deliberation on `/plan ...`
- a reusable `/deliberate` skill
- Codex MCP wiring for Claude Code
- a shared toggle for enabling or disabling auto-deliberation
- project-local permission rules for this workspace

The goal is simple: keep the source of truth in this repo, then symlink the
live Claude home files back to it so the setup is easy to share, version, and
update.

## What This Does

When installed and enabled:

- `/plan some technical decision` still enters Claude plan mode normally
- a `UserPromptSubmit` hook injects the deliberate workflow automatically
- Claude uses Codex as a second reviewer to improve the plan quality
- the visible answer stays plan-first, not transcript-first

Manual `/deliberate ...` remains available as a fallback.

## Repo Layout

```text
claude-home/
  settings.fragment.json          # Global Claude settings to merge into ~/.claude/settings.json
  deliberate/config.json          # Shared toggle config
  hooks/auto-deliberate-on-plan.js
  skills/deliberate/SKILL.md

.claude/settings.local.json       # Project-local permissions for this repo
scripts/install-claude-home-links.sh
README.md
```

## What Is Shared vs Local

Shared in this repo:

- [claude-home/settings.fragment.json](./claude-home/settings.fragment.json)
- [claude-home/deliberate/config.json](./claude-home/deliberate/config.json)
- [claude-home/hooks/auto-deliberate-on-plan.js](./claude-home/hooks/auto-deliberate-on-plan.js)
- [claude-home/skills/deliberate/SKILL.md](./claude-home/skills/deliberate/SKILL.md)
- [.claude/settings.local.json](./.claude/settings.local.json)

Local on each machine:

- `~/.claude/settings.json`
- `~/.claude/hooks/auto-deliberate-on-plan.js` -> symlink to this repo
- `~/.claude/skills/deliberate/SKILL.md` -> symlink to this repo
- `~/.claude/deliberate/config.json` -> symlink to this repo
- `~/.claude/deliberations/` for generated logs

## Prerequisites

Before installing, each teammate should have:

- Claude Code installed
- Codex CLI installed and available as `codex`
- Codex authenticated locally

## Install

Clone the repo, then run:

```bash
bash scripts/install-claude-home-links.sh
```

The installer will:

1. create or update these symlinks:
   - `~/.claude/hooks/auto-deliberate-on-plan.js`
   - `~/.claude/skills/deliberate/SKILL.md`
   - `~/.claude/deliberate/config.json`
2. merge [claude-home/settings.fragment.json](./claude-home/settings.fragment.json)
   into `~/.claude/settings.json`
3. preserve any replaced local files as `*.bak.<timestamp>`

Restart Claude Code after installation.

## Toggle Auto Deliberation

Edit [claude-home/deliberate/config.json](./claude-home/deliberate/config.json):

```json
{
  "auto_on_plan": true
}
```

Set `auto_on_plan` to `false` to disable the `/plan` auto-activation behavior.

Because the live Claude config is symlinked back to this repo, changing this
file updates the installed setup too.

## Verify The Setup

After restart, run:

```text
/plan should we migrate from REST to GraphQL for a new internal API?
```

Expected behavior:

- Claude enters plan mode normally
- deliberation auto-activates without `/deliberate`
- Codex is used as the second reviewer
- the final answer is plan-first and concise

Then run:

```text
/plan auth
```

Expected behavior:

- Claude asks exactly one clarifying question before starting the deliberation

Optional manual fallback:

```text
/deliberate should we use Prisma or Drizzle for a new service?
```

## Notes

- This repo currently packages the setup, but it is not itself a git repo yet.
- Generated deliberation logs are intentionally not stored in this repo; they go
  to `~/.claude/deliberations/`.
- If Codex MCP is unavailable, the skill can fall back to Codex CLI.
