/* ============================================================
   Time — every date the app says out loud
   ------------------------------------------------------------
   Formatting, clock arithmetic and the labels a lead time gets.
   All local time and all pure: nothing here reads state, and
   nothing here decides when a reminder is due — that is nudges.js.
   ============================================================ */

/* ---------- time helpers ---------- */
export const MS_DAY = 86400000;

export const pad = (n) => String(n).padStart(2, "0");

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function daysApart(a, b) {
  return Math.round((startOfDay(a) - startOfDay(b)) / MS_DAY);
}

export function fmtDate(d) {
  return new Date(d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function fmtTime(d) {
  return new Date(d).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relative(target, now) {
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

export function leadLabel(days) {
  if (days === 0) return "day of";
  if (days === 1) return "1 day before";
  if (days === 7) return "1 week before";
  if (days === 14) return "2 weeks before";
  return `${days} days before`;
}

/* Mono chip form of a lead time: the ladder's rungs are read as a column. */
export function leadChip(days) {
  if (days === 0) return "DAY OF";
  if (days === 7) return "1 WK";
  if (days === 14) return "2 WK";
  return `${days}D`;
}

export function leadRung(days) {
  if (days === 0) return "DAY OF";
  if (days === 1) return "1 DAY BEFORE";
  if (days === 7) return "1 WEEK BEFORE";
  return `${days} DAYS BEFORE`;
}

/* T−nD — the same lead time in the ledger's shorthand. */
export function tminus(days) {
  return days === 0 ? "T−0" : `T−${days}D`;
}

export function alertLabel(mins) {
  if (mins === 0) return "at start";
  if (mins < 60) return `${mins} min before`;
  if (mins < 1440) return `${mins / 60} h before`;
  return `${mins / 1440} day before`;
}

export function alertChip(mins) {
  if (mins === 0) return "AT TIME";
  if (mins < 60) return `${mins} MIN`;
  if (mins < 1440) return `${mins / 60} HOUR${mins === 60 ? "" : "S"}`;
  return `${mins / 1440} DAY`;
}

/* Mono small-caps labels are set as instrument readings, so the locale's comma
   goes: "FRI 7 AUG", not "FRI, 7 AUG". Order still comes from the locale. */
export const capDate = (d) => fmtDate(d).replace(/,/g, "").toUpperCase();

/* Does this locale read the clock in halves? The calendar's 36px hour gutter
   has room for "06" or "6a", and it has to agree with the times on the blocks. */
const HOUR12 = (() => {
  try {
    return /\bam|\bpm/i.test(new Date(2020, 0, 1, 13).toLocaleTimeString());
  } catch (e) {
    return false;
  }
})();

export const gutterHour = (h) =>
  HOUR12 ? `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}` : pad(h);

export const hhmm = (d) =>
  `${pad(new Date(d).getHours())}:${pad(new Date(d).getMinutes())}`;

export const minsOfClock = (s) =>
  s ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)) : 0;

export const clockOfMins = (m) =>
  `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

export const sameDay = (a, b) =>
  !!a && !!b && startOfDay(a).getTime() === startOfDay(b).getTime();

export const addDays = (d, n) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
};

/* ISO-8601 week number — the calendar shows it as KW nn. */
export function isoWeek(d) {
  const t = startOfDay(d);
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const first = new Date(t.getFullYear(), 0, 4);
  return (
    1 + Math.round(((t - first) / MS_DAY - 3 + ((first.getDay() + 6) % 7)) / 7)
  );
}

export const dateInputValue = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const isoFromInput = (v, hour = 9) => {
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
