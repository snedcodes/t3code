#!/bin/sh
# Developer/diagnostic fallback only. Daily use is T3 Operational.app in Applications or the Dock.
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec /usr/bin/env node "$SCRIPT_DIR/t3-operational-launcher.mjs" "$@"
