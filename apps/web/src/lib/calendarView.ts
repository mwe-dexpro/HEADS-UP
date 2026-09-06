// Pure date-math and grouping logic for the Calendar screen — no fetching,
// no DOM. Mirrors design/project/calendar-view.jsx's helpers, adapted to the
// live API's shapes (EventRecord.allDay/ISO timestamps, TaskRecord.dueAt)
// instead of the prototype's mock dayOffset/time-string fields. Kept
// separate from CalendarScreen.tsx so it can be unit tested directly, per
// the project's convention of testing pure logic files rather than
// components (see lib/taskBuckets.ts).

import type { EventRecord, TaskRecord } from "@heads-up/shared";

export type CalendarSubView = "day" | "day3" | "week" | "month" | "agenda";
export type CalendarItemFilter = "all" | "events" | "tasks";

export interface CalendarItem {
  kind: "event" | "task";
  id: string;
  name: string;
  /** The local calendar day this item is shown on (start of day). */
  date: Date;
  /** Minutes since local midnight; null for an all-day event or a task
   * with no time component (due at exactly midnight). */
  startMinutes: number | null;
  /** Only set for a timed event whose end falls on the same day as its start. */
  endMinutes: number | null;
  allDay: boolean;
  location: string | null;
  listId: string | null;
  done: boolean;
}

export interface CalendarDayGroup {
  date: Date;
  items: CalendarItem[];
}

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Sunday-anchored, matching the design prototype's `getDay()`-based week start. */
export function startOfWeek(d: Date): Date {
  const r = startOfDay(d);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** 42 cells (6 weeks) covering the month containing `anchor`, starting from
 * the Sunday on or before the 1st — a fixed-size grid so the layout never
 * reflows between 4-, 5- and 6-week months. */
export function monthGridDays(anchor: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(anchor));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/** The days shown by the Day/3-Day/Week sub-views; null for Month and Agenda,
 * which don't render a fixed day-column grid. */
export function viewDays(subView: CalendarSubView, anchor: Date): Date[] | null {
  if (subView === "day") return [startOfDay(anchor)];
  if (subView === "day3") return [0, 1, 2].map((i) => addDays(startOfDay(anchor), i));
  if (subView === "week") {
    const ws = startOfWeek(anchor);
    return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(ws, i));
  }
  return null;
}

/** The new anchor date after paging the given sub-view forward (dir=1) or
 * back (dir=-1). Agenda has no anchor/paging — it's a flat upcoming list. */
export function shiftAnchor(subView: CalendarSubView, anchor: Date, dir: 1 | -1): Date {
  if (subView === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  if (subView === "day3") return addDays(anchor, 3 * dir);
  if (subView === "day") return addDays(anchor, dir);
  return addDays(anchor, 7 * dir);
}

function formatRange(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const s = `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()}`;
  const e = sameMonth ? `${end.getDate()}` : `${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}`;
  return `${s}–${e}, ${end.getFullYear()}`;
}

/** The label shown next to the prev/next/Today controls. */
export function headerLabel(subView: CalendarSubView, anchor: Date): string {
  if (subView === "month") return `${MONTHS_LONG[anchor.getMonth()]} ${anchor.getFullYear()}`;
  if (subView === "day") return `${WEEKDAYS_LONG[anchor.getDay()]}, ${MONTHS_LONG[anchor.getMonth()]} ${anchor.getDate()}`;
  const days = viewDays(subView, anchor);
  if (!days) return "";
  return formatRange(days[0], days[days.length - 1]);
}

/** The label above a day's items in the Agenda view / Month view's day panel. */
export function dayGroupLabel(d: Date, now: Date): string {
  const full = `${WEEKDAYS_LONG[d.getDay()]}, ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`;
  if (isSameDay(d, now)) return `Today · ${full}`;
  if (isSameDay(d, addDays(now, 1))) return `Tomorrow · ${full}`;
  if (isSameDay(d, addDays(now, -1))) return `Yesterday · ${full}`;
  return full;
}

export function weekdayShortLabels(): readonly string[] {
  return WEEKDAYS_SHORT;
}

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function hasTimeComponent(d: Date): boolean {
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

export function eventToCalendarItem(event: EventRecord): CalendarItem {
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : null;
  const sameDayEnd = end && isSameDay(end, start);
  return {
    kind: "event",
    id: event.id,
    name: event.title,
    date: startOfDay(start),
    startMinutes: event.allDay ? null : minutesSinceMidnight(start),
    endMinutes: !event.allDay && sameDayEnd ? minutesSinceMidnight(end) : null,
    allDay: event.allDay,
    location: event.location,
    listId: null,
    done: false,
  };
}

/** Null for a standalone/undated task — it has nothing to place on the
 * calendar (matches the prototype's own dayOffset != null filter). */
export function taskToCalendarItem(task: TaskRecord): CalendarItem | null {
  if (!task.dueAt) return null;
  const due = new Date(task.dueAt);
  const timed = hasTimeComponent(due);
  return {
    kind: "task",
    id: task.id,
    name: task.name,
    date: startOfDay(due),
    startMinutes: timed ? minutesSinceMidnight(due) : null,
    endMinutes: null,
    allDay: !timed,
    location: null,
    listId: task.listId,
    done: task.done,
  };
}

export function buildCalendarItems(events: EventRecord[], tasks: TaskRecord[], filter: CalendarItemFilter): CalendarItem[] {
  const items: CalendarItem[] = [];
  if (filter !== "tasks") {
    for (const e of events) items.push(eventToCalendarItem(e));
  }
  if (filter !== "events") {
    for (const t of tasks) {
      const item = taskToCalendarItem(t);
      if (item) items.push(item);
    }
  }
  return items;
}

export function itemsOnDay(items: CalendarItem[], day: Date): CalendarItem[] {
  return items.filter((it) => isSameDay(it.date, day));
}

/** Untimed items (all-day events, undated-time tasks) first is arbitrary but
 * stable; the design places "All day" in its own row rather than sorting it
 * in, so within a single list, -1 just needs to be a consistent, low sentinel. */
export function sortByTime(items: CalendarItem[]): CalendarItem[] {
  return [...items].sort((a, b) => (a.startMinutes ?? -1) - (b.startMinutes ?? -1));
}

/** Groups items by calendar day, sorted chronologically by day and, within
 * each day, by start time — the shape both the Agenda tab and Month view's
 * day panel need. */
export function groupByDay(items: CalendarItem[]): CalendarDayGroup[] {
  const byKey = new Map<number, CalendarItem[]>();
  for (const it of items) {
    const key = it.date.getTime();
    const arr = byKey.get(key) ?? [];
    arr.push(it);
    byKey.set(key, arr);
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, arr]) => ({ date: arr[0].date, items: sortByTime(arr) }));
}
