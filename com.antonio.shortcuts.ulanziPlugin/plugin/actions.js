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

// TTY of the claude process whose working dir is `cwd`, or null.
export async function claudeTtyByCwd(cwd) {
  try {
    const ps = await new Promise((resolve) => {
      exec("ps -axo pid=,tty=,command= | grep -E '[c]laude' | grep -v ' ??'", { shell: '/bin/zsh' },
        (err, stdout) => err ? resolve('') : resolve(stdout));
    });
    for (const line of ps.split('\n')) {
      const m = line.trim().match(/^(\d+)\s+(\S+)\s+(.*)$/);
      if (!m) continue;
      const [, pid, ptty] = m;
      try {
        const out = await run('/usr/sbin/lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn']);
        const dir = (out.split('\n').find(l => l.startsWith('n')) || '').slice(1);
        if (dir === cwd) return '/dev/' + ptty;
      } catch { /* process gone — keep looking */ }
    }
  } catch { /* no match */ }
  return null;
}

// Type text into the terminal session with the given tty WITHOUT focusing it.
export function sendTextToTty(tty, text, newline) {
  return osascript(adapter().sendByTtyScript(tty, text, newline));
}

// Focus the terminal session running the claude whose working dir is `cwd`.
// Falls back to just activating the terminal app.
export async function focusItermByCwd(cwd) {
  const term = adapter();
  const tty = await claudeTtyByCwd(cwd);
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
