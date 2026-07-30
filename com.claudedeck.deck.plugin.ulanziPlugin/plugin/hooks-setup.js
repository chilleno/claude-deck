// Self-contained Claude Code hook setup (marketplace installs don't run any
// install script, so the plugin must wire its own hooks — with user consent
// from the property inspector).
import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const HOOK_SCRIPT = join(__dirname, '../hooks/claude-hook.py');
const CMD = `python3 '${HOOK_SCRIPT}'`;

const EVENTS = [
  'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PreCompact',
  'Stop', 'Notification', 'SessionStart', 'SessionEnd', 'PermissionRequest',
];

// every ~/.claude* dir with a settings.json is a Claude profile
export function findProfiles() {
  const home = homedir();
  const profiles = [];
  for (const entry of readdirSync(home)) {
    if (!entry.startsWith('.claude')) continue;
    const settings = join(home, entry, 'settings.json');
    if (existsSync(settings)) profiles.push(settings);
  }
  return profiles;
}

function hasOurHook(data) {
  const hooks = data.hooks || {};
  return EVENTS.every(ev =>
    (hooks[ev] || []).some(b => (b.hooks || []).some(h => (h.command || '').includes('claude-hook.py')))
  );
}

// {installed: n, missing: n} — how many profiles already have the hooks
export function hookStatus() {
  let installed = 0;
  let missing = 0;
  for (const settings of findProfiles()) {
    try {
      const data = JSON.parse(readFileSync(settings, 'utf8'));
      if (hasOurHook(data)) installed += 1;
      else missing += 1;
    } catch {
      missing += 1;
    }
  }
  return { installed, missing };
}

// inject hook entries into every profile (idempotent, backs up changed files)
export function installHooks() {
  const results = [];
  for (const settings of findProfiles()) {
    try {
      const data = JSON.parse(readFileSync(settings, 'utf8'));
      const hooks = data.hooks = data.hooks || {};
      let added = false;
      for (const ev of EVENTS) {
        const blocks = hooks[ev] = hooks[ev] || [];
        const present = blocks.some(b => (b.hooks || []).some(h => (h.command || '').includes('claude-hook.py')));
        if (present) continue;
        let target = blocks.find(b => (b.matcher || '') === '');
        if (!target) {
          target = { matcher: '', hooks: [] };
          blocks.push(target);
        }
        target.hooks.push({ type: 'command', command: CMD, timeout: 5 });
        added = true;
      }
      if (added) {
        copyFileSync(settings, settings + '.bak-claudedeck');
        writeFileSync(settings, JSON.stringify(data, null, 2));
        results.push({ settings, changed: true });
      } else {
        results.push({ settings, changed: false });
      }
    } catch (e) {
      results.push({ settings, error: e?.message });
    }
  }
  return results;
}
