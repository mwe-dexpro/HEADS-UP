/* A to-do's derived facts — its steps, its tags, and the one-line summary a
   list shows about itself. A to-do with no date never nudges, and `itemTags`
   is where the list says so out loud. */

import { ACCENTS } from "./data.js";
import { capDate, startOfDay } from "./time.js";

export const TODO_LEADS = [0, 1, 2, 3, 7, 14];

export function stepCount(item) {
  const subs = item.subtasks || [];
  return { total: subs.length, done: subs.filter((s) => s.done).length };
}

export function itemTags(item, now) {
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

export function listMeta(list, now) {
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
