// ---------------------------------------------------------------------------
// HW Tracker: Google Calendar sync
//
// Reads unfinished homework from localStorage "homework" (class, name, due,
// time, finished) and mirrors it to a "HW Tracker" Google calendar.
//
// Date/time rules (the fix):
//   * "due" is a calendar date ("YYYY-MM-DD") and "time" is a local clock time.
//     Both are built into a LOCAL Date, never parsed with new Date("YYYY-MM-DD")
//     (that means midnight UTC, which is the evening before in US time zones).
//   * Events are sent to Google as local wall-clock time plus an explicit IANA
//     time zone, so Google never has to guess.
//   * Every sync also repairs events that are already on the calendar but have
//     the wrong start/end, and removes duplicate copies.
//
// Public functions used by the rest of the site (unchanged):
//   syncToGoogleCalendar, gcalAutoSync, downloadHomeworkIcs, gcalColorId
// ---------------------------------------------------------------------------

const GCAL_CLIENT_ID = "627480619372-m7mt3f59ep74fjf59g6djkctfv6el8gd.apps.googleusercontent.com";
const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
const GCAL_API = "https://www.googleapis.com/calendar/v3";
const GCAL_CONFIGURED = !GCAL_CLIENT_ID.startsWith("PASTE_");

const GCAL_DEFAULT_HOUR = 23;     // no time given -> 11:59 PM
const GCAL_DEFAULT_MINUTE = 59;
const GCAL_EVENT_MINUTES = 30;    // event length

// ----- Settings -------------------------------------------------------------

// Google event color chosen in Settings ("" = the calendar's default color).
// Values are Google's event colorIds, "1" to "11".
function gcalColorId() {
  try {
    return String(JSON.parse(localStorage.getItem("hwSettings") || "{}").gcalColor || "");
  } catch (e) { return ""; }
}

function gcalTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch (e) { return "UTC"; }
}

// ----- Date / time handling -------------------------------------------------

// Accepts "23:59", "23:59:00", "9:05 PM", "9 pm". Returns [hours, minutes] or null.
function gcalParseTime(value) {
  const m = String(value).trim().match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm)?$/i);
  if (!m) return null;
  let hh = Number(m[1]);
  const mm = m[2] ? Number(m[2]) : 0;
  const ap = m[3] ? m[3].toLowerCase() : "";
  if (ap === "pm" && hh < 12) hh += 12;
  if (ap === "am" && hh === 12) hh = 0;
  if (hh > 23 || mm > 59) return null;
  return [hh, mm];
}

// Builds a local Date and rejects impossible dates like Feb 31.
function gcalMakeLocal(y, mo, d, hh, mm) {
  const date = new Date(y, mo - 1, d, hh, mm, 0, 0);
  const ok = date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
  return ok ? date : new Date(NaN);
}

// Homework item -> local Date for when it is due (Invalid Date if unusable).
function gcalDueDate(h) {
  if (!h || !h.due) return new Date(NaN);
  const due = String(h.due).trim();
  const t = h.time ? gcalParseTime(h.time) : null;

  // Plain date: use the time field, or 11:59 PM when there isn't one.
  const plain = due.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (plain) {
    const hh = t ? t[0] : GCAL_DEFAULT_HOUR;
    const mm = t ? t[1] : GCAL_DEFAULT_MINUTE;
    return gcalMakeLocal(Number(plain[1]), Number(plain[2]), Number(plain[3]), hh, mm);
  }

  // Full timestamp (for example a Canvas "...Z" value): it already names an
  // exact moment, so read it as one and show it in local time.
  const full = new Date(due);
  if (isNaN(full)) return full;
  if (t) full.setHours(t[0], t[1], 0, 0);
  return full;
}

// Local wall-clock text for Google, with no "Z" and no offset: 2026-11-20T23:59:00
function gcalLocalStamp(d) {
  const p = n => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
    "T" + p(d.getHours()) + ":" + p(d.getMinutes()) + ":00";
}

// Start and end for one homework item, as Google expects them.
function gcalEventTimes(h, tz) {
  const start = gcalDueDate(h);
  const end = new Date(start.getTime() + GCAL_EVENT_MINUTES * 60000);
  return {
    startMs: start.getTime(),
    endMs: end.getTime(),
    start: { dateTime: gcalLocalStamp(start), timeZone: tz },
    end: { dateTime: gcalLocalStamp(end), timeZone: tz },
  };
}

// ----- Homework -------------------------------------------------------------

// Unfinished homework that has a valid due date
function gcalGetHomework() {
  let all = [];
  try { all = JSON.parse(localStorage.getItem("homework") || "[]"); } catch (e) {}
  if (!Array.isArray(all)) return [];
  return all.filter(h => h && !h.finished && h.due && !isNaN(gcalDueDate(h)));
}

// Same key format as before, so events made by older versions still match.
function gcalKey(h) {
  return (h.class + "|" + h.name + "|" + h.due + "|" + (h.time || "")).replace(/\s+/g, " ");
}

// ----- Sign-in --------------------------------------------------------------

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

function gcalClearToken() {
  try { sessionStorage.removeItem("gcalToken"); } catch (e) {}
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

// ----- Google Calendar API --------------------------------------------------

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
    if (res.status === 401) gcalClearToken(); // expired or revoked: sign in again next time
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
    body: JSON.stringify({ summary: "HW Tracker", timeZone: gcalTimeZone() }),
  });
  localStorage.setItem("gcalId", cal.id);
  return cal.id;
}

// ----- Sync -----------------------------------------------------------------

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
    const tz = gcalTimeZone();
    const color = gcalColorId();

    // What should be on the calendar: unfinished homework with a due date
    const wanted = new Map();
    gcalGetHomework().forEach(h => wanted.set(gcalKey(h), h));

    // What's already there
    setLabel("Syncing…");
    const existing = new Map();   // key -> { id, colorId, startMs, endMs }
    const duplicates = [];        // ids of extra copies of the same key
    let pageToken = "";
    do {
      const q = "?maxResults=250&singleEvents=true" +
        (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
      const data = await gcalFetch(token, base + q);
      (data.items || []).forEach(ev => {
        const k = ev.extendedProperties &&
          ev.extendedProperties.private &&
          ev.extendedProperties.private.hwKey;
        if (!k) return;
        if (existing.has(k)) { duplicates.push(ev.id); return; }
        existing.set(k, {
          id: ev.id,
          colorId: ev.colorId || "",
          // All-day events have no dateTime; 0 never matches, so they get repaired.
          startMs: ev.start && ev.start.dateTime ? new Date(ev.start.dateTime).getTime() : 0,
          endMs: ev.end && ev.end.dateTime ? new Date(ev.end.dateTime).getTime() : 0,
        });
      });
      pageToken = data.nextPageToken || "";
    } while (pageToken);

    let added = 0, removed = 0, fixed = 0, recolored = 0;

    // Remove duplicate copies
    for (const id of duplicates) {
      try {
        await gcalFetch(token, base + "/" + encodeURIComponent(id), { method: "DELETE" });
        removed++;
      } catch (e) {
        if (e.status !== 404 && e.status !== 410) throw e;
      }
    }

    // Remove events for homework that's finished, deleted, or changed
    for (const [k, ev] of existing) {
      if (wanted.has(k)) continue;
      try {
        await gcalFetch(token, base + "/" + encodeURIComponent(ev.id), { method: "DELETE" });
        removed++;
      } catch (e) {
        if (e.status !== 404 && e.status !== 410) throw e;
      }
    }

    // Add new events, and repair ones that are on the wrong time
    for (const [k, h] of wanted) {
      const times = gcalEventTimes(h, tz);
      const ev = existing.get(k);

      if (!ev) {
        await gcalFetch(token, base, {
          method: "POST",
          body: JSON.stringify({
            summary: h.name + " (" + h.class + ")",
            start: times.start,
            end: times.end,
            reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }] },
            ...(color ? { colorId: color } : {}),
            extendedProperties: { private: { hwKey: k } },
          }),
        });
        added++;
        continue;
      }

      const wrongTime = ev.startMs !== times.startMs || ev.endMs !== times.endMs;
      const wrongColor = ev.colorId !== color;
      if (!wrongTime && !wrongColor) continue;

      const patch = {};
      if (wrongTime) {
        patch.start = { ...times.start, date: null }; // date: null clears an all-day value
        patch.end = { ...times.end, date: null };
      }
      if (wrongColor) patch.colorId = color || null;

      await gcalFetch(token, base + "/" + encodeURIComponent(ev.id), {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (wrongTime) fixed++;
      if (wrongColor) recolored++;
    }

    setLabel("Synced ✓ (+" + added + " / −" + removed +
      (fixed ? " / " + fixed + " fixed" : "") +
      (recolored ? " / " + recolored + " recolored" : "") + ")");
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

// ----- .ics fallback --------------------------------------------------------

// Universal fallback: a .ics file any calendar app can import.
// Stable UIDs mean re-importing updates events instead of duplicating them.
// Times are written in UTC ("Z"), which is correct because they come from a
// real local Date.
function downloadHomeworkIcs() {
  const hw = gcalGetHomework();
  if (!hw.length) return alert("Nothing unfinished to export.");
  const pad = n => String(n).padStart(2, "0");
  const fmt = d =>
    d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
    "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + "00Z";
  const esc = x => String(x).replace(/[\\;,]/g, m => "\\" + m).replace(/\r?\n/g, "\\n");

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HW Tracker//EN"];
  hw.forEach(h => {
    const start = gcalDueDate(h);
    const end = new Date(start.getTime() + GCAL_EVENT_MINUTES * 60000);
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