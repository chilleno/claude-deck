// Self-contained Claude Code hook setup (marketplace installs don't run any
// install script, so the plugin must wire its own hooks — with user consent
// from the property inspector).
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync, copyFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const HOOK_JS = join(__dirname, '../hooks/claude-hook.js');
const HOOK_PY = join(__dirname, '../hooks/claude-hook.py');

// Which interpreter the hook is registered with. Node first: the plugin is
// already running on the copy Ulanzi Studio ships, so process.execPath is an
// absolute path that is guaranteed to exist on the user's machine. python3 is
// the fallback — on a clean consumer Mac /usr/bin/python3 is only a stub that
// opens the Xcode Command Line Tools installer, which is exactly the silent
// failure this avoids. Paths are quoted: Studio lives under "Ulanzi Studio.app".
export function hookCommand() {
  const node = process.execPath;
  if (node && existsSync(node) && existsSync(HOOK_JS)) return `'${node}' '${HOOK_JS}'`;
  return `python3 '${HOOK_PY}'`;
}

// any command line of ours, current or from an older version
function isOurHook(command) {
  return (command || '').includes('claude-hook.');
}

const EVENTS = [
  'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PreCompact',
  'Stop', 'Notification', 'SessionStart', 'SessionEnd', 'PermissionRequest',
];

// Claude Code can be installed without ever having been run, and a profile
// directory can exist before its settings.json does — so "is it installed"
// and "which profiles can take hooks" are two different questions.

// every ~/.claude* directory in $HOME, settings.json or not
export function findProfileDirs() {
  const home = homedir();
  const dirs = [];
  let entries;
  try {
    entries = readdirSync(home);
  } catch {
    return dirs;
  }
  for (const entry of entries) {
    if (!entry.startsWith('.claude')) continue;
    const path = join(home, entry);
    try {
      if (statSync(path).isDirectory()) dirs.push(path);
    } catch { /* unreadable — skip */ }
  }
  return dirs.sort();
}

// settings.json paths for the profiles that already have one
export function findProfiles() {
  return findProfileDirs()
    .map(dir => join(dir, 'settings.json'))
    .filter(existsSync);
}

// `claude` on the user's login PATH — the plugin is launched by Studio, whose
// environment has none of the shell's PATH additions (nvm, homebrew, ~/.local)
// a hit is cached for good; a miss only briefly, so installing Claude Code
// while Studio runs is picked up without a restart
let binaryCache = null;
let binaryCacheUntil = 0;
export function findClaudeBinary() {
  if (binaryCache) return binaryCache;
  if (binaryCache === '' && Date.now() < binaryCacheUntil) return '';
  const candidates = [
    join(homedir(), '.local/bin/claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ];
  for (const path of candidates) {
    if (existsSync(path)) return (binaryCache = path);
  }
  // escape hatch for tests and for support cases where spawning a login shell
  // is unwanted; set CLAUDEDECK_NO_PROBE=1 to answer from the filesystem alone
  if (process.env.CLAUDEDECK_NO_PROBE === '1') {
    binaryCacheUntil = Date.now() + 30000;
    return (binaryCache = '');
  }
  try {
    // login shell so nvm/asdf/homebrew shims are on PATH like they are for the user
    const out = spawnSync('/bin/zsh', ['-lc', 'command -v claude'], { encoding: 'utf8', timeout: 4000 });
    const path = (out.stdout || '').trim().split('\n')[0];
    if (path && existsSync(path)) return (binaryCache = path);
  } catch { /* shell probe failed — fall through */ }
  binaryCacheUntil = Date.now() + 30000;
  return (binaryCache = '');
}

// Is Claude Code on this machine at all? Answered from the cheapest evidence
// up: a profile with settings, a profile directory, the per-user config file,
// then the binary itself.
export function claudeInstalled() {
  if (findProfiles().length) return { installed: true, how: 'profile' };
  if (findProfileDirs().length) return { installed: true, how: 'dir' };
  if (existsSync(join(homedir(), '.claude.json'))) return { installed: true, how: 'config' };
  const bin = findClaudeBinary();
  if (bin) return { installed: true, how: 'binary', path: bin };
  return { installed: false, how: null };
}

// Profiles the hooks can be written into: existing settings.json files, plus
// any profile directory still missing one. With Claude Code installed but no
// profile directory at all, ~/.claude is the one to create.
export function hookTargets() {
  const targets = findProfileDirs().map(dir => join(dir, 'settings.json'));
  if (targets.length) return targets;
  if (claudeInstalled().installed) return [join(homedir(), '.claude/settings.json')];
  return [];
}

function hasOurHook(data) {
  const hooks = data.hooks || {};
  return EVENTS.every(ev =>
    (hooks[ev] || []).some(b => (b.hooks || []).some(h => isOurHook(h.command)))
  );
}

// wired, but with a command line this version no longer uses (e.g. the python
// hook from <= 2.3.0) — the panel offers an update rather than nagging about a
// missing setup
function hasStaleHook(data) {
  const want = hookCommand();
  const hooks = data.hooks || {};
  return EVENTS.some(ev =>
    (hooks[ev] || []).some(b => (b.hooks || []).some(h => isOurHook(h.command) && h.command !== want))
  );
}

// {installed: n, missing: n, claude: {...}} — how many profiles have the hooks,
// plus what we know about the Claude Code install itself. `installed` and
// `missing` keep their old meaning so the property inspector needs no changes.
export function hookStatus() {
  const claude = claudeInstalled();
  let installed = 0;
  let missing = 0;
  let outdated = 0;
  for (const settings of hookTargets()) {
    if (!existsSync(settings)) { missing += 1; continue; } // profile dir without settings.json
    try {
      const data = JSON.parse(readFileSync(settings, 'utf8'));
      if (hasOurHook(data)) {
        installed += 1;
        if (hasStaleHook(data)) outdated += 1;
      } else {
        missing += 1;
      }
    } catch {
      missing += 1;
    }
  }
  return { installed, missing, outdated, claude, command: hookCommand() };
}

// inject hook entries into every profile (idempotent, backs up changed files,
// creates settings.json — and its directory — when the profile has none yet)
export function installHooks() {
  const results = [];
  for (const settings of hookTargets()) {
    try {
      let data = {};
      const existed = existsSync(settings);
      if (existed) {
        data = JSON.parse(readFileSync(settings, 'utf8'));
      } else {
        mkdirSync(dirname(settings), { recursive: true });
      }
      const hooks = data.hooks = data.hooks || {};
      const CMD = hookCommand();
      let added = false;
      for (const ev of EVENTS) {
        const blocks = hooks[ev] = hooks[ev] || [];
        // upgrade any entry of ours that still carries an old command line
        // (python hook, or a Studio installed at a different path), and drop
        // duplicates so re-running never stacks them up
        let seen = false;
        for (const b of blocks) {
          b.hooks = (b.hooks || []).filter(h => {
            if (!isOurHook(h.command)) return true;
            if (seen) { added = true; return false; } // duplicate — remove
            seen = true;
            if (h.command !== CMD) { h.command = CMD; added = true; } // upgrade
            return true;
          });
        }
        if (seen) continue;
        let target = blocks.find(b => (b.matcher || '') === '');
        if (!target) {
          target = { matcher: '', hooks: [] };
          blocks.push(target);
        }
        target.hooks.push({ type: 'command', command: CMD, timeout: 5 });
        added = true;
      }
      if (added) {
        if (existed) copyFileSync(settings, settings + '.bak-claudedeck');
        writeFileSync(settings, JSON.stringify(data, null, 2));
        results.push({ settings, changed: true, created: !existed });
      } else {
        results.push({ settings, changed: false });
      }
    } catch (e) {
      results.push({ settings, error: e?.message });
    }
  }
  return results;
}
