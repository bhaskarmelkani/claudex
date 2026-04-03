#!/usr/bin/env bash
# Copies Codex agent TOML templates to ~/.codex/agents/ on session start.
# Only copies files that don't already exist to respect user customizations.
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CODEX_AGENTS_DIR="${HOME}/.codex/agents"
SOURCE_DIR="${PLUGIN_ROOT}/codex-agents"

# Skip if no codex-agents directory in plugin
[ -d "$SOURCE_DIR" ] || exit 0

mkdir -p "$CODEX_AGENTS_DIR"

for toml in "$SOURCE_DIR"/*.toml; do
  [ -f "$toml" ] || continue
  base="$(basename "$toml")"
  target="$CODEX_AGENTS_DIR/$base"

  # Only copy if target doesn't exist — don't overwrite user customizations
  if [ ! -e "$target" ]; then
    cp "$toml" "$target"
  fi
done
