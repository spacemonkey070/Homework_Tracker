(function () {
  'use strict';

  var CANVAS_URL = 'https://all-in-1-b8acdzcyhyhxdpen.centralus-01.azurewebsites.net/unfinishedHomework';

  var KEY = {
    settings: 'hwSettings',
    homework: 'homework',
    canvas: 'CanvasAssignments',
    canvasToken: 'canvasApiToken',
    gcalId: 'gcalId',
    gcalLast: 'gcalLastSync'
  };

  var DEFAULTS = {
    theme: 'dark',
    highlightOverdue: true,
    highlightToday: true,
    showTime: true,
    ringScope: 'week',
    weekStart: '1',
    gcalAuto: false
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- storage helpers ---------- */
  function readJSON(store, key, fallback) {
    try {
      var raw = store.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(store, key, value) {
    try { store.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function loadSettings() {
    var saved = readJSON(localStorage, KEY.settings, {});
    var s = {};
    Object.keys(DEFAULTS).forEach(function (k) { s[k] = saved[k] === undefined ? DEFAULTS[k] : saved[k]; });
    return s;
  }
  function saveSettings(s) { writeJSON(localStorage, KEY.settings, s); }

  function getHomework() {
    var list = readJSON(localStorage, KEY.homework, []);
    return Array.isArray(list) ? list : [];
  }

  var settings = loadSettings();

  /* ---------- toast + confirm ---------- */
  var toastTimer;
  function toast(text) {
    var el = $('#toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  function confirmDialog(message, okLabel) {
    var dlg = $('#confirmDialog');
    if (!dlg || typeof dlg.showModal !== 'function') {
      return Promise.resolve(window.confirm(message));
    }
    $('#confirmText').textContent = message;
    $('#confirmOk').textContent = okLabel || 'Confirm';
    return new Promise(function (resolve) {
      dlg.addEventListener('close', function onClose() {
        dlg.removeEventListener('close', onClose);
        resolve(dlg.returnValue === 'ok');
      });
      dlg.showModal();
    });
  }

  /* ---------- theme ---------- */
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    var t = settings.theme;
    if (t === 'auto') t = darkQuery.matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
    $$('[data-theme-choice]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.themeChoice === settings.theme));
    });
  }
  if (darkQuery.addEventListener) darkQuery.addEventListener('change', applyTheme);

  /* ---------- settings controls ---------- */
  function updatePreview() {
    var p = $('#preview');
    p.dataset.hlOverdue = String(settings.highlightOverdue);
    p.dataset.hlToday = String(settings.highlightToday);
    p.dataset.time = String(settings.showTime);
  }

  function syncControls() {
    $$('[data-setting]').forEach(function (el) {
      var k = el.dataset.setting;
      if (el.type === 'checkbox') el.checked = !!settings[k];
      else el.value = settings[k];
    });
    applyTheme();
    updatePreview();
  }

  $$('[data-setting]').forEach(function (el) {
    el.addEventListener('change', function () {
      var k = el.dataset.setting;
      settings[k] = el.type === 'checkbox' ? el.checked : el.value;
      saveSettings(settings);
      updatePreview();
      toast('Saved');
      if (k === 'gcalAuto' && settings.gcalAuto) {
        if (hasGcalToken()) runGcalAuto();
        else toast('Press Sync to Google Calendar once, then auto-sync takes over');
      }
    });
  });

  $$('[data-theme-choice]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      settings.theme = btn.dataset.themeChoice;
      saveSettings(settings);
      applyTheme();
      toast('Saved');
    });
  });

  /* ---------- tabs ---------- */
  function showTab() {
    var name = (location.hash || '#appearance').slice(1);
    if (!$('#' + name + '[data-panel]')) name = 'appearance';
    $$('[data-panel]').forEach(function (p) { p.hidden = p.id !== name; });
    $$('[data-tab]').forEach(function (a) {
      if (a.dataset.tab === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (name === 'data') updateCount();
  }
  window.addEventListener('hashchange', showTab);

  /* ---------- data ---------- */
  function updateCount() {
    var n = getHomework().length;
    var c = readJSON(localStorage, KEY.canvas, []);
    c = Array.isArray(c) ? c.length : 0;
    $('#countLine').textContent = n + (n === 1 ? ' assignment' : ' assignments') + ' in your homework list, ' + c + ' synced from Canvas.';
  }

  $('#exportBtn').addEventListener('click', function () {
    var payload = {
      app: 'hw-tracker',
      version: 1,
      exportedAt: new Date().toISOString(),
      homework: getHomework(),
      canvasAssignments: readJSON(localStorage, KEY.canvas, []),
      settings: settings
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hw-tracker-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('Backup downloaded');
  });

  $('#importBtn').addEventListener('click', function () { $('#importFile').click(); });
  $('#importFile').addEventListener('change', function (e) {
    var file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (err) { toast("That file isn't valid JSON"); return; }
      var list = Array.isArray(data) ? data : data && data.homework;
      if (!Array.isArray(list) || list.some(function (h) { return !h || typeof h !== 'object' || !h.name; })) {
        toast("That file doesn't look like a homework backup");
        return;
      }
      var msg = 'Replace your ' + getHomework().length + ' saved assignments with the ' + list.length + ' in this file?';
      confirmDialog(msg, 'Replace').then(function (ok) {
        if (!ok) return;
        writeJSON(localStorage, KEY.homework, list);
        if (data && Array.isArray(data.canvasAssignments)) writeJSON(localStorage, KEY.canvas, data.canvasAssignments);
        if (data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) {
          Object.keys(DEFAULTS).forEach(function (k) {
            if (data.settings[k] !== undefined && typeof data.settings[k] === typeof DEFAULTS[k]) settings[k] = data.settings[k];
          });
          saveSettings(settings);
          syncControls();
        }
        updateCount();
        toast('Imported ' + list.length + ' assignments');
      });
    };
    reader.readAsText(file);
  });

  $('#resetBtn').addEventListener('click', function () {
    confirmDialog('Reset all settings to their defaults? Your homework is not affected.', 'Reset').then(function (ok) {
      if (!ok) return;
      settings = JSON.parse(JSON.stringify(DEFAULTS));
      saveSettings(settings);
      syncControls();
      toast('Settings reset');
    });
  });

  $('#clearBtn').addEventListener('click', function () {
    var n = getHomework().length;
    if (!n) { toast('There is no homework to clear'); return; }
    confirmDialog('Delete all ' + n + ' assignments from this browser? This can\u2019t be undone. Export a backup first if you might want them back.', 'Delete everything').then(function (ok) {
      if (!ok) return;
      writeJSON(localStorage, KEY.homework, []);
      updateCount();
      toast('Homework cleared');
    });
  });

  /* ---------- Canvas ---------- */
  function setCanvasMsg(text, isError) {
    var el = $('#canvasMsg');
    el.textContent = text || '';
    el.classList.toggle('error', !!isError);
  }

  var tokenInput = $('#canvas-api-token');
  try { tokenInput.value = localStorage.getItem(KEY.canvasToken) || ''; } catch (e) {}
  tokenInput.addEventListener('change', function () {
    try {
      if (tokenInput.value) localStorage.setItem(KEY.canvasToken, tokenInput.value);
      else localStorage.removeItem(KEY.canvasToken);
    } catch (e) {}
    toast('Token saved');
  });

  async function syncAssignments() {
    var btn = $('#sync-assignments-btn');
    btn.disabled = true;
    setCanvasMsg('Syncing\u2026');
    try {
      var response = await fetch(CANVAS_URL);
      if (!response.ok) throw new Error('Server returned ' + response.status);

      var assignments = await response.json();
      localStorage.setItem(KEY.canvas, JSON.stringify(assignments));
      console.log('Loaded ' + assignments.length + ' assignments');

      renderAssignments(assignments);
      console.log('Assignments received:', assignments);
      setCanvasMsg('Synced ' + assignments.length + ' assignments.');
      toast('Assignments synced');
      updateCount();
    } catch (error) {
      console.error('Assignment sync failed:', error);
      setCanvasMsg('Unable to sync assignments. Check your connection and try again.', true);
    } finally {
      btn.disabled = false;
    }
  }

  function renderAssignments(assignments) {
    if (!Array.isArray(assignments)) {
      console.error('Expected an array of assignments');
      return;
    }
    assignments.forEach(function (assignment) {
      console.log(assignment.name, assignment.courseName, assignment.dueDate);
    });
  }

  $('#sync-assignments-btn').addEventListener('click', syncAssignments);
  window.syncAssignments = syncAssignments;
  window.renderAssignments = renderAssignments;

  /* ---------- Google Calendar (uses your gcal-sync.js) ---------- */
  var gcalBtn = $('#syncBtn');
  if (gcalBtn) {
    gcalBtn.addEventListener('click', function (e) {
      if (typeof window.syncToGoogleCalendar === 'function') window.syncToGoogleCalendar(e);
      else toast('gcal-sync.js did not load');
    });
  }

  function hasGcalToken() {
    var t = readJSON(sessionStorage, 'gcalToken', null);
    return !!(t && t.exp > Date.now() + 30000);
  }
  function runGcalAuto() {
    if (typeof window.gcalAutoSync === 'function') window.gcalAutoSync();
  }
  function refreshGcal() {
    var connected = !!localStorage.getItem(KEY.gcalId);
    var pill = $('#gcalPill');
    pill.textContent = connected ? 'Connected' : 'Not connected';
    pill.classList.toggle('on', connected);
    var last = Number(localStorage.getItem(KEY.gcalLast));
    $('#gcalLast').textContent = last
      ? 'Last synced ' + new Date(last).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : '';
  }
  window.addEventListener('gcal-synced', refreshGcal);

  /* Other pages can read the current settings with HWSettings.get() */
  window.HWSettings = { get: loadSettings };

  window.addEventListener('storage', function (e) {
    if (e.key === KEY.homework || e.key === KEY.canvas) updateCount();
    if (e.key === KEY.homework) runGcalAuto();
    if (e.key === KEY.gcalLast || e.key === KEY.gcalId) refreshGcal();
    if (e.key === KEY.settings) { settings = loadSettings(); syncControls(); }
  });

  /* ---------- start ---------- */
  syncControls();
  showTab();
  refreshGcal();
  runGcalAuto();
})();
