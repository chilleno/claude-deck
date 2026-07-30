#!/bin/zsh
# Install/update the plugin into Ulanzi Studio's plugin directory.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/com.claudedeck.deck.plugin.ulanziPlugin"
DEST="$HOME/Library/Application Support/Ulanzi/UlanziDeck/Plugins/com.claudedeck.deck.plugin.ulanziPlugin"

mkdir -p "$DEST"
rsync -a --delete --exclude node_modules "$SRC/" "$DEST/"

cd "$DEST"
# pnpm preferred; falls back to npm so a plain-Node machine still installs
if command -v pnpm >/dev/null 2>&1; then
  pnpm install --prod --config.node-linker=hoisted
else
  npm install --omit=dev --no-audit --no-fund
fi

"$ROOT/sync-hooks.sh"

echo ""
echo "Installed to: $DEST"
echo "Now quit and relaunch Ulanzi Studio to reload plugins."
