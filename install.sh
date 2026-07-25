#!/bin/zsh
# Install/update the plugin into Ulanzi Studio's plugin directory.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/com.antonio.shortcuts.ulanziPlugin"
DEST="$HOME/Library/Application Support/Ulanzi/UlanziDeck/Plugins/com.antonio.shortcuts.ulanziPlugin"

mkdir -p "$DEST"
rsync -a --delete --exclude node_modules "$SRC/" "$DEST/"

cd "$DEST"
npm install --omit=dev --no-audit --no-fund

"$ROOT/sync-hooks.sh"

echo ""
echo "Installed to: $DEST"
echo "Now quit and relaunch Ulanzi Studio to reload plugins."
