# Claude Deck — Ulanzi D200 plugin

Claude Code on the Ulanzi Deck D200 (macOS): live status pet, answer Claude's questions from deck keys, and a big-screen session display. Fully portable (no hardcoded paths) and marketplace-ready.

## How it works

Ulanzi Studio scans `~/Library/Application Support/Ulanzi/UlanziDeck/Plugins/`, launches the plugin's `plugin/app.js` with its bundled Node.js (`127.0.0.1 3906 <lang>`), and talks WebSocket on `localhost:3906`. SDK client in `plugin/plugin-common-node/`.

Claude Code state comes from **hooks**: `hooks/claude-hook.py` runs on every Claude event → one JSON state file per session in `~/Library/Application Support/Ulanzi/UlanziDeck/claude-state/` → plugin polls (pet/opt keys 1 s, big key 3 s). Hooks are wired into every `~/.claude*` profile by `sync-hooks.sh` (runs on install) **or** self-served from the plugin's settings panel ("Enable Claude tracking" button — marketplace installs need no scripts).

## Actions (5)

| Action | What it does |
|---|---|
| **Claude Pet** | Status GIF across all sessions (or one project via dir filter). Press = jump to the session needing you (by TTY). |
| **Claude Option Next** | Cycle the options Claude is asking (shown on big key). Wave GIF when a question is live, dancing when idle. |
| **Claude Option OK** | Answer with the shown option — types the digit into that exact terminal session, no focus steal, auto-submits. Idea GIF live / sparkle idle. |
| **Claude Screen Setup** | One-press toggle of the big screen: Claude status ↔ built-in widget. Studio restarts itself (~15 s). Icons: approved = showing, jam = hidden, loading = applying. Panel hosts the hook-setup button. |
| **Claude Session Screen** | The big-key display: top-priority Claude session — project name, status badge, `model · effort · branch` row and a colored context bar — plus the question picker when asking and a confirm flash after OK. Shows a "no session" placeholder when nothing is tracked (never the stale terminal name). Placed on the big key by Screen Setup. Panel hosts the terminal selector. |

All small keys show the fail image when no claude session is tracked.

The session screen is **claude-driven, not terminal-driven**: the name is the session's project folder from Claude state (the focused terminal tab used to leak names like "node"). The extra info comes from the hook's `session_info()`: model + context tokens + git branch parsed from the tail of the session transcript, effort + context-window size from the profile's `settings.json` (`[1m]` in the model id → 1 M window, else 200 k). Context bar: green < 60 %, yellow < 85 %, red above.

## State pipeline

Priority: **asking > attention > compacting > working > waiting**. Stale: asking/working/compacting >15 min → waiting; files >12 h ignored; SessionEnd deletes.

| State | Hook events |
|---|---|
| working | UserPromptSubmit, PreToolUse, PostToolUse |
| compacting | PreCompact |
| asking | PreToolUse **or** PermissionRequest of AskUserQuestion/ExitPlanMode (options captured from `tool_input`) |
| attention | PermissionRequest (other tools); Notification only when message mentions "permission" |
| waiting | Stop, SessionStart |

**Event-ordering bugs fixed in the hook (do not regress):**
1. PermissionRequest fires ~0 s after PreToolUse for AskUserQuestion → must also map to `asking` or options get wiped
2. Notification fires for 60 s-idle → only permission messages may set attention
3. **A Notification fires ~6 s into every pending question (message mentions permission) and auto-compact can fire mid-question → neither may overwrite `asking`** (hook checks existing state first)
4. Canceling a question (Esc) fires NO hook — state clears on next session event or the 15-min stale rule; per-session isolation is intentional

## Terminal support

Adapter layer (`plugin/terminals.js`): all terminal-specific AppleScript isolated. Supported: **iTerm2, Terminal.app** — auto-detected, chosen via dropdown in the Pet / Session Screen panels (global, stored in `claude-state/.terminal-choice`, survives reinstalls). Default: iTerm2 if installed, else Terminal.app. Adding kitty/WezTerm/tmux = one adapter object each. Fully terminal-agnostic operation is impossible on macOS (no generic tty input injection — TIOCSTI is disabled), which is why adapters exist.

## The big key (458×196, slot 3_2)

Studio hard-wires the slot to its built-in widget; the widget mode list is compiled into the signed binary — not extensible, plugins can't be dragged there. Managed instead by **Claude Screen Setup**: press → `hooks/bigkey-toggle.sh` (detached) quits Studio, `hooks/patch-bigkey.py` patches per the `.bigkey-desired` flag, relaunches with retries; all logged to `claude-state/bigkey-watcher.log`. On show, the replaced widget entry is saved (`.bigkey-widget.json`) and restored exactly on hide — restoring a background-empty mode leaves a stale frame that looks like a failed hide. `hooks/bigkey-watcher.sh` re-applies after Studio strips the key on page edits. Manual fallback: `./apply-bigkey.sh`.

## Install / update (dev loop)

```sh
./install.sh   # rsync plugin + npm install + sync-hooks.sh across all profiles
```

Quit + relaunch Studio (sometimes needs a second `open -a "Ulanzi Studio"`).

Restart rules: plugin JS/GIFs → Studio restart · `hooks/*.py`/`*.sh` → nothing (read per run) · hook entries in settings.json → claude session restart.

macOS permissions (one-time): Accessibility for Ulanzi Studio + Automation → chosen terminal.

## Marketplace publishing (ugc.ulanzistudio.com)

Self-serve portal: register → Upload Works → Plugins → zip of the `.ulanziPlugin` folder (≤50 MB, folder at zip root) → review → published. Mac-only accepted. UUID immutable after publishing.

Ready: hooks self-setup in-panel · icons per spec (256 + 512@2x plugin, 288 app, 20×20 white SVG category) · 9 language files · listing asset drafts in `assets/store/` (1:1 cover, 3:2 banners, 366×244 gallery). Verify GIF art ownership before submitting (IP policy). Unofficial fast lane: narlei's Community Store (GitHub release + repo URL).

## Debugging

- Hook event log: `touch claude-state/.debug` → `claude-state/events.log` (delete `.debug` after — and always delete any fake `decktest.json`)
- Test hook: pipe fake event JSON into `hooks/claude-hook.py`, inspect `claude-state/<sid>.json`
- Which profile a running claude uses: `ps eww <pid> | grep -o 'CLAUDE_CONFIG_DIR=[^ ]*'`
- Plugin process: `ps aux | grep com.antonio.shortcuts`

## Gotchas (hard-won)

- Plugin UUID exactly 4 dot-segments lowercase; action UUIDs 5+; wrong count = silent load failure
- Manifest icons: PNG (or SVG for category/action list); runtime accepts SVG/PNG/GIF data URLs
- `package.json` needs `"type": "module"`; module-level consts before use (hoisting bug once killed startup silently)
- State dir holds helper dotfiles — `readStates()` skips dotfiles and invalid entries; never put non-session JSON there without a leading dot (a widget backup once poisoned aggregation → everything stuck idle)
- PI `select` needs explicit background+color (Studio WebView renders invisible text otherwise); script order: constants → eventEmitter → timers → utils → ulanziApi → page scripts
- Re-send GIFs only on state change — device loops them
- After a deck answer, `OPT.answeredKey` suppresses re-showing that question while state catches up
- GIF/PNG normalization: 196×196, aspect kept, pad `#1e1f22`, NEAREST upscale (pixel art), preserve durations; originals in `assets/pet-sources/`, normalized in `resources/pets/`
