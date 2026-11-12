const GCAL_CLIENT_ID = "627480619372-m7mt3f59ep74fjf59g6djkctfv6el8gd.apps.googleusercontent.com";
const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
const GCAL_API = "https://www.googleapis.com/calendar/v3";
const GCAL_CONFIGURED = !GCAL_CLIENT_ID.startsWith("PASTE_");

// Unfinished homework that has a valid due date
function gcalGetHomework() {
  let all = [];
  try { all = JSON.parse(localStorage.getItem("homework") || "[]"); } catch (e) {}
  return all.filter(h => !h.finished && h.due && !isNaN(new Date(h.due)));
}

// Google tokens last about an hour. Keeping the last one for this tab lets
// automatic syncs run without opening a sign-in popup.
function gcalCachedToken() {
  try {
    const t = JSON.parse(sessionStorage.getItem("gcalToken") || "null");
    return t && t.exp > Date.now() + 30000 ? t.token : null;
  } catch (e) { return null; }
}

function gcalSaveToken(resp) {
  try {
    sessionStorage.setItem("gcalToken", JSON.stringify({
      token: resp.access_token,
      exp: Date.now() + (Number(resp.expires_in) || 3600) * 1000,
    }));
  } catch (e) {}
}

function gcalToken(interactive = true) {
  const cached = gcalCachedToken();
  if (cached) return Promise.resolve(cached);
  if (!interactive) return Promise.reject(new Error("Sign-in needed"));
  return new Promise((resolve, reject) => {
    if (!window.google || !google.accounts) {
      return reject(new Error("Google sign-in script hasn't loaded yet."));
    }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GCAL_CLIENT_ID,
      scope: GCAL_SCOPE,
      callback: resp => {
        if (resp.error) return reject(new Error(resp.error));
        gcalSaveToken(resp);
        resolve(resp.access_token);
      },
      error_callback: err => reject(new Error(err.type || "Sign-in cancelled")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

async function gcalFetch(token, path, options = {}) {
  const res = await fetch(GCAL_API + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const err = new Error("Google Calendar error " + res.status);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function gcalGetOrCreateCalendar(token) {
  const saved = localStorage.getItem("gcalId");
  if (saved) {
    try {
      await gcalFetch(token, "/calendars/" + encodeURIComponent(saved));
      return saved;
    } catch (e) {
      if (e.status !== 404 && e.status !== 410) throw e;
    }
  }
  const cal = await gcalFetch(token, "/calendars", {
    method: "POST",
    body: JSON.stringify({
      summary: "HW Tracker",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });
  localStorage.setItem("gcalId", cal.id);
  return cal.id;
}

function gcalKey(h) {
  return (h.class + "|" + h.name + "|" + h.due).replace(/\s+/g, " ");
}

let gcalBusy = false;

// Called by the button (which passes a click event). The automatic sync calls
// syncToGoogleCalendar({ quiet: true }): no button text, popups or prompts.
async function syncToGoogleCalendar(arg) {
  const quiet = !!(arg && arg.quiet === true);
  if (!GCAL_CONFIGURED) return quiet ? undefined : downloadHomeworkIcs();
  if (gcalBusy) return;
  gcalBusy = true;
  const btn = quiet ? null : document.getElementById("syncBtn");
  const label = btn ? btn.textContent : "";
  const setLabel = t => { if (btn) { btn.textContent = t; } };
  if (btn) btn.disabled = true;

  try {
    setLabel("Signing in…");
    const token = await gcalToken(!quiet);
    const calId = await gcalGetOrCreateCalendar(token);
    const base = "/calendars/" + encodeURIComponent(calId) + "/events";

    // What should be on the calendar: unfinished homework with a due date
    const wanted = new Map();
    gcalGetHomework().forEach(h => wanted.set(gcalKey(h), h));

    // What's already there
    setLabel("Syncing…");
    const existing = new Map(); // key -> event id
    let pageToken = "";
    do {
      const q = "?maxResults=250&singleEvents=true" +
        (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
      const data = await gcalFetch(token, base + q);
      (data.items || []).forEach(ev => {
        const k = ev.extendedProperties &&
          ev.extendedProperties.private &&
          ev.extendedProperties.private.hwKey;
        if (k) existing.set(k, ev.id);
      });
      pageToken = data.nextPageToken || "";
    } while (pageToken);

    let added = 0, removed = 0;

    // Remove events for homework that's finished, deleted, or changed
    for (const [k, id] of existing) {
      if (!wanted.has(k)) {
        try {
          await gcalFetch(token, base + "/" + encodeURIComponent(id), { method: "DELETE" });
          removed++;
        } catch (e) {
          if (e.status !== 404 && e.status !== 410) throw e;
        }
      }
    }

    // Add events that aren't on the calendar yet
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    for (const [k, h] of wanted) {
      if (existing.has(k)) continue;
      const start = new Date(h.due);
      const end = new Date(start.getTime() + 30 * 60000);
      await gcalFetch(token, base, {
        method: "POST",
        body: JSON.stringify({
          summary: h.name + " (" + h.class + ")",
          start: { dateTime: start.toISOString(), timeZone: tz },
          end: { dateTime: end.toISOString(), timeZone: tz },
          reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }] },
          extendedProperties: { private: { hwKey: k } },
        }),
      });
      added++;
    }

    setLabel("Synced ✓ (+" + added + " / −" + removed + ")");
    localStorage.setItem("gcalLastSync", String(Date.now()));
    window.dispatchEvent(new Event("gcal-synced"));
  } catch (err) {
    console.error(err);
    if (quiet) return;
    setLabel("Sync failed");
    if (confirm("Couldn't connect to Google Calendar (" + err.message +
        ").\n\nDownload a calendar file instead? It works with Google, Apple and Outlook.")) {
      downloadHomeworkIcs();
    }
  } finally {
    gcalBusy = false;
    if (btn) {
      btn.disabled = false;
      setTimeout(() => { btn.textContent = label; }, 3000);
    }
  }
}

// Syncs quietly if "Sync automatically" is on in Settings and Google sign-in
// is still valid. Call it after homework is saved. Waits a moment so a burst
// of edits turns into one sync.
let gcalAutoTimer;
function gcalAutoSync() {
  let on = false;
  try { on = !!JSON.parse(localStorage.getItem("hwSettings") || "{}").gcalAuto; } catch (e) {}
  if (!on || !GCAL_CONFIGURED || !gcalCachedToken()) return;
  clearTimeout(gcalAutoTimer);
  gcalAutoTimer = setTimeout(() => syncToGoogleCalendar({ quiet: true }), 1500);
}

// Universal fallback: a .ics file any calendar app can import.
// Stable UIDs mean re-importing updates events instead of duplicating them.
function downloadHomeworkIcs() {
  const hw = gcalGetHomework();
  if (!hw.length) return alert("Nothing unfinished to export.");
  const pad = n => String(n).padStart(2, "0");
  const fmt = d =>
    d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
    "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + "00Z";
  const esc = x => String(x).replace(/[\\;,]/g, m => "\\" + m);

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HW Tracker//EN"];
  hw.forEach(h => {
    const start = new Date(h.due);
    const end = new Date(start.getTime() + 30 * 60000);
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + gcalKey(h).replace(/\W/g, "") + "@hwtracker",
      "DTSTAMP:" + fmt(new Date()),
      "DTSTART:" + fmt(start),
      "DTEND:" + fmt(end),
      "SUMMARY:" + esc(h.name + " (" + h.class + ")"),
      "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY",
      "DESCRIPTION:Due soon", "END:VALARM",
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  a.download = "homework.ics";
  a.click();
  URL.revokeObjectURL(a.href);
}
