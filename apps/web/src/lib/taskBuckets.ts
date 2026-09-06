// Pure grouping/formatting logic for the Home screen — no fetching, no DOM.
// Kept separate from HomeScreen.tsx so it can be unit tested directly (see
// docs/ROADMAP.md's Phase-2 Home item and the project's convention of
// testing pure logic files rather than components).

import type { Reminder, ReminderInput, TaskRecord } from "@heads-up/shared";

export type TaskBucket = "overdue" | "next3" | "nextweek" | "upcoming" | "done" | null;

export interface BucketedTask {
  task: TaskRecord;
  bucket: TaskBucket;
  /** True for a not-done task due today — HomeScreen breaks these out of "next3". */
  isToday: boolean;
  dueLabel: string | null;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MS_PER_DAY = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole calendar days from `b` to `a` (positive when `a` is later), in the
 * viewer's local timezone — matches how a person reads "overdue by 2 days". */
function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / MS_PER_DAY);
}

function hasTimeComponent(d: Date): boolean {
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

export function formatTime(d: Date): string {
  const h24 = d.getHours();
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${suffix}`;
}

export function formatShortDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Buckets a task by urgency and renders its due label, relative to `now`
 * (a parameter, not `new Date()` internally, so tests are deterministic). */
export function bucketTask(task: TaskRecord, now: Date): BucketedTask {
  if (task.done) {
    const label = task.doneAt ? `Completed ${formatShortDate(new Date(task.doneAt))}` : "Completed";
    return { task, bucket: "done", isToday: false, dueLabel: label };
  }
  if (!task.dueAt) return { task, bucket: null, isToday: false, dueLabel: null };

  const due = new Date(task.dueAt);
  const dayDiff = daysBetween(due, now);
  const recurSuffix = task.recurrenceRule ? ` · repeats ${task.recurrenceRule}` : "";

  if (dayDiff < 0) {
    const n = -dayDiff;
    return { task, bucket: "overdue", isToday: false, dueLabel: `Overdue by ${n} day${n > 1 ? "s" : ""}${recurSuffix}` };
  }

  const timeSuffix = hasTimeComponent(due) ? ` · ${formatTime(due)}` : "";
  if (dayDiff === 0) {
    return { task, bucket: "next3", isToday: true, dueLabel: `Today${timeSuffix}${recurSuffix}` };
  }

  const dateLabel = `${WEEKDAYS[due.getDay()]}, ${formatShortDate(due)}${timeSuffix}${recurSuffix}`;
  if (dayDiff <= 3) return { task, bucket: "next3", isToday: false, dueLabel: dateLabel };
  if (dayDiff <= 7) return { task, bucket: "nextweek", isToday: false, dueLabel: dateLabel };
  return { task, bucket: "upcoming", isToday: false, dueLabel: dateLabel };
}

export interface ReminderPreset {
  label: string;
  /** `dueAt` is the task's due timestamp (ISO) — "Morning of" resolves
   * against that specific date. */
  toInput: (dueAt: string) => ReminderInput;
}

export const REMINDER_PRESETS: ReminderPreset[] = [
  { label: "1 week before", toInput: () => ({ kind: "before_due", minutesBefore: 7 * 24 * 60, at: null }) },
  { label: "1 day before", toInput: () => ({ kind: "before_due", minutesBefore: 24 * 60, at: null }) },
  {
    label: "Morning of",
    toInput: (dueAt) => {
      const d = new Date(dueAt);
      const morning = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 0, 0);
      return { kind: "absolute", minutesBefore: null, at: morning.toISOString() };
    },
  },
  { label: "1 hour before", toInput: () => ({ kind: "before_due", minutesBefore: 60, at: null }) },
];

/** The preset a stored reminder was created from, for Task Detail's display
 * — reminders themselves carry no label, just kind/minutesBefore/at, so this
 * matches them back against what REMINDER_PRESETS would produce for this
 * task's own dueAt. Falls back to a generic label for anything that doesn't
 * match a preset exactly (there's no custom-time picker yet — see
 * TaskDetailScreen). */
export function reminderLabel(task: TaskRecord, reminder: Reminder): string {
  if (task.dueAt) {
    const preset = REMINDER_PRESETS.find((p) => {
      const input = p.toInput(task.dueAt!);
      return input.kind === reminder.kind && input.minutesBefore === reminder.minutesBefore && input.at === reminder.at;
    });
    if (preset) return preset.label;
  }
  return "Reminder";
}

/** When a reminder actually fires, formatted for display — `null` when it
 * can't be resolved (a before_due reminder on a task with no dueAt, which
 * shouldn't happen in practice since reminders require a due date to add). */
export function reminderDateLabel(task: TaskRecord, reminder: Reminder): string | null {
  let fireAt: Date | null = null;
  if (reminder.kind === "absolute" && reminder.at) {
    fireAt = new Date(reminder.at);
  } else if (reminder.kind === "before_due" && task.dueAt && reminder.minutesBefore != null) {
    fireAt = new Date(new Date(task.dueAt).getTime() - reminder.minutesBefore * 60_000);
  }
  if (!fireAt) return null;
  const timeSuffix = hasTimeComponent(fireAt) ? ` · ${formatTime(fireAt)}` : "";
  return `${formatShortDate(fireAt)}${timeSuffix}`;
}
