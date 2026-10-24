#!/usr/bin/env bash
# Releases the plugins named, each at the version given. The release workflow
# runs it from one input per plugin; it works the same from a clone.
#
#   tools/release/release.sh fyi=1.3.0 pr=1.0.1            release, and push
#   tools/release/release.sh --dry-run fyi=1.3.0 pr=1.0.1  bump, check and show, then undo
#
# Each version is raised in the plugin's manifests, the tree is checked and
# tested, and the bump is committed. Only then is anything pushed: the commit
# to main, then per plugin a <plugin>--v<version> tag, which Claude Code resolves
# dependency ranges against, and a GitHub release listing the plugin's commits
# since its previous tag.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DRY_RUN=false
RELEASES=()

die() { echo "release: $*" >&2; exit 1; }

# Each argument is plugin=version, for a plugin here and a version above its
# current one: releases only move forward. The current version itself is
# accepted while it has no tag, which is how a plugin is first released.
parse_args() {
    local arg name version current
    for arg in "$@"; do
        [[ "$arg" == --dry-run ]] && { DRY_RUN=true; continue; }
        [[ "$arg" == *=* ]] || die "expected plugin=version, got '$arg'"
        name="${arg%%=*}" version="${arg#*=}"
        [[ -n "$version" ]] || continue
        [[ -f "$REPO/plugins/$name/.claude-plugin/plugin.json" ]] || die "no plugin named $name"
        [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "$name: '$version' is not a version like 1.3.0"
        current="$(manifest_version "$name")"
        if [[ "$version" == "$current" ]]; then
            ! git -C "$REPO" rev-parse -q --verify "refs/tags/$name--v$version" >/dev/null || \
                die "$name $version is already released"
        elif [[ "$(printf '%s\n%s\n' "$current" "$version" | sort -V | tail -1)" != "$version" ]]; then
            die "$name is at $current; $version doesn't come after it"
        fi
        RELEASES+=("$name=$version")
    done
    (( ${#RELEASES[@]} )) || die "no plugin given a version"
}

# A plugin's version, from plugin.json.
manifest_version() {
    node -p "require('$REPO/plugins/$1/.claude-plugin/plugin.json').version"
}

# Raises a plugin's version in plugin.json, and in package.json and its
# lockfile when the plugin has them. tools/check fails if they disagree.
bump() {
    local name="$1" version="$2" dir="$REPO/plugins/$1"
    node -e '
const fs = require("fs");
const [file, version] = process.argv.slice(1);
const text = fs.readFileSync(file, "utf8");
fs.writeFileSync(file, text.replace(/("version":\s*")[^"]+"/, `$1${version}"`));
' "$dir/.claude-plugin/plugin.json" "$version"
    if [[ -f "$dir/package.json" ]]; then
        (cd "$dir" && npm version "$version" --no-git-tag-version --allow-same-version >/dev/null)
    fi
}

# What a release brings: the commits touching the plugin, or the shared files
# every plugin links to, since its previous tag, without release commits.
notes() {
    local name="$1" previous
    previous="$(git -C "$REPO" tag --list "$name--v*" --sort=-v:refname | head -1)"
    [[ -n "$previous" ]] || { echo "First release."; return; }
    git -C "$REPO" log --format='- %s (%h)' --invert-grep --grep='^release: ' \
        "$previous..HEAD" -- "plugins/$name" tools/plugin
}

# The milestone named after a release, as "<number> <url>", or nothing: its
# issues are what the release ships, so the notes link it and releasing closes it.
milestone() {
    gh api "repos/$1/milestones?state=all&per_page=100" \
        --jq ".[] | select(.title == \"$2\") | \"\(.number) \(.html_url)\"" 2>/dev/null || true
}

parse_args "$@"
[[ -z "$(git -C "$REPO" status --porcelain)" ]] || die "the working tree has changes; commit or stash them first"
# Until the bump is committed, any exit puts the manifests back as they were.
trap 'git -C "$REPO" checkout -q -- plugins' EXIT

summary=()
for entry in "${RELEASES[@]}"; do
    bump "${entry%%=*}" "${entry#*=}"
    summary+=("${entry%%=*} ${entry#*=}")
done
"$REPO/tools/check/check.sh" --quiet
# The tests' output, including the errors they provoke on purpose, only on failure.
if ! output="$("$REPO/tools/check/test.sh" 2>&1)"; then
    echo "$output"
    die "the tests failed on the bumped tree; nothing was committed"
fi

message="release: $(IFS=,; echo "${summary[*]}" | sed 's/,/, /g')"
if [[ "$DRY_RUN" == true ]]; then
    echo "$message"
    git -C "$REPO" --no-pager diff --stat
    for entry in "${RELEASES[@]}"; do
        printf '\n%s--v%s:\n%s\n' "${entry%%=*}" "${entry#*=}" "$(notes "${entry%%=*}")"
    done
    exit 0
fi

if [[ -n "$(git -C "$REPO" status --porcelain)" ]]; then
    git -C "$REPO" commit -q -a -m "$message"
    trap - EXIT
    git -C "$REPO" push -q origin HEAD:main
fi
repo="${GITHUB_REPOSITORY:-jsenko/jay}"
for entry in "${RELEASES[@]}"; do
    name="${entry%%=*}" version="${entry#*=}"
    body="$(notes "$name")"
    body="${body:-No changes inside the plugin since its previous release.}"
    read -r number url <<<"$(milestone "$repo" "$name $version")"
    [[ -z "$url" ]] || body="Issues: $url"$'\n\n'"$body"
    (cd "$REPO" && claude plugin tag "plugins/$name" --push -m "$name %s")
    gh release create "$name--v$version" --repo "$repo" --verify-tag \
        --title "$name $version" --notes "$body"
    [[ -z "$number" ]] || gh api -X PATCH "repos/$repo/milestones/$number" -f state=closed >/dev/null
done
