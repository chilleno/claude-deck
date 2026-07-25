#!/bin/zsh
# Full automatic big-key toggle: quit Studio, patch to the desired state,
# relaunch. Spawned detached by the plugin when the setup key is pressed.
STATE_DIR="$HOME/Library/Application Support/Ulanzi/UlanziDeck/claude-state"
LOCK="$STATE_DIR/.bigkey-watcher.pid"
mkdir -p "$STATE_DIR"
exec >> "$STATE_DIR/bigkey-watcher.log" 2>&1
echo "=== toggle $(date '+%H:%M:%S') pid $$"

if [ -f "$LOCK" ] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then
  echo "another toggle in progress, exiting"
  exit 0
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

osascript -e 'tell application "Ulanzi Studio" to quit' 2>/dev/null || true

# wait for Studio to exit (force-kill escape hatch after 30s)
end=$((SECONDS + 30))
while pgrep -x UlanziDeck >/dev/null; do
  if [ $SECONDS -ge $end ]; then
    echo "quit timeout, force killing"
    pkill -x UlanziDeck 2>/dev/null || true
    sleep 2
    break
  fi
  sleep 1
done
echo "studio exited"

sleep 1  # let profile writes settle
python3 "$(dirname "$0")/patch-bigkey.py"

# relaunch with retries
for i in 1 2 3; do
  open -a "Ulanzi Studio" && echo "open attempt $i issued"
  sleep 6
  if pgrep -x UlanziDeck >/dev/null; then
    echo "studio relaunched"
    exit 0
  fi
done
echo "RELAUNCH FAILED after 3 attempts"
