import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";

/* ============================================================
   HEADS UP — lead-time reminders for calendar events
   Model: Event × Task × Lead = one nudge.
   "Done" is recorded per (event, task) and cancels every lead.

   Presentation follows the "Ladder" direction: clinical paper —
   warm off-white ground, ink type, one amber reserved exclusively
   for live. Reminders are ledger rows — full-bleed, hairline-
   separated — and live is said with an amber rail and band, never
   with a fill. Labels are mono small-caps in fixed positions;
   every card scans in one order.
   ============================================================ */

const STORE_KEY = "headsup:v1";
const HORIZON_DAYS = 400;
const APP_VERSION = "1.4.0";
/* How far ahead, and how many, the app hands to the host to schedule. Android's
   alarm scheduler and iOS both get unhappy past a few dozen pending
   notifications, and a reminder six weeks out will be republished long before
   it matters. */
const SCHEDULE_DAYS = 30;
const SCHEDULE_MAX = 60;

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
  if (days === 1) return "1 day before";
  if (days === 7) return "1 week before";
  if (days === 14) return "2 weeks before";
  return `${days} days before`;
}
/* Mono chip form of a lead time: the ladder's rungs are read as a column. */
function leadChip(days) {
  if (days === 0) return "DAY OF";
  if (days === 7) return "1 WK";
  if (days === 14) return "2 WK";
  return `${days}D`;
}
function leadRung(days) {
  if (days === 0) return "DAY OF";
  if (days === 1) return "1 DAY BEFORE";
  if (days === 7) return "1 WEEK BEFORE";
  return `${days} DAYS BEFORE`;
}
/* T−nD — the same lead time in the ledger's shorthand. */
function tminus(days) {
  return days === 0 ? "T−0" : `T−${days}D`;
}
function alertLabel(mins) {
  if (mins === 0) return "at start";
  if (mins < 60) return `${mins} min before`;
  if (mins < 1440) return `${mins / 60} h before`;
  return `${mins / 1440} day before`;
}
function alertChip(mins) {
  if (mins === 0) return "AT TIME";
  if (mins < 60) return `${mins} MIN`;
  if (mins < 1440) return `${mins / 60} HOUR${mins === 60 ? "" : "S"}`;
  return `${mins / 1440} DAY`;
}
/* Mono small-caps labels are set as instrument readings, so the locale's comma
   goes: "FRI 7 AUG", not "FRI, 7 AUG". Order still comes from the locale. */
const capDate = (d) => fmtDate(d).replace(/,/g, "").toUpperCase();
/* Does this locale read the clock in halves? The calendar's 36px hour gutter
   has room for "06" or "6a", and it has to agree with the times on the blocks. */
const HOUR12 = (() => {
  try {
    return /\bam|\bpm/i.test(new Date(2020, 0, 1, 13).toLocaleTimeString());
  } catch (e) {
    return false;
  }
})();
const gutterHour = (h) =>
  HOUR12 ? `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}` : pad(h);
const hhmm = (d) =>
  `${pad(new Date(d).getHours())}:${pad(new Date(d).getMinutes())}`;
const minsOfClock = (s) =>
  s ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)) : 0;
const clockOfMins = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const sameDay = (a, b) =>
  !!a && !!b && startOfDay(a).getTime() === startOfDay(b).getTime();
const addDays = (d, n) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
};
/* ISO-8601 week number — the calendar shows it as KW nn. */
function isoWeek(d) {
  const t = startOfDay(d);
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const first = new Date(t.getFullYear(), 0, 4);
  return (
    1 + Math.round(((t - first) / MS_DAY - 3 + ((first.getDay() + 6) % 7)) / 7)
  );
}
const uid = () => Math.random().toString(36).slice(2, 9);
/* Keeps the first of each key, in order. */
function dedupeBy(list, key) {
  const seen = new Set();
  return list.filter((x) => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

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
  t = t
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return t.slice(0, 700);
}
function recurrenceLabel(rrule) {
  if (!rrule || !rrule.FREQ) return "";
  const f = rrule.FREQ.toUpperCase();
  const n = Math.max(1, parseInt(rrule.INTERVAL || "1", 10));
  const simple = {
    DAILY: "daily",
    WEEKLY: "weekly",
    MONTHLY: "monthly",
    YEARLY: "yearly",
  };
  const unit = {
    DAILY: "days",
    WEEKLY: "weeks",
    MONTHLY: "months",
    YEARLY: "years",
  };
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
          horizon,
        );
        /* DTEND is per-series; carry it forward as a duration so every
           expanded occurrence gets the same length. */
        const durationMs =
          cur.end && !isNaN(cur.end) && cur.end > cur.start
            ? cur.end - cur.start
            : null;
        occurrences.forEach((occ) => {
          if (occ < floor) return;
          events.push({
            id: `${cur.uid || uid()}@${dayKey(occ)}`,
            title: cur.title,
            start: occ.toISOString(),
            end: durationMs
              ? new Date(occ.getTime() + durationMs).toISOString()
              : null,
            allDay: !!cur.allDay,
            location: cur.location || "",
            description: cur.description || "",
            recurring: !!cur.rrule,
            repeats: recurrenceLabel(cur.rrule),
            organizer: cur.organizer || null,
            tasks: [],
            alerts: [],
            cat: "personal",
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
    else if (p.name === "DESCRIPTION")
      cur.description = cleanDescription(p.value);
    else if (p.name === "UID") cur.uid = p.value.trim();
    else if (p.name === "DTSTART") {
      const { date, allDay } = parseDT(p.value, p.params);
      if (!isNaN(date)) {
        cur.start = date;
        cur.allDay = allDay;
      }
    } else if (p.name === "DTEND") {
      const { date } = parseDT(p.value, p.params);
      if (!isNaN(date)) cur.end = date;
    } else if (p.name === "ORGANIZER") {
      cur.organizer = {
        name: p.params.CN
          ? unescapeText(p.params.CN.replace(/^"|"$/g, ""))
          : "",
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
    r(
      "Birthday",
      ["birthday", "bday", "b-day", "geburtstag"],
      [
        [
          "Buy a present",
          [
            { days: 10, hour: 9 },
            { days: 5, hour: 9 },
            { days: 2, hour: 18 },
          ],
        ],
        [
          "Write the card",
          [
            { days: 1, hour: 19 },
            { days: 0, hour: 8 },
          ],
        ],
      ],
    ),
    r(
      "Trip or flight",
      [
        "flight",
        "trip",
        "travel",
        "vacation",
        "holiday",
        "hotel",
        "airport",
        "train",
      ],
      [
        ["Check documents and check in", [{ days: 2, hour: 18 }]],
        [
          "Pack your bag",
          [
            { days: 1, hour: 8 },
            { days: 1, hour: 20 },
          ],
        ],
      ],
    ),
    r(
      "Wedding or party",
      ["wedding", "party", "celebration", "anniversary"],
      [
        [
          "Sort a gift and an outfit",
          [
            { days: 7, hour: 9 },
            { days: 2, hour: 9 },
          ],
        ],
      ],
    ),
    r(
      "Presentation",
      ["presentation", "interview", "pitch", "demo", "review"],
      [
        [
          "Prepare and rehearse",
          [
            { days: 3, hour: 9 },
            { days: 1, hour: 17 },
          ],
        ],
      ],
    ),
    r(
      "Appointment",
      ["doctor", "dentist", "appointment", "checkup", "physio", "clinic"],
      [["Bring documents and insurance card", [{ days: 1, hour: 18 }]]],
    ),
    r(
      "Booking",
      ["dinner", "restaurant", "reservation", "table"],
      [["Confirm the booking", [{ days: 1, hour: 10 }]]],
    ),
  ];
}
/* Calendar categories. Only the colour of the rail on a calendar block and the
   chip in the event sheet — they carry no scheduling meaning. */
const CATS = {
  work: { name: "Work", fg: "#3f5a7a", bg: "#eef2f7" },
  personal: { name: "Personal", fg: "#e8813f", bg: "#fbeadd" },
  family: { name: "Family", fg: "#5f7f5c", bg: "#edf2ea" },
  trip: { name: "Travel", fg: "#8a6a4f", bg: "#f4ece4" },
};
const catOf = (key) => CATS[key] || CATS.personal;

function sampleEvents() {
  const mk = (title, offsetDays, from, to, cat, extra = {}) => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() + offsetDays);
    const allDay = !from;
    let end = null;
    if (!allDay) {
      d.setHours(...from, 0, 0);
      const e = startOfDay(d);
      e.setDate(e.getDate() + (to[0] < from[0] ? 1 : 0));
      e.setHours(...to, 0, 0);
      end = e.toISOString();
    }
    return {
      id: `sample-${uid()}`,
      title,
      start: d.toISOString(),
      end,
      allDay,
      location: "",
      description: "",
      recurring: false,
      repeats: "",
      organizer: null,
      tasks: [],
      alerts: [],
      cat,
      source: "sample",
      ...extra,
    };
  };
  return [
    mk("Design review", 0, [10, 0], [11, 30], "work", {
      location: "Studio, room 2",
      description: "Bring the ladder prototypes.",
      alerts: [15],
    }),
    mk("Lunch with Jo", 0, [13, 0], [14, 0], "personal", {
      location: "Café Nord",
    }),
    mk("Quarterly planning", 1, [9, 0], [12, 0], "work", {
      location: "Studio, big room",
      description: "Bring the roadmap one-pager.",
      alerts: [1440],
    }),
    mk("Flight LH1042 — Lisbon", 2, [7, 15], [9, 45], "trip", {
      location: "BER Terminal 1, Berlin",
      description: "Cabin bag only — 55×40×23.",
      alerts: [1440, 120],
    }),
    mk("Lisbon — three nights", 2, null, null, "trip", { location: "Alfama" }),
    mk("Client workshop", 5, [10, 0], [16, 0], "work", {
      location: "Lisbon office",
    }),
    mk("Return flight LH1043", 6, [18, 40], [21, 10], "trip", {
      location: "LIS Terminal 1",
      alerts: [120],
    }),
    mk("Team retro", 7, [15, 0], [16, 0], "work", {
      location: "Studio, room 2",
    }),
    mk("Yoga", 7, [19, 0], [20, 0], "personal", {
      location: "Prenzlauer studio",
    }),
    mk("Mara's birthday", 10, null, null, "family", {
      recurring: true,
      repeats: "yearly",
      description: "Repeats yearly. Last year: the ceramics book.",
    }),
    mk("Dinner — Anna and Jo", 10, [19, 30], [22, 0], "personal", {
      location: "Nobelhart",
      description: "Booked under Anna.",
    }),
    mk("Parents visiting", 13, null, null, "family"),
    mk("Sprint kickoff", 14, [9, 30], [10, 30], "work", { location: "Studio" }),
    mk("Dentist — cleaning", 16, [11, 0], [12, 0], "personal", {
      location: "Dr. Reuter, Kastanienallee 12",
      description: "Bring the insurance card.",
      alerts: [1440, 60],
    }),
    mk("Car service", 19, [8, 0], [9, 0], "personal", {
      location: "Werkstatt Ohlauer",
    }),
  ];
}
/* ---------- to-do lists ----------
   Accents are the muted inks of the paper palette. Amber is not among them:
   it belongs to "live" and nothing else.                                  */
const ACCENTS = [
  "#3f5a7a",
  "#5f7f5c",
  "#8a6a4f",
  "#7a6a8c",
  "#436f6d",
  "#8c5b6b",
];
const nextAccent = (lists) => ACCENTS[lists.length % ACCENTS.length];

function defaultLists() {
  const inDays = (n, h = 12) => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() + n);
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
  };
  const lead = (...days) =>
    days.map((d) => ({ kind: "lead", days: d, hour: 9 }));
  const item = (title, due, reminders, notes, subtasks = []) => ({
    id: uid(),
    title,
    notes: notes || "",
    due,
    reminders,
    done: false,
    subtasks: subtasks.map((s) => ({
      id: uid(),
      title: s[0],
      due: s[1] ?? null,
      reminders: [],
      done: !!s[2],
    })),
  });
  const list = (id, name, accent, items) => ({ id, name, accent, items });
  return [
    list("list-house", "House related", ACCENTS[0], [
      item(
        "Replace water filter",
        inDays(10, 9),
        lead(7, 2),
        "Model BWT 814. Two-pack, arrives in 3–4 days.",
        [
          ["Order filter cartridges", inDays(1, 9), true],
          ["Turn off the stopcock", null, false],
          ["Swap and flush", inDays(10, 9), false],
        ],
      ),
      item(
        "Renew home insurance",
        inDays(-9, 9),
        lead(14, 7, 1),
        "Barmenia's quote is €18/mo cheaper — the cancellation letter must be posted, not emailed.",
      ),
      item("Bleed the radiators", null, [], ""),
      item(
        "Fix the bathroom light",
        null,
        [],
        "Needs a GU10 and probably a new fitting.",
        [
          ["Measure the fitting", null, false],
          ["Buy the bulb", null, false],
        ],
      ),
    ]),
    list("list-buy", "Things to buy", ACCENTS[1], [
      item(
        "Present for Mara",
        inDays(10, 9),
        lead(10, 5),
        "She mentioned the Bauhaus weaving book.",
      ),
      item("Coffee beans", null, [], ""),
      item("Dish soap", null, [], ""),
      item("Extension cable, 5 m", null, [], ""),
    ]),
    list("list-work", "Work", ACCENTS[2], [
      item(
        "Q3 headcount sheet",
        inDays(7, 9),
        lead(5, 1),
        "Finance wants it before the board pre-read goes out.",
        [
          ["Pull the current roster", null, true],
          ["Confirm two open reqs", null, true],
          ["Send to Anke", inDays(7, 9), false],
        ],
      ),
      item("Book the offsite room", inDays(15, 9), lead(7), ""),
    ]),
    list("list-groceries", "Groceries", ACCENTS[3], [
      item("Olive oil", null, [], ""),
      item("Bread flour", null, [], ""),
      item("Yoghurt", null, [], ""),
      item("Tomatoes", null, [], ""),
      item("Washing-up sponges", null, [], ""),
    ]),
    list("list-admin", "Admin and paperwork", ACCENTS[4], [
      item(
        "Tax return 2025",
        inDays(56, 9),
        lead(30, 14, 3),
        "Belege für das Arbeitszimmer fehlen noch.",
        [
          ["Collect receipts", null, false],
          ["Book an hour with the Steuerberater", inDays(36, 9), false],
        ],
      ),
      item(
        "Renew passport",
        inDays(90, 9),
        lead(60, 21),
        "Expires next November, but appointments run eight weeks out.",
      ),
      item("Cancel the gym membership", inDays(-5, 9), lead(7), ""),
    ]),
    list("list-bike", "Bike", ACCENTS[5], [
      item("Service before Lisbon", inDays(1, 9), lead(3), "", [
        ["Drop off at Standert", null, false],
      ]),
      item("New rear light", null, [], ""),
    ]),
    list("list-reading", "Reading", ACCENTS[0], [
      item("Return the library books", inDays(6, 9), lead(2), ""),
      item("Finish the Le Guin", null, [], ""),
      item("Order the Perec", null, [], ""),
    ]),
    list("list-garden", "Garden", ACCENTS[1], [
      item(
        "Cut back the wisteria",
        inDays(17, 9),
        lead(3),
        "Second cut of the year — five buds from the base.",
      ),
      item("Water timer batteries", null, [], ""),
    ]),
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
      /* added in 1.2.0 — loadData merges over these, so no migration */
      quiet: true,
      quietFrom: "22:00",
      quietTo: "07:00",
      defaultLead: 2,
      defaultSnooze: "3h",
      calDefault: "week",
      weekStart: "mon",
      weekNums: true,
      undatedAt: "bottom",
      confirmDelete: false,
      sound: "chime",
      badge: true,
      haptics: true,
    },
  };
};

/* ---------- nudge engine ----------
   Quiet hours are a pure function of the computed due time, applied at the
   end of the calculation. They never touch the keys: doneKey and the snooze
   key are built from (event, task) and (days, hour), so moving a due time out
   of the quiet window can never orphan a completion.                      */
function applyQuiet(due, settings) {
  if (!settings || !settings.quiet) return due;
  const from = minsOfClock(settings.quietFrom || "22:00");
  const to = minsOfClock(settings.quietTo || "07:00");
  if (from === to) return due;
  const at = due.getHours() * 60 + due.getMinutes();
  const inside = from < to ? at >= from && at < to : at >= from || at < to;
  if (!inside) return due;
  const out = new Date(due);
  /* A window that wraps midnight pushes to the *next* morning when the due
     time is in the late-evening half of it. */
  if (from > to && at >= from) out.setDate(out.getDate() + 1);
  out.setHours(Math.floor(to / 60), to % 60, 0, 0);
  return out;
}

function matchRules(event, rules) {
  const t = event.title.toLowerCase();
  return rules.filter(
    (r) =>
      r.enabled && r.keywords.some((k) => k && t.includes(k.toLowerCase())),
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
        tasks.push({ rule: rule.name, ruleId: rule.id, task }),
      ),
    );
    (ev.tasks || []).forEach((task) =>
      tasks.push({ rule: "You added this one", ruleId: "custom", task }),
    );
    /* Plain calendar alerts — minutes before the start, not rungs of a ladder.
       They are pushed before the fallback check so an event that carries only
       alerts does not also collect a catch-all nudge (invariant 6). */
    (ev.alerts || []).forEach((mins) =>
      tasks.push({
        rule: "Alert on the event",
        ruleId: "alert",
        task: {
          id: `alert-${mins}`,
          label: ev.title,
          leads: [{ minutes: mins }],
        },
      }),
    );
    if (!tasks.length && settings.fallback) {
      tasks.push({
        rule: "No rule matched",
        ruleId: "fallback",
        task: {
          id: "fallback",
          label: "Heads up — anything to prepare?",
          leads: [
            { days: settings.defaultLead ?? 1, hour: settings.fallbackHour },
          ],
        },
      });
    }
    tasks.forEach(({ rule, ruleId, task }) => {
      const doneKey = `${ev.id}::${ruleId}::${task.id}`;
      const doneAt = state.done[doneKey];
      task.leads.forEach((lead) => {
        const isAlert = lead.minutes != null;
        let due;
        let snoozeKey;
        if (isAlert) {
          due = new Date(new Date(start).getTime() - lead.minutes * 60000);
          snoozeKey = `${doneKey}::m${lead.minutes}`;
        } else {
          due = startOfDay(start);
          due.setDate(due.getDate() - lead.days);
          due.setHours(lead.hour || 0, lead.minute || 0, 0, 0);
          /* Quiet hours move day-based rungs only. An alert measured in minutes
             from the start would land after its own event if shifted. */
          due = applyQuiet(due, settings);
          snoozeKey = `${doneKey}::${lead.days}:${lead.hour}`;
        }
        const snoozedTo = state.snoozed[snoozeKey];
        out.push({
          id: snoozeKey,
          doneKey,
          eventId: ev.id,
          eventTitle: ev.title,
          eventStart: ev.start,
          eventEnd: ev.end || null,
          allDay: ev.allDay,
          location: ev.location,
          cat: ev.cat || "personal",
          event: ev,
          ruleName: rule,
          label: task.label,
          lead: isAlert ? null : lead.days,
          alertMinutes: isAlert ? lead.minutes : null,
          dueAt: (snoozedTo ? new Date(snoozedTo) : due).toISOString(),
          baseDueAt: due.toISOString(),
          done: !!doneAt,
          doneAt: doneAt || null,
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
            {
              kind: "lead",
              days: 0,
              hour: settings.todoAutoHour ?? 9,
              implicit: true,
            },
          ];
        }
        const base = `todo::${list.id}::${item.id}::${subId || "-"}`;
        rems.forEach((rem, i) => {
          let due = resolveReminder(rem, anchor);
          if (!due) return;
          if (rem.kind !== "at") due = applyQuiet(due, settings);
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
            doneAt: owner.doneAt || item.doneAt || null,
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
    (a, b) => new Date(a.dueAt) - new Date(b.dueAt),
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

/* ---------- buckets ----------
   Home sorts by when a reminder is due, never by when its event happens.
   Everything already due collapses into one live band; the rest is bucketed
   by distance so the page can be scanned in one pass.                     */
const BUCKETS = [
  ["today", "TODAY"],
  ["tomorrow", "TOMORROW"],
  ["week", "THIS WEEK"],
  ["later", "LATER"],
];
/* The last moment of the calendar week `d` falls in, honouring the same
   weekStart the calendar uses — so "this week" means one thing in the app. */
function endOfWeek(d, weekStart) {
  const dow =
    weekStart === "sun" ? new Date(d).getDay() : (new Date(d).getDay() + 6) % 7;
  const end = addDays(d, 6 - dow);
  end.setHours(23, 59, 59, 999);
  return end;
}
/* THIS WEEK is the calendar week, not the next seven days. On a Saturday,
   something due the following Wednesday is not "this week" however few days
   away it is — it is LATER, and saying otherwise is the kind of small lie that
   makes a queue untrustworthy.

   A consequence worth knowing: late in the week THIS WEEK empties out and LATER
   grows. That is the honest shape of a calendar week, and the four buckets the
   design specifies have no NEXT WEEK to put it in. */
function bucketOf(nudge, now, weekStart) {
  const due = new Date(nudge.dueAt);
  if (due <= now) return "now";
  if (sameDay(due, now)) return "today";
  if (sameDay(due, addDays(now, 1))) return "tomorrow";
  if (due <= endOfWeek(now, weekStart)) return "week";
  return "later";
}

/* ---------- runway ----------
   One event's whole ladder on a single track: every rung from the first
   heads-up to the event itself, with the ones already handled marked. Pure —
   it reads the nudge list it is handed and nothing else.                   */
function buildRunway(nudges, events, now) {
  const byEvent = new Map();
  nudges.forEach((n) => {
    if (n.kind === "todo" || !n.eventId) return;
    if (new Date(n.eventStart) < startOfDay(now)) return;
    if (!byEvent.has(n.eventId)) byEvent.set(n.eventId, []);
    byEvent.get(n.eventId).push(n);
  });
  const candidates = [...byEvent.entries()]
    .map(([eventId, list]) => ({
      eventId,
      event: (events || []).find((e) => e.id === eventId) || list[0].event,
      /* One row per task, not per rung: two lead times on the same task are one
         thing to do, and marking either done clears both. The row sits at the
         task's earliest rung. */
      steps: dedupeBy(
        list
          .slice()
          .sort((a, b) => new Date(a.baseDueAt) - new Date(b.baseDueAt)),
        (n) => n.doneKey,
      ),
    }))
    .filter((c) => c.event && c.steps.length > 1)
    .sort((a, b) => new Date(a.event.start) - new Date(b.event.start));
  const pick = candidates[0];
  if (!pick) return null;

  const eventAt = new Date(pick.event.start);
  const first = new Date(pick.steps[0].baseDueAt);
  const span = Math.max(eventAt - first, 60000);
  const pct = (t) =>
    Math.max(0, Math.min(100, ((new Date(t) - first) / span) * 100));
  const ahead = pick.steps.filter((s) => !s.done).length;
  const daysLeft = Math.max(0, daysApart(eventAt, now));

  return {
    event: pick.event,
    nowPct: pct(now),
    daysLeft,
    ahead,
    steps: pick.steps.map((s) => ({
      nudge: s,
      lead: s.alertMinutes != null ? alertChip(s.alertMinutes) : `${s.lead}D`,
      left: pct(s.baseDueAt),
      state: s.done
        ? "HANDLED"
        : new Date(s.dueAt) <= now
          ? "DUE NOW"
          : "AHEAD",
    })),
  };
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
   UI — "Ladder": clinical paper
   ------------------------------------------------------------
   One CSS string, injected as a <style>. There is no Tailwind
   compiler in the target runtime, so arbitrary-value classes
   silently do nothing; every value lives here or, when it is
   computed at render time (a track position, a category colour),
   in an inline style.

   The palette has exactly one accent. #e8813f is amber and amber
   means live — a reminder that is due right now. Nothing else may
   use it. Origin is carried by the rail down the left edge of a
   card: ink for a calendar event, slate blue for a to-do, amber
   when the thing is live.
   ============================================================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,400;0,500;0,600;0,700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.lx{
  --paper:#f7f5f0; --card:#fff; --panel:#fbf9f5; --sunk:#f4f1ea; --sunk-2:#f2efe8;
  --seam:#eae6dd;
  --ink:#17160f; --ink-2:#2c2a20; --on-ink:#faf8f2;
  --dark:#17160f; --dark-2:#211f18; --dark-line:#302e26; --dark-border:#3a382e;
  --dark-label:#7a746a; --dark-meta:#8c8578; --dark-value:#e6e2d8;
  --amber:#e8813f; --amber-ink:#b4470f;
  --mute:#6f6a5e; --mute-2:#8b8578; --mute-3:#a09a8c; --mute-4:#b3ada0; --mute-5:#c2bcae;
  --line:#e2ded4; --line-2:#e6e1d7; --line-3:#efece4; --line-4:#ece8e0;
  --field:#ddd8cc; --field-2:#d9d3c6; --field-3:#cfc9bb; --dash:#d8d3c7;
  --blue:#3f5a7a; --blue-bg:#eef2f7; --blue-line:#dde5ef; --blue-mute:#93a4b8;
  --green:#5f7f5c;
  /* The rail colour again at chip strength, behind the origin label. */
  --tint-live:#f6d9c2; --tint-todo:#d5dee8; --tint-event:#e6e2d8;
  --warn:#9a6410; --warn-bg:#fdf6ea; --warn-line:#e6d3b8; --warn-ink:#4a3812;
  --warn-text:#6b5326; --warn-dot:#c98a26; --warn-chip:#fdf1dd;
  --danger:#b4470f; --danger-bg:#fdf4f0; --danger-line:#e8cfc2;
  --body:'Public Sans',system-ui,-apple-system,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,'SF Mono',monospace;
  /* The tab bar's own height, safe area included, so the two things that float
     above it can be positioned from one number. */
  --nav-h:calc(64px + max(8px, env(safe-area-inset-bottom)));
  background:#e8e4de; color:var(--ink); font-family:var(--body);
  -webkit-font-smoothing:antialiased;
  /* DEFINITE height, not min-height. A flex column whose height comes from its
     content cannot make a child scroll: the child just grows, the document
     scrolls instead, and the tab bar ends up thousands of pixels below the fold.
     dvh so the mobile URL bar collapsing does not clip the tab bar; vh first as
     the fallback for browsers without it. */
  height:100vh; height:100dvh; overflow:hidden;
  display:flex; flex-direction:column;
}
.lx *,.lx *::before,.lx *::after{box-sizing:border-box}
.lx button,.lx input,.lx textarea,.lx select{font-family:inherit}
.lx button:focus-visible,.lx input:focus-visible,.lx textarea:focus-visible,
.lx select:focus-visible,.lx [tabindex]:focus-visible{
  outline:2px solid var(--amber-ink); outline-offset:2px}
.lx-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;
  clip:rect(0 0 0 0);white-space:nowrap;border:0}
@keyframes lx-undobar{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@keyframes lx-rise{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}

/* ---------- shell ---------- */
.lx-phone{flex:1;width:100%;max-width:440px;margin:0 auto;min-height:0;
  display:flex;flex-direction:column;position:relative;overflow:hidden;
  background:var(--paper)}
/* min-height:0 on a flex child is what lets it be *smaller* than its content,
   which is the precondition for it scrolling at all. Without it the default
   min-height:auto wins and the child refuses to shrink. */
@media (min-width:520px){
  .lx-phone{max-height:900px;margin:22px auto;border-radius:22px;
    box-shadow:0 2px 4px rgba(0,0,0,.08),0 18px 44px rgba(0,0,0,.16)}
}
.lx-status{height:26px;flex:none;display:grid;grid-template-columns:1fr auto 1fr;
  align-items:center;padding:0 18px;font:500 10.5px var(--mono);color:var(--mute-3);
  background:var(--paper)}
.lx-status .mark{letter-spacing:.12em}
.lx-status .end{text-align:right}
.lx-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;position:relative;
  -webkit-overflow-scrolling:touch;
  /* Keep the rubber band and pull-to-refresh out of a surface whose rows are
     swiped sideways for a living. */
  overscroll-behavior:contain}
.lx-scroll::-webkit-scrollbar,.lx-sheet-body::-webkit-scrollbar{width:0;height:0}
.lx-page{padding:6px 16px 26px}
.lx-page.flush{padding:8px 0 24px}

/* ---------- tab bar ---------- */
.lx-nav{flex:none;height:var(--nav-h);border-top:1px solid var(--line);
  background:var(--panel);display:grid;grid-template-columns:repeat(4,1fr);
  padding-top:6px;padding-bottom:max(8px,env(safe-area-inset-bottom))}
.lx-nav button{border:0;background:transparent;cursor:pointer;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:6px;padding-top:6px}
.lx-nav .lab{font:500 10.5px var(--body)}
.lx-ico{position:relative;display:block;width:20px;height:20px}
.lx-ico i{position:absolute;display:block;background:currentColor}
.lx-navbadge{position:absolute;top:-7px;right:-11px;min-width:17px;height:17px;
  padding:0 4px;border-radius:9px;color:var(--on-ink);
  font:600 10px/17px var(--mono);text-align:center}

/* ---------- page header ---------- */
.lx-head{display:flex;align-items:flex-end;justify-content:space-between;
  padding:8px 2px 14px;gap:10px}
.lx-h1{font:600 21px/1.1 var(--body);color:var(--ink);letter-spacing:-.01em}
.lx-h1-sub{font:500 11px var(--mono);color:var(--mute-3);margin-top:4px;letter-spacing:.06em}
.lx-dots{width:44px;height:44px;margin-right:-10px;flex:none;border:0;background:transparent;
  color:var(--mute);font:500 17px var(--mono);cursor:pointer}

/* ---------- counters ---------- */
.lx-counters{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--line);
  border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-bottom:22px}
.lx-counter{background:var(--card);padding:9px 11px 10px}
.lx-counter.live{background:var(--dark)}
.lx-counter .k{font:500 9.5px var(--mono);letter-spacing:.1em;color:var(--mute-3)}
.lx-counter.live .k{color:var(--amber)}
.lx-counter .v{font:600 22px/1 var(--body);color:var(--ink);margin-top:5px}
.lx-counter.live .v{color:var(--on-ink)}

/* ---------- the live card ----------
   Filled, not tinted: at arm's length this is a different kind of
   object, not the same object in a different shade. */
.lx-live{background:var(--dark);border-left:5px solid var(--amber);
  border-radius:0 14px 14px 0;padding:15px 15px 13px;margin-bottom:22px;
  box-shadow:0 8px 22px rgba(23,22,15,.18);cursor:pointer}
.lx-live-top{display:flex;align-items:center;justify-content:space-between;
  gap:10px;margin-bottom:11px}
.lx-due{display:inline-block;background:var(--amber);color:var(--ink);
  font:600 9.5px var(--mono);letter-spacing:.12em;padding:4px 7px 3px;border-radius:3px;
  white-space:nowrap}
.lx-rung{display:flex;align-items:center;gap:8px;font:500 10px var(--mono);
  letter-spacing:.07em;color:var(--dark-meta);white-space:nowrap}
.lx-rung em{color:#5d584f;font-style:normal}
.lx-live h3{margin:0 0 13px;font:600 22px/1.18 var(--body);color:var(--on-ink);
  letter-spacing:-.015em;text-wrap:pretty}
.lx-live-open{margin-top:11px;padding:11px 12px;background:var(--dark-2);
  border-radius:9px;display:flex;flex-direction:column;gap:8px}
.lx-live-act{display:flex;gap:8px;margin-top:12px}
.lx-btn-amber{flex:1;height:48px;border:0;border-radius:9px;background:var(--amber);
  color:var(--ink);font:600 14.5px var(--body);cursor:pointer}
.lx-btn-dark{flex:none;width:104px;height:48px;border:1px solid var(--dark-border);
  border-radius:9px;background:transparent;color:var(--dark-value);
  font:500 14px var(--body);cursor:pointer}
.lx-snoozelist{margin-top:11px;display:flex;flex-direction:column;gap:1px;
  background:var(--dark-line);border-radius:9px;overflow:hidden}
.lx-snoozelist button{border:0;background:var(--dark-2);color:var(--dark-value);
  text-align:left;padding:0 13px;height:46px;font:400 14px var(--body);cursor:pointer;
  display:flex;align-items:center;justify-content:space-between;gap:10px}
.lx-snoozelist .at{font:500 10px var(--mono);color:var(--dark-meta);letter-spacing:.06em}

/* ---------- the shared key/value table ----------
   Every card body is this grid, in this order. Nothing invents its own. */
.lx-kv{display:flex;flex-direction:column;gap:7px;padding:11px 0 12px;
  border-top:1px solid var(--dark-line);border-bottom:1px solid var(--dark-line)}
.lx-kv-row{display:grid;grid-template-columns:66px 1fr;gap:10px;align-items:baseline}
.lx-kv-k{font:500 9.5px var(--mono);letter-spacing:.1em;color:var(--dark-label)}
.lx-kv-v{font:400 13.5px/1.35 var(--body);color:var(--dark-value);text-wrap:pretty}
.lx-kv.paper{gap:6px;padding:10px 0 0;border-top:1px solid var(--line-3);border-bottom:0}
.lx-kv.paper .lx-kv-k{color:var(--mute-4)}
.lx-kv.paper .lx-kv-v{color:var(--ink-2)}
.lx-marks{display:flex;flex-wrap:wrap;gap:6px;padding-top:10px}
.lx-mark{font:500 9px var(--mono);letter-spacing:.1em;color:var(--dark-meta);
  border:1px solid var(--dark-border);border-radius:3px;padding:3px 5px 2px}
.lx-marks.paper{padding-top:0;margin-top:10px}
.lx-marks.paper .lx-mark{color:var(--mute-3);border-color:var(--line-2)}

/* ---------- section headers ---------- */
.lx-sec{margin-bottom:20px}
.lx-sec-head{display:flex;align-items:center;gap:9px;margin-bottom:9px;padding:0 2px}
.lx-sec-label{font:500 10px var(--mono);letter-spacing:.13em;color:var(--mute-2)}
.lx-rule-line{flex:1;height:1px;background:var(--line)}
.lx-sec-count{font:500 10px var(--mono);color:var(--mute-4)}
.lx-stack{display:flex;flex-direction:column;gap:9px}

/* ---------- the queued card ---------- */
.lx-card{background:var(--card);border:1px solid var(--line-2);
  border-left:5px solid var(--line);border-radius:0 13px 13px 0;
  padding:13px 14px 12px;cursor:pointer;text-align:left;width:100%;display:block}
.lx-card-top{display:flex;align-items:center;justify-content:space-between;
  gap:10px;margin-bottom:8px}
.lx-card-k{font:500 9.5px var(--mono);letter-spacing:.1em;color:var(--mute-3);
  white-space:nowrap}
.lx-card-due{display:flex;align-items:center;gap:8px;font:500 9.5px var(--mono);
  letter-spacing:.08em;color:var(--mute);white-space:nowrap}
.lx-card-due em{color:var(--mute-5);font-style:normal}
.lx-card-live{font:600 9.5px var(--mono);letter-spacing:.12em;color:var(--amber-ink);
  white-space:nowrap}
.lx-card h3{margin:0 0 11px;font:600 17.5px/1.22 var(--body);color:var(--ink);
  letter-spacing:-.01em;text-wrap:pretty}
.lx-card-open{margin-top:10px;padding:11px 12px;background:var(--sunk);
  border-radius:9px;display:flex;flex-direction:column;gap:8px}
.lx-card-act{display:flex;gap:8px;margin-top:11px}
.lx-btn-quiet{flex:1;height:44px;border:1px solid var(--field-2);border-radius:9px;
  background:var(--panel);color:var(--ink);font:500 14px var(--body);cursor:pointer}
.lx-btn-quiet.narrow{flex:none;width:104px}

/* ---------- Home: the ledger ----------
   Full-bleed rows, not cards. The rail runs the whole height of a row and says
   where the reminder came from; the only boundary is a hairline. Live earns a
   filled amber band across the full width — with no card edge to fill, the band
   is the strongest state change available, and it carries the origin at the same
   time.

   Deliberately no caret and no mark chips, unlike the card treatment: the origin
   is now permanent rather than hidden behind a tap, and a ledger that grows
   badges stops being a ledger. Recurrence moved into the WHEN value, where it
   reads as part of the sentence. */
.lx-led{margin:0 -16px 22px;padding:0 16px 15px;background:var(--paper);
  border-bottom:1px solid var(--line);border-left:7px solid var(--line);
  cursor:pointer;text-align:left;width:100%;display:block}
.lx-led-head{margin:0 -16px 11px;padding:6px 16px 5px;display:flex;
  align-items:center;justify-content:space-between;gap:10px}
.lx-led-head .from{font:600 9.5px var(--mono);letter-spacing:.14em;color:var(--ink);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lx-led-head .now{font:600 9.5px var(--mono);letter-spacing:.1em;
  color:rgba(23,22,15,.62);flex:none}
.lx-led-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;
  margin-bottom:8px}
.lx-led-meta .t{font:600 9.5px var(--mono);letter-spacing:.12em;color:var(--ink)}
.lx-led-meta .due{font:500 9.5px var(--mono);letter-spacing:.08em;color:var(--mute-2);
  flex:none}
.lx-led h3{margin:0 0 12px;font:700 25px/1.08 var(--body);color:var(--ink);
  letter-spacing:-.022em;text-wrap:pretty}
.lx-led-rows{display:flex;flex-direction:column}
.lx-led-row{display:grid;grid-template-columns:66px 1fr;gap:10px;align-items:baseline;
  padding:7px 0;border-top:1px solid var(--line)}
.lx-led-row .k{font:500 9.5px var(--mono);letter-spacing:.1em;color:var(--mute-3)}
.lx-led-row .v{font:400 13.5px/1.35 var(--body);color:var(--ink);text-wrap:pretty}
.lx-led-act{display:flex;gap:8px;margin-top:13px}
/* Square corners: a ledger has rules, not rounded cards. */
.lx-btn-ink{flex:1;height:48px;border:0;background:var(--ink);color:var(--on-ink);
  font:600 14.5px var(--body);cursor:pointer}
.lx-btn-line{flex:none;width:104px;height:48px;border:1px solid var(--field-3);
  background:transparent;color:#4a463b;font:500 14px var(--body);cursor:pointer}
.lx-led-snooze{display:flex;flex-direction:column;margin-top:4px}
.lx-led-snooze button{border:0;border-top:1px solid var(--line);background:transparent;
  color:var(--ink);text-align:left;padding:0;height:46px;font:400 14px var(--body);
  cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px}
.lx-led-snooze .at{font:500 10px var(--mono);color:var(--mute-3);letter-spacing:.06em}

/* A queued row: no band, an origin chip instead, and quieter throughout. */
.lx-led.q{margin:0 -16px;padding:13px 16px 14px}
.lx-led-tags{display:flex;align-items:center;justify-content:space-between;gap:10px;
  margin-bottom:7px}
.lx-led-tags .left{display:flex;align-items:baseline;gap:7px;min-width:0}
.lx-led-tags .origin{font:600 9px var(--mono);letter-spacing:.1em;color:var(--ink);
  padding:2px 5px 1px;flex:none}
.lx-led-tags .rung{font:500 9.5px var(--mono);letter-spacing:.1em;color:var(--mute-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lx-led-tags .due{font:500 9.5px var(--mono);letter-spacing:.08em;color:var(--mute-3);
  flex:none}
.lx-led.q h3{margin:0 0 10px;font:600 19.5px/1.15 var(--body);letter-spacing:-.016em}
.lx-led.q .lx-led-row{padding:5px 0;border-top:1px solid var(--line-4)}
.lx-led.q .lx-led-row .k{color:var(--mute-4)}
.lx-led.q .lx-led-row .v{color:var(--ink-2)}
.lx-btn-led{width:100%;height:44px;margin-top:10px;border:1px solid var(--field-2);
  background:transparent;color:var(--ink);font:500 14px var(--body);cursor:pointer}
/* Rows butt against each other; the hairline is the separator, not a gap. */
.lx-led-list{display:flex;flex-direction:column}
.lx-sec.led{margin-bottom:18px}
.lx-sec.led .lx-sec-head{margin-bottom:2px}

/* ---------- empty states ---------- */
.lx-empty{border:1px dashed var(--dash);border-radius:14px;padding:26px 18px;
  text-align:center;margin-bottom:22px}
.lx-empty .t{font:600 15px var(--body);color:var(--ink)}
.lx-empty .d{font:400 13px/1.5 var(--body);color:var(--mute-2);margin-top:5px}

/* ---------- runway ----------
   One event's whole ladder on a single track. The thing you forget
   about your own rule is its shape. */
.lx-block{margin-top:26px;padding-top:18px;border-top:1px solid var(--line)}
.lx-block-head{display:flex;align-items:baseline;justify-content:space-between;
  margin-bottom:12px;padding:0 2px;gap:10px}
.lx-block-note{font:400 11px var(--body);color:var(--mute-4)}
.lx-panel{background:var(--card);border:1px solid var(--line-2);border-radius:13px;
  padding:14px 15px 16px}
.lx-runway-t{font:600 15.5px var(--body);color:var(--ink);text-wrap:pretty}
.lx-runway-m{font:500 10.5px var(--mono);color:var(--mute-3);margin-top:4px;
  letter-spacing:.06em}
.lx-track{position:relative;height:56px;margin:18px 0 4px}
.lx-track-base{position:absolute;left:0;right:0;top:15px;height:2px;background:var(--line-3)}
.lx-track-fill{position:absolute;left:0;top:15px;height:2px;background:var(--ink)}
.lx-track-now{position:absolute;top:2px;bottom:16px;width:1px;background:var(--amber)}
.lx-dot{position:absolute;top:9px;width:14px;height:14px;margin-left:-7px;
  border-radius:50%;background:var(--ink);border:3px solid var(--card);
  box-shadow:0 0 0 1px var(--ink)}
.lx-dot.now{top:6px;width:20px;height:20px;margin-left:-10px;background:var(--amber);
  box-shadow:0 0 0 1px var(--amber)}
.lx-dot.ahead{top:11px;width:10px;height:10px;margin-left:-5px;background:var(--card);
  border:2px solid var(--field-3);box-shadow:none}
.lx-track-end{position:absolute;right:0;top:8px;width:4px;height:16px;background:var(--ink)}
.lx-track-lab{position:absolute;top:30px;font:500 9px var(--mono);color:var(--mute-3);
  letter-spacing:.06em;white-space:nowrap;transform:translateX(-50%)}
.lx-track-lab.hot{font-weight:600;color:var(--amber-ink)}
.lx-track-lab.tail{right:0;transform:none;font-weight:600;color:var(--ink)}
.lx-rows{display:flex;flex-direction:column;gap:1px;margin-top:14px;
  background:var(--line-3);border-radius:8px;overflow:hidden}
.lx-row3{display:grid;grid-template-columns:30px 1fr auto;gap:9px;align-items:center;
  background:var(--panel);padding:9px 11px;border:0;width:100%;text-align:left;
  cursor:pointer}
.lx-row3 .k{font:500 9.5px var(--mono);color:var(--mute-3);letter-spacing:.06em}
.lx-row3 .t{font:400 13px var(--body);min-width:0;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.lx-row3 .s{font:500 9px var(--mono);letter-spacing:.1em}
.lx-runway-sum{margin-top:11px;font:400 12px var(--body);color:var(--mute-2)}

/* ---------- handled ---------- */
.lx-seam{display:flex;flex-direction:column;gap:1px;background:var(--seam);
  border-radius:10px;overflow:hidden}
.lx-handled{display:flex;align-items:center;justify-content:space-between;gap:10px;
  background:var(--sunk-2);padding:11px 12px}
.lx-handled .t{font:400 13.5px var(--body);color:var(--mute-2);
  text-decoration:line-through;text-decoration-color:#c9c3b5;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.lx-handled .m{font:500 9.5px var(--mono);color:var(--mute-4);margin-top:3px;
  letter-spacing:.06em}
.lx-putback{flex:none;height:34px;padding:0 12px;border:1px solid var(--field);
  border-radius:7px;background:var(--panel);color:var(--mute);font:500 12px var(--body);
  cursor:pointer}
.lx-quiet-note{font:400 12.5px var(--body);color:var(--mute-4);padding:4px 2px}

/* ---------- rules: the test box ---------- */
.lx-btn-out{height:36px;padding:0 12px;flex:none;border:1px solid var(--field-2);
  border-radius:8px;background:var(--card);color:var(--ink);font:500 12.5px var(--body);
  cursor:pointer}
.lx-testbox{background:var(--dark);border-radius:14px;padding:14px 14px 15px;
  margin-bottom:20px}
.lx-test-head{display:flex;align-items:center;justify-content:space-between;
  gap:10px;margin-bottom:10px}
.lx-test-k{font:600 9.5px var(--mono);letter-spacing:.13em;color:var(--amber)}
.lx-test-d{font:500 9.5px var(--mono);letter-spacing:.06em;color:var(--dark-label);
  white-space:nowrap}
.lx-input-dark{width:100%;height:46px;border:1px solid var(--dark-border);
  border-radius:9px;background:var(--dark-2);color:var(--on-ink);
  font:400 16px var(--body);padding:0 13px;outline:none}
.lx-input-dark::placeholder{color:var(--dark-label)}
.lx-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.lx-chip-dark{height:30px;padding:0 9px;border:1px solid var(--dark-border);
  border-radius:6px;background:transparent;color:var(--dark-meta);
  font:500 10.5px var(--mono);cursor:pointer}
.lx-test-out{margin-top:13px;padding-top:12px;border-top:1px solid var(--dark-line)}
.lx-verdict{font:500 9.5px var(--mono);letter-spacing:.11em;color:var(--dark-label);
  margin-bottom:9px}
.lx-test-rows{display:flex;flex-direction:column;gap:1px;border-radius:8px;
  overflow:hidden;background:var(--dark-line)}
.lx-test-row{display:grid;grid-template-columns:1fr auto auto;gap:10px;
  align-items:baseline;background:var(--dark-2);padding:10px 11px}
.lx-test-row .t{font:400 13.5px var(--body);color:var(--dark-value);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.lx-test-row .l{font:500 9.5px var(--mono);color:var(--dark-meta);letter-spacing:.06em}
.lx-test-row .d{font:500 11px var(--mono);color:var(--amber);letter-spacing:.04em}
.lx-test-none{font:400 13px/1.5 var(--body);color:var(--dark-meta);padding:2px 1px}

/* ---------- rules: warnings ---------- */
.lx-warns{border:1px solid var(--warn-line);background:var(--warn-bg);border-radius:11px;
  padding:11px 13px;margin-bottom:18px}
.lx-warns h4{margin:0 0 7px;font:600 9.5px var(--mono);letter-spacing:.12em;color:var(--warn)}
.lx-warnlist{display:flex;flex-direction:column;gap:5px}
.lx-warn{display:grid;grid-template-columns:10px 1fr;gap:8px;align-items:baseline}
.lx-warn i{width:5px;height:5px;border-radius:50%;background:var(--warn-dot);
  display:block;transform:translateY(-2px)}
.lx-warn span{font:400 12.5px/1.45 var(--body);color:var(--warn-text)}
.lx-warn strong{font-weight:600;color:var(--warn-ink)}

/* ---------- rules: the rule card ---------- */
.lx-rule{background:var(--card);border:1px solid var(--line-2);border-radius:13px;
  overflow:hidden}
.lx-rule.dead{border-color:var(--warn-line)}
.lx-rule-btn{width:100%;text-align:left;border:0;background:transparent;
  padding:13px 14px 12px;cursor:pointer;display:block}
.lx-rule-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.lx-rule-name{font:600 16.5px var(--body);color:var(--ink);letter-spacing:-.01em}
.lx-rule-caret{font:500 10px var(--mono);color:var(--mute-4);white-space:nowrap}
.lx-kw{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}
.lx-kw .k{font:500 10.5px var(--mono);color:var(--blue);background:var(--blue-bg);
  border-radius:4px;padding:4px 7px 3px}
.lx-kw .k.none{color:var(--warn);background:var(--warn-chip)}
.lx-ladder-wrap{display:flex;align-items:center;gap:10px;margin-top:11px}
.lx-ladder{position:relative;flex:1;height:16px}
.lx-ladder .base{position:absolute;left:0;right:0;top:7px;height:1px;background:var(--line-2)}
.lx-ladder .end{position:absolute;right:0;top:2px;width:3px;height:11px;background:var(--ink)}
.lx-ladder i{position:absolute;top:4px;width:8px;height:8px;margin-left:-4px;
  border-radius:50%;background:var(--blue);display:block}
.lx-ladder-sum{font:500 10px var(--mono);color:var(--mute-2);letter-spacing:.05em;
  white-space:nowrap}
.lx-rule-open{padding:2px 14px 14px;border-top:1px solid var(--line-3);margin-top:2px}
.lx-fieldlabel{font:500 9.5px var(--mono);letter-spacing:.12em;color:var(--mute-4);
  margin:18px 0 8px}
.lx-fieldlabel:first-child{margin-top:13px}
.lx-kwedit{display:flex;flex-wrap:wrap;gap:6px}
.lx-kwedit .k{font:500 12px var(--mono);color:var(--blue);background:var(--blue-bg);
  border:1px solid var(--blue-line);border-radius:6px;padding:5px 6px 5px 9px;
  display:inline-flex;align-items:center;gap:4px}
.lx-kwedit .k button{border:0;background:transparent;color:var(--blue-mute);
  font:500 12px var(--mono);cursor:pointer;padding:2px 4px;line-height:1}
.lx-add{height:33px;padding:0 10px;border:1px dashed #cfd8e3;border-radius:6px;
  background:transparent;color:#7b8da0;font:500 12px var(--mono);cursor:pointer}
.lx-kwinput{height:33px;width:120px;border:1px solid var(--blue-line);border-radius:6px;
  background:var(--card);color:var(--blue);font:500 12px var(--mono);padding:0 8px;
  outline:none}
.lx-tasks{display:flex;flex-direction:column;gap:9px}
.lx-task{border:1px solid var(--line-4);border-radius:10px;padding:11px 11px 12px;
  background:var(--panel)}
.lx-task-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.lx-task-name{font:500 14.5px var(--body);color:var(--ink);border:0;background:transparent;
  padding:0;outline:none;min-width:0;flex:1}
.lx-task-count{font:500 9.5px var(--mono);letter-spacing:.06em;color:var(--mute-3);
  white-space:nowrap}
.lx-task-count.dead{color:var(--warn)}
.lx-task-x{border:0;background:transparent;color:var(--mute-5);font:400 15px var(--body);
  cursor:pointer;padding:0 2px;line-height:1}
.lx-leadchips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.lx-leadchip{height:34px;min-width:44px;padding:0 10px;border:1px solid #e0dbd0;
  border-radius:7px;background:transparent;color:var(--mute-3);
  font:500 11.5px var(--mono);cursor:pointer}
.lx-leadchip.on{background:var(--ink);border-color:var(--ink);color:var(--on-ink)}
.lx-task-dead{margin-top:9px;font:400 11.5px/1.4 var(--body);color:var(--warn)}
.lx-rule-act{display:flex;gap:8px;margin-top:14px}
.lx-btn-warn{width:96px;flex:none;height:44px;border:1px solid var(--warn-line);
  border-radius:9px;background:transparent;color:var(--warn);font:500 14px var(--body);
  cursor:pointer}
.lx-catchall{margin-top:20px;background:var(--card);border:1px solid var(--line-2);
  border-radius:13px;padding:13px 14px}
.lx-catchall .top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.lx-catchall .t{font:600 14.5px var(--body);color:var(--ink)}
.lx-catchall .d{font:400 12.5px/1.5 var(--body);color:var(--mute-2);margin-top:4px;
  text-wrap:pretty}

/* ---------- toggles ---------- */
.lx-toggle{flex:none;width:46px;height:28px;border-radius:14px;border:0;
  background:var(--field);position:relative;cursor:pointer;transition:background .16s ease}
.lx-toggle i{position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:12px;
  background:var(--card);box-shadow:0 1px 3px rgba(0,0,0,.25);
  transition:left .16s ease;display:block}
.lx-toggle.on{background:var(--ink)}
.lx-toggle.on i{left:20px}
.lx-toggle.lg{width:50px;height:30px;border-radius:15px}
.lx-toggle.lg i{top:3px;left:3px}
.lx-toggle.lg.on i{left:23px}

/* ---------- lists ---------- */
.lx-input{width:100%;height:46px;border:1px solid var(--field);border-radius:11px;
  background:var(--card);color:var(--ink);font:400 15px var(--body);padding:0 14px;
  outline:none}
.lx-input.tall{height:48px}
.lx-input::placeholder{color:var(--mute-4)}
.lx-hit{border:0;background:var(--card);text-align:left;padding:12px 13px;cursor:pointer;
  display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.lx-hit .t{font:500 15px var(--body);color:var(--ink)}
.lx-hit .l{font:500 9.5px var(--mono);letter-spacing:.08em;color:var(--blue);
  white-space:nowrap}
.lx-seam.r11{border-radius:11px}
.lx-seam.r12{border-radius:12px}
.lx-listrow{border:0;background:var(--card);text-align:left;padding:0;cursor:pointer;
  display:grid;grid-template-columns:4px 1fr auto;align-items:stretch;min-height:60px}
.lx-listrow .bar{display:block}
.lx-listrow .mid{display:flex;flex-direction:column;justify-content:center;gap:5px;
  padding:11px 0 11px 13px;min-width:0}
.lx-listrow .name{font:600 15.5px var(--body);color:var(--ink);letter-spacing:-.005em;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lx-listrow .meta{font:500 9.5px var(--mono);letter-spacing:.09em}
.lx-listrow .right{display:flex;align-items:center;gap:10px;padding:0 14px 0 12px}
.lx-listrow .count{font:500 15px var(--mono);color:var(--mute-2)}
.lx-listrow .caret{font:400 14px var(--mono);color:var(--field-3)}
.lx-dash{width:100%;height:48px;border:1px dashed var(--field-3);border-radius:11px;
  background:transparent;color:var(--mute-2);font:500 13px var(--body);cursor:pointer}
.lx-dash.sm{height:46px;font-size:12.5px}
.lx-back{height:44px;margin-left:-10px;padding:0 10px;text-align:left;border:0;
  background:transparent;color:var(--mute);font:500 12.5px var(--body);cursor:pointer}

/* ---------- lists: a swipeable to-do ---------- */
.lx-sw{position:relative;border-radius:0 12px 12px 0;overflow:hidden;touch-action:pan-y}
.lx-sw.flat{border-radius:0}
.lx-sw-under{position:absolute;inset:0;display:flex;align-items:center}
.lx-sw-under.done{background:var(--green)}
.lx-sw-under.del{background:var(--danger);justify-content:flex-end}
.lx-sw-under .lab{font:600 10.5px var(--mono);letter-spacing:.13em;color:#fff;
  padding:0 15px}
.lx-todo{position:relative;background:var(--card);border:1px solid var(--line-2);
  border-left:4px solid var(--line);border-radius:0 12px 12px 0;padding:12px 13px;
  cursor:pointer;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.lx-todo.plain{border:0;border-radius:0;padding:11px 13px}
.lx-todo.picked{background:var(--blue-bg);border-color:var(--blue)}
.lx-todo-grid{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:start}
.lx-todo.plain .lx-todo-grid{align-items:center}
.lx-circle{width:44px;height:44px;margin:-8px -8px -8px -9px;border:0;
  background:transparent;cursor:pointer;display:flex;align-items:center;
  justify-content:center;padding:0}
.lx-circle i{width:28px;height:28px;border:1.5px solid var(--field-3);
  border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;
  font:600 13px var(--body);background:transparent;font-style:normal}
.lx-circle.on i{background:var(--blue);border-color:var(--blue)}
.lx-todo-t{font:500 15.5px/1.25 var(--body);color:var(--ink);text-wrap:pretty}
.lx-todo-t.one{font:400 15px var(--body);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;min-width:0}
.lx-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.lx-tag{font:500 10px var(--mono);letter-spacing:.06em;color:var(--mute);
  border:1px solid var(--line-2);border-radius:4px;padding:4px 6px 3px;white-space:nowrap}
.lx-tag.solid{border-color:transparent}
.lx-todo-caret{font:500 13px var(--mono);color:var(--mute-5);padding-top:5px}
.lx-todo.plain .lx-todo-caret{padding-top:0;color:var(--field-3)}
.lx-donetoggle{width:100%;margin-top:18px;height:44px;border:1px solid var(--line-2);
  border-radius:10px;background:transparent;color:var(--mute-2);
  font:500 11.5px var(--mono);letter-spacing:.08em;cursor:pointer}

/* ---------- lists: bulk bar ---------- */
.lx-bulk{position:absolute;left:0;right:0;bottom:var(--nav-h);background:var(--dark);
  box-shadow:0 -12px 30px rgba(23,22,15,.22);animation:lx-rise .16s ease both;z-index:6}
.lx-bulk-dates{display:flex;flex-wrap:wrap;gap:7px;padding:13px 14px 3px;
  border-bottom:1px solid var(--dark-line)}
.lx-bulk-date{height:38px;padding:0 12px;border:1px solid var(--dark-border);
  border-radius:9px;background:var(--dark-2);color:var(--dark-value);
  font:600 10.5px var(--mono);letter-spacing:.1em;cursor:pointer;margin-bottom:10px}
.lx-bulk-lists{max-height:186px;overflow:auto;border-bottom:1px solid var(--dark-line)}
.lx-bulk-lists button{width:100%;height:46px;padding:0 15px;border:0;
  border-bottom:1px solid var(--dark-2);background:transparent;color:var(--dark-value);
  font:400 14.5px var(--body);cursor:pointer;display:flex;align-items:center;
  justify-content:space-between;gap:10px}
.lx-bulk-lists .n{font:500 10px var(--mono);color:var(--dark-label)}
.lx-bulk-head{display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:11px 14px 8px}
.lx-bulk-n{font:600 10.5px var(--mono);letter-spacing:.13em;color:var(--amber)}
.lx-bulk-hint{font:400 12px var(--body);color:var(--dark-meta);margin-top:3px}
.lx-bulk-mini{height:34px;padding:0 11px;border:1px solid var(--dark-border);
  border-radius:8px;background:transparent;color:var(--dark-meta);
  font:600 10px var(--mono);letter-spacing:.1em;cursor:pointer}
.lx-bulk-acts{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:0 14px 14px}
.lx-bulk-act{height:46px;border:0;border-radius:10px;font:600 10.5px var(--mono);
  letter-spacing:.09em;cursor:pointer;color:#fff}
.lx-bulk-act.go{background:var(--green)}
.lx-bulk-act.kill{background:var(--danger)}
.lx-bulk-act.ghost{border:1px solid var(--dark-border);background:transparent;
  color:var(--dark-value)}
.lx-bulk-act.ghost.on{background:var(--blue);color:var(--on-ink)}

/* ---------- undo ----------
   Reversibility instead of confirmation dialogs. */
.lx-undo{position:absolute;left:12px;right:12px;bottom:calc(var(--nav-h) + 8px);
  background:var(--dark);
  border-radius:12px;padding:12px 12px 0;box-shadow:0 10px 28px rgba(23,22,15,.3);
  animation:lx-rise .18s ease both;z-index:5}
.lx-undo-in{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding-bottom:11px}
.lx-undo .t{font:500 13.5px var(--body);color:var(--on-ink);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.lx-undo .m{font:500 9.5px var(--mono);color:var(--dark-meta);margin-top:3px;
  letter-spacing:.07em}
.lx-undo-btn{flex:none;height:38px;padding:0 15px;border:1px solid var(--amber);
  border-radius:8px;background:transparent;color:var(--amber);font:600 13px var(--body);
  cursor:pointer}
.lx-undo-bar{height:2px;background:var(--dark-line);border-radius:1px;overflow:hidden}
.lx-undo-bar i{display:block;height:2px;background:var(--amber);transform-origin:left;
  animation:lx-undobar 9s linear both}

/* ---------- sheets ---------- */
.lx-sheet{position:absolute;left:0;right:0;top:0;bottom:0;background:var(--paper);
  display:flex;flex-direction:column;animation:lx-rise .18s ease both;z-index:12}
.lx-sheet-head{flex:none;display:flex;align-items:center;justify-content:space-between;
  gap:10px;padding:14px 14px 12px;border-bottom:1px solid var(--line);
  background:var(--panel)}
.lx-sheet-head .title{font:600 11px var(--mono);letter-spacing:.13em;color:var(--mute-2)}
.lx-sheet-head .pad{width:56px;flex:none}
.lx-sheet-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain}
.lx-close{height:38px;padding:0 10px;margin-left:-6px;flex:none;border:0;
  background:transparent;color:var(--mute);font:500 13px var(--body);cursor:pointer;
  text-align:left}
.lx-edit{height:38px;padding:0 14px;flex:none;border:1px solid var(--field);
  border-radius:9px;background:var(--card);color:var(--blue);font:600 11px var(--mono);
  letter-spacing:.1em;cursor:pointer}
.lx-cancel{height:38px;padding:0 14px;flex:none;border:0;background:transparent;
  color:var(--mute-2);font:500 13px var(--body);cursor:pointer}
.lx-savenote{font:500 9.5px var(--mono);letter-spacing:.12em;color:var(--mute-5)}

/* ---------- sheets: reading an event ---------- */
.lx-cat{display:inline-block;font:600 9.5px var(--mono);letter-spacing:.12em;
  border-radius:4px;padding:4px 7px 3px}
.lx-sheet-h{margin:11px 0 16px;font:600 24px/1.15 var(--body);color:var(--ink);
  letter-spacing:-.018em;text-wrap:pretty}
.lx-table{display:flex;flex-direction:column;background:var(--card);
  border:1px solid var(--line-2);border-radius:12px;overflow:hidden}
.lx-table-row{display:grid;grid-template-columns:82px 1fr;gap:10px;padding:12px 13px}
.lx-table-row+.lx-table-row{border-top:1px solid var(--line-3)}
.lx-table-k{font:500 9.5px var(--mono);letter-spacing:.1em;color:var(--mute-4)}
.lx-table-v{font:400 13.5px/1.4 var(--body);color:var(--ink-2);text-wrap:pretty}
.lx-note{font:400 11.5px/1.5 var(--body);color:var(--mute-3);margin-top:10px}

/* ---------- sheets: forms ---------- */
.lx-form{padding:18px 16px 26px;display:flex;flex-direction:column;gap:15px}
.lx-form-h{font:600 20px var(--body);color:var(--ink);letter-spacing:-.012em}
.lx-lab{font:500 9.5px var(--mono);letter-spacing:.12em;color:var(--mute-4);
  margin-bottom:6px}
.lx-in{width:100%;height:46px;border:1px solid var(--field);border-radius:10px;
  background:var(--card);color:var(--ink);font:500 16px var(--body);padding:0 12px;
  outline:none}
.lx-in.mono{font:500 14px var(--mono)}
.lx-in.plain{font:400 14.5px var(--body)}
.lx-in::placeholder{color:var(--mute-4)}
.lx-ta{width:100%;border:1px solid var(--field);border-radius:10px;background:var(--card);
  color:var(--ink-2);font:400 13.5px/1.5 var(--body);padding:11px 12px;outline:none;
  resize:none}
.lx-ta::placeholder{color:var(--mute-4)}
.lx-rowcard{display:flex;align-items:center;justify-content:space-between;gap:12px;
  background:var(--card);border:1px solid var(--line-2);border-radius:10px;
  padding:11px 13px}
.lx-rowcard .t{font:500 14px var(--body);color:var(--ink)}
.lx-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.lx-daynote{font:400 11.5px var(--body);color:var(--mute-3);margin-top:6px}
.lx-formact{display:flex;gap:8px;margin-top:2px}
.lx-save{flex:1;height:48px;border:0;border-radius:11px;background:var(--ink);
  color:var(--on-ink);font:600 12px var(--mono);letter-spacing:.1em;cursor:pointer}
.lx-kill{height:48px;padding:0 16px;flex:none;border:1px solid var(--danger-line);
  border-radius:11px;background:var(--danger-bg);color:var(--danger);
  font:600 12px var(--mono);letter-spacing:.1em;cursor:pointer}
.lx-chip{height:38px;padding:0 12px;border:1px solid var(--field);border-radius:9px;
  background:var(--card);color:var(--mute);font:600 10.5px var(--mono);
  letter-spacing:.08em;cursor:pointer;white-space:nowrap}
.lx-chip.sm{height:36px;padding:0 11px}
.lx-chip.on{background:var(--blue);border-color:var(--blue);color:#fff}
.lx-chip.ink.on{background:var(--ink);border-color:var(--ink);color:var(--on-ink)}
.lx-chip.danger{color:var(--danger);border-color:var(--danger-line)}
.lx-chip.off{background:var(--sunk);color:var(--mute-5);border-color:var(--line-2);
  cursor:default}

/* ---------- sheets: a to-do ---------- */
.lx-td-title{width:calc(100% + 18px);margin:0 -9px;padding:6px 9px;
  border:1px solid transparent;border-radius:9px;background:transparent;color:var(--ink);
  font:600 23px/1.2 var(--body);letter-spacing:-.016em;outline:none;resize:none;
  field-sizing:content;text-wrap:pretty}
.lx-td-title:focus{border-color:var(--field);background:var(--card)}
.lx-td-card{background:var(--card);border:1px solid var(--line-2);border-radius:12px;
  padding:13px 13px 14px}
.lx-td-date{width:calc(100% + 8px);margin:0 -4px;padding:0 4px;height:34px;border:0;
  border-bottom:1px solid var(--line-3);border-radius:0;background:transparent;
  color:var(--ink);font:500 15px var(--mono);outline:none}
.lx-hr{height:1px;background:var(--line-3);margin:14px 0 13px}
.lx-locked{font:400 11.5px/1.4 var(--body);color:var(--mute-3);margin-top:8px}
.lx-steps{display:flex;flex-direction:column;gap:1px;background:var(--seam);
  border:1px solid var(--line-2);border-radius:12px;overflow:hidden}
.lx-step{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;
  background:var(--card);padding:6px 10px}
.lx-step-box{width:44px;height:44px;margin:0 -10px 0 -12px;border:0;background:transparent;
  cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.lx-step-box i{width:22px;height:22px;border:1.5px solid var(--field-3);border-radius:5px;
  background:transparent;color:var(--on-ink);font:600 11px/20px var(--body);display:block;
  text-align:center;font-style:normal}
.lx-step-box.on i{background:var(--ink);border-color:var(--ink)}
.lx-step input{width:100%;height:38px;border:0;background:transparent;color:var(--ink);
  font:400 14px var(--body);padding:0;outline:none}
.lx-step input.draft{padding-left:31px}
.lx-step .when{font:500 9px var(--mono);color:var(--mute-4);letter-spacing:.06em;
  white-space:nowrap}
.lx-step-x{width:44px;height:44px;margin:0 -12px 0 -6px;border:0;background:transparent;
  color:var(--mute-5);font:400 17px var(--body);cursor:pointer;padding:0}
.lx-select-full{width:100%;height:46px;border:1px solid var(--line-2);border-radius:12px;
  background:var(--card);color:var(--ink);font:400 14.5px var(--body);padding:0 10px;
  outline:none}
.lx-sheet-foot{flex:none;display:flex;gap:8px;padding:12px 14px 16px;
  border-top:1px solid var(--line);background:var(--panel)}

/* ---------- settings ---------- */
.lx-set-label{font:600 10px var(--mono);letter-spacing:.14em;color:var(--mute-2);
  margin-bottom:8px}
.lx-set-group{background:var(--card);border:1px solid var(--line-2);border-radius:12px;
  overflow:hidden;margin-bottom:22px}
.lx-set-group>*+*{border-top:1px solid var(--line-3)}
.lx-set-row{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:12px 13px}
.lx-set-row .t{font:500 14.5px var(--body);color:var(--ink)}
.lx-set-row .d{font:400 12px/1.45 var(--body);color:var(--mute-2);margin-top:3px;
  text-wrap:pretty}
.lx-set-block{padding:13px 13px}
.lx-set-block .t{font:500 14.5px var(--body);color:var(--ink);margin-bottom:9px}
.lx-seg{display:grid;gap:2px;padding:2px;background:var(--line-4);border-radius:9px}
.lx-seg button{height:32px;border:0;border-radius:7px;background:transparent;
  color:var(--mute-2);font:600 10px var(--mono);letter-spacing:.07em;cursor:pointer;
  white-space:nowrap;overflow:hidden}
.lx-seg button.on{background:var(--ink);color:var(--on-ink)}
.lx-select{flex:none;width:150px;height:40px;border:1px solid var(--field);
  border-radius:9px;background:var(--panel);color:var(--ink);font:400 13.5px var(--body);
  padding:0 8px;outline:none}
.lx-time{width:100%;height:42px;border:1px solid var(--field);border-radius:9px;
  background:var(--panel);color:var(--ink);font:500 13.5px var(--mono);padding:0 10px;
  outline:none}
.lx-minilabel{font:500 9px var(--mono);letter-spacing:.11em;color:var(--mute-4);
  margin-bottom:5px}
.lx-btn-danger{width:100%;height:46px;border:1px solid var(--danger-line);
  border-radius:11px;background:var(--danger-bg);color:var(--danger);
  font:600 11.5px var(--mono);letter-spacing:.09em;cursor:pointer}
.lx-version{text-align:center;font:500 9.5px var(--mono);letter-spacing:.1em;
  color:var(--mute-5);margin-top:16px}
.lx-file{display:block;width:100%;font:400 12.5px var(--body);color:var(--mute-2)}
.lx-warnline{background:var(--warn-bg);border:1px solid var(--warn-line);
  border-radius:10px;padding:10px 12px;font:400 12.5px/1.45 var(--body);
  color:var(--warn-text);margin-bottom:14px}

/* ---------- calendar ---------- */
.lx-cal-head{padding:0 16px 10px}
.lx-cal-top{display:flex;align-items:flex-end;justify-content:space-between;gap:10px}
.lx-cal-title{font:600 19px/1.1 var(--body);color:var(--ink);letter-spacing:-.014em;
  white-space:nowrap}
.lx-cal-sub{display:flex;align-items:center;gap:7px;margin-top:5px}
.lx-cal-sub .s{font:500 10px var(--mono);color:var(--mute-3);letter-spacing:.11em}
.lx-kwbadge{font:600 9.5px var(--mono);color:var(--mute);background:var(--line-4);
  border-radius:4px;padding:3px 6px 2px;letter-spacing:.08em;white-space:nowrap}
.lx-cal-nav{flex:none;display:flex;align-items:center;gap:4px}
.lx-cal-nav button{width:38px;height:38px;border:1px solid var(--line);border-radius:9px;
  background:var(--card);color:var(--mute);font:400 15px var(--body);cursor:pointer}
.lx-cal-nav button.today{width:auto;padding:0 11px;font:600 10.5px var(--mono);
  letter-spacing:.09em}
.lx-cal-seg{margin-top:12px}
.lx-cal-gridhead{display:flex;padding:0 10px 4px;border-bottom:1px solid var(--line)}
.lx-gutter{width:36px;flex:none;display:flex;align-items:flex-end;justify-content:center;
  padding-bottom:4px;font:600 8.5px var(--mono);color:var(--mute-4);letter-spacing:.04em}
.lx-col{flex:1;text-align:center;min-width:0}
.lx-col .dow{font:600 9px var(--mono);letter-spacing:.09em}
.lx-col .num{font:600 15px var(--body);margin-top:2px}
.lx-allday{display:flex;flex-direction:column;gap:2px;margin-top:4px;padding:0 2px}
.lx-allday button{border:0;border-radius:4px;font:500 8.5px/13px var(--mono);
  padding:2px 3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  cursor:pointer;text-align:left}
.lx-cal-body{display:flex;padding:0 10px}
.lx-hours{width:36px;flex:none;position:relative}
.lx-hour{height:44px;font:500 9px var(--mono);color:var(--mute-4);padding-top:3px}
.lx-colbody{flex:1;position:relative;min-width:0;border-left:1px solid var(--line-3)}
.lx-slot{position:absolute;left:0;right:0;height:44px;border:0;
  border-top:1px solid var(--line-3);background:transparent;cursor:pointer;padding:0;z-index:1}
.lx-ev{position:absolute;border:0;border-left:3px solid var(--ink);
  border-radius:0 5px 5px 0;padding:3px 4px;text-align:left;overflow:hidden;
  cursor:pointer;z-index:2}
.lx-ev .t{font:600 9.5px/1.15 var(--body);color:var(--ink);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.lx-ev .m{font:500 8px var(--mono);color:var(--mute);margin-top:2px}
.lx-nowline{position:absolute;left:0;right:0;height:1.5px;background:var(--amber-ink);
  z-index:3;pointer-events:none}
.lx-cal-foot{padding:12px 16px 0}
.lx-month{padding:0 12px}
.lx-month-dow{display:grid;margin-bottom:4px}
.lx-month-dow div{text-align:center;font:600 9px var(--mono);letter-spacing:.08em;
  color:var(--mute-4)}
.lx-month-body{border-top:1px solid var(--line-3)}
.lx-month-row{display:grid;gap:1px;background:var(--line-4);border:1px solid var(--line-4);
  border-top:0;overflow:hidden}
.lx-weekno{background:var(--paper);display:flex;align-items:center;justify-content:center;
  font:600 8.5px var(--mono);color:var(--mute-4);letter-spacing:.04em}
.lx-day{height:56px;border:0;background:var(--card);cursor:pointer;padding:5px 0 0;
  display:flex;flex-direction:column;align-items:center;gap:3px}
.lx-day .n{width:23px;height:23px;border-radius:50%;display:block;
  font-family:var(--body);font-size:12.5px;line-height:23px}
.lx-day .bars{display:flex;flex-direction:column;gap:2px;width:70%}
.lx-day .bars i{height:3px;border-radius:2px;display:block}
.lx-day .more{font:500 8px var(--mono);color:var(--mute-4)}
.lx-selrow{border:0;background:var(--card);text-align:left;padding:11px 12px;
  cursor:pointer;display:grid;grid-template-columns:3px 1fr;gap:10px;align-items:stretch}
.lx-selrow .rail{border-radius:2px;display:block}
.lx-selrow .t{font:500 15px var(--body);color:var(--ink);display:block}
.lx-selrow .m{font:500 10px var(--mono);color:var(--mute-2);letter-spacing:.06em;
  display:block;margin-top:4px}
.lx-agenda-head{display:flex;align-items:center;gap:9px;margin-bottom:8px}
.lx-agenda-head .day{font:600 10px var(--mono);letter-spacing:.13em;color:var(--mute-2)}
.lx-agenda-head .tag{font:600 9px var(--mono);letter-spacing:.1em}
.lx-agenda-add{width:30px;height:30px;margin:-6px;flex:none;border:0;
  background:transparent;color:var(--mute-4);font:400 16px var(--body);cursor:pointer}
.lx-ag-item{width:100%;border:1px solid var(--line-2);border-left:4px solid var(--ink);
  border-radius:0 12px 12px 0;background:var(--card);text-align:left;padding:11px 13px;
  cursor:pointer;display:flex;flex-direction:column;gap:5px}
.lx-ag-item .head{display:flex;align-items:baseline;justify-content:space-between;
  gap:10px;width:100%}
.lx-ag-item .t{font:500 15.5px/1.25 var(--body);color:var(--ink);min-width:0}
.lx-ag-item .time{font:500 10px var(--mono);color:var(--mute);white-space:nowrap;
  letter-spacing:.05em}
.lx-ag-item .where{display:block;font:400 12.5px/1.35 var(--body);color:var(--mute-2)}
.lx-newq{display:flex;flex-direction:column;gap:9px}
`;

/* ============================================================
   Shared atoms
   ============================================================ */

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/* The strip is the app's nameplate and nothing else. The clock sits with the
   date in the page header, where a date and a time belong together, and the
   battery is the operating system's job — its own status bar is directly above
   this one. */
function StatusBar() {
  return (
    <div className="lx-status">
      <span />
      <span className="mark">LADDER</span>
      <span />
    </div>
  );
}

/* ---------- notifications ----------
   `new Notification()` is not constructible on Android — it throws — so the
   only path that works on the most common install target is the service
   worker's registration. Hand the worker the title and body and let it supply
   its own icon and badge; it owns those paths, not the app.

   The direct constructor stays as the fallback, because the artifact runtime
   this file also has to run in has no worker at all. */
async function notify(title, options) {
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      const worker = navigator.serviceWorker.controller || (reg && reg.active);
      if (worker) {
        worker.postMessage({ type: "NOTIFY", title, options });
        return true;
      }
    }
  } catch (e) {
    /* fall through to the constructor */
  }
  try {
    new Notification(title, options);
    return true;
  } catch (e) {
    return false;
  }
}

/* The second line of a reminder, as the notification says it.
   `at` is the moment the words will be read: for one firing now that is now,
   but for a scheduled one it is its own due time, or a notification handed to
   the OS today would still claim the flight is "in 2 days" when it fires
   tomorrow. */
function notifyBody(n, at) {
  return n.kind === "todo"
    ? `${n.listName}${n.anchor ? ` — needed ${fmtDate(n.anchor)}` : ""}`
    : `${n.eventTitle} — ${relative(n.eventStart, at)}`;
}

/* One key/value line. Every card body is made of these, in the same order,
   so the eye lands in the same place on every card. */
function Row({ k, children }) {
  return (
    <div className="lx-kv-row">
      <span className="lx-kv-k">{k}</span>
      <span className="lx-kv-v">{children}</span>
    </div>
  );
}

function Toggle({ on, onClick, large, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-label={label}
      className={`lx-toggle${large ? " lg" : ""}${on ? " on" : ""}`}
      onClick={onClick}
    >
      <i />
    </button>
  );
}

function Seg({ options, value, onPick, cols }) {
  return (
    <div
      className="lx-seg"
      style={{ gridTemplateColumns: `repeat(${cols || options.length},1fr)` }}
      role="tablist"
    >
      {options.map(([val, label]) => (
        <button
          key={val}
          role="tab"
          aria-selected={value === val}
          className={value === val ? "on" : ""}
          onClick={() => onPick(val)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SectionHead({ label, count, children }) {
  return (
    <div className="lx-sec-head">
      <span className="lx-sec-label">{label}</span>
      <span className="lx-rule-line" />
      {count != null && <span className="lx-sec-count">{count}</span>}
      {children}
    </div>
  );
}

function Empty({ title, detail }) {
  return (
    <div className="lx-empty">
      <div className="t">{title}</div>
      {detail && <div className="d">{detail}</div>}
    </div>
  );
}

/* ---------- tab-bar icons ----------
   Drawn from positioned blocks rather than an icon font: the runtime has no
   asset pipeline, and at 20px these read more clearly than a webfont glyph. */
function TabIcon({ name }) {
  const parts = {
    upcoming: [
      { left: 3, top: 9, width: 15, height: 2 },
      { left: 2, top: 6, width: 8, height: 8, borderRadius: "50%" },
      {
        left: 11,
        top: 7,
        width: 6,
        height: 6,
        borderRadius: "50%",
        border: "2px solid currentColor",
        background: "var(--panel)",
      },
      { left: 5, top: 1, width: 2, height: 4 },
      { left: 5, top: 15, width: 2, height: 4 },
    ],
    lists: [
      { left: 2, top: 3, width: 4, height: 4 },
      { left: 9, top: 4, width: 9, height: 2 },
      { left: 2, top: 9, width: 4, height: 4 },
      { left: 9, top: 10, width: 9, height: 2 },
      { left: 2, top: 15, width: 4, height: 4 },
      { left: 9, top: 16, width: 9, height: 2 },
    ],
    calendar: [
      {
        left: 2,
        top: 3,
        width: 16,
        height: 15,
        border: "2px solid currentColor",
        borderRadius: 3,
        background: "transparent",
      },
      { left: 2, top: 3, width: 16, height: 5, borderRadius: "2px 2px 0 0" },
      { left: 5, top: 11, width: 3, height: 3 },
      { left: 11, top: 11, width: 3, height: 3 },
    ],
    rules: [
      {
        left: 1,
        top: 6,
        width: 7,
        height: 7,
        border: "2px solid currentColor",
        background: "transparent",
        transform: "rotate(45deg)",
      },
      { left: 9, top: 4, width: 2, height: 13 },
      { left: 11, top: 4, width: 7, height: 2 },
      { left: 11, top: 15, width: 7, height: 2 },
    ],
  };
  return (
    <>
      {(parts[name] || []).map((s, i) => (
        <i key={i} style={s} />
      ))}
    </>
  );
}

/* ---------- swipe + long press ----------
   Right clears the row, left deletes it, a long press starts a selection.
   The gesture only claims the pointer once it is unambiguously horizontal, so
   vertical scrolling is never stolen.                                       */
const SWIPE_T = 76;
const SWIPE_CAP = 150;

function useSwipe(haptics) {
  const [st, setSt] = useState({ id: null, dx: 0, anim: false });
  const sw = useRef(null);
  const lp = useRef(null);
  const out = useRef(null);
  const noTap = useRef(0);
  /* A long press ends with a pointerup that must not also read as a tap, however
     long the finger stayed down — otherwise the release immediately undoes the
     selection the press just made. */
  const lpFired = useRef(false);

  useEffect(
    () => () => {
      clearTimeout(lp.current);
      clearTimeout(out.current);
    },
    [],
  );

  const rest = () => setSt({ id: null, dx: 0, anim: false });
  const buzz = (ms) => {
    if (!haptics) return;
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {
      /* no haptics here */
    }
  };

  const bind = (id, o) => ({
    onPointerDown: (e) => {
      if (o.disabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      sw.current = {
        id,
        x: e.clientX,
        y: e.clientY,
        dx: 0,
        live: false,
        target: e.currentTarget,
        pid: e.pointerId,
      };
      clearTimeout(lp.current);
      lpFired.current = false;
      if (o.onLongPress) {
        lp.current = setTimeout(() => {
          sw.current = null;
          lpFired.current = true;
          noTap.current = Date.now();
          buzz(12);
          rest();
          o.onLongPress();
        }, 420);
      }
    },
    onPointerMove: (e) => {
      const s = sw.current;
      if (!s || s.id !== id) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) clearTimeout(lp.current);
      if (!s.live) {
        if (Math.abs(dx) < 7) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          sw.current = null;
          return;
        }
        s.live = true;
        try {
          if (s.target.setPointerCapture) s.target.setPointerCapture(s.pid);
        } catch (err) {
          /* capture unsupported */
        }
      }
      const raw = Math.max(-SWIPE_CAP * 1.6, Math.min(SWIPE_CAP * 1.6, dx));
      s.dx =
        Math.abs(raw) > SWIPE_CAP
          ? Math.sign(raw) * (SWIPE_CAP + (Math.abs(raw) - SWIPE_CAP) * 0.35)
          : raw;
      setSt({ id, dx: s.dx, anim: false });
    },
    onPointerUp: () => {
      clearTimeout(lp.current);
      const s = sw.current;
      sw.current = null;
      if (lpFired.current) {
        lpFired.current = false;
        noTap.current = Date.now();
        return;
      }
      if (!s || s.id !== id || !s.live) return;
      noTap.current = Date.now();
      if (Math.abs(s.dx) >= SWIPE_T) {
        buzz(8);
        setSt({ id, dx: s.dx > 0 ? 460 : -460, anim: true });
        clearTimeout(out.current);
        out.current = setTimeout(() => {
          rest();
          if (s.dx > 0) o.onDone();
          else o.onDelete();
        }, 190);
      } else {
        setSt({ id, dx: 0, anim: true });
      }
    },
    onPointerCancel: () => {
      clearTimeout(lp.current);
      sw.current = null;
      setSt({ id, dx: 0, anim: true });
    },
  });

  /* A gesture that has just ended must not also register as a tap. */
  const tapBlocked = () => Date.now() - noTap.current < 320;
  const dxFor = (id) => (st.id === id ? st.dx : 0);

  return { bind, dxFor, anim: st.anim, tapBlocked, buzz };
}

/* ---------- nudge presentation ----------
   Pure mappings from a nudge to the strings and colours the cards render.  */
function rungOf(n) {
  if (n.kind === "todo") {
    if (n.implicit) return "DAY OF";
    return n.lead == null ? "ONE-OFF" : leadRung(n.lead);
  }
  if (n.alertMinutes != null) return alertChip(n.alertMinutes);
  return leadRung(n.lead);
}
function tminusOf(n) {
  if (n.alertMinutes != null) return alertChip(n.alertMinutes);
  return n.lead == null ? "T−0" : tminus(n.lead);
}
/* Takes the same weekStart as the buckets, so the label and the section it sits
   in can never disagree: a bare weekday is only unambiguous inside this calendar
   week. "DUE WED" under LATER would be a riddle. */
function dueLabelOf(n, now, weekStart) {
  const d = new Date(n.dueAt);
  const t = fmtTime(d);
  if (d <= now) return `DUE ${t}`;
  if (sameDay(d, now)) return `DUE ${t}`;
  if (sameDay(d, addDays(now, 1))) return `DUE TOMORROW ${t}`;
  if (d <= endOfWeek(now, weekStart))
    return `DUE ${d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()} ${t}`;
  return `DUE ${capDate(d)} ${t}`;
}
function whenLine(n, now) {
  const start = new Date(n.eventStart);
  const base = n.allDay
    ? `${fmtDate(start)} · all day`
    : `${fmtDate(start)} · ${fmtTime(start)}${
        n.eventEnd ? `–${fmtTime(n.eventEnd)}` : ""
      }`;
  /* Recurrence belongs in the sentence, not in a badge. The ledger has no badge
     row, and "Sat 15 Aug · all day · yearly · in 10 days" reads correctly. */
  const rep =
    n.event && n.event.recurring ? ` · ${n.event.repeats || "repeats"}` : "";
  return `${base}${rep} · ${relative(start, now)}`;
}
/* The badge cluster flags only what the card is *not* already showing. */
function marksOf(n) {
  const marks = [];
  if (n.kind === "todo") {
    if (n.notes) marks.push("NOTES");
    if (n.implicit) marks.push("AUTO");
    return marks;
  }
  const ev = n.event || {};
  if (ev.recurring) marks.push((ev.repeats || "repeats").toUpperCase());
  if (ev.description) marks.push("NOTES");
  if (n.ruleName === "You added this one") marks.push("AD HOC");
  return marks;
}
function railOf(n, live) {
  if (live) return "var(--amber)";
  if (n.kind === "todo") return n.accent || ACCENTS[0];
  return "#c9c3b5";
}
/* The same three states as the rail, at chip strength. */
function tintOf(n, live) {
  if (live) return "var(--tint-live)";
  if (n.kind === "todo") return "var(--tint-todo)";
  return "var(--tint-event)";
}
function rowsOf(n, now) {
  if (n.kind === "todo") {
    const rows = [["LIST", n.listName]];
    if (n.parentTitle) rows.push(["STEP OF", n.parentTitle]);
    rows.push([
      "NEEDED",
      n.anchor
        ? `${fmtDate(n.anchor)} · ${relative(n.anchor, now)}`
        : "No date — this one is a one-off",
    ]);
    return rows;
  }
  const rows = [
    ["EVENT", n.eventTitle],
    ["WHEN", whenLine(n, now)],
  ];
  if (n.location) rows.push(["WHERE", n.location]);
  return rows;
}
function originOf(n) {
  return n.kind === "todo" ? "SOURCE" : "FROM RULE";
}
function originValue(n) {
  /* The LIST row already names the list, and the band is a one-line header —
     "SOURCE · Set on the item · House related" says it twice and wraps. */
  return n.kind === "todo"
    ? n.parentTitle
      ? "Set on the step"
      : "Set on the item"
    : n.ruleName;
}
/* T−1 DAY · 1 DAY is the same fact twice: for an alert, tminus and the rung are
   the same string by construction. */
function rungLine(n) {
  const t = tminusOf(n);
  const r = rungOf(n);
  return t === r ? r : `${t} · ${r}`;
}
function notesOf(n) {
  if (n.kind === "todo") return n.notes || "—";
  return (n.event && n.event.description) || "—";
}

/* ============================================================
   Home — the queue, sorted by when a reminder is due
   ============================================================ */

function snoozeOptions(now, settings) {
  const durations = {
    "15m": [0.25, "For 15 minutes"],
    "1h": [1, "For 1 hour"],
    "3h": [3, "For 3 hours"],
  };
  const pick = durations[settings.defaultSnooze] || durations["3h"];
  const evening = new Date(now);
  evening.setHours(18, 0, 0, 0);
  const morning = addDays(now, 1);
  morning.setHours(7, 0, 0, 0);
  return [
    { label: pick[1], at: new Date(now.getTime() + pick[0] * 3600000) },
    { label: "This evening", at: evening },
    { label: "Tomorrow morning", at: morning },
  ].filter((o) => o.at > now);
}

function snoozeAtLabel(at, now) {
  if (sameDay(at, now)) return fmtTime(at);
  return `${at.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()} ${fmtTime(at)}`;
}

/* The live row. A filled amber band across the full width, carrying the origin;
   the rail beneath it in the same amber. With no card edge to fill, the band is
   the strongest state change the ledger has. */
function LiveCard({
  n,
  now,
  settings,
  weekStart,
  open,
  snoozing,
  onToggle,
  onSnoozeOpen,
  onDone,
  onSnooze,
}) {
  return (
    <article
      className="lx-led"
      style={{ borderLeftColor: "var(--amber)" }}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="lx-led-head" style={{ background: "var(--amber)" }}>
        <span className="from">{`${originOf(n)} · ${originValue(n)}`}</span>
        <span className="now">NOW</span>
      </div>
      <div className="lx-led-meta">
        <span className="t">{tminusOf(n)}</span>
        <span className="due">{dueLabelOf(n, now, weekStart)}</span>
      </div>
      <h3>{n.label}</h3>
      <div className="lx-led-rows">
        {rowsOf(n, now).map(([k, v]) => (
          <div className="lx-led-row" key={k}>
            <span className="k">{k}</span>
            <span className="v">{v}</span>
          </div>
        ))}
        {/* The band above already names the origin, so expanding only adds the
            notes. The card treatment repeated it because it had nowhere else to
            put it. */}
        {open && (
          <div className="lx-led-row">
            <span className="k">NOTES</span>
            <span className="v">{notesOf(n)}</span>
          </div>
        )}
      </div>
      {snoozing && (
        <div className="lx-led-snooze">
          {snoozeOptions(now, settings).map((o) => (
            <button
              key={o.label}
              onClick={(e) => {
                e.stopPropagation();
                onSnooze(o.at);
              }}
            >
              <span>{o.label}</span>
              <span className="at">{snoozeAtLabel(o.at, now)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="lx-led-act">
        <button
          className="lx-btn-ink"
          onClick={(e) => {
            e.stopPropagation();
            onDone();
          }}
        >
          Done
        </button>
        <button
          className="lx-btn-line"
          onClick={(e) => {
            e.stopPropagation();
            onSnoozeOpen();
          }}
        >
          Snooze
        </button>
      </div>
    </article>
  );
}

/* Everything not in front of you: the same row, quieter, with the origin as a
   tinted chip instead of a band. A live item shown here keeps the amber. */
function QueuedCard({ n, now, weekStart, open, live, onToggle, onDone }) {
  return (
    <div
      className="lx-led q"
      style={{ borderLeftColor: railOf(n, live) }}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="lx-led-tags">
        <span className="left">
          <span className="origin" style={{ background: tintOf(n, live) }}>
            {originOf(n)}
          </span>
          <span className="rung">{rungLine(n)}</span>
        </span>
        <span
          className="due"
          style={live ? { color: "var(--amber-ink)" } : undefined}
        >
          {live ? "DUE NOW" : dueLabelOf(n, now, weekStart)}
        </span>
      </div>
      <h3>{n.label}</h3>
      <div className="lx-led-rows">
        {rowsOf(n, now).map(([k, v]) => (
          <div className="lx-led-row" key={k}>
            <span className="k">{k}</span>
            <span className="v">{v}</span>
          </div>
        ))}
        {open && (
          <>
            <div className="lx-led-row">
              <span className="k">{originOf(n)}</span>
              <span className="v">{originValue(n)}</span>
            </div>
            <div className="lx-led-row">
              <span className="k">NOTES</span>
              <span className="v">{notesOf(n)}</span>
            </div>
          </>
        )}
      </div>
      <button
        className="lx-btn-led"
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
      >
        Done
      </button>
    </div>
  );
}

function Runway({ runway, now, onOpenEvent }) {
  const ev = runway.event;
  const start = new Date(ev.start);
  const stateColour = (s) =>
    s === "HANDLED"
      ? "var(--mute-4)"
      : s === "DUE NOW"
        ? "var(--amber-ink)"
        : "var(--ink-2)";
  return (
    <div className="lx-block">
      <div className="lx-block-head">
        <span className="lx-sec-label">RUNWAY</span>
        <span className="lx-block-note">next event</span>
      </div>
      <div className="lx-panel">
        <button
          className="lx-runway-t"
          onClick={onOpenEvent}
          style={{
            border: 0,
            background: "transparent",
            padding: 0,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          {ev.title}
        </button>
        <div className="lx-runway-m">
          {`${fmtDate(start).toUpperCase()}${ev.allDay ? " · ALL DAY" : ` · ${fmtTime(start)}`} · ${relative(
            start,
            now,
          ).toUpperCase()}`}
        </div>

        <div className="lx-track" aria-hidden="true">
          <div className="lx-track-base" />
          <div
            className="lx-track-fill"
            style={{ width: `${runway.nowPct}%` }}
          />
          <div className="lx-track-now" style={{ left: `${runway.nowPct}%` }} />
          {runway.steps.map((s, i) => (
            <div
              key={i}
              className={`lx-dot${s.state === "DUE NOW" ? " now" : s.state === "AHEAD" ? " ahead" : ""}`}
              style={{ left: `${s.left}%` }}
            />
          ))}
          <div className="lx-track-end" />
          {runway.steps.map((s, i) => (
            <div
              key={i}
              className={`lx-track-lab${s.state === "DUE NOW" ? " hot" : ""}`}
              style={{ left: `${s.left}%` }}
            >
              {s.lead}
            </div>
          ))}
          <div className="lx-track-lab tail">EVENT</div>
        </div>

        <div className="lx-rows">
          {runway.steps.map((s, i) => (
            <div key={i} className="lx-row3" style={{ cursor: "default" }}>
              <span className="k">{s.lead}</span>
              <span className="t" style={{ color: stateColour(s.state) }}>
                {s.nudge.label}
              </span>
              <span className="s" style={{ color: stateColour(s.state) }}>
                {s.state}
              </span>
            </div>
          ))}
        </div>
        <div className="lx-runway-sum">
          {runway.ahead === 0
            ? "Everything on this event is handled."
            : `${runway.ahead} of ${runway.steps.length} still ahead of you · ${
                runway.daysLeft === 0
                  ? "it happens today"
                  : `${runway.daysLeft} day${runway.daysLeft === 1 ? "" : "s"} of runway left`
              }.`}
        </div>
      </div>
    </div>
  );
}

function Home({
  live,
  queued,
  handled,
  runway,
  counts,
  now,
  settings,
  onDone,
  onRestore,
  onSnooze,
  onOpenSettings,
  onOpenEvent,
  newCount,
  onOpenNew,
}) {
  const [open, setOpen] = useState(null);
  const [snoozeFor, setSnoozeFor] = useState(null);

  const buckets = BUCKETS.map(([key, label]) => ({
    key,
    label,
    items: queued.filter((n) => n.bucket === key),
  })).filter((b) => b.items.length);

  const nextUp = buckets.length ? buckets[0] : null;

  return (
    <div className="lx-page">
      <div className="lx-head">
        <div>
          <div className="lx-h1">
            {now.toLocaleDateString(undefined, { weekday: "long" })}
          </div>
          {/* Date and time on one mono line, comma stripped like every other
              small-caps label in the app. */}
          <div className="lx-h1-sub">
            {`${now
              .toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
              .replace(/,/g, "")
              .toUpperCase()} · ${fmtTime(now)}`}
          </div>
        </div>
        <button
          className="lx-dots"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
        >
          ⋯
        </button>
      </div>

      <div className="lx-counters">
        <div className="lx-counter live">
          <div className="k">NOW</div>
          <div className="v">{counts.now}</div>
        </div>
        <div className="lx-counter">
          <div className="k">TODAY</div>
          <div className="v">{counts.today}</div>
        </div>
        <div className="lx-counter">
          <div className="k">WEEK</div>
          <div className="v">{counts.week}</div>
        </div>
      </div>

      {newCount > 0 && (
        <button
          className="lx-dash sm"
          style={{ marginBottom: 22 }}
          onClick={onOpenNew}
        >
          {`${newCount} new event${newCount === 1 ? "" : "s"} in your calendar — review`}
        </button>
      )}

      {/* One expanded block at a time: the first live reminder gets the amber
          band and the full body. Anything else already due sits directly under
          it as an amber-railed row — nothing hidden, nothing collapsed. */}
      {live[0] && (
        <LiveCard
          n={live[0]}
          now={now}
          settings={settings}
          weekStart={settings.weekStart}
          open={open === live[0].id}
          snoozing={snoozeFor === live[0].id}
          onToggle={() => {
            setOpen(open === live[0].id ? null : live[0].id);
            setSnoozeFor(null);
          }}
          onSnoozeOpen={() => {
            setSnoozeFor(snoozeFor === live[0].id ? null : live[0].id);
            setOpen(null);
          }}
          onDone={() => {
            setSnoozeFor(null);
            setOpen(null);
            onDone(live[0]);
          }}
          onSnooze={(at) => {
            setSnoozeFor(null);
            onSnooze(live[0], at);
          }}
        />
      )}

      {live.length > 1 && (
        <div className="lx-sec led">
          <SectionHead label="ALSO DUE NOW" count={String(live.length - 1)} />
          <div className="lx-led-list">
            {live.slice(1).map((n) => (
              <QueuedCard
                key={n.id}
                n={n}
                now={now}
                weekStart={settings.weekStart}
                live
                open={open === n.id}
                onToggle={() => setOpen(open === n.id ? null : n.id)}
                onDone={() => {
                  setOpen(null);
                  onDone(n);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {live.length === 0 && (
        <Empty
          title="Nothing due now"
          detail={
            nextUp
              ? `Next is ${nextUp.items[0].label.toLowerCase()} — ${nextUp.label.toLowerCase()}.`
              : "Nothing this week."
          }
        />
      )}

      {buckets.map((b) => (
        <div className="lx-sec led" key={b.key}>
          <SectionHead label={b.label} count={String(b.items.length)} />
          <div className="lx-led-list">
            {b.items.map((n) => (
              <QueuedCard
                key={n.id}
                n={n}
                now={now}
                weekStart={settings.weekStart}
                open={open === n.id}
                onToggle={() => setOpen(open === n.id ? null : n.id)}
                onDone={() => {
                  setOpen(null);
                  onDone(n);
                }}
              />
            ))}
          </div>
        </div>
      ))}

      {runway && (
        <Runway
          runway={runway}
          now={now}
          onOpenEvent={() => onOpenEvent(runway.event.id)}
        />
      )}

      <div className="lx-block" style={{ marginTop: 24 }}>
        <div className="lx-block-head">
          <span className="lx-sec-label">HANDLED</span>
          <span className="lx-sec-count">{handled.length}</span>
        </div>
        {handled.length === 0 ? (
          <div className="lx-quiet-note">Nothing completed yet today.</div>
        ) : (
          <div className="lx-seam">
            {handled.map((n) => (
              <div className="lx-handled" key={n.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="t">{n.label}</div>
                  <div className="m">
                    {`${(n.kind === "todo" ? n.listName : n.eventTitle).toUpperCase()} · ${rungOf(n)}`}
                  </div>
                </div>
                <button className="lx-putback" onClick={() => onRestore(n)}>
                  Put back
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Rules — keywords in, a ladder of reminders out
   ============================================================ */

const ALL_LEADS = [14, 10, 7, 5, 2, 1, 0];
const PROBE_SAMPLES = [
  "Mara's birthday",
  "Flight LH1042 to Lisbon",
  "Dentist 14:30",
];

/* The test box runs the real engine on a synthetic event rather than describing
   what the engine would do. Invariant 10: buildNudges must stay free of to-do
   logic, which is what lets this single-event dataset tell the truth. */
function probe(text, data, now) {
  const at = addDays(now, 10);
  at.setHours(9, 0, 0, 0);
  const event = {
    id: "probe",
    title: text,
    start: at.toISOString(),
    end: null,
    allDay: true,
    location: "",
    description: "",
    recurring: false,
    repeats: "",
    organizer: null,
    tasks: [],
    alerts: [],
    cat: "personal",
    source: "manual",
  };
  const nudges = buildNudges({
    events: [event],
    rules: data.rules,
    state: { done: {}, snoozed: {}, seen: {}, muted: {}, notified: [] },
    settings: data.settings,
  });
  return {
    at,
    matched: matchRules(event, data.rules),
    nudges: nudges
      .slice()
      .sort((a, b) => new Date(a.baseDueAt) - new Date(b.baseDueAt)),
  };
}

function TestBox({ data, now, text, onText }) {
  const { at, matched, nudges } = useMemo(
    () => probe(text, data, now),
    [text, data, now],
  );
  const trimmed = text.trim();
  let verdict = "NOTHING TYPED";
  if (trimmed) {
    if (matched.length)
      verdict = `MATCHES “${matched.map((r) => r.name.toUpperCase()).join(", ")}” → ${
        nudges.length
      } REMINDER${nudges.length === 1 ? "" : "S"}`;
    else if (data.settings.fallback) verdict = "NO RULE MATCHES → CATCH-ALL";
    else verdict = "NO RULE MATCHES";
  }
  return (
    <div className="lx-testbox">
      <div className="lx-test-head">
        <span className="lx-test-k">TEST AN EVENT TITLE</span>
        <span className="lx-test-d">AGAINST {capDate(at)}</span>
      </div>
      <input
        className="lx-input-dark"
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder="Type an event title"
        aria-label="Event title to test"
      />
      <div className="lx-chips">
        {PROBE_SAMPLES.map((s) => (
          <button key={s} className="lx-chip-dark" onClick={() => onText(s)}>
            {s}
          </button>
        ))}
      </div>
      <div className="lx-test-out">
        <div className="lx-verdict">{verdict}</div>
        {trimmed && nudges.length > 0 && (
          <div className="lx-test-rows">
            {nudges.map((n) => (
              <div className="lx-test-row" key={n.id}>
                <span className="t">{n.label}</span>
                <span className="l">
                  {n.alertMinutes != null
                    ? alertChip(n.alertMinutes)
                    : leadChip(n.lead)}
                </span>
                <span className="d">{fmtDate(n.baseDueAt)}</span>
              </div>
            ))}
          </div>
        )}
        {trimmed && nudges.length === 0 && (
          <div className="lx-test-none">
            This title produces nothing.{" "}
            {data.settings.fallback
              ? "Even the catch-all stayed quiet."
              : "The catch-all is off, so nothing would fire."}
          </div>
        )}
      </div>
    </div>
  );
}

function KeywordEditor({ rule, onPatch }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const commit = () => {
    const v = draft.trim().toLowerCase();
    if (v && !rule.keywords.includes(v))
      onPatch({ keywords: [...rule.keywords, v] });
    setDraft("");
    setAdding(false);
  };
  return (
    <div className="lx-kwedit">
      {rule.keywords.map((k) => (
        <span className="k" key={k}>
          {k}
          <button
            onClick={() =>
              onPatch({ keywords: rule.keywords.filter((x) => x !== k) })
            }
            aria-label={`Remove ${k}`}
          >
            ×
          </button>
        </span>
      ))}
      {adding ? (
        <input
          className="lx-kwinput"
          autoFocus
          value={draft}
          placeholder="keyword"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
        />
      ) : (
        <button className="lx-add" onClick={() => setAdding(true)}>
          + add
        </button>
      )}
    </div>
  );
}

function TaskEditor({ task, onPatch, onRemove }) {
  const leads = task.leads || [];
  const days = leads.map((l) => l.days);
  const hour = leads.length ? (leads[0].hour ?? 9) : 9;
  /* Presets, plus any lead the user already has that is not one of them. */
  const shown = [...new Set([...ALL_LEADS, ...days])].sort((a, b) => b - a);
  const toggle = (d) =>
    onPatch({
      leads: days.includes(d)
        ? leads.filter((l) => l.days !== d)
        : [...leads, { days: d, hour }].sort((a, b) => b.days - a.days),
    });
  const dead = leads.length === 0;
  return (
    <div className="lx-task">
      <div className="lx-task-top">
        <input
          className="lx-task-name"
          value={task.label}
          onChange={(e) => onPatch({ label: e.target.value })}
          aria-label="Task name"
        />
        <span className={`lx-task-count${dead ? " dead" : ""}`}>
          {dead ? "NEVER FIRES" : `${leads.length} REM`}
        </span>
        <button
          className="lx-task-x"
          onClick={onRemove}
          aria-label={`Remove ${task.label}`}
        >
          ×
        </button>
      </div>
      <div className="lx-leadchips">
        {shown.map((d) => (
          <button
            key={d}
            className={`lx-leadchip${days.includes(d) ? " on" : ""}`}
            onClick={() => toggle(d)}
            aria-pressed={days.includes(d)}
          >
            {leadChip(d)}
          </button>
        ))}
      </div>
      {dead && (
        <div className="lx-task-dead">
          No lead times — this task never produces a reminder.
        </div>
      )}
    </div>
  );
}

function RuleCard({ rule, matches, open, onToggle, onPatch, onDelete }) {
  const leads = (rule.tasks || []).flatMap((t) =>
    (t.leads || []).map((l) => l.days),
  );
  const max = Math.max(14, ...(leads.length ? leads : [14]));
  const noKeywords = rule.keywords.length === 0;
  const dead =
    noKeywords || leads.length === 0 || matches === 0 || !rule.enabled;
  return (
    <article className={`lx-rule${dead ? " dead" : ""}`}>
      <button className="lx-rule-btn" onClick={onToggle} aria-expanded={open}>
        <div className="lx-rule-top">
          <span className="lx-rule-name">{rule.name}</span>
          <span className="lx-rule-caret">{open ? "CLOSE" : "EDIT"}</span>
        </div>
        <div className="lx-kw">
          {rule.keywords.map((k) => (
            <span className="k" key={k}>
              {k}
            </span>
          ))}
          {noKeywords && <span className="k none">no keywords</span>}
          {!rule.enabled && <span className="k none">muted</span>}
        </div>
        <div className="lx-ladder-wrap">
          <div className="lx-ladder">
            <div className="base" />
            <div className="end" />
            {leads.map((d, i) => (
              <i
                key={i}
                style={{ left: `${(100 - (d / max) * 100).toFixed(1)}%` }}
              />
            ))}
          </div>
          <span className="lx-ladder-sum">
            {`${leads.length} REM · ${matches} EVENT${matches === 1 ? "" : "S"}`}
          </span>
        </div>
      </button>

      {open && (
        <div className="lx-rule-open">
          <div className="lx-fieldlabel">NAME</div>
          <input
            className="lx-in plain"
            value={rule.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            aria-label="Rule name"
          />

          <div className="lx-fieldlabel">KEYWORDS</div>
          <KeywordEditor rule={rule} onPatch={onPatch} />

          <div className="lx-fieldlabel">TASKS AND LEAD TIMES</div>
          <div className="lx-tasks">
            {(rule.tasks || []).map((t, i) => (
              <TaskEditor
                key={t.id}
                task={t}
                onPatch={(patch) =>
                  onPatch({
                    tasks: rule.tasks.map((x, j) =>
                      j === i ? { ...x, ...patch } : x,
                    ),
                  })
                }
                onRemove={() =>
                  onPatch({ tasks: rule.tasks.filter((_, j) => j !== i) })
                }
              />
            ))}
            <button
              className="lx-dash sm"
              onClick={() =>
                onPatch({
                  tasks: [
                    ...(rule.tasks || []),
                    {
                      id: uid(),
                      label: "New task",
                      leads: [{ days: 1, hour: 9 }],
                    },
                  ],
                })
              }
            >
              + add a task
            </button>
          </div>

          <div className="lx-rowcard" style={{ marginTop: 14 }}>
            <span className="t">Rule is on</span>
            <Toggle
              on={rule.enabled}
              label="Rule is on"
              onClick={() => onPatch({ enabled: !rule.enabled })}
            />
          </div>

          <div className="lx-rule-act">
            <button className="lx-btn-quiet" onClick={onToggle}>
              Close
            </button>
            <button className="lx-btn-warn" onClick={onDelete}>
              Delete
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

/* How many of the user's actual events each rule catches. Grounding the summary
   in real data is what makes a dead rule visible instead of merely plausible. */
function ruleMatchCounts(data) {
  const out = {};
  data.rules.forEach((r) => {
    out[r.id] = data.events.filter((e) => matchRules(e, [r]).length > 0).length;
  });
  return out;
}

/* The things that silently do nothing. Shared by the Rules screen and the tab
   badge so the two can never disagree about how many there are. */
function ruleWarnings(data, counts) {
  const matchCounts = counts || ruleMatchCounts(data);
  const out = [];
  data.rules.forEach((r) => {
    if (!r.enabled) {
      out.push({
        rule: r.name,
        text: "is muted — it produces nothing while it is off.",
      });
      return;
    }
    if (r.keywords.length === 0)
      out.push({
        rule: r.name,
        text: "has no keywords — it can never match an event.",
      });
    (r.tasks || []).forEach((t) => {
      if (!t.leads || t.leads.length === 0)
        out.push({
          rule: `${r.name} · ${t.label}`,
          text: "has no lead times — it produces nothing.",
        });
    });
    if (matchCounts[r.id] === 0 && r.keywords.length > 0)
      out.push({
        rule: r.name,
        text: `matches none of your ${data.events.length} events. Check the spelling of its keywords.`,
      });
  });
  return out;
}

function Rules({ data, now, onPatchRules, onDeleteRule, onPatchSettings }) {
  const [openRule, setOpenRule] = useState(null);
  const [test, setTest] = useState(PROBE_SAMPLES[0]);

  const matchCounts = useMemo(
    () => ruleMatchCounts(data),
    [data.rules, data.events],
  );
  const warnings = useMemo(
    () => ruleWarnings(data, matchCounts),
    [data, matchCounts],
  );

  const patchRule = (id, patch) =>
    onPatchRules(data.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const newRule = () => {
    const rule = {
      id: uid(),
      name: "New rule",
      keywords: [],
      enabled: true,
      tasks: [
        { id: uid(), label: "Do the thing", leads: [{ days: 1, hour: 9 }] },
      ],
    };
    onPatchRules([...data.rules, rule]);
    setOpenRule(rule.id);
  };

  return (
    <div className="lx-page">
      <div className="lx-head">
        <div>
          <div className="lx-h1">Rules</div>
          <div className="lx-h1-sub">
            {`${data.rules.length} RULES · ${warnings.length} NEED ATTENTION`}
          </div>
        </div>
        <button className="lx-btn-out" onClick={newRule}>
          New rule
        </button>
      </div>

      <TestBox data={data} now={now} text={test} onText={setTest} />

      {warnings.length > 0 && (
        <div className="lx-warns">
          <h4>
            {warnings.length === 1
              ? "1 RULE DOES NOTHING"
              : `${warnings.length} THINGS SILENTLY DO NOTHING`}
          </h4>
          <div className="lx-warnlist">
            {warnings.map((w, i) => (
              <div className="lx-warn" key={i}>
                <i />
                <span>
                  <strong>{w.rule}</strong> {w.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.rules.map((r) => (
          <RuleCard
            key={r.id}
            rule={r}
            matches={matchCounts[r.id] || 0}
            open={openRule === r.id}
            onToggle={() => setOpenRule(openRule === r.id ? null : r.id)}
            onPatch={(patch) => patchRule(r.id, patch)}
            onDelete={() => {
              setOpenRule(null);
              onDeleteRule(r);
            }}
          />
        ))}
      </div>

      <div className="lx-catchall">
        <div className="top">
          <div style={{ minWidth: 0 }}>
            <div className="t">Catch-all reminder</div>
            <div className="d">
              {`For events no rule recognises. One reminder, ${leadLabel(
                data.settings.defaultLead ?? 1,
              )} at ${clockOfMins(data.settings.fallbackHour * 60)}.`}
            </div>
          </div>
          <Toggle
            large
            on={data.settings.fallback}
            label="Catch-all reminder"
            onClick={() =>
              onPatchSettings({ fallback: !data.settings.fallback })
            }
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Lists — to-dos, with or without a date
   A to-do with no date never nudges. That is the deal, and the
   list says so out loud rather than letting you discover it.
   ============================================================ */

const TODO_LEADS = [0, 1, 2, 3, 7, 14];

const dateInputValue = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const isoFromInput = (v, hour = 9) => {
  if (!v) return null;
  const d = new Date(
    Number(v.slice(0, 4)),
    Number(v.slice(5, 7)) - 1,
    Number(v.slice(8, 10)),
    hour,
    0,
    0,
    0,
  );
  return isNaN(d) ? null : d.toISOString();
};

function stepCount(item) {
  const subs = item.subtasks || [];
  return { total: subs.length, done: subs.filter((s) => s.done).length };
}
function itemTags(item, now) {
  const overdue = item.due && new Date(item.due) < startOfDay(now);
  const sc = stepCount(item);
  const tags = [];
  tags.push({
    key: "date",
    solid: true,
    label: item.due
      ? overdue
        ? `OVERDUE · ${capDate(item.due)}`
        : capDate(item.due)
      : "NO DATE",
    fg: overdue ? "#8c2f10" : item.due ? "var(--ink-2)" : "var(--mute-3)",
    bg: overdue ? "#fbe8e0" : item.due ? "#f0ede5" : "transparent",
  });
  if ((item.reminders || []).length)
    tags.push({ key: "rem", label: `${item.reminders.length} REM` });
  if (sc.total)
    tags.push({ key: "steps", label: `${sc.done}/${sc.total} STEPS` });
  if (item.notes) tags.push({ key: "notes", label: "NOTES", mute: true });
  return tags;
}
function listMeta(list, now) {
  const open = (list.items || []).filter((i) => !i.done);
  const dated = open.filter((i) => i.due);
  const overdue = dated.filter((i) => new Date(i.due) < startOfDay(now));
  const next = dated
    .slice()
    .sort((a, b) => new Date(a.due) - new Date(b.due))[0];
  return {
    open,
    dated,
    overdue,
    count: open.length,
    meta: overdue.length
      ? `${overdue.length} OVERDUE`
      : next
        ? `NEXT ${capDate(next.due)}`
        : open.length
          ? "NO DATES"
          : "EMPTY",
    metaFg: overdue.length ? "var(--amber-ink)" : "var(--mute-3)",
    barFg: overdue.length
      ? "var(--amber-ink)"
      : dated.length
        ? list.accent || ACCENTS[0]
        : "var(--field-2)",
  };
}

/* ---------- one row ---------- */
function TodoRow({
  item,
  now,
  plain,
  rail,
  swipe,
  selMode,
  picked,
  onOpen,
  onCircle,
  onDone,
  onDelete,
  onLongPress,
}) {
  const dx = swipe.dxFor(item.id);
  const tags = itemTags(item, now);
  const bind = swipe.bind(item.id, {
    disabled: selMode,
    onDone,
    onDelete,
    onLongPress,
  });
  return (
    <div className={`lx-sw${plain ? " flat" : ""}`}>
      <div className="lx-sw-under done" style={{ opacity: dx > 0 ? 1 : 0 }}>
        <span className="lab">{dx >= SWIPE_T ? "RELEASE · DONE" : "DONE"}</span>
      </div>
      <div className="lx-sw-under del" style={{ opacity: dx < 0 ? 1 : 0 }}>
        <span className="lab">
          {-dx >= SWIPE_T ? "RELEASE · DELETE" : "DELETE"}
        </span>
      </div>
      <div
        className={`lx-todo${plain ? " plain" : ""}${picked ? " picked" : ""}`}
        style={{
          borderLeftColor: plain ? undefined : rail,
          transform: `translateX(${dx}px)`,
          transition: swipe.anim
            ? "transform .24s cubic-bezier(.2,.8,.2,1)"
            : "none",
        }}
        onClick={() => {
          if (swipe.tapBlocked()) return;
          onOpen();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onOpen();
          }
        }}
        {...bind}
      >
        <div className="lx-todo-grid">
          <button
            className={`lx-circle${picked ? " on" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              /* The circle sits inside the swipe target, so a gesture that began
                 on it must not also fire its click on release. */
              if (swipe.tapBlocked()) return;
              onCircle();
            }}
            aria-label={
              picked ? `Deselect ${item.title}` : `Mark ${item.title} done`
            }
          >
            <i>{picked ? "✓" : ""}</i>
          </button>
          {plain ? (
            <span className="lx-todo-t one">{item.title}</span>
          ) : (
            <div style={{ minWidth: 0 }}>
              <div className="lx-todo-t">{item.title}</div>
              <div className="lx-tags">
                {tags.map((t) => (
                  <span
                    key={t.key}
                    className={`lx-tag${t.solid ? " solid" : ""}`}
                    style={
                      t.solid
                        ? { color: t.fg, background: t.bg }
                        : t.mute
                          ? { color: "var(--mute-3)" }
                          : undefined
                    }
                  >
                    {t.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          <span className="lx-todo-caret">›</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- overview ---------- */
function ListsOverview({ data, now, onPick, onPickItem, onNewList }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const hits = [];
  if (q)
    data.lists.forEach((l) =>
      (l.items || [])
        .filter((i) => !i.done && i.title.toLowerCase().includes(q))
        .forEach((i) => hits.push({ item: i, list: l })),
    );

  return (
    <div className="lx-page">
      <div className="lx-head">
        <div>
          <div className="lx-h1">Lists</div>
          <div className="lx-h1-sub">
            {`${data.lists.length} LIST${data.lists.length === 1 ? "" : "S"}`}
          </div>
        </div>
      </div>

      <input
        className="lx-input"
        style={{ marginBottom: 16 }}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search every list"
        aria-label="Search every list"
      />

      {q ? (
        <>
          {hits.length > 0 && (
            <div className="lx-seam r11">
              {hits.map(({ item, list }) => (
                <button
                  className="lx-hit"
                  key={item.id}
                  onClick={() => {
                    setQuery("");
                    onPickItem(list.id, item.id);
                  }}
                >
                  <span className="t">{item.title}</span>
                  <span className="l">{list.name.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
          {hits.length === 0 && (
            <div className="lx-quiet-note" style={{ padding: "6px 2px" }}>
              Nothing matches.
            </div>
          )}
        </>
      ) : (
        <>
          <div className="lx-seam r12">
            {data.lists.map((l) => {
              const m = listMeta(l, now);
              return (
                <button
                  className="lx-listrow"
                  key={l.id}
                  onClick={() => onPick(l.id)}
                >
                  <span className="bar" style={{ background: m.barFg }} />
                  <span className="mid">
                    <span className="name">{l.name}</span>
                    <span className="meta" style={{ color: m.metaFg }}>
                      {m.meta}
                    </span>
                  </span>
                  <span className="right">
                    <span className="count">{m.count}</span>
                    <span className="caret">›</span>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            className="lx-dash"
            style={{ marginTop: 10 }}
            onClick={onNewList}
          >
            + New list
          </button>
        </>
      )}
    </div>
  );
}

/* ---------- one list ---------- */
function ListDetail({
  data,
  list,
  now,
  ops,
  swipe,
  sel,
  setSel,
  onOpenTodo,
  onBack,
}) {
  const [draft, setDraft] = useState("");
  const [showDone, setShowDone] = useState(false);
  const items = list.items || [];
  const open = items.filter((i) => !i.done);
  const doneItems = items.filter((i) => i.done);
  const dated = open
    .filter((i) => i.due)
    .sort((a, b) => new Date(a.due) - new Date(b.due));
  const undated = open.filter((i) => !i.due);
  const selMode = sel.length > 0;
  const rail = (item) =>
    item.due && new Date(item.due) < startOfDay(now)
      ? "var(--amber-ink)"
      : item.due
        ? list.accent || ACCENTS[0]
        : "var(--line)";

  const rowProps = (item, plain) => ({
    item,
    now,
    plain,
    rail: rail(item),
    swipe,
    selMode,
    picked: sel.includes(item.id),
    onOpen: () => {
      if (selMode) {
        setSel(
          sel.includes(item.id)
            ? sel.filter((x) => x !== item.id)
            : [...sel, item.id],
        );
        return;
      }
      onOpenTodo(item.id);
    },
    onCircle: () => {
      if (selMode) {
        setSel(
          sel.includes(item.id)
            ? sel.filter((x) => x !== item.id)
            : [...sel, item.id],
        );
        return;
      }
      ops.setDone(list.id, item, true);
    },
    onDone: () => ops.setDone(list.id, item, true),
    onDelete: () => ops.deleteItem(list.id, item),
    onLongPress: () => setSel([item.id]),
  });

  const datedBlock = dated.length > 0 && (
    <>
      <SectionHead label="WITH A DATE" />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginBottom: 20,
        }}
      >
        {dated.map((item) => (
          <TodoRow key={item.id} {...rowProps(item, false)} />
        ))}
      </div>
    </>
  );

  const undatedBlock = undated.length > 0 && (
    <>
      <div className="lx-sec-head">
        <span className="lx-sec-label">NO DATE</span>
        <span className="lx-rule-line" />
        <span className="lx-sec-count" style={{ fontWeight: 400 }}>
          NEVER NUDGES
        </span>
      </div>
      <div className="lx-seam r12" style={{ marginBottom: 20 }}>
        {undated.map((item) => (
          <TodoRow key={item.id} {...rowProps(item, true)} />
        ))}
      </div>
    </>
  );

  return (
    <div className="lx-page">
      <div style={{ padding: "6px 0 12px" }}>
        <button className="lx-back" onClick={onBack}>
          ‹ All lists
        </button>
        <div className="lx-h1" style={{ marginTop: 4, lineHeight: 1.15 }}>
          {list.name}
        </div>
        <div
          className="lx-h1-sub"
          style={{ marginTop: 5, letterSpacing: ".09em", fontSize: 10 }}
        >
          {`${open.length} OPEN · ${dated.length} DATED · ${doneItems.length} DONE`}
        </div>
      </div>

      <input
        className="lx-input tall"
        style={{ marginBottom: 18 }}
        value={draft}
        placeholder={`Add to ${list.name}`}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) {
            ops.addItem(list.id, draft.trim());
            setDraft("");
          }
        }}
        aria-label={`Add to ${list.name}`}
      />

      {data.settings.undatedAt === "top" ? (
        <>
          {undatedBlock}
          {datedBlock}
        </>
      ) : (
        <>
          {datedBlock}
          {undatedBlock}
        </>
      )}

      {open.length === 0 && (
        <Empty
          title="Nothing in this list"
          detail="Type above to add the first thing."
        />
      )}

      {selMode && <div style={{ height: 150 }} />}

      {doneItems.length > 0 && (
        <>
          <button
            className="lx-donetoggle"
            onClick={() => setShowDone(!showDone)}
          >
            {`${showDone ? "HIDE" : "SHOW"} ${doneItems.length} COMPLETED`}
          </button>
          {showDone && (
            <div className="lx-seam" style={{ marginTop: 8 }}>
              {doneItems.map((item) => (
                <div className="lx-handled" key={item.id}>
                  <div className="t">{item.title}</div>
                  <button
                    className="lx-putback"
                    onClick={() => ops.setDone(list.id, item, false)}
                  >
                    Put back
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- bulk bar ---------- */
function BulkBar({ data, list, now, sel, setSel, panel, setPanel, ops }) {
  const items = (list.items || []).filter((i) => !i.done);
  const picked = items.filter((i) => sel.includes(i.id));
  const allPicked = picked.length === items.length && items.length > 0;
  const weekendIn = (6 - now.getDay() + 7) % 7 || 6;
  const dates = [
    ["TODAY", 0],
    ["TOMORROW", 1],
    ["THIS WEEKEND", weekendIn],
    ["+1 WEEK", 7],
    ["NO DATE", null],
  ];
  return (
    <div className="lx-bulk" role="region" aria-label="Bulk actions">
      {panel === "date" && (
        <div className="lx-bulk-dates">
          {dates.map(([label, n]) => (
            <button
              key={label}
              className="lx-bulk-date"
              onClick={() => ops.bulkDate(list.id, picked, n)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {panel === "move" && (
        <div className="lx-bulk-lists">
          {data.lists
            .filter((l) => l.id !== list.id)
            .map((l) => (
              <button
                key={l.id}
                onClick={() => ops.bulkMove(list.id, picked, l.id)}
              >
                <span>{l.name}</span>
                <span className="n">
                  {(l.items || []).filter((i) => !i.done).length}
                </span>
              </button>
            ))}
        </div>
      )}
      <div className="lx-bulk-head">
        <div style={{ minWidth: 0 }}>
          <div className="lx-bulk-n">{`${sel.length} SELECTED`}</div>
          <div className="lx-bulk-hint">
            {sel.length === 1
              ? "Tap more items to add them"
              : "Tap items to add or remove"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, flex: "none" }}>
          <button
            className="lx-bulk-mini"
            onClick={() => setSel(allPicked ? [] : items.map((i) => i.id))}
          >
            {allPicked ? "NONE" : "ALL"}
          </button>
          <button
            className="lx-bulk-mini"
            onClick={() => {
              setSel([]);
              setPanel(null);
            }}
          >
            CANCEL
          </button>
        </div>
      </div>
      <div className="lx-bulk-acts">
        <button
          className="lx-bulk-act go"
          onClick={() => ops.bulkDone(list.id, picked)}
        >
          DONE
        </button>
        <button
          className={`lx-bulk-act ghost${panel === "date" ? " on" : ""}`}
          onClick={() => setPanel(panel === "date" ? null : "date")}
        >
          DATE
        </button>
        <button
          className={`lx-bulk-act ghost${panel === "move" ? " on" : ""}`}
          onClick={() => setPanel(panel === "move" ? null : "move")}
        >
          MOVE
        </button>
        <button
          className="lx-bulk-act kill"
          onClick={() => ops.bulkDelete(list.id, picked)}
        >
          DELETE
        </button>
      </div>
    </div>
  );
}

/* ---------- the to-do sheet ---------- */
function TodoSheet({ data, list, item, now, ops, onClose }) {
  const [stepDraft, setStepDraft] = useState("");
  const sc = stepCount(item);
  const overdue = item.due && new Date(item.due) < startOfDay(now);
  const hour = data.settings.todoAutoHour ?? 9;
  const leadDays = (item.reminders || [])
    .filter((r) => r.kind === "lead")
    .map((r) => r.days);
  const patch = (p) => ops.patchItem(list.id, item.id, p);

  const dateChips = [
    ["TODAY", 0],
    ["TOMORROW", 1],
    ["+1 WEEK", 7],
  ];

  return (
    <div className="lx-sheet" role="dialog" aria-label={item.title || "To-do"}>
      <div className="lx-sheet-head">
        <button className="lx-close" onClick={onClose}>
          ‹ {list.name}
        </button>
        <span className="lx-savenote">SAVES AS YOU TYPE</span>
      </div>

      <div className="lx-sheet-body">
        <div className="lx-form">
          <div>
            <textarea
              className="lx-td-title"
              rows={2}
              value={item.title}
              placeholder="Untitled"
              onChange={(e) => patch({ title: e.target.value })}
              aria-label="Title"
            />
            <div className="lx-tags" style={{ marginTop: 6 }}>
              <span
                className="lx-tag solid"
                style={{
                  color: overdue
                    ? "#8c2f10"
                    : item.due
                      ? "var(--ink-2)"
                      : "var(--mute-3)",
                  background: overdue
                    ? "#fbe8e0"
                    : item.due
                      ? "#f0ede5"
                      : "transparent",
                }}
              >
                {item.due
                  ? overdue
                    ? `OVERDUE · ${capDate(item.due)}`
                    : capDate(item.due)
                  : "NO DATE"}
              </span>
              {sc.total > 0 && (
                <span className="lx-tag">{`${sc.done}/${sc.total} STEPS`}</span>
              )}
            </div>
          </div>

          <div className="lx-td-card">
            <div className="lx-lab" style={{ marginBottom: 7 }}>
              DUE DATE
            </div>
            <input
              type="date"
              className="lx-td-date"
              value={dateInputValue(item.due)}
              onChange={(e) => {
                const iso = isoFromInput(e.target.value, hour);
                patch(iso ? { due: iso } : { due: null, reminders: [] });
              }}
              aria-label="Due date"
            />
            <div className="lx-chips" style={{ marginTop: 10 }}>
              {dateChips.map(([label, n]) => {
                const d = addDays(now, n);
                d.setHours(hour, 0, 0, 0);
                const on = item.due && sameDay(new Date(item.due), d);
                return (
                  <button
                    key={label}
                    className={`lx-chip sm ink${on ? " on" : ""}`}
                    onClick={() => patch({ due: d.toISOString() })}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                className="lx-chip sm danger"
                onClick={() => patch({ due: null, reminders: [] })}
              >
                CLEAR
              </button>
            </div>

            <div className="lx-hr" />
            <div className="lx-lab" style={{ marginBottom: 7 }}>
              REMINDERS
            </div>
            <div className="lx-chips" style={{ marginTop: 0 }}>
              {TODO_LEADS.map((d) => {
                const on = leadDays.includes(d);
                return (
                  <button
                    key={d}
                    className={`lx-chip sm${!item.due ? " off" : on ? " on" : ""}`}
                    disabled={!item.due}
                    onClick={() =>
                      patch({
                        reminders: on
                          ? item.reminders.filter(
                              (r) => !(r.kind === "lead" && r.days === d),
                            )
                          : [
                              ...(item.reminders || []),
                              { kind: "lead", days: d, hour },
                            ].sort((a, b) => (b.days || 0) - (a.days || 0)),
                      })
                    }
                  >
                    {leadChip(d)}
                  </button>
                );
              })}
            </div>
            {!item.due && (
              <div className="lx-locked">
                Give it a date first — reminders count back from the due date.
              </div>
            )}
          </div>

          <div>
            <div className="lx-lab" style={{ marginBottom: 7 }}>
              STEPS
            </div>
            <div className="lx-steps">
              {(item.subtasks || []).map((s) => (
                <div className="lx-step" key={s.id}>
                  <button
                    className={`lx-step-box${s.done ? " on" : ""}`}
                    onClick={() =>
                      ops.patchSub(list.id, item.id, s.id, { done: !s.done })
                    }
                    aria-label={`Mark ${s.title} ${s.done ? "not done" : "done"}`}
                  >
                    <i>{s.done ? "✓" : ""}</i>
                  </button>
                  <input
                    value={s.title}
                    onChange={(e) =>
                      ops.patchSub(list.id, item.id, s.id, {
                        title: e.target.value,
                      })
                    }
                    aria-label="Step"
                  />
                  {s.due && <span className="when">{capDate(s.due)}</span>}
                  <button
                    className="lx-step-x"
                    onClick={() => ops.removeSub(list.id, item.id, s.id)}
                    aria-label={`Remove ${s.title}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="lx-step" style={{ gridTemplateColumns: "1fr" }}>
                <input
                  className="draft"
                  value={stepDraft}
                  placeholder="Add a step, press enter"
                  onChange={(e) => setStepDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && stepDraft.trim()) {
                      ops.addSub(list.id, item.id, stepDraft.trim());
                      setStepDraft("");
                    }
                  }}
                  aria-label="Add a step"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="lx-lab" style={{ marginBottom: 7 }}>
              NOTES
            </div>
            <textarea
              className="lx-ta"
              rows={3}
              value={item.notes || ""}
              placeholder="Anything worth remembering"
              onChange={(e) => patch({ notes: e.target.value })}
              aria-label="Notes"
            />
          </div>

          <div>
            <div className="lx-lab" style={{ marginBottom: 7 }}>
              LIST
            </div>
            <select
              className="lx-select-full"
              value={list.id}
              onChange={(e) => ops.moveItem(list.id, item, e.target.value)}
              aria-label="List"
            >
              {data.lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="lx-sheet-foot">
        <button
          className="lx-save"
          onClick={() => ops.setDone(list.id, item, true)}
        >
          ✓ MARK DONE
        </button>
        <button
          className="lx-kill"
          onClick={() => ops.deleteItem(list.id, item)}
        >
          DELETE
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Calendar — one destination, five views
   ============================================================ */

const CAL_START_H = 6;
const CAL_END_H = 23;
const CAL_PX = 44;
const CAL_H = (CAL_END_H - CAL_START_H) * CAL_PX;
const CAL_VIEWS = [
  ["list", "LIST"],
  ["month", "MONTH"],
  ["week", "WEEK"],
  ["work", "WORK"],
  ["day3", "3 DAY"],
];
const ALERT_OPTS = [0, 15, 60, 120, 1440];

const minsOfDate = (d) =>
  new Date(d).getHours() * 60 + new Date(d).getMinutes();
const timeLabel = (e) =>
  e.allDay
    ? "ALL DAY"
    : `${fmtTime(e.start)}${e.end ? `–${fmtTime(e.end)}` : ""}`;

function weekStartOf(d, weekStart) {
  const dow =
    weekStart === "sun" ? new Date(d).getDay() : (new Date(d).getDay() + 6) % 7;
  return addDays(d, -dow);
}

function CalendarTab({
  data,
  now,
  unreviewed,
  seedView,
  onSeedUsed,
  onOpenEvent,
  onNewEvent,
  onSeen,
  onMute,
}) {
  const S = data.settings;
  /* seedView lets Home's banner land on the review queue rather than on
     whichever grid the user normally opens. It is consumed once. */
  const [view, setView] = useState(seedView || S.calDefault || "week");
  useEffect(() => {
    if (seedView) onSeedUsed();
  }, []);
  const [anchor, setAnchor] = useState(() => startOfDay(now));
  const [sel, setSel] = useState(() => startOfDay(now));

  const eventsOn = useCallback(
    (day) =>
      data.events
        .filter((e) => sameDay(new Date(e.start), day))
        .sort(
          (a, b) =>
            (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) ||
            minsOfDate(a.start) - minsOfDate(b.start),
        ),
    [data.events],
  );

  const views = S.watchNew
    ? [
        ...CAL_VIEWS,
        ["new", `NEW${unreviewed.length ? ` ${unreviewed.length}` : ""}`],
      ]
    : CAL_VIEWS;

  let days = [];
  if (view === "week")
    days = [0, 1, 2, 3, 4, 5, 6].map((i) =>
      addDays(weekStartOf(anchor, S.weekStart), i),
    );
  else if (view === "work")
    days = [0, 1, 2, 3, 4].map((i) =>
      addDays(weekStartOf(anchor, S.weekStart), i),
    );
  else if (view === "day3") days = [0, 1, 2].map((i) => addDays(anchor, i));

  const isGrid = view === "week" || view === "work" || view === "day3";

  const rangeLabel = () => {
    if (view === "month" || view === "list" || view === "new")
      return anchor.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
    const a = days[0];
    const b = days[days.length - 1];
    const am = a.toLocaleDateString(undefined, { month: "short" });
    const bm = b.toLocaleDateString(undefined, { month: "short" });
    return `${a.getDate()}${am !== bm ? ` ${am}` : ""}–${b.getDate()} ${bm} ${b.getFullYear()}`;
  };
  const subLabel = {
    list: "AGENDA",
    month: "MONTH",
    week: "WEEK",
    work: "WORK WEEK",
    day3: "THREE DAYS",
    new: "NEW IN YOUR CALENDAR",
  }[view];

  const step = (dir) => () => {
    if (view === "month")
      setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
    else
      setAnchor(
        addDays(anchor, dir * (view === "day3" ? 3 : view === "list" ? 14 : 7)),
      );
  };

  /* ----- grid columns ----- */
  const columns = days.map((day) => {
    const all = eventsOn(day);
    const timed = all.filter((e) => !e.allDay);
    const lanes = [];
    const placed = timed.map((e) => {
      const a = minsOfDate(e.start);
      const b = Math.max(e.end ? minsOfDate(e.end) : a + 60, a + 30);
      let lane = 0;
      while (lanes[lane] != null && lanes[lane] > a) lane++;
      lanes[lane] = b;
      return { e, a, b, lane };
    });
    const width = Math.max(lanes.length, 1);
    return {
      day,
      today: sameDay(day, now),
      allDay: all.filter((e) => e.allDay),
      blocks: placed.map(({ e, a, b, lane }) => ({
        e,
        top: ((a - CAL_START_H * 60) / 60) * CAL_PX,
        height: Math.max(((b - a) / 60) * CAL_PX - 3, 26),
        left: (lane / width) * 100,
        width: (1 / width) * 100,
      })),
    };
  });

  /* ----- month grid ----- */
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = weekStartOf(monthStart, S.weekStart);
  const monthRows = [];
  for (let i = 0; i < 42; i++) {
    const day = addDays(gridStart, i);
    if (i % 7 === 0) monthRows.push({ week: `KW ${isoWeek(day)}`, cells: [] });
    const list = eventsOn(day);
    monthRows[monthRows.length - 1].cells.push({
      day,
      num: day.getDate(),
      inMonth: day.getMonth() === anchor.getMonth(),
      today: sameDay(day, now),
      picked: sameDay(day, sel),
      bars: list.slice(0, 3).map((e) => catOf(e.cat).fg),
      more: list.length > 3 ? `+${list.length - 3}` : "",
    });
  }
  const monthCols = S.weekNums ? "28px repeat(7,1fr)" : "repeat(7,1fr)";
  const dowRow =
    S.weekStart === "sun"
      ? ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]
      : ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

  /* ----- agenda ----- */
  const agenda = [];
  for (let i = -2; i < 60 && agenda.length < 24; i++) {
    const day = addDays(anchor, i);
    const list = eventsOn(day);
    if (!list.length) continue;
    agenda.push({
      day,
      label: capDate(day),
      tag: sameDay(day, now)
        ? "TODAY"
        : sameDay(day, addDays(now, 1))
          ? "TOMORROW"
          : "",
      items: list,
    });
  }

  const weekBadge =
    view === "month"
      ? `KW ${isoWeek(monthStart)}–${isoWeek(addDays(gridStart, 34))}`
      : `KW ${isoWeek(days[0] || anchor)}`;

  return (
    <div className="lx-page flush">
      <div className="lx-cal-head">
        <div className="lx-cal-top">
          <div>
            <div className="lx-cal-title">{rangeLabel()}</div>
            <div className="lx-cal-sub">
              <span className="s">{subLabel}</span>
              {S.weekNums && view !== "list" && view !== "new" && (
                <span className="lx-kwbadge">{weekBadge}</span>
              )}
            </div>
          </div>
          <div className="lx-cal-nav">
            <button onClick={step(-1)} aria-label="Previous">
              ‹
            </button>
            <button
              className="today"
              onClick={() => {
                setAnchor(startOfDay(now));
                setSel(startOfDay(now));
              }}
            >
              TODAY
            </button>
            <button onClick={step(1)} aria-label="Next">
              ›
            </button>
          </div>
        </div>
        <div className="lx-cal-seg">
          <Seg options={views} value={view} onPick={setView} />
        </div>
      </div>

      {isGrid && (
        <>
          <div className="lx-cal-gridhead">
            <div className="lx-gutter">
              {S.weekNums ? `KW ${isoWeek(days[0])}` : ""}
            </div>
            {columns.map((c) => (
              <div className="lx-col" key={c.day.toISOString()}>
                <div
                  className="dow"
                  style={{
                    color: c.today ? "var(--amber-ink)" : "var(--mute-2)",
                  }}
                >
                  {c.day
                    .toLocaleDateString(undefined, { weekday: "short" })
                    .toUpperCase()}
                </div>
                <div
                  className="num"
                  style={{ color: c.today ? "var(--amber-ink)" : "var(--ink)" }}
                >
                  {c.day.getDate()}
                </div>
                <div className="lx-allday">
                  {c.allDay.map((e) => (
                    <button
                      key={e.id}
                      style={{
                        background: catOf(e.cat).bg,
                        color: catOf(e.cat).fg,
                      }}
                      onClick={() => onOpenEvent(e.id)}
                    >
                      {e.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="lx-cal-body">
            <div className="lx-hours" style={{ height: CAL_H }}>
              {Array.from({ length: CAL_END_H - CAL_START_H }, (_, i) => (
                <div className="lx-hour" key={i}>
                  {gutterHour(CAL_START_H + i)}
                </div>
              ))}
            </div>
            {columns.map((c) => (
              <div
                className="lx-colbody"
                key={c.day.toISOString()}
                style={{ height: CAL_H }}
              >
                {Array.from({ length: CAL_END_H - CAL_START_H }, (_, i) => (
                  <button
                    key={i}
                    className="lx-slot"
                    style={{ top: i * CAL_PX }}
                    onClick={() => onNewEvent(c.day, CAL_START_H + i)}
                    aria-label={`New event at ${pad(CAL_START_H + i)}:00`}
                  />
                ))}
                {c.blocks.map((b) => (
                  <button
                    key={b.e.id}
                    className="lx-ev"
                    style={{
                      top: b.top,
                      height: b.height,
                      left: `${b.left}%`,
                      width: `${b.width}%`,
                      background: catOf(b.e.cat).bg,
                      borderLeftColor: catOf(b.e.cat).fg,
                    }}
                    onClick={() => onOpenEvent(b.e.id)}
                  >
                    <div className="t">{b.e.title}</div>
                    <div className="m">{fmtTime(b.e.start)}</div>
                  </button>
                ))}
                {c.today && (
                  <div
                    className="lx-nowline"
                    style={{
                      top: ((minsOfDate(now) - CAL_START_H * 60) / 60) * CAL_PX,
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="lx-cal-foot">
            <button
              className="lx-dash sm"
              onClick={() => onNewEvent(days[0], 9)}
            >
              Tap any empty slot, or add an event here
            </button>
          </div>
        </>
      )}

      {view === "month" && (
        <>
          <div className="lx-month">
            <div
              className="lx-month-dow"
              style={{ gridTemplateColumns: monthCols }}
            >
              {S.weekNums && <div />}
              {dowRow.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
            <div className="lx-month-body">
              {monthRows.map((r, i) => (
                <div
                  className="lx-month-row"
                  key={i}
                  style={{ gridTemplateColumns: monthCols }}
                >
                  {S.weekNums && <div className="lx-weekno">{r.week}</div>}
                  {r.cells.map((c) => (
                    <button
                      className="lx-day"
                      key={c.day.toISOString()}
                      onClick={() => setSel(c.day)}
                    >
                      <span
                        className="n"
                        style={{
                          background: c.picked ? "var(--ink)" : "transparent",
                          color: c.picked
                            ? "var(--on-ink)"
                            : !c.inMonth
                              ? "var(--mute-5)"
                              : c.today
                                ? "var(--amber-ink)"
                                : "var(--ink)",
                          fontWeight: c.today || c.picked ? 600 : 400,
                        }}
                      >
                        {c.num}
                      </span>
                      <span className="bars">
                        {c.bars.map((bg, j) => (
                          <i key={j} style={{ background: bg }} />
                        ))}
                      </span>
                      <span className="more">{c.more}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "16px 16px 0" }}>
            <SectionHead label={capDate(sel)} />
            {eventsOn(sel).length > 0 ? (
              <div className="lx-seam r11">
                {eventsOn(sel).map((e) => (
                  <button
                    className="lx-selrow"
                    key={e.id}
                    onClick={() => onOpenEvent(e.id)}
                  >
                    <span
                      className="rail"
                      style={{ background: catOf(e.cat).fg }}
                    />
                    <span style={{ minWidth: 0, display: "block" }}>
                      <span className="t">{e.title}</span>
                      <span className="m">{timeLabel(e)}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="lx-quiet-note">Nothing on this day.</div>
            )}
            <button
              className="lx-dash sm"
              style={{ marginTop: 10 }}
              onClick={() => onNewEvent(sel, 9)}
            >
              ＋ New event on this day
            </button>
          </div>
        </>
      )}

      {view === "list" && (
        <div style={{ padding: "0 16px" }}>
          {agenda.map((g) => (
            <div style={{ marginBottom: 18 }} key={g.day.toISOString()}>
              <div className="lx-agenda-head">
                <span className="day">{g.label}</span>
                {g.tag && (
                  <span
                    className="tag"
                    style={{
                      color:
                        g.tag === "TODAY"
                          ? "var(--amber-ink)"
                          : "var(--mute-3)",
                    }}
                  >
                    {g.tag}
                  </span>
                )}
                <span className="lx-rule-line" />
                <button
                  className="lx-agenda-add"
                  onClick={() => onNewEvent(g.day, 9)}
                  aria-label={`New event on ${g.label}`}
                >
                  ＋
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {g.items.map((e) => (
                  <button
                    className="lx-ag-item"
                    key={e.id}
                    style={{ borderLeftColor: catOf(e.cat).fg }}
                    onClick={() => onOpenEvent(e.id)}
                  >
                    <span className="head">
                      <span className="t">{e.title}</span>
                      <span className="time">{timeLabel(e)}</span>
                    </span>
                    {e.location && <span className="where">{e.location}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {agenda.length === 0 && (
            <Empty
              title="Nothing in this stretch"
              detail="Step forward, or add an event."
            />
          )}
          <button className="lx-dash sm" onClick={() => onNewEvent(anchor, 9)}>
            ＋ New event
          </button>
        </div>
      )}

      {view === "new" && (
        <div style={{ padding: "0 16px" }}>
          {unreviewed.length === 0 ? (
            <Empty
              title="Nothing new"
              detail="Events added to your shared calendars will queue up here."
            />
          ) : (
            <>
              <button
                className="lx-btn-out"
                style={{ width: "100%", height: 44, marginBottom: 14 }}
                onClick={() => onSeen(unreviewed.map((e) => e.id))}
              >
                Mark all as read
              </button>
              <div className="lx-newq">
                {unreviewed.map((e) => (
                  <article
                    className="lx-card"
                    key={e.id}
                    style={{
                      borderLeftColor: catOf(e.cat).fg,
                      cursor: "default",
                    }}
                  >
                    <div className="lx-card-top">
                      <span className="lx-card-k">
                        {e.organizer && e.organizer.name
                          ? `BY ${e.organizer.name.toUpperCase()}`
                          : "ADDED"}
                      </span>
                      <span className="lx-card-due">{timeLabel(e)}</span>
                    </div>
                    <h3>{e.title}</h3>
                    <div className="lx-kv paper">
                      <Row k="WHEN">{`${fmtDate(e.start)} · ${relative(e.start, now)}`}</Row>
                      {e.location && <Row k="WHERE">{e.location}</Row>}
                    </div>
                    <div className="lx-card-act">
                      <button
                        className="lx-btn-quiet"
                        onClick={() => onOpenEvent(e.id)}
                      >
                        Open
                      </button>
                      <button
                        className="lx-btn-quiet narrow"
                        onClick={() => onSeen([e.id])}
                      >
                        Read
                      </button>
                      <button
                        className="lx-btn-warn"
                        onClick={() => onMute(e.id)}
                      >
                        Mute
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- the event sheet ---------- */
function EventSheet({
  data,
  event,
  draft,
  editing,
  setDraft,
  onClose,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}) {
  const cat = catOf(event ? event.cat : draft && draft.cat);
  const set = (patch) => setDraft({ ...draft, ...patch });
  const draftDay = draft ? new Date(`${draft.date}T00:00:00`) : null;

  return (
    <div
      className="lx-sheet"
      role="dialog"
      aria-label={editing ? "Edit event" : "Event"}
    >
      <div className="lx-sheet-head">
        <button className="lx-close" onClick={onClose}>
          ‹ Close
        </button>
        {editing ? (
          <button className="lx-cancel" onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <button className="lx-edit" onClick={onEdit}>
            EDIT
          </button>
        )}
      </div>

      <div className="lx-sheet-body">
        {!editing && event && (
          <div style={{ padding: "20px 16px 26px" }}>
            <span
              className="lx-cat"
              style={{ color: cat.fg, background: cat.bg }}
            >
              {cat.name.toUpperCase()}
            </span>
            <h3 className="lx-sheet-h">{event.title}</h3>
            <div className="lx-table">
              <div className="lx-table-row">
                <span className="lx-table-k">WHEN</span>
                <span className="lx-table-v">
                  {event.allDay
                    ? `${fmtDate(event.start)} · all day`
                    : `${fmtDate(event.start)} · ${fmtTime(event.start)}${
                        event.end ? `–${fmtTime(event.end)}` : ""
                      }`}
                  {event.recurring ? ` · ${event.repeats || "repeats"}` : ""}
                </span>
              </div>
              <div className="lx-table-row">
                <span className="lx-table-k">WHERE</span>
                <span className="lx-table-v">{event.location || "—"}</span>
              </div>
              <div className="lx-table-row">
                <span className="lx-table-k">ALERTS</span>
                <span className="lx-table-v">
                  {(event.alerts || []).length
                    ? event.alerts
                        .slice()
                        .sort((a, b) => b - a)
                        .map(alertLabel)
                        .join(", ")
                    : "None"}
                </span>
              </div>
              {(event.tasks || []).length > 0 && (
                <div className="lx-table-row">
                  <span className="lx-table-k">ADDED</span>
                  <span className="lx-table-v">
                    {event.tasks
                      .map(
                        (t) =>
                          `${t.label} (${(t.leads || [])
                            .map((l) => leadLabel(l.days))
                            .join(", ")})`,
                      )
                      .join(" · ")}
                  </span>
                </div>
              )}
              <div className="lx-table-row">
                <span className="lx-table-k">NOTES</span>
                <span className="lx-table-v">{event.description || "—"}</span>
              </div>
            </div>
            <div className="lx-note">
              Read-only. Tap EDIT to change anything.
            </div>
          </div>
        )}

        {editing && draft && (
          <div className="lx-form">
            <div className="lx-form-h">
              {draft.id ? "Edit event" : "New event"}
            </div>
            <div>
              <div className="lx-lab">TITLE</div>
              <input
                className="lx-in"
                value={draft.title}
                placeholder="What is it?"
                onChange={(e) => set({ title: e.target.value })}
                aria-label="Title"
              />
            </div>
            <div>
              <div className="lx-lab">DATE</div>
              <input
                type="date"
                className="lx-in mono"
                value={draft.date}
                onChange={(e) =>
                  e.target.value && set({ date: e.target.value })
                }
                aria-label="Date"
              />
              <div className="lx-daynote">
                {draftDay && !isNaN(draftDay) ? fmtDate(draftDay) : ""}
              </div>
            </div>
            <div className="lx-rowcard">
              <span className="t">All day</span>
              <Toggle
                on={draft.allDay}
                label="All day"
                onClick={() => set({ allDay: !draft.allDay })}
              />
            </div>
            {!draft.allDay && (
              <div className="lx-two">
                <div>
                  <div className="lx-lab">STARTS</div>
                  <input
                    type="time"
                    className="lx-in mono"
                    value={draft.start}
                    onChange={(e) => {
                      const v = e.target.value;
                      set({
                        start: v,
                        end:
                          minsOfClock(v) >= minsOfClock(draft.end)
                            ? clockOfMins(Math.min(minsOfClock(v) + 60, 1439))
                            : draft.end,
                      });
                    }}
                    aria-label="Starts"
                  />
                </div>
                <div>
                  <div className="lx-lab">ENDS</div>
                  <input
                    type="time"
                    className="lx-in mono"
                    value={draft.end}
                    onChange={(e) => set({ end: e.target.value })}
                    aria-label="Ends"
                  />
                </div>
              </div>
            )}
            <div>
              <div className="lx-lab">CALENDAR</div>
              <div className="lx-chips" style={{ marginTop: 0 }}>
                {Object.keys(CATS).map((k) => {
                  const on = draft.cat === k;
                  return (
                    <button
                      key={k}
                      className="lx-chip"
                      style={
                        on
                          ? {
                              background: CATS[k].fg,
                              borderColor: CATS[k].fg,
                              color: "#fff",
                            }
                          : undefined
                      }
                      onClick={() => set({ cat: k })}
                      aria-pressed={on}
                    >
                      {CATS[k].name.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="lx-lab">ALERTS</div>
              <div className="lx-chips" style={{ marginTop: 0 }}>
                {ALERT_OPTS.map((m) => {
                  const on = draft.alerts.includes(m);
                  return (
                    <button
                      key={m}
                      className={`lx-chip${on ? " on" : ""}`}
                      onClick={() =>
                        set({
                          alerts: on
                            ? draft.alerts.filter((x) => x !== m)
                            : [...draft.alerts, m],
                        })
                      }
                      aria-pressed={on}
                    >
                      {alertChip(m)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="lx-lab">WHERE</div>
              <input
                className="lx-in plain"
                value={draft.location}
                placeholder="Add a place"
                onChange={(e) => set({ location: e.target.value })}
                aria-label="Where"
              />
            </div>
            <div>
              <div className="lx-lab">NOTES</div>
              <textarea
                className="lx-ta"
                rows={3}
                value={draft.description}
                placeholder="Anything worth remembering"
                onChange={(e) => set({ description: e.target.value })}
                aria-label="Notes"
              />
            </div>
            <div className="lx-formact">
              <button className="lx-save" onClick={onSave}>
                SAVE
              </button>
              {draft.id && (
                <button className="lx-kill" onClick={onDelete}>
                  DELETE
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Settings — behind the header control, not a tab
   ============================================================ */

const SNOOZE_OPTS = [
  ["15m", "15 minutes"],
  ["1h", "1 hour"],
  ["3h", "3 hours"],
];
const SOUND_OPTS = [
  ["chime", "Chime"],
  ["ping", "Ping"],
  ["marimba", "Marimba"],
  ["none", "Silent"],
];
const LEAD_PRESETS = [0, 1, 2, 7];

function ImportPanel({ data, persist, onDone }) {
  const [raw, setRaw] = useState("");
  const [markRead, setMarkRead] = useState(true);
  const [result, setResult] = useState(null);

  const ingest = (text) => {
    const found = parseICS(text);
    if (!found.length) {
      setResult("No events found. Is this an .ics file?");
      return;
    }
    const existing = new Set(data.events.map((e) => e.id));
    const fresh = found.filter((e) => !existing.has(e.id));
    /* Invariant 4: every path that adds events decides seen-ness explicitly. */
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
    setRaw("");
    setResult(
      `Added ${fresh.length} event${fresh.length === 1 ? "" : "s"}${
        found.length - fresh.length
          ? `, skipped ${found.length - fresh.length} already here`
          : ""
      }.${markRead ? " All marked as read." : ""}`,
    );
    if (onDone) onDone();
  };

  return (
    <div className="lx-set-block">
      <div className="t">Import an .ics file</div>
      <div className="lx-set-row" style={{ padding: "0 0 10px" }}>
        <span className="d" style={{ marginTop: 0 }}>
          Outlook: open the calendar on the web, choose Share, then Publish a
          calendar and download the ICS link. Repeating events are expanded for{" "}
          {HORIZON_DAYS} days.
        </span>
      </div>
      <input
        className="lx-file"
        type="file"
        accept=".ics,text/calendar"
        aria-label="Upload an .ics file"
        onChange={(e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const r = new FileReader();
          r.onload = () => ingest(String(r.result));
          r.onerror = () => setResult("Couldn't read that file.");
          r.readAsText(file);
        }}
      />
      <textarea
        className="lx-ta"
        style={{ marginTop: 10 }}
        rows={3}
        value={raw}
        placeholder="BEGIN:VCALENDAR…"
        onChange={(e) => setRaw(e.target.value)}
        aria-label="Paste .ics contents"
      />
      <div className="lx-set-row" style={{ padding: "10px 0 0" }}>
        <span className="d" style={{ marginTop: 0 }}>
          Mark everything in this import as read, so a year of events doesn't
          land in New at once.
        </span>
        <Toggle
          on={markRead}
          label="Mark as read"
          onClick={() => setMarkRead(!markRead)}
        />
      </div>
      <button
        className="lx-btn-out"
        style={{ width: "100%", height: 44, marginTop: 12 }}
        onClick={() => raw.trim() && ingest(raw)}
      >
        Read the calendar
      </button>
      {result && (
        <div className="lx-warnline" style={{ marginTop: 12, marginBottom: 0 }}>
          {result}
        </div>
      )}
    </div>
  );
}

function Settings({
  data,
  persist,
  undoable,
  notifyState,
  onRequestNotify,
  onClose,
}) {
  const S = data.settings;
  const put = (patch) => persist({ ...data, settings: { ...S, ...patch } });
  const [importOpen, setImportOpen] = useState(false);

  const sources = ["ics", "manual", "sample"]
    .map((k) => ({
      k,
      n: data.events.filter((e) => (e.source || "manual") === k).length,
    }))
    .filter((s) => s.n > 0);
  const sourceName = {
    ics: "Imported calendar",
    manual: "Added by hand",
    sample: "Sample events",
  };

  return (
    <div className="lx-sheet" role="dialog" aria-label="Settings">
      <div className="lx-sheet-head">
        <button className="lx-close" onClick={onClose}>
          ‹ Close
        </button>
        <span className="title">SETTINGS</span>
        <span className="pad" />
      </div>

      <div className="lx-sheet-body" style={{ padding: "18px 16px 30px" }}>
        <div className="lx-set-label">REMINDERS</div>
        <div className="lx-set-group">
          <div className="lx-set-row">
            <div style={{ minWidth: 0 }}>
              <div className="t">Quiet hours</div>
              <div className="d">
                {S.quiet
                  ? `Reminders inside these hours move to ${S.quietTo}.`
                  : "Reminders can fire at any hour."}
              </div>
            </div>
            <Toggle
              on={S.quiet}
              label="Quiet hours"
              onClick={() => put({ quiet: !S.quiet })}
            />
          </div>
          {S.quiet && (
            <div className="lx-set-block">
              <div className="lx-two">
                <div>
                  <div className="lx-minilabel">FROM</div>
                  <input
                    type="time"
                    className="lx-time"
                    value={S.quietFrom}
                    onChange={(e) => put({ quietFrom: e.target.value })}
                    aria-label="Quiet hours from"
                  />
                </div>
                <div>
                  <div className="lx-minilabel">UNTIL</div>
                  <input
                    type="time"
                    className="lx-time"
                    value={S.quietTo}
                    onChange={(e) => put({ quietTo: e.target.value })}
                    aria-label="Quiet hours until"
                  />
                </div>
              </div>
            </div>
          )}
          <div className="lx-set-block">
            <div className="t">Catch-all lead time</div>
            <div className="lx-chips" style={{ marginTop: 0 }}>
              {LEAD_PRESETS.map((n) => (
                <button
                  key={n}
                  className={`lx-chip sm${S.defaultLead === n ? " on" : ""}`}
                  onClick={() => put({ defaultLead: n })}
                >
                  {leadChip(n)}
                </button>
              ))}
            </div>
            <div className="d" style={{ marginTop: 8 }}>
              How far ahead the catch-all fires for events no rule recognises.
            </div>
          </div>
          <div className="lx-set-row">
            <span className="t">Default snooze</span>
            <select
              className="lx-select"
              value={S.defaultSnooze}
              onChange={(e) => put({ defaultSnooze: e.target.value })}
              aria-label="Default snooze"
            >
              {SNOOZE_OPTS.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="lx-set-label">CALENDAR</div>
        <div className="lx-set-group">
          <div className="lx-set-block">
            <div className="t">Opens on</div>
            <Seg
              options={CAL_VIEWS}
              value={S.calDefault}
              onPick={(v) => put({ calDefault: v })}
            />
          </div>
          <div className="lx-set-block">
            <div className="t">Week starts on</div>
            <Seg
              options={[
                ["mon", "MONDAY"],
                ["sun", "SUNDAY"],
              ]}
              value={S.weekStart}
              onPick={(v) => put({ weekStart: v })}
            />
          </div>
          <div className="lx-set-row">
            <span className="t">Show week numbers</span>
            <Toggle
              on={S.weekNums}
              label="Show week numbers"
              onClick={() => put({ weekNums: !S.weekNums })}
            />
          </div>
        </div>

        <div className="lx-set-label">LISTS</div>
        <div className="lx-set-group">
          <div className="lx-set-block">
            <div className="t">Undated items sit at</div>
            <Seg
              options={[
                ["top", "TOP"],
                ["bottom", "BOTTOM"],
              ]}
              value={S.undatedAt}
              onPick={(v) => put({ undatedAt: v })}
            />
          </div>
          <div className="lx-set-row">
            <div style={{ minWidth: 0 }}>
              <div className="t">Day-of nudge for dated to-dos</div>
              <div className="d">
                A dated to-do with no reminder of its own still speaks up on the
                day.
              </div>
            </div>
            <Toggle
              on={S.todoAutoRemind}
              label="Day-of nudge for dated to-dos"
              onClick={() => put({ todoAutoRemind: !S.todoAutoRemind })}
            />
          </div>
          <div className="lx-set-row">
            <div style={{ minWidth: 0 }}>
              <div className="t">Ask before deleting</div>
              <div className="d">
                Off by default: deleting is undoable, which is cheaper than a
                dialog.
              </div>
            </div>
            <Toggle
              on={S.confirmDelete}
              label="Ask before deleting"
              onClick={() => put({ confirmDelete: !S.confirmDelete })}
            />
          </div>
        </div>

        <div className="lx-set-label">NOTIFICATIONS</div>
        <div className="lx-set-group">
          <div className="lx-set-row">
            <div style={{ minWidth: 0 }}>
              <div className="t">System notifications</div>
              <div className="d">
                {notifyState === "granted"
                  ? "On — they fire while the app is open."
                  : notifyState === "denied"
                    ? "Blocked by the browser. Change it in site settings."
                    : notifyState === "unsupported"
                      ? "Not available in this context."
                      : "Not asked yet."}
              </div>
            </div>
            {notifyState !== "granted" && notifyState !== "unsupported" && (
              <button className="lx-btn-out" onClick={onRequestNotify}>
                Allow
              </button>
            )}
          </div>
          <div className="lx-set-row">
            <div style={{ minWidth: 0 }}>
              <div className="t">Sound</div>
              <div className="d">
                Silent suppresses the alert tone. The tone itself is the
                platform's.
              </div>
            </div>
            <select
              className="lx-select"
              value={S.sound}
              onChange={(e) => put({ sound: e.target.value })}
              aria-label="Sound"
            >
              {SOUND_OPTS.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="lx-set-row">
            <span className="t">Badge on the app icon</span>
            <Toggle
              on={S.badge}
              label="Badge on the app icon"
              onClick={() => put({ badge: !S.badge })}
            />
          </div>
          <div className="lx-set-row">
            <span className="t">Haptics</span>
            <Toggle
              on={S.haptics}
              label="Haptics"
              onClick={() => put({ haptics: !S.haptics })}
            />
          </div>
        </div>

        <div className="lx-set-label">NEW EVENTS</div>
        <div className="lx-set-group">
          <div className="lx-set-row">
            <div style={{ minWidth: 0 }}>
              <div className="t">Watch for events others add</div>
              <div className="d">
                Queues anything new on a shared calendar under NEW in Calendar,
                instead of letting it turn into reminders unseen.
              </div>
            </div>
            <Toggle
              on={S.watchNew}
              label="Watch for events others add"
              onClick={() => put({ watchNew: !S.watchNew })}
            />
          </div>
          {S.watchNew && (
            <>
              <div className="lx-set-row">
                <div style={{ minWidth: 0 }}>
                  <div className="t">Only events I didn't organise</div>
                  <div className="d">
                    Needs your address below to tell them apart.
                  </div>
                </div>
                <Toggle
                  on={S.watchOnlyOthers}
                  label="Only events I didn't organise"
                  onClick={() => put({ watchOnlyOthers: !S.watchOnlyOthers })}
                />
              </div>
              <div className="lx-set-block">
                <div className="t">Your address</div>
                <input
                  className="lx-in plain"
                  value={S.myEmail}
                  placeholder="you@example.com"
                  onChange={(e) => put({ myEmail: e.target.value })}
                  aria-label="Your address"
                />
              </div>
            </>
          )}
        </div>

        <div className="lx-set-label">CALENDAR SOURCES</div>
        <div className="lx-seam r12" style={{ marginBottom: 10 }}>
          {sources.map((s) => (
            <div
              style={{ background: "var(--card)", padding: "12px 13px" }}
              key={s.k}
            >
              <div className="t" style={{ font: "500 14.5px var(--body)" }}>
                {sourceName[s.k]}
              </div>
              <div
                style={{
                  font: "500 9.5px var(--mono)",
                  letterSpacing: ".08em",
                  color: "var(--mute-3)",
                  marginTop: 4,
                }}
              >
                {`${s.n} EVENT${s.n === 1 ? "" : "S"}`}
              </div>
            </div>
          ))}
        </div>
        <div className="lx-set-group">
          {importOpen ? (
            <ImportPanel
              data={data}
              persist={persist}
              onDone={() => setImportOpen(false)}
            />
          ) : (
            <button
              className="lx-dash sm"
              style={{ border: 0, borderRadius: 0, height: 48 }}
              onClick={() => setImportOpen(true)}
            >
              ＋ Import another calendar
            </button>
          )}
        </div>

        <div className="lx-set-label">DATA</div>
        <div className="lx-set-group">
          <div className="lx-set-block">
            <div className="t">Start the rules again</div>
            <div className="d">
              Puts the six starter rules back. Events and lists are untouched.
            </div>
            <button
              className="lx-btn-danger"
              style={{ marginTop: 11 }}
              onClick={() => {
                undoable(
                  { ...data, rules: defaultRules() },
                  "Rules reset to the six starters",
                  "RULES REPLACED",
                );
                onClose();
              }}
            >
              RESET ALL RULES
            </button>
          </div>
          <div className="lx-set-block">
            <div className="t">Erase events and lists</div>
            <div className="d">
              Removes every event, every list, and every completion and snooze
              along with them. Your rules and these settings stay. Undoable for
              nine seconds, and only that long.
            </div>
            <button
              className="lx-btn-danger"
              style={{ marginTop: 11 }}
              onClick={() => {
                /* Actually empty, rather than the sample data all over again: a
                   button that says erase and hands back fifteen events and eight
                   lists reads as broken, because you cannot tell it did anything. */
                undoable(
                  {
                    ...data,
                    events: [],
                    lists: [],
                    state: {
                      done: {},
                      snoozed: {},
                      notified: [],
                      seen: {},
                      muted: {},
                    },
                  },
                  "Events and lists erased",
                  `${data.events.length} EVENTS · ${data.lists.length} LISTS`,
                );
                onClose();
              }}
            >
              ERASE EVENTS AND LISTS
            </button>
          </div>
        </div>
        <div className="lx-version">LADDER {APP_VERSION} · HEADS UP</div>
      </div>
    </div>
  );
}

/* ============================================================
   The app — state owner, storage, notifications, routing, undo
   ============================================================ */

const TABS = [
  ["home", "Home", "upcoming"],
  ["lists", "Lists", "lists"],
  ["calendar", "Calendar", "calendar"],
  ["rules", "Rules", "rules"],
];

/* `onSchedule` is the seam between the app and whatever can wake a device.
   It is optional: the artifact runtime passes nothing and the app behaves
   exactly as before. In the browser the service worker consumes it; in the
   Capacitor build the OS alarm scheduler does. Neither is named here — see
   docs/ARCHITECTURE.md "The host contract". */
export default function HeadsUp({ onSchedule }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("home");
  const [warn, setWarn] = useState("");
  const [notifyState, setNotifyState] = useState("unknown");
  const now = useNow();
  const saveTimer = useRef(null);

  /* overlays and sub-routes, held here so they can sit above the tab bar */
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [listId, setListId] = useState(null);
  const [openTodo, setOpenTodo] = useState(null);
  const [sel, setSel] = useState([]);
  const [bulkPanel, setBulkPanel] = useState(null);
  const [evOpen, setEvOpen] = useState(null);
  const [evEdit, setEvEdit] = useState(false);
  const [draft, setDraft] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [calSeed, setCalSeed] = useState(null);

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
      if (typeof Notification !== "undefined")
        setNotifyState(Notification.permission);
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
        setWarn("Couldn't save — changes stay for this session only.");
      }
    }, 400);
  }, []);

  /* Destructive actions snapshot the whole state object, so undo is a single
     restore rather than an inverse operation per action type. The consequence
     is that undo reverts everything since the snapshot, not just the deletion. */
  const [undoTip, setUndoTip] = useState(null);
  const undoTimer = useRef(null);
  const undoable = useCallback(
    (next, label, meta) => {
      setUndoTip({ label, meta: meta || "", snapshot: data, at: Date.now() });
      persist(next);
    },
    [data, persist],
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

  /* "Ask before deleting" is off by default — undo is cheaper than a dialog —
     but when it is on every destructive path funnels through here. */
  const guard = (label, run) => {
    if (data && data.settings.confirmDelete) setConfirm({ label, run });
    else run();
  };

  const nudges = useMemo(() => (data ? allNudges(data) : []), [data]);
  const unreviewed = useMemo(
    () => (data ? unreviewedEvents(data, now) : []),
    [data, now],
  );

  const { live, queued, handled, counts, runway } = useMemo(() => {
    if (!data)
      return {
        live: [],
        queued: [],
        handled: [],
        counts: { now: 0, today: 0, week: 0 },
        runway: null,
      };
    const active = nudges
      .filter((n) => !n.done)
      .map((n) => ({
        ...n,
        bucket: bucketOf(n, now, data.settings.weekStart),
      }));
    /* Two overdue rungs of one ladder are one thing to do, not two. Marking
       either done clears both, so the live band shows the earliest only. */
    const seen = new Set();
    const liveList = [];
    active
      .filter((n) => n.bucket === "now")
      .forEach((n) => {
        if (seen.has(n.doneKey)) return;
        seen.add(n.doneKey);
        liveList.push(n);
      });
    const doneSeen = new Set();
    const handledList = nudges
      .filter((n) => n.done)
      .filter((n) => !n.doneAt || sameDay(n.doneAt, now))
      .filter((n) => {
        if (doneSeen.has(n.doneKey)) return false;
        doneSeen.add(n.doneKey);
        return true;
      });
    return {
      live: liveList,
      queued: active.filter((n) => n.bucket !== "now"),
      handled: handledList,
      counts: {
        now: liveList.length,
        today: active.filter((n) => n.bucket === "now" || n.bucket === "today")
          .length,
        /* Counts what the page below actually shows: everything that is not
           filed under LATER. On a Sunday that is today plus tomorrow, because
           tomorrow always gets its own section. */
        week: active.filter((n) => n.bucket !== "later").length,
      },
      runway: buildRunway(nudges, data.events, now),
    };
  }, [data, nudges, now]);

  /* fire system notifications for newly due nudges while open */
  useEffect(() => {
    if (!data || notifyState !== "granted" || !live.length) return;
    const seen = new Set(data.state.notified || []);
    const fresh = live.filter((n) => !seen.has(n.id));
    if (!fresh.length) return;
    fresh.forEach((n) => {
      notify(n.label, {
        body: notifyBody(n, now),
        tag: n.id,
        silent: data.settings.sound === "none",
      });
    });
    persist({
      ...data,
      state: {
        ...data.state,
        notified: [...seen, ...fresh.map((n) => n.id)].slice(-400),
      },
    });
  }, [live, notifyState, data, now, persist]);

  /* Publish the upcoming queue for the host to schedule.

     Deliberately not deduped by doneKey: every rung is its own notification,
     because a ladder that only ever speaks once is not a ladder. The live band
     collapses rungs for *display*; this is delivery.

     Keyed on the nudge set rather than on `now`, so it republishes when the
     data changes and not every thirty seconds. */
  const scheduleKey = useMemo(
    () =>
      nudges
        .filter((n) => !n.done)
        .map((n) => `${n.id}@${n.dueAt}`)
        .join("|"),
    [nudges],
  );
  useEffect(() => {
    if (!onSchedule || !data) return;
    const from = new Date();
    const horizon = addDays(from, SCHEDULE_DAYS).getTime();
    const items = nudges
      .filter((n) => !n.done)
      .filter((n) => new Date(n.dueAt).getTime() <= horizon)
      .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
      .slice(0, SCHEDULE_MAX)
      .map((n) => ({
        id: n.id,
        at: n.dueAt,
        title: n.label,
        body: notifyBody(n, new Date(n.dueAt)),
        silent: data.settings.sound === "none",
      }));
    onSchedule(items);
  }, [scheduleKey, onSchedule, data && data.settings.sound]);

  /* app-icon badge, where the platform has one */
  useEffect(() => {
    if (!data) return;
    try {
      if (!navigator.setAppBadge) return;
      if (data.settings.badge && counts.now > 0)
        navigator.setAppBadge(counts.now);
      else navigator.clearAppBadge();
    } catch (e) {
      /* no badge here */
    }
  }, [counts.now, data]);

  const swipe = useSwipe(data ? data.settings.haptics : false);

  if (!data) {
    return (
      <div className="lx">
        <style>{CSS}</style>
        <div className="lx-phone">
          <div className="lx-status">
            <span />
            <span className="mark">LADDER</span>
            <span />
          </div>
          <div className="lx-scroll">
            <div className="lx-page">
              <div className="lx-counters">
                <div className="lx-counter live">
                  <div className="k">NOW</div>
                  <div className="v">–</div>
                </div>
                <div className="lx-counter">
                  <div className="k">TODAY</div>
                  <div className="v">–</div>
                </div>
                <div className="lx-counter">
                  <div className="k">WEEK</div>
                  <div className="v">–</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- reminder actions ---------- */
  const withItem = (next, lid, itemId, fn) => ({
    ...next,
    lists: next.lists.map((l) =>
      l.id !== lid
        ? l
        : {
            ...l,
            items: l.items.map((it) => (it.id !== itemId ? it : fn(it))),
          },
    ),
  });

  /* Invariant 7: a to-do's completion is intrinsic data on the item, never in
     state.done — so a to-do nudge marked done in Home writes through. */
  const setTodoNudgeDone = (n, value) =>
    withItem(data, n.listId, n.itemId, (it) =>
      n.subId
        ? {
            ...it,
            subtasks: it.subtasks.map((st) =>
              st.id === n.subId
                ? {
                    ...st,
                    done: value,
                    doneAt: value ? new Date().toISOString() : null,
                  }
                : st,
            ),
          }
        : {
            ...it,
            done: value,
            doneAt: value ? new Date().toISOString() : null,
          },
    );

  const markNudgeDone = (n) => {
    const cleared = nudges.filter((x) => x.doneKey === n.doneKey).length;
    const meta = cleared > 1 ? `DONE · CLEARED ${cleared} LEAD TIMES` : "DONE";
    if (n.kind === "todo")
      return undoable(setTodoNudgeDone(n, true), n.label, meta);
    undoable(
      {
        ...data,
        state: {
          ...data.state,
          done: { ...data.state.done, [n.doneKey]: new Date().toISOString() },
        },
      },
      n.label,
      meta,
    );
  };
  const restoreNudge = (n) => {
    if (n.kind === "todo") return persist(setTodoNudgeDone(n, false));
    const done = { ...data.state.done };
    delete done[n.doneKey];
    persist({ ...data, state: { ...data.state, done } });
  };
  const snoozeNudge = (n, at) =>
    undoable(
      {
        ...data,
        state: {
          ...data.state,
          snoozed: { ...data.state.snoozed, [n.id]: at.toISOString() },
        },
      },
      n.label,
      `SNOOZED TO ${snoozeAtLabel(at, now)}`,
    );

  /* ---------- list actions ---------- */
  const patchList = (lid, fn) => ({
    ...data,
    lists: data.lists.map((l) => (l.id !== lid ? l : fn(l))),
  });
  const ops = {
    patchItem: (lid, itemId, patch) =>
      persist(withItem(data, lid, itemId, (it) => ({ ...it, ...patch }))),
    patchSub: (lid, itemId, subId, patch) =>
      persist(
        withItem(data, lid, itemId, (it) => ({
          ...it,
          subtasks: it.subtasks.map((s) =>
            s.id === subId ? { ...s, ...patch } : s,
          ),
        })),
      ),
    addSub: (lid, itemId, title) =>
      persist(
        withItem(data, lid, itemId, (it) => ({
          ...it,
          subtasks: [
            ...(it.subtasks || []),
            { id: uid(), title, due: null, reminders: [], done: false },
          ],
        })),
      ),
    removeSub: (lid, itemId, subId) =>
      persist(
        withItem(data, lid, itemId, (it) => ({
          ...it,
          subtasks: it.subtasks.filter((s) => s.id !== subId),
        })),
      ),
    addItem: (lid, title) =>
      persist(
        patchList(lid, (l) => ({
          ...l,
          items: [
            {
              id: uid(),
              title,
              notes: "",
              due: null,
              reminders: [],
              done: false,
              subtasks: [],
            },
            ...l.items,
          ],
        })),
      ),
    deleteItem: (lid, item) =>
      guard(`Delete “${item.title}”?`, () => {
        setOpenTodo(null);
        undoable(
          patchList(lid, (l) => ({
            ...l,
            items: l.items.filter((i) => i.id !== item.id),
          })),
          item.title,
          "DELETED",
        );
      }),
    setDone: (lid, item, value) => {
      if (value) setOpenTodo(null);
      const rems = (item.reminders || []).length;
      undoable(
        withItem(data, lid, item.id, (it) => ({
          ...it,
          done: value,
          doneAt: value ? new Date().toISOString() : null,
        })),
        item.title,
        value
          ? `DONE · ${rems ? `CLEARED ${rems} REMINDER${rems === 1 ? "" : "S"}` : "NO REMINDERS"}`
          : "PUT BACK",
      );
    },
    moveItem: (fromId, item, toId) => {
      if (fromId === toId) return;
      const target = data.lists.find((l) => l.id === toId);
      setOpenTodo(null);
      undoable(
        {
          ...data,
          lists: data.lists.map((l) => {
            if (l.id === fromId)
              return { ...l, items: l.items.filter((i) => i.id !== item.id) };
            if (l.id === toId) return { ...l, items: [item, ...l.items] };
            return l;
          }),
        },
        item.title,
        `MOVED TO ${target ? target.name.toUpperCase() : "ANOTHER LIST"}`,
      );
    },
    bulkDone: (lid, items) => {
      if (!items.length) return;
      const ids = new Set(items.map((i) => i.id));
      const stamp = new Date().toISOString();
      setSel([]);
      setBulkPanel(null);
      undoable(
        patchList(lid, (l) => ({
          ...l,
          items: l.items.map((i) =>
            ids.has(i.id) ? { ...i, done: true, doneAt: stamp } : i,
          ),
        })),
        `${items.length} item${items.length === 1 ? "" : "s"} marked done`,
        "DONE",
      );
    },
    bulkDelete: (lid, items) =>
      guard(
        `Delete ${items.length} item${items.length === 1 ? "" : "s"}?`,
        () => {
          if (!items.length) return;
          const ids = new Set(items.map((i) => i.id));
          setSel([]);
          setBulkPanel(null);
          undoable(
            patchList(lid, (l) => ({
              ...l,
              items: l.items.filter((i) => !ids.has(i.id)),
            })),
            `${items.length} item${items.length === 1 ? "" : "s"} deleted`,
            "DELETED",
          );
        },
      ),
    bulkDate: (lid, items, n) => {
      if (!items.length) return;
      const ids = new Set(items.map((i) => i.id));
      const hour = data.settings.todoAutoHour ?? 9;
      let iso = null;
      if (n != null) {
        const d = addDays(now, n);
        d.setHours(hour, 0, 0, 0);
        iso = d.toISOString();
      }
      setSel([]);
      setBulkPanel(null);
      undoable(
        patchList(lid, (l) => ({
          ...l,
          items: l.items.map((i) =>
            ids.has(i.id)
              ? { ...i, due: iso, reminders: iso ? i.reminders : [] }
              : i,
          ),
        })),
        `${items.length} item${items.length === 1 ? "" : "s"} rescheduled`,
        iso ? capDate(iso) : "DATE CLEARED",
      );
    },
    bulkMove: (fromId, items, toId) => {
      if (!items.length || fromId === toId) return;
      const ids = new Set(items.map((i) => i.id));
      const target = data.lists.find((l) => l.id === toId);
      setSel([]);
      setBulkPanel(null);
      undoable(
        {
          ...data,
          lists: data.lists.map((l) => {
            if (l.id === fromId)
              return { ...l, items: l.items.filter((i) => !ids.has(i.id)) };
            if (l.id === toId) return { ...l, items: [...items, ...l.items] };
            return l;
          }),
        },
        `${items.length} item${items.length === 1 ? "" : "s"} moved`,
        `TO ${target ? target.name.toUpperCase() : "ANOTHER LIST"}`,
      );
    },
    addList: () => {
      const list = {
        id: `list-${uid()}`,
        name: `List ${data.lists.length + 1}`,
        accent: nextAccent(data.lists),
        items: [],
      };
      persist({ ...data, lists: [...data.lists, list] });
      setListId(list.id);
    },
  };

  /* ---------- event actions ---------- */
  const rawEvent =
    evOpen && evOpen !== "new"
      ? data.events.find((e) => e.id === evOpen)
      : null;
  const draftFrom = (e) => ({
    id: e.id,
    title: e.title,
    date: dateInputValue(e.start),
    start: e.allDay ? "09:00" : hhmm(e.start),
    end: e.allDay || !e.end ? "10:00" : hhmm(e.end),
    allDay: !!e.allDay,
    location: e.location || "",
    description: e.description || "",
    cat: e.cat || "personal",
    alerts: [...(e.alerts || [])],
  });
  const openEvent = (id) => {
    setEvOpen(id);
    setEvEdit(false);
    setDraft(null);
  };
  const newEvent = (day, hour) => {
    setEvOpen("new");
    setEvEdit(true);
    setDraft({
      id: null,
      title: "",
      date: dateInputValue(day),
      start: clockOfMins(hour * 60),
      end: clockOfMins(hour * 60 + 60),
      allDay: false,
      location: "",
      description: "",
      cat: "personal",
      alerts: [60],
    });
  };
  const closeEvent = () => {
    setEvOpen(null);
    setEvEdit(false);
    setDraft(null);
  };
  const saveEvent = () => {
    if (!draft || !draft.date) return;
    const [y, m, d] = draft.date.split("-").map(Number);
    const start = new Date(y, m - 1, d);
    if (!draft.allDay) {
      start.setHours(
        Math.floor(minsOfClock(draft.start) / 60),
        minsOfClock(draft.start) % 60,
        0,
        0,
      );
    }
    let end = null;
    if (!draft.allDay) {
      end = new Date(y, m - 1, d);
      const em = minsOfClock(draft.end);
      end.setHours(Math.floor(em / 60), em % 60, 0, 0);
      if (end <= start) end = new Date(start.getTime() + 3600000);
    }
    const clean = {
      title: draft.title.trim() || "Untitled event",
      start: start.toISOString(),
      end: end ? end.toISOString() : null,
      allDay: draft.allDay,
      location: draft.location,
      description: draft.description,
      cat: draft.cat,
      alerts: [...draft.alerts],
    };
    if (draft.id) {
      persist({
        ...data,
        events: data.events.map((e) =>
          e.id === draft.id ? { ...e, ...clean } : e,
        ),
      });
      setEvEdit(false);
      setDraft(null);
      setEvOpen(draft.id);
    } else {
      /* Invariant 4: a hand-made event is seen by definition. */
      const e = {
        id: `manual-${uid()}`,
        recurring: false,
        repeats: "",
        organizer: null,
        tasks: [],
        source: "manual",
        ...clean,
      };
      persist({
        ...data,
        events: [...data.events, e],
        state: {
          ...data.state,
          seen: { ...data.state.seen, [e.id]: new Date().toISOString() },
        },
      });
      setEvOpen(e.id);
      setEvEdit(false);
      setDraft(null);
    }
  };
  const deleteEvent = () => {
    const e =
      rawEvent ||
      (draft && draft.id ? data.events.find((x) => x.id === draft.id) : null);
    if (!e) return;
    guard(`Delete “${e.title}”?`, () => {
      closeEvent();
      undoable(
        { ...data, events: data.events.filter((x) => x.id !== e.id) },
        e.title,
        "EVENT DELETED",
      );
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
  /* Invariant 5: a muted event produces zero nudges. Muting also marks it seen
     so it does not sit in the review queue for ever. */
  const toggleMute = (id) => {
    const muted = { ...data.state.muted };
    if (muted[id]) delete muted[id];
    else muted[id] = true;
    persist({
      ...data,
      state: {
        ...data.state,
        muted,
        seen: { ...data.state.seen, [id]: new Date().toISOString() },
      },
    });
  };

  const requestNotify = async () => {
    try {
      setNotifyState(await Notification.requestPermission());
    } catch (e) {
      setNotifyState("unsupported");
    }
  };

  const warnings = ruleWarnings(data);
  const overdueTodos = data.lists.reduce(
    (n, l) =>
      n +
      (l.items || []).filter(
        (i) => !i.done && i.due && new Date(i.due) < startOfDay(now),
      ).length,
    0,
  );
  const badges = {
    home: counts.now,
    lists: overdueTodos,
    calendar: unreviewed.length,
    rules: warnings.length,
  };

  const list = listId ? data.lists.find((l) => l.id === listId) : null;
  const todo =
    list && openTodo ? (list.items || []).find((i) => i.id === openTodo) : null;

  return (
    <div className="lx">
      <style>{CSS}</style>
      <div className="lx-phone">
        <StatusBar />

        <div className="lx-scroll">
          {warn && (
            <div className="lx-warnline" style={{ margin: "12px 16px 0" }}>
              {warn}
            </div>
          )}

          {tab === "home" && (
            <Home
              live={live}
              queued={queued}
              handled={handled}
              runway={runway}
              counts={counts}
              now={now}
              settings={data.settings}
              onDone={markNudgeDone}
              onRestore={restoreNudge}
              onSnooze={snoozeNudge}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenEvent={openEvent}
              newCount={unreviewed.length}
              onOpenNew={() => {
                setCalSeed("new");
                setTab("calendar");
              }}
            />
          )}

          {tab === "lists" &&
            (list ? (
              <ListDetail
                data={data}
                list={list}
                now={now}
                ops={ops}
                swipe={swipe}
                sel={sel}
                setSel={setSel}
                onOpenTodo={setOpenTodo}
                onBack={() => {
                  setListId(null);
                  setOpenTodo(null);
                  setSel([]);
                  setBulkPanel(null);
                }}
              />
            ) : (
              <ListsOverview
                data={data}
                now={now}
                onPick={(id) => {
                  setListId(id);
                  setSel([]);
                  setBulkPanel(null);
                }}
                onPickItem={(lid, itemId) => {
                  setListId(lid);
                  setOpenTodo(itemId);
                }}
                onNewList={ops.addList}
              />
            ))}

          {tab === "calendar" && (
            <CalendarTab
              data={data}
              now={now}
              unreviewed={unreviewed}
              seedView={calSeed}
              onSeedUsed={() => setCalSeed(null)}
              onOpenEvent={openEvent}
              onNewEvent={newEvent}
              onSeen={markSeen}
              onMute={toggleMute}
            />
          )}

          {tab === "rules" && (
            <Rules
              data={data}
              now={now}
              onPatchRules={(rules) => persist({ ...data, rules })}
              onDeleteRule={(rule) =>
                guard(`Delete “${rule.name}”?`, () =>
                  undoable(
                    {
                      ...data,
                      rules: data.rules.filter((r) => r.id !== rule.id),
                    },
                    rule.name,
                    "RULE DELETED",
                  ),
                )
              }
              onPatchSettings={(patch) =>
                persist({ ...data, settings: { ...data.settings, ...patch } })
              }
            />
          )}
        </div>

        {sel.length > 0 && list && tab === "lists" && !openTodo && (
          <BulkBar
            data={data}
            list={list}
            now={now}
            sel={sel}
            setSel={setSel}
            panel={bulkPanel}
            setPanel={setBulkPanel}
            ops={ops}
          />
        )}

        {confirm && (
          <div className="lx-undo" role="alertdialog" aria-label="Confirm">
            <div className="lx-undo-in">
              <div style={{ minWidth: 0 }}>
                <div className="t">{confirm.label}</div>
                <div className="m">THIS CAN STILL BE UNDONE</div>
              </div>
              <div style={{ display: "flex", gap: 7, flex: "none" }}>
                <button
                  className="lx-bulk-mini"
                  onClick={() => setConfirm(null)}
                >
                  CANCEL
                </button>
                <button
                  className="lx-undo-btn"
                  onClick={() => {
                    const run = confirm.run;
                    setConfirm(null);
                    run();
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="lx-undo-bar" />
          </div>
        )}

        {!confirm && undoTip && (
          <div className="lx-undo" role="status" aria-live="polite">
            <div className="lx-undo-in">
              <div style={{ minWidth: 0 }}>
                <div className="t">{undoTip.label}</div>
                <div className="m">{undoTip.meta}</div>
              </div>
              <button className="lx-undo-btn" onClick={runUndo}>
                Undo
              </button>
            </div>
            <div className="lx-undo-bar">
              <i />
            </div>
          </div>
        )}

        {todo && list && (
          <TodoSheet
            data={data}
            list={list}
            item={todo}
            now={now}
            ops={ops}
            onClose={() => setOpenTodo(null)}
          />
        )}

        {evOpen && (rawEvent || (evEdit && draft)) && (
          <EventSheet
            data={data}
            event={rawEvent}
            draft={draft}
            editing={evEdit && !!draft}
            setDraft={setDraft}
            onClose={closeEvent}
            onEdit={() => {
              setDraft(draftFrom(rawEvent));
              setEvEdit(true);
            }}
            onCancel={() => {
              if (draft && draft.id) {
                setEvEdit(false);
                setDraft(null);
              } else closeEvent();
            }}
            onSave={saveEvent}
            onDelete={deleteEvent}
          />
        )}

        {settingsOpen && (
          <Settings
            data={data}
            persist={persist}
            undoable={undoable}
            notifyState={notifyState}
            onRequestNotify={requestNotify}
            onClose={() => setSettingsOpen(false)}
          />
        )}

        <nav className="lx-nav">
          {TABS.map(([key, label, icon]) => {
            const on = tab === key;
            const badge = badges[key];
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-current={on ? "page" : undefined}
                aria-label={label}
              >
                <span
                  className="lx-ico"
                  style={{ color: on ? "var(--ink)" : "var(--mute-3)" }}
                >
                  <TabIcon name={icon} />
                  {badge > 0 && (
                    <span
                      className="lx-navbadge"
                      style={{
                        background:
                          key === "home" ? "var(--amber-ink)" : "var(--mute-2)",
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </span>
                <span
                  className="lab"
                  style={{ color: on ? "var(--ink)" : "var(--mute-3)" }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
