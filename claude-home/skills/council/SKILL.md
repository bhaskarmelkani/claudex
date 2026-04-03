---
name: council
description: >
  Multi-agent council deliberation for complex technical decisions that benefit
  from parallel analysis across multiple dimensions. Uses Claude Code agent
  teams to run simultaneous sub-topic deliberations, then synthesizes results.
  Use when a decision is too multi-faceted for a single linear deliberation —
  e.g., "Should we migrate to microservices?" has dimensions of deployment,
  team skills, performance, and cost that can all be explored in parallel.
  Triggers on "/council", "run a council on", "multi-angle deliberation",
  "parallel debate", "full analysis of".
allowed-tools: mcp__codex__codex, mcp__codex__codex-reply, TeamCreate, TaskCreate, TaskUpdate, TaskList, TaskGet, SendMessage, Bash(mkdir -p:*), Write, Read
---

# /council — Multi-Agent Council Deliberation

A council runs multiple parallel sub-topic deliberations simultaneously using
agent teams, then synthesizes them into a unified recommendation. Use this
when a single `/deliberate` session would be too narrow for the decision.

**Requires**: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=true` (already enabled)

## CONTEXT PROTECTION

Council is inherently context-safe: each track agent runs in its own independent
context window. The main session only receives short summary messages via
SendMessage when tracks complete. The full round-by-round content of each
track stays isolated in the track agent's context — it never flows back into
yours. This is the primary advantage of council over a single `/deliberate`
session for complex, multi-dimensional decisions.

---

## WHEN TO USE COUNCIL vs DELIBERATE

Use `/council` when:
- The decision has 3+ orthogonal dimensions (e.g., cost, tech, team, risk)
- Sub-topics can be analyzed independently and in parallel
- You want comprehensive coverage, not just one angle
- Time is not a constraint (council takes 3-5x longer than a single deliberate)

Use `/deliberate` when:
- The decision is focused on a single clear tradeoff
- You want a quick second opinion
- The topic doesn't have clearly separable dimensions

---

## PHASE 1: Topic Decomposition

1. Extract the main topic from the user's message.

2. Vagueness check: if too broad, ask one clarifying question first.

3. **Decompose into sub-topics**: Analyze the decision and identify 2-4
   orthogonal dimensions that can be evaluated independently. Present them:

   ```
   Breaking "{topic}" into parallel deliberation tracks:

   Track 1: {sub-topic-1} — {one-line description}
   Track 2: {sub-topic-2} — {one-line description}
   Track 3: {sub-topic-3} — {one-line description}
   [Track 4: {sub-topic-4} — {one-line description}]

   Each track runs simultaneously with its own Claude+Codex deliberation.
   Total time: ~{N} minutes.

   Proceed with these tracks? [yes / adjust]
   ```

   If user wants to adjust, let them edit or remove tracks before continuing.

4. Create the output directory and council log file:
   ```
   ~/.claude/deliberations/{YYYY-MM-DD}-council-{slug}-{rand}.md
   ```

5. Write the council log frontmatter:
   ```yaml
   ---
   type: council
   topic: "{main topic}"
   date: {YYYY-MM-DD}
   tracks:
     - id: 1
       topic: "{sub-topic-1}"
       status: "Pending"
     - id: 2
       topic: "{sub-topic-2}"
       status: "Pending"
   status: "In Progress"
   ---
   ```

---

## PHASE 2: Launch Agent Team

1. Create the council team:
   ```
   TeamCreate: team_name = "council-{rand}"
   ```

2. Create one task per track using TaskCreate:
   ```
   Task #1: Deliberate on Track 1: {sub-topic-1}
   Task #2: Deliberate on Track 2: {sub-topic-2}
   Task #3: Deliberate on Track 3: {sub-topic-3}
   ...
   ```
   Also create a synthesis task blocked by all track tasks:
   ```
   Task #{N+1}: Synthesize council results (blocked by tasks 1..N)
   ```

3. Tell the user:
   ```
   Council starting. Launching {N} parallel deliberation tracks...
   Each track: Claude + Codex, up to 5 rounds.
   You may be asked to break ties on individual tracks.
   ```

4. Spawn one agent per track using the Agent tool with `team_name`:

   For each track, spawn a `general-purpose` agent with instructions to:
   - Run a full Claude+Codex deliberation on the sub-topic
   - Use `mcp__codex__codex` and `mcp__codex__codex-reply` for Codex turns
   - Follow the same round protocol as `/deliberate` (Phase 2)
   - Write results to a track log file:
     `~/.claude/deliberations/{council-slug}-track-{N}.md`
   - Send a message to the team lead when done:
     ```
     Track {N} complete. Topic: {sub-topic}. Status: {Converged/Deadlocked}.
     Summary: {2-3 sentence summary of outcome}
     Unresolved points: {list or "none"}
     Log: {track log path}
     ```
   - Mark their task as completed

   ### Agent prompt template for each track:

   ```
   You are running Track {N} of a multi-track council deliberation.

   MAIN TOPIC: {main_topic}
   YOUR TRACK: {sub_topic_N}

   Run a structured Claude+Codex deliberation on your track topic following
   this protocol:

   1. Write a track log file to:
      ~/.claude/deliberations/{council_slug}-track-{N}.md
      with frontmatter: topic, track number, status, codex_thread_id

   2. ROUND LOOP (min 2, max 5 rounds):

      a. Claude's turn: Formulate position using format:
         **Thesis:** [one sentence]
         ### Position / ### Agrees With / ### Challenges / ### Delta

      b. Codex's turn: Do NOT call mcp__codex__codex directly — wrap each
         call in a nested Agent to keep terminal output clean:

         Round 1: Agent("Track {N} Round {R} — Codex", prompt=
           "Call mcp__codex__codex with model gpt-5.4-mini, sandbox
           read-only, developer-instructions: 'You are in a structured
           deliberation on {sub_topic_N} as part of a broader analysis of
           {main_topic}. Provide your honest independent perspective. Do NOT
           agree for consensus. Use: Thesis / Position / Agrees With /
           Challenges headers.' and prompt: {claude_position}. Return JSON:
           {threadId, response}")

         Rounds 2+: Agent("Track {N} Round {R} — Codex", prompt=
           "Call mcp__codex__codex-reply with threadId={id} and prompt:
           {claude_position}. Return only the response text.")

      c. Save threadId to log frontmatter after round 1.

      d. Check convergence semantically (Claude evaluates, no string matching).

      e. Anti-sycophancy: force minimum 2 rounds even on full agreement.

   3. AFTER ROUNDS: Produce a track summary:
      - Agreed points
      - Unresolved disagreements (with both positions stated)
      - Track recommendation (1-2 sentences)

   4. If there are unresolved disagreements on your track, note them clearly
      in your message to the team lead — the council lead will aggregate them
      for user tie-breaking.

   5. Update log frontmatter status to "Converged" or "Has Disagreements".

   6. Send your results to the team lead via SendMessage and mark your task
      as completed.
   ```

---

## PHASE 3: Monitor and Collect Results

As track agents report in via SendMessage:

1. Update the council log with each track's summary as it arrives.
2. Print to terminal:
   ```
   Track {N} complete: {sub-topic} — {Converged | N disagreements}
   ```
3. Wait for all tracks to complete before proceeding.

---

## PHASE 4: Aggregated Tie-Breaking (if needed)

Collect all unresolved disagreements from all tracks. Present them to the user
in a single consolidated tie-breaking session (to avoid repeated interruptions):

```
================================================================
  Council Tie-Breaking Session
  {total} unresolved disagreement(s) across {N} tracks
================================================================

Track {X} — {sub-topic}:

  Disagreement: {point}
  Claude: {position}
  Codex:  {position}

  [1] Claude  [2] Codex  [3] Custom  [4] Don't care  [5] More debate

[Repeat for each disagreement]
```

Record all decisions in the council log.

---

## PHASE 5: Synthesis

Once all tracks are complete and disagreements resolved:

1. Send a shutdown request to all track agents.

2. Synthesize across all tracks into a unified council recommendation.
   Read each track log and produce:

```markdown
## Council Synthesis

### Cross-Track Themes
[Points that emerged consistently across multiple tracks]

### Track-by-Track Outcomes
- **Track 1 ({sub-topic})**: {1-2 sentence outcome}
- **Track 2 ({sub-topic})**: {1-2 sentence outcome}
- ...

### Unified Recommendation
[2-3 paragraphs synthesizing all tracks into a clear recommendation]

### Assumptions
[What all tracks took as given]

### Key Risks
[Top risks identified across tracks]

### Implementation Roadmap
1. {milestone}
2. ...

### Success Criteria
- ...

### Dissenting Notes
[Any minority positions worth preserving even if overridden]
```

3. Write the synthesis to the council log file.

4. Print end banner:
   ```
   ================================================================
     Council complete.
     Tracks: {N} | Total rounds: {total}
     Status: {Fully converged | Partially resolved}
     Log: ~/.claude/deliberations/{council-filename}.md
   ================================================================
   ```

5. Ask: `Was the council useful? [thumbs-up / thumbs-down / feedback]`

---

## ERROR HANDLING

**Track agent fails to report**: After 10 minutes without a message from a
track agent, send it a ping via SendMessage. If no response after 2 minutes,
run that track inline (as the lead) rather than blocking the council.

**Codex MCP unavailable on a track**: Track agent falls back to `codex exec`
CLI (stateless). Note in track log. Council can still synthesize from partial
results.

**Team creation fails**: Check that `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=true`
is set. If agent teams are unavailable, fall back to running tracks sequentially
(inline, not parallelized) using the `/deliberate` protocol directly.
