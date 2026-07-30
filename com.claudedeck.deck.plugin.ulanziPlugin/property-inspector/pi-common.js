/* Shared property-inspector logic.
 * Each inspector page defines window.PI_FIELDS = [{ id, default }] before
 * loading this script. Values are read from / written to form controls whose
 * DOM id matches the settings key. */
(function () {
  var saveTimer = null;

  function control(id) {
    return document.getElementById(id);
  }

  function readValue(el) {
    return el.type === 'checkbox' ? el.checked : el.value;
  }

  function writeValue(el, value) {
    if (el.type === 'checkbox') {
      el.checked = value === true || value === 'true';
    } else {
      el.value = value == null ? '' : value;
    }
  }

  function collect() {
    var settings = {};
    (window.PI_FIELDS || []).forEach(function (f) {
      var el = control(f.id);
      if (el) settings[f.id] = readValue(el);
    });
    return settings;
  }

  function fill(param) {
    (window.PI_FIELDS || []).forEach(function (f) {
      var el = control(f.id);
      if (!el) return;
      var value = param && param[f.id] != null ? param[f.id] : f.default;
      writeValue(el, value);
    });
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      $UD.setSettings(collect());
    }, 300);
  }

  $UD.connect();

  $UD.onConnected(function () {
    var wrapper = document.querySelector('.udpi-wrapper');
    if (wrapper) wrapper.classList.remove('hidden');
  });

  $UD.onAdd(function (msg) {
    fill(msg.param || {});
  });

  $UD.onParamFromApp(function (msg) {
    fill(msg.param || {});
  });

  document.addEventListener('input', save);
  document.addEventListener('change', save);
})();
