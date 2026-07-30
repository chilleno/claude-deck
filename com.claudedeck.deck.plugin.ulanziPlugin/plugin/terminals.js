// Terminal adapters: every terminal-specific operation lives here.
// The active terminal is a global choice stored in a dotfile (survives
// reinstalls; dotfiles are ignored by the claude-state session reader).
import { execFile } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CHOICE_FILE = join(
  homedir(),
  'Library/Application Support/Ulanzi/UlanziDeck/claude-state/.terminal-choice'
);

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr?.trim() || err.message));
      else resolve(stdout);
    });
  });
}

function osascript(script) {
  return run('/usr/bin/osascript', ['-e', script]);
}

function asQuote(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

// ---- iTerm2 -------------------------------------------------------------

const iterm2 = {
  id: 'iterm2',
  name: 'iTerm2',
  appName: 'iTerm',      // for `open -a`
  asAppName: 'iTerm2',   // for AppleScript `tell application`
  installed: () => existsSync('/Applications/iTerm.app'),
  processName: 'iTerm2',

  async sessionInfo() {
    const script = [
      'tell application "iTerm2"',
      '  set t to count of windows',
      '  if t = 0 then return "0|||0|||no windows"',
      '  set cw to current window',
      '  set i to 0',
      '  set idx to 0',
      '  repeat with w in windows',
      '    set i to i + 1',
      '    if id of w = id of cw then set idx to i',
      '  end repeat',
      '  set n to name of current session of cw',
      '  return (t as text) & "|||" & (idx as text) & "|||" & n',
      'end tell',
    ].join('\n');
    return osascript(script);
  },

  focusByTtyScript(tty) {
    return [
      'tell application "iTerm2"',
      '  activate',
      '  repeat with w in windows',
      '    repeat with t in tabs of w',
      '      repeat with s in sessions of t',
      `        if tty of s is ${asQuote(tty)} then`,
      '          select w',
      '          select t',
      '          select s',
      '          return "ok"',
      '        end if',
      '      end repeat',
      '    end repeat',
      '  end repeat',
      'end tell',
    ].join('\n');
  },

  sendByTtyScript(tty, text, newline) {
    // empty `write text ""` is a no-op in iTerm — a bare Enter must be sent
    // as an explicit carriage return (AppleScript `return` constant)
    const write = text === ''
      ? 'write text return newline NO'
      : `write text ${asQuote(text)}${newline ? '' : ' newline NO'}`;
    return [
      'tell application "iTerm2"',
      '  repeat with w in windows',
      '    repeat with t in tabs of w',
      '      repeat with s in sessions of t',
      `        if tty of s is ${asQuote(tty)} then`,
      `          tell s to ${write}`,
      '          return "ok"',
      '        end if',
      '      end repeat',
      '    end repeat',
      '  end repeat',
      '  return "notfound"',
      'end tell',
    ].join('\n');
  },

};

// ---- Terminal.app -------------------------------------------------------

const terminalApp = {
  id: 'terminal',
  name: 'Terminal.app',
  appName: 'Terminal',
  asAppName: 'Terminal',
  installed: () => existsSync('/System/Applications/Utilities/Terminal.app') || existsSync('/Applications/Utilities/Terminal.app'),
  processName: 'Terminal',

  async sessionInfo() {
    const script = [
      'tell application "Terminal"',
      '  set t to count of windows',
      '  if t = 0 then return "0|||0|||no windows"',
      '  set cw to front window',
      '  set n to name of cw',
      '  return (t as text) & "|||1|||" & n',
      'end tell',
    ].join('\n');
    return osascript(script);
  },

  focusByTtyScript(tty) {
    return [
      'tell application "Terminal"',
      '  activate',
      '  repeat with w in windows',
      '    repeat with tb in tabs of w',
      `      if tty of tb is ${asQuote(tty)} then`,
      '        set selected tab of w to tb',
      '        set index of w to 1',
      '        return "ok"',
      '      end if',
      '    end repeat',
      '  end repeat',
      'end tell',
    ].join('\n');
  },

  sendByTtyScript(tty, text, newline) {
    // Terminal.app's `do script` always appends a newline; the TUI picker
    // auto-submits on the digit anyway, the extra newline is swallowed.
    return [
      'tell application "Terminal"',
      '  repeat with w in windows',
      '    repeat with tb in tabs of w',
      `      if tty of tb is ${asQuote(tty)} then`,
      `        do script ${asQuote(text)} in tb`,
      '        return "ok"',
      '      end if',
      '    end repeat',
      '  end repeat',
      '  return "notfound"',
      'end tell',
    ].join('\n');
  },

};

const ADAPTERS = { iterm2, terminal: terminalApp };

export function detectTerminals() {
  return Object.values(ADAPTERS)
    .filter(a => a.installed())
    .map(a => ({ id: a.id, name: a.name }));
}

export function getTerminalChoice() {
  try {
    const id = readFileSync(CHOICE_FILE, 'utf8').trim();
    if (ADAPTERS[id] && ADAPTERS[id].installed()) return id;
  } catch { /* default below */ }
  return ADAPTERS.iterm2.installed() ? 'iterm2' : 'terminal';
}

export function setTerminalChoice(id) {
  if (!ADAPTERS[id]) return false;
  try {
    writeFileSync(CHOICE_FILE, id);
    return true;
  } catch {
    return false;
  }
}

export function adapter() {
  return ADAPTERS[getTerminalChoice()];
}

export { osascript, asQuote, run };
