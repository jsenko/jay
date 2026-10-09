#!/usr/bin/env bash
#
# Structural checks over the marketplace and its plugins: budgets, references,
# frontmatter, the shared copies, and the manifests. Catches the class of
# mistake a rename or a move leaves behind.
#
# Needs bash and node; runs `claude plugin validate` too when claude is installed.
# Exits non-zero on errors so CI can gate on it.
#
#   tools/check/check.sh [--quiet]

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
QUIET=false
[[ "${1:-}" == "--quiet" ]] && QUIET=true

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'

ERRORS=0
WARNINGS=0

# Directories in a plugin that hold instruction files.
INSTRUCTION_DIRS=(rules processes roles commands skills)

err()  { echo -e "  ${RED}✗${NC} $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "  ${YELLOW}!${NC} $1"; WARNINGS=$((WARNINGS + 1)); }
note() { [[ "$QUIET" == false ]] && echo -e "$1"; return 0; }

# Prints the result of a JavaScript expression over a JSON file, bound to `j`.
json() { node -e "const j = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); const r = ($2); if (r !== undefined) console.log(Array.isArray(r) ? r.join('\n') : r)" "$1"; }

# Every plugin: a directory under plugins/ with a manifest.
plugins() {
    for dir in "$REPO"/plugins/*/; do
        [[ -f "$dir/.claude-plugin/plugin.json" ]] && basename "$dir"
    done
}

# The plugins a plugin declares it needs, one per line.
dependencies_of() {
    json "$REPO/plugins/$1/.claude-plugin/plugin.json" '(j.dependencies ?? []).map((d) => typeof d === "string" ? d : d.name)'
}

# Every instruction file, repo-relative.
instruction_files() {
    local p d
    for p in $(plugins); do
        for d in "${INSTRUCTION_DIRS[@]}"; do
            [[ -d "$REPO/plugins/$p/$d" ]] && find "$REPO/plugins/$p/$d" -type f -name '*.md'
        done
    done | sed "s|^$REPO/||" | sort
}

# The plugin a repo-relative path belongs to.
plugin_of() { cut -d/ -f2 <<< "$1"; }

# ---------------------------------------------------------------- budgets

# Line budget by file kind. See plugins/crew/rules/authoring.md.
budget_for() {
    case "$1" in
        plugins/crew/rules/always.md)     echo 25  ;;
        plugins/*/rules/*.md)             echo 60  ;;
        plugins/*/roles/*.md)             echo 60  ;;
        plugins/*/processes/*.md)         echo 120 ;;
        plugins/*/skills/*/SKILL.md)      echo 120 ;;
        plugins/*/commands/*.md)          echo 80  ;;  # a case * also matches nested directories
        *)                                echo 0   ;;
    esac
}

check_budgets() {
    note "${GREEN}budgets${NC}"
    local rel budget lines
    while IFS= read -r rel; do
        [[ "$(basename "$rel")" == "README.md" ]] && continue
        budget="$(budget_for "$rel")"
        [[ "$budget" == "0" ]] && continue
        lines=$(wc -l < "$REPO/$rel")
        (( lines > budget )) && warn "$rel — $lines lines, budget $budget (over by $((lines - budget)))"
    done < <(instruction_files)
}

# ------------------------------------------------------------- references

# `~/.jay/plugins/<p>/<path>` must name a file in plugins/<p>, and <p> must be the
# plugin itself or one it depends on. References into the old ~/.fyi/work layout
# are allowed while files are still moving, but reported.
check_file_refs() {
    note "${GREEN}file references${NC}"
    local file self target owner
    while IFS= read -r file; do
        self="$(plugin_of "$file")"
        while IFS= read -r target; do
            [[ -z "$target" ]] && continue
            owner="$(cut -d/ -f1 <<< "$target")"
            if [[ ! -f "$REPO/plugins/$target" ]]; then
                err "$file → ~/.jay/plugins/$target (no such file)"
            elif [[ "$owner" != "$self" ]] && ! dependencies_of "$self" | grep -qx "$owner"; then
                err "$file → ~/.jay/plugins/$target ($self does not depend on $owner)"
            fi
        done < <(grep -oE '[~]/\.jay/plugins/[a-z0-9-]+/[A-Za-z0-9_./-]+\.(md|sh|json|ts|js)' "$REPO/$file" \
                   | sed 's|^~/\.jay/plugins/||' | sort -u)
        while IFS= read -r target; do
            [[ -n "$target" ]] && warn "$file → $target (old layout; switch to ~/.jay/plugins/ once it moves)"
        done < <(grep -oE '[~]/\.fyi/work/(rules|processes|roles)/[A-Za-z0-9_./-]+\.md' "$REPO/$file" | sort -u)
    done < <(instruction_files)
}

# `/<plugin>:<name>` must be a command or a skill of that plugin, and a plugin it may
# use. Old `/j:` references are reported while commands are still moving.
check_command_refs() {
    note "${GREEN}command references${NC}"
    local file self ref owner name known
    known="$(plugins | paste -sd'|')"
    [[ -z "$known" ]] && return 0
    while IFS= read -r file; do
        self="$(plugin_of "$file")"
        while IFS= read -r ref; do
            [[ -z "$ref" ]] && continue
            owner="${ref%%:*}"; name="${ref#*:}"
            if [[ ! -f "$REPO/plugins/$owner/commands/${name//://}.md" && ! -f "$REPO/plugins/$owner/skills/$name/SKILL.md" ]]; then
                err "$file → /$ref (no command or skill $name in $owner)"
            elif [[ "$owner" != "$self" ]] && ! dependencies_of "$self" | grep -qx "$owner"; then
                err "$file → /$ref ($self does not depend on $owner)"
            fi
        done < <(grep -oE "(^|[^A-Za-z0-9_/.~-])/($known):[a-z0-9-]+(:[a-z0-9-]+)*" "$REPO/$file" | sed 's|^[^/]*/||' | sort -u)
        while IFS= read -r ref; do
            [[ -n "$ref" ]] && warn "$file → $ref (old command; switch to /<plugin>:<name> once it moves)"
        done < <(grep -oE '/j:[a-z-]+(:[a-z-]+)*' "$REPO/$file" | sort -u)
    done < <(instruction_files)
}

# ------------------------------------------------------------ frontmatter

field() { sed -n '2,/^---$/p' "$1" | grep -oP "(?<=^$2: ).*" | head -1; }

# Capabilities a role may advertise, read from crew rather than restated, so a
# typo cannot pass here and fail at routing time.
crew_capabilities() {
    sed -n '/^export const CAPABILITIES/,/^] as const;/p' "$REPO/plugins/crew/server/types.ts" 2>/dev/null \
      | grep -oE '"[a-z]+"' | tr -d '"'
}

check_roles() {
    note "${GREEN}role profiles${NC}"
    local valid file rel name unattended caps cap key
    valid="$(crew_capabilities)"
    while IFS= read -r rel; do
        file="$REPO/$rel"
        for key in name description capabilities unattended; do
            grep -q "^$key:" <(sed -n '2,/^---$/p' "$file") || err "$rel missing frontmatter: $key"
        done

        name="$(field "$file" name)"
        [[ -n "$name" && "$name" != "$(basename "$file" .md)" ]] && \
            err "$rel declares name: $name but is named $(basename "$file")"

        unattended="$(field "$file" unattended)"
        [[ -n "$unattended" && "$unattended" != "true" && "$unattended" != "false" ]] && \
            err "$rel unattended: $unattended (must be true or false)"

        if [[ -z "$valid" ]]; then
            warn "$rel — capabilities not checked: no crew plugin to read them from"
            continue
        fi
        caps="$(field "$file" capabilities | tr -d '[]' | tr ',' ' ')"
        for cap in $caps; do
            grep -qx "$cap" <<< "$valid" || err "$rel advertises unknown capability: $cap"
        done
    done < <(instruction_files | grep -E '^plugins/[^/]+/roles/[^/]+\.md$')
}

# Claude Code needs a description to list a command or skill.
check_descriptions() {
    note "${GREEN}command and skill frontmatter${NC}"
    local file
    while IFS= read -r file; do
        head -1 "$REPO/$file" | grep -q '^---$' || { err "$file has no frontmatter"; continue; }
        grep -q '^description:' <(sed -n '2,/^---$/p' "$REPO/$file") || err "$file missing description"
    done < <(instruction_files | grep -E '^plugins/[^/]+/(commands/.*\.md|skills/[^/]+/SKILL\.md)$' | grep -v '/README\.md$')
}

# A rule or process nothing points at is either dead or loaded by a convention
# worth writing down. Reported, not failed.
check_orphans() {
    note "${GREEN}orphans${NC}"
    local file tail refs
    while IFS= read -r file; do
        case "$file" in plugins/*/commands/*|plugins/*/skills/*|plugins/*/roles/*) continue ;; esac
        # The plugin, directory and name, as every reference spells it.
        tail="$(cut -d/ -f2- <<< "$file")"
        refs=$(grep -rlF "$tail" "$REPO/plugins" "$REPO/docs" "$REPO/CLAUDE.md" --include='*.md' 2>/dev/null \
                 | grep -v node_modules | grep -v "/$file$" | grep -c .)
        (( refs == 0 )) && warn "$file — nothing references it"
    done < <(instruction_files)
}

# --------------------------------------------------------------- manifests

# The marketplace lists exactly the plugins in plugins/, each manifest names its own
# directory, and every dependency is a plugin of this marketplace.
check_manifests() {
    note "${GREEN}manifests${NC}"
    local market="$REPO/.claude-plugin/marketplace.json" listed p dep
    [[ -f "$market" ]] || { err ".claude-plugin/marketplace.json is missing"; return; }
    listed="$(json "$market" 'j.plugins.map((p) => `${p.name} ${p.source}`)')"

    for p in $(plugins); do
        grep -qx "$p ./plugins/$p" <<< "$listed" || err "plugins/$p is not in the marketplace with source ./plugins/$p"
        [[ "$(json "$REPO/plugins/$p/.claude-plugin/plugin.json" 'j.name')" == "$p" ]] || \
            err "plugins/$p/.claude-plugin/plugin.json does not name itself $p"
        [[ -n "$(json "$REPO/plugins/$p/.claude-plugin/plugin.json" 'j.version')" ]] || \
            err "plugins/$p/.claude-plugin/plugin.json has no version"
        for dep in $(dependencies_of "$p"); do
            [[ -d "$REPO/plugins/$dep" ]] || err "plugins/$p depends on $dep, which is not in this marketplace"
        done
    done
    while read -r p _; do
        [[ -n "$p" && ! -f "$REPO/plugins/$p/.claude-plugin/plugin.json" ]] && err "marketplace lists $p, which has no plugins/$p"
    done <<< "$listed"
}

# ------------------------------------------------------------ shared copies

# Each file under tools/plugin/<dir> must be copied unchanged to plugins/<p>/<dir>:
# hooks into every plugin, dashboard into each plugin that declares one.
check_copies() {
    note "${GREEN}shared copies${NC}"
    local p src rel
    for p in $(plugins); do
        for dir in hooks dashboard; do
            [[ "$dir" == dashboard && ! -f "$REPO/plugins/$p/dashboard/dashboard.json" ]] && continue
            while IFS= read -r src; do
                rel="${src#"$REPO/tools/plugin/"}"
                if [[ ! -f "$REPO/plugins/$p/$rel" ]]; then
                    err "plugins/$p/$rel is missing (copy it from tools/plugin/$rel)"
                elif ! cmp -s "$src" "$REPO/plugins/$p/$rel"; then
                    err "plugins/$p/$rel differs from tools/plugin/$rel (edit the master, then copy)"
                fi
            done < <(find "$REPO/tools/plugin/$dir" -type f)
        done
    done
}

# A dashboard runs as an ES module under tsx, from the plugin root's package.json.
check_dashboards() {
    note "${GREEN}dashboards${NC}"
    local p pkg
    for p in $(plugins); do
        [[ -f "$REPO/plugins/$p/dashboard/dashboard.json" ]] || continue
        pkg="$REPO/plugins/$p/package.json"
        [[ -f "$pkg" ]] || { err "plugins/$p has a dashboard but no package.json"; continue; }
        [[ "$(json "$pkg" 'j.type')" == "module" ]] || err "plugins/$p/package.json needs \"type\": \"module\" for its dashboard"
        [[ -n "$(json "$pkg" '(j.dependencies ?? {}).tsx')" ]] || err "plugins/$p/package.json needs tsx among its dependencies for its dashboard"
    done
}

# Each MCP server's command must exist once the plugin's dependencies are installed;
# a missing one hangs opencode and fails silently in Claude Code.
check_servers() {
    note "${GREEN}MCP servers${NC}"
    local p root cmd
    for p in $(plugins); do
        root="$REPO/plugins/$p"
        [[ -f "$root/.mcp.json" ]] || continue
        if [[ -f "$root/package.json" && ! -d "$root/node_modules" ]]; then
            warn "plugins/$p — server commands not checked: run npm install there first"
            continue
        fi
        while IFS= read -r cmd; do
            cmd="${cmd//\$\{CLAUDE_PLUGIN_ROOT\}/$root}"
            [[ "$cmd" == /* && ! -x "$cmd" ]] && err "plugins/$p/.mcp.json runs $cmd, which does not exist"
        done < <(json "$root/.mcp.json" 'Object.values(j.mcpServers ?? {}).map((s) => s.command)')
    done
}

# Claude Code's own validation of the marketplace and each plugin.
check_validate() {
    note "${GREEN}claude plugin validate${NC}"
    if ! command -v claude >/dev/null; then
        warn "claude is not installed; skipped"
        return
    fi
    local target out
    for target in . $(plugins | sed 's|^|plugins/|'); do
        out="$(cd "$REPO" && claude plugin validate "$target" 2>&1)" || err "claude plugin validate $target failed:\n$out"
    done
}

# ----------------------------------------------------------------- report

check_manifests
check_budgets
check_file_refs
check_command_refs
check_roles
check_descriptions
check_orphans
check_copies
check_dashboards
check_servers
check_validate

echo ""
if (( ERRORS > 0 )); then
    echo -e "${RED}$ERRORS error(s)${NC}, $WARNINGS warning(s)"
    exit 1
fi
if (( WARNINGS > 0 )); then
    echo -e "${YELLOW}$WARNINGS warning(s)${NC}, no errors"
    exit 0
fi
echo -e "${GREEN}all checks passed${NC}"
