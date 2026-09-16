#!/bin/zsh
# Inject the Ulanzi claude-state hooks into every Claude profile found in $HOME.
#
# Delegates to the installed plugin's own installHooks(), which is the same code
# path the "Enable Claude tracking" button uses: idempotent, upgrades entries
# left by older versions instead of duplicating them, backs up what it changes,
# and creates settings.json for a profile that has none. Keeping a second copy
# of that logic here is what once left every event wired twice — the python
# block below registered a different command string than the plugin did, and
# each side considered the other's entry foreign.
set -euo pipefail

PLUGIN="$HOME/Library/Application Support/Ulanzi/UlanziDeck/Plugins/com.claudedeck.deck.plugin.ulanziPlugin"
SETUP="$PLUGIN/plugin/hooks-setup.js"
STUDIO_NODE="/Applications/Ulanzi Studio.app/Contents/MacOS/NodeJS/node"

if [[ ! -f "$SETUP" ]]; then
  echo "sync-hooks: plugin not installed yet ($SETUP missing) — run ./install.sh first" >&2
  exit 1
fi

# Studio's own Node is preferred: it is the interpreter the hook command will
# name, so the entries written here match what the plugin writes at runtime.
if [[ -x "$STUDIO_NODE" ]]; then
  NODE="$STUDIO_NODE"
elif command -v node >/dev/null 2>&1; then
  NODE="$(command -v node)"
  echo "sync-hooks: Ulanzi Studio's Node not found, using $NODE" >&2
else
  echo "sync-hooks: no Node available to run the installer" >&2
  exit 1
fi

"$NODE" --input-type=module -e "
const m = await import('file://' + process.argv[1]);
const status = m.hookStatus();
if (!status.claude.installed) {
  console.log('sync-hooks: no Claude Code installation found — nothing to wire');
} else {
  for (const r of m.installHooks()) {
    if (r.error) console.log(\`\${r.settings}: ERROR \${r.error}\`);
    else if (r.created) console.log(\`\${r.settings}: created and wired\`);
    else if (r.changed) console.log(\`\${r.settings}: wired\`);
    else console.log(\`\${r.settings}: up to date\`);
  }
  const after = m.hookStatus();
  console.log(\`sync-hooks: \${after.installed} profile(s) wired, \${after.missing} missing, \${after.outdated} outdated\`);
}
" "$SETUP"
