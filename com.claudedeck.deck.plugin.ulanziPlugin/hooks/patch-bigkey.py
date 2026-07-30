#!/usr/bin/env python3
"""Write the Cycle iTerm Sessions action into the big key (slot 3_2) of the
current page of every active profile. Must run while Ulanzi Studio is NOT
running (Studio rewrites profile files from memory on quit)."""
import json
import os
import shutil
import uuid

BASE = os.path.expanduser("~/Library/Application Support/Ulanzi/UlanziDeck")

ACTION_UUID = "com.claudedeck.deck.plugin.itermcycle"


def make_entry(small_view_mode):
    entry = {
        "Action": ACTION_UUID,
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
    if small_view_mode is not None:
        entry["ActionParam"]["SmallViewMode"] = small_view_mode
    return entry


WIDGET_SAVE = os.path.join(BASE, "claude-state/.bigkey-widget.json")


def widget_entry():
    """The widget to restore on hide: the exact entry that was replaced on the
    last show (saved to WIDGET_SAVE), else a default visible mode 0 —
    'Background with no image' renders nothing and the deck keeps showing the
    stale claude frame, which looks like the hide failed."""
    try:
        saved = json.load(open(WIDGET_SAVE))
        if saved.get("Action") == "com.ulanzi.ulanzideck.smallwindow.window":
            saved["ActionID"] = str(uuid.uuid4())
            return saved
    except OSError:
        pass
    return {
        "Action": "com.ulanzi.ulanzideck.smallwindow.window",
        "ActionID": str(uuid.uuid4()),
        "ActionParam": {"SmallViewMode": 0},
        "LinkedTitle": True,
        "Name": "",
        "Plugin": {},
        "State": 0,
        "ViewParam": [{"Icon": "", "IconRel": ""}],
    }


def save_widget(entry):
    if entry.get("Action") == "com.ulanzi.ulanzideck.smallwindow.window":
        try:
            json.dump(entry, open(WIDGET_SAVE, "w"))
        except OSError:
            pass


def desired_on():
    try:
        flag = open(os.path.join(BASE, "claude-state/.bigkey-desired")).read().strip()
        return flag != "off"
    except OSError:
        return True


def main():
    want_on = desired_on()
    setting = json.load(open(os.path.join(BASE, "Config/setting_source.json")))
    root = os.path.join(BASE, "ProfilesV2")
    patched = 0
    for dev in setting.get("Devices", []):
        prof_name = dev.get("CurrentProfile")
        dev_uuid = dev.get("CurrentDevice")
        for group in os.listdir(root):
            gm_path = os.path.join(root, group, "manifest.json")
            if not os.path.isfile(gm_path):
                continue
            gm = json.load(open(gm_path))
            if gm.get("Name") != prof_name or gm.get("Device", {}).get("UUID") != dev_uuid:
                continue
            page = gm.get("Pages", {}).get("Current")
            pm_path = os.path.join(root, group, "Profiles", page or "", "manifest.json")
            if not page or not os.path.isfile(pm_path):
                continue
            pm = json.load(open(pm_path))
            for c in pm.get("Controllers", []):
                if c.get("Type") != "Keypad":
                    continue
                cur = c.get("Actions", {}).get("3_2", {})
                is_ours = cur.get("Action") == ACTION_UUID
                if want_on == is_ours:
                    continue  # already in the desired state
                svm = (cur.get("ActionParam") or {}).get("SmallViewMode")
                shutil.copy(pm_path, pm_path + ".bak-bigkey")
                if want_on:
                    save_widget(cur)
                new = make_entry(svm) if want_on else widget_entry()
                c.setdefault("Actions", {})["3_2"] = new
                json.dump(pm, open(pm_path, "w"), ensure_ascii=False, indent=1)
                print(f"{prof_name} / {page}: {'patched' if want_on else 'restored widget'}")
                patched += 1
    print(f"done ({'show' if want_on else 'hide'}), {patched} page(s) changed")


if __name__ == "__main__":
    main()
