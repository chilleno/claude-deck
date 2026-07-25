/* Claude hook setup UI shared by property inspectors.
 * Requires: <div id="hook-status"></div> and <button id="hook-install"> in the page. */
(function () {
  var statusEl = document.getElementById('hook-status');
  var btn = document.getElementById('hook-install');
  if (!statusEl || !btn) return;

  function render(p) {
    if (p.missing === 0 && p.installed > 0) {
      statusEl.textContent = 'Claude tracking: enabled (' + p.installed + ' profile' + (p.installed > 1 ? 's' : '') + ')';
      btn.style.display = 'none';
    } else if (p.installed === 0 && p.missing === 0) {
      statusEl.textContent = 'Claude tracking: no Claude Code installation found (~/.claude missing)';
      btn.style.display = 'none';
    } else {
      statusEl.textContent = 'Claude tracking: ' + p.missing + ' profile' + (p.missing > 1 ? 's' : '') + ' not set up';
      btn.style.display = '';
    }
  }

  $UD.onConnected(function () {
    $UD.sendToPlugin({ cmd: 'getHookStatus' });
  });

  $UD.onSendToPropertyInspector(function (msg) {
    var p = msg.payload || {};
    if (p.cmd === 'hookStatus') render(p);
  });

  btn.addEventListener('click', function () {
    $UD.sendToPlugin({ cmd: 'installHooks' });
  });
})();
