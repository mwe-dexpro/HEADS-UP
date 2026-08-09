/* ============================================================
   Nudge presentation
   ------------------------------------------------------------
   The layer between the engine and the cards: given a nudge, the
   strings, marks and colours that stand for it. Pure, and shared,
   so a reminder reads the same on the home ledger, in the runway
   and in the quick-action menu.
   ============================================================ */

import { ACCENTS } from "../lib/data.js";
import { endOfWeek } from "../lib/nudges.js";
import {
  addDays,
  alertChip,
  capDate,
  fmtDate,
  fmtTime,
  leadRung,
  relative,
  sameDay,
  tminus,
} from "../lib/time.js";

/* ---------- nudge presentation ----------
   Pure mappings from a nudge to the strings and colours the cards render.  */
export function rungOf(n) {
  if (n.kind === "todo") {
    if (n.implicit) return "DAY OF";
    return n.lead == null ? "ONE-OFF" : leadRung(n.lead);
  }
  if (n.alertMinutes != null) return alertChip(n.alertMinutes);
  return leadRung(n.lead);
}

export function tminusOf(n) {
  if (n.alertMinutes != null) return alertChip(n.alertMinutes);
  return n.lead == null ? "T−0" : tminus(n.lead);
}

/* Takes the same weekStart as the buckets, so the label and the section it sits
   in can never disagree: a bare weekday is only unambiguous inside this calendar
   week. "DUE WED" under LATER would be a riddle. */
export function dueLabelOf(n, now, weekStart) {
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

export function railOf(n, live) {
  if (live) return "var(--amber)";
  if (n.kind === "todo") return n.accent || ACCENTS[0];
  return "#c9c3b5";
}

/* The same three states as the rail, at chip strength. */
export function tintOf(n, live) {
  if (live) return "var(--tint-live)";
  if (n.kind === "todo") return "var(--tint-todo)";
  return "var(--tint-event)";
}

export function rowsOf(n, now) {
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

export function originOf(n) {
  return n.kind === "todo" ? "SOURCE" : "FROM RULE";
}

export function originValue(n) {
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
export function rungLine(n) {
  const t = tminusOf(n);
  const r = rungOf(n);
  return t === r ? r : `${t} · ${r}`;
}

export function notesOf(n) {
  if (n.kind === "todo") return n.notes || "—";
  return (n.event && n.event.description) || "—";
}
