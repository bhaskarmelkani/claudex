# Claudex

A Claude Code plugin for multi-AI deliberation between Claude and Codex.

Claude reasons inline, a persistent Codex partner runs in the background,
and you watch both sides of the debate stream live in your terminal —
like overhearing a technical argument between two senior engineers.

## Install

```
/plugin install bhaskar-melkani/claude-codex
```

Registers automatically:

- `/deliberate` and `/deliberate-template` skills
- `/council` skill for parallel multi-track analysis
- Codex MCP server wiring
- Auto-deliberation hook on `/plan`

### Prerequisites

- [Claude Code](https://claude.ai/code) installed
- [Codex CLI](https://github.com/openai/codex) installed as `codex` and authenticated

---

## Usage

### Direct deliberation

```
/deliberate "Should we use Prisma or Drizzle for the new service?"
```

### From a template (guided topic builder)

```
/deliberate-template
```

Picks from 12 common decision types (REST vs GraphQL, SQL vs NoSQL,
Monolith vs Microservices, etc.) and asks 2-3 questions to build a
focused topic before launching.

### Multi-track council (parallel analysis)

```
/council "Should we migrate to microservices?"
```

Decomposes the decision into 2-4 orthogonal tracks (cost, deployment,
team structure, performance) and runs each as a simultaneous Claude+Codex
deliberation. Results are synthesized into a unified recommendation.

### Automatic on /plan

```
/plan should we switch from Postgres to CockroachDB?
```

The hook detects `/plan` and injects the deliberation workflow automatically.

---

## What the terminal looks like

```
================================================================
  DELIBERATION STARTING
================================================================
  Topic     : Should we use Prisma or Drizzle for the new service?
  Claude    : Opus 4.6  (inline)
  Codex     : GPT-5.4-mini  (background partner)
  Max rounds: 5  (min 2)
  Log       : ~/.claude/deliberations/2026-04-03-prisma-vs-drizzle-a4f1.md
================================================================

● Codex deliberation partner
  L Running in the background

================================================================
  ROUND 1 / 5
================================================================

  ┌─ Claude ──────────────────────────────────────────────────
  │ **Thesis:** Prisma is the right choice for this team because
  │ its type-safe client eliminates an entire class of runtime errors.
  │
  │ ### Position
  │ At ~50k writes/day with a TypeScript-first team and no prior ORM
  │ experience, Prisma's generated client is a significant productivity
  │ win...
  └───────────────────────────────────────────────────────────

  ┌─ Codex  ──────────────────────────────────────────────────
  │  (thinking...)
  ...
  │ **Thesis:** Drizzle's zero-overhead SQL approach is safer at scale.
  │
  │ ### Position
  │ Prisma's query engine adds ~20ms cold-start latency in serverless
  │ environments and its migration system has known pain points...
  └───────────────────────────────────────────────────────────

  Round 1 complete.
  Still disputed: migration DX, serverless cold-start overhead
----------------------------------------------------------------
```

---

## Architecture

```
Main session (Claude, inline)           Codex partner (background agent)
─────────────────────────────────       ──────────────────────────────────
Phase 1: setup, spawn partner       ──► partner starts, awaits Round 1

Round 1:
  Claude position (streams live)
  SendMessage("codex-partner")      ──► calls mcp__codex__codex (GPT-5.4-mini)
                                        stores threadId internally
                        ◄── response ──
  Print Codex response (live)

Round 2–5:
  Claude responds to Codex
  SendMessage("codex-partner")      ──► calls mcp__codex__codex-reply
                        ◄── response ──   (reuses threadId from Round 1)
  Print Codex response (live)

Phase 3: tie-breaking, final plan
  SendMessage("DELIBERATION COMPLETE") ► partner exits
```

Key properties:
- **One persistent agent** for the whole deliberation (not a new agent per round)
- **threadId lives inside the partner** — no JSON extraction or passing between agents
- **Both sides print live** — you see the conversation as it happens
- **Native Claude Code tree UI** — partner shows as `● Running in the background`

---

## Skills

### `/deliberate`

Core deliberation skill. Runs 2–5 structured rounds between Claude (Opus 4.6,
inline) and Codex (GPT-5.4-mini, background partner).

Each round uses a structured format:
- **Thesis**: One-sentence position
- **Position**: Full argument with concrete reasoning
- **Agrees With**: Points endorsed from the other side
- **Challenges**: Specific disagreements
- **Delta** (round 2+): What changed and why

Convergence is evaluated semantically after each round. An anti-sycophancy
rule forces at least 2 rounds even if Codex agrees immediately.

Unresolved disagreements are presented via interactive `AskUserQuestion`
prompts so you can resolve tie-breaks before the final plan.

### `/deliberate-template`

Template-driven version. Choose from 12 decision types, answer 2-3 targeted
questions, and get a precisely-scoped deliberation topic without having to
write one from scratch.

Templates: REST vs GraphQL, REST vs gRPC, Sync vs Event-Driven, Monolith vs
Microservices, Serverless vs Containerized, Multi-repo vs Monorepo, SQL vs
NoSQL (document), SQL vs NoSQL (key-value), Self-hosted vs Managed DB,
Build vs Buy, Framework comparison, CI/CD platform.

### `/council`

Parallel multi-track deliberation. Decomposes a complex decision into
2–4 orthogonal sub-topics, runs each as an independent Claude+Codex
deliberation in parallel (one agent per track), then synthesizes results
into a unified recommendation with cross-track themes.

Best for decisions with multiple independent dimensions — e.g., a
microservices migration has dimensions of deployment, team structure,
service boundaries, and data consistency that can all be analyzed in
parallel.

---

## Deliberation Logs

All sessions are saved to `~/.claude/deliberations/` as markdown files with
YAML frontmatter:

```
~/.claude/deliberations/
  2026-04-03-prisma-vs-drizzle-a4f1.md
  2026-04-03-council-microservices-b7c2.md
  ...
```

Each log captures: topic, participants, status, codex thread ID, round count,
and the full transcript of all positions.

Resume an interrupted deliberation:

```
/deliberate resume ~/.claude/deliberations/2026-04-03-prisma-vs-drizzle-a4f1.md
```

---

## Repo Layout

```
.claude-plugin/
  plugin.json              Plugin manifest

skills/                    Plugin-distributed skills (source of truth for installs)
  deliberate/SKILL.md
  deliberate-template/SKILL.md    (coming soon via plugin)
  council/SKILL.md                (coming soon via plugin)

claude-home/               Local dev installation (symlinked into ~/.claude/)
  skills/
    deliberate/SKILL.md
    deliberate-template/SKILL.md
    council/SKILL.md
  hooks/
    auto-deliberate-on-plan.js

agents/                    Claude specialist agent definitions (for /council teams)
  security-reviewer.md
  performance-analyst.md
  dx-reviewer.md

codex-agents/              Codex subagent templates
  architecture-reviewer.toml
  testing-strategist.toml
  scalability-analyst.toml

hooks/
  hooks.json               Hook declarations (UserPromptSubmit, SessionStart)

scripts/
  setup-codex-agents.sh    Copies Codex TOML agents to ~/.codex/agents/ on start

.mcp.json                  Codex MCP server config (codex mcp-server)
.claude/
  settings.json            Project-level permissions (auto-approves deliberation writes)
```

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `auto_on_plan` | `true` | Auto-trigger deliberation on `/plan` |
| `enable_teams` | `true` | Enable agent teams for `/council` |
| `max_specialists_per_side` | `3` | Max specialist agents per track |

---

## Uninstall

```
/plugin uninstall claudex
```
