import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Timestamps are stored as ISO 8601 strings (TEXT) rather than integers —
// D1 is SQLite, which has no native date type either way, and ISO text
// sorts correctly, is human-readable in `wrangler d1 execute`, and matches
// the wire format in packages/shared exactly (no conversion at the boundary).

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  msAccountId: text("ms_account_id").notNull().unique(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// Refresh tokens are never stored raw — only an HMAC-SHA256 of the token,
// keyed by a server-only pepper (REFRESH_TOKEN_PEPPER). A dumped table
// cannot be replayed without also having the pepper. `familyId` groups all
// tokens issued from one sign-in; replaying an already-rotated token
// revokes the whole family (theft signal) — see src/lib/refreshTokens.ts.
export const refreshTokens = sqliteTable(
  "refresh_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    familyId: text("family_id").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (t) => [index("refresh_tokens_family_idx").on(t.familyId)],
);

export const lists = sqliteTable(
  "lists",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (t) => [index("lists_user_idx").on(t.userId)],
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    start: text("start").notNull(),
    end: text("end"),
    allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
    location: text("location"),
    description: text("description"),
    recurrenceRule: text("recurrence_rule"),
    source: text("source", { enum: ["manual"] })
      .notNull()
      .default("manual"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (t) => [index("events_user_idx").on(t.userId), index("events_user_start_idx").on(t.userId, t.start)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Mutually exclusive-or-neither, enforced in the route layer (see
    // routes/tasks.ts) rather than a CHECK constraint — D1's SQLite build
    // supports CHECK, but keeping the invariant in one reviewable place
    // (application code, alongside its tests) beat splitting it across a
    // migration file and the route.
    eventId: text("event_id").references(() => events.id, { onDelete: "cascade" }),
    listId: text("list_id").references(() => lists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    doneAt: text("done_at"),
    priority: text("priority", { enum: ["low", "normal", "high"] })
      .notNull()
      .default("normal"),
    dueAt: text("due_at"),
    order: integer("order").notNull().default(0),
    recurrenceRule: text("recurrence_rule"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (t) => [
    index("tasks_user_idx").on(t.userId),
    index("tasks_event_idx").on(t.eventId),
    index("tasks_list_idx").on(t.listId),
    index("tasks_user_due_idx").on(t.userId, t.dueAt),
  ],
);

export const reminders = sqliteTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["before_due", "absolute"] }).notNull(),
    minutesBefore: integer("minutes_before"),
    at: text("at"),
  },
  (t) => [index("reminders_task_idx").on(t.taskId)],
);

// Fixed-window request counter backing src/lib/rateLimit.ts — protects
// /auth/* against brute-force/credential abuse (see docs/THREAT-MODEL.md
// "Denial of service"). `key` is typically `${ip}:${route}`.
export const rateLimitBuckets = sqliteTable(
  "rate_limit_buckets",
  {
    key: text("key").notNull(),
    windowStart: integer("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

// Written on every destructive action (delete, and any state-changing
// write we may later want to explain) — see docs/THREAT-MODEL.md
// "Repudiation". D1's own point-in-time recovery is the backstop; this is
// the human-readable trail.
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    at: text("at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (t) => [index("audit_log_user_idx").on(t.userId)],
);
