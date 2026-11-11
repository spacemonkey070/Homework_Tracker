/* Shared theme loader. Load this in the <head> of every page, before the CSS,
   so the right colors are set before the page paints.
   Reads the theme from the Settings page ("hwSettings" in localStorage). */
(function () {
  var KEY = 'hwSettings';
  var DEFAULT = 'dark'; // used until the person picks one in Settings
  var query = window.matchMedia('(prefers-color-scheme: dark)');

  function choice() {
    try {
      var t = JSON.parse(localStorage.getItem(KEY) || '{}').theme;
      return t === 'light' || t === 'dark' || t === 'auto' ? t : DEFAULT;
    } catch (e) { return DEFAULT; }
  }

  function apply() {
    var t = choice();
    if (t === 'auto') t = query.matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
  }

  apply();
  if (query.addEventListener) query.addEventListener('change', apply);
  else if (query.addListener) query.addListener(apply);
  // Another tab changed the setting
  window.addEventListener('storage', function (e) {
    if (e.key === KEY || e.key === null) apply();
  });

  window.HWTheme = { apply: apply };
})();
