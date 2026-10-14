#!/usr/bin/env bash
#
# Asks for fyi's settings and writes them to the store's config.json
# (~/.fyi/config.json, or $FYI_DIR/config.json). Run by install.sh; run it
# again to change them. Restart the client afterwards.
#
#   setup.sh          ask, offering the current values
#   setup.sh --yes    keep the current values, or the defaults
#
# Needs node.

set -euo pipefail

STORE="${FYI_DIR:-$HOME/.fyi}"
CONFIG="$STORE/config.json"
SCOPES=(default work personal)

YES=false
[[ "${1:-}" == "--yes" ]] && YES=true
# Without a terminal, read fails at end of input and set -e ends the script mid-question.
[[ "$YES" == true || -t 0 ]] || { echo "✗ no terminal to ask in: run it in one, or with --yes" >&2; exit 1; }

current=default
if [[ -f "$CONFIG" ]]; then
    current="$(node -e 'const c = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); console.log(c.defaultScope ?? "default")' "$CONFIG")"
fi

scope="$current"
if [[ "$YES" == false ]]; then
    echo "Which scope should items go to when a session names none?"
    echo "  default    for most people"
    echo "  work       to keep work and personal items apart, with work the usual one"
    echo "  personal   the same, with personal the usual one"
    while true; do
        read -r -p "Default scope [$current]: " scope
        scope="${scope:-$current}"
        [[ " ${SCOPES[*]} " == *" $scope "* ]] && break
        echo "Choose one of: ${SCOPES[*]}"
    done
fi

mkdir -p "$STORE"
node - "$CONFIG" "$scope" <<'EOF'
const fs = require("fs");
const [file, scope] = process.argv.slice(2);
const config = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
config.defaultScope = scope;
fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
EOF
echo "fyi: default scope is $scope ($CONFIG)"
