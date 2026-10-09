#!/usr/bin/env bash
# Points ~/.jay/plugins/<plugin> at this plugin's installed root, so instruction
# files can name a path that survives version bumps. Copied into every plugin
# from tools/plugin/hooks/; edit it there.
set -euo pipefail
name=$(sed -n 's/^ *"name": *"\([^"]*\)".*/\1/p' "$CLAUDE_PLUGIN_ROOT/.claude-plugin/plugin.json" | head -1)
mkdir -p "$HOME/.jay/plugins"
ln -sfn "$CLAUDE_PLUGIN_ROOT" "$HOME/.jay/plugins/$name"
