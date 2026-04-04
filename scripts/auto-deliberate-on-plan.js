#!/usr/bin/env node
/**
 * Auto-deliberation hook for Claudex.
 *
 * Fires on two events:
 *   UserPromptSubmit  — when the user runs /plan <topic>
 *   PreToolUse        — when Claude is about to call EnterPlanMode (shift+tab)
 *
 * Injects deliberation context so Claude runs a fast Codex deliberation
 * before producing a plan.
 */

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data));
    process.stdin.resume();
  });
}

function safeJsonParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function getPrompt(input) {
  if (typeof input?.prompt === "string") return input.prompt;
  if (typeof input?.message === "string") return input.message;
  return "";
}

function extractTopic(prompt) {
  return prompt.replace(/^\/plan\b/, "").trim();
}

function looksVague(topic) {
  if (!topic) return true;
  const words = topic.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length <= 2) return true;
  const decisionWords = [
    "vs", "versus", "should", "use", "migrate", "migration",
    "choose", "between", "tradeoff", "tradeoffs", "architecture",
    "library", "framework", "api", "database", "infra", "infrastructure", "strategy"
  ];
  if (words.some((w) => decisionWords.includes(w))) return false;
  return words.length < 6;
}

/**
 * Fast instruction injected when Claude enters plan mode (shift+tab).
 * 2-round deliberation, very concise positions.
 */
function planModeContext() {
  return `
Before producing your plan, run a fast 2-round deliberation with Codex.

Protocol (keep it tight — this is plan mode, not a full deliberation):
1. Spawn a background Agent named "codex-partner" using the Codex partner
   prompt from the /deliberate skill. Use model gpt-5.4-mini, sandbox read-only.
2. State Claude's position inline — Thesis (1 sentence) + Position (≤80 words)
   + Challenges (≤2 bullets). No Agrees With or Delta in fast mode.
3. SendMessage to "codex-partner" with Claude's position. Codex responds
   with the same compact format.
4. Run exactly 2 rounds unless positions fully converge after Round 1.
5. After deliberation, produce the plan in this structure:
   Summary / Recommended Approach / Implementation Shape / Risks
   Lead with the plan — do not show the deliberation transcript unless asked.

The goal is a better plan, not a visible debate. Keep the whole process under 2 minutes.
`.trim();
}

/**
 * Full instruction injected when the user runs /plan <topic>.
 */
function planCommandContext(topic, vague) {
  const clarify = vague
    ? "The topic may be vague — ask one clarifying question if needed before starting."
    : "Topic is specific — begin deliberation immediately.";

  return `
Auto-deliberation triggered for /plan: "${topic || "(no topic specified)"}"
${clarify}

Use the /deliberate skill protocol:
  1. Spawn a background "codex-partner" agent (persistent across all rounds).
     Use model gpt-5.4-mini, sandbox read-only.
  2. Generate Claude's position inline — concise: Thesis + Position (≤120 words)
     + Agrees With (≤3 bullets) + Challenges (≤3 bullets) + Delta (≤2 sentences).
  3. SendMessage to the partner for each Codex round. The partner maintains
     the Codex thread internally — no threadId passing needed.
  4. Run 2-3 rounds. Check convergence semantically after each Codex response.
  5. Produce the final plan: Summary / Priority Order / Implementation / Validation / Risks.

The deliverable is the plan. Summarize the deliberation in 2-3 bullets at most.
Do not dump the full transcript unless the user explicitly asks.
`.trim();
}

async function main() {
  const raw = await readStdin();
  const input = safeJsonParse(raw || "{}", {});

  // Detect event type — PreToolUse sends tool_name in input
  const isPlanModeEntry =
    input?.tool_name === "EnterPlanMode" ||
    input?.hook_event_name === "PreToolUse";

  if (isPlanModeEntry) {
    // PreToolUse: additionalContext goes at the top level (no hookSpecificOutput wrapper)
    const output = { additionalContext: planModeContext() };
    process.stdout.write(JSON.stringify(output) + "\n");
    return;
  }

  // UserPromptSubmit — only fire on /plan
  const prompt = getPrompt(input);
  if (!/^\/plan(?:\s|$)/.test(prompt)) {
    process.stdout.write("{}\n");
    return;
  }

  const topic = extractTopic(prompt);
  const output = {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: planCommandContext(topic, looksVague(topic))
    }
  };
  process.stdout.write(JSON.stringify(output) + "\n");
}

main().catch(() => process.stdout.write("{}\n"));
