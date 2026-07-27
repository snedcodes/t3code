#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BUNDLE="$SCRIPT_DIR/../apps/desktop/T3 Operational.app"
DESTINATION="$HOME/Applications/T3 Operational.app"
PROFILE_HOME="$HOME/.t3-operational"
TOOLCHAIN_ROOT="$PROFILE_HOME/toolchain/node24"
DURABLE_NODE="$TOOLCHAIN_ROOT/bin/node"
INTEGRITY_MANIFEST="$TOOLCHAIN_ROOT/node24-integrity.json"

if [ ! -d "$BUNDLE" ]; then
  echo "T3 Operational.app bundle is missing: $BUNDLE" >&2
  exit 1
fi

/bin/mkdir -p "$HOME/Applications" "$TOOLCHAIN_ROOT"

if [ ! -x "$DURABLE_NODE" ]; then
  SOURCE_NODE="${T3_OPERATIONAL_NODE_SOURCE:-}"
  for candidate in "$SOURCE_NODE" \
    "/tmp/t3-diffs-repair-toolchain/node/bin/node" \
    "/opt/homebrew/opt/node@24/bin/node" \
    "/usr/local/opt/node@24/bin/node"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      SOURCE_NODE="$candidate"
      break
    fi
  done
  if [ ! -x "$SOURCE_NODE" ]; then
    echo "Node 24 source was not found. Set T3_OPERATIONAL_NODE_SOURCE and retry." >&2
    exit 1
  fi
  SOURCE_NODE_ROOT=$(CDPATH= cd -- "$(dirname -- "$SOURCE_NODE")/.." && pwd)
  /usr/bin/ditto "$SOURCE_NODE_ROOT" "$TOOLCHAIN_ROOT"
fi

NODE_VERSION=$($DURABLE_NODE --version)
case "$NODE_VERSION" in
  v24.*) ;;
  *) echo "Durable Node is not Node 24: $NODE_VERSION" >&2; exit 1 ;;
esac
NODE_SHA256=$(/usr/bin/shasum -a 256 "$DURABLE_NODE" | /usr/bin/awk '{print $1}')
/usr/bin/plutil -convert json -o "$INTEGRITY_MANIFEST" -- - <<EOF
{"nodePath":"$DURABLE_NODE","nodeVersion":"$NODE_VERSION","nodeSha256":"$NODE_SHA256"}
EOF

/bin/rm -rf "$DESTINATION"
/usr/bin/ditto "$BUNDLE" "$DESTINATION"
/usr/bin/codesign --force --deep --sign - "$DESTINATION"
/usr/bin/codesign --verify --deep --strict "$DESTINATION"
/usr/bin/open -R "$DESTINATION"
echo "Installed $DESTINATION"
echo "Persistent Node: $DURABLE_NODE ($NODE_VERSION, SHA-256 $NODE_SHA256)"
echo "This is separate from the installed T3 Nightly application."
