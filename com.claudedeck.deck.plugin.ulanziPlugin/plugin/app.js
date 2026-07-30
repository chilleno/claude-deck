import UlanziApi from './plugin-common-node/index.js';
import {
  openApp,
  itermCycle,
  focusItermByCwd,
  claudeTtyByCwd,
  sendTextToTty,
} from './actions.js';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { spawn } from 'child_process';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { renderSession, renderOptions, renderConfirm, renderNoSession, renderSubmit, renderCheckTerminal } from './renderer.js';
import { detectTerminals, getTerminalChoice, setTerminalChoice } from './terminals.js';
import { hookStatus, installHooks } from './hooks-setup.js';
import { readStates, aggregateState, askingSession } from './claude-state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PET_GIFS = {};
for (const [key, file] of Object.entries({ coding: 'coding.gif', magic: 'magic.gif', idle: 'idle.gif', wave: 'wave.gif', dancing: 'dancing.gif', sparkle: 'sparkle.gif', idea: 'idea.gif', loading: 'loading.gif', bonk: 'bonk.gif', workers: 'workers.gif' })) {
  try {
    const buf = readFileSync(join(__dirname, '../resources/pets', file));
    PET_GIFS[key] = 'data:image/gif;base64,' + buf.toString('base64');
  } catch { /* gif missing — SVG fallback used */ }
}

let FAIL_PNG = null;
try {
  FAIL_PNG = 'data:image/png;base64,' + readFileSync(join(__dirname, '../resources/pets/fail.png')).toString('base64');
} catch { /* png missing */ }

let APPROVED_PNG = null;
try {
  APPROVED_PNG = 'data:image/png;base64,' + readFileSync(join(__dirname, '../resources/pets/approved.png')).toString('base64');
} catch { /* png missing */ }

let YELLS_PNG = null;
try {
  YELLS_PNG = 'data:image/png;base64,' + readFileSync(join(__dirname, '../resources/pets/yells.png')).toString('base64');
} catch { /* png missing */ }

let EYES_PNG = null;
try {
  EYES_PNG = 'data:image/png;base64,' + readFileSync(join(__dirname, '../resources/pets/eyes.png')).toString('base64');
} catch { /* png missing */ }

const STATE_GIF = {
  working: 'coding',
  compacting: 'coding',
  asking: 'magic',
  attention: 'magic',
  waiting: 'idle',
  none: 'idle',
};


const PLUGIN_UUID = 'com.claudedeck.deck.plugin';

const HANDLERS = {
  [`${PLUGIN_UUID}.itermcycle`]: itermCycle,
  [`${PLUGIN_UUID}.claudepet`]: petPress,
  [`${PLUGIN_UUID}.optnext`]: optNext,
  [`${PLUGIN_UUID}.optok`]: optOk,
  [`${PLUGIN_UUID}.screensetup`]: setupPress,
  [`${PLUGIN_UUID}.compact`]: compactPress,
  [`${PLUGIN_UUID}.sessionswitch`]: switchPress,
};

// ---- manual session switch ----------------------------------------------
// PIN.sid overrides the priority pick on the big key (and for /compact).
// Cleared automatically when the pinned session's state file disappears.
const PIN = { sid: null };

// stable cycling/display order — ts changes every event, sid never does
function sessionOrder(states) {
  return states.slice().sort((a, b) => a.sid.localeCompare(b.sid));
}

// the session shown on the big key: pinned if still alive, else top priority
function displayedSession(states) {
  if (PIN.sid) {
    const s = states.find(x => x.sid === PIN.sid);
    if (s) return s;
    PIN.sid = null; // pinned session ended — back to priority mode
  }
  return aggregateState(states, '');
}

async function switchPress() {
  const states = readStates();
  if (!states.length) { $UD.toast('No Claude sessions'); return; }
  const sorted = sessionOrder(states);
  // start from what the big key actually shows: the ask view wins over the
  // session view, so with a question live the cycle starts at that asker
  const cur = askingSession(states, PIN.sid) || displayedSession(states);
  const idx = sorted.findIndex(s => s.sid === cur.sid);
  const next = sorted[(idx + 1) % sorted.length];
  PIN.sid = next.sid;
  $UD.toast(`Session: ${basename(next.cwd || '') || 'claude'}`);
  refreshBigKeys();
}

// ---- AskUserQuestion option picker --------------------------------------
// OPT.key identifies the ask (session + first question) so state resets when
// a new ask appears. qIdx walks through multi-question asks.
const OPT = { key: null, index: 0, qIdx: 0, confirmUntil: 0, answeredKey: null };

function currentAsk() {
  const s = askingSession(readStates(), PIN.sid);
  if (!s) return null;
  const key = s.sid + '::' + s.ask.question;
  if (OPT.key !== key) { OPT.key = key; OPT.index = 0; OPT.qIdx = 0; }
  return s;
}

// old state files carry a single flat question; new ones a questions[] list
function askQuestions(ask) {
  return Array.isArray(ask.questions) && ask.questions.length ? ask.questions : [ask];
}

// multiSelect can't be driven from the deck (the TUI's Submit row needs
// cursor-accurate arrow navigation that proved unreliable) — those asks
// get a "answer in terminal" screen instead
function askNeedsTerminal(qs) {
  return qs.some(q => q.multiSelect);
}

async function optNext() {
  const s = currentAsk();
  if (!s) { $UD.toast('No Claude question active'); return; }
  const qs = askQuestions(s.ask);
  if (askNeedsTerminal(qs)) { focusItermByCwd(s.cwd); return; }
  if (OPT.qIdx >= qs.length) return; // submit screen — nothing to cycle
  OPT.index = (OPT.index + 1) % qs[OPT.qIdx].options.length;
  refreshBigKeys();
}

async function optOk() {
  const s = currentAsk();
  if (!s) { $UD.toast('No Claude question active'); return; }
  const qs = askQuestions(s.ask);
  if (askNeedsTerminal(qs)) { focusItermByCwd(s.cwd); return; }
  const tty = await claudeTtyByCwd(s.cwd);
  if (!tty) { $UD.toast('Session terminal not found'); return; }

  if (OPT.qIdx >= qs.length) {
    // every question answered — Enter presses the TUI's Submit tab
    const out = await sendTextToTty(tty, '', true);
    if (out.trim() !== 'ok') { $UD.toast('Terminal session not found'); return; }
    log('submitted answers to', tty);
    finishAnswer('Answers submitted');
    return;
  }

  const q = qs[OPT.qIdx];
  const digit = String(OPT.index + 1);
  const out = await sendTextToTty(tty, digit, false);
  if (out.trim() !== 'ok') { $UD.toast('Terminal session not found'); return; }
  log('answered option', digit, 'on question', OPT.qIdx + 1, 'to', tty);
  advanceQuestion(qs, q.options[OPT.index] || '');
}

// move to the next question; a single-question ask is already submitted by
// the keypress itself, multi-question asks end on the submit screen
function advanceQuestion(qs, label) {
  OPT.qIdx += 1;
  OPT.index = 0;
  if (OPT.qIdx >= qs.length && qs.length === 1) {
    finishAnswer(label);
  } else {
    refreshBigKeys();
  }
}

function finishAnswer(label) {
  // don't re-show this ask while the state file catches up
  OPT.answeredKey = OPT.key;
  OPT.confirmUntil = Date.now() + 3000;
  const confirmUrl = renderConfirm(label);
  for (const inst of INSTANCES.values()) {
    if (isCycle(inst.context) && inst.timer) {
      inst.lastIcon = confirmUrl;
      $UD.setBaseDataIcon(inst.context, confirmUrl);
    }
  }
}

// re-render every active cycle-key instance immediately (used after optNext)
function refreshBigKeys() {
  for (const inst of INSTANCES.values()) {
    if (isCycle(inst.context) && inst.timer) refreshCycleIcon(inst);
  }
}

// press the pet: jump to the terminal that needs you, else just focus iTerm
async function petPress(settings) {
  const agg = aggregateState(readStates(), (settings.dir || '').trim());
  if ((agg.state === 'asking' || agg.state === 'attention') && agg.cwd) {
    return focusItermByCwd(agg.cwd);
  }
  return openApp({ app: 'iTerm' });
}

const CYCLE_ACTION = `${PLUGIN_UUID}.itermcycle`;
const PET_ACTION = `${PLUGIN_UUID}.claudepet`;
const CYCLE_POLL_MS = 3000;
const PET_POLL_MS = 1000;

const $UD = new UlanziApi();
const INSTANCES = new Map();

function log(...args) {
  console.log('[claude-deck]', ...args);
}

function isCycle(context) {
  return (($UD.decodeContext(context) || {}).uuid || '') === CYCLE_ACTION;
}

async function refreshCycleIcon(inst) {
  if (inst.inflight) return;
  if (Date.now() < OPT.confirmUntil) return; // confirmation flash showing — don't overwrite
  inst.inflight = true;
  try {
    let dataUrl;
    let ask = currentAsk();
    if (ask && OPT.key === OPT.answeredKey) ask = null; // already answered from the deck
    if (ask) {
      // a question is live — big key becomes the option picker
      const qs = askQuestions(ask.ask);
      if (askNeedsTerminal(qs)) {
        dataUrl = renderCheckTerminal();
      } else if (OPT.qIdx >= qs.length) {
        dataUrl = renderSubmit(qs.length);
      } else {
        const q = qs[OPT.qIdx];
        dataUrl = renderOptions({
          question: q.question,
          options: q.options,
          index: OPT.index,
          qIdx: OPT.qIdx,
          qTotal: qs.length,
        });
      }
    } else {
      const states = readStates();
      if (!states.length) {
        // no tracked claude session — showing last terminal name would be
        // stale/false info (e.g. right after boot), so show a placeholder
        dataUrl = renderNoSession();
      } else {
        // claude-driven display: pinned or top-priority session's project
        // name + state, never the focused terminal tab (once showed "node")
        const best = displayedSession(states);
        const sorted = sessionOrder(states);
        dataUrl = renderSession({
          name: basename(best.cwd || '') || 'claude',
          idx: sorted.findIndex(s => s.sid === best.sid) + 1,
          total: states.length,
          status: best.state,
          info: best.info,
          compactElapsed: best.state === 'compacting'
            ? Math.max(0, Date.now() / 1000 - best.ts)
            : null,
        });
        // compaction bar is time-driven — poll at 1s for smooth motion, 3s otherwise
        const wantMs = best.state === 'compacting' ? 1000 : CYCLE_POLL_MS;
        if (inst.timer && inst.pollMs !== wantMs) {
          clearInterval(inst.timer);
          inst.pollMs = wantMs;
          inst.timer = setInterval(() => refreshCycleIcon(inst), wantMs);
        }
      }
    }
    if (dataUrl !== inst.lastIcon) {
      inst.lastIcon = dataUrl;
      $UD.setBaseDataIcon(inst.context, dataUrl);
    }
  } catch (e) {
    log('cycle icon refresh failed', e?.message);
  } finally {
    inst.inflight = false;
  }
}

function startCyclePolling(inst) {
  stopCyclePolling(inst);
  refreshCycleIcon(inst);
  inst.pollMs = CYCLE_POLL_MS;
  inst.timer = setInterval(() => refreshCycleIcon(inst), CYCLE_POLL_MS);
}

function stopCyclePolling(inst) {
  if (inst.timer) { clearInterval(inst.timer); inst.timer = null; }
}

function isPet(context) {
  return (($UD.decodeContext(context) || {}).uuid || '') === PET_ACTION;
}

const OPT_NEXT_ACTION = `${PLUGIN_UUID}.optnext`;
const OPT_OK_ACTION = `${PLUGIN_UUID}.optok`;

function isOptKey(context) {
  const uuid = ($UD.decodeContext(context) || {}).uuid || '';
  return uuid === OPT_NEXT_ACTION || uuid === OPT_OK_ACTION;
}

// option keys switch icon depending on whether a question is live:
//   <> : wave (question active) / dancing (nothing to pick)
//   OK : approved image (question active) / football (nothing to confirm)
function refreshOptIcon(inst) {
  try {
    const states = readStates();
    const asking = askingSession(states, PIN.sid);
    const active = !!asking && (asking.sid + '::' + asking.ask.question) !== OPT.answeredKey;
    const uuid = ($UD.decodeContext(inst.context) || {}).uuid || '';
    let wanted;
    if (!states.length) {
      wanted = 'png:fail'; // no claude sessions at all
    } else if (uuid === OPT_NEXT_ACTION) {
      wanted = active ? 'gif:wave' : 'gif:dancing';
    } else {
      wanted = active ? 'gif:idea' : 'gif:sparkle';
    }
    if (wanted === inst.lastIcon) return;
    const [kind, name] = wanted.split(':');
    const PNGS = { fail: FAIL_PNG };
    if (kind === 'gif' && PET_GIFS[name]) {
      inst.lastIcon = wanted;
      $UD.setGifDataIcon(inst.context, PET_GIFS[name]);
    } else if (kind === 'png' && PNGS[name]) {
      inst.lastIcon = wanted;
      $UD.setBaseDataIcon(inst.context, PNGS[name]);
    }
  } catch (e) {
    log('opt icon refresh failed', e?.message);
  }
}

function startOptPolling(inst) {
  stopCyclePolling(inst);
  refreshOptIcon(inst);
  inst.timer = setInterval(() => refreshOptIcon(inst), PET_POLL_MS);
}

// ---- Claude Screen Setup key --------------------------------------------
const SETUP_ACTION = `${PLUGIN_UUID}.screensetup`;
const UD_BASE = join(homedir(), 'Library/Application Support/Ulanzi/UlanziDeck');

function isSetup(context) {
  return (($UD.decodeContext(context) || {}).uuid || '') === SETUP_ACTION;
}

// Is the big key (3_2) ours on the current page of at least one active
// profile? (stale device entries linger in setting_source — don't let them
// hold the state at "pending" forever)
function bigKeyIsOurs() {
  try {
    const setting = JSON.parse(readFileSync(join(UD_BASE, 'Config/setting_source.json'), 'utf8'));
    const root = join(UD_BASE, 'ProfilesV2');
    for (const dev of setting.Devices || []) {
      for (const group of readdirSync(root)) {
        const gmPath = join(root, group, 'manifest.json');
        if (!existsSync(gmPath)) continue;
        const gm = JSON.parse(readFileSync(gmPath, 'utf8'));
        if (gm.Name !== dev.CurrentProfile || gm.Device?.UUID !== dev.CurrentDevice) continue;
        const page = gm.Pages?.Current;
        if (!page) continue;
        const pmPath = join(root, group, 'Profiles', page, 'manifest.json');
        if (!existsSync(pmPath)) continue;
        const pm = JSON.parse(readFileSync(pmPath, 'utf8'));
        for (const c of pm.Controllers || []) {
          if (c.Type !== 'Keypad') continue;
          if (c.Actions?.['3_2']?.Action === CYCLE_ACTION) return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

function watcherAlive() {
  try {
    const pid = parseInt(readFileSync(join(UD_BASE, 'claude-state/.bigkey-watcher.pid'), 'utf8'), 10);
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function spawnWatcher() {
  try {
    const script = join(__dirname, '../hooks/bigkey-watcher.sh');
    const child = spawn('/bin/zsh', [script], { detached: true, stdio: 'ignore' });
    child.unref();
    log('bigkey watcher spawned');
  } catch (e) {
    log('watcher spawn failed', e?.message);
  }
}

const DESIRED_FILE = join(UD_BASE, 'claude-state/.bigkey-desired');

function bigKeyDesired() {
  try {
    return readFileSync(DESIRED_FILE, 'utf8').trim() !== 'off';
  } catch {
    return true;
  }
}

function setBigKeyDesired(on) {
  try {
    writeFileSync(DESIRED_FILE, on ? 'on' : 'off');
  } catch (e) {
    log('desired flag write failed', e?.message);
  }
}

function refreshSetupIcon(inst) {
  try {
    const actual = bigKeyIsOurs();
    const desired = bigKeyDesired();
    let wanted;
    if (actual === desired) {
      wanted = actual ? 'png:approved' : 'gif:idle'; // applied: showing / hidden
    } else {
      wanted = 'gif:loading'; // pending Studio restart
      if (!watcherAlive()) spawnWatcher();
    }
    if (wanted === inst.lastIcon) return;
    const [kind, name] = wanted.split(':');
    if (kind === 'gif' && PET_GIFS[name]) {
      inst.lastIcon = wanted;
      $UD.setGifDataIcon(inst.context, PET_GIFS[name]);
    } else if (kind === 'png' && APPROVED_PNG) {
      inst.lastIcon = wanted;
      $UD.setBaseDataIcon(inst.context, APPROVED_PNG);
    }
  } catch (e) {
    log('setup icon refresh failed', e?.message);
  }
}

function startSetupPolling(inst) {
  stopCyclePolling(inst);
  refreshSetupIcon(inst);
  inst.timer = setInterval(() => refreshSetupIcon(inst), 3000);
}

// toggle show/hide of the claude status on the big screen — fully automatic:
// a detached script quits Studio, patches, and relaunches it
async function setupPress() {
  const next = !bigKeyDesired();
  setBigKeyDesired(next);
  if (bigKeyIsOurs() === next) {
    $UD.toast(next ? 'Claude status already showing' : 'Widget already showing');
    return;
  }
  $UD.toast(`${next ? 'Showing claude status' : 'Restoring widget'} — Studio will restart itself`);
  try {
    const script = join(__dirname, '../hooks/bigkey-toggle.sh');
    const child = spawn('/bin/zsh', [script], { detached: true, stdio: 'ignore' });
    child.unref();
  } catch (e) {
    log('toggle spawn failed', e?.message);
  }
}

function refreshPetIcon(inst) {
  try {
    const agg = aggregateState(readStates(), (inst.settings.dir || '').trim());
    if (agg.state === 'none') {
      // no claude sessions detected
      if (FAIL_PNG && inst.lastIcon !== 'fail') {
        inst.lastIcon = 'fail';
        $UD.setBaseDataIcon(inst.context, FAIL_PNG);
      }
      return;
    }
    const gifKey = STATE_GIF[agg.state] || 'idle';
    // GIF animates on the device by itself — only re-send on state change
    if (PET_GIFS[gifKey] && inst.lastIcon !== gifKey) {
      inst.lastIcon = gifKey;
      $UD.setGifDataIcon(inst.context, PET_GIFS[gifKey]);
    }
  } catch (e) {
    log('pet refresh failed', e?.message);
  }
}

function startPetPolling(inst) {
  stopCyclePolling(inst);
  refreshPetIcon(inst);
  inst.timer = setInterval(() => refreshPetIcon(inst), PET_POLL_MS);
}

// ---- Claude Compact key --------------------------------------------------
// Two-step: first press arms a confirmation (eyes image), second press within
// the window sends /compact to the top-priority session. While any session is
// compacting the key shows the bonk GIF and presses are ignored.
const COMPACT_ACTION = `${PLUGIN_UUID}.compact`;
const COMPACT_CONFIRM_MS = 8000;
const COMPACT = { confirmUntil: 0 };

function isCompact(context) {
  return (($UD.decodeContext(context) || {}).uuid || '') === COMPACT_ACTION;
}

function anyCompacting(states) {
  return states.some(s => s.state === 'compacting');
}

function refreshCompactIcon(inst) {
  try {
    const states = readStates();
    let wanted;
    if (!states.length) wanted = 'png:fail';
    else if (anyCompacting(states)) wanted = 'gif:bonk';
    else if (Date.now() < COMPACT.confirmUntil) wanted = 'png:eyes';
    else wanted = 'png:yells';
    if (wanted === inst.lastIcon) return;
    const [kind, name] = wanted.split(':');
    const PNGS = { fail: FAIL_PNG, eyes: EYES_PNG, yells: YELLS_PNG };
    if (kind === 'gif' && PET_GIFS[name]) {
      inst.lastIcon = wanted;
      $UD.setGifDataIcon(inst.context, PET_GIFS[name]);
    } else if (kind === 'png' && PNGS[name]) {
      inst.lastIcon = wanted;
      $UD.setBaseDataIcon(inst.context, PNGS[name]);
    }
  } catch (e) {
    log('compact icon refresh failed', e?.message);
  }
}

function startCompactPolling(inst) {
  stopCyclePolling(inst);
  refreshCompactIcon(inst);
  inst.timer = setInterval(() => refreshCompactIcon(inst), PET_POLL_MS);
}

function refreshCompactKeys() {
  for (const inst of INSTANCES.values()) {
    if (isCompact(inst.context) && inst.timer) refreshCompactIcon(inst);
  }
}

async function compactPress() {
  const states = readStates();
  if (!states.length) { $UD.toast('No Claude session to compact'); return; }
  if (anyCompacting(states)) return; // already running — do nothing
  if (Date.now() >= COMPACT.confirmUntil) {
    // first press: arm confirmation
    COMPACT.confirmUntil = Date.now() + COMPACT_CONFIRM_MS;
    refreshCompactKeys();
    return;
  }
  // second press: fire /compact at the session shown on the big key
  COMPACT.confirmUntil = 0;
  const best = displayedSession(states);
  const tty = await claudeTtyByCwd(best.cwd);
  if (!tty) { $UD.toast('Session terminal not found'); refreshCompactKeys(); return; }
  const out = await sendTextToTty(tty, '/compact', true);
  if (out.trim() !== 'ok') { $UD.toast('Terminal session not found'); refreshCompactKeys(); return; }
  log('sent /compact to', tty);
  $UD.toast(`Compacting ${basename(best.cwd || '') || 'session'}…`);
  refreshCompactKeys(); // bonk appears once the PreCompact hook flips the state
}

const SWITCH_ACTION = `${PLUGIN_UUID}.sessionswitch`;

function isSwitch(context) {
  return (($UD.decodeContext(context) || {}).uuid || '') === SWITCH_ACTION;
}

function refreshSwitchIcon(inst) {
  try {
    const states = readStates();
    const wanted = states.length ? 'gif:workers' : 'png:fail';
    if (wanted === inst.lastIcon) return;
    if (wanted === 'gif:workers' && PET_GIFS.workers) {
      inst.lastIcon = wanted;
      $UD.setGifDataIcon(inst.context, PET_GIFS.workers);
    } else if (wanted === 'png:fail' && FAIL_PNG) {
      inst.lastIcon = wanted;
      $UD.setBaseDataIcon(inst.context, FAIL_PNG);
    }
  } catch (e) {
    log('switch icon refresh failed', e?.message);
  }
}

function startSwitchPolling(inst) {
  stopCyclePolling(inst);
  refreshSwitchIcon(inst);
  inst.timer = setInterval(() => refreshSwitchIcon(inst), PET_POLL_MS);
}

function ensureInstance(context, settings) {
  let inst = INSTANCES.get(context);
  if (!inst) {
    inst = { context, settings: settings || {}, timer: null, inflight: false, lastIcon: null };
    INSTANCES.set(context, inst);
    if (isCycle(context)) startCyclePolling(inst);
    if (isPet(context)) startPetPolling(inst);
    if (isOptKey(context)) startOptPolling(inst);
    if (isSetup(context)) startSetupPolling(inst);
    if (isCompact(context)) startCompactPolling(inst);
    if (isSwitch(context)) startSwitchPolling(inst);
  } else if (settings && Object.keys(settings).length) {
    inst.settings = { ...settings };
  }
  return inst;
}

$UD.connect(PLUGIN_UUID);

$UD.onConnected(() => log('connected'));

$UD.onAdd((msg) => {
  log('add', msg.context, JSON.stringify(msg.param || {}));
  ensureInstance(msg.context, msg.param || {});
});

$UD.onParamFromApp((msg) => {
  ensureInstance(msg.context, msg.param || {});
});

$UD.onParamFromPlugin((msg) => {
  log('settings from inspector', msg.context, JSON.stringify(msg.param || {}));
  ensureInstance(msg.context, msg.param || {});
});

$UD.onRun(async (msg) => {
  const inst = ensureInstance(msg.context, msg.param || {});
  const actionUuid = ($UD.decodeContext(msg.context) || {}).uuid || '';
  const handler = HANDLERS[actionUuid];
  if (!handler) {
    log('no handler for', actionUuid);
    $UD.showAlert(msg.context);
    return;
  }
  try {
    log('run', actionUuid, JSON.stringify(inst.settings));
    await handler(inst.settings);
    if (actionUuid === CYCLE_ACTION) {
      setTimeout(() => refreshCycleIcon(inst), 400);
    }
  } catch (e) {
    log('action failed', actionUuid, e?.message);
    $UD.toast(`Shortcut failed: ${e?.message || 'unknown error'}`);
    $UD.showAlert(msg.context);
  }
});

$UD.onSetActive((msg) => {
  const inst = INSTANCES.get(msg.context);
  if (!inst) return;
  if (isCycle(msg.context)) {
    if (msg.active) startCyclePolling(inst);
    else stopCyclePolling(inst);
  } else if (isPet(msg.context)) {
    if (msg.active) startPetPolling(inst);
    else stopCyclePolling(inst);
  } else if (isOptKey(msg.context)) {
    if (msg.active) startOptPolling(inst);
    else stopCyclePolling(inst);
  } else if (isSetup(msg.context)) {
    if (msg.active) startSetupPolling(inst);
    else stopCyclePolling(inst);
  } else if (isCompact(msg.context)) {
    if (msg.active) startCompactPolling(inst);
    else stopCyclePolling(inst);
  } else if (isSwitch(msg.context)) {
    if (msg.active) startSwitchPolling(inst);
    else stopCyclePolling(inst);
  }
});

$UD.onClear((msg) => {
  if (!msg.param) return;
  for (const item of msg.param) {
    const inst = INSTANCES.get(item.context);
    if (inst) stopCyclePolling(inst);
    INSTANCES.delete(item.context);
    log('clear', item.context);
  }
});

// property inspectors ask for the terminal list / set the global choice
$UD.onSendToPlugin((msg) => {
  const payload = msg.payload || {};
  if (payload.cmd === 'getTerminals') {
    $UD.sendToPropertyInspector(
      { cmd: 'terminals', terminals: detectTerminals(), current: getTerminalChoice() },
      msg.context
    );
  } else if (payload.cmd === 'setTerminal') {
    if (setTerminalChoice(payload.value)) {
      log('terminal choice ->', payload.value);
      $UD.toast(`Terminal: ${payload.value === 'iterm2' ? 'iTerm2' : 'Terminal.app'}`);
    }
  } else if (payload.cmd === 'getHookStatus') {
    $UD.sendToPropertyInspector({ cmd: 'hookStatus', ...hookStatus() }, msg.context);
  } else if (payload.cmd === 'installHooks') {
    const results = installHooks();
    const errors = results.filter(r => r.error);
    log('hook install', JSON.stringify(results));
    $UD.toast(errors.length ? 'Hook setup had errors' : 'Claude tracking enabled — restart your claude sessions');
    $UD.sendToPropertyInspector({ cmd: 'hookStatus', ...hookStatus() }, msg.context);
  }
});

$UD.onError((err) => log('socket error', err));
$UD.onClose(() => {
  log('socket closed, exiting');
  process.exit(0);
});
