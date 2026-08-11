import { exec } from 'child_process';
import { adapter, osascript, run } from './terminals.js';

export function openApp(settings) {
  const app = (settings.app || adapter().appName).trim();
  return run('/usr/bin/open', ['-a', app]);
}

// Current terminal window position + session name. Returns {idx, total, name} or {error}.
// Checks the process first: `tell application ...` would launch the app if closed.
export async function itermSessionInfo() {
  const term = adapter();
  try {
    await run('/usr/bin/pgrep', ['-x', term.processName]);
  } catch {
    return { error: 'not running' };
  }
  try {
    const out = (await term.sessionInfo()).trim();
    const [total, idx, ...rest] = out.split('|||');
    return { total: parseInt(total, 10) || 0, idx: parseInt(idx, 10) || 0, name: rest.join('|||') };
  } catch (e) {
    return { error: 'no session' };
  }
}

// Live claude TUI processes as [{pid, tty}] (tty = '/dev/ttysNNN').
async function listClaudeProcs() {
  const ps = await new Promise((resolve) => {
    exec("ps -axo pid=,tty=,command= | grep -E '[c]laude' | grep -v ' ??'", { shell: '/bin/zsh' },
      (err, stdout) => err ? resolve('') : resolve(stdout));
  });
  const procs = [];
  for (const line of ps.split('\n')) {
    const m = line.trim().match(/^(\d+)\s+(\S+)\s+(.*)$/);
    if (m) procs.push({ pid: m[1], tty: '/dev/' + m[2] });
  }
  return procs;
}

// TTY of the claude process whose working dir is `cwd`, or null.
export async function claudeTtyByCwd(cwd) {
  try {
    for (const { pid, tty } of await listClaudeProcs()) {
      try {
        const out = await run('/usr/sbin/lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn']);
        const dir = (out.split('\n').find(l => l.startsWith('n')) || '').slice(1);
        if (dir === cwd) return tty;
      } catch { /* process gone — keep looking */ }
    }
  } catch { /* no match */ }
  return null;
}

// TTY for a session state object. Prefers the tty the hook recorded — the
// state cwd follows every `cd` the session runs while the process cwd stays
// at the launch dir, so cwd matching breaks inside subdirectories. The
// recorded tty is only trusted while a live claude still sits on it (tty
// names get reused); old state files without one fall back to cwd matching.
export async function claudeTtyForSession(s) {
  const rec = ((s && s.tty) || '').trim();
  if (rec) {
    try {
      if ((await listClaudeProcs()).some(p => p.tty === rec)) return rec;
    } catch { /* fall through to cwd */ }
  }
  return claudeTtyByCwd((s && s.cwd) || '');
}

// Type text into the terminal session with the given tty WITHOUT focusing it.
export function sendTextToTty(tty, text, newline) {
  return osascript(adapter().sendByTtyScript(tty, text, newline));
}


// Whether the active terminal can inject navigation keys (iTerm2 only).
export function canSendKeys() {
  return typeof adapter().sendKeyByTtyScript === 'function';
}

// Send `count` navigation keypresses (down/up/tab/shift-tab), one write per
// keypress with a short gap so Ink registers each. 'ok' or first failure.
export async function sendKeysToTty(tty, key, count) {
  for (let i = 0; i < count; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 120));
    const script = adapter().sendKeyByTtyScript(tty, key);
    if (!script) return 'unsupported';
    const out = (await osascript(script)).trim();
    if (out !== 'ok') return out;
  }
  return 'ok';
}

// Focus the terminal running the given claude session (state object with
// tty/cwd). Falls back to just activating the terminal app.
export async function focusClaudeSession(s) {
  const term = adapter();
  const tty = await claudeTtyForSession(s);
  if (tty) {
    try {
      const out = await osascript(term.focusByTtyScript(tty));
      if (out.trim() === 'ok') return;
    } catch { /* fall through */ }
  }
  return osascript(`tell application "${term.asAppName}" to activate`);
}

export async function itermCycle(settings) {
  const term = adapter();
  await osascript(`tell application "${term.asAppName}" to activate`);
  const mode = settings.mode === 'tabs' ? 'tabs' : 'windows';
  const keys = mode === 'tabs'
    ? 'key code 30 using {command down, shift down}' // cmd+shift+] next tab
    : 'key code 50 using command down';              // cmd+` next window
  return osascript(`tell application "System Events" to ${keys}`);
}
