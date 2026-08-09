/* ============================================================
   .ics — one file in, events out
   ------------------------------------------------------------
   A deliberately small subset: VEVENT, the recurrence rules that
   actually appear in shared calendars, and enough unescaping that
   a description survives the trip. Everything it cannot read it
   ignores rather than guesses at.
   ============================================================ */

import { HORIZON_DAYS } from "./config.js";
import { MS_DAY, dayKey, startOfDay } from "./time.js";
import { uid } from "./util.js";

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

export function parseICS(text) {
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
