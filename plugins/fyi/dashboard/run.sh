#!/usr/bin/env bash
# Runs this plugin's dashboard on the port in dashboard.json.
#
#   run.sh [--open]         run it in the foreground; --open also opens a browser
#   run.sh start [--open]   start it in the background, unless it is running, and print the URL
#   run.sh stop             stop it, however it was started
#   run.sh status           print the URL if it is running; exit 1 if not
#
# Needs curl. Copied into every plugin with a dashboard from
# tools/plugin/dashboard/; edit it there.
set -euo pipefail

dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tsx="$dir/../node_modules/.bin/tsx"
plugin=$(sed -n 's/^ *"name": *"\([^"]*\)".*/\1/p' "$dir/../.claude-plugin/plugin.json" | head -1)
port=$(sed -n 's/^ *"port": *\([0-9]*\).*/\1/p' "$dir/dashboard.json")
url="http://localhost:$port"
log="${TMPDIR:-/tmp}/jay-$plugin-dashboard.log"
poll_seconds=0.2
polls=50

usage() { sed -n '4,7p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2; }

# Whether this plugin's dashboard answers on its port, rather than nothing or another server.
running() {
    local health
    health=$(curl -sf --max-time 1 "$url/health") && [[ "$health" == *"\"plugin\":\"$plugin\""* ]]
}

need_dependencies() {
    if [[ ! -x "$tsx" ]]; then
        echo "Dependencies are missing: run npm install in $(dirname "$dir")" >&2
        exit 1
    fi
}

browse() { { command -v xdg-open >/dev/null && xdg-open "$url" || open "$url"; } >/dev/null 2>&1; }

# Starts the server detached from this shell, and waits until it answers or exits.
start() {
    if ! running; then
        need_dependencies
        nohup "$tsx" "$dir/server.ts" </dev/null >"$log" 2>&1 &
        local pid=$! i
        for (( i = 0; i < polls; i++ )); do
            running && break
            if ! kill -0 "$pid" 2>/dev/null || (( i == polls - 1 )); then
                echo "The $plugin dashboard did not start. The end of $log:" >&2
                tail -n 20 "$log" >&2
                exit 1
            fi
            sleep "$poll_seconds"
        done
    fi
    echo "$url"
    [[ "$open" == false ]] || browse
}

# Asks the server to exit, through the same route a dashboard page could use.
stop() {
    if ! running; then
        echo "The $plugin dashboard is not running."
        return
    fi
    if ! curl -sf --max-time 2 -X POST -H 'content-type: application/json' -d '{}' "$url/shutdown" >/dev/null; then
        echo "The $plugin dashboard refused to stop; end the process listening on port $port." >&2
        exit 1
    fi
    local i
    for (( i = 0; i < polls; i++ )); do
        running || { echo "Stopped the $plugin dashboard."; return; }
        sleep "$poll_seconds"
    done
    echo "The $plugin dashboard is still answering on port $port." >&2
    exit 1
}

command=run
case "${1:-}" in
    start|stop|status) command=$1; shift ;;
esac
open=false
case "${1:-}" in
    "") ;;
    --open) [[ "$command" == run || "$command" == start ]] || usage; open=true ;;
    *) usage ;;
esac

case "$command" in
    run)
        need_dependencies
        # Give the server a moment to bind before the browser asks for the page.
        [[ "$open" == false ]] || ( sleep 1; browse ) &
        exec "$tsx" "$dir/server.ts"
        ;;
    start) start ;;
    stop) stop ;;
    status)
        if running; then
            echo "$url"
        else
            echo "The $plugin dashboard is not running." >&2
            exit 1
        fi
        ;;
esac
