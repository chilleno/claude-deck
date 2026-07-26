# Changelog — Claude Deck

Version lives in `com.antonio.shortcuts.ulanziPlugin/manifest.json` (`Version`).
Rule: every user-visible change bumps the version here **and** in the manifest
(patch = fix/tweak, minor = new action/feature, major = breaking/UUID-level).
Store zips are built from this version.

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
