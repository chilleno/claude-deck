#!/usr/bin/env node
/* Claude Code hook: records session state for the Ulanzi Deck plugin.
 *
 * Node port of claude-hook.py, kept byte-compatible with it: same state files,
 * same event handling, same ordering protections. It exists because a clean
 * consumer Mac has no usable python3 (/usr/bin/python3 is a stub that pops the
 * Xcode Command Line Tools installer), while the Node that Ulanzi Studio ships
 * is always present — the plugin registers this hook with that interpreter's
 * absolute path, and falls back to the python version when it can't.
 *
 * Wired into every ~/.claude profile's settings.json for UserPromptSubmit,
 * PreToolUse, PostToolUse, PreCompact, Stop, Notification, SessionStart,
 * SessionEnd and PermissionRequest. Reads the hook JSON from stdin and writes
 * one state file per Claude session; the plugin polls these to animate keys.
 */
// ESM: the plugin package is "type": "module", so this file is loaded as one
import fs from 'fs';
import os from 'os';
import path from 'path';
import tty from 'tty';
import { spawnSync } from 'child_process';

const STATE_DIR = path.join(
  os.homedir(),
  'Library/Application Support/Ulanzi/UlanziDeck/claude-state'
);

const STATE_MAP = {
  UserPromptSubmit: 'working',
  PreToolUse: 'working',
  PostToolUse: 'working',
  PreCompact: 'compacting',
  Stop: 'waiting',
  SessionStart: 'waiting',
  Notification: 'attention',
  PermissionRequest: 'attention',
};

// tools that mean Claude is asking the user something
const ASKING_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode']);

/* Extra display data for the big key: model, context usage, branch, effort.
 *
 * Model + tokens + branch come from the tail of the session transcript;
 * effort and the context-window size come from the profile's settings.json
 * (the hook inherits CLAUDE_CONFIG_DIR from the claude process). */
function sessionInfo(data) {
  const info = {};
  const tp = data.transcript_path || '';
  try {
    const fd = fs.openSync(tp, 'r');
    try {
      const size = fs.fstatSync(fd).size;
      const start = Math.max(0, size - 65536);
      const buf = Buffer.alloc(size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      const lines = buf.toString('utf8').split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line.startsWith('{')) continue; // partial first line of the tail window
        let rec;
        try {
          rec = JSON.parse(line);
        } catch {
          continue;
        }
        if (!('branch' in info) && rec.gitBranch) info.branch = rec.gitBranch;
        if (!('model' in info) && rec.type === 'assistant') {
          const msg = rec.message || {};
          const u = msg.usage || {};
          const used = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) +
            (u.cache_creation_input_tokens || 0);
          if (used) {
            info.model = String(msg.model || '').replace('claude-', '');
            info.ctx_used = used;
          }
        }
        if ('model' in info && 'branch' in info) break;
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch { /* no transcript yet — the key just shows less */ }

  let limit = 200000;
  const cfg = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  try {
    const s = JSON.parse(fs.readFileSync(path.join(cfg, 'settings.json'), 'utf8'));
    if (s.effortLevel) info.effort = s.effortLevel;
    if (String(s.model || '').includes('[1m]')) limit = 1000000;
  } catch { /* no settings.json — defaults stand */ }
  if (info.ctx_used) {
    // settings.json only knows the profile default model; a 1M model picked
    // per-session is invisible there. But usage can never exceed the window,
    // so anything past 200k proves the session runs the 1M variant.
    if (info.ctx_used > 200000) limit = 1000000;
    info.ctx_pct = Math.min(100, Math.round(info.ctx_used * 100 / limit));
  }
  return Object.keys(info).length ? info : null;
}

/* Controlling terminal of this hook = the claude process's terminal.
 *
 * Recorded so the plugin can target the session by tty directly — the cwd in
 * hook events follows every `cd` the session runs, while the claude process
 * cwd stays at the launch dir, so cwd matching breaks whenever a session works
 * inside a subdirectory (deck keys went dead intermittently). */
function ownTty() {
  for (const fd of [0, 1, 2]) {
    try {
      if (!tty.isatty(fd)) continue;
      const name = fs.realpathSync('/dev/fd/' + fd);
      if (name && name.startsWith('/dev/') && name !== '/dev/tty') return name;
    } catch { /* not a tty — try the next one */ }
  }
  try {
    const fd = fs.openSync('/dev/tty', 'r');
    try {
      const name = fs.realpathSync('/dev/fd/' + fd);
      if (name && name !== '/dev/tty') return name;
    } finally {
      fs.closeSync(fd);
    }
  } catch { /* no controlling terminal */ }
  // hooks run detached from the terminal (fds are pipes, no controlling tty),
  // but the claude TUI a few ppid hops up still holds it — walk up
  try {
    let pid = process.pid;
    for (let i = 0; i < 8; i++) {
      const out = spawnSync('ps', ['-o', 'tty=', '-o', 'ppid=', '-p', String(pid)],
        { encoding: 'utf8', timeout: 3000 });
      const parts = (out.stdout || '').split(/\s+/).filter(Boolean);
      if (parts.length < 2) break;
      const [ttyName, ppid] = parts;
      if (ttyName !== '??') return '/dev/' + ttyName;
      pid = parseInt(ppid, 10);
      if (!pid || pid <= 1) break;
    }
  } catch { /* ps unavailable — give up, the plugin falls back to cwd */ }
  return '';
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return;
  }

  const sid = data.session_id || 'unknown';
  const event = data.hook_event_name || '';
  const file = path.join(STATE_DIR, sid + '.json');

  if (process.env.ULANZI_HOOK_DEBUG || fs.existsSync(path.join(STATE_DIR, '.debug'))) {
    try {
      fs.appendFileSync(path.join(STATE_DIR, 'events.log'),
        `${Math.floor(Date.now() / 1000)} ${event} tool=${data.tool_name || '-'} ` +
        `keys=${Object.keys(data).sort().join(',')}\n`);
    } catch { /* debug only */ }
  }

  if (event === 'SessionEnd') {
    try {
      fs.unlinkSync(file);
    } catch { /* already gone */ }
    return;
  }

  let state = STATE_MAP[event];
  if (!state) return;
  if (event === 'Notification') {
    // Notification also fires for the 60s-idle "waiting for your input"
    // message — that must not flip a finished session back to attention.
    if (!String(data.message || '').toLowerCase().includes('permission')) return;
  }
  if (event === 'Notification' || event === 'PreCompact') {
    // neither a notification (fires ~6s into a pending question, message
    // mentions permission) nor auto-compact may wipe the asking state —
    // the question is still on screen waiting for an answer
    try {
      if (readJson(file).state === 'asking') return;
    } catch { /* no state file yet */ }
  }

  let ask = null;
  if ((event === 'PreToolUse' || event === 'PermissionRequest') && ASKING_TOOLS.has(data.tool_name || '')) {
    state = 'asking';
    if (data.tool_name === 'ExitPlanMode') {
      // the plan-approval options are generated by the CLI, not passed in
      // tool_input, so synthesize them (digits map to the TUI's numbering)
      const q = {
        question: 'Claude wrote a plan - proceed?',
        header: 'Plan',
        options: [
          'Yes, bypass permissions',
          'Yes, manually approve edits',
          'No, refine with Ultraplan on the web',
          'Tell Claude what to change',
        ],
        multiSelect: false,
      };
      ask = { ...q, questions: [q] };
    }
    if (data.tool_name === 'AskUserQuestion') {
      try {
        const questions = ((data.tool_input || {}).questions || []).map(q => ({
          question: q.question || '',
          header: q.header || '',
          options: (q.options || []).map(o => o.label || ''),
          multiSelect: Boolean(q.multiSelect),
        }));
        // first question mirrored top-level for older readers
        ask = questions.length ? { ...questions[0], questions } : null;
      } catch {
        ask = null;
      }
    }
  }

  fs.mkdirSync(STATE_DIR, { recursive: true });
  let ttyName = ownTty();
  if (!ttyName) {
    // headless event or detection failure — keep the last known tty
    try {
      ttyName = readJson(file).tty || '';
    } catch {
      ttyName = '';
    }
  }
  const payload = {
    state,
    cwd: data.cwd || '',
    tty: ttyName,
    tool: data.tool_name || '',
    ts: Date.now() / 1000,
  };
  if (ask) payload.ask = ask;
  const info = sessionInfo(data);
  if (info) payload.info = info;
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(payload));
  fs.renameSync(tmp, file);
}

main();
process.exit(0);
