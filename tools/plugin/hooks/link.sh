#!/usr/bin/env bash
# Points ~/.jay/plugins/<plugin> at this plugin's installed root, so instruction
# files can name a path that survives version bumps. Every plugin's hooks/
# links to tools/plugin/hooks/, and the install copies the files in.
set -euo pipefail
name=$(sed -n 's/^ *"name": *"\([^"]*\)".*/\1/p' "$CLAUDE_PLUGIN_ROOT/.claude-plugin/plugin.json" | head -1)
mkdir -p "$HOME/.jay/plugins"
ln -sfn "$CLAUDE_PLUGIN_ROOT" "$HOME/.jay/plugins/$name"
