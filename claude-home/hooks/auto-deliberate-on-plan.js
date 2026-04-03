const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(process.env.HOME || "", ".claude", "deliberate", "config.json");

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.resume();
  });
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return safeJsonParse(raw, { auto_on_plan: true });
  } catch {
    return { auto_on_plan: true };
  }
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

  const words = topic
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length <= 2) return true;

  const decisionSignals = [
    "vs",
    "versus",
    "should",
    "use",
    "migrate",
    "migration",
    "choose",
    "between",
    "tradeoff",
    "tradeoffs",
    "architecture",
    "library",
    "framework",
    "api",
    "database",
    "infra",
    "infrastructure",
    "strategy"
  ];

  const hasDecisionSignal = words.some((word) => decisionSignals.includes(word));
  if (hasDecisionSignal) return false;

  return words.length < 6;
}

function buildInstruction(topic, vague) {
  const topicLine = topic
    ? `The /plan topic is: "${topic}".`
    : "The user entered /plan without a topic.";

  const clarifyLine = vague
    ? "Before using Codex, ask exactly one clarifying question to narrow the decision. Suggest a more focused version if helpful."
    : "The topic is specific enough to start without a clarifying question.";

  return [
    "Auto-deliberation is enabled for /plan.",
    topicLine,
    "Handle this plan-mode request using the installed `deliberate` workflow.",
    clarifyLine,
    "Scope: technical decision-making only, not code generation.",
    "The primary deliverable is a high-quality plan, not a debate transcript.",
    "Use Codex to improve the decision quality, but keep the visible response plan-first and concise.",
    "Run a multi-AI deliberation between Claude (facilitator) and Codex (independent reviewer).",
    "Use 2-5 rounds, with a minimum of 2 rounds before convergence.",
    "For Round 1, first state Claude's position in this structure: Thesis, Position, Agrees With, Challenges. Then call `mcp__codex__codex` with the topic plus Claude's position and strong anti-sycophancy developer instructions.",
    "For Rounds 2+, call `mcp__codex__codex-reply` with the saved thread id and Claude's updated position.",
    "Use semantic convergence, not string matching. If Codex fully agrees in Round 1, force Round 2 and explicitly ask for edge cases, scaling risks, cost implications, or alternatives.",
    "If 3 consecutive rounds add no new points, stop the debate and escalate unresolved disagreements to the user instead of consuming more rounds.",
    "Persist a deliberation log under `~/.claude/deliberations/` using a dated slug plus short random suffix. Save the Codex thread id in the log frontmatter for recovery.",
    "If MCP fails, retry once when appropriate. If the thread is lost, restart Codex with a compressed summary of prior rounds. If MCP is unavailable, prefer CLI fallback that preserves continuity: `codex exec --json --skip-git-repo-check` for round 1, then `codex exec resume <thread_id> --json --skip-git-repo-check` for later rounds. Use `--ephemeral` only when stateless fallback is truly necessary.",
    "For the final user-facing answer, use a clean Claude-style planning structure with these sections: Summary, Recommended Priority Order, Implementation Shape, Validation, Risks/Assumptions.",
    "Summarize the deliberation briefly. Do not dump the full transcript into the main response unless the user asks for it.",
    "Do not let log writing block the main response. If write approval interrupts logging, still deliver the final plan first and treat log persistence as secondary.",
    "End with either a converged final plan or numbered tie-break options for unresolved disagreements."
  ].join("\n");
}

async function main() {
  const rawInput = await readStdin();
  const input = safeJsonParse(rawInput || "{}", {});
  const prompt = getPrompt(input);
  const config = loadConfig();

  if (!config.auto_on_plan || !/^\/plan(?:\s|$)/.test(prompt)) {
    process.stdout.write("{}\n");
    return;
  }

  const topic = extractTopic(prompt);
  const output = {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: buildInstruction(topic, looksVague(topic))
    }
  };

  process.stdout.write(`${JSON.stringify(output)}\n`);
}

main().catch(() => {
  process.stdout.write("{}\n");
});
