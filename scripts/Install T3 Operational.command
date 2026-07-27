#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BUNDLE="$SCRIPT_DIR/../apps/desktop/T3 Operational.app"
DESTINATION="/Applications/T3 Operational.app"

if [ ! -d "$BUNDLE" ]; then
  echo "T3 Operational.app bundle is missing: $BUNDLE" >&2
  exit 1
fi

/usr/bin/ditto "$BUNDLE" "$DESTINATION"
/usr/bin/open -R "$DESTINATION"
echo "Installed $DESTINATION"
echo "This is separate from the installed T3 Nightly application."
