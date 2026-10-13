#!/usr/bin/env bash
# Runs every automated test: the opencode adapter's, and each plugin's npm test.
# CI runs it on each push and pull request, and the release workflow on the
# bumped tree before anything is pushed. Expects each plugin's npm dependencies.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

node --test "$REPO"/tools/plugin/opencode/test/*.test.mjs

for pkg in "$REPO"/plugins/*/package.json; do
    if node -e "process.exit(require(process.argv[1]).scripts?.test ? 0 : 1)" "$pkg"; then
        (cd "$(dirname "$pkg")" && npm test)
    fi
done
