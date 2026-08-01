# Changelog — Claude Deck

Version lives in `com.claudedeck.deck.plugin.ulanziPlugin/manifest.json` (`Version`).
Rule: every user-visible change bumps the version here **and** in the manifest
(patch = fix/tweak, minor = new action/feature, major = breaking/UUID-level).
Store zips are built from this version.

## 2.0.3 — 2026-07-31

- Guideline compliance (Ulanzi publication guidelines, bbs tid=464): manifest `Overview` one-liner, `Banner` array with banners bundled in the package (`resources/banners/`), `Name` added to every action's States entry; `pnpm-lock.yaml` excluded from the store zip

## 2.0.2 — 2026-07-31

- Security: bump `ws` 8.18.0 → 8.21.0 (memory-exhaustion DoS + uninitialized memory disclosure advisories; low practical risk — socket only talks to Studio on localhost)
- package.json license field fixed to MIT

## 2.0.1 — 2026-07-31

- Fix: context bar stuck at 100 % for 1M-window sessions picked per-session (profile settings.json doesn't know the model) — usage above 200k now proves the 1M window and rescales the percent

## 2.0.0 — 2026-07-31

- **Breaking: plugin UUID renamed** `com.antonio.deck.shortcuts` → `com.claudedeck.deck.plugin` (all action UUIDs follow; folder renamed to `com.claudedeck.deck.plugin.ulanziPlugin`). Done before first marketplace publish — the UUID is immutable afterwards. Existing manual installs must remove the old plugin folder, install the new zip, and re-add keys.

## 1.2.1 — 2026-07-27

- Fix: plan-approval prompts (ExitPlanMode) now show on the deck question picker — the hook synthesizes the CLI's 4 plan options (they aren't passed in tool_input), digits map to the TUI numbering

## 1.2.0 — 2026-07-26

- **New action: Claude Compact** — two-press confirm, types `/compact` into the top session's terminal; bonk GIF while compacting
- **New action: Claude Session Switch** — pins and cycles tracked sessions (one way, wraps); big key and Compact follow the pin
- Compaction progress bar on the big key (time-driven, parks at 95 %) with 1 s polling while compacting
- Multi-question AskUserQuestion support: tabbed asks answered from the deck, final "press OK to submit" screen
- multiSelect asks: "answer in the terminal" screen, OK jumps to that session
- Pin-aware question picking: with several sessions asking, the switch key chooses which question shows/answers first
- Big-key layout cleanup: bigger name/info/bars, dots removed, session counter only with 2+ sessions
- 7 actions total (was 5)

## 1.1.0 — 2026-07-24

- First marketplace submission (ugc.ulanzistudio.com), 5 actions: Claude Pet, Option Next, Option OK, Screen Setup, Session Screen
- Claude-driven big-key display: project name, state badge, model · effort · branch, colored context bar
- In-panel "Enable Claude tracking" hook self-setup (marketplace installs need no scripts)
- Terminal adapter layer (iTerm2 + Terminal.app) with global choice dropdown
- 9 language files, store listing assets
