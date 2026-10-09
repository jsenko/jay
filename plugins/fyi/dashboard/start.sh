#!/usr/bin/env bash
# Runs this plugin's dashboard on the port in dashboard.json.
#
#   start.sh          start it
#   start.sh --open   start it and open a browser
#
# Copied into every plugin with a dashboard from tools/plugin/dashboard/;
# edit it there.
set -euo pipefail
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tsx="$dir/../node_modules/.bin/tsx"
if [[ ! -x "$tsx" ]]; then
    echo "Dependencies are missing: run npm install in $(dirname "$dir")" >&2
    exit 1
fi

if [[ "${1:-}" == "--open" ]]; then
    port=$(sed -n 's/^ *"port": *\([0-9]*\).*/\1/p' "$dir/dashboard.json")
    url="http://localhost:$port"
    # Give the server a moment to bind before the browser asks for the page.
    ( sleep 1; command -v xdg-open >/dev/null && xdg-open "$url" || open "$url" ) >/dev/null 2>&1 &
fi

exec "$tsx" "$dir/server.ts"
