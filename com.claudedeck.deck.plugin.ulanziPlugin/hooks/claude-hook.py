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


def session_info(data):
    """Extra display data for the big key: model, context usage, branch, effort.

    Model + tokens + branch come from the tail of the session transcript;
    effort and the context-window size come from the profile's settings.json
    (the hook inherits CLAUDE_CONFIG_DIR from the claude process).
    """
    info = {}
    tp = data.get("transcript_path") or ""
    try:
        with open(tp, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - 65536))
            tail = f.read().decode("utf-8", "replace")
        for line in reversed(tail.splitlines()):
            if not line.startswith("{"):
                continue  # partial first line of the tail window
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            if "branch" not in info and rec.get("gitBranch"):
                info["branch"] = rec["gitBranch"]
            if "model" not in info and rec.get("type") == "assistant":
                msg = rec.get("message") or {}
                u = msg.get("usage") or {}
                used = ((u.get("input_tokens") or 0)
                        + (u.get("cache_read_input_tokens") or 0)
                        + (u.get("cache_creation_input_tokens") or 0))
                if used:
                    info["model"] = (msg.get("model") or "").replace("claude-", "")
                    info["ctx_used"] = used
            if "model" in info and "branch" in info:
                break
    except OSError:
        pass

    limit = 200000
    cfg = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.expanduser("~/.claude")
    try:
        s = json.load(open(os.path.join(cfg, "settings.json")))
        if s.get("effortLevel"):
            info["effort"] = s["effortLevel"]
        if "[1m]" in (s.get("model") or ""):
            limit = 1000000
    except (OSError, ValueError):
        pass
    if info.get("ctx_used"):
        # settings.json only knows the profile default model; a 1M model picked
        # per-session is invisible there. But usage can never exceed the window,
        # so anything past 200k proves the session runs the 1M variant.
        if info["ctx_used"] > 200000:
            limit = 1000000
        info["ctx_pct"] = min(100, int(round(info["ctx_used"] * 100.0 / limit)))
    return info or None


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
        if data.get("tool_name") == "ExitPlanMode":
            # the plan-approval options are generated by the CLI, not passed in
            # tool_input, so synthesize them (digits map to the TUI's numbering)
            q = {
                "question": "Claude wrote a plan - proceed?",
                "header": "Plan",
                "options": [
                    "Yes, bypass permissions",
                    "Yes, manually approve edits",
                    "No, refine with Ultraplan on the web",
                    "Tell Claude what to change",
                ],
                "multiSelect": False,
            }
            ask = dict(q)
            ask["questions"] = [q]
        if data.get("tool_name") == "AskUserQuestion":
            try:
                questions = [{
                    "question": q.get("question") or "",
                    "header": q.get("header") or "",
                    "options": [o.get("label") or "" for o in q.get("options", [])],
                    "multiSelect": bool(q.get("multiSelect")),
                } for q in (data.get("tool_input") or {}).get("questions", [])]
                if questions:
                    # first question mirrored top-level for older readers
                    ask = dict(questions[0])
                    ask["questions"] = questions
                else:
                    ask = None
            except (AttributeError, TypeError):
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
    info = session_info(data)
    if info:
        payload["info"] = info
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(payload, f)
    os.replace(tmp, path)


if __name__ == "__main__":
    main()
    sys.exit(0)
