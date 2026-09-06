// Core domain types, shared verbatim between apps/web and apps/api.
// Timestamps are ISO 8601 strings on the wire; the API is the only writer.

export type Priority = "low" | "normal" | "high";

export type ReminderKind = "before_due" | "absolute";

export interface Reminder {
  id: string;
  taskId: string;
  kind: ReminderKind;
  /** Minutes before the task's dueAt. Required when kind === "before_due". */
  minutesBefore: number | null;
  /** Absolute ISO timestamp. Required when kind === "absolute". */
  at: string | null;
}

export interface List {
  id: string;
  userId: string;
  name: string;
  /** A CSS color value (the design's list-accent color). */
  color: string;
  createdAt: string;
  updatedAt: string;
}

export type EventSource = "manual";

export interface EventRecord {
  id: string;
  userId: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
  /** Freeform for now — see docs/DECISIONS.md ADR-005. */
  recurrenceRule: string | null;
  source: EventSource;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  userId: string;
  /** Mutually exclusive with listId — a task links to an event, a list, or neither. */
  eventId: string | null;
  listId: string | null;
  name: string;
  done: boolean;
  doneAt: string | null;
  priority: Priority;
  dueAt: string | null;
  /** Manual sort order within its list/event/standalone bucket. */
  order: number;
  recurrenceRule: string | null;
  createdAt: string;
  updatedAt: string;
  reminders: Reminder[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}
