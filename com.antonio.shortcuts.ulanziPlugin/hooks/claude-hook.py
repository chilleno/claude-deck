#!/usr/bin/env python3
"""Claude Code hook: records session state for the Ulanzi Deck plugin.

Wired into ~/.claude/settings.json for UserPromptSubmit, PreToolUse, PreCompact,
Stop, Notification, SessionStart and SessionEnd. Reads the hook JSON from stdin
and writes one state file per Claude session; the plugin polls these to animate
the Claude Pet key and badge the session display.
"""
import json
import os
import sys
import time

STATE_DIR = os.path.expanduser(
    "~/Library/Application Support/Ulanzi/UlanziDeck/claude-state"
)

STATE_MAP = {
    "UserPromptSubmit": "working",
    "PreToolUse": "working",
    "PostToolUse": "working",
    "PreCompact": "compacting",
    "Stop": "waiting",
    "SessionStart": "waiting",
    "Notification": "attention",
    "PermissionRequest": "attention",
}

# tools that mean Claude is asking the user something
ASKING_TOOLS = {"AskUserQuestion", "ExitPlanMode"}


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return

    sid = data.get("session_id") or "unknown"
    event = data.get("hook_event_name") or ""
    path = os.path.join(STATE_DIR, sid + ".json")

    if os.environ.get("ULANZI_HOOK_DEBUG") or os.path.exists(os.path.join(STATE_DIR, ".debug")):
        try:
            with open(os.path.join(STATE_DIR, "events.log"), "a") as lf:
                lf.write("%s %s tool=%s keys=%s\n" % (
                    int(time.time()), event, data.get("tool_name") or "-",
                    ",".join(sorted(data.keys()))))
        except OSError:
            pass

    if event == "SessionEnd":
        try:
            os.remove(path)
        except OSError:
            pass
        return

    state = STATE_MAP.get(event)
    if not state:
        return
    if event == "Notification":
        # Notification also fires for the 60s-idle "waiting for your input"
        # message — that must not flip a finished session back to attention.
        msg = (data.get("message") or "").lower()
        if "permission" not in msg:
            return
    if event in ("Notification", "PreCompact"):
        # neither a notification (fires ~6s into a pending question, message
        # mentions permission) nor auto-compact may wipe the asking state —
        # the question is still on screen waiting for an answer
        try:
            existing = json.load(open(path))
            if existing.get("state") == "asking":
                return
        except (OSError, ValueError):
            pass
    ask = None
    if event in ("PreToolUse", "PermissionRequest") and (data.get("tool_name") or "") in ASKING_TOOLS:
        state = "asking"
        if data.get("tool_name") == "AskUserQuestion":
            try:
                q = (data.get("tool_input") or {}).get("questions", [])[0]
                ask = {
                    "question": q.get("question") or "",
                    "header": q.get("header") or "",
                    "options": [o.get("label") or "" for o in q.get("options", [])],
                    "multiSelect": bool(q.get("multiSelect")),
                }
            except (IndexError, AttributeError, TypeError):
                ask = None

    os.makedirs(STATE_DIR, exist_ok=True)
    payload = {
        "state": state,
        "cwd": data.get("cwd") or "",
        "tool": data.get("tool_name") or "",
        "ts": time.time(),
    }
    if ask:
        payload["ask"] = ask
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(payload, f)
    os.replace(tmp, path)


if __name__ == "__main__":
    main()
    sys.exit(0)
