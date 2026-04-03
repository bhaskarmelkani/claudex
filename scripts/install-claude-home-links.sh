#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/claude-home"
CLAUDE_DIR="${HOME}/.claude"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"

backup_path() {
  local target="$1"

  if [ -L "$target" ]; then
    rm "$target"
    return
  fi

  if [ -e "$target" ]; then
    mv "$target" "${target}.bak.${TIMESTAMP}"
  fi
}

mkdir -p \
  "$CLAUDE_DIR" \
  "$CLAUDE_DIR/hooks" \
  "$CLAUDE_DIR/skills/deliberate" \
  "$CLAUDE_DIR/deliberate"

backup_path "$CLAUDE_DIR/hooks/auto-deliberate-on-plan.js"
backup_path "$CLAUDE_DIR/skills/deliberate/SKILL.md"
backup_path "$CLAUDE_DIR/deliberate/config.json"

ln -s "$SOURCE_DIR/hooks/auto-deliberate-on-plan.js" "$CLAUDE_DIR/hooks/auto-deliberate-on-plan.js"
ln -s "$SOURCE_DIR/skills/deliberate/SKILL.md" "$CLAUDE_DIR/skills/deliberate/SKILL.md"
ln -s "$SOURCE_DIR/deliberate/config.json" "$CLAUDE_DIR/deliberate/config.json"

SOURCE_DIR="$SOURCE_DIR" CLAUDE_DIR="$CLAUDE_DIR" node <<'EOF'
const fs = require("fs");
const path = require("path");

const sourceDir = process.env.SOURCE_DIR;
const claudeDir = process.env.CLAUDE_DIR;
const settingsPath = path.join(claudeDir, "settings.json");
const fragmentPath = path.join(sourceDir, "settings.fragment.json");

const fragment = JSON.parse(fs.readFileSync(fragmentPath, "utf8"));
const current = fs.existsSync(settingsPath)
  ? JSON.parse(fs.readFileSync(settingsPath, "utf8"))
  : {};

const merged = {
  ...current,
  mcpServers: {
    ...(current.mcpServers || {}),
    ...(fragment.mcpServers || {})
  },
  hooks: {
    ...(current.hooks || {}),
    ...(fragment.hooks || {})
  }
};

fs.writeFileSync(settingsPath, `${JSON.stringify(merged, null, 2)}\n`);
EOF

echo "Claude home links installed."
echo "Repo source: $SOURCE_DIR"
echo "Claude home: $CLAUDE_DIR"
echo "Restart Claude Code to reload settings, hooks, and skills."
