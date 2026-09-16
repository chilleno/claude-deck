/* Setup checklist shared by property inspectors.
 *
 * Ulanzi Studio gives a plugin no onboarding surface at all: a key that does
 * nothing looks the same whether Claude Code is missing, the hooks were never
 * wired, or macOS is blocking terminal control. This renders those as rows the
 * user can act on, and replaces the single status line the panels used to show.
 *
 * Requires in the page: <div id="setup-rows">, and optionally the buttons
 * #hook-install, #terminal-check, #guide-open. */
(function () {
  var rows = document.getElementById('setup-rows');
  var installBtn = document.getElementById('hook-install');
  var terminalBtn = document.getElementById('terminal-check');
  var guideBtn = document.getElementById('guide-open');
  if (!rows && !guideBtn) return;

  var last = null;
  var poll = null;

  // $UD.t() returns the key itself when the language file has no entry (and
  // before the file has loaded) — fall back to the English source string.
  function t(key, fallback, n) {
    var v = $UD.t(key);
    if (v === key) v = fallback;
    return n == null ? v : v.replace('{n}', n);
  }

  function row(state, label, detail) {
    var el = document.createElement('div');
    el.className = 'srow';
    var dot = document.createElement('span');
    dot.className = 'sdot ' + state;
    var text = document.createElement('span');
    text.className = 'stext';
    var strong = document.createElement('strong');
    strong.textContent = label;
    var small = document.createElement('span');
    small.className = 'sdetail';
    small.textContent = detail;
    text.appendChild(strong);
    text.appendChild(small);
    el.appendChild(dot);
    el.appendChild(text);
    return el;
  }

  function render(p) {
    last = p;
    if (!rows) return;
    rows.textContent = '';

    // 1. Claude Code itself
    var claudeOk = p.claude && p.claude.installed;
    rows.appendChild(row(
      claudeOk ? 'ok' : 'bad',
      t('row_claude', 'Claude Code'),
      claudeOk ? t('row_claude_ok', 'installed') : t('row_claude_missing', 'not found on this Mac')
    ));

    // 2. the tracking hooks
    var h = p.hooks || {};
    var hookState = h.installed > 0 ? (h.outdated > 0 ? 'warn' : 'ok') : 'bad';
    var hookDetail = h.installed > 0
      ? (h.outdated > 0
        ? t('row_hooks_outdated', 'enabled, needs updating')
        : t('row_hooks_ok', 'enabled ({n})', h.installed))
      : (claudeOk ? t('row_hooks_missing', 'not set up yet') : t('row_hooks_blocked', 'needs Claude Code first'));
    rows.appendChild(row(hookState, t('row_hooks', 'Claude tracking'), hookDetail));

    // 3. permission to drive the terminal
    var access = (p.terminal || {}).access || 'unchecked';
    var ACCESS = {
      ok: ['ok', t('row_terminal_ok', 'allowed')],
      denied: ['bad', t('row_terminal_denied', 'blocked by macOS')],
      missing: ['bad', t('row_terminal_missing', 'terminal not installed')],
      unchecked: ['warn', t('row_terminal_unchecked', 'not checked yet')],
    };
    var a = ACCESS[access] || ['warn', String(access)];
    rows.appendChild(row(a[0], t('row_terminal', 'Terminal control'), a[1] + ' · ' + ((p.terminal || {}).choice === 'iterm2' ? 'iTerm2' : 'Terminal.app')));

    // 4. the big screen
    var big = p.bigkey || {};
    rows.appendChild(row(
      big.actual ? 'ok' : 'warn',
      t('row_bigkey', 'Big screen'),
      big.actual ? t('row_bigkey_on', 'showing Claude') : t('row_bigkey_off', 'showing the built-in widget')
    ));

    // 5. proof that the whole chain works
    var n = (p.sessions || {}).count || 0;
    rows.appendChild(row(
      n > 0 ? 'ok' : 'warn',
      t('row_sessions', 'Sessions'),
      n > 0 ? t('row_sessions_n', '{n} tracked right now', n) : t('row_sessions_none', 'none seen yet')
    ));

    // the one next step, spelled out under the rows
    var hint = document.createElement('div');
    hint.className = 'shint';
    if (!claudeOk) hint.textContent = t('hint_install', 'Claude Deck drives Anthropic’s Claude Code CLI. Open the User Guide for the install steps, then come back.');
    else if (h.installed === 0) hint.textContent = t('hint_enable', 'Turn on tracking so the deck can see your sessions, then restart any running claude sessions.');
    else if (h.outdated > 0) hint.textContent = t('hint_update', 'This version registers the hooks differently. Update them, then restart running claude sessions.');
    else if (access === 'denied') hint.textContent = t('hint_denied', 'macOS is blocking terminal control. Allow Ulanzi Studio under System Settings → Privacy & Security → Automation.');
    else if (access === 'unchecked') hint.textContent = t('hint_check', 'Check terminal access once: answering the macOS prompt now avoids a key that silently does nothing later.');
    else if (n === 0) hint.textContent = t('hint_waiting', 'All set. Start a claude session in your terminal and the keys come to life.');
    else hint.textContent = t('hint_ready', 'Everything is working.');
    rows.appendChild(hint);

    if (installBtn) {
      installBtn.style.display = (claudeOk && (h.installed === 0 || h.outdated > 0)) ? '' : 'none';
      installBtn.textContent = h.outdated > 0
        ? t('btn_update', 'Update Claude tracking')
        : t('tracking_button', 'Enable Claude tracking');
    }
    if (terminalBtn) terminalBtn.style.display = access === 'ok' ? 'none' : '';
  }

  function refresh() {
    $UD.sendToPlugin({ cmd: 'getSetup' });
  }

  $UD.onConnected(function () {
    refresh();
    // rows are script-written, so they miss the one-shot [data-localize] pass
    Promise.resolve($UD.localizeUI()).then(function () {
      if (last) render(last);
    }).catch(function () { /* english stays */ });
    clearInterval(poll);
    poll = setInterval(refresh, 3000); // statuses must never look stale after a fix
  });

  $UD.onSendToPropertyInspector(function (msg) {
    var p = msg.payload || {};
    if (p.cmd === 'setup') render(p);
  });

  if (installBtn) {
    installBtn.addEventListener('click', function () {
      $UD.sendToPlugin({ cmd: 'installHooks' });
    });
  }
  if (terminalBtn) {
    terminalBtn.addEventListener('click', function () {
      terminalBtn.textContent = t('btn_checking', 'Asking macOS…');
      $UD.sendToPlugin({ cmd: 'checkTerminal' });
      setTimeout(function () {
        terminalBtn.textContent = t('btn_check_terminal', 'Check terminal access');
      }, 4000);
    });
  }
  if (guideBtn) {
    guideBtn.addEventListener('click', function () {
      $UD.sendToPlugin({ cmd: 'openGuide', language: $UD.language });
    });
  }

  window.addEventListener('unload', function () { clearInterval(poll); });
})();
