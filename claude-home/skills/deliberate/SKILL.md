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
allowed-tools: mcp__codex__codex, mcp__codex__codex-reply, Bash(codex:*), Write, Read
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
---
```

## Phase 2: Deliberation Rounds

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

### Agrees With
[Specific points from Codex's previous position endorsed, or "N/A" in round 1]

### Challenges
[Specific disagreements, or "N/A" in round 1]

### Delta
[Rounds 2+ only: what changed from the prior round and why]
```

### Codex's Turn

Show:

```text
Waiting for Codex to respond (Round {N})...
```

Round 1:
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

Use these developer instructions when starting the Codex thread:

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

### Agrees With
[Specific points from Claude's position you endorse, with brief reasoning]

### Challenges
[Specific points you disagree with, stating what you'd do differently
and why. Leave empty ONLY if you genuinely agree with everything after
careful consideration.]

Be specific and actionable. Avoid vague hedging like "it depends" or
"both have merits." Take a clear stance.
```

Use this round prompt template after round 1:

```text
Round {N}. Here is Claude's updated position after considering your
previous response:

{claude_position}

Respond in the same format (Thesis / Position / Agrees With / Challenges).
Focus on what has changed since the last round. If you now agree on a
point, say so explicitly and move on -- don't re-argue settled points.
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

## Phase 3: Summary and Tie-Breaking

After convergence, staleness, or max rounds, show:

```text
================================================================
  Deliberation complete after {N} rounds.
  Status: {Converged | {N} unresolved disagreements}
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
