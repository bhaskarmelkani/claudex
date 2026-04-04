---
name: deliberate
description: >
  Multi-AI deliberation between Claude and Codex for technical decisions. Use
  when the user wants to deliberate, debate, brainstorm tradeoffs, or get a
  second AI perspective on architecture, migrations, library choices, API
  design, or similar high-stakes technical decisions. Triggers on "/deliberate",
  "let's deliberate", "debate this", "get codex's opinion on", "second opinion
  on", "deliberate on". Also handles "/deliberate resume {path}" to continue
  an interrupted deliberation from its log file.
allowed-tools: Agent, AskUserQuestion, SendMessage, mcp__codex__codex, mcp__codex__codex-reply, Bash(mkdir -p*), Bash(ls*), Bash(git*), Bash(python3*), Write, Read
---

# /deliberate — Multi-AI Deliberation Protocol

## EXECUTION MODEL — READ FIRST

**Run the deliberation inline in the main session.**

The architecture uses one persistent background agent — the "Codex partner" —
that lives for the entire deliberation. Claude runs inline, the partner handles
all Codex MCP calls in the background.

```
Main session (Claude, inline)           Codex partner (background agent)
─────────────────────────────────       ──────────────────────────────────────
Phase 1 setup
Spawn Agent("Codex partner",        ──► starts up, waits for first round
  run_in_background: true,
  name: "codex-partner")

ROUND 1
Print Claude's position (live)
Append to log
SendMessage("codex-partner",        ──► calls mcp__codex__codex (Round 1)
  "ROUND 1:\n{position}")               stores threadId internally
                          ◄── Codex response ──
Print Codex's response (live)
Append to log
Convergence check

ROUND 2
Print Claude's position (live)
Append to log
SendMessage("codex-partner",        ──► calls mcp__codex__codex-reply
  "ROUND 2:\n{position}")               (reuses stored threadId)
                          ◄── Codex response ──
...

SendMessage("codex-partner",        ──► exits cleanly
  "DELIBERATION COMPLETE")
```

This gives:
- **Live streaming** of Claude's position as it's written
- **Native agent tree UI** for the Codex partner (background indicator)
- **Overheard conversation feel** — both sides printed to terminal in sequence
- **One persistent agent** in the UI (not a new agent per round)
- **threadId lives inside the partner** — never needs to be extracted/passed

---

# CODEX PARTNER AGENT — PROMPT TEMPLATE

When spawning the Codex partner, use this as the `prompt`. Fill in
`{developer_instructions}` from the template in the CODEX PROMPT TEMPLATES
section. Leave the `--- AWAITING ROUND 1 ---` marker at the end so the agent
waits for the first SendMessage.

```
You are the Codex deliberation partner for a structured multi-round technical
debate. You manage the Codex MCP thread for the entire deliberation session.

YOUR PROTOCOL:

When you receive a message starting with "ROUND 1:", extract the content and:
1. Call mcp__codex__codex with:
   - prompt: the full content after "ROUND 1:"
   - developer-instructions: (see below)
   - model: "gpt-5.4-mini"
   - sandbox: "read-only"
2. Store the returned threadId in your context — you will need it every round.
3. Return ONLY Codex's raw response text. No JSON, no wrappers, no commentary.

When you receive a message starting with "ROUND N:" (N = 2, 3, 4, 5):
1. Call mcp__codex__codex-reply with:
   - threadId: (the one you stored in Round 1)
   - prompt: the full content after "ROUND N:"
2. Return ONLY Codex's raw response text.

When you receive "DELIBERATION COMPLETE":
Output: "Codex partner signing off." and exit.

IMPORTANT RULES:
- Do NOT add any preamble, explanation, or commentary to your responses.
- Return Codex's response verbatim. Claude will handle all formatting.
- If mcp__codex__codex fails, return: "ERROR: {error message}"
- If mcp__codex__codex-reply fails (thread expired), return:
  "THREAD_EXPIRED: {error message}"

DEVELOPER INSTRUCTIONS TO PASS TO CODEX (include verbatim in
developer-instructions parameter for every call):

{developer_instructions}

--- AWAITING ROUND 1 ---
```

---

# DELIBERATION PROTOCOL

You are running a structured deliberation between yourself (Claude, Opus 4.6)
and Codex (GPT-5.4-mini) on a technical topic. Follow this protocol exactly.

---

## RESUME MODE

If the user's message contains `resume` followed by a file path, enter resume
mode:

1. Read the specified log file.
2. Extract from YAML frontmatter: `topic`, `codex_thread_id`, `rounds`, `status`.
3. Read existing rounds to understand where the deliberation left off.
4. Print:
   ```
   ================================================================
     RESUMING DELIBERATION
     Topic  : {topic}
     Rounds completed: {N}
     Codex thread: {threadId | "expired — will restart with prior context"}
   ================================================================
   ```
5. Spawn the Codex partner agent (same as Phase 1 step 5) with a modified
   Round 1 message that includes a compressed summary of prior rounds as
   context, plus the existing threadId if available:
   - If threadId is present: include it in the Round 1 message with instruction
     "Resume from this threadId if possible: {threadId}"
   - If threadId is empty/expired: include full prior-round summaries as context
6. Continue from Phase 2, Round {N+1}.

---

## PHASE 1: Topic Setup

1. Extract the topic from the user's message (everything after `/deliberate`).

2. **Vagueness check**: If the topic is very short (under ~8 words) or very
   broad (e.g., "architecture", "database choice"), use `AskUserQuestion`:
   ```
   AskUserQuestion(questions: [{
     question: "Your topic seems broad — a focused topic produces better results. How would you like to proceed?",
     header: "Topic scope",
     multiSelect: false,
     options: [
       { label: "Proceed as-is",  description: "Run the deliberation on the topic as given." },
       { label: "Refine topic",   description: "You'll provide a more specific framing before we start." }
     ]
   }])
   ```
   If "Refine topic", ask the user for the new wording and use that.

3. **Project context injection**: Check for `CLAUDE.md`, `README.md`,
   `package.json`, or `.git` in the current directory. If found:
   ```
   AskUserQuestion(questions: [{
     question: "Project files detected. Inject project context into the deliberation?",
     header: "Context",
     multiSelect: false,
     options: [
       { label: "Yes — inject context (Recommended)", description: "Summarizes CLAUDE.md, README, and package.json so both AIs reason about your actual codebase." },
       { label: "No — skip",                          description: "Run without project-specific context." }
     ]
   }])
   ```
   If yes, read and summarize (max ~500 words):
   - `CLAUDE.md` if present
   - `README.md` first 60 lines
   - `package.json` dependencies section (or equivalent manifest)
   Store as `{project_context_block}` — prepend to Claude's Round 1 position
   and include in the Codex partner Round 1 message under `### Project Context`.

4. Generate a filename slug (lowercase, hyphens, max 40 chars, 4-char random
   suffix via `python3 -c "import random,string; print(''.join(random.choices(string.ascii_lowercase+string.digits,k=4)))"`)
   Create the log file path: `/Users/{user}/.claude/deliberations/{YYYY-MM-DD}-{slug}-{rand}.md`
   Run `mkdir -p ~/.claude/deliberations` first.

5. **Spawn the Codex partner agent** (background, named):
   ```
   Agent(
     description: "Codex deliberation partner",
     name: "codex-partner",
     run_in_background: true,
     prompt: <CODEX PARTNER AGENT PROMPT TEMPLATE filled with developer_instructions>
   )
   ```
   The partner starts up and waits. Do NOT send Round 1 yet — do that in Phase 2.

6. Write the initial log file with frontmatter AND document title in one Write:
   ```
   ---
   topic: "{topic}"
   date: {YYYY-MM-DD}
   participants:
     - Claude (Opus 4.6)
     - Codex (GPT-5.4-mini)
   status: "In Progress"
   codex_thread_id: ""
   rounds: 0
   project_context: {true/false}
   ---

   # Deliberation: {topic}

   {project_context_block_if_any}
   ```

   Write this as a single atomic Write call. Never append the title or project
   context separately — doing so places them at the wrong position in the file.

   **Frontmatter updates** (during and after deliberation): Always rewrite the
   entire frontmatter block as a single Edit that replaces the full `---...---`
   section. Never append new YAML fields — they create duplicate keys.

7. Print the start banner:
   ```
   ================================================================
     DELIBERATION STARTING
   ================================================================
     Topic     : {topic}
     Claude    : Opus 4.6  (inline)
     Codex     : GPT-5.4-mini  (background partner)
     Max rounds: 3  (min 2, use --deep for 5)
     Log       : ~/.claude/deliberations/{filename}

   Both sides will be printed here as they respond.
   ================================================================
   ```

---

## PHASE 2: Deliberation Rounds

Run minimum **2 rounds**, maximum **3 rounds** by default.
If the topic is complex or the user explicitly asks for a deeper deliberation,
extend to 5 rounds. Announce this at the start banner if extending:
`Max rounds: 5 (deep mode)`.

Most topics converge in 2–3 rounds. Stopping at 3 by default saves ~2–4
minutes compared to running to 5.

### Round structure

At the start of each round print:
```
================================================================
  ROUND {N} / 5
================================================================
```

**Claude's turn** then **Codex's turn**, each printed in a visible block.

---

### Claude's Turn

**CRITICAL: Claude's position MUST be generated inline by you, in the main
session. Do NOT spawn an Agent for Claude's turn. Do NOT delegate Claude's
reasoning to a subagent. Spawning an agent for your own position is a
protocol violation that breaks the deliberation.**

Print the speaker header:
```
  ┌─ Claude ──────────────────────────────────────────────────
```

Then write your position **inline** (the user sees it stream live).

**Keep positions tight** — verbosity adds latency without adding clarity.
Hard limits per section:

```
  │ **Thesis:** {1 sentence}
  │
  │ ### Position  (≤120 words)
  │ {concrete argument — name tech, cite tradeoffs, give numbers}
  │
  │ ### Agrees With  (≤3 bullets, 1 line each)
  │ {Round 1: "N/A"}
  │ {Round 2+: specific points from Codex you now accept}
  │
  │ ### Challenges  (≤3 bullets, 2 lines each max)
  │ {Round 1: "N/A"}
  │ {Round 2+: what you still dispute and the crux of why}
  │
  │ ### Delta  (≤2 sentences — omit Round 1)
  │ {what shifted and what moved you}
```

Close with:
```
  └───────────────────────────────────────────────────────────
```

**Immediately after printing**, send the Codex partner the SendMessage for
this round (start Codex's timer now), then write to the log file in parallel.
Do NOT wait for the log write to finish before sending to Codex.

---

### Codex's Turn

Print:
```
  ┌─ Codex  ──────────────────────────────────────────────────
  │  (thinking...)
```

**Round 1** — send the first message to the partner. Send this BEFORE writing
to the log file so Codex starts thinking while you do I/O:
```
SendMessage(
  to: "codex-partner",
  message: "ROUND 1:\n{project_context_block_if_any}\n\nTOPIC: {topic}\n\nCLAUDE'S POSITION:\n{claude_round1_full_text}"
)
```

**Rounds 2+** — same: SendMessage first, log write second:
```
SendMessage(
  to: "codex-partner",
  message: "ROUND {N}:\n{claude_roundN_full_text}"
)
```

When the partner responds, replace the `(thinking...)` line and print Codex's
response inside the box:
```
  │ **Thesis:** {codex thesis}
  │
  │ ### Position
  │ ...
  │
  │ ### Agrees With
  │ ...
  │
  │ ### Challenges
  │ ...
```

Close with:
```
  └───────────────────────────────────────────────────────────
```

Append Codex's response (without box characters) to the log file under
`## Round {N} — Codex`.

**Thread recovery**: If the partner returns `THREAD_EXPIRED:...`, send a new
Round 1 message containing a compressed summary of all prior rounds + the
current round's prompt. Note in the log: `[Recovery: Codex thread restarted at Round {N}]`.

---

### After Each Round

Print the status line:
```
  Round {N} complete.
  Agreement: {list agreed points briefly} 
  Still disputed: {list open challenges briefly | "none — converged"}
----------------------------------------------------------------
```

Update the log frontmatter: increment `rounds`, update `codex_thread_id`
(from Round 1 partner response if not yet set — ask partner to echo it back
in Round 1 by appending to the Round 1 SendMessage: "Also prepend your
response with: THREAD:{threadId}\\n\\n").

---

### Convergence Check

After Round 2+, **semantically evaluate** whether positions have converged.
Converged = Codex's Challenges section has no substantive technical
disagreements. Cosmetic differences don't count.

**Anti-sycophancy rule**: If Round 1 Codex has no Challenges, force Round 2.
Append to the Round 2 SendMessage:
> "You agreed with everything in Round 1. Reconsider carefully — are there
> edge cases, failure modes, scaling concerns, cost implications, or
> alternative approaches worth challenging? Immediate agreement suggests
> the topic hasn't been examined deeply enough."

### Stale Debate Detection

If 3 consecutive rounds repeat the same challenges with no new points:
```
================================================================
  STALLED — same challenges repeated for 3 rounds.
  Escalating to you for resolution.
================================================================
```
Proceed to Phase 3 tie-breaking.

---

## CODEX PROMPT TEMPLATES

### developer-instructions (injected into Codex partner prompt)

```
You are participating in a structured deliberation with Claude (Opus 4.6) on
a technical decision. Provide your honest, independent perspective.

IMPORTANT: Do NOT defer to Claude or agree for the sake of consensus.
Disagree clearly when you see a better approach. If you simply echo Claude,
this exercise is pointless and the user gets no value from two AIs.

Be concise — long responses add latency. Use these exact headers with limits:

**Thesis:** [1 sentence]

### Position  (≤120 words)
[Concrete argument — name technologies, cite tradeoffs, give numbers.]

### Agrees With  (≤3 bullets, 1 line each)
[Points from Claude's position you genuinely endorse.]

### Challenges  (≤3 bullets, 2 lines each)
[Points you disagree with — what you'd do differently and why. Leave empty
ONLY if you genuinely agree with everything after careful consideration.]

Take a clear stance. No hedging. Stay within the word limits.
```

### Round 2+ content (appended to SendMessage prompt)

```
Round {N}. Claude's updated position after considering your previous response:

{claude_full_position_text}

Respond using the same format (Thesis / Position / Agrees With / Challenges).
Focus on what has changed. If you now agree on a point, say so and move on —
don't re-argue settled points. If you still disagree, be specific about why
Claude's updated reasoning doesn't convince you.
```

---

## PHASE 3: Wrap-Up

### 1. Signal the partner to exit
```
SendMessage(to: "codex-partner", message: "DELIBERATION COMPLETE")
```

### 2. End banner
```
================================================================
  DELIBERATION COMPLETE
  Rounds  : {N}
  Status  : {Converged ✓ | {K} disagreement(s) to resolve}
  Log     : ~/.claude/deliberations/{filename}
================================================================
```

### 3. If fully converged

Produce the Consensus Summary and Final Plan (see LOG FILE FORMAT).
Write to log file, display to user, then:

```
AskUserQuestion(questions: [{
  question: "Was this deliberation useful?",
  header: "Feedback",
  multiSelect: false,
  options: [
    { label: "Yes, very useful",  description: "Surfaced useful tradeoffs and a clear recommendation." },
    { label: "Somewhat useful",   description: "Helpful but could go deeper." },
    { label: "Not useful",        description: "Didn't help with this decision." }
  ]
}])
```

### 4. If unresolved disagreements exist

For each disagreement, one at a time:
```
AskUserQuestion(questions: [{
  question: "Disagreement {#N}/{total}: {one-line description}\n\nClaude: {summary}\nCodex:  {summary}\n\nHow to resolve?",
  header: "Resolve #{N}",
  multiSelect: false,
  options: [
    { label: "Go with Claude",    description: "{Claude's position in ~10 words}" },
    { label: "Go with Codex",     description: "{Codex's position in ~10 words}" },
    { label: "Let Claude decide", description: "Claude picks based on full deliberation context." },
    { label: "Discuss further",   description: "One more focused round on this point only." }
  ]
}])
```

If "Discuss further": send one targeted SendMessage to the partner (not
"DELIBERATION COMPLETE" yet), run one final round on that point only, then
return here.

Record all resolutions in the log. Produce the Final Plan.

---

## LOG FILE FORMAT

```markdown
---
topic: "..."
date: YYYY-MM-DD
participants:
  - Claude (Opus 4.6)
  - Codex (GPT-5.4-mini)
status: "In Progress"   # → "Converged" | "User-Resolved"
codex_thread_id: ""     # filled after Round 1
rounds: 0               # incremented each round
project_context: false
---

# Deliberation: {Topic}

## Round 1 — Claude
**Thesis:** ...
### Position
...
### Agrees With
N/A
### Challenges
N/A

---

## Round 1 — Codex
**Thesis:** ...
### Position
...
### Agrees With
...
### Challenges
...

---

## Round 2 — Claude
...
### Delta
...

---

## Round 2 — Codex
...

---

## Consensus Summary

### Agreed Points
- ...

### Unresolved Disagreements
- {Point}: Claude says X, Codex says Y → **User decided: Z**

---

## Final Plan

### Assumptions
- ...

### Milestones
1. ...

### Success Criteria
- ...

### Risks
- ...

### Next Steps
- ...
```

---

## ERROR HANDLING

**Partner agent not responding (>90s)**
```
AskUserQuestion(questions: [{
  question: "Codex partner is taking too long. How would you like to proceed?",
  header: "Timeout",
  multiSelect: false,
  options: [
    { label: "Wait and retry",          description: "Send the message again and wait." },
    { label: "Continue Claude-only",    description: "Finish the deliberation with Claude's analysis only." },
    { label: "Abort",                   description: "Stop the deliberation and save what we have." }
  ]
}])
```

**THREAD_EXPIRED returned by partner**
Send a new Round 1 message with a compressed prior-round summary as context.
Note in log: `[Recovery: Codex thread restarted at Round {N}]`

**Malformed Codex response**
Print what arrived inside the Codex box anyway (user can still read it).
Re-prompt the partner once: `"RETRY ROUND {N}: Your last response was malformed.
Please respond again using exactly: Thesis / Position / Agrees With / Challenges.
Original prompt was: {prompt}"`

**Partner spawn fails / Codex MCP unavailable**
The Codex MCP server is wired via `.mcp.json` in the claude-codex project.
When running `/deliberate` from a different project, Codex MCP may not be
available (the partner will complete immediately without being able to call
`mcp__codex__codex`).

In this case, fall back to per-round nested agents that impersonate Codex
using Claude's reasoning — spawn `Agent("Round {N} — Codex perspective")`
each round with instructions to argue the opposing view independently.
Note to user:
```
  Note: Codex MCP is not available in this project. Using Claude-as-Codex
  fallback — positions will be independent but not from actual GPT-5.4-mini.
  To use real Codex, run /deliberate from the claude-codex project directory.
```
Set `codex_thread_id: "claude-fallback"` in the log frontmatter.

**Rate limiting**
Retry SendMessage with backoff: 5s, 15s, 30s. Notify user if 30s retry fails.
