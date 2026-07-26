# CLAUDE.md — ulanzi-plugin

"Claude Deck" — Ulanzi D200 plugin for Antonio. macOS. Marketplace-ready but currently personal. Read README.md for full architecture; this file = working rules.

## What this is

One plugin (`com.antonio.shortcuts.ulanziPlugin/`, UUID `com.antonio.deck.shortcuts`, name "Claude Deck") with 6 actions: Claude Pet (status GIFs, press = jump to session), Option Next + Option OK (answer AskUserQuestion from the deck), Claude Screen Setup (one-press big-screen toggle + hook self-setup panel), Claude Compact (two-press confirm → `/compact` into top session's terminal; bonk GIF while compacting), Claude Session Screen (big-key display; also hosts the terminal selector).

## Deploy loop (every change)

1. Edit code in this repo only — runtime copy at `~/Library/Application Support/Ulanzi/UlanziDeck/Plugins/com.antonio.shortcuts.ulanziPlugin/`
2. Syntax check: `"/Applications/Ulanzi Studio.app/Contents/MacOS/NodeJS/node" --check <file>`
3. `./install.sh` (writes outside project — ask Antonio first, every time; also runs `sync-hooks.sh`)
4. Restart rules: plugin JS/GIFs → Studio restart; `hooks/*.py` + `hooks/*.sh` → NO restart (read per run); hook entries in settings.json → claude session restart
5. Studio restart: `osascript -e 'tell application "Ulanzi Studio" to quit'; sleep 4; open -a "Ulanzi Studio"` — sometimes needs a second `open -a`; verify `ps aux | grep "[c]om.antonio.shortcuts"`

## Key facts (don't rediscover)

- Plugin ↔ Studio: WebSocket `localhost:3906`; SDK in `plugin/plugin-common-node/` — don't modify it
- UUIDs: plugin exactly 4 dot-segments, actions 5; wrong count → silent load failure. UUID immutable once marketplace-published
- State pipeline: hooks in ALL `~/.claude*` profiles → `hooks/claude-hook.py` → per-session JSON in `~/Library/Application Support/Ulanzi/UlanziDeck/claude-state/` → plugin polls (pet/opt 1s, big key 3s)
- Hook wiring: `sync-hooks.sh` (dev) OR in-panel "Enable Claude tracking" button (`plugin/hooks-setup.js`, marketplace path). Antonio's profiles: `jarvis` → `~/.claude-personal`, `jarvis-even` → `~/.claude-even`, plain → `~/.claude`
- State priority: asking > attention > compacting > working > waiting; asking/working/compacting stale >15 min → waiting; >12 h ignored
- Big key is claude-driven: shows top-priority session's project folder + state + `info` block (model/ctx_pct/branch from transcript tail, effort + window size from profile settings.json, `[1m]` → 1M); no tracked sessions → `renderNoSession()` placeholder — never query/show the focused terminal tab (leaked "node" once, stale after boot). `idx/total` counter only when 2+ sessions; no position dots
- Compacting: big key swaps ctx bar for a time-driven yellow progress bar — no real percent exists (only PreCompact fires), `min(95, 100·(1−e^(−elapsed/20)))`, holds at 95% till state flips; poll drops 3s→1s during compacting
- **Hook event-ordering protections (do not regress):**
  - PermissionRequest fires right after PreToolUse for AskUserQuestion → both map asking-tools → `asking`
  - Notification only sets attention when message contains "permission" (60s-idle notification otherwise poisoned finished sessions)
  - **Notification fires ~6s into every pending question AND auto-compact can fire mid-question — both must skip the write when existing state == asking** (options were vanishing mid-cycle before this)
  - Esc-canceling a question fires NO hook — lingers until next session event or stale rule; per-session isolation intentional
- State dir dotfiles (`.bigkey-*`, `.terminal-choice`, `.debug`) are helper files — `readStates()` skips dotfiles + invalid entries; never save non-session JSON there undotted (poisoned aggregation once → all keys stuck idle)
- Terminal adapters in `plugin/terminals.js` (iTerm2 + Terminal.app); global choice dotfile `.terminal-choice`; PI dropdown via `pi-terminal.js`; generic tty injection impossible on macOS (TIOCSTI disabled) so adapters are mandatory
- Option answering: digit via `write text ... newline NO` auto-submits (single-select); `OPT.answeredKey` suppresses re-show after deck answers. Multi-question asks: hook stores `ask.questions[]` (first mirrored top-level), deck walks tabs (digit auto-advances TUI), final "press OK to submit" screen sends Enter on the Submit tab. **multiSelect = not deck-drivable** → `renderCheckTerminal()` screen, OK jumps to terminal (TUI needs cursor-exact arrow-downs to a Submit row; desynced in practice)
- **iTerm `write text ""` is a no-op** — bare Enter = `write text return newline NO` (Ink only accepts `\r` as Enter). Ink registers ONE keypress per stdin write — never batch escape sequences in one write
- Session targeting: claude pid by cwd (`ps` + `lsof -a -p PID -d cwd -Fn`) → TTY → adapter selects session by `tty`
- Big key (slot `3_2`): Studio blocks plugins in UI; widget list compiled into signed binary. Toggle = Screen Setup key → `hooks/bigkey-toggle.sh` (quit → `patch-bigkey.py` per `.bigkey-desired` → relaunch, logged in `claude-state/bigkey-watcher.log`); `bigkey-watcher.sh` re-applies after Studio strips on page edits; widget entry round-trips via `.bigkey-widget.json`; manual fallback `./apply-bigkey.sh`
- PI selects need explicit bg+color (Studio WebView renders invisible otherwise); PI script order: constants → eventEmitter → timers → utils → ulanziApi → page scripts
- Marketplace: ugc.ulanzistudio.com self-serve; zip `.ulanziPlugin` folder at zip root ≤50MB; mac-only OK; assets drafts in `assets/store/`; icons: 256+512@2x plugin, 288 app, 20×20 white SVG category; 9 lang files exist
- Hook debug: `touch claude-state/.debug` → `claude-state/events.log`; delete `.debug` when done

## Rules

- Never touch `plugin-common-node/` or reference plugins in the Plugins dir
- GIF/PNG normalization: 196×196, aspect kept, pad `#1e1f22`, NEAREST when upscaling, preserve per-frame durations; originals → `assets/pet-sources/`, normalized → `resources/pets/`; never depend on ~/Downloads
- No hardcoded `/Users/...` paths anywhere — resolve from `$HOME`/`homedir()` (portability requirement)
- Module-level consts before use — a `PLUGIN_UUID` hoisting bug once killed startup silently; smoke-run from installed dir when startup suspect
- Re-send GIFs only on state change, never per poll tick
- Fake test states (`decktest.json`): ALWAYS delete in the same turn — a forgotten one haunted the deck as a ghost question
- Any write outside this repo (install, settings.json, profiles) = ask Antonio first, per action
