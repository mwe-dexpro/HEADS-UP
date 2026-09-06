// API request/response contracts. Shapes here are the wire format for
// apps/api's Hono routes, imported by apps/web so client and server can
// never silently drift.

import type { EventRecord, List, Priority, Reminder, TaskRecord, User } from "./entities.js";

export interface ApiErrorBody {
  error: string;
}

export interface MeResponse {
  user: User;
}

/** Returned by /auth/microsoft/callback and /auth/refresh. The refresh token
 * itself never appears here — it travels only as the httpOnly cookie. */
export interface AuthTokenResponse {
  accessToken: string;
  /** Unix ms when accessToken expires — lets the client schedule a silent refresh. */
  expiresAt: number;
  user: User;
}

export type ReminderInput = Pick<Reminder, "kind" | "minutesBefore" | "at">;

export interface CreateEventInput {
  title: string;
  start: string;
  end?: string | null;
  allDay?: boolean;
  location?: string | null;
  description?: string | null;
  recurrenceRule?: string | null;
}

export type UpdateEventInput = Partial<CreateEventInput>;

export interface CreateTaskInput {
  eventId?: string | null;
  listId?: string | null;
  name: string;
  priority?: Priority;
  dueAt?: string | null;
  order?: number;
  recurrenceRule?: string | null;
  reminders?: ReminderInput[];
}

export type UpdateTaskInput = Partial<Omit<CreateTaskInput, "reminders">> & {
  done?: boolean;
  reminders?: ReminderInput[];
};

export interface CreateListInput {
  name: string;
  color: string;
}

export type UpdateListInput = Partial<CreateListInput>;

export interface EventsListResponse {
  events: EventRecord[];
}

export interface TasksListResponse {
  tasks: TaskRecord[];
}

/** GET /tasks/:id, POST /tasks, and PATCH /tasks/:id all wrap the task in an
 * object rather than returning it bare. */
export interface TaskResponse {
  task: TaskRecord;
}

export interface ListsListResponse {
  lists: List[];
}
