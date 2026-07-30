#!/bin/zsh
# Detached watcher: waits for Ulanzi Studio to quit, then patches the big key.
# Spawned by the plugin when the "Claude Screen Setup" action is on a key and
# the big key is not ours yet. Single instance, 2h timeout.
STATE_DIR="$HOME/Library/Application Support/Ulanzi/UlanziDeck/claude-state"
LOCK="$STATE_DIR/.bigkey-watcher.pid"
mkdir -p "$STATE_DIR"

if [ -f "$LOCK" ] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then
  exit 0  # already watching
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

end=$((SECONDS + 7200))
while pgrep -x UlanziDeck >/dev/null; do
  [ $SECONDS -ge $end ] && exit 1
  sleep 2
done

sleep 1  # let Studio finish writing profiles on its way out
python3 "$(dirname "$0")/patch-bigkey.py" >> "$STATE_DIR/bigkey-watcher.log" 2>&1

# Reopen Studio ourselves: if the user reopens it manually before the patch
# lands, Studio reads the stale file and re-saves it later, undoing the change.
if ! pgrep -x UlanziDeck >/dev/null; then
  open -a "Ulanzi Studio"
fi
