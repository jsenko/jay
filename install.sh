#!/usr/bin/env bash
#
# Installs jay plugins into the AI clients found on this machine, then asks for
# each plugin's settings. Re-running updates the plugins and keeps the answers.
#
#   ./install.sh fyi status          install plugins (and what they depend on)
#   ./install.sh all                 install every plugin
#   ./install.sh --dev fyi           use this checkout as the marketplace, for working on jay
#   ./install.sh --uninstall fyi     remove plugins; settings and data are kept
#
# Options:
#   --claude, --opencode   configure only that client (default: every one installed)
#   --yes                  accept defaults instead of asking
#
# Needs node, and claude or opencode. Honours CLAUDE_CONFIG_DIR.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETPLACE=jay
GITHUB_SOURCE=jsenko/jay
CLAUDE_SETTINGS="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"

DEV=false
UNINSTALL=false
YES=false
CLIENTS=()
PLUGINS=()

usage() { sed -n '3,15p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }
say() { echo "• $*"; }
die() { echo "✗ $*" >&2; exit 1; }

# Prints the result of a JavaScript expression over JSON read from stdin, bound to `j`.
json() { node -e "const j = JSON.parse(require('fs').readFileSync(0, 'utf8')); const r = ($1); if (r !== undefined) console.log(Array.isArray(r) ? r.join('\n') : r)"; }

# Asks a yes/no question; --yes answers yes.
confirm() {
    [[ "$YES" == true ]] && return 0
    local answer
    read -r -p "$1 [Y/n] " answer
    [[ -z "$answer" || "$answer" =~ ^[Yy] ]]
}

parse_args() {
    while (( $# )); do
        case "$1" in
            --dev)       DEV=true ;;
            --uninstall) UNINSTALL=true ;;
            --yes|-y)    YES=true ;;
            --claude)    CLIENTS+=(claude) ;;
            --opencode)  CLIENTS+=(opencode) ;;
            -h|--help)   usage ;;
            -*)          echo "Unknown option: $1" >&2; usage 1 ;;
            *)           PLUGINS+=("$1") ;;
        esac
        shift
    done
    (( ${#PLUGINS[@]} )) || usage 1

    local available
    available="$(json 'j.plugins.map((p) => p.name)' < "$REPO/.claude-plugin/marketplace.json")"
    if [[ "${PLUGINS[*]}" == all ]]; then
        mapfile -t PLUGINS <<< "$available"
        [[ -n "${PLUGINS[0]:-}" ]] || die "the marketplace has no plugins yet"
    fi
    local p
    for p in "${PLUGINS[@]}"; do
        grep -qx "$p" <<< "$available" || die "no plugin named $p (available: $(paste -sd' ' <<< "$available"))"
    done

    if (( ! ${#CLIENTS[@]} )); then
        command -v claude >/dev/null && CLIENTS+=(claude)
        command -v opencode >/dev/null && CLIENTS+=(opencode)
    fi
    (( ${#CLIENTS[@]} )) || die "neither claude nor opencode is installed"
}

# ------------------------------------------------------------- Claude Code

# Adds the marketplace, or points it at the right source, and refreshes it.
claude_marketplace() {
    local source="$GITHUB_SOURCE"
    [[ "$DEV" == true ]] && source="$REPO"
    local current
    current="$(claude plugin marketplace list --json | json "(j.find((m) => m.name === '$MARKETPLACE') ?? {}).path ?? (j.find((m) => m.name === '$MARKETPLACE') ?? {}).repo ?? ''")"
    if [[ "$current" != "$source" ]]; then
        say "adding the $MARKETPLACE marketplace from $source"
        claude plugin marketplace add "$source" >/dev/null
    else
        claude plugin marketplace update "$MARKETPLACE" >/dev/null
    fi
}

# Plugins from this marketplace installed at user scope, one per line.
claude_installed() {
    claude plugin list --json | json "j.filter((p) => p.id?.endsWith('@$MARKETPLACE') && (p.scope ?? 'user') === 'user').map((p) => p.id.split('@')[0])"
}

claude_install() {
    claude_marketplace
    local installed p
    installed="$(claude_installed)"
    for p in "${PLUGINS[@]}"; do
        if grep -qx "$p" <<< "$installed"; then
            say "updating $p in Claude Code"
            claude plugin update "$p@$MARKETPLACE" --scope user >/dev/null
        else
            say "installing $p in Claude Code"
            claude plugin install "$p@$MARKETPLACE" --scope user >/dev/null
        fi
    done
    claude_permissions
    say "restart Claude Code to load the changes"
}

claude_uninstall() {
    local p
    for p in "${PLUGINS[@]}"; do
        say "removing $p from Claude Code"
        claude plugin uninstall "$p@$MARKETPLACE" --scope user --keep-data >/dev/null || true
    done
}

# Plugins cannot grant themselves permissions, so the installer does: ~/.jay as a
# readable directory, and, if wanted, the plugins' MCP tools without prompts.
claude_permissions() {
    local p server rules=()
    for p in $(claude_installed); do
        [[ -f "$REPO/plugins/$p/.mcp.json" ]] || continue
        for server in $(json 'Object.keys(j.mcpServers ?? {})' < "$REPO/plugins/$p/.mcp.json"); do
            rules+=("mcp__plugin_${p}_${server}")
        done
    done

    local allow=false
    if (( ${#rules[@]} )) && confirm "Allow the plugins' tools without asking (${rules[*]})?"; then
        allow=true
    fi

    mkdir -p "$(dirname "$CLAUDE_SETTINGS")"
    [[ -f "$CLAUDE_SETTINGS" ]] || echo '{}' > "$CLAUDE_SETTINGS"
    cp "$CLAUDE_SETTINGS" "$CLAUDE_SETTINGS.before-jay"
    node - "$CLAUDE_SETTINGS" "$allow" "${rules[@]}" <<'EOF'
const fs = require("fs");
const [file, allow, ...rules] = process.argv.slice(2);
const settings = JSON.parse(fs.readFileSync(file, "utf8"));
const add = (list, item) => (list.includes(item) ? list : [...list, item]);

settings.permissions ??= {};
settings.permissions.additionalDirectories = add(settings.permissions.additionalDirectories ?? [], "~/.jay");
if (allow === "true") {
  settings.permissions.allow = rules.reduce(add, settings.permissions.allow ?? []);
}
fs.writeFileSync(file, JSON.stringify(settings, null, 2) + "\n");
EOF
    say "updated $CLAUDE_SETTINGS (previous copy: settings.json.before-jay)"
}

# ---------------------------------------------------------------- opencode

opencode_install() {
    say "opencode is not supported yet; skipping it"
}

opencode_uninstall() {
    opencode_install
}

# ---------------------------------------------------------------- settings

# Runs each plugin's setup.sh, which asks for its settings and writes its section
# of ~/.jay/config.json.
configure() {
    local p
    for p in "${PLUGINS[@]}"; do
        [[ -x "$REPO/plugins/$p/setup.sh" ]] || continue
        say "configuring $p"
        if [[ "$YES" == true ]]; then
            "$REPO/plugins/$p/setup.sh" --yes
        else
            "$REPO/plugins/$p/setup.sh"
        fi
    done
}

# ------------------------------------------------------------------- main

parse_args "$@"
for client in "${CLIENTS[@]}"; do
    if [[ "$UNINSTALL" == true ]]; then
        "${client}_uninstall"
    else
        "${client}_install"
    fi
done
[[ "$UNINSTALL" == true ]] || configure
