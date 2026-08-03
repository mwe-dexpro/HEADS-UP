import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

/* ============================================================
   HEADS UP — lead-time reminders for calendar events
   Model: Event × Task × Lead = one nudge.
   "Done" is recorded per (event, task) and cancels every lead.
   ============================================================ */

const STORE_KEY = "headsup:v1";
const HORIZON_DAYS = 400;

/* ---------- time helpers ---------- */
const MS_DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
function daysApart(a, b) {
  return Math.round((startOfDay(a) - startOfDay(b)) / MS_DAY);
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function relative(target, now) {
  const diff = new Date(target) - now;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hrs = Math.round(abs / 3600000);
  const dys = daysApart(target, now);
  let body;
  if (mins < 60) body = `${mins}m`;
  else if (hrs < 24) body = `${hrs}h`;
  else body = `${Math.abs(dys)}d`;
  return diff >= 0 ? `in ${body}` : `${body} ago`;
}
function leadLabel(days) {
  if (days === 0) return "day of";
  if (days === 1) return "T-1d";
  return `T-${days}d`;
}
const uid = () => Math.random().toString(36).slice(2, 9);

/* ---------- ICS parsing ---------- */
function unfold(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "");
}
function unescapeText(v) {
  return v
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}
function unescapeMultiline(v) {
  return v
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}
/* Outlook packs a Teams block after a long underscore rule — drop it. */
function cleanDescription(v) {
  let t = unescapeMultiline(v);
  t = t.split(/_{8,}/)[0];
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return t.slice(0, 700);
}
function recurrenceLabel(rrule) {
  if (!rrule || !rrule.FREQ) return "";
  const f = rrule.FREQ.toUpperCase();
  const n = Math.max(1, parseInt(rrule.INTERVAL || "1", 10));
  const simple = { DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly", YEARLY: "yearly" };
  const unit = { DAILY: "days", WEEKLY: "weeks", MONTHLY: "months", YEARLY: "years" };
  if (!simple[f]) return "repeats";
  return n === 1 ? simple[f] : `every ${n} ${unit[f]}`;
}
function parseLine(line) {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = left.split(";");
  const name = parts[0].toUpperCase();
  const params = {};
  parts.slice(1).forEach((p) => {
    const eq = p.indexOf("=");
    if (eq > -1) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  });
  return { name, params, value };
}
function parseDT(value, params) {
  const v = value.trim();
  const isDateOnly = params.VALUE === "DATE" || /^\d{8}$/.test(v);
  const y = +v.slice(0, 4),
    mo = +v.slice(4, 6) - 1,
    d = +v.slice(6, 8);
  if (isDateOnly) return { date: new Date(y, mo, d, 0, 0, 0, 0), allDay: true };
  const h = +v.slice(9, 11) || 0,
    mi = +v.slice(11, 13) || 0,
    s = +v.slice(13, 15) || 0;
  // Trailing Z = UTC. A TZID is honoured as local time (best effort, no tz database).
  const date = v.endsWith("Z")
    ? new Date(Date.UTC(y, mo, d, h, mi, s))
    : new Date(y, mo, d, h, mi, s);
  return { date, allDay: false };
}
function parseRRule(value) {
  const o = {};
  value.split(";").forEach((p) => {
    const [k, v] = p.split("=");
    if (k) o[k.toUpperCase()] = v;
  });
  return o;
}
function expandRecurrence(start, rrule, exdates, horizon) {
  if (!rrule) return [start];
  const freq = (rrule.FREQ || "").toUpperCase();
  const interval = Math.max(1, parseInt(rrule.INTERVAL || "1", 10));
  const count = rrule.COUNT ? parseInt(rrule.COUNT, 10) : null;
  const until = rrule.UNTIL ? parseDT(rrule.UNTIL, {}).date : null;
  const out = [];
  let cur = new Date(start);
  let guard = 0;
  const skip = new Set(exdates.map(dayKey));
  while (guard++ < 800) {
    if (until && cur > until) break;
    if (cur > horizon) break;
    if (!skip.has(dayKey(cur))) out.push(new Date(cur));
    if (count && out.length >= count) break;
    const next = new Date(cur);
    if (freq === "DAILY") next.setDate(next.getDate() + interval);
    else if (freq === "WEEKLY") next.setDate(next.getDate() + 7 * interval);
    else if (freq === "MONTHLY") next.setMonth(next.getMonth() + interval);
    else if (freq === "YEARLY") next.setFullYear(next.getFullYear() + interval);
    else break;
    cur = next;
  }
  return out;
}
function parseICS(text) {
  const lines = unfold(text).split("\n");
  const events = [];
  let cur = null;
  const horizon = new Date(Date.now() + HORIZON_DAYS * MS_DAY);
  const floor = startOfDay(new Date(Date.now() - MS_DAY));
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.toUpperCase() === "BEGIN:VEVENT") {
      cur = { exdates: [] };
      continue;
    }
    if (line.toUpperCase() === "END:VEVENT") {
      if (cur && cur.start && cur.title) {
        const occurrences = expandRecurrence(
          cur.start,
          cur.rrule,
          cur.exdates,
          horizon
        );
        occurrences.forEach((occ) => {
          if (occ < floor) return;
          events.push({
            id: `${cur.uid || uid()}@${dayKey(occ)}`,
            title: cur.title,
            start: occ.toISOString(),
            allDay: !!cur.allDay,
            location: cur.location || "",
            description: cur.description || "",
            recurring: !!cur.rrule,
            repeats: recurrenceLabel(cur.rrule),
            organizer: cur.organizer || null,
            tasks: [],
            source: "ics",
          });
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === "SUMMARY") cur.title = unescapeText(p.value);
    else if (p.name === "LOCATION") cur.location = unescapeText(p.value);
    else if (p.name === "DESCRIPTION") cur.description = cleanDescription(p.value);
    else if (p.name === "UID") cur.uid = p.value.trim();
    else if (p.name === "DTSTART") {
      const { date, allDay } = parseDT(p.value, p.params);
      if (!isNaN(date)) {
        cur.start = date;
        cur.allDay = allDay;
      }
    } else if (p.name === "ORGANIZER") {
      cur.organizer = {
        name: p.params.CN ? unescapeText(p.params.CN.replace(/^"|"$/g, "")) : "",
        email: p.value.replace(/^mailto:/i, "").trim(),
      };
    } else if (p.name === "RRULE") cur.rrule = parseRRule(p.value);
    else if (p.name === "EXDATE") {
      p.value.split(",").forEach((v) => {
        const { date } = parseDT(v, p.params);
        if (!isNaN(date)) cur.exdates.push(date);
      });
    }
  }
  return events;
}

/* ---------- default rules ---------- */
function defaultRules() {
  const r = (name, keywords, tasks) => ({
    id: uid(),
    name,
    keywords,
    enabled: true,
    tasks: tasks.map((t) => ({ id: uid(), label: t[0], leads: t[1] })),
  });
  return [
    r("Birthday", ["birthday", "bday", "b-day", "geburtstag"], [
      ["Buy a present", [{ days: 10, hour: 9 }, { days: 5, hour: 9 }, { days: 2, hour: 18 }]],
      ["Write the card", [{ days: 1, hour: 19 }, { days: 0, hour: 8 }]],
    ]),
    r("Trip or flight", ["flight", "trip", "travel", "vacation", "holiday", "hotel", "airport", "train"], [
      ["Check documents and check in", [{ days: 2, hour: 18 }]],
      ["Pack your bag", [{ days: 1, hour: 8 }, { days: 1, hour: 20 }]],
    ]),
    r("Wedding or party", ["wedding", "party", "celebration", "anniversary"], [
      ["Sort a gift and an outfit", [{ days: 7, hour: 9 }, { days: 2, hour: 9 }]],
    ]),
    r("Presentation", ["presentation", "interview", "pitch", "demo", "review"], [
      ["Prepare and rehearse", [{ days: 3, hour: 9 }, { days: 1, hour: 17 }]],
    ]),
    r("Appointment", ["doctor", "dentist", "appointment", "checkup", "physio", "clinic"], [
      ["Bring documents and insurance card", [{ days: 1, hour: 18 }]],
    ]),
    r("Booking", ["dinner", "restaurant", "reservation", "table"], [
      ["Confirm the booking", [{ days: 1, hour: 10 }]],
    ]),
  ];
}
function sampleEvents() {
  const mk = (title, offsetDays, hour, allDay, extra = {}) => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() + offsetDays);
    if (!allDay) d.setHours(hour, 0, 0, 0);
    return {
      id: `sample-${uid()}`,
      title,
      start: d.toISOString(),
      allDay,
      location: "",
      description: "",
      recurring: false,
      repeats: "",
      organizer: null,
      tasks: [],
      source: "sample",
      ...extra,
    };
  };
  return [
    mk("Anna's birthday", 7, 0, true, {
      recurring: true,
      repeats: "yearly",
      description: "She mentioned the ceramics place on Kastanienallee.",
    }),
    mk("Trip to Lisbon — flight LH1178", 4, 7, false, {
      location: "Terminal 1, Berlin Brandenburg (BER)",
      description:
        "Seat 14A, boarding 06:35.\nPassport, not the ID card — it expires in October.",
    }),
    mk("Dentist appointment", 11, 15, false, {
      location: "Dr. Reinhardt, Bergmannstraße 42",
    }),
  ];
}
/* ---------- to-do lists ---------- */
const ACCENTS = ["#6aa9e0", "#5fd3a6", "#ffb020", "#a98bd8", "#4fbfb0", "#e08a7a"];
const nextAccent = (lists) => ACCENTS[lists.length % ACCENTS.length];

function defaultLists() {
  const inDays = (n, h = 12) => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() + n);
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
  };
  return [
    {
      id: "list-house",
      name: "House related",
      accent: ACCENTS[0],
      items: [
        {
          id: uid(),
          title: "Answer email from lawyer",
          notes: "Reply by Thursday — he needs the signed page back.",
          due: inDays(3, 12),
          reminders: [{ kind: "lead", days: 1, hour: 9 }],
          done: false,
          subtasks: [
            { id: uid(), title: "Assess court documents", due: null, reminders: [], done: false },
            {
              id: uid(),
              title: "Review appeal",
              due: inDays(2, 18),
              reminders: [{ kind: "lead", days: 0, hour: 18 }],
              done: false,
            },
          ],
        },
      ],
    },
    {
      id: "list-buy",
      name: "Things to buy",
      accent: ACCENTS[1],
      items: [
        {
          id: uid(),
          title: "Present for Anna",
          notes: "Ceramics place on Kastanienallee. Allow a week for delivery.",
          due: inDays(7, 9),
          reminders: [{ kind: "lead", days: 5, hour: 10 }],
          done: false,
          subtasks: [],
        },
        {
          id: uid(),
          title: "New shower head",
          notes: "",
          due: null,
          reminders: [],
          done: false,
          subtasks: [],
        },
      ],
    },
  ];
}

const defaultData = () => {
  const events = sampleEvents();
  const seen = {};
  events.forEach((e) => {
    seen[e.id] = new Date().toISOString();
  });
  return {
    events,
    rules: defaultRules(),
    lists: defaultLists(),
    state: { done: {}, snoozed: {}, notified: [], seen, muted: {} },
    settings: {
      fallback: true,
      fallbackHour: 20,
      watchNew: false,
      watchOnlyOthers: true,
      myEmail: "",
      todoAutoRemind: true,
      todoAutoHour: 9,
    },
  };
};

/* ---------- nudge engine ---------- */
function matchRules(event, rules) {
  const t = event.title.toLowerCase();
  return rules.filter(
    (r) => r.enabled && r.keywords.some((k) => k && t.includes(k.toLowerCase()))
  );
}
function buildNudges(data) {
  const { events, rules, state, settings } = data;
  const out = [];
  events.forEach((ev) => {
    if (state.muted && state.muted[ev.id]) return;
    const start = new Date(ev.start);
    const matched = matchRules(ev, rules);
    const tasks = [];
    matched.forEach((rule) =>
      rule.tasks.forEach((task) =>
        tasks.push({ rule: rule.name, ruleId: rule.id, task })
      )
    );
    (ev.tasks || []).forEach((task) =>
      tasks.push({ rule: "You added this one", ruleId: "custom", task })
    );
    if (!tasks.length && settings.fallback) {
      tasks.push({
        rule: "No rule matched",
        ruleId: "fallback",
        task: {
          id: "fallback",
          label: "Heads up — anything to prepare?",
          leads: [{ days: 1, hour: settings.fallbackHour }],
        },
      });
    }
    tasks.forEach(({ rule, ruleId, task }) => {
      const doneKey = `${ev.id}::${ruleId}::${task.id}`;
      const doneAt = state.done[doneKey];
      task.leads.forEach((lead) => {
        const due = startOfDay(start);
        due.setDate(due.getDate() - lead.days);
        due.setHours(lead.hour || 0, lead.minute || 0, 0, 0);
        const snoozeKey = `${doneKey}::${lead.days}:${lead.hour}`;
        const snoozedTo = state.snoozed[snoozeKey];
        out.push({
          id: snoozeKey,
          doneKey,
          eventId: ev.id,
          eventTitle: ev.title,
          eventStart: ev.start,
          allDay: ev.allDay,
          location: ev.location,
          event: ev,
          ruleName: rule,
          label: task.label,
          lead: lead.days,
          dueAt: (snoozedTo ? new Date(snoozedTo) : due).toISOString(),
          baseDueAt: due.toISOString(),
          done: !!doneAt,
          snoozed: !!snoozedTo,
        });
      });
    });
  });
  out.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  return out;
}

/* ---------- to-do nudge engine ----------
   A second, independent source. buildNudges (events) is untouched; the two
   streams are merged and sorted by due time in allNudges(). A to-do's
   completion lives on the item itself, not in state.done — it is intrinsic
   data, not reminder state.                                              */
function resolveReminder(rem, anchorISO) {
  if (!rem) return null;
  if (rem.kind === "at") {
    const d = new Date(rem.at);
    return isNaN(d) ? null : d;
  }
  if (!anchorISO) return null;
  const d = startOfDay(new Date(anchorISO));
  d.setDate(d.getDate() - (rem.days || 0));
  d.setHours(rem.hour || 0, 0, 0, 0);
  return d;
}

function buildTodoNudges(data) {
  const { lists = [], state, settings } = data;
  const out = [];
  lists.forEach((list) => {
    (list.items || []).forEach((item) => {
      const emit = (owner, subId) => {
        const anchor = owner.due || (subId ? item.due : null);
        let rems = owner.reminders || [];
        if (!rems.length && anchor && settings.todoAutoRemind) {
          rems = [
            { kind: "lead", days: 0, hour: settings.todoAutoHour ?? 9, implicit: true },
          ];
        }
        const base = `todo::${list.id}::${item.id}::${subId || "-"}`;
        rems.forEach((rem, i) => {
          const due = resolveReminder(rem, anchor);
          if (!due) return;
          const nid = `${base}::${i}`;
          const snoozedTo = state.snoozed[nid];
          out.push({
            kind: "todo",
            id: nid,
            doneKey: base,
            listId: list.id,
            listName: list.name,
            accent: list.accent || ACCENTS[0],
            itemId: item.id,
            subId: subId || null,
            label: owner.title,
            parentTitle: subId ? item.title : null,
            notes: subId ? "" : item.notes || "",
            anchor,
            lead: rem.kind === "lead" ? rem.days : null,
            implicit: !!rem.implicit,
            dueAt: (snoozedTo ? new Date(snoozedTo) : due).toISOString(),
            baseDueAt: due.toISOString(),
            done: !!(item.done || owner.done),
            snoozed: !!snoozedTo,
          });
        });
      };
      emit(item, null);
      (item.subtasks || []).forEach((st) => emit(st, st.id));
    });
  });
  return out;
}

function allNudges(data) {
  return [...buildNudges(data), ...buildTodoNudges(data)].sort(
    (a, b) => new Date(a.dueAt) - new Date(b.dueAt)
  );
}

/* Events that appeared in the calendar and haven't been reviewed yet. */
function unreviewedEvents(data, now) {
  const { settings, state, events } = data;
  if (!settings.watchNew) return [];
  const me = (settings.myEmail || "").trim().toLowerCase();
  return events
    .filter((e) => !state.seen[e.id])
    .filter((e) => new Date(e.start) >= startOfDay(now))
    .filter((e) => {
      if (!settings.watchOnlyOthers || !me) return true;
      if (!e.organizer || !e.organizer.email) return true;
      return e.organizer.email.toLowerCase() !== me;
    })
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}

/* ---------- storage ---------- */
async function loadData() {
  try {
    const res = await window.storage.get(STORE_KEY);
    if (res && res.value) {
      const parsed = JSON.parse(res.value);
      return {
        ...defaultData(),
        ...parsed,
        lists: parsed.lists || [],
        state: {
          done: {},
          snoozed: {},
          notified: [],
          seen: {},
          muted: {},
          ...(parsed.state || {}),
        },
        settings: { ...defaultData().settings, ...(parsed.settings || {}) },
      };
    }
  } catch (e) {
    /* first run — no key yet */
  }
  return null;
}

/* ============================================================
   UI
   ============================================================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

.hu {
  --ink:#0d151d; --panel:#152130; --panel-2:#1b2a3a; --rule:#26384a;
  --ice:#e8eff5; --mist:#8ba0b3; --dim:#78899b;
  --amber:#ffb020; --amber-dim:#7a5411; --mint:#5fd3a6;
  --display:'Barlow Condensed','Oswald','Arial Narrow',system-ui,sans-serif;
  --body:'IBM Plex Sans',system-ui,-apple-system,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,'SF Mono',monospace;
  background:var(--ink); color:var(--ice); font-family:var(--body);
  min-height:100vh; -webkit-font-smoothing:antialiased;
}
.hu *,.hu *::before,.hu *::after{box-sizing:border-box;}
.hu-wrap{max-width:560px;margin:0 auto;padding:18px 16px 104px;}

/* header */
.hu-top{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:22px;}
.hu-mark{font-family:var(--display);font-weight:700;font-size:30px;line-height:.9;
  letter-spacing:.06em;text-transform:uppercase;}
.hu-mark span{color:var(--amber);}
.hu-clock{font-family:var(--mono);font-size:11px;color:var(--mist);text-align:right;line-height:1.5;}

/* section label */
.hu-eyebrow{display:flex;align-items:center;gap:10px;margin:26px 0 12px;
  font-family:var(--display);font-size:13px;font-weight:600;letter-spacing:.16em;
  text-transform:uppercase;color:var(--mist);}
.hu-eyebrow::after{content:"";flex:1;height:1px;background:var(--rule);}
.hu-count{font-family:var(--mono);font-size:10px;color:var(--dim);letter-spacing:0;}

/* cards */
.hu-card{background:var(--panel);border:1px solid var(--rule);border-radius:3px;
  padding:14px;margin-bottom:8px;}
.hu-card.is-live{background:linear-gradient(180deg,#231a09,#17212e);
  border-color:var(--amber-dim);}
.hu-card.is-done{opacity:.42;}
.hu-lead{font-family:var(--mono);font-size:10px;letter-spacing:.1em;color:var(--dim);
  text-transform:uppercase;display:flex;gap:8px;align-items:center;margin-bottom:6px;
  flex-wrap:wrap;min-width:0;}
.hu-card.is-live .hu-lead{color:var(--amber);}
.hu-task{font-size:16px;font-weight:600;line-height:1.25;}
.hu-card.is-done .hu-task{text-decoration:line-through;}
.hu-ctx{font-size:12.5px;color:var(--mist);margin-top:4px;line-height:1.45;}
.hu-ctx b{color:var(--ice);font-weight:500;}
.hu-acts{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;}

/* buttons */
.hu-btn{font-family:var(--body);font-size:12px;font-weight:600;letter-spacing:.02em;
  padding:7px 12px;border-radius:2px;border:1px solid var(--rule);
  background:var(--panel-2);color:var(--ice);cursor:pointer;}
.hu-btn:hover{border-color:var(--mist);}
.hu-btn:focus-visible{outline:2px solid var(--amber);outline-offset:2px;}
.hu-btn.primary{background:var(--amber);border-color:var(--amber);color:#1a1204;}
.hu-btn.ghost{background:transparent;color:var(--mist);}
.hu-btn.danger{background:transparent;color:#e08a7a;border-color:#4a2b26;}
.hu-btn.tiny{font-size:11px;padding:5px 9px;}
.hu-btn:disabled{opacity:.35;cursor:not-allowed;}
.hu-btn:disabled:hover{border-color:var(--rule);}

/* signature: approach track */
.hu-appr{background:var(--panel);border:1px solid var(--rule);border-radius:3px;
  padding:14px;margin-bottom:8px;}
.hu-appr-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;}
.hu-appr-title{font-size:14.5px;font-weight:600;line-height:1.3;}
.hu-appr-when{font-family:var(--mono);font-size:10.5px;color:var(--mist);
  white-space:nowrap;text-align:right;}
.hu-track{position:relative;height:34px;margin-top:14px;}
.hu-rail{position:absolute;left:0;right:0;top:16px;height:1px;background:var(--rule);}
.hu-fill{position:absolute;left:0;top:16px;height:1px;background:var(--amber);}
.hu-tick{position:absolute;top:10px;width:1px;height:13px;background:var(--dim);
  transform:translateX(-.5px);}
.hu-tick.past{background:var(--amber);}
.hu-tick.done{background:var(--mint);}
.hu-dot{position:absolute;top:13px;width:7px;height:7px;border-radius:50%;
  background:var(--ink);border:1.5px solid var(--dim);transform:translateX(-3.5px);}
.hu-dot.past{border-color:var(--amber);background:var(--amber);}
.hu-dot.done{border-color:var(--mint);background:var(--mint);}
.hu-now{position:absolute;top:4px;bottom:4px;width:1px;background:var(--ice);}
.hu-now::after{content:"NOW";position:absolute;top:-2px;left:5px;font-family:var(--mono);
  font-size:8px;letter-spacing:.12em;color:var(--ice);}
.hu-flag{position:absolute;right:0;top:6px;font-family:var(--mono);font-size:9px;
  color:var(--mist);letter-spacing:.1em;}
.hu-appr-legend{display:flex;gap:12px;flex-wrap:wrap;margin-top:2px;
  font-family:var(--mono);font-size:10px;color:var(--dim);}

/* forms */
.hu-field{margin-bottom:12px;}
.hu-label{display:block;font-family:var(--display);font-size:12px;font-weight:600;
  letter-spacing:.12em;text-transform:uppercase;color:var(--mist);margin-bottom:6px;}
.hu-input,.hu-area{width:100%;background:var(--ink);border:1px solid var(--rule);
  border-radius:2px;color:var(--ice);font-family:var(--body);font-size:14px;padding:9px 10px;}
.hu-area{font-family:var(--mono);font-size:11.5px;min-height:110px;resize:vertical;}
.hu-input:focus,.hu-area:focus{outline:none;border-color:var(--amber);}
.hu-row{display:flex;gap:8px;align-items:center;}
.hu-num{width:64px;background:var(--ink);border:1px solid var(--rule);border-radius:2px;
  color:var(--ice);font-family:var(--mono);font-size:13px;padding:7px 8px;}

/* chips */
.hu-chip{display:inline-flex;align-items:center;gap:6px;background:var(--panel-2);
  border:1px solid var(--rule);border-radius:2px;padding:4px 8px;margin:0 5px 5px 0;
  font-family:var(--mono);font-size:11px;color:var(--ice);}
.hu-chip button{background:none;border:none;color:var(--dim);cursor:pointer;
  font-size:13px;line-height:1;padding:0;}
.hu-chip button:hover{color:#e08a7a;}

/* empty + notes */
.hu-empty{border:1px dashed var(--rule);border-radius:3px;padding:22px 16px;text-align:center;}
.hu-empty p{color:var(--mist);font-size:13px;margin:0 0 14px;line-height:1.5;}
.hu-note{font-size:12px;color:var(--dim);line-height:1.55;margin:10px 0 0;}
.hu-warn{border-left:2px solid var(--amber);padding:8px 0 8px 11px;font-size:12px;
  color:var(--mist);line-height:1.55;margin-bottom:14px;}

/* tabs */
.hu-tabs{position:fixed;left:0;right:0;bottom:0;background:rgba(13,21,29,.96);
  border-top:1px solid var(--rule);backdrop-filter:blur(8px);
  padding-bottom:env(safe-area-inset-bottom);}
.hu-tabs-in{max-width:560px;margin:0 auto;display:grid;}
.hu-tab{background:none;border:none;padding:13px 3px;cursor:pointer;
  font-family:var(--display);font-size:12px;font-weight:600;letter-spacing:.08em;
  text-transform:uppercase;color:var(--dim);border-top:2px solid transparent;margin-top:-1px;
  white-space:nowrap;}
.hu-tab.on{color:var(--amber);border-top-color:var(--amber);}
.hu-tab:focus-visible{outline:2px solid var(--amber);outline-offset:-4px;}
.hu-badge{display:inline-block;min-width:16px;margin-left:4px;padding:0 4px;
  background:var(--amber);color:#1a1204;border-radius:8px;font-family:var(--mono);
  font-size:9.5px;line-height:16px;}
.hu-badge.mint{background:var(--mint);color:#0a2a1e;}

.hu-sub{font-size:13px;color:var(--mist);line-height:1.55;margin:0 0 16px;}
.hu-list{margin:0;padding:0;list-style:none;}
.hu-taskline{display:flex;justify-content:space-between;gap:10px;padding:7px 0;
  border-bottom:1px solid var(--rule);font-size:13px;}
.hu-taskline:last-child{border-bottom:none;}
.hu-taskline em{font-family:var(--mono);font-size:10.5px;color:var(--mist);font-style:normal;}

/* event signals — a stable top-right cluster, quiet until you look for it */
.hu-leadrow{display:flex;justify-content:space-between;align-items:center;gap:10px;
  margin-bottom:6px;}
.hu-leadrow .hu-lead{margin-bottom:0;}
.hu-badges{display:inline-flex;align-items:center;gap:5px;flex:none;}
.hu-pill{font-family:var(--mono);font-size:10px;letter-spacing:.09em;text-transform:uppercase;
  border:1px solid var(--rule);border-radius:2px;padding:1px 5px;color:var(--mist);
  white-space:nowrap;}
.hu-glyph{font-family:var(--mono);font-size:12px;line-height:1;color:var(--dim);}

/* key/value table — the shared shape for every card body */
.hu-kv{display:grid;grid-template-columns:54px 1fr;gap:6px 10px;
  font-size:13px;line-height:1.45;}
.hu-kv.top{margin-top:11px;padding-top:11px;border-top:1px solid var(--rule);}
.hu-k{font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;
  color:var(--dim);padding-top:2px;}
.hu-v{color:var(--ice);min-width:0;overflow-wrap:anywhere;}
.hu-v.quiet{color:var(--mist);}
.hu-v.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  overflow:hidden;}
.hu-detail{margin-top:11px;padding-top:11px;border-top:1px solid var(--rule);}
.hu-notes{margin-top:9px;white-space:pre-wrap;color:var(--mist);font-size:12.5px;
  max-height:190px;overflow:auto;}

/* header control + segmented sub-navigation */
.hu-topright{display:flex;align-items:center;gap:10px;}
.hu-gear{background:none;border:1px solid var(--rule);border-radius:2px;color:var(--mist);
  width:32px;height:32px;font-size:15px;line-height:1;cursor:pointer;flex:none;}
.hu-gear:hover{border-color:var(--mist);color:var(--ice);}
.hu-gear.on{border-color:var(--amber);color:var(--amber);}
.hu-gear:focus-visible{outline:2px solid var(--amber);outline-offset:2px;}
.hu-seg{display:flex;gap:0;border:1px solid var(--rule);border-radius:2px;overflow:hidden;
  margin-bottom:20px;}
.hu-seg button{flex:1;background:none;border:none;border-right:1px solid var(--rule);
  padding:9px 6px;cursor:pointer;font-family:var(--display);font-size:13px;font-weight:600;
  letter-spacing:.1em;text-transform:uppercase;color:var(--mist);white-space:nowrap;}
.hu-seg button:last-child{border-right:none;}
.hu-seg button.on{background:var(--panel-2);color:var(--ice);}
.hu-seg button:focus-visible{outline:2px solid var(--amber);outline-offset:-3px;}

/* rules: collapsed summaries + the test box */
.hu-probe{background:var(--panel);border:1px solid var(--rule);border-left:2px solid var(--amber);
  border-radius:3px;padding:14px;margin-bottom:20px;}
.hu-fire{margin-top:12px;padding-top:12px;border-top:1px solid var(--rule);}
.hu-fireline{display:flex;justify-content:space-between;gap:10px;padding:6px 0;font-size:13px;}
.hu-fireline em{font-family:var(--mono);font-size:10.5px;color:var(--mist);font-style:normal;
  white-space:nowrap;}
.hu-summary{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;}
.hu-rulename{font-size:15px;font-weight:600;line-height:1.25;}
.hu-keys{margin-top:8px;}
.hu-stat{margin-top:9px;font-family:var(--mono);font-size:10px;letter-spacing:.06em;
  text-transform:uppercase;color:var(--dim);display:flex;gap:9px;flex-wrap:wrap;}
.hu-stat .zero{color:#e08a7a;}
.hu-flag-warn{margin-top:10px;border-left:2px solid #e08a7a;padding:6px 0 6px 10px;
  font-size:12px;color:var(--mist);line-height:1.5;}
.hu-off{opacity:.5;}

/* undo — reversibility instead of confirmation dialogs */
.hu-undo{position:fixed;left:0;right:0;bottom:calc(56px + env(safe-area-inset-bottom));
  z-index:20;padding:0 16px;pointer-events:none;}
.hu-undo-in{max-width:560px;margin:0 auto;display:flex;align-items:center;gap:12px;
  background:var(--panel-2);border:1px solid var(--rule);border-left:2px solid var(--amber);
  border-radius:3px;padding:11px 13px;pointer-events:auto;
  box-shadow:0 8px 24px rgba(0,0,0,.45);}
.hu-undo-in p{margin:0;flex:1;font-size:13px;line-height:1.35;color:var(--ice);}
@media (prefers-reduced-motion:no-preference){
  .hu-undo-in{animation:huRise .22s ease both;}
  @keyframes huRise{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
}

/* to-do lists */
.hu-listbar{display:flex;gap:6px;overflow-x:auto;margin-bottom:16px;padding-bottom:3px;
  -webkit-overflow-scrolling:touch;}
.hu-listchip{display:inline-flex;align-items:center;gap:7px;flex:none;cursor:pointer;
  background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:7px 11px;
  font-family:var(--body);font-size:12.5px;font-weight:500;color:var(--mist);white-space:nowrap;}
.hu-listchip.on{background:var(--panel-2);color:var(--ice);border-color:var(--mist);}
.hu-listchip:focus-visible{outline:2px solid var(--amber);outline-offset:2px;}
.hu-listchip em{font-family:var(--mono);font-size:10px;color:var(--dim);font-style:normal;}
.hu-seed{width:7px;height:7px;border-radius:50%;flex:none;display:inline-block;}
.hu-item{display:flex;gap:11px;align-items:flex-start;padding:12px 0;
  border-bottom:1px solid var(--rule);}
.hu-item:last-child{border-bottom:none;}
.hu-circle{width:17px;height:17px;border:1px solid var(--dim);border-radius:50%;flex:none;
  background:none;cursor:pointer;margin-top:2px;padding:0;position:relative;}
.hu-circle.on{background:var(--mint);border-color:var(--mint);}
.hu-circle.on::after{content:"✓";position:absolute;inset:0;font-size:11px;line-height:15px;
  color:#0a2a1e;text-align:center;}
.hu-circle:focus-visible{outline:2px solid var(--amber);outline-offset:2px;}
.hu-itembody{flex:1;min-width:0;}
.hu-itemt{font-size:14px;line-height:1.35;color:var(--ice);overflow-wrap:anywhere;}
.hu-item.is-off .hu-itemt{text-decoration:line-through;color:var(--dim);}
.hu-itemm{display:flex;gap:9px;flex-wrap:wrap;margin-top:5px;font-family:var(--mono);
  font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);}
.hu-itemm .late{color:#e08a7a;}
.hu-itemm .set{color:var(--amber);}
.hu-steps{margin-top:11px;padding-left:11px;border-left:1px solid var(--rule);}
.hu-editor{margin-top:12px;padding-top:12px;border-top:1px solid var(--rule);}

/* new-in-calendar */
.hu-card.is-new{border-left:2px solid var(--mint);}
.hu-who{font-family:var(--mono);font-size:10px;color:var(--mint);letter-spacing:.09em;
  text-transform:uppercase;}
.hu-switch{display:flex;align-items:flex-start;gap:11px;padding:11px 0;
  border-bottom:1px solid var(--rule);}
.hu-switch:last-child{border-bottom:none;}
.hu-switch p{margin:0;font-size:13px;line-height:1.4;}
.hu-switch small{display:block;color:var(--dim);font-size:11.5px;margin-top:3px;line-height:1.45;}
.hu-preset{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px;}
.hu-check{display:flex;gap:9px;align-items:flex-start;font-size:13px;line-height:1.45;
  color:var(--ice);margin:12px 0;}
.hu-check input{margin:3px 0 0;accent-color:var(--amber);}
.hu-mini{border-top:1px solid var(--rule);margin-top:11px;padding-top:11px;}

@media (prefers-reduced-motion:no-preference){
  .hu-fade{animation:huFade .32s ease both;}
  @keyframes huFade{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
}
`;

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export default function HeadsUp() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("upcoming");
  const [toast, setToast] = useState("");
  const [notifyState, setNotifyState] = useState("unknown");
  const now = useNow();
  const saveTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    loadData().then((d) => {
      if (alive) setData(d || defaultData());
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    try {
      if (typeof Notification !== "undefined") setNotifyState(Notification.permission);
      else setNotifyState("unsupported");
    } catch (e) {
      setNotifyState("unsupported");
    }
  }, []);

  const persist = useCallback((next) => {
    setData(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set(STORE_KEY, JSON.stringify(next), false);
      } catch (e) {
        setToast("Couldn't save — changes stay for this session only.");
      }
    }, 400);
  }, []);

  /* Destructive actions snapshot the whole state object, so undo is a single
     restore rather than an inverse operation per action type. */
  const [undoTip, setUndoTip] = useState(null);
  const undoTimer = useRef(null);
  const undoable = useCallback(
    (next, label) => {
      setUndoTip({ label, snapshot: data, at: Date.now() });
      persist(next);
    },
    [data, persist]
  );
  useEffect(() => {
    if (!undoTip) return undefined;
    undoTimer.current = setTimeout(() => setUndoTip(null), 9000);
    return () => clearTimeout(undoTimer.current);
  }, [undoTip]);
  const runUndo = () => {
    if (!undoTip) return;
    persist(undoTip.snapshot);
    setUndoTip(null);
  };

  const nudges = useMemo(() => (data ? allNudges(data) : []), [data]);
  const unreviewed = useMemo(
    () => (data ? unreviewedEvents(data, now) : []),
    [data, now]
  );
  const live = nudges.filter((n) => !n.done && new Date(n.dueAt) <= now);
  const ahead = nudges.filter((n) => !n.done && new Date(n.dueAt) > now);

  /* fire browser notifications for newly due nudges while open */
  useEffect(() => {
    if (!data || notifyState !== "granted" || !live.length) return;
    const seen = new Set(data.state.notified || []);
    const fresh = live.filter((n) => !seen.has(n.id));
    if (!fresh.length) return;
    fresh.forEach((n) => {
      try {
        new Notification(n.label, {
          body:
            n.kind === "todo"
              ? `${n.listName}${n.anchor ? ` — due ${fmtDate(n.anchor)}` : ""}`
              : `${n.eventTitle} — ${relative(n.eventStart, now)}`,
          tag: n.id,
        });
      } catch (e) {
        /* blocked in this context */
      }
    });
    persist({
      ...data,
      state: {
        ...data.state,
        notified: [...seen, ...fresh.map((n) => n.id)].slice(-400),
      },
    });
  }, [live.length, notifyState, data, now, persist]);

  if (!data) {
    return (
      <div className="hu">
        <style>{CSS}</style>
        <div className="hu-wrap">
          <div className="hu-eyebrow">Loading</div>
          <div className="hu-card" style={{ height: 74 }} />
          <div className="hu-card" style={{ height: 74 }} />
        </div>
      </div>
    );
  }

  const updateItem = (next, listId, itemId, fn) => ({
    ...next,
    lists: next.lists.map((l) =>
      l.id !== listId
        ? l
        : { ...l, items: l.items.map((it) => (it.id !== itemId ? it : fn(it))) }
    ),
  });

  const setTodoDone = (n, value) => {
    persist(
      updateItem(data, n.listId, n.itemId, (it) =>
        n.subId
          ? {
              ...it,
              subtasks: it.subtasks.map((st) =>
                st.id === n.subId
                  ? { ...st, done: value, doneAt: value ? new Date().toISOString() : null }
                  : st
              ),
            }
          : { ...it, done: value, doneAt: value ? new Date().toISOString() : null }
      )
    );
  };

  const markDone = (n) => {
    if (n.kind === "todo") return setTodoDone(n, true);
    persist({
      ...data,
      state: {
        ...data.state,
        done: { ...data.state.done, [n.doneKey]: new Date().toISOString() },
      },
    });
  };
  const undo = (n) => {
    if (n.kind === "todo") return setTodoDone(n, false);
    const done = { ...data.state.done };
    delete done[n.doneKey];
    persist({ ...data, state: { ...data.state, done } });
  };
  const snooze = (n, hours) => {
    const to = new Date(Date.now() + hours * 3600000).toISOString();
    persist({
      ...data,
      state: { ...data.state, snoozed: { ...data.state.snoozed, [n.id]: to } },
    });
  };

  const markSeen = (ids) => {
    const stamp = new Date().toISOString();
    const seen = { ...data.state.seen };
    ids.forEach((id) => {
      seen[id] = stamp;
    });
    persist({ ...data, state: { ...data.state, seen } });
  };
  const toggleMute = (id) => {
    const muted = { ...data.state.muted };
    if (muted[id]) delete muted[id];
    else muted[id] = true;
    const seen = { ...data.state.seen, [id]: new Date().toISOString() };
    persist({ ...data, state: { ...data.state, muted, seen } });
  };
  const addTask = (eventId, task) => {
    persist({
      ...data,
      events: data.events.map((e) =>
        e.id === eventId
          ? { ...e, tasks: [...(e.tasks || []), { id: uid(), ...task }] }
          : e
      ),
      state: {
        ...data.state,
        seen: { ...data.state.seen, [eventId]: new Date().toISOString() },
      },
    });
  };
  const removeTask = (eventId, taskId) =>
    persist({
      ...data,
      events: data.events.map((e) =>
        e.id === eventId
          ? { ...e, tasks: (e.tasks || []).filter((t) => t.id !== taskId) }
          : e
      ),
    });

  const requestNotify = async () => {
    try {
      const p = await Notification.requestPermission();
      setNotifyState(p);
    } catch (e) {
      setNotifyState("unsupported");
    }
  };

  return (
    <div className="hu">
      <style>{CSS}</style>
      <div className="hu-wrap">
        <header className="hu-top">
          <div className="hu-mark">
            Heads<span>·</span>Up
          </div>
          <div className="hu-topright">
            <div className="hu-clock">
              {fmtDate(now)}
              <br />
              {fmtTime(now)}
            </div>
            <button
              className={`hu-gear ${tab === "settings" ? "on" : ""}`}
              onClick={() => setTab(tab === "settings" ? "upcoming" : "settings")}
              aria-label={tab === "settings" ? "Close settings" : "Settings"}
              title="Settings"
            >
              {tab === "settings" ? "×" : "⚙"}
            </button>
          </div>
        </header>

        {toast && <div className="hu-warn">{toast}</div>}

        {tab === "upcoming" && (
          <Upcoming
            live={live}
            ahead={ahead}
            done={nudges.filter((n) => n.done)}
            events={data.events}
            nudges={nudges}
            now={now}
            onDone={markDone}
            onUndo={undo}
            onSnooze={snooze}
            notifyState={notifyState}
            onRequestNotify={requestNotify}
            goImport={() => setTab("calendar")}
            newCount={unreviewed.length}
            goNew={() => setTab("calendar")}
          />
        )}
        {tab === "lists" && (
          <Lists data={data} persist={persist} undoable={undoable} now={now} />
        )}
        {tab === "calendar" && (
          <CalendarTab
            data={data}
            nudges={nudges}
            unreviewed={unreviewed}
            now={now}
            persist={persist}
            undoable={undoable}
            onSeen={markSeen}
            onMute={toggleMute}
            onAddTask={addTask}
            onRemoveTask={removeTask}
            goSettings={() => setTab("settings")}
          />
        )}
        {tab === "rules" && (
          <Rules data={data} persist={persist} undoable={undoable} now={now} />
        )}
        {tab === "settings" && (
          <Settings
            data={data}
            persist={persist}
            undoable={undoable}
            notifyState={notifyState}
            onRequestNotify={requestNotify}
            onClose={() => setTab("upcoming")}
          />
        )}
      </div>

      {undoTip && (
        <div className="hu-undo" role="status" aria-live="polite">
          <div className="hu-undo-in">
            <p>{undoTip.label}</p>
            <button className="hu-btn primary" onClick={runUndo}>
              Undo
            </button>
            <button
              className="hu-btn ghost tiny"
              aria-label="Dismiss"
              onClick={() => setUndoTip(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <nav className="hu-tabs">
        <div className="hu-tabs-in" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          {[
            ["upcoming", "Upcoming", live.length, false],
            ["lists", "Lists", 0, false],
            ["calendar", "Calendar", unreviewed.length, true],
            ["rules", "Rules", 0, false],
          ].map(([key, label, badge, mint]) => (
            <button
              key={key}
              className={`hu-tab ${tab === key ? "on" : ""}`}
              onClick={() => setTab(key)}
              aria-current={tab === key}
            >
              {label}
              {badge > 0 && (
                <span className={`hu-badge ${mint ? "mint" : ""}`}>{badge}</span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

/* ---------- Upcoming ---------- */
function Nudge(props) {
  return props.n.kind === "todo" ? <TodoNudgeCard {...props} /> : <NudgeCard {...props} />;
}

function Upcoming({
  live, ahead, done, events, nudges, now, onDone, onUndo, onSnooze,
  notifyState, onRequestNotify, goImport, newCount, goNew,
}) {
  const buckets = [
    ["Today", (d) => daysApart(d, now) === 0],
    ["Tomorrow", (d) => daysApart(d, now) === 1],
    ["This week", (d) => daysApart(d, now) > 1 && daysApart(d, now) <= 7],
    ["Later", (d) => daysApart(d, now) > 7],
  ];

  if (!events.length && !nudges.length) {
    return (
      <div className="hu-empty hu-fade">
        <p>
          No events yet. Bring your Outlook calendar in, and the rules will
          build the reminder ladders for you.
        </p>
        <button className="hu-btn primary" onClick={goImport}>
          Add a calendar
        </button>
      </div>
    );
  }

  return (
    <div className="hu-fade">
      {newCount > 0 && (
        <div className="hu-warn" style={{ borderLeftColor: "var(--mint)" }}>
          {newCount} event{newCount === 1 ? "" : "s"} showed up in your calendar
          that you haven't looked at.{" "}
          <button className="hu-btn tiny" onClick={goNew}>
            Review them
          </button>
        </div>
      )}
      {notifyState === "default" && (
        <div className="hu-warn">
          Turn on browser alerts to get pinged when a reminder lands.{" "}
          <button className="hu-btn tiny" onClick={onRequestNotify}>
            Allow alerts
          </button>
        </div>
      )}

      <div className="hu-eyebrow">
        Due now <span className="hu-count">{live.length}</span>
      </div>
      {live.length === 0 ? (
        <div className="hu-card">
          <div className="hu-ctx">Nothing waiting on you. Next one below.</div>
        </div>
      ) : (
        live.map((n) => (
          <Nudge key={n.id} n={n} now={now} live onDone={onDone} onSnooze={onSnooze} />
        ))
      )}

      {buckets.map(([name, test]) => {
        const rows = ahead.filter((n) => test(new Date(n.dueAt)));
        if (!rows.length) return null;
        return (
          <React.Fragment key={name}>
            <div className="hu-eyebrow">
              {name} <span className="hu-count">{rows.length}</span>
            </div>
            {rows.map((n) => (
              <Nudge key={n.id} n={n} now={now} onDone={onDone} onSnooze={onSnooze} />
            ))}
          </React.Fragment>
        );
      })}

      <div className="hu-eyebrow">On approach</div>
      <p className="hu-sub">
        Each track runs from the first heads-up to the event itself. Ticks are
        reminders; the amber ones have already fired.
      </p>
      {[...events]
        .sort((a, b) => new Date(a.start) - new Date(b.start))
        .filter((e) => new Date(e.start) >= startOfDay(now))
        .slice(0, 6)
        .map((e) => (
          <Approach key={e.id} event={e} nudges={nudges} now={now} />
        ))}

      {done.length > 0 && (
        <>
          <div className="hu-eyebrow">
            Handled <span className="hu-count">{done.length}</span>
          </div>
          {done.slice(0, 6).map((n) => (
            <div
              key={n.id}
              className="hu-card is-done"
              style={n.kind === "todo" ? { borderLeft: `2px solid ${n.accent}` } : undefined}
            >
              <div className="hu-lead">{n.lead === null ? "reminder" : leadLabel(n.lead)}</div>
              <div className="hu-task">{n.label}</div>
              <div className="hu-kv top">
                {n.kind === "todo" ? (
                  <>
                    <Row k="Task">{n.parentTitle}</Row>
                    <Row k="List" quiet>
                      {n.listName}
                    </Row>
                  </>
                ) : (
                  <>
                    <Row k="Event">{n.eventTitle}</Row>
                    <Row k="When" quiet>
                      {whenLine(n.event, null, false)}
                    </Row>
                  </>
                )}
              </div>
              <div className="hu-acts">
                <button className="hu-btn ghost tiny" onClick={() => onUndo(n)}>
                  Put it back
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function eventHasDetail(e) {
  return !!(e && (e.recurring || e.location || e.description));
}
function whenLine(event, now, withRelative = true) {
  const d = new Date(event.start);
  const parts = [fmtDate(d), event.allDay ? "all day" : fmtTime(d)];
  if (withRelative && now) parts.push(relative(d, now));
  return parts.join(" · ");
}

/* Location is on the card, so the cluster only flags what isn't: repeats, notes. */
function Badges({ event }) {
  if (!event || (!event.recurring && !event.description)) return null;
  return (
    <span className="hu-badges">
      {event.recurring && (
        <span className="hu-pill">↻ {event.repeats || "repeats"}</span>
      )}
      {event.description && (
        <span className="hu-glyph" title="Has notes" aria-label="Has notes">
          ≡
        </span>
      )}
    </span>
  );
}

function Row({ k, children, quiet, clamp }) {
  if (!children) return null;
  return (
    <>
      <span className="hu-k">{k}</span>
      <span className={`hu-v ${quiet ? "quiet" : ""} ${clamp ? "clamp" : ""}`}>
        {children}
      </span>
    </>
  );
}

function EventDetail({ event, from }) {
  return (
    <div className="hu-detail">
      <div className="hu-kv">
        <Row k="Repeats" quiet>
          {event.recurring ? event.repeats || "yes" : null}
        </Row>
        <Row k="From" quiet>
          {from}
        </Row>
      </div>
      {event.description && <div className="hu-notes">{event.description}</div>}
    </div>
  );
}

/* A to-do reminder. Same table as an event reminder; the origin signal is the
   accent edge plus a labelled List row, so nothing has to be decoded. */
function TodoNudgeCard({ n, now, live, onDone, onSnooze }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`hu-card ${live ? "is-live" : ""}`}
      style={{ borderLeft: `2px solid ${n.accent}` }}
    >
      <div className="hu-leadrow">
        <span className="hu-lead">
          <span>{n.lead === null ? "reminder" : leadLabel(n.lead)}</span>
          <span>·</span>
          <span>{live ? "due now" : relative(n.dueAt, now)}</span>
          {n.snoozed && <span>· snoozed</span>}
          {n.implicit && <span>· auto</span>}
        </span>
        {n.notes && (
          <span className="hu-badges">
            <span className="hu-glyph" title="Has notes" aria-label="Has notes">
              ≡
            </span>
          </span>
        )}
      </div>
      <div className="hu-task">{n.label}</div>
      <div className="hu-kv top">
        <Row k="Task">{n.parentTitle}</Row>
        <Row k="Due" quiet>
          {n.anchor ? whenLine({ start: n.anchor, allDay: false }, now) : null}
        </Row>
        <Row k="List" quiet>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <span className="hu-seed" style={{ background: n.accent }} />
            {n.listName}
          </span>
        </Row>
      </div>
      <div className="hu-acts">
        <button className={`hu-btn ${live ? "primary" : ""}`} onClick={() => onDone(n)}>
          {n.subId ? "Step done" : "Mark done"}
        </button>
        {live && (
          <>
            <button className="hu-btn" onClick={() => onSnooze(n, 3)}>
              In 3 hours
            </button>
            <button className="hu-btn" onClick={() => onSnooze(n, 24)}>
              Tomorrow
            </button>
          </>
        )}
        {n.notes && (
          <button className="hu-btn ghost tiny" onClick={() => setOpen(!open)}>
            {open ? "Less" : "Notes"}
          </button>
        )}
      </div>
      {open && n.notes && (
        <div className="hu-detail">
          <div className="hu-notes" style={{ marginTop: 0 }}>
            {n.notes}
          </div>
        </div>
      )}
    </div>
  );
}

function NudgeCard({ n, now, live, onDone, onSnooze }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`hu-card ${live ? "is-live" : ""}`}>
      <div className="hu-leadrow">
        <span className="hu-lead">
          <span>{leadLabel(n.lead)}</span>
          <span>·</span>
          <span>{live ? "due now" : relative(n.dueAt, now)}</span>
          {n.snoozed && <span>· snoozed</span>}
        </span>
        <Badges event={n.event} />
      </div>
      <div className="hu-task">{n.label}</div>
      <div className="hu-kv top">
        <Row k="Event">{n.eventTitle}</Row>
        <Row k="When" quiet>
          {whenLine(n.event, now)}
        </Row>
        <Row k="Where" quiet clamp>
          {n.location}
        </Row>
      </div>
      <div className="hu-acts">
        <button className={`hu-btn ${live ? "primary" : ""}`} onClick={() => onDone(n)}>
          Mark done
        </button>
        {live && (
          <>
            <button className="hu-btn" onClick={() => onSnooze(n, 3)}>
              In 3 hours
            </button>
            <button className="hu-btn" onClick={() => onSnooze(n, 24)}>
              Tomorrow
            </button>
          </>
        )}
        <button className="hu-btn ghost tiny" onClick={() => setOpen(!open)}>
          {open ? "Less" : n.event.description ? "Notes" : "Details"}
        </button>
      </div>
      {open && <EventDetail event={n.event} from={n.ruleName} />}
    </div>
  );
}

/* ---------- Calendar: one destination, three sub-views ---------- */
function CalendarTab({
  data, nudges, unreviewed, now, persist, undoable,
  onSeen, onMute, onAddTask, onRemoveTask, goSettings,
}) {
  const watching = data.settings.watchNew;
  const [seg, setSeg] = useState(watching && unreviewed.length ? "new" : "events");
  const view = !watching && seg === "new" ? "events" : seg;

  return (
    <div className="hu-fade">
      <div className="hu-seg" role="tablist">
        {[
          ...(watching ? [["new", `New${unreviewed.length ? ` ${unreviewed.length}` : ""}`]] : []),
          ["events", "Events"],
          ["import", "Import"],
        ].map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={view === key}
            className={view === key ? "on" : ""}
            onClick={() => setSeg(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "new" && (
        <NewInCalendar
          events={unreviewed}
          data={data}
          now={now}
          onSeen={onSeen}
          onMute={onMute}
          onAddTask={onAddTask}
          goSettings={goSettings}
        />
      )}
      {view === "events" && (
        <Events
          data={data}
          nudges={nudges}
          now={now}
          persist={persist}
          undoable={undoable}
          onAddTask={onAddTask}
          onRemoveTask={onRemoveTask}
          onMute={onMute}
        />
      )}
      {view === "import" && (
        <ImportTab data={data} persist={persist} onSeen={onSeen} />
      )}
    </div>
  );
}

/* ---------- Settings ---------- */
function Settings({ data, persist, undoable, notifyState, onRequestNotify, onClose }) {
  const s = data.settings;
  const setSetting = (patch) =>
    persist({ ...data, settings: { ...data.settings, ...patch } });

  return (
    <div className="hu-fade">
      <div className="hu-eyebrow">Shared calendars</div>
      <div className="hu-card">
        <div className="hu-switch">
          <button
            className="hu-btn tiny"
            onClick={() => setSetting({ watchNew: !s.watchNew })}
          >
            {s.watchNew ? "On" : "Off"}
          </button>
          <p>
            Watch for events someone else added
            <small>
              Adds a New section under Calendar where fresh events wait for you to
              give them reminders. Worth turning on for a calendar you share; noise
              if it's only yours.
            </small>
          </p>
        </div>

        {s.watchNew && (
          <>
            <div className="hu-switch">
              <button
                className="hu-btn tiny"
                onClick={() => setSetting({ watchOnlyOthers: !s.watchOnlyOthers })}
              >
                {s.watchOnlyOthers ? "On" : "Off"}
              </button>
              <p>
                Hide events you created yourself
                <small>
                  Compares the organiser against your address below. Events with no
                  organiser always show.
                </small>
              </p>
            </div>
            <div style={{ paddingTop: 12 }}>
              <label className="hu-label" htmlFor="my-email">
                Your calendar address
              </label>
              <input
                id="my-email"
                className="hu-input"
                type="email"
                placeholder="you@work.com"
                value={s.myEmail}
                onChange={(e) => setSetting({ myEmail: e.target.value })}
              />
            </div>
          </>
        )}
      </div>

      <div className="hu-eyebrow">Notifications</div>
      <div className="hu-card">
        <div className="hu-switch">
          <button
            className="hu-btn tiny"
            onClick={onRequestNotify}
            disabled={notifyState === "granted" || notifyState === "unsupported"}
          >
            {notifyState === "granted"
              ? "On"
              : notifyState === "denied"
              ? "Blocked"
              : notifyState === "unsupported"
              ? "N/A"
              : "Allow"}
          </button>
          <p>
            Browser alerts
            <small>
              {notifyState === "denied"
                ? "Blocked in your browser settings — you would need to re-allow it there."
                : notifyState === "unsupported"
                ? "Not available in this browser."
                : "These only fire while Heads Up is open. The Due now list is always right; the alert is best-effort."}
            </small>
          </p>
        </div>
      </div>

      <div className="hu-eyebrow">To-dos</div>
      <div className="hu-card">
        <div className="hu-switch">
          <button
            className="hu-btn tiny"
            onClick={() => setSetting({ todoAutoRemind: !s.todoAutoRemind })}
          >
            {s.todoAutoRemind ? "On" : "Off"}
          </button>
          <p>
            One automatic nudge on the day
            <small>
              For to-dos that have a date but no reminder of their own, so a
              deadline cannot sit in a list unseen.
            </small>
          </p>
        </div>
      </div>

      <div className="hu-eyebrow">Start over</div>
      <div className="hu-card">
        <p className="hu-note" style={{ marginTop: 0 }}>
          Clears your events, rules and lists, and puts the starter setup back.
          You get one chance to undo it.
        </p>
        <div className="hu-acts">
          <button
            className="hu-btn danger"
            onClick={() =>
              undoable(defaultData(), "Reset everything back to the starter setup")
            }
          >
            Reset all data
          </button>
          <button className="hu-btn ghost" onClick={onClose}>
            Close settings
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Lists ---------- */
const REMINDER_PRESETS = [
  ["On the day, 09:00", { kind: "lead", days: 0, hour: 9 }],
  ["Day before, 18:00", { kind: "lead", days: 1, hour: 18 }],
  ["3 days before", { kind: "lead", days: 3, hour: 9 }],
  ["A week before", { kind: "lead", days: 7, hour: 9 }],
];

function reminderText(rem) {
  if (rem.kind === "at") return `${fmtDate(rem.at)} ${fmtTime(rem.at)}`;
  const h = `${pad(rem.hour || 0)}:00`;
  return rem.days === 0 ? `day of, ${h}` : `${rem.days}d before, ${h}`;
}
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SubStep({ st, parentDue, onPatch, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--rule)", paddingBottom: 9, marginBottom: 9 }}>
      <div className="hu-row" style={{ alignItems: "flex-start" }}>
        <input
          className="hu-input"
          value={st.title}
          onChange={(e) => onPatch({ title: e.target.value })}
        />
        <button className="hu-btn ghost tiny" onClick={() => setOpen(!open)}>
          {open ? "Less" : "When"}
        </button>
        <button className="hu-btn danger tiny" onClick={onDelete} aria-label="Delete step">
          ×
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 8 }}>
          <div className="hu-row">
            <input
              className="hu-input"
              type="datetime-local"
              value={toLocalInput(st.due)}
              onChange={(e) =>
                onPatch({ due: e.target.value ? new Date(e.target.value).toISOString() : null })
              }
            />
            {st.due && (
              <button className="hu-btn ghost tiny" onClick={() => onPatch({ due: null })}>
                Clear
              </button>
            )}
          </div>
          <div className="hu-preset">
            {REMINDER_PRESETS.map(([label, rem]) => (
              <button
                key={label}
                className="hu-btn tiny"
                disabled={!st.due && !parentDue}
                onClick={() => onPatch({ reminders: [...(st.reminders || []), rem] })}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            {(st.reminders || []).map((rem, i) => (
              <span className="hu-chip" key={i}>
                {reminderText(rem)}
                <button
                  aria-label="Remove reminder"
                  onClick={() =>
                    onPatch({ reminders: st.reminders.filter((_, j) => j !== i) })
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {!st.due && parentDue && (
            <p className="hu-note">Counts back from the to-do's own date.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ItemEditor({ item, onPatch, onPatchU, onDelete, autoRemind }) {
  const [step, setStep] = useState("");
  const [customAt, setCustomAt] = useState("");

  const patchSub = (subId, fn) =>
    onPatch({ subtasks: item.subtasks.map((s) => (s.id === subId ? fn(s) : s)) });

  return (
    <div className="hu-editor">
      <div className="hu-field">
        <label className="hu-label">Needed by</label>
        <div className="hu-row">
          <input
            className="hu-input"
            type="datetime-local"
            value={toLocalInput(item.due)}
            onChange={(e) =>
              onPatch({
                due: e.target.value ? new Date(e.target.value).toISOString() : null,
              })
            }
          />
          {item.due && (
            <button className="hu-btn ghost tiny" onClick={() => onPatch({ due: null })}>
              Clear
            </button>
          )}
        </div>
        {!item.due && (
          <p className="hu-note">
            No date is fine — it just stays in the list and never nudges you.
          </p>
        )}
      </div>

      <div className="hu-field">
        <label className="hu-label">Reminders</label>
        {item.reminders.length ? (
          <div>
            {item.reminders.map((rem, i) => (
              <span className="hu-chip" key={i}>
                {reminderText(rem)}
                <button
                  aria-label="Remove reminder"
                  onClick={() =>
                    onPatch({ reminders: item.reminders.filter((_, j) => j !== i) })
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="hu-note" style={{ marginTop: 0 }}>
            {item.due && autoRemind
              ? "None set, so you'll get one automatic nudge on the day."
              : "None. This won't reach Upcoming."}
          </p>
        )}
        <div className="hu-preset">
          {REMINDER_PRESETS.map(([label, rem]) => (
            <button
              key={label}
              className="hu-btn tiny"
              disabled={!item.due}
              onClick={() => onPatch({ reminders: [...item.reminders, rem] })}
              title={item.due ? "" : "Set a date first"}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="hu-row" style={{ marginTop: 8 }}>
          <input
            className="hu-input"
            type="datetime-local"
            value={customAt}
            onChange={(e) => setCustomAt(e.target.value)}
          />
          <button
            className="hu-btn tiny"
            onClick={() => {
              if (!customAt) return;
              onPatch({
                reminders: [
                  ...item.reminders,
                  { kind: "at", at: new Date(customAt).toISOString() },
                ],
              });
              setCustomAt("");
            }}
          >
            At a set time
          </button>
        </div>
        {item.due && (
          <p className="hu-note">
            Lead times count back from the date above, so "a week before" is how you
            cover delivery time.
          </p>
        )}
      </div>

      <div className="hu-field">
        <label className="hu-label">Notes</label>
        <input
          className="hu-input"
          value={item.notes || ""}
          placeholder="Anything worth remembering"
          onChange={(e) => onPatch({ notes: e.target.value })}
        />
      </div>

      <div className="hu-field">
        <label className="hu-label">Steps</label>
        <div className="hu-steps">
          {item.subtasks.map((st) => (
            <SubStep
              key={st.id}
              st={st}
              parentDue={item.due}
              onPatch={(p) => patchSub(st.id, (s) => ({ ...s, ...p }))}
              onDelete={() =>
                onPatchU(
                  { subtasks: item.subtasks.filter((s) => s.id !== st.id) },
                  `Deleted step "${st.title}"`
                )
              }
            />
          ))}
          <input
            className="hu-input"
            style={{ marginTop: 9 }}
            placeholder="Add a step, then press Enter"
            value={step}
            onChange={(e) => setStep(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && step.trim()) {
                onPatch({
                  subtasks: [
                    ...item.subtasks,
                    { id: uid(), title: step.trim(), due: null, reminders: [], done: false },
                  ],
                });
                setStep("");
              }
            }}
          />
        </div>
      </div>

      <button className="hu-btn danger tiny" onClick={onDelete}>
        Delete this to-do
      </button>
    </div>
  );
}

function Lists({ data, persist, undoable, now }) {
  const lists = data.lists || [];
  const [activeId, setActiveId] = useState(lists[0] ? lists[0].id : null);
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState("");
  const [newList, setNewList] = useState("");
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const active = lists.find((l) => l.id === activeId) || lists[0];

  const commit = (next, undoLabel) =>
    undoLabel
      ? undoable({ ...data, lists: next }, undoLabel)
      : persist({ ...data, lists: next });
  const patchList = (id, fn, undoLabel) =>
    commit(lists.map((l) => (l.id === id ? fn(l) : l)), undoLabel);
  const patchItem = (itemId, p, undoLabel) =>
    patchList(
      active.id,
      (l) => ({ ...l, items: l.items.map((it) => (it.id === itemId ? { ...it, ...p } : it)) }),
      undoLabel
    );
  const toggle = (itemId, value) =>
    patchItem(itemId, { done: value, doneAt: value ? new Date().toISOString() : null });

  const addList = () => {
    if (!newList.trim()) return;
    const l = { id: `list-${uid()}`, name: newList.trim(), accent: nextAccent(lists), items: [] };
    commit([...lists, l]);
    setActiveId(l.id);
    setNewList("");
    setAdding(false);
  };
  const addItem = () => {
    if (!draft.trim() || !active) return;
    patchList(active.id, (l) => ({
      ...l,
      items: [
        ...l.items,
        {
          id: uid(),
          title: draft.trim(),
          notes: "",
          due: null,
          reminders: [],
          done: false,
          subtasks: [],
        },
      ],
    }));
    setDraft("");
  };

  if (!lists.length) {
    return (
      <div className="hu-fade">
        <div className="hu-eyebrow">Lists</div>
        <div className="hu-empty">
          <p>
            No lists yet. Make one for a project or a shop — "House related",
            "Things to buy" — and its to-dos will share a colour wherever they
            surface.
          </p>
          <div className="hu-row">
            <input
              className="hu-input"
              placeholder="Name the list"
              value={newList}
              onChange={(e) => setNewList(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addList()}
            />
            <button className="hu-btn primary" onClick={addList}>
              Create
            </button>
          </div>
        </div>
      </div>
    );
  }

  const openItems = active.items.filter((i) => !i.done);
  const doneItems = active.items.filter((i) => i.done);

  return (
    <div className="hu-fade">
      <div className="hu-listbar">
        {lists.map((l) => (
          <button
            key={l.id}
            className={`hu-listchip ${l.id === active.id ? "on" : ""}`}
            onClick={() => {
              setActiveId(l.id);
              setOpenId(null);
            }}
          >
            <span className="hu-seed" style={{ background: l.accent }} />
            {l.name}
            <em>{l.items.filter((i) => !i.done).length}</em>
          </button>
        ))}
        <button className="hu-listchip" onClick={() => setAdding(!adding)}>
          + List
        </button>
      </div>

      {adding && (
        <div className="hu-row" style={{ marginBottom: 16 }}>
          <input
            className="hu-input"
            placeholder="Name the list"
            value={newList}
            autoFocus
            onChange={(e) => setNewList(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addList()}
          />
          <button className="hu-btn primary" onClick={addList}>
            Create
          </button>
          <button className="hu-btn ghost tiny" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </div>
      )}

      <div className="hu-row" style={{ marginBottom: 18 }}>
        <input
          className="hu-input"
          placeholder={`Add to ${active.name}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
        />
        <button className="hu-btn primary" onClick={addItem}>
          Add
        </button>
      </div>

      <div className="hu-eyebrow">
        {active.name} <span className="hu-count">{openItems.length} open</span>
      </div>

      {openItems.length === 0 && (
        <div className="hu-card">
          <div className="hu-ctx">Nothing open in this list.</div>
        </div>
      )}

      {openItems.map((item) => {
        const steps = item.subtasks || [];
        const stepsDone = steps.filter((s) => s.done).length;
        const late = item.due && new Date(item.due) < now;
        const remCount =
          (item.reminders || []).length +
          steps.reduce((a, s) => a + (s.reminders || []).length, 0);
        return (
          <div
            className="hu-card"
            key={item.id}
            style={{ borderLeft: `2px solid ${active.accent}` }}
          >
            <div className="hu-item" style={{ padding: 0, borderBottom: "none" }}>
              <button
                className="hu-circle"
                aria-label={`Mark "${item.title}" done`}
                onClick={() => toggle(item.id, true)}
              />
              <div className="hu-itembody">
                <div className="hu-itemt">{item.title}</div>
                <div className="hu-itemm">
                  {item.due ? (
                    <span className={late ? "late" : ""}>
                      {late ? "overdue " : "by "}
                      {fmtDate(item.due)}
                    </span>
                  ) : (
                    <span>no date</span>
                  )}
                  {remCount > 0 && (
                    <span className="set">
                      {remCount} reminder{remCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {steps.length > 0 && (
                    <span>
                      {stepsDone}/{steps.length} steps
                    </span>
                  )}
                  {item.notes && <span>≡</span>}
                </div>
              </div>
              <button
                className="hu-btn ghost tiny"
                onClick={() => setOpenId(openId === item.id ? null : item.id)}
              >
                {openId === item.id ? "Close" : "Open"}
              </button>
            </div>

            {steps.length > 0 && openId !== item.id && (
              <div className="hu-steps">
                {steps.map((s) => (
                  <div className={`hu-item ${s.done ? "is-off" : ""}`} key={s.id}>
                    <button
                      className={`hu-circle ${s.done ? "on" : ""}`}
                      aria-label={`Toggle "${s.title}"`}
                      onClick={() =>
                        patchItem(item.id, {
                          subtasks: steps.map((x) =>
                            x.id === s.id ? { ...x, done: !x.done } : x
                          ),
                        })
                      }
                    />
                    <div className="hu-itembody">
                      <div className="hu-itemt">{s.title}</div>
                      {(s.due || (s.reminders || []).length > 0) && (
                        <div className="hu-itemm">
                          {s.due && <span>by {fmtDate(s.due)}</span>}
                          {(s.reminders || []).length > 0 && (
                            <span className="set">{s.reminders.length} reminder</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {openId === item.id && (
              <ItemEditor
                item={item}
                autoRemind={data.settings.todoAutoRemind}
                onPatch={(p) => patchItem(item.id, p)}
                onPatchU={(p, label) => patchItem(item.id, p, label)}
                onDelete={() => {
                  patchList(
                    active.id,
                    (l) => ({ ...l, items: l.items.filter((i) => i.id !== item.id) }),
                    `Deleted "${item.title}"`
                  );
                  setOpenId(null);
                }}
              />
            )}
          </div>
        );
      })}

      {doneItems.length > 0 && (
        <>
          <div className="hu-eyebrow">
            Done <span className="hu-count">{doneItems.length}</span>
            <button
              className="hu-btn ghost tiny"
              style={{ marginLeft: 8 }}
              onClick={() => setShowDone(!showDone)}
            >
              {showDone ? "Hide" : "Show"}
            </button>
          </div>
          {showDone &&
            doneItems.map((item) => (
              <div className="hu-card is-done" key={item.id}>
                <div className="hu-item" style={{ padding: 0, borderBottom: "none" }}>
                  <button
                    className="hu-circle on"
                    aria-label={`Put "${item.title}" back`}
                    onClick={() => toggle(item.id, false)}
                  />
                  <div className="hu-itembody">
                    <div className="hu-itemt" style={{ textDecoration: "line-through" }}>
                      {item.title}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </>
      )}

      {lists.length > 1 && (
        <div className="hu-acts" style={{ marginTop: 20 }}>
          <button
            className="hu-btn danger tiny"
            onClick={() => {
              const rest = lists.filter((l) => l.id !== active.id);
              const label =
                active.items.length > 0
                  ? `Deleted "${active.name}" and its ${active.items.length} to-do${
                      active.items.length === 1 ? "" : "s"
                    }`
                  : `Deleted "${active.name}"`;
              commit(rest, label);
              setActiveId(rest[0] ? rest[0].id : null);
              setOpenId(null);
            }}
          >
            Delete "{active.name}"
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- New in calendar ---------- */
const PRESETS = [
  ["Buy a present", [{ days: 10, hour: 9 }, { days: 3, hour: 18 }]],
  ["Pack your bag", [{ days: 1, hour: 8 }]],
  ["Prepare", [{ days: 3, hour: 9 }, { days: 1, hour: 17 }]],
  ["Leave on time", [{ days: 0, hour: 7 }]],
];

function QuickReminder({ eventId, onAddTask, onDone }) {
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(1);
  const [hour, setHour] = useState(9);

  const save = (l, leads) => {
    onAddTask(eventId, { label: l, leads });
    setLabel("");
    if (onDone) onDone();
  };

  return (
    <div className="hu-mini">
      <div className="hu-label">Add a reminder</div>
      <div className="hu-preset">
        {PRESETS.map(([l, leads]) => (
          <button key={l} className="hu-btn tiny" onClick={() => save(l, leads)}>
            {l}
          </button>
        ))}
      </div>
      <div className="hu-row" style={{ marginTop: 9 }}>
        <input
          className="hu-input"
          placeholder="Or write your own"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && label.trim())
              save(label.trim(), [{ days: +days, hour: +hour }]);
          }}
        />
      </div>
      <div className="hu-row" style={{ marginTop: 7 }}>
        <input
          className="hu-num"
          type="number"
          min="0"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          aria-label="Days before"
        />
        <span style={{ fontSize: 12, color: "var(--mist)" }}>days before, at</span>
        <input
          className="hu-num"
          type="number"
          min="0"
          max="23"
          value={hour}
          onChange={(e) => setHour(e.target.value)}
          aria-label="Hour"
        />
        <span style={{ fontSize: 12, color: "var(--mist)" }}>:00</span>
        <button
          className="hu-btn tiny primary"
          onClick={() => label.trim() && save(label.trim(), [{ days: +days, hour: +hour }])}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function NewInCalendar({ events, data, now, onSeen, onMute, onAddTask, goSettings }) {
  const [openId, setOpenId] = useState(null);

  if (!events.length) {
    return (
      <div className="hu-fade">
        <div className="hu-eyebrow">New in your calendar</div>
        <div className="hu-empty">
          <p>
            Nothing new. Anything someone adds to the calendar shows up here on
            your next import, waiting for reminders.
          </p>
          <button className="hu-btn ghost" onClick={goSettings}>
            Watching settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hu-fade">
      <div className="hu-eyebrow">
        New in your calendar <span className="hu-count">{events.length}</span>
      </div>
      <p className="hu-sub">
        These arrived since you last looked. Give them reminders, wave them
        through, or mute the ones you don't need nudging about.
      </p>
      <div className="hu-acts" style={{ marginBottom: 16 }}>
        <button className="hu-btn" onClick={() => onSeen(events.map((e) => e.id))}>
          Mark all as read
        </button>
      </div>

      {events.map((e) => {
        const who = e.organizer
          ? e.organizer.name || e.organizer.email
          : e.source === "ics"
          ? "unknown organiser"
          : "you";
        return (
          <div className="hu-card is-new" key={e.id}>
            <div className="hu-leadrow">
              <span className="hu-lead">
                <span>new</span>
                <span>· {relative(e.start, now)}</span>
              </span>
              <Badges event={e} />
            </div>
            <div className="hu-task">{e.title}</div>
            <div className="hu-kv top">
              <Row k="When" quiet>
                {whenLine(e, null, false)}
              </Row>
              <Row k="Where" quiet clamp>
                {e.location}
              </Row>
              <Row k="By">
                <span className="hu-who">{who}</span>
              </Row>
            </div>
            {e.description && <div className="hu-notes">{e.description}</div>}
            <div className="hu-acts">
              <button
                className="hu-btn primary"
                onClick={() => setOpenId(openId === e.id ? null : e.id)}
              >
                {openId === e.id ? "Close" : "Add reminders"}
              </button>
              <button className="hu-btn" onClick={() => onSeen([e.id])}>
                Mark as read
              </button>
              <button className="hu-btn ghost tiny" onClick={() => onMute(e.id)}>
                Mute this event
              </button>
            </div>
            {openId === e.id && (
              <QuickReminder
                eventId={e.id}
                onAddTask={onAddTask}
                onDone={() => setOpenId(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Approach({ event, nudges, now }) {
  const mine = nudges.filter((n) => n.eventId === event.id);
  const end = new Date(event.start).getTime();
  const firstNudge = mine.length
    ? Math.min(...mine.map((n) => new Date(n.baseDueAt).getTime()))
    : end - 3 * MS_DAY;
  const start = Math.min(firstNudge, now.getTime()) - MS_DAY * 0.4;
  const span = Math.max(end - start, MS_DAY * 0.5);
  const pct = (t) => Math.max(0, Math.min(100, ((t - start) / span) * 100));
  const nowPct = pct(now.getTime());

  return (
    <div className="hu-appr">
      <div className="hu-appr-head">
        <div>
          <div className="hu-appr-title">{event.title}</div>
          <div style={{ marginTop: 5 }}>
            <Badges event={event} />
          </div>
        </div>
        <div className="hu-appr-when">
          {fmtDate(event.start)}
          <br />
          {event.allDay ? "all day" : fmtTime(event.start)}
          <br />
          {relative(event.start, now)}
        </div>
      </div>
      <div className="hu-track">
        <div className="hu-rail" />
        <div className="hu-fill" style={{ width: `${nowPct}%` }} />
        {mine.map((n) => {
          const t = new Date(n.baseDueAt).getTime();
          const cls = n.done ? "done" : t <= now.getTime() ? "past" : "";
          return (
            <React.Fragment key={n.id}>
              <div className={`hu-tick ${cls}`} style={{ left: `${pct(t)}%` }} />
              <div className={`hu-dot ${cls}`} style={{ left: `${pct(t)}%` }} title={n.label} />
            </React.Fragment>
          );
        })}
        <div className="hu-now" style={{ left: `${nowPct}%` }} />
        <div className="hu-flag">EVENT</div>
      </div>
      <div className="hu-appr-legend">
        {mine.length ? (
          [...new Set(mine.map((n) => n.label))].map((l) => <span key={l}>{l}</span>)
        ) : (
          <span>No reminders — no rule matches this title</span>
        )}
      </div>
    </div>
  );
}

/* ---------- Events ---------- */
function Events({ data, nudges, now, persist, undoable, onAddTask, onRemoveTask, onMute }) {
  const [openId, setOpenId] = useState(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(dayKey(new Date(Date.now() + 3 * MS_DAY)));
  const [time, setTime] = useState("");
  const [place, setPlace] = useState("");
  const [notes, setNotes] = useState("");

  const add = () => {
    if (!title.trim() || !date) return;
    const [y, m, d] = date.split("-").map(Number);
    const allDay = !time;
    const [hh, mm] = time ? time.split(":").map(Number) : [0, 0];
    const id = `manual-${uid()}`;
    persist({
      ...data,
      events: [
        ...data.events,
        {
          id,
          title: title.trim(),
          start: new Date(y, m - 1, d, hh, mm).toISOString(),
          allDay,
          location: place.trim(),
          description: notes.trim(),
          recurring: false,
          repeats: "",
          organizer: null,
          tasks: [],
          source: "manual",
        },
      ],
      state: {
        ...data.state,
        seen: { ...data.state.seen, [id]: new Date().toISOString() },
      },
    });
    setTitle("");
    setTime("");
    setPlace("");
    setNotes("");
  };
  const remove = (ev) =>
    undoable(
      { ...data, events: data.events.filter((e) => e.id !== ev.id) },
      `Removed "${ev.title}"`
    );

  const sorted = [...data.events].sort(
    (a, b) => new Date(a.start) - new Date(b.start)
  );

  return (
    <div className="hu-fade">
      <div className="hu-eyebrow">Add an event</div>
      <div className="hu-field">
        <input
          className="hu-input"
          placeholder="What is it? e.g. Anna's birthday"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="hu-field hu-row">
        <input
          className="hu-input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          className="hu-input"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <button className="hu-btn primary" onClick={add}>
          Add
        </button>
      </div>
      <div className="hu-field">
        <input
          className="hu-input"
          placeholder="Where? (optional)"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
        />
      </div>
      <div className="hu-field">
        <input
          className="hu-input"
          placeholder="Anything to remember? (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <p className="hu-note">Leave the time blank for an all-day event.</p>

      <div className="hu-eyebrow">
        All events <span className="hu-count">{sorted.length}</span>
      </div>
      {sorted.map((e) => {
        const mine = nudges.filter((n) => n.eventId === e.id);
        const muted = !!data.state.muted[e.id];
        const past = new Date(e.start) < startOfDay(now);
        return (
          <div key={e.id} className={`hu-card ${past ? "is-done" : ""}`}>
            <div className="hu-leadrow">
              <span className="hu-lead">
                <span>{relative(e.start, now)}</span>
                <span>· {e.source}</span>
              </span>
              <Badges event={e} />
            </div>
            <div className="hu-task">{e.title}</div>
            <div className="hu-kv top">
              <Row k="When" quiet>
                {whenLine(e, null, false)}
              </Row>
              <Row k="Where" quiet clamp>
                {e.location}
              </Row>
              <Row k="By" quiet>
                {e.organizer
                  ? e.organizer.name || e.organizer.email
                  : e.source === "manual"
                  ? "you"
                  : null}
              </Row>
            </div>
            {e.description && <div className="hu-notes">{e.description}</div>}
            <ul className="hu-list" style={{ marginTop: 10 }}>
              {muted ? (
                <li className="hu-taskline">
                  <span style={{ color: "var(--mist)" }}>Muted — no reminders</span>
                </li>
              ) : mine.length ? (
                [...new Set(mine.map((n) => n.label))].map((label) => {
                  const rows = mine.filter((n) => n.label === label);
                  const leads = rows.map((n) => leadLabel(n.lead)).join(", ");
                  const custom = (e.tasks || []).find((t) => t.label === label);
                  return (
                    <li className="hu-taskline" key={label}>
                      <span>{label}</span>
                      <em>
                        {leads}
                        {custom && (
                          <button
                            className="hu-btn ghost tiny"
                            style={{ marginLeft: 8 }}
                            onClick={() => onRemoveTask(e.id, custom.id)}
                          >
                            ×
                          </button>
                        )}
                      </em>
                    </li>
                  );
                })
              ) : (
                <li className="hu-taskline">
                  <span style={{ color: "var(--mist)" }}>No reminders yet</span>
                  <em>add one below, or a keyword in Rules</em>
                </li>
              )}
            </ul>
            <div className="hu-acts">
              <button
                className="hu-btn tiny"
                onClick={() => setOpenId(openId === e.id ? null : e.id)}
              >
                {openId === e.id ? "Close" : "Add reminder"}
              </button>
              <button className="hu-btn ghost tiny" onClick={() => onMute(e.id)}>
                {muted ? "Unmute" : "Mute"}
              </button>
              <button className="hu-btn danger tiny" onClick={() => remove(e)}>
                Remove event
              </button>
            </div>
            {openId === e.id && (
              <QuickReminder
                eventId={e.id}
                onAddTask={onAddTask}
                onDone={() => setOpenId(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Rules ----------
   The test box runs the real engine (matchRules + buildNudges) against a
   synthetic event rather than reimplementing the logic, so the preview cannot
   drift away from what actually fires.                                     */
function RuleProbe({ data, now }) {
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");

  const result = useMemo(() => {
    if (!title.trim()) return null;
    const start = when
      ? new Date(when)
      : startOfDay(new Date(Date.now() + 14 * MS_DAY));
    if (!when) start.setHours(9, 0, 0, 0);
    const probe = {
      id: "probe",
      title: title.trim(),
      start: start.toISOString(),
      allDay: false,
      location: "",
      description: "",
      recurring: false,
      repeats: "",
      organizer: null,
      tasks: [],
      source: "manual",
    };
    const matched = matchRules(probe, data.rules);
    const nudges = buildNudges({
      events: [probe],
      rules: data.rules,
      state: { done: {}, snoozed: {}, seen: {}, muted: {}, notified: [] },
      settings: data.settings,
    });
    return { matched, nudges, start };
  }, [title, when, data.rules, data.settings]);

  return (
    <div className="hu-probe">
      <label className="hu-label" htmlFor="probe-title">
        Try a title
      </label>
      <input
        id="probe-title"
        className="hu-input"
        placeholder="e.g. Flight to Lisbon"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="hu-row" style={{ marginTop: 8 }}>
        <input
          className="hu-input"
          type="date"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          aria-label="Pretend date"
        />
        {when && (
          <button className="hu-btn ghost tiny" onClick={() => setWhen("")}>
            Clear
          </button>
        )}
      </div>

      {!result && (
        <p className="hu-note">
          Type a title the way it appears in your calendar and you'll see exactly
          which reminders it would produce, before any real event depends on it.
        </p>
      )}

      {result && (
        <div className="hu-fire">
          <div className="hu-stat" style={{ marginTop: 0 }}>
            {result.matched.length ? (
              result.matched.map((r) => <span key={r.id}>{r.name}</span>)
            ) : (
              <span className="zero">no rule matched</span>
            )}
            <span>
              {result.nudges.length} reminder{result.nudges.length === 1 ? "" : "s"}
            </span>
          </div>

          {result.nudges.length === 0 && (
            <p className="hu-note">
              Nothing would fire. Add a keyword below, or switch the catch-all on.
            </p>
          )}

          {result.nudges.map((n) => (
            <div className="hu-fireline" key={n.id}>
              <span>{n.label}</span>
              <em>
                {leadLabel(n.lead)} · {fmtDate(n.baseDueAt)} {fmtTime(n.baseDueAt)}
              </em>
            </div>
          ))}

          {result.nudges.length > 0 && !result.matched.length && (
            <p className="hu-note">
              That's the catch-all, not a rule — nothing here matched by keyword.
            </p>
          )}
          <p className="hu-note">
            Based on an event on {fmtDate(result.start)}.
          </p>
        </div>
      )}
    </div>
  );
}

function RuleEditor({ rule, patch }) {
  return (
    <>
      <div className="hu-label" style={{ marginTop: 16 }}>
        Title contains
      </div>
      <div>
        {rule.keywords.map((k, i) => (
          <span className="hu-chip" key={`${k}-${i}`}>
            {k}
            <button
              aria-label={`Remove ${k}`}
              onClick={() =>
                patch((r) => ({ ...r, keywords: r.keywords.filter((_, j) => j !== i) }))
              }
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className="hu-input"
        placeholder="Add a keyword, then press Enter"
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target.value.trim()) {
            const v = e.target.value.trim();
            e.target.value = "";
            patch((r) => ({ ...r, keywords: [...r.keywords, v] }));
          }
        }}
      />

      <div className="hu-label" style={{ marginTop: 16 }}>
        Tasks and lead times
      </div>
      {rule.tasks.map((task) => (
        <div
          key={task.id}
          style={{ borderLeft: "2px solid var(--rule)", paddingLeft: 11, marginBottom: 14 }}
        >
          <div className="hu-row" style={{ marginBottom: 8 }}>
            <input
              className="hu-input"
              value={task.label}
              onChange={(e) =>
                patch((r) => ({
                  ...r,
                  tasks: r.tasks.map((t) =>
                    t.id === task.id ? { ...t, label: e.target.value } : t
                  ),
                }))
              }
            />
            <button
              className="hu-btn danger tiny"
              aria-label={`Remove ${task.label}`}
              onClick={() =>
                patch((r) => ({ ...r, tasks: r.tasks.filter((t) => t.id !== task.id) }))
              }
            >
              ×
            </button>
          </div>

          {task.leads.length === 0 && (
            <div className="hu-flag-warn">
              No lead times, so this task never fires.
            </div>
          )}

          {task.leads.map((lead, li) => (
            <div className="hu-row" key={li} style={{ marginBottom: 6 }}>
              <input
                className="hu-num"
                type="number"
                min="0"
                value={lead.days}
                aria-label="Days before"
                onChange={(e) =>
                  patch((r) => ({
                    ...r,
                    tasks: r.tasks.map((t) =>
                      t.id === task.id
                        ? {
                            ...t,
                            leads: t.leads.map((l, j) =>
                              j === li ? { ...l, days: +e.target.value } : l
                            ),
                          }
                        : t
                    ),
                  }))
                }
              />
              <span style={{ fontSize: 12, color: "var(--mist)" }}>days before, at</span>
              <input
                className="hu-num"
                type="number"
                min="0"
                max="23"
                value={lead.hour}
                aria-label="Hour"
                onChange={(e) =>
                  patch((r) => ({
                    ...r,
                    tasks: r.tasks.map((t) =>
                      t.id === task.id
                        ? {
                            ...t,
                            leads: t.leads.map((l, j) =>
                              j === li ? { ...l, hour: +e.target.value } : l
                            ),
                          }
                        : t
                    ),
                  }))
                }
              />
              <span style={{ fontSize: 12, color: "var(--mist)" }}>:00</span>
              <button
                className="hu-btn ghost tiny"
                onClick={() =>
                  patch((r) => ({
                    ...r,
                    tasks: r.tasks.map((t) =>
                      t.id === task.id
                        ? { ...t, leads: t.leads.filter((_, j) => j !== li) }
                        : t
                    ),
                  }))
                }
              >
                remove
              </button>
            </div>
          ))}
          <button
            className="hu-btn ghost tiny"
            onClick={() =>
              patch((r) => ({
                ...r,
                tasks: r.tasks.map((t) =>
                  t.id === task.id ? { ...t, leads: [...t.leads, { days: 1, hour: 9 }] } : t
                ),
              }))
            }
          >
            + lead time
          </button>
        </div>
      ))}
      <button
        className="hu-btn tiny"
        onClick={() =>
          patch((r) => ({
            ...r,
            tasks: [
              ...r.tasks,
              { id: uid(), label: "New task", leads: [{ days: 1, hour: 9 }] },
            ],
          }))
        }
      >
        + task
      </button>
    </>
  );
}

function Rules({ data, persist, undoable, now }) {
  const [openId, setOpenId] = useState(null);
  const update = (rules) => persist({ ...data, rules });
  const patch = (id, fn) => update(data.rules.map((r) => (r.id === id ? fn(r) : r)));

  /* How many of the user's actual events each rule would catch. Grounding the
     abstraction in their own data beats any amount of explanation. */
  const matchCounts = useMemo(() => {
    const m = {};
    data.rules.forEach((r) => {
      m[r.id] = data.events.filter(
        (e) => matchRules(e, [{ ...r, enabled: true }]).length > 0
      ).length;
    });
    return m;
  }, [data.rules, data.events]);

  const addRule = () => {
    const r = {
      id: uid(),
      name: "New rule",
      keywords: [],
      enabled: true,
      tasks: [{ id: uid(), label: "Do the thing", leads: [{ days: 1, hour: 9 }] }],
    };
    update([...data.rules, r]);
    setOpenId(r.id);
  };

  return (
    <div className="hu-fade">
      <div className="hu-eyebrow">Test a title</div>
      <RuleProbe data={data} now={now} />

      <div className="hu-eyebrow">
        Rules <span className="hu-count">{data.rules.length}</span>
      </div>

      {data.rules.map((rule) => {
        const open = openId === rule.id;
        const leadCount = rule.tasks.reduce((a, t) => a + t.leads.length, 0);
        const hits = matchCounts[rule.id] || 0;
        return (
          <div className={`hu-card ${rule.enabled ? "" : "hu-off"}`} key={rule.id}>
            <div className="hu-summary">
              <div style={{ minWidth: 0, flex: 1 }}>
                {open ? (
                  <input
                    className="hu-input"
                    value={rule.name}
                    onChange={(e) => patch(rule.id, (r) => ({ ...r, name: e.target.value }))}
                  />
                ) : (
                  <div className="hu-rulename">{rule.name}</div>
                )}
                {!open && (
                  <div className="hu-keys">
                    {rule.keywords.slice(0, 4).map((k, i) => (
                      <span className="hu-chip" key={`${k}-${i}`}>
                        {k}
                      </span>
                    ))}
                    {rule.keywords.length > 4 && (
                      <span className="hu-chip">+{rule.keywords.length - 4}</span>
                    )}
                  </div>
                )}
                <div className="hu-stat">
                  <span>
                    {rule.tasks.length} task{rule.tasks.length === 1 ? "" : "s"}
                  </span>
                  <span>
                    {leadCount} reminder{leadCount === 1 ? "" : "s"}
                  </span>
                  <span className={hits === 0 ? "zero" : ""}>
                    {hits === 0
                      ? "matches nothing you have"
                      : `matches ${hits} event${hits === 1 ? "" : "s"}`}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flex: "none" }}>
                <button
                  className="hu-btn tiny"
                  onClick={() => patch(rule.id, (r) => ({ ...r, enabled: !r.enabled }))}
                  aria-label={rule.enabled ? "Turn rule off" : "Turn rule on"}
                >
                  {rule.enabled ? "On" : "Off"}
                </button>
                <button
                  className="hu-btn tiny"
                  onClick={() => setOpenId(open ? null : rule.id)}
                >
                  {open ? "Done" : "Edit"}
                </button>
              </div>
            </div>

            {!rule.keywords.length && (
              <div className="hu-flag-warn">
                No keywords, so this rule never fires.
              </div>
            )}

            {open && (
              <>
                <RuleEditor rule={rule} patch={(fn) => patch(rule.id, fn)} />
                <div className="hu-acts" style={{ marginTop: 14 }}>
                  <button
                    className="hu-btn danger tiny"
                    onClick={() => {
                      undoable(
                        { ...data, rules: data.rules.filter((r) => r.id !== rule.id) },
                        `Deleted the "${rule.name}" rule`
                      );
                      setOpenId(null);
                    }}
                  >
                    Delete rule
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}

      <button className="hu-btn primary" onClick={addRule}>
        Add a rule
      </button>

      <div className="hu-eyebrow">Events with no matching rule</div>
      <div className="hu-card">
        <div className="hu-switch">
          <button
            className="hu-btn tiny"
            onClick={() =>
              persist({
                ...data,
                settings: { ...data.settings, fallback: !data.settings.fallback },
              })
            }
          >
            {data.settings.fallback ? "On" : "Off"}
          </button>
          <p>
            One catch-all heads-up the evening before
            <small>
              So an event whose title no rule recognises still says something
              rather than passing in silence.
            </small>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Import ---------- */
function ImportTab({ data, persist, onSeen }) {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState(null);
  const [markRead, setMarkRead] = useState(true);
  const s = data.settings;

  const ingest = (text) => {
    const found = parseICS(text);
    if (!found.length) {
      setResult({ ok: false, msg: "No events found. Is this an .ics file?" });
      return;
    }
    const existing = new Set(data.events.map((e) => e.id));
    const fresh = found.filter((e) => !existing.has(e.id));
    const seen = { ...data.state.seen };
    if (markRead) {
      const stamp = new Date().toISOString();
      fresh.forEach((e) => {
        seen[e.id] = stamp;
      });
    }
    persist({
      ...data,
      events: [...data.events.filter((e) => e.source !== "sample"), ...fresh],
      state: { ...data.state, seen },
    });
    setResult({
      ok: true,
      msg: `Added ${fresh.length} event${fresh.length === 1 ? "" : "s"}${
        found.length - fresh.length
          ? `, skipped ${found.length - fresh.length} already here`
          : ""
      }. ${
        markRead ? "All marked as read." : s.watchNew ? "Waiting for you under New." : ""
      }`,
    });
    setRaw("");
  };

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => ingest(String(r.result));
    r.onerror = () => setResult({ ok: false, msg: "Couldn't read that file." });
    r.readAsText(file);
  };

  return (
    <div className="hu-fade">
      <p className="hu-sub">
        Outlook can hand you an .ics file: open your calendar on the web, choose
        Share, then Publish a calendar, and download the ICS link. Or export it
        from the desktop app with Save Calendar.
      </p>

      <div className="hu-field">
        <label className="hu-label" htmlFor="ics-file">
          Upload an .ics file
        </label>
        <input
          id="ics-file"
          className="hu-input"
          type="file"
          accept=".ics,text/calendar"
          onChange={onFile}
        />
      </div>

      <div className="hu-field">
        <label className="hu-label" htmlFor="ics-paste">
          Or paste the file contents
        </label>
        <textarea
          id="ics-paste"
          className="hu-area"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="BEGIN:VCALENDAR…"
        />
      </div>

      <label className="hu-check">
        <input
          type="checkbox"
          checked={markRead}
          onChange={(e) => setMarkRead(e.target.checked)}
        />
        <span>
          Mark everything in this import as read. Leave this on for your first
          import so a year of events doesn't land in New at once.
        </span>
      </label>

      <button className="hu-btn primary" onClick={() => raw.trim() && ingest(raw)}>
        Read the calendar
      </button>

      {result && (
        <div className="hu-warn" style={{ marginTop: 16 }}>
          {result.msg}
        </div>
      )}

      <p className="hu-note">
        Repeating events are expanded for the next {HORIZON_DAYS} days. Times with
        a named time zone are read as your local time, so a calendar from another
        zone can be off by a few hours.
      </p>
    </div>
  );
}
