#!/bin/zsh
# Inject the Ulanzi claude-state hooks into every Claude profile found in $HOME.
# Idempotent: skips entries that already exist; backs up each file it changes.
set -euo pipefail

python3 - <<'EOF'
import glob
import json
import os
import shutil

HOOK_REL = ("Library/Application Support/Ulanzi/UlanziDeck/"
            "Plugins/com.claudedeck.deck.plugin.ulanziPlugin/hooks/claude-hook.py")
CMD = "python3 '%s'" % os.path.join(os.path.expanduser("~"), HOOK_REL)
EVENTS = [
    "UserPromptSubmit", "PreToolUse", "PostToolUse", "PreCompact",
    "Stop", "Notification", "SessionStart", "SessionEnd", "PermissionRequest",
]

home = os.path.expanduser("~")
profiles = sorted(glob.glob(os.path.join(home, ".claude*")))
for prof in profiles:
    settings = os.path.join(prof, "settings.json")
    if not os.path.isdir(prof) or not os.path.isfile(settings):
        continue
    try:
        data = json.load(open(settings))
    except Exception as e:
        print(f"SKIP {settings}: unreadable ({e})")
        continue
    hooks = data.setdefault("hooks", {})
    added = []
    for ev in EVENTS:
        blocks = hooks.setdefault(ev, [])
        if any(CMD == h.get("command") for b in blocks for h in b.get("hooks", [])):
            continue
        target = next((b for b in blocks if b.get("matcher", "") == ""), None)
        if target is None:
            target = {"matcher": "", "hooks": []}
            blocks.append(target)
        target["hooks"].append({"type": "command", "command": CMD, "timeout": 5})
        added.append(ev)
    if added:
        shutil.copy(settings, settings + ".bak-ulanzi-hooks")
        json.dump(data, open(settings, "w"), indent=2)
        print(f"{settings}: added {', '.join(added)}")
    else:
        print(f"{settings}: up to date")
EOF
