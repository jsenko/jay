#!/usr/bin/env bash
#
# Asks for pr's settings and writes them to the github section of
# ~/.jay/config.json (or $JAY_CONFIG), which several jay plugins share.
# Run by install.sh; run it again to change them. Restart the client
# afterwards.
#
#   setup.sh          ask, offering the current values
#   setup.sh --yes    keep the current values, or the defaults
#
# Needs node; gh, logged in, for the default handle.

set -euo pipefail

CONFIG="${JAY_CONFIG:-$HOME/.jay/config.json}"
DEFAULT_REPOS="Apicurio/*,Apitomy/*,ApicurioTesting/*"

YES=false
[[ "${1:-}" == "--yes" ]] && YES=true
# Without a terminal, read fails at end of input and set -e ends the script mid-question.
[[ "$YES" == true || -t 0 ]] || { echo "✗ no terminal to ask in: run it in one, or with --yes" >&2; exit 1; }

# The current value of a github setting, repos joined with commas; empty if unset.
current() {
    [[ -f "$CONFIG" ]] || return 0
    node -e '
        const g = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).github ?? {};
        const v = g[process.argv[2]];
        console.log(Array.isArray(v) ? v.join(",") : (v ?? ""));
    ' "$CONFIG" "$1"
}

user="$(current user)"
if [[ -z "$user" ]]; then
    user="$(GH_HOST=github.com gh api user -q .login 2>/dev/null || true)"
fi
repos="$(current repos)"
repos="${repos:-$DEFAULT_REPOS}"

if [[ "$YES" == false ]]; then
    echo "Your GitHub handle, for PRs assigned to you and mentions of you."
    read -r -p "GitHub handle [$user]: " answer
    user="${answer:-$user}"

    echo "Repositories the watcher follows: owner/repo, or owner/* for all of an owner's, comma-separated."
    while true; do
        read -r -p "Repositories [$repos]: " answer
        answer="${answer:-$repos}"
        if [[ "$answer" =~ ^[^/,\ ]+/[^/,\ ]+(,[^/,\ ]+/[^/,\ ]+)*$ ]]; then
            repos="$answer"
            break
        fi
        echo "Use owner/repo or owner/*, separated by commas, without spaces."
    done
fi

mkdir -p "$(dirname "$CONFIG")"
node - "$CONFIG" "$user" "$repos" <<'NODE'
const fs = require("fs");
const [file, user, repos] = process.argv.slice(2);
const config = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
config.github = { ...config.github, user, repos: repos.split(",") };
fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
NODE
echo "pr: GitHub handle ${user:-unset}, watching $repos ($CONFIG)"
