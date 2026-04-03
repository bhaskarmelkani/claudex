---
name: deliberate
description: >
  Multi-AI deliberation between Claude and Codex for technical decisions.
  Use when the user wants to deliberate, debate, brainstorm tradeoffs, or get
  a second AI perspective on architecture, migrations, library choices, API
  design, or similar high-stakes technical decisions. This skill is normally
  auto-activated on `/plan` when auto-deliberation is enabled, and can also be
  invoked manually with `/deliberate`.
argument-hint: topic
allowed-tools: mcp__codex__codex, mcp__codex__codex-reply, Bash(codex:*), Write, Read, TeamCreate, TeamDelete, SendMessage, TaskCreate, TaskList, TaskUpdate, Agent
---

# Deliberate

Use this workflow for technical deliberation and decision-making. Do not use it
for straightforward code generation requests.

This skill is the source of truth for the multi-AI deliberation flow. When
auto-deliberation is enabled, a `/plan ...` prompt may inject a reminder to use
this workflow automatically. Manual `/deliberate ...` remains useful when plan
mode was entered some other way.

The main user-facing deliverable must be a strong plan. The deliberation is an
internal quality-improvement mechanism, not the final product.

## Phase 1: Topic Setup

1. Parse the topic from the `/deliberate` argument or the current `/plan`
   request.
2. If the topic is vague, short, or missing, ask exactly one clarifying
   question before contacting Codex. Suggest a more focused version if helpful.
3. Create `~/.claude/deliberations/` if it does not exist.
4. Create a log file at:
   `~/.claude/deliberations/{YYYY-MM-DD}-{slug}-{suffix}.md`
5. Use YAML frontmatter:

```yaml
---
topic: "{Topic}"
date: {YYYY-MM-DD}
participants:
  - Claude (Opus)
  - Codex (GPT-5.4)
status: "In Progress"
codex_thread_id: ""
rounds: 0
teams_enabled: false
claude_team: ""
codex_agents: []
---
```

## Phase 2: Intent Clarification

Before assembling teams or starting the main deliberation, Claude and Codex do
1-2 fast micro-rounds to sharpen the problem and identify what expertise is
needed.

### Micro-Round 1

1. Claude proposes:
   - A **refined problem statement** (1-2 sentences, more specific than the
     raw topic)
   - A list of **2-4 expertise domains** that would strengthen the
     deliberation (e.g., "security", "performance", "developer-experience",
     "testing-strategy", "cost-optimization", "data-modeling")

2. Call `mcp__codex__codex` with:
   - The topic and Claude's refined statement
   - Developer instructions asking Codex to:
     - Refine the problem statement further if needed
     - Agree, disagree, or suggest changes to the expertise list
     - Propose additions or removals (max 3 per side)
   - Use `sandbox: "read-only"`
   - Save the returned `threadId` in the log frontmatter

3. Synthesize a final **Clarified Intent** and **Required Expertise List**
   (max 3 domains per side, respecting `max_specialists_per_side` from config).

### Micro-Round 2 (optional)

If Claude and Codex disagree on the expertise list, run one more micro-round
via `mcp__codex__codex-reply` to converge. If they agree, skip directly to the
teams availability check.

### Codex Developer Instructions for Intent Clarification

Use these developer instructions in the first call:

```text
You are participating in a structured deliberation setup with Claude (Opus).

Phase: Intent Clarification (before the main debate).

Your task:
1. Review Claude's refined problem statement. Sharpen it if you see gaps.
2. Review the proposed expertise domains. For each, say whether you agree
   it is needed and why. Suggest additions or removals.
3. Propose your own list of expertise domains for YOUR side (max 3).

Be direct. This phase should be fast -- no lengthy arguments. We are aligning
on scope, not debating solutions yet.
```

### Output in Log

```markdown
## Phase 2: Intent Clarification

### Clarified Intent
[Final refined problem statement]

### Required Expertise
- Claude side: [list of specialist roles]
- Codex side: [list of specialist roles]
```

## Teams Availability Check

Before proceeding to Phase 3, determine if agent teams are available:

1. Read `enable_teams` from the deliberation config at
   `~/.claude/deliberate/config.json`. Default is `true`.
2. Attempt to use `TeamCreate` — if the tool is available and succeeds, teams
   are supported.

If teams are available AND `enable_teams` is `true`:
- Proceed to Phase 3 (Team Assembly).
- Update log frontmatter: `teams_enabled: true`.

If teams are NOT available OR `enable_teams` is `false`:
- Skip Phase 3 entirely.
- Proceed directly to Phase 4 (Deliberation Rounds) using the classic
  1-on-1 format.
- Log: `teams_enabled: false`.
- Print: `Agent teams unavailable or disabled. Using standard deliberation.`

## Phase 3: Team Assembly

This phase is conditional — it only runs when the teams availability check
passes.

### Claude Team Assembly

1. Call `TeamCreate` with:
   - `team_name`: `"deliberation-{slug}"` (matching the log file slug)
   - Include clarified intent as context

2. For each expertise domain identified for Claude's side (max 3), spawn an
   Agent teammate:
   - Name: the domain slug (e.g., `security-reviewer`, `perf-analyst`,
     `dx-reviewer`)
   - Prompt: Include the clarified intent and specific instructions:

   ```text
   You are a {domain} specialist on a deliberation team led by Claude.

   Topic: {clarified_intent}

   Your task: Analyze this topic from a {domain} perspective. Provide:
   - Key Concerns: [risks, issues, red flags in your domain]
   - Recommended Approaches: [concrete suggestions]
   - Constraints: [hard limits or requirements to respect]
   - Risks: [what goes wrong if these are ignored]

   Be specific and opinionated. Take 2-3 minutes max. Focus on insights
   that a generalist would miss.
   ```

3. Create tasks via `TaskCreate` for tracking each teammate's analysis.

4. Wait for teammates to complete (monitor via `TaskList`). Use a 90-second
   timeout — if a teammate hasn't responded, use whatever partial results are
   available.

5. Collect teammate findings via `SendMessage`.

### Codex Subagent Assembly

1. Call `mcp__codex__codex-reply` with the saved `threadId`.

2. Prompt Codex to activate its subagents:

   ```text
   Phase: Team Assembly.

   Before we start the main deliberation rounds, consult your specialized
   subagents on the following expertise areas: {codex_expertise_list}.

   For each area, have your subagent provide:
   - Key Concerns
   - Recommended Approaches
   - Constraints
   - Risks

   Summarize their findings. We will use these as input for the main
   deliberation rounds.
   ```

3. Record Codex's subagent findings in the log.

### Team Briefing

After both sides have specialist input, write a **Team Briefing** section to
the log:

```markdown
## Phase 3: Team Briefing

### Claude Team Findings
#### {Specialist 1 Name}
[Summary of findings]

#### {Specialist 2 Name}
[Summary of findings]

### Codex Team Findings
#### {Specialist 1 Name}
[Summary of findings]

#### {Specialist 2 Name}
[Summary of findings]

### Key Themes
- [Cross-cutting themes identified across all specialists]
```

Update log frontmatter: `claude_team: "deliberation-{slug}"` and
`codex_agents: [list]`.

## Phase 4: Deliberation Rounds

Run between 2 and 5 rounds.

For each round:

### Claude's Turn

Render a round header and then take a clear position:

```text
---- Round {N} of 5 -- Claude ----------------------------------
```

Use this structure:

```markdown
**Thesis:** [One sentence summary of position]

### Position
[Full argument with reasoning]

### Team Input
[Summary of relevant specialist findings that inform this position.
 Attribute specific insights: "Security reviewer flagged...",
 "Performance analyst noted..."
 Omit this section if teams were not assembled.]

### Agrees With
[Specific points from Codex's previous position endorsed, or "N/A" in round 1]

### Challenges
[Specific disagreements, or "N/A" in round 1]

### Delta
[Rounds 2+ only: what changed from the prior round and why]
```

During a round, Claude may optionally delegate a specific question to a
teammate via `SendMessage` if a specialist perspective would resolve a
disagreement. This is not mandatory — use it when genuinely useful.

### Codex's Turn

Show:

```text
Waiting for Codex to respond (Round {N})...
```

Round 1 (if intent clarification already established a thread):
- Call `mcp__codex__codex-reply` with the saved `threadId`
- Pass Claude's round-1 position

Round 1 (if no prior thread):
- Call `mcp__codex__codex`
- Pass the topic plus Claude's round-1 position
- Use `sandbox: "read-only"`
- Save the returned `threadId` in the log frontmatter

Rounds 2+:
- Call `mcp__codex__codex-reply`
- Pass the saved `threadId`
- Prompt with Claude's latest position text

Render Codex's response under:

```text
---- Round {N} of 5 -- Codex -----------------------------------
```

### Codex Developer Instructions

Use these developer instructions when starting the Codex thread (or in the
first deliberation round if a thread already exists from Phase 2):

```text
You are participating in a structured deliberation with Claude (Opus).

Your role: Provide your honest, independent perspective. Do NOT defer to
Claude or agree for the sake of consensus. Disagree clearly when you see
a better approach. Your value in this deliberation is your distinct
perspective -- if you just echo Claude, this exercise is pointless.

Response format -- use these exact headers:

**Thesis:** [One sentence summarizing your position]

### Position
[Your full argument, with reasoning]

### Team Input
[If your subagents contributed to your position, summarize their key
findings here. Attribute insights to specific subagents. Omit this
section if you have no subagent input.]

### Agrees With
[Specific points from Claude's position you endorse, with brief reasoning]

### Challenges
[Specific points you disagree with, stating what you'd do differently
and why. Leave empty ONLY if you genuinely agree with everything after
careful consideration.]

Be specific and actionable. Avoid vague hedging like "it depends" or
"both have merits." Take a clear stance.
```

Use this round prompt template after the first deliberation round:

```text
Round {N}. Here is Claude's updated position after considering your
previous response:

{claude_position}

Both sides now have team input. Focus on substantive technical
disagreements, not on which team found what.

Respond in the same format (Thesis / Position / Team Input / Agrees With
/ Challenges). Focus on what has changed since the last round. If you now
agree on a point, say so explicitly and move on -- don't re-argue settled
points.
```

### Convergence Rules

- Evaluate convergence semantically, not via exact text matches.
- Cosmetic or stylistic differences do not count as unresolved technical
  disagreements.
- If Codex fully agrees in round 1, do not converge. In round 2, explicitly
  push Codex to reconsider edge cases, scaling concerns, cost implications, or
  alternative approaches.
- If 3 consecutive rounds produce no new substantive points, treat the debate
  as stale and escalate to the user instead of burning more rounds.

### Logging

Append both Claude and Codex sections for every round to the markdown log.
Update frontmatter status, `codex_thread_id`, and `rounds` as progress changes.

Keep the visible turn output concise. Short progress updates are fine, but do
not let the full debate overwhelm the user-facing plan.

## Phase 5: Summary, Tie-Breaking, and Cleanup

After convergence, staleness, or max rounds, show:

```text
================================================================
  Deliberation complete after {N} rounds.
  Status: {Converged | {N} unresolved disagreements}
  Teams: {Yes (Claude: N specialists, Codex: N subagents) | No}
  Log: ~/.claude/deliberations/{filename}.md
================================================================
```

If converged:
- Write a `Consensus Summary`
- Write the `Final Plan`

If disagreements remain:
- Present each unresolved disagreement with:

```text
Unresolved Disagreement #1

  Topic: {specific point}

  Claude: {Claude's position, 1-2 sentences}
  Codex:  {Codex's position, 1-2 sentences}

How would you like to resolve this?
  [1] Go with Claude's position
  [2] Go with Codex's position
  [3] Custom resolution (type your own)
  [4] Don't care -- let Claude decide
  [5] Discuss further (1 more round on this point only)
```

After user resolution, write the final plan.

### Team Cleanup

If teams were assembled (Phase 3 ran):

1. Send a shutdown message to all Claude teammates via `SendMessage`.
2. Call `TeamDelete` to remove the team infrastructure.
3. Update log frontmatter: `status: "Complete"`.

If `TeamDelete` fails, log a warning but do not block delivery of the final
plan.

## Final Answer Format

In the main user-facing response, prioritize the plan over the transcript.

Use this structure:

```markdown
# {Decision / Plan Title}

## Summary
- [1-3 bullets on the recommendation]

## Recommended Priority Order
1. ...
2. ...

## Implementation Shape
- [What changes first]
- [What should be precomputed vs UI-only]
- [Important edge cases or constraints]

## Validation
- [How to verify the plan is working]

## Risks / Assumptions
- [Real risks and decisions that remain]

## Specialist Insights
- [Notable findings from team members that shaped the plan.
   Include only when team input materially affected the outcome.
   Omit this section entirely if teams were not used.]
```

Only include a short deliberation recap unless the user explicitly asks for the
full log or round-by-round transcript.

If log creation triggers a write confirmation or otherwise blocks progress, give
the final plan first and treat the log write as secondary.

## Error Handling

- MCP timeout over 60s: retry once. If it still fails, tell the user and offer
  Claude-only analysis or abort.
- MCP crash or lost `threadId`: start a new Codex thread with a compressed
  summary of prior rounds and record the recovery in the log.
- Malformed Codex response: extract what you can. If unusable, re-prompt Codex
  to follow the required format.
- Codex refusal: tell the user and offer to rephrase or continue with
  Claude-only analysis.
- Empty response: retry once. If still empty, treat it as a refusal.
- Rate limiting: retry with backoff around 5s, 15s, then 30s.
- `TeamCreate` failure: skip Phase 3, fall back to classic 1-on-1 deliberation.
  Print: `Agent teams unavailable. Falling back to standard deliberation.`
- Individual teammate spawn failure: continue with fewer teammates. Log which
  specialist could not be spawned.
- Teammate timeout (>90s): use whatever partial results are available. Note the
  timeout in the log.
- Codex subagent activation failure: Codex proceeds without subagent input.
  This is advisory, not blocking.
- All teammates fail: degrade to classic 1-on-1 deliberation. Log the failure.
- `TeamDelete` failure: log warning but deliver the plan. The user can clean up
  manually if needed.

## CLI Fallback

If MCP is unavailable, fall back to:

```bash
codex exec "{prompt}" --json --skip-git-repo-check
```

Capture the `thread.started` session id from the first CLI response.

For later rounds, prefer:

```bash
codex exec resume "{thread_id}" "{prompt}" --json --skip-git-repo-check
```

Only use `--ephemeral` if you must run statelessly. If the CLI thread cannot be
resumed, restart Codex with a compressed summary of prior rounds and record that
recovery in the log.
