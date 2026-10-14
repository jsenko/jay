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
# Needs node, and claude or opencode. Honours CLAUDE_CONFIG_DIR and
# OPENCODE_CONFIG_DIR.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETPLACE=jay
GITHUB_SOURCE=jsenko/jay
CLAUDE_SETTINGS="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
OPENCODE_DIR="${OPENCODE_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode}"

DEV=false
UNINSTALL=false
YES=false
CLIENTS=()
PLUGINS=()

usage() { sed -n '3,16p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }
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

    # Without a terminal, read gets an empty answer, which would take every
    # default, allowing the tools included, without the question being shown.
    [[ "$YES" == true || "$UNINSTALL" == true || -t 0 ]] \
        || die "no terminal to ask in: run it in one, or with --yes to take the defaults (which allow the plugins' tools) and keep current settings"
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

# Plugins installed from a checkout run in place, where Claude Code installs no
# npm dependencies, so --dev installs them, for what they depend on too.
dev_dependencies() {
    local p
    for p in $(with_dependencies "${PLUGINS[@]}"); do
        npm_dependencies "$p"
    done
}

# Installs one plugin's npm dependencies in the clone, once per run: --dev and
# opencode both run plugins from it.
NPM_DONE=" "
npm_dependencies() {
    [[ -f "$REPO/plugins/$1/package.json" && "$NPM_DONE" != *" $1 "* ]] || return 0
    say "installing $1's npm dependencies"
    (cd "$REPO/plugins/$1" && npm install --ignore-scripts --no-audit --no-fund --silent)
    NPM_DONE+="$1 "
}

claude_install() {
    [[ "$DEV" == true ]] && dev_dependencies
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
    local p rules=()
    for p in "${PLUGINS[@]}"; do
        say "removing $p from Claude Code"
        claude plugin uninstall "$p@$MARKETPLACE" --scope user --keep-data >/dev/null || true
        mapfile -t -O "${#rules[@]}" rules < <(plugin_tool_rules "$p"; plugin_file_rules "$p")
    done
    (( ${#rules[@]} )) && [[ -f "$CLAUDE_SETTINGS" ]] || return 0
    cp "$CLAUDE_SETTINGS" "$CLAUDE_SETTINGS.before-jay"
    node - "$CLAUDE_SETTINGS" "${rules[@]}" <<'EOF'
const fs = require("fs");
const [file, ...rules] = process.argv.slice(2);
const settings = JSON.parse(fs.readFileSync(file, "utf8"));
if (settings.permissions?.allow) {
  settings.permissions.allow = settings.permissions.allow.filter((r) => !rules.includes(r));
}
fs.writeFileSync(file, JSON.stringify(settings, null, 2) + "\n");
EOF
    say "removed their permissions from $CLAUDE_SETTINGS (previous copy: settings.json.before-jay)"
}

# The allow rules for one plugin's tools: its MCP servers, and with pr the
# GitHub writes its unattended roles make, each in the one form pr-conduct.md
# has them run it. None of them matches an approval.
plugin_tool_rules() {
    local server
    if [[ -f "$REPO/plugins/$1/.mcp.json" ]]; then
        for server in $(json 'Object.keys(j.mcpServers ?? {})' < "$REPO/plugins/$1/.mcp.json"); do
            echo "mcp__plugin_${1}_${server}"
        done
    fi
    [[ "$1" != pr ]] || printf '%s\n' \
        "Bash(gh api -X PATCH repos/*/issues/* -F milestone=*)" \
        "Bash(gh issue create *)" \
        "Bash(gh pr comment * --body-file *)" \
        "Bash(gh pr review * --comment --body-file *)" \
        "Bash(gh pr review * --request-changes --body-file *)" \
        "Bash(gh run rerun *)"
}

# The file rules one plugin needs: with fyi, reading and writing its project folders.
plugin_file_rules() {
    [[ "$1" != fyi ]] || printf '%s\n' "Read($(fyi_projects_path))" "Edit($(fyi_projects_path))"
}

# The fyi store's project folders, as a permission path: under the home directory
# with ~/, anywhere else with // (a single / would be relative to the settings file).
fyi_projects_path() {
    local store="${FYI_DIR:-$HOME/.fyi}"
    if [[ "$store" == "$HOME"/* || "$store" == "$HOME" ]]; then
        echo "~${store#"$HOME"}/*/projects/**"
    else
        echo "/$store/*/projects/**"
    fi
}

# Plugins cannot grant themselves permissions, so the installer does: ~/.jay as a
# readable directory; each plugin's file rules, where sessions keep a project's
# files; and, if wanted, the plugins' tool rules, so they run without prompts.
# Items themselves stay behind fyi's tools, which validate them.
claude_permissions() {
    local p rules=() files=()
    for p in $(claude_installed); do
        mapfile -t -O "${#rules[@]}" rules < <(plugin_tool_rules "$p")
        mapfile -t -O "${#files[@]}" files < <(plugin_file_rules "$p")
    done

    local allow=false
    if (( ${#rules[@]} )) && confirm "Allow the plugins' tools without asking (${rules[*]})?"; then
        allow=true
    fi

    mkdir -p "$(dirname "$CLAUDE_SETTINGS")"
    [[ -f "$CLAUDE_SETTINGS" ]] || echo '{}' > "$CLAUDE_SETTINGS"
    cp "$CLAUDE_SETTINGS" "$CLAUDE_SETTINGS.before-jay"
    JAY_FILE_RULES="$(printf '%s\n' "${files[@]}")" node - "$CLAUDE_SETTINGS" "$allow" "${rules[@]}" <<'EOF'
const fs = require("fs");
const [file, allow, ...rules] = process.argv.slice(2);
const files = (process.env.JAY_FILE_RULES ?? "").split("\n").filter(Boolean);
const settings = JSON.parse(fs.readFileSync(file, "utf8"));
const add = (list, item) => (list.includes(item) ? list : [...list, item]);

settings.permissions ??= {};
settings.permissions.additionalDirectories = add(settings.permissions.additionalDirectories ?? [], "~/.jay");
settings.permissions.allow = files.reduce(add, settings.permissions.allow ?? []);
if (allow === "true") {
  settings.permissions.allow = rules.reduce(add, settings.permissions.allow ?? []);
}
fs.writeFileSync(file, JSON.stringify(settings, null, 2) + "\n");
EOF
    say "updated $CLAUDE_SETTINGS (previous copy: settings.json.before-jay)"
}

# ---------------------------------------------------------------- opencode

# A plugin's MCP server commands, with its root substituted, one per line.
server_commands() {
    json "Object.values(j.mcpServers ?? {}).map((s) => s.command.replace('\${CLAUDE_PLUGIN_ROOT}', '$REPO/plugins/$1'))" < "$REPO/plugins/$1/.mcp.json"
}

# opencode loads each plugin from this clone, through a one-line file in its
# plugins folder that re-exports the plugin's opencode.mjs. Plugins run in place,
# so their npm dependencies are installed here. A server whose command doesn't
# exist makes opencode hang at start, so that is checked first.
opencode_install() {
    local p cmd
    mkdir -p "$OPENCODE_DIR/plugins"
    for p in $(with_dependencies "${PLUGINS[@]}"); do
        npm_dependencies "$p"
        if [[ -f "$REPO/plugins/$p/.mcp.json" ]]; then
            while IFS= read -r cmd; do
                [[ -x "$cmd" ]] || die "$p's server command $cmd doesn't exist; opencode would hang on it"
            done < <(server_commands "$p")
        fi
        say "installing $p in opencode"
        echo "export * from \"$REPO/plugins/$p/opencode.mjs\";" > "$OPENCODE_DIR/plugins/jay-$p.js"
    done
    say "restart opencode to load the changes"
}

opencode_uninstall() {
    local p
    for p in "${PLUGINS[@]}"; do
        say "removing $p from opencode"
        rm -f "$OPENCODE_DIR/plugins/jay-$p.js"
    done
}

# ---------------------------------------------------------------- settings

# The named plugins and everything they depend on, dependencies first, each once.
# Claude Code installs dependencies on its own, but their settings still need asking.
with_dependencies() {
    local -A seen=()
    local order=()
    visit() {
        local d
        [[ -n "${seen[$1]:-}" ]] && return
        seen[$1]=1
        for d in $(json '(j.dependencies ?? []).map((d) => typeof d === "string" ? d : d.name)' < "$REPO/plugins/$1/.claude-plugin/plugin.json"); do
            visit "$d"
        done
        order+=("$1")
    }
    local p
    for p in "$@"; do visit "$p"; done
    printf '%s\n' "${order[@]}"
}

# Runs the setup.sh of each plugin installed, dependencies included, which asks
# for that plugin's settings and writes them where it reads them.
configure() {
    local p
    for p in $(with_dependencies "${PLUGINS[@]}"); do
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
