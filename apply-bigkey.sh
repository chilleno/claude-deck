#!/bin/zsh
# Re-apply "Claude status" (Cycle iTerm Sessions) to the big key (slot 3_2)
# of the CURRENT page of the active profile. Run this whenever Ulanzi Studio
# strips the big-key action (it does so when the page is edited in its UI).
#
# Usage: ./apply-bigkey.sh
set -euo pipefail

echo "Quitting Ulanzi Studio..."
osascript -e 'tell application "Ulanzi Studio" to quit' 2>/dev/null || true
sleep 4

python3 - <<'EOF'
import json
import os
import shutil
import uuid

BASE = os.path.expanduser("~/Library/Application Support/Ulanzi/UlanziDeck")
ACTION = {
    "Action": "com.claudedeck.deck.plugin.itermcycle",
    "ActionID": str(uuid.uuid4()),
    "ActionParam": {"mode": "windows", "SmallViewMode": 2},
    "LinkedTitle": True,
    "Name": "Cycle iTerm Sessions",
    "Plugin": {"Name": "Claude Deck", "UUID": "com.claudedeck.deck.plugin", "Version": "1.0.0"},
    "State": 0,
    "ViewParam": [{
        "Icon": os.path.join(BASE, "Plugins/com.claudedeck.deck.plugin.ulanziPlugin/resources/action-itermcycle.png"),
        "IconRel": "",
    }],
}

# active device + profile name
setting = json.load(open(os.path.join(BASE, "Config/setting_source.json")))
patched = 0
for dev in setting.get("Devices", []):
    prof_name = dev.get("CurrentProfile")
    dev_uuid = dev.get("CurrentDevice")
    # find the profile group matching this device + profile name
    root = os.path.join(BASE, "ProfilesV2")
    for group in os.listdir(root):
        gm_path = os.path.join(root, group, "manifest.json")
        if not os.path.isfile(gm_path):
            continue
        gm = json.load(open(gm_path))
        if gm.get("Name") != prof_name or gm.get("Device", {}).get("UUID") != dev_uuid:
            continue
        page = gm.get("Pages", {}).get("Current")
        if not page:
            continue
        pm_path = os.path.join(root, group, "Profiles", page, "manifest.json")
        if not os.path.isfile(pm_path):
            continue
        pm = json.load(open(pm_path))
        for c in pm.get("Controllers", []):
            if c.get("Type") != "Keypad":
                continue
            cur = c.get("Actions", {}).get("3_2", {})
            if cur.get("Action") == ACTION["Action"]:
                print(f"{prof_name}: big key already ours — nothing to do")
                break
            # keep the user's chosen SmallViewMode if the widget entry had one
            svm = (cur.get("ActionParam") or {}).get("SmallViewMode")
            entry = dict(ACTION)
            if svm is not None:
                entry["ActionParam"] = {**entry["ActionParam"], "SmallViewMode": svm}
            shutil.copy(pm_path, pm_path + ".bak-bigkey")
            c.setdefault("Actions", {})["3_2"] = entry
            json.dump(pm, open(pm_path, "w"), ensure_ascii=False, indent=1)
            print(f"{prof_name} / page {page}: big key patched (backup .bak-bigkey)")
            patched += 1
if not patched:
    print("No page needed patching.")
EOF

echo "Relaunching Ulanzi Studio..."
open -a "Ulanzi Studio"
sleep 8
pgrep -x UlanziDeck >/dev/null || open -a "Ulanzi Studio"
echo "Done."
