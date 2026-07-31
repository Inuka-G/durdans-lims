#!/usr/bin/env bash
# Point git at the repository's shared hooks.
#
# Run once after cloning:
#   tools/install-hooks.sh
#
# core.hooksPath is per-clone local config, so this cannot be done for you by a
# committed file — every contributor runs it themselves. Nothing here is
# automatic on clone, deliberately: this repository was previously attacked by a
# committed editor config that ran on folder open. Setup stays explicit.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d .githooks ]; then
  echo "error: .githooks/ not found — run this from inside the repository." >&2
  exit 1
fi

git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true

echo "hooks installed: $(git config core.hooksPath)"
ls -1 .githooks | sed 's/^/  /'
