/* Claude hook setup UI shared by property inspectors.
 * Requires: <div id="hook-status"></div> and <button id="hook-install"> in the page. */
(function () {
  var statusEl = document.getElementById('hook-status');
  var btn = document.getElementById('hook-install');
  if (!statusEl || !btn) return;

  var last = null;

  // $UD.t() returns the key itself when the language file has no entry (and
  // before the file finishes loading) — fall back to the English source string.
  function t(key, fallback) {
    var v = $UD.t(key);
    return v === key ? fallback : v;
  }

  function fill(text, n) {
    return text.replace('{n}', n);
  }

  function render(p) {
    last = p;
    if (p.missing === 0 && p.installed > 0) {
      statusEl.textContent = fill(
        p.installed > 1
          ? t('hook_enabled_many', 'Claude tracking: enabled ({n} profiles)')
          : t('hook_enabled_one', 'Claude tracking: enabled ({n} profile)'),
        p.installed
      );
      btn.style.display = 'none';
    } else if (p.installed === 0 && p.missing === 0) {
      statusEl.textContent = t('hook_none', 'Claude tracking: no Claude Code installation found (~/.claude missing)');
      btn.style.display = 'none';
    } else {
      statusEl.textContent = fill(
        p.missing > 1
          ? t('hook_missing_many', 'Claude tracking: {n} profiles not set up')
          : t('hook_missing_one', 'Claude tracking: {n} profile not set up'),
        p.missing
      );
      btn.style.display = '';
    }
  }

  $UD.onConnected(function () {
    $UD.sendToPlugin({ cmd: 'getHookStatus' });
    // This line is script-owned (no data-localize — the SDK's one-shot pass
    // would overwrite a rendered status with "Checking…"), so translate it
    // here, once the language file has loaded.
    Promise.resolve($UD.localizeUI()).then(function () {
      if (last) render(last);
      else statusEl.textContent = t('hook_checking', 'Checking…');
    }).catch(function () { /* english stays */ });
  });

  $UD.onSendToPropertyInspector(function (msg) {
    var p = msg.payload || {};
    if (p.cmd === 'hookStatus') render(p);
  });

  btn.addEventListener('click', function () {
    $UD.sendToPlugin({ cmd: 'installHooks' });
  });
})();
