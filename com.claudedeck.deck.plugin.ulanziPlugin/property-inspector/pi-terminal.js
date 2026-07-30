/* Terminal selector shared by property inspectors.
 * Requires a <select id="terminal"> in the page. Asks the plugin for the
 * installed-terminal list and saves the global choice on change. */
(function () {
  var select = document.getElementById('terminal');
  if (!select) return;

  $UD.onConnected(function () {
    $UD.sendToPlugin({ cmd: 'getTerminals' });
  });

  $UD.onSendToPropertyInspector(function (msg) {
    var p = msg.payload || {};
    if (p.cmd !== 'terminals') return;
    select.innerHTML = '';
    (p.terminals || []).forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      if (t.id === p.current) opt.selected = true;
      select.appendChild(opt);
    });
  });

  select.addEventListener('change', function () {
    $UD.sendToPlugin({ cmd: 'setTerminal', value: select.value });
  });
})();
